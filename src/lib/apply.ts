import { isDeepStrictEqual } from "node:util";
import { posix } from "node:path";

import { contentLines, sectionLine, withSectionLines } from "./from-the-brain.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import type { NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { areaGroup, createTaskWrite, fixValueProblem, notionWrite, projectsProblem, type NotionWrite } from "./notion-change.ts";
import { bodyHash, bodyOf, reviewTitle, sourceTitle, stageNewItem, subjectLabel, writeProposal } from "./proposals.ts";
import { brainFieldValue, settlePublished } from "./notion-corrections.ts";
import { acceptCleanupItem, cleanupItemView, CLEANUP_KINDS, CleanupSkip, reconcile } from "./cleanup-row.ts";
import { loadSchemas } from "./schemas.ts";
import { lineageOf, restrictedSources } from "./eligibility.ts";
import { citedPassages, linkRefs, proposalWithheld, proposedText } from "./passages.ts";
import { citesPassage, contextFor, requireSuppressions, withheldSupport } from "./suppressions.ts";
import { formatDate, normalizeTimestamp } from "./time.ts";
import { generateItemId } from "./ids.ts";
import type { Workspace } from "./workspace.ts";
import type { LogEntry } from "./log.ts";
import type { FrontmatterDocument } from "./frontmatter.ts";

export interface Decision {
  action: "approve" | "reject" | "fix" | "edit";
  value?: unknown;
  note?: string;
  /** fix: the corrected values, per kind (spec/schema.md §11.3, 0045). */
  fixes?: Array<Record<string, unknown>>;
  /** add_link: `{field, value}`; review_notes: `{note}`, `{target, field, value}` or `{change}` (spec/schema.md §11). */
  exclude?: Array<Record<string, unknown>>;
  /** review_notes with items: the items the user turned down, rejected at once (0.16.0, 0098; spec/schema.md §11.3). */
  reject?: Array<Record<string, unknown>>;
  decided_at: string;
  /** tick and cleanup (0.17.0) come only through brain cleanup (cli.md §5.38): a tick in a Ready Weekly row, a mechanical item applied alone. */
  decided_by: "notion" | "chat" | "tick" | "cleanup";
}

export interface DecisionInput extends Decision {
  proposal: string;
}

export interface ApplyInput {
  /** Null: apply every proposal that holds a recorded decision but is not terminal. */
  decisions: DecisionInput[] | null;
}

export interface ItemResult {
  result: "applied" | "closed" | "recorded" | "awaiting_notion" | "skipped" | "failed";
  reason?: string;
  message?: string;
  changed: string[];
  /** review_notes only: what happened to each listed note (spec/cli.md §5.7). */
  notes?: NoteResult[];
  /** applied review_notes only: what happened to each change, and the row holding the excluded items (0045). */
  changes?: ChangeResult[];
  deferred?: string;
  /** review_notes: the items withheld for want of eligible support, `it-` ids, or `{change}`, `{note}`, `{link}` on a row without items (spec/cli.md §5.7). */
  withheld?: Array<string | Record<string, unknown>>;
  /** A proposal closed SOURCE_EXCLUDED: the input its source comes from, so the next ingest can propose it again (eligibility.md §9.3). */
  input?: string;
  /** A proposal closed SOURCE_EXCLUDED that was written before the passages field (schema §11.5). */
  legacy?: boolean;
  /** A cleanup review_notes whose accepted items left no note restricted by its input: the input's records are reconciled (spec/cli.md §5.7). */
  reconciled?: boolean;
}

export interface ChangeResult {
  index: number;
  kind: string;
  target: string;
  result: "applied" | "dropped" | "deferred" | "rejected";
  reason?: "STALE_PROPOSAL" | "SOURCE_EXCLUDED";
}

export interface NoteResult {
  id: string;
  result: "reviewed" | "archived" | "kept_draft" | "unchanged";
  lifecycle: string;
}

export interface ApplyResult {
  decisions: Array<{ proposal: string; kind?: string; action: string } & ItemResult>;
  summary: Record<"applied" | "closed" | "recorded" | "awaiting_notion" | "skipped" | "failed", number>;
  /** The Notion writes of the notion_change proposals decided here, for the skill to carry out (spec/cli.md §5.7). */
  notion_writes: NotionWrite[];
  log: LogEntry[];
}

const ACTIONS = ["approve", "reject", "fix", "edit"];
export const EDITABLE = new Set(["update_fact", "contradiction", "add_to_note", "update_body", "replace_line", "answer"]);
const FIX_KEYS = ["value", "change", "note", "field", "link", "item"];
/** A tracked_task's fix (spec/schema.md §11.3): `{answer}` records the answer (a), `{drop: true}` drops the question (b). */
const isTrackedFix = (entry: unknown): boolean => isRecord(entry) && ((typeof entry.answer === "string" && Object.keys(entry).length === 1) || (entry.drop === true && Object.keys(entry).length === 1));
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
  // Your Notion edits are proposals decided like any other since 0.16.0 (0101 §4): the corrections input is retired.
  if (Object.hasOwn(record, "corrections")) assertNoProblems([{ pointer: "/corrections", message: "is retired in 0.16.0: a correction from Notion is a pending notion_correction proposal, decided in the session (spec/cli.md §5.7)" }]);
  const problems: InputProblem[] = unknownKeys(record, ["decisions"], "");
  const decisions = record.decisions;
  if (!Array.isArray(decisions) || decisions.length === 0) problems.push({ pointer: "/decisions", message: "must be a non-empty list" });
  assertNoProblems(problems);

  (decisions as unknown[]).forEach((item, index) => {
    const pointer = `/decisions/${index}`;
    if (!isRecord(item)) return problems.push({ pointer, message: "must be an object" });
    problems.push(...unknownKeys(item, ["proposal", "action", "value", "note", "fixes", "exclude", "reject", "decided_at", "decided_by"], pointer));
    if (typeof item.proposal !== "string") problems.push({ pointer: `${pointer}/proposal`, message: "must be a proposal id" });
    if (!ACTIONS.includes(item.action as string)) problems.push({ pointer: `${pointer}/action`, message: "must be approve, reject, fix or edit" });
    if (item.action === "fix" && (typeof item.note !== "string" || item.note === "")) problems.push({ pointer: `${pointer}/note`, message: "is required for fix: the user's words" });
    if (item.action === "fix" && (!Array.isArray(item.fixes) || item.fixes.length === 0 || item.fixes.some((entry) => !isTrackedFix(entry) && (!isRecord(entry) || !Object.hasOwn(entry, "value") || Object.keys(entry).some((key) => !FIX_KEYS.includes(key)))))) problems.push({ pointer: `${pointer}/fixes`, message: "must be a non-empty list of entries with a value, or a tracked_task's {answer} or {drop: true} (spec/schema.md §11.3)" });
    if (item.action !== "fix" && item.fixes !== undefined) problems.push({ pointer: `${pointer}/fixes`, message: "is only allowed for fix" });
    if (item.action === "edit" && (item.value === undefined || item.value === null)) problems.push({ pointer: `${pointer}/value`, message: "is required for edit" });
    if (item.action !== "edit" && item.value !== undefined) problems.push({ pointer: `${pointer}/value`, message: "is only allowed for edit" });
    if (item.note !== undefined && typeof item.note !== "string") problems.push({ pointer: `${pointer}/note`, message: "must be a string" });
    if (item.exclude !== undefined && (!Array.isArray(item.exclude) || item.exclude.some((entry) => !isRecord(entry) || !(isNoteExclude(entry) || isChangeExclude(entry) || (typeof entry.field === "string" && Object.hasOwn(entry, "value") && Object.keys(entry).every((key) => ["target", "field", "value"].includes(key))))))) problems.push({ pointer: `${pointer}/exclude`, message: "must be a list of {field, value}, {target, field, value}, {note} or {change} entries" });
    if (item.reject !== undefined && (!Array.isArray(item.reject) || item.reject.length === 0 || item.reject.some((entry) => !isRecord(entry) || !(isNoteExclude(entry) || isChangeExclude(entry) || isItemEntry(entry) || (typeof entry.target === "string" && typeof entry.field === "string" && Object.hasOwn(entry, "value") && Object.keys(entry).length === 3))))) problems.push({ pointer: `${pointer}/reject`, message: "must be a non-empty list of {note}, {target, field, value}, {change} or {item} entries" });
    if (!isTimestamp(item.decided_at)) problems.push({ pointer: `${pointer}/decided_at`, message: "must be an ISO 8601 UTC timestamp" });
    if (item.decided_by !== "notion" && item.decided_by !== "chat") problems.push({ pointer: `${pointer}/decided_by`, message: item.decided_by === "tick" || item.decided_by === "cleanup" ? `${String(item.decided_by)} is written only by brain cleanup (spec/cli.md §5.38): must be notion or chat` : "must be notion or chat" });
  });
  assertNoProblems(problems);
  return {
    decisions: (decisions as DecisionInput[]).map((item) => ({ ...item, decided_at: normalizeTimestamp(item.decided_at)! })),
  };
}

