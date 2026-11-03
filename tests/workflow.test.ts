// Black-box tests for `brain workflow` record commands (spec/connected-workflows.md §§2, 3, 5, 6, 7, 9, 10, 12; CC-102 slice 2a).
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { brain, fixtureCopy } from "./helpers.ts";

const exec = promisify(execFile);
const NOW = "2026-11-03T14:20:00Z";
const AREA = "area-2m7c4h8n";
const PRJ = "prj-9x4t1b7e";
const GOL = "gol-4p9r2w6t";
const PER = "per-3h8w2n6c";
const PAGE = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b";
const WF_ID = /^wf-[0-9abcdefghjkmnpqrstvwxyz]{8}$/;
const STATUS_MAP = { todo: "To Do", in_progress: "Doing", waiting: "Waiting On", review: "Doing", done: "Done", dropped: "Won't Do" };
const sha = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

interface Env { dir: string; folder: string; parent: string }
let counter = 0;

async function run(dir: string, args: string[], now = NOW) {
  return brain([...args, "--brain", dir, "--now", now, "--json"]);
}

async function git(dir: string, ...args: string[]) {
  return (await exec("git", ["-C", dir, ...args])).stdout.trim();
}

/** A fixture brain with the Tasks module on, one linked repo, committed as a clean Git repo, plus an empty working folder. */
async function setup(context: TestContext, options: { modules?: Record<string, boolean>; brainId?: string } = {}): Promise<Env> {
  const dir = await fixtureCopy(context);
  const parent = dirname(dir);
  const folder = join(parent, "acme-api");
  await mkdir(folder, { recursive: true });
  const path = join(dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  config.modules = { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true, ...options.modules };
  config.repos = [{ name: "acme-api", path: folder, area: AREA, patterns: ["*.md"], commit: "" }];
  if (options.brainId !== undefined) config.notion.tasks.properties.brain_id = options.brainId;
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  await git(dir, "init", "-q", "-b", "main");
  await git(dir, "config", "user.email", "test@example.com");
  await git(dir, "config", "user.name", "Test");
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "init");
  return { dir, folder, parent };
}

async function file(env: Env, value: unknown): Promise<string> {
  const path = join(env.parent, `in-${++counter}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const exists = (path: string) => access(path).then(() => true, () => false);
const head = (env: Env) => git(env.dir, "rev-parse", "HEAD");
const clean = async (env: Env) => assert.equal(await git(env.dir, "status", "--porcelain"), "", "brain tree is clean");
const errorCode = (result: { json: any }) => result.json?.error?.code;

function newInput(env: Env, over: Record<string, unknown> = {}) {
  return {
    folder_path: env.folder,
    opted_in: { statement: "Connect acme-api's work to Notion" },
    folder: { repo: "acme-api" },
    destination: { project: PRJ },
    relations: { goal: GOL, people: [PER] },
    settings: { work_type: "software", logging: "tasks_and_finals", custom: [] },
    status_map: STATUS_MAP,
    status_read: { Someday: "todo" },
    modules_offered: ["documents"],
    ...over,
  };
}

async function wfNew(env: Env, over: Record<string, unknown> = {}, now = NOW): Promise<any> {
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env, over))], now);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

/** A workflow without the linked repo (the folder holds only the pointer). */
const wfPlain = (env: Env, over: Record<string, unknown> = {}) => wfNew(env, { folder: undefined, ...over });

async function show(env: Env, wf: string): Promise<any> {
  const result = await run(env.dir, ["workflow", "show", wf]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

async function put(env: Env, wf: string, kind: "item" | "artifact", input: unknown, rev?: number, now = NOW) {
  const args = ["workflow", kind, "put", wf, "--input", await file(env, input)];
  if (rev !== undefined) args.push("--rev", String(rev));
  return run(env.dir, args, now);
}

/** Create an item and read it back from `show` (the shape of `item put`'s data is not defined by the spec). */
async function mkItem(env: Env, wf: string, input: Record<string, unknown> & { title: string }): Promise<any> {
  const result = await put(env, wf, "item", { scope: "Scope text", acceptance: [{ text: "Crit one", met_at: null, evidence: null }], ...input });
  assert.equal(result.code, 0, result.stdout);
  return (await show(env, wf)).items.find((item: any) => item.title === input.title);
}

/** Patch an item with the revision it currently has. */
async function patchItem(env: Env, wf: string, id: string, patch: Record<string, unknown>, now = NOW) {
  const current = (await show(env, wf)).items.find((item: any) => item.id === id);
  return put(env, wf, "item", { id, ...patch }, current.rev, now);
}

async function mkArtifact(env: Env, wf: string, input: Record<string, unknown> & { title: string }): Promise<any> {
  const result = await put(env, wf, "artifact", { item: null, category: "final", format: "text", location: { path: `docs/${input.title}.md` }, ...input });
  assert.equal(result.code, 0, result.stdout);
  return (await show(env, wf)).artifacts.find((artifact: any) => artifact.title === input.title);
}

async function approveArtifact(env: Env, wf: string, id: string, extra: Record<string, unknown> = {}) {
  const current = (await show(env, wf)).artifacts.find((artifact: any) => artifact.id === id);
  const result = await put(env, wf, "artifact", { id, approve: true, sha256: sha(`content of ${id}`), ...extra }, current.rev);
  assert.equal(result.code, 0, result.stdout);
  return (await show(env, wf)).artifacts.find((artifact: any) => artifact.id === id);
}

function snapshot(over: Record<string, unknown> = {}, destination: Record<string, unknown> = {}) {
  return {
    read_at: NOW,
    destination: { page: PAGE, workflow: "Connected", work_type: "Software", logging_level: "Tasks + final outputs", log_artifacts: [], ...destination },
    tasks: [],
    ...over,
  };
}

async function reconcile(env: Env, wf: string, args: string[] = ["--start"], snap: unknown = snapshot()) {
  return run(env.dir, ["workflow", "reconcile", wf, "--input", await file(env, snap), ...args]);
}

async function opState(env: Env, wf: string, op: string, state: string, extra: string[] = [], now = NOW) {
  return run(env.dir, ["workflow", "op", "state", wf, op, "--state", state, ...extra], now);
}

/** An approved item with an open create_task operation. */
async function itemWithOp(env: Env, wf: string, title = "Task one", extra: Record<string, unknown> = {}) {
  const item = await mkItem(env, wf, { title, approve: true, ...extra });
  const result = await reconcile(env, wf);
  assert.equal(result.code, 0, result.stdout);
  const op = (await show(env, wf)).ops.find((candidate: any) => candidate.target === item.id);
  assert.ok(op, "reconcile opened an operation");
  return { item, op };
}

// ---------------------------------------------------------------- workflow new

test("workflow new writes the record, the pointer and one journaled commit", async (context) => {
  const env = await setup(context);
  const before = await head(env);
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env))]);
  assert.equal(result.code, 0, result.stdout);
  const record = result.json.data;
  assert.match(record.id, WF_ID);
  assert.equal(record.rev, 1);
  assert.equal(record.state, "connected");
  assert.deepEqual(record.folder, { name: "acme-api", repo: "acme-api" });
  assert.equal(record.folder.name, basename(env.folder));
  assert.equal(record.opted_in.at, NOW);
  assert.equal(record.opted_in.statement, "Connect acme-api's work to Notion");
  assert.equal(record.settings.read_at, NOW);
  assert.deepEqual({ ...record.settings, read_at: undefined }, { work_type: "software", logging: "tasks_and_finals", custom: [], read_at: undefined });
  assert.deepEqual(record.destination, { project: PRJ });
  assert.deepEqual(record.relations, { goal: GOL, people: [PER] });
  assert.deepEqual(record.status_map, STATUS_MAP);
  assert.deepEqual(record.outside, []);
  assert.deepEqual(record.needs_you, []);
  assert.deepEqual(record.summary, { written_at: null, sha256: null });
  assert.equal("folder_path" in record, false, "the folder path is not stored");

  assert.deepEqual(await readJson(join(env.dir, "_workflows", record.id, "workflow.json")), record);
  const pointer = await readJson(join(env.folder, ".brain-workflow.json"));
  assert.deepEqual(pointer, { workflow: record.id });

  assert.notEqual(await head(env), before);
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: new ${record.id}`);
  assert.match(await git(env.dir, "log", "-1", "--format=%B"), /^Op: op-[0-9abcdefghjkmnpqrstvwxyz]{8}$/m);
  assert.match(await git(env.dir, "show", "--name-only", "--format=", "HEAD"), new RegExp(`_workflows/${record.id}/workflow\\.json`));
  await clean(env);
  assert.ok((await readFile(join(env.dir, "log/2026-11.md"), "utf8")).includes(`workflow - "${record.id}" command=new`));
});

