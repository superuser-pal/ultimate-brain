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
| Your pattern | Hub-and-spoke, backend data page, synced two-tier nav | Whole layout (§5) |

### What we deliberately leave out

Task engine features (recurrence, contexts, energy, snooze), Topics/Notebooks/Highlights, books/recipes/journal subsystems, a universal Notes database, formula-heavy logic. Tasks stay in your existing database (0018).

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
| Status | Status: To Do, Doing, Done | |
| Due | Date | |
| Project | Relation → Projects | |
| Area | Relation → Areas | |
| Meeting | Relation → Meetings | The backlink for action items |
| Brain ID | Text | Set when the brain created it |

---

## 4. Templates (contextual workspaces, Easlo pattern)

Each template is the default for its database. Linked views filter to "this page". The table is the intent; [Prompt 6](../notion/prompts/06-templates.md) is the exact definition, and wins where they differ.

| Database | Template body |
|---|---|
| Areas | Summary callout · Goals (active) · Projects (active) · "My notes" toggle |
| Goals | Why callout · Key Results (table: Kind, Current/Target, Done, Progress) · Projects · "My notes" |
| Projects | "Brief" toggle heading (brain-written) · "Decision log" toggle heading (brain-written) · Open questions · Meetings (newest first) · Tasks (not done) · People · "My notes" |
| Meetings | Notion AI meeting notes block · Minutes format prompt (§9) · "Before marking Reviewed" checklist (attendees, project, format, minutes correct) · Decisions · Questions · Tasks from this meeting |
| People | Role and org callout · Meetings · Projects · "My notes" |
| Orgs | People · Projects · Meetings (through projects) · "My notes" |
| Decisions | (brain-generated body) · "Superseded by" callout when present |

---

## 5. Layout (hub-and-spoke)

```text
Home                          ← hub: tier-1 nav, quick capture, "needs you" summary
├── Plan                      ← Space
├── Projects                  ← Space
├── Meetings                  ← Space
├── Review                    ← Space
├── Knowledge                 ← Space
└── (backend, never navigated)
    ├── Brain Data            ← all 12 databases
    └── System                ← tier-1 and tier-2 synced nav masters
```

Each Space: tier-1 synced block (Home + all Spaces, unthemed) above a divider, then its tier-2 synced block (themed), then linked views only. A small non-synced label above the page title names the current page. Views are named by the question they answer.

| Space | Job | Views (named by question) |
|---|---|---|
| **Home** | Start of day | Quick capture (button → Capture Inbox) · "What needs my decision?" (Review, Pending, count) · "Which minutes need review?" (Meetings, Not Reviewed) · "What's active?" (Projects, Active) |
| **Plan** | Areas → goals → key results → projects | "What am I working toward?" (Goals, Active, with Progress) · "How are my key results moving?" (Key Results by Goal) · "Which areas do I own?" (Areas) · "Which projects serve each goal?" (Projects grouped by Goal) |
| **Projects** | Run projects | "What's active?" (board by Status) · "What's due soon?" (by Dates) · "Which projects have gone quiet?" (Active, Last Synced or last edit > 30 days) · "What's finished?" (Done / Archived) |
| **Meetings** | Review minutes, track ingestion | "Which minutes need review?" (Not Reviewed) · "What's waiting for the brain?" (Reviewed) · "What did the brain take in this week?" (Ingested, last 7 days) · "All meetings by project" |
| **Review** | Decide on proposals | "What needs my decision?" (Pending, newest first) · "Where do sources disagree?" (Kind = Contradiction, Pending) · "What did I approve recently?" (Applied, last 30 days) · "What did I reject?" (Closed) |
| **Knowledge** | Navigate what the brain knows | "What did we decide?" (Decisions, Accepted, newest) · "What changed our minds?" (Decisions, Superseded) · "What's still open?" (Questions, Open) · "Who's who?" (People by Org) · "Which clients do I have?" (Orgs, Client) · "What's in my inbox?" (Capture Inbox, New) |

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
| 6 | [Templates](../notion/prompts/06-templates.md) | the templates of §4, plus step 6b: paste the minutes format by hand |
| 7 | [Spaces and views](../notion/prompts/07-spaces-views.md) | the views of §5, one prompt per Space |
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

The text lives in [notion/minutes-format.md](../notion/minutes-format.md). It is pasted by hand into the "Minutes format" callout of the Meetings template (Prompt 6, step 6b), so every summary has the same sections (Attendees, Decisions, Action items, Facts & numbers, Open questions, Risks, Summary). Consistent minutes make the ingest more accurate (0024).
