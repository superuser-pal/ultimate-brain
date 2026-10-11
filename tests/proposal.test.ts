import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";

async function proposalNew(dir: string, proposals: unknown, ...extra: string[]) {
  const file = join(dir, "..", "input.json");
  await writeFile(file, JSON.stringify({ proposals }));
  return brain(["proposal", "new", "--input", file, "--brain", dir, "--now", NOW, "--json", ...extra]);
}

const budget = {
  kind: "update_fact", title: "Acme budget: 80k → 95k", target: "prj-9x4t1b7e", field: "budget",
  after: "95000 EUR", why: "Budget raised to 95k.", source: "mtg-8c4n2p7w",
};

test("proposal new writes an update_fact with before and from filled in, and logs it", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await proposalNew(dir, [budget]);
  assert.equal(run.code, 0, run.stdout);
  const [created] = run.json.data.created;
  assert.match(created.id, /^prp-[0-9a-hjkmnp-tv-z]{8}$/);
  assert.deepEqual(run.json.data, {
    created: [{ id: created.id, kind: "update_fact", title: "Acme budget: 80k → 95k", target: "prj-9x4t1b7e", path: "_proposals/2026-12-10-acme-budget-80k-95k.md", before: "80000 EUR" }],
    skipped: [],
    dry_run: false,
  });
  assert.equal(
    await readFile(join(dir, created.path), "utf8"),
    `---
id: ${created.id}
type: proposal
title: "Acme budget: 80k → 95k"
created: 2026-12-10
updated: 2026-12-10
kind: update_fact
target: prj-9x4t1b7e
field: budget
before: 80000 EUR
after: 95000 EUR
from: 2026-12-03
why: Budget raised to 95k.
source: mtg-8c4n2p7w
status: pending
---
`,
  );
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.ok(log.endsWith(`- ${NOW} proposal-new ${created.id} "Acme budget: 80k → 95k" kind=update_fact target=prj-9x4t1b7e\n`));
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});

test("a new fact has no before; from defaults to today without a source meeting", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await proposalNew(dir, [{ ...budget, field: "deadline", after: "2027-03-31", source: "notion:11111111-2222-4333-8444-555555555555" }]);
  assert.equal(run.code, 0, run.stdout);
  const text = await readFile(join(dir, run.json.data.created[0].path), "utf8");
  assert.doesNotMatch(text, /^before:/m);
  assert.match(text, /^from: 2026-12-10$/m);
});

test("proposal new refuses a stale before, a missing target and a contradiction of an absent fact", async (context) => {
  const dir = await fixtureCopy(context);
  const stale = await proposalNew(dir, [{ ...budget, before: "70000 EUR" }]);
  assert.equal(stale.code, 4);
  assert.equal(stale.json.error.code, "BEFORE_MISMATCH");

  const unknown = await proposalNew(dir, [{ ...budget, target: "prj-00000000" }]);
  assert.equal(unknown.json.error.code, "UNKNOWN_ID");
  assert.equal(unknown.json.error.details[0].pointer, "/proposals/0/target");

  const absent = await proposalNew(dir, [{ ...budget, kind: "contradiction", field: "deadline", before: "2027-01-01" }]);
  assert.equal(absent.json.error.code, "INPUT_INVALID");
  assert.equal(absent.json.error.details[0].pointer, "/proposals/0/field");

  assert.deepEqual((await readdir(join(dir, "_proposals"))).length, 4, "nothing written");
});

