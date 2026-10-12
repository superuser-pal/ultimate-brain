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
  const lint = await exec("npx", ["--no-install", "ultimate-brain", "lint", "--brain", "brain", "--json"], { cwd: temp });
  assert.equal(JSON.parse(lint.stdout).ok, true);
  for (const command of ["status", "index"]) {
    const result = await exec("npx", ["--no-install", "ultimate-brain", command, "--brain", "brain", "--json"], { cwd: temp });
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
  process.stdout.write("Packed CLI initializes and lints a brain successfully.\n");
} finally {
  if (tarball !== undefined) await rm(tarball, { force: true });
  await rm(temp, { recursive: true, force: true });
}
