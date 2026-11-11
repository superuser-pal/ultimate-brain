// CC-205: `brain query --candidates`'s 0.13.0 ranking (spec/cli.md §5.13 steps 1a, 3, 3a, the snippets and `unresolved`; 0080)
// at spec/retrieval.md §2's trust seams and §7.3's checks, and the unresolved signal's rules (retrieval.md §3).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { queryTerms, queryTypes, rankCandidates, searchCandidates, stem, VOCABULARY, type QueryContext } from "../src/lib/query.ts";
import type { Note } from "../src/lib/notes.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const REPO_ROOT = join(import.meta.dirname, "..");

const NONE: QueryContext = { repo: null, project: null, area: null };
const TYPES = queryTypes(undefined);

function yaml(key: string, value: unknown): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return `${key}:\n${Object.entries(value).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join("\n")}`;
  }
  return `${key}: ${JSON.stringify(value)}`;
}
function note(id: string, type: string, attributes: Record<string, unknown>, body = "", extra: Record<string, unknown> = {}): Note {
  const all = { id, type, ...attributes };
  const raw = `---\n${Object.entries(all).map(([k, v]) => yaml(k, v)).join("\n")}\n---\n${body}`;
  return { id, type, path: `knowledge/${id}.md`, attributes: all, body, raw, ...extra } as unknown as Note;
}
const search = (notes: readonly Note[], question: string, context = NONE, eligible?: (note: Note) => Note | null) =>
  searchCandidates(notes, queryTerms(question), TYPES, context, eligible);
const ids = (notes: readonly Note[], question: string, context = NONE, eligible?: (note: Note) => Note | null) =>
  search(notes, question, context, eligible).candidates.map((candidate) => candidate.id);

const world = () => [
  note("prj-alder001", "project", { title: "Alder app", area: "area-tree0001", facts: { budget: "40000 EUR", team_size: 4 } }, "A booking app.\n"),
  note("prj-alder002", "project", { title: "Alder site", area: "area-tree0001" }, "A public website.\n"),
  note("prj-birch001", "project", { title: "Birch shop", area: "area-tree0002" }, "A web shop.\n"),
  note("mtg-alder001", "meeting", { title: "Alder app check-in", projects: ["prj-alder001"] }, "## Summary\nThe money for the rest of the year is €40,000.\n\nThe team reviewed the tickets.\n"),
  note("mtg-alder002", "meeting", { title: "Alder site check-in", projects: ["prj-alder002"] }, "## Summary\nThe budget for the build is €9,000.\n"),
  note("mtg-birch001", "meeting", { title: "Birch shop check-in", projects: ["prj-birch001"] }, "## Summary\nThe budget for the shop is €5,000.\n"),
];

// ---- step 1a, step 3's vocabulary ----

test("step 1a's suffix rule (cli.md §5.13)", () => {
  const cases = { budgets: "budget", launching: "launch", launched: "launch", copies: "copy", planned: "plan", raise: "rais", raised: "rais", releases: "releas", status: "status", speed: "speed", string: "string", "2026": "2026", app: "app" };
  for (const [word, expected] of Object.entries(cases)) assert.equal(stem(word), expected, word);
});

test("the vocabulary is cli.md §5.13's 12 groups, within retrieval.md §4's bounds", () => {
  assert.equal(VOCABULARY.length, 12);
  for (const group of VOCABULARY) assert.ok(group.length >= 2 && group.length <= 6, group.join(","));
  assert.ok(VOCABULARY.some((group) => group.includes("budget") && group.includes("money")));
});

test("a word form and a group word find the note: budgets, money (C2)", () => {
  assert.ok(ids(world(), "Alder budgets").includes("mtg-alder002"), "budgets finds budget");
  assert.ok(ids(world(), "What is the budget for the Alder app?").slice(0, 2).includes("mtg-alder001"), "money answers a budget question for the named subject");
});

// ---- step 3a ----

