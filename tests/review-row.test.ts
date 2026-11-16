import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";
import { foldAsBefore } from "./review-row-fixture.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PATH = "projects/acme-website/project.md";
const CONCEPT = "con-1s6t8e2b";
const CONCEPT_PATH = "knowledge/references/row-level-security.md";
const QUESTION = "que-8n3v5x1d";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function attributes(dir: string, path: string): Promise<Record<string, any>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

async function lintErrors(dir: string): Promise<unknown[]> {
  const lint = await run(dir, ["lint"]);
  return lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

/** The frontmatter of the note or proposal with this id. */
async function byId(dir: string, id: string): Promise<Record<string, any>> {
  for (const path of await readdir(dir, { recursive: true })) {
    if (!path.endsWith(".md")) continue;
    const text = await readFile(join(dir, path), "utf8");
    if (!text.startsWith("---\n")) continue;
    const found = parseFrontmatter(text).attributes;
    if (found.id === id) return found;
  }
  throw new Error(`no file with id ${id}`);
}

const decided = (proposal: string, action: string, extra: Record<string, unknown> = {}) => ({ proposal, action, decided_at: "2026-12-10T08:00:00Z", decided_by: "notion", ...extra });

/** One ingest of the sync: a new decision, a link, a fact change and a text addition. */
async function ingestAll(dir: string) {
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in March", frontmatter: { summary: "The Acme launch moves to March.", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: "We launch in March.\n" }] });
  assert.equal(note.code, 0, note.stdout);
  const decision = note.json.data.created[0].id as string;
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [decision] },
    { kind: "add_to_note", title: "RLS in the auth plan", target: CONCEPT, content: "Carlos will use RLS for the auth migration.", why: "Carlos said so.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said in the sync.", source: SYNC },
    { kind: "update_fact", title: "Launch date: March", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved the launch to March.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  return { created: created.json.data.created as Array<{ id: string; kind: string; path: string }>, decision };
}

/** The same ingest as a row written before 0.16.0 holds it: the fact change folded first among its changes (0045). */
async function ingest(dir: string): Promise<{ row: Record<string, any>; decision: string }> {
  const { created, decision } = await ingestAll(dir);
  const row = created.find((entry) => entry.kind === "review_notes")!;
  await foldAsBefore(dir, row.id, created.find((entry) => entry.kind === "update_fact")!.id);
  return { row: { ...row, ...(await attributes(dir, row.path)) }, decision };
}

test("one ingest folds the addition, the link and the decision into one review_notes; a fact with a current value is its own proposal", async (context) => {
  const dir = await fixtureCopy(context);
  const { created, decision } = await ingestAll(dir);
  assert.deepEqual(created.map((entry) => entry.kind).sort(), ["review_notes", "update_fact"]);
  const entry = created.find((item) => item.kind === "review_notes")!;
  const row = await attributes(dir, entry.path);
  assert.equal(row.title, "From Acme sync: 1 change, 1 new note and 1 link");
  assert.deepEqual((entry as Record<string, unknown>).input_indexes, [0, 1, 2]);
  assert.deepEqual(row.notes, [decision]);
  assert.deepEqual(row.links, [{ target: CONCEPT, field: "projects", value: PROJECT }]);
  assert.deepEqual(row.changes, [{ kind: "add_to_note", target: CONCEPT, why: "Carlos said so.", content: "Carlos will use RLS for the auth migration." }]);
  const fact = await attributes(dir, created.find((item) => item.kind === "update_fact")!.path);
  assert.deepEqual([fact.target, fact.field, fact.before, fact.after, fact.source], [PROJECT, "launch_date", "2027-02", "2027-03", SYNC]);
  assert.deepEqual(await lintErrors(dir), []);

  const again = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Launch date: March", target: PROJECT, field: "launch_date", after: "2027-03", why: "Again.", source: SYNC }] });
  assert.deepEqual(again.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: fact.id }], "a change already pending is a duplicate");
  const listed = await run(dir, ["proposal", "list", "--target", CONCEPT]);
  assert.ok(listed.json.data.proposals.some((p: { id: string }) => p.id === entry.id), "--target matches a changes target");
});

test("a row written before 0.16.0: approve all except the fact applies the rest and defers the fact and the note to a new pending row", async (context) => {
  const dir = await fixtureCopy(context);
  const { row, decision } = await ingest(dir);
  const applied = await run(dir, ["apply"], { decisions: [decided(row.id, "approve", { note: "all except a and c", exclude: [{ change: 0 }, { note: decision }] })] });
  assert.equal(applied.code, 0, applied.stdout);
  const [item] = applied.json.data.decisions;
  assert.equal(item.result, "applied");
  assert.deepEqual(item.changes, [
    { index: 0, kind: "update_fact", target: PROJECT, result: "deferred" },
    { index: 1, kind: "add_to_note", target: CONCEPT, result: "applied" },
  ]);
  assert.deepEqual(item.notes, [{ id: decision, result: "kept_draft", lifecycle: "draft" }]);
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-02", "the deferred fact is not applied");
  assert.ok((await attributes(dir, CONCEPT_PATH)).projects.includes(PROJECT), "the link is applied");
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS for the auth migration\.\nSource: mtg-8c4n2p7w\n/);

  const later = await byId(dir, item.deferred);
  assert.equal(later.status, "pending");
  assert.equal(later.deferred_from, row.id);
  assert.equal(later.source, SYNC);
  assert.match(later.title, /^Deferred from Acme sync: 1 change and 1 new note$/);
  assert.deepEqual(later.notes, [decision]);
  assert.deepEqual(later.changes, [row.changes[0]]);
  assert.deepEqual(await lintErrors(dir), []);

  const second = await run(dir, ["apply"], { decisions: [decided(item.deferred, "approve")] });
  assert.equal(second.json.data.decisions[0].result, "applied", second.stdout);
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-03");
  assert.deepEqual(await lintErrors(dir), []);
});

