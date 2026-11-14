import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname } from "node:path";

import { readDismissals, schemaProblems } from "../lib/assistant-dismissals.ts";
import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { serializeNewFile } from "../lib/frontmatter.ts";
import { generateId } from "../lib/ids.ts";
import { assertNoProblems, readJsonInput } from "../lib/input.ts";
import { modulesOf } from "../lib/modules.ts";
import { compareCodePoints, scanNotes } from "../lib/notes.ts";
import { reportLinks } from "../lib/report-body.ts";
import { loadSchemas } from "../lib/schemas.ts";
import { requireSuppressions } from "../lib/suppressions.ts";
import { formatDate, formatTimestamp } from "../lib/time.ts";
import { computePlan, type PlanData } from "../lib/weekly-plan.ts";
import { MAX_WORDS, nextState, recordProblems, renderBody, weeklyTitle, type RecordInput } from "../lib/weekly-record.ts";
import { computeSelection, selectProblems, type SelectInput, type Selection } from "../lib/weekly-select.ts";
import { emptyState, handoffPaths, mondayOf, readState, serializeState, STATE_PATH } from "../lib/weekly-state.ts";
import { Workspace } from "../lib/workspace.ts";
import { readSnapshot } from "./assistant.ts";

// `brain weekly plan`, `select` and `record` (spec/cli.md §5.34; spec/weekly-review.md).

function validated<T>(def: string, value: unknown): T {
  const validate = loadSchemas().weekly(def);
  if (!validate(value)) assertNoProblems(schemaProblems(validate.errors));
  return value as T;
}

// The hand-off files beside the snapshot (cli.md §5.34): written whole through a temporary file, so a reader never sees half of one.
async function saveHandoff(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

/** A saved hand-off file named by the plan's input_hash, checked against its schema and that hash (INPUT_INVALID otherwise). */
async function readHandoff<T extends { input_hash: string }>(path: string, def: string, hash: string, what: string, again: string): Promise<T> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch {
    assertNoProblems([{ pointer: "/input_hash", message: `no saved ${what} at ${path}: ${again}` }]);
  }
  const validate = loadSchemas().weekly(def);
  if (!validate(value)) assertNoProblems([{ pointer: "/input_hash", message: `the saved ${what} at ${path} is damaged: ${again}` }]);
  if ((value as T).input_hash !== hash) assertNoProblems([{ pointer: "/input_hash", message: `the saved ${what} is from another plan (${(value as T).input_hash}): ${again}` }]);
  return value as T;
}

/** `brain weekly plan --snapshot <file|-> [--now <ts>]` (cli.md §5.34). */
export const weeklyPlanCommand: Command = {
  name: "weekly plan",
  usage: "brain weekly plan --snapshot <file|-> [--json]",
  summary: "The weekly review's candidates: the week, its window, what changed, the assistant findings, the clusters, and whether the week is quiet. Writes nothing.",
  options: { snapshot: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, environment, now }) {
    if (args.options.snapshot === undefined) throw new BrainError("USAGE", "--snapshot names the Notion snapshot file (brain status's weekly_snapshot)");
    const config = brain!.config;
    const snapshot = readSnapshot(await readJsonInput(args.options.snapshot as string, "weekly plan"), modulesOf(config).tasks);
    const state = readState(brain!.root);
    const store = readDismissals(brain!.root);
    if (store.problems.length > 0) throw new BrainError("DISMISSALS_UNREADABLE", `${store.problems[0]}; run brain lint to see it`);
    const scanned = await scanNotes(brain!.root);
    const data = computePlan({ snapshot, notes: scanned.notes, loaded: requireSuppressions(brain!.root), config, dismissals: store.entries, state, now });
    const shown = data.findings.filter((finding) => finding.repetition.show).length;
    const files = handoffPaths(brain!.root, environment.homeDirectory ?? homedir());
    if (!data.quiet) {
      // A non-quiet plan replaces the plan file and drops the selection of an earlier plan; a quiet one writes nothing (§5.34).
      await saveHandoff(files.plan, data);
      await rm(files.selection, { force: true });
    }
    const summary = {
      week: data.week, as_of: data.as_of, local_date: data.local_date, notion: data.notion, window: data.window, report: data.report,
      input_hash: data.input_hash, quiet: data.quiet, file: data.quiet ? null : files.plan,
      counts: {
        changes: data.changes.length, findings: data.findings.length, findings_shown: shown, clusters: data.clusters.length,
        clusters_left: data.clusters_left.length, corrections: data.corrections.length, pending: data.pending.length, earlier_open: data.earlier_open,
      },
    };
    return {
      data: summary,
      warnings: scanned.problems.map((problem) => ({ code: problem.code, message: `${problem.path}: ${problem.message}`, path: problem.path })),
      human: data.quiet
        ? `${data.week}: quiet, nothing to write.\n`
        : `${data.week}: ${data.changes.length} changes, ${shown} findings to consider, ${data.clusters.length} clusters to judge${data.clusters_left.length > 0 ? ` (${data.clusters_left.length} beyond the budget)` : ""}.\n`,
    };
  },
};