test("the named subject's notes rank on the other terms; the most specific name wins (step 3a)", () => {
  const ranked = ids(world(), "What is the budget for the Alder app?");
  assert.ok(ranked.indexOf("mtg-alder001") < ranked.indexOf("mtg-alder002"), ranked.join(", "));
  assert.ok(ranked.indexOf("mtg-alder001") < ranked.indexOf("mtg-birch001"), ranked.join(", "));
});

test("recall's ranking is unchanged: rankCandidates has no word forms, no vocabulary and no subject (retrieval.md §1)", () => {
  const memories = [note("mem-aaaa0001", "memory", { title: "Budgets are approved monthly" }, "budget money\n"), note("mem-aaaa0002", "memory", { title: "Money" }, "spend\n")];
  const ranked = rankCandidates(memories, queryTerms("budgets"), queryTypes("memory"), NONE).map((candidate) => candidate.id);
  assert.deepEqual(ranked, ["mem-aaaa0001"], "budgets matches only its own prefix, not money or spend");
});

// ---- spec/retrieval.md §2's seams (§7.3) ----

test("a withheld note adds no term, no document frequency, no subject and no signal (§2.1, §2.4)", () => {
  const notes = [...world(), note("prj-cedar001", "project", { title: "Alder app budget" }, "money money money\n")];
  const withheld = (n: Note) => (n.id === "prj-cedar001" ? null : n);
  assert.deepEqual(search(notes, "What is the budget for the Alder app?", NONE, withheld), search(world(), "What is the budget for the Alder app?"));
  assert.deepEqual(search(notes, "Alder budget", NONE, withheld), search(world(), "Alder budget"));
});

test("a fact the projection drops adds no term and no snippet; a kept fact is shown (§2.2, C4)", () => {
  const dropped = (n: Note) => (n.id === "prj-alder001" ? { ...n, attributes: { ...n.attributes, facts: {} } } as Note : n);
  const alder = search(world(), "Alder app budget", NONE, dropped).candidates.find((candidate) => candidate.id === "prj-alder001");
  assert.ok(!alder || alder.snippets.every((snippet) => !/budget|40000/.test(snippet.text)), "no snippet shows the dropped fact");
  const kept = search(world(), "Alder app budget").candidates.find((candidate) => candidate.id === "prj-alder001")!;
  assert.ok(kept.snippets.some((snippet) => snippet.text === "facts.budget: 40000 EUR"), JSON.stringify(kept.snippets));
});

test("an equivalence never surfaces a blanked line (§2.6)", () => {
  const blanked = (n: Note) => (n.id === "mtg-alder001" ? { ...n, body: n.body.replace(/^The money.*$/m, (line) => " ".repeat(line.length)) } as Note : n);
  for (const candidate of search(world(), "What is the budget for the Alder app?", NONE, blanked).candidates) {
    for (const snippet of candidate.snippets) assert.ok(candidate.id !== "mtg-alder001" || !/40,000|money/.test(snippet.text), `${candidate.id}: ${snippet.text}`);
  }
});

test("a note whose title the projection withholds names no subject (§2.4)", () => {
  const cleanup = (n: Note) => (n.id === "prj-alder001" ? { ...n, titleWithheld: true } as Note : n);
  const notSubject = (n: Note) => (n.id === "prj-alder001" ? { ...n, type: "reference", attributes: { ...n.attributes, type: "referenc" } } as Note : n);
  const score = (eligible: (n: Note) => Note | null) => search(world(), "What is the budget for the Alder app?", NONE, eligible).candidates.find((c) => c.id === "mtg-alder001")?.score;
  assert.equal(score(cleanup), score(notSubject), "with its title withheld the meeting gets no subject's sum");
  assert.ok(score((n) => n)! > score(cleanup)!, "with its title eligible the subject resolves");
});

