#!/usr/bin/env node
// CC-167: claude-obsidian's retrieval pieces, adapted in TypeScript, against the 0.12.0 baseline.
// Usage: node --experimental-strip-types eval/retrieval-0.12/run.ts <brain-dir> <questions.json>
// <brain-dir> is eval/search-0.5's generated brain (its README, "Rerun the baseline"); the questions are its 50.
// Prints the commit and command, then recall@1/5/10 and MRR per retriever and question kind, the tokens a top-10
// result page costs (measured with one tokenizer, and the CLI's estimate beside it), the freshness check, a tokeniser
// probe and each piece's lines of code. Everything is deterministic; set RUN_ROWS=1 to add every question's rank.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { countTokens } from "gpt-tokenizer/encoding/o200k_base";

import { queryWords } from "../../src/lib/query.ts";
import { chunkBody } from "./chunk.ts";
import { loadCorpus, type Note } from "./corpus.ts";
import type { Retriever } from "./retriever.ts";
import { bm25Chunks, bm25v05, bm25Whole, brainCli, brainOneSnippet, withCompactPage } from "./retrievers.ts";
import { brainWithCjk, tokenize } from "./tokenize.ts";

const TOKENIZER = "gpt-tokenizer 4.1.0, encoding o200k_base";
const LIMIT = 10;

const [brain, qfile] = process.argv.slice(2);
if (!brain || !qfile) {
  console.error("usage: run.ts <brain-dir> <questions.json>");
  process.exit(2);
}
interface Question { kind: string; q: string; answer: string }
const questions: Question[] = JSON.parse(readFileSync(qfile, "utf8"));
const notes = await loadCorpus(brain);
const byId = new Map(notes.map((note) => [note.id, note]));

/** The CLI's guard (spec/memory.md §5.2): ⌈UTF-8 bytes ÷ 3⌉. */
const estimate = (text: string): number => Math.ceil(Buffer.byteLength(text, "utf8") / 3);

// The baseline runs once per question; the snippet piece re-pages its order from the same call.
function cached(inner: Retriever): Retriever {
  const seen = new Map<string, ReturnType<Retriever["search"]>>();
  return { name: inner.name, search: (q, limit) => seen.get(`${limit}\u0000${q}`) ?? seen.set(`${limit}\u0000${q}`, inner.search(q, limit)).get(`${limit}\u0000${q}`)! };
}
const baseline = cached(brainCli(brain));
const retrievers: Retriever[] = [
  baseline,
  bm25v05(brain, byId),
  brainOneSnippet(baseline, byId),
  withCompactPage("brain, compact text page", baseline, byId),
  bm25Whole(notes, { name: "co-bm25", tokens: "upstream" }),
  bm25Whole(notes, { name: "co-bm25, brain tokens", tokens: "brain" }),
  bm25Whole(notes, { name: "co-bm25F", tokens: "upstream", titleWeight: 3, summaryWeight: 2 }),
  bm25Whole(notes, { name: "co-bm25F, brain tokens + prefix", tokens: "brain", titleWeight: 3, summaryWeight: 2, prefix: true }),
  bm25Chunks(notes, { name: "co-chunks", prefix: "none" }),
  bm25Chunks(notes, { name: "co-chunks + prefix", prefix: "synthetic" }),
  bm25Chunks(notes, { name: "co-chunks + meta prefix", prefix: "metadata" }),
];

interface Tally { n: number; r1: number; r5: number; r10: number; rr: number }
const tally = (): Tally => ({ n: 0, r1: 0, r5: 0, r10: 0, rr: 0 });
const rows: string[] = [];
const results = retrievers.map((retriever) => {
  const all = tally();
  const byKind = new Map<string, Tally>();
  const measured: number[] = [];
  const estimated: number[] = [];
  for (const question of questions) {
    const { ids, page } = retriever.search(question.q, LIMIT);
    const rank = ids.indexOf(question.answer) + 1;
    if (!byKind.has(question.kind)) byKind.set(question.kind, tally());
    for (const t of [all, byKind.get(question.kind)!]) {
      t.n++;
      if (rank === 1) t.r1++;
      if (rank && rank <= 5) t.r5++;
      if (rank) t.r10++;
      t.rr += rank ? 1 / rank : 0;
    }
    measured.push(countTokens(page));
    estimated.push(estimate(page));
    rows.push(`${retriever.name}\t${question.kind}\t${rank || "-"}\t${question.q}`);
  }
  return { name: retriever.name, all, byKind, measured, estimated };
});

