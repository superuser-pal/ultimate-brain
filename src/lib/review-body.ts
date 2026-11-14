import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { lineDiff } from "./diff.ts";
import type { Note } from "./notes.ts";
import { bodyHash, sourceTitle } from "./proposals.ts";
import { cleanupItemView, CLEANUP_KINDS } from "./cleanup-row.ts";
import { CONTEXT_HEADING, escape2, NOTE_TOGGLE, pageLabels, shorten, wordingSha, type Labels } from "./review-format2.ts";
import { extractPassages } from "./selection.ts";
import { PASSAGE } from "./suppressions.ts";
import { restrictedSources } from "./eligibility.ts";
import { linkRefs, proposalWithheld } from "./passages.ts";
import { citeLabel, contextFor, eligibleNote, publishableNote, requireSuppressions, titleWithheld, withoutWithheldLinks } from "./suppressions.ts";
import type { Workspace } from "./workspace.ts";

// The Review page of a review_notes proposal with item ids (capture-and-review §7.2, §7.5): pure, no Notion calls.

export interface ReviewItem {
  item_id: string; letter: string; kind: "creates" | "changes"; heading: string;
  current: string | null; proposed: string; editable: boolean; why: string; effect: string;
  /** The item rests on text a suppression restricts: only a stub is shown and it cannot be accepted (capture-and-review §5.1). */
  held: boolean;
  /** The section names a note in the awaiting-cleanup form, by `<type> <id>, title withheld: awaiting cleanup` (cli §5.14.4, "Restricted notes"). */
  title_withheld: boolean;
  /** The item rests on excluded evidence (eligibility.md §4.2): its source is an older version or full copy of a changed input, the draft it creates has a restricted line or is restricted whole,
   *  or its wording cites a passage that is not live, even beside a live one. Accepting it closes it stale (§5.1). An item held only for its target is not one. */
  source_excluded: boolean;
  /** `proposed_hash` is over the canonical proposed text (what a parser reads back after `unescapeSection`); `base_hash` over what it was proposed against. */
  proposed_hash: string; base_hash: string;
  /** What the target holds in Git now, hashed the same way: a plan compares it with the `base_hash` recorded at render (a difference is `base_changed`, §7.5). */
  current_base_hash: string;
  target: Note | undefined; section: string; rendered_hash: string;
  /** The page format the item was built for (capture-and-review §7.12.1). */
  format: 1 | 2;
  /** Format 2: its group, whether it is a ⚠ fact change, its flags, its repeat key, its passages, what Accept does (the brain-context line). */
  group: Group; warn: boolean; flags: string[]; repeat?: string; passages: string[]; what: string;
  /** A link item's values, each with its index into `links`, its title and the names it may be written as (lower case). */
  link_values?: LinkValue[];
  /** How the summary names the item. */
  summary_title: string;
  /** The page's passage labels (format 2). */
  labels: Labels;
}

export type Group = "summary" | "changes" | "notes" | "links";
export interface LinkValue { index: number; title: string; names: string[] }


const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const label = (field: string): string => `${field[0]?.toUpperCase() ?? ""}${field.slice(1).replaceAll("_", " ")}`;

/** Canonical text: LF endings, NFC, no trailing blanks on a line, no blank edges. Notion strips what this strips, so a hash over it is stable across a round trip. */
export function canon(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").normalize("NFC").split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  // Whitespace that every non-empty line shares is layout (Notion indents toggle children), not text.
  const filled = lines.filter((line) => line !== "");
  const shared = filled.length === 0 ? "" : filled.map((line) => /^[ \t]*/.exec(line)![0]).reduce((common, indent) => { let i = 0; while (i < common.length && i < indent.length && common[i] === indent[i]) i += 1; return common.slice(0, i); });
  return lines.map((line) => (line.startsWith(shared) ? line.slice(shared.length) : line)).join("\n").replace(/^\n+|\n+$/g, "");
}

