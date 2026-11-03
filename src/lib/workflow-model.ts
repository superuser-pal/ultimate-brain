import { createHash } from "node:crypto";

import { BrainError } from "./errors.ts";
import { assertNoProblems, type InputProblem } from "./input.ts";
import { MEANINGS, type Meaning } from "./link-kit.ts";
import { modulesOf } from "./modules.ts";
import type { Note } from "./notes.ts";
import { countParts, formatAsOf, formatDay, percentOf } from "./repo-tasks.ts";
import { formatTimestamp } from "./time.ts";
import { compare, type Json, type Records } from "./workflow-store.ts";

// The rules of spec/connected-workflows.md §§5–11 on a workflow's records. Commands stage changes here and commit them once.

export const OP_ORDER = ["create_task", "update_task", "publish_artifact", "mark_original"] as const;
const OPEN_STATES = new Set(["pending", "in_flight", "failed", "uncertain"]);
const LEVEL_LABELS: Record<string, string> = { "tasks only": "tasks_only", "tasks + final outputs": "tasks_and_finals", "full durable record": "full", custom: "custom" };
const TYPE_LABELS: Record<string, string> = { software: "software", general: "general" };
const ARTIFACT_LABELS: Record<string, string> = { briefs: "brief", plans: "plan", specifications: "specification", decisions: "decision", "final deliverables": "final" };
const PUBLISHABLE: Record<string, readonly string[]> = { tasks_only: [], tasks_and_finals: ["final"], full: ["brief", "plan", "specification", "decision", "final"] };
const TWO_HOURS = 2 * 3600 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

export const ts = (date: Date): string => formatTimestamp(date);
export const hashText = (text: string): string => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;

// --- Publication (§5.3, §6.2) -----------------------------------------------------------------------------------

/** Whether a level publishes an artifact category. */
function levelIncludes(level: string, category: string, custom: readonly string[]): boolean {
  if (category === "temporary") return false;
  return level === "custom" ? custom.includes(category) : (PUBLISHABLE[level] ?? []).includes(category);
}

/** The frozen publication decision of an artifact being approved, or overridden (§5.3): the first rule that applies wins, then the module check. */
export function decidePublication(records: Records, artifact: Json, config: Record<string, unknown>, now: Date, override?: "include" | "exclude"): void {
  const settings = records.workflow.settings as Json;
  const item = artifact.item === null ? undefined : records.items.get(artifact.item);
  let decision: "include" | "exclude";
  let by: "artifact" | "task" | "level";
  let level: string = settings.logging;
  let reason: string | null = null;
  if (override !== undefined) {
    decision = override; by = "artifact";
    if (override === "exclude") reason = "excluded by override";
  } else {
    if (item !== undefined && item.logging !== null && item.logging !== undefined) { by = "task"; level = item.logging; } else by = "level";
    decision = levelIncludes(level, artifact.category, settings.custom ?? []) ? "include" : "exclude";
    if (decision === "exclude") reason = artifact.category === "temporary" ? "temporary" : "excluded by level";
  }
  const modules = modulesOf(config);
  if (decision === "include" && ((artifact.category !== "decision" && !modules.documents) || (artifact.category === "decision" && !modules.knowledge))) { decision = "exclude"; reason = "module off"; }
  artifact.publish = { decision, by, level, decided_at: ts(now) };
  artifact.local_reason = reason;
  if (decision === "exclude") artifact.publication = { state: "local", at: ts(now), error: null };
  else if (!(artifact.publication?.state === "published" && artifact.published_sha256 === artifact.sha256)) artifact.publication = { state: "pending", at: ts(now), error: null };
}

// --- Items (§5.2, §7.1) ------------------------------------------------------------------------------------------

/** INPUT_INVALID at /status unless an item may be `done` (§5.2). */
export function assertDoneAllowed(records: Records, item: Json): void {
  if (item.status !== "done") return;
  const software = records.workflow.settings.work_type === "software";
  const met = (item.acceptance as Json[]).every((criterion) => criterion.met_at !== null);
  if (item.accepted !== null || (software && item.links?.pr !== undefined && met)) return;
  const message = software ? "done needs the user's acceptance, or a PR with every criterion met" : "done needs the user's acceptance";
  throw new BrainError("INPUT_INVALID", `1 problem in input: /status ${message}`, [{ pointer: "/status", message }]);
}

