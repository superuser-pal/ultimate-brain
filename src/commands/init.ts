import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, readdir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { Command, Warning } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import { buildIndex } from "../lib/index-builder.ts";
import { isProductRepository } from "../lib/brain-path.ts";
import { appendLog } from "../lib/log.ts";
import { scanNotes } from "../lib/notes.ts";
import { listShippedSkillFiles } from "../lib/skills.ts";

const exec = promisify(execFile);
const TEMPLATE_ROOT = fileURLToPath(new URL("../../templates/brain/", import.meta.url));

interface TemplateFile {
  relative: string;
  source: string;
}

/** `brain init <path>` (spec/cli.md §5.1). */
export const initCommand: Command = {
  name: "init",
  usage: "brain init <path> [--owner <name>] [--force] [--no-git] [--set-default] [--json]",
  summary: "Create a new Ultimate Brain repository from the versioned template.",
  options: { owner: "string", force: "boolean", "no-git": "boolean", "set-default": "boolean" },
  maxPositionals: 1,
  needsBrain: false,
  async run({ args, now, environment }) {
    const [requested] = args.positionals;
    if (requested === undefined) throw new BrainError("USAGE", "brain init needs a target path");
    const target = resolve(requested);
    const present = await inspectTarget(target);
    if (present.kind === "file") throw new BrainError("TARGET_NOT_EMPTY", `Brain target is not a directory: ${target}`);

    if (!present.exists) await mkdir(target, { recursive: true });
    const root = await realpath(target);
    if (await isProductRepository(root)) {
      throw new BrainError("BRAIN_IS_PRODUCT_REPO", `Refusing to initialize the Ultimate Brain product repository: ${root}`);
    }
    if (await exists(join(root, "brain.json"))) {
      throw new BrainError("ALREADY_A_BRAIN", `Target already contains brain.json: ${root}`);
    }
    if (present.entries.length > 0 && args.options.force !== true) {
      throw new BrainError("TARGET_NOT_EMPTY", `Brain target is not empty: ${root}`);
    }

    const owner = args.options.owner as string | undefined ?? await defaultOwner();
    if (owner.trim() === "") throw new BrainError("USAGE", "--owner must not be empty");
    const created: string[] = [];
    const skipped: string[] = [];
    const template = await listTemplateFiles();

    for (const file of template) {
      if (await exists(join(root, file.relative))) {
        skipped.push(file.relative);
        continue;
      }
      let content = await readFile(file.source, "utf8");
      if (file.relative === "brain.json") content = initialConfig(content, owner);
      await ensureDirectory(root, dirname(file.relative));
      await atomicWriteFile(root, file.relative, content);
      created.push(file.relative);
    }

    // Product-owned skills (decision 0029, 0038); like template files, existing ones are never overwritten.
    for (const skill of await listShippedSkillFiles()) {
      for (const folder of [".agents/skills", ".claude/skills"]) {
        const path = `${folder}/${skill.relative}`;
        if (await exists(join(root, path))) {
          skipped.push(path);
          continue;
        }
        await ensureDirectory(root, dirname(path));
        await atomicWriteFile(root, path, skill.content);
        created.push(path);
      }
    }

    // The template includes an empty index, but build it rather than trusting that snapshot.
    // With --force an existing index is left untouched along with every other existing template file.
    if (!skipped.includes("index.md")) {
      const { notes } = await scanNotes(root);
      const index = buildIndex(notes).markdown;
      await atomicWriteFile(root, "index.md", index);
    }

    const logPath = `log/${now.toISOString().slice(0, 7)}.md`;
    const hadLog = await exists(join(root, logPath));
    await appendLog(root, now, [{ op: "init", id: "-", title: owner, pairs: [["schema", 1]] }]);
    if (!hadLog) created.push(logPath);

    const warnings: Warning[] = [];
    const git = await initializeGit(root, args.options["no-git"] === true, warnings);
    let defaultConfig: { written: boolean; path_abs: string | null; previous: unknown };
    if (args.options["set-default"] === true) {
      defaultConfig = await writeDefaultConfig(root, environment.homeDirectory);
    } else {
      defaultConfig = { written: false, path_abs: null, previous: null };
    }

    created.sort(comparePath);
    skipped.sort(comparePath);
    return {
      resolvedBrain: root,
      warnings,
      data: {
        path_abs: root,
        created,
        skipped,
        git,
        default_config: defaultConfig,
      },
      human: `Initialized Ultimate Brain at ${root}\n`,
    };
  },
};

