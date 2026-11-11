import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

// eval/memory-0.12/native (CC-200): the parts of the native-run harness that need no agent — the no-file-read
// classifier, both agents' trace parsing and token accounting, citations, retrieval costs, and the identity header.
const NATIVE = resolve(import.meta.dirname, "..", "eval", "memory-0.12", "native");
const { classifyCall, splitShell, unwrapShell } = await import(join(NATIVE, "lib", "classify.mjs"));
const { parseClaude, parseCodex, codexRolloutModel } = await import(join(NATIVE, "lib", "trace.mjs"));
const { applyReportsOf, extractCitations, readsOf, retrievalOf } = await import(join(NATIVE, "lib", "answer.mjs"));
const { scrub, splitManaged } = await import(join(NATIVE, "lib", "world.mjs"));
const { identityRows, agentFigures } = await import(join(NATIVE, "results.mjs"));
const { promptOf, PROMPT_SUFFIX } = await import(join(NATIVE, "run.mjs"));

const BRAIN = "/s/home/memory-0.12-eval/brain";
const REPO = "/s/home/memory-0.12-eval/repos/harbor-api";
const ctx = { brain: BRAIN, brainAliases: [BRAIN, `/private${BRAIN}`], cwd: REPO, home: "/s/home", env: { BRAIN_DIR: BRAIN } };
const kind = (tool, input, extra = {}) => classifyCall({ tool, input }, { ...ctx, ...extra }).kind;

test("the classifier flags Claude Code's Read, Grep and Glob of a brain path, and not of the caller repo", () => {
  assert.equal(kind("Read", { file_path: `${BRAIN}/knowledge/decisions/a.md` }), "brain-read");
  assert.equal(kind("Read", { file_path: `/private${BRAIN}/memories/2026/09/m.md` }), "brain-read", "the real path of a symlinked tmp");
  assert.equal(kind("Grep", { pattern: "migrat", path: BRAIN }), "brain-read", "a search of the whole brain");
  assert.equal(kind("Glob", { pattern: `${BRAIN}/**/*.md` }), "brain-read", "a listing by absolute pattern");
  assert.equal(kind("Glob", { pattern: "**/*.md", path: `${BRAIN}/knowledge` }), "brain-read", "a listing by path");
  assert.equal(kind("Glob", { pattern: "../../brain/**" }), "brain-read", "a relative pattern that climbs into the brain");
  assert.equal(kind("Read", { file_path: "build/TASKS.md" }), "other", "the caller repo's own task list");
  assert.equal(kind("Grep", { pattern: "migrat" }), "other", "a search of the caller repo");
  assert.equal(kind("Read", { file_path: `${REPO}/.claude/skills/brain-query/SKILL.md` }), "other", "the repo's linked skill");
});

test("the classifier keeps product files and intake apart from note reads (spec/eligibility.md §10)", () => {
  assert.equal(kind("Read", { file_path: `${BRAIN}/.claude/skills/brain-query/SKILL.md` }), "product-read");
  assert.equal(kind("Read", { file_path: `${BRAIN}/AGENTS.md` }), "product-read");
  assert.equal(kind("Read", { file_path: `${BRAIN}/brain.json` }), "product-read");
  assert.equal(kind("Read", { file_path: `${BRAIN}/inbox/new-call.md` }, { intake: [`${BRAIN}/inbox/new-call.md`] }), "intake", "a new input being taken in");
  assert.equal(kind("Read", { file_path: `${BRAIN}/inbox/other.md` }, { intake: [`${BRAIN}/inbox/new-call.md`] }), "brain-read", "only the named input is intake");
});

test("the classifier flags shell reads, searches and listings of the brain however the path is spelled", () => {
  for (const command of [
    `cat ${BRAIN}/knowledge/decisions/a.md`,
    "cat $BRAIN_DIR/memories/x.md",
    'rg -n migrat "${BRAIN_DIR}" | head',
    "ls ../../brain",
    "cd ~/memory-0.12-eval/brain && grep -rn migrat .",
    "cd ../../brain; git log --oneline",
    `git -C ${BRAIN} grep penalty`,
    "cat < ~/memory-0.12-eval/brain/index.md",
    'x=$(find ~/memory-0.12-eval/brain -name "*.md"); echo $x',
    `while read f; do echo "$f"; done < ${BRAIN}/index.md`,
    `if true; then head -5 ${BRAIN}/knowledge/a.md; fi`,
    `env LC_ALL=C sed -n 1,80p ${BRAIN}/knowledge/a.md`,
  ]) assert.equal(kind("Bash", { command }), "brain-read", command);
  assert.equal(kind("shell", { command: `/bin/zsh -lc 'sed -n 1,80p ${BRAIN}/knowledge/a.md'` }), "brain-read", "Codex's wrapped command");
});

