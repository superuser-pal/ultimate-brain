import assert from "node:assert/strict";
import { existsSync, realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy, testPackageRoot } from "./helpers.ts";

const REPO = join(import.meta.dirname, "..");
const MIGRATION_0019 = join("notion", "migrations", "0019-reports-move-to-documents.md");

test("status reports the installed package's folder as product.path (cli.md §5.2)", async (context) => {
  const root = await fixtureCopy(context);
  const result = await brain(["status", "--brain", root, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.product, { path: realpathSync(await testPackageRoot()) });
});

test("the Notion build files ship with the package (package.json files)", async () => {
  const files = JSON.parse(await readFile(join(REPO, "package.json"), "utf8")).files as string[];
  assert.ok(files.includes("notion"), JSON.stringify(files));
  assert.ok(files.includes("docs/notion-space-design.md"), JSON.stringify(files));
  assert.ok(existsSync(join(REPO, MIGRATION_0019)), "the migration DOCUMENTS_TURNED_ON names is in notion/migrations");
});

test("DOCUMENTS_TURNED_ON names migration 0019's file under product.path (cli.md §5.15 step 5)", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "brain-upgrade-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const target = join(parent, "brain");
  const now = "2026-12-10T09:00:00Z";
  assert.equal((await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", now, "--json"], parent)).code, 0);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { ...config.modules, documents: false, reports: true };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const upgraded = await brain(["upgrade", "--brain", target, "--now", now, "--json"], parent);
  assert.equal(upgraded.code, 0, upgraded.stdout);
  const warning = upgraded.json.warnings.find((entry: { code: string }) => entry.code === "DOCUMENTS_TURNED_ON");
  assert.equal(warning.message, `Reports now live in Documents, so the Documents module is on. Apply Notion migration 0019 before the next publish: ${join(realpathSync(await testPackageRoot()), MIGRATION_0019)}`);
});
