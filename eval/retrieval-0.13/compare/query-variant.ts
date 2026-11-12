// CC-204's comparison variant of src/lib/query.ts (spec/retrieval.md §4). It is src/lib/query.ts as of the commit this file was
// copied at, plus the changes C1 to C4, each off unless UB_RETRIEVAL_VARIANT names it (a comma list: C1, C2w, C2v, C3, C3d, C3a,
// C4; C2 = C2w,C2v; C0 = this path with every change off). With none named, rankCandidates runs the code above unchanged: compare/run.mjs checks the output is the
// same bytes as the product's. compare/checkout.mjs copies this file over src/lib/query.ts in a temporary checkout; it is never
// part of the product. Recall's memory ranking (types = memory only) always takes the unchanged path (spec/retrieval.md §1).
import { stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { bm25Scores } from "./bm25.ts";
import { readMarker } from "./brain-marker.ts";
import { isCjkTerm, withCjkNgrams } from "./cjk.ts";
import { BrainError } from "./errors.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { citeLabel, titleWithheld, type WithheldView } from "./suppressions.ts";
import { VOCABULARY } from "./vocabulary.ts";

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
  const flags = variantFlags(types);
  if (flags !== null) {
    // Snippets only for the first 50 (the most --limit returns), after the order is final; the rest are never shown.
    const { list, snippetsOf } = rankVariant(searched, tokens, context, flags);
    return belowSuperseders(list).map((candidate, rank) => (rank < 50 ? { ...candidate, snippets: snippetsOf(candidate.id) } : candidate));
  }
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

// --- CC-204's variants (spec/retrieval.md §4) -------------------------------------------------------------------------------

interface Flags { c1: boolean; c2w: boolean; c2v: boolean; c3: boolean; c3d: boolean; c3a: boolean; c4: boolean }
const VARIANTS = ["C0", "C1", "C2w", "C2v", "C3", "C3d", "C3a", "C4"]; // C0: the variant path with every change off (a self-check)

/** The variant named by UB_RETRIEVAL_VARIANT, or null for the unchanged ranking (none named, or recall's memory-only ranking). */
function variantFlags(types: ReadonlySet<string>): Flags | null {
  const named = (process.env.UB_RETRIEVAL_VARIANT ?? "").split(",").map((name) => name.trim()).filter(Boolean)
    .flatMap((name) => (name === "C2" ? ["C2w", "C2v"] : [name]));
  if (named.length === 0 || (types.size === 1 && types.has("memory"))) return null;
  for (const name of named) if (!VARIANTS.includes(name)) throw new Error(`UB_RETRIEVAL_VARIANT: unknown change ${name}`);
  const has = (name: string) => named.includes(name);
  return { c1: has("C1"), c2w: has("C2w"), c2v: has("C2v"), c3: has("C3"), c3d: has("C3d"), c3a: has("C3a"), c4: has("C4") };
}

/** C2w: a deterministic English suffix rule, applied alike to the note's and the question's words (never to digits or n-grams). */
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

/** The note's terms: documentTerms, plus (C1) its kept facts' names and non-text values and its timeline's non-text values. */
function variantDocumentTerms(note: Note, flags: Flags): string[] {
  const terms = documentTerms(note);
  if (flags.c1) {
    const facts = note.attributes.facts;
    if (typeof facts === "object" && facts !== null && !Array.isArray(facts)) {
      for (const [name, value] of Object.entries(facts)) {
        terms.push(...queryTerms(name));
        if (typeof value === "number" || typeof value === "boolean") terms.push(...queryTerms(String(value)));
      }
    }
    // A replaced timeline value stays timeline text only: its value is searched, its field name is not (§4 C1, §2.3).
    const timeline = Array.isArray(note.attributes.timeline) ? note.attributes.timeline as unknown[] : [];
    for (const entry of timeline) {
      const value = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>).value : undefined;
      if (typeof value === "number" || typeof value === "boolean") terms.push(...queryTerms(String(value)));
    }
  }
  return terms;
}

/** A query term and, with C2v, the other words of its vocabulary group, each normalised as the notes' words are. */
function queryGroup(term: string, norm: (term: string) => string, flags: Flags): string[] {
  const own = norm(term);
  if (!flags.c2v || isCjkTerm(term)) return [own];
  const group = VOCABULARY.find((words) => words.some((word) => norm(word) === own));
  return group === undefined ? [own] : [...new Set([own, ...group.map(norm)])];
}

