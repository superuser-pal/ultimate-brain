import { existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";

import type { Brain } from "../lib/brain.ts";
import type { Command, CommandContext } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys, type InputProblem } from "../lib/input.ts";
import { MEANINGS } from "../lib/link-kit.ts";
import { factoriesOf, factoriesOn, factoryById, factoryPath, factoryWorkflow, orderedFactory, readFactories, type Factory } from "../lib/factories.ts";
import { modulesOf, taskFactoryProperty } from "../lib/modules.ts";
import { scanNotes, type Note } from "../lib/notes.ts";
import { expandPath, folderKey, linkedRepos } from "../lib/repos.ts";
import { loadSchemas } from "../lib/schemas.ts";
import { adoptApply, adoptPreview, assertAdoptionRev, checkAdoptionInput } from "../lib/workflow-adopt.ts";
import { approveArtifact, assertDoneAllowed, decidePublication, itemCounts, moveOp, openTasks, progress, publishHistory, reconcile, resolve, setStatus, summaryOf, ts, workRecord, type OpError } from "../lib/workflow-model.ts";
import { generateId } from "../lib/ids.ts";
import { newTaskArea } from "../lib/task-areas.ts";
import { Workspace } from "../lib/workspace.ts";
import { compare, isOpen, listWorkflows, recordIds, Records, serialize, taskHolder, type Json } from "../lib/workflow-store.ts";

// `brain workflow …` (spec/connected-workflows.md §12): the durable records of connected workflows, in the brain.

const POINTER = ".brain-workflow.json";
const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/;

const notesById = async (brain: Brain): Promise<Map<string, Note>> => new Map((await scanNotes(brain.root)).notes.map((note) => [note.id, note]));

/** The Factory a workflow may take as its destination (§2, §3.5): MODULE_OFF, BRAIN_CONFIG_INVALID, UNKNOWN_ID or DESTINATION_TAKEN. */
async function destinationFactory(brain: Brain, id: unknown, home: string | undefined): Promise<Factory> {
  if (!factoriesOn(brain.config)) throw new BrainError("MODULE_OFF", "A Factory as a destination needs the Factories module: brain modules on factories");
  if (taskFactoryProperty(brain.config) === "") throw new BrainError("BRAIN_CONFIG_INVALID", "A Factory as a destination needs notion.tasks.properties.factory mapped: a task says with it where it is to be done (§2)");
  const entry = (await readFactories(brain, undefined, home)).find((factory) => factory.id === id);
  if (entry === undefined || entry.archived === true) throw new BrainError("UNKNOWN_ID", `/destination/factory: ${String(id)} is ${entry === undefined ? "no Factory" : "an archived Factory"} in brain.json`, [{ pointer: "/destination/factory", message: entry === undefined ? "is no entry of brain.json factories" : "is archived" }]);
  const taken = factoryWorkflow(brain.root, entry.id);
  if (taken !== null) throw new BrainError("DESTINATION_TAKEN", `${taken.id} already connects work to the Factory ${entry.name}`);
  return entry;
}

const isFactory = (records: Records): boolean => records.workflow.destination.factory !== undefined;

const invalid = (pointer: string, message: string): BrainError => new BrainError("INPUT_INVALID", `1 problem in input: ${pointer} ${message}`, [{ pointer, message }]);

/** The workflow's records; WORKFLOW_ENDED unless the command may run on an ended one (§12 state rules). */
function open(brain: Brain, wf: string | undefined, command: string, allowEnded = false): Records {
  if (wf === undefined) throw new BrainError("USAGE", `Name the workflow: brain workflow ${command} <wf>`);
  const records = Records.load(brain.root, wf);
  if (!allowEnded && records.workflow.state === "ended") throw new BrainError("WORKFLOW_ENDED", `${wf} has ended; connecting the folder again creates a new workflow`);
  return records;
}

/** `--rev <n>`: USAGE when an update has none. */
function revOf(args: CommandContext["args"], command: string): number {
  const text = args.options.rev as string | undefined;
  if (text === undefined) throw new BrainError("USAGE", `brain workflow ${command} updates a record: pass --rev <n>, the revision you read`);
  if (!/^\d+$/.test(text)) throw new BrainError("USAGE", "--rev must be a whole number");
  return Number(text);
}

function assertRev(record: Json, rev: number, what: string): void {
  if (record.rev !== rev) throw new BrainError("STALE_RECORD", `${what} is at revision ${String(record.rev)}, not ${rev}: read it again and retry`);
}

async function inputObject(args: CommandContext["args"], command: string): Promise<Json> {
  const value = await readJsonInput(args.options.input as string | undefined, `workflow ${command}`);
  if (!isRecord(value)) throw new BrainError("INPUT_INVALID", "1 problem in input: / must be a JSON object", [{ pointer: "", message: "must be a JSON object" }]);
  return value;
}

/** Problems for fields a command manages (§12: refused in an update's input). */
function managed(input: Json, keys: readonly string[]): InputProblem[] {
  return keys.filter((key) => Object.hasOwn(input, key)).map((key) => ({ pointer: `/${key}`, message: "is managed by the command" }));
}

const done = (records: Records, data: unknown, human: string) => ({ data, human });

const commandBase = { needsBrain: true } as const;

