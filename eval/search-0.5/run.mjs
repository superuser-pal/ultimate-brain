#!/usr/bin/env node
// Runs the known questions against three retrievers and prints recall and timing.
// Usage: node eval/search-0.5/run.mjs <brain-dir> <questions.json> [gbrain]
//   brain   `brain query --candidates` from this checkout (BRAIN_DIR = <brain-dir>)
//   bm25    eval/search-0.5/bm25.mjs over the same files
//   gbrain  `gbrain search` (keyword only), when the third argument is `gbrain`;
//           GBRAIN_HOME must point at a scratch home where <brain-dir> was imported.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build, search } from "./bm25.mjs";

const [brain, qfile, withGbrain] = process.argv.slice(2);
if (!brain || !qfile) {
  console.error("usage: run.mjs <brain-dir> <questions.json> [gbrain]");
  process.exit(2);
}
const cli = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));
const qs = JSON.parse(readFileSync(qfile, "utf8"));
const LIMIT = 10;

const t0 = Date.now();
const index = build(brain);
const bm25Build = Date.now() - t0;
// path (without .md) → id, to read GBrain's slugs back as note ids
const byPath = new Map(index.docs.map((d) => [d.path.replace(/\.md$/, ""), d.id]));

const retrievers = {
  brain: (q) =>
    JSON.parse(execFileSync("node", [cli, "query", "--candidates", q, "--limit", String(LIMIT), "--json"], { env: { ...process.env, BRAIN_DIR: brain }, encoding: "utf8" })).data.candidates.map((c) => c.id),
  bm25: (q) => search(index, q, LIMIT).map((r) => r.id),
};
if (withGbrain === "gbrain") {
  if (!process.env.GBRAIN_HOME) {
    console.error("GBRAIN_HOME must point at the scratch GBrain home");
    process.exit(2);
  }
  retrievers.gbrain = (q) => {
    const outText = execFileSync("gbrain", ["search", q, "--limit", String(LIMIT * 3)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const ids = [];
    for (const line of outText.split("\n")) {
      const m = /^\[[\d.]+\] (\S+) --/.exec(line);
      const id = m && byPath.get(m[1]);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids.slice(0, LIMIT);
  };
}

const rows = [];
const totals = {};
for (const [name, fn] of Object.entries(retrievers)) {
  const t = { r1: 0, r5: 0, r10: 0, rr: 0, ms: 0, byKind: {} };
  for (const q of qs) {
    const s = Date.now();
    const ids = fn(q.q);
    t.ms += Date.now() - s;
    const rank = ids.indexOf(q.answer) + 1;
    if (rank === 1) t.r1++;
    if (rank && rank <= 5) t.r5++;
    if (rank) t.r10++;
    t.rr += rank ? 1 / rank : 0;
    const k = (t.byKind[q.kind] ||= { n: 0, r5: 0 });
    k.n++;
    if (rank && rank <= 5) k.r5++;
    rows.push({ retriever: name, kind: q.kind, q: q.q, rank: rank || null });
  }
  totals[name] = t;
}

const n = qs.length;
console.log(`notes indexed: ${index.docs.length}; questions: ${n}; bm25 build: ${bm25Build} ms`);
console.log("\n| retriever | recall@1 | recall@5 | recall@10 | MRR | ms per query |");
console.log("|---|---|---|---|---|---|");
for (const [name, t] of Object.entries(totals))
  console.log(`| ${name} | ${t.r1}/${n} | ${t.r5}/${n} | ${t.r10}/${n} | ${(t.rr / n).toFixed(2)} | ${Math.round(t.ms / n)} |`);
const kinds = [...new Set(qs.map((q) => q.kind))];
console.log(`\n| recall@5 by kind | ${Object.keys(totals).join(" | ")} |`);
console.log(`|---|${Object.keys(totals).map(() => "---").join("|")}|`);
for (const k of kinds) console.log(`| ${k} | ${Object.values(totals).map((t) => `${t.byKind[k].r5}/${t.byKind[k].n}`).join(" | ")} |`);
if (process.env.RUN_ROWS) console.log("\n" + rows.map((r) => `${r.retriever}\t${r.kind}\t${r.rank ?? "-"}\t${r.q}`).join("\n"));
