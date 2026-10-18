import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { access, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "ultimate-brain-package-"));
let tarball;

try {
  // Pack as a clean checkout does: no dist/ until prepack builds it (npm checks bin paths before that).
  await rm(join(root, "dist"), { recursive: true, force: true });
  const dryRun = await exec("npm", ["pack", "--dry-run"], { cwd: root, env: { ...process.env, npm_config_loglevel: "warn" } });
  assert.doesNotMatch(`${dryRun.stdout}\n${dryRun.stderr}`, /No bin file found|invalid and removed/);
  const { stdout } = await exec("npm", ["pack", "--json"], { cwd: root });
  const [packed] = JSON.parse(stdout);
  tarball = join(root, packed.filename);
  await exec("npm", ["install", "--ignore-scripts", tarball], { cwd: temp });
  const help = await exec("npx", ["--no-install", "ultimate-brain", "--help"], { cwd: temp });
  assert.match(help.stdout, /^Usage: brain /);
  const init = await exec("npx", ["--no-install", "ultimate-brain", "init", "brain", "--no-git", "--json"], { cwd: temp });
  assert.equal(JSON.parse(init.stdout).ok, true);
  await access(join(temp, "brain", "brain.json"));
  await access(join(temp, "brain", ".gitignore"));
  for (const skill of ["brain-ingest", "brain-apply", "brain-query", "brain-connect-notion", "brain-sync", "brain-notion-change"]) {
    await access(join(temp, "brain", ".agents", "skills", skill, "SKILL.md"));
  }
  const lint = await exec("npx", ["--no-install", "ultimate-brain", "lint", "--brain", "brain", "--json"], { cwd: temp });
  assert.equal(JSON.parse(lint.stdout).ok, true);
  const upgrade = await exec("npx", ["--no-install", "ultimate-brain", "upgrade", "--brain", "brain", "--json"], { cwd: temp });
  assert.deepEqual(JSON.parse(upgrade.stdout).data.files, []);
  for (const command of ["status", "index"]) {
    const result = await exec("npx", ["--no-install", "ultimate-brain", command, "--brain", "brain", "--json"], { cwd: temp });
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
  process.stdout.write("Packed CLI initializes, lints and upgrades a brain successfully.\n");
} finally {
  if (tarball !== undefined) await rm(tarball, { force: true });
  await rm(temp, { recursive: true, force: true });
}