/** `brain workflow new --input <file|->` (§3.1, §12). */
export const workflowNewCommand: Command = {
  ...commandBase,
  name: "workflow new",
  usage: "brain workflow new --input <file|-> [--json]",
  summary: "Connect a working folder to its Factory, or to a Notion Project or Area: write the opt-in record and the folder's pointer.",
  options: { input: "string" },
  maxPositionals: 0,
  async run({ args, brain, now, environment }) {
    const input = await inputObject(args, "new");
    const problems: InputProblem[] = unknownKeys(input, ["folder_path", "opted_in", "folder", "destination", "relations", "settings", "status_map", "status_read", "modules_offered"], "");
    const folderPath = input.folder_path;
    if (typeof folderPath !== "string" || !isAbsolute(folderPath) || !existsSync(folderPath) || !statSync(folderPath).isDirectory()) problems.push({ pointer: "/folder_path", message: "must be the absolute path of an existing folder" });
    assertNoProblems(problems);
    const config = brain!.config;
    if (!modulesOf(config).tasks) throw new BrainError("MODULE_OFF", "A connected workflow needs the Tasks module: brain modules on tasks");
    const tasks = isRecord(config.notion) && isRecord(config.notion.tasks) ? config.notion.tasks : undefined;
    const brainId = isRecord(tasks?.properties) ? tasks.properties.brain_id : undefined;
    if (typeof brainId !== "string" || brainId === "") throw new BrainError("BRAIN_CONFIG_INVALID", "A connected workflow needs notion.tasks.properties.brain_id mapped: a retry finds its task by Brain ID (§2)");

    const record: Json = {
      id: generateId("wf", recordIds(brain!.root)), rev: 1, state: "connected",
      opted_in: { at: ts(now), statement: isRecord(input.opted_in) ? input.opted_in.statement : undefined },
      folder: { name: basename(folderPath as string), ...(isRecord(input.folder) && input.folder.repo !== undefined ? { repo: input.folder.repo } : {}) },
      destination: input.destination,
      ...(input.relations === undefined ? {} : { relations: input.relations }),
      settings: { ...(isRecord(input.settings) ? input.settings : {}), read_at: ts(now) },
      status_map: input.status_map, status_read: input.status_read ?? {}, modules_offered: input.modules_offered ?? [],
      outside: [], needs_you: [], summary: { written_at: null, sha256: null },
    };
    const records = Records.create(brain!.root, record);
    const validate = loadSchemas().workflow("workflow");
    if (!validate(record)) assertNoProblems((validate.errors ?? []).filter((error) => !["if", "anyOf", "allOf", "oneOf"].includes(error.keyword)).map((error) => ({ pointer: error.instancePath || "/", message: error.message ?? error.keyword })));

    if (isFactory(records)) {
      const factory = await destinationFactory(brain!, record.destination.factory, environment.homeDirectory);
      const path = factoryPath(config, factory);
      if (path === undefined || folderKey(path, environment.homeDirectory) !== folderKey(folderPath as string)) throw invalid("/folder_path", `isn't the folder of the Factory ${factory.name}`);
      if (factory.repo !== undefined) record.folder.repo = factory.repo;
    }

    const notes = await notesById(brain!);
    const missing: InputProblem[] = [];
    const exists = (id: string, type: string, pointer: string) => { if (notes.get(id)?.type !== type) missing.push({ pointer, message: `${id} is not a ${type} in the brain` }); };
    if (record.destination.project !== undefined) exists(record.destination.project, "project", "/destination/project");
    if (record.destination.area !== undefined) exists(record.destination.area, "area", "/destination/area");
    if (record.relations?.goal !== undefined) exists(record.relations.goal, "goal", "/relations/goal");
    (record.relations?.people ?? []).forEach((id: string, index: number) => exists(id, "person", `/relations/people/${index}`));
    (record.relations?.orgs ?? []).forEach((id: string, index: number) => exists(id, "org", `/relations/orgs/${index}`));
    if (record.folder.repo !== undefined && !linkedRepos(config).some((repo) => repo.name === record.folder.repo)) missing.push({ pointer: "/folder/repo", message: `${record.folder.repo} is not a linked repo in brain.json` });
    if (missing.length > 0) throw new BrainError("UNKNOWN_ID", `${missing[0]!.pointer}: ${missing[0]!.message}`, missing);

    // One workflow per destination and per folder (§3.1).
    const others = listWorkflows(brain!.root).filter(isOpen);
    const dest = JSON.stringify(record.destination);
    const taken = others.find((other) => JSON.stringify(other.destination) === dest);
    if (taken !== undefined) throw new BrainError("DESTINATION_TAKEN", `${taken.id} already connects work to this destination`);
    const pointerPath = join(folderPath as string, POINTER);
    const pointed = await readPointer(pointerPath);
    if (pointed !== null && others.some((other) => other.id === pointed)) throw new BrainError("POINTER_EXISTS", `${folderPath as string} is already connected through ${pointed}`);
    const repoTaken = record.folder.repo === undefined ? undefined : others.find((other) => other.folder?.repo === record.folder.repo);
    if (repoTaken !== undefined) throw new BrainError("DESTINATION_TAKEN", `${repoTaken.id} already runs in the linked repo ${record.folder.repo}`);

    await records.commit(now, "new");
    // The pointer is the command's one write outside the brain, and isn't committed (§12).
    await writeFile(pointerPath, serialize({ workflow: record.id }));
    return done(records, record, `connected ${record.folder.name} to ${record.destination.project ?? record.destination.area ?? record.destination.factory} as ${record.id}\n`);
  },
};

async function readPointer(path: string): Promise<string | null> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return isRecord(value) && typeof value.workflow === "string" ? value.workflow : null;
  } catch {
    return null;
  }
}

/** `brain workflow find (--repo <name> | --folder-name <name> | --destination <id>)` (§12). */
export const workflowFindCommand: Command = {
  ...commandBase,
  name: "workflow find",
  usage: "brain workflow find (--repo <name> | --folder-name <name> | --destination <id>) [--json]",
  summary: "Find workflows by linked repo, folder name or destination, in every state. Writes nothing.",
  options: { repo: "string", "folder-name": "string", destination: "string" },
  maxPositionals: 0,
  async run({ args, brain }) {
    const given = (["repo", "folder-name", "destination"] as const).filter((key) => args.options[key] !== undefined);
    if (given.length !== 1) throw new BrainError("USAGE", "brain workflow find needs exactly one of --repo, --folder-name or --destination");
    const value = args.options[given[0]!] as string;
    const workflows = listWorkflows(brain!.root).filter((workflow) =>
      given[0] === "repo" ? workflow.folder?.repo === value : given[0] === "folder-name" ? workflow.folder?.name === value : [workflow.destination?.project, workflow.destination?.area, workflow.destination?.factory].includes(value))
      .map(({ id, state, folder, destination }) => ({ id, state, folder, destination }));
    return { data: { workflows }, human: workflows.map((workflow) => `${workflow.id} ${workflow.state} ${workflow.folder.name}\n`).join("") || "no workflow\n" };
  },
};

