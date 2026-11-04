// Black-box tests for CC-102 slice 2b: `brain workflow reconcile`, `resolve` and `adopt preview/apply`
// (spec/connected-workflows.md §§3, 5, 6.2, 7, 8, 10, 11, 12, 14). Written before the code exists.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { brain, fixtureCopy } from "./helpers.ts";

const exec = promisify(execFile);
const NOW = "2026-12-10T09:00:00Z";
const PROJECT = "prj-9x4t1b7e";
const DEST_PAGE = "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1aff";
const STATUS_MAP = { todo: "To Do", in_progress: "Doing", waiting: "Waiting On", review: "Doing", done: "Done", dropped: "Won't Do" };
const page = (n: number) => `6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a${n.toString(16).padStart(2, "0")}`;
const sha = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const K1 = "line:5e1a0c9b2d47";
const K2 = "line:6f2b1d0c3e58";
const K3 = "line:7a3c2e1d4f69";
const K5 = "line:8b4d3f2e5a7c";
const GH = "#17";

interface Task { page: string; brain_id: string | null; title: string; status: string | null; archived: boolean; in_trash: boolean; edited: string }
const task = (pageId: string, brainId: string | null, title: string, status: string | null = "To Do", extra: Partial<Task> = {}): Task =>
  ({ page: pageId, brain_id: brainId, title, status, archived: false, in_trash: false, edited: "2026-12-10T08:00:00Z", ...extra });

interface Options { start?: boolean; read_at?: string; now?: string; destination?: Record<string, unknown>; extra?: Record<string, unknown> }

/** A brain with the Tasks (and Documents) module on, a clean Git history, and one connected workflow on a temp folder. */
async function setup(context: TestContext) {
  const dir = await fixtureCopy(context);
  const scratch = dirname(dir);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { tasks: true, documents: true };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const git = (...args: string[]) => exec("git", ["-C", dir, ...args]);
  await git("init", "-q");
  await git("config", "user.email", "test@example.com");
  await git("config", "user.name", "Test");
  await git("add", "-A");
  await git("commit", "-q", "-m", "base");
  const folder = await mkdtemp(join(tmpdir(), "brain-workflow-folder-"));
  context.after(() => rm(folder, { recursive: true, force: true }));

  let counter = 0;
  const file = async (value: unknown) => {
    const path = join(scratch, `input-${counter++}.json`);
    await writeFile(path, JSON.stringify(value));
    return path;
  };
  const call = (args: string[], now = NOW) => brain([...args, "--brain", dir, "--now", now, "--json"]);
  const newInput = { folder_path: folder, opted_in: { statement: "Connect acme work to Notion" }, destination: { project: PROJECT }, settings: { work_type: "software", logging: "full", custom: [] }, status_map: STATUS_MAP };
  const created = await call(["workflow", "new", "--input", await file(newInput)]);
  assert.equal(created.code, 0, created.stdout);
  const wf: string = created.json.data.id;

  const show = async () => {
    const shown = await call(["workflow", "show", wf]);
    assert.equal(shown.code, 0, shown.stdout);
    return shown.json.data;
  };
  const item = async (id: string) => (await show()).items.find((entry: any) => entry.id === id);
  const ops = async () => (await show()).ops as any[];
  const openOps = async (target?: string, kind?: string) =>
    (await ops()).filter((op) => op.state !== "done" && op.state !== "dropped" && (!target || op.target === target) && (!kind || op.kind === kind));
  const ok = async (args: string[], now = NOW) => {
    const result = await call(args, now);
    assert.equal(result.code, 0, `${args.join(" ")}: ${result.stdout}`);
    return result.json.data;
  };

  const addItem = async (title: string, extra: Record<string, unknown> = {}) => {
    await ok(["workflow", "item", "put", wf, "--input", await file({ title, scope: `Scope of ${title}`, acceptance: [], approve: true, ...extra })]);
    return (await show()).items.find((entry: any) => entry.title === title).id as string;
  };
  const patchItem = async (id: string, patch: Record<string, unknown>) =>
    call(["workflow", "item", "put", wf, "--input", await file({ id, ...patch }), "--rev", String((await item(id)).rev)]);

  const reconcile = async (tasks: Task[] = [], options: Options = {}) => {
    const snapshot = {
      read_at: options.read_at ?? NOW,
      destination: { page: DEST_PAGE, workflow: "Connected", work_type: "Software", logging_level: "Full durable record", log_artifacts: [], ...options.destination },
      tasks,
      ...options.extra,
    };
    const args = ["workflow", "reconcile", wf, "--input", await file(snapshot)];
    if (options.start) args.push("--start");
    return call(args, options.now ?? NOW);
  };
  const reconcileOk = async (tasks: Task[] = [], options: Options = {}) => {
    const result = await reconcile(tasks, options);
    assert.equal(result.code, 0, result.stdout);
    return result.json.data;
  };
  const opState = (op: string, state: string, extra: string[] = [], now = NOW) => call(["workflow", "op", "state", wf, op, "--state", state, ...extra], now);

  /** Opens and completes the item's create_task, as the skill does; the Notion task then has the page `pageId`. */
  const publish = async (id: string, pageId: string, others: Task[] = []) => {
    await reconcileOk(others);
    const op = (await openOps(id, "create_task"))[0];
    assert.ok(op, "a create_task is open");
    assert.equal((await opState(op.id, "in_flight")).code, 0);
    const done = await opState(op.id, "done", ["--page", pageId]);
    assert.equal(done.code, 0, done.stdout);
    return task(pageId, id, (await item(id)).title, "To Do");
  };
  const published = async (title: string, pageId: string, others: Task[] = [], extra: Record<string, unknown> = {}) => {
    const id = await addItem(title, extra);
    return { id, task: await publish(id, pageId, others) };
  };

  const addArtifact = async (itemId: string | null, title = "Rate limit plan", category = "plan") => {
    await ok(["workflow", "artifact", "put", wf, "--input", await file({ item: itemId, category, title, format: "text", location: { path: "plan.md" } })]);
    return (await show()).artifacts.find((entry: any) => entry.title === title).id as string;
  };
  const artifact = async (id: string) => (await show()).artifacts.find((entry: any) => entry.id === id);
  const patchArtifact = async (id: string, patch: Record<string, unknown>) =>
    call(["workflow", "artifact", "put", wf, "--input", await file({ id, ...patch }), "--rev", String((await artifact(id)).rev)]);

  const resolve = async (answers: { id: string; choice: string }[], rev?: number) =>
    call(["workflow", "resolve", wf, "--rev", String(rev ?? (await show()).workflow.rev), "--input", await file({ answers })]);

  /** An item published with a page, then renamed on both sides: BOTH_CHANGED. */
  const bothChanged = async () => {
    const p = await published("Draft the spec", page(1));
    assert.equal((await patchItem(p.id, { title: "Draft the spec (mine)" })).code, 0);
    const data = await reconcileOk([{ ...p.task, title: "Draft the spec (notion)" }]);
    return { ...p, data, notionTask: { ...p.task, title: "Draft the spec (notion)" } };
  };

  const adoptionPath = join(dir, "_workflows", wf, "adoption.json");
  const adoptionInput = (items: unknown[], extra: Record<string, unknown> = {}) => ({
    sources: [{ kind: "markdown", ref: "PLAN.md" }], items, unsupported: [], conventions: [], selected: null, treatments: {}, status_read: {}, ...extra,
  });
  const preview = async (input: unknown) => call(["workflow", "adopt", "preview", wf, "--input", await file(input)]);
  const apply = async (input: unknown, rev: number) => call(["workflow", "adopt", "apply", wf, "--rev", String(rev), "--input", await file(input)]);
  const adoptionRev = async () => JSON.parse(await readFile(adoptionPath, "utf8")).rev as number;
  const adoption = async () => JSON.parse(await readFile(adoptionPath, "utf8"));
  const status = async () => (await git("status", "--porcelain")).stdout.trim();

  return { dir, folder, wf, git, file, call, ok, show, item, ops, openOps, addItem, patchItem, reconcile, reconcileOk, opState, publish, published, addArtifact, artifact, patchArtifact, resolve, bothChanged, adoptionPath, adoptionInput, preview, apply, adoptionRev, adoption, status };
}

