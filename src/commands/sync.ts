import { assertNoProblems, isRecord, readJsonInput, type InputProblem } from "../lib/input.ts";
import { applyPlan, buildPlan, parsePlan, parseSnapshot, record, render, renderQuestionTask, renderTasks, unpublishDrafts } from "../lib/sync.ts";
import type { RenderItem, RowStates } from "../lib/sync.ts";
import type { Command } from "../lib/command.ts";
import { Workspace } from "../lib/workspace.ts";
import { commitJournaled } from "../lib/journal.ts";
import { factoriesOn, factoryById, readFactories } from "../lib/factories.ts";
import { modulesOf } from "../lib/modules.ts";
import { BrainError } from "../lib/errors.ts";
import { lintWarnings } from "../lib/warnings.ts";
import { applyQuestionStatus, buildQuestionsPlan, questionsSnapshotProblems, splitQuestionStatus } from "../lib/questions-transition.ts";
import { trackedQuestions } from "../lib/tracked-tasks.ts";
import { buildSnapshot, type SnapshotInput } from "../lib/sync-snapshot.ts";
import { formatTimestamp } from "../lib/time.ts";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/** `brain sync tracked` (cli §5.14.1, 0101 §6): the tasks that track open questions, for the skill to read by page id. Read-only. */
export const syncTrackedCommand: Command = {
  name: "sync tracked", usage: "brain sync tracked [--json]", summary: "List the tracked questions and their tasks' page ids, for the sync snapshot.", options: {}, maxPositionals: 0, needsBrain: true,
  async run({ brain }) {
    if (!modulesOf(brain!.config).tasks) throw new BrainError("MODULE_OFF", "The Tasks module is off: brain modules on tasks");
    const tracked = trackedQuestions(await Workspace.open(brain!));
    return { data: { tracked }, human: tracked.length === 0 ? "No tracked questions.\n" : tracked.map((item) => `${item.question} ${item.page_id} ${item.title}\n`).join("") };
  },
};

/** `brain sync snapshot` (cli §5.14.10, CC-269): the snapshot from the query replies the skill saved. Writes only --output. */
export const syncSnapshotCommand: Command = {
  name: "sync snapshot", usage: "brain sync snapshot --input <file|dir> [--input <file|dir> …] --output <snapshot.json> [--json]", summary: "Write the sync snapshot from saved Notion query replies.", options: { input: "list", output: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) {
    const paths = args.options.input as string[] | undefined; const output = args.options.output as string | undefined;
    if (paths === undefined || output === undefined) throw new BrainError("USAGE", "sync snapshot needs --input and --output");
    const files: string[] = [];
    for (const path of paths) {
      const info = await stat(path).catch((error: unknown) => { throw new BrainError("INPUT_UNREADABLE", `Cannot read input ${path}: ${error instanceof Error ? error.message : String(error)}`); });
      if (!info.isDirectory()) { files.push(path); continue; }
      // A directory stands for every .json file directly in it, in name order.
      const names = (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort();
      files.push(...names.map((name) => join(path, name)));
    }
    const inputs: SnapshotInput[] = [];
    for (const file of files) inputs.push({ path: file, value: await readJsonInput(file, "sync snapshot") });
    const notion = (brain!.config.notion ?? {}) as { databases?: Record<string, string>; tasks?: { database?: string; properties?: Record<string, string> } };
    const databases: Record<string, string> = { ...(notion.databases ?? {}) };
    if (typeof notion.tasks?.database === "string" && notion.tasks.database !== "") databases.tasks = notion.tasks.database;
    const built = buildSnapshot(inputs, { databases, taskProperties: notion.tasks?.properties ?? {}, factories: factoriesOn(brain!.config) }, formatTimestamp(now));
    const target = resolve(output);
    await writeFile(target, `${JSON.stringify(built.snapshot, null, 2)}\n`);
    return { data: { output: target, rows: built.snapshot.rows.length, examples_left_out: built.examples_left_out, databases: built.databases }, warnings: built.warnings, human: `${built.snapshot.rows.length} rows written to ${target}; ${built.examples_left_out} example rows left out\n` };
  },
};

export const syncPlanCommand: Command = {
  name: "sync plan", usage: "brain sync plan --input <snapshot|-> [--review-transition | --questions-transition] [--json]", summary: "Compare a Notion snapshot with the brain without writing.", options: { input: "string", "review-transition": "boolean", "questions-transition": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain }) {
    const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync plan needs --input");
    const reviewTransition = args.options["review-transition"] === true;
    const notion = brain!.config.notion as { databases?: Record<string, unknown> } | undefined;
    // The 0.16.0 migration reads Questions · Status once (cli §5.14.9); once it removed the database's key, the rows are not read again.
    if (args.options["questions-transition"] === true) {
      if (reviewTransition) throw new BrainError("USAGE", "--review-transition and --questions-transition are separate steps of the 0.16.0 migration: run them one at a time");
      if (notion?.databases === undefined || !Object.hasOwn(notion.databases, "questions")) throw new BrainError("QUESTIONS_RETIRED", "The Questions database was archived by the 0.16.0 migration, or this space never had one: its rows are not read again. Open questions are in your project and area Briefs.");
      const snapshot = parseSnapshot(await readJsonInput(input, "sync plan")); assertNoProblems(questionsSnapshotProblems(snapshot.rows));
      const plan = buildQuestionsPlan(await Workspace.open(brain!), snapshot);
      return { data: plan, human: `${plan.question_status.length} question statuses to record\n` };
    }
    // The 0.16.0 migration reads the Review rows once (cli §5.14.8); once it removed the database's key, they are never read again.
    if (reviewTransition && (notion?.databases === undefined || !Object.hasOwn(notion.databases, "review"))) throw new BrainError("REVIEW_RETIRED", "The Review database was archived by the 0.16.0 migration: its rows are not read again. Decide proposals in the session.");
    const workspace = await Workspace.open(brain!); const plan = buildPlan(workspace, parseSnapshot(await readJsonInput(input, "sync plan")), { reviewTransition });
    return { data: plan, human: `${plan.create.length} creates, ${plan.updates.length} updates, ${plan.corrections.length} corrections, ${plan.tracked_tasks.length} finished tracked tasks\n` };
  },
};

