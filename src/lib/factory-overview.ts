import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, posix, sep } from "node:path";

import type { Brain } from "./brain.ts";
import type { Warning } from "./command.ts";
import { BrainError } from "./errors.ts";
import { factoryPath, factoryWorkflow, type Factory } from "./factories.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { matchesAny, readKitFile, validKit, type Kit, type Meaning, type TaskSource } from "./link-kit.ts";
import { scanNotes } from "./notes.ts";
import { blameAtHead, expandPath, fileAtHead, fileDirty, linkedRepos, modeAtHead, openRepo, type LinkedRepo } from "./repos.ts";
import { checkIssueInput, checklistMap, countItems, countsLine, dedupe, formatAsOf, formatDay, parseIssues, parseMarkdownLines, percentOf, sourceLabel, statusMap, type Counts, type IssueInput, type MarkdownSource, type TaskItem } from "./repo-tasks.ts";
import { compare, Records, type Json } from "./workflow-store.ts";

// What a Factory's overview rests on and its text (spec/connected-workflows.md §9.1; cli.md §5.39): read-only.

const TEXT_LIMIT = 20_000;
const CHECKLIST: MarkdownSource = { kind: "markdown", path: "", format: "checklist" };

export interface PlanFile { path: string; text: string; cut: boolean }
export interface PlanItem { key: string; title: string; meaning: Meaning | null; done_at: string | null }
export interface TakenItem { item: string; title: string; meaning: Meaning; done_at: string | null }

export interface Plan {
  /** The names the Plan line shows; empty means the plan wasn't found. */
  where: string[];
  not_found: string[];
  files: PlanFile[];
  items: PlanItem[];
  counts: Counts;
  percent: number | null;
}

export interface FactoryReading { found: boolean; plan: Plan | null; taken: TakenItem[]; folder: string | null; tasks: string; changed: boolean; warnings: Warning[] }

