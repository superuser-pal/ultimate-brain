# Prompt 7a — Home Space views

Paste into Notion AI **while you are on the "Home" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Home leads with your own work; the brain's queues sit small in the left column. If your Home is the root "Ultimate Brain" page, paste it there.

```text
On this page ("Home"):

In the left column, under the navigation, add a heading 3 "Needs you" and two linked views, List layout, at most 5 rows each:
1. "What needs my decision?" of "Review": filter State is Pending; sort Created time descending; show Name.
2. "Which minutes need review?" of "Meetings": filter Brain Status is Not Reviewed and Date is on or before today; sort Date descending; show Name.

In the right column add, in one row:
3. A button "Quick capture": Add page to "Inbox", set Kind = Capture and Brain Status = New, open the page after creation.
4. A button "New meeting": Add page to "Meetings", set Date = today, open the page after creation.
5. A button "New project": Add page to "Projects", set Status = Planned, open the page after creation.

Below them, a heading 3 "What's on today?" and three tabs:
6. Tab "Tasks": linked view of "Tasks", List, named "What's due today?": filter Status is To Do or Doing and Due is on or before today; sort Due ascending; show Name, Project, Due.
7. Tab "Meetings": linked view of "Meetings", List, named "Which meetings are today?": filter Date is today; sort Date ascending; show Name, Date, Project.
8. Tab "Projects": linked view of "Projects", Gallery with small cards, named "What's active?": filter Status is Active and Archived is unchecked; sort Priority then Name; show Name, Client, Countdown, Task Progress.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] "Needs you" shows two short lists; a meeting dated tomorrow is not in "Which minutes need review?".
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status New; New meeting and New project open a page with the default template.
- [ ] "What's on today?" has three tabs: Tasks, Meetings, Projects.
