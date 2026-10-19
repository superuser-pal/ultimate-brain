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
  assert.match(changelog, /## 0\.3\.1 — unreleased/);
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
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '[[{"body":"Review (Claude Code): pass at abcdef0"}]]' ;;
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
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '[[{"body":"Review (Claude Code): pass at abcdef0"}]]' ;;
      "pr merge") exit 99 ;;
    esac`,
  });
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Would merge #12/);
});

function mergeReviewPath(root, review) {
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"- [x] checked","mergeable":"MERGEABLE","state":"OPEN"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\n' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows("### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n")}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '${review}' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
    esac`,
  });
}

test("merge dry-run accepts a fresh pass from the other agent", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"body":"Review (Claude Code): pass at abcdef0"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
});

test("merge dry-run refuses a pass from the same agent", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"body":"Review (Codex): pass at abcdef0"}]]');
  const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /other agent/);
});

test("merge dry-run refuses a pass naming another commit", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, '[[{"body":"Review (Claude Code): pass at deadbee"}]]');
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