/** BM25 (bm25.ts's constants and formula) where each query item is a group of terms: its frequency in a document is the
 *  sum over every document word that any member matches, its df the documents with any. A one-term group is bm25Scores
 *  (the same floating-point operations in the same order). Built once per search: `contribution(group)` is each document's
 *  term weight for that group, so the full score and the attribute score (C3) share one index. */
function bm25Index(docs: readonly (readonly string[])[], exact: (term: string) => boolean, norm: ((term: string) => string) | null = null) {
  const K1 = 1.5;
  const B = 0.75;
  const n = docs.length;
  const avg = docs.reduce((sum, terms) => sum + terms.length, 0) / (n || 1) || 1;
  const postings = new Map<string, { doc: number; count: number }[]>();
  docs.forEach((terms, doc) => {
    const tf = new Map<string, number>();
    for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
    for (const [term, count] of tf) { let list = postings.get(term); if (list === undefined) { list = []; postings.set(term, list); } list.push({ doc, count }); }
  });
  // C2w: each distinct word is stemmed once and the postings of words with one stem are merged, which is the same as
  // stemming every occurrence (a stem's frequency in a document is the sum of its words'); the documents' lengths don't change.
  if (norm !== null) {
    const merged = new Map<string, Map<number, number>>();
    for (const [word, list] of postings) {
      const key = norm(word);
      let into = merged.get(key);
      if (into === undefined) { into = new Map(); merged.set(key, into); }
      for (const { doc, count } of list) into.set(doc, (into.get(doc) ?? 0) + count);
    }
    postings.clear();
    for (const [key, into] of merged) postings.set(key, [...into].map(([doc, count]) => ({ doc, count })));
  }
  const vocab = [...postings.keys()];
  const prefixed = new Map<string, string[]>();
  const words = (term: string) => {
    let found = prefixed.get(term);
    if (found === undefined) { found = exact(term) ? (postings.has(term) ? [term] : []) : vocab.filter((word) => word.startsWith(term)); prefixed.set(term, found); }
    return found;
  };
  const cache = new Map<string, Float64Array>();
  return {
    contribution(group: readonly string[]): Float64Array {
      const key = group.join("\u0000");
      const known = cache.get(key);
      if (known !== undefined) return known;
      const freq = new Float64Array(n);
      for (const word of new Set(group.flatMap(words))) for (const { doc, count } of postings.get(word)!) freq[doc] += count;
      let df = 0;
      for (const f of freq) if (f > 0) df++;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const weights = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const f = freq[i]!;
        if (f !== 0) weights[i] = (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * docs[i]!.length) / avg));
      }
      cache.set(key, weights);
      return weights;
    },
    /** Each document's score for the groups, summed in their order (a repeated group counts each time). */
    scores(groups: readonly (readonly string[])[]): number[] {
      const parts = groups.map((group) => this.contribution(group));
      return docs.map((_, i) => { let score = 0; for (const part of parts) { const w = part[i]!; if (w !== 0) score += w; } return score; });
    },
  };
}

const SUBJECT_TYPES = new Set(["project", "area", "org", "person"]);
const LINKS = ["projects", "project", "area", "client", "org", "people", "attendees"];

function links(note: Note): string[] {
  return LINKS.flatMap((field) => { const value = note.attributes[field]; return typeof value === "string" ? [value] : stringsOf(value); });
}

interface Subject { id: string; type: string; words: string[] }

/** The subjects the searched notes name (§2.4: only an eligible note's own title and aliases, as the projection left them). */
function subjectsOf(searched: readonly Note[], norm: (term: string) => string): Subject[] {
  return searched.filter((note) => SUBJECT_TYPES.has(note.type) && !titleWithheld(note)).flatMap((note) =>
    [...stringsOf([note.attributes.title]), ...stringsOf(note.attributes.aliases)]
      .map((name) => [...new Set(queryWords(name).map(norm))]).filter((words) => words.length > 0)
      .map((words) => ({ id: note.id, type: note.type, words })));
}

/** The notes about each subject: itself, the notes that link it, for an org or area the notes of its projects, and the sources
 *  of those notes. Only notes in the searched set (the projection's), so nothing is added that the rule withholds. */
