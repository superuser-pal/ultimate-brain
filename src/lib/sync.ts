import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { applyAll, type Correction, type DecisionInput } from "./apply.ts";
import { BrainError } from "./errors.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { generateId, TYPE_PREFIX } from "./ids.ts";
import { assertStagedValid, checkNoteInput, NO_LIFECYCLE_PROPERTY, stageNotes, type NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { splitParts } from "./parts.ts";
import { referencedIds } from "./lint.ts";
import { loadSchemas } from "./schemas.ts";
import { formatDate, formatTimestamp, normalizeTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";
import { lineDiff } from "./diff.ts";
import type { LogEntry } from "./log.ts";
import { databaseId, moduleForDatabase, modulesOf, typeIsOn } from "./modules.ts";
import { bodyHash, bodyOf } from "./proposals.ts";
import { applyReviewDecisions } from "./review-apply.ts";
import { recordRevisionRequests } from "./review-revision.ts";
import { renderReview, reviewFormat } from "./review-body.ts";
import { CONTEXT_HEADING } from "./review-format2.ts";
import { decidedInChat, suggestionText } from "./notion-change.ts";
import { parseReviewPageInput, planReviewRow, planReviewRow2, type ItemDecision, type ReviewDecision, type ReviewHeld, type ReviewPage, type ReviewRevision } from "./review-plan.ts";
import { hasReportShape, reportLinks } from "./report-body.ts";
import { gitBodyOf, parseWording, planWording, textHash, type AcceptedWording, type Wording, type WordingPlan } from "./wording.ts";
import type { Context } from "./eligibility.ts";
import { proposalWithheld, type Withheld } from "./passages.ts";
import { citeLabel, contextFor, publishableNote, requireSuppressions, titleWithheld, viewDependencies, withheldView } from "./suppressions.ts";
import { importedItems } from "./selection.ts";
import { chainOf, FOLLOW_UP } from "./extract.ts";
import { wholeDocumentMarkdown } from "./whole-links.ts";

export const DATABASES = ["domains", "areas", "goals", "key_results", "projects", "people", "orgs", "decisions", "questions", "documents", "review", "inbox"] as const;
const CREATABLE = new Set(["domains", "areas", "goals", "projects", "people", "orgs"]);
const TYPE_FOR_DATABASE: Record<string, string> = { domains: "domain", areas: "area", goals: "goal", projects: "project", people: "person", orgs: "org", decisions: "decision", questions: "question", documents: "reference", review: "proposal" };
const DATABASE_FOR_TYPE: Record<string, string> = { domain: "domains", area: "areas", goal: "goals", project: "projects", person: "people", org: "orgs", decision: "decisions", question: "questions", reference: "documents", source: "inbox", meeting: "meetings", proposal: "review" };
const PUBLISHED_TYPES = new Set(["domain", "area", "goal", "project", "person", "org", "decision", "question", "reference", "source", "meeting", "proposal"]);

export interface SyncPlan {
  as_of: string;
  create: Array<NoteInput & { lifecycle?: string }>;
  updates: Array<Record<string, unknown>>;
  corrections: Correction[];
  decisions: DecisionInput[];
  /** Inbox rows whose Document asked box is ticked by the Keep as document button (0049); the skill writes a Document for each. */
  document_requests: Array<{ page_id: string; source: string; files: string[]; only_keep: string | null; existing?: string[] }>;
  /** Decision rows whose Promote box is ticked (0049; Concepts are retired since 0.9.1, 0071); the skill writes a promoted Document for each. */
  promote_requests: Array<{ page_id: string; note: string; existing?: string }>;
  /** Report rows whose Refresh box is ticked, and their new What to fix texts (0045); the skill runs `report new` / `report fix`. */
  refresh_requests: Array<{ page_id: string; report: string; wording_blocked?: true }>;
  report_fixes: Array<{ page_id: string; report: string; text: string }>;
  /** Accepted Document and report wording to import exactly, and the rows that wait or are held (cli §5.14.7, 0054). */
  accepted_wording: AcceptedWording[];
  wording_waiting: WordingPlan["wording_waiting"];
  wording_held: WordingPlan["wording_held"];
  clear_accepted: WordingPlan["clear_accepted"];
  /** Review rows whose Notion page holds edits or decisions that must not be overwritten (capture-and-review §7.10): render withholds them. */
  review_pending: Array<{ proposal: string; page_id: string }>;
  /** Decisions read off Review rows of the new layout, per item with the exact final wording (capture-and-review §7.3); applied by `sync apply`. */
  review_decisions: ReviewDecision[];
  /** Items and rows that were not read or not applied, and why (BASE_CHANGED, UNREADABLE_DECISION, HELD_SOURCE_EXCLUDED, EDITED_AFTER_DECIDED, …). */
  review_held: ReviewHeld[];
  /** Items the user asked to revise: the attended skill drafts a new proposal; an unattended run never reads the instruction. */
  review_revisions: ReviewRevision[];
  /** Format-2 rows whose Your call is Request revision, with What to fix: the attended skill maps the text to items (capture-and-review §7.12.7). */
  review_row_revisions: Array<{ proposal: string; page_id: string; instruction: string }>;
  /** Format-1 rows nobody touched, rebuilt once as format-2 pages by `sync render --plan` (capture-and-review §7.12.1). */
  review_untouched: Array<{ proposal: string; page_id: string }>;
  conflicts: Array<Record<string, unknown>>;
  ignored: Array<Record<string, unknown>>;
}

function property(value: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function noteByNotion(workspace: Workspace, pageId: string): Note | undefined {
  return workspace.notes.find((note) => note.attributes.notion === pageId);
}

function relationIds(workspace: Workspace, value: unknown, conflicts: Array<Record<string, unknown>>, row: SnapshotRow, name: string): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const resolved: string[] = [];
  for (const page of value) {
    if (typeof page !== "string") continue;
    const note = noteByNotion(workspace, page);
    if (note === undefined) {
      conflicts.push(conflict(row, "UNRESOLVED_RELATION", `Cannot resolve ${name} relation ${page}`, name, value));
      return undefined;
    }
    resolved.push(note.id);
  }
  return [...new Set(resolved)].sort(compareCodePoints);
}

function conflict(row: SnapshotRow, code: string, message: string, propertyName?: string, notionValue?: unknown, brainValue?: unknown): Record<string, unknown> {
  return {
    database: row.database, page_id: row.page_id, brain_id: typeof row.properties["Brain ID"] === "string" ? row.properties["Brain ID"] : null,
    code, message, ...(propertyName === undefined ? {} : { property: propertyName }),
    ...(notionValue === undefined ? {} : { notion_value: notionValue }), ...(brainValue === undefined ? {} : { brain_value: brainValue }),
  };
}

interface SnapshotRow { database: string; page_id: string; last_edited: string; properties: Record<string, unknown>; wording?: Wording; review?: ReviewPage }
interface Snapshot { as_of: string; rows: SnapshotRow[] }

/** Validates the skill-normalized snapshot without accepting arbitrary MCP-shaped input. */
export function parseSnapshot(input: unknown): Snapshot {
  if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object" }]);
  const record = input as Record<string, unknown>;
  const problems = unknownKeys(record, ["as_of", "rows"], "");
  if (!isTimestamp(record.as_of)) problems.push({ pointer: "/as_of", message: "must be an ISO 8601 UTC timestamp" });
  if (!Array.isArray(record.rows)) problems.push({ pointer: "/rows", message: "must be a list" });
  (Array.isArray(record.rows) ? record.rows : []).forEach((value, index) => {
    const p = `/rows/${index}`;
    if (!isRecord(value)) return problems.push({ pointer: p, message: "must be an object" });
    problems.push(...unknownKeys(value, ["database", "page_id", "last_edited", "properties", "wording", "review"], p));
    if (value.wording !== undefined) value.wording = parseWording(value.wording, `${p}/wording`, problems);
    if (value.review !== undefined) value.review = parseReviewPageInput(value.review, `${p}/review`, problems);
    if (value.database === "references") value.database = "documents"; // read as documents (0049)
    if (!DATABASES.includes(value.database as typeof DATABASES[number])) problems.push({ pointer: `${p}/database`, message: "is not a sync database" });
    if (typeof value.page_id !== "string" || value.page_id === "") problems.push({ pointer: `${p}/page_id`, message: "must be a non-empty string" });
    if (!isTimestamp(value.last_edited)) problems.push({ pointer: `${p}/last_edited`, message: "must be an ISO 8601 UTC timestamp" });
    if (!isRecord(value.properties)) problems.push({ pointer: `${p}/properties`, message: "must be an object" });
  });
  assertNoProblems(problems);
  return { as_of: normalizeTimestamp(record.as_of)!, rows: (record.rows as SnapshotRow[]).map((row) => ({ ...row, last_edited: normalizeTimestamp(row.last_edited)! })) };
}

/** Compute the deterministic, no-network Notion pull plan (cli §5.14.2). */
export function buildPlan(workspace: Workspace, snapshot: Snapshot): SyncPlan {
  const result: SyncPlan = { as_of: snapshot.as_of, create: [], updates: [], corrections: [], decisions: [], document_requests: [], promote_requests: [], refresh_requests: [], report_fixes: [], accepted_wording: [], wording_waiting: [], wording_held: [], clear_accepted: [], review_pending: [], review_decisions: [], review_held: [], review_revisions: [], review_row_revisions: [], review_untouched: [], conflicts: [], ignored: [] };
  const createsByPage = new Map<string, { id: string; type: string }>();
  for (const row of snapshot.rows) if (CREATABLE.has(row.database) && blank(property(row.properties, "Brain ID"))) {
    const existing = noteByNotion(workspace, row.page_id);
    if (existing === undefined) createsByPage.set(row.page_id, { id: generateId(TYPE_PREFIX[TYPE_FOR_DATABASE[row.database]]!, new Set([...workspace.ids(), ...[...createsByPage.values()].map((x) => x.id)])), type: TYPE_FOR_DATABASE[row.database]! });
  }

  const modules = modulesOf(workspace.config);
  for (const row of snapshot.rows) {
    // A database whose module is off is not read at all (cli §5.14.2, 0048).
    const module = moduleForDatabase(row.database);
    if (module !== null && !modules[module]) { result.ignored.push(ignoredRow(row, "MODULE_OFF")); continue; }
    if (row.database === "areas" && Object.hasOwn(row.properties, "Domain")) {
      if (!modules.domains) result.ignored.push(ignoredRow(row, "MODULE_OFF", "Domain"));
      else if (Array.isArray(row.properties.Domain) && row.properties.Domain.length > 1) { result.conflicts.push(conflict(row, "MULTIPLE_DOMAINS", "Area has more than one Domain", "Domain", row.properties.Domain)); continue; }
    }
    if (row.database === "key_results") { planKeyResult(workspace, snapshot.as_of, row, result); continue; }
    if (row.database === "inbox") { planInbox(workspace, row, result); continue; }
    const brainId = property(row.properties, "Brain ID");
    let note = typeof brainId === "string" && brainId !== "" ? workspace.get(brainId) : noteByNotion(workspace, row.page_id);
    // A report's row is in Documents since 0.9.1 (0071): read only for its requests and wording, as on the Inbox before.
    if (row.database === "documents" && note !== undefined && isReport(note)) { planReport(workspace, row, note, result); continue; }
    // A weekly review's row (0.15.0, weekly-review.md §2) is read for nothing: a rerun is its refresh, and its requests are ignored.
    if (row.database === "documents" && note !== undefined && isWeekly(note)) { planWeekly(workspace, row, note, result); continue; }
    if (typeof brainId === "string" && brainId !== "" && note === undefined) { result.conflicts.push(conflict(row, "UNKNOWN_BRAIN_ID", `No note has Brain ID ${brainId}`)); continue; }
    if (note !== undefined && note.attributes.notion !== undefined && note.attributes.notion !== row.page_id) { result.conflicts.push(conflict(row, "NOTION_ID_MISMATCH", `Note ${note.id} belongs to another Notion page`)); continue; }
    if (note === undefined) {
      if (!CREATABLE.has(row.database)) { result.ignored.push({ database: row.database, page_id: row.page_id, brain_id: null, reason: "NOT_CREATED_IN_NOTION" }); continue; }
      const item = createFromRow(workspace, snapshot.as_of, row, createsByPage, result.conflicts);
      if (item !== undefined) result.create.push(item);
      continue;
    }
    // A create whose publish failed has no Brain ID in Notion yet; treat the row as if it had it (cli §5.14.2).
    const known = typeof brainId === "string" && brainId !== "" ? row : { ...row, properties: { ...row.properties, "Brain ID": note.id } };
    planExisting(workspace, snapshot.as_of, known, note, result);
    if (row.database === "documents" && row.wording !== undefined && wordingDocument(note)) planWording(workspace, snapshot.as_of, row.page_id, note, row.wording, result);
    if (row.database === "decisions" && property(row.properties, "Promote asked") === true) planPromote(workspace, row, note, modules.documents, result);
  }
  // A queued full refresh waits while Notion text for that report is unresolved (cli §5.14.7).
  const wordingNotes = new Set([...result.accepted_wording, ...result.wording_waiting, ...result.wording_held].map((item) => item.note));
  for (const request of result.refresh_requests) if (wordingNotes.has(request.report)) request.wording_blocked = true;
  sortPlan(result);
  return result;
}

function createFromRow(workspace: Workspace, asOf: string, row: SnapshotRow, creates: ReadonlyMap<string, { id: string; type: string }>, conflicts: Array<Record<string, unknown>>): SyncPlan["create"][number] | undefined {
  const type = TYPE_FOR_DATABASE[row.database]!;
  const title = property(row.properties, "Name");
  if (typeof title !== "string" || title === "") { conflicts.push(conflict(row, "REQUIRED_EMPTY", "Name is required", "Name", title)); return undefined; }
  const valueOfPage = (value: unknown, field: string, many = false): unknown => {
    if (!Array.isArray(value)) return many ? [] : undefined;
    const ids: string[] = [];
    for (const page of value) {
      if (typeof page !== "string") continue;
      const note = noteByNotion(workspace, page);
      const created = creates.get(page);
      if (note !== undefined) ids.push(note.id); else if (created !== undefined) ids.push(created.id); else { conflicts.push(conflict(row, "UNRESOLVED_RELATION", `Cannot resolve ${field} relation ${page}`, field, value)); return undefined; }
    }
    return many ? [...new Set(ids)].sort(compareCodePoints) : ids[0];
  };
  const frontmatter: Record<string, unknown> = {
    summary: typeof property(row.properties, "Summary") === "string" && property(row.properties, "Summary") !== "" ? property(row.properties, "Summary") : title,
    notion: row.page_id, sources: [`notion:${row.page_id}`], notion_fields: notionFields(row.database, row.properties, asOf),
    notion_published: publishedBaseline(row, renderedBrainValues({ path: "", type, id: "", body: "", raw: "", attributes: { type, title, summary: property(row.properties, "Summary") ?? title, lifecycle: rowLifecycle(type, row), notion: row.page_id } } as Note, workspace)),
  };
  const facts: Record<string, unknown> = {};
  const timeline: Record<string, unknown>[] = [];
  const fact = (name: string, value: unknown) => { if (value !== undefined && value !== null) { facts[name] = value; timeline.push({ field: name, value, from: row.last_edited.slice(0, 10), learned: asOf.slice(0, 10), source: `notion:${row.page_id}`, assessment: "accepted" }); } };
  if (type === "area" && modulesOf(workspace.config).domains) frontmatter.domain = valueOfPage(property(row.properties, "Domain"), "Domain");
  if (type === "domain" && modulesOf(workspace.config).orgs) frontmatter.org = valueOfPage(property(row.properties, "Org"), "Org");
  if (type === "goal") { frontmatter.why = property(row.properties, "Why"); frontmatter.area = valueOfPage(property(row.properties, "Area"), "Area"); fact("deadline", dateValue(property(row.properties, "Deadline"))); }
  if (type === "project") { frontmatter.area = valueOfPage(property(row.properties, "Area"), "Area"); frontmatter.goal = valueOfPage(property(row.properties, "Goal"), "Goal"); frontmatter.client = valueOfPage(property(row.properties, "Client"), "Client"); frontmatter.people = valueOfPage(property(row.properties, "People"), "People", true); Object.assign(facts, parseKeyFacts(property(row.properties, "Key Facts"))); }
  if (type === "person") { frontmatter.org = valueOfPage(property(row.properties, "Org"), "Org"); fact("role", property(row.properties, "Role")); }
  if (Object.keys(facts).length > 0) { frontmatter.facts = facts; for (const [field, value] of Object.entries(facts)) fact(field, value); frontmatter.timeline = timeline; }
  if ((type === "goal" && (typeof frontmatter.why !== "string" || typeof frontmatter.area !== "string")) || (type === "project" && typeof frontmatter.area !== "string")) { conflicts.push(conflict(row, "MISSING_REQUIRED", `${type} "${title}" is missing required properties`)); return undefined; }
  const id = creates.get(row.page_id)!.id;
  return { type, id, title, lifecycle: rowLifecycle(type, row), frontmatter, body: "" };
}

/** A new row's lifecycle: Notion's Lifecycle (default `draft`), or `reviewed` for the types without the property (0070). */
function rowLifecycle(type: string, row: SnapshotRow): string {
  if (NO_LIFECYCLE_PROPERTY.has(type)) return "reviewed";
  return (normalizeLifecycle(property(row.properties, "Lifecycle")) as string | undefined) ?? "draft";
}

/** The baseline is what Notion shows (cli §5.14.2), empty values included, so render publishes the brain's values over them. */
function publishedBaseline(row: SnapshotRow, rendered: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(rendered).filter((name) => Object.hasOwn(row.properties, name)).map((name) => [name, row.properties[name]]));
}

/** A note as Notion may show it (cli §5.14.4, "Restricted notes"; eligibility.md §6 rule 5, §8): a restricted note in its published form, and a
 *  view the derived-content rule withholds (`withheld`; a report as a notice), so a published copy changes, and is re-rendered, once content is excluded. */
const publishForms = new WeakMap<Workspace, { forms: Map<string, Note>; context: Context; withheld: Set<string> }>();
const WITHHELD_REPORT = "Withheld: this report rests on content you excluded from the brain, or was written before you excluded it, so it is not shown. Tick Refresh asked to rebuild it from what the brain may use now.";
const WITHHELD_VIEW = "Withheld: this view rests on a note awaiting cleanup, so it is not shown. brain views rebuilds it once that note is cleaned up.";
function publishState(workspace: Workspace): { forms: Map<string, Note>; context: Context; withheld: Set<string> } {
  let state = publishForms.get(workspace);
  if (state === undefined) {
    const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
    const dependencies = viewDependencies(workspace.notes, (path) => workspace.exists(path));
    const withheld = new Set(workspace.notes.filter((note) => note.type === "view" && withheldView(note, dependencies, context) !== null).map((note) => note.id));
    const form = (candidate: Note): Note => {
      if (candidate.type === "source" || candidate.type === "proposal") return candidate;
      if (withheld.has(candidate.id)) return isReport(candidate) ? { ...candidate, attributes: { ...candidate.attributes, title: `report ${candidate.id}, withheld: refresh to rebuild` }, body: `${WITHHELD_REPORT}\n` } : candidate;
      return publishableNote(candidate, context);
    };
    state = { forms: new Map(workspace.notes.map((candidate) => [candidate.id, form(candidate)])), context, withheld };
    publishForms.set(workspace, state);
  }
  return state;
}
function publishable(workspace: Workspace, note: Note): Note { return publishState(workspace).forms.get(note.id) ?? note; }
/** How Notion names a note as text: its title, or, in the awaiting-cleanup form, `<type> <id>, title withheld: awaiting cleanup` (cli §5.14.4). */
function shownTitle(workspace: Workspace, note: Note): unknown { const form = publishable(workspace, note); return titleWithheld(form) ? citeLabel(form) : form.attributes.title; }
/**
 * What of a proposal Notion may not show (capture-and-review §5.1, eligibility.md §9.4, cli §5.7 "Excluded evidence"): `whole` when the proposal,
 * or every item of a review_notes, is withheld (a passage is not live; or it is legacy and its input has a suppression record or its source is
 * an older version or full copy of a changed input); `items`, the withheld items of a review_notes.
 */
function proposalHeld(workspace: Workspace, note: Note): { whole: boolean; items: Withheld } {
  const none: Withheld = { whole: false, changes: new Set(), notes: new Set(), links: new Set() };
  if (note.type !== "proposal") return { whole: false, items: none };
  const items = proposalWithheld(note, workspace, publishState(workspace).context);
  const a = note.attributes;
  const count = (Array.isArray(a.changes) ? a.changes.length : 0) + (Array.isArray(a.notes) ? a.notes.length : 0) + (Array.isArray(a.links) ? a.links.length : 0);
  const held = items.changes.size + items.notes.size + items.links.size;
  return { whole: items.whole || (a.kind === "review_notes" && count > 0 && held === count), items };
}

/** Whether a Review row is rendered as a page with item sections (capture-and-review §10): it was published that way (`@review`), or it is not published yet and the space has the Decided property (`notion.review_sections`, set by migration 0013 or a fresh setup). A row published the old way keeps the old layout. */
const HELD_TEXT = "Held: this rests on content you excluded from the brain, so it is not shown.";
function reviewSections(workspace: Workspace, note: Note): boolean {
  const notion = isRecord(workspace.config.notion) ? workspace.config.notion : {};
  if (note.type !== "proposal" || !Array.isArray(note.attributes.items)) return false;
  const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : {};
  // A row already published as a page stays one, whatever the flag says now; a row not yet published follows the flag.
  if (isRecord(published["@review"])) return true;
  return typeof note.attributes.notion !== "string" && notion.review_sections === true;
}

function planExisting(workspace: Workspace, asOf: string, row: SnapshotRow, note: Note, out: SyncPlan): void {
  const updates: Record<string, unknown> = { id: note.id };
  if (note.attributes.notion === undefined) updates.notion = row.page_id;
  const fields = notionFields(row.database, row.properties, asOf);
  if (Object.keys(fields).length > 1 && !isDeepStrictEqual(withoutAsOf(note.attributes.notion_fields), withoutAsOf(fields))) updates.notion_fields = fields;
  const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : undefined;
  const rendered = renderedBrainValues(publishable(workspace, note), workspace);
  const publish = (name: string, value: unknown) => { updates.published = { ...(isRecord(updates.published) ? updates.published : {}), [name]: value }; };
  const off = offRelations(workspace.config, row.database);
  for (const [name, brainField] of brainProperties(row.database)) {
    if (!Object.hasOwn(row.properties, name) || off.has(name)) continue;
    if (name === "Key Facts") { planKeyFacts(row, note, published, updates, out); continue; }
    // N, S and B are compared in Notion's normalized form (cli §5.14.1): page ids, {start,end} dates, select labels.
    // Lifecycle compares case-insensitively; a link to a note not yet in Notion counts as a brain change.
    const fold = (value: unknown) => name === "Lifecycle" && typeof value === "string" ? value.toLowerCase() : value;
    const n = fold(row.properties[name]); const s = fold(published?.[name]); const b = fold(rendered[name] ?? null);
    const brainChanged = !sameValue(b, s) || linksUnpublished(workspace, note, brainField);
    if (s === undefined) { if (sameValue(n, b) && !brainChanged) publish(name, row.properties[name]); continue; }
    if (sameValue(n, s)) continue;
    const value = brainValue(workspace, row, name, brainField, out.conflicts);
    if (value === undefined && !blank(n)) continue;
    if (name === "Lifecycle" && blank(n)) { out.conflicts.push(conflict(row, "REQUIRED_EMPTY", `${name} cannot be empty`, name, null, note.attributes.lifecycle)); continue; }
    if (name === "Lifecycle" && !LIFECYCLES.includes(String(value))) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: note.id, property: name, reason: "UNKNOWN_OPTION" }); continue; }
    if (brainChanged) { if (sameValue(n, b) && !linksUnpublished(workspace, note, brainField)) publish(name, row.properties[name]); else out.conflicts.push(conflict(row, "BOTH_CHANGED", `${name} changed in both Notion and brain`, name, value ?? null, readBrainField(note, brainField))); continue; }
    // Only Notion changed: your edit.
    if (name === "Lifecycle") { updates.lifecycle = value; continue; }
    if (!correctable(brainField)) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: note.id, property: name, reason: "NOT_CORRECTABLE" }); continue; }
    if (blank(n) && !optionalReference(brainField)) {
      if (name === "Name" || name === "Summary") out.conflicts.push(conflict(row, "REQUIRED_EMPTY", `${name} cannot be empty`, name, null, readBrainField(note, brainField)));
      else out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: note.id, property: name, reason: "FACT_REMOVAL_NOT_SUPPORTED" });
      continue;
    }
    out.corrections.push({ target: note.id, field: brainField, value: value ?? null, observed_at: row.last_edited, property: name, notion_value: value ?? null } as Correction & Record<string, unknown>);
  }
  if (Object.keys(updates).length > 1) out.updates.push(updates);
  if (row.database === "review") {
    // A proposal with item ids (0055) is read by the Review planner; one written before 0.8.0 keeps the 0045 rules (capture-and-review §7.9).
    // The layout is the one the Notion page was rendered in: a row published before the item sections existed has no `@review` record.
    if (note.type === "proposal" && Array.isArray(note.attributes.items) && isRecord(note.attributes.notion_published) && isRecord(note.attributes.notion_published["@review"])) planReviewState(workspace, asOf, row, note, out);
    else planDecision(row, note, out);
  }
}

