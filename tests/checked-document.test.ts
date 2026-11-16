// A changed document is checked as an Inbox row before it goes in (0.16.0, decision 0098 §4 to §7; spec/capture-and-review.md §12;
// spec/cli.md §5.5, §5.6, §5.14.4, §5.35). Synthetic brains only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { lineageOf, type SourceInfo } from "../src/lib/eligibility.ts";
import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const PROJECT = "prj-9x4t1b7e";
const AREA = "area-2m7c4h8n";
const ORIGINAL_ROW = "c1000000-0000-4000-8000-000000000001";
const CHECKED_ROW = "c1000000-0000-4000-8000-000000000002";
const CAPTURE_ROW = "c1000000-0000-4000-8000-000000000003";
const DOCUMENTS_DB = "c1000000-0000-4000-8000-0000000000d0";
const INBOX_DB = "c1000000-0000-4000-8000-0000000000e0";
const ORIGINAL_TEXT = "## Pilot\nThe pilot covers 9 depots in three regions.\n\n## Hiring\nTwo drivers per depot.\n\n## Appendix A\nBudget: 40k.\n";
const CHECKED_TEXT = "## Pilot\nThe pilot covers 11 depots in three regions.\n";
const CHANGES = ["Dropped: Hiring (section 2)", "Dropped: Appendix A (budget)", "Altered: depot count 9 → 11"];

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

async function ok(dir: string, args: string[], input?: unknown) {
  const result = await run(dir, args, input);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  return result.json.data;
}

async function configure(dir: string, key: string, value: unknown): Promise<void> {
  await ok(dir, ["config", "set", key, JSON.stringify(value)]);
}

function fileKey(name: string): string {
  return `file:sha256:${createHash("sha256").update(name).digest("hex")}`;
}

/** The original: a converted file, recorded as a source with its Inbox row published (capture-and-review §12.3 step 1). */
function originalItem(frontmatter: Record<string, unknown> = {}) {
  return { type: "source", title: "Ops plan", file_date: "2026-12-01", frontmatter: { source_key: fileKey("ops-plan.pdf"), kind: "document", file_name: "ops-plan.pdf", converter: "markitdown 0.1.8", summary: "The ops plan.", digest: "- Pilot, hiring, budget.", area: AREA, projects: [PROJECT], notion: ORIGINAL_ROW, ...frontmatter }, body: ORIGINAL_TEXT };
}

/** The checked row's source, as the skill writes it on "go" or Ready (cli §5.35 "Taking it in"). */
function checkedItem(original: string, frontmatter: Record<string, unknown> = {}, body = CHECKED_TEXT) {
  return { type: "source", title: "Ops plan (changed)", file_date: "2026-12-02", frontmatter: { source_key: `notion:${CHECKED_ROW}`, kind: "document", notion: CHECKED_ROW, checked_from: original, changes: CHANGES, area: AREA, projects: [PROJECT], ...frontmatter }, body };
}

async function setUp(dir: string): Promise<string> {
  await configure(dir, "notion.databases.documents", DOCUMENTS_DB);
  await configure(dir, "notion.databases.inbox", INBOX_DB);
  const data = await ok(dir, ["note", "new"], { notes: [originalItem()] });
  return data.created[0].id as string;
}