const hashJson = (value: unknown): string => `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;
const day = (date: Date): string => date.toISOString().slice(0, 10);
const characters = (text: string): string[] => [...text];

/** Text as it is parsed and hashed: UTF-8, CRLF as LF; null for bytes that aren't UTF-8. */
function textOf(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replaceAll("\r\n", "\n");
  } catch {
    return null;
  }
}

interface FoundFile { text: string; /** The committer dates of its lines, by 0-based line; null for a file on disk. */ dates: (() => Promise<Date[]>) | null }
type ReadPlanFile = (path: string) => Promise<FoundFile | null>;

/** A linked repo's plan file at `HEAD`: a symbolic link is followed inside the repo only, and never into what `never_read` excludes. */
function headReader(top: string, never: readonly string[]): ReadPlanFile {
  return async (path) => {
    let at = posix.normalize(path);
    for (let hops = 0; hops < 10; hops += 1) {
      if (at.startsWith("../") || at === ".." || matchesAny(never, at)) return null;
      const mode = await modeAtHead(top, at);
      const bytes = mode === null || mode === "040000" || mode === "160000" ? null : await fileAtHead(top, at);
      if (bytes === null) return null;
      const text = textOf(bytes);
      if (text === null) return null;
      if (mode !== "120000") { const file = at; return { text, dates: () => blameAtHead(top, file) }; }
      if (posix.isAbsolute(text)) return null;
      at = posix.normalize(posix.join(posix.dirname(at), text));
    }
    return null;
  };
}

/** A plain folder's plan file on disk: only a regular file whose real path stays in the folder. */
function diskReader(root: string): ReadPlanFile {
  return async (path) => {
    try {
      const real = await realpath(join(root, path));
      if (!real.startsWith(root.endsWith(sep) ? root : `${root}${sep}`) || !(await stat(real)).isFile()) return null;
      const text = textOf(await readFile(real));
      return text === null ? null : { text, dates: null };
    } catch {
      return null;
    }
  };
}

interface Folder { top: string; read: ReadPlanFile; named: string[]; kit: Kit | null; /** A linked repo, whose uncommitted changes are not read. */ repo: boolean }

/** The folder and the plan files it names (§9.1's table), or null when it isn't on this machine. */
async function openFolder(brain: Brain, entry: Factory, home?: string): Promise<Folder | null> {
  const stored = factoryPath(brain.config, entry);
  if (stored === undefined) return null;
  const path = expandPath(stored, home);
  let directory = false;
  try { directory = (await stat(path)).isDirectory(); } catch { /* not on this machine */ }
  const repo: LinkedRepo | undefined = entry.repo === undefined ? undefined : linkedRepos(brain.config).find((candidate) => candidate.name === entry.repo);
  if (repo === undefined) {
    if (!directory) return null;
    const top = await realpath(path);
    return { top, read: diskReader(top), named: entry.plan ?? [], kit: null, repo: false };
  }
  if (!directory) return null;
  const top = await openRepo(repo, home);
  if (repo.kit === undefined) return { top, read: headReader(top, repo.never_read ?? []), named: [], kit: null, repo: true };
  const kit = await validKit(await readKitFile(top), { notes: (await scanNotes(brain.root)).notes, config: brain.config, repos: linkedRepos(brain.config), home }, { entry: repo });
  const never = [...(repo.never_read ?? []), ...(kit.knowledge.never_read ?? [])];
  const source = kit.tasks?.source;
  const named = [...new Set([...(kit.plan ?? []), ...(source?.kind === "markdown" ? [source.path] : [])])].filter((file) => !matchesAny(never, file));
  return { top, read: headReader(top, never), named, kit, repo: true };
}

/** The issue source of a `tracked-in-repo` kit, or null. */
function issueSource(kit: Kit | null): Extract<TaskSource, { kind: "github" | "gitlab" }> | null {
  const source = kit?.tasks?.mode === "tracked-in-repo" ? kit.tasks.source : undefined;
  return source?.kind === "github" || source?.kind === "gitlab" ? source : null;
}

/** `factory read` with `repo tasks`' issue input, whose `closed_at` only this command reads (cli.md §5.29, §5.39). */
function issueInput(value: unknown, kind: "github" | "gitlab"): IssueInput {
  const input = checkIssueInput(value, kind);
  const problems: InputProblem[] = [];
  input.items.forEach((item, index) => {
    if (item.closed_at !== undefined && item.closed_at !== null && !isTimestamp(item.closed_at)) problems.push({ pointer: `/items/${index}/closed_at`, message: "must be a UTC timestamp or null" });
  });
  assertNoProblems(problems);
  return input;
}

const isTimestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));

/** When a taken task was finished (§9.1): the user's acceptance, else the last criterion met, else its latest progress. */
function finishedAt(item: Json): string | null {
  if (item.status !== "done") return null;
  const met = (item.acceptance as Json[]).map((criterion) => criterion.met_at as string | null).filter((at): at is string => at !== null).sort();
  const at = (item.accepted?.at as string | undefined) ?? met.at(-1) ?? ((item.progress as Json[]).map((entry) => entry.at as string).sort().at(-1));
  return at === undefined ? null : at.slice(0, 10);
}

/** The items of the Factory's workflow that isn't ended, in id order. */
export function takenItems(root: string, id: string): TakenItem[] {
  const workflow = factoryWorkflow(root, id);
  if (workflow === null) return [];
  return [...Records.load(root, workflow.id).items.values()].sort((a, b) => compare(a.id, b.id))
    .map((item) => ({ item: item.id as string, title: item.title as string, meaning: item.status as Meaning, done_at: finishedAt(item) }));
}

/** Read a Factory's plan files and taken tasks (cli.md §5.39 `read`). `issues` is the parsed `--issues`, undefined without it. */
export async function readFactory(brain: Brain, entry: Factory, issues: unknown, home?: string): Promise<FactoryReading> {
  const taken = takenItems(brain.root, entry.id);
  const tasks = hashJson(taken.map(({ item, title, meaning, done_at }) => [item, title, meaning, done_at]));
  const folder = await openFolder(brain, entry, home);
  if (folder === null) {
    const path = factoryPath(brain.config, entry);
    return { found: false, plan: null, taken, folder: null, tasks, changed: false, warnings: [{ code: "PATH_MISSING", message: path === undefined ? `${entry.name} is unlinked: the brain has no folder for it` : `${path} isn't on this machine`, ...(path === undefined ? {} : { path }) }] };
  }
  const source = issueSource(folder.kit);
  if (source !== null && issues === undefined) throw new BrainError("USAGE", `${entry.name}'s tasks are ${source.kind} issues: pass --issues with the ones the skill fetched`);
  if (source === null && issues !== undefined) throw new BrainError("USAGE", `${entry.name} has no GitHub or GitLab task source: drop --issues`);

  const warnings: Warning[] = [];
  const files = new Map<string, FoundFile | null>();
  for (const path of folder.named) {
    files.set(path, await folder.read(path));
    if (folder.repo && await fileDirty(folder.top, path)) warnings.push({ code: "REPO_DIRTY", message: `${path} has uncommitted changes; the overview reads it at HEAD`, path });
  }

  const items: PlanItem[] = [];
  const markdown = async (file: FoundFile | null, as: MarkdownSource, map: Map<string, Meaning>) => {
    if (file === null) return;
    const lines = parseMarkdownLines(file.text, as, map);
    const dates = file.dates !== null && lines.some(({ item }) => item.meaning === "done") ? await file.dates() : null;
    for (const { item, line } of lines) {
      const at = item.meaning === "done" ? dates?.[line] : undefined;
      items.push({ key: item.key, title: item.title, meaning: item.meaning, done_at: at === undefined ? null : day(at) });
    }
  };
  const rows: unknown[] = [...files].map(([path, file]) => [path, file?.text ?? null]);
  const kit = folder.kit;
  if (source !== null) {
    const input = issueInput(issues, source.kind);
    const closed = new Map(input.items.map((issue) => [`#${issue.number}`, issue.closed_at ?? null]));
    for (const item of parseIssues(input, source.kind, statusMap(kit!))) {
      const at = item.meaning === "done" ? closed.get(item.key) ?? null : null;
      items.push({ key: item.key, title: item.title, meaning: item.meaning, done_at: at === null ? null : at.slice(0, 10) });
    }
    const listed = [...input.items].sort((a, b) => a.number - b.number);
    rows.push([source.kind === "github" ? `github:${source.repo}` : `gitlab:${source.project}`,
      listed.map((issue) => [issue.number, issue.title, issue.state, issue.state_reason ?? null, [...issue.labels].sort(compare), issue.closed_at ?? null])]);
  } else if (kit?.tasks?.mode === "tracked-in-repo" && kit.tasks.source.kind === "markdown") {
    await markdown(files.get(kit.tasks.source.path) ?? null, kit.tasks.source, statusMap(kit));
  } else {
    for (const file of files.values()) await markdown(file, CHECKLIST, checklistMap());
  }
  dedupe(items);

  const found = [...files].filter(([, file]) => file !== null);
  const counts = countItems(items as unknown as TaskItem[]);
  const plan: Plan = {
    where: found.length > 0 ? found.map(([path]) => path) : source !== null ? [sourceLabel(source)] : [],
    not_found: [...files].filter(([, file]) => file === null).map(([path]) => path),
    files: found.map(([path, file]) => {
      const text = characters(file!.text);
      return { path, text: text.slice(0, TEXT_LIMIT).join(""), cut: text.length > TEXT_LIMIT };
    }),
    items, counts, percent: percentOf(counts.done, items.length, counts.dropped),
  };
  const version = hashJson(rows);
  const before = entry.overview;
  return { found: true, plan, taken, folder: version, tasks, changed: before === undefined || before.folder !== version || before.tasks !== tasks, warnings };
}