/** The results of the Question Status items join the apply's output, summary and log (cli §5.14.9). */
function addQuestionStatus(data: Record<string, unknown>, applied: ReturnType<typeof applyQuestionStatus>): void {
  data.question_status = applied.results;
  const summary = data.summary as Record<string, number>;
  for (const item of applied.results) if (typeof item.result === "string" && Object.hasOwn(summary, item.result)) summary[item.result] += 1;
  (data.log as unknown[]).push(...applied.log);
}

/** Whether a Review decision changed anything: those writes (the target and the proposal file) are one journaled operation (capture-and-review §7.11). */
const writesReview = (data: Record<string, unknown>): boolean => (data.review_results as Array<{ result: string }>).some((entry) => ["applied", "closed", "deferred"].includes(entry.result)) || (data.revision_results as Array<{ result: string }>).some((entry) => entry.result === "recorded");

export const syncApplyCommand: Command = {
  name: "sync apply", usage: "brain sync apply --input <plan|-> [--record-only] [--skip-conflicted] [--dry-run] [--json]", summary: "Apply a sync plan using atomic per-item writes.", options: { input: "string", "record-only": "boolean", "skip-conflicted": "boolean", "dry-run": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync apply needs --input"); const workspace = await Workspace.open(brain!);
    // The 0.16.0 migration's Question Status items are applied after every other item (cli §5.14.9).
    const split = splitQuestionStatus(await readJsonInput(input, "sync apply")); assertNoProblems(split.problems);
    const data = applyPlan(workspace, parsePlan(split.plan), now, args.options["record-only"] === true, args.options["skip-conflicted"] === true);
    if (split.questionStatus !== undefined) addQuestionStatus(data, applyQuestionStatus(workspace, split.questionStatus, now));
    const warnings = lintWarnings(workspace.warnings()); const dryRun = args.options["dry-run"] === true; let op: string | undefined; if (!dryRun) { if (writesReview(data) && workspace.changedPaths.length > 0) op = await commitJournaled(brain!.root, workspace, data.log as [], now, "sync apply: review decisions"); else await workspace.commit(data.log as [], now); } const { log: _log, ...output } = data; const failed = Number((data.summary as Record<string, unknown>).failed ?? 0); return { data: { dry_run: dryRun, ...(op === undefined ? {} : { op }), ...output }, warnings, exitCode: failed > 0 ? 1 : 0, human: `${failed} failed items\n` }; },
};

