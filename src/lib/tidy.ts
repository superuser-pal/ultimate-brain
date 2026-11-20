import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { promisify } from "node:util";
import { isDeepStrictEqual } from "node:util";

import { caseSensitiveExists, proseLines } from "./lint.ts";
import { decodePath, linkTargets } from "./lint-links.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { bodyHash } from "./proposals.ts";
import { KNOWLEDGE_TYPES, mergeFingerprint, referencesOf } from "./reflect.ts";
import { contextFor, restrictionOf, type Loaded } from "./suppressions.ts";
import { formatTimestamp } from "./time.ts";

// The weekly clean-up's mechanical items (spec/weekly-review.md §15.2, cli.md §5.38 `cleanup plan`): a closed list of five kinds, found
// deterministically. A rule that doesn't hold exactly makes the case no item.

const exec = promisify(execFile);

export type TidyKind = "pair_half" | "moved_link" | "repeated_value" | "exact_duplicate" | "stale_draft";
const ORDER: readonly TidyKind[] = ["pair_half", "moved_link", "repeated_value", "exact_duplicate", "stale_draft"];

export interface TidyItem {
  tidy: TidyKind;
  title: string;
  why: string;
  fingerprint: string;
  targets: string[];
  paths: string[];
  proposal_input: Record<string, unknown>;
}

export interface TidyPlan { items: TidyItem[]; held: number }

/** Days a never-reviewed draft waits before it is archived alone (§15.2 `stale_draft`). */
export const STALE_DRAFT_DAYS = 60;
const DUPLICATE_TYPES = new Set(["project", "decision", "question", "reference"]);
const WAITING = new Set(["pending", "approved", "edited"]);
const TEXT_ORIGINS = new Set(["whole", "part", "workflow", "promoted"]);

/** The source of every clean-up proposal: the weekly review's agent session at the run's instant (cli.md §5.38). */
export function cleanupSource(now: Date): string {
  return `agent:brain-weekly-review/${formatTimestamp(now).replace(/[-:]/g, "")}`;
}

/** Never a target (§15.2): a source, a meeting, a memory, a view, a proposal, a whole text or the user's text. A meeting's pair sides and
 *  repeated values are the exception, `meetingSide`: they are structure the brain keeps, not the meeting's text. */
function neverTarget(note: Note, meetingSide = false): boolean {
  if (note.type === "meeting") return !meetingSide;
  if (note.type === "source" || note.type === "memory" || note.type === "view" || note.type === "proposal") return true;
  if (note.type === "reference" && TEXT_ORIGINS.has(String(note.attributes.origin))) return true;
  return !KNOWLEDGE_TYPES.has(note.type);
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});
const titleOf = (note: Note): string => String(note.attributes.title ?? note.id);
const quoted = (note: Note): string => `"${titleOf(note)}"`;
const short = (title: string): string => (title.length > 120 ? `${title.slice(0, 119)}…` : title);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Find the mechanical items now (cli.md §5.38 `plan`). `held` counts those left out because their fingerprint was undone or declined before.
 * An item whose fingerprint lives in a Weekly row (`weekly` set; with `week`, a row of another week) or is being applied (`approved`, `edited`)
 * is left out too, uncounted: it is already somebody's question. A pending one with no row (queued, or written while `settings.cleanup.auto`
 * was off) is found again, and so is one of `week`'s own row, so a same-week rerun offers it with its label.
 * Declined means rejected: a proposal turned down ends `closed` with `decision.action: reject` (schema §11.2).
 */
