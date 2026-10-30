import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { runCli } from "../src/cli.ts";
import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// Decision 0051, spec/cli.md §3.9, §5.2, §5.14, §5.21, §6.1 (CC-63).

const NOW = "2026-12-10T09:00:00Z";
const MARIA = "per-3h8w2n6c";
const MARIA_PAGE = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const INBOX = "a1000000-0000-4000-8000-00000000000c";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function setConfig(dir: string, change: (config: Record<string, any>) => void): Promise<void> {
  const path = join(dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  change(config);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

// --- settings.unattended and the status summary -------------------------------------------------

test("max_inputs: status shows 10 by default and the value set; 0 and a fraction are refused", async (context) => {
  const dir = await fixtureCopy(context);
  assert.deepEqual((await run(dir, ["status"])).json.data.settings, { publish: "ask", push: "auto", unattended: { max_inputs: 10 } });
  assert.equal((await run(dir, ["config", "set", "settings.unattended.max_inputs", "4"])).code, 0);
  assert.equal((await run(dir, ["status"])).json.data.settings.unattended.max_inputs, 4);
  for (const value of ["0", "2.5", '"10"']) {
    const refused = await run(dir, ["config", "set", "settings.unattended.max_inputs", value]);
    assert.equal(refused.json.error?.code, "INPUT_INVALID", value);
  }
  await setConfig(dir, (config) => { config.settings = { unattended: { max_inputs: 0 } }; });
  assert.equal((await run(dir, ["status"])).json.error?.code, "BRAIN_CONFIG_INVALID");
});

test("status sums the unattended catch-ups since the last attended one, and flags a growing backlog", async (context) => {
  const dir = await fixtureCopy(context);
  assert.deepEqual((await run(dir, ["status"])).json.data.unattended, { catch_up: null, backlog: false });
  const log = async (at: string, pairs: string[]) => assert.equal((await brain(["log", "catch-up", "-", ...pairs, "--brain", dir, "--now", at, "--json"])).code, 0);
  await log("2026-11-28T07:00:00Z", ["mode=unattended", "inputs=10", "left=5", "skipped=0", "waiting=0", "failed=0", "report=no"]);
  await log("2026-11-30T18:00:00Z", ["notes_read=12", "seconds=200"]);
  await log("2026-12-01T07:00:00Z", ["mode=unattended", "inputs=2", "left=3", "skipped=1", "waiting=1", "failed=1", "failures=Notion login", "report=no"]);
  await log("2026-12-02T07:00:00Z", ["mode=unattended", "inputs=3", "left=0", "skipped=1", "waiting=1", "failed=0", "report=yes"]);
  await log("2026-12-03T07:00:00Z", ["mode=unattended", "inputs=1", "left=2", "skipped=1", "waiting=2", "failed=1", "failures=Notion login; lint error", "report=yes"]);
  const status = (await run(dir, ["status"])).json.data.unattended;
  assert.deepEqual(status, {
    catch_up: { since: "2026-11-30T18:00:00Z", runs: 3, inputs: 6, failed: 2, failures: ["Notion login", "lint error"], left: 2, skipped: 1, waiting: 2, last: "2026-12-03T07:00:00Z" },
    backlog: false,
  });
  await log("2026-12-04T07:00:00Z", ["mode=unattended", "inputs=10", "left=4", "skipped=0", "waiting=0", "failed=0", "report=no"]);
  await log("2026-12-05T07:00:00Z", ["mode=unattended", "inputs=10", "left=1", "skipped=0", "waiting=0", "failed=0", "report=no"]);
  assert.equal((await run(dir, ["status"])).json.data.unattended.backlog, true, "left over in the last three runs");
  await log("2026-12-05T18:00:00Z", ["notes_read=3", "seconds=90"]);
  assert.deepEqual((await run(dir, ["status"])).json.data.unattended, { catch_up: null, backlog: true }, "an attended run starts the count again");
});

// --- sync: --skip-conflicted and NOT_A_REPORT ------------------------------------------------------

test("sync apply --skip-conflicted skips a conflicted row whole and the creates that depend on it (ROW_CONFLICTED)", async (context) => {
  const dir = await fixtureCopy(context);
  const orgPage = "c1000000-0000-4000-8000-000000000001";
  const otherPage = "c1000000-0000-4000-8000-000000000002";
  const org = (id: string, title: string, page: string) => ({ type: "org", id, title, lifecycle: "draft", frontmatter: { summary: title, notion: page, sources: [`notion:${page}`], notion_fields: { as_of: NOW }, notion_published: { Name: title, Summary: null } }, body: "" });
  const plan = {
    as_of: NOW,
    create: [org("org-5h2k8q1w", "Globex", orgPage), org("org-6j3m9r2x", "Initech", otherPage)],
    updates: [{ id: MARIA, lifecycle: "reviewed" }],
    corrections: [{ target: MARIA, field: "summary", value: "Product lead at Acme.", observed_at: NOW, property: "Summary", notion_value: "Product lead at Acme." }],
    decisions: [],
    conflicts: [
      { database: "people", page_id: MARIA_PAGE, brain_id: MARIA, code: "BOTH_CHANGED", message: "Role changed on both sides", property: "Role" },
      { database: "orgs", page_id: orgPage, brain_id: null, code: "UNRESOLVED_RELATION", message: "Globex names an unknown parent" },
    ],
    ignored: [],
  };
  const skipped = await run(dir, ["sync", "apply", "--skip-conflicted"], plan);
  assert.equal(skipped.code, 0, skipped.stdout);
  const data = skipped.json.data;
  assert.deepEqual(data.create.map((item: any) => [item.id, item.result, item.reason]), [["org-5h2k8q1w", "skipped", "ROW_CONFLICTED"], ["org-6j3m9r2x", "applied", undefined]]);
  assert.deepEqual(data.updates.map((item: any) => [item.id, item.result, item.reason]), [[MARIA, "skipped", "ROW_CONFLICTED"]]);
  assert.deepEqual(data.corrections.map((item: any) => [item.target, item.result, item.reason]), [[MARIA, "skipped", "ROW_CONFLICTED"]]);
  assert.equal(parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes.summary === "Product lead at Acme.", false, "the Summary correction waits with its row");

  const dir2 = await fixtureCopy(context);
  const applied = await run(dir2, ["sync", "apply"], plan);
  assert.equal(applied.json.data.corrections[0].result, "applied", "without the flag a conflict blocks only its own property");
});

const REPORT_BODY = [
  "## Where it stands", "Launch is set for February, per [the auth decision](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md).",
  "## Timeline", "- 2026-12-03: auth chosen.",
  "## Decisions in force", "- [Use Supabase for auth](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md)",
  "## Open questions and risks", "- None",
  "## People involved", "- None",
  "## Gaps", "- Nothing on pricing.",
].join("\n\n");

async function reportBrain(context: TestContext): Promise<{ dir: string; id: string; page: string }> {
  const dir = await fixtureCopy(context);
  await setConfig(dir, (config) => { config.notion.databases.inbox = INBOX; });
  const created = await run(dir, ["report", "new"], { title: "Acme launch: where we stand", question: "Everything about the Acme launch", projects: ["prj-9x4t1b7e"], body: REPORT_BODY });
  const id = created.json.data.id as string;
  const rendered = await run(dir, ["sync", "render", "--ids", id]);
  const item = rendered.json.data.items[0];
  const page = "b2000000-0000-4000-8000-000000000001";
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id, notion: page, synced_at: NOW, published: item.published }] })).code, 0);
  return { dir, id, page };
}

