// CC-296: proposals are decided in the session (decisions 0096 and 0098 §1–§3; capture-and-review §7, cli §5.6, §5.7, §5.14.8).
import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SAID = "2026-12-10T08:30:00Z";
const SYNC = "mtg-8c4n2p7w";
const KICKOFF = "mtg-5r2k8v3a";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PATH = "projects/acme-website/project.md";
const CONCEPT = "con-1s6t8e2b";
const CONCEPT_PATH = "knowledge/references/row-level-security.md";
const QUESTION = "que-8n3v5x1d";
const DECISION = "dec-7k2m9q4x";
/** The fixture's own pending proposal: an add_to_note of its own (group 4). */
const FIXTURE_PENDING = "prp-9d3f7h2k";

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

async function attributes(dir: string, path: string): Promise<Record<string, any>> {
  return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;
}

async function byId(dir: string, id: string): Promise<Record<string, any>> {
  for (const path of await readdir(dir, { recursive: true })) {
    if (!path.endsWith(".md")) continue;
    const text = await readFile(join(dir, path), "utf8");
    if (!text.startsWith("---\n")) continue;
    const found = parseFrontmatter(text).attributes;
    if (found.id === id) return { ...found, path };
  }
  throw new Error(`no file with id ${id}`);
}

async function lintErrors(dir: string): Promise<unknown[]> {
  return (await run(dir, ["lint"])).json.data.issues.filter((issue: { severity: string }) => issue.severity === "error");
}

/** A draft decision from the sync, as an ingest writes it. */
async function draft(dir: string, title: string): Promise<string> {
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title, frontmatter: { summary: `${title}.`, date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: `${title}.\n` }] });
  assert.equal(note.code, 0, note.stdout);
  return note.json.data.created[0].id as string;
}

/** The answer given in the session (capture-and-review §7.6): `decided_by: chat`, the user's words in `note`. */
const said = (proposal: string, action: string, extra: Record<string, unknown> = {}) => ({ proposal, action, decided_at: SAID, decided_by: "chat", note: "yes", ...extra });

const ADDITION = { kind: "add_to_note", title: "RLS in the auth plan", target: CONCEPT, content: "Carlos will use RLS for the auth migration.", why: "Carlos said so.", source: SYNC };
const LINK = { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said in the sync.", source: SYNC };
const CONFLICT = { kind: "update_fact", title: "Launch date: March", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved the launch to March.", source: SYNC };

/** One ingest of the sync: a new decision, an addition, a link, and a fact that conflicts with what the brain holds. */
async function ingest(dir: string) {
  const decision = await draft(dir, "Launch in March");
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes: [decision] }, ADDITION, LINK, CONFLICT] });
  assert.equal(created.code, 0, created.stdout);
  const entries = created.json.data.created as Array<{ id: string; kind: string; path: string }>;
  return { decision, row: entries.find((entry) => entry.kind === "review_notes")!, fact: entries.find((entry) => entry.kind === "update_fact")!, entries };
}

async function waiting(dir: string) {
  const out = await run(dir, ["proposal", "list", "--waiting"]);
  assert.equal(out.code, 0, out.stdout);
  return out.json.data as { waiting: Array<Record<string, any>>; held: Array<Record<string, any>>; counts: { waiting: number; held: number } };
}

test("an attended ingest with one conflicting fact takes in the rest as reviewed and leaves one proposal (0096 §2)", async (context) => {
  const dir = await fixtureCopy(context);
  const { decision, row, fact, entries } = await ingest(dir);
  assert.deepEqual(entries.map((entry) => entry.kind).sort(), ["review_notes", "update_fact"], "the conflict is a question of its own; the rest is the part");

  const applied = await run(dir, ["apply"], { decisions: [said(row.id, "approve", { note: "yes to the sync" })] });
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(applied.json.data.decisions[0].result, "applied");
  assert.equal((await byId(dir, decision)).lifecycle, "reviewed", "the part's note is taken in as reviewed");
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS for the auth migration\./);
  assert.ok((await attributes(dir, CONCEPT_PATH)).projects.includes(PROJECT));
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-02", "the conflict is not applied");

  const left = await waiting(dir);
  assert.deepEqual(left.waiting.filter((entry) => entry.id !== FIXTURE_PENDING).map((entry) => [entry.id, entry.group]), [[fact.id, 1]], "one proposal is left: the conflict");
  assert.deepEqual(await lintErrors(dir), []);
});

