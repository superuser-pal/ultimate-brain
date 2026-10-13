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

test("sync render gives supersede and merge reviews titles and truncates text", async (context) => {
  const dir = await fixtureCopy(context);
  const common = { type: "proposal", created: "2026-12-10", updated: "2026-12-10", why: "w", source: "mtg-8c4n2p7w", status: "pending" };
  await writeFile(join(dir, "_proposals/2026-12-10-supersede.md"), serializeNewFile({ ...common, id: "prp-0a1b2c3d", title: "Supersede auth", kind: "supersede", target: "dec-7k2m9q4x", supersedes: "dec-2p9f6h1r" }, ""));
  await writeFile(join(dir, "_proposals/2026-12-10-merge.md"), serializeNewFile({ ...common, id: "prp-1a1b2c3d", title: "Merge people", kind: "merge", target: "per-9t2c6m4a", merge_into: "per-3h8w2n6c" }, ""));
  await writeFile(join(dir, "_proposals/2026-12-10-long.md"), serializeNewFile({ ...common, id: "prp-2a1b2c3d", title: "Long note", kind: "add_to_note", target: "org-6d1f9z3k", content: "x".repeat(2001) }, ""));
  const run = await brain(["sync", "render", "--brain", dir, "--ids", "prp-0a1b2c3d,prp-1a1b2c3d,prp-2a1b2c3d", "--json"]);
  assert.equal(run.code, 0, run.stdout);
  const byId = new Map<string, Record<string, { value: unknown }>>(run.json.data.items.map((item: { id: string; properties: Record<string, { value: unknown }> }) => [item.id, item.properties]));
  assert.equal(byId.get("prp-0a1b2c3d")!.Before.value, "Use Firebase for auth");
  assert.equal(byId.get("prp-1a1b2c3d")!.Before.value, "Carlos Ruiz");
  assert.equal((byId.get("prp-2a1b2c3d")!.After.value as string).length, 2000);
});

test("sync publishes the brain's values for a Notion-created row whose brain-owned properties are empty", async (context) => {
  const dir = await fixtureCopy(context);
  const page = "10000000-0000-4000-8000-0000000000aa";
  const row = { database: "areas", page_id: page, last_edited: "2026-12-10T08:00:00Z", properties: { Name: "Initech", Summary: null, Lifecycle: null, "Brain ID": null, Archived: false } };
  const plan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot.json", { as_of: NOW, rows: [row] }), "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  const planPath = await input(dir, "plan.json", plan.json.data);
  const apply = await brain(["sync", "apply", "--brain", dir, "--now", NOW, "--input", planPath, "--json"]);
  assert.equal(apply.code, 0, apply.stdout);
  const id = apply.json.data.create[0].id;
  const render = await brain(["sync", "render", "--brain", dir, "--now", NOW, "--changed", "--plan", planPath, "--json"]);
  const item = render.json.data.items.find((entry: { id: string }) => entry.id === id);
  assert.equal(item.properties.Summary.value, "Initech");
  assert.equal(item.properties.Lifecycle.value, "Draft");
  const record = await brain(["sync", "record", "--brain", dir, "--now", NOW, "--input", await input(dir, "record.json", { records: [{ id, notion: page, synced_at: NOW, published: item.published }] }), "--json"]);
  assert.equal(record.code, 0, record.stdout);
  const published = { ...row, properties: { ...row.properties, Summary: "Initech", Lifecycle: "Draft", "Brain ID": id } };
  const replan = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot2.json", { as_of: NOW, rows: [published] }), "--json"]);
  assert.deepEqual([replan.json.data.updates, replan.json.data.corrections, replan.json.data.conflicts], [[], [], []]);
  const edited = { ...published, properties: { ...published.properties, Lifecycle: "Reviewed" } };
  const edit = await brain(["sync", "plan", "--brain", dir, "--input", await input(dir, "snapshot3.json", { as_of: NOW, rows: [edited] }), "--json"]);
  assert.deepEqual(edit.json.data.conflicts, []);
  assert.equal(edit.json.data.updates[0].lifecycle, "reviewed");
});
