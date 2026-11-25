import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter } from "../src/lib/frontmatter.ts";
import { textHash } from "../src/lib/wording.ts";
import { approveNote, brain, fixtureCopy } from "./helpers.ts";

// CC-402: a date mention has one written form, its plain_text in a block read (cli §5.14.7 "Date mentions"). The skills
// convert; the CLI reads no page. So the conversion here only checks that the fixture's two replies of one page (invented
// ids) agree with the contract's table, and the rest pins what the CLI does with the texts the skills send.

const FIXTURE = join(import.meta.dirname, "fixtures", "date-mentions");
const fixture = (name: string) => readFile(join(FIXTURE, name), "utf8");
const EXPECTED = await fixture("expected.md");
const NOW = "2026-12-10T10:05:00Z";
const LATER = "2026-12-10T11:05:00Z";
const PAGE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const INPUT_PAGE = "11111111-2222-4333-8444-555555555555";

/** The contract's table, read from the Markdown read's tag; any other tag is read from its block. */
function written(tag: string): string {
  const attributes = Object.fromEntries([...tag.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
  const keys = Object.keys(attributes).sort().join(" ");
  if (keys === "start") return attributes.start!;
  if (keys === "end start") return `${attributes.start} → ${attributes.end}`;
  const zone = /^Etc\/GMT([+-])(\d{1,2})$/.exec(attributes.timeZone ?? "");
  assert.ok(keys === "start startTime timeZone" && zone, `not in the table: ${tag}`);
  return `${attributes.start}T${attributes.startTime}:00.000${zone[1] === "-" ? "+" : "-"}${zone[2]!.padStart(2, "0")}:00`;
}
/** The Markdown read's blocks (one line each in the fixture), joined by one blank line. */
const fromMarkdown = (markdown: string, date: (tag: string) => string) => `${markdown.split("\n").map((line) => line.replace(/<mention-date [^>]*\/>/g, date)).join("\n\n")}\n`;
type Item = { plain_text: string; annotations: { bold: boolean } };
const fromBlocks = (blocks: Array<Record<string, any>>) => `${blocks.map((block) => (block.type === "heading_2" ? "## " : "")
  + (block[block.type].rich_text as Item[]).map((item) => item.annotations.bold ? `**${item.plain_text}**` : item.plain_text).join("")).join("\n\n")}\n`;

const MARKDOWN_READ = JSON.parse(await fixture("markdown-read.json")).markdown as string;
const BLOCK_READ = JSON.parse(await fixture("block-read.json")).results as Array<Record<string, any>>;
/** The same page as a run before 0.18.0 may have recorded it: each date as the tag. */
const TAGS = fromMarkdown(MARKDOWN_READ, (tag) => tag);
const DATES = ["2026-11-14", "2026-11-14T10:30:00.000+01:00", "2026-11-14 → 2026-11-16"];

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

/** Every file of the brain with its bytes, git's own folder aside. */
async function tree(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    if (entry.isFile() && !/^\.git[\\/]/.test(relative(dir, path))) files[relative(dir, path)] = createHash("sha256").update(await readFile(path)).digest("hex");
  }
  return files;
}

/** A promoted Document whose body, in Git and at its last read-back, is `text`. */
async function documentHolding(dir: string, text: string): Promise<string> {
  await approveNote(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md");
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "Pilot dates", frontmatter: { summary: "The pilot's dates.", origin: "promoted", promoted_from: "dec-7k2m9q4x" }, body: text }] });
  assert.equal(created.code, 0, created.stdout);
  const file = join(dir, created.json.data.created[0].path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  document.attributes.notion = PAGE;
  document.attributes.notion_published = { "@content": textHash(text), "@notion_body": textHash(text), "@git_body": textHash(text) };
  await writeFile(file, serializeFrontmatter(document));
  return created.json.data.created[0].id;
}

async function plan(dir: string, body: string, accepted: boolean) {
  const wording = { accepted, accepted_at: accepted ? "2026-12-10T10:00:00Z" : null, page_edited_at: "2026-12-10T10:00:00Z", body_markdown: body, unconvertible: false, pending_revision: false, pending_refresh: false };
  const result = await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "documents", page_id: PAGE, last_edited: "2026-12-10T10:00:00Z", properties: {}, wording }] });
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

test("the fixture's two replies give one Markdown, byte for byte, with one fingerprint (cli §5.14.7)", () => {
  assert.equal(fromBlocks(BLOCK_READ), EXPECTED);
  assert.equal(fromMarkdown(MARKDOWN_READ, written), EXPECTED);
  assert.equal(textHash(fromBlocks(BLOCK_READ)), textHash(fromMarkdown(MARKDOWN_READ, written)));
  const mentions = BLOCK_READ.flatMap((block) => block[block.type].rich_text).filter((item) => item.type === "mention").map((item) => item.plain_text);
  assert.deepEqual(mentions, DATES, "the three mentions of CC-387's table");
  assert.equal(written('<mention-date start="2026-11-14" startTime="10:30" timeZone="Etc/GMT+5"/>'), "2026-11-14T10:30:00.000-05:00", "an Etc/GMT name has its sign reversed");
  assert.throws(() => written('<mention-date start="2026-11-14" startTime="10:30" timeZone="Europe/Madrid"/>'), /not in the table/);
});

