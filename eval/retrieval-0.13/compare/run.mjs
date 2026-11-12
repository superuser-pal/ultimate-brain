#!/usr/bin/env node
// CC-204: compares the retrieval changes C1 to C4 (spec/retrieval.md §4) on the frozen cases, one variant at a time.
// Usage: node eval/retrieval-0.13/compare/run.mjs <retrieval-out> <memory-out> [--variants "C0;C1;C2w,C2v;…"] [--split dev|all] [--json <file>]
//   <retrieval-out>: make-brain.mjs's folder (eval/retrieval-0.13); <memory-out>: eval/memory-0.12/make-brain.mjs's folder.
// Each variant runs in a temporary checkout (checkout.mjs) with UB_RETRIEVAL_VARIANT set: the first search as score.mjs runs it
// (one `brain query --candidates`, default limit and types, the question verbatim, from the case's caller), on the `dev` cases
// unless --split all (the held-back run, once, after the vocabulary map is committed: §5.4). Per variant it reports:
//   - the four kinds at the retrieval level, and the prose-only facts (eval/search-0.5's 10 fact-in-body questions and the
//     body-only fact cases of the split);
//   - whether a first-ten candidate's snippets show every required fact (reported: what C4 is for);
//   - the 50 originals (recall@1/5/10, MRR, each of the 36 kept);
//   - eval/memory-0.12 at the retrieval level (its query adapter, the checkout's CLI): cases that pass on today's search and fail;
//   - output tokens of the 80 + 50 searches (o200k, gpt-tokenizer 4.1.0) against today's, median and p95.
// Latency is measured for the chosen set with costs.mjs (paired, interleaved), not here.
// Before any run it checks the vocabulary map (§4 C2: at most 40 groups of 6; every word from dev cases or the originals) and that
// C0 (the variant path, every change off) gives the product's bytes on every question.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { LIMIT, median, percentile, scoreRetrieval } from "../lib.mjs";
import { variantCheckout } from "./checkout.mjs";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../../..");
const args = process.argv.slice(2);
const [out, memOut] = args;
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
if (!out || !memOut || out.startsWith("--") || memOut.startsWith("--")) {
  console.error("usage: run.mjs <retrieval-out> <memory-out> [--variants \"C0;C1;…\"] [--split dev|all] [--json <file>]");
  process.exit(2);
}
const split = option("--split", "dev");
const variants = option("--variants", "C0;C1;C2w;C2v;C2;C3;C3d;C3a;C4").split(";").map((v) => v.trim()).filter(Boolean);

const tokenizerRequire = createRequire(join(product, "eval/retrieval-0.12/package.json"));
const { countTokens } = await import(pathToFileURL(tokenizerRequire.resolve("gpt-tokenizer/encoding/o200k_base")).href);

const set = JSON.parse(readFileSync(join(here, "../cases.json"), "utf8"));
const originals = JSON.parse(readFileSync(join(product, "eval/search-0.5/questions.json"), "utf8"));
const cc173 = readFileSync(join(product, "eval/search-0.5/results-cc173.txt"), "utf8").split("\n").filter((l) => l.startsWith("brain\t"))
  .map((l) => { const [, kind, rank] = l.split("\t"); return { kind, rank: rank === "-" ? null : Number(rank) }; });
const cases = set.cases.filter((c) => split === "all" || c.split === split);

// ---- the vocabulary map's bounds (§4 C2) ----
const vocabulary = (await import(pathToFileURL(join(here, "vocabulary.ts")).href)).VOCABULARY;
{
  const devText = set.cases.filter((c) => c.split === "dev").map((c) => c.question).join(" ").toLowerCase();
  const originalText = originals.map((q) => q.q).join(" ").toLowerCase();
  const problems = [];
  if (vocabulary.length > 40) problems.push(`${vocabulary.length} groups, more than 40`);
  for (const group of vocabulary) if (group.length > 6) problems.push(`a group of ${group.length} words: ${group.join(", ")}`);
  const evidence = await devEvidenceText();
  for (const word of vocabulary.flat()) {
    const re = new RegExp(`\\b${word}`, "i");
    if (!re.test(devText) && !re.test(originalText) && !re.test(evidence)) problems.push(`"${word}" is in no dev case and no original question or answer note`);
  }
  if (problems.length) { console.error(`vocabulary map:\n  ${problems.join("\n  ")}`); process.exit(1); }
}

