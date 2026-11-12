import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { brain, fixtureCopy, testPackageRoot } from "./helpers.ts";

// The CLI reads `git config` in the brain folder (spec/setup.md §5): every test here sees only the brain's own Git
// configuration, never the machine's global or system identity. Each test file runs in its own process.
const EMPTY_GLOBAL = join(await mkdtemp(join(tmpdir(), "setup-gitconfig-")), "gitconfig");
await writeFile(EMPTY_GLOBAL, "");
process.env.GIT_CONFIG_GLOBAL = EMPTY_GLOBAL;
process.env.GIT_CONFIG_NOSYSTEM = "1";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const DB = (n: number) => `b1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SET_UP = 'say "set up my brain"';

async function git(cwd: string, args: string[]): Promise<string> {
  return (await exec("git", args, { cwd })).stdout;
}

/** A brain made by `brain init` (no Git), in a temp folder that also serves as the home directory. */
async function freshBrain(context: TestContext): Promise<{ home: string; target: string }> {
  const home = await realpath(await mkdtemp(join(tmpdir(), "brain-setup-")));
  context.after(() => rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const target = join(home, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], home);
  assert.equal(init.code, 0, init.stderr);
  return { home, target };
}

async function editConfig(target: string, change: (config: any) => void): Promise<void> {
  const path = join(target, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  change(config);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

/** Every database of Core and of the new-brain modules (Knowledge, Orgs, Documents, Reports, Tasks), and the Tasks database. */
async function connectDatabases(target: string): Promise<void> {
  await editConfig(target, (config) => {
    for (const [index, key] of ["areas", "projects", "meetings", "people", "review", "inbox", "decisions", "questions", "orgs", "documents"].entries()) {
      config.notion.databases[key] = DB(index + 1);
    }
    config.notion.tasks.database = DB(20);
  });
}

async function addOwnerPerson(target: string): Promise<void> {
  await mkdir(join(target, "knowledge", "people"), { recursive: true });
  await writeFile(join(target, "knowledge", "people", "test-owner.md"), "---\nid: per-4k7m2q9x\ntype: person\ntitle: Test Owner\nsummary: The owner of this synthetic brain.\nlifecycle: reviewed\ncreated: 2026-12-10\n---\n");
  await editConfig(target, (config) => { config.owner.person = "per-4k7m2q9x"; });
}

async function appendRules(target: string, lines: string): Promise<void> {
  const path = join(target, "AGENTS.md");
  await writeFile(path, `${await readFile(path, "utf8")}\n${lines}\n`);
}

async function logSetup(target: string, now: string, pairs: string[]): Promise<void> {
  const result = await brain(["log", "setup", "-", ...pairs, "--brain", target, "--now", now, "--json"]);
  assert.equal(result.code, 0, result.stdout);
}

async function status(target: string, home: string): Promise<{ data: any; human: string }> {
  const json = await brain(["status", "--brain", target, "--json"], home);
  assert.equal(json.code, 0, json.stdout);
  const human = await brain(["status", "--brain", target], home);
  assert.equal(human.code, 0, human.stderr);
  return { data: json.json.data, human: human.stdout };
}

// --- init (cli.md §5.1) and the new-brain modules (schema §12) ---

test("init's human output ends with one next step: say \"set up my brain\" in the new brain (cli.md §5.1, 0078 §2)", async (context) => {
  const home = await realpath(await mkdtemp(join(tmpdir(), "brain-init-")));
  context.after(() => rm(home, { recursive: true, force: true }));
  const target = join(home, "brain");
  const result = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW], home);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, [
    `Initialized Ultimate Brain at ${target}`,
    `Next: open Claude Code or Codex in ${target} and say "set up my brain"`,
    "",
  ].join("\n"));
  // No path under the installed package (setup.md §1).
  assert.equal(result.stdout.includes(await realpath(await testPackageRoot())), false);
});

test("a new brain starts with Documents, Reports and Tasks on, Planning and Domains off (schema §12, 0078 §4)", async (context) => {
  const { home, target } = await freshBrain(context);
  const config = JSON.parse(await readFile(join(target, "brain.json"), "utf8"));
  assert.deepEqual(config.modules, { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: false });
  const { data } = await status(target, home);
  assert.deepEqual(data.modules, { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: false });
});

test("a brain made before 0.14.0 keeps its modules: absent keys keep their old defaults, an absent block keeps every module but Domains (schema §12)", async (context) => {
  const { home, target } = await freshBrain(context);
  // The block a 0.6.0–0.13.x init wrote, and the same block with the off modules' keys left out.
  for (const block of [
    { domains: false, knowledge: true, orgs: true, documents: false, reports: false, tasks: false, planning: false },
    { domains: false, knowledge: true, orgs: true },
  ]) {
    await editConfig(target, (config) => { config.modules = block; });
    assert.deepEqual((await status(target, home)).data.modules, { domains: false, knowledge: true, orgs: true, documents: false, reports: false, tasks: false, planning: false });
  }
  await editConfig(target, (config) => { delete config.modules; });
  assert.deepEqual((await status(target, home)).data.modules, { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true });
});

// --- config (cli.md §5.3, schema §12) ---

test("config accepts notion.template_version as four digits and the three setup settings as on or off (cli.md §5.3, schema §12)", async (context) => {
  const { home, target } = await freshBrain(context);
  const set = await brain(["config", "set", "notion.template_version", '"0024"', "--brain", target, "--json"], home);
  assert.equal(set.code, 0, set.stdout);
  assert.deepEqual(set.json.data, { path: "notion.template_version", previous: null, value: "0024" });
  for (const value of ['"24"', "24", '"v0024"', '"00245"', '""']) {
    const bad = await brain(["config", "set", "notion.template_version", value, "--brain", target, "--json"], home);
    assert.equal(bad.code, 4, `${value}: ${bad.stdout}`);
    assert.equal(bad.json.error.code, "INPUT_INVALID");
  }
  for (const key of ["markitdown", "gh", "schedule"]) {
    for (const value of ["on", "off"]) {
      const ok = await brain(["config", "set", `settings.${key}`, `"${value}"`, "--brain", target, "--json"], home);
      assert.equal(ok.code, 0, ok.stdout);
    }
    for (const value of ['"yes"', "true"]) {
      const bad = await brain(["config", "set", `settings.${key}`, value, "--brain", target, "--json"], home);
      assert.equal(bad.code, 4, `${key} ${value}: ${bad.stdout}`);
      assert.equal(bad.json.error.code, "INPUT_INVALID");
    }
  }
  const config = JSON.parse(await readFile(join(target, "brain.json"), "utf8"));
  assert.equal(config.notion.template_version, "0024");
  assert.deepEqual([config.settings.markitdown, config.settings.gh, config.settings.schedule], ["off", "off", "off"]);
  const lint = await brain(["lint", "--brain", target, "--json"], home);
  assert.equal(lint.json.data.issues.filter((issue: { rule: string }) => issue.rule === "brain-config").length, 0, lint.stdout);
});

// --- track on area notes (schema §4, setup.md §11) ---

test("lint accepts an area's track list of 1 to 8 short lowercase phrases and reports anything else (schema §4)", async (context) => {
  const target = await fixtureCopy(context);
  const path = join(target, "areas", "clients.md");
  const original = await readFile(path, "utf8");
  const withTrack = (track: string) => original.replace("lifecycle: reviewed\n", `lifecycle: reviewed\ntrack: ${track}\n`);
  const schemaIssues = async () => {
    const lint = await brain(["lint", "--brain", target, "--json"]);
    return lint.json.data.issues.filter((issue: { rule: string; path: string }) => issue.rule === "schema" && issue.path === "areas/clients.md");
  };
  for (const good of ["[budget, deadlines, scope changes, risks]", "[renewals]", "[plazos de entrega, presupuesto, revisión]"]) {
    await writeFile(path, withTrack(good));
    assert.deepEqual(await schemaIssues(), [], good);
  }
  for (const bad of ["[]", "[a, b, c, d, e, f, g, h, i]", "[Budget]", "[budget, budget]", "budget", "[42]", `[${"x".repeat(41)}]`, "[\" budget\"]"]) {
    await writeFile(path, withTrack(bad));
    const issues = await schemaIssues();
    assert.equal(issues.length, 1, `${bad}: ${JSON.stringify(issues)}`);
    assert.match(issues[0].message, /track/, bad);
  }
});

// --- status: the setup block (cli.md §5.2, setup.md §5) ---

test("status on a fresh brain: no check passes, nothing recorded, template version unknown, next is the Git identity (cli.md §5.2)", async (context) => {
  const { home, target } = await freshBrain(context);
  const { data, human } = await status(target, home);
  assert.deepEqual(data.setup, {
    checks: { git_identity: false, remote: false, databases: false, drop_folder: false, language: false, owner_person: false },
    recorded: { "notion-mcp": null, "minutes-prompt": null, "brain-assistant": null, seeding: null, "first-value": null, schedule: null },
    first_value: null,
    template_version: null,
    required: { done: 0, total: 9 },
    next: "git_identity",
    finished: false,
  });
  assert.equal(human.split("\n")[0], `Setup: 0 of 9 done · next: set your Git identity · ${SET_UP}`);
  assert.equal(human.split("\n")[1], "Owner: Test Owner");
});

test("status counts each check and recorded step, and next walks setup's order (setup.md §2, §5)", async (context) => {
  const { home, target } = await freshBrain(context);
  const expectNext = async (next: string | null, done: number, what: string | null) => {
    const { data, human } = await status(target, home);
    assert.equal(data.setup.next, next);
    assert.deepEqual(data.setup.required, { done, total: 9 });
    assert.equal(human.split("\n")[0], `Setup: ${done} of 9 done · ${what === null ? "" : `next: ${what} · `}${SET_UP}`);
    return data.setup;
  };

  await git(target, ["init", "-q"]);
  await git(target, ["config", "user.name", "Test Owner"]);
  await expectNext("git_identity", 0, "set your Git identity"); // an email is needed too
  await git(target, ["config", "user.email", "owner@example.test"]);
  await expectNext("remote", 1, "add a private remote");
  await git(target, ["remote", "add", "origin", "git@example.test:owner/brain.git"]);
  await expectNext("drop_folder", 2, "create the drop folder");
  await appendRules(target, "Drop folder: `~/Drop/brain`");
  await expectNext("drop_folder", 2, "create the drop folder"); // the folder doesn't exist yet
  await mkdir(join(home, "Drop", "brain"), { recursive: true });
  await expectNext("language", 3, "say the language of your notes");
  await appendRules(target, "Language: English");
  await expectNext("notion-mcp", 4, "connect your agent to Notion");
  await logSetup(target, "2026-12-10T09:10:00Z", ["step=notion-mcp", "result=done"]);
  await expectNext("databases", 5, "connect Notion");
  await connectDatabases(target);
  await expectNext("minutes-prompt", 6, "paste the minutes prompt");
  await logSetup(target, "2026-12-10T09:20:00Z", ["step=minutes-prompt", "result=done"]);
  await expectNext("brain-assistant", 7, "set up Brain Assistant");
  await logSetup(target, "2026-12-10T09:30:00Z", ["step=brain-assistant", "result=done"]);
  await expectNext("owner_person", 8, "set your identities");
  await addOwnerPerson(target);
  await expectNext("seeding", 9, "seed your work");
  await logSetup(target, "2026-12-10T09:40:00Z", ["step=seeding", "result=done", "notes=12", "documents=3"]);
  await expectNext("first-value", 9, "check first value");
  await logSetup(target, "2026-12-10T09:50:00Z", ["step=first-value", "result=done", "tasks=pass", "report=pass", "organised=pass", "answer=pass"]);
  await expectNext("schedule", 9, "choose the schedule");
  await logSetup(target, "2026-12-10T09:55:00Z", ["step=schedule", "result=declined"]);
  const setup = await expectNext(null, 9, null);
  assert.deepEqual(setup.recorded, {
    "notion-mcp": "2026-12-10T09:10:00Z", "minutes-prompt": "2026-12-10T09:20:00Z", "brain-assistant": "2026-12-10T09:30:00Z",
    seeding: "2026-12-10T09:40:00Z", "first-value": "2026-12-10T09:50:00Z", schedule: "2026-12-10T09:55:00Z",
  });
  assert.equal(setup.finished, false);

  await logSetup(target, "2026-12-10T10:00:00Z", ["step=finished", "result=done"]);
  const done = await status(target, home);
  assert.equal(done.data.setup.finished, true);
  assert.deepEqual([done.data.setup.next, done.data.setup.required], [null, { done: 9, total: 9 }]);
  assert.equal(done.human.split("\n")[0], "Owner: Test Owner");
});

/** A brain whose setup has reached first value (setup.md §2 step 7): every check passes, every step before it is recorded. */
async function brainAtFirstValue(context: TestContext): Promise<{ home: string; target: string }> {
  const { home, target } = await freshBrain(context);
  await git(target, ["init", "-q"]);
  await git(target, ["config", "user.name", "Test Owner"]);
  await git(target, ["config", "user.email", "owner@example.test"]);
  await git(target, ["remote", "add", "origin", "git@example.test:owner/brain.git"]);
  await mkdir(join(home, "drop"));
  await appendRules(target, `Drop folder: ${join(home, "drop")}\nLanguage: English`);
  await connectDatabases(target);
  await addOwnerPerson(target);
  for (const [minute, step] of ["notion-mcp", "minutes-prompt", "brain-assistant", "seeding"].entries()) {
    await logSetup(target, `2026-12-10T09:0${minute}:00Z`, [`step=${step}`, "result=done"]);
  }
  const { data } = await status(target, home);
  assert.deepEqual([data.setup.next, data.setup.required], ["first-value", { done: 9, total: 9 }]);
  return { home, target };
}

test("first value is recorded only by a passing line: a result=done line with a failed or missing check is unresolved (setup.md §5, §10; cli.md §5.2)", async (context) => {
  const { home, target } = await brainAtFirstValue(context);
  const expectUnresolved = async (firstValue: unknown) => {
    const { data, human } = await status(target, home);
    assert.equal(data.setup.recorded["first-value"], null);
    assert.equal(data.setup.next, "first-value");
    assert.deepEqual(data.setup.first_value, firstValue);
    assert.equal(human.split("\n")[0], `Setup: 9 of 9 done · next: check first value · ${SET_UP}`);
  };

  // A result=done line with a check that failed.
  await logSetup(target, "2026-12-10T10:00:00Z", ["step=first-value", "result=done", "tasks=pass", "report=pass", "organised=fail", "answer=pass"]);
  await expectUnresolved({ at: "2026-12-10T10:00:00Z", tasks: "pass", report: "pass", organised: "fail", answer: "pass" });
  // CC-188's form: three checks, no answer. Never read as success.
  await logSetup(target, "2026-12-10T10:05:00Z", ["step=first-value", "result=done", "tasks=pass", "report=pass", "organised=pass"]);
  await expectUnresolved({ at: "2026-12-10T10:05:00Z", tasks: "pass", report: "pass", organised: "pass", answer: null });
  // An unresolved attempt as CC-213's contract writes it.
  await logSetup(target, "2026-12-10T10:10:00Z", ["step=first-value", "result=failed", "reason=first-value-unresolved", "tasks=pass", "report=pass", "organised=fail", "answer=unsuitable"]);
  await expectUnresolved({ at: "2026-12-10T10:10:00Z", tasks: "pass", report: "pass", organised: "fail", answer: "unsuitable" });
  // Every check passes, but the line says failed: still unresolved.
  await logSetup(target, "2026-12-10T10:15:00Z", ["step=first-value", "result=failed", "reason=first-value-unresolved", "tasks=pass", "report=pass", "organised=pass", "answer=pass"]);
  await expectUnresolved({ at: "2026-12-10T10:15:00Z", tasks: "pass", report: "pass", organised: "pass", answer: "pass" });
  // The user stopped after one check: the others are left out of the line and read null.
  await logSetup(target, "2026-12-10T10:20:00Z", ["step=first-value", "result=failed", "reason=first-value-unresolved", "report=pass"]);
  await expectUnresolved({ at: "2026-12-10T10:20:00Z", tasks: null, report: "pass", organised: null, answer: null });
  // Any value but the four is reported as fail, and skip counts only for tasks.
  await logSetup(target, "2026-12-10T10:25:00Z", ["step=first-value", "result=done", "tasks=pass", "report=skip", "organised=yes", "answer=PASS"]);
  await expectUnresolved({ at: "2026-12-10T10:25:00Z", tasks: "pass", report: "fail", organised: "fail", answer: "fail" });

  // A later passing line resolves it, and next moves to the schedule.
  await logSetup(target, "2026-12-10T10:30:00Z", ["step=first-value", "result=done", "tasks=pass", "report=pass", "organised=pass", "answer=pass"]);
  let { data, human } = await status(target, home);
  assert.equal(data.setup.recorded["first-value"], "2026-12-10T10:30:00Z");
  assert.equal(data.setup.next, "schedule");
  assert.deepEqual(data.setup.first_value, { at: "2026-12-10T10:30:00Z", tasks: "pass", report: "pass", organised: "pass", answer: "pass" });
  assert.equal(human.split("\n")[0], `Setup: 9 of 9 done · next: choose the schedule · ${SET_UP}`);

  // The latest line is the state: a later unresolved attempt undoes it (setup.md §4.1).
  await logSetup(target, "2026-12-10T10:35:00Z", ["step=first-value", "result=failed", "reason=first-value-unresolved", "tasks=fail", "report=pass", "organised=pass", "answer=pass"]);
  ({ data } = await status(target, home));
  assert.deepEqual([data.setup.recorded["first-value"], data.setup.next, data.setup.first_value.tasks], [null, "first-value", "fail"]);
});

test("a tasks check skipped passes first value only while the Tasks module is off (setup.md §10)", async (context) => {
  const { home, target } = await brainAtFirstValue(context);
  await logSetup(target, "2026-12-10T10:00:00Z", ["step=first-value", "result=done", "tasks=skip", "report=pass", "organised=pass", "answer=pass"]);
  let { data } = await status(target, home);
  assert.deepEqual([data.setup.recorded["first-value"], data.setup.next, data.setup.first_value.tasks], [null, "first-value", "skip"]);

  await editConfig(target, (config) => { config.modules.tasks = false; });
  ({ data } = await status(target, home));
  assert.deepEqual([data.setup.recorded["first-value"], data.setup.next, data.setup.first_value.tasks], ["2026-12-10T10:00:00Z", "schedule", "skip"]);

  // Turned on again, the skipped check no longer passes.
  await editConfig(target, (config) => { config.modules.tasks = true; });
  ({ data } = await status(target, home));
  assert.deepEqual([data.setup.recorded["first-value"], data.setup.next], [null, "first-value"]);
});

test("status reads a step's latest setup line across month files: a later failure undoes an earlier done (setup.md §4.1)", async (context) => {
  const { home, target } = await freshBrain(context);
  await logSetup(target, "2026-11-30T23:00:00Z", ["step=notion-mcp", "result=done"]);
  await logSetup(target, "2026-11-30T23:10:00Z", ["step=minutes-prompt", "result=done"]);
  await logSetup(target, "2026-12-01T08:00:00Z", ["step=notion-mcp", "result=failed", "reason=notion-unreachable"]);
  await logSetup(target, "2026-12-01T08:05:00Z", ["step=first-meeting", "result=done"]);
  const { data } = await status(target, home);
  assert.equal(data.setup.recorded["notion-mcp"], null);
  assert.equal(data.setup.recorded["minutes-prompt"], "2026-11-30T23:10:00Z");
  assert.deepEqual(data.setup.required, { done: 1, total: 9 });
  await logSetup(target, "2026-12-02T08:00:00Z", ["step=notion-mcp", "result=done"]);
  assert.equal((await status(target, home)).data.setup.recorded["notion-mcp"], "2026-12-02T08:00:00Z");
});

test("without Notion AI, status counts 7 required items and leaves the minutes prompt and Brain Assistant out (setup.md §13)", async (context) => {
  const { home, target } = await freshBrain(context);
  await git(target, ["init", "-q"]);
  await git(target, ["config", "user.name", "Test Owner"]);
  await git(target, ["config", "user.email", "owner@example.test"]);
  await git(target, ["remote", "add", "origin", "git@example.test:owner/brain.git"]);
  await mkdir(join(home, "drop"));
  await appendRules(target, `Drop folder: ${join(home, "drop")}\nLanguage: English`);
  await connectDatabases(target);
  await logSetup(target, "2026-12-10T09:00:00Z", ["step=prerequisites", "result=done", "notion_ai=no", "custom_agents=no"]);
  await logSetup(target, "2026-12-10T09:01:00Z", ["step=prerequisites", "result=done", "notion_ai=yes", "custom_agents=no"]);
  await logSetup(target, "2026-12-10T09:10:00Z", ["step=notion-mcp", "result=done"]);
  let { data, human } = await status(target, home);
  assert.deepEqual(data.setup.required, { done: 6, total: 9 });
  assert.equal(data.setup.next, "minutes-prompt");

  // The latest prerequisites line decides; a minutes-prompt or brain-assistant line then counts for nothing.
  await logSetup(target, "2026-12-10T09:11:00Z", ["step=prerequisites", "result=done", "notion_ai=no", "custom_agents=no"]);
  await logSetup(target, "2026-12-10T09:20:00Z", ["step=brain-assistant", "result=done"]);
  ({ data, human } = await status(target, home));
  assert.deepEqual(data.setup.required, { done: 6, total: 7 });
  assert.equal(data.setup.next, "owner_person");
  assert.equal(human.split("\n")[0], `Setup: 6 of 7 done · next: set your identities · ${SET_UP}`);
  await addOwnerPerson(target);
  ({ data } = await status(target, home));
  assert.deepEqual(data.setup.required, { done: 7, total: 7 });
  assert.equal(data.setup.next, "seeding");
});

test("the drop folder and language are read only after the rules block's end and outside HTML comments; the first Drop folder line counts (setup.md §5)", async (context) => {
  const { home, target } = await freshBrain(context);
  await mkdir(join(home, "first"));
  await mkdir(join(home, "second"));
  const path = join(target, "AGENTS.md");
  const shipped = await readFile(path, "utf8");
  const end = "<!-- ultimate-brain:rules:end -->";
  // Above the end marker, and inside a comment below it (the template's own example is one): neither counts.
  await writeFile(path, shipped.replace(end, `Drop folder: ${join(home, "first")}\nLanguage: English\n${end}`).concat(`<!--\nDrop folder: ${join(home, "first")}\nLanguage: English\n-->\n`));
  assert.deepEqual(pick((await status(target, home)).data.setup.checks), [false, false]);
  // The first line below the marker counts, even when a later one names an existing folder.
  await writeFile(path, `${shipped}\nDrop folder: ${join(home, "missing")}\nDrop folder: ${join(home, "second")}\nLanguage: Español\n`);
  assert.deepEqual(pick((await status(target, home)).data.setup.checks), [false, true]);
  await writeFile(path, `${shipped}\nDrop folder: \`~/second\`\n`);
  assert.deepEqual(pick((await status(target, home)).data.setup.checks), [true, false]);
  // A file is not a folder.
  await writeFile(join(home, "a-file"), "");
  await writeFile(path, `${shipped}\nDrop folder: ~/a-file\n`);
  assert.deepEqual(pick((await status(target, home)).data.setup.checks), [false, false]);
});