/** The meaning a Notion option reads as (§5.1), or null when neither map has it. */
export function readOption(workflow: Json, option: string | null, current?: Meaning): Meaning | null {
  if (option === null) return null;
  const fold = option.toLowerCase();
  const shared = MEANINGS.filter((meaning) => String(workflow.status_map[meaning]).toLowerCase() === fold);
  if (shared.length > 0) return current !== undefined && shared.includes(current) ? current : shared[0]!;
  for (const [label, meaning] of Object.entries(workflow.status_read ?? {})) if (label.toLowerCase() === fold) return meaning as Meaning;
  return null;
}

export function progress(item: Json, now: Date, text: string): void {
  item.progress.push({ at: ts(now), text });
}

export function setStatus(item: Json, status: Meaning): void {
  item.status = status;
  if (status === "done" || status === "dropped") item.claim = null;
}

// --- Operations (§7.3, §10) --------------------------------------------------------------------------------------

export function openOps(records: Records, target: string, kind?: string): Json[] {
  return [...records.ops.values()].filter((op) => op.target === target && (kind === undefined || op.kind === kind) && OPEN_STATES.has(op.state));
}

export function sortOps(ops: Json[]): Json[] {
  return ops.sort((a, b) => OP_ORDER.indexOf(a.kind) - OP_ORDER.indexOf(b.kind) || compare(a.target, b.target) || compare(a.id, b.id));
}

/** Open an operation, or replace the payload of a pending one (§7.3: at most one open per target and kind). Returns the op, or null when busy. */
export function openOp(records: Records, kind: string, target: string, payload: Json, now: Date, busy?: Set<string>): Json | null {
  const [existing] = openOps(records, target, kind);
  const record = target.startsWith("wi-") ? records.items.get(target) : records.artifacts.get(target);
  if (existing !== undefined) {
    if (existing.state === "pending" && JSON.stringify(existing.payload) !== JSON.stringify(payload)) { existing.payload = payload; existing.updated_at = ts(now); }
    if (existing.state === "in_flight") busy?.add(existing.id);
    return existing;
  }
  const op = { id: records.newId("op"), rev: 1, kind, target, payload, state: "pending", attempts: 0, runs_failed: 0, created_at: ts(now), updated_at: ts(now), last_error: null, result: null };
  records.ops.set(op.id, op);
  if (record !== undefined && kind !== "mark_original") record.publication = { state: "pending", at: ts(now), error: null };
  return op;
}

/** The Task payload an item needs (§6.1): its title and mapped status. */
export const taskPayload = (records: Records, item: Json): Json => ({ title: item.title, status: records.workflow.status_map[item.status] });

const MOVES: Record<string, readonly string[]> = {
  pending: ["in_flight", "dropped"],
  in_flight: ["done", "failed", "pending", "dropped"],
  failed: ["pending", "dropped"],
  uncertain: ["done", "pending", "dropped"],
};

export interface OpError { code: string; message: string; lasting: boolean }

