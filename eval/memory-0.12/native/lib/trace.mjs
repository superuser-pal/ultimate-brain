// Reads a native session's trace into one shape for both agents (CC-200):
//   { agent, session, model, models, init, calls: [{ id, tool, input, output, error }], reply, usage, error }
// Claude Code: `claude -p --output-format stream-json --verbose` (one JSON object per line: system/init, assistant
// messages with tool_use blocks, user messages with tool_result blocks, a final result with usage and cost).
// Codex: `codex exec --json` (thread.started, item.completed items — command_execution, agent_message, file_change,
// mcp_tool_call, web_search… — turn.completed with usage, turn.failed / error).
// usage is the agent's own accounting, normalised (0074 §6):
//   { input, cached_input, cache_write, output, reasoning, total, cost_usd?, turns?, duration_ms?, raw }
//   input  every input token the model read, cached or not; cached_input the part served from cache
//   output every output token, reasoning included; reasoning the part the agent reports as thinking or reasoning

export function parseLines(text) {
  return text.split("\n").filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

const textOf = (content) => (typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => (c.type === "text" ? c.text : c.type === "image" ? "[image]" : JSON.stringify(c))).join("\n") : content == null ? "" : JSON.stringify(content));

/** Claude Code's stream-json. */
export function parseClaude(text) {
  const events = parseLines(text);
  const init = events.find((e) => e.type === "system" && e.subtype === "init") ?? null;
  const result = events.filter((e) => e.type === "result").pop() ?? null;
  const calls = [];
  const byId = new Map();
  let lastText = "";
  for (const e of events) {
    if (e.type === "assistant") {
      for (const c of e.message?.content ?? []) {
        if (c.type === "tool_use") {
          const call = { id: c.id, tool: c.name, input: c.input ?? {}, output: null, error: false, parent: e.parent_tool_use_id ?? null };
          calls.push(call);
          byId.set(c.id, call);
        } else if (c.type === "text" && !e.parent_tool_use_id) lastText = c.text;
      }
    } else if (e.type === "user") {
      const content = e.message?.content;
      for (const c of Array.isArray(content) ? content : []) {
        if (c.type !== "tool_result") continue;
        const call = byId.get(c.tool_use_id);
        if (call) { call.output = textOf(c.content); call.error = c.is_error === true; }
      }
    }
  }
  const u = result?.usage ?? {};
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  const input = (u.input_tokens ?? 0) + read + write;
  const output = u.output_tokens ?? 0;
  const usage = result ? {
    input, cached_input: read, cache_write: write, output, reasoning: u.output_tokens_details?.thinking_tokens ?? null, total: input + output,
    cost_usd: result.total_cost_usd ?? null, turns: result.num_turns ?? null, duration_ms: result.duration_ms ?? null,
    raw: { usage: u, modelUsage: result.modelUsage ?? {} },
  } : null;
  const models = Object.keys(result?.modelUsage ?? {});
  return {
    agent: "claude-code",
    session: init?.session_id ?? result?.session_id ?? null,
    model: models[0] ?? init?.model ?? null,
    models: models.length ? models : init?.model ? [init.model] : [],
    init: init ? { model: init.model, version: init.claude_code_version, permission_mode: init.permissionMode, skills: init.skills ?? [], plugins: (init.plugins ?? []).map((p) => p.source ?? p.name), mcp_servers: (init.mcp_servers ?? []).map((m) => m.name ?? m), tools: init.tools ?? [] } : null,
    calls,
    reply: typeof result?.result === "string" ? result.result : lastText,
    usage,
    error: !result ? "no result event" : result.is_error ? `${result.subtype ?? "error"}${result.terminal_reason ? ` (${result.terminal_reason})` : ""}` : null,
  };
}

/** Codex's `exec --json`. `model` comes from the session's rollout file when the caller passes it (`turn_context`). */
export function parseCodex(text, { model = null } = {}) {
  const events = parseLines(text);
  const calls = [];
  let reply = "";
  let error = null;
  const sum = { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 };
  let turns = 0;
  for (const e of events) {
    const it = e.item;
    if (e.type === "item.completed" && it) {
      if (it.type === "agent_message") reply = it.text ?? reply;
      else if (it.type === "command_execution") calls.push({ id: it.id, tool: "shell", input: { command: it.command }, output: it.aggregated_output ?? "", error: it.exit_code !== 0, exit_code: it.exit_code ?? null });
      else if (it.type === "reasoning" || it.type === "todo_list") continue;
      else if (it.type === "file_change") calls.push({ id: it.id, tool: "file_change", input: { changes: it.changes ?? [] }, output: it.status ?? "", error: it.status === "failed" });
      else calls.push({ id: it.id, tool: it.type, input: it, output: textOf(it.result ?? it.output ?? ""), error: it.status === "failed" });
    } else if (e.type === "turn.completed") {
      turns++;
      for (const k of Object.keys(sum)) sum[k] += e.usage?.[k] ?? 0;
    } else if (e.type === "turn.failed") error = `turn failed: ${e.error?.message ?? "?"}`;
    else if (e.type === "error") error = `error: ${e.message ?? "?"}`;
  }
  const thread = events.find((e) => e.type === "thread.started")?.thread_id ?? null;
  // OpenAI usage: input_tokens includes the cached part, output_tokens includes reasoning.
  const usage = turns ? {
    input: sum.input_tokens, cached_input: sum.cached_input_tokens, cache_write: sum.cache_write_input_tokens, output: sum.output_tokens,
    reasoning: sum.reasoning_output_tokens, total: sum.input_tokens + sum.output_tokens, cost_usd: null, turns, duration_ms: null, raw: { usage: sum },
  } : null;
  return { agent: "codex", session: thread, model, models: model ? [model] : [], init: null, calls, reply, usage, error: error ?? (turns ? null : "no completed turn") };
}

/** The model a Codex rollout file records (`turn_context.payload.model`); nothing else of the file is kept. */
export function codexRolloutModel(text) {
  for (const e of parseLines(text)) if (e.type === "turn_context" && e.payload?.model) return e.payload.model;
  return null;
}
