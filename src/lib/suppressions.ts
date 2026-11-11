import { readFileSync, readdirSync } from "node:fs";
import { join, posix } from "node:path";

import { eligible, latestExtracts, lineageOf, noteReleased, restrictedSources, type Context, type SourceInfo, type Suppression } from "./eligibility.ts";
import { BrainError } from "./errors.ts";
import type { Note } from "./notes.ts";
import { viewLinks } from "./report-body.ts";
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
        ? Number.isInteger(record.extract_version) && Array.isArray(record.items) && (record.items as unknown[]).every((item) => item !== null && typeof item === "object" && typeof (item as { note?: unknown }).note === "string" && Number.isInteger((item as { n?: unknown }).n))
        : Number.isInteger(record.version) && Array.isArray(record.passages) && (record.passages as unknown[]).every((passage) => passage !== null && typeof passage === "object" && Number.isInteger((passage as { n?: unknown }).n)) && (record.status === "active" || record.status === "reconciled"));
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
    if (note.type === "meeting" && typeof note.attributes.source === "string") sources.set(note.id, { id: note.id, replaces: note.attributes.source, derived: true });
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
  const context: Context = { sources, suppressions: loaded.suppressions, awaitingRestore: awaiting, restored };
  let withheld: Set<string> | undefined;
  context.withheldPaths = () => (withheld ??= withheldNotePaths(notes, context));
  const latest = latestExtracts(context);
  for (const [input, info] of latest) {
    const version = info.extract_version ?? 0;
    const removed = new Set(loaded.suppressions.filter((entry) => entry.input === input && entry.version < version).flatMap((entry) => entry.passages.map((passage) => `${passage.transcript_hash}|${passage.n}`)));
    for (const entry of info.passages ?? []) {
      const n = entry.split(":")[0]!;
      if (removed.has(`${info.transcript_hash}|${n}`)) awaiting.add(`${input}|${info.transcript_hash}|${n}`);
    }
    // A Restore accepted at an earlier version still stands for a later version that holds the passage, unless a suppression removed the
    // passage again after it (then it must be restored anew).
    for (const entry of (loaded.restores ?? []).filter((candidate) => candidate.input === input && candidate.extract_version <= version)) {
      for (const item of entry.items) {
        const removedAfter = loaded.suppressions.some((s) => s.input === input && s.version > entry.extract_version && s.version <= version && s.passages.some((p) => p.n === item.n && p.transcript_hash === info.transcript_hash));
        if (!removedAfter) restored.add(`${input}|${info.transcript_hash}|${item.n}|${item.note}`);
      }
    }
  }
  return context;
}

