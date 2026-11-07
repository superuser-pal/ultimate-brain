import { readMarker } from "./brain-marker.ts";
import { BrainError } from "./errors.ts";
import { isRecord } from "./input.ts";
import { globMatch, KIT_FILE, kitBytesIfAny, kitProblems, matchesAny, parseKitBytes, type HubContext, type Kit } from "./link-kit.ts";
import { checkIssueInput, parseIssues, parseMarkdownTasks, statusMap, unmappedOf, type IssueInput } from "./repo-tasks.ts";
import { assertAncestor, fileAtHead, filesAtHead, headCommit, lastTouched, openRepo, repoChanges, resolveCommit, type LinkedRepo } from "./repos.ts";
import { listWorkflows } from "./workflow-store.ts";

// The health check of spec/linked-repos.md §6: read-only.

export interface Check { code: string; severity: "error" | "warning" | "info"; message: string; path?: string }

export interface HealthOptions { issues?: unknown; rollupAsOf?: Date; now: Date }

const isArchived = (note: { attributes: Record<string, unknown> } | undefined): boolean =>
  note !== undefined && (note.attributes.lifecycle === "archived" || (isRecord(note.attributes.notion_fields) && note.attributes.notion_fields.archived === true));

/** The checks of one repo, in the table's order (§6). */
export async function repoHealth(repo: LinkedRepo, hub: HubContext, brainRoot: string, options: HealthOptions): Promise<Check[]> {
  const checks: Check[] = [];
  let path: string;
  try {
    path = await openRepo(repo, hub.home);
  } catch {
    return [{ code: "PATH_MISSING", severity: "error", message: `${repo.path} doesn't exist or isn't the top of a Git working tree: move it back, or record where it is now with brain repo refresh ${repo.name} --path <path>` }];
  }

  // The kit, when the entry has one: missing or invalid skips every check that reads its content.
  let kit: Kit | null = null;
  if (repo.kit !== undefined) {
    const bytes = await kitBytesIfAny(path);
    if (bytes === null) checks.push({ code: "KIT_MISSING", severity: "error", message: `${KIT_FILE} is gone from ${repo.name}`, path: KIT_FILE });
    else {
      const read = parseKitBytes(bytes);
      const problems = [...read.problems, ...(read.kit === null ? [] : await kitProblems(read.kit, hub, { entry: repo }))];
      for (const problem of problems) checks.push({ code: "KIT_INVALID", severity: "error", message: `${problem.pointer || "/"} ${problem.message}`, path: KIT_FILE });
      if (problems.length === 0) {
        kit = read.kit as Kit;
        if (read.sha256 !== repo.kit.sha256) checks.push({ code: "KIT_CHANGED", severity: "warning", message: `${KIT_FILE} changed since it was applied: run brain repo refresh ${repo.name}`, path: KIT_FILE });
        const committed = await fileAtHead(path, KIT_FILE);
        if (committed === null || !committed.equals(bytes)) checks.push({ code: "KIT_UNCOMMITTED", severity: "info", message: `${KIT_FILE} isn't committed in ${repo.name}: commit it there`, path: KIT_FILE });
      }
    }
  } else checks.push({ code: "NO_KIT", severity: "info", message: `${repo.name} has no link kit: the skill can write one, and brain repo refresh ${repo.name} applies it` });

  if (kit !== null) {
    const byId = new Map(hub.notes.map((note) => [note.id, note]));
    for (const id of [kit.placement.area, kit.placement.project]) {
      if (id !== undefined && isArchived(byId.get(id))) checks.push({ code: "PLACEMENT_ARCHIVED", severity: "warning", message: `${id} is archived: place ${repo.name} elsewhere or unlink it` });
    }
  }

  // The Git checks use the brain.json copies, so they run on legacy entries and broken kits too.
  let head: string | null = null;
  try { head = await headCommit(path); } catch { /* no commits yet */ }
  let commitKnown = true;
  if (repo.commit !== "") {
    try {
      if (head === null) throw new Error("no HEAD");
      await resolveCommit(path, repo.commit);
      await assertAncestor(path, repo.commit, head);
    } catch {
      commitKnown = false;
      checks.push({ code: "COMMIT_UNKNOWN", severity: "error", message: `The recorded commit ${repo.commit.slice(0, 12)} isn't an ancestor of HEAD (rewritten history): run brain repo record ${repo.name} --reset` });
    }
  }
  if (head !== null && commitKnown) {
    const { files } = await repoChanges(path, repo.patterns, repo.commit, head);
    const waiting = files.filter((file) => file.path !== KIT_FILE && !matchesAny(repo.never_read, file.path)).length;
    if (waiting > 0) checks.push({ code: "CHANGES_WAITING", severity: "info", message: `${waiting} file(s) changed since the last ingest` });
  }
  const atHead = (await filesAtHead(path)).filter((file) => file !== KIT_FILE);
  for (const pattern of repo.patterns) {
    if (!atHead.some((file) => globMatch(pattern, file))) checks.push({ code: "PATTERN_MATCHES_NOTHING", severity: "warning", message: `${pattern} matches no file at HEAD` });
  }
  for (const note of hub.notes) {
    if (note.type !== "source" || note.attributes.repo !== repo.name || typeof note.attributes.repo_path !== "string") continue;
    if (matchesAny(repo.never_read, note.attributes.repo_path)) checks.push({ code: "NEVER_READ_INGESTED", severity: "warning", message: `${note.id} came from ${note.attributes.repo_path}, which never_read now excludes; nothing was removed`, path: note.attributes.repo_path });
  }

  if (kit !== null) {
    for (const file of kit.methodology.files ?? []) {
      if (await fileAtHead(path, file) === null) checks.push({ code: "METHODOLOGY_FILE_MISSING", severity: "warning", message: `${file} doesn't exist at HEAD`, path: file });
    }
    const source = kit.tasks?.source;
    let text: Buffer | null = null;
    if (source?.kind === "markdown") {
      text = await fileAtHead(path, source.path);
      if (text === null) checks.push({ code: "TASK_SOURCE_MISSING", severity: "error", message: `The task source ${source.path} doesn't exist at HEAD`, path: source.path });
    }
    if (kit.tasks?.mode === "tracked-in-repo" && source !== undefined) {
      const map = statusMap(kit);
      let items = null;
      if (source.kind === "markdown" && text !== null) items = parseMarkdownTasks(text.toString("utf8"), source, map);
      else if ((source.kind === "github" || source.kind === "gitlab") && options.issues !== undefined) items = parseIssues(checkIssueInput(options.issues, source.kind), source.kind, map);
      for (const group of items === null ? [] : unmappedOf(items)) checks.push({ code: "STATUS_UNMAPPED", severity: "warning", message: `"${group.raw}" (${group.count}) maps to no status meaning: map it in ${KIT_FILE}` });
    }
    const open = listWorkflows(brainRoot).filter((workflow) => workflow.folder?.repo === repo.name && (workflow.state === "connected" || workflow.state === "paused"));
    if (kit.tasks?.mode === "connected" && open.length === 0) checks.push({ code: "CONNECTED_WITHOUT_WORKFLOW", severity: "warning", message: `${repo.name}'s tasks are connected, but no connected workflow names it: set one up or adopt the repo` });
    if (kit.tasks?.mode !== "connected" && open.length > 0) checks.push({ code: "WORKFLOW_WITHOUT_CONNECTED", severity: "warning", message: `${open[0]!.id} runs in ${repo.name}, but the kit's mode isn't connected` });
    const link = await readDotBrain(path);
    if (link !== null && (link.project !== kit.placement.project || link.area !== kit.placement.area)) checks.push({ code: "BRAIN_LINK_STALE", severity: "info", message: `.brain in ${repo.name} places it elsewhere than the kit: run brain link again`, path: ".brain" });
    if (kit.tasks?.mode === "tracked-in-repo" && options.rollupAsOf !== undefined) {
      const asOf = options.rollupAsOf;
      if (source?.kind === "markdown") {
        const touched = await lastTouched(path, source.path);
        if (touched !== null && touched.getTime() > asOf.getTime()) checks.push({ code: "ROLLUP_STALE", severity: "warning", message: `${source.path} changed after the rollup: rebuild it with brain repo tasks ${repo.name}`, path: source.path });
      } else if (options.now.getTime() - asOf.getTime() > 24 * 3600 * 1000) checks.push({ code: "ROLLUP_STALE", severity: "warning", message: `The rollup is more than 24 hours old: rebuild it with brain repo tasks ${repo.name}` });
    }
  }
  return checks;
}

/** The repo's `.brain`, read with the one marker reader (brain-marker.ts); a missing or malformed file is no link (`null`). */
async function readDotBrain(path: string): Promise<{ project?: string; area?: string } | null> {
  try {
    const read = await readMarker(path, "INPUT_INVALID", ".brain");
    return read === null ? null : { project: read.value.project, area: read.value.area };
  } catch {
    return null;
  }
}

/** Issue input for health: only meaningful with a name. */
export function assertIssuesNeedName(name: string | undefined, issues: unknown): void {
  if (issues !== undefined && name === undefined) throw new BrainError("USAGE", "brain repo health --input needs <name>");
}

export type { IssueInput };
