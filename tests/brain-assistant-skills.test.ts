// CC-283: Brain Assistant's Skills database holds eleven pages, the ten skills of notion/brain-assistant.md and
// Write minutes, whose body is the minutes prompt of notion/minutes-format.md, from one source (decision 0106 §3).
// Text checks only: the pages are built the way Prompt 9 tells the agent to publish them.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");

/** The ```text blocks of a Markdown text, in order, without their fences. */
function textBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of markdown.split("\n")) {
    if (current === null && line === "```text") current = [];
    else if (current !== null && line === "```") {
      blocks.push(current.join("\n"));
      current = null;
    } else if (current !== null) current.push(line);
  }
  return blocks;
}

type Entry = { name: string; description: string | undefined; blocks: string[]; text: string };

/** The entries under "## Skills": each "### Name" heading outside a fence, up to the next one. */
function skillEntries(assistant: string): Entry[] {
  const section = assistant.slice(assistant.indexOf("\n## Skills\n"));
  const entries: { name: string; lines: string[] }[] = [];
  let fenced = false;
  for (const line of section.split("\n").slice(2)) {
    if (line.startsWith("```")) fenced = !fenced;
    if (!fenced && line.startsWith("### ")) entries.push({ name: line.slice(4).trim(), lines: [] });
    else if (!fenced && line.startsWith("**Without a Custom Agent**")) break;
    else entries.at(-1)?.lines.push(line);
  }
  return entries.map(({ name, lines }) => {
    const text = lines.join("\n");
    return { name, description: /^\*\*Description:\*\* (.+)$/m.exec(text)?.[1], blocks: textBlocks(text), text };
  });
}

/** Prompt 9 §2: one page per skill, its name the title, its Description line in Description, its text block the
 *  page body; Write minutes' body is the text block of minutes-format.md. */
async function publishedPages() {
  const minutesPrompt = textBlocks(await read("notion/minutes-format.md"));
  assert.equal(minutesPrompt.length, 1, "minutes-format.md holds one text block, the minutes prompt");
  return skillEntries(await read("notion/brain-assistant.md")).map((entry) => {
    const body = entry.name === "Write minutes" ? minutesPrompt[0] : entry.blocks[0];
    return { title: entry.name, description: entry.description, body };
  });
}

const TEN = ["Today", "Check minutes", "Prep", "Weekly review", "Plan check", "Tidy capture", "Voice summary", "Clean email", "Write up", "Refresh report"];

test("publishing Brain Assistant's skills creates eleven pages: the ten skills and Write minutes", async () => {
  const pages = await publishedPages();
  assert.deepEqual(pages.map((page) => page.title), [...TEN, "Write minutes"]);
  for (const page of pages) {
    assert.ok(page.description, `${page.title} has a Description line`);
    assert.ok(page.body && page.body.trim().length > 0, `${page.title} has a body`);
  }
});

test("Write minutes' body equals the minutes prompt, which has one source: minutes-format.md", async () => {
  const minutes = await read("notion/minutes-format.md");
  const page = (await publishedPages()).find((p) => p.title === "Write minutes");
  assert.equal(page?.body, textBlocks(minutes)[0]);
  const entry = skillEntries(await read("notion/brain-assistant.md")).find((e) => e.name === "Write minutes");
  assert.deepEqual(entry?.blocks, [], "brain-assistant.md keeps no copy of the minutes prompt");
  assert.match(entry!.text, /\[minutes-format\.md\]\(minutes-format\.md\)/);
  assert.match(await read("notion/prompts/09-assistant-and-guide.md"), /Write minutes has no text block there: its body is the text block of \[\.\.\/minutes-format\.md\]/);
});

test("Brain Assistant doesn't run Write minutes: its Description points to the Notion AI chat, and the Instructions don't let it edit", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const entry = skillEntries(assistant).find((e) => e.name === "Write minutes");
  assert.match(entry!.description!, /Brain Assistant doesn't run it/);
  assert.match(entry!.description!, /Notion AI chat on the meeting page/);
  assert.match(entry!.description!, /pasting-the-minutes-prompt\.md/);
  assert.match(entry!.description!, /doesn't edit the page/);
  const instructions = textBlocks(assistant.slice(assistant.indexOf("## Instructions")))[0];
  const editRule = instructions.split("\n").find((line) => line.includes("Only these skills may edit page text"));
  assert.ok(editRule && !editRule.includes("Write minutes"), "the Instructions' edit rule doesn't name Write minutes");
});

test("no shipped text outside migrations, decisions and history counts ten skills", async () => {
  const found: string[] = [];
  const dirs = ["notion", "docs", "spec", "templates", ".agents"];
  const files = ["README.md", "AGENTS.md"];
  for (const dir of dirs) {
    for (const file of await readdir(join(root, dir), { recursive: true })) {
      if (file.endsWith(".md") && !(dir === "notion" && file.startsWith("migrations"))) files.push(`${dir}/${file}`);
    }
  }
  for (const file of files) {
    (await read(file)).split("\n").forEach((line, index) => {
      if (/\bten (skills|pages)\b|\bTen skills\b/.test(line)) found.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(found, []);
});
