// A task kept as a document (0.16.0, decision 0100; spec/capture-and-review.md §13; spec/cli.md §5.5, §5.6, §5.14.2, §5.14.4; schema §4, §11).
// Synthetic brains only.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PAGE = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";
const QUESTION = "que-8n3v5x1d";
const DECISION = "dec-7k2m9q4x";
const DECISION_PATH = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const TASK_PAGE = "b1000000-0000-4000-8000-000000000001";
const OTHER_TASK = "b1000000-0000-4000-8000-000000000002";
const DOCUMENTS_DB = "b1000000-0000-4000-8000-0000000000d0";
const TASK_TEXT = "## Findings\nHosting confirms the site can go live on 4 March.\n\n- DNS switch the day before\n";
const DOC_PAGE = "b1000000-0000-4000-8000-0000000000aa";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function ok(dir: string, args: string[], input?: unknown) {
  const result = await run(dir, args, input);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  return result.json.data;
}

/** The fixture with Documents configured, Document asked mapped on Tasks, and its open question tracked by the task (0099 §3). */
async function setUp(context: TestContext): Promise<string> {
  const dir = await fixtureCopy(context);
  await ok(dir, ["config", "set", "notion.databases.documents", JSON.stringify(DOCUMENTS_DB)]);
  await ok(dir, ["config", "set", "notion.tasks.properties.document_asked", JSON.stringify("Document asked")]);
  const question = join(dir, "knowledge/questions/who-owns-the-acme-mobile-app.md");
  await writeFile(question, (await readFile(question, "utf8")).replace("\nkind: question\n", `\nkind: question\ntask: ${TASK_PAGE}\n`));
  // The decision a From the brain line cites is reviewed knowledge.
  const decision = join(dir, DECISION_PATH);
  await writeFile(decision, (await readFile(decision, "utf8")).replace(/^lifecycle: draft$/m, "lifecycle: reviewed"));
  return dir;
}

/** The task source and its whole Document, as the skill writes them (capture-and-review §13.3, §13.4). */
function keepItems(body = TASK_TEXT, frontmatter: Record<string, unknown> = {}) {
  return [
    { type: "source", id: "src-8n4p2k7m", title: "Check go-live with hosting", file_date: "2026-12-09", frontmatter: { source_key: `notion:${TASK_PAGE}`, kind: "task", projects: [PROJECT], ...frontmatter }, body },
    { type: "reference", title: "Check go-live with hosting", frontmatter: { summary: "The go-live task's findings.", origin: "whole", question: QUESTION, projects: [PROJECT], sources: ["src-8n4p2k7m"] }, body },
  ];
}

const LINE = `- Acme switches auth to Supabase ([Use Supabase for auth](../decisions/2026-12-03-use-supabase-for-auth.md))`;
function fromTheBrain(target: string, content = LINE, extra: Record<string, unknown> = {}) {
  return { kind: "add_to_note", section: "from_the_brain", title: "Check go-live with hosting: from the brain", target, content, why: "What the brain holds on the task's subject.", source: "src-8n4p2k7m", passages: [DECISION], ...extra };
}

