import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, constants, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type { Command, CommandContext, Warning } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { slugify } from "../lib/paths.ts";

/** The jobs a schedule can run, each with its fixed prompt and the skill it needs (spec/cli.md §5.21, decision 0051). */
const JOBS = {
  "catch-up": { prompt: "catch up unattended", skill: "brain-catch-up" },
  reflect: { prompt: "tidy the brain unattended", skill: "brain-reflect" },
} as const;
type Job = keyof typeof JOBS;

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Day = (typeof DAYS)[number];
const DAY_ORDER: readonly Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";

interface Entry {
  brain: string;
  job: Job;
  times: string[];
  days: Day[] | null;
  model: string;
  prompt: string;
}

export const scheduleInstallCommand: Command = {
  name: "schedule install",
  usage: "brain schedule install <job> --at <HH:MM>[,<HH:MM>…] --model <id> [--days <day>[,<day>…]] [--dry-run] [--json]",
  summary: "Schedule a skill to run unattended through claude -p: a launchd agent on macOS, a printed cron line elsewhere.",
  options: { at: "string", model: "string", days: "string", "dry-run": "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const { args, brain } = context;
    const job = readJob(args.positionals[0]);
    const times = readTimes(args.options.at as string | undefined);
    const days = readDays(args.options.days as string | undefined);
    const model = args.options.model as string | undefined;
    if (model === undefined || !/^claude-[a-z0-9][a-z0-9.-]*$/.test(model)) {
      throw new BrainError("USAGE", "--model needs a full Claude model id, e.g. claude-sonnet-5-5: a schedule pins its model (decision 0051)");
    }
    const root = brain!.root;
    if (!(await exists(join(root, ".claude", "skills", JOBS[job].skill, "SKILL.md")))) {
      throw new BrainError("SKILL_MISSING", `This brain has no ${JOBS[job].skill} skill for the ${job} job; run brain upgrade with a version that ships it`);
    }
    const env = context.environment.env ?? process.env;
    const claude = await which("claude", env.PATH);
    if (claude === null) throw new BrainError("CLAUDE_NOT_FOUND", "No claude on PATH: install Claude Code, then schedule again");
    const brainBin = await which("brain", env.PATH);
    const path = unique([dirname(claude), dirname(process.execPath), ...(brainBin === null ? [] : [dirname(brainBin)]), ...SYSTEM_PATH.split(":")]).join(":");
    const entry: Entry = { brain: root, job, times, days, model, prompt: JOBS[job].prompt };
    const command = [claude, "-p", entry.prompt, "--model", model];
    const label = labelFor(root, job);
    const dryRun = args.options["dry-run"] === true;
    const base = { job, label, times, days, model, prompt: entry.prompt, command };

    if (platformOf(env) !== "darwin") {
      const log = `$HOME/.ultimate-brain/logs/${label}.log`;
      const cron = times.map((time) => {
        const [hour, minute] = time.split(":").map(Number);
        const dow = days === null ? "*" : days.map((day) => DAYS.indexOf(day)).join(",");
        return `${minute} ${hour} * * ${dow} mkdir -p "$HOME/.ultimate-brain/logs" && cd ${shellQuote(root)} && PATH=${shellQuote(path)} ${command.map(shellQuote).join(" ")} >> "${log}" 2>&1`;
      });
      return { data: { ...base, platform: platformOf(env), path: null, written: false, replaced: false, loaded: false, cron, dry_run: dryRun }, human: `${cron.join("\n")}\n` };
    }

    const agents = agentsDir(context);
    const file = join(agents, `${label}.plist`);
    const logs = join(home(context), "Library", "Logs", "ultimate-brain");
    await refuseInside(root, agents);
    await refuseInside(root, logs);
    await refuseLink(file);
    const replaced = await exists(file);
    const warnings: Warning[] = [];
    let loaded = false;
    if (!dryRun) {
      await mkdir(agents, { recursive: true });
      if (!testing(env)) await mkdir(logs, { recursive: true });
      await writeFile(file, plist(label, entry, command, path, join(logs, `${label}.log`)));
      if (!testing(env)) {
        await launchctl(env, ["bootout", `gui/${process.getuid?.() ?? 0}/${label}`]).catch(() => undefined);
        try {
          await launchctl(env, ["bootstrap", `gui/${process.getuid?.() ?? 0}`, file]);
          loaded = true;
        } catch (error) {
          warnings.push({ code: "SCHEDULE_NOT_LOADED", message: `launchctl bootstrap failed: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
    }
    return {
      data: { ...base, platform: "darwin", path: file, written: !dryRun, replaced, loaded, cron: null, dry_run: dryRun },
      warnings,
      human: `${dryRun ? "Would schedule" : "Scheduled"} ${job} at ${times.join(", ")}${days === null ? "" : ` on ${days.join(", ")}`}\n`,
    };
  },
};

export const scheduleListCommand: Command = {
  name: "schedule list",
  usage: "brain schedule list [--json]",
  summary: "List this brain's scheduled jobs.",
  options: {},
  maxPositionals: 0,
  needsBrain: true,
  async run(context) {
    const env = context.environment.env ?? process.env;
    if (platformOf(env) !== "darwin") return { data: { schedules: [] }, warnings: [notManaged()], human: "cron lines are yours: crontab -l\n" };
    const agents = agentsDir(context);
    const prefix = labelFor(context.brain!.root, "");
    let files: string[] = [];
    try {
      files = (await readdir(agents)).filter((name) => name.startsWith(prefix) && name.endsWith(".plist")).sort();
    } catch {
      // No LaunchAgents folder: nothing scheduled.
    }
    const schedules = [];
    for (const name of files) {
      const entry = readEntry(await readFile(join(agents, name), "utf8"));
      if (entry === null) continue;
      schedules.push({ job: entry.job, label: name.slice(0, -".plist".length), path: join(agents, name), times: entry.times, days: entry.days, model: entry.model, prompt: entry.prompt });
    }
    schedules.sort((a, b) => a.job.localeCompare(b.job));
    return { data: { schedules }, human: schedules.map((item) => `${item.job} at ${item.times.join(", ")}${item.days === null ? "" : ` on ${item.days.join(", ")}`} (${item.model})\n`).join("") || "nothing scheduled\n" };
  },
};

export const scheduleRemoveCommand: Command = {
  name: "schedule remove",
  usage: "brain schedule remove <job> [--json]",
  summary: "Remove one of this brain's scheduled jobs.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const job = readJob(context.args.positionals[0]);
    const env = context.environment.env ?? process.env;
    const label = labelFor(context.brain!.root, job);
    if (platformOf(env) !== "darwin") return { data: { job, label, path: null, removed: false }, warnings: [notManaged()], human: "cron lines are yours: crontab -e\n" };
    const file = join(agentsDir(context), `${label}.plist`);
    await refuseInside(context.brain!.root, dirname(file));
    await refuseLink(file);
    if (!(await exists(file))) return { data: { job, label, path: file, removed: false }, human: `${job} was not scheduled\n` };
    if (!testing(env)) await launchctl(env, ["bootout", `gui/${process.getuid?.() ?? 0}/${label}`]).catch(() => undefined);
    await rm(file);
    return { data: { job, label, path: file, removed: true }, human: `Removed the ${job} schedule\n` };
  },
};

function readJob(value: string | undefined): Job {
  if (value === undefined || !Object.hasOwn(JOBS, value)) throw new BrainError("USAGE", `A job is needed: ${Object.keys(JOBS).join(" or ")}`);
  return value as Job;
}

function readTimes(value: string | undefined): string[] {
  if (value === undefined || value.trim() === "") throw new BrainError("USAGE", "--at needs one or more times, e.g. 07:00,13:00");
  const times = value.split(",").map((part) => part.trim());
  for (const time of times) {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (match === null || Number(match[1]) > 23 || Number(match[2]) > 59) throw new BrainError("USAGE", `Not a time from 00:00 to 23:59: ${time}`);
  }
  return unique(times).sort();
}

function readDays(value: string | undefined): Day[] | null {
  if (value === undefined) return null;
  const days = value.split(",").map((part) => part.trim().toLowerCase());
  for (const day of days) if (!DAYS.includes(day as Day)) throw new BrainError("USAGE", `Unknown day: ${day} (use ${DAY_ORDER.join(", ")})`);
  return DAY_ORDER.filter((day) => days.includes(day));
}

/** `eu.ultimate-brain.<folder>-<hash>.<job>`: one entry per brain and job (spec/cli.md §5.21). */
function labelFor(root: string, job: string): string {
  const hash = createHash("sha256").update(root).digest("hex").slice(0, 8);
  return `eu.ultimate-brain.${slugify(basename(root)) || "brain"}-${hash}.${job}`;
}

function plist(label: string, entry: Entry, command: readonly string[], path: string, log: string): string {
  const intervals = entry.times.flatMap((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return entry.days === null ? [{ Hour: hour!, Minute: minute! }] : entry.days.map((day) => ({ Hour: hour!, Minute: minute!, Weekday: DAYS.indexOf(day) }));
  });
  const dict = (pairs: ReadonlyArray<readonly [string, string]>, indent: string) =>
    `${indent}<dict>\n${pairs.map(([key, value]) => `${indent}  <key>${xml(key)}</key>\n${indent}  ${value}\n`).join("")}${indent}</dict>`;
  const string = (value: string) => `<string>${xml(value)}</string>`;
  const body = dict([
    ["Label", string(label)],
    ["ProgramArguments", `<array>\n${command.map((part) => `    ${string(part)}\n`).join("")}  </array>`],
    ["WorkingDirectory", string(entry.brain)],
    ["EnvironmentVariables", `<dict>\n    <key>PATH</key>\n    ${string(path)}\n  </dict>`],
    ["StartCalendarInterval", `<array>\n${intervals.map((interval) => `${dict(Object.entries(interval).map(([key, value]) => [key, `<integer>${value}</integer>`] as const), "    ")}\n`).join("")}  </array>`],
    ["StandardOutPath", string(log)],
    ["StandardErrorPath", string(log)],
    ["RunAtLoad", "<false/>"],
    ["ultimate-brain", string(JSON.stringify(entry))],
  ], "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${body}\n</plist>\n`;
}

function readEntry(text: string): Entry | null {
  const match = /<key>ultimate-brain<\/key>\s*<string>([^<]*)<\/string>/.exec(text);
  if (match === null) return null;
  try {
    return JSON.parse(unxml(match[1]!)) as Entry;
  } catch {
    return null;
  }
}

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const unxml = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const unique = <T>(values: readonly T[]) => [...new Set(values)];
const notManaged = (): Warning => ({ code: "SCHEDULE_NOT_MANAGED", message: "cron lines are yours: crontab -l" });

function platformOf(env: NodeJS.ProcessEnv): string {
  return env.UB_SCHEDULE_PLATFORM ?? process.platform;
}

/** With UB_LAUNCH_AGENTS_DIR set (tests), launchctl is never called and no log folder is made. */
function testing(env: NodeJS.ProcessEnv): boolean {
  return env.UB_LAUNCH_AGENTS_DIR !== undefined;
}

function home(context: CommandContext): string {
  return context.environment.homeDirectory ?? homedir();
}

function agentsDir(context: CommandContext): string {
  const env = context.environment.env ?? process.env;
  return env.UB_LAUNCH_AGENTS_DIR ?? join(home(context), "Library", "LaunchAgents");
}

async function which(name: string, path: string | undefined): Promise<string | null> {
  for (const dir of (path ?? "").split(delimiter).filter(Boolean)) {
    const candidate = resolve(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not here; try the next folder.
    }
  }
  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function refuseLink(file: string): Promise<void> {
  try {
    if ((await lstat(file)).isSymbolicLink()) throw new BrainError("OUTSIDE_ROOT", `${file} is a symbolic link; remove it, then schedule again`);
  } catch (error) {
    if (error instanceof BrainError) throw error;
  }
}

async function launchctl(env: NodeJS.ProcessEnv, args: readonly string[]): Promise<void> {
  await promisify(execFile)((await which("launchctl", env.PATH)) ?? "/bin/launchctl", [...args]);
}

/** A schedule writes nothing in the brain (spec/cli.md §5.21): refuse a folder that resolves inside it, links followed. */
async function refuseInside(root: string, folder: string): Promise<void> {
  const brain = await realpath(root);
  let existing = resolve(folder);
  const rest: string[] = [];
  for (;;) {
    try {
      existing = await realpath(existing);
      break;
    } catch {
      const parent = dirname(existing);
      if (parent === existing) break;
      rest.unshift(basename(existing));
      existing = parent;
    }
  }
  const target = join(existing, ...rest);
  const inside = relative(brain, target);
  if (!isAbsolute(inside) && inside !== ".." && !inside.startsWith(`..${sep}`)) {
    throw new BrainError("OUTSIDE_ROOT", `${folder} is inside the brain; a schedule writes nothing there`);
  }
}
