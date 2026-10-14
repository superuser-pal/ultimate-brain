# Prompt 7g — Tasks Space views

Paste into Notion AI **while you are on the "Tasks" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Waiting On and Someday are Notion-only statuses (Prompt 2): the brain creates tasks as To Do and never reads Status back. Using your own Tasks database? Map the filters to your own properties.

```text
On this page ("Tasks") add six tabs, each a linked view of "Tasks", List layout:
1. Tab "Today", named "What's due today?": filter Status is To Do or Doing and Due is on or before today; sort Due ascending; show Name, Project, Due, Status.
2. Tab "Upcoming", named "What's coming up?": filter Status is To Do or Doing and Due is after today; sort Due ascending; group by Due (by day); show Name, Project.
3. Tab "No date", named "What has no date?": filter Status is To Do or Doing and Due is empty; group by Project; show Name, Meeting.
4. Tab "Waiting On", named "What am I waiting on?": filter Status is Waiting On; sort Due ascending; show Name, Project, Due.
5. Tab "Someday", named "What could I do someday?": filter Status is Someday; group by Project; show Name.
6. Tab "Done", named "What did I finish?": filter Status is Done; sort Last edited time descending; group by Last edited time (by week); show Name, Project.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] Six tabs: Today, Upcoming, No date, Waiting On, Someday, Done.
- [ ] A task with no Due shows only in "No date".
