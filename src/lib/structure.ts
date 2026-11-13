/**
 * The structure block of the brain's AGENTS.md (decision 0089, spec/cli.md §5.8.1): the Domains, Areas and active Projects, written by
 * `brain index` and `brain upgrade` so every session knows where things go.
 */
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

import { modulesOf } from "./modules.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { STYLE_END, STYLE_START } from "./style.ts";
import { titleWithheld } from "./suppressions.ts";

export const STRUCTURE_START = "<!-- ultimate-brain:structure:start -->";
export const STRUCTURE_END = "<!-- ultimate-brain:structure:end -->";
const RULES_START = /^<!-- ultimate-brain:rules:start\b[^\n]*-->$/gm;
const RULES_END = "<!-- ultimate-brain:rules:end -->";

const INTRO = "Written by `brain index` from your Domain, Area and Project notes (active Projects only); edits inside this block are overwritten. Use it to place what you write. It never authorises a new Domain, Area or Project, and it is not a source for an answer.";
const LOOKUP = "For what belongs to an Area or a Project, read its brief: find it with `brain query --candidates \"<its title>\" --types view --json` and read it with `brain query --read <id> --json`. For its tasks, query the Notion Tasks database filtered by its Notion page id, every time: never act on a task list from an earlier session.";

export type StructureAction = "created" | "updated" | "removed" | "unchanged";

/**
 * The structure block for `notes` (in the form `index.md` uses: the caller passes `indexNotes(...)`), without a trailing newline, or
 * `undefined` when nothing is listed (§5.8.1 "No block").
 */
export function structureBlock(notes: readonly Note[], config: Record<string, unknown>): string | undefined {
  const domainsOn = modulesOf(config).domains;
  const seen = new Set<string>();
  // A duplicate id keeps the first by path order, as the index does.
  const unique = notes.filter((note) => !seen.has(note.id) && seen.add(note.id));
  const domains = domainsOn ? sorted(unique.filter((note) => note.type === "domain" && live(note))) : [];
  const areas = sorted(unique.filter((note) => note.type === "area" && live(note)));
  const projects = sorted(unique.filter((note) => note.type === "project" && live(note) && activeOrUnsynced(note)));
  if (domains.length === 0 && areas.length === 0 && projects.length === 0) return undefined;

  const domainIds = new Set(domains.map((note) => note.id));
  const areaIds = new Set(areas.map((note) => note.id));
  const projectsOf = (area: string) => projects.filter((project) => project.attributes.area === area);
  const areaLines = (list: readonly Note[], indent: string) => list.flatMap((area) => [
    `${indent}${entry(area)}`,
    ...projectsOf(area.id).map((project) => `${indent}  ${entry(project)}`),
  ]);

  const lines: string[] = [];
  if (domainsOn) {
    for (const domain of domains) {
      lines.push(entry(domain), ...areaLines(areas.filter((area) => area.attributes.domain === domain.id), "  "));
    }
    const homeless = areas.filter((area) => typeof area.attributes.domain !== "string" || !domainIds.has(area.attributes.domain));
    if (homeless.length > 0) lines.push("- No domain", ...areaLines(homeless, "  "));
  } else {
    lines.push(...areaLines(areas, ""));
  }
  const orphans = projects.filter((project) => typeof project.attributes.area !== "string" || !areaIds.has(project.attributes.area));
  if (orphans.length > 0) lines.push("- No area", ...orphans.map((project) => `  ${entry(project)}`));

  return [STRUCTURE_START, "## Your structure", "", INTRO, "", ...lines, "", LOOKUP, STRUCTURE_END].join("\n");
}

/**
 * `text` (the brain's AGENTS.md) with its structure block written, replaced or removed (§5.8.1 "Where"), or `undefined` when the rules,
 * style or structure markers are missing, out of order or duplicated.
 */
