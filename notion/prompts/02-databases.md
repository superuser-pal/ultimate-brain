# Prompt 2 — Databases without relations

Paste into Notion AI. Before: [Prompt 1](01-pages.md). Next: [Prompt 3](03-relations.md).

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md), "Choose your modules"). Using your own tasks database? Leave Tasks off, and map yours later (decision 0018).

```text
Ignore the module names in square brackets at the start of lines.
On the page "Brain Data", create these full-page databases with exactly these properties and options. Do not add any other properties. Do not create relations, formulas or buttons yet.

1. "Areas": Name (title), Summary (text), Workflow (select: Standard, Connected), Work type (select: Software, General), Logging level (select: Tasks only, Tasks + final outputs, Full durable record, Custom), Log artifacts (multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date).
[Planning] 2. "Goals": Name (title), Summary (text), Why (text), Deadline (date), Status (select: Not Started, Active, Achieved, Dropped), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date).
[Planning] 3. "Key Results": Name (title), Kind (select: Number, Milestone), Start (number), Current (number), Target (number), Unit (text), Done (checkbox), Due (date).
4. "Projects": Name (title), Summary (text), Key Facts (text), Status (select: Planned, Active, On Hold, Done), Priority (select: High, Medium, Low), Dates (date, allow end date), Workflow (select: Standard, Connected), Work type (select: Software, General), Logging level (select: Tasks only, Tasks + final outputs, Full durable record, Custom), Log artifacts (multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date), Last edited time (last edited time).
5. "Meetings": Name (title), Date (date), Brain Status (select: Not Reviewed, Reviewed, Ingested, Skipped; default Not Reviewed), Ingested At (date), Brain ID (text).
6. "People": Name (title), Summary (text), Role (text), Email (email), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
[Orgs] 7. "Orgs": Name (title), Summary (text), Relationship (select: Client, Prospect, Partner, Supplier, Other), Website (url), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
[Knowledge] 8. "Decisions": Name (title), Summary (text), Date (date), Assessment (select: Accepted, Provisional, Contested, Superseded), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
[Knowledge] [Documents] Also in "Decisions": Promote asked (checkbox).
[Knowledge] 9. "Questions": Name (title), Summary (text), Kind (select: Question, Risk), Status (select: Open, Answered, Dropped), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time).
10. "Review": Name (title), Kind (select: Update Fact, Add To Note, Update Body, Add Link, Supersede, Contradiction, Merge, New Item, Review Notes, Answer), About (text), About Page (url), Now (text), Proposed (text), Why (text), Your call (select: Approve, Reject, Fix, Request revision), What to fix (text), Decided (checkbox), Decided at (date, with time), Accept all (checkbox), State (select: Pending, Applied, Closed; default Pending), Brain ID (text), Created time (created time), Last edited time (last edited time). Give these properties descriptions (they show in the property list, never rely on hover text): Proposed, "Short pointer to what is proposed. The exact text and your decision are in the page, in each change's section."; Decided, Decided at and Accept all, "Owner: you, through the Submit decisions and Submit and accept all buttons. The brain clears them once it has applied your decisions."; Your call, "Shortcut for the whole row (Approve or Reject, read without Submit). To decide change by change, use the sections in the page."
11. "Inbox": Name (title), Kind (select: Capture, File, Email, Chat, Note, Ask, Report; default Capture), Summary (text), Brain Status (select: New, Ready, Done; default New), Brain ID (text), Last Synced (date), Created (created time).
[Documents] Also in "Inbox": Document asked (checkbox), Only keep (text).
[Reports] Also in "Inbox": Refresh asked (checkbox), What to fix (text), Accepted (checkbox), Accepted at (date, with time).
[Tasks] 12. "Tasks": Name (title), Status (status: To Do, Doing, Waiting On, Someday, Done; put Waiting On and Someday in any group except Complete), Due (date), Brain ID (text), Last edited time (last edited time).
[Knowledge] 13. "Concepts": Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time).
[Knowledge] [Documents] Also in "Concepts": Promote asked (checkbox).
[Documents] 14. "Documents": Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time), Last edited time (last edited time).
[Documents] Also in "Documents": Accepted (checkbox), Accepted at (date, with time).
15. "Domains": Name (title), Summary (text), Type (select: Personal, Entrepreneurship, Professional), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date).
```

## Verify
- [ ] (Tasks) Add Won't Do by hand in the Complete status group.
- [ ] "Brain Data" holds one database per numbered line you kept, and nothing else: 15 with every module, 7 with Core alone (Areas, Projects, Meetings, People, Review, Inbox, and Domains, which every space has: decision 0065).
- [ ] Every property name is spelled exactly as above, including capitals and spaces ("Brain ID", "Last Synced", "Document asked", "Only keep"). The brain finds properties by name.
- [ ] Select options match exactly, in that order. Brain Status in Meetings defaults to Not Reviewed; State in Review defaults to Pending; Kind in Inbox defaults to Capture; Brain Status in Inbox defaults to New.
- [ ] Areas and Projects both have Workflow, Work type, Logging level (selects) and Log artifacts (multi-select) with the options above, and no option selected anywhere (decision 0059: every page starts as Standard).
- [ ] No extra properties were added (Notion AI sometimes adds "Tags" or "Created by"; delete them).
