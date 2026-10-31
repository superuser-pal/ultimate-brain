# Spaces, views and page layouts: manual build guide

A by-hand alternative to [Prompt 7](prompts/07-spaces-views.md) and [Prompt 8](prompts/08-navigation.md). Every view is spelled out: database, layout, filters, sort, grouping, visible properties and what it is for. You can build it in Notion yourself at your own pace, one Space at a time.

It is derived from [docs/notion-space-design.md](../docs/notion-space-design.md) §3–§5. If the two ever disagree, the design document wins (decision 0022).

**Before you start:** Prompts 1–6 are done. The databases of Core and your modules live on **Brain Data**, the relations exist, the formulas and rollups of Prompt 4 exist (Progress, Countdown, Task Progress, Type, the Areas counts, the "via projects" rollups), and the templates are the database defaults.

**Modules** (decision 0048). A view, tab, column or button of a module you left off is skipped: the Tasks Space needs Tasks, Plan needs Planning, and each row below names its module when it has one (*(Knowledge)*, *(Documents)* …). A column of a module you left off is simply not shown.

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

Nothing sits above the two columns (#143, decision 0053).
**Left column:** navigation, then a small heading "Needs you" with two short lists (views 1–2).
**Right column:** the buttons in a row, then "What's on today?" as a tabs block (views 0, 0b, 3–5, 5b), then "What did the brain take in?" as a second tabs block (views 6–7).

| # | Tab | View name | Database | Layout | Filter | Sort | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 0 | Areas | How are my areas? | Areas | List | Archived is unchecked | Name | Name, At a glance | Your areas, each line readable on its own: "Day job · 3 to review · 1 meeting", or "all clear" (#145). Open one for its home (0050). The first tab |
| 0b | Areas | What's due across areas? *(Tasks)* | Tasks | List, 5 rows | Status is not Done · Due is on or before today | Due, ascending | Name, Area, Due | Due today or overdue, in every area |
| 1 | — | What's waiting for you? | Review | List, grouped by Type (counts shown), 5 rows per group | State is Pending | Created time, descending | Name, About Page | Where reviewing starts (0045): one Review Notes row per meeting or document, plus the other changes. On a Review Notes row, About Page opens the meeting or Inbox row it came from; on the others, the note it changes; click a row to decide it in the Review Space |
| 2 | — | Which minutes need review? | Meetings | List, 5 rows | Brain Status is Not Reviewed · Date is on or before today | Date, descending | Name | Minutes to check before the brain may ingest them. Upcoming meetings stay out |
| 3 | Tasks *(Tasks)* | What's due today? | Tasks | List | Status is To Do or Doing · Due is on or before today | Due, ascending | Name, Project, Due | Today's work, overdue first |
| 4 | Meetings | Which meetings are today? | Meetings | List | Date is today | Date, ascending | Name, Date, Project | Today's meetings, with time and project |
| 5 | Projects | What's active? | Projects | Gallery (small cards) | Status is Active · Archived is unchecked | Priority (High→Low), then Name | Name, Countdown, *(Orgs)* Client, *(Tasks)* Task Progress | What you're working on, and how far along each is |
| 5b | Inbox | What's in my inbox? | Inbox | List | Brain Status is New or Ready | Created, ascending | Name, Kind, Brain Status | Rows waiting for the brain, oldest first: set one Ready when it can be taken in. The last tab; the buttons and the boxes they tick are on each row's page (#146) |
| 6 | Came in | What came in lately? | Inbox | List, 10 rows | Brain Status is Done | Created, descending | Name, Kind, Project | The Brain feed (0043): every document, email, capture and report the brain took in, newest first |
| 7 | Meetings | Which meetings did it take in? | Meetings | List, 10 rows | Brain Status is Ingested | Ingested At, descending | Name, Date, Project | The meetings the brain ingested, newest first. Together with view 6, everything the brain did |

**Buttons** (`/button`, each with *Open page after creation* on):

| Button | Action |
|---|---|
| Quick capture | Add page to *Inbox*, Kind = Capture, Brain Status = **Ready**: the next catch-up takes it in (0048) |
| Ask the brain *(Reports)* | Add page to *Inbox*, Kind = Ask, Brain Status = New. Type your question as the Name; the next catch-up answers it with a Report row (0043) |
| New meeting | Add page to *Meetings*, Date = today. The default template applies |
| New project | Add page to *Projects*, Status = Planned. The default template applies |

---

## 2. Tasks (do the work) *(Tasks)*

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
| 4 | Ingested | What did the brain take in this week? | Table | Brain Status is Ingested · Ingested At is within *Past week* (relative) | Ingested At, descending | — | Name, Ingested At, *(Knowledge)* Decisions, Questions | What each ingest produced |
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
| 3 | Areas | Which areas do I own? | Gallery (small cards) | Archived is unchecked | Type, then Name | — | Name, Type | Open an area to see its goals, projects, tasks, meetings, decisions and people |
| 4 | Projects by goal | Which projects serve each goal? | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Goal (show "No goal") | Name, Status | Spot projects with no goal, and goals with no project |

**Progress as a bar:** click Progress → *Show as* → **Bar**, color green, show the number.

---

## 6. Review (decide on proposals)

**Job:** approve, reject or fix every change the brain proposes to your existing knowledge (decision 0003), and accept the notes each ingest made (Review Notes rows, 0041).

Above the tabs, a gray line: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. To correct something, pick Fix in Your call and say what's wrong in What to fix." (0043, 0045). A decided row leaves Review 30 days after the decision: the catch-up moves it to Notion's trash, and the brain keeps it in Git. On a **Review Notes** row, Proposed lists everything the source brings, lettered a), b)…: fact changes first (⚠), then text added to notes, then new notes, then links. Approve accepts them all; Approve with "all except b, d" in What to fix moves those to a row of their own that waits for you; Fix with "a: March" applies it, corrected; Reject archives the new notes and drops the changes. On an **Answer** row, Approve marks the question Answered.

