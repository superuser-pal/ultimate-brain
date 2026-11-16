import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
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

/** A question has no Notion page since 0.16.0 (0099): rendering it is skipped, so a drop publishes nothing. */
async function notRendered(dir: string): Promise<void> {
  const result = await run(dir, ["sync", "render", "--ids", QUESTION]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, []);
  assert.deepEqual(result.json.data.skipped, [{ id: QUESTION, reason: "NO_DATABASE" }]);
}

async function lintErrors(dir: string): Promise<unknown[]> {
  const lint = await run(dir, ["lint"]);
  return lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

async function editQuestion(dir: string, edit: (text: string) => string): Promise<void> {
  const path = join(dir, QUESTION_FILE);
  await writeFile(path, edit(await readFile(path, "utf8")));
}

test("question drop: converts a question to its recorded Task and archives it; nothing is published (0099)", async (context) => {
  const dir = await fixtureCopy(context);
  const result = await drop(dir, [{ id: QUESTION, task: MEETING_TASK }]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, [{ id: QUESTION, result: "dropped", task: MEETING_TASK }]);
  const text = await question(dir);
  assert.match(text, /^lifecycle: archived$/m);
  assert.match(text, /^dropped: 2026-12-12$/m);
  assert.match(text, new RegExp(`^task: ${MEETING_TASK}$`, "m"));
  assert.match(text, /^updated: 2026-12-12$/m);
  assert.match(text, /^  status: Open$/m, "the retired Status stays in the note as history");
  assert.match(await readFile(join(dir, "log", "2026-12.md"), "utf8"), /question-drop que-8n3v5x1d "Who owns the Acme mobile app\?"/);
  assert.deepEqual(await lintErrors(dir), []);

  await notRendered(dir);
});

test("question drop: without a task, someone else's commitment is dropped with no Task", async (context) => {
  const dir = await fixtureCopy(context);
  const result = await drop(dir, [{ id: QUESTION }]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.items, [{ id: QUESTION, result: "dropped" }]);
  const text = await question(dir);
  assert.match(text, /^dropped: 2026-12-12$/m);
  assert.doesNotMatch(text, /^task:/m);
  await notRendered(dir);
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

test("question drop: an archived question, or one you track, is refused; a Status set in Notion is history and not read (0099)", async (context) => {
  const dir = await fixtureCopy(context);
  await editQuestion(dir, (text) => text.replace(/^lifecycle: draft$/m, "lifecycle: archived"));
  const before = await question(dir);
  assert.equal((await drop(dir, [{ id: QUESTION }])).json.error.code, "INPUT_INVALID", "an archived question is history");
  assert.equal(await question(dir), before);
  await editQuestion(dir, (text) => text.replace(/^lifecycle: archived$/m, "lifecycle: reviewed").replace(/^raised_in:/m, "task: 3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f\nraised_in:"));
  assert.equal((await drop(dir, [{ id: QUESTION }])).json.error.code, "INPUT_INVALID", "a tracked question is followed up, not a to-do");
  await editQuestion(dir, (text) => text.replace(/^task: .*\n/m, "").replace(/^  status: Open$/m, "  status: Answered"));
  assert.equal((await drop(dir, [{ id: QUESTION }])).code, 0, "notion_fields.status is retired: only the read-back turned it into an answer");
});

// The tidy's Convert for a question from a selected capture (an extract): the item is the one the question's paragraph names (capture-and-review §6.2).
const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}

test("question drop: a to-do question from a selected capture converts with the item its paragraph names", async (context) => {
  const dir = await fixtureCopy(context);
  const transcript = join(dir, "..", "capture.txt");
  const summary = join(dir, "..", "summary.md");
  await writeFile(transcript, "I need to send Globex the revised quote by Friday.\n\nNobody knows if the phase two budget is approved.");
  await writeFile(summary, `## [s1] Quote\nSelection: Use in brain\n### Open questions\n[s1.i1] Send Globex the revised quote by Friday? "I need to send Globex the revised quote"\n[s1.i2] Is the phase two budget approved? "Nobody knows if the phase two budget is approved"\n`);
  settle(dir);
  const written = await run(dir, ["source", "extract", "--page", "7a7b0000-0000-4000-8000-0000000000d1", "--title", "Quote capture", "--date", "2026-12-10", "--kind", "capture", "--summary", summary, "--transcript", transcript]);
  assert.equal(written.code, 0, written.stdout);
  const extract = written.json.data.created[0] as string;
  const source = parseFrontmatter(await readFile(join(dir, written.json.data.path), "utf8"));
  const passages = source.attributes.passages as Array<{ n: number; hash: string }>;
  const made = await run(dir, ["note", "new"], { notes: [{ type: "question", title: "Send Globex the revised quote?", frontmatter: { summary: "Filed as a question before 0.9.1.", kind: "question", projects: ["prj-9x4t1b7e"], sources: [extract] }, body: `Send Globex the revised quote by Friday. ^[${extract}#¶1:${passages.find((entry) => entry.n === 1)!.hash}]\n` }] });
  assert.equal(made.code, 0, made.stdout);
  const que = made.json.data.created[0].id as string;

  // The skill reads the item from the marker of the cited paragraph: exactly one item cites ¶1.
  const marker = /<!-- passage ¶1 item ([^>]*?)\s*-->/.exec(source.body)![1]!.split(",").map((id) => id.trim());
  assert.deepEqual(marker, ["s1.i1"]);
  const withoutItem = await run(dir, ["sync", "tasks", "--source", extract], { items: [{ title: "Send Globex the revised quote", projects: ["prj-9x4t1b7e"] }] });
  assert.equal(withoutItem.json.error.code, "INPUT_INVALID", "an extract Task needs its item");
  const tasks = await run(dir, ["sync", "tasks", "--source", extract], { items: [{ title: "Send Globex the revised quote", item: marker[0], projects: ["prj-9x4t1b7e"] }] });
  assert.equal(tasks.code, 0, tasks.stdout);
  const page = "7a7b0000-0000-4000-8000-0000000000d2";
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: extract, synced_at: NOW, tasks: [page], task_items: { [marker[0]!]: page } }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  const dropped = await drop(dir, [{ id: que, task: page }]);
  assert.equal(dropped.code, 0, dropped.stdout);
  assert.deepEqual(dropped.json.data.items, [{ id: que, result: "dropped", task: page }]);
  assert.deepEqual(await lintErrors(dir), []);
});
