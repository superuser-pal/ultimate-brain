// A Factory as a workflow's destination (CC-397; spec/connected-workflows.md §2, §3.5, §4.1, §8.4, §12; decision 0113 §3, §4, §7).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { committedFixture } from "./fixture-templates.ts";
import { brain } from "./helpers.ts";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const AREA = "area-2m7c4h8n";
const PROJECT = "prj-9x4t1b7e";
const AREA_PAGE = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const ROW = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1aff";
const STATUS_MAP = { todo: "To Do", in_progress: "Doing", waiting: "Waiting On", review: "Review", done: "Done", dropped: "Won't Do" };
const page = (n: number) => `6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a${n.toString(16).padStart(2, "0")}`;

interface Task { page: string; brain_id: string | null; title: string; status: string | null; archived: boolean; in_trash: boolean; edited: string; factory?: boolean }
/** A task as the snapshot has it, with a Factory unless `factory: undefined`. */
const task = (n: number, title: string, status: string | null = "To Do", extra: Partial<Task> = {}): Task =>
  ({ page: page(n), brain_id: null, title, status, archived: false, in_trash: false, edited: "2026-12-10T08:00:00Z", factory: true, ...extra });

async function temp(context: TestContext): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), "brain-workflow-factory-")));
  context.after(() => rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  return path;
}

/** A brain with Factories on, and the folder of a linked repo (`acme-api`) and of a plain folder, each a Factory. */
async function setup(context: TestContext, edit: (config: any) => void = () => {}) {
  const repo = await temp(context);
  const folder = await temp(context);
  const dir = await committedFixture(context, { message: "workflow factory", edit: (config) => {
    config.modules = { tasks: true, documents: true, factories: true };
    config.notion.databases.factories = "a1000000-0000-4000-8000-0000000000fa";
    config.notion.tasks.properties.factory = "Factory";
    config.repos = [{ name: "acme-api", path: repo, area: AREA, projects: [PROJECT], patterns: ["*.md"], commit: "" }];
    config.factories = [{ id: "fac-7k2m9q4x", name: "acme-api", repo: "acme-api" }, { id: "fac-3n6q8v2b", name: "Workshop kit", path: folder, area: AREA, projects: [] }];
    edit(config);
  } });
  const call = (args: string[], now = NOW) => brain([...args, "--brain", dir, "--now", now, "--json"]);
  const ok = async (args: string[], now = NOW) => {
    const result = await call(args, now);
    assert.equal(result.code, 0, `${args.join(" ")}: ${result.stdout}`);
    return result.json.data;
  };
  let counter = 0;
  const file = async (value: unknown) => {
    const path = join(dirname(dir), `input-${counter++}.json`);
    await writeFile(path, JSON.stringify(value));
    return path;
  };
  const git = async (...args: string[]) => (await exec("git", ["-C", dir, ...args])).stdout.trim();
  const config = async () => JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  const create = async (over: Record<string, unknown> = {}) => call(["workflow", "new", "--input", await file({
    folder_path: folder, opted_in: { statement: "Connect it" }, destination: { factory: "fac-3n6q8v2b" }, settings: { work_type: "general", logging: "tasks_only", custom: [] }, status_map: STATUS_MAP, ...over })]);
  const connect = async (over: Record<string, unknown> = {}) => {
    const result = await create(over);
    assert.equal(result.code, 0, result.stdout);
    return result.json.data.id as string;
  };
  const show = (wf: string) => ok(["workflow", "show", wf]);
  const set = async (wf: string, input: unknown) => call(["workflow", "set", wf, "--rev", String((await show(wf)).workflow.rev), "--input", await file(input)]);
  const put = async (wf: string, input: Record<string, unknown>, now = NOW) => call(["workflow", "item", "put", wf, "--input", await file(input)], now);
  const take = (wf: string, of: Task, over: Record<string, unknown> = {}) => put(wf, {
    title: of.title, scope: "As agreed", acceptance: [{ text: "It works", met_at: null, evidence: null }], approve: true, status: "in_progress",
    task: { page: of.page, title: of.title, status: of.status, brain_id: of.brain_id }, ...over });
  const reconcile = async (wf: string, tasks: Task[], destination: Record<string, unknown> = {}, now = NOW) =>
    call(["workflow", "reconcile", wf, "--input", await file({ read_at: now, destination: { page: ROW, workflow: "Connected", ...destination }, tasks })], now);
  const reconcileOk = async (wf: string, tasks: Task[], destination: Record<string, unknown> = {}, now = NOW) => {
    const result = await reconcile(wf, tasks, destination, now);
    assert.equal(result.code, 0, result.stdout);
    return result.json.data;
  };
  return { dir, repo, folder, call, ok, file, git, config, create, connect, show, set, put, take, reconcile, reconcileOk };
}

