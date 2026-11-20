import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { runCli } from "../src/cli.ts";
import type { SchedulerProcess } from "../src/lib/command.ts";
import { labelFor } from "../src/lib/schedule.ts";
import { setInstalledProductRootForTests } from "../src/lib/skills.ts";
import { fixtureCopy, testPackageRoot } from "./helpers.ts";

// CC-369: scheduling in the CLI (decision 0110 §7 to §9; spec/cli.md §5.2, §5.21; spec/schema.md §12). No test touches the real launchd
// or Task Scheduler: the platform is set with UB_SCHEDULE_PLATFORM, the entries' folders with UB_LAUNCH_AGENTS_DIR and UB_WINDOWS_TASKS_DIR,
// and where a test runs the real path, launchctl and PowerShell are injected through the run environment.

const NOW = "2026-11-20T09:00:00Z";
const CLAUDE_MODEL = "claude-sonnet-5-5";
const CODEX_MODEL = "gpt-5.2-codex";
const exec = promisify(execFile);

interface World {
  dir: string;
  home: string;
  bin: string;
  env: NodeJS.ProcessEnv;
}

/** A brain copy and a fake machine: the agents on PATH, a home, and the platform's entry folder under it. */
async function world(context: TestContext, platform: "darwin" | "win32" | "linux", options: { git?: boolean; real?: boolean } = {}): Promise<World> {
  const dir = await fixtureCopy(context);
  const home = await realpath(await mkdtemp(join(tmpdir(), "schedule-home-")));
  context.after(() => rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const bin = join(home, "bin");
  await mkdir(bin);
  for (const name of platform === "win32" ? ["claude.exe", "codex.exe", "brain.cmd"] : ["claude", "codex", "brain"]) {
    await writeFile(join(bin, name), "#!/bin/sh\n");
    await chmod(join(bin, name), 0o755);
  }
  if (options.git === true) await exec("git", ["init", "-q"], { cwd: dir });
  const env: NodeJS.ProcessEnv = { PATH: bin, UB_SCHEDULE_PLATFORM: platform, USERDOMAIN: "WORKPC", USERNAME: "sam", LOCALAPPDATA: join(home, "AppData", "Local") };
  if (options.real !== true) {
    if (platform === "darwin") env.UB_LAUNCH_AGENTS_DIR = join(home, "LaunchAgents");
    if (platform === "win32") env.UB_WINDOWS_TASKS_DIR = join(home, "tasks");
  }
  return { dir: await realpath(dir), home, bin, env };
}

async function cli(w: World, args: string[], scheduler?: SchedulerProcess) {
  setInstalledProductRootForTests(await testPackageRoot());
  const out: string[] = [];
  const code = await runCli([...args, "--brain", w.dir, "--now", NOW, "--json"], { io: { stdout: { write: (value) => out.push(String(value)) }, stderr: { write: () => undefined } }, env: w.env, homeDirectory: w.home, ...(scheduler === undefined ? {} : { scheduler }) });
  return { code, json: JSON.parse(out.join("")) };
}

const schedule = (w: World, args: string[], scheduler?: SchedulerProcess) => cli(w, ["schedule", ...args], scheduler);
const settingOf = async (w: World) => JSON.parse(await readFile(join(w.dir, "brain.json"), "utf8")).settings?.schedule;

async function setSchedule(w: World, value: unknown): Promise<void> {
  const path = join(w.dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  config.settings = { ...config.settings, schedule: value };
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

/** A launchd agent as `brain schedule install` wrote it before 0.17.0: no `agent` in its JSON. */
async function oldPlist(w: World, job: string, times: string[], days: string[] | null, model = CLAUDE_MODEL): Promise<void> {
  const prompt = job === "catch-up" ? "catch up unattended" : "weekly review unattended";
  const json = JSON.stringify({ brain: w.dir, job, times, days, model, prompt }).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  await mkdir(w.env.UB_LAUNCH_AGENTS_DIR!, { recursive: true });
  await writeFile(join(w.env.UB_LAUNCH_AGENTS_DIR!, `${labelFor(w.dir, job)}.plist`), `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n  <key>ultimate-brain</key>\n  <string>${json}</string>\n</dict>\n</plist>\n`);
}

const tag = (xmlText: string, name: string) => [...xmlText.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, "g"))].map((match) => match[1]);
const unxml = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");
const localDate = () => {
  const now = new Date(NOW);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** A recording PowerShell and launchctl: each script or call is kept, and `answer` decides the output or a failure. */
function fakeScheduler(answer: (script: string) => string | Error = () => "created") {
  const scripts: string[] = [];
  const launchctl: string[][] = [];
  const process: SchedulerProcess = {
    async launchctl(args) {
      launchctl.push([...args]);
      if (args[0] === "bootstrap" && answer(args.join(" ")) instanceof Error) throw answer(args.join(" "));
    },
    async powershell(script) {
      scripts.push(script);
      const result = answer(script);
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return { process, scripts, launchctl };
}

// --- settings.schedule and macOS ------------------------------------------------------------------------

test("install keeps the slot in settings.schedule and writes the launchd agent; a second install replaces it, list reads it back with matches, remove writes the slot off", async (context) => {
  const w = await world(context, "darwin");
  const installed = await schedule(w, ["install", "catch-up", "--model", CLAUDE_MODEL]);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  const data = installed.json.data;
  assert.deepEqual([data.times, data.days, data.agent, data.model, data.setting_written, data.written, data.reinstalled], [["07:30"], null, "claude", CLAUDE_MODEL, true, true, []], "the default slot: 07:30 every day (0110 §8)");
  const object = { runner: "system", agent: "claude", model: CLAUDE_MODEL, catch_up: { at: ["07:30"] }, weekly_review: "off" };
  assert.deepEqual(data.setting, object, "a brain with no setting gets the object, the other job off");
  assert.deepEqual(await settingOf(w), object, "written in brain.json");
  const plist = await readFile(data.path, "utf8");
  assert.match(plist, /<key>ultimate-brain<\/key>\s*<string>\{&quot;brain&quot;:[^<]*&quot;agent&quot;:&quot;claude&quot;/, "the entry's JSON carries the agent");
  assert.match(plist, /<key>Hour<\/key>\s*<integer>7<\/integer>\s*<key>Minute<\/key>\s*<integer>30<\/integer>\s*<\/dict>/);

  const weekly = await schedule(w, ["install", "weekly-review"]);
  assert.equal(weekly.code, 0, JSON.stringify(weekly.json));
  assert.deepEqual([weekly.json.data.times, weekly.json.data.days, weekly.json.data.model], [["08:00"], ["mon"], CLAUDE_MODEL], "Monday 08:00 and the stored model");
  assert.deepEqual((await settingOf(w)).weekly_review, { at: ["08:00"], days: ["mon"] });

  const moved = await schedule(w, ["install", "catch-up", "--days", "sat,sun"]);
  assert.deepEqual([moved.json.data.times, moved.json.data.days, moved.json.data.replaced], [["07:30"], ["sat", "sun"], true], "--days alone keeps the stored times; the entry is replaced");

  const listed = await schedule(w, ["list"]);
  assert.deepEqual(listed.json.data.setting, await settingOf(w));
  assert.deepEqual(listed.json.data.schedules.map((item: any) => [item.job, item.agent, item.model, item.times, item.days, item.matches]), [
    ["catch-up", "claude", CLAUDE_MODEL, ["07:30"], ["sat", "sun"], true],
    ["weekly-review", "claude", CLAUDE_MODEL, ["08:00"], ["mon"], true],
  ]);

  const removed = await schedule(w, ["remove", "weekly-review"]);
  assert.deepEqual([removed.json.data.removed, removed.json.data.setting.weekly_review], [true, "off"]);
  assert.equal((await settingOf(w)).weekly_review, "off");
  const again = await schedule(w, ["remove", "catch-up"]);
  assert.deepEqual((await settingOf(w)), { runner: "system", agent: "claude", model: CLAUDE_MODEL, catch_up: "off", weekly_review: "off" }, "the object stays with both off: the user declined");
  assert.equal(again.json.data.removed, true);
  assert.equal((await schedule(w, ["remove", "catch-up"])).json.data.removed, false, "a second remove removes nothing, exit 0");
  assert.deepEqual((await schedule(w, ["list"])).json.data.schedules, []);
});

test("a dry run writes neither settings.schedule nor an entry", async (context) => {
  const w = await world(context, "darwin");
  const before = await readFile(join(w.dir, "brain.json"), "utf8");
  const dry = await schedule(w, ["install", "catch-up", "--at", "06:45", "--model", CLAUDE_MODEL, "--dry-run"]);
  assert.equal(dry.code, 0, JSON.stringify(dry.json));
  assert.deepEqual([dry.json.data.setting_written, dry.json.data.written, dry.json.data.dry_run, dry.json.data.setting.catch_up], [false, false, true, { at: ["06:45"] }]);
  assert.equal(await readFile(join(w.dir, "brain.json"), "utf8"), before);
  await assert.rejects(readdir(w.env.UB_LAUNCH_AGENTS_DIR!));
});

test("the real launchd path loads the agent through launchctl, and a failed bootstrap keeps the file and the object with SCHEDULE_NOT_LOADED", async (context) => {
  const w = await world(context, "darwin", { real: true });
  const ok = fakeScheduler();
  const installed = await schedule(w, ["install", "catch-up", "--model", CLAUDE_MODEL], ok.process);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  assert.equal(installed.json.data.path, join(w.home, "Library", "LaunchAgents", `${installed.json.data.label}.plist`));
  assert.equal(installed.json.data.loaded, true);
  assert.deepEqual(ok.launchctl.map((args) => args[0]), ["bootout", "bootstrap"]);
  assert.ok((await readdir(join(w.home, "Library", "Logs", "ultimate-brain"))) !== undefined, "the log folder is made");

  const failing = fakeScheduler(() => new Error("Bootstrap failed: 5: Input/output error"));
  const refused = await schedule(w, ["install", "weekly-review"], failing.process);
  assert.equal(refused.code, 0);
  assert.deepEqual([refused.json.data.written, refused.json.data.loaded], [true, false]);
  assert.deepEqual(refused.json.warnings.map((warning: any) => warning.code), ["FOLDER_TRUST", "SCHEDULE_NOT_LOADED"]);
  assert.match(refused.json.warnings[1].message, /Input\/output error/);
  assert.deepEqual((await settingOf(w)).weekly_review, { at: ["08:00"], days: ["mon"] }, "the object is written: the next install installs it");

  const removed = await schedule(w, ["remove", "catch-up"], ok.process);
  assert.equal(removed.json.data.removed, true);
  assert.deepEqual(ok.launchctl.at(-1)?.[0], "bootout");
});

// --- Windows ------------------------------------------------------------------------------------------

test("on Windows the task XML runs only when logged on, wakes the computer, starts when available, on battery too, with the times and days", async (context) => {
  const w = await world(context, "win32");
  const installed = await schedule(w, ["install", "weekly-review", "--at", "17:00,08:00", "--days", "fri,mon", "--model", CLAUDE_MODEL]);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  const data = installed.json.data;
  assert.equal(data.platform, "win32");
  assert.equal(data.path, join(w.env.UB_WINDOWS_TASKS_DIR!, `${data.label}.xml`), "path is the local copy");
  assert.deepEqual([data.written, data.loaded, data.replaced, data.cron], [true, false, false, null], "under UB_WINDOWS_TASKS_DIR the copy is the entry and PowerShell is never called");
  assert.deepEqual(data.command, [join(w.bin, "claude.exe"), "-p", "weekly review unattended", "--model", CLAUDE_MODEL, "--max-budget-usd", "3"]);
  assert.deepEqual(installed.json.warnings.map((warning: any) => warning.code), ["FOLDER_TRUST"]);

  const task = await readFile(data.path, "utf8");
  assert.match(task, /^<\?xml version="1\.0" encoding="UTF-16"\?>\n<Task version="1\.2" xmlns="http:\/\/schemas\.microsoft\.com\/windows\/2004\/02\/mit\/task">/);
  assert.deepEqual(tag(task, "LogonType"), ["InteractiveToken"], "only when the user is logged on");
  assert.deepEqual(tag(task, "UserId"), ["WORKPC\\sam"]);
  assert.deepEqual(tag(task, "RunLevel"), ["LeastPrivilege"]);
  assert.deepEqual(tag(task, "WakeToRun"), ["true"], "wakes the computer to run");
  assert.deepEqual(tag(task, "StartWhenAvailable"), ["true"], "starts as soon as possible after a missed start");
  assert.deepEqual([tag(task, "DisallowStartIfOnBatteries"), tag(task, "StopIfGoingOnBatteries")], [["false"], ["false"]], "runs on battery, as a Mac does");
  assert.deepEqual([tag(task, "ExecutionTimeLimit"), tag(task, "MultipleInstancesPolicy")], [["PT2H"], ["IgnoreNew"]]);
  assert.equal(task.includes("<Password>"), false, "no password is stored");
  assert.deepEqual(tag(task, "StartBoundary"), [`${localDate()}T08:00:00`, `${localDate()}T17:00:00`], "one calendar trigger per time, the install date at that local time, no offset");
  assert.equal([...task.matchAll(/<CalendarTrigger>/g)].length, 2);
  assert.equal([...task.matchAll(/<DaysOfWeek>\s*<Monday \/>\s*<Friday \/>\s*<\/DaysOfWeek>\s*<WeeksInterval>1<\/WeeksInterval>/g)].length, 2, "each trigger by week on Monday and Friday");
  assert.equal(task.includes("<ScheduleByDay>"), false);
  assert.deepEqual(tag(task, "Command"), ["%SystemRoot%\\System32\\cmd.exe"]);
  const args = unxml(tag(task, "Arguments")[0]!);
  const log = join(w.env.LOCALAPPDATA!, "ultimate-brain", "logs", `${data.label}.log`);
  assert.equal(args, `/d /s /c "set "PATH=${w.bin};${dirname(process.execPath)};%PATH%" && "${join(w.bin, "claude.exe")}" "-p" "weekly review unattended" "--model" "${CLAUDE_MODEL}" "--max-budget-usd" "3" >> "${log}" 2>&1"`);
  assert.deepEqual(tag(task, "WorkingDirectory").map(unxml), [w.dir]);
  const description = unxml(tag(task, "Description")[0]!);
  assert.deepEqual(JSON.parse(description.slice("ultimate-brain:".length)), { brain: w.dir, job: "weekly-review", times: ["08:00", "17:00"], days: ["mon", "fri"], agent: "claude", model: CLAUDE_MODEL, prompt: "weekly review unattended" });

  const daily = await schedule(w, ["install", "catch-up"]);
  const dailyTask = await readFile(daily.json.data.path, "utf8");
  assert.match(dailyTask, /<StartBoundary>[^<]*T07:30:00<\/StartBoundary>\s*<Enabled>true<\/Enabled>\s*<ScheduleByDay>\s*<DaysInterval>1<\/DaysInterval>\s*<\/ScheduleByDay>/, "every day: by day, interval 1");

  const replaced = await schedule(w, ["install", "weekly-review", "--at", "09:15"]);
  assert.deepEqual([replaced.json.data.replaced, replaced.json.data.days], [true, null]);
  assert.deepEqual(tag(await readFile(data.path, "utf8"), "StartBoundary"), [`${localDate()}T09:15:00`]);

  const listed = await schedule(w, ["list"]);
  assert.deepEqual(listed.json.data.schedules.map((item: any) => [item.job, item.times, item.days, item.matches]), [["catch-up", ["07:30"], null, true], ["weekly-review", ["09:15"], null, true]]);
  const removed = await schedule(w, ["remove", "weekly-review"]);
  assert.equal(removed.json.data.removed, true);
  assert.deepEqual((await readdir(w.env.UB_WINDOWS_TASKS_DIR!)).sort(), [`${daily.json.data.label}.xml`]);
  const here = await schedule(w, ["remove", "--here"]);
  assert.deepEqual([here.json.data.removed, here.json.data.setting.catch_up], [[daily.json.data.label], { at: ["07:30"] }], "remove --here leaves the setting as it is");
  assert.deepEqual(await readdir(w.env.UB_WINDOWS_TASKS_DIR!), []);
});

test("the real Windows path registers the task through PowerShell, keeps a local copy, and a failed registration writes no entry", async (context) => {
  const w = await world(context, "win32", { real: true });
  const register = fakeScheduler((script) => script.includes("Get-ScheduledTask -TaskPath '\\' -TaskName 'eu.ultimate-brain.") && script.includes("ConvertTo-Json") ? "[]" : "created");
  const installed = await schedule(w, ["install", "catch-up", "--at", "07:30", "--model", CLAUDE_MODEL], register.process);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  const { label, path } = installed.json.data;
  assert.equal(path, join(w.env.LOCALAPPDATA!, "ultimate-brain", "tasks", `${label}.xml`));
  assert.deepEqual([installed.json.data.written, installed.json.data.loaded, installed.json.data.replaced], [true, true, false]);
  assert.equal(register.scripts.length, 1);
  const script = register.scripts[0]!;
  assert.match(script, new RegExp(`Register-ScheduledTask -TaskName '${label.replaceAll(".", "\\.")}' -Xml '<\\?xml version="1\\.0" encoding="UTF-16"\\?>`));
  assert.match(script, / -Force \| Out-Null/);
  assert.ok(script.includes(await readFile(path, "utf8")), "the local copy is the registered XML");
  assert.ok((await readdir(join(w.env.LOCALAPPDATA!, "ultimate-brain", "logs"))) !== undefined, "the log folder is made at install");

  const again = fakeScheduler(() => "replaced");
  assert.equal((await schedule(w, ["install", "catch-up", "--at", "07:45"], again.process)).json.data.replaced, true, "-Force replaced the task");

  const description = `ultimate-brain:${JSON.stringify({ brain: w.dir, job: "catch-up", times: ["07:45"], days: null, agent: "claude", model: CLAUDE_MODEL, prompt: "catch up unattended" })}`;
  const listing = fakeScheduler(() => JSON.stringify([{ name: label, description }]));
  const listed = await schedule(w, ["list"], listing.process);
  assert.match(listing.scripts[0]!, new RegExp(`Get-ScheduledTask -TaskPath '\\\\' -TaskName '${label.replace(/catch-up$/, "").replaceAll(".", "\\.")}\\*'`));
  assert.deepEqual(listed.json.data.schedules, [{ job: "catch-up", label, path, times: ["07:45"], days: null, agent: "claude", model: CLAUDE_MODEL, prompt: "catch up unattended", matches: true }]);

  const failing = fakeScheduler(() => new Error("Access is denied."));
  const refused = await schedule(w, ["install", "weekly-review"], failing.process);
  assert.equal(refused.code, 0);
  assert.deepEqual([refused.json.data.written, refused.json.data.loaded], [false, false]);
  assert.deepEqual(refused.json.warnings.map((warning: any) => warning.code), ["FOLDER_TRUST", "SCHEDULE_NOT_LOADED"]);
  assert.match(refused.json.warnings[1].message, /Access is denied/);
  await assert.rejects(readFile(join(w.env.LOCALAPPDATA!, "ultimate-brain", "tasks", `${refused.json.data.label}.xml`)), "no copy for a task not registered");
  assert.deepEqual((await settingOf(w)).weekly_review, { at: ["08:00"], days: ["mon"] }, "the object stays written");

  const unregister = fakeScheduler(() => "removed");
  const removed = await schedule(w, ["remove", "catch-up"], unregister.process);
  assert.equal(removed.json.data.removed, true);
  assert.match(unregister.scripts[0]!, new RegExp(`Unregister-ScheduledTask -TaskPath '\\\\' -TaskName '${label.replaceAll(".", "\\.")}' -Confirm:\\$false`));
  await assert.rejects(readFile(path), "the copy is deleted");
});

test("on Windows an agent installed with npm is found as its .cmd shim, for claude and codex; an .exe in the same folder comes first", async (context) => {
  const w = await world(context, "win32", { git: true });
  await rm(join(w.bin, "claude.exe"));
  await rm(join(w.bin, "codex.exe"));
  // An earlier PATH folder holding only the shims, as npm's global folder does.
  const npm = join(w.home, "npm");
  await mkdir(npm);
  for (const name of ["claude.cmd", "codex.cmd"]) {
    await writeFile(join(npm, name), "@echo off\r\n");
    await chmod(join(npm, name), 0o755);
  }
  const env = { ...w.env, PATH: [npm, w.bin].join(process.platform === "win32" ? ";" : ":") };
  const claude = await schedule({ ...w, env }, ["install", "catch-up", "--model", CLAUDE_MODEL]);
  assert.equal(claude.code, 0, JSON.stringify(claude.json));
  assert.equal(claude.json.data.command[0], join(npm, "claude.cmd"));
  assert.match(unxml(tag(await readFile(claude.json.data.path, "utf8"), "Arguments")[0]!), new RegExp(`&& "${join(npm, "claude.cmd").replaceAll("\\", "\\\\").replaceAll(".", "\\.")}" "-p" "catch up unattended"`));
  const codex = await schedule({ ...w, env }, ["install", "catch-up", "--agent", "codex", "--model", CODEX_MODEL]);
  assert.equal(codex.json.data.command[0], join(npm, "codex.cmd"));
  await writeFile(join(npm, "codex.exe"), "");
  await chmod(join(npm, "codex.exe"), 0o755);
  assert.equal((await schedule({ ...w, env }, ["install", "catch-up"])).json.data.command[0], join(npm, "codex.exe"), "the .exe first");
});

// --- the agents -----------------------------------------------------------------------------------------

test("codex: the exec command with its sandbox, approvals and network, no FOLDER_TRUST, NO_SPEND_CEILING on the weekly review, BRAIN_NOT_GIT outside Git", async (context) => {
  const w = await world(context, "darwin", { git: true });
  const installed = await schedule(w, ["install", "catch-up", "--agent", "codex", "--model", CODEX_MODEL]);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  assert.deepEqual(installed.json.data.command, [join(w.bin, "codex"), "exec", "--model", CODEX_MODEL, "--sandbox", "workspace-write", "-c", "approval_policy=never", "-c", "sandbox_workspace_write.network_access=true", "catch up unattended"]);
  assert.deepEqual(installed.json.warnings, [], "trust changes nothing for a scheduled Codex run");
  assert.deepEqual(await settingOf(w), { runner: "system", agent: "codex", model: CODEX_MODEL, catch_up: { at: ["07:30"] }, weekly_review: "off" });
  const plist = await readFile(installed.json.data.path, "utf8");
  assert.match(plist, /<string>[^<]*\/codex<\/string>\s*<string>exec<\/string>\s*<string>--model<\/string>\s*<string>gpt-5\.2-codex<\/string>\s*<string>--sandbox<\/string>\s*<string>workspace-write<\/string>/);

  const weekly = await schedule(w, ["install", "weekly-review"]);
  assert.equal(weekly.code, 0, JSON.stringify(weekly.json));
  assert.equal(weekly.json.data.command.includes("--max-budget-usd"), false);
  assert.deepEqual(weekly.json.warnings, [{ code: "NO_SPEND_CEILING", message: "Codex has no spend ceiling for a run: the weekly review stops at its own time and judgment budget (settings.weekly)." }]);
  assert.equal((await schedule(w, ["install", "weekly-review", "--max-budget-usd", "2"])).json.error.code, "USAGE", "--max-budget-usd with codex");

  const win = await world(context, "win32", { git: true });
  const windows = await schedule(win, ["install", "catch-up", "--agent", "codex", "--model", CODEX_MODEL]);
  assert.equal(windows.json.data.command[0], join(win.bin, "codex.exe"));
  assert.match(unxml(tag(await readFile(windows.json.data.path, "utf8"), "Arguments")[0]!), /&& "[^"]*codex\.exe" "exec" "--model" "gpt-5\.2-codex" "--sandbox" "workspace-write" "-c" "approval_policy=never" "-c" "sandbox_workspace_write\.network_access=true" "catch up unattended" >> /);

  const outside = await world(context, "darwin");
  const before = await readFile(join(outside.dir, "brain.json"), "utf8");
  assert.equal((await schedule(outside, ["install", "catch-up", "--agent", "codex", "--model", CODEX_MODEL])).json.error.code, "BRAIN_NOT_GIT");
  assert.equal(await readFile(join(outside.dir, "brain.json"), "utf8"), before, "nothing written");
});

test("a changed agent needs --model and installs every other job again with it; a changed model alone does too", async (context) => {
  const w = await world(context, "linux", { git: true });
  await schedule(w, ["install", "catch-up", "--model", CLAUDE_MODEL]);
  await schedule(w, ["install", "weekly-review"]);
  assert.equal((await schedule(w, ["install", "catch-up", "--agent", "codex"])).json.error.code, "USAGE", "--agent changed without --model");
  assert.equal((await schedule(w, ["install", "catch-up", "--agent", "claude"])).code, 0, "the same agent is not a change");

  const switched = await schedule(w, ["install", "catch-up", "--agent", "codex", "--model", CODEX_MODEL]);
  assert.equal(switched.code, 0, JSON.stringify(switched.json));
  assert.deepEqual(switched.json.data.reinstalled, [switched.json.data.label.replace(/catch-up$/, "weekly-review")]);
  assert.deepEqual(switched.json.warnings.map((warning: any) => warning.code), ["NO_SPEND_CEILING"], "the weekly review reinstalled with codex has no ceiling");
  assert.deepEqual(await settingOf(w), { runner: "system", agent: "codex", model: CODEX_MODEL, catch_up: { at: ["07:30"] }, weekly_review: { at: ["08:00"], days: ["mon"] } });

  const model = await schedule(w, ["install", "weekly-review", "--model", "gpt-5.3-codex"]);
  assert.deepEqual([model.json.data.reinstalled.length, (await settingOf(w)).model], [1, "gpt-5.3-codex"]);
});

test("install refuses a bad job, time, day, agent or model, a missing agent and a job without its skill", async (context) => {
  const w = await world(context, "darwin");
  const code = async (args: string[], env = w.env) => (await schedule({ ...w, env }, ["install", ...args])).json.error?.code;
  assert.equal(await code(["nightly", "--model", CLAUDE_MODEL]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "24:00", "--model", CLAUDE_MODEL]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "07:00", "--days", "monday", "--model", CLAUDE_MODEL]), "USAGE");
  assert.equal(await code(["catch-up", "--agent", "gemini", "--model", CLAUDE_MODEL]), "USAGE");
  assert.equal(await code(["catch-up", "--model", "sonnet"]), "USAGE", "a moving alias");
  assert.equal(await code(["catch-up", "--agent", "codex", "--model", "GPT 5"]), "USAGE", "a malformed codex model");
  assert.equal(await code(["catch-up"]), "USAGE", "no model and none stored");
  assert.equal(await code(["catch-up", "--model", CLAUDE_MODEL, "--max-budget-usd", "2"]), "USAGE", "--max-budget-usd on catch-up");
  assert.equal(await code(["catch-up", "--model", CLAUDE_MODEL], { ...w.env, PATH: join(w.home, "nowhere") }), "AGENT_NOT_FOUND");
  assert.equal(await code(["catch-up", "--agent", "codex", "--model", CODEX_MODEL], { ...w.env, PATH: join(w.home, "nowhere") }), "AGENT_NOT_FOUND");
  await rm(join(w.dir, ".claude", "skills", "brain-catch-up"), { recursive: true, force: true });
  assert.equal(await code(["catch-up", "--model", CLAUDE_MODEL]), "SKILL_MISSING");
  assert.equal((await settingOf(w)), undefined, "nothing written by a refused install");
  assert.equal((await schedule(w, ["remove"])).json.error.code, "USAGE", "remove with neither a job nor --here");
  assert.equal((await schedule(w, ["remove", "catch-up", "--here"])).json.error.code, "USAGE");
});

// --- the value from 0.14.0 to 0.16.x -----------------------------------------------------------------------

test("an on value: install writes the object with the other job's slot read from this computer's entry; with none it is off", async (context) => {
  const w = await world(context, "darwin");
  await setSchedule(w, "on");
  await oldPlist(w, "weekly-review", ["08:00"], ["mon"]);
  const status = (await cli(w, ["status"])).json.data.schedule;
  assert.deepEqual([status.recorded, status.agent, status.jobs["weekly-review"].installed, status.jobs["weekly-review"].matches, status.jobs["weekly-review"].slot], [false, null, true, null, null], "recorded false: the times are in the entry, not the brain");
  const listed = await schedule(w, ["list"]);
  assert.deepEqual([listed.json.data.setting, listed.json.data.schedules[0].agent, listed.json.data.schedules[0].matches], ["on", "claude", null], "an entry from before 0.17.0 is read as claude");
  assert.equal((await schedule(w, ["install"])).json.error.code, "SCHEDULE_NOT_SET");

  const installed = await schedule(w, ["install", "catch-up", "--at", "07:00", "--model", CLAUDE_MODEL]);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  assert.deepEqual(await settingOf(w), { runner: "system", agent: "claude", model: CLAUDE_MODEL, catch_up: { at: ["07:00"] }, weekly_review: { at: ["08:00"], days: ["mon"] } });
  assert.equal((await cli(w, ["status"])).json.data.schedule.recorded, true);

  const fresh = await world(context, "darwin");
  await setSchedule(fresh, "on");
  await schedule(fresh, ["install", "weekly-review", "--model", CLAUDE_MODEL]);
  assert.deepEqual(await settingOf(fresh), { runner: "system", agent: "claude", model: CLAUDE_MODEL, catch_up: "off", weekly_review: { at: ["08:00"], days: ["mon"] } });
});

test("an off value: install with no job is SCHEDULE_NOT_SET, remove writes no object, and install <job> writes one", async (context) => {
  const w = await world(context, "darwin");
  await setSchedule(w, "off");
  const unset = await schedule(w, ["install"]);
  assert.deepEqual([unset.code, unset.json.error.code, unset.json.error.message], [4, "SCHEDULE_NOT_SET", 'The schedule isn\'t in the brain yet: say "schedule my brain" to choose its times.']);
  const removed = await schedule(w, ["remove", "catch-up"]);
  assert.deepEqual([removed.code, removed.json.data.removed, removed.json.data.setting], [0, false, "off"]);
  assert.equal(await settingOf(w), "off");
  await schedule(w, ["install", "catch-up", "--model", CLAUDE_MODEL]);
  assert.equal((await settingOf(w)).catch_up.at[0], "07:30");
});

test("an entry whose times would make brain.json invalid is refused with BRAIN_CONFIG_INVALID, nothing written", async (context) => {
  const w = await world(context, "darwin");
  await setSchedule(w, "on");
  await oldPlist(w, "weekly-review", ["8:00"], ["mon"]);
  const before = await readFile(join(w.dir, "brain.json"), "utf8");
  assert.equal((await schedule(w, ["install", "catch-up", "--model", CLAUDE_MODEL])).json.error.code, "BRAIN_CONFIG_INVALID");
  assert.equal(await readFile(join(w.dir, "brain.json"), "utf8"), before);
});

// --- install with no job --------------------------------------------------------------------------------------

test("install with no job installs every slot of the object and removes the entry of a job that is off: the same schedule on another computer", async (context) => {
  const first = await world(context, "darwin");
  await schedule(first, ["install", "catch-up", "--at", "06:30", "--days", "mon,tue", "--model", CLAUDE_MODEL]);
  await schedule(first, ["install", "weekly-review", "--at", "18:00", "--days", "fri"]);
  const kept = await settingOf(first);

  // Another computer: the same brain.json, no entries yet, Windows.
  const second = await world(context, "win32");
  await setSchedule(second, kept);
  assert.equal((await schedule(second, ["install", "--at", "07:00"])).json.error.code, "USAGE", "only --dry-run with no job");
  const dry = await schedule(second, ["install", "--dry-run"]);
  assert.deepEqual([dry.json.data.installed.map((item: any) => item.written), await readdir(second.env.UB_WINDOWS_TASKS_DIR!).catch(() => [])], [[false, false], []]);
  const all = await schedule(second, ["install"]);
  assert.equal(all.code, 0, JSON.stringify(all.json));
  assert.deepEqual(all.json.data.installed.map((item: any) => [item.job, item.times, item.days, item.setting_written]), [["catch-up", ["06:30"], ["mon", "tue"], false], ["weekly-review", ["18:00"], ["fri"], false]]);
  assert.deepEqual([all.json.data.removed, all.json.data.setting], [[], kept]);
  assert.equal(await settingOf(second).then(JSON.stringify), JSON.stringify(kept), "brain.json unchanged");

  await setSchedule(second, { ...kept, weekly_review: "off" });
  const again = await schedule(second, ["install"]);
  assert.deepEqual([again.json.data.installed.length, again.json.data.removed], [1, [all.json.data.installed[1].label]]);
  const status = (await cli(second, ["status"])).json.data.schedule;
  assert.deepEqual(status, {
    recorded: true, runner: "system", agent: "claude", model: CLAUDE_MODEL, platform: "win32",
    jobs: { "catch-up": { slot: { at: ["06:30"], days: ["mon", "tue"] }, installed: true, matches: true }, "weekly-review": { slot: "off", installed: false, matches: null } },
  });
});

// --- status ---------------------------------------------------------------------------------------------

test("status reports the schedule item on Windows as on macOS, and elsewhere with installed null", async (context) => {
  for (const platform of ["darwin", "win32"] as const) {
    const w = await world(context, platform);
    const none = (await cli(w, ["status"])).json.data.schedule;
    assert.deepEqual(none, { recorded: false, runner: null, agent: null, model: null, platform, jobs: { "catch-up": { slot: null, installed: false, matches: null }, "weekly-review": { slot: null, installed: false, matches: null } } });
    await schedule(w, ["install", "catch-up", "--model", CLAUDE_MODEL]);
    await schedule(w, ["install", "weekly-review"]);
    // The slot changed in the brain, from another computer: this entry no longer matches it.
    await setSchedule(w, { ...(await settingOf(w)), weekly_review: { at: ["09:00"], days: ["mon"] } });
    const status = (await cli(w, ["status"])).json.data.schedule;
    assert.deepEqual(status, {
      recorded: true, runner: "system", agent: "claude", model: CLAUDE_MODEL, platform,
      jobs: { "catch-up": { slot: { at: ["07:30"], days: null }, installed: true, matches: true }, "weekly-review": { slot: { at: ["09:00"], days: ["mon"] }, installed: true, matches: false } },
    }, platform);
  }
  const linux = await world(context, "linux");
  await schedule(linux, ["install", "catch-up", "--model", CLAUDE_MODEL]);
  assert.deepEqual((await cli(linux, ["status"])).json.data.schedule.jobs["catch-up"], { slot: { at: ["07:30"], days: null }, installed: null, matches: null }, "cron lines are the user's");
});

test("elsewhere install still writes settings.schedule and returns the cron line of the agent; list and remove manage no lines", async (context) => {
  const w = await world(context, "linux", { git: true });
  const installed = await schedule(w, ["install", "catch-up", "--agent", "codex", "--model", CODEX_MODEL, "--at", "07:00", "--days", "sat,sun"]);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  assert.deepEqual([installed.json.data.path, installed.json.data.written, installed.json.data.setting_written], [null, false, true]);
  assert.match(installed.json.data.cron[0], /^0 7 \* \* 6,0 mkdir -p "\$HOME\/\.ultimate-brain\/logs" && cd '.+' && PATH='.+' '.+\/codex' 'exec' '--model' 'gpt-5\.2-codex' '--sandbox' 'workspace-write' '-c' 'approval_policy=never' '-c' 'sandbox_workspace_write\.network_access=true' 'catch up unattended' >> "\$HOME\/\.ultimate-brain\/logs\/eu\.ultimate-brain\..+\.catch-up\.log" 2>&1$/);
  const listed = await schedule(w, ["list"]);
  assert.deepEqual([listed.json.data.schedules, listed.json.warnings[0].code, listed.json.data.setting.agent], [[], "SCHEDULE_NOT_MANAGED", "codex"]);
  const removed = await schedule(w, ["remove", "catch-up"]);
  assert.deepEqual([removed.json.data.removed, removed.json.warnings[0].code, (await settingOf(w)).catch_up], [false, "SCHEDULE_NOT_MANAGED", "off"]);
});
