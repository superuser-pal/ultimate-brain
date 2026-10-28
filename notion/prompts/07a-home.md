# Prompt 7a — Home Space views

Paste into Notion AI **while you are on the "Home" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Home leads with your own work; the brain's queues sit small in the left column. If your Home is the root "Ultimate Brain" page, paste it there.

```text
On this page ("Home"):

In the left column, under the navigation, add a heading 3 "Needs you", a gray paragraph "Start here: approving makes the brain's notes trusted.", and two linked views, List layout, at most 5 rows each:
1. "What's waiting for you?" of "Review": filter State is Pending; group by Kind, with group counts shown; sort Created time descending; show Name, About Page.
2. "Which minutes need review?" of "Meetings": filter Brain Status is Not Reviewed and Date is on or before today; sort Date descending; show Name.

In the right column add, in one row:
3. A button "Quick capture": Add page to "Inbox", set Kind = Capture and Brain Status = New, open the page after creation.
3b. A button "Ask the brain": Add page to "Inbox", set Kind = Ask and Brain Status = New, open the page after creation.
4. A button "New meeting": Add page to "Meetings", set Date = today, open the page after creation.
5. A button "New project": Add page to "Projects", set Status = Planned, open the page after creation.

Below them, a heading 3 "What's on today?" and three tabs:
6. Tab "Tasks": linked view of "Tasks", List, named "What's due today?": filter Status is To Do or Doing and Due is on or before today; sort Due ascending; show Name, Project, Due.
7. Tab "Meetings": linked view of "Meetings", List, named "Which meetings are today?": filter Date is today; sort Date ascending; show Name, Date, Project.
8. Tab "Projects": linked view of "Projects", Gallery with small cards, named "What's active?": filter Status is Active and Archived is unchecked; sort Priority then Name; show Name, Client, Countdown, Task Progress.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Below that, a heading 3 "What did the brain take in?" and two tabs:
9. Tab "Came in": linked view of "Inbox", List, at most 10 rows, named "What came in lately?": filter Brain Status is Done; sort Created descending; show Name, Kind, Project.
10. Tab "Meetings": linked view of "Meetings", List, at most 10 rows, named "Which meetings did it take in?": filter Brain Status is Ingested; sort Ingested At descending; show Name, Date, Project.
Put these two in their own tabs block.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] "Needs you" shows two short lists; a meeting dated tomorrow is not in "Which minutes need review?".
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status New; New meeting and New project open a page with the default template.
- [ ] "What's on today?" has three tabs: Tasks, Meetings, Projects.
- [ ] Ask the brain creates an Inbox row with Kind Ask and Brain Status New.
- [ ] "What did the brain take in?" has two tabs, Came in and Meetings, each with the 10 latest rows.
