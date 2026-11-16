/**
 * Tasks kept as documents (0.16.0, decision 0100 §1; spec/cli.md §5.14.1, §5.14.2; capture-and-review §13): a Tasks row whose Document asked box
 * is ticked becomes a `task_documents` item. The skill reads the page, writes the `task` source and its whole Document, then clears the box.
 */
import { isRecord } from "./input.ts";
import { modulesOf } from "./modules.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import type { Workspace } from "./workspace.ts";

/** A `task_documents` item of a sync plan (cli §5.14.2). */
export interface TaskDocumentRequest {
  page_id: string;
  title: string;
  projects: string[];
  area: string | null;
  question: string | null;
  source: string | null;
  existing: string | null;
}

interface Row { database: string; page_id: string; properties: Record<string, unknown> }

/** The mapped names of the Tasks properties this reads (schema §12). */
function mapping(config: Record<string, unknown>): { documentAsked: string; title: string; project: string; area: string } {
  const notion = isRecord(config.notion) ? config.notion : {};
  const tasks = isRecord(notion.tasks) ? notion.tasks : {};
  const properties = isRecord(tasks.properties) ? tasks.properties : {};
  const name = (key: string) => typeof properties[key] === "string" ? properties[key] as string : "";
  return { documentAsked: name("document_asked"), title: name("title"), project: name("project"), area: name("area") };
}

/** The latest version of the `task` source keyed by this page (schema §4, "Versions"), or undefined when the brain has none. */
export function taskSourceOf(workspace: Workspace, pageId: string): Note | undefined {
  const keyed = workspace.notes.filter((note) => note.type === "source" && note.attributes.kind === "task" && note.attributes.source_key === `notion:${pageId}`);
  const replaced = new Set(keyed.map((note) => note.attributes.replaces).filter((id): id is string => typeof id === "string"));
  return keyed.filter((note) => !replaced.has(note.id)).sort((a, b) => compareCodePoints(a.id, b.id))[0];
}

/**
 * One `tasks` row of the snapshot, read for Document asked alone (cli §5.14.2): ticked → a `task_documents` item, or `ignored` with Documents off
 * (MODULE_OFF); unticked, or no Document asked mapping → nothing. Nothing else of the task is read.
 */
export function planTaskDocument(workspace: Workspace, row: Row, out: { task_documents: TaskDocumentRequest[]; ignored: Array<Record<string, unknown>> }): void {
  const names = mapping(workspace.config);
  if (names.documentAsked === "" || row.properties[names.documentAsked] !== true) return;
  if (!modulesOf(workspace.config).documents) { out.ignored.push({ database: "tasks", page_id: row.page_id, brain_id: null, property: "Document asked", reason: "MODULE_OFF" }); return; }
  const pages = (name: string): string[] => name === "" || !Array.isArray(row.properties[name]) ? [] : (row.properties[name] as unknown[]).filter((page): page is string => typeof page === "string");
  // A page no note has is left out.
  const notesOf = (name: string, type: string): string[] => [...new Set(pages(name).map((page) => workspace.notes.find((note) => note.type === type && note.attributes.notion === page)?.id).filter((id): id is string => id !== undefined))].sort(compareCodePoints);
  const title = names.title === "" ? undefined : row.properties[names.title];
  // The question the task tracks (0099 §3): an open or answered one; a dropped question's task is the to-do it became.
  const question = workspace.notes.filter((note) => note.type === "question" && note.attributes.task === row.page_id && note.attributes.dropped === undefined).sort((a, b) => compareCodePoints(a.id, b.id))[0];
  const source = taskSourceOf(workspace, row.page_id);
  const existing = source === undefined ? undefined : workspace.notes.find((note) => note.type === "reference" && note.attributes.origin === "whole" && Array.isArray(note.attributes.sources) && note.attributes.sources[0] === source.id);
  out.task_documents.push({
    page_id: row.page_id,
    title: typeof title === "string" ? title : "",
    projects: notesOf(names.project, "project"),
    area: notesOf(names.area, "area")[0] ?? null,
    question: question?.id ?? null,
    source: source?.id ?? null,
    existing: existing?.id ?? null,
  });
}
