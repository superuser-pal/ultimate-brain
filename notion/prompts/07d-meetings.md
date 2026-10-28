# Prompt 7d — Meetings Space views

Paste into Notion AI **while you are on the "Meetings" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Meetings you create ahead of time appear in Upcoming; they stay out of the review queue until their date has passed.

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md)).

```text
Ignore the module names in square brackets at the start of lines.
On this page ("Meetings") add five tabs, each a linked view of "Meetings":
1. Tab "Upcoming": List, named "What's coming up?": filter Date is on or after today; sort Date ascending; show Name, Date, Project, Attendees.
2. Tab "To review": Table, named "Which minutes need review?": filter Brain Status is Not Reviewed and Date is on or before today; sort Date descending; show Name, Date, Project, Brain Status.
3. Tab "Ready": List, named "What's waiting for the brain?": filter Brain Status is Reviewed; sort Date ascending; show Name, Date, Project.
4. Tab "Ingested": Table, named "What did the brain take in this week?": filter Brain Status is Ingested and Ingested At is within the past week (relative date); sort Ingested At descending; show Name, Ingested At.
[Knowledge] In "What did the brain take in this week?", also show Decisions and Questions.
5. Tab "Calendar": Calendar by Date, named "When did we meet?": show Name, Brain Status.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] Five tabs: Upcoming, To review, Ready, Ingested, Calendar.
- [ ] A meeting dated tomorrow shows in Upcoming, not in To review.
