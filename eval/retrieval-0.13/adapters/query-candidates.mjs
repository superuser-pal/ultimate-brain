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
    const candidates = JSON.parse(stdout).data.candidates.map((c) => c.id);
    return { candidates, output: stdout, cost: { bytes: Buffer.byteLength(stdout, "utf8"), ms } };
  },
};
