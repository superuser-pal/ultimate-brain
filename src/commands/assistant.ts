import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

import { DAY_MS, DISMISS_DAYS, DISMISSALS_PATH, readDismissals, schemaProblems, serializeDismissals, type Dismissal } from "../lib/assistant-dismissals.ts";
import { computeFindings, type Snapshot } from "../lib/assistant-findings.ts";
import { reportText } from "../lib/assistant-report.ts";
import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { assertNoProblems, readJsonInput, type InputProblem } from "../lib/input.ts";
import { appendLog } from "../lib/log.ts";
import { modulesOf } from "../lib/modules.ts";
import { scanNotes } from "../lib/notes.ts";
import { loadSchemas } from "../lib/schemas.ts";
import { formatTimestamp, normalizeTimestamp } from "../lib/time.ts";

// `brain assistant findings` and `brain assistant dismiss` (spec/cli.md §5.31, spec/assistant.md §3, §4, §8).

const ID = "[0-9abcdefghjkmnpqrstvwxyz]{8}";
const PAGE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SUBJECT_KEY = new RegExp(`^(notion:${PAGE}|prj-${ID}|area-${ID})$`);

function positiveInteger(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1) throw new BrainError("USAGE", `--${name} must be an integer of at least 1`);
  return Number(value);
}

function unreadable(problems: readonly string[]): never {
  throw new BrainError("DISMISSALS_UNREADABLE", `${problems[0]}; run brain lint to see it`);
}

/** Validate the snapshot (schema, then the Tasks module, cli.md §5.31) and truncate its timestamps to seconds (§3.1). */
function readSnapshot(value: unknown, tasksOn: boolean): Snapshot {
  const validate = loadSchemas().assistant("snapshot");
  if (!validate(value)) assertNoProblems(schemaProblems(validate.errors));
  const snapshot = value as Snapshot;
  const problems: InputProblem[] = [];
  if (snapshot.notion === "live" && tasksOn) {
    if (snapshot.tasks === undefined) problems.push({ pointer: "/tasks", message: "is required: the Tasks module is on" });
    if (snapshot.task_statuses === undefined) problems.push({ pointer: "/task_statuses", message: "is required: the Tasks module is on" });
  }
  if (!tasksOn) {
    if (snapshot.tasks !== undefined) problems.push({ pointer: "/tasks", message: "must be left out: the Tasks module is off" });
    if (snapshot.task_statuses !== undefined) problems.push({ pointer: "/task_statuses", message: "must be left out: the Tasks module is off" });
  }
  const seconds = (pointer: string, stamp: string): string => {
    const normal = normalizeTimestamp(stamp);
    if (normal === undefined) problems.push({ pointer, message: "is not a valid UTC timestamp" });
    return normal ?? stamp;
  };
  const result: Snapshot = { ...snapshot, as_of: seconds("/as_of", snapshot.as_of) };
  if (snapshot.tasks !== undefined) result.tasks = snapshot.tasks.map((task, index) => ({ ...task, created: seconds(`/tasks/${index}/created`, task.created), last_edited: seconds(`/tasks/${index}/last_edited`, task.last_edited) }));
  if (snapshot.projects !== undefined) result.projects = snapshot.projects.map((row, index) => ({ ...row, last_edited: seconds(`/projects/${index}/last_edited`, row.last_edited) }));
  assertNoProblems(problems);
  return result;
}

async function readExclude(path: string | undefined): Promise<Set<string>> {
  if (path === undefined) return new Set();
  const value = await readJsonInput(path, "assistant findings");
  const finding = loadSchemas().assistant("dismissInput");
  const problems: InputProblem[] = [];
  if (!Array.isArray(value)) assertNoProblems([{ pointer: "", message: "--exclude must hold an array of finding keys and subject keys" }]);
  const keys = value as unknown[];
  keys.forEach((key, index) => {
    const ok = typeof key === "string" && (SUBJECT_KEY.test(key) || finding({ dismissals: [{ key, reason: "" }] }));
    if (!ok) problems.push({ pointer: `/${index}`, message: "must be a finding key or a subject key (notion:<page id>, a prj- or area- id)" });
  });
  assertNoProblems(problems);
  return new Set(keys as string[]);
}