const md = (key: string, title: string, meaning: string, extra: Record<string, unknown> = {}) =>
  ({ origin: { kind: "markdown", ref: "PLAN.md", key }, title, body: "", raw_status: "[ ]", meaning, depends_on: [], url: null, brain_id: null, ...extra });
const gh = (title: string, meaning: string, extra: Record<string, unknown> = {}) =>
  ({ origin: { kind: "github", ref: "acme/acme-api", key: GH }, title, body: "", raw_status: "In review", meaning, depends_on: [], url: "https://github.com/acme/acme-api/issues/17", brain_id: null, ...extra });
const notionItem = (pageId: string, title: string, rawStatus: string, meaning: string, brainId: string | null = null) =>
  ({ origin: { kind: "notion", ref: "tasks", key: pageId }, title, body: "", raw_status: rawStatus, meaning, depends_on: [], url: null, brain_id: brainId });
const CONVENTION = { rule: "Status lives in TASKS.md", source: "AGENTS.md", choice: "decline" };

// ---------------------------------------------------------------- reconcile: operations

test("reconcile --start opens one create_task for an item with notion null, and a second run opens no other", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  const first = await c.reconcileOk([], { start: true });
  assert.equal(first.ops.length, 1);
  const open = await c.openOps(id, "create_task");
  assert.equal(open.length, 1);
  assert.equal(first.ops[0], open[0].id);
  assert.deepEqual([open[0].state, open[0].payload.title, open[0].payload.status], ["pending", "Add rate limiting", "To Do"]);

  await c.reconcileOk([]);
  await c.reconcileOk([], { start: true });
  const after = await c.openOps(id, "create_task");
  assert.deepEqual(after.map((op) => op.id), [open[0].id], "at most one open operation per target and kind");
});

test("a pending operation gets its payload replaced and keeps its id when the title changes", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([]);
  const before = (await c.openOps(id, "create_task"))[0];
  assert.equal((await c.patchItem(id, { title: "Add rate limiting to the API" })).code, 0);
  await c.reconcileOk([]);
  const after = await c.openOps(id, "create_task");
  assert.equal(after.length, 1);
  assert.equal(after[0].id, before.id);
  assert.equal(after[0].payload.title, "Add rate limiting to the API");
});

test("an in_flight operation is not replaced and is reported in busy", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([]);
  const op = (await c.openOps(id, "create_task"))[0];
  assert.equal((await c.opState(op.id, "in_flight")).code, 0);
  await c.patchItem(id, { title: "Renamed meanwhile" });
  const data = await c.reconcileOk([], { read_at: "2026-12-10T09:05:00Z" });
  assert.ok(data.busy.includes(op.id));
  const after = await c.openOps(id, "create_task");
  assert.deepEqual([after.length, after[0].id, after[0].state, after[0].payload.title], [1, op.id, "in_flight", "Add rate limiting"]);
});

// ---------------------------------------------------------------- reconcile: interruption (§10.2)

test("an interrupted create_task resolves to the task whose Brain ID is the item id, without a second task", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([]);
  const op = (await c.openOps(id, "create_task"))[0];
  await c.opState(op.id, "in_flight");
  const data = await c.reconcileOk([task(page(2), id, "Add rate limiting")], { read_at: "2026-12-10T09:11:00Z" });
  assert.ok(data.routine.some((entry: any) => entry.kind === "op_resolved"));
  assert.deepEqual(await c.openOps(id), [], "no second create_task");
  assert.equal(data.ops.length, 0);
  const record = await c.item(id);
  assert.equal(record.notion.page, page(2));
  assert.ok(!(await c.ops()).some((entry) => entry.id === op.id && entry.state !== "done"), "the operation is done (and its file gone)");
});

test("an interrupted create_task with no such task goes back to pending", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([]);
  const op = (await c.openOps(id, "create_task"))[0];
  await c.opState(op.id, "in_flight");
  const data = await c.reconcileOk([], { read_at: "2026-12-10T09:11:00Z" });
  const open = await c.openOps(id, "create_task");
  assert.deepEqual([open.length, open[0].id, open[0].state], [1, op.id, "pending"]);
  assert.ok(data.ops.includes(op.id));
});

