import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { slugify } from "../src/lib/paths.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";

async function noteNew(dir: string, input: unknown, ...extra: string[]) {
  const file = join(dir, "..", "input.json");
  await writeFile(file, JSON.stringify(input));
  return brain(["note", "new", "--input", file, "--brain", dir, "--now", NOW, "--json", ...extra]);
}

const MINUTES = "## Summary\nPlanning call with Acme.\n";

/** A meeting, its source and a decision taken in it: a batch that references itself. */
function meetingBatch() {
  return {
    notes: [
      {
        type: "source", id: "src-4m9q2x7c", title: "Acme planning (Notion minutes)", file_date: "2026-12-09",
        frontmatter: { source_key: "notion:11111111-2222-4333-8444-555555555555" }, body: MINUTES,
      },
      {
        type: "meeting", id: "mtg-6b2d8f4h", title: "Acme planning",
        frontmatter: {
          summary: "Planning call with Acme.", date: "2026-12-09", attendees: ["per-3h8w2n6c"], source: "src-4m9q2x7c",
          decisions: ["dec-3f7k9m2q"], projects: ["prj-9x4t1b7e"], sources: ["src-4m9q2x7c"],
        },
        body: "## Summary\nPlanning call with [Maria López](../people/maria-lopez.md).",
      },
      {
        type: "decision", id: "dec-3f7k9m2q", title: "Ship the blog after launch",
        frontmatter: {
          summary: "The blog ships after the February launch.", date: "2026-12-09", assessment: "provisional",
          decided_in: "mtg-6b2d8f4h", area: "area-2m7c4h8n", projects: ["prj-9x4t1b7e"], sources: ["mtg-6b2d8f4h"],
        },
        body: "## Decision\nShip the blog after launch.\n",
      },
    ],
  };
}

test("slugs follow spec/cli.md §3.8", () => {
  assert.equal(slugify("María López — PM"), "maria-lopez-pm");
  assert.equal(slugify("¿¡!?"), "note");
  assert.equal(slugify("Ünïcödé  and  ﬁ ligatures"), "unicode-and-fi-ligatures");
  const long = "word ".repeat(20);
  assert.equal(slugify(long), "word-word-word-word-word-word-word-word-word-word-word-word");
  assert.equal(slugify("a".repeat(70)), "a".repeat(60));
});

test("note new writes a self-referencing batch in the canonical format and logs it", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, meetingBatch());
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data, {
    created: [
      { id: "src-4m9q2x7c", type: "source", title: "Acme planning (Notion minutes)", path: "sources/notion/2026-12-09-acme-planning-notion-minutes.md" },
      { id: "mtg-6b2d8f4h", type: "meeting", title: "Acme planning", path: "knowledge/meetings/2026-12-09-acme-planning.md" },
      { id: "dec-3f7k9m2q", type: "decision", title: "Ship the blog after launch", path: "knowledge/decisions/2026-12-09-ship-the-blog-after-launch.md" },
    ],
    skipped: [],
    dry_run: false,
  });

  assert.equal(
    await readFile(join(dir, "knowledge/decisions/2026-12-09-ship-the-blog-after-launch.md"), "utf8"),
    `---
id: dec-3f7k9m2q
type: decision
title: Ship the blog after launch
summary: The blog ships after the February launch.
lifecycle: draft
date: 2026-12-09
assessment: provisional
decided_in: mtg-6b2d8f4h
area: area-2m7c4h8n
projects: [prj-9x4t1b7e]
sources: [mtg-6b2d8f4h]
created: 2026-12-10
updated: 2026-12-10
---

## Decision
Ship the blog after launch.
`,
  );
  const source = await readFile(join(dir, "sources/notion/2026-12-09-acme-planning-notion-minutes.md"), "utf8");
  assert.ok(source.endsWith(`---\n${MINUTES}`), "a source has no blank line before its body");
  const sourceFields = parseFrontmatter(source).attributes;
  assert.equal(sourceFields.captured, NOW);
  assert.equal(sourceFields.lifecycle, undefined);
  assert.match(String(sourceFields.content_hash), /^sha256:[0-9a-f]{64}$/);
  const meeting = await readFile(join(dir, "knowledge/meetings/2026-12-09-acme-planning.md"), "utf8");
  assert.ok(meeting.endsWith("](../people/maria-lopez.md).\n"), "a trailing newline is added");

  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.ok(log.endsWith(
    '- 2026-12-10T09:00:00Z note-new src-4m9q2x7c "Acme planning (Notion minutes)"\n' +
    '- 2026-12-10T09:00:00Z note-new mtg-6b2d8f4h "Acme planning"\n' +
    '- 2026-12-10T09:00:00Z note-new dec-3f7k9m2q "Ship the blog after launch"\n',
  ));

  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.errors, 0, JSON.stringify(lint.json.data.issues));
});

