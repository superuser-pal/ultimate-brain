import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { join, posix } from "node:path";
import { promisify } from "node:util";

import { BrainError } from "./errors.ts";
import { atomicWriteFile, ensureDirectory } from "./fs-safe.ts";
import { generateId, type IdPrefix } from "./ids.ts";
import { isRecord, type InputProblem } from "./input.ts";
import { assertCleanTree, commitWithOp, newOpId, recoverAll, removeJournal, sha, writeJournal, type JournalEntry } from "./journal.ts";
import { appendLog } from "./log.ts";
import { loadSchemas } from "./schemas.ts";
import { formatTimestamp } from "./time.ts";

// Workflow records in the brain (spec/connected-workflows.md §3.2, §7, §10.1): `_workflows/<wf-id>/`, written and committed by the CLI.

export const WORKFLOWS_DIR = "_workflows";

// The records are JSON objects whose shapes spec/schemas/workflow.schema.json holds; they are typed loosely here and validated before each write.
export type Json = Record<string, any>;

export interface WorkflowSummary { id: string; state: string; folder: { name: string; repo?: string }; destination: { project?: string; area?: string } }

function readJson(path: string): unknown {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return undefined; }
}

/** Every `workflow.json` that parses, ordered by id. Unreadable records are left to lint's `workflow-record`. */
export function listWorkflows(root: string): WorkflowSummary[] {
  const dir = join(root, WORKFLOWS_DIR);
  if (!existsSync(dir)) return [];
  const out: WorkflowSummary[] = [];
  for (const name of readdirSync(dir)) {
    const value = readJson(join(dir, name, "workflow.json"));
    if (isRecord(value) && typeof value.id === "string") out.push(value as unknown as WorkflowSummary);
  }
  return out.sort((a, b) => compare(a.id, b.id));
}

export const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export const isOpen = (workflow: { state: string }): boolean => workflow.state === "connected" || workflow.state === "paused";

/** The open (connected or paused) workflow whose `folder.repo` is this repo, as `{ id, state }`, or null (§3.1 allows at most one). */
export function openWorkflowForRepo(root: string, repo: string): { id: string; state: string } | null {
  const found = listWorkflows(root).find((workflow) => workflow.folder?.repo === repo && isOpen(workflow));
  return found === undefined ? null : { id: found.id, state: found.state };
}

/** Every record id under `_workflows/` (for id generation). */
export function recordIds(root: string): Set<string> {
  const ids = new Set<string>();
  const dir = join(root, WORKFLOWS_DIR);
  if (!existsSync(dir)) return ids;
  for (const wf of readdirSync(dir)) {
    ids.add(wf);
    for (const sub of ["items", "artifacts", "ops"]) {
      const folder = join(dir, wf, sub);
      if (existsSync(folder)) for (const file of readdirSync(folder)) ids.add(file.replace(/\.json$/, ""));
    }
  }
  return ids;
}

/** A workflow's records as read, and the writes a command stages on them. Paths are brain-relative. */
export class Records {
  readonly root: string;
  readonly id: string;
  workflow: Json;
  items = new Map<string, Json>();
  artifacts = new Map<string, Json>();
  ops = new Map<string, Json>();
  adoption: Json | null = null;
  /** The JSON text of each record when read (null: created by this command), keyed by path. */
  private readonly original = new Map<string, string | null>();
  private readonly deleted = new Set<string>();
  private readonly ids: Set<string>;

  private constructor(root: string, id: string, workflow: Json) {
    this.root = root;
    this.id = id;
    this.workflow = workflow;
    this.ids = recordIds(root);
  }

