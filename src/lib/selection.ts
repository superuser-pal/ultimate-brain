import { createHash } from "node:crypto";

// Subject/item selection and passage mapping (capture-and-review §4.1 to §4.8). Pure functions: no I/O, no AI-authored numbers.

export type Selection = "use" | "meeting only";
export type SelectionCode = "SELECTION_UNREADABLE" | "SELECTION_UNMAPPABLE" | "DEPENDS_ON_EXCLUDED" | "UNNUMBERED_LINE";

export interface Subject { id: string; title: string; selection: Selection; raw: string | null }
export interface Item {
  id: string; subject: string | null; explicit: Selection | null; waiting_on: boolean;
  text: string; anchors: string[]; depends_on: string[]; line: string;
}
export interface Problem { code: SelectionCode; id: string | null; reason: string; with?: string[] }
/** A list line without an id: never an item, never imported, always listed (capture-and-review §4.1, parser tolerance). */
export interface Unnumbered { subject: string | null; text: string }
/** A line of a Quick follow-ups group: stays in Notion, never an item, never imported, never a blocker (decision 0067, capture-and-review §4.1). */
export interface Quick { subject: string | null; id: string | null; text: string; done: boolean }
/** The fields of a Scope toggle and what is wrong with them; a Scope problem holds back the item's Task, never the input (decision 0067). */
export interface Scope { item: string | null; done_when: string | null; due: string | null; project: string | null; notes: string | null; problems: string[] }
/** `quickItems` are the quick lines that carry an id, read like items: one whose effective selection is `meeting only` still keeps its paragraphs out (fail closed). */
export interface Summary { subjects: Subject[]; items: Item[]; problems: Problem[]; lines: string[]; unnumbered: Unnumbered[]; quick: Quick[]; quickItems: Item[]; scopes: Scope[] }
/** `text` is whitespace-normalized (for matching and hashing); `raw` is the paragraph as written, which is what an extract stores and a preview shows. */
export interface Paragraph { n: number; text: string; raw: string; hash: string }

const SUBJECT = /^(?:#{1,6}\s*)?\[(s\d+)\]\s*(.*)$/;
const ITEM = /^(?:[-*+]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?\[(s\d+\.i\d+)\]\s*(.*)$/;
const TODO = /^(?:[-*+]|\d+[.)])\s+\[([ xX])\](?:\s+(.*))?$/;
const TICKED = /^(?:[-*+]|\d+[.)])\s+\[[xX]\]/;
const LIST = /^(?:[-*+]|\d+[.)])\s+/;
const GROUP = /^#{0,6}\s*(quick follow[- ]?ups|tasks|my actions)\s*(?:\([^)]*\))?\s*:?$/i;
/** The other section names of the minutes format: a heading or a label line with one of them ends a group (§4.1). */
const SECTION = /^#{0,6}\s*(highlights|decisions|other commitments|open questions|concerns raised|attendees|projects|commitments|ideas to explore)\s*(?:\([^)]*\))?\s*:?$/i;
const SCOPE_FIELDS: Record<string, "done_when" | "due" | "project" | "notes"> = { "done when": "done_when", due: "due", project: "project", notes: "notes" };
const SCOPE_LABELS = { done_when: "Done when", due: "Due", project: "Project", notes: "Notes" } as const;
const SCOPE_FIELD = /^(?:[-*+]\s+)?[*_]*(done when|due|project|notes)[*_]*\s*:[*_]*\s*(.*)$/i;
const ABSENT = /^(?:none|n\/a|-|—)?$/i;
const SELECTION_LINE = /^(?:[-*+]\s+)?selection\s*:\s*(.*)$/i;
const QUOTE = /[“"]([^“”"]+)[”"]/g;
const DEPENDS = /\(\s*depends on\s+((?:\[[^\]]+\](?:\s*,\s*)?)+)\s*\)\s*$/i;

/** Whitespace-normalized text: markdown bold/italic marks and list bullets are formatting, not content. */
export function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The 8-hex check hash of a paragraph's normalized text (§4.5). */
export function passageHash(text: string): string {
  return sha(normalize(text)).slice(0, 8);
}

