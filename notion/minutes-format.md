# Minutes format

Paste it into the Notion AI chat on a meeting page, with the transcript on the page ([pasting-the-minutes-prompt.md](pasting-the-minutes-prompt.md)), and use it for the "Minutes follow the format" item of the Meetings checklist (docs/notion-space-design.md §9). Every meeting summary then has the same shape: a short summary written for you, and a collapsed toggle **For the brain** with what the brain needs. Every line of the summary ends with a small id tag, and the toggle holds each line's quotes from the transcript. That is what lets you leave a subject or an item out of the brain (decisions 0055 and 0079, spec/capture-and-review.md §3.3 and §4.1). The ingest skill reads it; change it only through the repo (decision 0022). A summary in another shape is still ingested whole, as before, but nothing in it can be left out, and the assistant says so.

**Since 0.14.0 (decision 0079)** the minutes are lean: one line on the meeting, your quick follow-ups, the Tasks the brain will create, then a few prefixed lines per subject. The ids and quotes moved into the For the brain toggle, and each item is written once. A quick follow-up you haven't ticked when you mark the meeting Reviewed becomes a Task. To switch, use the prompt below in the Notion AI chat on each meeting page ([pasting-the-minutes-prompt.md](pasting-the-minutes-prompt.md)).

**Earlier minutes** are read exactly as before and need no change: the 0.9.x shape (Highlights, Quick follow-ups, Tasks and one section per subject, with each quote on its item's line), minutes with one "My actions" group, and summaries with no ids. In those, a quick follow-up never becomes a Task.

```text
Write the minutes of the meeting transcript for me: a short summary I can skim, then one collapsed toggle with what my brain needs. Write exactly this shape, in this order, and nothing else.

1. ONE LINE
A plain paragraph (not a bullet) that starts with "In one line:" and gives one sentence on what the meeting was about and what came out of it.

2. QUICK FOLLOW-UPS
The heading "## Quick follow-ups", then each quick follow-up as a to-do checkbox with a short imperative, ending with its tag:
- [ ] Send Ana the slides from today [q1]
A quick follow-up is something I said I would do that takes me under about 15 minutes right after the meeting, with no deliverable or date anyone waits on: send a link, forward a file, book a call, reply to someone. When unsure, it is a task (3). Number them [q1], [q2], ... in the order they came up. No quote. Leave out the heading when there are none.

3. TASKS FOR THE BRAIN
The heading "## Tasks for the brain", then each task I committed to explicitly, as ONE line ending with its tag:
Write the hiring plan for the support team [s2.i4]
Directly below each task line, a toggle titled "Scope" holding exactly these four lines:
Done when: <what finished looks like, in one sentence>
Due: <the date as YYYY-MM-DD when one was said; otherwise leave it empty>
Project: <a name from the Projects line, only when the task belongs to that project; otherwise leave it empty>
Notes: <context I will need to do it; otherwise leave it empty>
A task's tag names the subject it was discussed in (4) and takes the next item number of that subject: [s2.i4] when that subject's own lines use i1 to i3. A task that belongs to no subject is [s0.i1], [s0.i2], ... Never invent a date, a project or a criterion for a Scope: leave the line empty. Leave out the heading when there are none.

4. ONE BLOCK PER SUBJECT
Each substantive subject, in the order discussed, numbered [s1], [s2], ...:
## <Subject> [s1]
Then a gist line: one sentence of at most 25 words on what was discussed and why it matters, ending with [s1.i1].
Then only the lines that apply, each ONE line of at most 15 words that starts with one of these prefixes and ends with its tag [s1.i2], [s1.i3], ...:
Decided: an agreement reached.
Open: what a later meeting, document or answer can settle. Never an action.
Concern: a risk or worry the conversation supports.
Waiting on <name>: what someone else committed to do.
Idea: a tentative idea ("we could..."), only when it matters.
At most 5 lines per subject, the gist line included. No sub-headings and no other lines inside a subject. A subject where nothing was decided or left open has its gist line only. Merge minor topics into one last subject titled "Other". Leave out small talk.

5. THE TOGGLE FOR THE BRAIN
Last, one toggle block (a toggle, not a toggle heading) titled exactly "For the brain", collapsed, holding these plain lines in this order:
Attendees: <full names separated by commas, each with their organization, team or role when mentioned>
Projects: <every project the meeting named as a project (a product, client or initiative with that name), separated by commas, each name as it was said. A subject of the meeting is not a project: never list a subject's title>
All subjects included unless marked Meeting only. Mark Reviewed to confirm.
Then the quote lines of any [s0] tasks, then for each subject in page order its selection line followed by one quote line for each of its items, its tasks included:
[s1] Selection: Use in brain
[s1.i1] "<quote>"
[s1.i2] "<quote>" "<quote>"
Nothing else goes in the toggle: no other toggle, no headings, no item text.

Ids and tags:
- Every summary line in 3 and 4 (each task, each subject heading, each gist and prefixed line) ends with its tag in square brackets, and has nothing after it. One tag per line, never in the middle of a line. A line there without a tag blocks the whole meeting from my brain.
- Every item (each task, gist and prefixed line) has exactly one quote line in the toggle with the same id, and each quote line has a summary line with the same id.
- Ids are unique on the page and never change once written. Write each item once: a task is not repeated in its subject's block.

Quotes (only in the toggle, never on a summary line):
- Each quote line holds one to three quotes, each in double quotes, after the id.
- Each quote is copied character for character from the transcript: one stretch of one sentence, 6 to 12 words, that occurs only once in the transcript. Never join two sentences into one quote, never fix grammar, never paraphrase. Count the words: if a quote has more than 12, cut it down to its most distinctive 12. When the support spans more than one place, add a second or third quote rather than one long one.
- When an item only makes sense with another one, end its quote line with (depends on [s1.i1]).

Rules:
- Never write "Meeting only:" or "Use in brain:" anywhere. The only selection text you write is "Selection: Use in brain" on the selection lines.
- Write "Track: Waiting On —" at the start of a line only when I asked to track that person's commitment. Never write it yourself.
- An action is never Open, even when it was said as a question ("can you send me the plan?"): an action I take on is a quick follow-up or a task, someone else's is Waiting on <name>. A risk or worry is a Concern. A tentative idea is never a task, a Waiting on or Open.
- Never invent a risk, an owner, a date or a conclusion. Write "needs clarification" when the owner or the meaning is uncertain.
- Preserve names, teams, acronyms, dates, numbers and amounts exactly as said, and keep the references to documents and sources the speakers gave.
- Never repeat a sentence in two places. Never mark anything Meeting only yourself.
```

## What you do with it

- **Keep the transcript on the page, and run the prompt in the Notion AI chat there.** A recorded meeting's transcript is in the meeting-notes block's Transcript. A transcript you paste goes in the page body. Open the Notion AI chat on the page, paste the prompt with the line "Write the minutes on this page, below the transcript, and nothing else.", and send ([pasting-the-minutes-prompt.md](pasting-the-minutes-prompt.md)). The minutes quote the transcript, so a meeting with minutes but no transcript isn't ingested: catch-up leaves it Reviewed and asks you to put the transcript back above the minutes.
- **Tick your quick follow-ups as you do them, before you mark the meeting Reviewed.** Each one still unticked when the brain reads the meeting becomes a Task, with the meeting's projects and no due date. To keep one out, tick it or delete it. The brain never ticks or edits a checkbox, and never creates the same follow-up twice.
- **Tasks for the brain** become Tasks. **Shape a task before Reviewed** by editing its **Scope** toggle: **Due** (a date, `YYYY-MM-DD`) and **Project** become the Task's properties, and that Project replaces the one the brain would have picked; **Done when** and **Notes** go into the Task's page. Leave a line empty and the brain decides as before. A Scope it can't use (a Due that isn't a date, a Project it can't find) holds back only that Task, and the brain says why. The Scope is read once, when the Task is created; after that, edit the Task itself.
- **Correct a line** in the summary: the brain reads your wording. Keep the tag at its end; a line that loses its tag blocks the meeting until it has one.
- **Leave a subject out:** open **For the brain** and change that subject's line to `[s2] Selection: Meeting only`. Its lines and their quotes stay in Notion and out of the brain, Tasks for the brain under its id included.
- **Leave one item out:** in **For the brain**, write `Meeting only:` at the start of its quote line (`Meeting only: [s2.i3] "…"`). **Keep one item inside an excluded subject:** write `Use in brain:` there instead. These go in the toggle, never on the summary line: there they block the meeting, and the brain says why.
- **Track someone else's commitment:** write `Track: Waiting On —` at the start of that summary line (`Track: Waiting On — Waiting on Sam: send the contract [s1.i4]`). Without it, only your own explicit commitments become Tasks; a `Waiting on <name>:` line alone stays a note of what someone said.
- **Confirm:** set the meeting to **Reviewed**. Until then nothing is ingested. Reviewed confirms what you can see on the page, no more.
- **Change your mind later:** edit the summary or the toggle and set the meeting to Reviewed again. A deletion on its own is not a request; the brain keeps what it has until you ask (decision 0062). A follow-up you leave unticked after the meeting was read waits for that next Reviewed.
- **A quote that is too long or slightly reworded** doesn't block the meeting: the brain places it by the part that matches or, if it can't, leaves out only that item and tells you which one to fix. Only a quote of something marked **Meeting only** must match the transcript exactly, so the brain knows what to keep out.
