import { lstat, readdir, readFile, realpath, rmdir, unlink } from "node:fs/promises";
import { basename, join } from "node:path";

import { KEBAB, parseMarker, type RepoMarker } from "./brain-marker.ts";
import { BrainError } from "./errors.ts";
import { atomicWriteFile, ensureDirectory } from "./fs-safe.ts";
import type { Note } from "./notes.ts";
import { assertPlainPath } from "./skills.ts";
import { TREES, type Manifest, type SnapshotSkill } from "./skills-snapshot.ts";

/**
 * The files `brain link` manages in a linked repo (spec/cli.md §5.12): `.brain`, the instruction block in AGENTS.md and CLAUDE.md, and
 * the linked skills in both trees. Shared by `brain link` and by `brain upgrade`, which refreshes every registered project (§5.15 step 9).
 */
export const START = "<!-- ultimate-brain:start -->";
export const END = "<!-- ultimate-brain:end -->";
const STACK = KEBAB;

/** The skills `link` installs and where their bytes come from (spec/skills-delivery.md §6.2). */
export interface LinkSource { source: "brain" | "package"; manifest: Manifest; folder: string; skills: SnapshotSkill[] }

export interface PlannedFile {
  path: string;
  before: string | null;
  after: string | null;
}


/** What `brain link` would write in `root`: `.brain`, AGENTS.md, CLAUDE.md and the skill files, in that order, with the retired skills. */
export async function planLinkedRepo(root: string, input: {
  notes: readonly Note[];
  config: Record<string, unknown>;
  source: LinkSource;
  options: Record<string, string | boolean | string[] | undefined>;
}): Promise<{ planned: PlannedFile[]; marker: RepoMarker; retired: string[]; names: string[] }> {
  const { notes, source } = input;
  const names = source.skills.map((skill) => skill.name);
  const existingMarker = await readMarker(root);
  const marker = buildMarker(existingMarker, root, input.options, notes);
  marker.skills = { name: source.manifest.name, version: source.manifest.version, integrity: source.manifest.integrity, names };
  const retired = (existingMarker.value.skills?.names ?? []).filter((name) => !names.includes(name));
  const project = marker.project === undefined ? undefined : noteOf(notes, marker.project, "project");
  const area = marker.area === undefined ? undefined : noteOf(notes, marker.area, "area");
  const block = instructionBlock(project, area, names, recallOpening(input.config));

  const agents = await readOptional(root, "AGENTS.md");
  const agentText = replaceOrAppend(agents, block, "AGENTS.md");
  const claudeIsAgents = await claudeLinksToAgents(root, agents);
  const claude = claudeIsAgents ? agentText : await readOptional(root, "CLAUDE.md");
  const claudeText = claudeIsAgents || claude === null
    ? claude ?? "@AGENTS.md\n"
    : hasAgentImport(claude) ? claude : replaceOrAppend(claude, block, "CLAUDE.md");

  const planned: PlannedFile[] = [
    { path: ".brain", before: existingMarker.raw, after: `${JSON.stringify(marker, null, 2)}\n` },
    { path: "AGENTS.md", before: agents, after: agentText },
    { path: "CLAUDE.md", before: claude, after: claudeText },
    ...await planSkills(root, source, retired),
  ];
  return { planned, marker, retired, names };
}

/** Write a plan, then remove the emptied folders of the retired skills. */
export async function applyLinkedRepo(root: string, planned: readonly PlannedFile[], retired: readonly string[]): Promise<void> {
  await writePlan(root, planned);
  for (const name of retired) for (const tree of TREES) await removeEmptyFolders(join(root, tree, name));
}

/** A planned file's action as `brain link` reports it. */
export function plannedAction(file: PlannedFile): "created" | "updated" | "unchanged" | "removed" {
  return file.before === null ? "created" : file.after === null ? "removed" : file.before === file.after ? "unchanged" : "updated";
}

async function readMarker(root: string): Promise<{ raw: string | null; value: RepoMarker }> {
  const raw = await readOptional(root, ".brain");
  if (raw === null) return { raw, value: {} };
  return { raw, value: parseMarker(raw, "INPUT_INVALID", ".brain") };
}

