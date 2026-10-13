# Spaces, views and page layouts: manual build guide

A by-hand alternative to [Prompt 7](prompts/07-spaces-views.md) and [Prompt 8](prompts/08-navigation.md). Every view is spelled out: database, layout, filters, sort, grouping, visible properties and what it is for. You can build it in Notion yourself at your own pace, one Space at a time.

It is derived from [docs/notion-space-design.md](../docs/notion-space-design.md) §3–§5. If the two ever disagree, the design document wins (decision 0022).

**Before you start:** Prompts 1–6 are done. All 12 databases live on **Brain Data**, the relations exist, Progress is a percent formula on Key Results and a percent rollup on Goals, and the templates are the database defaults.

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

## 1. Home (start of day)

**Job:** see in ten seconds what needs you today.

| # | View name | Database | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | — (button) | Capture Inbox | Button "Quick capture" | — | — | — | — | One click to drop an idea, link or to-do into the inbox; the brain classifies it later |
| 2 | What needs my decision? | Review | List | State is Pending | Created time, descending | — | Name, Kind, Decision | Proposals waiting for approve, reject or edit. Clear this first |
| 3 | Which minutes need review? | Meetings | List | Brain Status is Not Reviewed | Date, descending | — | Name, Date, Project | Meetings whose AI minutes you still need to check before the brain may ingest them |
| 4 | What's active? | Projects | Gallery (small cards) | Status is Active · Archived is unchecked | Priority (High→Low), then Name | — | Name, Priority, Dates, Client | What you're working on now |

**Quick capture button:** `/button` → name it "Quick capture" → action **Add page to** → *Capture Inbox* → set **Brain Status** = New → turn on *Open page after creation*.

**Layout tip:** two columns. Put Quick capture and view 2 on the left, views 3 and 4 on the right. Set each list to show 5 rows (`•••` → *Load limit* → 10 or fewer).

---

## 2. Plan (areas → goals → key results → projects)

**Job:** check that what you do serves what you want.

