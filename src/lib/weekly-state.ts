import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { BrainError } from "./errors.ts";
import { isRecord } from "./input.ts";
import { compareCodePoints } from "./notes.ts";
import { slugify } from "./paths.ts";
import { describeErrors, loadSchemas } from "./schemas.ts";

// The weekly review's run state and its calendar (spec/weekly-review.md §2, §9.5; spec/schemas/weekly.schema.json $defs/state).

export const STATE_PATH = "_weekly/state.json";
export const ATTEMPT_PATH = "_weekly/attempt.json";
export const KEEP_WEEKS = 8;
export const KEEP_SHOWN_WEEKS = 26;
export const LIMIT = 5;
const DAY_MS = 86_400_000;

export interface Counts { decisions: number; new_items: number; targets: number; queued: number }
export interface WeekEntry { report: string; path: string; window_from: string; window_skip: string[]; input_hash: string; counts: Counts; items: string[] }
export interface ShownEntry { key: string; week: string; category: string; evidence_hash: string; days_late?: number; days_idle?: number }
export interface WeeklyState {
  version: 1;
  last_success: { week: string; report: string; covered_to: string; covered_on_to: string[]; coverage: "complete" | "partial" } | null;
  weeks: Record<string, WeekEntry>;
  shown: ShownEntry[];
  queued: Array<{ key: string; week: string }>;
  carry: { clusters: string[] };
  corrections: { checked_on: string | null; done_on_date: string[]; open: Array<{ claim: string; targets: string[] }> };
}

export const ZERO: Counts = { decisions: 0, new_items: 0, targets: 0, queued: 0 };

export function emptyState(): WeeklyState {
  return { version: 1, last_success: null, weeks: {}, shown: [], queued: [], carry: { clusters: [] }, corrections: { checked_on: null, done_on_date: [], open: [] } };
}

/** What is wrong with a parsed state file: the schema of $defs/state, then repeated keys and weeks (lint `weekly-state`, cli.md §5.10). */
export function stateProblems(value: unknown): string[] {
  const validate = loadSchemas().weekly("state");
  if (!validate(value)) return describeErrors(validate.errors);
  const state = value as WeeklyState;
  const problems: string[] = [];
  for (const [list, name] of [[state.shown, "shown"], [state.queued, "queued"]] as const) {
    const seen = new Set<string>();
    for (const entry of list) {
      if (seen.has(entry.key)) problems.push(`${name} repeats the key ${entry.key}`);
      seen.add(entry.key);
    }
  }
  if (state.last_success !== null && state.weeks[state.last_success.week] === undefined) problems.push(`last_success names the week ${state.last_success.week}, which weeks doesn't hold`);
  return problems;
}

/** lint `weekly-state` (cli.md §5.10): every problem of the state file, or [] when it is missing or sound. */
export function stateFileProblems(root: string): string[] {
  const path = join(root, STATE_PATH);
  if (!existsSync(path)) return [];
  try {
    return stateProblems(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    return [`not readable JSON: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/** The state file: null when missing (a first run), else the state. Damaged → WEEKLY_STATE_UNREADABLE (weekly-review.md §9.5). */
export function readState(root: string): WeeklyState | null {
  const path = join(root, STATE_PATH);
  if (!existsSync(path)) return null;
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new BrainError("WEEKLY_STATE_UNREADABLE", `${STATE_PATH} is not readable JSON (${error instanceof Error ? error.message : String(error)}); run brain lint to see it`);
  }
  const problems = stateProblems(value);
  if (problems.length > 0) throw new BrainError("WEEKLY_STATE_UNREADABLE", `${STATE_PATH}: ${problems[0]}; run brain lint to see it`);
  return value as WeeklyState;
}

/** The state as written: keys in §9.5's order, 2-space JSON, a final newline. */
export function serializeState(state: WeeklyState): string {
  const weeks = Object.fromEntries(Object.keys(state.weeks).sort(compareCodePoints).map((week) => [week, state.weeks[week]!]));
  const ordered = { version: 1, last_success: state.last_success, weeks, shown: state.shown, queued: state.queued, carry: state.carry, corrections: state.corrections };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** The machine's local date of an instant (weekly-review.md §2: the week of the run's local date). */
export function localDate(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The ISO 8601 week of a date, `2026-W46`. */
export function isoWeek(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday 0
  const thursday = new Date(day.getTime() + (3 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstMonday = firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % 7) * DAY_MS;
  const week = 1 + Math.floor((thursday.getTime() - 3 * DAY_MS - firstMonday) / (7 * DAY_MS));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The Monday of a date's ISO week, as a date. */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Weeks between two ISO weeks, by their Mondays (`b` − `a`). */
export function weeksBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${mondayOfWeek(b)}T00:00:00Z`) - Date.parse(`${mondayOfWeek(a)}T00:00:00Z`)) / (7 * DAY_MS));
}

/** The Monday of an ISO week. */
export function mondayOfWeek(week: string): string {
  const [year, number] = week.split("-W").map(Number) as [number, number];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const firstMonday = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS;
  return new Date(firstMonday + (number - 1) * 7 * DAY_MS).toISOString().slice(0, 10);
}

/** sha256 of a value's canonical JSON (object keys sorted), as `sha256:<hex>`. */
export function hashOf(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value ?? null);
}

/** The brain's part of a schedule label (cli.md §5.21): `<folder slug>-<first 8 hex of sha256(path)>`. */
export function brainLabel(root: string): string {
  const hash = createHash("sha256").update(root).digest("hex").slice(0, 8);
  return `${slugify(basename(root)) || "brain"}-${hash}`;
}

/** Where the skill writes the Notion snapshot (cli.md §5.2 `weekly_snapshot`, §5.34). */
export function weeklySnapshotPath(root: string, home: string): string {
  return join(home, ".ultimate-brain", "weekly", `${brainLabel(root)}.json`);
}

/** The hand-off files beside the snapshot (cli.md §5.34): the full plan and the selection, outside the brain. */
export function handoffPaths(root: string, home: string): { plan: string; selection: string } {
  const snapshot = weeklySnapshotPath(root, home);
  return { plan: snapshot.replace(/\.json$/, ".plan.json"), selection: snapshot.replace(/\.json$/, ".selection.json") };
}

/** settings.weekly with its defaults (schema §12, weekly-review.md §12). */
export function weeklySettings(config: Record<string, unknown>): { minutes: number; max_judged: number; max_usd: number; schedule: "on" | "off" } {
  const settings = isRecord(config.settings) ? config.settings : {};
  const weekly = isRecord(settings.weekly) ? settings.weekly : {};
  const positive = (value: unknown, fallback: number) => (typeof value === "number" && value > 0 ? value : fallback);
  return {
    minutes: positive(weekly.minutes, 10),
    max_judged: positive(weekly.max_judged, 30),
    max_usd: positive(weekly.max_usd, 3),
    schedule: weekly.schedule === "on" ? "on" : "off",
  };
}
