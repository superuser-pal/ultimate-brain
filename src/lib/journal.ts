import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { readFile, rm, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { BrainError } from "./errors.ts";
import { atomicWriteFile, ensureDirectory } from "./fs-safe.ts";

// The write-ahead journal and recovery of capture-and-review §7.11 (cli §5.23, §5.24).

const exec = promisify(execFile);
const DIR = "_journal";

export interface JournalEntry { path: string; hash: string | null; new: boolean }
export interface Journal { op: string; written: string; entries: JournalEntry[] }

export const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
export const newOpId = (): string => `op-${randomBytes(4).toString("hex")}`;

/** Whether an unrecovered journal exists: every other command refuses until `brain recover` ran (§7.11). */
export function journalExists(root: string): boolean {
  try { return readdirSync(join(root, DIR)).some((name) => name.endsWith(".json")); } catch { return false; }
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

/** Refuses a tree that is not a Git work tree, or is dirty without a journal (`DIRTY_TREE`, §7.11). */
export async function assertCleanTree(root: string): Promise<void> {
  let status: string;
  try {
    await git(root, ["rev-parse", "--is-inside-work-tree"]);
    status = await git(root, ["status", "--porcelain"]);
  } catch {
    throw new BrainError("DIRTY_TREE", "The brain is not a Git work tree, so the operation cannot be journaled");
  }
  if (status.trim() !== "") throw new BrainError("DIRTY_TREE", "The brain has uncommitted changes and no journal: commit or discard them first");
}

export async function writeJournal(root: string, journal: Journal): Promise<void> {
  await ensureDirectory(root, DIR);
  await atomicWriteFile(root, `${DIR}/${journal.op}.json`, `${JSON.stringify(journal, null, 2)}\n`);
}

export async function removeJournal(root: string, op: string): Promise<void> {
  await unlink(join(root, DIR, `${op}.json`)).catch(() => undefined);
  if (!journalExists(root)) await rm(join(root, DIR), { recursive: true, force: true });
}

/** Commit the listed paths with the trailer `Op: <op>` (the durable link between the journal and the commit). */
export async function commitWithOp(root: string, op: string, paths: string[], subject: string): Promise<void> {
  await git(root, ["add", "--", ...paths]);
  await git(root, ["commit", "-m", `${subject}\n\nOp: ${op}`, "--only", "--", ...paths]);
}

async function commitExists(root: string, op: string): Promise<boolean> {
  try { return (await git(root, ["log", "-1", "--format=%H", `--grep=^Op: ${op}$`])).trim() !== ""; } catch { return false; }
}

export interface Recovered { op: string; action: "committed" | "restored" }

/** Recovery (§7.11): a journal whose `Op:` commit exists is deleted; otherwise each listed path goes back to the last commit and new paths are removed. Idempotent; the journal goes last. */
export async function recoverAll(root: string): Promise<Recovered[]> {
  const dir = join(root, DIR);
  if (!existsSync(dir)) return [];
  const done: Recovered[] = [];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".json")).sort()) {
    const journal = JSON.parse(await readFile(join(dir, name), "utf8")) as Journal;
    try {
      if (await commitExists(root, journal.op)) { await removeJournal(root, journal.op); done.push({ op: journal.op, action: "committed" }); continue; }
      for (const entry of journal.entries) {
        // Restore index and worktree to the last commit: after a failed `git commit` the path may be staged, and a plain
        // `git checkout -- <path>` would restore the staged version, not HEAD.
        if (entry.new) {
          await git(root, ["rm", "-q", "--cached", "--ignore-unmatch", "--", entry.path]);
          await rm(join(root, entry.path), { force: true });
          await pruneEmpty(root, dirname(entry.path));
        } else await git(root, ["restore", "--source=HEAD", "--staged", "--worktree", "--", entry.path]);
      }
      await removeJournal(root, journal.op);
      done.push({ op: journal.op, action: "restored" });
    } catch (error) {
      throw new BrainError("RECOVERY_NEEDED", `Recovery of ${journal.op} failed and the journal was kept: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return done;
}

async function pruneEmpty(root: string, folder: string): Promise<void> {
  for (let current = folder; current !== "." && current !== "" && current !== DIR; current = dirname(current)) {
    try { if (readdirSync(join(root, current)).length > 0) return; await rm(join(root, current), { recursive: false }); } catch { return; }
  }
}
