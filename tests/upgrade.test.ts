import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { brain } from "./helpers.ts";

const NOW = "2026-12-03T10:22:00Z";
const START = /<!-- ultimate-brain:rules:start[^>]*-->/;
const END = "<!-- ultimate-brain:rules:end -->";
const exec = promisify(execFile);

async function freshBrain(context: TestContext): Promise<{ root: string; target: string }> {
  const root = await mkdtemp(join(tmpdir(), "brain-upgrade-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  const init = await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root);
  assert.equal(init.code, 0, init.stderr);
  return { root, target };
}

async function git(root: string, args: string[]): Promise<string> { return (await exec("git", args, { cwd: root })).stdout; }
async function gitBrain(root: string): Promise<void> {
  await git(root, ["init"]); await git(root, ["config", "user.name", "Test"]); await git(root, ["config", "user.email", "test@example.test"]); await git(root, ["add", "."]); await git(root, ["commit", "-m", "init"]);
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

test("upgrade refuses symbolic links and wrong file types before writing anything", async (context) => {
  const { root, target } = await freshBrain(context);
  const outside = join(root, "outside");
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, "precious.md"), "keep me\n");
  const stale = join(target, ".agents/skills/brain-ingest/SKILL.md");
  await writeFile(stale, "old skill\n");
  const refuse = async (label: string) => {
    const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
    assert.equal(run.code, 5, `${label}: ${run.stdout}`);
    assert.equal(run.json.error.code, "OUTSIDE_ROOT", label);
    assert.equal(await readFile(stale, "utf8"), "old skill\n", label);
    assert.equal(await readFile(join(outside, "precious.md"), "utf8"), "keep me\n", label);
  };

  // A skill folder that is a link out of the brain.
  await rm(join(target, ".agents/skills/brain-query"), { recursive: true });
  await symlink(outside, join(target, ".agents/skills/brain-query"));
  await refuse("skill folder link");
  // A file where a skill folder should be.
  await rm(join(target, ".agents/skills/brain-query"));
  await writeFile(join(target, ".agents/skills/brain-query"), "not a folder\n");
  await refuse("file instead of folder");
  // The whole skills folder is a link.
  await rm(join(target, ".agents/skills/brain-query"));
  await rename(join(target, ".agents/skills"), join(root, "skills-copy"));
  await symlink(join(root, "skills-copy"), join(target, ".agents/skills"));
  await refuse("skills folder link");
});

test("upgrade leaves a CLAUDE.md that links to AGENTS.md alone", async (context) => {
  const { root, target } = await freshBrain(context);
  await rm(join(target, "CLAUDE.md"));
  await symlink("AGENTS.md", join(target, "CLAUDE.md"));
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.files, []);
});

