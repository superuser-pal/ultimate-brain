# 0037 — Intake experience: catch-up, drop folder, Inbox, Concepts and grouped reviews

**Status:** Accepted
**Date:** 2026-10-15

## Context
The CC-15 acceptance run (2026-10-15, 0.2.0) took two documents from the drop folder and three pasted emails from the Capture Inbox all the way through ingest, apply and publish. Every step worked, but using it was harder than it should be:
- There was no command for "do what's waiting". The user asked "what is next", and the agent chained brain-apply, brain-ingest and publish on its own initiative.
- Documents must be named one by one. After the run, 3 of the 5 files in the drop folder were still not ingested, and nothing showed which ones.
- A document's main result, a concept note, is not published (spec/schema.md: "concept · not published in v1"). The user saw it only through a Review row.
- Most Review rows were routine `add_link` changes: 4 of 7 added a person to a project, and 2 of 3 linked a source to its project.
- Each capture needed a project question, and the user's work name (different from their brain name) came up in the middle of an ingest.
- The user's own action item from an email appeared only in the chat report (extraction.md: no tasks from non-meeting sources).
- The user typed a role into an Edit on an `add_link` row, a change that row can't carry.
- Every run asked for permission to publish, nothing pushed the brain repo, and the reports ran long.

The fixes were agreed with the user in a grill session on 2026-10-15. Small skill-only fixes go into 0.2.1; everything that changes a decision or the Notion schema goes into 0.3.0, so the user's Notion space is changed once.

## Decision

### 0.2.1 (skills and CLI bug fixes)
- **"Process my drop folder":** the ingest skill lists the files at the top level of the user's drop folder (type, size, pages or slides) and asks **one** question listing which to ingest, with all of them selected by default. Large files get the existing long-document question ("which parts matter?").
- **`processed/` subfolder:** after a file is ingested (or found to be a `DUPLICATE_SOURCE`), the skill moves it to `<drop folder>/processed/`. A file the user skips moves to `<drop folder>/skipped/`. The top level of the folder is then the queue. `processed/` keeps the originals, because the brain stores only the converted text, and the user may empty it at any time.
- **Edit on a link row:** `sync plan` reports an Edit on an `add_link` row as a plan conflict the user sees before anything is applied (the CC-15 finding).
- **Faster publish through the MCP:** independent page writes are sent in parallel, and pages aren't read back unless a write needs their current content. Decision 0015 still applies.
- **Fixed report shape** for every ingest, apply and publish run (three lines; details only when the user asks):
  ```
  Applied 9 · Ingested 3 captures, 2 files · 12 new notes · 1 task for you
  Needs you: 3 Review rows (1 grouped) · 2 files skipped (too long, say which parts)
  Next: decide in Notion, then "catch up"
  ```

### 0.3.0 (new behaviour and Notion schema)
- **"Catch up":** one command that applies decided reviews, ingests Reviewed meetings, then New Inbox rows, then the drop folder, publishes, and gives one report in the shape above. It first does a **read-only pass**, asks **every** blocking question in one batch, then runs without stopping. Anything that becomes blocked mid-run is skipped and listed in the report. The separate commands remain. A scheduled catch-up is a v2 idea.
- **Inbox replaces the Capture Inbox.** It is the list of everything that came into the brain, except meetings (they have their own database with Brain Status):

  | Kind | How the row appears | Brain Status |
  |---|---|---|
  | Capture (including a pasted email or chat) | The user, through Quick capture | New → Processed or Skipped |
  | Document (drop folder or URL, 0036) | The brain, at ingest | created as Processed |
  | Email, chat or note pasted to the agent | The brain, at ingest | created as Processed |

  New properties: **Kind** (select; System), **Summary** (one line on what it taught; Brain), **Produced** (relations to the notes the ingest created; Brain), and optional **Project** and **Area** relations (You). The user's Name and page body are never overwritten. Views: **Inbox** (New) and **History** (Processed, newest first). This replaces the "Sources database" item from the 0.3.0 list.
- **Project on a capture:** when the user sets Project (or Area) on an Inbox row, the ingest uses it and doesn't ask. When it is empty, the existing pre-check question still applies.
- **Concepts database:** concept notes are published to a new Concepts database, a "Concepts" tab under Knowledge, related to their projects, areas and sources. Brain-owned like Decisions. The Inbox records what came in; Concepts holds what the brain learned from it.
- **Grouped link proposals:** the routine `add_link` changes from one ingest that target the same note (people joining a project, sources linked to a project, aliases) become **one** Review row ("Acme rollout: add 4 people (…)"). Each change is still a proposal the user decides (0003 and 0028 unchanged in substance).
- **Note on every Review row** replaces Edited Value. Apply reads it:
  - On a grouped row, a Rejected or Approved row with a Note ("all except X") is applied as the Note says.
  - When a Note describes a different change (a role typed on a link row), the skill proposes that change as its own row, or asks. It never applies it silently.
  - On an `update_fact` or `add_to_note` row, the Note carries the corrected value, as Edit does today.
- **Your identities at onboarding:** onboarding asks for every name and work email address the owner appears under, and stores them as aliases on the owner's person note.
- **Tasks for the owner from non-meeting sources:** an action item in a document, email, chat or capture that is addressed to the **owner** becomes a Notion task, linked to the source and to its project. Due date only when the text gives one; never an invented default. Action items for other people stay in the note text. This changes 0032's "no action items" rule and the matching lines in extraction.md and sources.md.
- **Settings in `brain.json`:** `publish: ask | auto` (default `ask`; after a run the user was happy with, the skill offers to switch) and `push: remind | auto` (default `remind`: the report says "N commits not pushed"; `auto` pushes after the run's commits).

## Consequences
- 0.2.1: brain-ingest (sources.md drop-folder procedure, report template), brain-apply and brain-sync (report template, parallel publish), Codex: the `sync plan` conflict.
- 0.3.0: a new "catch up" skill or brain-ingest mode; spec/schema.md (concept published; Inbox properties), note.schema.json, notion-space-design §3.11 rewritten as Inbox and a new Concepts section, Knowledge Space tabs, Review database (Note replaces Edited Value), spec/cli.md (grouped `add_link` proposals, `brain.json` settings, Inbox and Concepts in `sync render`), the onboarding plan, extraction.md and sources.md (owner tasks), the user guide. Codex owns the CLI parts.
- The user's Notion space is changed once, at 0.3.0, through the brain-notion-change skill (0022).
- docs/v2-ideas.md: scheduled catch-up (Schedulers) and the CLI writing to Notion with a token (Direct Notion API client) both cite this run as evidence. Neither is decided here.

## Evidence
- build/TASKS.md CC-15 (acceptance run parts 1 and 2, 2026-10-15) and its 0.2.1 findings.
- Decisions 0003, 0015, 0028, 0032, 0036.
- Grill session with the user, 2026-10-15 (questions Q1–Q19).
