import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy, testPackageRoot } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";

test("init's human output names one next step and no path under product.path (cli.md §5.1, 0078 §2)", async (context) => {
  const parent = await mkdtemp(join(tmpdir(), "brain-init-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const target = join(parent, "brain");
  const result = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW], parent);
  assert.equal(result.code, 0, result.stderr);
  const made = realpathSync(target);
  assert.equal(result.stdout, [
    `Initialized Ultimate Brain at ${made}`,
    `Next: open Claude Code or Codex in ${made} and say "set up my brain"`,
    "",
  ].join("\n"));
  assert.equal(result.stdout.includes(realpathSync(await testPackageRoot())), false);
});

test("query without --candidates points to the brain-query skill, with or without a question (cli.md §5.13)", async (context) => {
  const root = await fixtureCopy(context);
  for (const args of [["query", "what did we decide?"], ["query"]]) {
    const result = await brain([...args, "--brain", root, "--json"]);
    assert.equal(result.code, 2, result.stdout);
    assert.deepEqual(result.json.error, { code: "USAGE", message: "brain query requires --candidates or --read; use the brain-query skill to answer questions" });
  }
  const extra = await brain(["query", "--candidates", "launch", "extra", "--brain", root, "--json"]);
  assert.equal(extra.code, 2, extra.stdout);
  assert.deepEqual(extra.json.error, { code: "USAGE", message: "Unexpected argument: extra" });
  const human = await brain(["query", "what did we decide?", "--brain", root]);
  assert.match(human.stderr, /brain-query skill/);
});

test("modules list is an alias of brain modules (cli.md §5.20)", async (context) => {
  const root = await fixtureCopy(context);
  const plain = await brain(["modules", "--brain", root, "--json"]);
  const alias = await brain(["modules", "list", "--brain", root, "--json"]);
  assert.equal(alias.code, 0, alias.stdout);
  assert.equal(alias.json.command, "modules");
  assert.deepEqual(alias.json.data, plain.json.data);
  const human = await brain(["modules", "list", "--brain", root]);
  assert.equal(human.stdout, (await brain(["modules", "--brain", root])).stdout);
});
