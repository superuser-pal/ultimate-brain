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

### When a module is off (0048)
- **An area home and Home show only what the space has.** Each tab and count belongs to a module, and is left out when that module is off:

  | Tab or count | Module |
  |---|---|
  | Meetings tab, "meetings to review" count | Core |
  | Review waiting tab, "to review" count | Core |
  | Inbox tab | Core |
  | Tasks tab, "due" count, "Due across areas" | Tasks |
  | "What do we know?": Decisions, Concepts · "What's still open here?" | Knowledge |
  | "What do we know?": Documents | Documents |
  | Reports tab (0045), also on project pages | Reports |
  | Goals and projects by goal | Planning |

- **Nothing replaces a left-out tab.** With only Core and Knowledge on, an area home has Meetings, Review waiting, Inbox, "What do we know?" (Decisions, Concepts) and "What's still open here?", and Home's lines read "3 to review · 1 meeting".
- **Turning a module on** adds its tabs and counts as part of its Notion steps (0048); turning it off leaves them in place for the user to hide, like its databases.

### A Review row's area
- **A Review row has at most one area.** The Review database gets one Area relation (a single page).
- **Which area:**
  1. the source's own Area, when the user set one on the Inbox row or the meeting;
  2. otherwise the Area of the source's first project, in the order the source lists them;
  3. otherwise none.
- **When two sources feed one row** (a Conflict), the row takes the newer source's area by the same rule.
- **A row with no area** shows only in the global queue.

## Consequences
- **Notion:** the Areas template, the Home page and the per-area Review filter are part of migration 0010, together with decisions 0048 and 0049. Existing area pages keep their body; the migration says how to add the tabs to the ones the user uses.
- **The brain:** `sync render` writes a Review row's Area by the rule above.
- **The agency brain moves in after 0.6.0,** into an area of its own.
- docs/v2-ideas.md's "Area homes" entry is closed by this decision.

## Evidence
- docs/v2-ideas.md, "Area homes" (2026-10-22).
- The grill of 2026-10-28.
