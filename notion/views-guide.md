# Spaces, views and page layouts: manual build guide

A by-hand alternative to [Prompt 7](prompts/07-spaces-views.md) and [Prompt 8](prompts/08-navigation.md). Every view is spelled out: database, layout, filters, sort, grouping, visible properties and what it is for. You can build it in Notion yourself at your own pace, one Space at a time.

It is derived from [docs/notion-space-design.md](../docs/notion-space-design.md) §3–§5. If the two ever disagree, the design document wins (decision 0022).

**Before you start:** Prompts 1–6 are done. The databases of Core and your modules live on **Brain Data**, the relations and the Domain rollups of Prompt 3 exist, the formulas and rollups of Prompt 4 exist (Progress, Countdown, Task Progress, the Areas counts, the "via projects" rollups), and the templates are the database defaults.

**Modules** (decision 0048). A view, tab, column or button of a module you left off is skipped: the Tasks Space needs Tasks, Plan needs Planning, and each row below names its module when it has one (*(Documents)*, *(Tasks)* …). A column of a module you left off is simply not shown.

---

## How to build a view in Notion

1. On the Space page, type `/linked view of database` (or `/linked`) and pick the database. **Always link to the database on Brain Data. Never create a new database on a Space page.**
2. Choose the layout (Table, Board, List, Gallery, Calendar, Timeline).
3. Click the view name and rename it to the question in this guide, exactly, including the question mark.
4. Use **Filter**, **Sort** and **Group** in the view's toolbar (the `•••` menu → *Filter* / *Sort* / *Group*).
5. **Properties** (in the `•••` menu) controls which columns or card fields are visible. Hide everything not listed under *Show*.
6. To hide the database title on a linked view: `•••` → turn off *Show database title*. The view's question then acts as the heading.

**Date filters.** "Relative" date filters, such as *Last edited time is within Past week*, are set by choosing **Relative** in the date filter's dropdown.

**Ownership reminder.** The brain writes only the properties marked "Owner: brain" or "Owner: system". Views can show those properties, but don't edit their values in Notion except to correct a mistake. An edit to a brain-owned value is asked in your agent session before it reaches the brain: the next sync finds it, and your next Claude Code or Codex session asks all such corrections as one question, since the brain can't tell your edit from one by Notion AI or another tool (decisions 0023, 0027, 0101 §4).

---

## How a Space is arranged

- **Left column (narrow):** the synced Spaces navigation, plus any buttons for that Space.
- **Right column:** one **tabs** block (`/tabs`). Each tab holds one linked view, with *Show database title* turned off. The tab label is short ("Today"); the view's name is the question it answers ("What's due today?").
- **Lifecycle order:** tabs run from now, to later, to done, as in Easlo's dashboards.
- **Properties:** each view shows what you need to act on from that view, usually 2–4 properties. Anything else is one click away, on the page.

---

## 1. Home (start of day)

**Job:** see in ten seconds what you have to do today, then what the brain needs from you.

