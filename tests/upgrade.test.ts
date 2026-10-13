import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain } from "./helpers.ts";

const NOW = "2026-12-03T10:22:00Z";
const START = /<!-- ultimate-brain:rules:start[^>]*-->/;
const END = "<!-- ultimate-brain:rules:end -->";

async function freshBrain(context: TestContext): Promise<{ root: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), "brain-upgrade-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  return { root, target };
}

test("upgrade restores product-owned files and keeps everything the user wrote", async (context) => {
  const { root, target } = await freshBrain(context);
  const agentsPath = join(target, "AGENTS.md");
  const shipped = await readFile(agentsPath, "utf8");
  const productBlock = shipped.slice(shipped.search(START), shipped.indexOf(END) + END.length);
  // An old product block, plus the user's own rules below it.
  await writeFile(agentsPath, `${shipped.replace(productBlock, "<!-- ultimate-brain:rules:start v0 -->\nold rules\n<!-- ultimate-brain:rules:end -->")}\nCall Mike "Michael Chen".\n`);
  await writeFile(join(target, ".agents/skills/brain-ingest/SKILL.md"), "old skill\n");
  await writeFile(join(target, ".agents/skills/brain-ingest/references/retired.md"), "no longer shipped\n");
  await mkdir(join(target, ".agents/skills/my-skill"), { recursive: true });
  await writeFile(join(target, ".agents/skills/my-skill/SKILL.md"), "mine\n");

  const dry = await brain(["upgrade", "--brain", target, "--dry-run", "--now", NOW, "--json"], root);
  assert.equal(dry.code, 0, dry.stdout);
  assert.deepEqual(dry.json.data.files, [
    { path: ".agents/skills/brain-ingest/SKILL.md", action: "updated" },
    { path: ".agents/skills/brain-ingest/references/retired.md", action: "removed" },
    { path: "AGENTS.md", action: "updated" },
  ]);
  assert.equal(await readFile(join(target, ".agents/skills/brain-ingest/SKILL.md"), "utf8"), "old skill\n");

  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.files, dry.json.data.files);
  const agents = await readFile(agentsPath, "utf8");
  assert.ok(agents.includes(productBlock));
  assert.ok(agents.endsWith(`\nCall Mike "Michael Chen".\n`));
  assert.notEqual(await readFile(join(target, ".agents/skills/brain-ingest/SKILL.md"), "utf8"), "old skill\n");
  await assert.rejects(readFile(join(target, ".agents/skills/brain-ingest/references/retired.md")));
  assert.equal(await readFile(join(target, ".agents/skills/my-skill/SKILL.md"), "utf8"), "mine\n");
  assert.match(await readFile(join(target, "log/2026-12.md"), "utf8"), /upgrade - "[^"]+" files=3\n$/);

  const again = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.deepEqual(again.json.data.files, []);
  assert.ok(again.json.data.unchanged > 0);
});

test("upgrade leaves an AGENTS.md without its markers alone and warns", async (context) => {
  const { root, target } = await freshBrain(context);
  await writeFile(join(target, "AGENTS.md"), "My own rules only.\n");
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.files, [{ path: "AGENTS.md", action: "skipped" }]);
  assert.ok(run.json.warnings.some((warning: { code: string }) => warning.code === "AGENTS_BLOCK_NOT_FOUND"));
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), "My own rules only.\n");
});