test("upgrade dry-run lints the product files it plans to repair", async (context) => {
  const { root, target } = await freshBrain(context);
  await writeFile(join(target, ".agents/skills/brain-query/SKILL.md"), "drift\n");
  const run = await brain(["upgrade", "--brain", target, "--dry-run", "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.lint.errors, 0, JSON.stringify(run.json.data.lint));
});

test("upgrade refuses UNRELEASED_BUILD without writing", async (context) => {
  const { root, target } = await freshBrain(context);
  const before = await readFile(join(target, "AGENTS.md"), "utf8");
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root, join(import.meta.dirname, ".."), true);
  assert.equal(run.json.error.code, "UNRELEASED_BUILD");
  assert.equal(await readFile(join(target, "AGENTS.md"), "utf8"), before);
});

test("upgrade reports BRAIN_DIRTY and dry-run dirty", async (context) => {
  const { root, target } = await freshBrain(context); await gitBrain(target); const stale = join(target, ".agents/skills/brain-query/SKILL.md"); await writeFile(stale, "drift\n");
  const blocked = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(blocked.json.error.code, "BRAIN_DIRTY");
  assert.equal(await readFile(stale, "utf8"), "drift\n");
  const dry = await brain(["upgrade", "--brain", target, "--dry-run", "--now", NOW, "--json"], root);
  assert.equal(dry.json.data.dirty, true);
});

test("upgrade cleans settings and warns for invalid settings", async (context) => {
  const { root, target } = await freshBrain(context);
  await mkdir(join(target, ".claude"), { recursive: true });
  await writeFile(join(target, ".claude/settings.json"), '{\n  "other": true,\n  "enabledPlugins": {"ultimate-brain@ultimate-brain": true},\n  "extraKnownMarketplaces": {"ultimate-brain": true}\n}\n');
  const clean = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(clean.code, 0); assert.equal(await readFile(join(target, ".claude/settings.json"), "utf8"), '{\n  "other": true\n}\n');
  await writeFile(join(target, ".claude/settings.json"), "{bad\n");
  const invalid = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.ok(invalid.json.warnings.some((warning: { code: string }) => warning.code === "SETTINGS_UNPARSEABLE"));
  await writeFile(join(target, ".claude/settings.json"), '{"enabledPlugins":{"ultimate-brain@ultimate-brain":true}}\n');
  const empty = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.ok(empty.json.data.files.some((file: { path: string; action: string }) => file.path === ".claude/settings.json" && file.action === "removed"));
  await assert.rejects(readFile(join(target, ".claude/settings.json")));
});

test("upgrade renames capture_inbox to inbox", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.capture_inbox = config.notion.databases.inbox;
  delete config.notion.databases.inbox;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  assert.ok(run.json.data.files.some((file: { path: string; action: string }) => file.path === "brain.json" && file.action === "updated"));
  const upgraded = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(upgraded.notion.databases.inbox, "");
  assert.equal(upgraded.notion.databases.capture_inbox, undefined);
});

test("upgrade renames references to documents and writes a modules block with every module on (0048, 0049)", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  // A brain made before 0.6.0: References, no modules block.
  delete config.modules;
  config.notion.databases = { review: "review-id", references: "refs-id", inbox: "inbox-id" };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(run.code, 0, run.stdout);
  const upgraded = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(upgraded.notion.databases, { review: "review-id", documents: "refs-id", inbox: "inbox-id" });
  assert.deepEqual(Object.keys(upgraded), ["schema_version", "owner", "budgets", "settings", "modules", "notion"]);
  assert.deepEqual(upgraded.modules, { knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true });

  // A present block is the user's: a second upgrade leaves brain.json alone.
  upgraded.modules.reports = false;
  await writeFile(configPath, `${JSON.stringify(upgraded, null, 2)}\n`);
  const again = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(again.json.data.files.some((file: { path: string }) => file.path === "brain.json"), false);
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).modules.reports, false);
});

test("upgrade keeps a configured Inbox id, replaces an empty one, and warns for broken brain.json", async (context) => {
  const { root, target } = await freshBrain(context);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases = { review: "review-id", capture_inbox: "capture-id", inbox: "inbox-id" };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const retained = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(retained.code, 0, retained.stdout);
  let upgraded = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(Object.keys(upgraded.notion.databases), ["review", "inbox"]);
  assert.equal(upgraded.notion.databases.inbox, "inbox-id");

  upgraded.notion.databases.capture_inbox = "capture-id";
  upgraded.notion.databases.inbox = "";
  await writeFile(configPath, `${JSON.stringify(upgraded, null, 2)}\n`);
  const replaced = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(replaced.code, 0, replaced.stdout);
  upgraded = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(upgraded.notion.databases.inbox, "capture-id");

  await writeFile(configPath, "{not json\n");
  const broken = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(broken.code, 0, broken.stdout);
  assert.ok(broken.json.warnings.some((warning: { code: string }) => warning.code === "BRAIN_JSON_UNPARSEABLE"));
  assert.ok(broken.json.data.files.some((file: { path: string; action: string }) => file.path === "brain.json" && file.action === "skipped"));
});

