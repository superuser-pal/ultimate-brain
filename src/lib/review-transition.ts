import { createHash } from "node:crypto";

import { cleanupItemView, CLEANUP_KINDS } from "./cleanup-row.ts";
import { restrictedSources } from "./eligibility.ts";
import type { Note } from "./notes.ts";
import { linkRefs, proposalWithheld } from "./passages.ts";
import { bodyHash } from "./proposals.ts";
import { PASSAGE_REF } from "./selection.ts";
import { citeLabel, contextFor, eligibleNote, PASSAGE, publishableNote, requireSuppressions, titleWithheld, withoutWithheldLinks } from "./suppressions.ts";
import type { Workspace } from "./workspace.ts";

// The 0.16.0 transition (cli §5.14.8, capture-and-review §7.9): the only code that still reads a Review row. It reads the pages that 0.15.x
// published, formats 1 and 2 (capture-and-review (v0.15.1) §7.3, §7.12), and works out what each item's target holds now, so a decided row is
// applied once by the rules it was published under. Nothing here renders a page: sync no longer publishes proposals (0096).

const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

const NOTE_TOGGLE = "Read or edit the note";

// ── Short markers (§7.12.4) ─────────────────────────────────────────────────────────────────────

/** The passages a page lists, in order, each with its label (`¶72`, or `¶72 src-xxxxxxxx` when two passages share a number). */
export interface Labels { byRef: Map<string, string>; byLabel: Map<string, string> }

export function pageLabels(passages: readonly string[]): Labels {
  const refs = [...new Set(passages.filter((passage) => PASSAGE.test(passage)))];
  const counts = new Map<string, number>();
  for (const ref of refs) { const n = PASSAGE.exec(ref)![2]!; counts.set(n, (counts.get(n) ?? 0) + 1); }
  const byRef = new Map<string, string>(); const byLabel = new Map<string, string>();
  for (const ref of refs) {
    const [, source, n] = PASSAGE.exec(ref)!;
    const label = counts.get(n!)! > 1 ? `¶${n} ${source}` : `¶${n}`;
    byRef.set(ref, label); byLabel.set(label, ref);
  }
  return { byRef, byLabel };
}

/** Undo Notion's markdown escapes of a backslash and of brackets (`\\`, `\[`, `\]`), left to right: a marker reads back as `\[¶4\]` (§9.5). */
export function fromNotion(text: string): string {
  return text.replace(/\\([\\[\]])/g, "$1");
}

/** The inverse of `shorten`: each label back to its full reference. `unknown` lists the labels the page doesn't hold. */
export function expand(text: string, labels: Labels): { text: string; unknown: string[]; cited: string[] } {
  const unknown: string[] = []; const cited: string[] = [];
  const out = text.replace(/(?<!\\)\[(¶\d+(?: src-[0-9a-z]{8})?)\]/g, (whole, label: string) => {
    const ref = labels.byLabel.get(label);
    if (ref === undefined) { unknown.push(label); return whole; }
    cited.push(ref);
    return `^[${ref}]`;
  }).replace(/\\\[¶/g, "[¶");
  for (const ref of out.matchAll(PASSAGE_REF)) if (!cited.includes(`${ref[1]}#¶${ref[2]}:${ref[3]}`)) cited.push(`${ref[1]}#¶${ref[2]}:${ref[3]}`);
  return { text: out, unknown, cited };
}

/** A fact's wording without its markers: the value. */
export const withoutMarkers = (text: string): string => text.replace(/\s*\^\[[^\]\n]*\]/g, "").replace(/\s*(?<!\\)\[¶\d+(?: src-[0-9a-z]{8})?\]/g, "").trim();

// ── Escaping (§7.12.4) ─────────────────────────────────────────────────────────────────────────