const code = (result: { json: any }) => result.json?.error?.code;
const pointer = (result: { json: any }) => result.json?.error?.details?.[0]?.pointer;
const FULL = { work_type: "Software", logging_level: "Full durable record", log_artifacts: [] };

// ---------------------------------------------------------------- new (§3.5, §12)

test("workflow new: a Factory as the destination, its record and its pointer; a linked repo's sets folder.repo", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const { workflow } = await c.show(wf);
  assert.deepEqual([workflow.destination, workflow.state, Object.hasOwn(workflow.folder, "repo")], [{ factory: "fac-3n6q8v2b" }, "connected", false]);
  assert.deepEqual(JSON.parse(await readFile(join(c.folder, ".brain-workflow.json"), "utf8")), { workflow: wf });
  const linked = await c.connect({ folder_path: c.repo, destination: { factory: "fac-7k2m9q4x" } });
  assert.equal((await c.show(linked)).workflow.folder.repo, "acme-api");
  assert.deepEqual((await c.ok(["workflow", "find", "--destination", "fac-3n6q8v2b"])).workflows.map((entry: { id: string }) => entry.id), [wf]);
});

test("workflow new refuses: the module off, the relation not mapped, an unknown or archived Factory, another folder, a Factory already connected", async (context) => {
  const c = await setup(context);
  assert.deepEqual([code(await c.create({ destination: { factory: "fac-00000000" } })), code(await c.create({ folder_path: c.repo }))], ["UNKNOWN_ID", "INPUT_INVALID"]);
  assert.equal(pointer(await c.create({ folder_path: c.repo })), "/folder_path");
  assert.equal(code(await c.create({ destination: { factory: "fac-3n6q8v2b", project: PROJECT } })), "INPUT_INVALID");
  await c.connect();
  assert.equal(code(await c.create()), "DESTINATION_TAKEN");
  await rm(join(c.folder, ".brain-workflow.json"));
  assert.equal(code(await c.create()), "DESTINATION_TAKEN", "with no pointer either");

  const off = await setup(context, (config) => { config.modules.factories = false; });
  assert.equal(code(await off.create()), "MODULE_OFF");
  const unmapped = await setup(context, (config) => { config.notion.tasks.properties.factory = ""; });
  assert.equal(code(await unmapped.create()), "BRAIN_CONFIG_INVALID");
  const archived = await setup(context, (config) => { config.factories[1].archived = true; });
  assert.equal(code(await archived.create()), "UNKNOWN_ID");
});

// ---------------------------------------------------------------- set: move and end (§3.5)

test("workflow set moves a Project's workflow to its folder's own Factory: ids kept, nothing else a destination, and nothing moves back", async (context) => {
  const c = await setup(context);
  const wf = await c.connect({ folder_path: c.repo, folder: { repo: "acme-api" }, destination: { project: PROJECT } });
  const made = await c.put(wf, { title: "From the plan", scope: "x", acceptance: [] });
  assert.equal(made.code, 0, made.stdout);
  const before = await c.show(wf);
  assert.equal(pointer(await c.set(wf, { destination: { area: AREA } })), "/destination");
  assert.equal(pointer(await c.set(wf, { destination: { factory: "fac-3n6q8v2b" } })), "/destination", "another folder's Factory");
  const moved = await c.set(wf, { destination: { factory: "fac-7k2m9q4x" } });
  assert.equal(moved.code, 0, moved.stdout);
  const after = await c.show(wf);
  assert.deepEqual([after.workflow.destination, after.workflow.folder.repo], [{ factory: "fac-7k2m9q4x" }, "acme-api"]);
  assert.deepEqual(after.items, before.items);
  assert.equal(pointer(await c.set(wf, { destination: { project: PROJECT } })), "/destination");

  const plain = await c.connect({ destination: { area: AREA } });
  assert.equal((await c.set(plain, { destination: { factory: "fac-3n6q8v2b" } })).code, 0, "a plain folder is known by its pointer");
});

