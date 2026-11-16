import { isRecord, type InputProblem } from "./input.ts";
import type { LogEntry } from "./log.ts";
import { compareCodePoints } from "./notes.ts";
import { formatDate } from "./time.ts";
import type { Workspace } from "./workspace.ts";

/** A Status you set on a Questions row, to record in Git once (spec/cli.md §5.14.9, decision 0099 §8). */
export interface QuestionStatus { note: string; page_id: string; status: "answered" | "dropped"; at: string }

/** The plan of `sync plan --questions-transition`: nothing but these three lists (cli §5.14.9). */
export interface QuestionsPlan { as_of: string; question_status: QuestionStatus[]; conflicts: Array<Record<string, unknown>>; ignored: Array<Record<string, unknown>> }

interface Row { database: string; page_id: string; last_edited: string; properties: Record<string, unknown> }

/**
 * The 0.16.0 migration's one read of the Questions rows (cli §5.14.9): Answered and Dropped become `question_status` items; Open, empty or any
 * other Status is nothing, and so is a question Git already closed. Nothing else of the row is compared, and no correction is read.
 */
export function buildQuestionsPlan(workspace: Workspace, snapshot: { as_of: string; rows: readonly Row[] }): QuestionsPlan {
  const plan: QuestionsPlan = { as_of: snapshot.as_of, question_status: [], conflicts: [], ignored: [] };
  for (const row of snapshot.rows) {
    const brainId = typeof row.properties["Brain ID"] === "string" ? row.properties["Brain ID"] : "";
    if (brainId === "") { plan.ignored.push({ database: row.database, page_id: row.page_id, brain_id: null, reason: "NOT_CREATED_IN_NOTION" }); continue; }
    const note = workspace.get(brainId);
    if (note === undefined) { plan.conflicts.push({ database: row.database, page_id: row.page_id, brain_id: brainId, code: "UNKNOWN_BRAIN_ID", message: `No note has Brain ID ${brainId}` }); continue; }
    if (note.type !== "question") { plan.ignored.push({ database: row.database, page_id: row.page_id, brain_id: brainId, reason: "NOT_A_QUESTION" }); continue; }
    // Git already says more than the Status did.
    if (note.attributes.answer !== undefined || note.attributes.dropped !== undefined) continue;
    const status = row.properties.Status;
    if (status !== "Answered" && status !== "Dropped") continue;
    plan.question_status.push({ note: note.id, page_id: row.page_id, status: status === "Answered" ? "answered" : "dropped", at: row.last_edited.slice(0, 10) });
  }
  const byPage = (left: Record<string, unknown>, right: Record<string, unknown>) => compareCodePoints(String(left.page_id), String(right.page_id));
  plan.question_status.sort((left, right) => compareCodePoints(left.page_id, right.page_id));
  plan.conflicts.sort(byPage); plan.ignored.sort(byPage);
  return plan;
}

/** The snapshot of `--questions-transition` holds Questions rows only (cli §5.14.9). */
export function questionsSnapshotProblems(rows: readonly Row[]): InputProblem[] {
  return rows.flatMap((row, index) => row.database === "questions" ? [] : [{ pointer: `/rows/${index}/database`, message: "must be questions: the transition reads Questions rows only" }]);
}

/** A plan's `question_status` items, as `sync apply` reads them (cli §5.14.9). */
export function questionStatusProblems(value: unknown): InputProblem[] {
  if (!Array.isArray(value)) return [{ pointer: "/question_status", message: "must be a list" }];
  return value.flatMap((item, index) => {
    const at = `/question_status/${index}`;
    if (!isRecord(item) || typeof item.note !== "string" || typeof item.page_id !== "string" || (item.status !== "answered" && item.status !== "dropped")
      || typeof item.at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.at)) return [{ pointer: at, message: "must be { note, page_id, status: answered|dropped, at: YYYY-MM-DD }" }];
    return [];
  });
}

/**
 * `sync apply` of the `question_status` items, after every other item, atomic per item (cli §5.14.9): Answered records an `answer` that says
 * so, Dropped records `dropped` and archives the question, as `question drop` does. A question closed by then is `ALREADY_CLOSED`.
 */
export function applyQuestionStatus(workspace: Workspace, items: readonly QuestionStatus[], now: Date): { results: Array<Record<string, unknown>>; log: LogEntry[] } {
  const results: Array<Record<string, unknown>> = []; const log: LogEntry[] = [];
  for (const item of items) {
    const base = { note: item.note, page_id: item.page_id, status: item.status };
    const note = workspace.get(item.note);
    if (note === undefined || note.type !== "question") { results.push({ ...base, result: "failed", reason: "UNKNOWN_ID" }); continue; }
    if (note.attributes.answer !== undefined || note.attributes.dropped !== undefined) { results.push({ ...base, result: "skipped", reason: "ALREADY_CLOSED" }); continue; }
    const checkpoint = workspace.checkpoint();
    const document = workspace.edit(note);
    if (item.status === "answered") document.attributes.answer = `Marked Answered in Notion on ${item.at}; the answer was not recorded.`;
    else { document.attributes.dropped = item.at; document.attributes.lifecycle = "archived"; }
    document.attributes.updated = formatDate(now);
    workspace.save(note.path, document);
    if (workspace.newErrors().length > 0) { workspace.restore(checkpoint); results.push({ ...base, result: "failed", reason: "INVALID_RESULT" }); continue; }
    results.push({ ...base, result: "applied" });
    log.push({ op: "sync-question", id: note.id, title: String(document.attributes.title), pairs: [["status", item.status]] });
  }
  return { results, log };
}

/**
 * A plan given to `sync apply`, with its `question_status` items taken out (cli §5.14.9): a plan of `--questions-transition` has no other
 * item, so the lists every plan has default to empty. `undefined` when the plan has no `question_status`.
 */
export function splitQuestionStatus(input: unknown): { plan: unknown; questionStatus?: QuestionStatus[]; problems: InputProblem[] } {
  if (!isRecord(input) || !Object.hasOwn(input, "question_status")) return { plan: input, problems: [] };
  const { question_status: items, ...rest } = input;
  const problems = questionStatusProblems(items);
  const plan: Record<string, unknown> = { ...rest };
  for (const key of ["create", "updates", "corrections", "decisions", "conflicts", "ignored"]) if (plan[key] === undefined) plan[key] = [];
  return { plan, questionStatus: problems.length === 0 ? items as QuestionStatus[] : [], problems };
}