test("an in_flight operation less than 10 minutes old stays in flight and is busy", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([]);
  const op = (await c.openOps(id, "create_task"))[0];
  await c.opState(op.id, "in_flight");
  const data = await c.reconcileOk([task(page(2), id, "Add rate limiting")], { read_at: "2026-12-10T09:05:00Z" });
  assert.ok(data.busy.includes(op.id));
  assert.equal((await c.openOps(id, "create_task"))[0].state, "in_flight");
  assert.equal((await c.item(id)).notion, null);
});

// ---------------------------------------------------------------- reconcile: the §8.2 table

test("Notion status changed, local unchanged: the Notion status is adopted", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  const data = await c.reconcileOk([{ ...p.task, status: "Waiting On" }]);
  assert.ok(data.routine.some((entry: any) => entry.kind === "status_adopted" && entry.target === p.id));
  assert.equal((await c.item(p.id)).status, "waiting");
  assert.deepEqual(await c.openOps(p.id), []);
});

test("local status changed, Notion unchanged: an update_task is opened", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  assert.equal((await c.patchItem(p.id, { status: "in_progress" })).code, 0);
  const data = await c.reconcileOk([p.task]);
  const open = await c.openOps(p.id, "update_task");
  assert.equal(open.length, 1);
  assert.equal(open[0].payload.status, "Doing");
  assert.ok(data.ops.includes(open[0].id));
  assert.equal((await c.item(p.id)).status, "in_progress");
});

test("status changed in both places: Notion's value is kept, with no update_task", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  await c.patchItem(p.id, { status: "in_progress" });
  const data = await c.reconcileOk([{ ...p.task, status: "Waiting On" }]);
  assert.ok(data.routine.some((entry: any) => entry.kind === "status_adopted" && entry.target === p.id));
  assert.equal((await c.item(p.id)).status, "waiting");
  assert.deepEqual(await c.openOps(p.id, "update_task"), []);
  assert.deepEqual(data.needs_you, []);
});

test("title changed only in Notion is adopted; changed in both is BOTH_CHANGED, repeated and not duplicated", async (context) => {
  const c = await setup(context);
  const only = await c.published("Plan the launch", page(1));
  const adopted = await c.reconcileOk([{ ...only.task, title: "Plan the launch week" }]);
  assert.ok(adopted.routine.some((entry: any) => entry.kind === "title_adopted" && entry.target === only.id));
  assert.equal((await c.item(only.id)).title, "Plan the launch week");

  const both = await c.bothChanged();
  const entries = both.data.needs_you.filter((entry: any) => entry.kind === "BOTH_CHANGED");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, `BOTH_CHANGED:${both.id}`);
  assert.ok(entries[0].choices.includes("keep_mine") && entries[0].choices.includes("take_notion"));
  assert.equal((await c.item(both.id)).title, "Draft the spec (mine)", "the local value is not dropped");
  assert.deepEqual(await c.openOps(both.id, "update_task"), [], "no operation while the question is open");

  const again = await c.reconcileOk([only.task, both.notionTask].map((entry) => (entry.page === only.task.page ? { ...entry, title: "Plan the launch week" } : entry)));
  assert.equal(again.needs_you.filter((entry: any) => entry.id === `BOTH_CHANGED:${both.id}`).length, 1);
  assert.equal((await c.show()).workflow.needs_you.filter((entry: any) => entry.kind === "BOTH_CHANGED").length, 1);
});

test("Notion Done without accepted records the acceptance, and the claim is cleared", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  await c.patchItem(p.id, { status: "in_progress" });
  await c.reconcileOk([p.task]);
  assert.equal((await c.call(["workflow", "item", "claim", c.wf, p.id, "--by", "claude-code 2026-12-10T09:00Z"])).code, 0);
  assert.ok((await c.item(p.id)).claim);
  const edited = "2026-12-10T08:30:00Z";
  await c.reconcileOk([{ ...p.task, status: "Done", edited }]);
  const record = await c.item(p.id);
  assert.equal(record.status, "done");
  assert.equal(record.accepted.statement, "Set to Done in Notion");
  assert.equal(record.accepted.at, edited);
  assert.equal(record.claim, null);
});

test("an option in neither map is STATUS_UNMAPPED and the item keeps its status", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  const data = await c.reconcileOk([{ ...p.task, status: "Someday" }]);
  const entry = data.needs_you.find((candidate: any) => candidate.kind === "STATUS_UNMAPPED");
  assert.ok(entry);
  assert.equal(entry.id, `STATUS_UNMAPPED:${p.id}`);
  assert.equal((await c.item(p.id)).status, "todo");
  for (const meaning of ["todo", "in_progress", "waiting", "review", "done", "dropped"]) assert.ok(entry.choices.includes(meaning), meaning);
});

test("an option shared by in_progress and review keeps the item's current meaning", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  assert.equal((await c.patchItem(p.id, { status: "review" })).code, 0);
  await c.reconcileOk([{ ...p.task, status: "Doing" }]);
  const record = await c.item(p.id);
  assert.equal(record.status, "review");
  assert.deepEqual(await c.openOps(p.id, "update_task"), []);
});

test("an archived or trashed task is TASK_ARCHIVED", async (context) => {
  const c = await setup(context);
  const a = await c.published("Archived one", page(1));
  const b = await c.published("Trashed one", page(2), [a.task]);
  const data = await c.reconcileOk([{ ...a.task, archived: true }, { ...b.task, in_trash: true }]);
  const ids = data.needs_you.filter((entry: any) => entry.kind === "TASK_ARCHIVED").map((entry: any) => entry.id).sort();
  assert.deepEqual(ids, [`TASK_ARCHIVED:${a.id}`, `TASK_ARCHIVED:${b.id}`].sort());
  assert.deepEqual(await c.openOps(a.id), []);
});

test("restoring a trashed task removes the entry as routine resolved_itself", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  await c.reconcileOk([{ ...p.task, in_trash: true }]);
  assert.equal((await c.show()).workflow.needs_you.length, 1);
  const data = await c.reconcileOk([p.task]);
  assert.ok(data.routine.some((entry: any) => entry.kind === "resolved_itself"));
  assert.deepEqual((await c.show()).workflow.needs_you, []);
  assert.deepEqual(data.needs_you, []);
});

test("a missing task with no open operation is TASK_DELETED", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  const data = await c.reconcileOk([]);
  const entry = data.needs_you.find((candidate: any) => candidate.kind === "TASK_DELETED");
  assert.equal(entry?.id, `TASK_DELETED:${p.id}`);
  assert.deepEqual(await c.openOps(p.id), []);
});