/** Key Facts are one Notion text property but independently-owned facts (cli §5.14.2). */
function planKeyFacts(row: SnapshotRow, note: Note, published: Record<string, unknown> | undefined, updates: Record<string, unknown>, out: SyncPlan): void {
  const text = property(row.properties, "Key Facts");
  const notion = parseKeyFacts(text);
  const brainFacts = isRecord(note.attributes.facts) ? note.attributes.facts : {};
  const stored = parseKeyFacts(published?.["Key Facts"]);
  let converged = true;
  for (const [key, value] of Object.entries(notion)) {
    const n = typeof brainFacts[key] === "number" && typeof value === "string" && Number.isFinite(Number(value)) ? Number(value) : value;
    const b = brainFacts[key]; const s = stored[key];
    if (s === undefined) { if (!isDeepStrictEqual(n, b)) converged = false; continue; }
    if (isDeepStrictEqual(n, s)) continue;
    if (isDeepStrictEqual(b, s)) { out.corrections.push({ target: note.id, field: `facts.${key}`, value: n, observed_at: row.last_edited, property: `Key Facts/${key}`, notion_value: text } as Correction & Record<string, unknown>); converged = false; continue; }
    if (isDeepStrictEqual(n, b)) continue;
    out.conflicts.push(conflict(row, "BOTH_CHANGED", `Key Facts/${key} changed in both Notion and brain`, `Key Facts/${key}`, n, b)); converged = false;
  }
  for (const key of Object.keys(stored)) if (!Object.hasOwn(notion, key)) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: note.id, property: `Key Facts/${key}`, reason: "FACT_REMOVAL_NOT_SUPPORTED" }); converged = false; }
  if (converged && !sameValue(text, published?.["Key Facts"])) updates.published = { ...(isRecord(updates.published) ? updates.published : {}), "Key Facts": text };
}

/** A Review row of the new layout (cli §5.14.2, capture-and-review §7.3): the same gates as `planDecision`, then the item-level planner. */
function planReviewState(workspace: Workspace, asOf: string, row: SnapshotRow, proposal: Note, out: SyncPlan): void {
  if (property(row.properties, "State") !== "Pending") return;
  if (["applied", "closed"].includes(String(proposal.attributes.status))) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: proposal.id, reason: "ALREADY_TERMINAL" }); return; }
  // A format-2 page is read by its ref lines and decided by Your call (capture-and-review §7.12).
  if (reviewFormat(proposal) === 2) { planReviewRow2(workspace, row, row.review, proposal, asOf, out, (code, message, property) => { out.conflicts.push(conflict(row, code, message, property, property === undefined ? undefined : row.properties[property] ?? null)); }); return; }
  planReviewRow(workspace, row, row.review, proposal, asOf, out,
    (action) => { out.decisions.push({ proposal: proposal.id, action, decided_at: row.last_edited, decided_by: "notion" }); },
    (code, message) => { out.conflicts.push(conflict(row, code, message)); });
}

function planDecision(row: SnapshotRow, proposal: Note, out: SyncPlan): void {
  // A snapshot taken before migration 0009 has Decision and Note; Edit there is read as Fix (cli §5.14.2, 0045).
  const call = property(row.properties, "Your call") ?? property(row.properties, "Decision");
  const label = Object.hasOwn(row.properties, "Your call") ? "Your call" : "Decision";
  const textLabel = Object.hasOwn(row.properties, "What to fix") || !Object.hasOwn(row.properties, "Note") ? "What to fix" : "Note";
  if (call === undefined || call === null || property(row.properties, "State") !== "Pending") return;
  if (["applied", "closed"].includes(String(proposal.attributes.status))) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: proposal.id, reason: "ALREADY_TERMINAL" }); return; }
  const action = String(call).toLowerCase() === "edit" ? "fix" : String(call).toLowerCase();
  const text = property(row.properties, textLabel);
  const written = typeof text === "string" && text.trim() !== "";
  if (!["approve", "reject", "fix"].includes(action)) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: proposal.id, property: label, reason: "UNKNOWN_OPTION" }); return; }
  if (action === "fix" && !written) { out.conflicts.push(conflict(row, "FIX_WITHOUT_TEXT", "Fix needs What to fix: what to correct", "What to fix")); return; }
  if (action === "fix") { out.conflicts.push(conflict(row, "FIX_TO_READ", "What to fix needs reading by the skill", "What to fix", text, "Fix")); return; }
  if (written) { out.conflicts.push(conflict(row, "NOTE_TO_READ", "What to fix needs reading by the skill", "What to fix", text, action === "approve" ? "Approve" : "Reject")); return; }
  out.decisions.push({ proposal: proposal.id, action: action as DecisionInput["action"], decided_at: row.last_edited, decided_by: "notion" });
}

function ignoredRow(row: SnapshotRow, reason: string, propertyName?: string): Record<string, unknown> {
  const brainId = property(row.properties, "Brain ID");
  return { database: row.database, page_id: row.page_id, brain_id: typeof brainId === "string" && brainId !== "" ? brainId : null, ...(propertyName === undefined ? {} : { property: propertyName }), reason };
}

/**
 * A Report row (a Documents row since 0.9.1, an Inbox row before migration 0019; cli §5.14.1, 0071) is read only for
 * Refresh asked, What to fix and its wording (0045, 0054): nothing on it goes through the three-way comparison.
 */
function planReport(workspace: Workspace, row: SnapshotRow, note: Note, out: SyncPlan): void {
  if (!modulesOf(workspace.config).reports) { out.ignored.push(ignoredRow(row, "MODULE_OFF")); return; }
  // The report belongs to one page (cli §5.14.2): a duplicate or misassigned Brain ID on another row plans nothing.
  if (note.attributes.notion !== undefined && note.attributes.notion !== row.page_id) { out.conflicts.push(conflict(row, "NOTION_ID_MISMATCH", `Report ${note.id} belongs to another Notion page`)); return; }
  if (property(row.properties, "Refresh asked") === true || property(row.properties, "Refresh") === true) out.refresh_requests.push({ page_id: row.page_id, report: note.id });
  if (row.wording !== undefined) planWording(workspace, out.as_of, row.page_id, note, row.wording, out);
  const text = property(row.properties, "What to fix");
  const last = (Array.isArray(note.attributes.fixes) ? note.attributes.fixes : []).filter(isRecord).at(-1);
  if (typeof text === "string" && text.trim() !== "" && text !== last?.text) out.report_fixes.push({ page_id: row.page_id, report: note.id, text });
}

/** A weekly review's Documents row (weekly-review.md §2): Refresh asked and What to fix are ignored (NOT_A_REPORT), and nothing is planned. */
function planWeekly(workspace: Workspace, row: SnapshotRow, note: Note, out: SyncPlan): void {
  if (!modulesOf(workspace.config).reports) { out.ignored.push(ignoredRow(row, "MODULE_OFF")); return; }
  if (note.attributes.notion !== undefined && note.attributes.notion !== row.page_id) { out.conflicts.push(conflict(row, "NOTION_ID_MISMATCH", `Weekly review ${note.id} belongs to another Notion page`)); return; }
  if (property(row.properties, "Refresh asked") === true || property(row.properties, "Refresh") === true) out.ignored.push(ignoredRow(row, "NOT_A_REPORT", "Refresh asked"));
  const text = property(row.properties, "What to fix");
  if (typeof text === "string" && text.trim() !== "") out.ignored.push(ignoredRow(row, "NOT_A_REPORT", "What to fix"));
}

/**
 * An Inbox row is read for Document asked (0049) and, on a Report row, Refresh and What to fix
 * (0045); a Full text box is retired (cli §5.14.2).
 */
