# Prompt 7d — Meetings Space views

Paste into Notion AI **while you are on the "Meetings" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md).

This page holds only linked views of databases on "Brain Data". No navigation or layout work is in this prompt.

```text
On this page ("Meetings") add four linked views of "Meetings":

1. Table layout, named "Which minutes need review?": filter Brain Status is Not Reviewed; sort Date descending; show Name, Date, Attendees, Project, Brain Status.
2. List layout, named "What's waiting for the brain?": filter Brain Status is Reviewed; sort Date ascending; show Name, Date, Project.
3. Table layout, named "What did the brain take in this week?": filter Brain Status is Ingested and Ingested At is within the past week (relative date); sort Ingested At descending; show Name, Date, Ingested At, Decisions, Questions.
4. Table layout, named "All meetings by project": no filter; group by Project (show the empty group as "No project"); sort Date descending; show Name, Date, Brain Status, Attendees.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Do not add other content.
```

## Verify
- [ ] Only four linked views of Meetings are on the page.
- [ ] View 3 uses a relative date filter.
- [ ] View 4 has a "No project" group.