function relatedTo(ids: readonly string[], searched: readonly Note[]): Set<string> {
  const byId = new Map(searched.map((note) => [note.id, note]));
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

function rankVariant(searched: readonly Note[], tokens: readonly string[], context: QueryContext, flags: Flags): { list: QueryCandidate[]; snippetsOf: (id: string) => QuerySnippet[] } {
  // Stems are cached for this search only, so a later search (or the in-process timing) gains nothing from this one.
  const stems = new Map<string, string>();
  const norm = flags.c2w
    ? (term: string) => { let found = stems.get(term); if (found === undefined) { found = isCjkTerm(term) ? term : stem(term); stems.set(term, found); } return found; }
    : (term: string) => term;
  const docs = searched.map((note) => variantDocumentTerms(note, flags));
  const groups = tokens.map((token) => queryGroup(token, norm, flags));
  const index = bm25Index(docs, isCjkTerm, flags.c2w ? norm : null);
  const scores = index.scores(groups);

  // C3: the subject the question names (an eligible title or alias, every word of it in the question; the most specific
  // names win), else the caller's project. Its notes that hold an attribute term rank on that term twice.
  const words = new Set(tokens.filter((token) => !isCjkTerm(token)).map(norm));
  const subjects = flags.c3 || flags.c3a ? subjectsOf(searched, norm) : [];
  const named = subjects.filter((subject) => subject.words.every((word) => words.has(word)));
  const specific = named.filter((subject) => !named.some((other) => other.words.length > subject.words.length && subject.words.every((word) => other.words.includes(word))));
  const ids = new Set(searched.map((note) => note.id));
  const resolved = [...new Set(specific.map((subject) => subject.id))];
  if (resolved.length === 0 && context.project !== null && ids.has(context.project)) resolved.push(context.project);
  const subjectWords = new Set(specific.flatMap((subject) => subject.words));
  const attributes = groups.filter((group) => !subjectWords.has(group[0]!));
  const attributeScores = (flags.c3 || flags.c3a) && attributes.length > 0 ? index.scores(attributes) : searched.map(() => 0);
  const related = flags.c3 && resolved.length > 0 ? relatedTo(resolved, searched) : new Set<string>();

  const matchTerms = groups.flat();
  const ranked = searched
    .map((note, index) => {
      const lexical = scores[index]!;
      if (flags.c3d && lexical === 0) return { note, index, score: 0 };
      const subject = related.has(note.id) && attributeScores[index]! > 0 ? attributeScores[index]! : 0;
      return { note, index, score: round4(lexical + subject + boost(note, context)) };
    })
    .filter((entry) => entry.score !== 0)
    .map(({ note, index, score }) => ({ candidate: candidateFor(note, [], score), updated: stringValue(note.attributes.updated) ?? "", attribute: attributeScores[index]! }))
    .sort((left, right) => right.candidate.score - left.candidate.score
      || compareCodePoints(right.updated, left.updated)
      || compareCodePoints(left.candidate.id, right.candidate.id));
  const list = ranked.map((entry) => entry.candidate);
  const byId = new Map(searched.map((note) => [note.id, note]));
  const done = (order: QueryCandidate[]) => ({ list: order, snippetsOf: (id: string) => variantSnippets(byId.get(id)!, matchTerms, groups, norm, flags) });
  if (!flags.c3a || resolved.length > 0) return done(list);

  // C3a: an unresolved subject (§3). The projects the question names in part (a distinctive word of their name: one at most
  // five subject names share), else the caller's area's projects; when two or more, the best note holding an attribute term
  // of each of up to five of them is kept in the first ten.
  const projects = subjects.filter((subject) => subject.type === "project");
  const shared = (word: string) => subjects.filter((subject) => subject.words.includes(word)).length;
  let open = [...new Set(projects.filter((subject) => subject.words.some((word) => words.has(word) && shared(word) <= 5)).map((subject) => subject.id))];
  if (open.length === 0 && context.area !== null) open = searched.filter((note) => note.type === "project" && note.attributes.area === context.area && !titleWithheld(note)).map((note) => note.id);
  if (open.length < 2) return done(list);
  const holds = new Map(ranked.map((entry) => [entry.candidate.id, entry.attribute > 0]));
  const representatives: string[] = [];
  const firstIndex = (id: string) => { const about = relatedTo([id], searched); return list.findIndex((candidate) => about.has(candidate.id) && holds.get(candidate.id) === true); };
  const best = open.map((id) => ({ id, at: firstIndex(id) })).filter((entry) => entry.at >= 0).sort((a, b) => a.at - b.at).slice(0, 5);
  for (const { at } of best) if (!representatives.includes(list[at]!.id)) representatives.push(list[at]!.id);
  const top = list.slice(0, 10);
  const missing = representatives.filter((id) => !top.some((candidate) => candidate.id === id));
  if (missing.length === 0) return done(list);
  const keep = new Set(representatives);
  const head: QueryCandidate[] = [];
  let drop = missing.length;
  for (let i = top.length - 1; i >= 0; i--) { if (drop > 0 && !keep.has(top[i]!.id)) { drop--; continue; } head.unshift(top[i]!); }
  const promoted = list.filter((candidate) => missing.includes(candidate.id));
  const shown = new Set([...head, ...promoted].map((candidate) => candidate.id));
  return done([...head, ...promoted, ...list.filter((candidate) => !shown.has(candidate.id))]);
}

/** Snippets: lines whose words (normalised) match a term. Without C4, the first three such lines, each its first 200 characters,
 *  as today. With C4, a kept fact (`facts.<name>: <value>`) that matches, then the body lines matching the most query items,
 *  three at most in all, in line order, each the 200-character window around its first match. */
function variantSnippets(note: Note, terms: readonly string[], groups: readonly (readonly string[])[], norm: (term: string) => string, flags: Flags): QuerySnippet[] {
  const lineTerms = (text: string) => queryTerms(text).map(norm);
  const hitWords = (words: readonly string[]) => terms.some((term) => matches(words, term));
  const hit = (text: string) => hitWords(lineTerms(text));
  const offset = note.raw.slice(0, note.raw.length - note.body.length).split(/\r?\n/).length;
  const lines = note.body.split(/\r?\n/);
  if (!flags.c4) {
    const found: QuerySnippet[] = [];
    for (const [index, text] of lines.entries()) {
      if (!hit(text)) continue;
      found.push({ line: offset + index, text: text.trim().slice(0, 200) });
      if (found.length === 3) break;
    }
    return found;
  }
  const found: QuerySnippet[] = [];
  const facts = note.attributes.facts;
  if (typeof facts === "object" && facts !== null && !Array.isArray(facts)) {
    const raw = note.raw.split(/\r?\n/);
    const factsAt = raw.findIndex((line) => /^facts:\s*$/.test(line));
    for (const [name, value] of Object.entries(facts)) {
      if (typeof value === "object" && value !== null) continue;
      const text = `facts.${name}: ${String(value)}`;
      if (!hit(`${name} ${String(value)}`)) continue;
      const at = raw.findIndex((line, index) => index > factsAt && new RegExp(`^\\s+${name.replace(/[^\w]/g, "\\$&")}:`).test(line));
      found.push({ line: at + 1, text: text.slice(0, 200) });
    }
  }
  const scored = lines.flatMap((text, index) => {
    const words = lineTerms(text);
    if (!hitWords(words)) return [];
    return [{ index, text, items: groups.filter((group) => group.some((term) => matches(words, term))).length }];
  }).sort((a, b) => b.items - a.items || a.index - b.index);
  // Facts first, two at most while body lines match; the rest are the best body lines; three in all.
  const factCount = Math.min(found.length, scored.length > 0 ? 2 : 3);
  const body = scored.slice(0, 3 - factCount).sort((a, b) => a.index - b.index);
  return [...found.slice(0, factCount), ...body.map(({ index, text }) => ({ line: offset + index, text: window(text.trim(), terms, norm) }))];
}

/** At most 200 characters of a line around its first matching word. */
function window(text: string, terms: readonly string[], norm: (term: string) => string): string {
  if (text.length <= 200) return text;
  const word = /[\p{L}\p{N}]+/gu;
  let start = 0;
  for (let m = word.exec(text); m !== null; m = word.exec(text)) {
    const words = queryTerms(m[0]).map(norm);
    if (terms.some((term) => matches(words, term))) { start = m.index; break; }
  }
  if (start + 200 <= text.length && start < 80) return `${text.slice(0, 199)}…`;
  let from = Math.max(0, start - 80);
  const space = text.indexOf(" ", from);
  if (from > 0 && space !== -1 && space < start) from = space + 1;
  const body = text.slice(from, from + 198);
  return `${from > 0 ? "…" : ""}${body}${from + 198 < text.length ? "…" : ""}`.slice(0, 200);
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