  /** Load a workflow's records: WORKFLOW_NOT_FOUND when there is none. */
  static load(root: string, id: string): Records {
    const dir = join(root, WORKFLOWS_DIR, id);
    const workflow = /^wf-[0-9a-z]{8}$/.test(id) ? readJson(join(dir, "workflow.json")) : undefined;
    if (!isRecord(workflow)) throw new BrainError("WORKFLOW_NOT_FOUND", `No workflow ${id} in the brain`);
    const records = new Records(root, id, workflow);
    records.original.set(records.workflowPath, JSON.stringify(workflow));
    for (const [sub, map] of [["items", records.items], ["artifacts", records.artifacts], ["ops", records.ops]] as const) {
      const folder = join(dir, sub);
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder).filter((name) => name.endsWith(".json")).sort()) {
        const value = readJson(join(folder, file));
        if (!isRecord(value)) continue;
        map.set(value.id as string, value);
        records.original.set(`${WORKFLOWS_DIR}/${id}/${sub}/${file}`, JSON.stringify(value));
      }
    }
    const adoption = readJson(join(dir, "adoption.json"));
    if (isRecord(adoption)) { records.adoption = adoption; records.original.set(records.adoptionPath, JSON.stringify(adoption)); }
    return records;
  }

  /** A new workflow's records, written on commit. */
  static create(root: string, workflow: Json): Records {
    return new Records(root, workflow.id as string, workflow);
  }

  get workflowPath(): string { return `${WORKFLOWS_DIR}/${this.id}/workflow.json`; }
  get adoptionPath(): string { return `${WORKFLOWS_DIR}/${this.id}/adoption.json`; }
  pathOf(kind: "items" | "artifacts" | "ops", id: string): string { return `${WORKFLOWS_DIR}/${this.id}/${kind}/${id}.json`; }

  newId(prefix: IdPrefix): string {
    const id = generateId(prefix, this.ids);
    this.ids.add(id);
    return id;
  }

  /** The revision a record had when read (0 for a new one). */
  originalRev(path: string): number {
    const text = this.original.get(path);
    return text === undefined || text === null ? 0 : (JSON.parse(text).rev as number);
  }

  deleteOp(id: string): void {
    this.ops.delete(id);
    this.deleted.add(this.pathOf("ops", id));
  }

  /** The records whose content changed, each with its new revision, and the deleted ops. */
  private changes(): Array<[string, Json | null]> {
    const current: Array<[string, Json]> = [[this.workflowPath, this.workflow]];
    for (const [id, item] of this.items) current.push([this.pathOf("items", id), item]);
    for (const [id, artifact] of this.artifacts) current.push([this.pathOf("artifacts", id), artifact]);
    for (const [id, op] of this.ops) current.push([this.pathOf("ops", id), op]);
    if (this.adoption !== null) current.push([this.adoptionPath, this.adoption]);
    const out: Array<[string, Json | null]> = [];
    for (const [path, record] of current) {
      const before = this.original.get(path);
      const { rev: _rev, ...rest } = record;
      const beforeRest = before === undefined || before === null ? null : (() => { const { rev: _r, ...other } = JSON.parse(before); return JSON.stringify(other); })();
      if (beforeRest === JSON.stringify(rest)) { record.rev = this.originalRev(path) || record.rev; continue; }
      record.rev = this.originalRev(path) + 1;
      out.push([path, record]);
    }
    for (const path of this.deleted) if (this.original.has(path)) out.push([path, null]);
    return out.sort(([a], [b]) => compare(a, b));
  }

  /** Whether the command changed anything. */
  get dirty(): boolean { return this.changes().length > 0; }

  /**
   * Validate and commit every change as one journaled operation (§10.1, capture-and-review §7.11): STALE_RECORD when a record changed on
   * disk since it was read; BRAIN_BUSY when Git's index lock stays for 10 seconds. Returns the brain commit's op id, or null when nothing changed.
   */
  async commit(now: Date, command: string): Promise<string | null> {
    const changes = this.changes();
    if (changes.length === 0) return null;
    const problems: InputProblem[] = [];
    const schemas = loadSchemas();
    for (const [path, record] of changes) {
      if (record === null) continue;
      const def = path.endsWith("/workflow.json") ? "workflow" : path.endsWith("/adoption.json") ? "adoption" : path.includes("/items/") ? "item" : path.includes("/artifacts/") ? "artifact" : "op";
      const validate = schemas.workflow(def);
      if (!validate(record)) for (const error of validate.errors ?? []) if (!["if", "anyOf", "allOf", "oneOf"].includes(error.keyword)) problems.push({ pointer: `/${posix.basename(path)}${error.instancePath}`, message: error.message ?? error.keyword });
    }
    if (problems.length > 0) throw new BrainError("INPUT_INVALID", `The ${command} would write an invalid record: ${problems[0]!.pointer} ${problems[0]!.message}`, problems);
    for (const [path] of changes) {
      const onDisk = readJson(join(this.root, path));
      const expected = this.original.get(path);
      const was = expected === undefined || expected === null ? undefined : JSON.parse(expected).rev;
      if ((isRecord(onDisk) ? onDisk.rev : undefined) !== was) throw new BrainError("STALE_RECORD", `${path} changed since it was read: read it again and retry`);
    }
    await waitForIndex(this.root);
    await assertCleanTree(this.root);

    const op = newOpId();
    const logPath = `log/${formatTimestamp(now).slice(0, 7)}.md`;
    const entries: JournalEntry[] = changes.map(([path, record]) => ({ path, hash: record === null ? null : sha(serialize(record)), new: !this.original.has(path) || this.original.get(path) === null }));
    entries.push({ path: logPath, hash: null, new: !existsSync(join(this.root, logPath)) });
    await writeJournal(this.root, { op, written: now.toISOString(), entries });
    try {
      for (const [path, record] of changes) {
        if (record === null) { await unlink(join(this.root, path)); continue; }
        await ensureDirectory(this.root, posix.dirname(path));
        await atomicWriteFile(this.root, path, serialize(record));
      }
      await appendLog(this.root, now, [{ op: "workflow", id: "-", title: this.id, pairs: [["command", command.replaceAll(" ", "-")]] }]);
      await commitWithOp(this.root, op, entries.map((entry) => entry.path), `workflow: ${command} ${this.id}`);
    } catch (error) {
      try { await recoverAll(this.root); } catch { /* the journal stays; every command refuses until recover */ }
      throw error instanceof BrainError ? error : new BrainError("INTERNAL", `The write failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`);
    }
    await removeJournal(this.root, op);
    for (const [path, record] of changes) {
      if (record === null) { this.original.delete(path); this.deleted.delete(path); } else this.original.set(path, JSON.stringify(record));
    }
    return op;
  }
}