test("ending a plain folder's workflow archives its Factory in the same commit; a linked repo's stays", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const linked = await c.connect({ folder_path: c.repo, destination: { factory: "fac-7k2m9q4x" } });
  const ended = await c.set(wf, { state: "ended" });
  assert.equal(ended.code, 0, ended.stdout);
  assert.equal((await c.config()).factories[1].archived, true);
  assert.ok((await c.git("show", "--name-only", "--format=", "HEAD")).split("\n").includes("brain.json"));
  assert.equal(await c.git("status", "--porcelain"), "");
  assert.equal((await c.set(linked, { state: "ended" })).code, 0);
  assert.equal((await c.config()).factories[0].archived, undefined);
});

// ---------------------------------------------------------------- reconcile (§4.1, §8.4)

test("the snapshot's destination is the short form for a Factory alone", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  assert.equal(pointer(await c.reconcile(wf, [], FULL)), "/destination");
  const project = await c.connect({ folder_path: c.repo, folder: { repo: "acme-api" }, destination: { project: PROJECT } });
  assert.equal(pointer(await c.reconcile(project, [])), "/destination");
  assert.equal((await c.reconcile(project, [], FULL)).code, 0);
});

test("reconcile: Standard, empty or an archived Factory pauses, Connected resumes, and no other setting is copied", async (context) => {
  const c = await setup(context);
  const wf = await c.connect({ folder_path: c.repo, destination: { factory: "fac-7k2m9q4x" }, settings: { work_type: "software", logging: "full", custom: [] } });
  const settings = async () => { const { read_at: _at, ...rest } = (await c.show(wf)).workflow.settings; return rest; };
  const before = await settings();
  for (const [workflow, state] of [["Standard", "paused"], ["Connected", "connected"], [null, "paused"], ["connected", "connected"]] as const) {
    await c.reconcileOk(wf, [], { workflow });
    assert.equal((await c.show(wf)).workflow.state, state, String(workflow));
  }
  assert.deepEqual(await settings(), before);
  const config = await c.config();
  config.factories[0].archived = true;
  await writeFile(join(c.dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  await c.git("commit", "-q", "-a", "-m", "archived");
  const data = await c.reconcileOk(wf, []);
  assert.equal((await c.show(wf)).workflow.state, "paused");
  assert.equal(data.routine.some((change: any) => JSON.stringify(change).includes("settings")), false);
});

test("reconcile refuses with MODULE_OFF while Factories is off, and the workflow is neither ended nor changed", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const before = await c.show(wf);
  await c.ok(["modules", "off", "factories"]);
  await c.git("commit", "-q", "-a", "-m", "off");
  assert.equal(code(await c.reconcile(wf, [])), "MODULE_OFF");
  assert.deepEqual(await c.show(wf), before);
  assert.equal((await c.call(["workflow", "set", wf, "--rev", String(before.workflow.rev), "--input", await c.file({ settings: { work_type: "software" } })])).code, 0, "the session works locally");
});

test("a task with a Factory and no Brain ID is the user's instruction: no UNKNOWN_TASK, no operation, no change, whoever's workflow reads it", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const data = await c.reconcileOk(wf, [task(1, "Speed up login"), task(2, "An action item", "To Do", { brain_id: "mtg-5r2k8v3a" }), task(3, "No relation any more", "To Do", { factory: undefined })]);
  assert.deepEqual([data.needs_you, data.ops, data.routine], [[], [], []]);
  assert.deepEqual((await c.show(wf)).items, []);

  // Under a Project connected elsewhere, the same task is not that workflow's question; one with no Factory still is.
  const project = await c.connect({ folder_path: c.repo, folder: { repo: "acme-api" }, destination: { project: PROJECT } });
  const other = await c.reconcileOk(project, [task(1, "Speed up login"), task(4, "By hand under the Project", "To Do", { factory: undefined }), task(5, "Not a Factory's", "To Do", { factory: false })], FULL);
  assert.deepEqual(other.needs_you.map((entry: any) => entry.kind), ["UNKNOWN_TASK", "UNKNOWN_TASK"]);
  assert.equal(JSON.stringify(other.needs_you).includes(page(1)), false);
});

