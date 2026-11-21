import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { isRecord } from "./input.ts";
import { brainLabel } from "./weekly-state.ts";

/**
 * The schedule kept in the brain and this computer's entries for it (spec/schema.md §12, spec/cli.md §5.2, §5.21; decision 0110 §7 to §9).
 * Shared by `brain schedule`, `brain status` and setup's drop-folder scan; everything here reads offline and calls no scheduler.
 */

/** The jobs a schedule can run, each with its fixed prompt, the skill it needs, its slot key and its default slot (cli.md §5.21). */
export const JOBS = {
  "catch-up": { prompt: "catch up unattended", skill: "brain-catch-up", key: "catch_up", fallback: { at: ["07:30"], days: null } },
  "weekly-review": { prompt: "weekly review unattended", skill: "brain-weekly-review", key: "weekly_review", fallback: { at: ["08:00"], days: ["mon"] } },
} as const satisfies Record<string, { prompt: string; skill: string; key: string; fallback: { at: readonly string[]; days: readonly string[] | null } }>;
export type Job = keyof typeof JOBS;
export const JOB_NAMES = Object.keys(JOBS) as Job[];

/** Days in cron's and launchd's numbering (0 = Sunday), and the order a slot writes them in. */
export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_ORDER: readonly Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const AGENTS = ["claude", "codex"] as const;
export type Agent = (typeof AGENTS)[number];

/** A job's times and days; `days` null for every day. */
export interface Slot {
  at: string[];
  days: Day[] | null;
}

/** `settings.schedule` as an object (schema §12). */
export interface ScheduleObject {
  runner?: "system";
  agent: Agent;
  model: string;
  catch_up?: { at: string[]; days?: Day[] } | "off";
  weekly_review?: { at: string[]; days?: Day[] } | "off";
}

/** What every entry holds as a JSON string, read back by `list` and `status` (cli.md §5.21). */
export interface Entry {
  brain: string;
  job: Job;
  times: string[];
  days: Day[] | null;
  agent: Agent;
  model: string;
  prompt: string;
}

export type Platform = "darwin" | "win32" | "other";

/** `settings.schedule` as stored: the object, the string `on`/`off`, or null when absent. */
export function scheduleSetting(config: Record<string, unknown>): ScheduleObject | "on" | "off" | null {
  const settings = isRecord(config.settings) ? config.settings : {};
  const value = settings.schedule;
  if (value === "on" || value === "off") return value;
  return isRecord(value) ? (value as unknown as ScheduleObject) : null;
}

/** A job's slot in the object: the slot, `off`, or null when the object has none for it or the setting isn't an object (cli.md §5.2). */
export function slotOf(setting: ReturnType<typeof scheduleSetting>, job: Job): Slot | "off" | null {
  if (setting === null || typeof setting === "string") return null;
  const value = setting[JOBS[job].key];
  if (value === "off") return "off";
  if (!isRecord(value) || !Array.isArray(value.at)) return null;
  return { at: [...value.at], days: Array.isArray(value.days) ? [...value.days] : null };
}

/** A slot as the object stores it: `days` left out for every day. */
export function storedSlot(slot: Slot): { at: string[]; days?: Day[] } {
  return slot.days === null ? { at: slot.at } : { at: slot.at, days: slot.days };
}

/** Whether an entry's agent, model, times and days equal the object's slot for its job; null when either is missing (cli.md §5.2, §5.21). */
export function entryMatches(entry: Entry | null, setting: ReturnType<typeof scheduleSetting>): boolean | null {
  if (entry === null) return null;
  const slot = slotOf(setting, entry.job);
  if (slot === null || slot === "off" || typeof setting !== "object" || setting === null) return null;
  return entry.agent === setting.agent && entry.model === setting.model && same(entry.times, slot.at) && same(entry.days, slot.days);
}

const same = (a: readonly string[] | null, b: readonly string[] | null) => JSON.stringify(a) === JSON.stringify(b);

/** `darwin`, `win32` or anything else; `UB_SCHEDULE_PLATFORM` overrides `process.platform` (tests). */
export function rawPlatform(env: NodeJS.ProcessEnv): string {
  return env.UB_SCHEDULE_PLATFORM ?? process.platform;
}

export function platformOf(env: NodeJS.ProcessEnv): Platform {
  const platform = rawPlatform(env);
  return platform === "darwin" || platform === "win32" ? platform : "other";
}

/** `eu.ultimate-brain.<folder>-<hash>.<job>`: one entry per brain and job (cli.md §5.21). */
export function labelFor(root: string, job: string): string {
  return `eu.ultimate-brain.${brainLabel(root)}.${job}`;
}

/** `~/Library/LaunchAgents`, or `UB_LAUNCH_AGENTS_DIR` (tests). */
export function launchAgentsDir(env: NodeJS.ProcessEnv, home: string): string {
  return env.UB_LAUNCH_AGENTS_DIR ?? join(home, "Library", "LaunchAgents");
}

