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
- Meetings "Attendees" ↔ People "Meetings"
- Meetings "Area" ↔ Areas "Meetings"
[Orgs] - People "Org" ↔ Orgs "People"
[Documents] - Inbox "Documents" ↔ Documents "Sources"
[Documents] - Documents "Project" ↔ Projects "Documents"
[Documents] - Documents "Area" ↔ Areas "Documents"
- Inbox "People" ↔ People "Sources"
- Inbox "Project" ↔ Projects "Inbox"
- Inbox "Area" ↔ Areas "Inbox"
[Reports] - Documents "Asked in" ↔ Inbox "Report" (a report's Ask rows, an Ask row's report)
[Tasks] - Tasks "Project" ↔ Projects "Tasks"
[Tasks] - Tasks "Area" ↔ Areas "Tasks"
[Tasks] - Tasks "Meeting" ↔ Meetings "Tasks"
[Tasks] - Tasks "Source" ↔ Inbox "Tasks"
- Areas "Domain" ↔ Domains "Areas" (limit Areas' side to one page)
[Orgs] - Domains "Org" ↔ Orgs "Domains"

Then add these one-way relations: each is a property on the first database only, with no property on the other side (in the relation's settings, "Show on" the other database is off):
- Inbox "Changed from" → Inbox (a relation from the Inbox to itself)
[Documents] [Tasks] - Documents "Task" → Tasks

Then, once the relations above exist, add these rollups, each named "Domain": over the relation "Area", property "Domain" (the Area's Domain), calculated as Show original:
- in "Projects"
- in "Meetings"
[Documents] - in "Documents"

Do not create any other relations or rollups.
```

## Verify
- [ ] Open each database: both sides of every relation exist, with the names above.
- [ ] Each relation is two-way: linking a Project to an Area in Projects shows the Project in that Area's "Projects".
- [ ] The one-way relations have no other side: the Inbox has one "Changed from" and no second property for it, and (Documents, Tasks) Tasks has no property for Documents' "Task". If Notion AI made one two-way, open the relation's settings and turn off "Show on" the other database.
- [ ] Areas "Domain" is limited to one page. Notion AI may skip the limit: set it by hand (the relation's settings → Limit: 1 page).
- [ ] Projects, Meetings and (Documents) Documents each have a rollup "Domain": relation Area, property Domain, Show original. Link a Project to an Area that has a Domain: the Project's Domain shows it (decision 0105). Prompt 5 describes it; the brain never reads it.
- [ ] No other relations or rollups were created.
