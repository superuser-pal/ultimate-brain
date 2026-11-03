import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { excludableDecision, INPUT } from "./exclusion-fixture.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const PAGE = "6a7b0000-0000-4000-8000-0000000000bb";

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}
async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  if (args[0] === "sync" && args[1] === "apply") settle(dir);
  const extra: string[] = [];
  if (input !== undefined) { const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`); await writeFile(file, JSON.stringify(input)); extra.push("--input", file); }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}
const attributes = async (dir: string, path: string) => parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes as Record<string, any>;
const decide = (body: string, itemId: string, token: string) => body.replace(new RegExp(`(## \\[[a-z]+ · ${itemId}\\][\\s\\S]*?\\nDecision: )Pending`), `$1${token}`);

/** A cleanup row for an input whose second version dropped the paragraph a decision rests on, published and ready to decide. */
async function setup(dir: string, withLive: boolean | "unmapped", reinclude = false) {
  const { note, exclude, reinclude: back } = await excludableDecision(dir, SYNC, PROJECT, withLive);
  await exclude();
  if (reinclude) await back();
  const proposed = await run(dir, ["source", "cleanup-propose", "--page", INPUT]);
  assert.equal(proposed.code, 0, proposed.stdout);
  assert.equal(proposed.json.data.result, "WRITTEN", proposed.stdout);
  const id = proposed.json.data.proposal as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.ok(item, "the row renders");
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: PAGE, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  const ids = [...(item.body as string).matchAll(/^## \[[a-z]+ · (it-[0-9a-z]{8})\]/gm)].map((m) => m[1]!);
  return { note, id, body: item.body as string, ids };
}
async function submit(dir: string, id: string, body: string) {
  const row = { database: "review", page_id: PAGE, last_edited: AFTER, properties: { "Brain ID": id, State: "Pending" }, review: { decided: true, decided_at: NOW, accept_all: false, page_edited_at: NOW, body_markdown: body } };
  const plan = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row] }, AFTER)).json.data;
  for (const decision of plan.review_decisions) for (const item of decision.items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  const applied = await run(dir, ["sync", "apply"], plan, AFTER);
  return { plan, applied, results: (applied.json.data?.review_results ?? []) as Array<{ item_id: string; result: string; reason?: string }> };
}

test("Remove drops the excluded lines, marks the note independent and reconciles the suppression; the row is journaled and committed", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, body, ids } = await setup(dir, true);
  assert.equal(ids.length, 1);
  assert.ok(body.includes("SECRET") && body.includes("Kept statement"), "the page shows what goes and what stays");
  const { results, applied } = await submit(dir, id, decide(body, ids[0]!, "Accept"));
  assert.deepEqual(results.map((entry) => entry.result), ["applied"], applied.stdout);
  const text = await readFile(join(dir, note.path), "utf8");
  assert.ok(!text.includes("SECRET") && text.includes("Kept statement"));
  assert.deepEqual((await attributes(dir, note.path)).lineage_cleared, [INPUT]);
  const file = JSON.parse(await readFile(join(dir, "_suppressions", `${INPUT}.json`), "utf8"));
  assert.equal(file.records[0].status, "reconciled");
  assert.ok(file.records[0].reconciled_at);
  assert.match(git(dir, "log", "-1", "--format=%B"), /Op: op-/);
  assert.equal(git(dir, "status", "--porcelain").trim(), "");
  assert.equal((await run(dir, ["source", "cleanup-propose", "--page", INPUT])).json.data.result, "NOTHING_TO_CLEAN");
});

