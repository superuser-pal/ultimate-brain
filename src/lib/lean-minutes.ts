import {
  controlLike, DEPENDS, foldLine, LIST, looksLikeToken, mixedScript, normalize, parseSummary, QUOTE, ScopeToggles, SCOPE_FIELD, SECTION,
  SELECTION_LINE, selectionOf, summaryLines, TICKED, TODO,
  type Item, type LeanItem, type Problem, type Quick, type Scope, type Selection, type Subject, type Summary, type Unnumbered,
} from "./selection.ts";

// The lean minutes shape (decision 0079, capture-and-review §3.3 and §4.1 "Shapes", "The lean shape"): a readable part with one line per
// item, and a For the brain toggle with the Selection lines and the id → quote list. Pure functions: no I/O.

/** `For the brain`, once heading marks, emphasis and a trailing colon are removed (case ignored). */
function forTheBrain(text: string): boolean {
  return normalize(text.replace(/^#{1,6}\s*/, "").replace(/[*_`]/g, "")).replace(/\s*:$/, "").toLowerCase() === "for the brain";
}

const SUMMARY_TAG = /^<summary>\s*(.*?)\s*<\/summary>$/i;
const GROUP = /^#{0,6}\s*(quick follow[- ]?ups|tasks for the brain|tasks)\s*(?:\([^)]*\))?\s*:?$/i;
const IN_ONE_LINE = /^#{0,6}\s*in one line\s*:/i;
const MARKER = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
const TOKEN = /^(meeting only|use in brain)\s*:\s*/i;
const TRACK = /^track\s*:\s*waiting on\s*[—–-]\s*/i;
const PREFIX = /^(decided|open|concern|idea|waiting on\b([^:]*))\s*:/i;
const ATTENDEES = /^(?:[-*+]\s+)?(?:attendees|projects)\s*:/i;

/** Emphasis or inline-code marks directly around an id tag are formatting (`` `[s2.i3]` ``, `*[q1]*`). */
function unwrapTags(text: string): string {
  return text.replace(/[`*_]*(\[(?:s\d+(?:\.i\d+)?|q\d+)\])[`*_]*/gi, "$1");
}

type Tag = { kind: "none" } | { kind: "misplaced" } | { kind: "subject" | "item"; id: string; rest: string };

/** A line's one subject or item tag, read at the start or the end of its text; a second one, or one in the middle, is misplaced. */
function tagOf(input: string): Tag {
  const text = unwrapTags(input).trim();
  const tags = [...text.matchAll(/\[(s\d+(?:\.i\d+)?)\]/gi)];
  if (tags.length === 0) return { kind: "none" };
  const tag = tags[0]!;
  if (tags.length > 1) return { kind: "misplaced" };
  const at = tag.index ?? 0;
  const id = (tag[1] ?? "").toLowerCase();
  const kind = id.includes(".") ? "item" : "subject";
  if (at === 0) return { kind, id, rest: text.slice(tag[0].length).trim() };
  if (at + tag[0].length === text.length) return { kind, id, rest: text.slice(0, at).trim() };
  return { kind: "misplaced" };
}

/** A follow-up tag `[q1]` at the start or the end of a to-do's text (read case-insensitively, reported in lower case). */
function followUpOf(input: string): { id: string | null; text: string } {
  const text = unwrapTags(input).trim();
  const lead = /^\[(q\d+)\]\s*/i.exec(text);
  if (lead !== null) return { id: (lead[1] ?? "").toLowerCase(), text: text.slice(lead[0].length).trim() };
  const tail = /\s*\[(q\d+)\]$/i.exec(text);
  if (tail !== null) return { id: (tail[1] ?? "").toLowerCase(), text: text.slice(0, tail.index).trim() };
  return { id: null, text };
}

const subjectOfId = (id: string): string => `s${/^s(\d+)\./i.exec(id)?.[1] ?? "?"}`;

/** Whether a summary is in the lean shape: it holds a For the brain toggle, or a line that reads `For the brain` (§4.1, "Shapes"). */
export function isLean(markdown: string): boolean {
  return summaryLines(markdown).some((raw) => {
    const line = foldLine(raw);
    if (line === null) return false;
    const tag = SUMMARY_TAG.exec(line);
    return forTheBrain(tag === null ? line.replace(/[*_]/g, "") : tag[1] ?? "");
  });
}

/** Reads a summary in its shape: the lean shape by "The lean shape", any other exactly as before 0.14.0 (§4.1, "Shapes"). */
export function readSummary(markdown: string): Summary {
  return isLean(markdown) ? parseLean(markdown) : parseSummary(markdown);
}

interface QuoteEntry { explicit: Selection | null; anchors: string[]; depends_on: string[] }

/** Reads lean minutes: the readable part, the For the brain toggle, and the join of each readable line to its quote entry by id. */
export function parseLean(markdown: string): Summary {
  const subjects: Subject[] = [];
  const problems: Problem[] = [];
  const lines: string[] = [];
  const unnumbered: Unnumbered[] = [];
  const quick: Quick[] = [];
  const scopes: Scope[] = [];
  const quickItems: Item[] = [];
  const readable: (LeanItem & { line: string })[] = [];
  const entries = new Map<string, QuoteEntry>();
  const selections = new Map<string, string>(); // subject id → the raw value of its Selection line
  const unreadable = (id: string | null, reason: string) => problems.push({ code: "SELECTION_UNREADABLE", id, reason });

  const rawLines = summaryLines(markdown);
  const folded = rawLines.map(foldLine);
  // The For the brain toggle: the first toggle whose summary reads `For the brain`, to its closing tag (or the end of the summary).
  const summaries = folded.flatMap((line, index) => { const tag = line === null ? null : SUMMARY_TAG.exec(line); return tag !== null && forTheBrain(tag[1] ?? "") ? [index] : []; });
  const first = summaries[0] ?? -1;
  let start = first;
  let end = folded.length;
  if (first >= 0) {
    for (let index = first - 1; index >= 0; index -= 1) {
      if (folded[index] === null) continue;
      if (/^<details>$/i.test(folded[index]!)) start = index;
      break;
    }
    for (let index = first + 1; index < folded.length; index += 1) if (folded[index] !== null && /^<\/details>$/i.test(folded[index]!)) { end = index; break; }
  }

  // The readable part.
  const toggles = new ScopeToggles(rawLines, scopes, problems);
  let group: "quick" | "tasks" | null = null;
  let block: Subject | null = null;
  let lastItem: string | null = null;
  const subjectHeading = (line: string): Tag => (LIST.test(line) ? { kind: "none" } : tagOf(line.replace(/^#{1,6}\s*/, "")));
  const itemLine = (line: string): boolean => !line.startsWith("#") && tagOf(line.replace(MARKER, "")).kind === "item";
  const selectionLine = (line: string): boolean => {
    const tag = subjectHeading(line);
    return SELECTION_LINE.test(line) || (tag.kind === "subject" && /^selection\s*:/i.test(tag.rest));
  };
  for (const [index, foldedLine] of folded.entries()) {
    if (foldedLine === null) continue;
    if (index >= start && start >= 0 && index <= end) {
      if (index === start) { toggles.reset(); group = null; block = null; lastItem = null; }
      if (index > first && index < end) readToggleLine(foldedLine);
      continue;
    }
    if (summaries.includes(index)) { unreadable(null, "a second For the brain toggle: only the first is read"); continue; }
    const line = toggles.read(index, foldedLine, {
      lastItem, quick: group === "quick", subject: block?.id ?? null,
      ends: (text) => text.startsWith("#") || subjectHeading(text).kind === "subject" || selectionLine(text),
      endsUnclosed: (text, bare) => itemLine(text) || GROUP.test(bare) || SECTION.test(bare) || IN_ONE_LINE.test(bare) || (LIST.test(text) && !SCOPE_FIELD.test(text)),
      isItem: itemLine,
    });
    if (line === null) continue;
    const bare = line.replace(/[*_]/g, "").trim();
    if (IN_ONE_LINE.test(bare)) { group = null; block = null; lastItem = null; continue; } // not an item, never imported
    if (forTheBrain(bare)) { unreadable(null, `a For the brain line outside a toggle: only the toggle is read: ${line.slice(0, 60)}`); continue; }
    const groupLine = GROUP.exec(bare);
    if (groupLine !== null) { group = /^quick/i.test(groupLine[1] ?? "") ? "quick" : "tasks"; block = null; lastItem = null; continue; }
    if (selectionLine(line)) { unreadable(block?.id ?? null, `a Selection line outside the For the brain toggle: ${line.slice(0, 60)}`); continue; }
    const heading = subjectHeading(line);
    if (heading.kind === "subject") {
      lines.push(line);
      block = { id: heading.id, title: normalize(heading.rest), selection: "use", raw: null };
      subjects.push(block);
      group = null;
      lastItem = null;
      if (controlLike(block.title) || mixedScript(block.title)) unreadable(block.id, `a selection token in a subject title is not a control: ${block.title.slice(0, 40)}`);
      continue;
    }
    if (line.startsWith("#") || SECTION.test(bare)) { group = null; lastItem = null; }
    if (line.startsWith("#")) {
      // A heading without a tag is not read; one with an id is not an item.
      if (heading.kind !== "none") unreadable(block?.id ?? null, `a line with an id that is not an item: ${line.slice(0, 60)}`);
      continue;
    }
    const tag = tagOf(line.replace(MARKER, ""));
    if (group === "quick" && LIST.test(line)) { readQuick(line, tag); continue; }
    if (group === "tasks" || (group === null && block !== null)) {
      if (tag.kind === "item") { readItem(line, tag.id, tag.rest); continue; }
      if (tag.kind !== "none") { unreadable(block?.id ?? null, `a line with an id that is not an item: ${line.slice(0, 60)}`); continue; }
      if (controlLike(line) || mixedScript(line)) { unreadable(block?.id ?? null, `unreadable selection control: ${line.slice(0, 60)}`); continue; }
      // Every other line of a block or of Tasks for the brain is an unnumbered line: a readable line whose tag was lost blocks.
      unnumbered.push({ subject: block?.id ?? null, text: line.replace(/^(?:[-*+]|\d+[.)])\s+/, "") });
      continue;
    }
    // Elsewhere: outside every group and block.
    if (tag.kind !== "none") unreadable(null, `a line with an id that is not an item: ${line.slice(0, 60)}`);
    else if (controlLike(line) || mixedScript(line)) unreadable(null, `unreadable selection control: ${line.slice(0, 60)}`);
    else if (LIST.test(line)) unnumbered.push({ subject: null, text: line.replace(/^(?:[-*+]|\d+[.)])\s+/, "") });
  }

  /** A list line of a Quick follow-ups group: a follow-up (a to-do with a `q` tag), a quick line, or a quick line read like an item. */
  function readQuick(line: string, tag: Tag): void {
    const todo = TODO.exec(line);
    const done = todo !== null && (todo[1] ?? " ") !== " ";
    if (tag.kind === "item") {
      // Fail closed, as in the inline-quote shape: read like an item, so an excluded one keeps its paragraphs out.
      quick.push({ subject: null, id: tag.id, text: tag.rest, done: TICKED.test(line), follow_up: null, task: false, recorded: null });
      const named = subjectOfId(tag.id);
      quickItems.push({ id: tag.id, subject: named === "s0" ? null : named, explicit: null, waiting_on: false, text: tag.rest, anchors: [], depends_on: [], line });
      checkControls(tag.id, tag.rest.replace(TRACK, ""));
      return;
    }
    if (tag.kind !== "none") { unreadable(null, `a line with an id that is not an item: ${line.slice(0, 60)}`); return; }
    if (SELECTION_LINE.test(line)) { unreadable(null, `a Selection line outside the For the brain toggle: ${line.slice(0, 60)}`); return; }
    const rest = line.replace(/^(?:[-*+]|\d+[.)])\s+/, "");
    const followUp = todo !== null ? followUpOf(todo[2] ?? "") : { id: null, text: rest };
    quick.push({ subject: null, id: null, text: followUp.text, done, follow_up: followUp.id, task: false, recorded: null });
    if (controlLike(followUp.text) || mixedScript(followUp.text)) unreadable(null, `a control in Quick follow-ups: ${followUp.text.slice(0, 60)}`);
  }

  /** The control checks of an item line's text after its Track token (§4.3): a selection token belongs in the toggle. Returns its prefix. */
  function checkControls(id: string, rest: string): RegExpExecArray | null {
    const prefix = PREFIX.exec(rest.replace(/^[*_]+/, "").replace(/^([^:]*?)[*_]+:/, "$1:"));
    if (TOKEN.test(rest) || (prefix === null && looksLikeToken(rest))) unreadable(id, `a selection token on a readable line: it is marked in the For the brain toggle: ${rest.slice(0, 40)}`);
    else if (controlLike(rest) || mixedScript(rest)) unreadable(id, `unreadable item token: ${rest.slice(0, 40)}`);
    return prefix;
  }

  /** A readable item line: its marker, Track token, prefix and tag (§4.1, "The readable part"). */
  function readItem(line: string, id: string, withoutTag: string): void {
    lines.push(line);
    let rest = withoutTag;
    const track = TRACK.exec(rest);
    if (track !== null) rest = rest.slice(track[0].length);
    const prefix = checkControls(id, rest);
    const word = (prefix?.[1] ?? "").toLowerCase();
    const kind = prefix === null ? null : word.startsWith("waiting on") ? "waiting_on" : (word as LeanItem["prefix"]);
    const name = kind === "waiting_on" ? normalize((prefix?.[2] ?? "").replace(/[*_]/g, "")) || null : null;
    const named = subjectOfId(id);
    const place = group === "tasks" ? "tasks" : "subject";
    if (place === "subject" && named !== block?.id) unreadable(id, `item ${id} is not under its subject ${named}`);
    readable.push({ id, subject: named === "s0" ? null : named, place, prefix: kind, name, track: track !== null, text: normalize(rest), anchors: [], depends_on: [], line });
    lastItem = id;
  }

  /** A line of the For the brain toggle: a Selection line, a quote entry, or a line that is not read (§4.1, "The For the brain toggle"). */
  function readToggleLine(line: string): void {
    if (/^<details>/i.test(line)) { unreadable(null, "a toggle inside the For the brain toggle"); return; }
    if (SUMMARY_TAG.test(line) || /^<\/details>$/i.test(line)) return;
    const bare = line.replace(/[*_]/g, "").trim();
    if (forTheBrain(bare)) { unreadable(null, `a For the brain line that is not the toggle's summary: ${line.slice(0, 60)}`); return; }
    if (ATTENDEES.test(bare)) return; // read by the ingest skill, not the CLI
    const body = unwrapTags(line.replace(/^(?:[-*+]|\d+[.)])\s+/, ""));
    const choice = /^\[(s\d+)\]\s*selection\s*:\s*(.*)$/i.exec(body);
    if (choice !== null) {
      const id = (choice[1] ?? "").toLowerCase();
      const raw = normalize(choice[2] ?? "");
      if (selections.has(id)) unreadable(id, "two Selection lines for one subject");
      else selections.set(id, raw);
      if (selectionOf(raw) === null) unreadable(id, `unreadable selection: ${raw}`);
      return;
    }
    const entry = /^(?:(meeting only|use in brain)\s*:\s*)?\[(s\d+\.i\d+)\]\s*(?:→|->|—|–|:)?\s*(.*)$/i.exec(body);
    if (entry === null) {
      if (controlLike(body) || mixedScript(body)) unreadable(null, `unreadable selection control: ${line.slice(0, 60)}`);
      else if (/\[s\d+(?:\.i\d+)?\]/i.test(body)) unreadable(null, `a line with an id that is not an item: ${line.slice(0, 60)}`);
      return;
    }
    const id = (entry[2] ?? "").toLowerCase();
    let rest = entry[3] ?? "";
    const after = TOKEN.exec(rest);
    if (after !== null) rest = rest.slice(after[0].length);
    const depends = DEPENDS.exec(rest);
    const dependsOn = depends === null ? [] : [...(depends[1] ?? "").matchAll(/\[([^\]]+)\]/g)].map((match) => (match[1] ?? "").toLowerCase());
    if (depends !== null) rest = rest.slice(0, depends.index).trim();
    const other = normalize(rest.replace(QUOTE, " "));
    if (entry[1] !== undefined && after !== null) unreadable(id, "a selection token both before and after the id of a quote entry");
    else if ((after === null && looksLikeToken(rest)) || controlLike(other) || mixedScript(rest)) unreadable(id, `unreadable item token in a quote entry: ${rest.slice(0, 40)}`);
    if (entries.has(id)) { problems.push({ code: "SELECTION_UNMAPPABLE", id, reason: "duplicate quote entry" }); return; }
    const token = entry[1] ?? after?.[1];
    entries.set(id, { explicit: token === undefined ? null : selectionOf(token), anchors: [...rest.matchAll(QUOTE)].map((match) => normalize(match[1] ?? "")), depends_on: dependsOn });
  }

  // Selection lines name subjects of the page; a subject with none is `use`.
  const subjectIds = new Set(subjects.map((entry) => entry.id));
  for (const [id, raw] of selections) {
    const subject = subjects.find((entry) => entry.id === id);
    if (subject === undefined) { unreadable(id, `a Selection line naming no subject heading of the page: [${id}]`); continue; }
    subject.raw = raw;
    subject.selection = selectionOf(raw) ?? "use";
  }
  // A Tasks for the brain line may name any subject of the page, or s0.
  for (const item of readable) {
    const named = subjectOfId(item.id);
    if (item.place === "tasks" && named !== "s0" && !subjectIds.has(named)) unreadable(item.id, `item ${item.id} names no subject heading of the page`);
  }
  // A quick line with an item tag sits outside its subject's block (fail closed, as in the inline-quote shape).
  for (const item of quickItems) if (item.subject !== null && subjectIds.has(item.subject)) unreadable(item.id, `item ${item.id} is not under its subject ${item.subject}`);

  // The join: each readable line (and each quick line read like an item) takes its anchors, explicit selection and dependencies from its entry.
  const joined = new Set<string>();
  const items: Item[] = readable.map((item) => {
    const entry = entries.get(item.id);
    joined.add(item.id);
    if (entry === undefined) problems.push({ code: "NO_QUOTE_ENTRY", id: item.id, reason: "a readable line with no quote entry" });
    else { item.anchors = entry.anchors; item.depends_on = entry.depends_on; }
    return { id: item.id, subject: item.subject, explicit: entry?.explicit ?? null, waiting_on: item.track, text: item.text, anchors: item.anchors, depends_on: item.depends_on, line: item.line };
  });
  for (const item of quickItems) {
    const entry = entries.get(item.id);
    joined.add(item.id);
    if (entry !== undefined) Object.assign(item, { explicit: entry.explicit, anchors: entry.anchors, depends_on: entry.depends_on });
  }
  const orphans: Item[] = [];
  for (const [id, entry] of entries) {
    if (joined.has(id)) continue;
    problems.push({ code: "ORPHAN_QUOTE_ENTRY", id, reason: "a quote entry with no readable line" });
    const named = subjectOfId(id);
    orphans.push({ id, subject: named === "s0" ? null : named, explicit: entry.explicit, waiting_on: false, text: "", anchors: entry.anchors, depends_on: entry.depends_on, line: "" });
  }

  const seen = new Set<string>();
  for (const id of [...subjects.map((entry) => entry.id), ...items.map((entry) => entry.id), ...quickItems.map((entry) => entry.id)]) {
    if (seen.has(id)) problems.push({ code: "SELECTION_UNMAPPABLE", id, reason: "duplicate id" });
    seen.add(id);
  }

  // Follow-ups (§6.3): an unticked one with text and a `q` id on no other to-do becomes a Task input; whether its Task is already recorded is
  // the caller's (it needs the replaces chain).
  const counts = new Map<string, number>();
  for (const entry of quick) if (entry.follow_up) counts.set(entry.follow_up, (counts.get(entry.follow_up) ?? 0) + 1);
  for (const [id, count] of counts) if (count > 1) problems.push({ code: "DUPLICATE_FOLLOW_UP", id, reason: `${id} is on two to-dos: neither becomes a Task` });
  for (const entry of quick) entry.task = entry.follow_up != null && !entry.done && entry.text !== "" && counts.get(entry.follow_up) === 1;

  return {
    subjects, items, problems, lines, unnumbered, quick, quickItems, scopes, shape: "lean",
    readable: readable.map(({ line: _line, ...item }) => item), orphans,
  };
}