test("the caller's context resolves a subject but never adds a note (§2.5)", () => {
  const context = { repo: "alder", project: "prj-alder001", area: null };
  const withheld = (n: Note) => (n.id === "mtg-alder001" ? null : n);
  assert.ok(!ids(world(), "money", context, withheld).includes("mtg-alder001"));
});

test("accent folding and CJK n-grams are unchanged (§1, §7.3)", () => {
  const notes = [note("ref-cafe0001", "reference", { title: "Café vouchers" }, "Vouchers for the café.\n"), note("ref-cjk00001", "reference", { title: "東京の予算" }, "東京の予算は五万です。\n")];
  assert.deepEqual(ids(notes, "cafe"), ["ref-cafe0001"]);
  assert.deepEqual(ids(notes, "予算"), ["ref-cjk00001"]);
});

test("a long line is shown as the 200 characters around its first match (C4)", () => {
  const long = `${"Intro words that say nothing much here. ".repeat(6)}The hosting cost is 120 EUR a month for the shop.${" Trailing words follow on.".repeat(4)}`;
  const [candidate] = search([note("mtg-long0001", "meeting", { title: "Long" }, `${long}\n`)], "hosting cost").candidates;
  const [snippet] = candidate!.snippets;
  assert.ok(snippet!.text.length <= 200 && snippet!.text.startsWith("…") && snippet!.text.includes("The hosting cost is 120 EUR"), snippet!.text);
});

// ---- the unresolved signal (cli.md §5.13, retrieval.md §3) ----

test("two projects a question names in part, both holding the attribute: unresolved lists them by id, type and title, no value", () => {
  const { unresolved, candidates } = search(world(), "What is the Alder budget?");
  assert.deepEqual(unresolved!.subjects.map((s) => s.id).sort(), ["prj-alder001", "prj-alder002"]);
  assert.equal(unresolved!.more, 0);
  for (const subject of unresolved!.subjects) assert.deepEqual(Object.keys(subject).sort(), ["id", "title", "type"]);
  assert.doesNotMatch(JSON.stringify(unresolved), /40|9,000|EUR/, "no value");
  assert.deepEqual(candidates, search(world(), "What is the Alder budget?").candidates, "the candidates are the same with the signal");
});

test("a uniquely named subject or the caller's project resolves, so there is no signal", () => {
  assert.equal(search(world(), "What is the budget for the Alder app?").unresolved, null);
  assert.equal(search(world(), "What is the Alder budget?", { repo: "x", project: "prj-alder002", area: null }).unresolved, null);
});

test("no signal from subject-only hits, one holder, or no attribute term", () => {
  assert.equal(search(world(), "What is the Alder deadline?").unresolved, null, "no note of theirs holds the attribute");
  assert.equal(search(world(), "Alder tickets").unresolved, null, "only one project holds it");
  assert.equal(search(world(), "Alder").unresolved, null, "no attribute term");
});

test("withheld evidence never makes a project a holder, and a withheld project is never listed", () => {
  const meetingWithheld = (n: Note) => (n.id === "mtg-alder002" ? null : n);
  assert.equal(search(world(), "What is the Alder budget?", NONE, meetingWithheld).unresolved, null);
  const projectWithheld = (n: Note) => (n.id === "prj-alder002" ? null : n);
  assert.equal(search(world(), "What is the Alder budget?", NONE, projectWithheld).unresolved, null);
});

test("a project in the awaiting-cleanup form is never matched by name; an area lists it by type and id only", () => {
  const cleanup = (n: Note) => (n.id === "prj-alder002" ? { ...n, titleWithheld: true, attributes: { ...n.attributes, title: undefined } } as Note : n);
  assert.equal(search(world(), "What is the Alder budget?", NONE, cleanup).unresolved, null, "its withheld title names nothing");
  const { unresolved } = search(world(), "What is the budget?", { repo: "x", project: null, area: "area-tree0001" }, cleanup);
  const listed = unresolved!.subjects.find((s) => s.id === "prj-alder002")!;
  assert.deepEqual(listed, { id: "prj-alder002", type: "project", title: null, cite: "project prj-alder002, title withheld: awaiting cleanup" });
});

