import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { NOTE_FOLDERS } from "./notes.ts";

/**
 * The Git side of `brain upgrade` around the user's uncommitted work (spec/cli.md §5.15 **Uncommitted work**, decision 0103):
 * the Git state check, the uncommitted paths, the conflicts with the upgrade's footprint, the guard against changes between
 * planning and writing, and a commit that takes the footprint only. Nothing here commits, stashes, resets, cleans, checks out,
 * stages or unstages a path outside the footprint.
 */

export type UncommittedState = "staged" | "unstaged" | "partly_staged" | "untracked";
export interface Uncommitted { path: string; state: UncommittedState }
export type ConflictReason = "log" | "changed" | "collision" | "input" | "ignored";
export interface Conflict { path: string; state: UncommittedState | "ignored"; reason: ConflictReason; affects: string[]; resolution: string }
export interface UncommittedReport { conflicts: Conflict[]; unrelated: string[] }

export interface GitRun { stdout: Buffer; stderr: string }

/** Run Git in `cwd`, with `input` on stdin; rejects with Git's stderr as the message when it exits non-zero. */
export function git(cwd: string, args: readonly string[], options: { input?: Buffer | string; literal?: boolean } = {}): Promise<GitRun> {
  return new Promise((resolve, reject) => {
    const env = options.literal === true ? { ...process.env, GIT_LITERAL_PATHSPECS: "1" } : process.env;
    const child = spawn("git", args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stderr = Buffer.concat(err).toString("utf8");
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr });
      else reject(new GitFailure(args[0] ?? "git", stderr, Buffer.concat(out).toString("utf8")));
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input ?? "");
  });
}

export class GitFailure extends Error {
  readonly stderr: string;
  constructor(command: string, stderr: string, stdout: string) {
    const reason = firstLine(stderr) ?? firstLine(stdout) ?? `git ${command} failed`;
    super(reason);
    this.name = "GitFailure";
    this.stderr = stderr;
  }
}

function firstLine(text: string): string | undefined {
  return text.split(/\r?\n/).map((line) => line.trim()).find((line) => line !== "");
}

/** The brain's place in its repository: `null` when the brain isn't in a Git work tree. */
export interface GitContext {
  /** The brain folder relative to the work tree's top, with a trailing `/`, or `""` at the top. */
  prefix: string;
  ignoreCase: boolean;
  /** `HEAD`'s commit, or null on a branch with no commit yet. */
  head: string | null;
}

export async function gitContext(root: string): Promise<GitContext | null> {
  try {
    if ((await git(root, ["rev-parse", "--is-inside-work-tree"])).stdout.toString("utf8").trim() !== "true") return null;
  } catch {
    return null;
  }
  const prefix = (await git(root, ["rev-parse", "--show-prefix"])).stdout.toString("utf8").trim();
  let ignoreCase = false;
  try { ignoreCase = (await git(root, ["config", "--bool", "core.ignorecase"])).stdout.toString("utf8").trim() === "true"; } catch { /* unset: false */ }
  return { prefix, ignoreCase, head: await headCommit(root) };
}

