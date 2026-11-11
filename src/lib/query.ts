import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { bm25Scores } from "./bm25.ts";
import { readMarker } from "./brain-marker.ts";
import { isCjkTerm, withCjkNgrams } from "./cjk.ts";
import { BrainError } from "./errors.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { citeLabel, titleWithheld, type WithheldView } from "./suppressions.ts";

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
  /** `null`, like `title` and `summary`, in the awaiting-cleanup form (cli.md §5.13). */
  path: string | null;
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
  /** The label to cite a note in the awaiting-cleanup form by; only on such a note (eligibility.md §6 rules 3 and 4). */
  cite?: string;
  /** A memory's schema confidence; only on a memory `query --candidates` returns (cli.md §5.13). */
  confidence?: string;
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
    path: titleWithheld(note) ? null : note.path,
    summary: stringValue(note.attributes.summary),
    lifecycle: stringValue(note.attributes.lifecycle),
    assessment: stringValue(note.attributes.assessment),
    date: stringValue(note.attributes.date),
    ...(note.type === "reference" ? { origin: stringValue(note.attributes.origin) ?? "part" } : {}),
    score,
    snippets: snippets(note, tokens),
    ...(target === null ? {} : { superseded_by: target }),
    ...(titleWithheld(note) ? { cite: citeLabel(note) } : {}),
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

// --- English retrieval (0080; spec/cli.md §5.13 steps 1a, 3, 3a, snippets; spec/retrieval.md) --------------------------------
// `brain query --candidates` ranks with these; `brain recall` keeps rankCandidates above, unchanged (retrieval.md §1).

/** Step 3's vocabulary groups: general business English, printed in cli.md §5.13 (retrieval.md §4 C2, CC-204's map). */
export const VOCABULARY: readonly (readonly string[])[] = [
  ["budget", "money", "spend"],
  ["launch", "live"],
  ["approve", "sign"],
  ["release", "deployment", "deploy"],
  ["invoice", "bill"],
  ["backup", "copies"],
  ["conference", "talk"],
  ["sms", "text"],
  ["postpone", "move"],
  ["hourly", "hour"],
  ["designer", "design"],
  ["reply", "answer", "response"],
];

