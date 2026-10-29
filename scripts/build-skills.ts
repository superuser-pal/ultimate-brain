#!/usr/bin/env node
/**
 * Mirror skills/ (the one source) to .agents/skills/, which the npm package ships and brain init and brain upgrade copy into a
 * brain for both Claude Code and Codex, after validating every skill (build/TASKS.md CC-05, decisions 0014 and 0038).
 *
 *   node scripts/build-skills.ts          validate, then rewrite .agents/skills/
 *   node scripts/build-skills.ts --check  validate and report drift; writes nothing, exit 1 on problems
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";

const ROOT = join(import.meta.dirname, "..");
export const SOURCE = join(ROOT, "skills");
export const MIRROR = join(ROOT, ".agents", "skills");
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIRROR_README = "# Generated\n\nCopied from `skills/` by `node scripts/build-skills.ts`. Do not edit here; edit `skills/<name>/` and rebuild.\n";

/** Problems with the skills in `source`: each folder needs a SKILL.md with only `name` (= folder) and `description`. */
export async function validateSkills(source = SOURCE): Promise<string[]> {
  const problems: string[] = [];
  for (const name of await skillNames(source)) {
    const where = `skills/${name}/SKILL.md`;
    if (!NAME.test(name)) problems.push(`skills/${name}: folder name must be lowercase kebab-case`);
    let text: string;
    try {
      text = await readFile(join(source, name, "SKILL.md"), "utf8");
    } catch {
      problems.push(`${where}: missing`);
      continue;
    }
    let attributes: Record<string, unknown>;
    let body: string;
    try {
      ({ attributes, body } = parseFrontmatter(text));
    } catch (error) {
      problems.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const extra = Object.keys(attributes).filter((key) => key !== "name" && key !== "description");
    if (extra.length > 0) problems.push(`${where}: frontmatter may only have name and description, found ${extra.join(", ")}`);
    if (attributes.name !== name) problems.push(`${where}: name must be "${name}" (the folder name)`);
    if (typeof attributes.description !== "string" || attributes.description.trim() === "") problems.push(`${where}: description is required`);
    else if (attributes.description.length > 1024) problems.push(`${where}: description is over 1024 characters`);
    if (body.trim() === "") problems.push(`${where}: body is empty`);
    problems.push(...(await textProblems(join(source, name), body)));
  }
  return problems;
}

/** Words of four or more capitals allowed outside code: acronyms and file names, never emphasis (CC-61). */
export const CAPS_ALLOWED = new Set(["AGENTS", "CHANGELOG", "HTML", "JSON", "NNNN", "README", "SKILL", "YYYY"]);
const CAPS = /\b[A-Z]{4,}\b/g;
const LINK = /\]\(([^)\s]+)\)/g;

/**
 * Two style checks over a skill's Markdown (CC-61). Every file a skill links to is linked from SKILL.md itself, so an
 * agent reaches any reference in one step; references may link to each other. And no word of four or more capitals
 * outside code: CAPS emphasis makes current models over-apply a rule.
 */
async function textProblems(dir: string, skillBody: string): Promise<string[]> {
  const problems: string[] = [];
  const name = dir.split(/[\\/]/).pop();
  const files = new Map<string, string>([["SKILL.md", skillBody]]);
  for (const [path, content] of await snapshot(dir)) if (path !== "SKILL.md" && path.endsWith(".md")) files.set(path, content);
  const fromSkill = new Set(localLinks("SKILL.md", skillBody));
  for (const [path, content] of files) {
    for (const target of localLinks(path, content)) {
      if (target !== "SKILL.md" && !fromSkill.has(target) && (await exists(join(dir, target)))) {
        problems.push(`skills/${name}/${path}: links to ${target}, which SKILL.md doesn't link to (references are one level deep)`);
      }
    }
    const prose = content.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "").replace(/`[^`\n]*`/g, "");
    const shouted = [...new Set([...prose.matchAll(CAPS)].map((match) => match[0]).filter((word) => !CAPS_ALLOWED.has(word)))];
    if (shouted.length > 0) problems.push(`skills/${name}/${path}: capitals for emphasis (${shouted.join(", ")}); write it plainly, or put code in backticks`);
  }
  return problems;
}

/** Targets of a file's relative links, resolved against the skill folder; external links and anchors are skipped. */
function localLinks(from: string, content: string): string[] {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const links: string[] = [];
  for (const [, href] of content.matchAll(LINK)) {
    const target = href.split("#")[0];
    if (target === "" || /^[a-z]+:/i.test(target) || target.startsWith("/")) continue;
    const parts: string[] = base === "" ? [] : base.split("/");
    for (const part of target.split("/")) {
      if (part === "..") parts.pop();
      else if (part !== ".") parts.push(part);
    }
    links.push(parts.join("/"));
  }
  return links;
}

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/** Files that differ between `skills/` and the mirror (paths relative to each root). */
export async function mirrorDrift(source = SOURCE, mirror = MIRROR): Promise<string[]> {
  const want = new Map<string, string>([["README.md", MIRROR_README]]);
  for (const name of await skillNames(source)) {
    for (const [path, content] of await snapshot(join(source, name))) want.set(`${name}/${path}`, content);
  }
  const have = await snapshot(mirror);
  const drift: string[] = [];
  for (const [path, content] of want) if (have.get(path) !== content) drift.push(have.has(path) ? `changed: ${path}` : `missing: ${path}`);
  for (const path of have.keys()) if (!want.has(path)) drift.push(`extra: ${path}`);
  return drift.sort();
}

export async function buildMirror(source = SOURCE, mirror = MIRROR): Promise<void> {
  await rm(mirror, { recursive: true, force: true });
  await mkdir(mirror, { recursive: true });
  for (const name of await skillNames(source)) await cp(join(source, name), join(mirror, name), { recursive: true });
  await writeFile(join(mirror, "README.md"), MIRROR_README);
}

async function skillNames(source: string): Promise<string[]> {
  try {
    const entries = await readdir(source, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

/** Every file under `root` (relative path → content), ignoring .DS_Store. */
async function snapshot(root: string, dir = root, out = new Map<string, string>()): Promise<Map<string, string>> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await snapshot(root, path, out);
    else out.set(relative(root, path).split("\\").join("/"), await readFile(path, "utf8"));
  }
  return out;
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const check = process.argv.includes("--check");
  const problems = await validateSkills();
  for (const problem of problems) console.error(`error: ${problem}`);
  if (problems.length > 0) process.exit(1);
  if (check) {
    const drift = await mirrorDrift();
    for (const line of drift) console.error(`drift: ${line}`);
    if (drift.length > 0) {
      console.error("Run: node scripts/build-skills.ts");
      process.exit(1);
    }
    console.log("skills OK, mirror current");
  } else {
    await buildMirror();
    console.log(`mirrored ${(await skillNames(SOURCE)).length} skills to .agents/skills/`);
  }
}
