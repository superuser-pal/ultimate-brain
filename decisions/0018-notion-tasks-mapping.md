# 0018 — Tasks database: map to the user's existing one, ship a default

**Status:** Accepted
**Date:** 2026-10-11

## Decision
- Action items go to the user's **existing** Notion Tasks database. `brain.json` holds a mapping: database id, and which property holds the title, due date, status, project relation, area relation, owner, and the backlink to the brain meeting summary.
- The Notion template ships a **minimal default Tasks database** for new users with no task system; its mapping is pre-filled.
- The brain never models task workflow (statuses, recurrence, contexts). Task status is a pointer fact (0011).

## Evidence
docs/notion-second-brain-template-comparison.md (task engines are not the moat), user decision 2026-10-11.
