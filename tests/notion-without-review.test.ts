// CC-299: the shipped Notion text after 0.16.0 (decisions 0096 §6, 0099 §9, 0101 §5 and §7). Text checks only.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");

/** The shipped Notion text: everything under notion/ except the migrations, which are history by design. */
async function shippedNotionText(): Promise<string[]> {
  const entries = await readdir(join(root, "notion"), { recursive: true });
  return entries.filter((f) => f.endsWith(".md") && !f.startsWith("migrations")).map((f) => `notion/${f}`).sort();
}

/** What a line says when it uses one of the retired databases or their parts as current. */
const CURRENT = [
  /"Review"/, /"Decisions"/, /(?<!Tab )"Questions"/, /\bYour call\b/, /\bReview queue\b/, /\bGrill review\b/, /\bReview with me\b/,
  /\bPromote asked\b/, /\[Knowledge\]/, /\bDecided In\b/, /\bRaised In\b/, /\bReview Items\b/, /\bReview row/, /(?<!Tab )"To review"/, /\bTo review (formula|rollup|property)/,
  /\bDecisions database\b/, /\bQuestions database\b/, /\bReview database\b/,
];
/** A line that names one of them only to say it is gone (or names a migration that archives it) is fine. */
const RETIRED = /retired|0\.16\.0|0\.15\.x|archiv|there is no|no review|went with|were retired|history|0096|0099|migration 0027/i;

test("no shipped Notion text outside the migrations names the Review, Decisions or Questions database as current", async () => {
  const found: string[] = [];
  for (const file of await shippedNotionText()) {
    (await read(file)).split("\n").forEach((line, index) => {
      if (CURRENT.some((pattern) => pattern.test(line)) && !RETIRED.test(line)) found.push(`${file}:${index + 1}: ${line.slice(0, 120)}`);
    });
  }
  assert.deepEqual(found, []);
});

test("the build prompts and the design's current sections create no Review, Decisions or Questions database", async () => {
  const databases = await read("notion/prompts/02-databases.md");
  for (const name of ["Review", "Decisions", "Questions"]) assert.ok(!databases.includes(`"${name}": Name (title)`), name);
  assert.match(databases, /"Tasks": Name \(title\), .*Kind \(select: Task, Question, Risk\)/);
  assert.match(databases, /"Inbox": Name \(title\), Kind \(select: Capture, File, Email, Chat, Note, Ask, Catch-up, Weekly, Changed; default Capture\)/);
  const design = await read("docs/notion-space-design.md");
  assert.ok(!design.includes("<details>"), "the history blocks of design §3 went with the prompts");
});

test("the Business-with-credits line is in each of the four places, linked to Notion's help page (0101 §7)", async () => {
  const help = "https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents";
  const places: Record<string, string> = {
    "the Start here callout (Prompt 1)": await read("notion/prompts/01-pages.md"),
    "notion/TEMPLATE.md": await read("notion/TEMPLATE.md"),
    "docs/setup.md": await read("docs/setup.md"),
  };
  const assistant = await read("notion/brain-assistant.md");
  places["notion/brain-assistant.md's Setup"] = assistant.slice(assistant.indexOf("## Setup"), assistant.indexOf("## Running a skill"));
  for (const [place, text] of Object.entries(places)) {
    assert.match(text, /Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits/, place);
    assert.ok(text.includes(help), `${place} links Notion's help page`);
  }
  assert.ok((await read("notion/migrations/0027-one-place-to-decide.md")).includes(help), "the migration adds the line to an existing Start here callout");
});

test("no shipped Notion text tells Notion AI to create Tasks from minutes; the prompt, Check minutes and the Instructions say never to (0101 §5)", async () => {
  const minutes = await read("notion/minutes-format.md");
  const prompt = minutes.slice(minutes.indexOf("```text"), minutes.indexOf("```", minutes.indexOf("```text") + 7));
  assert.match(prompt, /Never create Tasks, or any other page or database row, from this meeting/);
  const assistant = await read("notion/brain-assistant.md");
  const block = (heading: string) => {
    const start = assistant.indexOf("```text", assistant.indexOf(heading));
    return assistant.slice(start, assistant.indexOf("```\n", start + 7));
  };
  assert.match(block("## Instructions"), /never create Tasks from a meeting or its minutes/);
  assert.match(block("### Check minutes"), /Never create Tasks from this meeting/);
  for (const file of await shippedNotionText()) {
    for (const line of (await read(file)).split("\n")) {
      assert.ok(!/(Notion AI|Brain Assistant)[^.]*\bcreates? (the )?Tasks\b/i.test(line) || /never|doesn't|don't/i.test(line), `${file}: ${line.slice(0, 120)}`);
    }
  }
});

test("Brain Assistant has ten skills, without Review queue and Grill review, and every guide counts ten", async () => {
  const assistant = await read("notion/brain-assistant.md");
  // The skills are the H3s of "## Skills" outside code fences (the Voice summary block holds the note's own headings).
  const skillsSection = assistant.slice(assistant.indexOf("## Skills")).replace(/```[\s\S]*?```/g, "");
  const skills = [...skillsSection.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(skills, ["Today", "Check minutes", "Prep", "Weekly review", "Plan check", "Tidy capture", "Voice summary", "Clean email", "Write up", "Refresh report"]);
  for (const file of ["notion/brain-assistant.md", "notion/TEMPLATE.md", "notion/prompts/09-assistant-and-guide.md", "docs/notion-space-design.md"]) {
    const text = await read(file);
    assert.ok(!/twelve skills|twelve pages/i.test(text), `${file} still counts twelve`);
    assert.match(text, /\bten (skills|pages)\b|\bTen skills\b/, `${file} counts ten`);
  }
});