const OPEN_OP = new Set(["pending", "in_flight", "failed", "uncertain"]);

/** `brain workflow show <wf>` (§12). */
export const workflowShowCommand: Command = {
  ...commandBase,
  name: "workflow show",
  usage: "brain workflow show <wf> [--json]",
  summary: "Show a workflow's records and counts. Writes nothing.",
  options: {},
  maxPositionals: 1,
  async run({ args, brain }) {
    const records = open(brain!, args.positionals[0], "show", true);
    const counts = itemCounts(records);
    const ops = [...records.ops.values()];
    const total = records.items.size;
    const base = total - counts.dropped;
    const data = {
      workflow: records.workflow,
      items: [...records.items.values()].sort((a, b) => compare(a.id, b.id)),
      artifacts: [...records.artifacts.values()].sort((a, b) => compare(a.id, b.id)),
      ops: ops.sort((a, b) => compare(a.id, b.id)),
      counts: {
        ...counts,
        open: counts.todo + counts.in_progress + counts.waiting + counts.review,
        percent: base <= 0 ? null : Math.round((counts.done / base) * 100),
        ops_open: ops.filter((op) => OPEN_OP.has(op.state)).length,
        ops_failed: ops.filter((op) => op.state === "failed").length,
        ops_uncertain: ops.filter((op) => op.state === "uncertain").length,
        needs_you: (records.workflow.needs_you as Json[]).length,
      },
    };
    return { data, human: `${records.id} ${records.workflow.state}: ${data.counts.done} done, ${data.counts.open} open, ${data.counts.ops_open} not yet in Notion\n` };
  },
};

const STATE_MOVES: Record<string, readonly string[]> = { connected: ["connected", "paused", "ended"], paused: ["paused", "connected", "ended"] };

/** `brain workflow set <wf> (--rev <n> --input <file|-> | --pointer <folder_path>)` (§3.4, §12). */
export const workflowSetCommand: Command = {
  ...commandBase,
  name: "workflow set",
  usage: "brain workflow set <wf> (--rev <n> --input <file|-> | --pointer <folder_path>) [--json]",
  summary: "Change a workflow's state, settings, status mapping, relations or outside tasks, or move it to its folder's Factory; or rewrite a lost pointer.",
  options: { rev: "string", input: "string", pointer: "string" },
  maxPositionals: 1,
  async run({ args, brain, now, environment }) {
    const records = open(brain!, args.positionals[0], "set");
    const pointer = args.options.pointer as string | undefined;
    if (pointer !== undefined) {
      if (args.options.input !== undefined) throw new BrainError("USAGE", "brain workflow set takes --input or --pointer, not both");
      if (!isAbsolute(pointer) || !existsSync(pointer) || !statSync(pointer).isDirectory()) throw new BrainError("INPUT_INVALID", `--pointer ${pointer} must be the absolute path of an existing folder`, [{ pointer: "/folder_path", message: "must be an existing absolute folder" }]);
      await writeFile(join(pointer, POINTER), serialize({ workflow: records.id }));
      return done(records, records.workflow, `wrote ${join(pointer, POINTER)}\n`);
    }
    const rev = revOf(args, "set");
    const input = await inputObject(args, "set");
    const workflow = records.workflow;
    const problems = [
      ...unknownKeys(input, ["id", "state", "settings", "status_map", "status_read", "relations", "modules_offered", "outside", "rev", "opted_in", "folder", "destination", "needs_you", "summary"], ""),
      ...managed(input, ["rev", "opted_in", "folder", "needs_you", "summary"]),
    ];
    if (input.id !== undefined && input.id !== records.id) problems.push({ pointer: "/id", message: `is not ${records.id}` });
    if (input.state !== undefined && !(STATE_MOVES[workflow.state] ?? []).includes(input.state)) problems.push({ pointer: "/state", message: `${workflow.state} can't become ${String(input.state)}` });
    if (isRecord(input.settings) && Object.hasOwn(input.settings, "read_at")) problems.push({ pointer: "/settings/read_at", message: "is managed by the command" });
    assertNoProblems(problems);
    assertRev(workflow, rev, records.id);
    if (input.destination !== undefined) await moveToFactory(brain!, records, input.destination, environment.homeDirectory);
    if (input.state !== undefined) workflow.state = input.state;
    // The connection is what made a plain folder a Factory, so ending it archives the row, in this commit (§3.5).
    const ended = workflow.state === "ended" && isFactory(records) ? factoryById(brain!.config, workflow.destination.factory) : undefined;
    if (ended?.path !== undefined && ended.archived !== true) {
      const factories = factoriesOf(brain!.config).map((entry) => (entry.id === ended.id ? orderedFactory({ ...entry, archived: true }) : entry));
      records.brainJson = `${JSON.stringify({ ...brain!.config, factories }, null, 2)}\n`;
    }
    if (isRecord(input.settings)) workflow.settings = { ...workflow.settings, ...input.settings, read_at: ts(now) };
    for (const key of ["status_map", "status_read", "relations", "modules_offered", "outside"]) if (input[key] !== undefined) workflow[key] = input[key];
    await records.commit(now, "set");
    return done(records, workflow, `${records.id}: ${workflow.state}\n`);
  },
};

