import { contentAt, fail, taskEntries, tryCommand } from "./common.mjs";

const pr = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!/^\d+$/.test(pr ?? "")) fail("PR number is required");
else {
  const viewed = tryCommand("gh", ["pr", "view", pr, "--json", "headRefName,headRefOid,baseRefOid,title,files"]);
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
      const baseLog = repo.ok ? contentAt(repo.stdout, "CHANGELOG.md", details.baseRefOid) : repo;
      const headLog = repo.ok ? contentAt(repo.stdout, "CHANGELOG.md", details.headRefOid) : repo;
      if (!base.ok || !head.ok) fail(`Cannot read PR task rows: ${(base.ok ? head : base).message}`);
      else if (!baseLog.ok || !headLog.ok) fail(`Cannot read CHANGELOG.md: ${(baseLog.ok ? headLog : baseLog).message}`);
      else {
        const baseTasks = taskEntries(base.stdout);
        const headTasks = taskEntries(head.stdout);
        const missingHeadings = baseTasks.filter((task) => !headTasks.some((headTask) => headTask.id === task.id)).map((task) => task.id);
        const missingChangelog = baseTasks.filter((task) => task.changelog !== undefined && headTasks.find((headTask) => headTask.id === task.id)?.changelog === undefined).map((task) => task.id);
        const headLines = changelogIds(headLog.stdout);
        const missingLines = [...changelogIds(baseLog.stdout)].filter((id) => !headLines.has(id));
        const task = headTasks.find((entry) => entry.id === match[2]);
        if (missingHeadings.length > 0) fail(`PR loses task heading(s): ${missingHeadings.join(", ")}`);
        else if (missingLines.length > 0) fail(`PR loses CHANGELOG.md line(s): ${missingLines.join(", ")}`);
        else if (missingChangelog.length > 0) fail(`PR loses **Changelog:** line(s): ${missingChangelog.join(", ")}`);
        else if (usesTaskRowChangelog(task?.release)) {
          if (task.changelog?.trim() === "") fail(`PR task ${match[2]} has an empty **Changelog:** line`);
          else if (task.changelog === undefined) fail(`PR task ${match[2]} has no **Changelog:** line`);
          else process.stdout.write(`PR #${pr} format is valid\n`);
        } else if (!details.files.some((file) => file.path === "CHANGELOG.md")) fail("PR must add its task line to CHANGELOG.md");
        else process.stdout.write(`PR #${pr} format is valid\n`);
      }
    }
  }
}

/** Task ids with a line in CHANGELOG.md (`- XX-N` or `- XX-N (#N)`). */
function changelogIds(text) {
  return new Set([...text.matchAll(/^- ((?:CC|CX)-\d+)\b/gm)].map((match) => match[1]));
}

function usesTaskRowChangelog(version) {
  const [major, minor] = version?.split(".").map(Number) ?? [];
  return major > 0 || minor >= 4;
}
