# 0005 — Note lifecycle and fact assessment

**Status:** Accepted
**Date:** 2026-10-11

## Decision
Two separate state fields, one per job:

- **Lifecycle (every note):** `draft` (agent-written) → `reviewed` / `disputed` (set by the user, Notion-owned property that syncs back) → `archived`. Agents only ever set `draft`, or `archived` via supersession.
- **Assessment (key facts and decision records only):** `accepted`, `provisional`, `contested` (conflicting sources shown side by side), `superseded` (kept as history, linked to its replacement). Agents use it to decide what to state confidently; the review queue flags `contested` items and changes to `accepted` ones.

## Consequences
Key-fact/decision records need `valid_from` / `valid_until` / `superseded_by` (from obsidian-wiki `temporal.py`) plus sources. Numeric confidence scores are not used.

## Evidence
reviews/01-claude-obsidian.md (claim ledger assessments), reviews/02-obsidian-wiki.md (lifecycle state machine, bi-temporal validity).