test("a task kept in the session: one reviewed whole Document, the task's text word for word, linked to its project, its question and its task (0100 §2)", async (context) => {
  const dir = await setUp(context);
  const kept = await ok(dir, ["note", "new"], { notes: keepItems() });
  const [source, document] = kept.created;
  const sourceFile = parseFrontmatter(await readFile(join(dir, source.path), "utf8"));
  assert.equal(sourceFile.attributes.kind, "task");
  assert.equal(sourceFile.attributes.source_key, `notion:${TASK_PAGE}`);
  assert.equal(sourceFile.attributes.notion, undefined, "no Inbox row");
  const documentFile = parseFrontmatter(await readFile(join(dir, document.path), "utf8"));
  assert.equal(documentFile.attributes.lifecycle, "reviewed");
  assert.equal(documentFile.attributes.question, QUESTION);
  assert.deepEqual(documentFile.attributes.projects, [PROJECT]);
  assert.deepEqual(documentFile.attributes.sources, [source.id]);
  assert.equal(documentFile.body.replace(/^\n/, ""), TASK_TEXT, "word for word");

  // The task page has no Inbox row; the Document's row links the task and the project.
  const changed = await ok(dir, ["sync", "render", "--changed"]);
  assert.equal(changed.items.some((item: { id: string }) => item.id === source.id), false);
  const named = await ok(dir, ["sync", "render", "--ids", source.id]);
  assert.deepEqual(named.skipped, [{ id: source.id, reason: "NO_INBOX_ROW" }]);
  const rendered = (await ok(dir, ["sync", "render", "--ids", document.id])).items[0];
  assert.equal(rendered.database, "documents");
  assert.deepEqual(rendered.properties.Origin, { type: "select", value: "Kept" });
  assert.deepEqual(rendered.properties.Task, { type: "relation", value: [TASK_PAGE] });
  assert.deepEqual(rendered.properties.Project, { type: "relation", value: [PROJECT_PAGE] });
  assert.equal(Object.hasOwn(rendered.properties, "Sources"), false);
  assert.equal(rendered.body, `\n${TASK_TEXT}`, "after the blank line every note but a source has");

  // With Tasks off, the Task relation is left out.
  await ok(dir, ["modules", "off", "tasks"]);
  const off = (await ok(dir, ["sync", "render", "--ids", document.id])).items[0];
  assert.equal(Object.hasOwn(off.properties, "Task"), false);

  const lint = await ok(dir, ["lint"]);
  assert.equal(lint.errors, 0, JSON.stringify(lint.issues));
});

test("a task source and a Document's question are checked: no row of its own, a notion: key, a question only on a whole Document of a task", async (context) => {
  const dir = await setUp(context);
  const [source] = keepItems();
  const refused = async (item: unknown, pointer: string) => {
    const result = await run(dir, ["note", "new"], { notes: [item] });
    assert.equal(result.json.error?.code, "INPUT_INVALID", pointer);
    assert.ok(result.json.error.details.some((detail: { pointer: string }) => detail.pointer === pointer), `${pointer}: ${JSON.stringify(result.json.error.details)}`);
  };
  for (const key of ["notion", "digest", "only_keep"]) await refused({ ...source, frontmatter: { ...source!.frontmatter, [key]: key === "notion" ? TASK_PAGE : "x" } }, `/notes/0/frontmatter/${key}`);
  await refused({ ...source, frontmatter: { ...source!.frontmatter, source_key: "url:https://example.com/task" } }, "/notes/0/frontmatter/source_key");
  await refused({ type: "reference", title: "Notes", frontmatter: { summary: "s", origin: "learned", question: QUESTION, sources: ["src-7w3c9k5m"] }, body: "x\n" }, "/notes/0/frontmatter/question");
  await refused({ type: "reference", title: "Minutes", frontmatter: { summary: "s", origin: "whole", question: QUESTION, sources: ["src-7w3c9k5m"] }, body: "x\n" }, "/notes/0/frontmatter/question");
  const unknown = keepItems();
  (unknown[1]!.frontmatter as Record<string, unknown>).question = "que-2222222k";
  const result = await run(dir, ["note", "new"], { notes: unknown });
  assert.ok(result.json.error.details.some((detail: { pointer: string }) => detail.pointer === "/notes/1/frontmatter/question"));
});

