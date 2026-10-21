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
| Ultimate Brain | Low-friction capture, classify later | Inbox + quick-capture button on Home |
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

Task engine features (recurrence, contexts, energy, snooze), Topics/Notebooks/Highlights, books/recipes/journal subsystems, a universal Notes database, formula-heavy logic. A Notes database would split your knowledge in two: notes typed there never reach the brain, so quick notes go to the Inbox and page notes to "My notes". Tasks stay in your existing database (0018); the Waiting On and Someday states are Notion-only and the brain never reads them.

---

## 2. Ownership rules (how Notion and the brain share each record)

Every database that mirrors a brain note has three kinds of properties. Each property's **description** in Notion starts with its owner, so it's visible on hover.

| Owner | Meaning | Examples | Flows |
|---|---|---|---|
| **Brain** | Knowledge the brain maintains | Summary, Role, Client, Deadline, Assessment, Supersedes | Brain → Notion. Your edits in Notion are applied as your corrections on the next sync (0023, 0027; §8) |
| **You** | Operational fields | Status, Priority, Progress, Lifecycle, Archived, Brain status | Notion → brain as pointers; the brain never writes them |
| **System** | Bridge plumbing | Brain ID, Last synced, Created time, Last edited time | Brain → Notion only (the two timestamps are filled by Notion itself). Never edit |

**Creation:** new rows you create in Areas, Goals, Projects, People, Orgs are imported by the next `brain sync` (0021). Rows in Decisions, Questions, Concepts and Review are created by the brain only. Inbox rows come from you (Quick capture) or from the brain (every document, email, chat or note it ingests, 0037).

**Page bodies (0026, 0041, 0043):** the brain writes only inside named toggle headings: "Brief" and "Decision log" on project pages, "Brief" on area pages. It owns the whole body of Decisions, Questions and Concepts pages and of the Inbox rows it creates (a digest of what came in, a "Full text" toggle when you choose it, and the report on a Report row). It publishes no body for Goals, People and Orgs, and never edits Meetings (0007), a capture you wrote or an Ask row. Everything else on a page is yours, including the **"My notes"** toggle.

---

## 3. Databases

Thirteen databases, all on the backend page **Brain Data**. Naming: plural Title Case database names, Title Case property names, no emoji in property names (the agent addresses them by name through the Notion MCP).

**Common properties** on every brain-mirrored database (Areas, Goals, Projects, People, Orgs, Decisions, Questions, Concepts):

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
| Decisions | Relation → Decisions (two-way with Area) | Brain (0034) |
| Questions | Relation → Questions (two-way with Area) | Brain (0034) |
| Concepts | Relation → Concepts (two-way with Area) | Brain |
| Inbox | Relation → Inbox (two-way with Area) | You (brain fills if empty) |
| Tasks | Relation → Tasks (two-way with Area) | You |
| Archived | Checkbox | You |
| People via projects | Rollup: Projects → People, show original | You (derived, Notion-only) |
| Clients via projects | Rollup: Projects → Client, show original | You (derived, Notion-only) |

