import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { brain, fixtureCopy, testPackageRoot } from "./helpers.ts";
import { run } from "./skills-fixtures.ts";
import { skillsDiffer } from "../src/lib/upgrade-projects.ts";
import { aroundBlock, blockOf, changedPaths, END, OWNED, oldInstallation, PROJECT, PROJECTS, START, treeDigest, type OldInstallation, type ProjectName } from "./upgrade-0-12-fixture.ts";

/**
 * CC-184 (decision 0077 §4): one `brain upgrade` brings the brain and every registered linked project to the corrected
 * instructions and skills, keeps what each project wrote itself, and reports what it couldn't finish.
 *
 * The acceptance runs on a synthetic 0.12.0 installation made with the published package (tests/upgrade-0-12-fixture.ts); the
 * other cases of cli.md §5.15 step 9 run on the fixture brain with the CLI under test, offline.
 */

const exec = promisify(execFile);
const REPO = join(import.meta.dirname, "..");
const NOW = "2026-11-10T10:00:00Z";
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

/** The per-project report of `brain upgrade --json` (cli.md §5.15 step 9), by name. */
function projectsOf(run: { json: any }): Map<string, { state: string; reason: string | null; message: string | null; files: Array<{ path: string; action: string }> }> {
  const list = (run.json?.data?.projects ?? []) as Array<{ name: string; state: string; reason: string | null; message: string | null; files: Array<{ path: string; action: string }> }>;
  return new Map(list.map((project) => [project.name, project]));
}

/** `brain upgrade` by the CLI under test, with `HOME` set, so global competing copies are looked for (skills-delivery §5.2). */
async function upgrade(install: OldInstallation, ...extra: string[]) {
  return run(["upgrade", "--brain", install.brain, "--now", NOW, ...extra], { product: await testPackageRoot(), home: install.home });
}

/** Digests of the brain and every project folder, keyed by folder. */
async function digests(install: OldInstallation): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  for (const [name, path] of [["brain", install.brain], ...Object.entries(install.projects)] as Array<[string, string]>) out.set(name, await treeDigest(path));
  return out;
}

/** Every file a skill of the lock lists, in both trees of `root`, holds the brain's pinned bytes. */
async function assertPinnedSkills(install: OldInstallation, root: string, target: string): Promise<void> {
  const lock = JSON.parse(await text(join(install.brain, "skills.lock.json")));
  for (const skill of lock.snapshot.skills.filter((entry: { targets: string[] }) => entry.targets.includes(target))) {
    for (const file of skill.files as Array<{ path: string }>) {
      const pinned = await text(join(install.brain, ".agents/skills", skill.name, file.path));
      for (const tree of [".agents/skills", ".claude/skills"]) assert.equal(await text(join(root, tree, skill.name, file.path)), pinned, `${root} ${tree}/${skill.name}/${file.path}`);
    }
  }
}

