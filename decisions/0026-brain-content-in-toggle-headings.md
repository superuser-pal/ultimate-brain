# 0026 — Brain-written page content lives in named toggle headings

**Status:** Accepted
**Date:** 2026-10-11
**Refines:** docs/notion-space-design.md §2 ("Page bodies"), spec/cli.md §5.14.4

## Context
The design said the brain regenerates a page body and leaves the "My notes" toggle alone. But the Projects template mixes brain content (Brief, Decision log) with linked views you rely on (open questions, meetings, tasks, people). Replacing "everything except My notes" would delete those views. Replacing "the text under the Brief heading" doesn't work either, because the brief has `##` headings of its own, so there is no reliable end marker.

## Decision
- On pages that mix brain content with your own blocks, each brain-written part sits **inside a toggle heading with a fixed name**. The brain replaces only the children of that toggle and touches nothing else on the page.
- **Projects:** toggle headings "Brief" and "Decision log".
- **Decisions and Questions** have no template blocks of their own, so the brain owns their whole page body.
- **Areas, Goals, People, Orgs:** no body is published in v1. Their pages are dashboards of linked views; the brain's narrative stays in Markdown, and Notion gets Summary and the other properties.
- **Meetings:** never edited (0007).

## Consequences
- `brain sync render` returns `sections` (toggle name → Markdown) for projects and `body` for decisions and questions (spec/cli.md §5.14.4).
- Prompt 6 creates the two toggle headings. A space built with the earlier Prompt 6 needs a one-time fix: in the Projects template, turn the "Brief" and "Decision log" headings into toggle headings (notion/CHECKLIST.md).
- If you rename either toggle, the brain can't find it and the sync skill reports it instead of guessing.

## Evidence
docs/notion-space-design.md §3.4 and §4 (Projects template), §2 (Page bodies); spec/cli.md §5.14.4.
