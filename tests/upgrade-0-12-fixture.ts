import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { appendFile, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

/**
 * A synthetic 0.12.0 installation for CC-184 (decision 0077 §4): a brain and its linked projects, made by the **published**
 * ultimate-brain 0.12.0 package, so the coordinated upgrade is tested on what an old install really holds. Everything lives under
 * one temp folder; every run passes `--brain` and a temp `HOME`, so no command can reach a real brain or the user's global skills.
 */

const exec = promisify(execFile);
const REPO = join(import.meta.dirname, "..");
const VERSION = "0.12.0";
/** npm's `dist.integrity` for ultimate-brain@0.12.0: a cached or fresh tarball must match it byte for byte. */
const INTEGRITY = "sha512-SBmIjYtrBb9PVTuMIlh/wYuklk+/tm74MaicVYUPPxlBX8L/38er9YI6lHn7A+JWpMRz1t80XYNxhdh7j0Etqg==";
/** The tarball is cached outside the repo (never committed) so later runs work offline. */
const CACHE = join(tmpdir(), "ultimate-brain-published");
const REMOVE = { recursive: true, force: true, maxRetries: 10, retryDelay: 50 } as const;
const NOW = "2026-11-10T09:00:00Z";

export const AREA = "area-4k7m2p9q";
export const PROJECT = "prj-6t3w8n2c";
export const START = "<!-- ultimate-brain:start -->";
export const END = "<!-- ultimate-brain:end -->";

/**
 * The linked projects, each registered in brain.json `repos` (`brain repo add`) and linked (`brain link`) by 0.12.0:
 * - `plain`: nothing but what `brain link` wrote.
 * - `owned`: project-owned text before and after the managed block, in AGENTS.md and in a CLAUDE.md without `@AGENTS.md`
 *   (so Claude Code's file carries its own copy of the block, cli.md §5.12 step 2).
 * - `unreachable`: registered and linked, then its folder is gone.
 * - `damaged`: AGENTS.md lost the block's end marker.
 * - `conflicting-skill`: Claude Code's skill tree holds a second, stale definition of `brain-query` that Codex's tree doesn't
 *   (a `duplicate` competing copy, skills-delivery §5.2): the two agents' definition paths disagree.
 * - `conflicting-block`: AGENTS.md holds the managed block twice, the second copy edited.
 * - `unregistered`: a plain folder (not Git) linked by `brain link` but never `repo add`ed: the brain records no path for it.
 *   TODO(CC-182): whether the upgrade finds such a folder, reports it, or never sees it.
 */
export const PROJECTS = ["plain", "owned", "unreachable", "damaged", "conflicting-skill", "conflicting-block", "unregistered"] as const;
export type ProjectName = (typeof PROJECTS)[number];

/** The project-owned text of `owned`, around the block in each file. */
export const OWNED = {
  "AGENTS.md": { before: "# Owned project\n\nRules this project wrote for its agents.\n- Keep commits small.\n", after: "\n## After the block\n\nMore project-owned text, below the managed block.\n" },
  "CLAUDE.md": { before: "# Claude notes\n\nProject-owned text for Claude Code only.\n", after: "\nA trailing line the project wrote.\n" },
} as const;

export interface OldInstallation {
  /** The temp folder holding everything below. */
  root: string;
  /** `HOME` for every run, empty: no global skill copy or brain config. */
  home: string;
  brain: string;
  projects: Record<ProjectName, string>;
  /** A folder next to the projects that no command is told about: it must never change. */
  bystander: string;
  /** The 0.12.0 package's root and its CLI entry. */
  package: { root: string; cli: string };
  /** The environment every run uses: temp `HOME`, a Git identity, no `BRAIN_DIR`. */
  env: NodeJS.ProcessEnv;
  /** Run the 0.12.0 CLI with `--json` and `--brain`; returns the parsed output. */
  old(args: readonly string[]): Promise<any>;
}

let packageRoot: Promise<string | null> | undefined;

/** The published 0.12.0 package, unpacked once per test process into its own temp folder; null when it can't be fetched. */
export function publishedPackage(): Promise<string | null> {
  packageRoot ??= unpack();
  return packageRoot;
}

async function unpack(): Promise<string | null> {
  const tarball = await tarballPath();
  if (tarball === null) return null;
  const folder = mkdtempSync(join(tmpdir(), "ultimate-brain-0.12.0-"));
  process.on("exit", () => rmSync(folder, REMOVE));
  await exec("tar", ["-xzf", tarball, "-C", folder]);
  const root = join(folder, "package");
  // The package's dependencies (ajv, yaml) at the versions this repo installs, so no network is needed past the tarball.
  symlinkSync(join(REPO, "node_modules"), join(root, "node_modules"), "dir");
  assert.equal(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version, VERSION);
  assert.ok(!existsSync(join(root, "src", "cli.ts")), "the published package is not a source checkout");
  return root;
}

async function tarballPath(): Promise<string | null> {
  const file = join(CACHE, `ultimate-brain-${VERSION}.tgz`);
  if (existsSync(file) && integrity(file) === INTEGRITY) return file;
  mkdirSync(CACHE, { recursive: true });
  const staging = await mkdtemp(join(CACHE, "pack-"));
  try {
    await exec("npm", ["pack", `ultimate-brain@${VERSION}`, "--pack-destination", staging, "--json"], { cwd: staging, env: { ...process.env, npm_config_loglevel: "error" }, timeout: 120_000 });
    const fetched = join(staging, `ultimate-brain-${VERSION}.tgz`);
    if (integrity(fetched) !== INTEGRITY) throw new Error(`ultimate-brain@${VERSION} does not match its published integrity`);
    await rm(file, { force: true });
    await rename(fetched, file);
    return file;
  } catch (error) {
    if (error instanceof Error && /integrity/.test(error.message)) throw error;
    return null; // offline: the caller skips
  } finally {
    await rm(staging, REMOVE);
  }
}

function integrity(file: string): string {
  return `sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}`;
}

/** Git with automatic maintenance off (CC-158) and the sandbox's identity, never the user's global config. */
function sandboxEnv(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: home,
    TMPDIR: process.env.TMPDIR,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_CONFIG_COUNT: "3",
    GIT_CONFIG_KEY_0: "maintenance.auto", GIT_CONFIG_VALUE_0: "false",
    GIT_CONFIG_KEY_1: "gc.auto", GIT_CONFIG_VALUE_1: "0",
    GIT_CONFIG_KEY_2: "init.defaultBranch", GIT_CONFIG_VALUE_2: "main",
  };
}

