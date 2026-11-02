// Eligible evidence after an exclusion (capture-and-review §5.1 and §5.3). Pure: callers load sources, suppressions and notes.

export interface PassageRef { extract_of: string; transcript_hash: string; n: number }
/** `_suppressions/<input id>.json`: never deleted, `reconciled` only when every restricted note is resolved (§5.3). */
export interface Suppression { input: string; version: number; passages: PassageRef[]; status: "active" | "reconciled" }

/** One provenance entry of a claim: a passage reference `src-…#¶n:<hash>`, or a source without passages. */
export type Entry = { source: string; passage?: { n: number; hash: string } };

export interface SourceInfo {
  id: string; extract_of?: string; source_key?: string; replaces?: string;
  /** For an extract version: the passages it holds, as `${n}:${hash}`. */
  passages?: string[]; transcript_hash?: string;
}

export interface Claim { entries: Entry[]; lineage_cleared?: string[]; context_excluded?: boolean }

export interface Context {
  sources: Map<string, SourceInfo>;
  suppressions: Suppression[];
  /** Passage keys `${extract_of}|${transcript_hash}|${n}` that are re-included and wait for their Restore item (§5.2). */
  awaitingRestore?: Set<string>;
}

const NOTION_KEY = /^notion:(.+)$/;

/** The input (Notion page) a source came from: `extract_of`, the `source_key`, or through the `replaces` chain (§5.1). Null = unknown lineage. */
export function lineageOf(id: string, sources: Map<string, SourceInfo>): string | null {
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

function activeInputs(suppressions: Suppression[]): Set<string> {
  return new Set(suppressions.filter((entry) => entry.status === "active").map((entry) => entry.input));
}

/** The latest extract version of an input: the source nobody `replaces`, among the extracts of that input. */
function latestExtract(input: string, sources: Map<string, SourceInfo>): SourceInfo | undefined {
  const versions = [...sources.values()].filter((entry) => entry.extract_of === input);
  const replaced = new Set(versions.map((entry) => entry.replaces));
  return versions.find((entry) => !replaced.has(entry.id));
}

/** Whether one provenance entry is live. Fail closed: unknown lineage is never live while any suppression is active, unless every
 *  active suppression's input is in the note's `lineage_cleared` (§5.1). */
export function isLive(entry: Entry, claim: Claim, context: Context): boolean {
  const active = activeInputs(context.suppressions);
  const lineage = lineageOf(entry.source, context.sources);
  if (lineage === null) {
    const cleared = new Set(claim.lineage_cleared ?? []);
    return [...active].every((input) => cleared.has(input));
  }
  if (!active.has(lineage)) return true;
  if (entry.passage === undefined) return false; // an older full copy or a whole source of a changed input
  const latest = latestExtract(lineage, context.sources);
  const source = context.sources.get(entry.source);
  if (latest === undefined || source === undefined || source.transcript_hash !== latest.transcript_hash) return false;
  if (!(latest.passages ?? []).includes(`${entry.passage.n}:${entry.passage.hash}`)) return false;
  return !(context.awaitingRestore?.has(`${lineage}|${latest.transcript_hash}|${entry.passage.n}`) ?? false);
}

/** A claim is eligible if it has at least one live entry; otherwise it is restricted (§5.1). */
export function eligible(claim: Claim, context: Context): boolean {
  return claim.entries.some((entry) => isLive(entry, claim, context));
}

/** Release is per note and per active suppression (§5.3): every active suppression must be cleared, resolved by an accepted
 *  cleanup item for this note, or its lineage established as independent. A later suppression restricts the note again. */
export function noteReleased(note: { lineage_cleared?: string[] }, context: Context, resolved: Set<string> = new Set()): boolean {
  const cleared = new Set([...(note.lineage_cleared ?? []), ...resolved]);
  return [...activeInputs(context.suppressions)].every((input) => cleared.has(input));
}

/** Source ids whose text is suppressed in full, so retrieval skips them: the older versions and non-extract copies of a changed input. */
export function restrictedSources(context: Context): Set<string> {
  const active = activeInputs(context.suppressions);
  const result = new Set<string>();
  for (const info of context.sources.values()) {
    const lineage = lineageOf(info.id, context.sources);
    if (lineage !== null && active.has(lineage) && latestExtract(lineage, context.sources)?.id !== info.id) result.add(info.id);
  }
  return result;
}
