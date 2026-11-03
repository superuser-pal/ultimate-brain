import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { declaration, github, parseBlock, runCheck, summary, withBlock } from "../scripts/skills-integration.mjs";
import { forkState, PRODUCT, prBody, SCHEMA, sha, startMock, TOKEN, writePackage } from "./fixtures/github-mock.mjs";

// The skills-integration check against a mock GitHub API (spec/skills-delivery.md §11, §12.4, CC-106): a compatible change, an
// incompatible change, an unreleased change and an unavailable source. No test calls the real API.
const NOW = new Date("2026-11-04T06:00:00Z");
const ISSUE = `https://github.com/${PRODUCT}/issues`;

async function setup(t, state, { tested } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ub-skills-integration-"));
  writePackage(root, tested);
  const mock = await startMock(state);
  t.after(async () => { await mock.close(); rmSync(root, { recursive: true, force: true }); });
  const check = (options = {}) => runCheck({ root, repo: PRODUCT, request: github({ api: mock.url, token: TOKEN }), now: NOW, ...options });
  return { root, mock, check };
}

const integrationIssues = (state, wanted = "open") => state.issues.filter((issue) => issue.labels?.includes("skills-integration") && (issue.state ?? "open") === wanted);
const blockOf = (issue) => parseBlock(issue.body, issue.number);

/** A closed integration issue whose block assessed `commit` (release `release`), so the check starts from there. */
function assessedAt(commit, release) {
  const block = {
    format: 1,
    tested: { name: "ultimate-brain", version: "0.9.0", integrity: `sha256-${"0".repeat(64)}` },
    seen: { head: commit, release: release ?? null },
    assessed: { commit, ...(release === undefined ? {} : { release }), at: "2026-11-03T06:00:00Z" },
    changes: [],
    last_check: { at: "2026-11-03T06:00:00Z", status: "ok" },
  };
  return { number: 1, title: "Skills integration: 0 open change(s)", body: withBlock("Closed.", block), labels: ["skills-integration"], state: "closed", updated: 1 };
}

/** Edits the one open issue's block as a classifier would (§11.2). */
function classify(state, edit) {
  const [issue] = integrationIssues(state);
  const block = blockOf(issue);
  edit(block);
  issue.body = withBlock(issue.body, block);
}

const released = [{ label: "c1" }, { label: "m1", pull: { number: 1, body: prBody("none") } }];

test("first run: the fork's first release is one unclassified change with no from or impact, in one new issue", async (t) => {
  const { mock, check } = await setup(t, { fork: forkState({ history: released, releases: [{ version: "1.0.0", at: "m1" }] }) });
  const result = await check();
  assert.equal(result.status, "ok");
  const [issue] = integrationIssues(mock.state);
  assert.equal(issue.title, "Skills integration: 1 open change(s)");
  assert.deepEqual(blockOf(issue).changes, [{ kind: "release", release: "1.0.0", to: sha("m1"), classification: "unclassified" }]);
  assert.deepEqual(blockOf(issue).seen, { head: sha("m1"), release: "1.0.0" });
  assert.equal(summary(result), "skills integration: 1 open, 1 unclassified");
});

test("a compatible change: one unreleased entry, classified ready, keeps its classification when released, one issue throughout", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("compatible") } }];
  const state = { fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }] }), issues: [assessedAt(sha("m1"), "1.0.0")] };
  const { mock, check } = await setup(t, state);
  await check();
  assert.equal(integrationIssues(mock.state).length, 1);
  let [change] = blockOf(integrationIssues(mock.state)[0]).changes;
  assert.deepEqual(change, { kind: "unreleased", from: sha("m1"), to: sha("m2"), impact: "compatible", classification: "unclassified" });
  classify(mock.state, (block) => { block.changes[0].classification = "ready"; block.changes[0].note = "skill wording only"; });
  mock.state.fork = forkState({ history, releases: [{ version: "1.0.0", at: "m1" }, { version: "1.1.0", at: "m2" }] });
  const result = await check();
  assert.equal(integrationIssues(mock.state).length, 1);
  [change] = result.block.changes;
  assert.deepEqual(change, { kind: "release", release: "1.1.0", from: sha("m1"), to: sha("m2"), impact: "compatible", classification: "ready", note: "skill wording only" });
  assert.equal(summary(result), "skills integration: 1 open, 0 unclassified");
});

test("an incompatible change: a coordinated PR's Product links are recorded and a dead one is a brain-work error", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("coordinated", [`${ISSUE}/7`, `${ISSUE}/99`]) } }];
  const state = {
    fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }, { version: "2.0.0", at: "m2" }] }),
    issues: [assessedAt(sha("m1"), "1.0.0"), { number: 7, title: "Rename a skill", state: "open" }],
  };
  const { mock, check } = await setup(t, state);
  const result = await check();
  assert.deepEqual(result.block.changes, [{
    kind: "release", release: "2.0.0", from: sha("m1"), to: sha("m2"), impact: "coordinated", classification: "brain-work",
    links: [`${ISSUE}/7`, `${ISSUE}/99`], error: `dead link ${ISSUE}/99`,
  }]);
  // Fixing the link clears the error on the next run; the classification stays.
  mock.state.issues.push({ number: 99, title: "Follow-up", state: "open" });
  const again = await check();
  assert.equal(again.block.changes[0].error, undefined);
  assert.equal(again.block.changes[0].classification, "brain-work");
  assert.equal(integrationIssues(mock.state).length, 1);
});

