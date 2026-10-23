import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PATH = "projects/acme-website/project.md";
const CONCEPT = "con-1s6t8e2b";
const CONCEPT_PATH = "knowledge/concepts/row-level-security.md";
const QUESTION = "que-8n3v5x1d";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
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
async function ingest(dir: string): Promise<{ row: Record<string, any>; decision: string }> {
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
  assert.equal(created.json.data.created.length, 1, "everything folds into one row");
  const [row] = created.json.data.created;
  return { row: { ...row, ...(await attributes(dir, row.path)) }, decision };
}

test("one ingest with a decision, a link, a fact and a text change writes one review_notes, fact first", async (context) => {
  const dir = await fixtureCopy(context);
  const { row, decision } = await ingest(dir);
  assert.equal(row.title, "From Acme sync: 2 changes, 1 new note and 1 link");
  assert.deepEqual(row.input_indexes, [0, 1, 2, 3]);
  assert.deepEqual(row.notes, [decision]);
  assert.deepEqual(row.links, [{ target: CONCEPT, field: "projects", value: PROJECT }]);
  assert.deepEqual(row.changes, [
    { kind: "update_fact", target: PROJECT, why: "Maria moved the launch to March.", field: "launch_date", before: "2027-02", after: "2027-03", from: "2026-12-03" },
    { kind: "add_to_note", target: CONCEPT, why: "Carlos said so.", content: "Carlos will use RLS for the auth migration." },
  ]);
  assert.deepEqual(await lintErrors(dir), []);

  const again = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Launch date: March", target: PROJECT, field: "launch_date", after: "2027-03", why: "Again.", source: SYNC }] });
  assert.deepEqual(again.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: row.id }], "a change already in a pending row is a duplicate");
  const listed = await run(dir, ["proposal", "list", "--target", PROJECT]);
  assert.ok(listed.json.data.proposals.some((p: { id: string }) => p.id === row.id), "--target matches a changes target");
});

test("approve all except the fact applies the rest and defers the fact and the note to a new pending row", async (context) => {
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

test("render: a Review notes row letters its changes first, then notes, then links, under About/Now/Proposed", async (context) => {
  const dir = await fixtureCopy(context);
  const { row } = await ingest(dir);
  const [item] = (await run(dir, ["sync", "render", "--ids", row.id])).json.data.items;
  assert.deepEqual(item.properties.About, { type: "rich_text", value: `Acme sync (${SYNC})` });
  assert.deepEqual(item.properties.Now, { type: "rich_text", value: null });
  assert.equal(item.properties.Proposed.value, [
    "a) ⚠ Launch date on Acme website: 2027-02 → 2027-03",
    "b) Add to Row-level security: Carlos will use RLS for the auth migration.",
    "c) Decision: Launch in March",
    "d) Projects on Row-level security: Acme website",
  ].join("\n"));
  for (const old of ["Target", "Target Page", "Before", "After"]) assert.equal(item.properties[old], undefined, old);
});

test("sync plan reads Your call and What to fix: an Approve alone is a decision, any text is for the skill", async (context) => {
  const dir = await fixtureCopy(context);
  const { row } = await ingest(dir);
  const page = "b4000000-0000-4000-8000-000000000001";
  const plan = async (properties: Record<string, unknown>) => (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "review", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": row.id, State: "Pending", ...properties } }] })).json.data;
  const codes = (data: { conflicts: Array<{ code: string; property: string; notion_value?: string }> }) => data.conflicts.map((item) => [item.code, item.property, item.notion_value]);
  assert.deepEqual((await plan({ "Your call": "Approve", "What to fix": "" })).decisions, [{ proposal: row.id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "notion" }]);
  assert.deepEqual(codes(await plan({ "Your call": "Approve", "What to fix": "all except a" })), [["NOTE_TO_READ", "What to fix", "all except a"]]);
  assert.deepEqual(codes(await plan({ "Your call": "Fix", "What to fix": "a: April" })), [["FIX_TO_READ", "What to fix", "a: April"]]);
  assert.deepEqual(codes(await plan({ "Your call": "Fix", "What to fix": null })), [["FIX_WITHOUT_TEXT", "What to fix", undefined]]);
  assert.deepEqual((await plan({ "Your call": null })).decisions, [], "no call yet");
});
