// CC-372: the guides, Brain Assistant's texts and the template's text for the weekly row and for scheduling on a Mac and on Windows (decision 0110). Text checks only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");

function section(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  assert.ok(from >= 0, start);
  const to = text.indexOf(end, from + start.length);
  return text.slice(from, to < 0 ? undefined : to);
}

// The files this task owns. The vendored skills (CC-371) and the CLI's own text (CC-369) say the same through their own tasks.
const GUIDES = [
  "README.md",
  "docs/setup.md",
  "docs/notion-space-design.md",
  "docs/design-principles.md",
  "notion/brain-assistant.md",
  "notion/views-guide.md",
  "notion/TEMPLATE.md",
  "notion/CHECKLIST.md",
  "notion/prompts/07-spaces-views.md",
  "notion/prompts/07a-home.md",
  "notion/prompts/07e-review.md",
  "templates/brain/AGENTS.md",
];

test("no guide says Windows can't schedule, or that every weekly decision is made in the session", async () => {
  const found: string[] = [];
  const windowsCant = /scheduled runs aren't available|not available on Windows|scheduled runs need macOS|On Windows, none|On Windows it isn't offered|run by hand/i;
  const sessionOnly = /You decide what the brain proposes in your agent session, not here \(decision 0096\);|decisions are made in Claude Code or Codex\.$|what changed, the task analysis and at most five decisions/;
  for (const file of GUIDES) {
    (await read(file)).split("\n").forEach((line, index) => {
      if (windowsCant.test(line) || sessionOnly.test(line)) found.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(found, []);
});

test("setup's guide offers the two slots on a Mac and on Windows, with either agent, and says what the computer needs", async () => {
  const setup = await read("docs/setup.md");
  const item = section(setup, "12. **The schedule.**", "13. **How the brain talks to you.**");
  assert.ok(item.includes("Run the weekly review on its own every Monday at 08:00, and a catch-up every day at 07:30? Keep them, change a time or a day, or say no to either."));
  assert.match(item, /launchd on a Mac, Task Scheduler on Windows/);
  assert.match(item, /`claude -p`, with Codex `codex exec`/);
  for (const row of ["| Asleep |", "| Off |", "| You're logged out |"]) assert.ok(item.includes(row), row);
  assert.match(item, /https:\/\/learn\.microsoft\.com\/en-us\/windows\/win32\/taskschd\/tasksettings-waketorun/);
  assert.match(item, /https:\/\/developer\.apple\.com\/library\/archive\/documentation\/MacOSX\/Conceptual\/BPSystemStartup\/Chapters\/ScheduledJobs\.html/);
  assert.match(item, /accept its trust dialog/);
  assert.match(item, /`brain schedule remove --here`/);
  assert.match(setup, /\| 8 \| The schedule \| Keep, change or decline two times/);
  assert.match(setup, /### The schedule didn't install \(`schedule-not-loaded`\)/);
  const uninstall = section(setup, "## Uninstalling", "\n## ");
  assert.match(uninstall, /Task Scheduler tasks named `eu\.ultimate-brain\.\*`/);
});

test("Weekly review reads the two parts, decides nothing in the row, and ends with tick, then Ready", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const weekly = section(assistant, "### Weekly review\n", "### Plan check\n");
  assert.match(weekly, /A row whose headings are "Your week" and "Clean-up": steps 5 to 9\./);
  assert.match(weekly, /by their labels \(A1, U1, C1\)/);
  assert.match(weekly, /\*\*Description:\*\* Optional:[^\n]*Claude Code or Codex writes the row and does its clean-up; this skill only reads it with me\./, "an optional companion (the author's answer of 2026-11-20)");
  assert.match(await read("notion/views-guide.md"), /an optional companion that only reads the row/);
  assert.match(weekly, /Show the change toggle/);
  assert.ok(weekly.includes("Then set this row's Brain Status to Ready: the next catch-up applies your ticks."));
  assert.match(weekly, /none marked as a suggestion/, "Focus first suggests no value (the author's answer of 2026-11-20)");
  // CC-384: the answer line names only the task options.
  const step8 = section(weekly, "\n8. ", "\n9. ");
  assert.match(step8, /The answer line names only these numbered task options: no row label \(A1, U1, C1\), and never the word tick\. The row's items are only ever ticked in the row\./);
  const examples = [...weekly.matchAll(/"Answer like ([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(examples, ["1a 27 Nov, 2d."], "one example, with task options only");
  assert.match(weekly, /was written before 0\.17\.0: step 10\./);
  assert.match(weekly, /Never tick or untick a to-do, never write on a Your note line, and never set Brain Status\./);
  assert.match(weekly, /or wait for its scheduled run if you set one/);

  const s13 = section(await read("spec/weekly-review.md"), "## 13. Weekly review in Notion", "\n## ");
  assert.match(s13, /\*\*The tasks Focus first names\*\* \(the author's answer of 2026-11-20\)[^\n]*none marked as the review's suggestion/, "the contract defines the Focus first offer");

  const instructions = section(assistant, "## Instructions", "## Skills");
  assert.match(instructions, /- A Weekly row's ticks, its Your note lines and its Brain Status are mine: never tick or untick its to-dos, never write on a Your note line, and never set a Weekly row's Brain Status, even when I ask\./);
  assert.match(instructions, /except a Weekly row's Actions and clean-up items, which I tick in that row\./);

  const today = section(assistant, "### Today\n", "### Check minutes\n");
  assert.match(today, /For a Weekly row whose Brain Status is New, say: "tick what you agree with in it, then set it Ready;/);
});

test("the views guide, the design and the template describe the weekly row without a new property, option, view or database", async () => {
  const guide = await read("notion/views-guide.md");
  const row = section(guide, "### The weekly row\n", "\n---");
  assert.match(row, /It adds no property, option, view or database \(decision 0110 §1\)\./);
  assert.match(row, /\*\*Your note:\*\*/);
  assert.match(row, /Set the row's Brain Status to \*\*Ready\*\*/);
  assert.match(row, /Example \(synthetic\)/);
  assert.match(guide, /\[the weekly row\]\(#the-weekly-row\)/);

  const design = await read("docs/notion-space-design.md");
  assert.match(design, /\*\*Notion steps for the weekly row \(CC-368, CC-372\):\*\* none to the schema/);
  assert.match(await read("notion/TEMPLATE.md"), /0\.17\.0's weekly row changes only Notion Brain Assistant's texts, in migration 0030's part D, and adds no Example row/);
});

test("the principles and the parity epic say scheduling is delivered in 0.17.0, with the Mac's powered-off gap deferred", async () => {
  const principles = section(await read("docs/design-principles.md"), "## 7.", "\n## ");
  assert.match(principles, /Its first known gap, scheduling, is delivered in 0\.17\.0/);
  assert.match(principles, /a Mac that is off at a slot skips that run/);
  const epic = section(await read("docs/v2-ideas.md"), "### Epic: identical capabilities on macOS and Windows", "\n### ");
  assert.match(epic, /\*\*Delivered in 0\.17\.0 by \[0110\]/);
  assert.match(epic, /One difference stays named and deferred past 0\.17\.0/);
});

test("migration 0030's part D: the three texts by hand, each with its already-done check, and a read-back on a synthetic two-part row", async () => {
  const migration = await read("notion/migrations/0030-your-fields-after-your-yes-the-path-without-notion-ai-and-the-weekly-row.md");
  const d = section(migration, "## Part D · ", "\n## The last steps");
  for (const heading of ["### D1 · The Weekly review skill (by hand)", "### D2 · The Instructions (by hand)", "### D3 · Today (by hand)", "### D4 · Read it back (by hand)"]) {
    assert.ok(d.includes(heading), heading);
  }
  assert.match(d, /changes no database, property, option, view or button/);
  assert.match(d, /\*\*Already done\?\*\* The skill's text has a step 4 starting "4\. A row whose headings are "Your week" and "Clean-up""/);
  assert.match(d, /Neither holds "6\. Then ask me about the task items in rounds of at most five" \(A3's text\) or "Ask me nothing to decide:"/);
  assert.match(d, /replace "not here\." with "not here, except a Weekly row's Actions and clean-up items, which I tick in that row\."/);
  const assistant = await read("notion/brain-assistant.md");
  for (const quoted of ["- A Weekly row's ticks, its Your note lines and its Brain Status are mine:", "- Never touch a project's or area's \"Brief\"", "4. A row whose headings are \"Your week\" and \"Clean-up\"", "For a Weekly row whose Brain Status is New"]) {
    assert.ok(assistant.includes(quoted), `brain-assistant.md holds what part D quotes: ${quoted}`);
  }
  const d4 = section(d, "### D4 · Read it back (by hand)", "\n## ");
  assert.match(d4, /Kind \*\*Weekly\*\*, Brain Status \*\*New\*\*/);
  assert.match(d4, /none marked as the review's suggestion\. Answer `1d`/);
  assert.match(d4, /no to-do is ticked, both Your note lines are empty, and Brain Status reads \*\*New\*\*/);
  assert.match(d4, /ask "tick C1 for me", then "set this row to Ready"\. It refuses each/);
  assert.match(d4, /move the two test rows to the trash/);
  assert.match(migration, /\*\*Already done\?\*\* The skill's text \(in Description, or in the body\) has a step 8 starting "8\. End with one short list", or D1's text/, "A3 accepts D1's text");
  assert.match(migration, /Part D, the weekly row \(decision 0110\):\n- \[ \] \*\(you\)\*/);
});
