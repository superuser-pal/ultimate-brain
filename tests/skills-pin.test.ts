import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { initBrain, invalidSnapshots, productRoot, run, SNAPSHOTS, temp } from "./skills-fixtures.ts";

// spec/skills-delivery.md §3, §6.1, §6.5 and cli.md §5.28; §12.1 tests 3 and 4.
const A = join(SNAPSHOTS, "a");

test("init writes both trees and a lock of {format, installed_by, snapshot}", async (context) => {
  const product = await productRoot(context, A, "0.9.0");
  const home = await temp(context);
  const target = join(await temp(context), "brain");
  const init = await run(["init", target, "--owner", "T", "--no-git", "--json"], { product, home });
  assert.equal(init.code, 0, init.stdout);
  const manifest = JSON.parse(await readFile(join(A, "snapshot.json"), "utf8"));
  const lockText = await readFile(join(target, "skills.lock.json"), "utf8");
  assert.deepEqual(JSON.parse(lockText), { format: 1, installed_by: "0.9.0", snapshot: manifest });
  assert.equal(lockText, `${JSON.stringify({ format: 1, installed_by: "0.9.0", snapshot: manifest }, null, 2)}\n`);
  assert.ok(init.json.data.created.includes("skills.lock.json"));
  for (const tree of [".agents/skills", ".claude/skills"]) {
    assert.deepEqual((await readdir(join(target, tree))).sort(), ["brain-apply", "brain-old", "brain-query"]);
    assert.equal(await readFile(join(target, tree, "brain-query/references/report.md"), "utf8"), await readFile(join(A, "brain-query/references/report.md"), "utf8"));
  }
  // Neither the manifest nor the snapshot's optional files are copied into the trees.
  await assert.rejects(readFile(join(target, ".agents/skills/snapshot.json")));
  assert.deepEqual(init.json.data.skills, { state: "pinned", name: "ultimate-brain-skills", version: "1.0.0", competing: [] });
  assert.deepEqual(init.json.warnings, []);
});

test("init refuses an invalid or incompatible package snapshot and writes nothing", async (context) => {
  const home = await temp(context);
  const broken = await productRoot(context, (await invalidSnapshots(context))["integrity"]!, "0.9.0");
  const parent = await temp(context);
  const fresh = await run(["init", join(parent, "brain"), "--no-git", "--json"], { product: broken, home });
  assert.equal(fresh.code, 3);
  assert.equal(fresh.json.error.code, "SKILLS_SNAPSHOT_INVALID");
  assert.equal(fresh.json.error.message, "The skills shipped with ultimate-brain 0.9.0 are unusable (integrity). Reinstall: npm install -g ultimate-brain@0.9.0.");
  assert.deepEqual(fresh.json.error.details, { reason: "integrity", running: "0.9.0" });
  assert.deepEqual(await readdir(parent), []);

  const empty = join(parent, "empty");
  await mkdir(empty);
  const newer = await productRoot(context, A, "0.10.0");
  const refused = await run(["init", empty, "--no-git", "--json"], { product: newer, home });
  assert.equal(refused.json.error.code, "SKILLS_SNAPSHOT_INVALID");
  assert.match(refused.json.error.message, /unusable \(not compatible with 0\.10\.0 \(>=0\.9\.0 <0\.10\.0\)\)/);
  assert.deepEqual(await readdir(empty), []);
});

test("init --force skips an existing lock and reports the state it leaves", async (context) => {
  const product = await productRoot(context, A, "0.9.0");
  const home = await temp(context);
  const target = join(await temp(context), "brain");
  await mkdir(target);
  await writeFile(join(target, "skills.lock.json"), "{");
  const init = await run(["init", target, "--force", "--no-git", "--json"], { product, home });
  assert.equal(init.code, 0, init.stdout);
  assert.ok(init.json.data.skipped.includes("skills.lock.json"));
  assert.deepEqual(init.json.data.skills, { state: "invalid", name: null, version: null, competing: [] });
});

