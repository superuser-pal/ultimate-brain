# Notion Space Design (v1)

**Status:** Proposed design, ready to build with Notion AI. Not built.
**Date:** 2026-10-11
**Built from:** [hub-and-spoke pattern](notion-space-architecture.md), [Easlo vs Ultimate Brain comparison](notion-second-brain-template-comparison.md), [Easlo appendix](easlo-second-brain-factual-architecture-appendix.md), [Ultimate Brain appendix](ultimate-brain-for-notion-factual-architecture-appendix.md), [synthesis](../synthesis/synthesis.md), decisions 0003, 0005, 0007, 0011, 0012, 0015, 0018–0021.

---

## 1. What this space is for

Notion is the **human side** of the brain. You use it to:

1. **Review meeting minutes** and mark them ready for the brain.
2. **Decide** on what the agents propose (the Review queue).
3. **Plan**: areas, goals, key results, projects.
4. **Navigate** what the brain knows: projects, people, clients, decisions, open questions.
5. **Capture** quick thoughts and create new projects, goals, people.

The Markdown brain stays canonical (vision). Notion shows curated knowledge, collects your decisions, and owns operational fields (status, progress, dates).

### What we borrow from each template

| From | Pattern | Where it shows up |
|---|---|---|
| Easlo | Dedicated meeting records with action items | Meetings database and its template |
| Easlo | Separate record types for separate concepts (no "everything is a note") | One database per brain note type |
| Easlo | Goals + Key Results (numeric) | Goals, Key Results |
| Easlo | Entity pages as contextual workspaces | Templates for Project, Goal, Area, Person, Org, Meeting |
| Ultimate Brain | Milestones as tick-off steps | `Kind = Milestone` in Key Results |
| Ultimate Brain | Focused dashboards (My Day, Process, Project Hub) | Spaces with views named by the question they answer |
| Ultimate Brain | Low-friction capture, classify later | Capture Inbox + quick-capture button on Home |
| Ultimate Brain | Cold items leave active views for review | "Gone quiet" views for projects and open questions |
| Easlo | Blocks whose tabs follow a record's life (now → later → done) | Every Space (§5) and template (§4) |
| Easlo | Time-first views: today, upcoming, calendar, deadlines | Home, Tasks, Meetings, Projects |
| Easlo | Each related database repeated on every parent page, filtered to it | Templates for Area, Project, Goal, Person, Org (§4) |
| Easlo | Home led by your own work | Home "What's on today?" (§5) |
| Easlo | Countdown and task progress formulas | Goals and Projects (§3.2, §3.4) |
| Easlo | GTD task states (Waiting On, Someday) and a logbook | Tasks Space (Notion-only, §3.12) |
| Easlo | One Archive page for every database | Archive, under System (§5) |
| Your pattern | Hub-and-spoke, backend data page, synced two-tier nav | Whole layout (§5) |

### What we deliberately leave out

Task engine features (recurrence, contexts, energy, snooze), Topics/Notebooks/Highlights, books/recipes/journal subsystems, a universal Notes database, formula-heavy logic. A Notes database would split your knowledge in two: notes typed there never reach the brain, so quick notes go to the Capture Inbox and page notes to "My notes". Tasks stay in your existing database (0018); the Waiting On and Someday states are Notion-only and the brain never reads them.

---

## 2. Ownership rules (how Notion and the brain share each record)

Every database that mirrors a brain note has three kinds of properties. Each property's **description** in Notion starts with its owner, so it's visible on hover.

| Owner | Meaning | Examples | Flows |
|---|---|---|---|
| **Brain** | Knowledge the brain maintains | Summary, Role, Client, Deadline, Assessment, Supersedes | Brain → Notion. Your edits in Notion are applied as your corrections on the next sync (0023, 0027; §8) |
| **You** | Operational fields | Status, Priority, Progress, Lifecycle, Archived, Brain status | Notion → brain as pointers; the brain never writes them |
| **System** | Bridge plumbing | Brain ID, Last synced, Created time, Last edited time | Brain → Notion only (the two timestamps are filled by Notion itself). Never edit |

**Creation:** new rows you create in Areas, Goals, Projects, People, Orgs are imported by the next `brain sync` (0021). Rows in Decisions, Questions and Review are created by the brain only.

