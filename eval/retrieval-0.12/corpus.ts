// The records every retriever here reads: the brain's own parsed notes, filtered as `brain query --candidates` filters them
// (cli.md §5.13: default types, restricted evidence per 0055), so no adaptation sees a note the CLI would not.
import { scanNotes, type Note } from "../../src/lib/notes.ts";
import { queryTypes } from "../../src/lib/query.ts";
import { contextFor, eligibleNote, requireSuppressions } from "../../src/lib/suppressions.ts";

export type { Note };

export async function loadCorpus(root: string): Promise<Note[]> {
  const { notes } = await scanNotes(root);
  const types = queryTypes(undefined);
  const context = contextFor(notes, requireSuppressions(root));
  return notes.filter((note) => types.has(note.type)).flatMap((note) => {
    const kept = eligibleNote(note, context);
    return kept === null ? [] : [kept];
  });
}

/** Every string in a frontmatter value, nested facts and timeline entries included. */
export function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap(strings);
}

export function field(note: Note, key: string): string {
  const value = note.attributes[key];
  return typeof value === "string" ? value : "";
}

/** The frontmatter strings other than title, aliases and summary, in file order. */
export function otherStrings(note: Note): string[] {
  return Object.entries(note.attributes).flatMap(([key, value]) => (["title", "aliases", "summary"].includes(key) ? [] : strings(value)));
}

/** The head every compact result shows: what the brain-query skill reads from a candidate (cli.md §5.13) — type, the labels
 *  it must say aloud (lifecycle, assessment, a learned Document's origin), date and path, then title and summary. */
export function head(note: Note): string {
  const labels = [note.type, field(note, "lifecycle"), field(note, "assessment"), note.type === "reference" ? field(note, "origin") || "part" : "", field(note, "date")].filter(Boolean);
  const summary = field(note, "summary");
  return `(${labels.join(", ")}) ${note.path}\n   ${field(note, "title")}${summary ? ` — ${summary}` : ""}`;
}
