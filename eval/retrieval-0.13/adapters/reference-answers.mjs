// Adapter: hand-written correct answers (cases.mjs `ref`, resolved into reference-answers.json). A check that every answer
// rule can be met; not acceptance (spec/retrieval.md §6.2).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const answers = JSON.parse(readFileSync(fileURLToPath(new URL("../reference-answers.json", import.meta.url)), "utf8"));

export default {
  name: "reference-answers",
  level: "answer",
  describe: "eval/retrieval-0.13/reference-answers.json",
  run(testCase) {
    const answer = answers[testCase.id];
    if (!answer) throw new Error(`no reference answer for ${testCase.id}`);
    return { answer };
  },
};
