// CC-204: the comparison variant of the ranking (eval/retrieval-0.13/compare/query-variant.ts) at spec/retrieval.md §2's
// trust seams and §7.3's checks, run in a temporary checkout (compare/checkout.mjs) as compare/run.mjs runs it. The variant
// takes its notes only from the `eligible` projection it is given, as the product's rankCandidates does.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { variantCheckout } from "../eval/retrieval-0.13/compare/checkout.mjs";

const root = variantCheckout();
after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
const variant = await import(pathToFileURL(join(root, "src/lib/query.ts")).href);
const product = await import("../src/lib/query.ts");

const NONE = { repo: null, project: null, area: null };
const TYPES = product.queryTypes(undefined);
const CHOSEN = "C2,C3,C4";
const ALL = "C1,C2,C3,C3a,C3d,C4";

function note(id, type, attributes, body = "") {
  const front = Object.entries(attributes).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
  return { id, type, path: `knowledge/${id}.md`, attributes: { id, type, ...attributes }, body, raw: `---\n${front}\n---\n${body}` };
}
function withVariant(name, fn) {
  const before = process.env.UB_RETRIEVAL_VARIANT;
  process.env.UB_RETRIEVAL_VARIANT = name;
  try { return fn(); } finally { if (before === undefined) delete process.env.UB_RETRIEVAL_VARIANT; else process.env.UB_RETRIEVAL_VARIANT = before; }
}
const rank = (name, notes, question, context = NONE, eligible = undefined, types = TYPES) =>
  withVariant(name, () => variant.rankCandidates(notes, variant.queryTerms(question), types, context, eligible));

const world = () => [
  note("prj-alder", "project", { title: "Alder app", facts: { budget: "40000 EUR", team_size: 4 } }, "A booking app.\n"),
  note("prj-birch", "project", { title: "Birch site", facts: { budget: "9000 EUR" } }, "A public website.\n"),
  note("mtg-alder", "meeting", { title: "Alder app check-in", projects: ["prj-alder"] }, "## Summary\nThe money for the rest of the year is €40,000.\n\nThe team reviewed the tickets.\n"),
  note("mtg-birch", "meeting", { title: "Birch site check-in", projects: ["prj-birch"] }, "## Summary\nThe money for the build is €9,000.\n"),
  note("dec-alder", "decision", { title: "Alder app: card payments", projects: ["prj-alder"] }, "Card payments go through a provider.\n"),
];

test("with no change named, and with C0 (the variant path, every change off), the ranking is the product's", () => {
  for (const question of ["What is the budget for the Alder app?", "money", "Alder check-in"]) {
    const expected = product.rankCandidates(world(), product.queryTerms(question), TYPES, NONE);
    assert.deepEqual(rank("", world(), question), expected);
    assert.deepEqual(rank("C0", world(), question), expected);
  }
});

test("recall's memory-only ranking takes the unchanged path whatever is named (spec/retrieval.md §1)", () => {
  const memories = [note("mem-a", "memory", { title: "Budgets are approved monthly" }, "budget money\n"), note("mem-b", "memory", { title: "Money" }, "spend\n")];
  const types = product.queryTypes("memory");
  assert.deepEqual(rank(ALL, memories, "budgets", NONE, undefined, types), product.rankCandidates(memories, product.queryTerms("budgets"), types, NONE));
});

test("C2 and C3 find the prose answer for the subject the question names", () => {
  const ids = rank(CHOSEN, world(), "What is the budget for the Alder app?").map((c) => c.id);
  assert.ok(ids.indexOf("mtg-alder") < ids.indexOf("mtg-birch") || !ids.includes("mtg-birch"));
  assert.ok(ids.slice(0, 2).includes("mtg-alder"), `the Alder money meeting is in the first two: ${ids.join(", ")}`);
});

test("a withheld note adds no term, no document frequency and no subject (§2.1, §2.4)", () => {
  const notes = [...world(), note("prj-cedar", "project", { title: "Alder app budget" }, "money money money\n")];
  const withheld = (n) => (n.id === "prj-cedar" ? null : n);
  for (const name of [CHOSEN, ALL]) {
    assert.deepEqual(rank(name, notes, "What is the budget for the Alder app?", NONE, withheld), rank(name, world(), "What is the budget for the Alder app?"));
  }
});