test("sync render --skip-conflicted holds back a report with a What to fix nobody has read, after a failed publish (FIX_WAITING)", async (context) => {
  const { dir, id, page } = await reportBrain(context);
  // An attended run records fix A, and its publish fails: the report is changed but not recorded.
  const proposal = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Launch: March", target: "prj-9x4t1b7e", field: "launch_date", after: "2027-03", why: "The report was wrong.", source: "mtg-8c4n2p7w" }] });
  assert.equal((await run(dir, ["report", "fix", id, "--text", "Fix A", "--proposals", proposal.json.data.created[0].id])).code, 0);
  // Then the user writes fix B, and an unattended run plans.
  const plan = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "inbox", page_id: page, last_edited: NOW, properties: { "Brain ID": id, "What to fix": "Fix B" } }] })).json.data;
  assert.deepEqual(plan.report_fixes, [{ page_id: page, report: id, text: "Fix B" }]);
  const planFile = join(dir, "..", "plan.json");
  await writeFile(planFile, JSON.stringify(plan));

  const attended = await run(dir, ["sync", "render", "--changed", "--plan", planFile]);
  const risky = attended.json.data.items.find((item: any) => item.id === id);
  assert.deepEqual(risky.properties["What to fix"], { type: "rich_text", value: null }, "without the flag the render would clear fix B");

  const unattended = await run(dir, ["sync", "render", "--changed", "--plan", planFile, "--skip-conflicted"]);
  assert.equal(unattended.code, 0, unattended.stdout);
  assert.equal(unattended.json.data.items.some((item: any) => item.id === id), false);
  assert.deepEqual(unattended.json.data.skipped, [{ id, reason: "FIX_WAITING" }]);
});