/** `summary`: the note rests on a changed input and is not resolved for it, so its frontmatter summary (which may come from excluded text) is not returned. */
export interface Restriction { whole: boolean; lines: Set<number>; timeline: Set<number>; facts: Set<string>; summary: boolean }
const NONE = (): Restriction => ({ whole: false, lines: new Set(), timeline: new Set(), facts: new Set(), summary: false });
// Only an empty line is structure: a heading or a comment can carry excluded text, so it counts as unmapped content.
const CONTENT = /^(?!\s*$)/;
const CONTENT_LENIENT = /^(?!#{1,6}\s|<!--|\s*$)/;
// A source or meeting id, even one that names no note, and a source key that is its own input (schema §1).
const INPUT_REF = /^(?:(?:src|mtg)-[0-9a-z]{8}|(?:notion|url|file):.+)$/;

/** Whether a provenance entry names an input a suppression can change. A knowledge note or memory id, an agent session (`agent:…`),
 *  `notion-edit` or `user-correction:…` names none: it has no input lineage and is live (capture-and-review §5.1). */
function namesInput(id: string, context: Context): boolean {
  return context.sources.has(id) || INPUT_REF.test(id);
}

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
  // Provenance is `sources`, and for a meeting its required `source` field too (schema §3).
  const sources = [...(Array.isArray(note.attributes.sources) ? note.attributes.sources : []), ...(typeof note.attributes.source === "string" ? [note.attributes.source] : [])].filter((value): value is string => typeof value === "string");
  const cleared = Array.isArray(note.attributes.lineage_cleared) ? (note.attributes.lineage_cleared as string[]) : [];
  const claim = { entries: [], lineage_cleared: cleared, note: note.id };
  const required = new Set<string>();
  const ever = new Set(context.suppressions.map((entry) => entry.input));
  const addLineage = (id: string) => {
    if (!namesInput(id, context)) return;
    const lineage = lineageOf(id, context.sources);
    if (lineage === null) for (const input of active) required.add(input);
    else if (ever.has(lineage)) required.add(lineage); // reconciled or active: a reconciled cleanup does not free text it left in place
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
    if (passage === null && !namesInput(entry.source, context)) return; // your edit in Notion, a corrected Review item: live
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
  const activeNeeded = [...required].filter((input) => active.has(input));
  result.summary = [...required].some((input) => !cleared.includes(input));
  const resolved = { ...context, suppressions: context.suppressions.filter((entry) => activeNeeded.includes(entry.input)) };
  const releasedActive = activeNeeded.length === 0 || noteReleased({ lineage_cleared: cleared }, resolved);
  const releasedAll = [...required].every((input) => cleared.includes(input));
  // Text that cannot be mapped to a claim (a body line with no passage reference, a fact no accepted timeline entry supports) fails
  // closed: the note rests on a changed input and is restricted whole until it is resolved for that input (§5.1). While a suppression
  // is active a heading or comment counts as text; once the cleanup is reconciled a corrected note keeps its headings.
  const strict = activeNeeded.length > 0 && !releasedActive;
  if (!strict && releasedAll) return result;
  const unmapped = bodyLines.some((line) => line.refs.length === 0 && (strict ? CONTENT : CONTENT_LENIENT).test(line.text));
  if (unmapped || unsupportedFact) result.whole = true;
  return result;
}

/** A note with restricted claims and nothing eligible left: no content line outside the restricted ones (its summary is dropped with them) and
 *  no live fact. Retrieval leaves it out whole rather than return its title alone (§5.1); it is not a lineage defect, so `whole` stays false. */
function nothingLeft(note: Note, restriction: Restriction): boolean {
  if (restriction.lines.size === 0 && restriction.timeline.size === 0) return false;
  if (note.body.split(/\r?\n/).some((text, index) => !restriction.lines.has(index) && CONTENT_LENIENT.test(text))) return false;
  const facts = note.attributes.facts !== null && typeof note.attributes.facts === "object" ? Object.keys(note.attributes.facts as Record<string, unknown>) : [];
  return facts.every((key) => restriction.facts.has(key));
}

/** The note as a retrieval surface may use it (restricted statements blanked, restricted timeline entries and facts dropped), or null when restricted
 *  whole or nothing eligible is left. */
export function eligibleNote(note: Note, context: Context): Note | null {
  const restriction = restrictionOf(note, context);
  if (restriction.whole || nothingLeft(note, restriction)) return null;
  return partlyRestricted(note, restriction);
}

function partlyRestricted(note: Note, restriction: Restriction): Note {
  if (restriction.lines.size === 0 && restriction.timeline.size === 0 && restriction.facts.size === 0 && !restriction.summary) return note;
  const body = note.body.split(/(\r?\n)/).map((text, index) => index % 2 === 0 && restriction.lines.has(index / 2) ? " ".repeat(text.length) : text).join("");
  const attributes = { ...note.attributes };
  // A partly restricted note's one-line summary may carry the excluded text: it is not returned.
  // Aliases rank a note by text the user may have excluded; both go for a note that is only partly returned.
  if (restriction.summary || restriction.lines.size > 0 || restriction.timeline.size > 0) { delete attributes.summary; delete attributes.aliases; }
  if (Array.isArray(attributes.timeline)) attributes.timeline = attributes.timeline.filter((_, index) => !restriction.timeline.has(index));
  if (attributes.facts !== null && typeof attributes.facts === "object") attributes.facts = Object.fromEntries(Object.entries(attributes.facts).filter(([key]) => !restriction.facts.has(key)));
  return { ...note, body, attributes };
}

/** The notes a derived view may render (cli §5.9): a note restricted whole, or with nothing eligible left, is left out; restricted statements,
 *  timeline entries and facts are removed; a note with a restricted claim is in the awaiting-cleanup form, which a view shows by type and id. */
export function eligibleNotes(notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>): AnswerNote[] {
  const context = contextFor(notes, loaded);
  return notes.flatMap((note) => { const kept = answerNote(note, context); return kept === null ? [] : [kept]; });
}

/** The notes the index may describe: every note stays listed (it may be independently supported), each in its published form (cli §5.8). A view
 *  the derived-content rule withholds keeps no title or summary when `views` is given (eligibility.md §6 rule 5, §8). */
export function indexNotes(notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>, views?: { exists: (path: string) => boolean }): AnswerNote[] {
  const context = contextFor(notes, loaded);
  const dependencies = views === undefined ? undefined : viewDependencies(notes, views.exists);
  return notes.map((note) => {
    if (note.type === "view" && dependencies !== undefined && withheldView(note, dependencies, context) !== null) return withheldViewForm(note);
    return publishableNote(note, context);
  });
}

/**
 * One note in the form a published surface shows (the index, the views' owners, Notion's `sync plan` and `sync render`; eligibility.md §6
 * rule 5, cli §5.8 and §5.14.4): a note restricted whole, or with a restricted claim, in the awaiting-cleanup form with no title, aliases,
 * summary, tags or free text (restricted whole: no body, facts or timeline either); a note whose only change is a dropped summary keeps its title.
 * A source keeps its title, the name of the input it records; one restricted whole loses its summary, aliases and body.
 */
export function publishableNote(note: Note, context: Context): AnswerNote {
  const restriction = restrictionOf(note, context);
  if (restriction.whole) {
    const attributes = { ...note.attributes };
    delete attributes.summary;
    // Aliases are text the brain wrote from the note's evidence: they go with the summary.
    delete attributes.aliases;
    if ("facts" in attributes) attributes.facts = {};
    if ("timeline" in attributes) attributes.timeline = [];
    const stripped = { ...note, attributes, body: "" };
    return note.type === "source" ? stripped : awaitingCleanup(stripped);
  }
  const kept = partlyRestricted(note, restriction);
  return withoutWithheldLinks(note.type !== "source" && hasRestrictedClaim(restriction) ? awaitingCleanup(kept) : kept, context);
}

/** How a published surface names a note: its title, or the label of the awaiting-cleanup form. */
export function publishedTitle(note: Note): string | undefined {
  if (titleWithheld(note)) return citeLabel(note);
  return typeof note.attributes.title === "string" ? note.attributes.title : undefined;
}

/**
 * Whether a proposed change rests on excluded evidence and is withheld whole (eligibility.md §4.2, cli §5.7 "Excluded evidence"): such a
 * proposal is never written and never applied, neither whole nor in part. `text` is the wording it would put into the brain, when it has one.
 *
 * With passage references in the text, only the lines that carry one are judged, each as a claim of a note resting on `source`: the change is
 * withheld when any such line is restricted, even beside a live one (a mixed item). A line with no reference (a heading, an `^[inferred]`
 * sentence) is the agent's own framing of the claims beside it and decides nothing. Without any reference, the change is withheld when
 * `source` is an older version or a full copy of a changed input, which retrieval no longer returns.
 */
export function restsOnExcluded(source: unknown, text: string | null, context: Context): boolean {
  if (context.suppressions.length === 0) return false;
  const sources = typeof source === "string" ? [source] : [];
  const claims = text === null ? [] : text.split(/\r?\n/).filter((line) => [...line.matchAll(PASSAGE_REF)].length > 0);
  if (claims.length > 0) {
    const body = claims.join("\n");
    const note: Note = { id: "", type: "decision", path: "", attributes: { sources }, body, raw: body };
    return restrictionOf(note, context).lines.size > 0;
  }
  return sources.some((id) => restrictedSources(context).has(id));
}

/** Whether a text carries a passage reference `^[src-…#¶n:hash]`. */
export function citesPassage(text: string): boolean {
  return [...text.matchAll(PASSAGE_REF)].length > 0;
}

/** A frontmatter timestamp in the schema's form (`2026-11-10T09:30:00Z`, note.schema.json) as milliseconds; anything else is NaN. */
function stamp(value: unknown): number {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) ? Date.parse(value) : Number.NaN;
}