/** Move a workflow from a Project or an Area to its folder's own Factory (§3.5): its records and their ids stay; nothing moves back. */
async function moveToFactory(brain: Brain, records: Records, destination: unknown, home: string | undefined): Promise<void> {
  const { workflow } = records;
  if (isFactory(records)) throw invalid("/destination", "a workflow of a Factory doesn't move");
  if (!isRecord(destination) || typeof destination.factory !== "string" || Object.keys(destination).length !== 1) throw invalid("/destination", "must be { factory }: a workflow moves only to its folder's Factory");
  const factory = await destinationFactory(brain, destination.factory, home);
  const path = factoryPath(brain.config, factory);
  const pointed = path === undefined ? null : await readPointer(join(expandPath(path, home), POINTER));
  // The record doesn't keep the folder's path: the link's name, or the pointer in the Factory's folder, says it is this workflow's.
  if (pointed !== records.id && (factory.repo === undefined || workflow.folder.repo !== factory.repo)) throw invalid("/destination", `${factory.name} isn't the Factory of this workflow's folder`);
  workflow.destination = { factory: factory.id };
  if (factory.repo !== undefined) workflow.folder = { ...workflow.folder, repo: factory.repo };
}

/** `brain workflow resolve <wf> --rev <n> --input <file|->` (§8.2, §12). */
export const workflowResolveCommand: Command = {
  ...commandBase,
  name: "workflow resolve",
  usage: "brain workflow resolve <wf> --rev <n> --input <file|-> [--json]",
  summary: "Apply the user's answers to the workflow's Needs you questions.",
  options: { rev: "string", input: "string" },
  maxPositionals: 1,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "resolve");
    const rev = revOf(args, "resolve");
    const input = await inputObject(args, "resolve");
    const problems = unknownKeys(input, ["answers"], "");
    if (!Array.isArray(input.answers) || input.answers.some((answer) => !isRecord(answer) || typeof answer.id !== "string" || typeof answer.choice !== "string")) problems.push({ pointer: "/answers", message: "must be a list of { id, choice }" });
    assertNoProblems(problems);
    assertRev(records.workflow, rev, records.id);
    const ops = resolve(records, input.answers as Json[], brain!.config, now);
    await records.commit(now, "resolve");
    return done(records, { workflow: records.workflow, ops }, `${(input.answers as Json[]).length} answer(s) applied; ${ops.length} operation(s) opened\n`);
  },
};

const ITEM_MANAGED = ["rev", "approved_at", "claim", "notion", "publication", "progress", "declined", "origin"];

function criteria(value: unknown, pointer: string, problems: InputProblem[]): Json[] {
  if (!Array.isArray(value)) { problems.push({ pointer, message: "must be a list of { text, met_at?, evidence? }" }); return []; }
  return value.map((criterion, index) => {
    if (!isRecord(criterion) || typeof criterion.text !== "string") { problems.push({ pointer: `${pointer}/${index}`, message: "must be { text, met_at?, evidence? }" }); return {}; }
    problems.push(...unknownKeys(criterion, ["text", "met_at", "evidence"], `${pointer}/${index}`));
    return { text: criterion.text, met_at: criterion.met_at ?? null, evidence: criterion.evidence ?? null };
  });
}

/** `task` (§8.4): the Notion task as the session just read it. */
function taskProblems(value: unknown): InputProblem[] {
  if (!isRecord(value)) return [{ pointer: "/task", message: "must be { page, title, status, brain_id }" }];
  const problems = unknownKeys(value, ["page", "title", "status", "brain_id"], "/task");
  if (typeof value.page !== "string" || !PAGE_ID.test(value.page)) problems.push({ pointer: "/task/page", message: "must be a Notion page id" });
  if (typeof value.title !== "string") problems.push({ pointer: "/task/title", message: "must be a string" });
  for (const key of ["status", "brain_id"]) if (value[key] !== null && typeof value[key] !== "string") problems.push({ pointer: `/task/${key}`, message: "must be a string or null" });
  return problems;
}

/** TASK_TAKEN when an item of an open workflow has the task, or its Brain ID is a `wi-` id (§8.4). */
function assertTaskFree(root: string, task: Json): void {
  const held = taskHolder(root, task.page, task.brain_id);
  if (held === null) return;
  throw new BrainError("TASK_TAKEN", held.item === null ? "The task was taken from another clone of the brain, or by a workflow since removed" : `The task is taken: ${held.item} in ${held.workflow}${held.holder === null ? "" : `, claimed by ${String(held.holder.by)}`}`, { ...held });
}

/** `accepted: { statement }`: the user's words; the command sets `at`. */
function acceptedProblems(input: Json): InputProblem[] {
  if (input.accepted === undefined) return [];
  const value = input.accepted;
  return isRecord(value) && typeof value.statement === "string" && value.statement !== "" && Object.keys(value).every((key) => key === "statement") ? [] : [{ pointer: "/accepted", message: "must be { statement }: the user's words" }];
}

function assertDepsExist(records: Records, depends: unknown): void {
  for (const id of Array.isArray(depends) ? depends : []) if (!records.items.has(id)) throw new BrainError("UNKNOWN_ID", `depends_on names ${String(id)}, which isn't an item of ${records.id}`);
}

