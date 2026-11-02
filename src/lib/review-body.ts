import { createHash } from "node:crypto";

import { lineDiff } from "./diff.ts";
import type { Note } from "./notes.ts";
import { bodyHash } from "./proposals.ts";
import type { Workspace } from "./workspace.ts";

// The Review page of a review_notes proposal with item ids (capture-and-review §7.2, §7.5): pure, no Notion calls.

export interface ReviewItem {
  item_id: string; letter: string; kind: "creates" | "changes"; heading: string;
  current: string | null; proposed: string; editable: boolean; why: string; effect: string;
  /** Hash of the proposed wording as rendered, and of what it was proposed against (§7.4 `proposed_hash`, `base_hash`). */
  proposed_hash: string; base_hash: string;
  target: Note | undefined; section: string; rendered_hash: string;
}

export interface ReviewRender { items: ReviewItem[]; body: string; summary: string; summary_hash: string }

const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const label = (field: string): string => `${field[0]?.toUpperCase() ?? ""}${field.slice(1).replaceAll("_", " ")}`;
const titleOf = (value: unknown, workspace: Workspace): string => (typeof value === "string" ? String(workspace.get(value)?.attributes.title ?? value) : String(value ?? ""));
const trim = (text: string): string => text.replace(/^\n+/, "").replace(/\s+$/, "");

/** a, b, … z, then aa, ab, … (display only: the `it-` id is the key). */
export function itemLetter(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : `${itemLetter(Math.floor(index / 26) - 1)}${itemLetter(index % 26)}`;
}

function url(page: unknown): string | null {
  return typeof page === "string" ? `https://www.notion.so/${page.replaceAll("-", "")}` : null;
}

function quote(text: string): string {
  return trim(text).split("\n").map((line) => `> ${line}`).join("\n");
}

/** What Accept does, by kind (capture-and-review §7.5). */
const EFFECT: Record<string, string> = {
  creates: "Accept makes this draft Reviewed. Reject archives it.",
  update_fact: "Accept replaces the value in the note. The source's value stays in its history.",
  update_body: "Accept replaces the text in the note.",
  add_to_note: "Accept appends the text to the note, with its source.",
  add_link: "Accept adds the link to the note.",
};

export function reviewItems(proposal: Note, workspace: Workspace): ReviewItem[] {
  const a = proposal.attributes;
  const links = (Array.isArray(a.links) ? a.links : []).filter(record);
  const changes = (Array.isArray(a.changes) ? a.changes : []).filter(record);
  const source = typeof a.source === "string" ? workspace.get(a.source) : undefined;
  const sourceUrl = url(source?.attributes.notion);
  const result: ReviewItem[] = [];
  const stored = (Array.isArray(a.items) ? a.items : []).filter(record);
  stored.forEach((entry, index) => {
    const itemId = String(entry.item_id);
    let item: Omit<ReviewItem, "item_id" | "letter" | "proposed_hash" | "base_hash" | "section" | "rendered_hash"> & { base: string };
    if (entry.kind === "note") {
      const note = workspace.get(String(entry.ref));
      const body = trim(note?.body ?? "");
      item = { kind: "creates", heading: `Creates: ${titleOf(entry.ref, workspace)}`, current: null, proposed: body, editable: true, why: String(a.why ?? ""), effect: EFFECT.creates!, target: note, base: bodyHash(note?.body ?? "") };
    } else if (entry.kind === "link") {
      const link = links[Number(entry.ref)] ?? {};
      const target = typeof link.target === "string" ? workspace.get(link.target) : undefined;
      const current = target !== undefined && Array.isArray(target.attributes[String(link.field)]) ? (target.attributes[String(link.field)] as unknown[]).map((value) => titleOf(value, workspace)).join(", ") : "";
      item = { kind: "changes", heading: `Changes: ${titleOf(link.target, workspace)}`, current: `${label(String(link.field))}: ${current || "(none)"}`, proposed: titleOf(link.value, workspace), editable: true, why: String(a.why ?? ""), effect: EFFECT.add_link!, target, base: JSON.stringify(target?.attributes[String(link.field)] ?? null) };
    } else {
      const change = changes[Number(entry.ref)] ?? {};
      const target = typeof change.target === "string" ? workspace.get(change.target) : undefined;
      const targetTitle = titleOf(change.target, workspace);
      const why = String(change.why ?? a.why ?? "");
      if (change.kind === "update_fact") {
        item = { kind: "changes", heading: `Changes: ${label(String(change.field))} on ${targetTitle}`, current: change.before === undefined ? "(new)" : String(change.before), proposed: String(change.after ?? ""), editable: true, why, effect: EFFECT.update_fact!, target, base: String(change.before ?? "") };
      } else if (change.kind === "update_body") {
        const lines = target === undefined ? 0 : lineDiff(target.body, String(change.content ?? "")).length;
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: `${lines} line${lines === 1 ? "" : "s"} change; the text now in the note follows`, proposed: trim(String(change.content ?? "")), editable: true, why, effect: EFFECT.update_body!, target, base: String(change.before_hash ?? "") };
      } else {
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: null, proposed: trim(String(change.content ?? "")), editable: true, why, effect: EFFECT.add_to_note!, target, base: bodyHash(target?.body ?? "") };
      }
    }
    const letter = itemLetter(index);
    const targetUrl = url(item.target?.attributes.notion);
    const links2 = [targetUrl === null ? null : `[${item.target?.attributes.title ?? "target"}](${targetUrl})`, sourceUrl === null ? null : `[source](${sourceUrl})`].filter(Boolean).join(" · ");
    const section = [
      `## [${letter} · ${itemId}] ${item.heading}`,
      ...(links2 === "" ? [] : [links2]),
      ...(item.current === null ? [] : ["**Current**", quote(item.current)]),
      "<details>", "<summary>Proposed final wording</summary>", "", item.proposed, "", "</details>",
      ...(item.why === "" ? [] : [`**Why it matters:** ${item.why}`]),
      `**What Accept does:** ${item.effect}`,
      "Decision: Pending",
    ].join("\n");
    result.push({ item_id: itemId, letter, kind: item.kind, heading: item.heading, current: item.current, proposed: item.proposed, editable: item.editable, why: item.why, effect: item.effect, target: item.target, proposed_hash: sha(item.proposed), base_hash: sha(item.base), section, rendered_hash: sha(section) });
  });
  return result;
}

/** The brain-owned summary at the top of the page, rebuilt entirely from the proposal file (§7.4): applied and closed never go into an item section. */
export function reviewSummary(proposal: Note): string {
  const a = proposal.attributes;
  const total = (Array.isArray(a.items) ? a.items : []).length;
  const decisions = (Array.isArray(a.item_decisions) ? a.item_decisions : []).filter(record);
  const count = (state: string) => decisions.filter((entry) => entry.state === state).length;
  const applied = count("applied"), closed = count("closed"), deferred = count("deferred");
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
  const body = [FIRST_USE, "", summary, "", ...items.flatMap((item) => [item.section, ""])].join("\n").replace(/\n+$/, "\n");
  return { items, body, summary, summary_hash: `sha256:${sha(summary)}` };
}
