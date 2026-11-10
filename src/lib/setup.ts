import { execFile } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { isRecord } from "./input.ts";
import { databaseId, MODULES, missingFor, modulesOf } from "./modules.ts";
import type { Note } from "./notes.ts";
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

export interface SetupStatus {
  checks: SetupChecks;
  recorded: Record<(typeof RECORDED)[number], string | null>;
  template_version: string | null;
  required: { done: number; total: number };
  next: string | null;
  finished: boolean;
}

/**
 * `brain status`'s `setup` block (spec/cli.md §5.2, spec/setup.md §5), computed offline: Git is read only through
 * `git config` and `git remote get-url origin` in the brain folder.
 */
export async function setupStatus(root: string, config: Record<string, unknown>, notes: readonly Note[], home?: string): Promise<SetupStatus> {
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
  const recorded = Object.fromEntries(RECORDED.map((step) => {
    const line = latest.get(step);
    return [step, line !== undefined && (line.pairs.result === "done" || line.pairs.result === "declined") ? line.timestamp : null];
  })) as SetupStatus["recorded"];
  const notionAi = latest.get("prerequisites")?.pairs.notion_ai !== "no";

  const doneOf = (item: string): boolean => item in checks ? checks[item as keyof SetupChecks] : recorded[item as keyof SetupStatus["recorded"]] !== null;
  const items = ORDER.map(([item]) => item).filter((item) => notionAi || !NEEDS_NOTION_AI.has(item));
  const required = [...Object.keys(checks), "notion-mcp", ...(notionAi ? ["minutes-prompt", "brain-assistant"] : [])];

  const notion = isRecord(config.notion) ? config.notion : {};
  return {
    checks,
    recorded,
    template_version: typeof notion.template_version === "string" ? notion.template_version : null,
    required: { done: required.filter(doneOf).length, total: required.length },
    next: items.find((item) => !doneOf(item)) ?? null,
    // A brain connected to Notion before 0.14.0 has no setup line, and may lack the Language and Drop folder lines (setup.md §5).
    finished: lines.some((line) => line.pairs.step === "finished") || (lines.length === 0 && checks.databases && checks.owner_person),
  };
}

/** The first human line, shown only while setup is unfinished (cli.md §5.2); null once it is finished. */
export function setupLine(setup: SetupStatus): string | null {
  if (setup.finished) return null;
  const what = ORDER.find(([item]) => item === setup.next)?.[1];
  return `Setup: ${setup.required.done} of ${setup.required.total} done · ${what === undefined ? "" : `next: ${what} · `}say "set up my brain"`;
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

/** The first `Drop folder:` line's path (`~` expanded, backticks removed) is an existing folder. */
async function dropFolderExists(rules: readonly string[], root: string, home?: string): Promise<boolean> {
  const line = rules.find((candidate) => candidate.startsWith("Drop folder:"));
  if (line === undefined) return false;
  const path = line.slice("Drop folder:".length).replaceAll("`", "").trim();
  if (path === "") return false;
  try {
    return (await stat(resolve(root, expandPath(path, home)))).isDirectory();
  } catch {
    return false;
  }
}