/**
 * Build the 0.12.0 installation in a temp folder removed after the test. Returns undefined, after `context.skip`, when the published
 * package can't be fetched and no verified copy is cached.
 */
export async function oldInstallation(context: TestContext): Promise<OldInstallation | undefined> {
  const pkg = await publishedPackage();
  if (pkg === null) {
    context.skip(`ultimate-brain@${VERSION} can't be fetched (offline?) and no verified tarball is cached in ${CACHE}`);
    return undefined;
  }
  const root = await realpath(await mkdtemp(join(tmpdir(), "brain-upgrade-0-12-")));
  context.after(() => rm(root, REMOVE));
  const home = join(root, "home");
  await mkdir(home);
  await writeFile(join(home, ".gitconfig"), "");
  const env = sandboxEnv(home);
  const cli = join(pkg, "bin", "brain.js");
  const brain = join(root, "brain");
  const git = async (cwd: string, args: string[]): Promise<string> => (await exec("git", args, { cwd, env })).stdout;
  const old = async (args: readonly string[]): Promise<any> => {
    let stdout: string;
    try {
      ({ stdout } = await exec(process.execPath, [cli, ...args, "--brain", brain, "--now", NOW, "--json"], { cwd: root, env }));
    } catch (error) {
      throw new Error(`0.12.0 brain ${args.join(" ")} failed: ${(error as { stdout?: string }).stdout ?? String(error)}`);
    }
    const result = JSON.parse(stdout);
    assert.equal(result.ok, true, stdout);
    return result;
  };

  // The brain: `brain init` with Git, one area and one project, the index rebuilt, all committed.
  const init = JSON.parse((await exec(process.execPath, [cli, "init", brain, "--owner", "Fixture Owner", "--now", NOW, "--json"], { cwd: root, env })).stdout);
  assert.equal(init.ok, true);
  // The brain's own identity, so the CLI under test, which runs Git with the process's environment, can commit there on a runner that
  // has no global identity (CI).
  await git(brain, ["config", "user.name", "Fixture"]);
  await git(brain, ["config", "user.email", "fixture@example.invalid"]);
  await writeFile(join(brain, "areas", "sample-area.md"), note(AREA, "area", "Sample area", ""));
  await mkdir(join(brain, "projects", "sample-project"), { recursive: true });
  await writeFile(join(brain, "projects", "sample-project", "project.md"), note(PROJECT, "project", "Sample project", `area: ${AREA}\n`));
  await old(["index"]);
  await git(brain, ["add", "-A"]);
  await git(brain, ["commit", "-qm", "fixture: an area and a project"]);

  const projects = Object.fromEntries(PROJECTS.map((name) => [name, join(root, "projects", name)])) as Record<ProjectName, string>;
  for (const name of PROJECTS) {
    const path = projects[name];
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "README.md"), `# ${name}\n\nA synthetic project.\n`);
    if (name === "owned") {
      await writeFile(join(path, "AGENTS.md"), OWNED["AGENTS.md"].before);
      await writeFile(join(path, "CLAUDE.md"), OWNED["CLAUDE.md"].before);
    }
    if (name !== "unregistered") {
      await git(path, ["init", "-q"]);
      await git(path, ["add", "-A"]);
      await git(path, ["commit", "-qm", "init"]);
      await old(["repo", "add", name, "--path", path, "--area", AREA, "--pattern", "docs/**"]);
    }
    await old(["link", path, ...(name === "plain" || name === "owned" ? ["--project", PROJECT] : ["--area", AREA])]);
  }
  await git(brain, ["add", "-A"]);
  await git(brain, ["commit", "-qm", "fixture: linked repos"]);

  // What each project holds beyond a fresh link.
  for (const file of ["AGENTS.md", "CLAUDE.md"] as const) await appendFile(join(projects.owned, file), OWNED[file].after);
  const damaged = join(projects.damaged, "AGENTS.md");
  await writeFile(damaged, (await readFile(damaged, "utf8")).replace(`${END}\n`, ""));
  const stale = (await readFile(join(projects["conflicting-skill"], ".claude/skills/brain-query/SKILL.md"), "utf8")).replace(/\n---\n/, "\n---\n\nAn older brain-query, copied by hand.\n");
  await mkdir(join(projects["conflicting-skill"], ".claude/skills/brain-query-copy"), { recursive: true });
  await writeFile(join(projects["conflicting-skill"], ".claude/skills/brain-query-copy/SKILL.md"), stale);
  const twice = join(projects["conflicting-block"], "AGENTS.md");
  const linked = await readFile(twice, "utf8");
  await writeFile(twice, `${linked}\n${blockOf(linked)!.replace("Consult it before you:", "Consult it, edited by hand, before you:")}\n`);
  for (const name of PROJECTS) {
    if (name === "unregistered") continue;
    await git(projects[name], ["add", "-A"]);
    await git(projects[name], ["commit", "-qm", "linked to the brain by 0.12.0"]);
  }
  await rm(projects.unreachable, REMOVE);

  const bystander = join(root, "bystander");
  await mkdir(bystander);
  await writeFile(join(bystander, "AGENTS.md"), "# Not linked\n\nNo command is told about this folder.\n");
  return { root, home, brain, projects, bystander, package: { root: pkg, cli }, env, old };
}