export function withStructureBlock(text: string, block: string | undefined): { text: string; action: StructureAction } | undefined {
  const rulesStarts = [...text.matchAll(RULES_START)].map((match) => match.index!);
  const rulesEnds = lineStarts(text, RULES_END);
  if (rulesStarts.length !== 1 || rulesEnds.length !== 1 || rulesEnds[0]! < rulesStarts[0]!) return undefined;
  let after = rulesEnds[0]! + RULES_END.length;
  const styleStarts = lineStarts(text, STYLE_START);
  const styleEnds = lineStarts(text, STYLE_END);
  if (styleStarts.length > 1 || styleEnds.length > 1 || styleStarts.length !== styleEnds.length) return undefined;
  if (styleStarts.length === 1) {
    if (styleStarts[0]! < after || styleEnds[0]! < styleStarts[0]!) return undefined;
    after = styleEnds[0]! + STYLE_END.length;
  }
  const starts = lineStarts(text, STRUCTURE_START);
  const ends = lineStarts(text, STRUCTURE_END);
  if (starts.length > 1 || ends.length > 1 || starts.length !== ends.length) return undefined;

  if (starts.length === 0) {
    if (block === undefined) return { text, action: "unchanged" };
    return { text: `${text.slice(0, after)}\n\n${block}${text.slice(after)}`, action: "created" };
  }
  const start = starts[0]!;
  const end = ends[0]! + STRUCTURE_END.length;
  if (end < start || start < after) return undefined;
  if (block !== undefined) {
    const next = `${text.slice(0, start)}${block}${text.slice(end)}`;
    return { text: next, action: next === text ? "unchanged" : "updated" };
  }
  // Remove the block's lines and the one blank line before its start marker.
  const blankBefore = text.slice(0, start).endsWith("\n\n");
  if (text[end] === "\n") return { text: `${text.slice(0, blankBefore ? start - 1 : start)}${text.slice(end + 1)}`, action: "removed" };
  return { text: `${text.slice(0, blankBefore ? start - 2 : start)}${text.slice(end)}`, action: "removed" };
}

export interface PlannedStructure {
  /** The current AGENTS.md bytes, or null when it is missing or a symbolic link. */
  before: string | null;
  /** The planned bytes, or undefined when the block can't be written (`skipped`). */
  after: string | undefined;
  action: StructureAction | "skipped";
  /** A skip that matters: there was a block to write or remove (warning `AGENTS_BLOCK_NOT_FOUND`). */
  warn: boolean;
}

/** What `brain index` would do to the structure block of `root/AGENTS.md` (§5.8.1). */
export async function planStructure(root: string, notes: readonly Note[], config: Record<string, unknown>): Promise<PlannedStructure> {
  const symlink = await isSymlink(join(root, "AGENTS.md"));
  return planStructureText(await readAgentsMarkdown(root), structureBlock(notes, config), symlink);
}

/**
 * The plan for known AGENTS.md bytes (null: missing or a symbolic link). A missing file is skipped quietly (`brain upgrade` creates it);
 * a symbolic link or bad markers warn when there is a block to write or remove.
 */
export function planStructureText(before: string | null, block: string | undefined, symlink = false): PlannedStructure {
  if (before === null) return { before, after: undefined, action: "skipped", warn: symlink && block !== undefined };
  const written = withStructureBlock(before, block);
  if (written === undefined) {
    const hasBlock = lineStarts(before, STRUCTURE_START).length > 0 || lineStarts(before, STRUCTURE_END).length > 0;
    return { before, after: undefined, action: "skipped", warn: block !== undefined || hasBlock };
  }
  return { before, after: written.text, action: written.action, warn: false };
}

/** Whether `brain index` would change the block: a file it would skip is not stale (§5.8.1 "Stale"). */
export function structureStale(plan: PlannedStructure): boolean {
  return plan.action !== "unchanged" && plan.action !== "skipped";
}

/** The brain's AGENTS.md bytes, or null when it is missing or a symbolic link (§5.8.1 "Not written"). */
export async function readAgentsMarkdown(root: string): Promise<string | null> {
  const path = join(root, "AGENTS.md");
  if (await isSymlink(path)) return null;
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EISDIR")) return null;
    throw error;
  }
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

function live(note: Note): boolean {
  const notionFields = note.attributes.notion_fields;
  const archived = typeof notionFields === "object" && notionFields !== null && (notionFields as Record<string, unknown>).archived === true;
  return note.attributes.lifecycle !== "archived" && !archived;
}

function activeOrUnsynced(project: Note): boolean {
  const notionFields = project.attributes.notion_fields;
  const status = typeof notionFields === "object" && notionFields !== null ? (notionFields as Record<string, unknown>).status : undefined;
  return status === undefined || status === null || status === "Active";
}

function entry(note: Note): string {
  const notion = typeof note.attributes.notion === "string" && note.attributes.notion !== "" ? ` · Notion ${note.attributes.notion}` : "";
  return `- ${titleWithheld(note) ? "(title withheld: awaiting cleanup)" : oneLine(String(note.attributes.title ?? ""))} — ${note.id}${notion}`;
}

function sorted(notes: readonly Note[]): Note[] {
  const key = (note: Note) => (titleWithheld(note) ? "" : String(note.attributes.title ?? "")).normalize("NFC").toLowerCase();
  return [...notes].sort((a, b) => compareCodePoints(key(a), key(b)) || compareCodePoints(a.id, b.id));
}

function oneLine(value: string): string {
  return value.replace(/[ \t]*(?:\r\n|\r|\n)[ \t]*/g, " ").trim();
}

/** The offsets of the lines that are exactly `marker`. */
function lineStarts(text: string, marker: string): number[] {
  const out: number[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    if (line === marker) out.push(at);
    at += line.length + 1;
  }
  return out;
}
