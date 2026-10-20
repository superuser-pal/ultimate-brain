import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tests provide UB_ROOT to exercise the scripts against an isolated repository.
export const ROOT = process.env.UB_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function command(command, args, options = {}) {
  return String(execFileSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }) ?? "").trim();
}

export function tryCommand(commandName, args, options = {}) {
  try { return { ok: true, stdout: command(commandName, args, options) }; }
  catch (error) { return { ok: false, message: String(error.stderr ?? error.message).trim() }; }
}

export function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

export function taskEntries(tasks = readFileSync(resolve(ROOT, "build/TASKS.md"), "utf8")) {
  const entries = [];
  const pattern = /^### ((?:CC|CX)-\d+) · (.+?) · `([^`]+)`([^\n]*)\n\*\*Release:\*\* ([^\n]+)(?:\n\*\*Changelog:\*\*(.*))?$/gm;
  for (const match of tasks.matchAll(pattern)) {
    entries.push({
      id: match[1],
      title: match[2],
      status: match[3],
      suffix: match[4],
      release: match[5],
      changelog: match[6],
      offset: match.index,
    });
  }
  return entries;
}

export function slug(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function isPrerelease(version) { return version.includes("-"); }

export function donePrNumbers(suffix) {
  const match = /^ \(#(\d+(?:, #\d+)*)(?:; .+)?\)$/.exec(suffix);
  return match?.[1].split(", #").map(Number);
}

/** CI passed when every check run completed as success, skipped or neutral, and at least one succeeded (a job that doesn't apply to the event is skipped). */
export function checksPassed(tsv) {
  const runs = tsv.split("\n").filter(Boolean).map((line) => line.split("\t"));
  return runs.some(([, conclusion]) => conclusion === "success")
    && runs.every(([status, conclusion]) => status === "completed" && ["success", "skipped", "neutral"].includes(conclusion));
}

export function packageVersion() {
  const file = resolve(ROOT, "package.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).version : undefined;
}

/** The note `merge.mjs --reviewed-by-user` writes into the merge commit body; main-guard accepts it in place of a pass. */
export const REVIEW_OVERRIDE_NOTE = "Review gate overridden by user.";

/** A file's text at a commit, read through the GitHub contents API. */
export function contentAt(repo, path, ref) {
  const result = tryCommand("gh", ["api", `repos/${repo}/contents/${path}?ref=${ref}`, "--jq", ".content"]);
  return result.ok ? { ok: true, stdout: Buffer.from(result.stdout.replace(/\s/g, ""), "base64").toString("utf8") } : result;
}

/** True when the other agent posted `Review (<agent>): pass at <sha>` naming `head` (decision 0038). `author` is the branch prefix. */
export function hasOtherAgentPass(repo, pr, head, author) {
  const endpoint = [`repos/${repo}/pulls/${pr}/reviews`, `repos/${repo}/issues/${pr}/comments`];
  const required = author === "codex" ? "Claude Code" : "Codex";
  const verdict = new RegExp(`^Review \\(${required}\\): pass at ([0-9a-f]{7,})\\b`, "i");
  return endpoint.some((path) => {
    const result = tryCommand("gh", ["api", path, "--paginate", "--slurp"]);
    if (!result.ok) return false;
    try {
      return JSON.parse(result.stdout).flat().some((item) => {
        const match = verdict.exec(item.body ?? "");
        return match !== null && head.toLowerCase().startsWith(match[1].toLowerCase());
      });
    } catch {
      return false;
    }
  });
}

/** Block this process for `ms` milliseconds. */
export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
