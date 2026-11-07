import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile, rmdir, unlink } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";

import type { Command, Warning } from "../lib/command.ts";
import { planConceptConversion } from "../lib/concept-upgrade.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { isRecord } from "../lib/input.ts";
import { lintBrain } from "../lib/lint.ts";
import { modulesOf, storedModules, withModules } from "../lib/modules.ts";
import { scanNotes } from "../lib/notes.ts";
import { assertPlainPath, installedProduct, SUB_AGENT } from "../lib/skills.ts";
import { competingCopies } from "../lib/skills-competing.ts";
import { homeOf, LOCK, readLock, serializeLock, snapshotInvalid, type Lock } from "../lib/skills-pin.ts";
import { comparePrecedence } from "../lib/skills-range.ts";
import { packageProblem, packageSnapshot, serializeManifest, TREES, type Manifest } from "../lib/skills-snapshot.ts";

const exec = promisify(execFile);
const START = /^<!-- ultimate-brain:rules:start\b[^\n]*-->$/gm;
const END = /^<!-- ultimate-brain:rules:end -->$/gm;

type Action = "created" | "updated" | "removed" | "skipped";
interface Change { path: string; action: Action; content?: string | Buffer }

/** `brain upgrade` (spec/cli.md §5.15): bring the product-owned files of a brain up to the installed package. */
export const upgradeCommand: Command = {
  name: "upgrade",
  usage: "brain upgrade [--dry-run] [--json]",
  summary: "Update the brain's product-owned AGENTS.md block and skills to the installed version.",
  options: { "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  allowInvalidBrainConfig: true,
  async run({ args, brain, now, environment }) {
    const root = brain!.root;
    const product = installedProduct();
    if (product.source) throw new BrainError("UNRELEASED_BUILD", "brain upgrade requires a published ultimate-brain package");
    const warnings: Warning[] = [];
    const changes: Change[] = [];
    let unchanged = 0;

    // Every check runs before the first write, so a refusal leaves the brain untouched.
    const template = await readFile(join(product.root, "templates/brain/AGENTS.md"), "utf8");
    await assertPlainPath(root, "AGENTS.md");
    const current = await readOptional(join(root, "AGENTS.md"));
    if (current === null) changes.push({ path: "AGENTS.md", action: "created", content: template });
    else {
      const block = rulesBlock(template)!;
      const own = rulesBlock(current);
      if (own === undefined) {
        changes.push({ path: "AGENTS.md", action: "skipped" });
        warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md has no single ultimate-brain rules block; left unchanged." });
      } else if (own === block) unchanged += 1;
      else changes.push({ path: "AGENTS.md", action: "updated", content: current.replace(own, () => block) });
    }
    if (!(await exists(join(root, "CLAUDE.md")))) changes.push({ path: "CLAUDE.md", action: "created", content: "@AGENTS.md\n" });
    else unchanged += 1;
    // 0.10.0: the Ultimate Assistant sub-agent, product-owned as a whole file (spec/cli.md §5.15 step 2a).
    const agentTemplate = await readFile(join(product.root, "templates/brain", SUB_AGENT));
    await assertPlainPath(root, SUB_AGENT);
    const agentBefore = await readOptionalBuffer(join(root, SUB_AGENT));
    if (agentBefore === null) changes.push({ path: SUB_AGENT, action: "created", content: agentTemplate });
    else if (agentBefore.equals(agentTemplate)) unchanged += 1;
    else changes.push({ path: SUB_AGENT, action: "updated", content: agentTemplate });

    // 0.3.0: Inbox is the former Capture Inbox; 0.6.0: Documents are the former References (0049).
    // Keep each database id, but retire the old key. 0.6.0 also writes the modules block (0048).
    const brainJson = "brain.json";
    await assertPlainPath(root, brainJson);
    const brainText = await readOptional(join(root, brainJson));
    if (brainText !== null) {
      try {
        let config = JSON.parse(brainText) as Record<string, unknown>;
        let changed = false;
        const notion = config.notion;
        if (isRecord(notion) && isRecord(notion.databases)) {
          let databases = notion.databases;
          for (const [old, key] of [["capture_inbox", "inbox"], ["references", "documents"]] as const) {
            if (databases[old] === undefined) continue;
            databases = renameKey(databases, old, key);
            changed = true;
          }
          // 0.9.1: the Concepts database is retired (0071); its key goes, whatever its value.
          if ("concepts" in databases) {
            databases = Object.fromEntries(Object.entries(databases).filter(([name]) => name !== "concepts"));
            changed = true;
          }
          if (changed) config = { ...config, notion: { ...notion, databases } };
        }
        if (isRecord(config) && !("modules" in config)) {
          config = withModules(config, modulesOf(config));
          changed = true;
        }
        // 0.9.1: a report is a Documents row, so Reports needs Documents on (0071).
        const stored = storedModules(config);
        if (stored.reports && !stored.documents) {
          config = withModules(config, { ...stored, documents: true });
          changed = true;
          warnings.push({ code: "DOCUMENTS_TURNED_ON", message: "Reports now live in Documents, so the Documents module is on. Apply Notion migration 0019 before the next publish." });
        }
        if (changed) changes.push({ path: brainJson, action: "updated", content: `${JSON.stringify(config, null, 2)}\n` });
      } catch {
        changes.push({ path: brainJson, action: "skipped" });
        warnings.push({ code: "BRAIN_JSON_UNPARSEABLE", message: "brain.json is not valid JSON; left unchanged." });
      }
    }

    // 0.9.1 (step 5a, decision 0071): concepts become learned Documents, the links to them follow, and index.md is rebuilt.
    const scanned = await scanNotes(root);
    const indexBefore = await readOptional(join(root, "index.md"));
    const concepts = planConceptConversion(root, scanned.notes, (path) => existsSync(join(root, path)), indexBefore);
    for (const change of concepts.changes) {
      await assertPlainPath(root, change.path);
      changes.push(change);
    }
    for (const { path, links } of concepts.unresolved) {
      warnings.push({ code: "CONCEPT_LINK_UNRESOLVED", message: `${path}: ${links.join(", ")} ${links.length === 1 ? "points" : "point"} at a concept note that no longer exists, and no learned Document has its file name. Fix ${links.length === 1 ? "it" : "them"} by hand.` });
    }

    // Skills (decisions 0029, 0059): the package snapshot replaces the pinned one (spec/skills-delivery.md §6.3). Its refusals are
    // decided here and raised after the BRAIN_DIRTY check, still before any write.
    const pkg = packageSnapshot(product.root, product.version);
    const previous = readLock(root);
    await assertPlainPath(root, LOCK);
    let refusal: BrainError | undefined;
    let manifest: Manifest | undefined;
    let from: { name: string; version: string } | null = null;
    const retired: string[] = [];
    /** Skill folders to prune after the writes; `true` when the folder itself goes too (a retired skill). */
    const prune = new Map<string, boolean>();
    let lock: Lock | undefined;
    let previousCli: string | null = null;
    const problem = packageProblem(pkg);
    if (problem !== null) refusal = snapshotInvalid(problem, product.version);
    else {
      manifest = pkg.manifest!;
      const old = previous.kind === "valid" ? previous.lock : undefined;
      if (previous.kind === "invalid") warnings.push({ code: "SKILLS_LOCK_REPLACED", message: `${LOCK} was invalid (${previous.reason}) and was replaced.` });
      if (old !== undefined) {
        from = { name: old.snapshot.name, version: old.snapshot.version };
        if (old.snapshot.name === manifest.name) {
          const order = comparePrecedence(old.snapshot.version, manifest.version);
          if (order > 0) {
            refusal = new BrainError("SKILLS_DOWNGRADE", `This brain pins ${manifest.name} ${old.snapshot.version}; this CLI ships the older ${manifest.version}. Install ultimate-brain@${old.installed_by}, or roll back as docs/releasing.md says.`, { name: manifest.name, pinned: old.snapshot.version, shipped: manifest.version, installed_by: old.installed_by });
          } else if (order === 0 && serializeManifest(old.snapshot) !== serializeManifest(manifest)) {
            refusal = snapshotInvalid("same version, different content", product.version);
          }
        }
      }
      if (refusal === undefined) {
        const names = new Set(manifest.skills.map((skill) => skill.name));
        for (const tree of TREES) {
          for (const skill of manifest.skills) {
            const folder = `${tree}/${skill.name}`;
            await assertPlainPath(root, folder, "folder");
            prune.set(folder, false);
            const listed = new Set(skill.files.map((file) => file.path));
            for (const file of skill.files) {
              const path = `${folder}/${file.path}`;
              await assertPlainPath(root, path);
              const content = await readFile(join(pkg.folder, skill.name, file.path));
              const existing = await readOptionalBuffer(join(root, path));
              if (existing === null) changes.push({ path, action: "created", content });
              else if (existing.equals(content)) unchanged += 1;
              else changes.push({ path, action: "updated", content });
            }
            for (const file of await listFiles(join(root, folder))) {
              await assertPlainPath(root, `${folder}/${file}`);
              if (!listed.has(file)) changes.push({ path: `${folder}/${file}`, action: "removed" });
            }
          }
          // A skill the old (valid) lock names and the new snapshot doesn't is retired: its product-owned folder goes, whatever it holds.
          for (const skill of old?.snapshot.skills ?? []) {
            if (names.has(skill.name)) continue;
            const folder = `${tree}/${skill.name}`;
            await assertPlainPath(root, folder, "folder");
            if (!(await exists(join(root, folder)))) continue;
            prune.set(folder, true);
            for (const file of await listFiles(join(root, folder))) {
              await assertPlainPath(root, `${folder}/${file}`);
              changes.push({ path: `${folder}/${file}`, action: "removed" });
            }
          }
        }
        retired.push(...(old?.snapshot.skills ?? []).map((skill) => skill.name).filter((name) => !names.has(name)).sort());
        const write = old === undefined || old.snapshot.name !== manifest.name || old.snapshot.version !== manifest.version;
        lock = { format: 1, installed_by: write ? product.version : old!.installed_by, snapshot: manifest };
        if (write) {
          changes.push({ path: LOCK, action: previous.kind === "absent" ? "created" : "updated", content: serializeLock(product.version, manifest) });
          previousCli = old !== undefined ? old.installed_by : await lastUpgradeCli(root, product.version);
        } else unchanged += 1;
      }
    }

    const settings = ".claude/settings.json";
    await assertPlainPath(root, settings);
    const settingsBefore = await readOptional(join(root, settings));
    if (settingsBefore !== null) {
      try {
        const value = JSON.parse(settingsBefore) as Record<string, unknown>;
        let changed = false;
        for (const [key, remove] of [["enabledPlugins", "ultimate-brain@ultimate-brain"], ["extraKnownMarketplaces", "ultimate-brain"]] as const) {
          if (value[key] !== null && typeof value[key] === "object" && !Array.isArray(value[key]) && remove in (value[key] as object)) {
            delete (value[key] as Record<string, unknown>)[remove];
            changed = true;
            if (Object.keys(value[key] as object).length === 0) delete value[key];
          }
        }
        if (changed) {
          changes.push({
            path: settings,
            action: Object.keys(value).length === 0 ? "removed" : "updated",
            content: Object.keys(value).length === 0 ? undefined : `${JSON.stringify(value, null, 2)}\n`,
          });
        }
      } catch {
        changes.push({ path: settings, action: "skipped" });
        warnings.push({ code: "SETTINGS_UNPARSEABLE", message: ".claude/settings.json is not valid JSON; left unchanged." });
      }
    }

    changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const written = changes.filter((change) => change.action !== "skipped");
    const version = product.version;
    const dryRun = args.options["dry-run"] === true;
    if (!dryRun && await gitDirty(root)) throw new BrainError("BRAIN_DIRTY", "brain has uncommitted changes");
    if (refusal !== undefined) throw refusal;
    if (!dryRun && written.length > 0) {
      await writeChanges(root, written);
      for (const [folder, self] of prune) await pruneEmpty(join(root, folder), self);
      // knowledge/concepts/ and every folder under it the conversion left empty (spec/cli.md §5.15 step 5a).
      if (concepts.converted.length > 0) await pruneEmpty(join(root, "knowledge/concepts"), true);
      await appendLog(root, now, [{ op: "upgrade", id: "-", title: version, pairs: [["files", written.length]] }]);
    }
    // A dry run lints the planned tree: the converted notes as step 5a would leave them (spec/cli.md §5.15 step 7).
    const { notes, problems } = dryRun ? { notes: concepts.notes, problems: scanned.problems } : await scanNotes(root);
    const plannedProductFiles = new Map<string, string | null>();
    for (const change of changes) if (change.action !== "skipped") plannedProductFiles.set(change.path, change.action === "removed" ? null : Buffer.from(change.content!).toString("utf8"));
    const home = homeOf(environment.env);
    const lint = lintBrain({ root, notes, problems, brainConfig: brain!.config, indexMarkdown: dryRun && concepts.index !== null ? concepts.index : await readOptional(join(root, "index.md")),
      pendingPaths: dryRun ? new Set(concepts.changes.filter((change) => change.action === "created").map((change) => change.path)) : undefined, plannedProductFiles, skillsLock: lock, home });
    const competing = competingCopies({ treeRoot: root, names: manifest!.skills.map((skill) => skill.name), home, brainRoot: root, brainSettings: plannedProductFiles.get(".claude/settings.json") });
    if (competing.length > 0) warnings.push({ code: "SKILLS_COMPETING", message: `${competing.length} competing skill copies; see data.skills.competing and remove them.` });
    let commit: string | null = null;
    let pushed = false;
    if (!dryRun && written.length > 0 && await gitRepository(root)) {
      const staged = [...written.map((change) => change.path), `log/${now.toISOString().slice(0, 7)}.md`];
      try {
        await exec("git", ["add", "--", ...staged], { cwd: root });
        await exec("git", ["commit", "-m", `upgrade: ultimate brain ${version}, skills ${manifest!.name} ${manifest!.version}`], { cwd: root });
        commit = (await exec("git", ["rev-parse", "--short", "HEAD"], { cwd: root })).stdout.trim();
      } catch {
        warnings.push({ code: "GIT_COMMIT_SKIPPED", message: "Git commit was skipped; files were kept." });
      }
      if (commit !== null) {
        try {
          await exec("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { cwd: root });
        } catch {
          warnings.push({ code: "PUSH_SKIPPED", message: "Git branch has no upstream; commit was not pushed." });
        }
        if (!warnings.some((warning) => warning.code === "PUSH_SKIPPED")) {
          try {
            await exec("git", ["push"], { cwd: root });
            pushed = true;
          } catch (error) {
            warnings.push({ code: "PUSH_FAILED", message: String(error) });
          }
        }
      }
    }
    return {
      warnings,
      data: { dry_run: dryRun, dirty: dryRun ? await gitDirty(root) : undefined, version, files: changes.map(({ path, action }) => ({ path, action })), unchanged, converted: concepts.converted,
        skills: { from, to: { name: manifest!.name, version: manifest!.version }, retired, previous_cli: previousCli, competing },
        lint: { errors: lint.filter((x) => x.severity === "error").length, warnings: lint.filter((x) => x.severity === "warning").length }, commit, pushed },
      human: `${written.length} files ${dryRun ? "would change" : "changed"}, ${unchanged} unchanged\n`,
    };
  },
};

/** Apply the planned changes; when one fails, restore every file already replaced or removed and delete the created ones (cli.md §3.6). */
async function writeChanges(root: string, written: readonly Change[]): Promise<void> {
  const done: Array<{ change: Change; before: Buffer | null }> = [];
  try {
    for (const change of written) {
      const before = change.action === "created" ? null : await readOptionalBuffer(join(root, change.path));
      if (change.action === "removed") await unlink(join(root, change.path));
      else {
        await ensureDirectory(root, dirname(change.path));
        await atomicWriteFile(root, change.path, change.content!);
      }
      done.push({ change, before });
    }
  } catch (error) {
    for (const { change, before } of done.reverse()) {
      if (before === null) await unlink(join(root, change.path)).catch(() => undefined);
      else {
        await ensureDirectory(root, dirname(change.path)).catch(() => undefined);
        await atomicWriteFile(root, change.path, before).catch(() => undefined);
      }
    }
    throw error;
  }
}

/** Remove the empty folders under `folder` (and `folder` itself when `self`): an emptied or unlisted folder is not part of a skill. */
async function pruneEmpty(folder: string, self: boolean): Promise<void> {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) if (entry.isDirectory()) await pruneEmpty(join(folder, entry.name), true);
  if (self) await rmdir(folder).catch(() => undefined);
}

/** The text from the rules start marker through the end marker, when exactly one well-ordered pair exists. */
function rulesBlock(text: string): string | undefined {
  const starts = [...text.matchAll(START)]; const ends = [...text.matchAll(END)];
  if (starts.length !== 1 || ends.length !== 1 || ends[0]!.index! < starts[0]!.index!) return undefined;
  return text.slice(starts[0]!.index!, ends[0]!.index! + ends[0]![0].length);
}

async function listFiles(folder: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(relative(folder, path).split(sep).join("/"));
    }
  }
  await visit(folder);
  return files;
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function readOptional(path: string): Promise<string | null> {
  const buffer = await readOptionalBuffer(path);
  return buffer === null ? null : buffer.toString("utf8");
}

