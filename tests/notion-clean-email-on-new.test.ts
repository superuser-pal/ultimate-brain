// CC-350: Clean email acts only on captures with Brain Status New, as Tidy capture does (decision 0106 §3, finding F-0010). Text checks only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const MIGRATION_FILE = "0029-new-task-on-home-clean-email-and-the-minutes-layout.md";

const READY_REASON = "a Ready row may already be taken in by the brain";

function skill(text: string, name: string): string {
  const start = text.indexOf(`### ${name}\n`);
  assert.ok(start >= 0, name);
  const end = text.indexOf("\n### ", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
}

test("Clean email's description and Source line say New only, with Tidy capture's reason", async () => {
  const assistant = await read("notion/brain-assistant.md");
  const clean = skill(assistant, "Clean email");
  const tidy = skill(assistant, "Tidy capture");
  assert.doesNotMatch(clean, /New or Ready/);
  assert.match(clean, /\*\*Description:\*\*[^\n]*Kind Capture, Brain Status New, when I say "clean email"/);
  const source = clean.split("\n").find((l) => l.startsWith("Source:"));
  const tidySource = tidy.split("\n").find((l) => l.startsWith("Source:"));
  assert.ok(source && tidySource);
  assert.match(source, /with Kind Capture and Brain Status New; otherwise stop and tell me \(/);
  assert.ok(source.includes(READY_REASON));
  assert.equal(source.slice(source.indexOf("Brain Status New;")), tidySource.slice(tidySource.indexOf("Brain Status New;")));
});

test("migration 0029 part B replaces Clean email's text by hand, names the old text and reads the new Source line back", async () => {
  const migration = await read(`notion/migrations/${MIGRATION_FILE}`);
  const assistant = await read("notion/brain-assistant.md");
  const newSource = skill(assistant, "Clean email").split("\n").find((l) => l.startsWith("Source:"));
  assert.ok(newSource);
  const partB = migration.slice(migration.indexOf("## Part B · Clean email on New captures only"), migration.indexOf("## The last steps"));
  assert.ok(partB.length > 0);
  assert.match(partB, /### B1 · Clean email's text \(by hand\)/);
  assert.ok(partB.includes("Brain Status New or Ready; otherwise stop and tell me."), "names the text it replaces");
  assert.match(partB, /### B2 · Read Clean email back \(by hand\)/);
  assert.ok(partB.includes(`reads: "${newSource}"`), "reads the new Source line back, word for word");
  assert.match(partB, /Instructions don't change/);
  assert.match(partB, /Run Clean email\*\*\. It stops, changes nothing/);
  assert.ok(migration.indexOf("## Part A") < migration.indexOf("## Part B") && migration.indexOf("## Part B") < migration.indexOf("## The last steps"));
  const verify = migration.slice(migration.indexOf("## Verify"));
  assert.match(verify, /Part B, Clean email on New captures only \(decision 0106 §3\):\n- \[ \] \*\(you\)\* The Clean email page in Skills/);

  const readme = await read("notion/migrations/README.md");
  assert.match(readme, /\[0029\][^\n]*Clean email[^\n]*Brain Status New[^\n]*CC-350 \(release 0\.16\.2\)/);
});

test("no shipped text outside migrations, decisions and history lets Clean email act on a Ready row", async () => {
  for (const path of ["notion/brain-assistant.md", "docs/notion-space-design.md", "notion/TEMPLATE.md", "notion/prompts/09-assistant-and-guide.md"]) {
    const text = await read(path);
    for (const line of text.split("\n").filter((l) => /Clean email/i.test(l))) {
      assert.doesNotMatch(line, /New or Ready|while still \*\*New\*\*|best while/, `${path}: ${line}`);
    }
  }
});