| # | Tab | View name | Layout | Filter | Sort | Show | Use case |
|---|---|---|---|---|---|---|---|
| 1 | Needs my decision | What needs my decision? | Table | State is Pending | Created time, descending | Name, Type, Now, Proposed, Your call, What to fix | Your main queue. Set Your call here, and What to fix when you want something different: with Fix, what's wrong ("a: March"); with Approve, what to leave out ("all except b, d"), which moves to a row of its own. To see Why or the source, open the row |
| 2 | Sources disagree | Where do sources disagree? | Table | Kind is Contradiction · State is Pending | Created time, ascending | Name, Now, Proposed, Your call | Approve keeps both claims as contested. Fix, with the true value in What to fix, sets it |
| 3 | Approved | What did I approve recently? | List | State is Applied · Last edited time is within *Past month* (relative) | Last edited time, descending | Name, Type, Proposed | Audit trail of what changed |
| 4 | Rejected | What did I reject? | List | State is Closed | Last edited time, descending | Name, Type | Rejected or stale proposals. The brain may propose one again on the next ingest |

**Three kinds of row** (0048): the **Type** column says From source (everything one input brings, lettered), Conflict (sources disagree, a newer decision replaces an older one, or a possible duplicate) or Answer; the Name starts the same way. Kind stays on the row for the brain and for the table below; hide it in every view.

**How to decide:**

| Kind | Approve means | Fix means (0045) |
|---|---|---|
| Review Notes | Every item is applied: fact changes, added text, the new notes become Reviewed, the links are added | Each item you name is applied as you corrected it ("a: March"); "all except b" moves b to a row of its own |
| Update Fact | The new value replaces the old one; history is kept | Your value is used instead |
| Add To Note | The text is appended to the note | Your wording is used instead |
| Update Body | The Document gets the new text | Your corrected text is used instead |
| Contradiction | Both claims are kept as contested | Your value becomes the accepted truth |
| Supersede | The newer note replaces the older one, which is archived | It replaces the note you name instead |
| Merge | The duplicate is folded into the survivor | It is folded into the record you name instead |
| New Item | The new note is created as Draft | It is created with your corrections |
| Answer | The question gets this answer and shows as Answered | Your text becomes the answer |

---

## 7. Knowledge (what the brain knows)

**Job:** find decisions, open questions, what the brain learned, people and organisations, and everything that came in, in Easlo's Notes Dashboard pattern: one tab per database, and inside each tab one linked view with several views (Recent, Current, History).

