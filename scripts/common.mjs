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

/**
 * True when the newest `push` run of the `CI` workflow on branch `main` finished green. `tsv` is one `name\tevent\tbranch\tstatus\tconclusion` line per
 * workflow run, newest first. Other workflows (`merge-ready` runs on comments and attaches to main's HEAD) and runs for a tag or another branch at the same
 * SHA do not count: `main-guard` runs only for `refs/heads/main`.
 */
export function ciWorkflowPassed(tsv) {
  const runs = tsv.split("\n").filter(Boolean).map((line) => line.split("\t"));
  const latest = runs.find(([name, event, branch]) => name === "CI" && event === "push" && branch === "main");
  return latest !== undefined && latest[3] === "completed" && latest[4] === "success";
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

/**
 * What must hold before a PR is merged, besides CI and mergeability, which GitHub shows itself (decision 0040):
 * the branch and title format, a base of `main`, every box ticked, the task `done` with this PR's number, and the other agent's pass naming the head.
 * `skipPass` drops the last one (`merge.mjs --reviewed-by-user`). Returns the problems, empty when ready.
 */
export function readinessProblems(repo, pr, details, { skipPass = false } = {}) {
  const problems = [];
  const branch = /^(claude|codex)\/((?:CC|CX)-\d+)-/.exec(details.headRefName ?? "");
  if (branch === null) problems.push("branch must be claude|codex/<CC|CX>-N-…");
  else if (!new RegExp(`^${branch[2]}:`).test(details.title ?? "")) problems.push("title must start with its task id and colon");
  if (/^- \[ \]/m.test(details.body ?? "")) problems.push("unticked checklist boxes");
  // A stacked PR merges only once the PR below it is merged and it is retargeted to main (decision 0046).
  if (details.baseRefName !== undefined && details.baseRefName !== "main") problems.push(`base is ${details.baseRefName}: merge the PR below first, then retarget this one to main`);
  if (branch !== null) {
    const rows = contentAt(repo, "build/TASKS.md", details.headRefOid);
    const task = rows.ok ? taskEntries(rows.stdout).find((entry) => entry.id === branch[2]) : undefined;
    if (!rows.ok) problems.push(`cannot read PR task row: ${rows.message}`);
    else if (task?.status !== "done" || !donePrNumbers(task.suffix)?.includes(Number(pr))) {
      problems.push(`${branch[2]} is ${task === undefined ? "missing" : `\`${task.status}\`${task.suffix}`}, not \`done\` (#${pr})`);
    }
    if (!skipPass && !hasOtherAgentPass(repo, pr, details.headRefOid, branch[1])) {
      problems.push(`no pass from the other agent (${branch[1] === "codex" ? "Claude Code" : "Codex"}) at ${String(details.headRefOid).slice(0, 7)}`);
    }
  }
  return problems;
}
