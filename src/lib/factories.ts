import type { Brain } from "./brain.ts";
import { BrainError } from "./errors.ts";
import { generateId, type IdPrefix } from "./ids.ts";
import { isRecord } from "./input.ts";
import { modulesOf } from "./modules.ts";
import { scanNotes, type Note } from "./notes.ts";
import { folderKey, linkedRepos, projectsOf, type LinkedRepo } from "./repos.ts";
import { describeErrors, loadSchemas } from "./schemas.ts";
import { isOpen, listWorkflows, type WorkflowSummary } from "./workflow-store.ts";

// The Factories of spec/linked-repos.md §1.1 (decision 0113 §1): the working folders where agents build, one `brain.json` `factories` entry each.

/** What Git keeps of the last overview written (spec/connected-workflows.md §9.1): no text of it. */
export interface OverviewRecord { as_of: string; by: "session" | "catch-up"; sha256: string; folder: string; tasks: string }

/** One `brain.json` `factories` entry (spec/schema.md §12): of a linked repo (`repo`) or of any other folder (`path`). */
export interface Factory {
  id: string; name: string; repo?: string; path?: string; area?: string; projects?: string[]; plan?: string[]; archived?: true;
  notion?: string; last_synced?: string; published?: Record<string, unknown>; overview?: OverviewRecord;
}

const KEYS = ["id", "name", "repo", "path", "area", "projects", "plan", "archived", "notion", "last_synced", "published", "overview"] as const;

/** An entry with its keys in schema order and without the absent ones. */
export function orderedFactory(entry: Factory): Factory {
  return Object.fromEntries(KEYS.filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]])) as unknown as Factory;
}

export const factoriesOn = (config: Record<string, unknown>): boolean => modulesOf(config).factories;

/** The `factories` list as stored, `[]` when absent. */
export const factoriesOf = (config: Record<string, unknown>): Factory[] => (Array.isArray(config.factories) ? config.factories.filter(isRecord) : []) as unknown as Factory[];

export const factoryById = (config: Record<string, unknown>, id: unknown): Factory | undefined => factoriesOf(config).find((entry) => entry.id === id);

const repoOf = (config: Record<string, unknown>, entry: Factory): LinkedRepo | undefined => (entry.repo === undefined ? undefined : linkedRepos(config).find((repo) => repo.name === entry.repo));

/** A Factory's Area: its linked repo's, or the entry's own for a plain folder and for an unlinked repo (schema §12). */
export const factoryArea = (config: Record<string, unknown>, entry: Factory): string | undefined => entry.area ?? repoOf(config, entry)?.area;

/** The Projects a Factory serves, from where its Area is read. */
export function factoryProjects(config: Record<string, unknown>, entry: Factory): string[] {
  if (entry.area !== undefined) return entry.projects ?? [];
  const repo = repoOf(config, entry);
  return repo === undefined ? [] : projectsOf(repo);
}

/** The folder as stored (the `repos` entry's path for a linked repo); undefined once the repo is unlinked. */
export const factoryPath = (config: Record<string, unknown>, entry: Factory): string | undefined => entry.path ?? repoOf(config, entry)?.path;

/** The Factory that isn't archived and whose folder this is (real paths). */
export function factoryAt(config: Record<string, unknown>, folder: string, home?: string): Factory | undefined {
  const key = folderKey(folder, home);
  return factoriesOf(config).find((entry) => {
    const path = entry.archived === true ? undefined : factoryPath(config, entry);
    return path !== undefined && folderKey(path, home) === key;
  });
}

const nameKey = (name: string): string => name.trim().toLowerCase();

/** The Factory `<factory>` names (cli.md §5.39): an id, or a name without its case. */
export function findFactory(factories: readonly Factory[], reference: string): Factory {
  const found = factories.find((entry) => entry.id === reference.trim()) ?? factories.find((entry) => nameKey(entry.name) === nameKey(reference));
  if (found === undefined) throw new BrainError("FACTORY_NOT_FOUND", `No Factory ${reference} in brain.json: brain factory list shows them`);
  return found;
}

/** The entry that has this name already, ignoring case; `except` is not looked at. */
export const factoryNamed = (factories: readonly Factory[], name: string, except?: string): Factory | undefined => factories.find((entry) => entry.id !== except && nameKey(entry.name) === nameKey(name));

const typeOf = (notes: readonly Note[], id: string): string | undefined => notes.find((note) => note.id === id)?.type;