/**
 * Apply decisions in input order (spec/cli.md §5.7, spec/schema.md §11.2). Each item is staged and validated on its own: a failed item leaves the workspace as it
 * was, and later items see the results of earlier ones. Nothing is written; the caller commits.
 */
export function applyAll(workspace: Workspace, input: ApplyInput, options: { now: Date; recordOnly: boolean }): ApplyResult {
  const today = formatDate(options.now);
  const result: ApplyResult = {
    decisions: [],
    summary: { applied: 0, closed: 0, recorded: 0, awaiting_notion: 0, skipped: 0, failed: 0 },
    notion_writes: [],
    log: [],
  };

  const decisions = input.decisions ?? recordedDecisions(workspace);
  for (const decision of decisions) {
    const proposal = workspace.get(decision.proposal);
    const kind = proposal?.type === "proposal" ? String(proposal.attributes.kind) : undefined;
    const item = runItem(workspace, () => applyDecision(workspace, decision, today, options.recordOnly));
    if (item.write !== undefined) result.notion_writes.push(item.write);
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
  withheld?: Array<string | Record<string, unknown>>;
  input?: string;
  legacy?: boolean;
  reconciled?: boolean;
  /** Action actually applied, when it differs from the input's (an earlier, later-dated decision). */
  action?: string;
  /** awaiting_notion: the write the skill carries out (spec/cli.md §5.7). */
  write?: NotionWrite;
}

class ItemFailure extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}

/** Run one item atomically: on failure or a result that adds lint errors, restore the workspace. */
function runItem(workspace: Workspace, run: () => Outcome): { outcome: ItemResult; action?: string; write?: NotionWrite } {
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
  const { action, write, ...rest } = outcome;
  return { outcome: { ...rest, changed }, action, write };
}