test("a destination task whose Brain ID is not a workflow item is UNKNOWN_TASK, unless it is in outside", async (context) => {
  const c = await setup(context);
  const meeting = task(page(9), "mtg-4h8w2n6c", "Send the notes");
  const data = await c.reconcileOk([meeting]);
  const entry = data.needs_you.find((candidate: any) => candidate.kind === "UNKNOWN_TASK");
  assert.ok(entry);
  assert.ok(entry.choices.includes("adopt") && entry.choices.includes("outside"));
  const set = await c.call(["workflow", "set", c.wf, "--rev", String((await c.show()).workflow.rev), "--input", await c.file({ outside: [page(9)] })]);
  assert.equal(set.code, 0, set.stdout);
  const after = await c.reconcileOk([meeting]);
  assert.equal(after.needs_you.filter((candidate: any) => candidate.kind === "UNKNOWN_TASK").length, 0);
  assert.deepEqual((await c.show()).workflow.needs_you.filter((candidate: any) => candidate.kind === "UNKNOWN_TASK"), []);
});

// ---------------------------------------------------------------- reconcile: destination settings (§8.1)

test("Workflow Standard pauses the workflow and opens no operation; Connected resumes it", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  const paused = await c.reconcileOk([], { destination: { workflow: "Standard" } });
  assert.ok(paused.routine.some((entry: any) => entry.kind === "state_changed"));
  assert.equal((await c.show()).workflow.state, "paused");
  assert.deepEqual(paused.ops, []);
  assert.deepEqual(await c.openOps(id), []);

  const resumed = await c.reconcileOk([]);
  assert.ok(resumed.routine.some((entry: any) => entry.kind === "state_changed"));
  assert.equal((await c.show()).workflow.state, "connected");
  assert.equal((await c.openOps(id, "create_task")).length, 1);
});

test("a changed Logging level is copied into settings as settings_changed", async (context) => {
  const c = await setup(context);
  const data = await c.reconcileOk([], { destination: { logging_level: "Tasks only" } });
  assert.ok(data.routine.some((entry: any) => entry.kind === "settings_changed"));
  const settings = (await c.show()).workflow.settings;
  assert.equal(settings.logging, "tasks_only");
  assert.equal(settings.read_at, NOW);
  const same = await c.reconcileOk([], { destination: { logging_level: "Tasks only" } });
  assert.ok(!same.routine.some((entry: any) => entry.kind === "settings_changed"), "no change, no routine entry");
});

// ---------------------------------------------------------------- reconcile: retries (§10.3)

const LASTING = JSON.stringify({ code: "network", message: "x", lasting: false });

test("a failed operation stays failed on a plain reconcile; --start puts it back to pending and resets attempts", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([], { start: true });
  const op = (await c.openOps(id, "create_task"))[0];
  assert.equal((await c.opState(op.id, "in_flight")).code, 0);
  assert.equal((await c.opState(op.id, "failed", ["--error", LASTING])).code, 0);
  let current = (await c.openOps(id, "create_task"))[0];
  assert.deepEqual([current.state, current.runs_failed, current.attempts], ["failed", 1, 1]);

  await c.reconcileOk([]);
  assert.equal((await c.openOps(id, "create_task"))[0].state, "failed");
  const data = await c.reconcileOk([], { start: true });
  current = (await c.openOps(id, "create_task"))[0];
  assert.deepEqual([current.id, current.state, current.attempts], [op.id, "pending", 0]);
  assert.ok(data.ops.includes(op.id));
});

test("after runs_failed reaches 3, --start leaves the operation failed", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  await c.reconcileOk([], { start: true });
  const op = (await c.openOps(id, "create_task"))[0];
  for (let run = 1; run <= 3; run += 1) {
    assert.equal((await c.opState(op.id, "in_flight")).code, 0);
    assert.equal((await c.opState(op.id, "failed", ["--error", LASTING])).code, 0);
    assert.equal((await c.openOps(id, "create_task"))[0].runs_failed, run);
    const data = await c.reconcileOk([], { start: true });
    const state = (await c.openOps(id, "create_task"))[0].state;
    if (run < 3) assert.equal(state, "pending");
    else {
      assert.equal(state, "failed");
      assert.ok(!data.ops.includes(op.id));
    }
  }
});

// ---------------------------------------------------------------- reconcile: order and artifacts

