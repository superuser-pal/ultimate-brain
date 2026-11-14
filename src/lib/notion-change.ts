import { isDeepStrictEqual } from "node:util";

import { BrainError } from "./errors.ts";
import { isRecord } from "./input.ts";
import { databaseId, modulesOf } from "./modules.ts";
import type { Note } from "./notes.ts";
import { formatDate } from "./time.ts";
import type { LogEntry } from "./log.ts";
import type { Workspace } from "./workspace.ts";

/**
 * The Ultimate Assistant proposal kinds (spec/assistant.md §6, spec/schema.md §11, spec/cli.md §5.6, §5.7, §5.14.4):
 * `notion_change`, a change to a Notion-owned property that the skill writes through the MCP, and `set_field`,
 * a change to a brain-owned placement field (the `area` of a project, decision, question, Document or source; an Area's `domain`).
 */

/** The properties each database takes on a notion_change (spec/cli.md §5.6). */
const PROPERTIES: Readonly<Record<string, readonly string[]>> = { tasks: ["status", "due", "project", "area"], projects: ["status", "archived"], areas: ["archived"] };
const PROJECT_STATUSES = ["Planned", "Active", "On Hold", "Done"];
const LABELS: Readonly<Record<string, string>> = { status: "Status", due: "Due", project: "Project", area: "Area", archived: "Archived", domain: "Domain" };
const PAGE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** The `source` prefix of every proposal Ultimate Assistant writes (spec/cli.md §5.6). */
export const ASSISTANT_SOURCE = "agent:ultimate-assistant/";
/** set_field: the target types each field takes, and the type of note it names (0072, 0092). */
const SET_FIELDS: Readonly<Record<string, { targets: readonly string[]; type: string }>> = { area: { targets: ["project", "decision", "question", "reference", "source"], type: "area" }, domain: { targets: ["area"], type: "domain" } };
const TARGET_NAMES: Readonly<Record<string, string>> = { project: "project", decision: "decision", question: "question", reference: "Document", source: "source", area: "Area" };

/**
 * A source and its whole Documents move together (0092 §3, spec/cli.md §5.6): the group of a source or of a
 * Document with `origin: whole` is the source and every whole Document whose `sources` is exactly it. Any other
 * note is a group of one. The target comes first.
 */
export function areaGroup(workspace: Workspace, target: Note): Note[] {
  const whole = (note: Note) => note.type === "reference" && note.attributes.origin === "whole" && Array.isArray(note.attributes.sources) && note.attributes.sources.length === 1;
  let source: Note | undefined;
  if (target.type === "source") source = target;
  else if (whole(target)) { const named = workspace.get(String((target.attributes.sources as unknown[])[0])); if (named?.type === "source") source = named; }
  if (source === undefined) return [target];
  const members = [source, ...workspace.notes.filter((note) => whole(note) && (note.attributes.sources as unknown[])[0] === source!.id)];
  return [target, ...members.filter((note) => note.id !== target.id)];
}

/** Why a decision or question can't take a set_field on `area`: its Area comes from its projects (0034, 0092 §2). */
export function projectsProblem(workspace: Workspace, target: Note): string | undefined {
  if (target.type !== "decision" && target.type !== "question") return undefined;
  const projects = Array.isArray(target.attributes.projects) ? target.attributes.projects.map(String) : [];
  if (projects.length === 0) return undefined;
  const named = projects.map((id) => { const title = workspace.get(id)?.attributes.title; return typeof title === "string" ? `${title} (${id})` : id; }).join(", ");
  return `${target.id} takes its Area from its project${projects.length === 1 ? "" : "s"} ${named}: move the project instead`;
}

export interface NotionWrite {
  proposal: string;
  database: string;
  page_id: string;
  property: string;
  payload: { type: string; value: unknown };
  expect: unknown;
  value: unknown;
}

const invalid = (pointer: string, message: string): never => {
  throw new BrainError("INPUT_INVALID", `${pointer} ${message}`, [{ pointer, message }]);
};
const unknownId = (pointer: string, id: unknown): never => {
  throw new BrainError("UNKNOWN_ID", `${pointer}: no note with id ${String(id)}`, [{ pointer, message: "does not exist" }]);
};