/** Every file of the brain with its content hash, to show a command wrote nothing. */
async function tree(dir: string): Promise<string[]> {
  const files = (await readdir(dir, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile());
  return Promise.all(files.map(async (entry) => { const path = join(entry.parentPath, entry.name); return `${path.slice(dir.length)} ${createHash("sha256").update(await readFile(path)).digest("hex")}`; })).then((rows) => rows.sort());
}

test("a change asked in the session renders one row and takes nothing in; a row never confirmed leaves only the original (0098 §4, cli §5.35)", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  const before = await tree(dir);
  const notesBefore = (await ok(dir, ["status"])).notes;

  const row = await ok(dir, ["source", "check"], { original, file: null, title: "Ops plan (changed)", text: CHECKED_TEXT, changes: CHANGES, document_asked: false });
  assert.equal(row.database, "inbox");
  assert.equal(row.action, "create");
  assert.equal(row.body, CHECKED_TEXT);
  assert.deepEqual(row.properties, {
    Name: "Ops plan (changed)", Kind: "Changed", "Changed from": [ORIGINAL_ROW], "What changed": CHANGES.join("\n"),
    "Brain Status": "New", "Document asked": false,
    Project: ["2b3c4d5e-6f7a-4b9c-8d1e-2f3a4b5c6d7e"], Area: ["1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d"],
  });
  assert.equal(Object.hasOwn(row.properties, "Brain ID"), false, "the row has no source until it is taken in");

  // Nothing is written: the row is never confirmed, so the brain holds the original's source and nothing else of the change.
  assert.deepEqual(await tree(dir), before);
  assert.deepEqual((await ok(dir, ["status"])).notes, notesBefore);
});

test("source check refuses minutes, a capture, an unpublished original, a bad change line and Documents off; an attached file links its capture's row", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  const base = { original, file: null, title: "Ops plan (changed)", text: CHECKED_TEXT, changes: CHANGES, document_asked: false };

  const minutes = await run(dir, ["source", "check"], { ...base, original: "src-7w3c9k5m" });
  assert.equal(minutes.json.error.code, "INPUT_INVALID");
  assert.match(minutes.json.error.message, /minutes source/);

  const capture = await ok(dir, ["note", "new"], { notes: [{ type: "source", title: "Call Lucía", frontmatter: { source_key: `notion:${CAPTURE_ROW}`, kind: "capture" }, body: "Call Lucía about the CMS.\n" }] });
  const fromCapture = await run(dir, ["source", "check"], { ...base, original: capture.created[0].id });
  assert.equal(fromCapture.json.error.code, "INPUT_INVALID", "a capture keeps Tidy capture (0098 §7)");

  const unpublished = await ok(dir, ["note", "new"], { notes: [{ ...originalItem({ source_key: fileKey("other.pdf"), file_name: "other.pdf" }), title: "Other plan" }].map((item) => { const { notion: _n, ...frontmatter } = item.frontmatter; return { ...item, frontmatter, body: "## Other\nAnother plan.\n" }; }) });
  const notPublished = await run(dir, ["source", "check"], { ...base, original: unpublished.created[0].id });
  assert.equal(notPublished.json.error.code, "INPUT_INVALID");
  assert.match(notPublished.json.error.message, /ORIGINAL_NOT_PUBLISHED/);

  const badLine = await run(dir, ["source", "check"], { ...base, changes: ["Removed the hiring part"] });
  assert.equal(badLine.json.error.code, "INPUT_INVALID");
  assert.equal(badLine.json.error.details[0].pointer, "/changes/0");

  const unknown = await run(dir, ["source", "check"], { ...base, original: "src-2222222k" });
  assert.equal(unknown.json.error.code, "UNKNOWN_ID");

  // A file attached to a capture: the row links the capture's row, and What changed names the file first.
  const attached = await ok(dir, ["note", "new"], { notes: [{ type: "source", title: "Budget sheet", frontmatter: { source_key: fileKey("budget.xlsx"), kind: "document", file_name: "budget.xlsx", converter: "markitdown 0.1.8", attached_to: capture.created[0].id }, body: "Budget: 40k.\nContingency: 5k.\n" }] });
  const fromFile = await ok(dir, ["source", "check"], { ...base, original: attached.created[0].id, file: "budget.xlsx", title: "Budget sheet (changed)", text: "Budget: 40k.\n", changes: ["Dropped: Contingency"] });
  assert.deepEqual(fromFile.properties["Changed from"], [CAPTURE_ROW]);
  assert.equal(fromFile.properties["What changed"], "File: budget.xlsx\nDropped: Contingency");
  const wrongFile = await run(dir, ["source", "check"], { ...base, original: attached.created[0].id, file: "other.xlsx" });
  assert.equal(wrongFile.json.error.details[0].pointer, "/file");

  await ok(dir, ["modules", "off", "reports"]);
  await ok(dir, ["modules", "off", "documents"]);
  const off = await run(dir, ["source", "check"], { ...base, document_asked: true });
  assert.equal(off.json.error.code, "MODULE_OFF");
});

