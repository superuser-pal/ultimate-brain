// A task's Area follows its Project, or with no Project its Factory (0.18.0, decisions 0113 §9 and 0114; capture-and-review §6.5; cli §5.7, §5.14.1,
// §5.14.2, §5.14.5, §5.14.10). Synthetic brain (tests/fixtures/brain-acme) with more areas and projects, and a simulated Notion snapshot.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Socket } from "node:net";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter, serializeFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const EDITED = "2026-12-10T08:00:00Z";
const page = (n: number) => `e2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** The fixture's area and project; the others are added by setUp. */
const CLIENTS = "area-2m7c4h8n"; const CLIENTS_PAGE = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const WEBSITE = "prj-9x4t1b7e"; const WEBSITE_PAGE = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";
const TRAINING = "area-3n8w5t2c"; const TRAINING_PAGE = page(1);
/** An area with no Notion page yet. */
const QUIET = "area-4p9x6v3d";
const SHOP = "prj-2c5d7f9g"; const SHOP_PAGE = page(2); // Clients
const COURSE = "prj-3d6f8g1h"; const COURSE_PAGE = page(3); // Training
const HIDDEN = "prj-4f7g9h2j"; const HIDDEN_PAGE = page(4); // Quiet
const TASK = page(10); const TASK_2 = page(11); const TASK_3 = page(12);
const MEETING = "mtg-8c4n2p7w";
const QUESTION_PATH = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const MEETING_PATH = "knowledge/meetings/2026-12-03-acme-sync.md";

let counter = 0;
async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const path = join(dir, "..", `task-areas-${counter += 1}.json`);
    await writeFile(path, JSON.stringify(input));
    extra.push("--input", path);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}
async function ok(dir: string, args: string[], input?: unknown) {
  const result = await run(dir, args, input);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  return result.json;
}

async function edit(dir: string, path: string, change: (attributes: Record<string, unknown>) => void): Promise<void> {
  const document = parseFrontmatter(await readFile(join(dir, path), "utf8"));
  change(document.attributes);
  await writeFile(join(dir, path), serializeFrontmatter(document));
}
async function config(dir: string, change: (config: any) => void): Promise<void> {
  const value = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  change(value);
  await writeFile(join(dir, "brain.json"), JSON.stringify(value, null, 2));
}

async function setUp(context: TestContext): Promise<string> {
  const dir = await fixtureCopy(context);
  const note = (id: string, type: string, title: string, notion: string | undefined, extra: Record<string, unknown> = {}) => serializeNewFile({ id, type, title, summary: title, lifecycle: "reviewed", ...extra, created: "2026-12-01", updated: "2026-12-01", ...(notion === undefined ? {} : { notion }) }, "");
  await writeFile(join(dir, "areas/training.md"), note(TRAINING, "area", "Training", TRAINING_PAGE));
  await writeFile(join(dir, "areas/quiet.md"), note(QUIET, "area", "Quiet", undefined));
  for (const [id, slug, notion, area] of [[SHOP, "shop", SHOP_PAGE, CLIENTS], [COURSE, "course", COURSE_PAGE, TRAINING], [HIDDEN, "hidden", HIDDEN_PAGE, QUIET]] as const) {
    await mkdir(join(dir, "projects", slug), { recursive: true });
    await writeFile(join(dir, "projects", slug, "project.md"), note(id, "project", slug, notion, { area }));
  }
  return dir;
}

type Properties = Record<string, unknown>;
const row = (properties: Properties, id = TASK, extra: Record<string, unknown> = {}) => ({ database: "tasks", page_id: id, last_edited: EDITED, properties: { Name: "Draft the site copy", Status: "To Do", Area: [], Project: [], ...properties }, ...extra });
const without = (value: ReturnType<typeof row>, name: string) => { const properties: Properties = { ...value.properties }; delete properties[name]; return { ...value, properties }; };
const fill = (area: string, areaPage: string, from = "project", id = TASK, property = "Area", title = "Draft the site copy") => ({ page_id: id, title, area, from, property, payload: { type: "relation", value: [areaPage], mode: "if_empty" } });
const unset = (reason: string, id = TASK) => ({ page_id: id, title: "Draft the site copy", reason });

async function plan(dir: string, rows: unknown[]) { return (await ok(dir, ["sync", "plan"], { as_of: NOW, rows })).data; }
/** [task_areas, task_areas_unset] of one plan. */
async function areas(dir: string, ...rows: unknown[]) { const data = await plan(dir, rows); return [data.task_areas, data.task_areas_unset]; }
const NOTHING = [[], []];

const relation = (value: string) => ({ type: "relation", value: [value] });
async function tasks(dir: string, args: string[], items: unknown[]) { const json = await ok(dir, ["sync", "tasks", ...args], { items }); return { areas: json.data.items.map((item: any) => item.properties.Area), warnings: json.warnings, data: json.data }; }
const NOT_SET = (place: number, title: string) => ({ code: "TASK_AREA_NOT_SET", message: `Item ${place} "${title}": its Projects are in different Areas, so no Area is set (cli §5.14.5)` });

// --- the fill list of a catch-up (cli §5.14.2) ---

test("a task with a Project and no Area gets the Project's Area, if empty; Domains off changes nothing", async (context) => {
  const dir = await setUp(context);
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE] })), [[fill(CLIENTS, CLIENTS_PAGE)], []]);
  await config(dir, (value) => { value.modules = { domains: true, tasks: true }; });
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE] })), [[fill(CLIENTS, CLIENTS_PAGE)], []]);
});

test("an Area the user set is never changed: not in the plan, also when it differs from the Project's", async (context) => {
  const dir = await setUp(context);
  assert.deepEqual(await areas(dir, row({ Area: [TRAINING_PAGE], Project: [WEBSITE_PAGE] })), NOTHING);
  assert.deepEqual(await areas(dir, row({ Area: [CLIENTS_PAGE], Project: [WEBSITE_PAGE] })), NOTHING);
  assert.deepEqual(await areas(dir, without(row({ Project: [WEBSITE_PAGE] }), "Area")), NOTHING, "an Area that was not read is not empty");
});

test("Projects that share an Area give it; Projects in different Areas set none and are reported", async (context) => {
  const dir = await setUp(context);
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE, SHOP_PAGE].sort() })), [[fill(CLIENTS, CLIENTS_PAGE)], []]);
  assert.deepEqual(await areas(dir, row({ Project: [COURSE_PAGE, WEBSITE_PAGE].sort() })), [[], [unset("DIFFERENT_AREAS")]]);
});

test("a Project or an Area the brain doesn't know yet sets nothing; one this plan creates counts", async (context) => {
  const dir = await setUp(context);
  assert.deepEqual(await areas(dir, row({ Project: [page(90)] })), [[], [unset("NOT_IN_BRAIN")]]);
  assert.deepEqual(await areas(dir, row({ Project: [page(90), WEBSITE_PAGE] })), [[], [unset("NOT_IN_BRAIN")]], "never guessed from the Projects that are known");
  assert.deepEqual(await areas(dir, row({ Project: [HIDDEN_PAGE] })), [[], [unset("NOT_IN_BRAIN")]], "its Area has no page yet");
  assert.deepEqual(await areas(dir, row({ Project: [CLIENTS_PAGE] })), [[], [unset("NOT_IN_BRAIN")]], "the page is not a project's");
  // Created in Notion since the last run: the project in a known Area, and a project in a new Area.
  const project = (id: string, name: string, area: string) => ({ database: "projects", page_id: id, last_edited: EDITED, properties: { Name: name, Summary: name, "Brain ID": "", Area: [area] } });
  const area = { database: "areas", page_id: page(91), last_edited: EDITED, properties: { Name: "Writing", Summary: "Writing", "Brain ID": "" } };
  const data = await plan(dir, [project(page(90), "Podcast", TRAINING_PAGE), project(page(92), "Book", page(91)), area, row({ Project: [page(90)] }), row({ Project: [page(92)] }, TASK_2)]);
  const writing = data.create.find((item: any) => item.title === "Writing").id;
  assert.deepEqual([data.task_areas, data.task_areas_unset], [[fill(TRAINING, TRAINING_PAGE), fill(writing, page(91), "project", TASK_2)], []]);
  // A project the plan can't create (no Area) is not in the brain.
  const broken = { ...project(page(93), "No area", TRAINING_PAGE), properties: { Name: "No area", Summary: "No area", "Brain ID": "", Area: [] } };
  assert.deepEqual(await areas(dir, broken, row({ Project: [page(93)] })), [[], [unset("NOT_IN_BRAIN")]]);
});

test("a Project's Area counts as Git holds it: a Notion edit counts once it is accepted", async (context) => {
  const dir = await setUp(context);
  await edit(dir, "projects/shop/project.md", (attributes) => { attributes.notion_published = { Area: [CLIENTS_PAGE] }; });
  const edited = { database: "projects", page_id: SHOP_PAGE, last_edited: EDITED, properties: { "Brain ID": SHOP, Area: [TRAINING_PAGE] } };
  const data = await plan(dir, [edited, row({ Project: [SHOP_PAGE] })]);
  assert.equal(data.corrections.length, 1);
  assert.deepEqual(data.task_areas, [fill(CLIENTS, CLIENTS_PAGE)]);
});

test("a Done or Won't Do task is untouched, also by a mapped status name; an empty status is open (0114 §2)", async (context) => {
  const dir = await setUp(context);
  const task = (Status: unknown, extra: Record<string, unknown> = {}) => row({ Project: [WEBSITE_PAGE], Status }, TASK, extra);
  for (const finished of ["Done", " done ", "Won't Do", "won't do"]) assert.deepEqual(await areas(dir, task(finished)), NOTHING, finished);
  assert.deepEqual(await areas(dir, task("Shipped", { status_group: "complete" })), NOTHING, "an option of the complete group, on a row that is also tracked");
  for (const open of ["To Do", "Doing", "Someday", "Waiting On", null]) assert.deepEqual(await areas(dir, task(open)), [[fill(CLIENTS, CLIENTS_PAGE)], []], String(open));
  assert.deepEqual(await areas(dir, without(task("To Do"), "Status")), NOTHING, "a mapped status that was not read decides nothing");
  assert.deepEqual(await areas(dir, task("To Do", { gone: true })), NOTHING);
  // A Tasks database the user mapped: its own property names and closed-without-doing status.
  await config(dir, (value) => { value.notion.tasks.wont_do_status = "Dropped"; Object.assign(value.notion.tasks.properties, { title: "Task", status: "State", area: "Part of", project: "For" }); });
  const mapped = (State: string) => ({ database: "tasks", page_id: TASK, last_edited: EDITED, properties: { Task: "Draft the site copy", State, "Part of": [], For: [WEBSITE_PAGE] } });
  assert.deepEqual(await areas(dir, mapped("Dropped")), NOTHING);
  assert.deepEqual(await areas(dir, mapped("Done")), NOTHING);
  assert.deepEqual(await areas(dir, mapped("Won't Do")), [[fill(CLIENTS, CLIENTS_PAGE, "project", TASK, "Part of")], []], "only the mapped name is closed");
  // With no status mapped, no task is finished.
  await config(dir, (value) => { value.notion.tasks.properties.status = ""; });
  assert.deepEqual(await areas(dir, mapped("Done")), [[fill(CLIENTS, CLIENTS_PAGE, "project", TASK, "Part of")], []]);
});

test("a task with neither a Project nor a Factory, or with no mapped Area, is untouched and not ignored", async (context) => {
  const dir = await setUp(context);
  const data = await plan(dir, [row({}), row({ Project: [WEBSITE_PAGE], Status: "Done" }, TASK_2)]);
  assert.deepEqual([data.task_areas, data.task_areas_unset, data.ignored], [[], [], []], "a row passed for its empty Area is not NOT_TRACKED");
  await config(dir, (value) => { value.notion.tasks.properties.area = ""; });
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE] })), NOTHING);
});

test("with the Tasks module off nothing is filled", async (context) => {
  const dir = await setUp(context);
  await config(dir, (value) => { value.modules = { tasks: false }; });
  const data = await plan(dir, [row({ Project: [WEBSITE_PAGE] })]);
  assert.deepEqual([data.task_areas, data.ignored.map((item: any) => item.reason)], [[], ["MODULE_OFF"]]);
});

test("a task that is tracked, kept as a document and without an Area is read by each rule", async (context) => {
  const dir = await setUp(context);
  await config(dir, (value) => { value.notion.tasks.properties.document_asked = "Document asked"; value.notion.databases.documents = page(99); });
  await edit(dir, QUESTION_PATH, (attributes) => { attributes.task = TASK; });
  const open = await plan(dir, [row({ Project: [WEBSITE_PAGE], "Document asked": true }, TASK, { status_group: "todo" })]);
  assert.deepEqual([open.tracked_tasks, open.task_documents.length, open.task_areas], [[], 1, [fill(CLIENTS, CLIENTS_PAGE)]]);
  const done = await plan(dir, [row({ Project: [WEBSITE_PAGE], "Document asked": true, Status: "Done" }, TASK, { status_group: "complete" })]);
  assert.deepEqual([done.tracked_tasks.length, done.task_documents.length, done.task_areas], [1, 1, []]);
});

test("sync apply echoes both lists and changes nothing of them; a second run changes nothing", async (context) => {
  const dir = await setUp(context);
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, encoding: "utf8" });
  git("init", "-q"); git("add", "-A"); git("commit", "-qm", "start");
  const rows = [row({ Project: [WEBSITE_PAGE] }, TASK_2), row({ Project: [COURSE_PAGE, WEBSITE_PAGE].sort() }, TASK_3), row({ Project: [COURSE_PAGE] }), row({ Project: [page(90)] }, page(9))];
  const first = await plan(dir, rows);
  assert.deepEqual(first.task_areas, [fill(TRAINING, TRAINING_PAGE), fill(CLIENTS, CLIENTS_PAGE, "project", TASK_2)], "sorted by page id");
  assert.deepEqual(first.task_areas_unset, [unset("NOT_IN_BRAIN", page(9)), unset("DIFFERENT_AREAS", TASK_3)]);
  const applied = (await ok(dir, ["sync", "apply"], first)).data;
  assert.deepEqual([applied.task_areas, applied.task_areas_unset], [first.task_areas, first.task_areas_unset]);
  assert.equal(git("status", "--porcelain"), "", "nothing of a task or the fill is stored");
  // A plan written before 0.18.0 has neither list.
  const { task_areas: _areas, task_areas_unset: _unset, ...before } = first;
  assert.deepEqual((await ok(dir, ["sync", "apply"], before)).data.task_areas, []);
  // The skill wrote the Areas: the same tasks are read with them, and the plan is empty.
  const second = await plan(dir, [row({ Area: [CLIENTS_PAGE], Project: [WEBSITE_PAGE] }, TASK_2), row({ Area: [TRAINING_PAGE], Project: [COURSE_PAGE] })]);
  assert.deepEqual([second.task_areas, second.task_areas_unset], NOTHING);
  assert.equal((await run(dir, ["sync", "apply"], { ...first, task_areas: {} })).json.error.code, "INPUT_INVALID");
});

test("the brain's program opens no connection to Notion", async (context) => {
  const dir = await setUp(context);
  const opened: unknown[] = [];
  context.mock.method(Socket.prototype, "connect", (...args: unknown[]) => { opened.push(args); throw new Error("a connection was opened"); });
  context.mock.method(globalThis, "fetch", (...args: unknown[]) => { opened.push(args); throw new Error("a connection was opened"); });
  const data = await plan(dir, [row({ Project: [WEBSITE_PAGE] })]);
  await ok(dir, ["sync", "apply"], data);
  await tasks(dir, ["--direct"], [{ title: "Order the labels", projects: [WEBSITE] }]);
  assert.equal(data.task_areas.length, 1);
  assert.deepEqual(opened, []);
});

// --- a Project property or a Factory left out (RELATION_TRUNCATED) and Factories (0114) ---

const FACTORY = page(50); const FACTORY_2 = page(51); const FACTORY_3 = page(52);
const REPO_ENTRY = { name: "acme-web", path: "~/code/acme-web", area: CLIENTS, patterns: ["docs/**/*.md"], commit: "" };
async function withFactories(dir: string, on = true): Promise<void> {
  await config(dir, (value) => {
    value.modules = { tasks: true, factories: on };
    value.notion.tasks.properties.factory = "Factory";
    value.repos = [REPO_ENTRY];
    value.factories = [
      { id: "fac-7k2m9q4x", name: "acme-web", repo: "acme-web", notion: FACTORY },
      { id: "fac-3n8w5t2c", name: "Workshop kit", path: "~/work/workshop-kit", area: TRAINING, notion: FACTORY_2 },
      { id: "fac-4p9x6v3d", name: "old-site", repo: "old-site", area: CLIENTS, archived: true, notion: FACTORY_3 },
      { id: "fac-5q1y7w4f", name: "New folder", path: "~/work/new", area: TRAINING },
    ];
  });
}

test("a task with a Factory and no Project gets the Factory's Area: a linked repo's, a plain folder's or an unlinked one's", async (context) => {
  const dir = await setUp(context);
  await withFactories(dir);
  const factory = (...pages: string[]) => row({ Factory: pages });
  assert.deepEqual(await areas(dir, factory(FACTORY)), [[fill(CLIENTS, CLIENTS_PAGE, "factory")], []]);
  assert.deepEqual(await areas(dir, factory(FACTORY_2)), [[fill(TRAINING, TRAINING_PAGE, "factory")], []]);
  assert.deepEqual(await areas(dir, factory(FACTORY_3)), [[fill(CLIENTS, CLIENTS_PAGE, "factory")], []]);
  assert.deepEqual(await areas(dir, factory(FACTORY, FACTORY_3)), [[fill(CLIENTS, CLIENTS_PAGE, "factory")], []], "several Factories: the Area they share");
  assert.deepEqual(await areas(dir, factory(FACTORY, FACTORY_2)), [[], [unset("DIFFERENT_AREAS")]]);
  assert.deepEqual(await areas(dir, factory(page(59))), [[], [unset("NOT_IN_BRAIN")]], "a row made by hand is no Factory");
  assert.deepEqual(await areas(dir, row({ Factory: [FACTORY], Area: [TRAINING_PAGE] })), NOTHING);
  assert.deepEqual(await areas(dir, row({ Factory: [FACTORY], Status: "Done" })), NOTHING);
});

test("a task with a Project and a Factory gets the Project's Area, and Projects in different Areas set none, also with a Factory", async (context) => {
  const dir = await setUp(context);
  await withFactories(dir);
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE], Factory: [FACTORY_2] })), [[fill(CLIENTS, CLIENTS_PAGE)], []]);
  assert.deepEqual(await areas(dir, row({ Project: [COURSE_PAGE, WEBSITE_PAGE].sort(), Factory: [FACTORY] })), [[], [unset("DIFFERENT_AREAS")]]);
});

test("with the Factories module off, or Tasks · Factory unmapped, the Factory is not read", async (context) => {
  const dir = await setUp(context);
  await withFactories(dir, false);
  assert.deepEqual(await areas(dir, row({ Factory: [FACTORY] })), NOTHING);
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE], Factory: [FACTORY_2] })), [[fill(CLIENTS, CLIENTS_PAGE)], []]);
  await config(dir, (value) => { delete value.modules.factories; });
  assert.deepEqual(await areas(dir, row({ Factory: [FACTORY] })), NOTHING, "absent is off");
  await config(dir, (value) => { value.modules.factories = true; value.notion.tasks.properties.factory = ""; });
  assert.deepEqual(await areas(dir, row({ Factory: [FACTORY] })), NOTHING);
});

test("a relation that was left out decides nothing", async (context) => {
  const dir = await setUp(context);
  await withFactories(dir);
  assert.deepEqual(await areas(dir, without(row({ Factory: [FACTORY] }), "Project")), NOTHING, "Project left out: it may name one");
  assert.deepEqual(await areas(dir, row({})), NOTHING, "Project empty, Factory left out");
  assert.deepEqual(await areas(dir, row({ Project: [WEBSITE_PAGE] })), [[fill(CLIENTS, CLIENTS_PAGE)], []], "the Factory left out is not needed");
});

// --- the snapshot (cli §5.14.10) ---

const TASKS_DB = "a1000000-0000-4000-8000-00000000000b";
const value = { title: (text: string) => ({ type: "title", title: [{ plain_text: text }] }), status: (name: string) => ({ type: "status", status: { name } }), relation: (...ids: string[]) => ({ type: "relation", relation: ids.map((id) => ({ id })), has_more: false }), checkbox: (checked: boolean) => ({ type: "checkbox", checkbox: checked }), part: (id: string) => ({ type: "relation", relation: [{ id }], has_more: true }) };
const taskPage = (id: string, properties: Properties) => ({ object: "page", id, last_edited_time: EDITED, in_trash: false, archived: false, parent: { database_id: TASKS_DB }, properties: { Name: value.title("Draft the site copy"), Status: value.status("To Do"), "Document asked": value.checkbox(false), Area: value.relation(), Project: value.relation(), Factory: value.relation(), Due: { type: "date", date: null }, ...properties } });

async function snapshot(dir: string, pages: unknown[]) {
  const input = join(dir, "..", `reply-${counter += 1}.json`); const output = join(dir, "..", "snapshot.json");
  await writeFile(input, JSON.stringify({ object: "list", results: pages, has_more: false }));
  const result = await brain(["sync", "snapshot", "--brain", dir, "--now", NOW, "--input", input, "--output", output, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  return { rows: JSON.parse(await readFile(output, "utf8")).rows as any[], warnings: result.json.warnings };
}

test("sync snapshot passes a task with no Area and a Project or a Factory, with the five properties only, and sync plan takes it", async (context) => {
  const dir = await setUp(context);
  await config(dir, (value) => { value.notion.tasks.properties.document_asked = "Document asked"; });
  const pages = [
    taskPage(TASK, { Project: value.relation(WEBSITE_PAGE) }),
    taskPage(TASK_2, { Factory: value.relation(FACTORY) }),
    taskPage(TASK_3, { Project: value.relation(WEBSITE_PAGE), Factory: value.relation(FACTORY_2), "Document asked": value.checkbox(true) }),
    taskPage(page(13), { Project: value.relation(WEBSITE_PAGE), Area: value.relation(TRAINING_PAGE) }),
    taskPage(page(14), {}),
    taskPage(page(15), { Project: value.relation(WEBSITE_PAGE), Area: value.part(TRAINING_PAGE) }),
    taskPage(page(16), { Factory: value.relation(FACTORY), Project: value.part(WEBSITE_PAGE) }),
  ];
  const base = { Name: "Draft the site copy", Status: "To Do", Area: [] };
  const off = await snapshot(dir, pages);
  assert.deepEqual(off.rows.map((entry) => [entry.page_id, entry.properties]), [
    [TASK, { ...base, Project: [WEBSITE_PAGE] }],
    [TASK_3, { ...base, "Document asked": true, Project: [WEBSITE_PAGE] }],
  ], "with the Factories module off a Factory is not kept");
  assert.deepEqual(off.warnings.map((warning: any) => warning.code), ["RELATION_TRUNCATED", "RELATION_TRUNCATED"]);
  await withFactories(dir);
  const on = await snapshot(dir, pages);
  assert.deepEqual(on.rows.map((entry) => [entry.page_id, entry.properties]), [
    [TASK, { ...base, Project: [WEBSITE_PAGE], Factory: [] }],
    [TASK_2, { ...base, Project: [], Factory: [FACTORY] }],
    [TASK_3, { ...base, "Document asked": true, Project: [WEBSITE_PAGE], Factory: [FACTORY_2] }],
    [page(16), { ...base, Factory: [FACTORY] }],
  ]);
  assert.deepEqual(await areas(dir, ...on.rows), [[fill(CLIENTS, CLIENTS_PAGE), fill(CLIENTS, CLIENTS_PAGE, "factory", TASK_2), fill(CLIENTS, CLIENTS_PAGE, "project", TASK_3)], []]);
});

test("a tracked task's row joins the query reply of its empty Area", async (context) => {
  const dir = await setUp(context);
  const rows = join(dir, "..", "rows.json"); const reply = join(dir, "..", "tasks.json"); const output = join(dir, "..", "snapshot.json");
  await writeFile(reply, JSON.stringify({ object: "list", results: [taskPage(TASK, { Project: value.relation(WEBSITE_PAGE) })], has_more: false }));
  await writeFile(rows, JSON.stringify({ rows: [{ database: "tasks", page_id: TASK, last_edited: EDITED, properties: { Name: "Draft the site copy", Status: "To Do" }, status_group: "todo" }] }));
  const joined = await brain(["sync", "snapshot", "--brain", dir, "--now", NOW, "--input", reply, "--input", rows, "--output", output, "--json"]);
  assert.equal(joined.code, 0, joined.stdout);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")).rows, [row({ Project: [WEBSITE_PAGE] }, TASK, { status_group: "todo" })]);
});

// --- the Area of a task the brain creates (cli §5.14.5, §5.7) ---

test("sync tasks --meeting: the Projects' shared Area, never the meeting's when there is a Project; with none, the meeting's", async (context) => {
  const dir = await setUp(context);
  await edit(dir, MEETING_PATH, (attributes) => { attributes.area = TRAINING; attributes.projects = [WEBSITE]; });
  const items = [{ title: "From the meeting" }, { title: "Shared", projects: [WEBSITE, SHOP] }, { title: "Course", projects: [COURSE] }, { title: "Both", projects: [WEBSITE, COURSE] }, { title: "Unpublished area", projects: [HIDDEN] }];
  const mixed = await tasks(dir, ["--meeting", MEETING], items);
  assert.deepEqual(mixed.areas, [relation(CLIENTS_PAGE), relation(CLIENTS_PAGE), relation(TRAINING_PAGE), undefined, undefined]);
  assert.deepEqual(mixed.warnings, [NOT_SET(4, "Both")]);
  assert.deepEqual(Object.keys(mixed.data), ["items"]);
  // A meeting of one Area whose projects are in two others: no Area, with the warning (cli §5.14.5).
  await edit(dir, MEETING_PATH, (attributes) => { attributes.area = QUIET; attributes.projects = [WEBSITE, COURSE]; });
  const none = await tasks(dir, ["--meeting", MEETING], [{ title: "From the meeting" }]);
  assert.deepEqual([none.areas, none.warnings], [[undefined], [NOT_SET(1, "From the meeting")]]);
  await edit(dir, MEETING_PATH, (attributes) => { attributes.area = TRAINING; attributes.projects = []; });
  const own = await tasks(dir, ["--meeting", MEETING], [{ title: "From the meeting" }, { title: "Website", projects: [WEBSITE] }]);
  assert.deepEqual([own.areas, own.warnings], [[relation(TRAINING_PAGE), relation(CLIENTS_PAGE)], []]);
});

test("sync tasks --source and --direct: the Projects' shared Area; an item's own area is used as given", async (context) => {
  const dir = await setUp(context);
  const source = (await ok(dir, ["note", "new"], { notes: [{ type: "source", title: "Pasted note", frontmatter: { kind: "note", source_key: `notion:${page(60)}`, projects: [WEBSITE] }, body: "Send the labels.\n" }] })).data.created[0].id;
  const items = [{ title: "Website", projects: [WEBSITE, SHOP] }, { title: "Both", projects: [WEBSITE, COURSE] }, { title: "None" }];
  for (const form of [["--source", source], ["--direct"]]) {
    const result = await tasks(dir, form, items);
    assert.deepEqual([result.areas, result.warnings], [[relation(CLIENTS_PAGE), undefined, undefined], [NOT_SET(2, "Both")]], form[0]);
  }
  const given = await tasks(dir, ["--direct"], [{ title: "Both", projects: [WEBSITE, COURSE], area: TRAINING }, { title: "Course, for Clients", projects: [COURSE], area: CLIENTS }]);
  assert.deepEqual([given.areas, given.warnings], [[relation(TRAINING_PAGE), relation(CLIENTS_PAGE)], []]);
  await config(dir, (value) => { value.notion.tasks.properties.area = ""; });
  const unmapped = await tasks(dir, ["--direct"], items);
  assert.deepEqual([unmapped.areas, unmapped.warnings], [[undefined, undefined, undefined], []], "with no Area mapped there is nothing to set");
});

test("sync tasks --question: the Projects' shared Area, else the question's own only with no Project", async (context) => {
  const dir = await setUp(context);
  const question = "que-8n3v5x1d";
  await edit(dir, QUESTION_PATH, (attributes) => { attributes.area = TRAINING; attributes.projects = [WEBSITE]; });
  assert.deepEqual((await tasks(dir, ["--question", question], [{}])).areas, [relation(CLIENTS_PAGE)]);
  await edit(dir, QUESTION_PATH, (attributes) => { attributes.projects = [WEBSITE, COURSE]; });
  const both = await tasks(dir, ["--question", question], [{}]);
  assert.deepEqual([both.areas, both.warnings], [[undefined], [NOT_SET(1, "Who owns the Acme mobile app?")]]);
  await edit(dir, QUESTION_PATH, (attributes) => { attributes.projects = []; });
  assert.deepEqual((await tasks(dir, ["--question", question], [{}])).areas, [relation(TRAINING_PAGE)]);
});

test("a weekly Action's new_task carries its Project's Area, when published and mapped (cli §5.7)", async (context) => {
  const dir = await setUp(context);
  const create = async (target: string, title: string) => {
    const proposed = await ok(dir, ["proposal", "new"], { proposals: [{ kind: "new_task", title: `Add ${title}`, target, task_title: title, why: "No next step.", source: "agent:weekly-review/2026-W50" }] });
    const applied = await ok(dir, ["apply"], { decisions: [{ proposal: proposed.data.created[0].id, action: "approve", decided_at: NOW, decided_by: "chat" }] });
    return applied.data.notion_writes[0].properties;
  };
  const name = (text: string) => ({ type: "title", value: text });
  assert.deepEqual(await create(COURSE, "Book the room"), { Name: name("Book the room"), Project: relation(COURSE_PAGE), Area: relation(TRAINING_PAGE) });
  assert.deepEqual(await create(HIDDEN, "Call them"), { Name: name("Call them"), Project: relation(HIDDEN_PAGE) }, "its Area has no page yet");
  await config(dir, (value) => { value.notion.tasks.properties.area = ""; });
  assert.deepEqual(await create(WEBSITE, "Draft the copy"), { Name: name("Draft the copy"), Project: relation(WEBSITE_PAGE) });
});

test("sync tasks --direct with a Factory: the relation, and with no Project the Factory's Area (0113 §5, 0114)", async (context) => {
  const dir = await setUp(context);
  await withFactories(dir);
  const items = [
    { title: "Add rate limits", factory: "fac-7k2m9q4x" },
    { title: "Print the handouts", factory: "fac-3n8w5t2c" },
    { title: "Both", factory: "fac-3n8w5t2c", projects: [WEBSITE] },
    { title: "In two areas", factory: "fac-7k2m9q4x", projects: [WEBSITE, COURSE] },
    { title: "Given", factory: "fac-7k2m9q4x", area: TRAINING },
    { title: "New folder", factory: "fac-5q1y7w4f" },
  ];
  const result = await tasks(dir, ["--direct"], items);
  assert.deepEqual(result.areas, [relation(CLIENTS_PAGE), relation(TRAINING_PAGE), relation(CLIENTS_PAGE), undefined, relation(TRAINING_PAGE), relation(TRAINING_PAGE)]);
  assert.deepEqual(result.warnings, [NOT_SET(4, "In two areas")]);
  assert.deepEqual(result.data.items[0].properties, { Name: { type: "title", value: "Add rate limits" }, Status: { type: "select", value: "To Do" }, Project: { type: "relation", value: [] }, Factory: relation(FACTORY), Area: relation(CLIENTS_PAGE) });
  assert.equal(result.data.items[5].properties.Factory, undefined);
  assert.deepEqual(result.data.items[5].pending_relations, [{ property: "Factory", ids: ["fac-5q1y7w4f"] }], "its row isn't published yet");
});

test("sync tasks refuses a factory on any other form, with Factories off or unmapped, and an unknown or archived one", async (context) => {
  const dir = await setUp(context);
  await withFactories(dir);
  const item = { title: "Add rate limits", factory: "fac-7k2m9q4x" };
  const refused = async (args: string[], input: unknown = item) => {
    const error = (await run(dir, ["sync", "tasks", ...args], { items: [input] })).json.error;
    return [error.code, error.details[0].pointer];
  };
  const INVALID = ["INPUT_INVALID", "/items/0/factory"]; const UNKNOWN = ["UNKNOWN_ID", "/items/0/factory"];
  assert.deepEqual(await refused(["--meeting", MEETING]), INVALID);
  assert.deepEqual(await refused(["--question", "que-8n3v5x1d"], { factory: item.factory }), INVALID);
  for (const factory of ["fac-9z9z9z9z", "fac-4p9x6v3d", 7]) assert.deepEqual(await refused(["--direct"], { ...item, factory }), UNKNOWN, String(factory));
  await config(dir, (value) => { value.notion.tasks.properties.factory = ""; });
  assert.deepEqual(await refused(["--direct"]), INVALID);
  await withFactories(dir, false);
  assert.deepEqual(await refused(["--direct"]), INVALID);
});
