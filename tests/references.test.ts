import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

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
  const created = await run(dir, ["note", "new"], { notes: [{ type: "reference", title, frontmatter: { summary: "What Acme requires of the website.", area: AREA, projects: [PROJECT], sources: [sourceId] }, body: REQUIREMENTS }] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0];
}

test("a reference validates, is listed under its project and renders to References with its body", async (context) => {
  const dir = await fixtureCopy(context);
  const document = await newSource(dir, source("Acme requirements v1", "document", REQUIREMENTS, { keep: "just the requirements" }));
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
  assert.ok(status.json.data.notion.missing.includes("references"));

  const unconfigured = await run(dir, ["sync", "render", "--ids", reference.id]);
  assert.deepEqual(unconfigured.json.data.items, []);
  assert.equal(unconfigured.json.warnings[0].code, "DATABASE_NOT_CONFIGURED");
  await configure(dir, "inbox", "a1000000-0000-4000-8000-00000000000b");
  const inboxOnly = await run(dir, ["sync", "render", "--ids", document.id]);
  assert.equal(inboxOnly.json.data.items[0].properties.References, undefined, "an Inbox without the References property gets none");

  await configure(dir, "references", "a1000000-0000-4000-8000-00000000000c");
  const [item] = (await run(dir, ["sync", "render", "--ids", reference.id])).json.data.items;
  assert.equal(item.database, "references");
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
  const refused = await run(dir, ["note", "new"], { notes: [{ type: "reference", title: "No sources", frontmatter: { summary: "Kept from nowhere." }, body: "x\n" }] });
  assert.equal(refused.json.error?.code, "INPUT_INVALID");
  assert.match(refused.stdout, /sources/);
});
