# Prompt 7c — Projects Space views

Paste into Notion AI **while you are on the "Projects" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Finished projects live in Archive (Prompt 7h), not here.

```text
On this page ("Projects") add four tabs, each a linked view of "Projects":
1. Tab "Active": Board, named "What's active?": filter Archived is unchecked and Status is not Done; group by Status with columns Planned, Active, On Hold; sort Priority high to low; show Name, Client, Priority, Countdown, Task Progress.
2. Tab "By area": Board, named "What's in each area?": filter Archived is unchecked and Status is not Done; group by Area, showing the empty group; sort Priority high to low; show Name, Status, Countdown.
3. Tab "Deadlines": Timeline by Dates (or Table if Timeline is unavailable), named "What's due soon?": filter Status is Active or Planned and Archived is unchecked; sort Dates (end) ascending; show Name, Countdown.
4. Tab "Gone quiet": Table, named "Which projects have gone quiet?": filter Status is Active and Last edited time is before one month ago (relative date); sort Last edited time ascending; show Name, Last edited time, Last Synced, Client. (Last Synced is the one exception to the hide rule: show it here.)

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] Four tabs: Active, By area, Deadlines, Gone quiet. No "What's finished?" view.
- [ ] "Which projects have gone quiet?" uses a relative date filter, not a fixed date.
