# Notion Space Design (v1)

**Status:** Proposed design, ready to build with Notion AI. Not built.
**Date:** 2026-10-11
**Built from:** [hub-and-spoke pattern](notion-space-architecture.md), [Easlo vs Ultimate Brain comparison](notion-second-brain-template-comparison.md), [Easlo appendix](easlo-second-brain-factual-architecture-appendix.md), [Ultimate Brain appendix](ultimate-brain-for-notion-factual-architecture-appendix.md), [synthesis](../synthesis/synthesis.md), decisions 0003, 0005, 0007, 0011, 0012, 0015, 0018–0021; updated for 0041–0045 and 0048–0050, and for 0078 (the published Notion template, §10).

---

## 1. What this space is for

**Design review (0104):** apply [the product principles](design-principles.md), especially database reuse and minimal user effort. Before adding a database, the agent reviews the use case against the existing inventory in the feature-planning session and records why none fits if an addition is essential. Define changed ownership and crossings in §2 and the existing lifecycle contracts before implementation.

Notion is the **human side** of the brain. You use it to:

1. **Review meeting minutes** and mark them ready for the brain.
2. **See what needs your decision**: the weekly review's Inbox row lists it. From 0.17.0 you tick its Actions and clean-up items there and set the row Ready, and the next catch-up applies them ([0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §4); every other decision is made in the agent session: say "what needs my decision" in Claude Code or Codex ([0096](../decisions/0096-one-place-to-decide.md)).
3. **Plan**: areas, goals, key results, projects.
4. **Navigate** what the brain knows: projects, people, clients, decisions, open questions.
5. **Capture** quick thoughts and create new projects, goals, people.

The Markdown brain stays canonical (vision). Notion shows curated knowledge, collects your decisions, and owns operational fields (status, progress, dates).

### Modules (0048)

A space is a **core** plus the **modules** you chose at onboarding. You can turn one on or off later by asking your agent ("turn on documents"); turning one off deletes nothing (spec/schema.md §12).

| Module | Databases | What it adds to the Spaces and templates | Default |
|---|---|---|---|
| **Core** | Inbox, Meetings, Projects, Areas, People | Home, Meetings, Projects; the Inbox tab of Knowledge; area homes' Meetings and Inbox tabs | always on |
| **Domains** | Domains (in every space, 0065) | group Areas by work or life context; Areas can have one Domain or none. The database, Areas · Domain and the Domain rollups on Projects, Meetings and Documents (0.16.1, 0105) exist with the module off; the module decides whether the brain uses them and whether pages show them | off |
| ~~Knowledge~~ | retired in 0.16.0 ([0099](../decisions/0099-notion-without-decisions-and-questions.md)): its Decisions and Questions databases are archived (Concepts went in 0.9.1, 0071). Decisions and questions are notes in Git, shown on project and area pages (the Brief and Decision log toggles) and in reports | — | — |
| **Orgs** | Orgs | the Orgs tab of Knowledge; Client on Projects, Org on People; "Clients via projects" on area pages | on |
| **Documents** | Documents (was References), learned ones included (0071) | the Documents tab of Knowledge and of "What do we know?"; Keep as document and Only keep on the Inbox; tasks kept as documents, with Documents · Task (0100) | off |
| **Reports** | Documents (shared; Reports needs the Documents module on, 0071): a report is a Documents row with Origin Report; Ask rows on the Inbox | the Ask the brain button on Home; the Refresh report button (a Notion Brain Assistant message, §3.17), Refresh asked and What to fix on a report's Documents row; "Reports" on project and area pages | off |
| **Tasks** | Tasks, or your own tasks database (0018) | the Tasks Space, with its Questions and Risks tabs (Kind, 0099); Document asked and the Keep as document button on Tasks, acted on with Documents on (0100); "What's on my plate here?" on project and area pages; Home's "What's on today?" Tasks tab, its "due" counts and "Due across areas" | off |
| **Planning** | Goals, Key Results | the Plan Space; Goal on Projects; "What am I working toward here?" on area pages | off |

A part of a page that belongs to a module that is off is left out, and nothing replaces it (0050). The build prompts create only the chosen modules, except the Domains database, its relations and the Domain rollups, which every space has (0065, 0105); each module's own steps, for turning it on later, are in [notion/modules/](../notion/modules/).

### What we borrow from each template

| From | Pattern | Where it shows up |
|---|---|---|
| Easlo | Dedicated meeting records with action items | Meetings database and its template |
| Easlo | Separate record types where needed | Existing databases are reused first; additions follow the design review above |
| Easlo | Goals + Key Results (numeric) | Goals, Key Results |
| Easlo | Entity pages as contextual workspaces | Templates for Project, Goal, Area, Person, Org, Meeting |
| Ultimate Brain | Milestones as tick-off steps | `Kind = Milestone` in Key Results |
| Ultimate Brain | Focused dashboards (My Day, Process, Project Hub) | Spaces with views named by the question they answer |
| Ultimate Brain | Low-friction capture, classify later | Inbox + quick-capture button on Home |
| Ultimate Brain | Cold items leave active views for review | "Gone quiet" view for projects |
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
| **Brain** | Knowledge the brain maintains | Summary, Role, Client, Deadline, Key Facts | Brain → Notion. An edit in Notion is asked in your agent session before the brain takes it: accepted, it is applied as your correction; rejected, the next publish puts the brain's value back (0023, 0027, [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §4; §8) |
| **You** | Operational fields | Status, Priority, Progress, Lifecycle, Archived, Brain status | Notion → brain as pointers; the brain never writes them |
| **System** | Bridge plumbing | Brain ID, Last synced, Created time, Last edited time | Brain → Notion only (the two timestamps are filled by Notion itself). Never edit |

**Workflow settings (0059)** on Projects and Areas (§3.19) are yours like Status, with one exception: the brain sets them when you connect a piece of work to Notion and when you end that connection, each time after your yes (spec/connected-workflows.md §3.1, §3.4). It never changes them otherwise.

**Notion Brain Assistant sets some of your fields after your yes ([0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §3, 0.17.0).** In its chat, after you say yes to the change it names with its value, Notion Brain Assistant may set these and nothing else: in Tasks, Status and Due; in Projects, Status, Priority and Dates; in Goals, Status; in Key Results, Current, Done and Due. Areas has no such field. Its Weekly review asks about the week's task items in numbered options and sets the ones you pick ("1a"). They stay your fields: the brain reads them as pointers each time and stores none of them, so nothing Notion Brain Assistant sets is knowledge. It never sets a Brain-owned or System property, a section the brain writes, Brain Status, Accepted, Document asked or Refresh asked, or a Workflow setting, and never creates a Task: asked to, it says where that is done. Its Tools and access give it edit access on those four databases for this; an edit it made to a Brain-owned value by mistake would still be asked in your session like any other (§2's Brain row, 0101 §4). A task it sets Done that tracks an open question is asked about in your next session (0101 §6).

**Creation:** new rows you create in Areas, Goals, Projects, People, Orgs are imported by the next `brain sync` (0021). Rows in Documents are created by the brain only. Decisions and questions have no rows since 0.16.0 (0099). Inbox rows come from you (Quick capture) or from the brain (every document, email, chat or note it ingests, 0037).

