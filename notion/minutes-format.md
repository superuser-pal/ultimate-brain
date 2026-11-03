# Minutes format

Paste it into Notion AI when it summarises a meeting, and use it for the "Minutes follow the format" item of the Meetings checklist (docs/notion-space-design.md §9). Every meeting summary then has the same shape: the overview, then one section per subject, with every item on a line of its own that carries an id and quotes from the transcript. That shape is what lets you leave a subject or an item out of the brain (decision 0055, spec/capture-and-review.md §3 and §4). The ingest skill reads it; change it only through the repo (decision 0022). A summary in another shape is still ingested whole, as before, but nothing in it can be left out, and the assistant says so.

**Since 0.9.0 (decision 0067)** "My actions" is two groups, Quick follow-ups and Tasks, and each task has a Scope toggle. Minutes written with the earlier prompt, with "My actions", are still read exactly as before. To switch, paste the prompt below into Notion AI again ([pasting-the-minutes-prompt.md](pasting-the-minutes-prompt.md)).

The old eleven-heading format (Attendees, Projects, Action Items, Decisions, Open Questions, Risks, Meeting Purpose, Background, Current Status, Requirements and Deadlines, Other relevant topics) is replaced. Attendees and Projects still come first because the ingest asks about them when the meeting's properties are empty.

```text
Summarize the meeting transcript as structured, factual meeting notes, in exactly this shape.

## Attendees
ONE plain line: full names separated by commas, each with their organization, team or role when mentioned. No bullets.

## Projects
ONE plain line: every project the meeting touched, separated by commas, with each name as it was said. No bullets.

## Highlights
The few things that matter most. Every item is a line in the item form below, using the id [s0.i1], [s0.i2], ...

## Quick follow-ups
## Tasks
Only actions the meeting owner committed to explicitly, split into these two groups (rules below). Task items continue the [s0.iN] numbers.

Then one section per substantive subject, in the order discussed:

## [s1] <Subject>
Selection: Use in brain
Inside a subject, in this order, only the sub-headings that apply:
### Highlights   (why it matters)
### Decisions   (an agreement reached)
### Quick follow-ups
### Tasks
### Other commitments   (what someone else said they would do)
### Open questions
### Concerns raised   (only what the conversation supports)

Number the subjects [s1], [s2], ... Write every item (in the overview as [s0.iN], in a subject as [sN.iM]) as ONE line in exactly this form:
[s1.i1] <text> "<quote>"
- The id is visible, unique in the page and never changed once written.
- Each quote is copied character for character from the transcript: one stretch of one sentence, 6 to 12 words, that occurs only once in the transcript. Never join two sentences into one quote, never fix grammar, never paraphrase. Count the words: if a quote has more than 12, cut it down to its most distinctive 12. When the support spans more than one place, add a second or third quote (up to three) rather than one long one.
- When an item only makes sense with another one, end the line with (depends on [s1.i1]).
- Write "Track: Waiting On —" before the text only when I asked to track that person's commitment. Never write it yourself.
- Never put "Meeting only:" or "Use in brain:" on an item yourself.
- Under a subject heading, write the line "Selection: Use in brain" and nothing else on that line. The overview (Highlights, Quick follow-ups, Tasks) has no Selection line.
- Every list line other than Attendees, Projects and the quick follow-up checkboxes must be an item in this form. A bullet without an id anywhere else blocks the whole meeting from the brain.
- Put the sentence "All subjects included unless marked Meeting only. Mark Reviewed to confirm." once, under the title, before the first section.

Quick follow-ups and Tasks (the owner's own actions, in the overview and in each subject):
- A quick follow-up is something I can do right after the meeting in under about 15 minutes, with no deliverable or date that anyone waits on: send a link, forward a file, book a call, reply to someone. When unsure, it is a task.
- Write each quick follow-up under "Quick follow-ups" as a to-do checkbox with a short imperative, and nothing else: no id, no quote.
- Write each task under "Tasks" as an item line in the form above, then directly below it a toggle titled "Scope" holding exactly these four lines:
  Done when: <what finished looks like, in one sentence>
  Due: <the date as YYYY-MM-DD when one was said; otherwise leave it empty>
  Project: <the project's name as it was said; otherwise leave it empty>
  Notes: <context I will need to do it; otherwise leave it empty>
- Never invent a date, a project or a criterion for a Scope: leave the line empty.

Rules:
- Omit a sub-heading with nothing under it. Write nothing under a heading you would fill with "None".
- Never repeat a sentence in the overview and in a subject.
- Never invent a risk, an owner, a date or a conclusion. Write "needs clarification" when the owner or the meaning is uncertain.
- A tentative idea ("we could...") is not a commitment: leave it out of Quick follow-ups, Tasks and Other commitments, or put it under Open questions.
- Preserve names, teams, acronyms, dates, numbers, qualifications and substantive context exactly as said, and keep the references to documents and sources the speakers gave.
- Distinguish confirmed information from expectations and open questions.
- Omit small talk and repetition. Do not mark anything "Meeting only" yourself.
```

## What you do with it

- **Leave a subject out:** change its line to `Selection: Meeting only`. Everything under it stays in Notion and stays out of the brain.
- **Leave one item out:** write `Meeting only:` at the start of its text. **Keep one item inside an excluded subject:** write `Use in brain:` at the start.
- **Confirm:** set the meeting to **Reviewed**. Until then nothing is ingested. Reviewed confirms what you can see on the page, no more.
- **Change your mind later:** edit the tokens and set the meeting to Reviewed again. A deletion on its own is not a request; the brain keeps what it has until you ask (decision 0062).
- **Track someone else's commitment:** write `Track: Waiting On —` before that item's text. Without it, only your own explicit commitments become Tasks.
- **Quick follow-ups stay here.** Tick them off on the meeting page. They never become Tasks, nothing from them enters the brain, and they never block the meeting.
- **Shape a task before Reviewed:** edit its **Scope** toggle. **Due** (a date, `YYYY-MM-DD`) and **Project** become the Task's properties, and that Project replaces the one the brain would have picked; **Done when** and **Notes** go into the Task's page. Leave a line empty and the brain decides as before. A Scope it can't use (a Due that isn't a date, a Project it can't find) holds back only that Task, and the brain says why. The Scope is read once, when the Task is created; after that, edit the Task itself.
- **Move a line between the groups:** drag a task line under Quick follow-ups and it becomes a quick follow-up (its Scope is ignored). Drag a checkbox under Tasks and it needs an id and a quote: the ingest proposes them in its preview, and an unattended run waits for you.
- **A quote that is too long or slightly reworded** no longer blocks the meeting: the brain places it by the part that matches or, if it can't, leaves out only that item and tells you which one to fix. Only a quote of something marked **Meeting only** must match the transcript exactly, so the brain knows what to keep out.