test("proposal new checks supersede and merge targets", async (context) => {
  const dir = await fixtureCopy(context);
  const base = { title: "x", why: "w", source: "mtg-8c4n2p7w" };
  const already = await proposalNew(dir, [{ ...base, kind: "supersede", target: "dec-7k2m9q4x", supersedes: "dec-2p9f6h1r" }]);
  assert.equal(already.json.error.code, "INPUT_INVALID");
  assert.match(already.json.error.message, /already superseded/);

  const types = await proposalNew(dir, [{ ...base, kind: "merge", target: "per-3h8w2n6c", merge_into: "org-6d1f9z3k" }]);
  assert.equal(types.json.error.code, "INPUT_INVALID");
  const self = await proposalNew(dir, [{ ...base, kind: "merge", target: "per-3h8w2n6c", merge_into: "per-3h8w2n6c" }]);
  assert.equal(self.json.error.code, "INPUT_INVALID");

  const merge = await proposalNew(dir, [{ ...base, kind: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c" }]);
  assert.equal(merge.code, 0, merge.stdout);
});

test("proposal new skips duplicates of pending proposals, in the brain and in the batch", async (context) => {
  const dir = await fixtureCopy(context);
  const relaunch = {
    kind: "add_to_note", title: "Acme mobile relaunch (again)", target: "org-6d1f9z3k",
    content: "Acme plans to relaunch its mobile app in 2027.", why: "Said again.", source: "mtg-8c4n2p7w",
  };
  const run = await proposalNew(dir, [relaunch, budget, { ...budget, title: "Same change, other words" }]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.created.length, 1);
  assert.deepEqual(run.json.data.skipped, [
    { input_index: 0, reason: "DUPLICATE_PENDING", existing: "prp-9d3f7h2k" },
    { input_index: 2, reason: "DUPLICATE_PENDING", existing: run.json.data.created[0].id },
  ]);
});

test("a new_item may name an existing meeting, which apply will update; its note must otherwise be valid", async (context) => {
  const dir = await fixtureCopy(context);
  const meeting = await readFile(join(dir, "knowledge/meetings/2026-12-03-acme-sync.md"), "utf8");
  const note = {
    type: "decision", title: "Keep the blog on the main domain",
    frontmatter: { summary: "Blog stays on acme.example.", date: "2026-12-03", assessment: "provisional", decided_in: "mtg-8c4n2p7w", sources: ["mtg-8c4n2p7w"] },
    body: "## Decision\nKeep the blog on the main domain.\n",
  };
  const run = await proposalNew(dir, [{ kind: "new_item", title: "New decision: blog domain", note, why: "w", source: "mtg-8c4n2p7w" }]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.created[0].target, undefined);
  assert.equal(await readFile(join(dir, "knowledge/meetings/2026-12-03-acme-sync.md"), "utf8"), meeting, "the meeting is not touched yet");
  assert.match(await readFile(join(dir, run.json.data.created[0].path), "utf8"), /^note:\n {2}type: decision\n/m);

  const broken = await proposalNew(dir, [{ kind: "new_item", title: "Broken", note: { ...note, frontmatter: { ...note.frontmatter, projects: ["prj-00000000"] } }, why: "w", source: "mtg-8c4n2p7w" }]);
  assert.equal(broken.json.error.code, "INPUT_INVALID");
  assert.equal(broken.json.error.details[0].pointer, "/proposals/0/note");
  assert.match(broken.json.error.details[0].message, /^missing-ref/);

  const shape = await proposalNew(dir, [{ kind: "new_item", title: "Bad", target: "per-3h8w2n6c", note: { ...note, id: "dec-3f7k9m2q" }, why: "w", source: "s" }]);
  assert.deepEqual(shape.json.error.details.map((detail: { pointer: string }) => detail.pointer).sort(), ["/proposals/0/note/id", "/proposals/0/target"]);
});

test("proposal new validates the proposal schema and input keys", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await proposalNew(dir, [{ ...budget, status: "approved", kind: "rename" }, { ...budget, field: "Not A Key" }]);
  assert.equal(run.code, 4);
  assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/proposals/0/status", "/proposals/0/kind"]);
});

test("proposal new --dry-run writes nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await proposalNew(dir, [budget], "--dry-run");
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.dry_run, true);
  assert.equal((await readdir(join(dir, "_proposals"))).length, 4);
});

test("proposal list filters by status and target and sorts by created then id", async (context) => {
  const dir = await fixtureCopy(context);
  const all = await brain(["proposal", "list", "--brain", dir, "--json"]);
  assert.equal(all.code, 0, all.stdout);
  assert.deepEqual(all.json.data.proposals.map((proposal: { id: string }) => proposal.id), ["prp-1q5w8e3r", "prp-4n8c2w7t", "prp-6t2m9c4k", "prp-9d3f7h2k"]);

  const pending = await brain(["proposal", "list", "--status", "pending,closed", "--brain", dir, "--json"]);
  assert.deepEqual(pending.json.data.proposals, [{
    id: "prp-9d3f7h2k", type: "proposal", title: "Acme: mobile app relaunch planned for 2027", created: "2026-12-03", updated: "2026-12-03",
    kind: "add_to_note", target: "org-6d1f9z3k", content: "Acme plans to relaunch its mobile app in 2027.",
    why: "Mobile app relaunch planned for 2027.", source: "mtg-8c4n2p7w", status: "pending",
    notion: "2f3a4b5c-6d7e-4f8a-9b0c-1d2e3f4a5b6c", path: "_proposals/2026-12-03-acme-mobile-app-relaunch.md",
  }]);

  const target = await brain(["proposal", "list", "--target", "per-3h8w2n6c", "--brain", dir, "--json"]);
  assert.deepEqual(target.json.data.proposals.map((proposal: { id: string }) => proposal.id), ["prp-6t2m9c4k"]);

  const bad = await brain(["proposal", "list", "--status", "open", "--brain", dir, "--json"]);
  assert.equal(bad.code, 2);
});
