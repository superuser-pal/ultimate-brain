# Prompt 2 — Databases without relations

Paste into Notion AI. Before: [Prompt 1](01-pages.md). Next: [Prompt 3](03-relations.md).

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md), "Choose your modules"). Using your own tasks database? Leave Tasks off, and map yours later (decision 0018).

```text
Ignore the module names in square brackets at the start of lines.
On the page "Brain Data", create these full-page databases with exactly these properties and options. Do not add any other properties. Do not create relations, formulas or buttons yet.

1. "Areas": Name (title), Summary (text), Workflow (select: Standard, Connected), Work type (select: Software, General), Logging level (select: Tasks only, Tasks + final outputs, Full durable record, Custom), Log artifacts (multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables), Archived (checkbox), Brain ID (text), Last Synced (date).
[Planning] 2. "Goals": Name (title), Summary (text), Why (text), Deadline (date), Status (select: Not Started, Active, Achieved, Dropped), Archived (checkbox), Brain ID (text), Last Synced (date).
[Planning] 3. "Key Results": Name (title), Kind (select: Number, Milestone), Start (number), Current (number), Target (number), Unit (text), Done (checkbox), Due (date).
4. "Projects": Name (title), Summary (text), Key Facts (text), Status (select: Planned, Active, On Hold, Done), Priority (select: High, Medium, Low), Dates (date, allow end date), Workflow (select: Standard, Connected), Work type (select: Software, General), Logging level (select: Tasks only, Tasks + final outputs, Full durable record, Custom), Log artifacts (multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables), Archived (checkbox), Brain ID (text), Last Synced (date), Last edited time (last edited time).
5. "Meetings": Name (title), Date (date), Brain Status (select: New, Ready, Done, Skipped; default New), Ingested At (date), Brain ID (text).
6. "People": Name (title), Summary (text), Role (text), Email (email), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date).
[Orgs] 7. "Orgs": Name (title), Summary (text), Relationship (select: Client, Prospect, Partner, Supplier, Employer, Other), Website (url), Archived (checkbox), Brain ID (text), Last Synced (date).
8. "Inbox": Name (title), Kind (select: Capture, File, Email, Chat, Note, Ask, Catch-up, Weekly, Changed; default Capture), Summary (text), What changed (text), Brain Status (select: New, Ready, Done; default New), Brain ID (text), Last Synced (date), Created (created time).
[Documents] Also in "Inbox": Document asked (checkbox), Only keep (text).
[Tasks] 9. "Tasks": Name (title), Status (status: To Do, Doing, Waiting On, Someday, Done; put Waiting On and Someday in any group except Complete), Due (date), Kind (select: Task, Question, Risk), Document asked (checkbox), Brain ID (text), Last edited time (last edited time).
[Documents] 10. "Documents": Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Origin (select: Kept, Learned, Report, Promoted, Workflow), Brain ID (text), Last Synced (date), Created time (created time), Last edited time (last edited time).
[Documents] Also in "Documents": Accepted (checkbox), Accepted at (date, with time).
[Reports] Also in "Documents": Refresh asked (checkbox), What to fix (text).
11. "Domains": Name (title), Summary (text), Archived (checkbox), Brain ID (text), Last Synced (date).
```

## Verify
- [ ] (Tasks) Add Won't Do by hand in the Complete status group.
- [ ] "Brain Data" holds one database per numbered line you kept, and nothing else: 11 with every module, 6 with Core alone (Areas, Projects, Meetings, People, Inbox, and Domains, which every space has: decision 0065). There is no Review, Decisions or Questions database since 0.16.0 (decisions 0096, 0099): you decide in your agent session, and a question or risk you follow up is a task with its Kind.
- [ ] "Domains" has no Type: a Domain's Name and Summary say what kind of context it is (decision 0105).
- [ ] Every property name is spelled exactly as above, including capitals and spaces ("Brain ID", "Last Synced", "Document asked", "Only keep", "What changed"). The brain finds properties by name.
- [ ] Select options match exactly, in that order. Brain Status in Meetings defaults to New; Kind in Inbox defaults to Capture; Brain Status in Inbox defaults to New.
- [ ] Areas and Projects both have Workflow, Work type, Logging level (selects) and Log artifacts (multi-select) with the options above, and no option selected anywhere (decision 0059: every page starts as Standard).
- [ ] No extra properties were added (Notion AI sometimes adds "Tags" or "Created by"; delete them).