test("reconcile: open_tasks lists To Do, Doing and empty, in progress first, with the item, the claim and elsewhere", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const taken = task(2, "Taken here", "Doing");
  const item = await c.take(wf, taken);
  assert.equal(item.code, 0, item.stdout);
  const id = (await c.show(wf)).items[0].id;
  await c.ok(["workflow", "item", "claim", wf, id, "--by", "Claude Code"]);
  const data = await c.reconcileOk(wf, [
    task(1, "To choose"), taken, task(3, "No status", null), task(11, "Empty status", ""), task(4, "Some day", "Someday"), task(5, "Waiting", "Waiting On"), task(6, "Finished", "Done"),
    task(7, "Archived", "To Do", { archived: true }), task(8, "In the trash", "To Do", { in_trash: true }), task(9, "Elsewhere", "doing", { brain_id: "wi-7k2m9q4x" }), task(10, "Left the Factory", "To Do", { factory: undefined }),
  ]);
  assert.deepEqual(data.open_tasks.map((entry: any) => [entry.title, entry.meaning, entry.item, entry.claim === null, entry.elsewhere]), [
    ["Taken here", "in_progress", id, false, false], ["Elsewhere", "in_progress", null, true, true], ["To choose", "todo", null, true, false], ["No status", "todo", null, true, false], ["Empty status", "todo", null, true, false],
  ]);
  assert.equal(data.open_tasks[0].claim.by, "Claude Code");
  assert.deepEqual(Object.keys(data.open_tasks[0]), ["page", "title", "meaning", "item", "claim", "elsewhere"]);
  const project = await c.connect({ folder_path: c.repo, folder: { repo: "acme-api" }, destination: { project: PROJECT } });
  assert.equal(Object.hasOwn(await c.reconcileOk(project, [], FULL), "open_tasks"), false, "a Factory's alone");
});

test("a task under a Project that isn't the Factory's stays the Factory's: listed, taken and reconciled as any other", async (context) => {
  // The snapshot carries no Project: the Factory relation alone puts a task there (§8.4), so `acme-api`'s Projects are never read here.
  const c = await setup(context, (config) => { config.repos[0].projects = []; });
  const wf = await c.connect({ folder_path: c.repo, destination: { factory: "fac-7k2m9q4x" } });
  const other = task(1, "Under another Project");
  assert.deepEqual((await c.reconcileOk(wf, [other])).open_tasks.map((entry: any) => entry.page), [other.page]);
  assert.equal((await c.take(wf, other)).code, 0);
  const data = await c.reconcileOk(wf, [other]);
  assert.deepEqual(data.needs_you, []);
  const [op] = (await c.show(wf)).ops;
  assert.deepEqual([op.kind, Object.hasOwn(op.payload, "project")], ["update_task", false]);
});

// ---------------------------------------------------------------- taking a task (§8.4)

test("item put with task: one command saves the item, its origin and its page; the next reconcile sends the Brain ID and Doing", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const mine = task(1, "Speed up login");
  assert.equal((await c.take(wf, mine)).code, 0);
  const [item] = (await c.show(wf)).items;
  assert.deepEqual(item.origin, { kind: "notion", ref: "tasks", key: mine.page });
  assert.deepEqual(item.notion, { page: mine.page, title: mine.title, status: "To Do", read_at: NOW });
  assert.deepEqual([item.title, item.status, item.approved_at], ["Speed up login", "in_progress", NOW]);
  await c.reconcileOk(wf, [mine]);
  const ops = (await c.show(wf)).ops;
  assert.deepEqual(ops.map((op: any) => op.kind), ["update_task"]);
  assert.deepEqual([ops[0].payload.brain_id, ops[0].payload.status, ops[0].target], [item.id, "Doing", item.id]);
  assert.equal(ops.some((op: any) => op.kind === "create_task"), false, "its task exists already");
});

test("item put on a Factory: only from a task or with the user's yes; the title is the task's; a malformed task names its pointer", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const mine = task(1, "Speed up login");
  const base = { title: "Speed up login", scope: "x", acceptance: [] };
  assert.equal(pointer(await c.put(wf, base)), "/approve");
  assert.equal((await c.put(wf, { ...base, title: "Agreed here", approve: true })).code, 0);
  assert.equal(pointer(await c.take(wf, mine, { title: "Another title" })), "/title");
  for (const [bad, at] of [[{ page: "x" }, "/task/page"], [{ title: 1 }, "/task/title"], [{ status: 1 }, "/task/status"], [{ brain_id: 1 }, "/task/brain_id"], [{ more: 1 }, "/task/more"]] as const) {
    assert.equal(pointer(await c.take(wf, mine, { task: Object.assign({ page: mine.page, title: mine.title, status: "To Do", brain_id: null }, bad) })), at);
  }
  const project = await c.connect({ folder_path: c.repo, folder: { repo: "acme-api" }, destination: { project: PROJECT } });
  assert.equal((await c.put(project, base)).code, 0, "a Project's workflow needs no approve");
  assert.equal(pointer(await c.take(project, mine)), "/task", "task is a Factory's alone");
});

