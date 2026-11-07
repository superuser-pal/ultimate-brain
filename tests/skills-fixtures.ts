/**
 * Fixture snapshots and a temporary package root for the pinned-skills tests (spec/skills-delivery.md §12.1). Synthetic content only;
 * no network, never the real fork or a real brain. Run this file to regenerate the committed snapshot.json of A and B.
 */
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { runCli, type CliIo } from "../src/cli.ts";
import { setInstalledProductRootForTests } from "../src/lib/skills.ts";
import { buildManifest, computeIntegrity, serializeManifest, type Manifest, type ManifestMeta } from "../src/lib/skills-snapshot.ts";

export const SNAPSHOTS = join(import.meta.dirname, "fixtures", "skills-snapshots");
const REPO = join(import.meta.dirname, "..");
const exec = promisify(execFile);

export const FORK_META = (version: string): ManifestMeta => ({
  name: "ultimate-brain-skills",
  version,
  cli: ">=0.9.0 <0.10.0",
  source: { repository: "https://github.com/example/ultimate-brain-skills", commit: "4".repeat(40) },
  upstream: { repository: "https://github.com/example/upstream-skills", commit: "a".repeat(40) },
  targets: (name) => (name === "brain-query" ? ["brain", "linked_repo"] : ["brain"]),
});

/** A temp folder removed after the test. */
export async function temp(context: TestContext, prefix = "skills-"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** A copy of fixture snapshot `a` or `b`, optionally with its manifest changed (integrity recomputed unless `keepIntegrity`). */
export async function snapshotCopy(context: TestContext, name: "a" | "b", change?: (manifest: Manifest) => void, keepIntegrity = false): Promise<string> {
  const folder = join(await temp(context), name);
  await cp(join(SNAPSHOTS, name), folder, { recursive: true });
  if (change !== undefined) {
    const manifest = JSON.parse(await readFile(join(folder, "snapshot.json"), "utf8")) as Manifest;
    change(manifest);
    if (!keepIntegrity) manifest.integrity = computeIntegrity(manifest.skills);
    await writeFile(join(folder, "snapshot.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return folder;
}

/** One invalid snapshot per §2.3 reason id, each a damaged copy of A. */
export async function invalidSnapshots(context: TestContext): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const damaged = async (id: string, damage: (folder: string) => Promise<void>) => {
    const folder = await snapshotCopy(context, "a");
    await damage(folder);
    out[id] = folder;
  };
  const manifest = async (folder: string, change: (value: any) => void) => {
    const value = JSON.parse(await readFile(join(folder, "snapshot.json"), "utf8"));
    change(value);
    await writeFile(join(folder, "snapshot.json"), JSON.stringify(value));
  };
  await damaged("manifest-missing", (folder) => rm(join(folder, "snapshot.json")));
  await damaged("manifest-unparseable", (folder) => writeFile(join(folder, "snapshot.json"), "{"));
  await damaged("manifest-schema", (folder) => manifest(folder, (value) => { value.format = 2; }));
  await damaged("manifest-order", (folder) => manifest(folder, (value) => { value.skills.reverse(); }));
  await damaged("integrity", (folder) => manifest(folder, (value) => { value.integrity = `sha256-${"0".repeat(64)}`; }));
  await damaged("file-missing", (folder) => rm(join(folder, "brain-old", "SKILL.md")));
  await damaged("not-a-file", async (folder) => {
    await rm(join(folder, "brain-old", "SKILL.md"));
    await symlink(join(folder, "brain-apply", "SKILL.md"), join(folder, "brain-old", "SKILL.md"));
  });
  await damaged("file-mismatch", (folder) => writeFile(join(folder, "brain-apply", "SKILL.md"), "changed\n"));
  await damaged("unlisted-entry", (folder) => writeFile(join(folder, "brain-apply", "extra.md"), "stray\n"));
  return out;
}

/** A package root as the installed-package lookup sees it (cli.md §5.15): package.json, the AGENTS.md template and `.agents/skills`. */
export async function productRoot(context: TestContext, snapshot: string, version = "0.9.0"): Promise<string> {
  const root = await temp(context, "skills-product-");
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "ultimate-brain", version })}\n`);
  await mkdir(join(root, "templates", "brain"), { recursive: true });
  await cp(join(REPO, "templates", "brain", "AGENTS.md"), join(root, "templates", "brain", "AGENTS.md"));
  await cp(join(REPO, "templates", "brain", ".claude"), join(root, "templates", "brain", ".claude"), { recursive: true });
  await cp(snapshot, join(root, ".agents", "skills"), { recursive: true });
  return root;
}

export interface Run { code: number; json: any; stdout: string; stderr: string }

/** Run the CLI in-process against `product`, with `HOME` set to `home` (empty string: HOME unset). */
export async function run(args: readonly string[], options: { product: string; home: string }): Promise<Run> {
  setInstalledProductRootForTests(options.product, false);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = { stdout: { write: (value) => stdout.push(String(value)) }, stderr: { write: (value) => stderr.push(String(value)) } };
  const env = options.home === "" ? {} : { HOME: options.home };
  const code = await runCli(args, { io, env, homeDirectory: options.home === "" ? tmpdir() : options.home });
  const out = stdout.join("");
  let json: unknown;
  try { json = JSON.parse(out); } catch { json = undefined; }
  return { code, json, stdout: out, stderr: stderr.join("") };
}

/** A git brain made by `brain init` from `product`, committed, so upgrade can run. */
export async function initBrain(context: TestContext, product: string, home: string): Promise<string> {
  const target = join(await temp(context, "skills-brain-"), "brain");
  const init = await run(["init", target, "--owner", "Test Owner", "--now", "2026-12-03T10:22:00Z", "--json"], { product, home });
  if (init.code !== 0) throw new Error(init.stdout + init.stderr);
  await git(target, ["config", "user.name", "Test"]);
  await git(target, ["config", "user.email", "test@example.test"]);
  await git(target, ["add", "--all"]);
  await git(target, ["commit", "-q", "-m", "init", "--allow-empty"]);
  return target;
}

export async function git(root: string, args: string[]): Promise<string> {
  return (await exec("git", args, { cwd: root })).stdout;
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  for (const [name, version] of [["a", "1.0.0"], ["b", "1.1.0"]] as const) {
    await rm(join(SNAPSHOTS, name, "snapshot.json"), { force: true });
    await writeFile(join(SNAPSHOTS, name, "snapshot.json"), serializeManifest(buildManifest(join(SNAPSHOTS, name), FORK_META(version))));
  }
  console.log("wrote tests/fixtures/skills-snapshots/{a,b}/snapshot.json");
}