/** `--row-state` (cli §5.34): one row's to-dos `{ page, items: [{ label, ticked, note }] }` as `cleanup ticks` takes them, or a list of such rows. */
function parseRowStates(value: unknown): RowStates {
  const rows = Array.isArray(value) ? value : [value];
  const problems: InputProblem[] = [];
  const out = new Map<string, Map<string, { ticked: boolean; note: string }>>();
  rows.forEach((row, index) => {
    const at = Array.isArray(value) ? `/${index}` : "";
    if (!isRecord(row) || typeof row.page !== "string" || row.page === "" || !Array.isArray(row.items)) { problems.push({ pointer: at, message: "must be { page, items: [{ label, ticked, note }] }" }); return; }
    const items = new Map<string, { ticked: boolean; note: string }>();
    row.items.forEach((item, itemIndex) => {
      if (!isRecord(item) || typeof item.label !== "string" || !/^[ACU][1-9]\d*$/.test(item.label) || typeof item.ticked !== "boolean" || (item.note !== undefined && typeof item.note !== "string")) problems.push({ pointer: `${at}/items/${itemIndex}`, message: "must be { label (A1, C2, U3…), ticked, note }" });
      else items.set(item.label, { ticked: item.ticked, note: typeof item.note === "string" ? item.note.trim() : "" });
    });
    out.set(row.page, items);
  });
  assertNoProblems(problems);
  return out;
}

export const syncRenderCommand: Command = {
  name: "sync render", usage: "brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json> [--skip-conflicted]] [--row-state <file>] | --unpublish-drafts [--json]", summary: "Render Notion payloads without writing.", options: { changed: "boolean", ids: "string", plan: "string", "skip-conflicted": "boolean", "unpublish-drafts": "boolean", "row-state": "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now, environment }) {
    const changed = args.options.changed === true; const idsText = args.options.ids as string | undefined;
    // The Draft pages from before 0.9.1, moved to the trash after a yes (cli §5.14.4, migration 0020).
    if (args.options["unpublish-drafts"] === true) {
      if (changed || idsText !== undefined || args.options.plan !== undefined || args.options["skip-conflicted"] === true || args.options["row-state"] !== undefined) throw new BrainError("USAGE", "--unpublish-drafts runs alone");
      const items = unpublishDrafts(await Workspace.open(brain!), now);
      return { data: { items, errors: [], skipped: [] }, human: `${items.length} Draft pages to move to the trash\n` };
    }
    if (changed === (idsText !== undefined)) throw new BrainError("USAGE", "provide exactly one of --changed or --ids");
    const workspace = await Workspace.open(brain!); const ids = idsText === undefined ? undefined : idsText.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids !== undefined) for (const id of ids) if (workspace.get(id) === undefined && factoryById(brain!.config, id) === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    if (factoriesOn(brain!.config)) await readFactories(brain!, workspace.notes, environment.homeDirectory);
    const held = new Map<string, Set<string>>(); const planPath = args.options.plan as string | undefined; const skipConflicted = args.options["skip-conflicted"] === true;
    if (skipConflicted && planPath === undefined) throw new BrainError("USAGE", "--skip-conflicted needs --plan");
    const plan = planPath === undefined ? undefined : parsePlan(await readJsonInput(planPath, "sync render"));
    if (plan !== undefined) for (const item of plan.conflicts) if (item.code === "BOTH_CHANGED" && typeof item.brain_id === "string" && typeof item.property === "string") { const set = held.get(item.brain_id) ?? new Set<string>(); set.add(item.property); held.set(item.brain_id, set); }
    const rowStatePath = args.options["row-state"] as string | undefined;
    const rowStates = rowStatePath === undefined ? undefined : parseRowStates(await readJsonInput(rowStatePath, "sync render"));
    const data = render(workspace, now, ids, held, rowStates);
    // --skip-conflicted (cli §5.14.4, 0051): a conflicted row, and a report with a What to fix nobody has read, are held back whole.
    const withheld = new Map<string, string>(); const conflictedPages = new Set<string>();
    if (skipConflicted && plan !== undefined) {
      for (const item of plan.conflicts) { if (typeof item.brain_id === "string") withheld.set(item.brain_id, "ROW_CONFLICTED"); conflictedPages.add(String(item.page_id)); }
      for (const item of plan.report_fixes) if (!withheld.has(item.report)) withheld.set(item.report, "FIX_WAITING");
    }
    // A note whose Notion text is unresolved is never overwritten (cli §5.14.7, 0054): a pending proposal, an unaccepted draft, or accepted wording not yet imported.
    // Only its body waits when every row naming it says the page is not accepted (#221); an accepted page gets no write at all, since any write would make the acceptance look stale.
    const bodyOnly = new Set<string>();
    if (plan !== undefined) {
      const rows = [...plan.wording_waiting, ...plan.wording_held, ...plan.accepted_wording];
      for (const item of rows) if (!withheld.has(item.note)) { withheld.set(item.note, "WORDING_PENDING"); bodyOnly.add(item.note); }
      for (const item of rows) if (!("accepted" in item) || item.accepted !== false) bodyOnly.delete(item.note);
    }
    const skipped: Array<{ id: string; reason: string }> = [...data.skipped]; const items = data.items.filter((item) => {
      const reason = withheld.get(item.id) ?? (item.page_id !== null && conflictedPages.has(item.page_id) ? "ROW_CONFLICTED" : undefined);
      if (reason === undefined) return true;
      skipped.push({ id: item.id, reason });
      if (!bodyOnly.has(item.id) || item.action !== "update") return false;
      holdBody(item); return Object.keys(item.properties).some((name) => name !== "Last Synced");
    });
    return { data: { items, errors: data.errors, skipped }, warnings: data.warnings, exitCode: data.errors.length > 0 ? 1 : 0, human: `${items.length} payloads\n` };
  },
};

