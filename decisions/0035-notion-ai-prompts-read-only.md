# 0035 — Notion AI user prompts read, and edit only the page text you own

**Status:** Accepted
**Date:** 2026-10-14

## Context
CC-18 adds saved Notion AI prompts to the Spaces (notion/user-prompts.md): review your day, the Review queue, minutes, meeting prep, weekly review, plan check, tidy a capture, and how-to. Notion AI can also edit pages and properties. An edit made by Notion AI looks to the brain like an edit by you: a changed brain-owned property is read as your correction on the next sync (0023), and a changed Decision on a Review row is applied by `brain apply`. A prompt that "helpfully" fixes a property would change the brain without your yes (0003).

## Decision
- Every prompt **reads** and answers in the chat. Each one ends with the same guard: answer only from the pages named; do not edit any property; do not edit any page.
- **Two exceptions,** because cleaning text is their job:
  - **Review minutes** may correct the minutes text on the open meeting page: typos, names, numbers you confirm, and section headings that follow notion/minutes-format.md. Only before the meeting is marked Reviewed, and never the properties, the checklist or the views.
  - **Tidy a capture** may rewrite the text of the open Capture Inbox page. Never its Name or Brain Status.
- No prompt edits a brain-written section (Brief, Decision log, the body of a Decision or Question page) or a Review row.

## Consequences
- notion/user-prompts.md holds the eight prompts, each with where it goes, what it reads, and its guard line.
- The brain's inputs stay under your control: minutes reach the brain only after you mark them Reviewed (0007), and proposals change the brain only through your Decision.

## Evidence
build/TASKS.md CC-18; decisions 0003, 0007, 0023, 0026.