/** `brain workflow item put <wf> --input <file|-> [--rev <n>]` (§5.2, §7.1, §12). */
export const workflowItemPutCommand: Command = {
  ...commandBase,
  name: "workflow item put",
  usage: "brain workflow item put <wf> --input <file|-> [--rev <n>] [--json]",
  summary: "Create a work item, or patch one: scope, criteria, status, progress, approval and acceptance.",
  options: { rev: "string", input: "string" },
  maxPositionals: 1,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "item put");
    const input = await inputObject(args, "item put");
    const problems: InputProblem[] = [];
    let item: Json;
    let free: (() => void) | undefined;
    if (input.id === undefined) {
      if (args.options.rev !== undefined) throw new BrainError("USAGE", "A new item has no revision: drop --rev");
      const factory = isFactory(records);
      problems.push(...unknownKeys(input, ["title", "scope", "acceptance", "status", "logging", "depends_on", "links", "approve", "accepted", ...(factory ? ["task"] : []), ...ITEM_MANAGED], ""), ...managed(input, ITEM_MANAGED), ...acceptedProblems(input));
      if (factory && input.task !== undefined) problems.push(...taskProblems(input.task));
      const task = factory && isRecord(input.task) ? input.task : undefined;
      if (task !== undefined && typeof task.title === "string" && input.title !== task.title) problems.push({ pointer: "/title", message: "must be the task's title" });
      if (factory && input.task === undefined && input.approve !== true) problems.push({ pointer: "/approve", message: "must be true: an item of a Factory is a task the user wrote, or one the user said yes to" });
      if (typeof input.title !== "string") problems.push({ pointer: "/title", message: "is required" });
      if (typeof input.scope !== "string") problems.push({ pointer: "/scope", message: "is required" });
      const acceptance = criteria(input.acceptance, "/acceptance", problems);
      assertNoProblems(problems);
      assertDepsExist(records, input.depends_on);
      if (task !== undefined) { free = () => assertTaskFree(brain!.root, task); free(); }
      item = {
        id: records.newId("wi"), rev: 1, title: input.title, scope: input.scope, acceptance,
        approved_at: input.approve === true ? ts(now) : null, status: input.status ?? "todo", logging: input.logging ?? null, depends_on: input.depends_on ?? [],
        ...(input.links === undefined ? {} : { links: input.links }), accepted: input.accepted === undefined ? null : { at: ts(now), statement: input.accepted.statement }, claim: null, progress: [],
        ...(task === undefined ? {} : { origin: { kind: "notion", ref: "tasks", key: task.page } }),
        notion: task === undefined ? null : { page: task.page, title: task.title, status: task.status ?? "", read_at: ts(now) }, publication: { state: "pending", at: ts(now), error: null },
      };
      records.items.set(item.id, item);
    } else {
      const rev = revOf(args, "item put");
      problems.push(...unknownKeys(input, ["id", "title", "scope", "acceptance", "status", "logging", "depends_on", "links", "approve", "accepted", "progress_add", "publish", ...ITEM_MANAGED], ""), ...managed(input, ITEM_MANAGED));
      const found = records.items.get(input.id);
      if (found === undefined) throw new BrainError("UNKNOWN_ID", `No item ${String(input.id)} in ${records.id}`);
      item = found;
      const acceptance = input.acceptance === undefined ? undefined : criteria(input.acceptance, "/acceptance", problems);
      problems.push(...acceptedProblems(input));
      if (input.progress_add !== undefined && (!Array.isArray(input.progress_add) || input.progress_add.some((text) => typeof text !== "string" || text === ""))) problems.push({ pointer: "/progress_add", message: "must be a list of texts" });
      if (input.publish !== undefined && input.publish !== true) problems.push({ pointer: "/publish", message: "can only be true" });
      assertNoProblems(problems);
      assertRev(item, rev, item.id);
      assertDepsExist(records, input.depends_on);
      // The user approves again when the scope or a criterion's text changes, or a criterion comes or goes (§7.1).
      const texts = (list: Json[]) => JSON.stringify(list.map((criterion) => criterion.text));
      if ((input.scope !== undefined && input.scope !== item.scope) || (acceptance !== undefined && texts(acceptance) !== texts(item.acceptance))) item.approved_at = null;
      for (const key of ["title", "scope", "logging", "depends_on", "links"]) if (input[key] !== undefined) item[key] = input[key];
      if (acceptance !== undefined) item.acceptance = acceptance;
      if (input.accepted !== undefined) item.accepted = { at: ts(now), statement: input.accepted.statement };
      for (const text of (input.progress_add as string[] | undefined) ?? []) progress(item, now, text);
      if (input.publish === true && item.publication.state === "local") item.publication = { state: "pending", at: ts(now), error: null };
      if (input.status !== undefined) setStatus(item, input.status);
      if (input.approve === true) item.approved_at = ts(now);
    }
    if (input.approve !== undefined && input.approve !== true) throw new BrainError("INPUT_INVALID", "1 problem in input: /approve can only be true", [{ pointer: "/approve", message: "can only be true" }]);
    if (!MEANINGS.includes(item.status)) throw new BrainError("INPUT_INVALID", "1 problem in input: /status is not a status meaning", [{ pointer: "/status", message: `must be one of ${MEANINGS.join(", ")}` }]);
    assertDoneAllowed(records, item);
    if (item.status === "done" || item.status === "dropped") item.claim = null;
    // Checked again right before the write: two sessions can't take the same task (§8.4).
    await records.commit(now, "item put", free);
    return done(records, item, `${item.id} ${item.status}\n`);
  },
};

/** `brain workflow item claim <wf> <wi> --by <label> [--take | --release]` (§10.1). */
export const workflowItemClaimCommand: Command = {
  ...commandBase,
  name: "workflow item claim",
  usage: "brain workflow item claim <wf> <wi> --by <label> [--take | --release] [--json]",
  summary: "Claim a work item before executing it, so two sessions never work on the same item.",
  options: { by: "string", take: "boolean", release: "boolean" },
  maxPositionals: 2,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "item claim");
    const [, wi] = args.positionals;
    const by = args.options.by as string | undefined;
    if (wi === undefined || by === undefined) throw new BrainError("USAGE", "brain workflow item claim needs <wf> <wi> --by <label>");
    if (args.options.take === true && args.options.release === true) throw new BrainError("USAGE", "--take and --release exclude each other");
    const item = records.items.get(wi);
    if (item === undefined) throw new BrainError("UNKNOWN_ID", `No item ${wi} in ${records.id}`);
    const claim = item.claim as Json | null;
    if (args.options.release === true) {
      if (claim !== null && claim.by !== by) throw new BrainError("CLAIMED", `${wi} is claimed by ${claim.by}, not ${by}`, { holder: claim });
      item.claim = null;
    } else {
      if (item.approved_at === null) throw new BrainError("NOT_APPROVED", `${wi}'s scope and criteria aren't approved yet: approve them before executing it`);
      if (claim !== null && claim.by !== by) {
        const last = (item.progress as Json[]).at(-1)?.at as string | undefined;
        const quiet = (stamp: string | undefined) => stamp === undefined || now.getTime() - new Date(stamp).getTime() > 2 * 3600 * 1000;
        const stale = quiet(claim.at) && quiet(last);
        if (!stale && args.options.take !== true) throw new BrainError("CLAIMED", `${wi} is claimed by ${claim.by} since ${claim.at}`, { holder: claim });
        progress(item, now, `Claim taken over from ${claim.by}`);
      }
      item.claim = { by, at: ts(now) };
    }
    await records.commit(now, "item claim");
    return done(records, item, `${wi}: ${item.claim === null ? "released" : `claimed by ${by}`}\n`);
  },
};