function planInbox(workspace: Workspace, row: SnapshotRow, out: SyncPlan): void {
  const modules = modulesOf(workspace.config);
  const brainId = property(row.properties, "Brain ID");
  const note = typeof brainId === "string" && brainId !== "" ? workspace.get(brainId) : undefined;
  if (Object.hasOwn(row.properties, "Full text")) out.ignored.push(ignoredRow(row, "RETIRED", "Full text"));
  // A Report row still on the Inbox: a space before migration 0019 (0071).
  if (note !== undefined && isReport(note)) planReport(workspace, row, note, out);
  // A row the brain created names its source. As for every other database (cli §5.14.2), a page the skill wrote but never
  // recorded is linked here instead of created again at the next render (CC-153); a page of another source is a mismatch.
  if (typeof brainId === "string" && brainId !== "") {
    if (note === undefined) { out.conflicts.push(conflict(row, "UNKNOWN_BRAIN_ID", `No note has Brain ID ${brainId}`)); return; }
    // Only a source that gets an Inbox row of its own (§5.14.4: every kind but minutes, not an attached file; a capture's
    // page is the one in its key, schema §4) can be linked here.
    if (note.type === "source" && note.attributes.kind !== undefined && note.attributes.kind !== "minutes" && note.attributes.kind !== "capture" && note.attributes.attached_to === undefined) {
      if (note.attributes.notion === undefined) out.updates.push({ id: note.id, notion: row.page_id });
      else if (note.attributes.notion !== row.page_id) { out.conflicts.push(conflict(row, "NOTION_ID_MISMATCH", `Source ${note.id} belongs to another Inbox page`)); return; }
    }
  }
  // An unattended run's Report row has no Brain ID and holds no report (cli §5.14.2, §6.1).
  if (typeof brainId !== "string" || brainId === "") {
    const reason = modules.reports ? "NOT_A_REPORT" : "MODULE_OFF";
    if (property(row.properties, "Refresh asked") === true || property(row.properties, "Refresh") === true) out.ignored.push(ignoredRow(row, reason, "Refresh asked"));
    const text = property(row.properties, "What to fix");
    if (typeof text === "string" && text.trim() !== "") out.ignored.push(ignoredRow(row, reason, "What to fix"));
  }
  if (property(row.properties, "Document asked") !== true) return;
  if (!modules.documents) { out.ignored.push(ignoredRow(row, "MODULE_OFF", "Document asked")); return; }
  if (typeof brainId !== "string" || brainId === "") { out.ignored.push(ignoredRow(row, "NOT_INGESTED", "Document asked")); return; }
  if (note === undefined) { out.conflicts.push(conflict(row, "UNKNOWN_BRAIN_ID", `No note has Brain ID ${brainId}`)); return; }
  if (note.type !== "source" || note.attributes.kind === undefined || note.attributes.kind === "minutes") { out.ignored.push(ignoredRow(row, "NOT_A_SOURCE", "Document asked")); return; }
  const source = latestVersion(workspace, note);
  const files = workspace.notes.filter((candidate) => candidate.type === "source" && candidate.attributes.attached_to === source.id).map((file) => file.id).sort(compareCodePoints);
  const onlyKeep = property(row.properties, "Only keep");
  const only = typeof onlyKeep === "string" && onlyKeep.trim() !== "" ? onlyKeep : null;
  const request: SyncPlan["document_requests"][number] = { page_id: row.page_id, source: source.id, files, only_keep: only };
  if (only === null) {
    const wholes = (files.length > 0 ? files : [source.id]).map((id) => wholeDocumentOf(workspace, id));
    if (wholes.every((id) => id !== undefined)) request.existing = wholes as string[];
  }
  out.document_requests.push(request);
}

/** A Promote asked box on a decision row (cli §5.14.2, 0049). */
function planPromote(workspace: Workspace, row: SnapshotRow, note: Note, documentsOn: boolean, out: SyncPlan): void {
  if (!documentsOn) { out.ignored.push(ignoredRow(row, "MODULE_OFF", "Promote asked")); return; }
  // Only reviewed knowledge is promoted (0071): the box stays ticked until the note is approved.
  if (note.attributes.lifecycle !== "reviewed" && note.attributes.lifecycle !== "disputed") { out.ignored.push(ignoredRow(row, "NOT_REVIEWED", "Promote asked")); return; }
  const existing = workspace.notes.find((candidate) => candidate.type === "reference" && candidate.attributes.origin === "promoted" && candidate.attributes.promoted_from === note.id);
  out.promote_requests.push({ page_id: row.page_id, note: note.id, ...(existing === undefined ? {} : { existing: existing.id }) });
}

/** The latest version of a source, following `replaces` forward (schema §4, 0045). */
function latestVersion(workspace: Workspace, note: Note): Note {
  let current = note;
  const seen = new Set([note.id]);
  for (;;) {
    const next = workspace.notes.find((candidate) => candidate.type === "source" && candidate.attributes.replaces === current.id);
    if (next === undefined || seen.has(next.id)) return current;
    seen.add(next.id);
    current = next;
  }
}

function wholeDocumentOf(workspace: Workspace, source: string): string | undefined {
  return workspace.notes.find((note) => note.type === "reference" && note.attributes.origin === "whole" && Array.isArray(note.attributes.sources) && note.attributes.sources[0] === source)?.id;
}

/** A source whose Inbox row the brain writes: not minutes, a capture or an attached file (0042, 0043). */
export function hasInboxBody(note: Note): boolean {
  const kind = note.attributes.kind;
  return note.type === "source" && kind !== undefined && kind !== "minutes" && kind !== "capture" && note.attributes.attached_to === undefined;
}

function planKeyResult(workspace: Workspace, asOf: string, row: SnapshotRow, out: SyncPlan): void {
  const goals = relationIds(workspace, property(row.properties, "Goal"), out.conflicts, row, "Goal");
  const goal = goals?.[0];
  if (goal === undefined) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: null, reason: "UNKNOWN_GOAL" }); return; }
  const note = workspace.get(goal); if (note === undefined) return;
  const values = isRecord(note.attributes.notion_fields) ? { ...note.attributes.notion_fields } : {};
  const existing = Array.isArray(values.key_results) ? values.key_results.filter(isRecord) : [];
  const current = { page_id: row.page_id, name: property(row.properties, "Name") ?? null, ...row.properties };
  const keyResults: Array<Record<string, unknown>> = [...existing.filter((item) => item.page_id !== row.page_id), current as Record<string, unknown>];
  values.key_results = keyResults.sort((a, b) => String(a["Name"] ?? a.name).localeCompare(String(b["Name"] ?? b.name)) || String(a.page_id).localeCompare(String(b.page_id)));
  values.as_of = asOf;
  if (!isDeepStrictEqual(withoutAsOf(note.attributes.notion_fields), withoutAsOf(values))) out.updates.push({ id: goal, notion_fields: values });
}

function sortPlan(plan: SyncPlan): void {
  const order = (item: Record<string, unknown>) => [String(DATABASES.indexOf(String(item.database) as typeof DATABASES[number])).padStart(2, "0"), String(item.page_id ?? item.id), String(item.field ?? item.property ?? "")].join("\u0000");
  for (const values of [plan.create, plan.updates, plan.corrections, plan.decisions, plan.document_requests, plan.promote_requests, plan.refresh_requests, plan.report_fixes, plan.accepted_wording, plan.wording_waiting, plan.wording_held, plan.clear_accepted, plan.conflicts, plan.ignored]) values.sort((a, b) => order(a as Record<string, unknown>).localeCompare(order(b as Record<string, unknown>)));
}

function notionFields(database: string, p: Record<string, unknown>, asOf: string): Record<string, unknown> {
  const mapping: Record<string, Record<string, string>> = { domains: { Type: "type", Archived: "archived" }, areas: { Archived: "archived" }, goals: { Status: "status", Progress: "progress", Archived: "archived" }, projects: { Status: "status", Priority: "priority", Dates: "dates", Archived: "archived" }, people: { Email: "email" }, orgs: { Relationship: "relationship", Website: "website", Archived: "archived" }, questions: { Status: "status" } };
  const fields: Record<string, unknown> = { as_of: asOf };
  for (const [name, key] of Object.entries(mapping[database] ?? {})) if (Object.hasOwn(p, name) && p[name] !== null) fields[key] = p[name];
  return fields;
}

function brainProperties(database: string): Array<[string, string]> {
  const common: Array<[string, string]> = [["Name", "title"], ["Summary", "summary"], ...(NO_LIFECYCLE_PROPERTY.has(TYPE_FOR_DATABASE[database] ?? "") ? [] : [["Lifecycle", "lifecycle"] as [string, string]])];
  const extras: Record<string, Array<[string, string]>> = { areas: [["Domain", "domain"]], domains: [["Org", "org"]], goals: [["Why", "why"], ["Deadline", "facts.deadline"], ["Area", "area"]], projects: [["Key Facts", "facts"], ["Area", "area"], ["Goal", "goal"], ["Client", "client"], ["People", "people"]], people: [["Role", "facts.role"], ["Org", "org"]], decisions: [["Assessment", "assessment"], ["Project", "projects"], ["Area", "derived_area"]], questions: [["Kind", "kind"], ["Project", "projects"], ["Area", "derived_area"]], documents: [["Project", "reference_projects"], ["Area", "reference_area"]] };
  return [...common, ...(extras[database] ?? [])];
}

function convertedValue(workspace: Workspace, row: SnapshotRow, name: string, value: unknown, conflicts: Array<Record<string, unknown>>): unknown {
  if (name === "Lifecycle") return normalizeLifecycle(value);
  if (name === "Deadline") return dateValue(value);
  if (["Domain", "Area", "Goal", "Client", "Org", "People"].includes(name)) return relationIds(workspace, value, conflicts, row, name);
  if (name === "Key Facts") return parseKeyFacts(value);
  return value;
}

/** A Notion value in the brain's form: brain ids for relations (one id for single references), YYYY-MM-DD dates, lowercase lifecycle. */
function brainValue(workspace: Workspace, row: SnapshotRow, name: string, brainField: string, conflicts: Array<Record<string, unknown>>): unknown {
  const value = convertedValue(workspace, row, name, row.properties[name], conflicts);
  return Array.isArray(value) && ["domain", "area", "goal", "client", "org"].includes(brainField) ? value[0] ?? null : value;
}

/** True when a relation field links a note that has no Notion page yet: render leaves it out, so B alone would hide it. */
function linksUnpublished(workspace: Workspace, note: Note, brainField: string): boolean {
  if (!["domain", "area", "goal", "client", "org", "people"].includes(brainField)) return false;
  const raw = note.attributes[brainField]; const ids = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return ids.some((id) => typeof workspace.get(String(id))?.attributes.notion !== "string");
}

/** Equal in Notion's normalized form; relations compare as sets, and an empty text equals null. */
/** Relation properties left out while their module is off (cli §5.14.4, 0048), per database. */
function offRelations(config: Record<string, unknown>, database: string): Set<string> {
  const on = modulesOf(config);
  const off = new Set<string>();
  if (!on.domains && database === "areas") off.add("Domain");
  if (!on.orgs && database === "domains") off.add("Org");
  if (!on.orgs && database === "projects") off.add("Client");
  if (!on.orgs && database === "people") off.add("Org");
  if (!on.planning && database === "projects") off.add("Goal");
  if (!on.knowledge && (database === "inbox" || database === "meetings")) { off.add("Decisions"); off.add("Questions"); }
  if (!on.documents && database === "inbox") off.add("Documents");
  return off;
}

/** Brain values that were renamed (0048, 0049): an S of the old one compares equal to the new one. */
const RENAMED_VALUES: Record<string, Record<string, string>> = { "Brain Status": { Processed: "Done" }, Kind: { Document: "File" } };

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (value: unknown) => Array.isArray(value) ? [...value].map(String).sort(compareCodePoints) : value === "" || value === undefined ? null : value;
  return isDeepStrictEqual(norm(a), norm(b));
}

function readBrainField(note: Note, field: string): unknown {
  if (field === "facts") return note.attributes.facts ?? {};
  if (field.startsWith("facts.")) return isRecord(note.attributes.facts) ? note.attributes.facts[field.slice(6)] ?? null : null;
  return note.attributes[field] ?? null;
}
function correctable(field: string): boolean { return ["title", "summary", "why", "domain", "area", "goal", "client", "org", "people"].includes(field) || field.startsWith("facts."); }
function optionalReference(field: string): boolean { return ["domain", "goal", "client", "org"].includes(field); }
const LIFECYCLES = ["draft", "reviewed", "disputed", "archived"];
function normalizeLifecycle(value: unknown): unknown { return typeof value === "string" ? value.toLowerCase() : value; }
function dateValue(value: unknown): unknown { return isRecord(value) && typeof value.start === "string" ? value.start.slice(0, 10) : value; }
function blank(value: unknown): boolean { return value === undefined || value === null || value === ""; }
function withoutAsOf(value: unknown): unknown { if (!isRecord(value)) return value ?? {}; const { as_of: _asOf, ...rest } = value; return rest; }
function isTimestamp(value: unknown): value is string { return normalizeTimestamp(value) !== undefined; }

export function parseKeyFacts(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || value === "") return {};
  const result: Record<string, unknown> = {};
  for (const segment of value.split(" · ")) { const separator = segment.indexOf(": "); if (separator > 0) result[segment.slice(0, separator).toLowerCase().replaceAll(" ", "_")] = segment.slice(separator + 2); }
  return result;
}

