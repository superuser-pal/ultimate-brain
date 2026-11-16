import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { passageHash } from "../src/lib/selection.ts";
import { brain, fixtureCopy } from "./helpers.ts";

// Your Notion edits to brain-owned values are asked in the session (0.16.0, decision 0101 §4; cli §5.14.2, §5.14.3, §5.14.4, §5.7).
// Synthetic brain (tests/fixtures/brain-acme) and a simulated Notion snapshot.

const NOW = "2026-12-10T09:00:00Z";
const EDITED = "2026-12-10T08:00:00Z";
const PROJECT = "prj-9x4t1b7e";
const PROJECT_PATH = "projects/acme-website/project.md";
const PROJECT_PAGE = "2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e";
const MARIA = "per-3h8w2n6c";
const MARIA_PAGE = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const SUMMARY = "Rebuild of Acme's marketing website, launching February 2027.";
const KEY_FACTS = "Budget: 80000 EUR · Launch date: 2027-02";

let counter = 0;
async function file(dir: string, value: unknown): Promise<string> {
  const path = join(dir, "..", `input-${counter += 1}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}

async function edit(dir: string, path: string, change: (attributes: Record<string, unknown>) => void): Promise<void> {
  const target = join(dir, path);
  const document = parseFrontmatter(await readFile(target, "utf8"));
  change(document.attributes);
  await writeFile(target, serializeFrontmatter(document));
}

const attributes = async (dir: string, path: string) => parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes;

/** The project as last published: S holds what Notion shows. */
async function published(dir: string): Promise<void> {
  await edit(dir, PROJECT_PATH, (a) => { a.notion_published = { Name: "Acme website", Summary: SUMMARY, "Key Facts": KEY_FACTS, "Brain ID": PROJECT }; });
}

const projectRow = (properties: Record<string, unknown>) => ({ database: "projects", page_id: PROJECT_PAGE, last_edited: EDITED, properties: { "Brain ID": PROJECT, Name: "Acme website", Summary: SUMMARY, "Key Facts": KEY_FACTS, ...properties } });
const plan = async (dir: string, rows: unknown[]) => {
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await file(dir, { as_of: NOW, rows }), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  return run.json.data;
};
const syncApply = async (dir: string, data: unknown, flags: string[] = []) => {
  const run = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await file(dir, data), ...flags, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  return run.json.data;
};
const waiting = async (dir: string) => (await brain(["proposal", "list", "--waiting", "--brain", dir, "--json"])).json.data.waiting as Array<Record<string, unknown>>;
const decide = async (dir: string, decisions: unknown[]) => brain(["apply", "--brain", dir, "--now", NOW, "--input", await file(dir, { decisions }), "--json"]);
const renderProject = async (dir: string, extra: string[] = []) => {
  const run = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--ids", PROJECT, ...extra, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  return run.json.data.items[0] as { properties: Record<string, { value: unknown }>; published: Record<string, unknown> } | undefined;
};

test("a key fact and a Summary edited in Notion become pending corrections; nothing in Git changes until apply (0101 §4)", async (context) => {
  const dir = await fixtureCopy(context);
  await published(dir);
  const before = await readFile(join(dir, PROJECT_PATH), "utf8");
  const edited = projectRow({ Summary: "Rebuild of Acme's website, launching March 2027.", "Key Facts": "Budget: 80000 EUR · Launch date: 2027-03" });
  const data = await plan(dir, [edited]);
  assert.deepEqual(data.corrections, [
    { target: PROJECT, field: "facts.launch_date", value: "2027-03", before: "2027-02", observed_at: EDITED, database: "projects", page_id: PROJECT_PAGE, property: "Key Facts/launch_date", notion_value: "2027-03" },
    { target: PROJECT, field: "summary", value: "Rebuild of Acme's website, launching March 2027.", before: SUMMARY, observed_at: EDITED, database: "projects", page_id: PROJECT_PAGE, property: "Summary", notion_value: "Rebuild of Acme's website, launching March 2027." },
  ]);
  assert.deepEqual([data.updates, data.conflicts, data.withdrawn], [[], [], []]);

  const applied = await syncApply(dir, data);
  assert.deepEqual(applied.corrections.map((item: Record<string, unknown>) => [item.field, item.result, typeof item.proposal]), [["facts.launch_date", "written", "string"], ["summary", "written", "string"]]);
  assert.equal(applied.summary.written, 2);
  assert.equal(await readFile(join(dir, PROJECT_PATH), "utf8"), before, "the project is not changed by sync apply");
  const proposal = await attributes(dir, (await waiting(dir)).find((entry) => entry.field === "facts.launch_date")!.path as string);
  assert.deepEqual({ ...proposal, created: undefined, updated: undefined, id: undefined }, {
    id: undefined, type: "proposal", created: undefined, updated: undefined, kind: "notion_correction", title: "Acme website: Key Facts/launch_date → 2027-03",
    target: PROJECT, field: "facts.launch_date", before: "2027-02", after: "2027-03", database: "projects", page: PROJECT_PAGE, property: "Key Facts/launch_date",
    notion_value: "2027-03", observed_at: EDITED, why: "Key Facts/launch_date edited in Notion", source: `notion:${PROJECT_PAGE}`, status: "pending",
  });
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.errors, 0);

  // The next plan finds them waiting, and render leaves your edits in Notion while they wait, out of `published` too.
  const again = await plan(dir, [edited]);
  assert.deepEqual([again.corrections, again.withdrawn], [[], []]);
  const item = await renderProject(dir);
  assert.ok(item === undefined || (!("Summary" in item.properties) && !("Key Facts" in item.properties) && !("Summary" in item.published) && !("Key Facts" in item.published)), JSON.stringify(item));

  // Every correction is listed first, together, in group 1 (cli §5.6).
  const list = await waiting(dir);
  assert.deepEqual(list.slice(0, 2).map((entry) => [entry.kind, entry.group]), [["notion_correction", 1], ["notion_correction", 1]]);
});

test("an accepted key fact writes its notion-edit timeline entry; a rejected Summary is rendered back by sync render (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  await published(dir);
  const newSummary = "Rebuild of Acme's website, launching March 2027.";
  await syncApply(dir, await plan(dir, [projectRow({ Summary: newSummary, "Key Facts": "Budget: 80000 EUR · Launch date: 2027-03" })]));
  const list = await waiting(dir);
  const fact = list.find((entry) => entry.field === "facts.launch_date");
  const summary = list.find((entry) => entry.field === "summary");

  const run = await decide(dir, [
    { proposal: fact!.id, action: "approve", note: "accept all except b", decided_at: NOW, decided_by: "chat" },
    { proposal: summary!.id, action: "reject", note: "accept all except b", decided_at: NOW, decided_by: "chat" },
  ]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.decisions.map((item: Record<string, unknown>) => [item.kind, item.result]), [["notion_correction", "applied"], ["notion_correction", "closed"]]);
  const project = await attributes(dir, PROJECT_PATH);
  assert.equal((project.facts as Record<string, unknown>).launch_date, "2027-03");
  assert.equal(project.summary, SUMMARY, "a rejected correction leaves the brain's value");
  const timeline = project.timeline as Array<Record<string, unknown>>;
  assert.deepEqual(timeline.at(-1), { field: "launch_date", value: "2027-03", from: "2026-12-10", learned: "2026-12-10", source: "notion-edit", assessment: "accepted" });
  assert.deepEqual(timeline.filter((entry) => entry.field === "launch_date" && entry.value === "2027-02").map((entry) => entry.assessment), ["superseded"]);
  // S follows the decision: the key's S is Notion's value, Summary's S is the rejected edit.
  assert.deepEqual(project.notion_published, { Name: "Acme website", Summary: newSummary, "Key Facts": "Budget: 80000 EUR · Launch date: 2027-03", "Brain ID": PROJECT });
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.errors, 0);

  // The next publish puts the brain's Summary back over the rejected edit, and sends no Key Facts: Notion already shows them.
  const item = await renderProject(dir);
  assert.equal(item!.properties.Summary!.value, SUMMARY);
  assert.equal(item!.properties["Key Facts"], undefined);
});

test("an unattended run leaves both corrections pending: written, never applied, never decided (0096 §4, cli §6.1)", async (context) => {
  const dir = await fixtureCopy(context);
  await published(dir);
  const before = await readFile(join(dir, PROJECT_PATH), "utf8");
  const data = await plan(dir, [projectRow({ Summary: "Rebuilt by an automation.", "Key Facts": "Budget: 80000 EUR · Launch date: 2027-04" })]);
  const applied = await syncApply(dir, data, ["--skip-conflicted", "--record-only"]);
  assert.deepEqual(applied.corrections.map((item: Record<string, unknown>) => item.result), ["written", "written"]);
  // The unattended catch-up then applies what was decided before; nothing here was decided.
  const nothing = await brain(["apply", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(nothing.code, 0, nothing.stdout);
  assert.deepEqual(nothing.json.data.decisions, []);
  assert.equal(await readFile(join(dir, PROJECT_PATH), "utf8"), before);
  assert.deepEqual((await waiting(dir)).filter((entry) => entry.kind === "notion_correction").map((entry) => entry.status), ["pending", "pending"]);
});

test("a waiting correction is updated when edited again, and withdrawn when set back or when the brain's value moves (cli §5.14.2)", async (context) => {
  const dir = await fixtureCopy(context);
  await edit(dir, "knowledge/people/maria-lopez.md", (a) => { a.notion_published = { Name: "Maria López", Summary: a.summary, Role: "Product Manager", "Brain ID": MARIA }; });
  const row = (role: string) => ({ database: "people", page_id: MARIA_PAGE, last_edited: EDITED, properties: { "Brain ID": MARIA, Role: role } });
  await syncApply(dir, await plan(dir, [row("Product lead")]));
  const first = (await waiting(dir))[0]!;
  assert.equal(first.after, "Product lead");

  // Edited again: the same proposal gets the new value, still one question.
  const again = await plan(dir, [{ ...row("Head of product"), last_edited: "2026-12-10T08:30:00Z" }]);
  assert.deepEqual(again.corrections.map((item: Record<string, unknown>) => [item.value, item.proposal]), [["Head of product", first.id]]);
  const updated = await syncApply(dir, again);
  assert.deepEqual(updated.corrections.map((item: Record<string, unknown>) => [item.result, item.proposal]), [["updated", first.id]]);
  const now = (await waiting(dir)).filter((entry) => entry.kind === "notion_correction");
  assert.deepEqual(now.map((entry) => [entry.id, entry.after, entry.observed_at, entry.title]), [[first.id, "Head of product", "2026-12-10T08:30:00Z", "Maria López: Role → Head of product"]]);

  // Set back in Notion: withdrawn, closed with no decision.
  const back = await plan(dir, [row("Product Manager")]);
  assert.deepEqual([back.corrections, back.withdrawn], [[], [{ proposal: first.id, reason: "SET_BACK" }]]);
  const closed = await syncApply(dir, back);
  assert.deepEqual(closed.withdrawn.map((item: Record<string, unknown>) => [item.proposal, item.result]), [[first.id, "withdrawn"]]);
  const record = await attributes(dir, first.path as string);
  assert.deepEqual([record.status, record.closed_reason, record.decision], ["closed", "withdrawn", undefined]);
  assert.equal((await brain(["lint", "--brain", dir, "--json"])).json.data.errors, 0);

  // A new edit, then the brain's value moves (an ingest changed the role): withdrawn, and the property is a conflict, not a correction.
  await syncApply(dir, await plan(dir, [row("Product lead")]));
  const second = (await waiting(dir))[0]!;
  await edit(dir, "knowledge/people/maria-lopez.md", (a) => { a.facts = { role: "Chief product officer" }; });
  const moved = await plan(dir, [row("Product lead")]);
  assert.deepEqual(moved.withdrawn, [{ proposal: second.id, reason: "BRAIN_CHANGED" }]);
  assert.deepEqual(moved.conflicts.map((item: Record<string, unknown>) => [item.code, item.property]), [["BOTH_CHANGED", "Role"]]);
  assert.deepEqual(moved.corrections, []);
});

test("a fixed correction applies your value with user-correction provenance; a stale one is closed; a reference correction sets the id (cli §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  await edit(dir, "knowledge/people/maria-lopez.md", (a) => { a.notion_published = { Role: "Product Manager", "Brain ID": MARIA }; });
  await syncApply(dir, await plan(dir, [{ database: "people", page_id: MARIA_PAGE, last_edited: EDITED, properties: { "Brain ID": MARIA, Role: "Product lead" } }]));
  const proposal = (await waiting(dir))[0]!;
  const fixed = await decide(dir, [{ proposal: proposal.id, action: "fix", note: "a, but Head of product", fixes: [{ value: "Head of product" }], decided_at: NOW, decided_by: "chat" }]);
  assert.equal(fixed.code, 0, fixed.stdout);
  assert.equal(fixed.json.data.decisions[0].result, "applied");
  const maria = await attributes(dir, "knowledge/people/maria-lopez.md");
  assert.equal((maria.facts as Record<string, unknown>).role, "Head of product");
  assert.equal((maria.timeline as Array<Record<string, unknown>>).at(-1)!.source, `user-correction:${String(proposal.id)}`);
  // S is Notion's value, so the next publish sends your fixed value over the edit.
  assert.equal((maria.notion_published as Record<string, unknown>).Role, "Product lead");

  // A stale correction: the target's value moved before the decision.
  await published(dir);
  await syncApply(dir, await plan(dir, [projectRow({ Summary: "Edited in Notion." })]));
  const stale = (await waiting(dir)).find((entry) => entry.field === "summary")!;
  await edit(dir, PROJECT_PATH, (a) => { a.summary = "Changed by an ingest."; });
  const closed = await decide(dir, [{ proposal: stale.id, action: "approve", note: "accept all", decided_at: NOW, decided_by: "chat" }]);
  assert.deepEqual([closed.json.data.decisions[0].result, closed.json.data.decisions[0].reason], ["closed", "STALE_PROPOSAL"]);
  assert.equal((await attributes(dir, PROJECT_PATH)).summary, "Changed by an ingest.");
});

test("a correction's title names a withheld reference by its cite, never by its title (cli §5.14.3, eligibility.md §6)", async (context) => {
  const dir = await fixtureCopy(context);
  const input = "11111111-2222-4333-8444-555555555555";
  const live = "Globex is a prospect.";
  const secret = "Globex pays 95k a year.";
  const extract = (id: string, version: number, replaces: string | null, paragraphs: Array<[number, string]>) => serializeNewFile({
    id, type: "source", title: `Globex extract v${version}`, source_key: `notion:${input}`, kind: "minutes", extract: true, extract_of: input, extract_version: version,
    ...(replaces === null ? {} : { replaces }), transcript_hash: "a".repeat(64), selection: [{ id: "s1", kind: "summary", anchor: "x", decision: "include" }],
    passages: paragraphs.map(([n, text]) => ({ n, hash: passageHash(text), items: ["s1"] })), captured: "2026-12-01T10:00:00Z", created: "2026-12-01", updated: "2026-12-01",
  }, paragraphs.map(([n, text]) => `<!-- passage ¶${n} item s1 -->\n${text}\n`).join("\n"));
  await mkdir(join(dir, "sources/notion"), { recursive: true });
  await writeFile(join(dir, "sources/notion/2026-12-01-globex-extract-v1.md"), extract("src-ex1a3b4c", 1, null, [[1, live], [2, secret]]));
  const orgPage = "10000000-0000-4000-8000-0000000000f1";
  await writeFile(join(dir, "knowledge/orgs/globex.md"), serializeNewFile({
    id: "org-bbbb0001", type: "org", title: "Globex pays 95k", summary: "s", lifecycle: "reviewed", sources: ["src-ex1a3b4c"], lineage_cleared: [input], notion: orgPage, created: "2026-12-01", updated: "2026-12-01",
  }, `\n${live} ^[src-ex1a3b4c#¶1:${passageHash(live)}]\n${secret} ^[src-ex1a3b4c#¶2:${passageHash(secret)}]\n`));
  await writeFile(join(dir, "sources/notion/2026-12-01-globex-extract-v2.md"), extract("src-ex2a3b4c", 2, "src-ex1a3b4c", [[1, live]]));
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", `${input}.json`), JSON.stringify({ input, records: [{ version: 2, passages: [{ extract_of: input, transcript_hash: "a".repeat(64), n: 2 }], full_copies: [], status: "active" }] }));
  await edit(dir, PROJECT_PATH, (a) => { a.notion_published = { Client: ["6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c"], "Brain ID": PROJECT }; });

  const data = await plan(dir, [{ database: "projects", page_id: PROJECT_PAGE, last_edited: EDITED, properties: { "Brain ID": PROJECT, Client: [orgPage] } }]);
  assert.deepEqual(data.corrections.map((item: Record<string, unknown>) => [item.field, item.value, item.before]), [["client", "org-bbbb0001", "org-6d1f9z3k"]]);
  const applied = await syncApply(dir, data);
  assert.equal(applied.corrections[0].result, "written", JSON.stringify(applied.corrections));
  const proposal = (await waiting(dir)).find((entry) => entry.kind === "notion_correction")!;
  assert.equal(proposal.title, "Acme website: Client → org org-bbbb0001, title withheld: awaiting cleanup");
  assert.equal(JSON.stringify(proposal).includes("95k"), false);
});

test("apply refuses the retired corrections input, and proposal new refuses both kinds sync writes (cli §5.6, §5.7)", async (context) => {
  const dir = await fixtureCopy(context);
  const retired = await brain(["apply", "--brain", dir, "--now", NOW, "--input", await file(dir, { corrections: [{ target: MARIA, field: "facts.role", value: "Product lead", observed_at: EDITED }] }), "--json"]);
  assert.notEqual(retired.code, 0);
  assert.equal(retired.json.error.code, "INPUT_INVALID");
  assert.match(retired.stdout, /\/corrections/);
  for (const kind of ["notion_correction", "tracked_task"]) {
    const run = await brain(["proposal", "new", "--brain", dir, "--now", NOW, "--input", await file(dir, { proposals: [{ kind, title: "x", target: MARIA, why: "w", source: `notion:${MARIA_PAGE}` }] }), "--json"]);
    assert.equal(run.json.error?.code, "INPUT_INVALID", run.stdout);
    assert.match(run.stdout, /written only by brain sync apply/);
  }
});

test("a pending correction on one key holds Key Facts whole: a brain change to another key is not sent until you decide (cli §5.14.4)", async (context) => {
  const dir = await fixtureCopy(context);
  await published(dir);
  await syncApply(dir, await plan(dir, [projectRow({ "Key Facts": "Budget: 80000 EUR · Launch date: 2027-03" })]));
  const correction = (await waiting(dir)).find((entry) => entry.kind === "notion_correction")!;
  assert.equal(correction.property, "Key Facts/launch_date");
  // The brain learns a new budget while your launch date edit waits.
  await edit(dir, PROJECT_PATH, (a) => { a.facts = { ...(a.facts as Record<string, unknown>), budget: "95000 EUR" }; });
  const held = await renderProject(dir);
  assert.ok(held === undefined || (!("Key Facts" in held.properties) && !("Key Facts" in held.published)), JSON.stringify(held));

  // Decided: the next publish sends Key Facts with the brain's budget and the accepted launch date.
  assert.equal((await decide(dir, [{ proposal: correction.id, action: "approve", note: "a", decided_at: NOW, decided_by: "chat" }])).json.data.decisions[0].result, "applied");
  const sent = await renderProject(dir);
  assert.equal(sent!.properties["Key Facts"]!.value, "Budget: 95000 EUR · Launch date: 2027-03");
});
