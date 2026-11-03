# Voice note format

For a voice or ramble capture in the Inbox (decision 0055, spec/capture-and-review.md §3.1). You record or dictate, the transcript lands on the page, and Notion AI (or Brain Assistant, on your request) writes the summary above it. Recording can be started from the page with your phone or Notion's own recording; if neither is available, paste the transcript into the **Transcript** toggle. The summary never authorizes a Task, and nothing is ingested until you set the row to **Ready**.

The page, in order:

1. The sentence **All subjects included unless marked Meeting only. Mark Ready to confirm.**
2. `## [s1] Voice note`, then `Selection: Use in brain`, then the items under **Highlights** (why each matters), **Commitments** (explicit ones only) and **Ideas to explore**.
3. A toggle **Transcript** holding the raw text exactly as recorded. The brain stores only the paragraphs your selection keeps; the full text stays in Notion.

```text
Summarize the voice note below the Transcript toggle. Write only the summary, in exactly this shape. Never change the Transcript.

## [s1] Voice note
Selection: Use in brain
### Highlights   (why each matters)
### Commitments   (only what I explicitly committed to do)
### Ideas to explore   (tentative ideas, never commitments)

Write every item as ONE line in exactly this form:
[s1.i1] <text> "<quote>"
- The id is visible, unique in the page and never changed once written.
- Each quote is copied character for character from the transcript: one stretch of one sentence, 6 to 12 words, that occurs only once in the transcript. Never join two sentences into one quote, never fix grammar, never paraphrase. When the support spans more than one place, add a second or third quote (up to three) rather than one long one.
- Do not write "Meeting only:", "Use in brain:" or "Track: Waiting On —" on an item.
- If the voice note covers clearly different topics, use [s2], [s3]... one per topic, each with its own "Selection: Use in brain" line.
- Every list line must be an item in this form: a bullet without an id blocks the whole voice note from the brain.
- Omit a heading with nothing under it. Never invent an owner, a date or a risk. Write "needs clarification" when the meaning is uncertain.
- A tentative idea ("maybe I should...") goes under Ideas to explore, never under Commitments.
```

Leave a subject or an item out the same way as in [minutes-format.md](minutes-format.md): `Selection: Meeting only` under the subject, or `Meeting only:` at the start of an item (for a voice note, the words mean "keep this out of the brain"). Mark the row **Ready** to confirm.
