// The sandbox a native run works in (CC-200), and what the harness reads from it. Never the user's brain: the world is
// built by make-brain.mjs under <run>/world/home, every CLI call passes --brain, and each case gets its own copy.
//
//   <run>/package/        the package under test (a copy of the tarball, or `npm pack ultimate-brain@<version>`)
//   <run>/cli/            that package installed with npm; <run>/bin holds `brain`, `node` and a failing `gh`
//   <run>/world/home/     HOME of the pristine world: memory-0.12-eval/{brain,repos} (brain.json's repo paths are
//                         `~/memory-0.12-eval/repos/<name>`, so they resolve under this HOME)
//   <run>/<agent>/<case>/ one session: its own copy of home/, its trace and summary
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const EVAL = resolve(here, "../..");
export const PRODUCT = resolve(EVAL, "../..");
export const WORLD_DIR = "memory-0.12-eval"; // brain.json's placeholder: ~/memory-0.12-eval/repos/<name>
const START = "<!-- ultimate-brain:start -->";
const END = "<!-- ultimate-brain:end -->";
const GIT_ID = { GIT_AUTHOR_NAME: "eval", GIT_AUTHOR_EMAIL: "eval@memory-eval.example", GIT_COMMITTER_NAME: "eval", GIT_COMMITTER_EMAIL: "eval@memory-eval.example", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28, ...opts });

/** Paths of one world (pristine or a case's copy) under a HOME. */
export function worldAt(home) {
  const root = join(home, WORLD_DIR);
  return { home, root, brain: join(root, "brain"), repos: join(root, "repos") };
}

/** The environment every command of a run gets: the run's bin first, no global brain, git without user config. */
export function sandboxEnv(runDir, home, extra = {}) {
  return {
    HOME: home, USER: process.env.USER ?? "eval", LOGNAME: process.env.USER ?? "eval", LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", TERM: "xterm-256color",
    PATH: `${join(runDir, "bin")}:/usr/bin:/bin:/usr/sbin:/sbin`, TMPDIR: join(home, "tmp"),
    BRAIN_DIR: worldAt(home).brain, npm_config_update_notifier: "false", NO_COLOR: "1", ...GIT_ID, ...extra,
  };
}

/** The brain CLI of the run, on a given HOME; every call names the brain. */
export function brainCli(runDir, home, args, opts = {}) {
  const r = spawnSync(join(runDir, "bin", "brain"), [...args, "--brain", worldAt(home).brain, "--json"], { encoding: "utf8", env: sandboxEnv(runDir, home), maxBuffer: 1 << 26, ...opts });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

/** Puts the package under test into <run>/package and installs it into <run>/cli; returns its identity. */
export function installPackage(runDir, spec) {
  const pkgDir = join(runDir, "package");
  mkdirSync(pkgDir, { recursive: true });
  let tarball;
  if (existsSync(spec) && spec.endsWith(".tgz")) {
    tarball = join(pkgDir, basename(spec));
    copyFileSync(spec, tarball);
  } else {
    const name = run("npm", ["pack", `ultimate-brain@${spec}`, "--pack-destination", pkgDir, "--silent"], { cwd: pkgDir }).trim().split("\n").pop();
    tarball = join(pkgDir, name);
  }
  const cli = join(runDir, "cli");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, "package.json"), JSON.stringify({ name: "native-run-cli", private: true }) + "\n");
  run("npm", ["install", "--no-audit", "--no-fund", "--silent", tarball], { cwd: cli });
  const bin = join(runDir, "bin");
  mkdirSync(bin, { recursive: true });
  const link = (target, name) => { rmSync(join(bin, name), { force: true }); symlinkSync(target, join(bin, name)); };
  link(join(cli, "node_modules", ".bin", "brain"), "brain");
  link(join(cli, "node_modules", ".bin", "ultimate-brain"), "ultimate-brain");
  link(process.execPath, "node");
  // A failing gh: no session reaches GitHub.
  writeFileSync(join(bin, "gh"), "#!/bin/sh\necho 'gh is not available in this evaluation sandbox' >&2\nexit 1\n");
  chmodSync(join(bin, "gh"), 0o755);
  const installed = join(cli, "node_modules", "ultimate-brain");
  const manifest = JSON.parse(readFileSync(join(installed, ".agents", "skills", "snapshot.json"), "utf8"));
  const version = spawnSync(join(bin, "brain"), ["--version"], { encoding: "utf8", env: { PATH: `${bin}:/usr/bin:/bin`, HOME: runDir } }).stdout.trim();
  return {
    package: { file: basename(tarball), sha256: sha256(readFileSync(tarball)), version: JSON.parse(readFileSync(join(installed, "package.json"), "utf8")).version },
    cli_version: version,
    snapshot: { name: manifest.name, version: manifest.version, integrity: manifest.integrity, source_commit: manifest.source?.commit ?? null, tag: `brain-v${manifest.version}` },
    installed,
  };
}

/** README "A run's trace and identity": the hash of the generator's output, before anything else touches it. */
export function treeHash(dir) {
  return run("sh", ["-c", "find . -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256"], { cwd: dir }).split(" ")[0];
}

