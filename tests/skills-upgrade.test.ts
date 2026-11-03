import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { git, initBrain, productRoot, run, SNAPSHOTS, snapshotCopy, temp } from "./skills-fixtures.ts";

// spec/skills-delivery.md §6.3 and §8; §12.1 tests 5 and 8.
const A = join(SNAPSHOTS, "a");
const B = join(SNAPSHOTS, "b");
const NOW = "2026-12-04T09:00:00Z";
const commitAll = async (brain: string, message: string) => { await git(brain, ["add", "--all"]); await git(brain, ["commit", "-q", "-m", message]); };
const lockOf = async (brain: string) => JSON.parse(await readFile(join(brain, "skills.lock.json"), "utf8"));

test("upgrade A→B writes changed files, retires brain-old in both trees, moves the pin and names the snapshot in the commit", async (context) => {
  const home = await temp(context);
  const brain = await initBrain(context, await productRoot(context, A, "0.9.0"), home);
  await writeFile(join(brain, ".claude/skills/brain-old/notes.md"), "the user's file in a product folder\n");
  await commitAll(brain, "user note");
  const productB = await productRoot(context, B, "0.9.1");

  const dry = await run(["upgrade", "--brain", brain, "--dry-run", "--now", NOW, "--json"], { product: productB, home });
  assert.equal(dry.code, 0, dry.stdout);
  assert.equal((await lockOf(brain)).snapshot.version, "1.0.0");

  const upgrade = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product: productB, home });
  assert.equal(upgrade.code, 0, upgrade.stdout);
  const files = upgrade.json.data.files.filter((file: { path: string }) => file.path.includes("skills"));
  assert.deepEqual(files, [
    { path: ".agents/skills/brain-apply/SKILL.md", action: "updated" },
    { path: ".agents/skills/brain-new/SKILL.md", action: "created" },
    { path: ".agents/skills/brain-old/SKILL.md", action: "removed" },
    { path: ".claude/skills/brain-apply/SKILL.md", action: "updated" },
    { path: ".claude/skills/brain-new/SKILL.md", action: "created" },
    { path: ".claude/skills/brain-old/SKILL.md", action: "removed" },
    { path: ".claude/skills/brain-old/notes.md", action: "removed" },
    { path: "skills.lock.json", action: "updated" },
  ]);
  assert.deepEqual(dry.json.data.files, upgrade.json.data.files);
  assert.deepEqual(upgrade.json.data.skills, {
    from: { name: "ultimate-brain-skills", version: "1.0.0" }, to: { name: "ultimate-brain-skills", version: "1.1.0" },
    retired: ["brain-old"], previous_cli: "0.9.0", competing: [],
  });
  assert.deepEqual(upgrade.json.data.lint, { errors: 0, warnings: 0 });
  for (const tree of [".agents/skills", ".claude/skills"]) assert.deepEqual((await readdir(join(brain, tree))).sort(), ["brain-apply", "brain-new", "brain-query"]);
  const lock = await lockOf(brain);
  assert.equal(lock.installed_by, "0.9.1");
  assert.deepEqual(lock.snapshot, JSON.parse(await readFile(join(B, "snapshot.json"), "utf8")));
  assert.equal((await git(brain, ["log", "-1", "--format=%s"])).trim(), "upgrade: ultimate brain 0.9.1, skills ultimate-brain-skills 1.1.0");
  assert.equal((await git(brain, ["status", "--porcelain"])).trim(), "");

  const again = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product: productB, home });
  assert.deepEqual(again.json.data.files, []);
  assert.equal(again.json.data.skills.previous_cli, null);
  assert.equal((await lockOf(brain)).installed_by, "0.9.1");
});

test("a lower version under the same name refuses SKILLS_DOWNGRADE, dry run included, and writes nothing", async (context) => {
  const home = await temp(context);
  const brain = await initBrain(context, await productRoot(context, B, "0.9.1"), home);
  const productA = await productRoot(context, A, "0.9.0");
  for (const extra of [[], ["--dry-run"]]) {
    const refused = await run(["upgrade", "--brain", brain, ...extra, "--json"], { product: productA, home });
    assert.equal(refused.code, 5);
    assert.equal(refused.json.error.code, "SKILLS_DOWNGRADE");
    assert.equal(refused.json.error.message, "This brain pins ultimate-brain-skills 1.1.0; this CLI ships the older 1.0.0. Install ultimate-brain@0.9.1, or roll back as docs/releasing.md says.");
    assert.deepEqual(refused.json.error.details, { name: "ultimate-brain-skills", pinned: "1.1.0", shipped: "1.0.0", installed_by: "0.9.1" });
  }
  assert.equal((await git(brain, ["status", "--porcelain"])).trim(), "");
  assert.equal((await lockOf(brain)).snapshot.version, "1.1.0");
});

