// Adapter: hand-written correct answers (reference-answers.json), citing each case's expected evidence.
// It checks the answer-level rules, not a product: every case must pass, or a case or a rule is wrong.
// An entry is the answer's text, or (CC-185) { text, outcome } for a case judged on its outcome: `outcome.proposals`
// and `outcome.notes` follow the case's `outcomes` in order (a status and reason, the target's text after the run),
// `created` lists the proposals the run wrote, and `repo` is the upgraded repo's state.
import { readFileSync } from "node:fs";

const ANSWERS = JSON.parse(readFileSync(new URL("../reference-answers.json", import.meta.url), "utf8"));

export default {
  name: "reference-answers",
  level: "answer",
  describe: "reference-answers.json, citing each case's expected evidence (a check of the scoring rules)",
  run(testCase) {
    const entry = ANSWERS[testCase.id];
    if (entry === undefined) throw new Error(`no reference answer for ${testCase.id}`);
    if (typeof entry === "string") return { answer: { text: entry, citations: testCase.expected_evidence } };
    const answer = { text: entry.text, citations: testCase.expected_evidence };
    const o = entry.outcome;
    if (!o) return { answer };
    const outcomes = testCase.outcomes ?? [];
    const outcome = {
      proposals: Object.fromEntries(outcomes.map((x, i) => [x.proposal, o.proposals[i]])),
      notes: Object.fromEntries(outcomes.map((x, i) => [x.target, o.notes[i]])),
      created: o.created ?? [],
      ...(testCase.upgrade ? { repos: { [testCase.upgrade.repo]: { managed_block: o.repo.managed_block, project_text_sha256: o.repo.unchanged ? testCase.upgrade.project_text_sha256 : "changed" } } } : {}),
    };
    return { answer, outcome };
  },
};
