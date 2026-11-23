/**
 * A task's Area follows its Project, or with no Project its Factory (0.18.0, decisions 0113 §9 and 0114; capture-and-review §6.5): the Area a new
 * task gets (cli §5.14.5) and the fill list `sync plan` gives for the unfinished tasks with no Area the agent's read passes in (cli §5.14.2).
 * Nothing of a task is stored, and nothing is read from Notion here.
 */
import { isRecord } from "./input.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { taskProperty } from "./notion-change.ts";
import { linkedRepos } from "./repos.ts";
import { taskState, type TaskRow } from "./tracked-tasks.ts";
import type { Workspace } from "./workspace.ts";

/** A `task_areas` item of a sync plan: the skill writes it *if empty* in its publish step. */
export interface TaskArea {
  page_id: string;
  title: string;
  area: string;
  from: "project" | "factory";
  property: string;
  payload: { type: "relation"; value: string[]; mode: "if_empty" };
}

/** A `task_areas_unset` item: no Area is set, and why. */
export interface TaskAreaUnset {
  page_id: string;
  title: string;
  reason: "DIFFERENT_AREAS" | "NOT_IN_BRAIN";
}

/** Factories is on only when `brain.json` says so (schema §12). */
export const factoriesOn = (config: Record<string, unknown>): boolean => isRecord(config.modules) && config.modules.factories === true;

interface Factory { id: string; repo?: string; area?: string; notion?: string }
const factoriesOf = (config: Record<string, unknown>): Factory[] => (Array.isArray(config.factories) ? config.factories.filter(isRecord) : []) as unknown as Factory[];

/** A Factory's Area (schema §12): its linked repo's, or the entry's own for a plain folder and for an unlinked repo. */
const factoryArea = (config: Record<string, unknown>, factory: Factory): string | undefined => factory.area ?? linkedRepos(config).find((repo) => repo.name === factory.repo)?.area;

const distinct = (areas: ReadonlyArray<unknown>): string[] => [...new Set(areas.filter((area): area is string => typeof area === "string"))];

/** The Area of a task the brain creates: its projects' shared one; with no project `own` (the meeting's or the question's); never a choice between Areas. */
export function newTaskArea(workspace: Workspace, projects: readonly string[], own: unknown): { area?: string; differ: boolean } {
  if (projects.length === 0) return { ...(typeof own === "string" ? { area: own } : {}), differ: false };
  const areas = distinct(projects.map((id) => workspace.get(id)?.attributes.area));
  return { ...(areas.length === 1 ? { area: areas[0]! } : {}), differ: areas.length > 1 };
}

/** The notes this plan creates from Notion rows, as the fill reads them. */
export interface PlannedCreate { type: string; id?: string; frontmatter: Record<string, unknown> }

/**
 * One `tasks` row of the snapshot with the Tasks module on, read for its empty Area alone (cli §5.14.2): a `task_areas` or `task_areas_unset` item,
 * or nothing when the Area was not read as empty, the status was not read or is finished, or the task has neither a Project nor a Factory.
 */
export function planTaskArea(workspace: Workspace, row: TaskRow, creates: readonly PlannedCreate[], out: { task_areas: TaskArea[]; task_areas_unset: TaskAreaUnset[] }): void {
  const property = taskProperty(workspace, "area");
  const value = row.properties[property];
  if (property === "" || !Array.isArray(value) || value.length > 0) return;
  const statusName = taskProperty(workspace, "status");
  if (statusName !== "") {
    const status = row.properties[statusName];
    // An empty status reads as open (assistant.md §3.1); one that was not read decides nothing.
    if (status === undefined || (typeof status === "string" && status.trim().toLowerCase() === "done")) return;
  }
  if (taskState(row, workspace.config) !== null) return;

  // A relation with no mapping (or a Factory with the module off) is none; a mapped one the read left out may hold anything.
  const pages = (name: string): string[] | undefined => {
    if (name === "") return [];
    const read = row.properties[name];
    return Array.isArray(read) ? read.filter((page): page is string => typeof page === "string") : undefined;
  };
  const projects = pages(taskProperty(workspace, "project"));
  if (projects === undefined) return;
  const factories = projects.length > 0 ? [] : pages(factoriesOn(workspace.config) ? taskProperty(workspace, "factory") : "");
  if (factories === undefined || projects.length + factories.length === 0) return;

  const titleName = taskProperty(workspace, "title");
  const title = row.properties[titleName];
  const head = { page_id: row.page_id, title: typeof title === "string" ? title : "" };
  const unset = (reason: TaskAreaUnset["reason"]) => out.task_areas_unset.push({ ...head, reason });

  const areaOf = (page: string): unknown => {
    if (projects.length === 0) {
      const factory = factoriesOf(workspace.config).find((entry) => entry.notion === page);
      return factory === undefined ? undefined : factoryArea(workspace.config, factory);
    }
    const project = workspace.notes.find((note) => note.type === "project" && note.attributes.notion === page);
    return project === undefined ? creates.find((item) => item.type === "project" && item.frontmatter.notion === page)?.frontmatter.area : project.attributes.area;
  };
  const areas = [...projects, ...factories].map(areaOf);
  if (areas.some((area) => typeof area !== "string")) { unset("NOT_IN_BRAIN"); return; }
  const shared = distinct(areas);
  if (shared.length > 1) { unset("DIFFERENT_AREAS"); return; }
  const area = shared[0]!;
  const note: Note | undefined = workspace.get(area);
  const page = note === undefined ? creates.find((item) => item.id === area)?.frontmatter.notion : note.attributes.notion;
  if (typeof page !== "string") { unset("NOT_IN_BRAIN"); return; }
  out.task_areas.push({ ...head, area, from: projects.length > 0 ? "project" : "factory", property, payload: { type: "relation", value: [page], mode: "if_empty" } });
}

export const byPage = (a: { page_id: string }, b: { page_id: string }): number => compareCodePoints(a.page_id, b.page_id);