test("an addition and a link go in directly with their passages and are listed (0096 §2, 0098)", async (context) => {
  const dir = await fixtureCopy(context);
  const { row } = await ingest(dir);
  const stored = await attributes(dir, row.path);
  const items = stored.items as Array<Record<string, any>>;
  assert.deepEqual(items.filter((item) => item.kind !== "note").map((item) => [item.kind, item.passages]), [["change", [SYNC]], ["link", [SYNC]]], "each keeps its passages on its item");
  assert.deepEqual(stored.changes.map((change: Record<string, unknown>) => change.kind), ["add_to_note"]);
  assert.deepEqual(stored.links, [{ target: CONCEPT, field: "projects", value: PROJECT }]);

  const applied = await run(dir, ["apply"], { decisions: [said(row.id, "approve")] });
  const [result] = applied.json.data.decisions;
  assert.equal(result.result, "applied", applied.stdout);
  assert.deepEqual(result.changes, [{ index: 0, kind: "add_to_note", target: CONCEPT, result: "applied" }], "the addition is listed as applied");
  assert.deepEqual([result.deferred, result.withheld], [undefined, undefined], "nothing of the part waits");
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS for the auth migration\.\nSource: mtg-8c4n2p7w\n/);
  assert.ok((await attributes(dir, CONCEPT_PATH)).projects.includes(PROJECT), "the link went in with the part's yes");
});

test("the same input unattended leaves drafts and queues the conflict, the addition and the link (0096 §4)", async (context) => {
  const dir = await fixtureCopy(context);
  const before = await readFile(join(dir, CONCEPT_PATH), "utf8");
  const { decision, row, fact } = await ingest(dir);
  assert.equal((await byId(dir, decision)).lifecycle, "draft");
  assert.equal(await readFile(join(dir, CONCEPT_PATH), "utf8"), before, "nothing is applied");
  const { waiting: queued } = await waiting(dir);
  const mine = queued.filter((entry) => entry.id !== FIXTURE_PENDING);
  assert.deepEqual(mine.map((entry) => [entry.id, entry.group]), [[fact.id, 1], [row.id, 3]]);
  const part = mine[1]!;
  assert.deepEqual(part.changes.map((change: Record<string, unknown>) => change.kind), ["add_to_note"], "the addition waits in the part");
  assert.deepEqual(part.links, [{ target: CONCEPT, field: "projects", value: PROJECT }], "and so does the link");
  assert.deepEqual(part.notes, [decision]);
  assert.deepEqual(await lintErrors(dir), []);
});

test("a mixed waiting list comes in 0096 §5's order: changes, then answers, then a source's parts together, then the rest", async (context) => {
  const dir = await fixtureCopy(context);
  const make = async (now: string, proposals: unknown[]) => {
    const out = await run(dir, ["proposal", "new"], { proposals }, now);
    assert.equal(out.code, 0, out.stdout);
    return out.json.data.created as Array<{ id: string; kind: string }>;
  };
  const [link] = await make("2026-12-01T09:00:00Z", [{ kind: "add_link", title: "tag", target: CONCEPT, field: "tags", after: "auth", why: "Said.", source: KICKOFF }]);
  const [syncPilot] = await make("2026-12-02T09:00:00Z", [{ kind: "review_notes", source: SYNC, subject: "Pilot rollout", notes: [] }, { ...ADDITION, subject: "Pilot rollout" }]);
  const [kickoff] = await make("2026-12-03T09:00:00Z", [{ kind: "review_notes", source: KICKOFF, notes: [] }, { ...ADDITION, content: "The kickoff named RLS.", source: KICKOFF }]);
  const [syncHiring] = await make("2026-12-04T09:00:00Z", [{ kind: "review_notes", source: SYNC, subject: "Hiring", notes: [] }, { ...ADDITION, content: "Hiring waits for the launch.", subject: "Hiring" }]);
  const [answer] = await make("2026-12-05T09:00:00Z", [{ kind: "answer", title: "Who owns the app: Maria", target: QUESTION, answer: "Maria owns the mobile app.", answer_note: DECISION, why: "Maria said so.", source: SYNC }]);
  const [fact] = await make("2026-12-06T09:00:00Z", [CONFLICT]);

  const out = await waiting(dir);
  assert.deepEqual(out.waiting.map((entry) => [entry.id, entry.group]), [
    [fact!.id, 1],
    [answer!.id, 2],
    [syncPilot!.id, 3], [syncHiring!.id, 3], [kickoff!.id, 3],
    [link!.id, 4], [FIXTURE_PENDING, 4],
  ], "the sync's two parts are listed together, in the place of its first");
  assert.deepEqual(out.counts, { waiting: 7, held: 0, in_weekly_row: 0 });
  // The skill asks them in rounds of at most five, a source's parts counting as one question (capture-and-review §7.5): here the first round
  // is the change, the answer, the sync, the kickoff and the link; "more" asks the fixture's own addition.
});

