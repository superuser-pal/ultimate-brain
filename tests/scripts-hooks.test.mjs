// The pre-commit hook, and the git environment the scripts' tests run in (CC-230).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test, source, run, command } from "./scripts-helpers.mjs";

test("a commit in the release scripts' tests starts no background git maintenance (CC-230)", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-git-env-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  command(root, ["init", "-q", "-b", "main"]);
  writeFileSync(join(root, "note.md"), "one\n");
  command(root, ["add", "-A"]);
  const commit = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "one"], { cwd: root, encoding: "utf8", env: { ...process.env, GIT_TRACE: "1" } });
  assert.equal(commit.status, 0, commit.stderr);
  assert.match(commit.stderr, /trace: built-in: git commit/);
  assert.doesNotMatch(commit.stderr, /maintenance run/);
});

test("the pre-commit hook refuses a staged edit of a vendored skill file and accepts a whole vendored release (skills-delivery §9.3)", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-hook-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ["scripts", "src", "spec", ".githooks", "package.json"]) execFileSync("cp", ["-R", join(source, folder), join(root, folder)]);
  execFileSync("ln", ["-s", join(source, "node_modules"), join(root, "node_modules")]);
  command(root, ["init", "-q", "-b", "main"]);
  command(root, ["add", "-A"]);
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--no-verify", "-m", "base"]);
  const hook = () => spawnSync("sh", [".githooks/pre-commit"], { cwd: root, encoding: "utf8", env: { ...process.env, HOME: root } });
  execFileSync("cp", ["-R", join(source, ".agents"), join(root, ".agents")]);
  command(root, ["add", ".agents"]);
  const accepted = hook();
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--no-verify", "-m", "vendor"]);
  const skill = join(root, ".agents", "skills", "brain-howto", "SKILL.md");
  writeFileSync(skill, `${readFileSync(skill, "utf8")}\nOne more line.\n`);
  command(root, ["add", ".agents"]);
  const refused = hook();
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /^\.agents\/skills is not a released ultimate-brain-skills snapshot \(file-mismatch: brain-howto\/SKILL\.md\)\. Skills are written in the fork; restore with git checkout -- \.agents\/skills/m);
});

test("the pre-commit hook refuses a commit on a detached HEAD, but not during a rebase (CC-303)", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ultimate-brain-hook-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ["scripts", "src", "spec", ".githooks", "package.json"]) execFileSync("cp", ["-R", join(source, folder), join(root, folder)]);
  execFileSync("ln", ["-s", join(source, "node_modules"), join(root, "node_modules")]);
  command(root, ["init", "-q", "-b", "main"]);
  command(root, ["add", "-A"]);
  command(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--no-verify", "-m", "base"]);
  const hook = () => spawnSync("sh", [".githooks/pre-commit"], { cwd: root, encoding: "utf8", env: { ...process.env, HOME: root } });
  assert.equal(hook().status, 0);
  command(root, ["checkout", "-q", "--detach", "HEAD"]);
  const refused = hook();
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /^HEAD is detached: this commit would be on no branch\. Go back to the task branch first/);
  mkdirSync(join(root, ".git", "rebase-merge"));
  assert.equal(hook().status, 0);
  rmSync(join(root, ".git", "rebase-merge"), { recursive: true });
  command(root, ["checkout", "-q", "main"]);
  assert.equal(hook().status, 0);
});
