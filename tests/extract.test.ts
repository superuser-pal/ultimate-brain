import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const PAGE = "11111111-2222-4333-8444-555555555555";
const TRANSCRIPT = "The launch moves to February.\n\nPricing is 95k, keep it between us.\n\nMaria sends the contract on Friday.";
const SUMMARY = (pricing: "Use in brain" | "Meeting only") => `## [s1] Launch\n- [s1.i1] Launch moves “The launch moves to February”\n\n## [s2] Pricing\nSelection: ${pricing}\n- [s2.i1] Price “keep it between us”\n\n## [s3] Contract\n- [s3.i1] Contract “sends the contract on Friday”\n`;

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

async function gitBrain(context: TestContext) {
  const dir = await fixtureCopy(context);
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "fixture");
  return dir;
}

async function extract(dir: string, summary: string, transcript: string, ...extra: string[]) {
  await writeFile(join(dir, "..", "s.md"), summary);
  await writeFile(join(dir, "..", "t.md"), transcript);
  return brain(["source", "extract", "--page", PAGE, "--title", "Launch sync", "--date", "2026-12-10", "--summary", join(dir, "..", "s.md"), "--transcript", join(dir, "..", "t.md"), "--brain", dir, "--now", NOW, "--json", ...extra]);
}

test("source extract writes the extract as one committed operation and removes the journal", async (context) => {
  const dir = await gitBrain(context);
  const first = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT);
  assert.equal(first.code, 0, first.stdout);
  assert.equal(first.json.data.result, "WRITTEN");
  assert.equal(first.json.data.version, 1);
  assert.equal(first.json.data.suppression, null, "a first version suppresses nothing");
  const file = await readFile(join(dir, first.json.data.path), "utf8");
  assert.ok(file.includes("Maria sends the contract") && !file.includes("95k"), "only the selected paragraphs");
  assert.ok(git(dir, "log", "-1", "--format=%B").includes(`Op: ${first.json.data.op}`), "the commit carries the Op trailer");
  assert.equal(existsSync(join(dir, "_journal")), false, "the journal is gone");
  assert.equal(git(dir, "status", "--porcelain").trim(), "");
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.issues.filter((i: { rule: string }) => i.rule === "extract-passages").length, 0);
  const again = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT, "--previous", first.json.data.created[0]);
  assert.equal(again.json.data.result, "UNCHANGED");
  assert.equal(git(dir, "log", "--oneline").trim().split("\n").length, 2, "UNCHANGED commits nothing");
});

test("a later version suppresses removed paragraphs in an append-only record and never edits the earlier record", async (context) => {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, SUMMARY("Use in brain"), TRANSCRIPT);
  assert.equal(v1.code, 0, v1.stdout);
  const v2 = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT, "--previous", v1.json.data.created[0]);
  assert.equal(v2.code, 0, v2.stdout);
  assert.equal(v2.json.data.version, 2);
  assert.equal(v2.json.data.suppression, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(join(dir, `_suppressions/${PAGE}.json`), "utf8"));
  assert.equal(record.records.length, 1);
  assert.deepEqual(record.records[0].passages.map((p: { n: number }) => p.n), [2]);
  assert.equal(record.records[0].status, "active");
  const v3 = await extract(dir, SUMMARY("Meeting only").replace("[s3.i1] Contract “sends the contract on Friday”", "[s3.i1] Contract “The launch moves to February”"), TRANSCRIPT, "--previous", v2.json.data.created[0]);
  assert.equal(v3.code, 0, v3.stdout);
  const after = JSON.parse(await readFile(join(dir, `_suppressions/${PAGE}.json`), "utf8"));
  assert.equal(after.records.length, 2, "the second suppression is appended");
  assert.deepEqual(after.records[0], record.records[0], "the earlier record is untouched");
  const status = await brain(["status", "--brain", dir, "--json"]);
  assert.equal(status.json.data.suppressions.active, 2);
});

test("a blocked input, a dirty tree and a missing --previous write nothing", async (context) => {
  const dir = await gitBrain(context);
  const blocked = await extract(dir, SUMMARY("Meeting only").replace("“keep it between us”", "“not there”"), TRANSCRIPT);
  assert.equal(blocked.code, 4);
  assert.equal(git(dir, "status", "--porcelain").trim(), "");
  await writeFile(join(dir, "stray.txt"), "x");
  const dirty = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT);
  assert.equal(dirty.json.error.code, "DIRTY_TREE");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "stray");
  const ok = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT);
  assert.equal(ok.code, 0, ok.stdout);
  const missing = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT);
  assert.match(missing.stdout, /PREVIOUS_REQUIRED/);
});

