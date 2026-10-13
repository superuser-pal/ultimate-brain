import { lstat, readdir, readFile, realpath, stat, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { Command } from "../lib/command.ts";
import { isProductRepository } from "../lib/brain-path.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import type { Note } from "../lib/notes.ts";
import { scanNotes } from "../lib/notes.ts";
import { assertPlainPath, listShippedSkillFiles } from "../lib/skills.ts";

const START = "<!-- ultimate-brain:start -->";
const END = "<!-- ultimate-brain:end -->";
const STACK = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface RepoMarker {
  repo?: string;
  project?: string;
  area?: string;
  stacks?: string[];
}

interface PlannedFile {
  path: string;
  before: string | null;
  after: string | null;
}

/** `brain link <repo-path>` (spec/cli.md §5.12). */
export const linkCommand: Command = {
  name: "link",
  usage: "brain link <repo-path> [--project <id>] [--area <id>] [--stack <name>]… [--repo-name <name>] [--json]",
  summary: "Link a consuming repository to this brain and install its consult instruction.",
  options: { project: "string", area: "string", stack: "list", "repo-name": "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain }) {
    const [requested] = args.positionals;
    if (requested === undefined) throw new BrainError("USAGE", "brain link needs a repository path");
    const root = await openRepo(requested);
    if (root === brain!.root || await isProductRepository(root)) {
      throw new BrainError("OUTSIDE_ROOT", "Refusing to write a brain or product repository as a consuming repository");
    }

    const { notes } = await scanNotes(brain!.root);
    const existingMarker = await readMarker(root);
    const marker = buildMarker(existingMarker, root, args.options, notes);
    const project = marker.project === undefined ? undefined : noteOf(notes, marker.project, "project");
    const area = marker.area === undefined ? undefined : noteOf(notes, marker.area, "area");
    const block = instructionBlock(project, area);

    const agents = await readOptional(root, "AGENTS.md");
    const claude = await readOptional(root, "CLAUDE.md");
    const agentText = replaceOrAppend(agents, block, "AGENTS.md");
    const claudeText = claude === null
      ? "@AGENTS.md\n"
      : hasAgentImport(claude) ? claude : replaceOrAppend(claude, block, "CLAUDE.md");

    const planned: PlannedFile[] = [
      { path: ".brain", before: existingMarker.raw, after: `${JSON.stringify(marker, null, 2)}\n` },
      { path: "AGENTS.md", before: agents, after: agentText },
      { path: "CLAUDE.md", before: claude, after: claudeText },
      ...await planSkill(root),
    ];
    await writePlan(root, planned);

    const action = (file: PlannedFile): "created" | "updated" | "unchanged" | "removed" =>
      file.before === null ? "created" : file.after === null ? "removed" : file.before === file.after ? "unchanged" : "updated";
    return {
      data: {
        repo_abs: root,
        marker: { path: ".brain", written: planned[0]!.before !== planned[0]!.after, value: marker },
        files: planned.slice(1).map((file) => ({ path: file.path, action: action(file) })),
      },
      human: `Linked ${root} to the brain.\n`,
    };
  },
};

async function openRepo(requested: string): Promise<string> {
  const path = resolve(requested);
  try {
    if (!(await stat(path)).isDirectory()) throw new BrainError("USAGE", `Repository path is not a directory: ${path}`);
    return await realpath(path);
  } catch (error) {
    if (error instanceof BrainError) throw error;
    throw new BrainError("USAGE", `Repository path does not exist or cannot be read: ${path}`);
  }
}

async function readMarker(root: string): Promise<{ raw: string | null; value: RepoMarker }> {
  const raw = await readOptional(root, ".brain");
  if (raw === null) return { raw, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new BrainError("INPUT_INVALID", `.brain is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isMarker(parsed)) throw new BrainError("INPUT_INVALID", ".brain must be an object with only repo, project, area and stacks");
  return { raw, value: parsed };
}

function buildMarker(
  previous: { raw: string | null; value: RepoMarker },
  root: string,
  options: Record<string, string | boolean | string[] | undefined>,
  notes: readonly Note[],
): { repo?: string; project?: string; area?: string; stacks?: string[] } {
  const marker: RepoMarker = { ...previous.value };
  marker.repo = options["repo-name"] as string | undefined ?? basename(root);

  const requestedProject = options.project as string | undefined;
  const requestedArea = options.area as string | undefined;
  if (requestedProject !== undefined) {
    const project = noteOf(notes, requestedProject, "project");
    marker.project = project.id;
    marker.area = requestedArea === undefined ? areaOf(project) : noteOf(notes, requestedArea, "area").id;
  } else if (requestedArea !== undefined) {
    marker.area = noteOf(notes, requestedArea, "area").id;
  }
  if (options.stack !== undefined) {
    const rawStacks = options.stack as string[];
    for (const stack of rawStacks) {
      if (!STACK.test(stack)) throw new BrainError("USAGE", `--stack must be lowercase kebab-case: ${stack}`);
    }
    marker.stacks = [...new Set(rawStacks)].sort();
  }
  if (marker.project !== undefined) noteOf(notes, marker.project, "project");
  if (marker.area !== undefined) noteOf(notes, marker.area, "area");
  if (marker.stacks !== undefined) marker.stacks = canonicalStacks(marker.stacks);
  return orderedMarker(marker);
}

function areaOf(project: Note): string {
  if (typeof project.attributes.area !== "string") {
    throw new BrainError("UNKNOWN_ID", `Project ${project.id} has no area`);
  }
  return project.attributes.area;
}

function noteOf(notes: readonly Note[], id: string, type: string): Note {
  const note = notes.find((candidate) => candidate.id === id && candidate.type === type);
  if (note === undefined) throw new BrainError("UNKNOWN_ID", `No ${type} with id ${id}`);
  return note;
}

function canonicalStacks(stacks: readonly string[]): string[] {
  if (!stacks.every((stack) => typeof stack === "string" && STACK.test(stack))) {
    throw new BrainError("INPUT_INVALID", ".brain stacks must be lowercase kebab-case strings");
  }
  return [...new Set(stacks)].sort();
}

function orderedMarker(marker: RepoMarker): RepoMarker {
  const ordered: RepoMarker = {};
  if (marker.repo !== undefined) ordered.repo = marker.repo;
  if (marker.project !== undefined) ordered.project = marker.project;
  if (marker.area !== undefined) ordered.area = marker.area;
  if (marker.stacks !== undefined) ordered.stacks = marker.stacks;
  return ordered;
}

function instructionBlock(project: Note | undefined, area: Note | undefined): string {
  const lines = [
    START,
    "## Ultimate Brain",
    "",
    "Managed by `brain link`; edits inside this block are overwritten.",
    "",
    `This repo is linked to the user's second brain${project === undefined && area === undefined ? "." : ":"}`,
  ];
  if (project !== undefined) lines.push(`- Project: ${String(project.attributes.title)} (\`${project.id}\`)`);
  if (area !== undefined) lines.push(`- Area: ${String(area.attributes.title)} (\`${area.id}\`)`);
  lines.push(
    "",
    "The brain holds decisions, key facts, people and meeting history that this repo does not.",
    "",
    "Consult it before you:",
    "- make or revisit a decision about scope, architecture, vendors or the client;",
    "- answer why something was decided, who someone is, or a date, budget or owner;",
    "- rely on a fact about the client or project that this repo does not state.",
    "",
    "How: use the `brain-query` skill, or run `brain query --candidates \"<question>\" --json` and read the notes it returns. Cite the note paths. Say when a fact is `contested` or `superseded`.",
    "",
    "The brain is read-only from this repo. Never edit its files from here.",
    END,
  );
  return lines.join("\n");
}

function replaceOrAppend(existing: string | null, block: string, file: string): string {
  if (existing === null || existing === "") return `${block}\n`;
  const range = blockRange(existing);
  if (range !== undefined) return `${existing.slice(0, range.start)}${block}${existing.slice(range.end)}`;
  if (existing.includes(START) || existing.includes(END)) {
    throw new BrainError("INPUT_INVALID", `${file} has malformed Ultimate Brain markers`);
  }
  return `${existing}${existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n"}${block}\n`;
}

function blockRange(content: string): { start: number; end: number } | undefined {
  const start = markerPositions(content, START);
  const end = markerPositions(content, END);
  if (start.length === 0 && end.length === 0) return undefined;
  if (start.length !== 1 || end.length !== 1 || start[0]! >= end[0]!) {
    throw new BrainError("INPUT_INVALID", "Ultimate Brain markers must appear exactly once and in order");
  }
  return { start: start[0]!, end: end[0]! + END.length };
}

function markerPositions(content: string, marker: string): number[] {
  const expression = new RegExp(`(?:^|\\n)${escapeRegExp(marker)}(?=\\n|$)`, "g");
  return [...content.matchAll(expression)].map((match) => match.index! + (match[0]!.startsWith("\n") ? 1 : 0));
}

function hasAgentImport(content: string): boolean {
  return content.split(/\r?\n/).some((line) => line === "@AGENTS.md");
}

async function readOptional(root: string, path: string): Promise<string | null> {
  try {
    const target = `${root}/${path}`;
    if ((await lstat(target)).isSymbolicLink()) throw new BrainError("OUTSIDE_ROOT", `Refusing to replace a symbolic link: ${target}`);
    return await readFile(target, "utf8");
  } catch (error) {
    if (error instanceof BrainError) throw error;
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw error;
  }
}

/** Product-owned `.agents/skills/brain-query/` (decision 0029): replace changed files, remove stale ones. */
async function planSkill(root: string): Promise<PlannedFile[]> {
  const shipped = await listShippedSkillFiles("brain-query");
  const planned: PlannedFile[] = [];
  const keep = new Set<string>();
  await assertPlainPath(root, ".agents/skills/brain-query", "folder");
  for (const file of shipped) {
    const path = `.agents/skills/${file.relative}`;
    await assertPlainPath(root, path);
    keep.add(path);
    planned.push({ path, before: await readOptional(root, path), after: file.content.toString("utf8") });
  }
  const folder = ".agents/skills/brain-query";
  for (const path of await listFiles(root, folder)) {
    await assertPlainPath(root, path);
    if (!keep.has(path)) planned.push({ path, before: await readOptional(root, path), after: null });
  }
  return planned.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

async function listFiles(root: string, folder: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(join(root, folder), { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")) return [];
    throw error;
  }
  const paths: string[] = [];
  for (const entry of entries) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await listFiles(root, path));
    else paths.push(path);
  }
  return paths;
}

async function writePlan(root: string, files: readonly PlannedFile[]): Promise<void> {
  const changed = files.filter((file) => file.before !== file.after);
  const done: PlannedFile[] = [];
  try {
    for (const file of changed) {
      if (file.after === null) await unlink(`${root}/${file.path}`);
      else {
        await ensureDirectory(root, file.path.split("/").slice(0, -1).join("/") || ".");
        await atomicWriteFile(root, file.path, file.after);
      }
      done.push(file);
    }
  } catch (error) {
    for (const file of done.reverse()) {
      if (file.before === null) await unlink(`${root}/${file.path}`).catch(() => undefined);
      else await atomicWriteFile(root, file.path, file.before).catch(() => undefined);
    }
    throw error;
  }
}

function isMarker(value: unknown): value is RepoMarker {
  if (!isRecord(value)) return false;
  if (!Object.keys(value).every((key) => ["repo", "project", "area", "stacks"].includes(key))) return false;
  return (value.repo === undefined || typeof value.repo === "string")
    && (value.project === undefined || typeof value.project === "string")
    && (value.area === undefined || typeof value.area === "string")
    && (value.stacks === undefined || Array.isArray(value.stacks));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