/** Why a view is withheld and what rebuilds it (cli §5.13.1, "Views"; eligibility.md §8 rule 6). */
export interface WithheldView { readonly cause: "dependency" | "stale" | "unreadable"; readonly rebuild: "refresh" | "views" }

/** What judging a view needs: the notes by id, the notes a view's body links (`gone` when a `.md` link names no note and no file), and,
 *  on an answer surface, whether a memory is one the caller may be shown. */
export interface ViewDependencies {
  readonly byId: ReadonlyMap<string, Note>;
  readonly links: (view: Note) => { linked: readonly string[]; gone: boolean };
  readonly memory?: (note: Note) => boolean;
}

/** The dependencies of the views of a brain read from `notes`, with `exists` saying whether a path from the brain's root is a file. */
export function viewDependencies(notes: readonly Note[], exists: (path: string) => boolean, memory?: (note: Note) => boolean): ViewDependencies {
  const cache = new Map<string, { linked: readonly string[]; gone: boolean }>();
  return {
    byId: new Map(notes.map((note) => [note.id, note])),
    links: (view) => { let links = cache.get(view.id); if (links === undefined) { links = viewLinks(notes, view, exists); cache.set(view.id, links); } return links; },
    ...(memory === undefined ? {} : { memory }),
  };
}

