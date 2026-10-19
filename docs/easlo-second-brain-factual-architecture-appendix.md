# EASLO Second Brain — Factual Architecture Appendix

**Status:** Notion AI audit supplied by the user on 2026-10-11.  
**Ids:** page, database and view ids from the audited workspace are replaced with `<id>` (2026-10-19, CC-27; the product repo holds no real Notion ids).  
**Scope:** Accessible EASLO workspace configuration, including canonical databases, views, templates, connection metadata, permissions, and sampled records.  
**Evidence convention:** Findings retain the source audit’s `Verified`, `Inferred`, and `Unknown` labels. “Verified” means observed by Notion AI through the workspace interfaces it could access; it has not been independently verified from an exported workspace or API response.

> This is an evidence appendix to [EASLO Second Brain Architecture Mapping](easlo-second-brain-architecture.md). It records configuration details rather than proposing the Ultimate Brain architecture.

## Audit scope and method

This appendix audits the accessible configuration of Second Brain (1) and its linked dashboards, canonical databases, database templates, linked database views, and available connection metadata. The audit does not propose a replacement architecture.

I inspected:

- The current Second Brain (1) page.
- The database registry at Databases.
- Canonical database schemas and view configurations.
- Dashboard pages and their linked database views.
- Database templates and embedded linked views.
- Available permission and connection metadata.
- Sample rows where query access returned data.

The canonical database registry exposes 11 databases: Areas, Projects, Tasks, Events, Topics, Notebooks, Notes, References, Highlights, Goals, and Key Results.

Important limitation: database loaders expose schema, views, formulas, rollup definitions, and templates, but they do not expose every Notion feature. Button actions, database automations, recurring-template schedules, revision history, and some linked-view configurations are either represented only as opaque blocks or unavailable because of permissions.


## 1. Database schema

### 1.1 Tasks

Data source: collection://<id>
Confidence: Verified from the database configuration.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Status | status | Inbox; Waiting On; Someday/Maybe; Next Action; Completed |
| Project | relation | Target: Projects. Reciprocal property: Tasks |
| Parent Task | relation | Self-relation to Tasks. Reciprocal property: Sub-task |
| Description | text | No configured options |
| Energy | select | Low; Medium; High; Extreme |
| Goal Area | rollup | Relation source: Goal; target property: Goals.Area; aggregation not exposed in the returned schema |
| URL | url | Exact property name is URL; SQL exposes it as userDefined:URL |
| Parent Date | rollup | Relation source: Parent Task; target property: Tasks.Date; target type: date |
| Contexts | multi_select | Phone; Computer; Home; Online Shopping; Email |
| Goal | relation | Target: Goals. Reciprocal property: Tasks |
| Owner | person | No configured person restriction exposed |
| Priority | select | Low; Medium; High; Urgent |
| Sub-task | relation | Self-relation to Tasks. Reciprocal property: Parent Task |
| Area | relation | Target: Areas. Reciprocal property: Tasks |
| Project Goal | rollup | Relation source: Project; target property: Projects.Goal; target type: relation |
| Event | relation | Target: Events. Reciprocal property: Tasks |
| Notes | relation | Target: Notes. Reciprocal property: Tasks |
| Date | date | Query columns: date:Date:start, date:Date:end, date:Date:is_datetime |
| Created | created_time | System-managed |
| Edited | last_edited_time | System-managed |
| Project Area | rollup | Relation source: Project; target property: Projects.Area; target type: relation |
| Name | title | Primary title property |

The schema marks Goal Area, Parent Date, Project Goal, and Project Area as unavailable to SQL queries. Their definitions are visible, but their computed values may be returned as rollup references rather than resolved values.

Observed task row
The accessible task sample included Complete a 10km run, with Status = Next Action, a Project relation, and Date = 2024-10-17.


### 1.2 Projects

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| References | relation | Exact name contains a leading space. Target: References. Reciprocal property: Projects |
| Edited | last_edited_time | System-managed |
| Timeline | date | Query columns: date:Timeline:start, date:Timeline:end, date:Timeline:is_datetime |
| Notes | relation | Target: Notes. Reciprocal property: Projects |
| Priority | select | Urgent; High; Medium; Low |
| Progress | rollup | Relation source: Tasks; target property: Tasks.Status; aggregation: percent_per_group, group Complete |
| Status | status | Inbox; Not Started; On Hold; In Progress; Completed |
| Tasks | relation | Target: Tasks. Reciprocal property: Project |
| Created | created_time | System-managed |
| Archive | checkbox | Manual archive flag |
| Goal Area | rollup | Relation source: Goal; target property: Goals.Area; target type: relation |
| Area | relation | Target: Areas; limit = 1. Reciprocal property: Projects |
| Sub-Projects | relation | Self-relation to Projects. Reciprocal property: Parent Project |
| Meetings | relation | Target: Events. Reciprocal property: Projects |
| Related Projects | relation | Self-relation to Projects. Reciprocal property is the same relation |
| End Date | formula | dateEnd(prop("Timeline")) |
| Parent Project | relation | Self-relation to Projects; limit = 1. Reciprocal property: Sub-Projects |
| Goal | relation | Target: Goals. Reciprocal property: Projects |
| Name | title | Primary title property |

The schema marks Progress, Goal Area, and End Date as unavailable to SQL queries.

Observed project rows
Accessible rows included:

Host a live workshop — Status = Inbox, Priority = Medium, related to one task.
Build emergency fund — Status = Not Started, Priority = Medium, related to one task.
Train for half marathon — Status = In Progress, Priority = High, related to Complete a 10km run.


