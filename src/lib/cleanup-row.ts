import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanupPlan } from "./cleanup.ts";
import type { Suppression } from "./eligibility.ts";
import { generateItemId } from "./ids.ts";
import type { Note } from "./notes.ts";
import { bodyOf, writeProposal } from "./proposals.ts";
import { PASSAGE_REF } from "./selection.ts";
import { contextFor, loadSuppressions, requireSuppressions, restrictionOf, type Loaded } from "./suppressions.ts";
import type { Workspace } from "./workspace.ts";

// The exclusion cleanup row (capture-and-review §5.2): a review_notes whose items are Remove, Restore and Keep/Remove decisions.

export const CLEANUP_KINDS = ["remove", "restore", "independence"] as const;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/** The restricted passage lines of a note are dropped, whatever else the note says. */
function withoutRestricted(note: Note, lines: ReadonlySet<number>): string {
  return note.body.split(/\r?\n/).filter((_, index) => !lines.has(index)).join("\n").replace(/^\n+|\n+$/g, "");
}

export interface CleanupWritten { result: "WRITTEN" | "PENDING_EXISTS" | "NOTHING_TO_CLEAN"; proposal?: string; path?: string; items?: number }

/** Write the cleanup row of an input: one pending proposal, or the one that is already waiting. */
export function proposeCleanup(workspace: Workspace, input: string, today: string): CleanupWritten {
  const loaded = requireSuppressions(workspace.root);
  const waiting = workspace.notes.find((note) => note.type === "proposal" && note.attributes.status === "pending" && isRecord(note.attributes.cleanup) && note.attributes.cleanup.input === input);
  if (waiting !== undefined) return { result: "PENDING_EXISTS", proposal: waiting.id, path: waiting.path };
  const plan = cleanupPlan(workspace.notes, loaded, input);
  const taken = new Set<string>();
  const fresh = () => { const id = generateItemId(taken); taken.add(id); return id; };
  const items: Array<Record<string, unknown>> = [];
  for (const entry of plan.notes) items.push({ item_id: fresh(), kind: entry.whole ? "independence" : "remove", ref: entry.note });
  const restores = new Set<string>();
  for (const entry of plan.restore) {
    const n = Number(/#¶(\d+):/.exec(entry.passage)?.[1]);
    if (restores.has(`${entry.note}:${n}`)) continue;
    restores.add(`${entry.note}:${n}`);
    items.push({ item_id: fresh(), kind: "restore", ref: entry.note, n });
  }
  for (const entry of plan.documents) if (!items.some((item) => item.kind !== "restore" && item.ref === entry.note)) items.push({ item_id: fresh(), kind: "independence", ref: entry.note });
  if (items.length === 0) return { result: "NOTHING_TO_CLEAN" };
  const source = plan.latest_extract ?? workspace.notes.find((note) => note.type === "source" && (note.attributes.extract_of === input || note.attributes.source_key === `notion:${input}`))?.id;
  if (source === undefined) return { result: "NOTHING_TO_CLEAN" };
  const latest = workspace.get(source);
  const title = `Exclusion cleanup: ${String(latest?.attributes.title ?? input)}: ${items.length} ${items.length === 1 ? "item" : "items"}`;
  const written = writeProposal(workspace, {
    kind: "review_notes", title: title.length > 120 ? `${title.slice(0, 119)}…` : title, notes: [], links: [], items,
    why: "You excluded content from this input. Decide what happens to what already rests on it.", source,
    cleanup: { input, ...(typeof latest?.attributes.extract_version === "number" ? { version: latest.attributes.extract_version } : {}), tasks: plan.tasks },
  }, today);
  return { result: "WRITTEN", proposal: written.id, path: written.path, items: items.length };
}

export interface CleanupItemView { heading: string; current: string; proposed: string; effect: string; target: Note | undefined; base: string; editable: boolean; why: string }

const base = (value: unknown): string => JSON.stringify({ v: value });

/** What the Review page shows for one cleanup item. The restricted text is the user's own, so it is shown here (§5.2). */
export function cleanupItemView(proposal: Note, entry: Record<string, unknown>, workspace: Workspace): CleanupItemView {
  const note = workspace.get(String(entry.ref));
  const cleanup = isRecord(proposal.attributes.cleanup) ? proposal.attributes.cleanup : {};
  const input = String(cleanup.input);
  const title = String(note?.attributes.title ?? entry.ref);
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const restriction = note === undefined ? undefined : restrictionOf(note, context);
  if (entry.kind === "remove") {
    const lines = note === undefined ? [] : note.body.split(/\r?\n/).flatMap((text, index) => (restriction!.lines.has(index) ? [text.trim()] : []));
    return {
      heading: `Changes: ${title}`,
      current: `These lines rest on content you excluded:\n${lines.map((line) => `- ${line}`).join("\n") || "- (only timeline entries or facts)"}`,
      proposed: note === undefined ? "" : withoutRestricted(note, restriction!.lines),
      effect: "Accept removes the excluded lines, timeline entries and facts and marks the note independent of the excluded input. Edit the text to correct it instead.",
      target: note, base: base(note === undefined ? null : sha(note.body)), editable: true, why: "Part of this note rests on content you excluded.",
    };
  }
  if (entry.kind === "restore") {
    const line = note?.body.split(/\r?\n/).find((text) => [...text.matchAll(PASSAGE_REF)].some((ref) => Number(ref[2]) === Number(entry.n)));
    return {
      heading: `Changes: ${title}`,
      current: `A later version of the input holds this paragraph again:\n${(line ?? "").trim()}`,
      proposed: "Restore", effect: "Accept lets this note use the paragraph again. Reject leaves it restricted.",
      target: note, base: base(restoredAlready(workspace, input, String(entry.ref), Number(entry.n))), editable: false, why: "Content you excluded is back in the input.",
    };
  }
  return {
    heading: `Changes: ${title}`,
    current: `Is this note independent of ${input}? It rests on text that cannot be tied to a passage.`,
    proposed: "Remove",
    effect: "Accept applies the word in Proposed: Keep marks the note independent of the excluded input; Remove archives the note.",
    target: note, base: base(note === undefined ? null : { lifecycle: note.attributes.lifecycle, cleared: note.attributes.lineage_cleared ?? [] }), editable: true, why: "This note may rest on content you excluded.",
  };
}

function restoredAlready(workspace: Workspace, input: string, note: string, n: number): boolean {
  return records(workspace, input).restores.some((entry) => entry.items.some((item) => item.note === note && item.n === n));
}

interface FileRecords { text: string; file: { input: string; records: Array<Record<string, unknown>> }; restores: Array<{ items: Array<{ note: string; n: number }> }> }
const recordsPath = (input: string): string => `_suppressions/${input}.json`;

/** The suppression file as the command sees it: staged content first, then the disk. */
function records(workspace: Workspace, input: string): FileRecords {
  const staged = workspace.stagedContent(recordsPath(input));
  let text = staged;
  if (text === undefined) { try { text = readFileSync(join(workspace.root, recordsPath(input)), "utf8"); } catch { text = JSON.stringify({ input, records: [] }); } }
  const file = JSON.parse(text) as FileRecords["file"];
  return { text, file, restores: file.records.filter((record) => record.kind === "restore") as unknown as FileRecords["restores"] };
}

export class CleanupSkip extends Error {
  readonly code: string;
  constructor(code: string, message = code) { super(message); this.code = code; }
}

/** Accept one cleanup item (§5.2). Everything it writes is staged in the workspace, so it is journaled with the rest. */
export function acceptCleanupItem(workspace: Workspace, proposal: Note, entry: Record<string, unknown>, proposed: string, today: string): void {
  const cleanup = isRecord(proposal.attributes.cleanup) ? proposal.attributes.cleanup : {};
  const input = String(cleanup.input);
  const note = workspace.get(String(entry.ref));
  if (note === undefined) throw new CleanupSkip("UNKNOWN_ID", `No note ${String(entry.ref)}`);
  const word = proposed.trim().toLowerCase();
  if (entry.kind === "restore") {
    if (word !== "restore") throw new CleanupSkip("UNREADABLE_PROPOSED", "a Restore item takes the word Restore");
    const file = records(workspace, input).file;
    const version = typeof cleanup.version === "number" ? cleanup.version : Number((file.records.filter((record) => record.kind !== "restore").at(-1) ?? {}).version ?? 1);
    if (!restoredAlready(workspace, input, note.id, Number(entry.n))) {
      const open = file.records.find((record) => record.kind === "restore" && record.extract_version === version);
      const item = { note: note.id, n: Number(entry.n) };
      if (open !== undefined) (open.items as unknown[]).push(item);
      else file.records.push({ kind: "restore", extract_version: version, items: [item], written: `${today}T00:00:00Z` });
      workspace.writeText(recordsPath(input), `${JSON.stringify(file, null, 2)}\n`);
    }
    return;
  }
  const document = workspace.edit(note);
  const cleared = (list: unknown): string[] => (Array.isArray(list) ? list.filter((value): value is string => typeof value === "string") : []);
  if (entry.kind === "independence") {
    if (word === "keep") document.attributes.lineage_cleared = [...new Set([...cleared(document.attributes.lineage_cleared), input])];
    else if (word === "remove") { if (document.attributes.lifecycle !== "archived") document.attributes.lifecycle = "archived"; }
    else throw new CleanupSkip("UNREADABLE_PROPOSED", "this item takes the word Keep or Remove");
    document.attributes.updated = today;
    workspace.save(note.path, document);
    return;
  }
  // Remove: the text applied is exactly what the Review page held. It may not keep any statement that rests on excluded content.
  const before = restrictionOf(note, contextFor(workspace.notes, requireSuppressions(workspace.root)));
  const timeline = Array.isArray(document.attributes.timeline) ? (document.attributes.timeline as unknown[]).filter((_, index) => !before.timeline.has(index)) : undefined;
  if (timeline !== undefined) document.attributes.timeline = timeline;
  if (isRecord(document.attributes.facts)) document.attributes.facts = Object.fromEntries(Object.entries(document.attributes.facts).filter(([key]) => !before.facts.has(key)));
  document.body = bodyOf(proposed);
  document.attributes.updated = today;
  workspace.save(note.path, document);
  const after = restrictionOf(workspace.get(note.id)!, contextFor(workspace.notes, requireSuppressions(workspace.root)));
  if (after.lines.size > 0 || after.timeline.size > 0 || after.facts.size > 0) throw new CleanupSkip("STILL_RESTRICTED", "the text still holds statements that rest on excluded content");
  const again = workspace.edit(workspace.get(note.id)!);
  again.attributes.lineage_cleared = [...new Set([...cleared(again.attributes.lineage_cleared), input])];
  workspace.save(note.path, again);
}

/** After a cleanup item was applied: when no note is restricted by the input any more, its active records become `reconciled` (§5.3). */
export function reconcile(workspace: Workspace, input: string, now: string): boolean {
  const { file } = records(workspace, input);
  const active = file.records.filter((record) => record.kind !== "restore" && record.status === "active");
  if (active.length === 0) return false;
  const loaded: Loaded = { suppressions: [], restores: [], problems: [] };
  const all = loadSuppressions(workspace.root);
  const mine = file.records.filter((record) => record.kind !== "restore").map((record) => ({ ...record, input, status: "active" }) as unknown as Suppression);
  // Only this input's records count: a note restricted by another input's suppression is that input's cleanup, not this one's (§5.3).
  loaded.suppressions = mine;
  loaded.restores = [...all.restores.filter((entry) => entry.input !== input), ...file.records.filter((record) => record.kind === "restore").map((record) => ({ input, extract_version: record.extract_version as number, items: record.items as Array<{ note: string; n: number }> }))];
  const context = contextFor(workspace.notes, loaded);
  const open = workspace.notes.some((note) => {
    if (note.type === "source" || note.type === "proposal" || note.type === "view" || note.attributes.lifecycle === "archived") return false; // a removed note is resolved
    const restriction = restrictionOf(note, context);
    return restriction.whole || restriction.lines.size > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0;
  });
  if (open) return false;
  for (const record of active) { record.status = "reconciled"; record.reconciled_at = now; }
  workspace.writeText(recordsPath(input), `${JSON.stringify(file, null, 2)}\n`);
  return true;
}
