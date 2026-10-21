import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const DECISION = "dec-7k2m9q4x";
const QUESTION = "que-8n3v5x1d";
const CONCEPT = "con-1s6t8e2b";
const PROJECT = "prj-9x4t1b7e";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function attributes(dir: string, path: string): Promise<Record<string, unknown>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

async function lintErrors(dir: string): Promise<unknown[]> {
  const lint = await run(dir, ["lint"]);
  return lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

const link = (target: string, field: string, after: string) => ({ kind: "add_link", title: `link ${after}`, target, field, after, why: "Said in the sync.", source: SYNC });

/** A review_notes row with 2 notes, a link and an alias, as one ingest writes it. */
const reviewInput = [
  { kind: "review_notes", source: SYNC, notes: [DECISION, QUESTION] },
  link(CONCEPT, "projects", PROJECT),
  link(DECISION, "aliases", "Supabase auth"),
];

test("review_notes folds the source's add_link items and titles the row", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: reviewInput });
  assert.equal(created.code, 0, created.stdout);
  assert.equal(created.json.data.created.length, 1, "the links are folded, not grouped into add_link proposals");
  const [row] = created.json.data.created;
  assert.equal(row.kind, "review_notes");
  assert.equal(row.title, "Accept 2 new notes from Acme sync, and 2 links");
  assert.deepEqual(row.input_indexes, [0, 1, 2]);
  const proposal = await attributes(dir, row.path);
  assert.deepEqual(proposal.notes, [DECISION, QUESTION]);
  assert.deepEqual(proposal.links, [
    { target: CONCEPT, field: "projects", value: PROJECT },
    { target: DECISION, field: "aliases", value: "Supabase auth" },
  ]);
  assert.equal(proposal.why, "New notes and links from Acme sync");
  assert.deepEqual(await lintErrors(dir), []);

  const again = await run(dir, ["proposal", "new"], { proposals: reviewInput });
  assert.equal(again.json.error.code, "INPUT_INVALID", "a note listed by another review_notes is refused");
  const linksOnly = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes: [] }, ...reviewInput.slice(1)] });
  assert.equal(linksOnly.code, 0, linksOnly.stdout);
  assert.deepEqual(linksOnly.json.data.created, []);
  assert.deepEqual(linksOnly.json.data.skipped.map((skip: { reason: string }) => skip.reason).sort(), ["DUPLICATE_PENDING", "DUPLICATE_PENDING", "NOTHING_TO_REVIEW"]);

  const listed = await run(dir, ["proposal", "list", "--target", CONCEPT]);
  assert.deepEqual(listed.json.data.proposals.map((p: { id: string }) => p.id), [row.id], "--target matches a links target");
});

test("review_notes and answer refuse what doesn't fit", async (context) => {
  const dir = await fixtureCopy(context);
  const cases: Array<[unknown, string]> = [
    [{ kind: "review_notes", source: SYNC, notes: ["src-7w3c9k5m"] }, "INPUT_INVALID"],
    [{ kind: "review_notes", source: SYNC, notes: [DECISION, DECISION] }, "INPUT_INVALID"],
    [{ kind: "review_notes", source: SYNC, notes: ["dec-00000000"] }, "INPUT_INVALID"],
    [{ kind: "review_notes", source: "mtg-00000000", notes: [DECISION] }, "UNKNOWN_ID"],
    [{ kind: "answer", title: "Answer", target: DECISION, answer: "Maria owns it.", why: "Said.", source: SYNC }, "INPUT_INVALID"],
    [{ kind: "answer", title: "Answer", target: QUESTION, answer: " ", why: "Said.", source: SYNC }, "INPUT_INVALID"],
    [{ kind: "answer", title: "Answer", target: QUESTION, answer: "Maria owns it.", answer_note: "dec-00000000", why: "Said.", source: SYNC }, "UNKNOWN_ID"],
  ];
  for (const [proposal, code] of cases) {
    const result = await run(dir, ["proposal", "new"], { proposals: [proposal] });
    assert.equal(result.json.error?.code, code, JSON.stringify(proposal));
  }
  const two = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes: [DECISION] }, { kind: "review_notes", source: SYNC, notes: [QUESTION] }] });
  assert.equal(two.json.error.code, "INPUT_INVALID", "one review_notes per source in one input");
});

test("proposal backlog writes one row per source over its draft notes, then nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const first = await run(dir, ["proposal", "backlog"]);
  assert.equal(first.code, 0, first.stdout);
  assert.equal(first.json.data.created.length, 2);
  const [kickoff, sync] = await Promise.all(first.json.data.created.map((row: { path: string }) => attributes(dir, row.path)));
  assert.equal(kickoff!.source, "mtg-5r2k8v3a");
  assert.deepEqual(kickoff!.notes, ["per-9t2c6m4a"]);
  assert.equal(kickoff!.title, "Accept 1 new note from Acme kickoff");
  assert.equal(kickoff!.why, "Notes from Acme kickoff waiting for your review");
  assert.equal(sync!.source, SYNC);
  assert.deepEqual([...(sync!.notes as string[])].sort(), [DECISION, SYNC, QUESTION].sort());
  assert.deepEqual(sync!.links, []);
  assert.deepEqual(await lintErrors(dir), []);
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.equal(log.split("\n").filter((line) => line.includes("proposal-new") && line.includes("kind=review_notes")).length, 2);

  const second = await run(dir, ["proposal", "backlog"]);
  assert.equal(second.code, 0, second.stdout);
  assert.deepEqual(second.json.data.created, []);
});

