import { realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { isProductRepository } from "../lib/brain-path.ts";
import type { Brain } from "../lib/brain.ts";
import type { Command, CommandContext } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { factoriesOn, factoryArea, factoryNamed, factoryPath, factoryProjects, factoryWorkflow, findFactory, newFactoryId, orderedFactory, readFactories, type Factory, type OverviewRecord } from "../lib/factories.ts";
import { checkOverviewInput, overviewText, readFactory, type FactoryReading } from "../lib/factory-overview.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { readJsonInput } from "../lib/input.ts";
import { commitJournaled } from "../lib/journal.ts";
import { appendLog, type LogEntry } from "../lib/log.ts";
import { scanNotes, type Note } from "../lib/notes.ts";
import { expandPath, folderKey, isAbsoluteOrHome, linkedRepos } from "../lib/repos.ts";
import { describeErrors, loadSchemas } from "../lib/schemas.ts";
import { formatTimestamp } from "../lib/time.ts";
import { waitForIndex } from "../lib/workflow-store.ts";
import { Workspace } from "../lib/workspace.ts";

// `brain factory` (spec/cli.md §5.39; decision 0113 §1, §4, §6). Nothing here writes in a Factory's folder or calls Notion.

/** brain.json with one entry replaced, or added at the end, checked against its schema. */
function withEntry(brain: Brain, factories: readonly Factory[], entry: Factory): string {
  const list = factories.some((other) => other.id === entry.id) ? factories.map((other) => (other.id === entry.id ? entry : other)) : [...factories, entry];
  const next = { ...structuredClone(brain.config), factories: list };
  const schemas = loadSchemas();
  if (!schemas.brain(next)) throw new BrainError("INPUT_INVALID", `brain.json would be invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
  return `${JSON.stringify(next, null, 2)}\n`;
}

async function writeEntry(brain: Brain, factories: readonly Factory[], entry: Factory, op: string, now: Date): Promise<void> {
  await atomicWriteFile(brain.root, "brain.json", withEntry(brain, factories, entry));
  await appendLog(brain.root, now, [{ op, id: "-", title: entry.name, pairs: [["factory", entry.id]] }]);
}

function assertOn(brain: Brain): void {
  if (!factoriesOn(brain.config)) throw new BrainError("MODULE_OFF", "The Factories module is off: brain modules on factories");
}

/** The entries and the one a command names, with the module on. */
async function named({ args, brain, environment }: CommandContext, usage: string): Promise<{ notes: Note[]; factories: Factory[]; entry: Factory }> {
  const [reference] = args.positionals;
  if (reference === undefined) throw new BrainError("USAGE", `Name the Factory: ${usage}`);
  assertOn(brain!);
  const { notes } = await scanNotes(brain!.root);
  const factories = await readFactories(brain!, notes, environment.homeDirectory);
  return { notes, factories, entry: findFactory(factories, reference) };
}

/** One Factory as `list` and `read` show it: its Area and Projects filled in from the link. */
function shown(brain: Brain, entry: Factory): Record<string, unknown> {
  return {
    id: entry.id, name: entry.name, ...(entry.repo === undefined ? { path: entry.path } : { repo: entry.repo }),
    area: factoryArea(brain.config, entry) ?? null, projects: factoryProjects(brain.config, entry), archived: entry.archived === true,
    workflow: factoryWorkflow(brain.root, entry.id),
    overview: entry.overview === undefined ? null : { as_of: entry.overview.as_of, by: entry.overview.by }, notion: entry.notion ?? null,
  };
}

const list = (value: unknown): string[] | undefined => (Array.isArray(value) ? [...new Set(value as string[])] : undefined);

/** The name as it is kept, checked against the other entries (FACTORY_EXISTS). */
function checkName(factories: readonly Factory[], name: string, except?: string): string {
  const trimmed = name.trim();
  if (trimmed === "") throw new BrainError("INPUT_INVALID", "--name must not be empty");
  const taken = factoryNamed(factories, trimmed, except);
  if (taken !== undefined) throw new BrainError("FACTORY_EXISTS", `${taken.name} (${taken.id}) has that name already${taken.archived === true ? ", and is archived" : ""}`);
  return trimmed;
}

/** The refusals for the folder of a Factory (§5.39 `add`), and the archived entry of that folder, if any. */
async function checkFolder(brain: Brain, factories: readonly Factory[], path: string, home: string | undefined, except?: string): Promise<Factory | undefined> {
  if (!isAbsoluteOrHome(path)) throw new BrainError("INPUT_INVALID", `--path ${path} must be absolute or start with ~/`);
  const folder = resolve(expandPath(path, home));
  let directory = false;
  try { directory = (await stat(folder)).isDirectory(); } catch { /* missing */ }
  if (!directory) throw new BrainError("INPUT_INVALID", `--path ${path} isn't an existing folder`);
  const key = folderKey(folder);
  const root = folderKey(brain.root);
  if (key === root || key.startsWith(`${root}${sep}`)) throw new BrainError("REPO_IS_BRAIN", `${path} is the brain, or inside it: it is never a Factory`);
  if (await isProductRepository(await realpath(folder))) throw new BrainError("OUTSIDE_ROOT", `${path} is the Ultimate Brain product repo: it is never a Factory`);
  const repo = linkedRepos(brain.config).find((entry) => folderKey(entry.path, home) === key);
  if (repo !== undefined) throw new BrainError("FACTORY_EXISTS", `${path} is the linked repo ${repo.name}`);
  const same = factories.find((entry) => entry.id !== except && entry.path !== undefined && folderKey(entry.path, home) === key);
  if (same !== undefined && same.archived !== true) throw new BrainError("FACTORY_EXISTS", `${path} is the Factory ${same.name} (${same.id})`);
  return same;
}

function checkPlace(notes: readonly Note[], area: string | undefined, projects: readonly string[]): void {
  const typeOf = (id: string) => notes.find((note) => note.id === id)?.type;
  if (area !== undefined && typeOf(area) !== "area") throw new BrainError("UNKNOWN_ID", `No Area with id ${area}`);
  for (const id of projects) if (typeOf(id) !== "project") throw new BrainError("UNKNOWN_ID", `No Project with id ${id}`);
}

/** Plan files relative to the folder, written with `/` on Windows too; they needn't exist yet. */
function checkPlan(files: readonly string[]): string[] {
  return [...new Set(files.map((file) => {
    const path = process.platform === "win32" ? file.replaceAll("\\", "/") : file;
    if (path.trim() === "" || isAbsoluteOrHome(path) || path.split("/").includes("..")) throw new BrainError("INPUT_INVALID", `--plan ${file} must be a path in the folder, without ..`);
    return path;
  }))];
}

/** `brain factory list` (spec/cli.md §5.39). */
export const factoryListCommand: Command = {
  name: "factory list",
  usage: "brain factory list [--json]",
  summary: "List the Factories: the working folders connected to the brain, their workflow and their overview's date. Writes nothing.",
  options: {},
  maxPositionals: 0,
  needsBrain: true,
  async run({ brain, environment }) {
    const factories = (await readFactories(brain!, undefined, environment.homeDirectory)).map((entry) => shown(brain!, entry));
    const human = factories.map((entry) => {
      const workflow = entry.workflow as { state: string } | null;
      const overview = entry.overview as { as_of: string } | null;
      return `${String(entry.name)}${entry.archived === true ? " · archived" : ""} · ${workflow === null ? "not connected" : workflow.state} · ${overview === null ? "no overview" : `overview ${overview.as_of}`}\n`;
    }).join("");
    return { data: { factories }, human };
  },
};

/** `brain factory add` (spec/cli.md §5.39): a folder that isn't a linked repo. */
export const factoryAddCommand: Command = {
  name: "factory add",
  usage: "brain factory add --path <path> --name <name> --area <area-id> [--project <prj-id>]… [--plan <file>]… [--json]",
  summary: "Make a Factory of a folder that isn't a linked repo; an archived one of the same folder is the same Factory again.",
  options: { path: "string", name: "string", area: "string", project: "list", plan: "list" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now, environment }) {
    const { path, name, area } = args.options as { path?: string; name?: string; area?: string };
    if (path === undefined || name === undefined || area === undefined) throw new BrainError("USAGE", "brain factory add needs --path, --name and --area");
    assertOn(brain!);
    const { notes } = await scanNotes(brain!.root);
    const factories = await readFactories(brain!, notes, environment.homeDirectory);
    const projects = list(args.options.project) ?? [];
    const archived = await checkFolder(brain!, factories, path, environment.homeDirectory);
    checkPlace(notes, area, projects);
    const plan = checkPlan(list(args.options.plan) ?? []);
    const { archived: _archived, ...kept } = archived ?? { id: newFactoryId(factories) } as Factory;
    const entry = orderedFactory({ ...kept, name: checkName(factories, name, kept.id), path, area, projects, plan: plan.length > 0 ? plan : undefined });
    await writeEntry(brain!, factories, entry, "factory-add", now);
    return { data: { ...entry, reused: archived !== undefined }, human: `${entry.id} ${entry.name}${archived === undefined ? "" : " (again)"}\n` };
  },
};

/** `brain factory set <factory>` (spec/cli.md §5.39). */
export const factorySetCommand: Command = {
  name: "factory set",
  usage: "brain factory set <factory> [--name <name>] [--path <path>] [--area <area-id>] [--project <prj-id>…|--no-projects] [--plan <file>…|--no-plan] [--json]",
  summary: "Change a Factory: a plain folder's name, path, Area, Projects or plan files; a linked repo's name only.",
  options: { name: "string", path: "string", area: "string", project: "list", "no-projects": "boolean", plan: "list", "no-plan": "boolean" },
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const { args, brain, now, environment } = context;
    const { name, path, area } = args.options as { name?: string; path?: string; area?: string };
    const projects = args.options["no-projects"] === true ? [] : list(args.options.project);
    const plan = args.options["no-plan"] === true ? [] : list(args.options.plan);
    if ((args.options["no-projects"] === true && args.options.project !== undefined) || (args.options["no-plan"] === true && args.options.plan !== undefined)) throw new BrainError("USAGE", "brain factory set takes --project or --no-projects, and --plan or --no-plan, not both");
    if ([name, path, area, projects, plan].every((value) => value === undefined)) throw new BrainError("USAGE", "brain factory set needs something to change");
    const { notes, factories, entry } = await named(context, "brain factory set <factory>");
    if (entry.repo !== undefined && [path, area, projects, plan].some((value) => value !== undefined)) throw new BrainError("USAGE", `${entry.name} is the linked repo ${entry.repo}: its Area, Projects and plan are changed in its kit, and only its --name here`);
    if (path !== undefined) {
      const other = await checkFolder(brain!, factories, path, environment.homeDirectory, entry.id);
      if (other !== undefined) throw new BrainError("FACTORY_EXISTS", `${path} is the archived Factory ${other.name} (${other.id}): brain factory add makes it one again`);
    }
    checkPlace(notes, area, projects ?? []);
    const files = plan === undefined ? undefined : checkPlan(plan);
    const next = orderedFactory({
      ...entry,
      ...(name === undefined ? {} : { name: checkName(factories, name, entry.id) }),
      ...(path === undefined ? {} : { path }), ...(area === undefined ? {} : { area }), ...(projects === undefined ? {} : { projects }),
      ...(files === undefined ? {} : { plan: files.length > 0 ? files : undefined }),
    });
    const changed = !isDeepStrictEqual(next, orderedFactory(entry));
    if (changed) await writeEntry(brain!, factories, next, "factory-set", now);
    return { data: { entry: next, changed }, human: `${next.id} ${next.name}: ${changed ? "changed" : "nothing to change"}\n` };
  },
};

