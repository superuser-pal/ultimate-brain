import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { textHash } from "../src/lib/wording.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-262 (gate problem 10): a report the brain published and nobody edited refreshes with no Accept,
// because its publish recorded the page's read-back (cli §5.14.6, §5.14.7).

const NOW = "2026-12-10T10:05:00Z";
const LATER = "2026-12-10T11:30:00Z";
const PAGE = "5c4d3e2f-1a0b-4c9d-8e7f-6a5b4c3d2e1f";
const REPORT = "## Where it stands\n\n- On track.\n\n## Timeline\n\n- Dec 1: kickoff\n\n## Decisions in force\n\nNone.\n\n## Open questions and risks\n\nNone.\n\n## People involved\n\nAlex.\n\n## Gaps\n\nNone.\n";
// What Notion serves back is not byte-equal to what render sent (§5.14.7, "Four hashes"): here a list marker.
const READ_BACK = REPORT.replace("- On track.", "* On track.");

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

/** A report made the way setup's first-value check makes one (brain-query report mode): report new, never published yet. */
async function newReport(dir: string): Promise<{ id: string; path: string }> {
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.documents = "d1000000-0000-4000-8000-000000000001";
  await writeFile(configPath, JSON.stringify(config, null, 2));
  const created = await run(dir, ["report", "new"], { title: "Launch: where we stand", question: "Where does the launch stand?", body: REPORT });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data;
}

/** Renders the report's first publish: a create carrying its body and `@git_body`. */
async function firstPublish(dir: string, id: string) {
  const rendered = await run(dir, ["sync", "render", "--ids", id]);
  assert.equal(rendered.code, 0, rendered.stdout);
  const [item] = rendered.json.data.items;
  assert.equal(item.action, "create");
  assert.equal(typeof item.body, "string");
  assert.equal(typeof item.published["@git_body"], "string");
  return item;
}

async function published(dir: string, path: string): Promise<Record<string, unknown>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

const wording = (body: string, overrides: Record<string, unknown> = {}) => ({ accepted: false, accepted_at: null, page_edited_at: "2026-12-10T10:05:00Z", body_markdown: body, unconvertible: false, pending_revision: false, pending_refresh: false, ...overrides });
const row = (id: string, w: unknown) => ({ database: "documents", page_id: PAGE, last_edited: w && typeof w === "object" ? (w as { page_edited_at: string }).page_edited_at : NOW, properties: { "Brain ID": id, "Refresh asked": true }, wording: w });

async function plan(dir: string, rows: unknown[]) {
  const result = await run(dir, ["sync", "plan"], { as_of: LATER, rows }, LATER);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

test("a report published with its read-back and not edited is refreshed by the next catch-up with no Accept", async (context) => {
  const dir = await fixtureCopy(context);
  const report = await newReport(dir);
  const item = await firstPublish(dir, report.id);
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: report.id, notion: PAGE, synced_at: NOW, published: { ...item.published, "@notion_body": textHash(READ_BACK) } }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  assert.deepEqual(recorded.json.warnings, []);
  const after = await published(dir, report.path);
  assert.equal((after.notion_published as Record<string, unknown>)["@notion_body"], textHash(READ_BACK));

  // The next catch-up: the page holds what the brain wrote (as Notion serves it), Refresh asked is ticked.
  const planned = await plan(dir, [row(report.id, wording(READ_BACK))]);
  assert.deepEqual(planned.wording_held, []);
  assert.deepEqual(planned.wording_waiting, []);
  assert.deepEqual(planned.accepted_wording, []);
  assert.deepEqual(planned.refresh_requests, [{ page_id: PAGE, report: report.id }], "the refresh runs: not wording_blocked");
});

test("a report edited in Notion after its publish still waits for Accept, and the Accept shows the difference", async (context) => {
  const dir = await fixtureCopy(context);
  const report = await newReport(dir);
  const item = await firstPublish(dir, report.id);
  await run(dir, ["sync", "record"], { records: [{ id: report.id, notion: PAGE, synced_at: NOW, published: { ...item.published, "@notion_body": textHash(READ_BACK) } }] });

  const edited = READ_BACK.replace("Alex.", "Alex.\n\nSam joins in January.");
  const held = await plan(dir, [row(report.id, wording(edited, { page_edited_at: "2026-12-10T11:00:00Z" }))]);
  assert.deepEqual(held.wording_held, [{ page_id: PAGE, note: report.id, reason: "UNACCEPTED_DRAFT", accepted: false }]);
  assert.deepEqual(held.refresh_requests, [{ page_id: PAGE, report: report.id, wording_blocked: true }], "a refresh never overwrites the edit");

  // The user clicks Accept: the edit comes back as accepted wording, with its difference from Git.
  const accepted = await plan(dir, [row(report.id, wording(edited, { accepted: true, accepted_at: "2026-12-10T11:10:00Z", page_edited_at: "2026-12-10T11:10:00Z" }))]);
  assert.equal(accepted.accepted_wording.length, 1);
  assert.equal(accepted.accepted_wording[0].note, report.id);
  assert.equal(accepted.accepted_wording[0].markdown, edited);
  assert.ok(accepted.accepted_wording[0].diff.added > 0, JSON.stringify(accepted.accepted_wording[0].diff));
});

test("sync record warns NOTION_BODY_MISSING when a body is recorded without its read-back, and still links the page", async (context) => {
  const dir = await fixtureCopy(context);
  const report = await newReport(dir);
  const item = await firstPublish(dir, report.id);
  // What the gate's setup did: the item's published, no @notion_body.
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: report.id, notion: PAGE, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  assert.equal(recorded.json.data.records[0].result, "recorded");
  assert.deepEqual(recorded.json.warnings.map((warning: { code: string; id: string }) => [warning.code, warning.id]), [["NOTION_BODY_MISSING", report.id]]);
  const after = await published(dir, report.path);
  assert.equal(after.notion, PAGE);
  assert.equal(after.last_synced, NOW);
  assert.equal(Object.hasOwn(after.notion_published as object, "@notion_body"), false);
  // Without the baseline the page is held (row 9): the symptom the warning names.
  const planned = await plan(dir, [row(report.id, wording(READ_BACK))]);
  assert.deepEqual(planned.wording_held, [{ page_id: PAGE, note: report.id, reason: "NO_BASELINE", accepted: false }]);
});

test("sync record does not warn for a failed read-back (null) or a write with no body", async (context) => {
  const dir = await fixtureCopy(context);
  const report = await newReport(dir);
  const item = await firstPublish(dir, report.id);
  const failedReadBack = await run(dir, ["sync", "record"], { records: [{ id: report.id, notion: PAGE, synced_at: NOW, published: { ...item.published, "@notion_body": null } }] });
  assert.equal(failedReadBack.code, 0, failedReadBack.stdout);
  assert.deepEqual(failedReadBack.json.warnings, []);
  const propertiesOnly = await run(dir, ["sync", "record"], { records: [{ id: report.id, notion: PAGE, synced_at: NOW, published: { Name: "Launch: where we stand" } }] });
  assert.equal(propertiesOnly.code, 0, propertiesOnly.stdout);
  assert.deepEqual(propertiesOnly.json.warnings, []);
});
