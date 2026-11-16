import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { approveNote, brain, fixtureCopy } from "./helpers.ts";

// Decision 0099 (0.16.0, CC-314): decisions and questions have no Notion database; the questions and risks you follow up are tasks with a Kind
// (spec/schema.md §4, §12, §16; spec/cli.md §5.5, §5.8, §5.14.2, §5.14.4 to §5.14.6, §5.14.9, §5.15, §5.20, §5.30; capture-and-review §6.4).
const NOW = "2026-12-12T09:00:00Z";
const BATCH = join(import.meta.dirname, "..", ".agents", "skills", "brain-ingest", "references", "example-batch.json");
const MEETING = "mtg-pcpyn31n";
const DECISION = "dec-axker49q";
const QUESTION = "que-wtnyy4r6";
const RISK = "que-zv7ckbtk";
const QUESTION_PATH = "knowledge/questions/who-writes-the-acme-blog-copy-after-launch.md";
const FIXTURE_QUESTION = "que-8n3v5x1d"; // published to the Questions database before 0.16.0, with Status Open
const FIXTURE_QUESTION_PATH = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const TASK_PAGE = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const MEETING_PAGE = "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function editJson(dir: string, edit: (config: Record<string, any>) => void): Promise<void> {
  const path = join(dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  edit(config);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
}

async function edit(dir: string, path: string, change: (text: string) => string): Promise<void> {
  await writeFile(join(dir, path), change(await readFile(join(dir, path), "utf8")));
}