/** The text of the dev cases' evidence and subjects' evidence, and of the originals' answer notes, as the brain holds it. */
async function devEvidenceText() {
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : n.endsWith(".md") ? [join(dir, n)] : []));
  const byId = new Map();
  for (const brain of [join(out, "brain"), join(out, "original")]) for (const file of walk(brain)) {
    const text = readFileSync(file, "utf8");
    const id = /^id: (\S+)/m.exec(text)?.[1];
    if (id && !byId.has(id)) byId.set(id, text);
  }
  const ids = [
    ...set.cases.filter((c) => c.split === "dev").flatMap((c) => [...(c.evidence_sets ?? []).flat(), ...(c.subjects ?? []).flatMap((s) => s.evidence)]),
    ...originals.map((q) => q.answer),
  ];
  return ids.map((id) => byId.get(id) ?? "").join("\n").toLowerCase();
}

// ---- running a CLI ----
async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i], i); }));
  return results;
}
const search = async (cli, variant, brain, caller, question) => {
  const { stdout } = await run("node", [cli, "query", "--candidates", question, "--repo", caller, "--json"], {
    env: { ...process.env, BRAIN_DIR: brain, UB_RETRIEVAL_VARIANT: variant }, encoding: "utf8", maxBuffer: 1 << 26,
  });
  return stdout;
};
const questions = [
  ...set.cases.map((c) => ({ label: c.id, c, brain: join(out, "brain"), caller: join(out, "repos", c.caller), q: c.question })),
  ...originals.map((o, i) => ({ label: `orig-${i + 1}`, o, i, brain: join(out, "original"), caller: join(out, "repos", "scratch"), q: o.q })),
];
async function outputs(cli, variant) {
  return pool(questions, 6, (q) => search(cli, variant, q.brain, q.caller, q.q));
}

// ---- one variant ----
const stats = (ranks) => ({ r1: ranks.filter((r) => r === 1).length, r5: ranks.filter((r) => r && r <= 5).length, r10: ranks.filter((r) => r && r <= 10).length, mrr: ranks.reduce((s, r) => s + (r ? 1 / r : 0), 0) / ranks.length });
const factRe = (fact) => fact.all.map((re) => new RegExp(re, "i"));
function summarise(variant, stdouts, memory, base) {
  const byLabel = new Map(questions.map((q, i) => [q.label, JSON.parse(stdouts[i]).data.candidates]));
  const rows = cases.map((c) => {
    const candidates = byLabel.get(c.id);
    const r = scoreRetrieval(c, candidates.map((x) => x.id));
    let shown = null;
    if (c.kind === "fact" || c.kind === "paraphrase") {
      const text = candidates.slice(0, LIMIT).flatMap((x) => x.snippets.map((s) => s.text)).join("\n");
      shown = c.facts.every((f) => factRe(f).every((re) => re.test(text)));
    }
    return { id: c.id, kind: c.kind, subgroup: c.subgroup, pass: r.pass, rank: r.rank, shown };
  });
  const originalRanks = originals.map((o, i) => (byLabel.get(`orig-${i + 1}`).map((x) => x.id).indexOf(o.answer) + 1) || null);
  const kinds = {};
  for (const kind of ["fact", "paraphrase", "clarify", "unknown"]) { const of = rows.filter((r) => r.kind === kind); kinds[kind] = `${of.filter((r) => r.pass).length}/${of.length}`; }
  const factInBody = originals.map((o, i) => ({ o, r: originalRanks[i] })).filter(({ o }) => o.kind === "fact-in-body");
  const bodyOnly = rows.filter((r) => r.subgroup === "body-only");
  const prose = { got: factInBody.filter(({ r }) => r && r <= LIMIT).length + bodyOnly.filter((r) => r.pass).length, of: factInBody.length + bodyOnly.length };
  const answerable = rows.filter((r) => r.shown !== null);
  const kept = cc173.map((b, i) => (b.rank && b.rank <= 10 ? Boolean(originalRanks[i] && originalRanks[i] <= 10) : null));
  const byKind = {};
  for (const kind of [...new Set(originals.map((o) => o.kind))]) { const s = stats(originalRanks.filter((_, i) => originals[i].kind === kind)); byKind[kind] = `${s.r1}/${s.r5}/${s.r10}, ${s.mrr.toFixed(2)}`; }
  const tokens = stdouts.map((s) => countTokens(s));
  const ratio = base ? { median: median(tokens) / median(base.tokens), p95: percentile(tokens, 95) / percentile(base.tokens, 95) } : null;
  const lost = base ? Object.keys(memory).filter((id) => base.memory[id] && !memory[id]) : [];
  return {
    variant, kinds, prose, shown: `${answerable.filter((r) => r.shown).length}/${answerable.length}`,
    originals: { ...stats(originalRanks), kept: `${kept.filter((k) => k === true).length}/${kept.filter((k) => k !== null).length}`, lostOriginals: cc173.map((b, i) => (kept[i] === false ? originals[i].q : null)).filter(Boolean), byKind },
    memory: { passing: Object.values(memory).filter(Boolean).length, of: Object.keys(memory).length, lost },
    tokens, tokenRatio: ratio, rows, originalRanks,
  };
}