// ---- header ----
const repo = fileURLToPath(new URL("../..", import.meta.url));
const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
const dirty = git("status", "--porcelain", "--", "src", "eval/search-0.5", "eval/retrieval-0.12", ":!eval/retrieval-0.12/results-*.txt", ":!eval/retrieval-0.12/RESULTS.md") ? " (with uncommitted changes)" : "";
const shown = (p: string) => (p.startsWith("/") ? (relative(repo, p).startsWith("..") ? (p === brain ? "<brain-dir>" : "<file>") : relative(repo, p)) : p);
console.log(`commit: ${git("rev-parse", "HEAD")}${dirty}`);
console.log(`command: ${process.env.RUN_ROWS ? "RUN_ROWS=1 " : ""}node --experimental-strip-types eval/retrieval-0.12/run.ts ${process.argv.slice(2).map(shown).join(" ")}`);
console.log(`notes searched: ${notes.length}; questions: ${questions.length}; limit: ${LIMIT}; tokenizer: ${TOKENIZER}`);
console.log(`longest body: ${Math.max(...notes.map((n) => n.body.length))} characters; notes with more than one chunk: ${notes.filter((n) => chunkBody(n.body).length > 1).length}`);

// ---- recall ----
const mrr = (t: Tally) => (t.rr / t.n).toFixed(2);
const kinds = [...new Set(questions.map((q) => q.kind))];
console.log(`\n## Recall, all 50 questions\n\n| retriever | recall@1 | recall@5 | recall@10 | MRR |\n|---|---|---|---|---|`);
for (const r of results) console.log(`| ${r.name} | ${r.all.r1}/${r.all.n} | ${r.all.r5}/${r.all.n} | ${r.all.r10}/${r.all.n} | ${mrr(r.all)} |`);
console.log(`\n## Recall@10 and MRR by kind\n\n| retriever | ${kinds.join(" | ")} |\n|---|${kinds.map(() => "---").join("|")}|`);
for (const r of results) console.log(`| ${r.name} | ${kinds.map((k) => `${byKindOf(r, k).r10}/${byKindOf(r, k).n} (${mrr(byKindOf(r, k))})`).join(" | ")} |`);
function byKindOf(r: (typeof results)[number], kind: string): Tally { return r.byKind.get(kind)!; }

// ---- tokens ----
const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
console.log(`\n## Tokens a top-10 result page costs (per question; measured: ${TOKENIZER}; estimate: ⌈UTF-8 bytes ÷ 3⌉)\n`);
console.log(`| retriever | measured mean | measured max | estimate mean | estimate max | lowest estimate ÷ measured | pages the estimate undercounts |\n|---|---|---|---|---|---|---|`);
for (const r of results) {
  const ratio = Math.min(...r.measured.map((m, i) => r.estimated[i]! / m));
  const under = r.measured.filter((m, i) => r.estimated[i]! < m).length;
  console.log(`| ${r.name} | ${mean(r.measured)} | ${Math.max(...r.measured)} | ${mean(r.estimated)} | ${Math.max(...r.estimated)} | ${ratio.toFixed(2)} | ${under}/${r.measured.length} |`);
}

