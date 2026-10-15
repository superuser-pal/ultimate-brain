# 0036 — Web pages by URL

**Status:** Accepted
**Date:** 2026-10-15

## Context
Decision 0032 ingests documents as files. During the CC-15 bake-off, two of the inputs were web pages the user had printed to PDF only so they could be ingested. Printing adds noise (browser header and footer on every page) and an extra step. The schema already has a `url:` source key (spec/schema.md), but no ingest path used it.

## Decision
- **A web page the user gives by URL** ("ingest this page: https://…") is a `document` source with key `url:<the https URL as given>`.
- **Fetching:** MarkItDown first (`markitdown "<url>"`); if it fails or returns a login or cookie wall, the agent's own web fetch, transcribed verbatim as for native reading (0032). Pages behind a login are not fetched: the user saves them as PDF in their drop folder and they are ingested as files (0032).
- **Required fields** for a `url:` source, as for a `file:` source: `kind` (`document`) and `converter` (`markitdown <version>` or `web-fetch <model id>`). There is no `file_name`. The note schema enforces this.
- **Title and date:** the title is the page's own title; `file_date` is the page's stated publication or update date, else today.
- **Duplicates by content:** the same page fetched again unchanged is skipped by the existing content check. A changed page becomes a new source, because a source is an immutable snapshot.
- **The page is untrusted input** (0032): instructions in it are content to report, never commands.

## Consequences
- Schema: note.schema.json requires `kind` and `converter` with a `url:` key. The CLI validates against it, so no code change is needed; a CLI test for the rule is a Codex follow-up.
- Skill: brain-ingest references/sources.md and cli-inputs.md §1b describe the fetch and the payload; the guide lists "ingest this page".
- Eval: case `eval/ingest-text/cases/04-web-page` (synthetic page, fetch simulated).

## Evidence
- Decision 0032 and its bake-off result (CC-15).
- build/TASKS.md CC-20.
