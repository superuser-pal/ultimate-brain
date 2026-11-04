import { posix } from "node:path";

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.ts";
import { buildIndex } from "./index-builder.ts";
import { parseNote, type Note } from "./notes.ts";
import { indexNotes, loadSuppressions } from "./suppressions.ts";

/** One concept turned into a learned Document (spec/cli.md §5.15 step 5a, decision 0071). */
export interface Conversion { id: string; from: string; to: string }
export interface NoteChange { path: string; action: "created" | "updated" | "removed"; content?: string }
export interface ConceptPlan {
  converted: Conversion[];
  /** Note files created, rewritten or removed, and `index.md` when its bytes change. */
  changes: NoteChange[];
  /** Every note as the brain holds it after the plan, sorted by path (for lint on a dry run). */
  notes: Note[];
  /** `index.md` after the plan, or null when it is unchanged. */
  index: string | null;
}

const NO_PLAN = (notes: Note[]): ConceptPlan => ({ converted: [], changes: [], notes, index: null });

/**
 * Plan step 5a: each `type: concept` note becomes a `reference` with `origin: learned` in `knowledge/references/`, keeping its id;
 * every relative link to a moved file is rewritten (sources excepted: their bytes are hashed), and `index.md` is rebuilt.
 */
export function planConceptConversion(root: string, notes: readonly Note[], taken: (path: string) => boolean, currentIndex: string | null): ConceptPlan {
  const concepts = notes.filter((note) => note.type === "concept");
  if (concepts.length === 0) return NO_PLAN([...notes]);

  const moved = new Map<string, string>();
  const claimed = new Set<string>();
  for (const note of concepts) {
    const base = posix.basename(note.path, ".md");
    for (let n = 1; ; n += 1) {
      const path = `knowledge/references/${n === 1 ? base : `${base}-${n}`}.md`;
      if (taken(path) || claimed.has(path)) continue;
      claimed.add(path);
      moved.set(note.path, path);
      break;
    }
  }

  const changes: NoteChange[] = [];
  const planned: Note[] = [];
  for (const note of notes) {
    const to = moved.get(note.path);
    if (to !== undefined) {
      const document = parseFrontmatter(note.raw);
      document.attributes.type = "reference";
      document.attributes.origin = "learned";
      for (const key of ["notion", "last_synced", "notion_published"]) delete document.attributes[key];
      document.body = rewriteLinks(document.body, note.path, to, moved);
      const content = serializeFrontmatter(document);
      changes.push({ path: note.path, action: "removed" }, { path: to, action: "created", content });
      planned.push(reparse(to, content));
      continue;
    }
    if (note.type === "source") { planned.push(note); continue; }
    const body = rewriteLinks(note.body, note.path, note.path, moved);
    if (body === note.body) { planned.push(note); continue; }
    const content = `${note.raw.slice(0, note.raw.length - note.body.length)}${body}`;
    changes.push({ path: note.path, action: "updated", content });
    planned.push(reparse(note.path, content));
  }
  planned.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const index = buildIndex(indexNotes(planned, loadSuppressions(root))).markdown;
  if (index !== currentIndex) changes.push({ path: "index.md", action: currentIndex === null ? "created" : "updated", content: index });
  const converted = concepts.map((note) => ({ id: note.id, from: note.path, to: moved.get(note.path)! }));
  return { converted, changes, notes: planned, index: index === currentIndex ? null : index };
}

function reparse(path: string, content: string): Note {
  const note = parseNote(path, content);
  if ("code" in note) throw new Error(`${path}: ${note.message}`);
  return note;
}

const INLINE = /(\]\(\s*)(?:<([^>]*)>|([^)\s]+))((?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\))/g;
const DEFINITION = /^(\s{0,3}\[[^\]]+\]:\s*)(?:<([^>]*)>|(\S+))/;

/**
 * Rewrite the relative links of a body written at `from` and now at `to`: a link to a moved file points to its new path, and a link
 * whose relative path changes because the file itself moved is recomputed. Fenced code and inline code are left alone, as lint reads them.
 */
export function rewriteLinks(body: string, from: string, to: string, moved: ReadonlyMap<string, string>): string {
  let fence: string | null = null;
  return body.split("\n").map((line) => {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker !== undefined) { fence = fence === null ? marker : fence === marker ? null : fence; return line; }
    if (fence !== null) return line;
    const target = (raw: string) => retarget(raw, from, to, moved);
    // Inline code spans keep their text: rewrite only the parts between them.
    const parts = line.split(/(`[^`]*`)/);
    return parts.map((part, index) => {
      if (index % 2 === 1) return part;
      let out = part.replace(INLINE, (_, open: string, angle: string | undefined, bare: string | undefined, close: string) =>
        `${open}${angle !== undefined ? `<${target(angle)}>` : target(bare!)}${close}`);
      if (index === 0) out = out.replace(DEFINITION, (_, open: string, angle: string | undefined, bare: string | undefined) =>
        `${open}${angle !== undefined ? `<${target(angle)}>` : target(bare!)}`);
      return out;
    }).join("");
  }).join("\n");
}

function retarget(raw: string, from: string, to: string, moved: ReadonlyMap<string, string>): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("#")) return raw;
  const cut = raw.search(/[?#]/);
  const path = cut === -1 ? raw : raw.slice(0, cut);
  const suffix = cut === -1 ? "" : raw.slice(cut);
  if (path === "") return raw;
  const resolved = posix.normalize(posix.join(posix.dirname(from), decodePath(path)));
  if (resolved.startsWith("../")) return raw;
  const destination = moved.get(resolved) ?? resolved;
  // Unchanged when the link, read from the file's new folder, still reaches the same file.
  if (posix.normalize(posix.join(posix.dirname(to), decodePath(path))) === destination) return raw;
  const relative = posix.relative(posix.dirname(to), destination).split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `${relative}${suffix}`;
}

function decodePath(path: string): string {
  return path.split("/").map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  }).join("/");
}
