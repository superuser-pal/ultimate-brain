import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { passageHash } from "../src/lib/selection.ts";
import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// CC-207 (spec/cli.md §5.5, eligibility.md §7): `note new` doesn't write a second person or org when the matching one is withheld.
const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const LIVE = `Works on the data platform. ^[src-ex1a3b4c#¶1:${passageHash("A live paragraph.")}]`;
const EXCLUDED = `Was offered 95k. ^[src-ex1a3b4c#¶2:${passageHash("Pricing was 95k.")}]`;

async function noteNew(dir: string, notes: unknown[], ...extra: string[]) {
  const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify({ notes }));
  return brain(["note", "new", "--input", file, "--brain", dir, "--now", NOW, ...extra]);
}

const person = (title: string, extra: Record<string, unknown> = {}, frontmatter: Record<string, unknown> = {}) =>
  ({ type: "person", title, frontmatter: { summary: "Met at the sync.", sources: [SYNC], ...frontmatter }, body: `${title} came to the sync.\n`, ...extra });

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

/** Four notes rest on an input whose paragraph ¶2 the user then excludes: Dana Whitfield and Northwind Labs are withheld whole (a line with no
 *  passage), Ilse Brandt is in the awaiting-cleanup form (a live and an excluded line), Omar Haddad keeps his title and loses his alias. */
async function world(context: TestContext) {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const made = await noteNew(dir, [
    { type: "person", title: "Dana Whitfield", frontmatter: { summary: "Data lead.", sources: ["src-ex1a3b4c"] }, body: `${LIVE}\n\nLeads the Northwind data team.\n` },
    { type: "person", title: "Ilse Brandt", frontmatter: { summary: "Engineer.", aliases: ["Ilse B."], sources: ["src-ex1a3b4c"] }, body: `${LIVE}\n\n${EXCLUDED}\n` },
    { type: "person", title: "Omar Haddad", frontmatter: { summary: "Engineer.", aliases: ["O. Haddad"], sources: ["src-ex1a3b4c"] }, body: `${LIVE}\n` },
    { type: "org", title: "Northwind Labs", frontmatter: { summary: "A data company.", sources: ["src-ex1a3b4c"] }, body: `${LIVE}\n\nA data company in Leeds.\n` },
  ], "--json");
  assert.equal(made.code, 0, made.stdout);
  const [dana, ilse, omar, northwind] = (made.json.data.created as { id: string; path: string }[]);
  await exclude();
  return { dir, dana: dana!, ilse: ilse!, omar: omar!, northwind: northwind! };
}

const cite = (type: string, id: string) => `${type} ${id}, title withheld: awaiting cleanup`;

test("a new person matching one withheld whole is skipped WITHHELD_MATCH with its id and cite only, in a dry run too (CC-207)", async (context) => {
  const { dir, dana } = await world(context);
  for (const dry of [["--dry-run"], []]) {
    const run = await noteNew(dir, [person("Dana Whitfield")], "--json", ...dry);
    assert.equal(run.code, 0, run.stdout);
    assert.deepEqual(run.json.data.created, []);
    assert.deepEqual(run.json.data.skipped, [{ input_index: 0, reason: "WITHHELD_MATCH", existing: dana.id, cite: cite("person", dana.id) }]);
    // Nothing of the withheld note: not its path, its body or its file name.
    assert.ok(!run.stdout.includes(dana.path) && !run.stdout.includes("Northwind data") && !run.stdout.includes("dana-whitfield"), run.stdout);
  }
  assert.equal(await exists(join(dir, "knowledge/people/dana-whitfield-2.md")), false);
  const human = await noteNew(dir, [person("Dana Whitfield")]);
  assert.equal(human.stdout, `skipped notes[0]: matches person ${dana.id}, which awaits cleanup; not created again\n`);

  // The answer surface still shows nothing: the rule adds nothing to `brain query`.
  const candidates = await brain(["query", "--candidates", "Dana Whitfield", "--types", "person", "--brain", dir, "--json"]);
  assert.ok(!candidates.json.data.candidates.some((c: { id: string }) => c.id === dana.id), candidates.stdout);
  const read = await brain(["query", "--read", dana.id, "--brain", dir, "--json"]);
  assert.deepEqual(read.json.data.notes, [{ id: dana.id, status: "withheld", reason: "restricted" }]);
});