/** `brain weekly select --input <file|->` (cli.md §5.34). */
export const weeklySelectCommand: Command = {
  name: "weekly select",
  usage: "brain weekly select --input <file|-> [--json]",
  summary: "Choose the week's decision items within the shared limits (five decisions, five new Review items, five targets) and queue the rest. Writes nothing.",
  options: { input: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, environment }) {
    const raw = validated<Partial<SelectInput> & { input_hash?: string; judged: SelectInput["judged"] }>("selectInput", await readJsonInput(args.options.input as string | undefined, "weekly select"));
    const files = handoffPaths(brain!.root, environment.homeDirectory ?? homedir());
    const plan = raw.plan ?? await readHandoff<PlanData>(files.plan, "plan", raw.input_hash!, "plan", "run brain weekly plan again");
    const input: SelectInput = { plan, judged: raw.judged };
    const { notes } = await scanNotes(brain!.root);
    const byId = new Map(notes.map((note) => [note.id, note]));
    assertNoProblems(selectProblems(input, byId));
    const data = computeSelection(input, byId, readState(brain!.root));
    await saveHandoff(files.selection, data);
    return { data, human: `${data.items.length} decision items, ${data.queued.length} queued, coverage ${data.coverage}.\n` };
  },
};

/** `brain weekly record --input <file|->` (cli.md §5.34). */
export const weeklyRecordCommand: Command = {
  name: "weekly record",
  usage: "brain weekly record --input <file|-> [--json]",
  summary: "Write this week's review (one file per ISO week, rewritten in place on a rerun) and the weekly state, and log the weekly line.",
  options: { input: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, environment, now }) {
    const raw = validated<Omit<RecordInput, "plan" | "selection"> & { plan?: PlanData; selection?: Selection; input_hash?: string }>("recordInput", await readJsonInput(args.options.input as string | undefined, "weekly record"));
    const files = handoffPaths(brain!.root, environment.homeDirectory ?? homedir());
    const { input_hash: hash, ...rest } = raw;
    const input: RecordInput = hash === undefined
      ? rest as RecordInput
      : {
          ...rest,
          plan: await readHandoff<PlanData>(files.plan, "plan", hash, "plan", "run brain weekly plan and select again"),
          selection: await readHandoff<Selection>(files.selection, "selection", hash, "selection", "run brain weekly select again"),
        };
    const current = readState(brain!.root);
    const workspace = await Workspace.open(brain!);
    const byId = new Map(workspace.notes.map((note) => [note.id, note]));
    const byPath = new Map(workspace.notes.map((note) => [note.path, note]));
    assertNoProblems(recordProblems(input, now, current, byId, modulesOf(brain!.config).reports));

    const proposals = new Map(input.proposals.map((entry) => [entry.key, entry.proposal]));
    const rendered = renderBody(input, (key) => proposals.get(key)!, byId, byPath);
    assertNoProblems(rendered.problems);
    if (rendered.words > MAX_WORDS) throw new BrainError("WEEKLY_TOO_LONG", `The review is ${rendered.words} words, over ${MAX_WORDS} (the header and link targets not counted): shorten What changed and Task analysis`);

    const plan: PlanData = input.plan;
    const monday = mondayOf(plan.local_date);
    const existing = plan.report === null ? undefined : workspace.get(plan.report.id);
    if (plan.report !== null && (existing === undefined || existing.type !== "view" || existing.attributes.view_kind !== "weekly_review")) {
      assertNoProblems([{ pointer: "/plan/report", message: `${plan.report.id} is not this week's weekly review` }]);
    }
    // generated_from: the notes the review rests on; the proposals it links are where items are decided, not sources (§3.4).
    const linked = reportLinks(workspace, rendered.body).linked.filter((linkedId) => byId.get(linkedId)?.type !== "proposal").sort(compareCodePoints);
    const coverage = input.selection.coverage;
    const omitted = { clusters: input.selection.omitted.clusters.length, correction_targets: input.selection.omitted.correction_targets };
    const date = formatDate(now);
    const fields = {
      week: plan.week, window: { from: plan.window.from, to: plan.window.to }, coverage, omitted, counts: input.selection.counts,
      generated_from: linked, generated_at: formatTimestamp(now),
    };
    let id: string;
    let path: string;
    if (existing !== undefined) {
      // A rerun in the same week: the same file, id, week, window.from and notion; new sections, generated_*, window.to, coverage (§2).
      const document = workspace.edit(existing);
      Object.assign(document.attributes, fields, { window: { from: (document.attributes.window as { from: string } | undefined)?.from ?? plan.window.from, to: plan.window.to }, updated: date });
      document.body = `\n${rendered.body}`;
      workspace.save(existing.path, document);
      id = existing.id;
      path = existing.path;
    } else {
      id = generateId("vw", workspace.ids());
      path = `reports/${monday}-weekly-review.md`;
      if (workspace.exists(path)) assertNoProblems([{ pointer: "/plan/report", message: `${path} exists but the state doesn't name it: plan again, or run brain lint` }]);
      workspace.write(path, serializeNewFile({ id, type: "view", title: weeklyTitle(monday), view_kind: "weekly_review", ...fields, created: date, updated: date }, rendered.body));
    }
    const state = nextState(current ?? emptyState(), input, { id, path });
    workspace.writeText(STATE_PATH, serializeState(state));
    const errors = workspace.newErrors();
    if (errors.length > 0) assertNoProblems(errors.map((issue) => ({ pointer: "", message: `${issue.path}: ${issue.rule}: ${issue.message}` })));

    const counts = input.selection.counts;
    const failures = input.failures.length > 0 ? [["failures", input.failures.join("; ")] as const] : [];
    const pairs = [
      ["mode", input.mode], ["week", plan.week], ["coverage", coverage], ["decisions", counts.decisions], ["new_items", counts.new_items],
      ["targets", counts.targets], ["queued", counts.queued], ["changes", plan.changes.length], ["failed", input.failures.length], ...failures,
      ["published", input.publish ? "yes" : "no"], ["notes_read", input.notes_read], ["seconds", input.seconds],
    ] as const;
    const result = await workspace.commit([{ op: "weekly", id: "-", title: "", pairs }], now);
    // The hand-off is done: the report and the state are written (§5.34).
    await rm(files.plan, { force: true });
    await rm(files.selection, { force: true });
    return {
      data: { id, path, week: plan.week, coverage, counts, changed: [...result.created, ...result.changed].sort(compareCodePoints) },
      human: `${existing === undefined ? "wrote" : "rewrote"} ${path}: ${counts.decisions} decisions, coverage ${coverage}.\n`,
    };
  },
};

export const WEEKLY_COMMANDS = [weeklyPlanCommand, weeklySelectCommand, weeklyRecordCommand];
