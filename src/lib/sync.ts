import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { applyAll, type Correction, type DecisionInput } from "./apply.ts";
import { BrainError } from "./errors.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { generateId, TYPE_PREFIX } from "./ids.ts";
import { assertStagedValid, checkNoteInput, stageNotes, type NoteInput } from "./note-new.ts";
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
import { hasReportShape, reportLinks } from "./report-body.ts";
import { gitBodyOf, parseWording, planWording, textHash, type AcceptedWording, type Wording, type WordingPlan } from "./wording.ts";

const DATABASES = ["areas", "goals", "key_results", "projects", "people", "orgs", "decisions", "questions", "concepts", "documents", "review", "inbox"] as const;
const CREATABLE = new Set(["areas", "goals", "projects", "people", "orgs"]);
const TYPE_FOR_DATABASE: Record<string, string> = { areas: "area", goals: "goal", projects: "project", people: "person", orgs: "org", decisions: "decision", questions: "question", concepts: "concept", documents: "reference", review: "proposal" };
const DATABASE_FOR_TYPE: Record<string, string> = { area: "areas", goal: "goals", project: "projects", person: "people", org: "orgs", decision: "decisions", question: "questions", concept: "concepts", reference: "documents", source: "inbox", meeting: "meetings", proposal: "review" };
const PUBLISHED_TYPES = new Set(["area", "goal", "project", "person", "org", "decision", "question", "concept", "reference", "source", "meeting", "proposal"]);

export interface SyncPlan {
  as_of: string;
  create: Array<NoteInput & { lifecycle?: string }>;
  updates: Array<Record<string, unknown>>;
  corrections: Correction[];
  decisions: DecisionInput[];
  /** Inbox rows whose Document asked box is ticked by the Keep as document button (0049); the skill writes a Document for each. */
  document_requests: Array<{ page_id: string; source: string; files: string[]; only_keep: string | null; existing?: string[] }>;
  /** Decision and concept rows whose Promote box is ticked (0049); the skill writes a promoted Document for each. */
  promote_requests: Array<{ page_id: string; note: string; existing?: string }>;
  /** Report rows whose Refresh box is ticked, and their new What to fix texts (0045); the skill runs `report new` / `report fix`. */
  refresh_requests: Array<{ page_id: string; report: string; wording_blocked?: true }>;
  report_fixes: Array<{ page_id: string; report: string; text: string }>;
  /** Accepted Document and report wording to import exactly, and the rows that wait or are held (cli §5.14.7, 0054). */
  accepted_wording: AcceptedWording[];
  wording_waiting: WordingPlan["wording_waiting"];
  wording_held: WordingPlan["wording_held"];
  clear_accepted: WordingPlan["clear_accepted"];
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

interface SnapshotRow { database: string; page_id: string; last_edited: string; properties: Record<string, unknown>; wording?: Wording }
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
    problems.push(...unknownKeys(value, ["database", "page_id", "last_edited", "properties", "wording"], p));
    if (value.wording !== undefined) value.wording = parseWording(value.wording, `${p}/wording`, problems);
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
  const result: SyncPlan = { as_of: snapshot.as_of, create: [], updates: [], corrections: [], decisions: [], document_requests: [], promote_requests: [], refresh_requests: [], report_fixes: [], accepted_wording: [], wording_waiting: [], wording_held: [], clear_accepted: [], conflicts: [], ignored: [] };
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
    if (row.database === "key_results") { planKeyResult(workspace, snapshot.as_of, row, result); continue; }
    if (row.database === "inbox") { planInbox(workspace, row, result); continue; }
    const brainId = property(row.properties, "Brain ID");
    let note = typeof brainId === "string" && brainId !== "" ? workspace.get(brainId) : noteByNotion(workspace, row.page_id);
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
    if (row.database === "documents" && row.wording !== undefined && note.type === "reference" && note.attributes.origin === "promoted") planWording(workspace, snapshot.as_of, row.page_id, note, row.wording, result);
    if ((row.database === "decisions" || row.database === "concepts") && property(row.properties, "Promote asked") === true) planPromote(workspace, row, note, modules.documents, result);
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
    notion_published: publishedBaseline(row, renderedBrainValues({ path: "", type, id: "", body: "", raw: "", attributes: { type, title, summary: property(row.properties, "Summary") ?? title, lifecycle: normalizeLifecycle(property(row.properties, "Lifecycle")) ?? "draft", notion: row.page_id } } as Note, workspace)),
  };
  const facts: Record<string, unknown> = {};
  const timeline: Record<string, unknown>[] = [];
  const fact = (name: string, value: unknown) => { if (value !== undefined && value !== null) { facts[name] = value; timeline.push({ field: name, value, from: row.last_edited.slice(0, 10), learned: asOf.slice(0, 10), source: `notion:${row.page_id}`, assessment: "accepted" }); } };
  if (type === "goal") { frontmatter.why = property(row.properties, "Why"); frontmatter.area = valueOfPage(property(row.properties, "Area"), "Area"); fact("deadline", dateValue(property(row.properties, "Deadline"))); }
  if (type === "project") { frontmatter.area = valueOfPage(property(row.properties, "Area"), "Area"); frontmatter.goal = valueOfPage(property(row.properties, "Goal"), "Goal"); frontmatter.client = valueOfPage(property(row.properties, "Client"), "Client"); frontmatter.people = valueOfPage(property(row.properties, "People"), "People", true); Object.assign(facts, parseKeyFacts(property(row.properties, "Key Facts"))); }
  if (type === "person") { frontmatter.org = valueOfPage(property(row.properties, "Org"), "Org"); fact("role", property(row.properties, "Role")); }
  if (Object.keys(facts).length > 0) { frontmatter.facts = facts; for (const [field, value] of Object.entries(facts)) fact(field, value); frontmatter.timeline = timeline; }
  if ((type === "goal" && (typeof frontmatter.why !== "string" || typeof frontmatter.area !== "string")) || (type === "project" && typeof frontmatter.area !== "string")) { conflicts.push(conflict(row, "MISSING_REQUIRED", `${type} "${title}" is missing required properties`)); return undefined; }
  const id = creates.get(row.page_id)!.id;
  return { type, id, title, lifecycle: normalizeLifecycle(property(row.properties, "Lifecycle")) as string ?? "draft", frontmatter, body: "" };
}

