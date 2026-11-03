import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { command, fail, ROOT, slug, taskEntries, tryCommand } from "./common.mjs";

// `start <id> --from <branch>` stacks the task on another task's branch (decision 0046); its row may exist only there.
// `start <id> --new "<title>" --release <x.y.z>` starts a task that has no row yet and writes its row into the worktree.
// `clean` removes every task worktree, and its branch, that is merged into origin/main; it keeps a worktree with uncommitted changes.
const usage = "Usage: node scripts/task.mjs start <CC-N|CX-N> [--from <branch>] [--new <title> --release <x.y.z>] | done <CC-N|CX-N> | clean";
const [action, ...args] = process.argv.slice(2);
const id = action === "clean" ? undefined : args.shift();
const flags = parseFlags(args);
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if (flags === undefined || !/^(start|done|clean)$/.test(action ?? "")
  || (action !== "clean" && !/^(CC|CX)-\d+$/.test(id ?? ""))
  || (action !== "start" && Object.keys(flags).length > 0)
  || ((flags["--new"] === undefined) !== (flags["--release"] === undefined))
  || (flags["--new"] !== undefined && (flags["--new"].trim() === "" || /[·`\n\r]/.test(flags["--new"]) || !semver.test(flags["--release"])))) {
  fail(usage);
} else if (action === "clean") {
  tryCommand("git", ["fetch", "-q", "origin"]);
  const removed = [];
  for (const { worktree, branch } of mergedTaskWorktrees()) {
    if (command("git", ["status", "--porcelain"], { cwd: worktree }) !== "") process.stderr.write(`Kept ${branch}: uncommitted changes in ${worktree}\n`);
    else {
      const result = removeMerged(worktree, branch);
      if (result.ok) removed.push(branch);
      else { process.stderr.write(`Kept ${branch}: ${result.message}\n`); process.exitCode = 1; }
    }
  }
  process.stdout.write(removed.length === 0 ? "No merged task worktrees\n" : `Removed ${removed.join(", ")}\n`);
} else {
  const from = flags["--from"];
  const title = flags["--new"]?.trim();
  const base = from === undefined ? "origin/main" : `origin/${from}`;
  const shown = from === undefined && title === undefined ? { ok: true, stdout: undefined } : tryCommand("git", ["show", `${base}:build/TASKS.md`]);
  // A new id must also be unused among the done rows in build/HISTORY.md (CC-94).
  const shownHistory = title === undefined ? undefined : tryCommand("git", ["show", `${base}:build/HISTORY.md`]);
  const history = shownHistory === undefined || shownHistory.ok || !/exists on disk, but not in|does not exist in/.test(shownHistory.message) ? shownHistory : { ok: true, stdout: "" };
  const rows = !shown.ok || history === undefined ? shown : history.ok ? { ok: true, stdout: `${shown.stdout}\n${history.stdout}` } : history;
  const existing = rows.ok ? taskEntries(rows.stdout).find((entry) => entry.id === id) : undefined;
  const task = title === undefined ? existing : { id, title };
  if (!rows.ok) fail(`Cannot read build/TASKS.md on ${base}: ${rows.message}`);
  else if (title !== undefined && existing !== undefined) fail(`${id} already exists on ${base}`);
  else if (title !== undefined && openBranches(id).length > 0) fail(`${id} is already used by ${openBranches(id).join(", ")}`);
  else if (title !== undefined && new RegExp(`^## ${flags["--release"].replace(/[.]/g, "\\.")}(?: |$)`, "m").test(history.stdout)) fail(`${flags["--release"]} is a done release in build/HISTORY.md`);
  else if (task === undefined) fail(`Unknown task ${id}`);
  else if (action === "start" && title === undefined && task.status !== "todo") fail(`${id} is ${task.status}, not todo`);
  else if (action === "start") {
    const branch = `${id.startsWith("CC-") ? "claude" : "codex"}/${id}-${slug(task.title)}`;
    const path = resolve(ROOT, "..", `ub-${id}`);
    if (existsSync(path)) fail(`${path} already exists`);
    else {
      command("git", ["worktree", "add", "--no-track", "-b", branch, path, base]);
      command("npm", ["ci"], { cwd: path, stdio: "inherit" });
      command("git", ["config", "core.hooksPath", ".githooks"], { cwd: path });
      const tasksPath = resolve(path, "build/TASKS.md");
      const current = readFileSync(tasksPath, "utf8");
      const tasks = title === undefined
        ? current.replace(`### ${id} · ${task.title} · \`todo\``, `### ${id} · ${task.title} · \`in progress\``)
        : insertRow(current, id, title, flags["--release"]);
      writeFileSync(tasksPath, tasks);
      const denylist = resolve(homedir(), ".config/ultimate-brain/denylist");
      if (!existsSync(denylist)) process.stderr.write(`Warning: denylist missing at ${denylist}\n`);
      if (title !== undefined) process.stderr.write(`Fill in the **Changelog:**, **Output:** and **Acceptance:** lines of ${id}\n`);
      process.stdout.write(`${path}\n`);
    }
  } else {
    const branch = `${id.startsWith("CC-") ? "claude" : "codex"}/${id}-${slug(task.title)}`;
    const target = taskWorktrees().find((block) => block.branch === branch);
    if (target === undefined) fail(`No worktree for ${id}`);
    else {
      const merged = tryCommand("git", ["merge-base", "--is-ancestor", branch, "origin/main"]);
      if (!merged.ok) fail(`${branch} is not merged into origin/main`);
      else {
        const result = removeMerged(target.worktree, branch);
        if (!result.ok) fail(`Cannot remove ${branch}: ${result.message}`);
      }
    }
  }
}

/** `--name value` pairs; undefined when a flag is unknown, repeated or has no value. */
function parseFlags(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 2) {
    const [name, value] = [list[index], list[index + 1]];
    if (!["--from", "--new", "--release"].includes(name) || value === undefined || name in result) return undefined;
    result[name] = value;
  }
  return result;
}

/** Worktrees on a task branch, as `{ worktree, branch }` with the branch name without `refs/heads/`. */
function taskWorktrees() {
  const blocks = command("git", ["worktree", "list", "--porcelain"]).split("\n\n");
  return blocks.map((block) => Object.fromEntries(block.split("\n").map((line) => line.split(" ", 2))))
    .filter((block) => /^refs\/heads\/(claude|codex)\/(CC|CX)-\d+-/.test(block.branch ?? ""))
    .map((block) => ({ worktree: block.worktree, branch: block.branch.slice("refs/heads/".length) }));
}

/** Merged: reachable from origin/main but not on its first-parent line, which is where a started branch with no commits of its own sits (PRs merge with a merge commit). */
function mergedTaskWorktrees() {
  const mainLine = new Set(command("git", ["rev-list", "--first-parent", "origin/main"]).split("\n"));
  return taskWorktrees().filter(({ branch }) => tryCommand("git", ["merge-base", "--is-ancestor", branch, "origin/main"]).ok
    && !mainLine.has(command("git", ["rev-parse", branch])));
}

/**
 * The new row goes at the end of its `## <release>` section. A missing section is created before the first release section with a later
 * version, or after the last release section.
 */
function insertRow(tasks, taskId, title, release) {
  const row = `### ${taskId} · ${title} · \`in progress\`\n**Release:** ${release}\n**Changelog:**\n**Output:**\n**Acceptance:**\n\n`;
  const headings = [...tasks.matchAll(/^## (.*)$/gm)].map((match) => ({ offset: match.index, version: /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?: |$)/.exec(match[1])?.[1] }));
  const own = headings.findIndex((heading) => heading.version === release);
  if (own !== -1) {
    const end = headings[own + 1]?.offset ?? tasks.length;
    return `${tasks.slice(0, end).replace(/\n*$/, "\n\n")}${row}${tasks.slice(end)}`;
  }
  const later = headings.find((heading) => heading.version !== undefined && compareVersions(heading.version, release) > 0);
  const lastRelease = headings.findLastIndex((heading) => heading.version !== undefined);
  const at = later?.offset ?? headings[lastRelease + 1]?.offset ?? tasks.length;
  const before = tasks.slice(0, at);
  return `${before === "" ? "" : before.replace(/\n*$/, "\n\n")}## ${release}\n\n${row}${tasks.slice(at)}`;
}

/** Semver order of x.y.z[-pre]: a prerelease comes before its release (0.9.0-rc.1 < 0.9.0); two prereleases compare as text. */
function compareVersions(left, right) {
  const [leftCore, leftPre] = left.split(/-(.*)/s);
  const [rightCore, rightPre] = right.split(/-(.*)/s);
  const [a, b] = [leftCore.split(".").map(Number), rightCore.split(".").map(Number)];
  const core = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  if (core !== 0 || leftPre === rightPre) return core;
  if (leftPre === undefined) return 1;
  if (rightPre === undefined) return -1;
  return leftPre < rightPre ? -1 : 1;
}

/**
 * Removes a merged task's worktree, then its branch. Ancestry of origin/main is already proven, so the branch goes with -D: -d checks the local
 * main, which lags origin/main until the user pulls. Gitignored files in the worktree (node_modules) go with it.
 */
function removeMerged(worktree, branch) {
  const removed = tryCommand("git", ["worktree", "remove", worktree]);
  return removed.ok ? tryCommand("git", ["branch", "-D", branch]) : removed;
}

/** Remote task branches, so open PRs, that already use `taskId`. */
function openBranches(taskId) {
  tryCommand("git", ["fetch", "-q", "origin"]);
  const listed = tryCommand("git", ["branch", "-r", "--list", `origin/claude/${taskId}-*`, `origin/codex/${taskId}-*`, "--format=%(refname:short)"]);
  return listed.ok ? listed.stdout.split("\n").filter(Boolean) : [];
}
