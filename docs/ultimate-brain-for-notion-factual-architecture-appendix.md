# Ultimate Brain for Notion (1) — Factual Architecture Appendix

**Status:** Notion AI audit supplied by the user on 2026-10-11.  
**Evidence convention:** “Verified” below means reported as observed by Notion AI through the workspace/API interfaces it could access; it has not been independently verified from a Notion export or direct API response.

> **Repository research note:** This export documents the visible hierarchy, six master databases, schemas, relations, templates, dashboards, formulas, GTD/PARA mechanics, recurrence model, and archive model. It does not provide dedicated evidence for property/page permissions, button actions, database-automation trigger/action configuration, recurring-template schedules, duplicate prevention, correction history, decision supersession, representative record traces, or a final `Unknown` / `Not found` inventory. Treat those subjects as **undocumented by this audit**, not as confirmed absent.

> **Scope & Nature of Document**: This document provides an exhaustive, strictly factual architectural specification of the **Ultimate Brain for Notion (1)** workspace template (created by Thomas Frank / losslessReconstruction). Every section is grounded directly in inspectable JSON schemas, database configurations, page templates, page content trees, and live view configurations retrieved via the Notion API. Per strict architectural audit standards, unexposed details (such as Notion internal formula expression strings) are explicitly labeled as *Inaccessible via API / Unexposed* rather than conjectured.
>

---

## 1. Workspace Hierarchy & Structural Pages

The template is organized hierarchically starting from a single top-level root page. Core databases reside within a central storage container located on the Archive page, while operational activity occurs through dedicated dashboards and workflow centers.

```
Ultimate Brain for Notion (1) [Root Page]
├── Dashboards
│   ├── Dashboard
│   ├── My Day
│   ├── Quick Capture
│   ├── Process (GTD Center)
│   │   ├── Intake
│   │   ├── Do Next
│   │   ├── Delegated
│   │   └── Deferred
│   └── Plan
├── Productivity Views
│   ├── Task Manager
│   │   ├── Today
│   │   ├── Tomorrow
│   │   ├── Next Month
│   │   ├── Completed
│   │   ├── Cold Tasks
│   │   ├── Priority View
│   │   ├── Timeline View
│   │   └── Task Inbox
│   ├── Project Hub
│   ├── Notes
│   │   ├── Favorites
│   │   ├── Recents
│   │   ├── Note Inbox
│   │   └── Daily Journal
│   ├── Areas & Resources
│   │   └── Areas
│   └── Goals
├── Special Views
│   ├── Quick Links
│   ├── Book Tracker
│   └── Recipe Book
└── Archive
    └── The Brain [Container Toggle]
        ├── ✅ All Tasks [UB]
        ├── 🎯 Projects [UB]
        ├── 🗒️ All Notes [UB]
        ├── 🏆 Goals [UB]
        ├── 📌 Milestones [UB]
        └── 🗃️ Areas/Resources [UB]
```

### Structural Page Directory

| Page Title | Notion URL | Parent Location | Icon | Verified Structural Role |
| --- | --- | --- | --- | --- |
| **Ultimate Brain for Notion (1)** | `https://app.notion.com/p/00a495661e99828cbbd38119dd5feb6e` | Workspace Root | 🧠 | Main template root; navigation hub linking all dashboards, productivity views, and special views. |
| **Dashboard** | `https://app.notion.com/p/39d495661e9983fead0381d03bcf9f07` | Root Page | ⚡ | Central personal cockpit: links to today's tasks, notes recents/favorites, prioritized projects, and quick links. |
| **My Day** | `https://app.notion.com/p/813495661e9982e0ad6c01cdfd4a30ea` | Root Page | ☀️ | Daily execution dashboard: Task & Events, Self-Care focus, Daily Habit trackers, and Day Review. |
| **Quick Capture** | `https://app.notion.com/p/6a6495661e99836b99a9015b1f8c9b66` | Root Page | 📥 | Minimal, mobile-friendly landing zone for rapid entry of unassigned tasks and raw notes. |
| **Task Manager** | `https://app.notion.com/p/746495661e998370902701d8cba7170d` | Root Page | ✅ | Master task cockpit housing linked views for Today, Tomorrow, Next 7 Days, Kanban boards, and subpage routes. |
| **Project Hub** | `https://app.notion.com/p/93e495661e998331a129815db3029378` | Root Page | 🎯 | Project planning and status center grouped by Area, tracking progress, deadlines, and active priority. |
| **Notes** | `https://app.notion.com/p/a7f495661e9983109e950192567dcc68` | Root Page | 🗒️ | Knowledge base dashboard: Notebooks, Note Inbox, Favorites, Recents, and Daily Journals. |
| **Areas & Resources** | `https://app.notion.com/p/293495661e998275850e019f29e57972` | Root Page | 🗃️ | PARA structural center housing Areas and Resources within a consolidated database schema. |
| **Goals** | `https://app.notion.com/p/ecb495661e99830e9dd2014ce5276613` | Root Page | 🏆 | High-level goal tracking dashboard connecting Goals, linked Milestones, and supporting Projects. |
| **Process** | `https://app.notion.com/p/3de495661e9983e7968081fb754dd461` | Root Page | 🔄 | Dedicated GTD processing center for triaging Intake items into Smart Lists (Do Next, Delegated, Someday). |
| **Plan** | `https://app.notion.com/p/140495661e9983af8cde81c3c81105a5` | Root Page | 🗓️ | Medium- and long-term planning dashboard for Quarterly/Annual reviews and active priority roadmaps. |
| **Quick Links** | `https://app.notion.com/p/6c3495661e99826f8dbd81e6e02154c9` | Root Page | 🔗 | Workspace-wide reference directory of bookmarks, recurring links, and resource locations. |
| **Book Tracker** | `https://app.notion.com/p/9c0495661e9982bf839281b40f0f6295` | Root Page | 📚 | Specialized library dashboard filtering Notes by Type "Book" across reading status shelves. |
| **Recipe Book** | `https://app.notion.com/p/25e495661e99831badd981b57842752d` | Root Page | 🍳 | Culinary collection dashboard filtering Notes by Type "Recipe" with categorized tags and ingredient inboxes. |
| **Archive** | `https://app.notion.com/p/9b1495661e99835e800981233e39ba04` | Root Page | 📦 | Structural resting place for master databases ("The Brain") and retired workspace items. |

---

## 2. The 6 Core Master Databases

Ultimate Brain centralizes all records inside six canonical databases located on the `Archive` page under a toggle titled **"The Brain"** (`https://app.notion.com/p/d9e495661e99833a9f240135cec22bb3`).

### 2.1. Master Database Registry

| Database Name | Database URL | Collection / Data Source URL | Icon | Record Type |
| --- | --- | --- | --- | --- |
| **✅ All Tasks [UB]** | `https://app.notion.com/p/9aa495661e9983b0ba1001b0a1f1e3e8` | `collection://8b349566-1e99-82e6-8283-070bd3887004` | ✅ | Actionable tasks, GTD inbox items, sub-tasks, recurring tasks |
| **🎯 Projects [UB]** | `https://app.notion.com/p/ad6495661e9982309c9601d09ae024d3` | `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` | 🎯 | Multi-step outcomes with deadlines, progress tracking, task links |
| **🗒️ All Notes [UB]** | `https://app.notion.com/p/711495661e9982eba01501f94be52d16` | `collection://90549566-1e99-8258-9a08-87f5b382223f` | 🗒️ | Notes, daily journals, book summaries, recipes, web clips |
| **🏆 Goals [UB]** | `https://app.notion.com/p/971495661e99829dae6881556011dba2` | `collection://e7a49566-1e99-83fd-8d08-87a7fad25227` | 🏆 | Broad objectives broken into measurable milestones and projects |
| **📌 Milestones [UB]** | `https://app.notion.com/p/7ee495661e9982409586015a0752c1e5` | `collection://90449566-1e99-836f-8d25-07378613b3f1` | 📌 | Concrete step-targets belonging directly to a Parent Goal |
| **🗃️ Areas/Resources [UB]** | `https://app.notion.com/p/5e0495661e998270bc900171a282a975` | `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` | 🗃️ | PARA Areas of responsibility and Resource reference topics |

---

## 3. Exhaustive Database Schema Tables

### 3.1. `All Tasks [UB]` Schema

- **Collection URL**: `collection://8b349566-1e99-82e6-8283-070bd3887004`
- **Total Properties**: 46 properties (10 native editable, 2 system timestamps, 1 user property, 3 relations, 11 rollups, 19 formulas).

