#!/usr/bin/env node
// Scores a native run with the unchanged score.mjs and writes its results (CC-200): <run>/results.md and results.json.
// Usage: node eval/memory-0.12/native/results.mjs <run-dir>
// run.mjs calls this at the end; run it again to rewrite the results from the kept sessions without a new session.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCORE = join(here, "..", "score.mjs");
export const AGENT_NAMES = { claude: "Claude Code", codex: "Codex" };

/** score.mjs's JSON summary for one agent's answers. */
export function scoreAgent(runDir, agent, worldRoot) {
  const r = spawnSync(process.execPath, [SCORE, worldRoot, "--adapter", "../native/adapter", "--cases", join(runDir, "cases.json"), "--json"], {
    encoding: "utf8", env: { ...process.env, NATIVE_ANSWERS: join(runDir, agent, "answers.json") }, maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(`score.mjs failed for ${agent}: ${r.stderr.slice(0, 500)}`);
  return JSON.parse(r.stdout);
}

const pct = (t) => (t.total ? `${t.pass}/${t.total} (${Math.round((100 * t.pass) / t.total)}%)` : "— (no case)");
const sum = (xs) => xs.reduce((a, b) => a + (b ?? 0), 0);
const mean = (xs) => (xs.length ? Math.round(sum(xs) / xs.length) : 0);
const n = (x) => (x === null || x === undefined ? "—" : typeof x === "number" ? x.toLocaleString("en-US") : String(x));

/** The identity header (README "A run's trace and identity"), as Markdown table rows. */
export function identityRows(id) {
  const s = id.snapshot;
  return [
    ["package", `\`${id.package.file}\`, sha256 \`${id.package.sha256}\` (package.json version ${id.package.version})`],
    ["CLI", `\`brain --version\`: ${id.cli_version}`],
    ["commit the package was built from", `\`${id.package_commit.sha}\` (${id.package_commit.from})`],
    ["harness checkout", `\`${id.checkout.commit}\`${id.checkout.dirty ? ", eval/memory-0.12 has uncommitted changes" : ", eval/memory-0.12 clean"}`],
    ["skills snapshot", `${s.name} ${s.version}, integrity \`${s.integrity}\`, fork commit \`${s.source_commit}\`, tag \`${s.tag}\``],
    ["brain", `make-brain.mjs at the harness checkout; output hash \`${id.brain.output_hash}\`; cases.json as committed: ${id.brain.cases_match ? "yes" : "NO"}; linked: ${id.brain.linked.join(", ")}`],
    ...Object.entries(id.agents).map(([a, v]) => [`agent: ${AGENT_NAMES[a] ?? a}`, `${v.version}; model ${v.models.length ? v.models.map((m) => `\`${m}\``).join(", ") : "not reported"}`]),
    ["cases", `${id.cases.total} (${id.cases.trust} critical trust, ${id.cases.answerable} answerable, ${id.cases.unknown} unknown)${id.cases.subset ? `: a subset, ${id.cases.ids.join(", ")}` : ""}`],
    ["prompt", `the case's question${id.prompt.task ? `, after "${id.prompt.task}" when the case names a task` : ""}, then: "${id.prompt.suffix}"`],
    ["timeout", `${id.timeout_s} s per session`],
    ["run", `${id.started} to ${id.finished ?? "?"}`],
  ];
}

/** Every session of an agent, as written by run.mjs. */
export function sessionsOf(runDir, agent) {
  const dir = join(runDir, agent);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, "session.json"))).sort().map((d) => JSON.parse(readFileSync(join(dir, d, "session.json"), "utf8")));
}