async function readOptionalBuffer(path: string): Promise<Buffer | null> {
  try {
    if (!(await lstat(path)).isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

async function gitRepository(root: string): Promise<boolean> {
  try { return (await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root })).stdout.trim() === "true"; } catch { return false; }
}

async function gitDirty(root: string): Promise<boolean> {
  if (!await gitRepository(root)) return false;
  return (await exec("git", ["status", "--porcelain"], { cwd: root })).stdout !== "";
}

/** Rename `old` to `key` in place; when `key` already holds an id, just drop `old` (spec/cli.md §5.15 step 5). */
function renameKey(values: Record<string, unknown>, old: string, key: string): Record<string, unknown> {
  const value = typeof values[key] === "string" && values[key] !== "" ? values[key] : values[old];
  const next: Record<string, unknown> = {};
  for (const [name, existing] of Object.entries(values)) {
    if (name === old) next[key] = value;
    else if (name !== key) next[name] = existing;
  }
  return next;
}

/** The first pin's `previous_cli` (skills-delivery §7, CC-129): the version in the newest `upgrade: ultimate brain <version>` commit other than the running one, or null. */
async function lastUpgradeCli(root: string, running: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["log", "--format=%s"], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    for (const subject of stdout.split("\n")) {
      const match = /^upgrade: ultimate brain (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:, skills .*)?$/.exec(subject);
      if (match !== null && match[1] !== running) return match[1];
    }
  } catch { /* not a Git repo, or no commits: null */ }
  return null;
}
