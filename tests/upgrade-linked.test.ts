import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { brain } from "./helpers.ts";
import { aroundBlock, blockOf, changedPaths, END, OWNED, oldInstallation, PROJECTS, START, treeDigest, type OldInstallation, type ProjectName } from "./upgrade-0-12-fixture.ts";

/**
 * CC-184 (decision 0077 §4): one `brain upgrade` brings the brain and every registered linked project to the corrected
 * instructions and skills, keeps what each project wrote itself, and reports what it couldn't finish.
 *
 * Phase 1 builds the synthetic 0.12.0 installation (tests/upgrade-0-12-fixture.ts) and writes the acceptance below as `todo`:
 * the upgrade's project rule waits for spec/eligibility.md and cli.md §5.15 (CC-182). The report shape read by `projectsOf` is
 * a placeholder until that section exists.
 */

const exec = promisify(execFile);
const REPO = join(import.meta.dirname, "..");
const NOW = "2026-11-10T10:00:00Z";
const PHASE_2 = "CC-184 phase 2";
const UPGRADED: ProjectName[] = ["plain", "owned"];
const UNFINISHED: ProjectName[] = ["unreachable", "damaged", "conflicting-skill", "conflicting-block"];

async function repoStatus(): Promise<string> {
  return (await exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: REPO })).stdout;
}

async function text(path: string): Promise<string> {
  return readFile(path, "utf8");
}

test("the fixture is a 0.12.0 installation made by the published package, and nothing outside its folder changes", async (context) => {
  const statusBefore = await repoStatus();
  const install = await oldInstallation(context);
  if (install === undefined) return;
  const { brain: root, projects } = install;

  // The brain: pinned by 0.12.0 to the skills it shipped, clean, its linked repos registered with their paths.
  const lock = JSON.parse(await text(join(root, "skills.lock.json")));
  assert.equal(lock.installed_by, "0.12.0");
  assert.equal(lock.snapshot.name, "ultimate-brain-skills");
  assert.equal(lock.snapshot.version, "1.5.0");
  const repos = JSON.parse(await text(join(root, "brain.json"))).repos as Array<{ name: string; path: string }>;
  assert.deepEqual(repos.map((repo) => [repo.name, repo.path]), PROJECTS.filter((name) => name !== "unregistered").map((name) => [name, projects[name]]));
  for (const folder of [root, ...PROJECTS.filter((name) => name !== "unregistered" && name !== "unreachable").map((name) => projects[name])]) {
    assert.equal((await exec("git", ["status", "--porcelain"], { cwd: folder, env: install.env })).stdout, "", `${folder} is committed`);
  }

  // Each project as 0.12.0's `brain link` left it, then changed as its case says.
  const plain = await text(join(projects.plain, "AGENTS.md"));
  assert.equal(plain, `${blockOf(plain)}\n`);
  assert.equal(await text(join(projects.plain, "CLAUDE.md")), "@AGENTS.md\n");
  assert.equal(JSON.parse(await text(join(projects.plain, ".brain"))).skills.version, "1.5.0");
  // The 0.12.0 block predates the eligible read (CC-176), so an upgrade has something to change.
  assert.doesNotMatch(blockOf(plain)!, /brain query --read/);
  for (const file of ["AGENTS.md", "CLAUDE.md"] as const) {
    const around = aroundBlock(await text(join(projects.owned, file)));
    assert.ok(around !== undefined, `owned ${file} has one block`);
    assert.equal(around.before, `${OWNED[file].before}\n`);
    assert.equal(around.after, `\n${OWNED[file].after}`);
  }
  assert.equal(existsSync(projects.unreachable), false);
  const damaged = await text(join(projects.damaged, "AGENTS.md"));
  assert.ok(damaged.includes(START) && !damaged.includes(END));
  assert.match(await text(join(projects["conflicting-skill"], ".claude/skills/brain-query-copy/SKILL.md")), /^name: brain-query$/m);
  assert.equal(existsSync(join(projects["conflicting-skill"], ".agents/skills/brain-query-copy")), false);
  assert.equal((await text(join(projects["conflicting-block"], "AGENTS.md"))).split(START).length - 1, 2);
  assert.ok(existsSync(join(projects.unregistered, ".brain")));
  assert.equal(existsSync(join(projects.unregistered, ".git")), false);

  assert.equal(await repoStatus(), statusBefore, "the product checkout is unchanged");
});

