// CC-329: the path without Notion AI (decision 0101 §7, §8): First things first's item 1 and Start here's plan table in
// migration 0030's part C, the plan table in the guides, and no shipped text requiring Notion AI. Text checks only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION = "notion/migrations/0030-your-fields-after-your-yes-the-path-without-notion-ai-and-the-weekly-row.md";
const ITEM_1 =
  'Notion Brain Assistant and its buttons need Notion\'s Business or Enterprise plan with Notion credits. Without credits, skip items 2 to 6 and 8 (the buttons won\'t work on your plan): do item 7, then ask Claude Code or Codex for a skill by its name instead, such as "prep my 3pm" or "tidy that capture".';
const ROWS = [
  "| Business or Enterprise, with Notion credits | Notion AI meeting notes and the minutes prompt, or any other tool | Yes |",
  "| Business or Enterprise, without credits | Notion AI meeting notes and the minutes prompt, or any other tool | No: ask Claude Code or Codex for the same skills |",
  "| Free or Plus | Any other tool, pasting, or transcript files: your agent writes the minutes | No: ask Claude Code or Codex for the same skills |",
];

function section(text: string, heading: string, next: string): string {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, heading);
  const end = text.indexOf(next, start + heading.length);
  return text.slice(start, end < 0 ? undefined : end);
}

test("migration 0030's part C sets item 1 to the design's text and adds the plan table, each with its check", async () => {
  const migration = await read(MIGRATION);
  const design = await read("docs/notion-space-design.md");
  assert.ok(design.includes(`**Check your plan.** ${ITEM_1}`), "§10.1 item 1");
  const partC = section(migration, "## Part C · ", "\n## Part D");
  assert.ok(partC.includes(`\`${ITEM_1}\``), "C1 gives item 1's exact text");
  assert.match(partC, /\*\*Already done\?\*\* The item says "ask Claude Code or Codex for a skill by its name"\. Then change nothing\./);
  assert.match(partC, /"personal Notion Agent" nowhere on the page/);
  for (const row of ROWS) assert.ok(partC.includes(row), row);
  assert.match(partC, /\*\*Already there\?\*\* The callout holds a table whose first column starts "Your Notion"/);
  const verify = section(migration, "## Verify", "\nThe last steps:");
  assert.match(verify, /Part C, the path without Notion AI/);
  assert.match(verify, /\*\(API\)\* First things first's item \*\*Check your plan\.\*\* says "ask Claude Code or Codex/);
  assert.match(verify, /\*\(API\)\* The Start here callout holds the plan table once/);
});

test("the plan table is the same in the README, the setup guide and the migration, each with its vendor links", async () => {
  for (const path of ["README.md", "docs/setup.md", MIGRATION]) {
    const text = await read(path);
    for (const row of ROWS) assert.ok(text.includes(row), `${path}: ${row}`);
  }
  for (const path of ["README.md", "docs/setup.md"]) {
    const text = await read(path);
    assert.match(text, /https:\/\/www\.notion\.com\/help\/ai-meeting-notes/);
    assert.match(text, /https:\/\/www\.notion\.com\/help\/notion-ai-faqs/);
    assert.match(text, /https:\/\/www\.notion\.com\/help\/buy-and-track-notion-credits-for-custom-agents/);
  }
});

test("no setup text says Notion AI is required", async () => {
  for (const path of ["README.md", "docs/setup.md", "docs/meetings-from-other-tools.md", "docs/chatgpt.md"]) {
    const text = await read(path);
    assert.doesNotMatch(text, /a Notion plan with Notion AI|Early access needs Notion AI|(?<!n't |not )\bneeds? Notion AI\b(?! meeting)(?!\))/, path);
  }
});