test("note new generates ids and suffixes taken paths", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, {
    notes: [
      { type: "person", title: "Maria López", frontmatter: { summary: "A namesake.", sources: ["mtg-8c4n2p7w"] }, body: "" },
      { type: "project", title: "Acme website", frontmatter: { summary: "Second site.", area: "area-2m7c4h8n" }, body: "Why.\n" },
    ],
  });
  assert.equal(run.code, 0, run.stdout);
  const [person, project] = run.json.data.created;
  assert.match(person.id, /^per-[0-9a-hjkmnp-tv-z]{8}$/);
  assert.equal(person.path, "knowledge/people/maria-lopez-2.md");
  assert.equal(project.path, "projects/acme-website-2/project.md");
  assert.ok((await readFile(join(dir, person.path), "utf8")).endsWith("updated: 2026-12-10\n---\n"), "an empty body ends after ---");
});

test("note new returns lint warnings for the note it writes", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, {
    notes: [{ type: "person", title: "Warning example", frontmatter: { summary: "A synthetic person." }, body: "Currently available." }],
  });
  assert.equal(run.code, 0, run.stdout);
  assert.ok(run.json.warnings.some((warning: { code: string; path: string }) => warning.code === "FRESHNESS" && warning.path === "knowledge/people/warning-example.md"));
});

test("note new refuses a decision whose existing meeting does not list it, and writes nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const before = await readdir(join(dir, "knowledge/decisions"));
  const [, , decision] = meetingBatch().notes;
  const run = await noteNew(dir, {
    notes: [{ ...decision, frontmatter: { ...decision!.frontmatter, decided_in: "mtg-8c4n2p7w", sources: ["mtg-8c4n2p7w"] } }],
  });
  assert.equal(run.code, 4);
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/notes/0"]);
  assert.match(run.json.error.details[0].message, /^meeting-backref: /);
  assert.deepEqual(await readdir(join(dir, "knowledge/decisions")), before);
});

test("note new reports a missing reference against the input item", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, {
    notes: [{ type: "concept", title: "Edge caching", frontmatter: { summary: "S.", projects: ["prj-00000000"] }, body: "" }],
  });
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.equal(run.json.error.details[0].pointer, "/notes/0");
  assert.match(run.json.error.details[0].message, /^missing-ref: projects references prj-00000000/);
});

test("note new skips a source whose content was already captured", async (context) => {
  const dir = await fixtureCopy(context);
  const existing = parseFrontmatter(await readFile(join(dir, "sources/notion/2026-12-03-acme-sync-notion-minutes.md"), "utf8"));
  const run = await noteNew(dir, {
    notes: [{ type: "source", title: "Acme sync again", file_date: "2026-12-03", frontmatter: { source_key: "notion:3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f" }, body: existing.body }],
  });
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data, { created: [], skipped: [{ input_index: 0, reason: "DUPLICATE_SOURCE", existing: "src-7w3c9k5m" }], dry_run: false });
});

