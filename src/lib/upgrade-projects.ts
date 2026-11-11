import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { join } from "node:path";

import { isProductRepository } from "./brain-path.ts";
import { parseMarker, type RepoMarker } from "./brain-marker.ts";
import type { Warning } from "./command.ts";
import { BrainError } from "./errors.ts";
import { applyLinkedRepo, END, hasAgentImport, plannedAction, planLinkedRepo, START, type LinkSource, type PlannedFile } from "./managed-block.ts";
import type { Note } from "./notes.ts";
import { expandPath, linkedRepos } from "./repos.ts";
import { competingCopies, competingMessage } from "./skills-competing.ts";
import { sha256, TREES, type Manifest } from "./skills-snapshot.ts";

/**
 * The linked projects one `brain upgrade` reaches (spec/cli.md §5.15 step 9; eligibility.md §11; decision 0077 §4): every `repos` entry of
 * brain.json, refreshed as `brain link` writes it, or reported unfinished with its reason and left exactly as it was.
 */

export type ProjectState = "upgraded" | "unchanged" | "unfinished" | "not_linked";
export type UnfinishedReason = "path_missing" | "refused" | "block_missing" | "block_damaged" | "conflicting_copies" | "write_failed" | "definitions_differ";

export interface ProjectReport {
  name: string;
  path: string;
  state: ProjectState;
  reason: UnfinishedReason | null;
  message: string | null;
  files: Array<{ path: string; action: "created" | "updated" | "removed" }>;
}

interface ProjectPlan {
  report: ProjectReport;
  root?: string;
  planned?: PlannedFile[];
  retired?: string[];
}

export interface ProjectsInput {
  brainRoot: string;
  config: Record<string, unknown>;
  notes: readonly Note[];
  /** The package snapshot this upgrade pins: the projects' skills come from it, as `brain link` takes them from the pinned brain. */
  manifest: Manifest;
  folder: string;
  /** For `~/` in a stored path (as the `repo` commands expand it). */
  homeDirectory: string | undefined;
  /** `HOME`, for the global competing copies (skills-delivery §5.2); undefined skips them. */
  home: string | undefined;
}

class Unfinished extends Error {
  readonly reason: UnfinishedReason;
  constructor(reason: UnfinishedReason, message: string) { super(message); this.reason = reason; }
}

/** Judge and plan every registered project, writing nothing (step 9, "Judged before any write in that project"). */
export async function planProjects(input: ProjectsInput): Promise<ProjectPlan[]> {
  const skills = input.manifest.skills.filter((skill) => skill.targets.includes("linked_repo"));
  const source: LinkSource = { source: "brain", manifest: input.manifest, folder: input.folder, skills };
  const brainReal = await realpath(input.brainRoot);
  const plans: ProjectPlan[] = [];
  for (const entry of linkedRepos(input.config)) {
    const name = typeof entry.name === "string" ? entry.name : "";
    const stored = typeof entry.path === "string" ? entry.path : "";
    const report: ProjectReport = { name, path: stored, state: "unchanged", reason: null, message: null, files: [] };
    try {
      plans.push(await planProject(report, stored, source, brainReal, input));
    } catch (error) {
      if (!(error instanceof Unfinished)) throw error;
      plans.push({ report: { ...report, state: "unfinished", reason: error.reason, message: error.message } });
    }
  }
  return plans;
}

