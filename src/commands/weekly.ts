import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname } from "node:path";

import { readDismissals, schemaProblems } from "../lib/assistant-dismissals.ts";
import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { serializeNewFile } from "../lib/frontmatter.ts";
import { generateId } from "../lib/ids.ts";
import { assertNoProblems, isRecord, readJsonInput } from "../lib/input.ts";
import { modulesOf } from "../lib/modules.ts";
import { compareCodePoints, scanNotes } from "../lib/notes.ts";
import { reportLinks } from "../lib/report-body.ts";
import { loadSchemas } from "../lib/schemas.ts";
import { requireSuppressions } from "../lib/suppressions.ts";
import { formatDate, formatTimestamp } from "../lib/time.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { reflectionNotes } from "../lib/reflect.ts";
import { computeClaims, nextCursor, titleChanges, type Claim } from "../lib/weekly-corrections.ts";
import { computePlan, correctionCursor, titlesSince, windowOf, type PlanData } from "../lib/weekly-plan.ts";
import { buildRow, MAX_WORDS, movedBody, nextState, recordProblems, renderBody, weeklyTitle, type RecordInput } from "../lib/weekly-record.ts";
import { waitingProposals } from "../lib/proposals.ts";
import { findTidyItems } from "../lib/tidy.ts";
import { computeSelection, selectProblems, type SelectInput, type Selection } from "../lib/weekly-select.ts";
import { emptyState, handoffPaths, isoWeek, localDate, mondayOf, readState, serializeState, STATE_PATH } from "../lib/weekly-state.ts";
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
    // Titles keep no history in their notes: the renames since the correction cursor are read from Git (weekly-review.md §8.1).
    const titles = await titleChanges(brain!.root, titlesSince(state, now), scanned.notes);
    const loaded = requireSuppressions(brain!.root);
    // The mechanical items (weekly-review.md §15.2), as `brain cleanup plan` finds them now, with this week's own row items kept for a rerun.
    const cleanup = await findTidyItems(brain!.root, scanned.notes, loaded, now, localDate(now), isoWeek(localDate(now)));
    const data = computePlan({ snapshot, notes: scanned.notes, loaded, config, dismissals: store.entries, state, now, titles, cleanup });
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
        cleanup: data.cleanup.length, done: data.done.length, carry: data.carry.length,
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
  summary: "Choose the week's row items within the limits (five Actions, ten doubtful items, five targets of session items) and queue the rest. Writes nothing.",
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
    const part = (letter: string) => data.items.filter((item) => item.part === letter).length;
    return { data, human: `${part("A")} actions, ${part("C")} doubtful items, ${part("T")} session items, ${data.queued.length} queued, coverage ${data.coverage}.\n` };
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
    const settings = isRecord(brain!.config.settings) ? brain!.config.settings : {};
    assertNoProblems(recordProblems(input, now, current, byId, settings.publish === "auto"));

    const proposals = new Map(input.proposals.map((entry) => [entry.key, entry.proposal]));
    const get = (id: string) => workspace.get(id);
    const previous = current?.weeks[input.plan.week]?.row ?? {};
    const row = buildRow(input, previous, (item) => item.proposal ?? proposals.get(item.key)!, get, workspace.notes);
    // The row's items leave the session's questions (§15.6): `weekly` names this week on each; a carried item queued, or an item of this
    // week's earlier row no longer offered, goes back to the session.
    const setWeekly = (id: string, value: string | null) => {
      const note = workspace.get(id);
      if (note === undefined || note.attributes.status !== "pending") return;
      const document = workspace.edit(note);
      if (value === null) delete document.attributes.weekly; else document.attributes.weekly = value;
      workspace.save(note.path, document);
    };
    for (const line of [...row.A, ...row.C]) setWeekly(line.proposal, input.plan.week);
    for (const id of [...row.queuedCarried, ...row.dropped]) setWeekly(id, null);
    // The base of each Action and doubtful item (§9.5): the hash of each Git file its change would write, read now.
    for (const line of [...row.A, ...row.C]) row.slots[line.label]!.base = baseOf(workspace, line.proposal);
    const waiting = waitingProposals(workspace, undefined).counts.waiting;
    const rendered = renderBody(input, row, waiting, byPath);
    assertNoProblems(rendered.problems);
    if (rendered.words > MAX_WORDS) throw new BrainError("WEEKLY_TOO_LONG", `Your week is ${rendered.words} words, over ${MAX_WORDS} (the header, the to-dos and link targets not counted): shorten In short, Highlights and Focus first`);

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
    const counts = { ...input.selection.counts, cleaned: row.U.length };
    const fields = {
      week: plan.week, window: { from: plan.window.from, to: plan.window.to }, coverage, omitted, counts,
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
    // An earlier row whose items moved here (§15.6) says where they went, once; its row is then Done.
    const moved: Array<{ id: string; path: string; week: string }> = [];
    for (const [earlier, entries] of row.moved) {
      const reportId = current?.weeks[earlier]?.report;
      const earlierReport = reportId === undefined ? undefined : workspace.get(reportId);
      if (earlierReport === undefined) continue;
      const document = workspace.edit(earlierReport);
      document.body = movedBody(document.body, new Set(entries.map((entry) => entry.label)), plan.week, entries.filter((entry) => entry.part === "A").length, entries.filter((entry) => entry.part === "C").length);
      document.attributes.updated = date;
      workspace.save(earlierReport.path, document);
      moved.push({ id: earlierReport.id, path: earlierReport.path, week: earlier });
      // The earlier row turns Done (§15.6): an item of it that didn't move (a dismissed finding's) goes back to the session.
      const movedIds = new Set(entries.map((entry) => entry.proposal));
      for (const [label, slot] of Object.entries(current?.weeks[earlier]?.row ?? {})) {
        if (!label.startsWith("U") && !movedIds.has(slot.proposal) && workspace.get(slot.proposal)?.attributes.weekly === earlier) setWeekly(slot.proposal, null);
      }
    }
    const state = nextState(current ?? emptyState(), input, { id, path }, row);
    workspace.writeText(STATE_PATH, serializeState(state));
    const errors = workspace.newErrors();
    if (errors.length > 0) assertNoProblems(errors.map((issue) => ({ pointer: "", message: `${issue.path}: ${issue.rule}: ${issue.message}` })));

    const failures = input.failures.length > 0 ? [["failures", input.failures.join("; ")] as const] : [];
    const pairs = [
      ["mode", input.mode], ["week", plan.week], ["coverage", coverage], ["actions", counts.actions], ["doubtful", counts.doubtful], ["cleaned", input.cleaned.length],
      ["targets", counts.targets], ["queued", counts.queued], ["changes", plan.changes.length], ["failed", input.failures.length], ...failures,
      ["published", input.publish ? "yes" : "no"], ["notes_read", input.notes_read], ["seconds", input.seconds],
    ] as const;
    const result = await workspace.commit([{ op: "weekly", id: "-", title: "", pairs }], now);
    // The hand-off is done: the report and the state are written (§5.34).
    await rm(files.plan, { force: true });
    await rm(files.selection, { force: true });
    return {
      data: { id, path, week: plan.week, coverage, counts, changed: [...result.created, ...result.changed].sort(compareCodePoints), moved },
      human: `${existing === undefined ? "wrote" : "rewrote"} ${path}: ${counts.actions} actions, ${counts.doubtful} doubtful, ${row.U.length} cleaned, coverage ${coverage}.\n`,
    };
  },
};