function applyDecision(workspace: Workspace, input: DecisionInput, today: string, recordOnly: boolean): Outcome {
  const proposal = workspace.get(input.proposal);
  if (proposal === undefined || proposal.type !== "proposal") throw new ItemFailure("UNKNOWN_ID", `No proposal with id ${input.proposal}`);
  const document = workspace.edit(proposal);
  const p = document.attributes;
  if (p.status === "applied" || p.status === "closed") return { result: "skipped", reason: "ALREADY_TERMINAL" };

  const incoming: Decision = { action: input.action, ...(input.value === undefined ? {} : { value: input.value }), ...(input.note === undefined ? {} : { note: input.note }), ...(input.fixes === undefined ? {} : { fixes: input.fixes }), ...(input.exclude === undefined ? {} : { exclude: input.exclude }), ...(input.reject === undefined ? {} : { reject: input.reject }), decided_at: input.decided_at, decided_by: input.decided_by };
  const recorded = isRecord(p.decision) ? (p.decision as unknown as Decision) : undefined;
  let decision = incoming;
  if (recorded !== undefined && (recorded.action !== incoming.action || !isDeepStrictEqual(recorded.value, incoming.value) || !isDeepStrictEqual(recorded.fixes, incoming.fixes) || !isDeepStrictEqual(recorded.exclude, incoming.exclude) || !isDeepStrictEqual(recorded.reject, incoming.reject))) {
    // The user changed their mind before it was applied: the later decision wins.
    if (Date.parse(recorded.decided_at) >= Date.parse(incoming.decided_at)) decision = recorded;
  } else if (recorded !== undefined) {
    decision = recorded;
  }
  if (decision.action === "edit" && !EDITABLE.has(String(p.kind))) {
    throw new ItemFailure("EDIT_NOT_ALLOWED", `edit is not allowed on a ${String(p.kind)} proposal (spec/schema.md §11.1); use fix`);
  }
  // A tracked_task names its answer: (a) and (b) are fixes, (c) a reject (spec/schema.md §11.1, 0101 §6).
  if (p.kind === "tracked_task" && decision.action === "approve") throw new ItemFailure("INPUT_INVALID", "a tracked_task takes fix ({answer} or {drop: true}) or reject (keep it open), not approve: approve names no answer (spec/cli.md §5.7)");
  const cleanup = p.kind === "review_notes" && isRecord(p.cleanup);
  if (cleanup) checkCleanupDecision(p, decision);
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
  const rejected = decision.reject ?? [];
  if (decision.reject !== undefined && !cleanup) checkReject(p, decision, exclude);
  // A fix corrects the proposal before it is applied; the file keeps what was proposed (spec/schema.md §11.3).
  const fixed = decision.action === "fix" && !cleanup ? corrected(workspace, p, decision.fixes ?? [], [...exclude, ...rejected]) : { q: p, noteFixes: new Map<string, Array<Record<string, unknown>>>() };
  const action = decision.action === incoming.action ? undefined : decision.action;

  // A new_task (0.17.0) is written by the skill too: apply records the decision and hands back the Tasks row to create (spec/schema.md §11.2).
  if (p.kind === "new_task" && decision.action !== "reject") {
    const project = workspace.get(String(p.target));
    const page = project?.attributes.notion;
    const archived = project === undefined || project.attributes.lifecycle === "archived" || project.path.startsWith("archive/") || (isRecord(project.attributes.notion_fields) && project.attributes.notion_fields.archived === true);
    if (recordOnly) {
      p.decision = decision; p.status = decision.action === "approve" ? "approved" : "edited"; p.updated = today;
      workspace.save(proposal.path, document);
      return { result: "recorded", action };
    }
    if (archived || typeof page !== "string") {
      p.decision = decision; p.status = "closed"; p.closed_reason = "stale"; p.updated = today;
      workspace.save(proposal.path, document);
      return { result: "closed", reason: "STALE_PROPOSAL", message: archived ? `${String(p.target)} is no longer a live project` : `${String(p.target)} has no Notion page`, action };
    }
    const title = decision.action === "fix" && typeof fixed.value === "string" ? fixed.value : String(p.task_title);
    if (!(recorded !== undefined && decision === recorded && (p.status === "approved" || p.status === "edited"))) {
      p.decision = decision; p.status = decision.action === "approve" ? "approved" : "edited"; p.updated = today;
      workspace.save(proposal.path, document);
    }
    return { result: "awaiting_notion", action, write: createTaskWrite(workspace, proposal.id, title, project!) };
  }
  // A notion_change is written by the skill, not here: apply records the decision and hands back the write (spec/cli.md §5.7).
  if (p.kind === "notion_change" && decision.action !== "reject") {
    const write = recordOnly ? undefined : notionWrite(workspace, proposal.id, p, decision.action === "fix" ? fixed.value : p.value_after);
    if (write !== undefined && "reason" in write) throw new ItemFailure(write.reason, write.message);
    const status = decision.action === "approve" ? "approved" : "edited";
    // The same decision already recorded: nothing changes in the file, the write is handed back again.
    if (!(recorded !== undefined && decision === recorded && p.status === status)) {
      p.decision = decision;
      p.status = status;
      p.updated = today;
      workspace.save(proposal.path, document);
    }
    return recordOnly ? { result: "recorded", action } : { result: "awaiting_notion", action, write };
  }

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
    rejectFromNotion(workspace, p, today);
    // A rejected review_notes archives the notes still draft, with no successor (spec/schema.md §11.2).
    const notes = p.kind === "review_notes" ? reviewNotes(workspace, p, "reject", [], today, "", new Map()).notes : undefined;
    return { result: "closed", action, ...(notes === undefined ? {} : { notes }) };
  }

  if (cleanup) return applyCleanup(workspace, proposal, document, decision, today, action);
  const D = decision.decided_at.slice(0, 10);
  const V = decision.action === "edit" ? decision.value : fixed.value;
  // What you did in Notion is not an input: neither kind is judged by the excluded-evidence rule (spec/cli.md §5.7, 0101 §4, §6).
  if (p.kind === "notion_correction" || p.kind === "tracked_task") {
    const stale = p.kind === "notion_correction" ? applyNotionCorrection(workspace, p, V, today, decision.action === "fix" ? proposal.id : undefined) : applyTrackedAnswer(workspace, p, V as Record<string, unknown>, D, today);
    p.status = stale === null ? "applied" : "closed";
    if (stale !== null) p.closed_reason = "stale";
    workspace.save(proposal.path, document);
    return stale === null ? { result: "applied", action } : { result: "closed", reason: "STALE_PROPOSAL", message: stale, action };
  }
  if (p.kind === "review_notes") {
    // A review_notes is judged item by item before apply on every route: an item without eligible support is withheld and the independent
    // items apply (eligibility.md §4.1, §4.2, §9.3; cli §5.7). With items, item by item; without (older layout), each folded
    // change, note and link alone, recorded in `dropped`.
    const layered = Array.isArray(p.items);
    // An item the user turned down is not judged, as a deferred one isn't: it is rejected whatever it rests on (schema §11.3).
    const withheld = layered ? withheldItems(workspace, proposal, [...exclude, ...rejected]) : olderLayoutWithheld(workspace, proposal, exclude);
    const applied = reviewNotes(workspace, fixed.q, "approve", exclude, today, D, fixed.noteFixes, withheld, rejected);
    if (rejected.length > 0) {
      p.item_decisions = [...list(p.item_decisions), ...rejectedItemIds(p, rejected).map((item_id) => ({ item_id, decision: "reject", decided_at: decision.decided_at, decided_by: decision.decided_by }))];
    }
    const dropped: Array<Record<string, unknown>> = [...applied.dropped];
    if (!layered) {
      dropped.push(...[...withheld.changes].map((change) => ({ change, reason: "source_excluded" })), ...[...withheld.notes].map((note) => ({ note, reason: "source_excluded" })), ...[...withheld.links].map((link) => ({ link, reason: "source_excluded" })));
    }
    if (dropped.length > 0) p.dropped = dropped;
    const withheldIds = [...withheld.ids];
    if (layered && withheldIds.length > 0) {
      p.item_decisions = [...list(p.item_decisions), ...withheldIds.map((item_id) => ({ item_id, decision: "reject", decided_at: decision.decided_at, decided_by: decision.decided_by, state: "closed", reason: "source_excluded" }))];
    }
    const reported: Array<string | Record<string, unknown>> = layered ? withheldIds : [...[...withheld.changes].map((change) => ({ change })), ...[...withheld.notes].map((note) => ({ note })), ...[...withheld.links].map((link) => ({ link }))];
    const extra = { ...(reported.length === 0 ? {} : { withheld: reported, ...reproposal(workspace, p, layered ? undefined : true) }) };
    if (withheld.all && exclude.length === 0) {
      p.status = "closed";
      p.closed_reason = "stale";
      workspace.save(proposal.path, document);
      return { result: "closed", reason: "SOURCE_EXCLUDED", message: "no item has eligible support: each rests on evidence the user excluded, or was written before passages and its input has excluded content", action, notes: applied.notes, changes: applied.changes, ...extra };
    }
    p.status = "applied";
    workspace.save(proposal.path, document);
    const deferred = exclude.length === 0 ? undefined : defer(workspace, proposal.id, p, exclude, today);
    return { result: "applied", action, notes: applied.notes, changes: applied.changes, ...(deferred === undefined ? {} : { deferred }), ...extra };
  }
  // Checked before apply, on every route, with the suppression records as they are now: a proposal resting on excluded evidence, even beside a
  // live passage, is closed stale and nothing of it is applied, even on an Approve (eligibility.md §4.2, §9.2). What is judged is the wording
  // that would be written: the user's value on a fix or an edit, else the proposed text. Only a value that differs from the proposal and cites
  // no passage is the user's own wording: it is not judged, and it is attributed to the user, never to the proposal's source (§9.5).
  // Its passages are judged too (`passages`; a legacy proposal by its input, schema §11.5), so a change with no text is judged by what it
  // rests on. Only on a kind whose value is the whole change can the user's value be their own: a fix of a merge's survivor, a supersede's
  // older note, a link or a new_item's fields still carries the proposal's claim (§9.5: an incidental edit does not launder).
  const proposed = proposedText(fixed.q);
  const written = typeof V === "string" ? V : proposed;
  const own = OWN_VALUE_KINDS.has(String(p.kind)) && decision.action !== "approve" && V !== undefined && !isDeepStrictEqual(V, proposedText(p) ?? p.after) && !(typeof V === "string" && citesPassage(V));
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  // A value the user gave that cites passages is that wording's exact acceptance: it rests on the passages it cites, not on the proposal's
  // whole list (cli §5.7, "Which decisions are checked"). Otherwise the proposal's passages are judged.
  const revised = decision.action !== "approve" && typeof V === "string" && V !== proposed && citesPassage(V) && p.passages !== undefined;
  if (!own && withheldSupport({ source: p.source, passages: revised ? citedPassages(V as string) : p.passages, text: written }, context)) {
    p.status = "closed";
    p.closed_reason = "stale";
    workspace.save(proposal.path, document);
    return { result: "closed", reason: "SOURCE_EXCLUDED", message: p.passages === undefined ? "the proposal was written before passages and its input has content you excluded: it can be proposed again from that input's current version" : "the proposal rests on evidence the user excluded from the brain", action, ...reproposal(workspace, p, p.passages === undefined) };
  }
  // The user's own value replaces a proposal that rests on excluded evidence: the source's claim is not kept beside it (§9.4).
  const sourceExcluded = own && withheldSupport({ source: p.source, passages: p.passages, text: proposed }, context);
  const stale = applyKind(workspace, fixed.q, proposal.path, V, D, today, exclude as Array<{ field: string; value: unknown }>, own ? proposal.id : undefined, sourceExcluded);
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