// A line of proposed text must never be mistaken for the page's own structure: a section heading, a toggle tag, a Decision or Revision line.
const STRUCTURAL = /^[\s\\]*(?:## \[|<\/?details|<summary|Decision:|Revision request:)/i;

/** Escape the lines of free text that imitate the page structure by a leading backslash (reversible with `unescapeSection`). */
export function escapeSection(text: string): string {
  return text.split("\n").map((line) => (STRUCTURAL.test(line) ? `\\${line}` : line)).join("\n");
}

/** The inverse of `escapeSection`: what a parser applies to the children of the Proposed toggle before it hashes or applies them. */
export function unescapeSection(text: string): string {
  return text.split("\n").map((line) => (line.startsWith("\\") && STRUCTURAL.test(line.slice(1)) ? line.slice(1) : line)).join("\n");
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
  replace_line: "Accept replaces that one line of the note with the text.",
  add_link: "Accept adds the link to the note.",
  held: "This item rests on text you excluded from the brain, so it is not shown and cannot be accepted. Reject or Defer it.",
};

/** The base an item was proposed against, with its own marker for "the target is missing" (a missing target is `base_changed`, §7.5). */
const base = (exists: boolean, value: unknown): string => JSON.stringify(exists ? { v: value ?? null } : { missing: true });

/** The format a Review row's page has (capture-and-review §7.12.1): recorded in `@review.format`; a row not yet published gets format 2; an exclusion cleanup row stays format 1. */
export function reviewFormat(proposal: Note, config?: Record<string, unknown>): 1 | 2 {
  if (record(proposal.attributes.cleanup)) return 1;
  const published = proposal.attributes.notion_published;
  const review = record(published) && record(published["@review"]) ? published["@review"] : undefined;
  // A new page follows `notion.review_format` (schema §12): absent or 2 is format 2.
  if (review === undefined) return record(config?.notion) && config.notion.review_format === 1 ? 1 : 2;
  return review.format === 2 ? 2 : 1;
}

/** The plain name of a note type in a format-2 heading ("New person: …"). */
const TYPE_NAME: Record<string, string> = { reference: "Document", org: "organization" };

export function reviewItems(proposal: Note, workspace: Workspace, format: 1 | 2 = reviewFormat(proposal, workspace.config)): ReviewItem[] {
  const a = proposal.attributes;
  const links = (Array.isArray(a.links) ? a.links : []).filter(record);
  const changes = (Array.isArray(a.changes) ? a.changes : []).filter(record);
  // Restricted text never reaches a Review page: every note is read in its eligible form (capture-and-review §5.1).
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const seen = (note: Note | undefined): { note: Note | undefined; held: boolean; body: string } => {
    if (note === undefined) return { note: undefined, held: false, body: "" };
    const visible = eligibleNote(note, context);
    // A link to a note named by type and id keeps its text and loses its target in what the page shows (cli §5.14.4); it doesn't hold the item.
    const shown = visible === null ? "" : withoutWithheldLinks(visible, context).body;
    if (visible !== null && shown !== visible.body) namesWithheld = true;
    return { note: visible ?? note, held: visible === null || visible.body !== note.body, body: shown };
  };
  // A note is named by its published form: a note restricted whole, or with a restricted claim, by type and id (eligibility.md §6 rule 5).
  // `namesWithheld` collects whether the item being built named one.
  let namesWithheld = false;
  const titleOf = (value: unknown, _workspace?: Workspace): string => {
    if (typeof value !== "string") return String(value ?? "");
    const note = workspace.get(value);
    if (note === undefined) return value;
    const form = note.type === "source" || note.type === "proposal" ? note : publishableNote(note, context);
    if (titleWithheld(form)) { namesWithheld = true; return citeLabel(form); }
    return String(note.attributes.title ?? value);
  };
  const source = typeof a.source === "string" ? workspace.get(a.source) : undefined;
  const sourceRestricted = typeof a.source === "string" && restrictedSources(context).has(a.source);
  const sourceUrl = url(source?.attributes.notion);
  const stored = (Array.isArray(a.items) ? a.items : []).filter(record);
  // Each item is judged by its own passages, a legacy one by its input, a note by its draft too (schema §11.5, cli §5.7).
  const withheld = proposalWithheld(proposal, workspace, context);
  // Two fact changes on one target and field with different values: both are flagged by the CLI (capture-and-review §7.12.8).
  const factValues = new Map<string, Set<string>>();
  for (const change of changes) if (change.kind === "update_fact") { const key = `${String(change.target)}\u0000${String(change.field)}`; factValues.set(key, (factValues.get(key) ?? new Set()).add(String(change.after))); }
  type Draft = Pick<ReviewItem, "kind" | "heading" | "current" | "proposed" | "editable" | "why" | "effect" | "target" | "held"> & { base: string; now: string; v2: V2 };
  const drafts: Array<{ entry: Record<string, unknown>; item: Draft; namesWithheld: boolean; itemExcluded: boolean }> = [];
  stored.forEach((entry) => {
    namesWithheld = false;
    const refs = linkRefs(entry.ref);
    // The item has no eligible support (its passages, its legacy input, its wording, the draft it creates): withheld whole (eligibility.md §4.2, §9).
    const itemExcluded = entry.kind === "note" ? withheld.notes.has(String(entry.ref)) : entry.kind === "link" ? refs.some((ref) => withheld.links.has(ref)) : entry.kind === "change" ? withheld.changes.has(Number(entry.ref)) : false;
    let item: Draft;
    if (CLEANUP_KINDS.includes(entry.kind as never)) {
      const view = cleanupItemView(proposal, entry, workspace);
      item = { kind: "changes", heading: view.heading, current: view.current, proposed: canon(view.proposed), editable: view.editable, why: view.why, effect: view.effect, target: view.target, held: false, base: view.base, now: view.base, v2: { group: "changes", head: view.heading, now: null, wording: canon(view.proposed), why: "", warn: false, what: view.effect } };
    } else if (entry.kind === "note") {
      const note = workspace.get(String(entry.ref));
      const view = seen(note);
      const title = titleOf(entry.ref, workspace);
      const summary = note?.type === "meeting" && note.id === a.source;
      const typeName = TYPE_NAME[String(note?.type)] ?? String(note?.type ?? "note");
      item = { kind: "creates", heading: `Creates: ${title}`, current: null, proposed: canon(view.body), editable: true, why: String(a.why ?? ""), effect: EFFECT.creates!, target: view.note, held: view.held, base: base(view.note !== undefined, bodyHash(note?.body ?? "")), now: base(view.note !== undefined, bodyHash(note?.body ?? "")),
        v2: { group: summary ? "summary" : "notes", head: summary ? title : `New ${typeName}: ${title}`, now: null, wording: canon(view.body), why: "", warn: false, what: `a draft ${typeName}; Accept makes it Reviewed, Reject archives it.` } };
    } else if (entry.kind === "link") {
      const members = refs.map((ref) => links[ref] ?? {});
      const link = members[0] ?? {};
      const view = seen(typeof link.target === "string" ? workspace.get(link.target) : undefined);
      const field = String(link.field);
      const values = view.note !== undefined && Array.isArray(view.note.attributes[field]) ? (view.note.attributes[field] as unknown[]) : [];
      const current = values.map((value) => titleOf(value, workspace)).join(", ");
      const target = titleOf(link.target, workspace);
      const linkValues = refs.map((ref) => {
        const value = links[ref]?.value;
        const note = typeof value === "string" ? workspace.get(value) : undefined;
        const title = titleOf(value, workspace);
        const aliases = note === undefined || namesWithheld ? [] : (Array.isArray(note.attributes.aliases) ? note.attributes.aliases.map(String) : []);
        return { index: ref, title, names: [...new Set([title, String(value ?? ""), ...aliases].map((name) => name.toLowerCase()))] };
      });
      item = { kind: "changes", heading: `Changes: ${target}`, current: `${label(field)}: ${current || "(none)"}`, proposed: canon(members.map((member) => titleOf(member.value, workspace)).join("\n")), editable: true, why: String(a.why ?? ""), effect: EFFECT.add_link!, target: view.note, held: view.held, base: base(view.note !== undefined, [...values.map(String)].sort()), now: base(view.note !== undefined, [...values.map(String)].sort()),
        v2: { group: "links", head: field === "aliases" ? `New alias for ${target}` : `${label(field)} on ${target}`, now: null, wording: linkValues.map((value) => value.title).join("\n"), why: "", warn: false, what: `now ${current || "none"}; Accept adds each name still listed.`, link_values: linkValues } };
    } else {
      const change = changes[Number(entry.ref)] ?? {};
      const view = seen(typeof change.target === "string" ? workspace.get(change.target) : undefined);
      const targetTitle = titleOf(change.target, workspace);
      const why = String(change.why ?? a.why ?? "");
      const specific = typeof change.why === "string" && change.why !== a.why ? change.why : "";
      if (change.kind === "update_fact") {
        const facts = view.note?.attributes.facts;
        const live = facts !== null && typeof facts === "object" ? (facts as Record<string, unknown>)[String(change.field)] : undefined;
        const shown = live === undefined ? change.before : live;
        const current = shown === undefined ? "(new)" : String(shown);
        const value = String(change.after ?? "");
        const markers = (Array.isArray(entry.passages) ? entry.passages : []).map(String).filter((passage) => PASSAGE.test(passage)).map((passage) => ` ^[${passage}]`).join("");
        const field = label(String(change.field));
        item = { kind: "changes", heading: `Changes: ${field} on ${targetTitle}`, current, proposed: canon(value), editable: true, why, effect: EFFECT.update_fact!, target: view.note, held: view.held, base: base(view.note !== undefined, change.before === undefined ? null : String(change.before)), now: base(view.note !== undefined, live === undefined ? null : String(live)),
          v2: { group: "changes", head: change.before === undefined ? `${field} on ${targetTitle}: ${value} (new)` : `⚠ ${field} on ${targetTitle}: ${String(change.before)} → ${value}`, now: change.before === undefined && live === undefined ? null : `> Now: ${current}`, wording: canon(`${value}${markers}`), why: specific, warn: change.before !== undefined, what: `now ${current}; Accept sets it to the wording's value. The source's value stays in its history.`, fact_key: `${String(change.target)}\u0000${String(change.field)}`, fact_label: `${field} on ${targetTitle}` } };
      } else if (change.kind === "replace_line") {
        // A correction's one line (weekly-review.md §8.3): Now is the line it replaces, the wording the new line.
        const before = String(change.line_before ?? "");
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: `The line now in the note:\n${canon(before)}`, proposed: canon(String(change.line_after ?? "")), editable: true, why, effect: EFFECT.replace_line!, target: view.note, held: view.held, base: base(view.note !== undefined, String(change.before_hash ?? "")), now: base(view.note !== undefined, bodyHash(workspace.get(String(change.target))?.body ?? "")),
          v2: { group: "changes", head: `⚠ Line in ${targetTitle}`, now: `> Now: ${canon(before)}`, wording: canon(String(change.line_after ?? "")), why: specific, warn: true, what: `now "${oneLine(before)}"; Accept replaces that one line with the wording.` } };
      } else if (change.kind === "update_body") {
        const existing = canon(view.body);
        const lines = view.note === undefined ? 0 : lineDiff(view.note.body, String(change.content ?? "")).length;
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: `${lines} line${lines === 1 ? "" : "s"} change. The text now in the note:\n${existing === "" ? "(empty)" : existing}`, proposed: canon(String(change.content ?? "")), editable: true, why, effect: EFFECT.update_body!, target: view.note, held: view.held, base: base(view.note !== undefined, String(change.before_hash ?? "")), now: base(view.note !== undefined, bodyHash(workspace.get(String(change.target))?.body ?? "")),
          v2: { group: "changes", head: `New text for ${targetTitle}`, now: ["> Now:", ...canon(existing === "" ? "(empty)" : existing).split("\n").map((line) => `> ${line}`)].join("\n"), wording: canon(String(change.content ?? "")), why: specific, warn: false, what: "Accept replaces the note's text with the wording." } };
      } else {
        const tail = canon(view.body).split("\n").filter((line) => line !== "").slice(-5).join("\n");
        const last = tail.split("\n").at(-1) ?? "";
        item = { kind: "changes", heading: `Changes: ${targetTitle}`, current: `The end of the note now (the text is appended after it):\n${tail === "" ? "(empty)" : tail}`, proposed: canon(String(change.content ?? "")), editable: true, why, effect: EFFECT.add_to_note!, target: view.note, held: view.held, base: base(view.note !== undefined, bodyHash(workspace.get(String(change.target))?.body ?? "")), now: base(view.note !== undefined, bodyHash(workspace.get(String(change.target))?.body ?? "")),
          v2: { group: "changes", head: `Adds to ${targetTitle}`, now: null, wording: canon(String(change.content ?? "")), why: specific, warn: false, what: `${last === "" ? "the note is empty now" : `the note now ends with "${oneLine(last)}"`}; Accept appends the wording, with its source.` } };
      }
    }
    drafts.push({ entry, item, namesWithheld, itemExcluded });
  });
  // The page's passages: those of every item it shows, in order (capture-and-review §7.12.4); a held item's are never listed.
  const labels = pageLabels(drafts.filter(({ item, entry, itemExcluded }) => !item.held && !itemExcluded && !(sourceRestricted && CLEANUP_KINDS.includes(entry.kind as never))).flatMap(({ entry }) => (Array.isArray(entry.passages) ? entry.passages : []).map(String)));
  return drafts.map(({ entry, item, namesWithheld: named, itemExcluded }, index) => {
    const itemId = String(entry.item_id);
    // An item whose source is excluded shows no wording at all: the page is Notion's copy and the text would stay there (§5.1).
    // A cleanup item keeps the rule it had: held while the row's source is excluded. Every other item is held when it is withheld (§11.5).
    const cleanupHeld = sourceRestricted && CLEANUP_KINDS.includes(entry.kind as never);
    if (cleanupHeld || itemExcluded) item.held = true;
    const previous = (Array.isArray(a.revisions) ? a.revisions : []).filter(record).find((revision) => revision.item_id === itemId && revision.status === "drafted" && typeof revision.previous === "string")?.previous as string | undefined;
    const letter = itemLetter(index);
    const flags = [...(Array.isArray(entry.unsure) ? entry.unsure.map(String) : [])];
    if (item.v2.fact_key !== undefined && (factValues.get(item.v2.fact_key)?.size ?? 0) > 1) flags.push(`Two values for ${item.v2.fact_label}: ${[...factValues.get(item.v2.fact_key)!].join(" and ")}.`);
    const passages = (Array.isArray(entry.passages) ? entry.passages : []).map(String);
    const common = { item_id: itemId, letter, kind: item.kind, current: item.held ? null : item.current, editable: !item.held && item.editable, held: item.held, title_withheld: named, source_excluded: cleanupHeld || itemExcluded, target: item.target, base_hash: sha(item.base), current_base_hash: sha(item.now), format, group: item.v2.group, warn: item.v2.warn, flags, ...(typeof entry.repeat === "string" ? { repeat: entry.repeat } : {}), passages, what: item.v2.what, ...(item.v2.link_values === undefined ? {} : { link_values: item.v2.link_values }) };
    if (format === 2) {
      const title = item.held ? `Held: ${oneLine(item.v2.head.replace(/^⚠ /, "").replace(/:.*$/, ""))}` : item.v2.head;
      const heading = `${flags.length > 0 && !item.held ? "⚑ " : ""}${title}`.replace(/\n/g, " ");
      const proposed = item.held ? "" : item.v2.wording;
      const section = renderSection2({ heading, held: item.held, group: item.v2.group, now: item.v2.now, wording: proposed, why: item.v2.why, itemId, previous, labels, link: item.v2.link_values !== undefined });
      return { ...common, heading, summary_title: oneLine(heading.replace(/^⚑ /, "").replace(/^⚠ /, "")), proposed, why: item.v2.why, effect: item.held ? EFFECT.held! : item.effect, proposed_hash: wordingSha(proposed), section, rendered_hash: sha(section), labels };
    }
    const targetUrl = url(item.target?.attributes.notion);
    // An Exclusion cleanup item shows the user the excluded text to decide on (capture-and-review §5.2), so it keeps the title.
    const targetName = item.target === undefined ? "target" : CLEANUP_KINDS.includes(entry.kind as never) ? String(item.target.attributes.title ?? "target") : titleOf(item.target.id);
    const links2 = [targetUrl === null ? null : `[${canon(targetName).replace(/[[\]]/g, "")}](${targetUrl})`, sourceUrl === null ? null : `[source](${sourceUrl})`].filter(Boolean).join(" · ");
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
        // The wording the user had before asking for a revision: a toggle that is never read (§7.8).
        ...(previous === undefined ? [] : ["<details>", "<summary>Previous proposal</summary>", "", escapeSection(canon(previous)), "", "</details>"]),
        ...(whyLine === "" ? [] : [escapeSection(`**Why it matters:** ${whyLine}`)]),
        `**What Accept does:** ${item.effect}`,
        "Decision: Pending",
      ]).join("\n");
    return { ...common, heading: item.heading, summary_title: oneLine(item.heading.replace(/^[^:]+: /, "")), proposed: item.held ? "" : item.proposed, why: whyLine, effect: item.held ? EFFECT.held! : item.effect, proposed_hash: sha(item.held ? "" : item.proposed), section, rendered_hash: sha(section), labels };
  });
}