test("workflow new works without folder.repo", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  assert.equal(record.folder.name, "acme-api");
  assert.equal("repo" in record.folder, false);
});

test("workflow new refuses unknown ids, an unknown repo and a relative folder", async (context) => {
  const env = await setup(context);
  const before = await head(env);
  const code = async (over: Record<string, unknown>) => errorCode(await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env, over))]));
  assert.equal(await code({ destination: { project: "prj-00000000" } }), "UNKNOWN_ID");
  assert.equal(await code({ relations: { goal: "gol-00000000" } }), "UNKNOWN_ID");
  assert.equal(await code({ relations: { people: ["per-00000000"] } }), "UNKNOWN_ID");
  assert.equal(await code({ folder: { repo: "other-repo" } }), "UNKNOWN_ID");
  assert.equal(await code({ folder_path: "relative/folder" }), "INPUT_INVALID");
  assert.equal(await code({ folder_path: join(env.parent, "missing-folder") }), "INPUT_INVALID");
  assert.equal(await head(env), before);
  assert.equal(await exists(join(env.folder, ".brain-workflow.json")), false);
  await clean(env);
});

test("workflow new refuses when the Tasks module is off", async (context) => {
  const env = await setup(context, { modules: { tasks: false } });
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env))]);
  assert.equal(errorCode(result), "MODULE_OFF");
  assert.equal(await exists(join(env.folder, ".brain-workflow.json")), false);
});

test("workflow new refuses when brain_id is not mapped", async (context) => {
  const env = await setup(context, { brainId: "" });
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env))]);
  assert.equal(errorCode(result), "BRAIN_CONFIG_INVALID");
  assert.equal(await exists(join(env.folder, ".brain-workflow.json")), false);
});

test("workflow new allows one open workflow per destination", async (context) => {
  const env = await setup(context);
  await wfPlain(env);
  const other = join(env.parent, "other-folder");
  await mkdir(other);
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env, { folder_path: other, folder: undefined }))]);
  assert.equal(errorCode(result), "DESTINATION_TAKEN");
  assert.equal(result.code, 4);
  assert.equal(await exists(join(other, ".brain-workflow.json")), false);
});

test("workflow new refuses a repo that an open workflow already names", async (context) => {
  const env = await setup(context);
  await wfNew(env);
  const other = join(env.parent, "other-folder");
  await mkdir(other);
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env, { folder_path: other, destination: { area: AREA } }))]);
  assert.equal(errorCode(result), "DESTINATION_TAKEN");
});

test("workflow new refuses a folder whose pointer names an open workflow", async (context) => {
  const env = await setup(context);
  await wfPlain(env);
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env, { folder: undefined, destination: { area: AREA } }))]);
  assert.equal(errorCode(result), "POINTER_EXISTS");
  assert.equal(result.code, 4);
});

test("workflow new replaces a pointer that names an ended workflow", async (context) => {
  const env = await setup(context);
  const first = await wfPlain(env);
  const ended = await run(env.dir, ["workflow", "set", first.id, "--rev", "1", "--input", await file(env, { state: "ended" })]);
  assert.equal(ended.code, 0, ended.stdout);
  const second = await wfPlain(env);
  assert.notEqual(second.id, first.id);
  assert.deepEqual(await readJson(join(env.folder, ".brain-workflow.json")), { workflow: second.id });
});

test("workflow new replaces a pointer that names a missing workflow", async (context) => {
  const env = await setup(context);
  await writeFile(join(env.folder, ".brain-workflow.json"), JSON.stringify({ workflow: "wf-aaaaaaaa" }));
  const record = await wfPlain(env);
  assert.deepEqual(await readJson(join(env.folder, ".brain-workflow.json")), { workflow: record.id });
});

test("workflow commands refuse a dirty brain and write nothing", async (context) => {
  const env = await setup(context);
  await writeFile(join(env.dir, "stray.txt"), "x");
  const before = await head(env);
  const result = await run(env.dir, ["workflow", "new", "--input", await file(env, newInput(env))]);
  assert.equal(result.json.ok, false);
  assert.equal(errorCode(result), "DIRTY_TREE");
  assert.equal(await head(env), before);
  assert.equal(await exists(join(env.folder, ".brain-workflow.json")), false);
  assert.equal(await exists(join(env.dir, "_workflows")), false);
});

test("every workflow command refuses while _journal/ holds an operation", async (context) => {
  const env = await setup(context);
  const record = await wfNew(env);
  await mkdir(join(env.dir, "_journal"), { recursive: true });
  await writeFile(join(env.dir, "_journal", "op-aaaaaaaa.json"), "{}");
  assert.equal(errorCode(await run(env.dir, ["workflow", "show", record.id])), "RECOVERY_NEEDED");
  assert.equal(errorCode(await run(env.dir, ["workflow", "find", "--destination", PRJ])), "RECOVERY_NEEDED");
  assert.equal(errorCode(await run(env.dir, ["workflow", "summary", record.id])), "RECOVERY_NEEDED");
});

// ---------------------------------------------------------------- find and show

test("find matches by repo, folder name and destination, every state, ordered by id", async (context) => {
  const env = await setup(context);
  const first = await wfNew(env);
  assert.equal((await run(env.dir, ["workflow", "set", first.id, "--rev", "1", "--input", await file(env, { state: "ended" })])).code, 0);
  const second = await wfNew(env);

  const find = async (...args: string[]) => (await run(env.dir, ["workflow", "find", ...args])).json.data.workflows;
  const byDestination = await find("--destination", PRJ);
  assert.deepEqual(byDestination.map((w: any) => w.id), [first.id, second.id].sort());
  assert.deepEqual(byDestination.map((w: any) => w.state).sort(), ["connected", "ended"]);
  const one = byDestination.find((w: any) => w.id === second.id);
  assert.deepEqual(one, { id: second.id, state: "connected", folder: { name: "acme-api", repo: "acme-api" }, destination: { project: PRJ } });
  assert.equal((await find("--repo", "acme-api")).length, 2);
  assert.equal((await find("--folder-name", "acme-api")).length, 2);
  assert.deepEqual(await find("--repo", "unknown-repo"), []);
  assert.deepEqual(await find("--folder-name", "nothing"), []);
  assert.deepEqual(await find("--destination", AREA), []);
});

test("show returns the records and the counts", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "A todo" });
  await mkItem(env, record.id, { title: "B doing", status: "in_progress" });
  await mkItem(env, record.id, { title: "C done", status: "done", accepted: { statement: "Looks good" } });
  await mkItem(env, record.id, { title: "D dropped", status: "dropped" });
  const data = await show(env, record.id);
  assert.equal(data.workflow.id, record.id);
  assert.equal(data.items.length, 4);
  assert.deepEqual(data.artifacts, []);
  assert.deepEqual(data.ops, []);
  assert.deepEqual(data.counts, {
    todo: 1, in_progress: 1, waiting: 0, review: 0, done: 1, dropped: 1, open: 2, percent: 33,
    ops_open: 0, ops_failed: 0, ops_uncertain: 0, needs_you: 0,
  });
});

test("show counts open and failed operations", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "One", approve: true });
  await mkItem(env, record.id, { title: "Two", approve: true });
  assert.equal((await reconcile(env, record.id)).code, 0);
  let data = await show(env, record.id);
  assert.equal(data.ops.length, 2);
  assert.equal(data.counts.ops_open, 2);
  const op = data.ops[0].id;
  assert.equal((await opState(env, record.id, op, "in_flight")).code, 0);
  const error = JSON.stringify({ code: "validation", message: "bad property", lasting: true });
  assert.equal((await opState(env, record.id, op, "failed", ["--error", error])).code, 0);
  data = await show(env, record.id);
  assert.equal(data.counts.ops_failed, 1);
  assert.equal(data.counts.ops_uncertain, 0);
});

