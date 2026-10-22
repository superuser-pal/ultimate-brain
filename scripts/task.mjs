import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { command, fail, ROOT, slug, taskEntries, tryCommand } from "./common.mjs";

// `start <id> --from <branch>` stacks the task on another task's branch (decision 0046); its row may exist only there.
const [action, id, ...rest] = process.argv.slice(2);
const from = rest[0] === "--from" ? rest[1] : undefined;
if (!/^(start|done)$/.test(action) || !/^(CC|CX)-\d+$/.test(id ?? "") || (rest.length > 0 && (action !== "start" || rest.length !== 2 || !from))) {
  fail("Usage: node scripts/task.mjs <start|done> <CC-N|CX-N> [--from <branch>]");
} else {
  const base = from === undefined ? "origin/main" : `origin/${from}`;
  const rows = from === undefined ? { ok: true, stdout: undefined } : tryCommand("git", ["show", `${base}:build/TASKS.md`]);
  const task = rows.ok ? taskEntries(rows.stdout).find((entry) => entry.id === id) : undefined;
  if (!rows.ok) fail(`Cannot read build/TASKS.md on ${base}: ${rows.message}`);
  else if (task === undefined) fail(`Unknown task ${id}`);
  else if (action === "start" && task.status !== "todo") fail(`${id} is ${task.status}, not todo`);
  else if (action === "start") {
    const branch = `${id.startsWith("CC-") ? "claude" : "codex"}/${id}-${slug(task.title)}`;
    const path = resolve(ROOT, "..", `ub-${id}`);
    if (existsSync(path)) fail(`${path} already exists`);
    else {
      command("git", ["worktree", "add", "--no-track", "-b", branch, path, base]);
      command("npm", ["ci"], { cwd: path, stdio: "inherit" });
      command("git", ["config", "core.hooksPath", ".githooks"], { cwd: path });
      const tasksPath = resolve(path, "build/TASKS.md");
      const tasks = readFileSync(tasksPath, "utf8").replace(`### ${id} · ${task.title} · \`todo\``, `### ${id} · ${task.title} · \`in progress\``);
      writeFileSync(tasksPath, tasks);
      const denylist = resolve(homedir(), ".config/ultimate-brain/denylist");
      if (!existsSync(denylist)) process.stderr.write(`Warning: denylist missing at ${denylist}\n`);
      process.stdout.write(`${path}\n`);
    }
  } else {
    const list = command("git", ["worktree", "list", "--porcelain"]);
    const branch = `${id.startsWith("CC-") ? "claude" : "codex"}/${id}-${slug(task.title)}`;
    const blocks = list.split("\n\n").map((block) => Object.fromEntries(block.split("\n").map((line) => line.split(" ", 2))));
    const target = blocks.find((block) => block.branch === `refs/heads/${branch}`);
    if (target?.worktree === undefined) fail(`No worktree for ${id}`);
    else {
      const merged = tryCommand("git", ["merge-base", "--is-ancestor", branch, "origin/main"]);
      if (!merged.ok) fail(`${branch} is not merged into origin/main`);
      else {
        command("git", ["worktree", "remove", target.worktree]);
        command("git", ["branch", "-d", branch]);
      }
    }
  }
}