test("a decision given in chat is applied with its words recorded (capture-and-review §7.6)", async (context) => {
  const dir = await fixtureCopy(context);
  const { fact } = await ingest(dir);
  const words = "yes, the launch is in March now";
  const applied = await run(dir, ["apply"], { decisions: [said(fact.id, "approve", { note: words })] });
  assert.equal(applied.json.data.decisions[0].result, "applied", applied.stdout);
  const stored = await attributes(dir, fact.path);
  assert.equal(stored.status, "applied");
  assert.deepEqual(stored.decision, { action: "approve", note: words, decided_at: SAID, decided_by: "chat" });
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-03");
  assert.deepEqual(await lintErrors(dir), []);
});

test("sync writes no Review row; a plain plan ignores one (REVIEW_ROW), and the transition refuses once the database is gone (REVIEW_RETIRED)", async (context) => {
  const dir = await fixtureCopy(context);
  const { row, fact } = await ingest(dir);
  const rendered = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(rendered.code, 0, rendered.stdout);
  assert.deepEqual(rendered.json.data.items.filter((item: { database: string; id: string }) => item.database === "review" || item.id.startsWith("prp-")), [], "no proposal is rendered");
  const byIds = await run(dir, ["sync", "render", "--ids", `${row.id},${fact.id}`]);
  assert.deepEqual([byIds.json.data.items, byIds.json.data.errors], [[], []]);

  const reviewRow = { database: "review", page_id: "6a7b0000-0000-4000-8000-0000000000ab", last_edited: SAID, properties: { "Brain ID": fact.id, State: "Pending", "Your call": "Approve" } };
  const plan = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [reviewRow] });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.decisions, []);
  assert.deepEqual(plan.json.data.ignored.map((item: { reason: string; page_id: string }) => [item.page_id, item.reason]), [[reviewRow.page_id, "REVIEW_ROW"]]);

  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  delete config.notion.databases.review;
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const retired = await run(dir, ["sync", "plan", "--review-transition"], { as_of: NOW, rows: [reviewRow] });
  assert.equal(retired.code, 4, retired.stdout);
  assert.equal(retired.json.error.code, "REVIEW_RETIRED");
  const plain = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [reviewRow] });
  assert.equal(plain.code, 0, plain.stdout);
  assert.deepEqual(plain.json.data.ignored.map((item: { reason: string }) => item.reason), ["REVIEW_ROW"], "a plain plan still ignores it");
});

