import { isDeepStrictEqual } from "node:util";

import { isRecord } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { writeProposal } from "./proposals.ts";
import { citeLabel, contextFor, publishableNote, requireSuppressions, titleWithheld } from "./suppressions.ts";
import type { Context } from "./eligibility.ts";
import { formatDate } from "./time.ts";
import type { LogEntry } from "./log.ts";
import type { Workspace } from "./workspace.ts";

/**
 * Your Notion edits to brain-owned values wait for your yes (0.16.0, decision 0101 §4; cli §5.14.2, §5.14.3, §5.7). `sync plan` finds an
 * edit by the three-way comparison and lists it in `corrections`; `sync apply` writes it as a pending `notion_correction`, never applying it;
 * the session decides it and `brain apply` applies it as 0027 says and sets the published value S.
 */

/** A `corrections` item of a sync plan (cli §5.14.2): `value` is N in the brain's form, `notion_value` N as Notion shows it. */
export interface PlannedCorrection {
  target: string;
  field: string;
  value: unknown;
  before?: unknown;
  observed_at: string;
  database: string;
  page_id: string;
  property: string;
  notion_value: unknown;
  /** The pending notion_correction this edit updates (you edited the value again). */
  proposal?: string;
}

/** A `withdrawn` item: a pending correction or tracked task that Notion no longer shows (cli §5.14.2). */
export interface Withdrawn {
  proposal: string;
  reason: "SET_BACK" | "BRAIN_CHANGED" | "TASK_REOPENED" | "NOT_TRACKED";
}

export const KEY_FACTS = "Key Facts";

/** Notion's Key Facts text as `{key: value}` (cli §5.14.4): `Label: value` segments joined by ` · `. */
export function parseKeyFacts(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value === "") return {};
  const result: Record<string, unknown> = {};
  for (const segment of value.split(" · ")) { const separator = segment.indexOf(": "); if (separator > 0) result[segment.slice(0, separator).toLowerCase().replaceAll(" ", "_")] = segment.slice(separator + 2); }
  return result;
}

/** `{key: value}` as Notion's Key Facts text (cli §5.14.4's rule): keys sorted, each `Label: value`, joined by ` · `; empty → null. */
export function keyFactsTextOf(facts: Record<string, unknown>): string | null {
  const keys = Object.keys(facts).sort(compareCodePoints);
  return keys.length === 0 ? null : keys.map((key) => `${key[0]!.toUpperCase()}${key.slice(1).replaceAll("_", " ")}: ${String(facts[key])}`).join(" · ");
}

/** The pending notion_correction proposals, by `<target>\0<field>` (the first by created, then id, when there are several). */
export function pendingCorrections(workspace: Workspace): Map<string, Note> {
  const found = new Map<string, Note>();
  const pending = workspace.notes.filter((note) => note.type === "proposal" && note.attributes.kind === "notion_correction" && note.attributes.status === "pending")
    .sort((a, b) => compareCodePoints(String(a.attributes.created), String(b.attributes.created)) || compareCodePoints(a.id, b.id));
  for (const note of pending) { const key = `${String(note.attributes.target)}\u0000${String(note.attributes.field)}`; if (!found.has(key)) found.set(key, note); }
  return found;
}

/**
 * One correctable property of one row, after the three-way comparison (cli §5.14.2, "Your corrections wait for your yes"). `edit` is the
 * correction when only Notion changed; otherwise `state` says why a waiting one is withdrawn (`SET_BACK`, `BRAIN_CHANGED`) or that there is
 * nothing to say (`none`). Pushes the plan items.
 */
export function planCorrection(out: { corrections: PlannedCorrection[]; withdrawn: Withdrawn[] }, waiting: Note | undefined, outcome: { edit: PlannedCorrection } | { state: "SET_BACK" | "BRAIN_CHANGED" | "none" }): void {
  if ("edit" in outcome) {
    if (waiting === undefined) { out.corrections.push(outcome.edit); return; }
    if (isDeepStrictEqual(waiting.attributes.after ?? null, outcome.edit.value ?? null)) return;
    out.corrections.push({ ...outcome.edit, proposal: waiting.id });
    return;
  }
  if (outcome.state !== "none" && waiting !== undefined) out.withdrawn.push({ proposal: waiting.id, reason: outcome.state });
}