test("an area names its projects when no project is named; a folder with no .brain resolves nothing", () => {
  const area = search(world(), "What is the budget?", { repo: "x", project: null, area: "area-tree0001" }).unresolved;
  assert.deepEqual(area!.subjects.map((s) => s.id).sort(), ["prj-alder001", "prj-alder002"]);
  assert.equal(search(world(), "What is the budget?").unresolved, null, "no name word and no area: no open project");
});

test("at most five, by their best note's rank then id, with the rest counted in more", () => {
  const notes = Array.from({ length: 7 }, (_, i) => [
    note(`prj-cedar00${i}`, "project", { title: `Cedar ${["one", "two", "three", "four", "five", "six", "seven"][i]}` }, ""),
    note(`mtg-cedar00${i}`, "meeting", { title: `Check-in ${i}`, projects: [`prj-cedar00${i}`] }, "The budget is set.\n"),
  ]).flat();
  const first = search(notes, "What is the Cedar budget?").unresolved!;
  assert.equal(first.subjects.length, 5);
  assert.equal(first.more, 2, "a list cut at five never reads as complete");
  assert.deepEqual(first.subjects.map((s) => s.id), ["prj-cedar000", "prj-cedar001", "prj-cedar002", "prj-cedar003", "prj-cedar004"], "equal ranks order by id");
  assert.deepEqual(search(notes, "What is the Cedar budget?").unresolved, first, "deterministic");
});

test("a question naming only an org lists its projects that hold the attribute (the user's choice of 2026-11-11, option A)", () => {
  const notes = [
    note("org-hazel001", "org", { title: "Hazel" }, ""),
    note("prj-hazel001", "project", { title: "Hazel portal", client: "org-hazel001" }, ""),
    note("prj-hazel002", "project", { title: "Hazel kiosk", client: "org-hazel001" }, ""),
    note("prj-hazel003", "project", { title: "Hazel signage", client: "org-hazel001" }, ""),
    note("mtg-hazel001", "meeting", { title: "Portal check-in", projects: ["prj-hazel001"] }, "The budget is €12,000.\n"),
    note("mtg-hazel002", "meeting", { title: "Kiosk check-in", projects: ["prj-hazel002"] }, "The budget is €3,000.\n"),
    note("mtg-hazel003", "meeting", { title: "Signage check-in", projects: ["prj-hazel003"] }, "The screens arrive in May.\n"),
  ];
  const { unresolved, candidates } = search(notes, "What is the Hazel budget?");
  assert.deepEqual(unresolved!.subjects.map((s) => s.id).sort(), ["prj-hazel001", "prj-hazel002"], "the org's projects that hold it, not the signage");
  assert.doesNotMatch(JSON.stringify(unresolved), /12,000|3,000/);
  assert.equal(search(notes, "What is the budget for the Hazel portal?").unresolved, null, "a named project resolves");
  assert.equal(search(notes, "When do the Hazel screens arrive?").unresolved, null, "one project holds it");
  assert.equal(search(notes, "What is the Hazel budget?", { repo: "x", project: "prj-hazel002", area: null }).unresolved?.subjects.length, 2, "the org named in the question is still the subject");
  assert.ok(candidates.length > 0);
  const withheldKiosk = (n: Note) => (n.id === "mtg-hazel002" ? null : n);
  assert.equal(search(notes, "What is the Hazel budget?", NONE, withheldKiosk).unresolved, null, "withheld evidence holds nothing");
});