Page body: a toggle heading **Brief** (brain-written, 0041: the area's projects, reviewed decisions and open questions), then the template's linked views and "My notes". The publish appends the toggle at the end of a page that has none; drag it to the top once.

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
| Concepts | Relation → Concepts (two-way with Project) | Brain |
| Inbox | Relation → Inbox (two-way with Project) | You (brain fills if empty) |
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
| Sources | Relation → Inbox (two-way with People) | Brain (filled from the Inbox side) |

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
| Area | Relation → Areas (two-way with Decisions) | Brain: the areas of its projects, never typed (0034) |
| Decided In | Relation → Meetings | Brain |
| Supersedes | Relation → Decisions (self, two-way "Superseded By") | Brain |
| Sources | Relation → Inbox (two-way with Decisions) | Brain (filled from the Inbox side) |

Page body: context, decision, consequences, sources. `^[inferred]` statements shown with an "AI inference" label (0004).

### 3.9 Questions
Open questions and risks raised in meetings.

| Property | Type | Owner |
|---|---|---|
| Kind | Select: Question, Risk | Brain |
| Status | Select: Open, Answered, Dropped | You. The brain sets Answered once, after you approve an Answer row in Review (0041) |
| Project | Relation → Projects | Brain |
| Area | Relation → Areas (two-way with Questions) | Brain: the areas of its projects (0034) |
| Raised In | Relation → Meetings | Brain |
| Sources | Relation → Inbox (two-way with Questions) | Brain (filled from the Inbox side) |
| Created time | Created time | System (Notion fills it; sorts open questions) |

### 3.10 Review
The approval queue (0003). Created by the brain; you decide.

| Property | Type | Owner |
|---|---|---|
| Name | Title | Brain: e.g. "Acme launch: Jan → Feb" |
| Kind | Select: Update Fact, Add To Note, Add Link, Supersede, Contradiction, Merge, New Item, Review Notes, Answer | Brain. **Review Notes** (0041, 0043): one row per ingest, its new notes and links lettered a), b)…; Approve accepts them, "all except b, d" in Note keeps those out, Reject archives the new notes. **Answer**: an answer to an open question |
| Target | Text | Brain: note title + Brain ID (for Review Notes, the meeting or source). Says what changes; your corrections go in Note |
| Target Page | URL | Brain: link to the Notion page affected |
| Before | Text | Brain |
| After | Text | Brain |
| Why | Text | Brain: the sentence from the source that triggered it |
| Source Meeting | Relation → Meetings | Brain |
| Decision | Select: Approve, Reject, Edit | **You** |
| Note | Text | **You**: with Edit, the value to use; with Approve or Reject, what to do differently ("all except Ana"). The brain reads it and never applies a different change silently (0037) |
| State | Select: Pending, Applied, Closed | System |
| Brain ID | Text | System (`prp-…`) |
| Created time | Created time | System (Notion fills it; sorts the queue) |
| Last edited time | Last edited time | System (Notion fills it; "approved recently" filter) |

### 3.11 Inbox
Everything that came into the brain except meetings, which have their own database (0037). It replaces the Capture Inbox (same database, renamed). Your quick captures land here as **New**; every document, email, chat or note the brain ingests gets a row, created as **Processed**, so **History** shows what came in and what the brain learned from it.

