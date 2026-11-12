import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

// Edge cases of decision 0071 (0.9.1, CC-125) that reviewed-knowledge.test.ts leaves out: spec/cli.md §5.14.4 and §5.14.6.
const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const DECISION = "dec-7k2m9q4x";
const DECISION_FILE = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const QUESTION = "que-8n3v5x1d";
const QUESTION_FILE = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const QUESTION_PAGE = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";
const DRAFT_PERSON = "per-9t2c6m4a";
const DOCUMENTS_DB = "a1000000-0000-4000-8000-0000000000d1";
const PROMOTED = "ref-2p6k9m3w";
const PLAIN = "ref-5t8c1q4z";

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
const byId = (items: Array<Record<string, any>>, id: string) => items.find((item) => item.id === id);

test("--unpublish-drafts skips a promoted Document and a page already trashed, and selects a plain Document (0049, 0071)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await run(dir, ["config", "set", "notion.databases.documents", `"${DOCUMENTS_DB}"`])).code, 0);
  await writeDocument(dir, PROMOTED, "promoted", "e5000000-0000-4000-8000-000000000001");
  await writeDocument(dir, PLAIN, "whole", "e5000000-0000-4000-8000-000000000002");
  await setField(dir, DECISION_FILE, "notion", "e5000000-0000-4000-8000-000000000003");
  await setField(dir, DECISION_FILE, "notion_published", `{ "@trashed": "2026-12-01T00:00:00Z" }`);
  await reviewRow(dir, [QUESTION, DECISION, PROMOTED, PLAIN]);

  const items = await unpublish(dir);
  assert.deepEqual(ids(items), [PLAIN, QUESTION].sort(), "not the promoted Document, not the trashed decision");
  const plain = byId(items, PLAIN)!;
  assert.equal(plain.action, "trash");
  assert.equal(plain.database, "documents");
  assert.equal(plain.database_id, DOCUMENTS_DB);
  assert.equal(plain.page_id, "e5000000-0000-4000-8000-000000000002");
  assert.deepEqual(plain.published, { "@trashed": NOW });
});

test("--unpublish-drafts skips a draft whose module is off (0048, 0071)", async (context) => {
  const dir = await fixtureCopy(context);
  await reviewRow(dir, [QUESTION]);
  assert.deepEqual(ids(await unpublish(dir)), [QUESTION], "on: selected");
  const off = await run(dir, ["modules", "off", "knowledge"]);
  assert.equal(off.code, 0, off.stdout);
  assert.deepEqual(await unpublish(dir), [], "knowledge off: nothing to clean up");
});

test("--unpublish-drafts only counts a pending Review row; an applied or closed one keeps the page (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  const row = await reviewRow(dir, [QUESTION]);
  assert.deepEqual(ids(await unpublish(dir)), [QUESTION]);
  for (const status of ["applied", "closed"]) {
    await setField(dir, row.path, "status", status);
    assert.deepEqual(await unpublish(dir), [], `a ${status} row no longer brings the draft back`);
  }
  await setField(dir, row.path, "status", "pending");
  assert.deepEqual(ids(await unpublish(dir)), [QUESTION], "pending again: selected again");
});

test("--unpublish-drafts runs alone: --ids and --plan are USAGE (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  await reviewRow(dir, [QUESTION]);
  const withIds = await run(dir, ["sync", "render", "--unpublish-drafts", "--ids", QUESTION]);
  assert.equal(withIds.json.error.code, "USAGE");
  assert.notEqual(withIds.code, 0);
  const withPlan = await run(dir, ["sync", "render", "--unpublish-drafts", "--plan", join(dir, "..", "plan.json")]);
  assert.equal(withPlan.json.error.code, "USAGE");
  assert.notEqual(withPlan.code, 0);
});

test("sync record: a trash record for a knowledge note with no page fails NOTION_ID_MISMATCH and changes nothing (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await attributes(dir, DECISION_FILE)).notion, undefined, "the fixture decision has no page");
  const before = await readFile(join(dir, DECISION_FILE), "utf8");
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: DECISION, notion: QUESTION_PAGE, synced_at: NOW, published: { "@trashed": NOW } }] });
  assert.equal(recorded.code, 1, recorded.stdout);
  assert.equal(recorded.json.data.records[0].result, "failed");
  assert.equal(recorded.json.data.records[0].reason, "NOTION_ID_MISMATCH");
  assert.equal(await readFile(join(dir, DECISION_FILE), "utf8"), before);
});

test("render: a reviewed decision whose database id is empty creates no page and leaves its meeting no waiting item (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await run(dir, ["config", "set", "notion.databases.decisions", `""`])).code, 0);
  await setField(dir, DECISION_FILE, "lifecycle", "reviewed");
  const result = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(result.code, 0, result.stdout);
  const items: Array<Record<string, any>> = result.json.data.items;
  assert.equal(byId(items, DECISION), undefined, "nothing to create it in");
  assert.ok(result.json.warnings.some((warning: { code: string; id?: string }) => warning.code === "DATABASE_NOT_CONFIGURED" && warning.id === DECISION));
  // A page with news of its own is still an update (and still lists the reviewed decision as not yet published, as it lists any note without a page);
  // what must not appear is the empty-properties item that only waits for a page this render creates.
  for (const item of items) {
    const waitingOnly = Object.keys(item.properties).length === 0 && item.pending_relations.length > 0;
    assert.ok(!waitingOnly, `${item.id} is returned only to wait for a page that is never created`);
  }
  assert.deepEqual(byId(items, SYNC)?.properties.Decisions?.value ?? [], [], "no page to link");
});

test("render --ids: a draft decision is skipped NOT_REVIEWED while a draft person renders, exit code 0 (0071)", async (context) => {
  const dir = await fixtureCopy(context);
  const result = await run(dir, ["sync", "render", "--ids", `${DECISION},${DRAFT_PERSON}`]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items.map((item: { id: string; action: string }) => [item.id, item.action]), [[DRAFT_PERSON, "create"]]);
  assert.deepEqual(result.json.data.skipped, [{ id: DECISION, reason: "NOT_REVIEWED" }]);
  assert.deepEqual(result.json.data.errors, []);
});