/** Why a value doesn't fit a notion_change property, or undefined when it does (spec/schema.md §11). */
export function notionValueProblem(database: string, property: string, value: unknown, after: boolean): string | undefined {
  if (property === "status") {
    if (value === null) return after ? "can't be null on status" : undefined;
    if (typeof value !== "string" || value.trim() === "") return "must be a non-empty string or null";
    if (database === "projects" && !PROJECT_STATUSES.includes(value)) return `must be one of ${PROJECT_STATUSES.join(", ")}`;
    return undefined;
  }
  if (property === "due") return value === null || (typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))) ? undefined : "must be a YYYY-MM-DD date or null";
  if (property === "project" || property === "area") {
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !PAGE.test(id))) return "must be a list of page ids (dashed, lowercase)";
    const sorted = [...new Set(value as string[])].sort();
    return isDeepStrictEqual(sorted, value) ? undefined : "must be sorted and without duplicates";
  }
  if (property === "archived") return typeof value === "boolean" ? undefined : "must be a boolean";
  return "is not a notion_change property";
}

/**
 * Check a notion_change input item against the brain (spec/cli.md §5.6). Throws INPUT_INVALID,
 * UNKNOWN_ID or MODULE_OFF; returns whether it changes nothing (`NO_CHANGE`).
 */
export function checkNotionChange(workspace: Workspace, item: Record<string, unknown>, pointer: string): { noChange: boolean } {
  const database = item.database;
  if (typeof database !== "string" || PROPERTIES[database] === undefined) invalid(`${pointer}/database`, "must be tasks, projects or areas");
  const db = database as string;
  if (typeof item.property !== "string" || !PROPERTIES[db]!.includes(item.property)) invalid(`${pointer}/property`, `must be one of ${PROPERTIES[db]!.join(", ")} on ${db}`);
  const property = item.property as string;
  if (db === "tasks") {
    if (!modulesOf(workspace.config).tasks) throw new BrainError("MODULE_OFF", "The Tasks module is off: brain modules on tasks", [{ pointer: `${pointer}/database`, message: "the Tasks module is off" }]);
    if (taskProperty(workspace, property) === "") invalid(`${pointer}/property`, `has no mapping in notion.tasks.properties.${property}`);
    if (item.target !== undefined) invalid(`${pointer}/target`, "a task has no note: leave target out");
  } else if (databaseId(workspace.config, db) === "") {
    invalid(`${pointer}/database`, `the ${db} database is not configured in brain.json`);
  }
  if (typeof item.page !== "string" || !PAGE.test(item.page)) invalid(`${pointer}/page`, "must be a Notion page id, dashed and lowercase");
  if (typeof item.page_title !== "string" || item.page_title.trim() === "") invalid(`${pointer}/page_title`, "must be the row's Name");
  for (const key of ["value_before", "value_after"]) {
    if (!Object.hasOwn(item, key)) invalid(`${pointer}/${key}`, "is required");
    const problem = notionValueProblem(db, property, item[key], key === "value_after");
    if (problem !== undefined) invalid(`${pointer}/${key}`, problem);
  }
  if (db !== "tasks") {
    if (typeof item.target !== "string") invalid(`${pointer}/target`, `must be the ${db === "projects" ? "project" : "Area"} of the page`);
    const target = workspace.get(item.target as string) ?? unknownId(`${pointer}/target`, item.target);
    const type = db === "projects" ? "project" : "area";
    if (target.type !== type) invalid(`${pointer}/target`, `is a ${target.type}; the ${db} database holds ${type} pages`);
    if (target.attributes.notion !== undefined && target.attributes.notion !== item.page) invalid(`${pointer}/page`, `is not ${target.id}'s page (${String(target.attributes.notion)})`);
  }
  checkArea(workspace, item, pointer);
  return { noChange: isDeepStrictEqual(item.value_before, item.value_after) };
}

