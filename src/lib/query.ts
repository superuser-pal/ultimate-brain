import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { bm25Scores } from "./bm25.ts";
import { readMarker } from "./brain-marker.ts";
import { isCjkTerm, withCjkNgrams } from "./cjk.ts";
import { BrainError } from "./errors.ts";
import { compareCodePoints, type Note } from "./notes.ts";

/** V1 note types accepted by `brain query --types` (spec/cli.md §5.13). */
export const QUERY_TYPES = [
  "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "source", "view", "memory", "proposal",
] as const;

type QueryType = typeof QUERY_TYPES[number];

const DEFAULT_TYPES = new Set<QueryType>(QUERY_TYPES.filter((type) => !["view", "proposal", "memory"].includes(type)));
/** §5.13 step 1's stopwords; reflection uses them for its terms (§5.32). */
export const QUERY_STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "did", "do", "does", "for", "from", "has", "have", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "we", "what", "when", "where", "which", "who", "why", "will", "with",
  "al", "como", "con", "de", "del", "el", "en", "es", "la", "las", "lo", "los", "para", "por", "que", "se", "su", "un", "una", "y",
]);

export interface QueryContext {
  repo: string | null;
  project: string | null;
  area: string | null;
}

export interface QuerySnippet {
  line: number;
  text: string;
}

export interface QueryCandidate {
  id: string;
  type: string;
  title: string | null;
  path: string;
  summary: string | null;
  lifecycle: string | null;
  assessment: string | null;
  date: string | null;
  /** A Document's origin (absent = `part`); only on a `reference` (decision 0071). */
  origin?: string;
  score: number;
  snippets: QuerySnippet[];
  /** The target of a `superseded_by` relation; only on a note that has one. */
  superseded_by?: string;
}

/** Normalize a query or field into its query words (spec/cli.md §5.13). */
export function queryWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !QUERY_STOPWORDS.has(word));
}

/** A query's or a field's terms: its words, then the n-grams of its CJK runs (spec/cli.md §5.13 step 1, "Terms"). */
export function queryTerms(value: string): string[] {
  return withCjkNgrams(value, queryWords);
}

/** Parse an explicit `--types` value, or select the contract's default search types. */
export function queryTypes(value: string | undefined): ReadonlySet<string> {
  if (value === undefined) return DEFAULT_TYPES;
  const types = value.split(",");
  if (types.some((type) => !QUERY_TYPES.includes(type as QueryType))) {
    throw new BrainError("USAGE", `--types must contain only: ${QUERY_TYPES.join(", ")}`);
  }
  return new Set(types);
}

/** Read `.brain` context from a consuming repository, without changing it. */
export async function queryContext(repoPath: string | undefined): Promise<QueryContext> {
  const root = repoPath === undefined ? process.cwd() : resolve(repoPath);
  let directory: boolean;
  try {
    directory = (await stat(root)).isDirectory();
  } catch {
    directory = false;
  }
  if (!directory) {
    if (repoPath === undefined) return { repo: null, project: null, area: null };
    throw new BrainError("USAGE", `--repo must be a directory: ${repoPath}`);
  }

  // One reader for the marker `link` writes (brain-marker.ts, CC-152): a `.brain` with a key §5.12 doesn't list is `USAGE` here.
  const read = await readMarker(root, "USAGE", `.brain in ${root}`);
  if (read === null) return { repo: null, project: null, area: null };
  const marker = read.value;
  return {
    repo: marker.repo ?? basename(root),
    project: marker.project ?? null,
    area: marker.area ?? null,
  };
}

/** Rank matching notes deterministically, including repository context (spec/cli.md §5.13 steps 2–5).
 *  `tokens` are the query's terms (`queryTerms`); the searched notes, after `eligible`, are BM25's documents. */
export function rankCandidates(
  notes: readonly Note[],
  tokens: readonly string[],
  types: ReadonlySet<string>,
  context: QueryContext,
  eligible?: (note: Note) => Note | null,
): QueryCandidate[] {
  const searched = notes
    .filter((note) => types.has(note.type))
    // Restricted evidence is neither scored nor quoted (capture-and-review §5.1); statements are blanked, not removed, so line numbers hold.
    .flatMap((note) => { const kept = eligible === undefined ? note : eligible(note); return kept === null ? [] : [kept]; });
  const scores = bm25Scores(searched.map(documentTerms), tokens, isCjkTerm);
  const ranked = searched
    .map((note, index) => ({ note, score: round4(scores[index]! + boost(note, context)) }))
    .filter((entry) => entry.score !== 0)
    .map(({ note, score }) => ({ candidate: candidateFor(note, tokens, score), updated: stringValue(note.attributes.updated) ?? "" }))
    .sort((left, right) => right.candidate.score - left.candidate.score
      || compareCodePoints(right.updated, left.updated)
      || compareCodePoints(left.candidate.id, right.candidate.id))
    .map((entry) => entry.candidate);
  return belowSuperseders(ranked);
}

/** Step 5, on the whole list before `--limit`: a note with a `superseded_by` relation moves to right after the note it names
 *  when that note ranks below it, until none moves. A relation on a cycle moves nothing, so the moves end: a note then moves
 *  at most once per note above it in its chain. */
function belowSuperseders(ranked: readonly QueryCandidate[]): QueryCandidate[] {
  const ids = new Set(ranked.map((candidate) => candidate.id));
  const next = new Map<string, string>();
  for (const candidate of ranked) if (candidate.superseded_by !== undefined && ids.has(candidate.superseded_by)) next.set(candidate.id, candidate.superseded_by);
  for (const id of [...next.keys()]) if (onCycle(id, next)) next.delete(id);
  const list = [...ranked];
  for (;;) {
    const at = new Map(list.map((candidate, index) => [candidate.id, index]));
    const from = list.findIndex((candidate, index) => next.has(candidate.id) && at.get(next.get(candidate.id)!)! > index);
    if (from === -1) return list;
    const [old] = list.splice(from, 1);
    list.splice(at.get(next.get(old!.id)!)!, 0, old!);
  }
}

