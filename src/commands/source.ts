import { proposeCleanup } from "../lib/cleanup-row.ts";
import { formatDate } from "../lib/time.ts";
import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { lineDiff } from "../lib/diff.ts";
import { cleanupPlan } from "../lib/cleanup.ts";
import { buildExtractPlan } from "../lib/extract.ts";
import { contextFor, requireSuppressions, restrictionOf } from "../lib/suppressions.ts";
import { Workspace } from "../lib/workspace.ts";
import { readFile } from "node:fs/promises";

/** `brain source full-text` (spec/cli.md §5.17): retired in 0.6.0 by decision 0049. Writes nothing. */
export const sourceFullTextCommand: Command = {
  name: "source full-text",
  usage: "brain source full-text <src-id> [--parts <range>[,<range>…]] [--json]",
  summary: "Retired in 0.6.0: use Keep as document on the source's Inbox row.",
  options: { parts: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run() {
    throw new BrainError("RETIRED", "brain source full-text was retired in 0.6.0: use Keep as document");
  },
};

/** `brain source diff <src-id>` (spec/cli.md §5.19, 0045): the lines that changed from the version it replaces. */
export const sourceDiffCommand: Command = {
  name: "source diff",
  usage: "brain source diff <src-id> [--json]",
  summary: "Show the lines a new version of a source changed against the version it replaces, without context lines. Read-only.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain }) {
    const [id] = args.positionals;
    if (id === undefined) throw new BrainError("USAGE", "Name the source: brain source diff <src-id>");
    const workspace = await Workspace.open(brain!);
    const note = workspace.get(id);
    if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    const invalid = (message: string): never => { throw new BrainError("INPUT_INVALID", message, [{ pointer: "", message }]); };
    if (note.type !== "source") invalid(`${id} is a ${note.type}, not a source`);
    const replaces = note.attributes.replaces;
    if (typeof replaces !== "string") invalid(`${id} has no replaces: it is the first version`);
    const earlier = workspace.get(replaces as string);
    if (earlier === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${String(replaces)}`);
    // Excluded text is never shown, not even as a diff: a restricted source contributes only its passage markers, and restricted lines are removed.
    const context = contextFor(workspace.notes, requireSuppressions(brain!.root));
    const visible = (source: typeof note): string => {
      const restriction = restrictionOf(source, context);
      const rows = source.body.split(/\r?\n/);
      if (restriction.whole) return rows.filter((row) => /^<!-- passage ¶\d+ item [^>]*-->$/.test(row)).join("\n");
      return rows.filter((_, index) => !restriction.lines.has(index)).join("\n");
    };
    const lines = lineDiff(visible(earlier), visible(note));
    const diff = lines.join("\n");
    return {
      data: { id: note.id, replaces: earlier.id, removed: lines.filter((line) => line.startsWith("- ")).length, added: lines.filter((line) => line.startsWith("+ ")).length, diff },
      human: diff === "" ? "no lines changed\n" : `${diff}\n`,
    };
  },
};

/** `brain source extract-plan` (spec/cli.md §5.22, 0055, 0062): what a selected extract would contain. Read-only. */
export const sourceExtractPlanCommand: Command = {
  name: "source extract-plan",
  usage: "brain source extract-plan --page <notion-page-id> --summary <file> --transcript <file> [--previous <src-id>] [--json]",
  summary: "Map a summary's items to transcript paragraphs and show which paragraphs would enter an extract. Read-only.",
  options: { page: "string", summary: "string", transcript: "string", previous: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const page = args.options.page as string | undefined;
    const summaryPath = args.options.summary as string | undefined;
    const transcriptPath = args.options.transcript as string | undefined;
    if (page === undefined || summaryPath === undefined || transcriptPath === undefined) throw new BrainError("USAGE", "Give --page <id>, --summary <file> and --transcript <file>");
    const read = async (path: string): Promise<string> => {
      try { return (await readFile(path, "utf8")).replace(/\r\n/g, "\n"); } catch { throw new BrainError("INPUT_INVALID", `Cannot read ${path}`, [{ pointer: "", message: `Cannot read ${path}` }]); }
    };
    const workspace = await Workspace.open(brain!);
    const data = buildExtractPlan(workspace.notes, { page, summary: await read(summaryPath), transcript: await read(transcriptPath), previous: args.options.previous as string | undefined });
    return { data, human: data.ok ? `${data.passages.length} paragraph(s) would enter the extract; write ${data.write_required ? "required" : "not required"}\n` : `blocked: ${data.problems.map((problem) => `${problem.code} ${problem.id ?? ""} ${problem.reason}`).join("; ")}\n` };
  },
};

/** `brain source cleanup-plan` (spec/cli.md §5.25, capture-and-review §5.2): what an input's suppressions restrict and what stays. Read-only. */
export const sourceCleanupPlanCommand: Command = {
  name: "source cleanup-plan",
  usage: "brain source cleanup-plan --page <notion-page-id> [--json]",
  summary: "List the notes, Tasks and Documents affected by an input's active suppressions, and the claims that stay. Read-only.",
  options: { page: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const page = args.options.page as string | undefined;
    if (page === undefined) throw new BrainError("USAGE", "Give --page <notion-page-id>");
    const workspace = await Workspace.open(brain!);
    const plan = cleanupPlan(workspace.notes, requireSuppressions(brain!.root), page);
    return { data: plan, human: `${plan.notes.length} note(s), ${plan.tasks.length} Task(s), ${plan.documents.length} Document(s) affected\n` };
  },
};

/** `brain source cleanup-propose` (spec/cli.md §5.26, capture-and-review §5.2): writes the exclusion cleanup row of an input as one pending proposal. */
export const sourceCleanupProposeCommand: Command = {
  name: "source cleanup-propose",
  usage: "brain source cleanup-propose --page <notion-page-id> [--json]",
  summary: "Write the exclusion cleanup row of an input: Remove, Restore and Keep/Remove items for what its suppressions restrict.",
  options: { page: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const page = args.options.page as string | undefined;
    if (page === undefined) throw new BrainError("USAGE", "Give --page <notion-page-id>");
    const workspace = await Workspace.open(brain!);
    const data = proposeCleanup(workspace, page, formatDate(now));
    if (data.result === "WRITTEN") await workspace.commit([{ op: "cleanup-propose", id: data.proposal!, title: page }], now);
    return { data, human: `${data.result}${data.proposal === undefined ? "" : ` ${data.proposal}`}\n` };
  },
};