test("show of an unknown workflow is WORKFLOW_NOT_FOUND", async (context) => {
  const env = await setup(context);
  const result = await run(env.dir, ["workflow", "show", "wf-aaaaaaaa"]);
  assert.equal(errorCode(result), "WORKFLOW_NOT_FOUND");
  assert.equal(result.code, 4);
});

// ---------------------------------------------------------------- set

test("set needs --rev, refuses a stale one and writes nothing", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const input = await file(env, { state: "paused" });
  assert.equal(errorCode(await run(env.dir, ["workflow", "set", record.id, "--input", input])), "USAGE");
  const before = await head(env);
  const stale = await run(env.dir, ["workflow", "set", record.id, "--rev", "7", "--input", input]);
  assert.equal(errorCode(stale), "STALE_RECORD");
  assert.equal(stale.code, 4);
  assert.equal(await head(env), before);
  assert.equal((await readJson(join(env.dir, "_workflows", record.id, "workflow.json"))).rev, 1);
  await clean(env);
});

test("set patches a record and increments rev; connected, paused, connected and ended", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const set = (rev: number, patch: unknown) => run(env.dir, ["workflow", "set", record.id, "--rev", String(rev), "--input", file_(patch)]);
  const file_ = (value: unknown) => { const path = join(env.parent, `set-${++counter}.json`); writeFileSync(path, JSON.stringify(value)); return path; };
  const paused = await set(1, { state: "paused" });
  assert.equal(paused.code, 0, paused.stdout);
  assert.equal(paused.json.data.state, "paused");
  assert.equal(paused.json.data.rev, 2);
  const resumed = await set(2, { state: "connected" });
  assert.equal(resumed.json.data.state, "connected");
  assert.equal(resumed.json.data.rev, 3);
  const patched = await set(3, { outside: [PAGE], modules_offered: ["documents", "tasks"] });
  assert.deepEqual(patched.json.data.outside, [PAGE]);
  assert.equal(patched.json.data.rev, 4);
  const ended = await set(4, { state: "ended" });
  assert.equal(ended.json.data.state, "ended");
  assert.equal((await readJson(join(env.dir, "_workflows", record.id, "workflow.json"))).state, "ended");
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: set ${record.id}`);
});

test("set refuses fields it does not patch", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  for (const patch of [{ rev: 9 }, { needs_you: [] }, { summary: { written_at: null, sha256: null } }, { state: "bogus" }]) {
    const result = await run(env.dir, ["workflow", "set", record.id, "--rev", "1", "--input", await file(env, patch)]);
    assert.equal(errorCode(result), "INPUT_INVALID", JSON.stringify(patch));
  }
  assert.equal((await readJson(join(env.dir, "_workflows", record.id, "workflow.json"))).rev, 1);
});

test("after ended every command but find and show is WORKFLOW_ENDED", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Kept" });
  assert.equal((await run(env.dir, ["workflow", "set", record.id, "--rev", "1", "--input", await file(env, { state: "ended" })])).code, 0);
  const wf = record.id;
  const attempts: string[][] = [
    ["workflow", "set", wf, "--rev", "2", "--input", await file(env, { state: "connected" })],
    ["workflow", "resolve", wf, "--rev", "2", "--input", await file(env, { answers: [] })],
    ["workflow", "item", "put", wf, "--input", await file(env, { title: "New", scope: "s", acceptance: [] })],
    ["workflow", "item", "claim", wf, item.id, "--by", "claude-code 2026-11-03T14:00Z"],
    ["workflow", "artifact", "put", wf, "--input", await file(env, { item: null, category: "final", title: "T", format: "text", location: { path: "a.md" } })],
    ["workflow", "render", wf, "--item", item.id],
    ["workflow", "op", "state", wf, "op-aaaaaaaa", "--state", "in_flight"],
    ["workflow", "reconcile", wf, "--input", await file(env, snapshot()), "--start"],
    ["workflow", "summary", wf],
    ["workflow", "publish-history", wf],
  ];
  for (const args of attempts) assert.equal(errorCode(await run(env.dir, args)), "WORKFLOW_ENDED", args.slice(0, 4).join(" "));
  assert.equal((await run(env.dir, ["workflow", "show", wf])).code, 0);
  assert.equal((await run(env.dir, ["workflow", "find", "--destination", PRJ])).code, 0);
});

test("set --pointer rewrites a lost pointer without --rev", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await rm(join(env.folder, ".brain-workflow.json"));
  const before = await head(env);
  const result = await run(env.dir, ["workflow", "set", record.id, "--pointer", env.folder]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(await readJson(join(env.folder, ".brain-workflow.json")), { workflow: record.id });
  assert.equal((await show(env, record.id)).workflow.rev, 1);
  assert.equal(await head(env), before);
});

// ---------------------------------------------------------------- item put

test("item put creates an item with the defaults", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const result = await put(env, record.id, "item", { title: "Add rate limiting", scope: "Limit by IP.", acceptance: [{ text: "429 after 100", met_at: null, evidence: null }] });
  assert.equal(result.code, 0, result.stdout);
  const item = (await show(env, record.id)).items[0];
  assert.match(item.id, /^wi-[0-9abcdefghjkmnpqrstvwxyz]{8}$/);
  assert.equal(item.rev, 1);
  assert.equal(item.title, "Add rate limiting");
  assert.equal(item.status, "todo");
  assert.equal(item.approved_at, null);
  assert.deepEqual(item.progress, []);
  assert.equal(item.notion, null);
  assert.equal(item.claim, null);
  assert.equal(item.accepted, null);
  assert.equal(item.logging, null);
  assert.deepEqual(item.depends_on, []);
  assert.deepEqual(item.acceptance, [{ text: "429 after 100", met_at: null, evidence: null }]);
  assert.equal(item.publication.state, "pending");
  assert.deepEqual(await readJson(join(env.dir, "_workflows", record.id, "items", `${item.id}.json`)), item);
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: item put ${record.id}`);
  await clean(env);
  assert.ok((await readFile(join(env.dir, "log/2026-11.md"), "utf8")).includes(`workflow - "${record.id}" command=item-put`));
});

test("item put updates are patches that need --rev and bump it", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Original" });
  assert.equal(errorCode(await put(env, record.id, "item", { id: item.id, title: "No rev" })), "USAGE");
  const stale = await put(env, record.id, "item", { id: item.id, title: "Stale" }, 9);
  assert.equal(errorCode(stale), "STALE_RECORD");
  assert.equal((await show(env, record.id)).items[0].title, "Original");
  const ok = await put(env, record.id, "item", { id: item.id, title: "Renamed", status: "in_progress" }, 1);
  assert.equal(ok.code, 0, ok.stdout);
  const after = (await show(env, record.id)).items[0];
  assert.equal(after.rev, 2);
  assert.equal(after.title, "Renamed");
  assert.equal(after.status, "in_progress");
  assert.equal(after.scope, "Scope text", "fields not in the patch are kept");
});

test("item put refuses managed fields", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Managed" });
  for (const patch of [{ rev: 5 }, { approved_at: NOW }, { claim: { by: "x", at: NOW } }, { notion: null }, { publication: { state: "published", at: NOW, error: null } }, { progress: [{ at: NOW, text: "x" }] }]) {
    const result = await put(env, record.id, "item", { id: item.id, ...patch }, 1);
    assert.equal(errorCode(result), "INPUT_INVALID", JSON.stringify(patch));
  }
  for (const extra of [{ approved_at: NOW }, { claim: null }, { notion: null }, { publish: { decision: "include" } }]) {
    assert.equal(errorCode(await put(env, record.id, "item", { title: "Created", scope: "s", acceptance: [], ...extra })), "INPUT_INVALID", JSON.stringify(extra));
  }
  assert.equal((await show(env, record.id)).items.length, 1);
});