Nothing sits above the two columns (#143, decision 0053).
**Left column:** navigation, then a small heading "Needs you" with one short list (view 2). You decide what the brain proposes in your agent session, not here (decision 0096); the week's review is an Inbox row, Kind Weekly, in the Inbox tab.
**Right column:** the buttons in a row, then "What's on today?" as a tabs block (views 0, 0b, 3–5, 5b), then "What did the brain take in?" as a second tabs block (views 6–7).

| # | Tab | View name | Database | Layout | Filter | Sort | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 0 | Areas | How are my areas? | Areas | List | Archived is unchecked | Name | Name, At a glance | Your areas, each line readable on its own: "Day job · 1 meeting · 2 due", or "all clear" (#145). Open one for its home (0050). The first tab |
| 0b | Areas | What's due across areas? *(Tasks)* | Tasks | List, 5 rows | Status is not Done · Status is not Won't Do · Due is on or before today | Due, ascending | Name, Area, Due | Due today or overdue, in every area |
| 2 | — | Which minutes need review? | Meetings | List, 5 rows | Brain Status is New · Date is on or before today | Date, descending | Name | Minutes to check before the brain may ingest them. Upcoming meetings stay out |
| 3 | Tasks *(Tasks)* | What's due today? | Tasks | List | Status is To Do or Doing · Due is on or before today | Due, ascending | Name, Project, Due | Today's work, overdue first |
| 4 | Meetings | Which meetings are today? | Meetings | List | Date is today | Date, ascending | Name, Date, Project | Today's meetings, with time and project |
| 5 | Projects | What's active? | Projects | Gallery (small cards) | Status is Active · Archived is unchecked | Priority (High→Low), then Name | Name, Countdown, *(Orgs)* Client, *(Tasks)* Task Progress | What you're working on, and how far along each is |
| 5b | Inbox | What's in my inbox? | Inbox | List | Brain Status is New or Ready | Created, ascending | Name, Kind, Brain Status | Rows waiting for the brain, oldest first: set one Ready when it can be taken in. The week's review (Kind Weekly) and a catch-up's summary (Kind Catch-up) show here until they are Done; they are never taken in. A changed version of a document waiting for your check (Kind Changed) shows here too: read it, edit it if you want, then say *go* in your agent session or set it Ready (decision 0098 §4). The last tab; the buttons and the boxes they tick are on each row's page (#146) |
| 6 | Came in | What came in lately? | Inbox | List, 10 rows | Brain Status is Done | Created, descending | Name, Kind, Project | The Brain feed (0043): every document, email and capture the brain took in, newest first (reports are in Documents since 0.9.1) |
| 7 | Meetings | Which meetings did it take in? | Meetings | List, 10 rows | Brain Status is Done | Ingested At, descending | Name, Date, Project | The meetings the brain ingested, newest first. Together with view 6, everything the brain did |

**Buttons** (`/button`, each with *Open page after creation* on):

| Button | Action |
|---|---|
| Quick capture | Add page to *Inbox*, Kind = Capture, Brain Status = **Ready**: the next catch-up takes it in (0048) |
| Ask the brain *(Reports)* | Add page to *Inbox*, Kind = Ask, Brain Status = New. Type your question as the Name; the next catch-up answers it with a report in Documents, linked to the row (0043, 0071) |
| New meeting | Add page to *Meetings*, Date = today. The default template applies |
| New project | Add page to *Projects*, Status = Planned. The default template applies |
| New task *(Tasks)* | Add page to *Tasks*, Kind = Task. Status keeps the database's default (To Do); no Project, Area or Due is set. The row you would add by hand in Tasks (decision 0106 §12). On your own Tasks database (0018), add the page to it and set your Kind property to Task if you mapped one; set nothing else |

---

## 2. Tasks (do the work) *(Tasks)*

**Job:** know what to do now, what's coming, what you're waiting on, and what you've done. Waiting On and Someday are Notion-only: the brain creates tasks as To Do and reads Status back only on a task that tracks a question (decision 0101 §6). **Questions** and **Risks** list the questions and risks you follow up (decision 0099 §4): a task the brain creates when you say "track it", or from `Track: Waiting On —` on a question or risk line in the minutes.

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Today | What's due today? | List | Status is To Do or Doing · Due is on or before today | Due, ascending | — | Name, Project, Due, Status | Your day, overdue first. Set Doing when you start |
| 2 | Upcoming | What's coming up? | List | Status is To Do or Doing · Due is after today | Due, ascending | Due (by day) | Name, Project | The days ahead, one group per day |
| 3 | No date | What has no date? | List | Status is To Do or Doing · Due is empty | — | Project | Name, Meeting | Meeting tasks often arrive without a date. Give each a Due, or move it to Someday |
| 4 | Waiting On | What am I waiting on? | List | Status is Waiting On | Due, ascending | — | Name, Project, Due | Things that depend on someone else. Chase them, or set them back to To Do |
| 5 | Someday | What could I do someday? | List | Status is Someday | — | Project | Name | Ideas you're not committing to yet |
| 6 | Questions | Which questions am I following up? | List | Kind is Question · Status is not Done · Status is not Won't Do | Due, ascending | — | Name, Project, Status | The open questions you track, across every project. When one is answered, your agent session asks to record the answer and set the task Done |
| 7 | Risks | Which risks am I following up? | List | Kind is Risk · Status is not Done · Status is not Won't Do | Due, ascending | — | Name, Project, Status | The risks you act on, across every project |
| 8 | Done | What did I finish? | List | Status is Done | Last edited time, descending | Last edited time (by week) | Name, Project | Easlo's logbook: what you got done, week by week |

All views use the Tasks database. Using your own Tasks database (0018)? Map the same filters to your own properties; without Kind, filter Questions and Risks on a Name that starts with "Question: " or "Risk: ".

---

## 3. Meetings (prepare, review minutes, track ingestion)

**Job:** prepare upcoming meetings, then move each one from New (raw minutes) → Ready (you checked them) → Done (taken in by the brain). Meetings use the Inbox's names (decision 0109).

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Upcoming | What's coming up? | List | Date is on or after today | Date, ascending | — | Name, Date, Project, Attendees | Meetings you created ahead of time. Open one to prepare |
| 2 | To review | Which minutes need review? | Table | Brain Status is New · Date is on or before today | Date, descending | — | Name, Date, Project, Brain Status | Check the minutes with the checklist in the page, then set Ready (or Skipped) in this view |
| 3 | Ready | What's waiting for the brain? | List | Brain Status is Ready | Date, ascending | — | Name, Date, Project | The next ingest takes these. If one sits here for days, run the ingest |
| 4 | Ingested | What did the brain take in this week? | Table | Brain Status is Done · Ingested At is within *Past week* (relative) | Ingested At, descending | — | Name, Ingested At | What each ingest took in; what it produced shows on the project's page (Brief, Decision log, Tasks) |
| 5 | Calendar | When did we meet? | Calendar (by Date) | — | — | — | Name, Brain Status | Find a meeting by when it happened |

**The meeting flow, for reference:**
1. You create the meeting ahead of time (New meeting on Home), or Notion AI creates it when it starts taking notes.
2. Notion AI writes the minutes. Use [minutes-format.md](minutes-format.md) for the sections.
3. You tick the "Before setting Ready" checklist and set **Ready**.
4. The ingest sets **Done** (and Ingested At), fills in Attendees and creates the meeting's Tasks, once. Never let Notion AI or a notetaker create Tasks from the meeting: the ingest would create them again (decision 0101 §5).
5. Meetings have one extra state, **Skipped**, for a meeting you keep but don't want in the brain: the brain never reads it.

A space built before 0.16.2 named these Not Reviewed, Reviewed and Ingested; [migration 0029](migrations/0029-new-task-on-home-clean-email-and-the-minutes-layout.md) renames them in place, and the brain reads the old names as the new ones until then.

---

## 4. Projects (run projects)

**Job:** keep each project moving, and notice the ones that stall. Finished projects are in Archive (§8).

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Active | What's active? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Status (Planned, Active, On Hold) | Name, Priority, Countdown, *(Orgs)* Client, *(Tasks)* Task Progress | Move projects between stages; see time left and work done on each card |
| 2 | By area | What's in each area? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Area (show "No area") | Name, Status, Countdown | Balance across areas; link projects with no area |
| 3 | Deadlines | What's due soon? | Timeline (by Dates) | Status is Active or Planned · Archived is unchecked | Dates (end), ascending | — | Name, Countdown | Deadlines in order; the timeline shows overlap |
| 4 | Gone quiet | Which projects have gone quiet? | Table | Status is Active · Last edited time is **before** *one month ago* (relative) | Last edited time, ascending | — | Name, Last edited time, Last Synced | Active projects nobody has touched in 30 days. Restart, pause (On Hold) or close each one |

**Key Facts** (for example "Budget: 80000 EUR · Launch date: 2027-02") is kept current by the brain and sits first in the project page's panel.

---

## 5. Plan (areas → goals → key results → projects) *(Planning)*

**Job:** check that what you do serves what you want. Areas are the way into each Area page, which collects everything for that area.

| # | Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Goals | What am I working toward? | Gallery (medium cards) | Status is Active · Archived is unchecked | Deadline, ascending | — | Name, Progress (bar), Countdown, Area | Your active goals with progress and time left. Glance at it weekly |
| 2 | Key results | How are my key results moving? | Table | Goal → Status is Active (if your Notion can't filter through a relation, use Done is unchecked) | Due, ascending | Goal | Name, Current, Target, Unit, Progress, Done | Update Current and tick milestones here |
| 3 | Areas | Which areas do I own? | Gallery (small cards) | Archived is unchecked | Name | — | Name | Open an area to see its goals, projects, tasks, meetings and people, and its Brief |
| 4 | Projects by goal | Which projects serve each goal? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Goal (show "No goal") | Name, Status | Spot projects with no goal, and goals with no project |

**Progress as a bar:** click Progress → *Show as* → **Bar**, color green, show the number.

---

## 6. Review (retired in 0.16.0)

There is no Review page or Review database since 0.16.0 (decision 0096): you decide what the brain proposes in your Claude Code or Codex session ("what needs my decision"), and the week's review is an Inbox row, Kind Weekly. A space built before 0.16.0 archives both with [migration 0027](migrations/0027-one-place-to-decide.md). The section number stays, so the references to §9 hold.

---

## 7. Knowledge (what the brain knows)

**Job:** find what the brain learned and what you kept, people and organisations, and everything that came in, in Easlo's Notes Dashboard pattern: one tab per database, and inside each tab one linked view with several views (Recent, Current, History).

| Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|
| Documents *(Documents)* | What did we keep? | List | Lifecycle is not Archived · Origin is not Report | Last edited time, descending | — | Name, Project, Summary | Documents (0049): whole inputs, the parts you asked for (requirements, price lists), and pages promoted from decisions (asked in your agent session), kept up to date as new versions arrive |
| Documents *(Documents)* | What did we learn? | List | Origin is Learned and Lifecycle is not Archived | Created time, descending | — | Name, Project, Summary | Ideas, methods and definitions the brain learned from your documents and meetings (0071; Concepts before 0.9.1) |
| Documents *(Reports)* | Which reports do I have? | List | Origin is Report | Last edited time, descending | — | Name, Project, Area, Refresh asked, What to fix | Your living reports, one per subject (0045, 0071). Open one to refresh it or say what it gets wrong |
| People | Who's who? | Gallery (small cards) | Lifecycle is not Archived | Name | *(Orgs)* Org | Name, Role, *(Orgs)* Org | Find a person by company and role |
| People | Who's disputed? | List | Lifecycle is Disputed | Name | — | Name, Summary | People records you marked as wrong |
| Orgs *(Orgs)* | Which clients do I have? | Table | Relationship is Client · Archived is unchecked | Name | — | Name, People, Projects | Your clients with their contacts and projects |
| Orgs *(Orgs)* | Who else do we work with? | Table | Relationship is not Client · Archived is unchecked | Name | Relationship | Name, Relationship, People | Prospects, partners, suppliers and your employer |
| Inbox | What came in? | Table | Brain Status is Done | Created, descending | — | Name, Kind, Summary, Project | History: every document, email and capture the brain took in, and what it made from each |

There is no Decisions or Questions tab since 0.16.0 (decision 0099): a project's decisions and its open questions and risks are in its Brief and Decision log, and the ones you follow up are in Tasks → Questions and Risks. There is no Notes database on purpose: notes typed there would never reach the brain. Quick notes go to the Inbox, and notes about a record go in its "My notes" toggle.

---

## 8. Archive (under System)

**Job:** find what's finished without cluttering the Spaces. A page named "Archive" on System, linked from the navigation, with one tab per database. In a space migrated to 0.16.0 it also holds the archived Review, Decisions and Questions databases, as full pages, with no tab.

| Tab | View name | Database | Layout | Filter | Sort | Show |
|---|---|---|---|---|---|---|
| Projects | What's finished? | Projects | Table | Status is Done **or** Archived is checked (filter group joined with Or) | Dates (end), descending | Name, Dates, Status |
| Goals *(Planning)* | Which goals are closed? | Goals | Table | Status is Achieved or Dropped, **or** Archived is checked | Deadline, descending | Name, Status, Deadline |
| Areas | Which areas did I close? | Areas | List | Archived is checked | Name | Name |
| Documents *(Documents)* | Which documents are archived? | Documents | List | Lifecycle is Archived | Name | Name, Project |
| People | Who is archived? | People | List | Lifecycle is Archived | Name | Name, Role |
| Orgs *(Orgs)* | Which orgs are archived? | Orgs | List | Archived is checked | Name | Name, Relationship |

---

## 9. Database page layouts

Notion lets you shape how each database page opens. Set it once per database: open any row as a full page → `•••` → **Customize layout**. It applies to every page of that database.

- **Heading:** the title plus pinned properties, left to right. Pin what *you* change; keep it to 2–4 so nothing falls into the side scroller.
- **Property group:** one per layout, placed in the **main** page area or the **details panel**. Pinned properties leave it.
- **Hidden:** shown only on *Show all properties*.
- **Backlinks:** *Show always*, *On hover* or *Off*.

**The rule** (decision 0048; docs/notion-space-design.md §3.15): what you act on is **pinned in the heading**; what the brain wrote comes next, in the property group; system fields (Brain ID, Last Synced, timestamps) are **hidden**. Relations the template already shows as linked views (meetings, tasks) stay in the panel, out of the way. A property of a module you left off isn't there: skip it.

**Buttons** (decision 0048) are properties too, so they go in the heading; the box each one ticks goes at the top of the property group (#144). The API can't create them; add each by hand: database `•••` → Properties → **New property** → **Button**, action **Edit property** on **This page**:

| Property name | Button label | Database | Action | Module |
|---|---|---|---|---|
| Keep | Keep as document | Inbox | Document asked → checked; Brain Status → Ready | Documents |
| Keep | Keep as document | Tasks | Document asked → checked (nothing else: decision 0100) | Tasks (the brain acts on it with Documents on) |
| Update | Refresh report | Documents (on the Inbox before 0.9.1, 0071) | Send message to Brain Assistant (0054; before 0.8.0: Refresh asked → checked). Refresh asked is now ticked by hand to queue a full refresh | Reports |
| Tidy | Tidy capture | Inbox | Send message to Brain Assistant | core |
| Write | Write up | Documents | Send message to Brain Assistant | Documents |
| Accept | Accept | Documents | Accepted → checked; Accepted at → now: a write-up or a refreshed report (0071; Accept write-up on Documents and Accept refresh on the Inbox before 0.9.1) | Documents |

The name and the label differ, so the layout doesn't show the same text twice (#144). The brain reads the boxes the checkbox buttons tick (and Accepted and Accepted at), never a button.

**The Brain Assistant buttons (decision 0054)** use the action **Send message to** → Brain Assistant. The page a button sits on is not identified implicitly (verified for Tidy capture on a test Inbox row; that nothing else is passed is an inference, and the Write up and Refresh report messages are not yet run, docs/notion-space-design.md §3.16), so each message names the skill, references the row with an @ mention of **This page**, carries your confirmation and says what not to touch (verified on a test row, docs/notion-space-design.md §3.16). Type `@` and pick the current page where `@This page` is shown below:

| Button | Message |
|---|---|
| Tidy capture | `Run your Tidy capture skill on this Inbox page: @This page. I confirm: replace the text below the title with the rewrite, as the skill says. Do not change the title, Brain Status or any property.` |
| Write up | `Run your Write up skill on this Documents page: @This page. I confirm: do it as the skill says. Do not change any property or any other page.` |
| Refresh report | `Run your Refresh report skill on this report: @This page. I confirm: add or replace the Proposed refresh toggle as the skill says. Do not change the report's text outside it, or any property.` |

**Select your own agent** (decision 0103 §1). In **Send message to**, select the Brain Assistant you created in your workspace: a duplicate of the template never carries a configured agent, so in a duplicate each of the three buttons is opened (database ••• → Properties → the button) and your agent selected, as **First things first** lists. Selecting the agent says who receives the message; the **@This page** in the message says which page it is about: keep the message as it is, one never replaces the other. The buttons that message Brain Assistant need Notion's Business or Enterprise plan with Notion credits, as Brain Assistant does (decision 0101 §7). A message without the page reference makes Brain Assistant stop and say so. A message carries the confirmation for its skill's page text only, never a yes to set a field: Brain Assistant sets your operational fields only in its chat, after your yes to the change it names with its value (decision 0101 §3, docs/notion-space-design.md §2). The Accept button uses **Edit property** on **This page**: Accepted → checked and Accepted at → Now.

| Database | Heading (in order) | Property group: where · order | Hidden | Backlinks | Why |
|---|---|---|---|---|---|
| Areas | At a glance | Panel · Meetings to review, Due, Summary, People via projects, Clients via projects, Goals, Projects, Meetings, Documents, Inbox, Tasks, Archived, Workflow, Work type, Logging level, Log artifacts | Brain ID, Last Synced | Off | The area's home (0050): its counts as one line in the heading, everything else in its views |
| Goals | Status, Progress, Countdown | Panel · Deadline, Why, Area, Key Results, Projects, Summary, Archived | Brain ID, Last Synced | Off | Progress and status at a glance |
| Key Results | Progress, Current, Target | Main · Goal, Kind, Start, Unit, Done, Due | — | Off | No body; you edit Current in the heading |
| Projects | Status, Priority, Countdown, Task Progress | Panel · Dates, Key Facts, Client, Area, Domain, Goal, People, Summary, Archived, Meetings, Documents, Inbox, Tasks, Workflow, Work type, Logging level, Log artifacts | Brain ID, Last Synced, Last edited time | Off | Body = Brief + Decision log toggles; Key Facts first in the panel. The Workflow settings close the panel (decision 0059) |
| Meetings | Brain Status, Date, Project | Panel · Attendees, Area, Domain, Tasks | Brain ID, Ingested At | Off | Brain Status is the one field you change per meeting |
| People | Role, Org | Panel · Email, Projects, Meetings, Sources, Summary, Lifecycle | Brain ID, Last Synced | On hover | Who they are and where they work |
| Domains | Archived | Panel · Areas, Org, Summary | Brain ID, Last Synced | Off | No Type (decision 0105): a Domain's Name and Summary say what kind of context it is. The body lists its projects, meetings and documents (§9a) |
| Orgs | Relationship, Website | Panel · Meetings via projects, People, Projects, Summary, Archived | Brain ID, Last Synced | On hover | — |
| Inbox | Keep, Tidy, Brain Status, Project, Area | Main · Document asked, Only keep, Kind, Changed from, What changed, Summary, Documents, People, Tasks, Report | Brain ID, Last Synced, Created | Off | What came in, and what the brain made from it. The body is the brain's digest, and the "Full text" toggle when you chose it (0043); on a changed version (Kind Changed), the text you check (0098 §4) |
| Documents | Write, Update, Accept, Lifecycle, Project, Area, Sources | Panel · Domain, Accepted, Accepted at, Refresh asked, What to fix, Asked in, Task, Origin, Summary | Brain ID, Last Synced, Created time, Last edited time | Show always | The body is brain-written, or yours on a promoted Document (0049) |
| Tasks | Keep, Status, Due, Kind | Panel · Document asked, Project, Area, Meeting, Source | Brain ID, Last edited time | Off | Only if you use the default Tasks database |

**Domain on Projects, Meetings and Documents** (decision 0105) is the rollup of Prompt 3: Notion computes it from the Area, and you never edit it. With the Domains module on, it sits in the panel right after Area (on Documents, first in the panel, since Area is pinned); with it off, hide it.

**Hide system properties everywhere.** Brain ID, Last Synced, Created time and Last edited time are plumbing (owner "system"). Hide them in every view and layout, except where a view lists one to show (for example Last edited time in "Which projects have gone quiet?"). Don't delete them, because the brain matches records by Brain ID.

## 9a. The Domains page template (decision 0105)

A Domain page lists that Domain's projects, meetings and documents. The API can't build a page template's views, so this is by hand. Open **Domains** → the **New** arrow (▾) → the default template (create one if there is none, and set it as the default) → **Edit**. Under the title, the page shows **Areas** and, with Orgs, **Org**, and no Type. Then add three linked views, each under an H3 heading, with *Show database title* off:

| Heading | View name | Database | Filter | Sort | Show | Module |
|---|---|---|---|---|---|---|
| Which projects? | Projects | Projects | **Domain** contains **This page** | Name | Name, Status, Area | core |
| Which meetings? | Meetings | Meetings | **Domain** contains **This page** | Date descending | Name, Date, Area | core |
| What do we know? | Documents | Documents | **Domain** contains **This page** | Last edited time descending | Name, Origin, Area | Documents |

Then a toggle **My notes**. **Domain** here is the rollup on each database, not Areas · Domain. *This page* appears in the filter's value menu only while you edit a page template.

A row is on a Domain page when its Area has that Domain. A row with no Area, or whose Area has no Domain, is on none: a meeting or Document gets its Area from its projects at the ingest, when they share one (decision 0105 §2). A Domain page made before the template changed keeps its old body: apply the template from the page, or add the three views by hand.

---

## 10. Navigation (instead of Prompt 8)

1. **On the "System" page,** create a synced block named "Tier 1 nav": one line of links, Home · Tasks · Meetings · Projects · Plan · Knowledge · Archive · How it works, unthemed (Tasks with the Tasks module, Plan with Planning). For questions, use Brain Assistant ([brain-assistant.md](brain-assistant.md)).
2. **Still on "System",** create one synced block per Space, "Tier 2 nav – Plan" and so on. Each lists that Space's view names as links (right-click a view tab → *Copy link to view*), with its own icon and a light background color.
3. **On each Space page,** add a narrow left column containing: Tier 1 nav, a divider, then that Space's Tier 2 nav. Home gets only Tier 1.
4. **Above each page title,** add a small gray text label with the page name. It's a plain block, not synced.

**Check:** edit Tier 1 on System, and the change appears everywhere.

---

## 11. Done checklist

- [ ] Every Space holds only linked views (plus the buttons on Home); no database lives outside Brain Data.
- [ ] Home "Which minutes need review?" leaves out meetings dated after today.
- [ ] Tasks has the statuses Waiting On and Someday, and the Done tab groups by week.
- [ ] Archive is on System and linked from the navigation; "What's finished?" is no longer in Projects.
- [ ] View names match this guide exactly, question marks included.
- [ ] Home has no Review list, and no page or view shows a Review, Decisions or Questions database; Tasks has the tabs Questions and Risks (Tasks module).
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status Ready; New meeting and New project open a page with the default template.
- [ ] (Tasks) New task, next to New project, opens a new Tasks row with Kind Task, the default Status and no project or due date.
- [ ] Brain ID and Last Synced are hidden in every view and page layout.
- [ ] A Domain made from the Domains template lists that Domain's projects, meetings and (Documents) documents, and no page or view shows a Domains · Type.
- [ ] Editing Tier 1 nav on System updates every Space.