async function inspectTarget(target: string): Promise<{ exists: boolean; kind: "directory" | "file"; entries: string[] }> {
  try {
    const metadata = await lstat(target);
    if (!metadata.isDirectory()) return { exists: true, kind: "file", entries: [] };
    return { exists: true, kind: "directory", entries: await readdir(target) };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return { exists: false, kind: "directory", entries: [] };
    throw error;
  }
}

async function listTemplateFiles(): Promise<TemplateFile[]> {
  const root = await realpath(TEMPLATE_ROOT);
  const files: TemplateFile[] = [];
  async function visit(folder: string): Promise<void> {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const source = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new BrainError("OUTSIDE_ROOT", `Template contains a symbolic link: ${source}`);
      if (entry.isDirectory()) await visit(source);
      else if (entry.isFile()) {
        const actual = await realpath(source);
        assertInside(root, actual);
        const templatePath = relative(root, actual).split(sep).join("/");
        files.push({ source: actual, relative: templatePath === "gitignore" ? ".gitignore" : templatePath });
      }
    }
  }
  await visit(root);
  return files.sort((left, right) => comparePath(left.relative, right.relative));
}

function initialConfig(template: string, owner: string): string {
  let config: unknown;
  try {
    config = JSON.parse(template);
  } catch (error) {
    throw new BrainError("INTERNAL", `Brain template has invalid brain.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(config) || !isRecord(config.owner)) throw new BrainError("INTERNAL", "Brain template has no owner configuration");
  config.schema_version = 1;
  config.owner.name = owner;
  return `${JSON.stringify(config, null, 2)}\n`;
}

async function defaultOwner(): Promise<string> {
  try {
    const { stdout } = await exec("git", ["config", "--get", "user.name"]);
    const name = stdout.trim();
    return name === "" ? "Owner" : name;
  } catch {
    return "Owner";
  }
}

async function initializeGit(root: string, noGit: boolean, warnings: Warning[]): Promise<{ initialized: boolean; committed: boolean }> {
  if (noGit) return { initialized: false, committed: false };
  try {
    await exec("git", ["init"], { cwd: root });
    await exec("git", ["add", "--all"], { cwd: root });
  } catch {
    warnings.push({ code: "GIT_COMMIT_SKIPPED", message: "Git initialization or staging failed; brain files were kept." });
    return { initialized: false, committed: false };
  }
  try {
    await exec("git", ["commit", "-m", "init: ultimate brain (schema v1)"], { cwd: root });
    return { initialized: true, committed: true };
  } catch {
    warnings.push({ code: "GIT_COMMIT_SKIPPED", message: "Git commit was skipped; configure a Git identity and commit the brain files." });
    return { initialized: true, committed: false };
  }
}

async function writeDefaultConfig(
  brain: string,
  homeDirectory: string | undefined,
): Promise<{ written: boolean; path_abs: string; previous: unknown }> {
  // `homeDirectory` is injectable for isolated CLI tests; production uses the current user's home.
  const home = homeDirectory ?? process.env.HOME;
  if (home === undefined || home === "") throw new BrainError("INTERNAL", "Cannot determine home directory for --set-default");
  const absoluteHome = resolve(home);
  const root = await realpath(absoluteHome);
  const folder = join(root, ".config", "ultimate-brain");
  await ensureDirectory(root, ".config/ultimate-brain");
  const configPath = join(folder, "config.json");
  let previous: unknown = null;
  try {
    previous = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") previous = "<unreadable>";
  }
  await atomicWriteFile(root, configPath, `${JSON.stringify({ brain }, null, 2)}\n`);
  return { written: true, path_abs: configPath, previous };
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function assertInside(root: string, target: string): void {
  const path = relative(root, target);
  if (path === ".." || path.startsWith(`..${sep}`)) {
    throw new BrainError("OUTSIDE_ROOT", `Template file resolves outside its root: ${target}`);
  }
}

function comparePath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