/** `%LOCALAPPDATA%`, else `<home>\AppData\Local`. */
export function localAppData(env: NodeJS.ProcessEnv, home: string): string {
  return env.LOCALAPPDATA ?? join(home, "AppData", "Local");
}

/** Where the Windows tasks' local copies are: `%LOCALAPPDATA%\ultimate-brain\tasks`, or `UB_WINDOWS_TASKS_DIR` (tests). */
export function windowsTasksDir(env: NodeJS.ProcessEnv, home: string): string {
  return env.UB_WINDOWS_TASKS_DIR ?? join(localAppData(env, home), "ultimate-brain", "tasks");
}

/** The entry's JSON from a plist's `ultimate-brain` key or a task XML's Description; null when absent or invalid. */
export function entryOfText(text: string): Entry | null {
  const match = /<key>ultimate-brain<\/key>\s*<string>([^<]*)<\/string>/.exec(text) ?? /<Description>ultimate-brain:([^<]*)<\/Description>/.exec(text);
  return match === null ? null : entryOfJson(unxml(match[1]!));
}

/** The JSON string of an entry, normalised: an entry from before 0.17.0 has no `agent` and is read as `claude` (cli.md §5.21). */
export function entryOfJson(json: string): Entry | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.brain !== "string" || typeof value.job !== "string" || !Object.hasOwn(JOBS, value.job)) return null;
  if (!Array.isArray(value.times) || typeof value.model !== "string") return null;
  return {
    brain: value.brain,
    job: value.job as Job,
    times: value.times.map(String),
    days: Array.isArray(value.days) ? (value.days.map(String) as Day[]) : null,
    agent: value.agent === "codex" ? "codex" : "claude",
    model: value.model,
    prompt: typeof value.prompt === "string" ? value.prompt : JOBS[value.job as Job].prompt,
  };
}

/** The entry's JSON string, in the contract's key order. */
export function entryJson(entry: Entry): string {
  const { brain, job, times, days, agent, model, prompt } = entry;
  return JSON.stringify({ brain, job, times, days, agent, model, prompt });
}

export const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const unxml = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");

/** The files of a folder whose name starts with `prefix` and ends with `suffix`, each with its entry; none when the folder can't be read. */
async function entryFiles(folder: string, prefix: string, suffix: string): Promise<Array<{ path: string; label: string; entry: Entry }>> {
  let names: string[];
  try {
    names = (await readdir(folder)).filter((name) => name.startsWith(prefix) && name.endsWith(suffix)).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    try {
      const entry = entryOfText(await readFile(join(folder, name), "utf8"));
      if (entry !== null) out.push({ path: join(folder, name), label: name.slice(0, -suffix.length), entry });
    } catch {
      // An unreadable file adds nothing.
    }
  }
  return out;
}

/** This brain's entries on this computer, read offline: the plists on macOS, the local copies on Windows; none elsewhere (cli.md §5.2). */
export async function localEntries(root: string, env: NodeJS.ProcessEnv, home: string): Promise<Array<{ path: string; label: string; entry: Entry }>> {
  const prefix = labelFor(root, "");
  switch (platformOf(env)) {
    case "darwin": return entryFiles(launchAgentsDir(env, home), prefix, ".plist");
    case "win32": return entryFiles(windowsTasksDir(env, home), prefix, ".xml");
    default: return [];
  }
}

/** The `brain` of every scheduled job this computer knows of, any brain: the plists and the Windows copies (cli.md §5.2 `drop_folder.others`). */
export async function scheduledBrains(env: NodeJS.ProcessEnv, home: string): Promise<string[]> {
  const files = [
    ...await entryFiles(launchAgentsDir(env, home), "eu.ultimate-brain.", ".plist"),
    ...await entryFiles(windowsTasksDir(env, home), "eu.ultimate-brain.", ".xml"),
  ];
  return files.map((file) => file.entry.brain).filter((brain) => brain !== "");
}

/** `brain status`'s `schedule` object (cli.md §5.2), offline. */
export async function scheduleStatus(root: string, config: Record<string, unknown>, env: NodeJS.ProcessEnv, home: string) {
  const setting = scheduleSetting(config);
  const recorded = setting !== null && typeof setting === "object";
  const platform = platformOf(env);
  const entries = await localEntries(root, env, home);
  const jobs = Object.fromEntries(JOB_NAMES.map((job) => {
    const entry = entries.find((file) => file.entry.job === job)?.entry ?? null;
    const slot = slotOf(setting, job);
    return [job, { slot, installed: platform === "other" ? null : entry !== null, matches: platform === "other" ? null : entryMatches(entry, setting) }];
  }));
  return {
    recorded,
    runner: recorded ? setting.runner ?? "system" : null,
    agent: recorded ? setting.agent : null,
    model: recorded ? setting.model : null,
    platform,
    jobs,
  };
}