function pick(checks: Record<string, boolean>): [boolean, boolean] {
  return [checks.drop_folder!, checks.language!];
}

test("remote passes only for the brain's own repository with an origin URL, not a parent folder's (setup.md §5)", async (context) => {
  const { home, target } = await freshBrain(context);
  await git(home, ["init", "-q"]);
  await git(home, ["remote", "add", "origin", "git@example.test:owner/parent.git"]);
  assert.equal((await status(target, home)).data.setup.checks.remote, false);
  await git(target, ["init", "-q"]);
  assert.equal((await status(target, home)).data.setup.checks.remote, false);
  await git(target, ["remote", "add", "origin", "git@example.test:owner/brain.git"]);
  assert.equal((await status(target, home)).data.setup.checks.remote, true);
});

test("databases follows the modules on, and owner_person needs an existing person note (setup.md §5)", async (context) => {
  const { home, target } = await freshBrain(context);
  await connectDatabases(target);
  assert.equal((await status(target, home)).data.setup.checks.databases, true);
  await editConfig(target, (config) => { config.notion.tasks.database = ""; });
  assert.equal((await status(target, home)).data.setup.checks.databases, false);
  await editConfig(target, (config) => { config.modules.tasks = false; });
  assert.equal((await status(target, home)).data.setup.checks.databases, true);
  await editConfig(target, (config) => { config.modules.planning = true; });
  assert.equal((await status(target, home)).data.setup.checks.databases, false);
  await editConfig(target, (config) => { config.modules.planning = false; config.notion.databases.review = ""; });
  assert.equal((await status(target, home)).data.setup.checks.databases, false);

  await editConfig(target, (config) => { config.owner.person = "per-4k7m2q9x"; });
  assert.equal((await status(target, home)).data.setup.checks.owner_person, false);
  await addOwnerPerson(target);
  assert.equal((await status(target, home)).data.setup.checks.owner_person, true);
});