/** A held note's update without its body (cli §5.14.7, #221): no body, no Refresh asked, and the body baselines in S left as they were. */
function holdBody(item: RenderItem): void {
  item.body = null; item.sections = null;
  delete item.properties["Refresh asked"];
  delete item.published["@content"]; delete item.published["@git_body"];
}

export const syncTasksCommand: Command = {
  name: "sync tasks", usage: "brain sync tasks (--meeting <mtg-id> | --source <src-id> | --direct | --question <que-id>) --input <file|-> [--json]", summary: "Render task payloads for a meeting's or source's action items, for tasks said yes to in a chat (--direct), or for the task that tracks a question or risk (--question).", options: { meeting: "string", source: "string", direct: "boolean", question: "string", input: "string" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain }) {
    const meeting = args.options.meeting as string | undefined; const source = args.options.source as string | undefined; const direct = args.options.direct === true; const question = args.options.question as string | undefined; const input = args.options.input as string | undefined;
    if ([meeting !== undefined, source !== undefined, direct, question !== undefined].filter(Boolean).length !== 1 || input === undefined) throw new BrainError("USAGE", "sync tasks needs exactly one of --meeting, --source, --direct or --question, and --input");
    // With Tasks off nothing is tracked, a question neither (capture-and-review §6.4).
    if (!modulesOf(brain!.config).tasks) throw new BrainError("MODULE_OFF", "The Tasks module is off: brain modules on tasks");
    if (question !== undefined) {
      const { warnings, ...data } = renderQuestionTask(await Workspace.open(brain!), question, await readJsonInput(input, "sync tasks"));
      return { data, warnings, human: "Task payload rendered.\n" };
    }
    const { warnings, ...data } = renderTasks(await Workspace.open(brain!), direct ? undefined : meeting ?? source!, await readJsonInput(input, "sync tasks"));
    return { data, warnings, human: "Task payloads rendered.\n" };
  },
};

export const syncRecordCommand: Command = {
  name: "sync record", usage: "brain sync record --input <file|-> [--dry-run] [--json]", summary: "Record successful Notion publication results.", options: { input: "string", "dry-run": "boolean" }, maxPositionals: 0, needsBrain: true,
  async run({ args, brain, now }) { const input = args.options.input as string | undefined; if (input === undefined) throw new BrainError("USAGE", "sync record needs --input"); const workspace = await Workspace.open(brain!); const data = record(workspace, await readJsonInput(input, "sync record")); const records = data.records as Array<Record<string, unknown>>; const dryRun = args.options["dry-run"] === true; if (!dryRun) await workspace.commit([], now); const failed = records.filter((item) => item.result === "failed").length; return { data: { dry_run: dryRun, records }, warnings: data.warnings, exitCode: failed > 0 ? 1 : 0, human: `${records.length} records\n` }; },
};