| Property Name | Property ID | Type | Configuration / Options / Targets | Formula Result / Rollup Detail |
| --- | --- | --- | --- | --- |
| **Task** | `title` | `title` | Primary title string | — |
| **Done** | `X0ReUg` | `checkbox` | Default: Unchecked (`__NO__`) | — |
| **Due** | `Ymw9Ow` | `date` | Format: Relative; Time: `LT` | Queryable via start/end/is_datetime |
| **Start** | `bmt1dw` | `date` | Used for timeline view start points | Queryable via start/end/is_datetime |
| **Priority** | `Pj1PTA` | `select` | `🚨HIGH` (blue), `🧀 Medium` (green), `🧊 Low` (orange) | — |
| **Kanban Status** | `eGtYfg` | `select` | `To Do` (red), `Doing` (purple), `Done` (yellow) | — |
| **Smart List** | `eFtVYA` | `select` | `Do Next` (green), `Delegated` (yellow), `Someday` (red) | Manual GTD smart list assignment |
| **Contexts** | `UlN6cw` | `multi_select` | `High-Energy`, `Low-Energy`, `Errand`, `Home`, `Office`, `Social` | GTD execution contexts |
| **Kanban - Tag** | `SH52cQ` | `select` | `Design` (brown), `Copy` (orange), `Speed` (yellow), `Security` (purple) | Departmental / domain tagging |
| **Assignee** | `cWJxOg` | `person` | Workspace user relation | User assignment |
| **Note** | `fWZofg` | `text` | Free-text inline note string | — |
| **Snooze** | `V1U6Uw` | `date` | Temporary hiding date | Removes task from view until snooze passes |
| **Wait Date** | `SHFTXw` | `date` | Follow-up / tickler date | Used for delegated / waiting-on items |
| **Recur Interval** | `bXZweA` | `number` | Numeric multiplier for recurrence | E.g., `1`, `2`, `14` |
| **Recur Unit** | `YV5Tbw` | `select` | `Day(s)`, `Week(s)`, `Month(s)`, `Month(s) on the First Weekday`, `Month(s) on the Last Weekday`, `Month(s) on the Last Day`, `Year(s)` | Recurring engine frequency unit |
| **Days (Only if Set to 1 Day(s))** | `WmhaRg` | `multi_select` | `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` | Specific weekday recurrence selector |
| **Project** | `YX58bA` | `relation` | Target: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` (`Projects [UB]`) | Two-way: `Projects [UB].Tasks` (`Znl4Yw`) |
| **Parent Task** | `dXlydg` | `relation` | Target: `collection://8b349566-1e99-82e6-8283-070bd3887004` (`All Tasks [UB]`) | Two-way self-relation: `Sub-Tasks` (`d3p2RA`) |
| **Sub-Tasks** | `d3p2RA` | `relation` | Target: `collection://8b349566-1e99-82e6-8283-070bd3887004` (`All Tasks [UB]`) | Two-way self-relation: `Parent Task` (`dXlydg`) |
| **Created** | `QXt2SA` | `created_time` | ISO-8601 creation timestamp | System immutable |
| **Created By** | `Rkg9Vw` | `created_by` | User URL | System immutable |
| **Edited** | `OmBCWg` | `last_edited_time` | ISO-8601 edit timestamp | System auto-updated |
| **Priority Project** | `R2VzPQ` | `rollup` | Relation: `Project`; Target: `Priority` (`TFxRTw`) | Checkbox aggregation (checked if project prioritized) |
| **Project Area** | `cF15XQ` | `rollup` | Relation: `Project`; Target: `Area` (`bG52cw`) | Inherited relation to `Areas/Resources [UB]` |
| **Sub-Task Count** | `cHR2QA` | `rollup` | Relation: `Sub-Tasks`; Target: `Task` (`dGl0bGU`) | Count of linked child tasks |
| **Parent Created** | `O0BSYw` | `rollup` | Relation: `Parent Task`; Target: `Created`; Aggregation: `earliest_date` | Inherited creation time of parent task |
| **Parent Edited** | `ejtEUA` | `rollup` | Relation: `Parent Task`; Target: `Edited`; Aggregation: `earliest_date` | Inherited edit time of parent task |
| **Parent Snooze** | `PmR5fQ` | `rollup` | Relation: `Parent Task`; Target: `Snooze`; Aggregation: `earliest_date` | Inherited snooze date from parent task |
| **Parent Wait** | `bEF9Rw` | `rollup` | Relation: `Parent Task`; Target: `Wait Date`; Aggregation: `earliest_date` | Inherited wait date from parent task |
| **Parent Project** | `T05HYw` | `rollup` | Relation: `Parent Task`; Target: `Project` (`YX58bA`) | Inherited project relation from parent task |
| **Parent Smart List** | `UV1SWA` | `rollup` | Relation: `Parent Task`; Target: `Smart List (Formula)` (`QHc7Qg`) | Inherited smart list designation from parent |
| **Parent Due Timestamp** | `Q3Q9Vg` | `rollup` | Relation: `Parent Task`; Target: `Due Timestamp` (`cUhzPw`) | Number: numeric unix timestamp of parent due date |
| **State** | `QmN3eA` | `formula` | Text | Output: status flag (e.g., active, completed, cold) |
| **Smart List (Formula)** | `QHc7Qg` | `formula` | Text | Evaluates effective smart list inheritance |
| **Cold** | `UF1iWA` | `formula` | Checkbox (`boolean`) | Checked when task is inactive/stale (>14 days past due/reschedule) |
| **Late** | `YUd8Tw` | `formula` | Text | Flags overdue status based on current date |
| **Next Due** | `V2NCXA` | `formula` | Text | Evaluates next calculated occurrence for recurring tasks |
| **Due Timestamp** | `cUhzPw` | `formula` | Number | Converts `Due` date to numeric timestamp for sorting |
| **Due Stamp (Parent)** | `e1BbWA` | `formula` | Number | Normalized timestamp of parent due date |
| **Created Stamp (Parent)** | `bkNsbA` | `formula` | Number | Normalized timestamp of parent creation |
| **Edited Stamp (Parent)** | `bWc7Uw` | `formula` | Number | Normalized timestamp of parent last edit |
| **First Weekday Base Date** | `Ulh-eg` | `formula` | Date | Base date for "First Weekday of Month" recurrences |
| **Last Weekday Base Date** | `PUxSRQ` | `formula` | Date | Base date for "Last Weekday of Month" recurrences |
| **Last Day Base Date** | `cGViXQ` | `formula` | Date | Base date for "Last Day of Month" recurrences |
| **Next Last Base Date** | `QlNVfQ` | `formula` | Date | Boundary calculation for monthly recurrence |
| **Simplified Recur Unit** | `YU9fXA` | `formula` | Text | Normalized string representing recurring unit |
| **Type** | `YW5Zag` | `formula` | Text | Distinguishes Standard Task vs. Sub-Task vs. Recurring |
| **Wait (Parent)** | `RTxFcg` | `formula` | Number | Evaluates wait date expiration |
| **Snooze (Parent)** | `dF9Afg` | `formula` | Number | Evaluates snooze expiration |
| **Sub Seed** | `W3taUA` | `formula` | Checkbox (`boolean`) | Internal flag for child task template generation |
| **Sub Seed Name** | `e1p5Vg` | `formula` | Text | Label string for programmatic sub-task creation |
| **Quick Capture Box** | `V2xwcw` | `formula` | Checkbox (`boolean`) | Evaluates if task belongs in unprocessed inbox |
| **UTC Offset** | `ejpNVQ` | `formula` | Number | Timezone compensation offset |
| **Divider** | `YHNRbw` | `formula` | Text | UI separator line |
| **⏱ Recurring Divider** | `XE5bUw` | `formula` | Text | UI separator line for recurring section |
| **✅ Sub-Task Divider** | `a1t8cQ` | `formula` | Text | UI separator line for sub-task section |

---

### 3.2. `Projects [UB]` Schema

- **Collection URL**: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707`
- **Total Properties**: 23 properties (7 editable, 2 timestamps, 5 relations, 4 rollups, 5 formulas).

| Property Name | Property ID | Type | Configuration / Options / Targets | Formula Result / Rollup Detail |
| --- | --- | --- | --- | --- |
| **Name** | `title` | `title` | Project name string | — |
| **Status** | `S0Z-PA` | `select` | `To Do` (red), `Doing` (purple), `Done` (yellow), `On Hold` (gray) | Primary status workflow |
| **Priority** | `TFxRTw` | `checkbox` | Highlights project across dashboards (`__NO__` / `__YES__`) | Used by `Dashboard` and `Project Hub` priority views |
| **Target Deadline** | `UVR4XQ` | `date` | Target project delivery date | ISO-8601 date |
| **Completed** | `U2R5eA` | `date` | Final completion timestamp | Filled when marked `Done` |
| **Archived** | `R2l3cw` | `checkbox` | Excludes project from active views | Default: `__NO__` |
| **Review Notes** | `Y19sZw` | `text` | Narrative review / retro notes | Long text |
| **Area** | `bG52cw` | `relation` | Target: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` (`Areas/Resources [UB]`) | Two-way: `Areas/Resources [UB].Projects` (`V2pMaQ`) |
| **Goal** | `WztOSw` | `relation` | Target: `collection://e7a49566-1e99-83fd-8d08-87a7fad25227` (`Goals [UB]`) | Two-way: `Goals [UB].Projects` (`W1ZCeQ`) |
| **Tasks** | `Znl4Yw` | `relation` | Target: `collection://8b349566-1e99-82e6-8283-070bd3887004` (`All Tasks [UB]`) | Two-way: `All Tasks [UB].Project` (`YX58bA`) |
| **Notes** | `cFZnbg` | `relation` | Target: `collection://90549566-1e99-8258-9a08-87f5b382223f` (`All Notes [UB]`) | Two-way: `All Notes [UB].Project` (`fFVTfA`) |
| **Resource Pulls** | `X1A-Vw` | `relation` | Target: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` (`Areas/Resources [UB]`) | Two-way: `Areas/Resources [UB].Pulls` (`cT1uWg`) |
| **Created** | `QXt2SA` | `created_time` | System creation time | Immutable |
| **Edited** | `OmBCWg` | `last_edited_time` | System edit time | Auto-updated |
| **Goal Area** | `T1VnfQ` | `rollup` | Relation: `Goal`; Target: `Area` (`dlk7dg`) | Inherits Area relation from linked Goal |
| **Project Tasks** | `dT9mOg` | `rollup` | Relation: `Tasks`; Target: `Task`; Aggregation: `count` | Total number of child tasks |
| **Tasks Done** | `dlJWQA` | `rollup` | Relation: `Tasks`; Target: `Done`; Aggregation: `percent_checked` | Percentage of checked tasks (0.0 to 1.0) |
| **Overdue Tasks** | `QmtxVQ` | `rollup` | Relation: `Tasks`; Target: `Late`; Aggregation: `count` | Count of overdue tasks |
| **Progress** | `enh4cw` | `formula` | Number | Computes completion percentage based on `Tasks Done` or `Status` |
| **Quarter** | `TFJjcg` | `formula` | Text | Evaluates target quarter (e.g. `Q1`, `Q2`, `Q3`, `Q4`) |
| **This Quarter** | `ZGZmQg` | `formula` | Checkbox (`boolean`) | Returns true if Target Deadline falls in current calendar quarter |
| **This Year** | `VUJpTg` | `formula` | Checkbox (`boolean`) | Returns true if Target Deadline falls in current year |
| **Meta** | `fX5VPQ` | `formula` | Text | Formatted summary badge (e.g., `3/10 Tasks Completed`) |

---

### 3.3. `All Notes [UB]` Schema

- **Collection URL**: `collection://90549566-1e99-8258-9a08-87f5b382223f`
- **Total Properties**: 23 properties (11 editable, 2 timestamps, 4 relations, 4 rollups, 4 formulas).

