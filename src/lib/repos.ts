import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { BrainError } from "./errors.ts";
import { isRecord } from "./input.ts";
import { formatTimestamp } from "./time.ts";

const exec = promisify(execFile);

/** One `brain.json` `repos` entry (spec/schema.md §12, 0042). */
export interface LinkedRepo { name: string; path: string; area: string; patterns: string[]; commit: string }

export interface RepoFile { path: string; status: "added" | "modified"; commit: string; committed_at: string; sha256: string; bytes: number }

/** The `repos` list of a brain.json, `[]` when absent. */
export function linkedRepos(config: Record<string, unknown>): LinkedRepo[] {
  return Array.isArray(config.repos) ? config.repos.filter(isRecord) as unknown as LinkedRepo[] : [];
}

/** The repo named `name`, or REPO_NOT_FOUND. */
export function findRepo(config: Record<string, unknown>, name: string): LinkedRepo {
  const repo = linkedRepos(config).find((entry) => entry.name === name);
  if (repo === undefined) throw new BrainError("REPO_NOT_FOUND", `No linked repo named ${name} in brain.json repos`);
  return repo;
}

/** A stored path with `~/` expanded. */
export function expandPath(path: string, home = homedir()): string {
  return path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

async function git(path: string, args: string[], input?: string): Promise<string> {
  const child = exec("git", ["-C", path, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (input !== undefined) child.child.stdin?.end(input);
  return (await child).stdout;
}

async function gitBytes(path: string, args: string[]): Promise<Buffer> {
  const { stdout } = await exec("git", ["-C", path, ...args], { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}

/** The real path of the top of the working tree at `path`, or null when it isn't one. */
export async function workTreeTop(path: string): Promise<string | null> {
  try {
    const top = (await git(path, ["rev-parse", "--show-toplevel"])).trim();
    return await realpath(top);
  } catch {
    return null;
  }
}

/** The repo's working tree, checked: REPO_NOT_FOUND when `path` isn't the top of one. */
export async function openRepo(repo: LinkedRepo, home?: string): Promise<string> {
  const path = expandPath(repo.path, home);
  const top = await workTreeTop(path);
  let real: string | null = null;
  try { real = await realpath(path); } catch { /* missing */ }
  if (top === null || real !== top) throw new BrainError("REPO_NOT_FOUND", `${repo.path} is not the top of a Git working tree`);
  return top;
}

/** The full id of `rev` as a commit, or REPO_COMMIT_UNKNOWN. */
export async function resolveCommit(path: string, rev: string): Promise<string> {
  try {
    return (await git(path, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`])).trim();
  } catch {
    throw new BrainError("REPO_COMMIT_UNKNOWN", `${rev} is not a commit in this repo`);
  }
}

/** REPO_COMMIT_UNKNOWN unless `ancestor` is an ancestor of (or equal to) `commit`. */
export async function assertAncestor(path: string, ancestor: string, commit: string): Promise<void> {
  try {
    await git(path, ["merge-base", "--is-ancestor", ancestor, commit]);
  } catch {
    throw new BrainError("REPO_COMMIT_UNKNOWN", `${ancestor} is not an ancestor of ${commit}`);
  }
}

const pathspecs = (patterns: readonly string[]) => ["--", ...patterns.map((pattern) => `:(glob)${pattern}`)];

/**
 * The files matching the patterns that changed from `from` (`""`: none) to `to` (spec/cli.md §5.16):
 * added or modified ones with the last commit in the range that touched them, oldest first, and
 * deleted ones apart. No rename detection.
 */
export async function repoChanges(path: string, patterns: readonly string[], from: string, to: string): Promise<{ files: RepoFile[]; deleted: string[] }> {
  const changed = new Map<string, "added" | "modified">();
  const deleted: string[] = [];
  // A first ingest compares with the empty tree, so every matching file is added.
  const base = from === "" ? (await git(path, ["hash-object", "-t", "tree", "--stdin"], "")).trim() : from;
  const fields = (await git(path, ["diff", "--name-status", "-z", "--no-renames", "--diff-filter=AMDT", base, to, ...pathspecs(patterns)])).split("\0").filter(Boolean);
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i]![0]; const file = fields[i + 1]!;
    if (status === "D") deleted.push(file);
    else changed.set(file, status === "A" ? "added" : "modified");
  }

  // The newest commit in the range that touched each file: the first one `git log` names.
  const last = new Map<string, { commit: string; time: number }>();
  const range = from === "" ? [to] : [`${from}..${to}`];
  const log = await git(path, ["log", "-z", "--no-renames", "--format=%x01%H %ct", "--name-only", ...range, ...pathspecs(patterns)]);
  for (const block of log.split("\x01").filter(Boolean)) {
    const [head, ...names] = block.split("\0");
    const [header, firstName] = head!.split("\n") as [string, string | undefined];
    const [commit, time] = header.split(" ") as [string, string];
    for (const name of [firstName, ...names].map((name) => name?.replace(/^\n/, "")).filter((name): name is string => name !== undefined && name !== "")) {
      if (!last.has(name)) last.set(name, { commit, time: Number(time) });
    }
  }

  const files: RepoFile[] = [];
  for (const [file, status] of changed) {
    const bytes = await gitBytes(path, ["cat-file", "blob", `${to}:${file}`]);
    const touched = last.get(file);
    if (touched === undefined) throw new Error(`git log names no commit for ${file}`);
    files.push({ path: file, status, commit: touched.commit, committed_at: formatTimestamp(new Date(touched.time * 1000)), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  }
  files.sort((a, b) => a.committed_at.localeCompare(b.committed_at) || (last.get(a.path)!.time - last.get(b.path)!.time) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  deleted.sort();
  return { files, deleted };
}

/** Whether the working tree has uncommitted changes (tracked or untracked). */
export async function isDirty(path: string): Promise<boolean> {
  return (await git(path, ["status", "--porcelain"])).trim() !== "";
}

/** The repo's HEAD commit, or REPO_COMMIT_UNKNOWN for a repo with no commits. */
export async function headCommit(path: string): Promise<string> {
  return resolveCommit(path, "HEAD");
}
