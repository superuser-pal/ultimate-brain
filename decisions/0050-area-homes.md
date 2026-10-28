# 0050 — Area homes

**Status:** Accepted
**Date:** 2026-10-28

## Context
With one area, the Spaces work unfiltered. The agency brain and the product repo (0042) will bring at least three areas: the user's day-job area, the agency and Ultimate Brain. Every view would then need an area filter. On 2026-10-22 the user raised this and agreed a shape (docs/v2-ideas.md, "Area homes"): each Area page becomes that area's home. Two points stayed open, and the user decided them on 2026-10-28.

## Decision
### Each Area page is that area's home (0.6.0)
- **The Areas template gains the missing tabs:** today's tasks, meetings, **Review waiting** and the Inbox, each filtered to the area. They sit next to its "What do we know?" and "What's still open here?" tabs and its Brief (0041).
- **A new area is one page from the template.** There is no copy of the Spaces and no migration per area.

### Review stays one queue
- **Review → Needs my decision keeps every row,** whatever its area.
- **Each area home also has a "Review waiting" tab:** the same rows, filtered to that area. It's the same rows with two ways in, so no area is forgotten.

### Home shows per-area counts first
- **The top-level Home starts with one line per area:** its Review rows waiting, tasks due and meetings to review.
- **Then everything due across areas.**

  ```
  Day job      3 to review · 2 due today · 1 meeting
  Agency       4 to review · 0 due · 0 meetings
  Ult. Brain   0 to review · 1 due

  Due across areas
    ☐ Confirm the November date      today
  ```

## Consequences
- **Notion:** the Areas template, the Home page and the per-area Review filter are part of migration 0010, together with decisions 0048 and 0049. Existing area pages keep their body; the migration says how to add the tabs to the ones the user uses.
- **The brain:** a Review row needs an area for the per-area tab. It takes the area of its source's project or area; a row with none shows only in the global queue.
- **The agency brain moves in after 0.6.0,** into an area of its own.
- docs/v2-ideas.md's "Area homes" entry is closed by this decision.

## Evidence
- docs/v2-ideas.md, "Area homes" (2026-10-22).
- The grill of 2026-10-28.
