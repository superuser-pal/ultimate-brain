# 0007 — Ingested Notion meeting notes are marked, never deleted

**Status:** Accepted
**Date:** 2026-10-11

## Decision
After a Notion meeting note is ingested, it stays in Notion. The ingest sets an `ingested` property (with date) and a link to the brain's meeting summary. The ingest never deletes or edits the note's body. Re-ingest is an explicit user action (amended by 0012: no automatic re-ingest on later edits).

## Evidence
reviews/03-obsidian-mind.md (`om-intake` asks before deleting inbox files), reviews/02-obsidian-wiki.md (incremental re-ingest by cursor).
