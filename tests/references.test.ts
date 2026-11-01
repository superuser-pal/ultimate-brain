import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const PROJECT = "prj-9x4t1b7e";
const AREA = "area-2m7c4h8n";
const REQUIREMENTS = "## Requirements\n\n- Login with email\n- Launch in 2027-02\n";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

function source(title: string, kind: string, body: string, frontmatter: Record<string, unknown> = {}) {
  const key = kind === "document" ? { source_key: `file:sha256:${createHash("sha256").update(title).digest("hex")}`, file_name: `${title.toLowerCase().replace(/\W+/g, "-")}.pdf`, converter: "markitdown 0.1.8" } : { source_key: `agent:claude-code/${title.toLowerCase().replace(/\W+/g, "-")}` };
  return { type: "source", title, file_date: "2026-12-01", frontmatter: { ...key, kind, summary: `${title} in one line.`, digest: `- Key point of ${title}.`, ...frontmatter }, body };
}

async function newSource(dir: string, item: Record<string, unknown>): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["note", "new"], { notes: [item] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0];
}

async function configure(dir: string, key: string, id: string): Promise<void> {
  const set = await brain(["config", "set", `notion.databases.${key}`, JSON.stringify(id), "--brain", dir, "--json"]);
  assert.equal(set.code, 0, set.stdout);
}

export async function newReference(dir: string, sourceId: string, title = "Acme requirements"): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title, frontmatter: { summary: "What Acme requires of the website.", origin: "part", area: AREA, projects: [PROJECT], sources: [sourceId] }, body: REQUIREMENTS }] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0];
}

test("a reference validates, is listed under its project and renders to Documents with its body", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await newSource(dir, source("Acme requirements v1", "document", REQUIREMENTS, { only_keep: "just the requirements" }));
  const reference = await newReference(dir, document.id);
  assert.match(reference.id, /^ref-/);
  assert.equal(reference.path, "knowledge/references/acme-requirements.md");

  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, lint.stdout);
  const index = await run(dir, ["index"]);
  assert.equal(index.code, 0, index.stdout);
  assert.equal(index.json.data.counts.reference, 1);
  const markdown = await readFile(join(dir, "index.md"), "utf8");
  assert.match(markdown, /\n## Documents\n- \[Acme requirements\]\(knowledge\/references\/acme-requirements\.md\) — ref-\w{8} · origin: part · area: Clients · project: Acme website · What Acme requires of the website\.\n/);
  const status = await run(dir, ["status"]);
  assert.equal(status.json.data.notes.reference, 1);
  assert.ok(status.json.data.notion.missing.includes("documents"));

  const unconfigured = await run(dir, ["sync", "render", "--ids", reference.id]);
  assert.deepEqual(unconfigured.json.data.items, []);
  assert.equal(unconfigured.json.warnings[0].code, "DATABASE_NOT_CONFIGURED");
  await configure(dir, "inbox", "a1000000-0000-4000-8000-00000000000b");
  const inboxOnly = await run(dir, ["sync", "render", "--ids", document.id]);
  assert.equal(inboxOnly.json.data.items[0].properties.Documents, undefined, "an Inbox without the Documents property gets none");

  await configure(dir, "references", "a1000000-0000-4000-8000-00000000000c");
  const [item] = (await run(dir, ["sync", "render", "--ids", reference.id])).json.data.items;
  assert.equal(item.database, "documents", "a references key is read as documents (0049)");
  assert.equal(item.action, "create");
  assert.deepEqual(item.properties.Project, { type: "relation", value: ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"] });
  assert.deepEqual(item.properties.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
  assert.equal(item.body.trimStart(), REQUIREMENTS);
  const [row] = (await run(dir, ["sync", "render", "--ids", document.id])).json.data.items;
  assert.deepEqual(row.properties.Documents, { type: "relation", value: [] });
  assert.deepEqual(row.pending_relations, [{ property: "Documents", ids: [reference.id] }]);
});

test("note new refuses a reference with no sources", async (context) => {
  const dir = await fixtureCopy(context);
  const refused = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "No sources", frontmatter: { summary: "Kept from nowhere.", origin: "part" }, body: "x\n" }] });
  assert.equal(refused.json.error?.code, "INPUT_INVALID");
  assert.match(refused.stdout, /sources/);
});