/** The ids of the items whose paragraphs an extract holds (its markers `<!-- passage ¶n item a,b -->`): an item that is effectively `use` but whose paragraph was not copied is not here. */
export function importedItems(body: string): Set<string> {
  return new Set([...body.matchAll(/<!-- passage ¶\d+ item ([^>]*?)\s*-->/g)].flatMap((match) => (match[1] ?? "").split(",").map((id) => id.trim()).filter((id) => id !== "")));
}

/** The passages of an extract body: each `<!-- passage ¶n item … -->` marker with the paragraph text after it. */
export function extractPassages(body: string): { n: number; text: string }[] {
  const parts = body.split(/<!-- passage ¶(\d+) item [^>]*-->\n/);
  const result: { n: number; text: string }[] = [];
  for (let index = 1; index < parts.length; index += 2) result.push({ n: Number(parts[index]), text: normalize(parts[index + 1] ?? "") });
  return result;
}

/** A passage reference beside a statement: `^[src-…#¶n:<hash>]` (§5.1). */
export const PASSAGE_REF = /\^\[(src-[0-9a-z]{8})#¶(\d+):([0-9a-f]{8})\]/g;

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function selectionOf(raw: string): Selection | null {
  const value = normalize(raw.replace(/[*_`]/g, "")).toLowerCase();
  return value === "use in brain" ? "use" : value === "meeting only" ? "meeting only" : null;
}

const TOKENS = ["meeting only", "use in brain"];
const NOTICE_TEXT = /all\s+subjects\s+included\s+unless\s+marked\s+meeting\s+only\.?\s*mark\s+(?:reviewed|ready)(?:\s*\(\s*inbox:\s*ready\s*\))?\s+to\s+confirm\.?/gi;
const LEAD = /^[\s[({"'“”‘’*_>•–—-]+/;
const PHRASE_START = /^(?:meeting[\s-]*only|use[\s-]+in[\s-]+(?:the[\s-]+)?brain)/i;
const PHRASE_BRACKETED = /[[({][^\])}]*(?:meeting[\s-]*only|use[\s-]+in[\s-]+(?:the[\s-]+)?brain)[^\])}]*[\])}]/i;

/** Text that is shaped like a selection control without being one: it must block, never default to inclusion (§4.3). Prose that mentions
 *  the words further into a sentence ("share notes from the meeting only with Bob") is not a control. */
function controlLike(text: string): boolean {
  const body = text.replace(LEAD, "");
  return PHRASE_START.test(body) || PHRASE_BRACKETED.test(text) || /^selection\b/i.test(body);
}

/** A word that mixes Latin letters with Cyrillic or Greek ones (`Meetіng` with a Cyrillic і) is a look-alike spelling of a control. */
function mixedScript(text: string): boolean {
  return text.replace(QUOTE, " ").split(/\s+/).slice(0, 8).some((word) => /\p{Script=Latin}/u.test(word) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(word));
}
const ID_IN_LINE = /\[s\d+(?:\.i\d+)?\]/i;
const TOKEN_WORDS = /\b(meeting|brain|only|private|confidential|exclude|excluded|secret|skip)\b/i;

function distance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]!; row[0] = i;
    for (let j = 1; j <= right.length; j += 1) { const above = row[j]!; row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)); diagonal = above; }
  }
  return row[right.length]!;
}

/** An item that starts like a selection token but is not one (`Meetng only:`) must block, never default to inclusion (§4.3). */
function looksLikeToken(rest: string): boolean {
  const prefix = /^([A-Za-z][A-Za-z _-]{1,30}?)\s*:/.exec(rest);
  if (prefix === null || /^track\b/i.test(prefix[1]!)) return false;
  const word = normalize(prefix[1]!.replace(/[-_]/g, " ")).toLowerCase();
  return TOKEN_WORDS.test(word) || TOKENS.some((token) => distance(word, token) <= 3);
}

/** Reads the summary text: subject headings, `Selection:` lines and item lines (§4.1, §4.3). Bullets and straight quotes are tolerated (T2, T6). */
export function parseSummary(markdown: string): Summary {
  const subjects: Subject[] = [];
  const items: Item[] = [];
  const problems: Problem[] = [];
  const lines: string[] = [];
  const unnumbered: Unnumbered[] = [];
  const quick: Quick[] = [];
  const scopes: Scope[] = [];
  const quickItems: Item[] = [];
  let current: Subject | null = null;
  // Decision 0067: the group the line is in, the item line a Scope would belong to, and the open toggles (true for a Scope).
  let group: "quick" | "other" | null = null;
  let lastItem: string | null = null;
  const toggles: boolean[] = [];
  let scope: { entry: Scope; field: keyof typeof SCOPE_LABELS | null; seen: Set<string>; closed: boolean } | null = null;
  const scoped = new Set<string>();
  // NFKC folds full-width forms; zero-width and format characters inside words are removed; the §4.4 notice (with an icon, in a callout, or
  // wrapped over lines) is not a control.
  // HTML-escaped `>` and `<` are formatting; toggle tags are put on lines of their own, so a closing tag at the end of a content line closes.
  const cleaned = markdown.normalize("NFKC").replace(/[\p{Cf}\u00ad]/gu, "").replace(NOTICE_TEXT, "").replace(/&gt;/g, ">").replace(/&lt;/g, "<")
    .replace(/<details>/gi, "\n<details>\n").replace(/<\/details>/gi, "\n</details>\n").replace(/<\/summary>/gi, "</summary>\n");
  const rawLines = cleaned.split("\n");
  /** Whether the toggle opened on line `from` has its closing tag further down. */
  const closes = (from: number): boolean => {
    let depth = 1;
    for (let index = from + 1; index < rawLines.length; index += 1) {
      if (/<details>/i.test(rawLines[index]!)) depth += 1;
      else if (/<\/details>/i.test(rawLines[index]!) && (depth -= 1) === 0) return true;
    }
    return false;
  };
  let opened = -1;
  for (const [index, rawLine] of rawLines.entries()) {
    // Blockquote markers and emphasis around the whole line are formatting, not content; a `* ` bullet keeps its marker.
    let line = normalize(rawLine.replace(/\*\*/g, "")).replace(/^(?:>\s*)+/, "").replace(/^[_*]+(?=\S)|(?<=\S)[_*]+$/g, "").trim();
    if (line === "" || /^[^\p{L}\p{N}\[]*$/u.test(line)) continue; // empty, or only an icon / rule left of the notice
    // Toggles (cli §5.14.7: `<details><summary>…</summary> … </details>`). Only a Scope toggle is read differently; other toggles' lines are read as before.
    const open = /^<details>\s*(.*)$/i.exec(line);
    if (open !== null) {
      toggles.push(false);
      opened = index;
      const rest = open[1] ?? "";
      if (rest === "") continue;
      line = rest;
    }
    const summaryTag = /^<summary>\s*(.*?)\s*<\/summary>\s*(.*)$/i.exec(line);
    if (summaryTag !== null && toggles.length > 0 && !toggles.includes(true)) {
      if (normalize((summaryTag[1] ?? "").replace(/[*_`]/g, "")).toLowerCase() === "scope") {
        toggles[toggles.length - 1] = true;
        if (group !== "quick") {
          const entry: Scope = { item: lastItem, done_when: null, due: null, project: null, notes: null, problems: [] };
          if (lastItem === null) entry.problems.push("a Scope with no item line directly above it");
          else if (scoped.has(lastItem)) entry.problems.push(`a second Scope for ${lastItem}`);
          else scoped.add(lastItem);
          scopes.push(entry);
          scope = { entry, field: null, seen: new Set(), closed: closes(opened) };
        }
      }
      if ((summaryTag[2] ?? "") === "") continue;
      line = summaryTag[2] ?? "";
    }
    if (/^<\/details>$/i.test(line)) {
      if (toggles.pop() === true) scope = null;
      continue;
    }
    const bare = line.replace(/[*_]/g, "").trim();
    // Fail closed: a heading, a subject or a Selection line ends any Scope, and is read as usual, so a Scope never hides a subject or its
    // selection. A Scope that is never closed also ends at an item, a group or section line, or a list line that is not a field.
    if (toggles.includes(true) && (line.startsWith("#") || SUBJECT.test(line) || SELECTION_LINE.test(line)
      || (scope !== null && !scope.closed && (ITEM.test(line) || GROUP.test(bare) || SECTION.test(bare) || (LIST.test(line) && !SCOPE_FIELD.test(line)))))) {
      while (toggles.includes(true)) toggles.pop();
      scope = null;
    }
    if (toggles.includes(true)) {
      // Inside a Scope: fields, never items, unnumbered lines or controls. Inside a Scope in Quick follow-ups: nothing.
      if (scope === null) continue;
      if (ITEM.test(line)) { problems.push({ code: "SELECTION_UNREADABLE", id: current?.id ?? null, reason: `an item line inside a Scope: ${line.slice(0, 60)}` }); continue; }
      const field = SCOPE_FIELD.exec(line);
      if (field !== null) {
        const key = SCOPE_FIELDS[(field[1] ?? "").toLowerCase()]!;
        if (scope.seen.has(key)) { scope.entry.problems.push(`${SCOPE_LABELS[key]} given twice`); scope.field = null; continue; }
        scope.seen.add(key);
        scope.field = key;
        const value = normalize(field[2] ?? "");
        if (ABSENT.test(value)) continue;
        if (key === "due" && !isDate(value)) { scope.entry.problems.push(`Due is not a date (YYYY-MM-DD): ${value}`); continue; }
        scope.entry[key] = value;
      } else if (scope.field === null) {
        if (scope.seen.size === 0) scope.entry.problems.push(`text before the first field: ${line.slice(0, 60)}`);
      } else if (scope.field === "due") scope.entry.problems.push(`Due continues on another line: ${line.slice(0, 60)}`);
      else {
        const key = scope.field;
        const text = line.replace(LIST, "");
        scope.entry[key] = scope.entry[key] === null ? text : `${scope.entry[key]}\n${text}`;
      }
      continue;
    }
    const groupLine = GROUP.exec(bare);
    if (groupLine !== null) {
      group = /^quick/i.test(groupLine[1] ?? "") ? "quick" : "other";
      lastItem = null;
      continue;
    }
    if (line.startsWith("#") || SECTION.test(bare)) { group = null; lastItem = null; }
    const item = ITEM.exec(line);
    if (group === "quick") {
      // A to-do or bullet of a Quick follow-ups group is a quick line: listed, never an item, an unnumbered line or a blocker. A line with an
      // id is a quick line too, but is still read like an item below (fail closed: an excluded one keeps its paragraphs out); a Selection
      // line and any other line are read as usual.
      const todo = TODO.exec(line);
      const bullet = /^(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
      const text = item !== null ? null : todo !== null ? todo[2] ?? "" : bullet !== null && !SELECTION_LINE.test(line) ? bullet[1] ?? "" : null;
      if (item !== null) quick.push({ subject: current?.id ?? null, id: item[1] ?? null, text: item[2] ?? "", done: TICKED.test(line) });
      else if (text !== null) {
        quick.push({ subject: current?.id ?? null, id: null, text, done: todo !== null && (todo[1] ?? " ") !== " " });
        // Fail closed: a quick line shaped like a control (`- [ ] Selection: Meeting only`) blocks; it is never skipped.
        if (controlLike(text) || mixedScript(text)) problems.push({ code: "SELECTION_UNREADABLE", id: current?.id ?? null, reason: `a control in Quick follow-ups: ${text.slice(0, 60)}` });
        continue;
      }
    }
    const subject = SUBJECT.exec(line);
    const choice = SELECTION_LINE.exec(line);
    if (item !== null) {
      lines.push(line);
      let rest = item[2] ?? "";
      let explicit: Selection | null = null;
      const token = /^(meeting only|use in brain)\s*:\s*/i.exec(rest);
      if (token !== null) { explicit = selectionOf(token[1] ?? ""); rest = rest.slice(token[0].length); }
      const waiting = /^track\s*:\s*waiting on\s*[—–-]\s*/i.exec(rest);
      if (waiting !== null) rest = rest.slice(waiting[0].length);
      const depends = DEPENDS.exec(rest);
      const dependsOn = depends === null ? [] : [...(depends[1] ?? "").matchAll(/\[([^\]]+)\]/g)].map((match) => match[1] ?? "");
      if (depends !== null) rest = rest.slice(0, depends.index).trim();
      const anchors = [...rest.matchAll(QUOTE)].map((match) => normalize(match[1] ?? ""));
      const text = normalize(rest.replace(QUOTE, ""));
      const entry = { id: item[1] ?? "", subject: current?.id ?? null, explicit, waiting_on: waiting !== null, text, anchors, depends_on: dependsOn, line };
      if (group === "quick") quickItems.push(entry);
      else { items.push(entry); lastItem = item[1] ?? null; }
      if ((token === null && looksLikeToken(rest)) || controlLike(text) || mixedScript(rest)) problems.push({ code: "SELECTION_UNREADABLE", id: item[1] ?? null, reason: `unreadable item token: ${rest.slice(0, 40)}` });
    } else if (subject !== null) {
      lines.push(line);
      current = { id: subject[1] ?? "", title: normalize(subject[2] ?? ""), selection: "use", raw: null };
      group = null;
      lastItem = null;
      subjects.push(current);
      if (controlLike(current.title) || mixedScript(current.title)) problems.push({ code: "SELECTION_UNREADABLE", id: current.id, reason: `a selection token in a subject title is not a control: ${current.title.slice(0, 40)}` });
    } else if (choice !== null && current !== null) {
      // The subject's control may follow other lines of the subject, but there is only one.
      lines.push(line);
      const value = selectionOf(choice[1] ?? "");
      if (current.raw !== null) problems.push({ code: "SELECTION_UNREADABLE", id: current.id, reason: "two Selection lines for one subject" });
      current.raw = normalize(choice[1] ?? "");
      if (value === null) problems.push({ code: "SELECTION_UNREADABLE", id: current.id, reason: `unreadable selection: ${current.raw}` });
      else current.selection = value;
    } else {
      // Anything else that looks like a control or carries an item id must block: an exclusion that is not understood is never inclusion.
      if (controlLike(line) || mixedScript(line)) problems.push({ code: "SELECTION_UNREADABLE", id: current?.id ?? null, reason: `unreadable selection control: ${line.slice(0, 60)}` });
      else if (ID_IN_LINE.test(line)) problems.push({ code: "SELECTION_UNREADABLE", id: current?.id ?? null, reason: `a line with an id that is not an item: ${line.slice(0, 60)}` });
      const bullet = /^(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
      if (bullet !== null) unnumbered.push({ subject: current?.id ?? null, text: bullet[1] ?? "" });
    }
  }
  // An item belongs to the subject its id names (`[s2.i1]` is s2's). Placed under another subject, or before its own heading, it would
  // silently take the wrong parent's selection (a block dragged in Notion), so it blocks.
  const subjectIds = new Set(subjects.map((entry) => entry.id));
  for (const entry of [...items, ...quickItems]) {
    const named = `s${/^s(\d+)\./i.exec(entry.id)?.[1] ?? "?"}`;
    if (entry.subject !== null ? named !== entry.subject : subjectIds.has(named)) problems.push({ code: "SELECTION_UNREADABLE", id: entry.id, reason: `item ${entry.id} is not under its subject ${named}` });
  }
  const seen = new Set<string>();
  for (const id of [...subjects.map((entry) => entry.id), ...items.map((entry) => entry.id), ...quickItems.map((entry) => entry.id)]) {
    if (seen.has(id)) problems.push({ code: "SELECTION_UNMAPPABLE", id, reason: "duplicate id" });
    seen.add(id);
  }
  return { subjects, items, problems, lines, unnumbered, quick, quickItems, scopes };
}

