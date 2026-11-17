import { contentAt, fail, optionalContentAt, taskEntries, taskRowProblem, tryCommand } from "./common.mjs";

const pr = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!/^\d+$/.test(pr ?? "")) fail("PR number is required");
else {
  const viewed = tryCommand("gh", ["pr", "view", pr, "--json", "headRefName,headRefOid,baseRefOid,title"]);
  if (!viewed.ok) fail(`Cannot read PR #${pr}: ${viewed.message}`);
  else {
    const details = JSON.parse(viewed.stdout);
    const match = /^(claude|codex)\/((?:CC|CX)-\d+)-/.exec(details.headRefName ?? "");
    if (match === null) fail("PR branch must match (claude|codex)/(CC|CX)-N-…");
    else if (!new RegExp(`^${match[2]}:`).test(details.title ?? "")) fail("PR title must start with the branch task id and colon");
    else {
      const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
      const base = repo.ok ? contentAt(repo.stdout, "build/TASKS.md", details.baseRefOid) : repo;
      const head = repo.ok ? contentAt(repo.stdout, "build/TASKS.md", details.headRefOid) : repo;
      const baseHistory = repo.ok ? optionalContentAt(repo.stdout, "build/HISTORY.md", details.baseRefOid) : repo;
      const headHistory = repo.ok ? optionalContentAt(repo.stdout, "build/HISTORY.md", details.headRefOid) : repo;
      const baseLog = repo.ok ? contentAt(repo.stdout, "CHANGELOG.md", details.baseRefOid) : repo;
      const headLog = repo.ok ? contentAt(repo.stdout, "CHANGELOG.md", details.headRefOid) : repo;
      if (!base.ok || !head.ok) fail(`Cannot read PR task rows: ${(base.ok ? head : base).message}`);
      else if (!baseHistory.ok || !headHistory.ok) fail(`Cannot read build/HISTORY.md: ${(baseHistory.ok ? headHistory : baseHistory).message}`);
      else if (!baseLog.ok || !headLog.ok) fail(`Cannot read CHANGELOG.md: ${(baseLog.ok ? headLog : baseLog).message}`);
      else {
        // A row moved from TASKS.md to HISTORY.md is not lost (CC-94).
        const baseTasks = taskEntries(`${base.stdout}\n${baseHistory.stdout}`);
        const headTasks = taskEntries(`${head.stdout}\n${headHistory.stdout}`);
        const headLines = changelogIds(headLog.stdout);
        const missingLines = [...changelogIds(baseLog.stdout)].filter((id) => !headLines.has(id));
        const rows = taskRowProblem(match[2], baseTasks, headTasks);
        const clash = rows === undefined ? plannedElsewhere(repo.stdout, pr, headTasks.filter((entry) => !baseTasks.some((baseTask) => baseTask.id === entry.id))) : undefined;
        if (rows !== undefined) fail(rows);
        else if (missingLines.length > 0) fail(`PR loses CHANGELOG.md line(s): ${missingLines.join(", ")}`);
        else if (clash !== undefined) fail(clash);
        else process.stdout.write(`PR #${pr} format is valid\n`);
      }
    }
  }
}

/**
 * The message for a task id this PR adds that another open PR also adds under another title (CC-300), or undefined. A PR stacked on this one,
 * or below it, carries the same row with the same title, so it is no clash.
 */
function plannedElsewhere(repo, pr, added) {
  if (added.length === 0) return undefined;
  const listed = tryCommand("gh", ["pr", "list", "--state", "open", "--limit", "100", "--json", "number,headRefOid"]);
  if (!listed.ok) return `Cannot list the open PRs: ${listed.message}`;
  for (const other of listed.stdout === "" ? [] : JSON.parse(listed.stdout)) {
    if (String(other.number) === String(pr)) continue;
    const tasks = optionalContentAt(repo, "build/TASKS.md", other.headRefOid);
    if (!tasks.ok) return `Cannot read build/TASKS.md of PR #${other.number}: ${tasks.message}`;
    const theirs = taskEntries(tasks.stdout);
    const taken = added.filter((entry) => theirs.some((their) => their.id === entry.id && their.title !== entry.title)).map((entry) => entry.id);
    if (taken.length > 0) return `PR adds task id(s) that open PR #${other.number} uses for another task: ${taken.join(", ")}. Take free ids: node scripts/task.mjs next-id`;
  }
  return undefined;
}

/** Task ids with a line in CHANGELOG.md (`- XX-N` or `- XX-N (#N)`). */
function changelogIds(text) {
  return new Set([...text.matchAll(/^- ((?:CC|CX)-\d+)\b/gm)].map((match) => match[1]));
}
