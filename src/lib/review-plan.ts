import { isRecord, unknownKeys, type InputProblem } from "./input.ts";
import type { Note } from "./notes.ts";
import { parseReviewPage, reviewItems, sectionHash, textSha, type Token } from "./review-body.ts";
import { normalizeTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";

// Planning a Review row of the new layout (capture-and-review §7.3, §7.9, §7.10): deterministic, reads only the snapshot.

/** What the skill reads off a Review page: the three properties of the Submit buttons, the page's edit time and its body as Markdown. */
export interface ReviewPage { decided: boolean; decided_at: string | null; accept_all: boolean; page_edited_at: string; body_markdown: string | null }

export interface ItemDecision {
  item_id: string; decision: "accept" | "reject" | "defer";
  /** The exact final wording to apply: the Proposed toggle as read (null for a rejection or deferral). */
  proposed: string | null; proposed_hash: string; rendered_proposed_hash: string | null; base_hash: string; snapshot_hash: string; edited: boolean;
}
export interface ReviewDecision { proposal: string; page_id: string; decided_at: string; decided_by: "notion"; page_edited_at: string; unattended_ok: boolean; accept_all: boolean; items: ItemDecision[] }
export interface ReviewHeld { proposal: string; page_id: string; item_id: string | null; reason: string }
export interface ReviewRevision { proposal: string; page_id: string; item_id: string; instruction: string | null }

export interface ReviewPlanOut {
  review_decisions: ReviewDecision[]; review_held: ReviewHeld[]; review_revisions: ReviewRevision[]; review_pending: Array<{ proposal: string; page_id: string }>;
}

export function parseReviewPageInput(value: unknown, pointer: string, problems: InputProblem[]): ReviewPage | undefined {
  if (!isRecord(value)) { problems.push({ pointer, message: "must be an object" }); return undefined; }
  problems.push(...unknownKeys(value, ["decided", "decided_at", "accept_all", "page_edited_at", "body_markdown"], pointer));
  for (const key of ["decided", "accept_all"]) if (typeof value[key] !== "boolean") problems.push({ pointer: `${pointer}/${key}`, message: "must be true or false" });
  const decidedAt = value.decided_at === null ? null : normalizeTimestamp(value.decided_at);
  if (decidedAt === undefined) problems.push({ pointer: `${pointer}/decided_at`, message: "must be an ISO 8601 UTC timestamp or null" });
  const editedAt = normalizeTimestamp(value.page_edited_at);
  if (editedAt === undefined) problems.push({ pointer: `${pointer}/page_edited_at`, message: "must be an ISO 8601 UTC timestamp" });
  if (value.body_markdown !== null && typeof value.body_markdown !== "string") problems.push({ pointer: `${pointer}/body_markdown`, message: "must be a string or null" });
  if (problems.some((problem) => problem.pointer.startsWith(pointer))) return undefined;
  return { decided: value.decided as boolean, decided_at: decidedAt as string | null, accept_all: value.accept_all as boolean, page_edited_at: editedAt!, body_markdown: value.body_markdown as string | null };
}

const minute = (iso: string): number => Math.floor(Date.parse(iso) / 60000);

/**
 * One Review row of the new layout. Nothing is read until Decided is ticked (§7.3); a row-level Approve or Reject is the shortcut of §7.9.
 * `legacy` receives a row-level call for the old path (`out.decisions`); `conflict` records a conflict on the row.
 */
export function planReviewRow(
  workspace: Workspace, row: { page_id: string; last_edited: string; properties: Record<string, unknown> }, review: ReviewPage | undefined, proposal: Note, asOf: string,
  out: ReviewPlanOut, legacy: (action: "approve" | "reject") => void, conflict: (code: string, message: string) => void,
): void {
  const id = proposal.id;
  const published = (() => { const p = proposal.attributes.notion_published; const r = isRecord(p) && isRecord(p["@review"]) ? p["@review"] : undefined; return isRecord(r) && isRecord(r.items) ? r.items : {}; })() as Record<string, { rendered_hash?: string; proposed_hash?: string; base_hash?: string; held?: boolean }>;
  const current = new Map(reviewItems(proposal, workspace).map((item) => [item.item_id, item]));
  const sections = review?.body_markdown == null ? undefined : parseReviewPage(review.body_markdown);
  const hold = (item: string | null, reason: string) => out.review_held.push({ proposal: id, page_id: row.page_id, item_id: item, reason });

  // What is waiting in Notion and must not be overwritten (§7.10): an edited Proposed, a decision token, or a requested revision.
  const itemStates = Array.isArray(proposal.attributes.items) ? (proposal.attributes.items as Array<{ item_id: string }>) : [];
  let pending = false;
  if (sections !== undefined) {
    for (const entry of itemStates) {
      const section = sections.get(entry.item_id);
      if (section === undefined) continue;
      const edited = section.proposed !== null && published[entry.item_id]?.proposed_hash !== undefined && textSha(section.proposed) !== published[entry.item_id]!.proposed_hash;
      if (edited || (section.decision !== null && section.decision !== "pending") || section.decision === null || section.revision_request !== null) pending = true;
    }
  }
  if (pending || review?.decided === true) out.review_pending.push({ proposal: id, page_id: row.page_id });

  const call = String(row.properties["Your call"] ?? "").toLowerCase();
  if (review === undefined || !review.decided) {
    // No Submit: only the row-level shortcut is read, with each item's stored proposal text; it is refused when any Proposed was edited.
    if (call === "") return;
    if (call === "fix" || call === "request revision") { conflict("ROW_REVISION_NOT_SUPPORTED", "Fix and Request revision are not read on a row of the new layout: use Request revision on an item"); return; }
    if (call !== "approve" && call !== "reject") return;
    const edited = sections !== undefined && itemStates.some((entry) => { const s = sections.get(entry.item_id); return s?.proposed != null && published[entry.item_id]?.proposed_hash !== undefined && textSha(s.proposed) !== published[entry.item_id]!.proposed_hash; });
    if (edited) { conflict("EDITED_PROPOSED_NEEDS_SUBMIT", "A Proposed was edited: use Submit decisions instead of Approve or Reject"); return; }
    legacy(call);
    return;
  }

  // Submitted. The decision binds to Decided at; an edit in a later minute invalidates the row's unapplied decisions (the user submits again).
  if (review.decided_at === null) { hold(null, "DECIDED_WITHOUT_TIME"); return; }
  if (review.body_markdown === null || sections === undefined) { hold(null, "BODY_UNREADABLE"); return; }
  if (minute(review.page_edited_at) > minute(review.decided_at)) { hold(null, "EDITED_AFTER_DECIDED"); return; }

  const decision: ReviewDecision = { proposal: id, page_id: row.page_id, decided_at: review.decided_at, decided_by: "notion", page_edited_at: review.page_edited_at, unattended_ok: Date.parse(asOf) - Date.parse(review.decided_at) >= 2 * 60000, accept_all: review.accept_all, items: [] };
  for (const entry of itemStates) {
    const item = current.get(entry.item_id);
    const section = sections.get(entry.item_id);
    if (item === undefined) continue;
    if (section === undefined) { hold(entry.item_id, "MISSING_SECTION"); continue; } // never an implicit decision
    if (section.duplicate) { hold(entry.item_id, "DUPLICATE_SECTION"); continue; }
    if (section.decision === null) { hold(entry.item_id, "UNREADABLE_DECISION"); continue; }
    let token: Token = section.decision;
    if (token === "pending" && review.accept_all) token = "accept"; // Submit and accept all: explicit tokens win
    if (token === "pending") continue;
    if (token === "request revision") { out.review_revisions.push({ proposal: id, page_id: row.page_id, item_id: entry.item_id, instruction: section.revision_request }); continue; }
    const stored = published[entry.item_id];
    if (token === "accept") {
      if (item.held || stored?.held === true) { hold(entry.item_id, "HELD_SOURCE_EXCLUDED"); continue; }
      if (section.proposed === null) { hold(entry.item_id, "UNREADABLE_PROPOSED"); continue; }
      if (stored?.base_hash === undefined) { hold(entry.item_id, "NO_BASELINE"); continue; }
      if (stored.base_hash !== item.current_base_hash) { hold(entry.item_id, "BASE_CHANGED"); continue; }
    }
    decision.items.push({
      item_id: entry.item_id, decision: token === "accept" ? "accept" : token === "reject" ? "reject" : "defer",
      proposed: token === "accept" ? section.proposed : null, proposed_hash: textSha(section.proposed ?? ""), rendered_proposed_hash: stored?.proposed_hash ?? null,
      base_hash: item.current_base_hash, snapshot_hash: sectionHash(section.section), edited: token === "accept" && stored?.proposed_hash !== undefined && textSha(section.proposed ?? "") !== stored.proposed_hash,
    });
  }
  if (decision.items.length > 0) out.review_decisions.push(decision);
}