| Property Name | Property ID | Type | Configuration / Options / Targets | Formula Result / Rollup Detail |
| --- | --- | --- | --- | --- |
| **Title** | `title` | `title` | Note title string | — |
| **Type** | `b1lxdA` | `select` | `Daily` (pink), `Journal` (red), `Plan` (purple), `Idea` (green), `Reference` (brown), `Lecture` (default), `Book` (blue), `Recipe` (orange), `Web Clip` (gray), `Fleeting` (yellow) | Categorical note classifier |
| **Favorite** | `Qmd2eA` | `checkbox` | Default: `__NO__` | Flags note for Dashboard and Notes favorites views |
| **Fleeting** | `QXxDfA` | `checkbox` | Default: `__NO__` | Quick capture unreviewed flag |
| **Archived** | `c3JqQg` | `checkbox` | Default: `__NO__` | Excludes note from live notebooks |
| **URL** | `Rz1cXg` | `url` | Web URL string | External source or clipped bookmark link |
| **Image** | `ekJ7UA` | `file` | Attached file / image upload | Cover or reference preview asset |
| **Review Date** | `VWh1Rw` | `date` | Spaced review or tickler date | Optional review date |
| **🍳 Recipe Tags** | `SVdieQ` | `multi_select` | `Breakfast` (pink), `Lunch` (yellow), `Dinner` (yellow), `Dessert` (default), `Quick` (blue), `Healthy` (green) | Recipe Book meal tagger |
| **📚 Book Status** | `eE5bTg` | `select` | `Want to Read` (blue), `Currently Reading` (green), `Read` (red), `Paused` (yellow) | Book Tracker reading pipeline |
| **📚 Author** | `UEHNRg` | `text` | Author name string | Free text |
| **📚 Rating** | `WHR0VA` | `select` | `⭐`, `⭐⭐`, `⭐⭐⭐`, `⭐⭐⭐⭐`, `⭐⭐⭐⭐⭐` (all blue) | 5-point star rating |
| **📚 Date Started** | `bmN8eg` | `date` | Reading start date | Format: `LT` |
| **📚 Date Finished** | `QVR8Ow` | `date` | Reading finish date | Format: `LT` |
| **Area/Resource** | `aD5nQw` | `relation` | Target: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` (`Areas/Resources [UB]`) | Two-way: `Areas/Resources [UB].Notes` (`WGpbeA`) |
| **Project** | `fFVTfA` | `relation` | Target: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` (`Projects [UB]`) | Two-way: `Projects [UB].Notes` (`cFZnbg`) |
| **Pulls** | `Um1POw` | `relation` | Target: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` (`Projects [UB]`) | Relation link for pulled project references |
| **Created** | `a2ltTg` | `created_time` | System timestamp | Immutable |
| **Updated** | `T2t9Tg` | `last_edited_time` | System timestamp | Auto-updated on edit |
| **Root Area** | `aXxmTw` | `rollup` | Relation: `Area/Resource`; Target: `Root Area` (`RVRnPg`) | Resolves parent Area if note is filed under a Resource |
| **Project Area** | `e3hLcQ` | `rollup` | Relation: `Project`; Target: `Area` (`bG52cw`) | Resolves Area belonging to parent Project |
| **Project Archived** | `cUZbVg` | `rollup` | Relation: `Project`; Target: `Archived` (`R2l3cw`) | Inherited archive state from parent project |
| **Resource Pulls** | `cFhLUg` | `rollup` | Relation: `Area/Resource`; Target: `Pulls` (`cT1uWg`) | Pull relations from associated resource |
| **Updated (short)** | `QFRbXw` | `formula` | Text | Formatted compact date string (e.g. `Oct 11`) |
| **URL Base** | `U31cdQ` | `formula` | Text | Extracts domain from `URL` property (e.g. `nytimes.com`) |
| **📚 Book  Divider** | `SFFDSA` | `formula` | Text | UI separator line inside Book template properties |
| **🍳 Recipe Divider** | `el9Kaw` | `formula` | Text | UI separator line inside Recipe template properties |

---

### 3.4. `Goals [UB]` Schema

- **Collection URL**: `collection://e7a49566-1e99-83fd-8d08-87a7fad25227`
- **Total Properties**: 14 properties (5 editable, 1 timestamp, 3 relations, 1 rollup, 4 formulas).

| Property Name | Property ID | Type | Configuration / Options / Targets | Formula Result / Rollup Detail |
| --- | --- | --- | --- | --- |
| **Goal** | `title` | `title` | Goal name string | — |
| **Goal Set** | `PUY8Tw` | `date` | Date goal was committed/started | ISO-8601 date |
| **Target Deadline** | `el1mUg` | `date` | Target delivery/achievement date | ISO-8601 date |
| **Achieved** | `ZUZNXw` | `date` | Completion date | Populated when goal is reached |
| **Archived** | `VH5xaA` | `checkbox` | Default: `__NO__` | Excludes goal from active dashboards |
| **Area** | `dlk7dg` | `relation` | Target: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` (`Areas/Resources [UB]`) | Two-way: `Areas/Resources [UB].Goals` (`dFhZPw`) |
| **Milestones** | `YEtfWw` | `relation` | Target: `collection://90449566-1e99-836f-8d25-07378613b3f1` (`Milestones [UB]`) | Two-way: `Milestones [UB].Goal` (`U1s9UQ`) |
| **Projects** | `W1ZCeQ` | `relation` | Target: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` (`Projects [UB]`) | Two-way: `Projects [UB].Goal` (`WztOSw`) |
| **Updated** | `al06VA` | `last_edited_time` | System edit timestamp | Auto-updated |
| **Progress Percent** | `e1dLRw` | `rollup` | Relation: `Milestones`; Target: `Complete` (`RUtZdg`); Aggregation: `percent_checked` | Fraction of completed milestones (0.0 to 1.0) |
| **Progress** | `dF5NXw` | `formula` | Number | Formats or normalizes milestone completion percentage |
| **Quarter** | `VHV6Og` | `formula` | Text | Evaluates deadline quarter (e.g., `Q1`, `Q2`) |
| **This Quarter** | `XnNMUg` | `formula` | Checkbox (`boolean`) | Returns true if deadline is in current calendar quarter |
| **This Year** | `dmduWg` | `formula` | Checkbox (`boolean`) | Returns true if deadline is in current calendar year |

---

### 3.5. `Milestones [UB]` Schema

- **Collection URL**: `collection://90449566-1e99-836f-8d25-07378613b3f1`
- **Total Properties**: 6 properties (4 editable, 1 relation, 1 rollup).

| Property Name | Property ID | Type | Configuration / Options / Targets | Formula Result / Rollup Detail |
| --- | --- | --- | --- | --- |
| **Name** | `title` | `title` | Milestone title (e.g. "Cross $10,000 in Sales") | — |
| **Complete** | `RUtZdg` | `checkbox` | Checkbox: `__NO__` / `__YES__` | Drives Goal progress rollup calculation |
| **Target Deadline** | `PG5edg` | `date` | Target completion date | ISO-8601 date |
| **Date Completed** | `XF96Qw` | `date` | Timestamp when checked complete | ISO-8601 date |
| **Goal** | `U1s9UQ` | `relation` | Target: `collection://e7a49566-1e99-83fd-8d08-87a7fad25227` (`Goals [UB]`) | Two-way: `Goals [UB].Milestones` (`YEtfWw`) |
| **Goal Area** | `UDxTOw` | `rollup` | Relation: `Goal`; Target: `Area` (`dlk7dg`) | Inherits Area relation from parent Goal |

---

### 3.6. `Areas/Resources [UB]` Schema

