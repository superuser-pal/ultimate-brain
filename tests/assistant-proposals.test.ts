import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-144: the proposal kinds notion_change and set_field (spec/assistant.md §6, schema §11, cli §5.6, §5.7, §5.14).
const NOW = "2026-11-06T10:00:00Z";
const DECIDED = "2026-11-06T10:05:00Z";
const SOURCE = "agent:ultimate-assistant/20261106T100000Z";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PAGE = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";
const CLIENTS = "area-2m7c4h8n";
const CLIENTS_PAGE = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const PERSONAL = "area-6p3r8t2w";
const PERSONAL_PAGE = "5d4c3b2a-1908-4f7e-8d6c-5b4a39281706";
const WORK = "dom-3k7m2p9x";
const WORK_PAGE = "8e7d6c5b-4a39-4281-9706-f5e4d3c2b1a0";
const TASK_PAGE = "2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e";
const TASK_FINDING = `task_overdue:notion:${TASK_PAGE}`;

let counter = 0;
async function file(dir: string, value: unknown): Promise<string> {
  const path = join(dir, "..", `input-${counter += 1}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function run(dir: string, args: string[], input?: unknown) {
  return brain([...args, "--brain", dir, "--now", NOW, "--json", ...(input === undefined ? [] : ["--input", await file(dir, input)])]);
}

const common = (title: string, notion: string) => `title: ${title}\nsummary: ${title}.\nlifecycle: reviewed\nsources: [notion:${notion}]\ncreated: 2026-09-15\nupdated: 2026-09-15\nnotion: ${notion}\n`;

/** The fixture brain, with a second Area, a Domain and the Domains module on (all synthetic). */
async function setup(context: TestContext): Promise<string> {
  const dir = await fixtureCopy(context);
  await writeFile(join(dir, "areas/personal.md"), `---\nid: ${PERSONAL}\ntype: area\n${common("Personal", PERSONAL_PAGE)}---\n`);
  await mkdir(join(dir, "domains"), { recursive: true });
  await writeFile(join(dir, "domains/work.md"), `---\nid: ${WORK}\ntype: domain\n${common("Work", WORK_PAGE)}---\n`);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.modules = { domains: true, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true };
  config.notion.databases.domains = "a1000000-0000-4000-8000-00000000000c";
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

const change = (fields: Record<string, unknown>) => ({ kind: "notion_change", why: "due 29 Oct, 8 days late", source: SOURCE, ...fields });
const taskChange = (property: string, value_before: unknown, value_after: unknown, extra: Record<string, unknown> = {}) =>
  change({ database: "tasks", page: TASK_PAGE, page_title: "Send the revised quote", property, value_before, value_after, finding: TASK_FINDING, area: CLIENTS, ...extra });

async function attributes(dir: string, path: string): Promise<Record<string, any>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

async function lintClean(dir: string): Promise<void> {
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
}

const approve = (proposal: string, extra: Record<string, unknown> = {}) => ({ decisions: [{ proposal, action: "approve", decided_at: DECIDED, decided_by: "chat", ...extra }] });

const cases: Array<{ name: string; item: Record<string, unknown>; title: string; property: string; payload: unknown; expect: unknown; value: unknown }> = [
  { name: "task status", item: taskChange("status", "To Do", "Done"), title: "Send the revised quote: Status → Done", property: "Status", payload: { type: "select", value: "Done" }, expect: "To Do", value: "Done" },
  { name: "task due", item: taskChange("due", "2026-10-29", "2026-11-13"), title: "Send the revised quote: Due → 2026-11-13", property: "Due", payload: { type: "date", value: { start: "2026-11-13", end: null } }, expect: "2026-10-29", value: "2026-11-13" },
  { name: "task due cleared", item: taskChange("due", "2026-10-29", null), title: "Send the revised quote: Due → none", property: "Due", payload: { type: "date", value: null }, expect: "2026-10-29", value: null },
  { name: "task project", item: taskChange("project", [], [PROJECT_PAGE], { finding: `task_no_project:notion:${TASK_PAGE}` }), title: "Send the revised quote: Project → Acme website", property: "Project", payload: { type: "relation", value: [PROJECT_PAGE] }, expect: [], value: [PROJECT_PAGE] },
  { name: "task area", item: taskChange("area", [CLIENTS_PAGE], [PERSONAL_PAGE], { finding: undefined }), title: "Send the revised quote: Area → Personal", property: "Area", payload: { type: "relation", value: [PERSONAL_PAGE] }, expect: [CLIENTS_PAGE], value: [PERSONAL_PAGE] },
  { name: "project status", item: change({ database: "projects", target: PROJECT, page: PROJECT_PAGE, page_title: "Acme website", property: "status", value_before: "Active", value_after: "On Hold", finding: `project_stalled:${PROJECT}` }), title: "Acme website: Status → On Hold", property: "Status", payload: { type: "select", value: "On Hold" }, expect: "Active", value: "On Hold" },
  { name: "area archived", item: change({ database: "areas", target: PERSONAL, page: PERSONAL_PAGE, page_title: "Personal", property: "archived", value_before: false, value_after: true, finding: `area_empty:${PERSONAL}` }), title: "Personal: Archived → yes", property: "Archived", payload: { type: "checkbox", value: true }, expect: false, value: true },
];

for (const [index, entry] of cases.entries()) {
  test(`notion_change ${entry.name}: proposed, applied to notion_writes, settled`, async (context) => {
    const dir = await setup(context);
    const item = Object.fromEntries(Object.entries(entry.item).filter(([, value]) => value !== undefined));
    const created = await run(dir, ["proposal", "new"], { proposals: [item] });
    assert.equal(created.code, 0, created.stdout);
    const { id, path, title } = created.json.data.created[0];
    assert.equal(title, entry.title);
    const stored = await attributes(dir, path);
    assert.equal(stored.status, "pending");
    assert.deepEqual(stored.value_after, entry.value);

    const applied = await run(dir, ["apply"], approve(id));
    assert.equal(applied.code, 0, applied.stdout);
    assert.equal(applied.json.data.decisions[0].result, "awaiting_notion");
    assert.equal(applied.json.data.summary.awaiting_notion, 1);
    const database = String(item.database);
    assert.deepEqual(applied.json.data.notion_writes, [{ proposal: id, database, page_id: item.page, property: entry.property, payload: entry.payload, expect: entry.expect, value: entry.value }]);
    assert.equal((await attributes(dir, path)).status, "approved");

    // Alternate the outcome so both settle results are covered across the properties.
    const result = index % 2 === 0 ? "applied" : "stale";
    const settled = await run(dir, ["proposal", "settle"], { settled: [{ proposal: id, result }] });
    assert.equal(settled.code, 0, settled.stdout);
    assert.deepEqual(settled.json.data.settled, [{ proposal: id, result: result === "applied" ? "applied" : "closed", changed: [path] }]);
    const after = await attributes(dir, path);
    assert.equal(after.status, result === "applied" ? "applied" : "closed");
    assert.equal(after.closed_reason, result === "applied" ? undefined : "stale");
    await lintClean(dir);
  });
}

test("notion_change: a failed write leaves it approved, and the next apply hands the same write back", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "Done")] });
  const { id, path } = created.json.data.created[0];
  const first = await run(dir, ["apply"], approve(id));
  const before = await readFile(join(dir, path), "utf8");
  // The skill's write failed: no settle. A replay of the recorded decision returns the same write and leaves the file as it is.
  const again = await run(dir, ["apply"], approve(id, { decided_at: "2026-11-06T11:00:00Z" }));
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data.notion_writes, first.json.data.notion_writes);
  assert.equal(await readFile(join(dir, path), "utf8"), before);
  // Without --input too: every recorded decision that is not terminal.
  const all = await run(dir, ["apply"]);
  assert.deepEqual(all.json.data.notion_writes, first.json.data.notion_writes);
  assert.deepEqual((await run(dir, ["proposal", "list"], undefined)).json.data.proposals.filter((p: any) => p.id === id).map((p: any) => p.status), ["approved"]);
});

test("notion_change: fix writes the fix's value; a value of the wrong shape fails; reject closes; --record-only returns no write", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [taskChange("due", "2026-10-29", "2026-11-13"), taskChange("status", "To Do", "Done"), taskChange("status", "To Do", "Won't Do"), taskChange("due", "2026-10-29", "2026-11-20")] });
  const [due, status, dropped, later] = created.json.data.created.map((item: any) => item.id);
  const fixed = await run(dir, ["apply"], approve(due, { action: "fix", note: "Friday", fixes: [{ value: "2026-11-14" }] }));
  assert.equal(fixed.json.data.decisions[0].result, "awaiting_notion");
  assert.equal(fixed.json.data.notion_writes[0].value, "2026-11-14");
  assert.equal(fixed.json.data.notion_writes[0].expect, "2026-10-29");
  assert.equal((await attributes(dir, created.json.data.created[0].path)).status, "edited");

  const bad = await run(dir, ["apply"], approve(status, { action: "fix", note: "x", fixes: [{ value: 3 }] }));
  assert.equal(bad.code, 1);
  assert.equal(bad.json.data.decisions[0].reason, "INVALID_RESULT");

  const rejected = await run(dir, ["apply"], approve(dropped, { action: "reject" }));
  assert.equal(rejected.json.data.decisions[0].result, "closed");
  assert.deepEqual(rejected.json.data.notion_writes, []);

  const recorded = await run(dir, ["apply", "--record-only"], approve(later));
  assert.equal(recorded.json.data.decisions[0].result, "recorded");
  assert.deepEqual(recorded.json.data.notion_writes, []);
});

test("notion_change: a mapping emptied since the proposal fails NOT_MAPPED and leaves it unchanged", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [taskChange("due", "2026-10-29", "2026-11-13")] });
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.tasks.properties.due = "";
  await writeFile(join(dir, "brain.json"), JSON.stringify(config));
  const applied = await run(dir, ["apply"], approve(created.json.data.created[0].id));
  assert.equal(applied.code, 1);
  assert.equal(applied.json.data.decisions[0].reason, "NOT_MAPPED");
  assert.equal((await attributes(dir, created.json.data.created[0].path)).status, "pending");
});

test("notion_change: the status_type of the Tasks mapping types a task status", async (context) => {
  const dir = await setup(context);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.tasks.status_type = "status";
  await writeFile(join(dir, "brain.json"), JSON.stringify(config));
  const created = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "Done")] });
  const applied = await run(dir, ["apply"], approve(created.json.data.created[0].id));
  assert.deepEqual(applied.json.data.notion_writes[0].payload, { type: "status", value: "Done" });
});

test("proposal new refuses a notion_change that doesn't fit; skips NO_CHANGE and DUPLICATE_PENDING", async (context) => {
  const dir = await setup(context);
  const refused = async (item: Record<string, unknown>, code: string, pointer: RegExp) => {
    const result = await run(dir, ["proposal", "new"], { proposals: [item] });
    assert.notEqual(result.code, 0, JSON.stringify(item));
    assert.equal(result.json.error.code, code, result.stdout);
    assert.match(result.stdout, pointer);
  };
  await refused(taskChange("status", "To Do", "Done", { target: PROJECT }), "INPUT_INVALID", /target/);
  await refused(taskChange("archived", false, true), "INPUT_INVALID", /property/);
  await refused(taskChange("status", "To Do", null), "INPUT_INVALID", /value_after/);
  await refused(taskChange("project", [], [PERSONAL_PAGE, CLIENTS_PAGE]), "INPUT_INVALID", /value_after/);
  await refused(taskChange("status", "To Do", "Done", { page: "2B8C4D6E1F3A4B5C8D7E9F0A1B2C3D4E" }), "INPUT_INVALID", /page/);
  await refused(change({ database: "projects", page: PROJECT_PAGE, page_title: "Acme website", property: "status", value_before: "Active", value_after: "On Hold" }), "INPUT_INVALID", /target/);
  await refused(change({ database: "projects", target: PROJECT, page: TASK_PAGE, page_title: "Acme website", property: "status", value_before: "Active", value_after: "On Hold" }), "INPUT_INVALID", /page/);
  await refused(change({ database: "projects", target: CLIENTS, page: CLIENTS_PAGE, page_title: "Clients", property: "status", value_before: "Active", value_after: "On Hold" }), "INPUT_INVALID", /target/);
  await refused(change({ database: "projects", target: PROJECT, page: PROJECT_PAGE, page_title: "Acme website", property: "status", value_before: "Active", value_after: "Paused" }), "INPUT_INVALID", /value_after/);
  await refused(taskChange("status", "To Do", "Done", { area: "area-zzzzzzzz" }), "UNKNOWN_ID", /area/);

  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.tasks.properties.due = "";
  await writeFile(join(dir, "brain.json"), JSON.stringify(config));
  await refused(taskChange("due", null, "2026-11-13"), "INPUT_INVALID", /property/);
  config.notion.tasks.properties.due = "Due";
  config.modules.tasks = false;
  await writeFile(join(dir, "brain.json"), JSON.stringify(config));
  await refused(taskChange("due", null, "2026-11-13"), "MODULE_OFF", /tasks/i);
  config.modules.tasks = true;
  await writeFile(join(dir, "brain.json"), JSON.stringify(config));

  const same = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "To Do")] });
  assert.deepEqual(same.json.data.skipped, [{ input_index: 0, reason: "NO_CHANGE" }]);

  const first = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "Done")] });
  const id = first.json.data.created[0].id;
  const pending = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "Doing", "Done", { finding: undefined })] });
  assert.deepEqual(pending.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: id }]);
  await run(dir, ["apply"], approve(id));
  const approved = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "Done")] });
  assert.deepEqual(approved.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: id }]);
  await run(dir, ["proposal", "settle"], { settled: [{ proposal: id, result: "applied" }] });
  const again = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "Done")] });
  assert.equal(again.json.data.created.length, 1, "an applied one doesn't block a new one");
  await lintClean(dir);
});

test("proposal settle: NOT_AWAITING, UNKNOWN_ID and ALREADY_TERMINAL; exit 1 on a failed item; --dry-run writes nothing", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [taskChange("status", "To Do", "Done"), taskChange("due", "2026-10-29", "2026-11-13")] });
  const [waiting, pending] = created.json.data.created.map((item: any) => item.id);
  await run(dir, ["apply"], approve(waiting));
  const dry = await run(dir, ["proposal", "settle", "--dry-run"], { settled: [{ proposal: waiting, result: "applied" }] });
  assert.equal(dry.json.data.dry_run, true);
  assert.equal((await attributes(dir, created.json.data.created[0].path)).status, "approved");
  const settled = await run(dir, ["proposal", "settle"], { settled: [
    { proposal: waiting, result: "applied" },
    { proposal: waiting, result: "applied" },
    { proposal: pending, result: "applied" },
    { proposal: "prp-zzzzzzzz", result: "stale" },
    { proposal: "prp-9d3f7h2k", result: "applied" },
  ] });
  assert.equal(settled.code, 1);
  assert.deepEqual(settled.json.data.settled.map((item: any) => [item.result, item.reason]), [
    ["applied", undefined], ["skipped", "ALREADY_TERMINAL"], ["failed", "NOT_AWAITING"], ["failed", "UNKNOWN_ID"], ["failed", "NOT_AWAITING"],
  ]);
  const bad = await run(dir, ["proposal", "settle"], { settled: [{ proposal: waiting, result: "done" }] });
  assert.equal(bad.json.error.code, "INPUT_INVALID");
  const log = await readFile(join(dir, "log", "2026-11.md"), "utf8");
  assert.match(log, new RegExp(`apply ${waiting} "Send the revised quote: Status → Done" result=applied`));
});

test("set_field moves a project to another Area; its open tasks follow through notion_change; render publishes the Area", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", target: PROJECT, field: "area", after: PERSONAL, why: "in Clients, but 3 of its 4 notes are in Personal", source: SOURCE, finding: `project_misplaced:${PROJECT}` }] });
  assert.equal(created.code, 0, created.stdout);
  const { id, path, title, before } = created.json.data.created[0];
  assert.equal(title, "Acme website: Area → Personal");
  assert.equal(before, CLIENTS);
  assert.equal((await attributes(dir, path)).area, CLIENTS, "a set_field's area is the target's own Area when not given");

  const applied = await run(dir, ["apply"], approve(id));
  assert.equal(applied.json.data.decisions[0].result, "applied");
  assert.deepEqual(applied.json.data.decisions[0].changed.sort(), [path, "projects/acme-website/project.md"].sort());
  assert.deepEqual(applied.json.data.notion_writes, []);
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).area, PERSONAL);

  // The project's open task that names the old Area follows, under the same yes (assistant.md §6.1): no finding, the finding's area.
  const tasks = await run(dir, ["proposal", "new"], { proposals: [taskChange("area", [CLIENTS_PAGE], [PERSONAL_PAGE], { finding: undefined, why: "follows Acme website to Personal" })] });
  const taskId = tasks.json.data.created[0].id;
  const written = await run(dir, ["apply"], approve(taskId));
  assert.deepEqual(written.json.data.notion_writes[0].payload, { type: "relation", value: [PERSONAL_PAGE] });
  await run(dir, ["proposal", "settle"], { settled: [{ proposal: taskId, result: "applied" }] });

  const rendered = await run(dir, ["sync", "render", "--ids", PROJECT]);
  assert.deepEqual(rendered.json.data.items[0].properties.Area, { type: "relation", value: [PERSONAL_PAGE] });
  await lintClean(dir);
});

test("set_field puts an Area in a Domain; stale, fix and the checks of proposal new", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", target: CLIENTS, field: "domain", after: WORK, why: "no Domain", source: SOURCE, finding: `area_no_domain:${CLIENTS}` }] });
  const { id, path, title, before } = created.json.data.created[0];
  assert.equal(title, "Clients: Domain → Work");
  assert.equal(before, undefined);
  assert.equal((await attributes(dir, path)).area, CLIENTS, "an Area's set_field shows in its own home");
  const duplicate = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", target: CLIENTS, field: "domain", after: WORK, why: "again", source: SOURCE }] });
  assert.deepEqual(duplicate.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: id }]);
  const applied = await run(dir, ["apply"], approve(id));
  assert.equal(applied.json.data.decisions[0].result, "applied");
  assert.equal((await attributes(dir, "areas/clients.md")).domain, WORK);
  const noChange = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", target: CLIENTS, field: "domain", after: WORK, why: "x", source: SOURCE }] });
  assert.deepEqual(noChange.json.data.skipped, [{ input_index: 0, reason: "NO_CHANGE" }]);

  // Stale: the target's value moved after the proposal was written.
  const moved = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", target: PROJECT, field: "area", after: PERSONAL, why: "x", source: SOURCE }] });
  const project = join(dir, "projects/acme-website/project.md");
  const document = parseFrontmatter(await readFile(project, "utf8"));
  document.attributes.area = PERSONAL;
  await writeFile(project, serializeFrontmatter(document));
  const stale = await run(dir, ["apply"], approve(moved.json.data.created[0].id));
  assert.equal(stale.json.data.decisions[0].result, "closed");
  assert.equal(stale.json.data.decisions[0].reason, "STALE_PROPOSAL");
  document.attributes.area = CLIENTS;
  await writeFile(project, serializeFrontmatter(document));

  // Fix: another id of the field's type; anything else is INVALID_RESULT.
  const again = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", target: PROJECT, field: "area", after: PERSONAL, why: "x", source: SOURCE, before: CLIENTS }] });
  const fixId = again.json.data.created[0].id;
  const wrong = await run(dir, ["apply"], approve(fixId, { action: "fix", note: "Work", fixes: [{ value: WORK }] }));
  assert.equal(wrong.json.data.decisions[0].reason, "INVALID_RESULT");
  const fixed = await run(dir, ["apply"], approve(fixId, { action: "fix", note: "keep it in Clients, the other one", fixes: [{ value: PERSONAL }] }));
  assert.equal(fixed.json.data.decisions[0].result, "applied");

  const refused = async (item: Record<string, unknown>, code: string) => {
    const result = await run(dir, ["proposal", "new"], { proposals: [{ kind: "set_field", why: "x", source: SOURCE, ...item }] });
    assert.equal(result.json.error?.code, code, result.stdout);
  };
  await refused({ target: PROJECT, field: "domain", after: WORK }, "INPUT_INVALID");
  await refused({ target: PROJECT, field: "area", after: WORK }, "INPUT_INVALID");
  await refused({ target: PROJECT, field: "area", after: "area-zzzzzzzz" }, "UNKNOWN_ID");
  await refused({ target: PROJECT, field: "area", after: CLIENTS, before: CLIENTS }, "BEFORE_MISMATCH");
  await lintClean(dir);
});

test("sync render: Suggestion rows for notion_change and set_field; a yes in chat never becomes a row", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    taskChange("project", [], [PROJECT_PAGE], { finding: `task_no_project:notion:${TASK_PAGE}`, why: "no project" }),
    change({ database: "projects", target: PROJECT, page: PROJECT_PAGE, page_title: "Acme website", property: "status", value_before: null, value_after: "On Hold", why: "nothing done for 23 days", area: CLIENTS }),
    { kind: "set_field", target: PROJECT, field: "area", after: PERSONAL, why: "misplaced", source: SOURCE },
    taskChange("due", "2026-10-29", "2026-11-13"),
  ] });
  const [task, project, move, chat] = created.json.data.created.map((item: any) => item.id);
  await run(dir, ["apply"], approve(chat));

  const rendered = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(rendered.code, 0, rendered.stdout);
  const items = new Map(rendered.json.data.items.filter((item: any) => item.database === "review").map((item: any) => [item.id, item]));
  assert.equal(items.has(chat), false, "decided in chat before it had a row");
  const props = (id: string) => (items.get(id) as any).properties;
  assert.deepEqual(props(task).Name, { type: "title", value: "Suggestion: Send the revised quote: Project → Acme website" });
  assert.deepEqual(props(task).Kind, { type: "select", value: "Notion Change" });
  assert.equal(props(task).About.value, "Send the revised quote (task)");
  assert.equal(props(task)["About Page"].value, `https://www.notion.so/${TASK_PAGE.replaceAll("-", "")}`);
  assert.equal(props(task).Now.value, "Project: none");
  assert.equal(props(task).Proposed.value, "Project: Acme website");
  assert.deepEqual(props(task).Area, { type: "relation", value: [CLIENTS_PAGE] });
  assert.equal(props(task)["Source Meeting"], undefined);
  assert.equal(props(project).About.value, `Acme website (${PROJECT})`);
  assert.equal(props(project).Now.value, "Status: none");
  assert.equal(props(project).Proposed.value, "Status: On Hold");
  assert.deepEqual(props(move).Kind, { type: "select", value: "Set Field" });
  assert.deepEqual(props(move).Name, { type: "title", value: "Suggestion: Acme website: Area → Personal" });
  assert.equal(props(move)["About Page"].value, `https://www.notion.so/${PROJECT_PAGE.replaceAll("-", "")}`);
  assert.equal(props(move).Now.value, "Area: Clients");
  assert.equal(props(move).Proposed.value, "Area: Personal");
  assert.deepEqual(props(move).Area, { type: "relation", value: [CLIENTS_PAGE] });

  const byIds = await run(dir, ["sync", "render", "--ids", chat]);
  assert.deepEqual(byIds.json.data.skipped, [{ id: chat, reason: "DECIDED_IN_CHAT" }]);
  assert.deepEqual(byIds.json.data.items, []);
});