| Property | Type | Owner |
|---|---|---|
| Name | Title | You on a capture; Brain on a row it creates |
| Kind | Select: Capture, Document, Email, Chat, Note, Ask, Report | System; **Ask** is yours: a question for the brain (0043) |
| Summary | Text | Brain: one line on what it taught |
| Decisions | Relation → Decisions (two-way with Sources) | Brain |
| Questions | Relation → Questions (two-way with Sources) | Brain |
| Concepts | Relation → Concepts (two-way with Sources) | Brain |
| People | Relation → People (two-way with Sources) | Brain |
| Project | Relation → Projects (two-way with Inbox) | You: set it on a capture and the ingest uses it without asking (brain fills if empty) |
| Area | Relation → Areas (two-way with Inbox) | You (brain fills if empty) |
| Brain Status | Select: New, Processed, Skipped | You set Skipped; brain sets Processed |
| Full text | Checkbox | You: tick it to have the document's text on the row; the brain writes it on the next catch-up and clears the box (0043) |
| Report | Relation → Inbox (two-way with Ask) | Brain: on an Ask row, the report that answers it |
| Ask | Relation → Inbox (two-way with Report) | Brain: on a Report row, the question it answers |
| Tasks | Relation → Tasks (two-way with Source) | You |
| Brain ID | Text | System (the source's id, `src-…`) |
| Last Synced | Date (with time) | System |
| Created | Created time | System |

Decisions, Questions, Concepts and People together are **Produced**: the notes the brain made from this input. The page body is yours on a capture and on an Ask row. On a row the brain creates, the body is a digest written once: what the input is, its summary, the key points by section and the figures and dates as stated. Below it, a toggle heading **Full text** holds the text itself when you chose it (emails and chats by default, documents and decks on request, or part of one: "slides 3–9"). It is a one-way copy: the source in the brain stays the real one, and an edit there doesn't reach the brain.

**Ask and Report (0043):** add a row with Kind = Ask and your question as its Name ("Everything about the Acme launch since August"). The next catch-up answers it with a new row, Kind = Report, linked to your Ask row, which becomes Processed. The report has Where it stands, Timeline (oldest first, each line linked), Decisions in force, Open questions and risks, People involved, and Gaps; lines resting on notes you haven't reviewed are marked *(not reviewed)*. A report is a dated snapshot, never ingested back: ask again to refresh it. The brain doesn't read Inbox rows back except to ingest New captures, so an edit to Summary or Produced stays in Notion until the brain's own value changes.

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
| Source | Relation → Inbox | The backlink for your action items from documents, emails, chats, notes and captures (0037) |
| Brain ID | Text | Set when the brain created it |
| Last edited time | Last edited time | System (Notion fills it; groups the Done tab by week) |

### 3.13 Concepts
Ideas, methods and definitions the brain learned, mostly from documents (0037). Created by the brain only; the Inbox records what came in, Concepts holds what the brain learned from it.

| Property | Type | Owner |
|---|---|---|
| Project | Relation → Projects (two-way with Concepts) | Brain |
| Area | Relation → Areas (two-way with Concepts) | Brain |
| Sources | Relation → Inbox (two-way with Concepts) | Brain (filled from the Inbox side) |
| Created time | Created time | System (Notion fills it; "Recent" view) |

Plus the common properties. Page body: the concept's explanation, brain-written. `^[inferred]` statements shown with an "AI inference" label (0004).

---

## 4. Templates (contextual workspaces, Easlo pattern)

Each template is the default for its database. Every linked view sits under an H3 heading named by the question it answers, with the database title hidden, and is filtered to "this page". Where a block has tabs, they follow the record's life (now → later → done). The table is the intent; [Prompt 6](../notion/prompts/06-templates.md) is the exact definition and wins where they differ. The live snapshot is [notion/templates.md](../notion/templates.md).

| Database | Template body |
|---|---|
| Areas | "Brief" toggle heading (brain-written, 0041) · "What am I working toward here?" (Goals, Active) · "What's active here?" (Projects: Active, Planned, Done) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What have we decided here?" (Decisions: Current, Superseded) · "What's still open here?" (Questions: Open questions, Open risks, Answered) · "What came in?" (Inbox where Area is this page, newest first) · "What do we know?" (Concepts where Area is this page) · "My notes". People and Clients show as the "via projects" rollups in the page header (0034) |
| Goals | "How are the key results moving?" (Key Results: Open, Done) · "Which projects serve it?" (Projects) · "My notes" |
| Projects | A muted line "Brief and Decision log are written by the brain. Add your own notes in My notes." · "Brief" toggle heading (brain-written) · "Decision log" toggle heading (brain-written) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What's still open here?" (Questions, Open) · "Who's involved?" (People) · "What came in?" (Inbox where Project is this page, newest first) · "What do we know?" (tabs Decisions and Concepts where Project is this page) · "My notes" |
| Meetings | Unchanged from the hand-reworked template (see notion/templates.md): "Before marking Reviewed" checklist callout · Notion AI meeting notes block · "My notes" · toggles Decisions, Questions, Tasks |
| People | "Which meetings were they in?" (Meetings: Upcoming, Past) · "What are they working on?" (Projects) · "My notes" |
| Orgs | "Who works there?" (People) · "Which projects?" (Projects) · "My notes". Meetings show as the "Meetings via projects" rollup in the page header |
| Decisions | (brain-generated body) · "Superseded by" callout when present |
| Concepts | (brain-generated body); no template needed |
| Inbox | None: a capture's body is yours, and the brain writes the body of the rows it creates (§3.11) |

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
    ├── Brain Data            ← all 13 databases
    └── System                ← synced nav, Archive, How it works
```

Each Space: the synced Spaces navigation in a narrow left column, then one tabs block whose tabs hold the linked views (Knowledge: one tab per database, each holding one linked view with several views). Views are named by the question they answer; tab labels are short. Each view shows what you need to act on from that view, usually 2–4 properties; everything else is on the page.

| Space | Job | Tabs (view) |
|---|---|---|
| **Home** | Start of day: your work first | Left: navigation, then "Needs you": "What needs my decision?" (Review, Pending) and "Which minutes need review?" (Meetings, Not Reviewed, held today or earlier), 5 rows each. Right: buttons Quick capture (→ Inbox, Kind Capture, Brain Status New), Ask the brain (→ Inbox, Kind Ask, Brain Status New), New meeting, New project; then "What's on today?" with tabs Tasks (due today or overdue) · Meetings (today) · Projects (Active); then "What did the brain take in?" (the Brain feed, 0043) with tabs Came in (Inbox, Processed, newest first, 10 rows) · Meetings (Brain Status Ingested, newest Ingested At first, 10 rows) |
| **Tasks** | Do the work | Today · Upcoming (by day) · No date · Waiting On · Someday · Done (by week) |
| **Meetings** | Prepare, review minutes, track ingestion | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Run projects | Active (board by Status) · By area · Deadlines (timeline) · Gone quiet |
| **Plan** | Areas → goals → key results → projects | Goals · Key results (by goal) · Areas (the way into each Area page) · Projects by goal |
| **Review** | Decide on proposals | A muted line above the views: "Your corrections go in Note. Target says what changes." (0043) · Needs my decision · Sources disagree · Approved recently · Rejected |
| **Knowledge** | Navigate what the brain knows | Decisions (Recent, Current, Provisional, Superseded, Disputed) · Questions (Open questions, Open risks, Answered) · Concepts (Recent, By project, Drafts) · People (by org, Disputed) · Orgs (Clients, Others) · Inbox (Inbox: New, oldest first · History: Processed, newest first) |
| **Archive** (under System) | Find what's finished | One tab per database: Projects (Done or Archived) · Goals (Achieved, Dropped or Archived) · Areas · Decisions · Questions · Concepts · People · Orgs (Archived) |

Every view, with its filters, sort and properties, is in [notion/views-guide.md](../notion/views-guide.md) and Prompts 7a–7h.

**Brain Assistant** is a Notion Custom Agent for daily use ([notion/brain-assistant.md](../notion/brain-assistant.md)): Instructions with the rules, and seven skills (Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture). Its Tools and access hold only Brain Data, How it works and its skills database, so same-named databases elsewhere in the workspace can't be confused. It reads and answers; only Check minutes and Tidy capture may edit, and only the page text you own (0035). How-to questions are answered from the "How it works" page, a copy of the user guide.

---

## 6. Notion AI build prompts

The prompts live in [notion/prompts/](../notion/prompts/), each with its **Verify** list. Run them in the order of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one per message, on a new empty teamspace page. They are written so Notion AI does not invent extra properties.

| # | Prompt | Builds |
|---|---|---|
| 1 | [Pages](../notion/prompts/01-pages.md) | the eight pages of §5 |
| 2 | [Databases](../notion/prompts/02-databases.md) | the 13 databases of §3, without relations |
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
      "questions": "<id>", "review": "<id>", "inbox": "<id>", "concepts": "<id>"
    },
    "tasks": {
      "database": "<id>",
      "properties": {
        "title": "Name", "status": "Status", "due": "Due",
        "project": "Project", "area": "Area", "meeting": "Meeting", "source": "Source", "brain_id": "Brain ID"
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

The text lives in [notion/minutes-format.md](../notion/minutes-format.md). It gives every summary the same sections (Attendees, Projects, Action Items, Decisions, Open Questions, Risks, Meeting Purpose, Background, Current Status, Requirements and Deadlines, Other relevant topics; 0043), and consistent minutes make the ingest more accurate (0024). Paste it into Notion AI when you ask it to summarise a meeting, or use it to check minutes against the "Minutes follow the format" item of the checklist. The Meetings template (reworked by hand on 2026-10-13) no longer holds it in a callout; on 2026-10-14 we chose to keep that template as it is.
