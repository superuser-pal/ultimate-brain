# 0024 — Skills live in the repo; Notion gets generated prompts only

**Status:** Accepted
**Date:** 2026-10-11

## Decision
All executable skills live in the product repo and run in Claude Code / Codex. Notion AI cannot run them (brief).

**Repo skills / commands:** `brain init`, `brain connect-notion`, `brain ingest`, `brain apply`, `brain sync`, `brain query`, `brain link`, `brain lint` / index (inside the others), `brain notion-change` (0022), `brain remember` (v2).

**Notion (Notion AI, no executable skills):**
- building and changing the space from repo-generated prompts (0019, 0022);
- Notion AI meeting notes (transcript → summary that you review);
- a **minutes format prompt** saved in the Meetings template, so every summary has the same sections (Attendees, Decisions, Action items with owner and due date, Facts & numbers, Open questions, Risks);
- read-only lookups over published pages.

The minutes format prompt text lives in the repo (0022).

## Also decided
The Meetings database is the home for new meetings; only recent loose meeting pages (last 1–2 months) are moved in.
