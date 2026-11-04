import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

// Decision 0071 (0.9.1, CC-126): the to-do tidy drops a question that was a to-do (spec/cli.md §5.30, capture-and-review §6.2).
const QUESTION_FILE = "knowledge/questions/who-owns-the-acme-mobile-app.md";
const QUESTION = "que-8n3v5x1d";
const MEETING_TASK = "8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1e"; // in the fixture meeting's `tasks`
const NOW = "2026-12-12T09:00:00Z";

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

const drop = (dir: string, items: unknown[]) => run(dir, ["question", "drop"], { items });
const question = (dir: string) => readFile(join(dir, QUESTION_FILE), "utf8");

async function rendered(dir: string): Promise<Record<string, any>> {
  const result = await run(dir, ["sync", "render", "--ids", QUESTION]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data.items[0];
}

async function lintErrors(dir: string): Promise<unknown[]> {
  const lint = await run(dir, ["lint"]);
  return lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

async function editQuestion(dir: string, edit: (text: string) => string): Promise<void> {
  const path = join(dir, QUESTION_FILE);
  await writeFile(path, edit(await readFile(path, "utf8")));
}

test("question drop: converts a question to its recorded Task, archives it and publishes Dropped once", async (context) => {
  const dir = await fixtureCopy(context);
  const result = await drop(dir, [{ id: QUESTION, task: MEETING_TASK }]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, [{ id: QUESTION, result: "dropped", task: MEETING_TASK }]);
  const text = await question(dir);
  assert.match(text, /^lifecycle: archived$/m);
  assert.match(text, /^dropped: 2026-12-12$/m);
  assert.match(text, new RegExp(`^task: ${MEETING_TASK}$`, "m"));
  assert.match(text, /^updated: 2026-12-12$/m);
  assert.match(text, /^  status: Open$/m, "Status stays yours in the note");
  assert.match(await readFile(join(dir, "log", "2026-12.md"), "utf8"), /question-drop que-8n3v5x1d "Who owns the Acme mobile app\?"/);
  assert.deepEqual(await lintErrors(dir), []);

  const first = await rendered(dir);
  assert.equal(first.action, "update");
  assert.deepEqual(first.properties.Status, { type: "select", value: "Dropped" });
  assert.deepEqual(first.properties.Lifecycle, { type: "select", value: "Archived" });
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: QUESTION, notion: first.page_id, synced_at: NOW, published: first.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  const second = await run(dir, ["sync", "render", "--ids", QUESTION]);
  assert.equal(second.json.data.items[0]?.properties.Status, undefined, "Dropped goes out once");
});

test("question drop: without a task, someone else's commitment is dropped with no Task", async (context) => {
  const dir = await fixtureCopy(context);
  const result = await drop(dir, [{ id: QUESTION }]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, [{ id: QUESTION, result: "dropped" }]);
  const text = await question(dir);
  assert.match(text, /^dropped: 2026-12-12$/m);
  assert.doesNotMatch(text, /^task:/m);
  assert.deepEqual((await rendered(dir)).properties.Status, { type: "select", value: "Dropped" });
  assert.deepEqual(await lintErrors(dir), []);
});

test("question drop: a retry is unchanged and writes nothing; a different task is refused", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await drop(dir, [{ id: QUESTION, task: MEETING_TASK }])).code, 0);
  const before = await question(dir);
  const again = await run(dir, ["question", "drop"], { items: [{ id: QUESTION, task: MEETING_TASK }] }, "2026-12-20T09:00:00Z");
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data.items, [{ id: QUESTION, result: "unchanged", task: MEETING_TASK }]);
  assert.equal(await question(dir), before);
  const other = await drop(dir, [{ id: QUESTION }]);
  assert.equal(other.json.error.code, "INPUT_INVALID", other.stdout);
  assert.equal(await question(dir), before);
});

test("question drop: a Task the brain has not recorded is refused and nothing is written", async (context) => {
  const dir = await fixtureCopy(context);
  const before = await question(dir);
  const result = await drop(dir, [{ id: QUESTION, task: "unrecorded-task-page" }]);
  assert.equal(result.json.error.code, "INPUT_INVALID", result.stdout);
  assert.equal(await question(dir), before);
});

test("question drop: a risk, an answered question, a non-question, a repeated id and a bad item are refused before any write", async (context) => {
  const dir = await fixtureCopy(context);
  const before = await question(dir);
  const unknown = await drop(dir, [{ id: "que-2b4d6f8h" }]);
  assert.equal(unknown.json.error.code, "UNKNOWN_ID", unknown.stdout);
  for (const items of [
    [{ id: "dec-7k2m9q4x" }],
    [{ id: QUESTION }, { id: QUESTION }],
    [{ id: QUESTION, task: "" }],
    [{ id: QUESTION, extra: true }],
    [],
  ]) {
    const result = await drop(dir, items);
    assert.equal(result.json.error.code, "INPUT_INVALID", `${JSON.stringify(items)}: ${result.stdout}`);
  }
  assert.equal(await question(dir), before);

  await editQuestion(dir, (text) => text.replace(/^kind: question$/m, "kind: risk"));
  assert.equal((await drop(dir, [{ id: QUESTION }])).json.error.code, "INPUT_INVALID", "a risk is never dropped as a to-do");
  await editQuestion(dir, (text) => text.replace(/^kind: risk$/m, "kind: question").replace(/^raised_in:/m, "answer: Carlos keeps the mobile app.\nraised_in:"));
  assert.equal((await drop(dir, [{ id: QUESTION }])).json.error.code, "INPUT_INVALID", "an answered question is not a to-do");
});

test("render: Dropped is not sent again after you reopen the question in Notion", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await drop(dir, [{ id: QUESTION }])).code, 0);
  const first = await rendered(dir);
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id: QUESTION, notion: first.page_id, synced_at: NOW, published: first.published }] })).code, 0);
  await editQuestion(dir, (text) => text.replace(/^  status: Open$/m, "  status: Open").replace(/^  as_of: .*$/m, "  as_of: 2026-12-13T08:00:00Z"));
  const later = await run(dir, ["sync", "render", "--ids", QUESTION], undefined, "2026-12-14T09:00:00Z");
  assert.equal(later.json.data.items[0]?.properties.Status, undefined);
});

test("render: a question you already set to Dropped in Notion gets no Status from the drop", async (context) => {
  const dir = await fixtureCopy(context);
  await editQuestion(dir, (text) => text.replace(/^  status: Open$/m, "  status: Dropped"));
  assert.equal((await drop(dir, [{ id: QUESTION }])).code, 0);
  assert.equal((await rendered(dir)).properties.Status, undefined);
});
