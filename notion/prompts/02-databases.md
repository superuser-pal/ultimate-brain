# Prompt 2 — Databases without relations

Paste into Notion AI. Before: [Prompt 1](01-pages.md). Next: [Prompt 3](03-relations.md).

Using your own Tasks database? Before pasting, delete the line that starts with `12. "Tasks"`, and map yours later (decision 0018).

```text
On the page "Brain Data", create these full-page databases with exactly these properties and options. Do not add any other properties. Do not create relations yet.

1. "Areas": Name (title), Summary (text), Type (select: Business, Personal), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date).
2. "Goals": Name (title), Summary (text), Why (text), Deadline (date), Status (select: Not Started, Active, Achieved, Dropped), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date).
3. "Key Results": Name (title), Kind (select: Number, Milestone), Start (number), Current (number), Target (number), Unit (text), Done (checkbox), Due (date).
4. "Projects": Name (title), Summary (text), Key Facts (text), Status (select: Planned, Active, On Hold, Done), Priority (select: High, Medium, Low), Dates (date, allow end date), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date), Last edited time (last edited time).
5. "Meetings": Name (title), Date (date), Brain Status (select: Not Reviewed, Reviewed, Ingested, Skipped; default Not Reviewed), Ingested At (date), Brain ID (text).
6. "People": Name (title), Summary (text), Role (text), Email (email), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
7. "Orgs": Name (title), Summary (text), Relationship (select: Client, Prospect, Partner, Supplier, Other), Website (url), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
8. "Decisions": Name (title), Summary (text), Date (date), Assessment (select: Accepted, Provisional, Contested, Superseded), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
9. "Questions": Name (title), Summary (text), Kind (select: Question, Risk), Status (select: Open, Answered, Dropped), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time).
10. "Review": Name (title), Kind (select: Update Fact, Add To Note, Update Body, Add Link, Supersede, Contradiction, Merge, New Item, Review Notes, Answer), About (text), About Page (url), Now (text), Proposed (text), Why (text), Your call (select: Approve, Reject, Fix), What to fix (text), State (select: Pending, Applied, Closed; default Pending), Brain ID (text), Created time (created time), Last edited time (last edited time).
11. "Inbox": Name (title), Kind (select: Capture, Document, Email, Chat, Note, Ask, Report; default Capture), Summary (text), Brain Status (select: New, Ready, Processed, Skipped; default New), Keep (text), Full text (checkbox), Refresh (checkbox), What to fix (text), Brain ID (text), Last Synced (date), Created (created time).
12. "Tasks": Name (title), Status (status: To Do, Doing, Waiting On, Someday, Done; put Waiting On and Someday in any group except Complete), Due (date), Brain ID (text), Last edited time (last edited time).
13. "Concepts": Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time).
14. "References": Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time).
```

## Verify
- [ ] "Brain Data" holds 14 databases (13 if you skipped Tasks), and nothing else.
- [ ] Every property name is spelled exactly as above, including capitals and spaces ("Brain ID", "Last Synced", "Note"). The brain finds properties by name.
- [ ] Select options match exactly, in that order. Brain Status in Meetings defaults to Not Reviewed; State in Review defaults to Pending; Kind in Inbox defaults to Capture.
- [ ] No extra properties were added (Notion AI sometimes adds "Tags" or "Created by"; delete them).
