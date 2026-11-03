import { BrainError } from "./errors.ts";
import { assertNoProblems, type InputProblem } from "./input.ts";
import { loadSchemas } from "./schemas.ts";
import { openOp, progress, ts } from "./workflow-model.ts";
import type { Json, Records } from "./workflow-store.ts";

// Adoption of an existing project (spec/connected-workflows.md §11): one preview, then one journaled apply; a rerun duplicates nothing.

const originKey = (origin: Json): string => `${origin.kind}\u0000${origin.ref}\u0000${origin.key}`;
const TREATMENTS: Record<string, readonly string[]> = { markdown: ["keep"], notion: ["keep"], other: ["keep"], github: ["keep", "mark_transferred", "close_transferred"], gitlab: ["keep", "mark_transferred", "close_transferred"] };

/** Validate the adoption input (§11.2): its schema, and keys unique within it. */
export function checkAdoptionInput(value: unknown): Json {
  const validate = loadSchemas().workflow("adoptionInput");
  if (!validate(value)) {
    const problems = (validate.errors ?? []).filter((error) => !["if", "anyOf", "allOf", "oneOf"].includes(error.keyword)).map((error) => ({ pointer: error.instancePath || "/", message: error.keyword === "additionalProperties" ? `unknown key ${String(error.params.additionalProperty)}` : error.message ?? error.keyword }));
    assertNoProblems(problems.length > 0 ? problems : [{ pointer: "/", message: "is not an adoption input" }]);
  }
  const input = value as Json;
  const seen = new Set<string>();
  const problems: InputProblem[] = [];
  (input.items as Json[]).forEach((item, index) => {
    const key = originKey(item.origin);
    if (seen.has(key)) problems.push({ pointer: `/items/${index}/origin/key`, message: `${item.origin.key} appears twice` });
    seen.add(key);
  });
  assertNoProblems(problems);
  return input;
}

function mapOf(records: Records): Map<string, Json> {
  return new Map(((records.adoption?.map as Json[] | undefined) ?? []).map((entry) => [originKey(entry.origin), entry]));
}

const isSelected = (input: Json, item: Json): boolean => (Array.isArray(input.selected) ? (input.selected as string[]).includes(item.origin.key) : item.meaning !== "done" && item.meaning !== "dropped");

const isOptionKnown = (workflow: Json, option: string): boolean =>
  Object.values(workflow.status_map).some((value) => String(value).toLowerCase() === option.toLowerCase()) || Object.keys(workflow.status_read ?? {}).some((value) => value.toLowerCase() === option.toLowerCase());