/** The brain's current value of a correction field (`facts.<key>` or a field), `undefined` when it has none. */
export function brainFieldValue(note: Note, field: string): unknown {
  if (field.startsWith("facts.")) return isRecord(note.attributes.facts) ? note.attributes.facts[field.slice(6)] : undefined;
  return note.attributes[field];
}

/** How sync names a note in a title (cli §5.14.3, §5.14.4): its title, or its cite in the awaiting-cleanup form (§5.13). */
export function namedTitle(note: Note, context: Context): string {
  const form = publishableNote(note, context);
  return titleWithheld(form) ? citeLabel(form) : String(form.attributes.title ?? note.id);
}

/** A correction's value as its title shows it (cli §5.14.3): text and numbers as they are, a reference by its title, null as `empty`. */
export function renderedValue(workspace: Workspace, value: unknown, context: Context): string {
  if (value === null || value === undefined) return "empty";
  if (Array.isArray(value)) return value.length === 0 ? "empty" : value.map((item) => renderedValue(workspace, item, context)).join(", ");
  if (typeof value === "string") { const note = /^[a-z]{2,4}-[0-9a-z]{8}$/.test(value) ? workspace.get(value) : undefined; return note === undefined ? value : namedTitle(note, context); }
  return String(value);
}

const cut = (title: string): string => title.length > 120 ? `${title.slice(0, 119)}…` : title;

export interface WaitingResults {
  corrections: Array<Record<string, unknown>>;
  withdrawn: Array<Record<string, unknown>>;
  log: LogEntry[];
}

/**
 * Step 3 of `sync apply` for corrections and withdrawals (cli §5.14.3): each correction written as a pending `notion_correction`, or the
 * pending one it names updated; each withdrawn proposal closed `withdrawn`. Nothing of a target changes. Each item is atomic.
 */
