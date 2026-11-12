import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { passageHash } from "../src/lib/selection.ts";
import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const SECRET = "Pricing was 95,000.";
const EXCLUDED_LINE = `The price was 95,000. ^[src-ex1a3b4c#¶2:${passageHash(SECRET)}]`;
const LIVE_LINE = `A kept remark. ^[src-ex1a3b4c#¶1:${passageHash("A live paragraph.")}]`;

async function run(dir: string, args: string[], input: unknown) {
  const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
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
  assert.ok(!note.includes("95,000"), "the excluded wording was not added to the note");
});

test("proposal new skips a change that rests on excluded evidence, a mixed one whole (cli §5.6, eligibility §4.2)", async (context) => {
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
  // CC-177 before 0077 kept the mixed text (index 4); 0077 §1 withholds it whole (eligibility.md §4.2). Since CC-179 every item names its
  // passages (here, withPassages names the whole source for a text that cites none): the current version as a whole input that has a
  // suppression record is not live either (index 3), so only the item on a live paragraph is written (eligibility.md §9.2, schema §11.5).
  assert.deepEqual(out.json.data.skipped, [
    { input_index: 0, reason: "SOURCE_EXCLUDED" },
    { input_index: 2, reason: "SOURCE_EXCLUDED" },
    { input_index: 3, reason: "SOURCE_EXCLUDED" },
    { input_index: 4, reason: "SOURCE_EXCLUDED" },
  ], "an excluded passage, an older version and the current version as whole inputs, and a mixed text; a live passage is kept");
  assert.equal(out.json.data.created.length, 1);
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
  assert.deepEqual(out.json.data.skipped, [{ input_index: 3, reason: "SOURCE_EXCLUDED" }], "only the one that cites an excluded passage");
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
  assert.ok(!everything.includes("The price was 95,000"));
});

test("proposal new tells a person why an item was skipped", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  await exclude();
  const file = join(dir, "..", "skip.json");
  await writeFile(file, JSON.stringify(withPassages({ proposals: [addition("dec-7k2m9q4x", EXCLUDED_LINE)] })));
  const out = await brain(["proposal", "new", "--input", file, "--brain", dir, "--now", NOW]);
  assert.match(out.stdout, /skipped proposals\[0\]: rests on content you excluded from the brain/);
});

test("a fix or an edit whose value still holds the excluded claim is closed, whatever the kind (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    addition(target, EXCLUDED_LINE),
    addition("dec-2p9f6h1r", EXCLUDED_LINE),
    addition("per-3h8w2n6c", EXCLUDED_LINE),
    { kind: "update_fact", title: "Budget", target: PROJECT, field: "budget", after: "95,000", why: "The call set it.", source: "src-ex1a3b4c" },
    { kind: "update_fact", title: "Owner", target: PROJECT, field: "owner_note", after: "95,000", why: "The call set it.", source: "src-ex1a3b4c" },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const ids = (staged.json.data.created as Array<{ id: string }>).map((entry) => entry.id);
  await exclude();
  const decide = (proposal: string, action: string, extra: Record<string, unknown>) => ({ proposal, action, note: "n", decided_at: NOW, decided_by: "chat", ...extra });
  const out = await run(dir, ["apply"], { decisions: [
    decide(ids[0]!, "fix", { fixes: [{ value: EXCLUDED_LINE }] }),
    decide(ids[1]!, "fix", { fixes: [{ value: EXCLUDED_LINE.replace("The price", "THE PRICE") }] }),
    decide(ids[2]!, "edit", { value: EXCLUDED_LINE }),
    decide(ids[3]!, "fix", { fixes: [{ value: "95,000" }] }),
    decide(ids[4]!, "fix", { fixes: [{ value: "Maria" }] }),
  ] });
  const results = (out.json.data.decisions as Array<{ result: string; reason?: string }>).map((entry) => [entry.result, entry.reason ?? null]);
  assert.deepEqual(results.slice(0, 4), Array.from({ length: 4 }, () => ["closed", "SOURCE_EXCLUDED"]), out.stdout);
  assert.notEqual(results[4]![1], "SOURCE_EXCLUDED", "a value of the user's own, with no passage, is not judged");
  for (const path of ["knowledge/decisions/2026-12-03-use-supabase-for-auth.md", "knowledge/decisions/2026-10-01-use-firebase-for-auth.md", "projects/acme-website/project.md"]) {
    assert.ok(!/95,000/i.test(await readFile(join(dir, path), "utf8")), path);
  }
});