test("item put approve sets approved_at; scope or criteria changes clear it, evidence does not", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, {
    title: "Approve me",
    acceptance: [{ text: "First", met_at: null, evidence: null }, { text: "Second", met_at: null, evidence: null }],
  });
  const current = async () => (await show(env, record.id)).items.find((i: any) => i.id === item.id);
  const patch = async (change: Record<string, unknown>) => {
    const result = await put(env, record.id, "item", { id: item.id, ...change }, (await current()).rev);
    assert.equal(result.code, 0, result.stdout);
    return current();
  };
  assert.equal((await patch({ approve: true })).approved_at, NOW);
  assert.equal((await patch({ acceptance: [{ text: "First", met_at: NOW, evidence: "test a.test.ts" }, { text: "Second", met_at: null, evidence: null }] })).approved_at, NOW, "met_at and evidence keep it");
  assert.equal((await patch({ title: "New title" })).approved_at, NOW, "a title change keeps it");
  assert.equal((await patch({ progress_add: ["Note"] })).approved_at, NOW);

  assert.equal((await patch({ scope: "Changed scope" })).approved_at, null, "scope clears it");
  await patch({ approve: true });
  assert.equal((await patch({ acceptance: [{ text: "First reworded", met_at: null, evidence: null }, { text: "Second", met_at: null, evidence: null }] })).approved_at, null, "criterion text clears it");
  await patch({ approve: true });
  assert.equal((await patch({ acceptance: [{ text: "First reworded", met_at: null, evidence: null }, { text: "Second", met_at: null, evidence: null }, { text: "Third", met_at: null, evidence: null }] })).approved_at, null, "adding one clears it");
  await patch({ approve: true });
  assert.equal((await patch({ acceptance: [{ text: "First reworded", met_at: null, evidence: null }] })).approved_at, null, "removing one clears it");
});

test("item put progress_add appends entries with --now", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Progress" });
  assert.equal((await patchItem(env, record.id, item.id, { progress_add: ["First"] })).code, 0);
  assert.equal((await patchItem(env, record.id, item.id, { progress_add: ["Second", "Third"] }, "2026-11-04T09:00:00Z")).code, 0);
  const after = (await show(env, record.id)).items[0];
  assert.deepEqual(after.progress, [
    { at: NOW, text: "First" },
    { at: "2026-11-04T09:00:00Z", text: "Second" },
    { at: "2026-11-04T09:00:00Z", text: "Third" },
  ]);
});

test("item put accepted records the user's statement with --now", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Accept" });
  const result = await patchItem(env, record.id, item.id, { status: "done", accepted: { statement: "Ship it" } });
  assert.equal(result.code, 0, result.stdout);
  const after = (await show(env, record.id)).items[0];
  assert.equal(after.status, "done");
  assert.deepEqual(after.accepted, { at: NOW, statement: "Ship it" });
});

test("item put refuses done without acceptance or a merged-style completion (§5.2)", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const pr = "https://github.com/acme/acme-api/pull/42";
  const bare = await mkItem(env, record.id, { title: "Bare" });
  const refused = await patchItem(env, record.id, bare.id, { status: "done" });
  assert.equal(errorCode(refused), "INPUT_INVALID");
  assert.ok(refused.json.error.details.some((d: any) => d.pointer === "/status"), JSON.stringify(refused.json.error));

  const unmet = await mkItem(env, record.id, { title: "Unmet", acceptance: [{ text: "A", met_at: NOW, evidence: "e" }, { text: "B", met_at: null, evidence: null }] });
  assert.equal(errorCode(await patchItem(env, record.id, unmet.id, { status: "done", links: { pr } })), "INPUT_INVALID", "a criterion is not met");
  const noPr = await mkItem(env, record.id, { title: "No PR", acceptance: [{ text: "A", met_at: NOW, evidence: "e" }] });
  assert.equal(errorCode(await patchItem(env, record.id, noPr.id, { status: "done" })), "INPUT_INVALID", "no PR");

  const merged = await mkItem(env, record.id, { title: "Merged", acceptance: [{ text: "A", met_at: NOW, evidence: "e" }] });
  const ok = await patchItem(env, record.id, merged.id, { status: "done", links: { pr } });
  assert.equal(ok.code, 0, ok.stdout);
  assert.equal((await show(env, record.id)).items.find((i: any) => i.id === merged.id).status, "done");
  assert.equal((await show(env, record.id)).items.find((i: any) => i.id === bare.id).status, "todo");
});

test("item put on general work: a PR does not complete an item", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env, { destination: { area: AREA }, settings: { work_type: "general", logging: "tasks_and_finals", custom: [] } });
  const item = await mkItem(env, record.id, { title: "Workshop", acceptance: [{ text: "A", met_at: NOW, evidence: "e" }] });
  const refused = await patchItem(env, record.id, item.id, { status: "done", links: { pr: "https://github.com/acme/acme-api/pull/1" } });
  assert.equal(errorCode(refused), "INPUT_INVALID");
  assert.equal((await patchItem(env, record.id, item.id, { status: "done", accepted: { statement: "Approved" } })).code, 0);
});

test("item put refuses unknown workflows and unknown items", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  assert.equal(errorCode(await put(env, "wf-aaaaaaaa", "item", { title: "T", scope: "s", acceptance: [] })), "WORKFLOW_NOT_FOUND");
  const unknown = await put(env, record.id, "item", { id: "wi-aaaaaaaa", title: "T" }, 1);
  assert.ok(["UNKNOWN_ID", "WORKFLOW_NOT_FOUND"].includes(errorCode(unknown)), JSON.stringify(unknown.json));
});

// ---------------------------------------------------------------- item claim

const LABEL = "claude-code 2026-11-03T14:00Z";
const claim = (env: Env, wf: string, wi: string, by: string, flags: string[] = [], now = NOW) =>
  run(env.dir, ["workflow", "item", "claim", wf, wi, "--by", by, ...flags], now);

test("item claim refuses an item that is not approved", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Unapproved" });
  const result = await claim(env, record.id, item.id, LABEL);
  assert.equal(errorCode(result), "NOT_APPROVED");
  assert.equal(result.code, 4);
});

test("item claim records the claim, refreshes the same label and keeps the status", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Claimed", approve: true });
  assert.equal((await claim(env, record.id, item.id, LABEL)).code, 0);
  let after = (await show(env, record.id)).items[0];
  assert.deepEqual(after.claim, { by: LABEL, at: NOW });
  assert.equal(after.status, "todo", "claiming doesn't change the status");
  assert.equal((await claim(env, record.id, item.id, LABEL, [], "2026-11-03T15:00:00Z")).code, 0);
  after = (await show(env, record.id)).items[0];
  assert.deepEqual(after.claim, { by: LABEL, at: "2026-11-03T15:00:00Z" });
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: item claim ${record.id}`);
});

test("item claim by another label is CLAIMED with the holder, unless stale", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Contested", approve: true });
  const other = "codex 2026-11-03T15:00Z";
  await claim(env, record.id, item.id, LABEL);
  const refused = await claim(env, record.id, item.id, other, [], "2026-11-03T15:20:00Z");
  assert.equal(errorCode(refused), "CLAIMED");
  assert.equal(refused.code, 4);
  assert.ok(JSON.stringify(refused.json.error).includes(LABEL), "names the holder");
  assert.equal((await show(env, record.id)).items[0].claim.by, LABEL);

  // Fresh progress keeps a claim from being stale: 2 h 40 after the claim but 1 h after the last progress entry.
  assert.equal((await patchItem(env, record.id, item.id, { progress_add: ["Working"] }, "2026-11-03T16:00:00Z")).code, 0);
  assert.equal(errorCode(await claim(env, record.id, item.id, other, [], "2026-11-03T17:00:00Z")), "CLAIMED");

  // More than 2 h after both the claim and the last progress entry.
  const taken = await claim(env, record.id, item.id, other, [], "2026-11-03T18:30:00Z");
  assert.equal(taken.code, 0, taken.stdout);
  assert.deepEqual((await show(env, record.id)).items[0].claim, { by: other, at: "2026-11-03T18:30:00Z" });
});

test("item claim --take overrides a live claim and logs the takeover; --release drops it", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Taken", approve: true });
  const other = "codex 2026-11-03T15:00Z";
  await claim(env, record.id, item.id, LABEL);
  const taken = await claim(env, record.id, item.id, other, ["--take"], "2026-11-03T14:30:00Z");
  assert.equal(taken.code, 0, taken.stdout);
  let after = (await show(env, record.id)).items[0];
  assert.equal(after.claim.by, other);
  assert.ok(after.progress.some((p: any) => p.text === `Claim taken over from ${LABEL}` && p.at === "2026-11-03T14:30:00Z"), JSON.stringify(after.progress));
  const released = await claim(env, record.id, item.id, other, ["--release"]);
  assert.equal(released.code, 0, released.stdout);
  after = (await show(env, record.id)).items[0];
  assert.equal(after.claim, null);
  assert.equal(after.status, "todo");
});

test("a claim is cleared when the item becomes done or dropped", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const doneItem = await mkItem(env, record.id, { title: "Will be done", approve: true });
  const droppedItem = await mkItem(env, record.id, { title: "Will be dropped", approve: true });
  await claim(env, record.id, doneItem.id, LABEL);
  await claim(env, record.id, droppedItem.id, LABEL);
  assert.equal((await patchItem(env, record.id, doneItem.id, { status: "done", accepted: { statement: "Fine" } })).code, 0);
  assert.equal((await patchItem(env, record.id, droppedItem.id, { status: "dropped" })).code, 0);
  const items = (await show(env, record.id)).items;
  assert.equal(items.find((i: any) => i.id === doneItem.id).claim, null);
  assert.equal(items.find((i: any) => i.id === droppedItem.id).claim, null);
});

// ---------------------------------------------------------------- artifact put

test("artifact put creates an artifact with the defaults", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const result = await put(env, record.id, "artifact", { item: null, category: "plan", title: "Rollout plan", format: "text", location: { path: "docs/plan.md" } });
  assert.equal(result.code, 0, result.stdout);
  const artifact = (await show(env, record.id)).artifacts[0];
  assert.match(artifact.id, /^art-[0-9abcdefghjkmnpqrstvwxyz]{8}$/);
  assert.equal(artifact.rev, 1);
  assert.equal(artifact.item, null);
  assert.equal(artifact.category, "plan");
  assert.deepEqual(artifact.location, { path: "docs/plan.md" });
  for (const field of ["sha256", "approved_at", "publish", "local_reason", "note", "published_sha256"]) assert.equal(artifact[field], null, field);
  assert.equal(artifact.publication.state, "pending");
  assert.deepEqual(await readJson(join(env.dir, "_workflows", record.id, "artifacts", `${artifact.id}.json`)), artifact);
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: artifact put ${record.id}`);
  await clean(env);
});