/** The example ingest batch, its meeting given a Notion page and its decisions and questions approved in the session. */
async function ingested(context: TestContext, tasksKind = true): Promise<string> {
  const dir = await fixtureCopy(context);
  const notes = JSON.parse(await readFile(BATCH, "utf8"));
  for (const note of notes.notes) if (note.type === "meeting") note.frontmatter.notion = MEETING_PAGE;
  const created = await run(dir, ["note", "new"], notes);
  assert.equal(created.code, 0, created.stdout);
  for (const path of created.json.data.created.map((item: { path: string }) => item.path)) if (/knowledge\/(decisions|questions)\//.test(path)) await approveNote(dir, path);
  await editJson(dir, (config) => { config.modules = { tasks: true }; if (tasksKind) config.notion.tasks.properties.kind = "Kind"; });
  return dir;
}

test("0099: an ingest with a decision and a question writes both notes and creates no Notion page for either", async (context) => {
  const dir = await ingested(context);
  assert.match(await readFile(join(dir, QUESTION_PATH), "utf8"), /^lifecycle: reviewed$/m);
  const changed = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(changed.code, 0, changed.stdout);
  const ids = changed.json.data.items.map((item: { id: string }) => item.id);
  for (const id of [DECISION, QUESTION, RISK, FIXTURE_QUESTION]) assert.ok(!ids.includes(id), `${id} is never rendered`);
  assert.ok(changed.json.data.items.every((item: { database: string }) => item.database !== "decisions" && item.database !== "questions"));
  // No page names one: a meeting's and an Inbox row's Decisions and Questions relations are gone (cli §5.14.4).
  for (const item of changed.json.data.items) for (const name of ["Decisions", "Questions", "From decision", "Decided In", "Raised In"]) assert.equal(item.properties[name], undefined, `${item.id} ${name}`);
  const named = await run(dir, ["sync", "render", "--ids", `${DECISION},${QUESTION}`]);
  assert.equal(named.code, 0, named.stdout);
  assert.deepEqual(named.json.data.items, []);
  assert.deepEqual(named.json.data.skipped, [{ id: DECISION, reason: "NO_DATABASE" }, { id: QUESTION, reason: "NO_DATABASE" }]);
});

test("0099: tracking a question renders one Task with Kind Question linked both ways, and the question is tracked once", async (context) => {
  const dir = await ingested(context);
  const rendered = await run(dir, ["sync", "tasks", "--question", QUESTION], { items: [{}] });
  assert.equal(rendered.code, 0, rendered.stdout);
  assert.equal(rendered.json.data.items.length, 1);
  const task = rendered.json.data.items[0];
  assert.deepEqual(task.properties.Name, { type: "title", value: "Who writes the Acme blog copy after launch?" });
  assert.deepEqual(task.properties.Kind, { type: "select", value: "Question" });
  assert.deepEqual(task.properties.Status, { type: "select", value: "To Do" });
  assert.deepEqual(task.properties.Meeting, { type: "relation", value: [MEETING_PAGE] }, "the backlink to the meeting it was raised in");
  assert.deepEqual(task.properties["Brain ID"], { type: "rich_text", value: QUESTION }, "the task points back to its question");
  assert.equal(task.properties.Project.type, "relation");

  const recorded = await run(dir, ["sync", "record"], { records: [{ id: QUESTION, task: TASK_PAGE }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  assert.equal(recorded.json.data.records[0].result, "recorded");
  assert.match(await readFile(join(dir, QUESTION_PATH), "utf8"), new RegExp(`^task: ${TASK_PAGE}$`, "m"), "the question points to its task");
  const retry = await run(dir, ["sync", "record"], { records: [{ id: QUESTION, task: TASK_PAGE }] });
  assert.deepEqual(retry.json.data.records[0], { id: QUESTION, result: "recorded", changed: [] }, "a retry records nothing new");
  const other = await run(dir, ["sync", "record"], { records: [{ id: QUESTION, task: "0f1e2d3c-4b5a-4968-8776-655443322110" }] });
  assert.equal(other.json.data.records[0].reason, "INVALID_RESULT", "a question keeps its first task");

  const again = await run(dir, ["sync", "tasks", "--question", QUESTION], { items: [{}] });
  assert.equal(again.json.error.code, "INPUT_INVALID", "a question is tracked once");
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
  const index = await run(dir, ["index"]);
  assert.equal(index.code, 0, index.stdout);
  const entry = index.json.data.notes.find((item: { id: string }) => item.id === QUESTION);
  assert.deepEqual(entry.fields, { kind: "question", status: "tracked" });
});

test("0099: on a mapped Tasks database without Kind, a tracking task's title starts with Question: or Risk:", async (context) => {
  const dir = await ingested(context, false);
  const question = await run(dir, ["sync", "tasks", "--question", QUESTION], { items: [{}] });
  assert.equal(question.code, 0, question.stdout);
  assert.deepEqual(question.json.data.items[0].properties.Name, { type: "title", value: "Question: Who writes the Acme blog copy after launch?" });
  assert.equal(question.json.data.items[0].properties.Kind, undefined, "no Kind is sent to a database without one");
  const risk = await run(dir, ["sync", "tasks", "--question", RISK], { items: [{}] });
  assert.deepEqual(risk.json.data.items[0].properties.Name, { type: "title", value: "Risk: Migrating old blog posts to Contentful could delay the launch" });
});

test("0099: a risk line with Track: Waiting On — becomes a Waiting On task with Kind Risk", async (context) => {
  const dir = await ingested(context);
  await editJson(dir, (config) => { config.notion.tasks.properties.owner = "Owner"; });
  const rendered = await run(dir, ["sync", "tasks", "--question", RISK], { items: [{ status: "waiting_on", owner: "Carlos Ruiz", due: "2027-01-15" }] });
  assert.equal(rendered.code, 0, rendered.stdout);
  const task = rendered.json.data.items[0];
  assert.deepEqual(task.properties.Kind, { type: "select", value: "Risk" });
  assert.deepEqual(task.properties.Status, { type: "select", value: "Waiting On" });
  assert.deepEqual(task.properties.Owner, { type: "person_name", value: "Carlos Ruiz" });
  assert.deepEqual(task.properties.Due, { type: "date", value: { start: "2027-01-15", end: null } });
  assert.deepEqual(task.properties["Brain ID"], { type: "rich_text", value: RISK });
  // A Waiting On task may leave the owner out (you asked someone and didn't say whom).
  assert.equal((await run(dir, ["sync", "tasks", "--question", RISK], { items: [{ status: "waiting_on" }] })).code, 0);
});

test("0099: sync tasks --question refuses what the question supplies, more than one item, and a closed question", async (context) => {
  const dir = await ingested(context);
  for (const items of [[{ title: "Other" }], [{ projects: ["prj-9x4t1b7e"] }], [{ owner: "Sam" }], [{ status: "done" }], [{}, {}]]) {
    const result = await run(dir, ["sync", "tasks", "--question", QUESTION], { items });
    assert.equal(result.json.error.code, "INPUT_INVALID", JSON.stringify(items));
  }
  assert.equal((await run(dir, ["sync", "tasks", "--question", "que-00000000"], { items: [{}] })).json.error.code, "UNKNOWN_ID");
  assert.equal((await run(dir, ["sync", "tasks", "--question", DECISION], { items: [{}] })).json.error.code, "INPUT_INVALID");
  await edit(dir, QUESTION_PATH, (text) => text.replace(/^kind: question$/m, "kind: question\nanswer: Maria writes it"));
  assert.equal((await run(dir, ["sync", "tasks", "--question", QUESTION], { items: [{}] })).json.error.code, "INPUT_INVALID", "an answered question is not open");
  await editJson(dir, (config) => { config.modules.tasks = false; });
  assert.equal((await run(dir, ["sync", "tasks", "--question", RISK], { items: [{}] })).json.error.code, "MODULE_OFF", "with Tasks off nothing is tracked");
});

test("0099: the Brief lists open questions and risks, the risk labelled and the tracked line linking its task", async (context) => {
  const dir = await ingested(context);
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id: QUESTION, task: TASK_PAGE }] })).code, 0);
  const views = await run(dir, ["views"]);
  assert.equal(views.code, 0, views.stdout);
  const brief = await readFile(join(dir, "projects", "acme-website", "brief.md"), "utf8");
  const section = brief.split("## Open questions and risks\n")[1]!.split("\n\n")[0]!;
  assert.deepEqual(section.split("\n").filter((line) => line.startsWith("- ")), [
    `- [Who writes the Acme blog copy after launch?](../../${QUESTION_PATH}) · [task](https://www.notion.so/${TASK_PAGE.replaceAll("-", "")})`,
    "- [Migrating old blog posts to Contentful could delay the launch](../../knowledge/questions/migrating-old-blog-posts-to-contentful-could-delay-the.md) (risk)",
  ]);
  assert.doesNotMatch(brief, /^## Open questions$/m);
  const areaBrief = await readFile(join(dir, "areas", "briefs", "clients.md"), "utf8");
  assert.match(areaBrief, /## Open questions and risks\n- \[Who writes the Acme blog copy after launch\?\]\([^)]+\) · \[task\]\(https:\/\/www\.notion\.so\/[0-9a-f]{32}\)\n- \[Migrating old blog posts [^\n]+ \(risk\)\n/);

  // In Notion the Brief's question lines are text, and the task link is kept as written (cli §5.14.4 `sections`).
  const project = await run(dir, ["sync", "render", "--ids", "prj-9x4t1b7e"]);
  assert.equal(project.code, 0, project.stdout);
  const notionBrief = project.json.data.items[0].sections.Brief as string;
  assert.match(notionBrief, new RegExp(`## Open questions and risks\\n- Who writes the Acme blog copy after launch\\? · \\[task\\]\\(https://www\\.notion\\.so/${TASK_PAGE.replaceAll("-", "")}\\)\\n- Migrating old blog posts to Contentful could delay the launch \\(risk\\)`));
  assert.doesNotMatch(project.json.data.items[0].sections["Decision log"], /\]\(https:\/\/www\.notion\.so\//, "a decision has no page to link");

  // An answered or dropped question leaves the list.
  await edit(dir, QUESTION_PATH, (text) => text.replace(/^kind: question$/m, "kind: question\nanswer: Maria writes it"));
  await run(dir, ["views"]);
  assert.doesNotMatch(await readFile(join(dir, "projects", "acme-website", "brief.md"), "utf8"), /Who writes the Acme blog copy/);
});

test("0099: sync plan ignores Decisions and Questions rows as RETIRED_DATABASE and reads no Status", async (context) => {
  const dir = await fixtureCopy(context);
  const before = await readFile(join(dir, FIXTURE_QUESTION_PATH), "utf8");
  const snapshot = { as_of: NOW, rows: [
    { database: "questions", page_id: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b", last_edited: "2026-12-10T10:00:00Z", properties: { Name: "Who owns the Acme mobile app?", Status: "Answered", "Brain ID": FIXTURE_QUESTION } },
    { database: "decisions", page_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", last_edited: "2026-12-10T10:00:00Z", properties: { Name: "Use Supabase for auth", "Promote asked": true, "Brain ID": "dec-3f7k9m2q" } },
  ] };
  const plan = await run(dir, ["sync", "plan"], snapshot);
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.ignored.map((item: { database: string; reason: string }) => [item.database, item.reason]), [["decisions", "RETIRED_DATABASE"], ["questions", "RETIRED_DATABASE"]]);
  assert.deepEqual(plan.json.data.updates, []);
  assert.equal(plan.json.data.promote_requests, undefined, "Promote to document is asked in the session");
  const applied = await run(dir, ["sync", "apply"], plan.json.data);
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(await readFile(join(dir, FIXTURE_QUESTION_PATH), "utf8"), before);
});

test("0099: the read-back records a question set Answered in Notion; one set Dropped is dropped and archived; a second run is ALREADY_CLOSED", async (context) => {
  const dir = await ingested(context);
  // The fixture's question (draft) and the batch's question, as published before 0.16.0.
  const rows = [
    { database: "questions", page_id: "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b", last_edited: "2026-12-10T10:00:00Z", properties: { Status: "Answered", "Brain ID": FIXTURE_QUESTION } },
    { database: "questions", page_id: "6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e", last_edited: "2026-12-11T16:30:00Z", properties: { Status: "Dropped", "Brain ID": QUESTION } },
    { database: "questions", page_id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f", last_edited: "2026-12-11T16:30:00Z", properties: { Status: "Open", "Brain ID": RISK } },
    { database: "questions", page_id: "8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a", last_edited: "2026-12-11T16:30:00Z", properties: { Status: "Answered", "Brain ID": "" } },
    { database: "questions", page_id: "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b", last_edited: "2026-12-11T16:30:00Z", properties: { Status: "Answered", "Brain ID": "que-00000000" } },
    { database: "questions", page_id: "af0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b", last_edited: "2026-12-11T16:30:00Z", properties: { Status: "Answered", "Brain ID": DECISION } },
  ];
  const plan = await run(dir, ["sync", "plan", "--questions-transition"], { as_of: NOW, rows });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(Object.keys(plan.json.data).sort(), ["as_of", "conflicts", "ignored", "question_status"]);
  assert.deepEqual(plan.json.data.question_status, [
    { note: FIXTURE_QUESTION, page_id: rows[0]!.page_id, status: "answered", at: "2026-12-10" },
    { note: QUESTION, page_id: rows[1]!.page_id, status: "dropped", at: "2026-12-11" },
  ]);
  assert.deepEqual(plan.json.data.conflicts.map((item: { code: string }) => item.code), ["UNKNOWN_BRAIN_ID"]);
  assert.deepEqual(plan.json.data.ignored.map((item: { reason: string }) => item.reason), ["NOT_CREATED_IN_NOTION", "NOT_A_QUESTION"]);

  const applied = await run(dir, ["sync", "apply"], plan.json.data);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.question_status.map((item: { note: string; result: string }) => [item.note, item.result]), [[FIXTURE_QUESTION, "applied"], [QUESTION, "applied"]]);
  const answered = await readFile(join(dir, FIXTURE_QUESTION_PATH), "utf8");
  assert.match(answered, /^answer: Marked Answered in Notion on 2026-12-10; the answer was not recorded\.$/m);
  assert.match(answered, /^updated: 2026-12-12$/m);
  assert.match(answered, /^  status: Open$/m, "notion_fields.status stays as history");
  const dropped = await readFile(join(dir, QUESTION_PATH), "utf8");
  assert.match(dropped, /^dropped: 2026-12-11$/m);
  assert.match(dropped, /^lifecycle: archived$/m);
  const log = await readFile(join(dir, "log", "2026-12.md"), "utf8");
  assert.match(log, /sync-question que-8n3v5x1d "Who owns the Acme mobile app\?" status=answered/);
  assert.match(log, /sync-question que-wtnyy4r6 "Who writes the Acme blog copy after launch\?" status=dropped/);
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));

  // A second run: the plan finds nothing to record, and the old plan applied again is ALREADY_CLOSED.
  const second = await run(dir, ["sync", "plan", "--questions-transition"], { as_of: NOW, rows });
  assert.deepEqual(second.json.data.question_status, []);
  const again = await run(dir, ["sync", "apply"], plan.json.data);
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data.question_status.map((item: { result: string; reason: string }) => [item.result, item.reason]), [["skipped", "ALREADY_CLOSED"], ["skipped", "ALREADY_CLOSED"]]);
});

