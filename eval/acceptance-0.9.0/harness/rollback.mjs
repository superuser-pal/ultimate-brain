// Usage: node rollback.mjs <install dir> (made by install.sh). The 0.9.0 acceptance's rollback (CC-107,
// spec/skills-delivery.md §8, docs/skills-migration-plan.md step 7), in <install dir>/rollback only:
//   1. ultimate-brain@0.8.1 from npm, installed globally into <dir>/rollback/prefix; a synthetic brain made by it,
//      with knowledge (the Acme fixture's notes) and configuration, committed.
//   2. The installation manifest M0: the global package version, the brain's skills.lock.json, every file under the
//      brain's .agents/skills and .claude/skills and under HOME's skill folders, with their hashes.
//   3. The packed 0.9.0 installed over it; `brain upgrade`; M1.
//   4. Rollback per §8: `git revert <upgrade commit>`, `npm install -g ultimate-brain@<previous version>`; M2.
//   5. Checks: M2 equals M0; knowledge and configuration unchanged; `brain lint` exits 0.
// Prints one JSON report on stdout.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "pkg", "ultimate-brain-0.9.0.tgz"))) { console.error("usage: node rollback.mjs <install dir>"); process.exit(2); }
const root = join(dir, "rollback");
if (existsSync(root)) { console.error(`${root} exists`); process.exit(2); }
const fixture = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "tests", "fixtures", "brain-acme");
const prefix = join(root, "prefix"), brain = join(root, "brain"), home = join(dir, "home");
mkdirSync(root, { recursive: true });
const env = { ...process.env, HOME: home, npm_config_cache: join(dir, "npm-cache"), npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false", PATH: `${join(prefix, "bin")}:${process.env.PATH}`, BRAIN_DIR: brain };
const run = (cmd, args, opts = {}) => {
  try { return { code: 0, out: execFileSync(cmd, args, { env, cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }) }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
};
const must = (cmd, args, opts) => { const r = run(cmd, args, opts); if (r.code !== 0) throw new Error(`${cmd} ${args.join(" ")} → ${r.code}\n${r.out}`); return r.out; };
const brainJson = (args) => { const r = run("brain", [...args, "--brain", brain, "--json"]); return { code: r.code, json: JSON.parse(r.out) }; };
const git = (...args) => must("git", ["-C", brain, ...args]).trim();
const hash = (file) => `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
const tree = (base) => {
  const out = {};
  const walk = (d) => { if (!existsSync(d)) return; for (const name of readdirSync(d).sort()) { const p = join(d, name); if (statSync(p).isDirectory()) walk(p); else out[relative(base, p)] = hash(p); } };
  walk(base); return out;
};
const globalVersion = () => JSON.parse(must("npm", ["ls", "-g", "--prefix", prefix, "--json", "--depth", "0"])).dependencies?.["ultimate-brain"]?.version ?? null;
const manifest = () => ({
  package: globalVersion(),
  lock: existsSync(join(brain, "skills.lock.json")) ? readFileSync(join(brain, "skills.lock.json"), "utf8") : null,
  brain_skills: { ".agents/skills": tree(join(brain, ".agents", "skills")), ".claude/skills": tree(join(brain, ".claude", "skills")) },
  home_skills: { "~/.claude/skills": tree(join(home, ".claude", "skills")), "~/.agents/skills": tree(join(home, ".agents", "skills")), "~/.codex/skills": tree(join(home, ".codex", "skills")) },
});
const knowledge = () => {
  const all = tree(brain);
  return Object.fromEntries(Object.entries(all).filter(([p]) => !p.startsWith(".git/") && !p.startsWith(".agents/") && !p.startsWith(".claude/skills/") && p !== "skills.lock.json" && p !== "AGENTS.md" && !p.startsWith("log/")));
};
const report = { steps: [], checks: {} };
const step = (name, data) => report.steps.push({ name, ...data });

// 1. 0.8.1 from npm and a brain it made.
must("npm", ["install", "-g", "--silent", "--prefix", prefix, "ultimate-brain@0.8.1"]);
step("install 0.8.1", { version: must("brain", ["--version"]).trim() });
const init = brainJson(["init", brain]);
step("brain init (0.8.1)", { ok: init.json.ok });
for (const folder of ["areas", "projects", "knowledge", "people", "orgs", "meetings", "sources", "goals", "proposals"]) {
  if (existsSync(join(fixture, folder))) cpSync(join(fixture, folder), join(brain, folder), { recursive: true });
}
must("brain", ["config", "set", "settings.publish", '"auto"', "--brain", brain, "--json"]);
must("brain", ["config", "set", "owner.name", '"Alex Example"', "--brain", brain, "--json"]);
must("brain", ["index", "--brain", brain, "--json"]);
must("brain", ["views", "--brain", brain, "--json"]);
git("add", "-A"); git("-c", "user.email=eval@acme.example", "-c", "user.name=Eval", "commit", "-q", "-m", "knowledge and configuration");
const lint0 = brainJson(["lint"]);
step("lint (0.8.1, before)", { code: lint0.code, errors: lint0.json.data?.errors ?? null });
const M0 = manifest(), K0 = knowledge(), C0 = readFileSync(join(brain, "brain.json"), "utf8");

// 2. The packed 0.9.0 over it, and the upgrade.
must("npm", ["install", "-g", "--silent", "--prefix", prefix, join(dir, "pkg", "ultimate-brain-0.9.0.tgz")]);
step("install packed 0.9.0", { version: must("brain", ["--version"]).trim() });
const statusBefore = brainJson(["status"]);
step("status before upgrade (0.9.0)", { skills: statusBefore.json.data.skills });
const up = run("brain", ["upgrade", "--brain", brain, "--json"], { env: { ...env, GIT_AUTHOR_NAME: "Eval", GIT_AUTHOR_EMAIL: "eval@acme.example", GIT_COMMITTER_NAME: "Eval", GIT_COMMITTER_EMAIL: "eval@acme.example" } });
const upJson = JSON.parse(up.out);
const upgradeCommit = git("rev-parse", "HEAD");
step("brain upgrade (0.9.0)", { code: up.code, ok: upJson.ok, skills: upJson.data?.skills, files: upJson.data?.files?.length, warnings: upJson.warnings, commit: git("log", "-1", "--format=%s") });
const statusAfter = brainJson(["status"]);
step("status after upgrade", { skills: statusAfter.json.data.skills });
const M1 = manifest();

// 3. Rollback, §8: revert the upgrade commit, reinstall the previous CLI.
const previous = upJson.data?.skills?.previous_cli ?? null;
step("previous_cli reported by the upgrade", { previous_cli: previous, used: previous ?? M0.package });
git("-c", "user.email=eval@acme.example", "-c", "user.name=Eval", "revert", "--no-edit", upgradeCommit);
must("npm", ["install", "-g", "--silent", "--prefix", prefix, `ultimate-brain@${previous ?? M0.package}`]);
step("after rollback", { version: must("brain", ["--version"]).trim(), head: git("log", "-1", "--format=%s") });
const lint2 = brainJson(["lint"]);
step("lint after rollback", { code: lint2.code, errors: lint2.json.data?.errors ?? null, warnings: lint2.json.data?.warnings ?? null });
const M2 = manifest(), K2 = knowledge(), C2 = readFileSync(join(brain, "brain.json"), "utf8");

report.checks = {
  "upgrade pinned ultimate-brain 0.9.0": statusAfter.json.data.skills?.state === "pinned" && statusAfter.json.data.skills?.name === "ultimate-brain" && statusAfter.json.data.skills?.version === "0.9.0",
  "manifest changed by the upgrade": JSON.stringify(M1) !== JSON.stringify(M0),
  "manifest after rollback equals before": JSON.stringify(M2) === JSON.stringify(M0),
  "knowledge unchanged": JSON.stringify(K2) === JSON.stringify(K0),
  "configuration unchanged": C2 === C0,
  "lint exits 0 after rollback": lint2.code === 0,
  "git tree clean": git("status", "--porcelain") === "",
};
report.manifest_diff = Object.keys(M0).filter((k) => JSON.stringify(M0[k]) !== JSON.stringify(M2[k]));
report.counts = { knowledge_files: Object.keys(K0).length, skill_files_before: Object.keys(M0.brain_skills[".agents/skills"]).length, skill_files_pinned: Object.keys(M1.brain_skills[".agents/skills"]).length };
console.log(JSON.stringify(report, null, 2));
process.exit(Object.values(report.checks).every(Boolean) ? 0 : 1);