/** Check a set_field input item and fill `before` and `area` (spec/cli.md §5.6). Returns whether it changes nothing. */
export function resolveSetField(workspace: Workspace, item: Record<string, unknown>, fields: Record<string, unknown>, pointer: string): { noChange: boolean } {
  const spec = typeof item.field === "string" ? SET_FIELDS[item.field] : undefined;
  if (spec === undefined) invalid(`${pointer}/field`, "must be area (a project, decision, question, Document or source) or domain (an Area)");
  const target = workspace.get(String(item.target)) ?? unknownId(`${pointer}/target`, item.target);
  if (!spec!.targets.includes(target.type)) invalid(`${pointer}/field`, `${String(item.field)} is set on a ${spec!.targets.map((type) => TARGET_NAMES[type]).join(", ")}, and ${target.id} is a ${TARGET_NAMES[target.type] ?? target.type}`);
  if (item.field === "area") { const problem = projectsProblem(workspace, target); if (problem !== undefined) invalid(`${pointer}/target`, problem); }
  const after = typeof item.after === "string" ? workspace.get(item.after) : undefined;
  if (after === undefined) unknownId(`${pointer}/after`, item.after);
  if (after!.type !== spec!.type) invalid(`${pointer}/after`, `is a ${after!.type}; ${String(item.field)} names a ${spec!.type}`);
  const current = target.attributes[item.field as string];
  if (item.before !== undefined && !isDeepStrictEqual(item.before, current)) {
    throw new BrainError("BEFORE_MISMATCH", `${pointer}/before is ${JSON.stringify(item.before)}, but ${target.id} ${String(item.field)} is ${current === undefined ? "absent" : JSON.stringify(current)}`, [{ pointer: `${pointer}/before`, message: "differs from the note's current value" }]);
  }
  if (current === undefined) delete fields.before;
  else fields.before = current;
  checkArea(workspace, item, pointer);
  if (fields.area === undefined) {
    const home = target.type === "area" ? target.id : target.attributes.area;
    if (typeof home === "string") fields.area = home;
  }
  // On a group, NO_CHANGE only when every note of it already has `after` (spec/cli.md §5.6).
  return { noChange: areaGroup(workspace, target).every((note) => isDeepStrictEqual(note.attributes[item.field as string], item.after)) };
}

function checkArea(workspace: Workspace, item: Record<string, unknown>, pointer: string): void {
  if (item.area === undefined) return;
  const area = typeof item.area === "string" ? workspace.get(item.area) : undefined;
  if (area === undefined) unknownId(`${pointer}/area`, item.area);
  if (area!.type !== "area") invalid(`${pointer}/area`, `is a ${area!.type}, not an Area`);
}

/** The Tasks mapping's Notion property name for a notion_change property, "" when unmapped. */
function taskProperty(workspace: Workspace, property: string): string {
  const notion = isRecord(workspace.config.notion) ? workspace.config.notion : {};
  const tasks = isRecord(notion.tasks) ? notion.tasks : {};
  const properties = isRecord(tasks.properties) ? tasks.properties : {};
  return typeof properties[property] === "string" ? properties[property] : "";
}

/** A value as a Review row and a default title show it (spec/cli.md §5.14.4). */
/** `title` names a note as the surface shows it: on a Review row, by its published form (cli §5.14.4, "Restricted notes"). */
export function shownValue(value: unknown, workspace: Workspace, noteIds = false, title: NoteTitle = (note) => note.attributes.title): string {
  if (value === null || value === undefined) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.map((id) => titleOfPage(workspace, String(id), title)).join(", ");
  if (noteIds && typeof value === "string") { const note = workspace.get(value); return String((note === undefined ? undefined : title(note)) ?? value); }
  return String(value);
}

type NoteTitle = (note: Note) => unknown;

function titleOfPage(workspace: Workspace, page: string, title: NoteTitle): string {
  const note = workspace.notes.find((candidate) => candidate.attributes.notion === page);
  const shown = note === undefined ? undefined : title(note);
  return typeof shown === "string" ? shown : page;
}

const cut = (title: string) => (title.length > 120 ? `${title.slice(0, 119)}…` : title);

