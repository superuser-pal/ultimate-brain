import { createHash } from "node:crypto";

import { lineDiff } from "./diff.ts";
import type { Note } from "./notes.ts";
import { bodyHash } from "./proposals.ts";
import { contextFor, eligibleNote, requireSuppressions } from "./suppressions.ts";
import type { Workspace } from "./workspace.ts";

// The Review page of a review_notes proposal with item ids (capture-and-review §7.2, §7.5): pure, no Notion calls.

export interface ReviewItem {
  item_id: string; letter: string; kind: "creates" | "changes"; heading: string;
  current: string | null; proposed: string; editable: boolean; why: string; effect: string;
  /** The item rests on text a suppression restricts: only a stub is shown and it cannot be accepted (capture-and-review §5.1). */
  held: boolean;
  /** `proposed_hash` is over the canonical proposed text (what a parser reads back after `unescapeSection`); `base_hash` over what it was proposed against. */
  proposed_hash: string; base_hash: string;
  target: Note | undefined; section: string; rendered_hash: string;
}

export interface ReviewRender { items: ReviewItem[]; body: string; summary: string; summary_hash: string }

const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const label = (field: string): string => `${field[0]?.toUpperCase() ?? ""}${field.slice(1).replaceAll("_", " ")}`;
const titleOf = (value: unknown, workspace: Workspace): string => (typeof value === "string" ? String(workspace.get(value)?.attributes.title ?? value) : String(value ?? ""));

/** Canonical text: LF endings, NFC, no trailing blanks on a line, no blank edges. Notion strips what this strips, so a hash over it is stable across a round trip. */
export function canon(text: string): string {
  return text.replace(/\r\n?/g, "\n").normalize("NFC").split("\n").map((line) => line.replace(/[ \t]+$/g, "")).join("\n").replace(/^\n+|\n+$/g, "");
}