function onCycle(start: string, next: ReadonlyMap<string, string>): boolean {
  const seen = new Set<string>();
  for (let id = next.get(start); id !== undefined && !seen.has(id); id = next.get(id)) {
    if (id === start) return true;
    seen.add(id);
  }
  return false;
}

/** One note as one document: title and aliases three times, summary twice, other frontmatter strings and the body once. */
function documentTerms(note: Note): string[] {
  const title = [...stringsOf([note.attributes.title]), ...stringsOf(note.attributes.aliases)].flatMap(queryTerms);
  const summary = stringsOf([note.attributes.summary]).flatMap(queryTerms);
  const other = otherFrontmatterStrings(note.attributes).flatMap(queryTerms);
  return [...title, ...title, ...title, ...summary, ...summary, ...other, ...queryTerms(note.body)];
}

function supersededBy(note: Note): string | null {
  const relations = Array.isArray(note.attributes.relations) ? note.attributes.relations as unknown[] : [];
  for (const relation of relations) {
    if (typeof relation !== "object" || relation === null) continue;
    const { type, target } = relation as Record<string, unknown>;
    if (type === "superseded_by" && typeof target === "string") return target;
  }
  return null;
}

/** Step 4: +3 for the context's project, else +2 for its area. */
function boost(note: Note, context: QueryContext): number {
  if (context.project !== null && (note.id === context.project || stringsOf(note.attributes.projects).includes(context.project))) return 3;
  if (context.area !== null && note.attributes.area === context.area) return 2;
  return 0;
}

/** Step 5: four decimal places, halves up (scores are never negative). */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function candidateFor(note: Note, tokens: readonly string[], score: number): QueryCandidate {
  const target = supersededBy(note);
  return {
    id: note.id,
    type: note.type,
    title: stringValue(note.attributes.title),
    path: note.path,
    summary: stringValue(note.attributes.summary),
    lifecycle: stringValue(note.attributes.lifecycle),
    assessment: stringValue(note.attributes.assessment),
    date: stringValue(note.attributes.date),
    ...(note.type === "reference" ? { origin: stringValue(note.attributes.origin) ?? "part" } : {}),
    score,
    snippets: snippets(note, tokens),
    ...(target === null ? {} : { superseded_by: target }),
  };
}

function snippets(note: Note, tokens: readonly string[]): QuerySnippet[] {
  const offset = note.raw.slice(0, note.raw.length - note.body.length).split(/\r?\n/).length;
  const found: QuerySnippet[] = [];
  for (const [index, text] of note.body.split(/\r?\n/).entries()) {
    const terms = queryTerms(text);
    if (!tokens.some((token) => matches(terms, token))) continue;
    found.push({ line: offset + index, text: text.trim().slice(0, 200) });
    if (found.length === 3) break;
  }
  return found;
}

function otherFrontmatterStrings(attributes: Record<string, unknown>): string[] {
  return Object.entries(attributes)
    .flatMap(([key, value]) => ["title", "aliases", "summary"].includes(key) ? [] : frontmatterStrings(value));
}

function frontmatterStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(frontmatterStrings);
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(frontmatterStrings);
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Step 3's matching: a word matches every term it starts, an n-gram only itself. */
function matches(terms: readonly string[], token: string): boolean {
  return isCjkTerm(token) ? terms.includes(token) : terms.some((term) => term.startsWith(token));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}


// --- `brain query --read` (spec/cli.md §5.13.1) ------------------------------------------------------------------------------

export type ReadNote =
  | { id: string; status: "withheld"; reason: "unknown" | "restricted" | "not_eligible" }
  | { id: string; status: "ok"; type: string; title: string | null; path: string; lifecycle: string | null; assessment: string | null; date: string | null;
      restricted: boolean; superseded_by?: string; frontmatter: Record<string, unknown>; body: string };

/** Parse `--read`: 1 to 20 distinct ids separated by commas; a repeated id is read once and counts once. */
export function readIds(value: string): string[] {
  const ids = [...new Set(value.split(",").map((id) => id.trim()))];
  if (ids.some((id) => id === "") || ids.length > 20) throw new BrainError("USAGE", "--read takes 1 to 20 note ids separated by commas");
  return ids;
}

/**
 * Each note in full, as retrieval may use it. `eligible` is the restricted-evidence rule (a note as it leaves it, or null);
 * `memories` holds the memories the caller may be shown. A proposal is never read: it may propose what its evidence no longer supports.
 */
export function readNotes(notes: readonly Note[], ids: readonly string[], eligible: (note: Note) => Note | null, memories: ReadonlyMap<string, Note>): ReadNote[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  return ids.map((id): ReadNote => {
    const note = byId.get(id);
    if (note === undefined) return { id, status: "withheld", reason: "unknown" };
    if (note.type === "proposal") return { id, status: "withheld", reason: "not_eligible" };
    const kept = note.type === "memory" ? memories.get(id) ?? null : eligible(note);
    if (kept === null) return { id, status: "withheld", reason: note.type === "memory" ? "not_eligible" : "restricted" };
    const target = supersededBy(note);
    return {
      id, status: "ok", type: note.type, title: stringValue(kept.attributes.title), path: note.path,
      lifecycle: stringValue(kept.attributes.lifecycle), assessment: stringValue(kept.attributes.assessment), date: stringValue(kept.attributes.date),
      restricted: kept !== note,
      ...(target === null ? {} : { superseded_by: target }),
      frontmatter: kept.attributes, body: kept.body,
    };
  });
}
