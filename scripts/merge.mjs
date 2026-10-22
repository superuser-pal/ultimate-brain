import { checksPassed, command, fail, readinessProblems, REVIEW_OVERRIDE_NOTE, sleep, tryCommand } from "./common.mjs";

// GitHub computes mergeability lazily: ask again every 2 s for up to 20 s while it says UNKNOWN. Tests shorten the interval.
const POLL_MS = Number(process.env.UB_MERGEABLE_POLL_MS ?? 2000);
const POLLS = 10;

const [pr, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
const reviewedByUser = flags.includes("--reviewed-by-user");
if (!/^\d+$/.test(pr ?? "") || flags.length !== new Set(flags).size || flags.some((flag) => flag !== "--dry-run" && flag !== "--reviewed-by-user")) {
  fail("Usage: node scripts/merge.mjs <PR> [--dry-run] [--reviewed-by-user]");
}
else {
  const view = () => tryCommand("gh", ["pr", "view", pr, "--json", "baseRefName,headRefName,headRefOid,title,body,mergeable,state"]);
  let viewed = view();
  for (let poll = 0; poll < POLLS && viewed.ok && JSON.parse(viewed.stdout).mergeable === "UNKNOWN"; poll++) {
    sleep(POLL_MS);
    viewed = view();
  }
  if (!viewed.ok) fail(`Cannot read PR #${pr}: ${viewed.message}`);
  else {
    const details = JSON.parse(viewed.stdout);
    const failures = [];
    if (details.state !== "OPEN") failures.push("PR is not open");
    if (details.mergeable === "UNKNOWN") failures.push("GitHub has not computed mergeability; retry");
    else if (details.mergeable !== "MERGEABLE") failures.push(`PR is not mergeable (${details.mergeable ?? "unknown"})`);
    const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
    const checks = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/commits/${details.headRefOid}/check-runs`, "--paginate", "--jq", ".check_runs[] | [.status,.conclusion] | @tsv"]) : repo;
    if (!checks.ok || !checksPassed(checks.stdout)) failures.push("CI has not passed on the PR head commit");
    if (repo.ok) failures.push(...readinessProblems(repo.stdout, pr, details, { skipPass: reviewedByUser }));
    else failures.push(`cannot read the repository: ${repo.message}`);
    if (failures.length > 0) fail(`Refusing to merge #${pr}: ${failures.join("; ")}`);
    else {
      const warning = reviewedByUser ? "WARNING: user override bypasses the other-agent review gate\n" : "";
      const mergeArgs = ["pr", "merge", pr, "--merge", "--match-head-commit", details.headRefOid];
      if (reviewedByUser) mergeArgs.push("--body", REVIEW_OVERRIDE_NOTE);
      if (dryRun) process.stdout.write(`${warning}Would merge #${pr} at ${details.headRefOid}\n`);
      else {
        if (warning) process.stderr.write(warning);
        command("gh", mergeArgs, { stdio: "inherit" });
      }
    }
  }
}
