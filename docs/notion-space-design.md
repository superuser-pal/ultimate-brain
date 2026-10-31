# Notion Space Design (v1)

**Status:** Proposed design, ready to build with Notion AI. Not built.
**Date:** 2026-10-11
**Built from:** [hub-and-spoke pattern](notion-space-architecture.md), [Easlo vs Ultimate Brain comparison](notion-second-brain-template-comparison.md), [Easlo appendix](easlo-second-brain-factual-architecture-appendix.md), [Ultimate Brain appendix](ultimate-brain-for-notion-factual-architecture-appendix.md), [synthesis](../synthesis/synthesis.md), decisions 0003, 0005, 0007, 0011, 0012, 0015, 0018–0021; updated for 0041–0045 and 0048–0050.

---

## 1. What this space is for

Notion is the **human side** of the brain. You use it to:

1. **Review meeting minutes** and mark them ready for the brain.
2. **Decide** on what the agents propose (the Review queue).
3. **Plan**: areas, goals, key results, projects.
4. **Navigate** what the brain knows: projects, people, clients, decisions, open questions.
5. **Capture** quick thoughts and create new projects, goals, people.

The Markdown brain stays canonical (vision). Notion shows curated knowledge, collects your decisions, and owns operational fields (status, progress, dates).

### Modules (0048)

A space is a **core** plus the **modules** you chose at onboarding. You can turn one on or off later by asking your agent ("turn on documents"); turning one off deletes nothing (spec/schema.md §12).

| Module | Databases | What it adds to the Spaces and templates | Default |
|---|---|---|---|
| **Core** | Inbox, Meetings, Projects, Areas, People, Review | Home, Meetings, Projects, Review; the Inbox tab of Knowledge; area homes' Meetings, Review waiting and Inbox tabs | always on |
| **Knowledge** | Decisions, Questions, Concepts | the Decisions, Questions and Concepts tabs of Knowledge; "What have we decided here?", "What's still open here?" and "What do we know?" (Decisions, Concepts) on project and area pages | on |
| **Orgs** | Orgs | the Orgs tab of Knowledge; Client on Projects, Org on People; "Clients via projects" on area pages | on |
| **Documents** | Documents (was References) | the Documents tab of Knowledge and of "What do we know?"; Keep as document and Only keep on the Inbox; Promote to document on Decisions and Concepts | off |
| **Reports** | none: Ask and Report rows on the Inbox | the Ask the brain button on Home; the Refresh report button, Refresh asked and What to fix on the Inbox; "Reports" on project and area pages | off |
| **Tasks** | Tasks, or your own tasks database (0018) | the Tasks Space; "What's on my plate here?" on project and area pages; Home's "What's on today?" Tasks tab, its "due" counts and "Due across areas" | off |
| **Planning** | Goals, Key Results | the Plan Space; Goal on Projects; "What am I working toward here?" on area pages | off |

A part of a page that belongs to a module that is off is left out, and nothing replaces it (0050). The build prompts create only the chosen modules; each module's own steps, for turning it on later, are in [notion/modules/](../notion/modules/).

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

**Creation:** new rows you create in Areas, Goals, Projects, People, Orgs are imported by the next `brain sync` (0021). Rows in Decisions, Questions, Concepts, Documents and Review are created by the brain only. Inbox rows come from you (Quick capture) or from the brain (every document, email, chat or note it ingests, 0037).

**Page bodies (0026, 0041, 0043):** the brain writes only inside named toggle headings: "Brief" and "Decision log" on project pages, "Brief" on area pages. It owns the whole body of Decisions, Questions and Concepts pages, of the Documents kept from an input, and of the Inbox rows it creates (a digest of what came in, and the report on a Report row; "Full text" toggles written before 0.6.0 stay). A Document promoted from a decision or concept is seeded once, then its body is yours (0049). It publishes no body for Goals, People and Orgs, and never edits Meetings (0007), a capture you wrote or an Ask row. Everything else on a page is yours, including the **"My notes"** toggle.

---

## 3. Databases