/**
 * Whether a view is withheld whole, and why (cli §5.13.1, "Views"; eligibility.md §8). A view is text written from notes (a Brief, a Decision log)
 * or by a skill (a report), with no passage references of its own, so it is one item, read whole or withheld whole. While the brain has a
 * suppression record it is withheld when, in this order:
 * - `dependency`: a note in its `generated_from` or linked from its body is restricted in any part, not eligible (a proposal; a memory not
 *   eligible), gone, or a view this rule withholds, followed to any depth and each view once (a cycle adds nothing);
 * - `stale`: it is a report not written after (a later second than) every extract version that carries a suppression record, active or
 *   reconciled: a cleanup never makes an older report fresh, only a refresh does;
 * - `unreadable`: its `generated_from` is not a list of ids, or, for a report, a time on either side can't be read (fail closed).
 */
export function withheldView(view: Note, dependencies: ViewDependencies, context: Context): WithheldView | null {
  if (context.suppressions.length === 0) return null;
  const rebuild = view.attributes.view_kind === "report" ? "refresh" : "views";
  const verdict = judgeView(view, dependencies, context, new Set());
  return verdict === null ? null : { cause: verdict, rebuild };
}

function judgeView(view: Note, dependencies: ViewDependencies, context: Context, judging: Set<string>): WithheldView["cause"] | null {
  judging.add(view.id);
  const from = view.attributes.generated_from;
  const provenance = Array.isArray(from) && from.every((id) => typeof id === "string") ? from as string[] : null;
  const links = dependencies.links(view);
  if (links.gone) return "dependency";
  for (const id of new Set([...(provenance ?? []), ...links.linked])) {
    const note = dependencies.byId.get(id);
    if (note === undefined || !dependencyEligible(note, dependencies, context, judging)) return "dependency";
  }
  if (view.attributes.view_kind !== "report") return provenance === null ? "unreadable" : null;
  const written = stamp(view.attributes.generated_at);
  const captured = new Map<string, number>();
  for (const note of dependencies.byId.values()) {
    const key = `${String(note.attributes.extract_of)}\u0000${String(note.attributes.extract_version)}`;
    if (note.type === "source" && typeof note.attributes.extract_of === "string" && typeof note.attributes.extract_version === "number" && !captured.has(key)) captured.set(key, stamp(note.attributes.captured));
  }
  let unreadable = provenance === null || Number.isNaN(written);
  for (const record of context.suppressions) {
    // A record of either status: the report may restate what that version removed, and the cleanup never edited it.
    const time = captured.get(`${record.input}\u0000${String(record.version)}`) ?? Number.NaN;
    if (Number.isNaN(time)) unreadable = true;
    else if (!Number.isNaN(written) && !(written > time)) return "stale";
  }
  return unreadable ? "unreadable" : null;
}

/** Whether a note a view rests on leaves it safe to show: a view by this rule (each once), a memory as the surface would show it, any other
 *  note with no restricted part at all. A proposal is never evidence. */
function dependencyEligible(note: Note, dependencies: ViewDependencies, context: Context, judging: Set<string>): boolean {
  if (note.type === "proposal") return false;
  if (note.type === "view") return judging.has(note.id) || judgeView(note, dependencies, context, judging) === null;
  if (note.type === "memory" && !(dependencies.memory?.(note) ?? currentMemory(note))) return false;
  const restriction = restrictionOf(note, context);
  return !(restriction.whole || restriction.lines.size > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0 || restriction.summary);
}

/** A memory a published surface may rest on, with no caller to judge reach by: reviewed and superseded by nothing (memory.md §2 rules 1, 2). */
function currentMemory(note: Note): boolean {
  const superseded = Array.isArray(note.attributes.relations) && note.attributes.relations.some((relation) => relation !== null && typeof relation === "object" && (relation as { type?: unknown }).type === "superseded_by");
  return note.attributes.lifecycle === "reviewed" && !superseded;
}