test("the transition applies a decided row once and leaves a pending one (cli §5.14.8)", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [CONFLICT, { kind: "add_link", title: "tag", target: CONCEPT, field: "tags", after: "auth", why: "Said.", source: KICKOFF }] });
  assert.equal(created.code, 0, created.stdout);
  const [fact, link] = created.json.data.created as Array<{ id: string; path: string }>;
  // Both were published by 0.15.x as Review rows.
  const pages = ["6a7b0000-0000-4000-8000-0000000000c1", "6a7b0000-0000-4000-8000-0000000000c2"];
  for (const [index, entry] of [fact!, link!].entries()) {
    const document = parseFrontmatter(await readFile(join(dir, entry.path), "utf8"));
    Object.assign(document.attributes, { notion: pages[index], notion_published: { "Brain ID": entry.id, Name: String(document.attributes.title) } });
    await writeFile(join(dir, entry.path), serializeFrontmatter(document));
  }
  const rows = [
    { database: "review", page_id: pages[0], last_edited: SAID, properties: { "Brain ID": fact!.id, State: "Pending", "Your call": "Approve", "What to fix": "" } },
    { database: "review", page_id: pages[1], last_edited: SAID, properties: { "Brain ID": link!.id, State: "Pending", "Your call": null, "What to fix": "" } },
  ];
  const plan = await run(dir, ["sync", "plan", "--review-transition"], { as_of: NOW, rows });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.decisions, [{ proposal: fact!.id, action: "approve", decided_at: SAID, decided_by: "notion" }]);
  const applied = await run(dir, ["sync", "apply"], plan.json.data);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.decisions.map((item: { proposal: string; result: string }) => [item.proposal, item.result]), [[fact!.id, "applied"]]);
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-03");
  assert.equal((await attributes(dir, link!.path)).status, "pending", "the row nobody decided stays pending, asked in the session");

  // Read again, the decided row is terminal: nothing is applied twice.
  const again = await run(dir, ["sync", "plan", "--review-transition"], { as_of: NOW, rows });
  assert.deepEqual(again.json.data.decisions, []);
  assert.ok(again.json.data.ignored.some((item: { brain_id: string; reason: string }) => item.brain_id === fact!.id && item.reason === "ALREADY_TERMINAL"), again.stdout);
  assert.deepEqual((await waiting(dir)).waiting.map((entry) => entry.id).filter((id) => id !== FIXTURE_PENDING), [link!.id]);
});

test("a source with two subjects decided part by part takes in only the parts said yes to; a question in one part holds nothing of the other (0098)", async (context) => {
  const dir = await fixtureCopy(context);
  const pilotNote = await draft(dir, "Pilot in two depots");
  const hiringNote = await draft(dir, "Hire a second designer");
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, subject: "Pilot rollout", notes: [pilotNote] },
    { kind: "review_notes", source: SYNC, subject: "Hiring", notes: [hiringNote] },
    { ...ADDITION, subject: "Pilot rollout" },
    { kind: "add_link", title: "tag", target: CONCEPT, field: "tags", after: "hiring", why: "Said.", source: SYNC, subject: "Hiring" },
    { ...CONFLICT, subject: "Pilot rollout" },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const entries = created.json.data.created as Array<{ id: string; kind: string; path: string; title: string }>;
  const parts = entries.filter((entry) => entry.kind === "review_notes");
  const pilot = parts.find((entry) => entry.title.includes("Pilot rollout"))!;
  const hiring = parts.find((entry) => entry.title.includes("Hiring"))!;
  const fact = entries.find((entry) => entry.kind === "update_fact")!;
  assert.equal(pilot.title, "From Acme sync, Pilot rollout: 1 change and 1 new note");
  assert.equal(hiring.title, "From Acme sync, Hiring: 1 new note and 1 link");
  assert.equal((await attributes(dir, fact.path)).subject, "Pilot rollout", "the question keeps its part's subject");

  // Yes to Hiring only: its note and link go in; nothing of the Pilot part does, and its question doesn't hold Hiring back.
  const applied = await run(dir, ["apply"], { decisions: [said(hiring.id, "approve", { note: "yes to hiring" })] });
  assert.equal(applied.json.data.decisions[0].result, "applied", applied.stdout);
  assert.equal((await byId(dir, hiringNote)).lifecycle, "reviewed");
  assert.ok((await attributes(dir, CONCEPT_PATH)).tags.includes("hiring"));
  assert.equal((await byId(dir, pilotNote)).lifecycle, "draft");
  assert.doesNotMatch(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS/);
  const queued = (await waiting(dir)).waiting.filter((entry) => entry.id !== FIXTURE_PENDING);
  assert.deepEqual(queued.map((entry) => [entry.id, entry.group, entry.subject]), [[fact.id, 1, "Pilot rollout"], [pilot.id, 3, "Pilot rollout"]]);

  // Yes to the Pilot part while its question is still open: the part goes in, the question stays as it was.
  const second = await run(dir, ["apply"], { decisions: [said(pilot.id, "approve")] });
  assert.equal(second.json.data.decisions[0].result, "applied", second.stdout);
  assert.equal((await byId(dir, pilotNote)).lifecycle, "reviewed");
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS for the auth migration\./);
  assert.equal((await attributes(dir, fact.path)).status, "pending");
  assert.equal((await attributes(dir, PROJECT_PATH)).facts.launch_date, "2027-02");

  // A foldable item of a source with parts but none with its subject is refused, so it never becomes a question by mistake.
  const stray = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: KICKOFF, subject: "Pilot rollout", notes: [] }, { ...ADDITION, source: KICKOFF, subject: "Budget" }] });
  assert.equal(stray.json.error?.code, "INPUT_INVALID", stray.stdout);
  assert.ok(stray.json.error.details.some((problem: { pointer: string }) => problem.pointer === "/proposals/1/subject"), stray.stdout);
  assert.deepEqual(await lintErrors(dir), []);
});