interface V2 {
  group: Group; head: string; now: string | null; wording: string; why: string; warn: boolean; what: string;
  link_values?: LinkValue[]; fact_key?: string; fact_label?: string;
}

/** One item section of a format-2 page (capture-and-review §7.12.3). */
function renderSection2(input: { heading: string; held: boolean; group: Group; now: string | null; wording: string; why: string; itemId: string; previous: string | undefined; labels: Labels; link: boolean }): string {
  const ref = `<span color="gray">ref ${input.itemId}</span>`;
  if (input.held) return [`### ${input.heading}`, ref, "Decision: Pending"].join("\n");
  const shown = shorten(input.wording, input.labels);
  const note = input.group === "summary" || input.group === "notes";
  const wording = note
    ? ["<details>", `<summary>${NOTE_TOGGLE}</summary>`, "", escape2(shown, true), "", "</details>"]
    : input.link ? shown.split("\n").map((name) => `\\+ ${escape2(name).replace(/^\\/, "")}`) : [escape2(shown)];
  return [
    `### ${input.heading}`,
    ...(input.now === null ? [] : [escape2Quote(input.now), ""]),
    ...wording,
    ...(input.why === "" ? [] : [`*Why: ${oneLine(input.why).replace(/\*/g, "\\*")}*`]),
    ref,
    "Decision: Pending",
    ...(input.previous === undefined ? [] : ["<details>", "<summary>Previous proposal</summary>", "", escape2(shorten(canon(input.previous), input.labels), true), "", "</details>"]),
  ].join("\n");
}

