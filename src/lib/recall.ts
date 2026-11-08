import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { readMarker } from "./brain-marker.ts";
import { BrainError } from "./errors.ts";
import { kitBytesIfAny, kitProblems, KIT_FILE, parseKitBytes, type Kit, type TaskSource } from "./link-kit.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { queryTypes, queryWords, rankCandidates } from "./query.ts";
import { parseMarkdownTasks, readableLinesWithIndex, statusMap } from "./repo-tasks.ts";
import { contextFor, eligibleNote, type Loaded } from "./suppressions.ts";
import type { Context } from "./eligibility.ts";

// `brain recall` (spec/cli.md §5.33, spec/memory.md §2, §5, §6.1, decision 0074): computed from the files on every call, no cache (§7).

export interface RecallCaller { repo: string | null; project: string | null; area: string | null; stacks: string[] }

export interface PackMemory { id: string; text: string; scope: string; confidence: string; updated: string; path: string }
export interface SearchResult extends PackMemory { score: number; superseded_by?: string }
export interface WorkItem { task: string; title: string; status: string; stopped: string | null; source: string }

export interface Pack {
  caller: RecallCaller;
  budget: number;
  tokens: number;
  work: WorkItem[];
  memories: PackMemory[];
  omitted: { memories: number; work: number };
  work_unread: string | null;
  text: string;
}

export interface Search { caller: RecallCaller; query: string; tokens: number; results: SearchResult[] }

const TEXT_LIMIT = 300;
const NO_CALLER: RecallCaller = { repo: null, project: null, area: null, stacks: [] };

/** §5.2's estimate: one count over the whole text, LF separators included. */
export const estimateTokens = (text: string): number => Math.ceil(Buffer.byteLength(text, "utf8") / 3);

/** The caller folder (`--repo`, else the current directory) and its `.brain`, read by the reader every command shares (cli.md §5.13 step 4). */
export async function readCaller(repoPath: string | undefined): Promise<{ root: string; caller: RecallCaller }> {
  const root = repoPath === undefined ? process.cwd() : resolve(repoPath);
  let directory: boolean;
  try {
    directory = (await stat(root)).isDirectory();
  } catch {
    directory = false;
  }
  if (!directory) throw new BrainError("USAGE", `--repo must be a directory: ${repoPath ?? root}`);
  const read = await readMarker(root, "USAGE", `.brain in ${root}`);
  if (read === null) return { root, caller: { ...NO_CALLER } };
  const marker = read.value;
  return {
    root,
    caller: {
      repo: marker.repo ?? basename(root),
      project: marker.project ?? null,
      area: marker.area ?? null,
      stacks: (marker.stacks ?? []).filter((stack): stack is string => typeof stack === "string"),
    },
  };
}

const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const relationTarget = (note: Note, type: string): string | null => {
  const relations = Array.isArray(note.attributes.relations) ? note.attributes.relations as Array<Record<string, unknown>> : [];
  const found = relations.find((relation) => relation.type === type && typeof relation.target === "string");
  return found === undefined ? null : found.target as string;
};

/** The caller's areas for reach (§2.1): its own `area`, and its project's. */
function callerAreas(caller: RecallCaller, notes: readonly Note[]): string[] {
  const areas = caller.area === null ? [] : [caller.area];
  if (caller.project !== null) {
    const project = notes.find((note) => note.id === caller.project && note.type === "project");
    if (typeof project?.attributes.area === "string") areas.push(project.attributes.area);
  }
  return areas;
}

/** 0009's reach, default deny (§2.1); the level is the rank: project 0, area 1, stack 2, general 3. */
function reachLevel(note: Note, caller: RecallCaller, areas: readonly string[]): number | null {
  const a = note.attributes;
  switch (a.scope) {
    case "general": return 3;
    case "project": return caller.project !== null && list(a.projects).includes(caller.project) ? 0 : null;
    case "area": return list(a.areas).some((area) => areas.includes(area)) ? 1 : null;
    case "stack": return list(a.stacks).some((stack) => caller.stacks.includes(stack)) ? 2 : null;
    default: return null;
  }
}

/**
 * §2 rule 4's second half (cli.md §5.33): a memory whose `sources` all name notes the restricted-evidence rule leaves out has no support.
 * An id names that note, a source key the source notes with that `source_key`; an entry that names no note is not left out.
 */
function sourcesAllLeftOut(note: Note, byId: ReadonlyMap<string, Note>, byKey: ReadonlyMap<string, Note[]>, context: Context): boolean {
  const sources = list(note.attributes.sources);
  if (sources.length === 0) return false;
  return sources.every((entry) => {
    const named = byId.has(entry) ? [byId.get(entry)!] : (byKey.get(entry) ?? []);
    return named.length > 0 && named.every((cited) => eligibleNote(cited, context) === null);
  });
}

interface Candidate { note: Note; level: number; supersededBy: string | null }