const ARTIFACT_MANAGED = ["rev", "approved_at", "publish", "published_sha256", "publication", "local_reason", "declined"];

/** `brain workflow artifact put <wf> --input <file|-> [--rev <n>]` (§5.3, §7.2, §12). */
export const workflowArtifactPutCommand: Command = {
  ...commandBase,
  name: "workflow artifact put",
  usage: "brain workflow artifact put <wf> --input <file|-> [--rev <n>] [--json]",
  summary: "Create an artifact, or patch one: approve a version, override its publication, or record its note.",
  options: { rev: "string", input: "string" },
  maxPositionals: 1,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "artifact put");
    const input = await inputObject(args, "artifact put");
    const problems: InputProblem[] = [];
    let artifact: Json;
    if (input.id === undefined) {
      if (args.options.rev !== undefined) throw new BrainError("USAGE", "A new artifact has no revision: drop --rev");
      problems.push(...unknownKeys(input, ["item", "category", "title", "format", "location", ...ARTIFACT_MANAGED, "sha256", "note", "approve", "override"], ""), ...managed(input, [...ARTIFACT_MANAGED, "sha256", "note", "approve", "override"]));
      assertNoProblems(problems);
      if (input.item !== undefined && input.item !== null && !records.items.has(input.item)) throw new BrainError("UNKNOWN_ID", `No item ${String(input.item)} in ${records.id}`);
      artifact = {
        id: records.newId("art"), rev: 1, item: input.item ?? null, category: input.category, title: input.title, format: input.format, location: input.location,
        sha256: null, approved_at: null, publish: null, local_reason: null, note: null, published_sha256: null, publication: { state: "pending", at: null, error: null },
      };
      records.artifacts.set(artifact.id, artifact);
    } else {
      const rev = revOf(args, "artifact put");
      problems.push(...unknownKeys(input, ["id", "item", "category", "title", "format", "location", "approve", "sha256", "override", "note", ...ARTIFACT_MANAGED], ""), ...managed(input, ARTIFACT_MANAGED));
      if (input.approve !== undefined && input.approve !== true) problems.push({ pointer: "/approve", message: "can only be true" });
      if (input.approve === true && typeof input.sha256 !== "string") problems.push({ pointer: "/sha256", message: "is required with approve: the approved content's hash" });
      if (input.sha256 !== undefined && input.approve !== true) problems.push({ pointer: "/sha256", message: "is only given with approve" });
      if (input.override !== undefined && input.override !== "include" && input.override !== "exclude") problems.push({ pointer: "/override", message: "must be include or exclude" });
      assertNoProblems(problems);
      const found = records.artifacts.get(input.id);
      if (found === undefined) throw new BrainError("UNKNOWN_ID", `No artifact ${String(input.id)} in ${records.id}`);
      artifact = found;
      assertRev(artifact, rev, artifact.id);
      if (input.note !== undefined) {
        const note = (await notesById(brain!)).get(input.note);
        if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note ${String(input.note)} in the brain`);
        artifact.note = input.note;
      }
      for (const key of ["item", "category", "title", "format", "location"]) if (input[key] !== undefined) artifact[key] = input[key];
      if (input.approve === true) approveArtifact(records, artifact, input.sha256, brain!.config, now);
      if (input.override !== undefined) {
        if (artifact.approved_at === null) throw new BrainError("INPUT_INVALID", "1 problem in input: /override applies to an approved artifact", [{ pointer: "/override", message: "approve the artifact first, or with it" }]);
        decidePublication(records, artifact, brain!.config, now, input.override);
        if (input.override === "include") artifact.declined = null;
      }
    }
    await records.commit(now, "artifact put");
    return done(records, artifact, `${artifact.id} ${artifact.publication.state}\n`);
  },
};

/** `brain workflow render <wf> --item <wi>` (§6.1): the Task payload and the Work record. Writes nothing. */
export const workflowRenderCommand: Command = {
  ...commandBase,
  name: "workflow render",
  usage: "brain workflow render <wf> --item <wi> [--json]",
  summary: "Render a work item's Notion Task payload and its Work record toggle. Writes nothing.",
  options: { item: "string" },
  maxPositionals: 1,
  async run({ args, brain }) {
    const records = open(brain!, args.positionals[0], "render");
    const wi = args.options.item as string | undefined;
    if (wi === undefined) throw new BrainError("USAGE", "brain workflow render needs --item <wi>");
    const item = records.items.get(wi);
    if (item === undefined) throw new BrainError("UNKNOWN_ID", `No item ${wi} in ${records.id}`);
    const workspace = await Workspace.open(brain!);
    const notes = new Map(workspace.notes.map((note) => [note.id, note]));
    const tasks = (brain!.config.notion as Json | undefined)?.tasks as Json | undefined;
    const names = (tasks?.properties ?? {}) as Record<string, string>;
    const properties: Json = {};
    const pending: Json[] = [];
    const put = (key: string, type: string, value: unknown, mode?: "if_empty") => { const name = names[key]; if (typeof name === "string" && name !== "") properties[name] = { type, value, ...(mode === undefined ? {} : { mode }) }; };
    put("title", "title", item.title);
    put("status", tasks?.status_type === "status" ? "status" : "select", records.workflow.status_map[item.status]);
    // The destination, and the area of a Project destination, each when mapped; one not yet in Notion is held back as in sync tasks.
    const relate = (key: string, id: string | undefined, page: unknown, mode?: "if_empty") => {
      if (id === undefined || typeof names[key] !== "string" || names[key] === "") return;
      if (typeof page === "string") put(key, "relation", [page], mode); else pending.push({ property: names[key], ids: [id] });
    };
    const pageOf = (id: string | undefined) => (id === undefined ? undefined : notes.get(id)?.attributes.notion);
    const destination = records.workflow.destination as Json;
    // A task the user wrote keeps every property but these three (§6.1, §8.4); its Brain ID is sent when empty.
    const taken = isFactory(records) && item.origin?.kind === "notion" && item.origin.ref === "tasks";
    if (isFactory(records) && !taken) {
      // A task the brain creates for a Factory has no Project: its Area is the Factory's, never over one the page has (0113 §9, 0114).
      const factory = factoryById(brain!.config, destination.factory);
      relate("factory", destination.factory, factory?.notion);
      const { area } = newTaskArea(workspace, [], undefined, factory === undefined ? [] : [factory]);
      relate("area", area, pageOf(area), item.notion === null ? undefined : "if_empty");
    } else if (!taken) {
      relate("project", destination.project, pageOf(destination.project));
      const area = destination.area ?? (destination.project === undefined ? undefined : notes.get(destination.project)?.attributes.area as string | undefined);
      relate("area", area, pageOf(area));
    }
    put("brain_id", "rich_text", item.id, taken ? "if_empty" : undefined);
    return {
      data: { payload: { database_id: tasks?.database ?? "", page_id: item.notion?.page ?? null, properties, pending_relations: pending }, toggle: { heading: "Work record", markdown: workRecord(records, item, notes) } },
      human: `Work record\n${workRecord(records, item, notes)}`,
    };
  },
};

const OP_STATES = new Set(["pending", "in_flight", "done", "failed", "uncertain", "dropped"]);
const ERROR_CODES = new Set(["network", "rate_limited", "server", "validation", "permission", "missing_property", "upload_unsupported", "other"]);

/** `brain workflow op state <wf> <op> --state <state> [--page <id>] [--error <json>]` (§10.2, §10.3, §12). */
export const workflowOpStateCommand: Command = {
  ...commandBase,
  name: "workflow op state",
  usage: "brain workflow op state <wf> <op> --state <state> [--page <id>] [--error <json>] [--json]",
  summary: "Move an operation through its states around a Notion call, and record its outcome.",
  options: { state: "string", page: "string", error: "string" },
  maxPositionals: 2,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "op state");
    const [, id] = args.positionals;
    const state = args.options.state as string | undefined;
    if (id === undefined || state === undefined) throw new BrainError("USAGE", "brain workflow op state needs <wf> <op> --state <state>");
    if (!OP_STATES.has(state)) throw new BrainError("INPUT_INVALID", `1 problem in input: /state ${state} is not an operation state`, [{ pointer: "/state", message: "must be pending, in_flight, done, failed or dropped" }]);
    const op = records.ops.get(id);
    if (op === undefined) throw new BrainError("UNKNOWN_ID", `No open operation ${id} in ${records.id}`);
    const page = args.options.page as string | undefined;
    if (page !== undefined && !PAGE_ID.test(page)) throw new BrainError("USAGE", `--page ${page} is not a Notion page id`);
    let error: OpError | undefined;
    if (args.options.error !== undefined) {
      try { error = JSON.parse(args.options.error as string); } catch { throw new BrainError("INPUT_INVALID", "1 problem in input: /error is not JSON", [{ pointer: "/error", message: "must be JSON: { code, message, lasting }" }]); }
      if (!isRecord(error) || !ERROR_CODES.has(String(error.code)) || typeof error.message !== "string" || typeof error.lasting !== "boolean" || Object.keys(error).length !== 3) throw new BrainError("INPUT_INVALID", "1 problem in input: /error must be { code, message, lasting }", [{ pointer: "/error", message: `must be { code, message, lasting } with code one of ${[...ERROR_CODES].join(", ")}` }]);
    }
    const before = structuredClone(op);
    moveOp(records, op, state, now, page, error);
    await records.commit(now, "op state");
    const target = records.items.get(before.target) ?? records.artifacts.get(before.target) ?? null;
    return done(records, { op: records.ops.get(id) ?? { ...op, state }, target }, `${id}: ${before.state} → ${state}\n`);
  },
};

/** The Factory whose workflow is reconciled: MODULE_OFF while Factories is off (§3.5), BRAIN_CONFIG_INVALID when it is no entry (schema §12). */
async function reconciledFactory(brain: Brain, id: string, home: string | undefined): Promise<{ archived: boolean }> {
  if (!factoriesOn(brain.config)) throw new BrainError("MODULE_OFF", "The Factories module is off, so this workflow works locally: brain modules on factories resumes it");
  const entry = (await readFactories(brain, undefined, home)).find((factory) => factory.id === id);
  if (entry === undefined) throw new BrainError("BRAIN_CONFIG_INVALID", `The workflow's Factory ${id} is no entry of brain.json factories`);
  return { archived: entry.archived === true };
}

/** `brain workflow reconcile <wf> --input <snapshot> [--start]` (§8, §10.2, §10.3). */
export const workflowReconcileCommand: Command = {
  ...commandBase,
  name: "workflow reconcile",
  usage: "brain workflow reconcile <wf> --input <snapshot> [--start] [--json]",
  summary: "Reconcile a workflow with a Notion snapshot: adopt Notion's changes, open operations, and list what needs the user.",
  options: { input: "string", start: "boolean" },
  maxPositionals: 1,
  async run({ args, brain, now, environment }) {
    const records = open(brain!, args.positionals[0], "reconcile");
    const snapshot = await inputObject(args, "reconcile");
    const validate = loadSchemas().workflow("snapshot");
    if (!validate(snapshot)) assertNoProblems((validate.errors ?? []).filter((error) => !["if", "anyOf", "allOf", "oneOf"].includes(error.keyword)).map((error) => ({ pointer: error.instancePath || "/", message: error.keyword === "additionalProperties" ? `unknown key ${String(error.params.additionalProperty)}` : error.message ?? error.keyword })));
    // The form of `destination` is this workflow's (§8.4): the row's page and label alone for a Factory, all five keys for a Project or an Area.
    const toFactory = isFactory(records);
    if (Object.hasOwn(snapshot.destination, "work_type") === toFactory) throw invalid("/destination", toFactory ? "is { page, workflow } for a Factory" : "needs all five keys for a Project or an Area");
    const factory = toFactory ? await reconciledFactory(brain!, records.workflow.destination.factory, environment.homeDirectory) : undefined;
    const result = reconcile(records, snapshot, await notesById(brain!), now, args.options.start === true, factory);
    await records.commit(now, "reconcile");
    const data = { ...result, needs_you: records.workflow.needs_you, ...(toFactory ? { open_tasks: openTasks(records.workflow, snapshot, (page, brainId) => taskHolder(brain!.root, page, brainId)) } : {}) };
    return { data, human: `${result.routine.length} routine change(s), ${data.needs_you.length} question(s), ${result.ops.length} operation(s) to run\n` };
  },
};

/** `brain workflow summary <wf> [--written <sha256>]` (§9). */
export const workflowSummaryCommand: Command = {
  ...commandBase,
  name: "workflow summary",
  usage: "brain workflow summary <wf> [--written <sha256>] [--json]",
  summary: "Render the dated Workflow summary for the destination's page, or record that it was written.",
  options: { written: "string" },
  maxPositionals: 1,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "summary");
    if (isFactory(records)) throw new BrainError("USAGE", "A Factory's page has its overview, not a workflow summary: brain factory overview");
    const { markdown, sha256 } = summaryOf(records, now);
    const written = args.options.written as string | undefined;
    if (written === undefined) return { data: { heading: "Workflow", markdown, sha256, changed: sha256 !== records.workflow.summary.sha256 }, human: markdown };
    if (written !== sha256) throw new BrainError("STALE_RECORD", `--written ${written} isn't the current summary (${sha256}): render it again`);
    records.workflow.summary = { written_at: ts(now), sha256 };
    await records.commit(now, "summary");
    return { data: { heading: "Workflow", markdown, sha256, changed: false }, human: `recorded the summary of ${records.id}\n` };
  },
};

