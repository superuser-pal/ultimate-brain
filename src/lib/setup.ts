import { execFile } from "node:child_process";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { isRecord } from "./input.ts";
import { databaseId, MODULES, missingFor, modulesOf } from "./modules.ts";
import type { Note } from "./notes.ts";
import { slugify } from "./paths.ts";
import { scheduleEntryOf } from "./schedule-entry.ts";
import { expandPath, workTreeTop } from "./repos.ts";
import { logLinesOf } from "./runs.ts";

const exec = promisify(execFile);

const RULES_END = "<!-- ultimate-brain:rules:end -->";
/** Core's databases (schema §12): always on, so always needed. */
const CORE_DATABASES = ["areas", "projects", "meetings", "people", "review", "inbox"];
/** The steps only an online or by-hand check proves, read from `setup` log lines (spec/setup.md §4.1, cli.md §5.2). */
const RECORDED = ["notion-mcp", "minutes-prompt", "brain-assistant", "seeding", "first-value", "schedule"] as const;
/** The items in setup's order (spec/setup.md §2), each with its human "next" wording (cli.md §5.2). */
const ORDER: ReadonlyArray<readonly [item: string, what: string]> = [
  ["git_identity", "set your Git identity"],
  ["remote", "add a private remote"],
  ["drop_folder", "create the drop folder"],
  ["language", "say the language of your notes"],
  ["notion-mcp", "connect your agent to Notion"],
  ["databases", "connect Notion"],
  ["minutes-prompt", "paste the minutes prompt"],
  ["brain-assistant", "set up Brain Assistant"],
  ["owner_person", "set your identities"],
  ["seeding", "seed your work"],
  ["first-value", "check first value"],
  ["schedule", "choose the schedule"],
];
/** First value's four checks, in a `first-value` line's keys (spec/setup.md §4.1, §10). */
const FIRST_VALUE_CHECKS = ["tasks", "report", "organised", "answer"] as const;
/** Left out of the count and of `next` without Notion AI (spec/setup.md §13). */
const NEEDS_NOTION_AI = new Set(["minutes-prompt", "brain-assistant"]);

export interface SetupChecks {
  git_identity: boolean;
  remote: boolean;
  databases: boolean;
  drop_folder: boolean;
  language: boolean;
  owner_person: boolean;
}

/** One first-value check's outcome; null when the line leaves the check out (not run yet). */
export type FirstValueOutcome = "pass" | "fail" | "unsuitable" | "skip" | null;

/** The latest `first-value` line (cli.md §5.2): its timestamp and each check's outcome. */
export type FirstValue = { at: string } & Record<(typeof FIRST_VALUE_CHECKS)[number], FirstValueOutcome>;

export interface SetupStatus {
  checks: SetupChecks;
  recorded: Record<(typeof RECORDED)[number], string | null>;
  first_value: FirstValue | null;
  template_version: string | null;
  required: { done: number; total: number };
  next: string | null;
  finished: boolean;
  drop_folder: DropFolderProposal;
}

/** Another brain the machine knows, and the drop folder it reads (cli.md §5.2). */
export interface OtherBrain {
  brain: string;
  folder: string;
}

/** The drop folder the settings screen proposes, so no two brains on a machine read one folder (cli.md §5.2, setup.md §7 item 4). */
export interface DropFolderProposal {
  proposed: string;
  exists: boolean;
  default_read_by: string | null;
  others: OtherBrain[];
}

const DEFAULT_DROP_FOLDER = "brain-dropbox";

/**
 * `brain status`'s `setup` block (spec/cli.md §5.2, spec/setup.md §5), computed offline: Git is read only through
 * `git config` and `git remote get-url origin` in the brain folder.
 */