**Page bodies (0026):** the brain writes only inside named toggle headings: "Brief" and "Decision log" on project pages. It owns the whole body of Decisions and Questions pages, publishes no body for Areas, Goals, People and Orgs, and never edits Meetings (0007). Everything else on a page is yours, including the **"My notes"** toggle.

---

## 3. Databases

Twelve databases, all on the backend page **Brain Data**. Naming: plural Title Case database names, Title Case property names, no emoji in property names (the agent addresses them by name through the Notion MCP).

**Common properties** on every brain-mirrored database (Areas, Goals, Projects, People, Orgs, Decisions, Questions):

| Property | Type | Owner | Notes |
|---|---|---|---|
| Name | Title | Brain (you on creation) | |
| Summary | Text | Brain | ≤200 chars, from the note's `summary:` |
| Lifecycle | Select: Draft, Reviewed, Disputed, Archived | You | 0005. New brain records arrive as Draft |
| Brain ID | Text | System | e.g. `prj-9x4t1b7e` (0017). Empty = not imported yet |
| Last Synced | Date (with time) | System | |

### 3.1 Areas
Ongoing responsibilities (clients, health, learning…).

| Property | Type | Owner |
|---|---|---|
| Type | Select: Business, Personal | You |
| Goals | Relation → Goals | You |
| Projects | Relation → Projects | You |
| Meetings | Relation → Meetings (two-way with Area) | Brain |
| Tasks | Relation → Tasks (two-way with Area) | You |
| Archived | Checkbox | You |
| People via projects | Rollup: Projects → People, show original | You (derived, Notion-only) |
| Clients via projects | Rollup: Projects → Client, show original | You (derived, Notion-only) |
| Decisions via projects | Rollup: Projects → Decisions, show original | You (derived, Notion-only; until 0034 ships) |
| Questions via projects | Rollup: Projects → Questions, show original | You (derived, Notion-only; until 0034 ships) |

