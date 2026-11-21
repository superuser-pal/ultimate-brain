// CC-325: Brain Assistant sets your operational fields after your yes (decision 0101 §3): its Instructions, Tools and access,
// Weekly review, the Notion design, the views guide, spec/weekly-review.md §13 and migration 0030's part A. Text checks only.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = "notion/migrations/0030-your-fields-after-your-yes-the-path-without-notion-ai-and-the-weekly-row.md";
const FIELDS = "in Tasks, Status and Due; in Projects, Status, Priority and Dates; in Goals, Status; in Key Results, Current, Done and Due. Areas has none.";

function section(text: string, heading: string, next = "\n### "): string {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, heading);
  const end = text.indexOf(next, start + heading.length);
  return text.slice(start, end < 0 ? undefined : end);
}

test("the Instructions name the fields, the yes before a set, the read-back and the refusals with where to go", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const instructions = section(assistant, "## Instructions", "\n## ");
  assert.doesNotMatch(instructions, /Never edit any property or page/);
  assert.match(instructions, /- Never edit a page or a property, except as the rules below allow\./);
  const fields = instructions.split("\n").find((l) => l.startsWith("- My fields, after my yes."));
  assert.ok(fields);
  assert.ok(fields.includes(`You may set only these properties: ${FIELDS}`));
  assert.match(fields, /set it only after my yes to that line, or to the option I pick when you ask in numbered options \("1a"\)\. Never before/);
  assert.match(fields, /Then read each one back/);
  assert.match(fields, /A button's message never carries this yes\./);
  const refuse = instructions.split("\n").find((l) => l.startsWith("- Asked to change anything else, refuse"));
  assert.ok(refuse);
  assert.match(refuse, /Key Facts[^;]*"say it to Claude Code or Codex in your brain"/);
  assert.match(refuse, /Brain Status on a meeting or an Inbox row, "set it yourself/);
  assert.match(refuse, /Accepted, Document asked or Refresh asked, "use the button on the page"/);
  assert.match(instructions, /- Only these skills may edit page text: "Check minutes"/);
  assert.match(instructions, /Never create a page in Tasks/);
  assert.match(instructions, /You read, help me understand, and set my fields above after my yes\./);
  assert.doesNotMatch(instructions, /You only read/);
});

test("Tools and access give edit access on the four databases, Areas view only, in the setup and First things first", async () => {
  const assistant = await read("notion/brain-assistant.md");
  assert.match(assistant, /Edit access is needed only on Meetings, Inbox and Documents, for the skills that may change page text, and on Tasks, Projects, Goals and Key Results, for the fields it sets after your yes \(those of your modules\); view access everywhere else, Areas included\./);
  const design = await read("docs/notion-space-design.md");
  const ftf = section(design, "> - [ ] **Give it access.**", "\n");
  assert.match(ftf, /Edit access is needed only on Meetings, Inbox and Documents, and on Tasks, Projects, Goals and Key Results for the fields it sets after your yes/);
  assert.match(design, /\*\*Item 3's wording changed in 0\.17\.0\*\*/);
});

test("Weekly review asks the task items in numbered options and sets only what was picked, after the answer", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const weekly = section(assistant, "### Weekly review\n");
  assert.doesNotMatch(weekly, /I set it myself/);
  assert.doesNotMatch(weekly, /Never edit a task/);
  assert.match(weekly, /\*\*Description:\*\*[^\n]*and set what I agree on its tasks\./);
  assert.match(weekly, /\n6\. Then ask me about the task items in rounds of at most five, numbered in the row's order\./);
  assert.match(weekly, /"leave it" last/);
  assert.match(weekly, /Set nothing yet\./);
  assert.match(weekly, /\n7\. My answer is my yes to exactly the options I picked\. Set each on its task \(Status or Due only\), then read each back/);
  assert.match(weekly, /\n8\. End with one short list/);
  assert.match(weekly, /Never set a property before my answer, or one I didn't pick\. Never edit the row or any other page\./);
  assert.match(weekly, /Ask me nothing to decide about it/, "a proposal stays decided in the session");
  const spec = await read("spec/weekly-review.md");
  const s13 = section(spec, "## 13. Weekly review in Notion", "\n## ");
  assert.doesNotMatch(s13, /never edits a property/);
  assert.match(s13, /\*\*From 0\.17\.0\*\* \(0101 §3, CC-325\)/);
});

test("the Notion design and the views guide say what it may set, and no shipped text says it never sets a field", async () => {
  const design = await read("docs/notion-space-design.md");
  assert.match(design, /\*\*Notion Brain Assistant sets some of your fields after your yes \(\[0101\]/);
  assert.ok(design.includes("in Tasks, Status and Due; in Projects, Status, Priority and Dates; in Goals, Status; in Key Results, Current, Done and Due. Areas has no such field."));
  assert.doesNotMatch(design, /Still never a property, or a brain-written section/);
  const views = await read("notion/views-guide.md");
  assert.match(views, /never a yes to set a field: Notion Brain Assistant sets your operational fields only in its chat, after your yes/);

  const shipped = ["notion/brain-assistant.md", "docs/notion-space-design.md", "notion/views-guide.md", "notion/TEMPLATE.md", "notion/CHECKLIST.md", "notion/prompts/09-assistant-and-guide.md", "docs/setup.md", "README.md", "spec/weekly-review.md", "spec/assistant.md"];
  for (const path of shipped) {
    for (const line of (await read(path)).split("\n").filter((l) => /Brain Assistant/.test(l))) {
      assert.doesNotMatch(line, /never (edits|sets|changes) (a|any) (property|field)|Never edit any property|You only read|I set it myself|Edit access is needed only on Meetings, Inbox and Documents[^,]*;/, `${path}: ${line}`);
    }
  }
});

test("migration 0030 is 0.17.0's one migration: part A by hand with read-backs, the other tasks' parts marked, version 0030", async () => {
  const files = (await readdir(join(root, "notion/migrations"))).filter((f) => /^\d{4}-/.test(f)).sort();
  assert.equal(files.at(-1), MIGRATION.split("/").at(-1));
  assert.equal(files.filter((f) => f.startsWith("0030-")).length, 1);
  const migration = await read(MIGRATION);
  assert.match(migration, /It is 0\.17\.0's one Notion migration/);
  assert.match(migration, /Needs migration 0029\./);
  for (const heading of ["### A1 · Tools and access (by hand)", "### A2 · The Instructions (by hand)", "### A3 · The Weekly review skill (by hand)", "### A4 · First things first, item 3 (the agent, or by hand)", "### A5 · Read it back (by hand)"]) {
    assert.ok(migration.includes(heading), heading);
  }
  const assistant = await read("notion/brain-assistant.md");
  const fieldsLine = assistant.split("\n").find((l) => l.startsWith("- My fields, after my yes."));
  assert.ok(fieldsLine && migration.includes('"- My fields, after my yes."'), "A2 names the new line");
  assert.ok(migration.includes('"- Never edit any property or page. Only these skills may edit page text:"'), "A2 names the line it replaces");
  const a5 = section(migration, "### A5 · Read it back (by hand)", "\n## ");
  assert.match(a5, /Answer `1a`/);
  assert.match(a5, /Before you answer, open the test task: its Due hasn't changed\./);
  assert.match(a5, /Key Facts still reads `Budget: 10k`/);
  assert.match(a5, /Brain Status still reads New/);
  assert.match(a5, /move the four test rows to the trash/);
  for (const [part, task] of [["C", "CC-329"], ["D", "CC-372"]]) {
    // Each part names its task; a part not yet filled says who adds it (CC-329 filled part C).
    assert.match(migration, new RegExp(`## Part ${part} · [^\\n]*${task}\\)\\n`));
  }
  assert.match(migration, /change it to `Template version: 0030`/);
  assert.match(migration, /- \[ \] \*\(API\)\* The System callout reads `Template version: 0030`\./);
  assert.ok(migration.indexOf("## Part A") < migration.indexOf("## Part B") && migration.indexOf("## Part D") < migration.indexOf("## The last steps"));

  const readme = await read("notion/migrations/README.md");
  assert.match(readme, /\[0030\][^\n]*0\.17\.0's one migration[^\n]*CC-325 \(release 0\.17\.0\)[^\n]*\|$/m);
  const template = await read("notion/TEMPLATE.md");
  assert.match(template, /\| \*\*Template version\*\* \| `0030` \|/);
});