/** The kinds whose value is the whole change, so a value the user typed in its place can be their own correction (cli §5.7, eligibility.md §9.5). */
const OWN_VALUE_KINDS = new Set(["update_fact", "contradiction", "add_to_note", "update_body", "answer", "set_field"]);

/** What a closed SOURCE_EXCLUDED result reports for re-proposal (eligibility.md §9.3): the input its source comes from, and whether it is legacy. */
function reproposal(workspace: Workspace, p: Record<string, unknown>, legacy: boolean | undefined): { input?: string; legacy?: boolean } {
  const context = contextFor(workspace.notes, { suppressions: [] });
  const input = typeof p.source === "string" ? lineageOf(p.source, context.sources) : null;
  return { ...(input === null ? {} : { input }), ...(legacy === true ? { legacy: true } : {}) };
}

/**
 * The items of a review_notes without `items` (older layout) withheld for want of eligible support (eligibility.md §9.3; cli §5.7): each folded
 * change, listed note and link alone, every one legacy. Excluded (deferred) items are not judged. `all`: every item left is withheld.
 */
function olderLayoutWithheld(workspace: Workspace, proposal: Note, exclude: Array<Record<string, unknown>>): { ids: Set<string>; changes: Set<number>; notes: Set<string>; links: Set<number>; all: boolean } {
  const a = proposal.attributes;
  const found = proposalWithheld(proposal, workspace, contextFor(workspace.notes, requireSuppressions(workspace.root)));
  const links = reviewLinks(a);
  const openChanges = list(a.changes).map((_change, index) => index).filter((index) => !exclude.some((item) => item.change === index));
  const openNotes = list(a.notes).map(String).filter((id) => !exclude.some((item) => isNoteExclude(item) && item.note === id));
  const openLinks = links.map((_link, index) => index).filter((index) => !exclude.some((item) => sameLink(links[index]!, item)));
  const changes = new Set(openChanges.filter((index) => found.changes.has(index)));
  const notes = new Set(openNotes.filter((id) => found.notes.has(id)));
  const kept = new Set(openLinks.filter((index) => found.links.has(index)));
  const open = openChanges.length + openNotes.length + openLinks.length;
  return { ids: new Set(), changes, notes, links: kept, all: open > 0 && changes.size + notes.size + kept.size === open };
}

/** A text the user typed in place of the proposed one, citing no passage: theirs, attributed `user-correction:<proposal id>` (capture-and-review §7.7). */
function userWording(V: unknown, proposed: unknown, correctedBy: string | undefined): boolean {
  return correctedBy !== undefined && typeof V === "string" && V !== proposed && !citesPassage(V);
}

/**
 * The items of a review_notes with `items` that rest on excluded evidence (`source_excluded`, cli §5.7): each judged by its own passages, a
 * legacy one by its input, a note by its draft too (schema §11.5), and a cleanup item while the proposal's source is restricted. Items already decided or deferred by the decision are not judged. `all`: every item left is withheld.
 */
function withheldItems(workspace: Workspace, proposal: Note, exclude: Array<Record<string, unknown>>): { ids: Set<string>; changes: Set<number>; notes: Set<string>; links: Set<number>; all: boolean } {
  const out = { ids: new Set<string>(), changes: new Set<number>(), notes: new Set<string>(), links: new Set<number>(), all: false };
  const a = proposal.attributes;
  if (!Array.isArray(a.items)) return out;
  const decided = new Set(list(a.item_decisions).map(record).map((entry) => String(entry.item_id)));
  const entries = new Map(list(a.items).map(record).map((entry) => [String(entry.item_id), entry]));
  const links = reviewLinks(a);
  const deferred = (entry: Record<string, unknown>): boolean => entry.kind === "note" ? exclude.some((item) => isNoteExclude(item) && item.note === entry.ref)
    : entry.kind === "link" ? linkRefs(entry.ref).some((ref) => exclude.some((item) => links[ref] !== undefined && sameLink(links[ref]!, item)))
    : exclude.some((item) => item.change === Number(entry.ref));
  const open = [...entries.values()].filter((entry) => !decided.has(String(entry.item_id)) && !deferred(entry));
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const found = proposalWithheld(proposal, workspace, context);
  const sourceRestricted = typeof a.source === "string" && restrictedSources(context).has(a.source);
  const excluded = (entry: Record<string, unknown>): boolean => (CLEANUP_KINDS as readonly unknown[]).includes(entry.kind) ? sourceRestricted
    : entry.kind === "note" ? found.notes.has(String(entry.ref)) : entry.kind === "link" ? linkRefs(entry.ref).some((ref) => found.links.has(ref)) : entry.kind === "change" ? found.changes.has(Number(entry.ref)) : false;
  for (const entry of entries.values()) {
    if (!excluded(entry) || !open.includes(entry)) continue;
    out.ids.add(String(entry.item_id));
    if (entry.kind === "note") out.notes.add(String(entry.ref));
    else if (entry.kind === "link") for (const ref of linkRefs(entry.ref)) out.links.add(ref);
    else out.changes.add(Number(entry.ref));
  }
  out.all = open.length > 0 && open.every((entry) => out.ids.has(String(entry.item_id)));
  return out;
}

/**
 * A `reject` (0.16.0, 0098; cli §5.7, schema §11.3): only on an approved or fixed review_notes with items; each entry an item of it, none also
 * excluded or fixed, and a grouped link item turned down whole. Throws INPUT_INVALID or EXCLUDE_UNKNOWN.
 */
function checkReject(p: Record<string, unknown>, decision: Decision, exclude: Array<Record<string, unknown>>): void {
  const rejected = decision.reject ?? [];
  if ((decision.action !== "approve" && decision.action !== "fix") || p.kind !== "review_notes") throw new ItemFailure("INPUT_INVALID", "reject is only allowed on an approved or fixed review_notes proposal");
  if (!Array.isArray(p.items)) throw new ItemFailure("INPUT_INVALID", "reject needs a review_notes with items (written from 0.8.0 on): exclude the items and reject the deferred proposal");
  if (rejected.some((entry) => !inReview(p, entry))) throw new ItemFailure("EXCLUDE_UNKNOWN", "reject contains an entry that is not in the proposal");
  if (rejected.some((entry) => exclude.some((other) => isDeepStrictEqual(other, entry)))) throw new ItemFailure("INPUT_INVALID", "an item can't be both turned down and excluded");
  const links = reviewLinks(p);
  for (const item of list(p.items).map(record).filter((entry) => entry.kind === "link")) {
    const refs = linkRefs(item.ref);
    const named = refs.filter((ref) => links[ref] !== undefined && rejected.some((entry) => sameLink(links[ref]!, entry)));
    if (named.length > 0 && named.length < refs.length) throw new ItemFailure("INPUT_INVALID", "a grouped link item is turned down whole: name each of its links in reject, or none (spec/schema.md §11.3)");
  }
}

