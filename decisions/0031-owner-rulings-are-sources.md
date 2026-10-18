# 0031 — The owner's rulings during an ingest are sources

**Status:** Accepted
**Date:** 2026-10-13

## Context
In the first real ingest (CC-12, dogfood finding 19), the minutes left two points open: the AI summary and the user's notes gave a renamed item two different names, and it was unclear whether two related items stay separate. The user settled both in chat. The brain had no proper home for that answer: it accepted only minutes as a source, and decision 0004 allows only `^[inferred]` and `^[ambiguous]` markers. So the answer became a proposal saying "ruled by the owner after the meeting", no decision note was written, and the meeting note stayed `^[ambiguous]`.

Options:
- **A.** The owner's answer is saved as a source note, which other notes cite like the minutes.
- **B.** A new inline marker, `^[owner]`, on the sentences the owner stated.

## Decision
**A.** When the owner answers an ingest question with content (a ruling, a correction, or a fact the minutes lack), the ingest saves the answer as a **source note**:
- `title`: `<meeting title> (owner ruling)`; `file_date`: the day of the answer;
- `source_key`: `agent:<agent>/<meeting date>-<meeting slug>-ruling` (the existing `agent:` form, so the schema doesn't change);
- body: the question asked and the owner's answer, verbatim.

Claims that rest on it list it in `sources`, next to the minutes source. A ruling that settles a decision becomes a decision note (if it passes the decision gate) citing both sources. The meeting note links that decision instead of keeping `^[ambiguous]`.

Answers that only fix ingest input (a missing date, the attendee list, which spelling is one person) are not rulings. They go straight into properties and aliases, with no source note.

## Consequences
- Decision 0004 is unchanged: an unmarked sentence is still backed by a cited source; the ruling is that source.
- The owner's words are traceable and dated, like minutes, so a later contradiction can cite them.
- One small extra source note per ingest that needed a ruling.
- `brain-ingest` (extraction.md "Owner rulings") and the step 3 pre-check apply this.

## Evidence
- build/TASKS.md, dogfood findings 14 and 19.
- spec/schemas/note.schema.json `$defs.sourceKey` (the `agent:` form).
