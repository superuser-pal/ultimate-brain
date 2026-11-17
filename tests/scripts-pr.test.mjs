// pr-format.mjs, merge.mjs, merge-ready.mjs and main-guard.mjs: the PR checks.
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { test, temporaryRoot, run, fakeCommands, taskRows, mergeReviewPath, claudeTask, prFormatPath, historyFormatPath, mergeabilityPath, guardRepo, guardPath, mergeReadyPath, ownRowPath } from "./scripts-helpers.mjs";

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

test("PR format rejects a task id another open PR plans under another title, and accepts a stacked PR's same row (CC-300)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const base = "### CC-1 · Old · `done` (#1)\n**Release:** 0.4.0\n**Changelog:** Old\n";
  const head = `${base}\n### CC-2 · Plan · \`review\`\n**Release:** 0.4.0\n**Changelog:** Plan\n\n### CC-3 · Planned here · \`todo\`\n**Release:** 0.4.0\n**Changelog:** Here\n`;
  const gh = (otherRows, list = `printf '%s' '[{"number":7,"headRefOid":"head"},{"number":8,"headRefOid":"other"}]'`) => fakeCommands(root, {
    gh: `case "$1 $2" in
      "pr view") printf '%s' '{"headRefName":"claude/CC-2-plan","headRefOid":"head","baseRefOid":"base","title":"CC-2: Plan"}' ;;
      "pr list") ${list} ;;
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=base") printf '%s' '${taskRows(base)}' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=head") printf '%s' '${taskRows(head)}' ;;
      "api repos/owner/repo/contents/build/TASKS.md?ref=other") printf '%s' '${taskRows(otherRows)}' ;;
    esac`,
  });
  const clash = run("pr-format.mjs", ["7"], { root, env: { PATH: gh(`${base}\n### CC-3 · Planned there · \`in progress\`\n**Release:** 0.4.0\n**Changelog:** There\n`) } });
  assert.equal(clash.status, 1);
  assert.match(clash.stderr, /PR adds task id\(s\) that open PR #8 uses for another task: CC-3\. Take free ids: node scripts\/task\.mjs next-id/);
  // PR #8 is stacked on this one: it has the same row, already started.
  const stacked = run("pr-format.mjs", ["7"], { root, env: { PATH: gh(`${head.replace("Planned here · \`todo\`", "Planned here · \`in progress\`")}`) } });
  assert.equal(stacked.status, 0, stacked.stderr);
  assert.equal(run("pr-format.mjs", ["7"], { root, env: { PATH: gh(base) } }).status, 0);
  const unlisted = run("pr-format.mjs", ["7"], { root, env: { PATH: gh(base, "echo 'gh: rate limited' >&2; exit 1") } });
  assert.equal(unlisted.status, 1);
  assert.match(unlisted.stderr, /Cannot list the open PRs: gh: rate limited/);
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

test("a claude/ PR passes with the Claude reviewer sub-agent's verdict or Codex's (decision 0063)", (t) => {
  for (const reviewer of ["Claude reviewer", "Codex"]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = mergeReviewPath(root, `[[{"user":{"login":"owner"},"body":"Review (${reviewer}): pass at abcdef0"}]]`, claudeTask, "claude/CC-1-one");
    const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: path } });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("merge dry-run refuses a pass from the same agent, from the PR's author, naming another commit, posted by another account or no user, and no pass", (t) => {
  const pass = (reviewer, at = "abcdef0", user = '"user":{"login":"owner"},') => `[[{${user}"body":"Review (${reviewer}): pass at ${at}"}]]`;
  for (const [review, message, task, branch] of [
    [pass("Codex"), /other agent/],
    [pass("Claude Code"), /no pass from the other agent \(Codex or Claude reviewer\) at abcdef0/, claudeTask, "claude/CC-1-one"],
    [pass("Claude reviewer"), /other agent \(Claude Code\)/],
    [pass("Claude Code", "deadbee"), /other agent/],
    [pass("Claude Code", "abcdef0", '"user":{"login":"someone-else"},'), /other agent/],
    [pass("Claude Code", "abcdef0", ""), /other agent/],
    ["[]", /other agent/],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = run("merge.mjs", ["12", "--dry-run"], { root, env: { PATH: mergeReviewPath(root, review, task, branch) } });
    assert.equal(result.status, 1, review);
    assert.match(result.stderr, message, review);
  }
});

test("merge dry-run accepts a user review override with a warning", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReviewPath(root, "[]");
  const result = run("merge.mjs", ["12", "--dry-run", "--reviewed-by-user"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WARNING: user override/);
});

test("PR format accepts a task row moved from TASKS.md to HISTORY.md and rejects one dropped from both (CC-94)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const one = "### CX-1 · One · `review`\n**Release:** 0.4.0\n**Changelog:** One\n";
  const moved = run("pr-format.mjs", ["1"], { root, env: { PATH: historyFormatPath(root, one, "# Build history\n\n### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n**Changelog:** Two\n") } });
  assert.equal(moved.status, 0, moved.stderr);
  const lostChangelog = run("pr-format.mjs", ["1"], { root, env: { PATH: historyFormatPath(root, one, "### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n") } });
  assert.match(lostChangelog.stderr, /loses \*\*Changelog:\*\* line\(s\): CC-2/);
  const dropped = run("pr-format.mjs", ["1"], { root, env: { PATH: historyFormatPath(root, one, undefined) } });
  assert.match(dropped.stderr, /loses task heading\(s\): CC-2/);
  const unreadable = run("pr-format.mjs", ["1"], { root, env: { PATH: historyFormatPath(root, one, undefined, "gh: Bad credentials (HTTP 401)") } });
  assert.match(unreadable.stderr, /Cannot read build\/HISTORY\.md: gh: Bad credentials/);
  const network = run("pr-format.mjs", ["1"], { root, env: { PATH: historyFormatPath(root, one, undefined, "connection reset fetching ref 404abcd") } });
  assert.match(network.stderr, /Cannot read build\/HISTORY\.md: connection reset/);
});

test("PR format rejects a CHANGELOG.md line lost from another task", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = prFormatPath(root, "## 0.3.1 — unreleased\n\n- CC-2: two\n", "## 0.3.1 — unreleased\n\n- CX-1: one\n");
  const result = run("pr-format.mjs", ["1"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /loses CHANGELOG\.md line\(s\): CC-2/);
});

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

test("merge-ready finds the PR's row in build/HISTORY.md (CC-94)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = mergeReadyPath(root, { task: "### CX-2 · Other · `todo`\n**Release:** 0.9.0\n", history: "# Build history\n\n### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n" });
  const result = run("merge-ready.mjs", ["12"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(root, "status"), "utf8"), /^state=success$/m);
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

test("PR format names a head that has no row for its own task (CC-116)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const two = "### CC-2 · Two · `done` (#2)\n**Release:** 0.4.0\n**Changelog:** Two\n";
  const dropped = run("pr-format.mjs", ["1"], { root, env: { PATH: ownRowPath(root, two) } });
  assert.equal(dropped.status, 1);
  assert.match(dropped.stderr, /PR has no row for its task CX-1/);
  assert.doesNotMatch(dropped.stderr, /CHANGELOG\.md/);
  const kept = run("pr-format.mjs", ["1"], { root, env: { PATH: ownRowPath(root, `### CX-1 · One · \`review\`\n**Release:** 0.4.0\n**Changelog:** One\n\n${two}`) } });
  assert.equal(kept.status, 0, kept.stderr);
});