const VISIBLE = /^[\s\\]*(?:#|>|\*Why:|ref it-|<span|<\/?details|<summary|<!--|Decision:|Revision request:|Agreed in review:)/i;
const IN_TOGGLE = /^[\s\\]*(?:<\/?details|<summary)/i;

export function unescape2(text: string, toggle = false): string {
  const rule = toggle ? IN_TOGGLE : VISIBLE;
  return text.split("\n").map((line) => (line.startsWith("\\") && rule.test(line.slice(1)) ? line.slice(1) : line)).join("\n");
}

/** Canonical text, as review-body's `canon`: LF, NFC, no trailing blanks, the indent every line shares and blank edges removed. */
export function canon2(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").normalize("NFC").split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  const filled = lines.filter((line) => line !== "");
  const shared = filled.length === 0 ? "" : filled.map((line) => /^[ \t]*/.exec(line)![0]).reduce((common, indent) => { let i = 0; while (i < common.length && i < indent.length && common[i] === indent[i]) i += 1; return common.slice(0, i); });
  return lines.map((line) => (line.startsWith(shared) ? line.slice(shared.length) : line)).join("\n").replace(/^\n+|\n+$/g, "");
}

/** The hash of a format-2 wording (§7.12.9): canonical, blank lines left out (they are layout: Notion separates blocks with them). */
export const wordingSha = (text: string): string => sha(canon2(text).split("\n").filter((line) => line.trim() !== "").join("\n"));

/** A link item's wording as names: one per line, without its `+`, `-` or `*` lead. */
export function linkNames(text: string): string[] {
  return canon2(text).split("\n").map((line) => line.replace(/^\s*\\?[+\-*]\s*/, "").trim()).filter((line) => line !== "");
}

// ── Reading a page back (§7.12.6) ─────────────────────────────────────────────────────────────

export interface Section2 {
  item_id: string;
  /** The wording as read: unescaped and canonical, labels still short (the plan expands them); null when unreadable. */
  wording: string | null;
  decision_text: string | null; decision_lines: number; revision_lines: number; revision_request: string | null;
  /** The `Agreed in review:` lines, without the label, joined by a newline; null when there are none. */
  agreed: string | null;
  section: string; duplicate: boolean;
}

const REF_LINE = /^\s*(?:<span[^>]*>\s*)?ref (it-[0-9a-z]{8})\s*(?:<\/span>)?\s*$/;
const HEADING = /^#{1,6}\s/;
const OPEN = /^\s*<details\b/i;
const CLOSE = /^\s*<\/details>\s*$/i;
const SUMMARY = /^\s*<summary>\s*(.*?)\s*<\/summary>\s*$/i;

/** Split a format-2 page into item sections found by their `ref` line; headings and the brain-context toggle are never read. */
export function parseReviewPage2(markdown: string, unconvertible: string): Map<string, Section2> {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  // Headings outside toggles split the page; the brain-context heading ends what is read.
  const parts: string[][] = [];
  let current: string[] = []; let depth = 0;
  for (const line of lines) {
    if (depth === 0 && HEADING.test(line.trim())) {
      parts.push(current); current = [line];
      if (line.replace(/^\s*#+\s*/, "").startsWith("For Brain Assistant")) { current = []; break; }
      continue;
    }
    if (OPEN.test(line)) depth += 1;
    if (CLOSE.test(line)) depth = Math.max(0, depth - 1);
    current.push(line);
  }
  parts.push(current);
  const result = new Map<string, Section2>();
  for (const part of parts) {
    // Only a part with exactly one ref line outside its toggles is an item; two ref lines in one part are read as neither.
    const refs: string[] = []; let level = 0;
    for (const line of part) { if (OPEN.test(line)) level += 1; if (CLOSE.test(line)) level = Math.max(0, level - 1); else if (level === 0) { const match = REF_LINE.exec(line); if (match !== null) refs.push(match[1]!); } }
    if (refs.length !== 1) continue;
    const id = refs[0]!;
    const entry = readSection(id, part, unconvertible);
    const seen = result.get(id);
    if (seen !== undefined) { seen.duplicate = true; continue; }
    result.set(id, entry);
  }
  return result;
}

function readSection(id: string, part: string[], unconvertible: string): Section2 {
  const wording: string[] = []; const decisions: string[] = []; const revisions: string[] = []; const agreed: string[] = [];
  let noteText: string | null = null; let broken = false; let sawToggle = false;
  const body = HEADING.test((part[0] ?? "").trim()) ? part.slice(1) : part;
  for (let index = 0; index < body.length; index += 1) {
    const line = body[index]!;
    const trimmed = line.trim();
    if (OPEN.test(line)) {
      // A toggle: its children until the matching close. "Read or edit the note" is a note's wording; "Previous proposal" is never read.
      let level = 1; const children: string[] = []; let title: string | null = null;
      const inline = SUMMARY.exec(line.replace(/^\s*<details[^>]*>/i, ""));
      if (inline !== null) title = inline[1]!;
      let at = index + 1;
      for (; at < body.length; at += 1) {
        const inner = body[at]!;
        if (OPEN.test(inner)) level += 1;
        if (CLOSE.test(inner)) { level -= 1; if (level === 0) break; }
        if (title === null && SUMMARY.test(inner) && children.every((child) => child.trim() === "")) { title = SUMMARY.exec(inner)![1]!; continue; }
        children.push(inner);
      }
      index = at;
      if (title !== null && title.toLowerCase() === NOTE_TOGGLE.toLowerCase()) {
        sawToggle = true;
        const text = children.join("\n");
        noteText = text.includes(unconvertible) ? null : canon2(unescape2(fromNotion(canon2(text)), true));
        if (noteText === null) broken = true;
      } else if (title === null || title.toLowerCase() !== "previous proposal") broken = true;
      continue;
    }
    if (trimmed === "" ) { wording.push(""); continue; }
    if (REF_LINE.test(line)) continue;
    if (/^\s*Decision:/i.test(line)) { decisions.push(line.replace(/^\s*Decision:\s*/i, "").trim()); continue; }
    if (/^\s*Revision request:/i.test(line)) { revisions.push(line.replace(/^\s*Revision request:\s*/i, "").trim()); continue; }
    if (/^\s*Agreed in review:/i.test(line)) { const text = line.replace(/^\s*Agreed in review:\s*/i, "").trim(); if (text !== "") agreed.push(text); continue; }
    if (/^\s*>/.test(line) || /^\s*\*Why:/i.test(line)) continue;
    if (line.includes(unconvertible)) { broken = true; continue; }
    wording.push(line);
  }
  const visible = canon2(unescape2(fromNotion(canon2(wording.join("\n")))));
  const text = sawToggle ? noteText : visible;
  const decisionText = decisions.length === 1 ? decisions[0]! : null;
  const revision = revisions.length === 1 ? revisions[0]! : null;
  return {
    item_id: id, wording: broken || text === null ? null : text, decision_text: decisionText, decision_lines: decisions.length, revision_lines: revisions.length,
    revision_request: revision === null || revision === "" ? null : revision, agreed: agreed.length === 0 ? null : agreed.join("\n"),
    section: canon2(part.join("\n")), duplicate: false,
  };
}

// ── The value of a fact in its passages (§7.12.6, 0090 §4) ─────────────────────────────────────────

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** The words for a whole number below a thousand: `nine`, `twenty-one` and `twenty one`, `one hundred and five`. */
function numberWords(n: number): string[] {
  if (n < 20) return [ONES[n]!];
  if (n < 100) { const tens = TENS[Math.floor(n / 10)]!; return n % 10 === 0 ? [tens] : [`${tens}-${ONES[n % 10]}`, `${tens} ${ONES[n % 10]}`]; }
  const rest = n % 100; const head = `${ONES[Math.floor(n / 100)]} hundred`;
  return rest === 0 ? [head] : numberWords(rest).flatMap((words) => [`${head} and ${words}`, `${head} ${words}`]);
}

/** Every form a value may take in a passage, by its type (0090 §4): digits and words, the forms of a date, a name and its aliases, the text. */
export function valueForms(value: string, aliases: readonly string[] = []): string[] {
  const text = value.trim().replace(/^[\s"'“”‘’.,;:!?()]+|[\s"'“”‘’.,;:!?()]+$/g, "");
  const forms = new Set<string>([text, ...aliases]);
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 0 && n < 1000) for (const words of numberWords(n)) forms.add(words);
    if (Number.isInteger(n) && n >= 1000) forms.add(n.toLocaleString("en-US"));
  }
  const date = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text);
  if (date !== null) {
    const [, year, month, day] = date;
    if (month !== undefined) {
      const m = Number(month); const name = MONTHS[m - 1];
      if (name !== undefined) {
        const short = name.slice(0, 3);
        if (day === undefined) for (const form of [`${name} ${year}`, `${short} ${year}`, `${name}, ${year}`, `${month}/${year}`, `${m}/${year}`, `${year}/${month}`]) forms.add(form);
        else {
          const d = Number(day);
          for (const form of [`${d} ${name}`, `${d} ${short}`, `${name} ${d}`, `${short} ${d}`, `${day}/${month}/${year}`, `${d}/${m}/${year}`, `${day}.${month}.${year}`, `${month}/${day}/${year}`, `${d}/${m}`, `${name} ${d}th`, `${d}th ${name}`, `${name} ${d}st`, `${name} ${d}nd`, `${name} ${d}rd`]) forms.add(form);
        }
      }
    }
  }
  return [...forms].filter((form) => form !== "");
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a passage's text holds one of the value's forms, ignoring case, as a whole word (digits never inside a longer number). */
export function holdsValue(passage: string, forms: readonly string[]): boolean {
  const haystack = passage.normalize("NFC").toLowerCase();
  return forms.some((form) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(form.normalize("NFC").toLowerCase())}(?![\\p{L}\\p{N}]|[.,]\\d)`, "u").test(haystack));
}

// ── Format 1 (capture-and-review (v0.15.1) §7.3) ─────────────────────────────────────────────────

/** Canonical text: LF endings, NFC, no trailing blanks on a line, no blank edges. Notion strips what this strips, so a hash over it is stable across a round trip. */
export function canon(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").normalize("NFC").split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  // Whitespace that every non-empty line shares is layout (Notion indents toggle children), not text.
  const filled = lines.filter((line) => line !== "");
  const shared = filled.length === 0 ? "" : filled.map((line) => /^[ \t]*/.exec(line)![0]).reduce((common, indent) => { let i = 0; while (i < common.length && i < indent.length && common[i] === indent[i]) i += 1; return common.slice(0, i); });
  return lines.map((line) => (line.startsWith(shared) ? line.slice(shared.length) : line)).join("\n").replace(/^\n+|\n+$/g, "");
}

// A line of proposed text that imitated the page's own structure was escaped by a leading backslash.
const STRUCTURAL = /^[\s\\]*(?:## \[|<\/?details|<summary|Decision:|Revision request:)/i;

/** What a parser applies to the children of the Proposed toggle before it hashes or applies them. */
export function unescapeSection(text: string): string {
  return text.split("\n").map((line) => (line.startsWith("\\") && STRUCTURAL.test(line.slice(1)) ? line.slice(1) : line)).join("\n");
}

/** The format a published Review row's page has (capture-and-review §7.12.1): recorded in `@review.format`; an exclusion cleanup row is format 1. */
export function reviewFormat(proposal: Note, config?: Record<string, unknown>): 1 | 2 {
  if (record(proposal.attributes.cleanup)) return 1;
  const published = proposal.attributes.notion_published;
  const review = record(published) && record(published["@review"]) ? published["@review"] : undefined;
  // A new page follows `notion.review_format` (schema §12): absent or 2 is format 2.
  if (review === undefined) return record(config?.notion) && config.notion.review_format === 1 ? 1 : 2;
  return review.format === 2 ? 2 : 1;
}

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

/** Split a Review page into its item sections and read each . Sections are located by the `## [letter · it-id]` heading only. */
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

/** An item of a published Review row, as the transition reads it: the base its target holds now and the rules its row was decided under. */
export interface TransitionItem {
  item_id: string;
  /** The item rests on text a suppression restricts, so its page showed a stub that cannot be accepted (capture-and-review §5.1). */
  held: boolean;
  /** The item rests on excluded evidence (eligibility.md §4.2): an accept closes it stale. */
  source_excluded: boolean;
  /** What the target holds in Git now, hashed as the page's `base_hash` was at render: a difference is `BASE_CHANGED`. */
  current_base_hash: string;
  /** Format 2: a ⚠ fact change, or a flagged item, which an Approve never accepts while Pending (0090 §5). */
  warn: boolean; flags: string[];
  passages: string[];
  /** The page's passage labels (format 2). */
  labels: Labels;
  /** A link item's values, each with its index into `links`, its title and the names it may be written as (lower case). */
  link_values?: LinkValue[];
}

export interface LinkValue { index: number; title: string; names: string[] }

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The base an item was proposed against, with its own marker for "the target is missing" (a missing target is `base_changed`, §7.5). */
const base = (exists: boolean, value: unknown): string => JSON.stringify(exists ? { v: value ?? null } : { missing: true });

/** The items of a published row as the plan and apply of the transition compare them, built as `sync render` built them in 0.15.x. */
export function transitionItems(proposal: Note, workspace: Workspace): TransitionItem[] {
  const a = proposal.attributes;
  const links = (Array.isArray(a.links) ? a.links : []).filter(record);
  const changes = (Array.isArray(a.changes) ? a.changes : []).filter(record);
  const context = contextFor(workspace.notes, requireSuppressions(workspace.root));
  // A note is read in its eligible form: a target with restricted text holds its item.
  const seen = (note: Note | undefined): { note: Note | undefined; held: boolean } => {
    if (note === undefined) return { note: undefined, held: false };
    const visible = eligibleNote(note, context);
    return { note: visible ?? note, held: visible === null || visible.body !== note.body };
  };
  const sourceRestricted = typeof a.source === "string" && restrictedSources(context).has(a.source);
  const stored = (Array.isArray(a.items) ? a.items : []).filter(record);
  const withheld = proposalWithheld(proposal, workspace, context);
  const factValues = new Map<string, Set<string>>();
  for (const change of changes) if (change.kind === "update_fact") { const key = `${String(change.target)}\u0000${String(change.field)}`; factValues.set(key, (factValues.get(key) ?? new Set()).add(String(change.after))); }
  const drafts = stored.map((entry) => {
    const refs = linkRefs(entry.ref);
    const itemExcluded = entry.kind === "note" ? withheld.notes.has(String(entry.ref)) : entry.kind === "link" ? refs.some((ref) => withheld.links.has(ref)) : entry.kind === "change" ? withheld.changes.has(Number(entry.ref)) : false;
    const cleanup = CLEANUP_KINDS.includes(entry.kind as never);
    let held = false; let now: string; let warn = false; let factKey: string | undefined; let linkValues: LinkValue[] | undefined;
    if (cleanup) {
      now = cleanupItemView(proposal, entry, workspace).base;
    } else if (entry.kind === "note") {
      const note = workspace.get(String(entry.ref));
      held = seen(note).held;
      now = base(note !== undefined, bodyHash(note?.body ?? ""));
    } else if (entry.kind === "link") {
      const link = links[refs[0] ?? -1] ?? {};
      const target = typeof link.target === "string" ? workspace.get(link.target) : undefined;
      const view = seen(target);
      held = view.held;
      const field = String(link.field);
      const values = view.note !== undefined && Array.isArray(view.note.attributes[field]) ? (view.note.attributes[field] as unknown[]) : [];
      now = base(view.note !== undefined, [...values.map(String)].sort());
      // As the page was built: once the item names a withheld note (its target's links, its target, a value it holds or lists), the names that
      // follow are matched by title and id only, never by alias.
      let namesWithheld = false;
      const titleOf = (value: unknown): string => {
        if (typeof value !== "string") return String(value ?? "");
        const note = workspace.get(value);
        if (note === undefined) return value;
        const form = note.type === "source" || note.type === "proposal" ? note : publishableNote(note, context);
        if (titleWithheld(form)) { namesWithheld = true; return citeLabel(form); }
        return String(note.attributes.title ?? value);
      };
      const visible = target === undefined ? null : eligibleNote(target, context);
      if (visible !== null && withoutWithheldLinks(visible, context).body !== visible.body) namesWithheld = true;
      for (const value of values) titleOf(value);
      titleOf(link.target);
      linkValues = refs.map((ref) => {
        const value = links[ref]?.value;
        const note = typeof value === "string" ? workspace.get(value) : undefined;
        const title = titleOf(value);
        const aliases = note === undefined || namesWithheld ? [] : (Array.isArray(note.attributes.aliases) ? note.attributes.aliases.map(String) : []);
        return { index: ref, title, names: [...new Set([title, String(value ?? ""), ...aliases].map((name) => name.toLowerCase()))] };
      });
    } else {
      const change = changes[Number(entry.ref)] ?? {};
      const target = typeof change.target === "string" ? workspace.get(change.target) : undefined;
      const view = seen(target);
      held = view.held;
      if (change.kind === "update_fact") {
        const facts = view.note?.attributes.facts;
        const live = facts !== null && typeof facts === "object" ? (facts as Record<string, unknown>)[String(change.field)] : undefined;
        now = base(view.note !== undefined, live === undefined ? null : String(live));
        warn = change.before !== undefined;
        factKey = `${String(change.target)}\u0000${String(change.field)}`;
      } else {
        now = base(view.note !== undefined, bodyHash(target?.body ?? ""));
        warn = change.kind === "replace_line";
      }
    }
    // A cleanup item keeps the rule it had: held while the row's source is excluded. Every other item is held when it is withheld (§11.5).
    const cleanupHeld = sourceRestricted && cleanup;
    if (cleanupHeld || itemExcluded) held = true;
    return { entry, held, now, warn, factKey, linkValues, sourceExcluded: cleanupHeld || itemExcluded };
  });
  // The page's passages: those of every item it showed, in order (capture-and-review §7.12.4); a held item's were never listed.
  const labels = pageLabels(drafts.filter((draft) => !draft.held).flatMap(({ entry }) => (Array.isArray(entry.passages) ? entry.passages : []).map(String)));
  return drafts.map(({ entry, held, now, warn, factKey, linkValues, sourceExcluded }) => {
    const flags = [...(Array.isArray(entry.unsure) ? entry.unsure.map(String) : [])];
    if (factKey !== undefined && (factValues.get(factKey)?.size ?? 0) > 1) flags.push(`Two values: ${[...factValues.get(factKey)!].join(" and ")}.`);
    return {
      item_id: String(entry.item_id), held, source_excluded: sourceExcluded, current_base_hash: sha(now), warn, flags,
      passages: (Array.isArray(entry.passages) ? entry.passages : []).map(String), labels, ...(linkValues === undefined ? {} : { link_values: linkValues }),
    };
  });
}

