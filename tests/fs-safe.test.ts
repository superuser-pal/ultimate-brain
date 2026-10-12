import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { openBrain } from "../src/lib/brain.ts";
import { serializeNewFile } from "../src/lib/frontmatter.ts";
import { assertPathInsideBrain, atomicCreateFile, atomicWriteFile } from "../src/lib/fs-safe.ts";
import { Workspace } from "../src/lib/workspace.ts";
import { fixtureCopy } from "./helpers.ts";

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

test("atomicCreateFile never replaces a file created concurrently", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "fs-safe-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "knowledge"));
  await writeFile(join(root, "knowledge", "note.md"), "other writer\n");

  await assert.rejects(atomicCreateFile(root, "knowledge/note.md", "ours\n"), { code: "WRITE_CONFLICT" });
  assert.equal(await readFile(join(root, "knowledge", "note.md"), "utf8"), "other writer\n");
});

test("Workspace.commit uses an exclusive create for files that were new when scanned", async (context) => {
  const root = await fixtureCopy(context);
  const workspace = await Workspace.open(await openBrain({ brainFlag: root }));
  const path = "knowledge/concepts/race.md";
  workspace.write(path, serializeNewFile({
    id: "con-0a1b2c3d", type: "concept", title: "Race", summary: "A synthetic race test.", lifecycle: "draft", created: "2026-12-10", updated: "2026-12-10",
  }, ""));
  await writeFile(join(root, path), "other writer\n");

  await assert.rejects(workspace.commit(), { code: "WRITE_CONFLICT" });
  assert.equal(await readFile(join(root, path), "utf8"), "other writer\n");
});

test("atomicCreateFile falls back to exclusive direct creation when hard links are unavailable", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "fs-safe-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "knowledge"));
  const unsupported = async () => { throw Object.assign(new Error("no hard links"), { code: "ENOTSUP" }); };
  await atomicCreateFile(root, "knowledge/note.md", "created\n", unsupported);
  assert.equal(await readFile(join(root, "knowledge", "note.md"), "utf8"), "created\n");
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