/** What breaks schema §12's checks: a repeated id, name, repo or path; a repo, Area or Project that doesn't exist. */
export function factoryProblems(config: Record<string, unknown>, notes: readonly Note[], home?: string): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const repeated = (entry: Factory, key: string, value: string, shown: string) => {
    const before = seen.get(`${key} ${value}`);
    if (before === undefined) seen.set(`${key} ${value}`, entry.id);
    else problems.push(`factories: ${entry.id} repeats the ${key} ${shown} of ${before}`);
  };
  for (const entry of factoriesOf(config)) {
    repeated(entry, "id", entry.id, entry.id);
    repeated(entry, "name", nameKey(entry.name), entry.name);
    if (entry.repo !== undefined) {
      repeated(entry, "repo", entry.repo, entry.repo);
      if (entry.archived !== true && repoOf(config, entry) === undefined) problems.push(`factories: ${entry.id} names the repo ${entry.repo}, which isn't linked`);
    }
    if (entry.path !== undefined) repeated(entry, "path", folderKey(entry.path, home), entry.path);
    if (entry.area !== undefined && typeOf(notes, entry.area) !== "area") problems.push(`factories: ${entry.id} is in the Area ${entry.area}, which doesn't exist`);
    for (const id of entry.projects ?? []) if (typeOf(notes, id) !== "project") problems.push(`factories: ${entry.id} serves the Project ${id}, which doesn't exist`);
  }
  return problems;
}

/** A workflow that isn't ended whose Factory is no entry (schema §12): lint's, and a refusal of the commands that read the destination. */
export const orphanWorkflows = (config: Record<string, unknown>, workflows: readonly WorkflowSummary[]): string[] => workflows
  .filter((workflow) => isOpen(workflow) && workflow.destination?.factory !== undefined && factoryById(config, workflow.destination.factory) === undefined)
  .map((workflow) => `factories: ${workflow.id}'s destination ${workflow.destination.factory} is no entry`);

/** The entries, checked as schema §12 says: BRAIN_CONFIG_INVALID on a problem. */
export async function readFactories(brain: Brain, notes?: readonly Note[], home?: string): Promise<Factory[]> {
  if (factoriesOf(brain.config).length === 0) return [];
  const schemas = loadSchemas();
  if (!schemas.brain(brain.config)) throw new BrainError("BRAIN_CONFIG_INVALID", `brain.json fails schema: ${describeErrors(schemas.brain.errors).join("; ")}`);
  const problems = factoryProblems(brain.config, notes ?? (await scanNotes(brain.root)).notes, home);
  if (problems.length > 0) throw new BrainError("BRAIN_CONFIG_INVALID", `brain.json ${problems[0]!}`, problems.map((message) => ({ pointer: "/factories", message })));
  return factoriesOf(brain.config);
}

/** The workflow that isn't ended and whose destination is this Factory, as `{ id, state }`, or null. */
export function factoryWorkflow(root: string, id: string): { id: string; state: string } | null {
  const found = listWorkflows(root).find((workflow) => isOpen(workflow) && workflow.destination?.factory === id);
  return found === undefined ? null : { id: found.id, state: found.state };
}

export function newFactoryId(factories: readonly Factory[]): string {
  // Not a note id: `brain id new` never mints it (schema §1).
  return generateId("fac" as IdPrefix, new Set(factories.map((entry) => entry.id)));
}

const replaced = (factories: readonly Factory[], entry: Factory): Factory[] => factories.map((other) => (other.id === entry.id ? orderedFactory(entry) : other));

/**
 * The Factory of a repo being linked (cli.md §5.16): its archived entry again; else the entry of the same folder, which becomes it and keeps its
 * id, name, row and overview; else a new one named after the repo, with `-2`, `-3`… when the name is taken.
 */
export function linkFactory(factories: readonly Factory[], repo: { name: string; path: string }, home?: string): { factories: Factory[]; id: string } {
  const own = factories.find((entry) => entry.repo === repo.name);
  if (own !== undefined) {
    const { archived: _archived, area: _area, projects: _projects, ...rest } = own;
    return { factories: replaced(factories, rest), id: own.id };
  }
  const key = folderKey(repo.path, home);
  const same = factories.find((entry) => entry.path !== undefined && folderKey(entry.path, home) === key);
  if (same !== undefined) {
    const { archived: _archived, path: _path, area: _area, projects: _projects, plan: _plan, ...rest } = same;
    return { factories: replaced(factories, { ...rest, repo: repo.name }), id: same.id };
  }
  let name = repo.name;
  for (let n = 2; factoryNamed(factories, name) !== undefined; n += 1) name = `${repo.name}-${n}`;
  const id = newFactoryId(factories);
  return { factories: [...factories, { id, name, repo: repo.name }], id };
}

/** Give every `repos` entry that has no Factory one, in `repos` order (cli.md §5.20): the list, and the ids made. */
export function withEveryRepo(config: Record<string, unknown>, factories: readonly Factory[], home?: string): { factories: Factory[]; ids: string[] } {
  let next = [...factories];
  const ids: string[] = [];
  for (const repo of linkedRepos(config)) {
    if (next.some((entry) => entry.repo === repo.name && entry.archived !== true)) continue;
    const linked = linkFactory(next, repo, home);
    next = linked.factories;
    ids.push(linked.id);
  }
  return { factories: next, ids };
}

/** The Factory of a repo being unlinked, archived with the link's Area and Projects copied in (cli.md §5.29); null when it has none. */
export function unlinkFactory(factories: readonly Factory[], repo: LinkedRepo): { factories: Factory[]; id: string } | null {
  const own = factories.find((entry) => entry.repo === repo.name && entry.archived !== true);
  if (own === undefined) return null;
  return { factories: replaced(factories, { ...own, area: repo.area, projects: projectsOf(repo), archived: true }), id: own.id };
}
