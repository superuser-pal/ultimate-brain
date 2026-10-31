import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const source = resolve(import.meta.dirname, "..");

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-scripts-"));
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.0.0"}\n');
  writeFileSync(join(root, "package-lock.json"), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
  return root;
}

function run(script, args, { root, env = {}, input } = {}) {
  return spawnSync(process.execPath, [join(source, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    env: { ...process.env, UB_ROOT: root, ...env },
  });
}

function command(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function fakeCommands(root, scripts) {
  const bin = mkdtempSync(join(root, "bin-"));
  for (const [name, body] of Object.entries(scripts)) {
    const path = join(bin, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
  }
  return `${bin}:${process.env.PATH}`;
}

function taskRows(rows) {
  return Buffer.from(rows).toString("base64");
}

test("release 0.3.x retains its hand-written changelog gate", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "## 0.3.1 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done`\n**Release:** 0.3.1\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef/check-runs") printf 'completed\\tsuccess\\n' ;;
    esac`,
    npm: "exit 0",
  });
  const result = run("release.mjs", ["0.3.1", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Would release 0\.3\.1/);
});

test("release 0.4.0 generates task-row changelog entries and skips dropped tasks", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## 0.4.0 — unreleased\n\n- hand-written\n\n## 0.3.1 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), [
    "### CX-1 · First · `done` (#60, #64)\n**Release:** 0.4.0\n**Changelog:** first change",
    "### CX-2 · Second · `done` (#58; note)\n**Release:** 0.4.0\n**Changelog:** second change",
    "### CX-3 · Dropped · `dropped`\n**Release:** 0.4.0",
  ].join("\n\n") + "\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef/check-runs") printf 'completed\\tsuccess\\n' ;;
    esac`,
    npm: "exit 0",
  });
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## 0\.4\.0 — YYYY-MM-DD\n\n- CX-1 \(#60, #64\): first change\n- CX-2 \(#58\): second change/);
  assert.doesNotMatch(result.stdout, /CX-3/);
});

test("release 0.4.0 replaces a hand-written unreleased section", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## 0.4.0 — unreleased\n\n- hand-written\n\n## 0.3.1 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** generated\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef/check-runs") printf 'completed\\tsuccess\\n' ;;
    esac`,
    npm: "exit 0",
  });
  const result = run("release.mjs", ["0.4.0"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /## 0\.4\.0 — \d{4}-\d{2}-\d{2}\n\n- CX-1 \(#12\): generated/);
  assert.doesNotMatch(changelog, /hand-written/);
  assert.match(changelog, /- CX-1 \(#12\): generated\n\n## 0\.3\.1 — unreleased/);
});

test("release 0.4.0 inserts a generated section below the changelog intro", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\nIntro.\n\n## 0.3.1 — 2026-10-20\n\n- previous\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** generated\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef/check-runs") printf 'completed\\tsuccess\\n' ;;
    esac`,
    npm: "exit 0",
  });
  const result = run("release.mjs", ["0.4.0"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /^# Changelog\n\nIntro\.\n\n## 0\.4\.0 — \d{4}-\d{2}-\d{2}/);
  assert.match(changelog, /- CX-1 \(#12\): generated\n\n## 0\.3\.1 — 2026-10-20/);
});

test("release 0.4.0 refuses missing task-row changelog data and invalid done suffixes", (t) => {
  const cases = [
    ["no **Changelog:** line", "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n"],
    ["empty **Changelog:** line", "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:**   \n"],
    ["invalid done suffix", "### CX-1 · One · `done`\n**Release:** 0.4.0\n**Changelog:** One\n"],
    ["invalid done suffix", "### CX-1 · One · `done` (PR #12)\n**Release:** 0.4.0\n**Changelog:** One\n"],
  ];
  for (const [message, tasks] of cases) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n");
    writeFileSync(join(root, "build/TASKS.md"), tasks);
    const path = fakeCommands(root, {
      git: `case "$1 $2" in
        "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
        "branch --show-current") printf main ;;
        "status --porcelain") ;;
        "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
      esac`,
      gh: `case "$1 $2" in
        "repo view") printf owner/repo ;;
        "api repos/owner/repo/commits/abcdef/check-runs") printf 'completed\\tsuccess\\n' ;;
      esac`,
      npm: "exit 0",
    });
    const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: path } });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(message), result.stderr);
  }
});

test("release refuses an invalid version before mutating files", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = run("release.mjs", ["not-a-version"], { root });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage/);
});

