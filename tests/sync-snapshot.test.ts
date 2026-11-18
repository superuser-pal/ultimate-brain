import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

// `brain sync snapshot` (cli §5.14.10, CC-269): synthetic Notion query replies (simulated MCP output) → the snapshot the
// brain-sync skill writes by hand today, which `sync plan` takes unchanged. Synthetic brain: tests/fixtures/brain-acme.

const NOW = "2026-12-10T09:00:00Z";
const EDITED = "2026-12-10T08:00:00.000Z";
const DB = {
  areas: "a1000000-0000-4000-8000-000000000001",
  people: "a1000000-0000-4000-8000-000000000006",
  orgs: "a1000000-0000-4000-8000-000000000007",
  tasks: "a1000000-0000-4000-8000-00000000000b",
  inbox: "a1000000-0000-4000-8000-00000000000c",
  documents: "a1000000-0000-4000-8000-00000000000d",
  meetings: "a1000000-0000-4000-8000-000000000005",
};
const MARIA = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const CARLOS = "c1000000-0000-4000-8000-000000000002";
const ACME = "6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c";
const AREA = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const PROJECT = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";

// Notion property values as the API returns them.
const rt = (value: string) => value === "" ? [] : [{ type: "text", text: { content: value }, plain_text: value }];
const title = (value: string) => ({ type: "title", title: rt(value) });
const text = (value: string) => ({ type: "rich_text", rich_text: rt(value) });
const select = (name: string | null) => ({ type: "select", select: name === null ? null : { id: "x", name, color: "default" } });
const status = (name: string) => ({ type: "status", status: { id: "s", name, color: "green" } });
const checkbox = (value: boolean) => ({ type: "checkbox", checkbox: value });
const relation = (...ids: string[]) => ({ type: "relation", relation: ids.map((id) => ({ id })), has_more: false });
// The database id is written without dashes in the parent, as Notion may: the CLI compares ids without them.
const page = (database: string, id: string, properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  object: "page", id, created_time: EDITED, last_edited_time: EDITED, in_trash: false, archived: false,
  parent: { type: "data_source_id", data_source_id: "f0000000-0000-4000-8000-000000000001", database_id: database.replaceAll("-", "") },
  properties, url: "https://www.notion.so/x", ...extra,
});
const reply = (results: unknown[], more = false) => ({ object: "list", results, next_cursor: more ? "cursor-2" : null, has_more: more, type: "page_or_data_source", page_or_data_source: {} });

