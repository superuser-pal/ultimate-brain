// score.mjs adapter for a native run (CC-200): replays what each session gave the user, as recorded by run.mjs.
// score.mjs loads adapters from adapters/, so it is named `--adapter ../native/adapter`; NATIVE_ANSWERS names the
// agent's answers.json: { agent, cases: { <case id>: { result } | { error } } }.
//   result: { answer: { text, citations }, output, reads, outcome?, cost }   (README "Adapters", answer level)
//   error:  why the session gave no answer (timed out, no reply…): the case fails with it as its cause
import { readFileSync } from "node:fs";

const file = process.env.NATIVE_ANSWERS;
if (!file) throw new Error("NATIVE_ANSWERS must name a run's <agent>/answers.json (run by native/run.mjs or native/results.mjs)");
const recorded = JSON.parse(readFileSync(file, "utf8"));

export default {
  name: `native-${recorded.agent}`,
  level: "answer",
  describe: `one fresh ${recorded.agent} session per case in its caller repo, on the packaged CLI (eval/memory-0.12/native/run.mjs)`,
  run(testCase) {
    const entry = recorded.cases[testCase.id];
    if (!entry) throw new Error(`no session recorded for ${testCase.id}`);
    if (entry.error) throw new Error(entry.error);
    return entry.result;
  },
};
