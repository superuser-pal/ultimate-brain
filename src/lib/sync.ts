import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { applyAll, EDITABLE, type Correction, type DecisionInput } from "./apply.ts";
import { BrainError } from "./errors.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { generateId, TYPE_PREFIX } from "./ids.ts";
import { assertStagedValid, checkNoteInput, stageNotes, type NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { loadSchemas } from "./schemas.ts";
import { formatDate, formatTimestamp, normalizeTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";
import type { LogEntry } from "./log.ts";

const DATABASES = ["areas", "goals", "key_results", "projects", "people", "orgs", "decisions", "questions", "concepts", "review"] as const;
const CREATABLE = new Set(["areas", "goals", "projects", "people", "orgs"]);
const TYPE_FOR_DATABASE: Record<string, string> = { areas: "area", goals: "goal", projects: "project", people: "person", orgs: "org", decisions: "decision", questions: "question", concepts: "concept", review: "proposal" };
const DATABASE_FOR_TYPE: Record<string, string> = { area: "areas", goal: "goals", project: "projects", person: "people", org: "orgs", decision: "decisions", question: "questions", concept: "concepts", source: "inbox", meeting: "meetings", proposal: "review" };
const PUBLISHED_TYPES = new Set(["area", "goal", "project", "person", "org", "decision", "question", "concept", "source", "meeting", "proposal"]);

export interface SyncPlan {
  as_of: string;
  create: Array<NoteInput & { lifecycle?: string }>;
  updates: Array<Record<string, unknown>>;
  corrections: Correction[];
  decisions: DecisionInput[];
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

interface SnapshotRow { database: string; page_id: string; last_edited: string; properties: Record<string, unknown> }
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
    problems.push(...unknownKeys(value, ["database", "page_id", "last_edited", "properties"], p));
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
  const result: SyncPlan = { as_of: snapshot.as_of, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [] };
  const createsByPage = new Map<string, { id: string; type: string }>();
  for (const row of snapshot.rows) if (CREATABLE.has(row.database) && blank(property(row.properties, "Brain ID"))) {
    const existing = noteByNotion(workspace, row.page_id);
    if (existing === undefined) createsByPage.set(row.page_id, { id: generateId(TYPE_PREFIX[TYPE_FOR_DATABASE[row.database]]!, new Set([...workspace.ids(), ...[...createsByPage.values()].map((x) => x.id)])), type: TYPE_FOR_DATABASE[row.database]! });
  }

  for (const row of snapshot.rows) {
    if (row.database === "key_results") { planKeyResult(workspace, snapshot.as_of, row, result); continue; }
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
  }
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
  for (const [name, brainField] of brainProperties(row.database)) {
    if (!Object.hasOwn(row.properties, name)) continue;
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
  const decision = property(row.properties, "Decision");
  if (decision === undefined || property(row.properties, "State") !== "Pending") return;
  if (["applied", "closed"].includes(String(proposal.attributes.status))) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: proposal.id, reason: "ALREADY_TERMINAL" }); return; }
  const action = String(decision).toLowerCase();
  const note = property(row.properties, "Note");
  if (!["approve", "reject", "edit"].includes(action)) { out.ignored.push({ database: row.database, page_id: row.page_id, brain_id: proposal.id, reason: "NOT_CORRECTABLE" }); return; }
  if (action === "edit" && !EDITABLE.has(String(proposal.attributes.kind))) {
    out.conflicts.push(conflict(row, "EDIT_NOT_ALLOWED", `Edit is not allowed on a ${String(proposal.attributes.kind)} proposal`, "Decision", decision));
    return;
  }
  if (action === "edit" && (note === null || note === undefined || note === "")) { out.conflicts.push(conflict(row, "EDIT_WITHOUT_VALUE", "Edit needs a Note", "Note")); return; }
  if (action !== "edit" && typeof note === "string" && note !== "") { out.conflicts.push(conflict(row, "NOTE_TO_READ", "Review Note needs interpretation by the skill", "Note", note, decision)); return; }
  out.decisions.push({ proposal: proposal.id, action: action as DecisionInput["action"], ...(action === "edit" ? { value: note as string, note: note as string } : {}), decided_at: row.last_edited, decided_by: "notion" });
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
  const order = (item: Record<string, unknown>) => [DATABASES.indexOf(String(item.database) as typeof DATABASES[number]), String(item.page_id ?? item.id), String(item.field ?? item.property ?? "")].join("\u0000");
  for (const values of [plan.create, plan.updates, plan.corrections, plan.decisions, plan.conflicts, plan.ignored]) values.sort((a, b) => order(a as Record<string, unknown>).localeCompare(order(b as Record<string, unknown>)));
}

