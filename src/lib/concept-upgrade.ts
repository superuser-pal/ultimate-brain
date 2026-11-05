import { posix } from "node:path";

import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.ts";
import { buildIndex } from "./index-builder.ts";
import { parseNote, type Note } from "./notes.ts";
import { newNotePath, slugify } from "./paths.ts";
import { bodyHash } from "./proposals.ts";
import { indexNotes, loadSuppressions } from "./suppressions.ts";

/** One concept turned into a learned Document (spec/cli.md §5.15 step 5a, decision 0071). */
export interface Conversion { id: string; from: string; to: string }
export interface NoteChange { path: string; action: "created" | "updated" | "removed"; content?: string }
/** A file whose links to `knowledge/concepts/` point at no file and match no learned Document by name (`CONCEPT_LINK_UNRESOLVED`). */
export interface Unresolved { path: string; links: string[] }
export interface ConceptPlan {
  converted: Conversion[];
  /** Note files created, rewritten or removed, and `index.md` when its bytes change. */
  changes: NoteChange[];
  /** Every note as the brain holds it after the plan, sorted by path (for lint on a dry run). */
  notes: Note[];
  /** `index.md` after the plan, or null when it is unchanged. */
  index: string | null;
  /** Links left as written because no destination was found, per file in path order. */
  unresolved: Unresolved[];
}

/**
 * Where a link target goes: its new path, `null` for a dead link to `knowledge/concepts/` that matches no learned Document,
 * or `undefined` when it stays.
 */
export type Relocate = (path: string) => string | null | undefined;

/** Proposals not yet applied or closed: their `before_hash` follows a body the step rewrites, and a concept `new_item` is converted. */
const OPEN = new Set(["pending", "approved", "edited"]);

/**
 * Plan step 5a: each `type: concept` note becomes a `reference` with `origin: learned` in `knowledge/references/`, keeping its id;
 * every relative link to a moved file is rewritten (sources excepted: their bytes are hashed), in bodies and in the text fields of
 * proposals, and `index.md` is rebuilt. A dead link to `knowledge/concepts/` that an earlier conversion missed is repaired by file name.
 */
export function planConceptConversion(root: string, notes: readonly Note[], taken: (path: string) => boolean, currentIndex: string | null): ConceptPlan {
  const concepts = notes.filter((note) => note.type === "concept");
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
  const relocate = relocator(notes, moved, taken);

  const changes: NoteChange[] = [];
  const planned: Note[] = [];
  const unresolved: Unresolved[] = [];
  /** Old and new body of each note whose body this step rewrites, by id (for `before_hash`). */
  const bodies = new Map<string, { before: string; after: string }>();
  const missedIn = (path: string, links: string[]) => { if (links.length > 0) unresolved.push({ path, links: [...new Set(links)] }); };

  for (const note of notes) {
    if (note.type === "proposal") continue;
    const to = moved.get(note.path);
    const missed: string[] = [];
    if (to !== undefined) {
      const document = parseFrontmatter(note.raw);
      document.attributes.type = "reference";
      document.attributes.origin = "learned";
      for (const key of ["notion", "last_synced", "notion_published"]) delete document.attributes[key];
      document.body = rewriteLinks(document.body, note.path, to, relocate, missed);
      if (document.body !== note.body) bodies.set(note.id, { before: note.body, after: document.body });
      const content = serializeFrontmatter(document);
      changes.push({ path: note.path, action: "removed" }, { path: to, action: "created", content });
      planned.push(reparse(to, content));
      missedIn(to, missed);
      continue;
    }
    if (note.type === "source") { planned.push(note); continue; }
    const body = rewriteLinks(note.body, note.path, note.path, relocate, missed);
    missedIn(note.path, missed);
    if (body === note.body) { planned.push(note); continue; }
    bodies.set(note.id, { before: note.body, after: body });
    const content = `${note.raw.slice(0, note.raw.length - note.body.length)}${body}`;
    changes.push({ path: note.path, action: "updated", content });
    planned.push(reparse(note.path, content));
  }

  const paths = new Map(notes.map((note) => [note.id, note.path]));
  for (const note of notes) {
    if (note.type !== "proposal") continue;
    const missed: string[] = [];
    const content = rewriteProposal(note, paths, moved, relocate, bodies, missed);
    missedIn(note.path, missed);
    if (content === null) { planned.push(note); continue; }
    changes.push({ path: note.path, action: "updated", content });
    planned.push(reparse(note.path, content));
  }
  planned.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  unresolved.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // index.md is rebuilt only when a note is converted: a repair alone changes no title, summary or path the index lists.
  const index = concepts.length === 0 ? currentIndex : buildIndex(indexNotes(planned, loadSuppressions(root))).markdown;
  if (index !== currentIndex) changes.push({ path: "index.md", action: currentIndex === null ? "created" : "updated", content: index! });
  const converted = concepts.map((note) => ({ id: note.id, from: note.path, to: moved.get(note.path)! }));
  return { converted, changes, notes: planned, index: index === currentIndex ? null : index, unresolved };
}

/**
 * Links are relocated to this run's conversions first. A missing file under `knowledge/concepts/` that this run doesn't convert was
 * moved by an earlier one: it is found by file name among the learned Documents with a `con-` id, `<name>.md` first, else the only
 * `<name>-<n>.md` (spec/cli.md §5.15 step 5a, CC-136).
 */