/** A view the rule withholds, as a published surface lists it: no title, summary or aliases (cli §5.8). */
function withheldViewForm(view: Note): AnswerNote {
  const attributes = { ...view.attributes };
  delete attributes.title;
  delete attributes.summary;
  delete attributes.aliases;
  return { ...view, attributes, titleWithheld: true };
}

// --- The answer surfaces' form of a note (CC-176; spec/eligibility.md §6 rules 2 to 4, cli.md §5.13 "The awaiting-cleanup form") ---------

/** A note as an answer surface returns it. `titleWithheld`: it has a restricted claim, so its title, path, tags, free-text fields, headings and
 *  comments are withheld and it is cited as `citeLabel` gives (the awaiting-cleanup form). */
export type AnswerNote = Note & { readonly titleWithheld?: true };

/** Frontmatter that names no content: ids, dates, enumerations, relations, the claims the rule leaves in and the Notion fields you set. */
const CONTENT_FREE = new Set([
  "id", "type", "created", "updated", "lifecycle", "assessment", "date", "valid_from", "valid_until", "lineage_cleared", "area", "projects", "sources",
  "relations", "facts", "timeline", "notion", "last_synced", "notion_fields",
  "domain", "org", "goal", "client", "people", "attendees", "source", "decisions", "questions", "tasks", "passage", "decided_in", "deciders", "workflow",
  "kind", "raised_in", "dropped", "task", "origin", "promoted_from", "scope", "areas", "stacks", "confidence",
  "source_key", "content_hash", "captured", "origin_edited", "attached_to", "extract", "extract_of", "extract_version", "transcript_hash", "selection",
  "passages", "replaces", "task_items", "repo", "commit", "converter", "notion_text", "notion_parts",
]);
/** Every field the schema defines that holds free text or names the subject; never kept, whatever its value looks like. */
const FREE_TEXT = new Set(["title", "summary", "aliases", "tags", "why", "digest", "only_keep", "keep", "file_name", "repo_path", "notion_published", "answer"]);
const NOTE_ID = /^(?:area|dom|gol|prj|per|org|mtg|dec|que|con|ref|src|mem|prp|vw)-[0-9a-z]{8}$/;
const DATE = /^\d{4}-\d{2}(?:-\d{2}(?:T[0-9:.]+Z)?)?$/;
/** The fixed sections schema §4 defines for a type: they name no content. */
const FIXED_SECTIONS: Readonly<Record<string, readonly string[]>> = { decision: ["## Decision", "## Context", "## Consequences", "## Sources"] };
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/;

/** A value of a field the schema doesn't define is kept only when it can carry no text: a number, a boolean, an id or a date, at any depth. */
function contentFree(value: unknown): boolean {
  if (value === null || typeof value === "number" || typeof value === "boolean") return true;
  if (typeof value === "string") return NOTE_ID.test(value) || DATE.test(value);
  if (Array.isArray(value)) return value.every(contentFree);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(contentFree);
  return false;
}

/** Whether the rule restricts a claim of the note: a body line, a timeline entry or a fact. A dropped summary alone is no restricted claim.
 *  A fact is dropped only when every entry that supports it is (`restrictionOf`), so a dropped fact always comes with a dropped entry; the
 *  fact is named for what cli.md §5.13 says, not as a separate case. */
function hasRestrictedClaim(restriction: Restriction): boolean {
  return restriction.lines.size > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0;
}

/** The awaiting-cleanup form of a note the rule leaves partly in: no title, tags or free text; headings and comments as spaces. */
function awaitingCleanup(note: Note): AnswerNote {
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(note.attributes)) {
    if (key === "answer" && typeof value === "string" && NOTE_ID.test(value)) attributes[key] = value;
    else if (FREE_TEXT.has(key)) continue;
    else if (CONTENT_FREE.has(key) || contentFree(value)) attributes[key] = value;
  }
  // A timeline entry's `note` is free text the ingest wrote (schema §5).
  if (Array.isArray(attributes.timeline)) {
    attributes.timeline = (attributes.timeline as unknown[]).map((entry) => {
      if (entry === null || typeof entry !== "object" || !("note" in entry)) return entry;
      const { note: _note, ...rest } = entry as Record<string, unknown>;
      return rest;
    });
  }
  const fixed = FIXED_SECTIONS[note.type] ?? [];
  let comment = false;
  const body = note.body.split(/(\r?\n)/).map((text, index) => {
    if (index % 2 === 1) return text;
    const opens = !comment && text.trimStart().startsWith("<!--");
    const hidden = comment || opens || (HEADING.test(text) && !fixed.includes(text.trimEnd()));
    if (opens || comment) comment = !text.includes("-->", opens ? text.indexOf("<!--") + 4 : 0);
    return hidden ? " ".repeat(text.length) : text;
  }).join("");
  return { ...note, attributes, body, titleWithheld: true };
}

