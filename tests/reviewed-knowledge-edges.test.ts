import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

// Edge cases of decision 0071 (0.9.1, CC-125) that reviewed-knowledge.test.ts leaves out: spec/cli.md §5.14.4 and §5.14.6.
// Since 0.16.0 a decision or question has no page (0099): the cases run on Documents, and a decision or question is never selected.
const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const DECISION = "dec-7k2m9q4x";
const DECISION_FILE = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const QUESTION = "que-8n3v5x1d";
const QUESTION_FILE = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const QUESTION_PAGE = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const DOCUMENTS_DB = "a1000000-0000-4000-8000-0000000000d1";
const PROMOTED = "ref-2p6k9m3w";
const PLAIN = "ref-5t8c1q4z";
const TRASHED = "ref-7w3n6d2k";
const DOC = "con-1s6t8e2b"; // the fixture's draft reference, with no page
const DOC_FILE = "knowledge/references/row-level-security.md";

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

/** Sets a top-level scalar of a note's frontmatter, or drops the key with `null`. */
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

/** A draft Document with a page, as a 0.9.0 brain holds one. */
async function writeDocument(dir: string, id: string, origin: "promoted" | "whole", page: string): Promise<void> {
  await mkdir(join(dir, "knowledge", "references"), { recursive: true });
  await writeFile(join(dir, "knowledge", "references", `${id}.md`), [
    "---", `id: ${id}`, "type: reference", `title: Edge document ${id}`, "summary: A synthetic document.", "lifecycle: draft", `origin: ${origin}`,
    ...(origin === "promoted" ? [`promoted_from: ${DECISION}`] : []),
    "created: 2026-12-03", "updated: 2026-12-03", `notion: ${page}`, "---", "", "Synthetic body.", ""].join("\n"));
}

async function reviewRow(dir: string, notes: string[]): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes }] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0];
}

const unpublish = async (dir: string) => {
  const result = await run(dir, ["sync", "render", "--unpublish-drafts"]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data.items as Array<Record<string, any>>;
};
const ids = (items: Array<Record<string, any>>) => items.map((item) => item.id).sort();
/** The fixture copy with the Documents database set. */
async function documentsBrain(context: Parameters<typeof fixtureCopy>[0]): Promise<string> {
  const dir = await fixtureCopy(context);
  assert.equal((await run(dir, ["config", "set", "notion.databases.documents", `"${DOCUMENTS_DB}"`])).code, 0);
  return dir;
}

const byId = (items: Array<Record<string, any>>, id: string) => items.find((item) => item.id === id);

test("--unpublish-drafts skips a promoted Document and a page already trashed, and selects a plain Document; a decision or question is never selected (0049, 0071, 0099)", async (context) => {
  const dir = await documentsBrain(context);
  await writeDocument(dir, PROMOTED, "promoted", "e5000000-0000-4000-8000-000000000001");
  await writeDocument(dir, PLAIN, "whole", "e5000000-0000-4000-8000-000000000002");
  await writeDocument(dir, TRASHED, "whole", "e5000000-0000-4000-8000-000000000003");
  await setField(dir, `knowledge/references/${TRASHED}.md`, "notion_published", `{ "@trashed": "2026-12-01T00:00:00Z" }`);
  // The fixture's draft question has a page from before 0.16.0: still not selected.
  assert.equal((await attributes(dir, QUESTION_FILE)).notion, QUESTION_PAGE);
  await reviewRow(dir, [QUESTION, DECISION, PROMOTED, PLAIN, TRASHED]);

  const items = await unpublish(dir);
  assert.deepEqual(ids(items), [PLAIN], "not the promoted Document, not the trashed one, not the question or decision");
  const plain = byId(items, PLAIN)!;
  assert.equal(plain.action, "trash");
  assert.equal(plain.database, "documents");
  assert.equal(plain.database_id, DOCUMENTS_DB);
  assert.equal(plain.page_id, "e5000000-0000-4000-8000-000000000002");
  assert.deepEqual(plain.published, { "@trashed": NOW });
});

test("--unpublish-drafts skips a draft whose module is off (0048, 0071)", async (context) => {
  const dir = await documentsBrain(context);
  await writeDocument(dir, PLAIN, "whole", "e5000000-0000-4000-8000-000000000002");
  await reviewRow(dir, [PLAIN]);
  assert.deepEqual(ids(await unpublish(dir)), [PLAIN], "on: selected");
  const off = await run(dir, ["modules", "off", "documents"]);
  assert.equal(off.code, 0, off.stdout);
  assert.deepEqual(await unpublish(dir), [], "Documents off: nothing to clean up");
});

test("--unpublish-drafts only counts a pending Review row; an applied or closed one keeps the page (0071)", async (context) => {
  const dir = await documentsBrain(context);
  await writeDocument(dir, PLAIN, "whole", "e5000000-0000-4000-8000-000000000002");
  const row = await reviewRow(dir, [PLAIN]);
  assert.deepEqual(ids(await unpublish(dir)), [PLAIN]);
  for (const status of ["applied", "closed"]) {
    await setField(dir, row.path, "status", status);
    assert.deepEqual(await unpublish(dir), [], `a ${status} row no longer brings the draft back`);
  }
  await setField(dir, row.path, "status", "pending");
  assert.deepEqual(ids(await unpublish(dir)), [PLAIN], "pending again: selected again");
});

test("sync record: a trash record for a Document with no page fails NOTION_ID_MISMATCH and changes nothing (0071)", async (context) => {
  const dir = await documentsBrain(context);
  assert.equal((await attributes(dir, DOC_FILE)).notion, undefined, "the fixture reference has no page");
  const before = await readFile(join(dir, DOC_FILE), "utf8");
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: DOC, notion: QUESTION_PAGE, synced_at: NOW, published: { "@trashed": NOW } }] });
  assert.equal(recorded.code, 1, recorded.stdout);
  assert.equal(recorded.json.data.records[0].result, "failed");
  assert.equal(recorded.json.data.records[0].reason, "NOTION_ID_MISMATCH");
  assert.equal(await readFile(join(dir, DOC_FILE), "utf8"), before);
});

test("render: a reviewed Document whose database id is empty creates no page and leaves no item that only waits for it (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await run(dir, ["config", "set", "notion.databases.documents", `""`])).code, 0);
  await setField(dir, DOC_FILE, "lifecycle", "reviewed");
  const result = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(result.code, 0, result.stdout);
  const items: Array<Record<string, any>> = result.json.data.items;
  assert.equal(byId(items, DOC), undefined, "nothing to create it in");
  assert.ok(result.json.warnings.some((warning: { code: string; id?: string }) => warning.code === "DATABASE_NOT_CONFIGURED" && warning.id === DOC), JSON.stringify(result.json.warnings));
  // A page with news of its own is still an update; what must not appear is the empty-properties item that only waits for a page this render creates.
  for (const item of items) {
    const waitingOnly = Object.keys(item.properties).length === 0 && item.pending_relations.length > 0;
    assert.ok(!waitingOnly, `${item.id} is returned only to wait for a page that is never created`);
  }
});