test("one brain upgrade on a 0.12.0 installation reaches the brain and its registered projects (0077 §4)", async (context) => {
  const statusBefore = await repoStatus();
  const install = await oldInstallation(context);
  if (install === undefined) return;
  const { projects } = install;
  const outside = { bystander: await treeDigest(install.bystander), home: await treeDigest(install.home), package: await treeDigest(install.package.root) };
  const owned = Object.fromEntries(await Promise.all((["AGENTS.md", "CLAUDE.md"] as const).map(async (file) => [file, aroundBlock(await text(join(projects.owned, file)))]))) as Record<string, { before: string; after: string }>;
  const before = await digests(install);

  const dry = await upgrade(install, "--dry-run", "--json");
  const afterDry = await digests(install);
  const first = await upgrade(install, "--json");
  assert.equal(first.json?.ok, true, first.stdout || first.stderr);
  const afterFirst = await digests(install);
  const second = await upgrade(install, "--json");
  const afterSecond = await digests(install);
  const human = await upgrade(install);
  const reported = projectsOf(first);

  await context.test("a dry run judges and plans the same and writes nothing", () => {
    for (const [name, digest] of before) assert.deepEqual(changedPaths(digest, afterDry.get(name)!), [], name);
    assert.deepEqual(dry.json.data.projects, first.json.data.projects);
  });

  await context.test("the brain and the plain and owned projects are upgraded, with project-owned text byte for byte the same", async () => {
    const template = await text(join(REPO, "templates/brain/AGENTS.md"));
    const rules = /<!-- ultimate-brain:rules:start[^\n]*-->[\s\S]*<!-- ultimate-brain:rules:end -->/;
    assert.equal((await text(join(install.brain, "AGENTS.md"))).match(rules)![0], template.match(rules)![0]);
    assert.deepEqual([...reported.keys()], PROJECTS.filter((name) => name !== "unregistered"), "every repos entry, in brain.json order");
    for (const name of UPGRADED) {
      const project = reported.get(name)!;
      assert.equal(project.state, "upgraded", name);
      assert.deepEqual([project.reason, project.message], [null, null]);
      assert.ok(project.files.some((file) => file.path === "AGENTS.md" && file.action === "updated"), name);
      const block = blockOf(await text(join(projects[name], "AGENTS.md")));
      assert.ok(block !== undefined, `${name}: one managed block`);
      assert.match(block, /--historical/, `${name}: the corrected block`);
      const marker = JSON.parse(await text(join(projects[name], ".brain")));
      const lock = JSON.parse(await text(join(install.brain, "skills.lock.json")));
      assert.deepEqual([marker.skills.name, marker.skills.version], [lock.snapshot.name, lock.snapshot.version], `${name}: .brain names the brain's pinned skills`);
      assert.equal(marker.repo, name, `${name}: .brain keeps its repo name`);
      await assertPinnedSkills(install, projects[name], "linked_repo");
    }
    assert.equal(JSON.parse(await text(join(projects.plain, ".brain"))).project, PROJECT, "the project keeps its placement");
    await assertPinnedSkills(install, install.brain, "brain");
    for (const file of ["AGENTS.md", "CLAUDE.md"] as const) {
      const now = await text(join(projects.owned, file));
      assert.deepEqual(aroundBlock(now), owned[file], `owned ${file}: the project's text is unchanged`);
      assert.equal(blockOf(now), blockOf(await text(join(projects.owned, "AGENTS.md"))), `owned ${file}: Claude Code's copy of the block is the corrected one`);
    }
    // Projects are not committed: `link` never commits either.
    assert.notEqual((await exec("git", ["status", "--porcelain"], { cwd: projects.plain, env: install.env })).stdout, "");
  });

  await context.test("an unreachable project, a damaged block and conflicting copies are reported unfinished, never upgraded", async () => {
    const reasons: Record<string, string> = { unreachable: "path_missing", damaged: "block_damaged", "conflicting-skill": "conflicting_copies", "conflicting-block": "conflicting_copies" };
    for (const name of UNFINISHED) {
      const project = reported.get(name)!;
      assert.equal(project.state, "unfinished", name);
      assert.equal(project.reason, reasons[name], name);
      assert.deepEqual(project.files, [], name);
      assert.deepEqual(changedPaths(before.get(name)!, afterFirst.get(name)!), [], `${name} is untouched`);
    }
    assert.match(reported.get("conflicting-skill")!.message!, /\.claude\/skills\/brain-query-copy/);
    const upgraded = [...reported.entries()].filter(([, project]) => project.state === "upgraded").map(([name]) => name).sort();
    assert.deepEqual(upgraded, [...UPGRADED].sort());
    assert.deepEqual(first.json.warnings.filter((warning: { code: string }) => warning.code === "PROJECT_UNFINISHED").map((warning: { message: string }) => warning.message.split(":")[0]), UNFINISHED);
    assert.equal(first.code, 1, "completed with findings");
  });

  await context.test("a second run changes nothing more", () => {
    assert.equal(second.json?.ok, true, second.stdout || second.stderr);
    for (const [name, digest] of afterFirst) assert.deepEqual(changedPaths(digest, afterSecond.get(name)!), [], name);
    assert.deepEqual(second.json.data.files, []);
    for (const name of UPGRADED) assert.equal(projectsOf(second).get(name)?.state, "unchanged", name);
    for (const name of UNFINISHED) assert.equal(projectsOf(second).get(name)?.state, "unfinished", name);
  });

  await context.test("the output asks for fresh agent sessions, last", () => {
    const lines = human.stdout.trimEnd().split("\n");
    assert.match(lines.at(-1)!, /^Start fresh agent sessions in the brain and in every project/);
    assert.match(human.stdout, /^Projects: 0 upgraded, 2 unchanged, 4 unfinished\.$/m);
    assert.match(human.stdout, /^ {2}unreachable: .+$/m);
    assert.equal(first.json.data.next.at(-1), lines.at(-1));
    assert.equal(first.json.data.next[0], "Commit what changed in each upgraded project.");
  });

  await context.test("nothing outside the synthetic folders changes", async () => {
    assert.deepEqual(changedPaths(outside.bystander, await treeDigest(install.bystander)), []);
    assert.deepEqual(changedPaths(outside.home, await treeDigest(install.home)), []);
    assert.deepEqual(changedPaths(outside.package, await treeDigest(install.package.root)), []);
    assert.equal(await repoStatus(), statusBefore, "the product checkout is unchanged");
  });

  await context.test("a folder linked with brain link alone is outside the upgrade, and the output says how to bring it in", () => {
    // The user's choice of 2026-11-10 (spec/eligibility.md §11 step 3): only brain.json `repos` entries count.
    assert.deepEqual(changedPaths(before.get("unregistered")!, afterSecond.get("unregistered")!), []);
    assert.equal(reported.has("unregistered"), false);
    assert.match(human.stdout, /^Folders linked with brain link alone aren't tracked by the upgrade: register them with brain repo add, or run brain link there again\.$/m);
  });
});

test("with the snapshot CC-180 vendors, Claude Code's and Codex's definition paths hold the corrected definitions", { todo: "CC-184: waits for CC-180's vendored snapshot" }, async (context) => {
  const install = await oldInstallation(context);
  if (install === undefined) return;
  await upgrade(install, "--json");
  const lock = JSON.parse(await text(join(install.brain, "skills.lock.json")));
  assert.notEqual(lock.snapshot.version, "1.5.0", "the brain is pinned to the snapshot CC-180 vendors");
  for (const name of UPGRADED) await assertPinnedSkills(install, install.projects[name], "linked_repo");
});

// The other cases of step 9's table, on the fixture brain with the CLI under test (no published package, no network).

const AT = "2026-12-03T10:22:00Z";

/** The fixture brain, with `names` linked by the CLI under test and registered in `repos`; HOME is an empty temp folder. */
async function linkedBrain(context: import("node:test").TestContext, names: string[], register = names): Promise<{ dir: string; home: string; repo: (name: string) => string }> {
  const dir = await fixtureCopy(context);
  const home = join(dir, "..", "home");
  await mkdir(home);
  const repo = (name: string) => join(dir, "..", "projects", name);
  for (const name of names) {
    await mkdir(repo(name), { recursive: true });
    await exec("git", ["init", "-q"], { cwd: repo(name) });
    const linked = await brain(["link", repo(name), "--brain", dir, "--project", "prj-9x4t1b7e", "--json"], home);
    assert.equal(linked.code, 0, linked.stdout);
  }
  const config = JSON.parse(await text(join(dir, "brain.json")));
  config.repos = register.map((name) => ({ name, path: repo(name), area: "area-2m7c4h8n", patterns: ["docs/**"], commit: "" }));
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  return { dir, home, repo };
}

async function upgradeIn(dir: string, home: string, ...extra: string[]) {
  const result = await run(["upgrade", "--brain", dir, "--now", AT, "--json", ...extra], { product: await testPackageRoot(), home });
  assert.ok((result.json as any)?.ok, result.stdout || result.stderr);
  return { run: result as { code: number; json: any; stdout: string }, projects: projectsOf(result as { json: any }) };
}

test("a missing block, a CLAUDE.md block that differs, a global copy and a malformed .brain are unfinished; a source-only entry is not linked", async (context) => {
  const { dir, home, repo } = await linkedBrain(context, ["no-block", "claude-differs", "malformed", "fine"], ["no-block", "claude-differs", "malformed", "fine", "source-only"]);
  await mkdir(repo("source-only"), { recursive: true });
  await writeFile(join(repo("source-only"), "AGENTS.md"), "# A source repo\n");
  await writeFile(join(repo("no-block"), "AGENTS.md"), "# The block was deleted\n");
  await writeFile(join(repo("claude-differs"), "CLAUDE.md"), `# Claude\n\n${blockOf(await text(join(repo("claude-differs"), "AGENTS.md")))!.replace("Consult it", "Ask it")}\n`);
  await writeFile(join(repo("malformed"), ".brain"), "{ not json\n");
  const before = new Map(await Promise.all(["no-block", "claude-differs", "malformed", "source-only"].map(async (name) => [name, await treeDigest(repo(name))] as const)));

  const { run, projects } = await upgradeIn(dir, home);
  assert.deepEqual([...projects.entries()].map(([name, project]) => [name, project.state, project.reason]), [
    ["no-block", "unfinished", "block_missing"],
    ["claude-differs", "unfinished", "conflicting_copies"],
    ["malformed", "unfinished", "refused"],
    ["fine", "unchanged", null],
    ["source-only", "not_linked", null],
  ]);
  for (const [name, digest] of before) assert.deepEqual(changedPaths(digest, await treeDigest(repo(name))), [], name);
  assert.equal(run.code, 1);
  assert.match(run.json.data.next.at(-1), /^Start fresh agent sessions/);

  // A global copy of a linked skill competes in every project (skills-delivery §5.2): the one fine project becomes unfinished too.
  await mkdir(join(home, ".claude/skills/brain-query"), { recursive: true });
  const global = await upgradeIn(dir, home);
  assert.deepEqual([global.projects.get("fine")!.state, global.projects.get("fine")!.reason], ["unfinished", "conflicting_copies"]);
  assert.match(global.projects.get("fine")!.message!, /~\/\.claude\/skills\/brain-query/);
});

test("an upgraded project keeps its .brain repo name and placement, and a CLAUDE.md link to AGENTS.md stays a link", async (context) => {
  const { dir, home, repo } = await linkedBrain(context, ["renamed"]);
  const linked = await brain(["link", repo("renamed"), "--brain", dir, "--repo-name", "custom-name", "--json"], home);
  assert.equal(linked.code, 0, linked.stdout);
  await rm(join(repo("renamed"), "CLAUDE.md"));
  await symlink("AGENTS.md", join(repo("renamed"), "CLAUDE.md"));
  const agents = join(repo("renamed"), "AGENTS.md");
  await writeFile(agents, (await text(agents)).replace("--historical", "--old-flag"));

  const { run, projects } = await upgradeIn(dir, home);
  assert.equal(projects.get("renamed")!.state, "upgraded", run.stdout);
  assert.deepEqual(projects.get("renamed")!.files, [{ path: "AGENTS.md", action: "updated" }]);
  assert.match(await text(agents), /--historical/);
  const marker = JSON.parse(await text(join(repo("renamed"), ".brain")));
  assert.deepEqual([marker.repo, marker.project], ["custom-name", "prj-9x4t1b7e"]);
  assert.equal(run.code, 0);
  assert.equal(existsSync(join(repo("renamed"), "CLAUDE.md")), true);
});

test("a brain with no linked projects reports none, and still ends with the fresh-sessions line", async (context) => {
  const dir = await fixtureCopy(context);
  const { run } = await upgradeIn(dir, join(dir, ".."));
  assert.deepEqual(run.json.data.projects, []);
  assert.deepEqual(run.json.data.next, [
    "Folders linked with brain link alone aren't tracked by the upgrade: register them with brain repo add, or run brain link there again.",
    "Start fresh agent sessions in the brain and in every project: a session opened before the upgrade keeps the old instructions.",
  ]);
  assert.equal(run.code, 0);
});

test("a project whose write fails is unfinished, with every file it had written restored", async (context) => {
  const { dir, home, repo } = await linkedBrain(context, ["locked"]);
  const agents = join(repo("locked"), "AGENTS.md");
  const old = (await text(agents)).replace("--historical", "--old-flag");
  await writeFile(agents, old);
  const skill = join(repo("locked"), ".claude/skills/brain-query");
  await writeFile(join(skill, "SKILL.md"), "an edited copy\n");
  await chmod(skill, 0o555);
  let upgraded;
  try { upgraded = await upgradeIn(dir, home); } finally { await chmod(skill, 0o755); }
  const { run, projects } = upgraded;
  assert.deepEqual([projects.get("locked")!.state, projects.get("locked")!.reason, projects.get("locked")!.files], ["unfinished", "write_failed", []], run.stdout);
  assert.equal(await text(agents), old, "AGENTS.md, written before the failure, is restored");
  assert.equal(run.code, 1);
});

test("the definition check names the first skill file whose bytes aren't the snapshot's, in either tree", async (context) => {
  const dir = await fixtureCopy(context);
  const manifest = JSON.parse(await text(join(REPO, ".agents/skills/snapshot.json")));
  assert.equal(await skillsDiffer(dir, manifest.skills), null);
  await writeFile(join(dir, ".claude/skills/brain-query/SKILL.md"), "stale\n");
  assert.equal(await skillsDiffer(dir, manifest.skills), ".claude/skills/brain-query/SKILL.md doesn't hold the snapshot's bytes");
});