test("data.ops is ordered create_task, update_task, publish_artifact, mark_original, then by target id", async (context) => {
  const c = await setup(context);
  const existing = await c.published("Existing task", page(1));
  await c.patchItem(existing.id, { title: "Existing task renamed" });
  const applied = await c.apply(c.adoptionInput([gh("Imported issue", "todo")], { selected: [GH], treatments: { [GH]: "mark_transferred" }, conventions: [CONVENTION] }), 0);
  assert.equal(applied.code, 0, applied.stdout);
  const imported = (await c.show()).items.find((entry: any) => entry.title === "Imported issue");
  const ghOp = (await c.openOps(imported.id, "create_task"))[0];
  await c.opState(ghOp.id, "in_flight");
  await c.opState(ghOp.id, "done", ["--page", page(3)]);
  const fresh1 = await c.addItem("Fresh one");
  const fresh2 = await c.addItem("Fresh two");
  const plan = await c.addArtifact(existing.id);
  assert.equal((await c.patchArtifact(plan, { approve: true, sha256: sha("plan v1") })).code, 0);

  const data = await c.reconcileOk([task(page(1), existing.id, "Existing task"), task(page(3), imported.id, "Imported issue")]);
  const all = await c.ops();
  const rank = ["create_task", "update_task", "publish_artifact", "mark_original"];
  const listed = data.ops.map((id: string) => all.find((op) => op.id === id));
  assert.ok(listed.every(Boolean));
  assert.deepEqual(new Set(listed.map((op: any) => op.kind)), new Set(rank), "all four kinds are open");
  const expected = [...listed].sort((a: any, b: any) => rank.indexOf(a.kind) - rank.indexOf(b.kind) || (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  assert.deepEqual(data.ops, expected.map((op: any) => op.id));
  assert.deepEqual(listed.filter((op: any) => op.kind === "create_task").map((op: any) => op.target), [fresh1, fresh2].sort());
});

test("an approved include artifact not yet published opens publish_artifact", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  const art = await c.addArtifact(p.id);
  assert.equal((await c.patchArtifact(art, { approve: true, sha256: sha("plan v1") })).code, 0);
  assert.equal((await c.artifact(art)).publish.decision, "include");
  const data = await c.reconcileOk([p.task]);
  const open = await c.openOps(art, "publish_artifact");
  assert.equal(open.length, 1);
  assert.equal(open[0].payload.sha256, sha("plan v1"));
  assert.ok(data.ops.includes(open[0].id));
});

async function publishedArtifact(c: Awaited<ReturnType<typeof setup>>) {
  const p = await c.published("Add rate limiting", page(1));
  const art = await c.addArtifact(p.id);
  await c.patchArtifact(art, { approve: true, sha256: sha("plan v1") });
  await c.reconcileOk([p.task]);
  const op = (await c.openOps(art, "publish_artifact"))[0];
  await c.opState(op.id, "in_flight");
  const done = await c.opState(op.id, "done", ["--page", page(7)]);
  assert.equal(done.code, 0, done.stdout);
  assert.equal((await c.artifact(art)).published_sha256, sha("plan v1"));
  return { ...p, art };
}

test("a file changed since approval is ARTIFACT_CHANGED when its Document was not edited", async (context) => {
  const c = await setup(context);
  const p = await publishedArtifact(c);
  const data = await c.reconcileOk([p.task], { extra: { artifacts: [{ id: p.art, sha256: sha("plan v2") }] } });
  assert.deepEqual(data.needs_you.map((entry: any) => entry.kind), ["ARTIFACT_CHANGED"]);
  assert.equal(data.needs_you[0].id, `ARTIFACT_CHANGED:${p.art}`);
  assert.deepEqual(await c.openOps(p.art), []);
  const same = await c.reconcileOk([p.task], { extra: { artifacts: [{ id: p.art, sha256: sha("plan v1") }] } });
  assert.ok(!same.needs_you.some((entry: any) => entry.kind === "ARTIFACT_CHANGED"), "an unchanged hash asks nothing");
});

test("a changed file whose Document was edited after last_synced is DOCUMENT_BOTH_CHANGED only", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  const art = await c.addArtifact(p.id);
  // A synthetic published Document (reference note) for the artifact; hand-written because `note new` is outside this slice.
  const noteId = "ref-4m8q2k6p";
  await mkdir(join(c.dir, "knowledge", "references"), { recursive: true });
  await writeFile(join(c.dir, "knowledge", "references", "rate-limit-plan.md"), [
    "---", `id: ${noteId}`, "type: reference", "title: Rate limit plan", "summary: The plan.", "lifecycle: reviewed", "origin: workflow",
    `workflow: { id: ${c.wf}, artifact: ${art} }`, `projects: [${PROJECT}]`, "created: 2026-12-09", "updated: 2026-12-09",
    `notion: ${page(7)}`, "last_synced: 2026-12-09T08:00:00Z", "---", "", "The plan.", ""].join("\n"));
  await c.git("add", "-A");
  await c.git("commit", "-q", "-m", "add document");
  assert.equal((await c.patchArtifact(art, { approve: true, sha256: sha("plan v1"), note: noteId })).code, 0);
  await c.reconcileOk([p.task]);
  const op = (await c.openOps(art, "publish_artifact"))[0];
  await c.opState(op.id, "in_flight");
  await c.opState(op.id, "done", ["--page", page(7)]);

  const data = await c.reconcileOk([p.task], {
    extra: { artifacts: [{ id: art, sha256: sha("plan v2") }], documents: [{ page: page(7), brain_id: noteId, edited: "2026-12-10T08:00:00Z" }] },
  });
  assert.deepEqual(data.needs_you.map((entry: any) => entry.kind), ["DOCUMENT_BOTH_CHANGED"]);

  const edited = await c.reconcileOk([p.task], { extra: { artifacts: [{ id: art, sha256: sha("plan v1") }], documents: [{ page: page(7), brain_id: noteId, edited: "2026-12-10T08:00:00Z" }] } });
  assert.deepEqual(edited.needs_you, [], "a Document edited with no local change asks nothing");
});

// ---------------------------------------------------------------- resolve

test("resolve needs --rev, refuses a stale one, and refuses an unknown id or choice", async (context) => {
  const c = await setup(context);
  const b = await c.bothChanged();
  const entryId = `BOTH_CHANGED:${b.id}`;
  const missing = await c.call(["workflow", "resolve", c.wf, "--input", await c.file({ answers: [{ id: entryId, choice: "keep_mine" }] })]);
  assert.equal(missing.json.error?.code, "USAGE");
  const rev = (await c.show()).workflow.rev;
  assert.equal((await c.resolve([{ id: entryId, choice: "keep_mine" }], rev - 1)).json.error?.code, "STALE_RECORD");
  assert.equal((await c.resolve([{ id: "BOTH_CHANGED:wi-00000000", choice: "keep_mine" }])).json.error?.code, "INPUT_INVALID");
  assert.equal((await c.resolve([{ id: entryId, choice: "restore" }])).json.error?.code, "INPUT_INVALID");
  assert.equal((await c.show()).workflow.needs_you.length, 1, "nothing was written");
});

test("resolve BOTH_CHANGED keep_mine opens an update_task with the local title", async (context) => {
  const c = await setup(context);
  const b = await c.bothChanged();
  const done = await c.resolve([{ id: `BOTH_CHANGED:${b.id}`, choice: "keep_mine" }]);
  assert.equal(done.code, 0, done.stdout);
  assert.deepEqual((await c.show()).workflow.needs_you, []);
  const open = await c.openOps(b.id, "update_task");
  assert.equal(open.length, 1);
  assert.equal(open[0].payload.title, "Draft the spec (mine)");
});

test("resolve BOTH_CHANGED take_notion adopts the Notion title and opens nothing", async (context) => {
  const c = await setup(context);
  const b = await c.bothChanged();
  assert.equal((await c.resolve([{ id: `BOTH_CHANGED:${b.id}`, choice: "take_notion" }])).code, 0);
  assert.equal((await c.item(b.id)).title, "Draft the spec (notion)");
  assert.deepEqual(await c.openOps(b.id), []);
  assert.deepEqual((await c.show()).workflow.needs_you, []);
});

