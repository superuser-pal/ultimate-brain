import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

// Decision 0071 (0.9.1, CC-125): Notion shows reviewed knowledge. A concept or Document gets its page once it is reviewed; until then
// it lives only in its Review row (spec/cli.md §5.14.4). Since 0.16.0 a decision or question gets no page at all (0099).
const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const DECISION = "dec-7k2m9q4x";
const DECISION_FILE = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const DOC = "con-1s6t8e2b"; // "Row-level security": a draft reference, a Document once the Documents database is set
const DOC_FILE = "knowledge/references/row-level-security.md";
const DOCUMENTS = "a1000000-0000-4000-8000-00000000000c";
const DRAFT_PERSON = "per-9t2c6m4a";
const DRAFT_PERSON_FILE = "knowledge/people/carlos-ruiz.md";
const PAGE = "e1000000-0000-4000-8000-000000000001";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
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

/** The fixture copy with the Documents database set, so a reference has a database to go to. */
async function documentsBrain(context: Parameters<typeof fixtureCopy>[0]): Promise<string> {
  const dir = await fixtureCopy(context);
  const set = await brain(["config", "set", "notion.databases.documents", JSON.stringify(DOCUMENTS), "--brain", dir, "--json"]);
  assert.equal(set.code, 0, set.stdout);
  return dir;
}

const byId = (items: Array<Record<string, any>>, id: string) => items.find((item) => item.id === id);

test("render: a draft Document gets no page and is skipped NOT_REVIEWED; a decision gets none whatever its lifecycle (0071, 0099)", async (context) => {
  const dir = await documentsBrain(context);
  const data = await renderChanged(dir);
  assert.equal(byId(data.items, DOC), undefined, "a draft Document is not created");
  for (const item of data.items) {
    for (const pending of item.pending_relations) assert.ok(!pending.ids.includes(DOC), `${item.id} lists the draft in pending_relations`);
  }
  // --ids skips the draft Document and the decision while a draft person renders, and still exits 0.
  const ids = await run(dir, ["sync", "render", "--ids", `${DOC},${DECISION},${DRAFT_PERSON}`]);
  assert.equal(ids.code, 0, ids.stdout);
  assert.deepEqual(ids.json.data.items.map((item: { id: string; action: string }) => [item.id, item.action]), [[DRAFT_PERSON, "create"]]);
  assert.deepEqual(ids.json.data.skipped, [{ id: DOC, reason: "NOT_REVIEWED" }, { id: DECISION, reason: "NO_DATABASE" }]);
  assert.deepEqual(ids.json.data.errors, []);

  await setField(dir, DECISION_FILE, "lifecycle", "reviewed");
  assert.equal(byId((await renderChanged(dir)).items, DECISION), undefined, "a reviewed decision has no database to go to");
  assert.deepEqual((await run(dir, ["sync", "render", "--ids", DECISION])).json.data.skipped, [{ id: DECISION, reason: "NO_DATABASE" }]);
});

test("render: approving the draft publishes it in the next run (0071)", async (context) => {
  const dir = await documentsBrain(context);
  // Publish what is publishable, as an earlier run did, so only the approval is news.
  let next = 0;
  for (let round = 0; round < 3; round += 1) {
    for (const item of (await renderChanged(dir)).items) if (item.action !== "trash") await record(dir, item, item.page_id ?? `e1000000-0000-4000-8000-${String((next += 1)).padStart(12, "0")}`);
  }
  assert.deepEqual((await renderChanged(dir)).items, [], "everything publishable is published");
  const row = await reviewRow(dir, [DOC]);
  await decide(dir, row, "approve");
  assert.equal((await attributes(dir, DOC_FILE)).lifecycle, "reviewed");

  const created = byId((await renderChanged(dir)).items, DOC);
  assert.equal(created?.action, "create");
  assert.deepEqual(created!.properties.Lifecycle, { type: "select", value: "Reviewed" });
  await record(dir, created!, "e2000000-0000-4000-8000-000000000002");
  assert.equal(byId((await renderChanged(dir)).items, DOC), undefined, "published once");
  assert.deepEqual(await lintErrors(dir), []);
});