test("the classifier records brain CLI calls by category and does not flag them", () => {
  const brain = (command) => classifyCall({ tool: "Bash", input: { command } }, ctx);
  const read = brain('brain query --candidates "x" --json; brain query --read dec-1 --json');
  assert.equal(read.kind, "brain-cli");
  assert.deepEqual(read.brain.map((b) => [b.sub, b.category]), [["query --candidates", "answer"], ["query --read", "answer"]]);
  assert.equal(brain("for id in a b; do brain query --read $id --json; done").kind, "brain-cli", "inside a loop");
  assert.deepEqual(brain("brain status --json 2>&1 | head -c 300").brain.map((b) => b.category), ["administrative"]);
  assert.deepEqual(brain("brain proposal list --json").brain.map((b) => b.category), ["administrative"]);
  assert.deepEqual(brain("brain apply prp-1 --json").brain.map((b) => b.category), ["write"]);
  assert.deepEqual(brain("brain recall --pack --json").brain.map((b) => b.sub), ["recall --pack"]);
  assert.equal(brain("echo $BRAIN_DIR").kind, "other", "naming the brain's path is not reading it");
  assert.equal(brain("cat .agents/skills/brain-query/SKILL.md").kind, "other");
  const mixed = brain(`brain query --read dec-1 --json; cat ${BRAIN}/knowledge/a.md`);
  assert.equal(mixed.kind, "brain-read", "a raw read beside a CLI call still fails the session");
  assert.equal(mixed.brain.length, 1);
});

test("splitShell and unwrapShell parse quoting, operators and Codex's wrapper", () => {
  assert.deepEqual(splitShell(`a 'b c' "d $X" e\\ f && g | h; i`, { X: "x" }).map((c) => c.words), [["a", "b c", "d x", "e f"], ["g"], ["h"], ["i"]]);
  assert.deepEqual(splitShell("cat x 2>&1 > out.txt")[0], { words: ["cat", "x"], redirects: [{ op: ">", target: "out.txt" }] });
  assert.equal(unwrapShell(`/bin/zsh -lc 'brain query --read dec-1 --json'`), "brain query --read dec-1 --json");
  assert.equal(unwrapShell("/bin/bash -c \"ls -la\""), "ls -la");
  assert.equal(unwrapShell("ls -la"), "ls -la");
});

const line = (o) => JSON.stringify(o);

test("parseClaude reads stream-json: calls with their results, the reply, the model and normalised usage", () => {
  const trace = [
    line({ type: "system", subtype: "init", session_id: "s1", model: "claude-x", claude_code_version: "2.1.0", permissionMode: "dontAsk", skills: ["brain-query"], plugins: [{ name: "p", source: "p@builtin" }], mcp_servers: [], tools: ["Read"] }),
    line({ type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "brain query --read dec-1 --json" } }] } }),
    line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: '{"ok":true}' }] }] } }),
    line({ type: "assistant", message: { content: [{ type: "text", text: "Ask first.\nEvidence: dec-1" }] } }),
    line({ type: "result", subtype: "success", is_error: false, result: "Ask first.\nEvidence: dec-1", num_turns: 3, duration_ms: 4000, total_cost_usd: 0.5,
      usage: { input_tokens: 10, cache_creation_input_tokens: 200, cache_read_input_tokens: 3000, output_tokens: 50, output_tokens_details: { thinking_tokens: 7 } }, modelUsage: { "claude-y": {} } }),
    "not json",
  ].join("\n");
  const t = parseClaude(trace);
  assert.equal(t.session, "s1");
  assert.deepEqual(t.models, ["claude-y"], "the model that answered, from modelUsage");
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0].output, '{"ok":true}');
  assert.equal(t.reply, "Ask first.\nEvidence: dec-1");
  assert.deepEqual({ ...t.usage, raw: undefined }, { input: 3210, cached_input: 3000, cache_write: 200, output: 50, reasoning: 7, total: 3260, cost_usd: 0.5, turns: 3, duration_ms: 4000, raw: undefined });
  assert.deepEqual(t.init.plugins, ["p@builtin"]);
  assert.equal(t.error, null);
  assert.equal(parseClaude(trace.split("\n").slice(0, 3).join("\n")).error, "no result event");
});

