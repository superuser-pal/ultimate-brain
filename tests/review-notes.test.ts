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
