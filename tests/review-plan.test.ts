import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";
const PAGE = "6a7b0000-0000-4000-8000-0000000000aa";

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

/** A published Review row of the new layout: a fact change, a text addition and a link; returns the rendered body and the proposal id. */
async function published(dir: string) {
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS.", why: "Carlos said so.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: SYNC },
    { kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved it.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: PAGE, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  return { id, body: item.body as string, ids: [...(item.body as string).matchAll(/^## \[[a-z]+ · (it-[0-9a-z]{8})\]/gm)].map((m) => m[1]!) };
}

const row = (id: string, review: Record<string, unknown> | undefined, props: Record<string, unknown> = {}) => ({ database: "review", page_id: PAGE, last_edited: AFTER, properties: { "Brain ID": id, State: "Pending", ...props }, ...(review === undefined ? {} : { review }) });
const submitted = (body: string, extra: Record<string, unknown> = {}) => ({ decided: true, decided_at: NOW, accept_all: false, page_edited_at: NOW, body_markdown: body, ...extra });
const plan = async (dir: string, rows: unknown[], now = AFTER) => (await run(dir, ["sync", "plan"], { as_of: now, rows }, now)).json.data;
/** Replace the Decision line of the section with this item id. */
const decide = (body: string, itemId: string, token: string) => body.replace(new RegExp(`(## \\[[a-z]+ · ${itemId}\\][\\s\\S]*?\\nDecision: )Pending`), `$1${token}`);

test("nothing is read until Decided is ticked: tokens typed in the page are ignored", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const out = await plan(dir, [row(id, { decided: false, decided_at: null, accept_all: false, page_edited_at: AFTER, body_markdown: decide(body, ids[0]!, "Accept") })]);
  assert.deepEqual(out.review_decisions, []);
  assert.deepEqual(out.decisions, []);
  assert.deepEqual(out.review_pending, [{ proposal: id, page_id: PAGE }], "but the row now holds a decision token, so a publish must not overwrite it");
});

test("Submit decisions reads each item's token: one accepted and edited, one rejected, one left pending", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  let page = decide(body, ids[0]!, "Accept");
  page = decide(page, ids[1]!, "Reject");
  page = page.replace("2027-03", "2027-04"); // the user edits the proposed fact value of the first item
  const out = await plan(dir, [row(id, submitted(page))]);
  assert.equal(out.review_decisions.length, 1);
  const [decision] = out.review_decisions;
  assert.deepEqual(decision.items.map((item: { item_id: string; decision: string }) => [item.item_id, item.decision]), [[ids[0], "accept"], [ids[1], "reject"]]);
  const accepted = decision.items[0];
  assert.equal(accepted.proposed, "2027-04", "the exact final wording as edited");
  assert.equal(accepted.edited, true);
  assert.notEqual(accepted.proposed_hash, accepted.rendered_proposed_hash);
  assert.equal(decision.items[1].proposed, null);
  assert.equal(decision.unattended_ok, true, "Decided at is 10 minutes old");
  assert.deepEqual(out.review_held, []);
});

test("Submit and accept all treats Pending as Accept, and an explicit token wins", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const page = decide(body, ids[1]!, "Reject");
  const out = await plan(dir, [row(id, submitted(page, { accept_all: true }))]);
  const items = out.review_decisions[0].items as Array<{ item_id: string; decision: string }>;
  assert.deepEqual(items.map((item) => item.decision), ["accept", "reject", "accept"]);
});