test("a ticked Document asked on a scheduled run: one task_documents item; kept, the box cleared and one From the brain question queued (0100 §4)", async (context) => {
  const dir = await setUp(context);
  const row = (page: string, ticked: boolean) => ({ database: "tasks", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Check go-live with hosting", "Document asked": ticked, Project: [PROJECT_PAGE], Area: ticked ? [] : ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] } });
  const untracked = "b1000000-0000-4000-8000-000000000003";
  const plan = await ok(dir, ["sync", "plan"], { as_of: NOW, rows: [row(TASK_PAGE, true), row(OTHER_TASK, false), row(untracked, true)] });
  assert.deepEqual(plan.task_documents, [
    { page_id: TASK_PAGE, title: "Check go-live with hosting", projects: [PROJECT], area: null, question: QUESTION, source: null, existing: null },
    { page_id: untracked, title: "Check go-live with hosting", projects: [PROJECT], area: null, question: null, source: null, existing: null },
  ]);
  // A row passed for Document asked is read by that rule alone; an unticked row no question tracks is NOT_TRACKED (cli §5.14.2).
  assert.deepEqual(plan.ignored, [{ database: "tasks", page_id: OTHER_TASK, brain_id: null, reason: "NOT_TRACKED" }]);
  const applied = await ok(dir, ["sync", "apply"], plan);
  assert.deepEqual(applied.task_documents, plan.task_documents, "sync apply echoes it without executing it");

  // The run keeps it and queues the From the brain question for the next session.
  const kept = await ok(dir, ["note", "new"], { notes: keepItems() });
  const document = kept.created[1];
  const queued = await ok(dir, ["proposal", "new"], { proposals: [fromTheBrain(document.id)] });
  assert.equal(queued.created.length, 1);
  assert.equal(queued.created[0].kind, "add_to_note", "never folded into a review_notes");
  const waiting = await ok(dir, ["proposal", "list", "--waiting"]);
  assert.ok(JSON.stringify(waiting).includes(queued.created[0].id));
  // The Document itself stays as kept until the question is answered.
  assert.equal(parseFrontmatter(await readFile(join(dir, document.path), "utf8")).body.replace(/^\n/, ""), TASK_TEXT);

  // The box is cleared through the MCP: render never sends Document asked. A run that sees it again finds it kept.
  const rendered = await ok(dir, ["sync", "render", "--ids", document.id]);
  assert.equal(JSON.stringify(rendered).includes("Document asked"), false);
  const again = await ok(dir, ["sync", "plan"], { as_of: NOW, rows: [row(TASK_PAGE, true)] });
  assert.equal(again.task_documents[0].source, kept.created[0].id);
  assert.equal(again.task_documents[0].existing, document.id);
});

test("with Documents off nothing is kept: a ticked box is ignored MODULE_OFF and stays ticked (0100 §5)", async (context) => {
  const dir = await setUp(context);
  // The flag needs the Tasks module too: with it off, the row is MODULE_OFF and nothing is kept.
  await ok(dir, ["modules", "off", "tasks"]);
  const tasksOff = await ok(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "tasks", page_id: TASK_PAGE, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Check go-live with hosting", "Document asked": true } }] });
  assert.deepEqual(tasksOff.task_documents, []);
  assert.deepEqual(tasksOff.ignored.map((item: { reason: string }) => item.reason), ["MODULE_OFF"]);
  await ok(dir, ["modules", "on", "tasks"]);
  await ok(dir, ["modules", "off", "reports"]);
  await ok(dir, ["modules", "off", "documents"]);
  const plan = await ok(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "tasks", page_id: TASK_PAGE, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Check go-live with hosting", "Document asked": true } }] });
  assert.deepEqual(plan.task_documents, []);
  assert.deepEqual(plan.ignored, [{ database: "tasks", page_id: TASK_PAGE, brain_id: null, property: "Document asked", reason: "MODULE_OFF" }]);
  // Without the Document asked mapping no row is read for it.
  await ok(dir, ["modules", "on", "documents"]);
  await ok(dir, ["config", "set", "notion.tasks.properties.document_asked", JSON.stringify("")]);
  const unmapped = await ok(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "tasks", page_id: TASK_PAGE, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "x", "Document asked": true } }] });
  assert.deepEqual(unmapped.task_documents, []);
});