test("one approve with reject and exclude archives the turned-down note and defers only the later one, with its subject (0098)", async (context) => {
  const dir = await fixtureCopy(context);
  const [no, later, yes] = [await draft(dir, "Drop the blog"), await draft(dir, "Move hosting"), await draft(dir, "Keep the CMS")];
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, subject: "Website", notes: [no, later, yes] }, { ...ADDITION, subject: "Website" }] });
  assert.equal(created.code, 0, created.stdout);
  const row = created.json.data.created[0] as { id: string; path: string };
  const applied = await run(dir, ["apply"], { decisions: [said(row.id, "approve", { note: "not the blog one; hosting later", reject: [{ note: no }], exclude: [{ note: later }] })] });
  const [result] = applied.json.data.decisions;
  assert.equal(result.result, "applied", applied.stdout);
  assert.equal((await byId(dir, no)).lifecycle, "archived", "turned down at once");
  assert.equal((await byId(dir, yes)).lifecycle, "reviewed");
  assert.equal((await byId(dir, later)).lifecycle, "draft");
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS for the auth migration\./);

  const deferred = await byId(dir, result.deferred);
  assert.equal(deferred.status, "pending");
  assert.deepEqual(deferred.notes, [later], "only the later one is deferred");
  assert.equal(deferred.subject, "Website", "the deferred proposal keeps its subject");
  assert.deepEqual(deferred.changes ?? [], []);
  const stored = await attributes(dir, row.path);
  const noItem = (stored.items as Array<{ item_id: string; kind: string; ref: string }>).find((item) => item.kind === "note" && item.ref === no)!;
  assert.deepEqual(stored.item_decisions, [{ item_id: noItem.item_id, decision: "reject", decided_at: SAID, decided_by: "chat" }]);
  assert.deepEqual(await lintErrors(dir), []);
});

