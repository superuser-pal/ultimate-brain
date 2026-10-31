# 0056 — The Brain Assistant buttons build in 0.8.0; 0.7.1 is a small patch

**Status:** Accepted
**Date:** 2026-10-31
**Amends:** 0054 (release placement only), 0055 (release order only)

## Context
Decision 0054 planned the Brain Assistant buttons for 0.7.1. Decision 0055, a day later, planned Domains, selected capture and editable Review for 0.8.0 and called 0.7.1's exact accepted-wording mechanism a prerequisite of the new Review flow. On 2026-10-31 the user decided to build the buttons together with 0055's work in 0.8.0, so the two features share one contract pass and one Notion migration series.

## Decision
- **CC-70 to CC-73 and U-22 move from 0.7.1 to 0.8.0.** Their scope, acceptance and the rules of 0054 do not change.
- **The prerequisite stays, inside the release.** CC-79 (editable Review, 0055) builds after CC-72 (accepted wording in the CLI) and reuses its stale, conflict and exact-text rules. CC-75 (0055's contracts) builds after CC-70.
- **Two Notion migrations, in order:** 0012 (buttons) then 0013 (Domains, selection, Review). A space on 0011 runs both; each has its own Verify list.
- **0.7.1 becomes a small patch** of CC-83 (neutral spec examples, done), CC-84 (the release gate counts only the CI workflow's checks) and CC-85 (merge-ready accepts the Codex pass only from the owner's account), so the release process is fixed before the larger release.
- **CC-70 starts by verifying on a test page** what a button's "send message to agent" action passes to Brain Assistant. If it cannot identify the clicked row, the buttons' design returns to the user before CC-71 to CC-73.
- **U-22 is folded into U-23's run**: the acceptance runs stay deferred to the end (as decided 2026-10-29).

## Consequences
- 0054's "Built in 0.7.1" and 0055's "0.7.0 and 0.7.1 keep their existing scope" are historical; this decision governs placement. Everything else in both stands.
- 0.8.0 holds CC-70 to CC-82; reflection stays in 0.9.0 (0055).