export async function setupStatus(root: string, config: Record<string, unknown>, notes: readonly Note[], home?: string, env: NodeJS.ProcessEnv = {}): Promise<SetupStatus> {
  const rules = await myRules(root);
  const checks: SetupChecks = {
    git_identity: (await gitValue(root, ["config", "--get", "user.name"])) !== "" && (await gitValue(root, ["config", "--get", "user.email"])) !== "",
    remote: await ownRemote(root),
    databases: databasesConnected(config),
    drop_folder: await dropFolderExists(rules, root, home),
    language: rules.some((line) => line.startsWith("Language:")),
    owner_person: ownerPerson(config, notes),
  };

  const lines = await logLinesOf(root, "setup");
  const latest = new Map<string, (typeof lines)[number]>();
  for (const line of lines) if (line.pairs.step !== undefined) latest.set(line.pairs.step, line);
  const firstValueLine = latest.get("first-value");
  const firstValue = firstValueLine === undefined ? null : firstValueOf(firstValueLine.timestamp, firstValueLine.pairs);
  const tasksOff = !modulesOf(config).tasks;
  const recorded = Object.fromEntries(RECORDED.map((step) => {
    const line = latest.get(step);
    if (line === undefined) return [step, null];
    // First value counts only when its latest line passes, never an attempt (setup.md §5, §10).
    if (step === "first-value") return [step, line.pairs.result === "done" && firstValuePasses(firstValue!, tasksOff) ? line.timestamp : null];
    return [step, line.pairs.result === "done" || line.pairs.result === "declined" ? line.timestamp : null];
  })) as SetupStatus["recorded"];
  const notionAi = latest.get("prerequisites")?.pairs.notion_ai !== "no";

  const doneOf = (item: string): boolean => item in checks ? checks[item as keyof SetupChecks] : recorded[item as keyof SetupStatus["recorded"]] !== null;
  const items = ORDER.map(([item]) => item).filter((item) => notionAi || !NEEDS_NOTION_AI.has(item));
  const required = [...Object.keys(checks), "notion-mcp", ...(notionAi ? ["minutes-prompt", "brain-assistant"] : [])];

  const notion = isRecord(config.notion) ? config.notion : {};
  return {
    checks,
    recorded,
    first_value: firstValue,
    template_version: typeof notion.template_version === "string" ? notion.template_version : null,
    required: { done: required.filter(doneOf).length, total: required.length },
    next: items.find((item) => !doneOf(item)) ?? null,
    // A brain connected to Notion before 0.14.0 has no setup line, and may lack the Language and Drop folder lines (setup.md §5).
    finished: lines.some((line) => line.pairs.step === "finished") || (lines.length === 0 && checks.databases && checks.owner_person),
    drop_folder: await dropFolderProposal(root, home ?? homedir(), env),
  };
}

/** The first human line, shown only while setup is unfinished (cli.md §5.2); null once it is finished. */
export function setupLine(setup: SetupStatus): string | null {
  if (setup.finished) return null;
  const what = ORDER.find(([item]) => item === setup.next)?.[1];
  return `Setup: ${setup.required.done} of ${setup.required.total} done · ${what === undefined ? "" : `next: ${what} · `}say "set up my brain"`;
}

/** Each check's outcome as the line has it: left out is null, `skip` is kept only for `tasks`, any other value is `fail` (cli.md §5.2). */
function firstValueOf(at: string, pairs: Readonly<Record<string, string>>): FirstValue {
  const outcome = (check: (typeof FIRST_VALUE_CHECKS)[number]): FirstValueOutcome => {
    const value = pairs[check];
    if (value === undefined) return null;
    if (value === "pass" || value === "fail" || value === "unsuitable" || (value === "skip" && check === "tasks")) return value;
    return "fail";
  };
  return { at, tasks: outcome("tasks"), report: outcome("report"), organised: outcome("organised"), answer: outcome("answer") };
}

/** Every applicable check passes: `report`, `organised` and `answer` pass, and `tasks` passes or, with Tasks off, is skipped (setup.md §10). */
function firstValuePasses(firstValue: FirstValue, tasksOff: boolean): boolean {
  return firstValue.report === "pass" && firstValue.organised === "pass" && firstValue.answer === "pass"
    && (firstValue.tasks === "pass" || (tasksOff && firstValue.tasks === "skip"));
}

async function gitValue(root: string, args: string[]): Promise<string> {
  try {
    return (await exec("git", args, { cwd: root, encoding: "utf8" })).stdout.trim();
  } catch {
    return "";
  }
}

/** The brain is itself a Git repository (not a folder inside one) whose `origin` has a URL. Privacy is checked online (setup.md §3). */
async function ownRemote(root: string): Promise<boolean> {
  const top = await workTreeTop(root);
  if (top === null || top !== await realpath(root)) return false;
  return (await gitValue(root, ["remote", "get-url", "origin"])) !== "";
}

/** Every database of Core and of each module on, and the Tasks database with Tasks on (setup.md §5). */
function databasesConnected(config: Record<string, unknown>): boolean {
  if (CORE_DATABASES.some((key) => databaseId(config, key) === "")) return false;
  const on = modulesOf(config);
  return MODULES.every((module) => !on[module] || missingFor(config, module).length === 0);
}

function ownerPerson(config: Record<string, unknown>, notes: readonly Note[]): boolean {
  const person = isRecord(config.owner) ? config.owner.person : undefined;
  return typeof person === "string" && person !== "" && notes.some((note) => note.id === person && note.type === "person");
}

