import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// Decision 0071 (0.9.1, CC-125): Notion shows reviewed knowledge. A decision, question, concept or Document gets its page
// once it is reviewed; until then it lives only in its Review row (spec/cli.md §5.14.4).
const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const DECISION = "dec-7k2m9q4x";
const DECISION_FILE = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const QUESTION = "que-8n3v5x1d";
const QUESTION_FILE = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const DRAFT_PERSON = "per-9t2c6m4a";
const DRAFT_PERSON_FILE = "knowledge/people/carlos-ruiz.md";
const PAGE = "e1000000-0000-4000-8000-000000000001";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function attributes(dir: string, path: string): Promise<Record<string, unknown>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

/** Sets a top-level scalar of a note's frontmatter, or drops the key (and its indented children) with `null`. */
async function setField(dir: string, path: string, key: string, value: string | null): Promise<void> {
  const file = join(dir, path);
  const lines = (await readFile(file, "utf8")).split("\n");
  const out: string[] = []; let skipping = false; let done = false; let fences = 0;
  for (const line of lines) {
    if (line === "---") { fences += 1; if (fences === 2 && !done && value !== null) { out.push(`${key}: ${value}`); done = true; } }
    if (fences === 1 && /^\S/.test(line)) {
      skipping = line.startsWith(`${key}:`);
      if (skipping) { if (value !== null && !done) { out.push(`${key}: ${value}`); done = true; } continue; }
    }
    if (skipping && fences === 1 && /^\s/.test(line)) continue;
    out.push(line);
  }
  await writeFile(file, out.join("\n"));
}

async function lintErrors(dir: string): Promise<unknown[]> {
  const lint = await run(dir, ["lint"]);
  return lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

async function renderChanged(dir: string): Promise<Record<string, any>> {
  const result = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

async function record(dir: string, item: Record<string, any>, page = PAGE): Promise<void> {
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: item.id, notion: item.page_id ?? page, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
}

/** One Review notes row over the given drafts, as one ingest writes it. */
async function reviewRow(dir: string, notes: string[]): Promise<string> {
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes }] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0].id;
}

async function decide(dir: string, proposal: string, action: "approve" | "reject"): Promise<void> {
  const applied = await run(dir, ["apply"], { decisions: [{ proposal, action, decided_at: "2026-12-10T08:00:00Z", decided_by: "notion" }] });
  assert.equal(applied.code, 0, applied.stdout);
}

const byId = (items: Array<Record<string, any>>, id: string) => items.find((item) => item.id === id);

test("render: a draft decision gets no page, and its meeting's Decisions waits without pending it (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  const data = await renderChanged(dir);
  assert.equal(byId(data.items, DECISION), undefined, "a draft decision is not created");
  for (const item of data.items) {
    for (const pending of item.pending_relations) assert.ok(!pending.ids.includes(DECISION), `${item.id} lists the draft in pending_relations`);
  }
  const meeting = byId(data.items, SYNC);
  if (meeting !== undefined) assert.ok(!(meeting.properties.Decisions?.value ?? []).length, "no page to link yet");

  const ids = await run(dir, ["sync", "render", "--ids", DECISION]);
  assert.equal(ids.code, 0, ids.stdout);
  assert.deepEqual(ids.json.data.items, []);
  assert.deepEqual(ids.json.data.skipped, [{ id: DECISION, reason: "NOT_REVIEWED" }]);
});

test("render: approving the draft publishes it and fills its meeting's Decisions in the same run (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  // Publish what is publishable, as an earlier run did, so only the approval is news.
  let next = 0;
  for (let round = 0; round < 3; round += 1) {
    for (const item of (await renderChanged(dir)).items) if (item.action !== "trash") await record(dir, item, item.page_id ?? `e1000000-0000-4000-8000-${String((next += 1)).padStart(12, "0")}`);
  }
  assert.deepEqual((await renderChanged(dir)).items, [], "everything publishable is published");
  const row = await reviewRow(dir, [DECISION]);
  await decide(dir, row, "approve");
  assert.equal((await attributes(dir, DECISION_FILE)).lifecycle, "reviewed");

  const first = await renderChanged(dir);
  const created = byId(first.items, DECISION);
  assert.equal(created?.action, "create");
  assert.deepEqual(created!.properties.Lifecycle, { type: "select", value: "Reviewed" });
  const waiting = byId(first.items, SYNC);
  assert.ok(waiting !== undefined, "the meeting is returned for the relation it is waiting for");
  assert.deepEqual(waiting!.pending_relations, [{ property: "Decisions", ids: [DECISION] }]);
  assert.deepEqual(waiting!.properties, {}, "nothing to write yet, not even Last Synced");

  const decisionPage = "e2000000-0000-4000-8000-000000000002";
  await record(dir, created!, decisionPage);
  const second = await renderChanged(dir);
  const meeting = byId(second.items, SYNC);
  assert.deepEqual(meeting?.properties.Decisions?.value, [decisionPage]);
  assert.deepEqual(meeting!.pending_relations, []);
  assert.deepEqual(await lintErrors(dir), []);
});