/** `brain assistant findings --input <file|-> [--scope <id>] [--limit <n>] [--exclude <file>] [--number-from <n>]` (cli.md §5.31). */
export const assistantFindingsCommand: Command = {
  name: "assistant findings",
  usage: "brain assistant findings --input <file|-> [--scope <id>] [--limit <n>] [--exclude <file>] [--number-from <n>] [--json]",
  summary: "Compute Ultimate Assistant's findings from the brain and a Notion snapshot, ranked, with the report text. Writes nothing.",
  options: { input: "string", scope: "string", limit: "string", exclude: "string", "number-from": "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const limit = positiveInteger(args.options.limit, "limit", 10);
    const numberFrom = positiveInteger(args.options["number-from"], "number-from", 1);
    const config = brain!.config;
    const snapshot = readSnapshot(await readJsonInput(args.options.input as string | undefined, "assistant findings"), modulesOf(config).tasks);
    const exclude = await readExclude(args.options.exclude as string | undefined);
    const { notes } = await scanNotes(brain!.root);
    const store = readDismissals(brain!.root);
    if (store.problems.length > 0) unreadable(store.problems);

    const scopeId = args.options.scope as string | undefined;
    const scope = scopeId === undefined ? null : notes.find((note) => note.id === scopeId) ?? null;
    if (scopeId !== undefined && scope === null) throw new BrainError("UNKNOWN_ID", `--scope: no note with id ${scopeId}`);
    if (scope !== null && !["area", "domain", "project"].includes(scope.type)) assertNoProblems([{ pointer: "", message: `--scope ${scope.id} is a ${scope.type}, not an Area, Domain or Project` }]);

    const result = computeFindings({ snapshot, notes, config, dismissals: store.entries, scope, exclude, limit, numberFrom });
    const report = reportText(result, snapshot.as_of, scope);
    const findings = result.findings.map((finding) => ({
      rank: finding.rank, key: finding.key, signal: finding.signal, category: finding.category, subject: finding.subject,
      project: finding.project, area: finding.area, evidence: finding.evidence, recommendations: finding.recommendations, status_offers: finding.status_offers,
    }));
    return {
      data: {
        as_of: snapshot.as_of, mode: result.mode, scope: scope?.id ?? null, read: result.read, statuses_as_of: result.statuses_as_of,
        skipped_signals: result.skipped_signals, repos_failed: result.repos_failed,
        total: result.total, dismissed: result.dismissed, excluded: result.excluded, number_from: numberFrom,
        findings, report,
      },
      human: report,
    };
  },
};

/** `brain assistant dismiss --input <file|->` (cli.md §5.31, assistant.md §8). */
export const assistantDismissCommand: Command = {
  name: "assistant dismiss",
  usage: "brain assistant dismiss --input <file|-> [--json]",
  summary: "Remember a skipped Ultimate Assistant finding for 30 days, or forget one (remove).",
  options: { input: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "assistant dismiss");
    const validate = loadSchemas().assistant("dismissInput");
    if (!validate(input)) assertNoProblems(schemaProblems(validate.errors));
    const items = (input as { dismissals: Array<{ key: string; reason?: string; remove?: true }> }).dismissals;

    const problems: InputProblem[] = [];
    const seen = new Set<string>();
    items.forEach((item, index) => {
      if (seen.has(item.key)) problems.push({ pointer: `/dismissals/${index}/key`, message: `${item.key} is listed twice` });
      seen.add(item.key);
      const pair = /^project_duplicate:(prj-\w+)\+(prj-\w+)$/.exec(item.key);
      if (pair !== null && !(pair[1]! < pair[2]!)) problems.push({ pointer: `/dismissals/${index}/key`, message: "a pair names two different projects, sorted" });
    });
    assertNoProblems(problems);
    const { notes } = await scanNotes(brain!.root);
    const ids = new Set(notes.map((note) => note.id));
    items.forEach((item, index) => {
      if (item.remove === true) return;
      const subject = item.key.slice(item.key.indexOf(":") + 1);
      if (subject.startsWith("notion:")) return;
      for (const id of subject.split("+")) if (!ids.has(id)) throw new BrainError("UNKNOWN_ID", `/dismissals/${index}/key: no note with id ${id}`, [{ pointer: `/dismissals/${index}/key`, message: `no note with id ${id}` }]);
    });

    const store = readDismissals(brain!.root);
    if (store.problems.length > 0) unreadable(store.problems);
    const nowMs = now.getTime();
    const entries = new Map<string, Dismissal>();
    let pruned = 0;
    for (const entry of store.entries) {
      if (Date.parse(entry.until) <= nowMs) pruned += 1;
      else entries.set(entry.key, entry);
    }
    const dismissedAt = formatTimestamp(now);
    const until = formatTimestamp(new Date(nowMs + DISMISS_DAYS * DAY_MS));
    const results = items.map((item) => {
      if (item.remove === true) {
        const had = entries.delete(item.key);
        return { key: item.key, result: had ? "removed" : "unchanged" };
      }
      const result = entries.has(item.key) ? "replaced" : "added";
      entries.set(item.key, { key: item.key, reason: item.reason ?? "", dismissed_at: dismissedAt, until });
      return { key: item.key, result, until };
    });

    if (entries.size > 0) {
      await ensureDirectory(brain!.root, "_assistant");
      await atomicWriteFile(brain!.root, DISMISSALS_PATH, serializeDismissals([...entries.values()]));
    } else if (existsSync(join(brain!.root, DISMISSALS_PATH))) {
      await unlink(join(brain!.root, DISMISSALS_PATH));
    }
    await appendLog(brain!.root, now, results.map((item) => ({ op: "assistant-dismiss", id: "-", title: "", pairs: [["key", item.key], ["result", item.result]] as const })));
    return {
      data: { path: DISMISSALS_PATH, items: results, pruned },
      human: results.map((item) => `${item.key}: ${item.result}\n`).join(""),
    };
  },
};
