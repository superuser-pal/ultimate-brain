// Adapter: hand-written correct answers (reference-answers.json), citing each case's expected evidence.
// It checks the answer-level rules, not a product: every case must pass, or a case or a rule is wrong.
import { readFileSync } from "node:fs";

const ANSWERS = JSON.parse(readFileSync(new URL("../reference-answers.json", import.meta.url), "utf8"));

export default {
  name: "reference-answers",
  level: "answer",
  describe: "reference-answers.json, citing each case's expected evidence (a check of the scoring rules)",
  run(testCase) {
    const text = ANSWERS[testCase.id];
    if (text === undefined) throw new Error(`no reference answer for ${testCase.id}`);
    return { answer: { text, citations: testCase.expected_evidence } };
  },
};
