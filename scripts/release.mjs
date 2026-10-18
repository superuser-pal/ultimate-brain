import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { checksPassed, command, fail, isPrerelease, ROOT, taskEntries, tryCommand } from "./common.mjs";

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
  const changelog = readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8");
  if (!new RegExp(`^## ${version}(?: — |$)`, "m").test(changelog)) failures.push(`CHANGELOG.md has no ${version} entry`);
  for (const task of taskEntries().filter((entry) => entry.release === version)) if (task.status !== "done") failures.push(`${task.id} is ${task.status}, not done`);
  const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const checks = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/commits/${command("git", ["rev-parse", "HEAD"])}/check-runs`, "--paginate", "--jq", ".check_runs[] | [.status,.conclusion] | @tsv"]) : repo;
  if (!checks.ok || !checksPassed(checks.stdout)) failures.push("CI is not green on HEAD");
  for (const [program, args] of [["npm", ["test"]], ["npm", ["run", "typecheck"]], ["npm", ["run", "test:package"]]]) {
    const result = tryCommand(program, args, { stdio: "inherit" });
    if (!result.ok) failures.push(`${program} ${args.join(" ")} failed`);
  }
  if (failures.length > 0) fail(`Release refused: ${failures.join("; ")}`);
  else if (dryRun) process.stdout.write(`Would release ${version}${isPrerelease(version) ? " to npm@next" : ""}\n`);
  else {
    command("npm", ["version", version, "--no-git-tag-version"], { stdio: "inherit" });
    const dated = readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8").replace(`## ${version} — unreleased`, `## ${version} — ${new Date().toISOString().slice(0, 10)}`);
    writeFileSync(resolve(ROOT, "CHANGELOG.md"), dated);
    command("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
    command("git", ["commit", "-m", version]);
    command("git", ["tag", `v${version}`]);
    command("npm", ["publish", ...(isPrerelease(version) ? ["--tag", "next"] : [])], { stdio: "inherit" });
    command("git", ["push", "--follow-tags"], { env: { ...process.env, UB_RELEASE: "1" }, stdio: "inherit" });
  }
}
