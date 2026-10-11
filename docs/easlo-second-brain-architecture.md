# EASLO Second Brain Architecture Mapping

**Status:** First-pass Notion AI mapping supplied by the user on 2026-10-11.  
**Evidence label:** **Inferred** — the architectural narrative below comes from the initial analysis. Exact configuration and confidence labels are recorded separately in the [factual architecture appendix](easlo-second-brain-factual-architecture-appendix.md).

## 1. Executive summary

The system combines three operating models:

- **GTD:** capture, clarify, prioritize, schedule, execute, and complete work.
- **PARA:** organize active work into Projects and ongoing responsibilities into Areas.
- **PKM / knowledge management:** capture References, extract Highlights, develop Notes, and organize them through Topics and Notebooks.

The main architecture is a graph:

```text
Areas
├── Goals
│   └── Key Results
├── Projects
│   └── Tasks
├── Events
├── Notes
├── Notebooks
├── Topics
└── References
    └── Highlights
```

The strength of the design is that the user does not work directly from the raw databases all the time. Instead, they work through focused dashboards such as Inbox, Next Actions, Projects, Recent Notes, Reading, and Calendar.

## 2. Canonical databases

### A. Tasks

**Purpose:** The operational execution layer. Tasks represent actionable work, whether standalone, connected to a project, generated from an event, or associated with a goal.

**Attributes:**

- Name — task title.
- Status — Inbox, Waiting On, Someday/Maybe, Next Action, Completed.
- Description — task details.
- Project — relation to Projects.
- Parent Task / Sub-task — self-relation for hierarchy.
- Goal — relation to Goals.
- Area — relation to Areas.
- Event — relation to Events.
- Notes — relation to Notes.
- Energy — Low, Medium, High, Extreme.
- Contexts — Phone, Computer, Home, Online Shopping, Email.
- Priority — Low, Medium, High, Urgent.
- Owner — person responsible.
- Date — execution or due date.
- URL — external reference.
- Goal Area — derived rollup.
- Parent Date — inherited date from the parent task.
- Project Goal / Project Area — derived rollups.
- Created / Edited — system metadata.

**Core journey:**

```text
Capture → Clarify → Assign context → Link to project/goal/area
→ Choose next action → Execute → Complete
```

Task status is the main workflow engine. “Inbox” means unprocessed, “Next Action” means executable, and “Waiting On” or “Someday/Maybe” represent deliberate deferral rather than forgotten work.

### B. Projects

**Purpose:** Multi-step outcomes that require several tasks.

**Attributes:**

- Name — project title.
- Status — Inbox, Not Started, On Hold, In Progress, Completed.
- Priority — Urgent, High, Medium, Low.
- Timeline — project date range.
- Tasks — related tasks.
- Area — owning area.
- Goal — related goal.
- Parent Project / Sub-Projects — project hierarchy.
- Related Projects — cross-project connection.
- Meetings — related events or meetings.
- Notes — related notes.
- References — related external materials.
- Archive — archival control.
- Progress — percentage of completed tasks.
- Goal Area — derived rollup.
- End Date — derived from Timeline.
- Created / Edited — system metadata.

**Core journey:**

```text
Idea or objective → Project → Tasks → Meetings and notes
→ Progress tracking → Completed → Archived
```

Projects are the bridge between strategic planning and daily execution.

### C. Goals

**Purpose:** Strategic outcomes that organize projects, tasks, knowledge, and measurable results.

**Attributes:**

- Name — goal title.
- Status — Not Started, In Progress, Completed.
- Deadline — target date.
- Area — owning responsibility.
- Key Results — measurable outcomes.
- Projects — initiatives supporting the goal.
- Tasks — direct actions.
- References — supporting material.
- Notes — related thinking or decisions.
- Archive — archival control.
- Quarter — derived from Deadline.
- Countdown — derived days remaining.
- Created / Edited — system metadata.

**Core journey:**

```text
Area → Goal → Key Results → Projects → Tasks
```

A goal page acts as a strategic dashboard because its template embeds Key Results, Projects, Tasks, Notes, and References.

### D. Key Results

**Purpose:** Quantitative measurement layer for Goals.

**Attributes:**