test("an edited Remove that still holds an excluded statement is refused and changes nothing; a rejected one releases nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, body, ids } = await setup(dir, true);
  const before = await readFile(join(dir, note.path), "utf8");
  const stuck = decide(body, ids[0]!, "Accept").replace(/(Proposed final wording<\/summary>[\s\S]*?)(\n<\/details>)/, `$1\n\nSECRET Pricing was 95k. ^[src-ex1a3b4c#¶2:${before.match(/¶2:([0-9a-f]{8})/)![1]}]$2`);
  const refused = await submit(dir, id, stuck);
  assert.deepEqual(refused.results.map((entry) => [entry.result, entry.reason]), [["skipped", "STILL_RESTRICTED"]], refused.applied.stdout);
  assert.equal(await readFile(join(dir, note.path), "utf8"), before);
  const rejected = await submit(dir, id, decide(body, ids[0]!, "Reject"));
  assert.deepEqual(rejected.results.map((entry) => entry.result), ["closed"]);
  assert.equal(await readFile(join(dir, note.path), "utf8"), before, "Reject leaves the note as it was");
  assert.equal(JSON.parse(await readFile(join(dir, "_suppressions", `${INPUT}.json`), "utf8")).records[0].status, "active", "a rejected row resolves nothing");
});

test("Defer is not supported on a cleanup item: it stays pending", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await setup(dir, true);
  const { plan, results } = await submit(dir, id, decide(body, ids[0]!, "Defer"));
  assert.equal(results.length, 0);
  assert.ok(plan.review_held.some((held: { reason: string }) => held.reason === "DEFER_NOT_SUPPORTED"));
});

test("a note whose text cannot be tied to a passage asks Keep or Remove: Keep records lineage_cleared, Remove archives", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, body, ids } = await setup(dir, "unmapped");
  assert.match(body, /Is this note independent of/);
  const kept = await submit(dir, id, decide(body, ids[0]!, "Accept").replace(/(Proposed final wording<\/summary>\s*)Remove/, "$1Keep"));
  assert.deepEqual(kept.results.map((entry) => entry.result), ["applied"], kept.applied.stdout);
  assert.deepEqual((await attributes(dir, note.path)).lineage_cleared, [INPUT]);
  assert.notEqual((await attributes(dir, note.path)).lifecycle, "archived");
});

test("a paragraph a later version holds again waits for Restore: accepting it writes a Restore record for that note and passage only", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, body, ids } = await setup(dir, true, true);
  assert.equal(ids.length, 2, "one Remove and one Restore");
  const restoreId = ids[1]!;
  assert.match(body.slice(body.indexOf(restoreId)), /holds this paragraph again/);
  const { results, applied } = await submit(dir, id, decide(body, restoreId, "Accept"));
  assert.deepEqual(results.map((entry) => entry.result), ["applied"], applied.stdout);
  const file = JSON.parse(await readFile(join(dir, "_suppressions", `${INPUT}.json`), "utf8"));
  const restore = file.records.find((record: { kind?: string }) => record.kind === "restore");
  assert.deepEqual([restore.extract_version, restore.items], [3, [{ note: note.id, n: 2 }]]);
  assert.equal((await run(dir, ["source", "cleanup-plan", "--page", INPUT])).json.data.restore.length, 0, "nothing waits for Restore any more");
  const again = await submit(dir, id, decide(body, restoreId, "Accept"));
  assert.deepEqual(again.results, [], "applying again is a no-op");
  assert.equal(JSON.parse(await readFile(join(dir, "_suppressions", `${INPUT}.json`), "utf8")).records.filter((record: { kind?: string }) => record.kind === "restore").length, 1);
});

test("Remove on an independence item archives the note, resolves it and reconciles the record; the cleanup is not proposed again", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, body, ids } = await setup(dir, "unmapped");
  const { results } = await submit(dir, id, decide(body, ids[0]!, "Accept"));
  assert.deepEqual(results.map((entry) => entry.result), ["applied"]);
  assert.equal((await attributes(dir, note.path)).lifecycle, "archived");
  assert.equal(JSON.parse(await readFile(join(dir, "_suppressions", `${INPUT}.json`), "utf8")).records[0].status, "reconciled");
  assert.equal((await run(dir, ["source", "cleanup-propose", "--page", INPUT])).json.data.result, "NOTHING_TO_CLEAN");
});
