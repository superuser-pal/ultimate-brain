import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-82: the selected-capture flow end to end on a synthetic brain (decision 0055). Synthetic inputs only.

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const PAGE = "7a7b0000-0000-4000-8000-0000000000aa";
const REVIEW_PAGE = "7a7b0000-0000-4000-8000-0000000000bb";
const PROJECT = "prj-9x4t1b7e";
const SECRET = "holiday plans in Lisbon";

const TRANSCRIPT = [
  "Alice opened the meeting and welcomed everyone.",
  "We agreed the launch moves to March because the vendor slipped.",
  "Maria said she will send the revised plan by Friday.",
  `Alice mentioned her ${SECRET} next month.`,
  "I will book the venue for the launch event this week.",
].join("\n\n");

const summary = (maria: string) => `## Highlights
[s0.i1] Launch moves to March. "launch moves to March"

## My actions
[s0.i2] Book the venue for the launch event. "book the venue for the launch event"

## [s1] Launch
Selection: Use in brain
### Decisions
[s1.i1] Launch moves to March because the vendor slipped. "agreed the launch moves to March"
### Other commitments
[s1.i2] ${maria}Maria will send the revised plan by Friday. "she will send the revised plan by Friday"

## [s2] Small talk
Selection: Meeting only
[s2.i1] Alice's holiday plans. "${SECRET}"
`;

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}
async function file(dir: string, name: string, content: string) { const path = join(dir, "..", name); await writeFile(path, content); return path; }
async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  if ((args[0] === "sync" && args[1] === "apply") || (args[0] === "source" && args[1] === "extract")) settle(dir);
  const extra: string[] = [];
  if (input !== undefined) extra.push("--input", await file(dir, `in-${Math.random().toString(36).slice(2)}.json`, JSON.stringify(input)));
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}
async function everyText(dir: string): Promise<string> {
  let all = "";
  for (const path of await readdir(dir, { recursive: true })) {
    if (path.startsWith(".git/") || path.startsWith(".agents/") || path.startsWith(".claude/")) continue;
    try { all += await readFile(join(dir, path), "utf8"); } catch { /* a folder */ }
  }
  return all;
}