test("sync render --skip-conflicted holds back a conflicted row whole (ROW_CONFLICTED), and needs --plan", async (context) => {
  const dir = await fixtureCopy(context);
  const plan = { as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [{ database: "people", page_id: MARIA_PAGE, brain_id: MARIA, code: "BOTH_CHANGED", message: "Role", property: "Role" }], ignored: [] };
  const planFile = join(dir, "..", "plan.json");
  await writeFile(planFile, JSON.stringify(plan));
  const all = await run(dir, ["sync", "render", "--ids", MARIA, "--plan", planFile]);
  assert.equal(all.json.data.items.length, 1, "with --plan alone only Role is held");
  assert.equal(all.json.data.items[0].properties.Role, undefined);
  const whole = await run(dir, ["sync", "render", "--ids", MARIA, "--plan", planFile, "--skip-conflicted"]);
  assert.deepEqual(whole.json.data.items, []);
  assert.deepEqual(whole.json.data.skipped, [{ id: MARIA, reason: "ROW_CONFLICTED" }]);
  assert.equal((await run(dir, ["sync", "render", "--changed", "--skip-conflicted"])).json.error?.code, "USAGE");
});

test("sync plan: a Report row with no Brain ID holds no report (NOT_A_REPORT)", async (context) => {
  const dir = await fixtureCopy(context);
  await setConfig(dir, (config) => { config.notion.databases.inbox = INBOX; });
  const page = "d1000000-0000-4000-8000-000000000001";
  const plan = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "inbox", page_id: page, last_edited: NOW, properties: { Kind: "Report", "Refresh asked": true, "What to fix": "wrong date" } }] })).json.data;
  assert.deepEqual(plan.ignored.map((item: any) => [item.page_id, item.reason, item.property]), [[page, "NOT_A_REPORT", "Refresh asked"], [page, "NOT_A_REPORT", "What to fix"]]);
  assert.deepEqual([plan.refresh_requests, plan.report_fixes], [[], []]);
});

// --- brain schedule --------------------------------------------------------------------------------