test("resolve STATUS_UNMAPPED with a meaning adds the option to status_read and adopts it", async (context) => {
  const c = await setup(context);
  const p = await c.published("Add rate limiting", page(1));
  await c.reconcileOk([{ ...p.task, status: "Someday" }]);
  const done = await c.resolve([{ id: `STATUS_UNMAPPED:${p.id}`, choice: "waiting" }]);
  assert.equal(done.code, 0, done.stdout);
  const workflow = (await c.show()).workflow;
  assert.equal(workflow.status_read.Someday, "waiting");
  assert.equal((await c.item(p.id)).status, "waiting");
  const later = await c.reconcileOk([{ ...p.task, status: "Someday" }]);
  assert.deepEqual(later.needs_you, [], "the option is known now");
});

test("resolve TASK_DELETED recreate clears notion and opens a create_task; drop drops with publication local", async (context) => {
  const c = await setup(context);
  const a = await c.published("Recreate me", page(1));
  const b = await c.published("Drop me", page(2), [a.task]);
  const data = await c.reconcileOk([]);
  assert.equal(data.needs_you.filter((entry: any) => entry.kind === "TASK_DELETED").length, 2);
  const done = await c.resolve([{ id: `TASK_DELETED:${a.id}`, choice: "recreate" }, { id: `TASK_DELETED:${b.id}`, choice: "drop" }]);
  assert.equal(done.code, 0, done.stdout);
  assert.equal((await c.item(a.id)).notion, null);
  assert.equal((await c.openOps(a.id, "create_task")).length, 1);
  const dropped = await c.item(b.id);
  assert.equal(dropped.status, "dropped");
  assert.equal(dropped.publication.state, "local");
  assert.deepEqual(await c.openOps(b.id), []);
});

test("resolve UNKNOWN_TASK outside adds the page id to outside", async (context) => {
  const c = await setup(context);
  const data = await c.reconcileOk([task(page(9), "src-4h8w2n6c", "Follow up")]);
  const entry = data.needs_you.find((candidate: any) => candidate.kind === "UNKNOWN_TASK");
  assert.ok(entry);
  const done = await c.resolve([{ id: entry.id, choice: "outside" }]);
  assert.equal(done.code, 0, done.stdout);
  const workflow = (await c.show()).workflow;
  assert.deepEqual(workflow.outside, [page(9)]);
  assert.deepEqual(workflow.needs_you, []);
});

test("resolve while paused records the answer but opens no operation", async (context) => {
  const c = await setup(context);
  const b = await c.bothChanged();
  await c.reconcileOk([b.notionTask], { destination: { workflow: "Standard" } });
  const done = await c.resolve([{ id: `BOTH_CHANGED:${b.id}`, choice: "keep_mine" }]);
  assert.equal(done.code, 0, done.stdout);
  assert.deepEqual(await c.openOps(b.id), []);
});

// ---------------------------------------------------------------- adopt preview

const planItems = () => [
  md(K1, "Set up the limiter", "todo"),
  md(K2, "Wire it into the gateway", "in_progress", { raw_status: "[/]", depends_on: [K1] }),
  md(K3, "Pick a library", "done", { raw_status: "[x]" }),
  md(K5, "Write the runbook", "in_progress", { depends_on: [K3] }),
  gh("Rate limit the public API", "review"),
];

test("adopt preview lists create with option and default selection, and writes nothing", async (context) => {
  const c = await setup(context);
  const before = await c.status();
  const result = await c.preview(c.adoptionInput(planItems()));
  assert.equal(result.code, 0, result.stdout);
  const create = result.json.data.create as any[];
  const byKey = (key: string) => create.find((entry) => entry.key === key);
  assert.equal(create.length, 5);
  assert.deepEqual([byKey(K1).title, byKey(K1).meaning, byKey(K1).option, byKey(K1).selected], ["Set up the limiter", "todo", "To Do", true]);
  assert.deepEqual([byKey(K2).option, byKey(K2).selected], ["Doing", true]);
  assert.deepEqual([byKey(K3).meaning, byKey(K3).option, byKey(K3).selected], ["done", "Done", false]);
  assert.deepEqual([byKey(GH).option, byKey(GH).selected], ["Doing", true]);
  assert.deepEqual([result.json.data.update, result.json.data.missing, result.json.data.untouched], [[], [], []]);
  assert.equal(await c.status(), before, "the brain is untouched");
  await assert.rejects(readFile(c.adoptionPath, "utf8"));
  assert.equal((await c.show()).items.length, 0);
});

test("adopt preview: selected replaces the default selection", async (context) => {
  const c = await setup(context);
  const result = await c.preview(c.adoptionInput(planItems(), { selected: [K3] }));
  const create = result.json.data.create as any[];
  assert.deepEqual(create.filter((entry) => entry.selected).map((entry) => entry.key), [K3]);
});

test("adopt preview drops a dependency on a done item and warns about an unselected open one", async (context) => {
  const c = await setup(context);
  const result = await c.preview(c.adoptionInput(planItems()));
  const dependencies = result.json.data.dependencies as any[];
  const runbook = dependencies.find((entry) => entry.key === K5);
  assert.deepEqual(runbook.dropped, [K3]);
  assert.deepEqual(runbook.warnings, []);
  assert.deepEqual(dependencies.find((entry) => entry.key === K2).warnings, []);

  const partial = await c.preview(c.adoptionInput(planItems(), { selected: [K2] }));
  const gateway = (partial.json.data.dependencies as any[]).find((entry) => entry.key === K2);
  assert.equal(gateway.warnings.length, 1);
});

test("adopt preview offers the originals' choices per §11.5", async (context) => {
  const c = await setup(context);
  const pageKey = page(40);
  const result = await c.preview(c.adoptionInput([...planItems(), notionItem(pageKey, "Existing task", "Doing", "in_progress")]));
  const originals = result.json.data.originals as any[];
  const find = (key: string) => originals.find((entry) => entry.key === key);
  assert.deepEqual([find(K1).choices, find(K1).default], [["keep"], "keep"]);
  assert.deepEqual([find(GH).choices, find(GH).default], [["keep", "mark_transferred", "close_transferred"], "keep"]);
  assert.deepEqual([find(pageKey).choices, find(pageKey).default], [["keep"], "keep"]);
});