/** `op state` (§12): move an operation and record its outcome on the target. */
export function moveOp(records: Records, op: Json, state: string, now: Date, page?: string, error?: OpError): void {
  if (!(MOVES[op.state] ?? []).includes(state)) throw new BrainError("INPUT_INVALID", `1 problem in input: /state ${op.state} → ${state} is not a move an operation makes`, [{ pointer: "/state", message: `${op.state} can't move to ${state}` }]);
  const item = op.target.startsWith("wi-") ? records.items.get(op.target) : undefined;
  const artifact = op.target.startsWith("art-") ? records.artifacts.get(op.target) : undefined;
  const target = item ?? artifact;
  if (state === "done" && (op.kind === "create_task" || op.kind === "publish_artifact") && page === undefined) throw new BrainError("INPUT_INVALID", `1 problem in input: /page op state done on a ${op.kind} needs --page <id>`, [{ pointer: "/page", message: "is required to close this operation" }]);
  if (state === "failed" && error === undefined) throw new BrainError("INPUT_INVALID", "1 problem in input: /error op state failed needs --error", [{ pointer: "/error", message: "is required with failed: { code, message, lasting }" }]);
  op.updated_at = ts(now);
  if (state === "in_flight") { op.attempts += 1; op.state = state; return; }
  if (state === "pending") { op.state = state; if (target !== undefined && op.kind !== "mark_original") target.publication = { state: "pending", at: ts(now), error: op.last_error?.message ?? null }; return; }
  if (state === "failed") {
    op.state = state; op.last_error = error; op.runs_failed += 1;
    if (target !== undefined && op.kind !== "mark_original") target.publication = { state: error!.lasting || op.runs_failed >= 3 ? "failed" : "pending", at: ts(now), error: error!.message };
    return;
  }
  if (state === "done") {
    finishOp(records, op, now, page);
    return;
  }
  // dropped (§10.3): remembered so that reconcile doesn't open it again.
  const progressTarget = item ?? (artifact?.item ? records.items.get(artifact.item) : undefined);
  if (progressTarget !== undefined) progress(progressTarget, now, `Dropped: ${op.kind}`);
  if (op.kind === "create_task" && item !== undefined) item.publication = { state: "local", at: ts(now), error: null };
  if (op.kind === "update_task" && item !== undefined) item.declined = { kind: "update_task", payload: op.payload };
  if (op.kind === "publish_artifact" && artifact !== undefined) {
    if (artifact.published_sha256 === null) {
      artifact.publish = { decision: "exclude", by: "artifact", level: records.workflow.settings.logging, decided_at: ts(now) };
      artifact.local_reason = "dropped by user";
      artifact.publication = { state: "local", at: ts(now), error: null };
    } else artifact.declined = { kind: "publish_artifact", payload: op.payload };
  }
  if (op.kind === "mark_original") {
    const entry = (records.adoption?.map as Json[] | undefined)?.find((candidate) => candidate.item === op.target);
    if (entry !== undefined) { entry.treatment = "keep"; entry.marked = true; }
  }
  records.deleteOp(op.id);
}

/** Close an operation as done (§6.3, §10.2): record the outcome on its target and delete its file. `values` are Notion's, when known. */
export function finishOp(records: Records, op: Json, now: Date, page?: string, values?: { title: string; status: string | null }): void {
  const item = op.target.startsWith("wi-") ? records.items.get(op.target) : undefined;
  const artifact = op.target.startsWith("art-") ? records.artifacts.get(op.target) : undefined;
  if ((op.kind === "create_task" || op.kind === "update_task") && item !== undefined) {
    const at = page ?? item.notion?.page;
    if (at !== undefined) item.notion = { page: at, title: values?.title ?? op.payload.title, status: values?.status ?? op.payload.status, read_at: ts(now) };
    if (op.kind === "update_task") item.declined = null;
    item.publication = { state: "published", at: ts(now), error: null };
  }
  if (op.kind === "publish_artifact" && artifact !== undefined) {
    artifact.published_sha256 = op.payload.sha256;
    artifact.publication = { state: "published", at: ts(now), error: null };
  }
  if (op.kind === "mark_original") {
    const entry = (records.adoption?.map as Json[] | undefined)?.find((candidate) => candidate.item === op.target);
    if (entry !== undefined) entry.marked = true;
  }
  if (page !== undefined) op.result = { page };
  records.deleteOp(op.id);
}

// --- The dated summary (§9) and the Work record (§6.1) ----------------------------------------------------------

export function itemCounts(records: Records): Record<Meaning, number> {
  const counts: Record<Meaning, number> = { todo: 0, in_progress: 0, waiting: 0, review: 0, done: 0, dropped: 0 };
  for (const item of records.items.values()) counts[item.status as Meaning] += 1;
  return counts;
}

const listFive = (entries: string[]): string => `${entries.slice(0, 5).join("; ")}${entries.length > 5 ? `; and ${entries.length - 5} more` : ""}`;

