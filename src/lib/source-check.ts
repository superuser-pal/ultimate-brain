/**
 * `brain source check` (spec/cli.md §5.35; decision 0098 §4; capture-and-review §12.3, §12.4): the Notion page of a checked row, the changed
 * text of a document written to the Inbox for the user to check before it goes in. It writes nothing: the skill creates the page.
 */
import { BrainError } from "./errors.ts";
import { assertNoProblems, isRecord, unknownKeys, type InputProblem } from "./input.ts";
import { modulesOf } from "./modules.ts";
import { CHANGE_LINE, CHECKABLE_KINDS } from "./note-new.ts";
import type { Workspace } from "./workspace.ts";

export interface CheckedRow {
  database: "inbox";
  action: "create";
  properties: Record<string, unknown>;
  body: string;
}

const NOTION_KEY = /^notion:(.+)$/;

/** The Notion pages of these notes, those without a page left out. */
function publishedPages(ids: readonly unknown[], workspace: Workspace): string[] {
  return ids.map((id) => workspace.get(String(id))?.attributes.notion).filter((page): page is string => typeof page === "string");
}

/** Render a checked row's page from its input (cli §5.35); every refusal is INPUT_INVALID with its pointer, but for the codes the contract names. */
export function renderCheckedRow(workspace: Workspace, input: unknown): CheckedRow {
  if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object" }]);
  const value = input as Record<string, unknown>;
  const problems: InputProblem[] = unknownKeys(value, ["original", "file", "title", "text", "changes", "document_asked"], "");
  const at = (key: string, message: string) => problems.push({ pointer: `/${key}`, message });
  if (typeof value.title !== "string" || value.title.trim() === "" || value.title.length > 120) at("title", "must be a non-empty string of at most 120 characters");
  if (typeof value.text !== "string" || value.text.trim() === "") at("text", "must be the changed text, non-empty Markdown");
  else if (value.text.includes("\r")) at("text", "must use LF line endings");
  if (!Array.isArray(value.changes) || value.changes.length === 0) at("changes", "must list what the change dropped or altered, one line each");
  else value.changes.forEach((line, index) => { if (typeof line !== "string" || !CHANGE_LINE.test(line)) at(`changes/${index}`, "must be one line starting Dropped: or Altered:, with text after it"); });
  if (typeof value.document_asked !== "boolean") at("document_asked", "must be true or false");
  if (value.file !== undefined && value.file !== null && (typeof value.file !== "string" || value.file === "")) at("file", "must be null or the attached file's name");
  if (typeof value.original !== "string") at("original", "must be the original's source id");
  assertNoProblems(problems);

  const original = workspace.get(String(value.original));
  if (original === undefined) throw new BrainError("UNKNOWN_ID", `/original: no note with id ${String(value.original)}`, [{ pointer: "/original", message: "does not exist" }]);
  const invalid = (key: string, message: string): never => { throw new BrainError("INPUT_INVALID", `/${key} ${message}`, [{ pointer: `/${key}`, message }]); };
  const kind = original.attributes.kind;
  if (original.type !== "source") invalid("original", `${original.id} is a ${original.type}, not a source`);
  if (typeof kind !== "string" || !CHECKABLE_KINDS.has(kind)) invalid("original", `${original.id} is a ${String(kind ?? "minutes")} source: only a document, email, chat or note is checked as a row (capture-and-review §12.1, §12.9)`);
  if (value.document_asked === true && !modulesOf(workspace.config).documents) throw new BrainError("MODULE_OFF", "The Documents module is off, so the changed text can't be kept as a Document: brain modules on documents", [{ pointer: "/document_asked", message: "Documents is off" }]);

  // The row links the original's Inbox row: for an attached file, its capture's row; otherwise the original's own page.
  const file = typeof value.file === "string" ? value.file : null;
  let page: string | undefined;
  const parentId = original.attributes.attached_to;
  if (typeof parentId === "string") {
    const parent = workspace.get(parentId);
    page = NOTION_KEY.exec(String(parent?.attributes.source_key ?? ""))?.[1];
    if (page === undefined) invalid("original", `${original.id} is attached to ${parentId}, which has no Inbox row`);
  } else {
    if (typeof original.attributes.notion !== "string") throw new BrainError("INPUT_INVALID", `/original ORIGINAL_NOT_PUBLISHED: ${original.id} has no Inbox row yet: publish it first (sync render --ids, then sync record)`, [{ pointer: "/original", message: `ORIGINAL_NOT_PUBLISHED: ${original.id} has no Inbox row yet` }]);
    page = original.attributes.notion;
  }
  if (file !== null && original.attributes.file_name !== file) invalid("file", `must be ${String(original.attributes.file_name ?? "absent")}, the original's file name`);

  const area = typeof original.attributes.area === "string" ? [original.attributes.area] : [];
  const projects = Array.isArray(original.attributes.projects) ? original.attributes.projects : [];
  const changes = value.changes as string[];
  return {
    database: "inbox",
    action: "create",
    properties: {
      Name: value.title,
      Kind: "Changed",
      "Changed from": [page!],
      "What changed": [...(file === null ? [] : [`File: ${file}`]), ...changes].join("\n"),
      "Brain Status": "New",
      "Document asked": value.document_asked,
      Project: publishedPages(projects, workspace),
      Area: publishedPages(area, workspace),
    },
    body: String(value.text),
  };
}
