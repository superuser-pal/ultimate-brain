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
    created: [{ id: created.id, kind: "update_fact", title: "Acme budget: 80k → 95k", target: "prj-9x4t1b7e", path: "_proposals/2026-12-10-acme-budget-80k-95k.md", before: "80000 EUR", input_indexes: [0] }],
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

test("add_link validates its target field and reference prefix, then skips after approval", async (context) => {
  const dir = await fixtureCopy(context);
  const link = {
    kind: "add_link", title: "Add Acme Web alias", target: "prj-9x4t1b7e", field: "aliases", after: "Acme Web",
    why: "The team uses this name.", source: "mtg-8c4n2p7w",
  };
  const created = await proposalNew(dir, [link]);
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id;
  const decisions = join(dir, "..", "decisions.json");
  await writeFile(decisions, JSON.stringify({ decisions: [{ proposal: id, action: "approve", decided_at: NOW, decided_by: "chat" }] }));
  const applied = await brain(["apply", "--brain", dir, "--now", NOW, "--input", decisions, "--json"]);
  assert.equal(applied.code, 0, applied.stdout);
  assert.deepEqual(applied.json.data.decisions[0].changed, [created.json.data.created[0].path, "projects/acme-website/project.md"]);

  const rerun = await proposalNew(dir, [link]);
  assert.equal(rerun.code, 0, rerun.stdout);
  assert.deepEqual(rerun.json.data, { created: [], skipped: [{ input_index: 0, reason: "ALREADY_LINKED" }], dry_run: false });

  const badField = await proposalNew(dir, [{ ...link, field: "attendees" }]);
  assert.equal(badField.json.error.code, "INPUT_INVALID");
  assert.equal(badField.json.error.details[0].pointer, "/proposals/0/field");
  const badPrefix = await proposalNew(dir, [{ ...link, field: "people", after: "org-6d1f9z3k" }]);
  assert.equal(badPrefix.json.error.code, "INPUT_INVALID");
  assert.equal(badPrefix.json.error.details[0].pointer, "/proposals/0/after");
  const linkedButForbidden = await proposalNew(dir, [{ ...link, target: "mtg-8c4n2p7w", field: "decisions", after: "dec-7k2m9q4x" }]);
  assert.equal(linkedButForbidden.json.error.code, "INPUT_INVALID");
  assert.equal(linkedButForbidden.json.error.details[0].pointer, "/proposals/0/field");
});

test("proposal new groups links and apply excludes one link", async (context) => {
  const dir = await fixtureCopy(context);
  const links = ["Acme Web", "Acme marketing"].map((after) => ({
    kind: "add_link", title: `Add ${after}`, target: "prj-9x4t1b7e", field: "aliases", after,
    why: "The team uses this name.", source: "mtg-8c4n2p7w",
  }));
  const created = await proposalNew(dir, links);
  assert.equal(created.code, 0, created.stdout);
  assert.equal(created.json.data.created.length, 1);
  const proposal = created.json.data.created[0];
  assert.deepEqual(proposal.input_indexes, [0, 1]);
  assert.equal(proposal.title, "Acme website: add 2 aliases (Acme Web, Acme marketing)");
  const input = join(dir, "..", "grouped-decision.json");
  await writeFile(input, JSON.stringify({ decisions: [{ proposal: proposal.id, action: "approve", exclude: [{ field: "aliases", value: "Acme marketing" }], decided_at: NOW, decided_by: "chat" }] }));
  const applied = await brain(["apply", "--brain", dir, "--now", NOW, "--input", input, "--json"]);
  assert.equal(applied.code, 0, applied.stdout);
  const project = await readFile(join(dir, "projects/acme-website/project.md"), "utf8");
  assert.match(project, /aliases: \[acme site, Acme Web\]/);
  assert.doesNotMatch(project, /Acme marketing/);
});

test("proposal new skips a duplicate link in its own input", async (context) => {
  const dir = await fixtureCopy(context);
  const link = { kind: "add_link", title: "Add Acme Web", target: "prj-9x4t1b7e", field: "aliases", after: "Acme Web", why: "The team uses this name.", source: "mtg-8c4n2p7w" };
  const run = await proposalNew(dir, [link, link]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.created.length, 1);
  assert.deepEqual(run.json.data.created[0].input_indexes, [0]);
  assert.deepEqual(run.json.data.skipped.map((item: { input_index: number; reason: string; existing?: string }) => [item.input_index, item.reason, item.existing !== undefined]), [[1, "DUPLICATE_PENDING", true]]);
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

test("proposal new handles review edge cases from #14", async (context) => {
  const dir = await fixtureCopy(context);
  // A field named like an Object prototype key is just a new fact.
  const proto = await proposalNew(dir, [{ ...budget, field: "constructor" }], "--dry-run");
  assert.equal(proto.code, 0, proto.stdout);
  assert.equal(proto.json.data.created[0].before, undefined);
  assert.deepEqual(Object.keys(proto.json.data.created[0]), ["id", "kind", "title", "target", "path", "input_indexes"]);

  // A new_item whose note is an already-captured source is refused, not silently accepted.
  const source = await readFile(join(dir, "sources/notion/2026-12-03-acme-sync-notion-minutes.md"), "utf8");
  const body = source.slice(source.indexOf("---\n", 4) + 4);
  const dup = await proposalNew(dir, [{ kind: "new_item", title: "Again", why: "w", source: "mtg-8c4n2p7w", note: { type: "source", title: "Again", frontmatter: { source_key: "notion:x" }, body } }]);
  assert.equal(dup.json.error.code, "INPUT_INVALID");
  assert.equal(dup.json.error.details[0].pointer, "/proposals/0/note");

  // An error in an earlier item is reported against that item, not a later new_item.
  const note = { type: "concept", title: "Edge caching", frontmatter: { summary: "S.", sources: ["mtg-8c4n2p7w"] }, body: "" };
  const blame = await proposalNew(dir, [{ ...budget, after: undefined }, { kind: "new_item", title: "New concept", why: "w", source: "mtg-8c4n2p7w", note }]);
  assert.equal(blame.json.error.code, "INPUT_INVALID");
  assert.deepEqual(blame.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/proposals/0"]);

  // A source naming a note that does not exist is UNKNOWN_ID; sources, views and proposals are not targets.
  const unknownSource = await proposalNew(dir, [{ ...budget, source: "mtg-22222222" }]);
  assert.equal(unknownSource.json.error.code, "UNKNOWN_ID");
  assert.equal(unknownSource.json.error.details[0].pointer, "/proposals/0/source");
  const sourceTarget = await proposalNew(dir, [{ kind: "add_to_note", title: "x", target: "src-7w3c9k5m", content: "c", why: "w", source: "mtg-8c4n2p7w" }]);
  assert.equal(sourceTarget.json.error.code, "INPUT_INVALID");
  assert.equal(sourceTarget.json.error.details[0].pointer, "/proposals/0/target");
  const badId = await proposalNew(dir, [{ kind: "merge", title: "x", target: "per-9t2c6m4a", merge_into: 5, why: "w", source: "mtg-8c4n2p7w" }]);
  assert.equal(badId.json.error.code, "INPUT_INVALID");

  const trailing = await brain(["proposal", "list", "--status", "pending,", "--brain", dir, "--json"]);
  assert.equal(trailing.code, 0, trailing.stdout);
});