/** A calendar date written `YYYY-MM-DD` that exists (2026-02-30 does not). */
function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Numbers the transcript paragraphs from ¶1 (§4.2); blank lines separate them. */
export function paragraphs(transcript: string): { paragraphs: Paragraph[]; transcript_hash: string } {
  const list = transcript.split(/\n\s*\n/).map((raw) => raw.replace(/^\s+|\s+$/g, "")).filter((raw) => raw !== "")
    .map((raw, index) => { const text = normalize(raw); return { n: index + 1, text, raw, hash: sha(text).slice(0, 8) }; });
  return { paragraphs: list, transcript_hash: sha(list.map((entry) => entry.text).join("\n\n")) };
}

export interface Mapping {
  item: string; effective: Selection; explicit: Selection | null;
  passages: number[]; imported: boolean; context_excluded: boolean;
}

export interface Quote { item: string; anchor: string | null; result: "shortened" | "unplaced"; stretches?: string[]; reason: string }

/** The paragraphs that hold an anchor's longest stretches of 6 to 12 words found in exactly one paragraph, then the same on the words left on
 *  each side (§4.2 rule 2), so a quote joining two sentences is placed in both. */
function stretches(words: string[], paras: Paragraph[]): { text: string; n: number }[] {
  for (let length = Math.min(12, words.length); length >= 6; length -= 1) {
    for (let start = 0; start + length <= words.length; start += 1) {
      const text = words.slice(start, start + length).join(" ");
      const hits = paras.filter((entry) => entry.text.includes(text));
      if (hits.length === 1) return [...stretches(words.slice(0, start), paras), { text, n: hits[0]!.n }, ...stretches(words.slice(start + length), paras)];
    }
  }
  return [];
}

