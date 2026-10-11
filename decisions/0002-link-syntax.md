# 0002 — Link syntax

**Status:** Accepted
**Date:** 2026-10-11

## Context
Options: Obsidian wikilinks (Obsidian-only, ambiguous), standard relative Markdown links (portable, break on move), ID links (unbreakable, unreadable without tooling).

## Decision
Agents write standard relative Markdown links (`[Maria](../people/maria-lopez.md)`). Every target has a stable `id` (0001); lint and a rename command use it to detect and repair broken links. The Notion publisher resolves links to Notion page links via the ID map.

## Consequences
- Files stay readable on GitHub/editors; Obsidian remains usable as an optional viewer.
- Need a rename/move command (or lint fix) that rewrites links using IDs.
- No `[[wikilinks]]` in canonical files.

## Evidence
reviews/02-obsidian-wiki.md (Link Format, `OBSIDIAN_LINK_FORMAT=markdown`).
