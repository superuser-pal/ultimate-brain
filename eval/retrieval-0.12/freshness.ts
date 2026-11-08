// Content freshness: a derived index never serves a note whose file changed after the index was built.
// Adapted from claude-obsidian scripts/retrieve.py (`chunk_is_current`: the page's SHA-256 recorded at indexing must equal
// the page's current SHA-256, else the hit is dropped as stale) at commit 2e545563172f97f02ecaaaab376ceea1246a0583,
// MIT License, Copyright (c) 2026 AgriciDaniel. Written in TypeScript from reading the file; none of its code is run.
// Left out: the per-chunk body hashes, which guard chunk files on disk; here chunks are rebuilt from the note.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** The note's file still has the bytes it had when it was indexed. A missing or unreadable file is not current. */
export function isCurrent(root: string, path: string, indexedHash: string): boolean {
  let text: string;
  try {
    text = readFileSync(join(root, path), "utf8");
  } catch {
    return false;
  }
  return sha256(text.startsWith("﻿") ? text.slice(1) : text) === indexedHash;
}