async function memoryRows(root, variant) {
  const { stdout } = await run("node", [join(root, "eval/memory-0.12/score.mjs"), memOut, "--json"], { env: { ...process.env, UB_RETRIEVAL_VARIANT: variant }, encoding: "utf8", maxBuffer: 1 << 26 });
  return Object.fromEntries(JSON.parse(stdout).rows.map((r) => [r.id, r.pass ?? r.reasons?.length === 0]));
}

// ---- the self-check, then the variants ----
// "today" is the product before CC-205; since CC-205 the product ranks with the chosen set, so this record is rerun at 4f94b40.
if (!readFileSync(join(product, "src/commands/query.ts"), "utf8").includes("rankCandidates(")) {
  console.error("run.mjs compares the variants with the product before CC-205 (its \"today\" row and C0's check); run it in a checkout of 4f94b40, the commit results-cc204.txt names");
  process.exit(2);
}
const root = variantCheckout();
const productCli = join(product, "src/cli.ts");
const variantCli = join(root, "src/cli.ts");
const baseOut = await outputs(productCli, "");
const c0Out = await outputs(variantCli, "C0");
const differ = questions.filter((_, i) => baseOut[i] !== c0Out[i]).map((q) => q.label);
if (differ.length) { console.error(`C0 differs from the product on ${differ.length} question(s): ${differ.slice(0, 5).join(", ")}`); process.exit(1); }
const base = summarise("today", baseOut, await memoryRows(product, ""), null);
const results = [base];
for (const variant of variants.filter((v) => v !== "C0")) {
  const stdouts = await outputs(variantCli, variant);
  results.push(summarise(variant, stdouts, await memoryRows(root, variant), base));
}

// ---- report ----
import("node:child_process").then(({ execFileSync }) => {
  const head = execFileSync("git", ["-C", product, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["-C", product, "status", "--porcelain", "--", "src", "eval/retrieval-0.13"], { encoding: "utf8" }).trim() ? " (uncommitted changes)" : "";
  console.log(`commit: ${head}${dirty}; split: ${split} (${cases.length} cases); C0 = the product's bytes on all ${questions.length} questions\n`);
  console.log("| variant | fact | paraphrase | clarify (2 subjects seen) | unknown | prose-only facts | facts shown in snippets | originals r1/r5/r10, MRR | 36 kept | memory-0.12 retrieval (lost) | tokens median, p95 (ratio) |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const o = r.originals;
    const t = `${median(r.tokens)}, ${percentile(r.tokens, 95)}${r.tokenRatio ? ` (${r.tokenRatio.median.toFixed(3)}, ${r.tokenRatio.p95.toFixed(3)})` : ""}`;
    console.log(`| ${r.variant} | ${r.kinds.fact} | ${r.kinds.paraphrase} | ${r.kinds.clarify} | ${r.kinds.unknown} | ${r.prose.got}/${r.prose.of} | ${r.shown} | ${o.r1}/${o.r5}/${o.r10}, ${o.mrr.toFixed(2)} | ${o.kept} | ${r.memory.passing}/${r.memory.of}${r.memory.lost.length ? ` (lost ${r.memory.lost.join(", ")})` : ""} | ${t} |`);
  }
  console.log("\nOriginals by kind (r1/r5/r10, MRR):\n");
  const kinds = Object.keys(base.originals.byKind);
  console.log(`| variant | ${kinds.join(" | ")} |\n|---|${kinds.map(() => "---").join("|")}|`);
  for (const r of results) console.log(`| ${r.variant} | ${kinds.map((k) => r.originals.byKind[k]).join(" | ")} |`);
  console.log("\nCases whose result differs from today's (rank: today → variant; - = not in the first ten):\n");
  for (const r of results.slice(1)) {
    const changes = r.rows.filter((row, i) => row.pass !== base.rows[i].pass || row.rank !== base.rows[i].rank).map((row) => {
      const was = base.rows.find((b) => b.id === row.id);
      return `${row.id} ${was.pass ? "pass" : "FAIL"}@${was.rank ?? "-"} → ${row.pass ? "pass" : "FAIL"}@${row.rank ?? "-"}`;
    });
    console.log(`- ${r.variant}: ${changes.length ? changes.join("; ") : "none"}${r.originals.lostOriginals.length ? `; originals lost: ${r.originals.lostOriginals.join(" | ")}` : ""}`);
  }
  const json = option("--json");
  if (json) writeFileSync(json, `${JSON.stringify({ head, split, results: results.map(({ tokens, ...r }) => r) }, null, 2)}\n`);
});
