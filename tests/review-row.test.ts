import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
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
