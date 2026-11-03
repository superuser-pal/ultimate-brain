import { lineageOf } from "./eligibility.ts";
import { chainOf } from "./extract.ts";
import type { Note } from "./notes.ts";
import { PASSAGE_REF } from "./selection.ts";
import { contextFor, restrictionOf, type Loaded } from "./suppressions.ts";

// The data of the exclusion cleanup row (capture-and-review §5.2): what a suppression restricts and what stays. Read-only.
// The Review row, its item decisions and their apply are CC-79.

export interface CleanupNote {
  note: string; path: string; whole: boolean; reason: "passages" | "unmapped text" | "unknown lineage";
  restricted: { line: number; text: string }[]; kept: { line: number; text: string }[];
  /** Timeline entries (0-based index) and fact keys that are not returned or rendered. */
  restricted_timeline: number[]; restricted_facts: string[];
}
export interface CleanupPlan {
  input: string; latest_extract: string | null;
  notes: CleanupNote[];
  /** Notes that cite a passage the latest version holds again: the user's Restore item. */
  restore: { note: string; line: number; passage: string }[];
  tasks: { task: string; item: string | null; reason: "item no longer selected" | "unknown item" }[];
  documents: { note: string; sources: string[] }[];
}

export function cleanupPlan(notes: readonly Note[], loaded: Loaded, input: string): CleanupPlan {
  const suppressions = loaded.suppressions;
  const context = contextFor(notes, loaded);
  const sources = notes.filter((note) => note.type === "source" && (note.attributes.extract_of === input || note.attributes.source_key === `notion:${input}`));
  const latest = sources.filter((source) => source.attributes.extract === true && !sources.some((other) => other.attributes.replaces === source.id)).at(-1);
  const result: CleanupPlan = { input, latest_extract: latest?.id ?? null, notes: [], restore: [], tasks: [], documents: [] };
  const chain = latest === undefined ? [] : chainOf(latest, notes);
  const chainIds = new Set([...chain, ...sources].map((source) => source.id));
  const latestPassages = new Set((Array.isArray(latest?.attributes.passages) ? (latest!.attributes.passages as { n: number; hash: string }[]) : []).map((entry) => `${entry.n}:${entry.hash}`));

  for (const note of notes) {
    if (note.type === "source" || note.type === "proposal" || note.type === "view" || note.attributes.lifecycle === "archived") continue;
    const cited = [...(Array.isArray(note.attributes.sources) ? note.attributes.sources : []), ...(typeof note.attributes.source === "string" ? [note.attributes.source] : [])].filter((value): value is string => typeof value === "string");
    const lineages = cited.map((id) => (context.sources.has(id) || !id.includes(":") ? lineageOf(id, context.sources) : id));
    const restriction = restrictionOf(note, context);
    // A note belongs to this input's cleanup when it lists it as a source, or when any of its claims is restricted (a citation in the body
    // or a timeline entry may name an input the `sources` list leaves out).
    const touches = lineages.includes(input) || lineages.includes(null) || cited.some((id) => chainIds.has(id))
      || restriction.whole || restriction.lines.size > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0;
    if (!touches) continue;
    const lines = note.body.split(/\r?\n/);
    const restricted: CleanupNote["restricted"] = [];
    const kept: CleanupNote["kept"] = [];
    lines.forEach((text, index) => {
      const refs = [...text.matchAll(PASSAGE_REF)];
      if (refs.length === 0) return;
      (restriction.lines.has(index) ? restricted : kept).push({ line: index + 1, text: text.trim().slice(0, 200) });
      for (const ref of refs) if (context.awaitingRestore?.has(`${input}|${String(latest?.attributes.transcript_hash)}|${ref[2]}`) && !context.restored?.has(`${input}|${String(latest?.attributes.transcript_hash)}|${ref[2]}|${note.id}`) && latestPassages.has(`${ref[2]}:${ref[3]}`)) result.restore.push({ note: note.id, line: index + 1, passage: `${ref[1]}#¶${ref[2]}:${ref[3]}` });
    });
    if (restriction.whole || restricted.length > 0 || restriction.timeline.size > 0 || restriction.facts.size > 0) {
      result.notes.push({ note: note.id, path: note.path, whole: restriction.whole, reason: restriction.whole ? (lineages.includes(null) ? "unknown lineage" : "unmapped text") : "passages", restricted, kept, restricted_timeline: [...restriction.timeline], restricted_facts: [...restriction.facts] });
    }
    if (note.type === "reference" && cited.some((id) => chainIds.has(id))) result.documents.push({ note: note.id, sources: cited.filter((id) => chainIds.has(id)) });
  }

  // Tasks created from items that are no longer selected, and Tasks no item can be tied to (a full copy made them).
  const selection = (Array.isArray(latest?.attributes.selection) ? latest!.attributes.selection : []) as { id: string; effective: string }[];
  const mapped = new Map<string, string>();
  for (const source of chain) {
    const items = source.attributes.task_items;
    if (items !== null && typeof items === "object") for (const [item, task] of Object.entries(items as Record<string, unknown>)) if (typeof task === "string") mapped.set(task, item);
  }
  for (const source of chain.length > 0 ? chain : sources) {
    for (const task of Array.isArray(source.attributes.tasks) ? source.attributes.tasks : []) {
      if (typeof task !== "string" || result.tasks.some((entry) => entry.task === task)) continue;
      const item = mapped.get(task) ?? null;
      if (item === null) result.tasks.push({ task, item: null, reason: "unknown item" });
      else if (selection.find((entry) => entry.id === item)?.effective !== "use") result.tasks.push({ task, item, reason: "item no longer selected" });
    }
  }
  return result;
}