export function writeCorrections(workspace: Workspace, corrections: readonly PlannedCorrection[], withdrawn: readonly Withdrawn[], now: Date): WaitingResults {
  const today = formatDate(now);
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const out: WaitingResults = { corrections: [], withdrawn: [], log: [] };
  for (const item of corrections) {
    const head = { target: item.target, field: item.field };
    const target = workspace.get(item.target);
    if (target === undefined) { out.corrections.push({ ...head, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; }
    const title = cut(`${namedTitle(target, context)}: ${item.property} → ${renderedValue(workspace, item.value, context)}`);
    const fields = { after: item.value ?? null, notion_value: item.notion_value ?? null, observed_at: item.observed_at, title };
    const written = atomically(workspace, () => {
      if (item.proposal !== undefined) return updatePending(workspace, item.proposal, fields, today);
      const { id } = writeProposal(workspace, {
        kind: "notion_correction", title, target: item.target, field: item.field, ...(item.before === undefined ? {} : { before: item.before }), after: item.value ?? null,
        database: item.database, page: item.page_id, property: item.property, notion_value: item.notion_value ?? null, observed_at: item.observed_at,
        why: `${item.property} edited in Notion`, source: `notion:${item.page_id}`,
      }, today);
      return { result: "written", proposal: id };
    });
    out.corrections.push({ ...head, ...written });
    if (written.result === "written" || written.result === "updated") out.log.push({ op: "proposal-new", id: String(written.proposal), title, pairs: [["kind", "notion_correction"], ["target", item.target]] });
  }
  for (const item of withdrawn) out.withdrawn.push(withdraw(workspace, item, today, out.log));
  return out;
}

/** Close a pending proposal `withdrawn`, with no decision (cli §5.14.3); one no longer pending is left as it is. */
export function withdraw(workspace: Workspace, item: Withdrawn, today: string, log: LogEntry[]): Record<string, unknown> {
  const head = { proposal: item.proposal, reason: item.reason };
  const proposal = workspace.get(item.proposal);
  if (proposal === undefined || proposal.type !== "proposal") return { ...head, result: "failed", reason: "UNKNOWN_ID", changed: [] };
  const result = atomically(workspace, () => {
    if (proposal.attributes.status !== "pending") return { result: "skipped", reason: "NOT_PENDING" };
    const document = workspace.edit(proposal);
    document.attributes.status = "closed";
    document.attributes.closed_reason = "withdrawn";
    document.attributes.updated = today;
    workspace.save(proposal.path, document);
    return { result: "withdrawn", proposal: proposal.id };
  });
  if (result.result === "withdrawn") log.push({ op: "apply", id: proposal.id, title: String(proposal.attributes.title), pairs: [["result", "closed"]] });
  return { ...head, ...result };
}

/** Update a pending proposal's fields in place (result `updated`); one no longer pending is `skipped`, `NOT_PENDING`. */
export function updatePending(workspace: Workspace, id: string, fields: Record<string, unknown>, today: string): Record<string, unknown> {
  const proposal = workspace.get(id);
  if (proposal === undefined || proposal.type !== "proposal") return { result: "failed", reason: "UNKNOWN_ID" };
  if (proposal.attributes.status !== "pending") return { result: "skipped", reason: "NOT_PENDING" };
  const document = workspace.edit(proposal);
  Object.assign(document.attributes, fields, { updated: today });
  workspace.save(proposal.path, document);
  return { result: "updated", proposal: id };
}

/** Run one item: on a failure or a result that adds lint errors, restore the workspace and report `failed`. */
export function atomically(workspace: Workspace, run: () => Record<string, unknown>): Record<string, unknown> {
  const checkpoint = workspace.checkpoint();
  try {
    const outcome = run();
    if (outcome.result === "failed" || outcome.result === "skipped") { workspace.restore(checkpoint); return { ...outcome, changed: [] }; }
    const errors = workspace.newErrors();
    if (errors.length > 0) { workspace.restore(checkpoint); return { result: "failed", reason: "INVALID_RESULT", message: errors.map((issue) => `${issue.path}: ${issue.rule}: ${issue.message}`).join("; "), changed: [] }; }
    return { ...outcome, changed: workspace.changedSince(checkpoint) };
  } catch (error) {
    workspace.restore(checkpoint);
    return { result: "failed", reason: "INVALID_RESULT", message: error instanceof Error ? error.message : String(error), changed: [] };
  }
}

/**
 * The properties `sync render` holds back for a pending correction (cli §5.14.4): each pending notion_correction's `property` on its note,
 * and Key Facts whole while any of its keys has one.
 */
export function heldByCorrections(workspace: Workspace): Map<string, Set<string>> {
  const held = new Map<string, Set<string>>();
  for (const note of workspace.notes) {
    if (note.type !== "proposal" || note.attributes.kind !== "notion_correction" || note.attributes.status !== "pending") continue;
    const target = String(note.attributes.target); const property = String(note.attributes.property);
    const set = held.get(target) ?? new Set<string>();
    set.add(property.startsWith(`${KEY_FACTS}/`) ? KEY_FACTS : property);
    held.set(target, set);
  }
  return held;
}

/**
 * S follows the decision on a notion_correction (cli §5.7): the target's `notion_published[property]` = `notion_value`; for
 * `Key Facts/<key>`, only that key of S's Key Facts text changes.
 */
export function settlePublished(attributes: Record<string, unknown>, property: string, notionValue: unknown): void {
  const published = isRecord(attributes.notion_published) ? { ...attributes.notion_published } : {};
  if (property.startsWith(`${KEY_FACTS}/`)) {
    const key = property.slice(KEY_FACTS.length + 1);
    const facts = parseKeyFacts(published[KEY_FACTS]);
    if (notionValue === null || notionValue === undefined) delete facts[key]; else facts[key] = notionValue;
    published[KEY_FACTS] = keyFactsTextOf(facts);
  } else {
    published[property] = notionValue ?? null;
  }
  attributes.notion_published = published;
}
