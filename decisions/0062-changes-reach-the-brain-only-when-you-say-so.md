# 0062 — Changes reach the brain only when you say so

**Status:** Accepted
**Date:** 2026-11-02
**Amends:** 0055 (selection after ingestion), 0058 (what a deleted block does)

## Context
Test T4 (2026-11-02) showed that Notion's page edit time does not move when a block is deleted. Decision 0055 had the catch-up read every ingested meeting page again and compare it with a saved fingerprint, to find a changed selection. Decision 0058 said a deleted block invalidates an acceptance. Both rely on the edit time. Reading all pages again costs tokens on every run and still misses cases. The user decided on 2026-11-02 that removing text from a page is not a way to tell the brain anything.

## Decision
- **The brain does not watch ingested pages.** The catch-up does not read a page again to look for changes after it ingested it. There is no drift scan, no `SELECTION_STALE` record and no saved page fingerprint check.
- **You change what the brain holds by saying so.** To change a selection after ingestion, you edit the tokens and set the meeting back to Reviewed (or the Inbox row back to Ready), as 0045 already does for a corrected input; or you ask the assistant to exclude or change something. The next run reads the page again as a new version. Paragraphs in the old version and not in the new one are suppressed (0055 section 5). The two-minute settle rule and the preview stay.
- **Deleting text in Notion is not a request.** If you delete a block and say nothing, the brain keeps what it has. The docs say so.
- **Accepted wording.** An edit in a later minute than the click still invalidates the acceptance, as in 0058. A deletion is not guaranteed to do so. The skill still re-reads the page just before it saves the wording (verify before apply), and an attended run still shows the full text. A deletion between the click and the first read is a known limit, like the same-minute edit.

## Consequences
- capture-and-review section 4.8 describes explicit re-reads. The drift scan, `SELECTION_STALE` records and `selection_confirmed` go away. CC-78 does not build them.
- cli.md section 5.14.7 and docs/notion-space-design.md section 3.17 stop claiming that a deleted paragraph is detected.
- CC-79 and CC-80 are no longer blocked by T4. 0058 otherwise stands.
