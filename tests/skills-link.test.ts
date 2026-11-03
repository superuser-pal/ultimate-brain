import assert from "node:assert/strict";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { buildManifest, serializeManifest } from "../src/lib/skills-snapshot.ts";
import { FORK_META, initBrain, productRoot, run, SNAPSHOTS, snapshotCopy, temp } from "./skills-fixtures.ts";

// spec/skills-delivery.md §6.2; §12.1 test 7.
const A = join(SNAPSHOTS, "a");

/** A package whose brain-query differs from A's, so a copy from the package is told apart from a copy from the brain. */
async function otherPackage(context: Parameters<typeof temp>[0]): Promise<string> {
  const folder = await snapshotCopy(context, "a");
  await writeFile(join(folder, "brain-query/SKILL.md"), "---\nname: brain-query\ndescription: a newer package copy\n---\n# Newer\n");
  await writeFile(join(folder, "snapshot.json"), serializeManifest(buildManifest(folder, FORK_META("1.0.1"))));
  return productRoot(context, folder, "0.9.0");
}

test("a pinned brain links its own pinned copy, records skills in .brain and retires old linked skills", async (context) => {
  const home = await temp(context);
  const brain = await initBrain(context, await productRoot(context, A, "0.9.0"), home);
  const repo = await temp(context, "skills-repo-");
  await writeFile(join(repo, ".brain"), `${JSON.stringify({ repo: "x", skills: { name: "ultimate-brain", version: "0.8.9", integrity: `sha256-${"1".repeat(64)}`, names: ["brain-gone", "brain-query"] } })}\n`);
  for (const tree of [".agents/skills", ".claude/skills"]) {
    await mkdir(join(repo, tree, "brain-gone", "references"), { recursive: true });
    await writeFile(join(repo, tree, "brain-gone/SKILL.md"), "retired\n");
    await writeFile(join(repo, tree, "brain-gone/references/x.md"), "retired\n");
    await mkdir(join(repo, tree, "mine"), { recursive: true });
    await writeFile(join(repo, tree, "mine/SKILL.md"), "---\nname: mine\ndescription: the user's\n---\n");
  }

  const link = await run(["link", repo, "--brain", brain, "--json"], { product: await otherPackage(context), home });
  assert.equal(link.code, 0, link.stdout);
  for (const tree of [".agents/skills", ".claude/skills"]) {
    assert.equal(await readFile(join(repo, tree, "brain-query/SKILL.md"), "utf8"), await readFile(join(A, "brain-query/SKILL.md"), "utf8"));
    assert.equal(await readFile(join(repo, tree, "brain-query/references/report.md"), "utf8"), await readFile(join(A, "brain-query/references/report.md"), "utf8"));
    assert.deepEqual((await readdir(join(repo, tree))).sort(), ["brain-query", "mine"]);
  }
  const integrity = JSON.parse(await readFile(join(A, "snapshot.json"), "utf8")).integrity;
  const marker = JSON.parse(await readFile(join(repo, ".brain"), "utf8"));
  assert.deepEqual(marker.skills, { name: "ultimate-brain-skills", version: "1.0.0", integrity, names: ["brain-query"] });
  assert.deepEqual(link.json.data.skills, { source: "brain", name: "ultimate-brain-skills", version: "1.0.0", integrity, names: ["brain-query"], competing: [] });
  assert.deepEqual(link.json.data.files.filter((file: { action: string }) => file.action === "removed").map((file: { path: string }) => file.path), [
    ".agents/skills/brain-gone/SKILL.md", ".agents/skills/brain-gone/references/x.md", ".claude/skills/brain-gone/SKILL.md", ".claude/skills/brain-gone/references/x.md",
  ]);
  assert.deepEqual(link.json.warnings, []);
});

test("a drifted file the link copies refuses SKILLS_SNAPSHOT_MISSING before any write", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, product, home);
  await writeFile(join(brain, ".agents/skills/brain-query/references/report.md"), "edited\n");
  const repo = await temp(context, "skills-repo-");
  const link = await run(["link", repo, "--brain", brain, "--json"], { product, home });
  assert.equal(link.code, 3);
  assert.equal(link.json.error.code, "SKILLS_SNAPSHOT_MISSING");
  assert.equal(link.json.error.message, ".agents/skills/brain-query/references/report.md differs from the pinned skills (ultimate-brain-skills 1.0.0). Run brain upgrade in the brain, then brain link again.");
  assert.deepEqual(await readdir(repo), []);
  // The .claude/skills copy and unlisted files in the brain are not what link copies; lint covers them.
  await writeFile(join(brain, ".agents/skills/brain-query/references/report.md"), await readFile(join(A, "brain-query/references/report.md")));
  await writeFile(join(brain, ".claude/skills/brain-query/SKILL.md"), "edited\n");
  await writeFile(join(brain, ".agents/skills/brain-query/stray.md"), "stray\n");
  const ok = await run(["link", repo, "--brain", brain, "--json"], { product, home });
  assert.equal(ok.code, 0, ok.stdout);
  await assert.rejects(readFile(join(repo, ".agents/skills/brain-query/stray.md")));
});

test("an unpinned brain links the package snapshot with SKILLS_UNPINNED, and duplicates in the repo are reported", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, A, "0.9.0");
  const brain = await initBrain(context, product, home);
  await rm(join(brain, "skills.lock.json"));
  const repo = await temp(context, "skills-repo-");
  await mkdir(join(repo, ".claude/skills/old-query"), { recursive: true });
  await writeFile(join(repo, ".claude/skills/old-query/SKILL.md"), "---\nname: brain-query\ndescription: old\n---\n");
  const link = await run(["link", repo, "--brain", brain, "--json"], { product, home });
  assert.equal(link.code, 0, link.stdout);
  assert.equal(link.json.data.skills.source, "package");
  assert.deepEqual(link.json.data.skills.competing, [{ kind: "duplicate", name: "brain-query", path: ".claude/skills/old-query" }]);
  assert.deepEqual(link.json.warnings, [
    { code: "SKILLS_UNPINNED", message: "The brain's skills are not pinned; the linked repo got the skills of ultimate-brain 0.9.0. Run brain upgrade in the brain." },
    { code: "SKILLS_COMPETING", message: "1 competing skill copies; see data.skills.competing and remove them." },
  ]);

  const broken = await snapshotCopy(context, "a");
  await rm(join(broken, "brain-query/references/report.md"));
  const refused = await run(["link", repo, "--brain", brain, "--json"], { product: await productRoot(context, broken, "0.9.0"), home });
  assert.equal(refused.json.error.code, "SKILLS_SNAPSHOT_INVALID");
});