test("artifact put approve needs sha256 and sets approved_at", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const artifact = await mkArtifact(env, record.id, { title: "Deliverable" });
  const missing = await put(env, record.id, "artifact", { id: artifact.id, approve: true }, 1);
  assert.equal(errorCode(missing), "INPUT_INVALID");
  assert.equal(errorCode(await put(env, record.id, "artifact", { id: artifact.id, approve: true, sha256: "abc" }, 1)), "INPUT_INVALID");
  assert.equal(errorCode(await put(env, record.id, "artifact", { id: artifact.id, title: "x" })), "USAGE");
  assert.equal(errorCode(await put(env, record.id, "artifact", { id: artifact.id, title: "x" }, 9)), "STALE_RECORD");
  const approved = await approveArtifact(env, record.id, artifact.id);
  assert.equal(approved.approved_at, NOW);
  assert.equal(approved.sha256, sha(`content of ${artifact.id}`));
  assert.equal(approved.rev, 2);
});

test("artifact put refuses managed fields", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const artifact = await mkArtifact(env, record.id, { title: "Managed" });
  for (const patch of [{ rev: 4 }, { publish: { decision: "include", by: "artifact", level: "full", decided_at: NOW } }, { published_sha256: sha("x") }, { publication: { state: "published", at: NOW, error: null } }, { local_reason: "temporary" }]) {
    assert.equal(errorCode(await put(env, record.id, "artifact", { id: artifact.id, ...patch }, 1)), "INPUT_INVALID", JSON.stringify(patch));
  }
  assert.equal(errorCode(await put(env, record.id, "artifact", { item: "wi-aaaaaaaa", category: "final", title: "Orphan", format: "text", location: { path: "a.md" } })), "UNKNOWN_ID");
});

test("artifact publish decision follows the level (§5.3)", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const make = async (title: string, category: string, extra: Record<string, unknown> = {}) => {
    const created = await mkArtifact(env, record.id, { title, category });
    return approveArtifact(env, record.id, created.id, extra);
  };
  const final = await make("Final", "final");
  assert.deepEqual({ ...final.publish, decided_at: undefined }, { decision: "include", by: "level", level: "tasks_and_finals", decided_at: undefined });
  assert.equal(final.publish.decided_at, NOW);
  assert.equal(final.local_reason, null);
  assert.equal(final.publication.state, "pending");

  const plan = await make("Plan", "plan");
  assert.equal(plan.publish.decision, "exclude");
  assert.equal(plan.publish.by, "level");
  assert.equal(plan.local_reason, "excluded by level");
  assert.equal(plan.publication.state, "local");

  const temporary = await make("Temp", "temporary");
  assert.equal(temporary.publish.decision, "exclude");
  assert.equal(temporary.local_reason, "temporary");
  assert.equal(temporary.publication.state, "local");
});

test("artifact publish decision: full and custom levels", async (context) => {
  const env = await setup(context);
  const full = await wfPlain(env, { settings: { work_type: "software", logging: "full", custom: [] } });
  for (const category of ["brief", "plan", "specification", "decision", "final"]) {
    const created = await mkArtifact(env, full.id, { title: `Full ${category}`, category });
    assert.equal((await approveArtifact(env, full.id, created.id)).publish.decision, "include", category);
  }
  const temp = await mkArtifact(env, full.id, { title: "Full temp", category: "temporary" });
  assert.equal((await approveArtifact(env, full.id, temp.id)).publish.decision, "exclude", "temporary is never published");

  const env2 = await setup(context);
  const custom = await wfPlain(env2, { settings: { work_type: "software", logging: "custom", custom: ["plan"] } });
  const plan = await mkArtifact(env2, custom.id, { title: "Custom plan", category: "plan" });
  const brief = await mkArtifact(env2, custom.id, { title: "Custom brief", category: "brief" });
  assert.deepEqual((await approveArtifact(env2, custom.id, plan.id)).publish, { decision: "include", by: "level", level: "custom", decided_at: NOW });
  assert.equal((await approveArtifact(env2, custom.id, brief.id)).publish.decision, "exclude");
});

test("artifact override include or exclude wins over the level, also for temporary", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const plan = await mkArtifact(env, record.id, { title: "Plan", category: "plan" });
  const included = await approveArtifact(env, record.id, plan.id, { override: "include" });
  assert.equal(included.publish.decision, "include");
  assert.equal(included.publish.by, "artifact");
  assert.equal(included.local_reason, null);
  assert.equal(included.publication.state, "pending");

  const temp = await mkArtifact(env, record.id, { title: "Log", category: "temporary" });
  const tempIncluded = await approveArtifact(env, record.id, temp.id, { override: "include" });
  assert.deepEqual([tempIncluded.publish.decision, tempIncluded.publish.by], ["include", "artifact"]);

  const final = await mkArtifact(env, record.id, { title: "Final", category: "final" });
  const excluded = await approveArtifact(env, record.id, final.id, { override: "exclude" });
  assert.deepEqual([excluded.publish.decision, excluded.publish.by], ["exclude", "artifact"]);
  assert.equal(excluded.local_reason, "excluded by override");
  assert.equal(excluded.publication.state, "local");
});

test("an item's own logging level decides for its artifacts (by task)", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Detailed", logging: "full" });
  const plan = await mkArtifact(env, record.id, { title: "Item plan", category: "plan", item: item.id });
  const decided = await approveArtifact(env, record.id, plan.id);
  assert.deepEqual([decided.publish.decision, decided.publish.by, decided.publish.level], ["include", "task", "full"]);
  const loose = await mkArtifact(env, record.id, { title: "Loose plan", category: "plan" });
  assert.equal((await approveArtifact(env, record.id, loose.id)).publish.by, "level");
  const override = await mkArtifact(env, record.id, { title: "Overridden plan", category: "plan", item: item.id });
  assert.equal((await approveArtifact(env, record.id, override.id, { override: "exclude" })).publish.by, "artifact", "the artifact override comes before the task");
});

