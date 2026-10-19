import { checksPassed, command, fail, tryCommand } from "./common.mjs";

const [pr, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
const reviewedByUser = flags.includes("--reviewed-by-user");
if (!/^\d+$/.test(pr ?? "") || flags.length !== new Set(flags).size || flags.some((flag) => flag !== "--dry-run" && flag !== "--reviewed-by-user")) {
  fail("Usage: node scripts/merge.mjs <PR> [--dry-run] [--reviewed-by-user]");
}
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
    if (!reviewedByUser && (branch === null || !repo.ok || !hasOtherAgentPass(repo.stdout, pr, details.headRefOid, branch[1]))) {
      failures.push("no fresh pass from the other agent");
    }
    if (failures.length > 0) fail(`Refusing to merge #${pr}: ${failures.join("; ")}`);
    else {
      const warning = reviewedByUser ? "WARNING: user override bypasses the other-agent review gate\n" : "";
      const mergeArgs = ["pr", "merge", pr, "--merge", "--match-head-commit", details.headRefOid];
      if (reviewedByUser) mergeArgs.push("--body", "Review gate overridden by user.");
      if (dryRun) process.stdout.write(`${warning}Would merge #${pr} at ${details.headRefOid}\n`);
      else {
        if (warning) process.stderr.write(warning);
        command("gh", mergeArgs, { stdio: "inherit" });
      }
    }
  }
}

function hasOtherAgentPass(repo, pr, head, author) {
  const endpoint = [`repos/${repo}/pulls/${pr}/reviews`, `repos/${repo}/issues/${pr}/comments`];
  const required = author === "codex" ? "Claude Code" : "Codex";
  const verdict = new RegExp(`^Review \\(${required}\\): pass at ([0-9a-f]{7,})\\b`, "i");
  return endpoint.some((path) => {
    const result = tryCommand("gh", ["api", path, "--paginate", "--slurp"]);
    if (!result.ok) return false;
    try {
      return JSON.parse(result.stdout).flat().some((item) => {
        const match = verdict.exec(item.body ?? "");
        return match !== null && head.toLowerCase().startsWith(match[1].toLowerCase());
      });
    } catch {
      return false;
    }
  });
}
