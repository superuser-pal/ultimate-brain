# 0067 — Quick follow-ups, scoped tasks and forgiving quotes in the minutes

**Status:** Accepted
**Date:** 2026-11-03
**Amends:** 0055 (the minutes format, and when a quote blocks a meeting)
**Refines:** 0037, 0062
**Amended by:** [0079](0079-lean-minutes-and-follow-ups-as-tasks.md) (2026-11-10): the minutes get a readable part and a For the brain toggle, and a quick follow-up still unticked at the Reviewed read becomes a Task (new format only)

## Context

Two problems with 0.8's meeting summaries, found while using them:

- **"My actions" mixes two kinds of work.** "Send Ana the link" and "Draft the pricing proposal for the board" both become Notion Tasks with nothing but a title. The small ones clutter the task list; the real ones lack what the user needs to do them: what done looks like, when, and for which project. Today a list line without an id blocks the whole meeting, so a plain checklist cannot sit in the minutes either.
- **One bad quote blocks a whole meeting** (dogfood #191). Notion AI often writes quotes of 13 to 19 words, or joins two sentences, although the prompt says at most 12 words, word for word. Each such quote is `SELECTION_UNMAPPABLE`, which blocks the input. In the reported run 29 of 36 items were blocked this way, all in subjects the user had left included. The repair works, but only on a temporary copy: the Notion page keeps the long quotes, so the next read blocks again.

The blocker exists for one reason (0055): the brain must know which transcript paragraphs an **excluded** item rests on, so it never copies them into Git. An included item whose quote cannot be placed puts nothing at risk; it only loses its evidence.

## Decision

Wherever the minutes have **My actions** (the overview and each subject), Notion AI writes two groups instead: **Quick follow-ups**, then **Tasks**.

- **A quick follow-up** is something the user can do right after the meeting in under about 15 minutes, with no deliverable or date that anyone waits on: send a link, forward a file, book a call, reply to someone. When unsure, it is a task. Notion AI decides by common sense. Each one is a Notion **to-do checkbox** with no id and no quote. It stays in Notion: it never becomes a Task, nothing from it enters the brain, and it never blocks the meeting. Everything under a Quick follow-ups heading is read this way, including a line the user moved there.
- **A task** stays an item line in the current form (`[s1.i3] <text> "<quote>"`), followed by a toggle **Scope** with four lines: **Done when**, **Due** (a date, or empty), **Project** and **Notes**. Before setting the meeting to Reviewed the user may edit the Scope, or move a line between the two groups. The ingest reads the Scope as edited: Done when and Notes go into the Notion task's body; Due and Project become its properties, and that Project replaces the one the ingest would have inferred. A Scope the ingest cannot use (a Due that is not a date, a Project it cannot find) holds that one Task back and says why; it never blocks the meeting.
- **Other commitments** and **Track: Waiting On —** are unchanged. Minutes in the 0.8 format, with My actions and no groups, are ingested exactly as today.
- **A quote problem blocks only what it could leak.** For an included item, a quote that is not found word for word is still placed when a stretch of it of 6 to 12 words occurs in exactly one paragraph (the longest such stretch is used); a quote longer than 12 words that occurs once is used as it is. A quote that still cannot be placed, or occurs in several paragraphs, is **reported, not a blocker**: the item enters with its other quotes, or, with none left, is not imported and is named in the report with a repair to make in Notion. For an **excluded** item every quote must still occur word for word in exactly one paragraph, or the meeting is blocked, as now. The prompt is tightened as well: shorter quotes, one sentence each, copied rather than paraphrased.

## Consequences
- The selection contract (spec/capture-and-review.md §3–§4, §6) and `brain source extract-plan` (spec/cli.md §5.22) define the groups, the Scope fields, which quote problems block and how the others are reported. The CLI parses them; the ingest skill turns a Scope into the task's properties and body through the existing `sync tasks` input and the Notion page body, so the sync contract does not change.
- notion/minutes-format.md and its "What you do with it" change; the user pastes the new prompt into Notion AI once. The Meetings database and template do not change, so there is no numbered migration.
- A Scope edited after the task exists is not read again: the task is created once per item (capture-and-review §4.8), and from then on the Notion task is the place to edit it.
- An included item can now enter with less evidence than its summary line suggests, or none. The attended preview shows which quotes were shortened or not placed, and the report names them, so the user can fix the page.

## Evidence
- Planning session with the user, 2026-11-03, and the user's acceptance of this decision the same day: the split, the 15-minute test, "when unsure it's a task", to-do checkboxes kept in Notion, the Scope fields, and the quote rule's direction.
- Dogfood issue #191 (restated here without its content).
- [0055](0055-domains-capture-and-review.md) (selection and the fail-closed rule), [notion/minutes-format.md](../notion/minutes-format.md), [spec/capture-and-review.md](../spec/capture-and-review.md) §4.2.