// ---- freshness ----
// A copy of the brain is indexed, then the 10 "why" answers' files change (their Decision line names another tool).
// A derived index built before the change would show the old text; the freshness check drops those hits instead.
const scratch = mkdtempSync(join(tmpdir(), "cc167-fresh-"));
try {
  cpSync(brain, scratch, { recursive: true });
  const copyNotes = await loadCorpus(scratch);
  const plain = bm25Chunks(copyNotes, { name: "co-chunks + meta prefix", prefix: "metadata" });
  const fresh = bm25Chunks(copyNotes, { name: "… + freshness", prefix: "metadata", fresh: scratch });
  const why = questions.filter((q) => q.kind === "why");
  const changed = new Map<string, Note>();
  for (const q of why) {
    const note = copyNotes.find((n) => n.id === q.answer)!;
    changed.set(note.id, note);
    writeFileSync(join(scratch, note.path), note.raw.replace(/^Use .* for /m, "Use ChangedTool for "));
  }
  const live = brainCli(scratch);
  console.log(`\n## Freshness: the 10 "why" answers changed after indexing\n\n| retriever | answer in top 10 | results shown from a changed file's old text |\n|---|---|---|`);
  for (const r of [live, plain, fresh]) {
    let found = 0;
    let stale = 0;
    for (const q of why) {
      const { ids, page } = r.search(q.q, LIMIT);
      if (ids.includes(q.answer)) found++;
      // A changed note's result is stale when its own block still quotes its old Decision line.
      for (const id of ids) if (changed.has(id) && blockOf(page, id).includes(changed.get(id)!.body.match(/^Use .* for .*$/m)![0])) stale++;
    }
    console.log(`| ${r.name === "brain" ? "brain (reads the files on every call)" : r.name} | ${found}/${why.length} | ${stale} |`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

/** One result's part of a page: its candidate in the CLI's JSON, or its numbered block in a compact page. */
function blockOf(page: string, id: string): string {
  if (page.startsWith("{")) return JSON.stringify(JSON.parse(page).data.candidates.find((c: { id: string }) => c.id === id) ?? {});
  const lines = page.split("\n");
  const start = lines.findIndex((line) => / /.test(line) && line.split(" ")[1] === id && /^\d+\. /.test(line));
  if (start < 0) return "";
  const end = lines.findIndex((line, i) => i > start && /^\d+\. /.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

// ---- tokeniser probe ----
// Does the query find the text? The CLI's words match by prefix (cli.md §5.13); upstream's terms match exactly.
const PROBE: [string, string][] = [
  ["Felix", "Félix Ortega confirmed the money."],
  ["decision", "Decisión: usar Supabase para el login."],
  ["予算", "東京オフィスの予算を決めた。"],
  ["sign in", "Sign-in uses Supabase Auth."],
  ["deci", "The decision was taken at the sync."],
  ["Lokalise", "Chosen because Lokalise keeps the strings in one place."],
];
const brainFinds = (q: string, text: string) => { const words = queryWords(text); return queryWords(q).some((t) => words.some((w) => w.startsWith(t))); };
const upstreamFinds = (q: string, text: string) => { const terms = new Set(tokenize(text)); return tokenize(q).some((t) => terms.has(t)); };
const bothFinds = (q: string, text: string) => { const words = brainWithCjk(text, queryWords); return brainWithCjk(q, queryWords).some((t) => words.some((w) => w.startsWith(t))); };
const yes = (found: boolean) => (found ? "yes" : "no");
console.log(`\n## Tokeniser probe (does the query match the text?)\n\n| query | text | brain tokens | upstream tokens | brain tokens + CJK n-grams |\n|---|---|---|---|---|`);
for (const [q, text] of PROBE) console.log(`| ${q} | ${text} | ${yes(brainFinds(q, text))} | ${yes(upstreamFinds(q, text))} | ${yes(bothFinds(q, text))} |`);

// ---- the estimate on other scripts ----
const SCRIPTS: [string, string][] = [
  ["English", "Use Supabase Auth for authentication on the shop; chosen because it keeps the data in the EU."],
  ["Spanish", "Decisión: usar Supabase para la autenticación; se eligió porque mantiene los datos en la UE."],
  ["Japanese", "認証にはSupabase Authを使う。データをEU内に保つため、この方法を選んだ。"],
  ["ids and JSON", '{"id":"dec-7k2m9q4x","path":"knowledge/decisions/2026-12-03-use-supabase-for-auth.md","score":17}'],
];
console.log(`\n## The estimate on other scripts\n\n| text | measured | estimate | estimate ÷ measured |\n|---|---|---|---|`);
for (const [label, text] of SCRIPTS) console.log(`| ${label} | ${countTokens(text)} | ${estimate(text)} | ${(estimate(text) / countTokens(text)).toFixed(2)} |`);

// ---- lines of code ----
// Non-blank lines that are not comments: what adopting the piece into src/ would roughly add.
const here = fileURLToPath(new URL(".", import.meta.url));
const loc = (file: string) => readFileSync(join(here, file), "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("//")).length;
console.log(`\n## Lines of code per piece\n\n| piece | file | lines |\n|---|---|---|`);
for (const [piece, file] of [["BM25", "bm25.ts"], ["tokenisation", "tokenize.ts"], ["chunking", "chunk.ts"], ["synthetic prefix", "prefix.ts"], ["compact snippets", "snippet.ts"], ["content freshness", "freshness.ts"]]) console.log(`| ${piece} | ${file} | ${loc(file!)} |`);

if (process.env.RUN_ROWS) console.log(`\n## Rows\n\n${rows.join("\n")}`);