const SYNC_SOURCE = "src-7w3c9k5m";

function minutes(body: string, frontmatter: Record<string, unknown> = {}) {
  return { type: "source", title: "Acme sync (Notion minutes)", file_date: "2026-12-10", frontmatter: { source_key: "notion:3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f", origin_edited: "2026-12-10T08:00:00Z", ...frontmatter }, body };
}

test("a re-read of a changed meeting is a new version linked to the old one; an unchanged one is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const SYNC_MINUTES = parseFrontmatter(await readFile(join(dir, "sources/notion/2026-12-03-acme-sync-notion-minutes.md"), "utf8")).body;
  assert.ok(SYNC_MINUTES.includes("- Draft auth migration plan — Carlos — 2026-12-10\n"), "the fixture's minutes body");

  const unchanged = await run(dir, ["note", "new"], { notes: [minutes(SYNC_MINUTES, { replaces: SYNC_SOURCE })] });
  assert.equal(unchanged.code, 0, unchanged.stdout);
  assert.deepEqual(unchanged.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_SOURCE", existing: SYNC_SOURCE }]);

  const fixed = SYNC_MINUTES.replace("2026-12-10", "2026-12-17");
  const sameKey = await run(dir, ["note", "new"], { notes: [minutes(fixed)] });
  assert.equal(sameKey.json.data.skipped[0]?.reason, undefined, "a Notion page key alone never dedupes minutes");
  const dir2 = await fixtureCopy(context);
  const version = await newSource(dir2, minutes(fixed, { replaces: SYNC_SOURCE }));
  const diff = await run(dir2, ["source", "diff", version.id]);
  assert.equal(diff.code, 0, diff.stdout);
  assert.deepEqual(diff.json.data, { id: version.id, replaces: SYNC_SOURCE, removed: 1, added: 1, diff: "- - Draft auth migration plan — Carlos — 2026-12-10\n+ - Draft auth migration plan — Carlos — 2026-12-17" });
  assert.equal((await run(dir2, ["lint"])).json.data.errors, 0);

  const second = await run(dir2, ["note", "new"], { notes: [minutes(`${fixed}\nMore.\n`, { replaces: SYNC_SOURCE })] });
  assert.equal(second.json.error?.code, "INPUT_INVALID", "a source replaced twice");
  assert.match(second.stdout, /already replaced by/);
  for (const replaces of ["src-00000000", "dec-7k2m9q4x"]) {
    const refused = await run(dir2, ["note", "new"], { notes: [minutes(`${fixed}\n${replaces}\n`, { replaces })] });
    assert.equal(refused.json.error?.code, "INPUT_INVALID", replaces);
  }
  const first = await run(dir2, ["source", "diff", SYNC_SOURCE]);
  assert.equal(first.json.error?.code, "INPUT_INVALID", "the first version has nothing to diff");
  assert.equal((await run(dir2, ["source", "diff", "src-00000000"])).json.error?.code, "UNKNOWN_ID");
});

test("a capture fixed and read again is a new version of the same Inbox row", async (context) => {
  const dir = await fixtureCopy(context);
  const capture = (body: string, frontmatter: Record<string, unknown> = {}) => ({ type: "source", title: "Call with Lucía", file_date: "2026-12-05", frontmatter: { source_key: "notion:d1000000-0000-4000-8000-000000000001", kind: "capture", ...frontmatter }, body });
  const first = await newSource(dir, capture("Lucía says launch is in February.\n"));
  const edited = await run(dir, ["note", "new"], { notes: [capture("Lucía says launch is in March.\n")] });
  assert.equal(edited.json.data.skipped[0].reason, "DUPLICATE_SOURCE", "without replaces, the same row is a duplicate");
  const again = await newSource(dir, capture("Lucía says launch is in March.\n", { replaces: first.id }));
  assert.notEqual(again.id, first.id);
  assert.equal((await run(dir, ["lint"])).json.data.errors, 0);
});

