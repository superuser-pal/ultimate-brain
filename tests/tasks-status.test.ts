import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { brain, fixtureCopy } from "./helpers.ts";

test("status checks a mapped Tasks option from an offline snapshot", async (context) => {
  const root = await fixtureCopy(context);
  const configPath = join(root, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const snapshot = { database: config.notion.tasks.database, property: config.notion.tasks.properties.status, as_of: "2026-11-01T12:00:00Z", options: ["To Do", "Done"] };
  const path = join(root, "tasks-schema.json");
  await writeFile(path, JSON.stringify(snapshot));
  let result = await brain(["status", "--brain", root, "--tasks-schema", path, "--json"]);
  assert.equal(result.code, 0);
  assert.match(result.json.data.tasks_status_note, /Won't Do.*2026-11-01/);
  snapshot.options.push("Won't Do");
  await writeFile(path, JSON.stringify(snapshot));
  result = await brain(["status", "--brain", root, "--tasks-schema", path, "--json"]);
  assert.equal(result.json.data.tasks_status_note, null);
  config.notion.tasks.wont_do_status = "Dropped";
  await writeFile(configPath, JSON.stringify(config));
  result = await brain(["status", "--brain", root, "--tasks-schema", path, "--json"]);
  assert.match(result.json.data.tasks_status_note, /Dropped/);
  config.modules = { tasks: false };
  await writeFile(configPath, JSON.stringify(config));
  result = await brain(["status", "--brain", root, "--tasks-schema", path, "--json"]);
  assert.equal(result.json.data.tasks_status_note, null);
  result = await brain(["status", "--brain", root, "--json"]);
  assert.equal(result.json.data.tasks_status_note, null);
  snapshot.database = "other";
  await writeFile(path, JSON.stringify(snapshot));
  result = await brain(["status", "--brain", root, "--tasks-schema", path, "--json"]);
  assert.equal(result.json.error.code, "INPUT_INVALID");
});

test("status rejects malformed, future or unmapped snapshots and accepts stdin", async (context) => {
  const root = await fixtureCopy(context);
  const configPath = join(root, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const snapshot = { database: config.notion.tasks.database, property: config.notion.tasks.properties.status, as_of: "2026-11-01T12:00:00Z", options: ["Done"] };
  const path = join(root, "tasks-schema.json");
  const run = async (value: unknown) => {
    await writeFile(path, JSON.stringify(value));
    return brain(["status", "--brain", root, "--tasks-schema", path, "--now", "2026-11-01T12:01:00Z", "--json"]);
  };
  for (const value of [{ ...snapshot, as_of: "2026-02-30T12:00:00Z" }, { ...snapshot, as_of: "2026-11-01T12:02:00Z" }, { ...snapshot, extra: true }, { ...snapshot, options: "Done" }, { ...snapshot, options: [1] }, { ...snapshot, property: "" }]) {
    assert.equal((await run(value)).json.error.code, "INPUT_INVALID");
  }
  const stdin = spawnSync(process.execPath, ["--experimental-strip-types", join(process.cwd(), "src/cli.ts"), "status", "--brain", root, "--tasks-schema", "-", "--now", "2026-11-01T12:01:00Z"], { input: JSON.stringify(snapshot), encoding: "utf8" });
  assert.equal(stdin.status, 0, stdin.stderr);
  assert.match(stdin.stdout, /Tasks status option "Won't Do" was absent/);
  config.notion.tasks.database = "";
  config.notion.tasks.properties.status = "";
  await writeFile(configPath, JSON.stringify(config));
  assert.equal((await run({ ...snapshot, database: "", property: "" })).json.error.code, "INPUT_INVALID");
  config.notion.tasks.wont_do_status = "";
  await writeFile(configPath, JSON.stringify(config));
  assert.equal((await brain(["status", "--brain", root, "--json"])).json.error.code, "BRAIN_CONFIG_INVALID");
});