export interface Plan {
  mappings: Mapping[];
  copied: { n: number; text: string; hash: string; items: string[] }[];
  uncovered: number;
  problems: Problem[];
  unnumbered: Unnumbered[];
  /** An included item's quotes placed by a stretch or not placed (decision 0067, §4.2 rules 2 and 3): reported, never a blocker. */
  quotes: Quote[];
  /** Included items with no placed quote: not imported. */
  unplaced_items: string[];
  quick: Quick[];
  scopes: Scope[];
  /** True when nothing blocks the input; otherwise no extract may be written (never a full-transcript fallback). */
  ok: boolean;
}

/** Effective selection (§4.3): the item's token, else its subject's, else use. */
function effectiveOf(item: Item, subjects: Map<string, Subject>): Selection {
  return item.explicit ?? (item.subject === null ? "use" : subjects.get(item.subject)?.selection ?? "use");
}

/** Maps anchors to paragraphs, applies the fail-closed copy rule of §4.2 and the shared-context rule of §4.7. */
export function planExtract(summary: Summary, transcript: string): Plan {
  const { paragraphs: paras } = paragraphs(transcript);
  const problems = [...summary.problems];
  // An unnumbered line can be neither selected nor excluded and has no anchors, so it could leak through a shared paragraph: it blocks the input (§4.2).
  for (const line of summary.unnumbered) problems.push({ code: "UNNUMBERED_LINE", id: null, reason: `list line without an id: ${line.text.slice(0, 80)}` });
  const subjects = new Map(summary.subjects.map((entry) => [entry.id, entry]));
  const byId = new Map(summary.items.map((entry) => [entry.id, entry]));
  // A quick line stays in Notion, outside the brain: depending on it is depending on excluded context (decision 0067, §4.7). One whose
  // effective selection is `meeting only` is read as an excluded item, so its paragraphs stay out (fail closed).
  const quickIds = new Set(summary.quickItems.map((entry) => entry.id));
  const all = [...summary.items, ...summary.quickItems.filter((entry) => effectiveOf(entry, subjects) === "meeting only")];
  for (const entry of all) byId.set(entry.id, entry);
  const passages = new Map<string, number[]>();
  const broken = new Set<string>();
  const quotes: Quote[] = [];
  const unplaced: string[] = [];
  for (const item of all) {
    const found: number[] = [];
    // Decision 0067: a quote problem blocks only an excluded item, whose paragraphs must be known to keep them out (§4.2 rule 4).
    const included = effectiveOf(item, subjects) === "use";
    if (item.anchors.length === 0) {
      if (included) quotes.push({ item: item.id, anchor: null, result: "unplaced", reason: "no quote" });
      else { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: "no anchor" }); }
    }
    for (const anchor of item.anchors) {
      const hits = paras.filter((entry) => entry.text.includes(anchor));
      if (hits.length === 1) { found.push(hits[0]?.n ?? 0); continue; }
      if (!included) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: hits.length === 0 ? `anchor not in the transcript: ${anchor}` : `anchor in ${hits.length} paragraphs: ${anchor}` }); continue; }
      const parts = hits.length === 0 ? stretches(anchor.split(" "), paras) : [];
      if (parts.length > 0) { found.push(...parts.map((part) => part.n)); quotes.push({ item: item.id, anchor, result: "shortened", stretches: parts.map((part) => part.text), reason: "not found word for word" }); }
      else quotes.push({ item: item.id, anchor, result: "unplaced", reason: hits.length === 0 ? "not in the transcript" : `in ${hits.length} paragraphs` });
    }
    if (included && found.length === 0) unplaced.push(item.id);
    passages.set(item.id, [...new Set(found)].sort((a, b) => a - b));
    for (const target of item.depends_on) {
      if (!byId.has(target) && !subjects.has(target) && !quickIds.has(target)) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: `depends on unknown id ${target}` }); }
    }
  }
  for (const item of all) { // a cycle among items makes the items concerned unmappable
    const path = new Set<string>();
    const walk = (id: string): boolean => {
      if (path.has(id)) return true;
      const node = byId.get(id);
      if (node === undefined) return false;
      path.add(id);
      const cyclic = node.depends_on.some(walk);
      path.delete(id);
      return cyclic;
    };
    if (walk(item.id) && !broken.has(item.id)) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: "depends on cycle" }); }
  }
  const effective = (id: string): Selection => {
    const item = byId.get(id);
    return item !== undefined ? effectiveOf(item, subjects) : subjects.get(id)?.selection ?? "use";
  };
  const mappings: Mapping[] = all.map((item) => {
    const effectiveSel = effectiveOf(item, subjects);
    // Context is excluded when a dependency is excluded, or itself depends (however far back) on excluded context (§4.7, fail closed).
    const reaches = (target: string, seen: Set<string>): boolean => {
      if (seen.has(target)) return false;
      seen.add(target);
      if (quickIds.has(target)) return true;
      if (!(byId.has(target) || subjects.has(target))) return false;
      return effective(target) === "meeting only" || (byId.get(target)?.depends_on ?? []).some((next) => reaches(next, seen));
    };
    const excludedContext = item.depends_on.filter((target) => reaches(target, new Set([item.id])));
    let imported = effectiveSel === "use" && !unplaced.includes(item.id); // an included item with no placed quote has no passage (§4.2 rule 3)
    let contextExcluded = false;
    if (imported && excludedContext.length > 0) {
      if (item.explicit === "use") contextExcluded = true;
      else { imported = false; problems.push({ code: "DEPENDS_ON_EXCLUDED", id: item.id, reason: "depends on excluded context", with: excludedContext }); }
    }
    return { item: item.id, effective: effectiveSel, explicit: item.explicit, passages: passages.get(item.id) ?? [], imported, context_excluded: contextExcluded };
  });
  const citers = new Map<number, Mapping[]>();
  for (const mapping of mappings) for (const n of mapping.passages) citers.set(n, [...(citers.get(n) ?? []), mapping]);
  const copied: Plan["copied"] = [];
  for (const entry of paras) {
    const list = citers.get(entry.n) ?? [];
    if (list.length === 0) continue;
    const useful = list.filter((mapping) => mapping.imported);
    if (useful.length > 0 && /<!--\s*passage\b/i.test(entry.raw)) {
      // The extract format reserves this marker: a paragraph that contains it cannot be stored faithfully, so its items block (never altered or guessed).
      for (const mapping of useful) { broken.add(mapping.item); problems.push({ code: "SELECTION_UNMAPPABLE", id: mapping.item, reason: `¶${entry.n} contains the reserved text "<!-- passage"` }); }
    } else if (useful.length === list.length) copied.push({ n: entry.n, text: entry.raw, hash: entry.hash, items: list.map((mapping) => mapping.item) });
    else if (useful.length > 0) { // fail closed: a paragraph shared with excluded content is not copied
      const excluded = list.filter((mapping) => !mapping.imported).map((mapping) => mapping.item);
      for (const mapping of useful) {
        broken.add(mapping.item);
        problems.push({ code: "SELECTION_UNMAPPABLE", id: mapping.item, reason: "shares a paragraph with excluded content", with: excluded });
      }
    }
  }
  const covered = new Set(citers.keys());
  const ok = problems.every((problem) => problem.code === "DEPENDS_ON_EXCLUDED");
  return { mappings, copied: ok ? copied : copied.filter((entry) => entry.items.every((id) => !broken.has(id))), uncovered: paras.filter((entry) => !covered.has(entry.n)).length, problems, unnumbered: summary.unnumbered, quotes, unplaced_items: unplaced, quick: summary.quick, scopes: summary.scopes, ok };
}

/** The extract body: only the selected paragraphs, in transcript order, each marked (§4.5). */
export function extractBody(plan: Plan): string {
  return plan.copied.map((entry) => `<!-- passage ¶${entry.n} item ${entry.items.join(",")} -->\n${entry.text}`).join("\n\n") + "\n";
}
