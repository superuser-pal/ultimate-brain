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

  await skill(
    "brain-loud",
    [
      "---\nname: brain-loud\ndescription: Shouts.\n---",
      "You MUST read the JSON. `NEVER` in code is fine, and so is ``a ` STOP``.",
      "",
      "```\nALWAYS in a fence\n```",
      "",
      "Run:",
      "",
      "    echo NEVER indented code",
      "",
      "1. A step:",
      "   ```sh\n   echo HALT in an indented fence\n   ```",
      "   Its continuation says WAIT.",
      "",
    ].join("\n"),
  );
  await skill("brain-deep", "---\nname: brain-deep\ndescription: Nests.\n---\nSee [a][a] and [c](references/c.md).\n\n[a]: references/a.md\n");
  await mkdir(join(source, "brain-deep", "references"));
  const reference = (file: string, text: string) => writeFile(join(source, "brain-deep", "references", file), text);
  await reference("a.md", "Then [b](b.md), back to [the skill](../SKILL.md), [the web](https://example.com).\n");
  await reference("b.md", "Deep, by reference: [d][d].\n\n[d]: d.md\n");
  await reference("c.md", "An example, not a link:\n\n```md\nSee [e](e.md).\n```\n");
  await reference("d.md", "Deeper.\n");
  await reference("e.md", "Only in an example.\n");
  assert.deepEqual((await validateSkills(source)).slice(-3), [
    "skills/brain-deep/references/a.md: links to references/b.md, which SKILL.md doesn't link to (references are one level deep)",
    "skills/brain-deep/references/b.md: links to references/d.md, which SKILL.md doesn't link to (references are one level deep)",
    "skills/brain-loud/SKILL.md: capitals for emphasis (MUST, WAIT); write it plainly, or put code in backticks",
  ]);
  await rm(join(source, "brain-deep"), { recursive: true });
  await rm(join(source, "brain-loud"), { recursive: true });

  await buildMirror(source, mirror);
  assert.deepEqual(await mirrorDrift(source, mirror), []);
  await writeFile(join(source, "brain-good", "SKILL.md"), "---\nname: brain-good\ndescription: Changed.\n---\n# Good\n");
  await writeFile(join(mirror, "stale.md"), "x");
  assert.deepEqual(await mirrorDrift(source, mirror), ["changed: brain-good/SKILL.md", "extra: stale.md"]);
});