test("the agreed From the brain lines cite their notes, go at the end of the section and leave the text above unchanged (0100 §3)", async (context) => {
  const dir = await setUp(context);
  const kept = await ok(dir, ["note", "new"], { notes: keepItems() });
  const document = kept.created[1];
  const first = await ok(dir, ["proposal", "new"], { proposals: [fromTheBrain(document.id)] });
  await ok(dir, ["apply"], { decisions: [{ proposal: first.created[0].id, action: "approve", note: "a", decided_at: NOW, decided_by: "chat" }] });
  const after = parseFrontmatter(await readFile(join(dir, document.path), "utf8"));
  assert.equal(after.body.replace(/^\n/, ""), `${TASK_TEXT}\n<!-- from-the-brain -->\n## From the brain\n\n${LINE}\n`);
  assert.deepEqual(after.attributes.sources, [kept.created[0].id], "sources unchanged: each line cites its note");
  assert.doesNotMatch(after.body, /^Source: /m);

  // A line already there is not proposed again; a new one goes at the section's end.
  const repeat = await ok(dir, ["proposal", "new"], { proposals: [fromTheBrain(document.id)] });
  assert.deepEqual(repeat.skipped, [{ input_index: 0, reason: "ALREADY_ADDED" }]);
  const other = "- Firebase was the earlier choice ([Use Firebase for auth](../decisions/2026-10-01-use-firebase-for-auth.md))";
  const second = await ok(dir, ["proposal", "new"], { proposals: [fromTheBrain(document.id, `${LINE}\n${other}`, { passages: [DECISION, "dec-2p9f6h1r"] })] });
  assert.equal(second.created.length, 1);
  await ok(dir, ["apply"], { decisions: [{ proposal: second.created[0].id, action: "approve", note: "yes", decided_at: NOW, decided_by: "chat" }] });
  const twice = parseFrontmatter(await readFile(join(dir, document.path), "utf8")).body.replace(/^\n/, "");
  assert.equal(twice, `${TASK_TEXT}\n<!-- from-the-brain -->\n## From the brain\n\n${LINE}\n${other}\n`);
  assert.ok(twice.startsWith(TASK_TEXT), "the task's text above is unchanged");

  // In Notion: the text above as the whole Document's, the section as a brain note's, without its marker line.
  const rendered = (await ok(dir, ["sync", "render", "--ids", document.id])).items[0];
  assert.equal(rendered.body, `\n${TASK_TEXT}\n## From the brain\n\n- Acme switches auth to Supabase (Use Supabase for auth)\n- Firebase was the earlier choice (Use Firebase for auth)\n`);

  const lint = await ok(dir, ["lint"]);
  assert.equal(lint.errors, 0, JSON.stringify(lint.issues));
});

test("a From the brain item is refused when it isn't on a task's whole Document, isn't of the line form, or doesn't cite its note (cli §5.6)", async (context) => {
  const dir = await setUp(context);
  const kept = await ok(dir, ["note", "new"], { notes: keepItems() });
  const document = kept.created[1];
  const refused = async (item: Record<string, unknown>, pointer: string) => {
    const result = await run(dir, ["proposal", "new"], { proposals: [item] });
    assert.equal(result.json.error?.code, "INPUT_INVALID", `${pointer}: ${result.stdout}`);
    assert.equal(result.json.error.details[0].pointer, pointer);
  };
  await refused(fromTheBrain("con-1s6t8e2b"), "/proposals/0/target");
  await refused(fromTheBrain(document.id, "Acme switches auth to Supabase"), "/proposals/0/content");
  await refused(fromTheBrain(document.id, "- Itself ([Check go-live with hosting](check-go-live-with-hosting.md))", { passages: [document.id] }), "/proposals/0/content");
  await refused(fromTheBrain(document.id, LINE, { passages: [kept.created[0].id] }), "/proposals/0/passages");
  await refused({ ...fromTheBrain(document.id), section: "elsewhere" }, "/proposals/0/section");
  await refused({ ...fromTheBrain(document.id), kind: "update_body", content: `${TASK_TEXT}more\n` }, "/proposals/0/section");
});