/** A Now quote is brain text: its lines are quoted as they are, the toggle tags in it escaped. */
const escape2Quote = (quoted: string): string => quoted.split("\n").map((line) => line.replace(/^(> ?)(\s*<\/?(?:details|summary))/i, "$1\\$2")).join("\n");

/** How the summary names another Review row: its Name as `sync render` sends it (cli §5.14.4). */
export type RowName = (proposal: Note) => string;

export type Counted = "applied" | "closed" | "deferred" | "waiting";
export interface ItemOutcome { item_id: string; letter: string; title: string; outcome: string; counted: Counted }

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();
const entries = (value: unknown): Array<Record<string, unknown>> => (Array.isArray(value) ? value.filter(record) : []);

/** The row a deferred item waits in now: the proposal deferred from this one that holds the item, followed through later deferrals (cli §5.14.4). */
function destination(workspace: Workspace, from: string, itemId: string): Note | undefined {
  let found: Note | undefined;
  for (let current = from, hops = 0; hops < 50; hops += 1) {
    const next = workspace.notes.find((note) => note.type === "proposal" && note.attributes.deferred_from === current && entries(note.attributes.items).some((item) => item.item_id === itemId));
    if (next === undefined) break;
    found = next;
    current = next.id;
  }
  return found;
}

function deferredTo(workspace: Workspace, from: string, itemId: string, rowName: RowName): string {
  const row = destination(workspace, from, itemId);
  if (row === undefined) return "Deferred.";
  const name = oneLine(rowName(row));
  const published = record(row.attributes.notion_published) ? row.attributes.notion_published : {};
  const page = url(row.attributes.notion);
  if (page === null) return `Deferred to "${name}", which awaits publication.`;
  if (published["@trashed"] !== undefined) return `Deferred to "${name}".`;
  return `Deferred to [${name.replace(/[[\]]/g, "")}](${page}).`;
}