/** `brain factory archive <factory>` (spec/cli.md §5.39): a plain folder's Factory left by a setup that stopped. */
export const factoryArchiveCommand: Command = {
  name: "factory archive",
  usage: "brain factory archive <factory> [--json]",
  summary: "Archive a plain folder's Factory that has no open workflow.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const { brain, now } = context;
    const { factories, entry } = await named(context, "brain factory archive <factory>");
    if (entry.repo !== undefined) throw new BrainError("USAGE", `${entry.name} is the linked repo ${entry.repo}: unlink it with brain repo unlink ${entry.repo}`);
    const workflow = factoryWorkflow(brain!.root, entry.id);
    if (workflow !== null) throw new BrainError("DESTINATION_TAKEN", `${entry.name} has the workflow ${workflow.id} (${workflow.state}): end it, which archives the Factory`);
    const next = orderedFactory({ ...entry, archived: true });
    if (entry.archived !== true) await writeEntry(brain!, factories, next, "factory-archive", now);
    return { data: next, human: `${next.id} ${next.name}: archived\n` };
  },
};

async function reading(context: CommandContext, entry: Factory): Promise<FactoryReading> {
  const issues = context.args.options.issues as string | undefined;
  return readFactory(context.brain!, entry, issues === undefined ? undefined : await readJsonInput(issues, "factory"), context.environment.homeDirectory);
}

