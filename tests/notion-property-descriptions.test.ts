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

test("a new space and migration 0025 give Your call the same description", async () => {
  const migration = descriptions(await read("notion/migrations/0025-review-with-me-and-your-call-decides.md"));
  const set = migration.filter((d) => d.includes("Request revision"));
  assert.equal(set.length, 1, "migration 0025 sets one Your call description");
  const [yourCall] = set;
  assert.ok((await read("notion/prompts/02-databases.md")).includes(`Your call, "${yourCall}"`));
  assert.ok((await read("notion/prompts/05-ownership.md")).includes(`"${yourCall}" for Your call in "Review"`));
  assert.ok((await read("docs/notion-space-design.md")).includes(`"${yourCall}"`));
});