test("with Documents off an include becomes exclude 'module off', except a decision", async (context) => {
  const env = await setup(context, { modules: { documents: false } });
  const record = await wfPlain(env);
  const final = await mkArtifact(env, record.id, { title: "Final", category: "final" });
  const finalDone = await approveArtifact(env, record.id, final.id);
  assert.equal(finalDone.publish.decision, "exclude");
  assert.equal(finalDone.local_reason, "module off");
  assert.equal(finalDone.publication.state, "local");
  const plan = await mkArtifact(env, record.id, { title: "Plan", category: "plan" });
  const planDone = await approveArtifact(env, record.id, plan.id, { override: "include" });
  assert.deepEqual([planDone.publish.decision, planDone.local_reason], ["exclude", "module off"]);
  const decision = await mkArtifact(env, record.id, { title: "Decision", category: "decision" });
  const decisionDone = await approveArtifact(env, record.id, decision.id, { override: "include" });
  assert.equal(decisionDone.publish.decision, "include", "a decision needs Knowledge, not Documents");
  assert.equal(decisionDone.local_reason, null);
});

test("with Knowledge off a decision becomes exclude 'module off'", async (context) => {
  const env = await setup(context, { modules: { knowledge: false } });
  const record = await wfPlain(env);
  const decision = await mkArtifact(env, record.id, { title: "Decision", category: "decision" });
  const done = await approveArtifact(env, record.id, decision.id, { override: "include" });
  assert.deepEqual([done.publish.decision, done.local_reason, done.publication.state], ["exclude", "module off", "local"]);
  const final = await mkArtifact(env, record.id, { title: "Final", category: "final" });
  assert.equal((await approveArtifact(env, record.id, final.id)).publish.decision, "include", "Documents is still on");
});

test("an override on a decided artifact replaces publish with by: artifact", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const final = await mkArtifact(env, record.id, { title: "Final", category: "final" });
  const decided = await approveArtifact(env, record.id, final.id);
  assert.equal(decided.publish.by, "level");
  const result = await put(env, record.id, "artifact", { id: final.id, override: "exclude" }, decided.rev);
  assert.equal(result.code, 0, result.stdout);
  const after = (await show(env, record.id)).artifacts[0];
  assert.deepEqual([after.publish.decision, after.publish.by], ["exclude", "artifact"]);
  assert.equal(after.local_reason, "excluded by override");
  assert.equal(after.publication.state, "local");
  const back = await put(env, record.id, "artifact", { id: final.id, override: "include" }, after.rev);
  assert.equal(back.code, 0, back.stdout);
  const again = (await show(env, record.id)).artifacts[0];
  assert.deepEqual([again.publish.decision, again.publish.by, again.local_reason, again.publication.state], ["include", "artifact", null, "pending"]);
});

// ---------------------------------------------------------------- op state