| Tab | View name | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|
| Decisions *(Knowledge)* | What did we decide recently? | List | Date is within *Past week* (relative) | Date, descending | — | Name, Project, Date | This week's decisions |
| Decisions *(Knowledge)* | What did we decide? | Table | Assessment is Accepted · Lifecycle is not Archived | Date, descending | — | Name, Project, Date, Summary | Current decisions. Answers "why did we choose X?" |
| Decisions *(Knowledge)* | What's provisional? | List | Assessment is Provisional | Date, descending | — | Name, Project, Date | Mentioned once, not yet confirmed. Confirm them in the next meeting |
| Decisions *(Knowledge)* | What changed our minds? | Table | Assessment is Superseded | Date, descending | — | Name, Superseded By, Date | Replaced decisions and what replaced them |
| Decisions *(Knowledge)* | What's disputed? | List | Lifecycle is Disputed | Date, descending | — | Name, Summary | Records you marked as wrong. Fix them or ask the brain to |
| Questions *(Knowledge)* | What's still open? | List | Status is Open · Kind is Question | Created time, descending | — | Name, Project, Raised In | Open questions. Set Answered or Dropped when resolved |
| Questions *(Knowledge)* | Which risks are open? | List | Status is Open · Kind is Risk | Created time, descending | — | Name, Project, Raised In | Open risks |
| Questions *(Knowledge)* | What did we answer? | List | Status is Answered | Created time, descending | — | Name, Project, Summary | Resolved questions and their answer |
| Concepts *(Knowledge)* | What did we learn recently? | List | Lifecycle is not Archived | Created time, descending | — | Name, Project, Summary | Ideas and methods from your documents and meetings |
| Concepts *(Knowledge)* | What do we know per project? | Table | Lifecycle is not Archived | Name | Project | Name, Area, Summary | What the brain learned, by project |
| Concepts *(Knowledge)* | Which concepts are drafts? | List | Lifecycle is Draft | Created time, descending | — | Name, Project | New concepts to read and mark Reviewed |
| Documents *(Documents)* | What did we keep? | List | Lifecycle is not Archived | Last edited time, descending | — | Name, Project, Summary | Documents (0049): whole inputs, the parts you asked for (requirements, price lists), and pages promoted from decisions and concepts, kept up to date as new versions arrive |
| People | Who's who? | Gallery (small cards) | Lifecycle is not Archived | Name | *(Orgs)* Org | Name, Role, *(Orgs)* Org | Find a person by company and role |
| People | Who's disputed? | List | Lifecycle is Disputed | Name | — | Name, Summary | People records you marked as wrong |
| Orgs *(Orgs)* | Which clients do I have? | Table | Relationship is Client · Lifecycle is not Archived | Name | — | Name, People, Projects | Your clients with their contacts and projects |
| Orgs *(Orgs)* | Who else do we work with? | Table | Relationship is not Client · Lifecycle is not Archived | Name | Relationship | Name, Relationship, People | Prospects, partners and suppliers |
| Inbox | What came in? | Table | Brain Status is Done | Created, descending | — | Name, Kind, Summary, Project, *(Knowledge)* Decisions, Concepts | History: every document, email and capture the brain took in, and what it made from each |

There is no Notes database on purpose: notes typed there would never reach the brain. Quick notes go to the Inbox, and notes about a record go in its "My notes" toggle.

---

## 8. Archive (under System)

**Job:** find what's finished without cluttering the Spaces. A page named "Archive" on System, linked from the navigation, with one tab per database.

