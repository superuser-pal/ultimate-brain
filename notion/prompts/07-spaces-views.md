# Prompt 7 — Spaces and views

Paste into Notion AI. Before: [Prompt 6](06-templates.md). Next: [Prompt 8](08-navigation.md).

Each Space holds only linked views of the databases on Brain Data, each named by the question it answers (docs/notion-space-design.md §5).

```text
Fill these pages with linked views of the databases on "Brain Data". Do not create new databases. Name each view exactly as written.

"Home": a button "Quick capture" that adds a new page to "Capture Inbox"; linked Review view "What needs my decision?" (State is Pending, newest first); linked Meetings view "Which minutes need review?" (Brain Status is Not Reviewed); linked Projects view "What's active?" (Status is Active).

"Plan": Goals view "What am I working toward?" (Status is Active, show Progress, Deadline); Key Results view "How are my key results moving?" (grouped by Goal); Areas view "Which areas do I own?" (Archived unchecked); Projects view "Which projects serve each goal?" (grouped by Goal).

"Projects": Projects board "What's active?" (grouped by Status, Archived unchecked); Projects view "What's due soon?" (sorted by Dates); Projects view "Which projects have gone quiet?" (Status is Active and Last edited time is more than 30 days ago); Projects view "What's finished?" (Status is Done or Archived checked).

"Meetings": Meetings views "Which minutes need review?" (Brain Status is Not Reviewed), "What's waiting for the brain?" (Brain Status is Reviewed), "What did the brain take in this week?" (Brain Status is Ingested and Ingested At within the past week), "All meetings by project" (grouped by Project).

"Review": Review views "What needs my decision?" (State is Pending, newest first, show Kind, Before, After, Why, Decision), "Where do sources disagree?" (Kind is Contradiction and State is Pending), "What did I approve recently?" (State is Applied, last 30 days), "What did I reject?" (State is Closed).

"Knowledge": Decisions view "What did we decide?" (Assessment is Accepted, newest first); Decisions view "What changed our minds?" (Assessment is Superseded); Questions view "What's still open?" (Status is Open); People view "Who's who?" (grouped by Org); Orgs view "Which clients do I have?" (Relationship is Client); Capture Inbox view "What's in my inbox?" (Brain Status is New).
```

## Verify
- [ ] Each Space holds only linked views (and the Quick capture button on Home); no database lives outside Brain Data.
- [ ] View names match the prompt exactly, including the question marks.
- [ ] Spot-check two filters: Home "What needs my decision?" shows only Pending rows; Knowledge "What changed our minds?" shows only Superseded decisions.
- [ ] Quick capture on Home creates a row in Capture Inbox with Brain Status New.
