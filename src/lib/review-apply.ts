import { isDeepStrictEqual } from "node:util";

import { applyKind } from "./apply.ts";
import { acceptCleanupItem, CLEANUP_KINDS, CleanupSkip, reconcile } from "./cleanup-row.ts";
import { isRecord } from "./input.ts";
import type { LogEntry } from "./log.ts";
import type { Note } from "./notes.ts";
import { bodyOf, reviewTitle, writeProposal } from "./proposals.ts";
import { reviewItems, textSha } from "./review-body.ts";
import type { ReviewDecision } from "./review-plan.ts";
import { formatDate } from "./time.ts";
import type { Workspace } from "./workspace.ts";

// Applying Review decisions item by item (capture-and-review §7.5 to §7.7): each item is atomic, nothing else is touched.

export interface ReviewItemResult {
  proposal: string; item_id: string; decision: string; result: "applied" | "closed" | "deferred" | "skipped" | "failed"; reason?: string; message?: string; deferred_to?: string;
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

class Skip extends Error {
  readonly code: string;
  constructor(code: string, message = code) { super(message); this.code = code; }
}

/** The value of an edited fact keeps the type of the source's value when it can (a number stays a number). */
function typed(proposed: string, original: unknown): unknown {
  // Only a canonical number stays a number: `1e3`, `0x1F` and `0123` are text the user typed and are kept as typed.
  return typeof original === "number" && Number.isFinite(Number(proposed)) && String(Number(proposed)) === proposed ? Number(proposed) : proposed;
}

/** A link item names one value: a note id, or the exact title of one note (an edited link cannot be guessed). */
function linkValue(workspace: Workspace, proposed: string, original: unknown): unknown {
  const text = proposed.trim();
  if (text === "" || text.includes("\n")) throw new Skip("LINK_VALUE_UNKNOWN", "a link item takes one value");
  const byId = workspace.get(text);
  if (byId !== undefined) return byId.id;
  const titled = workspace.notes.filter((note) => note.attributes.title === text);
  if (titled.length === 1) return titled[0]!.id;
  if (titled.length === 0 && typeof original === "string" && workspace.get(original) === undefined && text === original) return original;
  throw new Skip("LINK_VALUE_UNKNOWN", `${JSON.stringify(text)} names no single note`);
}

export function applyReviewDecisions(workspace: Workspace, decisions: ReviewDecision[], now: Date): { results: ReviewItemResult[]; log: LogEntry[] } {
  const today = formatDate(now);
  const results: ReviewItemResult[] = [];
  const log: LogEntry[] = [];
  for (const decision of decisions) {
    const deferred: string[] = [];
    // What each item's target held when the submission began: two accepted items on one note must not make the second see the first's write as a base change.
    const proposalNote = workspace.get(decision.proposal);
    const bases = new Map<string, { current_base_hash: string; held: boolean; source_excluded: boolean }>();
    if (proposalNote?.type === "proposal" && Array.isArray(proposalNote.attributes.items)) for (const view of reviewItems(proposalNote, workspace)) bases.set(view.item_id, { current_base_hash: view.current_base_hash, held: view.held, source_excluded: view.source_excluded });
    for (const item of decision.items) {
      const checkpoint = workspace.checkpoint();
      const out: ReviewItemResult = { proposal: decision.proposal, item_id: item.item_id, decision: item.decision, result: "failed" };
      try {
        const state = applyItem(workspace, decision, item, today, bases);
        out.result = state === "deferred" ? "deferred" : state === "closed" ? "closed" : "applied";
        if (state === "closed" && item.decision !== "reject") out.reason = "source_excluded";
        if (state === "deferred") deferred.push(item.item_id);
        const errors = workspace.newErrors();
        if (errors.length > 0) throw new Error(`INVALID_RESULT: ${errors.map((issue) => `${issue.rule} ${issue.message}`).join("; ")}`);
        log.push({ op: "apply", id: decision.proposal, title: String(workspace.get(decision.proposal)?.attributes.title ?? decision.proposal), pairs: [["item", item.item_id], ["result", out.result]] });
      } catch (error) {
        workspace.restore(checkpoint);
        out.result = error instanceof Skip ? "skipped" : "failed";
        out.reason = error instanceof Skip ? error.code : "INVALID_RESULT";
        out.message = error instanceof Error ? error.message : String(error);
        const index = deferred.indexOf(item.item_id);
        if (index >= 0) deferred.splice(index, 1);
      }
      results.push(out);
    }
    // A cleanup row whose items left no note restricted marks its suppression records reconciled, in the same unit (§5.3).
    const cleanupInput = record(workspace.get(decision.proposal)?.attributes.cleanup).input;
    if (typeof cleanupInput === "string" && results.some((entry) => entry.proposal === decision.proposal && entry.result === "applied")) {
      const checkpoint = workspace.checkpoint();
      try { reconcile(workspace, cleanupInput, `${today}T00:00:00Z`); } catch { workspace.restore(checkpoint); }
    }
    // The deferred items of this submission move together to one new pending proposal, each under the id it had (§7.6).
    if (deferred.length > 0) {
      // Creating the new proposal and recording the deferred items are one unit: if it fails, the items are still pending in the original.
      const checkpoint = workspace.checkpoint();
      try {
        const moved = deferItems(workspace, decision.proposal, deferred, today);
        for (const itemId of deferred) {
          const planned = decision.items.find((candidate) => candidate.item_id === itemId)!;
          record_(workspace, decision.proposal, { item_id: itemId, decision: "defer", decided_at: decision.decided_at, decided_by: "notion", proposed_hash: planned.proposed_hash, base_hash: planned.base_hash, snapshot_hash: planned.snapshot_hash, state: "deferred", deferred_to: moved }, decision, today);
        }
        const errors = workspace.newErrors();
        if (errors.length > 0) throw new Error("INVALID_RESULT");
        for (const entry of results) if (entry.proposal === decision.proposal && deferred.includes(entry.item_id)) entry.deferred_to = moved;
      } catch {
        workspace.restore(checkpoint);
        for (const entry of results) if (entry.proposal === decision.proposal && deferred.includes(entry.item_id)) { entry.result = "failed"; entry.reason = "DEFER_FAILED"; delete entry.deferred_to; }
      }
    }
  }
  return { results, log };
}

function applyItem(workspace: Workspace, decision: ReviewDecision, planned: ReviewDecision["items"][number], today: string, bases: ReadonlyMap<string, { current_base_hash: string; held: boolean; source_excluded: boolean }>): "applied" | "closed" | "deferred" {
  const proposal = workspace.get(decision.proposal);
  if (proposal === undefined || proposal.type !== "proposal") throw new Skip("UNKNOWN_ID", `No proposal ${decision.proposal}`);
  const a = proposal.attributes;
  if (a.kind !== "review_notes" || !Array.isArray(a.items)) throw new Skip("NOT_A_REVIEW_WITH_ITEMS");
  if (["applied", "closed"].includes(String(a.status))) throw new Skip("ALREADY_TERMINAL");
  const entry = list(a.items).map(record).find((candidate) => candidate.item_id === planned.item_id);
  if (entry === undefined) throw new Skip("UNKNOWN_ITEM");
  if (list(a.item_decisions).map(record).some((done) => done.item_id === planned.item_id)) throw new Skip("ALREADY_DECIDED"); // applying again is a no-op

  // The skill re-read the page just before applying: the section and the wording must be the ones planned.
  if (planned.verified === undefined || planned.verified === null) throw new Skip("UNVERIFIED");
  if (planned.verified.snapshot_hash !== planned.snapshot_hash || planned.verified.proposed_hash !== planned.proposed_hash) throw new Skip("CHANGED_SINCE_PLAN");
  const view = bases.get(planned.item_id);
  if (view === undefined) throw new Skip("UNKNOWN_ITEM");
  const today_ = today;
  // Checked before apply, even for an Accept: an item resting only on excluded evidence is closed stale and nothing is applied (§5.1).
  if (planned.decision === "stale" || (planned.decision === "accept" && view.source_excluded)) {
    if (!view.source_excluded) throw new Skip("NOT_EXCLUDED", "the item no longer rests on excluded evidence");
    rejectItem(workspace, proposal, entry, today_);
    record_(workspace, proposal.id, {
      item_id: planned.item_id, decision: "reject", decided_at: decision.decided_at, decided_by: "notion",
      proposed_hash: planned.proposed_hash, base_hash: planned.base_hash, snapshot_hash: planned.snapshot_hash, state: "closed", reason: "source_excluded",
    }, decision, today_);
    return "closed";
  }
  if (planned.decision === "accept") {
    if (view.held) throw new Skip("HELD_SOURCE_EXCLUDED");
    const stored = record(record(record(a.notion_published)["@review"]).items)[planned.item_id] as { base_hash?: string } | undefined;
    if (stored?.base_hash === undefined) throw new Skip("NO_BASELINE");
    // What the item was proposed against, what it was when planned, and what it is now must be one and the same.
    if (stored.base_hash !== view.current_base_hash || planned.base_hash !== view.current_base_hash) throw new Skip("BASE_CHANGED");
    if (planned.proposed === null || planned.proposed.trim() === "") throw new Skip("UNREADABLE_PROPOSED");
    // The wording is bound to its hashes: what is applied is exactly the text that was hashed, planned and verified, never a text that merely travels with them.
    if (textSha(planned.proposed) !== planned.proposed_hash) throw new Skip("WORDING_NOT_BOUND");
    const rendered = record(record(record(a.notion_published)["@review"]).items)[planned.item_id] as { proposed_hash?: string } | undefined;
    // Whether the user edited it is read from the hashes, not taken from the plan.
    acceptItem(workspace, proposal, entry, { ...planned, edited: rendered?.proposed_hash !== undefined && rendered.proposed_hash !== planned.proposed_hash }, today_);
  } else if (planned.decision === "reject") {
    rejectItem(workspace, proposal, entry, today_);
  }
  const state = planned.decision === "accept" ? "applied" : planned.decision === "reject" ? "closed" : "deferred";
  if (state === "deferred") return state; // recorded with the new proposal it moves to, in one unit (see applyReviewDecisions)
  record_(workspace, proposal.id, {
    item_id: planned.item_id, decision: planned.decision, decided_at: decision.decided_at, decided_by: "notion",
    proposed_hash: planned.proposed_hash, base_hash: planned.base_hash, snapshot_hash: planned.snapshot_hash, state, ...(planned.decision === "accept" && planned.edited ? { edited: true } : {}),
  }, decision, today_);
  return state;
}

function acceptItem(workspace: Workspace, proposal: Note, entry: Record<string, unknown>, planned: ReviewDecision["items"][number], today: string): void {
  const a = proposal.attributes;
  const proposed = planned.proposed!;
  if (CLEANUP_KINDS.includes(entry.kind as never)) {
    try { acceptCleanupItem(workspace, proposal, entry, proposed, today); } catch (error) { if (error instanceof CleanupSkip) throw new Skip(error.code, error.message); throw error; }
    return;
  }
  if (entry.kind === "note") {
    const note = workspace.get(String(entry.ref));
    if (note === undefined) throw new Skip("UNKNOWN_ID", `No note ${String(entry.ref)}`);
    // Only a draft can be accepted: one that is already reviewed is simply recorded, any other state (archived, disputed) is not for this item to change.
    if (note.attributes.lifecycle === "reviewed") return;
    if (note.attributes.lifecycle !== "draft") throw new Skip("NOT_A_DRAFT", `${note.id} is ${String(note.attributes.lifecycle)}, not a draft`);
    const document = workspace.edit(note);
    if (planned.edited) document.body = bodyOf(proposed);
    document.attributes.lifecycle = "reviewed";
    document.attributes.updated = today;
    workspace.save(note.path, document);
    return;
  }
  if (entry.kind === "link") {
    const link = record(list(a.links)[Number(entry.ref)]);
    const target = workspace.get(String(link.target));
    if (target === undefined) throw new Skip("UNKNOWN_ID", `No note ${String(link.target)}`);
    const value = planned.edited ? linkValue(workspace, proposed, link.value) : link.value;
    const document = workspace.edit(target);
    const values = list(document.attributes[String(link.field)]);
    if (!values.some((existing) => isDeepStrictEqual(existing, value))) document.attributes[String(link.field)] = [...values, value];
    document.attributes.updated = today;
    workspace.save(target.path, document);
    return;
  }
  const change = record(list(a.changes)[Number(entry.ref)]);
  const edited = planned.edited;
  const value = !edited ? undefined : change.kind === "update_fact" ? typed(proposed, change.after) : proposed;
  const stale = applyKind(workspace, { ...change, source: a.source }, "", value, today, today, [], proposal.id);
  if (stale !== null) throw new Skip("STALE_PROPOSAL", stale);
}

function rejectItem(workspace: Workspace, _proposal: Note, entry: Record<string, unknown>, today: string): void {
  if (entry.kind !== "note") return; // a link or a change simply is not applied
  const note = workspace.get(String(entry.ref));
  if (note === undefined || note.attributes.lifecycle !== "draft") return;
  const document = workspace.edit(note);
  document.attributes.lifecycle = "archived";
  document.attributes.updated = today;
  workspace.save(note.path, document);
}

/** Record one item decision in the proposal file, and close the proposal when no item is pending (§7.6). */
function record_(workspace: Workspace, id: string, entry: Record<string, unknown>, decision: ReviewDecision, today: string): void {
  const proposal = workspace.get(id)!;
  const document = workspace.edit(proposal);
  const decisions = [...list(document.attributes.item_decisions), entry];
  document.attributes.item_decisions = decisions;
  document.attributes.updated = today;
  const items = list(document.attributes.items).map(record);
  const pending = items.filter((item) => !decisions.map(record).some((done) => done.item_id === item.item_id));
  if (pending.length === 0) {
    const applied = decisions.map(record).some((done) => done.state === "applied");
    document.attributes.status = applied ? "applied" : "closed";
    document.attributes.decision = { action: applied ? "approve" : "reject", decided_at: decision.decided_at, decided_by: "notion" };
  }
  workspace.save(proposal.path, document);
}

/** The deferred items of a proposal, written as one new pending proposal under their own ids (the references re-indexed). */
function deferItems(workspace: Workspace, id: string, itemIds: string[], today: string): string {
  const proposal = workspace.get(id)!;
  const p = proposal.attributes;
  const moved = list(p.items).map(record).filter((item) => itemIds.includes(String(item.item_id)));
  const pick = (kind: string) => moved.filter((item) => item.kind === kind);
  const changeRefs = pick("change").map((item) => Number(item.ref));
  const linkRefs = pick("link").map((item) => Number(item.ref));
  const notes = pick("note").map((item) => String(item.ref));
  const changes = changeRefs.map((ref) => list(p.changes)[ref]);
  const links = linkRefs.map((ref) => list(p.links)[ref]);
  const source = String(p.source);
  const fields = {
    kind: "review_notes",
    title: reviewTitle(workspace, source, changes.length, notes.length, links.length, "Deferred from"),
    notes, links, ...(changes.length === 0 ? {} : { changes }),
    items: [
      ...changeRefs.map((ref, index) => ({ item_id: String(pick("change").find((item) => Number(item.ref) === ref)!.item_id), kind: "change", ref: index })),
      ...notes.map((note) => ({ item_id: String(pick("note").find((item) => item.ref === note)!.item_id), kind: "note", ref: note })),
      ...linkRefs.map((ref, index) => ({ item_id: String(pick("link").find((item) => Number(item.ref) === ref)!.item_id), kind: "link", ref: index })),
    ],
    deferred_from: id, why: p.why, source,
  };
  const created = writeProposal(workspace, fields, today).id;
  const document = workspace.edit(workspace.get(id)!);
  document.attributes.item_decisions = list(document.attributes.item_decisions).map(record).map((done) => (itemIds.includes(String(done.item_id)) ? { ...done, deferred_to: created } : done));
  workspace.save(proposal.path, document);
  return created;
}