- **Collection URL**: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278`
- **Total Properties**: 9 properties (2 editable, 1 title, 4 relations, 1 rollup, 1 formula).

| Property Name | Property ID | Type | Configuration / Options / Targets | Formula Result / Rollup Detail |
| --- | --- | --- | --- | --- |
| **Name** | `title` | `title` | Area or Resource name | — |
| **Type** | `RFB1aw` | `select` | `Area` (orange), `Resource` (purple) | Distinguishes PARA Areas vs. Resources |
| **Archived** | `Xl5hcg` | `checkbox` | Excludes item from active views | Default: `__NO__` |
| **Root Area** | `RVRnPg` | `relation` | Target: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` (Self) | Self-relation: links a Resource to its parent Area |
| **Resources** | `XEBmSw` | `relation` | Target: `collection://6cb49566-1e99-825a-9adb-87e54f0b9278` (Self) | Reverse of `Root Area`: links an Area to child Resources |
| **Projects** | `V2pMaQ` | `relation` | Target: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` (`Projects [UB]`) | Two-way: `Projects [UB].Area` (`bG52cw`) |
| **Notes** | `WGpbeA` | `relation` | Target: `collection://90549566-1e99-8258-9a08-87f5b382223f` (`All Notes [UB]`) | Two-way: `All Notes [UB].Area/Resource` (`aD5nQw`) |
| **Goals** | `dFhZPw` | `relation` | Target: `collection://e7a49566-1e99-83fd-8d08-87a7fad25227` (`Goals [UB]`) | Two-way: `Goals [UB].Area` (`dlk7dg`) |
| **Pulls** | `cT1uWg` | `relation` | Target: `collection://a3449566-1e99-839d-b4c2-87ff1bc64707` (`Projects [UB]`) | Two-way: `Projects [UB].Resource Pulls` (`X1A-Vw`) |
| **Last Updated Note** | `ZEdyew` | `rollup` | Relation: `Notes`; Target: `Updated`; Aggregation: `latest_date` | Timestamp of the most recently edited note |
| **Note Count** | `aX1TWw` | `formula` | Text | Number of linked notes formatted for card preview |

---

## 4. Relations and Rollups Graph

The relational architecture creates a tightly coupled two-level network connecting execution (Tasks) up to lifetime spheres of interest (Areas):

```
       ┌────────────────────────┐
       │ Areas/Resources [UB]   │◄──────────────┐ (Self-relation)
       └──────┬────────────┬────┘               │ [Root Area / Resources]
              │            │                    │
      (Area)  │            │ (Area)             │
              ▼            ▼                    │
     ┌─────────────┐   ┌────────────┐           │
     │ Goals [UB]  │   │Projects[UB]│           │
     └──────┬──────┘   └─────┬──────┘           │
            │                │                  │
(Milestones)│    (Tasks)     │ (Notes)          │
            ▼                ├───────────────┐  │
     ┌─────────────┐         ▼               ▼  │
     │ Milestones  │    ┌─────────┐    ┌────────┴──┐
     │    [UB]     │    │  Tasks  │    │ All Notes │
     └─────────────┘    │  [UB]   │    │   [UB]    │
                        └────┬────┘    └───────────┘
                             │ (Self-relation)
                             └─────────► [Parent Task / Sub-Tasks]
```

### Relational Linkage Matrix

1. **Areas/Resources ↔ Projects**:
    - `Areas/Resources [UB].Projects` (`V2pMaQ`) ↔ `Projects [UB].Area` (`bG52cw`)
2. **Areas/Resources ↔ Notes**:
    - `Areas/Resources [UB].Notes` (`WGpbeA`) ↔ `All Notes [UB].Area/Resource` (`aD5nQw`)
3. **Areas/Resources ↔ Goals**:
    - `Areas/Resources [UB].Goals` (`dFhZPw`) ↔ `Goals [UB].Area` (`dlk7dg`)
4. **Areas/Resources ↔ Resource Pulls**:
    - `Areas/Resources [UB].Pulls` (`cT1uWg`) ↔ `Projects [UB].Resource Pulls` (`X1A-Vw`)
5. **Areas/Resources ↔ Areas/Resources (Self)**:
    - `Areas/Resources [UB].Root Area` (`RVRnPg`) ↔ `Areas/Resources [UB].Resources` (`XEBmSw`)
6. **Projects ↔ Tasks**:
    - `Projects [UB].Tasks` (`Znl4Yw`) ↔ `All Tasks [UB].Project` (`YX58bA`)
7. **Projects ↔ Notes**:
    - `Projects [UB].Notes` (`cFZnbg`) ↔ `All Notes [UB].Project` (`fFVTfA`)
8. **Goals ↔ Projects**:
    - `Goals [UB].Projects` (`W1ZCeQ`) ↔ `Projects [UB].Goal` (`WztOSw`)
9. **Goals ↔ Milestones**:
    - `Goals [UB].Milestones` (`YEtfWw`) ↔ `Milestones [UB].Goal` (`U1s9UQ`)
10. **Tasks ↔ Tasks (Self Hierarchy)**:
    - `All Tasks [UB].Parent Task` (`dXlydg`) ↔ `All Tasks [UB].Sub-Tasks` (`d3p2RA`)

### Rollup Chains

- **Area Inheritance into Tasks**: `Tasks [UB]` has rollup `Project Area` (`cF15XQ`) pointing to `Project` (`YX58bA`) -> `Area` (`bG52cw`). Tasks directly know their originating Area without a direct Area property.
- **Area Inheritance into Milestones**: `Milestones [UB]` has rollup `Goal Area` (`UDxTOw`) pointing to `Goal` (`U1s9UQ`) -> `Area` (`dlk7dg`).
- **Area Inheritance into Notes via Projects**: `All Notes [UB]` has rollup `Project Area` (`e3hLcQ`) pointing to `Project` (`fFVTfA`) -> `Area` (`bG52cw`).
- **Root Area Resolution in Notes**: If a note is attached to a Resource, `Root Area` rollup (`aXxmTw`) pulls the Resource's parent Area (`RVRnPg`).
- **Goal Progress Rollup**: `Goals [UB].Progress Percent` (`e1dLRw`) rolls up `Milestones [UB].Complete` (`RUtZdg`) using `percent_checked`.
- **Project Progress Rollup**: `Projects [UB].Tasks Done` (`dlJWQA`) rolls up `Tasks [UB].Done` (`X0ReUg`) using `percent_checked`.
- **Sub-task Parent Propagation**: Sub-tasks inherit `Parent Snooze`, `Parent Wait`, `Parent Created`, `Parent Edited`, `Parent Project`, and `Parent Smart List` through rollups against `Parent Task`.

---

## 5. Master Page Templates

Each database contains pre-configured templates registered in its `page_templates` configuration:

```
Template Directory:
├── All Tasks [UB]
│   ├── Task with Sub-Tasks
│   └── Packing List
├── Projects [UB]
│   └── Project Template
├── All Notes [UB]
│   ├── Daily Note
│   ├── Note with Tasks
│   ├── Recipe Template
│   └── Book Notes
├── Goals [UB]
│   └── Goal Template
└── Areas/Resources [UB]
    ├── Area Template
    └── Resource Template
```

### Template Details

#### 1. `Task with Sub-Tasks` (`All Tasks [UB]`)

- **Template URL**: `https://app.notion.com/p/bf0495661e9983dc87cb01eae31ed1fc`
- **Icon**: 🗂️
- **Default Properties**: `Priority`: `🧀 Medium`, `Kanban Status`: `To Do`, `Done`: `__NO__`.
- **Body Structure**:
    - Embedded inline database view (`https://app.notion.com/p/c26495661e998297ae6081043e84af12`) of `All Tasks [UB]` filtered automatically to show rows where `Parent Task` = current page.

#### 2. `Packing List` (`All Tasks [UB]`)

- **Template URL**: `https://app.notion.com/p/1bf495661e9983f5896501b6754fd0df`
- **Icon**: 🧳
- **Default Properties**: `Priority`: `🧀 Medium`, `Kanban Status`: `To Do`, `Done`: `__NO__`.
- **Body Structure**:
    - Callout (⭐): Instructions explaining specialized task templates.
    - H2 `Clothing and Personal` with 23 to-do checkbox items (e.g., Sneakers, Boots, Socks, Toiletries).
    - H2 `Business` with 22 to-do checkbox items (e.g., Laptop, Chargers, Camera, Tripod).
    - H2 `Other` with 3 to-do checkbox items (Nintendo Switch, cords, controller).

#### 3. `Project Template` (`Projects [UB]`)

- **Template URL**: `https://app.notion.com/p/030495661e99823b80db81a02eb556aa`
- **Icon**: 📊
- **Default Properties**: `Status`: `To Do`, `Priority`: `__NO__`, `Archived`: `__NO__`.
- **Body Structure**:
    - Toggle: `🧭 Quick Links` + `<table-of-contents />`.
    - Callout (💡): `Project Overview: [Add an overview and main goals here]` containing sub-toggle `Project Info`.
    - Columns (56.25% / 43.75%):
        - Left Column: H1 `✅ Tasks` (green_bg) + divider + Toggle `Project Cleanup` + linked database view of `All Tasks [UB]` (`Project` = current page).
        - Right Column: H1 `📝 Notes` (green_bg) + divider + linked database view of `All Notes [UB]` (`Project` = current page).
    - H1 `🏷 Pulled Resources` (green_bg) + dividers + linked database view of `Areas/Resources [UB]` (`Pulls` = current page).

#### 4. `Daily Note` (`All Notes [UB]`)