test("an unreleased change: more commits extend the one entry's to and need a new classification", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("none") } }];
  const state = { fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }] }), issues: [assessedAt(sha("m1"), "1.0.0")] };
  const { mock, check } = await setup(t, state);
  await check();
  classify(mock.state, (block) => { block.changes[0].classification = "no-action"; });
  mock.state.fork = forkState({ history: [...history, { label: "m3", pull: { number: 3 } }], releases: [{ version: "1.0.0", at: "m1" }] });
  const result = await check();
  assert.deepEqual(result.block.changes, [{ kind: "unreleased", from: sha("m1"), to: sha("m3"), impact: "undeclared", classification: "unclassified" }]);
  assert.equal(integrationIssues(mock.state).length, 1);
});

test("impact reads every page of a long segment and only its merge commits", async (t) => {
  const plain = Array.from({ length: 120 }, (_, index) => ({ label: `p${index}` }));
  const history = [
    ...released,
    { label: "x1", pull: { number: 5, body: prBody("coordinated", [`${ISSUE}/7`]) }, plain: true },
    ...plain,
    { label: "m2", pull: { number: 2, body: prBody("none") } },
    { label: "m3", pull: { number: 3, body: prBody("compatible") } },
  ];
  const state = { fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }] }), issues: [assessedAt(sha("m1"), "1.0.0"), { number: 7, state: "open" }] };
  const { mock, check } = await setup(t, state);
  const result = await check();
  assert.equal(result.block.changes[0].impact, "compatible", "the PR on page 2 counts; the plain commit's PR does not");
  assert.equal(result.block.changes[0].links, undefined);
  assert.ok(mock.requests.some((request) => request.path.includes("/compare/") && request.query.includes("page=2")));
  mock.state.compareTruncated = true;
  const truncated = await check();
  assert.equal(truncated.status, "unknown");
  assert.match(truncated.error, /listed 100 of 123 commits/);
});

test("a no-action change is dropped once assessed passes it, which closes the issue; the next run starts from the closed block", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("none") } }];
  const state = { fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }] }), issues: [assessedAt(sha("m1"), "1.0.0")] };
  const { mock, check } = await setup(t, state);
  await check();
  classify(mock.state, (block) => { block.changes[0].classification = "no-action"; block.assessed = { commit: sha("m2"), at: "2026-11-04T07:00:00Z" }; });
  const closed = await check();
  assert.deepEqual(closed.block.changes, []);
  assert.equal(integrationIssues(mock.state).length, 0);
  const again = await check();
  assert.equal(again.status, "ok");
  assert.equal(again.issue, null);
  assert.equal(integrationIssues(mock.state).length, 0);
  assert.deepEqual(again.block.assessed.commit, sha("m2"));
});

test("a ready change stays until the tested revision includes it", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("compatible") } }];
  const releases = [{ version: "1.0.0", at: "m1" }, { version: "1.1.0", at: "m2" }];
  const state = { fork: forkState({ history, releases }), issues: [assessedAt(sha("m1"), "1.0.0")] };
  const { mock, root, check } = await setup(t, state);
  await check();
  classify(mock.state, (block) => { block.changes[0].classification = "ready"; block.assessed = { commit: sha("m2"), release: "1.1.0", at: "2026-11-04T07:00:00Z" }; });
  assert.equal((await check()).block.changes.length, 1);
  writePackage(root, { name: "ultimate-brain-skills", version: "1.1.0", cli: ">=0.9.0 <0.10.0", commit: sha("m2") });
  const result = await check();
  assert.deepEqual(result.block.changes, []);
  assert.equal(result.block.tested.commit, sha("m2"));
  assert.equal(integrationIssues(mock.state).length, 0);
});

test("a vendored schema that differs is a brain-work error linking the product commit", async (t) => {
  const state = {
    fork: forkState({ history: released, releases: [{ version: "1.0.0", at: "m1" }], schema: JSON.stringify({ ...JSON.parse(SCHEMA), title: "An older copy" }) }),
    issues: [assessedAt(sha("m1"), "1.0.0")],
    schemaCommit: sha("schema-change"),
  };
  const { check } = await setup(t, state);
  const result = await check();
  assert.deepEqual(result.block.changes, [{
    kind: "unreleased", from: sha("m1"), to: sha("m1"), classification: "brain-work",
    links: [`https://github.com/${PRODUCT}/commit/${sha("schema-change")}`], error: "vendored schema differs",
  }]);
});