test("an awaiting-cleanup person matches by title and by alias; an org by its own type only (CC-207)", async (context) => {
  const { dir, ilse, northwind } = await world(context);
  const run = await noteNew(dir, [
    person("Ilse Brandt"),
    person("I. Brandt", {}, { aliases: ["Ilse B."] }),
    { type: "org", title: "Northwind Labs", frontmatter: { summary: "A data company.", sources: [SYNC] }, body: "Came up at the sync.\n" },
    person("Northwind Labs"),
  ], "--json", "--dry-run");
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.skipped, [
    { input_index: 0, reason: "WITHHELD_MATCH", existing: ilse.id, cite: cite("person", ilse.id) },
    { input_index: 1, reason: "WITHHELD_MATCH", existing: ilse.id, cite: cite("person", ilse.id) },
    { input_index: 2, reason: "WITHHELD_MATCH", existing: northwind.id, cite: cite("org", northwind.id) },
  ]);
  // A person is not compared with an org of the same name.
  assert.deepEqual(run.json.data.created.map((note: { type: string; path: string }) => [note.type, note.path]), [["person", "knowledge/people/northwind-labs.md"]]);
  const human = await noteNew(dir, [{ type: "org", title: "Northwind Labs", frontmatter: { summary: "A data company.", sources: [SYNC] }, body: "x\n" }], "--dry-run");
  assert.equal(human.stdout, `skipped notes[0]: matches org ${northwind.id}, which awaits cleanup; not created again\n`);
});

test("a withheld alias of a note whose title is shown matches without cite; a shown name is not compared (CC-207)", async (context) => {
  const { dir, omar } = await world(context);
  const run = await noteNew(dir, [person("O. Haddad"), person("Omar Haddad")], "--json", "--dry-run");
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.skipped, [{ input_index: 0, reason: "WITHHELD_MATCH", existing: omar.id }]);
  // The title is what `brain query` shows: the ingest matches it there, and this rule leaves it to the ingest.
  assert.deepEqual(run.json.data.created.map((note: { path: string }) => note.path), ["knowledge/people/omar-haddad-2.md"]);
  const read = await brain(["query", "--read", omar.id, "--brain", dir, "--json"]);
  assert.equal(read.json.data.notes[0].title, "Omar Haddad");
  assert.equal(read.json.data.notes[0].frontmatter.aliases, undefined);
});

test("distinct_from writes the item when the user says it is someone else; a bad one is INPUT_INVALID (CC-207)", async (context) => {
  const { dir, dana, northwind } = await world(context);
  const written = await noteNew(dir, [person("Dana Whitfield", { distinct_from: [dana.id] })], "--json");
  assert.equal(written.code, 0, written.stdout);
  assert.deepEqual(written.json.data.skipped, []);
  assert.deepEqual(written.json.data.created.map((note: { path: string }) => note.path), ["knowledge/people/dana-whitfield-2.md"]);
  const { parseFrontmatter } = await import("../src/lib/frontmatter.ts");
  const { readFile } = await import("node:fs/promises");
  const file = parseFrontmatter(await readFile(join(dir, "knowledge/people/dana-whitfield-2.md"), "utf8"));
  assert.equal(file.attributes.distinct_from, undefined, "distinct_from is not written to the file");

  const bad: Array<[unknown, string]> = [
    [person("Dana Whitfield", { distinct_from: ["per-zzzzzzzz"] }), "/notes/0/distinct_from/0"],
    [person("Dana Whitfield", { distinct_from: [northwind.id] }), "/notes/0/distinct_from/0"],
    [person("Dana Whitfield", { distinct_from: [] }), "/notes/0/distinct_from"],
    [{ type: "decision", title: "Hire a data lead", frontmatter: { summary: "Hire a data lead.", date: "2026-12-10", assessment: "provisional", sources: [SYNC] }, body: "## Decision\nHire.\n", distinct_from: [dana.id] }, "/notes/0/distinct_from"],
  ];
  for (const [item, pointer] of bad) {
    const run = await noteNew(dir, [item], "--json", "--dry-run");
    assert.equal(run.json.error?.code, "INPUT_INVALID", run.stdout);
    assert.ok(run.json.error.details.some((detail: { pointer: string }) => detail.pointer === pointer), run.stdout);
  }
});

