import { execFile } from "node:child_process";
import { isDeepStrictEqual, promisify } from "node:util";

import { parseFrontmatter } from "./frontmatter.ts";
import { isRecord } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { bodyHash } from "./proposals.ts";
import { queryWords } from "./query.ts";
import { holdsWholeText, prose, referencesOf, reflectTokens } from "./reflect.ts";

// The correction queue (spec/weekly-review.md §8): the meaning changes new to the cursor, read from the Git record, and the current notes that
// still restate an old value. Deterministic; the skill judges each target (§8.2) and `weekly select` groups the restatements (§8.4).

const exec = promisify(execFile);

export type Value = string | number;
export interface Target { note: string; title: string; field: string | null; line: string | null; line_after: string | null; before_hash: string | null; pending: string | null }
export interface Claim {
  claim: string; kind: "fact" | "supersede" | "title" | "rule"; note: string; title: string; old: Value[]; new: Value; date: string;
  source: string; why: string; passages: string[]; open: boolean; targets: Target[];
}
export interface OpenClaim { claim: string; targets: string[]; old: Value[]; new: Value; date: string; source: string }
export interface Cursor { checked_on: string | null; done_on_date: string[]; open: OpenClaim[] }
/** A note whose title or aliases changed since the cursor's date, read from Git (§8.1). */
export interface TitleChange { id: string; old: string[]; date: string }

