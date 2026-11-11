import assert from "node:assert/strict";
import { test } from "node:test";

import { audit, median, percentile, scoreAnswer, scoreRetrieval } from "../eval/retrieval-0.13/lib.mjs";

// eval/retrieval-0.13's scoring and audit rules (CC-203; spec/retrieval.md §5.5, §6), on synthetic cases and a stand-in brain.

const fact = (says, ...all) => ({ says, all });
const factCase = { id: "f", kind: "fact", split: "dev", caller: "scratch", question: "What is the budget for the Alder app?", evidence_sets: [["prj-a"], ["mtg-a", "src-a"]], facts: [fact("€40,000", "40[,. ]?000")], forbidden_facts: [], forbidden_evidence: [], audit: "x" };
const clarifyCase = {
  id: "c", kind: "clarify", split: "dev", caller: "scratch", question: "What is the Alder budget?", audit: "x", forbidden_evidence: [],
  subjects: [{ id: "prj-a", name: "app", value: fact("€40,000", "40[,. ]?000"), evidence: ["prj-a"] }, { id: "prj-b", name: "site", value: fact("€9,000", "\\b9[,. ]?000"), evidence: ["prj-b"] }],
  forbidden_facts: [fact("€40,000", "40[,. ]?000"), fact("€9,000", "\\b9[,. ]?000")],
};
const unknownCase = { id: "u", kind: "unknown", split: "dev", caller: "scratch", question: "What is the Alder site's warranty?", absent: [{ about: "prj-b", none: ["warrant"] }], facts: [], forbidden_facts: [], forbidden_evidence: [], audit: "x" };

test("retrieval level: a fact passes only when one whole evidence set is in the first ten", () => {
  assert.equal(scoreRetrieval(factCase, ["x", "prj-a"]).pass, true);
  assert.equal(scoreRetrieval(factCase, ["x", "prj-a"]).rank, 2);
  assert.equal(scoreRetrieval(factCase, ["mtg-a", "src-a"]).pass, true);
  assert.equal(scoreRetrieval(factCase, ["prj-a"]).prose, false, "a typed field alone is not prose");
  assert.equal(scoreRetrieval({ ...factCase, evidence_sets: [["prj-a"], ["mtg-a"]] }, ["prj-a", "mtg-a"]).prose, true);
  assert.equal(scoreRetrieval(factCase, ["mtg-a", "x"]).pass, false, "half of a set is not a set");
  const late = [...Array.from({ length: 10 }, (_, i) => `n${i}`), "prj-a"];
  assert.equal(scoreRetrieval(factCase, late).pass, false, "the eleventh result does not count: no higher limit");
  assert.equal(scoreRetrieval({ ...factCase, forbidden_evidence: ["x"] }, ["x", "prj-a"]).pass, false);
});

test("retrieval level: a clarify case needs evidence of two subjects in the first ten", () => {
  assert.equal(scoreRetrieval(clarifyCase, ["prj-b", "prj-a"]).pass, true);
  assert.equal(scoreRetrieval(clarifyCase, ["prj-a", "x"]).pass, false);
  assert.equal(scoreRetrieval(unknownCase, ["anything"]).pass, true, "unknown is reported, not gated, at this level");
});

