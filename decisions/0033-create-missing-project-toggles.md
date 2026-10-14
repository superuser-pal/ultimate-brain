# 0033 — The sync creates project toggles on a page that has none

**Status:** Accepted
**Date:** 2026-10-14
**Refines:** 0026

## Context
Decision 0026 puts brain-written project content inside the toggle headings "Brief" and "Decision log", and says that when a toggle is missing the sync reports it instead of guessing, because the user may have renamed it. In the first real setup (dogfood finding 12), the project page was created through the Notion API, so the database template never ran: the page had no blocks at all. Every sync then reported `SECTION_NOT_FOUND`, and the project's brief never reached Notion.

## Decision
- When a project page has **no toggle headings at all**, the sync skill appends the missing "Brief" and "Decision log" toggle headings, in that order, and fills them as usual. Such a page is fresh (created without the template), so nothing of the user's can be lost.
- When the page **has other toggle headings** but not the named one, 0026 still applies: report `SECTION_NOT_FOUND` and change nothing, since a rename is likely.
- This is skill-side: the CLI can't see Notion page content. `sync render` is unchanged.

## Consequences
- brain-sync and the ingest's publish step (references/notion.md) gain the rule (CC-16).
- A project created by hand, by the API or by another tool gets its Brief and Decision log on the first sync.

## Evidence
build/TASKS.md, dogfood finding 12; decisions/0026.
