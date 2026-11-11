// How each agent is started for one case (CC-200): a fresh non-interactive session in the caller repo, on the agent's
// default model, with the sandbox's HOME and PATH, no MCP server, no network, writes confined to the session's folder,
// and a timeout. The login comes from a dedicated folder (CLAUDE_CONFIG_DIR, CODEX_HOME) the caller names: never the
// user's ~/.claude or ~/.codex, whose global skills, settings and plugins would leak in.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { sandboxEnv } from "./world.mjs";

/** The absolute path of an agent's binary on the harness's own PATH. */
export function which(name) {
  const r = spawnSync("/usr/bin/which", [name], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${name} is not on PATH`);
  return r.stdout.trim();
}

export function versionOf(bin) {
  return spawnSync(bin, ["--version"], { encoding: "utf8" }).stdout.trim();
}

/** Refuses the user's own agent home: a run must not load global skills, settings or plugins. */
export function checkLoginDir(dir, ownDefault) {
  if (!dir) throw new Error("a dedicated login folder is required (see native/README.md, \"Logins\")");
  const abs = resolve(dir);
  if (abs === resolve(homedir(), ownDefault)) throw new Error(`${abs} is your own agent home; make a dedicated login folder (native/README.md, "Logins")`);
  if (!existsSync(abs)) throw new Error(`${abs} does not exist`);
  return abs;
}

/**
 * Claude Code: `claude -p --output-format stream-json --verbose`, the prompt on stdin. Only project and local settings
 * load (the linked repo has none), MCP is empty, the session is not persisted, and tools are Read, Glob, Grep, Skill
 * and Bash, Bash inside Claude Code's OS sandbox with writes only under the session's folder and no network. Edits,
 * sub-agents and the web are off. Permission mode dontAsk: what isn't allowed is refused, never asked.
 */
export function claudeCommand({ bin, sessionRoot }) {
  const settings = { sandbox: { enabled: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false, filesystem: { allowWrite: [sessionRoot] } } };
  return {
    bin,
    args: [
      "-p", "--output-format", "stream-json", "--verbose", "--no-session-persistence",
      "--setting-sources", "project,local", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--permission-mode", "dontAsk", "--settings", JSON.stringify(settings),
      "--allowedTools", "Read", "Glob", "Grep", "Skill", "Bash",
      "--disallowedTools", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Agent", "Task",
    ],
  };
}

/**
 * Codex: `codex exec --json`, the prompt on stdin, in the caller repo (-C). The login folder's config.toml is not
 * loaded (--ignore-user-config), commands run in the workspace-write sandbox with the session's folder as the only
 * writable root and no network, never a login shell (a login shell's profile would put a global `brain` first on
 * PATH), and approvals are never asked.
 */
export function codexCommand({ bin, sessionRoot, cwd, replyFile }) {
  return {
    bin,
    args: [
      "exec", "--json", "--skip-git-repo-check", "--ignore-user-config", "-s", "workspace-write", "-C", cwd,
      "-c", 'approval_policy="never"', "-c", `sandbox_workspace_write.writable_roots=[${JSON.stringify(sessionRoot)}]`,
      "-c", "sandbox_workspace_write.network_access=false", "-c", 'shell_environment_policy.inherit="all"', "-c", "allow_login_shell=false",
      "-o", replyFile, "-",
    ],
  };
}

/**
 * Runs one session: stdout to `traceFile`, stderr to `errFile`, the prompt on stdin; kills the whole process group at
 * the timeout. Resolves { exit, signal, timedOut, ms }.
 */
export function runSession({ command, cwd, env, prompt, traceFile, errFile, timeoutMs }) {
  return new Promise((resolvePromise) => {
    const out = openSync(traceFile, "w");
    const err = openSync(errFile, "w");
    const started = Date.now();
    const child = spawn(command.bin, command.args, { cwd, env, stdio: ["pipe", out, err], detached: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } }, timeoutMs);
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
    child.on("close", (exit, signal) => {
      clearTimeout(timer);
      closeSync(out);
      closeSync(err);
      resolvePromise({ exit, signal, timedOut, ms: Date.now() - started });
    });
  });
}

/** The environment of one session: the sandbox's, plus the agent's login folder. */
export function sessionEnv(agent, runDir, home, login) {
  return sandboxEnv(runDir, home, agent === "claude" ? { CLAUDE_CONFIG_DIR: login } : { CODEX_HOME: login });
}

/** The newest Codex rollout file for a thread id (CODEX_HOME/sessions/…/rollout-…-<thread>.jsonl), or null. */
export function codexRollout(codexHome, thread) {
  if (!thread) return null;
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 4 || !existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, depth + 1);
      else if (name.includes(thread) && name.endsWith(".jsonl")) found.push(p);
    }
  };
  walk(join(codexHome, "sessions"), 0);
  return found.length ? readFileSync(found.sort().pop(), "utf8") : null;
}