for (const [name, recorded] of [["a block read", EXPECTED], ["the tags, sent in that form", TAGS]] as const) {
  test(`a body recorded from ${name} plans nothing when its page is unchanged, and no file changes`, async (context) => {
    const dir = await fixtureCopy(context);
    const id = await documentHolding(dir, recorded);
    const before = await tree(dir);
    for (const accepted of [false, true]) {
      const planned = await plan(dir, recorded, accepted);
      assert.deepEqual([planned.accepted_wording, planned.wording_held, planned.wording_waiting, planned.updates, planned.conflicts], [[], [], [], [], []]);
      assert.deepEqual(planned.clear_accepted.map((entry: { note: string; fingerprint: string }) => [entry.note, entry.fingerprint]), accepted ? [[id, textHash(recorded)]] : [], "an acceptance is consumed without an import");
      const applied = await run(dir, ["sync", "apply"], planned, LATER);
      assert.equal(applied.code, 0, applied.stdout);
    }
    assert.deepEqual(await tree(dir), before);
  });
}

test("the same body in the other form would be a false edit: why a page read before is tried in its earlier form", async (context) => {
  const dir = await fixtureCopy(context);
  await documentHolding(dir, TAGS);
  assert.equal((await plan(dir, EXPECTED, false)).wording_held[0].reason, "UNACCEPTED_DRAFT");
  assert.equal((await plan(dir, EXPECTED, true)).accepted_wording.length, 1);
});

test("a text property with the three mentions normalizes to this form (cli §5.14.10)", async (context) => {
  const dir = await fixtureCopy(context);
  const rich = BLOCK_READ.flatMap((block) => block[block.type].rich_text).filter((item) => item.type === "mention")
    .flatMap((item) => [item, { type: "text", text: { content: "; " }, plain_text: "; " }]);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  const reply = { object: "list", has_more: false, next_cursor: null, results: [{ object: "page", id: PAGE, last_edited_time: "2026-12-10T08:00:00.000Z", in_trash: false, parent: { type: "data_source_id", database_id: config.notion.databases.people },
    properties: { Name: { type: "title", title: [{ type: "text", text: { content: "Maria" }, plain_text: "Maria" }] }, Summary: { type: "rich_text", rich_text: rich } } }] };
  const [input, output] = [join(dir, "..", "reply.json"), join(dir, "..", "snapshot.json")];
  await writeFile(input, JSON.stringify(reply));
  const result = await brain(["sync", "snapshot", "--input", input, "--output", output, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(JSON.parse(await readFile(output, "utf8")).rows[0].properties.Summary, `${DATES.join("; ")}; `);
});

test("an extract whose transcript is sent in its earlier form keeps its transcript_hash and suppresses nothing", async (context) => {
  const dir = await fixtureCopy(context);
  // source extract commits what it writes.
  for (const args of [["init", "-q"], ["config", "user.email", "t@example.com"], ["config", "user.name", "T"], ["add", "-A"], ["commit", "-q", "-m", "fixture"]]) execFileSync("git", args, { cwd: dir });
  const [summary, transcript] = [join(dir, "..", "summary.md"), join(dir, "..", "transcript.md")];
  await writeFile(summary, "## [s1] Pilot\nSelection: Use in brain\n- [s1.i1] The offer has a close date “The offer closes on 14 Nov 2026”\n- [s1.i2] A site visit “and nothing else moved”\n");
  await writeFile(transcript, TAGS);
  const files = ["--page", INPUT_PAGE, "--summary", summary, "--transcript", transcript];
  const made = await brain(["source", "extract", ...files, "--title", "Pilot call", "--date", "2026-12-10", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(made.code, 0, made.stdout);
  const id = made.json.data.created[0] as string;
  const before = await tree(dir);
  const again = async (text: string) => {
    await writeFile(transcript, text);
    const result = await brain(["source", "extract-plan", ...files, "--previous", id, "--brain", dir, "--json"]);
    assert.equal(result.code, 0, result.stdout);
    return result.json.data;
  };
  const earlier = await again(TAGS);
  assert.equal(earlier.previous.transcript_changed, false);
  assert.deepEqual(earlier.previous.suppressed, []);
  assert.equal(earlier.write_required, false);
  const note = parseFrontmatter(await readFile(join(dir, made.json.data.path), "utf8"));
  assert.equal(earlier.transcript_hash, note.attributes.transcript_hash);
  // Why the earlier form is tried: the same page in the new form alone would suppress every paragraph of the extract.
  const alone = await again(EXPECTED);
  assert.equal(alone.previous.transcript_changed, true);
  assert.deepEqual(alone.previous.suppressed, earlier.passages.map((passage: { n: number }) => passage.n));
  assert.deepEqual(await tree(dir), before);
});

for (const kind of ["capture", "task"]) {
  test(`a ${kind} read again unchanged, its text sent in the form the source holds, is DUPLICATE_SOURCE and changes no file`, async (context) => {
    const dir = await fixtureCopy(context);
    const note = (body: string, frontmatter = {}) => ({ notes: [{ type: "source", title: "Pilot dates", file_date: "2026-12-10", frontmatter: { kind, source_key: `notion:${INPUT_PAGE}`, ...(kind === "capture" ? { notion: INPUT_PAGE } : {}), ...frontmatter }, body }] });
    const first = await run(dir, ["note", "new"], note(TAGS));
    assert.equal(first.code, 0, first.stdout);
    const [source] = first.json.data.created;
    const before = await tree(dir);
    const replaces = { replaces: source.id };
    const changed = await run(dir, ["note", "new", "--dry-run"], note(EXPECTED, replaces));
    assert.equal(changed.json.data.skipped.length, 0, "in the new form alone it would be a new version");
    const same = await run(dir, ["note", "new"], note(TAGS, replaces));
    assert.equal(same.code, 0, same.stdout);
    assert.deepEqual(same.json.data.skipped.map((entry: { reason: string; existing: string }) => [entry.reason, entry.existing]), [["DUPLICATE_SOURCE", source.id]]);
    assert.deepEqual(await tree(dir), before);
  });
}