/**
 * Each item's current outcome, read from the proposal file by its immutable id, never by its letter (capture-and-review §7.4 a, cli §5.14.4).
 * The title is the one the item's section heading shows now, so a restricted title stays withheld; no wording or value is shown.
 */
export function itemOutcomes(proposal: Note, workspace: Workspace, items: readonly ReviewItem[], rowName: RowName): ItemOutcome[] {
  const a = proposal.attributes;
  const stored = entries(a.items);
  const decisions = entries(a.item_decisions);
  const decision = record(a.decision) ? a.decision : {};
  const exclude = entries(decision.exclude);
  const links = entries(a.links);
  const revisions = entries(a.revisions);
  return items.map((item) => {
    const entry = stored.find((candidate) => String(candidate.item_id) === item.item_id) ?? {};
    const rejected = (): string => (entry.kind === "note" && workspace.get(String(entry.ref))?.attributes.lifecycle === "archived" ? "Rejected; the draft is archived." : "Rejected.");
    const result = (outcome: string, counted: Counted): ItemOutcome => ({ item_id: item.item_id, letter: item.letter, title: item.summary_title, outcome, counted });
    const decided = decisions.find((candidate) => candidate.item_id === item.item_id);
    if (decided !== undefined) {
      if (decided.state === "applied") return result(decided.edited === true ? "Applied, with your wording." : "Applied.", "applied");
      if (decided.state === "deferred") return result(deferredTo(workspace, proposal.id, item.item_id, rowName), "deferred");
      if (decided.state === "closed") return result(decided.reason === "source_excluded" ? "Closed without applying: it rests on text you excluded." : rejected(), "closed");
    }
    // A row decided as a whole (0045) records no item decisions: each item's outcome follows from the decision, its exclusions and what apply dropped.
    if (decided === undefined && a.status === "applied") {
      const excluded = exclude.some((excluded) => (entry.kind === "change" && excluded.change === entry.ref) || (entry.kind === "note" && excluded.note === entry.ref)
        || (entry.kind === "link" && ["target", "field", "value"].every((key) => isDeepStrictEqual(excluded[key], links[Number(entry.ref)]?.[key]))));
      if (excluded) return result(deferredTo(workspace, proposal.id, item.item_id, rowName), "deferred");
      if (entry.kind === "change" && entries(a.dropped).some((dropped) => dropped.change === entry.ref && dropped.reason === "stale")) return result("Closed without applying: the note changed first.", "closed");
      return result("Applied.", "applied");
    }
    if (decided === undefined && a.status === "closed") return result(a.closed_reason === "stale" ? "Closed without applying." : rejected(), "closed");
    if (item.held) return result("Held: it rests on text you excluded. Reject or Defer it.", "waiting");
    const revision = revisions.find((candidate) => candidate.item_id === item.item_id);
    if (revision?.status === "drafted") return result("Revised wording ready: waiting for your decision.", "waiting");
    if (revision?.status === "requested") return result("Revision requested: waiting for the new wording.", "waiting");
    return result("Waiting for your decision.", "waiting");
  });
}

