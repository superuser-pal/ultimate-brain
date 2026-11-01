import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-03T10:22:00Z";

async function freshBrain(context: TestContext): Promise<{ root: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), "brain-modules-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  return { root, target };
}

test("a new brain starts with the onboarding defaults, and modules lists what each one still lacks (0048)", async (context) => {
  const { root, target } = await freshBrain(context);
  const list = await brain(["modules", "--brain", target, "--json"], root);
  assert.equal(list.code, 0, list.stdout);
  assert.deepEqual(list.json.data.modules.map((module: { name: string; on: boolean }) => [module.name, module.on]), [
    ["domains", false], ["knowledge", true], ["orgs", true], ["documents", false], ["reports", false], ["tasks", false], ["planning", false],
  ]);
  const byName = Object.fromEntries(list.json.data.modules.map((module: { name: string }) => [module.name, module]));
  assert.deepEqual(byName.knowledge.missing, ["decisions", "questions", "concepts"]);
  assert.deepEqual(byName.tasks, { name: "tasks", on: false, default: false, databases: [], missing: ["tasks"] });
  assert.deepEqual(byName.reports.missing, []);

  const status = await brain(["status", "--brain", target, "--json"], root);
  assert.deepEqual(status.json.data.modules, { domains: false, knowledge: true, orgs: true, documents: false, reports: false, tasks: false, planning: false });
  assert.ok(status.json.data.notion.missing.includes("documents"));
});