test("an item referencing the skipped person's input id is an error, so the skill uses existing in its place (CC-207)", async (context) => {
  const { dir, dana } = await world(context);
  const meeting = (attendee: string) => ({
    type: "meeting", title: "Northwind kickoff",
    frontmatter: { summary: "Kickoff.", date: "2026-12-10", attendees: [attendee], source: "src-4m9q2x7c", sources: ["src-4m9q2x7c"] },
    body: "## Summary\nKickoff with Dana Whitfield.\n",
  });
  const source = { type: "source", id: "src-4m9q2x7c", title: "Northwind kickoff (Notion minutes)", file_date: "2026-12-10", frontmatter: { source_key: "notion:21111111-2222-4333-8444-555555555555" }, body: "## Summary\nKickoff.\n" };
  const refused = await noteNew(dir, [source, person("Dana Whitfield", { id: "per-4k8m2q7x" }), meeting("per-4k8m2q7x")], "--json", "--dry-run");
  assert.equal(refused.json.error?.code, "INPUT_INVALID", refused.stdout);
  assert.ok(refused.json.error.details.some((detail: { message: string }) => detail.message.includes("per-4k8m2q7x")), refused.stdout);
  const linked = await noteNew(dir, [source, meeting(dana.id)], "--json");
  assert.equal(linked.code, 0, linked.stdout);
});

test("without suppressions nothing is compared, and an unreadable record fails a batch with a person (CC-207)", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, [person("Maria López")], "--json", "--dry-run");
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.created.map((note: { path: string }) => note.path), ["knowledge/people/maria-lopez-2.md"]);

  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", "broken.json"), "{");
  const failed = await noteNew(dir, [person("Maria López")], "--json", "--dry-run");
  assert.equal(failed.code, 5, failed.stdout);
  assert.equal(failed.json.error.code, "SUPPRESSIONS_UNREADABLE");
  const decision = await noteNew(dir, [{ type: "decision", title: "Hire a data lead", frontmatter: { summary: "Hire a data lead.", date: "2026-12-10", assessment: "provisional", sources: [SYNC] }, body: "## Decision\nHire.\n" }], "--json", "--dry-run");
  assert.equal(decision.code, 0, decision.stdout);
});

test("an approved new_item is the user's own and is written as before (CC-207)", async (context) => {
  const { dir } = await world(context);
  const { serializeNewFile } = await import("../src/lib/frontmatter.ts");
  const proposal = "_proposals/2026-12-10-prp-0a1b2c3d.md";
  await writeFile(join(dir, proposal), serializeNewFile({
    id: "prp-0a1b2c3d", type: "proposal", title: "New person: Dana Whitfield", created: "2026-12-10", updated: "2026-12-10", why: "w", source: SYNC,
    status: "pending", kind: "new_item", note: person("Dana Whitfield"),
  }, ""));
  const file = join(dir, "..", "decisions.json");
  await writeFile(file, JSON.stringify({ decisions: [{ proposal: "prp-0a1b2c3d", action: "approve", decided_at: NOW, decided_by: "chat" }] }));
  const run = await brain(["apply", "--input", file, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.decisions[0].result, "applied", run.stdout);
  assert.ok(run.json.data.decisions[0].changed.includes("knowledge/people/dana-whitfield-2.md"), run.stdout);
  // A new_item's note does not take distinct_from (cli §5.5).
  const { checkNoteInput } = await import("../src/lib/note-new.ts");
  assert.deepEqual(checkNoteInput(person("Dana Whitfield", { distinct_from: ["per-3k8m2q7x"] }), "/note", false).map((problem) => problem.pointer), ["/note/distinct_from"]);
});
