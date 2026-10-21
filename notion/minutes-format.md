# Minutes format

Paste it into Notion AI when it summarises a meeting, and use it for the "Minutes follow the format" item of the Meetings checklist (docs/notion-space-design.md §9). Every meeting summary then has the same sections, which makes the ingest more accurate (decision 0024). The ingest skill reads these headings, so change them only through the repo (decision 0022). The format is a hint, not a requirement: the ingest also reads minutes with other headings, such as Notion AI meeting notes.

This is the user's own meeting-notes prompt, made the default with the brain's sections added (decision 0043). Attendees and Projects come first, because the ingest asks about them when the meeting's properties are empty. Decisions, Open Questions and Risks come right after the action items, so the ingest finds them in fixed places.

```text
Summarize the meeting transcript as structured, factual meeting notes, using exactly these sections, in this order. Write "None" under a section when nothing applies.

## Attendees
Full names, with their organization, team or role when mentioned.

## Projects
Every project the meeting touched, one per line, with the project's name as it was said.

## Action Items
- [ ] One unchecked checkbox per follow-up.
- Include the owner, deliverable, timing and dependencies when stated. Write "no owner" or "no date" when they weren't.

## Decisions
One line per decision agreed in the meeting: what was decided, and why if stated. Mark tentative ones "(tentative)".

## Open Questions
Questions raised but not answered, and who raised them.

## Risks
Concerns or risks mentioned, and who raised them.

## Meeting Purpose
The objectives and the main question to resolve.

## Background
Relevant history and context.

## Current Status
Progress by workstream or team, including delays, dependencies and pending confirmations.

## Requirements and Deadlines
Criteria, responsibilities, milestones and launch considerations.

## Other relevant topics
Separate sections for handovers, availability or other context affecting the work.

Use concise but detailed bullets, with nested bullets for supporting details. Bold key labels within bullets where helpful.
Preserve names, teams, acronyms, dates, numbers and qualifications exactly as said.
Distinguish confirmed information from expectations and open questions.
Do not invent missing owners, deadlines or conclusions.
Link statements to supporting transcript passages where available.
Omit irrelevant conversation and repetition.
```
