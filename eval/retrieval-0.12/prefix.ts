// The synthetic contextual prefix put before each chunk before it is indexed.
// `synthetic` is adapted from claude-obsidian scripts/contextual-prefix.py (`synthetic_prefix`: the page title and the first
// sentence of the page body, at most 300 characters; prefixes capped at 1,000 characters) at commit
// 2e545563172f97f02ecaaaab376ceea1246a0583, MIT License, Copyright (c) 2026 AgriciDaniel. Written in TypeScript from
// reading the file; none of its code is run. Left out: the model-written prefixes (Anthropic API, Ollama): this product
// adds no model call to retrieval.
// `fromMetadata` is this repo's adaptation: the brain's own title, aliases, summary and other frontmatter (nested facts
// and timeline values included) frame the chunk instead of the body's first sentence.
import { field, otherStrings, strings, type Note } from "./corpus.ts";

const MAX = 1000;

export function synthetic(note: Note): string {
  const title = field(note, "title").trim() || "(untitled)";
  const first = (note.body.trim().split(/(?<=[.!?])\s+/)[0] ?? "").slice(0, 300);
  return `This passage is from the wiki page "${title}". The page opens: ${first}`.slice(0, MAX);
}

export function fromMetadata(note: Note): string {
  const aliases = strings(note.attributes.aliases);
  const parts = [
    `This passage is from the ${note.type} "${field(note, "title")}"${aliases.length ? ` (also: ${aliases.join(", ")})` : ""}.`,
    field(note, "summary"),
    otherStrings(note).join(" "),
  ];
  return parts.filter(Boolean).join(" ").slice(0, MAX);
}
