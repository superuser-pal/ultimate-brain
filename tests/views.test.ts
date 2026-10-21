import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy, FIXTURE_BRAIN } from "./helpers.ts";

const BRIEF = "projects/acme-website/brief.md";
const DECISION_LOG = "projects/acme-website/decision-log.md";
const AREA_BRIEF = "areas/briefs/clients.md";
const NOW = "2026-12-06T09:00:00Z";

test("views recognizes the fixture's canonical derived blocks as current", async () => {
  const run = await brain(["views", "--check", "--brain", FIXTURE_BRAIN, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data, {
    projects: 1,
    areas: 1,
    written: [],
    created: [],
    unchanged: [AREA_BRIEF, BRIEF, DECISION_LOG],
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
  assert.deepEqual(run.json.data.unchanged, [AREA_BRIEF, DECISION_LOG]);
  const rebuilt = await readFile(brief, "utf8");
  assert.match(rebuilt, /Budget: 80000 EUR/);
  assert.equal(rebuilt.endsWith(userBlock), true, "the user block was preserved exactly");
  assert.match(rebuilt, /generated_at: 2026-12-06T09:00:00Z/);
  assert.match(rebuilt, /updated: 2026-12-06/);

  const again = await brain(["views", "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual(again.json.data.unchanged, [AREA_BRIEF, BRIEF, DECISION_LOG]);
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

test("a Brief lists reviewed notes only, with the waiting line when none is reviewed; the area Brief follows (0041)", async (context) => {
  const dir = await fixtureCopy(context);
  const decisionPath = join(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md");
  const questionPath = join(dir, "knowledge/questions/who-owns-the-acme-mobile-app.md");
  const waiting = "- Nothing reviewed yet: 1 note waiting in Review";
  const fixtureBrief = await readFile(join(dir, BRIEF), "utf8");
  assert.equal(fixtureBrief.split(waiting).length - 1, 2, "the fixture's draft decision and question wait in Review");

  // A reviewed decision is listed; a second, draft one is left out with no waiting line.
  await writeFile(decisionPath, (await readFile(decisionPath, "utf8")).replace("lifecycle: draft", "lifecycle: reviewed"));
  await writeFile(join(dir, "knowledge/decisions/2026-12-05-use-postgres-row-level-security.md"), `---
id: dec-4h6j8k2m
type: decision
title: Use Postgres row-level security
summary: Acme uses row-level security on every table.
lifecycle: draft
date: 2026-12-05
assessment: accepted
projects: [prj-9x4t1b7e]
sources: [mtg-8c4n2p7w]
created: 2026-12-05
updated: 2026-12-05
---

## Decision
Use row-level security.
`);
  // An answered question leaves Open questions even when reviewed.
  await writeFile(questionPath, (await readFile(questionPath, "utf8")).replace("lifecycle: draft", "lifecycle: reviewed").replace("kind: question", "kind: question\nanswer: dec-7k2m9q4x"));

  const run = await brain(["views", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.written, [AREA_BRIEF, BRIEF, DECISION_LOG]);
  for (const path of [BRIEF, AREA_BRIEF]) {
    const view = await readFile(join(dir, path), "utf8");
    assert.match(view, /## Recent decisions\n- 2026-12-03 — \[Use Supabase for auth\]\([^)]+\) \(accepted\)\n\n## Open questions\n- None\n/, path);
    assert.doesNotMatch(view, /Use Postgres row-level security|Nothing reviewed yet/, path);
  }
  const area = await readFile(join(dir, AREA_BRIEF), "utf8");
  assert.match(area, /^## Projects\n- \[Acme website\]\(\.\.\/\.\.\/projects\/acme-website\/project\.md\) — Active$/m);
  assert.match(area, /^area: area-2m7c4h8n$/m);
  assert.match(area, /^generated_from: \[area-2m7c4h8n, dec-7k2m9q4x, prj-9x4t1b7e\]$/m);
  const log = await readFile(join(dir, DECISION_LOG), "utf8");
  assert.match(log, /Use Postgres row-level security/, "the decision log lists every decision, whatever its lifecycle");

  const only = await brain(["views", "--area", "area-2m7c4h8n", "--check", "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual([only.code, only.json.data.projects, only.json.data.areas, only.json.data.unchanged], [0, 0, 1, [AREA_BRIEF]]);
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});
