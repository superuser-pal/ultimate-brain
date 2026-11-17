// task.mjs: start, --from, --new, --resume, clean, check, set, and the pre-push hook's task-row check.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PRODUCT, sha, writePackage } from "./fixtures/github-mock.mjs";
import { test, source, temporaryRoot, offline, run, runAsync, integrationMock, command, fakeCommands, releaseDryRun, taskRepository } from "./scripts-helpers.mjs";

test("task start creates an isolated worktree and marks only its task in progress", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "ultimate-brain-task-"));
  const root = join(parent, "repo");
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.0.0"}\n');
  writeFileSync(join(root, "package-lock.json"), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · Example task · `todo`\n**Release:** 1.2.3\n");
  command(root, ["init", "-b", "main"]);
  command(root, ["config", "user.email", "tests@example.test"]);
  command(root, ["config", "user.name", "Tests"]);
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "fixture"]);
  const bare = join(parent, "origin.git");
  execFileSync("git", ["init", "--bare", bare]);
  command(root, ["remote", "add", "origin", bare]);
  command(root, ["push", "-u", "origin", "main"]);
  const path = fakeCommands(root, { npm: "exit 0" });
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const result = run("task.mjs", ["start", "CX-1"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const worktree = join(parent, "ub-CX-1");
  assert.match(readFileSync(join(worktree, "build/TASKS.md"), "utf8"), /CX-1 · Example task · `in progress`/);
  assert.equal(command(worktree, ["config", "--get", "core.hooksPath"]).trim(), ".githooks");
});

test("task start prints the skills-integration line and never blocks (CC-106)", async (t) => {
  for (const [online, line] of [[true, "skills integration: 1 open, 1 unclassified"], [false, "skills integration: status unknown (GitHub unreachable (ECONNREFUSED))"]]) {
    const parent = mkdtempSync(join(tmpdir(), "ultimate-brain-task-"));
    t.after(() => rmSync(parent, { recursive: true, force: true }));
    const root = join(parent, "repo");
    mkdirSync(join(root, "build"), { recursive: true });
    writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.0.0"}\n');
    writeFileSync(join(root, "package-lock.json"), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
    writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · Example task · `todo`\n**Release:** 1.2.3\n");
    writePackage(root);
    command(root, ["init", "-b", "main"]);
    command(root, ["config", "user.email", "tests@example.test"]);
    command(root, ["config", "user.name", "Tests"]);
    command(root, ["add", "."]);
    command(root, ["commit", "-m", "fixture"]);
    const bare = join(parent, "origin.git");
    execFileSync("git", ["init", "--bare", bare]);
    command(root, ["remote", "add", "origin", bare]);
    command(root, ["push", "-u", "origin", "main"]);
    const path = fakeCommands(root, { npm: "exit 0" });
    const { env, mock } = online ? await integrationMock(t, (state) => { state.issues = []; }) : { env: {}, mock: undefined };
    const result = await runAsync("task.mjs", ["start", "CX-1"], { root, env: { ...env, GITHUB_REPOSITORY: PRODUCT, PATH: path } });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stderr.split("\n").includes(line), result.stderr);
    assert.equal(result.stdout.trim(), join(parent, "ub-CX-1"));
    if (mock !== undefined) assert.equal(mock.requests.filter((request) => request.method !== "GET").length, 0, "task start writes no issue");
  }
});

