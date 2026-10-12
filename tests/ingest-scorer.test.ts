import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FIXTURE_BRAIN } from "./helpers.ts";

async function folders(context: import("node:test").TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ingest-score-"));
  context.after(async () => { await (await import("node:fs/promises")).rm(root, { recursive: true, force: true }); });
  const base = join(root, "base");
  const run = join(root, "run");
  await cp(FIXTURE_BRAIN, base, { recursive: true });
  await cp(base, run, { recursive: true });
  return { root, base, run };
}

async function expected(root: string, value: object) {
  const path = join(root, "expected.json");
  await writeFile(path, JSON.stringify(value));
  return path;
}

function score(base: string, run: string, expectedPath: string) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, "..", "scripts", "score-ingest.mjs"), "--base", base, "--run", run, "--expected", expectedPath], { encoding: "utf8" });
  assert.equal(result.error, undefined, result.stderr);
  return JSON.parse(result.stdout);
}

test("ingest scorer passes an unchanged stop case", async (context) => {
  const { root, base, run } = await folders(context);
  const report = score(base, run, await expected(root, { case: "stop", expect: { stop: true } }));
  assert.equal(report.verdict, "pass");
  assert.deepEqual(report.files, { created: [], changed: [], deleted: [] });
});

test("ingest scorer fails a modified stop case", async (context) => {
  const { root, base, run } = await folders(context);
  await writeFile(join(run, "README.md"), "changed\n");
  const report = score(base, run, await expected(root, { case: "stop", expect: { stop: true } }));
  assert.equal(report.verdict, "fail");
  assert.deepEqual(report.files.changed, ["README.md"]);
});

test("ingest scorer reports low recall", async (context) => {
  const { root, base, run } = await folders(context);
  const report = score(base, run, await expected(root, {
    case: "low-recall",
    expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [{ type: "person", title: ["Missing"] }], proposals: [], tasks: [], must_not: [] },
    optional: [],
  }));
  assert.equal(report.verdict, "fail");
  assert.equal(report.metrics.notes.recall, 0);
  assert.equal(report.unmatched.notes.length, 1);
});

test("ingest scorer detects a must_not proposal", async (context) => {
  const { root, base, run } = await folders(context);
  await (await import("node:fs/promises")).mkdir(join(run, "_proposals"), { recursive: true });
  await writeFile(join(run, "_proposals", "new.md"), "---\nid: prp-0a1b2c3d\ntype: proposal\ntitle: forbidden\nkind: update_fact\ntarget: prj-9x4t1b7e\nstatus: pending\n---\n");
  const report = score(base, run, await expected(root, {
    case: "must-not",
    expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [], proposals: [], tasks: [], must_not: [{ proposal: {} }] },
    optional: [],
  }));
  assert.equal(report.verdict, "fail");
  assert.equal(report.must_not.length, 1);
});
