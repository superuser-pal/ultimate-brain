// Shared by the tests of the maintainers' scripts (tests/scripts-*.test.mjs): release.mjs, task.mjs, pr-format.mjs,
// merge.mjs, merge-ready.mjs, main-guard.mjs and the git hooks. One file per script group, so node --test runs them in parallel.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test as nodeTest } from "node:test";

import { withBlock } from "../scripts/skills-integration.mjs";
import { forkState, PRODUCT, prBody, releaseNotes, sha, startMock, TOKEN, writePackage } from "./fixtures/github-mock.mjs";
import { disableGitAutoMaintenance } from "./git-env.ts";

// Skipped on Windows (decision 0097 §4): the maintainers' release and PR scripts (docs/releasing.md); their tests stub git, gh and npm with shell scripts, and run on macOS and in Ubuntu CI.
export const test = process.platform === "win32"
  ? (name, ...rest) => nodeTest(name, { skip: "maintainers' tooling, not run on Windows (decision 0097 §4)" }, () => {})
  : nodeTest;

// Every git these tests start, directly or through a script, runs without a detached `git maintenance` that could still be
// writing into a temp repo while the test removes it (ENOTEMPTY, CC-230). Each scripts-*.test.mjs imports `test` from here, so
// this runs in every one of their processes.
disableGitAutoMaintenance();

export const source = resolve(import.meta.dirname, "..");
/** A vendored fork snapshot (phase B, skills-delivery §9) that the mock's release brain-v1.0.0 matches; its range admits every version the tests use. */
export const VENDORED = { name: "ultimate-brain-skills", version: "1.0.0", cli: ">=0.0.0 <2.0.0", commit: sha("m1") };

export function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-scripts-"));
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.0.0"}\n');
  writeFileSync(join(root, "package-lock.json"), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
  return root;
}

// The skills-integration check (CC-106) never reaches the real GitHub API from a test: it points at a closed port unless a test starts the mock.
export const offline = { UB_GITHUB_API: "http://127.0.0.1:65535", GH_TOKEN: TOKEN };