/**
 * The lines of the brain's `AGENTS.md` after the rules block's end marker, outside HTML comments, each with its leading
 * space removed (setup.md §4, §5). Empty when the file or the marker is missing.
 */
async function myRules(root: string): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(join(root, "AGENTS.md"), "utf8");
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((line) => line.trim() === RULES_END);
  if (end === -1) return [];
  // A comment is replaced by its line breaks, so the lines around it keep their places; an unclosed one runs to the end.
  const rest = lines.slice(end + 1).join("\n").replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => comment.replace(/[^\n]/g, ""));
  return rest.split("\n").map((line) => line.trimStart());
}

/** The first `Drop folder:` line's path (`~` expanded, backticks removed, relative to the brain folder); null without one. */
function dropFolderOf(rules: readonly string[], root: string, home?: string): string | null {
  const line = rules.find((candidate) => candidate.startsWith("Drop folder:"));
  if (line === undefined) return null;
  const path = line.slice("Drop folder:".length).replaceAll("`", "").trim();
  return path === "" ? null : resolve(root, expandPath(path, home));
}

/** The first `Drop folder:` line's path is an existing folder. */
async function dropFolderExists(rules: readonly string[], root: string, home?: string): Promise<boolean> {
  const path = dropFolderOf(rules, root, home);
  return path !== null && await isDirectory(path);
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** A path symlink-resolved when it exists, else as given (absolute). */
async function canonical(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

/**
 * The drop folder to propose (cli.md §5.2, setup.md §7 item 4): `~/Documents/brain-dropbox/`, else one named after this
 * brain, skipping every folder another brain the machine knows reads.
 */
async function dropFolderProposal(root: string, home: string, env: NodeJS.ProcessEnv): Promise<DropFolderProposal> {
  const others = await otherBrains(root, home, env);
  const read = new Set(others.map((other) => other.folder));
  const slug = slugify(basename(root)) || "brain";
  const seen = new Set<string>();
  let defaultReadBy: string | null = null;
  for (let n = 0; ; n += 1) {
    const name = n === 0 ? DEFAULT_DROP_FOLDER : `${slug}${n === 1 ? "" : `-${n}`}-dropbox`;
    if (seen.has(name)) continue;
    seen.add(name);
    const folder = await canonical(join(home, "Documents", name));
    if (n === 0) defaultReadBy = others.find((other) => other.folder === folder)?.brain ?? null;
    if (read.has(folder)) continue;
    return { proposed: `~/Documents/${name}/`, exists: await isDirectory(folder), default_read_by: defaultReadBy, others };
  }
}

/** The other brains the machine knows, with a drop folder: the default brain and each scheduled brain (cli.md §5.2). */
async function otherBrains(root: string, home: string, env: NodeJS.ProcessEnv): Promise<OtherBrain[]> {
  const self = await canonical(root);
  const candidates = [await defaultBrain(home), ...await scheduledBrains(home, env)].filter((brain): brain is string => brain !== null);
  const found = new Map<string, OtherBrain>();
  for (const candidate of candidates) {
    const brain = await canonical(candidate);
    if (brain === self || found.has(brain) || !await isDirectory(brain)) continue;
    const path = dropFolderOf(await myRules(brain), brain, home);
    if (path === null) continue;
    found.set(brain, { brain, folder: await canonical(path) });
  }
  return [...found.values()].sort((a, b) => a.brain.localeCompare(b.brain));
}

/** `brain` in `~/.config/ultimate-brain/config.json`, resolved as cli.md §4 does; null when absent or unreadable. */
async function defaultBrain(home: string): Promise<string | null> {
  const path = join(home, ".config", "ultimate-brain", "config.json");
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isRecord(parsed) || typeof parsed.brain !== "string" || parsed.brain.trim() === "") return null;
    return resolve(dirname(path), expandPath(parsed.brain, home));
  } catch {
    return null;
  }
}

/** The `brain` of each scheduled job's plist (cli.md §5.21); none when the folder or a file can't be read. */
async function scheduledBrains(home: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  const agents = env.UB_LAUNCH_AGENTS_DIR ?? join(home, "Library", "LaunchAgents");
  let names: string[];
  try {
    names = (await readdir(agents)).filter((name) => name.startsWith("eu.ultimate-brain.") && name.endsWith(".plist")).sort();
  } catch {
    return [];
  }
  const brains: string[] = [];
  for (const name of names) {
    try {
      const entry = scheduleEntryOf(await readFile(join(agents, name), "utf8"));
      if (isRecord(entry) && typeof entry.brain === "string" && entry.brain !== "") brains.push(entry.brain);
    } catch {
      // An unreadable or invalid plist adds nothing.
    }
  }
  return brains;
}
