# Spaces, views and page layouts: manual build guide

A by-hand alternative to [Prompt 7](prompts/07-spaces-views.md) and [Prompt 8](prompts/08-navigation.md). Every view is spelled out: database, layout, filters, sort, grouping, visible properties and what it is for. You can build it in Notion yourself at your own pace, one Space at a time.

It is derived from [docs/notion-space-design.md](../docs/notion-space-design.md) §3–§5. If the two ever disagree, the design document wins (decision 0022).

**Before you start:** Prompts 1–6 are done. All 13 databases live on **Brain Data**, the relations exist, the formulas and rollups of Prompt 4 exist (Progress, Countdown, Task Progress, the "via projects" rollups), and the templates are the database defaults.

---

## How to build a view in Notion

1. On the Space page, type `/linked view of database` (or `/linked`) and pick the database. **Always link to the database on Brain Data. Never create a new database on a Space page.**
2. Choose the layout (Table, Board, List, Gallery, Calendar, Timeline).
3. Click the view name and rename it to the question in this guide, exactly, including the question mark.
4. Use **Filter**, **Sort** and **Group** in the view's toolbar (the `•••` menu → *Filter* / *Sort* / *Group*).
5. **Properties** (in the `•••` menu) controls which columns or card fields are visible. Hide everything not listed under *Show*.
6. To hide the database title on a linked view: `•••` → turn off *Show database title*. The view's question then acts as the heading.

**Date filters.** "Relative" date filters, such as *Last edited time is within Past week*, are set by choosing **Relative** in the date filter's dropdown.

**Ownership reminder.** The brain writes only the properties marked "Owner: brain" or "Owner: system". Views can show those properties, but don't edit their values in Notion except to correct a mistake. The next sync reads your edits to brain-owned values as corrections (decisions 0023, 0027).

---

## How a Space is arranged

- **Left column (narrow):** the synced Spaces navigation, plus any buttons for that Space.
- **Right column:** one **tabs** block (`/tabs`). Each tab holds one linked view, with *Show database title* turned off. The tab label is short ("Today"); the view's name is the question it answers ("What's due today?").
- **Lifecycle order:** tabs run from now, to later, to done, as in Easlo's dashboards.
- **Properties:** each view shows what you need to act on from that view, usually 2–4 properties. Anything else is one click away, on the page.

---

## 1. Home (start of day)

**Job:** see in ten seconds what you have to do today, then what the brain needs from you.

**Left column:** navigation, then a small heading "Needs you" with two short lists (views 1–2).
**Right column:** the three buttons in a row, then "What's on today?" as a tabs block (views 3–5).

| # | Tab | View name | Database | Layout | Filter | Sort | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | — | What needs my decision? | Review | List, 5 rows | State is Pending | Created time, descending | Name | Proposals waiting for you. Click one to decide it in the Review Space |
| 2 | — | Which minutes need review? | Meetings | List, 5 rows | Brain Status is Not Reviewed · Date is on or before today | Date, descending | Name | Minutes to check before the brain may ingest them. Upcoming meetings stay out |
| 3 | Tasks | What's due today? | Tasks | List | Status is To Do or Doing · Due is on or before today | Due, ascending | Name, Project, Due | Today's work, overdue first |
| 4 | Meetings | Which meetings are today? | Meetings | List | Date is today | Date, ascending | Name, Date, Project | Today's meetings, with time and project |
| 5 | Projects | What's active? | Projects | Gallery (small cards) | Status is Active · Archived is unchecked | Priority (High→Low), then Name | Name, Client, Countdown, Task Progress | What you're working on, and how far along each is |

**Buttons** (`/button`, each with *Open page after creation* on):

| Button | Action |
|---|---|
| Quick capture | Add page to *Inbox*, Kind = Capture, Brain Status = New |
| New meeting | Add page to *Meetings*, Date = today. The default template applies |
| New project | Add page to *Projects*, Status = Planned. The default template applies |

---

## 2. Tasks (do the work)

