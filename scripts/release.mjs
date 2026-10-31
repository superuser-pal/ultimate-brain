import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ciWorkflowPassed, command, donePrNumbers, fail, isPrerelease, ROOT, taskEntries, tryCommand } from "./common.mjs";

const [version, flag] = process.argv.slice(2);
const dryRun = flag === "--dry-run";
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if (!semver.test(version ?? "") || (flag !== undefined && !dryRun)) fail("Usage: node scripts/release.mjs <version> [--dry-run]");
else {
  const failures = [];
  const worktrees = command("git", ["worktree", "list", "--porcelain"]).split("\n\n");
  const mainBlock = worktrees.find((block) => block.includes("branch refs/heads/main"));
  const mainPath = mainBlock?.match(/^worktree (.+)$/m)?.[1];
  if (mainPath === undefined || realpathSync(process.cwd()) !== realpathSync(mainPath)) failures.push("must run from the main worktree");
  if (tryCommand("git", ["branch", "--show-current"]).stdout !== "main") failures.push("must run on main");
  if (command("git", ["status", "--porcelain"]) !== "") failures.push("working tree is not clean");
  if (command("git", ["rev-parse", "HEAD"]) !== command("git", ["rev-parse", "origin/main"])) failures.push("HEAD is not level with origin/main");
  const rowChangelog = usesTaskRowChangelog(version);
  const tasks = taskEntries().filter((entry) => entry.release === version && entry.status !== "dropped");
  if (!rowChangelog) {
    const changelog = readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8");
    if (!new RegExp(`^## ${version}(?: — |$)`, "m").test(changelog)) failures.push(`CHANGELOG.md has no ${version} entry`);
  }
  for (const task of tasks) {
    if (task.status !== "done") failures.push(`${task.id} is ${task.status}, not done`);
    if (rowChangelog && task.changelog?.trim() === "") failures.push(`${task.id} has an empty **Changelog:** line`);
    if (rowChangelog && task.changelog === undefined) failures.push(`${task.id} has no **Changelog:** line`);
    if (rowChangelog && donePrNumbers(task.suffix) === undefined) failures.push(`${task.id} has an invalid done suffix`);
  }
  const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const runs = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/actions/runs?head_sha=${command("git", ["rev-parse", "HEAD"])}&per_page=100`, "--jq", ".workflow_runs[] | [.name,.event,.status,.conclusion] | @tsv"]) : repo;
  if (!runs.ok || !ciWorkflowPassed(runs.stdout)) failures.push("CI is not green on HEAD");
  for (const [program, args] of [["npm", ["test"]], ["npm", ["run", "typecheck"]], ["npm", ["run", "test:package"]]]) {
    const result = tryCommand(program, args, { stdio: "inherit" });
    if (!result.ok) failures.push(`${program} ${args.join(" ")} failed`);
  }
  if (failures.length > 0) fail(`Release refused: ${failures.join("; ")}`);
  else if (dryRun) {
    if (rowChangelog) process.stdout.write(`${releaseSection(version, tasks, "YYYY-MM-DD")}\n`);
    process.stdout.write(`Would release ${version}${isPrerelease(version) ? " to npm@next" : ""}\n`);
  }
  else {
    command("npm", ["version", version, "--no-git-tag-version"], { stdio: "inherit" });
    const date = new Date().toISOString().slice(0, 10);
    const dated = rowChangelog
      ? writeReleaseSection(readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8"), version, releaseSection(version, tasks, date))
      : readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8").replace(`## ${version} — unreleased`, `## ${version} — ${date}`);
    writeFileSync(resolve(ROOT, "CHANGELOG.md"), dated);
    command("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
    command("git", ["commit", "-m", version]);
    command("git", ["tag", "-a", `v${version}`, "-m", version]);
    command("npm", ["publish", ...(isPrerelease(version) ? ["--tag", "next"] : [])], { stdio: "inherit" });
    command("git", ["push", "--follow-tags"], { env: { ...process.env, UB_RELEASE: "1" }, stdio: "inherit" });
  }
}

function usesTaskRowChangelog(version) {
  const [major, minor] = version.split(".").map(Number);
  return major > 0 || minor >= 4;
}

function releaseSection(version, tasks, date) {
  const lines = tasks.map((task) => `- ${task.id} (${donePrNumbers(task.suffix).map((number) => `#${number}`).join(", ")}): ${task.changelog.trim()}`);
  return [`## ${version} — ${date}`, "", ...lines].join("\n");
}

function writeReleaseSection(changelog, version, section) {
  const heading = `## ${version} — unreleased`;
  const start = changelog.indexOf(heading);
  if (start === -1) {
    const firstSection = changelog.search(/^## /m);
    const before = firstSection === -1 ? changelog : changelog.slice(0, firstSection);
    const after = firstSection === -1 ? "" : changelog.slice(firstSection);
    const separator = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    return `${before}${separator}${section}\n\n${after}`;
  }
  const after = changelog.indexOf("\n## ", start + heading.length);
  return `${changelog.slice(0, start)}${section}${after === -1 ? "\n" : `\n\n${changelog.slice(after + 1)}`}`;
}
