// CC-311: the Notion part of the checked row (0098 §4) and Keep as document on Tasks (0100), added to 0.16.0's one migration (CC-331). Text checks only.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { MIGRATION_0_16_0, notionMigrations, notionMigrationsLine } from "../src/lib/notion-migrations.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = `notion/migrations/${MIGRATION_0_16_0}`;

/** The description a Notion step sets for a property: the quoted "Owner: …" text right before `for <property> in "<database>"`. */
function promptDescription(prompt: string, property: string, database: string): string | undefined {
  const pattern = new RegExp(`"(Owner: [^"]*)" for ${property} in "${database}"`);
  return pattern.exec(prompt)?.[1];
}

/** The description migration 0027 sets for a property: the backquoted "Owner: …" text on the line that names it. */
function migrationDescription(migration: string, property: string): string | undefined {
  const line = migration.split("\n").find((l) => l.trimStart().startsWith(`- ${property}: \`Owner: `));
  return line === undefined ? undefined : /`(Owner: [^`]*)`/.exec(line)?.[1];
}

test("0.16.0 has one Notion migration, and brain upgrade names it to a space at 0026", async () => {
  const files = (await readdir(join(root, "notion", "migrations"))).filter((f) => /^[0-9]{4}-.+\.md$/.test(f)).sort();
  // 0.16.0's is 0027; the next number is 0.16.1's one migration (0028, CC-337 and CC-343), so CC-311's part is in 0027, not in a 0028 of 0.16.0.
  assert.equal(files.filter((f) => f.startsWith("0027-")).length, 1);
  assert.ok(files.includes(MIGRATION_0_16_0));
  assert.equal(files.filter((f) => f > MIGRATION_0_16_0)[0], "0028-first-things-first-and-domains.md");
  const migrations = await notionMigrations(root, { notion: { template_version: "0026", databases: { review: "x" } } });
  assert.equal(migrations.newer?.[0], MIGRATION_0_16_0);
  assert.deepEqual(migrations.newer, [MIGRATION_0_16_0, ...files.filter((f) => f > MIGRATION_0_16_0)]);
  const lines = notionMigrationsLine(root, migrations);
  assert.match(lines, /migrations? newer than your space: .*0027-one-place-to-decide\.md/);
  assert.match(lines, /Review database\. Ask your agent to apply the 0\.16\.0 Notion migration \(.*0027-one-place-to-decide\.md\)/);
});

test("migration 0027 runs part C after CC-299's parts and before the last steps, and its title, Verify list and README line cover it", async () => {
  const migration = await read(MIGRATION);
  assert.ok(!migration.includes("<!-- CC-311"), "the placeholders are replaced");
  const order = ["## Part A · Review", "### B8 · ", "## Part C · ", "### C1 · ", "### C2 · ", "### C3 · ", "### C4 · ", "## The last steps", "### L1 · "];
  const at = order.map((h) => migration.indexOf(h));
  at.forEach((i, n) => assert.ok(i >= 0, `${order[n]} is there`));
  assert.deepEqual([...at].sort((a, b) => a - b), at, "in order");
  assert.match(migration, /in the order below: part A, then part B, then part C, then the last steps/);
  assert.match(migration.split("\n")[0], /^# 0027 · .*Keep as document.*changed versions/);
  const verify = migration.slice(migration.indexOf("## Verify"));
  const parts = ["Part A:", "Part B:", "Part C:", "The last steps:"].map((p) => verify.indexOf(`\n${p}\n`));
  parts.forEach((i) => assert.ok(i > 0));
  assert.deepEqual([...parts].sort((a, b) => a - b), parts);
  const partC = verify.slice(parts[2], parts[3]);
  for (const name of ["Changed", "Changed from", "What changed", "Document asked", "Keep as document", "Task"]) assert.ok(partC.includes(name), `Part C's Verify names ${name}`);
  const readme = await read("notion/migrations/README.md");
  const row = readme.split("\n").find((l) => l.startsWith("| [0027]"));
  assert.ok(row);
  for (const text of ["Changed from", "What changed", "Document asked", "Keep as document", "Documents gains Task", "0098 §4", "0100", "CC-311"]) assert.ok(row.includes(text), `the README line names ${text}`);
});