| # | View name | Database | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | What am I working toward? | Goals | Gallery (medium cards) | Status is Active · Archived is unchecked | Deadline, ascending | — | Name, Progress (bar), Deadline, Area | Your active goals with progress. Glance at it weekly |
| 2 | How are my key results moving? | Key Results | Table | Goal → Status is Active (filter on the related goal; if your Notion can't filter through a relation, use Done is unchecked) | Due, ascending | Goal | Name, Kind, Current, Target, Unit, Progress, Due, Done | Update Current numbers and tick milestones. This is where you edit progress |
| 3 | Which areas do I own? | Areas | List | Archived is unchecked | Type, then Name | — | Name, Type, Summary | Your areas of responsibility, business and personal |
| 4 | Which projects serve each goal? | Projects | Board | Archived is unchecked · Status is not Done | Priority (High→Low) | Goal (show the empty group as "No goal") | Name, Status, Priority | Spot projects with no goal, and goals with no project |

**Progress as a bar:** in views 1 and 2, click Progress → *Show as* → **Bar**, color green, show the number.

---

## 3. Projects (run projects)

**Job:** keep each project moving, and notice the ones that stall.

| # | View name | Database | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | What's active? | Projects | Board | Archived is unchecked | Priority (High→Low) | Status (columns in order: Planned, Active, On Hold, Done; hide Done if it gets long) | Name, Priority, Dates, Client, Key Facts | Move projects between stages, drag and drop |
| 2 | What's due soon? | Projects | Timeline (by Dates) or Table | Status is Active or Planned · Archived is unchecked | Dates (end), ascending | — | Name, Dates, Priority, Status | Deadlines in order. Timeline shows overlap |
| 3 | Which projects have gone quiet? | Projects | Table | Status is Active · Last edited time is **before** *one month ago* (relative) | Last edited time, ascending | — | Name, Last edited time, Last Synced, Client | Active projects nobody has touched in 30 days. Restart, pause (On Hold) or close each one |
| 4 | What's finished? | Projects | Table | Status is Done **or** Archived is checked (use a filter group with "Or") | Dates (end), descending | — | Name, Dates, Client, Status | Your track record. Archive what you no longer need |

**Use case for Key Facts:** the brain keeps it current, e.g. "Budget: 80000 EUR · Launch date: 2027-02". Read it on the card instead of opening the page.

---

## 4. Meetings (review minutes, track ingestion)

**Job:** move each meeting from raw minutes → reviewed → ingested by the brain.

| # | View name | Database | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | Which minutes need review? | Meetings | Table | Brain Status is Not Reviewed | Date, descending | — | Name, Date, Attendees, Project, Brain Status | Check the minutes against the format and the checklist in the page, then set Brain Status to Reviewed (or Skipped) |
| 2 | What's waiting for the brain? | Meetings | List | Brain Status is Reviewed | Date, ascending | — | Name, Date, Project | Reviewed meetings the next ingest will take. If one sits here for days, run the ingest |
| 3 | What did the brain take in this week? | Meetings | Table | Brain Status is Ingested · Ingested At is within *Past week* (relative) | Ingested At, descending | — | Name, Date, Ingested At, Decisions, Questions | See what each ingest produced: decisions and questions linked back to the meeting |
| 4 | All meetings by project | Meetings | Table | — | Date, descending | Project (show "No project" group) | Name, Date, Brain Status, Attendees | History per project. The "No project" group shows meetings to link |
| 5 *(optional)* | Meeting calendar | Meetings | Calendar (by Date) | — | — | — | Name, Brain Status | Find a meeting by when it happened |

**The meeting flow, for reference:**
1. Notion AI writes the minutes using the Minutes format callout.
2. You tick the "Before marking Reviewed" checklist and set **Reviewed**.
3. The ingest sets **Ingested** and fills in Decisions, Questions and Attendees.
4. **Skipped** means the brain never reads that meeting.

---

## 5. Review (decide on proposals)

**Job:** approve, reject or edit every change the brain proposes to your existing knowledge (decision 0003).

| # | View name | Database | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | What needs my decision? | Review | Table | State is Pending | Created time, descending | — | Name, Kind, Before, After, Why, Source Meeting, Decision, Edited Value | Your main queue. Set Decision. For Edit, type the corrected value in Edited Value. The brain applies it on the next apply |
| 2 | Where do sources disagree? | Review | Table | Kind is Contradiction · State is Pending | Created time, ascending | — | Name, Before, After, Why, Source Meeting, Decision, Edited Value | Two sources disagree. Approve keeps both as contested. Edit sets the true value |
| 3 | What did I approve recently? | Review | List | State is Applied · Last edited time is within *Past month* (relative) | Last edited time, descending | — | Name, Kind, Decision, After | Audit trail of what changed |
| 4 | What did I reject? | Review | List | State is Closed | Last edited time, descending | — | Name, Kind, Decision, Why | Rejected or stale proposals. If you change your mind, the brain may propose it again on the next ingest |
| 5 *(optional)* | By kind | Review | Board | State is Pending | Created time, descending | Kind | Name, Before, After | Batch-decide similar proposals, e.g. all "New Item" at once |

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

## 6. Knowledge (what the brain knows)

**Job:** find decisions, open questions, people and clients.

| # | View name | Database | Layout | Filter | Sort | Group | Show | Use case |
|---|---|---|---|---|---|---|---|---|
| 1 | What did we decide? | Decisions | Table | Assessment is Accepted | Date, descending | — | Name, Date, Project, Decided In, Summary | Current decisions, newest first. Answers "why did we choose X?" |
| 2 | What changed our minds? | Decisions | Table | Assessment is Superseded | Date, descending | — | Name, Date, Superseded By, Project | Replaced decisions and what replaced them |
| 3 | What's still open? | Questions | Board | Status is Open | Created time, descending | Kind (Question / Risk) | Name, Project, Raised In | Open questions and risks. Set Answered or Dropped when resolved |
| 4 | Who's who? | People | Gallery (small cards) | Lifecycle is not Archived | Name | Org | Name, Role, Org, Email | Find a person by company and role |
| 5 | Which clients do I have? | Orgs | Table | Relationship is Client | Name | — | Name, Website, People, Projects | Your client list with its contacts and projects |
| 6 | What's in my inbox? | Capture Inbox | List | Brain Status is New | Created, descending | — | Name, Created | Unprocessed captures. Set Skipped for anything the brain shouldn't touch |
| 7 *(optional)* | What's provisional? | Decisions | List | Assessment is Provisional | Date, descending | — | Name, Date, Project | Decisions mentioned once and not yet confirmed. Confirm them in the next meeting |
| 8 *(optional)* | What's disputed? | (any brain database) | List | Lifecycle is Disputed | Last edited time, descending | — | Name, Summary | Records you marked as wrong. Fix them or ask the brain to |

---

## 7. Database page layouts

Notion lets you shape how each database page opens: which properties sit in the header, which are grouped in the side panel, and which are hidden. Set it once per database: open any row → `•••` → **Customize layout** (or *Customize page*).

- **Pinned:** in the header, under the title.
- **Panel:** in the side panel or the property list.
- **Hidden:** shown only on *Show all properties*.

| Database | Pinned | Panel | Hidden | Why |
|---|---|---|---|---|
| Areas | Type, Lifecycle | Summary, Goals, Projects, Archived | Brain ID, Last Synced | An area is mostly its links to goals and projects |
| Goals | Status, Progress, Deadline | Why, Area, Key Results, Projects, Summary, Lifecycle, Archived | Brain ID, Last Synced | Progress and status at a glance |
| Key Results | Progress, Done | Goal, Kind, Start, Current, Target, Unit, Due | — | You edit Current here |
| Projects | Status, Priority, Dates | Area, Goal, Client, People, Key Facts, Summary, Lifecycle, Archived, Meetings, Decisions, Questions | Brain ID, Last Synced | Body = Brief + Decision log toggles; the panel holds the context |
| Meetings | Date, Brain Status, Project | Attendees, Area, Decisions, Questions, Ingested At | Brain ID | Brain Status is the one field you change per meeting |
| People | Role, Org | Email, Projects, Meetings, Summary, Lifecycle | Brain ID, Last Synced | Who they are and where they work |
| Orgs | Relationship, Website | People, Projects, Summary, Lifecycle | Brain ID, Last Synced | — |
| Decisions | Assessment, Date | Project, Decided In, Supersedes, Superseded By, Summary, Lifecycle | Brain ID, Last Synced | The body is brain-written: context, decision, consequences, sources |
| Questions | Status, Kind | Project, Raised In, Summary, Lifecycle | Brain ID, Last Synced | You set Status |
| Review | Decision, State, Kind | Before, After, Edited Value, Why, Target, Target Page, Source Meeting | Brain ID | Decide without scrolling: Decision is in the header |
| Capture Inbox | Brain Status | Created | — | — |
| Tasks | Status, Due | Project, Area, Meeting | Brain ID | Only if you use the default Tasks database |

**Hide system properties everywhere.** Brain ID, Last Synced, Created time and Last edited time are plumbing (owner "system"). Hide them in every view and layout, except where a view lists one to show (for example Last edited time in "Which projects have gone quiet?"). Don't delete them, because the brain matches records by Brain ID.

---

## 8. Navigation (instead of Prompt 8)

1. **On the "System" page,** create a synced block named "Tier 1 nav": one line of links, Home · Plan · Projects · Meetings · Review · Knowledge, unthemed.
2. **Still on "System",** create one synced block per Space, "Tier 2 nav – Plan" and so on. Each lists that Space's view names as links (right-click a view tab → *Copy link to view*), with its own icon and a light background color.
3. **On each Space page,** add a narrow left column containing: Tier 1 nav, a divider, then that Space's Tier 2 nav. Home gets only Tier 1.
4. **Above each page title,** add a small gray text label with the page name. It's a plain block, not synced.

**Check:** edit Tier 1 on System, and the change appears everywhere.

---

## 9. Done checklist

- [ ] Every Space holds only linked views (plus Quick capture on Home); no database lives outside Brain Data.
- [ ] View names match this guide exactly, question marks included.
- [ ] Home "What needs my decision?" shows only Pending rows; Knowledge "What changed our minds?" shows only Superseded decisions.
- [ ] Quick capture creates a Capture Inbox row with Brain Status New.
- [ ] Brain ID and Last Synced are hidden in every view and page layout.
- [ ] Editing Tier 1 nav on System updates every Space.