/** The Workflow toggle's text (§9) and its hash without the date. */
export function summaryOf(records: Records, now: Date): { markdown: string; sha256: string } {
  const workflow = records.workflow;
  const counts = itemCounts(records);
  const total = records.items.size;
  const open = counts.todo + counts.in_progress + counts.waiting + counts.review;
  const reviewWord = workflow.settings.work_type === "software" ? "ready for review" : "ready for approval";
  const head = `Updated ${formatAsOf(now)} UTC · `;
  const lines = [`${workflow.folder.name} · ${workflow.state === "paused" ? "Paused" : "Connected"}`];
  if (total > 0) {
    const detail = countParts([[counts.in_progress, "in progress"], [counts.review, reviewWord], [counts.waiting, "waiting"], [counts.todo, "to do"]], ", ");
    const percent = percentOf(counts.done, total, counts.dropped);
    lines.push([countParts([[counts.done, "completed"], [counts.dropped, "dropped"]], " · "), open > 0 ? `${open} open${detail === "" ? "" : ` (${detail})`}` : "", percent === null ? "" : `${percent}%`].filter((part) => part !== "").join(" · "));
  }
  const ops = sortOps([...records.ops.values()].filter((op) => OPEN_STATES.has(op.state)));
  const targets = new Map<string, Json>();
  for (const op of ops) if (!targets.has(op.target)) targets.set(op.target, op);
  const waitingFor = new Set((workflow.needs_you as Json[]).map((entry) => entry.target));
  const pending = [...targets.values()].map((op) => {
    const record = records.items.get(op.target) ?? records.artifacts.get(op.target);
    const reason = op.state === "failed" ? `failed: ${op.last_error?.message ?? "unknown error"}` : op.last_error?.code === "network" ? "Notion unreachable" : waitingFor.has(op.target) ? "waiting for an answer" : "waiting for the next run";
    return `${record?.title ?? op.target} (${reason})`;
  });
  if (pending.length > 0) lines.push(`Not yet in Notion: ${pending.length}: ${listFive(pending)}`);
  const questions = (workflow.needs_you as Json[]).map((entry) => entry.question as string);
  if (questions.length > 0) lines.push(`Needs you: ${questions.length}: ${listFive(questions)}`);
  if (total > 0 && open === 0 && targets.size > 0) lines.push(`Work complete, ${targets.size} not yet in Notion.`);
  const body = `${lines.join("\n")}\n`;
  return { markdown: `${head}${body}`, sha256: hashText(body) };
}

const notionUrl = (page: string): string => `https://www.notion.so/${page.replaceAll("-", "")}`;
const linked = (title: string, page: unknown): string => (typeof page === "string" ? `[${title}](${notionUrl(page)})` : title);