export function run(script, args, { root, env = {}, input } = {}) {
  return spawnSync(process.execPath, [join(source, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    env: { ...process.env, ...offline, UB_ROOT: root, ...env },
  });
}

/** `run` without blocking this process, so an in-process mock server can answer the script. */
export function runAsync(script, args, { root, env = {} } = {}) {
  const child = spawn(process.execPath, [join(source, "scripts", script), ...args], { cwd: root, env: { ...process.env, ...offline, UB_ROOT: root, ...env } });
  const result = { stdout: "", stderr: "" };
  child.stdout.on("data", (chunk) => { result.stdout += chunk; });
  child.stderr.on("data", (chunk) => { result.stderr += chunk; });
  return new Promise((done) => child.on("close", (status) => done({ ...result, status })));
}

/**
 * A mock GitHub API whose skills integration is current: the fork's release 1.0.0 was assessed, in a closed issue. `edit(state)` changes it.
 * Returns the env that points the check at it.
 */
export async function integrationMock(t, edit = () => {}) {
  const block = {
    format: 1,
    tested: { name: "ultimate-brain", version: "0.9.0", integrity: `sha256-${"0".repeat(64)}` },
    seen: { head: sha("m1"), release: "1.0.0" },
    assessed: { commit: sha("m1"), release: "1.0.0", at: "2026-11-03T06:00:00Z" },
    changes: [],
    last_check: { at: "2026-11-03T06:00:00Z", status: "ok" },
  };
  const state = {
    fork: forkState({ history: [{ label: "c1" }, { label: "m1", pull: { number: 1, body: prBody("none") } }], releases: [{ version: "1.0.0", at: "m1", body: releaseNotes(VENDORED.cli) }] }),
    issues: [{ number: 1, title: "Skills integration: 0 open change(s)", body: withBlock("", block), labels: ["skills-integration"], state: "closed" }],
  };
  edit(state);
  const mock = await startMock(state);
  t.after(() => mock.close());
  return { env: { UB_GITHUB_API: mock.url, GH_TOKEN: TOKEN }, mock };
}

export function command(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

export function fakeCommands(root, scripts) {
  const bin = mkdtempSync(join(root, "bin-"));
  for (const [name, body] of Object.entries(scripts)) {
    const path = join(bin, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
  }
  return `${bin}:${process.env.PATH}`;
}

export function taskRows(rows) {
  return Buffer.from(rows).toString("base64");
}

/** A fake npm logged in as an owner of the package. */
export const npmOwner = 'case "$1" in whoami) printf tester ;; owner) printf "tester <tester@example.test>\\n" ;; esac';

/** Fakes for a release dry run of 0.4.0 from a clean main; `ci` is the gh body for the workflow runs request. */
export function releaseDryRun(root, { npm = npmOwner, ci = "printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n'" } = {}) {
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n");
  return fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/actions/runs?head_sha=abcdef&per_page=100") ${ci} ;;
    esac`,
    npm,
  });
}

/** A real repository for release 1.2.3 with a bare origin; `npm` is the fake npm body, `moreTasks` rows after its task. Returns the PATH and the origin path. */
export function releaseRepository(t, root, npm, moreTasks = "") {
  writeFileSync(join(root, "CHANGELOG.md"), "## 1.2.3 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), `### CX-1 · One · \`done\` (#1)\n**Release:** 1.2.3\n**Changelog:** One\n${moreTasks}`);
  writePackage(root, VENDORED);
  const path = fakeCommands(root, {
    gh: `case "$1" in
      repo) printf ${PRODUCT} ;;
      api) printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm,
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
  return { path, origin };
}

/** Fakes for a release dry run of `version` (0.9.0 on) from a clean main, with a valid package snapshot; returns the PATH. */
export function gateDryRun(root, version = "0.9.0", snapshot = VENDORED) {
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n");
  writeFileSync(join(root, "build/TASKS.md"), `### CC-1 · One · \`done\` (#12)\n**Release:** ${version}\n**Changelog:** One\n`);
  writePackage(root, snapshot);
  return fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf ${PRODUCT} ;;
      "api repos/${PRODUCT}/actions/runs?head_sha=abcdef&per_page=100") printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm: npmOwner,
  });
}

/** The fork's history after release 1.0.0 with one merged PR `m2`, and an open integration issue holding `changes` (§11.2). */
export function forkChange(state, { body, release, changes, issues = [] }) {
  const history = [{ label: "c1" }, { label: "m1", pull: { number: 1, body: prBody("none") } }, { label: "m2", pull: { number: 2, body } }];
  state.fork = forkState({ history, releases: [{ version: "1.0.0", at: "m1", body: releaseNotes(VENDORED.cli) }, ...(release === undefined ? [] : [{ version: release, at: "m2" }])] });
  state.issues.push(...issues);
  if (changes === undefined) return;
  const block = parseBlockOf(state.issues[0].body);
  state.issues[0].state = "open";
  state.issues[0].body = withBlock("", { ...block, changes });
}

export const parseBlockOf = (body) => JSON.parse(/<!-- skills-integration\n([\s\S]*?)\n-->/.exec(body)[1]);

/** A repository with an origin at `parent/origin.git`, holding `tasks` as build/TASKS.md on main. */
export function taskRepository(tasks) {
  const parent = mkdtempSync(join(tmpdir(), "ultimate-brain-task-"));
  const root = join(parent, "repo");
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.0.0"}\n');
  writeFileSync(join(root, "package-lock.json"), '{"name":"fixture","lockfileVersion":3,"packages":{}}\n');
  writeFileSync(join(root, "build/TASKS.md"), tasks);
  command(root, ["init", "-b", "main"]);
  command(root, ["config", "user.email", "tests@example.test"]);
  command(root, ["config", "user.name", "Tests"]);
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "fixture"]);
  const bare = join(parent, "origin.git");
  execFileSync("git", ["init", "--bare", bare]);
  command(root, ["remote", "add", "origin", bare]);
  command(root, ["push", "-u", "origin", "main"]);
  return { parent, root, path: fakeCommands(root, { npm: "exit 0" }) };
}

