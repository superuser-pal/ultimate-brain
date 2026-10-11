# 0013 — What the ingest reads, and the generated index

**Status:** Accepted
**Date:** 2026-10-11

## Context
llm_wiki's analysis step sees only the wiki index (titles and one-liners), so it misses contradictions with what notes actually say (e.g. project note says launch January, meeting says February).

## Decision
1. **Generated index.** `index.md` at the brain root lists every note on one line (`id`, title, `summary`, `type`, `area`/`project`, `status`, `aliases`). A script rebuilds it from frontmatter whenever changes are applied; it is committed to Git; no agent or person edits it. It is for agents; Notion has its own navigation.
2. **Ingest context (option B).** For each meeting, the analysis step reads the meeting text + `index.md` + the full text of the notes the meeting touches, found via the index: matched project, attendees' person notes, that project's recent decisions. Budget: at most ~8 notes; long notes trimmed to frontmatter (key facts) and recent sections.

## Consequences
- Every note needs a good `summary:` and `aliases:` (for matching names like "Maria" → `people/maria-lopez.md`).
- Contradictions with existing knowledge become review rows (0003, 0005).
- Small extra cost per meeting (a few thousand tokens).

## Evidence
reviews/05-llm-wiki.md (two-step ingest, index-only analysis), reviews/02-obsidian-wiki.md (retrieval ladder, `summary:`), reviews/01-claude-obsidian.md (5-page read budget).