/** The baseline is what Notion shows (cli §5.14.2), empty values included, so render publishes the brain's values over them. */
function publishedBaseline(row: SnapshotRow, rendered: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(rendered).filter((name) => Object.hasOwn(row.properties, name)).map((name) => [name, row.properties[name]]));
}

function planExisting(workspace: Workspace, asOf: string, row: SnapshotRow, note: Note, out: SyncPlan): void {
  const updates: Record<string, unknown> = { id: note.id };
  if (note.attributes.notion === undefined) updates.notion = row.page_id;
  const fields = notionFields(row.database, row.properties, asOf);
  if (Object.keys(fields).length > 1 && !isDeepStrictEqual(withoutAsOf(note.attributes.notion_fields), withoutAsOf(fields))) updates.notion_fields = fields;
  const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : undefined;
  const rendered = renderedBrainValues(note, workspace);
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
  if (row.database === "review") planDecision(row, note, out);
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
 * An Inbox row is read for Document asked (0049) and, on a Report row, Refresh and What to fix
 * (0045); a Full text box is retired (cli §5.14.2).
 */
function planInbox(workspace: Workspace, row: SnapshotRow, out: SyncPlan): void {
  const modules = modulesOf(workspace.config);
  const brainId = property(row.properties, "Brain ID");
  const note = typeof brainId === "string" && brainId !== "" ? workspace.get(brainId) : undefined;
  if (Object.hasOwn(row.properties, "Full text")) out.ignored.push(ignoredRow(row, "RETIRED", "Full text"));
  if (note !== undefined && isReport(note)) {
    if (!modules.reports) { out.ignored.push(ignoredRow(row, "MODULE_OFF")); return; }
    // The report belongs to one page (cli §5.14.2): a duplicate or misassigned Brain ID on another row plans nothing.
    if (note.attributes.notion !== undefined && note.attributes.notion !== row.page_id) { out.conflicts.push(conflict(row, "NOTION_ID_MISMATCH", `Report ${note.id} belongs to another Notion page`)); return; }
    if (property(row.properties, "Refresh asked") === true || property(row.properties, "Refresh") === true) out.refresh_requests.push({ page_id: row.page_id, report: note.id });
    if (row.wording !== undefined) planWording(workspace, out.as_of, row.page_id, note, row.wording, out);
    const text = property(row.properties, "What to fix");
    const last = (Array.isArray(note.attributes.fixes) ? note.attributes.fixes : []).filter(isRecord).at(-1);
    if (typeof text === "string" && text.trim() !== "" && text !== last?.text) out.report_fixes.push({ page_id: row.page_id, report: note.id, text });
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

/** A Promote asked box on a decision or concept row (cli §5.14.2, 0049). */
function planPromote(workspace: Workspace, row: SnapshotRow, note: Note, documentsOn: boolean, out: SyncPlan): void {
  if (!documentsOn) { out.ignored.push(ignoredRow(row, "MODULE_OFF", "Promote asked")); return; }
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
  const mapping: Record<string, Record<string, string>> = { areas: { Type: "type", Archived: "archived" }, goals: { Status: "status", Progress: "progress", Archived: "archived" }, projects: { Status: "status", Priority: "priority", Dates: "dates", Archived: "archived" }, people: { Email: "email" }, orgs: { Relationship: "relationship", Website: "website" }, questions: { Status: "status" } };
  const fields: Record<string, unknown> = { as_of: asOf };
  for (const [name, key] of Object.entries(mapping[database] ?? {})) if (Object.hasOwn(p, name) && p[name] !== null) fields[key] = p[name];
  return fields;
}

function brainProperties(database: string): Array<[string, string]> {
  const common: Array<[string, string]> = [["Name", "title"], ["Summary", "summary"], ["Lifecycle", "lifecycle"]];
  const extras: Record<string, Array<[string, string]>> = { goals: [["Why", "why"], ["Deadline", "facts.deadline"], ["Area", "area"]], projects: [["Key Facts", "facts"], ["Area", "area"], ["Goal", "goal"], ["Client", "client"], ["People", "people"]], people: [["Role", "facts.role"], ["Org", "org"]], decisions: [["Assessment", "assessment"], ["Project", "projects"], ["Area", "derived_area"]], questions: [["Kind", "kind"], ["Project", "projects"], ["Area", "derived_area"]], concepts: [["Project", "concept_projects"], ["Area", "concept_area"]], documents: [["Project", "reference_projects"], ["Area", "reference_area"]] };
  return [...common, ...(extras[database] ?? [])];
}

function convertedValue(workspace: Workspace, row: SnapshotRow, name: string, value: unknown, conflicts: Array<Record<string, unknown>>): unknown {
  if (name === "Lifecycle") return normalizeLifecycle(value);
  if (name === "Deadline") return dateValue(value);
  if (["Area", "Goal", "Client", "Org", "People"].includes(name)) return relationIds(workspace, value, conflicts, row, name);
  if (name === "Key Facts") return parseKeyFacts(value);
  return value;
}

/** A Notion value in the brain's form: brain ids for relations (one id for single references), YYYY-MM-DD dates, lowercase lifecycle. */
function brainValue(workspace: Workspace, row: SnapshotRow, name: string, brainField: string, conflicts: Array<Record<string, unknown>>): unknown {
  const value = convertedValue(workspace, row, name, row.properties[name], conflicts);
  return Array.isArray(value) && ["area", "goal", "client", "org"].includes(brainField) ? value[0] ?? null : value;
}

/** True when a relation field links a note that has no Notion page yet: render leaves it out, so B alone would hide it. */
function linksUnpublished(workspace: Workspace, note: Note, brainField: string): boolean {
  if (!["area", "goal", "client", "org", "people"].includes(brainField)) return false;
  const raw = note.attributes[brainField]; const ids = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return ids.some((id) => typeof workspace.get(String(id))?.attributes.notion !== "string");
}

/** Equal in Notion's normalized form; relations compare as sets, and an empty text equals null. */
/** Relation properties left out while their module is off (cli §5.14.4, 0048), per database. */
function offRelations(config: Record<string, unknown>, database: string): Set<string> {
  const on = modulesOf(config);
  const off = new Set<string>();
  if (!on.orgs && database === "projects") off.add("Client");
  if (!on.orgs && database === "people") off.add("Org");
  if (!on.planning && database === "projects") off.add("Goal");
  if (!on.knowledge && (database === "inbox" || database === "meetings")) { off.add("Decisions"); off.add("Questions"); }
  if (!on.knowledge && database === "inbox") off.add("Concepts");
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
function correctable(field: string): boolean { return ["title", "summary", "why", "area", "goal", "client", "org", "people"].includes(field) || field.startsWith("facts."); }
function optionalReference(field: string): boolean { return ["goal", "client", "org"].includes(field); }
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
  const p = input as Record<string, unknown>; const problems = unknownKeys(p, ["as_of", "create", "updates", "corrections", "decisions", "document_requests", "promote_requests", "refresh_requests", "report_fixes", "accepted_wording", "wording_waiting", "wording_held", "clear_accepted", "conflicts", "ignored"], "");
  for (const key of ["document_requests", "promote_requests", "refresh_requests", "report_fixes", "accepted_wording", "wording_waiting", "wording_held", "clear_accepted"]) if (p[key] !== undefined && !Array.isArray(p[key])) problems.push({ pointer: `/${key}`, message: "must be a list" });
  if (!isTimestamp(p.as_of)) problems.push({ pointer: "/as_of", message: "must be an ISO 8601 UTC timestamp" });
  for (const key of ["create", "updates", "corrections", "decisions", "conflicts", "ignored"]) if (!Array.isArray(p[key])) problems.push({ pointer: `/${key}`, message: "must be a list" });
  (Array.isArray(p.create) ? p.create : []).forEach((item, index) => {
    if (!isRecord(item)) { problems.push({ pointer: `/create/${index}`, message: "must be an object" }); return; }
    problems.push(...unknownKeys(item, ["type", "id", "title", "file_date", "frontmatter", "body", "lifecycle"], `/create/${index}`));
    const { lifecycle: _lifecycle, ...note } = item;
    problems.push(...checkNoteInput(note, `/create/${index}`));
    if (item.lifecycle !== undefined && typeof item.lifecycle !== "string") problems.push({ pointer: `/create/${index}/lifecycle`, message: "must be a lifecycle string" });
  });
  // The wording lists are executed or echoed, so their items must have the specified shape (cli §5.14.7).
  const textKeys: Record<string, string[]> = { accepted_wording: ["page_id", "kind", "note", "fingerprint", "markdown", "base"], wording_waiting: ["page_id", "note", "reason"], wording_held: ["page_id", "note", "reason"], clear_accepted: ["page_id", "note", "accepted_at"] };
  for (const [key, required] of Object.entries(textKeys)) (Array.isArray(p[key]) ? p[key] as unknown[] : []).forEach((item, index) => {
    const at = `/${key}/${index}`;
    if (!isRecord(item)) { problems.push({ pointer: at, message: "must be an object" }); return; }
    for (const name of required) if (typeof item[name] !== "string" || item[name] === "") problems.push({ pointer: `${at}/${name}`, message: "must be a non-empty string" });
    if (key === "accepted_wording" && item.verified !== undefined && (!isRecord(item.verified) || typeof item.verified.fingerprint !== "string" || typeof item.verified.page_edited_at !== "string")) problems.push({ pointer: `${at}/verified`, message: "must be { fingerprint, page_edited_at }" });
  });
  assertNoProblems(problems);
  return { ...p, document_requests: p.document_requests ?? [], promote_requests: p.promote_requests ?? [], refresh_requests: p.refresh_requests ?? [], report_fixes: p.report_fixes ?? [], accepted_wording: p.accepted_wording ?? [], wording_waiting: p.wording_waiting ?? [], wording_held: p.wording_held ?? [], clear_accepted: p.clear_accepted ?? [], as_of: normalizeTimestamp(p.as_of)! } as unknown as SyncPlan;
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
  for (let index = 0; index < plan.create.length; index += 1) {
    const item = plan.create[index]!; const checkpoint = workspace.checkpoint();
    if (skippedAt.has(index)) { create.push({ id: item.id, ...rowSkipped }); continue; }
    try {
      if (item.id !== undefined && workspace.get(item.id) !== undefined) throw new Error("ID_IN_USE");
      const depends = relationsOf(item.frontmatter).some((id) => dependencyFailures.has(id));
      if (depends) throw new Error("DEPENDENCY_FAILED");
      const staged = stageNotes(workspace, [item], () => `/create/${index}`, { now, lifecycle: String((item as unknown as Record<string, unknown>).lifecycle ?? "draft") });
      assertStagedValid(workspace, staged.pointers);
      create.push({ id: staged.created[0]!.id, result: "applied", changed: staged.created.map((note) => note.path) });
    } catch (error) { workspace.restore(checkpoint); const reason = error instanceof Error && error.message === "DEPENDENCY_FAILED" ? "DEPENDENCY_FAILED" : error instanceof Error && error.message === "ID_IN_USE" ? "ID_IN_USE" : "INVALID_RESULT"; if (item.id !== undefined) dependencyFailures.add(item.id); create.push({ id: item.id, result: "failed", reason, changed: [] }); }
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
  const wording = applyWording(workspace, plan.accepted_wording, now, recordOnly, conflictedIds, conflictedPages);
  const log: LogEntry[] = [
    ...create.filter((item) => item.result === "applied").map((item) => ({ op: "sync-create", id: String(item.id), title: String(workspace.get(String(item.id))?.attributes.title ?? item.id) })),
    ...updates.filter((item) => item.result === "applied").map((item) => ({ op: "sync-update", id: String(item.id), title: String(workspace.get(String(item.id))?.attributes.title ?? item.id) })),
    ...(correctionApply?.log ?? []), ...(decisionApply.log ?? []),
    ...wording.log,
  ];
  updates.push(...skippedUpdates);
  const correctionsOut = [...corrections, ...skippedCorrections] as Array<Record<string, unknown>>; const decisionsOut = [...decisionResult, ...skippedDecisions] as Array<Record<string, unknown>>;
  return { create, updates, corrections: correctionsOut, decisions: decisionsOut, document_requests: plan.document_requests, promote_requests: plan.promote_requests, refresh_requests: plan.refresh_requests, report_fixes: plan.report_fixes, accepted_wording: wording.results, wording_waiting: plan.wording_waiting, wording_held: plan.wording_held, clear_accepted: plan.clear_accepted.filter((item) => !conflictedIds.has(item.note) && !conflictedPages.has(item.page_id)), conflicts: plan.conflicts, ignored: plan.ignored, summary: summarize([...create, ...wording.results, ...updates, ...correctionsOut, ...decisionsOut].map((item) => ({ ...item }))), log };
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
    if (item.verified === undefined || item.verified.fingerprint !== item.fingerprint || item.fingerprint !== textHash(item.markdown)) { fail("UNVERIFIED"); continue; }
    if (textHash(gitBodyOf(note)) !== item.base) { fail("GIT_CHANGED"); continue; }
    if (item.kind === "report" && (!hasReportShape(item.markdown) || reportLinks(workspace, item.markdown).broken.length > 0)) { fail("INVALID_REPORT_SHAPE"); continue; }
    const checkpoint = workspace.checkpoint();
    try {
      const doc = workspace.edit(note);
      doc.body = `\n${item.markdown}`;
      const a = doc.attributes;
      const source = `notion:${item.page_id}`;
      const sources = Array.isArray(a.sources) ? a.sources : [];
      if (!sources.includes(source)) a.sources = [...sources, source];
      if (item.kind === "report") a.generated_from = reportLinks(workspace, item.markdown).linked.sort(compareCodePoints);
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

/** The ids a create references (cli §5.14.3): free text such as a summary never counts. */
function relationsOf(frontmatter: unknown): string[] { return isRecord(frontmatter) ? referencedIds(frontmatter) : []; }
function summarize(items: readonly Record<string, unknown>[]): Record<string, number> { const result: Record<string, number> = { applied: 0, closed: 0, recorded: 0, corrected: 0, skipped: 0, failed: 0 }; for (const item of items) if (typeof item.result === "string" && Object.hasOwn(result, item.result)) result[item.result] += 1; return result; }

export interface RenderItem { id: string; type: string; database: string; database_id: string; page_id: string | null; action: "create" | "update" | "trash"; properties: Record<string, unknown>; body: string | null; sections: Record<string, string> | null; pending_relations: Array<Record<string, unknown>>; published: Record<string, unknown> }

export function render(workspace: Workspace, now: Date, ids?: readonly string[], held?: ReadonlyMap<string, Set<string>>): { items: RenderItem[]; errors: Array<Record<string, unknown>>; warnings: Array<{ code: string; message: string; id?: string }> } {
  const selected = ids === undefined
    ? workspace.notes.filter((note) => (PUBLISHED_TYPES.has(note.type) && !(note.type === "source" && note.attributes.kind === undefined)) || isReport(note))
    : ids.map((id) => workspace.get(id)!).filter(Boolean);
  const items: RenderItem[] = []; const errors: Array<Record<string, unknown>> = []; const warnings: Array<{ code: string; message: string; id?: string }> = [];
  const modules = modulesOf(workspace.config);
  for (const note of selected) {
    const database = isReport(note) ? "inbox" : DATABASE_FOR_TYPE[note.type]; if (database === undefined || (note.type === "source" && note.attributes.kind === undefined)) continue;
    // A note of a module that is off isn't published; naming one is an error (0048).
    if ((isReport(note) && !modules.reports) || !typeIsOn(workspace.config, note.type)) { if (ids !== undefined) errors.push({ id: note.id, reason: "MODULE_OFF" }); continue; }
    // An attached source has no Inbox row: its notes go on the parent's (0042).
    if (note.type === "source" && note.attributes.attached_to !== undefined) continue;
    // A decided Review row leaves Notion 30 days after its decision, once (0045).
    if (note.type === "proposal" && isRecord(note.attributes.notion_published) && note.attributes.notion_published["@trashed"] !== undefined) continue;
    const databaseId = databaseIdFor(workspace, database); if (databaseId === "") { warnings.push({ code: "DATABASE_NOT_CONFIGURED", message: `${database} database is not configured`, id: note.id }); continue; }
    if (note.type === "proposal" && trashDue(note, now)) { items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: String(note.attributes.notion), action: "trash", properties: {}, body: null, sections: null, pending_relations: [], published: { "@trashed": formatTimestamp(now) } }); continue; }
    if (note.type === "meeting" && typeof note.attributes.notion !== "string") { errors.push({ id: note.id, reason: "MEETING_NOT_PUBLISHED" }); continue; }
    if (note.type === "project" && typeof note.attributes.notion !== "string") { errors.push({ id: note.id, reason: "PROJECT_NOT_IN_NOTION" }); continue; }
    const capturePage = note.type === "source" && note.attributes.kind === "capture" && typeof note.attributes.source_key === "string" && note.attributes.source_key.startsWith("notion:") ? note.attributes.source_key.slice("notion:".length) : undefined;
    if (note.type === "source" && note.attributes.kind === "capture" && (capturePage === undefined || (typeof note.attributes.notion === "string" && note.attributes.notion !== capturePage))) { errors.push({ id: note.id, reason: "NOTION_ID_MISMATCH" }); continue; }
    const rendered = renderedBrainValues(note, workspace); const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : {};
    for (const name of offRelations(workspace.config, database)) delete rendered[name];
    const properties: Record<string, unknown> = {}; const pending: Array<Record<string, unknown>> = []; const heldProperties = held?.get(note.id) ?? new Set<string>();
    const isCreate = note.attributes.notion === undefined && capturePage === undefined;
    for (const [name, value] of Object.entries(rendered)) { if (name === "@content" || heldProperties.has(name) || (capturePage !== undefined && name === "Name")) continue; const encoded = notionProperty(name, value, note, workspace, pending); if (encoded !== undefined && (isCreate || !Object.hasOwn(published, name) || !sameValue(value, RENAMED_VALUES[name]?.[String(published[name])] ?? published[name]))) properties[name] = encoded; }
    const content = renderedContent(note, workspace); if (content.hash !== undefined) rendered["@content"] = content.hash;
    // A promoted Document's body is yours once its page exists (0049): sent on create only.
    if (note.type === "reference" && note.attributes.origin === "promoted" && !isCreate) { content.body = null; delete rendered["@content"]; if (Object.hasOwn(published, "@content")) rendered["@content"] = published["@content"]; content.hash = undefined; }
    const contentChanged = content.hash !== undefined && !isDeepStrictEqual(content.hash, published["@content"]);
    // The Git body at this publish, the SG baseline of cli §5.14.7 (the skill adds @notion_body after it re-reads the page).
    if ((note.type === "reference" && note.attributes.origin === "promoted" && isCreate) || (isReport(note) && (isCreate || contentChanged))) rendered["@git_body"] = textHash(gitBodyOf(note));
    // A report (0045): a refresh sends the body once and clears Refresh; a new fix clears What to fix.
    let reportDue = false;
    if (isReport(note)) {
      const fixes = Array.isArray(note.attributes.fixes) ? note.attributes.fixes.length : 0;
      const stored = typeof published["@fixes"] === "number" ? published["@fixes"] : 0;
      if (!isCreate && contentChanged) properties["Refresh asked"] = { type: "checkbox", value: false };
      if (!isCreate && !contentChanged) content.body = null;
      if (fixes > stored) { properties["What to fix"] = { type: "rich_text", value: null }; reportDue = true; }
      rendered["@fixes"] = Math.max(fixes, stored);
    }
    // Full text (0043) is retired (0049): nothing is sent, and `@full_text` in S stays as it is.
    if (!isCreate && Object.keys(properties).length === 0 && !contentChanged && !reportDue) continue;
    if (!isCreate && note.type !== "meeting" && note.type !== "proposal") properties["Last Synced"] = { type: "date", value: { start: formatTimestamp(now), end: null } };
    items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: typeof note.attributes.notion === "string" ? note.attributes.notion : capturePage ?? null, action: isCreate ? "create" : "update", properties, body: content.body, sections: content.sections, pending_relations: pending, published: rendered });
  }
  items.sort((a, b) => DATABASES.concat(["meetings"] as never[]).indexOf(a.database as never) - DATABASES.concat(["meetings"] as never[]).indexOf(b.database as never) || compareCodePoints(a.id, b.id));
  return { items, errors, warnings };
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
function renderedBrainValues(note: Note, workspace: Workspace): Record<string, unknown> {
  const a = note.attributes; const values: Record<string, unknown> = {};
  const common = () => Object.assign(values, { Name: a.title, Summary: a.summary ?? null, Lifecycle: select(a.lifecycle), "Brain ID": note.id });
  if (note.type === "proposal") {
    const target = typeof a.target === "string" ? workspace.get(a.target) : undefined;
    const addLink = a.kind === "add_link";
    const after = addLink
      ? proposalLinks(a).map((link) => `${fieldLabel(String(link.field))}: ${noteTitle(link.value, workspace)}`).join("\n")
      : a.kind === "review_notes" ? reviewNotesAfter(a, workspace) : a.kind === "update_body" ? bodyChange(a, workspace)?.join("\n") ?? null : undefined;
    // A body diff can only be shown while the target's body is the one proposed against; then S keeps it (0045).
    const proposed = staleBody(a, workspace) && isRecord(a.notion_published) && Object.hasOwn(a.notion_published, "Proposed") ? a.notion_published.Proposed : undefined;
    const reviewText = (value: unknown) => truncate(typeof value === "string" ? reviewMarkdown(value, target) : value);
    // A Review notes row names its source: the meeting for minutes, else the source (0041).
    const source = a.kind === "review_notes" && typeof a.source === "string" ? workspace.get(a.source) : undefined;
    const targetText = source !== undefined ? `${source.attributes.title} (${source.id})` : target === undefined ? null : `${target.attributes.title} (${target.id})`;
    const page = (source ?? target)?.attributes.notion;
    const meeting = typeof a.source === "string" ? workspace.get(a.source) : undefined;
    Object.assign(values, {
      Name: reviewName(a), Kind: select(a.kind), About: targetText,
      "About Page": typeof page === "string" ? `https://www.notion.so/${page.replaceAll("-", "")}` : null,
      "Source Meeting": meeting?.type === "meeting" && typeof meeting.attributes.notion === "string" ? [meeting.attributes.notion] : [],
      Now: reviewText(proposalBefore(a, workspace)), Proposed: proposed !== undefined ? proposed : reviewText(after ?? proposalAfter(a, workspace)),
      Why: reviewText(a.why), Area: relationPages(reviewArea(a, workspace), workspace), State: select(proposalState(a.status)), "Brain ID": note.id,
    });
    return values;
  }
  if (isReport(note)) { Object.assign(values, { Name: a.title, Kind: "Report", Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), Ask: typeof a.asked_in === "string" ? [a.asked_in] : Array.isArray(a.asked_in) ? a.asked_in : [], "Brain Status": "Done", "Brain ID": note.id }); return values; }
  if (note.type === "meeting") { Object.assign(values, { Decisions: relationPages(a.decisions, workspace), Questions: relationPages(a.questions, workspace), Attendees: relationPages(a.attendees, workspace), Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), "Brain Status": "Ingested", "Ingested At": dateOutput(a.created), "Brain ID": note.id }); return values; }
  if (note.type === "source") return sourceValues(note, workspace);
  common();
  if (note.type === "goal") Object.assign(values, { Why: a.why ?? null, Deadline: dateOutput(isRecord(a.facts) ? a.facts.deadline : undefined), Area: relationPages(a.area === undefined ? [] : [a.area], workspace) });
  if (note.type === "project") Object.assign(values, { "Key Facts": keyFactsText(a.facts, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), Goal: relationPages(a.goal === undefined ? [] : [a.goal], workspace), Client: relationPages(a.client === undefined ? [] : [a.client], workspace), People: relationPages(a.people, workspace) });
  if (note.type === "person") Object.assign(values, { Role: isRecord(a.facts) ? a.facts.role ?? null : null, Org: relationPages(a.org === undefined ? [] : [a.org], workspace) });
  if (note.type === "decision") Object.assign(values, { Date: dateOutput(a.date), Assessment: select(a.assessment), Area: relationPages(projectAreas(a.projects, workspace), workspace), Project: relationPages(a.projects, workspace), "Decided In": relationPages(a.decided_in === undefined ? [] : [a.decided_in], workspace), Supersedes: relationPages((Array.isArray(a.relations) ? a.relations.filter(isRecord).filter((x) => x.type === "supersedes").map((x) => x.target) : []), workspace) });
  if (note.type === "question") Object.assign(values, { Kind: select(a.kind), Area: relationPages(projectAreas(a.projects, workspace), workspace), Project: relationPages(a.projects, workspace), "Raised In": relationPages(a.raised_in === undefined ? [] : [a.raised_in], workspace) });
  // Status goes out once as Open while you never set one, and once as Answered after an approved answer; it stays yours otherwise (0041, 0045).
  if (note.type === "question") {
    const published = isRecord(a.notion_published) ? a.notion_published : {};
    const yours = isRecord(a.notion_fields) && a.notion_fields.status !== undefined;
    if (a.answer !== undefined) { if (published.Status !== "Answered") values.Status = "Answered"; }
    else if (published.Status === undefined && !yours) values.Status = "Open";
  }
  if (note.type === "concept" || note.type === "reference") Object.assign(values, { Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace) });
  if (note.type === "reference") {
    const from = a.origin === "promoted" && typeof a.promoted_from === "string" ? a.promoted_from : undefined;
    Object.assign(values, { "From decision": relationPages(from?.startsWith("dec-") ? [from] : [], workspace), "From concept": relationPages(from?.startsWith("con-") ? [from] : [], workspace) });
  }
  return values;
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
  return workspace.notes.filter((candidate) => ["decision", "question", "concept", "reference", "person"].includes(candidate.type) && !(candidate.type === "reference" && candidate.attributes.origin === "promoted") && Array.isArray(candidate.attributes.sources) && candidate.attributes.sources.some((id) => sources.has(String(id))));
}