/** Input validation and execution for `sync apply`. */
export function parsePlan(input: unknown): SyncPlan {
  if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object" }]);
  const p = input as Record<string, unknown>; const problems = unknownKeys(p, ["as_of", "create", "updates", "corrections", "decisions", "document_requests", "promote_requests", "refresh_requests", "report_fixes", "accepted_wording", "wording_waiting", "wording_held", "clear_accepted", "review_pending", "review_decisions", "review_held", "review_revisions", "review_row_revisions", "review_untouched", "conflicts", "ignored"], "");
  for (const key of ["document_requests", "promote_requests", "refresh_requests", "report_fixes", "accepted_wording", "wording_waiting", "wording_held", "clear_accepted", "review_pending", "review_decisions", "review_held", "review_revisions", "review_row_revisions", "review_untouched"]) if (p[key] !== undefined && !Array.isArray(p[key])) problems.push({ pointer: `/${key}`, message: "must be a list" });
  if (!isTimestamp(p.as_of)) problems.push({ pointer: "/as_of", message: "must be an ISO 8601 UTC timestamp" });
  for (const key of ["create", "updates", "corrections", "decisions", "conflicts", "ignored"]) if (!Array.isArray(p[key])) problems.push({ pointer: `/${key}`, message: "must be a list" });
  (Array.isArray(p.review_pending) ? p.review_pending : []).forEach((item, index) => { if (!isRecord(item) || typeof item.proposal !== "string" || typeof item.page_id !== "string") problems.push({ pointer: `/review_pending/${index}`, message: "must be { proposal, page_id }" }); });
  (Array.isArray(p.review_decisions) ? p.review_decisions : []).forEach((item, index) => {
    const at = `/review_decisions/${index}`;
    if (!isRecord(item) || typeof item.proposal !== "string" || typeof item.page_id !== "string" || !isTimestamp(item.decided_at) || !Array.isArray(item.items)) { problems.push({ pointer: at, message: "must be { proposal, page_id, decided_at, items }" }); return; }
    if ((item.format !== undefined && item.format !== 2) || (item.call !== undefined && item.call !== "approve" && item.call !== "reject")) problems.push({ pointer: at, message: "format must be 2 and call approve or reject" });
    (item.items as unknown[]).forEach((entry, position) => {
      const hex = (value: unknown) => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
      const wording = isRecord(entry) && entry.decision === "accept";
      if (!isRecord(entry) || typeof entry.item_id !== "string" || !["accept", "reject", "defer", "stale"].includes(String(entry.decision)) || !hex(entry.proposed_hash) || !hex(entry.snapshot_hash) || !hex(entry.base_hash) || (wording && (typeof entry.proposed !== "string" || entry.proposed.trim() === ""))) problems.push({ pointer: `${at}/items/${position}`, message: "must be { item_id, decision, proposed_hash, snapshot_hash, base_hash } with the final wording for an accept" });
      else if ((entry.values !== undefined && (!Array.isArray(entry.values) || !entry.values.every((value) => Number.isInteger(value) && (value as number) >= 0))) || (entry.agreed !== undefined && typeof entry.agreed !== "string")) problems.push({ pointer: `${at}/items/${position}`, message: "values must be a list of link indexes and agreed a string" });
      else if (entry.verified !== undefined && (!isRecord(entry.verified) || !hex(entry.verified.snapshot_hash) || !hex(entry.verified.proposed_hash))) problems.push({ pointer: `${at}/items/${position}/verified`, message: "must be { snapshot_hash, proposed_hash }" });
    });
  });
  (Array.isArray(p.review_untouched) ? p.review_untouched : []).forEach((item, index) => { if (!isRecord(item) || typeof item.proposal !== "string" || typeof item.page_id !== "string") problems.push({ pointer: `/review_untouched/${index}`, message: "must be { proposal, page_id }" }); });
  (Array.isArray(p.review_row_revisions) ? p.review_row_revisions : []).forEach((item, index) => { if (!isRecord(item) || typeof item.proposal !== "string" || typeof item.page_id !== "string" || typeof item.instruction !== "string") problems.push({ pointer: `/review_row_revisions/${index}`, message: "must be { proposal, page_id, instruction }" }); });
  for (const key of ["review_held", "review_revisions"]) (Array.isArray(p[key]) ? p[key] as unknown[] : []).forEach((item, index) => { if (!isRecord(item) || typeof item.proposal !== "string" || typeof item.page_id !== "string" || (key === "review_revisions" && typeof item.item_id !== "string") || (key === "review_held" && typeof item.reason !== "string")) problems.push({ pointer: `/${key}/${index}`, message: "has the wrong shape" }); });
  (Array.isArray(p.create) ? p.create : []).forEach((item, index) => {
    if (!isRecord(item)) { problems.push({ pointer: `/create/${index}`, message: "must be an object" }); return; }
    problems.push(...unknownKeys(item, ["type", "id", "title", "file_date", "frontmatter", "body", "lifecycle"], `/create/${index}`));
    const { lifecycle: _lifecycle, ...note } = item;
    problems.push(...checkNoteInput(note, `/create/${index}`));
    if (item.lifecycle !== undefined && typeof item.lifecycle !== "string") problems.push({ pointer: `/create/${index}/lifecycle`, message: "must be a lifecycle string" });
  });
  // The wording lists are executed or echoed, so their items must have the specified shape (cli §5.14.7).
  const textKeys: Record<string, string[]> = { accepted_wording: ["page_id", "kind", "note", "fingerprint", "markdown", "base"], wording_waiting: ["page_id", "note", "reason"], wording_held: ["page_id", "note", "reason"], clear_accepted: ["page_id", "note", "accepted_at", "page_edited_at", "fingerprint"] };
  for (const [key, required] of Object.entries(textKeys)) (Array.isArray(p[key]) ? p[key] as unknown[] : []).forEach((item, index) => {
    const at = `/${key}/${index}`;
    if (!isRecord(item)) { problems.push({ pointer: at, message: "must be an object" }); return; }
    for (const name of required) if (typeof item[name] !== "string" || item[name] === "") problems.push({ pointer: `${at}/${name}`, message: "must be a non-empty string" });
    if (key === "accepted_wording") {
      if (item.kind !== "document" && item.kind !== "report") problems.push({ pointer: `${at}/kind`, message: "must be document or report" });
      for (const name of ["accepted_at", "page_edited_at"]) if (!isTimestamp(item[name])) problems.push({ pointer: `${at}/${name}`, message: "must be an ISO 8601 UTC timestamp" });
      if (typeof item.unattended_ok !== "boolean") problems.push({ pointer: `${at}/unattended_ok`, message: "must be true or false" });
      if (!isRecord(item.diff) || typeof item.diff.added !== "number" || typeof item.diff.removed !== "number") problems.push({ pointer: `${at}/diff`, message: "must be { added, removed }" });
    }
    if ((key === "wording_waiting" || key === "wording_held") && item.accepted !== undefined && typeof item.accepted !== "boolean") problems.push({ pointer: `${at}/accepted`, message: "must be true or false" });
    if (key === "clear_accepted") for (const name of ["accepted_at", "page_edited_at"]) if (!isTimestamp(item[name])) problems.push({ pointer: `${at}/${name}`, message: "must be an ISO 8601 UTC timestamp" });
    if (key === "accepted_wording" && item.verified !== undefined && (!isRecord(item.verified) || typeof item.verified.fingerprint !== "string" || typeof item.verified.page_edited_at !== "string")) problems.push({ pointer: `${at}/verified`, message: "must be { fingerprint, page_edited_at }" });
  });
  assertNoProblems(problems);
  return { ...p, document_requests: p.document_requests ?? [], promote_requests: p.promote_requests ?? [], refresh_requests: p.refresh_requests ?? [], report_fixes: p.report_fixes ?? [], accepted_wording: p.accepted_wording ?? [], wording_waiting: p.wording_waiting ?? [], wording_held: p.wording_held ?? [], clear_accepted: p.clear_accepted ?? [], review_pending: p.review_pending ?? [], review_decisions: p.review_decisions ?? [], review_held: p.review_held ?? [], review_revisions: p.review_revisions ?? [], review_row_revisions: p.review_row_revisions ?? [], review_untouched: p.review_untouched ?? [], as_of: normalizeTimestamp(p.as_of)! } as unknown as SyncPlan;
}

export function applyPlan(workspace: Workspace, input: SyncPlan, now: Date, recordOnly: boolean, skipConflicted = false): Record<string, unknown> {
  const create: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const dependencyFailures = new Set<string>();
  // --skip-conflicted (cli §5.14.3, 0051): a row with a conflict is skipped whole, and so is a create that depends on a skipped one.
  const conflictedIds = new Set(skipConflicted ? input.conflicts.map((item) => item.brain_id).filter((id): id is string => typeof id === "string") : []);
  const conflictedPages = new Set(skipConflicted ? input.conflicts.map((item) => item.page_id) : []);
  // The skip closure is computed before any create runs, so a dependent create is skipped whatever its place in the plan.
  // It is by position in the plan, so a create that names no id of its own (cli §5.5) is covered too; only an id can be referred to.
  const skippedAt = new Set<number>();
  if (skipConflicted) {
    const skippedIds = new Set<string>();
    const skip = (index: number) => { skippedAt.add(index); const id = input.create[index]!.id; if (id !== undefined) skippedIds.add(id); };
    input.create.forEach((item, index) => { const page = isRecord(item.frontmatter) ? item.frontmatter.notion : undefined; if ((item.id !== undefined && conflictedIds.has(item.id)) || (typeof page === "string" && conflictedPages.has(page))) skip(index); });
    for (let grew = true; grew;) { grew = false; input.create.forEach((item, index) => { if (!skippedAt.has(index) && relationsOf(item.frontmatter).some((id) => skippedIds.has(id))) { skip(index); grew = true; } }); }
  }
  const rowSkipped = { result: "skipped", reason: "ROW_CONFLICTED", changed: [] as string[] };
  const plan: SyncPlan = { ...input, updates: [], corrections: [], decisions: [] };
  const skippedUpdates: Array<Record<string, unknown>> = []; const skippedCorrections: Array<Record<string, unknown>> = []; const skippedDecisions: Array<Record<string, unknown>> = [];
  for (const update of input.updates) if (conflictedIds.has(String(update.id))) skippedUpdates.push({ id: update.id, ...rowSkipped }); else plan.updates.push(update);
  for (const correction of input.corrections) if (conflictedIds.has(correction.target)) skippedCorrections.push({ target: correction.target, field: correction.field, ...rowSkipped }); else plan.corrections.push(correction);
  for (const decision of input.decisions) if (conflictedIds.has(decision.proposal)) skippedDecisions.push({ proposal: decision.proposal, action: decision.action, ...rowSkipped }); else plan.decisions.push(decision);
  // Creates run in relation order (cli §5.14.3): the create a relation names first. Results stay in the plan's order.
  const { order, stuck, cyclic } = relationOrder(plan.create);
  for (const index of [...order, ...stuck]) {
    const item = plan.create[index]!; const checkpoint = workspace.checkpoint();
    if (skippedAt.has(index)) { create[index] = { id: item.id, ...rowSkipped }; continue; }
    if (stuck.includes(index)) { if (item.id !== undefined) dependencyFailures.add(item.id); create[index] = { id: item.id, result: "failed", reason: cyclic.has(index) ? "RELATION_CYCLE" : "DEPENDENCY_FAILED", changed: [] }; continue; }
    try {
      if (item.id !== undefined && workspace.get(item.id) !== undefined) throw new Error("ID_IN_USE");
      const depends = relationsOf(item.frontmatter).some((id) => dependencyFailures.has(id));
      if (depends) throw new Error("DEPENDENCY_FAILED");
      const staged = stageNotes(workspace, [item], () => `/create/${index}`, { now, lifecycle: String((item as unknown as Record<string, unknown>).lifecycle ?? "draft") });
      assertStagedValid(workspace, staged.pointers);
      create[index] = { id: staged.created[0]!.id, result: "applied", changed: staged.created.map((note) => note.path) };
    } catch (error) { workspace.restore(checkpoint); const reason = error instanceof Error && error.message === "DEPENDENCY_FAILED" ? "DEPENDENCY_FAILED" : error instanceof Error && error.message === "ID_IN_USE" ? "ID_IN_USE" : "INVALID_RESULT"; if (item.id !== undefined) dependencyFailures.add(item.id); create[index] = { id: item.id, result: "failed", reason, changed: [] }; }
  }
  for (const update of plan.updates) {
    const checkpoint = workspace.checkpoint(); const id = String(update.id); const note = workspace.get(id);
    if (note === undefined) { updates.push({ id, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; }
    try { const doc = workspace.edit(note); for (const key of ["notion", "lifecycle", "notion_fields"]) if (Object.hasOwn(update, key)) doc.attributes[key] = update[key]; if (isRecord(update.published)) doc.attributes.notion_published = { ...(isRecord(doc.attributes.notion_published) ? doc.attributes.notion_published : {}), ...update.published }; workspace.save(note.path, doc); const errors = workspace.newErrors(); if (errors.length > 0) throw new Error("INVALID_RESULT"); updates.push({ id, result: "applied", changed: workspace.changedSince(checkpoint) }); } catch { workspace.restore(checkpoint); updates.push({ id, result: "failed", reason: "INVALID_RESULT", changed: [] }); }
  }
  const correctionApply = recordOnly ? undefined : applyAll(workspace, { corrections: plan.corrections, decisions: [] }, { now, recordOnly: false });
  const corrections = recordOnly ? plan.corrections.map((item) => ({ target: item.target, field: item.field, result: "skipped", reason: "RECORD_ONLY", changed: [] })) : correctionApply!.corrections;
  const decisionApply = applyAll(workspace, { corrections: [], decisions: plan.decisions }, { now, recordOnly });
  const decisionResult = decisionApply.decisions;
  for (const correction of corrections) if (correction.result === "applied") { const note = workspace.get(correction.target); const input = plan.corrections.find((item) => item.target === correction.target && item.field === correction.field); if (note !== undefined && input !== undefined && "property" in input) { const doc = workspace.edit(note); doc.attributes.notion_published = { ...(isRecord(doc.attributes.notion_published) ? doc.attributes.notion_published : {}), [String((input as unknown as Record<string, unknown>).property)]: (input as unknown as Record<string, unknown>).notion_value }; workspace.save(note.path, doc); } }
  // Review decisions of the new layout (capture-and-review §7.5 to §7.7), item by item, after the 0045 decisions and before wording.
  const reviewable = plan.review_decisions.filter((item) => !conflictedIds.has(item.proposal) && !conflictedPages.has(item.page_id));
  const reviewSkipped = plan.review_decisions.filter((item) => !reviewable.includes(item)).flatMap((item) => item.items.map((entry) => ({ proposal: item.proposal, item_id: entry.item_id, decision: entry.decision, result: "skipped", reason: "ROW_CONFLICTED" })));
  const review = recordOnly ? { results: reviewable.flatMap((item) => item.items.map((entry) => ({ proposal: item.proposal, item_id: entry.item_id, decision: entry.decision, result: "skipped", reason: "RECORD_ONLY" }))), log: [] as LogEntry[] } : applyReviewDecisions(workspace, reviewable, now);
  // A Request revision the plan read is recorded; the item stays pending (capture-and-review §7.8). Unattended runs never put one in the plan.
  const revisions = recordOnly ? [] : recordRevisionRequests(workspace, plan.review_revisions.filter((item) => !conflictedIds.has(item.proposal) && !conflictedPages.has(item.page_id)), plan.as_of, now, formatDate(now));
  const wording = applyWording(workspace, plan.accepted_wording, now, recordOnly, conflictedIds, conflictedPages);
  const log: LogEntry[] = [
    ...create.filter((item) => item.result === "applied").map((item) => ({ op: "sync-create", id: String(item.id), title: String(workspace.get(String(item.id))?.attributes.title ?? item.id) })),
    ...updates.filter((item) => item.result === "applied").map((item) => ({ op: "sync-update", id: String(item.id), title: String(workspace.get(String(item.id))?.attributes.title ?? item.id) })),
    ...(correctionApply?.log ?? []), ...(decisionApply.log ?? []), ...review.log,
    ...wording.log,
  ];
  updates.push(...skippedUpdates);
  const correctionsOut = [...corrections, ...skippedCorrections] as Array<Record<string, unknown>>; const decisionsOut = [...decisionResult, ...skippedDecisions] as Array<Record<string, unknown>>;
  // A format-2 row whose Your call this run consumed: the skill empties Your call and What to fix (capture-and-review §7.12.7). A Request revision is
  // consumed only when the attended skill's per-item revisions were all recorded; an unattended run adds none, so the row is left as it is (0051).
  const reviewClear: Array<{ proposal: string; page_id: string; properties: string[] }> = [];
  if (!recordOnly) {
    for (const item of reviewable) if (item.format === 2 && item.call !== undefined) reviewClear.push({ proposal: item.proposal, page_id: item.page_id, properties: ["Your call", "What to fix"] });
    for (const row of plan.review_row_revisions) {
      if (conflictedIds.has(row.proposal) || conflictedPages.has(row.page_id) || reviewClear.some((entry) => entry.page_id === row.page_id)) continue;
      const mine = revisions.filter((entry) => entry.proposal === row.proposal);
      if (mine.length > 0 && mine.every((entry) => entry.result === "recorded" || entry.reason === "ALREADY_REQUESTED")) reviewClear.push({ proposal: row.proposal, page_id: row.page_id, properties: ["Your call", "What to fix"] });
    }
  }
  return { create, updates, corrections: correctionsOut, decisions: decisionsOut, notion_writes: decisionApply.notion_writes, review_results: [...review.results, ...reviewSkipped], revision_results: revisions, review_clear: reviewClear, document_requests: plan.document_requests, promote_requests: plan.promote_requests, refresh_requests: plan.refresh_requests, report_fixes: plan.report_fixes, accepted_wording: wording.results, wording_waiting: plan.wording_waiting, wording_held: plan.wording_held, clear_accepted: plan.clear_accepted.filter((item) => !conflictedIds.has(item.note) && !conflictedPages.has(item.page_id) && !updates.some((update) => update.id === item.note && update.result === "failed") && workspace.get(item.note) !== undefined), conflicts: plan.conflicts, ignored: plan.ignored, summary: summarize([...create, ...wording.results, ...updates, ...correctionsOut, ...decisionsOut, ...review.results, ...reviewSkipped].map((item) => ({ ...item }))), log };
}

/**
 * Step 4 of `sync apply` (cli §5.14.3, §5.14.7, 0054): imports each verified accepted Document or report text exactly.
 * An item without a matching `verified` fingerprint, or whose Git body moved since the plan, writes nothing.
 */
function applyWording(workspace: Workspace, items: readonly AcceptedWording[], now: Date, recordOnly: boolean, conflictedIds: ReadonlySet<string>, conflictedPages: ReadonlySet<unknown>): { results: Array<Record<string, unknown>>; log: LogEntry[] } {
  const results: Array<Record<string, unknown>> = []; const log: LogEntry[] = [];
  for (const item of items) {
    const head = { id: item.note, page_id: item.page_id };
    if (recordOnly) { results.push({ ...head, result: "skipped", reason: "RECORD_ONLY", changed: [] }); continue; }
    if (conflictedIds.has(item.note) || conflictedPages.has(item.page_id)) { results.push({ ...head, result: "skipped", reason: "ROW_CONFLICTED", changed: [] }); continue; }
    const note = workspace.get(item.note);
    const fail = (reason: string) => results.push({ ...head, result: "failed", reason, changed: [] });
    if (note === undefined) { fail("UNKNOWN_ID"); continue; }
    if ((item.kind === "report") !== isReport(note) || (item.kind === "document" && !wordingDocument(note))) { fail("KIND_MISMATCH"); continue; }
    if (note.attributes.notion !== undefined && note.attributes.notion !== item.page_id) { fail("NOTION_ID_MISMATCH"); continue; }
    if (item.verified === undefined || item.verified.fingerprint !== item.fingerprint || item.verified.page_edited_at !== item.page_edited_at || item.fingerprint !== textHash(item.markdown)) { fail("UNVERIFIED"); continue; }
    if (textHash(gitBodyOf(note)) !== item.base) { fail("GIT_CHANGED"); continue; }
    if (item.kind === "report" && (!hasReportShape(item.markdown) || reportLinks(workspace, item.markdown, true).broken.length > 0)) { fail("INVALID_REPORT_SHAPE"); continue; }
    const checkpoint = workspace.checkpoint();
    try {
      const doc = workspace.edit(note);
      doc.body = `\n${item.markdown}`;
      const a = doc.attributes;
      const source = `notion:${item.page_id}`;
      // A report is a view, which declares no `sources`; its `notion` already names the page. Only a Document records the page it was accepted from.
      const sources = Array.isArray(a.sources) ? a.sources : [];
      if (item.kind === "document" && !sources.includes(source)) a.sources = [...sources, source];
      if (item.kind === "report") a.generated_from = reportLinks(workspace, item.markdown, true).linked.sort(compareCodePoints);
      a.updated = formatDate(now);
      workspace.save(note.path, doc);
      const edited = workspace.get(note.id)!;
      a.notion_published = { ...(isRecord(a.notion_published) ? a.notion_published : {}), "@notion_body": item.fingerprint, "@git_body": item.fingerprint, "@content": renderedContent(edited, workspace).hash ?? item.fingerprint };
      workspace.save(note.path, doc);
      const errors = workspace.newErrors(); if (errors.length > 0) throw new Error("INVALID_RESULT");
      results.push({ ...head, result: "applied", changed: workspace.changedSince(checkpoint) });
      log.push({ op: "sync-wording", id: note.id, title: String(a.title ?? note.id) });
    } catch { workspace.restore(checkpoint); fail("INVALID_RESULT"); }
  }
  return { results, log };
}

/** A record's `@`-prefixed key with a null value removes that key: an invalidated body baseline (cli §5.14.6, 0054). A null on an ordinary property is a real empty baseline and stays. */
function withClearedBaselines(merged: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const cleared = new Set(Object.entries(incoming).filter(([key, value]) => key.startsWith("@") && value === null).map(([key]) => key));
  return Object.fromEntries(Object.entries(merged).filter(([key]) => !cleared.has(key)));
}

/** The ids a create references (cli §5.14.3): free text such as a summary never counts. */
function relationsOf(frontmatter: unknown): string[] { return isRecord(frontmatter) ? referencedIds(frontmatter) : []; }

/**
 * The order creates run in (cli §5.14.3): each after the creates whose ids its relations name, otherwise in plan order.
 * `stuck` are the creates that never become ready, in plan order: those on a cycle (`cyclic`) and those that depend on one.
 * A create naming its own id is no cycle.
 */
function relationOrder(creates: readonly SyncPlan["create"][number][]): { order: number[]; stuck: number[]; cyclic: Set<number> } {
  const byId = new Map<string, number[]>();
  creates.forEach((item, index) => { if (item.id !== undefined) byId.set(item.id, [...(byId.get(item.id) ?? []), index]); });
  const needs = creates.map((item, index) => new Set(relationsOf(item.frontmatter).flatMap((id) => byId.get(id) ?? []).filter((other) => other !== index)));
  const order: number[] = []; const done = new Set<number>();
  for (;;) {
    const next = needs.findIndex((deps, index) => !done.has(index) && [...deps].every((dep) => done.has(dep)));
    if (next === -1) break;
    order.push(next); done.add(next);
  }
  const stuck = needs.map((_, index) => index).filter((index) => !done.has(index));
  const reaches = (from: number, target: number, seen: Set<number>): boolean => [...needs[from]!].some((dep) => dep === target || (!done.has(dep) && !seen.has(dep) && (seen.add(dep), reaches(dep, target, seen))));
  return { order, stuck, cyclic: new Set(stuck.filter((index) => reaches(index, index, new Set()))) };
}
function summarize(items: readonly Record<string, unknown>[]): Record<string, number> { const result: Record<string, number> = { applied: 0, closed: 0, recorded: 0, awaiting_notion: 0, corrected: 0, skipped: 0, failed: 0 }; for (const item of items) if (typeof item.result === "string" && Object.hasOwn(result, item.result)) result[item.result] += 1; return result; }

export interface RenderItem { template?: { type: "default" }; item_updates?: Array<{ item_id: string; reason: string; section: string }>; review_published_after?: Record<string, unknown>; id: string; type: string; database: string; database_id: string; page_id: string | null; action: "create" | "update" | "trash" | "rebuild"; replaces?: string; properties: Record<string, unknown>; body: string | null; sections: Record<string, string> | null; pending_relations: Array<Record<string, unknown>>; published: Record<string, unknown> }

/** The types whose page waits for review (cli §5.14.4, 0071). */
const REVIEWED_PAGE_TYPES = new Set(["decision", "question", "concept", "reference"]);
/** A decision, question, concept or Document with no page that isn't reviewed yet: render never publishes it (0071). */
function awaitsReview(note: Note | undefined): boolean {
  return note !== undefined && REVIEWED_PAGE_TYPES.has(note.type) && typeof note.attributes.notion !== "string" && note.attributes.lifecycle !== "reviewed" && note.attributes.lifecycle !== "disputed";
}

/** `sync render --unpublish-drafts` (cli §5.14.4, migration 0020): the Draft pages from before 0.9.1 that a pending Review row can bring back. */
export function unpublishDrafts(workspace: Workspace, now: Date): RenderItem[] {
  const held = new Set(workspace.notes.filter((note) => note.type === "proposal" && note.attributes.kind === "review_notes" && note.attributes.status === "pending").flatMap((note) => Array.isArray(note.attributes.notes) ? note.attributes.notes.map(String) : []));
  const items: RenderItem[] = [];
  for (const note of workspace.notes) {
    const a = note.attributes; const database = DATABASE_FOR_TYPE[note.type];
    if (!REVIEWED_PAGE_TYPES.has(note.type) || database === undefined || typeof a.notion !== "string" || a.lifecycle !== "draft" || !held.has(note.id)) continue;
    // A promoted Document's page is yours (0049); a page already trashed is never rendered again.
    if (a.origin === "promoted" || (isRecord(a.notion_published) && a.notion_published["@trashed"] !== undefined) || !typeIsOn(workspace.config, note.type)) continue;
    const databaseId = databaseIdFor(workspace, database); if (databaseId === "") continue;
    items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: a.notion, action: "trash", properties: {}, body: null, sections: null, pending_relations: [], published: { "@trashed": formatTimestamp(now) } });
  }
  return items.sort((a, b) => DATABASES.indexOf(a.database as never) - DATABASES.indexOf(b.database as never) || compareCodePoints(a.id, b.id));
}