// A line of proposed text must never be mistaken for the page's own structure: a section heading, a toggle tag, a Decision or Revision line.
const STRUCTURAL = /^\\*(?:## \[|<\/?details|<summary|Decision:|Revision request:)/i;

/** Escape the lines of free text that imitate the page structure by a leading backslash (reversible with `unescapeSection`). */
export function escapeSection(text: string): string {
  return text.split("\n").map((line) => (STRUCTURAL.test(line) ? `\\${line}` : line)).join("\n");
}

/** The inverse of `escapeSection`: what a parser applies to the children of the Proposed toggle before it hashes or applies them. */
export function unescapeSection(text: string): string {
  return text.split("\n").map((line) => (STRUCTURAL.test(line) && line.startsWith("\\") ? line.slice(1) : line)).join("\n");
}

/** a, b, … z, then aa, ab, … (display only: the `it-` id is the key). */
export function itemLetter(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : `${itemLetter(Math.floor(index / 26) - 1)}${itemLetter(index % 26)}`;
}

function url(page: unknown): string | null {
  return typeof page === "string" ? `https://www.notion.so/${page.replaceAll("-", "")}` : null;
}

function quote(text: string): string {
  return canon(text).split("\n").map((line) => `> ${line}`).join("\n");
}

/** What Accept does, by kind (capture-and-review §7.5). */
const EFFECT: Record<string, string> = {
  creates: "Accept makes this draft Reviewed. Reject archives it.",
  update_fact: "Accept replaces the value in the note. The source's value stays in its history.",
  update_body: "Accept replaces the text in the note.",
  add_to_note: "Accept appends the text to the note, with its source.",
  add_link: "Accept adds the link to the note.",
  held: "This item rests on text you excluded from the brain, so it is not shown and cannot be accepted. Reject or Defer it.",
};

/** The base an item was proposed against, with its own marker for "the target is missing" (a missing target is `base_changed`, §7.5). */
const base = (exists: boolean, value: unknown): string => JSON.stringify(exists ? { v: value ?? null } : { missing: true });

export function reviewItems(proposal: Note, workspace: Workspace): ReviewItem[] {
  const a = proposal.attributes;
  const links = (Array.isArray(a.links) ? a.links : []).filter(record);
  const changes = (Array.isArray(a.changes) ? a.changes : []).filter(record);
  // Restricted text never reaches a Review page: every note is read in its eligible form (capture-and-review §5.1).
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const seen = (note: Note | undefined): { note: Note | undefined; held: boolean; body: string } => {
    if (note === undefined) return { note: undefined, held: false, body: "" };
    const visible = eligibleNote(note, context);
    return { note: visible ?? note, held: visible === null || visible.body !== note.body, body: visible === null ? "" : visible.body };
  };
  const source = typeof a.source === "string" ? workspace.get(a.source) : undefined;
  const sourceUrl = url(source?.attributes.notion);
  const result: ReviewItem[] = [];
  const stored = (Array.isArray(a.items) ? a.items : []).filter(record);
  stored.forEach((entry, index) => {
    const itemId = String(entry.item_id);
    let item: Pick<ReviewItem, "kind" | "heading" | "current" | "proposed" | "editable" | "why" | "effect" | "target" | "held"> & { base: string };
    if (entry.kind === "note") {
      const view = seen(workspace.get(String(entry.ref)));
      item = { kind: "creates", heading: `Creates: ${titleOf(entry.ref, workspace)}`, current: null, proposed: canon(view.body), editable: true, why: String(a.why ?? ""), effect: EFFECT.creates!, target: view.note, held: view.held, base: base(view.note !== undefined, bodyHash(workspace.get(String(entry.ref))?.body ?? "")) };
    } else if (entry.kind === "link") {
      const link = links[Number(entry.ref)] ?? {};
      const view = seen(typeof link.target === "string" ? workspace.get(link.target) : undefined);
      const field = String(link.field);
      const values = view.note !== undefined && Array.isArray(view.note.attributes[field]) ? (view.note.attributes[field] as unknown[]) : [];
      const current = values.map((value) => titleOf(value, workspace)).join(", ");
      item = { kind: "changes", heading: `Changes: ${titleOf(link.target, workspace)}`, current: `${label(field)}: ${current || "(none)"}`, proposed: canon(titleOf(link.value, workspace)), editable: true, why: String(a.why ?? ""), effect: EFFECT.add_link!, target: view.note, held: view.held, base: base(view.note !== undefined, [...values.map(String)].sort()) };
    } else {
      const change = changes[Number(entry.ref)] ?? {};
      const view = seen(typeof change.target === "string" ? workspace.get(change.target) : undefined);
      const targetTitle = titleOf(change.target, workspace);
      const why = String(change.why ?? a.why ?? "");
      if (change.kind === "update_fact") {
        item = { kind: "changes", heading: `Changes: ${label(String(change.field))} on ${targetTitle}`, current: change.before === undefined ? "(new)" : String(change.before), proposed: canon(String(change.after ?? "")), editable: true, why, effect: EFFECT.update_fact!, target: view.note, held: view.held, base: base(view.note !== undefined, change.before === undefined ? null : String(change.before)) };
      } else if (change.kind === "update_body") {
        const existing = canon(view.body);
        const lines = view.note === undefined ? 0 : lineDiff(view.note.body, String(change.content ?? "")).length;
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: `${lines} line${lines === 1 ? "" : "s"} change. The text now in the note:\n${existing === "" ? "(empty)" : existing}`, proposed: canon(String(change.content ?? "")), editable: true, why, effect: EFFECT.update_body!, target: view.note, held: view.held, base: base(view.note !== undefined, String(change.before_hash ?? "")) };
      } else {
        const tail = canon(view.body).split("\n").filter((line) => line !== "").slice(-5).join("\n");
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: `The end of the note now (the text is appended after it):\n${tail === "" ? "(empty)" : tail}`, proposed: canon(String(change.content ?? "")), editable: true, why, effect: EFFECT.add_to_note!, target: view.note, held: view.held, base: base(view.note !== undefined, bodyHash(workspace.get(String(change.target))?.body ?? "")) };
      }
    }
    const letter = itemLetter(index);
    const targetUrl = url(item.target?.attributes.notion);
    const links2 = [targetUrl === null ? null : `[${canon(String(item.target?.attributes.title ?? "target")).replace(/[[\]]/g, "")}](${targetUrl})`, sourceUrl === null ? null : `[source](${sourceUrl})`].filter(Boolean).join(" · ");
    const heading = `## [${letter} · ${itemId}] ${item.held ? `Held: ${item.heading.replace(/^[^:]+: /, "")}` : item.heading}`.replace(/\n/g, " ");
    // The why is one line; every free text is escaped so it cannot imitate a heading, a toggle tag or a Decision line.
    const whyLine = canon(item.why).replace(/\s*\n\s*/g, " ");
    const section = (item.held
      ? [heading, ...(links2 === "" ? [] : [links2]), `**What Accept does:** ${EFFECT.held}`, "Decision: Pending"]
      : [
        heading,
        ...(links2 === "" ? [] : [links2]),
        ...(item.current === null ? [] : ["**Current**", escapeSection(quote(item.current))]),
        "<details>", "<summary>Proposed final wording</summary>", "", escapeSection(item.proposed), "", "</details>",
        ...(whyLine === "" ? [] : [escapeSection(`**Why it matters:** ${whyLine}`)]),
        `**What Accept does:** ${item.effect}`,
        "Decision: Pending",
      ]).join("\n");
    result.push({ item_id: itemId, letter, kind: item.kind, heading: item.heading, current: item.held ? null : item.current, proposed: item.held ? "" : item.proposed, editable: !item.held && item.editable, why: whyLine, effect: item.held ? EFFECT.held! : item.effect, held: item.held, target: item.target, proposed_hash: sha(item.held ? "" : item.proposed), base_hash: sha(item.base), section, rendered_hash: sha(section) });
  });
  return result;
}