test("an interrupted write leaves a journal: every command refuses until recover rolls it back", async (context) => {
  const dir = await gitBrain(context);
  const tracked = "knowledge/references/row-level-security.md";
  const original = await readFile(join(dir, tracked), "utf8");
  await writeFile(join(dir, tracked), `${original}\nhalf written\n`);
  await writeFile(join(dir, "sources/notion/2026-12-10-new.md"), "---\nid: src-halfhalf\n---\n");
  await mkdir(join(dir, "_journal"), { recursive: true });
  await writeFile(join(dir, "_journal/op-deadbeef.json"), JSON.stringify({ op: "op-deadbeef", written: NOW, entries: [{ path: tracked, hash: null, new: false }, { path: "sources/notion/2026-12-10-new.md", hash: null, new: true }] }));
  const refused = await brain(["status", "--brain", dir, "--json"]);
  assert.equal(refused.json.error.code, "RECOVERY_NEEDED");
  const recovered = await brain(["recover", "--brain", dir, "--json"]);
  assert.equal(recovered.code, 0, recovered.stdout);
  assert.deepEqual(recovered.json.data.recovered, [{ op: "op-deadbeef", action: "restored" }]);
  assert.equal(await readFile(join(dir, tracked), "utf8"), original);
  assert.equal(existsSync(join(dir, "sources/notion/2026-12-10-new.md")), false);
  assert.equal(existsSync(join(dir, "_journal")), false);
  assert.equal((await brain(["status", "--brain", dir, "--json"])).code, 0);
  assert.equal((await brain(["recover", "--brain", dir, "--json"])).json.data.recovered.length, 0, "recover is idempotent");
});

test("recover only clears the journal when the Op commit exists", async (context) => {
  const dir = await gitBrain(context);
  const tracked = "knowledge/references/row-level-security.md";
  await writeFile(join(dir, tracked), `${await readFile(join(dir, tracked), "utf8")}\ncommitted\n`);
  git(dir, "commit", "-q", "-am", "work\n\nOp: op-cafe0001");
  await mkdir(join(dir, "_journal"), { recursive: true });
  await writeFile(join(dir, "_journal/op-cafe0001.json"), JSON.stringify({ op: "op-cafe0001", written: NOW, entries: [{ path: tracked, hash: null, new: false }] }));
  const run = await brain(["recover", "--brain", dir, "--json"]);
  assert.deepEqual(run.json.data.recovered, [{ op: "op-cafe0001", action: "committed" }]);
  assert.ok((await readFile(join(dir, tracked), "utf8")).includes("committed"), "committed work is kept");
});

test("the first extract of an input ingested in full replaces it and restricts its claims through an active record", async (context) => {
  const dir = await gitBrain(context);
  const page = "3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f";
  await writeFile(join(dir, "..", "s.md"), SUMMARY("Meeting only"));
  await writeFile(join(dir, "..", "t.md"), TRANSCRIPT);
  const run = await brain(["source", "extract", "--page", page, "--title", "Acme sync", "--date", "2026-12-10", "--summary", join(dir, "..", "s.md"), "--transcript", join(dir, "..", "t.md"), "--previous", "src-7w3c9k5m", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.version, 1);
  const record = JSON.parse(await readFile(join(dir, `_suppressions/${page}.json`), "utf8"));
  assert.deepEqual(record.records[0].full_copies, ["src-7w3c9k5m"]);
  assert.deepEqual(record.records[0].passages, []);
  const status = await brain(["status", "--brain", dir, "--json"]);
  assert.equal(status.json.data.suppressions.active, 1);
});

test("Tasks are bound to the item that authorized them, carried to the next version, and never rebound", async (context) => {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT);
  const id = v1.json.data.created[0] as string;
  const input = async (name: string, value: unknown) => { const path = join(dir, "..", name); await writeFile(path, JSON.stringify(value)); return path; };
  const rendered = await brain(["sync", "tasks", "--source", id, "--input", await input("tasks.json", { items: [{ title: "Send contract", item: "s3.i1" }] }), "--brain", dir, "--json"]);
  assert.equal(rendered.code, 0, rendered.stdout);
  assert.equal(rendered.json.data.items[0].item, "s3.i1", "the item id is echoed on the payload");
  const unknown = await brain(["sync", "tasks", "--source", id, "--input", await input("bad.json", { items: [{ title: "x", item: "s9.i9" }] }), "--brain", dir, "--json"]);
  assert.equal(unknown.json.error.code, "INPUT_INVALID");
  const record = async (taskItems: unknown, tasks: string[]) => brain(["sync", "record", "--input", await input("rec.json", { records: [{ id, synced_at: NOW, tasks, task_items: taskItems }] }), "--brain", dir, "--json"]);
  const ok = await record({ "s3.i1": "6a7b0000-0000-4000-8000-000000000001" }, ["6a7b0000-0000-4000-8000-000000000001"]);
  assert.equal(ok.json.data.records[0].result, "recorded", ok.stdout);
  assert.ok((await readFile(join(dir, v1.json.data.path), "utf8")).includes("6a7b0000-0000-4000-8000-000000000001"));
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "tasks");
  assert.equal((await record({ "s3.i1": "6a7b0000-0000-4000-8000-000000000002" }, ["6a7b0000-0000-4000-8000-000000000002"])).json.data.records[0].reason, "TASK_ITEM_EXISTS");
  assert.equal((await record({ "s9.i9": "6a7b0000-0000-4000-8000-000000000003" }, ["6a7b0000-0000-4000-8000-000000000003"])).json.data.records[0].reason, "INVALID_RESULT", "an item outside the selection");
  assert.equal((await record({ "s1.i1": "6a7b0000-0000-4000-8000-000000000004" }, [])).json.data.records[0].reason, "INVALID_RESULT", "a Task page not in the record's tasks");
  git(dir, "checkout", "--", ".");
  const v2 = await extract(dir, SUMMARY("Use in brain"), TRANSCRIPT, "--previous", id);
  assert.equal(v2.code, 0, v2.stdout);
  assert.ok((await readFile(join(dir, v2.json.data.path), "utf8")).includes("s3.i1: 6a7b0000-0000-4000-8000-000000000001"), "task_items is carried forward");
});