test("modules on and off switch one key, log the change, and write nothing when already in that state (0048)", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const before = JSON.parse(await readFile(configPath, "utf8"));

  const on = await brain(["modules", "on", "documents", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(on.code, 0, on.stdout);
  assert.deepEqual(on.json.data, { module: "documents", on: true, changed: true, missing: ["documents"] });
  const after = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(after, { ...before, modules: { ...before.modules, documents: true } });
  assert.match(await readFile(join(target, "log/2026-12.md"), "utf8"), /modules - "documents" state=on\n$/);

  const text = await readFile(configPath, "utf8");
  const again = await brain(["modules", "on", "documents", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(again.json.data.changed, false);
  assert.equal(await readFile(configPath, "utf8"), text);

  const off = await brain(["modules", "off", "knowledge", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(off.json.data.on, false);
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).modules.knowledge, false);
  assert.match(await readFile(join(target, "log/2026-12.md"), "utf8"), /modules - "knowledge" state=off\n$/);
});

test("a brain without a modules block has every module on; switching one writes the whole block first (0048)", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  delete config.modules;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const status = await brain(["status", "--brain", target, "--json"], root);
  assert.deepEqual(status.json.data.modules, { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true });

  const off = await brain(["modules", "off", "planning", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(off.code, 0, off.stdout);
  const after = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(Object.keys(after), ["schema_version", "owner", "budgets", "settings", "modules", "notion"]);
  assert.deepEqual(after.modules, { domains: false, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: false });
});

test("a present block with a key left out takes that module's default (schema §12)", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { documents: true };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const status = await brain(["status", "--brain", target, "--json"], root);
  assert.deepEqual(status.json.data.modules, { domains: false, knowledge: true, orgs: true, documents: true, reports: false, tasks: false, planning: false });
});

test("modules refuses core, an unknown module and a switch without one", async (context) => {
  const { root, target } = await freshBrain(context);
  for (const args of [["modules", "on", "core"], ["modules", "off", "meetings"], ["modules", "on"]]) {
    const run = await brain([...args, "--brain", target, "--now", NOW, "--json"], root);
    assert.equal(run.code, 2, run.stdout);
    assert.equal(run.json.error.code, "USAGE");
  }
});

test("render leaves out the notes and relations of a module that is off; --ids names them MODULE_OFF (0048)", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { knowledge: false, orgs: false, documents: false, reports: false, tasks: false, planning: false };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

  const changed = await brain(["sync", "render", "--changed", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(changed.code, 0, changed.stdout);
  const types = new Set(changed.json.data.items.map((item: { type: string }) => item.type));
  for (const type of ["decision", "question", "concept", "org", "goal"]) assert.equal(types.has(type), false, type);

  const named = await brain(["sync", "render", "--ids", "dec-7k2m9q4x,per-3h8w2n6c,mtg-8c4n2p7w", "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual(named.json.data.errors, [{ id: "dec-7k2m9q4x", reason: "MODULE_OFF" }]);
  for (const item of named.json.data.items) {
    for (const property of ["Org", "Decisions", "Questions"]) {
      assert.equal(item.properties[property], undefined, `${item.id} ${property}`);
      assert.equal(item.published[property], undefined, `${item.id} ${property}`);
      assert.equal(item.pending_relations.some((relation: { property: string }) => relation.property === property), false);
    }
  }
});

test("with Planning off, sync plan reads no Goals or Key Results; switching a module off and on loses no note (0048)", async (context) => {
  const dir = await fixtureCopy(context);
  const before = await brain(["status", "--brain", dir, "--json"]);
  assert.equal((await brain(["modules", "off", "planning", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const plan = await brain(["sync", "plan", "--input", await writeInput(dir, { as_of: NOW, rows: [
    { database: "goals", page_id: "d7000000-0000-4000-8000-000000000001", last_edited: NOW, properties: { "Brain ID": null, Name: "Write a book" } },
    { database: "key_results", page_id: "d7000000-0000-4000-8000-000000000002", last_edited: NOW, properties: { Name: "Draft 3 chapters", Goal: [] } },
  ] }), "--brain", dir, "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.ignored.map((item: { reason: string }) => item.reason), ["MODULE_OFF", "MODULE_OFF"]);
  assert.deepEqual(plan.json.data.create, []);

  assert.equal((await brain(["modules", "on", "planning", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const after = await brain(["status", "--brain", dir, "--json"]);
  assert.deepEqual(after.json.data.notes, before.json.data.notes);
});

test("sync tasks fails with MODULE_OFF while Tasks is off (0048)", async (context) => {
  const dir = await fixtureCopy(context);
  assert.equal((await brain(["modules", "off", "tasks", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const run = await brain(["sync", "tasks", "--meeting", "mtg-8c4n2p7w", "--input", await writeInput(dir, { tasks: [] }), "--brain", dir, "--json"]);
  assert.equal(run.code, 4, run.stdout);
  assert.equal(run.json.error.code, "MODULE_OFF");
});

async function writeInput(dir: string, value: unknown): Promise<string> {
  const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(value));
  return file;
}

test("Domains default off and retain notes and Area relations across switching", async (context) => {
  const dir = await fixtureCopy(context);
  const note = { notes: [{ type: "domain", id: "dom-12345678", title: "Context", frontmatter: { summary: "Context" }, body: "" }] };
  const input = await writeInput(dir, note);
  const off = await brain(["note", "new", "--input", input, "--brain", dir, "--json"]);
  assert.equal(off.json.error.code, "MODULE_OFF");
  assert.equal((await brain(["modules", "on", "domains", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const created = await brain(["note", "new", "--input", input, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(created.code, 0, created.stdout);
  assert.equal(created.json.data.created[0].path, "domains/context.md");
  const planInput = await writeInput(dir, { as_of: NOW, rows: [{ database: "areas", page_id: "e1000000-0000-4000-8000-000000000001", last_edited: NOW, properties: { Name: "New area", Domain: ["a", "b"] } }] });
  const plan = await brain(["sync", "plan", "--input", planInput, "--brain", dir, "--json"]);
  assert.equal(plan.json.data.conflicts[0].code, "MULTIPLE_DOMAINS");
  assert.deepEqual(plan.json.data.create, []);
  assert.equal((await brain(["modules", "off", "domains", "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const ignored = await brain(["sync", "plan", "--input", planInput, "--brain", dir, "--json"]);
  assert.ok(ignored.json.data.ignored.some((row: { property?: string; reason: string }) => row.property === "Domain" && row.reason === "MODULE_OFF"));
  const rendered = await brain(["sync", "render", "--ids", "dom-12345678", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(rendered.json.data.errors[0].reason, "MODULE_OFF");
});

test("Area Domain renders as a relation and is omitted while Domains is off", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { domains: true };
  config.notion.databases.domains = "a1000000-0000-4000-8000-00000000000d";
  await writeFile(configPath, JSON.stringify(config));
  const input = await writeInput(dir, { notes: [{ type: "domain", id: "dom-12345678", title: "Context", frontmatter: { summary: "Context", notion: "a1000000-0000-4000-8000-00000000000e" }, body: "" }] });
  const made = await brain(["note", "new", "--input", input, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(made.code, 0, made.stdout);
  const areaPath = join(dir, "areas", "clients.md");
  const area = await readFile(areaPath, "utf8");
  await writeFile(areaPath, area.replace("type: area\n", "type: area\ndomain: dom-12345678\n"));
  let rendered = await brain(["sync", "render", "--ids", "area-2m7c4h8n", "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual(rendered.json.data.items[0].properties.Domain, { type: "relation", value: ["a1000000-0000-4000-8000-00000000000e"] });
  config.modules.domains = false;
  await writeFile(configPath, JSON.stringify(config));
  rendered = await brain(["sync", "render", "--ids", "area-2m7c4h8n", "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(rendered.json.data.items[0].properties.Domain, undefined);
  assert.match(await readFile(areaPath, "utf8"), /domain: dom-12345678/);
});

test("Area Domain changes in Notion produce a correctable single relation", async (context) => {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { domains: true };
  await writeFile(configPath, JSON.stringify(config));
  const domainPage = "a1000000-0000-4000-8000-00000000000e";
  const input = await writeInput(dir, { notes: [{ type: "domain", id: "dom-12345678", title: "Context", frontmatter: { summary: "Context", notion: domainPage }, body: "" }] });
  assert.equal((await brain(["note", "new", "--input", input, "--brain", dir, "--now", NOW, "--json"])).code, 0);
  const areaPath = join(dir, "areas", "clients.md");
  const area = await readFile(areaPath, "utf8");
  await writeFile(areaPath, area.replace("last_synced:", "notion_published:\n  Domain: []\nlast_synced:"));
  const snapshot = await writeInput(dir, { as_of: NOW, rows: [{ database: "areas", page_id: "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", last_edited: NOW, properties: { "Brain ID": "area-2m7c4h8n", Domain: [domainPage] } }] });
  const plan = await brain(["sync", "plan", "--input", snapshot, "--brain", dir, "--json"]);
  assert.equal(plan.code, 0, plan.stdout);
  assert.deepEqual(plan.json.data.corrections.map((item: { field: string; value: string }) => [item.field, item.value]), [["domain", "dom-12345678"]]);
});
