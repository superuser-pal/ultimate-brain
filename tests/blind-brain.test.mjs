import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const source = resolve(import.meta.dirname, "..");
const script = (args) => spawnSync(process.execPath, [join(source, "scripts/blind-brain.mjs"), ...args], { encoding: "utf8" });

test("blind-brain builds a committed brain from brain-acme that status reads, with no Notion ids", (context) => {
  const parent = mkdtempSync(join(tmpdir(), "blind-brain-"));
  context.after(() => rmSync(parent, { recursive: true, force: true }));
  const dir = join(parent, "brain");
  const built = script(["brain-acme", dir]);
  assert.equal(built.status, 0, built.stderr);

  const config = JSON.parse(readFileSync(join(dir, "brain.json"), "utf8"));
  assert.ok(Object.values(config.notion.databases).every((id) => id === ""));
  assert.equal(config.notion.tasks.database, "");
  assert.equal(execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" }), "", "everything is committed");
  assert.equal(execFileSync("git", ["-C", dir, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim(), "1");
  assert.equal(readFileSync(join(dir, ".agents/skills/brain-ingest/SKILL.md"), "utf8"), readFileSync(join(source, ".agents/skills/brain-ingest/SKILL.md"), "utf8"));

  const status = spawnSync(process.execPath, ["--experimental-strip-types", join(source, "src/cli.ts"), "status", "--brain", dir, "--json"], { encoding: "utf8", env: { ...process.env, HOME: parent } });
  const result = JSON.parse(status.stdout);
  assert.equal(result.ok, true, status.stdout);
  assert.deepEqual(result.data.notion.configured, []);
  assert.equal(result.data.notion.tasks_database, false);
});

test("blind-brain refuses an unknown fixture, a non-empty target and missing arguments", (context) => {
  const parent = mkdtempSync(join(tmpdir(), "blind-brain-"));
  context.after(() => rmSync(parent, { recursive: true, force: true }));
  assert.notEqual(script(["no-such-fixture", join(parent, "a")]).status, 0);
  assert.notEqual(script(["../brain-acme", join(parent, "b")]).status, 0);
  assert.notEqual(script(["minutes", join(parent, "c")]).status, 0, "a fixture with no brain.json isn't a brain");
  mkdirSync(join(parent, "full"));
  writeFileSync(join(parent, "full", "x"), "x");
  assert.notEqual(script(["brain-acme", join(parent, "full")]).status, 0);
  assert.notEqual(script(["brain-acme"]).status, 0);
});