/** The brain-owned summary at the top of the page, rebuilt entirely from the proposal file (§7.4): applied and closed never go into an item section. */
/** Held reasons a plan gave for pending items, shown on their summary line (cli §5.14.4, format 2). */
export type Holds = ReadonlyMap<string, string>;

/** The brain-owned summary at the top of the page, rebuilt entirely from the proposal file (§7.4): applied and closed never go into an item section. */
export function reviewSummary(proposal: Note, workspace: Workspace, items: readonly ReviewItem[], rowName: RowName, holds?: Holds): string {
  const outcomes = itemOutcomes(proposal, workspace, items, rowName);
  const count = (counted: Counted) => outcomes.filter((entry) => entry.counted === counted).length;
  const [applied, closed, deferred, waiting] = [count("applied"), count("closed"), count("deferred"), count("waiting")];
  const decided = `${outcomes.length - waiting} of ${outcomes.length} decided: ${applied} applied, ${closed} closed${deferred > 0 ? `, ${deferred} deferred` : ""}, ${waiting} waiting for you.`;
  if (items[0]?.format !== 2) {
    const head = `**Review summary** (the brain keeps this up to date; do not edit): ${decided}`;
    return outcomes.length === 0 ? head : [head, "", ...outcomes.map((entry) => `- ${entry.letter} · ${entry.title} — ${entry.outcome}`)].join("\n");
  }
  // Format 2 (capture-and-review §7.12.2): while nothing is decided and nothing held, the status counts what waits by group.
  const held = (id: string) => holds?.get(id);
  if (waiting === outcomes.length && !items.some((item) => held(item.item_id) !== undefined)) return `**Status:** waiting for you: ${groupCounts(items)}.`;
  return [`**Status:** ${decided}`, "", ...outcomes.map((entry) => `- ${entry.title} — ${entry.counted === "waiting" && held(entry.item_id) !== undefined ? `Held: ${held(entry.item_id)}` : entry.outcome}`)].join("\n");
}