async function scheduleEnv(context: TestContext, platform = "darwin") {
  const root = await mkdtemp(join(tmpdir(), "schedule-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "claude"), "#!/bin/sh\n");
  await chmod(join(bin, "claude"), 0o755);
  const agents = join(root, "LaunchAgents");
  return { agents, bin, env: { PATH: bin, UB_LAUNCH_AGENTS_DIR: agents, UB_SCHEDULE_PLATFORM: platform } as NodeJS.ProcessEnv, home: root };
}

async function schedule(dir: string, args: string[], env: NodeJS.ProcessEnv, home: string) {
  const out: string[] = [];
  const code = await runCli(["schedule", ...args, "--brain", dir, "--json"], { io: { stdout: { write: (value) => out.push(String(value)) }, stderr: { write: () => undefined } }, env, homeDirectory: home });
  return { code, json: JSON.parse(out.join("")) };
}

test("schedule install writes a launchd agent that runs claude -p in the brain at the given times with the pinned model; list and remove", async (context) => {
  const dir = await fixtureCopy(context);
  const { agents, bin, env, home } = await scheduleEnv(context);
  const installed = await schedule(dir, ["install", "catch-up", "--at", "13:00,07:00", "--days", "fri,mon", "--model", "claude-sonnet-5-5"], env, home);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  const data = installed.json.data;
  assert.match(data.label, /^eu\.ultimate-brain\.[a-z0-9-]+-[0-9a-f]{8}\.catch-up$/);
  assert.equal(data.path, join(agents, `${data.label}.plist`));
  assert.deepEqual([data.times, data.days, data.prompt, data.written, data.replaced, data.loaded, data.cron], [["07:00", "13:00"], ["mon", "fri"], "catch up unattended", true, false, false, null]);
  assert.deepEqual(data.command, [join(bin, "claude"), "-p", "catch up unattended", "--model", "claude-sonnet-5-5"]);

  const plist = await readFile(data.path, "utf8");
  assert.match(plist, new RegExp(`<key>Label</key>\\s*<string>${data.label.replaceAll(".", "\\.")}</string>`));
  assert.match(plist, /<key>ProgramArguments<\/key>\s*<array>\s*<string>[^<]*\/claude<\/string>\s*<string>-p<\/string>\s*<string>catch up unattended<\/string>\s*<string>--model<\/string>\s*<string>claude-sonnet-5-5<\/string>/);
  assert.ok(plist.includes(`<key>WorkingDirectory</key>\n  <string>${await realpath(dir)}</string>`), "runs in the brain folder");
  assert.equal((plist.match(/<key>Weekday<\/key>/g) ?? []).length, 4, "two times on two days");
  assert.match(plist, /<key>Hour<\/key>\s*<integer>7<\/integer>\s*<key>Minute<\/key>\s*<integer>0<\/integer>\s*<key>Weekday<\/key>\s*<integer>1<\/integer>/);
  assert.match(plist, /<key>RunAtLoad<\/key>\s*<false\/>/);

  const again = await schedule(dir, ["install", "catch-up", "--at", "08:30", "--model", "claude-opus-5-5"], env, home);
  assert.equal(again.json.data.replaced, true);
  const listed = await schedule(dir, ["list"], env, home);
  assert.deepEqual(listed.json.data.schedules, [{ job: "catch-up", label: data.label, path: data.path, times: ["08:30"], days: null, model: "claude-opus-5-5", prompt: "catch up unattended" }]);

  assert.equal((await schedule(dir, ["remove", "catch-up"], env, home)).json.data.removed, true);
  assert.equal((await schedule(dir, ["remove", "catch-up"], env, home)).json.data.removed, false, "a second remove is a no-op");
  assert.deepEqual((await schedule(dir, ["list"], env, home)).json.data.schedules, []);
  assert.equal((await run(dir, ["lint"])).json.data.errors, 0, "schedule writes nothing in the brain");
});

test("schedule install elsewhere prints the cron line and writes nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const { agents, env, home } = await scheduleEnv(context, "linux");
  const installed = await schedule(dir, ["install", "catch-up", "--at", "07:00", "--days", "sat,sun", "--model", "claude-sonnet-5-5"], env, home);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  assert.deepEqual([installed.json.data.path, installed.json.data.written], [null, false]);
  assert.equal(installed.json.data.cron.length, 1);
  assert.match(installed.json.data.cron[0], /^0 7 \* \* 6,0 mkdir -p "\$HOME\/\.ultimate-brain\/logs" && cd '.+' && PATH='.+' '.+\/claude' '-p' 'catch up unattended' '--model' 'claude-sonnet-5-5' >> "\$HOME\/\.ultimate-brain\/logs\/eu\.ultimate-brain\..+\.catch-up\.log" 2>&1$/);
  await assert.rejects(readFile(agents), "no LaunchAgents folder was made");
  const listed = await schedule(dir, ["list"], env, home);
  assert.deepEqual([listed.json.data.schedules, listed.json.warnings[0].code], [[], "SCHEDULE_NOT_MANAGED"]);
});

test("schedule install refuses a bad job, time, day or model, a missing claude, and reflect without its skill", async (context) => {
  const dir = await fixtureCopy(context);
  const { env, home } = await scheduleEnv(context);
  const code = async (args: string[], environment = env) => (await schedule(dir, ["install", ...args], environment, home)).json.error?.code;
  assert.equal(await code(["nightly", "--at", "07:00", "--model", "claude-sonnet-5-5"]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "24:00", "--model", "claude-sonnet-5-5"]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "7:00", "--model", "claude-sonnet-5-5"]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "07:00", "--days", "monday", "--model", "claude-sonnet-5-5"]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "07:00", "--model", "sonnet"]), "USAGE", "a moving alias is refused");
  assert.equal(await code(["catch-up", "--at", "07:00"]), "USAGE");
  assert.equal(await code(["catch-up", "--at", "07:00", "--model", "claude-sonnet-5-5"], { ...env, PATH: "/nonexistent" }), "CLAUDE_NOT_FOUND");
  assert.equal(await code(["reflect", "--at", "08:00", "--days", "mon", "--model", "claude-sonnet-5-5"]), "SKILL_MISSING");
});
