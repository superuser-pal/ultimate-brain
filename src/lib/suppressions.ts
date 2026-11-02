import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { eligible, lineageOf, noteReleased, restrictedSources, type Context, type SourceInfo, type Suppression } from "./eligibility.ts";
import { BrainError } from "./errors.ts";
import type { Note } from "./notes.ts";
import { PASSAGE_REF } from "./selection.ts";

/** A Restore record (cli §5.23): the user accepted the Restore of passages that a later extract version holds again. */
export interface Restore { input: string; extract_version: number; items: { note: string; n: number }[] }
export interface Loaded { suppressions: Suppression[]; restores: Restore[]; problems: string[] }

/** Suppression records live in `_suppressions/<input id>.json`, an append-only list (capture-and-review §5.3, cli §5.23). */
export function loadSuppressions(root: string): Loaded {
  const dir = join(root, "_suppressions");
  const loaded: Loaded = { suppressions: [], restores: [], problems: [] };
  let names: string[] = [];
  try { names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort(); } catch (error) {
    // Only a genuinely absent directory means "no records"; any other failure must surface (fail closed).
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") loaded.problems.push(`_suppressions: unreadable directory (${(error as NodeJS.ErrnoException).code ?? "error"})`);
    return loaded;
  }
  for (const name of names) {
    try {
      const value = JSON.parse(readFileSync(join(dir, name), "utf8")) as { input?: unknown; records?: unknown };
      const records = Array.isArray(value.records) ? (value.records as Record<string, unknown>[]) : null;
      const valid = typeof value.input === "string" && records !== null && records.every((record) => record.kind === "restore"
        ? Number.isInteger(record.extract_version) && Array.isArray(record.items)
        : Number.isInteger(record.version) && Array.isArray(record.passages) && (record.status === "active" || record.status === "reconciled"));
      if (!valid) { loaded.problems.push(`_suppressions/${name}: not a suppression record`); continue; }
      for (const record of records!) {
        if (record.kind === "restore") loaded.restores.push({ input: value.input as string, extract_version: record.extract_version as number, items: record.items as Restore["items"] });
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
  const restored = new Set<string>();
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
    for (const entry of (loaded.restores ?? []).filter((candidate) => candidate.input === input && candidate.extract_version === version)) {
      for (const item of entry.items) restored.add(`${input}|${info.transcript_hash}|${item.n}|${item.note}`);
    }
    for (const entry of info.passages!) {
      const n = entry.split(":")[0]!;
      if (removed.has(`${info.transcript_hash}|${n}`)) awaiting.add(`${input}|${info.transcript_hash}|${n}`);
    }
  }
  return { sources, suppressions: loaded.suppressions, awaitingRestore: awaiting, restored };
}

export interface Restriction { whole: boolean; lines: Set<number>; timeline: Set<number>; facts: Set<string> }
const NONE = (): Restriction => ({ whole: false, lines: new Set(), timeline: new Set(), facts: new Set() });
const CONTENT = /^(?!#{1,6}\s|<!--|\s*$)/;

/** What of a note a retrieval surface must not use while suppressions are active (§5.1). Body line numbers are 0-based. */
export function restrictionOf(note: Note, context: Context): Restriction {
  const result = NONE();
  if (note.type === "proposal" || note.type === "view") return result;
  const active = new Set(context.suppressions.filter((entry) => entry.status === "active").map((entry) => entry.input));
  const pending = (context.awaitingRestore?.size ?? 0) > 0;
  if (note.type === "source") {
    result.whole = restrictedSources(context).has(note.id);
    if (!result.whole && pending && note.attributes.extract === true) {
      // The latest extract holds a re-included paragraph that waits for Restore: its text is not returned (capture-and-review §4.6).
      const input = note.attributes.extract_of;
      const lines = note.body.split(/\r?\n/);
      let hidden = false;
      lines.forEach((text, index) => {
        const marker = /^<!-- passage ¶(\d+) item [^>]*-->$/.exec(text);
        if (marker !== null) hidden = context.awaitingRestore!.has(`${String(input)}|${String(note.attributes.transcript_hash)}|${marker[1]}`);
        if (hidden) result.lines.add(index);
      });
    }
    return result;
  }
  const sources = (Array.isArray(note.attributes.sources) ? note.attributes.sources : []).filter((value): value is string => typeof value === "string");
  const cleared = Array.isArray(note.attributes.lineage_cleared) ? (note.attributes.lineage_cleared as string[]) : [];
  const claim = { entries: [], lineage_cleared: cleared, note: note.id };
  const required = new Set<string>();
  const addLineage = (id: string) => {
    const lineage = lineageOf(id, context.sources);
    if (lineage === null) for (const input of active) required.add(input);
    else if (active.has(lineage)) required.add(lineage);
  };
  // Provenance comes from the note's `sources` and from every claim's own reference: a citation absent from `sources` still counts.
  sources.forEach(addLineage);
  const bodyLines = note.body.split(/\r?\n/).map((text) => ({ text, refs: [...text.matchAll(PASSAGE_REF)] }));
  for (const line of bodyLines) for (const ref of line.refs) addLineage(ref[1] ?? "");

  // Timeline entries and the facts they support (a fact with no live accepted entry is not returned or rendered).
  const timeline = Array.isArray(note.attributes.timeline) ? (note.attributes.timeline as Record<string, unknown>[]) : [];
  timeline.forEach((entry, index) => {
    if (typeof entry.source !== "string") return;
    const passage = typeof entry.passage === "string" ? /^(src-[0-9a-z]{8})#¶(\d+):([0-9a-f]{8})$/.exec(entry.passage) : null;
    addLineage(passage?.[1] ?? entry.source);
    const entries = [{ source: passage?.[1] ?? entry.source, ...(passage === null ? {} : { passage: { n: Number(passage[2]), hash: passage[3]! } }) }];
    if (!eligible({ ...claim, entries }, context)) result.timeline.add(index);
  });
  const facts = note.attributes.facts !== null && typeof note.attributes.facts === "object" ? (note.attributes.facts as Record<string, unknown>) : {};
  let unsupportedFact = false;
  for (const [key, value] of Object.entries(facts)) {
    const support = timeline.flatMap((entry, index) => entry.field === key && entry.assessment === "accepted" && String(entry.value) === String(value) ? [index] : []);
    if (support.length === 0) unsupportedFact = true;
    else if (support.every((index) => result.timeline.has(index))) result.facts.add(key);
  }

  // Passage references are judged claim by claim, whatever the note-level sources say.
  for (const [index, line] of bodyLines.entries()) {
    if (line.refs.length === 0) continue;
    const entries = line.refs.map((match) => ({ source: match[1] ?? "", passage: { n: Number(match[2]), hash: match[3] ?? "" } }));
    if (!eligible({ ...claim, entries }, context)) result.lines.add(index);
  }
  if (required.size === 0) return result;
  const resolved = { ...context, suppressions: context.suppressions.filter((entry) => required.has(entry.input)) };
  const released = noteReleased({ lineage_cleared: cleared }, resolved);
  if (released) return result;
  // Text that cannot be mapped to a claim (a body line with no passage reference, a fact no accepted timeline entry supports) fails
  // closed: the note rests on a changed input and is restricted whole until it is resolved for that input (§5.1).
  const unmapped = bodyLines.some((line) => line.refs.length === 0 && CONTENT.test(line.text));
  if (unmapped || unsupportedFact) result.whole = true;
  return result;
}

/** The note as a retrieval surface may use it (restricted statements blanked, restricted timeline entries and facts dropped), or null when restricted whole. */
export function eligibleNote(note: Note, context: Context): Note | null {
  const restriction = restrictionOf(note, context);
  if (restriction.whole) return null;
  if (restriction.lines.size === 0 && restriction.timeline.size === 0 && restriction.facts.size === 0) return note;
  const body = note.body.split(/(\r?\n)/).map((text, index) => index % 2 === 0 && restriction.lines.has(index / 2) ? " ".repeat(text.length) : text).join("");
  const attributes = { ...note.attributes };
  // A partly restricted note's one-line summary may carry the excluded text: it is not returned.
  if (restriction.lines.size > 0 || restriction.timeline.size > 0) delete attributes.summary;
  if (Array.isArray(attributes.timeline)) attributes.timeline = attributes.timeline.filter((_, index) => !restriction.timeline.has(index));
  if (attributes.facts !== null && typeof attributes.facts === "object") attributes.facts = Object.fromEntries(Object.entries(attributes.facts).filter(([key]) => !restriction.facts.has(key)));
  return { ...note, body, attributes };
}

/** The notes a derived view may render: restricted notes are left out, restricted statements, timeline entries and facts removed (§5.1). */
export function eligibleNotes(notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>): Note[] {
  const context = contextFor(notes, loaded);
  return notes.flatMap((note) => { const kept = eligibleNote(note, context); return kept === null ? [] : [kept]; });
}