/**
 * Builds the pristine world: make-brain.mjs into <run>/world/home, the brain committed (a brain is a Git repo, and
 * `apply` and `upgrade` need one), and every caller repo that has a `.brain` and no managed block linked with the
 * package's `brain link`. `scratch` (no `.brain`) stays unlinked, and a repo an older release linked (`harbor-ops`)
 * keeps its old block: only `brain upgrade` changes it (CC-185).
 */
export function buildWorld(runDir, casesFile, { installed }) {
  const home = join(runDir, "world", "home");
  const w = worldAt(home);
  mkdirSync(join(home, "tmp"), { recursive: true });
  run(process.execPath, [join(EVAL, "make-brain.mjs"), w.root, "--cases", casesFile]);
  const outputHash = treeHash(w.root);
  // The brain's skills are copied from this checkout by make-brain.mjs; they must be the package's own.
  const differs = skillFiles(join(w.brain, ".agents", "skills")).filter((rel) => !existsSync(join(installed, ".agents", "skills", rel)) || !readFileSync(join(installed, ".agents", "skills", rel)).equals(readFileSync(join(w.brain, ".agents", "skills", rel))));
  if (differs.length) throw new Error(`the brain's skills (copied from this checkout) differ from the package's (${differs.slice(0, 3).join(", ")}): pack the package from this checkout's head`);
  run("git", ["init", "-q", "-b", "main"], { cwd: w.brain, env: { ...process.env, ...GIT_ID } });
  run("git", ["add", "-A"], { cwd: w.brain, env: { ...process.env, ...GIT_ID } });
  run("git", ["commit", "-q", "-m", "synthetic brain (eval/memory-0.12)"], { cwd: w.brain, env: { ...process.env, ...GIT_ID } });
  const lint = brainCli(runDir, home, ["lint"]);
  if (!lint.json?.ok || lint.json.data.errors !== 0) throw new Error(`the synthetic brain does not lint clean: ${lint.stdout.slice(0, 300)}`);
  const linked = [];
  for (const name of readdirSync(w.repos).sort()) {
    const dir = join(w.repos, name);
    if (!existsSync(join(dir, ".brain"))) continue;
    const agents = existsSync(join(dir, "AGENTS.md")) ? readFileSync(join(dir, "AGENTS.md"), "utf8") : "";
    if (agents.includes(START)) continue;
    const r = brainCli(runDir, home, ["link", dir]);
    if (!r.json?.ok) throw new Error(`brain link ${name} failed: ${r.json?.error?.code ?? r.stderr.slice(0, 200)}`);
    linked.push(name);
  }
  return { home, outputHash, linked, lintWarnings: lint.json.data.warnings };
}

/** Every file under a skills folder, relative to it. */
function skillFiles(dir) {
  return readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? skillFiles(join(dir, name)).map((p) => join(name, p)) : [name]));
}

/**
 * A fresh copy of the pristine world for one session, under <sessionDir>/home. Claude Code on macOS keeps its login
 * in the user's keychain, which it finds through HOME, so the copy's HOME links Library/Keychains and nothing else.
 */
export function copyWorld(runDir, sessionDir, { keychain = false } = {}) {
  const home = join(sessionDir, "home");
  rmSync(home, { recursive: true, force: true });
  cpSync(join(runDir, "world", "home"), home, { recursive: true, verbatimSymlinks: true });
  mkdirSync(join(home, "tmp"), { recursive: true });
  if (keychain && process.platform === "darwin") {
    mkdirSync(join(home, "Library"), { recursive: true });
    symlinkSync(join(homedir(), "Library", "Keychains"), join(home, "Library", "Keychains"));
  }
  return worldAt(home);
}

/** Every note's id and path in a brain (harness-side; the session never sees this): { ids, pathToId, idToPath }. */
export function indexBrain(brain) {
  const ids = new Set();
  const pathToId = new Map();
  const idToPath = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === ".git" || name === ".agents" || name === ".claude") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".md")) {
        const m = /^---\n[\s\S]*?^id: ([a-z]+-[0-9a-z]{8})$/m.exec(readFileSync(p, "utf8"));
        if (m) { const rel = relative(brain, p); ids.add(m[1]); pathToId.set(rel, m[1]); idToPath.set(m[1], rel); }
      }
    }
  };
  walk(brain);
  return { ids, pathToId, idToPath };
}