export async function findTidyItems(root: string, notes: readonly Note[], loaded: Pick<Loaded, "suppressions"> & Partial<Pick<Loaded, "restores">>, now: Date, localDate: string, week?: string): Promise<TidyPlan> {
  const context = contextFor(notes, loaded);
  const restricted = (note: Note): boolean => {
    const r = restrictionOf(note, context);
    return r.whole || r.lines.size > 0 || r.timeline.size > 0 || r.facts.size > 0 || r.summary;
  };
  const byId = new Map<string, Note>();
  for (const note of notes) if (!byId.has(note.id)) byId.set(note.id, note);
  const source = cleanupSource(now);
  const found: TidyItem[] = [
    ...pairHalves(notes, byId, restricted, source),
    ...await movedLinks(root, notes, restricted, source),
    ...repeatedValues(notes, restricted, source),
    ...exactDuplicates(notes, byId, restricted, source),
    ...staleDrafts(notes, restricted, source, localDate),
  ];
  const proposals = notes.filter((note) => note.type === "proposal" && typeof note.attributes.fingerprint === "string");
  const rejected = (p: Note) => p.attributes.status === "rejected" || (p.attributes.status === "closed" && record(p.attributes.decision).action === "reject");
  const heldPrints = new Set(proposals.filter((p) => (p.attributes.status === "closed" && p.attributes.closed_reason === "undone") || rejected(p)).map((p) => String(p.attributes.fingerprint)));
  const busy = new Set(proposals.filter((p) => ["approved", "edited"].includes(String(p.attributes.status)) || (p.attributes.status === "pending" && typeof p.attributes.weekly === "string" && p.attributes.weekly !== week)).map((p) => String(p.attributes.fingerprint)));
  const items: TidyItem[] = [];
  let held = 0;
  for (const item of found) {
    if (heldPrints.has(item.fingerprint)) { held += 1; continue; }
    if (busy.has(item.fingerprint)) continue;
    items.push(item);
  }
  items.sort((a, b) => ORDER.indexOf(a.tidy) - ORDER.indexOf(b.tidy) || compareCodePoints(a.targets[0]!, b.targets[0]!) || compareCodePoints(a.fingerprint, b.fingerprint));
  return { items, held };
}

function input(kind: string, tidy: TidyKind, title: string, why: string, fingerprint: string, source: string, fields: Record<string, unknown>): Record<string, unknown> {
  return { kind, tidy, title, why, ...fields, source, passages: [source], fingerprint, evidence: [] };
}

function structural(tidy: "pair_half" | "repeated_value", target: Note, field: string, after: unknown, title: string, why: string, source: string): TidyItem {
  const fingerprint = `tidy:${tidy}:${target.id}:${field}`;
  const before = target.attributes[field];
  return {
    tidy, title: short(title), why, fingerprint, targets: [target.id], paths: [target.path],
    proposal_input: input("fix_structure", tidy, short(title), why, fingerprint, source, { target: target.id, field, ...(before === undefined ? {} : { before: structuredClone(before) }), after }),
  };
}

/** `pair_half`: a meeting pair or a supersession pair with one side, the other side empty for it (lint `meeting-backref`, `supersession-pair`). */
function pairHalves(notes: readonly Note[], byId: ReadonlyMap<string, Note>, restricted: (note: Note) => boolean, source: string): TidyItem[] {
  const items: TidyItem[] = [];
  const usable = (note: Note | undefined, meetingSide: boolean): note is Note => note !== undefined && !neverTarget(note, meetingSide) && !restricted(note);
  for (const [field, listField, type, noun] of [["decided_in", "decisions", "decision", ["decision", "decisions"]], ["raised_in", "questions", "question", ["question", "questions"]]] as const) {
    // A meeting's list lacks a note that names the meeting.
    const missing = new Map<string, Note[]>();
    for (const note of notes) {
      if (note.type !== type || typeof note.attributes[field] !== "string" || !usable(note, false)) continue;
      const meeting = byId.get(note.attributes[field] as string);
      if (meeting?.type !== "meeting" || !usable(meeting, true) || list(meeting.attributes[listField]).includes(note.id)) continue;
      missing.set(meeting.id, [...(missing.get(meeting.id) ?? []), note]);
    }
    for (const [id, added] of missing) {
      const meeting = byId.get(id)!;
      const sorted = [...added].sort((a, b) => compareCodePoints(a.id, b.id));
      const title = sorted.length === 1 ? `Add ${quoted(sorted[0]!)} to the meeting ${quoted(meeting)}` : `Add ${plural(sorted.length, noun[0], noun[1])} to the meeting ${quoted(meeting)}`;
      const why = `${sorted.length === 1 ? `The ${type} names` : `These ${noun[1]} name`} this meeting in ${field}, but the meeting's ${listField} doesn't list ${sorted.length === 1 ? "it" : "them"}.`;
      items.push(structural("pair_half", meeting, listField, [...list(meeting.attributes[listField]), ...sorted.map((note) => note.id)], title, why, source));
    }
    // A note a meeting lists, with no meeting of its own.
    const named = new Map<string, Set<string>>();
    for (const meeting of notes) {
      if (meeting.type !== "meeting" || !usable(meeting, true)) continue;
      for (const ref of list(meeting.attributes[listField])) {
        const note = typeof ref === "string" ? byId.get(ref) : undefined;
        if (note?.type !== type || note.attributes[field] !== undefined || !usable(note, false)) continue;
        named.set(note.id, new Set([...(named.get(note.id) ?? []), meeting.id]));
      }
    }
    for (const [id, meetings] of named) {
      if (meetings.size !== 1) continue; // two meetings list it: which one decided it is a question, not a fix
      const note = byId.get(id)!;
      const meeting = byId.get([...meetings][0]!)!;
      items.push(structural("pair_half", note, field, meeting.id, `Link ${quoted(note)} back to its meeting ${quoted(meeting)}`, `The meeting lists this ${type} in ${listField}, but its ${field} is empty.`, source));
    }
  }
  // A supersession relation with nothing of the pair on the other note.
  const inverse: Record<string, string> = { supersedes: "superseded_by", superseded_by: "supersedes" };
  const relations = new Map<string, Array<{ type: string; target: string }>>();
  for (const note of notes) {
    if (!usable(note, false)) continue;
    for (const relation of list(note.attributes.relations)) {
      const { type, target } = record(relation);
      if (typeof type !== "string" || inverse[type] === undefined || typeof target !== "string") continue;
      const other = byId.get(target);
      if (!usable(other, false) || other.id === note.id) continue;
      if (list(other.attributes.relations).some((entry) => record(entry).target === note.id && inverse[String(record(entry).type)] !== undefined)) continue;
      relations.set(other.id, [...(relations.get(other.id) ?? []), { type: inverse[type]!, target: note.id }]);
    }
  }
  for (const [id, added] of relations) {
    const note = byId.get(id)!;
    if (new Set(added.map((entry) => entry.target)).size !== added.length) continue;
    const sorted = [...added].sort((a, b) => compareCodePoints(a.target, b.target));
    const first = byId.get(sorted[0]!.target)!;
    const title = sorted.length === 1 ? `Link ${quoted(note)} back to ${quoted(first)} (supersession)` : `Link ${quoted(note)} back to ${plural(sorted.length, "note", "notes")} (supersession)`;
    const why = sorted.length === 1 ? `${quoted(first)} records a supersession with this note, which doesn't record it back.` : "These notes record a supersession with this note, which doesn't record it back.";
    items.push(structural("pair_half", note, "relations", [...list(note.attributes.relations), ...sorted], title, why, source));
  }
  return items;
}

