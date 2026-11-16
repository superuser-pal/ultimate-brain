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

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}
async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  if (args[0] === "apply") settle(dir);
  const extra: string[] = [];
  if (input !== undefined) { const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`); await writeFile(file, JSON.stringify(input)); extra.push("--input", file); }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}
const attributes = async (dir: string, path: string) => parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes as Record<string, any>;
const records = async (dir: string) => JSON.parse(await readFile(join(dir, "_suppressions", `${INPUT}.json`), "utf8")).records as Array<Record<string, any>>;

/** A cleanup proposal for an input whose second version dropped the paragraph a decision rests on, waiting to be decided in the session. */
async function setup(dir: string, withLive: boolean | "unmapped", reinclude = false) {
  const { note, exclude, reinclude: back } = await excludableDecision(dir, SYNC, PROJECT, withLive);
  await exclude();
  if (reinclude) await back();
  const proposed = await run(dir, ["source", "cleanup-propose", "--page", INPUT]);
  assert.equal(proposed.code, 0, proposed.stdout);
  assert.equal(proposed.json.data.result, "WRITTEN", proposed.stdout);
  const id = proposed.json.data.proposal as string;
  const path = proposed.json.data.path as string;
  const items = (await attributes(dir, path)).items as Array<{ item_id: string; kind: string }>;
  return { note, id, path, items, ids: items.map((item) => item.item_id) };
}
/** One decision given in the session, applied by `brain apply` (cli §5.7). */
async function decide(dir: string, id: string, decision: Record<string, unknown>) {
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: id, decided_at: AFTER, decided_by: "chat", ...decision }] }, AFTER);
  return { applied, result: applied.json.data.decisions[0] as Record<string, any> };
}

test("cleanup approve: a Remove drops the excluded lines, marks the note independent and reconciles the input in the same operation", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, path, ids } = await setup(dir, true);
  assert.equal(ids.length, 1);
  const { applied, result } = await decide(dir, id, { action: "approve" });
  assert.equal(result.result, "applied", applied.stdout);
  assert.equal(result.reconciled, true);
  const text = await readFile(join(dir, note.path), "utf8");
  assert.ok(!text.includes("SECRET") && text.includes("Kept statement"));
  assert.deepEqual((await attributes(dir, note.path)).lineage_cleared, [INPUT]);
  const [record] = await records(dir);
  assert.equal(record!.status, "reconciled");
  assert.equal(record!.reconciled_at, AFTER);
  const proposal = await attributes(dir, path);
  assert.equal(proposal.status, "applied");
  assert.deepEqual(proposal.item_decisions, [{ item_id: ids[0], decided_at: AFTER, decided_by: "chat", decision: "accept" }]);
  assert.equal((await run(dir, ["source", "cleanup-propose", "--page", INPUT])).json.data.result, "NOTHING_TO_CLEAN");
});

test("cleanup fix: a Remove text that still holds an excluded statement fails STILL_RESTRICTED and changes nothing; the user's own text applies", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, path, ids } = await setup(dir, true);
  const before = await readFile(join(dir, note.path), "utf8");
  const stuck = `Kept statement.\n\nSECRET Pricing was 95,000. ^[src-ex1a3b4c#¶2:${before.match(/¶2:([0-9a-f]{8})/)![1]}]`;
  const refused = await decide(dir, id, { action: "fix", note: "keep the pricing line", fixes: [{ item: ids[0], value: stuck }] });
  assert.deepEqual([refused.result.result, refused.result.reason], ["failed", "STILL_RESTRICTED"], refused.applied.stdout);
  assert.equal(await readFile(join(dir, note.path), "utf8"), before);
  assert.equal((await attributes(dir, path)).status, "pending");
  const own = "Kept statement, in my words.";
  const fixed = await decide(dir, id, { action: "fix", note: "say it in my words", fixes: [{ item: ids[0], value: own }] });
  assert.equal(fixed.result.result, "applied", fixed.applied.stdout);
  assert.match(await readFile(join(dir, note.path), "utf8"), /Kept statement, in my words\./);
  assert.equal((await attributes(dir, path)).item_decisions[0].edited, true);
});