test("a fact the projection drops adds no term and no snippet (§2.2)", () => {
  const dropped = (n) => (n.id === "prj-alder" ? { ...n, attributes: { ...n.attributes, facts: {} } } : n);
  for (const name of [CHOSEN, ALL]) {
    const ranked = rank(name, world(), "Alder app budget", NONE, dropped);
    const alder = ranked.find((c) => c.id === "prj-alder");
    assert.ok(!alder || alder.snippets.every((s) => !/budget|40000/.test(s.text)), "no snippet shows the dropped fact");
    const kept = rank(name, world(), "Alder app budget").find((c) => c.id === "prj-alder");
    if (name === CHOSEN) assert.ok(kept.snippets.some((s) => s.text === "facts.budget: 40000 EUR"), "C4 shows a kept fact");
  }
});

test("an equivalence never surfaces a blanked line (§2.6)", () => {
  const blanked = (n) => (n.id === "mtg-alder" ? { ...n, body: n.body.replace(/^The money.*$/m, (line) => " ".repeat(line.length)) } : n);
  for (const name of [CHOSEN, ALL]) {
    for (const c of rank(name, world(), "What is the budget for the Alder app?", NONE, blanked)) {
      for (const s of c.snippets) assert.ok(!/40,000|money/.test(s.text) || c.id !== "mtg-alder", `${c.id} line ${s.line}: ${s.text}`);
    }
  }
});

test("a note whose title the projection withholds names no subject (§2.4)", () => {
  // The awaiting-cleanup form flags the note; even with its title text still present (the guard, not the projection's removal,
  // is what is tested), it names no subject. Compared with the same note as a type that is never a subject (same BM25 lengths).
  const cleanup = (n) => (n.id === "prj-alder" ? { ...n, titleWithheld: true } : n);
  const notSubject = (n) => (n.id === "prj-alder" ? { ...n, type: "reference", attributes: { ...n.attributes, type: "referenc" } } : n);
  const question = "What is the budget for the Alder app?";
  const score = (eligible) => rank(CHOSEN, world(), question, NONE, eligible).find((c) => c.id === "mtg-alder")?.score;
  // With the title withheld, the meeting gets no subject bonus: the same score as when no subject is titled "Alder app".
  assert.equal(score(cleanup), score(notSubject));
  assert.ok(score((n) => n) > score(cleanup), "with the title eligible, the subject is resolved and its note ranks higher");
});

test("the caller's context resolves a subject but never adds a note (§2.5)", () => {
  const context = { repo: "alder", project: "prj-alder", area: null };
  const withheldMeeting = (n) => (n.id === "mtg-alder" ? null : n);
  const ids = rank(ALL, world(), "money", context, withheldMeeting).map((c) => c.id);
  assert.ok(!ids.includes("mtg-alder"));
});

test("accent folding and CJK n-grams are unchanged with every change on (§1, §7.3)", () => {
  const notes = [note("ref-cafe", "reference", { title: "Café vouchers" }, "Vouchers for the café.\n"), note("ref-cjk", "reference", { title: "東京の予算" }, "東京の予算は五万です。\n")];
  assert.deepEqual(rank(ALL, notes, "cafe").map((c) => c.id), ["ref-cafe"]);
  assert.deepEqual(rank(ALL, notes, "予算").map((c) => c.id), ["ref-cjk"]);
});

test("C2w's suffix rule (spec/retrieval.md §4 C2)", () => {
  const cases = { budgets: "budget", launching: "launch", launched: "launch", copies: "copy", planned: "plan", raise: "rais", raised: "rais", releases: "releas", status: "status", speed: "speed", string: "string", "2026": "2026", app: "app" };
  for (const [word, stem] of Object.entries(cases)) assert.equal(variant.stem(word), stem, word);
});

test("CC-205: the product's searchCandidates ranks and shows snippets as the measured chosen set does (C2,C3,C4)", () => {
  const contexts = [NONE, { repo: "alder", project: "prj-alder", area: null }];
  const withheld = (n) => (n.id === "mtg-birch" ? null : n);
  for (const question of ["What is the budget for the Alder app?", "money", "Alder check-in", "card payments", "Birch budgets"]) {
    for (const context of contexts) {
      for (const eligible of [undefined, withheld]) {
        const { candidates } = product.searchCandidates(world(), product.queryTerms(question), TYPES, context, eligible);
        assert.deepEqual(candidates, rank(CHOSEN, world(), question, context, eligible), `${question} ${JSON.stringify(context)}`);
      }
    }
  }
});