/** The memories in the caller's reach that the restricted-evidence rule leaves in and their sources support (§2 rules 3 and 4), as that rule leaves them. */
function memoriesInReach(notes: readonly Note[], loaded: Loaded, caller: RecallCaller): Candidate[] {
  const context = contextFor(notes, loaded);
  const byId = new Map(notes.map((note) => [note.id, note]));
  const byKey = new Map<string, Note[]>();
  for (const note of notes) {
    if (note.type !== "source" || typeof note.attributes.source_key !== "string") continue;
    byKey.set(note.attributes.source_key, [...(byKey.get(note.attributes.source_key) ?? []), note]);
  }
  const areas = callerAreas(caller, notes);
  const found: Candidate[] = [];
  for (const note of notes) {
    if (note.type !== "memory") continue;
    const level = reachLevel(note, caller, areas);
    if (level === null) continue;
    const kept = eligibleNote(note, context);
    if (kept === null || sourcesAllLeftOut(note, byId, byKey, context)) continue;
    found.push({ note: kept, level, supersededBy: relationTarget(note, "superseded_by") });
  }
  return found;
}

/** §2: reviewed and not superseded, besides reach and evidence. */
const isEligible = (candidate: Candidate): boolean => candidate.note.attributes.lifecycle === "reviewed" && candidate.supersededBy === null;

/** §5.3: the summary as the rule leaves it, else the body's first paragraph; cut at a word boundary within 300 characters. */
export function memoryText(note: Note): string {
  const summary = typeof note.attributes.summary === "string" ? note.attributes.summary.trim() : "";
  return cutAtWord(summary !== "" ? summary : firstParagraph(note.body));
}

/** The first run of non-blank lines that are not headings; a heading ends a run that has started (§5.3). */
function firstParagraph(body: string): string {
  const lines: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || /^#{1,6}(\s|$)/.test(line)) {
      if (lines.length > 0) break;
      continue;
    }
    lines.push(line);
  }
  return lines.join(" ");
}

/** The first `limit` characters, counted in code points, so a surrogate pair is never split. */
const firstChars = (text: string, limit: number): string => Array.from(text).slice(0, limit).join("");

/** The longest run of whole words within 300 characters (code points); a first word longer than that is cut at 300. */
function cutAtWord(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= TEXT_LIMIT) return text;
  const head = chars.slice(0, TEXT_LIMIT).join("");
  if (/\s/.test(chars[TEXT_LIMIT]!)) return head.trim();
  const space = head.search(/\s\S*$/);
  return (space <= 0 ? head : head.slice(0, space)).trim();
}

function packMemory(note: Note): PackMemory {
  const a = note.attributes;
  return { id: note.id, text: memoryText(note), scope: String(a.scope), confidence: String(a.confidence), updated: String(a.updated ?? ""), path: note.path };
}

function memoryLine(memory: PackMemory): string {
  const label = memory.confidence === "inferred" || memory.confidence === "unverified" ? ` (${memory.confidence})` : "";
  return `- ${memory.text}${label}`;
}

// --- Work (§5.1 step 2) ------------------------------------------------------------------------------------------------------

/** The caller folder's active task rows, from a valid `tracked-in-repo` markdown kit, read from the working tree. */
export async function readWork(root: string, notes: readonly Note[], config: Record<string, unknown>): Promise<{ work: WorkItem[]; unread: string | null }> {
  const bytes = await kitBytesIfAny(root);
  if (bytes === null) return { work: [], unread: null };
  const read = parseKitBytes(bytes);
  // linked-repos.md §2's checks with the brain; no `/name` check, since the pack reads no `repos` entry.
  const problems = [...read.problems, ...(read.kit === null ? [] : await kitProblems(read.kit, { notes, config, repos: [] }))];
  if (problems.length > 0) return { work: [], unread: KIT_FILE };
  const kit = read.kit as Kit;
  const source = kit.tasks?.source;
  if (kit.tasks?.mode !== "tracked-in-repo" || source?.kind !== "markdown") return { work: [], unread: null };
  let text: string;
  try {
    text = await readFile(join(root, source.path), "utf8");
  } catch {
    return { work: [], unread: source.path };
  }
  return { work: activeItems(text, source, statusMap(kit)), unread: null };
}

function activeItems(text: string, source: Extract<TaskSource, { kind: "markdown" }>, map: ReturnType<typeof statusMap>): WorkItem[] {
  const items = parseMarkdownTasks(text, source, map);
  const lines = readableLinesWithIndex(text);
  // A readable line is an item when the source's parser reads it as one alone; in file order, these are `items`.
  const isItem = lines.map((entry) => parseMarkdownTasks(entry.line, source, map).length === 1);
  const itemPositions = lines.flatMap((_, position) => isItem[position] ? [position] : []);
  const work: WorkItem[] = [];
  items.forEach((item, index) => {
    if (item.meaning !== "in_progress" && item.meaning !== "review") return;
    work.push({ task: item.key, title: item.title, status: item.raw, stopped: stoppedLine(lines, isItem, itemPositions[index]!), source: source.path });
  });
  return work;
}

