import { createHash } from "node:crypto";

import { PASSAGE_REF } from "./selection.ts";
import { PASSAGE } from "./suppressions.ts";

// The Review page of format 2 (capture-and-review §7.12; decisions 0088 §2, 0090): short markers, escaping, the parser of `ref` lines and
// visible wording, and the check that a fact's value is in its passages. Pure: no workspace, no Notion calls.

const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

export const CONTEXT_HEADING = "For Brain Assistant (brain context)";
export const NOTE_TOGGLE = "Read or edit the note";

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

/** Wording as the page shows it: a `[¶n]` the source wrote is escaped, then each passage reference is its short label. */
export function shorten(text: string, labels: Labels): string {
  return text.replace(/\[¶/g, "\\[¶").replace(PASSAGE_REF, (whole, source: string, n: string, hash: string) => {
    const label = labels.byRef.get(`${source}#¶${n}:${hash}`);
    return label === undefined ? whole : `[${label}]`;
  });
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

/** Escape the lines of visible wording (or, `toggle`, of a toggle's children) that would read as page structure. */
export function escape2(text: string, toggle = false): string {
  const rule = toggle ? IN_TOGGLE : VISIBLE;
  return text.split("\n").map((line) => (rule.test(line) ? `\\${line}` : line)).join("\n");
}

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
        noteText = text.includes(unconvertible) ? null : canon2(unescape2(canon2(text), true));
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
  const visible = canon2(unescape2(canon2(wording.join("\n"))));
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
