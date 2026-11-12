import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import { serializeNewFile } from "../src/lib/frontmatter.ts";
import { passageHash } from "../src/lib/selection.ts";
import { brain } from "./helpers.ts";

// The awaiting-cleanup form (spec/eligibility.md §6 rules 1 to 4; cli.md §5.13, §5.13.1, §5.32; memory.md §5.3): a note with a restricted
// claim keeps its eligible lines and loses its title, path, tags, aliases, summary, free-text fields, headings and comments on every answer
// surface. Synthetic brains only: an input whose second paragraph, "Budget cut to 40k.", the user excluded.

const NOW = "2026-11-08T10:00:00Z";
const INPUT = "11111111-2222-4333-8444-555555555555";
const LIVE = "Vendor stays Acme.";
const SECRET = "Budget cut to 40k.";
const LIVE_REF = `^[src-ex1a3b4c#¶1:${passageHash(LIVE)}]`;
const SECRET_REF = `^[src-ex1a3b4c#¶2:${passageHash(SECRET)}]`;
const DECISION_PATH = "knowledge/decisions/2026-10-11-budget-cut-to-40k.md";
const MEMORY_PATH = "memories/2026/10/2026-10-11-budget-cut-to-40k.md";
const CITE = "decision dec-bbbb0001, title withheld: awaiting cleanup";

/** No word of the excluded paragraph, its title or its path is anywhere in `value`. */
function assertNoRestrictedText(value: unknown, where: string): void {
  const text = JSON.stringify(value).toLowerCase();
  for (const word of ["budget", "40k"]) assert.equal(text.includes(word), false, `${where} shows "${word}": ${text}`);
}