test("answer level: answerable, clarify and unknown rules", () => {
  assert.deepEqual(scoreAnswer(factCase, { text: "The Alder app's budget is €40,000 [prj-a].", citations: ["prj-a"] }), []);
  assert.match(scoreAnswer(factCase, { text: "The budget is €40,000.", citations: ["mtg-a"] }).join(), /complete evidence set/);
  assert.match(scoreAnswer(factCase, { text: "It's not recorded, maybe €40,000.", citations: ["prj-a"] }).join(), /abstained/);
  assert.match(scoreAnswer({ ...factCase, as_of: fact("for 2026", "2026") }, { text: "€40,000 [prj-a]", citations: ["prj-a"] }).join(), /time qualification/);
  assert.deepEqual(scoreAnswer(clarifyCase, { text: "Do you mean the Alder app or the Alder site?", citations: [] }), []);
  assert.match(scoreAnswer(clarifyCase, { text: "The app has €40,000 and the site €9,000. Which one?", citations: [] }).join(), /states a subject's value/, "listing every value is not the default");
  assert.match(scoreAnswer(clarifyCase, { text: "The Alder app's budget is €40,000.", citations: ["prj-a"] }).join(), /asks no question/, "silently picking one subject fails");
  assert.match(scoreAnswer(clarifyCase, { text: "Which Alder project?", citations: [] }).join(), /names 0/);
  assert.deepEqual(scoreAnswer(unknownCase, { text: "No warranty is recorded for the Alder site.", citations: [] }), []);
  assert.match(scoreAnswer(unknownCase, { text: "The warranty is 12 months.", citations: [] }).join(), /lacks the answer/);
});

/** A valid set of 80 cases (20 per kind, 6 held each) and a brain where every rule holds. */
function validSet() {
  const cases = [];
  for (const [kind, base] of [["fact", factCase], ["paraphrase", { ...factCase, kind: "paraphrase" }], ["clarify", clarifyCase], ["unknown", unknownCase]]) {
    for (let i = 0; i < 20; i++) {
      const subgroup = kind === "fact" ? (i < 7 ? "body-only" : i < 19 ? "structured" : "decision") : undefined;
      cases.push({ ...base, id: `${kind}-${i}`, split: i < 6 ? "held" : "dev", ...(subgroup ? { subgroup } : {}) });
    }
  }
  return { callers: { scratch: {}, "a-folder": { project: "prj-a" }, area: { area: "area-1" } }, project_area: { "prj-a": "area-1", "prj-b": "area-2" }, project_titles: { "prj-a": "Alder app", "prj-b": "Alder site" }, cases };
}
function validBrain() {
  const texts = { "prj-a": "budget 40000 EUR", "mtg-a": "the approved spend is €40,000", "src-a": "minutes", "prj-b": "budget 9000 EUR" };
  return {
    eligible: (ids) => new Map(ids.map((id) => [id, texts[id] ?? null])),
    about: (id) => (id === "prj-b" ? [{ id: "prj-b", text: "budget 9000 EUR" }] : []),
    suppressions: 0, originalChanged: [], questionsChanged: false,
  };
}
const problemsOf = (set, brain) => audit(set, brain).map((p) => `${p.case}: ${p.problem}`);

test("the audit passes a valid set and fails each planted defect", () => {
  assert.deepEqual(problemsOf(validSet(), validBrain()), []);
  const planted = (change, brainChange = (b) => b) => { const set = validSet(); change(set); return problemsOf(set, brainChange(validBrain())); };
  assert.match(planted((s) => { s.cases[0].question = "Is the Alder app's budget €40,000?"; }).join(), /holds its own answer/);
  assert.match(planted((s) => { s.cases[0].facts = [fact("€50,000", "50[,. ]?000")]; }).join(), /does not hold: €50,000/);
  assert.match(planted(() => {}, (b) => ({ ...b, eligible: (ids) => new Map(ids.map((id) => [id, id === "prj-a" ? null : "€40,000"])) })).join(), /not eligible for the caller: prj-a/);
  assert.match(planted((s) => { s.cases[45].caller = "a-folder"; }).join(), /caller's project resolves/);
  assert.match(planted((s) => { s.cases[45].caller = "area"; }).join(), /caller's area resolves/);
  assert.match(planted((s) => { s.cases[45].question = "What is the Alder app budget?"; }).join(), /names Alder app/);
  assert.match(planted((s) => { s.cases[45].subjects = [s.cases[45].subjects[0]]; }).join(), /fewer than two subjects/);
  assert.match(planted(() => {}, (b) => ({ ...b, about: () => [{ id: "prj-b", text: "warranty 12 months" }] })).join(), /holds what the case says is absent/);
  assert.match(planted(() => {}, (b) => ({ ...b, suppressions: 1 })).join(), /suppression record/);
  assert.match(planted(() => {}, (b) => ({ ...b, originalChanged: ["knowledge/x.md"] })).join(), /changed an original note/);
  assert.match(planted(() => {}, (b) => ({ ...b, questionsChanged: true })).join(), /questions.json changed/);
  assert.match(planted((s) => { s.cases.pop(); }).join(), /unknown: 19 cases, not 20/);
  assert.match(planted((s) => { s.cases[10].split = "held"; }).join(), /fact: 7 held cases, not 6/);
  assert.match(planted((s) => { s.cases[1].id = s.cases[0].id; }).join(), /duplicate case id/);
  assert.match(planted((s) => { s.cases[0].subgroup = "structured"; }).join(), /fact subgroup body-only: 6 cases, not 7/);
});

test("median and nearest-rank 95th percentile", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(percentile(Array.from({ length: 20 }, (_, i) => i + 1), 95), 19);
  assert.equal(percentile([5], 95), 5);
});