test("task start --from stacks a task whose row exists only on that branch (decision 0046)", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "ultimate-brain-task-"));
  const root = join(parent, "repo");
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.0.0"}\n');
  writeFileSync(join(root, "package-lock.json"), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
  writeFileSync(join(root, "build/TASKS.md"), "### CC-1 · Below · `todo`\n**Release:** 1.2.3\n");
  command(root, ["init", "-b", "main"]);
  command(root, ["config", "user.email", "tests@example.test"]);
  command(root, ["config", "user.name", "Tests"]);
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "fixture"]);
  const bare = join(parent, "origin.git");
  execFileSync("git", ["init", "--bare", bare]);
  command(root, ["remote", "add", "origin", bare]);
  command(root, ["push", "-u", "origin", "main"]);
  command(root, ["checkout", "-b", "claude/CC-1-below"]);
  writeFileSync(join(root, "build/TASKS.md"), "### CC-1 · Below · `review`\n**Release:** 1.2.3\n\n### CC-2 · Above · `todo`\n**Release:** 1.2.3\n");
  writeFileSync(join(root, "below.txt"), "below\n");
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "CC-1: below"]);
  command(root, ["push", "origin", "claude/CC-1-below"]);
  command(root, ["checkout", "main"]);
  const path = fakeCommands(root, { npm: "exit 0" });
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const onMain = run("task.mjs", ["start", "CC-2"], { root, env: { PATH: path } });
  assert.match(onMain.stderr, /Unknown task CC-2/);
  const result = run("task.mjs", ["start", "CC-2", "--from", "claude/CC-1-below"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const worktree = join(parent, "ub-CC-2");
  assert.equal(command(worktree, ["branch", "--show-current"]).trim(), "claude/CC-2-above");
  assert.equal(readFileSync(join(worktree, "below.txt"), "utf8"), "below\n");
  assert.match(readFileSync(join(worktree, "build/TASKS.md"), "utf8"), /CC-2 · Above · `in progress`/);
  assert.match(readFileSync(join(worktree, "build/TASKS.md"), "utf8"), /CC-1 · Below · `review`/);
  const missing = run("task.mjs", ["start", "CC-3", "--from", "claude/CC-9-none"], { root, env: { PATH: path } });
  assert.match(missing.stderr, /Cannot read build\/TASKS.md on origin\/claude\/CC-9-none/);
  const usage = run("task.mjs", ["done", "CC-2", "--from", "claude/CC-1-below"], { root });
  assert.match(usage.stderr, /Usage/);
});

