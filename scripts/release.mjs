import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ciWorkflowState, command, donePrNumbers, fail, isPrerelease, ROOT, sleep, taskEntries, tryCommand } from "./common.mjs";

// A CI run that is queued, running or not yet created for HEAD is waited for: every 20 s, up to 10 minutes. Tests shorten both.
const CI_POLL_MS = Number(process.env.UB_CI_POLL_MS ?? 20000);
const CI_POLLS = Number(process.env.UB_CI_POLLS ?? 30);

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const { version, dryRun, partialReason, usage } = parseArguments(process.argv.slice(2));
if (usage || !semver.test(version ?? "")) fail('Usage: node scripts/release.mjs <version> [--dry-run] [--allow-partial "<reason>"]');
else {
  const failures = [];
  const worktrees = command("git", ["worktree", "list", "--porcelain"]).split("\n\n");
  const mainBlock = worktrees.find((block) => block.includes("branch refs/heads/main"));
  const mainPath = mainBlock?.match(/^worktree (.+)$/m)?.[1];
  if (mainPath === undefined || realpathSync(process.cwd()) !== realpathSync(mainPath)) failures.push("must run from the main worktree");
  if (tryCommand("git", ["branch", "--show-current"]).stdout !== "main") failures.push("must run on main");
  if (command("git", ["status", "--porcelain"]) !== "") failures.push("working tree is not clean");
  if (command("git", ["rev-parse", "HEAD"]) !== command("git", ["rev-parse", "origin/main"])) failures.push("HEAD is not level with origin/main");
  // The vendoring PR may already have set package.json to the release it lands in (spec/skills-delivery.md §9.4).
  const held = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
  if (comparePrecedence(version, held) < 0 && !(isPrerelease(version) && !isPrerelease(held) && version.split("-")[0] === held)) {
    failures.push(`package.json is already ${held}; release ${held} or later`);
  }
  const rowChangelog = usesTaskRowChangelog(version);
  const entries = taskEntries();
  const tasks = entries.filter((entry) => entry.release === version && entry.status !== "dropped");
  // A prerelease ships the work of its release: 0.4.0-rc.1 counts the rows of 0.4.0 (#250: 0.10.1 was published with none).
  const base = version.split("-")[0];
  if (!entries.some((entry) => entry.status !== "dropped" && (entry.release === version || entry.release === base))) {
    failures.push(`no task has **Release:** ${version}; merge its PR first`);
  }
  // Work of a later release already on main would ship in this one (F-0001); a release with a dated CHANGELOG section is out, and a development-only row ships nothing.
  const ahead = laterWork(entries, base);
  if (ahead.length > 0 && partialReason === undefined) {
    const lowest = ahead.map((entry) => entry.release).sort(comparePrecedence)[0];
    failures.push(`done tasks of a later release are on main: ${ahead.map(described).join(", ")}; release ${lowest} or later, or pass --allow-partial "<reason>"`);
  }
  const partial = ahead.length > 0 ? partialReason : undefined;
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
  // The skills gate runs after npm test, whose pretest checks the vendored snapshot offline; the gate adds the online check (spec/skills-delivery.md §9.8, §11.3).
  const skills = gatesSkills(version) ? skillsGate(version, repo.ok && repo.stdout !== "" ? repo.stdout : undefined, dryRun) : { problems: [] };
  failures.push(...skills.problems);
  if (failures.length > 0) fail(`Release refused: ${failures.join("; ")}`);
  else if (dryRun) {
    if (rowChangelog) process.stdout.write(`${releaseSection(version, tasks, "YYYY-MM-DD", skills.line)}\n`);
    process.stdout.write(`Would release ${version}${isPrerelease(version) ? " to npm@next" : ""}${partial === undefined ? "" : `, partial (${ahead.map(described).join(", ")} stays out): ${partial}`}\n`);
  }
  else {
    command("npm", ["version", version, "--no-git-tag-version", ...(version === held ? ["--allow-same-version"] : [])], { stdio: "inherit" });
    const date = new Date().toISOString().slice(0, 10);
    const dated = rowChangelog
      ? writeReleaseSection(readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8"), version, releaseSection(version, tasks, date, skills.line))
      : readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8").replace(`## ${version} — unreleased`, `## ${version} — ${date}`);
    writeFileSync(resolve(ROOT, "CHANGELOG.md"), dated);
    const publishArgs = ["publish", ...(isPrerelease(version) ? ["--tag", "next"] : [])];
    const staged = tryCommand("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
    const body = partial === undefined ? [] : ["-m", `Partial release: ${partial}\nOn main and not in it: ${ahead.map(described).join(", ")}`];
    const committed = staged.ok ? tryCommand("git", ["commit", "-m", version, ...body]) : staged;
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

/** `<version> [--dry-run] [--allow-partial "<reason>" | --allow-partial=<reason>]`, in any order; `usage` when anything else is given or a reason is blank. */
function parseArguments(args) {
  const parsed = { version: undefined, dryRun: false, partialReason: undefined, usage: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const inline = /^--allow-partial=(.*)$/s.exec(arg);
    if (arg === "--dry-run" && !parsed.dryRun) parsed.dryRun = true;
    else if ((arg === "--allow-partial" || inline !== null) && parsed.partialReason === undefined) {
      const reason = inline === null ? args[++index] : inline[1];
      if (reason === undefined || reason.trim() === "" || reason.startsWith("--")) parsed.usage = true;
      else parsed.partialReason = reason.trim();
    }
    else if (!arg.startsWith("--") && parsed.version === undefined) parsed.version = arg;
    else parsed.usage = true;
  }
  return parsed;
}

/** `done` tasks of a release above `base` that CHANGELOG.md has no dated section for, leaving out `development only` rows. */
function laterWork(entries, base) {
  const changelogPath = resolve(ROOT, "CHANGELOG.md");
  const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "";
  const released = new Set([...changelog.matchAll(/^## (\S+) — \d{4}-\d{2}-\d{2}/gm)].map((match) => match[1]));
  return entries.filter((entry) => entry.status === "done" && semver.test(entry.release) && !released.has(entry.release)
    && !/^\s*development only\b/.test(entry.changelog ?? "") && comparePrecedence(base, entry.release) < 0);
}

function described(entry) { return `${entry.id} (${entry.release})`; }

/** SemVer 2.0.0 precedence of two `x.y.z[-pre]` versions, as src/lib/skills-range.ts orders them: negative when `left` is lower. */
function comparePrecedence(left, right) {
  const parse = (value) => { const [core, pre] = value.split(/-(.*)/s); return { core: core.split(".").map(Number), pre: pre === undefined ? [] : pre.split(".") }; };
  const [a, b] = [parse(left), parse(right)];
  for (let index = 0; index < 3; index += 1) if (a.core[index] !== b.core[index]) return a.core[index] - b.core[index];
  if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length;
  for (let index = 0; index < Math.min(a.pre.length, b.pre.length); index += 1) {
    const [x, y] = [a.pre[index], b.pre[index]];
    if (x === y) continue;
    const [xNumber, yNumber] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (xNumber && yNumber) return Number(x) - Number(y);
    if (xNumber !== yNumber) return xNumber ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.pre.length - b.pre.length;
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

/** From 0.9.0 on a release checks skill updates and records its tested skills (spec/skills-delivery.md §11); earlier ones have no package snapshot. */
function gatesSkills(version) {
  const [major, minor] = version.split(".").map(Number);
  return major > 0 || minor >= 9;
}

/**
 * Runs the skills-integration check with the release rules (§11.3, §9.8), printing its warnings: `{ problems, line }`, where `line` is the CHANGELOG's
 * `Skills:` line (§11.1): the vendored snapshot's name and version. (A phase A manifest, which the gate now refuses, carried the released version.)
 */
function skillsGate(version, repo, dryRun) {
  const script = fileURLToPath(new URL("./skills-integration.mjs", import.meta.url));
  const args = ["--no-warnings", "--experimental-strip-types", script, "--json", "--root", ROOT, "--release", version, ...(repo === undefined ? [] : ["--repo", repo]), ...(dryRun ? ["--dry-run"] : [])];
  const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
  let result;
  try { result = JSON.parse(run.stdout); } catch { return { problems: [`skills integration check failed: ${(run.stderr || run.error?.message || "no output").trim().split("\n")[0]}`] }; }
  for (const warning of result.warnings ?? []) process.stderr.write(`Warning: ${warning}\n`);
  const tested = result.block?.tested;
  const line = tested === undefined ? undefined : `Skills: ${tested.name} ${tested.name === "ultimate-brain" ? version : tested.version} (${tested.integrity})`;
  return { problems: result.problems, line };
}

function releaseSection(version, tasks, date, skillsLine) {
  const lines = tasks.map((task) => `- ${task.id} (${donePrNumbers(task.suffix).map((number) => `#${number}`).join(", ")}): ${task.changelog.trim()}`);
  return [`## ${version} — ${date}`, "", ...lines, ...(skillsLine === undefined ? [] : ["", skillsLine])].join("\n");
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
