import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

/** One Review row with a new decision, a fact change, a text addition and a link, as one ingest writes it. */
async function ingest(dir: string) {
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in March", frontmatter: { summary: "The Acme launch moves to March.", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: "Launch moves to March after the sync.\n" }] });
  assert.equal(note.code, 0, note.stdout);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [note.json.data.created[0].id] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS for the auth migration.", why: "Carlos said so.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said in the sync.", source: SYNC },
    { kind: "update_fact", title: "Launch date: March", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved the launch to March.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0].id as string;
}

test("a new Review row renders one section per item, in the order the row lists them, with the Proposed toggle and the summary", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(item.action, "create");
  const body = item.body as string;
  const headings = [...body.matchAll(/^## \[([a-z]+) · (it-[0-9a-z]{8})\] (.+)$/gm)];
  assert.deepEqual(headings.map((m) => m[1]), ["a", "b", "c", "d"]);
  assert.deepEqual(headings.map((m) => m[3]), ["Changes: Launch date on Acme website", "Changes: Row-level security", "Creates: Launch in March", "Changes: Row-level security"]);
  assert.equal(new Set(headings.map((m) => m[2])).size, 4);
  assert.equal((body.match(/<summary>Proposed final wording<\/summary>/g) ?? []).length, 4, "every section has the toggle");
  assert.equal((body.match(/^Decision: Pending$/gm) ?? []).length, 4);
  assert.ok(body.includes("2027-03") && body.includes("Carlos will use RLS") && body.includes("Launch moves to March after the sync."));
  assert.ok(body.includes("**Current**") && body.includes("> 2027-02"), "the existing value is quoted");
  assert.ok(body.includes("0 of 4 decided: 0 applied, 0 closed, 4 waiting for you"));
  assert.ok(!/applied|closed/.test(body.split("## [")[1]!), "no status is written into an item section");
  assert.deepEqual(item.sections, { "Review summary": item.sections["Review summary"] });
  const kept = item.published["@review"].items;
  assert.equal(Object.keys(kept).length, 4);
  for (const entry of Object.values(kept) as Array<Record<string, string>>) assert.ok(entry.rendered_hash && entry.proposed_hash && entry.base_hash);
});

test("an update sends only the summary, never the body, and keeps the rendered hashes of the sections", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const [first] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const record = await run(dir, ["sync", "record"], { records: [{ id, notion: "6a7b0000-0000-4000-8000-0000000000aa", synced_at: NOW, published: first.published }] });
  assert.equal(record.json.data.records[0].result, "recorded", record.stdout);
  // The proposal file changes (a decision is recorded): the summary moves, the sections are not rewritten.
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, file), "utf8");
  const itemId = /item_id: (it-\w+)/.exec(text)![1]!;
  await writeFile(join(dir, file), text.replace(/\n---\n/, `\nitem_decisions:\n  - item_id: ${itemId}\n    decision: accept\n    decided_at: 2026-12-10T09:00:00Z\n    decided_by: notion\n    state: applied\n---\n`));
  const [second] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(second.action, "update");
  assert.equal(second.body, null, "the body is written once");
  assert.ok(second.sections["Review summary"].includes("1 of 4 decided: 1 applied"));
  assert.deepEqual(second.published["@review"].items, first.published["@review"].items, "rendered hashes are the ones from the first render");
});

test("a Review row the plan marks REVIEW_PENDING is withheld whole", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const planPath = join(dir, "..", "plan.json");
  await writeFile(planPath, JSON.stringify({ as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [], review_pending: [{ proposal: id, page_id: "6a7b0000-0000-4000-8000-0000000000aa" }] }));
  const out = (await run(dir, ["sync", "render", "--ids", id, "--plan", planPath])).json.data;
  assert.deepEqual(out.items, []);
  assert.deepEqual(out.skipped, [{ id, reason: "REVIEW_PENDING" }]);
});

test("a Review notes proposal written before 0.8.0 renders as before: no body, the lettered Proposed property", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, file), "utf8");
  await writeFile(join(dir, file), text.replace(/^items:\n(?:  .*\n)+/m, ""));
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(item.body, null);
  assert.ok(String(item.properties.Proposed.value).startsWith("a) "), "the lettered list stays");
});
