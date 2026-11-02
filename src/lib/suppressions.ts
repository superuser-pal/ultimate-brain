import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { eligible, lineageOf, noteReleased, type Context, type SourceInfo, type Suppression } from "./eligibility.ts";
import type { Note } from "./notes.ts";
import { PASSAGE_REF } from "./selection.ts";

/** Suppression records live in `_suppressions/<input id>.json` (capture-and-review §5.3, cli §5.23). */
export async function loadSuppressions(root: string): Promise<{ suppressions: Suppression[]; problems: string[] }> {
  const dir = join(root, "_suppressions");
  const suppressions: Suppression[] = [];
  const problems: string[] = [];
  let names: string[] = [];
  try { names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort(); } catch { return { suppressions, problems }; }
  for (const name of names) {
    try {
      // An append-only list of per-version records (cli §5.23); each is active until its own cleanup is resolved.
      const value = JSON.parse(await readFile(join(dir, name), "utf8")) as { input?: unknown; records?: unknown };
      const records = Array.isArray(value.records) ? (value.records as Partial<Suppression>[]) : null;
      const valid = typeof value.input === "string" && records !== null
        && records.every((record) => Number.isInteger(record.version) && Array.isArray(record.passages) && (record.status === "active" || record.status === "reconciled"));
      if (!valid) problems.push(`_suppressions/${name}: not a suppression record`);
      else for (const record of records!) suppressions.push({ ...(record as Suppression), input: value.input as string });
    } catch {
      problems.push(`_suppressions/${name}: unreadable`);
    }
  }
  return { suppressions, problems };
}

/** The eligibility context for a set of notes: every source's lineage facts plus the suppressions. */
export function contextFor(notes: readonly Note[], suppressions: Suppression[], awaitingRestore?: Set<string>): Context {
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
      ...(passages === undefined ? {} : { passages }),
    });
  }
  return { sources, suppressions, awaitingRestore };
}

export interface Restriction { whole: boolean; lines: Set<number> }
const NONE: Restriction = { whole: false, lines: new Set() };

/** What of a knowledge note a retrieval surface must not use while suppressions are active (§5.1). Body line numbers are 0-based. */
export function restrictionOf(note: Note, context: Context): Restriction {
  if (note.type === "source" || note.type === "proposal" || note.type === "view") return NONE;
  const active = new Set(context.suppressions.filter((entry) => entry.status === "active").map((entry) => entry.input));
  if (active.size === 0) return NONE;
  const sources = (Array.isArray(note.attributes.sources) ? note.attributes.sources : []).filter((value): value is string => typeof value === "string");
  const cleared = Array.isArray(note.attributes.lineage_cleared) ? (note.attributes.lineage_cleared as string[]) : [];
  const claim = { entries: [], lineage_cleared: cleared };
  // A source key written in place of an id (`url:…`, `file:…`) is its own input.
  const lineages = sources.map((id) => context.sources.has(id) || !id.includes(":") ? lineageOf(id, context.sources) : id);
  const required = new Set<string>();
  for (const lineage of lineages) {
    if (lineage === null) for (const input of active) required.add(input);
    else if (active.has(lineage)) required.add(lineage);
  }
  if (required.size === 0) return NONE;
  const lines = new Set<number>();
  let cited = false;
  for (const [index, text] of note.body.split(/\r?\n/).entries()) {
    const entries = [...text.matchAll(PASSAGE_REF)].map((match) => ({ source: match[1] ?? "", passage: { n: Number(match[2]), hash: match[3] ?? "" } }));
    if (entries.length === 0) continue;
    cited = true;
    if (!eligible({ ...claim, entries }, context)) lines.add(index);
  }
  // Text that cannot be mapped to claims fails closed: restricted whole until each relevant suppression is resolved for this note.
  if (!cited) return noteReleased({ lineage_cleared: cleared }, { ...context, suppressions: context.suppressions.filter((entry) => required.has(entry.input)) }) ? NONE : { whole: true, lines };
  return { whole: false, lines };
}
