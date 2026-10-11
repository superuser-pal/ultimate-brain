# 0004 — Sentence-level provenance markers

**Status:** Accepted
**Date:** 2026-10-11

## Decision
Unmarked sentences are statements from a cited source. AI conclusions get an inline `^[inferred]` suffix; disagreement or unclear sources get `^[ambiguous]`. The Notion publisher renders them visibly (e.g. a grey "AI inference" tag).

## Consequences
Agents reading the brain from other repos can tell sourced facts from guesses. Rendering in Notion must be designed.

## Evidence
reviews/02-obsidian-wiki.md (Provenance Markers).