test("release pushes its annotated tag through --follow-tags", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "## 1.2.3 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#1)\n**Release:** 1.2.3\n**Changelog:** One\n");
  const path = fakeCommands(root, {
    gh: `case "$1" in
      "repo view") printf owner/repo ;;
      api) printf 'completed\\tsuccess\\n' ;;
    esac`,
    npm: "exit 0",
  });
  command(root, ["init", "-b", "main"]);
  command(root, ["config", "user.email", "tests@example.test"]);
  command(root, ["config", "user.name", "Tests"]);
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "fixture"]);
  const origin = `${root}-origin.git`;
  t.after(() => rmSync(origin, { recursive: true, force: true }));
  execFileSync("git", ["init", "--bare", origin]);
  command(root, ["remote", "add", "origin", origin]);
  command(root, ["push", "-u", "origin", "main"]);
  const result = run("release.mjs", ["1.2.3"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(command(root, ["ls-remote", "--tags", "origin"]), /refs\/tags\/v1\.2\.3$/m);
  assert.equal(command(root, ["cat-file", "-t", "v1.2.3"]).trim(), "tag");
});

test("merge dry-run requires a green, mergeable PR and does not merge it", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"- [x] checked","mergeable":"MERGEABLE","state":"OPEN"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\n' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows("### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n")}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]' ;;
      "pr merge") exit 99 ;;
    esac`,
  });
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Would merge #12/);
});

test("merge refuses an unchecked PR checklist", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"- [ ] review","mergeable":"MERGEABLE","state":"OPEN"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\n' ;;
    esac`,
  });
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /checklist/);
});

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

test("task start refuses unknown and non-todo tasks", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · Existing · `review`\n**Release:** 1.2.3\n");
  const unknown = run("task.mjs", ["start", "CX-2"], { root });
  const nonTodo = run("task.mjs", ["start", "CX-1"], { root });
  assert.match(unknown.stderr, /Unknown task/);
  assert.match(nonTodo.stderr, /not todo/);
});

test("the pre-push hook rejects main and permits a task branch", () => {
  const hook = join(source, ".githooks/pre-push");
  const main = spawnSync("sh", [hook], { input: "a b refs/heads/main c\n", encoding: "utf8" });
  const branch = spawnSync("sh", [hook], { input: "a b refs/heads/codex/CX-1-one c\n", encoding: "utf8" });
  assert.equal(main.status, 1);
  assert.equal(branch.status, 0);
});

test("PR format accepts its task id and rejects an unscoped branch", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base"|"api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${taskRows("### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n")}' ;;
    esac`,
  });
  assert.equal(run("pr-format.mjs", ["1"], { root, env: { PATH: path } }).status, 0);
  const invalidPath = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"feature/no-id","title":"CX-1: One"}' ;;
    esac`,
  });
  const invalid = run("pr-format.mjs", ["1"], { root, env: { PATH: invalidPath } });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /branch/);
});

test("PR format rejects an empty changelog field", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base") printf '%s' '${taskRows("### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n")}' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${taskRows("### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:**   \n")}' ;;
    esac`,
  });
  const result = run("pr-format.mjs", ["1"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /empty/);
});

test("PR format rejects a changelog field lost from another task", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base") printf '%s' '${taskRows("### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n\n### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n**Changelog:** Two\n")}' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${taskRows("### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n\n### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n")}' ;;
    esac`,
  });
  const result = run("pr-format.mjs", ["1"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /loses \*\*Changelog/);
});

test("CI passes with skipped jobs, but not with a failure, a running job or nothing that succeeded", async () => {
  const { checksPassed } = await import("../scripts/common.mjs");
  assert.equal(checksPassed("completed\tsuccess\ncompleted\tskipped\ncompleted\tsuccess\n"), true);
  assert.equal(checksPassed("completed\tsuccess\ncompleted\tneutral\n"), true);
  assert.equal(checksPassed("completed\tsuccess\ncompleted\tfailure\n"), false);
  assert.equal(checksPassed("completed\tsuccess\nin_progress\t\n"), false);
  assert.equal(checksPassed("completed\tskipped\n"), false);
  assert.equal(checksPassed(""), false);
});

test("merge dry-run accepts a PR whose push-only job was skipped", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"- [x] checked","mergeable":"MERGEABLE","state":"OPEN"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\ncompleted\\tskipped\\n' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows("### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n")}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]' ;;
      "pr merge") exit 99 ;;
    esac`,
  });
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Would merge #12/);
});

function mergeReviewPath(root, review, task = "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n") {
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"- [x] checked","mergeable":"MERGEABLE","state":"OPEN"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\n' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows(task)}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '${review}' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
    esac`,
  });
}