test("op state: the allowed path, with attempts, runs_failed and the item's publication", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const { item, op } = await itemWithOp(env, record.id);
  assert.equal(op.kind, "create_task");
  assert.equal(op.state, "pending");
  assert.equal(op.rev, 1);
  const state = async () => (await show(env, record.id)).ops.find((o: any) => o.id === op.id);

  assert.equal((await opState(env, record.id, op.id, "in_flight")).code, 0);
  assert.equal((await state()).attempts, 1);
  assert.equal((await opState(env, record.id, op.id, "pending")).code, 0);
  assert.equal((await opState(env, record.id, op.id, "in_flight")).code, 0);
  assert.equal((await state()).attempts, 2);

  const error = { code: "validation", message: "bad property", lasting: true };
  const failed = await opState(env, record.id, op.id, "failed", ["--error", JSON.stringify(error)]);
  assert.equal(failed.code, 0, failed.stdout);
  const afterFail = await state();
  assert.equal(afterFail.state, "failed");
  assert.equal(afterFail.runs_failed, 1);
  assert.deepEqual(afterFail.last_error, error);
  const failedItem = (await show(env, record.id)).items.find((i: any) => i.id === item.id);
  assert.equal(failedItem.publication.state, "failed");
  assert.equal(failedItem.publication.error, "bad property");

  assert.equal((await opState(env, record.id, op.id, "pending")).code, 0);
  assert.equal((await opState(env, record.id, op.id, "in_flight")).code, 0);
  assert.equal((await show(env, record.id)).items.find((i: any) => i.id === item.id).publication.state, "pending");
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: op state ${record.id}`);
});

test("op state done records the page, deletes the op file in the same commit and publishes the item", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const { item, op } = await itemWithOp(env, record.id, "Publish me", { status: "in_progress" });
  await opState(env, record.id, op.id, "in_flight");
  const done = await opState(env, record.id, op.id, "done", ["--page", PAGE], "2026-11-03T14:25:00Z");
  assert.equal(done.code, 0, done.stdout);
  const data = await show(env, record.id);
  assert.deepEqual(data.ops, []);
  assert.equal(await exists(join(env.dir, "_workflows", record.id, "ops", `${op.id}.json`)), false);
  const after = data.items.find((i: any) => i.id === item.id);
  assert.deepEqual(after.notion, { page: PAGE, title: "Publish me", status: "Doing", read_at: "2026-11-03T14:25:00Z" });
  assert.equal(after.publication.state, "published");
  assert.equal(after.publication.at, "2026-11-03T14:25:00Z");
  assert.equal(after.publication.error, null);
  const changes = await git(env.dir, "show", "--name-status", "--format=", "HEAD");
  assert.match(changes, new RegExp(`D\\s+_workflows/${record.id}/ops/${op.id}\\.json`));
  assert.match(changes, new RegExp(`M\\s+_workflows/${record.id}/items/${item.id}\\.json`));
  await clean(env);
});

test("op state done on publish_artifact records published_sha256", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const created = await mkArtifact(env, record.id, { title: "Deliverable", category: "final" });
  const approved = await approveArtifact(env, record.id, created.id);
  assert.equal((await reconcile(env, record.id)).code, 0);
  const op = (await show(env, record.id)).ops.find((o: any) => o.target === approved.id);
  assert.equal(op.kind, "publish_artifact");
  assert.deepEqual(op.payload, { sha256: approved.sha256 });
  await opState(env, record.id, op.id, "in_flight");
  const done = await opState(env, record.id, op.id, "done", ["--page", PAGE]);
  assert.equal(done.code, 0, done.stdout);
  const artifact = (await show(env, record.id)).artifacts[0];
  assert.equal(artifact.published_sha256, approved.sha256);
  assert.equal(artifact.publication.state, "published");
  assert.deepEqual((await show(env, record.id)).ops, []);
});

test("op state refuses moves the table does not allow", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const { op } = await itemWithOp(env, record.id);
  const error = JSON.stringify({ code: "network", message: "down", lasting: false });
  assert.equal(errorCode(await opState(env, record.id, op.id, "done", ["--page", PAGE])), "INPUT_INVALID", "pending to done");
  assert.equal(errorCode(await opState(env, record.id, op.id, "failed", ["--error", error])), "INPUT_INVALID", "pending to failed");
  assert.equal(errorCode(await opState(env, record.id, op.id, "uncertain")), "INPUT_INVALID", "pending to uncertain");
  assert.equal(errorCode(await opState(env, record.id, op.id, "bogus")), "INPUT_INVALID", "unknown state");
  await opState(env, record.id, op.id, "in_flight");
  await opState(env, record.id, op.id, "failed", ["--error", error]);
  assert.equal(errorCode(await opState(env, record.id, op.id, "done", ["--page", PAGE])), "INPUT_INVALID", "failed to done");
  assert.equal(errorCode(await opState(env, record.id, op.id, "in_flight")), "INPUT_INVALID", "failed to in_flight");
  assert.equal((await show(env, record.id)).ops[0].state, "failed");
});

test("op state done needs --page and failed needs a valid --error", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const { op } = await itemWithOp(env, record.id);
  await opState(env, record.id, op.id, "in_flight");
  const before = await head(env);
  const noPage = await opState(env, record.id, op.id, "done");
  assert.ok(["USAGE", "INPUT_INVALID"].includes(errorCode(noPage)), JSON.stringify(noPage.json));
  const noError = await opState(env, record.id, op.id, "failed");
  assert.ok(["USAGE", "INPUT_INVALID"].includes(errorCode(noError)), JSON.stringify(noError.json));
  assert.equal(errorCode(await opState(env, record.id, op.id, "failed", ["--error", "not json"])), "INPUT_INVALID");
  assert.equal(errorCode(await opState(env, record.id, op.id, "failed", ["--error", JSON.stringify({ code: "weird", message: "m", lasting: true })])), "INPUT_INVALID");
  assert.equal(await head(env), before);
  assert.equal((await show(env, record.id)).ops[0].state, "in_flight");
});

test("op state dropped on create_task makes the item local, notes it, and reconcile does not reopen it", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const { item, op } = await itemWithOp(env, record.id);
  const dropped = await opState(env, record.id, op.id, "dropped");
  assert.equal(dropped.code, 0, dropped.stdout);
  const data = await show(env, record.id);
  assert.deepEqual(data.ops, []);
  assert.equal(await exists(join(env.dir, "_workflows", record.id, "ops", `${op.id}.json`)), false);
  const after = data.items.find((i: any) => i.id === item.id);
  assert.equal(after.publication.state, "local");
  assert.ok(after.progress.some((p: any) => p.text === "Dropped: create_task"), JSON.stringify(after.progress));
  const again = await reconcile(env, record.id);
  assert.deepEqual(again.json.data.ops, []);
  assert.deepEqual((await show(env, record.id)).ops, []);
});

test("op state dropped on a never-published artifact excludes it 'dropped by user'", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Owner" });
  const created = await mkArtifact(env, record.id, { title: "Deliverable", category: "final", item: item.id });
  const approved = await approveArtifact(env, record.id, created.id);
  await reconcile(env, record.id);
  const op = (await show(env, record.id)).ops.find((o: any) => o.target === approved.id);
  assert.equal((await opState(env, record.id, op.id, "dropped")).code, 0);
  const data = await show(env, record.id);
  const artifact = data.artifacts[0];
  assert.deepEqual([artifact.publish.decision, artifact.publish.by, artifact.publish.level], ["exclude", "artifact", "tasks_and_finals"]);
  assert.equal(artifact.local_reason, "dropped by user");
  assert.equal(artifact.publication.state, "local");
  assert.equal(artifact.published_sha256, null);
  assert.ok(data.items.find((i: any) => i.id === item.id).progress.some((p: any) => p.text === "Dropped: publish_artifact"));
});

// ---------------------------------------------------------------- paused

test("a paused workflow keeps working locally and reconcile opens no operation", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Local work", approve: true });
  assert.equal((await run(env.dir, ["workflow", "set", record.id, "--rev", "1", "--input", await file(env, { state: "paused" })])).code, 0);
  assert.equal((await patchItem(env, record.id, item.id, { progress_add: ["Still going"] })).code, 0, "item put works while paused");
  const result = await reconcile(env, record.id, ["--start"], snapshot({}, { workflow: "Standard" }));
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.ops, []);
  const data = await show(env, record.id);
  assert.deepEqual(data.ops, []);
  assert.equal(data.workflow.state, "paused");
});

// ---------------------------------------------------------------- summary

test("summary renders the normative markdown for a small case", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "Done one", status: "done", accepted: { statement: "OK" } });
  await mkItem(env, record.id, { title: "Doing one", status: "in_progress" });
  await mkItem(env, record.id, { title: "Todo one" });
  const result = await run(env.dir, ["workflow", "summary", record.id]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.json.data.heading, "Workflow");
  assert.equal(result.json.data.markdown.trimEnd(), [
    "Updated 3 Nov 2026, 14:20 UTC · acme-api · Connected",
    "1 completed · 2 open (1 in progress, 1 to do) · 33%",
  ].join("\n"));
  assert.match(result.json.data.sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.json.data.changed, true);
});

test("summary wording: ready for review (software) and ready for approval (general)", async (context) => {
  const env = await setup(context);
  const software = await wfPlain(env);
  await mkItem(env, software.id, { title: "In review", status: "review" });
  const lines = (await run(env.dir, ["workflow", "summary", software.id])).json.data.markdown.trimEnd().split("\n");
  assert.equal(lines[1], "1 open (1 ready for review) · 0%");

  const env2 = await setup(context);
  const general = await wfPlain(env2, { destination: { area: AREA }, settings: { work_type: "general", logging: "tasks_and_finals", custom: [] } });
  await mkItem(env2, general.id, { title: "In approval", status: "review" });
  const generalLines = (await run(env2.dir, ["workflow", "summary", general.id])).json.data.markdown.trimEnd().split("\n");
  assert.equal(generalLines[1], "1 open (1 ready for approval) · 0%");
});

test("summary leaves the percent out when every item is dropped", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "Dropped one", status: "dropped" });
  const lines = (await run(env.dir, ["workflow", "summary", record.id])).json.data.markdown.trimEnd().split("\n");
  assert.equal(lines[1], "1 dropped");
});

test("summary lists what is not yet in Notion and the complete line", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "Finished", status: "done", accepted: { statement: "OK" }, approve: true });
  await mkItem(env, record.id, { title: "Open work", approve: true });
  assert.equal((await reconcile(env, record.id)).code, 0);
  let lines = (await run(env.dir, ["workflow", "summary", record.id])).json.data.markdown.trimEnd().split("\n");
  assert.equal(lines.length, 3, lines.join("\n"));
  assert.match(lines[2], /^Not yet in Notion: 2: /);
  assert.ok(lines[2].includes("Finished (waiting for the next run)"), lines[2]);
  assert.ok(lines[2].includes("Open work (waiting for the next run)"), lines[2]);
  assert.equal(lines.some((line: string) => line.startsWith("Work complete")), false, "an open item remains");

  // Only finished work left, one operation still open.
  const env2 = await setup(context);
  const only = await wfPlain(env2);
  await mkItem(env2, only.id, { title: "Finished", status: "done", accepted: { statement: "OK" }, approve: true });
  await reconcile(env2, only.id);
  lines = (await run(env2.dir, ["workflow", "summary", only.id])).json.data.markdown.trimEnd().split("\n");
  assert.equal(lines[1], "1 completed · 100%");
  assert.equal(lines[2], "Not yet in Notion: 1: Finished (waiting for the next run)");
  assert.equal(lines[3], "Work complete, 1 not yet in Notion.");
});

test("summary names a failed operation's message", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const { op } = await itemWithOp(env, record.id, "Broken");
  await opState(env, record.id, op.id, "in_flight");
  await opState(env, record.id, op.id, "failed", ["--error", JSON.stringify({ code: "validation", message: "bad property", lasting: true })]);
  const lines = (await run(env.dir, ["workflow", "summary", record.id])).json.data.markdown.trimEnd().split("\n");
  assert.ok(lines.some((line: string) => line.startsWith("Not yet in Notion: 1: Broken (failed: bad property)")), lines.join("\n"));
});

test("summary sha256 ignores the date; pausing changes it", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "One" });
  const first = (await run(env.dir, ["workflow", "summary", record.id])).json.data;
  const later = (await run(env.dir, ["workflow", "summary", record.id], "2026-11-09T08:05:00Z")).json.data;
  assert.equal(later.sha256, first.sha256);
  assert.ok(later.markdown.startsWith("Updated 9 Nov 2026, 08:05 UTC · acme-api · Connected"), later.markdown);
  assert.equal((await run(env.dir, ["workflow", "set", record.id, "--rev", "1", "--input", await file(env, { state: "paused" })])).code, 0);
  const paused = (await run(env.dir, ["workflow", "summary", record.id])).json.data;
  assert.ok(paused.markdown.split("\n")[0].endsWith("· acme-api · Paused"), paused.markdown);
  assert.notEqual(paused.sha256, first.sha256);
});

test("summary --written records the hash; changed turns false; a wrong hash is STALE_RECORD", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "One" });
  const summary = (await run(env.dir, ["workflow", "summary", record.id])).json.data;
  const before = await head(env);
  const wrong = await run(env.dir, ["workflow", "summary", record.id, "--written", sha("something else")]);
  assert.equal(errorCode(wrong), "STALE_RECORD");
  assert.equal(await head(env), before);
  const written = await run(env.dir, ["workflow", "summary", record.id, "--written", summary.sha256]);
  assert.equal(written.code, 0, written.stdout);
  assert.deepEqual((await show(env, record.id)).workflow.summary, { written_at: NOW, sha256: summary.sha256 });
  assert.equal(await git(env.dir, "log", "-1", "--format=%s"), `workflow: summary ${record.id}`);
  await clean(env);
  const again = (await run(env.dir, ["workflow", "summary", record.id], "2026-11-10T10:00:00Z")).json.data;
  assert.equal(again.changed, false);
  await mkItem(env, record.id, { title: "Two" });
  assert.equal((await run(env.dir, ["workflow", "summary", record.id])).json.data.changed, true);
});

// ---------------------------------------------------------------- render

test("render --item gives the payload and the Work record toggle", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const dependency = await mkItem(env, record.id, { title: "Other item" });
  const item = await mkItem(env, record.id, {
    title: "Add rate limiting",
    scope: "Limit by IP.",
    status: "in_progress",
    depends_on: [dependency.id],
    acceptance: [{ text: "429 after 100", met_at: NOW, evidence: "test rl.test.ts" }, { text: "Docs updated", met_at: null, evidence: null }],
  });
  const texts = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
  assert.equal((await patchItem(env, record.id, item.id, { progress_add: texts }, "2026-11-04T09:00:00Z")).code, 0);
  const result = await run(env.dir, ["workflow", "render", record.id, "--item", item.id]);
  assert.equal(result.code, 0, result.stdout);
  const { payload, toggle } = result.json.data;
  assert.equal(toggle.heading, "Work record");
  assert.equal(toggle.markdown.trimEnd(), [
    "Scope: Limit by IP.",
    "Acceptance:",
    "- [x] 429 after 100 (test rl.test.ts)",
    "- [ ] Docs updated",
    "Depends on: Other item",
    "Progress:",
    "- 4 Nov: p3",
    "- 4 Nov: p4",
    "- 4 Nov: p5",
    "- 4 Nov: p6",
    "- 4 Nov: p7",
  ].join("\n"));
  const flat = JSON.stringify(payload);
  assert.ok(flat.includes("Add rate limiting"), flat);
  assert.ok(flat.includes(item.id), "the Brain ID is the item's id");
  assert.ok(flat.includes("Doing"), "status is status_map[in_progress]");
});

test("render leaves out lines with nothing to show and works for an item with no page", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Bare", scope: "Just this.", acceptance: [] });
  const result = await run(env.dir, ["workflow", "render", record.id, "--item", item.id]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.json.data.toggle.markdown.trimEnd(), "Scope: Just this.");
  const unknown = await run(env.dir, ["workflow", "render", record.id, "--item", "wi-aaaaaaaa"]);
  assert.ok(["UNKNOWN_ID", "WORKFLOW_NOT_FOUND"].includes(errorCode(unknown)), JSON.stringify(unknown.json));
  assert.equal(await git(env.dir, "status", "--porcelain"), "", "render writes nothing");
});

// ---------------------------------------------------------------- publish-history

test("publish-history lists approved artifacts the current level now includes", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const make = async (title: string, category: string, extra: Record<string, unknown> = {}) => {
    const created = await mkArtifact(env, record.id, { title, category });
    return approveArtifact(env, record.id, created.id, extra);
  };
  const plan = await make("Plan", "plan");
  const brief = await make("Brief", "brief");
  const final = await make("Final", "final");
  const temp = await make("Temp", "temporary");
  const kept = await make("Kept local", "specification", { override: "exclude" });
  const unapproved = await mkArtifact(env, record.id, { title: "Unapproved", category: "plan" });
  const listed = async () => (await run(env.dir, ["workflow", "publish-history", record.id])).json.data.artifacts;

  assert.deepEqual(await listed(), [], "nothing is newly included at the same level");
  const raised = await reconcile(env, record.id, [], snapshot({}, { logging_level: "Full durable record" }));
  assert.equal(raised.code, 0, raised.stdout);
  assert.equal((await show(env, record.id)).workflow.settings.logging, "full");
  const ids = await listed();
  assert.deepEqual([...ids].sort(), [plan.id, brief.id].sort());
  for (const id of [final.id, temp.id, kept.id, unapproved.id]) assert.equal(ids.includes(id), false, id);
  assert.equal((await show(env, record.id)).artifacts.find((a: any) => a.id === plan.id).publish.level, "tasks_and_finals", "a frozen decision does not change");
});

// ---------------------------------------------------------------- elsewhere in the CLI (§12, §6.3)

test("id new takes the workflow record prefixes wf, wi, art and op", async (context) => {
  const env = await setup(context);
  for (const prefix of ["wf", "wi", "art", "op"]) {
    const result = await run(env.dir, ["id", "new", prefix, "--count", "2"]);
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.json.data.ids.length, 2);
    for (const id of result.json.data.ids) assert.match(id, new RegExp(`^${prefix}-[0-9abcdefghjkmnpqrstvwxyz]{8}$`));
  }
});

test("lint's workflow-record flags a record that fails its schema or names a missing record; valid records pass", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const item = await mkItem(env, record.id, { title: "Lint me", approve: true });
  const issues = async () => (await run(env.dir, ["lint"])).json.data.issues.filter((issue: { rule: string }) => issue.rule === "workflow-record");
  assert.deepEqual(await issues(), []);

  const itemPath = join(env.dir, "_workflows", record.id, "items", `${item.id}.json`);
  await writeFile(itemPath, `${JSON.stringify({ ...item, depends_on: ["wi-00000000"] }, null, 2)}\n`);
  assert.ok((await issues()).some((issue: { message: string }) => issue.message.includes("wi-00000000")), "a missing dependency");
  await writeFile(itemPath, `${JSON.stringify({ ...item, status: "finished" }, null, 2)}\n`);
  assert.ok((await issues()).some((issue: { path: string }) => issue.path.endsWith(`${item.id}.json`)), "a schema failure");
  await mkdir(join(env.dir, "_workflows", record.id, "ops"), { recursive: true });
  await writeFile(join(env.dir, "_workflows", record.id, "ops", "op-00000000.json"), `${JSON.stringify({ id: "op-00000000", rev: 1, kind: "create_task", target: "wi-11111111", payload: { title: "x", status: "To Do" }, state: "pending", attempts: 0, runs_failed: 0, created_at: NOW, updated_at: NOW, last_error: null, result: null }, null, 2)}\n`);
  assert.ok((await issues()).some((issue: { message: string }) => issue.message.includes("wi-11111111")), "an operation naming a missing target");
});

test("index, views and query ignore _workflows/", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  await mkItem(env, record.id, { title: "Not a note", approve: true });
  const index = await run(env.dir, ["index", "--check"]);
  assert.equal(index.json.ok, true, index.stdout);
  const query = await run(env.dir, ["query", "--candidates", "Not a note"]);
  assert.equal(query.json.ok, true, query.stdout);
  assert.ok(!JSON.stringify(query.json.data).includes(record.id));
});

test("note new writes a workflow Document: origin workflow with its workflow and no sources (§6.3)", async (context) => {
  const env = await setup(context);
  const record = await wfPlain(env);
  const doc = (frontmatter: Record<string, unknown>) => ({ notes: [{ type: "reference", title: "Rate limit plan", frontmatter: { summary: "The plan for rate limiting.", projects: [PRJ], ...frontmatter }, body: "## Plan\nLimit per IP.\n" }] });
  const created = await run(env.dir, ["note", "new", "--input", await file(env, doc({ origin: "workflow", workflow: { id: record.id, artifact: "art-2p8k4m6n" } }))]);
  assert.equal(created.code, 0, created.stdout);
  const written = await readFile(join(env.dir, created.json.data.created[0].path), "utf8");
  assert.match(written, /^lifecycle: reviewed$/m, "the user approved the artifact");
  const missing = await run(env.dir, ["note", "new", "--input", await file(env, doc({ origin: "workflow" }))]);
  assert.equal(errorCode(missing), "INPUT_INVALID", "origin workflow needs workflow");
  const stray = await run(env.dir, ["note", "new", "--input", await file(env, doc({ origin: "part", sources: ["src-3k8m2q7p"], workflow: { id: record.id, artifact: "art-2p8k4m6n" } }))]);
  assert.equal(errorCode(stray), "INPUT_INVALID", "workflow only with origin workflow");
});