test("upgrade warns PUSH_SKIPPED when no upstream exists", async (context) => {
  const { root, target } = await freshBrain(context); await gitBrain(target); await writeFile(join(target, ".agents/skills/brain-query/SKILL.md"), "drift\n"); await git(target, ["add", "."]); await git(target, ["commit", "-m", "drift"]);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.ok(run.json.data.commit); assert.ok(run.json.warnings.some((warning: { code: string }) => warning.code === "PUSH_SKIPPED"));
});

test("upgrade pushes its commit to a local bare remote", async (context) => {
  const { root, target } = await freshBrain(context); await gitBrain(target); const remote = join(root, "remote.git"); await exec("git", ["init", "--bare", remote]); await git(target, ["remote", "add", "origin", remote]); await git(target, ["push", "-u", "origin", "HEAD"]); await writeFile(join(target, ".agents/skills/brain-query/SKILL.md"), "drift\n"); await git(target, ["add", "."]); await git(target, ["commit", "-m", "drift"]);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root); assert.equal(run.json.data.pushed, true); assert.ok(run.json.data.commit); await git(root, ["--git-dir", remote, "cat-file", "-e", `${run.json.data.commit}^{commit}`]);
});

test("upgrade keeps its commit when push fails", async (context) => {
  const { root, target } = await freshBrain(context); await gitBrain(target); await git(target, ["remote", "add", "origin", "file:///missing/remote.git"]);
  const branch = (await git(target, ["branch", "--show-current"])).trim(); await git(target, ["config", `branch.${branch}.remote`, "origin"]); await git(target, ["config", `branch.${branch}.merge`, `refs/heads/${branch}`]); await git(target, ["update-ref", `refs/remotes/origin/${branch}`, "HEAD"]); await writeFile(join(target, ".agents/skills/brain-query/SKILL.md"), "drift\n"); await git(target, ["add", "."]); await git(target, ["commit", "-m", "drift"]);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root); assert.equal(run.code, 0); assert.ok(run.json.data.commit); assert.ok(run.json.warnings.some((warning: { code: string }) => warning.code === "PUSH_FAILED"));
});

test("upgrade warns GIT_COMMIT_SKIPPED without identity", async (context) => {
  const oldGlobal = process.env.GIT_CONFIG_GLOBAL; const oldNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  process.env.GIT_CONFIG_GLOBAL = "/dev/null"; process.env.GIT_CONFIG_NOSYSTEM = "1";
  context.after(() => { if (oldGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = oldGlobal; if (oldNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM; else process.env.GIT_CONFIG_NOSYSTEM = oldNoSystem; });
  const { root, target } = await freshBrain(context); await git(target, ["init"]); await git(target, ["config", "user.useConfigOnly", "true"]); await git(target, ["add", "."]); await git(target, ["-c", "user.name=Bootstrap", "-c", "user.email=bootstrap@example.test", "commit", "-m", "init"]); await writeFile(join(target, ".agents/skills/brain-query/SKILL.md"), "drift\n"); await git(target, ["add", "."]); await git(target, ["-c", "user.name=Bootstrap", "-c", "user.email=bootstrap@example.test", "commit", "-m", "drift"]);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root); assert.ok(run.json.warnings.some((warning: { code: string }) => warning.code === "GIT_COMMIT_SKIPPED")); assert.notEqual(await readFile(join(target, ".agents/skills/brain-query/SKILL.md"), "utf8"), "drift\n");
});

test("upgrade stages only its files and log", async (context) => {
  const { root, target } = await freshBrain(context); await gitBrain(target); await writeFile(join(target, "AGENTS.md"), "user rules\n"); await writeFile(join(target, "unrelated.txt"), "keep\n"); await writeFile(join(target, ".agents/skills/brain-query/SKILL.md"), "drift\n"); await git(target, ["add", "."]); await git(target, ["commit", "-m", "drift and user files"]);
  const run = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root); const show = await git(target, ["show", "--name-only", "--format=", run.json.data.commit]); assert.ok(!show.includes("AGENTS.md") && !show.includes("unrelated.txt"));
});