- Name — metric or result title.
- Goal — parent goal.
- Start — baseline value.
- Current — latest measured value.
- Target — desired value.
- Progress — calculated percentage.
- Status — Open or Closed.
- Created / Edited — system metadata.

**Core journey:**

```text
Define metric → Set baseline → Set target → Update current value
→ Review progress → Close
```

This is a lightweight OKR-style mechanism.

### E. Areas

**Purpose:** Ongoing responsibilities that do not have a fixed completion date.

**Attributes:**

- Name — responsibility or domain.
- Type — Business, Personal, School.
- Projects — active initiatives.
- Tasks — related work.
- Goals — strategic outcomes.
- Notes — related knowledge.
- References — supporting resources.
- Topics — related knowledge themes.
- Notebooks — knowledge containers.
- Events — related events.
- Archive — archival control.

**Core journey:**

```text
Responsibility → Goals, Projects, Tasks, Events, and Knowledge
→ Ongoing review → Archive when no longer active
```

Areas are the most important organizing dimension in the system. They provide continuity across work, planning, and knowledge.

### F. Events

**Purpose:** Meetings, sessions, and scheduled activities that produce context and action items.

**Attributes:**

- Name — event title.
- Type — Standup, Client, Kickoff, Training, Onboarding.
- Date — event date.
- Description — event context.
- Attendees — participants.
- Meeting Link — online meeting URL.
- Projects — related projects.
- Tasks — resulting or related tasks.
- Area — owning area.
- Project Area — derived rollup.

The event template also includes an Agenda section and an Action Items linked database view.

**Core journey:**

```text
Schedule → Prepare agenda → Attend → Capture outcomes
→ Create action items → Link tasks to project/area → Follow up
```

This is the system’s meeting-to-execution loop.

### G. Notes

**Purpose:** The main knowledge and thinking layer.

**Attributes:**

- Name — note title.
- Type — Fleeting, Literature, Project, Permanent.
- Notebook — knowledge container.
- Topics — conceptual classification.
- Projects — related initiatives.
- Goals — strategic connection.
- Area — responsibility domain.
- Tasks — resulting actions.
- References — source materials.
- Highlights — extracted passages.
- Related Notes — note-to-note relation.
- Favorite — quick retrieval flag.
- Archive — archival control.
- Goal Area / Topics Area / Project Area / Notebook Area — derived rollups.
- Created / Edited — system metadata.

**Core journey:**

```text
Capture → Classify → Connect to notebook/topic/project/area
→ Develop into permanent knowledge → Extract actions or insights
→ Reuse or archive
```

The four note types provide a progression from raw capture to durable knowledge:

```text
Fleeting → Literature / Project → Permanent
```

### H. Notebooks

**Purpose:** Larger containers for groups of related Notes.

**Attributes:**

- Name — notebook title.
- Description — notebook purpose.
- Area — owning area.
- Notes — contained notes.
- Counter — number of notes, calculated.
- Archive — archival control.
- Created / Edited — system metadata.

**Core journey:**

```text
Create knowledge container → Add notes → Organize by area
→ Review contents → Archive
```

Notebooks are containers; Topics are cross-cutting subjects. That distinction is useful for the new system.

### I. Topics

**Purpose:** Cross-cutting subjects that connect Notes, References, Highlights, and Areas.

**Attributes:**

- Name — topic title.
- Area — related responsibility.
- Notes — related notes.
- References — related sources.
- Highlights — related excerpts.
- Area Type — derived from the Area relation.
- Counter — calculated note count.
- Archive — archival control.
- Created Time / Edited — system metadata.

**Core journey:**

```text
Subject emerges → Create Topic → Attach notes, sources, and highlights
→ Connect to an Area → Use as a knowledge hub
```

Topics are useful for discovering relationships that would be invisible if everything were organized only by project.

### J. References

**Purpose:** External resources and media that may be consumed, studied, or reused.

**Attributes:**