test("0099: --questions-transition reads Questions rows only, and refuses with QUESTIONS_RETIRED once brain.json has no questions key", async (context) => {
  const dir = await fixtureCopy(context);
  const wrong = await run(dir, ["sync", "plan", "--questions-transition"], { as_of: NOW, rows: [{ database: "projects", page_id: "p1", last_edited: NOW, properties: {} }] });
  assert.equal(wrong.json.error.code, "INPUT_INVALID");
  await editJson(dir, (config) => { delete config.notion.databases.decisions; delete config.notion.databases.questions; });
  const retired = await run(dir, ["sync", "plan", "--questions-transition"], { as_of: NOW, rows: [] });
  assert.equal(retired.code, 4);
  assert.equal(retired.json.error.code, "QUESTIONS_RETIRED");
});

test("0099: brain upgrade on a 0.15 brain.json with Knowledge on leaves no Knowledge key and names the migration", async (context) => {
  const dir = await fixtureCopy(context);
  await editJson(dir, (config) => { config.modules = { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: false }; });
  const upgraded = await run(dir, ["upgrade"]);
  assert.ok(upgraded.json !== undefined, upgraded.stdout);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  assert.deepEqual(config.modules, { domains: false, orgs: true, documents: true, reports: true, tasks: true, planning: false });
  assert.equal(typeof config.notion.databases.questions, "string", "the migration reads Questions once, so upgrade keeps the key");
  assert.equal(upgraded.json.data.notion_migrations.knowledge_databases, true);
  const human = await brain(["upgrade", "--dry-run", "--brain", dir, "--now", NOW]);
  assert.match(human.stdout, /Notion: your space still has the Decisions and Questions databases\. Ask your agent to apply the 0\.16\.0 Notion migration: it reads back the Status you set on questions, then archives both databases\./);
  // A brain with no modules block gets one without Knowledge.
  await editJson(dir, (next) => { delete next.modules; delete next.notion.databases.decisions; delete next.notion.databases.questions; });
  const second = await run(dir, ["upgrade"]);
  assert.equal(second.json.data.notion_migrations.knowledge_databases, false);
  assert.equal("knowledge" in JSON.parse(await readFile(join(dir, "brain.json"), "utf8")).modules, false);
});

