#!/usr/bin/env node
// Runs one adapter on the 80 cases and prints the gates (CC-203; spec/retrieval.md §5.5, §6).
// Usage: node eval/retrieval-0.13/score.mjs <out-dir> [--adapter query-candidates|reference-answers] [--split dev|held|all]
//                                         [--rows] [--json] [--strict] [--cases <file>]
// <out-dir> is what make-brain.mjs wrote. The audit runs first; a failed audit stops the run (exit 1).
// --split dev scores only the development cases, as CC-204 does while choosing changes; the gates count all 20 per kind.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { ANSWER_GATES, KINDS, RETRIEVAL_GATES, audit, scoreAnswer, scoreRetrieval } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const product = join(here, "../..");
const cli = join(product, "src/cli.ts");
const args = process.argv.slice(2);
const out = args[0];
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
if (!out || out.startsWith("--")) {
  console.error("usage: score.mjs <out-dir> [--adapter <name>] [--split dev|held|all] [--rows] [--json] [--strict] [--cases <file>]");
  process.exit(2);
}
const adapterName = option("--adapter", "query-candidates");
const split = option("--split", "all");
const set = JSON.parse(readFileSync(option("--cases", join(here, "cases.json")), "utf8"));
const adapter = (await import(join(here, "adapters", `${adapterName}.mjs`))).default;
if (!["retrieval", "answer"].includes(adapter.level)) throw new Error(`adapter ${adapterName}: level must be retrieval or answer`);
const brainDir = join(out, "brain");
const callerDir = (name) => join(out, "repos", name);