test("\"go\" takes the row in: its items cite the checked source, the original stays linked and is never cited (0098 §5, CHECKED_ORIGINAL)", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  // The user edited the row before "go": the source is the row as it is now.
  const edited = CHECKED_TEXT.replace("three regions", "three regions, from 4 March");
  const taken = await ok(dir, ["note", "new"], { notes: [checkedItem(original, {}, edited), { type: "decision", title: "Pilot covers 11 depots", frontmatter: { summary: "The pilot covers 11 depots.", date: "2026-12-02", assessment: "accepted", area: AREA, projects: [PROJECT], sources: ["src-5k2m8q4w"] }, body: "## Decision\nThe pilot covers 11 depots.\n" }].map((item, index) => index === 0 ? { ...item, id: "src-5k2m8q4w" } : item) });
  const [source, decision] = taken.created;
  const file = parseFrontmatter(await readFile(join(dir, source.path), "utf8"));
  assert.equal(file.attributes.checked_from, original);
  assert.deepEqual(file.attributes.changes, CHANGES);
  assert.equal(file.attributes.source_key, `notion:${CHECKED_ROW}`);
  assert.equal(file.body.replace(/^\n/, ""), edited, "the row as it is at go, edits included");
  assert.equal(parseFrontmatter(await readFile(join(dir, decision.path), "utf8")).attributes.lifecycle, "draft", "until the part's yes approves it");

  // The part's questions and additions cite the checked source.
  const proposals = await ok(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: source.id, subject: PROJECT, notes: [decision.id], note_passages: { [decision.id]: [source.id] } },
    { kind: "add_link", title: "Link", target: decision.id, field: "deciders", after: "per-3h8w2n6c", why: "Named in the plan.", source: source.id, subject: PROJECT, passages: [source.id] },
  ] });
  assert.equal(proposals.created.length, 1);

  // The original is cited by nothing new: a note or a proposal that names it is refused.
  const noteOnOriginal = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Pilot covers 9 depots", frontmatter: { summary: "Nine depots.", date: "2026-12-01", assessment: "accepted", area: AREA, sources: [original] }, body: "## Decision\nNine depots.\n" }] });
  assert.equal(noteOnOriginal.json.error.code, "INPUT_INVALID");
  assert.equal(noteOnOriginal.json.error.details[0].pointer, "/notes/0/frontmatter/sources");
  assert.equal(noteOnOriginal.json.error.details[0].message, `CHECKED_ORIGINAL: ${original} was taken in as its checked version ${source.id}; cite that`);
  const proposalSource = await run(dir, ["proposal", "new"], { proposals: [{ kind: "add_to_note", title: "More", target: decision.id, content: "Nine depots at first.", why: "From the plan.", source: original, passages: [source.id] }] });
  assert.equal(proposalSource.json.error.details[0].pointer, "/proposals/0/source");
  assert.match(proposalSource.json.error.details[0].message, /^CHECKED_ORIGINAL: /);
  const proposalPassage = await run(dir, ["proposal", "new"], { proposals: [{ kind: "add_to_note", title: "More", target: decision.id, content: "Nine depots at first.", why: "From the plan.", source: source.id, passages: [source.id, original] }] });
  assert.equal(proposalPassage.json.error.details[0].pointer, "/proposals/0/passages/1");
  const notePassage = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: source.id, subject: "Hiring", notes: [decision.id], note_passages: { [decision.id]: [original] } }] });
  assert.equal(notePassage.json.error.details[0].pointer, `/proposals/0/note_passages/${decision.id}/0`);

  // In the same batch, a checked version written before the note counts too.
  const sameBatch = await run(dir, ["note", "new"], { notes: [checkedItem(original, { source_key: "notion:c1000000-0000-4000-8000-000000000009", notion: "c1000000-0000-4000-8000-000000000009" }, "Another version.\n"), { type: "decision", title: "Nine", frontmatter: { summary: "Nine.", date: "2026-12-01", assessment: "accepted", area: AREA, sources: [original] }, body: "## Decision\nNine.\n" }] });
  assert.equal(sameBatch.json.error.details[0].pointer, "/notes/1/frontmatter/sources");

  // The lint is clean: the checked source is a valid source and links its original.
  const lint = await ok(dir, ["lint"]);
  assert.equal(lint.errors, 0, JSON.stringify(lint.issues));
});