test("note new routes file and text sources, orders file metadata, and dedupes files and captures by key", async (context) => {
  const dir = await fixtureCopy(context);
  const fileKey = `file:sha256:${"a".repeat(64)}`;
  const captureKey = "notion:11111111-2222-4333-8444-555555555555";
  const first = await noteNew(dir, {
    notes: [
      {
        type: "source", title: "Acme brief", file_date: "2026-12-08",
        frontmatter: { source_key: fileKey, kind: "document", file_name: "acme-brief.pdf", converter: "markitdown 0.1.8" },
        body: "Converted file text.\n",
      },
      {
        type: "source", title: "Capture", file_date: "2026-12-08",
        frontmatter: { source_key: captureKey, kind: "capture" }, body: "First capture text.\n",
      },
      {
        type: "source", title: "Pasted email", file_date: "2026-12-08",
        frontmatter: { source_key: "agent:codex/session-1", kind: "email" }, body: "Pasted email text.\n",
      },
    ],
  });
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(first.json.data.created.map((note: { path: string }) => note.path), [
    "sources/files/2026-12-08-acme-brief.md",
    "sources/notion/2026-12-08-capture.md",
    "sources/text/2026-12-08-pasted-email.md",
  ]);
  const file = await readFile(join(dir, "sources/files/2026-12-08-acme-brief.md"), "utf8");
  assert.match(file, new RegExp(`^---\\nid: src-[0-9abcdefghjkmnpqrstvwxyz]{8}\\ntype: source\\ntitle: Acme brief\\nsource_key: ${fileKey}\\nkind: document\\nfile_name: acme-brief\\.pdf\\nconverter: markitdown 0\\.1\\.8\\ncontent_hash:`));

  const retry = await noteNew(dir, {
    notes: [
      { type: "source", title: "Changed converter output", file_date: "2026-12-09", frontmatter: { source_key: fileKey, kind: "document", file_name: "acme-brief.pdf", converter: "markitdown 0.1.9" }, body: "Different text.\n" },
      { type: "source", title: "Edited capture", file_date: "2026-12-09", frontmatter: { source_key: captureKey, kind: "capture" }, body: "Edited capture text.\n" },
    ],
  });
  assert.equal(retry.code, 0, retry.stdout);
  assert.deepEqual(retry.json.data, {
    created: [],
    skipped: [
      { input_index: 0, reason: "DUPLICATE_SOURCE", existing: first.json.data.created[0].id },
      { input_index: 1, reason: "DUPLICATE_SOURCE", existing: first.json.data.created[1].id },
    ],
    dry_run: false,
  });
});

test("note new rejects a URL source without document metadata", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, { notes: [{ type: "source", title: "Acme page", file_date: "2026-12-10", frontmatter: { source_key: "url:https://example.com/acme" }, body: "Fetched page.\n" }] });
  assert.equal(run.code, 4);
  assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/notes/0"]);
  for (const frontmatter of [
    { source_key: "url:https://example.com/acme", converter: "fetch" },
    { source_key: "url:https://example.com/acme", kind: "email", converter: "fetch" },
    { source_key: "url:https://example.com/acme", kind: "document" },
  ]) {
    const partial = await noteNew(dir, { notes: [{ type: "source", title: "Acme page", file_date: "2026-12-10", frontmatter, body: "Fetched page.\n" }] });
    assert.equal(partial.code, 4, JSON.stringify(frontmatter));
  }
});

test("note new validates input shape with pointers", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await noteNew(dir, {
    notes: [
      { type: "view", title: "x", frontmatter: {}, body: "" },
      { type: "person", title: "", frontmatter: { lifecycle: "reviewed", created: "2026-01-01" }, body: 3, extra: true },
      { type: "source", id: "per-3h8w2n6c", title: "s", file_date: "3 Dec", frontmatter: { content_hash: "sha256:00" }, body: "" },
    ],
    other: 1,
  });
  assert.equal(run.code, 4);
  assert.equal(run.json.error.code, "INPUT_INVALID");
  assert.deepEqual(run.json.error.details.map((detail: { pointer: string }) => detail.pointer).sort(), [
    "/notes/0/type",
    "/notes/1/body",
    "/notes/1/extra",
    "/notes/1/frontmatter/created",
    "/notes/1/frontmatter/lifecycle",
    "/notes/1/title",
    "/notes/2/file_date",
    "/notes/2/frontmatter/content_hash",
    "/notes/2/id",
    "/other",
  ]);
});

test("note new refuses ids in use and unreadable input", async (context) => {
  const dir = await fixtureCopy(context);
  const taken = await noteNew(dir, { notes: [{ type: "person", id: "per-3h8w2n6c", title: "Maria", frontmatter: { summary: "S." }, body: "" }] });
  assert.equal(taken.code, 4);
  assert.equal(taken.json.error.code, "ID_IN_USE");

  const missing = await brain(["note", "new", "--input", join(dir, "nope.json"), "--brain", dir, "--json"]);
  assert.equal(missing.json.error.code, "INPUT_UNREADABLE");
  const usage = await brain(["note", "new", "--brain", dir, "--json"]);
  assert.equal(usage.code, 2);
});