const KNOWLEDGE = new Set(["domain", "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
/** Never targets (§8.2): records (meetings, decisions), memories, and the user's or whole texts. Sources, views and proposals are no knowledge. */
const NEVER = new Set(["meeting", "decision", "memory"]);
const WAITING = new Set(["pending", "approved", "edited"]);
const RULE_WORDS = 3;

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const dateOf = (value: unknown): string | null => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value instanceof Date ? value.toISOString().slice(0, 10) : null);
const isValue = (value: unknown): value is Value => typeof value === "string" || typeof value === "number";
const archived = (note: Note) => note.attributes.lifecycle === "archived" || note.path.startsWith("archive/");
const titleOf = (note: Note | undefined, fallback: string) => String(note?.attributes.title ?? fallback);

/** The claim key's note and kind (§8.1): `<target>:<field>`, `<target>:title`, `<decision id>`, `<target>:rule:<proposal id>`. */
export function claimParts(claim: string): { note: string; kind: Claim["kind"]; field: string | null } {
  const [note, second, third] = claim.split(":");
  if (second === undefined) return { note: note!, kind: "supersede", field: null };
  if (second === "rule" && third !== undefined) return { note: note!, kind: "rule", field: null };
  if (second === "title") return { note: note!, kind: "title", field: null };
  return { note: note!, kind: "fact", field: second };
}

/**
 * The titles and aliases changed since `since` (a date), from Git (§8.1): for each knowledge note committed since then, its frontmatter before
 * the first such commit against its current one. The date is the newest such commit's. Not a Git repository, or no commit: none.
 */
export async function titleChanges(root: string, since: string, notes: readonly Note[]): Promise<TitleChange[]> {
  let log: string;
  try {
    log = (await exec("git", ["-C", root, "log", `--since=${since}T00:00:00`, "--format=%x01%H %cs", "--name-only", "--no-renames", "--"], { maxBuffer: 64 * 1024 * 1024 })).stdout;
  } catch {
    return [];
  }
  const byPath = new Map(notes.filter((note) => KNOWLEDGE.has(note.type)).map((note) => [note.path, note]));
  // Newest first: the first commit seen for a path is its newest, the last its oldest.
  const touched = new Map<string, { newest: string; oldest: string }>();
  for (const block of log.split("\u0001").slice(1)) {
    const [head, ...files] = block.split("\n").filter((line) => line !== "");
    const [hash, date] = head!.split(" ") as [string, string];
    for (const path of files) {
      if (!byPath.has(path)) continue;
      const seen = touched.get(path);
      touched.set(path, { newest: seen?.newest ?? date, oldest: hash });
    }
  }
  const out: TitleChange[] = [];
  for (const [path, { newest, oldest }] of [...touched].sort(([a], [b]) => compareCodePoints(a, b))) {
    let before: string;
    try {
      before = (await exec("git", ["-C", root, "show", `${oldest}^:${path}`], { maxBuffer: 16 * 1024 * 1024 })).stdout;
    } catch {
      continue; // a new file, or the first commit: nothing was renamed
    }
    const note = byPath.get(path)!;
    let attributes: Record<string, unknown>;
    try { attributes = parseFrontmatter(before).attributes; } catch { continue; }
    if (attributes.id !== note.id) continue;
    const now = [String(note.attributes.title ?? ""), ...list(note.attributes.aliases).map(String)];
    const old = [typeof attributes.title === "string" ? attributes.title : "", ...list(attributes.aliases).map(String)]
      .filter((name, index, all) => name !== "" && !now.includes(name) && all.indexOf(name) === index);
    if (old.length > 0) out.push({ id: note.id, old, date: newest });
  }
  return out;
}

interface Change { claim: string; kind: Claim["kind"]; note: string; title: string; old: Value[]; new: Value; date: string; source: string; why: string }

/** Whether a meeting change is new to the cursor (§8.1); with no cursor, whether it is dated in the window. */
export function newTo(cursor: Cursor, windowFrom: string): (date: string, claim: string) => boolean {
  return (date, claim) => cursor.checked_on === null ? date >= windowFrom : date > cursor.checked_on || (date === cursor.checked_on && !cursor.done_on_date.includes(claim));
}

/** The meaning changes new to the cursor (§8.1), one per claim, against its latest value. */
export function meaningChanges(notes: readonly Note[], titles: readonly TitleChange[], isNew: (date: string, claim: string) => boolean): Change[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const proposals = notes.filter((note) => note.type === "proposal" && note.attributes.status === "applied");
  const out = new Map<string, Change>();
  const keep = (change: Change) => { const seen = out.get(change.claim); if (seen === undefined || compareCodePoints(seen.date, change.date) < 0) out.set(change.claim, change); };

  // Facts: the accepted entry new to the cursor, and every earlier value it and the entries since the cursor replaced.
  for (const note of notes) {
    if (!KNOWLEDGE.has(note.type)) continue;
    const timeline = list(note.attributes.timeline).filter(isRecord);
    const fields = new Set(timeline.map((entry) => entry.field).filter((field): field is string => typeof field === "string"));
    for (const field of fields) {
      const entries = timeline.filter((entry) => entry.field === field);
      let current = -1;
      entries.forEach((entry, index) => { if (entry.assessment === "accepted") current = index; });
      if (current < 0) continue;
      const entry = entries[current]!;
      const learned = dateOf(entry.learned);
      const claim = `${note.id}:${field}`;
      if (learned === null || !isValue(entry.value) || !isNew(learned, claim)) continue;
      const old: Value[] = [];
      for (let index = current - 1; index >= 0; index -= 1) {
        const earlier = entries[index]!;
        if (isValue(earlier.value) && !isDeepStrictEqual(earlier.value, entry.value) && !old.includes(earlier.value)) old.push(earlier.value);
        const date = dateOf(earlier.learned);
        if (date === null || !isNew(date, claim)) break;
      }
      if (old.length === 0) continue; // a first value is no change of meaning
      const applied = proposals.filter((proposal) => ["update_fact", "contradiction"].includes(String(proposal.attributes.kind)) && proposal.attributes.target === note.id && proposal.attributes.field === field)
        .sort((a, b) => compareCodePoints(String(b.attributes.updated), String(a.attributes.updated)))[0];
      const title = titleOf(note, note.id);
      keep({ claim, kind: "fact", note: note.id, title, old, new: entry.value, date: learned, source: String(entry.source ?? "notion-edit"),
        why: typeof applied?.attributes.why === "string" ? applied.attributes.why : `${title}: ${field.replaceAll("_", " ")} is now ${String(entry.value)}, was ${String(old[0])}.` });
    }
  }
  // Supersedes and approved rules: the applied proposal's own date, source and why.
  for (const proposal of proposals) {
    const a = proposal.attributes;
    const date = dateOf(a.updated);
    if (date === null) continue;
    if (a.kind === "supersede" && typeof a.supersedes === "string") {
      const older = byId.get(a.supersedes);
      const newer = typeof a.target === "string" ? byId.get(a.target) : undefined;
      if (older?.type !== "decision" || newer === undefined || !isNew(date, older.id)) continue;
      keep({ claim: older.id, kind: "supersede", note: older.id, title: titleOf(older, older.id), old: [titleOf(older, older.id)], new: titleOf(newer, newer.id), date, source: String(a.source), why: String(a.why) });
    }
    if (a.kind === "add_to_note" && typeof a.fingerprint === "string" && a.fingerprint.startsWith("promotion:") && typeof a.target === "string") {
      const claim = `${a.target}:rule:${proposal.id}`;
      const target = byId.get(a.target);
      const text = isRecord(a.decision) && typeof a.decision.value === "string" ? a.decision.value : String(a.content ?? "");
      if (target === undefined || text.trim() === "" || !isNew(date, claim)) continue;
      keep({ claim, kind: "rule", note: target.id, title: titleOf(target, target.id), old: [], new: text, date, source: String(a.source), why: String(a.why) });
    }
  }
  // Titles: the old title and the dropped aliases (§8.1).
  for (const change of titles) {
    const note = byId.get(change.id);
    const claim = `${change.id}:title`;
    if (note === undefined || !isNew(change.date, claim)) continue;
    const title = titleOf(note, note.id);
    keep({ claim, kind: "title", note: note.id, title, old: change.old, new: title, date: change.date, source: "notion-edit", why: `Renamed from "${change.old[0]}" to "${title}".` });
  }
  return [...out.values()];
}

/** The tokens of a line's prose, as a joined run for a contains test (§8.2). */
const run = (tokens: readonly string[]) => ` ${tokens.join(" ")} `;

/**
 * The claims of the queue with their candidate targets (§8.1, §8.2): the meaning changes new to the cursor, and the open claims of the cursor
 * with only their queued targets. `eligible` are the notes as retrieval sees them (restricted statements blanked); `all` the notes as written.
 */
export function computeClaims(input: { eligible: readonly Note[]; all: readonly Note[]; cursor: Cursor; windowFrom: string; titles: readonly TitleChange[] }): Claim[] {
  const { eligible, all, cursor } = input;
  const written = new Map(all.map((note) => [note.id, note]));
  const byId = new Map(eligible.map((note) => [note.id, note]));
  const byPath = new Map(eligible.map((note) => [note.path, note]));
  const known = new Set(eligible.map((note) => note.id));
  const references = new Map(eligible.map((note) => [note.id, referencesOf(note, byPath, known)]));

  const changes = new Map(meaningChanges(eligible, input.titles, newTo(cursor, input.windowFrom)).map((change) => [change.claim, change]));
  const open = new Map(cursor.open.map((entry) => [entry.claim, entry]));
  for (const entry of cursor.open) {
    if (changes.has(entry.claim)) continue;
    const parts = claimParts(entry.claim);
    const note = byId.get(parts.note);
    if (note === undefined) continue;
    const title = titleOf(note, note.id);
    changes.set(entry.claim, { claim: entry.claim, kind: parts.kind, note: note.id, title, old: entry.old, new: entry.new, date: entry.date, source: entry.source, why: `${title}: ${String(entry.old[0] ?? "")} → ${String(entry.new)} (queued from an earlier week).` });
  }

  // The correction groups for each claim: who already waits in Review, and what the user rejected (§8.4).
  const waiting = new Map<string, Map<string, string>>();
  const rejected = new Map<string, Set<string>>();
  for (const proposal of all) {
    const a = proposal.attributes;
    if (proposal.type !== "proposal" || a.kind !== "review_notes" || typeof a.correction !== "string") continue;
    const changesOf = list(a.changes).filter(isRecord);
    const status = String(a.status);
    if (WAITING.has(status)) {
      const map = waiting.get(a.correction) ?? new Map<string, string>();
      const decided = new Set(list(a.item_decisions).filter(isRecord).map((entry) => String(entry.item_id)));
      for (const item of list(a.items).filter(isRecord)) {
        if (item.kind !== "change" || decided.has(String(item.item_id))) continue;
        const target = changesOf[Number(item.ref)]?.target;
        if (typeof target === "string" && !map.has(target)) map.set(target, proposal.id);
      }
      waiting.set(a.correction, map);
    }
    const set = rejected.get(a.correction) ?? new Set<string>();
    const whole = (status === "rejected" || status === "closed") && isRecord(a.decision) && a.decision.action === "reject";
    for (const item of list(a.items).filter(isRecord)) {
      if (item.kind !== "change") continue;
      const decision = list(a.item_decisions).filter(isRecord).find((entry) => entry.item_id === item.item_id);
      const target = changesOf[Number(item.ref)]?.target;
      if (typeof target === "string" && (whole || (decision?.decision === "reject" && decision.reason !== "source_excluded"))) set.add(target);
    }
    rejected.set(a.correction, set);
  }

  const claims: Claim[] = [];
  for (const change of changes.values()) {
    const parts = claimParts(change.claim);
    const queued = open.get(change.claim);
    const onlyQueued = queued !== undefined && !newTo(cursor, input.windowFrom)(change.date, change.claim) ? new Set(queued.targets) : null;
    const oldRuns = change.old.map((value) => ({ value, tokens: run(reflectTokens(prose(String(value)))) })).filter((entry) => entry.tokens.trim() !== "");
    const ruleWords = change.kind === "rule" ? new Set(queryWords(String(change.new))) : new Set<string>();
    const targets: Target[] = [];
    for (const note of eligible) {
      if (note.id === change.note || !KNOWLEDGE.has(note.type) || NEVER.has(note.type) || archived(note)) continue;
      if (note.type === "reference" && (holdsWholeText(note) || note.attributes.origin === "promoted")) continue;
      if (onlyQueued !== null && !onlyQueued.has(note.id)) continue;
      if (rejected.get(change.claim)?.has(note.id) === true) continue;
      if (!references.get(note.id)!.has(change.note) && !references.get(change.note)?.has(note.id)) continue;
      const facts = isRecord(note.attributes.facts) ? note.attributes.facts : {};
      const fact = parts.field !== null && change.kind === "fact" && change.old.some((value) => isDeepStrictEqual(facts[parts.field!], value));
      const lines = note.body.split("\n").filter((line) => line.trim() !== "").filter((line) => {
        const tokens = reflectTokens(prose(line));
        if (change.kind === "rule") return new Set(queryWords(prose(line)).filter((word) => ruleWords.has(word))).size >= RULE_WORDS;
        return oldRuns.some((entry) => run(tokens).includes(entry.tokens));
      });
      if (!fact && lines.length === 0) continue;
      const original = written.get(note.id) ?? note;
      const pending = waiting.get(change.claim)?.get(note.id) ?? null;
      const title = titleOf(note, note.id);
      if (fact && lines.length === 0) {
        targets.push({ note: note.id, title, field: parts.field, line: null, line_after: null, before_hash: null, pending });
        continue;
      }
      const line = lines[0]!;
      targets.push({ note: note.id, title, field: null, line, line_after: fact || lines.length > 1 ? null : lineAfter(line, change, original), before_hash: bodyHash(original.body), pending });
    }
    if (targets.length === 0) continue;
    targets.sort((a, b) => compareCodePoints(a.note, b.note));
    claims.push({
      claim: change.claim, kind: change.kind, note: change.note, title: change.title, old: change.old, new: change.new, date: change.date,
      source: change.source, why: change.why, passages: [change.source], open: queued !== undefined, targets,
    });
  }
  return claims.sort((a, b) => compareCodePoints(a.date, b.date) || compareCodePoints(a.claim, b.claim));
}

/** The line with the one old value written in it replaced by the new value (§8.2), or null: no such one-for-one replacement. */
function lineAfter(line: string, change: Change, original: Note): string | null {
  if (change.kind === "rule") return null;
  const found = change.old.map(String).filter((value) => value !== "" && line.includes(value));
  if (found.length !== 1) return null;
  const old = found[0]!;
  if (line.split(old).length !== 2) return null;
  const after = line.replace(old, () => String(change.new));
  // The replace_line rule: the line is in the written body exactly once, and changes.
  if (after === line || original.body.split("\n").filter((candidate) => candidate === line).length !== 1) return null;
  return after;
}

/** The cursor after a run (§8.4): checked_on the run's local date, the claims finished that day, and the claims left with their queued targets. */
export function nextCursor(before: Cursor, claims: readonly Claim[], outcomes: ReadonlyMap<string, string[]>, local: string): Cursor {
  const finished = claims.filter((claim) => (outcomes.get(claim.claim) ?? []).length === 0);
  const done = new Set([...(before.checked_on === local ? before.done_on_date : []), ...finished.filter((claim) => claim.date === local).map((claim) => claim.claim)]);
  const open = claims.filter((claim) => (outcomes.get(claim.claim) ?? []).length > 0)
    .map((claim) => ({ claim: claim.claim, targets: [...outcomes.get(claim.claim)!].sort(compareCodePoints), old: claim.old, new: claim.new, date: claim.date, source: claim.source }));
  return { checked_on: local, done_on_date: [...done].sort(compareCodePoints), open };
}