test("merge dry-run accepts a fresh pass from the other agent", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
});

test("merge dry-run accepts every valid done-suffix form that names its PR", (t) => {
  for (const suffix of ["(#12)", "(#9, #12)", "(#12; note)"]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const task = `### CX-1 · One · \`done\` ${suffix}\n**Release:** 0.4.0\n**Changelog:** One\n`;
    const path = mergeReviewPath(root, '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]', task);
    const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("merge dry-run refuses a task in review or a suffix for another PR", (t) => {
  for (const task of [
    "### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n",
    "### CX-1 · One · `done` (#13)\n**Release:** 0.4.0\n**Changelog:** One\n",
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = mergeReviewPath(root, '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]', task);
    const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not `done` \(#12\)/);
  }
});

test("merge dry-run refuses a pass from the same agent", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"user":{"login":"owner"},"body":"Review (Codex): pass at abcdef0"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /other agent/);
});

test("merge dry-run refuses a pass naming another commit", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at deadbee"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /other agent/);
});

test("merge dry-run refuses a pass posted by another account", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"user":{"login":"someone-else"},"body":"Review (Claude Code): pass at abcdef0"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });

test("merge dry-run refuses a pass posted by a comment with no recorded user", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"body":"Review (Claude Code): pass at abcdef0"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /other agent/);
});

test("merge dry-run refuses without an other-agent pass", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, "[]");
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /other agent/);
});

test("merge dry-run accepts a user review override with a warning", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, "[]");
  const result = run("merge.mjs", ["12", "--dry-run", "--reviewed-by-user"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WARNING: user override/);
});

function prFormatPath(root, baseLog, headLog) {
  const rows = taskRows("### CX-1 · One · `review`\n**Release:** 0.3.1\n\n### CC-2 · Two · `done` (#2)\n**Release:** 0.3.1\n");
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One","files":[{"path":"CHANGELOG.md"}]}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base"|"api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${rows}' ;;
      "api repos/owner/repo/contents/CHANGELOG.md?ref=base") printf '%s' '${taskRows(baseLog)}' ;;
      "api repos/owner/repo/contents/CHANGELOG.md?ref=head") printf '%s' '${taskRows(headLog)}' ;;
    esac`,
  });
}

test("PR format rejects a CHANGELOG.md line lost from another task", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = prFormatPath(root, "## 0.3.1 — unreleased\n\n- CC-2: two\n", "## 0.3.1 — unreleased\n\n- CX-1: one\n");
  const result = run("pr-format.mjs", ["1"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /loses CHANGELOG\.md line\(s\): CC-2/);
});

test("PR format accepts a CHANGELOG.md line that only gains its PR number", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = prFormatPath(root, "## 0.3.1 — unreleased\n\n- CC-2: two\n", "## 0.3.1 — unreleased\n\n- CX-1: one\n- CC-2 (#2): two, reworded\n");
  const result = run("pr-format.mjs", ["1"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
});

function mergeabilityPath(root, states) {
  const count = join(root, "views");
  const json = (state) => `{"headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"- [x] checked","mergeable":"${state}","state":"OPEN"}`;
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") n=$(cat '${count}' 2>/dev/null || echo 0); n=$((n+1)); echo $n > '${count}'
        if [ $n -le ${states.length - 1} ]; then printf '%s' '${json(states[0])}'; else printf '%s' '${json(states.at(-1))}'; fi ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\n' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows("### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n")}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
    esac`,
  });
}

test("merge dry-run waits while GitHub reports UNKNOWN mergeability", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeabilityPath(root, ["UNKNOWN", "UNKNOWN", "MERGEABLE"]);
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path, UB_MERGEABLE_POLL_MS: "1" } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(root, "views"), "utf8").trim(), "3");
});

test("merge dry-run refuses UNKNOWN mergeability after the wait, and CONFLICTING at once", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const unknown = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: mergeabilityPath(root, ["UNKNOWN"]), UB_MERGEABLE_POLL_MS: "1" } });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /GitHub has not computed mergeability; retry/);
  assert.equal(readFileSync(join(root, "views"), "utf8").trim(), "11");
  rmSync(join(root, "views"));
  const conflicting = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: mergeabilityPath(root, ["CONFLICTING"]), UB_MERGEABLE_POLL_MS: "1" } });
  assert.equal(conflicting.status, 1);
  assert.match(conflicting.stderr, /not mergeable \(CONFLICTING\)/);
  assert.equal(readFileSync(join(root, "views"), "utf8").trim(), "1");
});

function guardRepo(root, mergeBody) {
  command(root, ["init", "-q", "-b", "main"]);
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "base"]);
  const before = command(root, ["rev-parse", "HEAD"]).trim();
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "Merge pull request #12", "-m", mergeBody]);
  return { before, after: command(root, ["rev-parse", "HEAD"]).trim() };
}

function guardPath(root, after, review) {
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/${after}/pulls") printf '12' ;;
      "api repos/owner/repo/pulls/12") printf 'abcdef0123\\tcodex/CX-1-one\\t${after}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '${review}' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
      "issue create") exit 0 ;;
    esac`,
  });
}