test("a decided Suggestion row is read by sync plan and applied by sync apply, which returns its write", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [change({ database: "projects", target: PROJECT, page: PROJECT_PAGE, page_title: "Acme website", property: "status", value_before: "Active", value_after: "Done", finding: `project_done_but_open:${PROJECT}` })] });
  const { id, path } = created.json.data.created[0];
  const rendered = await run(dir, ["sync", "render", "--ids", id]);
  const item = rendered.json.data.items[0];
  const ROW = "6c5d4e3f-2a1b-4c0d-9e8f-7a6b5c4d3e2f";
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: ROW, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);

  const snapshot = { as_of: NOW, rows: [{ database: "review", page_id: ROW, last_edited: DECIDED, properties: { "Brain ID": id, Name: item.published.Name, State: "Pending", "Your call": "Approve", "What to fix": "" } }] };
  const plan = await run(dir, ["sync", "plan"], snapshot);
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.decisions, [{ proposal: id, action: "approve", decided_at: DECIDED, decided_by: "notion" }]);
  const applied = await run(dir, ["sync", "apply"], plan.json.data);
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(applied.json.data.decisions[0].result, "awaiting_notion");
  assert.equal(applied.json.data.summary.awaiting_notion, 1);
  assert.deepEqual(applied.json.data.notion_writes, [{ proposal: id, database: "projects", page_id: PROJECT_PAGE, property: "Status", payload: { type: "select", value: "Done" }, expect: "Active", value: "Done" }]);
  assert.equal((await attributes(dir, path)).status, "approved");
});