/** Step 1a: a word's stem (a–z only, 4 letters or more; anything else is kept as it is). */
export function stem(word: string): string {
  if (!/^[a-z]+$/.test(word) || word.length < 4) return word;
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (/(?:sses|xes|zes|ches|shes)$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  const vowel = (rest: string) => rest.length >= 3 && /[aeiouy]/.test(rest);
  if (w.endsWith("ing") && vowel(w.slice(0, -3))) w = undouble(w.slice(0, -3));
  else if (w.endsWith("ed") && w.length - 2 >= 4 && vowel(w.slice(0, -2))) w = undouble(w.slice(0, -2));
  if (w.length >= 5 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

function undouble(w: string): string {
  return /([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|zz)$/.test(w) ? w.slice(0, -1) : w;
}

/** A subject §3 says the answer should ask about: an eligible project, by its eligible title, or in the awaiting-cleanup form by
 *  type and id (`title` null, `cite` its label; eligibility.md §6 rule 3), as a candidate is shown. */
export interface UnresolvedSubject {
  id: string;
  type: string;
  title: string | null;
  cite?: string;
}

/** cli.md §5.13's `unresolved`: the closest five subjects, and how many more eligible ones also qualify. */
export interface Unresolved {
  subjects: UnresolvedSubject[];
  more: number;
}

/** BM25 (step 3) where each query item is a group of terms, built once per search so the full and the attribute sums (step
 *  3a) share one index. A one-term group gives bm25Scores's numbers: the same operations in the same order. With `norm`, each
 *  distinct word is stemmed once and the postings of words with one stem merged, which is stemming every occurrence. */
function bm25Index(docs: readonly (readonly string[])[], exact: (term: string) => boolean, norm: (term: string) => string) {
  const K1 = 1.5;
  const B = 0.75;
  const n = docs.length;
  const avg = docs.reduce((sum, terms) => sum + terms.length, 0) / (n || 1) || 1;
  const raw = new Map<string, Map<number, number>>();
  docs.forEach((terms, doc) => {
    for (const term of terms) {
      const key = norm(term);
      let counts = raw.get(key);
      if (counts === undefined) { counts = new Map(); raw.set(key, counts); }
      counts.set(doc, (counts.get(doc) ?? 0) + 1);
    }
  });
  const vocab = [...raw.keys()];
  const prefixed = new Map<string, string[]>();
  const words = (term: string): string[] => {
    let found = prefixed.get(term);
    if (found === undefined) { found = exact(term) ? (raw.has(term) ? [term] : []) : vocab.filter((word) => word.startsWith(term)); prefixed.set(term, found); }
    return found;
  };
  const cache = new Map<string, Float64Array>();
  const idfs = new Map<string, number>();
  const contribution = (group: readonly string[]): Float64Array => {
    const key = group.join("\u0000");
    const known = cache.get(key);
    if (known !== undefined) return known;
    const freq = new Float64Array(n);
    for (const word of new Set(group.flatMap(words))) for (const [doc, count] of raw.get(word)!) freq[doc] += count;
    let df = 0;
    for (const f of freq) if (f > 0) df++;
    const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
    idfs.set(key, idf);
    const weights = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const f = freq[i]!;
      if (f !== 0) weights[i] = (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * docs[i]!.length) / avg));
    }
    cache.set(key, weights);
    return weights;
  };
  const sum = (groups: readonly (readonly string[])[]): number[] => {
    const parts = groups.map(contribution);
    return docs.map((_, i) => { let score = 0; for (const part of parts) { const w = part[i]!; if (w !== 0) score += w; } return score; });
  };
  return Object.assign(sum, { idf: (group: readonly string[]): number => { contribution(group); return idfs.get(group.join("\u0000"))!; } });
}

type Bm25Sums = ReturnType<typeof bm25Index>;

/** Schema "memory"'s `confidence` values. */
const CONFIDENCE = new Set(["verified", "inferred", "unverified"]);

const SUBJECT_TYPES = new Set(["project", "area", "org", "person"]);
const LINKS = ["projects", "project", "area", "client", "org", "people", "attendees"];

function links(note: Note): string[] {
  return LINKS.flatMap((field) => { const value = note.attributes[field]; return typeof value === "string" ? [value] : stringsOf(value); });
}

interface SubjectName { id: string; type: string; words: string[] }

/** Step 3a's names: each eligible title and alias of a subject not in the awaiting-cleanup form, as stemmed words. */
function subjectNames(searched: readonly Note[], norm: (term: string) => string): SubjectName[] {
  return searched.filter((note) => SUBJECT_TYPES.has(note.type) && !titleWithheld(note)).flatMap((note) =>
    [...stringsOf([note.attributes.title]), ...stringsOf(note.attributes.aliases)]
      .map((name) => [...new Set(queryWords(name).map(norm))]).filter((words) => words.length > 0)
      .map((words) => ({ id: note.id, type: note.type, words })));
}

/** Step 3a's subject's notes, all among the searched notes, so nothing the rule withholds is added. */
function subjectNotes(ids: readonly string[], searched: readonly Note[], byId: ReadonlyMap<string, Note>): Set<string> {
  const related = new Set(ids.filter((id) => byId.has(id)));
  const linking = (targets: ReadonlySet<string>) => searched.filter((note) => links(note).some((id) => targets.has(id)));
  const first = linking(new Set(related));
  for (const note of first) related.add(note.id);
  const projects = new Set(first.filter((note) => note.type === "project").map((note) => note.id));
  if (projects.size > 0) for (const note of linking(projects)) related.add(note.id);
  for (const id of [...related]) {
    const note = byId.get(id)!;
    for (const source of [...stringsOf([note.attributes.source]), ...stringsOf(note.attributes.sources)]) if (byId.has(source)) related.add(source);
  }
  return related;
}

/**
 * `brain query --candidates`'s ranking (spec/cli.md §5.13 steps 1 to 5 with 1a and 3a, and its snippets), and the subjects an
 * unresolved question could mean (spec/retrieval.md §3). `tokens` are the query's terms (`queryTerms`); the searched notes are
 * those `eligible` leaves, before anything is counted. Snippets are written for the first 50 candidates, the most `--limit` returns.
 */
export function searchCandidates(
  notes: readonly Note[],
  tokens: readonly string[],
  types: ReadonlySet<string>,
  context: QueryContext,
  eligible?: (note: Note) => Note | null,
): { candidates: QueryCandidate[]; unresolved: Unresolved | null } {
  const searched = notes
    .filter((note) => types.has(note.type))
    .flatMap((note) => { const kept = eligible === undefined ? note : eligible(note); return kept === null ? [] : [kept]; });
  // Stems are cached for this search only.
  const stems = new Map<string, string>();
  const norm = (term: string): string => { let found = stems.get(term); if (found === undefined) { found = isCjkTerm(term) ? term : stem(term); stems.set(term, found); } return found; };
  const groups = tokens.map((token) => {
    const own = norm(token);
    if (isCjkTerm(token)) return [own];
    const group = VOCABULARY.find((words) => words.some((word) => norm(word) === own));
    return group === undefined ? [own] : [...new Set([own, ...group.map(norm)])];
  });
  const sums = bm25Index(searched.map(documentTerms), isCjkTerm, norm);
  const scores = sums(groups);
  const byId = new Map(searched.map((note) => [note.id, note]));

  // Step 3a: the subject the question names, else the context's project; its notes rank on the other terms twice.
  const words = new Set(tokens.filter((token) => !isCjkTerm(token)).map(norm));
  const names = subjectNames(searched, norm);
  const named = names.filter((name) => name.words.every((word) => words.has(word)));
  const specific = named.filter((name) => !named.some((other) => other.words.length > name.words.length && name.words.every((word) => other.words.includes(word))));
  const resolved = [...new Set(specific.map((name) => name.id))];
  if (resolved.length === 0 && context.project !== null && byId.has(context.project)) resolved.push(context.project);
  const subjectWords = new Set(specific.flatMap((name) => name.words));
  const attributes = groups.filter((group) => !subjectWords.has(group[0]!));
  const attributeScores = attributes.length > 0 ? sums(attributes) : searched.map(() => 0);
  const related = resolved.length > 0 ? subjectNotes(resolved, searched, byId) : new Set<string>();

  const ranked = searched
    .map((note, index) => {
      const subject = related.has(note.id) ? attributeScores[index]! : 0;
      return { note, score: round4(scores[index]! + subject + boost(note, context)) };
    })
    .filter((entry) => entry.score !== 0)
    .map(({ note, score }) => ({ candidate: candidateFor(note, [], score), updated: stringValue(note.attributes.updated) ?? "" }))
    .sort((left, right) => right.candidate.score - left.candidate.score
      || compareCodePoints(right.updated, left.updated)
      || compareCodePoints(left.candidate.id, right.candidate.id))
    .map((entry) => entry.candidate);
  const terms = groups.flat();
  const ordered = belowSuperseders(ranked);
  const candidates = ordered.map((candidate, rank) => {
    const note = byId.get(candidate.id)!;
    const shown = rank < 50 ? { ...candidate, snippets: searchSnippets(note, terms, groups, norm) } : candidate;
    // A memory's confidence, from the memory as the rule leaves it (cli.md §5.13), so an inferred one can be labelled.
    const confidence = note.type === "memory" ? note.attributes.confidence : undefined;
    return typeof confidence === "string" && CONFIDENCE.has(confidence) ? { ...shown, confidence } : shown;
  });
  return { candidates, unresolved: resolved.length > 0 ? null : unresolvedSubjects(searched, byId, names, words, groups, sums, ordered, context) };
}

/**
 * spec/retrieval.md §3 and cli.md §5.13's `unresolved`: with no subject resolved, the eligible projects the question could mean,
 * when two or more of them hold an attribute term. They are the projects one of whose names holds every name word the question
 * has (a word of some subject's name), or, when the question has none and the context names an area and no project, the area's
 * projects. Up to five, by the rank of their best note.
 */
function unresolvedSubjects(searched: readonly Note[], byId: ReadonlyMap<string, Note>, names: readonly SubjectName[], words: ReadonlySet<string>,
  groups: readonly (readonly string[])[], sums: Bm25Sums, ranked: readonly QueryCandidate[], context: QueryContext): Unresolved | null {
  const nameWords = new Set(names.flatMap((name) => name.words));
  const asked = [...words].filter((word) => nameWords.has(word));
  let open: string[];
  if (asked.length > 0) open = [...new Set(names.filter((name) => name.type === "project" && asked.every((word) => name.words.includes(word))).map((name) => name.id))];
  else if (context.project === null && context.area !== null) open = searched.filter((note) => note.type === "project" && note.attributes.area === context.area).map((note) => note.id);
  else return null;
  if (open.length < 2) return null;
  const attributes = groups.filter((group) => !asked.includes(group[0]!));
  if (attributes.length === 0) return null;
  // Each project's note matching the most of the question's attribute items, each item weighted by its idf (step 3), stands for
  // the project. The projects listed are the strongest one and those whose note holds at least half of the items its note holds:
  // a project that shares only a word or two of a longer request is not one the question could mean.
  const items = attributes.map((group) => ({ scores: sums([group]), weight: sums.idf(group) }));
  const at = new Map(searched.map((note, index) => [note.id, index]));
  const rank = new Map(ranked.map((candidate, index) => [candidate.id, index]));
  const held = open.flatMap((id) => {
    let covered = 0;
    let best = Infinity;
    let holds: number[] = [];
    for (const note of subjectNotes([id], searched, byId)) {
      const own = items.flatMap((item, index) => (item.scores[at.get(note)!]! > 0 ? [index] : []));
      const weight = own.reduce((total, index) => total + items[index]!.weight, 0);
      const place = rank.get(note) ?? Infinity;
      if (weight > covered || (weight === covered && place < best)) { covered = weight; best = place; holds = own; }
    }
    return covered > 0 ? [{ id, covered, best, holds }] : [];
  });
  const top = held.reduce<(typeof held)[number] | null>((most, entry) => (most === null || entry.covered > most.covered
    || (entry.covered === most.covered && (entry.best < most.best || (entry.best === most.best && compareCodePoints(entry.id, most.id) < 0))) ? entry : most), null);
  const found = top === null ? [] : held.filter((entry) => 2 * entry.holds.filter((index) => top.holds.includes(index)).length >= top.holds.length);
  if (found.length < 2) return null;
  const subjects = found.sort((a, b) => a.best - b.best || compareCodePoints(a.id, b.id)).slice(0, 5).map(({ id }) => {
    const note = byId.get(id)!;
    return titleWithheld(note) ? { id, type: note.type, title: null, cite: citeLabel(note) } : { id, type: note.type, title: stringValue(note.attributes.title) };
  });
  return { subjects, more: found.length - subjects.length };
}

/** cli.md §5.13's snippets: matching facts first (at most 2 while a body line matches), then the body lines that match the most
 *  query items, three in all, in line order, a long line shown around its first match. */
function searchSnippets(note: Note, terms: readonly string[], groups: readonly (readonly string[])[], norm: (term: string) => string): QuerySnippet[] {
  const lineTerms = (text: string) => queryTerms(text).map(norm);
  const hitWords = (words: readonly string[]) => terms.some((term) => matches(words, term));
  const offset = note.raw.slice(0, note.raw.length - note.body.length).split(/\r?\n/).length;
  const facts: QuerySnippet[] = [];
  const kept = note.attributes.facts;
  if (typeof kept === "object" && kept !== null && !Array.isArray(kept)) {
    const raw = note.raw.split(/\r?\n/);
    const factsAt = raw.findIndex((line) => /^facts:\s*$/.test(line));
    for (const [name, value] of Object.entries(kept)) {
      if (typeof value === "object" && value !== null) continue;
      if (!hitWords(lineTerms(`${name} ${String(value)}`))) continue;
      const at = raw.findIndex((line, index) => index > factsAt && new RegExp(`^\\s+${name.replace(/[^\w]/g, "\\$&")}:`).test(line));
      facts.push({ line: at + 1, text: `facts.${name}: ${String(value)}`.slice(0, 200) });
    }
  }
  const lines = note.body.split(/\r?\n/).flatMap((text, index) => {
    const words = lineTerms(text);
    if (!hitWords(words)) return [];
    return [{ index, text, items: groups.filter((group) => group.some((term) => matches(words, term))).length }];
  }).sort((a, b) => b.items - a.items || a.index - b.index);
  const factCount = Math.min(facts.length, lines.length > 0 ? 2 : 3);
  const body = lines.slice(0, 3 - factCount).sort((a, b) => a.index - b.index);
  return [...facts.slice(0, factCount), ...body.map(({ index, text }) => ({ line: offset + index, text: around(text.trim(), terms, norm) }))];
}

/** At most 200 characters of a line around its first matching word. */
function around(text: string, terms: readonly string[], norm: (term: string) => string): string {
  if (text.length <= 200) return text;
  const word = /[\p{L}\p{N}]+/gu;
  let start = 0;
  for (let m = word.exec(text); m !== null; m = word.exec(text)) {
    if (terms.some((term) => matches(queryTerms(m![0]).map(norm), term))) { start = m.index; break; }
  }
  if (start + 200 <= text.length && start < 80) return `${text.slice(0, 199)}…`;
  let from = Math.max(0, start - 80);
  const space = text.indexOf(" ", from);
  if (from > 0 && space !== -1 && space < start) from = space + 1;
  return `${from > 0 ? "…" : ""}${text.slice(from, from + 198)}${from + 198 < text.length ? "…" : ""}`.slice(0, 200);
}

// --- `brain query --read` (spec/cli.md §5.13.1) ------------------------------------------------------------------------------

export type ReadNote =
  | { id: string; status: "withheld"; reason: "unknown" | "restricted" | "not_eligible"; cause?: WithheldView["cause"]; rebuild?: WithheldView["rebuild"] }
  | { id: string; status: "ok"; type: string; title: string | null; path: string | null; cite?: string; lifecycle: string | null; assessment: string | null; date: string | null;
      restricted: boolean; superseded_by?: string; historical?: true; frontmatter: Record<string, unknown>; body: string };

/** Parse `--read`: 1 to 20 distinct ids separated by commas; a repeated id is read once and counts once. */
export function readIds(value: string): string[] {
  const ids = [...new Set(value.split(",").map((id) => id.trim()))];
  if (ids.some((id) => id === "") || ids.length > 20) throw new BrainError("USAGE", "--read takes 1 to 20 note ids separated by commas");
  return ids;
}

/**
 * Each note in full, as retrieval may use it. `eligible` is the restricted-evidence rule (a note as it leaves it, or null);
 * `memories` holds the memories the caller may be shown: the eligible ones, and with `--historical` also the superseded ones `recall
 * --include-superseded` returns, which are labelled `historical` (eligibility.md §5). A proposal is never read: it may propose what its
 * evidence no longer supports.
 */
export function readNotes(notes: readonly Note[], ids: readonly string[], eligible: (note: Note) => Note | null, memories: ReadonlyMap<string, Note>,
  viewWithheld?: (view: Note) => WithheldView | null): ReadNote[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  return ids.map((id): ReadNote => {
    const note = byId.get(id);
    if (note === undefined) return { id, status: "withheld", reason: "unknown" };
    if (note.type === "proposal") return { id, status: "withheld", reason: "not_eligible" };
    // A withheld view names why and what rebuilds it (§5.13.1, "Views"; eligibility.md §8 rule 6).
    const view = note.type === "view" ? viewWithheld?.(note) ?? null : null;
    if (view !== null) return { id, status: "withheld", reason: "restricted", cause: view.cause, rebuild: view.rebuild };
    const kept = note.type === "memory" ? memories.get(id) ?? null : eligible(note);
    if (kept === null) return { id, status: "withheld", reason: note.type === "memory" ? "not_eligible" : "restricted" };
    const target = supersededBy(note);
    const withheld = titleWithheld(kept);
    return {
      id, status: "ok", type: note.type, title: stringValue(kept.attributes.title), path: withheld ? null : note.path,
      ...(withheld ? { cite: citeLabel(kept) } : {}),
      lifecycle: stringValue(kept.attributes.lifecycle), assessment: stringValue(kept.attributes.assessment), date: stringValue(kept.attributes.date),
      restricted: kept !== note,
      ...(target === null ? {} : { superseded_by: target }),
      ...(note.type === "memory" && target !== null ? { historical: true as const } : {}),
      frontmatter: kept.attributes, body: kept.body,
    };
  });
}
