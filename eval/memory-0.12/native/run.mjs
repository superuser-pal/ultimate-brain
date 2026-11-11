#!/usr/bin/env node
// Runs the memory evaluation natively (CC-200, decision 0077 §5): each case as a fresh Claude Code or Codex session in
// its caller repo, on a packaged CLI, in a sandbox; keeps every trace and scores the answers with score.mjs.
// Usage:
//   node eval/memory-0.12/native/run.mjs --package <file.tgz | version> --out <run-dir>
//        [--agents claude,codex] [--cases <id,id…>] [--timeout <seconds>] [--jobs <n>]
//        [--claude-config <dir>] [--codex-home <dir>] [--commit <sha>] [--keep-world]
// See native/README.md for the logins, the sandbox, the check and the results layout.
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { checkLoginDir, claudeCommand, codexCommand, codexRollout, runSession, sessionEnv, versionOf, which } from "./lib/agents.mjs";
import { applyReportsOf, extractCitations, readsOf, receivedOf, retrievalOf, brainCommandsOf } from "./lib/answer.mjs";
import { classifyCall } from "./lib/classify.mjs";
import { codexRolloutModel, parseClaude, parseCodex } from "./lib/trace.mjs";
import { buildWorld, checkoutIdentity, collectOutcome, copyWorld, EVAL, indexBrain, installPackage, proposalsOf, scrub, tasksOf, brainCli, worldAt } from "./lib/world.mjs";
import { writeResults } from "./results.mjs";

export const PROMPT_TASK = "I'm working on {task} in this repo.";
export const PROMPT_SUFFIX = 'End your reply with one line that starts with "Evidence:" and lists the ids of the notes, memories or task rows (as T-<n>) your answer rests on, separated by commas, or "Evidence: none".';

/** The prompt of one case: what the user says, and the harness's one fixed instruction for citations. */
export function promptOf(testCase) {
  const task = testCase.caller.task ? `${PROMPT_TASK.replace("{task}", testCase.caller.task)} ` : "";
  return `${task}${testCase.question}\n\n${PROMPT_SUFFIX}\n`;
}

