import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseFrontmatter, type Frontmatter } from "./frontmatter.ts";

/** Folders whose `.md` files must all be notes (spec/cli.md §3.7). */
export const NOTE_FOLDERS = [
  "areas",
  "goals",
  "projects",
  "archive",
  "knowledge",
  "sources",
  "reports",
  "memories",
  "_proposals",
] as const;

export interface Note {
  /** Path relative to the brain root, forward slashes. */
  path: string;
  id: string;
  type: string;
  attributes: Frontmatter;
  body: string;
  /** The whole file as read (without a leading BOM). */
  raw: string;
}

export interface ScanProblem {
  path: string;
  code: "UNPARSEABLE" | "NOT_A_NOTE" | "UNREADABLE" | "SKIPPED_SYMLINK";
  message: string;
}

export interface ScanResult {
  /** Every readable note, sorted by path. */
  notes: Note[];
  problems: ScanProblem[];
}

/** Read every note in the brain. Never throws on content problems; reports them instead. */
export async function scanNotes(root: string): Promise<ScanResult> {
  const paths: string[] = [];
  const problems: ScanProblem[] = [];
  for (const folder of NOTE_FOLDERS) {
    await collectMarkdown(root, folder, paths, problems);
  }
  paths.sort(compareCodePoints);

  const notes: Note[] = [];
  for (const path of paths) {
    let source: string;
    try {
      source = await readFile(join(root, path), "utf8");
    } catch (error) {
      problems.push({ path, code: "UNREADABLE", message: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const parsed = parseNote(path, source);
    if ("code" in parsed) problems.push(parsed);
    else notes.push(parsed);
  }
  problems.sort((a, b) => compareCodePoints(a.path, b.path));
  return { notes, problems };
}

/** Parse one note file; a file that is not a readable note is reported as a problem. */
export function parseNote(path: string, source: string): Note | ScanProblem {
  if (source.startsWith("\uFEFF")) source = source.slice(1);
  if (!/^---\r?\n/.test(source)) return { path, code: "NOT_A_NOTE", message: "no frontmatter" };
  let attributes: Frontmatter;
  let body: string;
  try {
    ({ attributes, body } = parseFrontmatter(source));
  } catch (error) {
    return { path, code: "UNPARSEABLE", message: error instanceof Error ? error.message : String(error) };
  }
  const { type } = attributes;
  // A number or other scalar id is kept (as text) so lint reports id-format rather than "no id".
  const id = typeof attributes.id === "number" ? String(attributes.id) : attributes.id;
  if (typeof id !== "string" || id === "") return { path, code: "NOT_A_NOTE", message: "frontmatter has no id" };
  return { path, id, type: typeof type === "string" ? type : "", attributes, body, raw: source };
}

async function collectMarkdown(
  root: string,
  relative: string,
  out: string[],
  problems: ScanProblem[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(join(root, relative), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const child = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      problems.push({ path: child, code: "SKIPPED_SYMLINK", message: "symbolic links are not followed" });
    } else if (entry.isDirectory()) await collectMarkdown(root, child, out, problems);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(child);
  }
}

/** Compare strings by Unicode code points (not UTF-16 units, not locale). */
export function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left[index]!.codePointAt(0)! - right[index]!.codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}
