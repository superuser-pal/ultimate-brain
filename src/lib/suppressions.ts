import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { eligible, lineageOf, noteReleased, restrictedSources, type Context, type SourceInfo, type Suppression } from "./eligibility.ts";
import { BrainError } from "./errors.ts";
import type { Note } from "./notes.ts";
import { PASSAGE_REF } from "./selection.ts";

/** A Restore record (cli §5.23): the user accepted the Restore of passages that a later extract version holds again. */
export interface Restore { input: string; extract_version: number; passages: { n: number; transcript_hash?: string }[] }
export interface Loaded { suppressions: Suppression[]; restores: Restore[]; problems: string[] }

/** Suppression records live in `_suppressions/<input id>.json`, an append-only list (capture-and-review §5.3, cli §5.23). */
export function loadSuppressions(root: string): Loaded {
  const dir = join(root, "_suppressions");
  const loaded: Loaded = { suppressions: [], restores: [], problems: [] };
  let names: string[] = [];
  try { names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort(); } catch { return loaded; }
  for (const name of names) {
    try {
      const value = JSON.parse(readFileSync(join(dir, name), "utf8")) as { input?: unknown; records?: unknown };
      const records = Array.isArray(value.records) ? (value.records as Record<string, unknown>[]) : null;
      const valid = typeof value.input === "string" && records !== null && records.every((record) => record.kind === "restore"
        ? Number.isInteger(record.extract_version) && Array.isArray(record.passages)
        : Number.isInteger(record.version) && Array.isArray(record.passages) && (record.status === "active" || record.status === "reconciled"));
      if (!valid) { loaded.problems.push(`_suppressions/${name}: not a suppression record`); continue; }
      for (const record of records!) {
        if (record.kind === "restore") loaded.restores.push({ input: value.input as string, extract_version: record.extract_version as number, passages: record.passages as Restore["passages"] });
        else loaded.suppressions.push({ ...(record as unknown as Suppression), input: value.input as string });
      }
    } catch {
      loaded.problems.push(`_suppressions/${name}: unreadable`);
    }
  }
  return loaded;
}

/** For retrieval and writing: unreadable or malformed suppression data fails closed, never "no restrictions" (capture-and-review §5.3). */
export function requireSuppressions(root: string): Loaded {
  const loaded = loadSuppressions(root);
  if (loaded.problems.length > 0) throw new BrainError("SUPPRESSIONS_UNREADABLE", `Suppression records cannot be read, so nothing can be treated as eligible: ${loaded.problems.join("; ")}`);
  return loaded;
}

/** The eligibility context for a set of notes: every source's lineage facts, the suppressions and the passages awaiting Restore. */
export function contextFor(notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>, awaitingRestore?: Set<string>): Context {
  const sources = new Map<string, SourceInfo>();
  for (const note of notes) {
    // A meeting derives from its source: a claim citing the meeting has that source's lineage.
    if (note.type === "meeting" && typeof note.attributes.source === "string") sources.set(note.id, { id: note.id, replaces: note.attributes.source });
    if (note.type !== "source") continue;
    const a = note.attributes;
    const passages = Array.isArray(a.passages) ? (a.passages as { n: number; hash: string }[]).map((entry) => `${entry.n}:${entry.hash}`) : undefined;
    sources.set(note.id, {
      id: note.id,
      ...(typeof a.extract_of === "string" ? { extract_of: a.extract_of } : {}),
      ...(typeof a.source_key === "string" ? { source_key: a.source_key } : {}),
      ...(typeof a.replaces === "string" ? { replaces: a.replaces } : {}),
      ...(typeof a.transcript_hash === "string" ? { transcript_hash: a.transcript_hash } : {}),
      ...(typeof a.extract_version === "number" ? { extract_version: a.extract_version } : {}),
      ...(passages === undefined ? {} : { passages }),
    });
  }
  const awaiting = new Set(awaitingRestore ?? []);
  // Re-inclusion is derived from the persisted records: a passage the latest version holds again that an earlier suppression removed stays
  // restricted until a Restore record for that version names it (capture-and-review §4.6, §5.2).
  const latest = new Map<string, SourceInfo>();
  for (const info of sources.values()) {
    if (info.extract_of === undefined || info.passages === undefined) continue;
    const replaced = [...sources.values()].some((other) => other.replaces === info.id);
    if (!replaced) latest.set(info.extract_of, info);
  }
  for (const [input, info] of latest) {
    const version = info.extract_version ?? 0;
    const removed = new Set(loaded.suppressions.filter((entry) => entry.input === input && entry.version < version).flatMap((entry) => entry.passages.map((passage) => `${passage.transcript_hash}|${passage.n}`)));
    const restored = new Set((loaded.restores ?? []).filter((entry) => entry.input === input && entry.extract_version === version).flatMap((entry) => entry.passages.map((passage) => `${passage.transcript_hash ?? info.transcript_hash}|${passage.n}`)));
    for (const entry of info.passages!) {
      const n = entry.split(":")[0]!;
      const key = `${info.transcript_hash}|${n}`;
      if (removed.has(key) && !restored.has(key)) awaiting.add(`${input}|${info.transcript_hash}|${n}`);
    }
  }
  return { sources, suppressions: loaded.suppressions, awaitingRestore: awaiting };
}

