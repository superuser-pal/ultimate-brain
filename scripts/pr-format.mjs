import { command, fail, tryCommand } from "./common.mjs";

const pr = process.env.GITHUB_REF_NAME ?? process.argv[2];
if (!/^\d+$/.test(pr ?? "")) fail("PR number is required");
else {
  const viewed = tryCommand("gh", ["pr", "view", pr, "--json", "headRefName,title,files"]);
  if (!viewed.ok) fail(`Cannot read PR #${pr}: ${viewed.message}`);
  else {
    const details = JSON.parse(viewed.stdout);
    const match = /^(claude|codex)\/((?:CC|CX)-\d+)-/.exec(details.headRefName ?? "");
    if (match === null) fail("PR branch must match (claude|codex)/(CC|CX)-N-…");
    else if (!new RegExp(`^${match[2]}:`).test(details.title ?? "")) fail("PR title must start with the branch task id and colon");
    else if (!details.files.some((file) => file.path === "CHANGELOG.md")) fail("PR must add its task line to CHANGELOG.md");
    else {
      const changelog = tryCommand("gh", ["pr", "diff", pr, "--", "CHANGELOG.md"]);
      if (!changelog.ok || !new RegExp(`^\\+.*${match[2]}`, "m").test(changelog.stdout)) fail("PR CHANGELOG.md addition must contain its task id");
      else process.stdout.write(`PR #${pr} format is valid\n`);
    }
  }
}
