import { posix } from "node:path";

import { decodePath, linkTargets } from "./lint-links.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { QUERY_STOPWORDS } from "./query.ts";
import { contextFor, eligibleNote, type Loaded } from "./suppressions.ts";
import { formatDate, formatTimestamp } from "./time.ts";

/** Reflection: `brain reflect --candidates` (spec/cli.md §5.32), its holds (spec/schema.md §11.4) and the checks lint shares with it. */

export const KNOWLEDGE_TYPES = new Set(["domain", "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
export const SIGNALS = ["shared_ground", "overtaken", "near_duplicate", "recurring_term"] as const;
type Signal = typeof SIGNALS[number];
/** Types the near_duplicate signal leaves out (§5.32): a recurring meeting repeats its title; the structure of your work is Ultimate Assistant's. */
const NOT_DUPLICATES = new Set(["meeting", "domain", "area", "goal", "project"]);
const WINDOW_DAYS = 30;
const ID = /^(area|dom|gol|prj|per|org|mtg|dec|que|con|ref|src|mem|prp|vw)-[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
const NOTE_ID = "(?:area|dom|gol|prj|per|org|mtg|dec|que|con|ref)-[0-9abcdefghjkmnpqrstvwxyz]{8}";
const FINGERPRINT = {
  fact: new RegExp(`^(contradiction|stale):(${NOTE_ID}):([a-z][a-z0-9_]*)$`),
  merge: new RegExp(`^merge:(${NOTE_ID})\\+(${NOTE_ID})$`),
  promotion: new RegExp(`^promotion:(${NOTE_ID}):((?:mtg|src)-[0-9abcdefghjkmnpqrstvwxyz]{8})$`),
  theme: /^theme:([a-z0-9]+(?:-[a-z0-9]+){1,2})$/,
};

/** §5.32 "Tokens": §5.13's normalization, every token kept. */
export function reflectTokens(value: string): string[] {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token !== "");
}

/** §5.32 "Two names match": the same number of tokens, each pair equal or an initial of the other, and one equal pair of two or more letters. */
export function namesMatch(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || left.length !== right.length) return false;
  let solid = false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!, b = right[index]!;
    if (a === b) { if (a.length >= 2) solid = true; continue; }
    if (!((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b)))) return false;
  }
  return solid;
}

export function namesOf(note: Note): string[] {
  const names = typeof note.attributes.title === "string" ? [note.attributes.title] : [];
  if (Array.isArray(note.attributes.aliases)) for (const alias of note.attributes.aliases) if (typeof alias === "string") names.push(alias);
  return names.filter((name) => reflectTokens(name).length > 0);
}

/** A Document holding a whole text on purpose: `whole`, `part` (or no origin) or `workflow` (0049, 0071, 0076 §7). */
export function holdsWholeText(note: Note): boolean {
  return note.type === "reference" && (note.attributes.origin === undefined || ["whole", "part", "workflow"].includes(String(note.attributes.origin)));
}

function day(value: unknown): string {
  if (typeof value !== "string") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value.slice(0, 10) : new Date(parsed).toISOString().slice(0, 10);
}

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** The body lines with their 1-based line numbers in the file. */
function bodyLines(note: Note): Array<{ line: number; text: string }> {
  const offset = note.raw.slice(0, note.raw.length - note.body.length).split(/\r?\n/).length;
  return note.body.split(/\r?\n/).map((text, index) => ({ line: offset + index, text }));
}