- Name — resource title.
- Type — Book, Film, Article, Video, Podcast, Template, Post, Product.
- Source — origin or provider.
- URL — external link.
- Description — summary or context.
- Status — Inbox, Backlog, Up Next, In Progress, Completed.
- Platform — Audible, YouTube, Netflix, Kindle, Website, Notion, Prime, HBO, Twitter, TED, and others.
- Publication Date — source publication date.
- Completed Date — consumption or completion date.
- Rating — one to five stars.
- Projects — related projects.
- Goals — related goals.
- Areas — related responsibilities.
- Topics — related subjects.
- Highlights — extracted highlights.
- Notes — resulting notes.
- Related References — source-to-source relation.
- Favorite — quick retrieval flag.
- Archive — archival control.
- Created / Edited — system metadata.

**Core journey:**

```text
Capture source → Inbox → Backlog / Up Next
→ In Progress → Completed → Extract highlights
→ Develop notes → Connect to topics, areas, projects, or goals
```

The pages called Books, Watchlist, and References are filtered views of this same database, not separate databases.

### K. Highlights

**Purpose:** Short excerpts or insights extracted from References.

**Attributes:**

- Highlight — extracted passage or idea.
- Author — source author.
- References — originating source.
- Topics — related subjects.
- Notes — notes developed from the highlight.
- Favourite — quick retrieval flag.
- Media Type — derived from the related Reference.
- Created / Edited — system metadata.

**Core journey:**

```text
Consume reference → Capture highlight → Attribute author/source
→ Tag with topic → Develop into a note → Reuse in projects or goals
```

Highlights are the bridge between passive consumption and active knowledge creation.

## 3. Dashboards and navigation views

The system has three primary working surfaces.

### GTD Dashboard

The GTD Dashboard exposes Quick Capture, Inbox, Today, Next Actions, Calendar, Projects, Waiting On, Someday/Maybe, Logbook, References, Topics, Areas, Tasks, Projects, and References.

This dashboard is the execution cockpit. It is built around task status, context, dates, and next actions.

### PARA Dashboard

The PARA Dashboard exposes Projects, Areas, Notes, and Archive. It is the operational view of active commitments and ongoing responsibilities.

### Notes Dashboard

The Notes Dashboard exposes Recent, Inbox, To Review, Favorites, Notebooks, Topics, Timeline, All Notes, Archive, Notes, Notebooks, and Topics. It is the knowledge-maintenance cockpit.

### Database registry

The Databases page functions as the schema registry. It contains the canonical databases for Areas, Projects, Tasks, Events, Topics, Notebooks, Notes, References, Highlights, Goals, and Key Results.

## 4. Core end-to-end journeys

### Journey 1: Capture to action

```text
Quick Capture
  ↓
Inbox
  ↓
Clarify what it is
  ├── Task
  ├── Note
  ├── Reference
  └── Event
  ↓
Assign project, area, goal, topic, or date
  ↓
Work from a focused view
```

This prevents the user from having to decide the complete structure at the moment of capture.

### Journey 2: GTD execution

```text
Task in Inbox
  ↓
Define the next physical action
  ↓
Assign status, context, energy, priority, and date
  ↓
Link to project, area, goal, event, or note
  ↓
Execute from Next Actions / Today / Calendar
  ↓
Complete or deliberately defer
```

The important principle is that “Next Action” is not just a label; it is the state that makes work executable.

### Journey 3: Strategic planning

```text
Area → Goal → Key Result → Project → Tasks → Progress rollups
```

This creates traceability from daily activity to strategic outcomes.

### Journey 4: Meeting to execution

```text
Event → Agenda and attendees → Meeting notes → Action items → Tasks
→ Project / Area / Goal → Follow-up event or completed outcome
```

Events are not isolated calendar records; they are conversion points from conversation into work.

### Journey 5: Knowledge capture and synthesis

```text
Reference → Highlight → Note → Topic / Notebook / Area
→ Project, Goal, or Task
```

This is the most important knowledge loop. It turns consumption into reusable organizational knowledge.

### Journey 6: Review and archiving

```text
Inbox review → Status review → Project and goal review
→ Notes and reference review → Archive inactive material
```

The architecture uses both workflow statuses and explicit Archive checkboxes. This separates “not currently active” from “completed.”

## 5. Architectural patterns worth reusing

### One source of truth, many views

The same Tasks database appears as Inbox, Today, Next Actions, Waiting On, Someday/Maybe, Calendar, Archive, and task dashboards. That is preferable to creating a separate database for every workflow.