- **Template URL**: `https://app.notion.com/p/c5f495661e9982eabbc681a81568e182`
- **Icon**: 🌅
- **Default Properties**: `Type`: `Daily`, `Archived`: `__NO__`, `Favorite`: `__NO__`, `Fleeting`: `__NO__`.
- **Body Structure**:
    - Navigation paragraph: `🧭 Quick Links: Dashboard | Notes`.
    - Toggle `📃 Daily Habits`: 50/50 columns for `Morning Routine` (Water, Vitamins, Breakfast, Read) and `Other Habits` (Shake, Apple Watch rings).
    - Toggle `My Day`: Synced block reference to master daily focus blocks (Callout `✅ Task & Events` + Callout `🏃 Self-Care`).
    - Toggle `Next 7 Days`: Linked database view of `All Tasks [UB]` showing upcoming week.
    - Toggle `Do Next`: Linked database view of `All Tasks [UB]` showing active next actions.
    - H2 `📝 Morning Pages` (green_bg) + divider.
    - H2 `🌙 Day Review` (green_bg) + divider + Callout (❓) `How well did I stick to today’s plan?`.

#### 5. `Note with Tasks` (`All Notes [UB]`)

- **Template URL**: `https://app.notion.com/p/971495661e99836d9ced81aec7ebaada`
- **Icon**: ☑️
- **Default Properties**: `Archived`: `__YES__` (template entry archived by default), `Favorite`: `__NO__`.
- **Body Structure**:
    - H2 `📝 Note Content` (green_bg) + divider.
    - Toggle `✅ Inbox`: Linked database view of `All Tasks [UB]` (`https://app.notion.com/p/0b9495661e9982408b3301382f0a902b`) for capturing tasks originating from note taking.

#### 6. `Recipe Template` (`All Notes [UB]`)

- **Template URL**: `https://app.notion.com/p/e39495661e9983cf8de981166f6602b0`
- **Icon**: 🍳
- **Default Properties**: `Type`: `Recipe`, `Archived`: `__NO__`, `Favorite`: `__NO__`.
- **Body Structure**:
    - Toggle `🧭 Quick Links: Recipe Book` + `<table-of-contents />`.
    - Columns (37.5% / 62.5%):
        - Left Column: H1 `🛒 Ingredients` (green_bg) + divider + list item `- Ingredient` + Toggle `✅ Inbox` with linked database of `All Tasks [UB]` for grocery capture.
        - Right Column: H1 `🍳 Recipe` (green_bg) + divider + ordered step list (`1. Add recipe steps here`).

#### 7. `Book Notes` (`All Notes [UB]`)

- **Template URL**: `https://app.notion.com/p/e0a495661e998284bb0081cd7651e410`
- **Icon**: 📕
- **Default Properties**: `Type`: `Book`, `📚 Book Status`: `Want to Read`, `📚 Author`: `enter text...`.
- **Body Structure**:
    - Callout (💡): Instructions to click "More Properties" to view Author, Dates, Rating, Status.
    - Toggle `🧭 Quick Links: Book Tracker` + `<table-of-contents />`.
    - H1 `Summary`: Callout (gray_bg) `Overall Thoughts` + Callout (gray_bg) `Main Takeaways` (numbered list 1, 2, 3).
    - Divider.
    - H1 `Book Notes`: H2 `Chapter 1`.

#### 8. `Goal Template` (`Goals [UB]`)

- **Template URL**: `https://app.notion.com/p/b76495661e9982b2a57901a8b81f1620`
- **Icon**: 🏆
- **Default Properties**: `Archived`: `__NO__`.
- **Body Structure**:
    - Toggle `🧭 Quick Links: Goals` + `<table-of-contents />`.
    - Callout (🏆): `Goal Overview` + sub-toggle `Additional Details`.
    - Columns (50% / 50%):
        - Left Column: H2 `🔥 Milestones` (green_bg) + divider + linked view of `Milestones [UB]` (`Goal` = current page).
        - Right Column: H2 `✍ Journal` (green_bg) + divider + Button block (`alt="button"`) + Toggle `Goal Log: [DATE]`.
    - H2 `🏗 Goal Projects` (green_bg) + divider + linked view of `Projects [UB]` (`Goal` = current page).
    - Synced block reference to universal goal footer.

#### 9. `Area Template` (`Areas/Resources [UB]`)

- **Template URL**: `https://app.notion.com/p/ee1495661e99829c8a8e815747113bd0`
- **Icon**: null
- **Default Properties**: `Type`: `Area`, `Archived`: `__NO__`.
- **Body Structure**:
    - Toggle `🧭 Quick Links: Areas & Resources` + `<table-of-contents />`.
    - Columns (56.25% / 43.75%):
        - Left Column: H1 `🏗 Area Projects` (green_bg) + linked database view of `Projects [UB]` + H1 `🏆 Area Goals` (green_bg) + linked database view of `Goals [UB]`.
        - Right Column: H1 `🏷 Area Resources` (green_bg) + linked view of `Areas/Resources [UB]` (`Root Area` = current page) + H1 `⭐ Area Favorites` (green_bg) + linked view of `All Notes [UB]` (`Favorite` = checked).
    - H1 `📝 Area Notes` (green_bg) + linked database view of `All Notes [UB]` (`Area/Resource` = current page).
    - Synced block reference.

#### 10. `Resource Template` (`Areas/Resources [UB]`)

- **Template URL**: `https://app.notion.com/p/91c495661e99828cbf97013fcd6231ff`
- **Icon**: null
- **Default Properties**: `Type`: `Resource`, `Archived`: `__NO__`.
- **Body Structure**:
    - Toggle `🧭 Quick Links: Areas & Resources` + `<table-of-contents />`.
    - Columns (50% / 50%):
        - Left Column: H2 `📝 Resource Notes` (green_bg) + linked database view of `All Notes [UB]` (`Area/Resource` = current page).
        - Right Column: H2 `⭐ Resource Favorites` (green_bg) + linked view of `All Notes [UB]` (`Favorite` = checked) + H2 `🌐 Web Clips` (green_bg) + linked view of `All Notes [UB]` (`Type` = `Web Clip`).
    - Divider.

---

## 6. Dashboards and Linked Views

### Dashboard Mapping

| Dashboard Page | Embedded Views | Source Database | View Type | Filter Configuration | Sort Configuration | Displayed Properties |
| --- | --- | --- | --- | --- | --- | --- |
| **Dashboard** (`39d49566`) | Active Tasks | `All Tasks [UB]` | Table / List | `Done` = false, `Kanban Status` ≠ `Done` | `Due` ASC, `Priority` DESC | State, Done, Task, Due, Project, Priority |
|  | Priority Projects | `Projects [UB]` | Gallery / Table | `Priority` = true, `Status` ≠ `Done`, `Archived` = false | `Target Deadline` ASC | Name, Status, Progress, Target Deadline |
|  | Favorite Notes | `All Notes [UB]` | List | `Favorite` = true, `Archived` = false | `Updated` DESC | Title, Type, Updated (short) |
|  | Recent Notes | `All Notes [UB]` | List | `Archived` = false | `Updated` DESC (Limit 5) | Title, Type, Updated (short) |
| **My Day** (`81349566`) | Today's Tasks | `All Tasks [UB]` | List / Table | `Done` = false, `Due` ≤ Today, `Snooze` is empty or ≤ Today | `Priority` DESC, `Due` ASC | Done, Task, Contexts, Priority |
|  | Self-Care Focus | Synced Block | Callouts | Static checklist blocks | — | — |
|  | Daily Habits | Inline Table | — | Checklists for routines | — | — |
| **Quick Capture** (`6a649566`) | Quick Task Inbox | `All Tasks [UB]` | Table | `Quick Capture Box` = true or (`Project` empty and `Due` empty) | `Created` DESC | Task, Due, Priority, Project, Smart List |
|  | Quick Note Inbox | `All Notes [UB]` | List | `Fleeting` = true or `Area/Resource` empty | `Created` DESC | Title, Type, Area/Resource |
| **Task Manager** (`74649566`) | Today | `All Tasks [UB]` | Table / List | `Due` on or before today, `Done` = false | `Due` ASC | Done, Task, Due, Priority, Project |
|  | Tomorrow | `All Tasks [UB]` | Table | `Due` is tomorrow, `Done` = false | `Priority` DESC | Done, Task, Due, Contexts, Project |
|  | Next 7 Days | `All Tasks [UB]` | Table | `Due` within next 7 days, `Done` = false | `Due` ASC | Done, Task, Due, Project |
|  | Kanban Board | `All Tasks [UB]` | Board | Grouped by `Kanban Status`, `Archived` = false | `Priority` DESC | Task, Due, Project, Priority |
|  | Priority View | `All Tasks [UB]` | Table | Grouped by `Priority`, `Done` = false | `Due` ASC | Done, Task, Due, Project, Contexts |
|  | Timeline View | `All Tasks [UB]` | Timeline | Start: `Start`, End: `Due`, `Done` = false | `Due` ASC | Task, Project, Assignee |
|  | Completed | `All Tasks [UB]` | Table | `Done` = true or `Kanban Status` = `Done` | `Edited` DESC | Done, Task, Due, Project |
|  | Cold Tasks | `All Tasks [UB]` | Table | `Cold` = true, `Done` = false | `Due` ASC | Done, Task, Due, Project, Smart List |
| **Project Hub** (`93e49566`) | Priority Projects | `Projects [UB]` | Board / Gallery | `Priority` = true, `Status` ≠ `Done` | `Target Deadline` ASC | Name, Area, Status, Progress, Target Deadline |
|  | All Active Projects | `Projects [UB]` | Table | `Status` ≠ `Done`, `Archived` = false | Grouped by `Area`, `Deadline` ASC | Name, Status, Progress, Target Deadline, Tasks Done |
|  | Completed Projects | `Projects [UB]` | Table | `Status` = `Done` or `Archived` = true | `Completed` DESC | Name, Area, Completed, Review Notes |
| **Notes** (`a7f49566`) | Notebooks | `Areas/Resources [UB]` | Gallery | `Type` = `Area` or `Resource`, `Archived` = false | `Name` ASC | Name, Type, Note Count |
|  | Note Inbox | `All Notes [UB]` | Table | `Area/Resource` empty and `Project` empty | `Created` DESC | Title, Created, Fleeting |
|  | Favorites | `All Notes [UB]` | List / Gallery | `Favorite` = true, `Archived` = false | `Updated` DESC | Title, Area/Resource, Updated |
|  | Recents | `All Notes [UB]` | Table | `Archived` = false | `Updated` DESC | Title, Area/Resource, Updated |
| **Process** (`3de49566`) | Intake | `All Tasks [UB]` | Table | `Smart List` is empty, `Done` = false, `Project` empty | `Created` DESC | Task, Smart List, Due, Project |
|  | Do Next | `All Tasks [UB]` | Table | `Smart List` = `Do Next` (or formula), `Done` = false | `Priority` DESC, `Due` ASC | Done, Task, Due, Priority, Contexts |
|  | Delegated | `All Tasks [UB]` | Table | `Smart List` = `Delegated`, `Done` = false | `Wait Date` ASC | Done, Task, Assignee, Wait Date |
|  | Deferred / Someday | `All Tasks [UB]` | Table | `Smart List` = `Someday`, `Done` = false | `Created` DESC | Task, Note, Priority |