test("an answer that rests only on an excluded passage is closed on approve and on a fix that keeps it (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const made = await run(dir, ["note", "new"], { notes: [{ type: "question", title: "Who pays for hosting", frontmatter: { summary: "Open: who pays for hosting.", kind: "question", projects: [PROJECT], sources: [SYNC] }, body: "Nobody said.\n" }] });
  assert.equal(made.code, 0, made.stdout);
  const question = [{ id: "que-8n3v5x1d", path: "knowledge/questions/who-owns-the-acme-mobile-app.md" }, made.json.data.created[0] as { id: string; path: string }];
  const answer = (target: string) => ({ kind: "answer", title: "Answer", target, answer: EXCLUDED_LINE, why: "The call set it.", source: "src-ex1a3b4c" });
  const staged = await run(dir, ["proposal", "new"], { proposals: [answer(question[0]!.id), answer(question[1]!.id)] });
  assert.equal(staged.code, 0, staged.stdout);
  const [first, second] = staged.json.data.created as Array<{ id: string }>;
  await exclude();
  const out = await run(dir, ["apply"], { decisions: [
    ...approve(first!.id).decisions,
    { proposal: second!.id, action: "fix", note: "n", fixes: [{ value: EXCLUDED_LINE }], decided_at: NOW, decided_by: "chat" },
  ] });
  assert.deepEqual((out.json.data.decisions as Array<{ result: string; reason?: string }>).map((entry) => [entry.result, entry.reason]), [["closed", "SOURCE_EXCLUDED"], ["closed", "SOURCE_EXCLUDED"]], out.stdout);
  for (const entry of question.slice(0, 2)) assert.ok(!(await readFile(join(dir, entry.path), "utf8")).includes("95,000"), entry.path);
});

const MIXED_LIVE = `A mixed remark. ^[src-ex1a3b4c#¶1:${passageHash("A live paragraph.")}]`;
const MIXED = `${MIXED_LIVE}\n\n${EXCLUDED_LINE}`;
const TARGET_PATH = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";

test("a mixed item is withheld whole on apply, an independent live one applies, and its re-proposal from the live passage needs its own decision (eligibility §4.2, §9.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const staged = await run(dir, ["proposal", "new"], { proposals: [addition(target, MIXED), addition(target, LIVE_LINE)] });
  assert.equal(staged.code, 0, staged.stdout);
  const [mixed, live] = staged.json.data.created as Array<{ id: string; path: string }>;
  // The user approved the mixed item in chat before the exclusion; it was recorded, not applied yet.
  const recorded = await brain(["apply", "--record-only", "--input", await input(dir, approve(mixed!.id)), "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(recorded.json.data.decisions[0].result, "recorded", recorded.stdout);
  await exclude(); // made between the proposal's creation and its apply

  const out = await run(dir, ["apply"], { decisions: [...approve(mixed!.id).decisions, ...approve(live!.id).decisions] });
  assert.deepEqual((out.json.data.decisions as Array<{ result: string; reason?: string }>).map((entry) => [entry.result, entry.reason ?? null]), [["closed", "SOURCE_EXCLUDED"], ["applied", null]], out.stdout);
  const closed = parseFrontmatter(await readFile(join(dir, mixed!.path), "utf8")).attributes;
  assert.deepEqual([closed.status, closed.closed_reason], ["closed", "stale"]);
  let note = await readFile(join(dir, TARGET_PATH), "utf8");
  assert.ok(!note.includes("95,000") && !note.includes("A mixed remark."), "neither the whole mixed text nor its live part is written");
  assert.ok(note.includes("A kept remark."), "the independent live item is applied");

  // Re-proposed from the live passage alone: a new pending item, which the earlier Approve does not reach.
  const again = await run(dir, ["proposal", "new"], { proposals: [addition(target, MIXED_LIVE)] });
  assert.deepEqual([again.code, again.json.data.skipped], [0, []], again.stdout);
  const fresh = again.json.data.created[0] as { id: string; path: string };
  assert.notEqual(fresh.id, mixed!.id);
  const pending = await brain(["apply", "--brain", dir, "--now", NOW, "--json"]);
  assert.ok(!(pending.json.data.decisions as Array<{ proposal: string }>).some((entry) => entry.proposal === fresh.id), "no decision is carried over to it");
  assert.equal(parseFrontmatter(await readFile(join(dir, fresh.path), "utf8")).attributes.status, "pending");
  const accepted = await run(dir, ["apply"], approve(fresh.id));
  assert.equal(accepted.json.data.decisions[0].result, "applied", accepted.stdout);
  note = await readFile(join(dir, TARGET_PATH), "utf8");
  assert.ok(note.includes("A mixed remark.") && !note.includes("95,000"));
});

test("on a mixed item, a fix that keeps the wording is closed, and one that keeps only the live cited line is applied (eligibility §9.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const staged = await run(dir, ["proposal", "new"], { proposals: [addition(target, MIXED), addition(target, `${MIXED}\n\nAnd more. ^[inferred]`)] });
  const [kept, trimmed] = (staged.json.data.created as Array<{ id: string }>).map((entry) => entry.id);
  await exclude();
  const fix = (proposal: string, value: string) => ({ proposal, action: "fix", note: "n", fixes: [{ value }], decided_at: NOW, decided_by: "chat" });
  const out = await run(dir, ["apply"], { decisions: [fix(kept!, MIXED), fix(trimmed!, MIXED_LIVE)] });
  assert.deepEqual((out.json.data.decisions as Array<{ result: string; reason?: string }>).map((entry) => [entry.result, entry.reason ?? null]), [["closed", "SOURCE_EXCLUDED"], ["applied", null]], out.stdout);
  const note = await readFile(join(dir, TARGET_PATH), "utf8");
  assert.ok(note.includes(`${MIXED_LIVE}\nSource: src-ex1a3b4c`), "the user's exact wording, still that claim of the source");
  assert.ok(!note.includes("95,000"));
});