function buildMarker(
  previous: { raw: string | null; value: RepoMarker },
  root: string,
  options: Record<string, string | boolean | string[] | undefined>,
  notes: readonly Note[],
): RepoMarker {
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

export function noteOf(notes: readonly Note[], id: string, type: string): Note {
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
  if (marker.skills !== undefined) ordered.skills = marker.skills;
  return ordered;
}

/** cli.md §5.12 "Recall paragraph" (0074, memory.md §7), normative bytes. */
const RECALL_PARAGRAPH = "At the start of substantive work, run `brain recall --pack --json` here and read its `text`: the user's lessons for this repo and where its work stopped. Mention a memory only when it shapes your approach. When the user says \"wrap up\", run the closing review of the `brain-query` skill: the lessons the user approves there are the one write this repo makes to the brain.";

/** Whether `settings.recall` is `opening` (schema §12); `off` or absent leaves the paragraph out. */
export function recallOpening(config: Record<string, unknown>): boolean {
  const settings = config.settings;
  return isRecord(settings) && settings.recall === "opening";
}

/**
 * The block of cli.md §5.12; the recall paragraph follows the `How:` paragraph when `settings.recall` is `opening`,
 * and the workflow lines join it when brain-workflow is among the linked skills (skills-delivery §9.7).
 */
export function instructionBlock(project: Note | undefined, area: Note | undefined, linked: readonly string[], recall: boolean): string {
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
    "How: use the `brain-query` skill, or run `brain query --candidates \"<question>\" --json` and read the notes it returns with `brain query --read <id> --json`, not by opening the brain's files: only these commands leave out what the user excluded or has not approved. Cite each note by its path, or by its `cite` when it has none. Say when a fact is `contested` or `superseded`; read a replaced memory only with `--historical`, for a question about the past.",
  );
  if (recall) lines.push("", RECALL_PARAGRAPH);
  const workflow = linked.includes("brain-workflow");
  if (workflow) {
    const adopt = linked.includes("brain-workflow-adopt") ? "; to take over its existing plans and tasks, use `brain-workflow-adopt`." : ".";
    lines.push("", `To track this repo's work, the standard way or connected to a Notion Project or Area, use the \`brain-workflow\` skill${adopt}`);
  }
  lines.push(
    "",
    `The brain is read-only from this repo. Never edit its files from here.${workflow ? " A connected workflow's records change only through `brain workflow` commands." : ""}`,
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

export function blockRange(content: string): { start: number; end: number } | undefined {
  const start = markerPositions(content, START);
  const end = markerPositions(content, END);
  if (start.length === 0 && end.length === 0) return undefined;
  if (start.length !== 1 || end.length !== 1 || start[0]! >= end[0]!) {
    throw new BrainError("INPUT_INVALID", "Ultimate Brain markers must appear exactly once and in order");
  }
  return { start: start[0]!, end: end[0]! + END.length };
}

export function markerPositions(content: string, marker: string): number[] {
  const expression = new RegExp(`(?:^|\\n)${escapeRegExp(marker)}(?=\\n|$)`, "g");
  return [...content.matchAll(expression)].map((match) => match.index! + (match[0]!.startsWith("\n") ? 1 : 0));
}

export function hasAgentImport(content: string): boolean {
  return content.split(/\r?\n/).some((line) => line === "@AGENTS.md");
}

/**
 * Whether the repo's CLAUDE.md is a symbolic link to its own AGENTS.md (spec/cli.md §5.12 step 2): such a link is left alone and the block
 * goes only into AGENTS.md. Any other symbolic CLAUDE.md is refused with INSTRUCTIONS_SYMLINK before any write.
 */
async function claudeLinksToAgents(root: string, agents: string | null): Promise<boolean> {
  const claudePath = join(root, "CLAUDE.md");
  try {
    if (!(await lstat(claudePath)).isSymbolicLink()) return false;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
  let resolved: string | null = null;
  try { resolved = await realpath(claudePath); } catch { /* dangling */ }
  if (agents !== null && resolved !== null && resolved === await realpath(join(root, "AGENTS.md"))) return true;
  throw new BrainError(
    "INSTRUCTIONS_SYMLINK",
    `${claudePath} is a symbolic link that doesn't resolve to this repo's AGENTS.md. Replace it with a file holding the single line @AGENTS.md, or point it at AGENTS.md, then run brain link again.`,
  );
}

export async function readOptional(root: string, path: string): Promise<string | null> {
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


/** Product-owned linked skills (decisions 0029, 0038, 0059): replace changed files, remove stale ones, and remove retired skills. */
async function planSkills(root: string, source: LinkSource, retired: readonly string[]): Promise<PlannedFile[]> {
  const planned: PlannedFile[] = [];
  for (const prefix of TREES) {
    for (const skill of source.skills) {
      const folder = `${prefix}/${skill.name}`;
      const keep = new Set<string>();
      await assertPlainPath(root, folder, "folder");
      for (const file of skill.files) {
        const path = `${folder}/${file.path}`;
        await assertPlainPath(root, path);
        keep.add(path);
        planned.push({ path, before: await readOptional(root, path), after: (await readFile(join(source.folder, skill.name, file.path))).toString("utf8") });
      }
      for (const path of await listFiles(root, folder)) {
        await assertPlainPath(root, path);
        if (!keep.has(path)) planned.push({ path, before: await readOptional(root, path), after: null });
      }
    }
    for (const name of retired) {
      const folder = `${prefix}/${name}`;
      await assertPlainPath(root, folder, "folder");
      for (const path of await listFiles(root, folder)) {
        await assertPlainPath(root, path);
        planned.push({ path, before: await readOptional(root, path), after: null });
      }
    }
  }
  return planned.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Remove `folder` and the folders under it once they are empty. */
async function removeEmptyFolders(folder: string): Promise<void> {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) if (entry.isDirectory()) await removeEmptyFolders(join(folder, entry.name));
  await rmdir(folder).catch(() => undefined);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
