import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// A tracked question's finished task is asked in the session (0.16.0, decision 0101 §6; cli §5.14.1 to §5.14.3, §5.7; schema §11.2).
// Synthetic brain (tests/fixtures/brain-acme) and a simulated Notion snapshot of `tasks` rows.

const NOW = "2026-12-10T09:00:00Z";
const EDITED = "2026-12-10T08:00:00Z";
const QUESTION = "que-8n3v5x1d";
const QUESTION_PATH = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const TASK = "e1000000-0000-4000-8000-000000000001";
const TRASHED = "e1000000-0000-4000-8000-000000000002";
const LOST = "e1000000-0000-4000-8000-000000000003";
const TRASH_QUESTION = "que-2b4d6f8h";
const LOST_QUESTION = "que-3c5e7g9j";

let counter = 0;
async function file(dir: string, value: unknown): Promise<string> {
  const path = join(dir, "..", `tracked-${counter += 1}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}

const attributes = async (dir: string, path: string) => parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;

/** The fixture's open question, tracked by TASK; with `all`, two more tracked questions (one task trashed, one unreadable). */
async function tracked(dir: string, all = false): Promise<void> {
  const target = join(dir, QUESTION_PATH);
  const document = parseFrontmatter(await readFile(target, "utf8"));
  document.attributes.task = TASK;
  await writeFile(target, serializeFrontmatter(document));
  if (!all) return;
  const question = (id: string, title: string, task: string) => serializeNewFile({ id, type: "question", title, summary: title, lifecycle: "reviewed", kind: "question", task, created: "2026-12-03", updated: "2026-12-03" }, "");
  await writeFile(join(dir, "knowledge/questions/is-the-budget-final.md"), question(TRASH_QUESTION, "Is the budget final?", TRASHED));
  await writeFile(join(dir, "knowledge/questions/who-signs-the-contract.md"), question(LOST_QUESTION, "Who signs the contract?", LOST));
}

const row = (page: string, status: string, extra: Record<string, unknown> = {}) => ({ database: "tasks", page_id: page, last_edited: EDITED, properties: { Name: "Ask Carlos about mobile", Status: status }, ...extra });
const trashed = { database: "tasks", page_id: TRASHED, last_edited: EDITED, properties: { Name: "Confirm the budget", Status: "To Do" }, gone: true };
const unreadable = (page = LOST) => ({ database: "tasks", page_id: page, last_edited: null, properties: {}, unreadable: true });

async function plan(dir: string, rows: unknown[]) {
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await file(dir, { as_of: NOW, rows }), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  return run.json.data;
}
async function syncApply(dir: string, data: unknown) {
  const run = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await file(dir, data), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  return run.json.data;
}
const read = async (dir: string, rows: unknown[]) => syncApply(dir, await plan(dir, rows));
const waiting = async (dir: string) => ((await brain(["proposal", "list", "--waiting", "--brain", dir, "--json"])).json.data.waiting as Array<Record<string, unknown>>).filter((entry) => entry.kind === "tracked_task");
const decide = async (dir: string, decisions: unknown[]) => brain(["apply", "--brain", dir, "--now", NOW, "--input", await file(dir, { decisions: decisions.map((item) => ({ decided_at: NOW, decided_by: "chat", ...(item as object) })) }), "--json"]);
const lintErrors = async (dir: string) => (await brain(["lint", "--brain", dir, "--json"])).json.data.errors;

test("a tracked question whose task is Done, in the trash or unreadable leaves one waiting question each (cli §5.14.2, §5.14.3)", async (context) => {
  const dir = await fixtureCopy(context);
  await tracked(dir, true);
  const listed = await brain(["sync", "tracked", "--brain", dir, "--json"]);
  assert.deepEqual(listed.json.data.tracked, [
    { question: TRASH_QUESTION, page_id: TRASHED, title: "Is the budget final?" },
    { question: LOST_QUESTION, page_id: LOST, title: "Who signs the contract?" },
    { question: QUESTION, page_id: TASK, title: "Who owns the Acme mobile app?" },
  ]);

  const data = await plan(dir, [row(TASK, "Done", { status_group: "complete" }), trashed, unreadable()]);
  assert.deepEqual(data.tracked_tasks, [
    { question: TRASH_QUESTION, page_id: TRASHED, page_title: "Confirm the budget", state: "gone", status: null, observed_at: EDITED },
    { question: LOST_QUESTION, page_id: LOST, state: "unreadable", status: null, observed_at: null },
    { question: QUESTION, page_id: TASK, page_title: "Ask Carlos about mobile", state: "done", status: "Done", observed_at: EDITED },
  ]);
  const before = await readFile(join(dir, QUESTION_PATH), "utf8");
  const applied = await syncApply(dir, data);
  assert.deepEqual(applied.tracked_tasks.map((item: Record<string, unknown>) => item.result), ["written", "written", "written"]);
  assert.equal(await readFile(join(dir, QUESTION_PATH), "utf8"), before, "nothing of the question changes until you answer");
  assert.equal(await lintErrors(dir), 0);

  const list = await waiting(dir);
  assert.deepEqual(list.map((entry) => [entry.target, entry.group, entry.task_state, entry.title, entry.why]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))), [
    [QUESTION, 2, "done", "Who owns the Acme mobile app?: its task is Done", "Ask Carlos about mobile is Done in Notion"],
    [TRASH_QUESTION, 2, "gone", "Is the budget final?: its task is in the trash", "Confirm the budget is in Notion's trash"],
    [LOST_QUESTION, 2, "unreadable", "Who signs the contract?: its task is unreadable", "Who signs the contract? can't be read in Notion"],
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

  // The same snapshot again asks nothing more: each is waiting.
  const again = await plan(dir, [row(TASK, "Done", { status_group: "complete" }), trashed, unreadable()]);
  assert.deepEqual([again.tracked_tasks, again.withdrawn], [[], []]);

  // (a) records the answer; (c) on the trashed task unlinks it; (c) on the unreadable one keeps its link.
  const id = (target: string) => list.find((entry) => entry.target === target)!.id;
  const run = await decide(dir, [
    { proposal: id(QUESTION), action: "fix", note: "a: Carlos keeps it", fixes: [{ answer: "Carlos keeps mobile." }] },
    { proposal: id(TRASH_QUESTION), action: "reject", note: "c" },
    { proposal: id(LOST_QUESTION), action: "reject", note: "c" },
  ]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.decisions.map((item: Record<string, unknown>) => [item.proposal, item.result]), [[id(QUESTION), "applied"], [id(TRASH_QUESTION), "closed"], [id(LOST_QUESTION), "closed"]]);
  assert.deepEqual(run.json.data.notion_writes, [], "nothing is written to Notion");
  const answered = await attributes(dir, QUESTION_PATH);
  assert.deepEqual([answered.answer, answered.task, answered.lifecycle], ["Carlos keeps mobile.", TASK, "draft"]);
  const untracked = await attributes(dir, "knowledge/questions/is-the-budget-final.md");
  assert.deepEqual([untracked.task, untracked.answer, untracked.dropped], [undefined, undefined, undefined], "open and untracked");
  assert.equal((await attributes(dir, "knowledge/questions/who-signs-the-contract.md")).task, LOST, "the unreadable task's link is kept");
  assert.equal(await lintErrors(dir), 0);

  // Next read: the answered and the unlinked questions are no longer tracked; the unreadable one isn't asked again while it stays unreadable.
  const later = await plan(dir, [row(TASK, "Done", { status_group: "complete" }), trashed, unreadable()]);
  assert.deepEqual([later.tracked_tasks, later.withdrawn], [[], []]);
  assert.deepEqual(later.ignored.filter((item: Record<string, unknown>) => item.database === "tasks").map((item: Record<string, unknown>) => [item.page_id, item.reason]), [[TASK, "NOT_TRACKED"], [TRASHED, "NOT_TRACKED"]]);
});

test("Won't Do is asked like Done, and (b) drops the question with its task kept (0101 §6, schema §11.2)", async (context) => {
  const dir = await fixtureCopy(context);
  await tracked(dir);
  const data = await plan(dir, [row(TASK, "Won't Do")]);
  assert.deepEqual(data.tracked_tasks.map((item: Record<string, unknown>) => [item.state, item.status]), [["dropped", "Won't Do"]]);
  await syncApply(dir, data);
  const [proposal] = await waiting(dir);
  assert.equal(proposal!.title, "Who owns the Acme mobile app?: its task is Won't Do");
  const run = await decide(dir, [{ proposal: proposal!.id, action: "fix", note: "b", fixes: [{ drop: true }] }]);
  assert.equal(run.json.data.decisions[0].result, "applied", run.stdout);
  const question = await attributes(dir, QUESTION_PATH);
  assert.deepEqual([question.lifecycle, question.dropped, question.task, question.answer], ["archived", "2026-12-10", TASK, undefined]);
  assert.equal(await lintErrors(dir), 0);

  // A brain that names its Won't Do status otherwise is read by its own name.
  const other = await fixtureCopy(context);
  await tracked(other);
  const config = JSON.parse(await readFile(join(other, "brain.json"), "utf8"));
  config.notion.tasks.wont_do_status = "Cancelled";
  await writeFile(join(other, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  assert.deepEqual((await plan(other, [row(TASK, "Won't Do")])).tracked_tasks, []);
  assert.deepEqual((await plan(other, [row(TASK, "Cancelled")])).tracked_tasks.map((item: Record<string, unknown>) => item.state), ["dropped"]);
});

test("a tracked_task is decided with fix or reject: approve fails, and a question answered meanwhile closes it stale (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  await tracked(dir);
  await read(dir, [row(TASK, "Done")]);
  const [proposal] = await waiting(dir);
  const approve = await decide(dir, [{ proposal: proposal!.id, action: "approve", note: "yes" }]);
  assert.deepEqual([approve.json.data.decisions[0].result, approve.json.data.decisions[0].reason], ["failed", "INPUT_INVALID"]);
  const target = join(dir, QUESTION_PATH);
  const document = parseFrontmatter(await readFile(target, "utf8"));
  document.attributes.lifecycle = "archived"; document.attributes.dropped = "2026-12-09";
  await writeFile(target, serializeFrontmatter(document));
  const stale = await decide(dir, [{ proposal: proposal!.id, action: "fix", note: "a", fixes: [{ answer: "Carlos." }] }]);
  assert.deepEqual([stale.json.data.decisions[0].result, stale.json.data.decisions[0].reason], ["closed", "STALE_PROPOSAL"]);
  assert.equal((await attributes(dir, QUESTION_PATH)).answer, undefined);
});

test("a waiting tracked_task is updated when the task changes, withdrawn when reopened or no longer tracked; a kept-open Done is asked again only once edited (cli §5.14.2)", async (context) => {
  const dir = await fixtureCopy(context);
  await tracked(dir);
  await read(dir, [row(TASK, "Done")]);
  const [first] = await waiting(dir);

  // Changed again in Notion (now Won't Do): the same proposal is updated.
  const changed = await plan(dir, [row(TASK, "Won't Do", { last_edited: "2026-12-10T08:30:00Z" })]);
  assert.deepEqual(changed.tracked_tasks.map((item: Record<string, unknown>) => [item.state, item.proposal]), [["dropped", first!.id]]);
  assert.deepEqual((await syncApply(dir, changed)).tracked_tasks.map((item: Record<string, unknown>) => [item.result, item.proposal]), [["updated", first!.id]]);
  const updated = await waiting(dir);
  assert.deepEqual(updated.map((entry) => [entry.id, entry.task_state, entry.task_status, entry.task_edited]), [[first!.id, "dropped", "Won't Do", "2026-12-10T08:30:00Z"]]);

  // Reopened: withdrawn, closed with no decision.
  const reopened = await plan(dir, [row(TASK, "In progress", { last_edited: "2026-12-10T08:40:00Z" })]);
  assert.deepEqual([reopened.tracked_tasks, reopened.withdrawn], [[], [{ proposal: first!.id, reason: "TASK_REOPENED" }]]);
  await syncApply(dir, reopened);
  const record = await attributes(dir, first!.path as string);
  assert.deepEqual([record.status, record.closed_reason, record.decision], ["closed", "withdrawn", undefined]);

  // Done again, then kept open (c): not asked again while the task stays as it is; asked again once edited.
  await read(dir, [row(TASK, "Done", { last_edited: "2026-12-10T08:50:00Z" })]);
  const [second] = await waiting(dir);
  assert.notEqual(second!.id, first!.id);
  assert.equal((await decide(dir, [{ proposal: second!.id, action: "reject", note: "c" }])).json.data.decisions[0].result, "closed");
  assert.equal((await attributes(dir, QUESTION_PATH)).task, TASK, "(c) on a Done task changes nothing");
  assert.deepEqual((await plan(dir, [row(TASK, "Done", { last_edited: "2026-12-10T08:50:00Z" })])).tracked_tasks, []);
  assert.deepEqual((await plan(dir, [row(TASK, "Done", { last_edited: "2026-12-11T08:00:00Z" })])).tracked_tasks.map((item: Record<string, unknown>) => [item.state, item.proposal]), [["done", undefined]]);

  // Pending, then the question is answered another way: withdrawn NOT_TRACKED, and its row is not tracked.
  await read(dir, [row(TASK, "Done", { last_edited: "2026-12-11T08:00:00Z" })]);
  const [third] = await waiting(dir);
  const target = join(dir, QUESTION_PATH);
  const document = parseFrontmatter(await readFile(target, "utf8"));
  document.attributes.answer = "Carlos keeps mobile.";
  await writeFile(target, serializeFrontmatter(document));
  const untracked = await plan(dir, [row(TASK, "Done", { last_edited: "2026-12-11T08:00:00Z" })]);
  assert.deepEqual([untracked.tracked_tasks, untracked.withdrawn], [[], [{ proposal: third!.id, reason: "NOT_TRACKED" }]]);
  assert.equal(await lintErrors(dir), 0);
});

test("an unreadable task is asked once, not again while it stays unreadable, and again after it was readable and open (cli §5.14.2)", async (context) => {
  const dir = await fixtureCopy(context);
  await tracked(dir);
  await read(dir, [unreadable(TASK)]);
  const [first] = await waiting(dir);
  assert.equal(first!.task_state, "unreadable");
  assert.deepEqual((await plan(dir, [unreadable(TASK)])).tracked_tasks, [], "waiting: not asked again");

  // Kept open (c): not asked again while the page stays unreadable.
  await decide(dir, [{ proposal: first!.id, action: "reject", note: "c" }]);
  assert.equal((await attributes(dir, QUESTION_PATH)).task, TASK);
  assert.deepEqual((await plan(dir, [unreadable(TASK)])).tracked_tasks, []);

  // Pending again after the page could be read (a new observation), then readable and open: withdrawn. Unreadable again: asked again.
  const fresh = await fixtureCopy(context);
  await tracked(fresh);
  await read(fresh, [unreadable(TASK)]);
  const [pending] = await waiting(fresh);
  const open = await read(fresh, [row(TASK, "In progress")]);
  assert.deepEqual(open.withdrawn.map((item: Record<string, unknown>) => [item.proposal, item.result]), [[pending!.id, "withdrawn"]]);
  const again = await plan(fresh, [unreadable(TASK)]);
  assert.deepEqual(again.tracked_tasks, [{ question: QUESTION, page_id: TASK, state: "unreadable", status: null, observed_at: null }], "a withdrawn proposal is a different observation");
});

test("with the Tasks module off, tasks rows are ignored and sync tracked refuses (MODULE_OFF)", async (context) => {
  const dir = await fixtureCopy(context);
  await tracked(dir);
  assert.equal((await brain(["modules", "off", "tasks", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const data = await plan(dir, [row(TASK, "Done")]);
  assert.deepEqual(data.tracked_tasks, []);
  assert.deepEqual(data.ignored.filter((item: Record<string, unknown>) => item.database === "tasks").map((item: Record<string, unknown>) => item.reason), ["MODULE_OFF"]);
  const run = await brain(["sync", "tracked", "--brain", dir, "--json"]);
  assert.equal(run.json.error.code, "MODULE_OFF");
});

test("a tasks row is validated: an unreadable page has no last_edited and no properties (cli §5.14.1)", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await file(dir, { as_of: NOW, rows: [{ ...unreadable(TASK), last_edited: EDITED, properties: { Name: "x" } }, { ...trashed, unreadable: true }] }), "--json"]);
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/rows/0/last_edited", "/rows/0/properties", "/rows/1/unreadable", "/rows/1/last_edited", "/rows/1/properties"]);
});