test("render: a draft person still gets its page (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  await setField(dir, DRAFT_PERSON_FILE, "notion", null);
  assert.equal((await attributes(dir, DRAFT_PERSON_FILE)).lifecycle, "draft");
  const person = byId((await renderChanged(dir)).items, DRAFT_PERSON);
  assert.equal(person?.action, "create");
  assert.deepEqual(person!.properties.Lifecycle, { type: "select", value: "Draft" });
});

test("render: a disputed Document is created and keeps its page; an archived page stays as history (0071)", async (context) => {
  const dir = await documentsBrain(context);
  await setField(dir, DOC_FILE, "lifecycle", "disputed");
  const created = byId((await renderChanged(dir)).items, DOC);
  assert.equal(created?.action, "create");
  await record(dir, created!);
  await setField(dir, DOC_FILE, "lifecycle", "archived");
  const updated = byId((await renderChanged(dir)).items, DOC);
  assert.equal(updated?.action, "update", "a note with a page is rendered whatever its lifecycle");
  assert.deepEqual(updated!.properties.Lifecycle, { type: "select", value: "Archived" });
});

test("render --unpublish-drafts trashes the Draft pages a Review row still holds, and approval creates a new page (0071)", async (context) => {
  const dir = await documentsBrain(context);
  // Two draft Documents with a page from before 0.9.1: one a pending Review row lists, one held by no row.
  const other = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Auth providers compared", frontmatter: { summary: "Three providers side by side.", origin: "learned", sources: [SYNC] }, body: "Supabase, Firebase and Auth0.\n" }] });
  assert.equal(other.code, 0, other.stdout);
  await setField(dir, other.json.data.created[0].path, "notion", "e3000000-0000-4000-8000-000000000003");
  const held = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
  await setField(dir, DOC_FILE, "notion", held);
  const row = await reviewRow(dir, [DOC]);

  const usage = await run(dir, ["sync", "render", "--unpublish-drafts", "--changed"]);
  assert.equal(usage.json.error.code, "USAGE");

  const result = await run(dir, ["sync", "render", "--unpublish-drafts"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, [{
    id: DOC, type: "reference", database: "documents", database_id: DOCUMENTS,
    page_id: held, action: "trash", properties: {}, body: null, sections: null,
    pending_relations: [], published: { "@trashed": NOW },
  }], "only the draft a pending Review row lists; the other draft keeps its page");

  const mismatch = await run(dir, ["sync", "record"], { records: [{ id: DOC, notion: PAGE, synced_at: NOW, published: { "@trashed": NOW } }] });
  assert.equal(mismatch.json.data.records[0].reason, "NOTION_ID_MISMATCH");
  assert.equal((await attributes(dir, DOC_FILE)).notion, held, "a mismatch changes nothing");

  await record(dir, result.json.data.items[0]);
  const forgotten = await attributes(dir, DOC_FILE);
  assert.equal(forgotten.notion, undefined);
  assert.equal(forgotten.notion_published, undefined);
  assert.equal(forgotten.last_synced, undefined);
  assert.deepEqual(await lintErrors(dir), []);
  assert.equal(byId((await renderChanged(dir)).items, DOC), undefined, "still a draft: no page");
  assert.deepEqual((await run(dir, ["sync", "render", "--unpublish-drafts"])).json.data.items, [], "nothing left to clean up");

  await decide(dir, row, "approve");
  const recreated = byId((await renderChanged(dir)).items, DOC);
  assert.equal(recreated?.action, "create");
  assert.deepEqual(recreated!.properties.Lifecycle, { type: "select", value: "Reviewed" });
});

test("note new: a decision a connected workflow publishes is written reviewed, and gets no page (0071, 0099)", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["note", "new"], { notes: [{
    type: "decision", title: "Use Postgres for the event store",
    frontmatter: { summary: "The event store runs on Postgres.", date: "2026-12-09", assessment: "accepted", projects: ["prj-9x4t1b7e"], sources: ["mtg-8c4n2p7w"], workflow: { id: "wf-3k7m2q9c", artifact: "art-5n8p1x4v" } },
    body: "## Decision\nPostgres.\n\n## Context\nApproved in the session.\n\n## Consequences\nNone.\n\n## Sources\n- docs/adr/0001.md\n",
  }] });
  assert.equal(created.code, 0, created.stdout);
  const note = await attributes(dir, created.json.data.created[0].path);
  assert.equal(note.lifecycle, "reviewed");
  assert.equal(byId((await renderChanged(dir)).items, created.json.data.created[0].id), undefined);
});