const decided = (proposal: string, action: string, extra: Record<string, unknown> = {}) => ({ proposal, action, decided_at: "2026-12-10T08:00:00Z", decided_by: "notion", ...extra });

async function reviewRow(dir: string, proposals: unknown[]): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["proposal", "new"], { proposals });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created.find((row: { kind: string }) => row.kind === "review_notes");
}

test("approving a 3-note row with one excluded leaves 2 reviewed and 1 draft", async (context) => {
  const dir = await fixtureCopy(context);
  const row = await reviewRow(dir, [{ kind: "review_notes", source: SYNC, notes: [SYNC, DECISION, QUESTION] }]);
  const applied = await run(dir, ["apply"], { decisions: [decided(row.id, "approve", { note: "all except c", exclude: [{ note: QUESTION }] })] });
  assert.equal(applied.code, 0, applied.stdout);
  const [item] = applied.json.data.decisions;
  assert.equal(item.result, "applied");
  assert.deepEqual(item.notes, [
    { id: SYNC, result: "reviewed", lifecycle: "reviewed" },
    { id: DECISION, result: "reviewed", lifecycle: "reviewed" },
    { id: QUESTION, result: "kept_draft", lifecycle: "draft" },
  ]);
  assert.equal((await attributes(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md")).lifecycle, "reviewed");
  assert.equal((await attributes(dir, "knowledge/questions/who-owns-the-acme-mobile-app.md")).lifecycle, "draft");
  assert.deepEqual(await lintErrors(dir), []);
});

test("rejecting archives the draft notes with no successor; a note no longer draft is unchanged", async (context) => {
  const dir = await fixtureCopy(context);
  const row = await reviewRow(dir, [{ kind: "review_notes", source: SYNC, notes: [DECISION, QUESTION, "per-3h8w2n6c"] }]);
  const rejected = await run(dir, ["apply"], { decisions: [decided(row.id, "reject")] });
  assert.equal(rejected.code, 0, rejected.stdout);
  const [item] = rejected.json.data.decisions;
  assert.equal(item.result, "closed");
  assert.deepEqual(item.notes.map((note: { result: string }) => note.result), ["archived", "archived", "unchanged"]);
  const decision = await attributes(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md");
  assert.equal(decision.lifecycle, "archived");
  assert.equal((decision.relations as unknown[] | undefined)?.some((relation) => (relation as { type: string }).type === "superseded_by") ?? false, false);
  assert.equal((await attributes(dir, "knowledge/people/maria-lopez.md")).lifecycle, "reviewed");
});

test("an edit on review_notes is refused; an exclude that isn't in the row is unknown", async (context) => {
  const dir = await fixtureCopy(context);
  const row = await reviewRow(dir, [{ kind: "review_notes", source: SYNC, notes: [DECISION] }]);
  const edit = await run(dir, ["apply"], { decisions: [decided(row.id, "edit", { value: "x", note: "x" })] });
  assert.equal(edit.json.data.decisions[0].reason, "EDIT_NOT_ALLOWED");
  const unknown = await run(dir, ["apply"], { decisions: [decided(row.id, "approve", { exclude: [{ note: QUESTION }] })] });
  assert.equal(unknown.json.data.decisions[0].reason, "EXCLUDE_UNKNOWN");
  const proposal = await attributes(dir, row.path);
  assert.equal(proposal.status, "pending", "a failed item leaves the proposal unchanged");
});

test("approving 2 notes, a link and an alias with the alias excluded applies the link and closes the alias", async (context) => {
  const dir = await fixtureCopy(context);
  const row = await reviewRow(dir, reviewInput);
  const applied = await run(dir, ["apply"], { decisions: [decided(row.id, "approve", { note: "all except d", exclude: [{ target: DECISION, field: "aliases", value: "Supabase auth" }] })] });
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.decisions[0].notes.map((note: { result: string }) => note.result), ["reviewed", "reviewed"]);
  assert.deepEqual((await attributes(dir, "knowledge/concepts/row-level-security.md")).projects, [PROJECT]);
  assert.equal((await attributes(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md")).aliases, undefined);
  assert.equal((await attributes(dir, row.path)).status, "applied");
  assert.deepEqual(await lintErrors(dir), []);
});

test("an approved answer sets the question's answer; an edit uses your Note; a second answer is skipped", async (context) => {
  const dir = await fixtureCopy(context);
  const answer = { kind: "answer", title: "Who owns the app: Maria", target: QUESTION, answer: "Maria owns the mobile app.", answer_note: DECISION, why: "Maria said she owns it.", source: SYNC };
  const created = await run(dir, ["proposal", "new"], { proposals: [answer] });
  assert.equal(created.code, 0, created.stdout);
  const duplicate = await run(dir, ["proposal", "new"], { proposals: [answer] });
  assert.equal(duplicate.json.data.skipped[0].reason, "DUPLICATE_PENDING");
  const applied = await run(dir, ["apply"], { decisions: [decided(created.json.data.created[0].id, "approve")] });
  assert.equal(applied.json.data.decisions[0].result, "applied", applied.stdout);
  const questionPath = "knowledge/questions/who-owns-the-acme-mobile-app.md";
  assert.equal((await attributes(dir, questionPath)).answer, DECISION);
  const again = await run(dir, ["proposal", "new"], { proposals: [{ ...answer, answer: "Carlos does." }] });
  assert.equal(again.json.data.skipped[0].reason, "ALREADY_ANSWERED");

  const edited = await fixtureCopy(context);
  const second = await run(edited, ["proposal", "new"], { proposals: [answer] });
  const edit = await run(edited, ["apply"], { decisions: [decided(second.json.data.created[0].id, "edit", { value: "Carlos owns it now.", note: "Carlos owns it now." })] });
  assert.equal(edit.json.data.decisions[0].result, "applied", edit.stdout);
  assert.equal((await attributes(edited, questionPath)).answer, "Carlos owns it now.");
  assert.deepEqual(await lintErrors(edited), []);
});

async function rendered(dir: string, ids: string[]): Promise<Array<Record<string, any>>> {
  const result = await run(dir, ["sync", "render", "--ids", ids.join(",")]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data.items;
}

async function record(dir: string, item: Record<string, any>, notion = item.page_id ?? "e1000000-0000-4000-8000-000000000001"): Promise<void> {
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: item.id, notion, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
}

test("render: a Review notes row letters its notes, then its links, with titles for ids", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: reviewInput });
  const [item] = await rendered(dir, [created.json.data.created[0].id]);
  assert.equal(item!.properties.Kind.value, "Review Notes");
  assert.equal(item!.properties.Target.value, `Acme sync (${SYNC})`);
  assert.deepEqual(item!.properties.Before, { type: "rich_text", value: null });
  assert.equal(item!.properties.After.value, "a) Decision: Use Supabase for auth\nb) Question: Who owns the Acme mobile app?\nc) Projects on Row-level security: Acme website\nd) Aliases on Use Supabase for auth: Supabase auth");
});

test("render: an answer row shows answer → note; once applied, the question's Status goes out as Answered once", async (context) => {
  const dir = await fixtureCopy(context);
  const answer = { kind: "answer", title: "Who owns the app: Maria", target: QUESTION, answer: "Maria owns the mobile app.", answer_note: DECISION, why: "Maria said she owns it.", source: SYNC };
  const created = await run(dir, ["proposal", "new"], { proposals: [answer] });
  const [row] = await rendered(dir, [created.json.data.created[0].id]);
  assert.deepEqual(row!.properties.Before, { type: "rich_text", value: null });
  assert.equal(row!.properties.After.value, "Maria owns the mobile app. → Use Supabase for auth");

  const [before] = await rendered(dir, [QUESTION]);
  assert.equal(before?.properties.Status, undefined, "a question with no answer never has Status");
  await run(dir, ["apply"], { decisions: [decided(created.json.data.created[0].id, "approve")] });
  const [question] = await rendered(dir, [QUESTION]);
  assert.deepEqual(question!.properties.Status, { type: "select", value: "Answered" });
  await record(dir, question!);
  const [after] = await rendered(dir, [QUESTION]);
  assert.equal(after?.properties.Status, undefined, "Status goes out once");
  assert.deepEqual(await lintErrors(dir), []);
});

test("render: a Review row links its page and its source meeting", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: reviewInput });
  const [item] = await rendered(dir, [created.json.data.created[0].id]);
  assert.deepEqual(item!.properties["Target Page"], { type: "url", value: "https://www.notion.so/3c4d5e6f7a8b4c0d9e2f3a4b5c6d7e8f" });
  assert.deepEqual(item!.properties["Source Meeting"], { type: "relation", value: ["3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f"] });
});

test("render: a Review row whose meeting has no Notion page lists it as pending", async (context) => {
  const dir = await fixtureCopy(context);
  const meetingPath = join(dir, "knowledge/meetings/2026-12-03-acme-sync.md");
  await writeFile(meetingPath, (await readFile(meetingPath, "utf8")).replace(/^notion: .*\n/m, ""));
  const created = await run(dir, ["proposal", "new"], { proposals: reviewInput });
  const [item] = await rendered(dir, [created.json.data.created[0].id]);
  assert.deepEqual(item!.pending_relations.find((relation: { property: string }) => relation.property === "Source Meeting"), { property: "Source Meeting", ids: [SYNC] });
  assert.deepEqual(item!.published["Source Meeting"], [], "as for other relations, only published pages are recorded as sent");
});
