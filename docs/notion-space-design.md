# Notion Space Design (v1)

**Status:** Proposed design, ready to build with Notion AI. Not built.
**Date:** 2026-10-11
**Built from:** [hub-and-spoke pattern](notion-space-architecture.md), [Easlo vs Ultimate Brain comparison](notion-second-brain-template-comparison.md), [Easlo appendix](easlo-second-brain-factual-architecture-appendix.md), [Ultimate Brain appendix](ultimate-brain-for-notion-factual-architecture-appendix.md), [synthesis](../synthesis/synthesis.md), decisions 0003, 0005, 0007, 0011, 0012, 0015, 0018–0021; updated for 0041–0045 and 0048–0050, and for 0078 (the published Notion template, §10).

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
| **Domains** | Domains (in every space, 0065) | group Areas by work or life context; Areas can have one Domain or none. The database and Areas · Domain exist with the module off; the module decides whether the brain uses them and whether pages show them | off |
| **Knowledge** | Decisions, Questions (Concepts until 0.9.1: concepts are learned Documents, 0071) | the Decisions and Questions tabs of Knowledge; "What have we decided here?", "What's still open here?" and the Decisions tab of "What do we know?" on project and area pages | on |
| **Orgs** | Orgs | the Orgs tab of Knowledge; Client on Projects, Org on People; "Clients via projects" on area pages | on |
| **Documents** | Documents (was References), learned ones included (0071) | the Documents tab of Knowledge and of "What do we know?"; Keep as document and Only keep on the Inbox; Promote to document on Decisions | off |
| **Reports** | Documents (shared; Reports needs the Documents module on, 0071): a report is a Documents row with Origin Report; Ask rows on the Inbox | the Ask the brain button on Home; the Refresh report button (a Brain Assistant message, §3.17), Refresh asked and What to fix on a report's Documents row; "Reports" on project and area pages | off |
| **Tasks** | Tasks, or your own tasks database (0018) | the Tasks Space; "What's on my plate here?" on project and area pages; Home's "What's on today?" Tasks tab, its "due" counts and "Due across areas" | off |
| **Planning** | Goals, Key Results | the Plan Space; Goal on Projects; "What am I working toward here?" on area pages | off |

A part of a page that belongs to a module that is off is left out, and nothing replaces it (0050). The build prompts create only the chosen modules, except the Domains database and its relations, which every space has (0065); each module's own steps, for turning it on later, are in [notion/modules/](../notion/modules/).

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

**Workflow settings (0059)** on Projects and Areas (§3.19) are yours like Status, with one exception: the brain sets them when you connect a piece of work to Notion and when you end that connection, each time after your yes (spec/connected-workflows.md §3.1, §3.4). It never changes them otherwise.

**Creation:** new rows you create in Areas, Goals, Projects, People, Orgs are imported by the next `brain sync` (0021). Rows in Decisions, Questions, Documents and Review are created by the brain only. Inbox rows come from you (Quick capture) or from the brain (every document, email, chat or note it ingests, 0037).

**Only reviewed knowledge (0071, 0.9.1).** Decisions, Questions and Documents show what you trusted: a row gets its page when its note is reviewed, approved in its Review row, or reviewed from the start, as a whole Document is. Until then the draft lives only in its Review row, whose page holds its full wording (0055); a draft you reject never gets a page. Relations to a draft (an Inbox row's Decisions, a meeting's Decisions and Questions) fill in when you approve it, in the same run. People still arrive as Draft, because a meeting's Attendees needs their pages. A row that has a page keeps it: a superseded decision or an answered question stays as history. Draft pages from before 0.9.1 are moved to Notion's trash after your yes (migration 0020); each comes back as a new page when you approve it. The brain in Git keeps every draft (spec/cli.md §5.14.4).

**Page bodies (0026, 0041, 0043):** the brain writes only inside named toggle headings: "Brief" and "Decision log" on project pages, "Brief" on area pages. It owns the whole body of Decisions and Questions pages, of the Documents kept from an input or learned (0071), of the Inbox rows it creates (a digest of what came in; "Full text" toggles written before 0.6.0 stay), and of a report's Documents row (0071). A Document promoted from a decision is seeded once, then its body is yours (0049). It publishes no body for Goals, People and Orgs, and never edits Meetings (0007), a capture you wrote or an Ask row. Everything else on a page is yours, including the **"My notes"** toggle.

**Workflow and rollup toggles (0059, 0066).** Three more brain-owned toggle headings, written by the skills and never by `sync render`; no template creates them, and the skill appends one at the end of the page the first time it writes it (drag it up once):
- **Workflow** on a Project or Area page that is the destination of a connected workflow: the dated summary of progress, what is not yet in Notion and what needs you (spec/connected-workflows.md §9).
- **Work record** on a Task page of a connected workflow, also in a mapped external Tasks database: scope, acceptance criteria, dependencies, documents and progress (spec/connected-workflows.md §6.1).
- Toggle headings named **`Repo tasks · <repo>`** on the Project or Area page where a linked repo with tasks tracked in the repo is placed: a dated, read-only rollup of those tasks, one toggle per repo (spec/linked-repos.md §4).

Each is found by its exact name and its children replaced. Before appending one to a Project page with no toggle headings at all, the skill first appends empty **Brief** and **Decision log** toggles, so the next render finds them.

---

## 3. Databases

