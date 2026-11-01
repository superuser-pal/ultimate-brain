import { isDeepStrictEqual } from "node:util";
import { posix } from "node:path";

import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import type { NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { bodyHash, bodyOf, reviewTitle, sourceTitle, stageNewItem, writeProposal } from "./proposals.ts";
import { loadSchemas } from "./schemas.ts";
import { formatDate, normalizeTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";
import type { LogEntry } from "./log.ts";

/** spec/cli.md §5.7. */
export interface Correction {
  target: string;
  field: string;
  value: unknown;
  observed_at: string;
}

export interface Decision {
  action: "approve" | "reject" | "fix" | "edit";
  value?: unknown;
  note?: string;
  /** fix: the corrected values, per kind (spec/schema.md §11.3, 0045). */
  fixes?: Array<Record<string, unknown>>;
  /** add_link: `{field, value}`; review_notes: `{note}`, `{target, field, value}` or `{change}` (spec/schema.md §11). */
  exclude?: Array<Record<string, unknown>>;
  decided_at: string;
  decided_by: "notion" | "chat";
}

export interface DecisionInput extends Decision {
  proposal: string;
}

export interface ApplyInput {
  corrections: Correction[];
  /** Null: apply every proposal that holds a recorded decision but is not terminal. */
  decisions: DecisionInput[] | null;
}

export interface ItemResult {
  result: "applied" | "closed" | "recorded" | "skipped" | "failed";
  reason?: string;
  message?: string;
  changed: string[];
  /** review_notes only: what happened to each listed note (spec/cli.md §5.7). */
  notes?: NoteResult[];
  /** applied review_notes only: what happened to each change, and the row holding the excluded items (0045). */
  changes?: ChangeResult[];
  deferred?: string;
}

export interface ChangeResult {
  index: number;
  kind: string;
  target: string;
  result: "applied" | "dropped" | "deferred";
  reason?: "STALE_PROPOSAL";
}

export interface NoteResult {
  id: string;
  result: "reviewed" | "archived" | "kept_draft" | "unchanged";
  lifecycle: string;
}

export interface ApplyResult {
  corrections: Array<{ target: string; field: string } & ItemResult>;
  decisions: Array<{ proposal: string; kind?: string; action: string } & ItemResult>;
  summary: Record<"applied" | "closed" | "recorded" | "corrected" | "skipped" | "failed", number>;
  log: LogEntry[];
}

const ACTIONS = ["approve", "reject", "fix", "edit"];
export const EDITABLE = new Set(["update_fact", "contradiction", "add_to_note", "update_body", "answer"]);
const FIX_KEYS = ["value", "change", "note", "field", "link"];
/** Reference fields a merge leaves alone: the meeting side of a persisted pair (spec/schema.md §11.2). */
const PAIR_FIELDS = new Set(["decisions", "questions", "decided_in", "raised_in"]);
/** Corrections change knowledge notes only: sources are immutable and proposals are records. */
const KNOWLEDGE_TYPES = new Set(["domain", "area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
const REFERENCE_FIELDS = [
  "domain", "area", "areas", "goal", "client", "org", "projects", "people", "attendees", "deciders", "source", "sources",
  "answer", "project", "generated_from", "facts",
];

/** Check the input shape (spec/cli.md §5.7); any problem fails the whole command. */
export function parseApplyInput(input: unknown): ApplyInput {
  if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object" }]);
  const record = input as Record<string, unknown>;
  const problems: InputProblem[] = unknownKeys(record, ["corrections", "decisions"], "");
  const corrections = record.corrections ?? [];
  const decisions = record.decisions ?? [];
  if (!Array.isArray(corrections)) problems.push({ pointer: "/corrections", message: "must be a list" });
  if (!Array.isArray(decisions)) problems.push({ pointer: "/decisions", message: "must be a list" });
  assertNoProblems(problems);
  if ((corrections as unknown[]).length === 0 && (decisions as unknown[]).length === 0) {
    assertNoProblems([{ pointer: "", message: "needs at least one correction or decision" }]);
  }

  (corrections as unknown[]).forEach((item, index) => {
    const pointer = `/corrections/${index}`;
    if (!isRecord(item)) return problems.push({ pointer, message: "must be an object" });
    problems.push(...unknownKeys(item, ["target", "field", "value", "observed_at"], pointer));
    if (typeof item.target !== "string") problems.push({ pointer: `${pointer}/target`, message: "must be a note id" });
    if (typeof item.field !== "string") problems.push({ pointer: `${pointer}/field`, message: "must be a string" });
    if (!Object.hasOwn(item, "value")) problems.push({ pointer: `${pointer}/value`, message: "is required (null removes a reference)" });
    if (!isTimestamp(item.observed_at)) problems.push({ pointer: `${pointer}/observed_at`, message: "must be an ISO 8601 UTC timestamp" });
  });
  (decisions as unknown[]).forEach((item, index) => {
    const pointer = `/decisions/${index}`;
    if (!isRecord(item)) return problems.push({ pointer, message: "must be an object" });
    problems.push(...unknownKeys(item, ["proposal", "action", "value", "note", "fixes", "exclude", "decided_at", "decided_by"], pointer));
    if (typeof item.proposal !== "string") problems.push({ pointer: `${pointer}/proposal`, message: "must be a proposal id" });
    if (!ACTIONS.includes(item.action as string)) problems.push({ pointer: `${pointer}/action`, message: "must be approve, reject, fix or edit" });
    if (item.action === "fix" && (typeof item.note !== "string" || item.note === "")) problems.push({ pointer: `${pointer}/note`, message: "is required for fix: the user's words" });
    if (item.action === "fix" && (!Array.isArray(item.fixes) || item.fixes.length === 0 || item.fixes.some((entry) => !isRecord(entry) || !Object.hasOwn(entry, "value") || Object.keys(entry).some((key) => !FIX_KEYS.includes(key))))) problems.push({ pointer: `${pointer}/fixes`, message: "must be a non-empty list of entries with a value (spec/schema.md §11.3)" });
    if (item.action !== "fix" && item.fixes !== undefined) problems.push({ pointer: `${pointer}/fixes`, message: "is only allowed for fix" });
    if (item.action === "edit" && (item.value === undefined || item.value === null)) problems.push({ pointer: `${pointer}/value`, message: "is required for edit" });
    if (item.action !== "edit" && item.value !== undefined) problems.push({ pointer: `${pointer}/value`, message: "is only allowed for edit" });
    if (item.note !== undefined && typeof item.note !== "string") problems.push({ pointer: `${pointer}/note`, message: "must be a string" });
    if (item.exclude !== undefined && (!Array.isArray(item.exclude) || item.exclude.some((entry) => !isRecord(entry) || !(isNoteExclude(entry) || isChangeExclude(entry) || (typeof entry.field === "string" && Object.hasOwn(entry, "value") && Object.keys(entry).every((key) => ["target", "field", "value"].includes(key))))))) problems.push({ pointer: `${pointer}/exclude`, message: "must be a list of {field, value}, {target, field, value}, {note} or {change} entries" });
    if (!isTimestamp(item.decided_at)) problems.push({ pointer: `${pointer}/decided_at`, message: "must be an ISO 8601 UTC timestamp" });
    if (item.decided_by !== "notion" && item.decided_by !== "chat") problems.push({ pointer: `${pointer}/decided_by`, message: "must be notion or chat" });
  });
  assertNoProblems(problems);
  return {
    corrections: (corrections as Correction[]).map((item) => ({ ...item, observed_at: normalizeTimestamp(item.observed_at)! })),
    decisions: (decisions as DecisionInput[]).map((item) => ({ ...item, decided_at: normalizeTimestamp(item.decided_at)! })),
  };
}

/**
 * Apply corrections, then decisions, each in input order (spec/cli.md §5.7, spec/schema.md
 * §11.2). Each item is staged and validated on its own: a failed item leaves the workspace as it
 * was, and later items see the results of earlier ones. Nothing is written; the caller commits.
 */
export function applyAll(workspace: Workspace, input: ApplyInput, options: { now: Date; recordOnly: boolean }): ApplyResult {
  const today = formatDate(options.now);
  const result: ApplyResult = {
    corrections: [],
    decisions: [],
    summary: { applied: 0, closed: 0, recorded: 0, corrected: 0, skipped: 0, failed: 0 },
    log: [],
  };

  for (const correction of input.corrections) {
    const item = runItem(workspace, () => applyCorrection(workspace, correction, today));
    result.corrections.push({ target: correction.target, field: correction.field, ...item.outcome });
    if (item.outcome.result === "applied") {
      result.summary.corrected += 1;
      result.log.push({ op: "correct", id: correction.target, title: titleOf(workspace, correction.target), pairs: [["field", correction.field]] });
    } else {
      result.summary[item.outcome.result as "skipped" | "failed"] += 1;
    }
  }

  const decisions = input.decisions ?? recordedDecisions(workspace);
  for (const decision of decisions) {
    const proposal = workspace.get(decision.proposal);
    const kind = proposal?.type === "proposal" ? String(proposal.attributes.kind) : undefined;
    const item = runItem(workspace, () => applyDecision(workspace, decision, today, options.recordOnly));
    result.decisions.push({ proposal: decision.proposal, ...(kind === undefined ? {} : { kind }), action: item.action ?? decision.action, ...item.outcome });
    result.summary[item.outcome.result] += 1;
    if (item.outcome.result === "applied" || item.outcome.result === "closed") {
      result.log.push({ op: "apply", id: decision.proposal, title: titleOf(workspace, decision.proposal), pairs: [["result", item.outcome.result]] });
    }
  }
  return result;
}

interface Outcome {
  result: ItemResult["result"];
  reason?: string;
  message?: string;
  notes?: NoteResult[];
  changes?: ChangeResult[];
  deferred?: string;
  /** Action actually applied, when it differs from the input's (an earlier, later-dated decision). */
  action?: string;
}

class ItemFailure extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Run one item atomically: on failure or a result that adds lint errors, restore the workspace. */
function runItem(workspace: Workspace, run: () => Outcome): { outcome: ItemResult; action?: string } {
  const start = workspace.checkpoint();
  let outcome: Outcome;
  try {
    outcome = run();
  } catch (error) {
    workspace.restore(start);
    if (error instanceof ItemFailure) return { outcome: { result: "failed", reason: error.reason, message: error.message, changed: [] } };
    // Anything else (a new_item whose note cannot be written, say) fails this item only (spec/cli.md §3.6.3).
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: { result: "failed", reason: "INVALID_RESULT", message, changed: [] } };
  }
  const changed = workspace.changedSince(start);
  const errors = workspace.newErrors();
  if (errors.length > 0) {
    workspace.restore(start);
    const message = errors.map((issue) => `${issue.path}: ${issue.rule}: ${issue.message}`).join("; ");
    return { outcome: { result: "failed", reason: "INVALID_RESULT", message, changed: [] } };
  }
  const { action, ...rest } = outcome;
  return { outcome: { ...rest, changed }, action };
}

function applyCorrection(workspace: Workspace, correction: Correction, today: string): Outcome {
  const note = existing(workspace, correction.target);
  const document = workspace.edit(note);
  const attributes = document.attributes;
  const factKey = /^facts\.([a-z][a-z0-9_]*)$/.exec(correction.field)?.[1];
  const known = loadSchemas().knownKeys(note.type);
  const correctable = KNOWLEDGE_TYPES.has(note.type) && factKey !== undefined
    ? known?.has("facts") === true
    : KNOWLEDGE_TYPES.has(note.type) && ["title", "summary", "why", "domain", "area", "goal", "client", "org", "people"].includes(correction.field) && known?.has(correction.field) === true;
  if (!correctable) throw new ItemFailure("FIELD_NOT_CORRECTABLE", `${correction.field} cannot be corrected on a ${note.type}`);

  const current = factKey === undefined ? attributes[correction.field] : record(attributes.facts)[factKey];
  if (isDeepStrictEqual(current ?? null, correction.value)) return { result: "skipped", reason: "NO_CHANGE" };

  if (factKey !== undefined) {
    const date = correction.observed_at.slice(0, 10);
    setFact(attributes, factKey, correction.value, date, date, "notion-edit");
  } else if (correction.value === null) {
    delete attributes[correction.field];
  } else {
    attributes[correction.field] = correction.value;
  }
  attributes.updated = today;
  workspace.save(note.path, document);
  return { result: "applied" };
}

function applyDecision(workspace: Workspace, input: DecisionInput, today: string, recordOnly: boolean): Outcome {
  const proposal = workspace.get(input.proposal);
  if (proposal === undefined || proposal.type !== "proposal") throw new ItemFailure("UNKNOWN_ID", `No proposal with id ${input.proposal}`);
  const document = workspace.edit(proposal);
  const p = document.attributes;
  if (p.status === "applied" || p.status === "closed") return { result: "skipped", reason: "ALREADY_TERMINAL" };

  const incoming: Decision = { action: input.action, ...(input.value === undefined ? {} : { value: input.value }), ...(input.note === undefined ? {} : { note: input.note }), ...(input.fixes === undefined ? {} : { fixes: input.fixes }), ...(input.exclude === undefined ? {} : { exclude: input.exclude }), decided_at: input.decided_at, decided_by: input.decided_by };
  const recorded = isRecord(p.decision) ? (p.decision as unknown as Decision) : undefined;
  let decision = incoming;
  if (recorded !== undefined && (recorded.action !== incoming.action || !isDeepStrictEqual(recorded.value, incoming.value) || !isDeepStrictEqual(recorded.fixes, incoming.fixes) || !isDeepStrictEqual(recorded.exclude, incoming.exclude))) {
    // You changed your mind in Notion before it was applied: the later decision wins.
    if (Date.parse(recorded.decided_at) >= Date.parse(incoming.decided_at)) decision = recorded;
  } else if (recorded !== undefined) {
    decision = recorded;
  }
  if (decision.action === "edit" && !EDITABLE.has(String(p.kind))) {
    throw new ItemFailure("EDIT_NOT_ALLOWED", `edit is not allowed on a ${String(p.kind)} proposal (spec/schema.md §11.1); use fix`);
  }
  const exclude = decision.exclude ?? [];
  if (decision.exclude !== undefined) {
    if ((decision.action !== "approve" && decision.action !== "fix") || (p.kind !== "add_link" && p.kind !== "review_notes")) throw new ItemFailure("INPUT_INVALID", "exclude is only allowed on an approved or fixed add_link or review_notes proposal");
    if (p.kind === "add_link") {
      if (exclude.some((excluded) => excluded.target !== undefined || isNoteExclude(excluded) || isChangeExclude(excluded))) throw new ItemFailure("INPUT_INVALID", "exclude on an add_link takes {field, value} entries");
      const links = proposalLinks(p);
      if (exclude.some((excluded) => !links.some((link) => link.field === excluded.field && isDeepStrictEqual(link.value, excluded.value)))) throw new ItemFailure("EXCLUDE_UNKNOWN", "exclude contains a link that is not in the proposal");
    } else {
      if (exclude.some((excluded) => !isNoteExclude(excluded) && !isChangeExclude(excluded) && excluded.target === undefined)) throw new ItemFailure("INPUT_INVALID", "exclude on a review_notes takes {note}, {target, field, value} and {change} entries");
      if (exclude.some((excluded) => !inReview(p, excluded))) throw new ItemFailure("EXCLUDE_UNKNOWN", "exclude contains an entry that is not in the proposal");
    }
  }
  // A fix corrects the proposal before it is applied; the file keeps what was proposed (spec/schema.md §11.3).
  const fixed = decision.action === "fix" ? corrected(workspace, p, decision.fixes ?? [], exclude) : { q: p, noteFixes: new Map<string, Array<Record<string, unknown>>>() };
  const action = decision.action === incoming.action ? undefined : decision.action;

  p.decision = decision;
  p.status = decision.action === "approve" ? "approved" : decision.action === "reject" ? "rejected" : "edited";
  p.updated = today;
  if (recordOnly) {
    workspace.save(proposal.path, document);
    return { result: "recorded", action };
  }

  if (decision.action === "reject") {
    p.status = "closed";
    workspace.save(proposal.path, document);
    // A rejected review_notes archives the notes still draft, with no successor (spec/schema.md §11.2).
    const notes = p.kind === "review_notes" ? reviewNotes(workspace, p, "reject", [], today, "", new Map()).notes : undefined;
    return { result: "closed", action, ...(notes === undefined ? {} : { notes }) };
  }

  const D = decision.decided_at.slice(0, 10);
  const V = decision.action === "edit" ? decision.value : fixed.value;
  if (p.kind === "review_notes") {
    const applied = reviewNotes(workspace, fixed.q, "approve", exclude, today, D, fixed.noteFixes);
    if (applied.dropped.length > 0) p.dropped = applied.dropped;
    p.status = "applied";
    workspace.save(proposal.path, document);
    const deferred = exclude.length === 0 ? undefined : defer(workspace, proposal.id, p, exclude, today);
    return { result: "applied", action, notes: applied.notes, changes: applied.changes, ...(deferred === undefined ? {} : { deferred }) };
  }
  const stale = applyKind(workspace, fixed.q, proposal.path, V, D, today, exclude as Array<{ field: string; value: unknown }>);
  if (stale !== null) {
    p.status = "closed";
    p.closed_reason = "stale";
    workspace.save(proposal.path, document);
    return { result: "closed", reason: "STALE_PROPOSAL", message: stale, action };
  }
  p.status = "applied";
  workspace.save(proposal.path, document);
  return { result: "applied", action };
}

/** Whether an exclude or fix entry names an item of a review_notes (spec/schema.md §11.3). */
function inReview(p: Record<string, unknown>, entry: Record<string, unknown>): boolean {
  if (entry.change !== undefined) return Number.isInteger(entry.change) && (entry.change as number) >= 0 && (entry.change as number) < list(p.changes).length;
  if (entry.note !== undefined) return list(p.notes).includes(entry.note);
  return reviewLinks(p).some((link) => sameLink(link, entry));
}

/**
 * The proposal as `fixes` correct it (spec/schema.md §11.3): a copy of its fields, the value V for
 * single-value kinds, and the fields to set on listed notes. Throws FIX_UNKNOWN for an entry that names
 * no item, INVALID_RESULT for a value of the wrong shape, INPUT_INVALID for an item fixed and excluded.
 */
function corrected(workspace: Workspace, p: Record<string, unknown>, fixes: Array<Record<string, unknown>>, exclude: Array<Record<string, unknown>>): { q: Record<string, unknown>; value?: unknown; noteFixes: Map<string, Array<Record<string, unknown>>> } {
  const q = structuredClone(p);
  const noteFixes = new Map<string, Array<Record<string, unknown>>>();
  const kind = String(p.kind);
  const unknown = (entry: Record<string, unknown>): never => { throw new ItemFailure("FIX_UNKNOWN", `fixes entry ${JSON.stringify(entry)} names no item of this ${kind} proposal`); };
  const shape = (message: string): never => { throw new ItemFailure("INVALID_RESULT", message); };
  const only = (keys: string[]) => (entry: Record<string, unknown>) => Object.keys(entry).every((key) => keys.includes(key));
  const single = (): Record<string, unknown> => {
    const entry = fixes[0]!;
    if (!only(["value"])(entry)) unknown(entry);
    if (fixes.length !== 1) shape(`a fix on a ${kind} takes exactly one {value}`);
    return entry;
  };

  if (kind === "update_fact" || kind === "contradiction") {
    const { value } = single();
    if (typeof value !== "string" && typeof value !== "number") shape("a fact value is a string or a number");
    return { q, value, noteFixes };
  }
  if (kind === "add_to_note" || kind === "update_body" || kind === "answer") {
    const { value } = single();
    if (typeof value !== "string" || value.trim() === "") shape(`a fix on a ${kind} is a non-empty text`);
    return { q, value, noteFixes };
  }
  if (kind === "supersede" || kind === "merge") {
    const { value } = single();
    const key = kind === "supersede" ? "supersedes" : "merge_into";
    const note = typeof value === "string" ? workspace.get(value) : undefined;
    const target = workspace.get(String(p.target));
    if (note === undefined || note.id === p.target || note.type !== target?.type) shape(`${String(value)} must be another existing ${target?.type ?? "note"}`);
    if (kind === "supersede" && list(note!.attributes.relations).some((relation) => record(relation).type === "superseded_by")) shape(`${note!.id} is already superseded`);
    q[key] = note!.id;
    return { q, noteFixes };
  }
  if (kind === "new_item") {
    const note = record(q.note);
    const frontmatter = record(note.frontmatter);
    for (const entry of fixes) {
      if (!only(["field", "value"])(entry) || typeof entry.field !== "string" || (entry.field !== "title" && !Object.hasOwn(frontmatter, entry.field))) unknown(entry);
      if (entry.field === "title") note.title = entry.value;
      else frontmatter[entry.field as string] = entry.value;
    }
    return { q, noteFixes };
  }
  if (kind === "add_link") {
    const links = list(q.links).map(record);
    for (const entry of fixes) {
      const link = record(entry.link);
      const at = only(["link", "value"])(entry) ? links.findIndex((candidate) => candidate.field === link.field && isDeepStrictEqual(candidate.value, link.value)) : -1;
      if (at === -1) unknown(entry);
      if (exclude.some((excluded) => excluded.field === link.field && isDeepStrictEqual(excluded.value, link.value))) throw new ItemFailure("INPUT_INVALID", "an item can't be both fixed and excluded");
      links[at] = { ...links[at], value: entry.value };
    }
    q.links = links;
    return { q, noteFixes };
  }
  if (kind === "review_notes") {
    const changes = list(q.changes).map(record);
    const links = list(q.links).map(record);
    for (const entry of fixes) {
      const excluded = (item: Record<string, unknown>) => exclude.some((other) => isDeepStrictEqual(other, item));
      if (entry.change !== undefined) {
        if (!only(["change", "value"])(entry) || !inReview(p, { change: entry.change })) unknown(entry);
        if (excluded({ change: entry.change })) throw new ItemFailure("INPUT_INVALID", "an item can't be both fixed and excluded");
        const change = changes[entry.change as number]!;
        if (change.kind === "update_fact") {
          if (typeof entry.value !== "string" && typeof entry.value !== "number") shape("a fact value is a string or a number");
          change.after = entry.value;
        } else {
          if (typeof entry.value !== "string" || entry.value.trim() === "") shape(`a fix on an ${String(change.kind)} is a non-empty text`);
          change.content = entry.value;
        }
      } else if (entry.note !== undefined) {
        if (!only(["note", "field", "value"])(entry) || !inReview(p, { note: entry.note })) unknown(entry);
        if (excluded({ note: entry.note })) throw new ItemFailure("INPUT_INVALID", "an item can't be both fixed and excluded");
        const field = entry.field;
        if (typeof field !== "string" || !(NOTE_FIX_FIELDS.includes(field) || /^facts\.[a-z][a-z0-9_]*$/.test(field))) shape(`${String(field)} is not a field a fix may set on a note`);
        noteFixes.set(String(entry.note), [...(noteFixes.get(String(entry.note)) ?? []), { field, value: entry.value }]);
      } else if (entry.link !== undefined) {
        const link = record(entry.link);
        const at = only(["link", "value"])(entry) ? links.findIndex((candidate) => sameLink({ target: candidate.target, field: candidate.field, value: candidate.value }, link)) : -1;
        if (at === -1) unknown(entry);
        if (excluded(link)) throw new ItemFailure("INPUT_INVALID", "an item can't be both fixed and excluded");
        links[at] = { ...links[at], value: entry.value };
      } else {
        unknown(entry);
      }
    }
    q.changes = changes;
    q.links = links;
    return { q, noteFixes };
  }
  throw new ItemFailure("INVALID_RESULT", `Unknown proposal kind ${kind}`);
}

/** Fields a fix may set on a note listed by a review_notes: those a correction may set, and projects (spec/schema.md §11.3). */
const NOTE_FIX_FIELDS = ["title", "summary", "why", "domain", "area", "goal", "client", "org", "people", "projects"];

/**
 * Write the excluded items of an applied review_notes as one new pending review_notes (spec/schema.md
 * §11.3): the same source, `deferred_from` = this proposal, each item as stored, in its original order.
 */
function defer(workspace: Workspace, id: string, p: Record<string, unknown>, exclude: Array<Record<string, unknown>>, today: string): string {
  const notes = list(p.notes).filter((note) => exclude.some((entry) => isNoteExclude(entry) && entry.note === note));
  const links = reviewLinks(p).filter((link) => exclude.some((entry) => sameLink(link, entry)));
  const changes = list(p.changes).filter((_change, index) => exclude.some((entry) => entry.change === index));
  const source = String(p.source);
  const fields = {
    kind: "review_notes",
    title: reviewTitle(workspace, source, changes.length, notes.length, links.length, "Deferred from"),
    notes, links,
    ...(changes.length === 0 ? {} : { changes }),
    deferred_from: id,
    why: p.why,
    source,
  };
  return writeProposal(workspace, fields, today).id;
}

/** Apply a proposal's kind to its targets. Returns a message when the proposal is stale. */
function applyKind(workspace: Workspace, p: Record<string, unknown>, proposalPath: string, V: unknown, D: string, today: string, exclude: Array<{ field: string; value: unknown }> = []): string | null {
  const kind = String(p.kind);
  if (kind === "new_item") {
    stageNewItem(workspace, p.note as NoteInput, proposalPath, new Date(`${today}T00:00:00Z`));
    return null;
  }

  const target = existing(workspace, String(p.target));
  const document = workspace.edit(target);
  const a = document.attributes;
  const field = String(p.field);

  if (kind === "update_fact" || kind === "contradiction") {
    const current = record(a.facts)[field];
    if (!isDeepStrictEqual(current, p.before)) {
      const shown = (value: unknown) => (value === undefined ? "absent" : JSON.stringify(value));
      return `facts.${field} is ${shown(current)}, proposal expected ${shown(p.before)}`;
    }
  }
  if (kind === "update_body" && bodyHash(target.body) !== p.before_hash) return `${target.id}'s body changed after the proposal was written`;

  switch (kind) {
    case "update_fact":
      setFact(a, field, V ?? p.after, String(p.from), D, String(p.source));
      break;
    case "contradiction":
      if (V === undefined) contest(a, field, p.after, String(p.from), D, String(p.source));
      else resolveContradiction(a, field, V, String(p.from), D, String(p.source));
      break;
    case "add_to_note": {
      const content = String(V ?? p.content).replace(/\n+$/, "");
      const head = document.body.replace(/\n+$/, "");
      document.body = `${head === "" ? "" : `${head}\n\n`}${content}\nSource: ${String(p.source)}\n`;
      a.sources = union(list(a.sources), [p.source]);
      break;
    }
    case "update_body":
      document.body = bodyOf(String(V ?? p.content));
      a.sources = union(list(a.sources), [p.source]);
      break;
    case "add_link":
      for (const link of proposalLinks(p)) if (!exclude.some((item) => item.field === link.field && isDeepStrictEqual(item.value, link.value)) && !list(a[String(link.field)]).some((value) => isDeepStrictEqual(value, link.value))) a[String(link.field)] = [...list(a[String(link.field)]), link.value];
      break;
    case "supersede": {
      const older = existing(workspace, String(p.supersedes));
      const olderDocument = workspace.edit(older);
      supersedePair(a, target.id, olderDocument.attributes, older.id);
      olderDocument.attributes.updated = today;
      workspace.save(older.path, olderDocument);
      break;
    }
    case "merge":
      merge(workspace, target, existing(workspace, String(p.merge_into)), today);
      return null;
    case "answer":
      // edit: your Note is the answer, as text; otherwise the note that holds it, else the sentence.
      a.answer = V !== undefined ? String(V) : p.answer_note ?? p.answer;
      break;
    default:
      throw new ItemFailure("INVALID_RESULT", `Unknown proposal kind ${kind}`);
  }
  a.updated = today;
  workspace.save(target.path, document);
  return null;
}

/**
 * Apply or reject a review_notes proposal (spec/schema.md §11.2–11.3). Approve applies, in order, the
 * changes not excluded (a stale one is dropped alone), marks the listed draft notes `reviewed` with
 * their fixes, and applies the links; reject archives the draft notes. Excluded entries stay as they
 * are; a note no longer `draft` is left alone and reported `unchanged`.
 */
function reviewNotes(workspace: Workspace, p: Record<string, unknown>, action: "approve" | "reject", exclude: Array<Record<string, unknown>>, today: string, D: string, noteFixes: ReadonlyMap<string, Array<Record<string, unknown>>>): { notes: NoteResult[]; changes: ChangeResult[]; dropped: Array<{ change: number; reason: "stale" }> } {
  const changes: ChangeResult[] = [];
  const dropped: Array<{ change: number; reason: "stale" }> = [];
  if (action === "approve") {
    list(p.changes).map(record).forEach((change, index) => {
      const entry = { index, kind: String(change.kind), target: String(change.target) };
      if (exclude.some((excluded) => excluded.change === index)) { changes.push({ ...entry, result: "deferred" }); return; }
      const stale = applyKind(workspace, { ...change, source: p.source }, "", undefined, D, today);
      if (stale === null) changes.push({ ...entry, result: "applied" });
      else {
        changes.push({ ...entry, result: "dropped", reason: "STALE_PROPOSAL" });
        dropped.push({ change: index, reason: "stale" });
      }
    });
  }
  const results: NoteResult[] = [];
  for (const id of list(p.notes).map(String)) {
    const note = existing(workspace, id);
    const excluded = exclude.some((entry) => isNoteExclude(entry) && entry.note === id);
    const fixes = action === "approve" ? noteFixes.get(id) ?? [] : [];
    if (fixes.length > 0) {
      const document = workspace.edit(note);
      for (const { field, value } of fixes) {
        const fact = /^facts\.(.+)$/.exec(String(field))?.[1];
        if (fact !== undefined) setFact(document.attributes, fact, value, D, D, String(p.source));
        else document.attributes[String(field)] = value;
      }
      document.attributes.updated = today;
      workspace.save(note.path, document);
    }
    const lifecycle = String(workspace.get(id)!.attributes.lifecycle);
    if (lifecycle !== "draft") results.push({ id, result: "unchanged", lifecycle });
    else if (excluded) results.push({ id, result: "kept_draft", lifecycle });
    else {
      const next = action === "approve" ? "reviewed" : "archived";
      const document = workspace.edit(workspace.get(id)!);
      document.attributes.lifecycle = next;
      document.attributes.updated = today;
      workspace.save(note.path, document);
      results.push({ id, result: action === "approve" ? "reviewed" : "archived", lifecycle: next });
    }
  }
  if (action === "approve") {
    for (const link of reviewLinks(p)) {
      if (exclude.some((entry) => sameLink(link, entry))) continue;
      const target = existing(workspace, String(link.target));
      const document = workspace.edit(target);
      const values = list(document.attributes[String(link.field)]);
      if (values.some((value) => isDeepStrictEqual(value, link.value))) continue;
      document.attributes[String(link.field)] = [...values, link.value];
      document.attributes.updated = today;
      workspace.save(target.path, document);
    }
  }
  return { notes: results, changes, dropped };
}

function reviewLinks(proposal: Record<string, unknown>): Array<{ target: unknown; field: unknown; value: unknown }> {
  return list(proposal.links).filter(isRecord).map((link) => ({ target: link.target, field: link.field, value: link.value }));
}

function sameLink(link: { target: unknown; field: unknown; value: unknown }, entry: Record<string, unknown>): boolean {
  return entry.target === link.target && entry.field === link.field && isDeepStrictEqual(entry.value, link.value);
}

function isNoteExclude(entry: Record<string, unknown>): boolean {
  return typeof entry.note === "string" && Object.keys(entry).length === 1;
}

function isChangeExclude(entry: Record<string, unknown>): boolean {
  return Number.isInteger(entry.change) && (entry.change as number) >= 0 && Object.keys(entry).length === 1;
}

function proposalLinks(proposal: Record<string, unknown>): Array<{ field: unknown; value: unknown }> {
  if (Array.isArray(proposal.links)) return proposal.links.filter(isRecord).map((link) => ({ field: link.field, value: link.value }));
  return proposal.field === undefined ? [] : [{ field: proposal.field, value: proposal.after }];
}

/** update_fact (and a facts.<key> correction): retire accepted entries, append the new value. */
function setFact(a: Record<string, unknown>, field: string, value: unknown, from: string, learned: string, source: string): void {
  a.timeline = [
    ...list(a.timeline).map((entry) =>
      isRecord(entry) && entry.field === field && entry.assessment === "accepted" ? entryWith(entry, { until: from, assessment: "superseded" }) : entry),
    timelineEntry(field, value, from, learned, source, "accepted"),
  ];
  a.facts = { ...record(a.facts), [field]: value };
}

/** contradiction approved: keep both claims as contested and drop the current fact. */
function contest(a: Record<string, unknown>, field: string, value: unknown, from: string, learned: string, source: string): void {
  a.timeline = [
    ...list(a.timeline).map((entry) =>
      isRecord(entry) && entry.field === field && entry.assessment === "accepted" ? entryWith(entry, { assessment: "contested" }) : entry),
    timelineEntry(field, value, from, learned, source, "contested"),
  ];
  const facts = { ...record(a.facts) };
  delete facts[field];
  if (Object.keys(facts).length === 0) delete a.facts;
  else a.facts = facts;
}

/** contradiction edited: V is the accepted truth (spec/schema.md §11.2). */
function resolveContradiction(a: Record<string, unknown>, field: string, value: unknown, from: string, learned: string, source: string): void {
  const timeline = list(a.timeline);
  const live = timeline
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isRecord(entry) && entry.field === field && (entry.assessment === "accepted" || entry.assessment === "contested"));
  const matches = live.filter(({ entry }) => isDeepStrictEqual(record(entry).value, value));
  const keep = matches.reduce<(typeof live)[number] | undefined>((latest, candidate) =>
    latest === undefined || String(record(candidate.entry).learned) >= String(record(latest.entry).learned) ? candidate : latest, undefined);
  const next = [...timeline];
  for (const { entry, index } of live) {
    next[index] = index === keep?.index ? entryWith(record(entry), { assessment: "accepted" }) : entryWith(record(entry), { until: from, assessment: "superseded" });
  }
  if (keep === undefined) next.push(timelineEntry(field, value, from, learned, source, "accepted"));
  a.timeline = next;
  a.facts = { ...record(a.facts), [field]: value };
}

/** Write both sides of a supersession; the older note is archived (spec/schema.md §11.2). */
function supersedePair(newer: Record<string, unknown>, newerId: string, older: Record<string, unknown>, olderId: string): void {
  newer.relations = unionRelations(list(newer.relations), [{ type: "supersedes", target: olderId }]);
  older.relations = unionRelations(list(older.relations), [{ type: "superseded_by", target: newerId }]);
  older.lifecycle = "archived";
  if (newer.type === "decision" && older.type === "decision") {
    older.assessment = "superseded";
    older.valid_until = newer.valid_from ?? newer.date;
  }
}

/** merge X (the duplicate) into Y (spec/schema.md §11.2). */
function merge(workspace: Workspace, x: Note, y: Note, today: string): void {
  // 1. References, in every note except X, Y, sources and proposals.
  for (const note of workspace.notes) {
    if (note.id === x.id || note.id === y.id || note.type === "source" || note.type === "proposal") continue;
    const document = workspace.edit(note);
    const before = JSON.stringify([document.attributes, document.body]);
    rewriteReferences(document.attributes, x.id, y.id);
    document.body = rewriteLinks(document.body, note.path, x.path, y.path);
    if (JSON.stringify([document.attributes, document.body]) !== before) {
      document.attributes.updated = today;
      workspace.save(note.path, document);
    }
  }

  // 2. Into Y.
  const xDocument = workspace.edit(workspace.get(x.id)!);
  const yDocument = workspace.edit(workspace.get(y.id)!);
  const xa = xDocument.attributes;
  const ya = yDocument.attributes;
  const unionInto = (key: string, extra: unknown[] = []) => {
    const merged = union(list(ya[key]), [...list(xa[key]), ...extra]);
    if (merged.length > 0) ya[key] = merged;
  };
  unionInto("aliases", [xa.title]);
  unionInto("tags");
  unionInto("sources");
  unionInto("projects");
  const carried = list(xa.relations).filter((relation) => {
    const { type, target } = record(relation);
    return type !== "supersedes" && type !== "superseded_by" && target !== x.id && target !== y.id;
  });
  if (carried.length > 0) ya.relations = unionRelations(list(ya.relations), carried);

  const yFacts = record(ya.facts);
  const timeline = [...list(ya.timeline)];
  for (const entry of list(xa.timeline)) {
    if (timeline.some((other) => isDeepStrictEqual(other, entry))) continue;
    const { field, value, assessment } = record(entry);
    const conflicting = Object.hasOwn(yFacts, String(field)) && assessment === "accepted" && !isDeepStrictEqual(value, yFacts[String(field)]);
    timeline.push(conflicting ? entryWith(record(entry), { until: today, assessment: "superseded" }) : entry);
  }
  if (timeline.length > 0) ya.timeline = timeline;
  const facts = { ...yFacts };
  for (const [key, value] of Object.entries(record(xa.facts))) if (!Object.hasOwn(facts, key)) facts[key] = value;
  if (Object.keys(facts).length > 0) ya.facts = facts;

  const yBody = yDocument.body.replace(/\n+$/, "");
  const xBody = xDocument.body.replace(/^\n+|\n+$/g, "");
  yDocument.body = `${yBody === "" ? "" : `${yBody}\n\n`}## Merged from ${String(xa.title)}\n${xBody === "" ? "" : `\n${xBody}\n`}`;

  // 3. The pair: X archived and superseded by Y.
  supersedePair(ya, y.id, xa, x.id);
  xa.updated = today;
  ya.updated = today;
  workspace.save(x.path, xDocument);
  workspace.save(y.path, yDocument);
}

function rewriteReferences(a: Record<string, unknown>, from: string, to: string): void {
  const swap = (value: unknown): unknown => (value === from ? to : value);
  for (const key of REFERENCE_FIELDS) {
    if (PAIR_FIELDS.has(key) || a[key] === undefined) continue;
    const value = a[key];
    if (Array.isArray(value)) a[key] = union([], value.map(swap));
    else if (isRecord(value)) a[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v)]));
    else a[key] = swap(value);
  }
  if (Array.isArray(a.relations)) {
    a.relations = unionRelations([], a.relations.map((relation) => {
      const r = record(relation);
      return r.type === "supersedes" || r.type === "superseded_by" ? relation : { ...r, target: swap(r.target) };
    }));
  }
  if (Array.isArray(a.timeline)) {
    a.timeline = a.timeline.map((entry) => {
      const e = record(entry);
      return e.value === from || e.source === from ? { ...e, value: swap(e.value), source: swap(e.source) } : entry;
    });
  }
}