function notionFields(database: string, p: Record<string, unknown>, asOf: string): Record<string, unknown> {
  const mapping: Record<string, Record<string, string>> = { areas: { Type: "type", Archived: "archived" }, goals: { Status: "status", Progress: "progress", Archived: "archived" }, projects: { Status: "status", Priority: "priority", Dates: "dates", Archived: "archived" }, people: { Email: "email" }, orgs: { Relationship: "relationship", Website: "website" }, questions: { Status: "status" } };
  const fields: Record<string, unknown> = { as_of: asOf };
  for (const [name, key] of Object.entries(mapping[database] ?? {})) if (Object.hasOwn(p, name) && p[name] !== null) fields[key] = p[name];
  return fields;
}

function brainProperties(database: string): Array<[string, string]> {
  const common: Array<[string, string]> = [["Name", "title"], ["Summary", "summary"], ["Lifecycle", "lifecycle"]];
  const extras: Record<string, Array<[string, string]>> = { goals: [["Why", "why"], ["Deadline", "facts.deadline"], ["Area", "area"]], projects: [["Key Facts", "facts"], ["Area", "area"], ["Goal", "goal"], ["Client", "client"], ["People", "people"]], people: [["Role", "facts.role"], ["Org", "org"]], decisions: [["Assessment", "assessment"], ["Project", "projects"], ["Area", "derived_area"]], questions: [["Kind", "kind"], ["Project", "projects"], ["Area", "derived_area"]], concepts: [["Project", "concept_projects"], ["Area", "concept_area"]] };
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
  const p = input as Record<string, unknown>; const problems = unknownKeys(p, ["as_of", "create", "updates", "corrections", "decisions", "conflicts", "ignored"], "");
  if (!isTimestamp(p.as_of)) problems.push({ pointer: "/as_of", message: "must be an ISO 8601 UTC timestamp" });
  for (const key of ["create", "updates", "corrections", "decisions", "conflicts", "ignored"]) if (!Array.isArray(p[key])) problems.push({ pointer: `/${key}`, message: "must be a list" });
  (Array.isArray(p.create) ? p.create : []).forEach((item, index) => {
    if (!isRecord(item)) { problems.push({ pointer: `/create/${index}`, message: "must be an object" }); return; }
    problems.push(...unknownKeys(item, ["type", "id", "title", "file_date", "frontmatter", "body", "lifecycle"], `/create/${index}`));
    const { lifecycle: _lifecycle, ...note } = item;
    problems.push(...checkNoteInput(note, `/create/${index}`));
    if (item.lifecycle !== undefined && typeof item.lifecycle !== "string") problems.push({ pointer: `/create/${index}/lifecycle`, message: "must be a lifecycle string" });
  });
  assertNoProblems(problems);
  return { ...p, as_of: normalizeTimestamp(p.as_of)! } as unknown as SyncPlan;
}

