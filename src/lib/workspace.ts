import { existsSync } from "node:fs";
import { rmdir, unlink } from "node:fs/promises";
import { join, posix } from "node:path";

import type { Brain } from "./brain.ts";
import { BrainError } from "./errors.ts";
import { parseFrontmatter, serializeFrontmatter, type FrontmatterDocument } from "./frontmatter.ts";
import { atomicWriteFile, ensureDirectory } from "./fs-safe.ts";
import { lintBrain, type Issue } from "./lint.ts";
import { appendLog, type LogEntry } from "./log.ts";
import { compareCodePoints, parseNote, scanNotes, type Note, type ScanProblem } from "./notes.ts";

interface Staged {
  content: string;
  /** Bytes on disk before this command, or null for a new file. */
  original: string | null;
}

export interface Checkpoint {
  staged: Map<string, Staged>;
  notes: Map<string, Note>;
}

export interface CommitResult {
  created: string[];
  changed: string[];
}

/**
 * The brain as one command sees it: notes read from disk plus the writes the command has
 * staged. Writes are validated in memory (spec/cli.md §3.6.1) and land together on `commit`,
 * which restores every file it had touched if a write fails (§3.6.3).
 */
export class Workspace {
  readonly root: string;
  readonly config: Record<string, unknown>;
  private readonly problems: readonly ScanProblem[];
  private notesByPath: Map<string, Note>;
  private staged = new Map<string, Staged>();
  private baseline: Set<string> | undefined;

  private constructor(brain: Brain, notes: readonly Note[], problems: readonly ScanProblem[]) {
    this.root = brain.root;
    this.config = brain.config;
    this.problems = problems;
    this.notesByPath = new Map(notes.map((note) => [note.path, note]));
  }

  static async open(brain: Brain): Promise<Workspace> {
    const { notes, problems } = await scanNotes(brain.root);
    return new Workspace(brain, notes, problems);
  }

  /** Every note, staged writes included, sorted by path. */
  get notes(): Note[] {
    return [...this.notesByPath.values()].sort((a, b) => compareCodePoints(a.path, b.path));
  }

  /** The note with this id (the first by path if duplicated). */
  get(id: string): Note | undefined {
    return this.notes.find((note) => note.id === id);
  }

  ids(): Set<string> {
    return new Set(this.notes.map((note) => note.id));
  }

  /** Whether a file or folder exists at this brain-relative path, on disk or staged. */
  exists(path: string): boolean {
    if (this.staged.has(path)) return true;
    for (const staged of this.staged.keys()) if (staged.startsWith(`${path}/`)) return true;
    return existsSync(join(this.root, path));
  }

  /** A parsed, editable copy of a note; pass it to `save` after changing it. */
  edit(note: Note): FrontmatterDocument {
    return parseFrontmatter(note.raw);
  }

  save(path: string, document: FrontmatterDocument): void {
    this.write(path, serializeFrontmatter(document));
  }

  /** Stage a file. Its content must parse as a note. */
  write(path: string, content: string): void {
    const parsed = parseNote(path, content);
    if ("code" in parsed) throw new Error(`Refusing to stage ${path}: ${parsed.message}`);
    const previous = this.staged.get(path);
    const original = previous !== undefined ? previous.original : this.notesByPath.get(path)?.raw ?? null;
    if (original === content) this.staged.delete(path);
    else this.staged.set(path, { content, original });
    this.notesByPath.set(path, parsed);
  }

  checkpoint(): Checkpoint {
    return { staged: new Map(this.staged), notes: new Map(this.notesByPath) };
  }

  restore(checkpoint: Checkpoint): void {
    this.staged = new Map(checkpoint.staged);
    this.notesByPath = new Map(checkpoint.notes);
  }

  /** Paths whose content changed since the checkpoint, sorted. */
  changedSince(checkpoint: Checkpoint): string[] {
    return [...this.notesByPath.entries()]
      .filter(([path, note]) => checkpoint.notes.get(path)?.raw !== note.raw)
      .map(([path]) => path)
      .sort(compareCodePoints);
  }

  /** Paths with staged writes, sorted. */
  get changedPaths(): string[] {
    return [...this.staged.keys()].sort(compareCodePoints);
  }

  isNew(path: string): boolean {
    return this.staged.get(path)?.original === null;
  }

  /**
   * Lint errors that the staged writes introduce, anywhere in the brain (or only in `paths`):
   * errors that were there before the command are not counted, so an old problem never blocks
   * an unrelated change.
   */
  newErrors(paths?: Iterable<string>): Issue[] {
    this.baseline ??= new Set(this.lint(this.initialNotes(), new Set()).map(issueKey));
    const wanted = paths === undefined ? undefined : new Set(paths);
    return this.lint(this.notes, new Set(this.staged.keys()))
      .filter((issue) => (wanted === undefined || wanted.has(issue.path)) && !this.baseline!.has(issueKey(issue)));
  }

  /**
   * Write every staged file, then append `log` lines (spec/cli.md §3.9). If anything fails,
   * restore the files and remove the folders this commit created, then rethrow as INTERNAL, so
   * exit 10 always means nothing was kept (§3.4).
   */
  async commit(log: readonly LogEntry[] = [], now: Date = new Date()): Promise<CommitResult> {
    const done: Array<[string, Staged]> = [];
    const folders: string[] = [];
    try {
      for (const path of this.changedPaths) {
        const staged = this.staged.get(path)!;
        folders.push(...missingFolders(this.root, posix.dirname(path)));
        await ensureDirectory(this.root, posix.dirname(path));
        await atomicWriteFile(this.root, path, staged.content);
        done.push([path, staged]);
      }
      if (log.length > 0) await appendLog(this.root, now, log);
    } catch (error) {
      for (const [path, staged] of done.reverse()) {
        if (staged.original === null) await unlink(join(this.root, path)).catch(() => undefined);
        else await atomicWriteFile(this.root, path, staged.original).catch(() => undefined);
      }
      for (const folder of folders.reverse()) await rmdir(join(this.root, folder)).catch(() => undefined);
      if (error instanceof BrainError && error.code !== "INTERNAL") throw error;
      throw new BrainError("INTERNAL", `Write failed; restored the files already written: ${error instanceof Error ? error.message : String(error)}`);
    }
    const created = done.filter(([, staged]) => staged.original === null).map(([path]) => path);
    const changed = done.filter(([, staged]) => staged.original !== null).map(([path]) => path);
    this.staged.clear();
    return { created, changed };
  }

  private initialNotes(): Note[] {
    const notes: Note[] = [];
    for (const note of this.notesByPath.values()) {
      const staged = this.staged.get(note.path);
      if (staged === undefined) notes.push(note);
      else if (staged.original !== null) notes.push(parseNote(note.path, staged.original) as Note);
    }
    return notes.sort((a, b) => compareCodePoints(a.path, b.path));
  }

  private lint(notes: readonly Note[], pendingPaths: ReadonlySet<string>): Issue[] {
    return lintBrain({
      root: this.root,
      notes,
      problems: this.problems,
      brainConfig: this.config,
      indexMarkdown: undefined,
      pendingPaths,
    }).filter((issue) => issue.severity === "error");
  }
}

/** Folders on the way to `folder` that do not exist yet, outermost first. */
function missingFolders(root: string, folder: string): string[] {
  const missing: string[] = [];
  for (let current = folder; current !== "." && current !== "" && !existsSync(join(root, current)); current = posix.dirname(current)) {
    missing.unshift(current);
  }
  return missing;
}

function issueKey(issue: Issue): string {
  return `${issue.path}\u0000${issue.rule}\u0000${issue.message}`;
}