test("a row set Ready and taken in without you: notes draft, additions and a replacing change wait; Document asked keeps it whole and reviewed (0098 §6)", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  const taken = await ok(dir, ["note", "new"], { notes: [
    { ...checkedItem(original), id: "src-5k2m8q4w" },
    { type: "decision", title: "Pilot covers 11 depots", frontmatter: { summary: "The pilot covers 11 depots.", date: "2026-12-02", assessment: "accepted", area: AREA, projects: [PROJECT], sources: ["src-5k2m8q4w"] }, body: "## Decision\nThe pilot covers 11 depots.\n" },
    { type: "reference", title: "Ops plan (changed)", frontmatter: { summary: "The ops plan's pilot section, as checked.", origin: "whole", area: AREA, projects: [PROJECT], sources: ["src-5k2m8q4w"] }, body: CHECKED_TEXT },
  ] });
  const [source, decision, documentNote] = taken.created;
  assert.equal(parseFrontmatter(await readFile(join(dir, decision.path), "utf8")).attributes.lifecycle, "draft", "Ready approves the text, not the notes");
  assert.equal(parseFrontmatter(await readFile(join(dir, documentNote.path), "utf8")).attributes.lifecycle, "reviewed", "the whole Document is the checked text itself");

  // The part's review_notes and a change to what the brain holds wait for the next session.
  const queued = await ok(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: source.id, notes: [decision.id], note_passages: { [decision.id]: [source.id] } },
    { kind: "update_fact", title: "Acme website launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "The checked plan moves the launch.", source: source.id, passages: [source.id] },
  ] });
  assert.deepEqual(queued.created.map((item: { kind: string }) => item.kind).sort(), ["review_notes", "update_fact"]);
  const waiting = await ok(dir, ["proposal", "list", "--waiting"]);
  const waitingIds = JSON.stringify(waiting);
  for (const item of queued.created) assert.ok(waitingIds.includes(item.id), `${item.id} waits for the next session`);
});

test("Keep as document with Only keep: only the kept part goes in; the original is a source only, What changed lists what was left out; origin part is refused (the author's answer of 2026-11-16)", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  // The row of the part, with Document asked ticked.
  const row = await ok(dir, ["source", "check"], { original, file: null, title: "Ops plan: the pilot", text: CHECKED_TEXT, changes: ["Dropped: Hiring (section 2)", "Dropped: Appendix A (budget)"], document_asked: true });
  assert.equal(row.properties["Document asked"], true);
  assert.equal(row.properties["What changed"], "Dropped: Hiring (section 2)\nDropped: Appendix A (budget)");

  // A part Document is no longer written: the part is the checked row.
  const part = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Ops plan: the pilot", frontmatter: { summary: "The pilot.", origin: "part", area: AREA, sources: [original] }, body: CHECKED_TEXT }] });
  assert.equal(part.json.error.code, "INPUT_INVALID");
  assert.equal(part.json.error.details[0].pointer, "/notes/0/frontmatter/origin");

  // On go: the row's source and its whole Document; nothing is taken in from the original, not even a whole Document of it.
  const taken = await ok(dir, ["note", "new"], { notes: [
    { ...checkedItem(original, { changes: ["Dropped: Hiring (section 2)", "Dropped: Appendix A (budget)"] }), id: "src-5k2m8q4w" },
    { type: "reference", title: "Ops plan: the pilot", frontmatter: { summary: "The pilot section.", origin: "whole", area: AREA, projects: [PROJECT], sources: ["src-5k2m8q4w"] }, body: CHECKED_TEXT },
  ] });
  assert.equal(taken.created.length, 2);
  const kept = parseFrontmatter(await readFile(join(dir, taken.created[1].path), "utf8"));
  assert.equal(kept.body.replace(/^\n/, ""), CHECKED_TEXT);
  assert.doesNotMatch(kept.body, /Hiring|Appendix|40k/, "only the kept part");
  const wholeOfOriginal = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Ops plan", frontmatter: { summary: "The whole plan.", origin: "whole", area: AREA, sources: [original] }, body: ORIGINAL_TEXT }] });
  assert.match(wholeOfOriginal.json.error.details[0].message, /^CHECKED_ORIGINAL: /);
  const index = await ok(dir, ["index"]);
  assert.equal(index.counts.reference, 2, "the fixture's learned Document and the kept part");
});

