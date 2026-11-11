// What a native session gave the user, in score.mjs's answer-level interface (README "Adapters"), and its retrieval
// costs (0074 §6). Pure functions over a parsed trace (trace.mjs) and the brain's id index; outcomes are read by
// world.mjs from the files the session left.
import { brainCategory, splitShell, unwrapShell } from "./classify.mjs";

// The harness asks every session to end with this line (run.mjs PROMPT_SUFFIX); its ids are the answer's citations.
const EVIDENCE_LINE = /^[\s>*_-]*evidence[\s*_]*:(.*)$/i;
const ID = /\b[a-z]{2,5}-[0-9a-z]{8}\b/g;
const TASK_REF = /\brepo:([a-z0-9-]+)\/build\/TASKS\.md#([A-Z]+-\d+)\b/g;
const TASK = /\b([A-Z]{1,5}-\d+)\b/g;
const PATH = /[\w./~-]+\.md\b/g;

/**
 * The ids an answer cites: those on its last `Evidence:` line. A note id counts when the brain has it; a note path
 * (`knowledge/decisions/….md`, absolute or relative) counts as its note's id; `T-12` or `repo:<name>/build/TASKS.md#T-12`
 * counts as a task row of a linked repo, the caller's first.
 *   index: { ids: Set, pathToId: Map(rel path → id) }   tasks: { [repo]: [task id…] }
 * Returns { citations, line } (line null when the answer has no Evidence line: then it cites nothing).
 */
export function extractCitations(text, { index, tasks = {}, caller }) {
  const lines = (text ?? "").split("\n");
  let line = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = EVIDENCE_LINE.exec(lines[i]);
    if (m) { line = m[1].trim(); break; }
  }
  if (line === null) return { citations: [], line: null };
  const out = [];
  const add = (id) => { if (!out.includes(id)) out.push(id); };
  let rest = line.replace(TASK_REF, (all, repo, task) => { if ((tasks[repo] ?? []).includes(task)) add(`repo:${repo}/build/TASKS.md#${task}`); return " "; });
  rest = rest.replace(PATH, (p) => {
    const rel = p.replace(/^.*?\/brain\//, "").replace(/^\.\//, "");
    const id = index.pathToId.get(rel);
    if (id) add(id);
    return " ";
  });
  for (const m of rest.matchAll(ID)) if (index.ids.has(m[0])) add(m[0]);
  for (const m of rest.matchAll(TASK)) {
    const repo = (tasks[caller] ?? []).includes(m[1]) ? caller : Object.keys(tasks).find((r) => tasks[r].includes(m[1]));
    if (repo) add(`repo:${repo}/build/TASKS.md#${m[1]}`);
  }
  return { citations: out, line };
}

/** The brain CLI's JSON outputs in a call's output (one or more objects, as a script may run several commands). */
export function jsonOutputs(output) {
  const found = [];
  const text = output ?? "";
  let i = text.indexOf('{"ok":');
  while (i >= 0) {
    // find the matching brace
    let depth = 0, inString = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) { if (ch === "\\") j++; else if (ch === '"') inString = false; continue; }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) break;
    try { found.push(JSON.parse(text.slice(i, end + 1))); } catch { /* not JSON after all */ }
    i = text.indexOf('{"ok":', end + 1);
  }
  return found;
}

/** The brain commands a call ran (from its command line) and what they printed (from its output). */
export function brainCommandsOf(call) {
  const script = call.tool === "shell" ? unwrapShell(call.input?.command ?? "") : call.tool === "Bash" ? call.input?.command ?? "" : null;
  if (script === null) return { commands: [], outputs: [] };
  const commands = [];
  for (const { words } of splitShell(script)) {
    const i = words.findIndex((w) => /(?:^|\/)(?:brain|ultimate-brain)$/.test(w));
    if (i >= 0) commands.push({ args: words.slice(i + 1), ...brainCategory(words.slice(i + 1)) });
  }
  return { commands, outputs: commands.length ? jsonOutputs(call.output) : [] };
}

/** Every full read the session made (`brain query --read`'s `notes`), for the cases' `withheld` (score.mjs scoreReads). */
export function readsOf(calls) {
  const reads = [];
  for (const call of calls) for (const out of brainCommandsOf(call).outputs) if (out.command === "query" && Array.isArray(out.data?.notes)) reads.push(...out.data.notes);
  return reads;
}

/** What `brain apply` reported for each proposal: { [id]: { result, reason? } }, the last report winning. */
export function applyReportsOf(calls) {
  const reports = {};
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    if (typeof value.proposal === "string" && typeof value.result === "string") reports[value.proposal] = { result: value.result, ...(value.reason ? { reason: value.reason } : {}) };
    Object.values(value).forEach(visit);
  };
  for (const call of calls) for (const out of brainCommandsOf(call).outputs) if (out.command === "apply") visit(out.data);
  return reports;
}

/**
 * The retrieval a session received from the brain, measured as 0074 §6 asks: the opening pack (`recall --pack`'s
 * `text`, against the 800-token budget) apart from later retrieval (every other answer-surface output), in tokens
 * of `count` (o200k_base, as adapters/recall.mjs) and bytes; administrative output is reported apart.
 */
export function retrievalOf(calls, count) {
  const cost = { opening: { calls: 0, tokens: 0, bytes: 0, pack_tokens: [] }, later: { calls: 0, tokens: 0, bytes: 0 }, administrative: { calls: 0, tokens: 0, bytes: 0 }, tokenizer: count ? count.label : null };
  for (const call of calls) {
    const { commands, outputs } = brainCommandsOf(call);
    if (!commands.length) continue;
    const text = call.output ?? "";
    const bytes = Buffer.byteLength(text, "utf8");
    const tokens = count ? count(text) : null;
    const pack = outputs.find((o) => o.command === "recall" && typeof o.data?.text === "string");
    const phase = pack ? "opening" : commands.some((c) => c.category === "answer") ? "later" : "administrative";
    const p = cost[phase];
    p.calls++;
    p.bytes += bytes;
    p.tokens = tokens === null || p.tokens === null ? null : p.tokens + tokens;
    if (pack) p.pack_tokens.push({ tokens: count ? count(pack.data.text) : null, estimate: pack.data.tokens ?? null, budget: pack.data.budget ?? 800 });
  }
  return cost;
}

/** Everything the session received from its tools, as one text (judged against a case's `forbidden_text`). */
export function receivedOf(calls) {
  return calls.map((c) => c.output ?? "").join("\n");
}
