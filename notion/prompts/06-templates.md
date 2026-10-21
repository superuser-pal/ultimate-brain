# Prompt 6 — Templates

Paste into Notion AI. Before: [Prompt 5](05-ownership.md). Next: [Prompt 7](07-spaces-views.md).

Each template is the database's default. Every linked view sits under an H3 heading named by the question it answers, has its database title hidden, and shows only rows related to the page (docs/notion-space-design.md §4). Where a block lists several views, they appear as view tabs on that one linked view. On project pages, the brain writes only inside the "Brief" and "Decision log" toggle headings (decision 0026), and on area pages inside "Brief" (decision 0041). Existing space? Use [migration 0003](../migrations/0003-look-pass.md) instead.

```text
Create a default page template for each database below. Each item "Heading: database (views)" means: an H3 heading with exactly that text, then a linked view of that database filtered to the current page, with the database title hidden; when views are listed, add them as separate views of that one linked view, in that order, with those names. Do not add callouts or any other content.

- Areas:
  First a toggle heading 2 "Brief" containing one empty paragraph.
  "What am I working toward here?": Goals where Area is this page and Status is Active, showing Name, Progress, Countdown.
  "What's active here?": Projects where Area is this page (views: "Active" Status is Active; "Planned" Status is Planned; "Done" Status is Done), showing Name, Status, Countdown, Task Progress.
  "What's on my plate here?": Tasks where Area is this page (views: "Open" Status is To Do or Doing; "Waiting On" Status is Waiting On; "Done" Status is Done), showing Name, Project, Due.
  "Which meetings?": Meetings where Area is this page (views: "Upcoming" Date on or after today, Date ascending; "Past" Date before today, Date descending), showing Name, Date, Project.
  "What have we decided here?": Decisions where Area is this page (views: "Current" Assessment is not Superseded, Date descending; "Superseded" Assessment is Superseded, Date descending), showing Name, Project, Date.
  "What's still open here?": Questions where Area is this page (views: "Open questions" Status is Open and Kind is Question; "Open risks" Status is Open and Kind is Risk; "Answered" Status is Answered), showing Name, Project, Kind.
  "What came in?": Inbox where Area is this page, sorted Created descending, showing Name, Kind, Summary.
  "What do we know?": Concepts where Area is this page, sorted Created time descending, showing Name, Summary, Project.
  Then a toggle "My notes".
- Goals:
  "How are the key results moving?": Key Results where Goal is this page (views: "Open" Progress is less than 100%; "Done" Progress is 100%), showing Name, Current, Target, Unit, Progress, Done.
  "Which projects serve it?": Projects where Goal is this page, showing Name, Status, Countdown, Task Progress.
  Then a toggle "My notes".
- Projects:
  First a gray paragraph: "Brief and Decision log are written by the brain. Add your own notes in My notes."
  A toggle heading 2 "Brief" containing one empty paragraph; a toggle heading 2 "Decision log" containing one empty paragraph.
  "What's on my plate here?": Tasks where Project is this page (views: "Open" Status is To Do or Doing; "Waiting On" Status is Waiting On; "Done" Status is Done), showing Name, Due, Status.
  "Which meetings?": Meetings where Project is this page (views: "Upcoming" Date on or after today, Date ascending; "Past" Date before today, Date descending), showing Name, Date, Brain Status.
  "What's still open here?": Questions where Project is this page and Status is Open, showing Name, Kind.
  "Who's involved?": People where Projects contains this page, showing Name, Role, Org.
  "What came in?": Inbox where Project is this page, sorted Created descending, showing Name, Kind, Summary.
  "What do we know?": two views, "Decisions" (Decisions where Project is this page, sorted Date descending, showing Name, Assessment, Date) and "Concepts" (Concepts where Project is this page, sorted Created time descending, showing Name, Summary).
  Then a toggle "My notes".
- Meetings:
  A gray callout containing a heading 3 "Before marking Reviewed", a divider, and the to-do items "Attendees linked", "Project linked", "Minutes follow the format", "Minutes checked and corrected".
  A Notion AI meeting notes block.
  A toggle "My notes".
  A toggle "Decisions" containing a linked view of Decisions where Decided In is this page.
  A toggle "Questions" containing a linked view of Questions where Raised In is this page.
  A toggle "Tasks" containing a linked view of Tasks where Meeting is this page.
- People:
  "Which meetings were they in?": Meetings where Attendees contains this page (views: "Upcoming" Date on or after today, Date ascending; "Past" Date before today, Date descending), showing Name, Date, Project.
  "What are they working on?": Projects where People contains this page, showing Name, Status.
  Then a toggle "My notes".
- Orgs:
  "Who works there?": People where Org is this page, showing Name, Role.
  "Which projects?": Projects where Client is this page, showing Name, Status, Countdown.
  Then a toggle "My notes".
Set each of these templates as the database default.
```

## Verify
- [ ] Create a new Project: the gray hint line comes first, then "Brief" and "Decision log" as **toggle** headings (with an arrow), then the six headed views and "My notes". Delete the test project.
- [ ] Create a new Area: it starts with a "Brief" toggle heading, then has the eight headed views, and its page header shows the two "via projects" rollups (set in the page layout, [views-guide.md](../views-guide.md) §9). Delete the test area.
- [ ] No template has a callout that prints "[Summary]", "[Role]" or "Why".
- [ ] Every template listed above is the default for its database.