export function mergeReviewPath(root, review, task = "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n", branch = "codex/CX-1-one") {
  const id = /^\w+\/(\w+-\d+)-/.exec(branch)[1];
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"${branch}","headRefOid":"abcdef0","title":"${id}: One","body":"- [x] checked","mergeable":"MERGEABLE","state":"OPEN"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/commits/abcdef0/check-runs") printf 'completed\\tsuccess\\n' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows(task)}' ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '${review}' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
    esac`,
  });
}

export const claudeTask = "### CC-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n";

export function prFormatPath(root, baseLog, headLog) {
  const rows = taskRows("### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n\n### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n**Changelog:** Two\n");
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base"|"api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${rows}' ;;
      "api repos/owner/repo/contents/CHANGELOG.md?ref=base") printf '%s' '${taskRows(baseLog)}' ;;
      "api repos/owner/repo/contents/CHANGELOG.md?ref=head") printf '%s' '${taskRows(headLog)}' ;;
    esac`,
  });
}

/** pr-format fakes where CC-2 sits in TASKS.md on the base and the head's rows come from `headTasks` and `headHistory` (undefined: the file is missing). */
export function historyFormatPath(root, headTasks, headHistory, historyError = "gh: Not Found (HTTP 404)") {
  const both = "### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n\n### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n**Changelog:** Two\n";
  const missing = `echo '${historyError}' >&2; exit 1`;
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base") printf '%s' '${taskRows(both)}' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${taskRows(headTasks)}' ;;
      "api repos/owner/repo/contents/build/HISTORY.md?ref=base") ${missing} ;;
      "api repos/owner/repo/contents/build/HISTORY.md?ref=head") ${headHistory === undefined ? missing : `printf '%s' '${taskRows(headHistory)}'`} ;;
      "api repos/owner/repo/contents/CHANGELOG.md?ref=base"|"api repos/owner/repo/contents/CHANGELOG.md?ref=head") printf '' ;;
    esac`,
  });
}

export function mergeabilityPath(root, states) {
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

export function guardRepo(root, mergeBody) {
  command(root, ["init", "-q", "-b", "main"]);
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "base"]);
  const before = command(root, ["rev-parse", "HEAD"]).trim();
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "Merge pull request #12", "-m", mergeBody]);
  return { before, after: command(root, ["rev-parse", "HEAD"]).trim() };
}

export function guardPath(root, after, review) {
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

export function mergeReadyPath(root, { task = "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n", body = "- [x] checked", review = '[[{"user":{"login":"owner"},"body":"Review (Claude Code): pass at abcdef0"}]]', base = "main", history = "" } = {}) {
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"baseRefName":"${base}","headRefName":"codex/CX-1-one","headRefOid":"abcdef0","title":"CX-1: One","body":"${body}"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=abcdef0") printf '%s' '${taskRows(task)}' ;;
      "api repos/owner/repo/contents/build/HISTORY.md?ref=abcdef0") ${history === "" ? "echo 'gh: Not Found (HTTP 404)' >&2; exit 1" : `printf '%s' '${taskRows(history)}'`} ;;
      "api repos/owner/repo/pulls/12/reviews") printf '%s' '${review}' ;;
      "api repos/owner/repo/issues/12/comments") printf '%s' '[]' ;;
      "api repos/owner/repo/statuses/abcdef0") printf '%s\n' "$@" > '${join(root, "status")}' ;;
    esac`,
  });
}

/** pr-format fakes for the PR of CX-1 whose head has the rows `headRows`; the base has only CC-2's row, as for a task whose row was added on its branch (CC-116). */
export function ownRowPath(root, headRows) {
  return fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"codex/CX-1-one","headRefOid":"head","baseRefOid":"base","title":"CX-1: One"}' ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base") printf '%s' '${taskRows("### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n**Changelog:** Two\n")}' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${taskRows(headRows)}' ;;
      "api repos/owner/repo/contents/build/HISTORY.md?ref=base"|"api repos/owner/repo/contents/build/HISTORY.md?ref=head") echo 'gh: Not Found (HTTP 404)' >&2; exit 1 ;;
      "api repos/owner/repo/contents/CHANGELOG.md?ref=base"|"api repos/owner/repo/contents/CHANGELOG.md?ref=head") printf '' ;;
    esac`,
  });
}
