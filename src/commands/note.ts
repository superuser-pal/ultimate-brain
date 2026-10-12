import type { Command } from "../lib/command.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys } from "../lib/input.ts";
import { assertStagedValid, checkNoteInput, stageNotes, type NoteInput } from "../lib/note-new.ts";
import { Workspace } from "../lib/workspace.ts";
import { lintWarnings } from "../lib/warnings.ts";

/** `brain note new --input <file|-> [--dry-run]` (spec/cli.md §5.5). */
export const noteNewCommand: Command = {
  name: "note new",
  usage: "brain note new --input <file|-> [--dry-run] [--json]",
  summary: "Write new draft notes from JSON input. All or nothing; never changes an existing note.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "note new");
    if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object with a notes list" }]);
    const record = input as Record<string, unknown>;
    const problems = unknownKeys(record, ["notes"], "");
    if (!Array.isArray(record.notes)) problems.push({ pointer: "/notes", message: "must be a list" });
    else record.notes.forEach((item, index) => problems.push(...checkNoteInput(item, `/notes/${index}`)));
    assertNoProblems(problems);

    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const staged = stageNotes(workspace, record.notes as NoteInput[], (index) => `/notes/${index}`, { now });
    assertStagedValid(workspace, staged.pointers, "/notes");
    const warnings = lintWarnings(workspace.warnings());

    if (!dryRun) {
      await workspace.commit(staged.created.map((note) => ({ op: "note-new", id: note.id, title: note.title })), now);
    }
    const human = staged.created.map((note) => `${dryRun ? "would create" : "created"} ${note.path}\n`).join("")
      + staged.skipped.map((skip) => `skipped notes[${skip.input_index}]: same content as ${skip.existing}\n`).join("");
    return { data: { created: staged.created, skipped: staged.skipped, dry_run: dryRun }, warnings, human: human || "Nothing to write.\n" };
  },
};