test("views leave out notes resting on a suppressed input, and the writer regenerates them in the same operation", async (context) => {
  const dir = await gitBrain(context);
  const page = "3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f";
  const before = await brain(["views", "--check", "--brain", dir, "--json"]);
  assert.equal(before.code, 0, "views start current");
  const log = "projects/acme-website/decision-log.md";
  const logBefore = await readFile(join(dir, log), "utf8");
  assert.ok(logBefore.includes("Use Firebase for auth") && logBefore.includes("Use Supabase for auth"));
  await writeFile(join(dir, "..", "s.md"), SUMMARY("Meeting only"));
  await writeFile(join(dir, "..", "t.md"), TRANSCRIPT);
  const run = await brain(["source", "extract", "--page", page, "--title", "Acme sync", "--date", "2026-12-10", "--summary", join(dir, "..", "s.md"), "--transcript", join(dir, "..", "t.md"), "--previous", "src-7w3c9k5m", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.ok(run.json.data.views.includes(log), "the writer regenerated the decision log");
  const logAfter = await readFile(join(dir, log), "utf8");
  assert.ok(logAfter.length < logBefore.length, "a decision resting on the suppressed input is left out");
  assert.equal(git(dir, "status", "--porcelain").trim(), "", "extract, record and views are one commit");
  assert.equal((await brain(["views", "--check", "--brain", dir, "--json"])).code, 0, "and the views are current");
});

test("cleanup-plan lists restricted claims, the claims that stay, Tasks of excluded items and Documents", async (context) => {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, SUMMARY("Use in brain"), TRANSCRIPT);
  const id = v1.json.data.created[0] as string;
  const hashes = new Map<number, string>();
  for (const m of (await readFile(join(dir, v1.json.data.path), "utf8")).matchAll(/- n: (\d+)\n\s+hash: ([0-9a-f]{8})/g)) hashes.set(Number(m[1]), m[2]!);
  const concept = join(dir, "knowledge/references/row-level-security.md");
  const original = await readFile(concept, "utf8");
  const withSource = original.replace(/\nsources:[^\n]*\n/, "\n").replace(/\n---\n/, `\nsources:\n  - ${id}\n---\n`);
  await writeFile(concept, `${withSource}\nPricing was 95k. ^[${id}#¶2:${hashes.get(2)}]\nThe contract goes Friday. ^[${id}#¶3:${hashes.get(3)}]\n`);
  const task = "6a7b0000-0000-4000-8000-000000000009";
  const rec = join(dir, "..", "rec.json");
  await writeFile(rec, JSON.stringify({ records: [{ id, synced_at: NOW, tasks: [task], task_items: { "s2.i1": task } }] }));
  assert.equal((await brain(["sync", "record", "--input", rec, "--brain", dir, "--json"])).json.data.records[0].result, "recorded");
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "claims");
  const v2 = await extract(dir, SUMMARY("Meeting only"), TRANSCRIPT, "--previous", id);
  assert.equal(v2.code, 0, v2.stdout);
  const plan = await brain(["source", "cleanup-plan", "--page", PAGE, "--brain", dir, "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  const entry = plan.json.data.notes.find((n: { note: string }) => n.note.startsWith("con-"));
  assert.ok(entry.restricted.some((r: { text: string }) => r.text.includes("95k")), "the pricing claim is restricted");
  assert.ok(entry.kept.some((r: { text: string }) => r.text.includes("Friday")), "the independently supported claim stays");
  assert.deepEqual(plan.json.data.tasks, [{ task, item: "s2.i1", reason: "item no longer selected" }]);
  assert.equal(plan.json.data.latest_extract, v2.json.data.created[0]);
});

test("lint warns when a note cites a meeting whose input cannot be determined", async (context) => {
  const dir = await gitBrain(context);
  const clean = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(clean.json.data.issues.filter((i: { rule: string }) => i.rule === "unknown-lineage").length, 0);
  const meeting = join(dir, "knowledge/meetings", (await (await import("node:fs/promises")).readdir(join(dir, "knowledge/meetings")))[0]!);
  await writeFile(meeting, (await readFile(meeting, "utf8")).replace(/^source: .*\n/m, ""));
  const run = await brain(["lint", "--brain", dir, "--json"]);
  assert.ok(run.json.data.issues.some((i: { rule: string; severity: string }) => i.rule === "unknown-lineage" && i.severity === "warning"));
});