/** The paths of the notes the rule names by type and id (a restricted claim) or leaves out whole; a source, a proposal and a view are never among them. */
function withheldNotePaths(notes: readonly Note[], context: Context): Set<string> {
  const paths = new Set<string>();
  if (context.suppressions.length === 0) return paths;
  for (const note of notes) {
    if (note.type === "source" || note.type === "proposal" || note.type === "view") continue;
    const restriction = restrictionOf(note, context);
    if (restriction.whole || hasRestrictedClaim(restriction) || nothingLeft(note, restriction)) paths.add(note.path);
  }
  return paths;
}

// An inline link or image, with an optional title: `[text](target)`, `![alt](<target> "title")`.
const BODY_LINK = /(!?)\[((?:\\.|[^\]\\])*)\]\(\s*(?:<([^>\n]*)>|([^)\s]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)/g;
// A link reference definition: `[label]: target "title"`, a line of its own.
const LINK_DEFINITION = /^ {0,3}\[(?:\\.|[^\]\\])+\]:[ \t]*(?:<([^>\n]*)>|(\S+))(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/gm;
// A target in angle brackets on its own: `<../decisions/budget-cut-to-40k.md>`.
const ANGLE_TARGET = /<([^>\s:]+\.md(?:[?#][^>\s]*)?)>/gi;

/**
 * The note with every relative link in its body to a note in `context.withheldPaths()` reduced to what names no file (cli §5.13, "A link to such a
 * note", the user's answer of 2026-11-11 to CC-176's question 4): an inline link or image to its text (`See [the decision](../decisions/
 * 2026-10-11-budget-cut-to-40k.md "Budget")` becomes `See the decision`), a reference definition to spaces of the same length (its uses then name
 * nothing), a target in angle brackets to nothing. The target is the note's file name, which repeats its title. Any other link is kept as written.
 */
export function withoutWithheldLinks<T extends Note>(note: T, context: Context): T {
  const withheld = context.withheldPaths?.();
  if (withheld === undefined || withheld.size === 0) return note;
  const folder = posix.dirname(note.path);
  const names = (target: string): boolean => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return false;
    let decoded = target.split(/[?#]/)[0]!;
    try { decoded = decodeURIComponent(decoded); } catch { /* keep as written */ }
    return withheld.has(posix.normalize(posix.join(folder, decoded)));
  };
  const body = note.body
    .replace(BODY_LINK, (link, _image: string, text: string, angled: string | undefined, bare: string | undefined) => names((angled ?? bare ?? "").trim()) ? text : link)
    .replace(LINK_DEFINITION, (line, angled: string | undefined, bare: string | undefined) => names((angled ?? bare ?? "").trim()) ? " ".repeat(line.length) : line)
    .replace(ANGLE_TARGET, (link, target: string) => names(target) ? "" : link);
  return body === note.body ? note : { ...note, body };
}

/**
 * A note as an answer surface returns it (`query --candidates` and `--read`, `recall`, `reflect --candidates`; eligibility.md §2, §6): the
 * restricted-evidence rule's form (`eligibleNote`), and, when a claim of it is restricted, the awaiting-cleanup form; null when the rule leaves it
 * out whole. The published surfaces use `publishableNote` (eligibility.md §6 rule 5).
 */
export function answerNote(note: Note, context: Context): AnswerNote | null {
  const restriction = restrictionOf(note, context);
  if (restriction.whole || nothingLeft(note, restriction)) return null;
  const kept = partlyRestricted(note, restriction);
  return withoutWithheldLinks(hasRestrictedClaim(restriction) ? awaitingCleanup(kept) : kept, context);
}

/** Whether an answer surface withholds the note's title and path (the awaiting-cleanup form). */
export function titleWithheld(note: Note): boolean {
  return (note as AnswerNote).titleWithheld === true;
}

/** The label an answer cites a note in the awaiting-cleanup form by (eligibility.md §6 rules 3 and 4). */
export function citeLabel(note: Note): string {
  return `${note.type} ${note.id}, title withheld: awaiting cleanup`;
}
