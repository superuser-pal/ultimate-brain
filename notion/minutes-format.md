# Minutes format

Paste it into Notion AI when it summarises a meeting, and use it for the "Minutes follow the format" item of the Meetings checklist (docs/notion-space-design.md §9). Every meeting summary then has the same shape: the overview, then one section per subject, with every item on a line of its own that carries an id and quotes from the transcript. That shape is what lets you leave a subject or an item out of the brain (decision 0055, spec/capture-and-review.md §3 and §4). The ingest skill reads it; change it only through the repo (decision 0022). A summary in another shape is still ingested whole, as before, but nothing in it can be left out, and the assistant says so.

The old eleven-heading format (Attendees, Projects, Action Items, Decisions, Open Questions, Risks, Meeting Purpose, Background, Current Status, Requirements and Deadlines, Other relevant topics) is replaced. Attendees and Projects still come first because the ingest asks about them when the meeting's properties are empty.

```text
Summarize the meeting transcript as structured, factual meeting notes, in exactly this shape.

## Attendees
Full names, with their organization, team or role when mentioned.

## Projects
Every project the meeting touched, one per line, with the project's name as it was said.

## Highlights
The few things that matter most, one item per line.

## My actions
Only commitments the meeting owner made explicitly. One item per line.

Then one section per substantive subject, in the order discussed:

## [s1] <Subject>
Selection: Use in brain
Inside a subject, in this order, only the sub-headings that apply:
### Highlights   (why it matters)
### Decisions   (an agreement reached)
### My actions
### Other commitments   (what someone else said they would do)
### Open questions
### Concerns raised   (only what the conversation supports)

Number the subjects [s1], [s2], ... and write every item as ONE line in exactly this form:
[s1.i1] <text> "<quote>"
- The id is visible, unique in the page and never changed once written.
- Each quote is copied word for word from the transcript, at most 12 words long, and occurs once in the transcript. Add a second or third quote (up to three) when the support spans more than one place. Make a quote longer, never shorter, to make it unique.
- When an item only makes sense with another one, end the line with (depends on [s1.i1]).
- Write "Track: Waiting On —" before the text only when I asked to track that person's commitment. Never write it yourself.
- Never put "Meeting only:" or "Use in brain:" on an item yourself.
- Under a subject heading, write the line "Selection: Use in brain" and nothing else on that line. The overview Highlights and My actions have no Selection line.
- Put the sentence "All subjects included unless marked Meeting only. Mark Reviewed to confirm." once, under the title, before the first section.

Rules:
- Omit a sub-heading with nothing under it. Write nothing under a heading you would fill with "None".
- Never repeat a sentence in the overview and in a subject.
- Never invent a risk, an owner, a date or a conclusion. Write "needs clarification" when the owner or the meaning is uncertain.
- A tentative idea ("we could...") is not a commitment: leave it out of My actions and Other commitments, or put it under Open questions.
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