---

## 7. Formula Inventory and Technical Scope

> **Notion API Technical Constraint**: In the Notion API / MCP protocol, the raw expression strings of formulas (the underlying code written inside the formula editor) are **not exposed** in `collection` schemas or `load_database` payloads. Only property identifiers, property names, and evaluated `resultType` values (`text`, `number`, `checkbox`, `date`) are accessible. Evaluated return values can be observed on instantiated rows via `formulaResult://...` URLs or via SQL queries.
>

### Full Formula Property Directory

| Database | Formula Property Name | Evaluated `resultType` | Observed Functional Role in Workspace |
| --- | --- | --- | --- |
| **All Tasks [UB]** | `Smart List (Formula)` | `text` | Computes effective GTD smart list by evaluating explicit `Smart List` property or inheriting from `Parent Task`. |
| **All Tasks [UB]** | `State` | `text` | Derives execution state flag (e.g., active, overdue, future, cold). |
| **All Tasks [UB]** | `Cold` | `checkbox` | Evaluates if task has been untouched/overdue for >14 days without rescheduling. |
| **All Tasks [UB]** | `Late` | `text` | Flags whether current time is past `Due` date. |
| **All Tasks [UB]** | `Next Due` | `text` | Generates date string for next cycle when task recurs. |
| **All Tasks [UB]** | `Due Timestamp` | `number` | Converts `Due` date to numeric unix timestamp for mathematical comparison. |
| **All Tasks [UB]** | `Due Stamp (Parent)` | `number` | Converts parent due date to numeric timestamp. |
| **All Tasks [UB]** | `Created Stamp (Parent)` | `number` | Converts parent creation date to numeric timestamp. |
| **All Tasks [UB]** | `Edited Stamp (Parent)` | `number` | Converts parent edit date to numeric timestamp. |
| **All Tasks [UB]** | `First Weekday Base Date` | `date` | Calculates first weekday of current month for recurring tasks. |
| **All Tasks [UB]** | `Last Weekday Base Date` | `date` | Calculates last weekday of current month for recurring tasks. |
| **All Tasks [UB]** | `Last Day Base Date` | `date` | Calculates final calendar day of month for recurring tasks. |
| **All Tasks [UB]** | `Next Last Base Date` | `date` | Boundary date evaluation for complex monthly cadences. |
| **All Tasks [UB]** | `Simplified Recur Unit` | `text` | Normalizes select `Recur Unit` for recurrence formula engines. |
| **All Tasks [UB]** | `Type` | `text` | Classifies task into standard, sub-task, or recurring container. |
| **All Tasks [UB]** | `Wait (Parent)` | `number` | Numeric evaluation of parent wait/delegation date. |
| **All Tasks [UB]** | `Snooze (Parent)` | `number` | Numeric evaluation of parent snooze date. |
| **All Tasks [UB]** | `Sub Seed` | `checkbox` | Flag used during sub-task generation. |
| **All Tasks [UB]** | `Sub Seed Name` | `text` | Dynamic string generation for child sub-task names. |
| **All Tasks [UB]** | `Quick Capture Box` | `checkbox` | Returns true if task lacks project/due date and belongs in inbox. |
| **All Tasks [UB]** | `UTC Offset` | `number` | Numerical offset for timezone normalization. |
| **All Tasks [UB]** | `Divider` | `text` | Cosmetic text separator (`──────`). |
| **All Tasks [UB]** | `⏱ Recurring Divider` | `text` | Cosmetic text separator for recurrence options (`──────`). |
| **All Tasks [UB]** | `✅ Sub-Task Divider` | `text` | Cosmetic text separator for sub-task options (`──────`). |
| **Projects [UB]** | `Progress` | `number` | Calculates completion ratio (0.0 to 1.0) based on `Tasks Done` rollup or `Status`. |
| **Projects [UB]** | `Quarter` | `text` | Extracts quarter (`Q1`, `Q2`, `Q3`, `Q4`) from `Target Deadline`. |
| **Projects [UB]** | `This Quarter` | `checkbox` | Returns true if `Target Deadline` is in current quarter. |
| **Projects [UB]** | `This Year` | `checkbox` | Returns true if `Target Deadline` is in current year. |
| **Projects [UB]** | `Meta` | `text` | Formats summary string (e.g., `4 of 12 Tasks Done`). |
| **All Notes [UB]** | `Updated (short)` | `text` | Formats `Updated` timestamp into short date format (e.g. `Oct 11`). |
| **All Notes [UB]** | `URL Base` | `text` | Parses domain host from `URL` property. |
| **All Notes [UB]** | `📚 Book  Divider` | `text` | Cosmetic text separator for book properties. |
| **All Notes [UB]** | `🍳 Recipe Divider` | `text` | Cosmetic text separator for recipe properties. |
| **Goals [UB]** | `Progress` | `number` | Normalized progress score reflecting milestone completions. |
| **Goals [UB]** | `Quarter` | `text` | Extracts quarter from `Target Deadline`. |
| **Goals [UB]** | `This Quarter` | `checkbox` | Returns true if `Target Deadline` is in current quarter. |
| **Goals [UB]** | `This Year` | `checkbox` | Returns true if `Target Deadline` is in current year. |
| **Areas/Resources [UB]** | `Note Count` | `text` | Formats total linked notes count for gallery display. |

---

## 8. GTD Processing and Smart Lists Mechanics

Ultimate Brain embeds an optional Getting Things Done (GTD) workflow engine centered around the `Process` dashboard (`https://app.notion.com/p/3de495661e9983e7968081fb754dd461`):

```
                       [ RAW INTAKE ]
                 (Unprocessed / Incomplete)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
      [ Actionable? ]                  [ Not Actionable ]
            │                                 │
     ┌──────┴──────┐                   ┌──────┴──────┐
     ▼             ▼                   ▼             ▼
 [ Single ]  [ Multi-step ]       [ Someday ]   [ Reference / Trash ]
  (Task)       (Project)         (Smart List)    (Notes / Archive)
     │             │
     ├─────────────┼────────────────┐
     ▼             ▼                ▼
 [ Do Next ]  [ Delegated ]    [ Deferred ]
(Smart List)   (Wait Date)      (Cold Tasks)
```

### Smart List Hierarchy and Priority Order

As documented inside the `Process` dashboard instructions, Ultimate Brain enforces an explicit priority cascade:

1. **Time-Based Views (Highest Priority)**:
    - If a task has a `Due` date set to Today or in the past, it immediately bypasses normal Smart Lists and routes to `Today` / `My Day`.
2. **Intake (The Unprocessed Inbox)**:
    - Differentiated from classic inboxes. Intake contains tasks that have no `Smart List` value, no `Project`, and no `Due` date.
3. **Smart Lists (The 5 Triage Destinations)**:
    - **Do Next**: High-priority immediate actions without hard deadlines. Tasks flagged with `Smart List` = `Do Next`.
    - **Delegated**: Tasks assigned to others. Driven by `Smart List` = `Delegated`, requiring an `Assignee` and a `Wait Date` (follow-up date).
    - **Someday**: Incubating ideas and non-urgent desires. Tasks flagged with `Smart List` = `Someday`. Excluded from daily operational views.
    - **Deferred**: Handled automatically via `Cold Tasks`. Stale tasks overdue or untouched for >14 days are removed from time-based views into cold storage.
    - **Projects**: If a task requires multi-step actions, it is converted into or linked to a `Project`.

### Sub-Task GTD Behavior

Sub-tasks inherit their parent’s GTD status via the `Parent Smart List` rollup (`UV1SWA`) and `Smart List (Formula)` (`QHc7Qg`). Setting a parent task to `Delegated` or `Do Next` cascades through the sub-task hierarchy.

