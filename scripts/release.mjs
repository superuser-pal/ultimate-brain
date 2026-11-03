import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ciWorkflowState, command, donePrNumbers, fail, isPrerelease, ROOT, sleep, taskEntries, tryCommand } from "./common.mjs";

// A CI run that is queued, running or not yet created for HEAD is waited for: every 20 s, up to 10 minutes. Tests shorten both.
const CI_POLL_MS = Number(process.env.UB_CI_POLL_MS ?? 20000);
const CI_POLLS = Number(process.env.UB_CI_POLLS ?? 30);

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
  failures.push(...npmProblems(), ...existingRelease(version));
  const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const head = command("git", ["rev-parse", "HEAD"]);
  const ciState = () => {
    const runs = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/actions/runs?head_sha=${head}&per_page=100`, "--jq", ".workflow_runs[] | [.name,.event,.head_branch,.status,.conclusion] | @tsv"]) : repo;
    return runs.ok ? ciWorkflowState(runs.stdout) : "unreadable";
  };
  let ci = ciState();
  // Waiting only makes sense when nothing else already refuses the release. A failed read is retried like a pending run (a transient gh error).
  const waiting = () => ci === "pending" || ci === "missing" || (ci === "unreadable" && repo.ok);
  for (let poll = 0; poll < CI_POLLS && failures.length === 0 && waiting(); poll++) {
    if (poll === 0) process.stderr.write("Waiting for CI on HEAD…\n");
    sleep(CI_POLL_MS);
    ci = ciState();
  }
  if (ci !== "success") failures.push(`CI is not green on HEAD (${ci})`);
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
    const publishArgs = ["publish", ...(isPrerelease(version) ? ["--tag", "next"] : [])];
    const staged = tryCommand("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
    const committed = staged.ok ? tryCommand("git", ["commit", "-m", version]) : staged;
    const tagged = committed.ok ? tryCommand("git", ["tag", "-a", `v${version}`, "-m", version]) : committed;
    if (!tagged.ok) {
      fail(`Release stopped before publishing: ${tagged.message.split("\n")[0]}. Nothing was published or pushed.\n`
        + `The checkout holds only this release's edits${committed.ok ? ` and the commit ${version}` : ""}; undo with: git reset --hard origin/main`);
    }
    else if (!tryCommand("npm", publishArgs, { stdio: "inherit" }).ok) {
      fail(`npm ${publishArgs.join(" ")} failed. The commit ${version} and the tag v${version} exist only here; don't run release.mjs again.\n`
        + `Fix the cause (npm whoami, npm login), then from this checkout run: npm ${publishArgs.join(" ")} && UB_RELEASE=1 git push --follow-tags`);
    }
    else if (!tryCommand("git", ["push", "--follow-tags"], { env: { ...process.env, UB_RELEASE: "1" }, stdio: "inherit" }).ok) {
      fail(`${version} is published on npm, but the push failed. Fix the cause, then from this checkout run: UB_RELEASE=1 git push --follow-tags`);
    }
  }
}

/** npm must be logged in as an owner of the package, so a publish can't fail after the commit and tag (0.8.0 did: E404 from another account). */
/** A version that is already tagged here or on origin, or already on npm, can't be released again: the commit would be made and the tag would fail. */
function existingRelease(version) {
  const problems = [];
  if (tryCommand("git", ["tag", "-l", `v${version}`]).stdout) problems.push(`tag v${version} already exists here`);
  if (tryCommand("git", ["ls-remote", "--tags", "origin", `refs/tags/v${version}`]).stdout) problems.push(`tag v${version} already exists on origin`);
  const name = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).name;
  if (tryCommand("npm", ["view", `${name}@${version}`, "version"]).stdout) problems.push(`${name}@${version} is already on npm`);
  return problems;
}

function npmProblems() {
  const name = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).name;
  const user = tryCommand("npm", ["whoami"]);
  if (!user.ok || user.stdout === "") return [`npm is not logged in (npm whoami: ${user.ok ? "no user" : user.message.split("\n")[0]}); run npm login`];
  const owners = tryCommand("npm", ["owner", "ls", name]);
  // A package that was never published has no owners yet.
  if (!owners.ok) return /E404|404 Not Found/.test(owners.message) ? [] : [`cannot read the npm owners of ${name}: ${owners.message.split("\n")[0]}`];
  const names = owners.stdout.split("\n").map((line) => line.split(" ")[0]);
  return names.includes(user.stdout) ? [] : [`npm user ${user.stdout} is not an owner of ${name} (owners: ${names.filter(Boolean).join(", ")}); npm logout, then npm login as an owner`];
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