/** What a plan tells the render about Review rows (cli §5.14.4, format 2): the untouched format-1 rows to rebuild once, and each pending item a plan held, with its reason in words. */
export interface ReviewRenderOptions { rebuild?: ReadonlySet<string>; holds?: ReadonlyMap<string, ReadonlyMap<string, string>> }

export function render(workspace: Workspace, now: Date, ids?: readonly string[], held?: ReadonlyMap<string, Set<string>>, reviewOptions: ReviewRenderOptions = {}): { items: RenderItem[]; errors: Array<Record<string, unknown>>; warnings: Array<{ code: string; message: string; id?: string }>; skipped: Array<{ id: string; reason: string }> } {
  const selected = ids === undefined
    ? workspace.notes.filter((note) => (PUBLISHED_TYPES.has(note.type) && !(note.type === "source" && note.attributes.kind === undefined)) || isReport(note) || isWeekly(note))
    : ids.map((id) => workspace.get(id)!).filter(Boolean);
  const items: RenderItem[] = []; const errors: Array<Record<string, unknown>> = []; const warnings: Array<{ code: string; message: string; id?: string }> = []; const skipped: Array<{ id: string; reason: string }> = [];
  const waiting: RenderItem[] = [];
  const modules = modulesOf(workspace.config);
  for (const note of selected) {
    const database = isReport(note) || isWeekly(note) ? "documents" : DATABASE_FOR_TYPE[note.type]; if (database === undefined || (note.type === "source" && note.attributes.kind === undefined)) continue;
    // A note of a module that is off isn't published; naming one is an error (0048).
    if (((isReport(note) || isWeekly(note)) && !modules.reports) || !typeIsOn(workspace.config, note.type)) { if (ids !== undefined) errors.push({ id: note.id, reason: "MODULE_OFF" }); continue; }
    // An attached source has no Inbox row: its notes go on the parent's (0042).
    if (note.type === "source" && note.attributes.attached_to !== undefined) continue;
    // A decided Review row leaves Notion 30 days after its decision, once (0045).
    if (note.type === "proposal" && isRecord(note.attributes.notion_published) && note.attributes.notion_published["@trashed"] !== undefined) continue;
    // Notion shows reviewed knowledge (0071): a draft lives only in its Review row, and a rejected one never gets a page.
    if (awaitsReview(note)) { if (ids !== undefined) skipped.push({ id: note.id, reason: "NOT_REVIEWED" }); continue; }
    // A change Ultimate Assistant made after a yes in chat never becomes a Review row (assistant.md §6.2).
    if (decidedInChat(note)) { if (ids !== undefined) skipped.push({ id: note.id, reason: "DECIDED_IN_CHAT" }); continue; }
    const databaseId = databaseIdFor(workspace, database); if (databaseId === "") { warnings.push({ code: "DATABASE_NOT_CONFIGURED", message: `${database} database is not configured`, id: note.id }); continue; }
    if (note.type === "proposal" && trashDue(note, now)) { items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: String(note.attributes.notion), action: "trash", properties: {}, body: null, sections: null, pending_relations: [], published: { "@trashed": formatTimestamp(now) } }); continue; }
    if (note.type === "meeting" && typeof note.attributes.notion !== "string") { errors.push({ id: note.id, reason: "MEETING_NOT_PUBLISHED" }); continue; }
    const capturePage = note.type === "source" && note.attributes.kind === "capture" && typeof note.attributes.source_key === "string" && note.attributes.source_key.startsWith("notion:") ? note.attributes.source_key.slice("notion:".length) : undefined;
    if (note.type === "source" && note.attributes.kind === "capture" && (capturePage === undefined || (typeof note.attributes.notion === "string" && note.attributes.notion !== capturePage))) { errors.push({ id: note.id, reason: "NOTION_ID_MISMATCH" }); continue; }
    const form = publishable(workspace, note);
    const rendered = renderedBrainValues(form, workspace); const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : {};
    for (const name of offRelations(workspace.config, database)) delete rendered[name];
    const properties: Record<string, unknown> = {}; const pending: Array<Record<string, unknown>> = []; const heldProperties = held?.get(note.id) ?? new Set<string>();
    const isCreate = note.attributes.notion === undefined && capturePage === undefined;
    // The one rebuild of an untouched format-1 Review row as a new format-2 page (capture-and-review §7.12.1): every property and the body, as a create.
    const rebuild = !isCreate && note.type === "proposal" && reviewOptions.rebuild?.has(note.id) === true && note.attributes.status === "pending" && reviewSections(workspace, note) && reviewFormat(note) === 1 && !isRecord(note.attributes.cleanup) && !(isRecord(workspace.config.notion) && workspace.config.notion.review_format === 1);
    // A report last published on the Inbox (no Origin in S) was moved to Documents by migration 0019: every property goes out once (cli §5.14.4, 0071).
    const moved = isReport(note) && !isCreate && !Object.hasOwn(published, "Origin");
    for (const [name, value] of Object.entries(rendered)) { if (name === "@content" || heldProperties.has(name) || (capturePage !== undefined && name === "Name")) continue; const encoded = notionProperty(name, value, note, workspace, pending); if (encoded !== undefined && (isCreate || rebuild || moved || !Object.hasOwn(published, name) || !sameValue(value, RENAMED_VALUES[name]?.[String(published[name])] ?? published[name]))) properties[name] = encoded; }
    const content = renderedContent(form, workspace); if (content.hash !== undefined) rendered["@content"] = content.hash;
    // A Review row with item ids (0055): its body is written once, at create. Afterwards only the brain-owned summary at the top is sent;
    // the item sections belong to the user (capture-and-review §7.4, §7.10), and the hashes of what was rendered are kept in S.
    let itemUpdates: Array<{ item_id: string; reason: string; section: string }> = [];
    let publishedAfter: Record<string, unknown> | undefined;
    if (reviewSections(workspace, note)) {
      const format = rebuild ? 2 : reviewFormat(note, workspace.config);
      const review = renderReview(note, workspace, (row) => String(reviewRowName(workspace, row)), format, reviewOptions.holds?.get(note.id));
      const writesBody = isCreate || rebuild;
      const tag = format === 2 ? { format: 2 } : {};
      content.body = writesBody ? review.body : null; content.sections = format === 2 ? { "Review summary": review.summary, [CONTEXT_HEADING]: review.context ?? "" } : { "Review summary": review.summary }; content.hash = review.summary_hash; rendered["@content"] = review.summary_hash;
      const kept = !rebuild && isRecord(published["@review"]) && isRecord(published["@review"].items) ? published["@review"].items : undefined;
      // Only a render that writes the body records what was rendered; a published row with no record has none, and is never given one here.
      if (writesBody) rendered["@review"] = { ...tag, items: Object.fromEntries(review.items.map((item) => [item.item_id, { rendered_hash: item.rendered_hash, proposed_hash: item.proposed_hash, base_hash: item.base_hash, ...(item.held ? { held: true } : {}) }])) };
      else if (kept !== undefined) {
        rendered["@review"] = { ...tag, items: kept };
        // Item sections the user must see something in (capture-and-review §7.4 b): a drafted revision or a changed base. An applied or closed status is never written into one.
        const decided = new Set((Array.isArray(note.attributes.item_decisions) ? note.attributes.item_decisions : []).filter(isRecord).map((entry) => String(entry.item_id)));
        // A row decided the 0045 way (applied or closed with no item decisions, e.g. approved from chat) has no pending item (#196).
        if (note.attributes.status === "applied" || note.attributes.status === "closed") for (const item of review.items) decided.add(item.item_id);
        const after: Record<string, unknown> = { ...kept };
        for (const item of review.items) {
          const stored = isRecord(kept[item.item_id]) ? kept[item.item_id] as Record<string, unknown> : undefined;
          if (stored === undefined || decided.has(item.item_id) || stored.rendered_hash === item.rendered_hash) continue;
          const drafted = (Array.isArray(note.attributes.revisions) ? note.attributes.revisions : []).filter(isRecord).some((entry) => entry.item_id === item.item_id && entry.status === "drafted");
          // A section that now names a note by type and id is rewritten too, held or not (cli §5.14.4, "Restricted notes"); the label stays after the cleanup.
          const reason = item.held ? (item.title_withheld ? "title_withheld" : undefined)
            : drafted ? "revision_drafted" : stored.base_hash !== item.current_base_hash ? "base_changed" : item.title_withheld ? "title_withheld" : undefined;
          if (reason === undefined) continue;
          itemUpdates.push({ item_id: item.item_id, reason, section: item.section });
          after[item.item_id] = { rendered_hash: item.rendered_hash, proposed_hash: item.proposed_hash, ...(reason === "title_withheld" ? { base_hash: stored.base_hash, ...(item.held || stored.held === true ? { held: true } : {}) } : { base_hash: item.current_base_hash }) };
        }
        if (itemUpdates.length > 0) publishedAfter = { "@review": { ...tag, items: after } };
      }
    }
    // A promoted Document's body is yours once its page exists (0049): sent on create only.
    if (note.type === "reference" && note.attributes.origin === "promoted" && !isCreate) { content.body = null; delete rendered["@content"]; if (Object.hasOwn(published, "@content")) rendered["@content"] = published["@content"]; content.hash = undefined; }
    const contentChanged = content.hash !== undefined && !isDeepStrictEqual(content.hash, published["@content"]);
    // The Git body at this publish, the SG baseline of cli §5.14.7 (the skill adds @notion_body after it re-reads the page).
    // A workflow Document's body is the brain's, as a report's: each publish of it sets the baseline (connected-workflows.md §6.3).
    // A withheld report's notice is no refresh: it sets no baseline and leaves Refresh asked as you ticked it (cli §5.14.4, "Restricted notes").
    const noticeOnly = publishState(workspace).withheld.has(note.id);
    if ((note.type === "reference" && note.attributes.origin === "promoted" && isCreate) || ((isReport(note) || (note.type === "reference" && note.attributes.origin === "workflow")) && (isCreate || contentChanged) && !noticeOnly)) rendered["@git_body"] = textHash(gitBodyOf(note));
    // A report (0045): a refresh sends the body once and clears Refresh; a new fix clears What to fix.
    let reportDue = false;
    if (isReport(note)) {
      const fixes = Array.isArray(note.attributes.fixes) ? note.attributes.fixes.length : 0;
      const stored = typeof published["@fixes"] === "number" ? published["@fixes"] : 0;
      if (!isCreate && contentChanged && !noticeOnly) properties["Refresh asked"] = { type: "checkbox", value: false };
      if (!isCreate && !contentChanged) content.body = null;
      if (fixes > stored) { properties["What to fix"] = { type: "rich_text", value: null }; reportDue = true; }
      rendered["@fixes"] = Math.max(fixes, stored);
    }
    // A weekly review's body goes out when it changed: a rerun, or its Review rows got pages since (weekly-review.md §3.4).
    if (isWeekly(note) && !isCreate && !contentChanged) content.body = null;
    // Full text (0043) is retired (0049): nothing is sent, and `@full_text` in S stays as it is.
    if (!isCreate && !rebuild && Object.keys(properties).length === 0 && !contentChanged && !reportDue && itemUpdates.length === 0) {
      // A page whose only news is a relation to a note this render creates: nothing to write, but the skill renders again after publishing it (0071).
      if (pending.length > 0) waiting.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: typeof note.attributes.notion === "string" ? note.attributes.notion : capturePage ?? null, action: "update", properties: {}, body: null, sections: null, pending_relations: pending, published: rendered });
      continue;
    }
    if (rebuild) { items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: null, action: "rebuild", replaces: String(note.attributes.notion), properties, body: content.body, sections: content.sections, pending_relations: pending, published: rendered }); continue; }
    if (!isCreate && note.type !== "meeting" && note.type !== "proposal") properties["Last Synced"] = { type: "date", value: { start: formatTimestamp(now), end: null } };
    // A new project's page comes from the space's default Projects template, its toggles, views and My notes (0068).
    items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: typeof note.attributes.notion === "string" ? note.attributes.notion : capturePage ?? null, action: isCreate ? "create" : "update", ...(isCreate && note.type === "project" ? { template: { type: "default" as const } } : {}), ...(itemUpdates.length === 0 ? {} : { item_updates: itemUpdates, review_published_after: publishedAfter }), properties, body: content.body, sections: content.sections, pending_relations: pending, published: rendered });
  }
  // Kept only when this render creates one of the notes it waits for; otherwise the relation fills at a later render.
  const creates = new Set(items.filter((item) => item.action === "create").map((item) => item.id));
  items.push(...waiting.filter((item) => item.pending_relations.some((entry) => Array.isArray(entry.ids) && entry.ids.some((id) => creates.has(String(id))))));
  items.sort((a, b) => DATABASES.concat(["meetings"] as never[]).indexOf(a.database as never) - DATABASES.concat(["meetings"] as never[]).indexOf(b.database as never) || compareCodePoints(a.id, b.id));
  return { items, errors, warnings, skipped };
}

