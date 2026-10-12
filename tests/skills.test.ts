import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildMirror, mirrorDrift, validateSkills } from "../scripts/build-skills.ts";

test("skills/ is valid and .agents/skills/ mirrors it (node scripts/build-skills.ts)", async () => {
  assert.deepEqual(await validateSkills(), []);
  assert.deepEqual(await mirrorDrift(), []);
});

test("skill validation and mirroring catch the usual mistakes", async (context) => {
  const dir = await mkdtemp(join(tmpdir(), "skills-"));
  context.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "skills");
  const mirror = join(dir, "mirror");
  const skill = async (name: string, text: string) => {
    await mkdir(join(source, name), { recursive: true });
    await writeFile(join(source, name, "SKILL.md"), text);
  };
  await skill("brain-good", "---\nname: brain-good\ndescription: Does a thing.\n---\n# Good\n");
  await skill("brain-bad", "---\nname: other\ndescription: x\nallowed-tools: Bash\n---\n");
  await mkdir(join(source, "Bad_Name"));

  assert.deepEqual(await validateSkills(source), [
    "skills/Bad_Name: folder name must be lowercase kebab-case",
    "skills/Bad_Name/SKILL.md: missing",
    "skills/brain-bad/SKILL.md: frontmatter may only have name and description, found allowed-tools",
    'skills/brain-bad/SKILL.md: name must be "brain-bad" (the folder name)',
    "skills/brain-bad/SKILL.md: body is empty",
  ]);

  await buildMirror(source, mirror);
  assert.deepEqual(await mirrorDrift(source, mirror), []);
  await writeFile(join(source, "brain-good", "SKILL.md"), "---\nname: brain-good\ndescription: Changed.\n---\n# Good\n");
  await writeFile(join(mirror, "stale.md"), "x");
  assert.deepEqual(await mirrorDrift(source, mirror), ["changed: brain-good/SKILL.md", "extra: stale.md"]);
});