function note(id: string, type: string, title: string, extra: string): string {
  return `---\nid: ${id}\ntype: ${type}\ntitle: ${title}\nsummary: A synthetic ${type} for the upgrade fixture.\nlifecycle: reviewed\n${extra}sources: []\ncreated: 2026-11-01\nupdated: 2026-11-01\n---\n\nA synthetic ${type}.\n`;
}

/** The managed block from its start marker through its end marker, when exactly one well-ordered pair exists. */
export function blockOf(text: string): string | undefined {
  const start = text.indexOf(`${START}\n`);
  const end = text.indexOf(`\n${END}`);
  if (start < 0 || end < start || text.indexOf(`${START}\n`, start + 1) >= 0 || text.indexOf(`\n${END}`, end + 1) >= 0) return undefined;
  return text.slice(start, end + 1 + END.length);
}

/** The text around the single managed block: what the project owns. */
export function aroundBlock(text: string): { before: string; after: string } | undefined {
  const block = blockOf(text);
  if (block === undefined) return undefined;
  const at = text.indexOf(block);
  return { before: text.slice(0, at), after: text.slice(at + block.length) };
}

/** Every entry under `root` (`.git` included), as path → sha256 of a file, the target of a link, or `dir`. */
export async function treeDigest(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!existsSync(root)) return out;
  async function visit(path: string): Promise<void> {
    const info = await lstat(path);
    const key = relative(root, path).split(sep).join("/");
    if (info.isSymbolicLink()) out.set(key, `link:${await readlink(path)}`);
    else if (info.isDirectory()) {
      if (key !== "") out.set(key, "dir");
      for (const entry of (await readdir(path)).sort()) await visit(join(path, entry));
    } else out.set(key, createHash("sha256").update(await readFile(path)).digest("hex"));
  }
  await visit(root);
  return out;
}

/** The paths whose entry differs between two digests. */
export function changedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((key) => before.get(key) !== after.get(key)).sort();
}