test("a project holding under half of the strongest project's items is not listed (cli.md §5.13 unresolved, item 3)", () => {
  const notes = (second: string) => [
    note("prj-kite0001", "project", { title: "Kite booking app" }, ""),
    note("prj-kite0002", "project", { title: "Kite booking site" }, ""),
    note("mtg-kite0001", "meeting", { title: "App kickoff", projects: ["prj-kite0001"] }, "Patients get an SMS reminder a day before.\n"),
    note("mtg-kite0002", "meeting", { title: "Site kickoff", projects: ["prj-kite0002"] }, `${second}\n`),
  ];
  const question = "What did Kite say about patient reminders by text message?";
  assert.equal(search(notes("Patients can book online."), question).unresolved, null, "1 of the 3 items");
  assert.equal(search(notes("Patients get a reminder by email."), question).unresolved?.subjects.length, 2, "2 of the 3 items");
});

// ---- the command ----

test("brain query --candidates reports unresolved from an area's .brain, and not when the question names the project", async (context) => {
  const dir = await fixtureCopy(context);
  await mkdir(join(dir, "projects", "acme-mobile-app"), { recursive: true });
  await writeFile(join(dir, "projects", "acme-mobile-app", "project.md"), [
    "---", "id: prj-4k8m2q7t", "type: project", "title: Acme mobile app", "lifecycle: reviewed", "area: area-2m7c4h8n",
    "client: org-6d1f9z3k", "facts:", "  budget: 30000 EUR", "created: 2026-11-01", "updated: 2026-11-01", "---", "", "The mobile app's budget is agreed.", "",
  ].join("\n"));
  const repo = await mkdtemp(join(tmpdir(), "brain-query-area-"));
  context.after(() => rm(repo, { recursive: true, force: true }));
  await writeFile(join(repo, ".brain"), JSON.stringify({ repo: "clients", area: "area-2m7c4h8n" }));
  const ARGS = ["--brain", dir, "--json"];

  const asked = await brain(["query", "--candidates", "What is the budget?", "--repo", repo, ...ARGS]);
  assert.equal(asked.code, 0, asked.stdout);
  const unresolved = (asked.json as { data: { unresolved: { subjects: Array<{ id: string; title: string }>; more: number } } }).data.unresolved;
  assert.deepEqual(unresolved.subjects.map((s) => s.title).sort(), ["Acme mobile app", "Acme website"]);
  assert.equal(unresolved.more, 0);
  assert.doesNotMatch(JSON.stringify(unresolved), /30000|80000/);

  const org = await brain(["query", "--candidates", "What is the Acme budget?", ...ARGS]);
  assert.equal(org.code, 0, org.stdout);
  assert.deepEqual((org.json as { data: { unresolved: { subjects: Array<{ title: string }> } } }).data.unresolved.subjects.map((s) => s.title).sort(), ["Acme mobile app", "Acme website"], "a named org with two projects holding it (option A's hint)");

  const named = await brain(["query", "--candidates", "What is the budget for the Acme website?", "--repo", repo, ...ARGS]);
  assert.equal(named.code, 0, named.stdout);
  assert.equal("unresolved" in (named.json as { data: object }).data, false);
});

// ---- a memory candidate's confidence (cli.md §5.13; 0074 §2) ----