/** The Work record toggle's text (§6.1). */
export function workRecord(records: Records, item: Json, notes: ReadonlyMap<string, Note>): string {
  const lines: string[] = [];
  if (item.scope !== "") lines.push(`Scope: ${item.scope}`);
  if (item.acceptance.length > 0) {
    lines.push("Acceptance:");
    for (const criterion of item.acceptance as Json[]) lines.push(criterion.met_at === null ? `- [ ] ${criterion.text}` : `- [x] ${criterion.text}${criterion.evidence ? ` (${criterion.evidence})` : ""}`);
  }
  const deps = (item.depends_on as string[]).map((id) => records.items.get(id)).filter((dep): dep is Json => dep !== undefined);
  if (deps.length > 0) lines.push(`Depends on: ${deps.map((dep) => linked(dep.title, dep.notion?.page)).join(", ")}`);
  const documents = [...records.artifacts.values()].filter((artifact) => artifact.item === item.id && artifact.note !== null && artifact.publish?.decision === "include");
  if (documents.length > 0) lines.push(`Documents: ${documents.map((artifact) => linked(artifact.title, notes.get(artifact.note)?.attributes.notion)).join(", ")}`);
  const entries = (item.progress as Json[]).slice(-5);
  if (entries.length > 0) {
    lines.push("Progress:");
    for (const entry of entries) lines.push(`- ${formatDay(new Date(entry.at))}: ${entry.text}`);
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

// --- Reconciliation (§8, §10.2, §10.3) -----------------------------------------------------------------------------

export interface Routine { kind: string; target: string; from: unknown; to: unknown }

function needsYou(kind: string, target: string, question: string, choices: string[], value?: string): Json {
  return { id: `${kind}:${target}`, kind, target, question, choices, since: "", ...(value === undefined ? {} : { value }) };
}

const CHOICES: Record<string, string[]> = {
  BOTH_CHANGED: ["keep_mine", "take_notion"],
  STATUS_UNMAPPED: [...MEANINGS],
  TASK_ARCHIVED: ["drop", "restore"],
  TASK_DELETED: ["drop", "recreate"],
  UNKNOWN_TASK: ["adopt", "outside"],
  ARTIFACT_CHANGED: ["approve", "ignore"],
  DOCUMENT_BOTH_CHANGED: ["keep_notion", "publish_mine"],
};

const minute = (stamp: string): string => stamp.slice(0, 16);

/** Map a destination label through §4's table: null for empty, or an option with no value. */
const label = (table: Record<string, string>, value: string | null): string | null => (value === null || value === "" ? null : table[value.toLowerCase()] ?? null);

/** `reconcile` (§8, §10.2, §10.3): apply a Notion snapshot to the records. */
export function reconcile(records: Records, snapshot: Json, notes: ReadonlyMap<string, Note>, now: Date, start: boolean): { routine: Routine[]; busy: string[]; ops: string[] } {
  const workflow = records.workflow;
  const routine: Routine[] = [];
  const busy = new Set<string>();
  const readAt = new Date(snapshot.read_at);

  // The destination's settings (§8.1).
  const destination = snapshot.destination as Json;
  const state = destination.workflow !== null && destination.workflow.toLowerCase() === "connected" ? "connected" : "paused";
  if (state !== workflow.state) { routine.push({ kind: "state_changed", target: workflow.id, from: workflow.state, to: state }); workflow.state = state; }
  const settings = workflow.settings as Json;
  const next: Json = { work_type: label(TYPE_LABELS, destination.work_type) ?? settings.work_type, logging: label(LEVEL_LABELS, destination.logging_level) ?? "tasks_and_finals" };
  next.custom = next.logging === "custom" ? [...new Set((destination.log_artifacts as string[]).map((value) => label(ARTIFACT_LABELS, value)).filter((value): value is string => value !== null))] : settings.custom;
  for (const key of ["work_type", "logging", "custom"]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(settings[key])) { routine.push({ kind: "settings_changed", target: workflow.id, from: { [key]: settings[key] }, to: { [key]: next[key] } }); settings[key] = next[key]; settings.read_at = snapshot.read_at; }
  }
  const connected = workflow.state === "connected";

  // A run starts (§10.3): attempts back to 0, failed operations retried unless they failed in 3 runs.
  if (start) for (const op of records.ops.values()) {
    if (op.attempts !== 0) op.attempts = 0;
    if (op.state === "failed" && op.runs_failed < 3) { op.state = "pending"; op.updated_at = ts(now); }
  }

  const tasks = snapshot.tasks as Json[];
  const byPage = new Map(tasks.map((task) => [task.page.replaceAll("-", ""), task]));
  const taskOf = (item: Json): Json | undefined => (item.notion !== null ? byPage.get(item.notion.page.replaceAll("-", "")) : undefined) ?? tasks.find((task) => task.brain_id === item.id);

  // Interrupted operations (§10.2).
  for (const op of [...records.ops.values()]) {
    if (op.state === "in_flight") {
      if (readAt.getTime() - new Date(op.updated_at).getTime() > TEN_MINUTES) { op.state = "uncertain"; op.updated_at = ts(now); const target = records.items.get(op.target) ?? records.artifacts.get(op.target); if (target !== undefined && op.kind !== "mark_original") target.publication = { state: "uncertain", at: ts(now), error: null }; }
      else { busy.add(op.id); continue; }
    }
    const marked = op.kind === "mark_original" && ((snapshot.marked as string[] | undefined) ?? []).includes(op.id) && op.state !== "in_flight";
    if (op.state !== "uncertain" && !marked) continue;
    const item = records.items.get(op.target);
    const artifact = records.artifacts.get(op.target);
    let done = false;
    let page: string | undefined;
    let values: { title: string; status: string | null } | undefined;
    if (op.kind === "create_task" && item !== undefined) {
      const task = tasks.find((candidate) => candidate.brain_id === item.id);
      if (task !== undefined) { done = true; page = task.page; values = { title: task.title, status: task.status }; }
    } else if (op.kind === "update_task" && item !== undefined) {
      const task = taskOf(item);
      if (task !== undefined && task.title === op.payload.title && task.status === op.payload.status) { done = true; values = { title: task.title, status: task.status }; }
    } else if (op.kind === "publish_artifact" && artifact !== undefined && artifact.note !== null) {
      const document = ((snapshot.documents as Json[] | undefined) ?? []).find((candidate) => candidate.brain_id === artifact.note);
      const synced = notes.get(artifact.note)?.attributes.last_synced;
      if (document !== undefined && typeof synced === "string" && new Date(synced).getTime() > new Date(op.updated_at).getTime()) { done = true; page = document.page; }
    } else if (op.kind === "mark_original") done = marked;
    const from = op.state;
    if (done) finishOp(records, op, now, page, values);
    else { op.state = "pending"; op.updated_at = ts(now); }
    routine.push({ kind: "op_resolved", target: op.id, from, to: done ? "done" : "pending" });
  }

  const raised = new Map<string, Json>();
  const raise = (entry: Json) => { if (!raised.has(entry.id)) raised.set(entry.id, entry); };
  const held = (target: string) => [...raised.values()].some((entry) => entry.target === target);
  const wiIds = new Set(records.items.keys());

  // Items (§8.2).
  for (const item of records.items.values()) {
    const task = item.notion !== null ? taskOf(item) : undefined;
    if (item.notion === null) {
      if (item.publication.state === "local" || item.approved_at === null || item.status === "dropped") continue;
      const create = openOps(records, item.id, "create_task")[0];
      if (create !== undefined) {
        // An open create_task whose task already exists (by Brain ID) is resolved above when uncertain; a pending one just waits.
        if (create.state === "pending" && connected) openOp(records, "create_task", item.id, { ...taskPayload(records, item), brain_id: item.id }, now, busy);
        continue;
      }
      if (connected) openOp(records, "create_task", item.id, { ...taskPayload(records, item), brain_id: item.id }, now, busy);
      continue;
    }
    if (task === undefined) {
      if (openOps(records, item.id, "create_task").length === 0 && item.status !== "dropped") raise(needsYou("TASK_DELETED", item.id, `"${item.title}" was deleted in Notion: drop it, or create it again?`, CHOICES.TASK_DELETED!));
      continue;
    }
    if (task.archived || task.in_trash) {
      if (item.status !== "dropped") raise(needsYou("TASK_ARCHIVED", item.id, `"${item.title}" is ${task.in_trash ? "in the trash" : "archived"} in Notion: drop it, or restore it?`, CHOICES.TASK_ARCHIVED!));
      continue;
    }
    const base = item.notion as Json;
    // Status: Notion wins whenever it changed (§8.2; 0059).
    const local = workflow.status_map[item.status];
    const notionChanged = task.status !== base.status;
    const localChanged = local !== base.status;
    let wantUpdate = false;
    if (notionChanged) {
      const meaning = readOption(workflow, task.status, item.status);
      if (meaning === null) raise(needsYou("STATUS_UNMAPPED", item.id, `"${item.title}" has the Notion status "${String(task.status)}", which maps to no meaning: which is it?`, CHOICES.STATUS_UNMAPPED!, String(task.status)));
      else {
        if (meaning !== item.status) {
          routine.push({ kind: "status_adopted", target: item.id, from: item.status, to: meaning });
          setStatus(item, meaning);
          if (meaning === "done" && item.accepted === null) item.accepted = { at: task.edited, statement: "Set to Done in Notion" };
        }
        base.status = task.status; base.read_at = snapshot.read_at;
      }
    } else if (localChanged) wantUpdate = true;
    // Title.
    const titleNotion = task.title !== base.title;
    const titleLocal = item.title !== base.title;
    if (titleNotion && !titleLocal) { routine.push({ kind: "title_adopted", target: item.id, from: item.title, to: task.title }); item.title = task.title; base.title = task.title; base.read_at = snapshot.read_at; }
    else if (titleNotion && titleLocal) {
      if (task.title === item.title) { base.title = task.title; base.read_at = snapshot.read_at; }
      else raise(needsYou("BOTH_CHANGED", item.id, `"${item.title}" was renamed in Notion to "${task.title}": keep which?`, CHOICES.BOTH_CHANGED!, task.title));
    } else if (titleLocal) wantUpdate = true;
    const emptyBrainId = task.brain_id === null || task.brain_id === "";
    if ((wantUpdate || emptyBrainId) && connected && !held(item.id)) {
      const payload: Json = taskPayload(records, item);
      if (emptyBrainId) payload.brain_id = item.id;
      if (item.declined?.kind === "update_task" && JSON.stringify(item.declined.payload) === JSON.stringify(payload)) continue;
      if (item.declined?.kind === "update_task") item.declined = null;
      openOp(records, "update_task", item.id, payload, now, busy);
    }
  }

  // Tasks under the destination that the workflow doesn't know (§8.2).
  const pages = new Set([...records.items.values()].filter((item) => item.notion !== null).map((item) => item.notion.page.replaceAll("-", "")));
  const outside = new Set((workflow.outside as string[]).map((page) => page.replaceAll("-", "")));
  const adopted = new Set(((records.adoption?.map as Json[] | undefined) ?? []).filter((entry) => entry.origin.kind === "notion").map((entry) => String(entry.origin.key).replaceAll("-", "")));
  for (const task of tasks) {
    const page = task.page.replaceAll("-", "");
    if (task.archived || task.in_trash || pages.has(page) || outside.has(page) || adopted.has(page) || (task.brain_id !== null && wiIds.has(task.brain_id))) continue;
    const hint = typeof task.brain_id === "string" && /^(mtg|src)-/.test(task.brain_id) ? " It looks like an action item from a meeting or source: keep it outside?" : "";
    raise(needsYou("UNKNOWN_TASK", task.page, `"${task.title}" is under the destination but not in the workflow: adopt it, or keep it outside?${hint}`, CHOICES.UNKNOWN_TASK!));
  }

  // Artifacts (§8.2).
  const files = new Map(((snapshot.artifacts as Json[] | undefined) ?? []).map((entry) => [entry.id, entry.sha256]));
  for (const artifact of records.artifacts.values()) {
    const file = files.get(artifact.id);
    if (file !== undefined && artifact.sha256 !== null && file !== artifact.sha256 && artifact.declined?.payload?.ignored_sha256 !== file) {
      const document = artifact.note === null ? undefined : ((snapshot.documents as Json[] | undefined) ?? []).find((candidate) => candidate.brain_id === artifact.note);
      const synced = artifact.note === null ? undefined : notes.get(artifact.note)?.attributes.last_synced;
      const edited = document !== undefined && typeof synced === "string" && minute(document.edited) > minute(synced);
      const kind = edited ? "DOCUMENT_BOTH_CHANGED" : "ARTIFACT_CHANGED";
      raise(needsYou(kind, artifact.id, edited ? `"${artifact.title}" changed here and its Document was edited in Notion: keep Notion's, or publish yours?` : `"${artifact.title}" changed since you approved it: approve the new version, or ignore it?`, CHOICES[kind]!, file));
    }
    if (artifact.approved_at === null || artifact.publish?.decision !== "include" || artifact.publication.state === "local" || artifact.published_sha256 === artifact.sha256 || held(artifact.id) || !connected) continue;
    if (artifact.declined?.kind === "publish_artifact" && artifact.declined.payload.sha256 !== undefined) {
      if (artifact.declined.payload.sha256 === artifact.sha256) continue;
      artifact.declined = null;
    }
    openOp(records, "publish_artifact", artifact.id, { sha256: artifact.sha256 }, now, busy);
  }

  // Originals to mark, once their items have pages (§8.2, §11.5).
  if (connected) for (const entry of (records.adoption?.map as Json[] | undefined) ?? []) {
    if (entry.treatment === "keep" || entry.marked || records.items.get(entry.item)?.notion === null || records.items.get(entry.item) === undefined) continue;
    openOp(records, "mark_original", entry.item, { origin: entry.origin, treatment: entry.treatment }, now, busy);
  }

  // Needs you: kept and repeated, never duplicated; an entry that no longer applies goes (routine resolved_itself).
  const previous = workflow.needs_you as Json[];
  const kept: Json[] = [];
  for (const entry of previous) {
    // Repeated, not duplicated: the entry keeps its `since`, and takes the new question and value.
    const again = raised.get(entry.id);
    if (again !== undefined && again.kind === entry.kind) { kept.push({ ...again, since: entry.since }); raised.delete(entry.id); }
    else routine.push({ kind: "resolved_itself", target: entry.target, from: entry.kind, to: null });
  }
  for (const entry of raised.values()) kept.push({ ...entry, since: snapshot.read_at });
  workflow.needs_you = kept;

  const runnable = connected ? sortOps([...records.ops.values()].filter((op) => op.state === "pending")).map((op) => op.id) : [];
  return { routine, busy: [...busy].sort(), ops: runnable };
}

// --- Resolve (§8.2's choices) --------------------------------------------------------------------------------------

/** Apply the user's answers (§8.2): returns the ids of the operations opened. */
export function resolve(records: Records, answers: Json[], config: Record<string, unknown>, now: Date): string[] {
  const workflow = records.workflow;
  const problems: InputProblem[] = [];
  const entries = workflow.needs_you as Json[];
  answers.forEach((answer, index) => {
    const entry = entries.find((candidate) => candidate.id === answer.id);
    if (entry === undefined) problems.push({ pointer: `/answers/${index}/id`, message: `no open question ${String(answer.id)}` });
    else if (!entry.choices.includes(answer.choice)) problems.push({ pointer: `/answers/${index}/choice`, message: `must be one of ${entry.choices.join(", ")}` });
  });
  assertNoProblems(problems);
  const connected = workflow.state === "connected";
  const opened: string[] = [];
  const open = (kind: string, target: string, payload: Json) => { if (!connected) return; const op = openOp(records, kind, target, payload, now); if (op !== null) opened.push(op.id); };
  for (const answer of answers) {
    const entry = entries.find((candidate) => candidate.id === answer.id)!;
    const item = records.items.get(entry.target);
    const artifact = records.artifacts.get(entry.target);
    switch (`${entry.kind}:${answer.choice}`) {
      case "BOTH_CHANGED:keep_mine": open("update_task", item!.id, taskPayload(records, item!)); break;
      case "BOTH_CHANGED:take_notion": item!.title = entry.value; item!.notion.title = entry.value; break;
      case "TASK_ARCHIVED:drop": setStatus(item!, "dropped"); break;
      case "TASK_DELETED:drop": setStatus(item!, "dropped"); item!.publication = { state: "local", at: ts(now), error: null }; break;
      case "TASK_DELETED:recreate": item!.notion = null; if (item!.publication.state === "local") item!.publication = { state: "pending", at: ts(now), error: null }; open("create_task", item!.id, { ...taskPayload(records, item!), brain_id: item!.id }); break;
      case "UNKNOWN_TASK:outside": workflow.outside = [...new Set([...(workflow.outside as string[]), entry.target])]; break;
      case "ARTIFACT_CHANGED:approve": case "DOCUMENT_BOTH_CHANGED:publish_mine": {
        const sha256 = entry.value as string;
        approveArtifact(records, artifact!, sha256, config, now);
        if (artifact!.publish.decision === "include" && artifact!.published_sha256 !== sha256) open("publish_artifact", artifact!.id, { sha256 });
        break;
      }
      case "ARTIFACT_CHANGED:ignore": case "DOCUMENT_BOTH_CHANGED:keep_notion": {
        const sha256 = entry.value as string;
        artifact!.declined = { kind: "publish_artifact", payload: { ...(artifact!.declined?.payload ?? {}), ignored_sha256: sha256 } };
        break;
      }
      default:
        if (entry.kind === "STATUS_UNMAPPED") {
          // The option now reads as the chosen meaning, and the item adopts it (§8.2's "adopt N").
          workflow.status_read = { ...workflow.status_read, [entry.value]: answer.choice };
          if (item!.status !== answer.choice) setStatus(item!, answer.choice as Meaning);
          if (answer.choice === "done" && item!.accepted === null) item!.accepted = { at: ts(now), statement: "Set to Done in Notion" };
          item!.notion.status = entry.value;
        }
        // TASK_ARCHIVED:restore and UNKNOWN_TASK:adopt are done by the skill; the next reconcile sees the result.
    }
  }
  const answered = new Set(answers.map((answer) => answer.id));
  workflow.needs_you = entries.filter((entry) => !answered.has(entry.id));
  return opened;
}

/** Approve an artifact's content (§5.3): the decision is computed once and then frozen. */
export function approveArtifact(records: Records, artifact: Json, sha256: string, config: Record<string, unknown>, now: Date): void {
  artifact.sha256 = sha256;
  artifact.approved_at = ts(now);
  if (artifact.publish === null) decidePublication(records, artifact, config, now);
  else if (artifact.publish.decision === "include" && artifact.published_sha256 !== sha256 && artifact.publication.state !== "local") artifact.publication = { state: "pending", at: ts(now), error: null };
  if (artifact.declined?.payload?.ignored_sha256 !== undefined) {
    const { ignored_sha256: _ignored, ...rest } = artifact.declined.payload;
    artifact.declined = Object.keys(rest).length === 0 ? null : { ...artifact.declined, payload: rest };
  }
}

/** Artifacts approved and excluded by the level that the current level would include (§4, `publish-history`). */
export function publishHistory(records: Records): string[] {
  const settings = records.workflow.settings as Json;
  return [...records.artifacts.values()]
    .filter((artifact) => artifact.approved_at !== null && artifact.publish?.decision === "exclude" && artifact.publish.by === "level" && levelIncludes(settings.logging, artifact.category, settings.custom ?? []))
    .map((artifact) => artifact.id as string)
    .sort(compare);
}