### 3.2 Goals
| Property | Type | Owner |
|---|---|---|
| Why | Text | Brain |
| Deadline | Date | Brain (history kept in the brain's timeline) |
| Status | Select: Not Started, Active, Achieved, Dropped | You |
| Area | Relation → Areas | You on creation, then Brain |
| Key Results | Relation → Key Results | You |
| Projects | Relation → Projects | You |
| Progress | Rollup: Key Results → Progress, average, shown as % | You (derived) |
| Countdown | Formula: "12 days left", "Overdue", or empty when there is no Deadline or Status is Achieved or Dropped | You (derived, Notion-only) |
| Archived | Checkbox | You |

### 3.3 Key Results
Notion-owned entirely (0020). Not mirrored as brain notes; the brain snapshots them into the goal.

| Property | Type | Notes |
|---|---|---|
| Name | Title | "Monthly revenue", "Publish service page" |
| Goal | Relation → Goals | |
| Kind | Select: Number, Milestone | |
| Start | Number | Number only |
| Current | Number | Number only |
| Target | Number | Number only |
| Unit | Text | "€", "clients" |
| Done | Checkbox | Milestone only |
| Progress | Formula (0–1, %) | Number: `(Current − Start) / (Target − Start)`, clamped 0–1. Milestone: 1 if Done else 0 |
| Due | Date | Optional |

### 3.4 Projects
| Property | Type | Owner |
|---|---|---|
| Status | Select: Planned, Active, On Hold, Done | You |
| Priority | Select: High, Medium, Low | You |
| Dates | Date (range) | You |
| Area | Relation → Areas | You on creation, then Brain |
| Goal | Relation → Goals | You on creation, then Brain |
| Client | Relation → Orgs | Brain |
| People | Relation → People | Brain |
| Meetings | Relation → Meetings | Brain |
| Decisions | Relation → Decisions | Brain |
| Questions | Relation → Questions | Brain |
| Tasks | Relation → Tasks (two-way with Project) | You |
| Key Facts | Text | Brain: current key facts, e.g. "Budget: 80000 EUR · Launch date: 2027-02" (format in spec/cli.md §5.14.4) |
| Archived | Checkbox | You |
| Countdown | Formula: days to the end of Dates ("23 days left", "Overdue"); empty when Dates is empty or Status is Done | You (derived, Notion-only) |
| Task Progress | Rollup: Tasks → Status, percent per group Complete, shown as % | You (derived, Notion-only) |
| Last edited time | Last edited time | System (Notion fills it; "gone quiet" view) |

Page body: toggle headings **Brief** and **Decision log** (brain-written, 0026), then the template's linked views and "My notes".

### 3.5 Meetings
The inbound source. Your Notion AI meeting notes live here (0012, 0007).

| Property | Type | Owner |
|---|---|---|
| Name | Title | You |
| Date | Date | You |
| Attendees | Relation → People | You (brain fills missing ones) |
| Project | Relation → Projects | You (brain fills if empty) |
| Area | Relation → Areas | You (brain fills if empty) |
| Brain Status | Select: Not Reviewed, Reviewed, Ingested, Skipped | You set Reviewed or Skipped; brain sets Ingested |
| Ingested At | Date | System |
| Decisions | Relation → Decisions | Brain |
| Questions | Relation → Questions | Brain |
| Tasks | Relation → Tasks (two-way with Meeting) | You |
| Review Items | Relation → Review (two-way with Source Meeting) | Brain |
| Brain ID | Text | System (the meeting record's id, `mtg-…`) |

The brain **never edits the meeting page body** (0007). Instead of publishing a second summary, it fills the relations (Decisions, Questions, People, Project) and links the created tasks. Your reviewed minutes stay the human summary; the brain's meeting note is for agents.

### 3.6 People
| Property | Type | Owner |
|---|---|---|
| Role | Text | Brain |
| Org | Relation → Orgs | Brain |
| Email | Email | You |
| Projects | Relation → Projects | Brain |
| Meetings | Relation → Meetings (two-way with Attendees) | Brain |

### 3.7 Orgs
Clients, partners, suppliers. One canonical entity database (your pattern's rule).

| Property | Type | Owner |
|---|---|---|
| Relationship | Select: Client, Prospect, Partner, Supplier, Other | You |
| People | Relation → People (two-way with Org) | Brain |
| Projects | Relation → Projects (two-way with Client) | Brain |
| Website | URL | You |
| Meetings via projects | Rollup: Projects → Meetings, show original | You (derived, Notion-only) |

### 3.8 Decisions
Created by the brain only.

| Property | Type | Owner |
|---|---|---|
| Date | Date | Brain |
| Assessment | Select: Accepted, Provisional, Contested, Superseded | Brain (0005) |
| Project | Relation → Projects | Brain |
| Decided In | Relation → Meetings | Brain |
| Supersedes | Relation → Decisions (self, two-way "Superseded By") | Brain |

Page body: context, decision, consequences, sources. `^[inferred]` statements shown with an "AI inference" label (0004).

### 3.9 Questions
Open questions and risks raised in meetings.

| Property | Type | Owner |
|---|---|---|
| Kind | Select: Question, Risk | Brain |
| Status | Select: Open, Answered, Dropped | You (brain may propose "Answered") |
| Project | Relation → Projects | Brain |
| Raised In | Relation → Meetings | Brain |
| Created time | Created time | System (Notion fills it; sorts open questions) |

### 3.10 Review
The approval queue (0003). Created by the brain; you decide.

| Property | Type | Owner |
|---|---|---|
| Name | Title | Brain: e.g. "Acme launch: Jan → Feb" |
| Kind | Select: Update Fact, Add To Note, Add Link, Supersede, Contradiction, Merge, New Item | Brain |
| Target | Text | Brain: note title + Brain ID |
| Target Page | URL | Brain: link to the Notion page affected |
| Before | Text | Brain |
| After | Text | Brain |
| Why | Text | Brain: the sentence from the source that triggered it |
| Source Meeting | Relation → Meetings | Brain |
| Decision | Select: Approve, Reject, Edit | **You** |
| Edited Value | Text | **You** (when Decision = Edit) |
| State | Select: Pending, Applied, Closed | System |
| Brain ID | Text | System (`prp-…`) |
| Created time | Created time | System (Notion fills it; sorts the queue) |
| Last edited time | Last edited time | System (Notion fills it; "approved recently" filter) |

### 3.11 Capture Inbox
Quick capture. Classified later by the brain (Ultimate Brain's "classify later").

| Property | Type | Owner |
|---|---|---|
| Name | Title | You |
| Brain Status | Select: New, Processed, Skipped | You set Skipped; brain sets Processed |
| Created | Created time | System |

### 3.12 Tasks (default, only if you have no tasks system)
Minimal, so the brain can send action items (0018). If you already have a tasks database, skip it and map yours in `brain.json`.

| Property | Type | Notes |
|---|---|---|
| Name | Title | |
| Status | Status: To Do, Doing, Waiting On, Someday, Done | The brain sets `new_task_status` on create and never reads it back. Waiting On and Someday sit in any group except Complete and are Notion-only |
| Due | Date | |
| Project | Relation → Projects | |
| Area | Relation → Areas | |
| Meeting | Relation → Meetings | The backlink for action items |
| Brain ID | Text | Set when the brain created it |
| Last edited time | Last edited time | System (Notion fills it; groups the Done tab by week) |

---

## 4. Templates (contextual workspaces, Easlo pattern)

Each template is the default for its database. Every linked view sits under an H3 heading named by the question it answers, with the database title hidden, and is filtered to "this page". Where a block has tabs, they follow the record's life (now → later → done). The table is the intent; [Prompt 6](../notion/prompts/06-templates.md) is the exact definition and wins where they differ. The live snapshot is [notion/templates.md](../notion/templates.md).

| Database | Template body |
|---|---|
| Areas | "What am I working toward here?" (Goals, Active) · "What's active here?" (Projects: Active, Planned, Done) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "My notes". Decisions, Questions, People and Clients show as the "via projects" rollups in the page header (0034 turns Decisions and Questions into views) |
| Goals | "How are the key results moving?" (Key Results: Open, Done) · "Which projects serve it?" (Projects) · "My notes" |
| Projects | A muted line "Brief and Decision log are written by the brain. Add your own notes in My notes." · "Brief" toggle heading (brain-written) · "Decision log" toggle heading (brain-written) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What's still open here?" (Questions, Open) · "Who's involved?" (People) · "My notes" |
| Meetings | Unchanged from the hand-reworked template (see notion/templates.md): "Before marking Reviewed" checklist callout · Notion AI meeting notes block · "My notes" · toggles Decisions, Questions, Tasks |
| People | "Which meetings were they in?" (Meetings: Upcoming, Past) · "What are they working on?" (Projects) · "My notes" |
| Orgs | "Who works there?" (People) · "Which projects?" (Projects) · "My notes". Meetings show as the "Meetings via projects" rollup in the page header |
| Decisions | (brain-generated body) · "Superseded by" callout when present |

No template uses a callout to show a property: a callout can't display one, and the page layout already shows it.

---

## 5. Layout (hub-and-spoke)

```text
Home                          ← hub: my day, quick capture, "needs you"
├── Tasks                     ← Space
├── Meetings                  ← Space
├── Projects                  ← Space
├── Plan                      ← Space
├── Review                    ← Space
├── Knowledge                 ← Space
└── (backend, never navigated)
    ├── Brain Data            ← all 12 databases
    └── System                ← synced nav, Archive
```

Each Space: the synced Spaces navigation in a narrow left column, then one tabs block whose tabs hold the linked views (Knowledge: one tab per database, each holding one linked view with several views). Views are named by the question they answer; tab labels are short. Each view shows what you need to act on from that view, usually 2–4 properties; everything else is on the page.

| Space | Job | Tabs (view) |
|---|---|---|
| **Home** | Start of day: your work first | Left: navigation, then "Needs you": "What needs my decision?" (Review, Pending) and "Which minutes need review?" (Meetings, Not Reviewed, held today or earlier), 5 rows each. Right: buttons Quick capture (→ Capture Inbox), New meeting, New project; then "What's on today?" with tabs Tasks (due today or overdue) · Meetings (today) · Projects (Active) |
| **Tasks** | Do the work | Today · Upcoming (by day) · No date · Waiting On · Someday · Done (by week) |
| **Meetings** | Prepare, review minutes, track ingestion | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Run projects | Active (board by Status) · By area · Deadlines (timeline) · Gone quiet |
| **Plan** | Areas → goals → key results → projects | Goals · Key results (by goal) · Areas (the way into each Area page) · Projects by goal |
| **Review** | Decide on proposals | Needs my decision · Sources disagree · Approved recently · Rejected |
| **Knowledge** | Navigate what the brain knows | Decisions (Recent, Current, Provisional, Superseded, Disputed) · Questions (Open questions, Open risks, Answered) · People (by org, Disputed) · Orgs (Clients, Others) · Inbox (Capture Inbox, New) |
| **Archive** (under System) | Find what's finished | One tab per database: Projects (Done or Archived) · Goals (Achieved, Dropped or Archived) · Areas · Decisions · Questions · People · Orgs (Archived) |

Every view, with its filters, sort and properties, is in [notion/views-guide.md](../notion/views-guide.md) and Prompts 7a–7h.

---

## 6. Notion AI build prompts

The prompts live in [notion/prompts/](../notion/prompts/), each with its **Verify** list. Run them in the order of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one per message, on a new empty teamspace page. They are written so Notion AI does not invent extra properties.

| # | Prompt | Builds |
|---|---|---|
| 1 | [Pages](../notion/prompts/01-pages.md) | the eight pages of §5 |
| 2 | [Databases](../notion/prompts/02-databases.md) | the 12 databases of §3, without relations |
| 3 | [Relations](../notion/prompts/03-relations.md) | the two-way relations of §3 |
| 4 | [Formula and rollup](../notion/prompts/04-formula-rollup.md) | Key Results and Goals Progress |
| 5 | [Ownership](../notion/prompts/05-ownership.md) | owner prefix in each property description (§2) |
| 6 | [Templates](../notion/prompts/06-templates.md) | the templates of §4 |
| 7 | [Spaces and views](../notion/prompts/07-spaces-views.md) | the views of §5, one prompt per Space, plus Tasks (7g) and Archive (7h) |
| 8 (optional) | [Navigation](../notion/prompts/08-navigation.md) | tier 1 and tier 2 synced navigation |

When this design changes, update the matching prompt file in the same change (decision 0022). Spaces that already exist get a migration in [notion/migrations/](../notion/migrations/), written by the `brain-notion-change` skill.

### After building
See "After building" in [notion/CHECKLIST.md](../notion/CHECKLIST.md): connect the brain to Notion, map your Tasks database (0018), verify the live space (0022).

---

## 7. `brain.json` Notion section (shape)

```json
{
  "notion": {
    "databases": {
      "areas": "<id>", "goals": "<id>", "key_results": "<id>", "projects": "<id>",
      "meetings": "<id>", "people": "<id>", "orgs": "<id>", "decisions": "<id>",
      "questions": "<id>", "review": "<id>", "capture_inbox": "<id>"
    },
    "tasks": {
      "database": "<id>",
      "properties": {
        "title": "Name", "status": "Status", "due": "Due",
        "project": "Project", "area": "Area", "meeting": "Meeting", "brain_id": "Brain ID"
      },
      "new_task_status": "To Do"
    }
  }
}
```

---

## 8. Resolved questions

1. **Editing a brain-owned property in Notion:** applied as your correction on the next sync (0023). Key facts get a timeline entry; Name, Summary, Why and relations are replaced in place; Assessment, Supersedes and similar judgments go through a Review proposal instead (0027).
2. **Meeting notes location:** they were loose pages. The Meetings database is their home from now on; move only recent meetings you still care about (last 1–2 months) and mark them Reviewed (0024).
3. **Plan tier:** nothing here needs Notion Business. Revisit only for external sharing.

## 9. Minutes format prompt (for the Meetings template)

The text lives in [notion/minutes-format.md](../notion/minutes-format.md). It gives every summary the same sections (Attendees, Decisions, Action items, Facts & numbers, Open questions, Risks, Summary), and consistent minutes make the ingest more accurate (0024). Paste it into Notion AI when you ask it to summarise a meeting, or use it to check minutes against the "Minutes follow the format" item of the checklist. The Meetings template (reworked by hand on 2026-10-13) no longer holds it in a callout; on 2026-10-14 we chose to keep that template as it is.
