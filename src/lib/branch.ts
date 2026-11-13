import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";

import type { Warning } from "./command.ts";
import { workTreeTop } from "./repos.ts";

const exec = promisify(execFile);

export type WorkingFrom = "origin-head" | "only-branch" | "main" | "master" | "unborn";

export interface BranchStatus {
  working: string | null;
  from: WorkingFrom | null;
  current: string | null;
  on_working: boolean;
  unmerged: Array<{ branch: string | null; commits: number }>;
}

/**
 * `brain status`'s `branch` block (spec/cli.md §5.2, 0086 §1, §2): the brain's working branch, the branch checked out, and
 * the local branches holding commits the working branch lacks. Read-only: Git is read only through `rev-parse
 * --show-toplevel`, `symbolic-ref`, `for-each-ref refs/heads` and `rev-list --count`, in the brain folder.
 * Null when the brain is not itself a Git repository (the test of `checks.remote`).
 */
async function readBranches(root: string): Promise<{ branch: BranchStatus; count: number } | null> {
  const top = await workTreeTop(root);
  if (top === null || top !== await realpath(root)) return null;

  // Full ref names, stripped here: `%(refname:short)` turns refs/heads/main into heads/main when a tag `main` exists too.
  const branches = (await gitOut(root, ["for-each-ref", "--format=%(refname)", "refs/heads"]) ?? "")
    .split("\n").filter((ref) => ref.startsWith("refs/heads/")).map((ref) => ref.slice("refs/heads/".length)).sort(byName);
  const headRef = await gitOut(root, ["symbolic-ref", "--quiet", "HEAD"]);
  const current = headRef !== null && headRef.startsWith("refs/heads/") ? headRef.slice("refs/heads/".length) : null;

  let working: string | null = null;
  let from: WorkingFrom | null = null;
  const originHead = await gitOut(root, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  const named = originHead !== null && originHead.startsWith("refs/remotes/origin/") ? originHead.slice("refs/remotes/origin/".length) : null;
  if (named !== null && branches.includes(named)) [working, from] = [named, "origin-head"];
  else if (branches.length === 1) [working, from] = [branches[0], "only-branch"];
  else if (branches.includes("main")) [working, from] = ["main", "main"];
  else if (branches.includes("master")) [working, from] = ["master", "master"];
  else if (branches.length === 0 && current !== null) {
    // No commit yet: the branch HEAD names is the working branch, and nothing can be off it.
    return { branch: { working: current, from: "unborn", current, on_working: true, unmerged: [] }, count: 0 };
  }

  const unmerged: BranchStatus["unmerged"] = [];
  if (working !== null) {
    const base = `refs/heads/${working}`;
    if (current === null) {
      const commits = await countAhead(root, base, "HEAD");
      if (commits > 0) unmerged.push({ branch: null, commits });
    }
    for (const name of branches) {
      if (name === working) continue;
      const commits = await countAhead(root, base, `refs/heads/${name}`);
      if (commits > 0) unmerged.push({ branch: name, commits });
    }
  }
  return { branch: { working, from, current, on_working: current !== null && current === working, unmerged }, count: branches.length };
}

/**
 * The `branch` block and its one warning `BRAIN_OFF_WORKING_BRANCH`, null when the brain is on its working branch with
 * nothing left elsewhere (cli.md §5.2).
 */
export async function branchCheck(root: string): Promise<{ branch: BranchStatus | null; warning: Warning | null }> {
  const found = await readBranches(root);
  return found === null ? { branch: null, warning: null } : { branch: found.branch, warning: branchWarning(found.branch, found.count) };
}

function branchWarning(branch: BranchStatus, count: number): Warning | null {
  const fix = 'Say "fix my backup".';
  const warn = (message: string): Warning => ({ code: "BRAIN_OFF_WORKING_BRANCH", message });
  if (branch.working === null) {
    return warn(`Can't tell which branch is the brain's working branch: ${count} branches, none of them main or master. ${fix}`);
  }
  if (branch.current === null) return warn(`The brain is on a detached HEAD, not its working branch ${branch.working}. ${fix}`);
  if (!branch.on_working) return warn(`The brain is on branch ${branch.current}, not its working branch ${branch.working}. ${fix}`);
  const named = branch.unmerged.filter((entry) => entry.branch !== null);
  if (named.length === 0) return null;
  const more = named.length > 1 ? ` (and ${named.length - 1} more branches)` : "";
  return warn(`Branch ${named[0].branch} has ${named[0].commits} commit(s) that ${branch.working} lacks${more}. ${fix}`);
}

/** Branch names in code-point order, so the order doesn't depend on the locale. */
function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function countAhead(root: string, base: string, tip: string): Promise<number> {
  const out = await gitOut(root, ["rev-list", "--count", `${base}..${tip}`]);
  return out === null ? 0 : Number(out) || 0;
}

/** Git's trimmed output, or null when the command fails (no such ref, not a repository). */
async function gitOut(root: string, args: string[]): Promise<string | null> {
  try {
    return (await exec("git", args, { cwd: root, encoding: "utf8" })).stdout.trim();
  } catch {
    return null;
  }
}