export async function headCommit(root: string): Promise<string | null> {
  try { return (await git(root, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"])).stdout.toString("utf8").trim() || null; } catch { return null; }
}

/** The uncommitted paths of the brain (item 2), and whether Git holds an unmerged entry; `raw` keys each path's status entry. */
export interface StatusRead { entries: Uncommitted[]; unmerged: boolean; raw: Map<string, string> }

export async function readStatus(root: string, context: GitContext): Promise<StatusRead> {
  const { stdout } = await git(root, ["--no-optional-locks", "status", "--porcelain=v2", "-z", "--untracked-files=all", "--no-renames", "--", "."]);
  const fields = stdout.toString("utf8").split("\0");
  const entries: Uncommitted[] = [];
  const raw = new Map<string, string>();
  let unmerged = false;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    if (field === "") continue;
    const kind = field[0];
    let path: string;
    let state: UncommittedState;
    if (kind === "?") {
      path = field.slice(2);
      state = "untracked";
    } else if (kind === "1" || kind === "2" || kind === "u") {
      const skip = kind === "1" ? 8 : kind === "2" ? 9 : 10;
      path = afterSpaces(field, skip);
      if (kind === "2") index += 1; // the origin path; --no-renames should never print a rename
      if (kind === "u") unmerged = true;
      const staged = field[2] !== ".";
      const unstaged = field[3] !== ".";
      state = kind === "u" || (staged && unstaged) ? "partly_staged" : staged ? "staged" : "unstaged";
    } else continue;
    if (!path.startsWith(context.prefix)) continue; // outside the brain: never related
    const relative = path.slice(context.prefix.length);
    entries.push({ path: relative, state });
    raw.set(relative, field);
  }
  entries.sort((a, b) => compare(a.path, b.path));
  return { entries, unmerged, raw };
}

function afterSpaces(text: string, count: number): string {
  let at = 0;
  for (let seen = 0; seen < count; seen += 1) at = text.indexOf(" ", at) + 1;
  return text.slice(at);
}

/** Item 1: the Git operation in progress, in the contract's order, or "conflicts" for an unmerged entry alone; null when none. */
export async function gitOperation(root: string, unmerged: boolean): Promise<string | null> {
  const checks: Array<[string, string]> = [
    ["MERGE_HEAD", "merge"], ["CHERRY_PICK_HEAD", "cherry-pick"], ["REVERT_HEAD", "revert"],
    ["rebase-merge", "rebase"], ["rebase-apply", "rebase"], ["sequencer", "sequencer"], ["BISECT_LOG", "bisect"],
  ];
  for (const [name, operation] of checks) {
    const path = await gitPath(root, name);
    if (!existsSync(path)) continue;
    if (operation !== "sequencer") return operation;
    // A sequencer runs a multi-commit cherry-pick or revert: its todo list says which.
    const todo = await readFile(join(path, "todo"), "utf8").catch(() => "");
    return /^\s*revert\b/m.test(todo) ? "revert" : "cherry-pick";
  }
  return unmerged ? "conflicts" : null;
}

export function gitOperationMessage(operation: string): string {
  return operation === "conflicts"
    ? "Git has unresolved conflicts. Finish it or abort it, then run brain upgrade again."
    : `Git is in the middle of a ${operation}. Finish it or abort it, then run brain upgrade again.`;
}

async function gitPath(root: string, name: string): Promise<string> {
  const path = (await git(root, ["rev-parse", "--git-path", name])).stdout.toString("utf8").trim();
  return isAbsolute(path) ? path : join(root, path);
}

/** A path's bytes in `HEAD`, or null when `HEAD` doesn't hold it (or there is no commit yet). */
export async function headBytes(root: string, context: GitContext, path: string): Promise<Buffer | null> {
  if (context.head === null) return null;
  try { return (await git(root, ["cat-file", "blob", `${context.head}:${context.prefix}${path}`])).stdout; } catch { return null; }
}

/** The paths among `paths` that Git ignores and doesn't track (`git check-ignore`, which skips tracked files). */
export async function ignoredPaths(root: string, paths: readonly string[]): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  try {
    const { stdout } = await git(root, ["check-ignore", "-z", "--stdin"], { input: paths.map((path) => `${path}\0`).join("") });
    return new Set(stdout.toString("utf8").split("\0").filter((path) => path !== ""));
  } catch {
    return new Set(); // exit 1: none is ignored
  }
}

/** The index entries (`<mode> <object>`) of `paths`, keyed by path; a path the index doesn't hold is absent. */
export async function indexEntries(root: string, context: GitContext, paths: readonly string[]): Promise<Map<string, string>> {
  const entries = new Map<string, string>();
  if (paths.length === 0) return entries;
  // ls-files takes no pathspec file: literal pathspecs on the command line.
  const { stdout } = await git(root, ["ls-files", "-s", "-z", "--full-name", "--", ...paths], { literal: true });
  for (const line of stdout.toString("utf8").split("\0")) {
    if (line === "") continue;
    const tab = line.indexOf("\t");
    const [mode, object] = line.slice(0, tab).split(" ");
    const path = line.slice(tab + 1);
    if (path.startsWith(context.prefix)) entries.set(path.slice(context.prefix.length), `${mode} ${object}`);
  }
  return entries;
}

/** Item 8: put the index entries of `paths` back to `before` (a path absent from it is taken out of the index). */
export async function restoreIndex(root: string, context: GitContext, paths: readonly string[], before: Map<string, string>): Promise<void> {
  if (paths.length === 0) return;
  const zero = "0".repeat(40);
  const lines = paths.map((path) => `${before.get(path) ?? `0 ${zero}`}\t${context.prefix}${path}\0`).join("");
  // --index-info reads paths from the top of the work tree.
  await git(root, ["update-index", "-z", "--index-info"], { input: lines });
}

/** Item 7: stage the footprint's files alone and commit them on top of `HEAD`, leaving every other index entry as it was. */
export async function commitOnly(root: string, paths: readonly string[], message: string): Promise<void> {
  await git(root, ["add", "--all", "--pathspec-from-file=-", "--pathspec-file-nul"], { input: nul(paths), literal: true });
  await git(root, ["commit", "--only", "--quiet", "-m", message, "--pathspec-from-file=-", "--pathspec-file-nul"], { input: nul(paths), literal: true });
}

function nul(paths: readonly string[]): string {
  return paths.map((path) => `${path}\0`).join("");
}

/** Whether Git has a name and email to commit with here (`git var`, as `git commit` would read them). */
export async function hasIdentity(root: string): Promise<boolean> {
  try {
    await git(root, ["var", "GIT_AUTHOR_IDENT"]);
    await git(root, ["var", "GIT_COMMITTER_IDENT"]);
    return true;
  } catch {
    return false;
  }
}

/** What the upgrade would change: its files by action, the folders its writes create, and the moved concept endpoints. */
export interface Footprint {
  /** Path → `created`, `updated` or `removed`; the log file appears as `log`. */
  files: Map<string, "created" | "updated" | "removed" | "log">;
  folders: Set<string>;
  moved: Set<string>;
  log: string | null;
}

/** A generated file of the footprint and the uncommitted inputs that change its bytes (item 4); computed by the caller. */
export interface InputConflict { path: string; affects: string[] }

const VERBS = { created: "creates", updated: "replaces", removed: "removes" } as const;

/** Item 5: every uncommitted path is a conflict (the first reason that applies) or unrelated; ignored footprint files are conflicts too. */
export function compareUncommitted(
  uncommitted: readonly Uncommitted[],
  footprint: Footprint,
  inputs: ReadonlyMap<string, string[]>,
  ignored: ReadonlySet<string>,
  ignoreCase: boolean,
): UncommittedReport {
  const key = (path: string) => (ignoreCase ? path.toLowerCase() : path);
  const files = new Map([...footprint.files].map(([path, action]) => [key(path), { path, action }]));
  const all = [...footprint.files.keys(), ...footprint.folders];
  const conflicts: Conflict[] = [];
  const unrelated: string[] = [];
  for (const { path, state } of uncommitted) {
    const own = key(path);
    const file = files.get(own);
    let conflict: Pick<Conflict, "reason" | "affects" | "resolution"> | undefined;
    if (file?.action === "log") {
      conflict = { reason: "log", affects: [file.path], resolution: `Commit ${path} first: the upgrade adds its own line to it.` };
    } else if (file !== undefined) {
      const verb = footprint.moved.has(file.path) ? "moves" : VERBS[file.action as keyof typeof VERBS];
      conflict = { reason: "changed", affects: [file.path], resolution: `The upgrade ${verb} this file. Commit your change first (Git keeps your version), or move the file somewhere else.` };
    } else {
      const colliding = all.filter((other) => key(other).startsWith(`${own}/`) || (own.startsWith(`${key(other)}/`) && footprint.files.has(other))).sort(compare);
      if (colliding.length > 0) {
        conflict = { reason: "collision", affects: colliding, resolution: `The upgrade needs ${colliding[0]} here. Move this file somewhere else.` };
      } else {
        const affects = inputs.get(path);
        if (affects !== undefined && affects.length > 0) {
          conflict = { reason: "input", affects: [...affects].sort(compare), resolution: `${joinAnd([...affects].sort(compare))} ${affects.length === 1 ? "is" : "are"} built from this file. Commit your change first, or undo it.` };
        }
      }
    }
    if (conflict === undefined) unrelated.push(path);
    else conflicts.push({ path, state, ...conflict });
  }
  for (const path of ignored) {
    conflicts.push({ path, state: "ignored", reason: "ignored", affects: [path], resolution: "Your .gitignore ignores this file, so the upgrade can't commit it. Remove the rule that ignores it." });
  }
  conflicts.sort((a, b) => compare(a.path, b.path));
  unrelated.sort(compare);
  return { conflicts, unrelated };
}

function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The refusal's human text (item 5): its first line is also the error's message. */
export function conflictLines(report: UncommittedReport): string[] {
  const { conflicts, unrelated } = report;
  const lines = [`${plural(conflicts.length, "uncommitted file conflicts", "uncommitted files conflict")} with it.`];
  for (const conflict of conflicts) lines.push(`  ${conflict.path} (${conflict.state}): ${conflict.resolution}`);
  if (unrelated.length > 0) lines.push(`${plural(unrelated.length, "other uncommitted file is", "other uncommitted files are")} unrelated to the upgrade and would be left as they are.`);
  return lines;
}

export function leftAsTheyWere(count: number): string {
  return `Left as they were: ${plural(count, "uncommitted file", "uncommitted files")} unrelated to the upgrade (not in its commit).`;
}

/**
 * Item 6: a fingerprint of everything the upgrade plans from or writes: the product-owned files, the skill and sub-agent trees,
 * every note, the suppression records, the index and the log. Taken before planning and again just before the first write.
 */
export async function fingerprint(root: string, extra: readonly string[]): Promise<Map<string, string | null>> {
  const prints = new Map<string, string | null>();
  const add = async (path: string) => {
    if (prints.has(path)) return;
    try {
      const metadata = await lstat(join(root, path));
      prints.set(path, metadata.isFile() ? createHash("sha256").update(await readFile(join(root, path))).digest("hex") : metadata.isDirectory() ? "folder" : "other");
    } catch {
      prints.set(path, null);
    }
  };
  for (const path of ["AGENTS.md", "CLAUDE.md", ".gitignore", ".gitattributes", "brain.json", "skills.lock.json", ".claude/settings.json", "index.md", "log"]) await add(path);
  for (const folder of [".agents/skills", ".claude/skills", ".claude/agents", "_suppressions", "log", ...NOTE_FOLDERS]) {
    for (const path of await filesUnder(root, folder)) await add(path);
  }
  for (const path of extra) await add(path);
  return prints;
}

/** The first path whose fingerprint differs, in path order, or null. */
export function firstChange(before: ReadonlyMap<string, string | null>, after: ReadonlyMap<string, string | null>): string | null {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort(compare);
  return paths.find((path) => (before.get(path) ?? null) !== (after.get(path) ?? null)) ?? null;
}

async function filesUnder(root: string, folder: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    let entries;
    try { entries = await readdir(join(root, current), { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = `${current}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  }
  await visit(folder);
  return files;
}

export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
