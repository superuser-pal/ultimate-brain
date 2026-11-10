import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { passageHash } from "../src/lib/selection.ts";
import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const SECRET = "Pricing was 95k.";
const EXCLUDED_LINE = `The price was 95k. ^[src-ex1a3b4c#¶2:${passageHash(SECRET)}]`;
const LIVE_LINE = `A kept remark. ^[src-ex1a3b4c#¶1:${passageHash("A live paragraph.")}]`;

async function run(dir: string, args: string[], input: unknown) {
  const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(input));
  return brain([...args, "--input", file, "--brain", dir, "--now", NOW, "--json"]);
}

const addition = (target: string, content: string, source = "src-ex1a3b4c") => ({ kind: "add_to_note", title: "Add the price", target, content, why: "The call set it.", source });
const approve = (proposal: string) => ({ decisions: [{ proposal, action: "approve", decided_at: NOW, decided_by: "chat" }] });

test("apply closes an approved proposal that rests only on excluded evidence, and changes nothing else (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const staged = await run(dir, ["proposal", "new"], { proposals: [addition(target, EXCLUDED_LINE), addition(target, LIVE_LINE)] });
  assert.equal(staged.code, 0, staged.stdout);
  const [excluded, live] = staged.json.data.created as Array<{ id: string; path: string }>;
  await exclude();

  const out = await run(dir, ["apply"], { decisions: [...approve(excluded.id).decisions, ...approve(live.id).decisions] });
  assert.equal(out.code, 0, out.stdout);
  const [first, second] = out.json.data.decisions as Array<{ result: string; reason?: string; message?: string }>;
  assert.equal(first.result, "closed");
  assert.equal(first.reason, "SOURCE_EXCLUDED");
  assert.match(String(first.message), /excluded/);
  assert.equal(second.result, "applied", "a proposal that rests on a live passage of the same input is applied");

  const closed = parseFrontmatter(await readFile(join(dir, excluded.path), "utf8")).attributes;
  assert.equal(closed.status, "closed");
  assert.equal(closed.closed_reason, "stale");
  assert.deepEqual((closed.decision as { action: string }).action, "approve", "the user's decision is still recorded");
  const note = await readFile(join(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md"), "utf8");
  assert.ok(note.includes("A kept remark."), "the live addition is in the note");
  assert.ok(!note.includes("95k"), "the excluded wording was not added to the note");
});

test("proposal new skips a change that rests only on excluded evidence (cli §5.6)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  await exclude();
  const target = "dec-7k2m9q4x";
  const out = await run(dir, ["proposal", "new"], { proposals: [
    addition(target, EXCLUDED_LINE),
    addition(target, LIVE_LINE),
    addition(target, "A remark with no passage reference.", "src-ex1a3b4c"),
    addition(target, "A remark from the current version.", "src-ex2a3b4c"),
    addition(target, `${LIVE_LINE}\n\n${EXCLUDED_LINE}`),
  ] });
  assert.equal(out.code, 0, out.stdout);
  assert.deepEqual(out.json.data.skipped, [
    { input_index: 0, reason: "SOURCE_EXCLUDED" },
    { input_index: 2, reason: "SOURCE_EXCLUDED" },
  ], "an excluded passage, and an older version with no passage named; a live passage, the current version and a mixed text are kept");
  assert.equal(out.json.data.created.length, 3);
});

test("with no exclusion in the brain nothing is skipped or closed for it", async (context) => {
  const dir = await fixtureCopy(context);
  await excludableDecision(dir, SYNC, PROJECT);
  const staged = await run(dir, ["proposal", "new"], { proposals: [addition("dec-7k2m9q4x", EXCLUDED_LINE)] });
  assert.equal(staged.code, 0, staged.stdout);
  assert.deepEqual(staged.json.data.skipped, []);
  const out = await run(dir, ["apply"], approve(staged.json.data.created[0].id));
  assert.equal(out.json.data.decisions[0].result, "applied", out.stdout);
});
