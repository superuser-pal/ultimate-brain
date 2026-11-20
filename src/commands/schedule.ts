import { execFile } from "node:child_process";
import { access, constants, lstat, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type { Command, CommandContext, RunEnvironment, SchedulerProcess, Warning } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { workTreeTop } from "../lib/repos.ts";
import {
  AGENTS, DAYS, DAY_ORDER, JOBS, JOB_NAMES, entryJson, entryMatches, entryOfJson, entryOfText, labelFor, launchAgentsDir, localAppData,
  localEntries, rawPlatform, platformOf, scheduleSetting, slotOf, storedSlot, windowsTasksDir, xml,
  type Agent, type Day, type Entry, type Job, type ScheduleObject, type Slot,
} from "../lib/schedule.ts";
import { describeErrors, loadSchemas } from "../lib/schemas.ts";
import { weeklySettings } from "../lib/weekly-state.ts";

/** spec/cli.md §5.21 `brain schedule` (decisions 0051, 0110 §7 to §9). */

const SYSTEM_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
const NOT_SET = 'The schedule isn\'t in the brain yet: say "schedule my brain" to choose its times.';
const NO_CEILING = "Codex has no spend ceiling for a run: the weekly review stops at its own time and judgment budget (settings.weekly).";

export const scheduleInstallCommand: Command = {
  name: "schedule install",
  usage: "brain schedule install [<job>] [--at <HH:MM>[,<HH:MM>…]] [--days <day>[,<day>…]] [--agent claude|codex] [--model <id>] [--max-budget-usd <n>] [--dry-run] [--json]",
  summary: "Keep a job's slot in settings.schedule and install this computer's entry: a launchd agent on macOS, a Task Scheduler task on Windows, a printed cron line elsewhere. With no job, install every slot the brain holds.",
  options: { at: "string", model: "string", agent: "string", days: "string", "max-budget-usd": "string", "dry-run": "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const { args, brain } = context;
    const root = brain!.root;
    const env = envOf(context);
    const dryRun = args.options["dry-run"] === true;
    const setting = scheduleSetting(brain!.config);
    const current = typeof setting === "object" ? setting : null;
    const scheduler = schedulerFor(context, root);

    if (args.positionals[0] === undefined) {
      // A reinstall, or the same schedule on another computer: every slot of the object, nothing else accepted but --dry-run.
      if (["at", "model", "agent", "days", "max-budget-usd"].some((option) => args.options[option] !== undefined)) {
        throw new BrainError("USAGE", "brain schedule install with no job installs the schedule kept in the brain and takes only --dry-run");
      }
      if (current === null) throw new BrainError("SCHEDULE_NOT_SET", NOT_SET);
      const plans: Plan[] = [];
      const absent: Job[] = [];
      for (const job of JOB_NAMES) {
        const slot = slotOf(current, job);
        if (slot === null || slot === "off") absent.push(job);
        else plans.push(await plan(context, job, slot, current.agent, current.model, undefined));
      }
      for (const job of absent) await scheduler.preflight(labelFor(root, job));
      for (const item of plans) await scheduler.preflight(item.label);
      const warnings: Warning[] = [];
      const installed = [];
      for (const item of plans) installed.push(await installEntry(context, scheduler, item, dryRun, current, false, warnings));
      const removed: string[] = [];
      for (const job of absent) {
        const label = labelFor(root, job);
        if (dryRun ? (await scheduler.find(label)) : (await scheduler.remove(label)).removed) removed.push(label);
      }
      return {
        data: { installed, removed, setting: current },
        warnings: dedupe(warnings),
        human: `${installed.map((item) => describe(item, dryRun)).join("")}${removed.map((label) => `${dryRun ? "Would remove" : "Removed"} ${label}\n`).join("")}` || "nothing to install\n",
      };
    }

    const job = readJob(args.positionals[0]);
    const agentOption = args.options.agent as string | undefined;
    if (agentOption !== undefined && !(AGENTS as readonly string[]).includes(agentOption)) throw new BrainError("USAGE", "--agent is claude or codex");
    const agent = (agentOption ?? current?.agent ?? "claude") as Agent;
    const modelOption = args.options.model as string | undefined;
    if (current !== null && agent !== current.agent && modelOption === undefined) {
      throw new BrainError("USAGE", `--agent ${agent} changes the agent of every job: give --model too, a full ${agent} model id`);
    }
    const model = modelOption ?? (current !== null && agent === current.agent ? current.model : undefined);
    readModel(agent, model);

    const budgetOption = args.options["max-budget-usd"] as string | undefined;
    if (budgetOption !== undefined) {
      if (job !== "weekly-review") throw new BrainError("USAGE", "--max-budget-usd is for the weekly-review job only");
      if (agent === "codex") throw new BrainError("USAGE", "--max-budget-usd is for Claude Code only: codex exec has no spend ceiling");
      if (!(/^\d+(\.\d+)?$/.test(budgetOption) && Number(budgetOption) > 0)) throw new BrainError("USAGE", "--max-budget-usd needs a positive number, e.g. 3");
    }

    // The slot: --at and --days, else the stored slot (from a string value, this computer's entry), else the job's default (§5.21).
    const entries = await localEntries(root, env, home(context));
    const stored = current === null ? entrySlot(entries, job) : slotOf(current, job);
    const base: Slot = stored !== null && stored !== "off" ? stored : { at: [...JOBS[job].fallback.at], days: JOBS[job].fallback.days === null ? null : [...JOBS[job].fallback.days] as Day[] };
    const atOption = args.options.at as string | undefined;
    const daysOption = args.options.days as string | undefined;
    const slot: Slot = {
      at: atOption === undefined ? base.at : readTimes(atOption),
      days: daysOption !== undefined ? readDays(daysOption) : atOption === undefined ? base.days : null,
    };

    const main = await plan(context, job, slot, agent, model!, budgetOption === undefined ? undefined : Number(budgetOption));
    // The object written: runner, agent, model, this job's slot; the other job's slot kept, or from a string value this computer's entry, or off.
    const next: ScheduleObject = { runner: "system", agent, model: model! };
    const others: Plan[] = [];
    for (const other of JOB_NAMES) {
      if (other === job) {
        next[JOBS[job].key] = storedSlot(slot);
        continue;
      }
      const otherSlot = current !== null ? slotOf(current, other) : entrySlot(entries, other) ?? "off";
      if (otherSlot !== null) next[JOBS[other].key] = otherSlot === "off" ? "off" : storedSlot(otherSlot);
      // A changed agent or model reinstalls every other job's entry with it (§5.21).
      if (current !== null && (agent !== current.agent || model !== current.model) && otherSlot !== null && otherSlot !== "off") {
        others.push(await plan(context, other, otherSlot, agent, model!, undefined));
      }
    }
    const ordered = orderObject(next);
    validate(brain!.config, ordered);
    for (const item of [main, ...others]) await scheduler.preflight(item.label);

    if (!dryRun) await writeSchedule(root, brain!.config, ordered);
    const warnings: Warning[] = [];
    const result = await installEntry(context, scheduler, main, dryRun, ordered, !dryRun, warnings);
    const reinstalled: string[] = [];
    for (const item of others) {
      await installEntry(context, scheduler, item, dryRun, ordered, !dryRun, warnings);
      reinstalled.push(item.label);
    }
    return { data: { ...result, reinstalled }, warnings: dedupe(warnings), human: describe(result, dryRun) + (result.cron === null ? "" : `${result.cron.join("\n")}\n`) };
  },
};

export const scheduleListCommand: Command = {
  name: "schedule list",
  usage: "brain schedule list [--json]",
  summary: "List the schedule kept in the brain and this brain's entries on this computer.",
  options: {},
  maxPositionals: 0,
  needsBrain: true,
  async run(context) {
    const setting = scheduleSetting(context.brain!.config);
    const scheduler = schedulerFor(context, context.brain!.root);
    if (scheduler.platform === "other") return { data: { setting, schedules: [] }, warnings: [notManaged()], human: "cron lines are yours: crontab -l\n" };
    const schedules = (await scheduler.list())
      .map(({ label, path, entry }) => ({ job: entry.job, label, path, times: entry.times, days: entry.days, agent: entry.agent, model: entry.model, prompt: entry.prompt, matches: entryMatches(entry, setting) }))
      .sort((a, b) => a.job.localeCompare(b.job));
    return {
      data: { setting, schedules },
      human: schedules.map((item) => `${item.job} at ${item.times.join(", ")}${item.days === null ? "" : ` on ${item.days.join(", ")}`} (${item.agent} ${item.model})${item.matches === false ? ", not as the brain records it" : ""}\n`).join("") || "nothing scheduled on this computer\n",
    };
  },
};

export const scheduleRemoveCommand: Command = {
  name: "schedule remove",
  usage: "brain schedule remove <job> | --here [--json]",
  summary: "Remove one job's entry and keep its slot off in settings.schedule, or, with --here, every entry of this brain on this computer.",
  options: { here: "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const root = context.brain!.root;
    const here = context.args.options.here === true;
    const positional = context.args.positionals[0];
    if (here === (positional !== undefined)) throw new BrainError("USAGE", `remove takes a job (${JOB_NAMES.join(" or ")}) or --here`);
    const setting = scheduleSetting(context.brain!.config);
    const scheduler = schedulerFor(context, root);

    if (here) {
      // A computer that should no longer run the brain: the setting stays as it is.
      const labels = JOB_NAMES.map((job) => labelFor(root, job));
      for (const label of labels) await scheduler.preflight(label);
      const removed: string[] = [];
      for (const label of labels) if ((await scheduler.remove(label)).removed) removed.push(label);
      return {
        data: { removed, setting },
        warnings: scheduler.platform === "other" ? [notManaged()] : [],
        human: removed.length === 0 ? "nothing scheduled on this computer\n" : removed.map((label) => `Removed ${label}\n`).join(""),
      };
    }

    const job = readJob(positional);
    const label = labelFor(root, job);
    await scheduler.preflight(label);
    let next = setting;
    if (setting !== null && typeof setting === "object") {
      // The job's slot is written off; the object stays, with both off when nothing is left (the user declined, setup.md §7).
      const object: ScheduleObject = { ...setting, [JOBS[job].key]: "off" };
      next = orderObject(object);
      validate(context.brain!.config, next);
      await writeSchedule(root, context.brain!.config, next);
    }
    const { path, removed } = await scheduler.remove(label);
    return {
      data: { job, label, path, removed, setting: next },
      warnings: scheduler.platform === "other" ? [notManaged()] : [],
      human: scheduler.platform === "other" ? "cron lines are yours: crontab -e\n" : removed ? `Removed the ${job} schedule\n` : `${job} was not scheduled on this computer\n`,
    };
  },
};

// --- one job's entry ---------------------------------------------------------------------------------

interface Plan {
  job: Job;
  label: string;
  entry: Entry;
  command: string[];
  /** The run's PATH folders, without the platform's own. */
  path: string[];
  warnings: Warning[];
}

/** Everything one job's entry needs, checked before anything is written: the skill, the agent on PATH, Git for Codex, the command. */
async function plan(context: CommandContext, job: Job, slot: Slot, agent: Agent, model: string, budgetOption: number | undefined): Promise<Plan> {
  const root = context.brain!.root;
  const env = envOf(context);
  if (!(await exists(join(root, ".claude", "skills", JOBS[job].skill, "SKILL.md")))) {
    throw new BrainError("SKILL_MISSING", `This brain has no ${JOBS[job].skill} skill for the ${job} job; run brain upgrade with a version that ships it`);
  }
  const windows = platformOf(env) === "win32";
  const executable = await which(windows ? [`${agent}.exe`] : [agent], env.PATH);
  if (executable === null) {
    throw new BrainError("AGENT_NOT_FOUND", `No ${agent === "claude" ? "claude" : "codex"} on PATH: install ${agent === "claude" ? "Claude Code" : "Codex"}, then schedule again`);
  }
  if (agent === "codex" && (await workTreeTop(root)) === null) {
    throw new BrainError("BRAIN_NOT_GIT", `${root} is not a Git working tree, and codex exec runs only inside one`);
  }
  const brainBin = await which(windows ? ["brain.cmd", "brain.exe", "brain"] : ["brain"], env.PATH);
  const prompt = JOBS[job].prompt;
  const warnings: Warning[] = [];
  let command: string[];
  if (agent === "claude") {
    const budget = job === "weekly-review" ? budgetOption ?? weeklySettings(context.brain!.config).max_usd : undefined;
    command = [executable, "-p", prompt, "--model", model, ...(budget === undefined ? [] : ["--max-budget-usd", String(budget)])];
    // claude -p ignores an untrusted folder's allow rules, for every job (§5.21 Folder trust).
    warnings.push({ code: "FOLDER_TRUST", message: `Open Claude Code in ${root} once and accept the trust dialog, or the scheduled run can't use the brain's allow rules.` });
  } else {
    command = [executable, "exec", "--model", model, "--sandbox", "workspace-write", "-c", "approval_policy=never", "-c", "sandbox_workspace_write.network_access=true", prompt];
    if (job === "weekly-review") warnings.push({ code: "NO_SPEND_CEILING", message: NO_CEILING });
  }
  const path = unique([dirname(executable), dirname(process.execPath), ...(brainBin === null ? [] : [dirname(brainBin)])]);
  const entry: Entry = { brain: root, job, times: slot.at, days: slot.days, agent, model, prompt };
  return { job, label: labelFor(root, job), entry, command, path, warnings };
}

async function installEntry(context: CommandContext, scheduler: Scheduler, item: Plan, dryRun: boolean, setting: ScheduleObject, settingWritten: boolean, warnings: Warning[]) {
  warnings.push(...item.warnings);
  const installed = await scheduler.install(item, dryRun, context.now);
  warnings.push(...installed.warnings);
  const { entry } = item;
  return {
    job: item.job, label: item.label, platform: rawPlatform(envOf(context)), path: installed.path,
    times: entry.times, days: entry.days, agent: entry.agent, model: entry.model, prompt: entry.prompt, command: item.command,
    setting, setting_written: settingWritten, written: installed.written, replaced: installed.replaced, loaded: installed.loaded, cron: installed.cron, dry_run: dryRun,
  };
}

function describe(result: { job: string; times: string[]; days: string[] | null }, dryRun: boolean): string {
  return `${dryRun ? "Would schedule" : "Scheduled"} ${result.job} at ${result.times.join(", ")}${result.days === null ? "" : ` on ${result.days.join(", ")}`}\n`;
}

// --- the schedulers ----------------------------------------------------------------------------------

interface Installed {
  path: string | null;
  written: boolean;
  replaced: boolean;
  loaded: boolean;
  cron: string[] | null;
  warnings: Warning[];
}

interface Scheduler {
  platform: "darwin" | "win32" | "other";
  /** Refuses an entry, copy or log path inside the brain or through a link, before anything is written (OUTSIDE_ROOT). */
  preflight(label: string): Promise<void>;
  install(plan: Plan, dryRun: boolean, now: Date): Promise<Installed>;
  find(label: string): Promise<boolean>;
  remove(label: string): Promise<{ path: string | null; removed: boolean }>;
  list(): Promise<Array<{ label: string; path: string; entry: Entry }>>;
}

function schedulerFor(context: CommandContext, root: string): Scheduler {
  const env = envOf(context);
  switch (platformOf(env)) {
    case "darwin": return launchd(context, root);
    case "win32": return taskScheduler(context, root);
    default: return cron(root);
  }
}

/** macOS: a launchd agent; with UB_LAUNCH_AGENTS_DIR set (tests), launchctl is never called and no log folder is made. */
function launchd(context: CommandContext, root: string): Scheduler {
  const env = envOf(context);
  const agents = launchAgentsDir(env, home(context));
  const logs = join(home(context), "Library", "Logs", "ultimate-brain");
  const testing = env.UB_LAUNCH_AGENTS_DIR !== undefined;
  const runner = processOf(context.environment);
  const uid = `gui/${process.getuid?.() ?? 0}`;
  const fileOf = (label: string) => join(agents, `${label}.plist`);
  return {
    platform: "darwin",
    async preflight(label) {
      await refuseInside(root, agents);
      await refuseInside(root, logs);
      await refuseLink(fileOf(label));
    },
    async install(item, dryRun) {
      const file = fileOf(item.label);
      const replaced = await exists(file);
      const warnings: Warning[] = [];
      let loaded = false;
      if (!dryRun) {
        await mkdir(agents, { recursive: true });
        if (!testing) await mkdir(logs, { recursive: true });
        const path = unique([...item.path, ...SYSTEM_PATH.split(":")]).join(":");
        await writeFile(file, plist(item, path, join(logs, `${item.label}.log`)));
        if (!testing) {
          await runner.launchctl(["bootout", `${uid}/${item.label}`]).catch(() => undefined);
          try {
            await runner.launchctl(["bootstrap", uid, file]);
            loaded = true;
          } catch (error) {
            warnings.push({ code: "SCHEDULE_NOT_LOADED", message: `launchctl bootstrap failed: ${messageOf(error)}` });
          }
        }
      }
      return { path: file, written: !dryRun, replaced, loaded, cron: null, warnings };
    },
    find: (label) => exists(fileOf(label)),
    async remove(label) {
      const file = fileOf(label);
      if (!(await exists(file))) return { path: file, removed: false };
      if (!testing) await runner.launchctl(["bootout", `${uid}/${label}`]).catch(() => undefined);
      await rm(file);
      return { path: file, removed: true };
    },
    list: () => localEntries(root, env, home(context)),
  };
}

/**
 * Windows: a Task Scheduler task registered through PowerShell's ScheduledTasks module, and its local copy for `status`. With
 * UB_WINDOWS_TASKS_DIR set (tests), PowerShell is never called and the copy is the entry.
 */
function taskScheduler(context: CommandContext, root: string): Scheduler {
  const env = envOf(context);
  const tasks = windowsTasksDir(env, home(context));
  const logs = join(localAppData(env, home(context)), "ultimate-brain", "logs");
  const testing = env.UB_WINDOWS_TASKS_DIR !== undefined;
  const runner = processOf(context.environment);
  const copyOf = (label: string) => join(tasks, `${label}.xml`);
  return {
    platform: "win32",
    async preflight(label) {
      await refuseInside(root, tasks);
      await refuseInside(root, logs);
      await refuseLink(copyOf(label));
    },
    async install(item, dryRun, now) {
      const copy = copyOf(item.label);
      const task = taskXml(item, env, join(logs, `${item.label}.log`), now);
      if (dryRun) return { path: copy, written: false, replaced: await exists(copy), loaded: false, cron: null, warnings: [] };
      if (testing) {
        const replaced = await exists(copy);
        await mkdir(tasks, { recursive: true });
        await writeFile(copy, task);
        return { path: copy, written: true, replaced, loaded: false, cron: null, warnings: [] };
      }
      await mkdir(logs, { recursive: true });
      let output: string;
      try {
        output = await runner.powershell([
          "$ErrorActionPreference = 'Stop'",
          `$existed = $null -ne (Get-ScheduledTask -TaskPath '\\' -TaskName ${psQuote(item.label)} -ErrorAction SilentlyContinue)`,
          `Register-ScheduledTask -TaskName ${psQuote(item.label)} -Xml ${psQuote(task)} -Force | Out-Null`,
          "if ($existed) { 'replaced' } else { 'created' }",
        ].join("\n"));
      } catch (error) {
        return { path: copy, written: false, replaced: false, loaded: false, cron: null, warnings: [{ code: "SCHEDULE_NOT_LOADED", message: `Register-ScheduledTask failed: ${messageOf(error)}` }] };
      }
      await mkdir(tasks, { recursive: true });
      await writeFile(copy, task);
      return { path: copy, written: true, replaced: output.trim().split(/\r?\n/).includes("replaced"), loaded: true, cron: null, warnings: [] };
    },
    find: (label) => exists(copyOf(label)),
    async remove(label) {
      const copy = copyOf(label);
      const hadCopy = await exists(copy);
      let unregistered = false;
      if (!testing) {
        const output = await runner.powershell([
          `$task = Get-ScheduledTask -TaskPath '\\' -TaskName ${psQuote(label)} -ErrorAction SilentlyContinue`,
          `if ($null -ne $task) { Unregister-ScheduledTask -TaskPath '\\' -TaskName ${psQuote(label)} -Confirm:$false; 'removed' }`,
        ].join("\n")).catch(() => "");
        unregistered = output.trim().split(/\r?\n/).includes("removed");
      }
      if (hadCopy) await rm(copy);
      return { path: copy, removed: hadCopy || unregistered };
    },
    async list() {
      if (testing) return localEntries(root, env, home(context));
      const output = await runner.powershell([
        `$tasks = @(Get-ScheduledTask -TaskPath '\\' -TaskName ${psQuote(`${labelFor(root, "")}*`)} -ErrorAction SilentlyContinue)`,
        "ConvertTo-Json -Compress -InputObject @($tasks | ForEach-Object { [pscustomobject]@{ name = $_.TaskName; description = $_.Description } })",
      ].join("\n")).catch(() => "[]");
      let parsed: unknown;
      try {
        parsed = JSON.parse(output.trim() || "[]");
      } catch {
        parsed = [];
      }
      const out = [];
      for (const task of Array.isArray(parsed) ? parsed : [parsed]) {
        if (task === null || typeof task !== "object") continue;
        const { name, description } = task as { name?: unknown; description?: unknown };
        if (typeof name !== "string" || typeof description !== "string" || !description.startsWith("ultimate-brain:")) continue;
        const entry = entryOfJson(description.slice("ultimate-brain:".length));
        if (entry !== null) out.push({ label: name, path: copyOf(name), entry });
      }
      return out;
    },
  };
}

/** Elsewhere: no entry is written; `install` returns cron lines for the user (0051). */
function cron(root: string): Scheduler {
  return {
    platform: "other",
    async preflight() {},
    async install(item) {
      const log = `$HOME/.ultimate-brain/logs/${item.label}.log`;
      const path = unique([...item.path, ...SYSTEM_PATH.split(":")]).join(":");
      const lines = item.entry.times.map((time) => {
        const [hour, minute] = time.split(":").map(Number);
        const dow = item.entry.days === null ? "*" : item.entry.days.map((day) => DAYS.indexOf(day)).join(",");
        return `${minute} ${hour} * * ${dow} mkdir -p "$HOME/.ultimate-brain/logs" && cd ${shellQuote(root)} && PATH=${shellQuote(path)} ${item.command.map(shellQuote).join(" ")} >> "${log}" 2>&1`;
      });
      return { path: null, written: false, replaced: false, loaded: false, cron: lines, warnings: [] };
    },
    find: async () => false,
    remove: async () => ({ path: null, removed: false }),
    list: async () => [],
  };
}

// --- the entries' files --------------------------------------------------------------------------------

function plist(item: Plan, path: string, log: string): string {
  const { entry } = item;
  const intervals = entry.times.flatMap((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return entry.days === null ? [{ Hour: hour!, Minute: minute! }] : entry.days.map((day) => ({ Hour: hour!, Minute: minute!, Weekday: DAYS.indexOf(day) }));
  });
  const dict = (pairs: ReadonlyArray<readonly [string, string]>, indent: string) =>
    `${indent}<dict>\n${pairs.map(([key, value]) => `${indent}  <key>${xml(key)}</key>\n${indent}  ${value}\n`).join("")}${indent}</dict>`;
  const string = (value: string) => `<string>${xml(value)}</string>`;
  const body = dict([
    ["Label", string(item.label)],
    ["ProgramArguments", `<array>\n${item.command.map((part) => `    ${string(part)}\n`).join("")}  </array>`],
    ["WorkingDirectory", string(entry.brain)],
    ["EnvironmentVariables", `<dict>\n    <key>PATH</key>\n    ${string(path)}\n  </dict>`],
    ["StartCalendarInterval", `<array>\n${intervals.map((interval) => `${dict(Object.entries(interval).map(([key, value]) => [key, `<integer>${value}</integer>`] as const), "    ")}\n`).join("")}  </array>`],
    ["StandardOutPath", string(log)],
    ["StandardErrorPath", string(log)],
    ["RunAtLoad", "<false/>"],
    ["ultimate-brain", string(entryJson(entry))],
  ], "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${body}\n</plist>\n`;
}

const WINDOWS_DAYS: Record<Day, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

/** The task XML of §5.21 "On Windows": logged on only, wake to run, start when available, on battery too, two hours at most. */
function taskXml(item: Plan, env: NodeJS.ProcessEnv, log: string, now: Date): string {
  const { entry } = item;
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const schedule = entry.days === null
    ? "      <ScheduleByDay>\n        <DaysInterval>1</DaysInterval>\n      </ScheduleByDay>\n"
    : `      <ScheduleByWeek>\n        <DaysOfWeek>\n${entry.days.map((day) => `          <${WINDOWS_DAYS[day]} />\n`).join("")}        </DaysOfWeek>\n        <WeeksInterval>1</WeeksInterval>\n      </ScheduleByWeek>\n`;
  const triggers = entry.times.map((time) => `    <CalendarTrigger>\n      <StartBoundary>${date}T${time}:00</StartBoundary>\n      <Enabled>true</Enabled>\n${schedule}    </CalendarTrigger>\n`).join("");
  const path = `${item.path.join(";")};%PATH%`;
  const run = `"${item.command[0]}" ${item.command.slice(1).map((part) => `"${part}"`).join(" ")}`;
  const args = `/d /s /c "set "PATH=${path}" && ${run} >> "${log}" 2>&1"`;
  return [
    '<?xml version="1.0" encoding="UTF-16"?>',
    '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
    "  <RegistrationInfo>",
    `    <Description>ultimate-brain:${xml(entryJson(entry))}</Description>`,
    "  </RegistrationInfo>",
    "  <Triggers>",
    `${triggers}  </Triggers>`,
    "  <Principals>",
    '    <Principal id="Author">',
    `      <UserId>${xml(userId(env))}</UserId>`,
    "      <LogonType>InteractiveToken</LogonType>",
    "      <RunLevel>LeastPrivilege</RunLevel>",
    "    </Principal>",
    "  </Principals>",
    "  <Settings>",
    "    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>",
    "    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
    "    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>",
    "    <StartWhenAvailable>true</StartWhenAvailable>",
    "    <Enabled>true</Enabled>",
    "    <WakeToRun>true</WakeToRun>",
    "    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>",
    "  </Settings>",
    '  <Actions Context="Author">',
    "    <Exec>",
    "      <Command>%SystemRoot%\\System32\\cmd.exe</Command>",
    `      <Arguments>${xml(args)}</Arguments>`,
    `      <WorkingDirectory>${xml(entry.brain)}</WorkingDirectory>`,
    "    </Exec>",
    "  </Actions>",
    "</Task>",
    "",
  ].join("\n");
}

/** `<USERDOMAIN>\<USERNAME>`, the user running `install`. */
function userId(env: NodeJS.ProcessEnv): string {
  const name = env.USERNAME ?? userInfo().username;
  return env.USERDOMAIN === undefined || env.USERDOMAIN === "" ? name : `${env.USERDOMAIN}\\${name}`;
}

// --- brain.json ----------------------------------------------------------------------------------------

/** The object in the contract's key order (schema §12). */
function orderObject(value: ScheduleObject): ScheduleObject {
  const out: ScheduleObject = { runner: value.runner ?? "system", agent: value.agent, model: value.model };
  if (value.catch_up !== undefined) out.catch_up = value.catch_up;
  if (value.weekly_review !== undefined) out.weekly_review = value.weekly_review;
  return out;
}

function withSchedule(config: Record<string, unknown>, schedule: ScheduleObject): Record<string, unknown> {
  const settings = typeof config.settings === "object" && config.settings !== null ? config.settings as Record<string, unknown> : {};
  return { ...config, settings: { ...settings, schedule } };
}

/** The object written must pass brain.schema.json, as `config set` checks (BRAIN_CONFIG_INVALID). */
function validate(config: Record<string, unknown>, schedule: ScheduleObject): void {
  const schemas = loadSchemas();
  if (!schemas.brain(withSchedule(config, schedule))) {
    throw new BrainError("BRAIN_CONFIG_INVALID", `settings.schedule would make brain.json invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
  }
}

async function writeSchedule(root: string, config: Record<string, unknown>, schedule: ScheduleObject): Promise<void> {
  await atomicWriteFile(root, "brain.json", `${JSON.stringify(withSchedule(config, schedule), null, 2)}\n`);
}

/** A job's slot read from this computer's entry (a string value's other job, schema §12); null without one. */
function entrySlot(entries: ReadonlyArray<{ entry: Entry }>, job: Job): Slot | null {
  const found = entries.find((file) => file.entry.job === job)?.entry;
  return found === undefined ? null : { at: found.times, days: found.days };
}

// --- options ---------------------------------------------------------------------------------------------

function readJob(value: string | undefined): Job {
  if (value === undefined || !Object.hasOwn(JOBS, value)) throw new BrainError("USAGE", `A job is needed: ${JOB_NAMES.join(" or ")}`);
  return value as Job;
}

function readModel(agent: Agent, model: string | undefined): void {
  if (model === undefined) throw new BrainError("USAGE", `--model needs a full ${agent === "claude" ? "Claude model id, e.g. claude-sonnet-5-5" : "Codex model name"}: a schedule pins its model (decision 0051)`);
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(model) || (agent === "claude" && !/^claude-[a-z0-9][a-z0-9.-]*$/.test(model))) {
    throw new BrainError("USAGE", `--model needs a full ${agent === "claude" ? "Claude model id, e.g. claude-sonnet-5-5, never an alias like sonnet" : "Codex model name"}: a schedule pins its model (decision 0051)`);
  }
}

function readTimes(value: string): string[] {
  if (value.trim() === "") throw new BrainError("USAGE", "--at needs one or more times, e.g. 07:00,13:00");
  const times = value.split(",").map((part) => part.trim());
  for (const time of times) {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (match === null || Number(match[1]) > 23 || Number(match[2]) > 59) throw new BrainError("USAGE", `Not a time from 00:00 to 23:59: ${time}`);
  }
  return unique(times).sort();
}

function readDays(value: string): Day[] {
  const days = value.split(",").map((part) => part.trim().toLowerCase());
  for (const day of days) if (!DAYS.includes(day as Day)) throw new BrainError("USAGE", `Unknown day: ${day} (use ${DAY_ORDER.join(", ")})`);
  return DAY_ORDER.filter((day) => days.includes(day));
}

// --- helpers ---------------------------------------------------------------------------------------------

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const psQuote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const unique = <T>(values: readonly T[]) => [...new Set(values)];
const pad = (value: number) => String(value).padStart(2, "0");
const notManaged = (): Warning => ({ code: "SCHEDULE_NOT_MANAGED", message: "cron lines are yours: crontab -l" });
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error)).trim();

function dedupe(warnings: readonly Warning[]): Warning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}\n${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function envOf(context: CommandContext): NodeJS.ProcessEnv {
  return context.environment.env ?? process.env;
}

function home(context: CommandContext): string {
  return context.environment.homeDirectory ?? homedir();
}

/** The processes a schedule starts: launchctl and PowerShell, injected by tests through the run environment. */
function processOf(environment: RunEnvironment): SchedulerProcess {
  if (environment.scheduler !== undefined) return environment.scheduler;
  const env = environment.env ?? process.env;
  const run = promisify(execFile);
  return {
    async launchctl(args) {
      await run((await which(["launchctl"], env.PATH)) ?? "/bin/launchctl", [...args]);
    },
    async powershell(script) {
      // -EncodedCommand (UTF-16LE, base64) keeps the task XML's quotes intact on Windows' command line.
      const encoded = Buffer.from(script, "utf16le").toString("base64");
      const exe = join(env.SystemRoot ?? env.SYSTEMROOT ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
      try {
        return (await run(exe, ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { windowsHide: true })).stdout;
      } catch (error) {
        const stderr = (error as { stderr?: unknown }).stderr;
        throw new Error(typeof stderr === "string" && stderr.trim() !== "" ? stderr.trim() : messageOf(error));
      }
    },
  };
}

/** The first of `names` found in a folder of PATH, made absolute: a scheduler runs from elsewhere. */
async function which(names: readonly string[], path: string | undefined): Promise<string | null> {
  for (const dir of (path ?? "").split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = resolve(dir, name);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Not here; try the next.
      }
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

/** A schedule writes nothing in the brain but brain.json (spec/cli.md §5.21): refuse a folder that resolves inside it, links followed. */
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
