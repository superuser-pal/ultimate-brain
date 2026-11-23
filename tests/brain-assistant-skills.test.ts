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

/** Prompt 9 §2 (CC-385): one page per skill, its name the title, its text block in Description, its body empty. An
 *  entry with no text block names its source on its "**Text:**" line: its Description line goes in Description and
 *  the body is the one text block of the file that line links (Write minutes: minutes-format.md). */
async function publishedPages() {
  const pages = [];
  for (const entry of skillEntries(await read("notion/brain-assistant.md"))) {
    let description = entry.blocks[0];
    let body = "";
    if (entry.blocks.length === 0) {
      const link = /^\*\*Text:\*\* .*?\]\(([^)]+\.md)\)/m.exec(entry.text)?.[1];
      assert.ok(link, `${entry.name} has a text block or a Text: line that links its source`);
      const source = textBlocks(await read(join("notion", link)));
      assert.equal(source.length, 1, `${link} holds one text block`);
      description = entry.description!;
      body = source[0];
    }
    pages.push({ title: entry.name, line: entry.description, description, body });
  }
  return pages;
}

const TEN = ["Today", "Check minutes", "Prep", "Weekly review", "Plan check", "Tidy capture", "Voice summary", "Clean email", "Write up", "Refresh report"];

test("publishing Brain Assistant's skills creates eleven pages: the ten skills and Write minutes", async () => {
  const pages = await publishedPages();
  assert.deepEqual(pages.map((page) => page.title), [...TEN, "Write minutes"]);
  for (const page of pages) {
    assert.ok(page.line, `${page.title} has a Description line`);
    if (page.title === "Write minutes") {
      assert.equal(page.description, page.line, "Write minutes' Description is its Description line");
      assert.ok(page.body.trim().length > 0, "Write minutes' body is the minutes prompt");
    } else {
      assert.match(page.description, /^Goal: /, `${page.title}'s Description is its text block`);
      assert.equal(page.body, "", `${page.title}'s body is empty`);
      // A rich_text item holds 2000 characters and the block is cut at line ends, so no line may be longer.
      for (const line of page.description.split("\n")) assert.ok(line.length < 2000, `${page.title}: a line fits one item`);
    }
  }
});

test("the prompt, the setup and the specs name one place for a skill's text: Description (CC-385)", async () => {
  const prompt9 = await read("notion/prompts/09-assistant-and-guide.md");
  assert.match(prompt9, /\*\*Description:\*\* the skill's whole text block, word for word/);
  assert.match(prompt9, /\*\*Body:\*\* empty/);
  assert.match(prompt9, /at most 2000 characters/);
  assert.match(await read("notion/brain-assistant.md"), /its whole text block goes in Description, and the body stays empty/);
  assert.match(await read("spec/setup.md"), /A skill page keeps its whole text block in \*\*Description\*\*, with an empty body/);
  assert.match(await read("docs/notion-space-design.md"), /in its \*\*Description\*\* property, and its body is empty/);
  for (const file of ["notion/prompts/09-assistant-and-guide.md", "notion/brain-assistant.md", "notion/pasting-the-minutes-prompt.md", "spec/setup.md", "docs/notion-space-design.md"]) {
    assert.doesNotMatch(await read(file), /as the body|replace the body|text block is the page body/, file);
  }
});

test("Write minutes' body equals the minutes prompt, which has one source: minutes-format.md", async () => {
  // The minutes prompt, read on its own: the fenced text block under minutes-format.md's opening paragraphs.
  const minutes = await read("notion/minutes-format.md");
  const start = minutes.indexOf("```text\n") + "```text\n".length;
  const prompt = minutes.slice(start, minutes.indexOf("\n```\n", start));
  assert.match(prompt, /^Write the minutes of the meeting transcript/);
  const page = (await publishedPages()).find((p) => p.title === "Write minutes");
  assert.equal(page?.body, prompt);
  const entry = skillEntries(await read("notion/brain-assistant.md")).find((e) => e.name === "Write minutes");
  assert.deepEqual(entry?.blocks, [], "brain-assistant.md keeps no copy of the minutes prompt");
  assert.match(entry!.text, /\[minutes-format\.md\]\(minutes-format\.md\)/);
  assert.match(await read("notion/prompts/09-assistant-and-guide.md"), /Write minutes has no text block there: its body is the text block of \[\.\.\/minutes-format\.md\]/);
});

test("Brain Assistant doesn't run Write minutes: its Description points to the Notion AI chat, and the Instructions don't let it edit", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const entry = skillEntries(assistant).find((e) => e.name === "Write minutes");
  assert.match(entry!.description!, /Notion Brain Assistant doesn't run it/);
  assert.match(entry!.description!, /Notion AI chat on the meeting page/);
  assert.match(entry!.description!, /Write the minutes on this page, below the transcript, and nothing else\./);
  assert.match(entry!.description!, /Asked to write minutes, Notion Brain Assistant gives you these steps and doesn't edit the page/);
  assert.doesNotMatch(entry!.description!, /\.md\b/, "the Description names no repo file a Notion user can't open");
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
