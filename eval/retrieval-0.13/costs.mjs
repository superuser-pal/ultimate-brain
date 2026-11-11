#!/usr/bin/env node
// Paired latency and output-token costs of the first search, baseline against candidate (CC-203; spec/retrieval.md §7).
// Usage: node eval/retrieval-0.13/costs.mjs <out-dir> --baseline <checkout> --candidate <checkout> [--reps 5] [--json]
// <checkout> is a folder with this repo's `src/` (a worktree of the matched baseline, and one of the candidate).
// The 130 questions are the 80 cases (on <out-dir>/brain, from their caller folders) and the 50 originals (on
// <out-dir>/original, from a folder with no `.brain`).
//   - Search latency: one cold `node <checkout>/src/cli.ts query --candidates … --json` process per question and side.
//   - In-process ranking time: each side's own `rankCandidates` over notes it has already scanned (file reading not counted).
//   Both are paired and interleaved: one discarded warm-up pass, then --reps passes, the two sides alternating and their
//   order swapped every pass and every question; a question's time is the median of its passes; the statistics are the
//   median and the 95th percentile (nearest rank) over the questions; the gate is candidate / baseline <= 1.25 for each.
//   - Output tokens: the `--json` stdout, counted with gpt-tokenizer 4.1.0, o200k_base (eval/retrieval-0.12's pinned,
//   measurement-only package: `npm ci --prefix eval/retrieval-0.12 --ignore-scripts`). Bytes are printed beside them.
//   - Full filtered reads (reported, not gated): `query --read` of the first evidence set of each answerable case.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cpus, loadavg, release, totalmem, type } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { median, percentile } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../..");
const args = process.argv.slice(2);
const out = args[0];
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const sides = { baseline: option("--baseline"), candidate: option("--candidate") };
const reps = Number(option("--reps", "5"));
if (!out || out.startsWith("--") || !sides.baseline || !sides.candidate || !(reps >= 1)) {
  console.error("usage: costs.mjs <out-dir> --baseline <checkout> --candidate <checkout> [--reps 5] [--json]");
  process.exit(2);
}
const LIMIT_RATIO = 1.25;

const tokenizerRequire = createRequire(join(product, "eval/retrieval-0.12/package.json"));
let countTokens;
try {
  const version = JSON.parse(readFileSync(tokenizerRequire.resolve("gpt-tokenizer/package.json"), "utf8")).version;
  if (version !== "4.1.0") throw new Error(`gpt-tokenizer ${version}, not 4.1.0`);
  ({ countTokens } = await import(pathToFileURL(tokenizerRequire.resolve("gpt-tokenizer/encoding/o200k_base")).href));
} catch (error) {
  console.error(`the pinned tokenizer is missing (${error.message}): npm ci --prefix eval/retrieval-0.12 --ignore-scripts`);
  process.exit(2);
}

const set = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const originals = JSON.parse(readFileSync(join(product, "eval/search-0.5/questions.json"), "utf8"));
const scratch = join(out, "repos", "scratch");
const questions = [
  ...set.cases.map((c) => ({ label: c.id, q: c.question, brain: join(out, "brain"), caller: join(out, "repos", c.caller), read: c.evidence_sets?.[0] })),
  ...originals.map((q, i) => ({ label: `orig-${String(i + 1).padStart(2, "0")}`, q: q.q, brain: join(out, "original"), caller: scratch })),
];

// ---- one cold CLI run ----
function cliRun(side, q) {
  const started = process.hrtime.bigint();
  const stdout = execFileSync("node", [join(resolve(sides[side]), "src/cli.ts"), "query", "--candidates", q.q, "--repo", q.caller, "--json"], { env: { ...process.env, BRAIN_DIR: q.brain }, encoding: "utf8" });
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, stdout };
}

// ---- in-process ranking, each side with its own modules (as src/commands/query.ts builds the call) ----
async function rankerFor(side) {
  const root = resolve(sides[side]);
  const load = (path) => import(pathToFileURL(join(root, "src/lib", path)).href);
  const [notesLib, supp, report, query] = await Promise.all([load("notes.ts"), load("suppressions.ts"), load("report-body.ts"), load("query.ts")]);
  const prepared = new Map();
  const prepare = async (brain) => {
    if (prepared.has(brain)) return prepared.get(brain);
    const scanned = await notesLib.scanNotes(brain);
    const loaded = supp.requireSuppressions(brain);
    const eligibility = supp.contextFor(scanned.notes, loaded);
    const byId = new Map(scanned.notes.map((n) => [n.id, n]));
    const { existsSync } = await import("node:fs");
    const eligibleOf = (n) => (n.type === "view" ? supp.eligibleView(n, report.viewLinks(scanned.notes, n, (p) => existsSync(join(brain, p))), byId, eligibility) : supp.eligibleNote(n, eligibility));
    const value = { notes: scanned.notes, eligibleOf, loaded };
    prepared.set(brain, value);
    return value;
  };
  for (const brain of new Set(questions.map((q) => q.brain))) await prepare(brain);
  const contexts = new Map();
  for (const q of questions) if (!contexts.has(q.caller)) contexts.set(q.caller, await query.queryContext(q.caller));
  return (q) => {
    const { notes, eligibleOf } = prepared.get(q.brain);
    const started = process.hrtime.bigint();
    query.rankCandidates(notes, query.queryTerms(q.q), query.queryTypes(undefined), contexts.get(q.caller), eligibleOf).slice(0, 10);
    return Number(process.hrtime.bigint() - started) / 1e6;
  };
}

