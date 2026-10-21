import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { command, fail, ROOT } from "./common.mjs";

// Build a brain for a skill's blind run (CC-41): a copy of a test fixture with this repo's skills,
// no Notion ids in brain.json, and one commit. A dev script; not in the npm package.
const [fixture, target] = process.argv.slice(2);
const fixtures = resolve(ROOT, "tests/fixtures");
if (fixture === undefined || target === undefined || process.argv.length > 4) {
  fail("Usage: node scripts/blind-brain.mjs <fixture> <dir>");
} else if (!/^[a-z0-9-]+$/.test(fixture) || !existsSync(join(fixtures, fixture, "brain.json"))) {
  fail(`No fixture brain ${fixture} in tests/fixtures/ (one with a brain.json)`);
} else if (existsSync(target) && (!statSync(target).isDirectory() || readdirSync(target).length > 0)) {
  fail(`${target} already exists and isn't an empty folder`);
} else {
  const dir = resolve(target);
  cpSync(join(fixtures, fixture), dir, { recursive: true });
  // The shipped skills and AGENTS.md, as tests/helpers.ts fixtureCopy installs them.
  for (const skills of [".agents/skills", ".claude/skills"]) {
    rmSync(join(dir, skills), { recursive: true, force: true });
    cpSync(join(ROOT, ".agents/skills"), join(dir, skills), { recursive: true });
  }
  cpSync(join(ROOT, "templates/brain/AGENTS.md"), join(dir, "AGENTS.md"));

  const configPath = join(dir, "brain.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const blanked = [];
  for (const key of Object.keys(config.notion?.databases ?? {})) {
    if (config.notion.databases[key] !== "") blanked.push(`notion.databases.${key}`);
    config.notion.databases[key] = "";
  }
  if (config.notion?.tasks !== undefined) {
    if (config.notion.tasks.database !== "") blanked.push("notion.tasks.database");
    config.notion.tasks.database = "";
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  command("git", ["init", "-q", "-b", "main"], { cwd: dir });
  command("git", ["add", "-A"], { cwd: dir });
  command("git", ["-c", "user.name=Blind run", "-c", "user.email=blind-run@brain.example", "commit", "-q", "-m", `Blind-run brain from ${fixture}`], { cwd: dir });
  process.stdout.write(`${dir}\nblanked ${blanked.length} Notion id(s): ${blanked.join(", ") || "none"}\n`);
}
