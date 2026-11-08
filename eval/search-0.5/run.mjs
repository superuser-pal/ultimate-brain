#!/usr/bin/env node
// Runs the known questions against three retrievers and prints recall and timing.
// Usage: node eval/search-0.5/run.mjs <brain-dir> <questions.json> [gbrain]
// Prints the commit and command first, then recall@1/5/10 and MRR overall and per
// question kind, then timing in its own table: everything above "## Timing" is
// deterministic for `brain` and `bm25` (CC-164).
//   brain   `brain query --candidates` from this checkout (BRAIN_DIR = <brain-dir>)
//   bm25    eval/search-0.5/bm25.mjs over the same files
//   gbrain  `gbrain search` (keyword only), when the third argument is `gbrain`;
//           GBRAIN_HOME must point at a scratch home where <brain-dir> was imported.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
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
  // The parser below reads GBrain's text output, which can change between releases.
  const GBRAIN_VERSION = "0.46.30.0";
  const version = execFileSync("gbrain", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  if (version !== `gbrain ${GBRAIN_VERSION}`) {
    console.error(`this comparison was run with gbrain ${GBRAIN_VERSION}; found "${version}" (bun add -g github:garrytan/gbrain#v${GBRAIN_VERSION})`);
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
const tally = () => ({ n: 0, r1: 0, r5: 0, r10: 0, rr: 0, ms: 0 });
for (const [name, fn] of Object.entries(retrievers)) {
  const t = { all: tally(), byKind: {} };
  for (const q of qs) {
    const s = Date.now();
    const ids = fn(q.q);
    const ms = Date.now() - s;
    const rank = ids.indexOf(q.answer) + 1;
    for (const k of [t.all, (t.byKind[q.kind] ||= tally())]) {
      k.n++;
      k.ms += ms;
      if (rank === 1) k.r1++;
      if (rank && rank <= 5) k.r5++;
      if (rank) k.r10++;
      k.rr += rank ? 1 / rank : 0;
    }
    rows.push({ retriever: name, kind: q.kind, q: q.q, rank: rank || null });
  }
  totals[name] = t;
}

// The commit the numbers were produced at, and the command, so anyone can rerun it.
const repo = fileURLToPath(new URL("../..", import.meta.url));
const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", "src", "eval/search-0.5", ":!eval/search-0.5/results-*.txt") ? " (with uncommitted changes in src/ or eval/search-0.5/)" : "";
const shown = (p) => (p.startsWith("/") ? (relative(repo, p).startsWith("..") ? `<${p === brain ? "brain-dir" : "file"}>` : relative(repo, p)) : p);
console.log(`commit: ${git("rev-parse", "HEAD")}${dirty}`);
console.log(`command: ${process.env.RUN_ROWS ? "RUN_ROWS=1 " : ""}node eval/search-0.5/run.mjs ${process.argv.slice(2).map(shown).join(" ")}`);
console.log(`notes indexed by bm25: ${index.docs.length}; questions: ${qs.length}; limit: ${LIMIT}`);

const kinds = [...new Set(qs.map((q) => q.kind))];
const line = (label, k) => `| ${label} | ${k.r1}/${k.n} | ${k.r5}/${k.n} | ${k.r10}/${k.n} | ${(k.rr / k.n).toFixed(2)} |`;
for (const [name, t] of Object.entries(totals)) {
  console.log(`\n## ${name}\n\n| kind | recall@1 | recall@5 | recall@10 | MRR |\n|---|---|---|---|---|`);
  for (const k of kinds) console.log(line(k, t.byKind[k]));
  console.log(line("**all**", t.all));
}
console.log(`\n## Timing (ms per query; varies by machine)\n\nbm25 build: ${bm25Build} ms\n`);
console.log(`| kind | ${Object.keys(totals).join(" | ")} |\n|---|${Object.keys(totals).map(() => "---").join("|")}|`);
for (const k of [...kinds, "all"])
  console.log(`| ${k === "all" ? "**all**" : k} | ${Object.values(totals).map((t) => { const x = k === "all" ? t.all : t.byKind[k]; return Math.round(x.ms / x.n); }).join(" | ")} |`);
if (process.env.RUN_ROWS) console.log("\n## Rows\n\n" + rows.map((r) => `${r.retriever}\t${r.kind}\t${r.rank ?? "-"}\t${r.q}`).join("\n"));
