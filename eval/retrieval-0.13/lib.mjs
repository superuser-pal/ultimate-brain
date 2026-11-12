// Pure scoring and audit rules of the 0.13.0 English retrieval evaluation (CC-203; spec/retrieval.md §5.5, §6).
// score.mjs feeds them the brain and an adapter's results; tests/retrieval-eval.test.mjs feeds them synthetic ones.
import { abstains } from "../memory-0.12/score.mjs";

export const LIMIT = 10;
export const KINDS = ["fact", "paraphrase", "clarify", "unknown"];

/** Retrieval gates (spec/retrieval.md §6.2): at least 18 of 20 on the first search. */
export const RETRIEVAL_GATES = { fact: 18, paraphrase: 18 };
/** The prose-only fact gate (the user's choice of 2026-11-11, spec/retrieval.md §6.2): at least 16 of the 17 existing body-only
 *  facts, eval/search-0.5's 10 fact-in-body questions and the 7 `fact` cases with `subgroup: body-only`. */
export const PROSE_FACT_GATE = { need: 16, of: 17 };
/** Answer gates: 36 of the 40 answerable cases (90%); every clarify and every unknown case. */
export const ANSWER_GATES = { answerable: 36, clarify: 20, unknown: 20 };

// An answer abstains as eval/memory-0.12/score.mjs judges it (CC-201's rule over the answer's clauses), so the two sets judge an
// abstention alike; on an answerable case the facts decide (below).
export { abstains };

const norm = (text) => text.replace(/[‘’]/g, "'").replace(/\s+/g, " ");
/** A fact is present when every one of its regular expressions matches (case-insensitive). */
export const matches = (fact, text) => fact.all.every((re) => new RegExp(re, "i").test(norm(text)));

/** The sets of ids that are all among `ids`. */

/**
 * Retrieval level: the first search's candidates (ids in rank order), cut to the first ten.
 * Returns { pass, reasons, rank } where `rank` is the rank at which the first sufficient set was complete (fact,
 * paraphrase), or the number of subjects with evidence in the first ten (clarify). `signal` is the ids the CLI's `unresolved`
 * names (spec/cli.md §5.13): a clarify case is also visible when it names two of its subjects (spec/retrieval.md §6.1); on any
 * other kind it is reported as `signaled`, never counted for it.
 */
export function scoreRetrieval(c, candidateIds, signal = []) {
  const top = candidateIds.slice(0, LIMIT);
  const reasons = [];
  for (const id of c.forbidden_evidence ?? []) if (top.includes(id)) reasons.push(`returned forbidden ${id}`);
  if (c.kind === "fact" || c.kind === "paraphrase") {
    // Each set's rank: where its last note is, or null when it is not whole in the first ten.
    const sets = c.evidence_sets.map((set) => (set.every((id) => top.includes(id)) ? Math.max(...set.map((id) => top.indexOf(id))) + 1 : null));
    const ranks = sets.filter((r) => r !== null);
    if (ranks.length === 0) reasons.push("no sufficient evidence set in the first ten");
    // Prose alone (reported): a set of meetings and minutes only, so a typed field or a title can't carry the case.
    const prose = c.evidence_sets.some((set, i) => sets[i] !== null && set.every((id) => /^(mtg|src)-/.test(id)));
    return { pass: reasons.length === 0, reasons, rank: ranks.length ? Math.min(...ranks) : null, sets, prose, signaled: signal.length > 0 };
  }
  if (c.kind === "clarify") {
    const seen = c.subjects.filter((s) => s.evidence.some((id) => top.includes(id))).length;
    const named = c.subjects.filter((s) => signal.includes(s.id)).length;
    if (seen < 2 && named < 2) reasons.push(`evidence of ${seen} subject${seen === 1 ? "" : "s"} in the first ten and ${named} named by the signal, not two`);
    return { pass: reasons.length === 0, reasons, rank: seen, named };
  }
  return { pass: reasons.length === 0, reasons, rank: null, signaled: signal.length > 0 };
}

/** Answer level: `answer` is { text, citations: [id…], abstained? }. Returns the reasons it fails (empty: it passes). */
export function scoreAnswer(c, answer) {
  const text = norm(answer?.text ?? "");
  const cited = new Set(answer?.citations ?? []);
  const abstained = answer?.abstained === true || abstains(answer?.text ?? "");
  const reasons = [];
  for (const id of c.forbidden_evidence ?? []) if (cited.has(id)) reasons.push(`cited forbidden ${id}`);
  if (c.kind === "fact" || c.kind === "paraphrase") {
    // memory-0.12's answerable rule (spec/retrieval.md §6.1): a complete, cited answer still fails when it also states what it must not.
    for (const f of c.forbidden_facts ?? []) if (matches(f, text)) reasons.push(`says what it must not: ${f.says}`);
    // Facts first, as memory-0.12 (CC-201, the user's choice of 2026-11-11): an answer holding every required fact passes whatever caveat it adds.
    if (abstained && (c.facts.length === 0 || c.facts.some((f) => !matches(f, text)))) reasons.push("abstained on an answerable case");
    for (const f of c.facts) if (!matches(f, text)) reasons.push(`missing fact: ${f.says}`);
    if (c.as_of && !matches(c.as_of, text)) reasons.push(`missing time qualification: ${c.as_of.says}`);
    if (!c.evidence_sets.some((set) => set.every((id) => cited.has(id)))) reasons.push("cites no complete evidence set");
  } else if (c.kind === "clarify") {
    if (!text.includes("?")) reasons.push("asks no question");
    const named = c.subjects.filter((s) => new RegExp(`\\b${s.name}\\b`, "i").test(text)).length;
    if (named < 2) reasons.push(`names ${named} of the subjects, not two`);
    for (const f of c.forbidden_facts) if (matches(f, text)) reasons.push(`states a subject's value: ${f.says}`);
    if (abstained) reasons.push("abstained instead of asking");
  } else {
    if (!abstained) reasons.push("does not say the brain lacks the answer");
    for (const f of c.forbidden_facts ?? []) if (matches(f, text)) reasons.push(`says what it must not: ${f.says}`);
  }
  return reasons;
}