/** The fixture with the Inbox, Documents and Tasks · Document asked configured. */
async function setup(context: Parameters<typeof fixtureCopy>[0]): Promise<{ dir: string; tmp: string }> {
  const dir = await fixtureCopy(context);
  const path = join(dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  config.notion.databases.inbox = DB.inbox;
  config.notion.databases.documents = DB.documents;
  config.notion.tasks.properties.document_asked = "Document asked";
  await writeFile(path, JSON.stringify(config, null, 2));
  const tmp = join(dir, "..", "run");
  await mkdir(tmp, { recursive: true });
  return { dir, tmp };
}

let counter = 0;
async function save(tmp: string, value: unknown, name = `reply-${String(counter += 1).padStart(3, "0")}.json`): Promise<string> {
  const path = join(tmp, name);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function snapshot(dir: string, inputs: string[]) {
  const output = join(dir, "..", "snapshot.json");
  const run = await brain(["sync", "snapshot", "--brain", dir, "--now", NOW, ...inputs.flatMap((input) => ["--input", input]), "--output", output, "--json"]);
  return { run, output, read: async () => JSON.parse(await readFile(output, "utf8")) };
}

/** Maria's People row: every property type of formats.md's table, a relation, a formula, a rollup of a relation and an empty value. */
const mariaPage = page(DB.people, MARIA, {
  Name: title("Maria López"),
  Summary: text("Product manager at Acme since December 2026, previously designer."),
  Role: text(""),
  Lifecycle: select("Reviewed"),
  Stage: status("Active"),
  Email: { type: "email", email: "maria@acme.example" },
  Website: { type: "url", url: null },
  Score: { type: "number", number: 7 },
  Pinned: checkbox(false),
  Since: { type: "date", date: { start: "2026-12-01", end: null, time_zone: null } },
  "Brain ID": text("per-3h8w2n6c"),
  Org: relation(ACME),
  Initials: { type: "formula", formula: { type: "string", string: "ML" } },
  "Org · Area": { type: "rollup", rollup: { type: "array", function: "show_original", array: [{ type: "relation", relation: [{ id: AREA }] }] } },
  Tags: { type: "multi_select", multi_select: [{ id: "t", name: "VIP", color: "red" }] },
  Owner: { type: "people", people: [] },
  Created: { type: "created_time", created_time: EDITED },
  Ask: { type: "button", button: {} },
});
// The row the skill writes by hand today for the same page (formats.md).
const mariaRow = {
  database: "people", page_id: MARIA, last_edited: EDITED,
  properties: {
    Name: "Maria López", Summary: "Product manager at Acme since December 2026, previously designer.", Role: null, Lifecycle: "Reviewed", Stage: "Active",
    Email: "maria@acme.example", Website: null, Score: 7, Pinned: false, Since: { start: "2026-12-01", end: null },
    "Brain ID": "per-3h8w2n6c", Org: [ACME], Initials: "ML", "Org · Area": [AREA],
  },
};
const carlosPage = page(DB.people, CARLOS, { Name: title("Carlos Ruiz"), "Brain ID": text("per-9t2c6m4a"), Org: relation(ACME), Lifecycle: select(null) });
const carlosRow = { database: "people", page_id: CARLOS, last_edited: EDITED, properties: { Name: "Carlos Ruiz", "Brain ID": "per-9t2c6m4a", Org: [ACME], Lifecycle: null } };
const examplePerson = page(DB.people, "c1000000-0000-4000-8000-000000000003", { Name: title("Example · Jordan Lee"), "Brain ID": text("") });
const areaPage = page(DB.areas, AREA, { Name: title("Clients"), Summary: text("Paid client work for the consulting business."), "Brain ID": text("area-2m7c4h8n"), Lifecycle: select("Reviewed") });
const areaRow = { database: "areas", page_id: AREA, last_edited: EDITED, properties: { Name: "Clients", Summary: "Paid client work for the consulting business.", "Brain ID": "area-2m7c4h8n", Lifecycle: "Reviewed" } };

const INBOX_ASKED = "c3000000-0000-4000-8000-000000000001";
const INBOX_PLAIN = "c3000000-0000-4000-8000-000000000002";
const inboxPage = (id: string, brainId: string, asked: boolean) => page(DB.inbox, id, { Name: title("Kickoff notes"), Summary: text("Notes"), "Brain ID": text(brainId), "Document asked": checkbox(asked), "Only keep": text(""), Area: relation(AREA) });
const REPORT = "c4000000-0000-4000-8000-000000000001";
const REPORT_QUIET = "c4000000-0000-4000-8000-000000000002";
const DOC = "c4000000-0000-4000-8000-000000000003";
const reportPage = (id: string, refresh: boolean, fix: string) => page(DB.documents, id, { Name: title("Acme report"), "Brain ID": text("vw-5b2n7q9h"), "Refresh asked": checkbox(refresh), "What to fix": text(fix), Project: relation(PROJECT), Accepted: checkbox(false) });
const docPage = page(DB.documents, DOC, { Name: title("Row-level security"), "Brain ID": text("con-1s6t8e2b"), Lifecycle: select("Draft"), Accepted: checkbox(true), "Accepted at": { type: "date", date: { start: "2026-12-09T10:00:00.000Z", end: null } }, Project: relation() });
const TASK = "d4000000-0000-4000-8000-000000000001";
const taskPage = (asked: boolean, id = TASK) => page(DB.tasks, id, { Name: title("Check go-live with hosting"), Status: status("To Do"), "Document asked": checkbox(asked), Project: relation(PROJECT), Area: relation(), Due: { type: "date", date: null } });

test("query replies of each database give the snapshot the skill writes today, and sync plan takes it unchanged (cli §5.14.10)", async (context) => {
  const { dir, tmp } = await setup(context);
  // People is read in two pages (a paged reply): the first has has_more true.
  await save(tmp, reply([mariaPage, examplePerson], true));
  await save(tmp, reply([carlosPage]));
  await save(tmp, reply([areaPage]));
  await save(tmp, reply([page(DB.orgs, ACME, { Name: title("Example · Globex"), "Brain ID": text("") })]));
  await save(tmp, reply([inboxPage(INBOX_ASKED, "src-2k6m9p3t", true), inboxPage(INBOX_PLAIN, "src-7w3c9k5m", false), inboxPage("c3000000-0000-4000-8000-000000000003", "", true)]));
  await save(tmp, reply([reportPage(REPORT, true, "Lucía left Acme in June"), reportPage(REPORT_QUIET, false, ""), docPage]));
  await save(tmp, reply([taskPage(true), taskPage(false, "d4000000-0000-4000-8000-000000000002")]));
  // The rows that are no query reply: a tracked task read by id, and the Document's wording.
  const wording = { accepted: true, accepted_at: "2026-12-09T10:00:00Z", page_edited_at: EDITED, body_markdown: "Text.\n", unconvertible: false, pending_revision: false, pending_refresh: false };
  await save(tmp, { rows: [
    { database: "tasks", page_id: TASK, last_edited: EDITED, properties: { Name: "Check go-live with hosting", Status: "To Do" }, status_group: "todo" },
    { database: "tasks", page_id: "d4000000-0000-4000-8000-000000000009", last_edited: null, properties: {}, unreadable: true },
    { database: "documents", page_id: DOC, last_edited: EDITED, properties: { "Brain ID": "con-1s6t8e2b" }, wording },
  ] }, "rows.json");

  const { run, output, read } = await snapshot(dir, [tmp]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data, { output, rows: 9, examples_left_out: 2, databases: { areas: 1, documents: 2, inbox: 2, people: 2, tasks: 2 } });
  assert.deepEqual(run.json.warnings, []);

  const today = { as_of: NOW, rows: [
    areaRow,
    { database: "documents", page_id: REPORT, last_edited: EDITED, properties: { "Brain ID": "vw-5b2n7q9h", "Refresh asked": true, "What to fix": "Lucía left Acme in June" } },
    { database: "documents", page_id: DOC, last_edited: EDITED, properties: { Name: "Row-level security", "Brain ID": "con-1s6t8e2b", Lifecycle: "Draft", Accepted: true, "Accepted at": { start: "2026-12-09T10:00:00.000Z", end: null }, Project: [] }, wording },
    { database: "inbox", page_id: INBOX_ASKED, last_edited: EDITED, properties: { "Brain ID": "src-2k6m9p3t", "Document asked": true, "Only keep": null } },
    { database: "inbox", page_id: INBOX_PLAIN, last_edited: EDITED, properties: { "Brain ID": "src-7w3c9k5m" } },
    mariaRow, carlosRow,
    { database: "tasks", page_id: TASK, last_edited: EDITED, properties: { Name: "Check go-live with hosting", "Document asked": true, Project: [PROJECT], Area: [], Status: "To Do" }, status_group: "todo" },
    { database: "tasks", page_id: "d4000000-0000-4000-8000-000000000009", last_edited: null, properties: {}, unreadable: true },
  ] };
  // Sorted by database, then page id.
  today.rows.sort((a, b) => a.database === b.database ? a.page_id.localeCompare(b.page_id) : a.database.localeCompare(b.database));
  const written = await read();
  assert.deepEqual(written, today);

  const plan = async (file: string) => { const result = await brain(["sync", "plan", "--brain", dir, "--input", file, "--json"]); assert.equal(result.code, 0, result.stdout); return result.json.data; };
  assert.deepEqual(await plan(output), await plan(await save(join(dir, ".."), today, "today.json")));
});

test("a database whose replies all have has_more true is an incomplete read (INPUT_INVALID)", async (context) => {
  const { dir, tmp } = await setup(context);
  const { run, output } = await snapshot(dir, [await save(tmp, reply([mariaPage], true))]);
  assert.equal(run.code, 4);
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.match(JSON.stringify(run.json.error.details), /INCOMPLETE_READ: every saved reply of the people database/);
  await assert.rejects(readFile(output, "utf8"), "nothing is written on an error");
});

test("a file of another shape, a page of no configured or no snapshot database is INPUT_INVALID", async (context) => {
  const { dir, tmp } = await setup(context);
  for (const value of [{ as_of: NOW, rows: [] }, { results: [] }, [mariaPage], reply([page("f9000000-0000-4000-8000-000000000001", MARIA, {})]), reply([page(DB.meetings, MARIA, {})])]) {
    const { run } = await snapshot(dir, [await save(tmp, value)]);
    assert.equal(run.code, 4, JSON.stringify(value));
    assert.equal(run.json.error.code, "INPUT_INVALID");
  }
  // A rows file is checked as sync plan checks a snapshot row.
  const { run } = await snapshot(dir, [await save(tmp, { rows: [{ database: "people", page_id: MARIA, last_edited: EDITED, properties: {}, extra: 1 }] })]);
  assert.equal(run.code, 4);
  assert.match(JSON.stringify(run.json.error.details), /rows\/0\/extra/);
});

test("a truncated relation is left out with a warning RELATION_TRUNCATED; a trashed result is left out", async (context) => {
  const { dir, tmp } = await setup(context);
  const truncated = page(DB.people, MARIA, { Name: title("Maria López"), Org: { ...relation(ACME), has_more: true } });
  const trashed = page(DB.people, CARLOS, { Name: title("Carlos Ruiz") }, { in_trash: true });
  const { run, read } = await snapshot(dir, [await save(tmp, reply([truncated, trashed]))]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.warnings.map((warning: { code: string }) => warning.code), ["RELATION_TRUNCATED"]);
  assert.deepEqual((await read()).rows, [{ database: "people", page_id: MARIA, last_edited: EDITED, properties: { Name: "Maria López" } }]);
});

test("a page in two replies is passed once, the later read; the same read giving two rows is INPUT_INVALID", async (context) => {
  const { dir, tmp } = await setup(context);
  const later = page(DB.people, MARIA, { Name: title("Maria L.") }, { last_edited_time: "2026-12-10T08:30:00.000Z" });
  const first = await snapshot(dir, [await save(tmp, reply([page(DB.people, MARIA, { Name: title("Maria López") })])), await save(tmp, reply([later]))]);
  assert.equal(first.run.code, 0, first.run.stdout);
  assert.deepEqual((await first.read()).rows.map((row: { properties: unknown }) => row.properties), [{ Name: "Maria L." }]);
  const clash = await snapshot(dir, [await save(tmp, reply([page(DB.people, MARIA, { Name: title("Maria López") })])), await save(tmp, reply([page(DB.people, MARIA, { Name: title("Maria L.") })]))]);
  assert.equal(clash.run.code, 4);
});

test("a rows file joins a query row only for a tracked task or a wording object, never overriding a value (INPUT_INVALID)", async (context) => {
  const { dir, tmp } = await setup(context);
  const replies = await save(tmp, reply([taskPage(true)]));
  const people = await save(tmp, reply([mariaPage]));
  const cases: Array<[string, unknown[], string[]]> = [
    ["a different value for the same property", [{ database: "tasks", page_id: TASK, last_edited: EDITED, properties: { Name: "Another title", Status: "Done" }, status_group: "complete" }], [replies]],
    ["an unreadable row joining a read one", [{ database: "tasks", page_id: TASK, last_edited: null, properties: {}, unreadable: true }], [replies]],
    ["a plain row over a query row", [{ database: "people", page_id: MARIA, last_edited: EDITED, properties: { Role: "Lead" } }], [people]],
    ["another database for the same page", [{ database: "documents", page_id: MARIA, last_edited: EDITED, properties: { "Brain ID": "per-3h8w2n6c" }, wording: { accepted: false, accepted_at: null, page_edited_at: EDITED, body_markdown: null, unconvertible: true, pending_revision: false, pending_refresh: false } }], [people]],
    ["a page twice in the rows files", [{ database: "tasks", page_id: "d4000000-0000-4000-8000-000000000005", last_edited: EDITED, properties: {}, status_group: null }, { database: "tasks", page_id: "d4000000-0000-4000-8000-000000000005", last_edited: EDITED, properties: {}, status_group: null }], []],
  ];
  for (const [name, rows, inputs] of cases) {
    const { run } = await snapshot(dir, [...inputs, await save(tmp, { rows }, `rows-${counter += 1}.json`)]);
    assert.equal(run.code, 4, name);
    assert.equal(run.json.error.code, "INPUT_INVALID", name);
  }
  // A tracked task read later than the query: the later last_edited is kept, its properties joined.
  const later = "2026-12-10T08:45:00Z";
  const { run, read } = await snapshot(dir, [replies, await save(tmp, { rows: [{ database: "tasks", page_id: TASK, last_edited: later, properties: { Name: "Check go-live with hosting", Status: "Done" }, status_group: "complete", gone: true }] })]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual((await read()).rows, [{ database: "tasks", page_id: TASK, last_edited: later, properties: { Name: "Check go-live with hosting", "Document asked": true, Project: [PROJECT], Area: [], Status: "Done" }, status_group: "complete", gone: true }]);
});

test("Tasks rows are left out when Document asked is unmapped; an Inbox Report row asking for a refresh keeps its report properties", async (context) => {
  const { dir, tmp } = await setup(context);
  const path = join(dir, "brain.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  config.notion.tasks.properties.document_asked = "";
  await writeFile(path, JSON.stringify(config));
  const inboxReport = page(DB.inbox, "c3000000-0000-4000-8000-000000000007", { Name: title("Acme report"), "Brain ID": text("vw-5b2n7q9h"), Refresh: checkbox(true), "What to fix": text("") });
  const { run, read } = await snapshot(dir, [await save(tmp, reply([taskPage(true)])), await save(tmp, reply([inboxReport]))]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual((await read()).rows, [{ database: "inbox", page_id: "c3000000-0000-4000-8000-000000000007", last_edited: EDITED, properties: { "Brain ID": "vw-5b2n7q9h", Refresh: true, "What to fix": null } }]);
});

test("sync snapshot needs --input and --output (USAGE)", async (context) => {
  const { dir } = await setup(context);
  const run = await brain(["sync", "snapshot", "--brain", dir, "--input", dir, "--json"]);
  assert.equal(run.code, 2);
  assert.equal(run.json.error.code, "USAGE");
});
