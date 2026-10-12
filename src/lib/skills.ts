import { readdir, readFile, realpath } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { BrainError } from "./errors.ts";

const SKILLS_ROOT = fileURLToPath(new URL("../../.agents/skills/", import.meta.url));

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