test("a new space and migration 0027 get the same properties and descriptions for the checked row and Keep as document on Tasks", async () => {
  const migration = await read(MIGRATION);
  const prompt5 = await read("notion/prompts/05-ownership.md");
  const pairs: [string, string][] = [["Changed from", "Inbox"], ["What changed", "Inbox"], ["Only keep", "Inbox"]];
  for (const [property, database] of pairs) {
    const fromMigration = migrationDescription(migration, property);
    assert.ok(fromMigration, `migration 0027 sets ${property}`);
    assert.equal(promptDescription(prompt5, property, database), fromMigration, `${database} · ${property}`);
  }
  const c3 = migration.slice(migration.indexOf("### C3 · "), migration.indexOf("### C4 · "));
  const taskInMigration = /described `(Owner: [^`]*)`/.exec(c3)?.[1];
  assert.ok(taskInMigration, "C3 sets Documents · Task's description");
  assert.equal(promptDescription(prompt5, "Task", "Documents"), taskInMigration);
  const askedInMigration = /\*\*Document asked\*\*, a checkbox, described `(Owner: [^`]*)`/.exec(migration)?.[1];
  assert.ok(askedInMigration);
  assert.ok(prompt5.includes(`"${askedInMigration}" for Document asked in "Inbox" and in "Tasks"`));
  assert.ok((await read("notion/modules/tasks.md")).includes(`"${askedInMigration}"`));
  assert.ok((await read("notion/modules/documents.md")).includes(`"${promptDescription(prompt5, "Task", "Documents")}"`));

  const prompt2 = await read("notion/prompts/02-databases.md");
  assert.match(prompt2, /"Inbox": Name \(title\), Kind \(select: [^)]*, Weekly, Changed; default Capture\), Summary \(text\), What changed \(text\),/);
  assert.match(prompt2, /\[Tasks\] 9\. "Tasks": .*Kind \(select: Task, Question, Risk\), Document asked \(checkbox\),/);
  const prompt3 = await read("notion/prompts/03-relations.md");
  assert.match(prompt3, /one-way relations/);
  assert.match(prompt3, /^- Inbox "Changed from" → Inbox/m);
  assert.match(prompt3, /^\[Documents\] \[Tasks\] - Documents "Task" → Tasks$/m);
  assert.match(migration, /Add \*\*Changed from\*\*, a relation from the Inbox to the Inbox itself, one-way: .*"single_property"/);
  assert.match(migration, /Add \*\*Task\*\* to Documents, a relation to the Tasks database .*one-way: .*"single_property"/);
});

test("the design, the views guide and the module guides agree on the Tasks button and the layouts", async () => {
  const design = await read("docs/notion-space-design.md");
  for (const property of ["| Changed from | Relation → Inbox (one-way)", "| What changed | Text", "| Document asked | Checkbox | You, through the Keep as document button: \"waiting for the brain\". The next catch-up keeps the task's page", "| Task | Relation → Tasks (one-way)"]) {
    assert.ok(design.includes(property), property);
  }
  assert.match(design, /\| Keep \| Keep as document \| Tasks \(0\.16\.0, 0100\) \| Document asked \| — \| Tasks \(acted on with Documents\) \|/);
  const guide = await read("notion/views-guide.md");
  assert.match(guide, /^\| Keep \| Keep as document \| Tasks \| Document asked → checked \(nothing else: decision 0100\) \|/m);
  assert.match(guide, /^\| Tasks \| Keep, Status, Due, Kind \| Panel · Document asked, /m);
  assert.match(guide, /^\| Inbox \| .* \| Main · Document asked, Only keep, Kind, Changed from, What changed, /m);
  assert.match(guide, /^\| Documents \| .* Asked in, Task, Origin, Summary \|/m);
  assert.match(guide, /Kind Changed\) shows here too/);
  const tasks = await read("notion/modules/tasks.md");
  assert.match(tasks, /named "Keep", with the label "Keep as document"\. Action \*\*Edit property\*\* on \*\*This page\*\*: Document asked → checked\. Nothing else\./);
  const migration = await read(MIGRATION);
  assert.match(migration, /named `Keep`, with the label `Keep as document`\. Action \*\*Edit property\*\* on \*\*This page\*\*: Document asked → checked\. Nothing else/);
  const examples = await read("notion/template-examples.md");
  for (const row of ["| 7 | Tasks |", "| 8 | Tasks |", "| 10 | Tasks |"]) {
    assert.match(examples.split("\n").find((l) => l.startsWith(row)) ?? "", /Document asked unticked/, row);
  }
});
