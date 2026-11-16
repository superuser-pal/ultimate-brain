import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { excludableDecision } from "./exclusion-fixture.ts";
import { approveNote, brain, fixtureCopy, withoutReviewSections, withPassages } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
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
  return (created.json.data.created as Array<{ id: string; kind: string }>).find((entry) => entry.kind === "review_notes")!.id;
}

test("a deferred item keeps its id in the new proposal, and the new proposal lints", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const original = (await readFile(join(dir, file), "utf8")).match(/item_id: (it-\w+)\n\s+kind: (\w+)\n\s+ref: (.+)/g)!;
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "chat", note: "all except a", exclude: [{ change: 0 }] }] });
  assert.equal(applied.code, 0, applied.stdout);
  const listed = (await run(dir, ["proposal", "list"])).json.data.proposals as Array<{ id: string; path: string; title: string }>;
  const deferred = listed.find((p) => p.title.startsWith("Deferred from"))!;
  const text = await readFile(join(dir, deferred.path), "utf8");
  const kept = /items:\n\s+- item_id: (it-\w+)\n\s+kind: change\n\s+ref: 0/.exec(text)!;
  assert.ok(kept && original.some((entry) => entry.includes(kept[1]!)), "the deferred change keeps the id it had");
  const lint = await run(dir, ["lint"]);
  assert.deepEqual(lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error"), []);
});

test("a plan with a malformed review_pending entry is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const planPath = join(dir, "..", "plan.json");
  await writeFile(planPath, JSON.stringify({ as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [], review_pending: [null] }));
  const out = await run(dir, ["sync", "render", "--ids", id, "--plan", planPath]);
  assert.equal(out.json.error.code, "INPUT_INVALID");
});

test("sync plan reads a published restricted note in its eligible form: no conflict, no correction", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  await approveNote(dir, note.path);
  const [item] = (await run(dir, ["sync", "render", "--ids", note.id])).json.data.items;
  await run(dir, ["sync", "record"], { records: [{ id: note.id, notion: "6a7b0000-0000-4000-8000-0000000000dd", synced_at: NOW, published: item.published }] });
  await exclude();
  const [after] = (await run(dir, ["sync", "render", "--ids", note.id])).json.data.items;
  await run(dir, ["sync", "record"], { records: [{ id: note.id, notion: "6a7b0000-0000-4000-8000-0000000000dd", synced_at: NOW, published: after.published }] });
  const row = { database: "decisions", page_id: "6a7b0000-0000-4000-8000-0000000000dd", last_edited: NOW, properties: { Name: "Pricing call", "Brain ID": note.id, Lifecycle: "Draft", ...Object.fromEntries(Object.entries(after.properties as Record<string, { value: unknown }>).map(([name, prop]) => [name, prop.value])) } };
  const plan = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [row] })).json.data;
  assert.deepEqual([plan.conflicts, plan.corrections], [[], []]);
});
