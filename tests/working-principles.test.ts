import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain } from "./helpers.ts";

const REPO = join(import.meta.dirname, "..");

/**
 * CC-211 (decision 0081 §1, §2, §5): the brain template's rules block holds the four working principles, the three reply rules and the
 * operations line for changing the response style in chat, and `brain upgrade` brings them to an older brain while keeping everything
 * outside the rules markers (the style block and the user's own rules) byte for byte. Synthetic brains only.
 */

const NOW = "2026-12-03T10:22:00Z";
const RULES = /<!-- ultimate-brain:rules:start[^>]*-->[\s\S]*?<!-- ultimate-brain:rules:end -->/;
const STYLE = /<!-- ultimate-brain:style:start -->[\s\S]*?<!-- ultimate-brain:style:end -->/;

const PRINCIPLES = ["Ask when a request reads two ways.", "Add only what was asked for.", "Change only what was named.", "Say what you checked."];
const REPLY_RULES = [
  "no opener such as \"Great question!\", and no closer such as \"Let me know if…\"",
  "State an error as its cause and its fix",
  "When something is left open, end with the one next action.",
];
const STYLE_ROW = "| change how the brain talks to them (\"talk to me more simply\", \"shorter answers\", \"go back to normal\") | `brain-setup` (\"Changing the response style\") |\n";

async function template(): Promise<string> {
  return readFile(join(REPO, "templates/brain/AGENTS.md"), "utf8");
}

/** The rules block as a 0.13.x brain has it: no style row, no "How to work", no "How to reply". */
function olderRules(rules: string): string {
  const start = rules.indexOf("## How to work\n");
  const end = rules.indexOf("## Write path\n");
  assert.ok(start > 0 && end > start, "the template has the new sections before Write path");
  return rules.slice(0, start).replace(STYLE_ROW, "") + rules.slice(end);
}

async function freshBrain(context: TestContext): Promise<{ root: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), "brain-principles-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  return { root, target };
}

test("the rules block holds the four working principles, the three reply rules and the style row, in our own words", async () => {
  const rules = (await template()).match(RULES)![0];
  for (const principle of PRINCIPLES) assert.ok(rules.includes(`- **${principle}**`), principle);
  for (const rule of REPLY_RULES) assert.ok(rules.includes(rule), rule);
  assert.ok(rules.includes(STYLE_ROW));
  assert.ok(rules.indexOf("## How to work\n") < rules.indexOf("## How to reply\n"));
  assert.ok(rules.indexOf("## How to reply\n") < rules.indexOf("## Write path\n"));
  // 0081 §8: the Karpathy guidelines are restated, never copied; none of their headings appears.
  for (const phrase of [/think before coding/i, /simplicity first/i, /surgical changes/i, /goal-driven execution/i, /karpathy/i]) assert.doesNotMatch(rules, phrase);
  // The rules don't reach into the style block's place: it stays after the end marker.
  assert.doesNotMatch(rules, /ultimate-brain:style/);
});

test("upgrade brings the new rules to an older brain and keeps the style block and the user's rules byte for byte", async (context) => {
  const { root, target } = await freshBrain(context);
  const agentsPath = join(target, "AGENTS.md");
  const shipped = await readFile(agentsPath, "utf8");
  const current = shipped.match(RULES)![0];
  assert.equal(current, (await template()).match(RULES)![0]);

  // A 0.13.x rules block, the user's own rules below it, then the Simple style block written by the CLI.
  await writeFile(agentsPath, `${shipped.replace(current, () => olderRules(current))}Drop folder: ~/Documents/brain-dropbox/\nLanguage: English\n`);
  const style = await brain(["config", "set", "settings.style", '{ "preset": "simple" }', "--brain", target, "--json"], root);
  assert.equal(style.code, 0, style.stdout);
  const before = await readFile(agentsPath, "utf8");
  assert.doesNotMatch(before, /## How to work\n/);
  const outside = before.replace(RULES, "");
  assert.match(outside, STYLE);

  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  assert.ok(run.json.data.files.some((file: { path: string; action: string }) => file.path === "AGENTS.md" && file.action === "updated"));
  const after = await readFile(agentsPath, "utf8");
  assert.equal(after.match(RULES)![0], current);
  assert.equal(after.replace(RULES, ""), outside);

  const again = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(again.code, 0, again.stdout);
  assert.equal(await readFile(agentsPath, "utf8"), after);
});
