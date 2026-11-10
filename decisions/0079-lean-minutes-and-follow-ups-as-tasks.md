# 0079 — Lean minutes for the reader, and quick follow-ups left unticked become Tasks

**Status:** Accepted
**Date:** 2026-11-10
**Release:** 0.14.0
**Amends:** [0067](0067-quick-follow-ups-scoped-tasks-and-forgiving-quotes.md) (the minutes' layout, and quick follow-ups no longer always stay in Notion); [0078](0078-onboarding-and-early-access-in-0-14-0.md) (0.14.0's scope gains this format, so early testers start on it)
**Refines:** [0055](0055-domains-capture-and-review.md) (where the selection tokens and the quotes sit on the page; the selection itself is unchanged)
**Keeps:** what the brain stores from a meeting (the selected transcript paragraphs, 0055), [0007](0007-notion-meeting-notes-not-deleted.md) (the brain never edits a meeting page's body), [0012](0012-meeting-minutes-reviewed-before-ingest.md) (nothing is read before Reviewed), [0062](0062-changes-reach-the-brain-only-when-you-say-so.md) (an ingested page is not watched), 0067's Scope toggle and its quote rule, the voice-capture format, the feature cutoff at 0.15.0

## Context

The minutes prompt (notion/minutes-format.md) writes every item as `[s1.i1] <text> "<quote>"`, under sub-headings in each subject, with a `Selection:` line under each subject heading. The ids, quotes and Selection lines are what the ingest needs, and they make the summary hard to skim. The user wants a summary that reads quickly without losing the meeting's substance, starting with their own short follow-ups and then the Tasks the brain will create.

During the same grill the user asked what the brain takes from a meeting: the summary or the transcript. It reads both. Git stores only the transcript paragraphs that a selected summary item quotes, and notes are written from those paragraphs; the summary chooses what enters and drives the Tasks, but its wording is not the evidence (spec/capture-and-review.md §4). A summary with no ids is the exception: it is stored whole.

Quick follow-ups (0067) stay in Notion and never become Tasks, so one that isn't done right after the meeting is easily forgotten.

On 2026-11-10 the user ran a scope grill on these questions and chose each option below.

## Decision

### 1. The brain keeps storing transcript paragraphs

What a meeting puts in Git does not change: the transcript paragraphs that selected items quote (0055). The user weighed storing the summary text instead, or both, against a future weekly compaction run: compaction works on notes, and the raw words under them let it check a merge against what was said instead of compressing a paraphrase again. Storing the summary text beside the paragraphs is revisited only if retrieval proves weak once the weekly run exists.

### 2. The page has a readable part and a toggle for the brain

The minutes have two parts: a summary written for the user, and a collapsed toggle **For the brain**.

The readable part, in this order:
1. **In one line:** one sentence on what the meeting was about and what came out of it.
2. **Quick follow-ups:** the owner's to-do checkboxes (0067's 15-minute test), each with a small id tag (`q1`, `q2`, …).
3. **Tasks for the brain:** the owner's explicit commitments that catch-up turns into Tasks, one line each with its item id tag (`s2.i2`) and its Scope toggle (0067, unchanged).
4. **One block per subject,** in the order discussed: a heading with the subject's id tag (`s2`), then a gist sentence (about 25 words at most) with its own item id, then only the lines that apply, each prefixed and ending with its id tag: `Decided:`, `Open:`, `Concern:`, `Waiting on <name>:`, `Idea:` (a tentative idea, only when it matters). No sub-headings inside a subject; about 15 words a line and about 5 lines a subject at most; minor topics merge into one subject `Other`. A subject with nothing decided or left open has its gist line only.

The toggle holds the Attendees and Projects lines, the sentence "All subjects included unless marked Meeting only. Mark Reviewed to confirm.", each subject's `Selection:` line, and the **id → quote list**: each item id with its one to three quotes, under 0067's quote rule.

### 3. One copy of each item

Each item's text is written once, on its readable line; the toggle holds only its quotes. The ingest joins a line to its quotes by the id, so a line the user corrects in the readable part is the text the brain reads. `Meeting only` and `Use in brain` are marked in the toggle, on a subject's Selection line or at the start of an item's quote line. `Track: Waiting On —` stays the user's explicit request to track someone else's commitment, written before the readable line's text; a `Waiting on <name>:` prefix alone only says what kind of line it is.