/** On a Factory's workflow only Notion's own tasks are adopted: no plan item becomes a row (§8.4, 0113 §7). */
function adoptable(records: Records, input: ReturnType<typeof checkAdoptionInput>): ReturnType<typeof checkAdoptionInput> {
  if (isFactory(records)) assertNoProblems((input.items as Json[]).flatMap((item, index) => (item.origin.kind === "notion" ? [] : [{ pointer: `/items/${index}/origin/kind`, message: "a Factory's plan stays in its folder" }])));
  return input;
}

/** `brain workflow adopt preview <wf> --input <file|->` (§11.2). */
export const workflowAdoptPreviewCommand: Command = {
  ...commandBase,
  name: "workflow adopt preview",
  usage: "brain workflow adopt preview <wf> --input <file|-> [--json]",
  summary: "Preview what adopting an existing project's plans or issues would create and update. Writes nothing.",
  options: { input: "string" },
  maxPositionals: 1,
  async run({ args, brain }) {
    const records = open(brain!, args.positionals[0], "adopt preview");
    const preview = adoptPreview(records, adoptable(records, checkAdoptionInput(await readJsonInput(args.options.input as string | undefined, "workflow adopt preview"))));
    return { data: preview, human: `${(preview.create as Json[]).filter((entry) => entry.selected).length} to create, ${(preview.update as Json[]).length} to update, ${(preview.missing as Json[]).length} missing\n` };
  },
};