test("source diff: a tie removes first, and the rest of either side is written in order", async () => {
  const { lineDiff } = await import("../src/lib/diff.ts");
  assert.deepEqual(lineDiff("A\nB\nA", "A\nA\nB"), ["- B", "+ B"]);
  assert.deepEqual(lineDiff("A\r\nB\r\n", "A\nB\nC\n"), ["+ C"]);
  assert.deepEqual(lineDiff("A\nB\nC", "A"), ["- B", "- C"]);
  assert.deepEqual(lineDiff("same\n", "same\n"), []);
});

test("note new: only_keep is refused on a capture and when empty", async (context) => {
  const dir = await fixtureCopy(context);
  const onCapture = await run(dir, ["note", "new"], { notes: [{ type: "source", title: "A capture", file_date: "2026-12-05", frontmatter: { source_key: "notion:d1000000-0000-4000-8000-000000000002", kind: "capture", only_keep: "the numbers" }, body: "Text.\n" }] });
  assert.equal(onCapture.json.error?.code, "INPUT_INVALID");
  const empty = await run(dir, ["note", "new"], { notes: [source("Empty keep", "document", "Text.\n", { only_keep: "" })] });
  assert.equal(empty.json.error?.code, "INPUT_INVALID");
});

test("an approved update_body replaces the reference's body; one whose body changed first is closed as stale", async (context) => {
  const dir = await fixtureCopy(context);
  const v1 = await newSource(dir, source("Acme requirements v1", "document", REQUIREMENTS));
  const reference = await newReference(dir, v1.id);
  const v2 = await newSource(dir, source("Acme requirements v2", "document", REQUIREMENTS.replace("2027-02", "2027-03"), { replaces: v1.id }));
  const updated = REQUIREMENTS.replace("2027-02", "2027-03");
  const proposed = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Requirements v2", target: reference.id, content: updated, why: "Version 2 moves the launch.", source: v2.id }] });
  assert.equal(proposed.code, 0, proposed.stdout);
  const [row] = proposed.json.data.created;
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: row.id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "notion" }] });
  assert.equal(applied.json.data.decisions[0].result, "applied", applied.stdout);
  const after = parseFrontmatter(await readFile(join(dir, reference.path), "utf8"));
  assert.equal(after.body.trimStart(), updated);
  assert.deepEqual(after.attributes.sources, [v1.id, v2.id]);

  const again = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Requirements v3", target: reference.id, content: `${updated}- Dark mode\n`, why: "v3.", source: v2.id }] });
  const [later] = again.json.data.created;
  const path = join(dir, reference.path);
  await writeFile(path, `${await readFile(path, "utf8")}- Edited by hand\n`);
  const stale = await run(dir, ["apply"], { decisions: [{ proposal: later.id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "notion" }] });
  assert.equal(stale.json.data.decisions[0].reason, "STALE_PROPOSAL", stale.stdout);
  assert.equal((await run(dir, ["lint"])).json.data.errors, 0);
});

test("render: an update_body row shows the changed lines as Proposed, and keeps them once applied", async (context) => {
  const dir = await fixtureCopy(context);
  const v1 = await newSource(dir, source("Acme requirements v1", "document", REQUIREMENTS));
  const reference = await newReference(dir, v1.id);
  const updated = REQUIREMENTS.replace("2027-02", "2027-03");
  const proposed = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Requirements v2", target: reference.id, content: updated, why: "Version 2.", source: v1.id }] });
  const [row] = proposed.json.data.created;
  const render = async () => (await run(dir, ["sync", "render", "--ids", row.id])).json.data.items[0];
  const item = await render();
  assert.deepEqual(item.properties.Now, { type: "rich_text", value: null });
  assert.equal(item.properties.Proposed.value, "- - Launch in 2027-02\n+ - Launch in 2027-03");
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: row.id, notion: "b3000000-0000-4000-8000-000000000001", synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  await run(dir, ["apply"], { decisions: [{ proposal: row.id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "notion" }] });
  const after = await render();
  assert.deepEqual(after.properties.State, { type: "select", value: "Applied" });
  assert.equal(after.properties.Proposed, undefined, "the diff shown stays as published");
});