**Job:** know what to do now, what's coming, what you're waiting on, and what you've done. Waiting On and Someday are Notion-only: the brain creates tasks as To Do and never reads Status back.

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Today | What's due today? | List | Status is To Do or Doing · Due is on or before today | Due, ascending | — | Name, Project, Due, Status | Your day, overdue first. Set Doing when you start |
| 2 | Upcoming | What's coming up? | List | Status is To Do or Doing · Due is after today | Due, ascending | Due (by day) | Name, Project | The days ahead, one group per day |
| 3 | No date | What has no date? | List | Status is To Do or Doing · Due is empty | — | Project | Name, Meeting | Meeting tasks often arrive without a date. Give each a Due, or move it to Someday |
| 4 | Waiting On | What am I waiting on? | List | Status is Waiting On | Due, ascending | — | Name, Project, Due | Things that depend on someone else. Chase them, or set them back to To Do |
| 5 | Someday | What could I do someday? | List | Status is Someday | — | Project | Name | Ideas you're not committing to yet |
| 6 | Done | What did I finish? | List | Status is Done | Last edited time, descending | Last edited time (by week) | Name, Project | Easlo's logbook: what you got done, week by week |

All views use the Tasks database. Using your own Tasks database (0018)? Map the same filters to your own properties.

---

## 3. Meetings (prepare, review minutes, track ingestion)

**Job:** prepare upcoming meetings, then move each one from raw minutes → reviewed → ingested by the brain.

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Upcoming | What's coming up? | List | Date is on or after today | Date, ascending | — | Name, Date, Project, Attendees | Meetings you created ahead of time. Open one to prepare |
| 2 | To review | Which minutes need review? | Table | Brain Status is Not Reviewed · Date is on or before today | Date, descending | — | Name, Date, Project, Brain Status | Check the minutes with the checklist in the page, then set Reviewed (or Skipped) in this view |
| 3 | Ready | What's waiting for the brain? | List | Brain Status is Reviewed | Date, ascending | — | Name, Date, Project | The next ingest takes these. If one sits here for days, run the ingest |
| 4 | Ingested | What did the brain take in this week? | Table | Brain Status is Ingested · Ingested At is within *Past week* (relative) | Ingested At, descending | — | Name, Ingested At, Decisions, Questions | What each ingest produced |
| 5 | Calendar | When did we meet? | Calendar (by Date) | — | — | — | Name, Brain Status | Find a meeting by when it happened |

**The meeting flow, for reference:**
1. You create the meeting ahead of time (New meeting on Home), or Notion AI creates it when it starts taking notes.
2. Notion AI writes the minutes. Use [minutes-format.md](minutes-format.md) for the sections.
3. You tick the "Before marking Reviewed" checklist and set **Reviewed**.
4. The ingest sets **Ingested** and fills in Decisions, Questions and Attendees.
5. **Skipped** means the brain never reads that meeting.

---

## 4. Projects (run projects)

**Job:** keep each project moving, and notice the ones that stall. Finished projects are in Archive (§8).

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Active | What's active? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Status (Planned, Active, On Hold) | Name, Client, Priority, Countdown, Task Progress | Move projects between stages; see time left and work done on each card |
| 2 | By area | What's in each area? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Area (show "No area") | Name, Status, Countdown | Balance across areas; link projects with no area |
| 3 | Deadlines | What's due soon? | Timeline (by Dates) | Status is Active or Planned · Archived is unchecked | Dates (end), ascending | — | Name, Countdown | Deadlines in order; the timeline shows overlap |
| 4 | Gone quiet | Which projects have gone quiet? | Table | Status is Active · Last edited time is **before** *one month ago* (relative) | Last edited time, ascending | — | Name, Last edited time, Last Synced, Client | Active projects nobody has touched in 30 days. Restart, pause (On Hold) or close each one |

**Key Facts** (for example "Budget: 80000 EUR · Launch date: 2027-02") is kept current by the brain and sits first in the project page's panel.

---

## 5. Plan (areas → goals → key results → projects)

