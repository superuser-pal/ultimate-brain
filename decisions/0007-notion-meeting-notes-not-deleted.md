# 0007 — Ingested Notion meeting notes are marked, never deleted

**Status:** Accepted
**Date:** 2026-10-11
**Amended by:** [0101](0101-where-notion-ai-and-the-brain-each-write.md) (2026-11-16; 1.0.0): the brain may write the minutes on a meeting page that has a transcript and no minutes, once, and nothing else on the page (§8); [0109](0109-meetings-use-the-inbox-s-status-names.md) (2026-11-18; 0.16.2): the mark is Brain Status Done (was Ingested), with Ingested At unchanged

## Decision
After a Notion meeting note is ingested, it stays in Notion. The ingest sets an `ingested` property (with date) and a link to the brain's meeting summary. The ingest never deletes or edits the note's body. Re-ingest is an explicit user action (amended by 0012: no automatic re-ingest on later edits).

## Evidence
reviews/03-obsidian-mind.md (`om-intake` asks before deleting inbox files), reviews/02-obsidian-wiki.md (incremental re-ingest by cursor).