/** "2 changes, 3 new notes and 3 links": the groups that have items, a link counting each value (cli §5.6's counts). */
function groupCounts(items: readonly ReviewItem[]): string {
  const changes = items.filter((item) => item.group === "changes").length;
  const notes = items.filter((item) => item.group === "notes" || item.group === "summary").length;
  const links = items.filter((item) => item.group === "links").reduce((sum, item) => sum + (item.link_values?.length ?? 1), 0);
  const parts = [[changes, "change", "changes"], [notes, "new note", "new notes"], [links, "link", "links"]] as const;
  const words = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  return words.length <= 1 ? (words[0] ?? "nothing") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

const FIRST_USE = [
  "> **How this page works.** Each change below is a section. Edit the text inside \"Proposed final wording\" if you want it different, then type your choice on the line `Decision:` (Accept, Reject, Defer or Request revision).",
  "> Nothing is read until you click **Submit decisions** at the top of the row. **Submit and accept all** accepts every section still on Pending. You can decide some sections now and leave the rest.",
].join("\n");

const GROUP_HEADINGS: Record<Group, string> = { summary: "What this meeting was about", changes: "Changes to what you know", notes: "New notes", links: "Links" };

export interface ReviewRender { items: ReviewItem[]; body: string; summary: string; summary_hash: string; context?: string }

export function renderReview(proposal: Note, workspace: Workspace, rowName: RowName, format: 1 | 2 = reviewFormat(proposal, workspace.config), holds?: Holds): ReviewRender {
  const items = reviewItems(proposal, workspace, format);
  const summary = reviewSummary(proposal, workspace, items, rowName, holds);
  if (format === 1) {
    // `## Review summary` is a heading the skill finds by name, like the "Brief" heading of a project page (cli §5.14.4).
    const body = [FIRST_USE, "", "## Review summary", summary, "", ...items.flatMap((item) => [item.section, ""])].join("\n").replace(/\n+$/, "\n");
    return { items, body, summary, summary_hash: `sha256:${sha(summary)}` };
  }
  const context = brainContext(proposal, workspace, items);
  const groups = (["summary", "changes", "notes", "links"] as const).filter((group) => items.some((item) => item.group === group));
  const body = [
    ...top(proposal, workspace, items), "",
    "## Review summary", summary, "",
    ...groups.flatMap((group) => [`## ${GROUP_HEADINGS[group]}`, ...items.filter((item) => item.group === group).flatMap((item) => [item.section, ""])]),
    ...needsClarification(proposal, workspace),
    `## ${CONTEXT_HEADING} {toggle="true"}`, ...context.split("\n").map((line) => (line === "" ? "" : `\t${line}`)),
  ].join("\n").replace(/\n+$/, "\n");
  return { items, body, summary, context, summary_hash: `sha256:${sha(`${summary}\n\n${context}`)}` };
}

/** The top of a format-2 page (capture-and-review §7.12.2): what the source brings, what the marks mean, what to do, the source. */
function top(proposal: Note, workspace: Workspace, items: readonly ReviewItem[]): string[] {
  const a = proposal.attributes;
  const source = typeof a.source === "string" ? workspace.get(a.source) : undefined;
  const title = typeof a.source === "string" ? sourceTitle(workspace, a.source) : "this source";
  const marks = [items.some((item) => item.warn && !item.held) ? "⚠ marks a change to something you already know" : null, items.some((item) => item.flags.length > 0 && !item.held) ? "⚑ something the brain is unsure about" : null].filter(Boolean);
  const marked = marks.length === 0 ? "" : ` ${marks.join(" and ")}: Approve leaves ${marks.length === 2 ? "both" : "it"} until ${marks.length === 2 ? "their" : "its"} line says Decision: Accept.`;
  const link = url(source?.attributes.notion);
  return [
    // A correction group's top names the correction, not a source (capture-and-review §7.12.2 6a).
    typeof a.correction === "string" ? `**Correction:** ${groupCounts(items)}.${marked}` : `**From ${escapeInline(title)}:** ${groupCounts(items)}.${marked}`,
    "**What to do:** 1. Read the sections below, or click **Review with me** to go through them with Brain Assistant. 2. Correct a wording where it stands, or type Accept, Reject, Defer or Request revision on an item's Decision line. 3. Set **Your call**: Approve, Request revision (say what in What to fix) or Reject.",
    ...(link === null ? [] : [`Source: [${title.replace(/[[\]]/g, "")}](${link})`]),
  ];
}

/** A correction group's uncertain matches (capture-and-review §7.12.2 6a): named, never items, never read. */
function needsClarification(proposal: Note, workspace: Workspace): string[] {
  const entries = (Array.isArray(proposal.attributes.needs_clarification) ? proposal.attributes.needs_clarification : []).filter(record);
  if (typeof proposal.attributes.correction !== "string" || entries.length === 0) return [];
  const field = String(proposal.attributes.correction).split(":")[1] ?? "";
  // Restricted text never reaches the page: a note is named in its published form, and a line it no longer shows is left out.
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  const lines = entries.map((entry) => {
    const note = typeof entry.note === "string" ? workspace.get(entry.note) : undefined;
    if (note === undefined) return `- ${escapeInline(String(entry.note))}`;
    const form = publishableNote(note, context);
    const name = titleWithheld(form) ? citeLabel(form) : String(note.attributes.title ?? note.id);
    const visible = eligibleNote(note, context);
    const shown = typeof entry.line === "string" && visible !== null && visible.body.split("\n").includes(entry.line);
    return `- ${escapeInline(name)}: ${shown ? escapeContext(canon(String(entry.line))) : entry.line === null ? `its ${label(field)} fact` : "a line (withheld)"}`;
  });
  return ["## Needs clarification", ...lines, ""];
}

const escapeInline = (text: string): string => oneLine(text).replace(/\*/g, "\\*");

/** The brain-context toggle (capture-and-review §7.12.5, 0090 §2): never read back, rebuilt by every render that sends the row. */
export function brainContext(proposal: Note, workspace: Workspace, items: readonly ReviewItem[]): string {
  const a = proposal.attributes;
  const labels = items[0]?.labels ?? pageLabels([]);
  const passages = [...labels.byRef.entries()].map(([ref, label]) => {
    const [, src, n] = PASSAGE.exec(ref)!;
    const note = workspace.get(src!);
    const text = note === undefined ? undefined : extractPassages(note.body).find((entry) => entry.n === Number(n))?.text;
    return `- [${label}] ${text === undefined ? "(the text is not in the brain)" : escapeContext(oneLine(text))}`;
  });
  const shown = items.filter((item) => !item.held);
  const what = shown.map((item) => `- ${escapeContext(item.summary_title)} (${item.item_id}): ${escapeContext(item.what)}`);
  const unsure = shown.flatMap((item) => item.flags.map((flag) => `- ${escapeContext(item.summary_title)} (${item.item_id}): ${escapeContext(flag)}`));
  const repeats = new Map<string, ReviewItem[]>();
  for (const item of shown) if (item.repeat !== undefined) repeats.set(item.repeat, [...(repeats.get(item.repeat) ?? []), item]);
  const repeatLines = [...repeats.entries()].filter(([, group]) => group.length > 1).map(([key, group]) => `- ${group.map((item) => escapeContext(item.summary_title)).join(", ")} record: ${escapeContext(key)}`);
  const source = typeof a.source === "string" ? workspace.get(a.source) : undefined;
  const related: string[] = [];
  const page = (label: string, note: Note | undefined) => { if (note === undefined) return; const link = url(note.attributes.notion); const title = String(note.attributes.title ?? note.id).replace(/[[\]]/g, ""); related.push(`- ${label}: ${link === null ? escapeContext(title) : `[${title}](${link})`}`); };
  page(source?.type === "meeting" ? "Meeting" : "Source", source);
  for (const project of Array.isArray(source?.attributes.projects) ? source.attributes.projects : []) page("Project", workspace.get(String(project)));
  if (typeof source?.attributes.area === "string") page("Area", workspace.get(source.attributes.area));
  return [
    "**Source passages**", ...(passages.length === 0 ? ["- None cited."] : passages), "",
    "**What each item changes**", ...(what.length === 0 ? ["- Nothing to show."] : what), "",
    "**Where the brain is unsure**", ...(unsure.length === 0 ? ["- Nothing flagged."] : unsure), "",
    "**Repeats**", ...(repeatLines.length === 0 ? ["- None marked."] : repeatLines), "",
    "**Related pages**", ...(related.length === 0 ? ["- None."] : related), "",
    "**Rules for writing into this page**",
    "- Write only inside an item section: its wording, its Decision line (Accept, Reject or Defer) and its Revision request line, after the user's yes to a preview.",
    "- Move a [¶n] marker only when the wording changed, and only to a passage listed under Source passages that holds the new text. Never invent one.",
    "- Under a section you changed, add one line \"Agreed in review: …\" with what the user decided and why, in a few words.",
    "- Never change a heading, a ref line, a toggle's structure, this toggle, any property or Your call.",
  ].join("\n");
}

/** A line of the toggle never reads as item structure. */
const escapeContext = (text: string): string => text.replace(/\n/g, " ").replace(/^(\s*)(ref |Decision:|Revision request:|Agreed in review:)/i, "$1\\$2");

// ── Reading the page back (capture-and-review §7.3) ──────────────────────────────────────────────

export const DECISIONS = ["pending", "accept", "reject", "defer", "request revision"] as const;
export type Token = (typeof DECISIONS)[number];

export interface ParsedSection {
  item_id: string;
  /** The Proposed toggle's children, unescaped and canonical; null when the toggle is missing or holds a block the skill could not convert. */
  proposed: string | null;
  /** The `Decision:` token, or null when the line is missing or is not one of the five (UNREADABLE). */
  decision: Token | null;
  decision_text: string | null;
  revision_request: string | null;
  /** The section as read, canonical: what `snapshot_hash` is over. */
  section: string;
  /** More than one section carries this id, so none of them can be trusted. */
  duplicate: boolean;
}

/** A block the skill could not turn into Markdown (cli §5.14.7); inside the Proposed toggle it makes the item UNREADABLE. */
export const UNCONVERTIBLE = "<!-- unconvertible block -->";

/** Split a Review page into its item sections and read each (the inverse of `renderReview`). Sections are located by the `## [letter · it-id]` heading only. */
export function parseReviewPage(markdown: string): Map<string, ParsedSection> {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const heads: Array<{ index: number; id: string }> = [];
  lines.forEach((line, index) => { const match = /^## \[[a-z]+ · (it-[0-9a-z]{8})\]/.exec(line); if (match !== null) heads.push({ index, id: match[1]! }); });
  const result = new Map<string, ParsedSection>();
  heads.forEach((head, position) => {
    const block = lines.slice(head.index, position + 1 < heads.length ? heads[position + 1]!.index : lines.length);
    const opened = block.findIndex((line, index) => /^<details>\s*$/.test(line.trim()) && /^<summary>\s*Proposed final wording\s*<\/summary>\s*$/i.test((block[index + 1] ?? "").trim()));
    let proposed: string | null = null;
    let after = block;
    if (opened >= 0) {
      const closed = block.findIndex((line, index) => index > opened + 1 && line.trim() === "</details>");
      if (closed > opened) {
        const rows = block.slice(opened + 2, closed);
        // Notion may hand the children back indented: the whitespace every non-empty line shares is layout, not text.
        const filled = rows.filter((row) => row.trim() !== "");
        const shared = filled.length === 0 ? "" : filled.map((row) => /^[ \t]*/.exec(row)![0]).reduce((common, indent) => { let i = 0; while (i < common.length && i < indent.length && common[i] === indent[i]) i += 1; return common.slice(0, i); });
        const children = rows.map((row) => (row.startsWith(shared) ? row.slice(shared.length) : row)).join("\n");
        proposed = children.includes(UNCONVERTIBLE) ? null : canon(unescapeSection(children));
        after = block.slice(closed + 1);
      }
    }
    // The Decision and Revision lines are read outside the toggle, so proposed text can never set them.
    const decisionLines = after.filter((line) => /^\s*Decision:/i.test(line));
    const revisionLines = after.filter((line) => /^\s*Revision request:/i.test(line));
    // Two Decision (or Revision request) lines are ambiguous: neither is read.
    const decisionLine = decisionLines.length === 1 ? decisionLines[0] : undefined;
    const text = decisionLine === undefined ? null : decisionLine.replace(/^\s*Decision:\s*/i, "").trim();
    const normalized = text === null ? null : text.replace(/\s+/g, " ").toLowerCase();
    const decision = normalized !== null && (DECISIONS as readonly string[]).includes(normalized) ? (normalized as Token) : null;
    const revision = revisionLines.length !== 1 ? null : revisionLines[0]!.replace(/^\s*Revision request:\s*/i, "").trim();
    const entry: ParsedSection = { item_id: head.id, proposed, decision: revisionLines.length > 1 ? null : decision, decision_text: text, revision_request: revision === "" ? null : revision, section: canon(block.join("\n")), duplicate: result.has(head.id) };
    if (result.has(head.id)) result.get(head.id)!.duplicate = true;
    if (!result.has(head.id)) result.set(head.id, entry);
  });
  return result;
}

export const sectionHash = (section: string): string => sha(canon(section));
export const textSha = sha;
