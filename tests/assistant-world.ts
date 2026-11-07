// Synthetic brains and snapshots for the `brain assistant` tests (spec/assistant.md, CC-143). Every name is invented.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";

import { stringify } from "yaml";

import { brain, type CliRun } from "./helpers.ts";

export const AS_OF = "2026-11-06T10:00:00Z";

/** A dashed page id: `<2 hex>000000-0000-4000-8000-<n, 12 digits>`. c0 tasks, b0 projects, a0 areas. */
export const page = (prefix: "a0" | "b0" | "c0" | "d0", n: number): string => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const taskPage = (n: number) => page("c0", n);
export const projectPage = (n: number) => page("b0", n);
export const areaPage = (n: number) => page("a0", n);

/** `2026-11-06` minus `days`, as a date or a timestamp at 09:00Z. */
export const daysAgo = (days: number): string => new Date(Date.parse("2026-11-06T00:00:00Z") - days * 86_400_000).toISOString().slice(0, 10);
export const stampAgo = (days: number): string => `${daysAgo(days)}T09:00:00Z`;

export const STATUSES = [
  { name: "To Do", group: "todo" }, { name: "Doing", group: "in_progress" },
  { name: "Waiting On", group: "todo" }, { name: "Someday", group: "todo" },
  { name: "Done", group: "complete" }, { name: "Won't Do", group: "complete" },
];

export interface NoteSpec { path: string; [key: string]: unknown }

const PATHS: Record<string, (slug: string) => string> = {
  domain: (slug) => `domains/${slug}.md`,
  area: (slug) => `areas/${slug}.md`,
  project: (slug) => `projects/${slug}/project.md`,
  meeting: (slug) => `knowledge/meetings/${slug}.md`,
  decision: (slug) => `knowledge/decisions/${slug}.md`,
  person: (slug) => `knowledge/people/${slug}.md`,
  source: (slug) => `sources/text/${slug}.md`,
  proposal: (slug) => `_proposals/${slug}.md`,
};

/** A note's frontmatter with the fields every knowledge note needs; `path` defaults from type and id. */
export function note(fields: Record<string, unknown>): NoteSpec {
  const type = String(fields.type);
  const base: Record<string, unknown> = { id: fields.id, type, title: fields.title, summary: "Synthetic.", lifecycle: "reviewed" };
  const path = typeof fields.path === "string" ? fields.path : PATHS[type]!(String(fields.id));
  const rest = Object.fromEntries(Object.entries(fields).filter(([key]) => !["id", "type", "title", "path"].includes(key)));
  return { path, ...base, ...rest, created: fields.created ?? "2026-01-01", updated: fields.updated ?? fields.created ?? "2026-01-01" };
}

export const domain = (id: string, title: string, extra: Record<string, unknown> = {}) => note({ id, type: "domain", title, ...extra });
export const area = (id: string, title: string, extra: Record<string, unknown> = {}) => note({ id, type: "area", title, ...extra });
export const project = (id: string, title: string, areaId: string, extra: Record<string, unknown> = {}) => note({ id, type: "project", title, area: areaId, ...extra });
export const meeting = (id: string, title: string, date: string, extra: Record<string, unknown> = {}) => note({ id, type: "meeting", title, date, created: date, ...extra });

export interface WorldOptions {
  /** brain.json `modules` overrides (Tasks and Domains are on by default here). */
  modules?: Record<string, boolean>;
  /** notion.tasks overrides (merged into the template's). */
  tasks?: Record<string, unknown>;
  /** notion.tasks.properties overrides. */
  properties?: Record<string, string>;
  repos?: unknown[];
}

/** A brain made by `brain init`, with the given notes written as files. */
export async function world(context: TestContext, notes: readonly NoteSpec[], options: WorldOptions = {}): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "brain-assistant-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, "brain");
  const init = await brain(["init", root, "--owner", "Sam Example", "--no-git", "--now", "2026-01-01T09:00:00Z", "--json"], parent);
  if (init.code !== 0) throw new Error(`init failed: ${init.stdout}${init.stderr}`);
  const config = JSON.parse(await readFile(join(root, "brain.json"), "utf8"));
  config.modules = { ...config.modules, tasks: true, domains: true, ...options.modules };
  config.notion.tasks = { ...config.notion.tasks, database: "0d000000-0000-4000-8000-000000000001", ...options.tasks };
  config.notion.tasks.properties = { ...config.notion.tasks.properties, ...options.properties };
  if (options.repos !== undefined) config.repos = options.repos;
  await writeFile(join(root, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  for (const spec of notes) {
    const { path, ...attributes } = spec;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), `---\n${stringify(attributes, { lineWidth: 0, flowCollectionPadding: false })}---\n`);
  }
  return root;
}

export interface TaskRow { page_id: string; title: string; status: string | null; due: string | null; projects: string[]; areas: string[]; created: string; last_edited: string }

export const task = (n: number, title: string, fields: Partial<TaskRow> = {}): TaskRow => ({
  page_id: taskPage(n), title, status: "To Do", due: null, projects: [], areas: [], created: stampAgo(60), last_edited: stampAgo(1), ...fields,
});
export const projectRow = (n: number, brainId: string | null, title: string, fields: Record<string, unknown> = {}) => ({
  page_id: projectPage(n), brain_id: brainId, title, status: "Active", archived: false, last_edited: stampAgo(1), ...fields,
});
export const areaRow = (n: number, brainId: string | null, title: string, fields: Record<string, unknown> = {}) => ({
  page_id: areaPage(n), brain_id: brainId, title, archived: false, ...fields,
});

export function snapshot(parts: { tasks?: TaskRow[]; projects?: unknown[]; areas?: unknown[]; repos?: unknown[]; task_statuses?: unknown[]; as_of?: string } = {}): Record<string, unknown> {
  return {
    as_of: parts.as_of ?? AS_OF, notion: "live", task_statuses: parts.task_statuses ?? STATUSES,
    tasks: parts.tasks ?? [], projects: parts.projects ?? [], areas: parts.areas ?? [], repos: parts.repos ?? [],
  };
}

/** Run `brain assistant findings` on a snapshot; `args` are extra flags. */
export async function findings(root: string, snap: unknown, args: readonly string[] = []): Promise<CliRun> {
  const file = join(dirname(root), `snapshot-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(snap));
  return brain(["assistant", "findings", "--brain", root, "--input", file, "--json", ...args]);
}

/** The keys of a findings run, in rank order. */
export const keys = (run: CliRun): string[] => (run.json?.data?.findings ?? []).map((finding: { key: string }) => finding.key);
