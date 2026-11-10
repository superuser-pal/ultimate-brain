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

/** A fork snapshot like A whose `linked` skills (brain-workflow and brain-workflow-adopt added as needed) carry `linked_repo` (§9.7). */
async function workflowSnapshot(context: Parameters<typeof temp>[0], linked: string[]): Promise<string> {
  const folder = await snapshotCopy(context, "a");
  for (const name of ["brain-workflow", "brain-workflow-adopt"]) {
    await mkdir(join(folder, name), { recursive: true });
    await writeFile(join(folder, name, "SKILL.md"), `---\nname: ${name}\ndescription: a synthetic ${name}\n---\n# ${name}\n`);
  }
  await writeFile(join(folder, "snapshot.json"), serializeManifest(buildManifest(folder, { ...FORK_META("1.1.0"), targets: (name) => (linked.includes(name) ? ["brain", "linked_repo"] : ["brain"]) })));
  return folder;
}

const BLOCK_START = "<!-- ultimate-brain:start -->\n## Ultimate Brain\n\nManaged by `brain link`; edits inside this block are overwritten.\n\nThis repo is linked to the user's second brain.\n\n"
  + "The brain holds decisions, key facts, people and meeting history that this repo does not.\n\nConsult it before you:\n"
  + "- make or revisit a decision about scope, architecture, vendors or the client;\n- answer why something was decided, who someone is, or a date, budget or owner;\n"
  + "- rely on a fact about the client or project that this repo does not state.\n\n"
  + "How: use the `brain-query` skill, or run `brain query --candidates \"<question>\" --json` and read the notes it returns with `brain query --read <id> --json`, not by opening the brain's files: only these commands leave out what the user excluded or has not approved. Cite the note paths. Say when a fact is `contested` or `superseded`.\n\n";
const BLOCK_BEFORE = `${BLOCK_START}The brain is read-only from this repo. Never edit its files from here.\n<!-- ultimate-brain:end -->\n`;

test("linking the workflow skills writes all three, lists them in .brain and adds the workflow lines to the block (skills-delivery §9.7)", async (context) => {
  const home = await temp(context);
  const product = await productRoot(context, await workflowSnapshot(context, ["brain-query", "brain-workflow", "brain-workflow-adopt"]), "0.9.2");
  const brain = await initBrain(context, product, home);
  const repo = await temp(context, "skills-repo-");
  await writeFile(join(repo, ".brain"), `${JSON.stringify({ repo: "x", skills: { name: "ultimate-brain-skills", version: "1.0.0", integrity: `sha256-${"1".repeat(64)}`, names: ["brain-query"] } })}\n`);
  const link = await run(["link", repo, "--brain", brain, "--json"], { product, home });
  assert.equal(link.code, 0, link.stdout);
  const names = ["brain-query", "brain-workflow", "brain-workflow-adopt"];
  assert.deepEqual(link.json.data.skills.names, names);
  assert.deepEqual(JSON.parse(await readFile(join(repo, ".brain"), "utf8")).skills.names, names);
  for (const tree of [".agents/skills", ".claude/skills"]) assert.deepEqual((await readdir(join(repo, tree))).sort(), names);
  assert.ok(link.json.data.files.some((file: { path: string; action: string }) => file.path === ".claude/skills/brain-workflow-adopt/SKILL.md" && file.action === "created"));
  assert.equal(await readFile(join(repo, "AGENTS.md"), "utf8"), `${BLOCK_START}`
    + "To track this repo's work, the standard way or connected to a Notion Project or Area, use the `brain-workflow` skill; to take over its existing plans and tasks, use `brain-workflow-adopt`.\n\n"
    + "The brain is read-only from this repo. Never edit its files from here. A connected workflow's records change only through `brain workflow` commands.\n<!-- ultimate-brain:end -->\n");
});

test("the block's workflow lines follow the linked skills: brain-workflow alone, adopt alone, and A's brain-query only as before", async (context) => {
  const home = await temp(context);
  const cases: Array<[string[] | null, string]> = [
    [["brain-query", "brain-workflow"], `${BLOCK_START}To track this repo's work, the standard way or connected to a Notion Project or Area, use the \`brain-workflow\` skill.\n\n`
      + "The brain is read-only from this repo. Never edit its files from here. A connected workflow's records change only through `brain workflow` commands.\n<!-- ultimate-brain:end -->\n"],
    [["brain-query", "brain-workflow-adopt"], BLOCK_BEFORE],
    [null, BLOCK_BEFORE],
  ];
  for (const [linked, expected] of cases) {
    const product = await productRoot(context, linked === null ? A : await workflowSnapshot(context, linked), "0.9.2");
    const brain = await initBrain(context, product, home);
    const repo = await temp(context, "skills-repo-");
    const link = await run(["link", repo, "--brain", brain, "--json"], { product, home });
    assert.equal(link.code, 0, link.stdout);
    assert.equal(await readFile(join(repo, "AGENTS.md"), "utf8"), expected, String(linked));
  }
});