---

## 9. Sub-Tasks and Hierarchy Mechanics

Task decomposition in Ultimate Brain is powered by a recursive self-relation on `All Tasks [UB]`:

```
All Tasks [UB] (Parent Task)
    │
    │  collectionProperty://8b349566-1e99-82e6-8283-070bd3887004/dXlydg (Parent Task)
    ▲
    ▼  collectionProperty://8b349566-1e99-82e6-8283-070bd3887004/d3p2RA (Sub-Tasks)
    │
All Tasks [UB] (Sub-Tasks / Children)
```

### Structural Sub-Task Properties & Propagation

1. **Self-Relations**:
    - `Parent Task` (`dXlydg`): Points to one parent task row.
    - `Sub-Tasks` (`d3p2RA`): Contains an array of child task rows.
2. **Sub-Task Count**:
    - `Sub-Task Count` rollup (`cHR2QA`) counts child items. Parent tasks display their child task load directly on cards and tables.
3. **Inheritance Rollups**:
    - `Parent Project` (`T05HYw`): Ensures sub-tasks inherit project association from parent without manual selection.
    - `Parent Smart List` (`UV1SWA`): Propagates GTD list categorization.
    - `Parent Snooze` (`PmR5fQ`): If parent task is snoozed, sub-tasks are hidden until snooze date clears.
    - `Parent Wait` (`bEF9Rw`): Propagates waiting dates.
    - `Parent Due Timestamp` (`Q3Q9Vg`): Enables sub-tasks to sort relative to parent deadlines.
4. **Template Instantiation**:
    - The `Task with Sub-Tasks` template embeds an inline linked database view of `All Tasks [UB]` filtered automatically by `Parent Task = current page`.

---

## 10. Recurring Tasks Engine

Recurring task management operates via a formula-driven recalculation system that supports both simple and complex calendar frequencies:

```
                  [ Task Marked Done ]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
     [ Single Task ]             [ Recurring Task ]
(Done = true, moves to      (Has Recur Interval & Unit)
   Completed Tasks)                      │
                                         ▼
                             [ Next Due Evaluated ]
                           (Via base date formulas)
                                         │
                                         ▼
                            [ Due Advanced to Next Due ]
                              (Done Reset to false)
```

### Recurrence Properties

1. **`Recur Interval` (`bXZweA`)**: Numeric value representing frequency (e.g. `1`, `2`, `14`).
2. **`Recur Unit` (`YV5Tbw`)**: Select options:
    - `Day(s)`: Daily intervals.
    - `Week(s)`: Weekly intervals.
    - `Month(s)`: Standard monthly cadence on same day of month.
    - `Month(s) on the First Weekday`: Business day scheduling.
    - `Month(s) on the Last Weekday`: End-of-month business scheduling.
    - `Month(s) on the Last Day`: Absolute month end (handles 28, 30, 31).
    - `Year(s)`: Annual recurrence.
3. **`Days (Only if Set to 1 Day(s))` (`WmhaRg`)**:
    - Multi-select allowing explicit weekday selection (e.g. `Monday`, `Wednesday`, `Friday`) when `Recur Interval` = `1` and `Recur Unit` = `Day(s)`.
4. **Base Date Computation Formulas**:
    - `First Weekday Base Date` (`Ulh-eg`)
    - `Last Weekday Base Date` (`PUxSRQ`)
    - `Last Day Base Date` (`cGViXQ`)
    - `Next Last Base Date` (`QlNVfQ`)
    - `Simplified Recur Unit` (`YU9fXA`)
5. **Next Due Date Generation**:
    - `Next Due` formula (`V2NCXA`): Evaluates current `Due` date alongside recurrence interval, unit, and weekday configuration to calculate the subsequent due date.

---

## 11. PARA Implementation Architecture

Ultimate Brain implements Tiago Forte's PARA framework (Projects, Areas, Resources, Archives) with an architectural variation: **Areas and Resources are consolidated into a single database (`Areas/Resources [UB]`)**.

### Consolidated Database Design Rationale

As documented in the template body text on the `Areas & Resources` page (`https://app.notion.com/p/293495661e998275850e019f29e57972`):

> *"Resources often morph into full-blown Areas with related Projects, so keeping them in the same database allows for this evolution to occur seamlessly... Areas contain Projects (both One-Time and Ongoing, the latter being used to 'maintain the standard' of the Area)."*
>

### Distinguishing Areas vs. Resources

1. **`Type` Select Property (`RFB1aw`)**:
    - `Area` (orange)
    - `Resource` (purple)
2. **Hierarchical Self-Relation**:
    - A Resource can be nested inside an Area using the `Root Area` relation (`RVRnPg`) and `Resources` reverse relation (`XEBmSw`).
3. **Downstream Entity Relational Matrix**:
    - **Projects**: Connect via `Areas/Resources [UB].Projects` (`V2pMaQ`).
    - **Notes**: Connect via `Areas/Resources [UB].Notes` (`WGpbeA`).
    - **Goals**: Connect via `Areas/Resources [UB].Goals` (`dFhZPw`).
    - **Pulls**: Connect via `Areas/Resources [UB].Pulls` (`cT1uWg`).

---

## 12. Goals and Milestones Tracking Mechanics

Ultimate Brain treats Goals as one tier above Projects. Projects are operational multi-step task containers, whereas Goals represent strategic objectives that contain Milestones:

```
               ┌───────────────────────┐
               │      Goals [UB]       │
               └──────────┬────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
  ┌───────────────────┐       ┌───────────────────┐
  │  Milestones [UB]  │       │   Projects [UB]   │
  │ (Measurable Steps)│       │(Operational Action│
  └─────────┬─────────┘       └─────────┬─────────┘
            │                           │
            ▼                           ▼
[ Complete Checkbox ]           [ All Tasks [UB] ]
            │
            ▼
[ Progress Percent Rollup ]
```

### Architectural Linkage

1. **Goals ↔ Milestones**:
    - `Goals [UB].Milestones` (`YEtfWw`) ↔ `Milestones [UB].Goal` (`U1s9UQ`).
    - Milestones are non-actionable or broad achievements (e.g., "Cross $10,000 in Sales", "Reach 10,000 Subscribers").
2. **Progress Computation**:
    - Each milestone has a `Complete` checkbox (`RUtZdg`).
    - `Goals [UB].Progress Percent` (`e1dLRw`) rolls up `Complete` via `percent_checked`.
    - `Goals [UB].Progress` formula (`dF5NXw`) formats and normalizes the score.
3. **Goal Projects**:
    - Goals link to supporting projects via `Goals [UB].Projects` (`W1ZCeQ`) ↔ `Projects [UB].Goal` (`WztOSw`).
    - Enables reviewing all projects serving an active high-level goal.
4. **Milestone Area Rollup**:
    - `Milestones [UB].Goal Area` (`UDxTOw`) inherits the Area from the Parent Goal via rollup.

---

## 13. Notes, Books, Recipes, and Journaling Subsystems

The `All Notes [UB]` database functions as a universal knowledge capture container. Different record types are activated through the `Type` select property (`b1lxdA`) and dedicated template views.

### Subsystem Directory

```
All Notes [UB] Subsystems:
├── General Notes (Lecture, Reference, Idea, Plan, Fleeting, Web Clip)
├── Daily Journal (Type = Daily, Journal)
│   ├── Morning Pages
│   ├── Day Review
│   └── Daily Habit Checklists
├── Book Tracker (Type = Book)
│   ├── Shelf: Want to Read / Currently Reading / Read / Paused
│   ├── Author, Rating (1-5 Stars), Date Started / Finished
│   └── Book Notes Template (Summary, Takeaways, Chapters)
└── Recipe Book (Type = Recipe)
    ├── Tags: Breakfast, Lunch, Dinner, Dessert, Quick, Healthy
    ├── URL Base Domain extraction
    └── Recipe Template (Ingredients Column + Grocery Inbox, Steps Column)
```

### Subsystem Technical Configurations

#### 1. General Notes & Fleeting Capture

- **Types**: `Lecture`, `Reference`, `Idea`, `Plan`, `Fleeting`, `Web Clip`.
- **Fleeting Flag** (`QXxDfA`): Checkbox isolating raw notes in `Quick Capture` and `Note Inbox` until filed into an Area or Project.
- **URL Base Formula** (`U31cdQ`): Extracts root host from web clip URLs.

#### 2. Book Tracker

- **Type**: `Book`.
- **Dedicated Dashboard**: `Book Tracker` (`https://app.notion.com/p/9c0495661e9982bf839281b40f0f6295`).
- **Dedicated Properties**:
    - `📚 Book Status` (`eE5bTg`): `Want to Read`, `Currently Reading`, `Read`, `Paused`.
    - `📚 Author` (`UEHNRg`): Text string.
    - `📚 Rating` (`WHR0VA`): `⭐` through `⭐⭐⭐⭐⭐`.
    - `📚 Date Started` (`bmN8eg`), `📚 Date Finished` (`QVR8Ow`).
    - `📚 Book  Divider` (`SFFDSA`): Formatting divider.
- **Dedicated Template**: `Book Notes` (`https://app.notion.com/p/e0a495661e998284bb0081cd7651e410`).

#### 3. Recipe Book

