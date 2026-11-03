import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
  // HOME is a temp folder, so the user's global skill folders never show up as competing copies (spec/skills-delivery.md §5.2).
  const home = join(temp, "home");
  await mkdir(home);
  const env = { ...process.env, HOME: home };
  // Pinned skills (spec/skills-delivery.md §12.3): the packed manifest is valid and compatible with the packed version.
  const installed = join(temp, "node_modules", "ultimate-brain");
  const { validateSnapshot } = await import(pathToFileURL(join(installed, "dist", "lib", "skills-snapshot.js")).href);
  const { satisfies } = await import(pathToFileURL(join(installed, "dist", "lib", "skills-range.js")).href);
  const packedVersion = JSON.parse(await readFile(join(installed, "package.json"), "utf8")).version;
  const shipped = validateSnapshot(join(installed, ".agents", "skills"));
  assert.equal(shipped.reason, null, `packed snapshot: ${shipped.reason}`);
  assert.ok(satisfies(packedVersion, shipped.manifest.cli), `packed snapshot range ${shipped.manifest.cli} excludes ${packedVersion}`);
  const help = await exec("npx", ["--no-install", "ultimate-brain", "--help"], { cwd: temp, env });
  assert.match(help.stdout, /^Usage: brain /);
  const init = await exec("npx", ["--no-install", "ultimate-brain", "init", "brain", "--no-git", "--json"], { cwd: temp, env });
  assert.equal(JSON.parse(init.stdout).ok, true);
  const lock = JSON.parse(await readFile(join(temp, "brain", "skills.lock.json"), "utf8"));
  assert.deepEqual(lock.snapshot, shipped.manifest);
  const status = await exec("npx", ["--no-install", "ultimate-brain", "status", "--brain", "brain", "--json"], { cwd: temp, env });
  assert.equal(JSON.parse(status.stdout).data.skills.state, "pinned");
  await access(join(temp, "brain", "brain.json"));
  await access(join(temp, "brain", ".gitignore"));
  for (const skill of ["brain-ingest", "brain-apply", "brain-query", "brain-connect-notion", "brain-sync", "brain-notion-change"]) {
    await access(join(temp, "brain", ".agents", "skills", skill, "SKILL.md"));
  }
  const lint = await exec("npx", ["--no-install", "ultimate-brain", "lint", "--brain", "brain", "--json"], { cwd: temp, env });
  assert.equal(JSON.parse(lint.stdout).ok, true);
  const upgrade = await exec("npx", ["--no-install", "ultimate-brain", "upgrade", "--brain", "brain", "--json"], { cwd: temp, env });
  assert.deepEqual(JSON.parse(upgrade.stdout).data.files, []);
  for (const command of ["status", "index"]) {
    const result = await exec("npx", ["--no-install", "ultimate-brain", command, "--brain", "brain", "--json"], { cwd: temp, env });
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
  process.stdout.write("Packed CLI initializes, pins, lints and upgrades a brain successfully.\n");
} finally {
  if (tarball !== undefined) await rm(tarball, { force: true });
  await rm(temp, { recursive: true, force: true });
}