function sourceValues(note: Note, workspace: Workspace): Record<string, unknown> {
  const produced = producedBy(note, workspace);
  const ids = (type: string) => produced.filter((candidate) => candidate.type === type).map((candidate) => candidate.id).sort(compareCodePoints);
  const projects = [...new Set(produced.flatMap((candidate) => Array.isArray(candidate.attributes.projects) ? candidate.attributes.projects.filter((id): id is string => typeof id === "string") : []))].sort(compareCodePoints);
  const areas = [...new Set([...produced.map((candidate) => candidate.attributes.area).filter((id): id is string => typeof id === "string"), ...projects.flatMap((id) => { const area = workspace.get(id)?.attributes.area; return typeof area === "string" ? [area] : []; })])].sort(compareCodePoints);
  return { Name: note.attributes.title, Kind: note.attributes.kind === "document" ? "File" : select(note.attributes.kind), Summary: note.attributes.summary ?? null, Decisions: relationPages(ids("decision"), workspace), Questions: relationPages(ids("question"), workspace), Concepts: relationPages(ids("concept"), workspace), ...(databaseIdFor(workspace, "documents") === "" ? {} : { Documents: relationPages(ids("reference"), workspace) }), People: relationPages(ids("person"), workspace), Project: relationPages(projects, workspace), Area: relationPages(areas, workspace), "Brain Status": "Done", "Brain ID": note.id };
}

