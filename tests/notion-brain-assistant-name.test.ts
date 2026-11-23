// CC-352: Brain Assistant becomes Notion Brain Assistant (decision 0072 §1, built in 0.17.0 by 0106 §4): the texts a user
// meets name the Notion agent by its new name, older names are kept only where they are history or an old database name,
// and migration 0030's part B renames it in an existing space. Text checks only.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = "notion/migrations/0030-your-fields-after-your-yes-the-path-without-notion-ai-and-the-weekly-row.md";

// The texts the package ships (package.json `files`: notion/, the two docs, README, the templates, the CLI's source) and
// the contracts and guides beside them. Not checked, by the task's acceptance: the migrations before 0.17.0's (0030),
// decisions, build/ and CHANGELOG.md (history); .agents/skills, the vendored fork release, which says the new name once
// 0.17.0's skills release is vendored.
const SHIPPED_DIRS = ["notion", "templates", "src"];
const SHIPPED_FILES = [
  "docs/notion-space-design.md", "docs/setup.md", "docs/meetings-from-other-tools.md", "docs/chatgpt.md", "docs/guide.md", "README.md", "PRIVACY.md",
  "spec/setup.md", "spec/assistant.md", "spec/weekly-review.md", "spec/cli.md", "spec/capture-and-review.md",
];
const OLDER_MIGRATION = /^notion\/migrations\/(00[0-2]\d)-/;

// A bare "Brain Assistant" is allowed only where it says the old name, each listed here: the database "Brain Assistant
// Skills" of a space built before 0.14.0; a sentence about the rename; a history line or record; the older migrations'
// rows of the migrations index; the parser of the retired Review pages' "For Brain Assistant" toggle.
const OLD_NAME_ALLOWED = new RegExp([
  "Brain Assistant Skills", "before 0\\.17\\.0", "Until you do B1", "still (named|says) Brain Assistant", "is renamed Notion Brain Assistant",
  "Brain Assistant became Notion Brain Assistant", "History \\(retired in 0\\.16\\.0", "^\\| \\[00[0-2]\\d\\]", "\"For Brain Assistant\"",
].join("|"));
// spec/capture-and-review.md's records: what migration 0023 changed, the retired Review database, the 0.8.0 tests (§7 table, §9).
const RECORDS = /\*\*Migration 0023, text only\.\*\*|Review queue and Grill review|M10 · a format-2 Review page|T1 · Recording|9\.5 Round trip of a format-2 page|\*\*The grill\.\*\* The user ran the draft Grill review/;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (/\.(md|ts|json|txt)$/.test(entry.name)) out.push(path);
  }
  return out;
}

test("the shipped texts call the Notion agent Notion Brain Assistant, the old name only where listed", async () => {
  const files = [...(await Promise.all(SHIPPED_DIRS.map(walk))).flat(), ...SHIPPED_FILES].filter((p) => !OLDER_MIGRATION.test(p));
  assert.ok(files.includes("notion/brain-assistant.md") && files.includes(MIGRATION) && files.includes("src/lib/setup.ts"));
  const partB = (await read(MIGRATION)).split("## Part B · ")[1].split("\n## Part C")[0];
  for (const path of files) {
    for (const line of (await read(path)).split("\n")) {
      if (!/(?<!Notion )Brain Assistant(?! Skills)/.test(line)) continue;
      if (path === MIGRATION && partB.includes(line)) continue; // part B's steps quote the old name they replace
      if (path === "spec/capture-and-review.md" && RECORDS.test(line)) continue;
      assert.match(line, OLD_NAME_ALLOWED, `${path}: ${line.slice(0, 160)}`);
    }
  }
});