async function freshBrain(context: TestContext): Promise<{ dir: string; bare: string }> {
  const parent = await mkdtemp(join(tmpdir(), "brain-answer-"));
  context.after(() => rm(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const dir = join(parent, "brain");
  const made = await brain(["init", dir, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"]);
  assert.equal(made.code, 0, made.stdout);
  // A folder with no .brain: no context boost, so a note scores only from its own terms.
  const bare = join(parent, "bare");
  await mkdir(bare);
  return { dir, bare };
}

async function put(dir: string, path: string, attributes: Record<string, unknown>, body = ""): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), serializeNewFile(attributes, body));
}

function extract(id: string, version: number, replaces: string | null, paragraphs: Array<[number, string]>): string {
  const body = paragraphs.map(([n, text]) => `<!-- passage ¶${n} item s1 -->\n${text}\n`).join("\n");
  return `---\nid: ${id}\ntype: source\ntitle: Vendor extract v${version}\nsource_key: notion:${INPUT}\nkind: minutes\nextract: true\nextract_of: ${INPUT}\nextract_version: ${version}\n${replaces === null ? "" : `replaces: ${replaces}\n`}transcript_hash: ${"a".repeat(64)}\nselection:\n  - id: s1\n    effective: use\npassages:\n${paragraphs.map(([n, text]) => `  - n: ${n}\n    hash: ${passageHash(text)}`).join("\n")}\ncaptured: 2026-10-10T09:00:00Z\ncontent_hash: ${"b".repeat(64)}\n---\n${body}`;
}

/** Version 1 of the input holds both paragraphs. */
async function input(dir: string): Promise<void> {
  await mkdir(join(dir, "sources/notion"), { recursive: true });
  await writeFile(join(dir, "sources/notion/2026-10-10-vendor-extract-v1.md"), extract("src-ex1a3b4c", 1, null, [[1, LIVE], [2, SECRET]]));
}

/** Version 2 drops the budget paragraph, and its suppression record is active (capture-and-review §5.3). */
async function exclude(dir: string): Promise<void> {
  await writeFile(join(dir, "sources/notion/2026-10-10-vendor-extract-v2.md"), extract("src-ex2a3b4c", 2, "src-ex1a3b4c", [[1, LIVE]]));
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", `${INPUT}.json`), JSON.stringify({ input: INPUT, records: [{ version: 2, passages: [{ extract_of: INPUT, transcript_hash: "a".repeat(64), n: 2 }], full_copies: [], status: "active" }] }));
}

/** A decision with one live and one excluded claim, marked independent of the input so it keeps its headings in the rule's form; every piece of
 *  metadata the ingest wrote names the excluded claim. */
async function budgetDecision(dir: string, lifecycle = "reviewed"): Promise<void> {
  await put(dir, DECISION_PATH, {
    id: "dec-bbbb0001", type: "decision", title: "Budget cut to 40k", summary: "Budget cut to 40k; the vendor stays.", aliases: ["Budget cut"], tags: ["budget-cut"],
    lifecycle, assessment: "accepted", date: "2026-10-11", sources: ["src-ex1a3b4c"], lineage_cleared: [INPUT],
    rationale: "Budget cut to 40k after the review", reviewer: "per-bbbb0009",
    facts: { budget: "40k", vendor: "Acme" },
    timeline: [
      { field: "budget", value: "40k", from: "2026-10-11", learned: "2026-10-11", source: "src-ex1a3b4c", passage: `src-ex1a3b4c#¶2:${passageHash(SECRET)}`, assessment: "accepted" },
      { field: "vendor", value: "Acme", from: "2026-10-11", learned: "2026-10-11", source: "src-ex1a3b4c", passage: `src-ex1a3b4c#¶1:${passageHash(LIVE)}`, assessment: "accepted", note: "kept despite the budget cut" },
    ],
    created: "2026-10-11", updated: "2026-10-11",
  }, `# Budget cut to 40k\n<!-- budget cut to 40k,\n     agreed on the call -->\n\n## Decision\n\n${LIVE} ${LIVE_REF}\n${SECRET} ${SECRET_REF}\n\n## Context of the budget cut\n\n## Sources\n`);
}

async function query(dir: string, ...args: string[]) {
  const result = await brain(["query", ...args, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

test("query --read returns a note with a restricted claim in the awaiting-cleanup form: no title, path, tags, aliases, summary, free text, headings or comments (eligibility.md §6 rules 1 to 4)", async (context) => {
  const { dir, bare } = await freshBrain(context);
  await input(dir);
  await budgetDecision(dir);
  // Before the exclusion the note is whole.
  const before = (await query(dir, "--read", "dec-bbbb0001", "--repo", bare)).notes[0];
  assert.deepEqual([before.title, before.path, before.restricted, "cite" in before], ["Budget cut to 40k", DECISION_PATH, false, false]);

  await exclude(dir);
  const data = await query(dir, "--read", "dec-bbbb0001", "--repo", bare);
  const note = data.notes[0];
  assert.deepEqual([note.status, note.type, note.title, note.path, note.cite, note.restricted], ["ok", "decision", null, null, CITE, true]);
  assert.deepEqual([note.lifecycle, note.assessment, note.date], ["reviewed", "accepted", "2026-10-11"]);
  // Ids, dates, enumerations and the claims the rule leaves in stay; free text the ingest wrote goes, a timeline entry's note with it.
  for (const key of ["title", "summary", "aliases", "tags", "rationale"]) assert.equal(key in note.frontmatter, false, key);
  assert.deepEqual(note.frontmatter.facts, { vendor: "Acme" });
  assert.deepEqual(note.frontmatter.timeline.map((entry: Record<string, unknown>) => [entry.field, "note" in entry]), [["vendor", false]]);
  assert.deepEqual([note.frontmatter.id, note.frontmatter.reviewer, note.frontmatter.lineage_cleared, note.frontmatter.sources], ["dec-bbbb0001", "per-bbbb0009", [INPUT], ["src-ex1a3b4c"]]);
  // Headings and comments are spaces of the same length, except the decision's fixed sections; line numbers hold.
  const original = `# Budget cut to 40k\n<!-- budget cut to 40k,\n     agreed on the call -->\n\n## Decision\n\n${LIVE} ${LIVE_REF}\n${SECRET} ${SECRET_REF}\n\n## Context of the budget cut\n\n## Sources\n`.split("\n");
  const lines = note.body.replace(/^\n+/, "").split("\n");
  assert.equal(lines.length, original.length);
  lines.forEach((line: string, index: number) => assert.equal(line.length, original[index]!.length, `line ${index}`));
  assert.deepEqual(lines.filter((line: string) => line.trim() !== ""), ["## Decision", `${LIVE} ${LIVE_REF}`, "## Sources"]);
  assertNoRestrictedText(data, "query --read");
});

test("query --candidates scores and returns a note with a restricted claim without its withheld parts; a note whose only change is its summary keeps its title (eligibility.md §6 rules 2 and 3)", async (context) => {
  const { dir, bare } = await freshBrain(context);
  await input(dir);
  await budgetDecision(dir);
  // Every claim of this one is live: it rests on the changed input, so its summary goes, but it has no restricted claim.
  await put(dir, "knowledge/decisions/2026-10-12-vendor-stays-acme.md", { id: "dec-bbbb0002", type: "decision", title: "Vendor stays Acme", summary: "Acme stays.", lifecycle: "reviewed", assessment: "accepted", date: "2026-10-12", sources: ["src-ex1a3b4c"], created: "2026-10-12", updated: "2026-10-12" }, `${LIVE} ${LIVE_REF}\n`);
  const words = (await query(dir, "--candidates", "budget cut 40k", "--types", "decision", "--repo", bare)).candidates.map((candidate: { id: string }) => candidate.id);
  assert.deepEqual(words, ["dec-bbbb0001"], "before the exclusion, its title, aliases and body find it");

  await exclude(dir);
  // No withheld part adds a term: the title, the aliases, the tags, the summary, the free-text field, the headings and the comment all held "budget".
  const restricted = await query(dir, "--candidates", "budget cut 40k", "--repo", bare);
  assert.deepEqual(restricted.candidates, []);
  const data = await query(dir, "--candidates", "vendor acme", "--repo", bare);
  const by = Object.fromEntries(data.candidates.map((candidate: { id: string }) => [candidate.id, candidate]));
  const awaiting = by["dec-bbbb0001"];
  assert.deepEqual([awaiting.title, awaiting.path, awaiting.summary, awaiting.cite], [null, null, null, CITE]);
  // Its kept fact (the rule leaves `facts.vendor`, as --read shows) comes first, then its live line (cli.md §5.13 snippets, 0080).
  assert.deepEqual(awaiting.snippets.map((snippet: { text: string }) => snippet.text), ["facts.vendor: Acme", `${LIVE} ${LIVE_REF}`]);
  assertNoRestrictedText(data, "query --candidates");
  // The note with no restricted claim keeps its title and path; only its summary is gone.
  const kept = by["dec-bbbb0002"];
  assert.deepEqual([kept.title, kept.path, kept.summary, "cite" in kept], ["Vendor stays Acme", "knowledge/decisions/2026-10-12-vendor-stays-acme.md", null, false]);
});

test("recall and query return a memory with a restricted claim with no path and its cite, and no heading as its text (memory.md §5.3)", async (context) => {
  const { dir, bare } = await freshBrain(context);
  await input(dir);
  await exclude(dir);
  await put(dir, MEMORY_PATH, {
    id: "mem-bbbb0001", type: "memory", title: "Budget cut to 40k", summary: "Budget cut to 40k.", lifecycle: "reviewed", scope: "general", confidence: "verified", origin: "acme-api",
    sources: ["src-ex1a3b4c", "src-ex2a3b4c"], lineage_cleared: [INPUT], created: "2026-10-11", updated: "2026-10-11",
  }, `# Budget cut to 40k\n${LIVE} ${LIVE_REF}\n${SECRET} ${SECRET_REF}\n`);
  const recall = async (...args: string[]) => { const result = await brain(["recall", ...args, "--repo", bare, "--brain", dir, "--now", NOW, "--json"]); assert.equal(result.code, 0, result.stdout); return result.json.data; };
  const memoryCite = "memory mem-bbbb0001, title withheld: awaiting cleanup";
  const pack = await recall("--pack");
  assert.deepEqual(pack.memories.map((memory: Record<string, unknown>) => [memory.id, memory.path, memory.cite, memory.text]), [["mem-bbbb0001", null, memoryCite, `${LIVE} ${LIVE_REF}`]]);
  const search = await recall("--search", "vendor");
  assert.deepEqual(search.results.map((memory: Record<string, unknown>) => [memory.id, memory.path, memory.cite]), [["mem-bbbb0001", null, memoryCite]]);
  assert.deepEqual((await recall("--search", "budget")).results, []);
  const read = await query(dir, "--read", "mem-bbbb0001", "--repo", bare);
  assert.deepEqual([read.notes[0].path, read.notes[0].cite], [null, memoryCite]);
  const candidates = await query(dir, "--candidates", "vendor", "--types", "memory", "--repo", bare);
  assert.deepEqual(candidates.candidates.map((candidate: Record<string, unknown>) => [candidate.id, candidate.path, candidate.cite]), [["mem-bbbb0001", null, memoryCite]]);
  // The pack's own `budget` key is its token budget: only what it delivers is checked.
  for (const [where, value] of [["recall --pack", [pack.memories, pack.text]], ["recall --search", search], ["query --read", read], ["query --candidates", candidates]] as const) assertNoRestrictedText(value, where);
});

test("reflect --candidates: a member or input with a restricted claim gives no name and shows no title, path or headings (eligibility.md §13 row 14)", async (context) => {
  const { dir } = await freshBrain(context);
  await input(dir);
  await budgetDecision(dir);
  // A draft decision under the same name: today a near_duplicate pair by name.
  await put(dir, "knowledge/decisions/2026-10-20-budget-cut-to-40k-again.md", { id: "dec-bbbb0003", type: "decision", title: "Budget Cut to 40K", summary: "Again.", lifecycle: "draft", assessment: "accepted", date: "2026-10-20", sources: [], created: "2026-10-20", updated: "2026-10-20" }, "Written twice.\n");
  // A window meeting with claims on the same input (its own `source` is not one of the decision's), naming the decision by its title and
  // listing it by id.
  const meetingPath = "knowledge/meetings/2026-11-01-budget-cut-to-40k-sync.md";
  await put(dir, meetingPath, { id: "mtg-bbbb0001", type: "meeting", title: "Budget cut to 40k sync", summary: "Budget cut to 40k sync.", lifecycle: "draft", date: "2026-11-01", attendees: [], source: "src-ex2a3b4c", sources: [], decisions: ["dec-bbbb0001"], lineage_cleared: [INPUT], created: "2026-11-01", updated: "2026-11-01" },
    `## Budget cut to 40k\n${LIVE} ${LIVE_REF}\n${SECRET} ${SECRET_REF}\n`);
  const reflect = async () => { const result = await brain(["reflect", "--candidates", "--limit", "100", "--brain", dir, "--now", NOW, "--json"]); assert.equal(result.code, 0, result.stdout); return result.json.data; };

  const before = await reflect();
  const keys = before.clusters.map((cluster: { key: string }) => cluster.key);
  assert.ok(keys.includes("near_duplicate:dec-bbbb0001+dec-bbbb0003"), keys.join(","));
  const overtakenBefore = before.clusters.find((cluster: { key: string }) => cluster.key === "overtaken:dec-bbbb0001");
  assert.deepEqual(overtakenBefore.evidence.map((input: Record<string, unknown>) => [input.id, input.title, input.path]), [["mtg-bbbb0001", "Budget cut to 40k sync", meetingPath]]);
  assert.ok(overtakenBefore.evidence[0].lines.length > 0, "the title names it in the meeting's lines");

  await exclude(dir);
  const after = await reflect();
  // The titles give no name: no pair, and the meeting names the decision only by its id, with no line.
  assert.equal(after.clusters.some((cluster: { signal: string }) => cluster.signal === "near_duplicate"), false, JSON.stringify(after.clusters));
  const overtaken = after.clusters.find((cluster: { key: string }) => cluster.key === "overtaken:dec-bbbb0001");
  assert.deepEqual(overtaken.notes.map((note: Record<string, unknown>) => [note.id, note.title, note.path, note.summary, note.cite]), [["dec-bbbb0001", null, null, null, CITE]]);
  assert.deepEqual(overtaken.evidence.map((input: Record<string, unknown>) => [input.id, input.title, input.path, input.cite, input.lines]), [["mtg-bbbb0001", null, null, "meeting mtg-bbbb0001, title withheld: awaiting cleanup", []]]);
  assertNoRestrictedText(after, "reflect --candidates");
});

test("query --read and --candidates withhold a note restricted whole with nothing but its id and reason (eligibility.md §6 rule 1)", async (context) => {
  const { dir, bare } = await freshBrain(context);
  await input(dir);
  // Not resolved for the input, with an unsourced line: restricted whole once the input changes (cli.md §5.13).
  await put(dir, "knowledge/decisions/2026-10-13-budget-holds.md", { id: "dec-bbbb0004", type: "decision", title: "Budget holds at 40k", summary: "Budget holds.", lifecycle: "reviewed", assessment: "accepted", date: "2026-10-13", sources: ["src-ex1a3b4c"], created: "2026-10-13", updated: "2026-10-13" }, `The budget holds.\n${SECRET} ${SECRET_REF}\n`);
  await exclude(dir);
  const read = await query(dir, "--read", "dec-bbbb0004", "--repo", bare);
  assert.deepEqual(read.notes, [{ id: "dec-bbbb0004", status: "withheld", reason: "restricted" }]);
  const candidates = await query(dir, "--candidates", "budget holds", "--repo", bare);
  assert.deepEqual(candidates.candidates, []);
  assertNoRestrictedText([read, candidates.candidates], "a note restricted whole");
});

test("a restricted timeline entry alone, or a fact it supported, puts a note in the awaiting-cleanup form (cli.md §5.13: a dropped timeline entry or fact is a restricted claim)", async (context) => {
  const { dir, bare } = await freshBrain(context);
  await input(dir);
  const entry = (field: string, value: string, paragraph: [number, string], assessment: string) => ({ field, value, from: "2026-10-11", learned: "2026-10-11", source: "src-ex1a3b4c", passage: `src-ex1a3b4c#¶${paragraph[0]}:${passageHash(paragraph[1])}`, assessment });
  const base = { type: "decision", lifecycle: "reviewed", assessment: "accepted", date: "2026-10-11", sources: ["src-ex1a3b4c"], lineage_cleared: [INPUT], created: "2026-10-11", updated: "2026-10-11" };
  // Every body line is live. One note's only excluded claim is a past timeline entry; the other's is the entry behind a fact, so the fact goes too.
  await put(dir, "knowledge/decisions/2026-10-11-budget-cut-timeline.md", { ...base, id: "dec-bbbb0006", title: "Budget cut to 40k timeline", tags: ["budget-cut"],
    facts: { vendor: "Acme" }, timeline: [entry("vendor", "Acme", [1, LIVE], "accepted"), entry("budget", "40k", [2, SECRET], "superseded")] }, `${LIVE} ${LIVE_REF}\n`);
  await put(dir, "knowledge/decisions/2026-10-11-budget-cut-fact.md", { ...base, id: "dec-bbbb0007", title: "Budget cut to 40k fact", tags: ["budget-cut"],
    facts: { vendor: "Acme", budget: "40k" }, timeline: [entry("vendor", "Acme", [1, LIVE], "accepted"), entry("budget", "40k", [2, SECRET], "accepted")] }, `${LIVE} ${LIVE_REF}\n`);
  await exclude(dir);
  const read = await query(dir, "--read", "dec-bbbb0006,dec-bbbb0007", "--repo", bare);
  assert.deepEqual(read.notes.map((note: Record<string, unknown>) => [note.id, note.status, note.title, note.path, note.cite, note.restricted]), [
    ["dec-bbbb0006", "ok", null, null, "decision dec-bbbb0006, title withheld: awaiting cleanup", true],
    ["dec-bbbb0007", "ok", null, null, "decision dec-bbbb0007, title withheld: awaiting cleanup", true],
  ]);
  assert.deepEqual(read.notes.map((note: { frontmatter: { facts: unknown; timeline: Array<{ field: string }> } }) => [note.frontmatter.facts, note.frontmatter.timeline.map((kept) => kept.field)]), [
    [{ vendor: "Acme" }, ["vendor"]],
    [{ vendor: "Acme" }, ["vendor"]],
  ]);
  const candidates = await query(dir, "--candidates", "vendor acme", "--types", "decision", "--repo", bare);
  assert.deepEqual(candidates.candidates.map((candidate: Record<string, unknown>) => [candidate.id, candidate.title, candidate.path, candidate.cite]).sort(), [
    ["dec-bbbb0006", null, null, "decision dec-bbbb0006, title withheld: awaiting cleanup"],
    ["dec-bbbb0007", null, null, "decision dec-bbbb0007, title withheld: awaiting cleanup"],
  ]);
  assertNoRestrictedText([read, candidates.candidates], "a timeline entry or fact restricted alone");
});