**Job:** check that what you do serves what you want. Areas are the way into each Area page, which collects everything for that area.

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Goals | What am I working toward? | Gallery (medium cards) | Status is Active · Archived is unchecked | Deadline, ascending | — | Name, Progress (bar), Countdown, Area | Your active goals with progress and time left. Glance at it weekly |
| 2 | Key results | How are my key results moving? | Table | Goal → Status is Active (if your Notion can't filter through a relation, use Done is unchecked) | Due, ascending | Goal | Name, Current, Target, Unit, Progress, Done | Update Current and tick milestones here |
| 3 | Areas | Which areas do I own? | Gallery (small cards) | Archived is unchecked | Type, then Name | — | Name, Type | Open an area to see its goals, projects, tasks, meetings, decisions and people |
| 4 | Projects by goal | Which projects serve each goal? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Goal (show "No goal") | Name, Status | Spot projects with no goal, and goals with no project |

**Progress as a bar:** click Progress → *Show as* → **Bar**, color green, show the number.

---

## 6. Review (decide on proposals)

**Job:** approve, reject or edit every change the brain proposes to your existing knowledge (decision 0003).

| # | Tab | View name | Layout | Filter | Sort | Show | Use case |
|---|---|---|---|---|---|---|---|
| 1 | Needs my decision | What needs my decision? | Table | State is Pending | Created time, descending | Name, Kind, Before, After, Decision, Note | Your main queue. Set Decision here, and Note when you want something different: the value for Edit, or "all except Ana" on a grouped row. To see Why or the source, open the row |
| 2 | Sources disagree | Where do sources disagree? | Table | Kind is Contradiction · State is Pending | Created time, ascending | Name, Before, After, Decision | Approve keeps both claims as contested. Edit (in the page) sets the true value |
| 3 | Approved | What did I approve recently? | List | State is Applied · Last edited time is within *Past month* (relative) | Last edited time, descending | Name, Kind, After | Audit trail of what changed |
| 4 | Rejected | What did I reject? | List | State is Closed | Last edited time, descending | Name, Kind | Rejected or stale proposals. The brain may propose one again on the next ingest |

**How to decide:**

| Kind | Approve means | Edit allowed? |
|---|---|---|
| Update Fact | The new value replaces the old one; history is kept | Yes, with your own value |
| Add To Note | The text is appended to the note | Yes, with your own wording |
| Contradiction | Both claims are kept as contested | Yes: your value becomes the accepted truth |
| Supersede | The newer note replaces the older one, which is archived | No |
| Merge | The duplicate is folded into the survivor | No |
| New Item | The new note is created as Draft | No |

---

## 7. Knowledge (what the brain knows)

**Job:** find decisions, open questions, what the brain learned, people and organisations, and everything that came in, in Easlo's Notes Dashboard pattern: one tab per database, and inside each tab one linked view with several views (Recent, Current, History).

| Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|
| Decisions | What did we decide recently? | List | Date is within *Past week* (relative) | Date, descending | — | Name, Project, Date | This week's decisions |
| Decisions | What did we decide? | Table | Assessment is Accepted · Lifecycle is not Archived | Date, descending | — | Name, Project, Date, Summary | Current decisions. Answers "why did we choose X?" |
| Decisions | What's provisional? | List | Assessment is Provisional | Date, descending | — | Name, Project, Date | Mentioned once, not yet confirmed. Confirm them in the next meeting |
| Decisions | What changed our minds? | Table | Assessment is Superseded | Date, descending | — | Name, Superseded By, Date | Replaced decisions and what replaced them |
| Decisions | What's disputed? | List | Lifecycle is Disputed | Date, descending | — | Name, Summary | Records you marked as wrong. Fix them or ask the brain to |
| Questions | What's still open? | List | Status is Open · Kind is Question | Created time, descending | — | Name, Project, Raised In | Open questions. Set Answered or Dropped when resolved |
| Questions | Which risks are open? | List | Status is Open · Kind is Risk | Created time, descending | — | Name, Project, Raised In | Open risks |
| Questions | What did we answer? | List | Status is Answered | Created time, descending | — | Name, Project, Summary | Resolved questions and their answer |
| Concepts | What did we learn recently? | List | Lifecycle is not Archived | Created time, descending | — | Name, Project, Summary | Ideas and methods from your documents and meetings |
| Concepts | What do we know per project? | Table | Lifecycle is not Archived | Name | Project | Name, Area, Summary | What the brain learned, by project |
| Concepts | Which concepts are drafts? | List | Lifecycle is Draft | Created time, descending | — | Name, Project | New concepts to read and mark Reviewed |
| People | Who's who? | Gallery (small cards) | Lifecycle is not Archived | Name | Org | Name, Role, Org | Find a person by company and role |
| People | Who's disputed? | List | Lifecycle is Disputed | Name | — | Name, Summary | People records you marked as wrong |
| Orgs | Which clients do I have? | Table | Relationship is Client · Lifecycle is not Archived | Name | — | Name, People, Projects | Your clients with their contacts and projects |
| Orgs | Who else do we work with? | Table | Relationship is not Client · Lifecycle is not Archived | Name | Relationship | Name, Relationship, People | Prospects, partners and suppliers |
| Inbox | What's in my inbox? | List | Brain Status is New | Created, ascending | — | Name, Kind, Project, Created | Captures waiting for the brain, oldest first. Set Project so the ingest doesn't ask; set Skipped for anything the brain shouldn't touch |
| Inbox | What came in? | Table | Brain Status is Processed | Created, descending | — | Name, Kind, Summary, Project, Decisions, Concepts | History: every document, email and capture the brain took in, and what it made from each |

There is no Notes database on purpose: notes typed there would never reach the brain. Quick notes go to the Inbox, and notes about a record go in its "My notes" toggle.

---

## 8. Archive (under System)

**Job:** find what's finished without cluttering the Spaces. A page named "Archive" on System, linked from the navigation, with one tab per database.

| Tab | View name | Database | Layout | Filter | Sort | Show |
|---|---|---|---|---|---|---|
| Projects | What's finished? | Projects | Table | Status is Done **or** Archived is checked (filter group joined with Or) | Dates (end), descending | Name, Dates, Client, Status |
| Goals | Which goals are closed? | Goals | Table | Status is Achieved or Dropped, **or** Archived is checked | Deadline, descending | Name, Status, Deadline |
| Areas | Which areas did I close? | Areas | List | Archived is checked | Name | Name, Type |
| Decisions | Which decisions are archived? | Decisions | List | Lifecycle is Archived | Date, descending | Name, Project, Date |
| Questions | Which questions are archived? | Questions | List | Lifecycle is Archived | Created time, descending | Name, Project, Status |
| Concepts | Which concepts are archived? | Concepts | List | Lifecycle is Archived | Name | Name, Project |
| People | Who is archived? | People | List | Lifecycle is Archived | Name | Name, Org |
| Orgs | Which orgs are archived? | Orgs | List | Lifecycle is Archived | Name | Name, Relationship |

---

## 9. Database page layouts

Notion lets you shape how each database page opens. Set it once per database: open any row as a full page → `•••` → **Customize layout**. It applies to every page of that database.

- **Heading:** the title plus pinned properties, left to right. Pin what *you* change; keep it to 2–4 so nothing falls into the side scroller.
- **Property group:** one per layout, placed in the **main** page area or the **details panel**. Pinned properties leave it.
- **Hidden:** shown only on *Show all properties*.
- **Backlinks:** *Show always*, *On hover* or *Off*.

Relations the template already shows as linked views (meetings, tasks, questions) stay in the panel, out of the way.

| Database | Heading (in order) | Property group: where · order | Hidden | Backlinks | Why |
|---|---|---|---|---|---|
| Areas | Type, Lifecycle | Panel · Summary, People via projects, Clients via projects, Goals, Projects, Meetings, Decisions, Questions, Concepts, Inbox, Tasks, Archived | Brain ID, Last Synced | Off | An area is mostly its links to goals and projects |
| Goals | Status, Progress, Countdown | Panel · Deadline, Why, Area, Key Results, Projects, Summary, Lifecycle, Archived | Brain ID, Last Synced | Off | Progress and status at a glance |
| Key Results | Progress, Current, Target | Main · Goal, Kind, Start, Unit, Done, Due | — | Off | No body; you edit Current in the heading |
| Projects | Status, Priority, Countdown, Task Progress | Panel · Dates, Key Facts, Client, Area, Goal, People, Summary, Lifecycle, Archived, Meetings, Decisions, Questions, Concepts, Inbox, Tasks | Brain ID, Last Synced, Last edited time | Off | Body = Brief + Decision log toggles; Key Facts first in the panel |
| Meetings | Brain Status, Date, Project | Panel · Attendees, Area, Decisions, Questions, Tasks, Review Items | Brain ID, Ingested At | Off | Brain Status is the one field you change per meeting |
| People | Role, Org | Panel · Email, Projects, Meetings, Sources, Summary, Lifecycle | Brain ID, Last Synced | On hover | Who they are and where they work |
| Orgs | Relationship, Website | Panel · Meetings via projects, People, Projects, Summary, Lifecycle | Brain ID, Last Synced | On hover | — |
| Decisions | Assessment, Date, Project | Panel · Area, Decided In, Supersedes, Superseded By, Sources, Summary, Lifecycle | Brain ID, Last Synced | Show always | The body is brain-written; backlinks show supersede chains and mentions |
| Questions | Status, Kind, Project | Panel · Area, Raised In, Sources, Summary, Lifecycle | Brain ID, Last Synced, Created time | Off | You set Status |
| Review | Decision, Kind, State | Main · Before, After, Why, Note, Target, Target Page, Source Meeting | Brain ID, Created time, Last edited time | Off | No body; read Before, After and Why, then decide in the heading |
| Inbox | Brain Status, Kind, Project | Main · Summary, Area, Decisions, Questions, Concepts, People, Tasks, Created | Brain ID, Last Synced | Off | What came in, and what the brain made from it |
| Concepts | Lifecycle, Project | Panel · Area, Sources, Summary | Brain ID, Last Synced, Created time | Show always | The body is brain-written |
| Tasks | Status, Due | Panel · Project, Area, Meeting, Source | Brain ID, Last edited time | Off | Only if you use the default Tasks database |

**Hide system properties everywhere.** Brain ID, Last Synced, Created time and Last edited time are plumbing (owner "system"). Hide them in every view and layout, except where a view lists one to show (for example Last edited time in "Which projects have gone quiet?"). Don't delete them, because the brain matches records by Brain ID.

---

## 10. Navigation (instead of Prompt 8)

1. **On the "System" page,** create a synced block named "Tier 1 nav": one line of links, Home · Tasks · Meetings · Projects · Plan · Review · Knowledge · Archive · How it works, unthemed. For questions, use Brain Assistant ([brain-assistant.md](brain-assistant.md)).
2. **Still on "System",** create one synced block per Space, "Tier 2 nav – Plan" and so on. Each lists that Space's view names as links (right-click a view tab → *Copy link to view*), with its own icon and a light background color.
3. **On each Space page,** add a narrow left column containing: Tier 1 nav, a divider, then that Space's Tier 2 nav. Home gets only Tier 1.
4. **Above each page title,** add a small gray text label with the page name. It's a plain block, not synced.

**Check:** edit Tier 1 on System, and the change appears everywhere.

---

## 11. Done checklist

- [ ] Every Space holds only linked views (plus the three buttons on Home); no database lives outside Brain Data.
- [ ] Home "Which minutes need review?" leaves out meetings dated after today.
- [ ] Tasks has the statuses Waiting On and Someday, and the Done tab groups by week.
- [ ] Archive is on System and linked from the navigation; "What's finished?" is no longer in Projects.
- [ ] View names match this guide exactly, question marks included.
- [ ] Home "What needs my decision?" shows only Pending rows; Knowledge "What changed our minds?" shows only Superseded decisions.
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status New; New meeting and New project open a page with the default template.
- [ ] Brain ID and Last Synced are hidden in every view and page layout.
- [ ] Editing Tier 1 nav on System updates every Space.
