import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter, serializeFrontmatter, serializeNewFile } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const MARIA = "per-3h8w2n6c";
const MARIA_PAGE = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";

async function input(dir: string, name: string, value: unknown): Promise<string> {
  const path = join(dir, "..", name);
  await writeFile(path, JSON.stringify(value));
  return path;
}

test("sync plan detects a Notion fact correction from its published baseline", async (context) => {
  const dir = await fixtureCopy(context);
  const path = "knowledge/people/maria-lopez.md";
  const file = join(dir, path);
  const document = parseFrontmatter(await readFile(file, "utf8"));
  document.attributes.notion_published = { Name: "Maria López", Summary: document.attributes.summary, Role: "Product Manager", Lifecycle: "Reviewed", "Brain ID": MARIA };
  await writeFile(file, serializeFrontmatter(document));
  const snapshot = { as_of: NOW, rows: [{ database: "people", page_id: MARIA_PAGE, last_edited: "2026-12-10T08:00:00Z", properties: { "Brain ID": MARIA, Role: "Product lead" } }] };
  const run = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", snapshot), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.corrections, [{ target: MARIA, field: "facts.role", value: "Product lead", observed_at: "2026-12-10T08:00:00Z", property: "Role", notion_value: "Product lead" }]);
});

test("sync apply creates a Notion-created note with its lifecycle and applies corrections", async (context) => {
  const dir = await fixtureCopy(context);
  const mariaPath = join(dir, "knowledge/people/maria-lopez.md");
  await writeFile(mariaPath, `${await readFile(mariaPath, "utf8")}\nCurrently coordinating launch work.\n`);
  const plan = {
    as_of: NOW,
    create: [{ type: "org", id: "org-1a2b3c4d", title: "Globex", lifecycle: "reviewed", frontmatter: { summary: "Globex", sources: ["notion:10000000-0000-4000-8000-000000000001"], notion: "10000000-0000-4000-8000-000000000001" }, body: "" }],
    updates: [],
    corrections: [{ target: MARIA, field: "facts.role", value: "Product lead", observed_at: "2026-12-10T08:00:00Z" }],
    decisions: [], conflicts: [], ignored: [],
  };
  const run = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", await input(dir, "plan.json", plan), "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const globex = parseFrontmatter(await readFile(join(dir, "knowledge/orgs/globex.md"), "utf8")).attributes;
  assert.equal(globex.lifecycle, "reviewed");
  const maria = parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes;
  assert.equal((maria.facts as Record<string, unknown>).role, "Product lead");
  assert.ok(run.json.warnings.some((warning: { code: string; path: string }) => warning.code === "FRESHNESS" && warning.path === "knowledge/people/maria-lopez.md"));
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.match(log, /sync-create org-1a2b3c4d "Globex"/);
});

test("sync tasks renders mapped task fields and sync record never changes updated", async (context) => {
  const dir = await fixtureCopy(context);
  const tasks = await brain(["sync", "tasks", "--brain", dir, "--meeting", "mtg-8c4n2p7w", "--input", await input(dir, "tasks.json", { items: [{ title: "Send plan", owner: "Carlos Ruiz", due: "2026-12-10" }] }), "--json"]);
  assert.equal(tasks.code, 0, tasks.stdout);
  assert.equal(tasks.json.data.items[0].database_id, "a1000000-0000-4000-8000-00000000000b");
  assert.equal(tasks.json.data.items[0].properties.Name.value, "Send plan");
  const before = parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes.updated;
  const record = await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id: MARIA, notion: MARIA_PAGE, synced_at: NOW, published: { Role: "Product Manager" } }] }), "--json"]);
  assert.equal(record.code, 0, record.stdout);
  const after = parseFrontmatter(await readFile(join(dir, "knowledge/people/maria-lopez.md"), "utf8")).attributes;
  assert.equal(after.updated, before);
  assert.equal((after.notion_published as Record<string, unknown>).Role, "Product Manager");
});

test("sync render presents an add_link review with its target title", async (context) => {
  const dir = await fixtureCopy(context);
  await writeFile(join(dir, "_proposals/2026-12-10-add-carlos.md"), serializeNewFile({
    id: "prp-0a1b2c3d", type: "proposal", title: "Add Carlos to Acme website", created: "2026-12-10", updated: "2026-12-10",
    kind: "add_link", target: "prj-9x4t1b7e", field: "people", after: "per-9t2c6m4a", why: "Carlos joins the project.", source: "mtg-8c4n2p7w", status: "pending",
  }, ""));
  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prp-0a1b2c3d", "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const properties = run.json.data.items[0].properties;
  assert.equal(properties.Kind.value, "Add Link");
  assert.equal(properties.Before.value, null);
  assert.equal(properties.After.value, "People: Carlos Ruiz");
});