function notionProperty(name: string, value: unknown, note: Note, workspace: Workspace, pending: Array<Record<string, unknown>>): unknown {
  const relation = ["Area", "Goal", "Client", "People", "Org", "Project", "Decided In", "Raised In", "Supersedes", "Decisions", "Questions", "Concepts", "Documents", "Attendees", "From decision", "From concept"].includes(name);
  if (relation) {
    const sourceField: Record<string, string> = { Area: "area", Goal: "goal", Client: "client", People: "people", Org: "org", Project: "projects", "Decided In": "decided_in", "Raised In": "raised_in", Decisions: "decisions", Questions: "questions", Attendees: "attendees" };
    const raw = name === "Area" && note.type === "proposal" ? reviewArea(note.attributes, workspace)
      : name === "From decision" || name === "From concept" ? (Array.isArray(value) && note.attributes.promoted_from !== undefined && String(note.attributes.promoted_from).startsWith(name === "From decision" ? "dec-" : "con-") ? [note.attributes.promoted_from] : [])
      : name === "Area" && (note.type === "decision" || note.type === "question") ? projectAreas(note.attributes.projects, workspace) : name === "Supersedes" ? (Array.isArray(note.attributes.relations) ? note.attributes.relations.filter(isRecord).filter((item) => item.type === "supersedes").map((item) => item.target) : []) : note.type === "source" ? sourceRelationIds(note, name, workspace) : note.attributes[sourceField[name] ?? ""];
    const missing = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).map(String).filter((id) => typeof workspace.get(id)?.attributes.notion !== "string");
    if (missing.length > 0) pending.push({ property: name, ids: missing });
    const mode = (note.type === "meeting" || note.type === "source") ? (["Project", "Area"].includes(name) ? "if_empty" : note.type === "meeting" ? "add" : undefined) : undefined;
    return { type: "relation", value: Array.isArray(value) ? value : [], ...(mode === undefined ? {} : { mode }) };
  }
  if (name === "Source Meeting") {
    const meeting = typeof note.attributes.source === "string" ? workspace.get(note.attributes.source) : undefined;
    if (meeting?.type === "meeting" && typeof meeting.attributes.notion !== "string") pending.push({ property: name, ids: [meeting.id] });
    return { type: "relation", value: Array.isArray(value) ? value : [] };
  }
  if (name === "Ask") return { type: "relation", value: Array.isArray(value) ? value : [] };
  if (name === "About Page") return { type: "url", value };
  // An Inbox row's Kind is written only when empty in Notion, so a Kind you chose stands (0048).
  if (name === "Kind" && note.type === "source") return { type: "select", value, mode: "if_empty" };
  if (["Lifecycle", "Assessment", "Kind", "State", "Brain Status", "Status"].includes(name)) return { type: "select", value };
  if (name === "Last Synced" || name === "Date" || name === "Deadline" || name === "Ingested At") return { type: "date", value };
  return { type: name === "Name" ? "title" : "rich_text", value };
}
function sourceRelationIds(note: Note, name: string, workspace: Workspace): string[] {
  const produced = producedBy(note, workspace);
  if (name === "Decisions") return produced.filter((candidate) => candidate.type === "decision").map((candidate) => candidate.id);
  if (name === "Questions") return produced.filter((candidate) => candidate.type === "question").map((candidate) => candidate.id);
  if (name === "Concepts") return produced.filter((candidate) => candidate.type === "concept").map((candidate) => candidate.id);
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
  if (note.type === "area") { const brief = workspace.notes.find((x) => x.type === "view" && x.attributes.view_kind === "area_brief" && x.attributes.area === note.id); if (brief === undefined) return { body: null, sections: null }; const sections = { Brief: notionMarkdown(generatedBlock(brief.body), brief, workspace) }; return { body: null, sections, hash: hash(JSON.stringify(sections)) }; }
  // A source's digest is written once (0043).
  if (note.type === "source") { if (!hasInboxBody(note)) return { body: null, sections: null }; const body = digestBody(note); return { body, sections: null, hash: hash(body) }; }
  if (isReport(note)) { const body = notionMarkdown(note.body.replace(/^\n+/, ""), note, workspace); return { body, sections: null, hash: hash(body) }; }
  if (note.type === "decision" || note.type === "question" || note.type === "concept" || note.type === "reference") { const body = notionMarkdown(note.body, note, workspace); return { body, sections: null, hash: hash(body) }; } if (note.type === "project") { const brief = workspace.notes.find((x) => x.path === `${note.path.slice(0, note.path.lastIndexOf("/"))}/brief.md`); const log = workspace.notes.find((x) => x.path === `${note.path.slice(0, note.path.lastIndexOf("/"))}/decision-log.md`); const sections = { Brief: notionMarkdown(generatedBlock(brief?.body ?? ""), note, workspace), "Decision log": notionMarkdown(generatedBlock(log?.body ?? ""), note, workspace) }; return { body: null, sections, hash: hash(JSON.stringify(sections)) }; } return { body: null, sections: null }; }