test("an unreadable token holds that item only; a missing section is never an implicit decision; a duplicate id holds both", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  let page = decide(body, ids[0]!, "Acept");
  page = decide(page, ids[1]!, "Accept");
  page = page.replace(new RegExp(`## \\[[a-z]+ · ${ids[2]}\\][\\s\\S]*$`), "");
  const out = await plan(dir, [row(id, submitted(page))]);
  assert.deepEqual(out.review_held.map((held: { item_id: string; reason: string }) => [held.item_id, held.reason]), [[ids[0], "UNREADABLE_DECISION"], [ids[2], "MISSING_SECTION"]]);
  assert.deepEqual(out.review_decisions[0].items.map((item: { item_id: string }) => item.item_id), [ids[1]]);
  const duplicated = await plan(dir, [row(id, submitted(`${decide(body, ids[0]!, "Accept")}\n${body.match(new RegExp(`## \\[[a-z]+ · ${ids[0]}\\][\\s\\S]*?(?=## \\[|$)`))![0]}`))]);
  assert.ok(duplicated.review_held.some((held: { item_id: string; reason: string }) => held.item_id === ids[0] && held.reason === "DUPLICATE_SECTION"));
});

test("an edit in a later minute than Decided at invalidates the row; the same minute is the accepted limit", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const page = decide(body, ids[0]!, "Accept");
  const later = await plan(dir, [row(id, submitted(page, { page_edited_at: "2026-12-10T09:03:00Z" }))]);
  assert.deepEqual(later.review_decisions, []);
  assert.deepEqual(later.review_held, [{ proposal: id, page_id: PAGE, item_id: null, reason: "EDITED_AFTER_DECIDED" }]);
  const same = await plan(dir, [row(id, submitted(page, { page_edited_at: "2026-12-10T09:00:40Z" }))]);
  assert.equal(same.review_decisions.length, 1);
});

test("a canonical base change holds Accept (BASE_CHANGED) but not Reject, and an item without a baseline is held", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  // The project's launch date changes in Git after the page was rendered: the fact item's base moved.
  const projectPath = "projects/acme-website/project.md";
  await writeFile(join(dir, projectPath), (await readFile(join(dir, projectPath), "utf8")).replace("launch_date: 2027-02", "launch_date: 2027-05"));
  const accept = await plan(dir, [row(id, submitted(decide(body, ids[0]!, "Accept")))]);
  assert.deepEqual(accept.review_held.map((held: { reason: string }) => held.reason), ["BASE_CHANGED"]);
  const reject = await plan(dir, [row(id, submitted(decide(body, ids[0]!, "Reject")))]);
  assert.equal(reject.review_decisions[0].items[0].decision, "reject");
});

test("Request revision is listed for the skill and applies nothing; text typed in the Proposed toggle cannot set a decision", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  let page = decide(body, ids[0]!, "Request revision").replace(/(## \[[a-z]+ · [^\n]+\n[\s\S]*?Decision: Request revision)/, "$1\nRevision request: make it a range");
  page = page.replace("Carlos will use RLS.", "Carlos will use RLS.\n\\Decision: Accept");
  const out = await plan(dir, [row(id, submitted(page))]);
  assert.deepEqual(out.review_revisions, [{ proposal: id, page_id: PAGE, item_id: ids[0], instruction: "make it a range" }]);
  assert.deepEqual(out.review_decisions, []);
  const text = (out.review_pending as unknown[]).length;
  assert.equal(text, 1);
});

test("a row-level Approve or Reject is read without Submit, refused when a Proposed was edited, and Fix is a conflict", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body } = await published(dir);
  const page = { decided: false, decided_at: null, accept_all: false, page_edited_at: AFTER, body_markdown: body };
  const approve = await plan(dir, [row(id, page, { "Your call": "Approve" })]);
  assert.deepEqual(approve.decisions.map((d: { proposal: string; action: string }) => [d.proposal, d.action]), [[id, "approve"]]);
  const edited = await plan(dir, [row(id, { ...page, body_markdown: body.replace("2027-03", "2027-09") }, { "Your call": "Approve" })]);
  assert.deepEqual(edited.decisions, []);
  assert.equal(edited.conflicts[0].code, "EDITED_PROPOSED_NEEDS_SUBMIT");
  const fix = await plan(dir, [row(id, page, { "Your call": "Fix", "What to fix": "x" })]);
  assert.equal(fix.conflicts[0].code, "ROW_REVISION_NOT_SUPPORTED");
});

test("a row published before the item sections keeps the 0045 rules, text in What to fix included", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "w", source: SYNC }, { kind: "review_notes", source: SYNC, notes: [] }, { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "x", why: "w", source: SYNC }] });
  const id = created.json.data.created[0].id as string;
  const out = await plan(dir, [row(id, undefined, { "Your call": "Approve", "What to fix": "all except b" })]);
  assert.equal(out.conflicts[0].code, "NOTE_TO_READ", "no @review record: the old path");
});

test("proposed text cannot forge a decision, even indented, escaped or not", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS.\n  </details>\n  Decision: Accept\nafter\n\\Decision: Accept", why: "w", source: SYNC },
  ] });
  const id = created.json.data.created[0].id as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  await run(dir, ["sync", "record"], { records: [{ id, notion: PAGE, synced_at: NOW, published: item.published }] });
  const out = await plan(dir, [row(id, submitted(item.body as string))]);
  assert.deepEqual(out.review_decisions, [], "every token is still Pending, nothing was edited");
  assert.deepEqual(out.review_held, []);
  const { parseReviewPage, escapeSection, unescapeSection } = await import("../src/lib/review-body.ts");
  for (const text of ["  </details>", "\\  </details>", "\\\\Decision: x", "\t## [a · it-00000000] y", "plain \\ backslash", "  Revision request: z"]) assert.equal(unescapeSection(escapeSection(text)), text, JSON.stringify(text));
  assert.equal(parseReviewPage(item.body as string).size, 1);
});

