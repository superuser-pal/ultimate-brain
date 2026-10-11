import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy, FIXTURE_BRAIN } from "./helpers.ts";

const BRIEF = "projects/acme-website/brief.md";
const DECISION_LOG = "projects/acme-website/decision-log.md";
const NOW = "2026-12-06T09:00:00Z";

test("views recognizes the fixture's canonical derived blocks as current", async () => {
  const run = await brain(["views", "--check", "--brain", FIXTURE_BRAIN, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data, {
    projects: 1,
    written: [],
    created: [],
    unchanged: [BRIEF, DECISION_LOG],
    errors: [],
    check: true,
  });
});

test("views rewrites only a stale generated block and preserves the user block byte-for-byte", async (context) => {
  const dir = await fixtureCopy(context);
  const brief = join(dir, BRIEF);
  const original = await readFile(brief, "utf8");
  const userBlock = original.slice(original.indexOf("<!-- @user:start -->"));
  await writeFile(brief, original.replace("Budget: 80000 EUR", "Budget: obsolete"));

  const run = await brain(["views", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.written, [BRIEF]);
  assert.deepEqual(run.json.data.unchanged, [DECISION_LOG]);
  const rebuilt = await readFile(brief, "utf8");
  assert.match(rebuilt, /Budget: 80000 EUR/);
  assert.equal(rebuilt.endsWith(userBlock), true, "the user block was preserved exactly");
  assert.match(rebuilt, /generated_at: 2026-12-06T09:00:00Z/);
  assert.match(rebuilt, /updated: 2026-12-06/);

  const again = await brain(["views", "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual(again.json.data.unchanged, [BRIEF, DECISION_LOG]);
});

test("views creates missing view notes and --check reports changes without writing", async (context) => {
  const dir = await fixtureCopy(context);
  await rm(join(dir, BRIEF));
  await rm(join(dir, DECISION_LOG));

  const check = await brain(["views", "--check", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(check.code, 1);
  assert.deepEqual(check.json.data.created, [BRIEF, DECISION_LOG]);

  const created = await brain(["views", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
  assert.deepEqual(created.json.data.created, [BRIEF, DECISION_LOG]);
  const brief = await readFile(join(dir, BRIEF), "utf8");
  assert.match(brief, /^---\nid: vw-[0-9abcdefghjkmnpqrstvwxyz]{8}/);
  assert.match(brief, /<!-- @generated:start -->/);
  assert.match(brief, /<!-- @user:start -->\n<!-- @user:end -->/);
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.code, 0, lint.stdout);
});

test("views refuses a pre-existing view without one well-formed generated block", async (context) => {
  const dir = await fixtureCopy(context);
  const brief = join(dir, BRIEF);
  const original = await readFile(brief, "utf8");
  const broken = original.replace("<!-- @generated:end -->", "<!-- @generated:start -->");
  await writeFile(brief, broken);

  const run = await brain(["views", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 1);
  assert.deepEqual(run.json.data.errors, [{ path: BRIEF, reason: "MARKERS_INVALID" }]);
  assert.equal(await readFile(brief, "utf8"), broken);
});

test("lint reports a stale generated view as a warning", async (context) => {
  const dir = await fixtureCopy(context);
  const brief = join(dir, BRIEF);
  const original = await readFile(brief, "utf8");
  await writeFile(brief, original.replace("Budget: 80000 EUR", "Budget: old"));

  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.code, 0, lint.stdout);
  assert.deepEqual(
    lint.json.data.issues.filter((issue: { rule: string }) => issue.rule === "view-stale"),
    [{ severity: "warning", rule: "view-stale", path: BRIEF, line: 1, id: "vw-5b2n7q9h", message: "generated block is out of date; run brain views" }],
  );
});
