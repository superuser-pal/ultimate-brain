import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain } from "./helpers.ts";

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
    ["knowledge", true], ["orgs", true], ["documents", false], ["reports", false], ["tasks", false], ["planning", false],
  ]);
  const byName = Object.fromEntries(list.json.data.modules.map((module: { name: string }) => [module.name, module]));
  assert.deepEqual(byName.knowledge.missing, ["decisions", "questions", "concepts"]);
  assert.deepEqual(byName.tasks, { name: "tasks", on: false, default: false, databases: [], missing: ["tasks"] });
  assert.deepEqual(byName.reports.missing, []);

  const status = await brain(["status", "--brain", target, "--json"], root);
  assert.deepEqual(status.json.data.modules, { knowledge: true, orgs: true, documents: false, reports: false, tasks: false, planning: false });
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
  assert.deepEqual(status.json.data.modules, { knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true });

  const off = await brain(["modules", "off", "planning", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(off.code, 0, off.stdout);
  const after = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(Object.keys(after), ["schema_version", "owner", "budgets", "settings", "modules", "notion"]);
  assert.deepEqual(after.modules, { knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: false });
});

test("a present block with a key left out takes that module's default (schema §12)", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { documents: true };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const status = await brain(["status", "--brain", target, "--json"], root);
  assert.deepEqual(status.json.data.modules, { knowledge: true, orgs: true, documents: true, reports: false, tasks: false, planning: false });
});

test("modules refuses core, an unknown module and a switch without one", async (context) => {
  const { root, target } = await freshBrain(context);
  for (const args of [["modules", "on", "core"], ["modules", "off", "meetings"], ["modules", "on"]]) {
    const run = await brain([...args, "--brain", target, "--now", NOW, "--json"], root);
    assert.equal(run.code, 2, run.stdout);
    assert.equal(run.json.error.code, "USAGE");
  }
});
