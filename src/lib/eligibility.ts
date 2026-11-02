// Eligible evidence after an exclusion (capture-and-review §5.1 and §5.3). Pure: callers load sources, suppressions and notes.

export interface PassageRef { extract_of: string; transcript_hash: string; n: number }
/** `_suppressions/<input id>.json`: never deleted, `reconciled` only when every restricted note is resolved (§5.3). */
export interface Suppression { input: string; version: number; passages: PassageRef[]; status: "active" | "reconciled" }

/** One provenance entry of a claim: a passage reference `src-…#¶n:<hash>`, or a source without passages. */
export type Entry = { source: string; passage?: { n: number; hash: string } };

export interface SourceInfo {
  id: string; extract_of?: string; source_key?: string; replaces?: string;
  /** For an extract version: the passages it holds, as `${n}:${hash}`. */
  passages?: string[]; transcript_hash?: string; extract_version?: number;
  /** A meeting standing for its source (lineage only): never a version of anything. */
  derived?: boolean;
}

/** `note` is the claim's note: a Restore is accepted per claim, not per passage (capture-and-review §5.2). */
export interface Claim { entries: Entry[]; lineage_cleared?: string[]; context_excluded?: boolean; note?: string }

export interface Context {
  sources: Map<string, SourceInfo>;
  suppressions: Suppression[];
  /** Passage keys `${extract_of}|${transcript_hash}|${n}` that are re-included and wait for their Restore item (§5.2). */
  awaitingRestore?: Set<string>;
  /** Accepted Restores, `${extract_of}|${transcript_hash}|${n}|${note id}`: one per claim. */
  restored?: Set<string>;
}

const NOTION_KEY = /^notion:(.+)$/;

/** The input (Notion page) a source came from: `extract_of`, the `source_key`, or through the `replaces` chain (§5.1). Null = unknown lineage. */
export function lineageOf(id: string, sources: Map<string, SourceInfo>): string | null {
  // A source key written in place of an id (`url:…`, `file:…`, `notion:…`) is its own input.
  if (!sources.has(id) && id.includes(":")) return NOTION_KEY.exec(id)?.[1] ?? id;
  const seen = new Set<string>();
  for (let current = sources.get(id); current !== undefined && !seen.has(current.id); current = current.replaces === undefined ? undefined : sources.get(current.replaces)) {
    seen.add(current.id);
    if (current.extract_of !== undefined) return current.extract_of;
    const key = NOTION_KEY.exec(current.source_key ?? "");
    if (key !== null) return key[1] ?? null;
    if (current.source_key !== undefined && current.replaces === undefined) return current.source_key; // a file, url or text source is its own input
  }
  return null;
}

interface Derived { active: Set<string>; latest: Map<string, SourceInfo>; restricted: Set<string> }
const derivedCache = new WeakMap<Context, Derived>();

/** Computed once per context (O(sources)): the active inputs, the latest extract of each input and the sources no retrieval may return. */
function derived(context: Context): Derived {
  const cached = derivedCache.get(context);
  if (cached !== undefined) return cached;
  const active = new Set(context.suppressions.filter((entry) => entry.status === "active").map((entry) => entry.input));
  const real = [...context.sources.values()].filter((info) => info.derived !== true);
  const replaced = new Set(real.flatMap((info) => (info.replaces === undefined ? [] : [info.replaces])));
  const latest = new Map<string, SourceInfo>();
  for (const info of real) {
    if (info.extract_of === undefined || replaced.has(info.id)) continue;
    const held = latest.get(info.extract_of);
    if (held === undefined || (info.extract_version ?? 0) > (held.extract_version ?? 0)) latest.set(info.extract_of, info);
  }
  // Every version of an input but its latest extract, and every full copy of it, holds text that a later version may have excluded: none
  // is returned, whether or not the cleanup was reconciled (the text itself stays in Git, 0032).
  const restricted = new Set<string>();
  for (const info of real) {
    const lineage = lineageOf(info.id, context.sources);
    const head = lineage === null ? undefined : latest.get(lineage);
    if (head !== undefined && head.id !== info.id) restricted.add(info.id);
  }
  const result = { active, latest, restricted };
  derivedCache.set(context, result);
  return result;
}

/** The latest extract of every input. */
export function latestExtracts(context: Context): Map<string, SourceInfo> {
  return derived(context).latest;
}

/** The latest extract version of an input (the highest `extract_version` nobody replaces). */
export function latestOf(input: string, context: Context): SourceInfo | undefined {
  return derived(context).latest.get(input);
}

/** Whether one provenance entry is live. Fail closed: unknown lineage is never live while any suppression is active, unless every
 *  active suppression's input is in the note's `lineage_cleared` (§5.1). */
export function isLive(entry: Entry, claim: Claim, context: Context): boolean {
  const { active } = derived(context);
  const lineage = lineageOf(entry.source, context.sources);
  if (lineage === null) {
    const cleared = new Set(claim.lineage_cleared ?? []);
    return [...active].every((input) => cleared.has(input));
  }
  if (entry.passage !== undefined) {
    // A passage of an extract is live only while the latest version of its input holds it: reconciling a cleanup never makes an
    // excluded passage eligible again. A passage the latest version holds again waits for the Restore of this claim.
    const latest = latestOf(lineage, context);
    const source = context.sources.get(entry.source);
    if (latest === undefined || source === undefined || source.transcript_hash !== latest.transcript_hash) return false;
    if (!(latest.passages ?? []).includes(`${entry.passage.n}:${entry.passage.hash}`)) return false;
    const key = `${lineage}|${latest.transcript_hash}|${entry.passage.n}`;
    return !(context.awaitingRestore?.has(key) ?? false) || (claim.note !== undefined && (context.restored?.has(`${key}|${claim.note}`) ?? false));
  }
  // A whole source of an input that was ever suppressed (an older version, a full copy) is not live, reconciled or not, unless the note was
  // marked independent of that input (`lineage_cleared`, the cleanup row's Keep).
  if (claim.lineage_cleared?.includes(lineage)) return true;
  return !context.suppressions.some((entry) => entry.input === lineage);
}

/** A claim is eligible if it has at least one live entry; otherwise it is restricted (§5.1). */
export function eligible(claim: Claim, context: Context): boolean {
  return claim.entries.some((entry) => isLive(entry, claim, context));
}

/** Release is per note and per active suppression (§5.3): every active suppression must be cleared, resolved by an accepted
 *  cleanup item for this note, or its lineage established as independent. A later suppression restricts the note again. */
export function noteReleased(note: { lineage_cleared?: string[] }, context: Context, resolved: Set<string> = new Set()): boolean {
  const cleared = new Set([...(note.lineage_cleared ?? []), ...resolved]);
  return [...derived(context).active].every((input) => cleared.has(input));
}

/** Source ids whose text is suppressed in full, so retrieval skips them: the older versions and non-extract copies of a changed input. */
export function restrictedSources(context: Context): Set<string> {
  return derived(context).restricted;
}