test("a checked row's source: the same row read twice is a duplicate, an edit set Ready again is a new version; bad fields are refused (cli §5.5)", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  const first = await ok(dir, ["note", "new"], { notes: [checkedItem(original)] });
  const again = await ok(dir, ["note", "new"], { notes: [checkedItem(original, {}, `${CHECKED_TEXT}\nA line you added.\n`)] });
  assert.deepEqual(again.skipped, [{ input_index: 0, reason: "DUPLICATE_SOURCE", existing: first.created[0].id }], "deduped by its key, as a capture");
  const version = await ok(dir, ["note", "new"], { notes: [checkedItem(original, { replaces: first.created[0].id }, `${CHECKED_TEXT}\nA line you added.\n`)] });
  assert.equal(version.created.length, 1);
  const sameText = await ok(dir, ["note", "new"], { notes: [checkedItem(original, { replaces: version.created[0].id }, `${CHECKED_TEXT}\nA line you added.\n`)] });
  assert.equal(sameText.skipped[0].reason, "DUPLICATE_SOURCE");

  const refused = async (frontmatter: Record<string, unknown>, pointer: string) => {
    const result = await run(dir, ["note", "new"], { notes: [checkedItem(original, { source_key: "notion:c1000000-0000-4000-8000-0000000000aa", notion: "c1000000-0000-4000-8000-0000000000aa", ...frontmatter })] });
    assert.equal(result.code === 0 ? "ok" : result.json.error.code, "INPUT_INVALID", JSON.stringify(frontmatter));
    assert.ok(result.json.error.details.some((detail: { pointer: string }) => detail.pointer === pointer), `${pointer}: ${JSON.stringify(result.json.error.details)}`);
  };
  await refused({ checked_from: "src-7w3c9k5m" }, "/notes/0/frontmatter/checked_from");
  await refused({ kind: "email" }, "/notes/0/frontmatter/kind");
  await refused({ changes: ["Removed the appendix"] }, "/notes/0/frontmatter/changes/0");
  await refused({ changes: [] }, "/notes/0/frontmatter/changes");
  await refused({ only_keep: "the pilot" }, "/notes/0/frontmatter/only_keep");
  await refused({ source_key: fileKey("changed.pdf") }, "/notes/0/frontmatter/source_key");
  const withoutFrom = await run(dir, ["note", "new"], { notes: [{ ...originalItem({ source_key: fileKey("x.pdf"), file_name: "x.pdf", changes: ["Dropped: x"] }), title: "X" }] });
  assert.equal(withoutFrom.json.error.details[0].pointer, "/notes/0/frontmatter/changes");
});