/** `brain workflow adopt apply <wf> --rev <n> --input <file|->` (§11.6). */
export const workflowAdoptApplyCommand: Command = {
  ...commandBase,
  name: "workflow adopt apply",
  usage: "brain workflow adopt apply <wf> --rev <n> --input <file|-> [--json]",
  summary: "Adopt the previewed items into the workflow, after the user's yes to the preview.",
  options: { rev: "string", input: "string" },
  maxPositionals: 1,
  async run({ args, brain, now }) {
    const records = open(brain!, args.positionals[0], "adopt apply");
    const rev = revOf(args, "adopt apply");
    const input = adoptable(records, checkAdoptionInput(await readJsonInput(args.options.input as string | undefined, "workflow adopt apply")));
    assertAdoptionRev(records, rev);
    const result = adoptApply(records, input, now);
    await records.commit(now, "adopt apply");
    return done(records, { ...result, adoption: records.adoption }, `${result.created.length} item(s) created, ${result.updated.length} updated\n`);
  },
};

/** `brain workflow publish-history <wf>` (§4): older artifacts the current level would publish. Writes nothing. */
export const workflowPublishHistoryCommand: Command = {
  ...commandBase,
  name: "workflow publish-history",
  usage: "brain workflow publish-history <wf> [--json]",
  summary: "List approved artifacts that an earlier level kept local and the current level would publish. Writes nothing.",
  options: {},
  maxPositionals: 1,
  async run({ args, brain }) {
    const records = open(brain!, args.positionals[0], "publish-history");
    const artifacts = publishHistory(records);
    return { data: { artifacts }, human: artifacts.length === 0 ? "nothing to publish\n" : `${artifacts.join("\n")}\n` };
  },
};

export const WORKFLOW_COMMANDS: readonly Command[] = [
  workflowNewCommand, workflowFindCommand, workflowShowCommand, workflowSetCommand, workflowResolveCommand, workflowItemPutCommand, workflowItemClaimCommand,
  workflowArtifactPutCommand, workflowRenderCommand, workflowOpStateCommand, workflowReconcileCommand, workflowSummaryCommand, workflowAdoptPreviewCommand,
  workflowAdoptApplyCommand, workflowPublishHistoryCommand,
];