test("mixed-subject meeting → extract → Tasks → exclusion after ingestion → cleanup row → reconcile, with no excluded passage in the active brain", async (context) => {
  const dir = await fixtureCopy(context);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.tasks.properties.owner = "Owner";
  await writeFile(join(dir, "brain.json"), JSON.stringify(config, null, 2));
  const transcript = await file(dir, "transcript.txt", TRANSCRIPT);
  const first = await file(dir, "summary1.md", summary(""));

  // 1. Untouched defaults, confirmed: only the selected paragraphs enter, and a preview can show them in full.
  const plan = await run(dir, ["source", "extract-plan", "--page", PAGE, "--summary", first, "--transcript", transcript]);
  assert.equal(plan.json.data.ok, true, plan.stdout);
  assert.deepEqual(plan.json.data.copied.map((entry: { n: number }) => entry.n), [2, 3, 5]);
  assert.equal(plan.json.data.uncovered, 1, "the opening paragraph is covered by no item and is listed, not copied");
  assert.ok(!JSON.stringify(plan.json.data).includes("Lisbon"), "the excluded subject's paragraph is nowhere in the plan");

  const written = await run(dir, ["source", "extract", "--page", PAGE, "--title", "Launch sync", "--date", "2026-12-10", "--summary", first, "--transcript", transcript]);
  assert.equal(written.code, 0, written.stdout);
  const extract = written.json.data.created[0] as string;
  assert.match(git(dir, "log", "-1", "--format=%B"), /Op: op-/);
  assert.equal(git(dir, "status", "--porcelain").trim(), "");
  assert.ok(!(await everyText(dir)).includes("Lisbon"), "no excluded passage is stored in the brain");

  // 2. The same selection read again writes nothing.
  const again = await run(dir, ["source", "extract", "--page", PAGE, "--title", "Launch sync", "--date", "2026-12-10", "--summary", first, "--transcript", transcript, "--previous", extract]);
  assert.equal(again.json.data.result, "UNCHANGED", again.stdout);
  assert.equal(git(dir, "log", "--oneline").trim().split("\n").length, 2, "a no-op rerun commits nothing");

  // 3. Tasks: the owner's commitment, and someone else's only with Waiting On; an excluded item creates none.
  const owner = { title: "Book the venue", item: "s0.i2", projects: [PROJECT] };
  const waiting = { title: "Maria sends the revised plan", item: "s1.i2", status: "waiting_on", owner: "Maria", projects: [PROJECT] };
  const tasks = await run(dir, ["sync", "tasks", "--source", extract], { items: [owner, waiting] });
  assert.equal(tasks.code, 0, tasks.stdout);
  assert.deepEqual(tasks.json.data.items.map((item: { item: string }) => item.item), ["s0.i2", "s1.i2"]);
  assert.equal(tasks.json.data.items[1].properties.Status.value, "Waiting On");
  const excluded = await run(dir, ["sync", "tasks", "--source", extract], { items: [{ title: "Plan the holiday", item: "s2.i1" }] });
  assert.equal(excluded.json.error.code, "INPUT_INVALID", "an excluded item creates no Task");
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: extract, synced_at: NOW, tasks: ["7a7b0000-0000-4000-8000-0000000000c1", "7a7b0000-0000-4000-8000-0000000000c2"], task_items: { "s0.i2": "7a7b0000-0000-4000-8000-0000000000c1", "s1.i2": "7a7b0000-0000-4000-8000-0000000000c2" } }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);

  // 4. Knowledge written from the extract cites its paragraphs: one claim on paragraph 2 (stays) and one on paragraph 3 (Maria's commitment).
  const passages = parseFrontmatter(await readFile(join(dir, written.json.data.path), "utf8")).attributes.passages as Array<{ n: number; hash: string }>;
  const ref = (n: number) => `^[${extract}#¶${n}:${passages.find((entry) => entry.n === n)!.hash}]`;
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch moves to March", frontmatter: { summary: "s", date: "2026-12-10", assessment: "accepted", projects: [PROJECT], sources: [extract] }, body: `The launch moves to March. ${ref(2)}\n\nMaria sends the revised plan by Friday. ${ref(3)}\n` }] });
  assert.equal(note.code, 0, note.stdout);
  const decision = note.json.data.created[0] as { id: string; path: string };

  // 5. The user edits a token afterwards (Maria's item is now Meeting only) and sets Reviewed again: a new version, restriction at once.
  const second = await file(dir, "summary2.md", summary("Meeting only: "));
  const replan = await run(dir, ["source", "extract-plan", "--page", PAGE, "--summary", second, "--transcript", transcript, "--previous", extract]);
  assert.equal(replan.json.data.write_required, true);
  assert.deepEqual(replan.json.data.previous.suppressed, [3]);
  settle(dir);
  const v2 = await run(dir, ["source", "extract", "--page", PAGE, "--title", "Launch sync", "--date", "2026-12-10", "--summary", second, "--transcript", transcript, "--previous", extract], undefined, AFTER);
  assert.equal(v2.code, 0, v2.stdout);
  const answer = await run(dir, ["query", "--candidates", "revised plan"]);
  assert.ok(!JSON.stringify(answer.json.data).includes("revised plan by Friday"), "the restricted claim is not returned");
  const kept = await run(dir, ["query", "--candidates", "launch moves to March"]);
  assert.ok(JSON.stringify(kept.json.data).includes(decision.id), "the independent claim on paragraph 2 is still returned");

  // 6. The cleanup row lists the claim, what stays, and the Task made from excluded content (never cancelled by the brain).
  const proposed = await run(dir, ["source", "cleanup-propose", "--page", PAGE], undefined, AFTER);
  assert.equal(proposed.json.data.result, "WRITTEN", proposed.stdout);
  const rowId = proposed.json.data.proposal as string;
  const rowFile = join(dir, proposed.json.data.path);
  const row = parseFrontmatter(await readFile(rowFile, "utf8")).attributes as Record<string, any>;
  assert.deepEqual(row.cleanup.tasks.map((task: { item: string; reason: string }) => [task.item, task.reason]), [["s1.i2", "item no longer selected"]]);
  const [item] = (await run(dir, ["sync", "render", "--ids", rowId], undefined, AFTER)).json.data.items;
  assert.ok(String(item.body).includes("Maria sends the revised plan") && String(item.body).includes("The launch moves to March"), "the page shows what goes and what stays");
  const itemId = [...String(item.body).matchAll(/^## \[[a-z]+ · (it-[0-9a-z]{8})\]/gm)][0]![1]!;
  await run(dir, ["sync", "record"], { records: [{ id: rowId, notion: REVIEW_PAGE, synced_at: AFTER, published: item.published }] }, AFTER);

  // 7. Accept the Remove: the restricted line goes, the independent claim stays, the record is reconciled; a rerun does nothing.
  const accepted = String(item.body).replace(new RegExp(`(## \\[[a-z]+ · ${itemId}\\][\\s\\S]*?\\nDecision: )Pending`), "$1Accept");
  const planned = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [{ database: "review", page_id: REVIEW_PAGE, last_edited: AFTER, properties: { "Brain ID": rowId, State: "Pending" }, review: { decided: true, decided_at: AFTER, accept_all: false, page_edited_at: AFTER, body_markdown: accepted } }] }, AFTER)).json.data;
  for (const entry of planned.review_decisions) for (const decided of entry.items) decided.verified = { snapshot_hash: decided.snapshot_hash, proposed_hash: decided.proposed_hash };
  const applied = await run(dir, ["sync", "apply"], planned, AFTER);
  assert.deepEqual(applied.json.data.review_results.map((entry: { result: string }) => entry.result), ["applied"], applied.stdout);
  const body = await readFile(join(dir, decision.path), "utf8");
  assert.ok(body.includes("The launch moves to March.") && !body.includes("revised plan"));
  assert.equal(JSON.parse(await readFile(join(dir, "_suppressions", `${PAGE}.json`), "utf8")).records[0].status, "reconciled");
  const rerun = await run(dir, ["sync", "apply"], planned, AFTER);
  assert.deepEqual(rerun.json.data.review_results.map((entry: { result: string }) => entry.result), ["skipped"], "applying the same plan again is refused or a no-op");
  assert.equal((await run(dir, ["source", "cleanup-propose", "--page", PAGE], undefined, AFTER)).json.data.result, "NOTHING_TO_CLEAN");
  assert.equal(git(dir, "status", "--porcelain").trim(), "");
  const lint = await run(dir, ["lint"]);
  assert.deepEqual(lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error"), []);
});