### 4. A quick follow-up still unticked at the Reviewed read becomes a Task

- When the ingest reads a meeting in the new format (§2), each Quick follow-up that is **unticked** becomes a Notion Task: the checkbox text as its title, the meeting's projects, **no due date**, linked to the meeting like its other Tasks, and no marker that it came from a follow-up.
- This happens at the one read 0062 allows: the user ticks what is done, then marks Reviewed. Marking Reviewed right after the call turns every follow-up into a Task; that is the accepted failure, a Task closed in one click instead of a follow-up forgotten. There is no later sweep of ingested pages.
- The `q` id is recorded with the Task, so a later read of the same meeting (set back to Reviewed) never creates it twice.
- The brain never ticks, edits or annotates the checkbox (0007). The catch-up report counts the follow-ups that became Tasks.
- To keep one from becoming a Task, the user ticks or deletes it before marking Reviewed; there is no new token. Unattended runs create these Tasks too. With the Tasks module off, follow-ups stay in Notion as before.
- A follow-up has no quote: its text never enters Git, only the Notion Task and the brain's record of it.
- Minutes in an earlier format (follow-ups without a `q` id) keep 0067's rule: no Task from a follow-up, on a first read or a re-read.

### 5. Older formats and the voice capture

Minutes written with the 0.9.x prompt (inline quotes), and legacy summaries with no ids, keep ingesting exactly as today; nothing is regenerated. The voice-capture format (notion/voice-format.md) does not change; the CLI reads both the inline-quote shape and the new one.

### 6. Release and gate

The format ships in **0.14.0**, so early testers (0078 §6) start on it and never re-paste a prompt for it. The Notion template (0078 §1) and the setup's minutes check (0078 §2) use the new prompt. Before it ships, the new prompt is run on a synthetic transcript with the bar of capture-and-review T6: at least 9 of 10 items carry an id and quotes that occur in the transcript, and every follow-up carries a `q` id. The id → quote list in a toggle is new for Notion AI, so this is the format's main risk; if the bar is not met, the task reports it and the format goes back to the user before release.

### Out of scope

Storing the summary text as evidence; a sweep of ingested pages for follow-ups still open; the brain ticking a checkbox; a due date or a marker on follow-up Tasks; changing the voice-capture format; any operation on the user's brain or Notion workspace without an explicit yes.

## Consequences

- [build/TASKS.md](../build/TASKS.md): 0.14.0 gains CC-194 (this record), CC-195 (contracts), CC-196 (the CLI), CC-197 (the prompt, Check minutes, the paste guide and the gate) and CC-198 (the ingest and catch-up skills, through the skills fork). CC-189's template and CC-191's minutes check take the prompt from CC-197.
- spec/capture-and-review.md §3–§4 and §6 and spec/cli.md §5.22 define the new shape, the id → quote join, the `q` ids and the follow-up Tasks; `sync tasks` takes a follow-up with its `q` id (CC-195).
- notion/minutes-format.md, notion/pasting-the-minutes-prompt.md and Brain Assistant's Check minutes (notion/brain-assistant.md) change; the user pastes the new prompt once (CC-197).
- 0055, 0067 and 0078 get header pointers to this decision; their bodies stay as recorded.
- This is a planning record: no CLI, schema, spec, skill, template, prompt or Notion change, no brain operation, and no implementation starts with it.

## Evidence

- The user's scope grill, 2026-11-10, Q1 to Q11: the noise and structure of today's summary; the readable part with the toggle; follow-ups first, then Tasks; transcript paragraphs kept as the evidence, weighed against a weekly compaction run; the lean subject layout with one line at the top; one copy of each item with ids and the quotes in the toggle; 0.14.0; the voice format unchanged; unticked follow-ups becoming Tasks at the Reviewed read, with no due date, no marker, a `q` id and the checkbox left alone.
- What the ingest reads today: [spec/capture-and-review.md](../spec/capture-and-review.md) §4, [notion/minutes-format.md](../notion/minutes-format.md), the brain-ingest skill's `references/selection.md` and `references/notion.md` (vendored under `.agents/skills/`).
- [Selection](0055-domains-capture-and-review.md), [quick follow-ups and Scope](0067-quick-follow-ups-scoped-tasks-and-forgiving-quotes.md), [no page watching](0062-changes-reach-the-brain-only-when-you-say-so.md), [onboarding and early access](0078-onboarding-and-early-access-in-0-14-0.md).
