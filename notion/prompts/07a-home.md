# Prompt 7a — Home Space views

Paste into Notion AI **while you are on the "Home" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md).

This page holds only linked views of databases on "Brain Data". No navigation or layout work is in this prompt.

```text
On this page ("Home") add:

1. A button "Quick capture": action Add page to "Capture Inbox", set Brain Status = New, open the page after creation.
2. A linked view of "Review", List layout, named "What needs my decision?": filter State is Pending; sort Created time descending; show Name, Kind, Decision.
3. A linked view of "Meetings", List layout, named "Which minutes need review?": filter Brain Status is Not Reviewed; sort Date descending; show Name, Date, Project.
4. A linked view of "Projects", Gallery layout with small cards, named "What's active?": filter Status is Active and Archived is unchecked; sort Priority then Name; show Name, Priority, Dates, Client.

Show at most 10 rows in each list.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Do not add other content.
```

## Verify
- [ ] Only the button and three linked views are on the page.
- [ ] "What needs my decision?" shows only Pending rows.
- [ ] Quick capture creates a Capture Inbox row with Brain Status New.
