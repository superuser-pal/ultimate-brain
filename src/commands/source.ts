import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { lineDiff } from "../lib/diff.ts";
import { extractBody, pageFingerprint, paragraphs, parseSummary, planExtract } from "../lib/selection.ts";
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
    const lines = lineDiff(earlier.body, note.body);
    const diff = lines.join("\n");
    return {
      data: { id: note.id, replaces: earlier.id, removed: lines.filter((line) => line.startsWith("- ")).length, added: lines.filter((line) => line.startsWith("+ ")).length, diff },
      human: diff === "" ? "no lines changed\n" : `${diff}\n`,
    };
  },
};

/** `brain source extract-plan` (spec/cli.md §5.22, 0055): what a selected extract would contain. Read-only. */
export const sourceExtractPlanCommand: Command = {
  name: "source extract-plan",
  usage: "brain source extract-plan --summary <file> --transcript <file> [--previous <src-id>] [--json]",
  summary: "Map a summary's items to transcript paragraphs and show which paragraphs would enter an extract. Read-only.",
  options: { summary: "string", transcript: "string", previous: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const summaryPath = args.options.summary as string | undefined;
    const transcriptPath = args.options.transcript as string | undefined;
    if (summaryPath === undefined || transcriptPath === undefined) throw new BrainError("USAGE", "Give --summary <file> and --transcript <file>");
    const read = async (path: string): Promise<string> => {
      try { return (await readFile(path, "utf8")).replace(/\r\n/g, "\n"); } catch { throw new BrainError("INPUT_INVALID", `Cannot read ${path}`, [{ pointer: "", message: `Cannot read ${path}` }]); }
    };
    const summary = parseSummary(await read(summaryPath));
    const transcript = await read(transcriptPath);
    const plan = planExtract(summary, transcript);
    const hash = paragraphs(transcript).transcript_hash;
    const fingerprint = pageFingerprint(summary, hash);
    const selection = [
      ...summary.subjects.map((subject) => ({ id: subject.id, effective: subject.selection, explicit: subject.raw === null ? null : subject.selection })),
      ...plan.mappings.map((mapping) => ({ id: mapping.item, effective: mapping.effective, explicit: mapping.explicit })),
    ];
    let previous: Record<string, unknown> | undefined;
    const previousId = args.options.previous as string | undefined;
    if (previousId !== undefined) {
      const workspace = await Workspace.open(brain!);
      const note = workspace.get(previousId);
      if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${previousId}`);
      if (note.type !== "source" || note.attributes.extract !== true) throw new BrainError("INPUT_INVALID", `${previousId} is not an extract`, [{ pointer: "", message: `${previousId} is not an extract` }]);
      const before = (note.attributes.selection as { id: string; effective: string }[]) ?? [];
      const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id).sort().join();
      const changes = selection.filter((entry) => before.find((old) => old.id === entry.id)?.effective !== entry.effective && before.some((old) => old.id === entry.id))
        .map((entry) => ({ id: entry.id, from: before.find((old) => old.id === entry.id)?.effective, to: entry.effective }));
      const stale = note.attributes.transcript_hash !== hash || ids(before) !== ids(selection);
      previous = {
        id: previousId, version: note.attributes.extract_version,
        // Anchors are not stored, so any other page change is treated as a possible anchor change: fail closed (SELECTION_STALE).
        state: stale ? "SELECTION_STALE" : note.attributes.page_fingerprint === fingerprint ? "unchanged" : changes.length > 0 ? "tokens" : "changed",
        selection_changes: changes,
      };
    }
    const data = {
      ok: plan.ok, transcript_hash: hash, page_fingerprint: fingerprint, selection, problems: plan.problems,
      passages: plan.copied.map((entry) => ({ n: entry.n, hash: entry.hash, items: entry.items })),
      copied: plan.copied.map((entry) => ({ n: entry.n, text: entry.text, items: entry.items })),
      uncovered: plan.uncovered, body: plan.ok ? extractBody(plan) : null,
      ...(previous === undefined ? {} : { previous }),
    };
    return { data, human: plan.ok ? `${plan.copied.length} paragraph(s) would enter the extract; ${plan.uncovered} covered by no item\n` : `blocked: ${plan.problems.map((problem) => `${problem.code} ${problem.id ?? ""} ${problem.reason}`).join("; ")}\n` };
  },
};
