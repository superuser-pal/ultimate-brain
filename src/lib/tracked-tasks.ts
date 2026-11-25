import { isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { modulesOf } from "./modules.ts";
import { writeProposal } from "./proposals.ts";
import { contextFor, requireSuppressions } from "./suppressions.ts";
import { formatDate, normalizeTimestamp } from "./time.ts";
import type { LogEntry } from "./log.ts";
import type { Workspace } from "./workspace.ts";
import { taskProperty } from "./notion-change.ts";
import { atomically, namedTitle, updatePending, type Withdrawn } from "./notion-corrections.ts";

/**
 * A tracked question's task, read in Notion (0.16.0, decision 0101 §6; cli §5.14.1, §5.14.2, §5.14.3). The brain never stores a task's
 * status (0018): sync reads it each time, and a finished, trashed or unreadable task leaves one waiting `tracked_task` question.
 */

/** A `tasks` row of the snapshot (cli §5.14.1). `last_edited` is null on a page Notion can't find. */
export interface TaskRow {
  database: "tasks";
  page_id: string;
  last_edited: string | null;
  properties: Record<string, unknown>;
  /** The status option's group (`todo`, `in_progress`, `complete`) for a Notion Status property; null for a select. */
  status_group?: string | null;
  /** The page is in Notion's trash. */
  gone?: true;
  /** Notion can't find the page: deleted for good, or outside the integration's access. */
  unreadable?: true;
}

export type TaskState = "done" | "dropped" | "gone" | "unreadable";

/** A `tracked_tasks` item of a sync plan (cli §5.14.2). */
export interface PlannedTrackedTask {
  question: string;
  page_id: string;
  page_title?: string;
  state: TaskState;
  status: string | null;
  observed_at: string | null;
  proposal?: string;
}

/** The problems of one `tasks` row of a snapshot, at `pointer` (cli §5.14.1). */
export function taskRowProblems(value: Record<string, unknown>, pointer: string): InputProblem[] {
  const problems = unknownKeys(value, ["database", "page_id", "last_edited", "properties", "status_group", "gone", "unreadable"], pointer);
  if (typeof value.page_id !== "string" || value.page_id === "") problems.push({ pointer: `${pointer}/page_id`, message: "must be a non-empty string" });
  if (!isRecord(value.properties)) problems.push({ pointer: `${pointer}/properties`, message: "must be an object" });
  if (value.status_group !== undefined && value.status_group !== null && !["todo", "in_progress", "complete"].includes(String(value.status_group))) problems.push({ pointer: `${pointer}/status_group`, message: "must be todo, in_progress, complete or null" });
  if (value.gone !== undefined && value.gone !== true) problems.push({ pointer: `${pointer}/gone`, message: "must be true when present" });
  if (value.unreadable !== undefined && value.unreadable !== true) problems.push({ pointer: `${pointer}/unreadable`, message: "must be true when present" });
  if (value.gone === true && value.unreadable === true) problems.push({ pointer: `${pointer}/unreadable`, message: "a page is either in the trash or unreadable, not both" });
  if (value.unreadable === true) {
    if (value.last_edited !== null) problems.push({ pointer: `${pointer}/last_edited`, message: "must be null on an unreadable page" });
    if (isRecord(value.properties) && Object.keys(value.properties).length > 0) problems.push({ pointer: `${pointer}/properties`, message: "must be empty on an unreadable page" });
  } else if (normalizeTimestamp(value.last_edited) === undefined) problems.push({ pointer: `${pointer}/last_edited`, message: "must be an ISO 8601 UTC timestamp" });
  return problems;
}

/** A parsed `tasks` row, its timestamp normalized. */
export function parseTaskRow(value: Record<string, unknown>): TaskRow {
  return { ...(value as unknown as TaskRow), last_edited: value.last_edited === null ? null : normalizeTimestamp(value.last_edited)! };
}

/** An open question (schema §4, 0099): no answer, not dropped, not archived. */
function isOpen(note: Note): boolean {
  return note.type === "question" && note.attributes.answer === undefined && note.attributes.dropped === undefined && note.attributes.lifecycle !== "archived";
}

/** Tracked questions (schema §4: open, with a `task`), by their task's page id. */
function trackedByPage(workspace: Workspace): Map<string, Note> {
  const out = new Map<string, Note>();
  for (const note of workspace.notes) if (isOpen(note) && typeof note.attributes.task === "string" && !out.has(note.attributes.task)) out.set(note.attributes.task, note);
  return out;
}

/** `brain sync tracked` (cli §5.14.1): every tracked question with its task's page id and its title, sorted by id. */
export function trackedQuestions(workspace: Workspace): Array<{ question: string; page_id: string; title: string }> {
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  return workspace.notes.filter((note) => isOpen(note) && typeof note.attributes.task === "string")
    .sort((a, b) => compareCodePoints(a.id, b.id))
    .map((note) => ({ question: note.id, page_id: String(note.attributes.task), title: namedTitle(note, context) }));
}

interface TasksConfig { title: string; status: string; wontDo: string }
function tasksConfig(config: Record<string, unknown>): TasksConfig {
  const notion = isRecord(config.notion) ? config.notion : {};
  const tasks = isRecord(notion.tasks) ? notion.tasks : {};
  const properties = isRecord(tasks.properties) ? tasks.properties : {};
  const text = (value: unknown) => typeof value === "string" ? value : "";
  return { title: text(properties.title), status: text(properties.status), wontDo: typeof tasks.wont_do_status === "string" && tasks.wont_do_status.trim() !== "" ? tasks.wont_do_status : "Won't Do" };
}

const fold = (value: string) => value.trim().toLowerCase();

/** A task row's state by assistant.md §3.1's task states (cli §5.14.2), or null when it isn't finished. */
export function taskState(row: TaskRow, config: Record<string, unknown>): { state: TaskState; status: string | null } | null {
  if (row.gone === true) return { state: "gone", status: null };
  if (row.unreadable === true) return { state: "unreadable", status: null };
  const mapping = tasksConfig(config);
  const status = mapping.status === "" ? undefined : row.properties[mapping.status];
  if (typeof status !== "string" || status.trim() === "") return null;
  if (fold(status) === fold(mapping.wontDo)) return { state: "dropped", status };
  if (row.status_group === "complete" || ((row.status_group === undefined || row.status_group === null) && fold(status) === "done")) return { state: "done", status };
  return null;
}

/** The plan fields a tasks row fills, and the ignored list (cli §5.14.2). */
export interface TaskPlanOut {
  tracked_tasks: PlannedTrackedTask[];
  withdrawn: Withdrawn[];
  ignored: Array<Record<string, unknown>>;
}

/** The tracked_task proposals of a question and its page, every status. */
function trackedProposals(workspace: Workspace, question: string, page: string): Note[] {
  return workspace.notes.filter((note) => note.type === "proposal" && note.attributes.kind === "tracked_task" && note.attributes.target === question && note.attributes.page === page)
    .sort((a, b) => compareCodePoints(String(a.attributes.created), String(b.attributes.created)) || compareCodePoints(a.id, b.id));
}

/** A proposal kept open with (c): rejected, so closed without a closed_reason. A withdrawn one is a different observation. */
const keptOpen = (note: Note): boolean => note.attributes.status === "closed" && note.attributes.closed_reason === undefined && isRecord(note.attributes.decision) && note.attributes.decision.action === "reject";

/** A row the skill passed for another reason (cli §5.14.1): its mapped Document asked box is ticked (0100 §1), or its mapped Area was read as empty (0113 §9). */
function passedForAnotherReason(workspace: Workspace, row: TaskRow): boolean {
  const asked = taskProperty(workspace, "document_asked"); const area = taskProperty(workspace, "area");
  const areas = area === "" ? undefined : row.properties[area];
  return (asked !== "" && row.properties[asked] === true) || (Array.isArray(areas) && areas.length === 0);
}

/**
 * Reads the snapshot's `tasks` rows (cli §5.14.1, §5.14.2): a tracked question's task that is finished, in the trash or unreadable leaves one
 * waiting question; a waiting one whose task reads open again, or whose question is no longer tracked, is withdrawn. A row no tracked
 * question names is `ignored`, `NOT_TRACKED`, unless it was passed for Document asked or for its empty Area: then only those rules read it
 * (task-documents.ts, task-areas.ts).
 */
export function planTaskRows(workspace: Workspace, rows: readonly TaskRow[], out: TaskPlanOut): void {
  if (!modulesOf(workspace.config).tasks) {
    for (const row of rows) out.ignored.push({ database: "tasks", page_id: row.page_id, brain_id: null, reason: "MODULE_OFF" });
    return;
  }
  const tracked = trackedByPage(workspace);
  const withdrawn = new Set<string>();
  const titleName = tasksConfig(workspace.config).title;
  for (const row of rows) {
    const question = tracked.get(row.page_id);
    if (question === undefined && passedForAnotherReason(workspace, row)) continue;
    if (question === undefined) { out.ignored.push({ database: "tasks", page_id: row.page_id, brain_id: null, reason: "NOT_TRACKED" }); continue; }
    const proposals = trackedProposals(workspace, question.id, row.page_id);
    const waiting = proposals.find((note) => note.attributes.status === "pending");
    const read = taskState(row, workspace.config);
    if (read === null) {
      if (waiting !== undefined) { out.withdrawn.push({ proposal: waiting.id, reason: "TASK_REOPENED" }); withdrawn.add(waiting.id); }
      continue;
    }
    const observed = row.last_edited;
    const same = (note: Note) => note.attributes.task_state === read.state && (note.attributes.task_edited ?? null) === observed;
    if (proposals.some((note) => (note.attributes.status === "pending" || keptOpen(note)) && same(note))) continue;
    const title = titleName === "" ? undefined : row.properties[titleName];
    out.tracked_tasks.push({
      question: question.id, page_id: row.page_id, ...(typeof title === "string" && title.trim() !== "" ? { page_title: title } : {}),
      state: read.state, status: read.status, observed_at: observed, ...(waiting === undefined ? {} : { proposal: waiting.id }),
    });
  }
  // A waiting tracked_task whose question is no longer tracked by that page: answered, dropped or relinked meanwhile (cli §5.14.2).
  for (const note of workspace.notes) {
    if (note.type !== "proposal" || note.attributes.kind !== "tracked_task" || note.attributes.status !== "pending" || withdrawn.has(note.id)) continue;
    if (tracked.get(String(note.attributes.page))?.id !== note.attributes.target) out.withdrawn.push({ proposal: note.id, reason: "NOT_TRACKED" });
  }
}

/** How a question's title names the task's state (cli §5.14.3). */
function stateWords(state: TaskState, status: string | null): { title: string; why: string } {
  if (state === "gone") return { title: "in the trash", why: "is in Notion's trash" };
  if (state === "unreadable") return { title: "unreadable", why: "can't be read in Notion" };
  return { title: String(status), why: `is ${String(status)} in Notion` };
}

/**
 * Step 3 of `sync apply` for tracked tasks (cli §5.14.3): each item written as a pending `tracked_task`, or the pending one it names updated.
 * Nothing of the question changes.
 */
export function writeTrackedTasks(workspace: Workspace, items: readonly PlannedTrackedTask[], now: Date, log: LogEntry[]): Array<Record<string, unknown>> {
  const today = formatDate(now);
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const results: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const head = { question: item.question, page_id: item.page_id };
    const question = workspace.get(item.question);
    if (question === undefined || question.type !== "question") { results.push({ ...head, result: "failed", reason: "UNKNOWN_ID", changed: [] }); continue; }
    const questionTitle = namedTitle(question, context);
    const pageTitle = item.page_title ?? questionTitle;
    const words = stateWords(item.state, item.status);
    const title = cut(`${questionTitle}: its task is ${words.title}`);
    const state = { page_title: pageTitle, task_state: item.state, task_status: item.status, task_edited: item.observed_at, title, why: `${pageTitle} ${words.why}` };
    const written = atomically(workspace, () => {
      if (item.proposal !== undefined) return updatePending(workspace, item.proposal, state, today);
      const { id } = writeProposal(workspace, { kind: "tracked_task", target: question.id, page: item.page_id, ...state, source: `notion:${item.page_id}` }, today);
      return { result: "written", proposal: id };
    });
    results.push({ ...head, ...written });
    if (written.result === "written" || written.result === "updated") log.push({ op: "proposal-new", id: String(written.proposal), title, pairs: [["kind", "tracked_task"], ["target", question.id]] });
  }
  return results;
}

const cut = (title: string): string => title.length > 120 ? `${title.slice(0, 119)}…` : title;

