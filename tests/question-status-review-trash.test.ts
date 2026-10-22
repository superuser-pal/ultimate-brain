import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

// Decision 0045 (0.4.1): questions reach Notion as Open, and decided Review rows leave Notion after 30 days.
const QUESTION_FILE = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const QUESTION = "que-8n3v5x1d";
const APPLIED = "prp-4n8c2w7t"; // applied, decided 2026-12-04T08:15:00Z
const PENDING = "prp-9d3f7h2k";

async function run(dir: string, args: string[], now: string, input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

async function rendered(dir: string, ids: string[], now = "2026-12-10T09:00:00Z"): Promise<Array<Record<string, any>>> {
  const result = await run(dir, ["sync", "render", "--ids", ids.join(",")], now);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data.items;
}

async function record(dir: string, item: Record<string, any>, now = "2026-12-10T09:00:00Z"): Promise<void> {
  const recorded = await run(dir, ["sync", "record"], now, { records: [{ id: item.id, notion: item.page_id ?? "e1000000-0000-4000-8000-000000000001", synced_at: now, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
}

async function lintErrors(dir: string): Promise<unknown[]> {
  const lint = await run(dir, ["lint"], "2026-12-10T09:00:00Z");
  return lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

/** Edits the question's frontmatter in the fixture copy: drops the given top-level keys (and their indented children), or sets Status. */
async function editQuestion(dir: string, { drop = [] as string[], status }: { drop?: string[]; status?: string }): Promise<void> {
  const path = join(dir, QUESTION_FILE);
  const lines = (await readFile(path, "utf8")).split("\n");
  const kept: string[] = []; let skipping = false;
  for (const line of lines) {
    if (/^\S/.test(line)) skipping = drop.some((key) => line.startsWith(`${key}:`));
    if (!skipping) kept.push(status !== undefined && /^  status: /.test(line) ? `  status: ${status}` : line);
  }
  await writeFile(path, kept.join("\n"));
}

test("render: a new question is created with Status Open (0045)", async (context) => {
  const dir = await fixtureCopy(context);
  await editQuestion(dir, { drop: ["notion", "notion_fields"] });
  const [item] = await rendered(dir, [QUESTION]);
  assert.equal(item!.action, "create");
  assert.deepEqual(item!.properties.Status, { type: "select", value: "Open" });
  assert.deepEqual(await lintErrors(dir), []);
});

test("render: a published question with no Status of yours gets Open once (0045)", async (context) => {
  const dir = await fixtureCopy(context);
  await editQuestion(dir, { drop: ["notion_fields"] });
  const [first] = await rendered(dir, [QUESTION]);
  assert.equal(first!.action, "update");
  assert.deepEqual(first!.properties.Status, { type: "select", value: "Open" });
  await record(dir, first!);
  const [second] = await rendered(dir, [QUESTION]);
  assert.equal(second?.properties.Status, undefined, "Open goes out once");
  assert.deepEqual(await lintErrors(dir), []);
});

test("render: a Status you set is never overwritten (0045)", async (context) => {
  const dir = await fixtureCopy(context);
  await editQuestion(dir, { status: "Dropped" });
  const [item] = await rendered(dir, [QUESTION]);
  assert.equal(item?.properties.Status, undefined);
});

test("render: a Review row decided more than 30 days ago is trashed once (0045)", async (context) => {
  const dir = await fixtureCopy(context);
  const [published] = await rendered(dir, [APPLIED]);
  await record(dir, published!);
  assert.deepEqual(await rendered(dir, [APPLIED], "2027-01-02T08:15:00Z"), [], "29 days after the decision: nothing");
  const items = await rendered(dir, [APPLIED, PENDING], "2027-01-04T08:16:00Z");
  assert.notEqual(items.find((entry) => entry.id === PENDING)?.action, "trash", "a pending row stays");
  const item = items.find((entry) => entry.id === APPLIED);
  assert.equal(item!.action, "trash");
  assert.equal(item!.page_id, "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f");
  assert.deepEqual(item!.properties, {});
  assert.deepEqual(item!.published, { "@trashed": "2027-01-04T08:16:00Z" });
  await record(dir, item!, "2027-01-04T08:16:00Z");
  assert.deepEqual(await rendered(dir, [APPLIED], "2027-02-01T00:00:00Z"), [], "a trashed row is never rendered again");
  const changed = await run(dir, ["sync", "render", "--changed"], "2027-02-01T00:00:00Z");
  assert.equal(changed.json.data.items.some((entry: { id: string }) => entry.id === APPLIED), false);
  assert.deepEqual(await lintErrors(dir), []);
});
