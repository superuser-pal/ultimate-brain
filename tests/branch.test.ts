import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { disableGitAutoMaintenance } from "./git-env.ts";
import { brain } from "./helpers.ts";

// `brain status`'s `branch` block and the warning BRAIN_OFF_WORKING_BRANCH (spec/cli.md §5.2, 0086 §1, §2), on synthetic
// brains only. Every git here sees only the brain's own configuration, never the machine's.
const EMPTY_GLOBAL = join(await mkdtemp(join(tmpdir(), "branch-gitconfig-")), "gitconfig");
await writeFile(EMPTY_GLOBAL, "");
process.env.GIT_CONFIG_GLOBAL = EMPTY_GLOBAL;
process.env.GIT_CONFIG_NOSYSTEM = "1";
disableGitAutoMaintenance();

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const FIX = 'Say "fix my backup".';

async function git(cwd: string, args: string[]): Promise<string> {
  return (await exec("git", args, { cwd })).stdout.trim();
}

/** A brain made by `brain init` in a temp folder that is also the home directory; with `commit`, one commit on `main`. */
async function gitBrain(context: TestContext, commit = true): Promise<{ home: string; target: string }> {
  const home = await realpath(await mkdtemp(join(tmpdir(), "brain-branch-")));
  context.after(() => rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const target = join(home, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], home);
  assert.equal(init.code, 0, init.stderr);
  await git(target, ["init", "-q", "-b", "main"]);
  await git(target, ["config", "user.name", "Test Owner"]);
  await git(target, ["config", "user.email", "owner@example.test"]);
  if (commit) await commitFile(target, "work/first.md", "first\n");
  return { home, target };
}

async function commitFile(target: string, path: string, text: string): Promise<void> {
  await mkdir(join(target, "work"), { recursive: true });
  await writeFile(join(target, path), text);
  await git(target, ["add", "-A"]);
  await git(target, ["commit", "-q", "-m", `add ${path}`]);
}

async function status(target: string, home: string): Promise<{ branch: any; warnings: any[]; human: string; stderr: string }> {
  const json = await brain(["status", "--brain", target, "--json"], home);
  assert.equal(json.code, 0, json.stdout);
  const human = await brain(["status", "--brain", target], home);
  assert.equal(human.code, 0, human.stderr);
  return { branch: json.json.data.branch, warnings: json.json.warnings, human: human.stdout, stderr: human.stderr };
}

function offWarnings(warnings: any[]): any[] {
  return warnings.filter((warning) => warning.code === "BRAIN_OFF_WORKING_BRANCH");
}

test("a brain on its only branch gets no warning: working from the only branch, no remote needed (cli.md §5.2)", async (context) => {
  const { home, target } = await gitBrain(context);
  const result = await status(target, home);
  assert.deepEqual(result.branch, { working: "main", from: "only-branch", current: "main", on_working: true, unmerged: [] });
  assert.deepEqual(offWarnings(result.warnings), []);
  assert.doesNotMatch(result.human, /working branch/);
});

test("a brain with no commit yet is on its unborn branch, with no warning", async (context) => {
  const { home, target } = await gitBrain(context, false);
  const result = await status(target, home);
  assert.deepEqual(result.branch, { working: "main", from: "unborn", current: "main", on_working: true, unmerged: [] });
  assert.deepEqual(offWarnings(result.warnings), []);
});

test("a brain that is not itself a Git repository has a null branch and no warning", async (context) => {
  const home = await realpath(await mkdtemp(join(tmpdir(), "brain-branch-")));
  context.after(() => rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const target = join(home, "brain");
  assert.equal((await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], home)).code, 0);
  const result = await status(target, home);
  assert.equal(result.branch, null);
  assert.deepEqual(offWarnings(result.warnings), []);
});

test("a brain on another branch gets the warning, with the branch's commits in unmerged", async (context) => {
  const { home, target } = await gitBrain(context);
  await git(target, ["switch", "-q", "-c", "add-notes"]);
  await commitFile(target, "work/second.md", "second\n");
  await commitFile(target, "work/third.md", "third\n");
  const result = await status(target, home);
  assert.deepEqual(result.branch, { working: "main", from: "main", current: "add-notes", on_working: false, unmerged: [{ branch: "add-notes", commits: 2 }] });
  const message = `The brain is on branch add-notes, not its working branch main. ${FIX}`;
  assert.deepEqual(offWarnings(result.warnings), [{ code: "BRAIN_OFF_WORKING_BRANCH", message }]);
  // Human output: the message as one line, after the setup line, before the rest.
  const lines = result.human.split("\n");
  assert.match(lines[0], /^Setup: /);
  assert.equal(lines[1], message);
  assert.equal(lines[2], "Owner: Test Owner");
});

test("a detached HEAD is never on the working branch, even at its commit; its own commits come first in unmerged", async (context) => {
  const { home, target } = await gitBrain(context);
  await git(target, ["switch", "-q", "--detach", "main"]);
  let result = await status(target, home);
  const message = `The brain is on a detached HEAD, not its working branch main. ${FIX}`;
  assert.deepEqual(result.branch, { working: "main", from: "only-branch", current: null, on_working: false, unmerged: [] });
  assert.deepEqual(offWarnings(result.warnings), [{ code: "BRAIN_OFF_WORKING_BRANCH", message }]);

  await git(target, ["branch", "-q", "zeta"]);
  await commitFile(target, "work/detached.md", "detached\n");
  await git(target, ["switch", "-q", "zeta"]);
  await commitFile(target, "work/zeta.md", "zeta\n");
  await git(target, ["switch", "-q", "--detach", "HEAD~1"]);
  await commitFile(target, "work/again.md", "again\n");
  result = await status(target, home);
  assert.deepEqual(result.branch.unmerged, [{ branch: null, commits: 1 }, { branch: "zeta", commits: 1 }]);
  assert.equal(result.branch.from, "main");
  assert.deepEqual(offWarnings(result.warnings).map((warning) => warning.message), [message]);
});

