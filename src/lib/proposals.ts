import { isDeepStrictEqual } from "node:util";

import { BrainError } from "./errors.ts";
import { serializeNewFile } from "./frontmatter.ts";
import { generateId } from "./ids.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { assertStagedValid, checkNoteInput, stageNotes, type CreatedNote, type NoteInput } from "./note-new.ts";
import { compareCodePoints, type Note } from "./notes.ts";
import { newNotePath } from "./paths.ts";
import { formatDate } from "./time.ts";
import type { Workspace } from "./workspace.ts";

export const PROPOSAL_KINDS = ["update_fact", "add_to_note", "supersede", "contradiction", "merge", "new_item"] as const;
export const PROPOSAL_STATUSES = ["pending", "approved", "rejected", "edited", "applied", "closed"] as const;

/** Input keys of `proposal new`: the schema §11 fields the CLI does not set (spec/cli.md §5.6). */
const INPUT_KEYS = ["title", "kind", "target", "field", "before", "after", "from", "content", "note", "supersedes", "merge_into", "why", "source"];
/** Fields that make two pending proposals the same change (dedupe, spec/cli.md §5.6). */
const DEDUPE_KEYS = ["kind", "target", "field", "after", "content", "note", "supersedes", "merge_into"];

export interface CreatedProposal {
  id: string;
  kind: string;
  title: string;
  target?: string;
  path: string;
  before?: unknown;
}

export interface SkippedProposal {
  input_index: number;
  reason: "DUPLICATE_PENDING";
  existing: string;
}

/**
 * Stage proposals for `proposal new` (spec/cli.md §5.6) and validate them. Throws INPUT_INVALID,
 * UNKNOWN_ID or BEFORE_MISMATCH for the whole batch; nothing is staged in that case.
 */
export function stageProposals(
  workspace: Workspace,
  items: unknown,
  now: Date,
): { created: CreatedProposal[]; skipped: SkippedProposal[] } {
  if (!Array.isArray(items)) assertNoProblems([{ pointer: "/proposals", message: "must be a list" }]);
  const list = items as unknown[];
  const problems: InputProblem[] = [];
  list.forEach((item, index) => problems.push(...checkShape(item, `/proposals/${index}`)));
  assertNoProblems(problems);

  const today = formatDate(now);
  const created: CreatedProposal[] = [];
  const skipped: SkippedProposal[] = [];
  const pointers = new Map<string, string>();
  const start = workspace.checkpoint();
  try {
    (list as Array<Record<string, unknown>>).forEach((item, index) => {
      const pointer = `/proposals/${index}`;
      const fields = resolveFields(workspace, item, pointer, today);

      const duplicate = workspace.notes.find((note) =>
        note.type === "proposal" && note.attributes.status === "pending" &&
        DEDUPE_KEYS.every((key) => isDeepStrictEqual(note.attributes[key], fields[key])));
      if (duplicate !== undefined) {
        skipped.push({ input_index: index, reason: "DUPLICATE_PENDING", existing: duplicate.id });
        return;
      }

      const id = generateId("prp", workspace.ids());
      const attributes = { id, type: "proposal", created: today, updated: today, ...fields, status: "pending" };
      const path = newNotePath("proposal", String(item.title), today, (candidate) => workspace.exists(candidate));
      workspace.write(path, serializeNewFile(attributes, ""));
      pointers.set(path, pointer);
      const result: CreatedProposal = { id, kind: String(fields.kind), title: String(fields.title), path };
      if (fields.target !== undefined) result.target = String(fields.target);
      if (fields.before !== undefined) result.before = fields.before;
      created.push(result);
    });
    assertStagedValid(workspace, pointers);
  } catch (error) {
    workspace.restore(start);
    throw error;
  }
  return { created, skipped };
}

function checkShape(item: unknown, pointer: string): InputProblem[] {
  if (!isRecord(item)) return [{ pointer, message: "must be an object" }];
  const problems = unknownKeys(item, INPUT_KEYS, pointer);
  const at = (key: string, message: string) => problems.push({ pointer: `${pointer}/${key}`, message });
  if (!(PROPOSAL_KINDS as readonly unknown[]).includes(item.kind)) at("kind", `must be one of ${PROPOSAL_KINDS.join(", ")}`);
  for (const key of ["title", "why", "source"]) {
    if (typeof item[key] !== "string" || item[key] === "") at(key, "must be a non-empty string");
  }
  if (item.kind === "new_item") {
    if (item.target !== undefined) at("target", "a new_item has no target");
    problems.push(...checkNoteInput(item.note, `${pointer}/note`, false));
  } else if (typeof item.target !== "string") {
    at("target", "must be the id of an existing note");
  }
  // Everything else (field names, value shapes, required keys per kind) is checked by the proposal schema.
  return problems;
}