async function planProject(report: ProjectReport, stored: string, source: LinkSource, brainReal: string, input: ProjectsInput): Promise<ProjectPlan> {
  let root: string;
  try {
    if (stored === "") throw new Error("no path");
    const path = expandPath(stored, input.homeDirectory);
    if (!(await stat(path)).isDirectory()) throw new Error("not a folder");
    await readdir(path);
    root = await realpath(path);
  } catch {
    throw new Unfinished("path_missing", `${stored === "" ? "(no path)" : stored} doesn't exist, isn't a folder or can't be read`);
  }
  if (root === brainReal || await isProductRepository(root)) throw new Unfinished("refused", `${stored} is the brain or the product repository`);

  const marker = await readFileIn(root, ".brain");
  const agents = await readFileIn(root, "AGENTS.md");
  const claude = await readFileIn(root, "CLAUDE.md");
  if (marker === null && !hasMarker(agents) && !hasMarker(claude)) return { report: { ...report, state: "not_linked" } };
  let parsed: RepoMarker = {};
  if (marker !== null) {
    try { parsed = parseMarker(marker, "INPUT_INVALID", ".brain"); } catch (error) { throw new Unfinished("refused", messageOf(error)); }
  }

  const agentsBlock = judgeBlock(agents, "AGENTS.md");
  if (claude !== null && !(await claudeIsAgents(root)) && !hasAgentImport(claude)) {
    const claudeBlock = judgeBlock(claude, "CLAUDE.md");
    if (claudeBlock !== agentsBlock) throw new Unfinished("conflicting_copies", "CLAUDE.md's managed block differs from AGENTS.md's");
  }
  const names = source.skills.map((skill) => skill.name);
  const competing = competingCopies({ treeRoot: root, names, home: input.home, brainRoot: input.brainRoot, brainSettings: null })
    .filter((copy) => copy.kind === "duplicate" || copy.kind === "global");
  if (competing.length > 0) throw new Unfinished("conflicting_copies", competingMessage(competing[0]!));

  let plan: Awaited<ReturnType<typeof planLinkedRepo>>;
  try {
    // No options, so the project keeps its placement; its `repo` name is passed back, since `link` would reset it to the folder's name.
    plan = await planLinkedRepo(root, { notes: input.notes, config: input.config, source, options: parsed.repo === undefined ? {} : { "repo-name": parsed.repo } });
  } catch (error) {
    if (error instanceof BrainError) throw new Unfinished("refused", error.message);
    throw error;
  }
  const files = plan.planned.filter((file) => file.before !== file.after).map((file) => ({ path: file.path, action: plannedAction(file) as "created" | "updated" | "removed" }));
  return { report: { ...report, state: files.length > 0 ? "upgraded" : "unchanged", files }, root, planned: plan.planned, retired: plan.retired };
}

/** The file's text, null when missing; a symbolic link to `AGENTS.md` (CLAUDE.md) is read through, any other is a refusal. */
async function readFileIn(root: string, path: string): Promise<string | null> {
  const target = join(root, path);
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink()) {
      if (path === "CLAUDE.md" && await claudeIsAgents(root)) return null;
      throw new Unfinished("refused", path === "CLAUDE.md"
        ? "CLAUDE.md is a symbolic link that doesn't resolve to this repo's AGENTS.md"
        : `Refusing to replace a symbolic link: ${path}`);
    }
    if (!info.isFile()) throw new Unfinished("refused", `${path} is not a file`);
    return await readFile(target, "utf8");
  } catch (error) {
    if (error instanceof Unfinished) throw error;
    if (isNodeError(error) && error.code === "ENOENT") return null;
    throw new Unfinished("path_missing", `${path} can't be read`);
  }
}

async function claudeIsAgents(root: string): Promise<boolean> {
  try {
    if (!(await lstat(join(root, "CLAUDE.md"))).isSymbolicLink()) return false;
    return await realpath(join(root, "CLAUDE.md")) === await realpath(join(root, "AGENTS.md"));
  } catch {
    return false;
  }
}

function lines(text: string, marker: string): number[] {
  const out: number[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    if (line === marker) out.push(at);
    at += line.length + 1;
  }
  return out;
}

function hasMarker(text: string | null): boolean {
  return text !== null && (lines(text, START).length > 0 || lines(text, END).length > 0);
}

/** The one managed block of an instruction file, or the reason it can't be refreshed (step 9's table). */
function judgeBlock(text: string | null, file: string): string {
  if (text === null) throw new Unfinished("block_missing", `${file} is missing`);
  const starts = lines(text, START);
  const ends = lines(text, END);
  if (starts.length === 0 && ends.length === 0) throw new Unfinished("block_missing", `${file} has no managed block`);
  const pairs = starts.length === ends.length && starts.every((start, index) => start < ends[index]! && (index === 0 || ends[index - 1]! < start));
  if (!pairs) throw new Unfinished("block_damaged", `${file}'s managed-block markers are unpaired, out of order or repeated`);
  if (starts.length > 1) throw new Unfinished("conflicting_copies", `${file} holds ${starts.length} managed blocks`);
  return text.slice(starts[0]!, ends[0]! + END.length);
}

