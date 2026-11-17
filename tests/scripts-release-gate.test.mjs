// release.mjs's skills-integration gate (CC-106, decision 0059, skills-delivery §9.8) and its reading of CI runs.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { PRODUCT, prBody, releaseNotes, sha } from "./fixtures/github-mock.mjs";
import { test, VENDORED, temporaryRoot, runAsync, integrationMock, gateDryRun, forkChange } from "./scripts-helpers.mjs";

test("the release gate passes a current integration and the section ends with the tested skills (CC-106)", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = gateDryRun(root);
  const { env, mock } = await integrationMock(t);
  const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## 0\.9\.0 — YYYY-MM-DD\n\n- CC-1 \(#12\): One\n\nSkills: ultimate-brain-skills 1\.0\.0 \(sha256-[0-9a-f]{64}\)\n/);
  assert.equal(mock.requests.filter((request) => request.method !== "GET").length, 0, "a dry run writes no issue");
});

test("the release gate blocks only an unclassified change that may be incompatible (decision 0059)", async (t) => {
  const refused = /Release refused: .*1 skills change\(s\) that may be incompatible are unclassified/;
  const warned = /Warning: 1 compatible skills change\(s\) unclassified/;
  for (const [change, status, message] of [
    [{ body: prBody("compatible"), release: "1.1.0" }, 0, warned],
    [{ body: prBody("coordinated", [`https://github.com/${PRODUCT}/issues/7`]), release: "2.0.0", issues: [{ number: 7, title: "Work", state: "open" }] }, 1, refused],
    [{ body: prBody("none") }, 0, warned],
    [{ body: prBody(undefined) }, 1, refused],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root);
    const { env } = await integrationMock(t, (state) => forkChange(state, change));
    const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
    assert.equal(result.status, status, result.stderr);
    assert.match(result.stderr, message);
  }
});

test("a release dry run writes no integration issue; a release records the change it saw", async (t) => {
  for (const dry of [true, false]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root);
    const { env, mock } = await integrationMock(t, (state) => forkChange(state, { body: prBody("compatible") }));
    const result = await runAsync("release.mjs", ["0.9.0", ...(dry ? ["--dry-run"] : [])], { root, env: { ...env, PATH: path } });
    const writes = mock.requests.filter((request) => request.method !== "GET");
    if (dry) {
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(writes, []);
    }
    else assert.deepEqual(writes.map((request) => [request.method, request.path]), [["POST", `/repos/${PRODUCT}/issues`]]);
  }
});

test("the release gate refuses the fork's first release while it is unclassified: it has no impact to read", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = gateDryRun(root);
  const { env } = await integrationMock(t, (state) => { state.issues = []; });
  const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /1 skills change\(s\) that may be incompatible are unclassified/);
});

test("the release gate passes a classified incompatible change with a linked task and blocks a dead link", async (t) => {
  const range = { from: sha("m1"), to: sha("m2") };
  for (const [number, expected] of [[7, 0], [99, 1]]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root);
    const link = `https://github.com/${PRODUCT}/issues/${number}`;
    const { env } = await integrationMock(t, (state) => forkChange(state, {
      body: prBody("coordinated", [link]), release: "2.0.0", issues: [{ number: 7, title: "Rename a skill", state: "open" }],
      changes: [{ kind: "release", release: "2.0.0", ...range, impact: "coordinated", classification: "brain-work", links: [link] }],
    }));
    const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
    assert.equal(result.status, expected, result.stderr);
    if (expected === 1) assert.match(result.stderr, new RegExp(`skills change\\(s\\) with an error in issue #1: dead link ${link}`));
  }
});

test("the release gate refuses an unavailable source as status unknown", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = gateDryRun(root);
  const { env } = await integrationMock(t, (state) => { state.forkDown = true; });
  const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /skills integration status unknown \(GET \/repos\/example\/ultimate-brain-skills\/commits\/main: HTTP 503\)/);
});

test("the release gate refuses a package snapshot that is invalid or whose range excludes the version", async (t) => {
  for (const [snapshot, broken, message] of [
    [VENDORED, true, /the package snapshot is invalid \(manifest-missing\)/],
    [{ name: "ultimate-brain-skills", version: "1.0.0", cli: ">=0.8.0 <0.9.0", commit: sha("m1") }, false, /the package snapshot ultimate-brain-skills 1\.0\.0 excludes 0\.9\.0 \(>=0\.8\.0 <0\.9\.0\)/],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root, "0.9.0", snapshot);
    if (broken) rmSync(join(root, ".agents", "skills", "snapshot.json"));
    const { env } = await integrationMock(t);
    const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
  }
});