test("the same version with other content refuses SKILLS_SNAPSHOT_INVALID, dry run included", async (context) => {
  const home = await temp(context);
  const brain = await initBrain(context, await productRoot(context, A, "0.9.0"), home);
  const changed = await snapshotCopy(context, "a", (manifest) => { manifest.cli = ">=0.9.0 <0.11.0"; });
  const product = await productRoot(context, changed, "0.9.0");
  for (const extra of [[], ["--dry-run"]]) {
    const refused = await run(["upgrade", "--brain", brain, ...extra, "--json"], { product, home });
    assert.equal(refused.code, 3);
    assert.equal(refused.json.error.code, "SKILLS_SNAPSHOT_INVALID");
    assert.equal(refused.json.error.message, "The skills shipped with ultimate-brain 0.9.0 are unusable (same version, different content). Reinstall: npm install -g ultimate-brain@0.9.0.");
  }
  const broken = await snapshotCopy(context, "a");
  await rm(join(broken, "brain-old/SKILL.md"));
  const refused = await run(["upgrade", "--brain", brain, "--dry-run", "--json"], { product: await productRoot(context, broken, "0.9.0"), home });
  assert.equal(refused.json.error.code, "SKILLS_SNAPSHOT_INVALID");
  assert.deepEqual(refused.json.error.details, { reason: "file-missing: brain-old/SKILL.md", running: "0.9.0" });
});

test("ultimate-brain → ultimate-brain-skills is an ordinary upgrade", async (context) => {
  const home = await temp(context);
  const bundled = await snapshotCopy(context, "a", (manifest) => {
    manifest.name = "ultimate-brain"; manifest.version = "0.9.0"; manifest.source = { repository: "https://www.npmjs.com/package/ultimate-brain" }; manifest.upstream = null;
  });
  const brain = await initBrain(context, await productRoot(context, bundled, "0.9.0"), home);
  const upgrade = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product: await productRoot(context, A, "0.9.0"), home });
  assert.equal(upgrade.code, 0, upgrade.stdout);
  assert.deepEqual(upgrade.json.data.skills.from, { name: "ultimate-brain", version: "0.9.0" });
  assert.deepEqual(upgrade.json.data.skills.to, { name: "ultimate-brain-skills", version: "1.0.0" });
  assert.deepEqual(upgrade.json.data.files, [{ path: "skills.lock.json", action: "updated" }]);
  assert.equal((await lockOf(brain)).snapshot.name, "ultimate-brain-skills");
});

test("an unpinned brain gets pinned, and an invalid lock is replaced with SKILLS_LOCK_REPLACED", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, product, home);
  await rm(join(brain, "skills.lock.json"));
  await commitAll(brain, "unpin");
  const pin = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product, home });
  assert.equal(pin.code, 0, pin.stdout);
  assert.deepEqual(pin.json.data.files, [{ path: "skills.lock.json", action: "created" }]);
  assert.equal(pin.json.data.skills.from, null);
  assert.equal(pin.json.data.skills.previous_cli, null);
  assert.equal((await run(["status", "--brain", brain, "--json"], { product, home })).json.data.skills.state, "pinned");

  await writeFile(join(brain, "skills.lock.json"), "{");
  await commitAll(brain, "break the lock");
  const replaced = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product, home });
  assert.equal(replaced.code, 0, replaced.stdout);
  assert.deepEqual(replaced.json.warnings.filter((warning: { code: string }) => warning.code === "SKILLS_LOCK_REPLACED"), [
    { code: "SKILLS_LOCK_REPLACED", message: "skills.lock.json was invalid (not JSON) and was replaced." },
  ]);
  assert.deepEqual(replaced.json.data.files, [{ path: "skills.lock.json", action: "updated" }]);
  assert.equal(replaced.json.data.skills.from, null);
  assert.equal((await lockOf(brain)).snapshot.version, "1.0.0");
});

test("upgrade reports competing copies with a warning and never refuses for them", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, product, home);
  await mkdir(join(home, ".claude/skills/brain-query"), { recursive: true });
  const upgrade = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product: await productRoot(context, B, "0.9.1"), home });
  assert.equal(upgrade.code, 0, upgrade.stdout);
  assert.deepEqual(upgrade.json.data.skills.competing, [{ kind: "global", name: "brain-query", path: "~/.claude/skills/brain-query" }]);
  assert.ok(upgrade.json.warnings.some((warning: { code: string; message: string }) => warning.code === "SKILLS_COMPETING" && warning.message === "1 competing skill copies; see data.skills.competing and remove them."));
});

test("rollback: revert the upgrade commit and run a CLI in A's range: pinned, lint exits 0", async (context) => {
  const home = await temp(context);
  const productA = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, productA, home);
  const upgrade = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product: await productRoot(context, B, "0.9.1"), home });
  assert.equal(upgrade.json.data.skills.previous_cli, "0.9.0");
  await git(brain, ["revert", "--no-edit", "HEAD"]);
  const status = await run(["status", "--brain", brain, "--json"], { product: productA, home });
  assert.equal(status.json.data.skills.state, "pinned");
  assert.equal(status.json.data.skills.version, "1.0.0");
  const lint = await run(["lint", "--brain", brain, "--json"], { product: productA, home });
  assert.equal(lint.code, 0, lint.stdout);
  // A later upgrade with the newer CLI re-applies it.
  const again = await run(["upgrade", "--brain", brain, "--now", NOW, "--json"], { product: await productRoot(context, B, "0.9.1"), home });
  assert.equal(again.code, 0, again.stdout);
  assert.equal((await lockOf(brain)).snapshot.version, "1.1.0");
});