/** Write each planned project, then check both agents' definitions there (eligibility.md §11 step 2). */
export async function writeProjects(plans: readonly ProjectPlan[], manifest: Manifest): Promise<void> {
  const skills = manifest.skills.filter((skill) => skill.targets.includes("linked_repo"));
  for (const plan of plans) {
    if (plan.root === undefined || plan.planned === undefined) continue;
    const report = plan.report;
    if (report.state === "upgraded") {
      try {
        await applyLinkedRepo(plan.root, plan.planned, plan.retired ?? []);
      } catch (error) {
        Object.assign(report, { state: "unfinished", reason: "write_failed", message: messageOf(error), files: [] });
        continue;
      }
    }
    const differs = await projectDefinitionsDiffer(plan.root, plan.planned, skills);
    if (differs !== null) Object.assign(report, { state: "unfinished", reason: "definitions_differ", message: differs });
  }
}

async function projectDefinitionsDiffer(root: string, planned: readonly PlannedFile[], skills: Manifest["skills"]): Promise<string | null> {
  const skillFiles = await skillsDiffer(root, skills);
  if (skillFiles !== null) return skillFiles;
  const agents = await readOptionalText(join(root, "AGENTS.md"));
  const expected = planned.find((file) => file.path === "AGENTS.md")!.after!;
  if (agents !== expected) return "AGENTS.md doesn't hold the written block";
  let block: string;
  try { block = judgeBlock(agents, "AGENTS.md"); } catch (error) { return messageOf(error); }
  if (await claudeIsAgents(root)) return null;
  const claude = await readOptionalText(join(root, "CLAUDE.md"));
  if (claude === null) return "CLAUDE.md is missing, so Claude Code doesn't reach the block";
  if (hasAgentImport(claude)) return null;
  try {
    if (judgeBlock(claude, "CLAUDE.md") !== block) return "CLAUDE.md's block differs from AGENTS.md's";
  } catch (error) {
    return messageOf(error);
  }
  return null;
}

/** The first file of `skills` whose bytes in either tree aren't the snapshot's, or null (spec/cli.md §5.15 step 9, "Both agents"). */
export async function skillsDiffer(root: string, skills: Manifest["skills"]): Promise<string | null> {
  for (const tree of TREES) {
    for (const skill of skills) {
      for (const file of skill.files) {
        const path = `${tree}/${skill.name}/${file.path}`;
        let bytes: Buffer | null = null;
        try { if ((await lstat(join(root, path))).isFile()) bytes = await readFile(join(root, path)); } catch { /* missing */ }
        if (bytes === null || bytes.length !== file.bytes || sha256(bytes) !== file.sha256) return `${path} doesn't hold the snapshot's bytes`;
      }
    }
  }
  return null;
}

async function readOptionalText(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch { return null; }
}

/** One `PROJECT_UNFINISHED` warning per unfinished project. */
export function projectWarnings(reports: readonly ProjectReport[]): Warning[] {
  return reports.filter((report) => report.state === "unfinished").map((report) => ({ code: "PROJECT_UNFINISHED", message: `${report.name}: ${report.message}` }));
}

export const UNTRACKED_LINE = "Folders linked with brain link alone aren't tracked by the upgrade: register them with brain repo add, or run brain link there again.";
export const FRESH_SESSIONS_LINE = "Start fresh agent sessions in the brain and in every project: a session opened before the upgrade keeps the old instructions.";

/** `data.next`: the closing lines, in order (step 9, "Human output"). */
export function nextLines(reports: readonly ProjectReport[]): string[] {
  return [
    ...(reports.some((report) => report.state === "upgraded") ? ["Commit what changed in each upgraded project."] : []),
    UNTRACKED_LINE,
    FRESH_SESSIONS_LINE,
  ];
}

/** The human output's closing lines: the counts, each unfinished project, then `data.next`. */
export function projectsHuman(reports: readonly ProjectReport[]): string {
  const count = (state: ProjectState) => reports.filter((report) => report.state === state).length;
  const notLinked = count("not_linked");
  const lines = [`Projects: ${count("upgraded")} upgraded, ${count("unchanged")} unchanged, ${count("unfinished")} unfinished${notLinked > 0 ? `, ${notLinked} not linked` : ""}.`];
  for (const report of reports) if (report.state === "unfinished") lines.push(`  ${report.name}: ${report.message}`);
  return `${[...lines, ...nextLines(reports)].join("\n")}\n`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
