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

const LIVE_V2 = `A kept remark. ^[src-ex2a3b4c#¶1:${passageHash("A live paragraph.")}]`;

test("a line with no passage reference beside a live claim does not make a proposal excluded (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const before = await run(dir, ["proposal", "new"], { proposals: [addition(target, `${LIVE_LINE}\n\nSo we follow up next week. ^[inferred]`)] });
  assert.equal(before.code, 0, before.stdout);
  await exclude();
  const out = await run(dir, ["proposal", "new"], { proposals: [
    addition(target, `${LIVE_LINE}\n\nSo we follow up in two weeks. ^[inferred]`),
    addition(target, `${LIVE_V2}\n\nSo we follow up in three weeks. ^[inferred]`, "src-ex2a3b4c"),
    addition(target, `## Price\n\n${LIVE_V2}`, "src-ex2a3b4c"),
    addition(target, `## Price\n\n${EXCLUDED_LINE}\n\nSo the budget is set. ^[inferred]`),
  ] });
  assert.equal(out.code, 0, out.stdout);
  assert.deepEqual(out.json.data.skipped, [{ input_index: 3, reason: "SOURCE_EXCLUDED" }], "only the one whose every cited line is excluded");
  const applied = await run(dir, ["apply"], approve(before.json.data.created[0].id));
  assert.equal(applied.json.data.decisions[0].result, "applied", applied.stdout);
});

test("a fix that keeps the proposed text is checked like an approve; one that replaces it is the user's own wording", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const item = { kind: "new_item", title: "New: price", why: "The call set it.", source: "src-ex1a3b4c",
    note: { type: "decision", title: "Price set", frontmatter: { summary: "s", date: "2026-12-03", assessment: "provisional", projects: [PROJECT], sources: ["src-ex1a3b4c"] }, body: `${EXCLUDED_LINE}\n` } };
  const staged = await run(dir, ["proposal", "new"], { proposals: [item, addition("dec-7k2m9q4x", EXCLUDED_LINE)] });
  assert.equal(staged.code, 0, staged.stdout);
  const [fresh, appendix] = staged.json.data.created as Array<{ id: string }>;
  await exclude();
  const out = await run(dir, ["apply"], { decisions: [
    { proposal: fresh.id, action: "fix", note: "title: Pricing decision", fixes: [{ field: "title", value: "Pricing decision" }], decided_at: NOW, decided_by: "chat" },
    { proposal: appendix.id, action: "fix", note: "say this instead", fixes: [{ value: "The price is agreed. ^[inferred]" }], decided_at: NOW, decided_by: "chat" },
  ] });
  const [kept, replaced] = out.json.data.decisions as Array<{ result: string; reason?: string }>;
  assert.equal(kept.result, "closed", out.stdout);
  assert.equal(kept.reason, "SOURCE_EXCLUDED");
  // The user's own wording is not judged as excluded evidence; here the brain's lint then refuses it for another reason (an extract is cited by passage).
  assert.notEqual(replaced.reason, "SOURCE_EXCLUDED", out.stdout);
  const everything = (await brain(["query", "--candidates", "pricing decision price", "--brain", dir, "--json"])).stdout;
  assert.ok(!everything.includes("The price was 95k"));
});

test("proposal new tells a person why an item was skipped", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  await exclude();
  const file = join(dir, "..", "skip.json");
  await writeFile(file, JSON.stringify({ proposals: [addition("dec-7k2m9q4x", EXCLUDED_LINE)] }));
  const out = await brain(["proposal", "new", "--input", file, "--brain", dir, "--now", NOW]);
  assert.match(out.stdout, /skipped proposals\[0\]: rests only on content you excluded from the brain/);
});

test("a fix or an edit whose value still holds the excluded claim is closed, whatever the kind (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    addition(target, EXCLUDED_LINE),
    addition("dec-2p9f6h1r", EXCLUDED_LINE),
    addition("per-3h8w2n6c", EXCLUDED_LINE),
    { kind: "update_fact", title: "Budget", target: PROJECT, field: "budget", after: "95k", why: "The call set it.", source: "src-ex1a3b4c" },
    { kind: "update_fact", title: "Owner", target: PROJECT, field: "owner_note", after: "95k", why: "The call set it.", source: "src-ex1a3b4c" },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const ids = (staged.json.data.created as Array<{ id: string }>).map((entry) => entry.id);
  await exclude();
  const decide = (proposal: string, action: string, extra: Record<string, unknown>) => ({ proposal, action, note: "n", decided_at: NOW, decided_by: "chat", ...extra });
  const out = await run(dir, ["apply"], { decisions: [
    decide(ids[0]!, "fix", { fixes: [{ value: EXCLUDED_LINE }] }),
    decide(ids[1]!, "fix", { fixes: [{ value: EXCLUDED_LINE.replace("95k", "95K") }] }),
    decide(ids[2]!, "edit", { value: EXCLUDED_LINE }),
    decide(ids[3]!, "fix", { fixes: [{ value: "95k" }] }),
    decide(ids[4]!, "fix", { fixes: [{ value: "Maria" }] }),
  ] });
  const results = (out.json.data.decisions as Array<{ result: string; reason?: string }>).map((entry) => [entry.result, entry.reason ?? null]);
  assert.deepEqual(results.slice(0, 4), Array.from({ length: 4 }, () => ["closed", "SOURCE_EXCLUDED"]), out.stdout);
  assert.notEqual(results[4]![1], "SOURCE_EXCLUDED", "a value of the user's own, with no passage, is not judged");
  for (const path of ["knowledge/decisions/2026-12-03-use-supabase-for-auth.md", "knowledge/decisions/2026-10-01-use-firebase-for-auth.md", "projects/acme-website/project.md"]) {
    assert.ok(!/95k/i.test(await readFile(join(dir, path), "utf8")), path);
  }
});
