import { createHash } from "node:crypto";

import { lineDiff } from "./diff.ts";
import { isRecord, unknownKeys, type InputProblem } from "./input.ts";
import type { Note } from "./notes.ts";
import { hasReportShape, reportLinks } from "./report-body.ts";
import { normalizeTimestamp } from "./time.ts";
import type { Workspace } from "./workspace.ts";

/** What the skill reads off a Document or report page (cli §5.14.7, 0054). */
export interface Wording {
  accepted: boolean;
  accepted_at: string | null;
  page_edited_at: string;
  body_markdown: string | null;
  unconvertible: boolean;
  pending_revision: boolean;
  pending_refresh: boolean;
}

export interface AcceptedWording {
  page_id: string; kind: "document" | "report"; note: string; accepted_at: string; page_edited_at: string;
  fingerprint: string; markdown: string; base: string; unattended_ok: boolean; diff: { added: number; removed: number };
  /** Written by the skill after it re-reads the page just before apply (cli §5.14.7, "Verify before apply"). */
  verified?: { fingerprint: string; page_edited_at: string };
}
export type HeldReason = "UNACCEPTED_DRAFT" | "UNCONVERTIBLE_BLOCK" | "NO_BASELINE";
export type WaitingReason = "REVISION_PENDING" | "REFRESH_PENDING" | "EDITED_AFTER_ACCEPTANCE" | "GIT_CHANGED" | "UNCONVERTIBLE_BLOCK" | "INVALID_REPORT_SHAPE" | "ACCEPTANCE_UNDATED" | "NO_BASELINE";

export interface WordingPlan {
  accepted_wording: AcceptedWording[];
  wording_waiting: Array<{ page_id: string; note: string; reason: WaitingReason }>;
  wording_held: Array<{ page_id: string; note: string; reason: HeldReason }>;
  /** `accepted_at` is the acceptance being consumed: the skill clears Accepted only if the page still shows it (cli §5.14.7). */
  clear_accepted: Array<{ page_id: string; note: string; accepted_at: string; page_edited_at: string }>;
  updates: Array<Record<string, unknown>>;
}

const UNATTENDED_AGE_MS = 2 * 60 * 1000;

export function textHash(text: string): string { return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`; }

/** The Git body as the wording rules see it: without the one newline the file format puts before it (content that starts with blank lines keeps them). */
export function gitBodyOf(note: Note): string { return note.body.startsWith("\n") ? note.body.slice(1) : note.body; }

export function parseWording(value: unknown, pointer: string, problems: InputProblem[]): Wording | undefined {
  if (!isRecord(value)) { problems.push({ pointer, message: "must be an object" }); return undefined; }
  problems.push(...unknownKeys(value, ["accepted", "accepted_at", "page_edited_at", "body_markdown", "unconvertible", "pending_revision", "pending_refresh"], pointer));
  for (const key of ["accepted", "unconvertible", "pending_revision", "pending_refresh"]) if (typeof value[key] !== "boolean") problems.push({ pointer: `${pointer}/${key}`, message: "must be true or false" });
  const acceptedAt = value.accepted_at === null ? null : normalizeTimestamp(value.accepted_at);
  if (acceptedAt === undefined) problems.push({ pointer: `${pointer}/accepted_at`, message: "must be an ISO 8601 UTC timestamp or null" });
  const editedAt = normalizeTimestamp(value.page_edited_at);
  if (editedAt === undefined) problems.push({ pointer: `${pointer}/page_edited_at`, message: "must be an ISO 8601 UTC timestamp" });
  if (value.body_markdown !== null && typeof value.body_markdown !== "string") problems.push({ pointer: `${pointer}/body_markdown`, message: "must be a string or null" });
  if (problems.some((problem) => problem.pointer.startsWith(pointer))) return undefined;
  return { accepted: value.accepted as boolean, accepted_at: acceptedAt as string | null, page_edited_at: editedAt!, body_markdown: value.body_markdown as string | null, unconvertible: value.unconvertible as boolean, pending_revision: value.pending_revision as boolean, pending_refresh: value.pending_refresh as boolean };
}

const minute = (timestamp: string): string => timestamp.slice(0, 16);

/** One row of cli §5.14.7's outcome table; the first matching row wins. */
export function planWording(workspace: Workspace, asOf: string, pageId: string, note: Note, w: Wording, out: WordingPlan): void {
  const kind = note.type === "view" ? "report" : "document";
  const ref = { page_id: pageId, note: note.id };
  const waiting = (reason: WaitingReason) => out.wording_waiting.push({ ...ref, reason });
  const pending = w.pending_revision ? "REVISION_PENDING" as const : w.pending_refresh ? "REFRESH_PENDING" as const : undefined;
  // 2: the body cannot be converted, so N is unknown: fail closed.
  if (w.unconvertible || w.body_markdown === null) { if (w.accepted) waiting("UNCONVERTIBLE_BLOCK"); else out.wording_held.push({ ...ref, reason: "UNCONVERTIBLE_BLOCK" }); return; }
  // 3: an acceptance with no time has no order against the edits.
  if (w.accepted && w.accepted_at === null) { waiting("ACCEPTANCE_UNDATED"); return; }
  // 4, 5: a pending proposal; an unresolved one blocks acceptance.
  if (pending !== undefined) { waiting(pending); return; }
  // 6, 7: every validation of an acceptance comes before any shortcut that consumes it.
  if (w.accepted && minute(w.page_edited_at) > minute(w.accepted_at!)) { waiting("EDITED_AFTER_ACCEPTANCE"); return; }
  if (w.accepted && kind === "report") {
    const links = reportLinks(workspace, w.body_markdown);
    if (!hasReportShape(w.body_markdown) || links.broken.length > 0) { waiting("INVALID_REPORT_SHAPE"); return; }
  }
  const markdown = w.body_markdown;
  const n = textHash(markdown); const git = gitBodyOf(note); const g = textHash(git);
  const published = isRecord(note.attributes.notion_published) ? note.attributes.notion_published : {};
  const sn = typeof published["@notion_body"] === "string" ? published["@notion_body"] : undefined;
  const sg = typeof published["@git_body"] === "string" ? published["@git_body"] : undefined;
  // 8: Notion equals Git: already in step.
  if (n === g) {
    if (sn !== n || sg !== g) out.updates.push({ id: note.id, published: { "@notion_body": n, "@git_body": g } });
    if (w.accepted) out.clear_accepted.push({ ...ref, accepted_at: w.accepted_at!, page_edited_at: w.page_edited_at });
    return;
  }
  // 9: no common baseline: no comparison is made.
  if (sn === undefined || sg === undefined) { if (w.accepted) waiting("NO_BASELINE"); else out.wording_held.push({ ...ref, reason: "NO_BASELINE" }); return; }
  if (!w.accepted) { if (n !== sn) out.wording_held.push({ ...ref, reason: "UNACCEPTED_DRAFT" }); return; } // 10, 11
  if (n === sn) { out.clear_accepted.push({ ...ref, accepted_at: w.accepted_at!, page_edited_at: w.page_edited_at }); return; } // 12: nothing to import
  if (g !== sg) { waiting("GIT_CHANGED"); return; } // 14
  const added = lineDiff(git, markdown);
  out.accepted_wording.push({ ...ref, kind, accepted_at: w.accepted_at!, page_edited_at: w.page_edited_at, fingerprint: n, markdown, base: sg, unattended_ok: Date.parse(asOf) - Date.parse(w.accepted_at!) >= UNATTENDED_AGE_MS, diff: { added: added.filter((line) => line.startsWith("+ ")).length, removed: added.filter((line) => line.startsWith("- ")).length } });
}
