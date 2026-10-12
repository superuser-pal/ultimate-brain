import { isDeepStrictEqual } from "node:util";
import { posix } from "node:path";

import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import type { NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { stageNewItem } from "./proposals.ts";
import { loadSchemas } from "./schemas.ts";
import { formatDate } from "./time.ts";
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
  action: "approve" | "reject" | "edit";
  value?: unknown;
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
}

export interface ApplyResult {
  corrections: Array<{ target: string; field: string } & ItemResult>;
  decisions: Array<{ proposal: string; kind?: string; action: string } & ItemResult>;
  summary: Record<"applied" | "closed" | "recorded" | "corrected" | "skipped" | "failed", number>;
  log: LogEntry[];
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ACTIONS = ["approve", "reject", "edit"];
const EDITABLE = new Set(["update_fact", "contradiction", "add_to_note"]);
/** Reference fields a merge leaves alone: the meeting side of a persisted pair (spec/schema.md §11.2). */
const PAIR_FIELDS = new Set(["decisions", "questions", "decided_in", "raised_in"]);
/** Corrections change knowledge notes only: sources are immutable and proposals are records. */
const KNOWLEDGE_TYPES = new Set(["area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "memory"]);
const REFERENCE_FIELDS = [
  "area", "areas", "goal", "client", "org", "projects", "people", "attendees", "deciders", "source", "sources",
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
    problems.push(...unknownKeys(item, ["proposal", "action", "value", "decided_at", "decided_by"], pointer));
    if (typeof item.proposal !== "string") problems.push({ pointer: `${pointer}/proposal`, message: "must be a proposal id" });
    if (!ACTIONS.includes(item.action as string)) problems.push({ pointer: `${pointer}/action`, message: "must be approve, reject or edit" });
    if (item.action === "edit" && (item.value === undefined || item.value === null)) problems.push({ pointer: `${pointer}/value`, message: "is required for edit" });
    if (item.action !== "edit" && item.value !== undefined) problems.push({ pointer: `${pointer}/value`, message: "is only allowed for edit" });
    if (!isTimestamp(item.decided_at)) problems.push({ pointer: `${pointer}/decided_at`, message: "must be an ISO 8601 UTC timestamp" });
    if (item.decided_by !== "notion" && item.decided_by !== "chat") problems.push({ pointer: `${pointer}/decided_by`, message: "must be notion or chat" });
  });
  assertNoProblems(problems);
  return { corrections: corrections as Correction[], decisions: decisions as DecisionInput[] };
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
    : KNOWLEDGE_TYPES.has(note.type) && ["title", "summary", "why", "area", "goal", "client", "org", "people"].includes(correction.field) && known?.has(correction.field) === true;
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

  const incoming: Decision = { action: input.action, ...(input.value === undefined ? {} : { value: input.value }), decided_at: input.decided_at, decided_by: input.decided_by };
  const recorded = isRecord(p.decision) ? (p.decision as unknown as Decision) : undefined;
  let decision = incoming;
  if (recorded !== undefined && (recorded.action !== incoming.action || !isDeepStrictEqual(recorded.value, incoming.value))) {
    // You changed your mind in Notion before it was applied: the later decision wins.
    if (Date.parse(recorded.decided_at) >= Date.parse(incoming.decided_at)) decision = recorded;
  } else if (recorded !== undefined) {
    decision = recorded;
  }
  if (decision.action === "edit" && !EDITABLE.has(String(p.kind))) {
    throw new ItemFailure("EDIT_NOT_ALLOWED", `edit is not allowed on a ${String(p.kind)} proposal (spec/schema.md §11.1)`);
  }
  const action = decision.action === incoming.action ? undefined : decision.action;

  p.decision = decision;
  p.status = decision.action === "approve" ? "approved" : decision.action === "edit" ? "edited" : "rejected";
  p.updated = today;
  if (recordOnly) {
    workspace.save(proposal.path, document);
    return { result: "recorded", action };
  }

  if (decision.action === "reject") {
    p.status = "closed";
    workspace.save(proposal.path, document);
    return { result: "closed", action };
  }

  const D = decision.decided_at.slice(0, 10);
  const V = decision.action === "edit" ? decision.value : undefined;
  const stale = applyKind(workspace, p, proposal.path, V, D, today);
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

/** Apply a proposal's kind to its targets. Returns a message when the proposal is stale. */
function applyKind(workspace: Workspace, p: Record<string, unknown>, proposalPath: string, V: unknown, D: string, today: string): string | null {
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
    case "add_link":
      if (!list(a[field]).some((value) => isDeepStrictEqual(value, p.after))) a[field] = [...list(a[field]), p.after];
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
    default:
      throw new ItemFailure("INVALID_RESULT", `Unknown proposal kind ${kind}`);
  }
  a.updated = today;
  workspace.save(target.path, document);
  return null;
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

/** Point relative Markdown links to X's file at Y's file instead. */
function rewriteLinks(body: string, notePath: string, xPath: string, yPath: string): string {
  const dir = posix.dirname(notePath);
  return body.replace(/\]\(\s*(<[^>]*>|[^)\s]+)/g, (match, raw: string) => {
    const target = raw.startsWith("<") ? raw.slice(1, -1) : raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return match;
    const [path, ...fragment] = target.split("#");
    let decoded = path!;
    try {
      decoded = decodeURIComponent(path!);
    } catch {
      // keep as written
    }
    if (posix.normalize(posix.join(dir, decoded)) !== xPath) return match;
    const replaced = [posix.relative(dir, yPath), ...fragment].join("#");
    return match.replace(raw, () => (raw.startsWith("<") ? `<${replaced}>` : replaced));
  });
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

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}