test("a value the user typed that restates excluded content is applied as their own correction, user-correction:<prp id> (eligibility §9.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const target = "dec-7k2m9q4x";
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    addition(target, MIXED),
    { kind: "update_fact", title: "Budget", target: PROJECT, field: "budget", after: "95k", why: "The call set it.", source: "src-ex1a3b4c" },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const [appendix, fact] = (staged.json.data.created as Array<{ id: string }>).map((entry) => entry.id);
  await exclude();
  const sourcesBefore = parseFrontmatter(await readFile(join(dir, TARGET_PATH), "utf8")).attributes.sources;
  const out = await run(dir, ["apply"], { decisions: [
    { proposal: appendix!, action: "fix", note: "n", fixes: [{ value: "I recall the price was 95k." }], decided_at: NOW, decided_by: "chat" },
    { proposal: fact!, action: "edit", value: "95,000", note: "n", decided_at: NOW, decided_by: "chat" },
  ] });
  assert.deepEqual((out.json.data.decisions as Array<{ result: string }>).map((entry) => entry.result), ["applied", "applied"], out.stdout);
  const note = parseFrontmatter(await readFile(join(dir, TARGET_PATH), "utf8"));
  assert.ok(note.body.includes(`I recall the price was 95k.\nSource: user-correction:${appendix}`), note.body);
  assert.deepEqual(note.attributes.sources, sourcesBefore, "the excluded source is not added to the note's sources");
  const project = parseFrontmatter(await readFile(join(dir, "projects/acme-website/project.md"), "utf8")).attributes as Record<string, any>;
  assert.equal(project.facts.budget, "95,000");
  const entries = (project.timeline as Array<Record<string, unknown>>).filter((entry) => entry.field === "budget");
  assert.deepEqual(entries.at(-1) === undefined ? null : [entries.at(-1)!.value, entries.at(-1)!.source, entries.at(-1)!.assessment], ["95,000", `user-correction:${fact}`, "accepted"]);
  assert.ok(!entries.some((entry) => entry.value === "95k" || entry.source === "src-ex1a3b4c"), "the proposal's excluded value is not written as history");
  // Apply refuses a result that adds lint errors (cli §3.6.3), so "applied" also says both notes still lint.
});

test("an approved Review row of the new layout, applied from chat, withholds its mixed item and applies the independent ones (eligibility §4.1, §9.2)", async (context) => {
  const dir = await fixtureCopy(context);
  const { note: draft, exclude } = await excludableDecision(dir, SYNC, PROJECT, true); // the draft cites a live and an excluded passage
  const staged = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [draft.id] },
    addition("con-1s6t8e2b", MIXED, SYNC),
    addition("con-1s6t8e2b", LIVE_LINE, SYNC),
    { kind: "add_link", title: "link", target: "con-1s6t8e2b", field: "projects", after: PROJECT, why: "Said.", source: SYNC },
  ] });
  assert.equal(staged.code, 0, staged.stdout);
  const row = staged.json.data.created[0] as { id: string; path: string };
  await exclude();
  const out = await run(dir, ["apply"], approve(row.id));
  const [result] = out.json.data.decisions as Array<{ result: string; changes: Array<{ result: string; reason?: string }>; notes: Array<{ id: string; result: string }>; withheld: string[] }>;
  assert.equal(result!.result, "applied", out.stdout);
  assert.deepEqual(result!.changes.map((entry) => [entry.result, entry.reason ?? null]), [["dropped", "SOURCE_EXCLUDED"], ["applied", null]]);
  assert.deepEqual(result!.notes.map((entry) => [entry.id, entry.result]), [[draft.id, "archived"]], "the mixed draft is archived, not reviewed");
  assert.equal(result!.withheld.length, 2);
  const proposal = parseFrontmatter(await readFile(join(dir, row.path), "utf8")).attributes as Record<string, any>;
  assert.deepEqual(proposal.item_decisions.map((entry: Record<string, unknown>) => [entry.decision, entry.state, entry.reason]), [["reject", "closed", "source_excluded"], ["reject", "closed", "source_excluded"]]);
  const concept = await readFile(join(dir, "knowledge/references/row-level-security.md"), "utf8");
  assert.ok(concept.includes("A kept remark.") && concept.includes(PROJECT), "the live change and the link apply");
  assert.ok(!concept.includes("95,000") && !concept.includes("A mixed remark."));
});

async function input(dir: string, value: unknown): Promise<string> {
  const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(value));
  return file;
}