const TRASH_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** A published Review row whose proposal was applied or closed more than 30 days before `now` (0045). */
function trashDue(note: Note, now: Date): boolean {
  const a = note.attributes;
  if (typeof a.notion !== "string" || (a.status !== "applied" && a.status !== "closed")) return false;
  const decided = isRecord(a.decision) && typeof a.decision.decided_at === "string" ? a.decision.decided_at : a.updated;
  const time = typeof decided === "string" ? Date.parse(decided) : Number.NaN;
  return Number.isFinite(time) && now.getTime() - time > TRASH_AFTER_MS;
}
function databaseIdFor(workspace: Workspace, database: string): string { return databaseId(workspace.config, database); }
/** Documents · Origin (schema §14, decision 0071): a reference's `origin` (absent = `part`) and a report view (`report`). */
const ORIGIN_LABEL: Readonly<Record<string, string>> = { whole: "Kept", part: "Kept", learned: "Learned", promoted: "Promoted", workflow: "Workflow", report: "Report" };
function renderedBrainValues(note: Note, workspace: Workspace): Record<string, unknown> {
  const a = note.attributes; const values: Record<string, unknown> = {};
  const common = () => {
    const name = titleWithheld(note) ? citeLabel(note) : a.title;
    if (!NO_LIFECYCLE_PROPERTY.has(note.type)) return Object.assign(values, { Name: name, Summary: a.summary ?? null, Lifecycle: select(a.lifecycle), "Brain ID": note.id });
    Object.assign(values, { Name: name, Summary: a.summary ?? null, "Brain ID": note.id });
    // A note the brain retired (a merge or a supersession) ticks Archived once; Archived stays yours afterwards (0070).
    if (a.lifecycle === "archived" && !(isRecord(a.notion_fields) && a.notion_fields.archived === true)) values.Archived = true;
    return values;
  };
  if (note.type === "proposal") {
    const target = typeof a.target === "string" ? workspace.get(a.target) : undefined;
    const addLink = a.kind === "add_link";
    const held = proposalHeld(workspace, note);
    const after = addLink
      ? proposalLinks(a).map((link) => `${fieldLabel(String(link.field))}: ${noteTitle(link.value, workspace)}`).join("\n")
      : a.kind === "review_notes" ? reviewNotesAfter(a, workspace, held.items) : a.kind === "update_body" ? bodyChange(a, workspace)?.join("\n") ?? null : undefined;
    // A body diff can only be shown while the target's body is the one proposed against; then S keeps it (0045).
    const proposed = staleBody(a, workspace) && isRecord(a.notion_published) && Object.hasOwn(a.notion_published, "Proposed") ? a.notion_published.Proposed : undefined;
    const reviewText = (value: unknown) => truncate(typeof value === "string" ? reviewMarkdown(value, target) : value);
    // A Suggestion row (0072, cli §5.14.4): Ultimate Assistant's notion_change or set_field, shown in the proposal's own Area, with no Source Meeting.
    if (a.kind === "notion_change" || a.kind === "set_field") {
      const text = suggestionText(a, workspace, (shown) => shownTitle(workspace, shown));
      Object.assign(values, { Name: held.whole ? `Held: ${note.id}` : text.name, Kind: select(a.kind), About: text.about, "About Page": text.aboutPage, Now: held.whole ? HELD_TEXT : truncate(text.now), Proposed: held.whole ? HELD_TEXT : truncate(text.proposed), Why: held.whole ? HELD_TEXT : reviewText(a.why), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), State: select(proposalState(a.status)), "Brain ID": note.id });
      return values;
    }
    // A Review notes row names its source: the meeting for minutes, else the source (0041).
    const source = a.kind === "review_notes" && typeof a.source === "string" ? workspace.get(a.source) : undefined;
    const targetText = source !== undefined ? `${String(shownTitle(workspace, source))} (${source.id})` : target === undefined ? null : `${String(shownTitle(workspace, target))} (${target.id})`;
    const page = (source ?? target)?.attributes.notion;
    const meeting = typeof a.source === "string" ? workspace.get(a.source) : undefined;
    Object.assign(values, {
      Name: reviewRowName(workspace, note, held.whole), Kind: select(a.kind), About: targetText,
      "About Page": typeof page === "string" ? `https://www.notion.so/${page.replaceAll("-", "")}` : null,
      "Source Meeting": meeting?.type === "meeting" && typeof meeting.attributes.notion === "string" ? [meeting.attributes.notion] : [],
      Now: held.whole ? HELD_TEXT : reviewText(proposalBefore(a, workspace)), Proposed: held.whole ? HELD_TEXT : proposed !== undefined ? proposed : reviewText(after ?? proposalAfter(a, workspace)),
      Why: held.whole ? HELD_TEXT : reviewText(a.why), Area: relationPages(reviewArea(a, workspace), workspace), State: select(proposalState(a.status)), "Brain ID": note.id,
    });
    // A row with item sections leaves About, Now, Proposed and Why empty, held or not: its page holds them and Notion hides them (0088, cli §5.14.4).
    if (reviewSections(workspace, note)) Object.assign(values, { About: null, Now: null, Proposed: null, Why: null });
    return values;
  }
  // A weekly review is a Documents row with Origin Report (weekly-review.md §2): its name, Origin and Brain ID, nothing else.
  if (isWeekly(note)) { Object.assign(values, { Name: a.title, Origin: ORIGIN_LABEL.report, "Brain ID": note.id }); return values; }
  // A report is a Documents row since 0.9.1 (0071); its Ask rows stay on the Inbox and link back through Asked in.
  if (isReport(note)) { Object.assign(values, { Name: a.title, Origin: ORIGIN_LABEL.report, Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), "Asked in": typeof a.asked_in === "string" ? [a.asked_in] : Array.isArray(a.asked_in) ? a.asked_in : [], "Brain ID": note.id }); return values; }
  if (note.type === "meeting") { Object.assign(values, { Decisions: relationPages(a.decisions, workspace), Questions: relationPages(a.questions, workspace), Attendees: relationPages(a.attendees, workspace), Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), "Brain Status": "Ingested", "Ingested At": dateOutput(a.created), "Brain ID": note.id }); return values; }
  if (note.type === "source") return sourceValues(note, workspace);
  common();
  if (note.type === "area") Object.assign(values, { Domain: relationPages(a.domain === undefined ? [] : [a.domain], workspace) });
  if (note.type === "domain") Object.assign(values, { Org: relationPages(a.org === undefined ? [] : [a.org], workspace) });
  if (note.type === "goal") Object.assign(values, { Why: a.why ?? null, Deadline: dateOutput(isRecord(a.facts) ? a.facts.deadline : undefined), Area: relationPages(a.area === undefined ? [] : [a.area], workspace) });
  if (note.type === "project") Object.assign(values, { "Key Facts": keyFactsText(a.facts, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), Goal: relationPages(a.goal === undefined ? [] : [a.goal], workspace), Client: relationPages(a.client === undefined ? [] : [a.client], workspace), People: relationPages(a.people, workspace) });
  if (note.type === "person") Object.assign(values, { Role: isRecord(a.facts) ? a.facts.role ?? null : null, Org: relationPages(a.org === undefined ? [] : [a.org], workspace) });
  if (note.type === "decision") Object.assign(values, { Date: dateOutput(a.date), Assessment: select(a.assessment), Area: relationPages(projectAreas(a.projects, workspace), workspace), Project: relationPages(a.projects, workspace), "Decided In": relationPages(a.decided_in === undefined ? [] : [a.decided_in], workspace), Supersedes: relationPages((Array.isArray(a.relations) ? a.relations.filter(isRecord).filter((x) => x.type === "supersedes").map((x) => x.target) : []), workspace) });
  if (note.type === "question") Object.assign(values, { Kind: select(a.kind), Area: relationPages(projectAreas(a.projects, workspace), workspace), Project: relationPages(a.projects, workspace), "Raised In": relationPages(a.raised_in === undefined ? [] : [a.raised_in], workspace) });
  // Status goes out once as Open while you never set one, once as Answered after an approved answer, and once as Dropped after
  // the to-do tidy dropped it; it stays yours otherwise (0041, 0045, 0071).
  if (note.type === "question") {
    const published = isRecord(a.notion_published) ? a.notion_published : {};
    const yours = isRecord(a.notion_fields) && a.notion_fields.status !== undefined;
    if (a.answer !== undefined) { if (published.Status !== "Answered") values.Status = "Answered"; }
    else if (a.dropped !== undefined) { if (published.Status !== "Dropped" && !(isRecord(a.notion_fields) && a.notion_fields.status === "Dropped")) values.Status = "Dropped"; }
    else if (published.Status === undefined && !yours) values.Status = "Open";
  }
  if (note.type === "reference") {
    // From concept is retired with Concepts (0071): a Document promoted from a concept before 0.9.1 has no From relation.
    const from = a.origin === "promoted" && typeof a.promoted_from === "string" ? a.promoted_from : undefined;
    Object.assign(values, { Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), Origin: ORIGIN_LABEL[String(a.origin ?? "part")] ?? null, "From decision": relationPages(from?.startsWith("dec-") ? [from] : [], workspace) });
  }
  return values;
}

/** A Review row's Name: `Held: <id>` when the row is held whole, else its title (with a Conflict or Answer lead); a Review summary names a deferred item's row by it (cli §5.14.4). */
function reviewRowName(workspace: Workspace, note: Note, whole = proposalHeld(workspace, note).whole): unknown {
  return whole ? `Held: ${note.id}` : reviewName(note.attributes);
}
/** A Review row's Name says which kind of row it is (cli §5.14.4, 0048). */
function reviewName(a: Record<string, unknown>): unknown {
  const prefix = ["contradiction", "supersede", "merge", "new_item"].includes(String(a.kind)) ? "Conflict: " : a.kind === "answer" ? "Answer: " : "";
  return typeof a.title === "string" && prefix !== "" && !a.title.startsWith(prefix) ? `${prefix}${a.title}` : a.title;
}

/** A Review row's one area: its source note's own area, else the area of its first project (cli §5.14.4, 0050). */
function reviewArea(a: Record<string, unknown>, workspace: Workspace): string[] {
  const source = typeof a.source === "string" ? workspace.get(a.source) : undefined;
  if (source === undefined) return [];
  if (typeof source.attributes.area === "string") return [source.attributes.area];
  const first = Array.isArray(source.attributes.projects) ? source.attributes.projects[0] : undefined;
  const area = typeof first === "string" ? workspace.get(first)?.attributes.area : undefined;
  return typeof area === "string" ? [area] : [];
}

/** Area on decisions and questions is a derived Notion relation (decision 0034). */
function projectAreas(projects: unknown, workspace: Workspace): string[] {
  const areas = (Array.isArray(projects) ? projects : []).flatMap((project) => {
    const area = workspace.get(String(project))?.attributes.area;
    return typeof area === "string" ? [area] : [];
  });
  return [...new Set(areas)].sort(compareCodePoints);
}

/** The notes a source produced, with those of the sources attached to it (cli §5.14.4, 0042). */
function producedBy(note: Note, workspace: Workspace): Note[] {
  const sources = new Set([note.id, ...workspace.notes.filter((candidate) => candidate.type === "source" && candidate.attributes.attached_to === note.id).map((candidate) => candidate.id)]);
  // A promoted Document comes from its note, not the source (0049).
  return workspace.notes.filter((candidate) => ["decision", "question", "reference", "person"].includes(candidate.type) && !(candidate.type === "reference" && candidate.attributes.origin === "promoted") && Array.isArray(candidate.attributes.sources) && candidate.attributes.sources.some((id) => sources.has(String(id))));
}

function sourceValues(note: Note, workspace: Workspace): Record<string, unknown> {
  const produced = producedBy(note, workspace);
  const ids = (type: string) => produced.filter((candidate) => candidate.type === type).map((candidate) => candidate.id).sort(compareCodePoints);
  const projects = [...new Set(produced.flatMap((candidate) => Array.isArray(candidate.attributes.projects) ? candidate.attributes.projects.filter((id): id is string => typeof id === "string") : []))].sort(compareCodePoints);
  const areas = [...new Set([...produced.map((candidate) => candidate.attributes.area).filter((id): id is string => typeof id === "string"), ...projects.flatMap((id) => { const area = workspace.get(id)?.attributes.area; return typeof area === "string" ? [area] : []; })])].sort(compareCodePoints);
  return { Name: note.attributes.title, Kind: note.attributes.kind === "document" ? "File" : select(note.attributes.kind), Summary: note.attributes.summary ?? null, Decisions: relationPages(ids("decision"), workspace), Questions: relationPages(ids("question"), workspace), ...(databaseIdFor(workspace, "documents") === "" ? {} : { Documents: relationPages(ids("reference"), workspace) }), People: relationPages(ids("person"), workspace), Project: relationPages(projects, workspace), Area: relationPages(areas, workspace), "Brain Status": "Done", "Brain ID": note.id };
}