// --- The text ------------------------------------------------------------------------------------------------------------

export interface OverviewInput { by: "session" | "catch-up"; plan: string | null; building_now: string[]; done: Array<{ text: string; date: string }> }

const realDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && day(new Date(`${value}T00:00:00Z`)) === value;

/** The input of `factory overview` (cli.md §5.39), against what `read` found. */
export function checkOverviewInput(value: unknown, reading: FactoryReading, now: Date): OverviewInput {
  if (!isRecord(value)) throw new BrainError("INPUT_INVALID", "1 problem in input:  must be an object", [{ pointer: "", message: "must be an object" }]);
  if (!reading.found) throw new BrainError("INPUT_INVALID", "1 problem in input:  the folder isn't on this machine", [{ pointer: "", message: "the folder isn't on this machine" }]);
  const problems: InputProblem[] = unknownKeys(value, ["by", "plan", "building_now", "done"], "");
  if (value.by !== "session" && value.by !== "catch-up") problems.push({ pointer: "/by", message: "must be session or catch-up" });
  const foundPlan = reading.plan!.where.length > 0;
  const { plan } = value;
  if (plan === null) { if (foundPlan) problems.push({ pointer: "/plan", message: `the plan was found (${reading.plan!.where.join(", ")}): say what it is` }); }
  else if (typeof plan !== "string" || plan.trim() === "") problems.push({ pointer: "/plan", message: "must be sentences, or null when no plan was found" });
  else if (!foundPlan) problems.push({ pointer: "/plan", message: "no plan was found: must be null" });
  else if (/[\r\n]/.test(plan)) problems.push({ pointer: "/plan", message: "must be on one line" });
  else if (characters(plan).length > 400) problems.push({ pointer: "/plan", message: "is longer than 400 characters" });
  for (const key of ["building_now", "done"] as const) {
    const list = value[key];
    if (list === undefined) continue;
    if (value.by === "catch-up") { problems.push({ pointer: `/${key}`, message: "is a session's: a catch-up passes none" }); continue; }
    if (!Array.isArray(list)) { problems.push({ pointer: `/${key}`, message: "must be a list" }); continue; }
    list.forEach((entry: unknown, index) => {
      const at = `/${key}/${index}`;
      if (key === "building_now") { if (typeof entry !== "string" || entry.trim() === "") problems.push({ pointer: at, message: "must be a text that isn't empty" }); return; }
      if (!isRecord(entry)) { problems.push({ pointer: at, message: "must be an object" }); return; }
      problems.push(...unknownKeys(entry, ["text", "date"], at));
      if (typeof entry.text !== "string" || entry.text.trim() === "") problems.push({ pointer: `${at}/text`, message: "must be a text that isn't empty" });
      if (!realDay(entry.date)) problems.push({ pointer: `${at}/date`, message: "must be a date, YYYY-MM-DD" });
      else if (entry.date > day(now)) problems.push({ pointer: `${at}/date`, message: "is in the future" });
    });
  }
  assertNoProblems(problems);
  return { building_now: [], done: [], ...value } as unknown as OverviewInput;
}