**Only reviewed knowledge (0071, 0.9.1).** Documents show what you trusted (and so did Decisions and Questions, until 0.16.0): a row gets its page when its note is reviewed: when you say yes to a part of an ingest, when you accept it in the agent session, or from the start, as a whole Document is ([0096](../decisions/0096-one-place-to-decide.md)). Until then the draft is only in the brain, in Git, and the session asks you about it; a draft you reject never gets a page. Relations to a draft (an Inbox row's Documents) fill in when you accept it, in the same run. People still arrive as Draft, because a meeting's Attendees needs their pages. A row that has a page keeps it, as history. Draft pages from before 0.9.1 are moved to Notion's trash after your yes (migration 0020); each comes back as a new page when you accept it. The brain in Git keeps every draft (spec/cli.md §5.14.4).

**Page bodies (0026, 0041, 0043):** the brain writes only inside named toggle headings: "Brief" and "Decision log" on project pages, "Brief" on area pages. It owns the whole body of the Documents kept from an input or learned (0071), of the Inbox rows it creates, except a Weekly row's ticks and Your note lines, which are yours (below and §3.11; a digest of what came in; "Full text" toggles written before 0.6.0 stay), and of a report's Documents row (0071). A Document promoted from a decision is seeded once, then its body is yours (0049). It publishes no body for Goals, People and Orgs, and never edits Meetings (0007), a capture you wrote or an Ask row. Everything else on a page is yours, including the **"My notes"** toggle.

**Workflow and rollup toggles (0059, 0066).** Three more brain-owned toggle headings, written by the skills and never by `sync render`; no template creates them, and the skill appends one at the end of the page the first time it writes it (drag it up once):
- **Workflow** on a Project or Area page that is the destination of a connected workflow: the dated summary of progress, what is not yet in Notion and what needs you (spec/connected-workflows.md §9).
- **Work record** on a Task page of a connected workflow, also in a mapped external Tasks database: scope, acceptance criteria, dependencies, documents and progress (spec/connected-workflows.md §6.1).
- Toggle headings named **`Repo tasks · <repo>`** on the Project or Area page where a linked repo with tasks tracked in the repo is placed: a dated, read-only rollup of those tasks, one toggle per repo (spec/linked-repos.md §4).

**The Weekly row's ticks and notes (0.17.0, [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §4; [spec/weekly-review.md](../spec/weekly-review.md) §15.7).** The body of a Weekly row is the brain's, but it is also where you decide: the **tick** of each to-do and the text after **Your note:** under it are **yours**, and so is the row's Brain Status Ready. The brain never ticks, unticks or writes a note, and every publish of the row keeps them as you left them; anything else you write in that body is overwritten by the next publish. Ready is the go: a catch-up reads the ticks only then.

Each is found by its exact name and its children replaced. Before appending one to a Project page with no toggle headings at all, the skill first appends empty **Brief** and **Decision log** toggles, so the next render finds them.

---

## 3. Databases

Up to eleven databases, all on the backend page **Brain Data**: the six of Core plus those of the modules you chose (§1): Inbox, Meetings, Projects, Areas, People, Domains, Orgs, Documents, Tasks, Goals and Key Results ([0099](../decisions/0099-notion-without-decisions-and-questions.md); Review went in 0.16.0 too, 0096). One more database, **Skills** (Notion Brain Assistant's skills; "Brain Assistant Skills" in a space built before 0.14.0, decision 0085), sits on **System**: it holds Notion Brain Assistant's skills, and the brain never reads it (§5). Naming: plural Title Case database names, Title Case property names, no emoji in property names (the agent addresses them by name through the Notion MCP).

**Common properties** on every brain-mirrored database (Areas, Goals, Projects, People, Orgs, Documents):

| Property | Type | Owner | Notes |
|---|---|---|---|
| Name | Title | Brain (you on creation) | |
| Summary | Text | Brain | ≤200 chars, from the note's `summary:` |
| Lifecycle | Select: Draft, Reviewed, Disputed, Archived | You | 0005. A new person arrives as Draft; Documents arrive once reviewed (0071, §2). **Only on People and Documents** (0070; on Decisions and Questions too, until 0.16.0): rows you create (Domains, Areas, Goals, Projects, Orgs) have none, and Archived closes them |
| Brain ID | Text | System | e.g. `prj-9x4t1b7e` (0017). Empty = not imported yet |
| Last Synced | Date (with time) | System | |

### 3.1 Areas
Ongoing responsibilities (clients, health, learning…).

| Property | Type | Owner |
|---|---|---|
| Domain | Relation → Domains, two-way with Areas, Limit: 1 page (in every space, 0065; the brain reads it with the Domains module on) | Brain; your edits are asked as corrections |
| Goals | Relation → Goals | You |
| Projects | Relation → Projects | You |
| Meetings | Relation → Meetings (two-way with Area) | Brain |
| Documents | Relation → Documents (two-way with Area) | Brain (0045, 0049) |
| Inbox | Relation → Inbox (two-way with Area) | You (brain fills if empty) |
| Tasks | Relation → Tasks (two-way with Area) | You |
| Due | Formula: the Tasks neither Done nor Won't Do with Due today or earlier, counted (Tasks module) | You (derived, Notion-only, 0050) |
| Meetings to review | Formula: the Meetings with Brain Status New and Date today or earlier, counted | You (derived, Notion-only, 0050) |
| At a glance | Formula: the two counts as one line, "1 meeting · 2 due", leaving out each count that is 0 and each module that is off, or "all clear" (#145) | You (derived, Notion-only; what Home shows next to the area's name) |
| Archived | Checkbox | You |
| People via projects | Rollup: Projects → People, show original | You (derived, Notion-only) |
| Clients via projects | Rollup: Projects → Client, show original | You (derived, Notion-only) |
| Workflow | Select: Standard, Connected. Empty = Standard (§3.19) | You (the brain sets it at workflow setup and end, with your yes) |
| Work type | Select: Software, General (§3.19) | You (as Workflow) |
| Logging level | Select: Tasks only, Tasks + final outputs, Full durable record, Custom. Empty = Tasks + final outputs (§3.19) | You (as Workflow) |
| Log artifacts | Multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables. Read only with Custom (§3.19) | You (as Workflow) |


Page body: a toggle heading **Brief** (brain-written, 0041: the area's projects, reviewed decisions, and open questions and risks), then the template's linked views and "My notes". The publish appends the toggle at the end of a page that has none; drag it to the top once. Connected work adds **Workflow**, and a linked repo with tasks tracked in the repo adds **`Repo tasks · <repo>`** (§2).

### Domains database (0055; in every space, 0065)

Every space has it, with the Domains module on or off: the module decides only whether the brain reads and publishes Domains and whether pages show them (migration 0014 adds it to an older space). Name (title) and Summary (text) are brain-owned after creation, and say what kind of context the Domain is; Archived (checkbox) is yours; no Lifecycle (0070) and no Type (0.16.1, [0105](../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) §3: Type held Personal, Entrepreneurship or Professional from 0.9.0, when it replaced Areas · Type, to 0.16.0; migration 0028 removes it after your yes). Brain ID (text) and Last Synced (date) are system fields. Areas is the inverse of Areas · Domain, limited on the Area side to one page by hand. Org is a correctable relation to Orgs, created when the space has an Orgs database; Orgs · Domains is its inverse. The Domain page shows Areas and, when enabled, Org, then lists that Domain's **Projects**, **Meetings** and **Documents** in three linked views filtered by their Domain rollup (§3.4, §3.5, §3.14, §4; 0105 §1).

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
| Domain | Rollup: Area → Domain, Show original (0.16.1, 0105 §1; in every space, hidden with the Domains module off) | Notion (derived from the Area; you never edit it, and the brain never writes or reads it) |


Page body: toggle headings **Brief** and **Decision log** (brain-written, 0026), then the template's linked views and "My notes". Connected work adds **Workflow**, and a linked repo with tasks tracked in the repo adds **`Repo tasks · <repo>`** (§2).

### 3.5 Meetings
The inbound source. Your Notion AI meeting notes live here (0012, 0007). **From 0.17.0** (0101 §8.1, spec/capture-and-review.md §3.4.1) a row holds a transcript, minutes in the format, or both, from any tool: Notion AI meeting notes, a notetaker through its Notion integration or an automation, text you paste, or a transcript file from the drop folder, which the brain makes into a row (one toggle **Transcript**, Brain Status New). A pasted transcript goes under a heading or in a toggle titled **Transcript**, so the brain can tell it from a summary. No property is added: nothing records which tool wrote a row.

| Property | Type | Owner |
|---|---|---|
| Name | Title | You |
| Date | Date | You |
| Attendees | Relation → People | You (brain fills missing ones) |
| Project | Relation → Projects | You (brain fills if empty) |
| Area | Relation → Areas | You (brain fills if empty) |
| Brain Status | Select: New, Ready, Done, Skipped; default New (0109: the Inbox's names) | You set Ready or Skipped; brain sets Done. Meetings have one extra state, Skipped, for a meeting you keep but don't want in the brain. A space built before 0.16.2 had Not Reviewed, Reviewed and Ingested: the brain reads them as New, Ready and Done, and migration 0029 renames them |
| Ingested At | Date | System |
| Tasks | Relation → Tasks (two-way with Meeting) | You |
| Domain | Rollup: Area → Domain, Show original (0.16.1, 0105 §1; in every space, hidden with the Domains module off). Empty until the meeting has an Area: the ingest sets the projects' shared Area when it is empty (spec/schema.md §4 meeting) | Notion (derived from the Area; you never edit it, and the brain never writes or reads it) |
| Brain ID | Text | System (the meeting record's id, `mtg-…`) |


The brain **never edits the meeting page body** (0007), with one exception from 0.17.0 (0101 §8.3, spec/capture-and-review.md §3.4.2): on a New page that has a transcript and no minutes in the format, the brain's agent may write the minutes, once, in the format, from the minutes prompt, after `brain minutes check` passes; it appends them below the transcript and changes nothing else on the page (no property, no other block, no Task). You review them and set the meeting Ready; nothing is read before that. Instead of publishing a second summary, it fills the relations (Attendees, Project, Area) and links the created tasks; the meeting's decisions and questions show on its project's page (0099). Your reviewed minutes stay the human summary; the brain's meeting note is for agents.

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

### 3.8 Decisions (retired in 0.16.0)

There are no Decisions or Questions databases from 0.16.0 ([0099](../decisions/0099-notion-without-decisions-and-questions.md)), and the Knowledge module that held them is retired. Decisions and questions stay notes in Git: a project's or area's reviewed decisions and its open questions and risks show in its **Brief** and **Decision log** (spec/schema.md §16), and in reports; a decision with no project or area is reached through an Ask or the agent session. A question or risk you say to follow up becomes a **Task** with Kind Question or Risk (§3.12; spec/capture-and-review.md §6.4). Promote to document is asked in the agent session (§3.14). The 0.16.0 migration ([0027](../notion/migrations/0027-one-place-to-decide.md)) reads each question's Status once (spec/cli.md §5.14.9), then archives both databases with their views and relations, adds Kind and the Questions and Risks tabs to Tasks, and removes `decisions` and `questions` from `brain.json`'s `notion.databases`; nothing is deleted. Their design up to 0.15.x is in Git history (`git show v0.15.1:docs/notion-space-design.md`).

### 3.9 Questions (retired in 0.16.0)

There is no Questions database from 0.16.0 (§3.8, [0099](../decisions/0099-notion-without-decisions-and-questions.md)): a question or risk you follow up is a Task with Kind Question or Risk (§3.12), and the Status you set on a row before is read once by the migration.

### 3.10 Review (retired in 0.16.0)

There is no Review database from 0.16.0 ([0096](../decisions/0096-one-place-to-decide.md)): proposals are decided in the agent session ([spec/capture-and-review.md](../spec/capture-and-review.md) §7). The 0.16.0 migration ([0027](../notion/migrations/0027-one-place-to-decide.md)) first applies the decisions you already made on its rows, then archives the database and its page, removes Home's "What's waiting for you?" view and the Review relations on Areas and Meetings, and removes `review` from `brain.json`'s `notion.databases`; nothing is deleted (§7.9 there). Its design up to 0.15.x is in Git history (`git show v0.15.1:docs/notion-space-design.md`).

### 3.11 Inbox
Everything that came into the brain except meetings, which have their own database (0037). Your quick captures land here as **Ready**; every document, email, chat or note the brain ingests gets a row, created as **Done**, so **History** shows what came in and what the brain learned from it.

| Property | Type | Owner |
|---|---|---|
| Name | Title | You on a capture; Brain on a row it creates |
| Keep | Button labelled **Keep as document**: ticks Document asked and sets Brain Status to Ready | You (Documents module, 0048, 0049) |
| Kind | Select: Capture, File, Email, Chat, Note, Ask, Catch-up, Weekly, Changed | System, written only when empty, so a Kind you choose stands (0048). File was Document before 0.6.0 (0049). **Changed** is a checked row: a changed version of a document, written for you to check before it goes in (0.16.0, [0098](../decisions/0098-agree-by-subject-and-check-a-changed-document.md) §4; below). **Ask** is yours: a question for the brain (Reports module, 0043). **Catch-up** is the summary an unattended catch-up leaves when something needs you (spec/cli.md §6.1; Kind Report before 0.9.1). **Weekly** is the week's review (0.16.0, [0096](../decisions/0096-one-place-to-decide.md); below) |
| Summary | Text | Brain: one line on what it taught; on a row the brain skipped, why ("Skipped: same as …") |
| Documents | Relation → Documents (two-way with Sources) | Brain (was References, 0045, 0049) |
| People | Relation → People (two-way with Sources) | Brain |
| Project | Relation → Projects (two-way with Inbox) | You: set it on a capture and the ingest uses it without asking (brain fills if empty) |
| Area | Relation → Areas (two-way with Inbox) | You (brain fills if empty) |
| Brain Status | Select: New, Ready, Done | You set Ready ("take it in"); the brain sets Done when it has taken the row in, or skipped it. **A catch-up takes in only Ready rows** (0048) |
| Document asked | Checkbox | You, through the Keep as document button: "waiting for the brain". The brain keeps the input as a Document and clears it (0049) |
| Only keep | Text | You: when only part should be kept ("the requirements table and the deadlines"). Empty = the whole input (0049; was Keep). Filled, the part is written as a checked row for you to check first, and only that part goes in (0098 §4) |
| Changed from | Relation → Inbox (one-way) | Brain, on a checked row: the original input's row (for an attached file, its row). Written once, when the brain creates the row (0098 §4) |
| What changed | Text | Brain, on a checked row: what the change dropped or altered, one line each (`Dropped: …`, `Altered: …`; a first `File: …` line for an attached file). Written once; the brain stores it with the row when it takes it in (0098 §5) |
| Report | Relation → Documents (two-way with Asked in) | Brain: on an Ask row, the report that answers it (Notion fills it from the report's Asked in; a relation within the Inbox before 0.9.1, 0071) |
| Tasks | Relation → Tasks (two-way with Source) | You |
| Brain ID | Text | System (the source's id, `src-…`) |
| Last Synced | Date (with time) | System |
| Created | Created time | System |


**The weekly review (Kind Weekly, 0.16.0, [0096](../decisions/0096-one-place-to-decide.md); [spec/weekly-review.md](../spec/weekly-review.md)).** The brain writes one row per ISO week: Name `Week of <D Mon YYYY>` (the Monday), Brain ID the weekly report's id, the page body the report itself. A rerun in the same week updates that row. It is never taken in as an input, and it needs neither the Documents nor the Reports module. Until 0.17.0 it arrived with Brain Status **New** and the brain set it **Done** once every proposal its decisions named was decided in Claude Code or Codex.

**From 0.17.0 ([0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §1 to §5; spec/weekly-review.md §3, §15).** Same row, same Kind, no new property, option or database. Its body has two parts:
- **Your week:** In short, Highlights (at most 6), Done this week, **Actions** (at most 5 to-dos, each `A1 · <what the brain will do on your tick>`), Focus first, and **Waiting for you** (how many decisions wait in the session: say "what needs my decision" in Claude Code or Codex).
- **Clean-up:** **Already cleaned** (what the run did alone, each a to-do `U1 · … · tick to undo`), then **For you to tick** (at most 10 to-dos `C1 · <the change> · recommended: …`).
- Under each Action and each clean-up item to tick: a toggle **Show the change** with the before and after, and a line **Your note:**, empty.

You tick what you agree with, write on an item's Your note line to change it, then set the row's Brain Status to **Ready**. The next catch-up, scheduled or not, applies each plain tick after checking nothing changed since (a changed item is not applied and is named in its report), leaves an item with a note for a catch-up in Claude Code or Codex with you, and declines an item left unticked. Brain Status: **New** when written, **Ready** when you say so, **Done** when nothing in it waits. A row you never set Ready hands its items to next week's row, which says where they went.

**Notion steps for the weekly row (CC-368, CC-372):** none to the schema: no property, option, view or database changes, since the row is an Inbox row of Kind Weekly with Brain Status New, Ready and Done, all of which exist. Only text changes, as by-hand steps with read-back checks in 0.17.0's one Notion migration, [0030](../notion/migrations/0030-your-fields-after-your-yes-the-path-without-notion-ai-and-the-weekly-row.md)'s part D, applied to the published template's copy as to every space: (1) Notion Brain Assistant's **Weekly review** skill ([notion/brain-assistant.md](../notion/brain-assistant.md); spec/weekly-review.md §13), kept by the author's answer of 2026-11-20 as an optional companion with the same name: Claude Code or Codex writes the row and does its clean-up, and the skill only reads it; it reads the two parts with you, item by item, decides nothing, never ticks, unticks, writes a Your note line or sets Brain Status, ends with "tick, write on Your note to change, then set Ready", and asks about the tasks Focus first names in CC-325's numbered rounds with no option marked as a suggestion (the author's answer of 2026-11-20); a row written before 0.17.0 is read as before; (2) the **Instructions' line on Weekly rows** (it never ticks, unticks or writes a Your note line, and never sets a Weekly row's Brain Status) and the two Instructions' passages and Today's step 3 that said every decision is made in the session; (3) **How it works**, republished from 0.17.0's skills release (brain-howto's guide, CC-371). The template's Start here and First things first don't describe the Weekly row and don't change for it; the views guide ("The weekly row") is this repository's text, not a page in the space.

**A checked row (Kind Changed, 0.16.0, [0098](../decisions/0098-agree-by-subject-and-check-a-changed-document.md) §4 to §7; [spec/capture-and-review.md](../spec/capture-and-review.md) §12).** When you ask in the agent session for a document to be changed before it goes in ("keep only the requirements", "the depot count is 11, not 9"), or click Keep as document with Only keep filled, the brain records the original as a source (its row goes to Done, nothing taken in from it) and writes the changed text to a new row: Kind Changed, Changed from the original's row, What changed, Brain Status **New**, and Document asked ticked when it is to be kept as a Document. Read it, edit its body if you want, then say **go** in the session, or set it **Ready** for the next catch-up. On go, the session takes it in by subject and asks you as usual; on Ready, a catch-up without you takes it in with its notes `draft` and its questions waiting for your next session: Ready approves the text, not the notes. What it adds cites this row, and the original stays linked. Meetings and captures don't get one: they have Check minutes and Tidy capture.

**Retired in 0.6.0 (0048, 0049):** Full text (Keep as document replaces it), Refresh report (an Ask row is always a new report), and the Brain Status options Processed (now Done) and Skipped (rows moved to Done). Migration 0010 leaves the two old properties unused for you to delete.

**Retired in 0.9.1 (0071):** reports move to Documents, so the Inbox loses the Kind Report (Catch-up replaces it for the unattended summary), the Ask relation, the Update and Accept buttons, Refresh asked, What to fix, Accepted and Accepted at. Migration 0019 moves the Report rows and leaves these properties unused for you to delete.

Documents and People together are **Produced** (Decisions and Questions too, until 0.16.0): the notes the brain made from this input. The page body is yours on a capture and on an Ask row. On a row the brain creates, the body is a digest written once: what the input is, its summary, the key points by section and the figures and dates as stated. To read a whole file in Notion, click **Keep as document**: the next catch-up writes it as a Document, linked here and to its project (0049).

**Ask and Report (0043, Reports module):** add a row with Kind = Ask and your question as its Name ("Everything about the Acme launch since August"). The next catch-up answers it with a new **Document**, Origin Report, linked to your Ask row, which becomes Done (0071: reports live in Documents, §3.14; before 0.9.1 the report was an Inbox row of Kind Report). The report has Where it stands, Timeline (oldest first, each line linked), Decisions in force, Open questions and risks, People involved, and Gaps; lines resting on notes you haven't reviewed are marked *(not reviewed)*. A report is **living** (0045): one per subject, shown on the project and area pages under "Reports". On its page in Documents, click **Refresh report** for a proposed refresh, or tick **Refresh asked** to have it rewritten with a new date; write in **What to fix** what it gets wrong. It is never ingested back. The brain doesn't read Inbox rows back except to take in Ready rows and act on the buttons, so an edit to Summary or Produced stays in Notion until the brain's own value changes.

### 3.12 Tasks (default, only if you have no tasks system)
Minimal, so the brain can send action items (0018). If you already have a tasks database, skip it and map yours in `brain.json`. Add Won't Do by hand in the Complete group (verified by hand only, T8: the API cannot do it); for an external database map the existing closed-without-doing option instead. On upgrade, replace the old numeric Task Progress rollup with the text formula and update due views in migration 0013 (CC-81); custom numeric filters or sorts on the old rollup need adjustment.

| Property | Type | Notes |
|---|---|---|
| Name | Title | |
| Status | Status: To Do, Doing, Waiting On, Someday, Done, Won't Do | The brain sets `new_task_status` on create. It reads a status back only on a task that tracks an open question, and asks you in the session when that task is finished, in the trash or unreadable ([0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §6); it stores none. Waiting On and Someday sit in any group except Complete and are Notion-only |
| Due | Date | |
| Project | Relation → Projects | |
| Area | Relation → Areas | |
| Meeting | Relation → Meetings | The backlink for action items |
| Source | Relation → Inbox | The backlink for your action items from documents, emails, chats, notes and captures (0037) |
| Kind | Select: Task, Question, Risk | 0099 §4. The brain sets Question or Risk on a task it creates to track a question or risk you said to follow up (spec/capture-and-review.md §6.4), and sends no Kind on any other task; you may set Task. The Questions and Risks tabs filter on it. A database you map yourself is offered it at connect (spec/setup.md §6.2.1); without it, such a task's title starts with `Question: ` or `Risk: ` |
| Brain ID | Text | Set when the brain created it; on a task that tracks a question, the question's id |
| Keep | Button labelled **Keep as document**: ticks Document asked | You (Tasks module, 0.16.0, [0100](../decisions/0100-keep-a-task-as-a-document.md); the connect step expects it on the default database, spec/setup.md §6.2.2). The brain acts on it with the Documents module on; with Documents off, a ticked box stays ticked |
| Document asked | Checkbox | You, through the Keep as document button: "waiting for the brain". The next catch-up keeps the task's page as a Document, linked to its project or area, the question it tracks and the task, and clears it (0100; [spec/capture-and-review.md](../spec/capture-and-review.md) §13). A database you map yourself is offered both at connect (spec/setup.md §6.2.2); without them, ask in the session |
| Last edited time | Last edited time | System (Notion fills it; groups the Done tab by week) |

### 3.13 Concepts (retired in 0.9.1)
Concepts were ideas, methods and definitions the brain learned (0037). Since 0.9.1 they are **learned Documents** (§3.14, decision 0071): the database is retired, and migration 0018 moves its rows to Documents and trashes it after your yes.

### 3.14 Documents
Pages you keep to read and link from anywhere (0049; the References database of 0045, renamed with its id, relations and views), what the brain learned and the brain's reports (0071). Created by the brain only, in these ways:
- **Keep as document** on an Inbox row, with Only keep empty: the input's **whole text**, verbatim. It needs no decision and arrives Reviewed.
- **Keep as document** with **Only keep** filled in: only that part, chosen by the brain, written first as a checked row on the Inbox (Kind Changed, §3.11) for you to check; once you say go or set it Ready, the checked text is kept whole and arrives Reviewed (0.16.0, [0098](../decisions/0098-agree-by-subject-and-check-a-changed-document.md) §4). Up to 0.15.x the part came with the input's other new notes and got its page when you accepted them.
- **A task kept as a document** (0.16.0, [0100](../decisions/0100-keep-a-task-as-a-document.md)): the Keep as document button on a task, or "keep the go-live task as a document" in the session. The task's page, word for word, arrives Reviewed, with its project or area and a link to the task (Task); the brain then offers what it already holds on the subject, added in one **From the brain** section at the end, one cited line each, after your yes. Your text above it never changes.
- **Learned** (0071; a concept before 0.9.1): an idea, method or definition the brain learned from an input, in its own words. It comes with that input's other new notes and gets its page when you accept them.
- **Promote to document**, asked in the agent session ("promote the decision on … to a document", 0099 §9; a button on Decisions until 0.16.0): a page seeded from the decision. From then on its body is **yours**; the brain never rewrites it. The decision has no row, so the Document keeps the link in Git only (`promoted_from`).
- **A report** (Reports module, 0071): the answer to an Ask row on the Inbox, one per subject, rewritten in place when you ask for a refresh. It is the brain's summary of what it knows, lines resting on notes you haven't reviewed marked *(not reviewed)*; it is never reviewed, has no Lifecycle and is never ingested back (0043, 0057).

A new version of a kept file proposes the changed lines to its Documents (an `update_body` proposal, asked in the agent session, [0096](../decisions/0096-one-place-to-decide.md)).

| Property | Type | Owner |
|---|---|---|
| Project | Relation → Projects (two-way with Documents) | Brain |
| Area | Relation → Areas (two-way with Documents) | Brain |
| Sources | Relation → Inbox (two-way with Documents) | Brain (filled from the Inbox side) |
| Origin | Select: Kept, Learned, Report, Promoted, Workflow | Brain (0071): Kept for a `whole` or `part` Document, Learned for a `learned` one |
| Origin | Select: Kept, Learned, Report, Promoted, Workflow | Brain (0071): Kept for a whole or part Document, Learned for what the brain learned, Report for a report, Promoted, Workflow. Groups the Documents views; never read back |
| Task | Relation → Tasks (one-way) | Brain: on a Document kept from a task, the task (0.16.0, 0100). Never read back |
| Asked in | Relation → Inbox (two-way with Report) | Brain: on a report, the Ask rows it answers (0071) |
| Update | Button labelled **Refresh report**: sends a message to Notion Brain Assistant (§3.17) | You, on a report (Reports module) |
| Refresh asked | Checkbox | You, on a report, ticked by hand: rewrite the report with what the brain knows now; the brain clears it (0045) |
| What to fix | Text | You, on a report: what it gets wrong; the brain turns it into proposals, asked in the agent session ([0096](../decisions/0096-one-place-to-decide.md)), clears it, and refreshes the report once you accept them (0045) |
| Created time | Created time | System (Notion fills it) |
| Last edited time | Last edited time | System (Notion fills it; sorts "What did we keep?") |
| Domain | Rollup: Area → Domain, Show original (0.16.1, 0105 §1; in every space with Documents, hidden with the Domains module off) | Notion (derived from the Area; you never edit it, and the brain never writes or reads it) |


Plus the common properties (a report leaves Summary and Lifecycle empty). Page body: the kept text (brain-written), on a promoted Document yours after the first write, on a report the brain's six sections (Where it stands, Timeline, Decisions in force, Open questions and risks, People involved, Gaps). Accepted, Accepted at and the **Accept** button are in §3.17.

### 3.15 Buttons and page layouts (0048)

**Every action you ask of the brain is a button** at the top of the row's page. The API can't see a click, so each button ticks a checkbox on the same row, which shows in the property group as "waiting for the brain"; the brain unticks it once it has acted. The Notion API can't create button properties (they are response-only in its schema), so buttons are always added by hand.

| Button property | Label | Database | Ticks | Also | Module |
|---|---|---|---|---|---|
| Keep | Keep as document | Inbox | Document asked | sets Brain Status to Ready | Documents |
| Keep | Keep as document | Tasks (0.16.0, 0100) | Document asked | — | Tasks (acted on with Documents) |
| Update | Refresh report | Documents (reports; the Inbox's Report rows before 0.9.1, 0071) | none: Send message to Notion Brain Assistant (0.8.0, §3.17) | — | Reports |

**A button's property name and its label differ** (#144): the page layout shows the name on the left and the label on the button, so the same text would show twice. The names are short and clash with no other property (not Report, Documents or Refresh asked). The brain never reads a button, only the checkbox it ticks, so a space that names its buttons otherwise works the same. Each checkbox has its own name, because Notion can't give a button and another property the same name.

Archived and Done (on a milestone) stay checkboxes: they describe a state, not a request.

**Page layout rule.** Each database's page layout has three parts: what you act on is **pinned at the top**; what the brain wrote comes next; system fields are **collapsed**. The API can't edit page layouts, so each is set by hand (migration 0010 lists every change, database by database).

| Database | Pinned at the top | Collapsed |
|---|---|---|
| Inbox | Keep, Tidy, Brain Status, Project, Area | Brain ID, Last Synced, Created |
| Documents | Write, Update, Accept, Refresh asked, What to fix, Lifecycle, Project, Area, Sources | Origin, Brain ID, Last Synced, Created time, Last edited time |
| Areas | At a glance | Brain ID, Last Synced |
| Goals, Projects, People, Orgs, Meetings, Tasks | the "You" properties of §3 | Brain ID, Last Synced, Ingested At |
| Domains | Archived | Brain ID, Last Synced |

**Domain on Projects, Meetings and Documents (0.16.1, 0105 §1).** The Domain rollup sits in the property group right after Area with the Domains module on, and is hidden with it off, as Domain is on area homes. It is never pinned: you change the Area, not the Domain. The Domains layout keeps Areas, Org and Summary in its property group, and shows no Type (0105 §3).

**Workflow settings are not pinned** (§3.19): on Projects and Areas, Workflow, Work type, Logging level and Log artifacts sit at the end of the property group. You set them once per piece of work, usually through the setup chat.

**The boxes a button ticks, and Only keep, are not pinned** (#144): they sit at the top of the property group. The button already says what it does, and the box is only the brain's to clear.

---

### 3.16 Buttons that message Notion Brain Assistant (0054): what a button passes

A button can use the action **send message to** an agent and pick Notion Brain Assistant. Tried by the user on 2026-10-31 on a test Inbox row (synthetic text); the plan level was not recorded.

**Verified (by that test):**
- **The page or row a button sits on is not identified implicitly.** With a message that referenced nothing, Notion Brain Assistant replied that it was not triggered from a page or database and that the chat context showed no page being viewed. *Inference, not tested:* the button passes only its message text; that nothing else is passed is not established by this test.
- **The message can reference the row it sits on:** the button's message editor offers `@` and a reference to the current page. With that reference in the message, Notion Brain Assistant acted on the right row.
- **End to end for Tidy capture on an Inbox row:** with the message "Run your Tidy capture skill on this Inbox page: @[this row]. I confirm: …replace the text below the title with the rewrite. Do not change the title, Brain Status or any property", Notion Brain Assistant rewrote the body of that row, asked no question, and changed no property.
- **Notion Brain Assistant applies its own rules to a message:** asked, in the first test, what it could edit, it answered that it edits page text only for Clean Email, and for Tidy Capture and Check Minutes "after your confirmation". A button's message therefore carries the confirmation the skill needs (the Instructions' edit rule is amended in 0.8.0, CC-71, 0054).

**The button contract (normative for CC-71):** every Notion Brain Assistant button's message (1) names the skill to run, (2) references the row with `@` to the current page, (3) carries the confirmation, and (4) says what the agent must not touch. A button without the row reference is not a valid Notion Brain Assistant button: the agent cannot tell which row was clicked.

**Tested (T4, 2026-11-02):** the connection returns one page-level last-edited time, no per-block times; it moved after an edit and **not after a deletion**. The rule below no longer assumes deletions are detected (decision 0062).

**Not verified yet (do not rely on these):**
- Refresh report on a Report row. The user reported (2026-10-31, not recorded in detail) that a second button test "edits the right body"; taken here as Write up on a promoted Document. Tidy capture on an Inbox row is the one with a recorded message and result.
- Whether a click runs unattended after the user leaves the page, and the credits one click uses (U-22, in the 0.8.0 acceptance run, measures them).
- Notion AI (instead of the Custom Agent) as the target. Not tested; a Custom Agent is scoped to Brain Data (0035), which Notion AI is not.

### 3.17 The three Notion Brain Assistant buttons, Write up format and accepting wording (0054)

Added in 0.8.0 (CC-71 builds them; migration 0012). Each button follows the contract in §3.16: its message names the skill, references the row with `@`, carries the confirmation, and says what not to touch. Clicking one is a deliberate act; nothing here runs on a property change or a schedule.

| Button | On | Message asks Notion Brain Assistant to | May edit | Never |
|---|---|---|---|---|
| **Tidy capture** | Inbox rows of Kind Capture, Brain Status **New** only (the row stays New while Notion Brain Assistant works, so a catch-up cannot take it in half-rewritten; the user sets Ready afterwards, 0054) | rewrite the body as clear text, keeping every name, number, date, link and quote | the row's body | the Name, any property (Brain Status stays New; the user sets Ready) |
| **Write up** | Documents, **promoted** Documents only (`origin: promoted`) | develop the body from the Document and the brain pages it links in Notion (its project's Brief and Decision log) | the Document's body | any property, external research unless the message asks for it |
| **Refresh report** | Reports: Documents rows with Origin Report (on the Inbox before 0.9.1, 0071) | search the relevant brain pages in Notion beyond the report's current links and **append** one section "Proposed refresh · based on Notion", dated and cited | the report's body, by appending that section | the existing report text, any property, *Refresh asked* |

Keep as document stays a checkbox button that the catch-up acts on (no Notion AI step); Promote to document is asked in the session since 0.16.0 (0099). A Document only exists to Write up after the next catch-up has created it.

**Write up format.** Purpose → Main content → Open questions → Sources, as native Notion blocks: a one-line purpose in a callout, headings, concise prose and lists, linked citations, a toggle for supporting detail, open questions visible. The first Write up develops the seeded text. A **repeat** Write up keeps the user's wording and appends one block headed **Proposed revision** (a toggle, marked with that exact heading) holding the new wording; the user adopts it by editing it into the body and deleting the block, or discards it by deleting the block. A repeat **Refresh report** replaces only the previous "Proposed refresh · based on Notion" section.

**Accepting.** Documents have two properties, **Accepted** (checkbox) and **Accepted at** (date and time), and one button, **Accept** (0071: one button for a write-up and a report, which are both Documents; *Accept write-up* on Documents and *Accept refresh* on the Inbox's Report rows before 0.9.1):
- **Accept** sets Accepted to checked and Accepted at to now (a Notion button can edit these properties; no AI is involved).
- For a report, the user accepts by first moving the proposed section's text into the report body (replacing the old text) and deleting the "Proposed refresh" heading, then clicking **Accept**.
- **An unresolved Proposed revision or Proposed refresh block blocks acceptance**: a checked Accepted with such a block on the page is not imported (cli.md §5.14.7, rows 4 and 5).
- **Any edit of the page in a later minute than the click invalidates the acceptance** (an edit inside the click's own minute is the known limit of decision 0058), the user clicks Accept again. The catch-up sees `Accepted at` older than the page's last edit and lists the row under Needs you. **Deleting a paragraph is not detected** (T4, 2026-11-02: the page time did not move; decision 0062). To change an accepted text, edit it and click Accept again. The skill re-reads the page just before importing, so an edit made after the catch-up began also stops the import.
- **The catch-up shows what it will import** (the full replacement text as a diff against Git) and imports after you say yes; an unattended run imports only an acceptance at least 2 minutes old. An edit made in the same minute as your Accept click, before the first read, cannot be detected: a known limit (decision 0058).
- **After the catch-up imports the wording it unticks Accepted and clears Accepted at** (like the other request boxes): the acceptance was consumed, and a later edit is an ordinary draft, which a publish never overwrites.
- To withdraw an acceptance the user unticks Accepted.

**What Notion Brain Assistant may edit (amends 0035).** Besides Check minutes, Tidy capture and Clean email: Write up, on the body of a promoted Document, and Refresh report, appending its proposed section to a report's body (its Documents row, 0071). Still never a brain-written section of any other page (CC-71 writes this into the Instructions), and no property from a button's message: since 0.17.0 it sets only your operational fields of §2, in its chat, after your yes (0101 §3).

**Where each case ends (the table in cli.md §5.14.7 is normative).** A Document or report body can be seeded, drafted by Write up, carry a pending proposal, be accepted, be edited after acceptance, or differ from Git; each has one outcome there. This section only defines the controls the user sees.

### 3.18 Domains, selected capture and editable Review (0.8.0, decision 0055)

The contract is [spec/capture-and-review.md](../spec/capture-and-review.md). For the Notion space it adds: the optional Domains database and Areas · Domain relation (§1), the Won't Do status and progress display (§2), the voice/ramble Inbox template (§3), typed `Selection:` tokens on summaries (§4), Review rows with item sections, `Decision:` tokens, the Submit decisions and Submit and accept all buttons, and the Decided, Decided at and Accept all properties (§7; these Review parts are retired in 0.16.0 with the Review database, [0096](../decisions/0096-one-place-to-decide.md)). The user's tests T1 to T8 (§9) ran on 2026-11-02 on synthetic pages:

- **Verified:** voice recording and transcript reading (T1); typed tokens survive edits and regeneration, though a paragraph may turn into a bulleted item (T2); a button sets two checkboxes and a date-time in one click (T3; that the time equals the click minute was not recorded); the Areas · Domain relation can be limited to 1 page, by hand (T7).
- **Anchors (T6):** 9 of 10 items passed; the repair of the failing item was not run. Notion writes straight quotes where curly were asked, adds unnumbered action items, and may merge topics into one transcript paragraph. The transcript is in the meeting block's Transcript section.
- **Per-section select (T5):** readable by an agent, but two clicks. Typed tokens remain the supported control.
- **Does not work (T4):** the page's last-edited time does not move when a block is **deleted**. The brain does not watch ingested pages for deletions (decision 0062). To change what it holds, edit the tokens and set the meeting back to Ready, or ask the assistant.
- **History (retired in 0.16.0, [0096](../decisions/0096-one-place-to-decide.md)): layouts and controls (CC-81).** Review gained **Decided**, **Decided at**, **Accept all** and the Your call option **Request revision** (Fix is kept), and two buttons set by hand: **Submit decisions** (Decided → checked, Decided at → now) and **Submit and accept all** (also Accept all → checked). A Review row from a source is a page: a first-use note and the brain-owned summary at the top, then a section per change (**Creates** or **Changes**, links to the target and the source, *Current*, the toggle **Proposed final wording**, *Why it matters*, *What Accept does*, `Decision:`). The explanation of each action is page text, never hover-only help; property descriptions are the only tooltip-like help used. The Proposed property is a short pointer. Meetings gain a gray notice ("All subjects included unless marked Meeting only. Mark Reviewed to confirm."); the Inbox gains a second template **Voice note** (starts at New; the user sets Ready); the minutes and voice prompts are [notion/minutes-format.md](../notion/minutes-format.md) and [notion/voice-format.md](../notion/voice-format.md); Brain Assistant gains **Voice summary**. Domains stay optional (module off by default). Migration: [0013](../notion/migrations/0013-domains-selected-capture-editable-review.md). Rendering the new Review layout is switched by the presence of the Decided property.
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
- **What a connected workflow writes on pages:** the **Workflow** toggle on the destination, the **Work record** toggle on each of its Task pages (§2). A connected workflow needs the Tasks module with the Brain ID property mapped, and the Documents module for any level above Tasks only; setup offers what is missing once and never turns a module on silently. It adds no Tasks property and no new database or view.

## 4. Templates (contextual workspaces, Easlo pattern)

Each template is the default for its database. Every linked view sits under an H3 heading named by the question it answers, with the database title hidden, and is filtered to "this page". Where a block has tabs, they follow the record's life (now → later → done). The table is the intent; [Prompt 6](../notion/prompts/06-templates.md) is the exact definition and wins where they differ. The live snapshot is [notion/templates.md](../notion/templates.md).

| Database | Template body |
|---|---|
| Areas | **The area's home (0050).** Domain is visible when the Domains module is on. "Brief" toggle heading (brain-written, 0041) · "What needs me here?" with tabs Today (Tasks due today or earlier, neither Done nor Won't Do) · Meetings (to review, held today or earlier) · Inbox (where Area is this page and Brain Status is New or Ready) · "What am I working toward here?" (Goals, Active) · "What's active here?" (Projects: Active, Planned, Done) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "What came in?" (Inbox where Area is this page, newest first) · "What do we know?" (Documents where Area is this page) · "Reports" (Documents where Area is this page and Origin is Report, 0045, 0071) · "My notes". People and Clients show as the "via projects" rollups in the page header (0034). Each part follows its module (§1, 0050): Today and "What's on my plate here?" with Tasks; "What am I working toward here?" with Planning; "What do we know?" with Documents; "Reports" with Reports; Clients via projects with Orgs. A new area is one page from this template |
| Domains | Areas and, when Orgs is on, Org in the page header; the description; three linked views, each filtered by **Domain contains This page** (0.16.1, 0105 §1): "Which projects?" (Projects), "Which meetings?" (Meetings, Date descending) and "What do we know?" (Documents, Documents module) · "My notes". No Type (0105 §3). A row with no Area, or whose Area has no Domain, is on no Domain page. The exact views are in [views-guide.md](../notion/views-guide.md) §9a |
| Goals | "How are the key results moving?" (Key Results: Open, Done) · "Which projects serve it?" (Projects) · "My notes" |
| Projects | A muted line "The brain writes only inside its toggles: Brief and Decision log, and Workflow or Repo tasks when you connect work or link a repo. Add your own notes in My notes." (0.9.0; before it: "Brief and Decision log are written by the brain. Add your own notes in My notes.") · "Brief" toggle heading (brain-written) · "Decision log" toggle heading (brain-written) · "What's on my plate here?" (Tasks: Open, Waiting On, Done) · "Which meetings?" (Meetings: Upcoming, Past) · "Who's involved?" (People) · "What came in?" (Inbox where Project is this page, newest first) · "What do we know?" (Documents where Project is this page) · "Reports" (Documents where Project is this page and Origin is Report, sorted by Created time descending, 0045, #137, 0071) · "My notes". Parts follow their modules as on Areas. A project the brain publishes is created from this default template through the API (0068), so it must stay the Projects default; a space without one falls back to **New project** |
| Meetings | Unchanged from the hand-reworked template (see notion/templates.md): "Before setting Ready" checklist callout, ending with the gray line "Check the minutes, fix them, then set Brain Status to Ready. Fixed them after the brain took them in? Set Ready again: it reads only what changed." (0045, 0109) · Notion AI meeting notes block · "My notes" · toggle Tasks (the Decisions and Questions toggles went in 0.16.0, 0099; the minutes still list both) |
| People | "Which meetings were they in?" (Meetings: Upcoming, Past) · "What are they working on?" (Projects) · "My notes" |
| Orgs | "Who works there?" (People) · "Which projects?" (Projects) · "My notes". Meetings show as the "Meetings via projects" rollup in the page header |
| Documents | (brain-written body, or yours on a promoted Document); no template needed |
| Inbox | None: a capture's body is yours, and the brain writes the body of the rows it creates (§3.11) |

No template creates the Workflow, Work record or `Repo tasks · <repo>` toggles: the skills append them to the pages that need them (§2).

No template uses a callout to show a property: a callout can't display one, and the page layout already shows it.

---

## 5. Layout (hub-and-spoke)

```text
Ultimate Brain                ← top page: the "Start here" callout (§10), then the pages below;
                                 in the published template, also the System callout (below)
First things first            ← the checklist for Notion Brain Assistant and its buttons (§10.1, 0103)
Home                          ← hub: my day, quick capture, "needs you"
├── Tasks                     ← Space
├── Meetings                  ← Space
├── Projects                  ← Space
├── Plan                      ← Space
├── Knowledge                 ← Space
└── (backend, never navigated)
    ├── Brain Data            ← the databases of Core and your modules
    └── System                ← synced nav, Archive, How it works, Skills. In the published template
                                 (0085) System is not a page: it is a callout on the top page
                                 holding the links to First things first (first, §10.1), Brain Data,
                                 Archive, How it works and Skills, and the Template version line (§10)
```

Each Space: the synced Spaces navigation in a narrow left column, then one tabs block whose tabs hold the linked views (Knowledge: one tab per database, each holding one linked view with several views). Views are named by the question they answer; tab labels are short. Each view shows what you need to act on from that view, usually 2–4 properties; everything else is on the page.

| Space | Job | Tabs (view) |
|---|---|---|
| **Home** | Start of day: your areas, then your work | With Domains on, group the Areas tab by Domain, including No domain. Left: navigation, then "Needs you": "Which minutes need review?" (Meetings, New, held today or earlier, 5 rows). Decisions on what the brain proposes are made in the agent session, and the week's review is an Inbox row (Kind Weekly) in the Inbox tab ([0096](../decisions/0096-one-place-to-decide.md)), whose actions and clean-up you tick there and set Ready (0.17.0, [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §4). Right: buttons Quick capture (→ Inbox, Kind Capture, Brain Status **Ready**, 0048), Ask the brain (→ Inbox, Kind Ask, Brain Status New; Reports module), New meeting, New project, New task (→ Tasks, Kind Task, the database's default Status, no project or due date; Tasks module; [0106](../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §12); then "What's on today?" with tabs **Areas** (one line per area, 0050: a linked view of Areas, not Archived, showing Name and At a glance, e.g. "Day job · 1 meeting · 2 due"; below it "What's due across areas?", Tasks due today or overdue, Tasks module; #143, decision 0053) · Tasks (due today or overdue; Tasks module) · Meetings (today) · Projects (Active) · **Inbox** ("What's in my inbox?": New or Ready, oldest first, showing Name, Kind, Brain Status; #146); then "What did the brain take in?" (the Brain feed, 0043) with tabs Came in (Inbox, Done, newest first, 10 rows) · Meetings (Brain Status Done, newest Ingested At first, 10 rows) |
| **Tasks** (Tasks module) | Do the work | Today · Upcoming (by day) · No date · Waiting On · Someday · **Questions** · **Risks** (Kind is Question, or Risk, and Status isn't Done, across every project; 0099 §4) · Done (by week) |
| **Meetings** | Prepare, review minutes, track ingestion | Upcoming · To review · Ready for the brain · Ingested this week · Calendar |
| **Projects** | Run projects | Active (board by Status) · By area · Deadlines (timeline) · Gone quiet |
| **Plan** (Planning module) | Areas → goals → key results → projects | Goals · Key results (by goal) · Areas (the way into each Area page) · Projects by goal |
| **Knowledge** | Navigate what the brain knows | Documents (What did we keep?, 0045, 0049; What did we learn?, 0071) · People (by org, Disputed) · Orgs (Clients, Others) · Inbox (What came in?: Done, newest first; the rows still waiting are Home's Inbox tab). Each tab follows its module |
| **Archive** (linked from System) | Find what's finished | One tab per database of your modules: Projects (Done or Archived) · Goals (Achieved, Dropped or Archived) · Areas · Documents · People · Orgs (Archived) |

Every view, with its filters, sort and properties, is in [notion/views-guide.md](../notion/views-guide.md) and Prompts 7a–7h.

**Notion Brain Assistant** is a Notion Custom Agent for daily use ([notion/brain-assistant.md](../notion/brain-assistant.md)): Instructions with the rules, and eleven skills (Today, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Voice summary, Clean email, Write up, Refresh report, and Write minutes: the minutes prompt of [notion/minutes-format.md](../notion/minutes-format.md) kept as a skill page, which you paste in the Notion AI chat on a meeting page and Notion Brain Assistant doesn't run). Its Tools and access hold only Brain Data, How it works and its skills database, **Skills** (on System, one page per skill; a space built before 0.14.0 keeps it wherever it was made, under its name then, "Brain Assistant Skills": nothing depends on the name, 0085), so same-named databases elsewhere in the workspace can't be confused. It reads and answers; only Check minutes, Tidy capture, Voice summary, Clean email, Write up and Refresh report may edit page text (the last two from their buttons, §3.17), and only the page text you own (0035, 0045). In its chat it may set your operational fields after your yes, and no other property (§2, 0101 §3). Weekly review, asked by name, opens this week's Inbox row (Kind Weekly) and reads it with you: for the brain's proposals it points to the agent session, and on the week's task items it sets the values you pick; it builds no digest of its own (spec/weekly-review.md §13). Review queue and Grill review are retired with the Review database (0.16.0, [0096](../decisions/0096-one-place-to-decide.md)). Prep, Write up and Refresh report read a project's decisions and open questions from its Brief and Decision log, and the questions and risks being followed up from the Tasks Kind, since there are no Decisions or Questions databases (0099 §9). How-to questions are answered from the "How it works" page, a copy of the user guide (the brain-howto skill's [references/guide.md](../.agents/skills/brain-howto/references/guide.md)).

---

## 6. Notion AI build prompts

A new user duplicates the published template instead (§10, 0078 §1); the prompts stay for building the template itself, for anyone who prefers to build, and as the reference the migrations bring older spaces up to. They live in [notion/prompts/](../notion/prompts/), each with its **Verify** list. Run them in the order of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one per message, on a new empty teamspace page. They are written so Notion AI does not invent extra properties.

| # | Prompt | Builds |
|---|---|---|
| 1 | [Pages](../notion/prompts/01-pages.md) | the pages of §5 |
| 2 | [Databases](../notion/prompts/02-databases.md) | the databases of §3 for the chosen modules (§1), without relations |
| 3 | [Relations](../notion/prompts/03-relations.md) | the two-way relations of §3 |
| 4 | [Formula and rollup](../notion/prompts/04-formula-rollup.md) | Key Results and Goals Progress |
| 5 | [Ownership](../notion/prompts/05-ownership.md) | owner prefix in each property description (§2) |
| 6 | [Templates](../notion/prompts/06-templates.md) | the templates of §4 |
| 7 | [Spaces and views](../notion/prompts/07-spaces-views.md) | the views of §5, one prompt per Space, plus Tasks (7g) and Archive (7h) |
| 8 (optional) | [Navigation](../notion/prompts/08-navigation.md) | tier 1 and tier 2 synced navigation |
| 9 | [Notion Brain Assistant's skills and the guide](../notion/prompts/09-assistant-and-guide.md) | the Skills database (Notion Brain Assistant's skills) on System with its skills, and How it works filled from the guide |

When this design changes, update the matching prompt file in the same change (decision 0022). Spaces that already exist get a migration in [notion/migrations/](../notion/migrations/), written by the `brain-notion-change` skill.

### After building
See "After building" in [notion/CHECKLIST.md](../notion/CHECKLIST.md): connect the brain to Notion, map your Tasks database (0018), verify the live space (0022), set up Notion Brain Assistant and paste the minutes prompt.

---

## 7. `brain.json` Notion section (shape)

```json
{
  "modules": { "domains": false, "orgs": true, "documents": false, "reports": false, "tasks": true, "planning": false },
  "notion": {
    "databases": {
      "domains": "<id>", "areas": "<id>", "goals": "<id>", "key_results": "<id>", "projects": "<id>",
      "meetings": "<id>", "people": "<id>", "orgs": "<id>", "inbox": "<id>", "documents": "<id>"
    },
    "tasks": {
      "database": "<id>",
      "properties": {
        "title": "Name", "status": "Status", "due": "Due",
        "project": "Project", "area": "Area", "meeting": "Meeting", "source": "Source", "brain_id": "Brain ID", "kind": "Kind"
      },
      "new_task_status": "To Do"
    }
  }
}
```

---

## 8. Resolved questions

1. **Editing a brain-owned property in Notion:** the next sync finds the edit and the next agent session asks it, with the other corrections from Notion, as one question; nothing is applied before your yes, since the brain can't tell your edit from one made by Notion AI or another tool, and a rejected edit is put back by the next publish (0023, [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §4). Once accepted: Key facts get a timeline entry; Name, Summary, Why and relations are replaced in place; judgments go through a proposal instead, asked in the agent session (0027, [0096](../decisions/0096-one-place-to-decide.md)).
2. **Meeting notes location:** they were loose pages. The Meetings database is their home from now on; move only recent meetings you still care about (last 1–2 months) and set them Ready (0024).
3. **Plan tier:** the databases, pages and sync need no paid plan. Notion Brain Assistant and its buttons need Business or Enterprise with Notion credits, because Custom Agents run on credits; Notion AI meeting notes need Business or Enterprise ([0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §7, read from Notion's help pages on 2026-11-16; check them again before setup text states a plan or a price).

## 9. Minutes format prompt (for the Meetings template)

The text lives in [notion/minutes-format.md](../notion/minutes-format.md). It gives every summary the same shape: Attendees, Projects, the overview (Highlights, Quick follow-ups, Tasks), then one section per subject with ids and quotes (0055; before it, 0043's eleven headings). Since 0.9.0 the owner's actions are split into **Quick follow-ups**, to-do checkboxes that stay in Notion, and **Tasks**, each with an editable **Scope** toggle (Done when, Due, Project, Notes) that the ingest carries into the Notion task (0067; pasting it: [notion/pasting-the-minutes-prompt.md](../notion/pasting-the-minutes-prompt.md)). Consistent minutes make the ingest more accurate (0024). Paste it into Notion AI when you ask it to summarise a meeting (or, from 0.17.0, into another tool whose minutes you paste on the page; the brain's agent writes minutes from the same text when a meeting has a transcript and none, spec/capture-and-review.md §3.4.2), or use it to check minutes against the "Minutes follow the format" item of the checklist. The Meetings template (reworked by hand on 2026-10-13) no longer holds it in a callout; on 2026-10-14 we chose to keep that template as it is.

**Lean minutes (0079, 0.14.0).** The prompt then writes a readable part (In one line, Quick follow-ups each with a `q` id, Tasks for the brain, one lean block per subject) and a collapsed **For the brain** toggle (Attendees, Projects, each subject's `Selection:` line, the id → quote list); a quick follow-up still unticked when the meeting is set Ready becomes a Task. The text, Check minutes and the paste guide are CC-197's (spec/capture-and-review.md defines the shape). The Meetings database doesn't change; the default template's gray line under the notice now says to tick the quick follow-ups you've done before Ready, and that `Meeting only` goes in the For the brain toggle (on a subject's Selection line or at the start of an item's quote line), since on a summary line it blocks the meeting ([Prompt 6](../notion/prompts/06-templates.md); [migration 0023](../notion/migrations/0023-lean-minutes.md) for existing spaces, with Check minutes and the prompt). The published template (§10) doesn't carry the prompt: setup walks the user through pasting it and checks it (spec/setup.md §6.3), and the template's Skills database holds 0079's Check minutes. If the test duplicate shows the prompt can live inside the Meetings template (0078 §2, CC-193), this section and §10 change to carry it.

## 10. The published Notion template (0078 §1)

A new user **duplicates a published template** instead of building from the prompts. It is a **copy of the author's own space, emptied and scrubbed**, in the author's one workspace (0084, amending 0078 §1), with **every module** (§1) and **`Example · ` rows in every database on Brain Data** that show a filled space (thirteen, in its eleven databases, from one story and related to each other: 0084's Domain, Area, Project, Person, Org, Meeting and Task, 0087's Inbox capture, Document, Goal, Key Result and second Task, and the example question as a third Task, Kind Question and Status Waiting On; the Review row went with the Review database in 0.16.0, 0096, and the Decision and Question rows with theirs, 0099), with a callout at the top of Brain Data saying they are examples, and published with duplication allowed. Setup removes the Example rows when it connects the brain, and the skills that read Notion never take one in (spec/setup.md §6.5). Its link and version are kept once, in [notion/TEMPLATE.md](../notion/TEMPLATE.md), which also lists what a duplicate contains, the steps it still needs and how the copy is emptied and scrubbed; the README, docs/setup.md and the `brain-setup` skill take them from there (spec/setup.md §6.2). Two templates exist, and user-facing text names them apart: the **brain folder** (`templates/brain/`, the Git repository `brain init` creates) and the **Notion template**.

What the template has beyond a space built from the prompts:

| Part | Where | Exact form | In the prompts? |
|---|---|---|---|
| **Start here** callout | the top page "Ultimate Brain", first block, above the pages | A callout (Notion's default icon), four lines. Line 1, bold: **Start here.** Line 2: "This is the Notion half of Ultimate Brain. Next: install Ultimate Brain, and in your brain folder tell your agent "set up my brain". Get started shows every step." "Get started" links to the **Get started** section of the product README on GitHub (`#get-started`; the repository's address is `package.json` `repository`, CC-192). Line 3 (0.16.1, [0103](../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md) §1): "Then open First things first: create your own Notion Brain Assistant and select it in its buttons." "First things first" links to the page **First things first** (§10.1) under the same top page. Line 4 (0.16.0, [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §7): "Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits." "Notion credits" links to Notion's help page on them (https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents, checked 2026-11-17: Custom Agents use credits each time they run, and credits are only available on Business and Enterprise; [Custom Agents](https://www.notion.com/help/custom-agents): you must be on the Business or Enterprise plan). **Below line 4 (0.17.0, [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §7, §8; CC-329), the plan table:** a simple table with a header row and three columns, "Your Notion", "Meetings" and "Notion Brain Assistant and its buttons", and three rows: "Business or Enterprise, with Notion credits" | "Notion AI meeting notes and the minutes prompt, or any other tool" | "Yes"; "Business or Enterprise, without credits" | "Notion AI meeting notes and the minutes prompt, or any other tool" | "No: ask Claude Code or Codex for the same skills"; "Free or Plus" | "Any other tool, pasting, or transcript files: your agent writes the minutes" | "No: ask Claude Code or Codex for the same skills" (checked 2026-11-20 against [AI Meeting Notes](https://www.notion.com/help/ai-meeting-notes): Business or Enterprise; [Notion AI](https://www.notion.com/help/notion-ai-faqs): a limited number of free AI responses on Free and Plus) | yes: [Prompt 1](../notion/prompts/01-pages.md) writes it, the table included, with "Get started", "First things first" and "Notion credits" as plain text; the links are added by hand. A space built before 0.16.0 gets line 4 with migration 0027, one built before 0.16.1 gets line 3 with migration 0028, and one built before 0.17.0 gets the plan table with migration 0030 (part C). Lines 3 and 4 said Brain Assistant before 0.17.0; migration 0030 (part B) gives them the new name |
| **First things first** page | a page under the top page "Ultimate Brain", linked from line 3 of Start here and first in the System callout (0103 §1; System stays a callout, 0085) | The checklist of §10.1, word for word, as to-do blocks | yes: [Prompt 1](../notion/prompts/01-pages.md) creates the page and its System link; its text is pasted from §10.1 by hand. A space built before 0.16.1 gets it with migration 0028 |
| **Template version** line | the **System callout** on the top page "Ultimate Brain" (0085: in the template, System is a callout holding the links to First things first (first, 0103 §1), Brain Data, Archive, How it works and Skills) | One line of its own inside that callout (a block, or a line after a line break in the callout's text block; inline-code formatting or none, spec/setup.md §9), exactly `Template version: NNNN`: the four-digit number of the last migration in [notion/migrations/](../notion/migrations/) the template includes (spec/setup.md §9). Nothing else on that line | **no**: a space built from the prompts has no line, so its version is unknown, never guessed (spec/setup.md §2 step 4, §9) |
| **How it works** filled | How it works, linked from the System callout | The user guide, the brain-howto skill's [references/guide.md](../.agents/skills/brain-howto/references/guide.md), as of the release the template is built from | yes: [Prompt 9](../notion/prompts/09-assistant-and-guide.md) |
| **Skills** (Notion Brain Assistant's skills) with its eleven skills | Skills, linked from the System callout | Name (title) and Description (text); one page per skill of [notion/brain-assistant.md](../notion/brain-assistant.md) "Skills": the name is the title, its Description line goes in Description, its text block is the page body (for Write minutes, the text block of [notion/minutes-format.md](../notion/minutes-format.md)). The template's copy keeps each skill's whole text block in Description, with an empty body: Notion Brain Assistant runs what Description holds, so a migration that changes a skill replaces its text where the page keeps it (migration 0030 A3) | yes: [Prompt 9](../notion/prompts/09-assistant-and-guide.md) |

**What a duplicate can't carry:** the agent's Notion connection (MCP), the brain's connection to the databases, the minutes prompt (§9) and Notion Brain Assistant itself (a Custom Agent, with Notion credits; without them setup leaves it out and the skills run from Claude Code or Codex, spec/assistant.md §13; given access to the duplicate's Brain Data, How it works and Skills). Duplicating the template never gives the user a configured Notion Brain Assistant: they create their own, give it access, replace the mentions and select it in the three buttons, as First things first lists (§10.1, 0103 §1). Setup walks through and checks each one (spec/setup.md §2 steps 3–4b, §6.4). The test duplicate (0078 §5, CC-193) records what survives duplication: the Custom Agent and its access, the buttons that message it, relations and the Home buttons; notion/TEMPLATE.md gets the result.

**Modules in a duplicate.** The template holds every module's databases and page parts. The brain uses the modules `brain.json` turns on (a new brain: Orgs, Documents, Reports and Tasks; Domains after seeding; spec/schema.md §12); the parts of a module that is off stay in the duplicate, unused, as the Domains database does with its module off (0065). Turning one on later needs no Notion step beyond connecting it, since its databases exist.

**Keeping it current (0022).** The template follows this design like any space: when a release adds a migration, the migration is applied to the template copy, its last step updates the Template version line in the System callout, and notion/TEMPLATE.md's version changes in the same release. A duplicate made earlier is brought up to date by the migrations `brain upgrade` names (spec/cli.md §5.15).

### 10.1 First things first (0103 §1; spec/setup.md §6.4.1)

A page titled **First things first** under the top page: what only the user can do in Notion before Notion Brain Assistant works. It is the one place in the space that says so; the text below is its exact Notion text. Each item is a to-do block, unticked, with its bold words in bold; the line before the items is a plain paragraph. Every place it names is given by where it sits **in the user's copy**, starting from their top page, never by a page mention: a mention copied with the template could open the template author's page. The links go to pages outside the space (Notion's help, the product repository), which a duplicate keeps as they are. The Instructions and skill text are never copied here: item 4 links to their one source, [notion/brain-assistant.md](../notion/brain-assistant.md).

> Do these once, in order. Duplicating this template copied its pages and databases, not a working Notion Brain Assistant: you create your own and connect it here. "Your top page" is the page this one sits under ("Ultimate Brain" unless you renamed it).
>
> - [ ] **Check your plan.** Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits. Without credits, skip items 2 to 6 and 8 (the buttons won't work on your plan): do item 7, then ask Claude Code or Codex for a skill by its name instead, such as "prep my 3pm" or "tidy that capture".
> - [ ] **Create your own Notion Brain Assistant.** Duplicating this template doesn't give you a configured agent. In Notion's sidebar: Agents → New Custom Agent, named **Notion Brain Assistant**, with no triggers. Already have one you created that answers in its chat, perhaps still named Brain Assistant? Keep it, don't create a second one: rename it **Notion Brain Assistant**, check items 3 to 6, then do item 8.
> - [ ] **Give it access.** In the agent's settings, under Tools and access, add only the page **Brain Data** (on your top page), the page **How it works** and the database **Skills** (both linked from System on your top page). In the picker each result shows the page it sits under: pick only those under your top page, and if a result doesn't show it, paste the page's link instead (open it from your top page, ••• → Copy link). Leave "Pages shared with everyone" off. Edit access is needed only on Meetings, Inbox and Documents, and on Tasks, Projects, Goals and Key Results for the fields it sets after your yes (all in Brain Data; those your space has); view access everywhere else. A mention in the Instructions doesn't give access: only Tools and access does.
> - [ ] **Paste its Instructions and replace the mentions.** Copy the Instructions from Notion Brain Assistant's setup page and paste them into the agent's Instructions. Replace each [@Brain Data] and [@How it works] with an @mention of that page under your top page.
> - [ ] **Check the mentions in its skills.** Open each page of **Skills** (linked from System on your top page). Every mention of Brain Data or How it works must open the page under your top page. Replace any that opens another space's page, or one you can't open.
> - [ ] **Select your agent in the three buttons.** **Tidy capture** is on Inbox; **Write up** and **Refresh report** are on Documents (both databases in Brain Data, on your top page). For each, open the database as a full page → ••• → Properties → the button, and in **Send message to** select your own Notion Brain Assistant. Keep the message as it is: its skill name, its "I confirm" and its @This page. Selecting the agent says who receives the message; @This page says which page it is about. One never replaces the other.
> - [ ] **Set up your brain.** Open Claude Code or Codex in your brain folder and say "set up my brain" to connect and populate your brain. No brain folder yet? Install Ultimate Brain first: Get started shows every step.
> - [ ] **Run Today and check the buttons.** In Notion Brain Assistant's chat, ask **Run Today** (by name, not /Today). Then, when setup asks, click each button on the sample page it creates for it. Notion Brain Assistant is ready when setup records these checks: ticking this box isn't the check.

**Item 3's wording changed in 0.17.0** (0101 §3, CC-325): it gave edit access on Meetings, Inbox and Documents only; it now adds Tasks, Projects, Goals and Key Results. 0.17.0's one Notion migration replaces item 3's text in an existing space, and the published template takes it.

**Item 1's wording changed in 0.17.0** (0101 §8.4, §8.6; spec/setup.md §13): before it, a user without credits put the Instructions and skills in their personal Notion Agent; setup no longer installs that path (it stays documented by hand in [notion/brain-assistant.md](../notion/brain-assistant.md)), and the skills run from Claude Code or Codex (spec/assistant.md §13). 0.17.0's one Notion migration, [0030](../notion/migrations/0030-your-fields-after-your-yes-the-path-without-notion-ai-and-the-weekly-row.md) part C, replaces item 1's text in an existing space and adds Start here's plan table, and the published template takes both (CC-329).

**The agent's name changed in 0.17.0** ([0072](../decisions/0072-ultimate-assistant.md) §1, [0106](../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §4, CC-352): Brain Assistant became Notion Brain Assistant, so it isn't confused with Ultimate Assistant in Claude Code or Codex. The opening line and items 1, 2, 4, 6 and 8 say the new name, and item 2 says to rename an agent still named Brain Assistant rather than create a second one. 0.17.0's one Notion migration (0030, part B) replaces the name in an existing space, with Start here's lines 3 and 4, and the published template takes it.

**The links** (each added by hand in the template, or by the agent in migration 0028):
- item 1, "Notion credits" → https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents (the Start here callout's link; checked 2026-11-17 with [Custom Agents](https://www.notion.com/help/custom-agents): Custom Agents need the Business or Enterprise plan, and use Notion credits each time they run);
- item 4, "Notion Brain Assistant's setup page" → `notion/brain-assistant.md` in the product repository on GitHub (`package.json` `repository`), at its **Instructions** section (`#instructions`);
- item 7, "Get started" → the README's Get started section (`#get-started`), the Start here callout's link.

**Which item checks what** (spec/setup.md §6.4.2): items 2 to 4 and 6 are done and checked by the user in Notion's interface, since the API can't read an agent's settings or a button's; setup reads item 5's mentions through the API and item 8's sample pages, and records Notion Brain Assistant ready only when its checks pass (spec/setup.md §6.4 check 8). The page itself is never read by the brain: a ticked box records nothing.
