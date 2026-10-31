# 0058 — Accepted wording is current as of the end of the click's minute

**Status:** Accepted
**Date:** 2026-10-31
**Amends:** 0054 (what "accepted exactly" means), 0051 (what an unattended run may import)

## Context
Decision 0054 imports only wording the user accepted "exactly" and "still current", and 0051 lets an unattended run import only explicit, exact, current decisions. Accepting is a Notion button that sets Accepted and Accepted at. Notion rounds edit times to the minute and a button cannot copy the text, so an edit made in the same minute as the click, and before the first read, cannot be told from the click's own write. Codex found this reviewing CC-70 (PR #159). On 2026-10-31 the user chose to bound the limit, not remove it.

## Decision
- **"Exact" means the text the page held at the end of the minute of the click.** An edit in a later minute, a deleted block included, invalidates the acceptance (cli.md §5.14.7). An edit inside the click's own minute and before the first read is a **known, accepted limit**: nothing in the CLI or the skills can detect it.
- **Attended runs show the full text.** The skill shows each item as a unified diff of the replacement against the Git body and imports only after the user says yes. The user can inspect the exact text before it enters Git.
- **Unattended runs may import such an acceptance** once it is at least 2 minutes old, after the skill re-reads the page and finds it unchanged. The 2-minute age only guarantees the click's minute is over; it does not detect an edit inside it. The unattended report says so and lists each imported Document.
- **The stronger option stays available:** a witness copy of the text written at the click (Brain Assistant copies the body into a property) would remove the limit. It was not chosen: it needs permission for Brain Assistant to edit a property, an AI copy of a long text is unreliable, and Notion limits property size. A later decision can adopt it.

## Consequences
- cli.md §5.14.7 and §6.1 and docs/notion-space-design.md §3.17 describe it. 0054 and 0051 otherwise stand.
