# 0021 — Create in Notion, brain owns knowledge afterwards

**Status:** Accepted
**Date:** 2026-10-11
**Amends:** vision.md "Notion inbound" (was: meetings + capture only)

## Decision
- **Creation flows in from Notion:** areas, goals, projects, people and orgs created in Notion are imported by the next `brain sync` as **new notes** (applied directly as `draft`, 0003) and linked by Brain ID.
- **After creation**, each property has one owner:
  - **Brain-owned:** narrative and key facts (summary, why, scope, client, deadline history, role). Shown in Notion; changes go through review.
  - **Notion-owned:** operational fields (status, priority, dates, progress, lifecycle, archive). The brain reads them as pointers and never writes them.
- Unrestricted two-way sync remains forbidden: only creation and Notion-owned operational fields flow in automatically.

## Open (to settle in the space design)
What happens when the user edits a brain-owned property directly in Notion (see docs/notion-space-design.md, open questions).
