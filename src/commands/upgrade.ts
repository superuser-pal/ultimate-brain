import { execFile } from "node:child_process";
import { lstat, readdir, readFile, unlink } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";

import type { Command, Warning } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { appendLog } from "../lib/log.ts";
import { isRecord } from "../lib/input.ts";
import { lintBrain } from "../lib/lint.ts";
import { modulesOf, withModules } from "../lib/modules.ts";
import { scanNotes } from "../lib/notes.ts";
import { assertPlainPath, installedProduct, listShippedSkillFiles } from "../lib/skills.ts";

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
  async run({ args, brain, now }) {
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
          if (changed) config = { ...config, notion: { ...notion, databases } };
        }
        if (isRecord(config) && !("modules" in config)) {
          config = withModules(config, modulesOf(config));
          changed = true;
        }
        if (changed) changes.push({ path: brainJson, action: "updated", content: `${JSON.stringify(config, null, 2)}\n` });
      } catch {
        changes.push({ path: brainJson, action: "skipped" });
        warnings.push({ code: "BRAIN_JSON_UNPARSEABLE", message: "brain.json is not valid JSON; left unchanged." });
      }
    }

    // Skills (decision 0029): shipped files are product-owned, inside the folders of shipped skills only.
    const shipped = await listShippedSkillFiles();
    const shippedPaths = new Set(shipped.map((file) => file.relative));
    for (const prefix of [".agents/skills", ".claude/skills"]) {
      for (const name of new Set(shipped.map((file) => file.relative.split("/")[0]!))) await assertPlainPath(root, `${prefix}/${name}`, "folder");
      for (const file of shipped) {
        const path = `${prefix}/${file.relative}`;
        await assertPlainPath(root, path);
        const existing = await readOptionalBuffer(join(root, path));
        if (existing === null) changes.push({ path, action: "created", content: file.content });
        else if (existing.equals(file.content)) unchanged += 1;
        else changes.push({ path, action: "updated", content: file.content });
      }
      for (const name of new Set(shipped.map((file) => file.relative.split("/")[0]!))) {
        for (const file of await listFiles(join(root, prefix, name))) {
          const inSkills = `${name}/${file}`;
          await assertPlainPath(root, `${prefix}/${inSkills}`);
          if (!shippedPaths.has(inSkills)) changes.push({ path: `${prefix}/${inSkills}`, action: "removed" });
        }
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
    if (!dryRun && written.length > 0) {
      for (const change of written) {
        if (change.action === "removed") { await unlink(join(root, change.path)); continue; }
        await ensureDirectory(root, dirname(change.path));
        await atomicWriteFile(root, change.path, change.content!);
      }
      await appendLog(root, now, [{ op: "upgrade", id: "-", title: version, pairs: [["files", written.length]] }]);
    }
    const { notes, problems } = await scanNotes(root);
    const plannedProductFiles = new Map<string, string | null>();
    for (const change of changes) if (change.action !== "skipped") plannedProductFiles.set(change.path, change.action === "removed" ? null : Buffer.from(change.content!).toString("utf8"));
    const lint = lintBrain({ root, notes, problems, brainConfig: brain!.config, indexMarkdown: await readOptional(join(root, "index.md")), plannedProductFiles });
    let commit: string | null = null;
    let pushed = false;
    if (!dryRun && written.length > 0 && await gitRepository(root)) {
      const staged = [...written.map((change) => change.path), `log/${now.toISOString().slice(0, 7)}.md`];
      try {
        await exec("git", ["add", "--", ...staged], { cwd: root });
        await exec("git", ["commit", "-m", `upgrade: ultimate brain ${version}`], { cwd: root });
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
      data: { dry_run: dryRun, dirty: dryRun ? await gitDirty(root) : undefined, version, files: changes.map(({ path, action }) => ({ path, action })), unchanged, lint: { errors: lint.filter((x) => x.severity === "error").length, warnings: lint.filter((x) => x.severity === "warning").length }, commit, pushed },
      human: `${written.length} files ${dryRun ? "would change" : "changed"}, ${unchanged} unchanged\n`,
    };
  },
};

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