const isItemEntry = (entry: Record<string, unknown>): boolean => typeof entry.item === "string" && Object.keys(entry).length === 1;

/**
 * A decision on a cleanup review_notes (cli §5.7, §5.26): no `exclude` (a cleanup item has no defer); `reject` and `fixes` name items by their
 * `it-` id; a fix gives a `remove` its text and an `independence` Keep or Remove, and a `restore` takes none. Throws before anything is written.
 */
function checkCleanupDecision(p: Record<string, unknown>, decision: Decision): void {
  if (decision.exclude !== undefined) throw new ItemFailure("INPUT_INVALID", "a cleanup item has no defer: leave the proposal pending to decide it later (spec/cli.md §5.7)");
  const items = new Map(list(p.items).map(record).map((entry) => [String(entry.item_id), entry]));
  const rejected = decision.reject ?? [];
  if (decision.reject !== undefined) {
    if (decision.action !== "approve" && decision.action !== "fix") throw new ItemFailure("INPUT_INVALID", "reject is only allowed on an approved or fixed review_notes proposal");
    if (rejected.some((entry) => !isItemEntry(entry))) throw new ItemFailure("INPUT_INVALID", "reject on a cleanup review_notes takes {item} entries (spec/cli.md §5.7)");
    if (rejected.some((entry) => !items.has(String(entry.item)))) throw new ItemFailure("EXCLUDE_UNKNOWN", "reject contains an item that is not in the proposal");
  }
  for (const entry of decision.fixes ?? []) {
    const item = typeof entry.item === "string" && Object.keys(entry).every((key) => key === "item" || key === "value") ? items.get(entry.item) : undefined;
    if (item === undefined) throw new ItemFailure("FIX_UNKNOWN", `fixes entry ${JSON.stringify(entry)} names no item of this cleanup proposal: an entry is {item, value}`);
    if (rejected.some((other) => other.item === entry.item)) throw new ItemFailure("INPUT_INVALID", "an item can't be both turned down and fixed");
    if (item.kind === "restore") throw new ItemFailure("INVALID_RESULT", "a restore item takes no fix: approve it or turn it down");
    if (item.kind === "remove" && (typeof entry.value !== "string" || entry.value.trim() === "")) throw new ItemFailure("INVALID_RESULT", "a remove item's fix is the note's text, a non-empty string");
    if (item.kind === "independence" && !(typeof entry.value === "string" && ["keep", "remove"].includes(entry.value.trim().toLowerCase()))) throw new ItemFailure("INVALID_RESULT", "an independence item's fix is Keep or Remove");
  }
  if ((decision.fixes ?? []).some((entry, index, all) => all.findIndex((other) => other.item === entry.item) !== index)) throw new ItemFailure("INPUT_INVALID", "an item is fixed once");
}

/**
 * Apply an approved or fixed cleanup review_notes (cli §5.7, §5.26) in one operation: each item not yet decided is turned down, withheld while
 * the row's source is excluded (the rule Review pages had before 0.16.0), or accepted by `acceptCleanupItem`; then, when nothing is
 * left restricted by the input, its records are reconciled. A failed item fails the decision and the caller restores the workspace.
 */
function applyCleanup(workspace: Workspace, proposal: Note, document: FrontmatterDocument, decision: Decision, today: string, action: string | undefined): Outcome {
  const p = document.attributes;
  const input = String(record(p.cleanup).input);
  const decided = new Set(list(p.item_decisions).map(record).map((entry) => String(entry.item_id)));
  const rejected = new Set((decision.reject ?? []).map((entry) => String(entry.item)));
  const fixes = new Map((decision.fixes ?? []).map((entry) => [String(entry.item), String(entry.value)]));
  const withheld = withheldItems(workspace, proposal, []);
  const entries: Array<Record<string, unknown>> = [];
  const held: string[] = [];
  let accepted = 0;
  for (const entry of list(p.items).map(record)) {
    const id = String(entry.item_id);
    if (decided.has(id)) continue;
    const stamp = { item_id: id, decided_at: decision.decided_at, decided_by: decision.decided_by };
    if (rejected.has(id)) { entries.push({ ...stamp, decision: "reject" }); continue; }
    if (withheld.ids.has(id)) { held.push(id); entries.push({ ...stamp, decision: "reject", state: "closed", reason: "source_excluded" }); continue; }
    const proposed = fixes.get(id) ?? (entry.kind === "remove" ? cleanupItemView(proposal, entry, workspace).proposed : entry.kind === "restore" ? "Restore" : "Remove");
    try { acceptCleanupItem(workspace, proposal, entry, proposed, today); } catch (error) { if (error instanceof CleanupSkip) throw new ItemFailure(error.code, `${id}: ${error.message}`); throw error; }
    accepted += 1;
    entries.push({ ...stamp, decision: "accept", ...(fixes.has(id) ? { edited: true } : {}) });
  }
  p.item_decisions = [...list(p.item_decisions), ...entries];
  const extra = held.length === 0 ? {} : { withheld: held };
  if (accepted === 0 && held.length > 0 && rejected.size === 0) {
    p.status = "closed";
    p.closed_reason = "stale";
    workspace.save(proposal.path, document);
    return { result: "closed", reason: "SOURCE_EXCLUDED", message: "no item has eligible support: the input this cleanup is for is excluded", action, ...extra };
  }
  const reconciled = accepted > 0 && reconcile(workspace, input, decision.decided_at);
  p.status = "applied";
  workspace.save(proposal.path, document);
  return { result: "applied", action, ...extra, ...(reconciled ? { reconciled } : {}) };
}