/** `adopt preview` (§11.2): what apply would do, without writing. */
export function adoptPreview(records: Records, input: Json): Json {
  const workflow = records.workflow;
  const map = mapOf(records);
  const create: Json[] = []; const update: Json[] = []; const untouched: Json[] = []; const missing: Json[] = [];
  const dependencies: Json[] = []; const originals: Json[] = []; const warnings: string[] = [];
  const byKey = new Map((input.items as Json[]).map((item) => [item.origin.key as string, item]));
  for (const item of input.items as Json[]) {
    const entry = map.get(originKey(item.origin));
    if (entry !== undefined) {
      const current = records.items.get(entry.item);
      const changes: Json = {};
      if (current !== undefined && item.title !== current.title) changes.title = item.title;
      if (current !== undefined && item.body !== "" && item.body !== current.scope) changes.body = item.body;
      // `selected` names the updates to make too; without it every change is made.
      if (Object.keys(changes).length === 0) untouched.push({ key: item.origin.key, item: entry.item, reason: "unchanged" });
      else if (Array.isArray(input.selected) && !(input.selected as string[]).includes(item.origin.key)) untouched.push({ key: item.origin.key, item: entry.item, reason: "not selected" });
      else update.push({ key: item.origin.key, item: entry.item, changes });
      continue;
    }
    const selected = isSelected(input, item);
    create.push({ key: item.origin.key, title: item.title, meaning: item.meaning, option: workflow.status_map[item.meaning], selected });
    if (!selected) continue;
    if (/#\d+$/.test(item.origin.key)) warnings.push(`${item.origin.key}: a repeated line; its mapping depends on its order in ${item.origin.ref}`);
    const choices = TREATMENTS[item.origin.kind]!;
    originals.push({ key: item.origin.key, choices, default: "keep" });
    if ((item.depends_on as string[]).length > 0) {
      const dropped: string[] = []; const notes: string[] = [];
      for (const dep of item.depends_on as string[]) {
        const other = byKey.get(dep);
        const mapped = [...map.values()].find((entry) => entry.origin.key === dep);
        const status = other?.meaning ?? (mapped === undefined ? undefined : records.items.get(mapped.item)?.status);
        if (status === "done") dropped.push(dep);
        else if (other !== undefined && mapped === undefined && !isSelected(input, other)) notes.push(`${dep} is open and not selected`);
        else if (other === undefined && mapped === undefined) notes.push(`${dep} is not in the input`);
      }
      dependencies.push({ key: item.origin.key, depends_on: item.depends_on, dropped, warnings: notes });
    }
  }
  const sources = new Set((input.sources as Json[]).map((source) => `${source.kind}\u0000${source.ref}`));
  const inInput = new Set((input.items as Json[]).map((item) => originKey(item.origin)));
  for (const entry of map.values()) if (sources.has(`${entry.origin.kind}\u0000${entry.origin.ref}`) && !inInput.has(originKey(entry.origin))) missing.push({ key: entry.origin.key, item: entry.item });
  const options = [...new Set((input.items as Json[]).filter((item) => item.origin.kind === "notion" && !map.has(originKey(item.origin)) && !isOptionKnown(workflow, item.raw_status)).map((item) => item.raw_status as string))];
  return { create, update, untouched, missing, dependencies, originals, status_options: options.map((option) => ({ option, meaning: null })), unsupported: input.unsupported, conventions: input.conventions, warnings };
}

/** `adopt apply` (§11.6): items, map entries, a run and the conventions, in one commit. Returns the created and updated item ids. */
export function adoptApply(records: Records, input: Json, now: Date): { created: string[]; updated: string[]; ops: string[] } {
  const workflow = records.workflow;
  const preview = adoptPreview(records, input);
  const problems: InputProblem[] = [];
  (input.conventions as Json[]).forEach((convention, index) => { if (convention.choice === undefined) problems.push({ pointer: `/conventions/${index}/choice`, message: "needs keep, adapt or decline" }); });
  const statusRead = (input.status_read ?? {}) as Json;
  for (const { option } of preview.status_options as Json[]) if (statusRead[option] === undefined) problems.push({ pointer: `/status_read/${option}`, message: `Notion option ${option} needs a meaning` });
  const treatments = (input.treatments ?? {}) as Json;
  const kinds = new Map((input.items as Json[]).map((item) => [item.origin.key as string, item.origin.kind as string]));
  for (const [key, treatment] of Object.entries(treatments)) {
    const kind = kinds.get(key);
    if (kind === undefined) problems.push({ pointer: `/treatments/${key}`, message: "names no item of the input" });
    else if (!TREATMENTS[kind]!.includes(treatment)) problems.push({ pointer: `/treatments/${key}`, message: `${kind} originals take ${TREATMENTS[kind]!.join(" or ")}` });
  }
  assertNoProblems(problems);
  if (Object.keys(statusRead).length > 0) workflow.status_read = { ...workflow.status_read, ...statusRead };

  records.adoption ??= { rev: 0, runs: [], map: [], conventions: [] };
  const adoption = records.adoption;
  const connected = workflow.state === "connected";
  const created: string[] = []; const updated: string[] = []; const ops: string[] = [];
  const selectedNew = (preview.create as Json[]).filter((entry) => entry.selected).map((entry) => entry.key as string);
  const byKey = new Map((input.items as Json[]).map((item) => [item.origin.key as string, item]));
  const ids = new Map<string, string>();
  for (const key of selectedNew) ids.set(key, records.newId("wi"));
  for (const entry of adoption.map as Json[]) ids.set(entry.origin.key, entry.item);

  for (const key of selectedNew) {
    const source = byKey.get(key)!;
    const id = ids.get(key)!;
    const dropped = new Set(((preview.dependencies as Json[]).find((entry) => entry.key === key)?.dropped ?? []) as string[]);
    const item: Json = {
      id, rev: 1, title: source.title, scope: source.body === "" ? source.title : source.body, acceptance: [], approved_at: ts(now),
      status: source.meaning, logging: null,
      depends_on: [...new Set((source.depends_on as string[]).filter((dep) => !dropped.has(dep)).map((dep) => ids.get(dep)).filter((dep): dep is string => dep !== undefined))],
      origin: source.origin, accepted: source.meaning === "done" ? { at: ts(now), statement: "Done before adoption" } : null,
      claim: null, progress: [], notion: null, publication: { state: "pending", at: ts(now), error: null },
    };
    progress(item, now, `Adopted from ${source.origin.ref} ${source.origin.key} as ${source.raw_status}`);
    records.items.set(id, item);
    if (source.origin.kind === "notion") {
      item.notion = { page: source.origin.key, title: source.title, status: source.raw_status, read_at: ts(now) };
      if ((source.brain_id === null || source.brain_id === "") && connected) { const op = openOp(records, "update_task", id, { title: source.title, status: source.raw_status, brain_id: id }, now); if (op !== null) ops.push(op.id); }
      else if (source.brain_id !== null && source.brain_id !== "") item.publication = { state: "published", at: ts(now), error: null };
    } else if (connected) { const op = openOp(records, "create_task", id, { title: source.title, status: workflow.status_map[source.meaning], brain_id: id }, now); if (op !== null) ops.push(op.id); }
    const treatment = (treatments[key] as string | undefined) ?? "keep";
    (adoption.map as Json[]).push({ origin: source.origin, item: id, treatment, marked: treatment === "keep" });
    created.push(id);
  }
  for (const change of preview.update as Json[]) {
    const item = records.items.get(change.item);
    if (item === undefined) continue;
    if (change.changes.title !== undefined) item.title = change.changes.title;
    if (change.changes.body !== undefined && change.changes.body !== "") item.scope = change.changes.body;
    item.approved_at = ts(now);
    updated.push(item.id);
  }
  (adoption.runs as Json[]).push({ at: ts(now), sources: input.sources, created: created.length, updated: updated.length, untouched: (preview.untouched as Json[]).length });
  for (const convention of input.conventions as Json[]) {
    const entry: Json = { rule: convention.rule, source: convention.source, choice: convention.choice };
    if (convention.note !== undefined) entry.note = convention.note;
    const at = (adoption.conventions as Json[]).findIndex((existing) => existing.rule === entry.rule && existing.source === entry.source);
    if (at === -1) (adoption.conventions as Json[]).push(entry); else (adoption.conventions as Json[])[at] = entry;
  }
  return { created, updated, ops };
}

/** STALE_RECORD unless `--rev` is the revision of adoption.json (0 before the first run). */
export function assertAdoptionRev(records: Records, rev: number): void {
  const current = (records.adoption?.rev as number | undefined) ?? 0;
  if (current !== rev) throw new BrainError("STALE_RECORD", `adoption.json is at revision ${current}, not ${rev}: preview again and retry`);
}