test("kept again: the same page is a duplicate and already kept; a changed page is a new version and an asked update_body that keeps the section (capture-and-review §13.5)", async (context) => {
  const dir = await setUp(context);
  const kept = await ok(dir, ["note", "new"], { notes: keepItems() });
  const [source, document] = kept.created;
  const first = await ok(dir, ["proposal", "new"], { proposals: [fromTheBrain(document.id)] });
  await ok(dir, ["apply"], { decisions: [{ proposal: first.created[0].id, action: "approve", note: "a", decided_at: NOW, decided_by: "chat" }] });

  const same = await ok(dir, ["note", "new"], { notes: keepItems() .map((item) => { const { id: _id, ...rest } = item; return rest; }) });
  assert.deepEqual(same.skipped.map((item: { reason: string }) => item.reason), ["DUPLICATE_SOURCE", "ALREADY_KEPT"]);

  const changedText = `${TASK_TEXT}\nThe registrar needs two days' notice.\n`;
  const version = await ok(dir, ["note", "new"], { notes: [{ type: "source", title: "Check go-live with hosting", file_date: "2026-12-10", frontmatter: { source_key: `notion:${TASK_PAGE}`, kind: "task", projects: [PROJECT], replaces: source.id }, body: changedText }] });
  assert.equal(version.created.length, 1);
  const plan = await ok(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "tasks", page_id: TASK_PAGE, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Check go-live with hosting", "Document asked": true } }] });
  assert.equal(plan.task_documents[0].source, version.created[0].id, "the latest version");

  const current = parseFrontmatter(await readFile(join(dir, document.path), "utf8")).body.replace(/^\n/, "");
  const section = current.slice(current.indexOf("<!-- from-the-brain -->"));
  const asked = await ok(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Check go-live with hosting: new text", target: document.id, content: `${changedText}\n${section}`, why: "The task page changed.", source: version.created[0].id, passages: [version.created[0].id] }] });
  assert.equal(asked.created[0].kind, "update_body", "asked, never folded");
  const diff = await ok(dir, ["source", "diff", version.created[0].id]);
  assert.equal(diff.added, 2);
  await ok(dir, ["apply"], { decisions: [{ proposal: asked.created[0].id, action: "approve", note: "yes", decided_at: NOW, decided_by: "chat" }] });
  const updated = parseFrontmatter(await readFile(join(dir, document.path), "utf8")).body.replace(/^\n/, "");
  assert.equal(updated, `${changedText}\n${section}`);
  assert.ok(updated.endsWith(`${LINE}\n`), "the From the brain section stays last");
  // One source, the latest; the earlier is reached through replaces (schema §11.2).
  assert.deepEqual(parseFrontmatter(await readFile(join(dir, document.path), "utf8")).attributes.sources, [version.created[0].id]);
  const lint = await ok(dir, ["lint"]);
  assert.equal(lint.errors, 0, JSON.stringify(lint.issues));
});

test("a whole Document of a file whose v2 is ingested: the update_body leaves it one source, the latest; another source is refused (schema §11.2, a gap closed beyond 0100)", async (context) => {
  const dir = await setUp(context);
  const v1 = "## Requirements\n\n- Login with email\n";
  const v2 = "## Requirements\n\n- Login with email\n- Launch in March\n";
  const file = { source_key: "file:sha256:1111111111111111111111111111111111111111111111111111111111111111", kind: "document", file_name: "requirements.md", converter: "none" };
  const first = await ok(dir, ["note", "new"], { notes: [
    { type: "source", id: "src-1q2w3e4r", title: "Requirements", file_date: "2026-12-01", frontmatter: file, body: v1 },
    { type: "reference", title: "Requirements", frontmatter: { summary: "The requirements, whole.", origin: "whole", projects: [PROJECT], sources: ["src-1q2w3e4r"] }, body: v1 },
  ] });
  const document = first.created[1];
  const second = await ok(dir, ["note", "new"], { notes: [{ type: "source", title: "Requirements v2", file_date: "2026-12-05", frontmatter: { ...file, source_key: "file:sha256:2222222222222222222222222222222222222222222222222222222222222222", replaces: "src-1q2w3e4r" }, body: v2 }] });
  const later = second.created[0].id;
  const unrelated = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Requirements: new text", target: document.id, content: v2, why: "The file changed.", source: "src-7w3c9k5m", passages: ["src-7w3c9k5m"] }] });
  assert.equal(unrelated.json.error?.code, "INPUT_INVALID");
  assert.equal(unrelated.json.error.details[0].pointer, "/proposals/0/source");
  const asked = await ok(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Requirements: new text", target: document.id, content: v2, why: "The file changed.", source: later, passages: [later] }] });
  const applied = await ok(dir, ["apply"], { decisions: [{ proposal: asked.created[0].id, action: "approve", note: "yes", decided_at: NOW, decided_by: "chat" }] });
  assert.equal(applied.decisions[0].result, "applied", JSON.stringify(applied));
  const kept = parseFrontmatter(await readFile(join(dir, document.path), "utf8"));
  assert.deepEqual(kept.attributes.sources, [later]);
  assert.equal(kept.body.replace(/^\n/, ""), v2);
  const lint = await ok(dir, ["lint"]);
  assert.equal(lint.errors, 0, JSON.stringify(lint.issues));
});

test("a new brain maps Tasks' Document asked and Kind, with no Knowledge module or Decisions and Questions databases (templates/brain/brain.json, schema §12, 0099)", async () => {
  const template = JSON.parse(await readFile(join(import.meta.dirname, "..", "templates", "brain", "brain.json"), "utf8"));
  assert.equal(template.notion.tasks.properties.document_asked, "Document asked");
  assert.equal(template.notion.tasks.properties.kind, "Kind");
  assert.equal("knowledge" in template.modules, false);
  assert.equal("decisions" in template.notion.databases || "questions" in template.notion.databases, false);
});