test("the release gate refuses a phase A snapshot: a release ships the fork's (skills-delivery §9.8)", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = gateDryRun(root, "0.9.0", { version: "0.8.1", cli: ">=0.8.1 <0.10.0" });
  const { env } = await integrationMock(t);
  const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /vendored skills: name ultimate-brain/);
});

test("the release gate refuses a vendored snapshot the fork's release doesn't match, or that has no release (skills-delivery §9.8)", async (t) => {
  for (const [edit, message] of [
    [(state) => { state.fork.releases[0].body = releaseNotes(VENDORED.cli, `sha256-${"0".repeat(64)}`); }, /vendored skills: differs from brain-v1\.0\.0: integrity/],
    [(state) => { state.fork.releases[0].body = releaseNotes(">=0.9.0 <0.10.0"); }, /vendored skills: differs from brain-v1\.0\.0: cli/],
    [(state) => { state.fork.releases[0].version = "1.0.1"; }, /vendored skills: no release brain-v1\.0\.0/],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root);
    const { env } = await integrationMock(t, edit);
    const result = await runAsync("release.mjs", ["0.9.0", "--dry-run"], { root, env: { ...env, PATH: path } });
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, message);
  }
});

test("a release ships released skills: a prerelease vendored snapshot refuses a release without a prerelease part (skills-delivery §9.8)", async (t) => {
  for (const [version, status] of [["0.9.0", 1], ["0.9.0-rc.1", 0]]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root, version, { ...VENDORED, version: "1.1.0-rc.1" });
    const { env } = await integrationMock(t, (state) => { state.fork.releases.push({ version: "1.1.0-rc.1", at: "m1", commit: sha("m1"), body: releaseNotes(VENDORED.cli) }); });
    const result = await runAsync("release.mjs", [version, "--dry-run"], { root, env: { ...env, PATH: path } });
    assert.equal(result.status, status, result.stderr);
    if (status === 1) assert.match(result.stderr, /a release ships released skills: vendor a brain-v release without a prerelease part/);
    else assert.match(result.stdout, /Skills: ultimate-brain-skills 1\.1\.0-rc\.1 \(/);
  }
});

test("a release before 0.9.0 has no skills gate", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = gateDryRun(root, "0.8.2");
  rmSync(join(root, ".agents", "skills", "snapshot.json"));
  const { env, mock } = await integrationMock(t, (state) => { state.down = true; });
  const result = await runAsync("release.mjs", ["0.8.2", "--dry-run"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Skills:/);
  assert.equal(mock.requests.length, 0);
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

test("the release gate reads only the newest push run of the CI workflow on main", async () => {
  const { ciWorkflowPassed } = await import("../scripts/common.mjs");
  assert.equal(ciWorkflowPassed("CI\tpush\tmain\tcompleted\tsuccess\n"), true);
  assert.equal(ciWorkflowPassed("merge-ready\tissue_comment\tmain\tcompleted\tfailure\nCI\tpush\tmain\tcompleted\tsuccess\n"), true);
  assert.equal(ciWorkflowPassed("CI\tpush\tmain\tcompleted\tfailure\n"), false);
  assert.equal(ciWorkflowPassed("CI\tpush\tmain\tin_progress\t\n"), false);
  assert.equal(ciWorkflowPassed("CI\tpush\tmain\tcompleted\tsuccess\nCI\tpush\tmain\tcompleted\tfailure\n"), true);
  assert.equal(ciWorkflowPassed("merge-ready\tissue_comment\tmain\tcompleted\tsuccess\n"), false);
  assert.equal(ciWorkflowPassed(""), false);
  const { ciWorkflowState } = await import("../scripts/common.mjs");
  assert.deepEqual(["", "CI\tpush\tmain\tqueued\t\n", "CI\tpush\tmain\tcompleted\tsuccess\n", "CI\tpush\tmain\tcompleted\tcancelled\n"].map(ciWorkflowState), ["missing", "pending", "success", "failure"]);
  // A newer green run for a tag or another branch must not hide main's failed run (main-guard runs only on main).
  assert.equal(ciWorkflowPassed("CI\tpush\tv0.7.0\tcompleted\tsuccess\nCI\tpush\tmain\tcompleted\tfailure\n"), false);
  assert.equal(ciWorkflowPassed("CI\tpush\tother\tcompleted\tsuccess\n"), false);
});