test("sync render publishes a checked row as a source: Brain ID, Done and Summary on its own page; its Name, Kind and body are yours (cli §5.14.4)", async (context) => {
  const dir = await fixtureCopy(context);
  const original = await setUp(dir);
  const taken = await ok(dir, ["note", "new"], { notes: [checkedItem(original, { summary: "The pilot section, checked." })] });
  const rendered = await ok(dir, ["sync", "render", "--ids", taken.created[0].id]);
  assert.equal(rendered.items.length, 1);
  const item = rendered.items[0];
  assert.equal(item.action, "update");
  assert.equal(item.page_id, CHECKED_ROW);
  assert.equal(item.body, null, "the text you checked is never rewritten");
  assert.equal(Object.hasOwn(item.properties, "Name"), false);
  assert.equal(Object.hasOwn(item.properties, "Kind"), false, "Kind Changed stays");
  for (const name of ["Changed from", "What changed"]) assert.equal(Object.hasOwn(item.properties, name), false);
  assert.deepEqual(item.properties["Brain Status"], { type: "select", value: "Done" });
  assert.deepEqual(item.properties["Brain ID"], { type: "rich_text", value: taken.created[0].id });
  assert.deepEqual(item.properties.Summary, { type: "rich_text", value: "The pilot section, checked." });

  // The original's row keeps its digest body and its own Kind.
  const originalRender = await ok(dir, ["sync", "render", "--ids", original]);
  assert.equal(originalRender.items[0].page_id, ORIGINAL_ROW);
});

test("the checked source has its original's lineage: a suppression on the original's input reaches it (capture-and-review §5.1)", () => {
  const sources = new Map<string, SourceInfo>([
    ["src-0r1g1nal", { id: "src-0r1g1nal", source_key: `notion:${ORIGINAL_ROW}` }],
    ["src-checked1", { id: "src-checked1", source_key: `notion:${CHECKED_ROW}`, checked_from: "src-0r1g1nal" }],
    ["src-checked2", { id: "src-checked2", source_key: `notion:${CHECKED_ROW}`, checked_from: "src-0r1g1nal", replaces: "src-checked1" }],
    ["src-checkedc", { id: "src-checkedc", source_key: "notion:c1000000-0000-4000-8000-0000000000cc", checked_from: "src-checked2" }],
    ["src-orphan01", { id: "src-orphan01", source_key: "notion:c1000000-0000-4000-8000-0000000000dd", checked_from: "src-missing1" }],
  ]);
  assert.equal(lineageOf("src-checked1", sources), ORIGINAL_ROW);
  assert.equal(lineageOf("src-checked2", sources), ORIGINAL_ROW, "a new version of the row");
  assert.equal(lineageOf("src-checkedc", sources), ORIGINAL_ROW, "a change asked after the row went in: its original is the checked source");
  assert.equal(lineageOf("src-orphan01", sources), null, "an unknown original is undetermined lineage");
});

test("meetings and captures behave as before: a capture is deduped by its row and keeps its body; minutes are never checked (0098 §7)", async (context) => {
  const dir = await fixtureCopy(context);
  await setUp(dir);
  const capture = { type: "source", title: "Call Lucía", frontmatter: { source_key: `notion:${CAPTURE_ROW}`, kind: "capture" }, body: "Call Lucía about the CMS.\n" };
  const first = await ok(dir, ["note", "new"], { notes: [capture] });
  const edited = await ok(dir, ["note", "new"], { notes: [{ ...capture, body: "Call Lucía about the CMS, Friday.\n" }] });
  assert.equal(edited.skipped[0].reason, "DUPLICATE_SOURCE");
  const rendered = await ok(dir, ["sync", "render", "--ids", first.created[0].id]);
  assert.equal(rendered.items[0].page_id, CAPTURE_ROW);
  assert.equal(rendered.items[0].body, null);
  assert.deepEqual(rendered.items[0].properties.Kind, { type: "select", value: "Capture", mode: "if_empty" });
  const fromMinutes = await run(dir, ["note", "new"], { notes: [checkedItem("src-7w3c9k5m")] });
  assert.match(fromMinutes.json.error.details[0].message, /minutes source/);
});