| Tab | View name | Database | Layout | Filter | Sort | Show |
|---|---|---|---|---|---|---|
| Projects | What's finished? | Projects | Table | Status is Done **or** Archived is checked (filter group joined with Or) | Dates (end), descending | Name, Dates, Status |
| Goals *(Planning)* | Which goals are closed? | Goals | Table | Status is Achieved or Dropped, **or** Archived is checked | Deadline, descending | Name, Status, Deadline |
| Areas | Which areas did I close? | Areas | List | Archived is checked | Name | Name, Type |
| Decisions *(Knowledge)* | Which decisions are archived? | Decisions | List | Lifecycle is Archived | Date, descending | Name, Project, Date |
| Questions *(Knowledge)* | Which questions are archived? | Questions | List | Lifecycle is Archived | Created time, descending | Name, Project, Status |
| Concepts *(Knowledge)* | Which concepts are archived? | Concepts | List | Lifecycle is Archived | Name | Name, Project |
| Documents *(Documents)* | Which documents are archived? | Documents | List | Lifecycle is Archived | Name | Name, Project |
| People | Who is archived? | People | List | Lifecycle is Archived | Name | Name, Role |
| Orgs *(Orgs)* | Which orgs are archived? | Orgs | List | Lifecycle is Archived | Name | Name, Relationship |

---

## 9. Database page layouts

Notion lets you shape how each database page opens. Set it once per database: open any row as a full page → `•••` → **Customize layout**. It applies to every page of that database.

- **Heading:** the title plus pinned properties, left to right. Pin what *you* change; keep it to 2–4 so nothing falls into the side scroller.
- **Property group:** one per layout, placed in the **main** page area or the **details panel**. Pinned properties leave it.
- **Hidden:** shown only on *Show all properties*.
- **Backlinks:** *Show always*, *On hover* or *Off*.

**The rule** (decision 0048; docs/notion-space-design.md §3.15): what you act on is **pinned in the heading**; what the brain wrote comes next, in the property group; system fields (Brain ID, Last Synced, State, the Review Kind, timestamps) are **hidden**. Relations the template already shows as linked views (meetings, tasks, questions) stay in the panel, out of the way. A property of a module you left off isn't there: skip it.