test("parseCodex reads exec --json: commands with output, the last message, summed usage; the model comes from the rollout", () => {
  const trace = [
    line({ type: "thread.started", thread_id: "th-1" }),
    line({ type: "turn.started" }),
    line({ type: "item.completed", item: { id: "i0", type: "reasoning", text: "…" } }),
    line({ type: "item.completed", item: { id: "i1", type: "command_execution", command: "/bin/zsh -c 'brain recall --pack --json'", aggregated_output: '{"ok":true}', exit_code: 0, status: "completed" } }),
    line({ type: "item.completed", item: { id: "i2", type: "agent_message", text: "Done.\nEvidence: none" } }),
    line({ type: "turn.completed", usage: { input_tokens: 1000, cached_input_tokens: 600, output_tokens: 40, reasoning_output_tokens: 10 } }),
  ].join("\n");
  const rollout = [line({ type: "session_meta", payload: { id: "x" } }), line({ type: "turn_context", payload: { model: "gpt-z" } })].join("\n");
  const t = parseCodex(trace, { model: codexRolloutModel(rollout) });
  assert.equal(t.session, "th-1");
  assert.deepEqual(t.models, ["gpt-z"]);
  assert.deepEqual(t.calls.map((c) => [c.tool, c.input.command, c.output, c.error]), [["shell", "/bin/zsh -c 'brain recall --pack --json'", '{"ok":true}', false]]);
  assert.equal(t.reply, "Done.\nEvidence: none");
  assert.deepEqual({ ...t.usage, raw: undefined }, { input: 1000, cached_input: 600, cache_write: 0, output: 40, reasoning: 10, total: 1040, cost_usd: null, turns: 1, duration_ms: null, raw: undefined });
  assert.equal(parseCodex(trace.split("\n").slice(0, 2).join("\n")).error, "no completed turn");
});

test("extractCitations takes the last Evidence line: ids the brain has, note paths, and task rows", () => {
  const index = { ids: new Set(["mem-bawdbry3", "dec-n5q1edbw"]), pathToId: new Map([["knowledge/decisions/2026-11-02-x.md", "dec-n5q1edbw"]]) };
  const tasks = { "harbor-api": ["T-12"], quill: ["Q-3"] };
  const cite = (text) => extractCitations(text, { index, tasks, caller: "harbor-api" });
  assert.deepEqual(cite("Ask first (mem-bawdbry3).\n\n**Evidence:** mem-bawdbry3, `knowledge/decisions/2026-11-02-x.md`, T-12, prj-unknown1").citations,
    ["dec-n5q1edbw", "mem-bawdbry3", "repo:harbor-api/build/TASKS.md#T-12"]);
  assert.deepEqual(cite(`Evidence: /private/tmp/r/brain/knowledge/decisions/2026-11-02-x.md, repo:quill/build/TASKS.md#Q-3`).citations, ["repo:quill/build/TASKS.md#Q-3", "dec-n5q1edbw"]);
  assert.deepEqual(cite("It is withheld: mem-bawdbry3.\nEvidence: none"), { citations: [], line: "none" }, "an id in the text is not a citation");
  assert.deepEqual(cite("Ask first, see mem-bawdbry3."), { citations: [], line: null }, "no Evidence line: nothing cited");
});

test("reads, apply reports and retrieval costs come from the brain CLI's JSON outputs", () => {
  const calls = [
    { tool: "Bash", input: { command: "brain recall --pack --json" }, output: line({ ok: true, command: "recall", brain: BRAIN, data: { text: "a b c d", tokens: 4, budget: 800 } }) },
    { tool: "Bash", input: { command: "brain query --read mem-1,dec-1 --json" }, output: line({ ok: true, command: "query", data: { notes: [{ id: "mem-1", status: "withheld", reason: "not_eligible" }, { id: "dec-1", status: "ok", body: "x" }] } }) },
    { tool: "shell", input: { command: "/bin/zsh -c 'brain apply prp-1 --json'" }, output: line({ ok: true, command: "apply", data: { results: [{ proposal: "prp-1", result: "closed", reason: "SOURCE_EXCLUDED" }] } }) },
    { tool: "Bash", input: { command: "brain status --json" }, output: line({ ok: true, command: "status", data: {} }) },
    { tool: "Read", input: { file_path: "x" }, output: "ignored" },
  ];
  assert.deepEqual(readsOf(calls).map((r) => [r.id, r.status]), [["mem-1", "withheld"], ["dec-1", "ok"]]);
  assert.deepEqual(applyReportsOf(calls), { "prp-1": { result: "closed", reason: "SOURCE_EXCLUDED" } });
  const words = (t) => t.split(/\s+/).filter(Boolean).length;
  words.label = "words";
  const cost = retrievalOf(calls, words);
  assert.equal(cost.opening.calls, 1);
  assert.deepEqual(cost.opening.pack_tokens, [{ tokens: 4, estimate: 4, budget: 800 }]);
  assert.equal(cost.later.calls, 1, "query --read is later retrieval; apply is a write, not retrieval");
  assert.equal(cost.administrative.calls, 2);
  assert.equal(cost.tokenizer, "words");
  assert.equal(retrievalOf(calls, null).later.tokens, null, "without a tokenizer, tokens are not invented");
});