function generatedBlock(body: string): string { const start = body.indexOf("<!-- @generated:start -->"); const end = body.indexOf("<!-- @generated:end -->"); return start >= 0 && end > start ? body.slice(start + "<!-- @generated:start -->".length, end).trim() : body.trim(); }
function notionMarkdown(body: string, source: Note, workspace: Workspace): string { const fromFolder = source.path.includes("/") ? source.path.slice(0, source.path.lastIndexOf("/")) : ""; return body.replace(/\^\[(inferred|ambiguous)\]/g, (_, kind) => kind === "inferred" ? " (AI inference)" : " (ambiguous)").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_all, title, link) => { const targetPath = normalizeRelative(fromFolder, link); const target = workspace.notes.find((note) => note.path === targetPath); return typeof target?.attributes.notion === "string" ? `[${title}](https://www.notion.so/${target.attributes.notion.replaceAll("-", "")})` : title; }); }
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
function personTitle(value: unknown, workspace: Workspace): unknown { return typeof value === "string" && workspace.get(value)?.type === "person" ? workspace.get(value)!.attributes.title : value; }
function noteTitle(value: unknown, workspace: Workspace): unknown { return typeof value === "string" ? workspace.get(value)?.attributes.title ?? value : value ?? null; }
function fieldLabel(field: string): string { return field[0]?.toUpperCase() + field.slice(1).replaceAll("_", " "); }
function truncate(value: unknown): unknown { return typeof value === "string" ? value.slice(0, 2000) : value; }
/** The lettered lines of a Review notes row: its changes, then its notes, then its links (cli §5.14.4, 0045). */
function reviewNotesAfter(attributes: Record<string, unknown>, workspace: Workspace): string {
  const changes = (Array.isArray(attributes.changes) ? attributes.changes.filter(isRecord) : []).map((change) => {
    const target = String(noteTitle(change.target, workspace));
    if (change.kind === "update_fact") return `⚠ ${fieldLabel(String(change.field))} on ${target}: ${change.before === undefined ? "(new)" : String(noteTitle(change.before, workspace))} → ${String(noteTitle(change.after, workspace))}`;
    if (change.kind === "update_body") return `⚠ ${target}: ${bodyChange(change, workspace)?.length ?? 0} lines changed`;
    return `Add to ${target}: ${String(change.content ?? "").split("\n")[0]!.slice(0, 80)}`;
  });
  const notes = (Array.isArray(attributes.notes) ? attributes.notes : []).map((id) => {
    const note = workspace.get(String(id));
    return `${note === undefined ? "Note" : fieldLabel(note.type)}: ${String(noteTitle(id, workspace))}`;
  });
  const links = (Array.isArray(attributes.links) ? attributes.links.filter(isRecord) : []).map((link) =>
    `${fieldLabel(String(link.field))} on ${String(noteTitle(link.target, workspace))}: ${String(noteTitle(link.value, workspace))}`);
  return [...changes, ...notes, ...links].map((line, index) => `${letters(index)}) ${line}`).join("\n");
}