test("note new: a whole Document is the source's text, reviewed, once per source (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await newSource(dir, source("Acme requirements", "document", REQUIREMENTS));
  const whole = (title: string, body = REQUIREMENTS, sources: unknown = [document.id]) =>
    ({ type: "reference", title, frontmatter: { summary: "The requirements, whole.", origin: "whole", area: AREA, sources }, body });

  const created = await run(dir, ["note", "new"], { notes: [whole("Acme requirements (whole)")] });
  assert.equal(created.code, 0, created.stdout);
  const kept = created.json.data.created[0];
  assert.equal(parseFrontmatter(await readFile(join(dir, kept.path), "utf8")).attributes.lifecycle, "reviewed");

  const again = await run(dir, ["note", "new"], { notes: [whole("Acme requirements again")] });
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data, { created: [], skipped: [{ input_index: 0, reason: "ALREADY_KEPT", existing: kept.id }], dry_run: false });

  for (const [item, pointer] of [
    [whole("Edited", `${REQUIREMENTS}- Dark mode\n`), "/notes/0/body"],
    [whole("Two sources", REQUIREMENTS, [document.id, "src-7w3c9k5m"]), "/notes/0/frontmatter/sources"],
    [whole("From a meeting", REQUIREMENTS, ["mtg-8c4n2p7w"]), "/notes/0/frontmatter/sources"],
  ] as const) {
    const refused = await run(dir, ["note", "new"], { notes: [item] });
    assert.equal(refused.json.error?.code, "INPUT_INVALID", item.title);
    assert.ok(refused.json.error.details.some((problem: { pointer: string }) => problem.pointer === pointer), JSON.stringify(refused.json.error.details));
  }
});

test("note new: a whole Document of a source earlier in the batch, and a second one in the same batch is skipped", async (context) => {
  const dir = await fixtureCopy(context);
  const item = { ...source("Launch brief", "document", REQUIREMENTS), id: "src-3k8m2q7w" };
  const whole = (title: string) => ({ type: "reference", title, frontmatter: { summary: "Whole.", origin: "whole", sources: ["src-3k8m2q7w"] }, body: REQUIREMENTS });
  const created = await run(dir, ["note", "new"], { notes: [item, whole("Launch brief (whole)"), whole("Launch brief twice")] });
  assert.equal(created.code, 0, created.stdout);
  assert.equal(created.json.data.created.length, 2);
  assert.deepEqual(created.json.data.skipped, [{ input_index: 2, reason: "ALREADY_KEPT", existing: created.json.data.created[1].id }]);
});

test("note new: a promoted Document takes its note's lifecycle, one per note; origin is required (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const promoted = (title: string, from: string) => ({ type: "reference", title, frontmatter: { summary: "A page for the note.", origin: "promoted", promoted_from: from }, body: "## Why\nBecause.\n" });

  const fromArchived = await run(dir, ["note", "new"], { notes: [promoted("Firebase auth (page)", "dec-2p9f6h1r")] });
  assert.equal(fromArchived.code, 0, fromArchived.stdout);
  assert.equal(parseFrontmatter(await readFile(join(dir, fromArchived.json.data.created[0].path), "utf8")).attributes.lifecycle, "archived");

  const twice = await run(dir, ["note", "new"], { notes: [promoted("Firebase auth again", "dec-2p9f6h1r")] });
  assert.equal(twice.json.error?.code, "INPUT_INVALID");
  const sameBatch = await run(dir, ["note", "new"], { notes: [promoted("RLS one", "con-1s6t8e2b"), promoted("RLS two", "con-1s6t8e2b")] });
  assert.deepEqual(sameBatch.json.error?.details.map((problem: { pointer: string }) => problem.pointer), ["/notes/1/frontmatter/promoted_from"]);
  const notADecision = await run(dir, ["note", "new"], { notes: [promoted("A question page", "dec-00000000")] });
  assert.equal(notADecision.json.error?.code, "INPUT_INVALID");

  const noOrigin = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "No origin", frontmatter: { summary: "x", sources: ["src-7w3c9k5m"] }, body: "x\n" }] });
  assert.equal(noOrigin.json.error?.details[0].pointer, "/notes/0/frontmatter/origin");
});

