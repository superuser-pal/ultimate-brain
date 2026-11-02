import { readFile } from "node:fs/promises";

import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { buildExtractPlan, chainOf } from "../lib/extract.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { assertCleanTree, commitWithOp, newOpId, recoverAll, removeJournal, sha, writeJournal, type JournalEntry } from "../lib/journal.ts";
import { assertNoProblems } from "../lib/input.ts";
import { checkNoteInput, stageNotes, type NoteInput } from "../lib/note-new.ts";
import { requireSuppressions } from "../lib/suppressions.ts";
import { stageViews, viewTargets } from "../lib/views-write.ts";
import { Workspace } from "../lib/workspace.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `brain source extract` (spec/cli.md §5.23, 0055, 0062): the only writer of a selected extract, one journaled operation. */
export const sourceExtractCommand: Command = {
  name: "source extract",
  usage: "brain source extract --page <id> --title <text> --date <YYYY-MM-DD> --summary <file> --transcript <file> [--kind minutes|capture] [--previous <src-id>] [--dry-run] [--json]",
  summary: "Write a selected extract, its suppression record and (later) the regenerated views as one journaled operation.",
  options: { page: "string", title: "string", date: "string", summary: "string", transcript: "string", kind: "string", previous: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const opt = (name: string) => args.options[name] as string | undefined;
    const [page, title, date, summaryPath, transcriptPath] = [opt("page"), opt("title"), opt("date"), opt("summary"), opt("transcript")];
    if (page === undefined || title === undefined || date === undefined || summaryPath === undefined || transcriptPath === undefined) throw new BrainError("USAGE", "Give --page, --title, --date, --summary and --transcript");
    if (!DATE.test(date)) throw new BrainError("USAGE", "--date must be YYYY-MM-DD");
    const kind = opt("kind") ?? "minutes";
    if (kind !== "minutes" && kind !== "capture") throw new BrainError("USAGE", "--kind must be minutes or capture");
    const read = async (path: string): Promise<string> => {
      try { return (await readFile(path, "utf8")).replace(/\r\n/g, "\n"); } catch { throw new BrainError("INPUT_INVALID", `Cannot read ${path}`, [{ pointer: "", message: `Cannot read ${path}` }]); }
    };
    const state = requireSuppressions(brain!.root);
    const workspace = await Workspace.open(brain!);
    const plan = buildExtractPlan(workspace.notes, { page, summary: await read(summaryPath), transcript: await read(transcriptPath), previous: opt("previous") });
    if (!plan.ok) throw new BrainError("INPUT_INVALID", `The input is blocked: ${plan.problems.map((problem) => `${problem.code} ${problem.id ?? ""} ${problem.reason}`).join("; ")}`, plan.problems.map((problem) => ({ pointer: "", message: `${problem.code} ${problem.id ?? ""} ${problem.reason}` })));
    if (!plan.write_required) return { data: { result: "UNCHANGED", created: [], suppression: null, views: [], version: plan.previous?.version ?? null }, human: "UNCHANGED\n" };

    const previous = plan.previous === undefined ? undefined : workspace.get(plan.previous.id);
    const chain = previous === undefined ? [] : chainOf(previous, workspace.notes);
    const taskItems: Record<string, string> = {};
    for (const source of [...chain].reverse()) {
      const items = source.attributes.task_items;
      if (items !== null && typeof items === "object") Object.assign(taskItems, items);
    }
    const version = plan.previous?.kind === "extract" ? Number(plan.previous.version) + 1 : 1;
    const item: NoteInput = {
      type: "source", title, file_date: date, body: plan.body ?? "",
      frontmatter: {
        source_key: `notion:${page}`, kind, extract: true, extract_of: page, extract_version: version,
        ...(plan.previous === undefined ? {} : { replaces: plan.previous.id }),
        transcript_hash: plan.transcript_hash, selection: plan.selection, passages: plan.passages,
        ...(Object.keys(taskItems).length > 0 ? { task_items: taskItems } : {}),
      },
    };
    assertNoProblems(checkNoteInput(item, "/notes/0"));
    const staged = stageNotes(workspace, [item], () => "/notes/0", { now });
    const created = staged.created[0]!;

    // The suppression record: appended exactly when something is suppressed or for a full-copy transition (cli §5.23).
    const suppressionPath = `_suppressions/${page}.json`;
    let suppression: string | null = null;
    let appended: Record<string, unknown> | undefined;
    if (plan.previous !== undefined && (plan.previous.suppressed.length > 0 || plan.previous.kind === "full")) {
      let existing: { input: string; records: unknown[] } = { input: page, records: [] };
      // Only a missing file means "no record yet"; anything unreadable was refused above (requireSuppressions) and is never replaced.
      if (workspace.exists(suppressionPath)) existing = JSON.parse(await readFile(`${brain!.root}/${suppressionPath}`, "utf8"));
      const oldHash = previous?.attributes.transcript_hash;
      appended = {
        version, written: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
        passages: plan.previous.suppressed.map((n) => ({ extract_of: page, transcript_hash: String(oldHash), n })),
        full_copies: plan.previous.full_copies, status: "active",
      };
      existing.records.push(appended);
      suppression = `${JSON.stringify(existing, null, 2)}\n`;
    }

    // The regenerated views render only eligible evidence, in the same operation (capture-and-review §5.1).
    const loaded = { ...state, suppressions: [...state.suppressions, ...(appended === undefined ? [] : [{ ...(appended as object), input: page } as never])] };
    const views = stageViews(workspace, viewTargets(workspace.notes.filter((note) => note.type === "project"), workspace.notes.filter((note) => note.type === "area")), now, false, loaded);
    if (views.errors.length > 0) throw new BrainError("INPUT_INVALID", `A view has invalid markers: ${views.errors.map((entry) => entry.path).join(", ")}`);
    const errors = workspace.newErrors(workspace.changedPaths);
    if (errors.length > 0) throw new BrainError("INPUT_INVALID", `The extract fails lint: ${errors.map((issue) => `${issue.rule}: ${issue.message}`).join("; ")}`);
    const data = { result: "WRITTEN", created: [created.id], path: created.path, suppression: suppression === null ? null : suppressionPath, views: [...views.created, ...views.written], version };
    if (args.options["dry-run"] === true) return { data: { ...data, result: "DRY_RUN" }, human: "dry run: nothing written\n" };

    await assertCleanTree(brain!.root);
    const op = newOpId();
    const entries: JournalEntry[] = workspace.changedPaths.map((path) => ({ path, hash: null, new: workspace.isNew(path) }));
    if (suppression !== null) entries.push({ path: suppressionPath, hash: sha(suppression), new: !workspace.exists(suppressionPath) });
    await writeJournal(brain!.root, { op, written: now.toISOString(), entries });
    try {
      await workspace.commit();
      if (suppression !== null) { await ensureDirectory(brain!.root, "_suppressions"); await atomicWriteFile(brain!.root, suppressionPath, suppression); }
      await commitWithOp(brain!.root, op, entries.map((entry) => entry.path), `extract: ${title} v${version}`);
    } catch (error) {
      // Roll back now; if that fails the journal stays and every command refuses until `brain recover` (fail closed).
      try { await recoverAll(brain!.root); } catch { /* journal kept */ }
      throw error instanceof BrainError ? error : new BrainError("INTERNAL", `The extract write failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`);
    }
    await removeJournal(brain!.root, op);
    return { data: { ...data, op }, human: `${created.path}\n` };
  },
};

/** `brain recover` (spec/cli.md §5.24, capture-and-review §7.11). */
export const recoverCommand: Command = {
  name: "recover",
  usage: "brain recover [--json]",
  summary: "Finish or roll back an interrupted multi-file write left by a journal.",
  options: {},
  maxPositionals: 0,
  needsBrain: true,
  async run({ brain }) {
    const done = await recoverAll(brain!.root);
    return { data: { recovered: done }, human: done.length === 0 ? "nothing to recover\n" : `${done.map((entry) => `RECOVERED ${entry.op} (${entry.action})`).join("\n")}\n` };
  },
};