/** The first line after the item's, before the next item or heading, that starts with `**Stopped:**` (§5.1). */
function stoppedLine(lines: ReadonlyArray<{ line: string }>, isItem: readonly boolean[], position: number): string | null {
  for (let next = position + 1; next < lines.length; next += 1) {
    const line = lines[next]!.line;
    if (isItem[next] || /^#{1,6}\s/.test(line)) return null;
    if (line.startsWith("**Stopped:**")) return firstChars(line.slice("**Stopped:**".length).trim(), TEXT_LIMIT).trim();
  }
  return null;
}

function workLine(item: WorkItem): string {
  return `- Work ${item.task} (${item.status}): ${item.title}${item.stopped === null ? "" : ` — stopped: ${item.stopped}`}`;
}

// --- The pack (§5) and the search (§6.1) -------------------------------------------------------------------------------------

function framing(caller: RecallCaller): string {
  if (caller.repo === null) return "Brain context for this folder.";
  return caller.project === null ? `Brain context for ${caller.repo}.` : `Brain context for ${caller.repo} (${caller.project}).`;
}

/** Distinct task tokens equal to a token of the memory's text (§5.4). */
function overlap(taskTokens: ReadonlySet<string>, text: string): number {
  return new Set(queryWords(text).filter((word) => taskTokens.has(word))).size;
}

export interface PackInput {
  notes: readonly Note[];
  loaded: Loaded;
  caller: RecallCaller;
  work: { work: WorkItem[]; unread: string | null };
  budget: number;
  task?: string;
}

export function buildPack(input: PackInput): Pack {
  const taskTokens = input.task === undefined ? null : new Set(queryWords(input.task));
  const ranked = memoriesInReach(input.notes, input.loaded, input.caller)
    .filter(isEligible)
    .map((candidate) => ({ candidate, memory: packMemory(candidate.note) }))
    .map((entry) => ({ ...entry, relevance: taskTokens === null ? 0 : overlap(taskTokens, entry.memory.text) }))
    .sort((left, right) => left.candidate.level - right.candidate.level
      || right.relevance - left.relevance
      || compareCodePoints(right.memory.updated, left.memory.updated)
      || compareCodePoints(left.memory.id, right.memory.id))
    .map((entry) => entry.memory);

  const lines = [framing(input.caller)];
  const fits = (line: string): boolean => estimateTokens([...lines, line].join("\n")) <= input.budget;
  const work: WorkItem[] = [];
  const memories: PackMemory[] = [];
  const omitted = { memories: 0, work: 0 };
  for (const item of input.work.work) {
    const line = workLine(item);
    if (fits(line)) { lines.push(line); work.push(item); } else omitted.work += 1;
  }
  for (const memory of ranked) {
    const line = memoryLine(memory);
    if (fits(line)) { lines.push(line); memories.push(memory); } else omitted.memories += 1;
  }
  // The framing line is never delivered alone (§5.3).
  const text = lines.length === 1 ? "" : lines.join("\n");
  return { caller: input.caller, budget: input.budget, tokens: estimateTokens(text), work, memories, omitted, work_unread: input.work.unread, text };
}

/** A sentinel `area` that yields no query token, so §5.13 step 4's area boost reads a memory's `areas` (§6.1). */
const AREA_MATCH = "\u0000";
const MEMORY_TYPES = queryTypes("memory");

/** Rank memories with §5.13's scoring; the boost: +3 for the caller's project in `projects`, else +2 for one of its areas in `areas`. */
function scored(candidates: readonly Candidate[], query: string, caller: RecallCaller, areas: readonly string[]): SearchResult[] {
  const byId = new Map(candidates.map((candidate) => [candidate.note.id, candidate]));
  const notes = candidates.map(({ note }) => {
    const attributes = { ...note.attributes };
    delete attributes.area;
    if (list(note.attributes.areas).some((area) => areas.includes(area))) attributes.area = AREA_MATCH;
    return { ...note, attributes };
  });
  return rankCandidates(notes, queryWords(query), MEMORY_TYPES, { repo: caller.repo, project: caller.project, area: AREA_MATCH })
    .map((candidate) => {
      const found = byId.get(candidate.id)!;
      const result: SearchResult = { ...packMemory(found.note), score: candidate.score };
      if (found.supersededBy !== null) result.superseded_by = found.supersededBy;
      return result;
    });
}

export function searchMemories(notes: readonly Note[], loaded: Loaded, caller: RecallCaller, query: string, limit: number, includeSuperseded: boolean): Search {
  const inReach = memoriesInReach(notes, loaded, caller);
  const areas = callerAreas(caller, notes);
  const eligible = scored(inReach.filter(isEligible), query, caller, areas);
  const superseded = includeSuperseded
    ? scored(inReach.filter((candidate) => candidate.supersededBy !== null && candidate.note.attributes.lifecycle !== "draft"), query, caller, areas)
    : [];
  const results = [...eligible, ...superseded].slice(0, limit);
  return { caller, query, tokens: estimateTokens(results.map((result) => result.text).join("\n")), results };
}