test("0099: brain modules no longer lists Knowledge and refuses to switch it; status reports neither database", async (context) => {
  const dir = await fixtureCopy(context);
  const listed = await run(dir, ["modules"]);
  assert.equal(listed.code, 0, listed.stdout);
  assert.ok(!listed.json.data.modules.some((module: { name: string }) => module.name === "knowledge"));
  for (const word of ["on", "off"]) {
    const refused = await run(dir, ["modules", word, "knowledge"]);
    assert.equal(refused.json.error.code, "USAGE");
    assert.match(refused.json.error.message, /decisions and questions now show on project and area pages/);
  }
  const status = await run(dir, ["status"]);
  assert.equal(status.code, 0, status.stdout);
  for (const key of ["decisions", "questions"]) {
    assert.ok(!status.json.data.notion.configured.includes(key) && !status.json.data.notion.missing.includes(key), key);
  }
  assert.equal("knowledge" in status.json.data.modules, false);
});

test("0099: question drop refuses a tracked question, and the new brain template has Kind and no Knowledge", async (context) => {
  const dir = await ingested(context);
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id: QUESTION, task: TASK_PAGE }] })).code, 0);
  const refused = await run(dir, ["question", "drop"], { items: [{ id: QUESTION }] });
  assert.equal(refused.json.error.code, "INPUT_INVALID");
  assert.match(JSON.stringify(refused.json.error), /tracked/);
  const template = JSON.parse(await readFile(join(import.meta.dirname, "..", "templates", "brain", "brain.json"), "utf8"));
  assert.equal("knowledge" in template.modules, false);
  assert.equal("decisions" in template.notion.databases || "questions" in template.notion.databases, false);
  assert.equal(template.notion.tasks.properties.kind, "Kind");
});