test("adopt preview lists the status options of Notion-origin items that neither map knows", async (context) => {
  const c = await setup(context);
  const result = await c.preview(c.adoptionInput([notionItem(page(40), "Someday task", "Someday", "todo"), notionItem(page(41), "Known option", "Doing", "in_progress")]));
  const options = result.json.data.status_options as any[];
  assert.equal(options.length, 1);
  assert.equal(options[0].option, "Someday");
  assert.equal(options[0].meaning, null);
});

test("adopt preview refuses duplicate keys", async (context) => {
  const c = await setup(context);
  const result = await c.preview(c.adoptionInput([md(K1, "One", "todo"), md(K1, "Two", "todo")]));
  assert.equal(result.json.error?.code, "INPUT_INVALID");
});

test("adopt preview after an apply: update for a changed title or body (never status), untouched, missing", async (context) => {
  const c = await setup(context);
  const items = [md(K1, "Set up the limiter", "todo"), md(K2, "Wire it into the gateway", "in_progress"), gh("Rate limit the public API", "review")];
  const input = c.adoptionInput(items, { conventions: [CONVENTION] });
  assert.equal((await c.apply(input, 0)).code, 0);
  const wi = (key: string) => (c.show().then((data) => data.items.find((entry: any) => entry.origin.key === key).id as string));

  const changed = [md(K1, "Set up the rate limiter", "done", { body: "Per IP." }), md(K2, "Wire it into the gateway", "in_progress")];
  // Missing means gone from a source the input reads (§11.2), so the input names the GitHub repo too.
  const result = await c.preview(c.adoptionInput(changed, { conventions: [CONVENTION], sources: [{ kind: "markdown", ref: "PLAN.md" }, { kind: "github", ref: "acme/acme-api" }] }));
  assert.equal(result.code, 0, result.stdout);
  const data = result.json.data;
  assert.deepEqual(data.create, []);
  assert.equal(data.update.length, 1);
  assert.deepEqual([data.update[0].key, data.update[0].item], [K1, await wi(K1)]);
  assert.deepEqual(data.update[0].changes, { title: "Set up the rate limiter", body: "Per IP." }, "no status in changes");
  assert.deepEqual(data.untouched.map((entry: any) => [entry.key, entry.item, entry.reason]), [[K2, await wi(K2), "unchanged"]]);
  assert.deepEqual(data.missing.map((entry: any) => [entry.key, entry.item]), [[GH, await wi(GH)]]);
});

// ---------------------------------------------------------------- adopt apply

const applyInput = (c: Awaited<ReturnType<typeof setup>>, extra: Record<string, unknown> = {}) =>
  c.adoptionInput(planItems(), { selected: [K1, K2, K3, K5, GH], treatments: { [GH]: "mark_transferred" }, conventions: [CONVENTION], ...extra });

test("adopt apply creates items with the adopted meaning, history and resolved dependencies", async (context) => {
  const c = await setup(context);
  const result = await c.apply(applyInput(c), 0);
  assert.equal(result.code, 0, result.stdout);
  const items = (await c.show()).items as any[];
  assert.equal(items.length, 5);
  const by = (key: string) => items.find((entry) => entry.origin.key === key);
  const limiter = by(K1);
  assert.deepEqual([limiter.title, limiter.scope, limiter.status, limiter.approved_at, limiter.acceptance], ["Set up the limiter", "Set up the limiter", "todo", NOW, []]);
  assert.deepEqual(limiter.progress, [{ at: NOW, text: "Adopted from PLAN.md (to do there)" }], "no raw key or checkbox marker (CC-130)");
  assert.equal(by(K2).progress[0].text.includes("line:"), false);
  assert.deepEqual(by(K2).depends_on, [limiter.id]);
  const done = by(K3);
  assert.equal(done.status, "done");
  assert.deepEqual([done.accepted.statement, done.accepted.at], ["Done before adoption", NOW]);
  assert.equal(by(GH).status, "review");
  assert.equal(by(GH).progress[0].text, `Adopted from acme/acme-api ${GH} (In review there)`);
  assert.equal(done.progress[0].text, "Adopted from PLAN.md (done there)");
});

test("adopt apply opens a create_task per new item and records the map, runs and conventions", async (context) => {
  const c = await setup(context);
  assert.equal((await c.apply(applyInput(c), 0)).code, 0);
  const items = (await c.show()).items as any[];
  const creates = await c.openOps(undefined, "create_task");
  assert.deepEqual(creates.map((op) => op.target).sort(), items.map((entry) => entry.id).sort());
  const limiter = items.find((entry) => entry.origin.key === K1);
  assert.deepEqual(creates.find((op) => op.target === limiter.id).payload.status, "To Do");

  const record = await c.adoption();
  assert.equal(record.rev, 1);
  const mapped = (key: string) => record.map.find((entry: any) => entry.origin.key === key);
  assert.deepEqual([mapped(K1).treatment, mapped(K1).marked, mapped(K1).item], ["keep", true, limiter.id]);
  assert.deepEqual([mapped(GH).treatment, mapped(GH).marked], ["mark_transferred", false]);
  assert.equal(record.runs.length, 1);
  assert.deepEqual([record.runs[0].at, record.runs[0].created, record.runs[0].updated], [NOW, 5, 0]);
  assert.deepEqual(record.conventions, [CONVENTION]);
});

test("adopt apply needs a choice for each convention", async (context) => {
  const c = await setup(context);
  const result = await c.apply(c.adoptionInput(planItems(), { conventions: [{ rule: "Status lives in TASKS.md", source: "AGENTS.md" }] }), 0);
  assert.equal(result.json.error?.code, "INPUT_INVALID");
  assert.equal((await c.show()).items.length, 0);
});

test("adopt apply for Notion-origin items takes the existing page and updates only an empty Brain ID", async (context) => {
  const c = await setup(context);
  const empty = notionItem(page(40), "Existing, no Brain ID", "Doing", "in_progress");
  const meeting = notionItem(page(41), "Existing, from a meeting", "To Do", "todo", "mtg-4h8w2n6c");
  const result = await c.apply({ ...c.adoptionInput([empty, meeting], { sources: [{ kind: "notion", ref: "tasks" }], conventions: [] }) }, 0);
  assert.equal(result.code, 0, result.stdout);
  const items = (await c.show()).items as any[];
  const first = items.find((entry) => entry.origin.key === page(40));
  const second = items.find((entry) => entry.origin.key === page(41));
  assert.deepEqual([first.notion.page, first.notion.title, first.notion.status, first.notion.read_at], [page(40), "Existing, no Brain ID", "Doing", NOW]);
  assert.equal(second.notion.page, page(41));
  assert.equal(first.progress[0].text, "Adopted from Notion (Doing there)", "no page id in the progress line (CC-130)");
  assert.deepEqual(await c.openOps(undefined, "create_task"), []);
  const updates = await c.openOps(undefined, "update_task");
  assert.deepEqual(updates.map((op) => op.target), [first.id]);
  assert.equal(updates[0].payload.brain_id, first.id);
});