test("a Fix with a corrected value applies the corrected value; the file keeps what was proposed", async (context) => {
  const dir = await fixtureCopy(context);
  const { row, decision } = await ingest(dir);
  const fixed = await run(dir, ["apply"], { decisions: [decided(row.id, "fix", { note: "a) it's April, not March", fixes: [{ change: 0, value: "2027-04" }, { note: decision, field: "title", value: "Launch in April" }] })] });
  assert.equal(fixed.code, 0, fixed.stdout);
  assert.equal(fixed.json.data.decisions[0].result, "applied");
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-04");
  const proposal = await attributes(dir, row.path);
  assert.equal(proposal.status, "applied");
  assert.equal(proposal.decision.action, "fix");
  assert.equal(proposal.changes[0].after, "2027-03", "the proposal keeps what was proposed");
  const note = await byId(dir, decision);
  assert.equal(note.title, "Launch in April");
  assert.equal(note.lifecycle, "reviewed");
  assert.deepEqual(await lintErrors(dir), []);
});

test("Fix refuses an entry that names no item, a wrong shape, and an item both fixed and excluded", async (context) => {
  const dir = await fixtureCopy(context);
  const { row } = await ingest(dir);
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ fixes: [{ change: 5, value: "x" }] }, "FIX_UNKNOWN"],
    [{ fixes: [{ value: "x" }] }, "FIX_UNKNOWN"],
    [{ fixes: [{ change: 0, value: { at: "2027-04" } }] }, "INVALID_RESULT"],
    [{ fixes: [{ change: 0, value: "2027-04" }], exclude: [{ change: 0 }] }, "INPUT_INVALID"],
  ];
  for (const [extra, reason] of cases) {
    const refused = await run(dir, ["apply"], { decisions: [decided(row.id, "fix", { note: "x", ...extra })] });
    assert.equal(refused.json.data.decisions[0].reason, reason, JSON.stringify(extra));
  }
  assert.equal((await attributes(dir, row.path)).status, "pending");
});

test("a fact changed before apply is dropped as stale; the rest of the row is applied", async (context) => {
  const dir = await fixtureCopy(context);
  const { row, decision } = await ingest(dir);
  const path = join(dir, PROJECT_PATH);
  await writeFile(path, (await readFile(path, "utf8")).replace("  launch_date: 2027-02\n", "  launch_date: 2027-05\n").replace("    value: 2027-02\n", "    value: 2027-05\n"));
  const applied = await run(dir, ["apply"], { decisions: [decided(row.id, "approve")] });
  const [item] = applied.json.data.decisions;
  assert.equal(item.result, "applied", applied.stdout);
  assert.deepEqual(item.changes.map((change: { result: string }) => change.result), ["dropped", "applied"]);
  assert.equal(item.changes[0].reason, "STALE_PROPOSAL");
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-05");
  const proposal = await attributes(dir, row.path);
  assert.deepEqual(proposal.dropped, [{ change: 0, reason: "stale" }]);
  assert.equal((await byId(dir, decision)).lifecycle, "reviewed");
  assert.deepEqual(await lintErrors(dir), []);
});

test("the transition reads Your call and What to fix of a row written before 0.16.0: an Approve alone is a decision, any text is for the skill", async (context) => {
  const dir = await fixtureCopy(context);
  const { row } = await ingest(dir);
  const page = "b4000000-0000-4000-8000-000000000001";
  const plan = async (properties: Record<string, unknown>) => (await run(dir, ["sync", "plan", "--review-transition"], { as_of: NOW, rows: [{ database: "review", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": row.id, State: "Pending", ...properties } }] })).json.data;
  const codes = (data: { conflicts: Array<{ code: string; property: string; notion_value?: string }> }) => data.conflicts.map((item) => [item.code, item.property, item.notion_value]);
  assert.deepEqual((await plan({ "Your call": "Approve", "What to fix": "" })).decisions, [{ proposal: row.id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "notion" }]);
  assert.deepEqual(codes(await plan({ "Your call": "Approve", "What to fix": "all except a" })), [["NOTE_TO_READ", "What to fix", "all except a"]]);
  assert.deepEqual(codes(await plan({ "Your call": "Fix", "What to fix": "a: April" })), [["FIX_TO_READ", "What to fix", "a: April"]]);
  assert.deepEqual(codes(await plan({ "Your call": "Fix", "What to fix": null })), [["FIX_WITHOUT_TEXT", "What to fix", undefined]]);
  assert.deepEqual((await plan({ "Your call": null })).decisions, [], "no call yet");
});
