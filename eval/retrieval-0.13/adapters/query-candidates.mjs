// Adapter: the first search (spec/retrieval.md §1): one `brain query --candidates "<question>" --repo <caller> --json`, the
// question verbatim, the default limit and types. No retry, no higher limit, no second query.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../../../src/cli.ts", import.meta.url));

export default {
  name: "query-candidates",
  level: "retrieval",
  describe: "brain query --candidates <question> --repo <caller folder> --json (default limit 10, default types)",
  run(testCase, env) {
    const started = process.hrtime.bigint();
    const stdout = execFileSync("node", [env.cli ?? CLI, "query", "--candidates", testCase.question, "--repo", env.callerDir, "--json"], {
      env: { ...process.env, BRAIN_DIR: env.brain }, encoding: "utf8",
    });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const data = JSON.parse(stdout).data;
    // The ids `unresolved` names (spec/cli.md §5.13), when the CLI has the key (0.13.0 on).
    const unresolved = (data.unresolved?.subjects ?? []).map((s) => s.id);
    return { candidates: data.candidates.map((c) => c.id), unresolved, output: stdout, cost: { bytes: Buffer.byteLength(stdout, "utf8"), ms } };
  },
};