/** Point relative Markdown links to X's file at Y's file instead, outside fenced code blocks. */
function rewriteLinks(body: string, notePath: string, xPath: string, yPath: string): string {
  const dir = posix.dirname(notePath);
  const rewriteTarget = (raw: string): string => {
    const target = raw.startsWith("<") ? raw.slice(1, -1) : raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return raw;
    const suffixAt = target.search(/[?#]/);
    const path = suffixAt === -1 ? target : target.slice(0, suffixAt);
    const suffix = suffixAt === -1 ? "" : target.slice(suffixAt);
    let decoded = path!;
    try {
      decoded = decodeURIComponent(path!);
    } catch {
      // keep as written
    }
    if (posix.normalize(posix.join(dir, decoded)) !== xPath) return raw;
    const replaced = `${posix.relative(dir, yPath)}${suffix}`;
    return raw.startsWith("<") ? `<${replaced}>` : replaced;
  };
  const rewriteProse = (prose: string): string => {
    const spans: string[] = [];
    const masked = prose.replace(/(`+)((?:(?!\r?\n[ \t]*\r?\n)[\s\S])*?)\1/g, (span) => {
      const marker = `\u0000${spans.length}\u0000`;
      spans.push(span);
      return marker;
    });
    return masked
    .replace(/\]\(\s*(<[^>]*>|[^)\s]+)/g, (match, raw: string) => match.replace(raw, () => rewriteTarget(raw)))
    .replace(/^(\s{0,3}\[(?!\^)[^\]\n]+\]:\s*)(<[^>]*>|[^\s]+)/gm, (match, prefix: string, raw: string) => `${prefix}${rewriteTarget(raw)}`)
    .replace(/<([^<>\n]+)>/g, (match, target: string) => rewriteTarget(`<${target}>`))
    .replace(/\u0000(\d+)\u0000/g, (_marker, index: string) => spans[Number(index)]!);
  };

  const lines = body.split(/(?<=\n)/);
  const output: string[] = [];
  let prose: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  const flush = () => {
    if (prose.length > 0) output.push(rewriteProse(prose.join("")));
    prose = [];
  };
  for (const line of lines) {
    if (fence === undefined) {
      const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (open !== undefined) {
        flush();
        fence = { character: open[0]! as "`" | "~", length: open.length };
        output.push(line);
      } else prose.push(line);
    } else {
      output.push(line);
      const close = new RegExp(`^\\s{0,3}${fence.character}{${fence.length},}\\s*(?:\\n)?$`);
      if (close.test(line)) fence = undefined;
    }
  }
  flush();
  return output.join("");
}

/** Proposals holding a recorded decision that is not applied yet, oldest first. */
function recordedDecisions(workspace: Workspace): DecisionInput[] {
  return workspace.notes
    .filter((note) => note.type === "proposal" && ["approved", "edited", "rejected"].includes(String(note.attributes.status)) && isRecord(note.attributes.decision))
    .sort((a, b) => compareCodePoints(String(a.attributes.created), String(b.attributes.created)) || compareCodePoints(a.id, b.id))
    .map((note) => ({ proposal: note.id, ...(note.attributes.decision as unknown as Decision) }));
}

function existing(workspace: Workspace, id: string): Note {
  const note = workspace.get(id);
  if (note === undefined) throw new ItemFailure("UNKNOWN_ID", `No note with id ${id}`);
  return note;
}

function titleOf(workspace: Workspace, id: string): string {
  const title = workspace.get(id)?.attributes.title;
  return typeof title === "string" ? title : "";
}

/** A timeline entry with its keys in the spec/schema.md §5 order. */
function timelineEntry(field: string, value: unknown, from: string, learned: string, source: string, assessment: string): Record<string, unknown> {
  return { field, value, from, learned, source, assessment };
}

const ENTRY_ORDER = ["field", "value", "from", "until", "learned", "source", "assessment", "note"];

function entryWith(entry: Record<string, unknown>, changes: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...entry, ...changes };
  const rank = (key: string) => (ENTRY_ORDER.includes(key) ? ENTRY_ORDER.indexOf(key) : ENTRY_ORDER.length);
  return Object.fromEntries(Object.entries(merged).sort(([a], [b]) => rank(a) - rank(b)));
}

function union(base: readonly unknown[], extra: readonly unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const value of [...base, ...extra]) if (!out.some((other) => isDeepStrictEqual(other, value))) out.push(value);
  return out;
}

function unionRelations(base: readonly unknown[], extra: readonly unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const relation of [...base, ...extra]) {
    const { type, target } = record(relation);
    if (!out.some((other) => record(other).type === type && record(other).target === target)) out.push(relation);
  }
  return out;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isTimestamp(value: unknown): value is string { return normalizeTimestamp(value) !== undefined; }
