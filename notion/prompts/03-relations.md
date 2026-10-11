# Prompt 3 — Relations

Paste into Notion AI. Before: [Prompt 2](02-databases.md). Next: [Prompt 4](04-formula-rollup.md).

Skipped the Tasks database? Delete the three "Tasks" lines before pasting, and later relate your own Tasks database to Projects, Areas and Meetings the same way.

```text
In the databases on "Brain Data", add these two-way relations. Use exactly these property names on each side.

- Areas "Goals" ↔ Goals "Area"
- Areas "Projects" ↔ Projects "Area"
- Goals "Key Results" ↔ Key Results "Goal"
- Goals "Projects" ↔ Projects "Goal"
- Projects "Client" ↔ Orgs "Projects"
- Projects "People" ↔ People "Projects"
- Projects "Meetings" ↔ Meetings "Project"
- Projects "Decisions" ↔ Decisions "Project"
- Projects "Questions" ↔ Questions "Project"
- Meetings "Attendees" ↔ People "Meetings"
- Meetings "Area" ↔ Areas "Meetings"
- Meetings "Decisions" ↔ Decisions "Decided In"
- Meetings "Questions" ↔ Questions "Raised In"
- People "Org" ↔ Orgs "People"
- Decisions "Supersedes" ↔ Decisions "Superseded By"
- Review "Source Meeting" ↔ Meetings "Review Items"
- Tasks "Project" ↔ Projects "Tasks"
- Tasks "Area" ↔ Areas "Tasks"
- Tasks "Meeting" ↔ Meetings "Tasks"

Do not create any other relations.
```

## Verify
- [ ] Open each database: both sides of every relation exist, with the names above.
- [ ] Each relation is two-way: linking a Project to an Area in Projects shows the Project in that Area's "Projects".
- [ ] Decisions has both "Supersedes" and "Superseded By", pointing at Decisions itself.
- [ ] No other relations were created.