export function applyPlan(workspace: Workspace, plan: SyncPlan, now: Date, recordOnly: boolean): Record<string, unknown> {
  const create: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const dependencyFailures = new Set<string>();
  for (let index = 0; index < plan.create.length; index += 1) {
    const item = plan.create[index]!; const checkpoint = workspace.checkpoint();
    try {
      if (item.id !== undefined && workspace.get(item.id) !== undefined) throw new Error("ID_IN_USE");
      const depends = references(item.frontmatter).some((id) => dependencyFailures.has(id));
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
  const log: LogEntry[] = [
    ...create.filter((item) => item.result === "applied").map((item) => ({ op: "sync-create", id: String(item.id), title: String(workspace.get(String(item.id))?.attributes.title ?? item.id) })),
    ...updates.filter((item) => item.result === "applied").map((item) => ({ op: "sync-update", id: String(item.id), title: String(workspace.get(String(item.id))?.attributes.title ?? item.id) })),
    ...(correctionApply?.log ?? []), ...(decisionApply.log ?? []),
  ];
  return { create, updates, corrections, decisions: decisionResult, conflicts: plan.conflicts, ignored: plan.ignored, summary: summarize([...create, ...updates, ...corrections, ...decisionResult].map((item) => ({ ...item }))), log };
}

function references(value: unknown): string[] { if (Array.isArray(value)) return value.flatMap(references); if (isRecord(value)) return Object.values(value).flatMap(references); return typeof value === "string" && /^(area|gol|prj|per|org|mtg|dec|que|con|src|mem)-/.test(value) ? [value] : []; }
function summarize(items: readonly Record<string, unknown>[]): Record<string, number> { const result: Record<string, number> = { applied: 0, closed: 0, recorded: 0, corrected: 0, skipped: 0, failed: 0 }; for (const item of items) if (typeof item.result === "string" && Object.hasOwn(result, item.result)) result[item.result] += 1; return result; }

export interface RenderItem { id: string; type: string; database: string; database_id: string; page_id: string | null; action: "create" | "update"; properties: Record<string, unknown>; body: string | null; sections: Record<string, string> | null; pending_relations: Array<Record<string, unknown>>; published: Record<string, unknown> }

export function render(workspace: Workspace, now: Date, ids?: readonly string[], held?: ReadonlyMap<string, Set<string>>): { items: RenderItem[]; errors: Array<Record<string, unknown>>; warnings: Array<{ code: string; message: string; id?: string }> } {
  const selected = ids === undefined ? workspace.notes.filter((note) => PUBLISHED_TYPES.has(note.type) && !(note.type === "source" && note.attributes.kind === undefined)) : ids.map((id) => workspace.get(id)!).filter(Boolean);
  const items: RenderItem[] = []; const errors: Array<Record<string, unknown>> = []; const warnings: Array<{ code: string; message: string; id?: string }> = [];
  for (const note of selected) {
    const database = DATABASE_FOR_TYPE[note.type]; if (database === undefined || (note.type === "source" && note.attributes.kind === undefined)) continue;
    const databaseId = databaseIdFor(workspace, database); if (databaseId === "") { warnings.push({ code: "DATABASE_NOT_CONFIGURED", message: `${database} database is not configured`, id: note.id }); continue; }
    if (note.type === "meeting" && typeof note.attributes.notion !== "string") { errors.push({ id: note.id, reason: "MEETING_NOT_PUBLISHED" }); continue; }
    if (note.type === "project" && typeof note.attributes.notion !== "string") { errors.push({ id: note.id, reason: "PROJECT_NOT_IN_NOTION" }); continue; }
    const capturePage = note.type === "source" && note.attributes.kind === "capture" && typeof note.attributes.source_key === "string" && note.attributes.source_key.startsWith("notion:") ? note.attributes.source_key.slice("notion:".length) : undefined;
    if (note.type === "source" && note.attributes.kind === "capture" && (capturePage === undefined || (typeof note.attributes.notion === "string" && note.attributes.notion !== capturePage))) { errors.push({ id: note.id, reason: "NOTION_ID_MISMATCH" }); continue; }
    const rendered = renderedBrainValues(note, workspace); const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : {};
    const properties: Record<string, unknown> = {}; const pending: Array<Record<string, unknown>> = []; const heldProperties = held?.get(note.id) ?? new Set<string>();
    const isCreate = note.attributes.notion === undefined && capturePage === undefined;
    for (const [name, value] of Object.entries(rendered)) { if (name === "@content" || heldProperties.has(name) || (capturePage !== undefined && name === "Name")) continue; const encoded = notionProperty(name, value, note, workspace, pending); if (encoded !== undefined && (isCreate || !Object.hasOwn(published, name) || !sameValue(value, published[name]))) properties[name] = encoded; }
    const content = renderedContent(note, workspace); if (content.hash !== undefined) rendered["@content"] = content.hash;
    const contentChanged = content.hash !== undefined && !isDeepStrictEqual(content.hash, published["@content"]);
    if (!isCreate && Object.keys(properties).length === 0 && !contentChanged) continue;
    if (!isCreate && note.type !== "meeting" && note.type !== "proposal") properties["Last Synced"] = { type: "date", value: { start: formatTimestamp(now), end: null } };
    items.push({ id: note.id, type: note.type, database, database_id: databaseId, page_id: typeof note.attributes.notion === "string" ? note.attributes.notion : capturePage ?? null, action: isCreate ? "create" : "update", properties, body: content.body, sections: content.sections, pending_relations: pending, published: rendered });
  }
  items.sort((a, b) => DATABASES.concat(["meetings"] as never[]).indexOf(a.database as never) - DATABASES.concat(["meetings"] as never[]).indexOf(b.database as never) || compareCodePoints(a.id, b.id));
  return { items, errors, warnings };
}

function databaseIdFor(workspace: Workspace, database: string): string { const notion = workspace.config.notion; if (!isRecord(notion) || !isRecord(notion.databases)) return ""; return typeof notion.databases[database] === "string" ? notion.databases[database] : database === "inbox" && typeof notion.databases.capture_inbox === "string" ? notion.databases.capture_inbox : ""; }
function renderedBrainValues(note: Note, workspace: Workspace): Record<string, unknown> {
  const a = note.attributes; const values: Record<string, unknown> = {};
  const common = () => Object.assign(values, { Name: a.title, Summary: a.summary ?? null, Lifecycle: select(a.lifecycle), "Brain ID": note.id });
  if (note.type === "proposal") {
    const target = typeof a.target === "string" ? workspace.get(a.target) : undefined;
    const addLink = a.kind === "add_link";
    const after = addLink
      ? proposalLinks(a).map((link) => `${fieldLabel(String(link.field))}: ${noteTitle(link.value, workspace)}`).join("\n")
      : undefined;
    const reviewText = (value: unknown) => truncate(typeof value === "string" ? reviewMarkdown(value, target) : value);
    Object.assign(values, {
      Name: a.title, Kind: select(a.kind), Target: target === undefined ? null : `${target.attributes.title} (${target.id})`,
      Before: reviewText(proposalBefore(a, workspace)), After: reviewText(after ?? proposalAfter(a, workspace)),
      Why: reviewText(a.why), State: select(proposalState(a.status)), "Brain ID": note.id,
    });
    return values;
  }
  if (note.type === "meeting") { Object.assign(values, { Decisions: relationPages(a.decisions, workspace), Questions: relationPages(a.questions, workspace), Attendees: relationPages(a.attendees, workspace), Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), "Brain Status": "Ingested", "Ingested At": dateOutput(a.created), "Brain ID": note.id }); return values; }
  if (note.type === "source") return sourceValues(note, workspace);
  common();
  if (note.type === "goal") Object.assign(values, { Why: a.why ?? null, Deadline: dateOutput(isRecord(a.facts) ? a.facts.deadline : undefined), Area: relationPages(a.area === undefined ? [] : [a.area], workspace) });
  if (note.type === "project") Object.assign(values, { "Key Facts": keyFactsText(a.facts, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace), Goal: relationPages(a.goal === undefined ? [] : [a.goal], workspace), Client: relationPages(a.client === undefined ? [] : [a.client], workspace), People: relationPages(a.people, workspace) });
  if (note.type === "person") Object.assign(values, { Role: isRecord(a.facts) ? a.facts.role ?? null : null, Org: relationPages(a.org === undefined ? [] : [a.org], workspace) });
  if (note.type === "decision") Object.assign(values, { Date: dateOutput(a.date), Assessment: select(a.assessment), Area: relationPages(projectAreas(a.projects, workspace), workspace), Project: relationPages(a.projects, workspace), "Decided In": relationPages(a.decided_in === undefined ? [] : [a.decided_in], workspace), Supersedes: relationPages((Array.isArray(a.relations) ? a.relations.filter(isRecord).filter((x) => x.type === "supersedes").map((x) => x.target) : []), workspace) });
  if (note.type === "question") Object.assign(values, { Kind: select(a.kind), Area: relationPages(projectAreas(a.projects, workspace), workspace), Project: relationPages(a.projects, workspace), "Raised In": relationPages(a.raised_in === undefined ? [] : [a.raised_in], workspace) });
  if (note.type === "concept") Object.assign(values, { Project: relationPages(a.projects, workspace), Area: relationPages(a.area === undefined ? [] : [a.area], workspace) });
  return values;
}

/** Area on decisions and questions is a derived Notion relation (decision 0034). */
function projectAreas(projects: unknown, workspace: Workspace): string[] {
  const areas = (Array.isArray(projects) ? projects : []).flatMap((project) => {
    const area = workspace.get(String(project))?.attributes.area;
    return typeof area === "string" ? [area] : [];
  });
  return [...new Set(areas)].sort(compareCodePoints);
}

function sourceValues(note: Note, workspace: Workspace): Record<string, unknown> {
  const produced = workspace.notes.filter((candidate) => ["decision", "question", "concept", "person"].includes(candidate.type) && Array.isArray(candidate.attributes.sources) && candidate.attributes.sources.includes(note.id));
  const ids = (type: string) => produced.filter((candidate) => candidate.type === type).map((candidate) => candidate.id).sort(compareCodePoints);
  const projects = [...new Set(produced.flatMap((candidate) => Array.isArray(candidate.attributes.projects) ? candidate.attributes.projects.filter((id): id is string => typeof id === "string") : []))].sort(compareCodePoints);
  const areas = [...new Set([...produced.map((candidate) => candidate.attributes.area).filter((id): id is string => typeof id === "string"), ...projects.flatMap((id) => { const area = workspace.get(id)?.attributes.area; return typeof area === "string" ? [area] : []; })])].sort(compareCodePoints);
  return { Name: note.attributes.title, Kind: select(note.attributes.kind), Summary: note.attributes.summary ?? null, Decisions: relationPages(ids("decision"), workspace), Questions: relationPages(ids("question"), workspace), Concepts: relationPages(ids("concept"), workspace), People: relationPages(ids("person"), workspace), Project: relationPages(projects, workspace), Area: relationPages(areas, workspace), "Brain Status": "Processed", "Brain ID": note.id };
}

function notionProperty(name: string, value: unknown, note: Note, workspace: Workspace, pending: Array<Record<string, unknown>>): unknown {
  const relation = ["Area", "Goal", "Client", "People", "Org", "Project", "Decided In", "Raised In", "Supersedes", "Decisions", "Questions", "Concepts", "Attendees"].includes(name);
  if (relation) {
    const sourceField: Record<string, string> = { Area: "area", Goal: "goal", Client: "client", People: "people", Org: "org", Project: "projects", "Decided In": "decided_in", "Raised In": "raised_in", Decisions: "decisions", Questions: "questions", Attendees: "attendees" };
    const raw = name === "Area" && (note.type === "decision" || note.type === "question") ? projectAreas(note.attributes.projects, workspace) : name === "Supersedes" ? (Array.isArray(note.attributes.relations) ? note.attributes.relations.filter(isRecord).filter((item) => item.type === "supersedes").map((item) => item.target) : []) : note.type === "source" ? sourceRelationIds(note, name, workspace) : note.attributes[sourceField[name] ?? ""];
    const missing = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]).map(String).filter((id) => typeof workspace.get(id)?.attributes.notion !== "string");
    if (missing.length > 0) pending.push({ property: name, ids: missing });
    const mode = (note.type === "meeting" || note.type === "source") ? (["Project", "Area"].includes(name) ? "if_empty" : note.type === "meeting" ? "add" : undefined) : undefined;
    return { type: "relation", value: Array.isArray(value) ? value : [], ...(mode === undefined ? {} : { mode }) };
  }
  if (["Lifecycle", "Assessment", "Kind", "State", "Brain Status"].includes(name)) return { type: "select", value };
  if (name === "Last Synced" || name === "Date" || name === "Deadline" || name === "Ingested At") return { type: "date", value };
  return { type: name === "Name" ? "title" : "rich_text", value };
}
function sourceRelationIds(note: Note, name: string, workspace: Workspace): string[] {
  const produced = workspace.notes.filter((candidate) => ["decision", "question", "concept", "person"].includes(candidate.type) && Array.isArray(candidate.attributes.sources) && candidate.attributes.sources.includes(note.id));
  if (name === "Decisions") return produced.filter((candidate) => candidate.type === "decision").map((candidate) => candidate.id);
  if (name === "Questions") return produced.filter((candidate) => candidate.type === "question").map((candidate) => candidate.id);
  if (name === "Concepts") return produced.filter((candidate) => candidate.type === "concept").map((candidate) => candidate.id);
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
function renderedContent(note: Note, workspace: Workspace): { body: string | null; sections: Record<string, string> | null; hash?: string } { if (note.type === "decision" || note.type === "question" || note.type === "concept") { const body = notionMarkdown(note.body, note, workspace); return { body, sections: null, hash: hash(body) }; } if (note.type === "project") { const brief = workspace.notes.find((x) => x.path === `${note.path.slice(0, note.path.lastIndexOf("/"))}/brief.md`); const log = workspace.notes.find((x) => x.path === `${note.path.slice(0, note.path.lastIndexOf("/"))}/decision-log.md`); const sections = { Brief: notionMarkdown(generatedBlock(brief?.body ?? ""), note, workspace), "Decision log": notionMarkdown(generatedBlock(log?.body ?? ""), note, workspace) }; return { body: null, sections, hash: hash(JSON.stringify(sections)) }; } return { body: null, sections: null }; }
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
function proposalBefore(attributes: Record<string, unknown>, workspace: Workspace): unknown {
  if (attributes.kind === "add_link") return null;
  if (attributes.kind === "supersede") return truncate(noteTitle(attributes.supersedes, workspace));
  if (attributes.kind === "merge") return truncate(noteTitle(attributes.target, workspace));
  return truncate(attributes.before ?? null);
}
function proposalAfter(attributes: Record<string, unknown>, workspace: Workspace): unknown {
  if (attributes.kind === "add_to_note") return attributes.content ?? null;
  if (attributes.kind === "new_item" && isRecord(attributes.note)) return `${attributes.note.title ?? ""} (${attributes.note.type ?? ""})`;
  if (attributes.kind === "supersede") return noteTitle(attributes.target, workspace);
  if (attributes.kind === "merge") return noteTitle(attributes.merge_into, workspace);
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
    put("title", "title", item.title); put("status", "select", config.new_task_status); if (item.due !== undefined) put("due", "date", dateOutput(item.due)); if (!sourceMode && item.owner !== undefined) put("owner", "person_name", item.owner);
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
function tasksConfig(workspace: Workspace): { database: string; properties: Record<string, string>; new_task_status: string } { if (!loadSchemas().brain(workspace.config)) throw new BrainError("BRAIN_CONFIG_INVALID", "brain.json fails its schema"); const notion = workspace.config.notion as Record<string, unknown>; const tasks = notion.tasks as Record<string, unknown>; if (typeof tasks.database !== "string" || tasks.database === "") throw new BrainError("BRAIN_CONFIG_INVALID", "Tasks database is not configured"); return { database: tasks.database as string, properties: tasks.properties as Record<string, string>, new_task_status: tasks.new_task_status as string }; }

export function record(workspace: Workspace, input: unknown): Record<string, unknown> {
  if (!isRecord(input) || !Array.isArray(input.records)) throw new BrainError("INPUT_INVALID", "record input needs a records list"); const records: Array<Record<string, unknown>> = [];
  for (const entry of input.records) { if (!isRecord(entry) || typeof entry.id !== "string" || !isTimestamp(entry.synced_at)) throw new BrainError("INPUT_INVALID", "each record needs id and synced_at"); const syncedAt = normalizeTimestamp(entry.synced_at)!; const note = workspace.get(entry.id); if (note === undefined) { records.push({ id: entry.id, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; } const checkpoint = workspace.checkpoint(); try { const doc = workspace.edit(note); if (typeof entry.notion === "string") { if (doc.attributes.notion !== undefined && doc.attributes.notion !== entry.notion) throw new Error("NOTION_ID_MISMATCH"); doc.attributes.notion = entry.notion; } if (isRecord(entry.published)) doc.attributes.notion_published = { ...(isRecord(doc.attributes.notion_published) ? doc.attributes.notion_published : {}), ...entry.published }; if (note.type !== "view" && note.type !== "proposal") doc.attributes.last_synced = syncedAt; if ((note.type === "meeting" || note.type === "source") && Array.isArray(entry.tasks)) doc.attributes.tasks = [...new Set([...(Array.isArray(doc.attributes.tasks) ? doc.attributes.tasks : []), ...entry.tasks.filter((id): id is string => typeof id === "string")])]; workspace.save(note.path, doc); const errors = workspace.newErrors(); if (errors.length > 0) throw new Error("INVALID_RESULT"); records.push({ id: note.id, result: "recorded", changed: workspace.changedSince(checkpoint) }); } catch (error) { workspace.restore(checkpoint); records.push({ id: entry.id, result: "failed", reason: error instanceof Error && error.message === "NOTION_ID_MISMATCH" ? "NOTION_ID_MISMATCH" : "INVALID_RESULT", changed: [] }); } }
  return { records };
}