test("sync tasks --direct renders a task with no meeting, source, backlink or Brain ID", async (context) => {
  const dir = await setup(context);
  const rendered = await run(dir, ["sync", "tasks", "--direct"], { items: [
    { title: "Call the client about the contract", due: "2026-11-13", projects: [PROJECT], owner: "Someone" },
    { title: "Plan the onboarding guide", area: PERSONAL },
    { title: "Send the signed contract", owner: "Lucía", status: "waiting_on" },
  ] });
  assert.equal(rendered.code, 0, rendered.stdout);
  const [first, second, third] = rendered.json.data.items;
  assert.deepEqual(first.properties, {
    Name: { type: "title", value: "Call the client about the contract" }, Status: { type: "select", value: "To Do" },
    Due: { type: "date", value: { start: "2026-11-13", end: null } }, Project: { type: "relation", value: [PROJECT_PAGE] }, Area: { type: "relation", value: [CLIENTS_PAGE] },
  });
  assert.deepEqual(second.properties, { Name: { type: "title", value: "Plan the onboarding guide" }, Status: { type: "select", value: "To Do" }, Project: { type: "relation", value: [] }, Area: { type: "relation", value: [PERSONAL_PAGE] } });
  assert.equal(third.properties.Status.value, "Waiting On");
  assert.deepEqual(first.pending_relations, []);

  const refuse = async (items: unknown[], code: string) => assert.equal((await run(dir, ["sync", "tasks", "--direct"], { items })).json.error?.code, code);
  await refuse([{ title: "x", item: "s1.i1" }], "INPUT_INVALID");
  await refuse([{ title: "x", area: "area-zzzzzzzz" }], "UNKNOWN_ID");
  await refuse([{ title: "x", area: PROJECT }], "INPUT_INVALID");
  assert.equal((await brain(["sync", "tasks", "--direct", "--meeting", "mtg-8c4n2p7w", "--brain", dir, "--input", await file(dir, { items: [] }), "--json"])).json.error.code, "USAGE");
});

test("any kind may carry a finding", async (context) => {
  const dir = await setup(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Budget", target: PROJECT, field: "budget", after: "90000 EUR", why: "w", source: SOURCE, finding: `project_stalled:${PROJECT}` }] });
  assert.equal(created.code, 0, created.stdout);
  assert.equal((await attributes(dir, created.json.data.created[0].path)).finding, `project_stalled:${PROJECT}`);
});
