#!/usr/bin/env node
// The original 50 questions of eval/search-0.5, run on the original brain and compared with the 0.12.0 baseline's ranks
// (results-cc173.txt, `brain` rows), as spec/retrieval.md §6.2 "Originals kept" asks (CC-203).
// Usage: node eval/retrieval-0.13/originals.mjs <out-dir> [--cli <path to src/cli.ts>] [--rows]
// Each question is asked once, verbatim, with the default limit, from a folder with no `.brain` (as run.mjs does).
// Exit 1 when a question found in the first ten on the baseline no longer is, or first-rank count or MRR falls.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../..");
const args = process.argv.slice(2);
const out = args[0];
if (!out || out.startsWith("--")) {
  console.error("usage: originals.mjs <out-dir> [--cli <path to src/cli.ts>] [--rows]");
  process.exit(2);
}
const cli = args.includes("--cli") ? args[args.indexOf("--cli") + 1] : join(product, "src/cli.ts");
const questions = JSON.parse(readFileSync(join(product, "eval/search-0.5/questions.json"), "utf8"));
const baselineRows = readFileSync(join(product, "eval/search-0.5/results-cc173.txt"), "utf8").split("\n")
  .filter((line) => line.startsWith("brain\t")).map((line) => { const [, kind, rank, q] = line.split("\t"); return { kind, rank: rank === "-" ? null : Number(rank), q }; });
if (baselineRows.length !== questions.length) throw new Error(`results-cc173.txt has ${baselineRows.length} brain rows, not ${questions.length}`);

const stats = (ranks) => ({ r1: ranks.filter((r) => r === 1).length, r5: ranks.filter((r) => r && r <= 5).length, r10: ranks.filter((r) => r && r <= 10).length, mrr: ranks.reduce((s, r) => s + (r ? 1 / r : 0), 0) / ranks.length });
const rows = questions.map((q, i) => {
  const stdout = execFileSync("node", [cli, "query", "--candidates", q.q, "--repo", join(out, "repos", "scratch"), "--json"], { env: { ...process.env, BRAIN_DIR: join(out, "original") }, encoding: "utf8" });
  const ids = JSON.parse(stdout).data.candidates.map((c) => c.id);
  const rank = ids.indexOf(q.answer) + 1 || null;
  if (baselineRows[i].q !== q.q) throw new Error(`question ${i + 1} differs from results-cc173.txt`);
  return { kind: q.kind, q: q.q, baseline: baselineRows[i].rank, rank };
});
const lost = rows.filter((r) => r.baseline && !r.rank);
const before = stats(rows.map((r) => r.baseline));
const after = stats(rows.map((r) => r.rank));
console.log(`cli: ${relative(product, cli)}`);
console.log("\n| kind | recall@1 | recall@5 | recall@10 | MRR | baseline (cc173) |\n|---|---|---|---|---|---|");
for (const kind of [...new Set(rows.map((r) => r.kind)), "all"]) {
  const of = rows.filter((r) => kind === "all" || r.kind === kind);
  const a = stats(of.map((r) => r.rank));
  const b = stats(of.map((r) => r.baseline));
  console.log(`| ${kind === "all" ? "**all**" : kind} | ${a.r1}/${of.length} | ${a.r5}/${of.length} | ${a.r10}/${of.length} | ${a.mrr.toFixed(2)} | ${b.r1}/${b.r5}/${b.r10}, ${b.mrr.toFixed(2)} |`);
}
const pass = lost.length === 0 && after.r1 >= before.r1 && after.mrr >= before.mrr - 1e-9;
console.log(`\nkept in the first ten: ${rows.filter((r) => r.baseline && r.rank).length}/${rows.filter((r) => r.baseline).length}; first rank ${after.r1} (baseline ${before.r1}); MRR ${after.mrr.toFixed(4)} (baseline ${before.mrr.toFixed(4)}): ${pass ? "pass" : "FAIL"}`);
for (const r of lost) console.log(`lost: ${r.kind}: ${r.q} (baseline rank ${r.baseline})`);
if (args.includes("--rows")) console.log(`\n## Rows\n\n${rows.map((r) => `${r.kind}\t${r.baseline ?? "-"}\t${r.rank ?? "-"}\t${r.q}`).join("\n")}`);
if (!pass) process.exit(1);