/** `<page_title>: <Property> → <value_after>` and `<target title>: <Field> → <after title>` (spec/cli.md §5.6). */
export function defaultTitle(workspace: Workspace, fields: Record<string, unknown>): string {
  if (fields.kind === "notion_change") return cut(`${String(fields.page_title)}: ${LABELS[String(fields.property)]} → ${shownValue(fields.value_after, workspace)}`);
  const target = workspace.get(String(fields.target));
  return cut(`${String(target?.attributes.title ?? fields.target)}: ${LABELS[String(fields.field)]} → ${shownValue(fields.after, workspace, true)}`);
}

/** The pending, approved or edited notion_change, or pending set_field, this change repeats (spec/cli.md §5.6 dedupe). */
export function duplicateOf(workspace: Workspace, fields: Record<string, unknown>): Note | undefined {
  return workspace.notes.find((note) => {
    if (note.type !== "proposal" || note.attributes.kind !== fields.kind) return false;
    const a = note.attributes;
    if (fields.kind === "notion_change") return ["pending", "approved", "edited"].includes(String(a.status)) && a.page === fields.page && a.property === fields.property && isDeepStrictEqual(a.value_after, fields.value_after);
    return a.status === "pending" && a.target === fields.target && a.field === fields.field && a.after === fields.after;
  });
}

/** The Notion write an approved or fixed notion_change hands the skill (spec/cli.md §5.7). Throws NOT_MAPPED as `{ reason }`. */
export function notionWrite(workspace: Workspace, id: string, p: Record<string, unknown>, value: unknown): NotionWrite | { reason: "NOT_MAPPED"; message: string } {
  const database = String(p.database);
  const property = String(p.property);
  const name = database === "tasks" ? taskProperty(workspace, property) : LABELS[property]!;
  if (name === "") return { reason: "NOT_MAPPED", message: `notion.tasks.properties.${property} is empty: the Tasks mapping no longer has this property` };
  const notion = isRecord(workspace.config.notion) ? workspace.config.notion : {};
  const tasks = isRecord(notion.tasks) ? notion.tasks : {};
  const payload = property === "status"
    ? { type: database === "tasks" && tasks.status_type === "status" ? "status" : "select", value }
    : property === "due" ? { type: "date", value: value === null ? null : { start: value, end: null } }
      : property === "archived" ? { type: "checkbox", value }
        : { type: "relation", value };
  return { proposal: id, database, page_id: String(p.page), property: name, payload, expect: p.value_before, value };
}

/** The fix's value of a notion_change or set_field (spec/schema.md §11.3); the message says why it doesn't fit. */
export function fixValueProblem(workspace: Workspace, p: Record<string, unknown>, value: unknown): string | undefined {
  if (p.kind === "notion_change") {
    const problem = notionValueProblem(String(p.database), String(p.property), value, true);
    return problem === undefined ? undefined : `the fix's value ${problem}`;
  }
  const spec = SET_FIELDS[String(p.field)];
  const note = typeof value === "string" ? workspace.get(value) : undefined;
  return note !== undefined && note.type === spec?.type ? undefined : `${String(value)} must be an existing ${spec?.type ?? "note"}`;
}

/** Whether a proposal was decided in chat before it had a Review row: it never gets one (spec/cli.md §5.14.4). */
export function decidedInChat(note: Note): boolean {
  const a = note.attributes;
  // A reflection answer (it carries a fingerprint) decided in chat is the same (cli.md §5.14.4, §6.2).
  return note.type === "proposal" && ((typeof a.source === "string" && a.source.startsWith(ASSISTANT_SOURCE)) || typeof a.fingerprint === "string") && typeof a.notion !== "string" && isRecord(a.decision) && a.decision.decided_by === "chat";
}

/** About, About Page, Now and Proposed of a Suggestion row (spec/cli.md §5.14.4). */
export function suggestionText(a: Record<string, unknown>, workspace: Workspace, title: NoteTitle = (note) => note.attributes.title): { name: string; about: string; aboutPage: string | null; now: string; proposed: string } {
  const name = typeof a.title === "string" && !a.title.startsWith("Suggestion: ") ? `Suggestion: ${a.title}` : String(a.title);
  const url = (page: unknown) => (typeof page === "string" ? `https://www.notion.so/${page.replaceAll("-", "")}` : null);
  if (a.kind === "notion_change") {
    const label = LABELS[String(a.property)];
    return { name, about: a.database === "tasks" ? `${String(a.page_title)} (task)` : `${String(a.page_title)} (${String(a.target)})`, aboutPage: url(a.page), now: `${label}: ${shownValue(a.value_before, workspace, false, title)}`, proposed: `${label}: ${shownValue(a.value_after, workspace, false, title)}` };
  }
  const target = workspace.get(String(a.target));
  const label = LABELS[String(a.field)];
  return { name, about: `${String((target === undefined ? undefined : title(target)) ?? a.target)} (${String(a.target)})`, aboutPage: url(target?.attributes.notion), now: `${label}: ${shownValue(a.before, workspace, true, title)}`, proposed: `${label}: ${shownValue(a.after, workspace, true, title)}` };
}

