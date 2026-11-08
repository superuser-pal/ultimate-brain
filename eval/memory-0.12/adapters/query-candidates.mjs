// Adapter: today's `brain query --candidates` (spec/cli.md §5.13), the 0.12.0 baseline retriever.
// It searches the default types plus `memory` (the default leaves memories out, which would fail every memory case
// for a trivial reason). The query applies the restricted-evidence rule (0055) but not memory reach (0009), approval
// or supersession filtering, so the scope, approval and supersession cases measure exactly that gap.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../../../src/cli.ts", import.meta.url));
const TYPES = "area,goal,project,person,org,meeting,decision,question,concept,reference,source,memory";
const LIMIT = 10;

export default {
  name: "query-candidates",
  level: "retrieval",
  describe: `brain query --candidates <question> --limit ${LIMIT} --types ${TYPES} --repo <caller folder>`,
  /** One case → the ranked candidates, each with the labels the output carries. */
  run(testCase, env) {
    const started = process.hrtime.bigint();
    const stdout = execFileSync("node", [CLI, "query", "--candidates", testCase.question, "--limit", String(LIMIT), "--types", TYPES, "--repo", env.callerDir, "--json"], {
      env: { ...process.env, BRAIN_DIR: env.brain }, encoding: "utf8",
    });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const candidates = JSON.parse(stdout).data.candidates.map((c) => ({
      id: c.id,
      labels: [
        ...(c.lifecycle === "archived" || c.assessment === "superseded" ? ["superseded"] : []),
        ...(c.confidence === "inferred" ? ["inferred"] : []), // not in today's output (§5.13), so never set
        ...(c.assessment === "contested" ? ["contested"] : []),
      ],
    }));
    return { candidates, cost: { phase: "later", bytes: Buffer.byteLength(stdout, "utf8"), ms } };
  },
};