/** The per-project report of `brain upgrade --json`. TODO(CC-182): the field names come from cli.md §5.15 once written. */
function projectsOf(run: { json: any }): Map<string, { state: string; reason?: string }> {
  const list = (run.json?.data?.projects ?? []) as Array<{ name: string; state: string; reason?: string }>;
  return new Map(list.map((project) => [project.name, project]));
}

async function upgrade(install: OldInstallation, json = true): Promise<Awaited<ReturnType<typeof brain>>> {
  return brain(["upgrade", "--brain", install.brain, "--now", NOW, ...(json ? ["--json"] : [])], install.home);
}

/** Digests of the brain and every project folder, keyed by folder. */
async function digests(install: OldInstallation): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  for (const [name, path] of [["brain", install.brain], ...Object.entries(install.projects)] as Array<[string, string]>) out.set(name, await treeDigest(path));
  return out;
}

test("one brain upgrade on a 0.12.0 installation reaches the brain and its registered projects (0077 §4)", { todo: PHASE_2 }, async (context) => {
  const statusBefore = await repoStatus();
  const install = await oldInstallation(context);
  if (install === undefined) return;
  const { projects } = install;
  const outside = { bystander: await treeDigest(install.bystander), home: await treeDigest(install.home), package: await treeDigest(install.package.root) };
  const owned = Object.fromEntries(await Promise.all((["AGENTS.md", "CLAUDE.md"] as const).map(async (file) => [file, aroundBlock(await text(join(projects.owned, file)))]))) as Record<string, { before: string; after: string }>;
  const before = await digests(install);

  const first = await upgrade(install);
  assert.equal(first.json?.ok, true, first.stdout || first.stderr);
  const afterFirst = await digests(install);
  const second = await upgrade(install);
  const afterSecond = await digests(install);
  const human = await upgrade(install, false);
  const reported = projectsOf(first);

  await context.test("the brain and the plain and owned projects are upgraded, with project-owned text byte for byte the same", { todo: PHASE_2 }, async () => {
    const template = await text(join(REPO, "templates/brain/AGENTS.md"));
    const rules = /<!-- ultimate-brain:rules:start[^\n]*-->[\s\S]*<!-- ultimate-brain:rules:end -->/;
    assert.equal((await text(join(install.brain, "AGENTS.md"))).match(rules)![0], template.match(rules)![0]);
    for (const name of UPGRADED) {
      assert.equal(reported.get(name)?.state, "upgraded", name);
      const block = blockOf(await text(join(projects[name], "AGENTS.md")));
      assert.ok(block !== undefined, `${name}: one managed block`);
      assert.match(block, /brain query --read/, `${name}: the corrected block`);
      const marker = JSON.parse(await text(join(projects[name], ".brain")));
      const lock = JSON.parse(await text(join(install.brain, "skills.lock.json")));
      assert.deepEqual([marker.skills.name, marker.skills.version], [lock.snapshot.name, lock.snapshot.version], `${name}: .brain names the brain's pinned skills`);
    }
    for (const file of ["AGENTS.md", "CLAUDE.md"] as const) {
      const now = await text(join(projects.owned, file));
      assert.deepEqual(aroundBlock(now), owned[file], `owned ${file}: the project's text is unchanged`);
      assert.equal(blockOf(now), blockOf(await text(join(projects.owned, "AGENTS.md"))), `owned ${file}: Claude Code's copy of the block is the corrected one`);
    }
  });

  await context.test("an unreachable project, a damaged block and conflicting copies are reported unfinished, never upgraded", { todo: PHASE_2 }, async () => {
    // TODO(CC-182): the reason codes, the exit code, and whether an unfinished project's skill copies are still refreshed. Built here
    // fail-closed: an unfinished project is left exactly as it was.
    const reasons: Record<string, RegExp> = { unreachable: /unreachable|missing/, damaged: /damaged|block/, "conflicting-skill": /conflict|duplicate/, "conflicting-block": /conflict|duplicate/ };
    for (const name of UNFINISHED) {
      assert.equal(reported.get(name)?.state, "unfinished", name);
      assert.match(reported.get(name)?.reason ?? "", reasons[name]!, name);
      assert.deepEqual(changedPaths(before.get(name)!, afterFirst.get(name)!), [], `${name} is untouched`);
    }
    const upgraded = [...reported.entries()].filter(([, project]) => project.state === "upgraded").map(([name]) => name).sort();
    assert.deepEqual(upgraded, [...UPGRADED].sort());
  });

  await context.test("a second run changes nothing more", { todo: PHASE_2 }, async () => {
    assert.equal(second.json?.ok, true, second.stdout || second.stderr);
    for (const [name, digest] of afterFirst) assert.deepEqual(changedPaths(digest, afterSecond.get(name)!), [], name);
    assert.deepEqual(second.json.data.files, []);
    for (const name of UPGRADED) assert.equal(projectsOf(second).get(name)?.state, "unchanged", name);
    for (const name of UNFINISHED) assert.equal(projectsOf(second).get(name)?.state, "unfinished", name);
  });

  await context.test("the output asks for fresh agent sessions", { todo: PHASE_2 }, async () => {
    assert.match(human.stdout, /fresh|new (agent )?session/i);
  });

  await context.test("nothing outside the synthetic folders changes", { todo: PHASE_2 }, async () => {
    assert.deepEqual(changedPaths(outside.bystander, await treeDigest(install.bystander)), []);
    assert.deepEqual(changedPaths(outside.home, await treeDigest(install.home)), []);
    assert.deepEqual(changedPaths(outside.package, await treeDigest(install.package.root)), []);
    assert.equal(await repoStatus(), statusBefore, "the product checkout is unchanged");
  });

  await context.test("a folder linked with brain link alone is outside the upgrade, and the output says how to bring it in", { todo: PHASE_2 }, async () => {
    // The user's choice of 2026-11-10 (spec/eligibility.md §11 step 3): only brain.json `repos` entries count; `brain link` records no
    // path (cli.md §5.12). The exact wording comes from cli.md §5.15 once written.
    assert.deepEqual(changedPaths(before.get("unregistered")!, afterFirst.get("unregistered")!), []);
    assert.equal(reported.has("unregistered"), false);
    assert.match(human.stdout, /brain link/);
    assert.match(human.stdout, /not (tracked|registered)|outside the upgrade|brain repo add/i);
  });
});

test("with the snapshot CC-180 vendors, Claude Code's and Codex's definition paths hold the corrected definitions", { todo: `${PHASE_2}, after CC-180's snapshot` }, async (context) => {
  const install = await oldInstallation(context);
  if (install === undefined) return;
  await upgrade(install);
  const lock = JSON.parse(await text(join(install.brain, "skills.lock.json")));
  assert.notEqual(lock.snapshot.version, "1.5.0", "the brain is pinned to the snapshot CC-180 vendors");
  for (const name of UPGRADED) {
    for (const skill of lock.snapshot.skills.filter((entry: { targets: string[] }) => entry.targets.includes("linked_repo"))) {
      for (const file of skill.files as Array<{ path: string }>) {
        const pinned = await text(join(install.brain, ".agents/skills", skill.name, file.path));
        for (const tree of [".agents/skills", ".claude/skills"]) assert.equal(await text(join(install.projects[name], tree, skill.name, file.path)), pinned, `${name} ${tree}/${skill.name}/${file.path}`);
      }
    }
  }
});