test("TASK_TAKEN: an item of any open workflow has the page, or the Brain ID is a wi- id; nothing is written", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const mine = task(1, "Speed up login");
  assert.equal((await c.take(wf, mine)).code, 0);
  const id = (await c.show(wf)).items[0].id;
  await c.ok(["workflow", "item", "claim", wf, id, "--by", "Codex"]);
  const other = await c.connect({ folder_path: c.repo, destination: { factory: "fac-7k2m9q4x" } });
  const head = await c.git("rev-parse", "HEAD");
  const second = await c.take(other, { ...mine, page: mine.page.replaceAll("-", "") });
  assert.equal(code(second), "TASK_TAKEN");
  assert.deepEqual([second.json.error.details.workflow, second.json.error.details.item, second.json.error.details.holder.by], [wf, id, "Codex"]);
  const elsewhere = await c.take(other, task(2, "Elsewhere", "To Do", { brain_id: "wi-7k2m9q4x" }));
  assert.deepEqual([code(elsewhere), elsewhere.json.error.details], ["TASK_TAKEN", { workflow: null, item: null, holder: null }]);
  assert.equal(await c.git("rev-parse", "HEAD"), head);
  assert.equal((await c.take(other, task(3, "A meeting's", "To Do", { brain_id: "mtg-5r2k8v3a" }))).code, 0, "another kind of Brain ID holds nothing");
  // The workflow ended: its task is free again.
  assert.equal((await c.set(wf, { state: "ended" })).code, 0);
  // But a Brain ID that is one of its items' still holds it, whatever the page (§8.4).
  const held = await c.take(other, { ...mine, page: page(4), brain_id: id });
  assert.deepEqual([code(held), held.json.error.details.workflow, held.json.error.details.item], ["TASK_TAKEN", wf, id]);
  assert.equal((await c.take(other, mine)).code, 0);
});

test("the user's status wins: changed on both sides, Notion's is adopted with no question, accepted and the claim cleared", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const mine = task(1, "Speed up login");
  await c.take(wf, mine);
  const id = (await c.show(wf)).items[0].id;
  await c.ok(["workflow", "item", "claim", wf, id, "--by", "Claude Code"]);
  // The record says Doing since the take; meanwhile the user set Done.
  const data = await c.reconcileOk(wf, [{ ...mine, status: "Done" }]);
  assert.deepEqual(data.needs_you, []);
  const [item] = (await c.show(wf)).items;
  assert.deepEqual([item.status, item.accepted.statement, item.claim], ["done", "Set to Done in Notion", null]);
  assert.equal((await c.show(wf)).ops.some((op: any) => op.payload?.status === "Doing"), false, "the agent's status isn't sent over the user's");
});

test("a task taken with an empty status keeps the user's later status", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const mine = task(1, "Speed up login", null);
  await c.take(wf, mine);
  assert.equal((await c.show(wf)).items[0].notion.status, "");
  const same = await c.reconcileOk(wf, [mine]);
  assert.deepEqual(same.needs_you, []);
  const [op] = (await c.show(wf)).ops;
  assert.equal(op.payload.status, "Doing", "unchanged in Notion: the record's goes out");
  assert.equal((await c.show(wf)).items[0].status, "in_progress");
});

// ---------------------------------------------------------------- what a Factory's workflow never does (§8.4, §9)

