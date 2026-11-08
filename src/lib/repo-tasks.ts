import { createHash } from "node:crypto";

import { BrainError } from "./errors.ts";
import { assertNoProblems, isRecord, type InputProblem } from "./input.ts";
import type { Kit, Meaning, TaskSource } from "./link-kit.ts";

// The task sources and the read-only rollup of spec/linked-repos.md §2.4 and §4.

export interface TaskItem { key: string; title: string; raw: string; meaning: Meaning | null; url?: string }

export interface IssueInput { fetched_at: string; items: Array<{ number: number; title: string; state: string; state_reason?: string; labels: string[]; url: string }> }

const DEFAULT_MAPS: Record<string, Record<string, Meaning>> = {
  checklist: { " ": "todo", x: "done", X: "done" },
  pattern: {},
  github: { open: "todo", "closed:completed": "done", "closed:not_planned": "dropped" },
  gitlab: { opened: "todo", closed: "done" },
};

const norm = (raw: string): string => raw.trim().toLowerCase();

/** The status map of a source: its default, with the kit's entries added, a kit entry winning on the same key (§2.4). Keys normalised. */
export function statusMap(kit: Kit): Map<string, Meaning> {
  const source = kit.tasks?.source;
  const base = source === undefined || source.kind === "notion" ? {} : DEFAULT_MAPS[source.kind === "markdown" ? source.format : source.kind]!;
  const map = new Map<string, Meaning>();
  for (const [raw, meaning] of Object.entries({ ...base })) map.set(norm(raw), meaning);
  for (const [raw, meaning] of Object.entries(kit.tasks?.status_map ?? {})) map.set(norm(raw), meaning);
  return map;
}

/** The lines a Markdown source reads (§2.4): LF lines without a trailing CR, outside fenced code blocks, at most 2,000 characters. */
function readableLines(text: string): string[] {
  return readableLinesWithIndex(text).map((entry) => entry.line);
}

/** The lines a Markdown source reads (§2.4), each with its 0-based index among the file's LF lines (`brain recall`'s stopped line, memory.md §5.1). */
export function readableLinesWithIndex(text: string): Array<{ index: number; line: string }> {
  const lines: Array<{ index: number; line: string }> = [];
  let fence: string | null = null;
  for (const [index, raw] of text.split("\n").entries()) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const opener = /^(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      if (opener !== null && opener[1]![0] === fence[0] && opener[1]!.length >= fence.length && line.slice(opener[1]!.length).trim() === "") fence = null;
      continue;
    }
    if (opener !== null) { fence = opener[1]!; continue; }
    if (line.length > 2000) continue;
    lines.push({ index, line });
  }
  return lines;
}

const lineKey = (title: string): string => `line:${createHash("sha256").update(title.trim(), "utf8").digest("hex").slice(0, 12)}`;

/** Give a repeated key `#2`, `#3`… in source order (§2.4). */
function dedupe<T extends { key: string }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  for (const item of items) {
    const count = (seen.get(item.key) ?? 0) + 1;
    seen.set(item.key, count);
    if (count > 1) item.key = `${item.key}#${count}`;
  }
  return items;
}

/** The items of a Markdown source (§2.4), each with its raw status and meaning. */
export function parseMarkdownTasks(text: string, source: Extract<TaskSource, { kind: "markdown" }>, map: Map<string, Meaning>): TaskItem[] {
  const items: TaskItem[] = [];
  const regexp = source.format === "pattern" ? new RegExp(source.pattern, "u") : null;
  for (const line of readableLines(text)) {
    if (regexp === null) {
      const match = /^\s*[-*+] \[(.)\] (.+)$/u.exec(line);
      if (match === null) continue;
      const title = match[2]!.trim();
      if (title === "") continue;
      items.push({ key: lineKey(title), title, raw: match[1]!, meaning: map.get(norm(match[1]!)) ?? null });
    } else {
      const match = regexp.exec(line);
      if (match === null || match.groups?.title === undefined) continue;
      const title = match.groups.title.trim();
      const raw = match.groups.status ?? "";
      const id = match.groups.id;
      items.push({ key: id !== undefined && id !== "" ? id : lineKey(title), title, raw, meaning: map.get(norm(raw)) ?? null });
    }
  }
  return dedupe(items);
}

/** Validate the issue input of `repo tasks` and `repo health` (cli.md §5.29). */
export function checkIssueInput(value: unknown, kind: "github" | "gitlab"): IssueInput {
  const problems: InputProblem[] = [];
  if (!isRecord(value)) throw new BrainError("INPUT_INVALID", "The issue input must be a JSON object", [{ pointer: "", message: "must be an object" }]);
  if (typeof value.fetched_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.fetched_at)) problems.push({ pointer: "/fetched_at", message: "must be an ISO 8601 UTC timestamp" });
  if (!Array.isArray(value.items)) problems.push({ pointer: "/items", message: "must be a list" });
  const states = kind === "github" ? ["open", "closed"] : ["opened", "closed"];
  (Array.isArray(value.items) ? value.items : []).forEach((item: unknown, index: number) => {
    const at = `/items/${index}`;
    if (!isRecord(item)) { problems.push({ pointer: at, message: "must be an object" }); return; }
    if (!Number.isInteger(item.number)) problems.push({ pointer: `${at}/number`, message: "must be an integer" });
    if (typeof item.title !== "string") problems.push({ pointer: `${at}/title`, message: "must be a string" });
    if (!states.includes(String(item.state))) problems.push({ pointer: `${at}/state`, message: `must be ${states.join(" or ")}` });
    if (item.state_reason !== undefined && !(kind === "github" && ["completed", "not_planned"].includes(String(item.state_reason)))) problems.push({ pointer: `${at}/state_reason`, message: "must be completed or not_planned (GitHub)" });
    if (!Array.isArray(item.labels) || item.labels.some((label) => typeof label !== "string")) problems.push({ pointer: `${at}/labels`, message: "must be a list of strings" });
    if (typeof item.url !== "string") problems.push({ pointer: `${at}/url`, message: "must be a string" });
  });
  assertNoProblems(problems);
  return value as unknown as IssueInput;
}

