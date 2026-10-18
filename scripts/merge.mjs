import { checksPassed, command, fail, ROOT, tryCommand } from "./common.mjs";

const [pr, flag] = process.argv.slice(2);
const dryRun = flag === "--dry-run";
if (!/^\d+$/.test(pr ?? "") || (flag !== undefined && !dryRun)) fail("Usage: node scripts/merge.mjs <PR> [--dry-run]");
else {
  const viewed = tryCommand("gh", ["pr", "view", pr, "--json", "headRefName,headRefOid,title,body,mergeable,state"]);
  if (!viewed.ok) fail(`Cannot read PR #${pr}: ${viewed.message}`);
  else {
    const details = JSON.parse(viewed.stdout);
    const branch = /^(claude|codex)\/((?:CC|CX)-\d+)-/.exec(details.headRefName ?? "");
    const failures = [];
    if (details.state !== "OPEN") failures.push("PR is not open");
    if (branch === null) failures.push("branch must be claude|codex/<CC|CX>-N-…");
    else if (!new RegExp(`^${branch[2]}:`).test(details.title ?? "")) failures.push("title must start with its task id and colon");
    if (/^- \[ \]/m.test(details.body ?? "")) failures.push("all PR checklist boxes must be ticked");
    if (details.mergeable !== "MERGEABLE") failures.push(`PR is not mergeable (${details.mergeable ?? "unknown"})`);
    const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    const checks = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/commits/${details.headRefOid}/check-runs`, "--paginate", "--jq", ".check_runs[] | [.status,.conclusion] | @tsv"]) : repo;
    if (!checks.ok || !checksPassed(checks.stdout)) failures.push("CI has not passed on the PR head commit");
    if (failures.length > 0) fail(`Refusing to merge #${pr}: ${failures.join("; ")}`);
    else if (dryRun) process.stdout.write(`Would merge #${pr} at ${details.headRefOid}\n`);
    else command("gh", ["pr", "merge", pr, "--merge", "--match-head-commit", details.headRefOid], { stdio: "inherit" });
  }
}