/** The brain-owned summary at the top of the page, rebuilt entirely from the proposal file (§7.4): applied and closed never go into an item section. */
export function reviewSummary(proposal: Note): string {
  const a = proposal.attributes;
  const total = (Array.isArray(a.items) ? a.items : []).length;
  const decisions = (Array.isArray(a.item_decisions) ? a.item_decisions : []).filter(record);
  const count = (state: string) => decisions.filter((entry) => entry.state === state).length;
  let applied = count("applied"), closed = count("closed");
  const deferred = count("deferred");
  // A proposal decided as a whole before items were tracked (a 0045 approve or reject) has no item decisions: its state is the row's.
  if (decisions.length === 0 && a.status === "applied") applied = total;
  if (decisions.length === 0 && a.status === "closed") closed = total;
  const waiting = total - applied - closed - deferred;
  return `**Review summary** (the brain keeps this up to date; do not edit): ${total - waiting} of ${total} decided: ${applied} applied, ${closed} closed${deferred > 0 ? `, ${deferred} deferred` : ""}, ${waiting} waiting for you.`;
}

const FIRST_USE = [
  "> **How this page works.** Each change below is a section. Edit the text inside \"Proposed final wording\" if you want it different, then type your choice on the line `Decision:` (Accept, Reject, Defer or Request revision).",
  "> Nothing is read until you click **Submit decisions** at the top of the row. **Submit and accept all** accepts every section still on Pending. You can decide some sections now and leave the rest.",
].join("\n");

export function renderReview(proposal: Note, workspace: Workspace): ReviewRender {
  const items = reviewItems(proposal, workspace);
  const summary = reviewSummary(proposal);
  // `## Review summary` is a heading the skill finds by name, like the "Brief" heading of a project page (cli §5.14.4).
  const body = [FIRST_USE, "", "## Review summary", summary, "", ...items.flatMap((item) => [item.section, ""])].join("\n").replace(/\n+$/, "\n");
  return { items, body, summary, summary_hash: `sha256:${sha(summary)}` };
}
