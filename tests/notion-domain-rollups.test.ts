// CC-343: the Domain rollups, the Domains page template's views and no Domains · Type, in the Notion design and migration 0028 (decision 0105). Text checks only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = "notion/migrations/0028-first-things-first-and-domains.md";
const DESCRIPTION = "Owner: Notion. Derived from the Area's Domain; you never edit it.";

/** The current design files, prompts and guides: none may list Domains · Type (0105 §3). Migration 0016 and its history are left out. */
const CURRENT = [
  "docs/notion-space-design.md",
  "notion/prompts/02-databases.md",
  "notion/prompts/03-relations.md",
  "notion/prompts/05-ownership.md",
  "notion/prompts/06-templates.md",
  "notion/modules/domains.md",
  "notion/modules/documents.md",
  "notion/views-guide.md",
  "notion/TEMPLATE.md",
  "notion/template-examples.md",
  "notion/CHECKLIST.md",
];

test("no current design file, prompt or guide gives Domains a Type", async () => {
  for (const path of CURRENT) {
    const text = await read(path);
    assert.ok(!text.includes("Entrepreneurship") || /no Type \(0\.16\.1/.test(text), `${path} lists Type's options`);
    assert.ok(!/Show Type|Type, Areas|Domain's \*\*Type\*\*|Set each Domain's/.test(text), `${path} shows or sets a Domain's Type`);
  }
  const prompt2 = await read("notion/prompts/02-databases.md");
  const domains = prompt2.split("\n").find((l) => l.startsWith('11. "Domains":'));
  assert.ok(domains && !domains.includes("Type"), "prompt 2 builds Domains without Type");
  const prompt5 = await read("notion/prompts/05-ownership.md");
  assert.ok(!/Relationship, Type,/.test(prompt5), "prompt 5 no longer describes a Type");
});

test("a new space and migration 0028 build the same three rollups with the same description", async () => {
  const prompt3 = await read("notion/prompts/03-relations.md");
  assert.match(prompt3, /rollups, each named "Domain": over the relation "Area", property "Domain" \(the Area's Domain\), calculated as Show original/);
  for (const database of ['- in "Projects"', '- in "Meetings"', '[Documents] - in "Documents"']) assert.ok(prompt3.includes(database), `prompt 3 adds it ${database}`);
  const prompt5 = await read("notion/prompts/05-ownership.md");
  assert.ok(prompt5.includes(`"${DESCRIPTION}" for Domain in "Projects", "Meetings" and "Documents"`));
  const migration = await read(MIGRATION);
  assert.ok(migration.includes(`"relation_property_name": "Area", "rollup_property_name": "Domain", "function": "show_original"`));
  assert.ok(migration.includes(`"description": "${DESCRIPTION}"`));
  const documents = await read("notion/modules/documents.md");
  assert.ok(documents.includes(DESCRIPTION), "turning Documents on later adds its rollup with the same description");
});

test("migration 0028's Domains part: rollups, Type after a yes, the template views, layouts, and a rerun adds nothing", async () => {
  const migration = await read(MIGRATION);
  assert.match(migration.split("\n")[0], /^# 0028 · First things first, and Domains/);
  const order = ["## Part B · Domains (0105)", "### B1 · ", "### B2 · ", "### B3 · ", "### B4 · ", "### B5 · ", "## What this migration doesn't do", "## Verify"];
  const at = order.map((h) => migration.indexOf(h));
  at.forEach((i, n) => assert.ok(i >= 0, `${order[n]} is there`));
  assert.deepEqual([...at].sort((a, b) => a - b), at, "in order");
  const d1 = migration.slice(at[1], at[2]);
  assert.match(d1, /\*\*A rollup over Area → Domain with Show original:\*\* add nothing/);
  assert.match(d1, /Never rename or replace their property/);
  const d2 = migration.slice(at[2], at[3]);
  assert.match(d2, /after your yes/);
  assert.match(d2, /Deleting a property deletes its values, and Notion's undo for it lasts only while the page is open/);
  assert.match(d2, /\*\*No Type:\*\* nothing to do here/);
  assert.match(d2, /With the user's yes, remove it: a data source update with `\{"Type": null\}`/);
  assert.match(migration.slice(at[3], at[4]), /Domain contains This page/);
  const verify = migration.slice(at[7]);
  assert.match(verify, /\nPart B, Domains \(decision 0105\):\n/);
  for (const text of ["Running B1 again reports nothing to add", "running B2 again has nothing to do", "lists its projects, meetings and documents"]) assert.ok(verify.includes(text), `Verify says ${text}`);
  const readme = await read("notion/migrations/README.md");
  const row = readme.split("\n").find((l) => l.startsWith("| [0028](0028-first-things-first-and-domains.md)"));
  assert.ok(row, "the README lists 0028");
  for (const text of ["First things first", "Domain rollup", "Domains · Type", "0103", "0105", "CC-337", "CC-343"]) assert.ok(row.includes(text), `the README line names ${text}`);
});

test("the Domains page template lists projects, meetings and documents, and the template's Example Domain lists all three", async () => {
  const guide = await read("notion/views-guide.md");
  const section = guide.slice(guide.indexOf("## 9a. The Domains page template"), guide.indexOf("## 10. Navigation"));
  for (const database of ["| Projects | Projects |", "| Meetings | Meetings |", "| Documents | Documents |"]) assert.ok(section.includes(database));
  assert.equal(section.match(/\*\*Domain\*\* contains \*\*This page\*\*/g)?.length, 3);
  const design = await read("docs/notion-space-design.md");
  const row = design.split("\n").find((l) => l.startsWith("| Domains | Areas and"));
  assert.ok(row && row.includes("Domain contains This page") && row.includes("No Type"));
  for (const section of ["### 3.4 Projects", "### 3.5 Meetings", "### 3.14 Documents"]) {
    const start = design.indexOf(section);
    const body = design.slice(start, design.indexOf("\n### ", start + 1));
    assert.match(body, /\| Domain \| Rollup: Area → Domain, Show original/, `${section} has the Domain rollup`);
  }
  const examples = await read("notion/template-examples.md");
  const document = examples.split("\n").find((l) => l.startsWith("| 11 | Documents |"));
  const meeting = examples.split("\n").find((l) => l.startsWith("| 6 | Meetings |"));
  const project = examples.split("\n").find((l) => l.startsWith("| 5 | Projects |"));
  for (const row of [document, meeting, project]) assert.ok(row?.includes("Area → 2"), "the Example project, meeting and document are in the Example Area");
  assert.match(examples, /\| 2 \| Areas \| `Example · Clients` \| \| Domain → 1 \|/);
});
