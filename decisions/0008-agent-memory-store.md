# 0008 — Agent memory store

**Status:** Accepted
**Date:** 2026-10-11

## Context
Agent memories are small lessons for future agent sessions ("prefer pnpm", "acme-api: ask before migrations"), distinct from knowledge about the world. Options: a separate memory folder with scope frontmatter, or ordinary knowledge notes carrying a `scope` field.

## Decision
- Agent memories live in `memories/YYYY/MM/` as small atomic Markdown files; time is the only path axis, reach is declared in frontmatter (see 0009).
- They follow obsidian-mind's write contract: `confidence` required, weak claims capped at `inferred`, near-duplicates prompt `supersedes`, append-only supersession.
- A memory that turns out to be real knowledge is **promoted** into the matching knowledge note by a later reviewed step; the memory links to it.
- Agent memories are not published to Notion (vision.md).

## Future
A dedicated long-term memory provider (e.g. GBrain) may be introduced later as an **index/retrieval layer over these Markdown files**, never as a second canonical store. Tracked in vision.md v2.

## Evidence
reviews/03-obsidian-mind.md (memory scope, write contract, supersession, promotion).