### 1.3 Goals

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Area | relation | Target: Areas. Reciprocal property: Goals |
| Key Results | relation | Target: Key Results. Reciprocal property: Goal |
| Tasks | relation | Target: Tasks. Reciprocal property: Goal |
| Projects | relation | Target: Projects. Reciprocal property: Goal |
| Created | created_time | System-managed |
| References | relation | Target: References. Reciprocal property: Goals |
| Quarter | formula | "Q" + formatDate(prop("Deadline"), "Q") |
| Edited | last_edited_time | System-managed |
| Notes | relation | Target: Notes. Reciprocal property: Goals |
| Archive | checkbox | Manual archive flag |
| Deadline | date | Query columns: date:Deadline:start, date:Deadline:end, date:Deadline:is_datetime |
| Countdown | formula | if(dateBetween(prop("Deadline"), now(), "days")<=0, "", format(dateBetween(prop("Deadline"), now(), "days)) + " days left") |
| Status | status | Not Started; In Progress; Completed |
| Name | title | Primary title property |

The Countdown expression is reproduced as returned by the schema. It contains an apparent quote/parenthesis irregularity in the returned expression; this should be treated as a configuration anomaly rather than silently corrected.

The schema marks Quarter and Countdown as unavailable to SQL queries.


### 1.4 Key Results

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Current | number | Current measured value |
| Target | number | Target value |
| Status | status | Open; Closed |
| Created | created_time | System-managed |
| Edited | last_edited_time | System-managed |
| Start | number | Baseline value |
| Goal | relation | Target: Goals; limit = 1. Reciprocal property: Key Results |
| Progress | formula | if(prop("Start")>prop("Target"), round((prop("Start")-prop("Current"))/ (prop("Start")-prop("Target")) * 1000) / 1000, round(((prop("Current") - prop("Start")) / (prop("Target") - prop("Start"))) * 1000) / 1000) |
| Name | title | Primary title property |

The schema marks Progress as unavailable to SQL queries.

The completed view filters by the status group Complete, while the configured complete option is named Closed. That is a terminology mismatch between the status option and the view filter group.


### 1.5 Areas

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Notebooks | relation | Target: Notebooks. Reciprocal property: Area |
| Tasks | relation | Target: Tasks. Reciprocal property: Area |
| Goals | relation | Target: Goals. Reciprocal property: Area |
| Type | select | Business; Personal; School |
| Projects | relation | Target: Projects. Reciprocal property: Area |
| Events | relation | Target: Events. Reciprocal property: Area |
| Notes | relation | Target: Notes. Reciprocal property: Area |
| Topics | relation | Target: Topics. Reciprocal property: Area |
| References | relation | Target: References. Reciprocal property: Areas |
| Archive | checkbox | Manual archive flag |
| Name | title | Primary title property |

No formulas or rollups were exposed for Areas.


### 1.6 Events

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Project Area | rollup | Relation source: Projects; target property: Projects.Area; target type: relation |
| Tasks | relation | Target: Tasks. Reciprocal property: Event |
| Area | relation | Target: Areas. Reciprocal property: Events |
| Date | date | Event date |
| Projects | relation | Target: Projects. Reciprocal property: Meetings |
| Type | select | Standup; Client; Kickoff; Training; Onboarding |
| Description | text | No configured options |
| Attendees | person | No configured restriction exposed |
| Meeting Link | url | Meeting URL |
| Name | title | Primary title property |

The schema marks Project Area as unavailable to SQL queries.

No Status or Archive property exists on Events.


### 1.7 Topics

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Area | relation | Target: Areas. Reciprocal property: Topics |
| Edited | last_edited_time | System-managed |
| References | relation | Target: References. Reciprocal property: Topics |
| Counter | formula | style(filter(prop("Notes"),current.‣==false).length() + " Notes","grey") |
| Area Type | rollup | Relation source: Area; target property: Areas.Type; target type: select |
| Notes | relation | Target: Notes. Reciprocal property: Topics |
| Highlights | relation | Target: Highlights. Reciprocal property: Topics |
| Created Time | created_time | System-managed |
| Archive | checkbox | Manual archive flag |
| Name | title | Primary title property |

The formula uses the exact expression containing current.‣. The schema marks Counter and Area Type as unavailable to SQL queries.


### 1.8 Notebooks

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Archive | checkbox | Manual archive flag |
| Area | relation | Target: Areas. Reciprocal property: Notebooks |
| Counter | formula | style(filter(prop("Notes"),current.‣==false).length() + " Notes","grey") |
| Created | created_time | System-managed |
| Edited | last_edited_time | System-managed |
| Description | text | No configured options |
| Notes | relation | Target: Notes. Reciprocal property: Notebook |
| Name | title | Primary title property |

The schema marks Counter as unavailable to SQL queries.


### 1.9 Notes

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Goal Area | rollup | Relation source: Goals; target property: Goals.Area; target type: relation |
| Type | select | Fleeting; Literature; Project; Permanent |
| Archive | checkbox | Manual archive flag |
| Edited | last_edited_time | System-managed |
| Related Notes | relation | Self-relation to Notes |
| Tasks | relation | Target: Tasks. Reciprocal property: Notes |
| Created | created_time | System-managed |
| Goals | relation | Target: Goals. Reciprocal property: Notes |
| Topics | relation | Target: Topics. Reciprocal property: Notes |
| Favorite | checkbox | Manual retrieval flag |
| References | relation | Target: References. Reciprocal property: Notes |
| Topics Area | rollup | Relation source: Topics; target property: Topics.Area; target type: relation |
| Project Area | rollup | Relation source: Projects; target property: Projects.Area; target type: relation |
| Notebook | relation | Target: Notebooks. Reciprocal property: Notes |
| Highlights | relation | Exact name contains a leading space. Target: Highlights. Reciprocal property: Notes |
| Projects | relation | Target: Projects. Reciprocal property: Notes |
| Area | relation | Target: Areas. Reciprocal property: Notes |
| Notebook Area | rollup | Relation source: Notebook; target property: Notebooks.Area; target type: relation |
| Name | title | Primary title property |

The schema marks Goal Area, Topics Area, Project Area, and Notebook Area as unavailable to SQL queries.


### 1.10 References

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Projects | relation | Target: Projects. Reciprocal property: exact References |
| Rating | select | ★★★★★; ★★★★; ★★★; ★★; ★ |
| Platform | multi_select | Audible; YouTube; Netflix; Disney+; Kindle; Website; Physical Copy; Notion; Prime; HBO; Twitter; TED |
| Description | text | No configured options |
| Topics Area | rollup | Relation source: Topics; target property: Topics.Area; target type: relation |
| Goals | relation | Target: Goals. Reciprocal property: References |
| Highlights | relation | Target: Highlights. Reciprocal property: References |
| Related References | relation | Self-relation to References |
| Areas | relation | Target: Areas. Reciprocal property: References |
| Completed Date | date | Completion date |
| Created | created_time | System-managed |
| Source | text | Manual provenance/source field |
| Type | select | Book; Film; Article; Video; Podcast; Template; Post; Product |
| Status | status | Inbox; Backlog; Up Next; In Progress; Completed |
| Edited | last_edited_time | System-managed |
| Archive | checkbox | Manual archive flag |
| Notes | relation | Target: Notes. Reciprocal property: References |
| Publication Date | date | Publication date |
| Name | title | Primary title property |
| Favorite | checkbox | Manual retrieval flag |
| URL | url | External source URL |

The schema marks Topics Area as unavailable to SQL queries.


### 1.11 Highlights

Data source: collection://<id>
Confidence: Verified.

| Exact property name | Type | Configuration |
| --- | --- | --- |
| Topics | relation | Target: Topics. Reciprocal property: Highlights |
| Favourite | checkbox | Exact spelling differs from Notes and References |
| References | relation | Target: References. Reciprocal property: Highlights |
| Notes | relation | Target: Notes. Reciprocal property: exact Highlights |
| Edited | last_edited_time | System-managed |
| Created | created_time | System-managed |
| Author | text | Manual author field |
| Media Type | rollup | Relation source: References; target property: References.Type; target type: select |
| Highlight | title | Primary title property |

The schema marks Media Type as unavailable to SQL queries.

No Archive property exists on Highlights.


## 2. Views

### 2.1 Canonical database views

These are the views configured directly on the canonical databases.

| Database | View | Type | Filters | Sorts / grouping | Visible properties | Role |
| --- | --- | --- | --- | --- | --- | --- |
| Tasks | Table | Table | None | Status ascending | Status, Name, Date, Project | General task execution |
| Projects | unnamed table | Table | None | None exposed | Name, Area, Status | General project list |
| Goals | Table | Table | None | Status ascending | Name, Area, Status | Goal overview |
| Areas | unnamed view | List | None | None | Name, Type | Area directory |
| Events | List | List | None | Date descending | Name, Date | Event history/upcoming list |
| Topics | Gallery | Gallery | None | None | Name | Topic browsing |
| Notebooks | unnamed view | List | None | None | Name | Notebook directory |
| Notes | unnamed view | List | None | None | Name | General notes list |
| References | List | List | None | None | Name, Type, Source | Reference directory |
| Highlights | List | List | None | Created descending | Highlight, References | Recent highlight retrieval |
| Key Results | Open | Table | Status is not group Complete | Progress ascending | Name, Start, Current, Target, Progress | Open measurements |
| Key Results | Completed | Table | Status is group Complete | None | Name, Start, Current, Target, Progress | Closed measurements |

The canonical database configurations and their view definitions are exposed in the database registry and individual database configurations.


### 2.2 GTD Dashboard

The GTD Dashboard contains linked views for Tasks, Projects, Notes, and References.

Dashboard-level views
| View | Source | Exact filters | Sort/group | Visible properties | Role |
| --- | --- | --- | --- | --- | --- |
| Tasks | Tasks | Status = Inbox | None | Name, Date, Status | Clarification queue |
| Projects | Projects | Archive = false; Status = Inbox | None | Name, Area, Timeline, Status | Project clarification queue |
| Notes | Notes | Archive = false | None | Name, Type | Active notes |
| References | References | Status = Inbox | Edited descending | Name, Source, Status | Reference clarification queue |

GTD navigation pages
| Page | Source and view details | Role |
| --- | --- | --- |
| Inbox | Tasks; Status = Inbox; visible Name, Date, Status | Task capture/clarification |
| Today | Tasks; Status = Next Action and Date on or before today; visible Name, Project, Date, Status | Daily execution |
| Next Actions | Tasks; Status = Next Action; grouped by Contexts; visible Name, Project, Status | Context-based execution |
| Calendar | Tasks; calendar by Date; Status is not group Complete; visible Name, Status; sorted by Date ascending | Scheduled work |
| Projects | Projects; grouped by Area; Archive = false; Status is not group Complete; Timeline is not empty; sorted by Timeline ascending | Active project planning |
| Waiting On | Tasks; Status = Waiting On; visible Name, Project, Status | Waiting/dependency review |
| Someday/Maybe | Tasks; Status = Someday/Maybe; visible Name, Project, Status | Deferred possibilities |
| Logbook | Tasks; Status = Complete; grouped by Edited day descending; sorted by Edited descending | Completed-work history |
| References | References; active non-archived views for Inbox, Recent, Up Next, In Progress, Favorite, Completed, Backlog, Topics, and All References | Knowledge-consumption workflow |
| Topics | Topics; Gallery; visible Name | Topic browsing |
| Areas | Areas; Gallery views for All, Personal, Business, and School | Responsibility browsing |

The navigation pages are separate pages containing linked database views; they are not additional canonical databases.


### 2.3 PARA Dashboard

| View | Source | Exact filters | Sort/group | Visible properties | Role |
| --- | --- | --- | --- | --- | --- |
| Inbox | Projects | Archive = false; Status = Inbox | None | Name, Area, Timeline, Status | Unclarified projects |
| Deadlines | Projects | Archive = false; Status is not group Complete; Timeline is not empty | Timeline ascending | Name, Area, End Date, Status | Deadline review |
| Timeline | Projects | Archive = false | Timeline by Timeline; table hidden | Name, Timeline, Status | Project scheduling |
| Status | Projects | Archive = false | Board grouped by Status | Name, Area, Timeline | Project status management |
| Priority | Projects | Archive = false; Status is not group Complete | Board grouped by Priority, manual order | Name, Area, Status | Priority triage |
| All Projects | Projects | Archive = false | None | Name, Area, Status | Active project directory |
| All | Areas | Archive = false | None | Name | Active areas |
| Personal | Areas | Archive = false; Type = Personal | None | Name | Personal areas |
| Business | Areas | Archive = false; Type = Business | None | Name | Business areas |
| School | Areas | Archive = false; Type = School | None | Name | School areas |
| Archive Projects | Projects | Archive = true | Edited descending | Name, Area, Status, Edited | Archived projects |
| Archive Areas | Areas | Archive = true | None | Name, Archive | Archived areas |
| Archive Notes | Notes | Archive = true | None | Name | Archived notes |

The Notes archive view in PARA was not accessible in one linked-view load attempt; its presence is visible in the page configuration, but its full configuration is marked Unknown because the loader returned a permission error.


### 2.4 Notes Dashboard

| View | Source | Exact filters | Sort/group | Visible properties | Role |
| --- | --- | --- | --- | --- | --- |
| Recent | Notes | Archive = false; Edited within past 7 days | Edited descending | Name, Type | Recent knowledge |
| Inbox | Notes | Archive = false; Type = Fleeting or Literature | Edited descending | Name, Type | Notes awaiting development |
| Favorites | Notes | Archive = false; Favorite = true | None | Name, Type | Important notes |
| Timeline | Notes | Archive = false; grouped by Created day descending | Created day descending | Name, Type | Chronological capture review |
| Topics | Notes | Archive = false | Board grouped by Topics | Name, Type | Topic-based retrieval |
| All Notes | Notes | Archive = false | None | Name, Type | Active note directory |
| Notebooks | Notebooks | Archive = false | None | Name, Counter | Notebook directory |
| Topics | Topics | None | None | Name, Counter | Topic directory |

Notes navigation pages
The Notes Dashboard also links to Recent, Inbox, To Review, Favorites, Notebooks, Topics, Timeline, All Notes, and Archive. These are linked views rather than separate databases.


### 2.5 Second Brain (1) landing page

The landing page contains linked database blocks for Tasks, Projects, Goals, Areas, and Notes.

Visible linked views
| Embedded view group | Source | Exact configuration |
| --- | --- | --- |
| Tasks | Tasks | Today: Status = Next Action; Date on or before today; sorted by Priority descending. Upcoming: Date after today and Status = Next Action; grouped by Date day ascending. Next Action: Status = Next Action; grouped by Contexts. Waiting On: Status = Waiting On. Logbook: Status = Complete; grouped and sorted by Edited descending. All Tasks: no filters. |
| Projects | Projects | Deadlines: Archive = false; status not Complete; Timeline not empty; sorted Timeline ascending. Timeline: Archive = false; timeline by Timeline. Status: Archive = false; board grouped by Status. Priority: Archive = false; status not Complete; board grouped by Priority. Urgent: Priority = Urgent; Archive = false; status not Complete. All Projects: Archive = false. |
| Goals | Goals | Areas: Archive = false; board grouped by Area. Quarterly: Archive = false; board configuration exposed but the grouping property is not returned in the accessible configuration. Yearly: Archive = false; grouped by Deadline year. |
| Areas | Areas | All: Archive = false; Personal, Business, and School filter by Type; all also require Archive = false. |
| Notes | Notes | Recent: Archive = false; Edited within 7 days. Inbox: Archive = false; Type Fleeting or Literature, or Type empty. Favorites: Archive = false; Favorite true. Timeline: Archive = false; Favorite true; grouped by Created day. Topics: Archive = false; grouped by Topics. All Notes: Archive = false. |
| Untitled linked block | Unknown | Database page d064... has no data source and no views in the accessible configuration. |

The exact linked block labels, including the Untitled block, are preserved as observed.


### 2.6 Context-filtered views in templates

Several linked views use the current template page as a relation filter. The accessible configuration stores the template page URL as the exact filter value.

Examples:

Project template views filter Tasks by Project contains [project template page].
Goal template views filter Tasks, Projects, Notes, References, and Key Results by their relation to [goal template page].
Area template views filter Tasks, Projects, Goals, Notes, References, Topics, and Events by their relation to [area template page].
Event template Action Items filters Tasks by Event contains [event template page].
Notebook template filters Notes by Notebook contains [notebook template page].
Topic template filters Notes, References, and Highlights by Topics contains [topic template page].
That the template URL is replaced by the instantiated current page is Inferred from the template pattern; the exact stored filter values are Verified.


## 3. Templates

### 3.1 Tasks templates

New page
Page body: empty.
Default Status: Inbox.
Name: blank in the loaded template row.
Computed rollups are present but unresolved.
No default Project, Goal, Area, Date, Context, Energy, Priority, Owner, or Event was observed.
Confidence: Verified.


### 3.2 Projects templates

New Project
Page body sections:

Tasks
Meetings
Notes
References
Embedded views:

Tasks: Inbox, Next Action, Someday/Maybe, Calendar, Waiting On, Completed.
Meetings: Upcoming, Calendar, Past Events, All Events.
Notes: Recent, Inbox, Topics, All Notes.
References: Recent, Inbox, Backlog, All References.
The filters use the Project relation against the project template page URL.

Default properties observed:

Name = New Project
Status = Inbox
Archive = false
Computed Progress, Goal Area, and End Date are present.
Priority, Timeline, Area, and Goal were not defaulted in the loaded template row.
Confidence: Verified for body, filters, and defaults. Current-page substitution is Inferred.


### 3.3 Goals templates

New Goal
Page body sections:

Key Results
Projects
Tasks
Notes
References
Embedded views:

Key Results: Open and Completed, filtered by Goal relation to the current Goal.
Projects: Inbox, Deadlines, Timeline, Status, filtered by Goal relation.
Tasks: Inbox, Next Action, Calendar, Waiting On, Someday/Maybe, Completed, filtered by Goal relation.
Notes: Recent, Inbox, Topics, All Notes, filtered by Goal relation.
References: Recent, Inbox, Backlog, All References, filtered by Goal relation.
Default properties observed:

Name = New Goal
Status = Not Started
Archive = false
Deadline was unset.
Quarter and Countdown are computed.
Confidence: Verified for body and template defaults. Current-page substitution is Inferred.


### 3.4 Areas templates

New page
Page body sections:

Topics
Tasks
Projects
Events
Goals
Notes
References
Embedded views:

Topics: Area contains current Area; Archive = false.
Tasks: Inbox, Next Action, Calendar, Waiting On, Someday/Maybe, Completed; related through Area.
Projects: Inbox, Deadlines, Timeline, Status; related through Area.
Events: Upcoming, Calendar, Past Events, All Events; related through Area.
Goals: Open and Completed; related through Area.
Notes: Recent, Inbox, Topics, All Notes; related through Area.
References: Recent, Inbox, Backlog, All References; related through Areas.
Default properties observed:

Archive = false
Name blank.
The loaded template row also contained two Event relation URLs. It is not possible to determine whether those are intended seed values or inherited test data. Unknown / anomalous.
Confidence: Verified for body, filters, and observed properties; intended Event seed values Unknown.


### 3.5 Events templates

New Event
Page body:

Agenda
Horizontal divider
Empty list
Action Items
The Action Items section embeds a Tasks view filtered by:

Event relation contains current Event page
Default properties observed:

Name = New Event
Description = empty
Meeting Link = empty
Date unset
Project Area is computed
No default Type, Attendees, Projects, Area, or Tasks was observed.
Confidence: Verified.


### 3.6 Topics templates

New Topic
Page body sections:

Notes
References
Highlights
Embedded views:

Notes: Topics contains current Topic; Archive = false; sorted Edited descending.
References: Topics contains current Topic; Archive = false; sorted Edited descending.
Highlights: Topics contains current Topic; sorted Edited descending.
Default properties observed:

Name = New Topic
Archive = false
Counter is computed.
Area Type is a rollup.
A Notes relation URL was present in the template readback; whether this is deliberate seed data or inherited test data is Unknown.
Confidence: Verified for body and filters; seed relation intent Unknown.


### 3.7 Notebooks templates

New page
Page body:

Notes
Embedded view:

Notes: Notebook contains current Notebook; Archive = false; sorted Edited descending.
Visible properties: Name, Edited, Type.
Gallery cards use page content as cover.
Default properties observed:

Archive = false
Description empty
Name blank
Counter computed
Confidence: Verified.


### 3.8 Notes templates

The Notes database has four templates:

| Template | Default Type | Page body |
| --- | --- | --- |
| New page | Not defaulted | Empty |
| Fleeting | Fleeting | Empty |
| Literature | Literature | Empty |
| Permanent | Permanent | Empty |

All loaded note templates default Archive = false and Favorite = false. Computed area rollups are present. No default Project, Goal, Area, Topic, Notebook, Reference, Task, or Highlight relation was observed.

Confidence: Verified.


### 3.9 References templates

The References database has four templates:

| Template | Default Type | Default Status | Page body |
| --- | --- | --- | --- |
| New Book | Book | Inbox | Empty |
| New Film | Film | Inbox | Empty |
| New Article | Article | Inbox | Empty |
| New Podcast | Podcast | Inbox | Empty |

Across the loaded templates:

Archive = false
Favorite = false
Description, Source, and URL are empty.
Publication and completion dates are unset.
Topics Area is computed.
No dedicated templates were exposed for Video, Template, Post, or Product.

Confidence: Verified.


### 3.10 Highlights templates

New Highlight
Page body: empty.
Highlight = New Highlight
Favourite = false
Author empty
References, Topics, and Notes unset
Media Type computed from Reference
Confidence: Verified.


### 3.11 Key Results templates

New Key Result
Page body: empty.
Name = New Key Result
Status = Open
Start, Current, Target, and Goal unset
Progress computed
Confidence: Verified.


## 4. Automation

### 4.1 Buttons

Button blocks are visible but their action configuration is not exposed by the page loader.

Observed button blocks:

Second Brain (1): five opaque button blocks under Quick Capture.
GTD Dashboard: three opaque button blocks.
Notes Dashboard: three opaque button blocks.
The page content represents them as:

<unknown ... alt="button" />
Therefore the following are Unknown for each button:

Label.
Trigger behavior.
Conditions.
Actions.
Target database.
Default property values.
Output page or relation.
Their placement strongly suggests Quick Capture functionality, but that purpose is Inferred, not verified from the button configuration.


### 4.2 Database automations

No database automation configuration was returned by the accessible database loaders for the 11 canonical databases.

Result:

Trigger: Unknown.
Conditions: Unknown.
Actions: Unknown.
Output: Unknown.
Presence or absence of automations: Unknown.
It would be incorrect to conclude that no automations exist. The factual finding is that automation configuration was not exposed through the inspected database configuration.


### 4.3 Recurring templates

The database configurations expose page templates, but no recurrence schedule, interval, trigger, or recurring-template metadata.

Result:

Ordinary database templates: Verified.
Recurring template configuration: Unknown.
Recurring trigger: Unknown.
Recurring output: Unknown.
No recurring page or recurring database item was visible in the inspected page bodies.


### 4.4 Integrations

The connection inspection returned one connected Calendar connection with connectionStatus = ready. No connection permissions were listed, and no direct synchronization rule from Calendar into the Events database was exposed.

Therefore:

Connected Calendar integration: Verified.
Calendar-to-Events sync: Unknown.
Calendar-triggered page creation: Unknown.
Calendar-triggered task creation: Unknown.
The Events database itself is a native Notion database with manually configured Date, Attendees, and Meeting Link properties.


### 4.5 Manual steps

The following manual steps are visible from schemas and views:

| Manual step | Evidence | Confidence |
| --- | --- | --- |
| Move Tasks between Inbox, Next Action, Waiting On, Someday/Maybe, and Completed | Task status options and views | Verified |
| Assign Project, Goal, Area, Event, Notes, and Date to Tasks | Task properties | Verified |
| Move Projects through Inbox, Not Started, On Hold, In Progress, and Completed | Project status options | Verified |
| Move References through Inbox, Backlog, Up Next, In Progress, and Completed | Reference status options and views | Verified |
| Set Note Type to Fleeting, Literature, Project, or Permanent | Notes schema/templates | Verified |
| Add Agenda content and create Action Items inside an Event | Event template body | Verified |
| Link Highlights to References, Topics, and Notes | Highlight schema | Verified |
| Set Archive flags on applicable databases | Archive properties and views | Verified |
| Use Quick Capture buttons | Button blocks visible | Verified |
| What the Quick Capture buttons actually do | Button action data unavailable | Unknown |

## 5. Lifecycle rules

### 5.1 Capture

Tasks
The task template defaults new Tasks to:

Status = Inbox
The Inbox views show Tasks with Status = Inbox. No separate Task capture database was found.

References
Reference templates default new items to:

Status = Inbox
Archive = false
Favorite = false
The References Inbox views require both Status = Inbox and, in most views, Archive = false.

Notes
Notes do not have a workflow status. Capture is represented through:

Type = Fleeting or Literature.
Archive = false.
Inclusion in Notes Inbox views.
Events
Events have no Inbox status. Capture is represented through creation of an Event page with a date, type, attendees, description, and optional meeting link.

Confidence
The existence of these capture mechanisms is Verified. The actual Quick Capture button behavior is Unknown.


### 5.2 Clarification

Clarification is represented by assigning relationships and changing states.

Task clarification
A Task can be clarified by setting:

Project
Goal
Area
Event
Notes
Date
Contexts
Energy
Priority
Owner
The visible workflow is:

Inbox → Next Action
Inbox → Waiting On
Inbox → Someday/Maybe
Inbox → Completed
The system does not expose an explicit “clarified” field.

Project clarification
Projects move from:

Inbox → Not Started → In Progress → Completed
with On Hold as an intermediate state.

Reference clarification
References move from:

Inbox → Backlog / Up Next → In Progress → Completed
Note clarification
Notes are clarified through:

Type
Notebook
Topics
Area
Projects
Goals
References
Highlights
The transition from Fleeting or Literature to Permanent is not enforced by automation; it is a manual classification pattern.


### 5.3 Review

Review is implemented through filtered views rather than a single review database.

Observed review mechanisms include:

Tasks Today.
Tasks Next Actions.
Tasks Waiting On.
Tasks Someday/Maybe.
Tasks Logbook.
References Recent, Inbox, Backlog, Up Next, In Progress, and Completed.
Notes Recent, Inbox, Favorites, Timeline, Topics, and All Notes.
Project Deadlines, Timeline, Status, and Priority.
Goal Open, Completed, Quarterly, and Yearly.
Area-specific and Project-specific embedded review views.
These review roles are Inferred from filters and view names, while the filters themselves are Verified.


### 5.4 Completion

| Entity | Completion mechanism |
| --- | --- |
| Tasks | Status = Completed |
| Projects | Status = Completed |
| Goals | Status = Completed |
| Key Results | Status = Closed |
| References | Status = Completed; optional Completed Date |
| Notes | No completion status; may be reclassified as Permanent or archived |
| Highlights | No completion status |
| Events | No completion status; past/future is determined by Date |

The system uses both the status group name Complete and the status option names Completed or Closed. This is a real terminology inconsistency.


### 5.5 Cancellation and deferral

No explicit Cancelled, Dropped, or Rejected status was found in the inspected schemas.

Observed substitutes:

Projects: On Hold.
Tasks: Waiting On or Someday/Maybe.
References: Backlog.
Archive checkboxes on applicable databases.
Whether On Hold, Someday/Maybe, or Archive is intended to represent cancellation is not explicitly documented. That interpretation is Inferred.


### 5.6 Archiving

Archive behavior is database-specific.

Databases with an Archive checkbox
Projects
Goals
Areas
Notes
Notebooks
Topics
References
Most active views explicitly filter:

Archive = false
Dedicated archive views filter:

Archive = true
Databases without an Archive checkbox
Tasks
Events
Highlights
Key Results
For Tasks, the archive-like workflow is represented by Status = Completed and the Logbook view.

For Events, past/future is represented by the Date field.

For Highlights, no native archive mechanism was exposed.

For Key Results, Status = Closed is the lifecycle endpoint.

Effect on relations and rollups
Archived records remain database rows and can remain related to other records. The schema does not show relation deletion or automatic unlinking when Archive = true.

The inspected rollups do not expose archive-aware filters. Therefore:

Active views hide archived rows when their filters include Archive = false.
Relations can still point to archived pages.
Rollups are defined against relation properties, not against active-view filters.
Whether a specific rollup excludes archived related records cannot be confirmed from the exposed configuration.
This last point is Unknown at runtime, with the relation-only rollup definitions themselves Verified.


## 6. Data integrity

### 6.1 Stable IDs

Verified:

Every queried row exposes a system id.
Every queried row exposes a Notion url.
Relation values are stored as page URLs.
Data sources expose createdTime.
System properties include Created and Edited or equivalent.
Not found:

No user-defined numeric ID.
No human-readable record code.
No explicit UUID property managed by the user.
No visible uniqueness constraint.

### 6.2 Naming rules

Verified naming patterns:

Most databases use Name as the title property.
Highlights uses Highlight as the title property.
Key Results use Name.
Templates use names such as New Project, New Goal, New Event, New Topic, and New Highlight.
Formal naming rule: not found.

No inspected template or database description states a required naming convention for records.


### 6.3 Duplicate prevention

Not found.

No inspected database exposed:

Unique ID enforcement.
Duplicate detection formula.
Duplicate-prevention automation.
Canonical-source constraint.
Merge workflow.
Duplicate review view.
Self-relations such as Related Notes, Related References, and Related Projects provide linking, not duplicate prevention.


### 6.4 Provenance and source tracking

Verified:

References contain:

Source
URL
Publication Date
Type
Platform
Highlights contain:

References
Author
Notes can point to:

References
Highlights
Projects
Goals
Topics
Notebook
Not found:

Universal provenance field across all databases.
Imported-from field.
Source-system ID.
Capture-channel field.
Source confidence field.
Evidence attachment requirement.

### 6.5 Correction history

The available history fields are:

Created
Created Time
Edited
last_edited_time
No accessible configuration exposed:

Field-level change history.
Correction log.
Revision reason.
Editor comments.
Approval history.
Data validation history.
The Edited field provides last-edit metadata only; it is not a correction history.


### 6.6 Decision supersession

Not found.

There is no inspected property named:

Supersedes
Superseded By
Decision Status
Decision Date
Current Decision
Replaced By
Related Notes, Related References, and Related Projects do not explicitly encode supersession semantics.


### 6.7 Required fields

No required-field configuration was exposed other than the intrinsic title property of each database.

Templates leave many operational fields blank:

Project, Goal, Area, Date, Context, Energy, Priority, Owner on Tasks.
Timeline, Area, Goal, and Priority on Projects.
Deadline and Area on Goals.
Source and URL on References.
Reference, Topic, and Note relations on Highlights.
This means the system relies on manual completeness rather than visible schema enforcement.


### 6.8 Naming inconsistencies

The following inconsistencies are Verified and should not be silently normalized in a migration:

Favorite vs Favourite.
References vs exact property name References with a leading space.
Highlights vs exact property name Highlights with a leading space.
Created vs Created Time.
Areas on References versus Area on most other databases.
Notebook on Notes versus Notebooks on Areas.
Completed status options versus Closed for Key Results.
View names such as Completed using the status group Complete.
New page is reused as a template name in multiple databases.
Formula expressions use the unusual current.‣ syntax in Counter.

## 7. Editing and permissions

### 7.1 Expected editors by property

The configuration does not expose property-level editor roles. The following is the strongest factual interpretation available:

| Property category | Expected editor | Evidence / confidence |
| --- | --- | --- |
| Title properties | User with page edit access | Editable title fields; no property ACL exposed. Inferred |
| Status and select fields | User with page edit access | Editable schema fields. Inferred |
| Relations | User with page edit access | Editable relation fields. Inferred |
| Owner on Tasks | Assigned person is represented in the field; edit authority not defined | Property type is person; editor rights Unknown |
| Attendees on Events | Participants are represented in the field; edit authority not defined | Property type is person; editor rights Unknown |
| Dates and URLs | User with page edit access | Editable fields; no automation owner exposed. Inferred |
| Formula properties | Not manually edited | Formula definitions are system-computed. Verified |
| Rollups | Not manually edited | Rollup definitions are system-computed. Verified |
| Created, Edited, and system metadata | Not manually edited | System-managed. Verified |
| Page body | User with page edit access | No body-level ACL exposed. Inferred |
| Button configuration | Unknown | Button blocks are opaque |
| Database automation configuration | Unknown | Not returned by the loader |

### 7.2 Observed permission boundaries

The current Second Brain (1) page reports an explicit permission entry granting the current user full_access.

The canonical Tasks database returned no explicit permission entries through the permission loader. This does not prove it is inaccessible; it indicates that no direct permission entry was returned.

No complete workspace-wide permission map was inspected. Therefore:

Current page access: Verified.
Direct Tasks database permission entries: none returned.
Inherited access model: Unknown.
Other database permission boundaries: Unknown.
Teamspace or group-level access: Unknown.
Property-level restrictions: Unknown.

## 8. Worked examples

### 8.1 Capture to task

Evidence status
No populated Task with Status = Inbox was returned in the sampled Task query. Therefore this is a representative trace based on the actual Task template and Inbox/Next Action views.

Representative trace
Create a Task from New page.
The template defaults Status = Inbox.
Enter a title in Name.
Optionally add Description, Date, Contexts, Energy, Priority, Owner, and relations to Project, Goal, Area, Event, or Notes.
Review the item in the Tasks Inbox view.
Change Status to Next Action, Waiting On, Someday/Maybe, or Completed.
The item then appears in the corresponding operational view.
Verified elements:

New Task default status is Inbox.
Inbox view filters Status = Inbox.
Next Actions view filters Status = Next Action.
Context grouping is available.
Inferred element:

The user manually clarifies and moves the task between states.


### 8.2 Project execution

Real records observed
The accessible data included:

Project: Train for half marathon
Status = In Progress
Priority = High
Timeline starts 2024-12-01
Related task: Complete a 10km run
Task: Complete a 10km run
Status = Next Action
Date = 2024-10-17
Related Project: Train for half marathon
Trace
Train for half marathon
    ↓
Project status: In Progress
    ↓
Complete a 10km run
    ↓
Task status: Next Action
    ↓
Task date: 2024-10-17
The Project database defines Progress as a rollup of completed Task statuses using percent_per_group for the Complete group.

The available evidence verifies the Project-to-Task relationship and the task state. The actual computed Progress value was not resolved in the sampled output.


### 8.3 Meeting to action items

Evidence status
No populated Event row was returned in the sampled Event query. This is therefore a representative trace based on the actual Event template and Action Items linked view.

Representative trace
Create an Event from New Event.
Enter a title, Date, Type, Attendees, Description, and optional Meeting Link.
Fill the Agenda section.
During or after the event, create Tasks inside the Action Items linked view.
The Action Items view automatically filters Tasks by:
Event relation contains current Event page
Assign each Task a Status such as Next Action, Waiting On, or Completed.
The resulting Tasks also appear in the general Tasks and GTD views.
The filtering mechanism is Verified. The actual creation of Tasks from the linked view is structurally available but the user’s exact operating procedure is Inferred.


### 8.4 Reference to highlight to note

Evidence status
No populated Reference, Highlight, or Note chain was returned in the sampled queries. This is therefore a representative trace based on the actual schemas and templates.

Representative trace
Create a Reference from New Book, New Film, New Article, or New Podcast.
The Reference defaults to:
Type-specific Type
Status = Inbox
Archive = false
Favorite = false
Add Source, URL, Platform, and optionally Description.
Move the Reference through Backlog, Up Next, In Progress, and Completed.
Create a Highlight:
Add the extracted passage in Highlight.
Set Author.
Relate it to the originating Reference.
Optionally relate it to Topics.
Create a Note:
Relate it to the Reference.
Relate it to the Highlight.
Classify it as Literature, Project, or Permanent.
Connect it to a Topic, Notebook, Area, Project, Goal, or Task.
The schema supports this chain:

References → Highlights → Notes
The system does not enforce that every Highlight has a Reference or that every Note has a Highlight.


## 9. Confidence table

| Finding | Confidence | Exact evidence |
| --- | --- | --- |
| There are 11 canonical databases | Verified | Databases registry |
| Tasks property names, types, options, relations, formulas, and rollups | Verified | Tasks configuration |
| Projects property names, types, options, relations, formula, and rollups | Verified | Projects configuration |
| Goals property names, types, relations, formulas, and status options | Verified | Goals configuration |
| Key Results formula and status options | Verified | Key Results configuration |
| Areas schema | Verified | Areas configuration |
| Events schema | Verified | Events configuration |
| Topics schema and Counter formula | Verified | Topics configuration |
| Notebooks schema and Counter formula | Verified | Notebooks configuration |
| Notes schema and note types | Verified | Notes configuration |
| References schema, statuses, platforms, and source fields | Verified | References configuration |
| Highlights schema and Media Type rollup | Verified | Highlights configuration |
| Canonical database view definitions | Verified | Individual database configurations |
| GTD Dashboard structure | Verified | GTD Dashboard |
| PARA Dashboard structure | Verified | PARA Dashboard |
| Notes Dashboard structure | Verified | Notes Dashboard |
| Current page embeds Tasks, Projects, Goals, Areas, and Notes | Verified | Second Brain (1) |
| Project template body and linked views | Verified | New Project |
| Goal template body and linked views | Verified | New Goal |
| Area template body and linked views | Verified | New page |
| Event template agenda and Action Items view | Verified | New Event |
| Topic template body and linked views | Verified | New Topic |
| Notebook template current-page filtering | Verified | New page |
| Notes template defaults | Verified | Fleeting, Literature, Permanent template pages |
| Reference template defaults | Verified | New Book, New Film, New Article, New Podcast template pages |
| Highlight and Key Result template defaults | Verified | New Highlight and New Key Result template pages |
| Quick Capture button blocks exist | Verified | Current page, GTD Dashboard, Notes Dashboard page bodies |
| Quick Capture button actions | Unknown | Button blocks returned as opaque unknown blocks |
| Database automations | Unknown | Not exposed by inspected database configuration |
| Recurring-template schedules | Unknown | No recurrence metadata exposed |
| Calendar connection is ready | Verified | Connection inspection |
| Calendar-to-Events synchronization | Unknown | No sync rule exposed |
| Inbox-to-status lifecycle | Verified | Status options and Inbox/Next Action views |
| Manual clarification behavior | Inferred | Editable statuses, relations, and filtered views |
| Completion states | Verified | Task, Project, Goal, Key Result, and Reference status schemas |
| Cancellation state | Verified as not found | No Cancelled, Dropped, or equivalent status exposed |
| Archive filtering in active views | Verified | Active views use Archive = false |
| Whether rollups exclude archived relations | Unknown | Rollup definitions expose no archive filter |
| Stable system IDs and URLs | Verified | SQL row results |
| User-defined unique ID | Verified as not found | No such property in canonical schemas |
| Duplicate-prevention mechanism | Verified as not found | No unique property or duplicate automation exposed |
| Reference provenance fields | Verified | References.Source, URL, Publication Date |
| Universal provenance tracking | Verified as not found | No universal source field |
| Correction history | Verified as not found | Only Created/Edited metadata exposed |
| Decision supersession | Verified as not found | No supersession property or database exposed |
| Current page explicit full access for current user | Verified | Permission inspection for current page |
| Direct Tasks database permission entries | Verified as none returned | Permission inspection for Tasks database |
| Workspace-wide permission boundaries | Unknown | Not fully inspected |
| Project execution sample | Verified | Project and Task row URLs |
| Capture-to-task example | Inferred / representative | Task template and Inbox views; no populated Inbox task sampled |
| Meeting-to-action-items example | Inferred / representative | Event template and Action Items linked view; no populated Event sampled |
| Reference-to-highlight-to-note example | Inferred / representative | Reference, Highlight, and Note schemas/templates; no populated chain sampled |

## Audit conclusion

The accessible EASLO Second Brain is a configured Notion system with:

- 11 canonical databases.
- A dense relation graph connecting execution, planning, events, and knowledge.
- Multiple context-specific dashboards built from linked views.
- Page templates that turn Projects, Goals, Areas, Events, Topics, and Notebooks into relational workspaces.
- Formula and rollup layers for derived context and progress.
- Status-driven workflows for Tasks, Projects, Goals, Key Results, and References.
- Checkbox-based archiving for selected databases.
- Opaque button blocks whose actions cannot be inspected.
- No observable duplicate-prevention, correction-history, or decision-supersession mechanism.
- Limited observable permissions: the current page grants the current user full access, while broader inherited and database-level boundaries remain unknown.
