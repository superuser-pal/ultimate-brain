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

test("a reference validates, is listed under its project and renders to References with its body", async (context) => {
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
  assert.match(markdown, /\n## References\n- \[Acme requirements\]\(knowledge\/references\/acme-requirements\.md\) — ref-\w{8} · area: Clients · project: Acme website · What Acme requires of the website\.\n/);
  const status = await run(dir, ["status"]);
  assert.equal(status.json.data.notes.reference, 1);
  assert.ok(status.json.data.notion.missing.includes("documents"));

  const unconfigured = await run(dir, ["sync", "render", "--ids", reference.id]);
  assert.deepEqual(unconfigured.json.data.items, []);
  assert.equal(unconfigured.json.warnings[0].code, "DATABASE_NOT_CONFIGURED");
  await configure(dir, "inbox", "a1000000-0000-4000-8000-00000000000b");
  const inboxOnly = await run(dir, ["sync", "render", "--ids", document.id]);
  assert.equal(inboxOnly.json.data.items[0].properties.References, undefined, "an Inbox without the References property gets none");

  await configure(dir, "references", "a1000000-0000-4000-8000-00000000000c");
  const [item] = (await run(dir, ["sync", "render", "--ids", reference.id])).json.data.items;
  assert.equal(item.database, "documents", "a references key is read as documents (0049)");
  assert.equal(item.action, "create");
  assert.deepEqual(item.properties.Project, { type: "relation", value: ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"] });
  assert.deepEqual(item.properties.Area, { type: "relation", value: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"] });
  assert.equal(item.body.trimStart(), REQUIREMENTS);
  const [row] = (await run(dir, ["sync", "render", "--ids", document.id])).json.data.items;
  assert.deepEqual(row.properties.References, { type: "relation", value: [] });
  assert.deepEqual(row.pending_relations, [{ property: "References", ids: [reference.id] }]);
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
