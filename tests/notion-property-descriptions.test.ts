import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");

/** Notion refuses a property description longer than this (CC-276). */
const LIMIT = 280;

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), { recursive: true });
  return entries.filter((f) => f.endsWith(".md")).map((f) => `${dir}/${f}`);
}

/** Every property description the build prompts, modules and migrations set: a quoted text starting "Owner: ". */
function descriptions(text: string): string[] {
  return [...text.matchAll(/["`](Owner: [^"`]*)["`]/g)].map((m) => m[1]);
}

test("every property description the Notion steps set fits Notion's 280-character limit", async () => {
  const files = [
    ...(await markdownFiles("notion/prompts")),
    ...(await markdownFiles("notion/modules")),
    ...(await markdownFiles("notion/migrations")),
  ];
  let seen = 0;
  for (const file of files) {
    for (const d of descriptions(await read(file))) {
      seen++;
      assert.ok(d.length <= LIMIT, `${file}: a ${d.length}-character description: ${d.slice(0, 60)}…`);
    }
  }
  assert.ok(seen > 20, `only ${seen} descriptions found: the pattern no longer matches the prompts`);
});

test("a new space and migration 0027 give the same descriptions: brain-owned values asked in the session, and Tasks · Kind (0101 §4, 0099 §4)", async () => {
  const prompt = await read("notion/prompts/05-ownership.md");
  const migration = await read("notion/migrations/0027-one-place-to-decide.md");
  const tasks = await read("notion/modules/tasks.md");
  for (const text of [
    "Owner: brain. An edit here is asked in your agent session before it reaches the brain.",
    "Owner: you when creating, then brain. A later edit is asked in your agent session before it reaches the brain.",
  ]) {
    assert.ok(prompt.includes(`"${text}"`), `Prompt 5 sets: ${text}`);
    assert.ok(migration.includes(`\`${text}\``), `migration 0027 sets: ${text}`);
  }
  const kind = descriptions(migration).filter((d) => d.includes("question or risk you said to follow up"));
  assert.equal(kind.length, 1, "migration 0027 sets one Tasks · Kind description");
  assert.ok(prompt.includes(`"${kind[0]}" for Kind in "Tasks"`));
  assert.ok(tasks.includes(`"${kind[0]}"`));
});
