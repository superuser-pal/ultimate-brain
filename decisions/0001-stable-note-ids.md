# 0001 — Stable note IDs

**Status:** Accepted
**Date:** 2026-10-11

## Context
Reviewed repos identify notes by file path (obsidian-wiki) or by an optional sequential counter (claude-obsidian `c-000001`). Paths break on rename; counters collide across agents and branches. The Notion bridge needs an identity that survives renames.

## Decision
Every note carries a permanent, unique `id` in frontmatter (format fixed in 0017, e.g. `id: dec-7k2m9q4x`), generated at creation and never changed. Filenames and folders may change freely.

## Consequences
- Notion mapping is `id` ↔ Notion page ID.
- Link repair, dedup redirects and source tracking key on `id`.
- Format: prefixed short random IDs (0017).

## Evidence
reviews/01-claude-obsidian.md (address allocator: Reference only), reviews/02-obsidian-wiki.md (§5 "No stable IDs").
