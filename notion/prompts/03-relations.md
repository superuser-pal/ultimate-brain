# Prompt 3 — Relations

Paste into Notion AI. Before: [Prompt 2](02-databases.md). Next: [Prompt 4](04-formula-rollup.md).

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md), "Choose your modules"). Mapping your own tasks database? Leave Tasks off, and later relate it to Projects, Areas, Meetings and Inbox the same way ([modules/tasks.md](../modules/tasks.md)).

```text
Ignore the module names in square brackets at the start of lines.
In the databases on "Brain Data", add these two-way relations. Use exactly these property names on each side.

- Areas "Projects" ↔ Projects "Area"
[Planning] - Areas "Goals" ↔ Goals "Area"
[Planning] - Goals "Key Results" ↔ Key Results "Goal"
[Planning] - Goals "Projects" ↔ Projects "Goal"
[Orgs] - Projects "Client" ↔ Orgs "Projects"
- Projects "People" ↔ People "Projects"
- Projects "Meetings" ↔ Meetings "Project"
[Knowledge] - Projects "Decisions" ↔ Decisions "Project"
[Knowledge] - Projects "Questions" ↔ Questions "Project"
- Meetings "Attendees" ↔ People "Meetings"
- Meetings "Area" ↔ Areas "Meetings"
[Knowledge] - Meetings "Decisions" ↔ Decisions "Decided In"
[Knowledge] - Meetings "Questions" ↔ Questions "Raised In"
[Orgs] - People "Org" ↔ Orgs "People"
[Knowledge] - Decisions "Supersedes" ↔ Decisions "Superseded By"
- Review "Source Meeting" ↔ Meetings "Review Items"
- Review "Area" ↔ Areas "Review" (limit Review's side to one page)
[Knowledge] - Decisions "Area" ↔ Areas "Decisions"
[Knowledge] - Questions "Area" ↔ Areas "Questions"
[Knowledge] - Concepts "Project" ↔ Projects "Concepts"
[Knowledge] - Concepts "Area" ↔ Areas "Concepts"
[Knowledge] - Inbox "Decisions" ↔ Decisions "Sources"
[Knowledge] - Inbox "Questions" ↔ Questions "Sources"
[Knowledge] - Inbox "Concepts" ↔ Concepts "Sources"
[Documents] - Inbox "Documents" ↔ Documents "Sources"
[Documents] - Documents "Project" ↔ Projects "Documents"
[Documents] - Documents "Area" ↔ Areas "Documents"
[Knowledge] [Documents] - Documents "From decision" ↔ Decisions "Documents"
[Knowledge] [Documents] - Documents "From concept" ↔ Concepts "Documents"
- Inbox "People" ↔ People "Sources"
- Inbox "Project" ↔ Projects "Inbox"
- Inbox "Area" ↔ Areas "Inbox"
[Reports] - Inbox "Ask" ↔ Inbox "Report" (a relation of the Inbox to itself: a report row's Ask, an Ask row's Report)
[Tasks] - Tasks "Project" ↔ Projects "Tasks"
[Tasks] - Tasks "Area" ↔ Areas "Tasks"
[Tasks] - Tasks "Meeting" ↔ Meetings "Tasks"
[Tasks] - Tasks "Source" ↔ Inbox "Tasks"

Do not create any other relations.
```

## Verify
- [ ] Open each database: both sides of every relation exist, with the names above.
- [ ] Each relation is two-way: linking a Project to an Area in Projects shows the Project in that Area's "Projects".
- [ ] Review "Area" is limited to one page.
- [ ] (Knowledge) Decisions has both "Supersedes" and "Superseded By", pointing at Decisions itself.
- [ ] No other relations were created.