export interface SettleResult {
  proposal: string;
  result: "applied" | "closed" | "skipped" | "failed";
  reason?: string;
  changed: string[];
}

/** Parse `proposal settle`'s input (spec/cli.md §5.6). */
export function parseSettleInput(input: unknown): Array<{ proposal: string; result: "applied" | "stale" }> {
  const problems: Array<{ pointer: string; message: string }> = [];
  if (!isRecord(input) || !Array.isArray(input.settled)) throw new BrainError("INPUT_INVALID", "settle input needs a settled list", [{ pointer: "/settled", message: "must be a list" }]);
  for (const key of Object.keys(input)) if (key !== "settled") problems.push({ pointer: `/${key}`, message: "unknown key" });
  input.settled.forEach((item, index) => {
    const pointer = `/settled/${index}`;
    if (!isRecord(item)) { problems.push({ pointer, message: "must be an object" }); return; }
    for (const key of Object.keys(item)) if (key !== "proposal" && key !== "result") problems.push({ pointer: `${pointer}/${key}`, message: "unknown key" });
    if (typeof item.proposal !== "string") problems.push({ pointer: `${pointer}/proposal`, message: "must be a proposal id" });
    if (item.result !== "applied" && item.result !== "stale") problems.push({ pointer: `${pointer}/result`, message: "must be applied or stale" });
  });
  if (problems.length > 0) throw new BrainError("INPUT_INVALID", `${problems.length} problem${problems.length === 1 ? "" : "s"} in input: ${problems.map((p) => `${p.pointer} ${p.message}`).join("; ")}`, problems);
  return input.settled as Array<{ proposal: string; result: "applied" | "stale" }>;
}

/**
 * `proposal settle` (spec/cli.md §5.6, assistant.md §6.4): record what the skill did with each Notion write.
 * Atomic per item; the caller commits.
 */
export function settle(workspace: Workspace, items: ReadonlyArray<{ proposal: string; result: "applied" | "stale" }>, now: Date): { settled: SettleResult[]; log: LogEntry[] } {
  const settled: SettleResult[] = [];
  const log: LogEntry[] = [];
  for (const item of items) {
    const note = workspace.get(item.proposal);
    if (note === undefined || note.type !== "proposal") { settled.push({ proposal: item.proposal, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; }
    const status = String(note.attributes.status);
    if (status === "applied" || status === "closed") { settled.push({ proposal: item.proposal, result: "skipped", reason: "ALREADY_TERMINAL", changed: [] }); continue; }
    if (note.attributes.kind !== "notion_change" || (status !== "approved" && status !== "edited")) { settled.push({ proposal: item.proposal, result: "failed", reason: "NOT_AWAITING", changed: [] }); continue; }
    const start = workspace.checkpoint();
    const document = workspace.edit(note);
    const result = item.result === "applied" ? "applied" : "closed";
    document.attributes.status = result;
    if (result === "closed") document.attributes.closed_reason = "stale";
    document.attributes.updated = formatDate(now);
    workspace.save(note.path, document);
    if (workspace.newErrors().length > 0) {
      workspace.restore(start);
      settled.push({ proposal: item.proposal, result: "failed", reason: "INVALID_RESULT", changed: [] });
      continue;
    }
    settled.push({ proposal: item.proposal, result, changed: workspace.changedSince(start) });
    log.push({ op: "apply", id: note.id, title: String(note.attributes.title ?? ""), pairs: [["result", result]] });
  }
  return { settled, log };
}