/** The task ids of each linked repo's build/TASKS.md: { [repo]: [id…] }. */
export function tasksOf(repos) {
  const out = {};
  for (const name of readdirSync(repos)) {
    const file = join(repos, name, "build", "TASKS.md");
    if (existsSync(file)) out[name] = [...readFileSync(file, "utf8").matchAll(/^### ([A-Z]+-\d+) · /gm)].map((m) => m[1]);
  }
  return out;
}

const frontmatter = (text) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
const field = (fm, key) => new RegExp(`^${key}: (.+)$`, "m").exec(fm)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;

/** The proposals of a brain: { [id]: { path, text, status, closed_reason } }. */
export function proposalsOf(brain) {
  const dir = join(brain, "_proposals");
  const out = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
    const text = readFileSync(join(dir, name), "utf8");
    const fm = frontmatter(text);
    const id = field(fm, "id");
    if (id) out[id] = { path: `_proposals/${name}`, text, status: field(fm, "status"), closed_reason: field(fm, "closed_reason") };
  }
  return out;
}

/** AGENTS.md's project-owned text (outside the managed block) and the block itself, as CC-185 hashes it. */
export function splitManaged(text) {
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start || text.indexOf(START, start + 1) >= 0 || text.indexOf(END, end + 1) >= 0) return { block: null, owned: text };
  return { block: text.slice(start, end + END.length), owned: text.slice(0, start) + text.slice(end + END.length) };
}

/**
 * A repo's managed-block state after a session: "current" when its block is the one the package's `brain link` writes
 * now (checked by linking a throwaway copy of the repo), "stale" when it differs, "missing" or "damaged" otherwise.
 */
export function managedBlockState(runDir, home, repoDir) {
  const file = join(repoDir, "AGENTS.md");
  if (!existsSync(file)) return { managed_block: "missing", project_text_sha256: null };
  const text = readFileSync(file, "utf8");
  const { block, owned } = splitManaged(text);
  const hash = `sha256:${sha256(owned)}`;
  if (!text.includes(START) && !text.includes(END)) return { managed_block: "missing", project_text_sha256: hash };
  if (block === null) return { managed_block: "damaged", project_text_sha256: hash };
  const probe = join(home, "tmp", `link-probe-${basename(repoDir)}`);
  rmSync(probe, { recursive: true, force: true });
  cpSync(repoDir, probe, { recursive: true });
  const r = brainCli(runDir, home, ["link", probe]);
  const fresh = r.json?.ok ? splitManaged(readFileSync(join(probe, "AGENTS.md"), "utf8")).block : null;
  rmSync(probe, { recursive: true, force: true });
  return { managed_block: fresh === null ? "unknown" : fresh === block ? "current" : "stale", project_text_sha256: hash };
}

/**
 * What a case left behind, in score.mjs's `outcome` shape: each expected proposal's status (and the reason `brain apply`
 * reported, else the file's `closed_reason`), each target's text, the proposals written during the session, and the
 * upgraded repo's state.
 */
export function collectOutcome(runDir, w, testCase, { before, applyReports }) {
  if (!testCase.outcomes && !testCase.created_forbidden && !testCase.upgrade) return null;
  const now = proposalsOf(w.brain);
  const outcome = { proposals: {}, notes: {}, created: [], repos: {} };
  for (const o of testCase.outcomes ?? []) {
    const p = now[o.proposal];
    if (p) outcome.proposals[o.proposal] = { status: p.status, ...((applyReports[o.proposal]?.reason ?? p.closed_reason) ? { reason: applyReports[o.proposal]?.reason ?? p.closed_reason } : {}) };
    const target = join(w.brain, o.target_path);
    if (existsSync(target)) outcome.notes[o.target] = readFileSync(target, "utf8");
  }
  for (const [id, p] of Object.entries(now)) if (!before.has(id)) outcome.created.push({ id, text: p.text });
  if (testCase.upgrade) outcome.repos[testCase.upgrade.repo] = managedBlockState(runDir, w.home, join(w.repos, testCase.upgrade.repo));
  return outcome;
}

/** The commit of this checkout and whether the files a run depends on are changed (the generator, cases, scorer). */
export function checkoutIdentity() {
  const head = run("git", ["rev-parse", "HEAD"], { cwd: PRODUCT }).trim();
  const dirty = run("git", ["status", "--porcelain", "--", "eval/memory-0.12"], { cwd: PRODUCT }).trim() !== "";
  return { commit: head, dirty };
}

/**
 * Removes what a kept trace must not carry into the repo (0038's leak check and AGENTS.md): the run folder and the
 * user's home become placeholders, and UUIDs (session and message ids) and e-mail addresses are replaced.
 */
export function scrub(text, { runDir, extra = [] }) {
  let out = text;
  const roots = [...new Set([runDir, safeReal(runDir), ...extra.flatMap((p) => [p, safeReal(p)])].filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const r of roots) out = out.split(r).join(r === runDir || r === safeReal(runDir) ? "<run>" : "<agent-home>");
  out = out.split(homedir()).join("<home>");
  // `ls -l` and similar print the owner; the host name can appear in prompts and errors.
  for (const [value, mark] of [[userInfo().username, "<user>"], [hostname(), "<host>"]]) if (value && value.length > 2) out = out.replace(new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), mark);
  out = out.replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "<uuid>").replace(/\b[0-9a-f]{32}\b/gi, "<hex32>");
  out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}\b/gi, (m) => (/@([a-z0-9-]+\.)*example(\.(invalid|com|org|test))?$/i.test(m) ? m : "<email>"));
  return out;
}

function safeReal(p) {
  try { return realpathSync(p); } catch { return null; }
}
