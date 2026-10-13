# Prompt 7f — Knowledge Space views

Paste into Notion AI **while you are on the "Knowledge" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md).

This page holds only linked views of databases on "Brain Data". No navigation or layout work is in this prompt.

```text
On this page ("Knowledge") add six linked views:

1. Decisions, Table layout, named "What did we decide?": filter Assessment is Accepted; sort Date descending; show Name, Date, Project, Decided In, Summary.
2. Decisions, Table layout, named "What changed our minds?": filter Assessment is Superseded; sort Date descending; show Name, Date, Superseded By, Project.
3. Questions, Board layout, named "What's still open?": filter Status is Open; group by Kind; sort Created time descending; show Name, Project, Raised In.
4. People, Gallery layout with small cards, named "Who's who?": filter Lifecycle is not Archived; group by Org; sort Name; show Name, Role, Org, Email.
5. Orgs, Table layout, named "Which clients do I have?": filter Relationship is Client; sort Name; show Name, Website, People, Projects.
6. Capture Inbox, List layout, named "What's in my inbox?": filter Brain Status is New; sort Created descending; show Name, Created.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included. In every view hide the properties "Brain ID" and "Last Synced". Show only the properties listed. Do not add other content.
```

## Verify
- [ ] Only six linked views are on the page, each of the right database.
- [ ] "What changed our minds?" shows only Superseded decisions (none until some exist).
- [ ] "What's in my inbox?" shows only rows with Brain Status New.
