# 0012 — Meeting minutes are reviewed by the user before ingest

**Status:** Accepted
**Date:** 2026-10-11

## Context
Notion AI produces a summary of the meeting transcript. The question was whether the brain should regenerate its meeting summary when a Notion meeting note is edited after ingest.

## Decision
Reviewing the Notion AI minutes is the **user's key action** after the transcript summary, and it happens **before** ingest. The brain only ingests meeting notes the user has marked as reviewed. No automatic regeneration after later edits.

## Consequences
- The Notion meeting-notes database needs a property the user sets when the minutes are ready (e.g. `Brain status: Reviewed`). The ingest picks up only those, then sets `ingested` + link (0007).
- Minutes are treated as user-confirmed input, which raises their weight as a source compared with raw transcripts.
- If a note is edited after ingest anyway, the ingest does nothing automatically; re-ingesting is an explicit user action. Any resulting changes to shared notes still go through proposals (0003).

## Evidence
reviews/05-llm-wiki.md (Open decision 3), user decision 2026-10-11.