/** The changed lines an update_body proposes against its target's body (cli §5.19), or undefined once that body changed. */
function bodyChange(change: Record<string, unknown>, workspace: Workspace): string[] | undefined {
  const target = typeof change.target === "string" ? workspace.get(change.target) : undefined;
  if (target === undefined || bodyHash(target.body) !== change.before_hash) return undefined;
  return lineDiff(target.body, bodyOf(String(change.content ?? "")));
}

/** Whether a proposal holds an update_body whose target's body is no longer the one it was proposed against. */
function staleBody(attributes: Record<string, unknown>, workspace: Workspace): boolean {
  const bodies = attributes.kind === "update_body" ? [attributes] : (Array.isArray(attributes.changes) ? attributes.changes.filter(isRecord) : []).filter((change) => change.kind === "update_body");
  return bodies.some((change) => bodyChange(change, workspace) === undefined);
}

/** a, b, … z, then aa, ab, … */
export function letters(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : `${letters(Math.floor(index / 26) - 1)}${letters(index % 26)}`;
}

function isReport(note: Note): boolean { return note.type === "view" && note.attributes.view_kind === "report"; }

/** A brain-created Inbox row's body: a line about the source, its summary and its digest (cli §5.14.4). */
function digestBody(note: Note): string {
  const a = note.attributes;
  const origin = typeof a.file_name === "string" ? a.file_name : typeof a.source_key === "string" && a.source_key.startsWith("url:") ? a.source_key.slice(4) : "pasted text";
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
  return truncate(attributes.before ?? null);
}
function proposalAfter(attributes: Record<string, unknown>, workspace: Workspace): unknown {
  if (attributes.kind === "add_to_note") return attributes.content ?? null;
  if (attributes.kind === "new_item" && isRecord(attributes.note)) return `${attributes.note.title ?? ""} (${attributes.note.type ?? ""})`;
  if (attributes.kind === "supersede") return noteTitle(attributes.target, workspace);
  if (attributes.kind === "merge") return noteTitle(attributes.merge_into, workspace);
  if (attributes.kind === "answer") return `${String(attributes.answer)}${attributes.answer_note === undefined ? "" : ` → ${String(noteTitle(attributes.answer_note, workspace))}`}`;
  return attributes.after ?? null;
}