export interface Restriction { whole: boolean; lines: Set<number>; timeline: Set<number>; facts: Set<string> }
const NONE = (): Restriction => ({ whole: false, lines: new Set(), timeline: new Set(), facts: new Set() });
const CONTENT = /^(?!#{1,6}\s|<!--|\s*$)/;

/** What of a note a retrieval surface must not use while suppressions are active (§5.1). Body line numbers are 0-based. */
export function restrictionOf(note: Note, context: Context): Restriction {
  const result = NONE();
  if (note.type === "proposal" || note.type === "view") return result;
  if (note.type === "source") { result.whole = restrictedSources(context).has(note.id); return result; }
  const active = new Set(context.suppressions.filter((entry) => entry.status === "active").map((entry) => entry.input));
  if (active.size === 0) return result;
  const sources = (Array.isArray(note.attributes.sources) ? note.attributes.sources : []).filter((value): value is string => typeof value === "string");
  const cleared = Array.isArray(note.attributes.lineage_cleared) ? (note.attributes.lineage_cleared as string[]) : [];
  const claim = { entries: [], lineage_cleared: cleared };
  const required = new Set<string>();
  for (const id of sources) {
    const lineage = lineageOf(id, context.sources);
    if (lineage === null) for (const input of active) required.add(input);
    else if (active.has(lineage)) required.add(lineage);
  }

  // Timeline entries and the facts they support (a fact with no live accepted entry is not returned or rendered).
  const timeline = Array.isArray(note.attributes.timeline) ? (note.attributes.timeline as Record<string, unknown>[]) : [];
  timeline.forEach((entry, index) => {
    if (typeof entry.source !== "string") return;
    const passage = typeof entry.passage === "string" ? /^(src-[0-9a-z]{8})#¶(\d+):([0-9a-f]{8})$/.exec(entry.passage) : null;
    const entries = [{ source: passage?.[1] ?? entry.source, ...(passage === null ? {} : { passage: { n: Number(passage[2]), hash: passage[3]! } }) }];
    if (!eligible({ ...claim, entries }, context)) result.timeline.add(index);
  });
  const facts = note.attributes.facts !== null && typeof note.attributes.facts === "object" ? (note.attributes.facts as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(facts)) {
    const support = timeline.flatMap((entry, index) => entry.field === key && entry.assessment === "accepted" && String(entry.value) === String(value) ? [index] : []);
    if (support.length > 0 && support.every((index) => result.timeline.has(index))) result.facts.add(key);
  }

  if (required.size === 0) return result;
  const resolved = { ...context, suppressions: context.suppressions.filter((entry) => required.has(entry.input)) };
  const released = noteReleased({ lineage_cleared: cleared }, resolved);
  let cited = false;
  for (const [index, text] of note.body.split(/\r?\n/).entries()) {
    const entries = [...text.matchAll(PASSAGE_REF)].map((match) => ({ source: match[1] ?? "", passage: { n: Number(match[2]), hash: match[3] ?? "" } }));
    if (entries.length > 0) {
      cited = true;
      if (!eligible({ ...claim, entries }, context)) result.lines.add(index);
    // Text with no passage reference cannot be mapped to a claim: it fails closed until the note is resolved for each input (§5.1).
    } else if (CONTENT.test(text) && !released) result.lines.add(index);
  }
  if (!cited && !released && result.lines.size > 0) result.whole = true;
  return result;
}

/** The note as a retrieval surface may use it (restricted statements blanked, restricted timeline entries and facts dropped), or null when restricted whole. */
export function eligibleNote(note: Note, context: Context): Note | null {
  const restriction = restrictionOf(note, context);
  if (restriction.whole) return null;
  if (restriction.lines.size === 0 && restriction.timeline.size === 0 && restriction.facts.size === 0) return note;
  const body = note.body.split(/(\r?\n)/).map((text, index) => index % 2 === 0 && restriction.lines.has(index / 2) ? " ".repeat(text.length) : text).join("");
  const attributes = { ...note.attributes };
  if (Array.isArray(attributes.timeline)) attributes.timeline = attributes.timeline.filter((_, index) => !restriction.timeline.has(index));
  if (attributes.facts !== null && typeof attributes.facts === "object") attributes.facts = Object.fromEntries(Object.entries(attributes.facts).filter(([key]) => !restriction.facts.has(key)));
  return { ...note, body, attributes };
}

/** The notes a derived view may render: restricted notes are left out, restricted statements, timeline entries and facts removed (§5.1). */
export function eligibleNotes(notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>): Note[] {
  if (!loaded.suppressions.some((entry) => entry.status === "active")) return [...notes];
  const context = contextFor(notes, loaded);
  return notes.flatMap((note) => { const kept = eligibleNote(note, context); return kept === null ? [] : [kept]; });
}