test("render: a rejected draft never gets a page (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  const row = await reviewRow(dir, [DECISION]);
  await decide(dir, row, "reject");
  assert.equal((await attributes(dir, DECISION_FILE)).lifecycle, "archived");
  assert.equal(byId((await renderChanged(dir)).items, DECISION), undefined);
  const ids = await run(dir, ["sync", "render", "--ids", DECISION]);
  assert.deepEqual(ids.json.data.skipped, [{ id: DECISION, reason: "NOT_REVIEWED" }]);
});

test("render: a draft person still gets its page (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  await setField(dir, DRAFT_PERSON_FILE, "notion", null);
  assert.equal((await attributes(dir, DRAFT_PERSON_FILE)).lifecycle, "draft");
  const person = byId((await renderChanged(dir)).items, DRAFT_PERSON);
  assert.equal(person?.action, "create");
  assert.deepEqual(person!.properties.Lifecycle, { type: "select", value: "Draft" });
});

test("render: a disputed decision is created and keeps its page; an archived page stays as history (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  await setField(dir, DECISION_FILE, "lifecycle", "disputed");
  const created = byId((await renderChanged(dir)).items, DECISION);
  assert.equal(created?.action, "create");
  await record(dir, created!);
  await setField(dir, DECISION_FILE, "lifecycle", "archived");
  const updated = byId((await renderChanged(dir)).items, DECISION);
  assert.equal(updated?.action, "update", "a note with a page is rendered whatever its lifecycle");
  assert.deepEqual(updated!.properties.Lifecycle, { type: "select", value: "Archived" });
});

test("render: a draft that already has a page keeps being updated until the cleanup (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  await setField(dir, QUESTION_FILE, "summary", "Who owns the relaunched Acme mobile app?");
  const item = byId((await renderChanged(dir)).items, QUESTION);
  assert.equal(item?.action, "update");
});

test("render --unpublish-drafts trashes the Draft pages a Review row still holds, and approval creates a new page (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  // The question is a draft with a page, from before 0.9.1; the decision is a draft with a page too, held by no Review row.
  await setField(dir, DECISION_FILE, "notion", "e3000000-0000-4000-8000-000000000003");
  const row = await reviewRow(dir, [QUESTION]);

  const usage = await run(dir, ["sync", "render", "--unpublish-drafts", "--changed"]);
  assert.equal(usage.json.error.code, "USAGE");

  const result = await run(dir, ["sync", "render", "--unpublish-drafts"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, [{
    id: QUESTION, type: "question", database: "questions", database_id: "a1000000-0000-4000-8000-000000000009",
    page_id: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b", action: "trash", properties: {}, body: null, sections: null,
    pending_relations: [], published: { "@trashed": NOW },
  }], "only the draft a pending Review row lists; the other draft keeps its page");

  const mismatch = await run(dir, ["sync", "record"], { records: [{ id: QUESTION, notion: PAGE, synced_at: NOW, published: { "@trashed": NOW } }] });
  assert.equal(mismatch.json.data.records[0].reason, "NOTION_ID_MISMATCH");
  assert.equal((await attributes(dir, QUESTION_FILE)).notion, "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b", "a mismatch changes nothing");

  await record(dir, result.json.data.items[0]);
  const forgotten = await attributes(dir, QUESTION_FILE);
  assert.equal(forgotten.notion, undefined);
  assert.equal(forgotten.notion_published, undefined);
  assert.equal(forgotten.last_synced, undefined);
  assert.deepEqual(await lintErrors(dir), []);
  assert.equal(byId((await renderChanged(dir)).items, QUESTION), undefined, "still a draft: no page");
  assert.deepEqual((await run(dir, ["sync", "render", "--unpublish-drafts"])).json.data.items, [], "nothing left to clean up");

  await decide(dir, row, "approve");
  const recreated = byId((await renderChanged(dir)).items, QUESTION);
  assert.equal(recreated?.action, "create");
  assert.deepEqual(recreated!.properties.Lifecycle, { type: "select", value: "Reviewed" });
});

test("note new: a decision a connected workflow publishes is written reviewed (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["note", "new"], { notes: [{
    type: "decision", title: "Use Postgres for the event store",
    frontmatter: { summary: "The event store runs on Postgres.", date: "2026-12-09", assessment: "accepted", projects: ["prj-9x4t1b7e"], sources: ["mtg-8c4n2p7w"], workflow: { id: "wf-3k7m2q9c", artifact: "art-5n8p1x4v" } },
    body: "## Decision\nPostgres.\n\n## Context\nApproved in the session.\n\n## Consequences\nNone.\n\n## Sources\n- docs/adr/0001.md\n",
  }] });
  assert.equal(created.code, 0, created.stdout);
  const note = await attributes(dir, created.json.data.created[0].path);
  assert.equal(note.lifecycle, "reviewed");
  assert.equal(byId((await renderChanged(dir)).items, created.json.data.created[0].id)?.action, "create");
});