export function renderTasks(workspace: Workspace, targetId: string, input: unknown): Record<string, unknown> {
  if (!isRecord(input) || !Array.isArray(input.items)) throw new BrainError("INPUT_INVALID", "tasks input needs an items list");
  const config = tasksConfig(workspace); const target = workspace.get(targetId); const sourceMode = target?.type === "source";
  if (target === undefined) throw new BrainError("UNKNOWN_ID", `No meeting or source has id ${targetId}`);
  if (target.type !== "meeting" && !sourceMode) throw new BrainError("INPUT_INVALID", `${targetId} is not a meeting or source`);
  if (sourceMode && target.attributes.kind === undefined) throw new BrainError("INPUT_INVALID", "minutes sources use their meeting for tasks");
  const tasks = input.items.map((item, index) => {
    if (!isRecord(item) || typeof item.title !== "string" || item.title === "") throw new BrainError("INPUT_INVALID", "each task needs a title");
    const projects = taskProjects(workspace, sourceMode ? undefined : target, item.projects, index);
    const properties: Record<string, unknown> = {};
    const pending_relations: Array<Record<string, unknown>> = [];
    const put = (key: string, type: string, value: unknown) => { const name = config.properties[key]; if (typeof name === "string" && name !== "") properties[name] = { type, value }; };
    put("title", "title", item.title); put("status", config.status_type, config.new_task_status); if (item.due !== undefined) put("due", "date", dateOutput(item.due)); if (!sourceMode && item.owner !== undefined) put("owner", "person_name", item.owner);
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
function tasksConfig(workspace: Workspace): { database: string; properties: Record<string, string>; new_task_status: string; status_type: "status" | "select" } { if (!loadSchemas().brain(workspace.config)) throw new BrainError("BRAIN_CONFIG_INVALID", "brain.json fails its schema"); const notion = workspace.config.notion as Record<string, unknown>; const tasks = notion.tasks as Record<string, unknown>; if (typeof tasks.database !== "string" || tasks.database === "") throw new BrainError("BRAIN_CONFIG_INVALID", "Tasks database is not configured"); return { database: tasks.database as string, properties: tasks.properties as Record<string, string>, new_task_status: tasks.new_task_status as string, status_type: tasks.status_type === "status" ? "status" : "select" }; }

export function record(workspace: Workspace, input: unknown): Record<string, unknown> {
  if (!isRecord(input) || !Array.isArray(input.records)) throw new BrainError("INPUT_INVALID", "record input needs a records list"); const records: Array<Record<string, unknown>> = [];
  for (const entry of input.records) { if (!isRecord(entry) || typeof entry.id !== "string" || !isTimestamp(entry.synced_at)) throw new BrainError("INPUT_INVALID", "each record needs id and synced_at"); const syncedAt = normalizeTimestamp(entry.synced_at)!; const note = workspace.get(entry.id); if (note === undefined) { records.push({ id: entry.id, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; } const checkpoint = workspace.checkpoint(); try { const doc = workspace.edit(note); if (typeof entry.notion === "string") { if (doc.attributes.notion !== undefined && doc.attributes.notion !== entry.notion) throw new Error("NOTION_ID_MISMATCH"); doc.attributes.notion = entry.notion; } if (isRecord(entry.published)) doc.attributes.notion_published = { ...(isRecord(doc.attributes.notion_published) ? doc.attributes.notion_published : {}), ...entry.published }; if ((note.type !== "view" || isReport(note)) && note.type !== "proposal") doc.attributes.last_synced = syncedAt; if ((note.type === "meeting" || note.type === "source") && Array.isArray(entry.tasks)) doc.attributes.tasks = [...new Set([...(Array.isArray(doc.attributes.tasks) ? doc.attributes.tasks : []), ...entry.tasks.filter((id): id is string => typeof id === "string")])]; workspace.save(note.path, doc); const errors = workspace.newErrors(); if (errors.length > 0) throw new Error("INVALID_RESULT"); records.push({ id: note.id, result: "recorded", changed: workspace.changedSince(checkpoint) }); } catch (error) { workspace.restore(checkpoint); records.push({ id: entry.id, result: "failed", reason: error instanceof Error && error.message === "NOTION_ID_MISMATCH" ? "NOTION_ID_MISMATCH" : "INVALID_RESULT", changed: [] }); } }
  return { records };
}
