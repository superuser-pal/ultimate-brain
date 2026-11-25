// CC-399: Domain homes, Factories and Home's card per Domain (decisions 0113, 0114): migration 0031, the prompts, the
// module file, the views guide and the template's documents describe the same space. Text checks only.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = "notion/migrations/0031-domain-homes-factories-and-home-cards.md";
const DOMAIN = "Owner: Notion. Derived from the Area's Domain; you never edit it.";

function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from);
  assert.ok(start >= 0, `has ${from}`);
  const end = text.indexOf(to, start + from.length);
  return text.slice(start, end < 0 ? undefined : end);
}

/** A Markdown table's rows as cells, the header and separator left out. */
function rows(section: string): string[][] {
  return section.split("\n").filter((l) => l.startsWith("|")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim())).slice(2);
}

test("migration 0031 is 0.18.0's one migration: parts by module, and every step says whether it is done and who does it", async () => {
  const files = await readdir(join(root, "notion/migrations"));
  assert.equal(files.filter((f) => f.startsWith("0031-")).length, 1);
  const migration = await read(MIGRATION);
  const parts = ["## Part A · ", "## Part B · ", "## Part C · ", "## Part D · ", "## Part E · ", "## The last steps", "## What this migration doesn't do", "## Verify"];
  const at = parts.map((p) => migration.indexOf(p));
  at.forEach((i, n) => assert.ok(i >= 0, `${parts[n]} is there`));
  assert.deepEqual([...at].sort((a, b) => a - b), at, "in order");
  for (const step of ["## Part A · ", "### B1 · ", "### B2 · ", "### B3 · ", "## Part C · ", "### E1 · ", "### E2 · ", "### E3 · ", "### L1 · "]) {
    const heading = migration.slice(migration.indexOf(step)).split("\n")[0];
    const body = between(migration, step, "\n##");
    assert.match(body, /\*\*Already done\?\*\*/, `${heading}: has its check`);
    if (step !== "### B2 · ") assert.match(heading, /agent|by hand/, `${heading}: says who`);
  }
  for (const [step, , who, done] of rows(between(migration, "## Part D · ", "## Part E · "))) {
    assert.match(who, /agent|by hand/, `${step}: says who`);
    assert.ok(done.length > 20, `${step}: has its check`);
  }
  for (const [part, , skip] of rows(between(migration, "| Part | For |", "\nRun it after"))) assert.ok(skip.length > 0, `${part}: says when a space skips it`);
  assert.match(migration, /change it to `Template version: 0031`/);
  const readme = await read("notion/migrations/README.md");
  assert.match(readme, /\[0031\][^\n]*0\.18\.0's one migration[^\n]*CC-399 \(release 0\.18\.0\)[^\n]*CC-384[^\n]*CC-386[^\n]*\|$/m);
  const version = (await read("notion/TEMPLATE.md")).match(/\| \*\*Template version\*\* \| `(\d{4})` \|/)?.[1];
  assert.ok(version && version >= "0031", "the template includes it");
});

test("a new space, the modules and migration 0031 give Tasks, Inbox, Goals and Factories the same Domain", async () => {
  const prompt3 = await read("notion/prompts/03-relations.md");
  for (const line of ['[Tasks] - in "Tasks"', '\n- in "Inbox"', '[Planning] - in "Goals"', '[Factories] - in "Factories"']) assert.ok(prompt3.includes(line), `prompt 3: ${line}`);
  const prompt5 = await read("notion/prompts/05-ownership.md");
  assert.ok(prompt5.split("\n").some((l) => l.startsWith("1b.") && l.includes(`"${DOMAIN}"`) && l.includes('"Tasks", "Inbox", "Goals" and "Factories"')));
  for (const path of [MIGRATION, "notion/modules/tasks.md", "notion/modules/planning.md", "notion/modules/factories.md"]) assert.ok((await read(path)).includes(DOMAIN), `${path} has the description`);
  assert.ok((await read(MIGRATION)).includes('"relation_property_name": "Area", "rollup_property_name": "Domain", "function": "show_original"'));
});

test("Factories: the prompts and the module file build the same database, relations and descriptions", async () => {
  const module = await read("notion/modules/factories.md");
  const prompt2 = await read("notion/prompts/02-databases.md");
  const list = "Name (title), Workflow (select: Standard, Connected), Overview as of (date), Archived (checkbox), Brain ID (text), Last Synced (date)";
  assert.ok(prompt2.includes(`[Factories] 12. "Factories": ${list}.`));
  assert.ok(module.includes(`"Factories" with: ${list}.`));
  for (const name of ["Name", "Workflow", "Overview as of", "Archived", "Brain ID", "Last Synced"]) assert.ok(module.includes(`"${name}": {`), `the agent's JSON has ${name}`);
  const prompt3 = await read("notion/prompts/03-relations.md");
  for (const relation of ['Factories "Area" ↔ Areas "Factories"', 'Factories "Projects" ↔ Projects "Factories"', 'Tasks "Factory" ↔ Factories "Tasks"']) {
    assert.ok(prompt3.includes(relation), `prompt 3: ${relation}`);
    assert.ok(module.includes(relation), `factories.md: ${relation}`);
  }
  const prompt5 = await read("notion/prompts/05-ownership.md");
  const descriptions = [...between(module, "| Property | Description |", "\nNotion takes").matchAll(/"(Owner: [^"]+)"/g)].map((m) => m[1]);
  assert.equal(descriptions.length, 8);
  for (const d of descriptions) assert.ok(prompt5.includes(`"${d}"`), `prompt 5 sets: ${d}`);
  assert.ok((await read("notion/prompts/07c-projects.md")).includes('"Where is work being built?"'));
});

test("the views guide's Domain home is the design's, view by view, and Home changes only with Domains on", async () => {
  const design = rows(between(await read("docs/notion-space-design.md"), "| Heading | Tab | Database | Also filtered by |", "\nThen a toggle"));
  const guide = await read("notion/views-guide.md");
  const section = rows(between(guide, "| Heading | View name | Database | Layout |", "\nThen a toggle"));
  assert.equal(section.length, 13);
  assert.equal(design.length, 13);
  design.forEach(([heading, tab, database, , , shows, module], i) => {
    const [h, name, db, , , , s, m] = section[i];
    assert.deepEqual([h, db, s, m], [heading, database, shows, module], `row ${i + 1}`);
    assert.equal(name, tab === "—" ? database : tab, `row ${i + 1}'s name`);
  });
  const prompt = await read("notion/prompts/07a-home.md");
  for (const line of ['[Domains] 5b. Tab "Domains", first', '[Domains off] 5b. Tab "Areas", first', "[Domains off] 8. Tab \"Projects\"", '[Domains off] [Tasks] In the same tab']) assert.ok(prompt.includes(line), line);
  const home = between(guide, "## 1. Home", "## 2. Tasks");
  for (const view of ["| 0c | Domains *(Domains)* | Which domain? |", "| 0d | Domains *(Domains)* | Which areas have no domain? |", "| 0 | Areas *(Domains off)* |", "| 5 | Projects *(Domains off)* |"]) assert.ok(home.includes(view), view);
  for (const path of ["notion/TEMPLATE.md", "notion/views-guide.md", MIGRATION]) assert.ok((await read(path)).includes("Domains, Areas, Tasks, Meetings, Projects, Inbox"), `${path}: the template's Home holds both sets`);
});

test("the Example Factory: one row in every list, and the count is the same everywhere", async () => {
  const examples = await read("notion/template-examples.md");
  assert.match(examples, /\| 14 \| Factories \| `Example · Northwind website` \|[^\n]*\| Area → 2, Projects → 5 \|/);
  const template = await read("notion/TEMPLATE.md");
  assert.match(template, /\| Factories \| `Example · Northwind website` \|/);
  assert.match(template, /Fourteen invented rows/);
  assert.match(examples, /Each of the fourteen rows exists once/);
  assert.match(await read("spec/setup.md"), /carries fourteen invented rows/);
  assert.match(await read("docs/notion-space-design.md"), /\(fourteen, in its twelve databases,/);
});