test("note new --dry-run validates and reports without writing", async (context) => {
  const dir = await fixtureCopy(context);
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  const run = await noteNew(dir, meetingBatch(), "--dry-run");
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.dry_run, true);
  assert.equal(run.json.data.created.length, 3);
  assert.deepEqual(await readdir(join(dir, "knowledge/meetings")), ["2026-10-01-acme-kickoff.md", "2026-12-03-acme-sync.md"]);
  assert.equal(await readFile(join(dir, "log/2026-12.md"), "utf8"), log);
});

test("note new restores what it wrote when a later write fails", async (context) => {
  const dir = await fixtureCopy(context);
  const { rm } = await import("node:fs/promises");
  // Paths are written in sorted order: knowledge/… first, then sources/notion/…, which is blocked by a file.
  await rm(join(dir, "sources/notion"), { recursive: true });
  await writeFile(join(dir, "sources/notion"), "not a folder");
  const run = await noteNew(dir, meetingBatch());
  assert.equal(run.code, 10, run.stdout);
  assert.equal(run.json.error.code, "INTERNAL");
  assert.deepEqual(await readdir(join(dir, "knowledge/meetings")), ["2026-10-01-acme-kickoff.md", "2026-12-03-acme-sync.md"]);
  assert.deepEqual(await readdir(join(dir, "knowledge/decisions")), ["2026-10-01-use-firebase-for-auth.md", "2026-12-03-use-supabase-for-auth.md"]);
});

test("note new keeps nothing when the log append fails, folders included", async (context) => {
  const dir = await fixtureCopy(context);
  const { mkdir, rm } = await import("node:fs/promises");
  await rm(join(dir, "log/2026-12.md"));
  await mkdir(join(dir, "log/2026-12.md"));
  const run = await noteNew(dir, { notes: [{ type: "project", title: "Zeta site", frontmatter: { summary: "S.", area: "area-2m7c4h8n" }, body: "" }] });
  assert.equal(run.code, 10, run.stdout);
  assert.deepEqual(await readdir(join(dir, "projects")), ["acme-website"]);
});

test("note new normalizes CRLF bodies, refuses them in sources, and checks file_date and dated paths", async (context) => {
  const dir = await fixtureCopy(context);
  const crlf = await noteNew(dir, { notes: [{ type: "concept", title: "Edge caching", frontmatter: { summary: "S.", sources: ["mtg-8c4n2p7w"] }, body: "Line one\r\nLine two" }] });
  assert.equal(crlf.code, 0, crlf.stdout);
  assert.ok((await readFile(join(dir, "knowledge/concepts/edge-caching.md"), "utf8")).endsWith("\n\nLine one\nLine two\n"));

  const bad = await noteNew(dir, {
    notes: [
      { type: "source", title: "s", frontmatter: { source_key: "notion:x" }, body: "a\r\nb\r\n" },
      { type: "memory", title: "m", file_date: "2026-99-99", frontmatter: {}, body: "" },
    ],
  });
  assert.deepEqual(bad.json.error.details.map((detail: { pointer: string }) => detail.pointer), ["/notes/0/body", "/notes/1/file_date"]);

  // A source's path comes from file_date, never from a stray `date` key.
  const source = await noteNew(dir, { notes: [{ type: "source", title: "Minutes", file_date: "2026-12-08", frontmatter: { source_key: "notion:11111111-2222-4333-8444-555555555555", date: "2020-01-01" }, body: "x\n" }] });
  assert.equal(source.code, 0, source.stdout);
  assert.equal(source.json.data.created[0].path, "sources/notion/2026-12-08-minutes.md");
});

test("note new refuses a batch that breaks an existing note", async (context) => {
  const dir = await fixtureCopy(context);
  // The fixture question was raised in mtg-8c4n2p7w; point it at a meeting that does not exist yet.
  const path = join(dir, "knowledge/questions/who-owns-the-acme-mobile-app.md");
  await writeFile(path, (await readFile(path, "utf8")).replace("raised_in: mtg-8c4n2p7w", "raised_in: mtg-6b2d8f4h"));
  const run = await noteNew(dir, meetingBatch());
  assert.equal(run.code, 4, run.stdout);
  assert.ok(run.json.error.details.some((detail: { pointer: string; message: string }) =>
    detail.pointer === "/notes" && detail.message.startsWith("knowledge/questions/who-owns-the-acme-mobile-app.md: meeting-backref")));
});
