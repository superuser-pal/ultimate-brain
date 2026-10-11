import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { resolveBrainDirectory } from "../src/lib/brain-path.ts";

test("brain directory resolution follows flag, environment, then config precedence", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "brain-path-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const flag = join(root, "flag");
  const environment = join(root, "environment");
  const configured = join(root, "configured");
  await Promise.all([mkdir(flag), mkdir(environment), mkdir(configured)]);
  const configDirectory = join(root, ".config", "ultimate-brain");
  await mkdir(configDirectory, { recursive: true });
  await writeFile(join(configDirectory, "config.json"), JSON.stringify({ brain: configured }));

  assert.equal(
    await resolveBrainDirectory({ brainFlag: flag, env: { BRAIN_DIR: environment }, homeDirectory: root }),
    await realpath(flag),
  );
  assert.equal(
    await resolveBrainDirectory({ env: { BRAIN_DIR: environment }, homeDirectory: root }),
    await realpath(environment),
  );
  assert.equal(
    await resolveBrainDirectory({ env: {}, homeDirectory: root }),
    await realpath(configured),
  );
});

test("a higher-priority brain path does not read a broken lower-priority config", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "brain-path-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const brain = join(root, "brain");
  const configDirectory = join(root, ".config", "ultimate-brain");
  await mkdir(brain);
  await mkdir(configDirectory, { recursive: true });
  await writeFile(join(configDirectory, "config.json"), "not json");

  assert.equal(
    await resolveBrainDirectory({ brainFlag: brain, env: {}, homeDirectory: root }),
    await realpath(brain),
  );
});

test("brain directory resolution explains missing configuration and paths", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "brain-path-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    resolveBrainDirectory({ env: {}, homeDirectory: root }),
    /Pass --brain, set BRAIN_DIR/,
  );
  await assert.rejects(
    resolveBrainDirectory({ brainFlag: join(root, "missing"), env: {}, homeDirectory: root }),
    /does not exist or cannot be read/,
  );
});

test("brain directory resolution refuses the product repository", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "brain-path-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "spec"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "spec", "cli.md"), "contract");
  await writeFile(join(root, "src", "cli.ts"), "entrypoint");

  await assert.rejects(
    resolveBrainDirectory({ brainFlag: root, env: {}, homeDirectory: root }),
    /product repository/,
  );
});
