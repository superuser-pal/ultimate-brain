// CC-356: the minutes layout (decision 0106 §13): the prompt, Check minutes, the template's example meeting and migration 0029's part C.
// Text checks only; the parser's tests are in lean-minutes.test.ts.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = "notion/migrations/0029-new-task-on-home-clean-email-and-the-minutes-layout.md";

/** The minutes prompt: the fenced text block of minutes-format.md. */
async function prompt(): Promise<string> {
  const text = await read("notion/minutes-format.md");
  const start = text.indexOf("```text\n") + "```text\n".length;
  return text.slice(start, text.indexOf("\n```", start));
}

test("the prompt writes each section as a heading and a divider, and a subject's lines as bullets with a bold prefix", async () => {
  const text = await prompt();
  assert.match(text, /Every section below starts with its heading, then a divider \(---\)/);
  assert.match(text, /The heading "## In one line", then a divider, then one sentence on its own line/);
  assert.doesNotMatch(text, /starts with "In one line:"/);
  for (const prefix of ["Decided", "Open", "Concern", "Waiting on <name>", "Idea"]) assert.ok(text.includes(`- **${prefix}:**`), prefix);
  assert.match(text, /First a gist bullet with no prefix/);
  assert.match(text, /- \[ \] Send Ana the slides from today \[q1\]/, "follow-ups stay checkboxes");
});

test("Check minutes checks the new layout and accepts 0.14.0's", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const check = assistant.slice(assistant.indexOf("### Check minutes\n"), assistant.indexOf("\n### ", assistant.indexOf("### Check minutes\n") + 1));
  assert.match(check, /each section a heading followed by a divider; "## In one line" with one sentence on its own line below/);
  assert.match(check, /bullets starting with a bold Decided:/);
  assert.match(check, /Lean minutes from 0\.14\.0 have a plain line "In one line: \.\.\.", no dividers and prefixes without bold: they are fine/);
});

test("the template's example meeting is in the new layout, and its update section says how a copy takes it", async () => {
  const examples = await read("notion/template-examples.md");
  const row6 = examples.slice(examples.indexOf("### Row 6: the Meeting's minutes"), examples.indexOf("### Row 9"));
  assert.match(row6, /## In one line\n---\nKickoff for the Northwind website refresh/);
  assert.match(row6, /- \*\*Decided:\*\* keep the blog as it is\. \[s1\.i2\]/);
  assert.doesNotMatch(row6, /^In one line:/m);
  assert.match(examples, /## Updating a copy to 0\.16\.2\n/);
  assert.match(examples, /Write each "## " line as a heading 2, each "---" line as a divider/);
});

test("migration 0029 part C replaces the prompt and Check minutes by hand, reads the layout back, and rewrites no meeting", async () => {
  const migration = await read(MIGRATION);
  const partC = migration.slice(migration.indexOf("## Part C · The minutes layout (0106 §13)"), migration.indexOf("## The last steps"));
  assert.ok(partC.length > 0);
  assert.ok(migration.indexOf("## Part B") < migration.indexOf("## Part C"), "part C comes after part B");
  const text = await prompt();
  assert.ok(text.includes(`The heading "## In one line", then a divider`), "C1's already-done check quotes the prompt");
  assert.match(partC, /### C1 · The minutes prompt where you keep it \(by hand\)/);
  assert.match(partC, /### C2 · Check minutes' text \(by hand\)/);
  assert.match(partC, /### C3 · Read the layout back \(by hand\)/);
  assert.match(partC, /### C4 · The template's example meeting \(the template's copy only\)/);
  assert.match(partC, /A user's space skips C4/);
  assert.match(migration, /\*\*Part C rewrites no meeting\.\*\*/);
  assert.match(migration, /Part C, the minutes layout \(decision 0106 §13\):\n- \[ \] \*\(you\)\* Write minutes/);
  const readme = await read("notion/migrations/README.md");
  assert.match(readme.split("\n").find((l) => l.includes("0029-new-task-on-home")) ?? "", /The minutes layout \(by hand\).*CC-356 \(release 0\.16\.2\) \|$/);
});