test("reject on part of a grouped link item fails INPUT_INVALID; naming all of it turns it down whole (schema §11.3)", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [] },
    { kind: "add_link", title: "a", target: CONCEPT, field: "tags", after: "auth", why: "Said.", source: SYNC },
    { kind: "add_link", title: "b", target: CONCEPT, field: "tags", after: "billing", why: "Said.", source: SYNC },
    ADDITION,
  ] });
  assert.equal(created.code, 0, created.stdout);
  const row = created.json.data.created[0] as { id: string; path: string };
  const links = ((await attributes(dir, row.path)).items as Array<{ kind: string; ref: unknown }>).filter((item) => item.kind === "link");
  assert.equal(links.length, 1, "the two tags are one grouped item");
  assert.deepEqual(links[0]!.ref, [0, 1]);

  const partial = await run(dir, ["apply"], { decisions: [said(row.id, "approve", { reject: [{ target: CONCEPT, field: "tags", value: "auth" }] })] });
  assert.deepEqual([partial.json.data.decisions[0].result, partial.json.data.decisions[0].reason], ["failed", "INPUT_INVALID"], partial.stdout);
  assert.equal((await attributes(dir, row.path)).status, "pending", "nothing applied");

  const whole = await run(dir, ["apply"], { decisions: [said(row.id, "approve", { reject: [{ target: CONCEPT, field: "tags", value: "auth" }, { target: CONCEPT, field: "tags", value: "billing" }] })] });
  assert.equal(whole.json.data.decisions[0].result, "applied", whole.stdout);
  const tags = (await attributes(dir, CONCEPT_PATH)).tags as string[];
  assert.ok(!tags.includes("auth") && !tags.includes("billing"), "the group is turned down whole");
  assert.match(await readFile(join(dir, CONCEPT_PATH), "utf8"), /Carlos will use RLS for the auth migration\./, "the rest is applied");
});

test("subject: a note id must be a knowledge note, a plain name one line of at most 80 characters; one part per source and subject (cli §5.6)", async (context) => {
  const dir = await fixtureCopy(context);
  const refused = async (subject: unknown, code: string) => {
    const out = await run(dir, ["proposal", "new"], { proposals: [{ ...CONFLICT, subject }] });
    assert.equal(out.json.error?.code, code, `${JSON.stringify(subject)}: ${out.stdout}`);
  };
  await refused("prj-zzzzzzzz", "UNKNOWN_ID");
  await refused("src-7w3c9k5m", "INPUT_INVALID");
  await refused(FIXTURE_PENDING, "INPUT_INVALID");
  await refused("   ", "INPUT_INVALID");
  await refused("two\nlines", "INPUT_INVALID");
  await refused("x".repeat(81), "INPUT_INVALID");
  await refused(7, "INPUT_INVALID");
  const twice = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, subject: "Pilot", notes: [] }, { kind: "review_notes", source: SYNC, subject: "Pilot", notes: [] }] });
  assert.equal(twice.json.error?.code, "INPUT_INVALID", twice.stdout);

  const named = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, subject: PROJECT, notes: [] }, { ...ADDITION, subject: PROJECT }, { ...CONFLICT, subject: "x".repeat(80) }] });
  assert.equal(named.code, 0, named.stdout);
  const row = named.json.data.created.find((entry: { kind: string }) => entry.kind === "review_notes");
  assert.equal(row.title, "From Acme sync, Acme website: 1 change", "a note id is named by its title");
  const meeting = await run(dir, ["proposal", "new"], { proposals: [{ ...CONFLICT, after: "2027-04", subject: SYNC }] });
  assert.equal(meeting.code, 0, `a meeting is a knowledge note: ${meeting.stdout}`);
  assert.deepEqual(await lintErrors(dir), []);
});

test("a held proposal is listed with a note-id subject and without a plain-name one (cli §5.6, eligibility §9.4)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "add_to_note", title: "Price", target: CONCEPT, content: "The price was 95,000.", why: "Said.", source: "src-ex1a3b4c", passages: ["src-ex1a3b4c"], subject: "Price at 95,000" },
    { kind: "add_to_note", title: "Price again", target: PROJECT, content: "The price is set.", why: "Said.", source: "src-ex1a3b4c", passages: ["src-ex1a3b4c"], subject: PROJECT },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const [plain, byNote] = created.json.data.created as Array<{ id: string }>;
  await exclude();
  const out = await waiting(dir);
  const held = new Map(out.held.map((entry) => [entry.id, entry]));
  assert.deepEqual([held.get(plain!.id)?.held, held.get(plain!.id)?.subject], [true, undefined], "a plain name is text: withheld");
  assert.equal(held.get(byNote!.id)?.subject, PROJECT, "a note id is kept");
  assert.ok(!JSON.stringify(out).includes("95,000"));
  const listed = await run(dir, ["proposal", "list", "--status", "pending"]);
  assert.ok(!listed.stdout.includes("Price at 95,000"), listed.stdout);
});