/** The items of GitHub or GitLab issues (§2.4): an open issue takes its first mapped label's meaning; a closed one ignores labels. */
export function parseIssues(input: IssueInput, kind: "github" | "gitlab", map: Map<string, Meaning>): TaskItem[] {
  return input.items.map((issue) => {
    let raw: string;
    if (issue.state === "closed") raw = kind === "github" ? `closed:${issue.state_reason ?? "completed"}` : "closed";
    else raw = issue.state;
    let meaning = map.get(norm(raw)) ?? null;
    if (issue.state !== "closed") {
      const label = issue.labels.find((name) => map.has(norm(`label:${name}`)));
      if (label !== undefined) { raw = `label:${label}`; meaning = map.get(norm(raw))!; }
    }
    return { key: `#${issue.number}`, title: issue.title, raw, meaning, url: issue.url };
  });
}

export type Counts = Record<Meaning | "unmapped", number>;

export function countItems(items: readonly TaskItem[]): Counts {
  const counts: Counts = { todo: 0, in_progress: 0, waiting: 0, review: 0, done: 0, dropped: 0, unmapped: 0 };
  for (const item of items) counts[item.meaning ?? "unmapped"] += 1;
  return counts;
}

/** done ÷ (total − dropped), rounded; null when no item is non-dropped (0055). */
export function percentOf(done: number, total: number, dropped: number): number | null {
  const base = total - dropped;
  return base <= 0 ? null : Math.round((done / base) * 100);
}

export function unmappedOf(items: readonly TaskItem[]): Array<{ raw: string; count: number }> {
  const groups = new Map<string, { raw: string; count: number }>();
  for (const item of items) {
    if (item.meaning !== null) continue;
    const key = norm(item.raw);
    const group = groups.get(key) ?? { raw: item.raw, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (value: number): string => String(value).padStart(2, "0");

/** `3 Nov 2026, 14:20` in UTC. */
export function formatAsOf(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** `3 Nov` in UTC. */
export function formatDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** `{a} x · {b} y`: the parts whose count is 0 left out. */
export function countParts(parts: ReadonlyArray<readonly [number, string]>, separator: string): string {
  return parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join(separator);
}

export function sourceLabel(source: TaskSource): string {
  if (source.kind === "markdown") return source.path;
  if (source.kind === "github") return `GitHub ${source.repo}`;
  if (source.kind === "gitlab") return `GitLab ${source.project}`;
  return "Notion";
}

const LISTED: ReadonlyArray<readonly [Meaning, string]> = [["in_progress", "In progress"], ["review", "In review"], ["waiting", "Waiting"], ["todo", "To do"]];

/** The toggle text of §4 (normative). */
export function rollupMarkdown(name: string, source: TaskSource, asOf: Date, items: readonly TaskItem[]): string {
  const first = `As of ${formatAsOf(asOf)} · from ${name} (${sourceLabel(source)})`;
  const capped = source.kind !== "markdown" && items.length >= 1000 ? " · first 1000 issues" : "";
  if (items.length === 0) return `${first} · no tasks found${capped}\n`;
  const counts = countItems(items);
  const open = counts.todo + counts.in_progress + counts.waiting + counts.review + counts.unmapped;
  const detail = countParts([[counts.in_progress, "in progress"], [counts.review, "in review"], [counts.waiting, "waiting"], [counts.todo, "to do"]], ", ");
  const percent = percentOf(counts.done, items.length, counts.dropped);
  const parts = [countParts([[counts.done, "completed"], [counts.dropped, "dropped"]], " · "), open > 0 ? `${open} open${detail === "" ? "" : ` (${detail})`}` : "", percent === null ? "" : `${percent}%`].filter((part) => part !== "");
  const lines = [`${first} · read-only${capped}`, parts.join(" · ")];
  const ordered = LISTED.flatMap(([meaning, label]) => items.filter((item) => item.meaning === meaning).map((item) => ({ item, label })));
  for (const { item, label } of ordered.slice(0, 20)) lines.push(`- ${label}: ${item.url === undefined ? item.title : `[${item.title}](${item.url})`}`);
  if (ordered.length > 20) lines.push(`…and ${ordered.length - 20} more open`);
  const unmapped = unmappedOf(items);
  for (const group of unmapped) lines.push(`Not mapped: "${group.raw}" (${group.count}). Map it in brain-kit.json.`);
  return `${lines.join("\n")}\n`;
}