test("adopt takes only Notion's own tasks on a Factory: a plan item never becomes a row", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const md = { origin: { kind: "markdown", ref: "PLAN.md", key: "line:5e1a0c9b2d47" }, title: "From the plan", body: "", raw_status: "[ ]", meaning: "todo", depends_on: [], url: null, brain_id: null };
  const notion = { ...md, origin: { kind: "notion", ref: "tasks", key: page(1) }, title: "The user's", raw_status: "To Do" };
  const input = (items: unknown[]) => ({ sources: [{ kind: "markdown", ref: "PLAN.md" }], items, unsupported: [], conventions: [], selected: null, treatments: {}, status_read: {} });
  const preview = async (items: unknown[]) => c.call(["workflow", "adopt", "preview", wf, "--input", await c.file(input(items))]);
  const refused = await preview([notion, md]);
  assert.deepEqual([code(refused), pointer(refused), refused.json.error.details[0].message], ["INPUT_INVALID", "/items/1/origin/kind", "a Factory's plan stays in its folder"]);
  assert.equal((await preview([notion])).code, 0);
  const apply = await c.call(["workflow", "adopt", "apply", wf, "--rev", "1", "--input", await c.file(input([md]))]);
  assert.equal(pointer(apply), "/items/0/origin/kind");
});

test("workflow summary refuses a Factory's workflow and names factory overview", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const result = await c.call(["workflow", "summary", wf]);
  assert.equal(code(result), "USAGE");
  assert.ok(result.json.error.message.includes("factory overview"));
});

// ---------------------------------------------------------------- render (§6.1, §12; 0113 §9, 0114)

test("workflow render: a new item's task gets the Factory and the Factory's Area, and no Project; one not published waits", async (context) => {
  const c = await setup(context);
  const wf = await c.connect({ folder_path: c.repo, destination: { factory: "fac-7k2m9q4x" } });
  assert.equal((await c.put(wf, { title: "Agreed here", scope: "x", acceptance: [], approve: true })).code, 0);
  const [item] = (await c.show(wf)).items;
  const render = async () => (await c.ok(["workflow", "render", wf, "--item", item.id])).payload;
  const before = await render();
  assert.deepEqual(Object.keys(before.properties), ["Name", "Status", "Area", "Brain ID"]);
  assert.ok(before.pending_relations.some((entry: any) => entry.property === "Factory" && entry.ids[0] === "fac-7k2m9q4x"), JSON.stringify(before));
  await c.ok(["sync", "record", "--input", await c.file({ records: [{ id: "fac-7k2m9q4x", notion: ROW, synced_at: NOW, published: {} }] })]);
  await c.git("commit", "-q", "-a", "-m", "row");
  const after = await render();
  assert.deepEqual(after.properties.Factory, { type: "relation", value: [ROW] });
  assert.deepEqual(after.properties.Area, { type: "relation", value: [AREA_PAGE] });
  assert.equal(Object.hasOwn(after.properties, "Project"), false);
  assert.deepEqual(after.properties["Brain ID"], { type: "rich_text", value: item.id });
});

test("workflow render: a taken task gets its Brain ID when empty, its status and its title, and nothing else", async (context) => {
  const c = await setup(context);
  const wf = await c.connect();
  const mine = task(1, "Speed up login");
  await c.take(wf, mine);
  const [item] = (await c.show(wf)).items;
  const { payload } = await c.ok(["workflow", "render", wf, "--item", item.id]);
  assert.deepEqual([payload.page_id, payload.properties, payload.pending_relations], [mine.page, {
    Name: { type: "title", value: "Speed up login" }, Status: { type: "select", value: "Doing" }, "Brain ID": { type: "rich_text", value: item.id, mode: "if_empty" },
  }, []]);
});

test("workflow render: an item moved with its workflow keeps its page's Area", async (context) => {
  const c = await setup(context, (config) => { config.factories[0].notion = ROW; });
  const wf = await c.connect({ folder_path: c.repo, folder: { repo: "acme-api" }, destination: { project: PROJECT } });
  assert.equal((await c.put(wf, { title: "From before", scope: "x", acceptance: [], approve: true })).code, 0);
  await c.reconcileOk(wf, [], FULL);
  const { ops, items } = await c.show(wf);
  await c.ok(["workflow", "op", "state", wf, ops[0].id, "--state", "in_flight"]);
  await c.ok(["workflow", "op", "state", wf, ops[0].id, "--state", "done", "--page", page(1)]);
  assert.equal((await c.set(wf, { destination: { factory: "fac-7k2m9q4x" } })).code, 0);
  const { payload } = await c.ok(["workflow", "render", wf, "--item", items[0].id]);
  assert.deepEqual(payload.properties.Factory, { type: "relation", value: [ROW] });
  assert.equal(Object.hasOwn(payload.properties, "Project"), false);
  assert.deepEqual(payload.properties.Area, { type: "relation", value: [AREA_PAGE], mode: "if_empty" });
});