test("main-guard passes a merged PR with no review, as merged on the web page (decision 0040)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { before, after } = guardRepo(root, "CX-1: One");
  const result = run("main-guard.mjs", [before, after], { root, env: { PATH: guardPath(root, after, "[]") } });
  assert.equal(result.status, 0, result.stderr);
});

test("main-guard fails a commit that came from no PR", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { before, after } = guardRepo(root, "Pushed directly.");
  const path = fakeCommands(root, { gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "issue create") exit 0 ;;
    esac` });
  const result = run("main-guard.mjs", [before, after], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, new RegExp(`main-guard rejected: ${after}`));
});

function mergeReadyPath(root, { task = "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n", body = "- [x] checked", review = '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]', base = "main" } = {}) {
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"baseRefName":"${base}","headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"${body}"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows(task)}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '${review}' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
      "api repos/owner/repo/statuses/abcdef0") printf '%s\n' "$@" > '${join(root, "status")}' ;;
    esac`,
  });
}

test("merge-ready sets success on a done PR with ticked boxes and a fresh pass", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = run("merge-ready.mjs", ["12"], { root, env: { PATH: mergeReadyPath(root) } });
  assert.equal(result.status, 0, result.stderr);
  const status = readFileSync(join(root, "status"), "utf8");
  assert.match(status, /^state=success$/m);
  assert.match(status, /^context=merge-ready$/m);
  assert.match(status, /^description=Ready to merge$/m);
});

test("merge-ready sets failure naming each problem, and still exits 0", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReadyPath(root, { task: "### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n", body: "- [ ] unchecked", review: "[]" });
  const result = run("merge-ready.mjs", ["12"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const status = readFileSync(join(root, "status"), "utf8");
  assert.match(status, /^state=failure$/m);
  assert.match(status, /unticked checklist boxes/);
  assert.match(status, /CX-1 is `review`, not `done` \(#12\)/);
  assert.match(status, /no pass from the other agent \(Claude Code\) at abcdef0$/m);
  assert.ok(status.split("\n").find((line) => line.startsWith("description=")).length <= "description=".length + 140);
});

test("merge-ready stays red on a stacked PR until its base is main (decision 0046)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = run("merge-ready.mjs", ["12"], { root, env: { PATH: mergeReadyPath(root, { base: "claude/CC-1-below" }) } });
  assert.equal(result.status, 0, result.stderr);
  const status = readFileSync(join(root, "status"), "utf8");
  assert.match(status, /^state=failure$/m);
  assert.match(status, /base is claude\/CC-1-below: merge the PR below first, then retarget this one to main/);
});

test("the pre-commit hook refuses a skill edit staged without its rebuilt mirror", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-hook-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ["scripts", "skills", ".agents", "src", ".githooks"]) execFileSync("cp", ["-R", join(source, folder), join(root, folder)]);
  execFileSync("ln", ["-s", join(source, "node_modules"), join(root, "node_modules")]);
  command(root, ["init", "-q", "-b", "main"]);
  command(root, ["add", "-A"]);
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--no-verify", "-m", "base"]);
  const skill = join(root, "skills", "brain-howto", "SKILL.md");
  writeFileSync(skill, `${readFileSync(skill, "utf8")}\nOne more line.\n`);
  command(root, ["add", "skills"]);
  const hook = () => spawnSync("sh", [".githooks/pre-commit"], { cwd: root, encoding: "utf8", env: { ...process.env, HOME: root } });
  const refused = hook();
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stdout + refused.stderr, /drift/);
  execFileSync(process.execPath, ["--experimental-strip-types", "scripts/build-skills.ts"], { cwd: root });
  command(root, ["add", ".agents"]);
  const accepted = hook();
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
});