test("adopt apply needs a status_read meaning for an unknown Notion option, and stores it", async (context) => {
  const c = await setup(context);
  const items = [notionItem(page(40), "Someday task", "Someday", "todo")];
  const refused = await c.apply(c.adoptionInput(items, { sources: [{ kind: "notion", ref: "tasks" }] }), 0);
  assert.equal(refused.json.error?.code, "INPUT_INVALID");
  assert.equal((await c.show()).items.length, 0);
  const applied = await c.apply(c.adoptionInput(items, { sources: [{ kind: "notion", ref: "tasks" }], status_read: { Someday: "todo" } }), 0);
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal((await c.show()).workflow.status_read.Someday, "todo");
});

test("adopt apply with changes updates title and scope, sets approval, and never touches the status", async (context) => {
  const c = await setup(context);
  assert.equal((await c.apply(c.adoptionInput([md(K1, "Set up the limiter", "todo")], { conventions: [CONVENTION] }), 0)).code, 0);
  const id = (await c.show()).items[0].id;
  assert.equal((await c.patchItem(id, { status: "in_progress" })).code, 0);
  const later = "2026-12-11T09:00:00Z";
  const second = await c.call(["workflow", "adopt", "apply", c.wf, "--rev", String(await c.adoptionRev()), "--input", await c.file(c.adoptionInput([md(K1, "Set up the rate limiter", "done", { body: "Per IP." })], { conventions: [CONVENTION] }))], later);
  assert.equal(second.code, 0, second.stdout);
  const record = await c.item(id);
  assert.deepEqual([record.title, record.scope, record.status, record.approved_at], ["Set up the rate limiter", "Per IP.", "in_progress", later]);
  const runs = (await c.adoption()).runs;
  assert.equal(runs[runs.length - 1].updated, 1);
});

test("an adoption rerun with the same input creates nothing, and a stale --rev is refused", async (context) => {
  const c = await setup(context);
  const input = applyInput(c);
  assert.equal((await c.apply(input, 0)).code, 0);
  const items = (await c.show()).items.length;
  const ops = (await c.ops()).length;
  const rev = await c.adoptionRev();

  assert.equal((await c.apply(input, 0)).json.error?.code, "STALE_RECORD", "rev 0 is stale after the first run");
  const again = await c.apply(input, rev);
  assert.equal(again.code, 0, again.stdout);
  assert.equal((await c.show()).items.length, items);
  assert.equal((await c.ops()).length, ops);
  assert.equal((await c.adoption()).map.length, items);
});

test("reconcile opens mark_original only once the item has a page; a marked op resolves done and marks the map entry", async (context) => {
  const c = await setup(context);
  assert.equal((await c.apply(c.adoptionInput([gh("Rate limit the public API", "todo")], { treatments: { [GH]: "mark_transferred" }, conventions: [CONVENTION] }), 0)).code, 0);
  const id = (await c.show()).items[0].id;

  await c.reconcileOk([]);
  assert.deepEqual(await c.openOps(id, "mark_original"), [], "no page yet");
  const create = (await c.openOps(id, "create_task"))[0];
  await c.opState(create.id, "in_flight");
  assert.equal((await c.opState(create.id, "done", ["--page", page(5)])).code, 0);

  const data = await c.reconcileOk([task(page(5), id, "Rate limit the public API")]);
  const mark = (await c.openOps(id, "mark_original"))[0];
  assert.ok(mark);
  assert.equal(mark.payload.treatment, "mark_transferred");
  assert.deepEqual(mark.payload.origin, { kind: "github", ref: "acme/acme-api", key: GH });
  assert.ok(data.ops.includes(mark.id));
  await c.reconcileOk([task(page(5), id, "Rate limit the public API")]);
  assert.equal((await c.openOps(id, "mark_original")).length, 1, "opened once");

  await c.opState(mark.id, "in_flight");
  const resolved = await c.reconcileOk([task(page(5), id, "Rate limit the public API")], { read_at: "2026-12-10T09:11:00Z", extra: { marked: [mark.id] } });
  assert.ok(resolved.routine.some((entry: any) => entry.kind === "op_resolved"));
  assert.deepEqual(await c.openOps(id, "mark_original"), []);
  assert.equal((await c.adoption()).map[0].marked, true);
});

// ---------------------------------------------------------------- §14 shared checks

test("a failed operation is retried at the next run while the summary says Work complete, 1 not yet in Notion.", async (context) => {
  const c = await setup(context);
  const id = await c.addItem("Add rate limiting");
  assert.equal((await c.patchItem(id, { status: "done", accepted: { statement: "Accepted in chat" } })).code, 0);
  await c.reconcileOk([], { start: true });
  const op = (await c.openOps(id, "create_task"))[0];
  await c.opState(op.id, "in_flight");
  await c.opState(op.id, "failed", ["--error", JSON.stringify({ code: "permission", message: "no access", lasting: true })]);

  const summary = await c.ok(["workflow", "summary", c.wf]);
  assert.ok(summary.markdown.includes("Work complete, 1 not yet in Notion."), summary.markdown);

  const next = await c.reconcileOk([], { start: true });
  assert.equal((await c.openOps(id, "create_task"))[0].state, "pending");
  assert.ok(next.ops.includes(op.id));
});

test("a stale record revision is refused by workflow set", async (context) => {
  const c = await setup(context);
  const rev = (await c.show()).workflow.rev;
  const ok = await c.call(["workflow", "set", c.wf, "--rev", String(rev), "--input", await c.file({ modules_offered: ["documents"] })]);
  assert.equal(ok.code, 0, ok.stdout);
  const stale = await c.call(["workflow", "set", c.wf, "--rev", String(rev), "--input", await c.file({ modules_offered: [] })]);
  assert.equal(stale.json.error?.code, "STALE_RECORD");
});