test("note new: a source's area and projects must exist (UNKNOWN_ID, 0050)", async (context) => {
  const dir = await fixtureCopy(context);
  const placed = await run(dir, ["note", "new"], { notes: [source("Placed", "document", "Text.\n", { area: AREA, projects: [PROJECT] })] });
  assert.equal(placed.code, 0, placed.stdout);
  for (const extra of [{ area: "area-00000000" }, { projects: [PROJECT, "prj-00000000"] }, { area: PROJECT }]) {
    const refused = await run(dir, ["note", "new"], { notes: [source(`Misplaced ${JSON.stringify(extra)}`, "document", "Other text.\n", extra)] });
    assert.equal(refused.json.error?.code, "UNKNOWN_ID", JSON.stringify(extra));
  }
});

test("a promoted Document's body is yours: update_body is refused, and lint reports one written by hand (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Supabase auth (page)", frontmatter: { summary: "A page for the decision.", origin: "promoted", promoted_from: "dec-7k2m9q4x" }, body: "## Why\nBecause.\n" }] });
  assert.equal(created.code, 0, created.stdout);
  const page = created.json.data.created[0];

  const refused = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "New body", target: page.id, content: "## Why\nOther.\n", why: "x", source: "src-7w3c9k5m" }] });
  assert.equal(refused.json.error?.code, "INPUT_INVALID");
  assert.match(refused.json.error.message, /promoted Document/);

  // A promoted_from naming a note retyped as a question, and an update_body proposal written by hand.
  const path = join(dir, page.path);
  await writeFile(path, (await readFile(path, "utf8")).replace("promoted_from: dec-7k2m9q4x", "promoted_from: con-1s6t8e2b"));
  const concept = join(dir, "knowledge/concepts/row-level-security.md");
  await writeFile(concept, (await readFile(concept, "utf8")).replace(/^type: concept$/m, "type: question"));
  const accepted = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_body", title: "Requirements v2", target: (await newReference(dir, "src-7w3c9k5m")).id, content: "x\n", why: "x", source: "src-7w3c9k5m" }] });
  const proposal = join(dir, accepted.json.data.created[0].path);
  await writeFile(proposal, (await readFile(proposal, "utf8")).replace(/^target: ref-\w+$/m, `target: ${page.id}`));
  const lint = await run(dir, ["lint"]);
  const rules = lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error").map((issue: { rule: string }) => issue.rule);
  assert.ok(rules.includes("promoted-from"), JSON.stringify(rules));
  assert.ok(rules.includes("update-body"), JSON.stringify(rules));
});

const INBOX_ROW = (page: string, brainId: string | null, properties: Record<string, unknown> = {}) =>
  ({ database: "inbox", page_id: page, last_edited: NOW, properties: { "Document asked": true, "Only keep": null, "Brain ID": brainId, ...properties } });