/** The proposal's own fields, with `before` and `from` filled in and per-kind rules checked. */
function resolveFields(workspace: Workspace, item: Record<string, unknown>, pointer: string, today: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const key of INPUT_KEYS) if (item[key] !== undefined) fields[key] = item[key];
  const kind = item.kind as string;
  const invalid = (key: string, message: string): never => {
    throw new BrainError("INPUT_INVALID", `${pointer}/${key} ${message}`, [{ pointer: `${pointer}/${key}`, message }]);
  };
  const existing = (key: string): Note => {
    const id = item[key];
    const note = typeof id === "string" ? workspace.get(id) : undefined;
    if (note === undefined) {
      throw new BrainError("UNKNOWN_ID", `${pointer}/${key}: no note with id ${String(id)}`, [{ pointer: `${pointer}/${key}`, message: "does not exist" }]);
    }
    return note;
  };

  if (kind === "new_item") {
    checkNewItem(workspace, item.note as NoteInput, `${pointer}/note`, today);
    return fields;
  }
  const target = existing("target");

  if (kind === "update_fact" || kind === "contradiction") {
    if (typeof item.field !== "string") invalid("field", "is required for this kind");
    const facts = isRecord(target.attributes.facts) ? target.attributes.facts : {};
    const current = facts[item.field as string];
    if (kind === "contradiction" && current === undefined) invalid("field", `${target.id} has no current facts.${String(item.field)} to contradict`);
    if (item.before !== undefined && !isDeepStrictEqual(item.before, current)) {
      throw new BrainError(
        "BEFORE_MISMATCH",
        `${pointer}/before is ${JSON.stringify(item.before)}, but ${target.id} facts.${String(item.field)} is ${current === undefined ? "absent" : JSON.stringify(current)}`,
        [{ pointer: `${pointer}/before`, message: "differs from the note's current value" }],
      );
    }
    if (current === undefined) delete fields.before;
    else fields.before = current;
    if (fields.from === undefined) {
      const meeting = typeof item.source === "string" && item.source.startsWith("mtg-") ? workspace.get(item.source) : undefined;
      fields.from = typeof meeting?.attributes.date === "string" ? meeting.attributes.date : today;
    }
  }
  if (kind === "supersede") {
    const older = existing("supersedes");
    if (older.id === target.id) invalid("supersedes", "must differ from target");
    if (older.type !== target.type) invalid("supersedes", `is a ${older.type}, target is a ${target.type}`);
    const relations = Array.isArray(older.attributes.relations) ? older.attributes.relations : [];
    if (relations.some((relation) => isRecord(relation) && relation.type === "superseded_by")) invalid("supersedes", `${older.id} is already superseded`);
  }
  if (kind === "merge") {
    const survivor = existing("merge_into");
    if (survivor.id === target.id) invalid("merge_into", "must differ from target");
    if (survivor.type !== target.type) invalid("merge_into", `is a ${survivor.type}, target is a ${target.type}`);
  }
  return fields;
}

/** A new_item's note must pass `note new` validation as apply would write it (spec/cli.md §5.6). */
function checkNewItem(workspace: Workspace, note: NoteInput, pointer: string, today: string): void {
  const before = workspace.checkpoint();
  try {
    const staged = stageNewItem(workspace, note, pointer, new Date(`${today}T00:00:00Z`));
    assertStagedValid(workspace, staged.pointers);
  } finally {
    workspace.restore(before);
  }
}

/**
 * Stage a new_item's note as a new note and add it to its meeting's `decisions` or `questions`
 * (spec/schema.md §11.2). Not validated: the caller does that.
 */
export function stageNewItem(
  workspace: Workspace,
  note: NoteInput,
  pointer: string,
  now: Date,
): { note: CreatedNote; meetingPath?: string; pointers: Map<string, string> } {
  const staged = stageNotes(workspace, [note], () => pointer, { now });
  const created = staged.created[0]!;
  const pointers = new Map(staged.pointers);
  const link = note.type === "decision" ? ["decided_in", "decisions"] : note.type === "question" ? ["raised_in", "questions"] : undefined;
  const meetingId = link === undefined ? undefined : note.frontmatter[link[0]!];
  const meeting = typeof meetingId === "string" ? workspace.get(meetingId) : undefined;
  if (link === undefined || meeting === undefined || meeting.type !== "meeting") return { note: created, pointers };

  const document = workspace.edit(meeting);
  const ids = Array.isArray(document.attributes[link[1]!]) ? (document.attributes[link[1]!] as unknown[]) : [];
  if (!ids.includes(created.id)) {
    document.attributes[link[1]!] = [...ids, created.id];
    document.attributes.updated = formatDate(now);
    workspace.save(meeting.path, document);
  }
  pointers.set(meeting.path, pointer);
  return { note: created, meetingPath: meeting.path, pointers };
}

/** Proposals with these statuses and target, sorted by `created` then id (spec/cli.md §5.6). */
export function listProposals(workspace: Workspace, statuses: readonly string[], target: string | undefined): Array<Record<string, unknown>> {
  return workspace.notes
    .filter((note) => note.type === "proposal")
    .filter((note) => statuses.length === 0 || statuses.includes(String(note.attributes.status)))
    .filter((note) => target === undefined || note.attributes.target === target)
    .map((note): Record<string, unknown> => ({ ...note.attributes, path: note.path }))
    .sort((a, b) => compareCodePoints(String(a.created), String(b.created)) || compareCodePoints(String(a.id), String(b.id)));
}