test("each state of §3, and the guard on write and read commands", async (context) => {
  const product = await productRoot(context, A, "0.9.0");
  const home = await temp(context);
  const brain = await initBrain(context, product, home);
  const status = async (version = product) => (await run(["status", "--brain", brain, "--json"], { product: version, home })).json.data.skills;
  const guarded = async (args: string[], version = product) => run([...args, "--brain", brain, "--json"], { product: version, home });

  const pinned = await status();
  assert.deepEqual(pinned, {
    state: "pinned", name: "ultimate-brain-skills", version: "1.0.0", cli: ">=0.9.0 <0.10.0",
    integrity: JSON.parse(await readFile(join(A, "snapshot.json"), "utf8")).integrity, installed_by: "0.9.0", running: "0.9.0", reason: null,
    package: { name: "ultimate-brain-skills", version: "1.0.0", compatible: true, reason: null }, drift: [], competing: [],
  });
  assert.equal((await guarded(["index"])).code, 0);

  // drift: runs, lint reports it, the guard doesn't compute it.
  await writeFile(join(brain, ".claude/skills/brain-apply/SKILL.md"), "edited\n");
  await writeFile(join(brain, ".agents/skills/brain-query/stray.md"), "stray\n");
  const drift = await status();
  assert.equal(drift.state, "drift");
  assert.deepEqual(drift.drift, [".agents/skills/brain-query/stray.md", ".claude/skills/brain-apply/SKILL.md"]);
  assert.equal((await guarded(["query", "--candidates", "x"])).code, 0);

  // missing
  await rm(join(brain, ".claude/skills/brain-apply/SKILL.md"));
  const missing = await guarded(["index"]);
  assert.equal(missing.code, 3);
  assert.equal(missing.json.error.code, "SKILLS_SNAPSHOT_MISSING");
  assert.equal(missing.json.error.message, "Pinned skill brain-apply is missing from .claude/skills (ultimate-brain-skills 1.0.0). Run brain upgrade to restore it.");
  assert.equal(missing.json.error.details.skill, "brain-apply");
  assert.equal((await status()).reason, ".claude/skills/brain-apply");
  assert.equal((await guarded(["query", "--candidates", "x"])).json.error.code, "SKILLS_SNAPSHOT_MISSING");
  await writeFile(join(brain, ".claude/skills/brain-apply/SKILL.md"), await readFile(join(A, "brain-apply/SKILL.md")));

  // incompatible, both directions
  const newer = await productRoot(context, A, "0.10.0");
  const tooNew = await guarded(["index"], newer);
  assert.equal(tooNew.code, 3);
  assert.equal(tooNew.json.error.code, "SKILLS_INCOMPATIBLE");
  assert.equal(tooNew.json.error.message, "This brain's skills (ultimate-brain-skills 1.0.0) need ultimate-brain >=0.9.0 <0.10.0; this CLI is 0.10.0. Run brain upgrade to install the skills this CLI ships, or keep these skills with npm install -g ultimate-brain@0.9.0.");
  assert.deepEqual(tooNew.json.error.details, { state: "incompatible", name: "ultimate-brain-skills", version: "1.0.0", cli: ">=0.9.0 <0.10.0", running: "0.10.0", installed_by: "0.9.0" });
  const older = await productRoot(context, A, "0.8.1");
  const tooOld = await guarded(["query", "--candidates", "x"], older);
  assert.equal(tooOld.json.error.code, "SKILLS_INCOMPATIBLE");
  assert.equal(tooOld.json.error.message, "This brain's skills (ultimate-brain-skills 1.0.0) need ultimate-brain >=0.9.0 <0.10.0; this CLI is 0.8.1. Install the version that pinned them: npm install -g ultimate-brain@0.9.0.");
  assert.equal((await status(older)).state, "incompatible");
  // --dry-run commands are guarded too.
  assert.equal((await guarded(["index", "--check"], older)).json.error.code, "SKILLS_INCOMPATIBLE");

  // invalid
  await writeFile(join(brain, "skills.lock.json"), "{");
  const invalid = await guarded(["index"]);
  assert.equal(invalid.json.error.code, "SKILLS_PIN_INVALID");
  assert.equal(invalid.json.error.message, "skills.lock.json is invalid (not JSON). Run brain upgrade to rewrite it.");
  assert.equal((await guarded(["query", "--candidates", "x"])).json.error.code, "SKILLS_PIN_INVALID");
  const invalidStatus = await status();
  assert.equal(invalidStatus.state, "invalid");
  assert.equal(invalidStatus.reason, "not JSON");
  assert.equal(invalidStatus.name, null);
  assert.deepEqual(invalidStatus.drift, []);
  // status, lint, upgrade and recover always run.
  for (const exempt of [["status"], ["lint"], ["upgrade", "--dry-run"], ["recover"]]) {
    const result = await guarded(exempt);
    assert.ok(!String(result.json?.error?.code ?? "").startsWith("SKILLS_"), `${exempt.join(" ")}: ${result.stdout}`);
  }

  // A schema failure names the first error; a bad manifest names its check.
  const lock = JSON.parse(await readFile(join(A, "snapshot.json"), "utf8"));
  await writeFile(join(brain, "skills.lock.json"), JSON.stringify({ format: 1, installed_by: "0.9", snapshot: lock }));
  assert.match((await status()).reason, /^schema: \/installed_by /);
  await writeFile(join(brain, "skills.lock.json"), JSON.stringify({ format: 1, installed_by: "0.9.0", snapshot: { ...lock, integrity: `sha256-${"0".repeat(64)}` } }));
  assert.equal((await status()).reason, "integrity");
  await rm(join(brain, "skills.lock.json"));
  await mkdir(join(brain, "skills.lock.json"));
  assert.equal((await status()).reason, "not a file");
  await rm(join(brain, "skills.lock.json"), { recursive: true });

  // unpinned: runs as before 0.9.0, with no warning; status compares against the package.
  const unpinned = await guarded(["index"]);
  assert.equal(unpinned.code, 0);
  assert.deepEqual(unpinned.json.warnings, []);
  const unpinnedStatus = await status();
  assert.equal(unpinnedStatus.state, "unpinned");
  assert.equal(unpinnedStatus.installed_by, null);
  // While unpinned, drift is against the package snapshot: the stray file is still there.
  assert.deepEqual(unpinnedStatus.drift, [".agents/skills/brain-query/stray.md"]);
});
