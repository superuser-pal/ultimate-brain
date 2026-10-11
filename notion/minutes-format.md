# Minutes format

Pasted into the "Minutes format" callout of the Meetings template ([prompt step 6b](prompts/06-templates.md)). Every meeting summary then has the same sections, which makes the ingest more accurate (decision 0024). The ingest skill reads these headings, so change them only through the repo (decision 0022).

```text
Summarize this meeting using exactly these sections, in this order. Write "None" under a section when nothing applies. Do not invent anything that was not said.

## Attendees
Full names, and their organization or role if mentioned.

## Decisions
One line per decision that was agreed in the meeting: what was decided, and why if stated. Mark tentative ones "(tentative)".

## Action items
One line each: action — owner — due date (write "no date" if none was given).

## Facts & numbers
Concrete facts stated in the meeting: budgets, dates, deadlines, prices, quantities, role changes. Quote the number exactly as said.

## Open questions
Questions raised but not answered.

## Risks
Concerns or risks mentioned, and who raised them.

## Summary
Three to five sentences on what the meeting was about.
```