test("sync plan: Keep as document asks for a Document of the latest version or of each attached file (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const capture = { type: "source", id: "src-4c8n2k7q", title: "BRS mail", file_date: "2026-12-04", frontmatter: { source_key: "notion:d2000000-0000-4000-8000-000000000001", kind: "capture", summary: "The BRS, attached." }, body: "See the attached BRS.\n" };
  const files = ["src-5d9p3m8r", "src-6e2q4n9s"].map((id, index) => ({ ...source(`BRS part ${index + 1}`, "document", `Part ${index + 1} text.\n`, { attached_to: "src-4c8n2k7q" }), id }));
  for (const item of files) delete (item.frontmatter as Record<string, unknown>).digest;
  const v1 = await newSource(dir, source("Spec v1", "document", "Version one.\n"));
  const v2 = await newSource(dir, source("Spec v2", "document", "Version two.\n", { replaces: v1.id }));
  const created = await run(dir, ["note", "new"], { notes: [capture, ...files] });
  assert.equal(created.code, 0, created.stdout);
  const whole = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Spec v2 (whole)", frontmatter: { summary: "Whole.", origin: "whole", sources: [v2.id] }, body: "Version two.\n" }] });
  assert.equal(whole.code, 0, whole.stdout);

  const plan = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [
    INBOX_ROW("d3000000-0000-4000-8000-000000000001", "src-4c8n2k7q", { "Only keep": "the deadlines" }),
    INBOX_ROW("d3000000-0000-4000-8000-000000000002", v1.id),
    INBOX_ROW("d3000000-0000-4000-8000-000000000003", null),
    INBOX_ROW("d3000000-0000-4000-8000-000000000004", "src-7w3c9k5m"),
    INBOX_ROW("d3000000-0000-4000-8000-000000000005", "src-00000000"),
    INBOX_ROW("d3000000-0000-4000-8000-000000000006", "src-4c8n2k7q", { "Document asked": false }),
  ] });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.document_requests, [
    { page_id: "d3000000-0000-4000-8000-000000000001", source: "src-4c8n2k7q", files: ["src-5d9p3m8r", "src-6e2q4n9s"], only_keep: "the deadlines" },
    { page_id: "d3000000-0000-4000-8000-000000000002", source: v2.id, files: [], only_keep: null, existing: [whole.json.data.created[0].id] },
  ]);
  assert.deepEqual(plan.json.data.ignored.map((item: { reason: string; brain_id: string | null }) => [item.reason, item.brain_id]), [["NOT_INGESTED", null], ["NOT_A_SOURCE", "src-7w3c9k5m"]]);
  assert.deepEqual(plan.json.data.conflicts.map((item: { code: string }) => item.code), ["UNKNOWN_BRAIN_ID"]);
});

test("sync plan: Promote asks for a promoted Document, or names the one there (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const promoted = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "RLS (page)", frontmatter: { summary: "A page.", origin: "promoted", promoted_from: "con-1s6t8e2b" }, body: "RLS.\n" }] });
  assert.equal(promoted.code, 0, promoted.stdout);
  const plan = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [
    { database: "decisions", page_id: "d4000000-0000-4000-8000-000000000001", last_edited: NOW, properties: { "Brain ID": "dec-7k2m9q4x", "Promote asked": true } },
    { database: "concepts", page_id: "d4000000-0000-4000-8000-000000000002", last_edited: NOW, properties: { "Brain ID": "con-1s6t8e2b", "Promote asked": true } },
    { database: "decisions", page_id: "d4000000-0000-4000-8000-000000000003", last_edited: NOW, properties: { "Brain ID": "dec-2p9f6h1r", "Promote asked": false } },
  ] });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.promote_requests, [
    { page_id: "d4000000-0000-4000-8000-000000000001", note: "dec-7k2m9q4x" },
    { page_id: "d4000000-0000-4000-8000-000000000002", note: "con-1s6t8e2b", existing: promoted.json.data.created[0].id },
  ]);
  const applied = await run(dir, ["sync", "apply", "--dry-run"], plan.json.data);
  assert.deepEqual(applied.json.data.promote_requests, plan.json.data.promote_requests, "sync apply echoes the requests");
});

test("sync plan: rows of a module that is off are ignored as MODULE_OFF (0048)", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { knowledge: false, orgs: true, documents: false, reports: false };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const plan = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [
    { database: "decisions", page_id: "d5000000-0000-4000-8000-000000000001", last_edited: NOW, properties: { "Brain ID": "dec-7k2m9q4x", Name: "Changed in Notion" } },
    { database: "goals", page_id: "d5000000-0000-4000-8000-000000000002", last_edited: NOW, properties: { "Brain ID": null, Name: "Write a book" } },
    INBOX_ROW("d5000000-0000-4000-8000-000000000003", "src-7w3c9k5m"),
  ] });
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.ignored.map((item: { page_id: string; reason: string; property?: string }) => [item.page_id.slice(-1), item.reason, item.property ?? null]), [
    ["2", "MODULE_OFF", null], ["1", "MODULE_OFF", null], ["3", "MODULE_OFF", "Document asked"],
  ]);
  assert.deepEqual([plan.json.data.create, plan.json.data.updates, plan.json.data.corrections, plan.json.data.document_requests], [[], [], [], []]);
});

