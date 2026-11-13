import { isRecord, unknownKeys, type InputProblem } from "./input.ts";
import type { Note } from "./notes.ts";
import { DECISIONS, parseReviewPage, reviewItems, sectionHash, textSha, UNCONVERTIBLE, type Token } from "./review-body.ts";
import { expand, holdsValue, linkNames, parseReviewPage2, valueForms, withoutMarkers, wordingSha, type Labels } from "./review-format2.ts";
import { extractPassages } from "./selection.ts";
import { PASSAGE } from "./suppressions.ts";
import { normalizeTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";

// Planning a Review row of the new layout (capture-and-review §7.3, §7.9, §7.10): deterministic, reads only the snapshot.

/** What the skill reads off a Review page: the three properties of the Submit buttons, the page's edit time and its body as Markdown. */
export interface ReviewPage { decided: boolean; decided_at: string | null; accept_all: boolean; page_edited_at: string; body_markdown: string | null }

export interface ItemDecision {
  item_id: string; decision: "accept" | "reject" | "defer" | "stale";
  /** `stale`: an Accept on an item that rests only on excluded evidence; `sync apply` closes it with the reason `source_excluded` (§5.1). */
  /** The exact final wording to apply: the Proposed toggle as read (null for a rejection or deferral). */
  proposed: string | null; proposed_hash: string; rendered_proposed_hash: string | null; base_hash: string; snapshot_hash: string; edited: boolean;
  /** Format 2: the item's `Agreed in review:` lines, stored with its decision and never hashed (capture-and-review §7.12.6). */
  agreed?: string;
  /** Format 2, an accepted link item: the indexes into `links` still in its wording (capture-and-review §7.12.6). */
  values?: number[];
  /** Set by the skill after it re-reads the page just before applying (capture-and-review §7.3): `sync apply` refuses an item whose hashes moved. */
  verified?: { snapshot_hash: string; proposed_hash: string };
}
export interface ReviewDecision { proposal: string; page_id: string; decided_at: string; decided_by: "notion"; page_edited_at: string; unattended_ok: boolean; accept_all: boolean; items: ItemDecision[];
  /** Format 2: the page's format and the Your call that submitted it (capture-and-review §7.12.7). */
  format?: 2; call?: "approve" | "reject" }
export interface ReviewHeld { proposal: string; page_id: string; item_id: string | null; reason: string; detail?: string }
export interface ReviewRevision { proposal: string; page_id: string; item_id: string; instruction: string | null }

export interface ReviewPlanOut {
  review_decisions: ReviewDecision[]; review_held: ReviewHeld[]; review_revisions: ReviewRevision[]; review_pending: Array<{ proposal: string; page_id: string }>;
  review_row_revisions: Array<{ proposal: string; page_id: string; instruction: string }>; review_untouched: Array<{ proposal: string; page_id: string }>;
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
      // A structure the parser cannot read (no toggle, an unconvertible block) is also something to keep: the render must not overwrite it.
      const broken = section.proposed === null && published[entry.item_id]?.proposed_hash !== undefined;
      if (edited || broken || (section.decision !== null && section.decision !== "pending") || section.decision === null || section.revision_request !== null) pending = true;
    }
  }
  if (pending || review?.decided === true) out.review_pending.push({ proposal: id, page_id: row.page_id });

  const call = String(row.properties["Your call"] ?? "").toLowerCase();
  // An untouched format-1 row is rebuilt once as a format-2 page (capture-and-review §7.12.1): read, every section there once, nothing typed or edited.
  const untouched = sections !== undefined && !pending && review?.decided !== true && call === "" && !isRecord(proposal.attributes.cleanup)
    && !(Array.isArray(proposal.attributes.item_decisions) && proposal.attributes.item_decisions.length > 0) && !(Array.isArray(proposal.attributes.revisions) && proposal.attributes.revisions.length > 0)
    && itemStates.every((entry) => { const section = sections.get(entry.item_id); return section !== undefined && !section.duplicate && section.decision === "pending" && section.proposed !== null; });
  if (untouched) out.review_untouched.push({ proposal: id, page_id: row.page_id });
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

  // Read lazily: a damaged suppression record must not stop the plan of rows that are not being read (it fails closed when one is).
  const current = new Map(reviewItems(proposal, workspace).map((item) => [item.item_id, item]));
  const done = new Set((Array.isArray(proposal.attributes.item_decisions) ? proposal.attributes.item_decisions : []).filter(isRecord).map((entry) => String(entry.item_id)));
  const decision: ReviewDecision = { proposal: id, page_id: row.page_id, decided_at: review.decided_at, decided_by: "notion", page_edited_at: review.page_edited_at, unattended_ok: Date.parse(asOf) - Date.parse(review.decided_at) >= 2 * 60000, accept_all: review.accept_all, items: [] };
  for (const entry of itemStates) {
    const item = current.get(entry.item_id);
    const section = sections.get(entry.item_id);
    if (item === undefined || done.has(entry.item_id)) continue; // an item already decided is never decided again, and its missing section is not news
    if (section === undefined) { hold(entry.item_id, "MISSING_SECTION"); continue; } // never an implicit decision
    if (section.duplicate) { hold(entry.item_id, "DUPLICATE_SECTION"); continue; }
    if (section.decision === null) { hold(entry.item_id, "UNREADABLE_DECISION"); continue; }
    let token: Token = section.decision;
    // Submit and accept all, or a row-level Approve or Reject, decides the items still on Pending; explicit tokens win (§7.3, §7.6).
    // An item with a typed revision request is not eligible: it waits.
    if (token === "pending" && section.revision_request !== null && (review.accept_all || call === "approve" || call === "reject")) { hold(entry.item_id, "REVISION_PENDING"); continue; }
    if (token === "pending" && review.accept_all) token = "accept";
    else if (token === "pending" && call === "approve") token = "accept";
    else if (token === "pending" && call === "reject") token = "reject";
    if (token === "pending") continue;
    // A cleanup item has no new row to move to: it stays pending until it is decided (§5.2).
    if (token === "defer" && ["remove", "restore", "independence"].includes(String(proposal.attributes.items && (proposal.attributes.items as Array<Record<string, unknown>>).find((candidate) => candidate.item_id === entry.item_id)?.kind))) { hold(entry.item_id, "DEFER_NOT_SUPPORTED"); continue; }
    if (token === "request revision") { out.review_revisions.push({ proposal: id, page_id: row.page_id, item_id: entry.item_id, instruction: section.revision_request }); continue; }
    const stored = published[entry.item_id];
    if (token === "accept" && item.source_excluded) {
      decision.items.push({ item_id: entry.item_id, decision: "stale", proposed: null, proposed_hash: textSha(""), rendered_proposed_hash: stored?.proposed_hash ?? null, base_hash: item.current_base_hash, snapshot_hash: sectionHash(section.section), edited: false });
      continue;
    }
    if (token === "accept") {
      if (item.held || stored?.held === true) { hold(entry.item_id, "HELD_SOURCE_EXCLUDED"); continue; }
      // Empty, missing or unreadable wording is never applied and never read as a deletion (§7.11).
      if (section.proposed === null || section.proposed === "") { hold(entry.item_id, "UNREADABLE_PROPOSED"); continue; }
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

// ── Format 2 (capture-and-review §7.12; decisions 0088 §2, 0090) ─────────────────────────────────

/**
 * One Review row of format 2: Your call is the submission (§7.12.7). Approve reads every item's Decision line, a Pending item as Accept except a ⚠
 * fact change or a flagged item; Reject reads a Pending item as Reject; Request revision lists the row for the attended skill. Items are found by
 * their `ref` line (§7.12.6), headings are never read, and an accepted fact's value must be in a passage it cites.
 */
export function planReviewRow2(
  workspace: Workspace, row: { page_id: string; last_edited: string; properties: Record<string, unknown> }, review: ReviewPage | undefined, proposal: Note, asOf: string,
  out: ReviewPlanOut, conflict: (code: string, message: string, property?: string) => void,
): void {
  const id = proposal.id;
  const published = (() => { const p = proposal.attributes.notion_published; const r = isRecord(p) && isRecord(p["@review"]) ? p["@review"] : undefined; return isRecord(r) && isRecord(r.items) ? r.items : {}; })() as Record<string, { rendered_hash?: string; proposed_hash?: string; base_hash?: string; held?: boolean }>;
  const sections = review?.body_markdown == null ? undefined : parseReviewPage2(review.body_markdown, UNCONVERTIBLE);
  const hold = (item: string | null, reason: string, detail?: string) => out.review_held.push({ proposal: id, page_id: row.page_id, item_id: item, reason, ...(detail === undefined ? {} : { detail }) });
  const itemStates = (Array.isArray(proposal.attributes.items) ? proposal.attributes.items : []).filter(isRecord).map((entry) => ({ item_id: String(entry.item_id), kind: String(entry.kind) }));
  const current = new Map(reviewItems(proposal, workspace, 2).map((item) => [item.item_id, item]));
  const call = String(row.properties["Your call"] ?? "").trim().toLowerCase();

  // What waits in Notion and must not be overwritten (§7.10): an edited or unreadable wording, a typed token, a revision line, or a call.
  const wordingOf = (itemId: string): { text: string | null; problem?: string; cited: string[] } => {
    const section = sections?.get(itemId); const item = current.get(itemId);
    if (section === undefined || item === undefined || section.wording === null) return { text: null, problem: "UNREADABLE_PROPOSED", cited: [] };
    const expanded = expand(section.wording, item.labels);
    if (expanded.unknown.length > 0) return { text: null, problem: "UNKNOWN_MARKER", cited: [] };
    return { text: item.link_values !== undefined ? linkNames(expanded.text).join("\n") : expanded.text, cited: expanded.cited };
  };
  let pending = call !== "";
  if (sections !== undefined) for (const entry of itemStates) {
    const section = sections.get(entry.item_id);
    if (section === undefined) continue;
    const wording = wordingOf(entry.item_id);
    const stored = published[entry.item_id];
    if (wording.text === null && stored?.held !== true) pending = true;
    if (wording.text !== null && stored?.proposed_hash !== undefined && wordingSha(wording.text) !== stored.proposed_hash) pending = true;
    if (section.decision_text === null || section.decision_text.trim().toLowerCase() !== "pending" || section.revision_request !== null || section.revision_lines > 1) pending = true;
  }
  if (pending) out.review_pending.push({ proposal: id, page_id: row.page_id });

  if (call === "") return;
  if (call === "request revision" || call === "fix") {
    const text = String(row.properties["What to fix"] ?? "").trim();
    if (text === "") { conflict("REVISION_WITHOUT_TEXT", "Request revision needs What to fix: say what to change", "What to fix"); return; }
    out.review_row_revisions.push({ proposal: id, page_id: row.page_id, instruction: text });
    return;
  }
  if (call !== "approve" && call !== "reject") return;
  if (sections === undefined) { hold(null, "BODY_UNREADABLE"); return; }

  const done = new Set((Array.isArray(proposal.attributes.item_decisions) ? proposal.attributes.item_decisions : []).filter(isRecord).map((entry) => String(entry.item_id)));
  const decision: ReviewDecision = { proposal: id, page_id: row.page_id, decided_at: row.last_edited, decided_by: "notion", page_edited_at: row.last_edited, unattended_ok: Date.parse(asOf) - Date.parse(row.last_edited) >= 2 * 60000, accept_all: false, items: [], format: 2, call };
  for (const entry of itemStates) {
    const item = current.get(entry.item_id);
    const section = sections.get(entry.item_id);
    if (item === undefined || done.has(entry.item_id)) continue;
    if (section === undefined) { hold(entry.item_id, "MISSING_SECTION"); continue; }
    if (section.duplicate) { hold(entry.item_id, "DUPLICATE_SECTION"); continue; }
    const normalized = section.decision_text === null || section.revision_lines > 1 ? null : section.decision_text.replace(/\s+/g, " ").toLowerCase();
    if (normalized === null || !(DECISIONS as readonly string[]).includes(normalized)) { hold(entry.item_id, "UNREADABLE_DECISION"); continue; }
    let token = normalized as Token;
    if (token === "pending" && call === "approve") {
      if (section.revision_request !== null) { hold(entry.item_id, "REVISION_PENDING"); continue; }
      // Approve never accepts a ⚠ fact change or a flagged item that is still Pending (0090 §5).
      if (!item.held && (item.warn || item.flags.length > 0)) { hold(entry.item_id, "NEEDS_EXPLICIT_ACCEPT"); continue; }
      token = "accept";
    } else if (token === "pending") token = "reject";
    if (token === "defer" && ["remove", "restore", "independence"].includes(entry.kind)) { hold(entry.item_id, "DEFER_NOT_SUPPORTED"); continue; }
    if (token === "request revision") { out.review_revisions.push({ proposal: id, page_id: row.page_id, item_id: entry.item_id, instruction: section.revision_request }); continue; }
    const stored = published[entry.item_id];
    const agreed = section.agreed === null ? {} : { agreed: section.agreed };
    if (token === "accept" && item.source_excluded) {
      decision.items.push({ item_id: entry.item_id, decision: "stale", proposed: null, proposed_hash: textSha(""), rendered_proposed_hash: stored?.proposed_hash ?? null, base_hash: item.current_base_hash, snapshot_hash: sectionHash(section.section), edited: false, ...agreed });
      continue;
    }
    const wording = wordingOf(entry.item_id);
    let values: number[] | undefined;
    if (token === "accept") {
      if (item.held || stored?.held === true) { hold(entry.item_id, "HELD_SOURCE_EXCLUDED"); continue; }
      if (wording.text === null || wording.text.trim() === "") { hold(entry.item_id, wording.problem ?? "UNREADABLE_PROPOSED"); continue; }
      if (stored?.base_hash === undefined) { hold(entry.item_id, "NO_BASELINE"); continue; }
      if (stored.base_hash !== item.current_base_hash) { hold(entry.item_id, "BASE_CHANGED"); continue; }
      if (item.link_values !== undefined) {
        // One line per value the item adds; a deleted one is not added, and editing never adds a name (0088 Q5).
        const names = wording.text.split("\n");
        const matched = names.map((name) => item.link_values!.find((value) => value.names.includes(name.toLowerCase())));
        if (matched.some((value) => value === undefined)) { hold(entry.item_id, "LINK_VALUE_UNKNOWN"); continue; }
        values = [...new Set(matched.map((value) => value!.index))].sort((a, b) => a - b);
      }
      const check = factCheck(workspace, proposal, entry.item_id, item, wording.text, wording.cited);
      if (check !== null) { hold(entry.item_id, "VALUE_NOT_IN_PASSAGE", check); continue; }
    }
    const text = token === "accept" ? wording.text : null;
    decision.items.push({
      item_id: entry.item_id, decision: token === "accept" ? "accept" : token === "reject" ? "reject" : "defer",
      proposed: text, proposed_hash: token === "accept" ? wordingSha(text ?? "") : textSha(""), rendered_proposed_hash: stored?.proposed_hash ?? null,
      base_hash: item.current_base_hash, snapshot_hash: sectionHash(section.section), edited: token === "accept" && stored?.proposed_hash !== undefined && wordingSha(text ?? "") !== stored.proposed_hash,
      ...agreed, ...(values === undefined ? {} : { values }),
    });
  }
  // The call is consumed even when no item is decided, so the skill clears it and the row needs the user again (§7.12.7).
  out.review_decisions.push(decision);
}

/**
 * `VALUE_NOT_IN_PASSAGE` (0090 §4): an accepted fact change whose value is in none of the passages its wording cites (its item's when it cites
 * none). Returns null when the value is found or nothing can be checked, else a detail naming another passage of the page that holds it.
 */
function factCheck(workspace: Workspace, proposal: Note, itemId: string, item: { labels: Labels; passages: string[] }, wording: string, cited: string[]): string | null | undefined {
  const entry = (Array.isArray(proposal.attributes.items) ? proposal.attributes.items : []).filter(isRecord).find((candidate) => candidate.item_id === itemId);
  if (entry?.kind !== "change") return null;
  const change = (Array.isArray(proposal.attributes.changes) ? proposal.attributes.changes : []).filter(isRecord)[Number(entry.ref)];
  if (change?.kind !== "update_fact") return null;
  const value = withoutMarkers(wording);
  const refs = (cited.length > 0 ? cited : item.passages).filter((passage) => PASSAGE.test(passage));
  if (refs.length === 0) return null; // only passage references are checked (a stated limit)
  const named = workspace.notes.find((note) => String(note.attributes.title ?? "").toLowerCase() === value.toLowerCase());
  const forms = valueForms(value, named !== undefined && Array.isArray(named.attributes.aliases) ? named.attributes.aliases.map(String) : []);
  const text = (ref: string): string | undefined => { const [, src, n] = PASSAGE.exec(ref)!; const note = workspace.get(src!); return note === undefined ? undefined : extractPassages(note.body).find((passage) => passage.n === Number(n))?.text; };
  if (refs.some((ref) => { const passage = text(ref); return passage !== undefined && holdsValue(passage, forms); })) return null;
  const other = [...item.labels.byRef.keys()].find((ref) => !refs.includes(ref) && (() => { const passage = text(ref); return passage !== undefined && holdsValue(passage, forms); })());
  return other === undefined ? `${value} is in none of its passages` : `${item.labels.byRef.get(other)} says ${value}`;
}