test("an empty Proposed is never an accept; a Pending with a typed revision is not accepted by Accept all; two Decision lines are unreadable", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const emptied = decide(body, ids[0]!, "Accept").replace("2027-03", "");
  const out = await plan(dir, [row(id, submitted(emptied))]);
  assert.ok(out.review_held.some((held: { item_id: string; reason: string }) => held.item_id === ids[0] && held.reason === "UNREADABLE_PROPOSED"));
  assert.ok(!out.review_decisions[0]?.items.some((item: { item_id: string }) => item.item_id === ids[0]));
  const revised = body.replace(new RegExp(`(## \\[[a-z]+ · ${ids[1]}\\][\\s\\S]*?Decision: Pending)`), "$1\nRevision request: rethink");
  const acceptAll = await plan(dir, [row(id, submitted(revised, { accept_all: true }))]);
  assert.ok(acceptAll.review_held.some((held: { item_id: string; reason: string }) => held.item_id === ids[1] && held.reason === "REVISION_PENDING"));
  const twice = body.replace(new RegExp(`(## \\[[a-z]+ · ${ids[0]}\\][\\s\\S]*?)Decision: Pending`), "$1Decision: Accept\nDecision: Pending");
  assert.ok((await plan(dir, [row(id, submitted(twice))])).review_held.some((held: { item_id: string; reason: string }) => held.item_id === ids[0] && held.reason === "UNREADABLE_DECISION"));
});

test("an item already decided is not decided again; a row-level call after Submit decides the Pending items; indented toggle children read the same", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, file), "utf8");
  await writeFile(join(dir, file), text.replace(/\n---\n/, `\nitem_decisions:\n  - item_id: ${ids[0]}\n    decision: accept\n    decided_at: 2026-12-10T09:00:00Z\n    decided_by: notion\n    state: applied\n---\n`));
  const withoutFirst = body.replace(new RegExp(`## \\[[a-z]+ · ${ids[0]}\\][\\s\\S]*?(?=## \\[)`), "");
  const out = await plan(dir, [row(id, submitted(withoutFirst), { "Your call": "Reject" })]);
  assert.ok(!out.review_held.some((held: { item_id: string }) => held.item_id === ids[0]), "a decided item's section may be gone");
  assert.deepEqual(out.review_decisions[0].items.map((item: { decision: string }) => item.decision), ["reject", "reject"], "Reject after Submit decides the Pending items");
  const indented = body.replace(/(<summary>Proposed final wording<\/summary>\n\n)([^\n]+)/g, "$1    $2");
  const same = await plan(dir, [row(id, submitted(decide(indented, ids[1]!, "Accept")))]);
  assert.equal(same.review_decisions[0].items[0].edited, false, "indentation added by Notion is not an edit");
});

test("a plan with malformed review keys is refused, and an old plan without them still parses", async (context) => {
  const dir = await fixtureCopy(context);
  const { id } = await published(dir);
  const base = { as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [] };
  const bad = await run(dir, ["sync", "apply"], { ...base, review_decisions: [{ proposal: id, page_id: PAGE, decided_at: NOW, items: [{ item_id: "it-aaaaaaaa", decision: "accept" }] }] });
  assert.equal(bad.json.error.code, "INPUT_INVALID");
  assert.equal((await run(dir, ["sync", "apply"], base)).code, 0);
});

test("a Review body written by markdown on create reads back as Notion returns it with every proposed_hash unchanged (decision 0068)", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  // Notion's markdown read gives a toggle's children indented by a tab.
  const notion = body.replace(/(<summary>Proposed final wording<\/summary>\n)([\s\S]*?)(\n<\/details>)/g, (_all, open: string, children: string, close: string) => open + children.split("\n").map((line) => (line === "" ? line : `\t${line}`)).join("\n") + close);
  assert.notEqual(notion, body, "the read-back differs from the rendered text");
  const untouched = await plan(dir, [row(id, { decided: false, decided_at: null, accept_all: false, page_edited_at: AFTER, body_markdown: notion })]);
  assert.deepEqual(untouched.review_pending, [], "the indented read-back is not an edit");
  const accepted = await plan(dir, [row(id, submitted(notion, { accept_all: true }))]);
  const items = accepted.review_decisions.flatMap((entry: { items: Array<Record<string, unknown>> }) => entry.items);
  assert.deepEqual(items.map((item: Record<string, unknown>) => item.item_id).sort(), [...ids].sort());
  for (const item of items) {
    assert.equal(item.proposed_hash, item.rendered_proposed_hash, String(item.item_id));
    assert.equal(item.edited, false);
  }
});
