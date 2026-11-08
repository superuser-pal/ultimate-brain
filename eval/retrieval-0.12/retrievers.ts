// The retrievers compared in CC-167, all behind retriever.ts's interface.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { queryWords } from "../../src/lib/query.ts";
import { build as build05, search as search05 } from "../search-0.5/bm25.mjs";
import { buildIndex, score, type Doc } from "./bm25.ts";
import { chunkBody } from "./chunk.ts";
import { field, head, otherStrings, strings, type Note } from "./corpus.ts";
import { isCurrent, sha256 } from "./freshness.ts";
import { fromMetadata, synthetic } from "./prefix.ts";
import { compactPage, type Hit, type Retriever } from "./retriever.ts";
import { bestPerNote, snippet } from "./snippet.ts";
import { tokenize } from "./tokenize.ts";

const cli = fileURLToPath(new URL("../../src/cli.ts", import.meta.url));

/** The compact block for one note: title — summary, then one snippet of at most 200 characters. */
function block(note: Note, raw: string): string {
  return raw.trim() ? `${head(note)}\n   ${snippet(raw.trim())}` : head(note);
}

/** A whole-note retriever's block: its body's first chunk as the snippet. A note outside the corpus shows its id only. */
function firstChunkHit(byId: Map<string, Note>, id: string): Hit {
  const note = byId.get(id);
  return { id, text: note ? block(note, chunkBody(note.body)[0] ?? "") : "" };
}

/** The baseline: `brain query --candidates` from this checkout; its page is the JSON it prints, as the skill reads it. */
export function brainCli(root: string): Retriever {
  return {
    name: "brain",
    search(query, limit) {
      const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", cli, "query", "--candidates", query, "--limit", String(limit), "--json"], {
        env: { ...process.env, BRAIN_DIR: root },
        encoding: "utf8",
      });
      const parsed = JSON.parse(out);
      // The envelope names the brain's folder, a scratch path here; a typical one stands in, so the count doesn't depend on it.
      const page = JSON.stringify({ ...parsed, brain: "/Users/name/brain" });
      return { ids: parsed.data.candidates.map((c: { id: string }) => c.id), page };
    },
  };
}

/** Any ranking, re-paged with compact snippets: the snippet piece alone, applied to another retriever's order. */
export function withCompactPage(name: string, inner: Retriever, byId: Map<string, Note>): Retriever {
  return {
    name,
    search(query, limit) {
      const { ids } = inner.search(query, limit);
      return compactPage(query, ids.map((id) => firstChunkHit(byId, id)));
    },
  };
}

/** eval/search-0.5's BM25F, the CC-164 comparison. It reads the files itself. */
export function bm25v05(root: string, byId: Map<string, Note>): Retriever {
  const index = build05(root);
  return {
    name: "bm25-0.5",
    search(query, limit) {
      return compactPage(query, search05(index, query, limit).map((r: { id: string }) => firstChunkHit(byId, r.id)));
    },
  };
}

/** The whole note as one document: title and aliases `titleWeight` times, summary `summaryWeight` times, then the rest. */
function wholeNote(note: Note, tok: (text: string) => string[], titleWeight: number, summaryWeight: number): Doc {
  const title = tok([field(note, "title"), ...strings(note.attributes.aliases)].join(" "));
  const summary = tok(field(note, "summary"));
  return {
    key: note.id,
    terms: [...Array(titleWeight).fill(title).flat(), ...Array(summaryWeight).fill(summary).flat(), ...tok(otherStrings(note).join(" ")), ...tok(note.body)],
  };
}

export interface BM25Options {
  name: string;
  /** Upstream's tokeniser, or the CLI's (cli.md §5.13 step 1). */
  tokens: "upstream" | "brain";
  /** Field weights for whole notes; 1/1 is upstream's unweighted text. */
  titleWeight?: number;
  summaryWeight?: number;
  /** Match query terms by prefix, as cli.md §5.13 does. */
  prefix?: boolean;
}

/** claude-obsidian's BM25 over whole notes: the BM25 piece alone (and its tokeniser swapped, to tell the two apart). */
export function bm25Whole(notes: readonly Note[], options: BM25Options): Retriever {
  const tok = options.tokens === "upstream" ? tokenize : queryWords;
  const index = buildIndex(notes.map((note) => wholeNote(note, tok, options.titleWeight ?? 1, options.summaryWeight ?? 1)), tok);
  const byId = new Map(notes.map((note) => [note.id, note]));
  return {
    name: options.name,
    search(query, limit) {
      return compactPage(query, score(index, query, { prefix: options.prefix }).slice(0, limit).map(({ key }) => firstChunkHit(byId, key)));
    },
  };
}

export interface ChunkOptions {
  name: string;
  /** What is put before each chunk before indexing: nothing, upstream's synthetic prefix, or the note's metadata. */
  prefix: "none" | "synthetic" | "metadata";
  /** Drop hits whose file changed since indexing (freshness.ts); needs the brain root. */
  fresh?: string;
}

/** claude-obsidian's pipeline over chunks: BM25 on (prefix + chunk), best chunk per note, a compact snippet of the chunk. */
export function bm25Chunks(notes: readonly Note[], options: ChunkOptions): Retriever {
  const chunks = new Map<string, { note: Note; raw: string }>();
  const docs: Doc[] = [];
  for (const note of notes) {
    const bodyChunks = chunkBody(note.body);
    // Upstream indexes body chunks only, so a note with an empty body has none; with its metadata as prefix it keeps one empty chunk.
    if (!bodyChunks.length && options.prefix === "metadata") bodyChunks.push("");
    const prefix = options.prefix === "synthetic" ? synthetic(note) : options.prefix === "metadata" ? fromMetadata(note) : "";
    bodyChunks.forEach((raw, i) => {
      const key = `${note.id}:${i}`;
      chunks.set(key, { note, raw });
      docs.push({ key, terms: tokenize(prefix ? `${prefix} ${raw}` : raw) });
    });
  }
  const index = buildIndex(docs, tokenize);
  const hashes = new Map(notes.map((note) => [note.id, sha256(note.raw)]));
  return {
    name: options.name,
    search(query, limit) {
      const hits: Hit[] = [];
      for (const best of bestPerNote(score(index, query))) {
        const { note, raw } = chunks.get(`${best.id}:${best.chunk}`)!;
        if (options.fresh !== undefined && !isCurrent(options.fresh, note.path, hashes.get(note.id)!)) continue;
        hits.push({ id: best.id, text: block(note, raw) });
        if (hits.length === limit) break;
      }
      return compactPage(query, hits);
    },
  };
}