/** One agent's figures: score.mjs's gates, the read check, isolation and token accounting. */
export function agentFigures(score, sessions) {
  const violating = sessions.filter((s) => s.violations.length);
  const isolation = sessions.filter((s) => s.isolation.problems.length);
  const usage = sessions.map((s) => s.usage).filter(Boolean);
  const packs = sessions.flatMap((s) => s.retrieval?.opening?.pack_tokens ?? []);
  const later = sessions.map((s) => s.retrieval?.later).filter((l) => l && l.calls);
  const gates = {
    trust: { ...score.gates.trust },
    answerable: { ...score.gates.answerable },
    unknown: score.unknown,
    reads: { required: "0 sessions", violating: violating.length, total: sessions.length, met: violating.length === 0 },
    isolation: { problems: isolation.length, met: isolation.length === 0 },
  };
  // A subset run may hold no case of a kind: that gate is not judged (null), not failed.
  for (const k of ["trust", "answerable"]) if (gates[k].total === 0) gates[k].met = null;
  gates.met = [gates.trust.met, gates.answerable.met, gates.reads.met, gates.isolation.met].every((m) => m !== false);
  return {
    gates,
    tokens: {
      sessions: sessions.length,
      input: sum(usage.map((u) => u.input)), cached_input: sum(usage.map((u) => u.cached_input)), output: sum(usage.map((u) => u.output)), total: sum(usage.map((u) => u.total)),
      mean_total: mean(usage.map((u) => u.total)), cost_usd: usage.some((u) => typeof u.cost_usd === "number") ? Math.round(100 * sum(usage.map((u) => u.cost_usd))) / 100 : null,
      wall_ms: sum(sessions.map((s) => s.ms)), mean_ms: mean(sessions.map((s) => s.ms)),
      opening: { packs: packs.length, mean: mean(packs.map((p) => p.tokens)), max: Math.max(0, ...packs.map((p) => p.tokens ?? 0)), over_budget: packs.filter((p) => (p.tokens ?? 0) > (p.budget ?? 800)).length, budget: 800 },
      later: { sessions: later.length, calls: sum(later.map((l) => l.calls)), mean_tokens: mean(later.map((l) => l.tokens)), mean_bytes: mean(later.map((l) => l.bytes)) },
      tokenizer: sessions.find((s) => s.retrieval?.tokenizer)?.retrieval.tokenizer ?? null,
    },
    violating, isolation,
  };
}