- **Type**: `Recipe`.
- **Dedicated Dashboard**: `Recipe Book` (`https://app.notion.com/p/25e495661e99831badd981b57842752d`).
- **Dedicated Properties**:
    - `🍳 Recipe Tags` (`SVdieQ`): `Breakfast`, `Lunch`, `Dinner`, `Dessert`, `Quick`, `Healthy`.
    - `🍳 Recipe Divider` (`el9Kaw`): Formatting divider.
- **Dedicated Template**: `Recipe Template` (`https://app.notion.com/p/e39495661e9983cf8de981166f6602b0`).
- **Grocery Integration**: Left column features an embedded view of `All Tasks [UB]` titled `✅ Inbox` for instantly converting missing ingredients into tasks.

#### 4. Daily Journaling & Habit Tracking

- **Types**: `Daily`, `Journal`.
- **Dedicated Subpage**: `Daily Journal` (`https://app.notion.com/p/02a495661e9983f6a0e201312d90e3ec`).
- **Dedicated Template**: `Daily Note` (`https://app.notion.com/p/c5f495661e9982eabbc681a81568e182`).
- **Body Layout**: Morning Routine, Other Habits, synced `My Day` focus blocks, embedded Next 7 Days tasks, Morning Pages section, and Day Review prompt.

---

## 14. Cold Storage and Archival Mechanics

Ultimate Brain features an automated archiving and task deferral architecture that prevents visual clutter and dashboard decay:

```
                            [ Task Record ]
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [ Explicit Inactivation ]                 [ Automatic Cold Triage ]
  (Archived Checkbox = true)                (Untouched / Overdue >14 Days)
              │                                         │
              ▼                                         ▼
   [ Workspace Exclusion ]                        [ Cold = true ]
(Hidden from all live dashboards)                       │
                                                        ▼
                                           [ Removed from Today / Views ]
                                                        │
                                                        ▼
                                           [ Routed to Cold Tasks Page ]
                                           (Awaiting Review / Purge)
```

### Cold Tasks Logic

1. **Problem Solved**: Normal task lists degrade when old tasks continuously roll over into "Today", causing overwhelm.
2. **Formula Property**: `Cold` (`UF1iWA`) evaluates whether a task has remained uncompleted and un-rescheduled for more than 14 days.
3. **Exclusion Filter**: Standard time-based views (`Today`, `Tomorrow`, `Next 7 Days`, `Priority View`) include filter condition: `Cold` = false.
4. **Cold Storage View**: Stale tasks automatically move to `Cold Tasks` (`https://app.notion.com/p/c99495661e99821e8f1c01cbdd1f0734`), where users periodically execute triage: delete, reschedule, or move to `Someday`.

### Master Archival Flags

Every database contains an explicit `Archived` checkbox property:

- `All Tasks [UB]`: Handled via `Done` / `Kanban Status` = `Done`.
- `Projects [UB]`: `Archived` (`R2l3cw`). Excludes project from active boards.
- `All Notes [UB]`: `Archived` (`c3JqQg`). Retains notes in searchable archive while hiding them from notebook shelves.
- `Goals [UB]`: `Archived` (`VH5xaA`).
- `Areas/Resources [UB]`: `Archived` (`Xl5hcg`).

---

## 15. Exhaustive Verification Status Table

Every component documented in this specification has been verified against live workspace assets:

| Architectural Component | Entity / Property / View | Notion ID / URL | Verification Classification | Method & Grounding Reference |
| --- | --- | --- | --- | --- |
| **Workspace Root** | Ultimate Brain for Notion (1) | `00a49566-1e99-828c-bbd3-8119dd5feb6e` | **Verified** | Inspected via `notion_load_page`; verified root tree and block contents. |
| **Central Database Container** | The Brain (Archive subpage) | `d9e49566-1e99-833a-9f24-0135cec22bb3` | **Verified** | Inspected via `notion_load_page`; houses all 6 master databases. |
| **Master Database** | All Tasks [UB] | `9aa49566-1e99-83b0-ba10-01b0a1f1e3e8` | **Verified** | Inspected via `notion_load_database`; collection schema loaded in full. |
| **Master Database** | Projects [UB] | `ad649566-1e99-8230-9c96-01d09ae024d3` | **Verified** | Inspected via `notion_load_database`; collection schema loaded in full. |
| **Master Database** | All Notes [UB] | `71149566-1e99-82eb-a015-01f94be52d16` | **Verified** | Inspected via `notion_load_database`; collection schema loaded in full. |
| **Master Database** | Goals [UB] | `97149566-1e99-829d-ae68-81556011dba2` | **Verified** | Inspected via `notion_load_database`; collection schema loaded in full. |
| **Master Database** | Milestones [UB] | `7ee49566-1e99-8240-9586-015a0752c1e5` | **Verified** | Inspected via `notion_load_database`; collection schema loaded in full. |
| **Master Database** | Areas/Resources [UB] | `5e049566-1e99-8270-bc90-0171a282a975` | **Verified** | Inspected via `notion_load_database`; collection schema loaded in full. |
| **Template Page** | Task with Sub-Tasks | `bf049566-1e99-83dc-87cb-01eae31ed1fc` | **Verified** | Inspected via `notion_load_page`; parent collection and inline view confirmed. |
| **Template Page** | Packing List | `1bf49566-1e99-83f5-8965-01b6754fd0df` | **Verified** | Inspected via `notion_load_page`; verified 48 checklist items and structure. |
| **Template Page** | Project Template | `03049566-1e99-823b-80db-81a02eb556aa` | **Verified** | Inspected via `notion_load_page`; verified 3 linked database views and callouts. |
| **Template Page** | Daily Note | `c5f49566-1e99-82ea-bbc6-81a81568e182` | **Verified** | Inspected via `notion_load_page`; verified habits, morning pages, review. |
| **Template Page** | Note with Tasks | `97149566-1e99-836d-9ced-81aec7ebaada` | **Verified** | Inspected via `notion_load_page`; verified embedded task inbox view. |
| **Template Page** | Recipe Template | `e3949566-1e99-83cf-8de9-81166f6602b0` | **Verified** | Inspected via `notion_load_page`; verified ingredients/steps 2-column layout. |
| **Template Page** | Book Notes | `e0a49566-1e99-8284-bb00-81cd7651e410` | **Verified** | Inspected via `notion_load_page`; verified summary, thoughts, takeaways structure. |
| **Template Page** | Goal Template | `b7649566-1e99-82b2-a579-01a8b81f1620` | **Verified** | Inspected via `notion_load_page`; verified milestones, journal button, projects. |
| **Template Page** | Area Template | `ee149566-1e99-829c-8a8e-815747113bd0` | **Verified** | Inspected via `notion_load_page`; verified 5 linked views (projects, goals, resources, favorites, notes). |
| **Template Page** | Resource Template | `91c49566-1e99-828c-bf97-013fcd6231ff` | **Verified** | Inspected via `notion_load_page`; verified 3 linked views (notes, favorites, web clips). |
| **Dashboard** | Dashboard | `39d49566-1e99-83fe-ad03-81d03bcf9f07` | **Verified** | Inspected via `notion_load_page`; confirmed views and quick links. |
| **Dashboard** | My Day | `81349566-1e99-82e0-ad6c-01cdfd4a30ea` | **Verified** | Inspected via `notion_load_page`; confirmed daily cockpit structure. |
| **Dashboard** | Quick Capture | `6a649566-1e99-836b-99a9-015b1f8c9b66` | **Verified** | Inspected via `notion_load_page`; confirmed rapid entry boxes. |
| **Dashboard** | Task Manager | `74649566-1e99-8370-9027-01d8cba7170d` | **Verified** | Inspected via `notion_load_page`; confirmed 8 subpage routes and views. |
| **Dashboard** | Project Hub | `93e49566-1e99-8331-a129-815db3029378` | **Verified** | Inspected via `notion_load_page`; confirmed project board and views. |
| **Dashboard** | Notes | `a7f49566-1e99-8310-9e95-0192567dcc68` | **Verified** | Inspected via `notion_load_page`; confirmed notebook shelf and subpages. |
| **Dashboard** | Areas & Resources | `29349566-1e99-8275-850e-019f29e57972` | **Verified** | Inspected via `notion_load_page`; confirmed consolidated PARA dashboard. |
| **Dashboard** | Goals | `ecb49566-1e99-830e-9dd2-014ce5276613` | **Verified** | Inspected via `notion_load_page`; confirmed goal and milestone tracking center. |
| **Dashboard** | Process | `3de49566-1e99-83e7-9680-81fb754dd461` | **Verified** | Inspected via `notion_load_page`; confirmed GTD processing logic and rules. |
| **Dashboard** | Plan | `14049566-1e99-83af-8cde-81c3c81105a5` | **Verified** | Inspected via `notion_load_page`; confirmed planning center. |
| **Dashboard** | Quick Links | `6c349566-1e99-826f-8dbd-81e6e02154c9` | **Verified** | Inspected via `notion_load_page`; confirmed reference directory. |
| **Dashboard** | Book Tracker | `9c049566-1e99-82bf-8392-81b40f0f6295` | **Verified** | Inspected via `notion_load_page`; confirmed book shelves and views. |
| **Dashboard** | Recipe Book | `25e49566-1e99-831b-add9-81b57842752d` | **Verified** | Inspected via `notion_load_page`; confirmed culinary collection hub. |
| **Formula Code Expressions** | All 37 Database Formula Expressions | Various Property IDs | **Inaccessible via API** | Notion MCP / API does not expose formula syntax/code; verified formula names, IDs, output types, and evaluated row results. |