test("a brain connected before 0.14.0, with no setup line, is finished: no setup line in human output, template version unknown (setup.md §3, §5)", async (context) => {
  const target = await fixtureCopy(context);
  await editConfig(target, (config) => {
    config.owner.person = "per-9t2c6m4a";
    config.notion.databases.inbox = DB(1);
    config.notion.databases.documents = DB(2);
  });
  const { data, human } = await status(target, tmpdir());
  assert.equal(data.setup.finished, true);
  assert.equal(data.setup.template_version, null);
  assert.equal(data.setup.checks.databases, true);
  assert.equal(data.setup.checks.owner_person, true);
  assert.equal(data.setup.checks.language, false);
  assert.equal(human.split("\n")[0], "Owner: Alex Example");

  // The same brain once "set up my brain" has run on it: its setup lines decide, until a finished line.
  await logSetup(target, "2026-12-10T09:00:00Z", ["step=started", "result=done"]);
  const started = await status(target, tmpdir());
  assert.equal(started.data.setup.finished, false);
  assert.match(started.human.split("\n")[0]!, /^Setup: \d of 9 done · next: /);
});

test("status reports a set template version as its value (setup.md §9)", async (context) => {
  const { home, target } = await freshBrain(context);
  await editConfig(target, (config) => { config.notion.template_version = "0024"; });
  assert.equal((await status(target, home)).data.setup.template_version, "0024");
});