Up to fourteen databases, all on the backend page **Brain Data**: the six of Core plus those of the modules you chose (§1). Naming: plural Title Case database names, Title Case property names, no emoji in property names (the agent addresses them by name through the Notion MCP).

**Common properties** on every brain-mirrored database (Areas, Goals, Projects, People, Orgs, Decisions, Questions, Concepts, Documents):

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
| Documents | Relation → Documents (two-way with Area) | Brain (0045, 0049) |
| Inbox | Relation → Inbox (two-way with Area) | You (brain fills if empty) |
| Tasks | Relation → Tasks (two-way with Area) | You |
| Review | Relation → Review (two-way with Area) | Brain (0050) |
| To review | Formula: the Review rows with State Pending, counted | You (derived, Notion-only; Home's per-area line, 0050) |
| Due | Formula: the Tasks not Done with Due today or earlier, counted (Tasks module) | You (derived, Notion-only, 0050) |
| Meetings to review | Formula: the Meetings with Brain Status Not Reviewed and Date today or earlier, counted | You (derived, Notion-only, 0050) |
| At a glance | Formula: the three counts as one line, "4 to review · 1 meeting · 2 due", leaving out each count that is 0 and each module that is off, or "all clear" (#145) | You (derived, Notion-only; what Home shows next to the area's name) |
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
| Documents | Relation → Documents (two-way with Project) | Brain (0045, 0049) |
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
| Promote | Button labelled **Promote to document**: ticks Promote asked | You (Documents module, 0048, 0049) |
| Promote asked | Checkbox | You, through the button: "waiting for the brain". The brain creates a Document seeded from this decision and clears it |
| Documents | Relation → Documents (two-way with From decision) | Brain (filled from the Documents side) |

Page body: context, decision, consequences, sources. `^[inferred]` statements shown with an "AI inference" label (0004).

### 3.9 Questions
Open questions and risks raised in meetings.

| Property | Type | Owner |
|---|---|---|
| Kind | Select: Question, Risk | Brain |
| Status | Select: Open, Answered, Dropped | You. The brain sets Open when it creates a question, and Answered once after you approve an Answer row in Review (0041, 0045) |
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
| Kind | Select: Update Fact, Add To Note, Update Body, Add Link, Supersede, Contradiction, Merge, New Item, Review Notes, Answer | Brain; hidden from your views and collapsed on the page (0048): **Type** says what you need. **Review Notes** (0041, 0043, 0045): one row per meeting, email or document, holding everything it proposes, lettered a), b)…: fact changes first, marked ⚠, then text added to existing notes, then the new notes, then links. Approve accepts them; "all except b, d" in What to fix moves those to a row of their own that waits for you; Reject archives the new notes. Contradiction, Supersede, Merge and Answer keep rows of their own. **Update Body**: a change to a kept reference (0045) |
| Type | Formula on Kind: **From source** (Review Notes, Update Fact, Add To Note, Update Body, Add Link), **Conflict** (Contradiction, Supersede, Merge, New Item), **Answer** (Answer) | You (derived, Notion-only, 0048). The Name says the same: a Conflict row's starts with "Conflict: ", an Answer row's with "Answer: ", a From source row's with "From " |
| Area | Relation → Areas (two-way with Review), limited to one page | Brain (0050): the area of the meeting or input it came from (its own Area, else its first project's), else empty. Feeds the area homes' "Review waiting" tab |
| About | Text | Brain: note title + Brain ID (for Review Notes, the meeting or source). Was Target before 0.5.0 (0045) |
| About Page | URL | Brain: link to the Notion page affected; for Review Notes, the meeting or Inbox row it came from (was Target Page) |
| Now | Text | Brain: the current value (was Before) |
| Proposed | Text | Brain: the proposed value, or the lettered items (was After) |
| Why | Text | Brain: the sentence from the source that triggered it |
| Source Meeting | Relation → Meetings | Brain |
| Your call | Select: Approve, Reject, Fix | **You** (was Decision, with Edit; 0045). Its description carries the promise of Review, so every row shows it on hover: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed." |
| What to fix | Text | **You** (was Note): with Fix, what's wrong, in your words ("Lucía is on Acme website, not Acme app", "a: March"); with Approve, what to leave out ("all except b, d"). The brain applies its corrected version and says in its report what it changed; it never applies a change your words didn't clearly ask for (0037, 0045) |
| State | Select: Pending, Applied, Closed | System |
| Brain ID | Text | System (`prp-…`) |
| Created time | Created time | System (Notion fills it; sorts the queue) |
| Last edited time | Last edited time | System (Notion fills it; "approved recently" filter) |

### 3.11 Inbox
Everything that came into the brain except meetings, which have their own database (0037). Your quick captures land here as **Ready**; every document, email, chat or note the brain ingests gets a row, created as **Done**, so **History** shows what came in and what the brain learned from it.

| Property | Type | Owner |
|---|---|---|
| Name | Title | You on a capture; Brain on a row it creates |
| Keep | Button labelled **Keep as document**: ticks Document asked and sets Brain Status to Ready | You (Documents module, 0048, 0049) |
| Update | Button labelled **Refresh report**, on a Report row: ticks Refresh asked | You (Reports module, 0048) |
| Kind | Select: Capture, File, Email, Chat, Note, Ask, Report | System, written only when empty, so a Kind you choose stands (0048). File was Document before 0.6.0 (0049). **Ask** is yours: a question for the brain (Reports module, 0043) |
| Summary | Text | Brain: one line on what it taught; on a row the brain skipped, why ("Skipped: same as …") |
| Decisions | Relation → Decisions (two-way with Sources) | Brain |
| Questions | Relation → Questions (two-way with Sources) | Brain |
| Concepts | Relation → Concepts (two-way with Sources) | Brain |
| Documents | Relation → Documents (two-way with Sources) | Brain (was References, 0045, 0049) |
| People | Relation → People (two-way with Sources) | Brain |
| Project | Relation → Projects (two-way with Inbox) | You: set it on a capture and the ingest uses it without asking (brain fills if empty) |
| Area | Relation → Areas (two-way with Inbox) | You (brain fills if empty) |
| Brain Status | Select: New, Ready, Done | You set Ready ("take it in"); the brain sets Done when it has taken the row in, or skipped it. **A catch-up takes in only Ready rows** (0048) |
| Document asked | Checkbox | You, through the Keep as document button: "waiting for the brain". The brain keeps the input as a Document and clears it (0049) |
| Only keep | Text | You: when only part should be kept ("the requirements table and the deadlines"). Empty = the whole input (0049; was Keep) |
| Report | Relation → Inbox (two-way with Ask) | Brain: on an Ask row, the report that answers it |
| Ask | Relation → Inbox (two-way with Report) | Brain: on a Report row, the questions it answers |
| Refresh asked | Checkbox | You, on a Report row, through the Refresh report button, property Update (was the Refresh checkbox before 0.6.0): rewrite it with what the brain knows now; the brain clears it (0045) |
| What to fix | Text | You, on a Report row: what the report gets wrong; the brain turns it into Review rows, clears it, and refreshes the report once you approve them (0045) |
| Tasks | Relation → Tasks (two-way with Source) | You |
| Brain ID | Text | System (the source's id, `src-…`) |
| Last Synced | Date (with time) | System |
| Created | Created time | System |

**Retired in 0.6.0 (0048, 0049):** Full text (Keep as document replaces it), Refresh report (an Ask row is always a new report), and the Brain Status options Processed (now Done) and Skipped (rows moved to Done). Migration 0010 leaves the two old properties unused for you to delete.

Decisions, Questions, Concepts, Documents and People together are **Produced**: the notes the brain made from this input. The page body is yours on a capture and on an Ask row. On a row the brain creates, the body is a digest written once: what the input is, its summary, the key points by section and the figures and dates as stated. To read a whole file in Notion, click **Keep as document**: the next catch-up writes it as a Document, linked here and to its project (0049).

**Ask and Report (0043, Reports module):** add a row with Kind = Ask and your question as its Name ("Everything about the Acme launch since August"). The next catch-up answers it with a new row, Kind = Report, linked to your Ask row, which becomes Done. The report has Where it stands, Timeline (oldest first, each line linked), Decisions in force, Open questions and risks, People involved, and Gaps; lines resting on notes you haven't reviewed are marked *(not reviewed)*. A report is **living** (0045): one per subject, shown on the project and area pages under "Reports". Click **Refresh report** to have it rewritten with a new date; write in **What to fix** what it gets wrong. It is never ingested back. The brain doesn't read Inbox rows back except to take in Ready rows and act on the buttons, so an edit to Summary or Produced stays in Notion until the brain's own value changes.

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
| Promote | Button labelled **Promote to document**: ticks Promote asked | You (Documents module, 0048, 0049) |
| Promote asked | Checkbox | You, through the button: "waiting for the brain"; the brain clears it |
| Documents | Relation → Documents (two-way with From concept) | Brain (filled from the Documents side) |
| Created time | Created time | System (Notion fills it; "Recent" view) |

Plus the common properties. Page body: the concept's explanation, brain-written. `^[inferred]` statements shown with an "AI inference" label (0004).

### 3.14 Documents
Pages you keep to read and link from anywhere (0049; the References database of 0045, renamed with its id, relations and views). Created by the brain only, in three ways:
- **Keep as document** on an Inbox row, with Only keep empty: the input's **whole text**, verbatim. It needs no Review and arrives Reviewed.
- **Keep as document** with **Only keep** filled in: only that part, chosen by the brain. It comes as an item in that input's Review row and is Draft until you approve it.
- **Promote to document** on a decision or concept: a page seeded from it, linked to it. From then on its body is **yours**; the brain never rewrites it.

A new version of a kept file proposes the changed lines to its Documents (Kind Update Body in Review).

| Property | Type | Owner |
|---|---|---|
| Project | Relation → Projects (two-way with Documents) | Brain |
| Area | Relation → Areas (two-way with Documents) | Brain |
| Sources | Relation → Inbox (two-way with Documents) | Brain (filled from the Inbox side) |
| From decision | Relation → Decisions (two-way with Documents) | Brain: on a promoted Document |
| From concept | Relation → Concepts (two-way with Documents) | Brain: on a promoted Document |
| Created time | Created time | System (Notion fills it) |
| Last edited time | Last edited time | System (Notion fills it; sorts "What did we keep?") |

Plus the common properties. Page body: the kept text (brain-written), or, on a promoted Document, yours after the first write.

### 3.15 Buttons and page layouts (0048)

**Every action you ask of the brain is a button** at the top of the row's page. The API can't see a click, so each button ticks a checkbox on the same row, which shows in the property group as "waiting for the brain"; the brain unticks it once it has acted. The Notion API can't create button properties (they are response-only in its schema), so buttons are always added by hand.

| Button property | Label | Database | Ticks | Also | Module |
|---|---|---|---|---|---|
| Keep | Keep as document | Inbox | Document asked | sets Brain Status to Ready | Documents |
| Update | Refresh report | Inbox (Report rows) | Refresh asked | — | Reports |
| Promote | Promote to document | Decisions, Concepts | Promote asked | — | Documents |

**A button's property name and its label differ** (#144): the page layout shows the name on the left and the label on the button, so the same text would show twice. The names are short and clash with no other property (not Report, Documents or Refresh asked). The brain never reads a button, only the checkbox it ticks, so a space that names its buttons otherwise works the same. Each checkbox has its own name, because Notion can't give a button and another property the same name.

Archived and Done (on a milestone) stay checkboxes: they describe a state, not a request.

**Page layout rule.** Each database's page layout has three parts: what you act on is **pinned at the top**; what the brain wrote comes next; system fields are **collapsed**. The API can't edit page layouts, so each is set by hand (migration 0010 lists every change, database by database).

| Database | Pinned at the top | Collapsed |
|---|---|---|
| Inbox | Keep, Update (on Report rows), Brain Status, Project, Area | Brain ID, Last Synced, Created |
| Review | Your call, What to fix, About Page | Kind, State, Brain ID, Created time, Last edited time |
| Decisions | Promote, Lifecycle | Brain ID, Last Synced |
| Concepts | Promote, Lifecycle | Brain ID, Last Synced, Created time |
| Documents | Lifecycle, Project, Area, Sources | Brain ID, Last Synced, Created time, Last edited time |
| Areas | Type, At a glance | Brain ID, Last Synced |
| Goals, Projects, People, Orgs, Questions, Meetings | the "You" properties of §3 | Brain ID, Last Synced, Ingested At |

**The boxes a button ticks, and Only keep, are not pinned** (#144): they sit at the top of the property group. The button already says what it does, and the box is only the brain's to clear.

---

### 3.16 Buttons that message Brain Assistant (0054): what a button passes

A button can use the action **send message to** an agent and pick Brain Assistant. Tried by the user on 2026-10-31 on a test Inbox row (synthetic text); the plan level was not recorded.

**Verified (by that test):**
- **The page or row a button sits on is not identified implicitly.** With a message that referenced nothing, Brain Assistant replied that it was not triggered from a page or database and that the chat context showed no page being viewed. *Inference, not tested:* the button passes only its message text; that nothing else is passed is not established by this test.
- **The message can reference the row it sits on:** the button's message editor offers `@` and a reference to the current page. With that reference in the message, Brain Assistant acted on the right row.
- **End to end for Tidy capture on an Inbox row:** with the message "Run your Tidy capture skill on this Inbox page: @[this row]. I confirm: …replace the text below the title with the rewrite. Do not change the title, Brain Status or any property", Brain Assistant rewrote the body of that row, asked no question, and changed no property.
- **Brain Assistant applies its own rules to a message:** asked, in the first test, what it could edit, it answered that it edits page text only for Clean Email, and for Tidy Capture and Check Minutes "after your confirmation". A button's message therefore carries the confirmation the skill needs (the Instructions' edit rule is amended in 0.8.0, CC-71, 0054).

**The button contract (normative for CC-71):** every Brain Assistant button's message (1) names the skill to run, (2) references the row with `@` to the current page, (3) carries the confirmation, and (4) says what the agent must not touch. A button without the row reference is not a valid Brain Assistant button: the agent cannot tell which row was clicked.

**Not verified yet (do not rely on these):**
- Refresh report on a Report row. The user reported (2026-10-31, not recorded in detail) that a second button test "edits the right body"; taken here as Write up on a promoted Document. Tidy capture on an Inbox row is the one with a recorded message and result.
- Whether a click runs unattended after the user leaves the page, and the credits one click uses (U-22, in the 0.8.0 acceptance run, measures them).
- Per-block edit times. The accepted-wording rule (cli.md §5.14.7) does not need them: it uses the **page's own** last-edited time, which also moves when a block is deleted, and treats a property edit after the click as an edit (it errs toward not importing). Notion rounds that time to the minute, so an edit in the same minute as the click and before the first read is a known limit, recorded in decision 0058: an attended catch-up shows the full replacement text as a diff before importing, and an unattended run imports only an acceptance at least 2 minutes old.
- Notion AI (instead of the Custom Agent) as the target. Not tested; a Custom Agent is scoped to Brain Data (0035), which Notion AI is not.

### 3.17 The three Brain Assistant buttons, Write up format and accepting wording (0054)

Added in 0.8.0 (CC-71 builds them; migration 0012). Each button follows the contract in §3.16: its message names the skill, references the row with `@`, carries the confirmation, and says what not to touch. Clicking one is a deliberate act; nothing here runs on a property change or a schedule.

| Button | On | Message asks Brain Assistant to | May edit | Never |
|---|---|---|---|---|
| **Tidy capture** | Inbox rows of Kind Capture, Brain Status **New** only (the row stays New while Brain Assistant works, so a catch-up cannot take it in half-rewritten; the user sets Ready afterwards, 0054) | rewrite the body as clear text, keeping every name, number, date, link and quote | the row's body | the Name, any property (Brain Status stays New; the user sets Ready), a Review row |
| **Write up** | Documents, **promoted** Documents only (`origin: promoted`) | develop the body from the Document and the brain pages it links in Notion | the Document's body | the original Decision or Concept, any property, a Review row, external research unless the message asks for it |
| **Refresh report** | Report rows | search the relevant brain pages in Notion beyond the report's current links and **append** one section "Proposed refresh · based on Notion", dated and cited | the report's body, by appending that section | the existing report text, any property, *Refresh asked* |

Keep as document and Promote to document stay checkbox buttons that the catch-up acts on (no Notion AI step). A Document only exists to Write up after the next catch-up has created it.

**Write up format.** Purpose → Main content → Open questions → Sources, as native Notion blocks: a one-line purpose in a callout, headings, concise prose and lists, linked citations, a toggle for supporting detail, open questions visible. The first Write up develops the seeded text. A **repeat** Write up keeps the user's wording and appends one block headed **Proposed revision** (a toggle, marked with that exact heading) holding the new wording; the user adopts it by editing it into the body and deleting the block, or discards it by deleting the block. A repeat **Refresh report** replaces only the previous "Proposed refresh · based on Notion" section.

**Accepting.** Documents and Report rows gain two properties, **Accepted** (checkbox) and **Accepted at** (date and time), and one button:
- on a Document, **Accept write-up**; on a report, **Accept refresh**. The button sets Accepted to checked and Accepted at to now (a Notion button can edit these properties; no AI is involved).
- For a report, the user accepts by first moving the proposed section's text into the report body (replacing the old text) and deleting the "Proposed refresh" heading, then clicking **Accept refresh**.
- **An unresolved Proposed revision or Proposed refresh block blocks acceptance**: a checked Accepted with such a block on the page is not imported (cli.md §5.14.7, rows 4 and 5).
- **Any edit of the page in a later minute than the click invalidates the acceptance** (an edit inside the click's own minute is the known limit of decision 0058), deleting a paragraph included: the user clicks Accept again. The catch-up sees `Accepted at` older than the page's last edit and lists the row under Needs you. The skill re-reads the page just before importing, so an edit made after the catch-up began also stops the import.
- **The catch-up shows what it will import** (the full replacement text as a diff against Git) and imports after you say yes; an unattended run imports only an acceptance at least 2 minutes old. An edit made in the same minute as your Accept click, before the first read, cannot be detected: a known limit (decision 0058).
- **After the catch-up imports the wording it unticks Accepted and clears Accepted at** (like the other request boxes): the acceptance was consumed, and a later edit is an ordinary draft, which a publish never overwrites.
- To withdraw an acceptance the user unticks Accepted.

**What Brain Assistant may edit (amends 0035).** Besides Check minutes, Tidy capture and Clean email: Write up, on the body of a promoted Document, and Refresh report, appending its proposed section to a Report row's body. Still never a property, a Review row, a Decision's or Concept's page, or a brain-written section of any other page (CC-71 writes this into the Instructions).

**Where each case ends (the table in cli.md §5.14.7 is normative).** A Document or report body can be seeded, drafted by Write up, carry a pending proposal, be accepted, be edited after acceptance, or differ from Git; each has one outcome there. This section only defines the controls the user sees.

### 3.18 Domains, selected capture and editable Review (0.8.0, decision 0055)

The contract is [spec/capture-and-review.md](../spec/capture-and-review.md). For the Notion space it adds: the optional Domains database and Areas · Domain relation (§1), the Won't Do status and progress display (§2), the voice/ramble Inbox template (§3), typed `Selection:` tokens on summaries (§4), Review rows with item sections, `Decision:` tokens, the Submit decisions and Submit and accept all buttons, and the Decided, Decided at and Accept all properties (§7). **Every mechanism there is planned and unverified** until the user's tests T1 to T7 (§9) are recorded here as verified.

## 4. Templates (contextual workspaces, Easlo pattern)

Each template is the default for its database. Every linked view sits under an H3 heading named by the question it answers, with the database title hidden, and is filtered to "this page". Where a block has tabs, they follow the record's life (now → later → done). The table is the intent; [Prompt 6](../notion/prompts/06-templates.md) is the exact definition and wins where they differ. The live snapshot is [notion/templates.md](../notion/templates.md).

| Database | Template body |
|---|---|
| Areas | **The area's home (0050).** "Brief" toggle heading (brain-written, 0041) · "What needs me here?" with tabs Today (Tasks due today or earlier, not Done) · Meetings (to review, held today or earlier) · Review waiting (Review where Area is this page and State is Pending, grouped by Type) · Inbox (where Area is this page and Brain Status is New or Ready) · "What am I working toward here?" (Goals, Active) · "What's active here?" (Projects: Active, Planned, Done) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What have we decided here?" (Decisions: Current, Superseded) · "What's still open here?" (Questions: Open questions, Open risks, Answered) · "What came in?" (Inbox where Area is this page, newest first) · "What do we know?" (tabs Decisions, Concepts and Documents where Area is this page) · "Reports" (Inbox where Area is this page and Kind is Report, 0045) · "My notes". People and Clients show as the "via projects" rollups in the page header (0034). Each part follows its module (§1, 0050): Today and "What's on my plate here?" with Tasks; "What am I working toward here?" with Planning; "What have we decided here?", "What's still open here?" and the Decisions and Concepts tabs with Knowledge; the Documents tab with Documents; "Reports" with Reports; Clients via projects with Orgs. A new area is one page from this template |
| Goals | "How are the key results moving?" (Key Results: Open, Done) · "Which projects serve it?" (Projects) · "My notes" |
| Projects | A muted line "Brief and Decision log are written by the brain. Add your own notes in My notes." · "Brief" toggle heading (brain-written) · "Decision log" toggle heading (brain-written) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What's still open here?" (Questions, Open) · "Who's involved?" (People) · "What came in?" (Inbox where Project is this page, newest first) · "What do we know?" (tabs Decisions, Concepts and Documents where Project is this page) · "Reports" (Inbox where Project is this page and Kind is Report, sorted by Created descending, 0045, #137) · "My notes". Parts follow their modules as on Areas |
| Meetings | Unchanged from the hand-reworked template (see notion/templates.md): "Before marking Reviewed" checklist callout, ending with the gray line "Check the minutes, fix them, then set Brain Status to Reviewed. Fixed them after the brain took them in? Set Reviewed again: it reads only what changed." (0045) · Notion AI meeting notes block · "My notes" · toggles Decisions, Questions, Tasks |
| People | "Which meetings were they in?" (Meetings: Upcoming, Past) · "What are they working on?" (Projects) · "My notes" |
| Orgs | "Who works there?" (People) · "Which projects?" (Projects) · "My notes". Meetings show as the "Meetings via projects" rollup in the page header |
| Decisions | (brain-generated body) · "Superseded by" callout when present |
| Concepts | (brain-generated body); no template needed |
| Documents | (brain-written body, or yours on a promoted Document); no template needed |
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
    ├── Brain Data            ← the databases of Core and your modules
    └── System                ← synced nav, Archive, How it works
```

Each Space: the synced Spaces navigation in a narrow left column, then one tabs block whose tabs hold the linked views (Knowledge: one tab per database, each holding one linked view with several views). Views are named by the question they answer; tab labels are short. Each view shows what you need to act on from that view, usually 2–4 properties; everything else is on the page.

| Space | Job | Tabs (view) |
|---|---|---|
| **Home** | Start of day: your areas, then your work | Left: navigation, then "Needs you": a muted line "Start here: approving makes the brain's notes trusted." and "What's waiting for you?" (Review, Pending, grouped by **Type** with counts, 0048) and "Which minutes need review?" (Meetings, Not Reviewed, held today or earlier), 5 rows each. Right: buttons Quick capture (→ Inbox, Kind Capture, Brain Status **Ready**, 0048), Ask the brain (→ Inbox, Kind Ask, Brain Status New; Reports module), New meeting, New project; then "What's on today?" with tabs **Areas** (one line per area, 0050: a linked view of Areas, not Archived, showing Name and At a glance, e.g. "Day job · 3 to review · 1 meeting · 2 due"; below it "What's due across areas?", Tasks due today or overdue, Tasks module; #143, decision 0053) · Tasks (due today or overdue; Tasks module) · Meetings (today) · Projects (Active) · **Inbox** ("What's in my inbox?": New or Ready, oldest first, showing Name, Kind, Brain Status; #146); then "What did the brain take in?" (the Brain feed, 0043) with tabs Came in (Inbox, Done, newest first, 10 rows) · Meetings (Brain Status Ingested, newest Ingested At first, 10 rows) |
| **Tasks** (Tasks module) | Do the work | Today · Upcoming (by day) · No date · Waiting On · Someday · Done (by week) |
| **Meetings** | Prepare, review minutes, track ingestion | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Run projects | Active (board by Status) · By area · Deadlines (timeline) · Gone quiet |
| **Plan** (Planning module) | Areas → goals → key results → projects | Goals · Key results (by goal) · Areas (the way into each Area page) · Projects by goal |
| **Review** | Decide on proposals | A muted line above the views: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. To correct something, pick Fix in Your call and say what's wrong in What to fix." (0043, 0045). A decided row leaves Review 30 days after the decision; the brain keeps it in Git (0045) · Needs my decision (with a Type column: From source, Conflict, Answer; Kind hidden, 0048) · Sources disagree · Approved recently · Rejected. Review stays one queue for every area; each area home has its own "Review waiting" tab (0050) |
| **Knowledge** | Navigate what the brain knows | Decisions (Recent, Current, Provisional, Superseded, Disputed) · Questions (Open questions, Open risks, Answered) · Concepts (Recent, By project, Drafts) · Documents (What did we keep?, 0045, 0049) · People (by org, Disputed) · Orgs (Clients, Others) · Inbox (What came in?: Done, newest first; the rows still waiting are Home's Inbox tab). Each tab follows its module |
| **Archive** (under System) | Find what's finished | One tab per database of your modules: Projects (Done or Archived) · Goals (Achieved, Dropped or Archived) · Areas · Decisions · Questions · Concepts · Documents · People · Orgs (Archived) |

Every view, with its filters, sort and properties, is in [notion/views-guide.md](../notion/views-guide.md) and Prompts 7a–7h.

**Brain Assistant** is a Notion Custom Agent for daily use ([notion/brain-assistant.md](../notion/brain-assistant.md)): Instructions with the rules, and eight skills (Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Clean email). Its Tools and access hold only Brain Data, How it works and its skills database, so same-named databases elsewhere in the workspace can't be confused. It reads and answers; only Check minutes, Tidy capture and Clean email may edit, and only the page text you own (0035, 0045). How-to questions are answered from the "How it works" page, a copy of the user guide.

---

## 6. Notion AI build prompts

The prompts live in [notion/prompts/](../notion/prompts/), each with its **Verify** list. Run them in the order of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one per message, on a new empty teamspace page. They are written so Notion AI does not invent extra properties.

| # | Prompt | Builds |
|---|---|---|
| 1 | [Pages](../notion/prompts/01-pages.md) | the eight pages of §5 |
| 2 | [Databases](../notion/prompts/02-databases.md) | the databases of §3 for the chosen modules (§1), without relations |
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
  "modules": { "knowledge": true, "orgs": true, "documents": false, "reports": false, "tasks": true, "planning": false },
  "notion": {
    "databases": {
      "areas": "<id>", "goals": "<id>", "key_results": "<id>", "projects": "<id>",
      "meetings": "<id>", "people": "<id>", "orgs": "<id>", "decisions": "<id>",
      "questions": "<id>", "review": "<id>", "inbox": "<id>", "concepts": "<id>", "documents": "<id>"
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