test("an unavailable source is status unknown: the open issue records it and keeps its changes", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("compatible") } }];
  const state = { fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }] }), issues: [assessedAt(sha("m1"), "1.0.0")] };
  const { mock, check } = await setup(t, state);
  await check();
  mock.state.forkDown = true;
  const result = await check();
  assert.equal(result.status, "unknown");
  assert.match(result.error, /HTTP 503/);
  assert.equal(summary(result), `skills integration: status unknown (${result.error})`);
  const [issue] = integrationIssues(mock.state);
  const block = blockOf(issue);
  assert.deepEqual(block.last_check, { at: "2026-11-04T06:00:00Z", status: "unknown", error: result.error });
  assert.equal(block.changes.length, 1);
});

test("an unreachable API, a rejected credential, two open issues and an invalid block are all unknown and write nothing", async (t) => {
  const history = [...released, { label: "m2", pull: { number: 2, body: prBody("compatible") } }];
  const base = () => ({ fork: forkState({ history, releases: [{ version: "1.0.0", at: "m1" }] }) });
  const { root } = await setup(t, base());
  const unreachable = await runCheck({ root, repo: PRODUCT, request: github({ api: "http://127.0.0.1:65535", token: TOKEN }), now: NOW });
  assert.equal(unreachable.status, "unknown");
  assert.match(unreachable.error, /GitHub unreachable/);

  const rejected = await setup(t, { ...base(), token: "other" });
  assert.deepEqual([(await rejected.check()).status, (await rejected.check()).error], ["unknown", "credential rejected (HTTP 401)"]);

  const open = { title: "Skills integration", body: "no block yet", labels: ["skills-integration"], state: "open" };
  const two = await setup(t, { ...base(), issues: [{ number: 1, ...open }, { number: 2, ...open }] });
  const result = await two.check();
  assert.deepEqual([result.status, result.error], ["unknown", "two integration issues"]);
  assert.equal(two.mock.requests.filter((request) => request.method !== "GET").length, 0);

  const invalid = await setup(t, { ...base(), issues: [{ number: 3, ...open, body: "<!-- skills-integration\n{\"format\": 2}\n-->" }] });
  const bad = await invalid.check();
  assert.equal(bad.status, "unknown");
  assert.match(bad.error, /integration block in #3 is invalid/);
  assert.equal(invalid.mock.requests.filter((request) => request.method !== "GET").length, 0);
});

test("an invalid package snapshot is status unknown", async (t) => {
  const { root, check } = await setup(t, { fork: forkState({ history: released, releases: [{ version: "1.0.0", at: "m1" }] }) });
  rmSync(join(root, ".agents", "skills", "snapshot.json"));
  const result = await check();
  assert.deepEqual([result.status, result.error], ["unknown", "package snapshot invalid (manifest-missing)"]);
});

test("a dry run reads but writes nothing", async (t) => {
  const { mock, check } = await setup(t, { fork: forkState({ history: released, releases: [{ version: "1.0.0", at: "m1" }] }) });
  const result = await check({ write: false });
  assert.equal(result.block.changes.length, 1);
  assert.equal(mock.requests.filter((request) => request.method !== "GET").length, 0);
});

test("the block rewrite keeps the text above it", () => {
  const block = { format: 1 };
  const body = withBlock("Notes by hand.\n\n<!-- skills-integration\n{}\n-->\n", block);
  assert.equal(body, `Notes by hand.\n\n<!-- skills-integration\n${JSON.stringify(block, null, 2)}\n-->\n`);
});

test("the impact declaration ignores comments and fences and needs exactly one valid line (§10.4)", () => {
  assert.equal(declaration("Brain impact: compatible\r\n").impact, "compatible");
  assert.equal(declaration("<!-- Brain impact: none -->\n").impact, "undeclared");
  assert.equal(declaration("```\nBrain impact: none\n```\n").impact, "undeclared");
  assert.equal(declaration("Brain impact: none\nBrain impact: compatible\n").impact, "undeclared");
  assert.equal(declaration("Brain impact: unassessed\n").impact, "undeclared");
  assert.deepEqual(declaration(`Brain impact: coordinated\nProduct: ${ISSUE}/4\n`), { impact: "coordinated", links: [`${ISSUE}/4`] });
});

test("the command line exits 1 on an unknown status and never prints the token", async (t) => {
  const { root, mock } = await setup(t, { fork: forkState({ history: released, releases: [{ version: "1.0.0", at: "m1" }] }), forkDown: true });
  const script = resolve(import.meta.dirname, "..", "scripts", "skills-integration.mjs");
  const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", script, "--root", root, "--repo", PRODUCT], {
    env: { ...process.env, UB_GITHUB_API: mock.url, GH_TOKEN: TOKEN },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const status = await new Promise((done) => child.on("close", done));
  assert.equal(status, 1);
  assert.match(output, /^skills integration: status unknown \(GET \/repos\/example\/ultimate-brain-skills\/commits\/main: HTTP 503\)/);
  assert.doesNotMatch(output, new RegExp(TOKEN));
});
