import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildMirror, mirrorDrift, phaseAManifest, validateSkills, writeSnapshotManifest } from "../scripts/build-skills.ts";
import { validateSnapshot } from "../src/lib/skills-snapshot.ts";

// spec/skills-delivery.md §9: the package builds its snapshot from skills/ until CC-105.

test("the phase A manifest names the package, ranges to the next minor and marks brain-query linked", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "skills-phase-a-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "skills");
  const mirror = join(dir, "mirror");
  for (const name of ["brain-query", "brain-sync"]) {
    await mkdir(join(source, name), { recursive: true });
    await writeFile(join(source, name, "SKILL.md"), `---\nname: ${name}\ndescription: Does a thing.\n---\n# ${name}\n`);
  }
  await writeFile(join(source, "brain-sync", ".DS_Store"), "x");
  await buildMirror(source, mirror);
  await assert.rejects(readFile(join(mirror, "brain-sync", ".DS_Store")));
  await writeSnapshotManifest(mirror, "0.9.0-rc.1");
  assert.equal(validateSnapshot(mirror).reason, null);
  // The generated manifest is not part of the mirror check.
  assert.deepEqual(await mirrorDrift(source, mirror), []);
  const manifest = phaseAManifest(mirror, "0.9.0-rc.1");
  assert.deepEqual({ name: manifest.name, version: manifest.version, cli: manifest.cli, source: manifest.source, upstream: manifest.upstream }, {
    name: "ultimate-brain", version: "0.9.0-rc.1", cli: ">=0.9.0-rc.1 <0.10.0", source: { repository: "https://www.npmjs.com/package/ultimate-brain" }, upstream: null,
  });
  assert.deepEqual(manifest.skills.map((skill) => [skill.name, skill.targets]), [["brain-query", ["brain", "linked_repo"]], ["brain-sync", ["brain"]]]);

  await symlink(join(source, "brain-sync", "SKILL.md"), join(source, "brain-query", "linked.md"));
  assert.ok((await validateSkills(source)).includes("skills/brain-query/linked.md: symbolic links are not allowed"));
});