const IDENTITY = {
  package: { file: "ultimate-brain-0.13.0.tgz", sha256: "ab".repeat(32), version: "0.13.0" }, cli_version: "0.13.0",
  package_commit: { sha: "c".repeat(40), from: "--commit" }, checkout: { commit: "d".repeat(40), dirty: false },
  snapshot: { name: "ultimate-brain-skills", version: "1.6.0", integrity: "sha256-ef", source_commit: "e".repeat(40), tag: "brain-v1.6.0" },
  brain: { output_hash: "f".repeat(64), cases_match: true, linked: ["harbor-api", "quill"] },
  agents: { claude: { version: "2.1.0 (Claude Code)", models: ["claude-y"] }, codex: { version: "codex-cli 0.1", models: ["gpt-z"] } },
  cases: { total: 108, trust: 45, answerable: 52, unknown: 11, subset: false, ids: [] },
  prompt: { task: "I'm working on {task} in this repo.", suffix: PROMPT_SUFFIX }, timeout_s: 900, started: "2026-11-11T00:00:00Z", finished: "2026-11-11T01:00:00Z",
};

test("the identity header names the package hash, CLI version, commit, snapshot, brain and each agent's model", () => {
  const rows = Object.fromEntries(identityRows(IDENTITY));
  assert.match(rows.package, new RegExp(`ultimate-brain-0\\.13\\.0\\.tgz.*${"ab".repeat(32)}`));
  assert.match(rows.CLI, /0\.13\.0/);
  assert.match(rows["commit the package was built from"], new RegExp("c".repeat(40)));
  assert.match(rows["skills snapshot"], /ultimate-brain-skills 1\.6\.0, integrity `sha256-ef`, fork commit `e{40}`, tag `brain-v1\.6\.0`/);
  assert.match(rows.brain, new RegExp(`output hash \`${"f".repeat(64)}\`; cases.json as committed: yes`));
  assert.match(rows["agent: Claude Code"], /`claude-y`/);
  assert.match(rows["agent: Codex"], /`gpt-z`/);
  assert.match(rows.cases, /^108 \(45 critical trust, 52 answerable, 11 unknown\)$/);
});

test("a session that reads a brain file fails the agent's gates even when every answer passes", () => {
  const score = { gates: { trust: { pass: 1, total: 1, met: true }, answerable: { pass: 1, total: 1, met: true } }, unknown: { pass: 0, total: 0 }, rows: [] };
  const session = (violations) => ({ ms: 1000, violations, isolation: { problems: [] }, usage: { input: 10, cached_input: 5, output: 2, total: 12 }, retrieval: null });
  assert.equal(agentFigures(score, [session([]), session([])]).gates.met, true);
  const f = agentFigures(score, [session([]), session([{ tool: "Grep", reason: "Grep", paths: [{ rel: "" }] }])]);
  assert.equal(f.gates.reads.violating, 1);
  assert.equal(f.gates.met, false);
  assert.equal(f.tokens.total, 24);
});

test("the prompt is the question, the task the case names, and the one fixed Evidence instruction", () => {
  assert.equal(promptOf({ question: "Where did it stop?", caller: { repo: "harbor-api", task: "T-12" } }), `I'm working on T-12 in this repo. Where did it stop?\n\n${PROMPT_SUFFIX}\n`);
  assert.equal(promptOf({ question: "Q?", caller: { repo: "scratch" } }), `Q?\n\n${PROMPT_SUFFIX}\n`);
});

test("scrub replaces the run folder, the user's home and name, UUIDs and real e-mail addresses", () => {
  const out = scrub(`/tmp/run-x/world 0b1c2d3e-1111-2222-3333-444455556666 someone@realmail.net ops@example.invalid ${process.env.HOME}/x`, { runDir: "/tmp/run-x" });
  assert.equal(out, "<run>/world <uuid> <email> ops@example.invalid <home>/x");
});

test("splitManaged hashes a 0.12.0-linked repo's project-owned text as the case records it (CC-185)", (context) => {
  const dir = mkdtempSync(join(tmpdir(), "native-world-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const eval012 = resolve(NATIVE, "..");
  execFileSync(process.execPath, [join(eval012, "make-brain.mjs"), dir, "--cases", join(dir, "cases.json")]);
  const upgrade = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases.find((c) => c.upgrade).upgrade;
  const { block, owned } = splitManaged(readFileSync(join(dir, "repos", upgrade.repo, "AGENTS.md"), "utf8"));
  assert.ok(block.startsWith("<!-- ultimate-brain:start -->") && block.endsWith("<!-- ultimate-brain:end -->"));
  assert.equal(`sha256:${createHash("sha256").update(owned).digest("hex")}`, upgrade.project_text_sha256);
  assert.equal(splitManaged("a\n<!-- ultimate-brain:start -->\nx\n<!-- ultimate-brain:start -->\n<!-- ultimate-brain:end -->\n").block, null, "a repeated marker is damaged");
});