test("a memory candidate carries its schema confidence; no other type and no memory without one does", () => {
  const notes = [
    note("mem-conf0001", "memory", { title: "Reviewers like screenshots", confidence: "inferred", lifecycle: "reviewed" }, "Screenshots help reviewers. ^[inferred]\n"),
    note("mem-conf0002", "memory", { title: "Screenshots are attached to tickets", confidence: "verified", lifecycle: "reviewed" }, "Screenshots go on the ticket.\n"),
    note("mem-conf0003", "memory", { title: "Screenshots may speed reviews", confidence: "unverified", lifecycle: "reviewed" }, "Maybe screenshots help.\n"),
    note("mem-conf0004", "memory", { title: "Screenshots folder", lifecycle: "reviewed" }, "Screenshots live in the shared folder.\n"),
    note("mem-conf0005", "memory", { title: "Screenshots odd value", confidence: "certain", lifecycle: "reviewed" }, "Screenshots.\n"),
    note("dec-conf0006", "decision", { title: "Screenshots in every review", confidence: "inferred" }, "We attach screenshots.\n"),
  ];
  const types = new Set(["memory", "decision"]);
  const by = Object.fromEntries(searchCandidates(notes, queryTerms("screenshots"), types, NONE).candidates.map((c) => [c.id, c]));
  assert.equal(by["mem-conf0001"]!.confidence, "inferred");
  assert.equal(by["mem-conf0002"]!.confidence, "verified");
  assert.equal(by["mem-conf0003"]!.confidence, "unverified");
  for (const id of ["mem-conf0004", "mem-conf0005", "dec-conf0006"]) assert.equal("confidence" in by[id]!, false, id);
  const projected = (n: Note) => (n.id === "mem-conf0001" ? { ...n, attributes: { ...n.attributes, confidence: undefined } } as Note : n);
  const withoutIt = searchCandidates(notes, queryTerms("screenshots"), types, NONE, projected).candidates.find((c) => c.id === "mem-conf0001")!;
  assert.equal("confidence" in withoutIt, false, "read from the memory as the projection leaves it");
});

test("query --candidates on memory-0.12's brain: confidence on returned memories, the adapter's labels from it, and no draft, out-of-reach, excluded or superseded memory", async (context) => {
  const out = await mkdtemp(join(tmpdir(), "brain-confidence-"));
  context.after(() => rm(out, { recursive: true, force: true }));
  execFileSync("node", [join(REPO_ROOT, "eval/memory-0.12/make-brain.mjs"), out], { stdio: "ignore" });
  // memory-0.12's own adapter, unchanged, so its labels are what the scorer sees (an untyped .mjs module).
  const adapterUrl = new URL("../eval/memory-0.12/adapters/query-candidates.mjs", import.meta.url).href;
  const adapter = (await import(adapterUrl) as { default: { run: (c: object, env: object) => { output: string; candidates: Array<{ id: string; labels: string[] }> } } }).default;
  const ask = (question: string, caller: string) => {
    const run = adapter.run({ question }, { brain: join(out, "brain"), callerDir: join(out, "repos", caller) });
    const data = JSON.parse(run.output).data as { candidates: Array<{ id: string; type: string; confidence?: string }> };
    return { data, labels: new Map<string, string[]>(run.candidates.map((c) => [c.id, c.labels])) };
  };
  const inferred = ask("Should I send Velmor's reviewers screenshots of a UI change?", "harbor-web");
  assert.equal(inferred.data.candidates.find((c) => c.id === "mem-d51jce91")?.confidence, "inferred", "trust-19's memory");
  assert.ok(inferred.labels.get("mem-d51jce91")!.includes("inferred"), "the adapter labels it from the field");
  const verified = ask("No hard wrapping in Markdown", "scratch");
  assert.equal(verified.data.candidates.find((c) => c.id === "mem-1p1n8pz5")?.confidence, "verified");
  assert.ok(!verified.labels.get("mem-1p1n8pz5")!.includes("inferred"));
  for (const c of [...inferred.data.candidates, ...verified.data.candidates]) assert.equal("confidence" in c, c.type === "memory", c.id);
  const withheld: Array<[string, string, string]> = [
    ["Do Velmor's dispatchers prefer SMS alerts or email?", "harbor-api", "mem-wmt9qa5x"], // draft (trust-01)
    ["Which languages must the user-facing screens be written in?", "harbor-api", "mem-cbg7c697"], // out of reach (trust-05)
    ["What discount did Velmor get on the second year?", "harbor-api", "mem-5rmqmxn6"], // rests on the excluded paragraph (trust-10)
    ["What is Harbor's deploy freeze rule right now?", "harbor-web", "mem-k80mrmt1"], // superseded (trust-31)
  ];
  for (const [question, caller, id] of withheld) assert.ok(!ask(question, caller).data.candidates.some((c) => c.id === id), `${id} is not returned`);
});