**Buttons** (decision 0048) are properties too, so they go in the heading; the box each one ticks goes at the top of the property group (#144). The API can't create them; add each by hand: database `•••` → Properties → **New property** → **Button**, action **Edit property** on **This page**:

| Property name | Button label | Database | Action | Module |
|---|---|---|---|---|
| Keep | Keep as document | Inbox | Document asked → checked; Brain Status → Ready | Documents |
| Update | Refresh report | Inbox | Send message to Brain Assistant (0054; before 0.8.0: Refresh asked → checked). Refresh asked is now ticked by hand to queue a full refresh | Reports |
| Tidy | Tidy capture | Inbox | Send message to Brain Assistant | core |
| Write | Write up | Documents | Send message to Brain Assistant | Documents |
| Accept | Accept write-up | Documents | Accepted → checked; Accepted at → now | Documents |
| Accept | Accept refresh | Inbox | Accepted → checked; Accepted at → now (the brain acts on it only on a Report row) | Reports |
| Promote | Promote to document | Decisions, Concepts | Promote asked → checked | Documents (and Knowledge) |

The name and the label differ, so the layout doesn't show the same text twice (#144). The brain reads the boxes the checkbox buttons tick (and Accepted and Accepted at), never a button.

**The Brain Assistant buttons (decision 0054)** use the action **Send message to** → Brain Assistant. A button passes only its message, so each message names the skill, references the row with an @ mention of **This page**, carries your confirmation and says what not to touch (verified on a test row, docs/notion-space-design.md §3.16). Type `@` and pick the current page where `@This page` is shown below:

| Button | Message |
|---|---|
| Tidy capture | `Run your Tidy capture skill on this Inbox page: @This page. I confirm: replace the text below the title with the rewrite, as the skill says. Do not change the title, Brain Status or any property.` |
| Write up | `Run your Write up skill on this Documents page: @This page. I confirm: do it as the skill says. Do not change any property, the Decision or Concept page, or any other page.` |
| Refresh report | `Run your Refresh report skill on this Report row: @This page. I confirm: add or replace the Proposed refresh toggle as the skill says. Do not change the report's text outside it, or any property.` |

A message without the page reference makes Brain Assistant stop and say so. The two Accept buttons use **Edit property** on **This page**: Accepted → checked and Accepted at → Now.

| Database | Heading (in order) | Property group: where · order | Hidden | Backlinks | Why |
|---|---|---|---|---|---|
| Areas | Type, At a glance | Panel · To review, Meetings to review, Due, Summary, People via projects, Clients via projects, Goals, Projects, Meetings, Decisions, Questions, Concepts, Documents, Inbox, Tasks, Review, Lifecycle, Archived | Brain ID, Last Synced | Off | The area's home (0050): its counts as one line in the heading, everything else in its views |
| Goals | Status, Progress, Countdown | Panel · Deadline, Why, Area, Key Results, Projects, Summary, Lifecycle, Archived | Brain ID, Last Synced | Off | Progress and status at a glance |
| Key Results | Progress, Current, Target | Main · Goal, Kind, Start, Unit, Done, Due | — | Off | No body; you edit Current in the heading |
| Projects | Status, Priority, Countdown, Task Progress | Panel · Dates, Key Facts, Client, Area, Goal, People, Summary, Lifecycle, Archived, Meetings, Decisions, Questions, Concepts, Documents, Inbox, Tasks | Brain ID, Last Synced, Last edited time | Off | Body = Brief + Decision log toggles; Key Facts first in the panel |
| Meetings | Brain Status, Date, Project | Panel · Attendees, Area, Decisions, Questions, Tasks, Review Items | Brain ID, Ingested At | Off | Brain Status is the one field you change per meeting |
| People | Role, Org | Panel · Email, Projects, Meetings, Sources, Summary, Lifecycle | Brain ID, Last Synced | On hover | Who they are and where they work |
| Orgs | Relationship, Website | Panel · Meetings via projects, People, Projects, Summary, Lifecycle | Brain ID, Last Synced | On hover | — |
| Decisions | Promote, Lifecycle | Panel · Promote asked, Assessment, Date, Project, Area, Decided In, Supersedes, Superseded By, Sources, Documents, Summary | Brain ID, Last Synced | Show always | The body is brain-written; backlinks show supersede chains and mentions |
| Questions | Status, Kind, Project | Panel · Area, Raised In, Sources, Summary, Lifecycle | Brain ID, Last Synced, Created time | Off | You set Status |
| Review | Your call, What to fix, About Page | Main · Type, Now, Proposed, Why, About, Area, Source Meeting | Kind, State, Brain ID, Created time, Last edited time | Off | No body; read Now, Proposed and Why, then decide in the heading |
| Inbox | Keep, Update, Tidy, Accept, Brain Status, Project, Area | Main · Document asked, Refresh asked, Accepted, Accepted at, Only keep, Kind, Summary, What to fix, Decisions, Questions, Concepts, Documents, People, Tasks, Ask, Report | Brain ID, Last Synced, Created | Off | What came in, and what the brain made from it. The body is the brain's digest, and the "Full text" toggle when you chose it (0043) |
| Concepts | Promote, Lifecycle | Panel · Promote asked, Project, Area, Sources, Documents, Summary | Brain ID, Last Synced, Created time | Show always | The body is brain-written |
| Documents | Write, Accept, Lifecycle, Project, Area, Sources | Panel · Accepted, Accepted at, From decision, From concept, Summary | Brain ID, Last Synced, Created time, Last edited time | Show always | The body is brain-written, or yours on a promoted Document (0049) |
| Tasks | Status, Due | Panel · Project, Area, Meeting, Source | Brain ID, Last edited time | Off | Only if you use the default Tasks database |

**Hide system properties everywhere.** Brain ID, Last Synced, Created time and Last edited time are plumbing (owner "system"). Hide them in every view and layout, except where a view lists one to show (for example Last edited time in "Which projects have gone quiet?"). Don't delete them, because the brain matches records by Brain ID.

---

## 10. Navigation (instead of Prompt 8)

1. **On the "System" page,** create a synced block named "Tier 1 nav": one line of links, Home · Tasks · Meetings · Projects · Plan · Review · Knowledge · Archive · How it works, unthemed (Tasks with the Tasks module, Plan with Planning). For questions, use Brain Assistant ([brain-assistant.md](brain-assistant.md)).
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
- [ ] Home "What's waiting for you?" shows only Pending rows, grouped by Type with counts; Knowledge "What changed our minds?" shows only Superseded decisions.
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status Ready; New meeting and New project open a page with the default template.
- [ ] Brain ID and Last Synced are hidden in every view and page layout.
- [ ] Editing Tier 1 nav on System updates every Space.
