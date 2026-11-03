import { BrainError } from "./errors.ts";
import type { Note } from "./notes.ts";
import { extractBody, paragraphs, parseSummary, planExtract, type Plan, type Selection } from "./selection.ts";

// Planning a selected extract (spec/cli.md §5.22, decision 0062): pure, no I/O.

export interface PreviousInfo {
  id: string; kind: "extract" | "full"; version: number | null;
  transcript_changed: boolean; suppressed: number[]; added: number[];
  selection_changes: { id: string; from: Selection; to: Selection }[];
  full_copies: string[]; legacy_tasks: string[];
}

export interface ExtractPlan {
  ok: boolean; write_required: boolean; transcript_hash: string;
  selection: { id: string; effective: Selection; explicit: Selection | null }[];
  problems: Plan["problems"]; passages: { n: number; hash: string; items: string[] }[];
  copied: { n: number; text: string; items: string[] }[]; unnumbered: Plan["unnumbered"];
  uncovered: number;
  quotes: Plan["quotes"]; unplaced_items: string[]; quick: Plan["quick"]; scopes: Plan["scopes"];
  body: string | null; previous?: PreviousInfo;
}

const invalid = (code: string, message: string): never => {
  throw new BrainError("INPUT_INVALID", `${code}: ${message}`, [{ pointer: "", message: `${code}: ${message}` }]);
};

const belongs = (note: Note, page: string): boolean =>
  note.type === "source" && (note.attributes.extract_of === page || note.attributes.source_key === `notion:${page}`);

/** The `replaces` chain from a source back to its first version. */
export function chainOf(start: Note, notes: readonly Note[]): Note[] {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const chain: Note[] = [];
  for (let current: Note | undefined = start; current !== undefined && !chain.includes(current); current = typeof current.attributes.replaces === "string" ? byId.get(current.attributes.replaces) : undefined) chain.push(current);
  return chain;
}

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export function buildExtractPlan(notes: readonly Note[], input: { page: string; summary: string; transcript: string; previous?: string }): ExtractPlan {
  const ofPage = notes.filter((note) => belongs(note, input.page));
  let previousNote: Note | undefined;
  if (input.previous === undefined) {
    if (ofPage.length > 0) invalid("PREVIOUS_REQUIRED", `${ofPage[0]!.id} already belongs to this input: pass --previous`);
  } else {
    previousNote = notes.find((note) => note.id === input.previous);
    if (previousNote === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${input.previous}`);
    if (!belongs(previousNote, input.page)) invalid("WRONG_INPUT", `${previousNote.id} is not a source of ${input.page}`);
    if (notes.some((note) => note.type === "source" && note.attributes.replaces === previousNote!.id)) invalid("NOT_LATEST", `${previousNote.id} is replaced by a later source`);
    if (previousNote.attributes.extract !== true && ofPage.some((note) => note.attributes.extract === true)) invalid("NOT_LATEST", "an extract of this input exists: pass the latest extract");
  }

  const summary = parseSummary(input.summary);
  const plan = planExtract(summary, input.transcript);
  const { transcript_hash: hash, paragraphs: paras } = paragraphs(input.transcript);
  const selection = [
    ...summary.subjects.map((subject) => ({ id: subject.id, effective: subject.selection, explicit: subject.raw === null ? null : subject.selection })),
    ...plan.mappings.map((mapping) => ({ id: mapping.item, effective: mapping.effective, explicit: mapping.explicit })),
  ];
  const passages = plan.copied.map((entry) => ({ n: entry.n, hash: entry.hash, items: entry.items }));
  void paras;
  const result: ExtractPlan = {
    ok: plan.ok, write_required: true, transcript_hash: hash, selection, problems: plan.problems, passages,
    copied: plan.copied.map((entry) => ({ n: entry.n, text: entry.text, items: entry.items })), unnumbered: plan.unnumbered,
    uncovered: plan.uncovered, quotes: plan.quotes, unplaced_items: plan.unplaced_items, quick: plan.quick, scopes: plan.scopes,
    body: plan.ok ? extractBody(plan) : null,
  };
  if (previousNote === undefined) return result;

  const chain = chainOf(previousNote, notes);
  const itemIds = new Set(selection.map((entry) => entry.id));
  const mapped = new Set<string>();
  for (const source of chain) {
    const items = source.attributes.task_items;
    if (items !== null && typeof items === "object") for (const [item, task] of Object.entries(items as Record<string, unknown>)) if (itemIds.has(item) && typeof task === "string") mapped.add(task);
  }
  const legacy = [...new Set(chain.flatMap((source) => strings(source.attributes.tasks)))].filter((task) => !mapped.has(task));
  const isExtract = previousNote.attributes.extract === true;
  const newNs = passages.map((entry) => entry.n);
  const info: PreviousInfo = {
    id: previousNote.id, kind: isExtract ? "extract" : "full", version: isExtract ? Number(previousNote.attributes.extract_version) : null,
    transcript_changed: false, suppressed: [], added: newNs, selection_changes: [],
    full_copies: isExtract ? [] : chain.filter((source) => source.attributes.extract !== true).map((source) => source.id), legacy_tasks: legacy,
  };
  if (isExtract) {
    const old = (Array.isArray(previousNote.attributes.passages) ? previousNote.attributes.passages : []) as { n: number; items?: string[] }[];
    const oldNs = old.map((entry) => entry.n);
    info.transcript_changed = previousNote.attributes.transcript_hash !== hash;
    if (info.transcript_changed) { info.suppressed = oldNs; info.added = newNs; }
    else { info.suppressed = oldNs.filter((n) => !newNs.includes(n)); info.added = newNs.filter((n) => !oldNs.includes(n)); }
    const before = (Array.isArray(previousNote.attributes.selection) ? previousNote.attributes.selection : []) as { id: string; effective: Selection }[];
    info.selection_changes = selection.flatMap((entry) => { const was = before.find((old2) => old2.id === entry.id); return was !== undefined && was.effective !== entry.effective ? [{ id: entry.id, from: was.effective, to: entry.effective }] : []; });
    const mappingChanged = !sameJson(before.map((entry) => entry.id).sort(), selection.map((entry) => entry.id).sort())
      || !sameJson(old.map((entry) => [entry.n, [...(entry.items ?? [])].sort()]), passages.map((entry) => [entry.n, [...entry.items].sort()]));
    result.write_required = info.transcript_changed || info.suppressed.length > 0 || info.added.length > 0 || mappingChanged;
  }
  result.previous = info;
  return result;
}