/** Paths a line's relative links point at, from the note's folder. */
function linkedPaths(from: string, text: string): string[] {
  return linkTargets(text)
    .filter((target) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("#"))
    .map((target) => posix.normalize(posix.join(posix.dirname(from), decodePath(target.split(/[?#]/)[0]!))));
}

const joined = (tokens: readonly string[]) => ` ${tokens.join(" ")} `;

/** A note's names as token runs, for "names a note" (§5.32): a one-token name counts only with 3 or more characters. */
function nameRuns(note: Note): string[] {
  return namesOf(note).map(reflectTokens).filter((tokens) => tokens.length > 1 || tokens[0]!.length >= 3).map(joined);
}

interface Input {
  note: Note;
  date: string;
  created: string;
  /** Frontmatter strings (any field but `id`). */
  values: Set<string>;
  title: string;
  /** Body lines, as numbered in the file, with their token runs. */
  lines: Array<{ line: number; text: string; tokens: string; heading: boolean; links: string[] }>;
  /** The text of §5.32: title, summary and non-heading body lines, one token list per line. */
  text: string[][];
}

function inputOf(note: Note): Input | null {
  if (note.type === "meeting") {
    // ok
  } else if (note.type === "source") {
    if (note.attributes.kind === undefined || note.attributes.kind === "minutes") return null;
  } else {
    return null;
  }
  const a = note.attributes;
  const values = new Set(Object.entries(a).filter(([key]) => key !== "id").flatMap(([, value]) => strings(value)));
  const lines = bodyLines(note).map(({ line, text }) => ({ line, text, tokens: joined(reflectTokens(text)), heading: /^#/.test(text), links: linkedPaths(note.path, text) }));
  const text = [
    typeof a.title === "string" ? reflectTokens(a.title) : [],
    typeof a.summary === "string" ? reflectTokens(a.summary) : [],
    ...lines.filter((line) => !line.heading).map((line) => reflectTokens(line.text)),
  ].filter((tokens) => tokens.length > 0);
  return {
    note,
    date: day(note.type === "meeting" ? a.date : a.captured),
    created: day(a.created),
    values,
    title: joined(typeof a.title === "string" ? reflectTokens(a.title) : []),
    lines,
    text,
  };
}

/** §5.32 "An input names a note": its id in the frontmatter, a body link to its file, or one of its names in the title or a body line. */
function lineNames(line: Input["lines"][number], note: Note, runs: readonly string[]): boolean {
  return line.links.includes(note.path) || runs.some((run) => line.tokens.includes(run));
}

function names(input: Input, note: Note, runs: readonly string[]): boolean {
  if (input.values.has(note.id)) return true;
  if (runs.some((run) => input.title.includes(run))) return true;
  return input.lines.some((line) => lineNames(line, note, runs));
}

function termsOf(input: Input): Map<string, number[]> {
  // term text → the text lines (by index) holding it
  const found = new Map<string, number[]>();
  input.text.forEach((tokens, index) => {
    for (const size of [2, 3]) {
      for (let start = 0; start + size <= tokens.length; start += 1) {
        const run = tokens.slice(start, start + size);
        if (QUERY_STOPWORDS.has(run[0]!) || QUERY_STOPWORDS.has(run[run.length - 1]!) || run.some((token) => /^\d+$/.test(token))) continue;
        const term = run.join(" ");
        const at = found.get(term) ?? [];
        if (!at.includes(index)) at.push(index);
        found.set(term, at);
      }
    }
  });
  return found;
}

/** §5.32 "references of a note": note ids in its frontmatter but `id`, `sources` and `area`, and the notes its body links. */
function referencesOf(note: Note, byPath: ReadonlyMap<string, Note>, known: ReadonlySet<string>): Set<string> {
  const refs = new Set<string>();
  for (const [key, value] of Object.entries(note.attributes)) {
    if (key === "id" || key === "sources" || key === "area") continue;
    for (const text of strings(value)) if (ID.test(text) && known.has(text)) refs.add(text);
  }
  for (const { text } of bodyLines(note)) for (const path of linkedPaths(note.path, text)) { const linked = byPath.get(path); if (linked !== undefined) refs.add(linked.id); }
  refs.delete(note.id);
  return refs;
}

export interface Hold { fingerprint: string; state: "waiting" | "skipped"; proposal: string }

/** The held fingerprints (schema §11.4), given the inputs a released skip is judged against. */
function holds(proposals: readonly Note[], inputs: readonly Input[], byId: ReadonlyMap<string, Note>): Map<string, Hold> {
  const groups = new Map<string, Note[]>();
  for (const proposal of proposals) {
    const fingerprint = proposal.attributes.fingerprint;
    if (typeof fingerprint === "string") groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), proposal]);
  }
  const held = new Map<string, Hold>();
  for (const [fingerprint, group] of groups) {
    const decidedAt = (note: Note) => { const decision = note.attributes.decision; return decision !== null && typeof decision === "object" ? String((decision as Record<string, unknown>).decided_at ?? "") : ""; };
    const latest = [...group].sort((a, b) => compareCodePoints(String(a.attributes.created ?? ""), String(b.attributes.created ?? "")) || compareCodePoints(decidedAt(a), decidedAt(b)) || compareCodePoints(a.id, b.id)).at(-1)!;
    if (group.some((note) => ["pending", "approved", "edited"].includes(String(note.attributes.status)))) {
      held.set(fingerprint, { fingerprint, state: "waiting", proposal: latest.id });
      continue;
    }
    const decided = group.filter((note) => decidedAt(note) !== "").sort((a, b) => compareCodePoints(decidedAt(a), decidedAt(b)) || compareCodePoints(a.id, b.id)).at(-1);
    const decision = decided?.attributes.decision as Record<string, unknown> | undefined;
    if (decided === undefined || decision?.action !== "reject") continue;
    const since = day(decision.decided_at);
    const evidence = new Set(list(decided.attributes.evidence));
    const fresh = inputs.filter((input) => !evidence.has(input.note.id) && input.created >= since);
    let released = false;
    const fact = FINGERPRINT.fact.exec(fingerprint) ?? FINGERPRINT.promotion.exec(fingerprint);
    if (fingerprint.startsWith("merge:")) released = false;
    else if (fingerprint.startsWith("theme:")) {
      const term = ` ${fingerprint.slice("theme:".length).split("-").join(" ")} `;
      released = fresh.some((input) => input.text.some((tokens) => joined(tokens).includes(term)));
    } else if (fact !== null) {
      const target = byId.get(fact[fingerprint.startsWith("promotion:") ? 1 : 2]!);
      released = target !== undefined && fresh.some((input) => names(input, target, nameRuns(target)));
    }
    if (!released) held.set(fingerprint, { fingerprint, state: "skipped", proposal: latest.id });
  }
  return held;
}

interface Cluster {
  rank?: number;
  key: string;
  signal: Signal;
  notes: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface Candidates {
  as_of: string;
  window: { from: string; to: string };
  read: { notes: number; inputs: number };
  total: number;
  held: number;
  offset: number;
  clusters: Cluster[];
}

/** The eligible notes as reflection sees them (§5.32 "Restricted evidence"): restricted statements blanked, notes restricted whole left out. */
export function reflectionNotes(notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>): Note[] {
  const context = contextFor(notes, loaded);
  return notes.flatMap((note) => { const kept = eligibleNote(note, context); return kept === null ? [] : [kept]; });
}

/** The near_duplicate pairs of §5.32 among `notes`, each `[a, b]` sorted by id, with the two names that matched. */
export function nearDuplicatePairs(notes: readonly Note[]): Array<{ notes: [Note, Note]; names: [string, string] }> {
  const eligible = notes.filter((note) => KNOWLEDGE_TYPES.has(note.type) && !NOT_DUPLICATES.has(note.type) && !holdsWholeText(note)
    && (note.attributes.lifecycle === "draft" || note.attributes.lifecycle === "reviewed"));
  const byType = new Map<string, Note[]>();
  for (const note of eligible) byType.set(note.type, [...(byType.get(note.type) ?? []), note]);
  const pairs: Array<{ notes: [Note, Note]; names: [string, string] }> = [];
  for (const group of byType.values()) {
    const sorted = [...group].sort((a, b) => compareCodePoints(a.id, b.id));
    const named = sorted.map((note) => ({ note, names: namesOf(note).map((name) => ({ name, tokens: reflectTokens(name) })) }));
    for (let i = 0; i < named.length; i += 1) {
      for (let j = i + 1; j < named.length; j += 1) {
        if (named[i]!.note.id === named[j]!.note.id) continue;
        let match: [string, string] | undefined;
        for (const left of named[i]!.names) { for (const right of named[j]!.names) if (namesMatch(left.tokens, right.tokens)) { match = [left.name, right.name]; break; } if (match !== undefined) break; }
        if (match !== undefined) pairs.push({ notes: [named[i]!.note, named[j]!.note], names: match });
      }
    }
  }
  return pairs;
}

export function mergeFingerprint(a: string, b: string): string {
  return `merge:${[a, b].sort(compareCodePoints).join("+")}`;
}

/** Held fingerprints for lint's near-duplicate warning: the same rule as `reflect --candidates`, against every input. */
export function heldFingerprints(notes: readonly Note[]): Map<string, Hold> {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const inputs = notes.flatMap((note) => { const input = inputOf(note); return input === null ? [] : [input]; });
  return holds(notes.filter((note) => note.type === "proposal"), inputs, byId);
}

/** `brain reflect --candidates` (spec/cli.md §5.32). */
export function reflectCandidates(all: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>, now: Date, limit: number, offset: number): Candidates {
  const to = formatDate(now);
  const from = formatDate(new Date(Date.parse(`${to}T00:00:00Z`) - (WINDOW_DAYS - 1) * 86_400_000));
  const notes = reflectionNotes(all, loaded);
  const byId = new Map(notes.map((note) => [note.id, note]));
  const allById = new Map(all.map((note) => [note.id, note]));
  const byPath = new Map(notes.map((note) => [note.path, note]));
  const knowledge = notes.filter((note) => KNOWLEDGE_TYPES.has(note.type));
  const knownIds = new Set(notes.map((note) => note.id));
  const inputs = notes.flatMap((note) => { const input = inputOf(note); return input === null ? [] : [input]; });
  const window = inputs.filter((input) => input.date >= from && input.date <= to);
  const held = holds(all.filter((note) => note.type === "proposal"), inputs, byId);
  const member = (note: Note): Record<string, unknown> => ({
    id: note.id, type: note.type, title: note.attributes.title ?? null, path: note.path,
    lifecycle: note.attributes.lifecycle ?? null, updated: note.attributes.updated ?? null,
    summary: typeof note.attributes.summary === "string" ? note.attributes.summary : null,
  });
  const evidenceOf = (chosen: Input[], linesOf: (input: Input) => Array<{ line: number; text: string }>) => [...chosen]
    .sort((a, b) => compareCodePoints(b.date, a.date) || compareCodePoints(a.note.id, b.note.id))
    .map((input) => ({
      id: input.note.id, type: input.note.type, title: input.note.attributes.title ?? null, path: input.note.path, date: input.date, created: input.created,
      lines: linesOf(input).slice(0, 3).map(({ line, text }) => ({ line, text: text.trim().slice(0, 200) })),
    }));
  const memberHolds = (members: readonly Note[]): Hold[] => [...held.values()]
    .filter((hold) => {
      const fact = FINGERPRINT.fact.exec(hold.fingerprint);
      const promotion = FINGERPRINT.promotion.exec(hold.fingerprint);
      const target = fact?.[2] ?? promotion?.[1];
      return target !== undefined && members.some((note) => note.id === target);
    })
    .sort((a, b) => compareCodePoints(a.fingerprint, b.fingerprint));

  const clusters: Array<Cluster & { order: number; newest: string }> = [];
  let heldOut = 0;
  const newest = (dates: string[]) => dates.filter((value) => value !== "").sort(compareCodePoints).at(-1) ?? "";

  // shared_ground: two reviewed notes, not meetings, one updated in the window, two or more references in common.
  const reviewed = knowledge.filter((note) => note.attributes.lifecycle === "reviewed" && note.type !== "meeting");
  const refs = new Map(reviewed.map((note) => [note.id, referencesOf(note, byPath, knownIds)]));
  const sortedReviewed = [...reviewed].sort((a, b) => compareCodePoints(a.id, b.id));
  const inWindow = (note: Note) => { const updated = day(note.attributes.updated); return updated >= from && updated <= to; };
  for (let i = 0; i < sortedReviewed.length; i += 1) {
    for (let j = i + 1; j < sortedReviewed.length; j += 1) {
      const a = sortedReviewed[i]!, b = sortedReviewed[j]!;
      if (!inWindow(a) && !inWindow(b)) continue;
      const shared = [...refs.get(a.id)!].filter((id) => refs.get(b.id)!.has(id)).sort(compareCodePoints);
      if (shared.length < 2) continue;
      clusters.push({ key: `shared_ground:${a.id}+${b.id}`, signal: "shared_ground", notes: [member(a), member(b)], shared, held: memberHolds([a, b]), order: shared.length, newest: newest([day(a.attributes.updated), day(b.attributes.updated)]) });
    }
  }

  // overtaken: a reviewed note named by window inputs that aren't in its sources and are dated after its update.
  for (const note of [...reviewed].sort((a, b) => compareCodePoints(a.id, b.id))) {
    if (holdsWholeText(note)) continue;
    const runs = nameRuns(note);
    const sources = new Set(list(note.attributes.sources));
    const updated = day(note.attributes.updated);
    const cited = (input: Input): boolean => {
      if (sources.has(input.note.id)) return true;
      const key = input.note.attributes.source_key;
      if (typeof key === "string" && sources.has(key)) return true;
      if (input.note.type === "meeting" && typeof input.note.attributes.source === "string") {
        const source = allById.get(input.note.attributes.source);
        if (sources.has(input.note.attributes.source)) return true;
        if (typeof source?.attributes.source_key === "string" && sources.has(source.attributes.source_key)) return true;
      }
      return false;
    };
    const chosen = window.filter((input) => input.note.id !== note.id && input.date > updated && !cited(input) && names(input, note, runs));
    if (chosen.length === 0) continue;
    clusters.push({
      key: `overtaken:${note.id}`, signal: "overtaken", notes: [member(note)],
      evidence: evidenceOf(chosen, (input) => input.lines.filter((line) => lineNames(line, note, runs))),
      held: memberHolds([note]), order: chosen.length, newest: newest([updated, ...chosen.map((input) => input.date)]),
    });
  }

  // near_duplicate: two notes of one type whose names match.
  for (const pair of nearDuplicatePairs(knowledge)) {
    const [a, b] = pair.notes;
    const fingerprint = mergeFingerprint(a.id, b.id);
    if (held.has(fingerprint)) { heldOut += 1; continue; }
    clusters.push({ key: `near_duplicate:${a.id}+${b.id}`, signal: "near_duplicate", notes: [member(a), member(b)], names: pair.names, fingerprint, order: 0, newest: newest([day(a.attributes.updated), day(b.attributes.updated)]) });
  }

  // recurring_term: a term in three or more window inputs that no knowledge note's name carries.
  const terms = new Map<string, Map<Input, number[]>>();
  for (const input of window) for (const [term, at] of termsOf(input)) { const entry = terms.get(term) ?? new Map<Input, number[]>(); entry.set(input, at); terms.set(term, entry); }
  const carried = knowledge.flatMap((note) => namesOf(note).map((name) => joined(reflectTokens(name))));
  const frequent = [...terms].filter(([, found]) => found.size >= 3);
  const sameInputs = (a: Map<Input, number[]>, b: Map<Input, number[]>) => a.size === b.size && [...a.keys()].every((input) => b.has(input));
  for (const [term, found] of frequent) {
    const padded = ` ${term} `;
    if (carried.some((name) => name.includes(padded))) continue;
    if (frequent.some(([longer, other]) => longer !== term && longer.split(" ").length > term.split(" ").length && ` ${longer} `.includes(padded) && sameInputs(found, other))) continue;
    const slug = term.split(" ").join("-");
    const fingerprint = `theme:${slug}`;
    if (held.has(fingerprint)) { heldOut += 1; continue; }
    const chosen = [...found.keys()];
    clusters.push({
      key: `recurring_term:${slug}`, signal: "recurring_term", notes: [], term, fingerprint,
      evidence: evidenceOf(chosen, (input) => input.lines.filter((line) => !line.heading && line.tokens.includes(padded))),
      order: chosen.length, newest: newest(chosen.map((input) => input.date)),
    });
  }

  clusters.sort((a, b) => SIGNALS.indexOf(a.signal) - SIGNALS.indexOf(b.signal) || b.order - a.order || compareCodePoints(b.newest, a.newest) || compareCodePoints(a.key, b.key));
  const page = clusters.slice(offset, offset + limit).map(({ order: _order, newest: _newest, ...cluster }, index) => ({ rank: offset + index + 1, ...cluster }));
  return {
    as_of: formatTimestamp(now),
    window: { from, to },
    read: { notes: knowledge.length, inputs: window.length },
    total: clusters.length,
    held: heldOut,
    offset,
    clusters: page,
  };
}

/** What lint's `proposal-fingerprint` and `proposal new` check (schema §11.4): null, or the key at fault and why. */
export function fingerprintProblem(a: Record<string, unknown>, get: (id: string) => Note | undefined): { key: string; message: string } | null {
  const fingerprint = a.fingerprint;
  if (typeof fingerprint !== "string") return null;
  const kind = a.kind;
  const fact = FINGERPRINT.fact.exec(fingerprint);
  const merge = FINGERPRINT.merge.exec(fingerprint);
  const promotion = FINGERPRINT.promotion.exec(fingerprint);
  const theme = FINGERPRINT.theme.exec(fingerprint);
  if (fact !== null) {
    const expected = fact[1] === "contradiction" ? "contradiction" : "update_fact";
    if (kind !== expected) return { key: "fingerprint", message: `${fingerprint} is a ${expected}, not a ${String(kind)}` };
    if (a.target !== fact[2]) return { key: "fingerprint", message: `names ${fact[2]}, but the target is ${String(a.target)}` };
    if (a.field !== fact[3]) return { key: "fingerprint", message: `names the field ${fact[3]}, but the proposal's is ${String(a.field)}` };
  } else if (merge !== null) {
    if (kind !== "merge") return { key: "fingerprint", message: `${fingerprint} is a merge, not a ${String(kind)}` };
    if (merge[1] === merge[2] || compareCodePoints(merge[1]!, merge[2]!) > 0) return { key: "fingerprint", message: "a merge names two different ids, sorted" };
    const pair = [String(a.target), String(a.merge_into)].sort(compareCodePoints);
    if (pair[0] !== merge[1] || pair[1] !== merge[2]) return { key: "fingerprint", message: `names ${merge[1]} and ${merge[2]}, but the merge is ${String(a.target)} into ${String(a.merge_into)}` };
  } else if (promotion !== null) {
    if (kind !== "add_to_note") return { key: "fingerprint", message: `${fingerprint} is an add_to_note, not a ${String(kind)}` };
    if (a.target !== promotion[1]) return { key: "fingerprint", message: `names ${promotion[1]}, but the target is ${String(a.target)}` };
    if (a.source !== promotion[2]) return { key: "fingerprint", message: `names the source ${promotion[2]}, but the proposal's is ${String(a.source)}` };
  } else if (theme !== null) {
    if (kind === "review_notes") {
      const notes = list(a.notes);
      const note = notes.length === 1 ? get(notes[0]!) : undefined;
      if (note === undefined || note.type !== "reference" || note.attributes.origin !== "learned") return { key: "notes", message: "a theme's review_notes lists exactly one note, a learned Document" };
    } else if (kind === "new_item") {
      const note = a.note as Record<string, unknown> | undefined;
      const frontmatter = note?.frontmatter as Record<string, unknown> | undefined;
      if (note?.type !== "reference" || frontmatter?.origin !== "learned") return { key: "note", message: "a theme's new_item holds a learned Document" };
    } else {
      return { key: "fingerprint", message: `${fingerprint} is a review_notes or a new_item, not a ${String(kind)}` };
    }
  } else {
    return { key: "fingerprint", message: `${fingerprint} is not a reflection fingerprint` };
  }
  for (const [index, id] of list(a.evidence).entries()) {
    const note = get(id);
    if (note === undefined || (note.type !== "meeting" && note.type !== "source")) return { key: `evidence/${index}`, message: `${id} names no meeting or source` };
  }
  return null;
}
