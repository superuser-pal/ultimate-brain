import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { gitBodyOf, textHash } from "../src/lib/wording.ts";
import { approveNote, brain, fixtureCopy, withPassages } from "./helpers.ts";

// CC-216 (spec/cli.md §5.14.7, "The same pass's Documents read stands in for that query"). The skill selects the accepted-wording
// rows in Notion; this file is the equivalence evidence for selecting them from the pull's own complete read of the Documents
// database instead of a second, filtered query. A simulated Documents database pages its results two at a time and counts calls;
// both procedures build a snapshot from what they selected and the real `sync plan` reads it, so a difference in selection shows
// up as a difference in the plan.

const NOW = "2026-12-10T10:05:00Z";
const SYNCED = "2026-12-10T09:00:00Z"; // every Document's last_synced: since = 08:58
const SINCE = "2026-12-10T08:58:00Z";
const OLD = "2026-12-10T08:30:00Z"; // before since
const SEED = "## Why\n\nBecause the login must be simple.\n";
const PAGE_SIZE = 2;
const REVIEW_PAGE = "6a7b0000-0000-4000-8000-0000000000aa";
const PROJECT = "prj-9x4t1b7e";
const SYNC = "mtg-8c4n2p7w";
const page = (n: number) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, "0")}`;

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

interface Doc { id: string; path: string; page: string }

/** Five promoted Documents, each published once at SYNCED with both baselines: the accepted-wording candidates. */
async function documents(dir: string): Promise<Doc[]> {
  await approveNote(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md");
  const docs: Doc[] = [];
  for (const [n, title] of ["Login page", "Billing page", "Search page", "Admin page", "Help page"].entries()) {
    const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title, frontmatter: { summary: `${title}.`, origin: "promoted", promoted_from: "dec-7k2m9q4x" }, body: SEED }] });
    assert.equal(created.code, 0, created.stdout);
    const { id, path } = created.json.data.created[0] as { id: string; path: string };
    const file = join(dir, path);
    const document = parseFrontmatter(await readFile(file, "utf8"));
    const seed = textHash(gitBodyOf({ body: document.body } as never));
    // One decision promotes to one Document; §5.14.7 reads only `origin`, so the link is dropped to promote the same decision again.
    delete document.attributes.promoted_from;
    document.attributes.notion = page(n + 1);
    document.attributes.last_synced = SYNCED;
    document.attributes.notion_published = { "@content": seed, "@notion_body": seed, "@git_body": seed };
    await writeFile(file, serializeFrontmatter(document));
    docs.push({ id, path, page: page(n + 1) });
  }
  return docs;
}

/** A published Review row whose page holds a decision typed but not submitted: its edits must not be published over (§7.10). */
async function pendingReview(dir: string) {
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [] },
    { kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "Moved.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  await run(dir, ["sync", "record"], { records: [{ id, notion: REVIEW_PAGE, synced_at: SYNCED, published: item.published }] });
  const body = (item.body as string).replace(/(\nDecision: )Pending/, "$1Accept");
  return { database: "review", page_id: REVIEW_PAGE, last_edited: "2026-12-10T09:30:00Z", properties: { "Brain ID": id, State: "Pending" },
    review: { decided: false, decided_at: null, accept_all: false, page_edited_at: "2026-12-10T09:30:00Z", body_markdown: body } };
}

/** A row of the simulated Documents database: the metadata a query returns, and the page a read returns. */
interface NotionRow { page_id: string; last_edited: string; properties: Record<string, unknown>; body: string; pending_revision?: boolean }

/** The Documents database as the Notion MCP serves it: sorted results, `PAGE_SIZE` per call, every call counted. */
class Documents {
  calls = { enumerate: 0, query: 0, read: 0 };
  readonly rows: NotionRow[];
  private readonly failing: Set<number>;
  constructor(rows: NotionRow[], failing = new Set<number>()) { this.rows = rows; this.failing = failing; }
  /** One call of a query; `filter` is the accepted-wording filter (`since` null: no time condition). A cursor in `failing` fails once. */
  call(kind: "enumerate" | "query", cursor: number, filter?: { since: string | null }) {
    this.calls[kind] += 1;
    if (this.failing.delete(cursor)) throw new Error(`page at cursor ${cursor} failed`);
    const matching = filter === undefined ? this.rows : this.rows.filter((row) => row.properties.Accepted === true || filter.since === null || row.last_edited >= filter.since);
    const results = matching.slice(cursor, cursor + PAGE_SIZE);
    return { results, next_cursor: cursor + PAGE_SIZE < matching.length ? cursor + PAGE_SIZE : null };
  }
  /** The page read that gives a selected row its `wording` (§5.14.7): unchanged by CC-216. */
  read(pageId: string) {
    this.calls.read += 1;
    const row = this.rows.find((entry) => entry.page_id === pageId)!;
    return { accepted: row.properties.Accepted === true, accepted_at: (row.properties["Accepted at"] as string | null) ?? null, page_edited_at: row.last_edited,
      body_markdown: row.body, unconvertible: false, pending_revision: row.pending_revision ?? false, pending_refresh: false };
  }
}

type Read = { rows: Array<Omit<NotionRow, "body">>; complete: boolean };

/** Pull step 2's read of the Documents database. `retry`: a failed page is read again with its own cursor; otherwise the read stops. `leaveOut` drops a property from every row. */
function enumerate(db: Documents, { retry = true, leaveOut }: { retry?: boolean; leaveOut?: string } = {}): Read {
  const rows: Read["rows"] = [];
  let cursor: number | null = 0;
  while (cursor !== null) {
    let result;
    try { result = db.call("enumerate", cursor); } catch {
      if (!retry) return { rows, complete: false };
      continue;
    }
    for (const { body: _body, ...row } of result.results) {
      const properties = { ...row.properties };
      if (leaveOut !== undefined) delete properties[leaveOut];
      rows.push({ ...row, properties });
    }
    cursor = result.next_cursor;
  }
  return { rows, complete: true };
}

/** `since` and the candidates, from Git, as §5.14.7 says. */
async function candidates(dir: string, docs: Doc[]): Promise<{ ids: Set<string>; since: string | null }> {
  let since: string | null = null;
  let missing = false;
  for (const doc of docs) {
    const attributes = parseFrontmatter(await readFile(join(dir, doc.path), "utf8")).attributes as Record<string, unknown>;
    const published = (attributes.notion_published ?? {}) as Record<string, unknown>;
    if (typeof attributes.last_synced !== "string" || !published["@notion_body"] || !published["@git_body"]) missing = true;
    else if (since === null || attributes.last_synced < since) since = attributes.last_synced;
  }
  if (missing || since === null) return { ids: new Set(docs.map((doc) => doc.id)), since: null };
  return { ids: new Set(docs.map((doc) => doc.id)), since: new Date(Date.parse(since) - 120_000).toISOString().replace(".000Z", "Z") };
}

const keep = (rows: Array<{ page_id: string; properties: Record<string, unknown> }>, ids: Set<string>) =>
  rows.filter((row) => ids.has(row.properties["Brain ID"] as string)).map((row) => row.page_id).sort();

/** Before CC-216: the dedicated query, every page of it. */
function selectByQuery(db: Documents, ids: Set<string>, since: string | null): string[] {
  const rows: NotionRow[] = [];
  let cursor: number | null = 0;
  while (cursor !== null) { const result = db.call("query", cursor, { since }); rows.push(...result.results); cursor = result.next_cursor; }
  return keep(rows, ids);
}

/** The filter of §5.14.7 applied to rows already read. */
const filterRead = (read: Read, ids: Set<string>, since: string | null) =>
  keep(read.rows.filter((row) => row.properties.Accepted === true || since === null || row.last_edited >= since), ids);

/** CC-216: the same pass's read when it is complete and every row has Brain ID, Accepted and its edit time; the query otherwise. */
function selectReusing(db: Documents, read: Read, ids: Set<string>, since: string | null): string[] {
  const usable = read.complete && read.rows.every((row) => "Brain ID" in row.properties && "Accepted" in row.properties && typeof row.last_edited === "string");
  return usable ? filterRead(read, ids, since) : selectByQuery(db, ids, since);
}

/** The snapshot both procedures send: the candidates' Documents rows, with `wording` on the selected ones, and the Review rows. */
function snapshot(db: Documents, docs: Doc[], selected: string[], review: unknown[]) {
  const rows = docs.flatMap((doc) => {
    const row = db.rows.find((entry) => entry.page_id === doc.page);
    if (row === undefined) return [];
    const base = { database: "documents", page_id: row.page_id, last_edited: row.last_edited, properties: { "Brain ID": doc.id } };
    return [selected.includes(row.page_id) ? { ...base, wording: db.read(row.page_id) } : base];
  });
  return { as_of: NOW, rows: [...rows, ...review] };
}

async function plan(dir: string, input: unknown) {
  const result = await run(dir, ["sync", "plan"], input);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

const quiet = (doc: Doc): NotionRow => ({ page_id: doc.page, last_edited: OLD, properties: { "Brain ID": doc.id, Accepted: false, "Accepted at": null }, body: SEED });
const UNRELATED: NotionRow[] = [
  { page_id: page(90), last_edited: "2026-12-10T10:00:00Z", properties: { "Brain ID": "ref-0a0a0a0a", Accepted: false, "Accepted at": null }, body: "A learned Document.\n" },
  { page_id: page(91), last_edited: "2026-12-10T10:01:00Z", properties: { "Brain ID": null, Accepted: true, "Accepted at": "2026-12-10T10:01:00Z" }, body: "Made in Notion.\n" },
];

/** A queue that needs the user: an import, an unaccepted draft, a stale acceptance, an old acceptance to clear, one quiet page. */
function populated(docs: Doc[]): NotionRow[] {
  const [login, billing, search, admin, help] = docs as [Doc, Doc, Doc, Doc, Doc];
  return [
    { ...quiet(login), last_edited: "2026-12-10T10:00:00Z", properties: { "Brain ID": login.id, Accepted: true, "Accepted at": "2026-12-10T10:00:00Z" }, body: "## Why\n\nEmail login only.\n" },
    UNRELATED[0]!,
    { ...quiet(billing), last_edited: "2026-12-10T09:30:00Z", body: "## Why\n\nA draft nobody accepted.\n" },
    { ...quiet(search), last_edited: "2026-12-10T09:45:00Z", properties: { "Brain ID": search.id, Accepted: true, "Accepted at": "2026-12-10T09:40:00Z" }, body: "## Why\n\nEdited after the click.\n" },
    UNRELATED[1]!,
    { ...quiet(admin), properties: { "Brain ID": admin.id, Accepted: true, "Accepted at": OLD } },
    quiet(help),
  ];
}

const wordingOf = (data: Record<string, unknown>) => ({
  accepted_wording: (data.accepted_wording as Array<{ note: string }>).map((item) => item.note).sort(),
  wording_waiting: (data.wording_waiting as Array<{ note: string; reason: string }>).map((item) => `${item.note} ${item.reason}`).sort(),
  wording_held: (data.wording_held as Array<{ note: string; reason: string }>).map((item) => `${item.note} ${item.reason}`).sort(),
  clear_accepted: (data.clear_accepted as Array<{ note: string }>).map((item) => item.note).sort(),
  review_pending: data.review_pending,
});

/** Runs both procedures on two copies of one database and returns what each selected, their plans and their calls. */
async function compare(context: TestContext, dir: string, docs: Doc[], rows: NotionRow[], options: { review?: unknown[]; failing?: number[]; retry?: boolean; leaveOut?: string } = {}) {
  const { ids, since } = await candidates(dir, docs);
  const before = new Documents(structuredClone(rows), new Set(options.failing));
  const beforeRead = enumerate(before, { retry: true });
  assert.ok(beforeRead.complete, "the pull's own read finishes before CC-216 too (it retries)");
  const beforeSelected = selectByQuery(before, ids, since);
  const after = new Documents(structuredClone(rows), new Set(options.failing));
  const afterRead = enumerate(after, { retry: options.retry ?? true, leaveOut: options.leaveOut });
  const afterSelected = selectReusing(after, afterRead, ids, since);
  const review = options.review ?? [];
  const beforePlan = await plan(dir, snapshot(before, docs, beforeSelected, review));
  const afterPlan = await plan(dir, snapshot(after, docs, afterSelected, review));
  context.diagnostic(`calls before: ${JSON.stringify(before.calls)}; after: ${JSON.stringify(after.calls)}`);
  return { since, read: afterRead, ids, before: { selected: beforeSelected, plan: beforePlan, calls: before.calls }, after: { selected: afterSelected, plan: afterPlan, calls: after.calls } };
}

test("a quiet pass selects nothing either way, and the same-pass read saves the whole query (CC-216)", async (context) => {
  const dir = await fixtureCopy(context);
  const docs = await documents(dir);
  const result = await compare(context, dir, docs, [...docs.map(quiet), ...UNRELATED]);
  assert.equal(result.since, SINCE);
  assert.deepEqual(result.after.selected, []);
  assert.deepEqual(result.after.selected, result.before.selected);
  assert.deepEqual(result.after.plan, result.before.plan);
  assert.deepEqual(wordingOf(result.after.plan), { accepted_wording: [], wording_waiting: [], wording_held: [], clear_accepted: [], review_pending: [] });
  // 7 rows read 2 at a time is 4 calls either way; the query that found nothing was 1 call more.
  assert.deepEqual(result.before.calls, { enumerate: 4, query: 1, read: 0 });
  assert.deepEqual(result.after.calls, { enumerate: 4, query: 0, read: 0 });
});

test("a populated queue over several result pages plans the same; an unsubmitted Review page stays protected (CC-216)", async (context) => {
  const dir = await fixtureCopy(context);
  const docs = await documents(dir);
  const review = [await pendingReview(dir)];
  const result = await compare(context, dir, docs, populated(docs), { review });
  const [login, billing, search, admin] = docs as [Doc, Doc, Doc, Doc];
  assert.deepEqual(result.after.selected, [login.page, billing.page, search.page, admin.page].sort());
  assert.deepEqual(result.after.selected, result.before.selected);
  assert.deepEqual(result.after.plan, result.before.plan);
  const proposal = (review[0] as { properties: { "Brain ID": string } }).properties["Brain ID"];
  assert.deepEqual(wordingOf(result.after.plan), {
    accepted_wording: [login.id],
    wording_waiting: [`${search.id} EDITED_AFTER_ACCEPTANCE`],
    wording_held: [`${billing.id} UNACCEPTED_DRAFT`],
    clear_accepted: [admin.id],
    review_pending: [{ proposal, page_id: REVIEW_PAGE }],
  });
  // The query's 6 matching rows (4 candidates, 2 unrelated) took 3 calls; the page reads are the same 4 either way.
  assert.deepEqual(result.before.calls, { enumerate: 4, query: 3, read: 4 });
  assert.deepEqual(result.after.calls, { enumerate: 4, query: 0, read: 4 });
});

test("a candidate with no baseline removes since, and every candidate row is selected either way (CC-216)", async (context) => {
  const dir = await fixtureCopy(context);
  const docs = await documents(dir);
  const help = docs[4]!;
  const file = join(dir, help.path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  delete (document.attributes.notion_published as Record<string, unknown>)["@notion_body"];
  await writeFile(file, serializeFrontmatter(document));
  const rows = [...docs.slice(0, 4).map(quiet), { ...quiet(help), body: "## Why\n\nNotion's older text.\n" }, ...UNRELATED];
  const result = await compare(context, dir, docs, rows);
  assert.equal(result.since, null);
  assert.deepEqual(result.after.selected, docs.map((doc) => doc.page).sort());
  assert.deepEqual(result.after.selected, result.before.selected);
  assert.deepEqual(result.after.plan, result.before.plan);
  assert.deepEqual(wordingOf(result.after.plan).wording_held, [`${help.id} NO_BASELINE`]);
});

test("a read that failed on a page and was read again with its cursor is complete and reused (CC-216)", async (context) => {
  const dir = await fixtureCopy(context);
  const docs = await documents(dir);
  const result = await compare(context, dir, docs, populated(docs), { failing: [4] });
  assert.ok(result.read.complete);
  assert.deepEqual(result.after.selected, result.before.selected);
  assert.deepEqual(result.after.plan, result.before.plan);
  assert.deepEqual(result.after.calls, { enumerate: 5, query: 0, read: 4 }, "the retried page is one more read call, and no query");
});

test("a read that never finished falls back to the query, which finds the candidate on the missing page (CC-216)", async (context) => {
  const dir = await fixtureCopy(context);
  const docs = await documents(dir);
  const result = await compare(context, dir, docs, populated(docs), { failing: [2], retry: false });
  assert.equal(result.read.complete, false);
  assert.deepEqual(result.after.selected, result.before.selected);
  assert.deepEqual(result.after.plan, result.before.plan);
  const billing = docs[1]!;
  assert.ok(!filterRead(result.read, result.ids, result.since).includes(billing.page), "filtering the partial read alone would have hidden the unaccepted draft on page 2");
  assert.deepEqual(wordingOf(result.after.plan).wording_held, [`${billing.id} UNACCEPTED_DRAFT`]);
  assert.equal(result.after.calls.query, 3);
});

test("a read without the Accepted box falls back to the query, so an old acceptance is not hidden (CC-216)", async (context) => {
  const dir = await fixtureCopy(context);
  const docs = await documents(dir);
  const result = await compare(context, dir, docs, populated(docs), { leaveOut: "Accepted" });
  assert.deepEqual(result.after.selected, result.before.selected);
  assert.deepEqual(result.after.plan, result.before.plan);
  const admin = docs[3]!;
  assert.ok(!filterRead(result.read, result.ids, result.since).includes(admin.page), "filtering rows without Accepted would have missed the Accepted row last edited before since");
  assert.deepEqual(wordingOf(result.after.plan).clear_accepted, [admin.id]);
  assert.equal(result.after.calls.query, 3);
});
