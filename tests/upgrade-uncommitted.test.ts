import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

import { setUpgradeHooksForTests } from "../src/commands/upgrade.ts";
import { brain, initCopy } from "./helpers.ts";

// spec/cli.md §5.15 "Uncommitted work" (decision 0103, CC-336): synthetic brains, checked in both the working files and the Git index.

const NOW = "2026-12-03T10:22:00Z";
const LOG = "log/2026-12.md";
const SKILL = ".agents/skills/brain-query/SKILL.md";
const exec = promisify(execFile);
const AREA = "area-2m7c4h8n";

async function git(cwd: string, args: string[]): Promise<string> {
  return (await exec("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

/** A brain in Git with one commit, and one committed drift in a product-owned file so the upgrade has something to write. */
async function gitBrain(context: TestContext): Promise<{ home: string; target: string; write: (path: string, text: string) => Promise<void> }> {
  const home = await mkdtemp(join(tmpdir(), "brain-uncommitted-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  const target = join(home, "brain");
  const init = await initCopy(target, { now: NOW });
  assert.equal(init.code, 0, init.stderr);
  const write = async (path: string, text: string) => {
    await mkdir(dirname(join(target, path)), { recursive: true });
    await writeFile(join(target, path), text);
  };
  await write("knowledge/references/draft-pricing.md", "---\nid: ref-4h7k2m9q\ntype: reference\ntitle: Pricing\nsummary: Draft.\nlifecycle: draft\n---\nFirst.\n");
  await write("knowledge/references/staged.md", "---\nid: ref-8n3p6r2t\ntype: reference\ntitle: Staged\nsummary: Staged.\nlifecycle: draft\n---\nOne.\n");
  await git(target, ["init", "-q"]);
  await git(target, ["config", "user.name", "Test"]);
  await git(target, ["config", "user.email", "test@example.test"]);
  await git(target, ["add", "."]);
  await git(target, ["commit", "-qm", "init"]);
  await write(SKILL, "drift\n");
  await git(target, ["commit", "-qam", "drift"]);
  return { home, target, write };
}

const run = (home: string, target: string, ...extra: string[]) => brain(["upgrade", "--brain", target, "--now", NOW, "--json", ...extra], home);
const human = (home: string, target: string, ...extra: string[]) => brain(["upgrade", "--brain", target, "--now", NOW, ...extra], home);

/** The index (every entry) and the status, to show the user's staging is untouched. */
async function gitState(target: string): Promise<{ index: string; status: string; head: string }> {
  return {
    index: await git(target, ["ls-files", "-s"]),
    status: await git(target, ["status", "--porcelain=v2", "--untracked-files=all"]),
    head: (await git(target, ["rev-parse", "HEAD"])).trim(),
  };
}

async function bytes(target: string, paths: readonly string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const path of paths) out[path] = existsSync(join(target, path)) ? (await readFile(join(target, path))).toString("base64") : null;
  return out;
}

/** Untracked diagram (space, non-ASCII), modified draft, staged edit and partly staged file: the four kinds 0103 keeps. */
async function unrelatedWork(target: string, write: (path: string, text: string) => Promise<void>): Promise<string[]> {
  await write("diagrams/launch flow é.excalidraw", "{\"type\":\"excalidraw\"}\n");
  await write("knowledge/references/draft-pricing.md", "---\nid: ref-4h7k2m9q\ntype: reference\ntitle: Pricing\nsummary: Draft.\nlifecycle: draft\n---\nSecond.\n");
  await write("knowledge/references/staged.md", "---\nid: ref-8n3p6r2t\ntype: reference\ntitle: Staged\nsummary: Staged.\nlifecycle: draft\n---\nTwo.\n");
  await git(target, ["add", "knowledge/references/staged.md"]);
  await write("notes.txt", "staged line\n");
  await git(target, ["add", "notes.txt"]);
  await write("notes.txt", "staged line\nunstaged line\n");
  return ["diagrams/launch flow é.excalidraw", "knowledge/references/draft-pricing.md", "knowledge/references/staged.md", "notes.txt"];
}

test("upgrade proceeds around unrelated untracked, modified, staged and partly staged work, and commits only its own files", async (context) => {
  const { home, target, write } = await gitBrain(context);
  const paths = await unrelatedWork(target, write);
  const filesBefore = await bytes(target, paths);
  const stagedBefore = await git(target, ["diff", "--cached", "--binary"]);
  const unstagedBefore = await git(target, ["diff", "--binary"]);
  const indexBefore = await git(target, ["ls-files", "-s", "--", "knowledge/references/staged.md", "notes.txt"]);

  const dry = await run(home, target, "--dry-run");
  assert.equal(dry.code, 0, dry.stdout);
  assert.equal(dry.json.data.would_refuse, null);
  assert.equal(dry.json.data.dirty, true);

  const result = await run(home, target);
  assert.equal(result.code, 0, result.stdout);
  assert.ok(result.json.data.commit);
  assert.deepEqual(result.json.data.uncommitted, { conflicts: [], unrelated: paths });
  assert.deepEqual(dry.json.data.uncommitted, result.json.data.uncommitted, "dry-run reports what the real run does");
  assert.deepEqual(dry.json.data.files, result.json.data.files);
  assert.equal(result.json.data.would_refuse, undefined);
  assert.equal(result.json.data.dirty, undefined);

  // Bytes and staging state are unchanged; the commit holds the upgrade's files only.
  assert.deepEqual(await bytes(target, paths), filesBefore);
  assert.equal(await git(target, ["diff", "--cached", "--binary"]), stagedBefore);
  assert.equal(await git(target, ["diff", "--binary"]), unstagedBefore);
  assert.equal(await git(target, ["ls-files", "-s", "--", "knowledge/references/staged.md", "notes.txt"]), indexBefore);
  const committed = (await git(target, ["-c", "core.quotePath=false", "show", "--name-only", "--format=", "HEAD"])).trim().split("\n").sort();
  assert.ok(committed.includes(SKILL) && committed.includes(LOG), committed.join(","));
  for (const path of paths) assert.ok(!committed.includes(path), `${path} is not in the upgrade's commit`);
  assert.deepEqual(committed, [...result.json.data.files.map((file: { path: string }) => file.path), LOG].sort());
  assert.equal(await readFile(join(target, SKILL), "utf8") === "drift\n", false);

  const text = await human(home, target, "--dry-run");
  assert.equal(text.code, 0);
  // A repeated upgrade is a no-op: nothing to write, every uncommitted path unrelated, nothing committed.
  const again = await run(home, target);
  assert.equal(again.code, 0, again.stdout);
  assert.deepEqual(again.json.data.files, []);
  assert.equal(again.json.data.commit, null);
  assert.deepEqual(again.json.data.uncommitted, { conflicts: [], unrelated: paths });
  assert.deepEqual(await bytes(target, paths), filesBefore);
  assert.equal(await git(target, ["diff", "--cached", "--binary"]), stagedBefore);
});

test("upgrade's human output says how many unrelated files it left as they were", async (context) => {
  const { home, target, write } = await gitBrain(context);
  await unrelatedWork(target, write);
  const result = await human(home, target);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /^\d+ files changed, \d+ unchanged\nLeft as they were: 4 uncommitted files unrelated to the upgrade \(not in its commit\)\.\n/);
});

test("upgrade refuses every conflict before writing, with exact paths, and leaves the tree and index unchanged", async (context) => {
  const { home, target, write } = await gitBrain(context);
  // Committed: a rules block the upgrade replaces, so AGENTS.md is generated with the structure block (its inputs).
  const agents = await readFile(join(target, "AGENTS.md"), "utf8");
  await write("AGENTS.md", agents.replace(/(<!-- ultimate-brain:rules:start[^\n]*-->\n)/, "$1Old rules line.\n"));
  await git(target, ["commit", "-qam", "old rules"]);
  await unrelatedWork(target, write);
  await write(".agents/skills/brain-ingest/my nötes.md", "mine\n"); // untracked in a skill folder: removed
  await write(".claude/skills/brain-query/SKILL.md", "my edit\n"); // a managed file the upgrade replaces
  await git(target, ["add", ".claude/skills/brain-query/SKILL.md"]);
  await write(LOG, `${await readFile(join(target, LOG), "utf8")}- my line\n`); // the monthly log
  await write("areas/clients.md", `---\nid: ${AREA}\ntype: area\ntitle: Clients\nsummary: Client work.\nlifecycle: reviewed\n---\n`); // an input of AGENTS.md
  const watched = [".agents/skills/brain-ingest/my nötes.md", ".claude/skills/brain-query/SKILL.md", LOG, "areas/clients.md", "AGENTS.md", SKILL, "notes.txt"];
  const filesBefore = await bytes(target, watched);
  const before = await gitState(target);

  const result = await run(home, target);
  assert.equal(result.json.error.code, "BRAIN_DIRTY", result.stdout);
  assert.equal(result.code, 5);
  const conflicts = result.json.error.details.conflicts;
  assert.deepEqual(conflicts.map((conflict: { path: string; state: string; reason: string; affects: string[] }) => [conflict.path, conflict.state, conflict.reason, conflict.affects]), [
    [".agents/skills/brain-ingest/my nötes.md", "untracked", "changed", [".agents/skills/brain-ingest/my nötes.md"]],
    [".claude/skills/brain-query/SKILL.md", "staged", "changed", [".claude/skills/brain-query/SKILL.md"]],
    ["areas/clients.md", "untracked", "input", ["AGENTS.md"]],
    [LOG, "unstaged", "log", [LOG]],
  ]);
  assert.equal(conflicts[0].resolution, "The upgrade removes this file. Commit your change first (Git keeps your version), or move the file somewhere else.");
  assert.equal(conflicts[1].resolution, "The upgrade replaces this file. Commit your change first (Git keeps your version), or move the file somewhere else.");
  assert.equal(conflicts[2].resolution, "AGENTS.md is built from this file. Commit your change first, or undo it.");
  assert.equal(conflicts[3].resolution, `Commit ${LOG} first: the upgrade adds its own line to it.`);
  assert.deepEqual(result.json.error.details.unrelated, ["diagrams/launch flow é.excalidraw", "knowledge/references/draft-pricing.md", "knowledge/references/staged.md", "notes.txt"]);
  assert.equal(result.json.error.message, "Upgrade stopped before writing anything: 4 uncommitted files conflict with it.");
  assert.deepEqual(await bytes(target, watched), filesBefore);
  assert.deepEqual(await gitState(target), before);

  const text = await human(home, target);
  assert.equal(text.code, 5);
  assert.equal(text.stderr, [
    "error: Upgrade stopped before writing anything: 4 uncommitted files conflict with it.",
    `  .agents/skills/brain-ingest/my nötes.md (untracked): ${conflicts[0].resolution}`,
    `  .claude/skills/brain-query/SKILL.md (staged): ${conflicts[1].resolution}`,
    `  areas/clients.md (untracked): ${conflicts[2].resolution}`,
    `  ${LOG} (unstaged): ${conflicts[3].resolution}`,
    "4 other uncommitted files are unrelated to the upgrade and would be left as they are.",
    "",
  ].join("\n"));

  // The dry run lists the same conflicts, exits 1 and writes nothing.
  const dry = await run(home, target, "--dry-run");
  assert.equal(dry.code, 1, dry.stdout);
  assert.equal(dry.json.data.would_refuse, "BRAIN_DIRTY");
  assert.deepEqual(dry.json.data.uncommitted, result.json.error.details);
  assert.equal(dry.json.data.commit, null);
  const dryText = await human(home, target, "--dry-run");
  assert.equal(dryText.code, 1);
  assert.match(dryText.stdout, /\nThe upgrade would stop before writing: 4 uncommitted files conflict with it\.\n {2}\.agents\/skills\/brain-ingest\/my nötes\.md \(untracked\)/);
  assert.deepEqual(await bytes(target, watched), filesBefore);
  assert.deepEqual(await gitState(target), before);
});

test("upgrade: a note that feeds no generated file is unrelated, and a committed input is no conflict", async (context) => {
  const { home, target, write } = await gitBrain(context);
  // AGENTS.md is rewritten (an old rules block), so its inputs matter; a reference note isn't one of them.
  const agents = await readFile(join(target, "AGENTS.md"), "utf8");
  await write("AGENTS.md", agents.replace(/(<!-- ultimate-brain:rules:start[^\n]*-->\n)/, "$1Old rules line.\n"));
  await write("areas/clients.md", `---\nid: ${AREA}\ntype: area\ntitle: Clients\nsummary: Client work.\nlifecycle: reviewed\n---\n`);
  await git(target, ["add", "."]);
  await git(target, ["commit", "-qm", "old rules and an area"]);
  await write("knowledge/references/draft-pricing.md", "---\nid: ref-4h7k2m9q\ntype: reference\ntitle: Pricing v2\nsummary: Draft.\nlifecycle: draft\n---\nSecond.\n");
  const result = await run(home, target);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.uncommitted, { conflicts: [], unrelated: ["knowledge/references/draft-pricing.md"] });
  assert.ok(result.json.data.files.some((file: { path: string }) => file.path === "AGENTS.md"));
  assert.match(await readFile(join(target, "AGENTS.md"), "utf8"), new RegExp(`Clients — ${AREA}`));
  assert.equal((await git(target, ["status", "--porcelain"])).trim(), "M knowledge/references/draft-pricing.md");
});

test("upgrade: rename endpoints, a file where the upgrade needs a folder, and a file .gitignore hides are conflicts", async (context) => {
  const { home, target, write } = await gitBrain(context);
  // A staged rename of a managed file: the old endpoint is recreated (changed), the new one is the user's (unrelated).
  await mkdir(join(target, "docs"), { recursive: true });
  await git(target, ["mv", "CLAUDE.md", "docs/claude notes.md"]);
  // The log file is a folder holding the user's file: the upgrade needs a file there.
  await rm(join(target, LOG));
  await git(target, ["commit", "-qm", "no log this month", "--", LOG]);
  await write(`${LOG}/scratch.txt`, "mine\n");
  // The sub-agent is created, but .gitignore hides it.
  await rm(join(target, ".claude/agents/ultimate-assistant.md"));
  await git(target, ["commit", "-qm", "no sub-agent", "--", ".claude/agents/ultimate-assistant.md"]);
  await write(".gitignore", `${await readFile(join(target, ".gitignore"), "utf8")}.claude/agents/\n`);
  await git(target, ["commit", "-qm", "ignore agents", "--", ".gitignore"]);
  const before = await gitState(target);

  const result = await run(home, target);
  assert.equal(result.json.error.code, "BRAIN_DIRTY", result.stdout);
  assert.deepEqual(result.json.error.details.conflicts.map((conflict: { path: string; state: string; reason: string; affects: string[] }) => [conflict.path, conflict.state, conflict.reason, conflict.affects]), [
    [".claude/agents/ultimate-assistant.md", "ignored", "ignored", [".claude/agents/ultimate-assistant.md"]],
    ["CLAUDE.md", "staged", "changed", ["CLAUDE.md"]],
    [`${LOG}/scratch.txt`, "untracked", "collision", [LOG]],
  ]);
  assert.equal(result.json.error.details.conflicts[0].resolution, "Your .gitignore ignores this file, so the upgrade can't commit it. Remove the rule that ignores it.");
  assert.equal(result.json.error.details.conflicts[1].resolution, "The upgrade creates this file. Commit your change first (Git keeps your version), or move the file somewhere else.");
  assert.equal(result.json.error.details.conflicts[2].resolution, `The upgrade needs ${LOG} here. Move this file somewhere else.`);
  assert.deepEqual(result.json.error.details.unrelated, ["docs/claude notes.md"]);
  assert.deepEqual(await gitState(target), before);
  assert.ok(!existsSync(join(target, ".claude/agents/ultimate-assistant.md")));
});

test("upgrade refuses GIT_OPERATION_IN_PROGRESS during a merge, and the dry run reports it", async (context) => {
  const { home, target } = await gitBrain(context);
  const base = (await git(target, ["branch", "--show-current"])).trim();
  await git(target, ["checkout", "-qb", "other"]);
  await writeFile(join(target, "notes.txt"), "theirs\n");
  await git(target, ["add", "notes.txt"]);
  await git(target, ["commit", "-qm", "theirs"]);
  await git(target, ["checkout", "-q", base]);
  await writeFile(join(target, "notes.txt"), "ours\n");
  await git(target, ["add", "notes.txt"]);
  await git(target, ["commit", "-qm", "ours"]);
  await git(target, ["merge", "other"]).catch(() => undefined);
  const index = await git(target, ["ls-files", "-s"]);

  const result = await run(home, target);
  assert.equal(result.json.error.code, "GIT_OPERATION_IN_PROGRESS", result.stdout);
  assert.equal(result.code, 5);
  assert.equal(result.json.error.message, "Git is in the middle of a merge. Finish it or abort it, then run brain upgrade again.");
  assert.equal(await readFile(join(target, SKILL), "utf8"), "drift\n");
  assert.equal(await git(target, ["ls-files", "-s"]), index);

  const dry = await run(home, target, "--dry-run");
  assert.equal(dry.code, 1);
  assert.equal(dry.json.data.would_refuse, "GIT_OPERATION_IN_PROGRESS");
  assert.equal(dry.json.data.uncommitted, null);

  // An unmerged entry alone (the merge state gone) still refuses.
  await rm(join(target, ".git/MERGE_HEAD"));
  const unmerged = await run(home, target);
  assert.equal(unmerged.json.error.code, "GIT_OPERATION_IN_PROGRESS");
  assert.equal(unmerged.json.error.message, "Git has unresolved conflicts. Finish it or abort it, then run brain upgrade again.");
});

test("upgrade refuses BRAIN_CHANGED when the brain changes between planning and writing, and writes nothing", async (context) => {
  const { home, target } = await gitBrain(context);
  context.after(() => setUpgradeHooksForTests({}));
  setUpgradeHooksForTests({ afterPlanning: async () => { await writeFile(join(target, "late.txt"), "late\n"); } });
  const result = await run(home, target);
  assert.equal(result.json.error.code, "BRAIN_CHANGED", result.stdout);
  assert.equal(result.json.error.message, "The brain changed while the upgrade was planning (late.txt). Nothing was written; run brain upgrade again.");
  assert.equal(await readFile(join(target, SKILL), "utf8"), "drift\n");

  setUpgradeHooksForTests({ afterPlanning: async () => { await writeFile(join(target, "knowledge/references/draft-pricing.md"), "---\nid: ref-4h7k2m9q\ntype: reference\ntitle: P\nsummary: D.\nlifecycle: draft\n---\nNew.\n"); } });
  const edited = await run(home, target);
  assert.equal(edited.json.error.code, "BRAIN_CHANGED");
  assert.match(edited.json.error.message, /\(knowledge\/references\/draft-pricing\.md\)/);
  assert.equal(await readFile(join(target, SKILL), "utf8"), "drift\n");
});

test("a commit Git refuses undoes the upgrade's writes and keeps the user's staged work: UPGRADE_NOT_COMMITTED", async (context) => {
  const { home, target, write } = await gitBrain(context);
  const paths = await unrelatedWork(target, write);
  const hook = join(target, ".git/hooks/pre-commit");
  await writeFile(hook, "#!/bin/sh\necho 'pre-commit says no' >&2\nexit 1\n");
  await chmod(hook, 0o755);
  const watched = [...paths, SKILL, LOG, ".claude/skills/brain-query/SKILL.md"];
  const filesBefore = await bytes(target, watched);
  const before = await gitState(target);

  const result = await run(home, target);
  assert.equal(result.json.error.code, "UPGRADE_NOT_COMMITTED", result.stdout);
  assert.equal(result.code, 5);
  assert.equal(result.json.error.message, "Git didn't commit the upgrade (pre-commit says no). Nothing of the upgrade was kept, and your own changes are untouched. Fix the cause, then run brain upgrade again.");
  assert.deepEqual(await bytes(target, watched), filesBefore);
  assert.deepEqual(await gitState(target), before);

  // HEAD moving before the commit is refused the same way.
  await rm(hook);
  context.after(() => setUpgradeHooksForTests({}));
  // Another commit lands on HEAD without touching the index (a plain `git commit` would take the user's staged work).
  setUpgradeHooksForTests({ beforeCommit: async () => {
    const commit = (await git(target, ["commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "elsewhere"])).trim();
    await git(target, ["update-ref", "HEAD", commit]);
  } });
  const moved = await run(home, target);
  assert.equal(moved.json.error.code, "UPGRADE_NOT_COMMITTED", moved.stdout);
  assert.match(moved.json.error.message, /^Git didn't commit the upgrade \(HEAD moved since the upgrade planned\)\./);
  assert.deepEqual(await bytes(target, watched), filesBefore);
  assert.equal(await git(target, ["ls-files", "-s"]), before.index);
  setUpgradeHooksForTests({});

  // Once the cause is gone, the next upgrade commits what the refused one would have.
  const retry = await run(home, target);
  assert.equal(retry.code, 0, retry.stdout);
  assert.ok(retry.json.data.commit);
  assert.equal(await git(target, ["diff", "--cached", "--binary", "--", "knowledge/references/staged.md", "notes.txt"]) !== "", true);
});

test("upgrade in a brain inside a larger repository: work outside the brain is never related, and a refused commit restores the index", async (context) => {
  const home = await mkdtemp(join(tmpdir(), "brain-uncommitted-outer-"));
  context.after(() => rm(home, { recursive: true, force: true }));
  const target = join(home, "repo", "my brain");
  assert.equal((await initCopy(target, { now: NOW })).code, 0);
  const outer = join(home, "repo");
  await git(outer, ["init", "-q"]);
  await git(outer, ["config", "user.name", "Test"]);
  await git(outer, ["config", "user.email", "test@example.test"]);
  await writeFile(join(outer, "outside.txt"), "one\n");
  await git(outer, ["add", "."]);
  await git(outer, ["commit", "-qm", "init"]);
  await writeFile(join(target, SKILL), "drift\n");
  await git(outer, ["commit", "-qam", "drift"]);
  await writeFile(join(outer, "outside.txt"), "two\n");
  await git(outer, ["add", "outside.txt"]);
  await writeFile(join(target, "inside.txt"), "mine\n");
  await git(target, ["add", "inside.txt"]);
  const hook = join(outer, ".git/hooks/pre-commit");
  await writeFile(hook, "#!/bin/sh\nexit 1\n");
  await chmod(hook, 0o755);
  const before = await gitState(outer);

  const refused = await run(home, target);
  assert.equal(refused.json.error.code, "UPGRADE_NOT_COMMITTED", refused.stdout);
  assert.deepEqual(await gitState(outer), before);
  assert.equal(await readFile(join(target, SKILL), "utf8"), "drift\n");

  await rm(hook);
  const result = await run(home, target);
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(result.json.data.uncommitted, { conflicts: [], unrelated: ["inside.txt"] });
  const committed = (await git(outer, ["show", "--name-only", "--format=", "HEAD"])).trim().split("\n");
  assert.ok(committed.every((path) => path.startsWith("my brain/")), committed.join(","));
  assert.ok(committed.includes(`my brain/${SKILL}`));
  assert.equal((await git(outer, ["diff", "--cached", "--name-only"])).trim().split("\n").sort().join(","), "my brain/inside.txt,outside.txt");
});

test("upgrade: a concept it moves and a note feeding the rebuilt index.md conflict; a body-only edit of another note doesn't", async (context) => {
  const { home, target, write } = await gitBrain(context);
  await write("knowledge/concepts/flywheel.md", "---\nid: con-5t8w2y6z\ntype: concept\ntitle: Flywheel\nsummary: A loop.\nlifecycle: draft\n---\nText.\n");
  await git(target, ["add", "."]);
  await git(target, ["commit", "-qm", "a concept"]);
  await write("knowledge/concepts/flywheel.md", "---\nid: con-5t8w2y6z\ntype: concept\ntitle: Flywheel\nsummary: A loop.\nlifecycle: draft\n---\nMy edit.\n");
  // The index lists titles and summaries: a new title changes it, a new body doesn't.
  await write("knowledge/references/draft-pricing.md", "---\nid: ref-4h7k2m9q\ntype: reference\ntitle: Pricing v2\nsummary: Draft.\nlifecycle: draft\n---\nFirst.\n");
  await write("knowledge/references/staged.md", "---\nid: ref-8n3p6r2t\ntype: reference\ntitle: Staged\nsummary: Staged.\nlifecycle: draft\n---\nBody only.\n");
  const before = await gitState(target);

  const result = await run(home, target);
  assert.equal(result.json.error.code, "BRAIN_DIRTY", result.stdout);
  assert.deepEqual(result.json.error.details.conflicts.map((conflict: { path: string; reason: string; affects: string[]; resolution: string }) => [conflict.path, conflict.reason, conflict.affects, conflict.resolution]), [
    ["knowledge/concepts/flywheel.md", "changed", ["knowledge/concepts/flywheel.md"], "The upgrade moves this file. Commit your change first (Git keeps your version), or move the file somewhere else."],
    ["knowledge/references/draft-pricing.md", "input", ["index.md"], "index.md is built from this file. Commit your change first, or undo it."],
  ]);
  assert.deepEqual(result.json.error.details.unrelated, ["knowledge/references/staged.md"]);
  assert.deepEqual(await gitState(target), before);
  assert.ok(existsSync(join(target, "knowledge/concepts/flywheel.md")));
});