function relocator(notes: readonly Note[], moved: ReadonlyMap<string, string>, taken: (path: string) => boolean): Relocate {
  const former = new Set(notes.filter((note) => note.type === "reference" && note.attributes.origin === "learned" && note.id.startsWith("con-")
    && posix.dirname(note.path) === "knowledge/references").map((note) => note.path));
  return (path) => {
    const to = moved.get(path);
    if (to !== undefined) return to;
    if (!path.startsWith("knowledge/concepts/") || !path.endsWith(".md") || taken(path)) return undefined;
    const name = posix.basename(path, ".md");
    const exact = `knowledge/references/${name}.md`;
    if (former.has(exact)) return exact;
    const candidates = [...former].filter((candidate) => {
      const file = posix.basename(candidate, ".md");
      const n = file.startsWith(`${name}-`) ? file.slice(name.length + 1) : "";
      return /^[1-9][0-9]*$/.test(n) && Number(n) >= 2;
    });
    return candidates.length === 1 ? candidates[0]! : null;
  };
}

type Fields = Record<string, unknown>;
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The proposal with the links in its text rewritten, each string read for the note it is written for, or null when nothing changes.
 * On an open proposal a `before_hash` that matched a rewritten body follows it, and a concept `new_item` becomes a learned Document.
 */
function rewriteProposal(note: Note, paths: ReadonlyMap<string, string>, moved: ReadonlyMap<string, string>, relocate: Relocate,
  bodies: ReadonlyMap<string, { before: string; after: string }>, missed: string[]): string | null {
  const document = parseFrontmatter(note.raw);
  const a = document.attributes;
  const open = OPEN.has(String(a.status));
  const changes = Array.isArray(a.changes) ? a.changes : [];
  /** Rewrite a string written for note `id`: read from its old path, written for its new one. A missing note leaves it. */
  const forNote = (text: unknown, id: unknown): unknown => {
    if (typeof text !== "string" || typeof id !== "string") return text;
    const from = paths.get(id);
    return from === undefined ? text : rewriteLinks(text, from, moved.get(from) ?? from, relocate, missed);
  };
  const changeTarget = (index: unknown) => (typeof index === "number" && isFields(changes[index]) ? changes[index].target : undefined);
  const followHash = (fields: Fields) => {
    if (!open || fields.kind !== "update_body" || typeof fields.target !== "string" || typeof fields.before_hash !== "string") return;
    const body = bodies.get(fields.target);
    if (body !== undefined && fields.before_hash === bodyHash(body.before)) fields.before_hash = bodyHash(body.after);
  };

  if ("content" in a) a.content = forNote(a.content, a.target);
  if (a.kind !== "review_notes") followHash(a);
  for (const change of changes) {
    if (!isFields(change)) continue;
    if ("content" in change) change.content = forNote(change.content, change.target);
    followHash(change);
  }
  if (isFields(a.decision)) {
    if ("value" in a.decision) a.decision.value = forNote(a.decision.value, a.target);
    if (Array.isArray(a.decision.fixes)) for (const fix of a.decision.fixes) {
      if (isFields(fix) && "value" in fix) fix.value = forNote(fix.value, "change" in fix ? changeTarget(fix.change) : a.target);
    }
  }
  if (Array.isArray(a.revisions)) {
    const items = new Map((Array.isArray(a.items) ? a.items : []).filter(isFields).map((item) => [item.item_id, item]));
    for (const revision of a.revisions) {
      if (!isFields(revision) || !("previous" in revision)) continue;
      const item = items.get(revision.item_id);
      revision.previous = forNote(revision.previous, item === undefined ? undefined : item.kind === "change" ? changeTarget(item.ref) : item.ref);
    }
  }
  if (a.kind === "new_item" && isFields(a.note)) rewriteNewItem(a.note, open, String(a.created ?? ""), relocate, missed);

  document.body = rewriteLinks(document.body, note.path, note.path, relocate, missed);
  const content = serializeFrontmatter(document);
  return content === note.raw ? null : content;
}

/** A `new_item`'s note body, read for the folder its type is written to; an open concept one becomes a learned Document. */
function rewriteNewItem(item: Fields, open: boolean, created: string, relocate: Relocate, missed: string[]): void {
  const title = typeof item.title === "string" ? item.title : "note";
  const date = typeof item.file_date === "string" ? item.file_date : created;
  let from: string;
  let to: string;
  if (item.type === "concept") {
    from = `knowledge/concepts/${slugify(title)}.md`;
    to = from;
    if (open) {
      item.type = "reference";
      item.frontmatter = { ...(isFields(item.frontmatter) ? item.frontmatter : {}), origin: "learned" };
      to = newNotePath("reference", title, date, () => false);
    }
  } else {
    try { from = to = newNotePath(String(item.type), title, date, () => false); } catch { return; }
  }
  if (typeof item.body === "string") item.body = rewriteLinks(item.body, from, to, relocate, missed);
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
export function rewriteLinks(body: string, from: string, to: string, relocate: Relocate, missed: string[] = []): string {
  let fence: string | null = null;
  return body.split("\n").map((line) => {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker !== undefined) { fence = fence === null ? marker : fence === marker ? null : fence; return line; }
    if (fence !== null) return line;
    const target = (raw: string) => retarget(raw, from, to, relocate, missed);
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

function retarget(raw: string, from: string, to: string, relocate: Relocate, missed: string[]): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("#")) return raw;
  const cut = raw.search(/[?#]/);
  const path = cut === -1 ? raw : raw.slice(0, cut);
  const suffix = cut === -1 ? "" : raw.slice(cut);
  if (path === "") return raw;
  const resolved = posix.normalize(posix.join(posix.dirname(from), decodePath(path)));
  if (resolved.startsWith("../")) return raw;
  const relocated = relocate(resolved);
  // A dead link to an old concept that no learned Document matches is left as written, and named in the warning.
  if (relocated === null) { missed.push(raw); return raw; }
  const destination = relocated ?? resolved;
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
