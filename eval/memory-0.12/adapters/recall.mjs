// Adapter: 0.12.0's `brain recall` (spec/cli.md §5.33), mapped onto the cases as spec/memory.md §8 says (CC-172).
//
//   opening cases   a case with a `handover` (agent switch, later session) or a task row the caller works on:
//                   brain recall --pack --repo <caller folder> --task <question> --json
//                   The pack's work rows and memories are the candidates, in the pack's order. The question stands in
//                   for the task text: it is what the user asks at the start of the session.
//   other cases     targeted recall and the knowledge question, both run, in this order:
//                   brain recall --search <question> --limit 10 --include-superseded --repo <caller folder> --json
//                   brain query --candidates <question> --limit 10 --repo <caller folder> --json   (default types)
//                   `--include-superseded` because the correction cases need the old memory too, labelled; the
//                   default types leave memories out, so memories come only through recall (eligibility, §2).
//
// Labels: `superseded` for a search result with `superseded_by` and for a query candidate that is archived or has
// `assessment: superseded`; `inferred` for a memory whose confidence is inferred; `contested` for a contested note.
// Cost: an opening case reports the pack's `text` measured with gpt-tokenizer 4.1.0, o200k_base (the tokenizer
// eval/retrieval-0.12 names), beside the CLI's estimate and the budget; a later case reports both commands' JSON
// output measured the same way, since that is what reaches the agent.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";

const CLI = fileURLToPath(new URL("../../../src/cli.ts", import.meta.url));
const LIMIT = 10;
export const TOKENIZER = "gpt-tokenizer 4.1.0, encoding o200k_base";

/** Runs the CLI against the case's brain; never falls back to a default brain. */
function brain(env, args) {
  const started = process.hrtime.bigint();
  const stdout = execFileSync("node", [CLI, ...args, "--json"], { env: { ...process.env, BRAIN_DIR: env.brain }, encoding: "utf8" });
  const parsed = JSON.parse(stdout);
  if (!parsed.ok) throw new Error(`${args[0]} failed: ${parsed.error?.code ?? "?"}`);
  return { data: parsed.data, stdout, bytes: Buffer.byteLength(stdout, "utf8"), ms: Number(process.hrtime.bigint() - started) / 1e6 };
}

const memoryLabels = (m) => [...(m.superseded_by ? ["superseded"] : []), ...(m.confidence === "inferred" ? ["inferred"] : [])];
const noteLabels = (c) => [
  ...(c.lifecycle === "archived" || c.assessment === "superseded" ? ["superseded"] : []),
  ...(c.assessment === "contested" ? ["contested"] : []),
];

export const isOpening = (testCase) => Boolean(testCase.handover || testCase.caller.task);

export default {
  name: "recall",
  level: "retrieval",
  describe: `opening cases (a handover or a task): brain recall --pack --repo <caller folder> --task <question>; other cases: brain recall --search <question> --limit ${LIMIT} --include-superseded --repo <caller folder>, then brain query --candidates <question> --limit ${LIMIT} --repo <caller folder> (default types)`,
  run(testCase, env) {
    if (isOpening(testCase)) {
      const pack = brain(env, ["recall", "--pack", "--repo", env.callerDir, "--task", testCase.question]);
      const { data } = pack;
      const repo = testCase.caller.repo;
      const candidates = [
        ...data.work.map((w) => ({ id: `repo:${repo}/${w.source}#${w.task}`, labels: [] })),
        ...data.memories.map((m) => ({ id: m.id, labels: memoryLabels(m) })),
      ];
      const textBytes = Buffer.byteLength(data.text, "utf8");
      return {
        candidates,
        cost: {
          phase: "opening", tokens: countTokens(data.text), estimate: data.tokens, estimateFromBytes: Math.ceil(textBytes / 3),
          budget: data.budget, textBytes, omitted: data.omitted, workUnread: data.work_unread, bytes: pack.bytes, ms: pack.ms,
        },
      };
    }
    const search = brain(env, ["recall", "--search", testCase.question, "--limit", String(LIMIT), "--include-superseded", "--repo", env.callerDir]);
    const query = brain(env, ["query", "--candidates", testCase.question, "--limit", String(LIMIT), "--repo", env.callerDir]);
    const candidates = [
      ...search.data.results.map((m) => ({ id: m.id, labels: memoryLabels(m) })),
      ...query.data.candidates.map((c) => ({ id: c.id, labels: noteLabels(c) })),
    ];
    return {
      candidates,
      cost: { phase: "later", tokens: countTokens(search.stdout) + countTokens(query.stdout), bytes: search.bytes + query.bytes, ms: search.ms + query.ms },
    };
  },
};
