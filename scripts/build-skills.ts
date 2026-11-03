#!/usr/bin/env node
/**
 * Mirror skills/ (the one source) to .agents/skills/, which the npm package ships and brain init and brain upgrade copy into a
 * brain for both Claude Code and Codex, after validating every skill (build/TASKS.md CC-05, decisions 0014 and 0038).
 *
 *   node scripts/build-skills.ts          validate, then rewrite .agents/skills/
 *   node scripts/build-skills.ts --check  validate and report drift; writes nothing, exit 1 on problems
 *   node scripts/build-skills.ts --snapshot  write the mirror's generated snapshot.json (npm run build; spec/skills-delivery.md §9)
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { buildManifest, phaseARange, serializeManifest, type Manifest } from "../src/lib/skills-snapshot.ts";

const ROOT = join(import.meta.dirname, "..");
export const SOURCE = join(ROOT, "skills");
export const MIRROR = join(ROOT, ".agents", "skills");
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Skills `brain link` installs in a linked repo (the snapshot's `linked_repo` target, spec/skills-delivery.md §9). */
export const LINKED_SKILLS = new Set(["brain-query"]);
const MIRROR_README = "# Generated\n\nCopied from `skills/` by `node scripts/build-skills.ts`. Do not edit here; edit `skills/<name>/` and rebuild.\n";

/** Problems with the skills in `source`: each folder needs a SKILL.md with only `name` (= folder) and `description`. */
export async function validateSkills(source = SOURCE): Promise<string[]> {
  const problems: string[] = [];
  for (const link of await symbolicLinks(source)) problems.push(`skills/${link}: symbolic links are not allowed`);
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
const INLINE_LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const LINK_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/gm;
const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

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
  const fromSkill = new Set(localLinks("SKILL.md", prose(skillBody)));
  for (const [path, content] of files) {
    const text = prose(content);
    for (const target of localLinks(path, text)) {
      if (target !== "SKILL.md" && !fromSkill.has(target) && (await exists(join(dir, target)))) {
        problems.push(`skills/${name}/${path}: links to ${target}, which SKILL.md doesn't link to (references are one level deep)`);
      }
    }
    const shouted = [...new Set([...text.matchAll(CAPS)].map((match) => match[0]).filter((word) => !CAPS_ALLOWED.has(word)))];
    if (shouted.length > 0) problems.push(`skills/${name}/${path}: capitals for emphasis (${shouted.join(", ")}); write it plainly, or put code in backticks`);
  }
  return problems;
}

/**
 * Markdown with its code removed, as CommonMark reads code: fenced blocks (fences indented up to three spaces past the
 * enclosing list item), indented blocks (four spaces past it, after a blank line, so a list item's continuation stays
 * prose), and code spans of any backtick length. Line by line; enough for skill files, not a full parser.
 */
export function prose(content: string): string {
  const kept: string[] = [];
  let fence: { char: string; length: number } | undefined;
  let listIndent = 0;
  let previousBlank = true;
  let inIndentedCode = false;
  for (const line of content.split("\n")) {
    const indent = line.replace(/\t/g, "    ").search(/\S/);
    if (fence !== undefined) {
      const close = line.trimStart().match(/^(`+|~+)\s*$/);
      if (close !== null && close[1][0] === fence.char && close[1].length >= fence.length) fence = undefined;
      continue;
    }
    if (indent === -1) {
      kept.push("");
      previousBlank = true;
      continue;
    }
    if (inIndentedCode && indent >= listIndent + 4) continue;
    inIndentedCode = false;
    if (previousBlank && indent >= listIndent + 4) {
      inIndentedCode = true;
      continue;
    }
    const open = line.trimStart().match(/^(`{3,}|~{3,})/);
    if (open !== null && indent < listIndent + 4) {
      fence = { char: open[1][0], length: open[1].length };
      previousBlank = false;
      continue;
    }
    const item = line.match(/^(\s*)([-*+]|\d{1,9}[.)])(\s+)\S/);
    if (item !== null) listIndent = item[1].length + item[2].length + Math.min(item[3].length, 4);
    else if (previousBlank && indent < listIndent) listIndent = 0;
    kept.push(line);
    previousBlank = false;
  }
  return kept.join("\n").replace(CODE_SPAN, "");
}

/** Targets of a file's relative links, resolved against the skill folder; external links and anchors are skipped. */
function localLinks(from: string, content: string): string[] {
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const links: string[] = [];
  for (const [, href] of [...content.matchAll(INLINE_LINK), ...content.matchAll(LINK_DEFINITION)]) {
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
  have.delete("snapshot.json"); // generated by the build, not committed (§9)
  const drift: string[] = [];
  for (const [path, content] of want) if (have.get(path) !== content) drift.push(have.has(path) ? `changed: ${path}` : `missing: ${path}`);
  for (const path of have.keys()) if (!want.has(path)) drift.push(`extra: ${path}`);
  return drift.sort();
}

export async function buildMirror(source = SOURCE, mirror = MIRROR): Promise<void> {
  await rm(mirror, { recursive: true, force: true });
  await mkdir(mirror, { recursive: true });
  for (const name of await skillNames(source)) {
    await cp(join(source, name), join(mirror, name), { recursive: true, filter: (path) => !relative(source, path).split(/[\\/]/).some((part) => part.startsWith(".")) });
  }
  await writeFile(join(mirror, "README.md"), MIRROR_README);
}

/** The phase A manifest of the mirror for package version `version` (spec/skills-delivery.md §9). */
export function phaseAManifest(mirror: string, version: string): Manifest {
  return buildManifest(mirror, {
    name: "ultimate-brain",
    version,
    cli: phaseARange(version),
    source: { repository: "https://www.npmjs.com/package/ultimate-brain" },
    upstream: null,
    targets: (name) => (LINKED_SKILLS.has(name) ? ["brain", "linked_repo"] : ["brain"]),
  });
}

export async function writeSnapshotManifest(mirror = MIRROR, version = packageVersion()): Promise<void> {
  await writeFile(join(mirror, "snapshot.json"), serializeManifest(phaseAManifest(mirror, version)));
}

function packageVersion(): string {
  return (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version;
}

/** Symbolic links under `source`, relative to it. */
async function symbolicLinks(source: string, dir = source): Promise<string[]> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const out: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) out.push(relative(source, path).split("\\").join("/"));
    else if (entry.isDirectory()) out.push(...await symbolicLinks(source, path));
  }
  return out.sort();
}

async function skillNames(source: string): Promise<string[]> {
  try {
    const entries = await readdir(source, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

/** Every file under `root` (relative path → content), ignoring entries whose name starts with `.` (§9). */
async function snapshot(root: string, dir = root, out = new Map<string, string>()): Promise<Map<string, string>> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await snapshot(root, path, out);
    else out.set(relative(root, path).split("\\").join("/"), await readFile(path, "utf8"));
  }
  return out;
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const check = process.argv.includes("--check");
  if (process.argv.includes("--snapshot")) {
    await writeSnapshotManifest();
    console.log("wrote .agents/skills/snapshot.json");
    process.exit(0);
  }
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
