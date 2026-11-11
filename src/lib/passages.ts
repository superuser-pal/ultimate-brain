// The passages a proposal names, and which of its items are withheld for want of eligible support (0077 §3, eligibility.md §9,
// schema §11.5, cli §5.7 "Excluded evidence"). One rule for `proposal new`, `apply`, the Review page, `sync render` and `proposal list`.

import type { Context } from "./eligibility.ts";
import { isRecord, type InputProblem } from "./input.ts";
import type { Note } from "./notes.ts";
import { PASSAGE_REF } from "./selection.ts";
import { PASSAGE, restrictionOf, withheldSupport } from "./suppressions.ts";
import type { Workspace } from "./workspace.ts";

const CLEANUP_KINDS = new Set(["remove", "restore", "independence"]);
const NOTE_ID = /^[a-z]{2,4}-[0-9a-hjkmnp-tv-z]{8}$/;
const NO_INPUT_KEY = /^(?:agent:[a-z0-9-]+\/\S+|notion-edit|user-correction:prp-[0-9a-hjkmnp-tv-z]{8})$/;
const SOURCE_KEY = /^(?:notion:[0-9a-f-]{32,36}|url:https:\/\/\S+|file:sha256:[0-9a-f]{64})$/;

/** The items of a proposal withheld now: `whole` for a proposal of any kind but `review_notes`; per item for a `review_notes`. */
export interface Withheld { whole: boolean; changes: Set<number>; notes: Set<string>; links: Set<number> }

/** The wording a proposal would put into the brain: an appendix, a new body, an answer or a new note's body. */
export function proposedText(p: Record<string, unknown>): string | null {
  for (const value of [p.content, p.answer, isRecord(p.note) ? p.note.body : undefined]) if (typeof value === "string") return value;
  return null;
}

/** The `passages` of a review_notes item, from its `items` entry; `undefined` when the item is legacy (no entry, or no `passages` on it). */
export function itemPassages(p: Record<string, unknown>, kind: "change" | "note" | "link", ref: unknown): unknown {
  const entry = (Array.isArray(p.items) ? p.items : []).filter(isRecord).find((item) => item.kind === kind && item.ref === ref);
  return entry?.passages;
}

/**
 * Which of a proposal's items are withheld with the suppression records of `context` (schema §11.5). A `notion_change` and a cleanup row are
 * never judged. A note of a `review_notes` is also withheld when its draft is restricted in any part (capture-and-review §5.1); a legacy note
 * is judged by its draft alone, and a legacy change or link by the legacy rule (schema §11.5).
 */
export function proposalWithheld(proposal: Note, workspace: Workspace, context: Context): Withheld {
  const a = proposal.attributes;
  const out: Withheld = { whole: false, changes: new Set(), notes: new Set(), links: new Set() };
  if (context.suppressions.length === 0 || a.kind === "notion_change" || isRecord(a.cleanup)) return out;
  if (a.kind !== "review_notes") {
    out.whole = withheldSupport({ source: a.source, passages: a.passages, text: proposedText(a) }, context);
    return out;
  }
  if ((Array.isArray(a.items) ? a.items : []).filter(isRecord).some((item) => CLEANUP_KINDS.has(String(item.kind)))) return out;
  (Array.isArray(a.changes) ? a.changes : []).filter(isRecord).forEach((change, index) => {
    const text = change.kind === "update_body" || change.kind === "add_to_note" ? String(change.content ?? "") : null;
    if (withheldSupport({ source: a.source, passages: itemPassages(a, "change", index), text }, context)) out.changes.add(index);
  });
  for (const id of (Array.isArray(a.notes) ? a.notes : []).map(String)) {
    const note = workspace.get(id);
    // Restricted in a claim: a body line, a timeline entry or a fact retrieval withholds, or uncited text that makes it restricted whole. The
    // summary, which retrieval drops for any note on a suppressed input, is not a claim of the draft.
    const restriction = note === undefined ? null : restrictionOf(note, context);
    const restricted = restriction !== null && (restriction.whole || restriction.lines.size > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0);
    // A legacy note is judged by its draft alone, by retrieval's rule (the user's choice of 2026-11-11, reading eligibility.md §9.3).
    const passages = itemPassages(a, "note", id);
    if (restricted || (passages !== undefined && withheldSupport({ source: a.source, passages, text: null }, context))) out.notes.add(id);
  }
  (Array.isArray(a.links) ? a.links : []).filter(isRecord).forEach((_link, index) => {
    if (withheldSupport({ source: a.source, passages: itemPassages(a, "link", index), text: null }, context)) out.links.add(index);
  });
  return out;
}

/** The passage references `^[src-…#¶n:hash]` in a text, without their `^[` `]`. */
export function citedPassages(text: string): string[] {
  return [...text.matchAll(PASSAGE_REF)].map((match) => `${match[1]}#¶${match[2]}:${match[3]}`);
}

/**
 * The problems of a `passages` input (cli §5.6): a non-empty list of unique entries, each a passage reference whose source exists and holds
 * that paragraph, an existing source or meeting, a source key, or an entry that names no input (an existing note id, an `agent:…` key).
 * `text` is the item's wording: every passage reference in it must be among the passages. `UNKNOWN_ID` problems come back apart.
 */
export function passageProblems(workspace: Workspace, value: unknown, pointer: string, text: string | null): { problems: InputProblem[]; unknown: string[] } {
  const problems: InputProblem[] = [];
  const unknown: string[] = [];
  if (!Array.isArray(value) || value.length === 0) return { problems: [{ pointer, message: "is required: the passages the change rests on, at least one (eligibility.md §9.1)" }], unknown };
  value.forEach((passage, index) => {
    const at = `${pointer}/${index}`;
    if (typeof passage !== "string") { problems.push({ pointer: at, message: "must be a string" }); return; }
    if (value.indexOf(passage) !== index) { problems.push({ pointer: at, message: `${passage} is listed twice` }); return; }
    const ref = PASSAGE.exec(passage);
    if (ref !== null) {
      const source = workspace.get(ref[1]!);
      if (source === undefined) { unknown.push(ref[1]!); return; }
      const held = Array.isArray(source.attributes.passages) ? (source.attributes.passages as Array<{ n?: unknown; hash?: unknown }>) : [];
      if (source.type !== "source" || !held.some((entry) => String(entry.n) === ref[2] && entry.hash === ref[3])) problems.push({ pointer: at, message: `${passage} names no paragraph of ${ref[1]}` });
      return;
    }
    if (NOTE_ID.test(passage)) { if (workspace.get(passage) === undefined) unknown.push(passage); return; }
    if (!SOURCE_KEY.test(passage) && !NO_INPUT_KEY.test(passage)) problems.push({ pointer: at, message: `${passage} is not a passage reference, a source, a source key or a note id` });
  });
  if (text !== null && problems.length === 0) {
    for (const cited of citedPassages(text)) if (!value.includes(cited)) problems.push({ pointer, message: `the text cites ${cited}, which is not among the passages` });
  }
  return { problems, unknown };
}
