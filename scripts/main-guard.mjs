import { command, fail, hasOtherAgentPass, REVIEW_OVERRIDE_NOTE, tryCommand } from "./common.mjs";

const [before, after] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(before ?? "") || !/^[0-9a-f]{40}$/.test(after ?? "")) fail("Usage: node scripts/main-guard.mjs <before-sha> <after-sha>");
else {
  const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const bad = [];
  const merged = new Set();
  for (const sha of command("git", ["rev-list", `${before}..${after}`]).split("\n").filter(Boolean)) {
    const subject = command("git", ["log", "-1", "--format=%s", sha]);
    const tags = command("git", ["tag", "--points-at", sha]).split("\n");
    const released = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(subject) && tags.includes(`v${subject}`);
    const pulls = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/commits/${sha}/pulls`, "-H", "Accept: application/vnd.github+json", "--jq", ".[] | select(.merged_at != null) | .number"]) : repo;
    if (!released && (!pulls.ok || pulls.stdout === "")) bad.push(sha);
    else if (!released) for (const number of pulls.stdout.split("\n").filter(Boolean)) merged.add(number);
  }
  // Every merged PR needs the other agent's pass naming its head, or the user override merge.mjs writes (decision 0038).
  for (const number of merged) {
    const pull = tryCommand("gh", ["api", `repos/${repo.stdout}/pulls/${number}`, "--jq", "[.head.sha, .head.ref, .merge_commit_sha] | @tsv"]);
    const [head, ref, mergeCommit] = pull.ok ? pull.stdout.split("\t") : [];
    const author = /^(claude|codex)\//.exec(ref ?? "")?.[1];
    const message = mergeCommit ? tryCommand("git", ["log", "-1", "--format=%B", mergeCommit]) : { ok: false };
    const overridden = message.ok && message.stdout.includes(REVIEW_OVERRIDE_NOTE);
    if (!overridden && (author === undefined || !hasOtherAgentPass(repo.stdout, number, head, author))) bad.push(`#${number} (no other-agent pass or user override)`);
  }
  if (bad.length === 0) process.stdout.write("main-guard passed\n");
  else {
    if (repo.ok) tryCommand("gh", ["issue", "create", "--repo", repo.stdout, "--label", "main-guard", "--title", "main-guard: direct commits on main", "--body", `Unexpected commits or merges: ${bad.join(", ")}`]);
    fail(`main-guard rejected: ${bad.join(", ")}`);
  }
}