/** `brain factory read <factory>` (spec/cli.md §5.39). */
export const factoryReadCommand: Command = {
  name: "factory read",
  usage: "brain factory read <factory> [--issues <file|->] [--json]",
  summary: "Read a Factory's plan files and taken tasks, and whether they changed since its overview. Writes nothing.",
  options: { issues: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const { entry } = await named(context, "brain factory read <factory>");
    const { warnings, ...data } = await reading(context, entry);
    return { data: { factory: shown(context.brain!, entry), ...data }, warnings, human: `${entry.name}: ${!data.found ? "not on this machine" : `${data.plan!.where.length === 0 ? "plan not found" : `plan in ${data.plan!.where.join(", ")}`} · ${data.changed ? "changed" : "unchanged"}`}\n` };
  },
};

/** `brain factory overview <factory>` (spec/cli.md §5.39, connected-workflows.md §9.1). */
export const factoryOverviewCommand: Command = {
  name: "factory overview",
  usage: "brain factory overview <factory> --input <file|-> [--issues <file>] [--written <sha256>] [--json]",
  summary: "Build a Factory's overview for its Notion page; --written records that it was written there.",
  options: { input: "string", issues: "string", written: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run(context) {
    const { args, brain, now } = context;
    if (args.options.input === undefined) throw new BrainError("USAGE", "brain factory overview needs --input <file|->");
    const { factories, entry } = await named(context, "brain factory overview <factory>");
    const { warnings, ...read } = await reading(context, entry);
    const input = checkOverviewInput(await readJsonInput(args.options.input as string, "factory overview"), { ...read, warnings }, now);
    const { markdown, sha256 } = overviewText({ ...read, warnings }, input, now);
    const asOf = formatTimestamp(now);
    const unchanged = entry.overview?.sha256 === sha256;
    const written = args.options.written as string | undefined;
    if (written === undefined) return { data: { heading: "Overview", markdown, sha256, as_of: asOf, folder: read.folder, tasks: read.tasks, unchanged }, warnings, human: markdown };

    if (written !== sha256) throw new BrainError("STALE_RECORD", `The folder or the tasks of ${entry.name} changed since this overview was built: build it and write it again`);
    const overview: OverviewRecord = unchanged ? { ...entry.overview!, folder: read.folder!, tasks: read.tasks } : { as_of: asOf, by: input.by, sha256, folder: read.folder!, tasks: read.tasks };
    // The skill set Overview as of on the row itself, so the next render must not send it again.
    const next = orderedFactory({ ...entry, overview, ...(!unchanged && entry.published !== undefined ? { published: { ...entry.published, "Overview as of": { start: asOf, end: null } } } : {}) });
    if (!isDeepStrictEqual(next, orderedFactory(entry))) {
      const workspace = await Workspace.open(brain!);
      workspace.writeText("brain.json", withEntry(brain!, factories, next));
      const log: LogEntry[] = unchanged ? [] : [{ op: "factory-overview", id: "-", title: entry.name, pairs: [["factory", entry.id], ["by", input.by]] }];
      await waitForIndex(brain!.root);
      await commitJournaled(brain!.root, workspace, log, now, `factory: overview ${entry.id}`);
    }
    return { data: { entry: next }, warnings, human: `${entry.name}: overview ${unchanged ? "unchanged" : "recorded"}\n` };
  },
};

export const FACTORY_COMMANDS: readonly Command[] = [factoryListCommand, factoryAddCommand, factorySetCommand, factoryArchiveCommand, factoryReadCommand, factoryOverviewCommand];
