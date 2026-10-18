import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { BrainError } from "./errors.ts";

const SKILLS_ROOT = fileURLToPath(new URL("../../.agents/skills/", import.meta.url));

export interface InstalledProduct { root: string; version: string; source: boolean; }
let productRootOverride: { root: string; source?: boolean } | undefined;

/** Test seam for the package location and whether it is a source checkout. */
export function setInstalledProductRootForTests(root: string | undefined, source?: boolean): void {
  productRootOverride = root === undefined ? undefined : { root, source };
}

/** Resolve the package containing the running module, never a package found on PATH. */
export function installedProduct(): InstalledProduct {
  let folder = productRootOverride?.root ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  try { folder = realpathSync(folder); } catch { /* diagnosed below */ }
  for (;;) {
    const manifest = join(folder, "package.json");
    if (existsSync(manifest)) {
      const value = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown; version?: unknown };
      if (value.name === "ultimate-brain" && typeof value.version === "string") {
        return {
          root: folder,
          version: value.version,
          source: productRootOverride?.source ?? existsSync(join(folder, "src", "cli.ts")),
        };
      }
    }
    const parent = dirname(folder);
    if (parent === folder) throw new BrainError("INTERNAL", "installed package not found: no ultimate-brain package.json");
    folder = parent;
  }
}

export interface SkillFile {
  /** Path relative to `.agents/skills/`, e.g. `brain-query/SKILL.md`. */
  relative: string;
  content: Buffer;
}

/** Skills the package ships for Codex (decision 0029), optionally limited to one skill name. */
export async function listShippedSkillFiles(only?: string): Promise<SkillFile[]> {
  let root: string;
  try {
    root = await realpath(SKILLS_ROOT);
  } catch {
    throw new BrainError("INTERNAL", "This package does not include .agents/skills/");
  }
  const files: SkillFile[] = [];
  async function visit(folder: string): Promise<void> {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const source = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new BrainError("OUTSIDE_ROOT", `Skills contain a symbolic link: ${source}`);
      if (entry.isDirectory()) await visit(source);
      else if (entry.isFile()) {
        files.push({ relative: relative(root, source).split(sep).join("/"), content: await readFile(source) });
      }
    }
  }
  await visit(root);
  const selected = files.filter((file) => file.relative.includes("/") && (only === undefined || file.relative.startsWith(`${only}/`)));
  if (only !== undefined && selected.length === 0) throw new BrainError("INTERNAL", `Skill ${only} is not shipped with this package`);
  return selected.sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0));
}

/**
 * Refuses (OUTSIDE_ROOT) a product-owned path under `root` whose existing parts are a symbolic link, a non-folder
 * where a folder is needed, or a non-file at the end, so a write or removal can't follow a link out of the repo.
 * Call it while planning, before anything is written.
 */
export async function assertPlainPath(root: string, path: string, last: "file" | "folder" = "file"): Promise<void> {
  const parts = path.split("/");
  for (let index = 1; index <= parts.length; index += 1) {
    const current = parts.slice(0, index).join("/");
    let metadata;
    try {
      metadata = await lstat(join(root, current));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
    if (metadata.isSymbolicLink()) throw new BrainError("OUTSIDE_ROOT", `Refusing to write through a symbolic link: ${current}`);
    const wantFolder = index < parts.length || last === "folder";
    if (wantFolder && !metadata.isDirectory()) throw new BrainError("OUTSIDE_ROOT", `Expected a folder: ${current}`);
    if (!wantFolder && !metadata.isFile()) throw new BrainError("OUTSIDE_ROOT", `Expected a file: ${current}`);
  }
}
