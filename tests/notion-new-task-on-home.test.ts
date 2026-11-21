// CC-355: the New task button on Home (decision 0106 §12) in the Notion design, the views guide, prompt 7a, TEMPLATE.md and migration 0029. Text checks only.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION_FILE = "0029-new-task-on-home-clean-email-and-the-minutes-layout.md";
const MIGRATION = `notion/migrations/${MIGRATION_FILE}`;

test("0.16.2 has one Notion migration, 0029, right after 0028", async () => {
  const files = (await readdir(join(root, "notion", "migrations"))).filter((f) => /^[0-9]{4}-.+\.md$/.test(f)).sort();
  assert.deepEqual(files.filter((f) => f.startsWith("0029-")), [MIGRATION_FILE]);
  assert.equal(files.filter((f) => f > "0028-")[1], MIGRATION_FILE);
  const readme = await read("notion/migrations/README.md");
  assert.ok(readme.includes(`[0029](${MIGRATION_FILE})`));
  assert.match(readme, /\[0029\][^\n]*New task on Home[^\n]*CC-355 \(release 0\.16\.2\)/);
});

test("the design, the views guide and prompt 7a put New task right after New project, with Kind Task and no project or due date", async () => {
  const design = await read("docs/notion-space-design.md");
  const home = design.split("\n").find((l) => l.startsWith("| **Home** |"));
  assert.ok(home);
  assert.match(home, /New project, New task \(→ Tasks, Kind Task, the database's default Status, no project or due date; Tasks module;/);

  const guide = await read("notion/views-guide.md");
  const rows = guide.split("\n");
  const project = rows.findIndex((l) => l.startsWith("| New project |"));
  assert.ok(rows[project + 1].startsWith("| New task *(Tasks)* | Add page to *Tasks*, Kind = Task."));
  assert.match(rows[project + 1], /no Project, Area or Due is set/);
  assert.match(rows[project + 1], /your own Tasks database \(0018\)/);
  assert.match(guide, /- \[ \] \(Tasks\) New task, next to New project, opens a new Tasks row with Kind Task, the default Status and no project or due date\./);

  const prompt = await read("notion/prompts/07a-home.md");
  const lines = prompt.split("\n");
  const p5 = lines.findIndex((l) => l.startsWith('5. A button "New project"'));
  assert.ok(lines[p5 + 1].startsWith('[Tasks] 5a. A button "New task", right after New project: Add page to "Tasks", set Kind = Task, open the page after creation.'));
  assert.match(lines[p5 + 1], /no Project and no Due/);
  assert.match(prompt, /- \[ \] \(Tasks\) New task sits right after New project and opens a new Tasks row with Kind Task/);
  assert.match(prompt, /New task button's page to that database, setting its mapped Kind property to Task, or nothing if it has none/);
});

test("migration 0029 makes the button by hand, reads it back by name and action, covers an own Tasks database, and sets the template version", async () => {
  const migration = await read(MIGRATION);
  assert.match(migration, /^# 0029 · 0\.16\.2: New task on Home/);
  assert.match(migration, /Decision 0106 §13; CC-356 \(release 0\.16\.2/, "CC-356 joined its part");
  assert.match(migration, /### A1 · The New task button \(by hand\)/);
  assert.match(migration, /\*\*Name:\*\* `New task`/);
  assert.match(migration, /\*\*Add page to\*\* → \*\*Tasks\*\*\. Add one property, \*\*Kind\*\* = \*\*Task\*\*/);
  assert.match(migration, /### A2 · Read the button back \(by hand\)/);
  assert.match(migration, /\*\*By name and action:\*\*/);
  assert.match(migration, /\*\*Your own Tasks database\*\* \(mapped in `brain\.json` `notion\.tasks`, decision 0018\)/);
  assert.match(migration, /`notion\.tasks\.properties\.kind` is not empty/);
  assert.match(migration, /\*\*Tasks module off, with no tasks database of your own:\*\* skip part A/);
  assert.match(migration, /change it to `Template version: 0029`/);
  assert.match(migration, /- \[ \] \*\(API\)\* The System callout reads `Template version: 0029`\./);

  // The template includes 0029; a later release's migration moves the version on (0030 in 0.17.0).
  const template = await read("notion/TEMPLATE.md");
  const version = Number(template.match(/\| \*\*Template version\*\* \| `(\d{4})` \|/)?.[1]);
  assert.ok(version >= 29, `Template version ${version}`);
});
