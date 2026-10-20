# 0041 — Your review makes notes reviewed, answers your questions and feeds the Brief

**Status:** Accepted
**Date:** 2026-10-20
**Amends:** 0005, 0026

## Context
A look at the first brain's use from 2026-10-13 to 2026-10-20 (in a grill with the user, 2026-10-20):
- **Every knowledge note is still `draft`** (33 of 33). Decision 0005 lets only the user set `reviewed`, by hand in Notion, one note at a time. Nobody did.
- **The review queue is a rubber stamp:** 23 of 24 proposals approved. All but one were links or text additions.
- **The brain never answered a question.** Every session was "ingest", "apply", "process the drop folder" or "catch up"; none used brain-query. The user looks things up in Notion search first, and asks Claude only when that fails.
- **Open questions pile up.** 9 questions are open; nothing tells the user when later material answers one.

The user chose payback as the 0.4.0 theme: the brain should give back, in Notion, where the user already looks.

## Decision
- **One "Review notes" row per ingest.** Each ingest that creates knowledge notes also writes one proposal of a new kind, `review_notes`, listing those notes: "Accept 7 new notes from <source>: a) …, b) …". In Notion it's a Review row like any other.
  - **Approve:** every listed note that is still `draft` becomes `reviewed`.
  - **Approve with "all except b"** (a Note, read as for a grouped `add_link`, 0037): the excluded notes stay `draft`; the Note is kept on the proposal, and the next catch-up's report names them once.
  - **Reject:** every listed note that is still `draft` becomes `archived`, with no successor. Nothing is deleted: the source still explains what was extracted and why it was dropped.
  - **Edit** is not allowed (`EDIT_NOT_ALLOWED`), as for a link row.
  - A listed note that is no longer `draft` when the row is applied (you changed its Lifecycle in Notion) is left as it is and reported.
- **The backlog gets the same rows once.** The first catch-up after the upgrade writes one `review_notes` row per source for the `draft` notes the source created, so an existing brain catches up in a few clicks.
- **Answers to open questions.** When an ingest finds that the new material answers an open question, it writes a proposal of a new kind, `answer`, on that question: the answer in a sentence, the quote, and the answering note when there is one (usually a decision the same ingest created).
  - **Approve:** the question's `answer` is set to that note's id (or the sentence when there is no note), and the publish sets the question's Notion **Status** to **Answered**. Status stays yours in every other case: the brain writes it only from an `answer` you approved.
  - **Edit:** your Note becomes the answer, as text.
  - **Reject:** nothing changes; the question stays open.
- **The Brief shows only what you reviewed.** In a project's Brief (spec/schema.md §16.1), Recent decisions and Open questions list only notes whose lifecycle is `reviewed`. Open questions also leave out questions that have an `answer`. When a section has nothing reviewed but has `draft` notes waiting, it says so: "- Nothing reviewed yet: 4 notes waiting in Review". The Brief is a derived view, so it is rebuilt on every run with no proposal (0003 covers knowledge, not views).
- **Areas get a Brief too.** A new derived view, `area_brief`, with the same rules: the area's projects with their Status, recent reviewed decisions and open reviewed questions across the area. It is published into a "Brief" toggle heading on the area page. When the page has no "Brief" toggle, the publish appends one at the end of the page (the page is the user's, so the brain never inserts above the user's content); the user may drag it to the top once.

## Consequences
- **Amends 0005:** an agent sets `reviewed` and `archived` (without a successor) when, and only when, it applies a `review_notes` row you decided. The user still decides every change of lifecycle.
- **Amends 0026:** the brain writes inside a "Brief" toggle on area pages, as on project pages; the rest of an area page stays yours.
- **The Notion question Status is written by the brain in one case only:** an approved `answer`. spec/schema.md §14 and §7 say so.
- **Review gains two Kinds,** "Review notes" and "Answer", in a Notion migration (0006) the agent can run through the API. The area "Brief" toggle needs no step by hand.
- **The Brief's status line stays factual:** it shows the project's Status and Priority from Notion and its key facts, not prose written by an agent, so the view stays rebuildable from the notes.
- **The next catch-up after any ingest has more rows:** one Review notes row per ingest, plus an Answer row per answered question. Each is one click.
- spec/schema.md (§8, §11, §16), spec/cli.md, the JSON schemas, brain-ingest, brain-apply, brain-catch-up and the user guide follow.

## Evidence
The brain's `log/2026-10.md` and Git history (40 commits, 9 sources, 33 notes all `draft`, 24 proposals: 23 applied, 1 closed); the five Claude Code sessions in the brain (no query); the grill of 2026-10-20 (build/TASKS.md, 0.4.0). Decisions 0003, 0005, 0026, 0028, 0033, 0037.
