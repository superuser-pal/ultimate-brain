import { createHash } from "node:crypto";

import { BrainError } from "./errors.ts";
import { serializeNewFile } from "./frontmatter.ts";
import { generateId, TYPE_PREFIX } from "./ids.ts";
import { assertNoProblems, escapePointer, isRecord, unknownKeys, type InputProblem } from "./input.ts";
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
  reason: "DUPLICATE_SOURCE" | "ALREADY_KEPT";
  existing: string;
}

export interface StagedNotes {
  created: CreatedNote[];
  skipped: SkippedNote[];
  /** Input pointer of each staged path, to report lint errors against the input. */
  pointers: Map<string, string>;
}

const ITEM_KEYS = ["type", "id", "title", "file_date", "frontmatter", "body"];
const KNOWLEDGE_TYPES = new Set(["area", "goal", "project", "person", "org", "meeting", "decision", "question", "concept", "reference", "memory"]);
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
      // Read on existing sources, never written again (spec/cli.md §5.5, 0049).
      if (value.frontmatter.keep !== undefined) at("frontmatter/keep", "is the name before 0.6.0: use only_keep");
      for (const key of ["notion_text", "notion_parts", "notion_text_requested"]) {
        if (value.frontmatter[key] !== undefined) at(`frontmatter/${key}`, "is retired in 0.6.0: Keep as document gives the whole text");
      }
    }
    if (value.type === "reference" && value.frontmatter.origin === undefined) at("frontmatter/origin", "is required on a new Document: whole, part or promoted");
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
  // replaces names a source, existing or earlier in the batch, that no other source replaces (spec/cli.md §5.5, 0045).
  const replaced = new Map<string, string>();
  for (const note of workspace.notes) if (note.type === "source" && typeof note.attributes.replaces === "string") replaced.set(note.attributes.replaces, note.id);
  items.forEach((item, index) => {
    const earlier = item.type === "source" ? item.frontmatter.replaces : undefined;
    if (earlier === undefined) return;
    const type = workspace.get(String(earlier))?.type ?? items.slice(0, index).find((candidate) => candidate.id === earlier)?.type;
    const problem = type === undefined ? `${String(earlier)} is not an existing source or one earlier in the batch`
      : type !== "source" ? `${String(earlier)} is a ${type}, not a source`
      : replaced.has(String(earlier)) ? `${String(earlier)} is already replaced by ${replaced.get(String(earlier))}`
      : undefined;
    if (problem !== undefined) parents.push({ pointer: `${pointerOf(index)}/frontmatter/replaces`, message: problem });
    replaced.set(String(earlier), item.id ?? `/notes/${index}`);
  });
  // A repo file names a linked repo of brain.json (0042).
  const repoNames = new Set(Array.isArray(workspace.config.repos) ? workspace.config.repos.filter(isRecord).map((repo) => repo.name) : []);
  items.forEach((item, index) => {
    const repo = item.type === "source" ? item.frontmatter.repo : undefined;
    if (repo !== undefined && !repoNames.has(repo)) parents.push({ pointer: `${pointerOf(index)}/frontmatter/repo`, message: `${String(repo)} is not a linked repo in brain.json repos` });
  });
  parents.push(...documentProblems(workspace, items, pointerOf));
  assertNoProblems(parents);
  assertPlacesExist(workspace, items, pointerOf);

  const today = formatDate(options.now);
  const taken = new Set([...existing, ...seen]);
  const result: StagedNotes = { created: [], skipped: [], pointers: new Map() };
  const wholeKept = new Map<string, string>();

  items.forEach((item, index) => {
    const lf = item.body.replace(/\r\n?/g, "\n");
    const body = lf === "" || lf.endsWith("\n") ? lf : `${lf}\n`;
    const attributes: Record<string, unknown> = { type: item.type, title: item.title, ...item.frontmatter };
    if (KNOWLEDGE_TYPES.has(item.type)) attributes.lifecycle = options.lifecycle ?? "draft";
    if (item.type === "reference" && attributes.origin === "whole") {
      // The source's own text needs no Review; one whole Document per source (spec/cli.md §5.5, 0049).
      const source = String((attributes.sources as unknown[])[0]);
      const kept = workspace.notes.find((note) => note.type === "reference" && note.attributes.origin === "whole" && Array.isArray(note.attributes.sources) && note.attributes.sources[0] === source)?.id
        ?? wholeKept.get(source);
      if (kept !== undefined) {
        result.skipped.push({ input_index: index, reason: "ALREADY_KEPT", existing: kept });
        return;
      }
      attributes.lifecycle = "reviewed";
    }
    if (item.type === "reference" && attributes.origin === "promoted") {
      // A promoted Document stands where its note stands (0049).
      attributes.lifecycle = workspace.get(String(attributes.promoted_from))?.attributes.lifecycle ?? attributes.lifecycle;
    }
    if (item.type === "source") {
      const hash = `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
      const sourceKey = attributes.source_key;
      // A new version (replaces) is compared by its text only, so a corrected input can be read again (0045).
      const duplicateByKey =
        attributes.replaces === undefined && typeof sourceKey === "string" && (sourceKey.startsWith("file:") || attributes.kind === "capture");
      const duplicate = workspace.notes.find((note) =>
        note.type === "source" && (note.attributes.content_hash === hash || (duplicateByKey && note.attributes.source_key === sourceKey)),
      );
      if (duplicate !== undefined) {
        result.skipped.push({ input_index: index, reason: "DUPLICATE_SOURCE", existing: duplicate.id });
        return;
      }
      attributes.content_hash = hash;
      attributes.captured ??= formatTimestamp(options.now);
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
    if (item.type === "reference" && attributes.origin === "whole") wholeKept.set(String((attributes.sources as unknown[])[0]), id);
    result.pointers.set(path, pointerOf(index));
  });
  return result;
}

/** Normalized body as `stageNotes` writes it: LF line endings and a trailing newline. */
function writtenBody(body: string): string {
  const lf = body.replace(/\r\n?/g, "\n");
  return lf === "" || lf.endsWith("\n") ? lf : `${lf}\n`;
}

function sha256(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

/** The Document rules of spec/cli.md §5.5 (0049) that the JSON Schema can't state. */
function documentProblems(workspace: Workspace, items: readonly NoteInput[], pointerOf: (index: number) => string): InputProblem[] {
  const problems: InputProblem[] = [];
  const promoted = new Map<string, string>();
  for (const note of workspace.notes) if (note.type === "reference" && note.attributes.origin === "promoted") promoted.set(String(note.attributes.promoted_from), note.id);
  items.forEach((item, index) => {
    if (item.type !== "reference") return;
    const at = (key: string, message: string) => problems.push({ pointer: `${pointerOf(index)}/${key}`, message });
    const { origin, sources, promoted_from: from } = item.frontmatter;
    if (origin === "whole") {
      if (!Array.isArray(sources) || sources.length !== 1 || typeof sources[0] !== "string" || !sources[0].startsWith("src-")) {
        return at("frontmatter/sources", "a whole Document names exactly one source (src-)");
      }
      const id = sources[0];
      const existing = workspace.get(id);
      const earlier = items.slice(0, index).find((candidate) => candidate.id === id && candidate.type === "source");
      const hash = existing?.type === "source" ? existing.attributes.content_hash : earlier !== undefined ? sha256(writtenBody(earlier.body)) : undefined;
      if (hash === undefined) return at("frontmatter/sources", `${id} is not an existing source or one earlier in the batch`);
      if (sha256(writtenBody(item.body)) !== hash) at("body", `a whole Document's body must be ${id}'s body byte for byte`);
    }
    if (origin === "promoted" && typeof from === "string") {
      const type = workspace.get(from)?.type;
      if (type !== "decision" && type !== "concept") return at("frontmatter/promoted_from", `${from} is not an existing decision or concept`);
      const other = promoted.get(from);
      if (other !== undefined) return at("frontmatter/promoted_from", `${from} is already promoted to ${other}`);
      promoted.set(from, item.id ?? `${pointerOf(index)}`);
    }
  });
  return problems;
}

/** A source's `area` and `projects` name existing notes of those types (spec/cli.md §5.5, 0050). */
function assertPlacesExist(workspace: Workspace, items: readonly NoteInput[], pointerOf: (index: number) => string): void {
  const problems: InputProblem[] = [];
  items.forEach((item, index) => {
    if (item.type !== "source") return;
    const { area, projects } = item.frontmatter;
    if (typeof area === "string" && workspace.get(area)?.type !== "area") problems.push({ pointer: `${pointerOf(index)}/frontmatter/area`, message: `${area} is not an existing area` });
    (Array.isArray(projects) ? projects : []).forEach((project, position) => {
      if (typeof project === "string" && workspace.get(project)?.type !== "project") problems.push({ pointer: `${pointerOf(index)}/frontmatter/projects/${position}`, message: `${project} is not an existing project` });
    });
  });
  if (problems.length > 0) throw new BrainError("UNKNOWN_ID", `${problems[0]!.pointer} ${problems[0]!.message}`, problems);
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
