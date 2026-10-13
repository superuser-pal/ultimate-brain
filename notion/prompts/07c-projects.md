# Prompt 7c — Projects Space views

Paste into Notion AI **while you are on the "Projects" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md).

This page holds only linked views of databases on "Brain Data". No navigation or layout work is in this prompt.

```text
On this page ("Projects") add four linked views of "Projects":

1. Board layout, named "What's active?": filter Archived is unchecked; group by Status with columns in the order Planned, Active, On Hold, Done; sort Priority high to low; show Name, Priority, Dates, Client, Key Facts.
2. Timeline layout by Dates (or Table if Timeline is unavailable), named "What's due soon?": filter Status is Active or Planned and Archived is unchecked; sort Dates (end) ascending; show Name, Dates, Priority, Status.
3. Table layout, named "Which projects have gone quiet?": filter Status is Active and Last edited time is before one month ago (relative date); sort Last edited time ascending; show Name, Last edited time, Last Synced, Client. (Last Synced is the one exception to the hide rule: show it here.)
4. Table layout, named "What's finished?": filter Status is Done or Archived is checked (use a filter group joined with Or); sort Dates (end) descending; show Name, Dates, Client, Status.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Do not add other content.
```

## Verify
- [ ] Only four linked views of Projects are on the page.
- [ ] View 3 uses a relative date filter, not a fixed date.
- [ ] View 4's filter group is joined with Or.
