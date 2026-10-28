# Prompt 6 — Templates

Paste into Notion AI. Before: [Prompt 5](05-ownership.md). Next: [Prompt 7](07-spaces-views.md).

Each template is the database's default. Every linked view sits under an H3 heading named by the question it answers, has its database title hidden, and shows only rows related to the page (docs/notion-space-design.md §4). Where a block lists several views, they appear as view tabs on that one linked view. On project pages, the brain writes only inside the "Brief" and "Decision log" toggle headings (decision 0026), and on area pages inside "Brief" (decision 0041). First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md)); a tag can sit in front of an indented line, so keep the indent after it. Existing space? Use the migrations instead ([migration 0010](../migrations/0010-modules-documents-buttons-area-homes.md) for the area home).

```text
Ignore the module names in square brackets at the start of lines.
Create a default page template for each database below. Each item "Heading: database (views)" means: an H3 heading with exactly that text, then a linked view of that database filtered to the current page, with the database title hidden; when views are listed, add them as separate views of that one linked view, in that order, with those names. Do not add callouts or any other content.

- Areas (the area's home, decision 0050):
  First a toggle heading 2 "Brief" containing one empty paragraph.
  "What needs me here?": a tabs block with these tabs, each holding one linked view filtered to this area, with the database title hidden:
[Tasks]     tab "Today": Tasks where Area is this page, Status is not Done and Due is on or before today, sorted Due ascending, showing Name, Project, Due.
    tab "Meetings": Meetings where Area is this page, Brain Status is Not Reviewed and Date is on or before today, sorted Date descending, showing Name, Date, Project.
    tab "Review waiting": Review where Area is this page and State is Pending, grouped by Type, sorted Created time ascending, showing Name, Your call, What to fix.
    tab "Inbox": Inbox where Area is this page and Brain Status is New or Ready, sorted Created ascending, showing Name, Kind, Brain Status.
[Planning]   "What am I working toward here?": Goals where Area is this page and Status is Active, showing Name, Progress, Countdown.
  "What's active here?": Projects where Area is this page (views: "Active" Status is Active; "Planned" Status is Planned; "Done" Status is Done), showing Name, Status, Countdown.
[Tasks]   "What's on my plate here?": Tasks where Area is this page (views: "Open" Status is To Do or Doing; "Waiting On" Status is Waiting On; "Done" Status is Done), showing Name, Project, Due.
  "Which meetings?": Meetings where Area is this page (views: "Upcoming" Date on or after today, Date ascending; "Past" Date before today, Date descending), showing Name, Date, Project.
[Knowledge]   "What have we decided here?": Decisions where Area is this page (views: "Current" Assessment is not Superseded, Date descending; "Superseded" Assessment is Superseded, Date descending), showing Name, Project, Date.
[Knowledge]   "What's still open here?": Questions where Area is this page (views: "Open questions" Status is Open and Kind is Question; "Open risks" Status is Open and Kind is Risk; "Answered" Status is Answered), showing Name, Project, Kind.
  "What came in?": Inbox where Area is this page, sorted Created descending, showing Name, Kind, Summary.
[Knowledge]   "What do we know?": views "Decisions" (Decisions where Area is this page, sorted Date descending, showing Name, Assessment, Date, Project) and "Concepts" (Concepts where Area is this page, sorted Created time descending, showing Name, Summary, Project).
[Documents]   Under "What do we know?" (create the heading if it isn't there yet), a view "Documents" (Documents where Area is this page, sorted Last edited time descending, showing Name, Summary, Project).
[Reports]   "Reports": Inbox where Area is this page and Kind is Report, sorted Created descending, showing Name, Refresh asked, What to fix.
  Then a toggle "My notes".
[Planning] - Goals:
[Planning]   "How are the key results moving?": Key Results where Goal is this page (views: "Open" Progress is less than 100%; "Done" Progress is 100%), showing Name, Current, Target, Unit, Progress, Done.
[Planning]   "Which projects serve it?": Projects where Goal is this page, showing Name, Status, Countdown.
[Planning]   Then a toggle "My notes".
- Projects:
  First a gray paragraph: "Brief and Decision log are written by the brain. Add your own notes in My notes."
  A toggle heading 2 "Brief" containing one empty paragraph; a toggle heading 2 "Decision log" containing one empty paragraph.
[Tasks]   "What's on my plate here?": Tasks where Project is this page (views: "Open" Status is To Do or Doing; "Waiting On" Status is Waiting On; "Done" Status is Done), showing Name, Due, Status.
  "Which meetings?": Meetings where Project is this page (views: "Upcoming" Date on or after today, Date ascending; "Past" Date before today, Date descending), showing Name, Date, Brain Status.
[Knowledge]   "What's still open here?": Questions where Project is this page and Status is Open, showing Name, Kind.
  "Who's involved?": People where Projects contains this page, showing Name, Role.
  "What came in?": Inbox where Project is this page, sorted Created descending, showing Name, Kind, Summary.
[Knowledge]   "What do we know?": views "Decisions" (Decisions where Project is this page, sorted Date descending, showing Name, Assessment, Date) and "Concepts" (Concepts where Project is this page, sorted Created time descending, showing Name, Summary).
[Documents]   Under "What do we know?" (create the heading if it isn't there yet), a view "Documents" (Documents where Project is this page, sorted Last edited time descending, showing Name, Summary).
[Reports]   "Reports": Inbox where Project is this page and Kind is Report, sorted Created descending, showing Name, Refresh asked, What to fix.
  Then a toggle "My notes".
- Meetings:
  A gray callout containing a heading 3 "Before marking Reviewed", a divider, and the to-do items "Attendees linked", "Project linked", "Minutes follow the format", "Minutes checked and corrected", then a gray line "Check the minutes, fix them, then set Brain Status to Reviewed. Fixed them after the brain took them in? Set Reviewed again: it reads only what changed."
  A Notion AI meeting notes block.
  A toggle "My notes".
[Knowledge]   A toggle "Decisions" containing a linked view of Decisions where Decided In is this page.
[Knowledge]   A toggle "Questions" containing a linked view of Questions where Raised In is this page.
[Tasks]   A toggle "Tasks" containing a linked view of Tasks where Meeting is this page.
- People:
  "Which meetings were they in?": Meetings where Attendees contains this page (views: "Upcoming" Date on or after today, Date ascending; "Past" Date before today, Date descending), showing Name, Date, Project.
  "What are they working on?": Projects where People contains this page, showing Name, Status.
  Then a toggle "My notes".
[Orgs] - Orgs:
[Orgs]   "Who works there?": People where Org is this page, showing Name, Role.
[Orgs]   "Which projects?": Projects where Client is this page, showing Name, Status, Countdown.
[Orgs]   Then a toggle "My notes".
Set each of these templates as the database default.
```

## Verify
- [ ] Create a new Project: the gray hint line comes first, then "Brief" and "Decision log" as **toggle** headings (with an arrow), then a headed view for each line you kept, and "My notes". Delete the test project.
- [ ] Create a new Area: it starts with a "Brief" toggle heading, then "What needs me here?" with its tabs (Today only with Tasks), then a headed view for each line you kept, and its page header shows the "via projects" rollups (set in the page layout, [views-guide.md](../views-guide.md) §9). Delete the test area.
- [ ] No template shows a view of a database you left out.
- [ ] No template has a callout that prints "[Summary]", "[Role]" or "Why".
- [ ] Every template listed above is the default for its database.