export const serialize = (record: Json): string => `${JSON.stringify(record, null, 2)}\n`;

const exec = promisify(execFile);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait up to 10 seconds for Git's index lock to go (§10.1), then BRAIN_BUSY. */
async function waitForIndex(root: string): Promise<void> {
  let lock: string;
  try { lock = (await exec("git", ["rev-parse", "--git-path", "index.lock"], { cwd: root })).stdout.trim(); } catch { return; }
  const path = lock.startsWith("/") ? lock : join(root, lock);
  for (let waited = 0; existsSync(path); waited += 200) {
    if (waited >= 10_000) throw new BrainError("BRAIN_BUSY", "Git's index is locked by another writer: try again in a moment");
    await sleep(200);
  }
}

export interface RecordProblem { path: string; message: string }

/** Lint's `workflow-record` (connected-workflows.md §12): a record that fails its schema, or an operation, map entry or dependency naming a record that doesn't exist. */
export function workflowRecordProblems(root: string): RecordProblem[] {
  const dir = join(root, WORKFLOWS_DIR);
  if (!existsSync(dir)) return [];
  const problems: RecordProblem[] = [];
  const schemas = loadSchemas();
  const check = (path: string, def: string): Json | null => {
    const value = readJson(join(root, path));
    if (value === undefined) { problems.push({ path, message: "is not readable JSON" }); return null; }
    const validate = schemas.workflow(def);
    if (!validate(value)) {
      const first = (validate.errors ?? []).find((error) => !["if", "anyOf", "allOf", "oneOf"].includes(error.keyword)) ?? validate.errors?.[0];
      problems.push({ path, message: `fails the ${def} schema: ${first?.instancePath || "/"} ${first?.message ?? ""}`.trim() });
      return null;
    }
    return value as Json;
  };
  for (const wf of readdirSync(dir).sort()) {
    const base = `${WORKFLOWS_DIR}/${wf}`;
    if (!existsSync(join(root, base, "workflow.json"))) { problems.push({ path: base, message: "has no workflow.json" }); continue; }
    check(`${base}/workflow.json`, "workflow");
    const records: Record<string, Map<string, Json>> = { items: new Map(), artifacts: new Map(), ops: new Map() };
    const defs: Record<string, string> = { items: "item", artifacts: "artifact", ops: "op" };
    for (const sub of Object.keys(records)) {
      const folder = join(root, base, sub);
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder).sort()) {
        const path = `${base}/${sub}/${file}`;
        const value = check(path, defs[sub]!);
        if (value === null) continue;
        if (`${value.id}.json` !== file) problems.push({ path, message: `holds ${String(value.id)}, not ${file.replace(/\.json$/, "")}` });
        records[sub]!.set(value.id, value);
      }
    }
    for (const [id, item] of records.items!) for (const dep of item.depends_on as string[]) if (!records.items!.has(dep)) problems.push({ path: `${base}/items/${id}.json`, message: `depends_on names ${dep}, which doesn't exist` });
    for (const [id, artifact] of records.artifacts!) if (artifact.item !== null && !records.items!.has(artifact.item)) problems.push({ path: `${base}/artifacts/${id}.json`, message: `item names ${String(artifact.item)}, which doesn't exist` });
    for (const [id, op] of records.ops!) if (!records.items!.has(op.target) && !records.artifacts!.has(op.target)) problems.push({ path: `${base}/ops/${id}.json`, message: `target names ${String(op.target)}, which doesn't exist` });
    if (existsSync(join(root, base, "adoption.json"))) {
      const adoption = check(`${base}/adoption.json`, "adoption");
      for (const entry of (adoption?.map as Json[] | undefined) ?? []) if (!records.items!.has(entry.item)) problems.push({ path: `${base}/adoption.json`, message: `the map names ${String(entry.item)}, which doesn't exist` });
    }
  }
  return problems;
}