test("task start --new writes a new task's row at the end of its release section", (t) => {
  const { parent, root, path } = taskRepository("# Plan\n\n## 1.2.0 — Old\n\n### CC-1 · Old · `done` (#1)\n**Release:** 1.2.0\n**Changelog:** Old\n\n## 1.3.0 — Next\n\nIntro.\n\n## Your tasks\n");
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const result = run("task.mjs", ["start", "CC-2", "--new", "Add a thing", "--release", "1.3.0"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const worktree = join(parent, "ub-CC-2");
  assert.equal(command(worktree, ["branch", "--show-current"]).trim(), "claude/CC-2-add-a-thing");
  assert.equal(readFileSync(join(worktree, "build/TASKS.md"), "utf8"),
    "# Plan\n\n## 1.2.0 — Old\n\n### CC-1 · Old · `done` (#1)\n**Release:** 1.2.0\n**Changelog:** Old\n\n## 1.3.0 — Next\n\nIntro.\n\n### CC-2 · Add a thing · `in progress`\n**Release:** 1.3.0\n**Changelog:**\n**Output:**\n**Acceptance:**\n\n## Your tasks\n");
  assert.match(result.stderr, /Fill in the \*\*Changelog:\*\*/);
  assert.equal(command(worktree, ["config", "--get", "core.hooksPath"]).trim(), ".githooks");
});

test("task start --new creates a missing release section in version order", (t) => {
  for (const [release, expected] of [
    ["1.2.1", "## 1.2.0\n\n### CC-1 · Old · `done` (#1)\n**Release:** 1.2.0\n\n## 1.2.1\n\n### CC-2 · New · `in progress`\n**Release:** 1.2.1\n**Changelog:**\n**Output:**\n**Acceptance:**\n\n## 1.3.0\n\n## Your tasks\n"],
    ["1.3.0-rc.1", "## 1.2.0\n\n### CC-1 · Old · `done` (#1)\n**Release:** 1.2.0\n\n## 1.3.0-rc.1\n\n### CC-2 · New · `in progress`\n**Release:** 1.3.0-rc.1\n**Changelog:**\n**Output:**\n**Acceptance:**\n\n## 1.3.0\n\n## Your tasks\n"],
    ["1.4.0", "## 1.2.0\n\n### CC-1 · Old · `done` (#1)\n**Release:** 1.2.0\n\n## 1.3.0\n\n## 1.4.0\n\n### CC-2 · New · `in progress`\n**Release:** 1.4.0\n**Changelog:**\n**Output:**\n**Acceptance:**\n\n## Your tasks\n"],
  ]) {
    const { parent, root, path } = taskRepository("## 1.2.0\n\n### CC-1 · Old · `done` (#1)\n**Release:** 1.2.0\n\n## 1.3.0\n\n## Your tasks\n");
    t.after(() => rmSync(parent, { recursive: true, force: true }));
    const result = run("task.mjs", ["start", "CC-2", "--new", "New", "--release", release], { root, env: { PATH: path } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(parent, "ub-CC-2", "build/TASKS.md"), "utf8"), expected);
  }
});

test("task start --new refuses an existing id and incomplete flags", (t) => {
  const { parent, root, path } = taskRepository("### CC-1 · Old · `todo`\n**Release:** 1.2.0\n");
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const existing = run("task.mjs", ["start", "CC-1", "--new", "Again", "--release", "1.2.0"], { root, env: { PATH: path } });
  assert.match(existing.stderr, /CC-1 already exists on origin\/main/);
  command(root, ["push", "-q", "origin", "main:refs/heads/claude/CC-5-open-elsewhere"]);
  const open = run("task.mjs", ["start", "CC-5", "--new", "Clash", "--release", "1.2.0"], { root, env: { PATH: path } });
  assert.match(open.stderr, /CC-5 is already used by origin\/claude\/CC-5-open-elsewhere/);
  for (const args of [["--new", "No release"], ["--release", "1.2.0"], ["--new", "Bad", "--release", "next"], ["--new", "A · B", "--release", "1.2.0"], ["--new", "Two\nlines", "--release", "1.2.0"], ["--new", "A `tick`", "--release", "1.2.0"], ["--new", "x", "--new", "y"]]) {
    assert.match(run("task.mjs", ["start", "CC-2", ...args], { root, env: { PATH: path } }).stderr, /Usage/);
  }
  assert.match(run("task.mjs", ["done", "CC-1", "--release", "1.2.0"], { root }).stderr, /Usage/);
  assert.equal(existsSync(join(parent, "ub-CC-2")), false);
});

test("task start --new refuses an id an open branch plans, and next-id counts open branches (CC-300)", (t) => {
  const { parent, root, path } = taskRepository("## 1.2.0\n\n### CC-1 · Old · `todo`\n**Release:** 1.2.0\n\n## Your tasks\n\n| U-3 | Check | `todo` |\n");
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  mkdirSync(join(root, "decisions"));
  writeFileSync(join(root, "decisions/0007-first.md"), "# 0007\n");
  command(root, ["add", "."]);
  command(root, ["commit", "-q", "-m", "a decision"]);
  command(root, ["push", "-q", "origin", "main"]);
  assert.equal(run("task.mjs", ["next-id"], { root, env: { PATH: path } }).stdout, "CC-2\nU-4\ndecision 0008\n");
  // A planning branch, CC-2, adds the rows of CC-3 and CC-4, a user task and a decision.
  command(root, ["checkout", "-q", "-b", "claude/CC-2-plan"]);
  writeFileSync(join(root, "build/TASKS.md"), "## 1.2.0\n\n### CC-1 · Old · `todo`\n**Release:** 1.2.0\n\n### CC-2 · Plan · `review`\n**Release:** 1.2.0\n\n### CC-3 · Planned · `todo`\n**Release:** 1.2.0\n\n### CC-4 · Also planned · `todo`\n**Release:** 1.2.0\n\n## Your tasks\n\n| U-3 | Check | `todo` |\n| U-4 | Publish | `todo` |\n");
  writeFileSync(join(root, "decisions/0008-second.md"), "# 0008\n");
  command(root, ["add", "."]);
  command(root, ["commit", "-q", "-m", "plan"]);
  command(root, ["push", "-q", "origin", "claude/CC-2-plan"]);
  command(root, ["checkout", "-q", "main"]);
  const planned = run("task.mjs", ["start", "CC-3", "--new", "Something else", "--release", "1.2.0"], { root, env: { PATH: path } });
  assert.equal(planned.status, 1);
  assert.match(planned.stderr, /CC-3 is already planned on origin\/claude\/CC-2-plan: take a free id/);
  assert.equal(existsSync(join(parent, "ub-CC-3")), false);
  assert.equal(run("task.mjs", ["next-id"], { root, env: { PATH: path } }).stdout, "CC-5\nU-5\ndecision 0009\n");
  assert.equal(run("task.mjs", ["start", "CC-5", "--new", "Free", "--release", "1.2.0"], { root, env: { PATH: path } }).status, 0);
  assert.match(run("task.mjs", ["next-id", "CC-1"], { root, env: { PATH: path } }).stderr, /Usage/);
});

test("task clean removes merged task worktrees and keeps open, fresh and dirty ones", (t) => {
  const { parent, root, path } = taskRepository("### CC-1 · Merged · `todo`\n**Release:** 1.2.0\n\n### CC-2 · Open · `todo`\n**Release:** 1.2.0\n\n### CC-3 · Fresh · `todo`\n**Release:** 1.2.0\n\n### CC-4 · Dirty · `todo`\n**Release:** 1.2.0\n");
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  for (const id of ["CC-1", "CC-2", "CC-3", "CC-4"]) assert.equal(run("task.mjs", ["start", id], { root, env: { PATH: path } }).status, 0);
  for (const id of ["CC-1", "CC-2", "CC-4"]) {
    const worktree = join(parent, `ub-${id}`);
    writeFileSync(join(worktree, `${id}.txt`), `${id}\n`);
    command(worktree, ["add", "."]);
    command(worktree, ["commit", "-m", `${id}: work`]);
  }
  command(join(parent, "ub-CC-3"), ["checkout", "--", "build/TASKS.md"]);
  writeFileSync(join(parent, "ub-CC-4", "CC-4.txt"), "changed\n");
  command(root, ["merge", "--no-ff", "-m", "Merge CC-1", "claude/CC-1-merged"]);
  command(root, ["merge", "--no-ff", "-m", "Merge CC-4", "claude/CC-4-dirty"]);
  command(root, ["push", "origin", "main"]);
  // The user has not pulled: local main lags origin/main, so `git branch -d` would refuse.
  command(root, ["reset", "-q", "--hard", "HEAD~2"]);
  const result = run("task.mjs", ["clean"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Removed claude\/CC-1-merged$/m);
  assert.match(result.stderr, /Kept claude\/CC-4-dirty: uncommitted changes/);
  assert.equal(existsSync(join(parent, "ub-CC-1")), false);
  for (const id of ["CC-2", "CC-3", "CC-4"]) assert.equal(existsSync(join(parent, `ub-${id}`)), true, id);
  assert.doesNotMatch(command(root, ["branch", "--list"]), /CC-1-merged/);
  assert.match(run("task.mjs", ["clean", "CC-1"], { root }).stderr, /Usage/);
});

test("task start --resume continues an in-progress task whose branch merged, and only that (CC-199)", (t) => {
  const { parent, root, path } = taskRepository("### CC-1 · Half built · `in progress`\n**Release:** 1.2.0\n\n### CC-2 · Fresh · `todo`\n**Release:** 1.2.0\n\n### CC-3 · Waiting · `review`\n**Release:** 1.2.0\n\n### CC-4 · Open · `in progress`\n**Release:** 1.2.0\n");
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  // CC-1's first branch merged and is still on the remote; CC-4's branch has unmerged work.
  command(root, ["push", "-q", "origin", "main:refs/heads/claude/CC-1-half-built"]);
  command(root, ["checkout", "-q", "-b", "claude/CC-4-open"]);
  writeFileSync(join(root, "open.txt"), "open\n");
  command(root, ["add", "."]);
  command(root, ["commit", "-q", "-m", "CC-4: open"]);
  command(root, ["push", "-q", "origin", "claude/CC-4-open"]);
  command(root, ["checkout", "-q", "main"]);
  const plain = run("task.mjs", ["start", "CC-1"], { root, env: { PATH: path } });
  assert.match(plain.stderr, /CC-1 is in progress, not todo \(if its branch merged and its row carries the rest, use --resume\)/);
  const result = run("task.mjs", ["start", "CC-1", "--resume"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const worktree = join(parent, "ub-CC-1");
  assert.equal(command(worktree, ["branch", "--show-current"]).trim(), "claude/CC-1-half-built");
  assert.equal(command(worktree, ["config", "--get", "core.hooksPath"]).trim(), ".githooks");
  assert.equal(command(worktree, ["status", "--porcelain"]), "", "the row is left as it is");
  assert.match(readFileSync(join(worktree, "build/TASKS.md"), "utf8"), /CC-1 · Half built · `in progress`/);
  const again = run("task.mjs", ["start", "CC-1", "--resume"], { root, env: { PATH: path } });
  assert.match(again.stderr, /already exists/);
  assert.match(run("task.mjs", ["start", "CC-2", "--resume"], { root, env: { PATH: path } }).stderr, /CC-2 is todo, not in progress/);
  assert.match(run("task.mjs", ["start", "CC-3", "--resume"], { root, env: { PATH: path } }).stderr, /CC-3 is review, not in progress/);
  assert.match(run("task.mjs", ["start", "CC-4", "--resume"], { root, env: { PATH: path } }).stderr, /CC-4 is still open on origin\/claude\/CC-4-open/);
  for (const args of [["--resume", "--resume"], ["--resume", "--new", "X", "--release", "1.2.0"]]) {
    assert.match(run("task.mjs", ["start", "CC-1", ...args], { root, env: { PATH: path } }).stderr, /Usage/);
  }
  assert.match(run("task.mjs", ["done", "CC-1", "--resume"], { root }).stderr, /Usage/);
  for (const id of ["CC-2", "CC-3", "CC-4"]) assert.equal(existsSync(join(parent, `ub-${id}`)), false, id);
});

test("the pre-push hook rejects main and permits a tag", () => {
  const hook = join(source, ".githooks/pre-push");
  const main = spawnSync("sh", [hook], { input: "a b refs/heads/main c\n", encoding: "utf8" });
  const tag = spawnSync("sh", [hook], { input: "a b refs/tags/v1.2.0 c\n", encoding: "utf8" });
  assert.equal(main.status, 1);
  assert.equal(tag.status, 0);
});

test("task check and the pre-push hook stop a task branch whose rows are wrong (CC-301)", (t) => {
  const row = (id, more = "**Changelog:** Text\n") => `### ${id} · Task ${id} · \`todo\`\n**Release:** 1.2.0\n${more}\n`;
  const { parent, root, path } = taskRepository(`## 1.2.0\n\n${row("CC-1")}${row("CC-2")}`);
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const env = { PATH: path };
  const commit = (tasks) => {
    writeFileSync(join(root, "build/TASKS.md"), tasks);
    command(root, ["commit", "-q", "-am", "rows"]);
    return command(root, ["rev-parse", "HEAD"]).trim();
  };
  const hook = (sha, ref = "refs/heads/claude/CC-2-two") => spawnSync("sh", [join(source, ".githooks/pre-push")], { input: `refs/heads/x ${sha} ${ref} 0\n`, encoding: "utf8", cwd: root, env: { ...process.env, ...offline, UB_ROOT: root, ...env } });
  command(root, ["checkout", "-q", "-b", "claude/CC-2-two"]);
  const good = commit(`## 1.2.0\n\n${row("CC-1")}${row("CC-2")}${row("CC-3")}`);
  assert.equal(run("task.mjs", ["check"], { root, env }).stdout, "CC-2: task rows are valid\n");
  assert.equal(hook(good).status, 0);
  // A line between Release and Changelog hides the Changelog line, as on PR #397.
  const moved = commit(`## 1.2.0\n\n${row("CC-1", "**Dropped by 0001.**\n**Changelog:** Text\n")}${row("CC-2")}`);
  const lost = run("task.mjs", ["check"], { root, env });
  assert.equal(lost.status, 1);
  assert.match(lost.stderr, /PR loses \*\*Changelog:\*\* line\(s\): CC-1: the line sits directly below \*\*Release:\*\*/);
  const refused = hook(moved);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /PR loses \*\*Changelog/);
  assert.match(run("task.mjs", ["check", commit(`## 1.2.0\n\n${row("CC-2")}`), "claude/CC-2-two"], { root, env }).stderr, /PR loses task heading\(s\): CC-1/);
  assert.match(run("task.mjs", ["check", commit(`## 1.2.0\n\n${row("CC-1")}`), "claude/CC-2-two"], { root, env }).stderr, /PR has no row for its task CC-2/);
  assert.match(run("task.mjs", ["check", commit(`## 1.2.0\n\n${row("CC-1")}${row("CC-2", "**Changelog:**\n")}`), "claude/CC-2-two"], { root, env }).stderr, /CC-2 has an empty \*\*Changelog/);
  assert.match(run("task.mjs", ["check", good, "feature/no-id"], { root, env }).stderr, /Branch must match/);
  assert.match(run("task.mjs", ["check", good], { root, env }).stderr, /Usage/);
  // A row main gained after the branch left it is not lost: the comparison is with the commit the branch left main at.
  command(root, ["checkout", "-q", "main"]);
  commit(`## 1.2.0\n\n${row("CC-1")}${row("CC-2")}${row("CC-9")}`);
  command(root, ["push", "-q", "origin", "main"]);
  assert.equal(run("task.mjs", ["check", good, "claude/CC-2-two"], { root, env }).status, 0);
  // A deleted branch has no commit to check.
  assert.equal(hook("0000000000000000000000000000000000000000").status, 0);
});

test("task set moves a row to review, then to done with its PR, in the heading and the plan table (CC-301)", (t) => {
  const tasks = (heading, cell) => `## 1.2.0\n\n| Task | What | Status |\n|---|---|---|\n| CC-1 | One | ${cell} |\n| CC-2 | Two | \`in progress\` |\n\n### CC-1 · Run \`brain init\` · ${heading}\n**Release:** 1.2.0\n**Changelog:** One\n\n### CC-2 · Two · \`in progress\`\n**Release:** 1.2.0\n`;
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "build/TASKS.md");
  writeFileSync(file, tasks("`in progress`", "`in progress`"));
  assert.match(run("task.mjs", ["set", "CC-1", "done", "--pr", "7"], { root }).stderr, /CC-1 is in progress, not review/);
  assert.equal(run("task.mjs", ["set", "CC-1", "review"], { root }).stdout, "CC-1 is `review`\n");
  assert.equal(readFileSync(file, "utf8"), tasks("`review`", "`review`"));
  assert.match(run("task.mjs", ["set", "CC-1", "review"], { root }).stderr, /CC-1 is review, not in progress/);
  assert.equal(run("task.mjs", ["set", "CC-1", "done", "--pr", "7"], { root }).stdout, "CC-1 is `done` (#7)\n");
  assert.equal(readFileSync(file, "utf8"), tasks("`done` (#7)", "`done` (#7)"));
  assert.match(run("task.mjs", ["set", "CC-9", "review"], { root }).stderr, /Unknown task CC-9/);
  for (const args of [["CC-1", "done"], ["CC-1", "done", "--pr", "x"], ["CC-1", "review", "--pr", "7"], ["CC-1", "todo"], ["CC-1"], ["CC-1", "review", "--new", "x", "--release", "1.2.0"]]) {
    assert.match(run("task.mjs", ["set", ...args], { root }).stderr, /Usage/);
  }
  assert.equal(readFileSync(file, "utf8"), tasks("`done` (#7)", "`done` (#7)"));
});

test("release and task.mjs read the rows in build/HISTORY.md (CC-94)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = releaseDryRun(root);
  writeFileSync(join(root, "build/HISTORY.md"), "# Build history\n\n### CX-9 · Moved · `review`\n**Release:** 0.4.0\n**Changelog:** Moved\n");
  const refused = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: path } });
  assert.match(refused.stderr, /CX-9 is review, not done/);
  const { parent, root: repo, path: taskPath } = taskRepository("### CC-1 · Open · `todo`\n**Release:** 1.2.0\n");
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  writeFileSync(join(repo, "build/HISTORY.md"), "### CC-7 · Old · `done` (#7)\n**Release:** 1.0.0\n");
  command(repo, ["add", "."]);
  command(repo, ["commit", "-m", "history"]);
  command(repo, ["push", "origin", "main"]);
  const taken = run("task.mjs", ["start", "CC-7", "--new", "Again", "--release", "1.2.0"], { root: repo, env: { PATH: taskPath } });
  assert.match(taken.stderr, /CC-7 already exists on origin\/main/);
  writeFileSync(join(repo, "build/HISTORY.md"), "## 1.0.0 — Done\n\n### CC-7 · Old · `done` (#7)\n**Release:** 1.0.0\n");
  command(repo, ["commit", "-qam", "history section"]);
  command(repo, ["push", "-q", "origin", "main"]);
  const done = run("task.mjs", ["start", "CC-8", "--new", "Late", "--release", "1.0.0"], { root: repo, env: { PATH: taskPath } });
  assert.match(done.stderr, /1\.0\.0 is a done release in build\/HISTORY\.md/);
});