// --- upgrade: the Notion migrations newer than the template (cli.md §5.15, setup.md §9) ---

/** A published package with Notion migrations 0023 to 0025 (and files that aren't migrations). */
async function productWithMigrations(context: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "brain-product-")));
  context.after(() => rm(root, { recursive: true, force: true }));
  await cp(await testPackageRoot(), root, { recursive: true });
  const migrations = join(root, "notion", "migrations");
  await mkdir(migrations, { recursive: true });
  for (const name of ["0023-first.md", "0024-second.md", "0025-third.md", "README.md", "026-short.md", "0026-draft.txt"]) await writeFile(join(migrations, name), "# synthetic\n");
  return root;
}

test("upgrade names the package's Notion migrations newer than the template version, read only, dry run included (cli.md §5.15)", async (context) => {
  const product = await productWithMigrations(context);
  const { home, target } = await freshBrain(context);
  const migrations = join(product, "notion", "migrations");

  await editConfig(target, (config) => { config.notion.template_version = "0023"; });
  for (const dry of [true, false]) {
    const json = await brain(["upgrade", "--brain", target, ...(dry ? ["--dry-run"] : []), "--now", NOW, "--json"], home, product);
    assert.equal(json.code, 0, json.stdout);
    assert.deepEqual(json.json.data.notion_migrations, { template_version: "0023", newer: ["0024-second.md", "0025-third.md"] });
  }
  const human = await brain(["upgrade", "--brain", target, "--now", NOW], home, product);
  assert.equal(human.code, 0, human.stderr);
  assert.equal(human.stdout.split("\n")[1],
    `Notion: 2 migrations newer than your space: ${join(migrations, "0024-second.md")}, ${join(migrations, "0025-third.md")}. Ask your agent to apply them ("apply the Notion migrations").`);
  // Upgrade never writes the version.
  assert.equal(JSON.parse(await readFile(join(target, "brain.json"), "utf8")).notion.template_version, "0023");

  await editConfig(target, (config) => { config.notion.template_version = "0024"; });
  const one = await brain(["upgrade", "--brain", target, "--now", NOW], home, product);
  assert.equal(one.stdout.split("\n")[1], `Notion: 1 migration newer than your space: ${join(migrations, "0025-third.md")}. Ask your agent to apply them ("apply the Notion migrations").`);

  await editConfig(target, (config) => { config.notion.template_version = "0025"; });
  const current = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], home, product);
  assert.deepEqual(current.json.data.notion_migrations, { template_version: "0025", newer: [] });
  const currentHuman = await brain(["upgrade", "--brain", target, "--now", NOW], home, product);
  assert.equal(currentHuman.stdout.split("\n")[1], "Notion: your space has every migration (template 0025).");
});

test("upgrade with no template version reports it unknown and names no migration (cli.md §5.15, setup.md §9)", async (context) => {
  const product = await productWithMigrations(context);
  const { home, target } = await freshBrain(context);
  const json = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], home, product);
  assert.equal(json.code, 0, json.stdout);
  assert.deepEqual(json.json.data.notion_migrations, { template_version: null, newer: null });
  const human = await brain(["upgrade", "--brain", target, "--now", NOW], home, product);
  assert.equal(human.stdout.split("\n")[1],
    `Notion: template version unknown, so upgrade can't tell which migrations your space needs; ask your agent which ones apply (${join(product, "notion", "migrations")}/).`);
});
