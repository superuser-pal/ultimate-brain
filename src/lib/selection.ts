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
export interface Paragraph { n: number; text: string; hash: string }

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

/** Reads the summary text: subject headings, `Selection:` lines and item lines (§4.1, §4.3). Bullets and straight quotes are tolerated (T2, T6). */
export function parseSummary(markdown: string): Summary {
  const subjects: Subject[] = [];
  const items: Item[] = [];
  const problems: Problem[] = [];
  const lines: string[] = [];
  const unnumbered: Unnumbered[] = [];
  let current: Subject | null = null;
  let heading = false;
  for (const rawLine of markdown.split("\n")) {
    const line = normalize(rawLine.replace(/\*\*/g, ""));
    if (line === "") continue;
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
      if (token === null && /^(meeting|use)[a-z ]*:/i.test(rest)) problems.push({ code: "SELECTION_UNREADABLE", id: item[1] ?? null, reason: `unreadable item token: ${rest.slice(0, 40)}` });
    } else if (subject !== null) {
      lines.push(line);
      current = { id: subject[1] ?? "", title: normalize(subject[2] ?? ""), selection: "use", raw: null };
      subjects.push(current);
      heading = true;
    } else if (choice !== null && current !== null && heading) {
      lines.push(line);
      const value = selectionOf(choice[1] ?? "");
      current.raw = normalize(choice[1] ?? "");
      if (value === null) problems.push({ code: "SELECTION_UNREADABLE", id: current.id, reason: `unreadable selection: ${current.raw}` });
      else current.selection = value;
      heading = false;
    } else {
      heading = false;
      const bullet = /^(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
      if (bullet !== null) unnumbered.push({ subject: current?.id ?? null, text: bullet[1] ?? "" });
    }
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
  const list = transcript.split(/\n\s*\n/).map(normalize).filter((text) => text !== "")
    .map((text, index) => ({ n: index + 1, text, hash: sha(text).slice(0, 8) }));
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
    const excludedContext = item.depends_on.filter((target) => (byId.has(target) || subjects.has(target)) && effective(target) === "meeting only");
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
    if (useful.length === list.length) copied.push({ n: entry.n, text: entry.text, hash: entry.hash, items: list.map((mapping) => mapping.item) });
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

/** sha256 of the mapping-relevant page text plus the transcript hash (§4.8). */
export function pageFingerprint(summary: Summary, transcriptHash: string): string {
  return sha(`${summary.lines.join("\n")}\n${transcriptHash}`);
}

export type Drift =
  | { kind: "none" }
  | { kind: "stale"; reason: string }
  | { kind: "text" }
  | { kind: "tokens"; changes: { id: string; from: Selection; to: Selection }[] };

/** Classifies a re-read page against the one stored in the latest extract (§4.8 steps 1, 1b, 2, 3). */
export function classifyDrift(before: Summary, after: Summary, beforeHash: string, afterHash: string): Drift {
  if (beforeHash !== afterHash) return { kind: "stale", reason: "transcript_hash differs" };
  const shape = (summary: Summary) => JSON.stringify({
    subjects: summary.subjects.map((entry) => entry.id),
    items: summary.items.map((entry) => [entry.id, entry.subject, entry.anchors, entry.depends_on, entry.waiting_on]),
  });
  if (shape(before) !== shape(after)) return { kind: "stale", reason: "an id, anchor or dependency differs" };
  const bs = new Map(before.subjects.map((entry) => [entry.id, entry]));
  const as = new Map(after.subjects.map((entry) => [entry.id, entry]));
  const bi = new Map(before.items.map((entry) => [entry.id, entry]));
  const changes: { id: string; from: Selection; to: Selection }[] = [];
  for (const subject of after.subjects) {
    const from = bs.get(subject.id)?.selection ?? "use";
    if (from !== subject.selection) changes.push({ id: subject.id, from, to: subject.selection });
  }
  for (const item of after.items) {
    const from = bi.get(item.id)?.explicit ?? null;
    if (from !== item.explicit) changes.push({ id: item.id, from: effectiveOf(bi.get(item.id) as Item, bs), to: effectiveOf(item, as) });
  }
  if (changes.length > 0) return { kind: "tokens", changes };
  return before.lines.join("\n") === after.lines.join("\n") ? { kind: "none" } : { kind: "text" };
}