/** The results file's Markdown. */
export function renderResults(run, perAgent) {
  const L = [];
  L.push(`# Native run of eval/memory-0.12 (decision 0077 §5)`, "");
  L.push(`One fresh non-interactive session per case and agent, in the case's caller repo, on the package below; written by \`eval/memory-0.12/native/run.mjs\` (CC-200). A result counts only for the artifacts named here, and a fix after the run invalidates it (0077 §5).`, "");
  L.push("## Identity", "", "| | |", "|---|---|");
  for (const [k, v] of identityRows(run.identity)) L.push(`| ${k} | ${v} |`);
  L.push("", "## Gates", "");
  L.push("| agent | critical trust (100%) | answerable (at least 90%) | unknown (reported) | no brain-file read (every session) | isolation | met |", "|---|---|---|---|---|---|---|");
  for (const [agent, f] of Object.entries(perAgent)) {
    const g = f.gates;
    L.push(`| ${AGENT_NAMES[agent] ?? agent} | ${pct(g.trust)} | ${pct(g.answerable)} | ${pct(g.unknown)} | ${g.reads.total - g.reads.violating}/${g.reads.total} clean | ${g.isolation.met ? "clean" : `${g.isolation.problems} sessions`} | ${g.met ? "yes" : "NO"} |`);
  }
  L.push("", "A session that opens, searches or lists a file under the brain other than its product files fails the run (spec/eligibility.md §12 item 4), whatever its answer; the classifier is `native/lib/classify.mjs`.", "");
  L.push("## Token accounting (0074 §6)", "");
  L.push("| agent | sessions | agent input tokens (cached) | agent output tokens | mean per session | cost (USD, as the agent reports it) | wall time (mean per session) |", "|---|---|---|---|---|---|---|");
  for (const [agent, f] of Object.entries(perAgent)) {
    const t = f.tokens;
    L.push(`| ${AGENT_NAMES[agent] ?? agent} | ${t.sessions} | ${n(t.input)} (${n(t.cached_input)}) | ${n(t.output)} | ${n(t.mean_total)} | ${t.cost_usd === null ? "not reported" : t.cost_usd} | ${Math.round(t.wall_ms / 1000)} s (${Math.round(t.mean_ms / 1000)} s) |`);
  }
  L.push("", "| agent | opening packs (`recall --pack`) | pack tokens, mean / max (budget 800) | over budget | later retrieval: sessions, calls | later tokens per session, mean (bytes) |", "|---|---|---|---|---|---|");
  for (const [agent, f] of Object.entries(perAgent)) {
    const o = f.tokens.opening, l = f.tokens.later;
    L.push(`| ${AGENT_NAMES[agent] ?? agent} | ${o.packs} | ${o.mean} / ${o.max} | ${o.over_budget} | ${l.sessions}, ${l.calls} | ${l.mean_tokens} (${l.mean_bytes}) |`);
  }
  L.push("", `Agent tokens are each agent's own usage report (Claude Code's \`result.usage\`: input = uncached + cache read + cache write; Codex's \`turn.completed\` usage, whose input includes the cached part and whose output includes reasoning). Retrieval tokens are the brain CLI's output the session received, measured with ${Object.values(perAgent)[0]?.tokens.tokenizer ?? "no tokenizer (install it: npm ci --prefix eval/memory-0.12/adapters)"}.`, "");
  L.push("## Failures", "");
  for (const [agent, f] of Object.entries(perAgent)) {
    L.push(`### ${AGENT_NAMES[agent] ?? agent}`, "");
    const rows = f.score.rows.map((r) => {
      const s = f.sessionsById[r.id];
      const extra = [...(s?.violations ?? []).map((v) => `read a brain file: ${v.tool} ${v.reason} (${v.paths.map((p) => p.rel || ".").join(", ")})`), ...(s?.isolation.problems ?? [])];
      return { ...r, reasons: [...r.reasons, ...extra], pass: r.pass && extra.length === 0 };
    }).filter((r) => !r.pass);
    if (!rows.length) L.push("None.");
    for (const r of rows) L.push(`- ${r.id} [${r.kind}/${r.category}]: ${r.reasons.join("; ")}`);
    L.push("");
  }
  L.push("## Sessions", "", "| agent | case | model | result | s | tool calls | brain CLI calls | brain-file reads | agent tokens (in / out) |", "|---|---|---|---|---|---|---|---|---|");
  for (const [agent, f] of Object.entries(perAgent)) {
    for (const r of f.score.rows) {
      const s = f.sessionsById[r.id];
      if (!s) continue;
      const result = s.timed_out ? "timed out" : s.error ? `error: ${s.error}` : r.pass && !s.violations.length && !s.isolation.problems.length ? "pass" : "FAIL";
      L.push(`| ${AGENT_NAMES[agent] ?? agent} | ${r.id} | ${s.models.join(", ") || "—"} | ${result} | ${Math.round(s.ms / 1000)} | ${s.calls.length} | ${s.calls.filter((c) => c.kind === "brain-cli" || c.brain).length} | ${s.violations.length} | ${n(s.usage?.input)} / ${n(s.usage?.output)} |`);
    }
  }
  L.push("", "Each session's trace (scrubbed of the run folder, UUIDs and e-mail addresses), reply and summary are in `<agent>/<case>/`: `trace.jsonl`, `reply.md`, `session.json`.", "");
  return L.join("\n");
}

export function writeResults(runDir) {
  const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));
  const perAgent = {};
  for (const agent of run.agents) {
    const score = scoreAgent(runDir, agent, join(runDir, run.world_root));
    const sessions = sessionsOf(runDir, agent);
    perAgent[agent] = { ...agentFigures(score, sessions), score, sessionsById: Object.fromEntries(sessions.map((s) => [s.case, s])) };
  }
  writeFileSync(join(runDir, "results.md"), renderResults(run, perAgent));
  const json = { identity: run.identity, agents: Object.fromEntries(Object.entries(perAgent).map(([a, f]) => [a, { gates: f.gates, tokens: f.tokens, rows: f.score.rows, categories: f.score.categories }])) };
  writeFileSync(join(runDir, "results.json"), JSON.stringify(json, null, 2) + "\n");
  return perAgent;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const runDir = process.argv[2];
  if (!runDir) { console.error("usage: results.mjs <run-dir>"); process.exit(2); }
  writeResults(runDir);
  console.log(readFileSync(join(runDir, "results.md"), "utf8"));
}
