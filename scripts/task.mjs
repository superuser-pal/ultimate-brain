import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { command, fail, ROOT, slug, taskEntries, tryCommand } from "./common.mjs";

const [action, id] = process.argv.slice(2);
if (!/^(start|done)$/.test(action) || !/^(CC|CX)-\d+$/.test(id ?? "")) {
  fail("Usage: node scripts/task.mjs <start|done> <CC-N|CX-N>");
} else {
  const task = taskEntries().find((entry) => entry.id === id);
  if (task === undefined) fail(`Unknown task ${id}`);
  else if (action === "start" && task.status !== "todo") fail(`${id} is ${task.status}, not todo`);
  else if (action === "start") {
    const branch = `${id.startsWith("CC-") ? "claude" : "codex"}/${id}-${slug(task.title)}`;
    const path = resolve(ROOT, "..", `ub-${id}`);
    if (existsSync(path)) fail(`${path} already exists`);
    else {
      command("git", ["worktree", "add", "-b", branch, path, "origin/main"]);
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
