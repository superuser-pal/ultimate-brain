import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { BrainError } from "./errors.ts";
import { compareCodePoints, type Note } from "./notes.ts";

/** V1 note types accepted by `brain query --types` (spec/cli.md §5.13). */
export const QUERY_TYPES = [
  "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "source", "view", "memory", "proposal",
] as const;

type QueryType = typeof QUERY_TYPES[number];

const DEFAULT_TYPES = new Set<QueryType>(QUERY_TYPES.filter((type) => !["view", "proposal", "memory"].includes(type)));
const STOPWORDS = new Set([
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
  score: number;
  snippets: QuerySnippet[];
}

/** Normalize a query or field into its query words (spec/cli.md §5.13). */
export function queryWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
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

  let raw: string;
  try {
    raw = await readFile(join(root, ".brain"), "utf8");
  } catch {
    return { repo: null, project: null, area: null };
  }

  let marker: unknown;
  try {
    marker = JSON.parse(raw);
  } catch {
    throw new BrainError("USAGE", `.brain in ${root} is not valid JSON`);
  }
  if (!isMarker(marker)) throw new BrainError("USAGE", `.brain in ${root} has an invalid format`);
  return {
    repo: marker.repo ?? basename(root),
    project: marker.project ?? null,
    area: marker.area ?? null,
  };
}

/** Rank matching notes deterministically, including repository context. */
export function rankCandidates(
  notes: readonly Note[],
  tokens: readonly string[],
  types: ReadonlySet<string>,
  context: QueryContext,
): QueryCandidate[] {
  return notes
    .filter((note) => types.has(note.type))
    .map((note) => ({ candidate: candidateFor(note, tokens, context), updated: stringValue(note.attributes.updated) ?? "" }))
    .filter((entry): entry is { candidate: QueryCandidate; updated: string } => entry.candidate !== null)
    .sort((left, right) => right.candidate.score - left.candidate.score
      || compareCodePoints(right.updated, left.updated)
      || compareCodePoints(left.candidate.id, right.candidate.id))
    .map((entry) => entry.candidate);
}

function candidateFor(note: Note, tokens: readonly string[], context: QueryContext): QueryCandidate | null {
  const titleWords = wordsOf(note.attributes.title);
  const aliasWords = stringsOf(note.attributes.aliases).flatMap(queryWords);
  const summaryWords = wordsOf(note.attributes.summary);
  const otherWords = otherFrontmatterStrings(note.attributes).flatMap(queryWords);
  let score = 0;

  for (const token of tokens) {
    if (matches(titleWords, token) || matches(aliasWords, token)) score += 5;
    if (matches(summaryWords, token)) score += 3;
    if (matches(otherWords, token)) score += 2;
    score += Math.min(3, note.body.split(/\r?\n/).filter((line) => matches(queryWords(line), token)).length);
  }

  if (context.project !== null && (note.id === context.project || stringsOf(note.attributes.projects).includes(context.project))) {
    score += 3;
  } else if (context.area !== null && note.attributes.area === context.area) {
    score += 2;
  }
  if (score === 0) return null;

  return {
    id: note.id,
    type: note.type,
    title: stringValue(note.attributes.title),
    path: note.path,
    summary: stringValue(note.attributes.summary),
    lifecycle: stringValue(note.attributes.lifecycle),
    assessment: stringValue(note.attributes.assessment),
    date: stringValue(note.attributes.date),
    score,
    snippets: snippets(note, tokens),
  };
}

function snippets(note: Note, tokens: readonly string[]): QuerySnippet[] {
  const offset = note.raw.slice(0, note.raw.length - note.body.length).split(/\r?\n/).length;
  const found: QuerySnippet[] = [];
  for (const [index, text] of note.body.split(/\r?\n/).entries()) {
    if (!tokens.some((token) => matches(queryWords(text), token))) continue;
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

function wordsOf(value: unknown): string[] {
  return typeof value === "string" ? queryWords(value) : [];
}

function matches(words: readonly string[], token: string): boolean {
  return words.some((word) => word.startsWith(token));
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isMarker(value: unknown): value is { repo?: string; project?: string; area?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const marker = value as Record<string, unknown>;
  return Object.keys(marker).every((key) => ["repo", "project", "area", "stacks"].includes(key))
    && (marker.repo === undefined || typeof marker.repo === "string")
    && (marker.project === undefined || typeof marker.project === "string")
    && (marker.area === undefined || typeof marker.area === "string")
    && (marker.stacks === undefined || Array.isArray(marker.stacks));
}