/** The `it-` ids of the items a `reject` names (schema §11.3): a note by its id, a change by its index, a link item by its links. */
function rejectedItemIds(p: Record<string, unknown>, rejected: Array<Record<string, unknown>>): string[] {
  const links = reviewLinks(p);
  return list(p.items).map(record).filter((item) => item.kind === "note" ? rejected.some((entry) => isNoteExclude(entry) && entry.note === item.ref)
    : item.kind === "change" ? rejected.some((entry) => entry.change === Number(item.ref))
    : item.kind === "link" && linkRefs(item.ref).some((ref) => links[ref] !== undefined && rejected.some((entry) => sameLink(links[ref]!, entry)))).map((item) => String(item.item_id));
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
  if (kind === "replace_line") {
    const { value } = single();
    if (!isOneLine(value)) shape("a fix on a replace_line is one non-empty line");
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
        } else if (change.kind === "replace_line") {
          if (!isOneLine(entry.value)) shape("a fix on a replace_line is one non-empty line");
          change.line_after = entry.value;
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
  if (kind === "notion_correction") {
    const { value } = single();
    const problem = correctionValueProblem(workspace, String(p.field), value);
    if (problem !== undefined) shape(problem);
    return { q, value, noteFixes };
  }
  if (kind === "tracked_task") {
    const entry = fixes[0]!;
    if (fixes.length !== 1 || !isTrackedFix(entry)) shape("a fix on a tracked_task is exactly one {answer: <one sentence>} or {drop: true} (spec/schema.md §11.3)");
    if (typeof entry.answer === "string" && entry.answer.trim() === "") shape("an answer is a non-empty sentence");
    return { q, value: entry, noteFixes };
  }
  if (kind === "notion_change" || kind === "set_field") {
    const { value } = single();
    const problem = fixValueProblem(workspace, p, value);
    if (problem !== undefined) shape(problem);
    if (kind === "set_field") q.after = value;
    return { q, value, noteFixes };
  }
  // A new_task's fix is the task's words (0.17.0); a clean-up item takes no fix: approve it or turn it down.
  if (kind === "new_task") {
    const { value } = single();
    if (!isOneLine(value)) shape("a fix on a new_task is the task's words, one non-empty line");
    return { q, value, noteFixes };
  }
  if (kind === "archive_draft" || kind === "fix_structure") shape(`a ${kind} takes no fix: approve it or turn it down`);
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
  const allLinks = reviewLinks(p);
  const linkIndexes = allLinks.map((_link, index) => index).filter((index) => exclude.some((entry) => sameLink(allLinks[index]!, entry)));
  const changeIndexes = list(p.changes).map((_change, index) => index).filter((index) => exclude.some((entry) => entry.change === index));
  const links = linkIndexes.map((index) => allLinks[index]!);
  const changes = changeIndexes.map((index) => list(p.changes)[index]);
  const source = String(p.source);
  // A deferred item keeps its immutable id: it lives on in the new proposal under the same id, with its reference re-indexed (capture-and-review §7.6).
  const oldItems = list(p.items) as Array<{ item_id: string; kind: string; ref: unknown; passages?: unknown; unsure?: unknown; repeat?: unknown }>;
  // The item keeps its passages with its id (schema §11.5); a legacy item stays legacy.
  const moved = (kind: string, ref: unknown, at: unknown) => {
    const entry = oldItems.find((candidate) => candidate.kind === kind && candidate.ref === ref);
    return { ...(entry ?? {}), item_id: entry?.item_id, kind, ref: at };
  };
  // A grouped link item (schema §11) moves as one item with the links of it that are deferred, re-indexed.
  const linkItems = oldItems.filter((candidate) => candidate.kind === "link" && linkRefs(candidate.ref).some((ref) => linkIndexes.includes(ref))).map((candidate) => {
    const at = linkRefs(candidate.ref).filter((ref) => linkIndexes.includes(ref)).map((ref) => linkIndexes.indexOf(ref));
    return { ...candidate, ref: Array.isArray(candidate.ref) ? at : at[0] };
  });
  const items = oldItems.length === 0 ? undefined : [
    ...changeIndexes.map((original, index) => moved("change", original, index)),
    ...notes.map((note) => moved("note", note, note)),
    ...linkItems,
  ];
  const fields = {
    kind: "review_notes",
    title: reviewTitle(workspace, source, changes.length, notes.length, links.length, "Deferred from", typeof p.subject === "string" ? subjectLabel(workspace, p.subject, contextFor(workspace.notes, requireSuppressions(workspace.root))) : undefined),
    notes, links,
    ...(changes.length === 0 ? {} : { changes }),
    ...(items === undefined ? {} : { items }),
    deferred_from: id,
    why: p.why,
    source,
    // A part's deferred items stay its subject's (schema §11.3, 0098).
    ...(typeof p.subject === "string" ? { subject: p.subject } : {}),
    // A correction group's deferred changes stay its claim's (weekly-review.md §8.4).
    ...(typeof p.correction === "string" ? { correction: p.correction } : {}),
  };
  return writeProposal(workspace, fields, today).id;
}

/** The reference fields a correction sets (spec/cli.md §5.7's table), and the prefix of their ids. */
const CORRECTION_REFERENCES: Record<string, string> = { area: "area", goal: "gol", client: "org", org: "org", domain: "dom" };

/** Why a value can't be a correction of `field` (spec/cli.md §5.7's table): a fix's value has the shape of `after`. */
function correctionValueProblem(workspace: Workspace, field: string, value: unknown): string | undefined {
  if (field.startsWith("facts.")) return typeof value === "string" || typeof value === "number" ? undefined : "a fact value is a string or a number";
  if (["title", "summary", "why"].includes(field)) return typeof value === "string" && value.trim() !== "" ? undefined : `${field} is a non-empty text`;
  const prefix = CORRECTION_REFERENCES[field];
  if (prefix !== undefined) return value === null || (typeof value === "string" && value.startsWith(`${prefix}-`) && workspace.get(value) !== undefined) ? undefined : `${field} is an existing ${prefix}- id, or null to remove it`;
  if (field === "people") return Array.isArray(value) && value.every((id) => typeof id === "string" && id.startsWith("per-") && workspace.get(id) !== undefined) ? undefined : "people is a list of existing per- ids";
  return undefined;
}

/**
 * An accepted correction from Notion (spec/cli.md §5.7, decision 0027, 0101 §4): applied by the corrections table, a key fact with its
 * timeline entry (`source: notion-edit`, or `user-correction:<proposal>` on a fix), then S of its property set to `notion_value`. A value
 * equal to the current one changes only S. Returns a message when the target's field is no longer `before`.
 */
function applyNotionCorrection(workspace: Workspace, p: Record<string, unknown>, V: unknown, today: string, correctedBy: string | undefined): string | null {
  const note = existing(workspace, String(p.target));
  const field = String(p.field);
  const factKey = /^facts\.([a-z][a-z0-9_]*)$/.exec(field)?.[1];
  const known = loadSchemas().knownKeys(note.type);
  const correctable = KNOWLEDGE_TYPES.has(note.type) && (factKey !== undefined ? known?.has("facts") === true : ["title", "summary", "why", "domain", "area", "goal", "client", "org", "people"].includes(field) && known?.has(field) === true);
  if (!correctable) throw new ItemFailure("FIELD_NOT_CORRECTABLE", `${field} cannot be corrected on a ${note.type}`);
  const current = brainFieldValue(note, field);
  if (!isDeepStrictEqual(current, p.before)) {
    const shown = (value: unknown) => (value === undefined ? "absent" : JSON.stringify(value));
    return `${field} is ${shown(current)}, the correction expected ${shown(p.before)}`;
  }
  const value = V === undefined ? p.after : V;
  const document = workspace.edit(note);
  const a = document.attributes;
  if (!isDeepStrictEqual(current ?? null, value ?? null)) {
    if (factKey !== undefined) {
      const date = String(p.observed_at).slice(0, 10);
      setFact(a, factKey, value, date, date, correctedBy === undefined ? "notion-edit" : `user-correction:${correctedBy}`);
    } else if (value === null) delete a[field];
    else a[field] = value;
    a.updated = today;
  }
  settlePublished(a, String(p.property), p.notion_value);
  workspace.save(note.path, document);
  return null;
}

/** An open question (schema §4): no answer, not dropped, not archived. */
const openQuestion = (a: Record<string, unknown>): boolean => a.answer === undefined && a.dropped === undefined && a.lifecycle !== "archived";

/**
 * A tracked_task answered (a) or (b) (spec/schema.md §11.2, 0101 §6): the question's answer recorded, or the question dropped with its task
 * kept. Nothing is written to Notion. Returns a message when the question is no longer open or no longer tracked by that page.
 */
function applyTrackedAnswer(workspace: Workspace, p: Record<string, unknown>, V: Record<string, unknown>, D: string, today: string): string | null {
  const question = existing(workspace, String(p.target));
  const document = workspace.edit(question);
  const a = document.attributes;
  if (!openQuestion(a)) return `${question.id} is no longer open`;
  if (a.task !== p.page) return `${question.id} is no longer tracked by task ${String(p.page)}`;
  if (typeof V.answer === "string") a.answer = V.answer;
  else { a.lifecycle = "archived"; a.dropped = D; }
  a.updated = today;
  workspace.save(question.path, document);
  return null;
}

/**
 * What a reject writes besides the proposal (spec/schema.md §11.2): a rejected correction sets S of its property to `notion_value`, so the
 * next publish puts the brain's value back; a tracked_task kept open (c) on a task in Notion's trash unlinks it from its open question.
 */
function rejectFromNotion(workspace: Workspace, p: Record<string, unknown>, today: string): void {
  if (p.kind === "notion_correction") {
    const note = existing(workspace, String(p.target));
    const document = workspace.edit(note);
    settlePublished(document.attributes, String(p.property), p.notion_value);
    workspace.save(note.path, document);
  }
  if (p.kind === "tracked_task" && p.task_state === "gone") {
    const question = workspace.get(String(p.target));
    if (question === undefined || question.attributes.task !== p.page || !openQuestion(question.attributes)) return;
    const document = workspace.edit(question);
    delete document.attributes.task;
    document.attributes.updated = today;
    workspace.save(question.path, document);
  }
}

/** Apply a proposal's kind to its targets. Returns a message when the proposal is stale. */
export function applyKind(workspace: Workspace, p: Record<string, unknown>, proposalPath: string, V: unknown, D: string, today: string, exclude: Array<{ field: string; value: unknown }> = [], correctedBy?: string, sourceExcluded = false): string | null {
  const kind = String(p.kind);
  if (kind === "new_item") {
    // A theme's Document ticked in a Weekly row (0.17.0, weekly-review.md §6.1): written draft, with its own pending review_notes, which
    // the session asks as any new note (0076 §4). Otherwise approving the row is the review: the note is written reviewed (0071).
    if (typeof p.fingerprint === "string" && p.fingerprint.startsWith("theme:") && record(p.decision).decided_by === "tick") {
      const staged = stageNewItem(workspace, p.note as NoteInput, proposalPath, new Date(`${today}T00:00:00Z`), "draft");
      const evidence = list(p.evidence).map(String);
      const newest = [...evidence].sort((a, b) => compareCodePoints(dateOfInput(workspace, b), dateOfInput(workspace, a)) || compareCodePoints(b, a))[0];
      const passages = list(p.passages).length > 0 ? list(p.passages) : undefined;
      writeProposal(workspace, {
        kind: "review_notes", title: `Review the Document "${String(staged.note.title ?? (p.note as NoteInput).frontmatter.title)}"`.slice(0, 120), notes: [staged.note.id], links: [],
        items: [{ item_id: generateItemId(new Set()), kind: "note", ref: staged.note.id, ...(passages === undefined ? {} : { passages }) }],
        why: String(p.why), source: newest ?? String(p.source), fingerprint: p.fingerprint, evidence,
      }, today);
      return null;
    }
    stageNewItem(workspace, p.note as NoteInput, proposalPath, new Date(`${today}T00:00:00Z`), "reviewed");
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
  if (kind === "replace_line") {
    if (bodyHash(target.body) !== p.before_hash) return `${target.id}'s body changed after the proposal was written`;
    const count = target.body.split("\n").filter((line) => line === p.line_before).length;
    if (count !== 1) return `${target.id}'s body holds the line to replace ${count} times, not once`;
    if (V !== undefined && !isOneLine(V)) throw new ItemFailure("INVALID_RESULT", "a replace_line value is one non-empty line");
  }
  // The weekly clean-up's kinds (0.17.0, spec/schema.md §11.2): each stale when what it rests on changed.
  if (kind === "archive_draft") {
    if (a.lifecycle !== "draft") return `${target.id} is ${String(a.lifecycle)}, no longer a draft`;
    const linked = workspace.notes.find((note) => note.id !== target.id && note.type !== "view" && (note.type === "proposal" ? ["pending", "approved", "edited"].includes(String(note.attributes.status)) && note.id !== p.id && JSON.stringify(note.attributes).includes(target.id) : JSON.stringify(note.attributes).includes(target.id) || bodyLinks(note, target.path)));
    if (linked !== undefined) return `${linked.id} now ${linked.type === "proposal" ? "names" : "links"} ${target.id}`;
  }
  if (kind === "fix_structure") {
    if (p.tidy === "moved_link") {
      if (bodyHash(target.body) !== p.before_hash) return `${target.id}'s body changed after the proposal was written`;
      const count = target.body.split("\n").filter((line) => line === p.line_before).length;
      if (count !== 1) return `${target.id}'s body holds the line to fix ${count} times, not once`;
    } else if (!isDeepStrictEqual(a[field], p.before)) return `${field} is ${a[field] === undefined ? "absent" : JSON.stringify(a[field])}, proposal expected ${p.before === undefined ? "absent" : JSON.stringify(p.before)}`;
  }
  if (kind === "set_field" && a[field] !== p.before) return `${field} is ${a[field] === undefined ? "absent" : JSON.stringify(a[field])}, proposal expected ${p.before === undefined ? "absent" : JSON.stringify(p.before)}`;
  if (kind === "set_field" && field === "area") { const problem = projectsProblem(workspace, target); if (problem !== undefined) return problem; }

  switch (kind) {
    case "update_fact":
      // The user edited the proposed value and accepted it (capture-and-review §7.7): the source keeps its own claim, the correction is attributed to the user.
      // When the proposal rests on excluded evidence, the source's value is excluded text: only the user's value is written (eligibility.md §9.4, §9.5).
      if (correctedBy !== undefined && V !== undefined && !isDeepStrictEqual(V, p.after) && sourceExcluded) setFact(a, field, V, String(p.from), D, `user-correction:${correctedBy}`);
      else if (correctedBy !== undefined && V !== undefined && !isDeepStrictEqual(V, p.after)) setFactCorrected(a, field, V, p.after, String(p.from), D, String(p.source), correctedBy);
      else setFact(a, field, V ?? p.after, String(p.from), D, String(p.source));
      break;
    case "contradiction":
      if (V === undefined) contest(a, field, p.after, String(p.from), D, String(p.source));
      else resolveContradiction(a, field, V, String(p.from), D, String(p.source), p.after, String(p.id));
      break;
    case "add_to_note": {
      if (p.section === "from_the_brain") {
        // The lines go at the end of the From the brain section; no Source line, and sources don't change: each line cites its note (schema §11.2, 0100 §3).
        const lines = contentLines(String(V ?? p.content));
        if (lines.some((line) => sectionLine(line) === null)) throw new ItemFailure("INVALID_RESULT", "a From the brain line is \"- <text> ([<title>](<relative link>))\"");
        document.body = withSectionLines(document.body, lines);
        break;
      }
      const content = String(V ?? p.content).replace(/\n+$/, "");
      const head = document.body.replace(/\n+$/, "");
      // The user's own wording is a separately attributed correction: it never claims the source said it (eligibility.md §9.5, cli §5.7).
      const theirs = userWording(V, p.content, correctedBy);
      document.body = `${head === "" ? "" : `${head}\n\n`}${content}\nSource: ${theirs ? `user-correction:${correctedBy!}` : String(p.source)}\n`;
      if (!theirs) a.sources = union(list(a.sources), [p.source]);
      break;
    }
    case "replace_line": {
      // The one line equal to line_before becomes the value; nothing else of the note changes (spec/schema.md §11.2).
      const lines = document.body.split("\n");
      lines[lines.indexOf(String(p.line_before))] = String(V ?? p.line_after);
      document.body = lines.join("\n");
      break;
    }
    case "update_body":
      document.body = bodyOf(String(V ?? p.content));
      // A whole Document keeps one source, the later version the change came from (schema §11.2); the earlier stays reachable through replaces.
      if (a.origin === "whole") a.sources = [p.source];
      else if (!userWording(V, p.content, correctedBy)) a.sources = union(list(a.sources), [p.source]);
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
    case "set_field":
      // Applied like a correction of that field (spec/cli.md §5.7); a fix has already put its value in `after`.
      a[field] = p.after;
      // A source and its whole Documents move together; nothing else of a source changes (0092 §3, §4).
      if (field === "area") {
        for (const member of areaGroup(workspace, target).slice(1)) {
          if (isDeepStrictEqual(member.attributes.area, p.after)) continue;
          const other = workspace.edit(member);
          other.attributes.area = p.after;
          other.attributes.updated = today;
          workspace.save(member.path, other);
        }
      }
      break;
    case "archive_draft":
      // Archived, with no successor; nothing is deleted (spec/schema.md §11.2).
      a.lifecycle = "archived";
      break;
    case "fix_structure":
      if (p.tidy === "moved_link") {
        const lines = document.body.split("\n");
        lines[lines.indexOf(String(p.line_before))] = String(p.line_after);
        document.body = lines.join("\n");
      } else a[field] = structuredClone(p.after);
      break;
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
function reviewNotes(workspace: Workspace, p: Record<string, unknown>, action: "approve" | "reject", exclude: Array<Record<string, unknown>>, today: string, D: string, noteFixes: ReadonlyMap<string, Array<Record<string, unknown>>>, withheld?: { changes: ReadonlySet<number>; notes: ReadonlySet<string>; links: ReadonlySet<number> }, rejected: Array<Record<string, unknown>> = []): { notes: NoteResult[]; changes: ChangeResult[]; dropped: Array<{ change: number; reason: "stale" }> } {
  const changes: ChangeResult[] = [];
  const dropped: Array<{ change: number; reason: "stale" }> = [];
  if (action === "approve") {
    list(p.changes).map(record).forEach((change, index) => {
      const entry = { index, kind: String(change.kind), target: String(change.target) };
      if (exclude.some((excluded) => excluded.change === index)) { changes.push({ ...entry, result: "deferred" }); return; }
      if (rejected.some((turned) => turned.change === index)) { changes.push({ ...entry, result: "rejected" }); return; }
      if (withheld?.changes.has(index) === true) { changes.push({ ...entry, result: "dropped", reason: "SOURCE_EXCLUDED" }); return; }
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
    // A withheld draft is archived, as an Accept on its held Review item does (cli §5.14.3); its fixes are not applied.
    // A withheld draft, or one the user turned down, is archived (cli §5.7, schema §11.3): its fixes are not applied.
    const held = action === "approve" && (withheld?.notes.has(id) === true || rejected.some((entry) => isNoteExclude(entry) && entry.note === id));
    const fixes = action === "approve" && !held ? noteFixes.get(id) ?? [] : [];
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
      const next = action === "approve" && !held ? "reviewed" : "archived";
      const document = workspace.edit(workspace.get(id)!);
      document.attributes.lifecycle = next;
      document.attributes.updated = today;
      workspace.save(note.path, document);
      results.push({ id, result: next, lifecycle: next });
    }
  }
  if (action === "approve") {
    for (const [index, link] of reviewLinks(p).entries()) {
      if (exclude.some((entry) => sameLink(link, entry)) || rejected.some((entry) => sameLink(link, entry)) || withheld?.links.has(index) === true) continue;
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

/** One non-empty line: a replace_line's value (spec/schema.md §11.3). */
function isOneLine(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "" && !/[\r\n]/.test(value);
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

/**
 * A fact the user corrected before accepting (capture-and-review §7.7): the current value is the user's; the timeline keeps what the source
 * said (superseded, never rewritten, never attributed to the user) and adds the user's value with its own source, `user-correction:<proposal>`.
 */
function setFactCorrected(a: Record<string, unknown>, field: string, value: unknown, original: unknown, from: string, learned: string, source: string, proposal: string): void {
  a.timeline = [
    ...list(a.timeline).map((entry) =>
      isRecord(entry) && entry.field === field && entry.assessment === "accepted" ? entryWith(entry, { until: from, assessment: "superseded" }) : entry),
    entryWith(timelineEntry(field, original, from, learned, source, "superseded"), { until: from }),
    timelineEntry(field, value, from, learned, `user-correction:${proposal}`, "accepted"),
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

/**
 * contradiction edited: V is the accepted truth (spec/schema.md §11.2). A new entry keeps the proposal's source when V is the value that
 * source claims (`after`); any other value is the user's own, attributed `user-correction:<proposal id>` (0076 §1, CC-160).
 */
function resolveContradiction(a: Record<string, unknown>, field: string, value: unknown, from: string, learned: string, source: string, claimed: unknown, proposal: string): void {
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
  if (keep === undefined) next.push(timelineEntry(field, value, from, learned, isDeepStrictEqual(value, claimed) ? source : `user-correction:${proposal}`, "accepted"));
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
  // 1. References, in every note except X, Y, sources, proposals and views (views are generated; X's own stay with X, CC-148).
  for (const note of workspace.notes) {
    if (note.id === x.id || note.id === y.id || note.type === "source" || note.type === "proposal" || note.type === "view") continue;
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

/** Whether a note's body links this file (a relative Markdown link resolving to it), outside fenced code. */
function bodyLinks(note: Note, path: string): boolean {
  const dir = posix.dirname(note.path);
  return note.body.split("\n").some((line) => [...line.matchAll(/\]\(\s*<?([^)\s>]+)>?/g)].some((match) => {
    const target = match[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) return false;
    let decoded = target.split(/[?#]/)[0]!;
    try { decoded = decodeURIComponent(decoded); } catch { /* keep */ }
    return posix.normalize(posix.join(dir, decoded)) === path;
  }));
}

/** The date of a meeting or source, for picking a theme's newest input. */
function dateOfInput(workspace: Workspace, id: string): string {
  const note = workspace.get(id);
  return String(note?.attributes.date ?? note?.attributes.captured ?? "");
}