const load = loadavg();
const rankers = { baseline: await rankerFor("baseline"), candidate: await rankerFor("candidate") };
const times = { cli: { baseline: [], candidate: [] }, rank: { baseline: [], candidate: [] } };
for (const side of ["baseline", "candidate"]) for (const t of Object.values(times)) t[side] = questions.map(() => []);
const firstOutput = { baseline: [], candidate: [] };
for (let pass = -1; pass < reps; pass++) {
  for (const [i, q] of questions.entries()) {
    const order = (pass + i) % 2 === 0 ? ["baseline", "candidate"] : ["candidate", "baseline"];
    for (const side of order) {
      const run = cliRun(side, q);
      const rankMs = rankers[side](q);
      if (pass < 0) { firstOutput[side][i] = run.stdout; continue; }
      times.cli[side][i].push(run.ms);
      times.rank[side][i].push(rankMs);
    }
  }
}
const loadAfter = loadavg();

const stat = (values) => ({ median: median(values), p95: percentile(values, 95) });
const perQuestion = (list) => list.map((runs) => median(runs));
const report = { machine: { cpu: cpus()[0]?.model, cores: cpus().length, memory_gb: Math.round(totalmem() / 2 ** 30), os: `${type()} ${release()}`, node: process.version, load_before: load.map((x) => x.toFixed(2)), load_after: loadAfter.map((x) => x.toFixed(2)) }, reps, questions: questions.length, measures: {} };
const git = (dir) => { try { return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "unknown"; } };
report.commits = { baseline: git(sides.baseline), candidate: git(sides.candidate) };
const measure = (name, of) => {
  const b = stat(of("baseline"));
  const c = stat(of("candidate"));
  const ratio = { median: c.median / b.median, p95: c.p95 / b.p95 };
  report.measures[name] = { baseline: b, candidate: c, ratio, pass: ratio.median <= LIMIT_RATIO && ratio.p95 <= LIMIT_RATIO };
};
measure("search latency, cold CLI (ms)", (side) => perQuestion(times.cli[side]));
measure("in-process ranking (ms)", (side) => perQuestion(times.rank[side]));
measure("output tokens (o200k)", (side) => firstOutput[side].map((s) => countTokens(s)));
measure("output bytes (reported)", (side) => firstOutput[side].map((s) => Buffer.byteLength(s, "utf8")));
report.measures["output bytes (reported)"].pass = null;
const reads = questions.filter((q) => q.read).map((q) => {
  const stdout = execFileSync("node", [join(resolve(sides.candidate), "src/cli.ts"), "query", "--read", q.read.join(","), "--repo", q.caller, "--json"], { env: { ...process.env, BRAIN_DIR: q.brain }, encoding: "utf8" });
  return countTokens(stdout);
});
report.full_read_tokens = { cases: reads.length, ...stat(reads) };

if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`baseline: commit ${report.commits.baseline}\ncandidate: commit ${report.commits.candidate}`);
  const m = report.machine;
  console.log(`machine: ${m.cpu}, ${m.cores} cores, ${m.memory_gb} GB, ${m.os}, node ${m.node}; load average ${m.load_before.join(" ")} before, ${m.load_after.join(" ")} after`);
  console.log(`questions: ${report.questions} (80 cases, 50 originals); passes: ${reps} after one warm-up; tokenizer: gpt-tokenizer 4.1.0, o200k_base\n`);
  console.log("| measure | baseline median | baseline p95 | candidate median | candidate p95 | ratio median | ratio p95 | gate (<= 1.25) |\n|---|---|---|---|---|---|---|---|");
  const f = (x) => (x >= 100 ? Math.round(x) : x.toFixed(2));
  for (const [name, r] of Object.entries(report.measures)) console.log(`| ${name} | ${f(r.baseline.median)} | ${f(r.baseline.p95)} | ${f(r.candidate.median)} | ${f(r.candidate.p95)} | ${r.ratio.median.toFixed(3)} | ${r.ratio.p95.toFixed(3)} | ${r.pass === null ? "reported" : r.pass ? "pass" : "FAIL"} |`);
  console.log(`\nfull filtered read of the first evidence set (candidate, reported): ${reads.length} cases, median ${report.full_read_tokens.median} tokens, p95 ${report.full_read_tokens.p95}`);
}
if (Object.values(report.measures).some((r) => r.pass === false)) process.exitCode = 1;
