import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, cp, mkdir, readdir, readFile, realpath, rm, mkdtemp, writeFile } from "node:fs/promises";
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
  // The Notion build files ship (CC-154): the checklist, every build prompt, module step and migration, and the space design.
  const notionFiles = ["notion/CHECKLIST.md", "docs/notion-space-design.md"];
  for (const folder of ["prompts", "modules", "migrations"]) {
    for (const entry of await readdir(join(root, "notion", folder))) if (entry.endsWith(".md")) notionFiles.push(`notion/${folder}/${entry}`);
  }
  const packedPaths = new Set(packed.files.map((file) => file.path));
  for (const file of notionFiles) assert.ok(packedPaths.has(file), `npm pack does not list ${file}`);
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
  // Phase B (spec/skills-delivery.md §9.1, §12.5 item 8): the fork's release, its snapshot.json, LICENSE and NOTICE.md beside the skills, nothing else.
  assert.equal(shipped.manifest.name, "ultimate-brain-skills");
  assert.deepEqual((await readdir(join(installed, ".agents", "skills"))).sort(), [...shipped.manifest.skills.map((skill) => skill.name), "LICENSE", "NOTICE.md", "snapshot.json"].sort());
  const help = await exec("npx", ["--no-install", "ultimate-brain", "--help"], { cwd: temp, env });
  assert.match(help.stdout, /^Usage: brain /);
  const init = await exec("npx", ["--no-install", "ultimate-brain", "init", "brain", "--no-git", "--json"], { cwd: temp, env });
  assert.equal(JSON.parse(init.stdout).ok, true);
  const lock = JSON.parse(await readFile(join(temp, "brain", "skills.lock.json"), "utf8"));
  assert.deepEqual(lock.snapshot, shipped.manifest);
  assert.equal(lock.snapshot.name, "ultimate-brain-skills");
  const status = await exec("npx", ["--no-install", "ultimate-brain", "status", "--brain", "brain", "--json"], { cwd: temp, env });
  assert.equal(JSON.parse(status.stdout).data.skills.state, "pinned");
  // product.path (spec/cli.md §5.2) is the installed package, and the Notion build files are under it.
  const productPath = JSON.parse(status.stdout).data.product.path;
  assert.equal(productPath, await realpath(installed));
  for (const file of notionFiles) await access(join(productPath, file));
  await access(join(temp, "brain", "brain.json"));
  await access(join(temp, "brain", ".gitignore"));
  // The Ultimate Assistant sub-agent ships in the template (spec/assistant.md §10).
  await access(join(temp, "brain", ".claude", "agents", "ultimate-assistant.md"));
  for (const skill of ["brain-ingest", "brain-apply", "brain-query", "brain-connect-notion", "brain-sync", "brain-notion-change"]) {
    await access(join(temp, "brain", ".agents", "skills", skill, "SKILL.md"));
  }
  const lint = await exec("npx", ["--no-install", "ultimate-brain", "lint", "--brain", "brain", "--json"], { cwd: temp, env });
  assert.equal(JSON.parse(lint.stdout).ok, true);
  const upgrade = await exec("npx", ["--no-install", "ultimate-brain", "upgrade", "--brain", "brain", "--json"], { cwd: temp, env });
  assert.deepEqual(JSON.parse(upgrade.stdout).data.files, []);
  // DOCUMENTS_TURNED_ON (spec/cli.md §5.15 step 5) names a migration file that exists in the packed install.
  await exec("npx", ["--no-install", "ultimate-brain", "init", "reports-brain", "--no-git", "--json"], { cwd: temp, env });
  const reportsConfig = JSON.parse(await readFile(join(temp, "reports-brain", "brain.json"), "utf8"));
  reportsConfig.modules = { ...reportsConfig.modules, documents: false, reports: true };
  await writeFile(join(temp, "reports-brain", "brain.json"), `${JSON.stringify(reportsConfig, null, 2)}\n`);
  const turnedOn = JSON.parse((await exec("npx", ["--no-install", "ultimate-brain", "upgrade", "--brain", "reports-brain", "--json"], { cwd: temp, env })).stdout);
  const documentsWarning = turnedOn.warnings.find((warning) => warning.code === "DOCUMENTS_TURNED_ON");
  assert.ok(documentsWarning !== undefined, JSON.stringify(turnedOn.warnings));
  const named = documentsWarning.message.slice(documentsWarning.message.lastIndexOf(": ") + 2);
  assert.equal(named, join(productPath, "notion", "migrations", "0019-reports-move-to-documents.md"));
  await access(named);
  for (const command of ["status", "index"]) {
    const result = await exec("npx", ["--no-install", "ultimate-brain", command, "--brain", "brain", "--json"], { cwd: temp, env });
    assert.equal(JSON.parse(result.stdout).ok, true);
  }
  // The generic starter ships with the package and resolves from dist/ (spec/linked-repos.md §7).
  await mkdir(join(temp, "brain", "areas"), { recursive: true });
  await cp(join(root, "tests", "fixtures", "brain-acme", "areas", "clients.md"), join(temp, "brain", "areas", "clients.md"));
  const kit = { kit_version: 1, name: "starter-check", placement: { area: "area-2m7c4h8n" }, knowledge: { patterns: ["decisions/**", "docs/**", "README.md"], never_read: [".env*", "secrets/**"] }, tasks: { mode: "tracked-in-repo", source: { kind: "markdown", path: "TASKS.md", format: "checklist" } }, methodology: { summary: "Record decisions in decisions/ before acting on them; plans in docs/; tasks in TASKS.md." } };
  const written = `${JSON.stringify({ ...kit, starter: { name: "generic", version: packedVersion } }, null, 2)}\n`;
  await writeFile(join(temp, "kit.json"), JSON.stringify(kit));
  const confirm = `sha256:${createHash("sha256").update(written).digest("hex")}`;
  const started = await exec("npx", ["--no-install", "ultimate-brain", "repo", "new", "--brain", "brain", "--path", join(temp, "starter"), "--starter", "generic", "--input", "kit.json", "--confirm", confirm, "--json"], { cwd: temp, env });
  assert.deepEqual(JSON.parse(started.stdout).data.files, [".gitignore", "AGENTS.md", "CLAUDE.md", "README.md", "TASKS.md", "brain-kit.json", "decisions/_template.md", "docs/README.md"]);
  assert.equal(await readFile(join(temp, "starter", "brain-kit.json"), "utf8"), written);
  process.stdout.write("Packed CLI initializes, pins, lints and upgrades a brain successfully.\n");
} finally {
  if (tarball !== undefined) await rm(tarball, { force: true });
  await rm(temp, { recursive: true, force: true });
}
