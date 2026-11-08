import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { disableGitAutoMaintenance } from "./helpers.ts";

const exec = promisify(execFile);

test("a commit in a test starts no background git maintenance (CC-158)", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "brain-git-env-"));
  context.after(() => rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const git = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
    exec("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd: dir, env });
  await git(["init", "-q"]);
  await writeFile(join(dir, "note.md"), "one\n");
  await git(["add", "-A"]);
  const { stderr } = await git(["commit", "-q", "-m", "one"], { ...process.env, GIT_TRACE: "1" });
  assert.doesNotMatch(stderr, /maintenance run/);
});

test("the maintenance settings are added after GIT_CONFIG entries already set (CC-158)", () => {
  const env: NodeJS.ProcessEnv = { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "user.useConfigOnly", GIT_CONFIG_VALUE_0: "true" };
  disableGitAutoMaintenance(env);
  assert.deepEqual(env, {
    GIT_CONFIG_COUNT: "3",
    GIT_CONFIG_KEY_0: "user.useConfigOnly", GIT_CONFIG_VALUE_0: "true",
    GIT_CONFIG_KEY_1: "maintenance.auto", GIT_CONFIG_VALUE_1: "false",
    GIT_CONFIG_KEY_2: "gc.auto", GIT_CONFIG_VALUE_2: "0",
  });
});
