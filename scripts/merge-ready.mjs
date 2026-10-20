import { fail, readinessProblems, tryCommand } from "./common.mjs";

// Sets the `merge-ready` commit status on a PR's head (decision 0040). The status is the signal, so a finished check exits 0.
const pr = process.argv[2];
if (!/^\d+$/.test(pr ?? "")) fail("Usage: node scripts/merge-ready.mjs <PR>");
else {
  const viewed = tryCommand("gh", ["pr", "view", pr, "--json", "headRefName,headRefOid,title,body"]);
  const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  if (!viewed.ok || !repo.ok) fail(`Cannot read PR #${pr}: ${(viewed.ok ? repo : viewed).message}`);
  else {
    const details = JSON.parse(viewed.stdout);
    const problems = readinessProblems(repo.stdout, pr, details);
    const state = problems.length === 0 ? "success" : "failure";
    const text = problems.length === 0 ? "Ready to merge" : problems.join("; ");
    const description = text.length <= 140 ? text : `${text.slice(0, 139)}…`;
    const set = tryCommand("gh", ["api", `repos/${repo.stdout}/statuses/${details.headRefOid}`, "-f", `state=${state}`, "-f", "context=merge-ready", "-f", `description=${description}`]);
    if (!set.ok) fail(`Cannot set the merge-ready status: ${set.message}`);
    else process.stdout.write(`merge-ready ${state} on #${pr}: ${text}\n`);
  }
}
