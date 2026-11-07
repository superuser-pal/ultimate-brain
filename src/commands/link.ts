import { lstat, readdir, readFile, realpath, rmdir, stat, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { Command, Warning } from "../lib/command.ts";
import { isProductRepository } from "../lib/brain-path.ts";
import { KEBAB, parseMarker, type MarkerSkills, type RepoMarker } from "../lib/brain-marker.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile, ensureDirectory } from "../lib/fs-safe.ts";
import type { Note } from "../lib/notes.ts";
import { scanNotes } from "../lib/notes.ts";
import { assertPlainPath, installedProduct } from "../lib/skills.ts";
import { competingCopies } from "../lib/skills-competing.ts";
import { homeOf, pinState, snapshotInvalid } from "../lib/skills-pin.ts";
import { packageProblem, packageSnapshot, sha256, TREES, type Manifest, type SnapshotSkill } from "../lib/skills-snapshot.ts";

const START = "<!-- ultimate-brain:start -->";
const END = "<!-- ultimate-brain:end -->";
const STACK = KEBAB;

/** The skills `link` installs and where their bytes come from (spec/skills-delivery.md §6.2). */
interface LinkSource { source: "brain" | "package"; manifest: Manifest; folder: string; skills: SnapshotSkill[] }

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
  async run({ args, brain, environment }) {
    const [requested] = args.positionals;
    if (requested === undefined) throw new BrainError("USAGE", "brain link needs a repository path");
    const root = await openRepo(requested);
    if (root === brain!.root || await isProductRepository(root)) {
      throw new BrainError("OUTSIDE_ROOT", "Refusing to write a brain or product repository as a consuming repository");
    }

    const warnings: Warning[] = [];
    const source = await linkSource(brain!.root, warnings);
    const names = source.skills.map((skill) => skill.name);
    const { notes } = await scanNotes(brain!.root);
    const existingMarker = await readMarker(root);
    const marker = buildMarker(existingMarker, root, args.options, notes);
    marker.skills = { name: source.manifest.name, version: source.manifest.version, integrity: source.manifest.integrity, names };
    const retired = (existingMarker.value.skills?.names ?? []).filter((name) => !names.includes(name));
    const project = marker.project === undefined ? undefined : noteOf(notes, marker.project, "project");
    const area = marker.area === undefined ? undefined : noteOf(notes, marker.area, "area");
    const block = instructionBlock(project, area, names);

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
    await writePlan(root, planned);
    for (const name of retired) for (const tree of TREES) await removeEmptyFolders(join(root, tree, name));

    const competing = competingCopies({ treeRoot: root, names, home: homeOf(environment.env), brainRoot: brain!.root });
    if (competing.length > 0) warnings.push({ code: "SKILLS_COMPETING", message: `${competing.length} competing skill copies; see data.skills.competing and remove them.` });

    const action = (file: PlannedFile): "created" | "updated" | "unchanged" | "removed" =>
      file.before === null ? "created" : file.after === null ? "removed" : file.before === file.after ? "unchanged" : "updated";
    return {
      data: {
        repo_abs: root,
        marker: { path: ".brain", written: planned[0]!.before !== planned[0]!.after, value: marker },
        files: planned.slice(1).map((file) => ({ path: file.path, action: action(file) })),
        skills: { source: source.source, name: source.manifest.name, version: source.manifest.version, integrity: source.manifest.integrity, names, competing },
      },
      warnings,
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
  if (marker.skills !== undefined) ordered.skills = marker.skills;
  return ordered;
}

/** The block of cli.md §5.12; the workflow lines join it when brain-workflow is among the linked skills (skills-delivery §9.7). */
function instructionBlock(project: Note | undefined, area: Note | undefined, linked: readonly string[]): string {
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
  );
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

/**
 * The linked skills and their source (spec/skills-delivery.md §6.2): a pinned brain's own `.agents/skills` copy, each file checked against
 * the lock before any write; an unpinned brain's package snapshot, which must be compatible.
 */
async function linkSource(brainRoot: string, warnings: Warning[]): Promise<LinkSource> {
  const product = installedProduct();
  const pin = pinState(brainRoot, () => product.version, { drift: false });
  if (pin.lock !== null) {
    const manifest = pin.lock.snapshot;
    const skills = manifest.skills.filter((skill) => skill.targets.includes("linked_repo"));
    for (const skill of skills) {
      for (const file of skill.files) {
        const path = `.agents/skills/${skill.name}/${file.path}`;
        let bytes: Buffer | null = null;
        try { if ((await lstat(join(brainRoot, path))).isFile()) bytes = await readFile(join(brainRoot, path)); } catch { /* missing */ }
        if (bytes === null || bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
          throw new BrainError("SKILLS_SNAPSHOT_MISSING", `${path} differs from the pinned skills (${manifest.name} ${manifest.version}). Run brain upgrade in the brain, then brain link again.`, {
            state: pin.state, name: manifest.name, version: manifest.version, cli: manifest.cli, running: product.version, installed_by: pin.lock.installed_by, path,
          });
        }
      }
    }
    return { source: "brain", manifest, folder: join(brainRoot, ".agents", "skills"), skills };
  }
  const pkg = packageSnapshot(product.root, product.version);
  const problem = packageProblem(pkg);
  if (problem !== null) throw snapshotInvalid(problem, product.version);
  warnings.push({ code: "SKILLS_UNPINNED", message: `The brain's skills are not pinned; the linked repo got the skills of ultimate-brain ${product.version}. Run brain upgrade in the brain.` });
  return { source: "package", manifest: pkg.manifest!, folder: pkg.folder, skills: pkg.manifest!.skills.filter((skill) => skill.targets.includes("linked_repo")) };
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
