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
export interface Summary { subjects: Subject[]; items: Item[]; problems: Problem[]; lines: string[]; unnumbered: Unnumbered[] }
/** `text` is whitespace-normalized (for matching and hashing); `raw` is the paragraph as written, which is what an extract stores and a preview shows. */
export interface Paragraph { n: number; text: string; raw: string; hash: string }

const SUBJECT = /^(?:#{1,6}\s*)?\[(s\d+)\]\s*(.*)$/;
const ITEM = /^(?:[-*+]\s+|\d+[.)]\s+)?\[(s\d+\.i\d+)\]\s*(.*)$/;
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
  let current: Subject | null = null;
  // NFKC folds full-width forms; zero-width and format characters inside words are removed; the §4.4 notice (with an icon, in a callout, or
  // wrapped over lines) is not a control.
  const cleaned = markdown.normalize("NFKC").replace(/[\p{Cf}\u00ad]/gu, "").replace(NOTICE_TEXT, "");
  for (const rawLine of cleaned.split("\n")) {
    // Blockquote markers, emphasis around the whole line and HTML-escaped `>` are formatting, not content.
    const line = normalize(rawLine.replace(/&gt;/g, ">").replace(/\*\*/g, "")).replace(/^(?:>\s*)+/, "").replace(/^[_*]+\s*|\s*[_*]+$/g, "").trim();
    if (line === "" || /^[^\p{L}\p{N}\[]*$/u.test(line)) continue; // empty, or only an icon / rule left of the notice
    const subject = SUBJECT.exec(line);
    const item = ITEM.exec(line);
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
      items.push({ id: item[1] ?? "", subject: current?.id ?? null, explicit, waiting_on: waiting !== null, text, anchors, depends_on: dependsOn, line });
      if ((token === null && looksLikeToken(rest)) || controlLike(text) || mixedScript(rest)) problems.push({ code: "SELECTION_UNREADABLE", id: item[1] ?? null, reason: `unreadable item token: ${rest.slice(0, 40)}` });
    } else if (subject !== null) {
      lines.push(line);
      current = { id: subject[1] ?? "", title: normalize(subject[2] ?? ""), selection: "use", raw: null };
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
  for (const entry of items) {
    const named = `s${/^s(\d+)\./i.exec(entry.id)?.[1] ?? "?"}`;
    if (entry.subject !== null ? named !== entry.subject : subjectIds.has(named)) problems.push({ code: "SELECTION_UNREADABLE", id: entry.id, reason: `item ${entry.id} is not under its subject ${named}` });
  }
  const seen = new Set<string>();
  for (const id of [...subjects.map((entry) => entry.id), ...items.map((entry) => entry.id)]) {
    if (seen.has(id)) problems.push({ code: "SELECTION_UNMAPPABLE", id, reason: "duplicate id" });
    seen.add(id);
  }
  return { subjects, items, problems, lines, unnumbered };
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

export interface Plan {
  mappings: Mapping[];
  copied: { n: number; text: string; hash: string; items: string[] }[];
  uncovered: number;
  problems: Problem[];
  unnumbered: Unnumbered[];
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
  const passages = new Map<string, number[]>();
  const broken = new Set<string>();
  for (const item of summary.items) {
    const found: number[] = [];
    if (item.anchors.length === 0) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: "no anchor" }); }
    if (item.anchors.length > 3) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: `${item.anchors.length} anchors: one to three allowed` }); }
    for (const anchor of item.anchors) if (anchor.split(" ").length > 12) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: `anchor longer than 12 words: ${anchor.slice(0, 40)}…` }); }
    for (const anchor of item.anchors) {
      const hits = paras.filter((entry) => entry.text.includes(anchor));
      if (hits.length === 1) found.push(hits[0]?.n ?? 0);
      else { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: hits.length === 0 ? `anchor not in the transcript: ${anchor}` : `anchor in ${hits.length} paragraphs: ${anchor}` }); }
    }
    passages.set(item.id, [...new Set(found)].sort((a, b) => a - b));
    for (const target of item.depends_on) {
      if (!byId.has(target) && !subjects.has(target)) { broken.add(item.id); problems.push({ code: "SELECTION_UNMAPPABLE", id: item.id, reason: `depends on unknown id ${target}` }); }
    }
  }
  for (const item of summary.items) { // a cycle among items makes the items concerned unmappable
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
  const mappings: Mapping[] = summary.items.map((item) => {
    const effectiveSel = effectiveOf(item, subjects);
    // Context is excluded when a dependency is excluded, or itself depends (however far back) on excluded context (§4.7, fail closed).
    const reaches = (target: string, seen: Set<string>): boolean => {
      if (seen.has(target)) return false;
      seen.add(target);
      if (!(byId.has(target) || subjects.has(target))) return false;
      return effective(target) === "meeting only" || (byId.get(target)?.depends_on ?? []).some((next) => reaches(next, seen));
    };
    const excludedContext = item.depends_on.filter((target) => reaches(target, new Set([item.id])));
    let imported = effectiveSel === "use";
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
  return { mappings, copied: ok ? copied : copied.filter((entry) => entry.items.every((id) => !broken.has(id))), uncovered: paras.filter((entry) => !covered.has(entry.n)).length, problems, unnumbered: summary.unnumbered, ok };
}

/** The extract body: only the selected paragraphs, in transcript order, each marked (§4.5). */
export function extractBody(plan: Plan): string {
  return plan.copied.map((entry) => `<!-- passage ¶${entry.n} item ${entry.items.join(",")} -->\n${entry.text}`).join("\n\n") + "\n";
}