function notionProperty(name: string, value: unknown, note: Note, workspace: Workspace, pending: Array<Record<string, unknown>>): unknown {
  const relation = ["Domain", "Area", "Goal", "Client", "People", "Org", "Project", "Decided In", "Raised In", "Supersedes", "Decisions", "Questions", "Documents", "Attendees", "From decision"].includes(name);
  if (relation) {
    const sourceField: Record<string, string> = { Domain: "domain", Area: "area", Goal: "goal", Client: "client", People: "people", Org: "org", Project: "projects", "Decided In": "decided_in", "Raised In": "raised_in", Decisions: "decisions", Questions: "questions", Attendees: "attendees" };
    const raw = name === "Area" && note.type === "proposal" ? reviewArea(note.attributes, workspace)
      : name === "From decision" ? (Array.isArray(value) && note.attributes.promoted_from !== undefined && String(note.attributes.promoted_from).startsWith("dec-") ? [note.attributes.promoted_from] : [])
      : name === "Area" && (note.type === "decision" || note.type === "question") ? projectAreas(note.attributes.projects, workspace) : name === "Supersedes" ? (Array.isArray(note.attributes.relations) ? note.attributes.relations.filter(isRecord).filter((item) => item.type === "supersedes").map((item) => item.target) : []) : note.type === "source" ? sourceRelationIds(note, name, workspace) : note.attributes[sourceField[name] ?? ""];
    // A note waiting for review isn't pending: no render publishes it, and the relation fills once it is approved (0071).
    const missing = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).map(String).filter((id) => typeof workspace.get(id)?.attributes.notion !== "string" && !awaitsReview(workspace.get(id)));
    if (missing.length > 0) pending.push({ property: name, ids: missing });
    const mode = (note.type === "meeting" || note.type === "source") ? (["Project", "Area"].includes(name) ? "if_empty" : note.type === "meeting" ? "add" : undefined) : undefined;
    return { type: "relation", value: Array.isArray(value) ? value : [], ...(mode === undefined ? {} : { mode }) };
  }
  if (name === "Source Meeting") {
    const meeting = typeof note.attributes.source === "string" ? workspace.get(note.attributes.source) : undefined;
    if (meeting?.type === "meeting" && typeof meeting.attributes.notion !== "string") pending.push({ property: name, ids: [meeting.id] });
    return { type: "relation", value: Array.isArray(value) ? value : [] };
  }
  // A report's Ask rows: Notion page ids, not notes (0071; Ask on the Inbox before 0.9.1).
  if (name === "Asked in" || name === "Ask") return { type: "relation", value: Array.isArray(value) ? value : [] };
  if (name === "About Page") return { type: "url", value };
  // An Inbox row's Kind is written only when empty in Notion, so a Kind you chose stands (0048).
  if (name === "Kind" && note.type === "source") return { type: "select", value, mode: "if_empty" };
  if (["Lifecycle", "Assessment", "Kind", "State", "Brain Status", "Status", "Origin"].includes(name)) return { type: "select", value };
  if (name === "Archived") return { type: "checkbox", value };
  if (name === "Last Synced" || name === "Date" || name === "Deadline" || name === "Ingested At") return { type: "date", value };
  return { type: name === "Name" ? "title" : "rich_text", value };
}
function sourceRelationIds(note: Note, name: string, workspace: Workspace): string[] {
  const produced = producedBy(note, workspace);
  if (name === "Decisions") return produced.filter((candidate) => candidate.type === "decision").map((candidate) => candidate.id);
  if (name === "Questions") return produced.filter((candidate) => candidate.type === "question").map((candidate) => candidate.id);
  if (name === "Documents") return produced.filter((candidate) => candidate.type === "reference").map((candidate) => candidate.id);
  if (name === "People") return produced.filter((candidate) => candidate.type === "person").map((candidate) => candidate.id);
  const projects = [...new Set(produced.flatMap((candidate) => Array.isArray(candidate.attributes.projects) ? candidate.attributes.projects.filter((id): id is string => typeof id === "string") : []))];
  if (name === "Project") return projects;
  if (name === "Area") return [...new Set([...produced.map((candidate) => candidate.attributes.area).filter((id): id is string => typeof id === "string"), ...projects.flatMap((id) => { const area = workspace.get(id)?.attributes.area; return typeof area === "string" ? [area] : []; })])];
  return [];
}
function proposalLinks(attributes: Record<string, unknown>): Array<{ field: unknown; value: unknown }> {
  if (Array.isArray(attributes.links)) return attributes.links.filter(isRecord).map((link) => ({ field: link.field, value: link.value }));
  return attributes.field === undefined ? [] : [{ field: attributes.field, value: attributes.after }];
}
function renderedContent(note: Note, workspace: Workspace): { body: string | null; sections: Record<string, string> | null; hash?: string } {
  // A Brief or Decision log the derived-content rule withholds is a notice in its section (cli §5.14.4, "Restricted notes").
  // In a section, a draft links nowhere even with a page from before 0.9.1: Notion shows reviewed knowledge only (cli §5.14.4 `sections`, 0071, CC-261).
  const section = (view: Note | undefined, base: Note): string => view !== undefined && publishState(workspace).withheld.has(view.id) ? WITHHELD_VIEW : notionMarkdown(generatedBlock(view?.body ?? ""), base, workspace, { draftsUnlinked: true });
  if (note.type === "area") { const brief = workspace.notes.find((x) => x.type === "view" && x.attributes.view_kind === "area_brief" && x.attributes.area === note.id); if (brief === undefined) return { body: null, sections: null }; const sections = { Brief: section(brief, brief) }; return { body: null, sections, hash: hash(JSON.stringify(sections)) }; }
  // A source's digest is written once (0043).
  if (note.type === "source") { if (!hasInboxBody(note)) return { body: null, sections: null }; const body = digestBody(note); return { body, sections: null, hash: hash(body) }; }
  if (isReport(note)) { const body = notionMarkdown(note.body.replace(/^\n+/, ""), note, workspace); return { body, sections: null, hash: hash(body) }; }
  if (isWeekly(note)) { const body = weeklyMarkdown(note, workspace); return { body, sections: null, hash: hash(body) }; }
  // A whole Document's links are read against its file's repo (0091).
  if (note.type === "reference" && note.attributes.origin === "whole") { const body = wholeDocumentMarkdown(note, workspace.notes, (id) => workspace.get(id)); return { body, sections: null, hash: hash(body) }; }
  if (note.type === "decision" || note.type === "question" || note.type === "reference") { const body = notionMarkdown(note.body, note, workspace); return { body, sections: null, hash: hash(body) }; } if (note.type === "project") { const brief = workspace.notes.find((x) => x.path === `${note.path.slice(0, note.path.lastIndexOf("/"))}/brief.md`); const log = workspace.notes.find((x) => x.path === `${note.path.slice(0, note.path.lastIndexOf("/"))}/decision-log.md`); const sections = { Brief: section(brief, note), "Decision log": section(log, note) }; return { body: null, sections, hash: hash(JSON.stringify(sections)) }; } return { body: null, sections: null }; }