/** Git's renames on the working branch, old path → the paths it was renamed to, relative to the brain. */
async function renames(root: string): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  let out = "";
  try {
    out = (await exec("git", ["log", "--diff-filter=R", "-M", "--name-status", "--format=", "--relative"], { cwd: root, maxBuffer: 64 * 1024 * 1024 })).stdout;
  } catch {
    return map;
  }
  for (const line of out.split("\n")) {
    const [status, from, to] = line.split("\t");
    if (status === undefined || !status.startsWith("R") || from === undefined || to === undefined) continue;
    map.set(from, new Set([...(map.get(from) ?? []), to]));
  }
  return map;
}

/** Where a missing path went: the existing files at the ends of its rename chains, through one or more renames. */
function movedTo(path: string, map: ReadonlyMap<string, ReadonlySet<string>>, exists: (path: string) => boolean): string[] {
  const ends = new Set<string>();
  const seen = new Set<string>([path]);
  const queue = [path];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of map.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      if (exists(next)) ends.add(next);
      else queue.push(next);
    }
  }
  return [...ends];
}

/** `moved_link`: a relative link to a missing file that Git records renamed to exactly one file that exists now. One item per (note, line). */
async function movedLinks(root: string, notes: readonly Note[], restricted: (note: Note) => boolean, source: string): Promise<TidyItem[]> {
  const exists = caseSensitiveExists(root);
  let map: Map<string, Set<string>> | undefined;
  const items: TidyItem[] = [];
  for (const note of notes) {
    if (neverTarget(note) || restricted(note)) continue;
    const lines = note.body.split("\n");
    for (const [index, prose] of proseLines(note.body)) {
      const line = lines[index]!;
      let after = line;
      let fixed = 0;
      for (const target of linkTargets(prose)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
        const [bare, suffix = ""] = /^([^?#]*)(.*)$/.exec(target)!.slice(1) as [string, string];
        const resolved = posix.normalize(posix.join(posix.dirname(note.path), decodePath(bare)));
        if (resolved.startsWith("../") || exists(resolved)) continue;
        map ??= await renames(root);
        const ends = movedTo(resolved, map, exists);
        if (ends.length !== 1) continue;
        let relative = posix.relative(posix.dirname(note.path), ends[0]!);
        if (bare.includes("%") || /[\s()<>]/.test(relative)) relative = relative.split("/").map(encodeURIComponent).join("/");
        const replaced = after.split(`(${target}`).join(`(${relative}${suffix}`).split(`(<${target}>`).join(`(<${relative}${suffix}>`);
        if (replaced === after) continue;
        after = replaced;
        fixed += 1;
      }
      if (fixed === 0 || lines.filter((other) => other === line).length !== 1) continue;
      const fingerprint = `tidy:moved_link:${note.id}:${createHash("sha256").update(line, "utf8").digest("hex").slice(0, 8)}`;
      const title = short(`Point ${fixed === 1 ? "a link" : `${fixed} links`} in ${quoted(note)} to ${fixed === 1 ? "its moved file" : "their moved files"}`);
      const why = fixed === 1 ? "The file this link pointed to was renamed; Git records where it went." : "The files these links pointed to were renamed; Git records where they went.";
      items.push({
        tidy: "moved_link", title, why, fingerprint, targets: [note.id], paths: [note.path],
        proposal_input: input("fix_structure", "moved_link", title, why, fingerprint, source, { target: note.id, line_before: line, line_after: after }),
      });
    }
  }
  return items;
}

/** `repeated_value`: a frontmatter list of scalars holding a value more than once. One item per (note, field). */
function repeatedValues(notes: readonly Note[], restricted: (note: Note) => boolean, source: string): TidyItem[] {
  const items: TidyItem[] = [];
  for (const note of notes) {
    if (neverTarget(note, true) || restricted(note)) continue;
    for (const field of Object.keys(note.attributes).sort(compareCodePoints)) {
      const value = note.attributes[field];
      if (!Array.isArray(value) || value.length < 2 || !value.every((entry) => ["string", "number", "boolean"].includes(typeof entry))) continue;
      const kept: unknown[] = [];
      for (const entry of value) if (!kept.includes(entry)) kept.push(entry);
      if (kept.length === value.length) continue;
      const removed = value.length - kept.length;
      items.push(structural("repeated_value", note, field, kept, `Remove ${removed === 1 ? "a repeated value" : `${removed} repeated values`} from ${field} of ${quoted(note)}`, `${field} holds the same value more than once; the first is kept.`, source));
    }
  }
  return items;
}

const normalTitle = (value: unknown): string => String(value ?? "").normalize("NFC").toLocaleLowerCase("und").replace(/\s+/g, " ").trim();
const normalBody = (value: string): string => value.replace(/\s+/g, " ").trim();

/** `exact_duplicate`: two current notes of a type among project, decision, question and a learned Document, equal in title and non-empty
 *  body, with no fact key holding two values and no Notion page on either. The duplicate is merged into the survivor by reflection's rule. */
function exactDuplicates(notes: readonly Note[], byId: ReadonlyMap<string, Note>, restricted: (note: Note) => boolean, source: string): TidyItem[] {
  const eligible = notes.filter((note) => DUPLICATE_TYPES.has(note.type) && (note.type !== "reference" || note.attributes.origin === "learned")
    && note.attributes.lifecycle !== "archived" && note.attributes.notion === undefined && normalBody(note.body) !== "" && !restricted(note));
  const groups = new Map<string, Note[]>();
  for (const note of eligible) {
    const key = `${note.type}\u0000${normalTitle(note.attributes.title)}\u0000${normalBody(note.body)}`;
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }
  const byPath = new Map(notes.map((note) => [note.path, note]));
  const known = new Set(byId.keys());
  let referenced: Map<string, number> | undefined;
  const referenceCount = (id: string): number => {
    if (referenced === undefined) {
      referenced = new Map();
      for (const note of notes) {
        if (!KNOWLEDGE_TYPES.has(note.type)) continue;
        for (const ref of referencesOf(note, byPath, known)) referenced.set(ref, (referenced.get(ref) ?? 0) + 1);
      }
    }
    return referenced.get(id) ?? 0;
  };
  const items: TidyItem[] = [];
  for (const group of groups.values()) {
    if (group.length < 2 || new Set(group.map((note) => note.id)).size !== group.length) continue;
    const reviewed = (note: Note) => (note.attributes.lifecycle === "reviewed" ? 0 : 1);
    const [survivor, ...duplicates] = [...group].sort((a, b) => reviewed(a) - reviewed(b) || referenceCount(b.id) - referenceCount(a.id)
      || compareCodePoints(String(a.attributes.created ?? ""), String(b.attributes.created ?? "")) || compareCodePoints(a.id, b.id)) as [Note, ...Note[]];
    for (const duplicate of duplicates) {
      const facts = record(survivor.attributes.facts);
      const other = record(duplicate.attributes.facts);
      if (Object.keys(other).some((key) => Object.hasOwn(facts, key) && !isDeepStrictEqual(facts[key], other[key]))) continue;
      const fingerprint = mergeFingerprint(duplicate.id, survivor.id);
      const title = short(`Merge the ${duplicate.type === "reference" ? "Document" : duplicate.type} ${quoted(duplicate)} into its exact duplicate`);
      const why = "Two notes with the same title and the same text: the duplicate is merged into the one kept, and its links move with it.";
      const touched = notes.filter((note) => note.id !== duplicate.id && note.id !== survivor.id && note.type !== "source" && note.type !== "proposal" && note.type !== "view"
        && (JSON.stringify(note.attributes).includes(duplicate.id) || note.body.includes(posix.basename(duplicate.path))));
      items.push({
        tidy: "exact_duplicate", title, why, fingerprint, targets: [duplicate.id, survivor.id], paths: [duplicate.path, survivor.path, ...touched.map((note) => note.path)],
        proposal_input: input("merge", "exact_duplicate", title, why, fingerprint, source, { target: duplicate.id, merge_into: survivor.id }),
      });
    }
  }
  return items;
}

/** Every string anywhere in a value. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const entry of value) strings(entry, out);
  else if (value !== null && typeof value === "object") for (const entry of Object.values(value)) strings(entry, out);
  return out;
}

/** `stale_draft`: a never-reviewed knowledge note, 60 days old or more, with no Notion page, no link to it and no waiting proposal naming it. */
function staleDrafts(notes: readonly Note[], restricted: (note: Note) => boolean, source: string, localDate: string): TidyItem[] {
  const cutoff = new Date(Date.parse(`${localDate}T00:00:00Z`) - STALE_DRAFT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const candidates = notes.filter((note) => !neverTarget(note) && note.attributes.lifecycle === "draft" && note.attributes.notion === undefined
    && typeof note.attributes.created === "string" && note.attributes.created.slice(0, 10) <= cutoff && !restricted(note));
  if (candidates.length === 0) return [];
  const named = new Set<string>();
  const linked = new Set<string>();
  for (const note of notes) {
    if (note.type === "view") continue;
    if (note.type === "proposal") {
      // The draft's own archive_draft (offered in a row while settings.cleanup.auto is off) is not a question about it.
      if (WAITING.has(String(note.attributes.status)) && note.attributes.tidy !== "stale_draft") for (const text of strings(note.attributes)) named.add(text);
      continue;
    }
    for (const text of strings(note.attributes)) if (text !== note.id) named.add(text);
    for (const [, prose] of proseLines(note.body)) {
      for (const target of linkTargets(prose)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
        const resolved = posix.normalize(posix.join(posix.dirname(note.path), decodePath(target.split(/[?#]/)[0]!)));
        if (resolved !== note.path) linked.add(resolved);
      }
    }
  }
  return candidates.filter((note) => !named.has(note.id) && !linked.has(note.path)).map((note) => {
    const fingerprint = `tidy:stale_draft:${note.id}`;
    const title = short(`Archive the draft ${quoted(note)}`);
    const why = `A draft never reviewed, ${STALE_DRAFT_DAYS} days old or more, that nothing links to; archived, not deleted.`;
    return {
      tidy: "stale_draft" as const, title, why, fingerprint, targets: [note.id], paths: [note.path],
      proposal_input: input("archive_draft", "stale_draft", title, why, fingerprint, source, { target: note.id }),
    };
  });
}

/** An Already cleaned line's verb in the past tense (weekly-review.md §3.3): the item's title with its first word changed. */
export function pastTitle(title: string): string {
  const past: Record<string, string> = { Add: "Added", Link: "Linked", Point: "Pointed", Remove: "Removed", Merge: "Merged", Archive: "Archived" };
  const [first, ...rest] = title.split(" ");
  return past[first!] === undefined ? title : [past[first!], ...rest].join(" ");
}

/** settings.cleanup.auto (schema §12): absent means on. */
export function cleanupAuto(config: Record<string, unknown>): boolean {
  const settings = config.settings !== null && typeof config.settings === "object" ? config.settings as Record<string, unknown> : {};
  const cleanup = settings.cleanup !== null && typeof settings.cleanup === "object" ? settings.cleanup as Record<string, unknown> : {};
  return cleanup.auto !== "off";
}
