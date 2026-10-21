import { createHash } from "node:crypto";

import { BrainError } from "./errors.ts";
import { serializeNewFile } from "./frontmatter.ts";
import { generateId, TYPE_PREFIX } from "./ids.ts";
import { assertNoProblems, escapePointer, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { rangesProblem, splitParts } from "./parts.ts";
import { newNotePath } from "./paths.ts";
import { formatDate, formatTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";

/** One `brain note new` input item (spec/cli.md §5.5). */
export interface NoteInput {
  type: string;
  id?: string;
  title: string;
  file_date?: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface CreatedNote {
  id: string;
  type: string;
  title: string;
  path: string;
}

export interface SkippedNote {
  input_index: number;
  reason: "DUPLICATE_SOURCE";
  existing: string;
}

export interface StagedNotes {
  created: CreatedNote[];
  skipped: SkippedNote[];
  /** Input pointer of each staged path, to report lint errors against the input. */
  pointers: Map<string, string>;
}

const ITEM_KEYS = ["type", "id", "title", "file_date", "frontmatter", "body"];
const KNOWLEDGE_TYPES = new Set(["area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "memory"]);
const NEW_NOTE_TYPES = new Set([...KNOWLEDGE_TYPES, "source"]);
const FORBIDDEN_KEYS = ["id", "type", "title", "created", "updated", "lifecycle"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Types whose path uses the note's own `date` (spec/cli.md §3.8). */
const DATED_BY_FIELD = new Set(["meeting", "decision"]);

function isDate(value: unknown): boolean {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

/** Shape problems of one input item; `withId: false` for a proposal's `note`, which has no id. */
export function checkNoteInput(value: unknown, pointer: string, withId = true): InputProblem[] {
  if (!isRecord(value)) return [{ pointer, message: "must be an object" }];
  const problems = unknownKeys(value, withId ? ITEM_KEYS : ITEM_KEYS.filter((key) => key !== "id"), pointer);
  const at = (key: string, message: string) => problems.push({ pointer: `${pointer}/${key}`, message });

  if (typeof value.type !== "string" || !NEW_NOTE_TYPES.has(value.type)) {
    at("type", `must be one of ${[...NEW_NOTE_TYPES].join(", ")} (views and proposals have their own commands)`);
  }
  if (typeof value.title !== "string" || value.title === "") at("title", "must be a non-empty string");
  if (value.id !== undefined) {
    const prefix = TYPE_PREFIX[String(value.type)];
    if (typeof value.id !== "string" || prefix === undefined || !new RegExp(`^${prefix}-[0-9a-hjkmnp-tv-z]{8}$`).test(value.id)) {
      at("id", `must be a ${prefix ?? "<prefix>"}- id from brain id new`);
    }
  }
  if (value.file_date !== undefined && !isDate(value.file_date)) at("file_date", "must be a real date, YYYY-MM-DD");
  if (typeof value.body !== "string") at("body", "must be a string");
  else if (value.type === "source" && value.body.includes("\r")) at("body", "must use LF line endings (a source is hashed byte for byte)");
  if (!isRecord(value.frontmatter)) {
    at("frontmatter", "must be an object");
  } else {
    const forbidden = value.type === "source" ? [...FORBIDDEN_KEYS, "content_hash"] : FORBIDDEN_KEYS;
    for (const key of Object.keys(value.frontmatter)) {
      if (forbidden.includes(key)) at(`frontmatter/${escapePointer(key)}`, "is set by the CLI");
    }
    if (value.type === "source") {
      // Order, overlap and the part count are not in the JSON Schema (spec/cli.md §5.5).
      if (value.frontmatter.notion_text_requested !== undefined) at("frontmatter/notion_text_requested", "is set by brain source full-text");
      const parts = value.frontmatter.notion_parts;
      if (Array.isArray(parts) && typeof value.body === "string") {
        const problem = rangesProblem(parts, splitParts(value.body).parts.length);
        if (problem !== null) at("frontmatter/notion_parts", problem);
      }
    }
  }
  return problems;
}

export interface StageOptions {
  now: Date;
  /** Lifecycle of new knowledge notes; `sync apply` keeps the one set in Notion. Default `draft` (0003). */
  lifecycle?: string;
}

/**
 * Stage new notes in the workspace (spec/cli.md §5.5) without validating them, so a caller can
 * stage related writes (a meeting back-reference) first. Items must have passed `checkNoteInput`.
 * Throws ID_IN_USE when an input id already exists or repeats in the batch.
 */
export function stageNotes(
  workspace: Workspace,
  items: readonly NoteInput[],
  pointerOf: (index: number) => string,
  options: StageOptions,
): StagedNotes {
  const existing = workspace.ids();
  const seen = new Set<string>();
  const clashes: InputProblem[] = [];
  items.forEach((item, index) => {
    if (item.id === undefined) return;
    if (existing.has(item.id) || seen.has(item.id)) clashes.push({ pointer: `${pointerOf(index)}/id`, message: `${item.id} is already in use` });
    seen.add(item.id);
  });
  if (clashes.length > 0) throw new BrainError("ID_IN_USE", `${clashes[0]!.pointer} ${clashes[0]!.message}`, clashes);

  // attached_to names a source that exists, or comes earlier in the batch, and isn't attached itself (spec/cli.md §5.5, 0042).
  const parents: InputProblem[] = [];
  items.forEach((item, index) => {
    const parent = item.type === "source" ? item.frontmatter.attached_to : undefined;
    if (parent === undefined) return;
    const existingParent = workspace.get(String(parent));
    const earlier = items.slice(0, index).find((candidate) => candidate.id === parent);
    const type = existingParent?.type ?? earlier?.type;
    const attached = existingParent !== undefined ? existingParent.attributes.attached_to : earlier?.frontmatter.attached_to;
    const problem = type === undefined ? `${String(parent)} is not an existing source or one earlier in the batch`
      : type !== "source" ? `${String(parent)} is a ${type}, not a source`
      : attached !== undefined ? `${String(parent)} is attached to ${String(attached)} itself; attach to that source instead`
      : undefined;
    if (problem !== undefined) parents.push({ pointer: `${pointerOf(index)}/frontmatter/attached_to`, message: problem });
  });
  // A repo file names a linked repo of brain.json (0042).
  const repoNames = new Set(Array.isArray(workspace.config.repos) ? workspace.config.repos.filter(isRecord).map((repo) => repo.name) : []);
  items.forEach((item, index) => {
    const repo = item.type === "source" ? item.frontmatter.repo : undefined;
    if (repo !== undefined && !repoNames.has(repo)) parents.push({ pointer: `${pointerOf(index)}/frontmatter/repo`, message: `${String(repo)} is not a linked repo in brain.json repos` });
  });
  assertNoProblems(parents);

  const today = formatDate(options.now);
  const taken = new Set([...existing, ...seen]);
  const result: StagedNotes = { created: [], skipped: [], pointers: new Map() };

  items.forEach((item, index) => {
    const lf = item.body.replace(/\r\n?/g, "\n");
    const body = lf === "" || lf.endsWith("\n") ? lf : `${lf}\n`;
    const attributes: Record<string, unknown> = { type: item.type, title: item.title, ...item.frontmatter };
    if (KNOWLEDGE_TYPES.has(item.type)) attributes.lifecycle = options.lifecycle ?? "draft";
    if (item.type === "source") {
      const hash = `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
      const sourceKey = attributes.source_key;
      const duplicateByKey =
        typeof sourceKey === "string" && (sourceKey.startsWith("file:") || attributes.kind === "capture");
      const duplicate = workspace.notes.find((note) =>
        note.type === "source" && (note.attributes.content_hash === hash || (duplicateByKey && note.attributes.source_key === sourceKey)),
      );
      if (duplicate !== undefined) {
        result.skipped.push({ input_index: index, reason: "DUPLICATE_SOURCE", existing: duplicate.id });
        return;
      }
      attributes.content_hash = hash;
      attributes.captured ??= formatTimestamp(options.now);
      // The kind sets whether the Inbox row shows the text (0043): full for email and chat.
      if (attributes.notion_text === undefined && attributes.attached_to === undefined) {
        if (attributes.kind === "email" || attributes.kind === "chat") attributes.notion_text = "full";
        else if (attributes.kind === "document" || attributes.kind === "note") attributes.notion_text = "digest";
      }
    }
    const id = item.id ?? generateId(TYPE_PREFIX[item.type]!, taken);
    taken.add(id);
    attributes.id = id;
    attributes.created = today;
    attributes.updated = today;

    const ownDate = DATED_BY_FIELD.has(item.type) && isDate(item.frontmatter.date) ? (item.frontmatter.date as string) : undefined;
    const date = ownDate ?? item.file_date ?? today;
    const path = newNotePath(item.type, item.title, date, (candidate) => workspace.exists(candidate), attributes.source_key);
    workspace.write(path, serializeNewFile(attributes, body));
    result.created.push({ id, type: item.type, title: item.title, path });
    result.pointers.set(path, pointerOf(index));
  });
  return result;
}

/**
 * Throw INPUT_INVALID if the staged writes add lint errors anywhere in the brain (spec/cli.md
 * §3.6.1). Errors in a staged file point at its input item; others name the file and point at `root`.
 */
export function assertStagedValid(workspace: Workspace, pointers: ReadonlyMap<string, string>, root = ""): void {
  const problems = workspace.newErrors().map((issue) => {
    const pointer = pointers.get(issue.path);
    return pointer === undefined
      ? { pointer: root, message: `${issue.path}: ${issue.rule}: ${issue.message}` }
      : { pointer, message: `${issue.rule}: ${issue.message}` };
  });
  assertNoProblems(problems);
}
