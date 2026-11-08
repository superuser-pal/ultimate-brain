import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { TestContext } from "node:test";

import { runCli, type CliIo } from "../src/cli.ts";
import { setInstalledProductRootForTests } from "../src/lib/skills.ts";

export const FIXTURE_BRAIN = join(import.meta.dirname, "fixtures", "brain-acme");
const REPO = join(import.meta.dirname, "..");
/** A brain receives only skill folders: the snapshot's top-level files stay in the package (spec/skills-delivery.md §9.6). */
const TOP_LEVEL = new Set(["snapshot.json", "LICENSE", "NOTICE.md", "README.md"]);
const skillFolder = (source: string) => (path: string) => !(dirname(path) === source && TOP_LEVEL.has(basename(path)));

/**
 * Since Git 2.5x every commit starts a detached `git maintenance run --auto`, which can still be writing into `.git/objects`
 * while a test removes its temp brain, and the removal fails with ENOTEMPTY (CC-158). Every git a test starts, directly or
 * through the in-process CLI, inherits this environment, so automatic maintenance and gc are off for the whole test process.
 * Added after any GIT_CONFIG_* entries already set, so those keep their meaning.
 */
export function disableGitAutoMaintenance(env: NodeJS.ProcessEnv = process.env): void {
  const count = Number(env.GIT_CONFIG_COUNT ?? 0) || 0;
  const entries: Array<[string, string]> = [["maintenance.auto", "false"], ["gc.auto", "0"]];
  entries.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${count + index}`] = key;
    env[`GIT_CONFIG_VALUE_${count + index}`] = value;
  });
  env.GIT_CONFIG_COUNT = String(count + entries.length);
}
disableGitAutoMaintenance();

/** Removal of a test's temp folder retries a busy or still-filling directory instead of failing the test (CC-158). */
const REMOVE = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;

let packageRoot: string | undefined;
/**
 * The package as the published CLI sees it: package.json, the AGENTS.md template, and the vendored `.agents/skills/` as it is, its
 * manifest, LICENSE and NOTICE.md included (§9.1). Built once per test process in a temp folder.
 */
export async function testPackageRoot(): Promise<string> {
  if (packageRoot !== undefined) return packageRoot;
  const root = mkdtempSync(join(tmpdir(), "brain-package-"));
  process.on("exit", () => rmSync(root, REMOVE));
  cpSync(join(REPO, "package.json"), join(root, "package.json"));
  mkdirSync(join(root, "templates", "brain"), { recursive: true });
  cpSync(join(REPO, "templates", "brain", "AGENTS.md"), join(root, "templates", "brain", "AGENTS.md"));
  cpSync(join(REPO, "templates", "brain", ".claude"), join(root, "templates", "brain", ".claude"), { recursive: true });
  cpSync(join(REPO, ".agents", "skills"), join(root, ".agents", "skills"), { recursive: true });
  packageRoot = root;
  return root;
}

/** Copy the fixture brain to a temp dir that is removed after the test. */
export async function fixtureCopy(context: TestContext): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "brain-test-"));
  context.after(() => rm(parent, REMOVE));
  const brain = join(parent, "brain-acme");
  await cp(FIXTURE_BRAIN, brain, { recursive: true });
  // Fixtures stay product-neutral; whole-brain lint tests receive the shipped skill folders at runtime.
  const shipped = join(REPO, ".agents", "skills");
  await rm(join(brain, ".agents", "skills"), { recursive: true, force: true });
  await cp(shipped, join(brain, ".agents", "skills"), { recursive: true, filter: skillFolder(shipped) });
  await cp(shipped, join(brain, ".claude", "skills"), { recursive: true, filter: skillFolder(shipped) });
  await cp(join(REPO, "templates", "brain", "AGENTS.md"), join(brain, "AGENTS.md"));
  await cp(join(REPO, "templates", "brain", ".claude", "agents"), join(brain, ".claude", "agents"), { recursive: true });
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