### Relations create the operating graph

The key relationships are:

```text
Area ↔ Goal ↔ Project ↔ Task
Area ↔ Note ↔ Topic ↔ Reference ↔ Highlight
Project ↔ Event ↔ Task
Goal ↔ Key Result
```

This lets a user enter the system from any context and still find the surrounding information.

### Rollups provide context without duplicate data

Examples include:

- Project progress from completed Tasks.
- Project Area inherited from Project.
- Goal Area inherited from Goal.
- Media Type inherited from Reference.
- Countdown derived from Goal Deadline.

The system keeps the canonical value in one place and derives the rest.

### Templates act as contextual workspaces

A Goal page displays its Key Results, Projects, Tasks, Notes, and References. A Project page displays its Tasks, Meetings, Notes, and References. An Event page displays its agenda and action items.

This is a strong pattern for the new second brain: each important entity should open into a useful workspace, not just a property form.

## 6. Important observations before creating our own version

### Keep the conceptual model, simplify the first implementation

The reference system is rich, but recreating all 11 databases immediately would create unnecessary maintenance. A first version could start with Tasks, Projects, Areas, Notes, References, and Events. Goals, Key Results, Topics, Notebooks, and Highlights could be added when the workflows prove they are needed.

### Separate workflow from knowledge

Tasks and Projects answer: “What am I trying to accomplish?”

Notes, References, Topics, and Highlights answer: “What do I know, what am I learning, and where can I reuse it?”

### Use fewer statuses

Only add statuses that drive a real decision. For example:

- Tasks: Inbox, Next, Waiting, Done.
- Projects: Planned, Active, On Hold, Done.
- Notes: Inbox, Developing, Permanent, Archived.
- References: Inbox, Up Next, In Progress, Completed.

### Preserve the distinction between Projects and Areas

- **Project:** has a desired outcome and an eventual end.
- **Area:** is an ongoing responsibility with no natural completion date.

That distinction is foundational to the whole system.

### Avoid naming inconsistencies

The current system contains small inconsistencies such as:

- Favorite and Favourite.
- Highlights with a leading space in some schema names.
- References with a leading space in one property.
- Created, Created Time, and similar variations.

Our version should establish a naming convention before creating the databases.

## 7. Recommended blueprint for our own Second Brain

### Phase 1 — Core operating system

Create Areas, Projects, Tasks, Notes, References, and Events.

Build these views: Capture / Inbox, Today, Next Actions, Waiting On, Active Projects, Notes to Review, Reference Inbox, Calendar, and Archive.

### Phase 2 — Strategic layer

Add Goals and Key Results, connected as:

```text
Area → Goal → Project → Task
```

### Phase 3 — Knowledge layer

Add Topics, Notebooks, and Highlights, connected as:

```text
Reference → Highlight → Note → Topic / Area / Project
```

### Phase 4 — Automation and intelligence

Automate:

- Capture routing.
- Meeting action-item creation.
- Task creation from notes.
- Project progress calculations.
- Review reminders.
- Reference-to-highlight and highlight-to-note workflows.
- AI-generated summaries and suggested relations.

### Initial design principle

The new space should not attempt to copy every property. It should reproduce the journeys:

```text
Capture → Clarify → Organize → Execute → Review
Capture → Develop → Connect → Reuse
Plan → Measure → Execute → Learn
```

That is the real architecture behind this Second Brain.

## 8. Verification status

The follow-up audit is preserved in [EASLO Second Brain — Factual Architecture Appendix](easlo-second-brain-factual-architecture-appendix.md). It documents:

- Exact schemas for all 11 canonical databases, including property types, options, relations, rollups, and formulas.
- Canonical and dashboard view filters, sorts, groupings, visible properties, and roles.
- Database-template bodies, embedded views, relation filters, and defaults.
- Lifecycle, archive, data-integrity, editing, permission, and integration findings.
- Representative and observed examples, followed by a finding-level confidence table.

The audit could not inspect button actions, database-automation configuration, recurring-template schedules, runtime rollup treatment of archived relations, or workspace-wide permission inheritance. These remain explicitly marked **Unknown** rather than being inferred.
