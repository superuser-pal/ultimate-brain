#!/usr/bin/env node
// Scores one adapter on the 0.12.0 memory evaluation and prints decision 0074 §6's gates (CC-165).
// Usage: node eval/memory-0.12/score.mjs <out-dir> [--adapter <name>] [--cases <file>] [--rows] [--json] [--strict]
//   <out-dir>   what make-brain.mjs wrote: <out-dir>/brain and <out-dir>/repos/<name>
//   --adapter   a module in adapters/ (default query-candidates)
//   --rows      print every case, not only the failures
//   --json      print the full result as JSON instead of text
//   --strict    exit 1 when a gate fails (the baseline is not expected to pass, so the default exits 0)
// The scoring rules are in README.md; this file is their implementation.
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const GATES = { trust: 1.0, answerable: 0.9 };

// Abstention (README "Abstention", CC-201): an answer abstains when the adapter says so, or when its text says the brain
// does not hold what was asked. The text is cut into clauses: lines, then sentences at . ! ? ; followed by a space.
// - SAYS_UNKNOWN: the speaker or the brain lacks the answer ("I couldn't find", "not in the brain", "no record of",
//   "is not recorded", "I don't know"). One anywhere in the answer is an abstention.
// - SAYS_ABSENT: a thing is absent ("no recorded decision", "no deploy freeze is recorded"). An answer can state that as
//   a fact beside its answer, so it is an abstention only when the answer says nothing else: every clause holds one of
//   the two, or is NEUTRAL.
// - NEUTRAL: the `Evidence:` line, and narration of the search ("I searched the brain for …").
const SAYS_UNKNOWN = [
  /\b(?:couldn't|could not|can't|cannot|can not|didn't|did not|wasn't able to|was not able to|unable to) (?:find|locate)\b/,
  /(?:\bnot|n't|\bnothing) (?:\w+ )?in the brain\b/,
  /\bno (?:records?|information|mention|evidence)\b/,
  /\bno (?:approved |eligible )?memor(?:y|ies)\b/,
  /(?:\bnot|n't) (?:been |yet )?(?:recorded|documented|stated|known|found)\b/,
  /\bnothing (?:is |was |has been )?(?:recorded|documented|about)\b/,
  /\b(?:don't|do not) know\b/,
  /\bunknown\b/,
  /\b(?:doesn't|does not) (?:say|hold|record)\b/,
];
const SAYS_ABSENT = [/\bno\b[^.;]{0,60}\b(?:recorded|documented)\b/, /\bno\b[^.;]{0,60}\bin the brain\b/];
const NEUTRAL = [/^evidence\b/, /^i(?: have|'ve)? (?:searched|checked|looked|queried|ran|read)\b/];
const MARKUP = /^[\s#>*_`-]+|[\s*_`]+$/g;

/** The clauses of an answer: its lines, each cut into sentences except the Evidence line; plain, lower case. */
function clauses(text) {
  const lines = String(text ?? "").replace(/[‘’]/g, "'").toLowerCase().split("\n").map((l) => l.replace(MARKUP, ""));
  return lines.flatMap((line) => (/^evidence\b/.test(line) ? [line] : line.split(/[.!?;]+(?=\s|$)/))).map((c) => c.replace(MARKUP, "")).filter(Boolean);
}

/** Whether an answer's text says the brain does not hold what was asked (README "Abstention"). */
export function abstains(text) {
  const parts = clauses(text);
  const any = (patterns, clause) => patterns.some((re) => re.test(clause));
  if (parts.some((c) => any(SAYS_UNKNOWN, c))) return true;
  return parts.some((c) => any(SAYS_ABSENT, c)) && parts.every((c) => any(SAYS_ABSENT, c) || any(NEUTRAL, c));
}
// The words that label a cited item in an answer.
const LABEL_WORDS = {
  superseded: /supersed|previous|replaced|retired|no longer|used to|earlier|formerly|changed|old rule|corrected/i,
  inferred: /inferr|inference|not verified|unverified/i,
  contested: /contested|conflict|disagree|not settled|unclear/i,
  // CC-185: a superseded memory read for a question about the past (0077 §2), and a draft knowledge note (eligibility.md §2).
  historical: /histor|previous|used to|earlier|formerly|no longer|supersed|retired|replaced/i,
  draft: /draft|not (yet )?reviewed|unreviewed|not approved/i,
};
// At the retrieval level a candidate's label satisfies the case's label when it is the same, or one of these: the
// historical search (`recall --search --include-superseded`) marks a superseded memory with `superseded_by`, the
// historical read (`query --read --historical`) adds `historical: true` (spec/eligibility.md §5).
const SATISFIES = { historical: ["historical", "superseded"] };
const norm = (text) => text.replace(/\s+/g, " ").trim();
const matches = (fact, text) => fact.all.every((re) => new RegExp(re, "i").test(text));

/** Retrieval level: the candidates a retriever delivers (README "Retrieval"). */
function scoreRetrieval(c, result) {
  const reasons = [];
  const list = result.candidates ?? [];
  const rank = new Map(list.map((x, i) => [x.id, i]));
  for (const id of c.forbidden_evidence) if (rank.has(id)) reasons.push(`returned forbidden ${id} (rank ${rank.get(id) + 1})`);
  for (const { id, label } of c.labelled_evidence) {
    const hit = list.find((x) => x.id === id);
    if (hit && !(SATISFIES[label] ?? [label]).some((l) => (hit.labels ?? []).includes(l))) reasons.push(`returned ${id} without the label "${label}"`);
  }
  for (const [above, below] of c.rank_above) if (rank.has(above) && rank.has(below) && rank.get(above) > rank.get(below)) reasons.push(`${below} ranked above ${above}`);
  if (c.kind === "answerable") for (const id of c.expected_evidence) if (!rank.has(id)) reasons.push(`missed ${id}`);
  if (typeof result.output === "string") for (const f of c.forbidden_text ?? []) if (matches(f, result.output)) reasons.push(`output holds what it must not: ${f.says}`);
  reasons.push(...scoreReads(c, result));
  return reasons;
}

/**
 * Reads (CC-185): when the adapter reports the full reads it made (`result.reads`, the entries of `query --read`'s
 * `notes`), a read of an id the case lists in `withheld` must be { id, status: "withheld", reason } and nothing else
 * (spec/eligibility.md §4.3). An id the adapter did not read is not judged.
 */
function scoreReads(c, result) {
  const reasons = [];
  for (const w of c.withheld ?? []) {
    const read = (result.reads ?? []).find((r) => r.id === w.id);
    if (!read) continue;
    if (read.status !== "withheld") reasons.push(`read ${w.id} was returned, not withheld`);
    else if (read.reason !== w.reason) reasons.push(`read ${w.id} withheld as ${read.reason}, not ${w.reason}`);
    else if (Object.keys(read).some((k) => !["id", "status", "reason"].includes(k))) reasons.push(`read ${w.id} withheld with more than its id and reason`);
  }
  return reasons;
}

/** Answer level: the text an answerer writes and the evidence it cites (README "Answers"). */
export function scoreAnswer(c, result) {
  const reasons = [];
  const answer = result.answer ?? { text: "", citations: [] };
  const text = norm(answer.text ?? "");
  const cited = new Set(answer.citations ?? []);
  const abstained = answer.abstained === true || abstains(answer.text);
  for (const id of c.forbidden_evidence) if (cited.has(id)) reasons.push(`cited forbidden ${id}`);
  for (const f of c.forbidden_facts) if (matches(f, text)) reasons.push(`says what it must not: ${f.says}`);
  for (const { id, label } of c.labelled_evidence) if (cited.has(id) && !LABEL_WORDS[label].test(text)) reasons.push(`cites ${id} without saying it is ${label}`);
  if (c.kind === "unknown" || c.abstain) {
    if (!abstained) reasons.push("does not say the brain lacks the answer");
  } else if (abstained && c.kind === "answerable" && (!c.facts.length || c.facts.some((f) => !matches(f, text)))) {
    // Facts first (the user, 2026-11-11, CC-201): an answer holding every required fact passes whatever caveat it adds.
    // A case with no facts to show it answered (the proposal cases) keeps the plain rule.
    reasons.push("abstained on an answerable case");
  }
  if (c.kind !== "unknown") {
    for (const f of c.facts) if (!matches(f, text)) reasons.push(`missing fact: ${f.says}`);
    if (c.kind === "answerable") for (const id of c.expected_evidence) if (!cited.has(id)) reasons.push(`did not cite ${id}`);
  }
  for (const f of c.forbidden_text ?? []) {
    if (matches(f, text)) reasons.push(`says what it must not: ${f.says}`);
    else if (typeof result.output === "string" && matches(f, result.output)) reasons.push(`received what it must not: ${f.says}`);
  }
  reasons.push(...scoreReads(c, result));
  return reasons;
}

/**
 * Outcomes (CC-185): what a case leaves in the brain and the caller's repo after it runs, on a fresh copy of the brain.
 * result.outcome: { proposals?: { [id]: { status, reason? } }, notes?: { [id]: text of the note's file },
 *                   created?: [{ id, text }], repos?: { [name]: { managed_block, project_text_sha256 } } }
 * Returns null when the case expects no outcome, or when the adapter reports none (then the case is "not judged").
 */
function scoreOutcome(c, result) {
  if (!c.outcomes && !c.created_forbidden && !c.upgrade) return null;
  const outcome = result.outcome;
  if (!outcome) return null;
  const reasons = [];
  for (const o of c.outcomes ?? []) {
    const got = outcome.proposals?.[o.proposal];
    const target = outcome.notes?.[o.target];
    if (!got) { reasons.push(`no outcome reported for ${o.proposal}`); continue; }
    if (o.expect === "applied" && got.status !== "applied") reasons.push(`${o.proposal} is ${got.status}, not applied`);
    if (o.expect === "withheld") {
      // On apply a withheld item is closed with its reason, its decision recorded (spec/eligibility.md §4.3).
      if (got.status !== "closed") reasons.push(`${o.proposal} is ${got.status}, not closed`);
      else if (o.reason && got.reason !== o.reason) reasons.push(`${o.proposal} withheld with reason ${got.reason ?? "(none)"}, not ${o.reason}`);
    }
    if (typeof target !== "string") { if (o.written.length || o.forbidden_written.length) reasons.push(`no text reported for the target ${o.target}`); continue; }
    for (const f of o.written) if (!matches(f, target)) reasons.push(`${o.target} lacks ${f.says}`);
    for (const f of o.forbidden_written) if (matches(f, target)) reasons.push(`${o.target} holds ${f.says}`);
  }
  for (const f of c.created_forbidden ?? []) for (const p of outcome.created ?? []) if (matches(f, p.text ?? "")) reasons.push(`created ${p.id} holding ${f.says}`);
  if (c.upgrade) {
    const repo = outcome.repos?.[c.upgrade.repo];
    if (!repo) reasons.push(`no upgrade state reported for ${c.upgrade.repo}`);
    else {
      if (repo.managed_block !== c.upgrade.managed_block) reasons.push(`${c.upgrade.repo}'s managed block is ${repo.managed_block}, not ${c.upgrade.managed_block}`);
      if (repo.project_text_sha256 !== c.upgrade.project_text_sha256) reasons.push(`${c.upgrade.repo}'s project-owned text changed`);
    }
  }
  return reasons;
}

// Run as a script: score the adapter on every case. Imported (tests), it only exports the rules.
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) await main();

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => argv.includes(name);
  const option = (name, fallback) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : fallback);
  const out = argv[0];
  if (!out || out.startsWith("--")) {
    console.error("usage: score.mjs <out-dir> [--adapter <name>] [--cases <file>] [--rows] [--json] [--strict]");
    process.exit(2);
  }
  const adapterName = option("--adapter", "query-candidates");
  const casesFile = option("--cases", join(here, "cases.json"));
  const { cases } = JSON.parse(readFileSync(casesFile, "utf8"));
  const adapter = (await import(join(here, "adapters", `${adapterName}.mjs`))).default;
  if (!["retrieval", "answer"].includes(adapter.level)) throw new Error(`adapter ${adapterName}: level must be retrieval or answer`);


  const rows = [];
  for (const c of cases) {
    const env = { brain: resolve(out, "brain"), callerDir: resolve(out, "repos", c.caller.repo), out: resolve(out) };
    let result;
    let reasons;
    // Outcomes: judged when the adapter reports them; an answer-level adapter must, a retriever can't (README).
    let outcome = "none";
    try {
      result = await adapter.run(c, env);
      reasons = adapter.level === "retrieval" ? scoreRetrieval(c, result) : scoreAnswer(c, result);
      const judged = scoreOutcome(c, result);
      if (judged) { outcome = "judged"; reasons.push(...judged); }
      else if (c.outcomes || c.created_forbidden || c.upgrade) {
        outcome = "not judged";
        if (adapter.level === "answer") reasons.push("no outcome reported (proposals, created proposals or upgrade state)");
      }
    } catch (error) {
      result = {};
      reasons = [`adapter failed: ${String(error.message ?? error).split("\n")[0]}`];
    }
    rows.push({ id: c.id, kind: c.kind, category: c.category, pass: reasons.length === 0, reasons, outcome, returned: (result.candidates ?? []).map((x) => x.id), cost: result.cost ?? null });
  }

  const tally = (filter) => {
    const set = rows.filter(filter);
    return { pass: set.filter((r) => r.pass).length, total: set.length };
  };
  const kinds = Object.fromEntries(["trust", "answerable", "unknown"].map((k) => [k, tally((r) => r.kind === k)]));
  const rate = (t) => (t.total ? t.pass / t.total : 0);
  const gates = {
    trust: { required: "100%", ...kinds.trust, met: kinds.trust.total > 0 && rate(kinds.trust) >= GATES.trust },
    answerable: { required: "≥ 90%", ...kinds.answerable, met: kinds.answerable.total > 0 && rate(kinds.answerable) >= GATES.answerable },
  };
  const categories = [...new Set(rows.map((r) => `${r.kind}/${r.category}`))].map((key) => ({ key, ...tally((r) => `${r.kind}/${r.category}` === key) }));
  const costs = {};
  for (const r of rows.filter((x) => x.cost)) {
    const p = (costs[r.cost.phase ?? "later"] ||= { cases: 0, bytes: 0, tokens: 0, ms: 0, tokensKnown: true });
    p.cases++;
    p.bytes += r.cost.bytes ?? 0;
    p.ms += r.cost.ms ?? 0;
    if (typeof r.cost.tokens === "number") p.tokens += r.cost.tokens;
    else p.tokensKnown = false;
  }
  const summary = { adapter: adapter.name, level: adapter.level, describe: adapter.describe, cases: casesFile, gates, unknown: kinds.unknown, categories, costs, rows };

  if (flag("--json")) console.log(JSON.stringify(summary, null, 2));
  else {
    const pct = (t) => `${t.pass}/${t.total} (${t.total ? Math.round((100 * t.pass) / t.total) : 0}%)`;
    const lines = [];
    lines.push(`adapter: ${adapter.name} (${adapter.level} level)`, `runs: ${adapter.describe}`, `cases: ${rows.length}`, "");
    lines.push("| gate (0074 §6) | required | result | met |", "|---|---|---|---|");
    lines.push(`| critical trust | 100% | ${pct(gates.trust)} | ${gates.trust.met ? "yes" : "NO"} |`);
    lines.push(`| answerable | at least 90% | ${pct(gates.answerable)} | ${gates.answerable.met ? "yes" : "NO"} |`);
    lines.push(`| unknown (scored separately) | reported | ${pct(kinds.unknown)} | — |`, "");
    lines.push("| kind / category | pass |", "|---|---|");
    for (const c of categories) lines.push(`| ${c.key} | ${pct(c)} |`);
    lines.push("");
    for (const [phase, p] of Object.entries(costs)) {
      lines.push(`cost (${phase} retrieval): ${p.cases} calls, mean ${Math.round(p.bytes / p.cases)} bytes and ${Math.round(p.ms / p.cases)} ms per call; tokens ${p.tokensKnown ? `mean ${Math.round(p.tokens / p.cases)}` : "not measured by this adapter (bytes are not a token count, 0074 §3)"}`);
    }
    if (!costs.opening) lines.push("cost (opening pack): not measured by this adapter");
    const unjudged = rows.filter((r) => r.outcome === "not judged");
    if (unjudged.length) lines.push(`outcomes not judged: ${unjudged.length} cases (${unjudged.map((r) => r.id).join(", ")}): this adapter reports no proposal or upgrade outcome, so they are scored on what it returned only`);
    lines.push("");
    const shown = flag("--rows") ? rows : rows.filter((r) => !r.pass);
    lines.push(flag("--rows") ? "every case:" : "failures:");
    for (const r of shown) lines.push(`- ${r.id} [${r.kind}/${r.category}] ${r.pass ? "pass" : "FAIL"}${r.reasons.length ? `: ${r.reasons.join("; ")}` : ""}`);
    console.log(lines.join("\n"));
  }
  if (flag("--strict") && !(gates.trust.met && gates.answerable.met)) process.exit(1);
}