// ---- what the audit reads ----
const walk = (dir) => readdirSync(dir).sort().flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)).map((p) => join(name, p)) : [name]));
const noteFiles = (root) => walk(root).filter((p) => p.endsWith(".md") && /^(areas|knowledge|projects|sources|goals)\//.test(p));
const notes = noteFiles(brainDir).map((path) => {
  const text = readFileSync(join(brainDir, path), "utf8");
  const fm = parse(/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "") ?? {};
  return { id: fm.id, type: fm.type, fm, text, path };
});
const refs = (n) => [n.fm.client, n.fm.org, ...(Array.isArray(n.fm.projects) ? n.fm.projects : []), n.fm.source].filter(Boolean);
function about(id) {
  const found = new Map();
  const visit = (target) => {
    const self = notes.find((n) => n.id === target);
    if (self && !found.has(self.id)) found.set(self.id, self);
    for (const n of notes) {
      if (found.has(n.id) || !refs(n).includes(target)) continue;
      found.set(n.id, n);
      if (n.type === "project") visit(n.id);
      if (n.type === "meeting") for (const s of [n.fm.source, ...(n.fm.sources ?? [])]) { const src = notes.find((x) => x.id === s); if (src) found.set(src.id, src); }
    }
  };
  visit(id);
  return [...found.values()].map((n) => ({ id: n.id, text: n.text }));
}
const readCache = new Map();
function eligible(ids, caller) {
  const key = `${caller}\n${ids.join(",")}`;
  if (!readCache.has(key)) {
    const stdout = execFileSync("node", [cli, "query", "--read", ids.join(","), "--repo", callerDir(caller), "--json"], { env: { ...process.env, BRAIN_DIR: brainDir }, encoding: "utf8" });
    readCache.set(key, new Map(JSON.parse(stdout).data.notes.map((n) => [n.id, n.status === "ok" ? `${n.title ?? ""}\n${JSON.stringify(n.frontmatter)}\n${n.body}` : null])));
  }
  return readCache.get(key);
}
const suppressionsDir = join(brainDir, "_suppressions");
const suppressions = existsSync(suppressionsDir) ? walk(suppressionsDir).filter((p) => !/(^|\/)(\.gitkeep|README\.md)$/.test(p)).length : 0;
const originalDir = join(out, "original");
const originalChanged = noteFiles(originalDir).filter((p) => !existsSync(join(brainDir, p)) || !readFileSync(join(originalDir, p)).equals(readFileSync(join(brainDir, p))));
const questionsSha = createHash("sha256").update(readFileSync(join(product, "eval/search-0.5/questions.json"), "utf8")).digest("hex");

const problems = audit(set, { eligible, about, suppressions, originalChanged, questionsChanged: questionsSha !== set.original_questions_sha256 });
if (problems.length) {
  console.error(`audit failed (${problems.length}):\n${problems.map((p) => `  ${p.case}: ${p.problem}`).join("\n")}`);
  process.exit(1);
}

// ---- run the adapter ----
const chosen = set.cases.filter((c) => split === "all" || c.split === split);
const rows = [];
for (const c of chosen) {
  const result = adapter.run(c, { brain: brainDir, callerDir: callerDir(c.caller), cli });
  if (adapter.level === "retrieval") {
    const r = scoreRetrieval(c, result.candidates);
    rows.push({ id: c.id, kind: c.kind, split: c.split, pass: r.pass, reasons: r.reasons, rank: r.rank, sets: r.sets, bytes: result.cost?.bytes, ms: result.cost?.ms });
  } else {
    const reasons = scoreAnswer(c, result.answer);
    rows.push({ id: c.id, kind: c.kind, split: c.split, pass: reasons.length === 0, reasons });
  }
}

// ---- report ----
const tally = (kind, which = rows) => {
  const of = which.filter((r) => r.kind === kind);
  return { n: of.length, pass: of.filter((r) => r.pass).length };
};
const gates = [];
if (adapter.level === "retrieval") {
  for (const [kind, need] of Object.entries(RETRIEVAL_GATES)) {
    const t = tally(kind);
    gates.push({ gate: `${kind}, first search, first ten`, got: `${t.pass}/${t.n}`, need: split === "all" ? `${need}/20` : "(all 20 needed)", pass: split === "all" && t.pass >= need });
  }
  for (const kind of ["clarify", "unknown"]) { const t = tally(kind); gates.push({ gate: `${kind} (reported)`, got: `${t.pass}/${t.n}`, need: "-", pass: null }); }
} else {
  const answerable = rows.filter((r) => r.kind === "fact" || r.kind === "paraphrase");
  gates.push({ gate: "answerable, correct and cited", got: `${answerable.filter((r) => r.pass).length}/${answerable.length}`, need: `${ANSWER_GATES.answerable}/40`, pass: split === "all" && answerable.filter((r) => r.pass).length >= ANSWER_GATES.answerable });
  for (const kind of ["clarify", "unknown"]) { const t = tally(kind); gates.push({ gate: `${kind}`, got: `${t.pass}/${t.n}`, need: `${ANSWER_GATES[kind]}/20`, pass: split === "all" && t.pass >= ANSWER_GATES[kind] }); }
}
const failedGates = gates.filter((g) => g.pass === false).length;

if (args.includes("--json")) {
  console.log(JSON.stringify({ adapter: adapter.name, level: adapter.level, split, gates, rows }, null, 2));
} else {
  const git = (...a) => execFileSync("git", ["-C", product, ...a], { encoding: "utf8" }).trim();
  const dirty = git("status", "--porcelain", "--", "src", "eval/retrieval-0.13", ":!eval/retrieval-0.13/results-*.txt") ? " (with uncommitted changes in src/ or eval/retrieval-0.13/)" : "";
  console.log(`commit: ${git("rev-parse", "HEAD")}${dirty}`);
  console.log(`adapter: ${adapter.name} (${adapter.level}): ${adapter.describe}`);
  console.log(`cases: ${chosen.length} (split: ${split}); audit: passed\n`);
  console.log("| kind | dev | held | all |\n|---|---|---|---|");
  for (const kind of KINDS) {
    const cell = (s) => { const t = tally(kind, rows.filter((r) => s === "all" || r.split === s)); return t.n ? `${t.pass}/${t.n}` : "-"; };
    console.log(`| ${kind} | ${cell("dev")} | ${cell("held")} | ${cell("all")} |`);
  }
  console.log("\n| gate | got | needs | |\n|---|---|---|---|");
  for (const g of gates) console.log(`| ${g.gate} | ${g.got} | ${g.need} | ${g.pass === null ? "reported" : g.pass ? "pass" : "FAIL"} |`);
  if (adapter.level === "retrieval") {
    const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
    const bytes = rows.map((r) => r.bytes);
    console.log(`\nOne cold CLI process per case (not the paired latency of costs.mjs): median ${Math.round(ms[Math.floor(ms.length / 2)])} ms; output ${Math.round(bytes.reduce((a, b) => a + b, 0) / bytes.length)} bytes on average (bytes, not tokens).`);
  }
  if (args.includes("--rows")) {
    console.log("\n## Rows\n");
    for (const r of rows) console.log(`${r.id}\t${r.kind}\t${r.split}\t${r.pass ? "pass" : "FAIL"}\t${r.rank ?? "-"}\t${r.sets ? `sets ${r.sets.map((x) => x ?? "-").join(",")}` : ""}\t${r.reasons.join("; ")}`);
  }
}
if (args.includes("--strict") && failedGates > 0) process.exit(1);