/** o200k_base from the tokenizer adapters/ installs (adapters/recall.mjs's), or null when it isn't installed. */
async function loadTokenizer() {
  try {
    const require = createRequire(join(EVAL, "adapters", "package.json"));
    const mod = await import(pathToFileURL(require.resolve("gpt-tokenizer/encoding/o200k_base")).href);
    const countTokens = mod.countTokens ?? mod.default?.countTokens;
    const version = JSON.parse(readFileSync(join(EVAL, "adapters", "node_modules", "gpt-tokenizer", "package.json"), "utf8")).version;
    const count = (text) => countTokens(text);
    count.label = `gpt-tokenizer ${version}, encoding o200k_base`;
    return count;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const a = {
    package: opt("--package"), out: opt("--out"), agents: opt("--agents", "claude,codex").split(","), cases: opt("--cases"),
    timeout: Number(opt("--timeout", "900")), jobs: Number(opt("--jobs", "2")), claudeConfig: opt("--claude-config", process.env.NATIVE_CLAUDE_CONFIG_DIR),
    codexHome: opt("--codex-home", process.env.NATIVE_CODEX_HOME), commit: opt("--commit"), keepWorld: argv.includes("--keep-world"),
  };
  if (!a.package || !a.out || a.agents.some((x) => !["claude", "codex"].includes(x)) || !(a.timeout > 0) || !(a.jobs >= 1)) {
    console.error("usage: run.mjs --package <file.tgz | version> --out <run-dir> [--agents claude,codex] [--cases <id,…>] [--timeout <s>] [--jobs <n>] [--claude-config <dir>] [--codex-home <dir>] [--commit <sha>] [--keep-world]");
    process.exit(2);
  }
  return a;
}

/** Runs one case for one agent and writes <run>/<agent>/<case>/: trace.jsonl, stderr.txt, reply.md, session.json. */
export async function runCase(ctx, agent, testCase) {
  const { runDir, login, bins, timeoutMs, index, tasks, pristineProposals, tokenizer } = ctx;
  const dir = join(runDir, agent, testCase.id);
  mkdirSync(dir, { recursive: true });
  const w = copyWorld(runDir, dir, { keychain: agent === "claude" });
  const setup = {};
  if (testCase.upgrade) {
    // The case runs after `brain upgrade`, in a fresh session (CC-185).
    const r = brainCli(runDir, w.home, ["upgrade"]);
    setup.upgrade = r.json?.ok ? { ok: true } : { ok: false, code: r.json?.error?.code ?? `exit ${r.status}`, message: r.json?.error?.message ?? r.stderr.slice(0, 300) };
  }
  const cwd = join(w.repos, testCase.caller.repo);
  const prompt = promptOf(testCase);
  const replyFile = join(dir, "reply.codex.md");
  const command = agent === "claude" ? claudeCommand({ bin: bins.claude, sessionRoot: dir }) : codexCommand({ bin: bins.codex, sessionRoot: dir, cwd, replyFile });
  const rawTrace = join(dir, "trace.raw.jsonl");
  const errFile = join(dir, "stderr.txt");
  const ran = await runSession({ command, cwd, env: sessionEnv(agent, runDir, w.home, login[agent]), prompt, traceFile: rawTrace, errFile, timeoutMs });
  const raw = readFileSync(rawTrace, "utf8");
  const parsed = agent === "claude" ? parseClaude(raw) : parseCodex(raw, { model: codexRolloutModel(codexRollout(login.codex, parseCodex(raw).session) ?? "") });
  if (agent === "codex" && !parsed.reply && existsSync(replyFile)) parsed.reply = readFileSync(replyFile, "utf8");

  // The no-file-read check and isolation.
  const aliases = [...new Set([w.brain, realpathSync(w.brain)])];
  const classifyCtx = { brain: w.brain, brainAliases: aliases, cwd, home: w.home, env: { BRAIN_DIR: w.brain, HOME: w.home } };
  const calls = parsed.calls.map((c) => ({ id: c.id, tool: c.tool, input: c.input, error: c.error, ...classifyCall(c, classifyCtx) }));
  const violations = calls.filter((c) => c.kind === "brain-read").map((c) => ({ id: c.id, tool: c.tool, reason: c.reason, paths: c.paths.filter((p) => p.access === "note").map((p) => ({ rel: p.rel })) }));
  const problems = [];
  for (const c of parsed.calls) for (const out of brainCommandsOf(c).outputs) if (out.brain && !aliases.includes(out.brain)) problems.push(`a brain command ran on another brain (${out.brain})`);
  if (parsed.init) {
    if (parsed.init.mcp_servers.length) problems.push(`MCP servers loaded: ${parsed.init.mcp_servers.join(", ")}`);
    const foreign = parsed.init.plugins.filter((p) => !String(p).endsWith("@builtin"));
    if (foreign.length) problems.push(`plugins loaded: ${foreign.join(", ")}`);
  }
  if (setup.upgrade && !setup.upgrade.ok) problems.push(`brain upgrade failed before the session: ${setup.upgrade.code}`);

  const { citations, line } = extractCitations(parsed.reply, { index, tasks, caller: testCase.caller.repo });
  const outcome = collectOutcome(runDir, w, testCase, { before: pristineProposals, applyReports: applyReportsOf(parsed.calls) });
  const retrieval = retrievalOf(parsed.calls, tokenizer);
  const opening = Boolean(testCase.handover || testCase.caller.task);
  const phase = opening ? "opening" : "later";
  const error = ran.timedOut ? `timed out after ${Math.round(timeoutMs / 1000)} s` : !parsed.reply ? `no reply (${parsed.error ?? `exit ${ran.exit}`})` : null;
  const result = error ? { error } : {
    result: {
      answer: { text: parsed.reply, citations }, output: receivedOf(parsed.calls), reads: readsOf(parsed.calls), ...(outcome ? { outcome } : {}),
      cost: { phase, tokens: retrieval[phase].tokens ?? undefined, bytes: retrieval[phase].bytes, ms: ran.ms },
    },
  };
  const session = {
    case: testCase.id, agent: parsed.agent, models: parsed.models, caller: testCase.caller, prompt, exit: ran.exit, signal: ran.signal, timed_out: ran.timedOut, ms: ran.ms,
    error: error ?? parsed.error, reply: parsed.reply, evidence_line: line, citations, setup,
    isolation: { problems, skills: parsed.init?.skills ?? null, plugins: parsed.init?.plugins ?? null, mcp_servers: parsed.init?.mcp_servers ?? null, permission_mode: parsed.init?.permission_mode ?? null },
    calls: calls.map((c) => ({ id: c.id, tool: c.tool, input: c.input, kind: c.kind, reason: c.reason, paths: c.paths.map((p) => ({ rel: p.rel, access: p.access })), ...(c.brain ? { brain: c.brain.map((b) => ({ sub: b.sub, category: b.category })) } : {}) })),
    violations, usage: parsed.usage, retrieval, outcome,
  };
  const scrubOpts = { runDir, extra: [login[agent]] };
  writeFileSync(join(dir, "trace.jsonl"), scrub(raw, scrubOpts));
  writeFileSync(errFile, scrub(readFileSync(errFile, "utf8"), scrubOpts));
  writeFileSync(join(dir, "reply.md"), scrub(parsed.reply ?? "", scrubOpts));
  writeFileSync(join(dir, "session.json"), scrub(JSON.stringify(session, null, 2), scrubOpts) + "\n");
  rmSync(rawTrace, { force: true });
  rmSync(replyFile, { force: true });
  if (!ctx.keepWorld) rmSync(w.home, { recursive: true, force: true });
  return { id: testCase.id, entry: JSON.parse(scrub(JSON.stringify(result), scrubOpts)), session };
}

async function pool(items, jobs, fn) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const runDir = resolve(a.out);
  if (existsSync(runDir) && readdirSync(runDir).length) throw new Error(`${runDir} is not empty: a run writes into a new folder`);
  mkdirSync(runDir, { recursive: true });
  const login = {};
  const bins = {};
  const agents = {};
  for (const agent of a.agents) {
    login[agent] = agent === "claude" ? checkLoginDir(a.claudeConfig, ".claude") : checkLoginDir(a.codexHome, ".codex");
    bins[agent] = which(agent);
    agents[agent] = { version: versionOf(bins[agent]), models: [] };
  }
  const started = new Date().toISOString();
  const checkout = checkoutIdentity();
  const pkg = installPackage(runDir, a.package);
  // The cases: the committed cases.json, or a subset of it; make-brain.mjs must still write it byte for byte.
  const committed = JSON.parse(readFileSync(join(EVAL, "cases.json"), "utf8"));
  const ids = a.cases ? a.cases.split(",") : null;
  const unknown = ids?.filter((id) => !committed.cases.some((c) => c.id === id)) ?? [];
  if (unknown.length) throw new Error(`unknown cases: ${unknown.join(", ")}`);
  const cases = ids ? committed.cases.filter((c) => ids.includes(c.id)) : committed.cases;
  writeFileSync(join(runDir, "cases.json"), JSON.stringify({ ...committed, cases }, null, 2) + "\n");
  const generated = join(runDir, "world", "cases.generated.json");
  const world = buildWorld(runDir, generated, pkg);
  const casesMatch = readFileSync(generated, "utf8") === readFileSync(join(EVAL, "cases.json"), "utf8");
  const pristine = worldAt(world.home);
  const count = (k) => cases.filter((c) => c.kind === k).length;
  const identity = {
    package: pkg.package, cli_version: pkg.cli_version, snapshot: pkg.snapshot,
    package_commit: a.commit ? { sha: a.commit, from: "--commit" } : { sha: checkout.commit, from: "the harness checkout's HEAD, as no --commit was given" },
    checkout, brain: { output_hash: world.outputHash, cases_match: casesMatch, linked: world.linked, lint_warnings: world.lintWarnings },
    agents, cases: { total: cases.length, trust: count("trust"), answerable: count("answerable"), unknown: count("unknown"), subset: Boolean(ids), ids: ids ?? [] },
    prompt: { task: PROMPT_TASK, suffix: PROMPT_SUFFIX }, timeout_s: a.timeout, started, finished: null,
  };
  const runJson = { agents: a.agents, world_root: "world/home/memory-0.12-eval", identity };
  writeFileSync(join(runDir, "run.json"), JSON.stringify(runJson, null, 2) + "\n");
  const ctx = {
    runDir, login, bins, timeoutMs: a.timeout * 1000, keepWorld: a.keepWorld, index: indexBrain(pristine.brain), tasks: tasksOf(pristine.repos),
    pristineProposals: new Set(Object.keys(proposalsOf(pristine.brain))), tokenizer: await loadTokenizer(),
  };
  for (const agent of a.agents) {
    const done = await pool(cases, a.jobs, async (c, i) => {
      const r = await runCase(ctx, agent, c);
      console.error(`${agent} ${i + 1}/${cases.length} ${c.id}: ${r.session.error ?? "replied"} in ${Math.round(r.session.ms / 1000)} s, ${r.session.violations.length} brain-file reads`);
      return r;
    });
    agents[agent].models = [...new Set(done.flatMap((r) => r.session.models))];
    writeFileSync(join(runDir, agent, "answers.json"), JSON.stringify({ agent, cases: Object.fromEntries(done.map((r) => [r.id, r.entry])) }, null, 2) + "\n");
  }
  identity.finished = new Date().toISOString();
  writeFileSync(join(runDir, "run.json"), scrub(JSON.stringify(runJson, null, 2), { runDir, extra: Object.values(login) }) + "\n");
  writeResults(runDir);
  console.log(readFileSync(join(runDir, "results.md"), "utf8"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => { console.error(error.stack ?? String(error)); process.exit(1); });
}