test("on the working branch, a local branch with commits it lacks gets the warning; a merged branch doesn't", async (context) => {
  const { home, target } = await gitBrain(context);
  await git(target, ["branch", "-q", "merged"]);
  let result = await status(target, home);
  assert.deepEqual(result.branch, { working: "main", from: "main", current: "main", on_working: true, unmerged: [] });
  assert.deepEqual(offWarnings(result.warnings), []);

  for (const [name, count] of [["b-side", 2], ["a-side", 1]] as const) {
    await git(target, ["switch", "-q", "-c", name, "main"]);
    for (let n = 0; n < count; n += 1) await commitFile(target, `work/${name}-${n}.md`, `${name} ${n}\n`);
  }
  await git(target, ["switch", "-q", "main"]);
  result = await status(target, home);
  assert.deepEqual(result.branch.unmerged, [{ branch: "a-side", commits: 1 }, { branch: "b-side", commits: 2 }]);
  assert.deepEqual(offWarnings(result.warnings), [{ code: "BRAIN_OFF_WORKING_BRANCH", message: `Branch a-side has 1 commit(s) that main lacks (and 1 more branches). ${FIX}` }]);

  await git(target, ["branch", "-q", "-D", "a-side"]);
  result = await status(target, home);
  assert.deepEqual(offWarnings(result.warnings).map((warning) => warning.message), [`Branch b-side has 2 commit(s) that main lacks. ${FIX}`]);
});

test("origin/HEAD names the working branch when its local branch exists; else main, then master", async (context) => {
  const { home, target } = await gitBrain(context);
  const remote = join(home, "backup.git");
  await git(home, ["init", "-q", "--bare", remote]);
  await git(target, ["remote", "add", "origin", remote]);
  await git(target, ["branch", "-q", "trunk"]);
  await git(target, ["push", "-q", "origin", "main", "trunk"]);
  await git(target, ["remote", "set-head", "origin", "trunk"]);
  await git(target, ["switch", "-q", "trunk"]);
  let result = await status(target, home);
  assert.deepEqual(result.branch, { working: "trunk", from: "origin-head", current: "trunk", on_working: true, unmerged: [] });
  assert.deepEqual(offWarnings(result.warnings), []);

  // origin/HEAD naming a branch with no local copy falls through to main.
  await git(target, ["switch", "-q", "main"]);
  await git(target, ["branch", "-q", "-D", "trunk"]);
  await git(target, ["branch", "-q", "other"]);
  result = await status(target, home);
  assert.deepEqual([result.branch.working, result.branch.from], ["main", "main"]);

  // master when there is no main.
  await git(target, ["branch", "-q", "-m", "main", "master"]);
  result = await status(target, home);
  assert.deepEqual([result.branch.working, result.branch.from, result.branch.on_working], ["master", "master", true]);
});

test("several branches, none of them main or master and no origin/HEAD: working is null and the warning says so", async (context) => {
  const { home, target } = await gitBrain(context);
  await git(target, ["branch", "-q", "-m", "main", "notes"]);
  await git(target, ["branch", "-q", "drafts"]);
  const result = await status(target, home);
  assert.deepEqual(result.branch, { working: null, from: null, current: "notes", on_working: false, unmerged: [] });
  assert.deepEqual(offWarnings(result.warnings), [{ code: "BRAIN_OFF_WORKING_BRANCH", message: `Can't tell which branch is the brain's working branch: 2 branches, none of them main or master. ${FIX}` }]);
});

/** Every file under `.git`, with its content hash and modification time. */
async function gitTree(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await gitTree(path, `${prefix}${entry.name}/`));
    else out.push(`${prefix}${entry.name} ${createHash("sha256").update(await readFile(path)).digest("hex")} ${(await stat(path)).mtimeMs}`);
  }
  return out;
}

test("status writes nothing in Git: .git is unchanged after it reads every case", async (context) => {
  const { home, target } = await gitBrain(context);
  await git(target, ["switch", "-q", "-c", "side"]);
  await commitFile(target, "work/side.md", "side\n");
  await git(target, ["switch", "-q", "--detach", "main"]);
  const before = await gitTree(join(target, ".git"));
  const result = await status(target, home);
  assert.equal(result.branch.current, null);
  assert.deepEqual(await gitTree(join(target, ".git")), before);
  assert.equal(await git(target, ["status", "--porcelain"]), "");
});

test("the rules block's Write path has the working-branch rule, and brain upgrade brings it to a brain", async (context) => {
  const { home, target } = await gitBrain(context);
  const agents = join(target, "AGENTS.md");
  const shipped = await readFile(agents, "utf8");
  const rule = shipped.split("\n").find((line) => line.startsWith("- **One working branch, no pull requests.**"));
  assert.ok(rule, "the template's Write path names the working branch");
  assert.match(rule, /Never create a branch, a worktree, a pull request or a merge request in the brain/);
  assert.ok(shipped.indexOf(rule) > shipped.indexOf("## Write path") && shipped.indexOf(rule) < shipped.indexOf("## Product files and findings"));

  // An older brain: the rules block without the line.
  await writeFile(agents, shipped.replace(`${rule}\n`, ""));
  await git(target, ["commit", "-q", "-am", "an older rules block"]);
  const upgrade = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], home);
  assert.equal(upgrade.code, 0, upgrade.stdout);
  assert.ok((await readFile(agents, "utf8")).includes(rule));
});
