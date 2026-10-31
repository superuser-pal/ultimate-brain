# 0057 — Reports are not proposal targets; Git-only knowledge is named, not proposed

**Status:** Accepted
**Date:** 2026-10-31
**Amends:** 0054 (one sentence: "useful additions only Git knows are proposed separately", for reports)

## Context
Decision 0054 says that when the user accepts a refreshed report, useful additions that only Git knows are "proposed separately". A proposal needs a knowledge note as its target (schema §11); a report is a derived view and cannot be one (cli.md §5.12). Codex found this while reviewing CC-70 (PR #159). The user decided on 2026-10-31: reports won't be proposal targets.

## Decision
- **A report is never a proposal target,** and its accepted text never becomes evidence for a new note (0054, unchanged).
- **For a Document, nothing changes:** the Related knowledge appendix is an `add_to_note` proposal on the Document (0054).
- **For a report,** the catch-up **names** useful knowledge that only Git has ("Not in the accepted refresh: …") and offers a full refresh. The user decides; nothing is proposed or written.
- **A full refresh** (Refresh asked) runs as before, **unless** accepted, pending or unaccepted wording is waiting on that report (cli.md §5.14.7): then the refresh itself waits, Refresh asked stays ticked, and the user is told to resolve the Notion text first.

## Consequences
- cli.md §5.14.7 and §6.1 say so. 0054's other rules stand.