/** The base of a row item (weekly-review.md §9.5): `{ path, hash }` of each Git file its change would write; none for a Notion write or a new note. */
function baseOf(workspace: Workspace, proposal: string): Array<{ path: string; hash: string }> {
  const a = workspace.get(proposal)?.attributes ?? {};
  const ids = ["notion_change", "new_task", "new_item", "review_notes"].includes(String(a.kind)) ? [] : [a.target, a.merge_into, a.supersedes].filter((id): id is string => typeof id === "string");
  return [...new Set(ids)].flatMap((id) => {
    const note = workspace.get(id);
    return note === undefined ? [] : [{ path: note.path, hash: `sha256:${createHash("sha256").update(note.raw, "utf8").digest("hex")}` }];
  });
}

/** The queued claims as `plan` would list them now (weekly-review.md §8.1, §8.2), without a snapshot or any weekly limit. */
async function queuedClaims(root: string, now: Date): Promise<{ claims: Claim[]; state: ReturnType<typeof readState> }> {
  const state = readState(root);
  const scanned = await scanNotes(root);
  const week = isoWeek(localDate(now));
  const titles = await titleChanges(root, titlesSince(state, now), scanned.notes);
  const eligible = reflectionNotes(scanned.notes, requireSuppressions(root));
  // The on-demand path reads the cursor as it is now, not as the week's first report found it (that is a rerun's rule, §8.1).
  const cursor = state?.corrections ?? correctionCursor(null, week);
  const claims = computeClaims({ eligible, all: scanned.notes, cursor, windowFrom: windowOf(state, week, now).from.slice(0, 10), titles });
  return { claims, state };
}

