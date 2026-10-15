# 0035 — Brain Assistant (Notion AI) reads, and edits only the page text you own

**Status:** Accepted
**Date:** 2026-10-14

## Context
CC-18 adds Brain Assistant, a Notion Custom Agent with seven skills (notion/brain-assistant.md): Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture, plus how-to answers. Notion AI can also edit pages and properties. An edit made by Notion AI looks to the brain like an edit by you: a changed brain-owned property is read as your correction on the next sync (0023), and a changed Decision on a Review row is applied by `brain apply`. A prompt that "helpfully" fixes a property would change the brain without your yes (0003).

## Decision
- Brain Assistant **reads** and answers in the chat. Its Instructions carry the guard once for every skill: answer only from Brain Data and How it works; never edit any property or page.
- Its **Tools and access** hold only Brain Data, How it works and its skills database, so the scope is enforced, not only requested. Edit access only on Meetings and Capture Inbox.
- **Two exceptions,** because cleaning text is their job:
  - **Check minutes** may correct the minutes text on the open meeting page: typos, names, numbers you confirm, and section headings that follow notion/minutes-format.md. Only before the meeting is marked Reviewed, and never the properties, the checklist or the views.
  - **Tidy capture** may rewrite the text of the open Capture Inbox page. Never its Name or Brain Status.
- No skill edits a brain-written section (Brief, Decision log, the body of a Decision or Question page) or a Review row.

## Consequences
- notion/brain-assistant.md holds the setup, the Instructions and the seven skills.
- An earlier draft placed eight copy-paste prompts in "Ask AI" toggles; Notion's Custom Agents and Skills replaced it on 2026-10-14, because they scope access and run by name from any page.
- The brain's inputs stay under your control: minutes reach the brain only after you mark them Reviewed (0007), and proposals change the brain only through your Decision.

## Evidence
build/TASKS.md CC-18; decisions 0003, 0007, 0023, 0026.