test("render: a promoted Document links its note through From decision, and its body goes out on create only (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  await configure(dir, "documents", "a1000000-0000-4000-8000-00000000000c");
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Supabase auth (page)", frontmatter: { summary: "A page for the decision.", origin: "promoted", promoted_from: "dec-7k2m9q4x", projects: [PROJECT] }, body: "## Why\nBecause.\n" }] });
  assert.equal(created.code, 0, created.stdout);
  const page = created.json.data.created[0];

  const [item] = (await run(dir, ["sync", "render", "--ids", page.id])).json.data.items;
  assert.equal(item.action, "create");
  assert.equal(item.body.trimStart(), "## Why\nBecause.\n");
  assert.deepEqual(item.properties["From decision"], { type: "relation", value: [] });
  assert.deepEqual(item.properties["From concept"], { type: "relation", value: [] });
  assert.deepEqual(item.pending_relations, [{ property: "From decision", ids: ["dec-7k2m9q4x"] }]);
  const recorded = await run(dir, ["sync", "record"], { records: [{ id: page.id, notion: "b3000000-0000-4000-8000-000000000001", synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);

  // The page is yours now: a new seed in the file is never sent.
  const path = join(dir, page.path);
  await writeFile(path, (await readFile(path, "utf8")).replace("Because.", "Because, reworded."));
  assert.deepEqual((await run(dir, ["sync", "render", "--ids", page.id])).json.data.items, []);
});

test("render: an Inbox row's Kind is File, written if empty; Brain Status is Done; old values aren't sent again (0048)", async (context) => {
  const dir = await fixtureCopy(context);
  await configure(dir, "inbox", "a1000000-0000-4000-8000-00000000000b");
  const document = await newSource(dir, source("Acme brief", "document", REQUIREMENTS));
  const [item] = (await run(dir, ["sync", "render", "--ids", document.id])).json.data.items;
  assert.deepEqual(item.properties.Kind, { type: "select", value: "File", mode: "if_empty" });
  assert.deepEqual(item.properties["Brain Status"], { type: "select", value: "Done" });

  // A row published before 0.6.0 holds Document and Processed in S.
  const published = { ...item.published, Kind: "Document", "Brain Status": "Processed" };
  await run(dir, ["sync", "record"], { records: [{ id: document.id, notion: "b3000000-0000-4000-8000-000000000002", synced_at: NOW, published }] });
  assert.deepEqual((await run(dir, ["sync", "render", "--ids", document.id])).json.data.items, []);
});

test("render: a Review row names its kind and carries the source's area (0048, 0050)", async (context) => {
  const dir = await fixtureCopy(context);
  const items = (await run(dir, ["sync", "render", "--ids", "prp-1q5w8e3r,prp-4n8c2w7t"])).json.data.items;
  const byId = Object.fromEntries(items.map((item: { id: string }) => [item.id, item]));
  assert.deepEqual(byId["prp-1q5w8e3r"].properties.Name, { type: "title", value: "Conflict: Supabase supersedes Firebase for auth" });
  assert.deepEqual(byId["prp-1q5w8e3r"].properties.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
  assert.equal(byId["prp-4n8c2w7t"].published.Name, "Acme launch: Jan → Feb", "an update_fact has no prefix");
  assert.deepEqual(byId["prp-4n8c2w7t"].properties.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
});

test("acceptance: Keep as document with Only keep empty gives a whole Document and no proposal; the next plan finds it there (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  await configure(dir, "inbox", "a1000000-0000-4000-8000-00000000000b");
  await configure(dir, "documents", "a1000000-0000-4000-8000-00000000000c");
  const document = await newSource(dir, source("Acme BRS", "document", REQUIREMENTS));
  const row = INBOX_ROW("d6000000-0000-4000-8000-000000000001", document.id);
  const [request] = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [row] })).json.data.document_requests;
  assert.deepEqual(request, { page_id: row.page_id, source: document.id, files: [], only_keep: null });

  const sourceBody = (await readFile(join(dir, document.path), "utf8")).split("\n---\n").slice(1).join("\n---\n");
  const kept = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Acme BRS", frontmatter: { summary: "The BRS, whole.", origin: "whole", area: AREA, sources: [request.source] }, body: sourceBody }] });
  assert.equal(kept.code, 0, kept.stdout);
  const proposals = await run(dir, ["proposal", "list", "--status", "pending"]);
  assert.equal(proposals.json.data.proposals.some((proposal: { title: string }) => proposal.title.includes("Acme BRS")), false, "no proposal for a whole Document");
  const [again] = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [row] })).json.data.document_requests;
  assert.deepEqual(again.existing, [kept.json.data.created[0].id], "a second catch-up only clears the box");
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});

