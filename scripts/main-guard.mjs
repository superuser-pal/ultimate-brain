import { command, fail, tryCommand } from "./common.mjs";

const [before, after] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(before ?? "") || !/^[0-9a-f]{40}$/.test(after ?? "")) fail("Usage: node scripts/main-guard.mjs <before-sha> <after-sha>");
else {
  const repo = tryCommand("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const bad = [];
  for (const sha of command("git", ["rev-list", `${before}..${after}`]).split("\n").filter(Boolean)) {
    const subject = command("git", ["log", "-1", "--format=%s", sha]);
    const tags = command("git", ["tag", "--points-at", sha]).split("\n");
    const released = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(subject) && tags.includes(`v${subject}`);
    const pulls = repo.ok ? tryCommand("gh", ["api", `repos/${repo.stdout}/commits/${sha}/pulls`, "-H", "Accept: application/vnd.github+json", "--jq", ".[] | select(.merged_at != null) | .number"]) : repo;
    if (!released && (!pulls.ok || pulls.stdout === "")) bad.push(sha);
  }
  if (bad.length === 0) process.stdout.write("main-guard passed\n");
  else {
    if (repo.ok) tryCommand("gh", ["issue", "create", "--repo", repo.stdout, "--label", "main-guard", "--title", "main-guard: direct commits on main", "--body", `Unexpected commits: ${bad.join(", ")}`]);
    fail(`main-guard rejected: ${bad.join(", ")}`);
  }
}