test("cleanup reject: turning the proposal down changes nothing and releases nothing; exclude is refused, a cleanup item has no defer", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, ids } = await setup(dir, true);
  const before = await readFile(join(dir, note.path), "utf8");
  const later = await decide(dir, id, { action: "approve", exclude: [{ change: 0 }] });
  assert.deepEqual([later.result.result, later.result.reason], ["failed", "INPUT_INVALID"], later.applied.stdout);
  const wrong = await decide(dir, id, { action: "fix", note: "x", fixes: [{ change: 0, value: "x" }] });
  assert.deepEqual([wrong.result.result, wrong.result.reason], ["failed", "FIX_UNKNOWN"]);
  const both = await decide(dir, id, { action: "fix", note: "x", fixes: [{ item: ids[0], value: "x" }], reject: [{ item: ids[0] }] });
  assert.deepEqual([both.result.result, both.result.reason], ["failed", "INPUT_INVALID"]);
  const { result } = await decide(dir, id, { action: "reject" });
  assert.equal(result.result, "closed");
  assert.equal(await readFile(join(dir, note.path), "utf8"), before, "Reject leaves the note as it was");
  assert.equal((await records(dir))[0]!.status, "active", "a rejected cleanup resolves nothing");
});

test("cleanup fix of an independence item: Keep records lineage_cleared; any other word is INVALID_RESULT", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, ids, items } = await setup(dir, "unmapped");
  assert.equal(items[0]!.kind, "independence");
  const odd = await decide(dir, id, { action: "fix", note: "maybe", fixes: [{ item: ids[0], value: "Maybe" }] });
  assert.deepEqual([odd.result.result, odd.result.reason], ["failed", "INVALID_RESULT"]);
  const kept = await decide(dir, id, { action: "fix", note: "keep it", fixes: [{ item: ids[0], value: "keep" }] });
  assert.equal(kept.result.result, "applied", kept.applied.stdout);
  assert.deepEqual((await attributes(dir, note.path)).lineage_cleared, [INPUT]);
  assert.notEqual((await attributes(dir, note.path)).lifecycle, "archived");
});

test("cleanup approve of an independence item archives the note and reconciles the record; the cleanup is not proposed again", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id } = await setup(dir, "unmapped");
  const { result } = await decide(dir, id, { action: "approve" });
  assert.equal(result.result, "applied");
  assert.equal(result.reconciled, true);
  assert.equal((await attributes(dir, note.path)).lifecycle, "archived");
  assert.equal((await records(dir))[0]!.status, "reconciled");
  assert.equal((await run(dir, ["source", "cleanup-propose", "--page", INPUT])).json.data.result, "NOTHING_TO_CLEAN");
});

test("cleanup approve with one item turned down: the Restore record is written for that note and passage, the turned-down Remove changes nothing, and the restored paragraph leaves nothing restricted", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, id, path, items } = await setup(dir, true, true);
  assert.deepEqual(items.map((item) => item.kind), ["remove", "restore"]);
  const before = await readFile(join(dir, note.path), "utf8");
  const fixRestore = await decide(dir, id, { action: "fix", note: "x", fixes: [{ item: items[1]!.item_id, value: "Restore" }] });
  assert.deepEqual([fixRestore.result.result, fixRestore.result.reason], ["failed", "INVALID_RESULT"], "a restore takes no fix");
  const { applied, result } = await decide(dir, id, { action: "approve", reject: [{ item: items[0]!.item_id }] });
  assert.equal(result.result, "applied", applied.stdout);
  assert.equal(result.reconciled, true, "the only restricted paragraph is restored, so nothing is left restricted by the input");
  assert.equal(await readFile(join(dir, note.path), "utf8"), before);
  const file = await records(dir);
  const restore = file.find((record) => record.kind === "restore")!;
  assert.deepEqual([restore.extract_version, restore.items], [3, [{ note: note.id, n: 2 }]]);
  assert.equal(file.find((record) => record.kind !== "restore")!.status, "reconciled");
  assert.deepEqual((await attributes(dir, path)).item_decisions.map((entry: { decision: string }) => entry.decision), ["reject", "accept"]);
  assert.equal((await run(dir, ["source", "cleanup-plan", "--page", INPUT])).json.data.restore.length, 0, "nothing waits for Restore any more");
});
