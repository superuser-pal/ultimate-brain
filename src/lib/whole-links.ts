/** A whole Document's links on its Notion page: read against the repo its file came from (spec/cli.md §5.14.4, decision 0091). */
import { posix } from "node:path";
import type { Note } from "./notes.ts";
import { decodePath } from "./lint-links.ts";

/** Where a whole Document's text came from: its source's linked repo and path, or null for a file from no repo. */
function repoFile(document: Note, get: (id: string) => Note | undefined): { repo: string; path: string } | null {
  const sources = document.attributes.sources;
  const source = Array.isArray(sources) && typeof sources[0] === "string" ? get(sources[0]) : undefined;
  const repo = source?.attributes.repo; const path = source?.attributes.repo_path;
  return typeof repo === "string" && typeof path === "string" ? { repo, path } : null;
}

/**
 * The body of a Document with `origin: whole` as its Notion page shows it: each `[[wikilink]]` (embeds too) shows its label or target and links
 * to the page of the one other whole Document kept from a file of the same repo with that name or path; a relative Markdown link is resolved
 * against the file's repo path the same way; anything that matches no file, or more than one, or a file not yet published, is plain text.
 */
export function wholeDocumentMarkdown(document: Note, notes: readonly Note[], get: (id: string) => Note | undefined): string {
  const own = repoFile(document, get);
  const files = own === null ? [] : notes.flatMap((note) => {
    if (note.id === document.id || note.type !== "reference" || note.attributes.origin !== "whole") return [];
    const file = repoFile(note, get);
    return file !== null && file.repo === own.repo ? [{ note, path: file.path }] : [];
  });
  const linked = (text: string, matches: ReadonlyArray<{ note: Note }>): string => {
    const page = matches.length === 1 ? matches[0]!.note.attributes.notion : undefined;
    return typeof page === "string" ? `[${text}](https://www.notion.so/${page.replaceAll("-", "")})` : text;
  };
  const wikilink = (inner: string): string => {
    const [target = "", label] = splitOnce(inner.replaceAll("\\|", "|"), "|");
    const [name = "", heading] = splitOnce(target, "#");
    const t = name.trim();
    const text = label?.trim() || t || heading?.trim() || inner;
    if (t === "") return text;
    return linked(text, files.filter((file) => file.path === t || file.path === `${t}.md` || posix.basename(file.path).replace(/\.md$/, "") === t));
  };
  const markdownLink = (all: string, text: string, target: string): string => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return all;
    const path = decodePath(target.split(/[?#]/)[0]!);
    if (own === null || path === "") return text;
    const resolved = posix.normalize(posix.join(posix.dirname(own.path), path));
    return linked(text, files.filter((file) => file.path === resolved));
  };
  const LINK = /!?\[\[([^\]\n]+?)\]\]|!?\[([^\]\n]*)\]\(\s*(?:<([^>\n]*)>|([^)\s]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/g;
  const renderLine = (line: string): string => line.split(/(`[^`]*`)/).map((part, index) => index % 2 === 1 ? part
    : part.replace(LINK, (all, inner: string | undefined, text: string | undefined, angled: string | undefined, bare: string | undefined) =>
      inner !== undefined ? wikilink(inner) : markdownLink(all, text ?? "", angled ?? bare ?? ""))).join("");
  let fence: string | null = null;
  return document.body.split("\n").map((line) => {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker !== undefined) { fence = fence === null ? marker : fence === marker ? null : fence; return line; }
    return fence === null ? renderLine(line) : line;
  }).join("\n").replace(/\^\[(inferred|ambiguous)\]/g, (_, kind) => kind === "inferred" ? " (AI inference)" : " (ambiguous)");
}

function splitOnce(text: string, separator: string): [string, string | undefined] {
  const at = text.indexOf(separator);
  return at < 0 ? [text, undefined] : [text.slice(0, at), text.slice(at + separator.length)];
}
