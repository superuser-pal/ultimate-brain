// Paragraph-aware chunking of a note's body.
// Adapted from claude-obsidian scripts/contextual-prefix.py (`chunk_body`, `_hard_split_chunk`: 2,000-character target,
// 200-character overlap, 4,000-character hard split) at commit 2e545563172f97f02ecaaaab376ceea1246a0583, MIT License,
// Copyright (c) 2026 AgriciDaniel. Written in TypeScript from reading the file; none of its code is run.
// Left out: chunk files on disk, page addresses and the vault lock.

export const TARGET = 2000;
export const OVERLAP = 200;
export const HARD_MAX = 4000;

function hardSplit(text: string): string[] {
  if (text.length <= HARD_MAX) return [text];
  const pieces: string[] = [];
  for (let start = 0; ; start += HARD_MAX - OVERLAP) {
    const end = Math.min(start + HARD_MAX, text.length);
    pieces.push(text.slice(start, end));
    if (end === text.length) return pieces;
  }
}

/** Accumulate paragraphs until the target is reached, flush, and seed the next chunk with the tail. */
export function chunkBody(body: string): string[] {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    current.push(paragraph);
    length += paragraph.length + 2;
    if (length >= TARGET) {
      const text = current.join("\n\n");
      chunks.push(text);
      const tail = text.slice(-OVERLAP);
      current = tail ? [tail] : [];
      length = tail.length;
    }
  }
  if (current.length && current.join("").trim()) {
    const trailing = current.join("\n\n");
    // After a final flush `current` holds only the overlap seed: context for a next paragraph, not a chunk of its own.
    if (!(chunks.length && trailing === chunks[chunks.length - 1]!.slice(-OVERLAP))) chunks.push(trailing);
  }
  if (!chunks.length && body.trim()) chunks.push(body.trim());
  return chunks.flatMap(hardSplit);
}