/**
 * The audit (spec/retrieval.md §5.5), run before any adapter. `brain` gives what the audit reads:
 *   eligible(ids, caller) → Map id → eligible text (frontmatter and body as `brain query --read` returns it) or null if withheld
 *   about(id)             → [{ id, text }]: the notes about a subject (itself, notes that name it, its projects' notes, their minutes)
 *   suppressions          → the number of suppression records in the brain
 *   originalChanged       → paths of original notes the layer changed
 *   questionsChanged      → true when eval/search-0.5/questions.json no longer has the hash cases.json recorded
 * Returns [{ case, problem }].
 */
export function audit(set, brain) {
  const problems = [];
  const add = (c, problem) => problems.push({ case: c?.id ?? "-", problem });
  if (brain.suppressions > 0) add(null, `the brain has ${brain.suppressions} suppression record(s): the layer's text is assumed eligible as written`);
  for (const path of brain.originalChanged) add(null, `the layer changed an original note: ${path}`);
  if (brain.questionsChanged) add(null, "eval/search-0.5/questions.json changed");
  const byKind = Object.fromEntries(KINDS.map((k) => [k, set.cases.filter((c) => c.kind === k)]));
  const subgroups = { "body-only": 7, structured: 12, decision: 1 };
  for (const [g, n] of Object.entries(subgroups)) {
    const got = byKind.fact.filter((c) => c.subgroup === g).length;
    if (got !== n) add(null, `fact subgroup ${g}: ${got} cases, not ${n}`);
  }
  for (const k of KINDS) {
    if (byKind[k].length !== 20) add(null, `${k}: ${byKind[k].length} cases, not 20`);
    const held = byKind[k].filter((c) => c.split === "held").length;
    if (held !== 6) add(null, `${k}: ${held} held cases, not 6`);
  }
  const ids = new Set();
  for (const c of set.cases) {
    if (ids.has(c.id)) add(c, "duplicate case id");
    ids.add(c.id);
    if (!(c.caller in set.callers)) add(c, `unknown caller ${c.caller}`);
    if (!c.audit) add(c, "no audit line");
    const values = [...(c.facts ?? []), ...(c.subjects ?? []).map((s) => s.value)];
    for (const f of values) if (matches(f, c.question)) add(c, `the question holds its own answer: ${f.says}`);
    if (c.kind === "fact" || c.kind === "paraphrase") {
      if (!c.evidence_sets?.length) add(c, "no evidence set");
      if (!c.facts.length) add(c, "no fact to check");
      for (const evidence of c.evidence_sets ?? []) {
        const read = brain.eligible(evidence, c.caller);
        const missing = evidence.filter((id) => read.get(id) == null);
        if (missing.length) { add(c, `evidence not eligible for the caller: ${missing.join(", ")}`); continue; }
        const text = evidence.map((id) => read.get(id)).join("\n");
        for (const f of c.facts) if (!matches(f, text)) add(c, `set [${evidence.join(", ")}] does not hold: ${f.says}`);
      }
    } else if (c.kind === "clarify") {
      if ((c.subjects ?? []).length < 2) add(c, "fewer than two subjects");
      const caller = set.callers[c.caller] ?? {};
      const subjectIds = (c.subjects ?? []).map((s) => s.id);
      if (caller.project && subjectIds.includes(caller.project)) add(c, "the caller's project resolves the subject");
      if (caller.area && subjectIds.filter((id) => set.project_area[id] === caller.area).length < 2) add(c, "the caller's area resolves the subject");
      for (const id of subjectIds) if (set.project_titles[id] && c.question.toLowerCase().includes(set.project_titles[id].toLowerCase())) add(c, `the question names ${set.project_titles[id]}`);
      for (const s of c.subjects ?? []) {
        const read = brain.eligible(s.evidence, c.caller);
        for (const id of s.evidence) {
          if (read.get(id) == null) add(c, `evidence of ${s.id} not eligible for the caller: ${id}`);
          else if (!matches(s.value, read.get(id))) add(c, `${id} does not hold ${s.id}'s value: ${s.value.says}`);
        }
      }
    } else if (c.kind === "unknown") {
      if (!c.absent?.length) add(c, "no absence to check");
      for (const a of c.absent ?? []) {
        const notes = brain.about(a.about);
        if (notes.length === 0) add(c, `nothing about ${a.about} in the brain`);
        for (const n of notes) for (const re of a.none) if (new RegExp(re, "i").test(norm(n.text))) add(c, `${n.id} holds what the case says is absent: /${re}/`);
      }
    }
  }
  return problems;
}

/** Nearest-rank percentile of a list of numbers (spec/retrieval.md §7.1). */
export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}
export const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