test("a Task needs the item that authorized it, and an included item whose paragraph was not copied creates none", async (context) => {
  const dir = await fixtureCopy(context);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.tasks.properties.owner = "Owner";
  await writeFile(join(dir, "brain.json"), JSON.stringify(config, null, 2));
  const transcript = await file(dir, "t.txt", TRANSCRIPT);
  // s1.i1 is included but depends on s2.i1, which is Meeting only: its paragraph is not copied.
  const text = `## [s1] Launch
Selection: Use in brain
[s1.i1] Book the venue. "book the venue for the launch event" (depends on [s2.i1])
[s1.i2] Maria will send the plan. "she will send the revised plan by Friday"

## [s2] Small talk
Selection: Meeting only
[s2.i1] Holiday plans. "${SECRET}"
`;
  const summaryFile = await file(dir, "s.md", text);
  const plan = await run(dir, ["source", "extract-plan", "--page", PAGE, "--summary", summaryFile, "--transcript", transcript]);
  assert.equal(plan.json.data.ok, true, plan.stdout);
  assert.deepEqual(plan.json.data.copied.map((entry: { n: number }) => entry.n), [3], "only the independent item's paragraph is copied; the venue paragraph is not");
  const written = await run(dir, ["source", "extract", "--page", PAGE, "--title", "T", "--date", "2026-12-10", "--summary", summaryFile, "--transcript", transcript]);
  assert.equal(written.code, 0, written.stdout);
  const extract = written.json.data.created[0] as string;
  const refused = await run(dir, ["sync", "tasks", "--source", extract], { items: [{ title: "Book the venue", item: "s1.i1" }] });
  assert.equal(refused.json.error.code, "INPUT_INVALID", "included in name, but none of its paragraphs is in the extract");
  const unnamed = await run(dir, ["sync", "tasks", "--source", extract], { items: [{ title: "Book the venue" }] });
  assert.equal(unnamed.json.error.code, "INPUT_INVALID", "a Task from an extract names its item");
});
