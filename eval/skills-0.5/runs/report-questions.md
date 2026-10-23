# Questions for the user (taken with defaults while away)

## Request 1: Refresh the report on the Acme website
1. The machine clock says 2026-10-23, but the brain's latest entries are from December 2026 (the report itself is dated 2026-12-11). Which date is "today" for the refresh?
   Default taken: the machine clock (no --now override); the CLI dates the report with it.
2. Publish the refreshed report to Notion now? (settings.publish = ask)
   Default taken: no; Notion is not reachable from this session and no Notion database is configured, so nothing is published.

## Request 2: Catch-up, read-only Inbox pass (batch only; nothing ingested)
Note: brain status shows no Notion database configured (inbox missing), so a strict catch-up skips the Inbox; this batch is built from the exported Inbox query as if the Inbox were reachable.

"Lucía says the blog launch post is ready for review" (capture, New since 2026-10-21)
1. Which project or area does it belong to? Default: Acme website (the only project whose scope includes a blog).

Acme analytics brief (document, Ready)
2. Which project or area? Default: Acme website (the brain's only Acme project). Say if it starts a new project.
3. What do you want from it? all / just ... Default: all.
4. Attachment acme-analytics-brief.pdf (size not in the export): selected. Default: take it, with Keep = all.

Ask row
5. Report on "Where do we stand with Acme analytics?" Default: yes, a new report (no Refresh report set, no Project or Area set).