test("0099: an Inbox row takes Project and Area from a decision its source produced; a body link to a decision with an old page is text", async (context) => {
  const dir = await fixtureCopy(context);
  await editJson(dir, (config) => {
    config.notion.databases.inbox = "a1000000-0000-4000-8000-00000000000e";
    config.notion.databases.documents = "a1000000-0000-4000-8000-00000000000d";
  });
  const made = await run(dir, ["note", "new"], { notes: [{ type: "source", title: "Pricing memo", file_date: "2026-12-01", frontmatter: { source_key: "agent:claude-code/pricing-memo", kind: "note", summary: "A pricing memo.", digest: "- Price set." }, body: "Price set.\n" }] });
  assert.equal(made.code, 0, made.stdout);
  const source = made.json.data.created[0].id as string;
  const decided = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Set the price", frontmatter: { summary: "s", date: "2026-12-01", assessment: "accepted", projects: ["prj-9x4t1b7e"], sources: [source] }, body: "Set.\n" }] });
  assert.equal(decided.code, 0, decided.stdout);
  const rendered = await run(dir, ["sync", "render", "--ids", source]);
  assert.equal(rendered.code, 0, rendered.stdout);
  const row = rendered.json.data.items[0];
  assert.equal(row.properties.Decisions, undefined, "no Produced relation to a decision");
  assert.deepEqual([row.properties.Project.mode, row.properties.Project.value], ["if_empty", ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"]], "the decision's project");
  assert.ok(row.properties.Area.value.length > 0, "and that project's area");

  // A reviewed Document whose body links the fixture decision, which still has a notion id from before 0.16.0.
  await edit(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md", (text) => text.replace(/^lifecycle: draft$/m, "lifecycle: draft\nnotion: 5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a"));
  const doc = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Auth notes", frontmatter: { summary: "s", origin: "learned", sources: [source] }, body: "See [the auth call](../decisions/2026-12-03-use-supabase-for-auth.md).\n" }] });
  assert.equal(doc.code, 0, doc.stdout);
  await approveNote(dir, doc.json.data.created[0].path);
  const page = (await run(dir, ["sync", "render", "--ids", doc.json.data.created[0].id])).json.data.items[0];
  assert.ok(String(page.body).includes("See the auth call."), String(page.body));
  assert.doesNotMatch(String(page.body), /5d6e7f8a9b0c4d1e8f2a3b4c5d6e7f8a/);
});
