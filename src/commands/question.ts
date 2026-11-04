import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys, type InputProblem } from "../lib/input.ts";
import { formatDate } from "../lib/time.ts";
import { Workspace } from "../lib/workspace.ts";

/** `brain question drop --input <file|->` (spec/cli.md §5.30, capture-and-review §6.2, 0071). */
export const questionDropCommand: Command = {
  name: "question drop",
  usage: "brain question drop --input <file|-> [--json]",
  summary: "Drop questions the to-do tidy found were to-dos: archive each, with the Task it became when there is one.",
  options: { input: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "question drop");
    if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object" }]);
    const problems: InputProblem[] = unknownKeys(input as Record<string, unknown>, ["items"], "");
    const items = (input as Record<string, unknown>).items;
    if (!Array.isArray(items) || items.length === 0) problems.push({ pointer: "/items", message: "must be a non-empty list" });
    assertNoProblems(problems);

    const workspace = await Workspace.open(brain!);
    const seen = new Set<string>();
    const checked: Array<{ id: string; task?: string; unchanged: boolean }> = [];
    (items as unknown[]).forEach((item, index) => {
      const pointer = `/items/${index}`;
      if (!isRecord(item)) assertNoProblems([{ pointer, message: "must be an object" }]);
      const entry = item as Record<string, unknown>;
      const own = unknownKeys(entry, ["id", "task"], pointer);
      if (typeof entry.id !== "string") own.push({ pointer: `${pointer}/id`, message: "must be a question id" });
      if (entry.task !== undefined && (typeof entry.task !== "string" || entry.task === "")) own.push({ pointer: `${pointer}/task`, message: "must be the Task's Notion page id" });
      assertNoProblems(own);
      const id = entry.id as string;
      const task = entry.task as string | undefined;
      if (seen.has(id)) assertNoProblems([{ pointer: `${pointer}/id`, message: `${id} is listed twice` }]);
      seen.add(id);
      const note = workspace.get(id);
      if (note === undefined) throw new BrainError("UNKNOWN_ID", `${pointer}/id: no note with id ${id}`, [{ pointer: `${pointer}/id`, message: "does not exist" }]);
      const a = note.attributes;
      if (note.type !== "question") assertNoProblems([{ pointer: `${pointer}/id`, message: `${id} is a ${note.type}, not a question` }]);
      if (a.kind !== "question") assertNoProblems([{ pointer: `${pointer}/id`, message: `${id} is a risk: a risk is never dropped as a to-do` }]);
      if (a.answer !== undefined) assertNoProblems([{ pointer: `${pointer}/id`, message: `${id} has an answer: it is not a to-do` }]);
      if (a.dropped !== undefined) {
        // A dropped question keeps its first record; the same drop again is a safe retry.
        if (a.task !== task) assertNoProblems([{ pointer, message: `${id} was dropped on ${String(a.dropped)} ${a.task === undefined ? "with no Task" : `with Task ${String(a.task)}`}` }]);
        checked.push({ id, ...(task === undefined ? {} : { task }), unchanged: true });
        return;
      }
      if (a.lifecycle === "archived") assertNoProblems([{ pointer: `${pointer}/id`, message: `${id} is archived: it is history, not a to-do` }]);
      const status = isRecord(a.notion_fields) ? a.notion_fields.status : undefined;
      if (status === "Answered") assertNoProblems([{ pointer: `${pointer}/id`, message: `${id} is Answered in Notion: it is not a to-do` }]);
      if (task !== undefined && !recordedTasks(workspace, a).has(task)) {
        assertNoProblems([{ pointer: `${pointer}/task`, message: `${task} is not in the tasks of ${id}'s meeting or sources: record the Task with sync record first` }]);
      }
      checked.push({ id, ...(task === undefined ? {} : { task }), unchanged: false });
    });

    const date = formatDate(now);
    const log = [];
    for (const item of checked) {
      if (item.unchanged) continue;
      const note = workspace.get(item.id)!;
      const document = workspace.edit(note);
      document.attributes.lifecycle = "archived";
      document.attributes.dropped = date;
      if (item.task !== undefined) document.attributes.task = item.task;
      document.attributes.updated = date;
      workspace.save(note.path, document);
      log.push({ op: "question-drop", id: item.id, title: String(document.attributes.title) });
    }
    const errors = workspace.newErrors();
    if (errors.length > 0) assertNoProblems(errors.map((issue) => ({ pointer: "", message: `${issue.path}: ${issue.rule}: ${issue.message}` })));
    if (log.length > 0) await workspace.commit(log, now);
    const data = { items: checked.map(({ id, task, unchanged }) => ({ id, result: unchanged ? "unchanged" : "dropped", ...(task === undefined ? {} : { task }) })) };
    return { data, human: data.items.map((item) => `${item.result} ${item.id}\n`).join("") };
  },
};

/** The Task page ids recorded on the question's meeting and sources (`tasks`, cli §5.14.6). */
function recordedTasks(workspace: Workspace, attributes: Record<string, unknown>): Set<string> {
  const holders = [attributes.raised_in, ...(Array.isArray(attributes.sources) ? attributes.sources : [])];
  const tasks = new Set<string>();
  for (const id of holders) {
    if (typeof id !== "string") continue;
    const recorded = workspace.get(id)?.attributes.tasks;
    if (Array.isArray(recorded)) for (const task of recorded) if (typeof task === "string") tasks.add(task);
  }
  return tasks;
}