Up to fourteen databases, all on the backend page **Brain Data**: the six of Core plus those of the modules you chose (§1). One more database, **Skills** (Brain Assistant's skills; "Brain Assistant Skills" in a space built before 0.14.0, decision 0085), sits on **System**: it holds Brain Assistant's skills, and the brain never reads it (§5). Naming: plural Title Case database names, Title Case property names, no emoji in property names (the agent addresses them by name through the Notion MCP).

**Common properties** on every brain-mirrored database (Areas, Goals, Projects, People, Orgs, Decisions, Questions, Documents):

| Property | Type | Owner | Notes |
|---|---|---|---|
| Name | Title | Brain (you on creation) | |
| Summary | Text | Brain | ≤200 chars, from the note's `summary:` |
| Lifecycle | Select: Draft, Reviewed, Disputed, Archived | You | 0005. A new person arrives as Draft; decisions, questions and Documents arrive once reviewed (0071, §2). **Only on People, Decisions, Questions and Documents** (0070): rows you create (Domains, Areas, Goals, Projects, Orgs) have none, and Archived closes them |
| Brain ID | Text | System | e.g. `prj-9x4t1b7e` (0017). Empty = not imported yet |
| Last Synced | Date (with time) | System | |

### 3.1 Areas
Ongoing responsibilities (clients, health, learning…).

| Property | Type | Owner |
|---|---|---|
| Domain | Relation → Domains, two-way with Areas, Limit: 1 page (in every space, 0065; the brain reads it with the Domains module on) | Brain; your edits are corrections |
| Goals | Relation → Goals | You |
| Projects | Relation → Projects | You |
| Meetings | Relation → Meetings (two-way with Area) | Brain |
| Decisions | Relation → Decisions (two-way with Area) | Brain (0034) |
| Questions | Relation → Questions (two-way with Area) | Brain (0034) |
| Documents | Relation → Documents (two-way with Area) | Brain (0045, 0049) |
| Inbox | Relation → Inbox (two-way with Area) | You (brain fills if empty) |
| Tasks | Relation → Tasks (two-way with Area) | You |
| Review | Relation → Review (two-way with Area) | Brain (0050) |
| To review | Formula: the Review rows with State Pending, counted | You (derived, Notion-only; Home's per-area line, 0050) |
| Due | Formula: the Tasks neither Done nor Won't Do with Due today or earlier, counted (Tasks module) | You (derived, Notion-only, 0050) |
| Meetings to review | Formula: the Meetings with Brain Status Not Reviewed and Date today or earlier, counted | You (derived, Notion-only, 0050) |
| At a glance | Formula: the three counts as one line, "4 to review · 1 meeting · 2 due", leaving out each count that is 0 and each module that is off, or "all clear" (#145) | You (derived, Notion-only; what Home shows next to the area's name) |
| Archived | Checkbox | You |
| People via projects | Rollup: Projects → People, show original | You (derived, Notion-only) |
| Clients via projects | Rollup: Projects → Client, show original | You (derived, Notion-only) |
| Workflow | Select: Standard, Connected. Empty = Standard (§3.19) | You (the brain sets it at workflow setup and end, with your yes) |
| Work type | Select: Software, General (§3.19) | You (as Workflow) |
| Logging level | Select: Tasks only, Tasks + final outputs, Full durable record, Custom. Empty = Tasks + final outputs (§3.19) | You (as Workflow) |
| Log artifacts | Multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables. Read only with Custom (§3.19) | You (as Workflow) |

Page body: a toggle heading **Brief** (brain-written, 0041: the area's projects, reviewed decisions and open questions), then the template's linked views and "My notes". The publish appends the toggle at the end of a page that has none; drag it to the top once. Connected work adds **Workflow**, and a linked repo with tasks tracked in the repo adds **`Repo tasks · <repo>`** (§2).

### Domains database (0055; in every space, 0065)

Every space has it, with the Domains module on or off: the module decides only whether the brain reads and publishes Domains and whether pages show them (migration 0014 adds it to an older space). Name (title) and Summary (text) are brain-owned after creation; Type (select: Personal, Entrepreneurship, Professional; 0.9.0, it replaced Areas · Type) and Archived (checkbox) are yours; no Lifecycle (0070). Brain ID (text) and Last Synced (date) are system fields. Areas is the inverse of Areas · Domain, limited on the Area side to one page by hand. Org is a correctable relation to Orgs, created when the space has an Orgs database; Orgs · Domains is its inverse. The Domain page shows Areas and, when enabled, Org.

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
| Documents | Relation → Documents (two-way with Project) | Brain (0045, 0049) |
| Inbox | Relation → Inbox (two-way with Project) | You (brain fills if empty) |
| Tasks | Relation → Tasks (two-way with Project) | You |
| Key Facts | Text | Brain: current key facts, e.g. "Budget: 80000 EUR · Launch date: 2027-02" (format in spec/cli.md §5.14.4) |
| Archived | Checkbox | You |
| Countdown | Formula: days to the end of Dates ("23 days left", "Overdue"); empty when Dates is empty or Status is Done | You (derived, Notion-only) |
| Task Progress | Formula: completed and dropped counts separately, with completed / (total − dropped); zero active scope shows no percentage (0055) | You (derived, Notion-only) |
| Workflow | Select: Standard, Connected. Empty = Standard (§3.19) | You (the brain sets it at workflow setup and end, with your yes) |
| Work type | Select: Software, General (§3.19) | You (as Workflow) |
| Logging level | Select: Tasks only, Tasks + final outputs, Full durable record, Custom. Empty = Tasks + final outputs (§3.19) | You (as Workflow) |
| Log artifacts | Multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables. Read only with Custom (§3.19) | You (as Workflow) |
| Last edited time | Last edited time | System (Notion fills it; "gone quiet" view) |

Page body: toggle headings **Brief** and **Decision log** (brain-written, 0026), then the template's linked views and "My notes". Connected work adds **Workflow**, and a linked repo with tasks tracked in the repo adds **`Repo tasks · <repo>`** (§2).

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
Clients, partners, suppliers, your employer. One canonical entity database (your pattern's rule).

| Property | Type | Owner |
|---|---|---|
| Relationship | Select: Client, Prospect, Partner, Supplier, Employer, Other (Employer: 0071) | You |
| People | Relation → People (two-way with Org) | Brain |
| Projects | Relation → Projects (two-way with Client) | Brain |
| Website | URL | You |
| Archived | Checkbox (0070: Orgs have no Lifecycle; this closes one) | You |
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
| Status | Select: Open, Answered, Dropped | You. The brain sets Open when it creates a question, Answered once after you approve an Answer row in Review (0041, 0045), and Dropped once after the to-do tidy drops a question that was a to-do (0071) |
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
| Kind | Select: Update Fact, Add To Note, Update Body, Add Link, Supersede, Contradiction, Merge, New Item, Review Notes, Answer, Notion Change, Set Field | Brain; hidden from your views and collapsed on the page (0048): **Type** says what you need. **Review Notes** (0041, 0043, 0045): one row per meeting, email or document, holding everything it proposes, lettered a), b)…: fact changes first, marked ⚠, then text added to existing notes, then the new notes, then links. Approve accepts them; "all except b, d" in What to fix moves those to a row of their own that waits for you; Reject archives the new notes. Contradiction, Supersede, Merge and Answer keep rows of their own. **Update Body**: a change to a kept reference (0045). **Notion Change** and **Set Field** (0.10.0, 0072): a change Ultimate Assistant suggests when you asked for a row instead of a yes in chat: a task's Status, Due, Project or Area, a project's Status, an Area's Archived (carried out in Notion once you approve), or a project's Area, an Area's Domain (spec/assistant.md §6) |
| Type | Formula on Kind: **From source** (Review Notes, Update Fact, Add To Note, Update Body, Add Link), **Conflict** (Contradiction, Supersede, Merge, New Item), **Answer** (Answer), **Suggestion** (Notion Change, Set Field; 0.10.0, 0072) | You (derived, Notion-only, 0048). The Name says the same: a Conflict row's starts with "Conflict: ", an Answer row's with "Answer: ", a From source row's with "From ", a Suggestion row's with "Suggestion: " |
| Status | Formula (0088, migration 0024), checked in this order: **Done** (State Applied), **Closed** (State Closed), **Submitted: waiting for the brain** (Decided ticked, or Your call set), **Needs you · decide in the page** (Proposed empty, or holding the pre-0.14.0 pointer "… decide each one in the page"), else **Needs you · set Your call** | Notion-only: the brain never writes or reads it. Pinned first on the page and in the Review views; Home's "What's waiting for you?" lists the rows whose Status starts with "Needs you". It moves by itself when you click Submit |
| Area | Relation → Areas (two-way with Review), limited to one page | Brain (0050): the area of the meeting or input it came from (its own Area, else its first project's), else empty. Feeds the area homes' "Review waiting" tab |
| About | Text | Brain: note title + Brain ID (for Review Notes, the meeting or source). Was Target before 0.5.0 (0045). Empty on a row with item sections (0088), like Now, Proposed and Why: the page holds them, and the layout hides each one while it is empty |
| About Page | URL | Brain: link to the Notion page affected; for Review Notes, the meeting or Inbox row it came from (was Target Page) |
| Now | Text | Brain: the current value (was Before) |
| Proposed | Text | Brain: the proposed value, or the lettered items on a row without sections (was After). Empty on a row with item sections (0088; before 0.14.0 a pointer, "3 changes: decide each one in the page") |
| Why | Text | Brain: the sentence from the source that triggered it |
| Source Meeting | Relation → Meetings | Brain |
| Your call | Select: Approve, Reject, Fix, Request revision | **You** (was Decision, with Edit; 0045). Where a Conflict, Answer or Suggestion row, or a row without sections, is decided; on a row with sections, Approve or Reject is a shortcut for the whole row (capture-and-review §7.9). Since 0.14.0 it sits at the top of the property group, not in the heading (0088). Its description carries the promise of Review, so every row shows it on hover: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed." |
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
| Kind | Select: Capture, File, Email, Chat, Note, Ask, Catch-up | System, written only when empty, so a Kind you choose stands (0048). File was Document before 0.6.0 (0049). **Ask** is yours: a question for the brain (Reports module, 0043). **Catch-up** is the summary an unattended catch-up leaves when something needs you (spec/cli.md §6.1; Kind Report before 0.9.1) |
| Summary | Text | Brain: one line on what it taught; on a row the brain skipped, why ("Skipped: same as …") |
| Decisions | Relation → Decisions (two-way with Sources) | Brain |
| Questions | Relation → Questions (two-way with Sources) | Brain |
| Documents | Relation → Documents (two-way with Sources) | Brain (was References, 0045, 0049) |
| People | Relation → People (two-way with Sources) | Brain |
| Project | Relation → Projects (two-way with Inbox) | You: set it on a capture and the ingest uses it without asking (brain fills if empty) |
| Area | Relation → Areas (two-way with Inbox) | You (brain fills if empty) |
| Brain Status | Select: New, Ready, Done | You set Ready ("take it in"); the brain sets Done when it has taken the row in, or skipped it. **A catch-up takes in only Ready rows** (0048) |
| Document asked | Checkbox | You, through the Keep as document button: "waiting for the brain". The brain keeps the input as a Document and clears it (0049) |
| Only keep | Text | You: when only part should be kept ("the requirements table and the deadlines"). Empty = the whole input (0049; was Keep) |
| Report | Relation → Documents (two-way with Asked in) | Brain: on an Ask row, the report that answers it (Notion fills it from the report's Asked in; a relation within the Inbox before 0.9.1, 0071) |
| Tasks | Relation → Tasks (two-way with Source) | You |
| Brain ID | Text | System (the source's id, `src-…`) |
| Last Synced | Date (with time) | System |
| Created | Created time | System |

**Retired in 0.6.0 (0048, 0049):** Full text (Keep as document replaces it), Refresh report (an Ask row is always a new report), and the Brain Status options Processed (now Done) and Skipped (rows moved to Done). Migration 0010 leaves the two old properties unused for you to delete.

**Retired in 0.9.1 (0071):** reports move to Documents, so the Inbox loses the Kind Report (Catch-up replaces it for the unattended summary), the Ask relation, the Update and Accept buttons, Refresh asked, What to fix, Accepted and Accepted at. Migration 0019 moves the Report rows and leaves these properties unused for you to delete.

Decisions, Questions, Documents and People together are **Produced**: the notes the brain made from this input. The page body is yours on a capture and on an Ask row. On a row the brain creates, the body is a digest written once: what the input is, its summary, the key points by section and the figures and dates as stated. To read a whole file in Notion, click **Keep as document**: the next catch-up writes it as a Document, linked here and to its project (0049).

**Ask and Report (0043, Reports module):** add a row with Kind = Ask and your question as its Name ("Everything about the Acme launch since August"). The next catch-up answers it with a new **Document**, Origin Report, linked to your Ask row, which becomes Done (0071: reports live in Documents, §3.14; before 0.9.1 the report was an Inbox row of Kind Report). The report has Where it stands, Timeline (oldest first, each line linked), Decisions in force, Open questions and risks, People involved, and Gaps; lines resting on notes you haven't reviewed are marked *(not reviewed)*. A report is **living** (0045): one per subject, shown on the project and area pages under "Reports". On its page in Documents, click **Refresh report** for a proposed refresh, or tick **Refresh asked** to have it rewritten with a new date; write in **What to fix** what it gets wrong. It is never ingested back. The brain doesn't read Inbox rows back except to take in Ready rows and act on the buttons, so an edit to Summary or Produced stays in Notion until the brain's own value changes.

### 3.12 Tasks (default, only if you have no tasks system)
Minimal, so the brain can send action items (0018). If you already have a tasks database, skip it and map yours in `brain.json`. Add Won't Do by hand in the Complete group (verified by hand only, T8: the API cannot do it); for an external database map the existing closed-without-doing option instead. On upgrade, replace the old numeric Task Progress rollup with the text formula and update due views in migration 0013 (CC-81); custom numeric filters or sorts on the old rollup need adjustment.

| Property | Type | Notes |
|---|---|---|
| Name | Title | |
| Status | Status: To Do, Doing, Waiting On, Someday, Done, Won't Do | The brain sets `new_task_status` on create and never reads it back. Waiting On and Someday sit in any group except Complete and are Notion-only |
| Due | Date | |
| Project | Relation → Projects | |
| Area | Relation → Areas | |
| Meeting | Relation → Meetings | The backlink for action items |
| Source | Relation → Inbox | The backlink for your action items from documents, emails, chats, notes and captures (0037) |
| Brain ID | Text | Set when the brain created it |
| Last edited time | Last edited time | System (Notion fills it; groups the Done tab by week) |

### 3.13 Concepts (retired in 0.9.1)
Concepts were ideas, methods and definitions the brain learned (0037). Since 0.9.1 they are **learned Documents** (§3.14, decision 0071): the database is retired, and migration 0018 moves its rows to Documents and trashes it after your yes.

### 3.14 Documents
Pages you keep to read and link from anywhere (0049; the References database of 0045, renamed with its id, relations and views), what the brain learned and the brain's reports (0071). Created by the brain only, in these ways:
- **Keep as document** on an Inbox row, with Only keep empty: the input's **whole text**, verbatim. It needs no Review and arrives Reviewed.
- **Keep as document** with **Only keep** filled in: only that part, chosen by the brain. It comes as an item in that input's Review row and gets its page when you approve it (0071).
- **Learned** (0071; a concept before 0.9.1): an idea, method or definition the brain learned from an input, in its own words. It comes as an item in that input's Review row and gets its page when you approve it.
- **Promote to document** on a decision: a page seeded from it, linked to it. From then on its body is **yours**; the brain never rewrites it.
- **A report** (Reports module, 0071): the answer to an Ask row on the Inbox, one per subject, rewritten in place when you ask for a refresh. It is the brain's summary of what it knows, lines resting on notes you haven't reviewed marked *(not reviewed)*; it is never reviewed, has no Lifecycle and is never ingested back (0043, 0057).

A new version of a kept file proposes the changed lines to its Documents (Kind Update Body in Review).

| Property | Type | Owner |
|---|---|---|
| Project | Relation → Projects (two-way with Documents) | Brain |
| Area | Relation → Areas (two-way with Documents) | Brain |
| Sources | Relation → Inbox (two-way with Documents) | Brain (filled from the Inbox side) |
| Origin | Select: Kept, Learned, Report, Promoted, Workflow | Brain (0071): Kept for a `whole` or `part` Document, Learned for a `learned` one |
| From decision | Relation → Decisions (two-way with Documents) | Brain: on a promoted Document |
| Origin | Select: Kept, Learned, Report, Promoted, Workflow | Brain (0071): Kept for a whole or part Document, Learned for what the brain learned, Report for a report, Promoted, Workflow. Groups the Documents views; never read back |
| Asked in | Relation → Inbox (two-way with Report) | Brain: on a report, the Ask rows it answers (0071) |
| Update | Button labelled **Refresh report**: sends a message to Brain Assistant (§3.17) | You, on a report (Reports module) |
| Refresh asked | Checkbox | You, on a report, ticked by hand: rewrite the report with what the brain knows now; the brain clears it (0045) |
| What to fix | Text | You, on a report: what it gets wrong; the brain turns it into Review rows, clears it, and refreshes the report once you approve them (0045) |
| Created time | Created time | System (Notion fills it) |
| Last edited time | Last edited time | System (Notion fills it; sorts "What did we keep?") |

Plus the common properties (a report leaves Summary and Lifecycle empty). Page body: the kept text (brain-written), on a promoted Document yours after the first write, on a report the brain's six sections (Where it stands, Timeline, Decisions in force, Open questions and risks, People involved, Gaps). Accepted, Accepted at and the **Accept** button are in §3.17.

### 3.15 Buttons and page layouts (0048)

**Every action you ask of the brain is a button** at the top of the row's page. The API can't see a click, so each button ticks a checkbox on the same row, which shows in the property group as "waiting for the brain"; the brain unticks it once it has acted. The Notion API can't create button properties (they are response-only in its schema), so buttons are always added by hand.

| Button property | Label | Database | Ticks | Also | Module |
|---|---|---|---|---|---|
| Keep | Keep as document | Inbox | Document asked | sets Brain Status to Ready | Documents |
| Update | Refresh report | Documents (reports; the Inbox's Report rows before 0.9.1, 0071) | none: Send message to Brain Assistant (0.8.0, §3.17) | — | Reports |
| Promote | Promote to document | Decisions | Promote asked | — | Documents |

**A button's property name and its label differ** (#144): the page layout shows the name on the left and the label on the button, so the same text would show twice. The names are short and clash with no other property (not Report, Documents or Refresh asked). The brain never reads a button, only the checkbox it ticks, so a space that names its buttons otherwise works the same. Each checkbox has its own name, because Notion can't give a button and another property the same name.

Archived and Done (on a milestone) stay checkboxes: they describe a state, not a request.

**Page layout rule.** Each database's page layout has three parts: what you act on is **pinned at the top**; what the brain wrote comes next; system fields are **collapsed**. The API can't edit page layouts, so each is set by hand (migration 0010 lists every change, database by database).

| Database | Pinned at the top | Collapsed |
|---|---|---|
| Inbox | Keep, Tidy, Brain Status, Project, Area | Brain ID, Last Synced, Created |
| Review | Status, Submit, Submit all, About Page (0088: Your call and What to fix open the property group; About, Now, Proposed and Why are set to Hide when empty) | Kind, State, Brain ID, Created time, Last edited time |
| Decisions | Promote, Lifecycle | Brain ID, Last Synced |
| Documents | Write, Update, Accept, Refresh asked, What to fix, Lifecycle, Project, Area, Sources | Origin, Brain ID, Last Synced, Created time, Last edited time |
| Areas | At a glance | Brain ID, Last Synced |
| Goals, Projects, People, Orgs, Questions, Meetings | the "You" properties of §3 | Brain ID, Last Synced, Ingested At |

**Workflow settings are not pinned** (§3.19): on Projects and Areas, Workflow, Work type, Logging level and Log artifacts sit at the end of the property group. You set them once per piece of work, usually through the setup chat.

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

**Tested (T4, 2026-11-02):** the connection returns one page-level last-edited time, no per-block times; it moved after an edit and **not after a deletion**. The rule below no longer assumes deletions are detected (decision 0062).

**Not verified yet (do not rely on these):**
- Refresh report on a Report row. The user reported (2026-10-31, not recorded in detail) that a second button test "edits the right body"; taken here as Write up on a promoted Document. Tidy capture on an Inbox row is the one with a recorded message and result.
- Whether a click runs unattended after the user leaves the page, and the credits one click uses (U-22, in the 0.8.0 acceptance run, measures them).
- Notion AI (instead of the Custom Agent) as the target. Not tested; a Custom Agent is scoped to Brain Data (0035), which Notion AI is not.

### 3.17 The three Brain Assistant buttons, Write up format and accepting wording (0054)

Added in 0.8.0 (CC-71 builds them; migration 0012). Each button follows the contract in §3.16: its message names the skill, references the row with `@`, carries the confirmation, and says what not to touch. Clicking one is a deliberate act; nothing here runs on a property change or a schedule.

| Button | On | Message asks Brain Assistant to | May edit | Never |
|---|---|---|---|---|
| **Tidy capture** | Inbox rows of Kind Capture, Brain Status **New** only (the row stays New while Brain Assistant works, so a catch-up cannot take it in half-rewritten; the user sets Ready afterwards, 0054) | rewrite the body as clear text, keeping every name, number, date, link and quote | the row's body | the Name, any property (Brain Status stays New; the user sets Ready), a Review row |
| **Write up** | Documents, **promoted** Documents only (`origin: promoted`) | develop the body from the Document and the brain pages it links in Notion | the Document's body | the original Decision, any property, a Review row, external research unless the message asks for it |
| **Refresh report** | Reports: Documents rows with Origin Report (on the Inbox before 0.9.1, 0071) | search the relevant brain pages in Notion beyond the report's current links and **append** one section "Proposed refresh · based on Notion", dated and cited | the report's body, by appending that section | the existing report text, any property, *Refresh asked* |

Keep as document and Promote to document stay checkbox buttons that the catch-up acts on (no Notion AI step). A Document only exists to Write up after the next catch-up has created it.

**Write up format.** Purpose → Main content → Open questions → Sources, as native Notion blocks: a one-line purpose in a callout, headings, concise prose and lists, linked citations, a toggle for supporting detail, open questions visible. The first Write up develops the seeded text. A **repeat** Write up keeps the user's wording and appends one block headed **Proposed revision** (a toggle, marked with that exact heading) holding the new wording; the user adopts it by editing it into the body and deleting the block, or discards it by deleting the block. A repeat **Refresh report** replaces only the previous "Proposed refresh · based on Notion" section.

**Accepting.** Documents have two properties, **Accepted** (checkbox) and **Accepted at** (date and time), and one button, **Accept** (0071: one button for a write-up and a report, which are both Documents; *Accept write-up* on Documents and *Accept refresh* on the Inbox's Report rows before 0.9.1):
- **Accept** sets Accepted to checked and Accepted at to now (a Notion button can edit these properties; no AI is involved).
- For a report, the user accepts by first moving the proposed section's text into the report body (replacing the old text) and deleting the "Proposed refresh" heading, then clicking **Accept**.
- **An unresolved Proposed revision or Proposed refresh block blocks acceptance**: a checked Accepted with such a block on the page is not imported (cli.md §5.14.7, rows 4 and 5).
- **Any edit of the page in a later minute than the click invalidates the acceptance** (an edit inside the click's own minute is the known limit of decision 0058), the user clicks Accept again. The catch-up sees `Accepted at` older than the page's last edit and lists the row under Needs you. **Deleting a paragraph is not detected** (T4, 2026-11-02: the page time did not move; decision 0062). To change an accepted text, edit it and click Accept again. The skill re-reads the page just before importing, so an edit made after the catch-up began also stops the import.
- **The catch-up shows what it will import** (the full replacement text as a diff against Git) and imports after you say yes; an unattended run imports only an acceptance at least 2 minutes old. An edit made in the same minute as your Accept click, before the first read, cannot be detected: a known limit (decision 0058).
- **After the catch-up imports the wording it unticks Accepted and clears Accepted at** (like the other request boxes): the acceptance was consumed, and a later edit is an ordinary draft, which a publish never overwrites.
- To withdraw an acceptance the user unticks Accepted.

**What Brain Assistant may edit (amends 0035).** Besides Check minutes, Tidy capture and Clean email: Write up, on the body of a promoted Document, and Refresh report, appending its proposed section to a report's body (its Documents row, 0071). Still never a property, a Review row, a Decision's page, or a brain-written section of any other page (CC-71 writes this into the Instructions).

**Where each case ends (the table in cli.md §5.14.7 is normative).** A Document or report body can be seeded, drafted by Write up, carry a pending proposal, be accepted, be edited after acceptance, or differ from Git; each has one outcome there. This section only defines the controls the user sees.

### 3.18 Domains, selected capture and editable Review (0.8.0, decision 0055)

The contract is [spec/capture-and-review.md](../spec/capture-and-review.md). For the Notion space it adds: the optional Domains database and Areas · Domain relation (§1), the Won't Do status and progress display (§2), the voice/ramble Inbox template (§3), typed `Selection:` tokens on summaries (§4), Review rows with item sections, `Decision:` tokens, the Submit decisions and Submit and accept all buttons, and the Decided, Decided at and Accept all properties (§7). The user's tests T1 to T8 (§9) ran on 2026-11-02 on synthetic pages:

- **Verified:** voice recording and transcript reading (T1); typed tokens survive edits and regeneration, though a paragraph may turn into a bulleted item (T2); a button sets two checkboxes and a date-time in one click (T3; that the time equals the click minute was not recorded); the Areas · Domain relation can be limited to 1 page, by hand (T7).
- **Anchors (T6):** 9 of 10 items passed; the repair of the failing item was not run. Notion writes straight quotes where curly were asked, adds unnumbered action items, and may merge topics into one transcript paragraph. The transcript is in the meeting block's Transcript section.
- **Per-section select (T5):** readable by an agent, but two clicks. Typed tokens remain the supported control.
- **Does not work (T4):** the page's last-edited time does not move when a block is **deleted**. The brain does not watch ingested pages for deletions (decision 0062). To change what it holds, edit the tokens and set the meeting back to Reviewed, or ask the assistant.
- **Layouts and controls (CC-81).** Review gains **Decided**, **Decided at**, **Accept all** and the Your call option **Request revision** (Fix is kept), and two buttons set by hand: **Submit decisions** (Decided → checked, Decided at → now) and **Submit and accept all** (also Accept all → checked). A Review row from a source is a page: a first-use note and the brain-owned summary at the top, then a section per change (**Creates** or **Changes**, links to the target and the source, *Current*, the toggle **Proposed final wording**, *Why it matters*, *What Accept does*, `Decision:`). The explanation of each action is page text, never hover-only help; property descriptions are the only tooltip-like help used. The Proposed property is a short pointer. Meetings gain a gray notice ("All subjects included unless marked Meeting only. Mark Reviewed to confirm."); the Inbox gains a second template **Voice note** (starts at New; the user sets Ready); the minutes and voice prompts are [notion/minutes-format.md](../notion/minutes-format.md) and [notion/voice-format.md](../notion/voice-format.md); Brain Assistant gains **Voice summary**. Domains stay optional (module off by default). Migration: [0013](../notion/migrations/0013-domains-selected-capture-editable-review.md). Rendering the new Review layout is switched by the presence of the Decided property.
- **By hand, always (T8):** the API ignores putting an option in the Complete group (it lands in To-do and sets a default option) and ignores the relation limit, both with a 200. Add Won't Do and the limit in the UI, and read back after any schema write.

### 3.19 Workflow settings on Projects and Areas (0.9.0, decision 0059)

The contract is [spec/connected-workflows.md](../spec/connected-workflows.md) §4. A Project or an Area can be the **destination** of a connected workflow: one working folder (a software repo or any folder) whose tasks and documents the brain publishes to Notion. The page that holds the settings is the destination; there is no destination property. Every space has the four properties on both databases, used or not; none needs a module, and they are not in `brain.json`: the skills read them by these fixed names, as they read a Project's Status.

| Property | Type | Options, in this order | Empty means |
|---|---|---|---|
| Workflow | Select | Standard, Connected | Standard: nothing is published. A connected workflow whose destination says Standard is paused, not deleted |
| Work type | Select | Software, General | Asked at setup. Software keeps the engineering checks; General follows clarify, plan, execute, verify and approve |
| Logging level | Select | Tasks only, Tasks + final outputs, Full durable record, Custom | Tasks + final outputs (the suggested choice) |
| Log artifacts | Multi-select | Briefs, Plans, Specifications, Decisions, Final deliverables | Nothing; read only when Logging level is Custom |

- **What each level publishes** (0059): Tasks only, the tasks and links to deliverables kept elsewhere; Tasks + final outputs, also the approved final deliverables; Full durable record, also the approved briefs, plans, specifications and decisions; Custom, the tasks and the categories ticked in Log artifacts. Drafts and logs stay local. A per-task or per-artifact exception is asked in chat and kept in the brain's records, not here.
- **Owner: you.** The brain sets them only at setup ("Connect this work to Notion?", after your yes) and sets Workflow back to Standard when you end the connection (§2). Changing one affects future work only; publishing older material is a separate request.
- **Labels** are read case-insensitively. An option that isn't in the table (one you added) is read as empty and reported.
- **No values are filled in** by the build or by migration [0015](../notion/migrations/0015-workflow-settings-on-projects-and-areas.md): every Project and Area starts as Standard.
- **What a connected workflow writes on pages:** the **Workflow** toggle on the destination, the **Work record** toggle on each of its Task pages (§2). A connected workflow needs the Tasks module with the Brain ID property mapped, and the Documents module for any level above Tasks only; setup offers what is missing once and never turns a module on silently. It adds no Tasks property and no new database, view or Review row.

## 4. Templates (contextual workspaces, Easlo pattern)

Each template is the default for its database. Every linked view sits under an H3 heading named by the question it answers, with the database title hidden, and is filtered to "this page". Where a block has tabs, they follow the record's life (now → later → done). The table is the intent; [Prompt 6](../notion/prompts/06-templates.md) is the exact definition and wins where they differ. The live snapshot is [notion/templates.md](../notion/templates.md).

| Database | Template body |
|---|---|
| Areas | **The area's home (0050).** Domain is visible when the Domains module is on. "Brief" toggle heading (brain-written, 0041) · "What needs me here?" with tabs Today (Tasks due today or earlier, neither Done nor Won't Do) · Meetings (to review, held today or earlier) · Review waiting (Review where Area is this page and State is Pending, grouped by Type) · Inbox (where Area is this page and Brain Status is New or Ready) · "What am I working toward here?" (Goals, Active) · "What's active here?" (Projects: Active, Planned, Done) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What have we decided here?" (Decisions: Current, Superseded) · "What's still open here?" (Questions: Open questions, Open risks, Answered) · "What came in?" (Inbox where Area is this page, newest first) · "What do we know?" (tabs Decisions and Documents where Area is this page) · "Reports" (Documents where Area is this page and Origin is Report, 0045, 0071) · "My notes". People and Clients show as the "via projects" rollups in the page header (0034). Each part follows its module (§1, 0050): Today and "What's on my plate here?" with Tasks; "What am I working toward here?" with Planning; "What have we decided here?", "What's still open here?" and the Decisions tab with Knowledge; the Documents tab with Documents; "Reports" with Reports; Clients via projects with Orgs. A new area is one page from this template |
| Domains | Show Type, Areas and, when Orgs is on, Org; description and My notes. |
| Goals | "How are the key results moving?" (Key Results: Open, Done) · "Which projects serve it?" (Projects) · "My notes" |
| Projects | A muted line "The brain writes only inside its toggles: Brief and Decision log, and Workflow or Repo tasks when you connect work or link a repo. Add your own notes in My notes." (0.9.0; before it: "Brief and Decision log are written by the brain. Add your own notes in My notes.") · "Brief" toggle heading (brain-written) · "Decision log" toggle heading (brain-written) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What's still open here?" (Questions, Open) · "Who's involved?" (People) · "What came in?" (Inbox where Project is this page, newest first) · "What do we know?" (tabs Decisions and Documents where Project is this page) · "Reports" (Documents where Project is this page and Origin is Report, sorted by Created time descending, 0045, #137, 0071) · "My notes". Parts follow their modules as on Areas. A project the brain publishes is created from this default template through the API (0068), so it must stay the Projects default; a space without one falls back to **New project** |
| Meetings | Unchanged from the hand-reworked template (see notion/templates.md): "Before marking Reviewed" checklist callout, ending with the gray line "Check the minutes, fix them, then set Brain Status to Reviewed. Fixed them after the brain took them in? Set Reviewed again: it reads only what changed." (0045) · Notion AI meeting notes block · "My notes" · toggles Decisions, Questions, Tasks |
| People | "Which meetings were they in?" (Meetings: Upcoming, Past) · "What are they working on?" (Projects) · "My notes" |
| Orgs | "Who works there?" (People) · "Which projects?" (Projects) · "My notes". Meetings show as the "Meetings via projects" rollup in the page header |
| Decisions | (brain-generated body) · "Superseded by" callout when present |
| Documents | (brain-written body, or yours on a promoted Document); no template needed |
| Inbox | None: a capture's body is yours, and the brain writes the body of the rows it creates (§3.11) |

No template creates the Workflow, Work record or `Repo tasks · <repo>` toggles: the skills append them to the pages that need them (§2).

No template uses a callout to show a property: a callout can't display one, and the page layout already shows it.

---

## 5. Layout (hub-and-spoke)

```text
Ultimate Brain                ← top page: the "Start here" callout (§10), then the pages below;
                                 in the published template, also the System callout (below)
Home                          ← hub: my day, quick capture, "needs you"
├── Tasks                     ← Space
├── Meetings                  ← Space
├── Projects                  ← Space
├── Plan                      ← Space
├── Review                    ← Space
├── Knowledge                 ← Space
└── (backend, never navigated)
    ├── Brain Data            ← the databases of Core and your modules
    └── System                ← synced nav, Archive, How it works, Skills. In the published template
                                 (0085) System is not a page: it is a callout on the top page
                                 holding the links to Brain Data, Archive, How it works and Skills,
                                 and the Template version line (§10)
```

Each Space: the synced Spaces navigation in a narrow left column, then one tabs block whose tabs hold the linked views (Knowledge: one tab per database, each holding one linked view with several views). Views are named by the question they answer; tab labels are short. Each view shows what you need to act on from that view, usually 2–4 properties; everything else is on the page.

| Space | Job | Tabs (view) |
|---|---|---|
| **Home** | Start of day: your areas, then your work | With Domains on, group the Areas tab by Domain, including No domain. Left: navigation, then "Needs you": a muted line "Start here: approving makes the brain's notes trusted." and "What's waiting for you?" (Review rows whose **Status** starts with "Needs you", grouped by **Type** with counts, 0048, 0088) and "Which minutes need review?" (Meetings, Not Reviewed, held today or earlier), 5 rows each. Right: buttons Quick capture (→ Inbox, Kind Capture, Brain Status **Ready**, 0048), Ask the brain (→ Inbox, Kind Ask, Brain Status New; Reports module), New meeting, New project; then "What's on today?" with tabs **Areas** (one line per area, 0050: a linked view of Areas, not Archived, showing Name and At a glance, e.g. "Day job · 3 to review · 1 meeting · 2 due"; below it "What's due across areas?", Tasks due today or overdue, Tasks module; #143, decision 0053) · Tasks (due today or overdue; Tasks module) · Meetings (today) · Projects (Active) · **Inbox** ("What's in my inbox?": New or Ready, oldest first, showing Name, Kind, Brain Status; #146); then "What did the brain take in?" (the Brain feed, 0043) with tabs Came in (Inbox, Done, newest first, 10 rows) · Meetings (Brain Status Ingested, newest Ingested At first, 10 rows) |
| **Tasks** (Tasks module) | Do the work | Today · Upcoming (by day) · No date · Waiting On · Someday · Done (by week) |
| **Meetings** | Prepare, review minutes, track ingestion | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Run projects | Active (board by Status) · By area · Deadlines (timeline) · Gone quiet |
| **Plan** (Planning module) | Areas → goals → key results → projects | Goals · Key results (by goal) · Areas (the way into each Area page) · Projects by goal |
| **Review** | Decide on proposals | A muted line above the views: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. Status says what each row needs. Needs you · decide in the page: open the row, type your decision on each change's Decision line and click Submit decisions. Needs you · set Your call: pick Approve or Reject, or Fix and say what's wrong in What to fix." (0043, 0045, 0088). A decided row leaves Review 30 days after the decision; the brain keeps it in Git (0045) · Needs my decision (Status first, then a Type column: From source, Conflict, Answer, Suggestion; Kind hidden in every view, 0048, 0088) · Sources disagree · Approved recently · Rejected. Review stays one queue for every area; each area home has its own "Review waiting" tab (0050) |
| **Knowledge** | Navigate what the brain knows | Decisions (Recent, Current, Provisional, Superseded, Disputed) · Questions (Open questions, Open risks, Answered) · Documents (What did we keep?, 0045, 0049; What did we learn?, 0071) · People (by org, Disputed) · Orgs (Clients, Others) · Inbox (What came in?: Done, newest first; the rows still waiting are Home's Inbox tab). Each tab follows its module |
| **Archive** (linked from System) | Find what's finished | One tab per database of your modules: Projects (Done or Archived) · Goals (Achieved, Dropped or Archived) · Areas · Decisions · Questions · Documents · People · Orgs (Archived) |

Every view, with its filters, sort and properties, is in [notion/views-guide.md](../notion/views-guide.md) and Prompts 7a–7h.

**Brain Assistant** is a Notion Custom Agent for daily use ([notion/brain-assistant.md](../notion/brain-assistant.md)): Instructions with the rules, and eleven skills (Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Voice summary, Clean email, Write up, Refresh report). Its Tools and access hold only Brain Data, How it works and its skills database, **Skills** (on System, one page per skill; a space built before 0.14.0 keeps it wherever it was made, under its name then, "Brain Assistant Skills": nothing depends on the name, 0085), so same-named databases elsewhere in the workspace can't be confused. It reads and answers; only Check minutes, Tidy capture, Voice summary, Clean email, Write up and Refresh report may edit (the last two from their buttons, §3.17), and only the page text you own (0035, 0045). How-to questions are answered from the "How it works" page, a copy of the user guide (the brain-howto skill's [references/guide.md](../.agents/skills/brain-howto/references/guide.md)).

---

## 6. Notion AI build prompts

A new user duplicates the published template instead (§10, 0078 §1); the prompts stay for building the template itself, for anyone who prefers to build, and as the reference the migrations bring older spaces up to. They live in [notion/prompts/](../notion/prompts/), each with its **Verify** list. Run them in the order of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one per message, on a new empty teamspace page. They are written so Notion AI does not invent extra properties.

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
| 9 | [Brain Assistant's skills and the guide](../notion/prompts/09-assistant-and-guide.md) | the Skills database (Brain Assistant's skills) on System with its skills, and How it works filled from the guide |

When this design changes, update the matching prompt file in the same change (decision 0022). Spaces that already exist get a migration in [notion/migrations/](../notion/migrations/), written by the `brain-notion-change` skill.

### After building
See "After building" in [notion/CHECKLIST.md](../notion/CHECKLIST.md): connect the brain to Notion, map your Tasks database (0018), verify the live space (0022), set up Brain Assistant and paste the minutes prompt.

---

## 7. `brain.json` Notion section (shape)

```json
{
  "modules": { "domains": false, "knowledge": true, "orgs": true, "documents": false, "reports": false, "tasks": true, "planning": false },
  "notion": {
    "databases": {
      "domains": "<id>", "areas": "<id>", "goals": "<id>", "key_results": "<id>", "projects": "<id>",
      "meetings": "<id>", "people": "<id>", "orgs": "<id>", "decisions": "<id>",
      "questions": "<id>", "review": "<id>", "inbox": "<id>", "documents": "<id>"
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

The text lives in [notion/minutes-format.md](../notion/minutes-format.md). It gives every summary the same shape: Attendees, Projects, the overview (Highlights, Quick follow-ups, Tasks), then one section per subject with ids and quotes (0055; before it, 0043's eleven headings). Since 0.9.0 the owner's actions are split into **Quick follow-ups**, to-do checkboxes that stay in Notion, and **Tasks**, each with an editable **Scope** toggle (Done when, Due, Project, Notes) that the ingest carries into the Notion task (0067; pasting it: [notion/pasting-the-minutes-prompt.md](../notion/pasting-the-minutes-prompt.md)). Consistent minutes make the ingest more accurate (0024). Paste it into Notion AI when you ask it to summarise a meeting, or use it to check minutes against the "Minutes follow the format" item of the checklist. The Meetings template (reworked by hand on 2026-10-13) no longer holds it in a callout; on 2026-10-14 we chose to keep that template as it is.

**Lean minutes (0079, 0.14.0).** The prompt then writes a readable part (In one line, Quick follow-ups each with a `q` id, Tasks for the brain, one lean block per subject) and a collapsed **For the brain** toggle (Attendees, Projects, each subject's `Selection:` line, the id → quote list); a quick follow-up still unticked when the meeting is marked Reviewed becomes a Task. The text, Check minutes and the paste guide are CC-197's (spec/capture-and-review.md defines the shape). The Meetings database doesn't change; the default template's gray line under the notice now says to tick the quick follow-ups you've done before Reviewed, and that `Meeting only` goes in the For the brain toggle (on a subject's Selection line or at the start of an item's quote line), since on a summary line it blocks the meeting ([Prompt 6](../notion/prompts/06-templates.md); [migration 0023](../notion/migrations/0023-lean-minutes.md) for existing spaces, with Check minutes and the prompt). The published template (§10) doesn't carry the prompt: setup walks the user through pasting it and checks it (spec/setup.md §6.3), and the template's Skills database holds 0079's Check minutes. If the test duplicate shows the prompt can live inside the Meetings template (0078 §2, CC-193), this section and §10 change to carry it.

## 10. The published Notion template (0078 §1)

A new user **duplicates a published template** instead of building from the prompts. It is a **copy of the author's own space, emptied and scrubbed**, in the author's one workspace (0084, amending 0078 §1), with **every module** (§1) and **`Example · ` rows in every database on Brain Data** that show a filled space (fifteen, from one story and related to each other: 0084's Domain, Area, Project, Person, Org, Meeting and Task, and 0087's Inbox capture, Decision, Question, Document, Review row, Goal, Key Result and second Task), with a callout at the top of Brain Data saying they are examples, and published with duplication allowed. Setup removes the Example rows when it connects the brain, and the skills that read Notion never take one in (spec/setup.md §6.5). Its link and version are kept once, in [notion/TEMPLATE.md](../notion/TEMPLATE.md), which also lists what a duplicate contains, the steps it still needs and how the copy is emptied and scrubbed; the README, docs/setup.md and the `brain-setup` skill take them from there (spec/setup.md §6.2). Two templates exist, and user-facing text names them apart: the **brain folder** (`templates/brain/`, the Git repository `brain init` creates) and the **Notion template**.

What the template has beyond a space built from the prompts:

| Part | Where | Exact form | In the prompts? |
|---|---|---|---|
| **Start here** callout | the top page "Ultimate Brain", first block, above the pages | A callout (Notion's default icon), two lines. Line 1, bold: **Start here.** Line 2: "This is the Notion half of Ultimate Brain. Next: install Ultimate Brain, and in your brain folder tell your agent "set up my brain". Get started shows every step." "Get started" links to the **Get started** section of the product README on GitHub (`#get-started`; the repository's address is `package.json` `repository`, CC-192) | yes: [Prompt 1](../notion/prompts/01-pages.md) writes it with "Get started" as plain text; the link is added by hand |
| **Template version** line | the **System callout** on the top page "Ultimate Brain" (0085: in the template, System is a callout holding the links to Brain Data, Archive, How it works and Skills) | One line of its own inside that callout (a block, or a line after a line break in the callout's text block; inline-code formatting or none, spec/setup.md §9), exactly `Template version: NNNN`: the four-digit number of the last migration in [notion/migrations/](../notion/migrations/) the template includes (spec/setup.md §9). Nothing else on that line | **no**: a space built from the prompts has no line, so its version is unknown, never guessed (spec/setup.md §2 step 4, §9) |
| **How it works** filled | How it works, linked from the System callout | The user guide, the brain-howto skill's [references/guide.md](../.agents/skills/brain-howto/references/guide.md), as of the release the template is built from | yes: [Prompt 9](../notion/prompts/09-assistant-and-guide.md) |
| **Skills** (Brain Assistant's skills) with its eleven skills | Skills, linked from the System callout | Name (title) and Description (text); one page per skill of [notion/brain-assistant.md](../notion/brain-assistant.md) "Skills": the name is the title, its Description line goes in Description, its text block is the page body | yes: [Prompt 9](../notion/prompts/09-assistant-and-guide.md) |

**What a duplicate can't carry:** the agent's Notion connection (MCP), the brain's connection to the databases, the minutes prompt (§9) and Brain Assistant itself (a Custom Agent, or personal Instructions on a plan without them, given access to the duplicate's Brain Data, How it works and Skills). Setup walks through and checks each one (spec/setup.md §2 steps 3–4b). The test duplicate (0078 §5, CC-193) records what survives duplication: the Custom Agent and its access, the buttons that message it, relations and the Home buttons; notion/TEMPLATE.md gets the result.

**Modules in a duplicate.** The template holds every module's databases and page parts. The brain uses the modules `brain.json` turns on (a new brain: Knowledge, Orgs, Documents, Reports and Tasks; Domains after seeding; spec/schema.md §12); the parts of a module that is off stay in the duplicate, unused, as the Domains database does with its module off (0065). Turning one on later needs no Notion step beyond connecting it, since its databases exist.

**Keeping it current (0022).** The template follows this design like any space: when a release adds a migration, the migration is applied to the template copy, its last step updates the Template version line in the System callout, and notion/TEMPLATE.md's version changes in the same release. A duplicate made earlier is brought up to date by the migrations `brain upgrade` names (spec/cli.md §5.15).