function generatedBlock(body: string): string { const start = body.indexOf("<!-- @generated:start -->"); const end = body.indexOf("<!-- @generated:end -->"); return start >= 0 && end > start ? body.slice(start + "<!-- @generated:start -->".length, end).trim() : body.trim(); }
/** Types that get a Notion page only once reviewed (0071); a draft person keeps its page. */
const REVIEWED_ONLY_TYPES = new Set(["decision", "question", "reference"]);
function notionMarkdown(body: string, source: Note, workspace: Workspace, options: { draftsUnlinked?: boolean } = {}): string { const fromFolder = source.path.includes("/") ? source.path.slice(0, source.path.lastIndexOf("/")) : ""; return body.replace(/\^\[(inferred|ambiguous)\]/g, (_, kind) => kind === "inferred" ? " (AI inference)" : " (ambiguous)").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, title, link) => { const targetPath = normalizeRelative(fromFolder, link); const target = workspace.notes.find((note) => note.path === targetPath); return typeof target?.attributes.notion === "string" && !(options.draftsUnlinked === true && target.attributes.lifecycle === "draft" && REVIEWED_ONLY_TYPES.has(target.type)) ? `[${title}](https://www.notion.so/${target.attributes.notion.replaceAll("-", "")})` : title; }); }
function reviewMarkdown(body: string, target: Note | undefined): string {
  const fromFolder = target?.path.includes("/") ? target.path.slice(0, target.path.lastIndexOf("/")) : "";
  return body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, title, link) => {
    normalizeRelative(fromFolder, link);
    return title;
  });
}
function normalizeRelative(folder: string, link: string): string { const parts = `${folder}/${link}`.split("/"); const out: string[] = []; for (const part of parts) { if (part === "" || part === ".") continue; if (part === "..") out.pop(); else out.push(part); } return out.join("/"); }
function hash(value: string): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function relationPages(value: unknown, workspace: Workspace): string[] { return publishedPages(value, workspace); }
function select(value: unknown): unknown { return typeof value === "string" ? value.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") : value ?? null; }
function proposalState(value: unknown): unknown { return ["pending", "approved", "edited", "rejected"].includes(String(value)) ? "Pending" : String(value) === "applied" ? "Applied" : String(value) === "closed" ? "Closed" : value; }
function dateOutput(value: unknown): unknown { return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? { start: `${value}-01`, end: null } : typeof value === "string" ? { start: value, end: null } : null; }
function keyFactsText(value: unknown, workspace: Workspace): string { if (!isRecord(value)) return ""; return Object.keys(value).sort(compareCodePoints).map((key) => `${key[0]!.toUpperCase()}${key.slice(1).replaceAll("_", " ")}: ${personTitle(value[key], workspace)}`).join(" · "); }
function personTitle(value: unknown, workspace: Workspace): unknown { return typeof value === "string" && workspace.get(value)?.type === "person" ? shownTitle(workspace, workspace.get(value)!) : value; }
function noteTitle(value: unknown, workspace: Workspace): unknown { const note = typeof value === "string" ? workspace.get(value) : undefined; return note !== undefined ? shownTitle(workspace, note) ?? value : value ?? null; }
function fieldLabel(field: string): string { return field[0]?.toUpperCase() + field.slice(1).replaceAll("_", " "); }
function truncate(value: unknown): unknown { return typeof value === "string" ? value.slice(0, 2000) : value; }
/** The lettered lines of a Review notes row: its changes, then its notes, then its links (cli §5.14.4, 0045). */
function reviewNotesAfter(attributes: Record<string, unknown>, workspace: Workspace, held?: Withheld): string {
  const HELD_LINE = "Held: this rests on content you excluded from the brain";
  const changes = (Array.isArray(attributes.changes) ? attributes.changes.filter(isRecord) : []).map((change, index) => {
    if (held?.changes.has(index) === true) return HELD_LINE;
    const target = String(noteTitle(change.target, workspace));
    if (change.kind === "update_fact") return `⚠ ${fieldLabel(String(change.field))} on ${target}: ${change.before === undefined ? "(new)" : String(noteTitle(change.before, workspace))} → ${String(noteTitle(change.after, workspace))}`;
    if (change.kind === "update_body") return `⚠ ${target}: ${bodyChange(change, workspace)?.length ?? 0} lines changed`;
    if (change.kind === "replace_line") return `⚠ ${target}: 1 line changed`;
    return `Add to ${target}: ${String(change.content ?? "").split("\n")[0]!.slice(0, 80)}`;
  });
  const notes = (Array.isArray(attributes.notes) ? attributes.notes : []).map((id) => {
    if (held?.notes.has(String(id)) === true) return HELD_LINE;
    const note = workspace.get(String(id));
    return `${note === undefined ? "Note" : fieldLabel(note.type)}: ${String(noteTitle(id, workspace))}`;
  });
  const links = (Array.isArray(attributes.links) ? attributes.links.filter(isRecord) : []).map((link, index) =>
    held?.links.has(index) === true ? HELD_LINE : `${fieldLabel(String(link.field))} on ${String(noteTitle(link.target, workspace))}: ${String(noteTitle(link.value, workspace))}`);
  return [...changes, ...notes, ...links].map((line, index) => `${letters(index)}) ${line}`).join("\n");
}

/** The changed lines an update_body proposes against its target's body (cli §5.19), or undefined once that body changed. */
function bodyChange(change: Record<string, unknown>, workspace: Workspace): string[] | undefined {
  const target = typeof change.target === "string" ? workspace.get(change.target) : undefined;
  if (target === undefined || bodyHash(target.body) !== change.before_hash) return undefined;
  return lineDiff(target.body, bodyOf(String(change.content ?? "")));
}

/** Whether a proposal holds an update_body or a replace_line whose target's body is no longer the one it was proposed against. */
function staleBody(attributes: Record<string, unknown>, workspace: Workspace): boolean {
  const kinds = ["update_body", "replace_line"];
  const bodies = kinds.includes(String(attributes.kind)) ? [attributes] : (Array.isArray(attributes.changes) ? attributes.changes.filter(isRecord) : []).filter((change) => kinds.includes(String(change.kind)));
  return bodies.some((change) => change.kind === "replace_line" ? bodyHash(workspace.get(String(change.target))?.body ?? "") !== change.before_hash : bodyChange(change, workspace) === undefined);
}

/** a, b, … z, then aa, ab, … */
export function letters(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : `${letters(Math.floor(index / 26) - 1)}${letters(index % 26)}`;
}

function isReport(note: Note): boolean { return note.type === "view" && note.attributes.view_kind === "report"; }
function isWeekly(note: Note): boolean { return note.type === "view" && note.attributes.view_kind === "weekly_review"; }
/**
 * A weekly review in Notion (weekly-review.md §3.4): a link to a proposal becomes its Review row's link, or the plain text `Review row (after the next
 * publish)` while it has no page; a task's page URL stays; a link to a note with a page becomes that page; anything else keeps its text.
 */
function weeklyMarkdown(note: Note, workspace: Workspace): string {
  return note.body.replace(/^\n+/, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (all, title: string, link: string) => {
    if (/^https:\/\//.test(link)) return all;
    const target = workspace.notes.find((candidate) => candidate.path === normalizeRelative("reports", link));
    const page = typeof target?.attributes.notion === "string" ? target.attributes.notion : undefined;
    if (target?.type === "proposal") return page === undefined ? "Review row (after the next publish)" : `[${title}](https://www.notion.so/${page.replaceAll("-", "")})`;
    return page === undefined ? title : `[${title}](https://www.notion.so/${page.replaceAll("-", "")})`;
  });
}

/** A CommonMark code span, so Notion never links a name like notes.md (cli §5.14.4, CC-263). */
export function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** A brain-created Inbox row's body: a line about the source, its summary and its digest (cli §5.14.4). */
function digestBody(note: Note): string {
  const a = note.attributes;
  const origin = typeof a.file_name === "string" ? codeSpan(a.file_name) : typeof a.source_key === "string" && a.source_key.startsWith("url:") ? a.source_key.slice(4) : "pasted text";
  const date = typeof a.captured === "string" ? a.captured.slice(0, 10) : "";
  const fileDate = /^sources\/[^/]+\/(\d{4}-\d{2}-\d{2})-/.exec(note.path)?.[1] ?? date;
  const parts = splitParts(note.body);
  const words = note.body.split(/\s+/).filter((word) => word !== "").length;
  const line = `*${String(select(a.kind))} · ${origin} · ${fileDate} · ${words} words${parts.kind === "slides" ? ` · ${parts.parts.length} slides` : ""}*`;
  return [line, typeof a.summary === "string" ? a.summary : undefined, typeof a.digest === "string" ? a.digest.replace(/\n+$/, "") : undefined].filter((part) => part !== undefined).join("\n\n");
}

function proposalBefore(attributes: Record<string, unknown>, workspace: Workspace): unknown {
  if (attributes.kind === "add_link" || attributes.kind === "review_notes" || attributes.kind === "answer" || attributes.kind === "update_body") return null;
  if (attributes.kind === "supersede") return truncate(noteTitle(attributes.supersedes, workspace));
  if (attributes.kind === "merge") return truncate(noteTitle(attributes.target, workspace));
  if (attributes.kind === "replace_line") return truncate(attributes.line_before ?? null);
  return truncate(attributes.before ?? null);
}
function proposalAfter(attributes: Record<string, unknown>, workspace: Workspace): unknown {
  if (attributes.kind === "add_to_note") return attributes.content ?? null;
  if (attributes.kind === "replace_line") return attributes.line_after ?? null;
  if (attributes.kind === "new_item" && isRecord(attributes.note)) return `${attributes.note.title ?? ""} (${attributes.note.type ?? ""})`;
  if (attributes.kind === "supersede") return noteTitle(attributes.target, workspace);
  if (attributes.kind === "merge") return noteTitle(attributes.merge_into, workspace);
  if (attributes.kind === "answer") return `${String(attributes.answer)}${attributes.answer_note === undefined ? "" : ` → ${String(noteTitle(attributes.answer_note, workspace))}`}`;
  return attributes.after ?? null;
}

/** Task payloads for a meeting's or source's action items, or (targetId undefined, `--direct`) for tasks the user said yes to in a chat (cli §5.14.5). */
export function renderTasks(workspace: Workspace, targetId: string | undefined, input: unknown): Record<string, unknown> {
  if (!isRecord(input) || !Array.isArray(input.items)) throw new BrainError("INPUT_INVALID", "tasks input needs an items list");
  if (targetId === undefined) return renderDirectTasks(workspace, input.items);
  const config = tasksConfig(workspace); const target = workspace.get(targetId); const sourceMode = target?.type === "source";
  if (target === undefined) throw new BrainError("UNKNOWN_ID", `No meeting or source has id ${targetId}`);
  if (target.type !== "meeting" && !sourceMode) throw new BrainError("INPUT_INVALID", `${targetId} is not a meeting or source`);
  if (sourceMode && target.attributes.kind === undefined) throw new BrainError("INPUT_INVALID", "minutes sources use their meeting for tasks");
  const followUps = new Set<string>();
  const tasks = input.items.map((item, index) => {
    if (!isRecord(item) || typeof item.title !== "string" || item.title === "") throw new BrainError("INPUT_INVALID", "each task needs a title");
    const followUp = item.follow_up;
    if (followUp !== undefined) checkFollowUp(workspace, target, item, index, followUps);
    const projects = taskProjects(workspace, sourceMode ? undefined : target, item.projects, index);
    const properties: Record<string, unknown> = {};
    const pending_relations: Array<Record<string, unknown>> = [];
    const put = (key: string, type: string, value: unknown) => { const name = config.properties[key]; if (typeof name === "string" && name !== "") properties[name] = { type, value }; };
    if (item.status !== undefined && item.status !== "waiting_on") throw new BrainError("INPUT_INVALID", "a task status can only be waiting_on", [{ pointer: `/items/${index}/status`, message: "must be waiting_on, or absent" }]);
    // Waiting On (capture-and-review §6): someone else's commitment, tracked only when the item says so; the owner is their name.
    const waiting = item.status === "waiting_on";
    if (waiting && (typeof item.owner !== "string" || item.owner.trim() === "")) throw new BrainError("INPUT_INVALID", "a Waiting On task needs the owner's name", [{ pointer: `/items/${index}/owner`, message: "must be the name of the person you wait on" }]);
    put("title", "title", item.title); put("status", config.status_type, waiting ? config.waiting_on_status : config.new_task_status); if (item.due !== undefined) put("due", "date", dateOutput(item.due)); if ((!sourceMode || waiting) && item.owner !== undefined) put("owner", "person_name", item.owner);
    const projectProperty = config.properties.project;
    if (typeof projectProperty === "string" && projectProperty !== "") {
      const unpublished = projects.filter((id) => typeof workspace.get(id)?.attributes.notion !== "string");
      if (unpublished.length > 0) pending_relations.push({ property: projectProperty, ids: unpublished });
      put("project", "relation", publishedPages(projects, workspace));
    }
    const areas = sourceMode ? [...new Set(projects.flatMap((id) => { const area = workspace.get(id)?.attributes.area; return typeof area === "string" ? [area] : []; }))] : target.attributes.area === undefined ? [] : [target.attributes.area];
    put("area", "relation", publishedPages(areas, workspace));
    if (sourceMode) {
      if (typeof config.properties.source === "string" && config.properties.source !== "") {
        if (typeof target.attributes.notion !== "string") pending_relations.push({ property: config.properties.source, ids: [target.id] });
        else put("source", "relation", [target.attributes.notion]);
      }
    } else if (config.properties.meeting !== "") put("meeting", "relation", [target.attributes.notion]); else put("meeting_url", "url", target.attributes.notion === undefined ? undefined : `https://www.notion.so/${String(target.attributes.notion).replaceAll("-", "")}`);
    put("brain_id", "rich_text", target.id);
    const itemId = isRecord(item) ? item.item : undefined;
    // A Task from an extract names the item that authorized it (capture-and-review §6, §4.8): without it nothing ties the Task to a selected item.
    if (itemId === undefined && followUp === undefined && target.attributes.extract === true) throw new BrainError("INPUT_INVALID", "a Task from an extract needs the item that authorized it", [{ pointer: `/items/${index}/item`, message: "must name an item of the extract" }]);
    if (itemId !== undefined) {
      const items = (Array.isArray(target.attributes.selection) ? target.attributes.selection : []).map((entry) => (isRecord(entry) ? entry.id : undefined));
      if (target.attributes.extract !== true || typeof itemId !== "string" || !items.includes(itemId)) throw new BrainError("INPUT_INVALID", `${String(itemId)} is not an item of the extract`, [{ pointer: `/items/${index}/item`, message: "must be an item id of the extract's selection" }]);
      // Tasks come only from selected items (capture-and-review §6): an excluded item creates none.
      const entry = (Array.isArray(target.attributes.selection) ? target.attributes.selection : []).find((candidate) => isRecord(candidate) && candidate.id === itemId);
      if (isRecord(entry) && (entry.effective !== "use" || !importedItems(target.body).has(itemId as string))) throw new BrainError("INPUT_INVALID", `${String(itemId)} is excluded from the brain or none of its paragraphs was copied, so it creates no Task`, [{ pointer: `/items/${index}/item`, message: "must be an item that is included (Use in brain)" }]);
    }
    return { database_id: config.database, properties, pending_relations, ...(itemId === undefined ? {} : { item: itemId }), ...(followUp === undefined ? {} : { follow_up: followUp }) };
  });
  return { items: tasks };
}

/**
 * A follow-up (0079, cli §5.14.5, capture-and-review §6.3): an unticked quick follow-up of lean minutes, only from an extract source, with
 * no item, due date, status or owner, and never a second Task for a `q` id recorded along the replaces chain or given twice in one input.
 */
function checkFollowUp(workspace: Workspace, target: Note, item: Record<string, unknown>, index: number, seen: Set<string>): void {
  const refuse = (key: string, message: string): never => { throw new BrainError("INPUT_INVALID", message, [{ pointer: `/items/${index}/${key}`, message }]); };
  const followUp = item.follow_up;
  if (target.type !== "source" || target.attributes.extract !== true) refuse("follow_up", "a follow-up Task comes only from an extract source (--source)");
  if (typeof followUp !== "string" || !FOLLOW_UP.test(followUp)) refuse("follow_up", "a follow-up is a q id: q and digits, lower case");
  for (const key of ["item", "due", "status", "owner"]) if (item[key] !== undefined) refuse(key, `a follow-up Task has no ${key}`);
  const id = followUp as string;
  if (seen.has(id)) refuse("follow_up", `${id} is given twice`);
  seen.add(id);
  for (const source of chainOf(target, workspace.notes)) {
    const task = isRecord(source.attributes.task_items) ? source.attributes.task_items[id] : undefined;
    if (typeof task === "string") refuse("follow_up", `${id} already has its Task: ${task}`);
  }
}

/**
 * `sync tasks --direct` (0072, cli §5.14.5, assistant.md §7): no meeting or source, so no backlink and no Brain ID; an item may name
 * its Area; the owner is sent only on a Waiting On item. Nothing is recorded afterwards.
 */
function renderDirectTasks(workspace: Workspace, items: unknown[]): Record<string, unknown> {
  const config = tasksConfig(workspace);
  const tasks = items.map((item, index) => {
    if (!isRecord(item) || typeof item.title !== "string" || item.title === "") throw new BrainError("INPUT_INVALID", "each task needs a title", [{ pointer: `/items/${index}/title`, message: "must be a non-empty string" }]);
    if (item.item !== undefined) throw new BrainError("INPUT_INVALID", "a task from a chat has no extract item", [{ pointer: `/items/${index}/item`, message: "is only allowed with --source" }]);
    if (item.follow_up !== undefined) throw new BrainError("INPUT_INVALID", "a task from a chat is not a follow-up", [{ pointer: `/items/${index}/follow_up`, message: "is only allowed with --source naming an extract" }]);
    if (item.status !== undefined && item.status !== "waiting_on") throw new BrainError("INPUT_INVALID", "a task status can only be waiting_on", [{ pointer: `/items/${index}/status`, message: "must be waiting_on, or absent" }]);
    const waiting = item.status === "waiting_on";
    if (waiting && (typeof item.owner !== "string" || item.owner.trim() === "")) throw new BrainError("INPUT_INVALID", "a Waiting On task needs the owner's name", [{ pointer: `/items/${index}/owner`, message: "must be the name of the person you wait on" }]);
    let area: string | undefined;
    if (item.area !== undefined) {
      const note = typeof item.area === "string" ? workspace.get(item.area) : undefined;
      if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${String(item.area)}`, [{ pointer: `/items/${index}/area`, message: "does not exist" }]);
      if (note.type !== "area") throw new BrainError("INPUT_INVALID", `${note.id} is not an Area`, [{ pointer: `/items/${index}/area`, message: `is a ${note.type}, not an Area` }]);
      area = note.id;
    }
    const projects = taskProjects(workspace, undefined, item.projects, index);
    const properties: Record<string, unknown> = {}; const pending_relations: Array<Record<string, unknown>> = [];
    const put = (key: string, type: string, value: unknown) => { const name = config.properties[key]; if (typeof name === "string" && name !== "") properties[name] = { type, value }; };
    put("title", "title", item.title); put("status", config.status_type, waiting ? config.waiting_on_status : config.new_task_status);
    if (item.due !== undefined) put("due", "date", dateOutput(item.due));
    if (waiting) put("owner", "person_name", item.owner);
    const projectProperty = config.properties.project;
    if (typeof projectProperty === "string" && projectProperty !== "") {
      const unpublished = projects.filter((id) => typeof workspace.get(id)?.attributes.notion !== "string");
      if (unpublished.length > 0) pending_relations.push({ property: projectProperty, ids: unpublished });
      put("project", "relation", publishedPages(projects, workspace));
    }
    const areas = area !== undefined ? [area] : [...new Set(projects.flatMap((id) => { const value = workspace.get(id)?.attributes.area; return typeof value === "string" ? [value] : []; }))];
    put("area", "relation", publishedPages(areas, workspace));
    return { database_id: config.database, properties, pending_relations };
  });
  return { items: tasks };
}

function taskProjects(workspace: Workspace, meeting: Note | undefined, value: unknown, itemIndex: number): string[] {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return Array.isArray(meeting?.attributes.projects) ? meeting.attributes.projects.filter((id): id is string => typeof id === "string") : [];
  if (!Array.isArray(value)) throw new BrainError("INPUT_INVALID", "task projects must be an array", [{ pointer: `/items/${itemIndex}/projects`, message: "must be an array of project ids" }]);
  const problems: InputProblem[] = [];
  const projects: string[] = [];
  value.forEach((id, projectIndex) => {
    const pointer = `/items/${itemIndex}/projects/${projectIndex}`;
    if (typeof id !== "string") { problems.push({ pointer, message: "must be a project id" }); return; }
    const note = workspace.get(id);
    if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    if (note.type !== "project") { problems.push({ pointer, message: `${id} is not a project` }); return; }
    projects.push(id);
  });
  assertNoProblems(problems);
  return projects;
}
function publishedPages(value: unknown, workspace: Workspace): string[] { return (Array.isArray(value) ? value : []).map((id) => workspace.get(String(id))?.attributes.notion).filter((id): id is string => typeof id === "string"); }
function tasksConfig(workspace: Workspace): { database: string; properties: Record<string, string>; new_task_status: string; waiting_on_status: string; status_type: "status" | "select" } { if (!loadSchemas().brain(workspace.config)) throw new BrainError("BRAIN_CONFIG_INVALID", "brain.json fails its schema"); const notion = workspace.config.notion as Record<string, unknown>; const tasks = notion.tasks as Record<string, unknown>; if (typeof tasks.database !== "string" || tasks.database === "") throw new BrainError("BRAIN_CONFIG_INVALID", "Tasks database is not configured"); return { database: tasks.database as string, properties: tasks.properties as Record<string, string>, new_task_status: tasks.new_task_status as string, waiting_on_status: typeof tasks.waiting_on_status === "string" ? tasks.waiting_on_status : "Waiting On", status_type: tasks.status_type === "status" ? "status" : "select" }; }

/** `task_items` of a record (cli §5.14.6, 0055): item id (or a follow-up's `q` id, 0079) to Notion task page id, on an extract source only. */
function bindTaskItems(note: Note, attributes: Record<string, unknown>, value: unknown, recordTasks: unknown): void {
  if (!isRecord(value) || note.type !== "source" || attributes.extract !== true) throw new Error("INVALID_RESULT");
  const items = new Set((Array.isArray(attributes.selection) ? attributes.selection : []).map((entry) => (isRecord(entry) ? entry.id : undefined)));
  const known = new Set([...(Array.isArray(recordTasks) ? recordTasks : []), ...(Array.isArray(attributes.tasks) ? attributes.tasks : [])]);
  const current = isRecord(attributes.task_items) ? { ...attributes.task_items } : {};
  for (const [item, task] of Object.entries(value)) {
    // A key is an item of the selection, or a follow-up's `q` id (0079, capture-and-review §6.3).
    if ((!items.has(item) && !FOLLOW_UP.test(item)) || typeof task !== "string" || !known.has(task)) throw new Error("INVALID_RESULT");
    if (current[item] !== undefined && current[item] !== task) throw new Error("TASK_ITEM_EXISTS");
    current[item] = task;
  }
  attributes.task_items = current;
}

export function record(workspace: Workspace, input: unknown): { records: Array<Record<string, unknown>>; warnings: Array<{ code: string; message: string; id: string }> } {
  if (!isRecord(input) || !Array.isArray(input.records)) throw new BrainError("INPUT_INVALID", "record input needs a records list"); const records: Array<Record<string, unknown>> = []; const warnings: Array<{ code: string; message: string; id: string }> = [];
  for (const entry of input.records) { if (!isRecord(entry) || typeof entry.id !== "string" || !isTimestamp(entry.synced_at)) throw new BrainError("INPUT_INVALID", "each record needs id and synced_at"); const syncedAt = normalizeTimestamp(entry.synced_at)!; const note = workspace.get(entry.id); if (note === undefined) { records.push({ id: entry.id, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; } const checkpoint = workspace.checkpoint(); try { const doc = workspace.edit(note);
    // A Draft page moved to the trash (--unpublish-drafts, 0071): the note has no page again, until it is approved.
    if (REVIEWED_PAGE_TYPES.has(note.type) && isRecord(entry.published) && entry.published["@trashed"] !== undefined) { if (typeof doc.attributes.notion !== "string" || doc.attributes.notion !== entry.notion) throw new Error("NOTION_ID_MISMATCH"); for (const key of ["notion", "notion_published", "last_synced"]) delete doc.attributes[key]; workspace.save(note.path, doc); if (workspace.newErrors().length > 0) throw new Error("INVALID_RESULT"); records.push({ id: note.id, result: "recorded", changed: workspace.changedSince(checkpoint) }); continue; }
    // A rebuild record (cli §5.14.6, capture-and-review §7.12.1): the row's new page replaces the old one, and its baseline replaces the old baseline whole.
    if (entry.replaces !== undefined) {
      if (note.type !== "proposal" || typeof entry.replaces !== "string" || typeof entry.notion !== "string" || !isRecord(entry.published)) throw new Error("INVALID_RESULT");
      if (doc.attributes.notion === entry.notion && isDeepStrictEqual(doc.attributes.notion_published, entry.published)) { records.push({ id: entry.id, result: "recorded", changed: [] }); continue; }
      if (doc.attributes.notion !== entry.replaces) throw new Error("NOTION_ID_MISMATCH");
      doc.attributes.notion = entry.notion; doc.attributes.notion_published = entry.published;
    } else if (typeof entry.notion === "string") { if (doc.attributes.notion !== undefined && doc.attributes.notion !== entry.notion) throw new Error("NOTION_ID_MISMATCH"); doc.attributes.notion = entry.notion; } if (isRecord(entry.published)) doc.attributes.notion_published = withClearedBaselines({ ...(isRecord(doc.attributes.notion_published) ? doc.attributes.notion_published : {}), ...entry.published }, entry.published); if ((note.type !== "view" || isReport(note) || isWeekly(note)) && note.type !== "proposal") doc.attributes.last_synced = syncedAt; if ((note.type === "meeting" || note.type === "source") && Array.isArray(entry.tasks)) doc.attributes.tasks = [...new Set([...(Array.isArray(doc.attributes.tasks) ? doc.attributes.tasks : []), ...entry.tasks.filter((id): id is string => typeof id === "string")])]; if (entry.task_items !== undefined) bindTaskItems(note, doc.attributes, entry.task_items, entry.tasks); workspace.save(note.path, doc); const errors = workspace.newErrors(); if (errors.length > 0) throw new Error("INVALID_RESULT"); records.push({ id: note.id, result: "recorded", changed: workspace.changedSince(checkpoint) }); if (bodyWithoutReadBack(entry.published)) warnings.push({ code: "NOTION_BODY_MISSING", message: `${note.id}: a body was published without the read-back of its page, so the next plan holds it (cli §5.14.6, §5.14.7)`, id: note.id }); } catch (error) { workspace.restore(checkpoint); records.push({ id: entry.id, result: "failed", reason: error instanceof Error && (error.message === "NOTION_ID_MISMATCH" || error.message === "TASK_ITEM_EXISTS") ? error.message : "INVALID_RESULT", changed: [] }); } }
  return { records, warnings };
}

/** A body render sent (its `@git_body`) recorded with no `@notion_body` key at all: the read-back was skipped (cli §5.14.6, CC-262). A null is a failed read-back the skill reported. */
function bodyWithoutReadBack(published: unknown): boolean {
  return isRecord(published) && Object.hasOwn(published, "@git_body") && !Object.hasOwn(published, "@notion_body");
}

/** A Document whose accepted wording returns from Notion (cli §5.14.7): a promoted one (0049) or a workflow's (connected-workflows.md §6.3). */
function wordingDocument(note: Note): boolean {
  return note.type === "reference" && (note.attributes.origin === "promoted" || note.attributes.origin === "workflow");
}
