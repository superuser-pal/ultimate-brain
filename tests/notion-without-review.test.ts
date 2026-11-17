// CC-299: the shipped Notion text after 0.16.0 (decisions 0096 §6, 0099 §9, 0101 §5 and §7). Text checks only.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");

/** The shipped Notion text: everything under notion/ except the migrations, which are history by design, and the brain and repo templates
 *  (CC-345: the brain's AGENTS.md rules block still sent agents to the Review queue). */
async function shippedNotionText(): Promise<string[]> {
  const entries = await readdir(join(root, "notion"), { recursive: true });
  const templates = await readdir(join(root, "templates"), { recursive: true });
  return [
    ...entries.filter((f) => f.endsWith(".md") && !f.startsWith("migrations")).map((f) => `notion/${f}`),
    ...templates.filter((f) => f.endsWith(".md")).map((f) => `templates/${f}`),
  ].sort();
}

/** What a line says when it uses one of the retired databases or their parts as current. */
const CURRENT = [
  /"Review"/, /"Decisions"/, /(?<!Tab )"Questions"/, /\bYour call\b/, /\bReview queue\b/, /\bGrill review\b/, /\bReview with me\b/,
  /\bPromote asked\b/, /\[Knowledge\]/, /\bDecided In\b/, /\bRaised In\b/, /\bReview Items\b/, /\bReview row/, /(?<!Tab )"To review"/, /\bTo review (formula|rollup|property)/,
  /\bDecisions database\b/, /\bQuestions database\b/, /\bReview database\b/,
];
/** A line that names one of them only to say it is gone (or names a migration that archives it) is fine. */
const RETIRED = /retired|0\.16\.0|0\.15\.x|archiv|there is no|no review|went with|were retired|history|0096|0099|migration 0027/i;

test("no shipped Notion or template text outside the migrations names the Review, Decisions or Questions database as current", async () => {
  const found: string[] = [];
  for (const file of await shippedNotionText()) {
    (await read(file)).split("\n").forEach((line, index) => {
      if (CURRENT.some((pattern) => pattern.test(line)) && !RETIRED.test(line)) found.push(`${file}:${index + 1}: ${line.slice(0, 120)}`);
    });
  }
  assert.deepEqual(found, []);
});

test("Prompt 2 builds the Kind options the CLI writes on Tasks and the Inbox (0099, 0096)", async () => {
  const databases = await read("notion/prompts/02-databases.md");
  assert.match(databases, /"Tasks": Name \(title\), .*Kind \(select: Task, Question, Risk\)/);
  assert.match(databases, /"Inbox": Name \(title\), Kind \(select: Capture, File, Email, Chat, Note, Ask, Catch-up, Weekly, Changed; default Capture\)/);
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