test("acceptance: with Only keep set, a part Document goes in the source's review_notes, and approving it makes it reviewed (0049)", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await newSource(dir, source("Acme BRS v2", "document", `${REQUIREMENTS}\n## Budget\n\n- 80000\n`, { only_keep: "just the requirements" }));
  const part = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Acme BRS: requirements", frontmatter: { summary: "Just the requirements.", origin: "part", area: AREA, sources: [document.id] }, body: REQUIREMENTS }] });
  assert.equal(part.code, 0, part.stdout);
  const page = part.json.data.created[0];
  const row = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: document.id, notes: [page.id] }] });
  assert.equal(row.code, 0, row.stdout);
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: row.json.data.created[0].id, action: "approve", decided_at: NOW, decided_by: "notion" }] });
  assert.equal(applied.code, 0, applied.stdout);
  assert.equal(parseFrontmatter(await readFile(join(dir, page.path), "utf8")).attributes.lifecycle, "reviewed");
});

test("acceptance: a Review row from a project's meeting with no area of its own carries the project's area (0050)", async (context) => {
  const dir = await fixtureCopy(context);
  const meeting = join(dir, "knowledge/meetings/2026-12-03-acme-sync.md");
  const text = await readFile(meeting, "utf8");
  assert.match(text, /^projects:/m);
  await writeFile(meeting, text.replace(/^area: area-2m7c4h8n\n/m, ""));
  const [item] = (await run(dir, ["sync", "render", "--ids", "prp-4n8c2w7t"])).json.data.items;
  assert.deepEqual(item.properties.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
});

test("lint: a promoted Document's origin and promoted_from are declared keys, not unknown-key warnings", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Declared keys", frontmatter: { summary: "A page for the decision.", origin: "promoted", promoted_from: "dec-7k2m9q4x" }, body: "## Why\nBecause.\n" }] });
  assert.equal(created.code, 0, created.stdout);
  const lint = await run(dir, ["lint"]);
  assert.equal(lint.code, 0, lint.stdout);
  assert.deepEqual(lint.json.data.issues.filter((issue: { rule: string }) => issue.rule === "unknown-key"), []);
});

test("lint: a key no type declares is still an unknown-key warning on a reference (negative control)", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Stray key", frontmatter: { summary: "A page.", origin: "promoted", promoted_from: "dec-7k2m9q4x" }, body: "Text.\n" }] });
  assert.equal(created.code, 0, created.stdout);
  const file = join(dir, created.json.data.created[0].path);
  await writeFile(file, (await readFile(file, "utf8")).replace("\n---\n", "\nstray_key: x\n---\n"));
  const lint = await run(dir, ["lint"]);
  const unknown = lint.json.data.issues.filter((issue: { rule: string }) => issue.rule === "unknown-key").map((issue: { message: string }) => issue.message);
  assert.ok(unknown.some((message: string) => message.includes("stray_key")), lint.stdout);
});
