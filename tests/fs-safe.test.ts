import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { assertPathInsideBrain, atomicWriteFile } from "../src/lib/fs-safe.ts";

test("atomicWriteFile creates and replaces files without leaving temporary files", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "fs-safe-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "knowledge"));

  await atomicWriteFile(root, "knowledge/note.md", "first\n");
  await atomicWriteFile(root, "knowledge/note.md", "second\n");

  assert.equal(await readFile(join(root, "knowledge", "note.md"), "utf8"), "second\n");
  assert.deepEqual(await readdir(join(root, "knowledge")), ["note.md"]);
  assert.equal((await lstat(join(root, "knowledge", "note.md"))).isFile(), true);
});

test("safe paths reject traversal and absolute paths outside the brain", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "fs-safe-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const brain = join(parent, "brain");
  await mkdir(brain);

  assert.throws(() => assertPathInsideBrain(brain, join(parent, "outside.md")), /outside/);
  await assert.rejects(atomicWriteFile(brain, "../outside.md", "unsafe"), /outside/);
  await assert.rejects(atomicWriteFile(brain, join(parent, "outside.md"), "unsafe"), /outside/);
});

test("atomicWriteFile rejects symlink escapes and symlink targets", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "fs-safe-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const brain = join(parent, "brain");
  const outside = join(parent, "outside");
  await mkdir(brain);
  await mkdir(outside);
  await symlink(outside, join(brain, "escape"));
  await writeFile(join(outside, "existing.md"), "outside");
  await symlink(join(outside, "existing.md"), join(brain, "linked.md"));

  await assert.rejects(atomicWriteFile(brain, "escape/new.md", "unsafe"), /outside/);
  await assert.rejects(atomicWriteFile(brain, "linked.md", "unsafe"), /symbolic link/);
  assert.equal(await readFile(join(outside, "existing.md"), "utf8"), "outside");
});