function count(value: unknown, name: string, fallback: number, minimum: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new BrainError("USAGE", `--${name} must be an integer of at least ${minimum}`);
  return parsed;
}

/** `brain weekly corrections list [--offset <n>] [--limit <n>]` (cli.md §5.34): the on-demand path's queue. Writes nothing. */
export const weeklyCorrectionsListCommand: Command = {
  name: "weekly corrections list",
  usage: "brain weekly corrections list [--offset <n>] [--limit <n>] [--json]",
  summary: "The queued correction checks and their candidate targets, for \"weekly review corrections\". Writes nothing.",
  options: { offset: "string", limit: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const offset = count(args.options.offset, "offset", 0, 0);
    const limit = count(args.options.limit, "limit", 10, 1);
    const { claims } = await queuedClaims(brain!.root, now);
    const page = claims.slice(offset, offset + limit);
    const next = offset + limit < claims.length ? offset + limit : null;
    return {
      data: { claims: page, total: claims.length, offset, next_offset: next },
      human: claims.length === 0 ? "No correction checks are queued.\n" : `${claims.length} correction check${claims.length === 1 ? "" : "s"} queued; showing ${page.length} from ${offset}.\n`,
    };
  },
};

/** `brain weekly corrections done --input <file|->` (cli.md §5.34): writes only the correction cursor of `_weekly/state.json`. */
export const weeklyCorrectionsDoneCommand: Command = {
  name: "weekly corrections done",
  usage: "brain weekly corrections done --input <file|-> [--json]",
  summary: "Record the correction checks \"weekly review corrections\" finished, and keep the rest queued.",
  options: { input: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = validated<{ claims: Array<{ claim: string; open: string[] }> }>("correctionsDone", await readJsonInput(args.options.input as string | undefined, "weekly corrections done"));
    const { claims, state } = await queuedClaims(brain!.root, now);
    const byClaim = new Map(claims.map((claim) => [claim.claim, claim]));
    const problems: Array<{ pointer: string; message: string }> = [];
    const named = new Set<string>();
    input.claims.forEach((entry, index) => {
      const claim = byClaim.get(entry.claim);
      if (claim === undefined) { problems.push({ pointer: `/claims/${index}/claim`, message: `${entry.claim} is no queued correction check now` }); return; }
      if (named.has(entry.claim)) problems.push({ pointer: `/claims/${index}/claim`, message: `${entry.claim} is named twice` });
      named.add(entry.claim);
      entry.open.forEach((note, at) => { if (!claim.targets.some((target) => target.note === note)) problems.push({ pointer: `/claims/${index}/open/${at}`, message: `${note} is no candidate target of ${entry.claim}` }); });
    });
    assertNoProblems(problems);
    // A claim the chat didn't reach stays queued with every target not yet proposed, so moving the cursor skips nothing (§8.4).
    const given = new Map(input.claims.map((entry) => [entry.claim, entry.open]));
    const outcomes = new Map(claims.map((claim) => [claim.claim, given.get(claim.claim) ?? claim.targets.filter((target) => target.pending === null).map((target) => target.note)]));
    const current = state ?? emptyState();
    const corrections = nextCursor(current.corrections, claims, outcomes, localDate(now));
    await ensureDirectory(brain!.root, "_weekly");
    await atomicWriteFile(brain!.root, STATE_PATH, serializeState({ ...current, corrections }));
    const finished = claims.filter((claim) => (outcomes.get(claim.claim) ?? []).length === 0).map((claim) => claim.claim);
    const open = corrections.open.map((entry) => entry.claim);
    await appendLog(brain!.root, now, [{ op: "weekly-corrections", id: "-", title: "", pairs: [["finished", finished.length], ["open", open.length]] as const }]);
    return {
      data: { finished, open, checked_on: corrections.checked_on },
      human: `${finished.length} correction check${finished.length === 1 ? "" : "s"} finished, ${open.length} still queued.\n`,
    };
  },
};

export const WEEKLY_COMMANDS = [weeklyPlanCommand, weeklySelectCommand, weeklyRecordCommand, weeklyCorrectionsListCommand, weeklyCorrectionsDoneCommand];