test("the agent's page says the old name is the same agent, and its Instructions and setup use the new one", async () => {
  const assistant = await read("notion/brain-assistant.md");
  assert.match(assistant, /^# Notion Brain Assistant: the Notion AI agent for daily use$/m);
  assert.match(assistant, /It was called Brain Assistant before 0\.17\.0: the same agent, renamed so it isn't confused with Ultimate Assistant/);
  assert.match(assistant, /A page or an older migration that still says Brain Assistant means this agent\./);
  assert.match(assistant, /\nYou are Notion Brain Assistant, my helper for the Ultimate Brain workspace\.\n/);
  assert.match(assistant, /Agents → New Custom Agent, named \*\*Notion Brain Assistant\*\*, no triggers\. Already have one you created that answers in its chat, perhaps still named Brain Assistant\? Keep it, don't create a second one: rename it \*\*Notion Brain Assistant\*\*/);
  assert.match(assistant, /\*\*Description:\*\* The minutes prompt, kept here so you can copy it\. Notion Brain Assistant doesn't run it:[^\n]*Asked to write minutes, Notion Brain Assistant gives you these steps/);
  assert.match(assistant, /as \*\*Brain Assistant Skills\*\*, keeps it/, "the old database name stays readable");
});

test("First things first, Start here and the Voice note template name Notion Brain Assistant", async () => {
  const design = await read("docs/notion-space-design.md");
  assert.match(design, /> - \[ \] \*\*Create your own Notion Brain Assistant\.\*\*[^\n]*named \*\*Notion Brain Assistant\*\*, with no triggers\. Already have one you created that answers in its chat, perhaps still named Brain Assistant\? Keep it, don't create a second one: rename it \*\*Notion Brain Assistant\*\*, check items 3 to 6, then do item 8\./);
  assert.match(design, /\| \*\*Start here\*\* callout[^\n]*"Then open First things first: create your own Notion Brain Assistant and select it in its buttons\."/);
  assert.match(design, /\| \*\*Start here\*\* callout[^\n]*"Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits\."/);
  assert.match(design, /\*\*The agent's name changed in 0\.17\.0\*\*/);
  const pages = await read("notion/prompts/01-pages.md");
  assert.match(pages, /create your own Notion Brain Assistant and select it in its buttons/);
  const templates = await read("notion/prompts/06-templates.md");
  assert.match(templates, /then ask Notion Brain Assistant: Voice summary\."/);
});

test("the button messages name no agent: Send message to selects it", async () => {
  const views = await read("notion/views-guide.md");
  for (const button of ["Tidy capture", "Write up", "Refresh report"]) {
    const row = views.split("\n").find((l) => l.startsWith(`| ${button} | \`Run your`));
    assert.ok(row, button);
    assert.doesNotMatch(row, /Brain Assistant/, `${button}'s message`);
  }
  assert.match(views, /\*\*Send message to\*\* → Notion Brain Assistant/);
});

test("setup's status line says set up Notion Brain Assistant, in the spec and the CLI", async () => {
  assert.match(await read("spec/cli.md"), /`set up Notion Brain Assistant`/);
  assert.match(await read("src/lib/setup.ts"), /\["brain-assistant", "set up Notion Brain Assistant"\]/);
});

test("migration 0030's part B renames the agent by hand and replaces its name, each step checked first and read back", async () => {
  const migration = await read(MIGRATION);
  const start = migration.indexOf("## Part B · Notion Brain Assistant (0106 §4; CC-352)");
  assert.ok(start >= 0);
  const partB = migration.slice(start, migration.indexOf("\n## Part C", start));
  assert.doesNotMatch(partB, /Added to this migration by CC-352/);
  for (const heading of [
    "### B1 · Rename the agent (by hand)",
    "### B2 · The Instructions' first line (by hand)",
    "### B3 · Write minutes' Description (the agent, or by hand)",
    "### B4 · Start here, First things first and the Voice note template (the agent, or by hand)",
    "### B5 · Read it back",
  ]) assert.ok(partB.includes(heading), heading);
  assert.equal((partB.match(/\*\*Already done\?\*\*/g) ?? []).length, 4, "B1 to B4 each check first");
  assert.match(partB, /It is the same agent: its rules, its skills, its Tools and access and its buttons stay as they are/);
  assert.match(partB, /A page, a skill or an older migration that still says Brain Assistant means this agent/);
  assert.match(partB, /change its name to `Notion Brain Assistant`/);
  assert.match(partB, /"You are Brain Assistant, my helper for the Ultimate Brain workspace\." becomes "You are Notion Brain Assistant, my helper for the Ultimate Brain workspace\."/);
  assert.match(partB, /\*\*Send message to\*\* shows \*\*Notion Brain Assistant\*\*, and the message is unchanged\. If it is empty or shows another agent, select your Notion Brain Assistant there/);
  assert.match(partB, /Move the test row to the trash/);
  assert.match(migration, /Part B, Notion Brain Assistant \(decision 0072 §1, 0106 §4\):\n- \[ \] \*\(you\)\* Agents lists \*\*Notion Brain Assistant\*\*/);
  assert.match(migration, /- \*\*Part B changes no database, property, option, view, button or template structure\.\*\*/);

  // The assistant's Instructions line, the Write minutes Description and the template texts the migration names are the shipped ones.
  const assistant = await read("notion/brain-assistant.md");
  assert.ok(assistant.includes("You are Notion Brain Assistant, my helper for the Ultimate Brain workspace."));
  const design = await read("docs/notion-space-design.md");
  const item2 = "Already have one you created that answers in its chat, perhaps still named Brain Assistant? Keep it, don't create a second one: rename it **Notion Brain Assistant**, check items 3 to 6, then do item 8.";
  assert.ok(design.includes(item2) && partB.includes(item2), "B4 pastes First things first's new sentence");

  // The name rule of B4, B5 and Verify (CC-391), in the same words, passes on the texts the product ships.
  const rule = '"Brain Assistant" appears only after "Notion", in the database name "Brain Assistant Skills", or in item 2\'s sentence "perhaps still named Brain Assistant?"';
  assert.equal(partB.split(rule).length - 1, 2, "B4 step 1 and B5 item 3");
  assert.equal(migration.split("\n## Verify")[1].split(rule).length - 1, 2, "both Verify items");
  assert.doesNotMatch(migration, /Notion Brain Assistant"? without "Notion" before it/);
  const startHere = design.split("\n").find((l) => l.startsWith("| **Start here** callout"))!;
  const sentences = [...startHere.matchAll(/: "([^"]*Brain Assistant[^"]*)"/g)].map((m) => m[1]);
  assert.equal(sentences.length, 2);
  const firstThings = design.split("\n").filter((l) => l.startsWith("> "));
  assert.ok(firstThings.length >= 9);
  for (const text of [...sentences, ...firstThings]) {
    assert.doesNotMatch(text, /(?<!Notion )(?<!perhaps still named (?=Brain Assistant\?))Brain Assistant(?! Skills)/);
  }

  // B3 names both layouts, as A3 does (CC-391).
  const a3 = migration.split("### A3 · ")[1].split("### A4")[0];
  const b3 = partB.split("### B3 · ")[1].split("### B4")[0];
  for (const layout of [
    "- **The text is in the Description property and the page body is empty** (the template's layout, and every space duplicated from it):",
    "- **The text is in the page body** (a Skills database built by hand from Prompt 9):",
  ]) assert.ok(a3.includes(layout) && b3.includes(layout), layout);

  const readme = await read("notion/migrations/README.md");
  assert.match(readme, /\[0030\][^\n]*Notion Brain Assistant \(by hand, read back\)[^\n]*CC-352 \(release 0\.17\.0\)[^\n]*\|$/m);
});