/** A title as the overview shows it: plain text on one line, with no `;`, which separates the items. */
const plain = (title: string): string => title.replace(/\s*[\r\n]+\s*/g, " ").replaceAll(";", ",").trim();
const short = (title: string): string => { const text = characters(title); return text.length > 80 ? `${text.slice(0, 79).join("")}…` : title; };

/** The overview's text (§9.1, normative) and its hash, without the date. */
export function overviewText(reading: FactoryReading, input: OverviewInput, now: Date): { markdown: string; sha256: string } {
  const plan = reading.plan!;
  const listed = new Set<string>();
  const once = <T extends { title: string }>(entries: T[]): T[] => entries.map((entry) => ({ ...entry, title: plain(entry.title) })).filter(({ title }) => {
    const key = title.toLowerCase();
    return title !== "" && !listed.has(key) && listed.add(key) !== undefined;
  });
  const five = (entries: Array<{ title: string }>): string => `${entries.slice(0, 5).map(({ title }) => short(title)).join("; ")}${entries.length > 5 ? `; and ${entries.length - 5} more` : ""}`;
  // Taken tasks first, then the plan's: the order of every list.
  const all: Array<{ title: string; meaning: Meaning | null; done_at: string | null }> = [...reading.taken, ...plan.items];
  const of = (...meanings: Meaning[]) => all.filter((item) => item.meaning !== null && meanings.includes(item.meaning));

  const building = once([...of("in_progress", "review"), ...input.building_now.map((title) => ({ title }))]);
  const next = once([...of("todo"), ...of("waiting")]);
  const to = day(now);
  const from = day(new Date(now.getTime() - 14 * 86_400_000));
  const finished = once([...of("done").map((item) => ({ title: item.title, date: item.done_at })), ...input.done.map((entry) => ({ title: entry.text, date: entry.date as string | null }))]
    .filter((item): item is { title: string; date: string } => item.date !== null && item.date >= from && item.date <= to)
    .map((item, order) => ({ ...item, order })).sort((a, b) => compare(b.date, a.date) || a.order - b.order)).slice(0, 5);

  const head = `As of ${formatAsOf(now)} · `;
  const lines = [`from ${input.by === "session" ? "the last session" : "the catch-up"}`];
  lines.push(plan.where.length > 0
    ? `Plan: ${input.plan!.trim()} Kept in ${plan.where.join(", ")}.`
    : `Plan: not found${plan.not_found.length > 0 ? ` (looked for ${plan.not_found.join(", ")})` : ""}. Say where it is in a session here.`);
  if (building.length > 0) lines.push(`Building now: ${five(building)}`);
  if (next.length > 0) lines.push(`Next: ${five(next)}`);
  if (finished.length > 0) lines.push(`Done lately: ${finished.map(({ title, date }) => `${short(title)} (${formatDay(new Date(`${date}T00:00:00Z`))})`).join("; ")}`);
  const counted = countsLine(plan.items.length > 0 ? plan.counts : countItems(reading.taken as unknown as TaskItem[]));
  if (counted !== "") lines.push(counted);
  const body = `${lines.join("\n")}\n`;
  return { markdown: `${head}${body}`, sha256: `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}` };
}
