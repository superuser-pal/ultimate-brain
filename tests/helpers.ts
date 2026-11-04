import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";

import { writeSnapshotManifest } from "../scripts/build-skills.ts";
import { runCli, type CliIo } from "../src/cli.ts";
import { setInstalledProductRootForTests } from "../src/lib/skills.ts";

export const FIXTURE_BRAIN = join(import.meta.dirname, "fixtures", "brain-acme");
const REPO = join(import.meta.dirname, "..");
/** The mirror without the generated manifest, which a local build may have left (spec/skills-delivery.md §9). */
const notManifest = (path: string) => !path.endsWith(`${join(".agents", "skills", "snapshot.json")}`);

let packageRoot: string | undefined;
/**
 * The package as the published CLI sees it: package.json, the AGENTS.md template, and `.agents/skills/` with the manifest `npm run build`
 * generates (§9). Built once per test process in a temp folder, because the checkout's mirror has no committed manifest.
 */
export async function testPackageRoot(): Promise<string> {
  if (packageRoot !== undefined) return packageRoot;
  const root = mkdtempSync(join(tmpdir(), "brain-package-"));
  process.on("exit", () => rmSync(root, { recursive: true, force: true }));
  cpSync(join(REPO, "package.json"), join(root, "package.json"));
  mkdirSync(join(root, "templates", "brain"), { recursive: true });
  cpSync(join(REPO, "templates", "brain", "AGENTS.md"), join(root, "templates", "brain", "AGENTS.md"));
  cpSync(join(REPO, ".agents", "skills"), join(root, ".agents", "skills"), { recursive: true, filter: notManifest });
  await writeSnapshotManifest(join(root, ".agents", "skills"), JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")).version);
  packageRoot = root;
  return root;
}

/** Copy the fixture brain to a temp dir that is removed after the test. */
export async function fixtureCopy(context: TestContext): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "brain-test-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const brain = join(parent, "brain-acme");
  await cp(FIXTURE_BRAIN, brain, { recursive: true });
  // Fixtures stay product-neutral; whole-brain lint tests receive the shipped files at runtime.
  await rm(join(brain, ".agents", "skills"), { recursive: true, force: true });
  await cp(join(import.meta.dirname, "..", ".agents", "skills"), join(brain, ".agents", "skills"), { recursive: true, filter: notManifest });
  await cp(join(import.meta.dirname, "..", ".agents", "skills"), join(brain, ".claude", "skills"), { recursive: true, filter: notManifest });
  await cp(join(import.meta.dirname, "..", "templates", "brain", "AGENTS.md"), join(brain, "AGENTS.md"));
  return brain;
}

export interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
  /** Parsed stdout, for `--json` runs. */
  json: any;
}

/** Run the CLI in-process with captured output and an isolated environment. */
export async function brain(
  args: readonly string[],
  home = tmpdir(),
  productRoot?: string,
  productSource = false,
): Promise<CliRun> {
  setInstalledProductRootForTests(productRoot ?? await testPackageRoot(), productSource);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = {
    stdout: { write: (value) => stdout.push(String(value)) },
    stderr: { write: (value) => stderr.push(String(value)) },
  };
  const code = await runCli(args, { io, env: {}, homeDirectory: home });
  const out = stdout.join("");
  let json: unknown;
  try {
    json = JSON.parse(out);
  } catch {
    json = undefined;
  }
  return { code, stdout: out, stderr: stderr.join(""), json };
}

/** A brain whose Review has no Decided property yet: rows keep the old layout (Proposed with the detail, `notion.review_sections` off). */
export async function withoutReviewSections(dir: string): Promise<void> {
  const { readFile, writeFile } = await import("node:fs/promises");
  const path = join(dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  config.notion.review_sections = false;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

/** Makes a draft note reviewed, as approving it in Review does: only reviewed knowledge gets a Notion page (0071). */
export async function approveNote(dir: string, path: string): Promise<void> {
  const file = join(dir, path);
  await writeFile(file, (await readFile(file, "utf8")).replace(/^lifecycle: draft$/m, "lifecycle: reviewed"));
}
