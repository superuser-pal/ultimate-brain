# Ultimate Assistant (contract, decisions 0064 and 0072)

**Status:** contract for release 0.10.0 (CC-108), built by CC-109, accepted by CC-110. Written by Claude Code.

How this file fits: it holds the assistant's whole behaviour: what it reads, the signals and their thresholds, the ranking, the report, how a yes or a Review row changes things, where a ramble lands, the dismissal memory and the sub-agent. Field definitions are in [schema.md](schema.md) (§11 proposal kinds `notion_change` and `set_field`, §2 `_assistant/`), command behaviour in [cli.md](cli.md) (§5.31 `brain assistant`, §5.6 `proposal settle`, §5.7 apply, §5.14.4 render, §5.14.5 `sync tasks --direct`). The machine-readable shapes are in [schemas/assistant.schema.json](schemas/assistant.schema.json), with examples in [examples/assistant/](examples/assistant/).

**Names.** The assistant is **Ultimate Assistant** (0072 §1). Its skill is `ultimate-assistant` (written in the fork's `brain/`, delivered in the pinned snapshot like every brain skill, skills-delivery §9.5); its Claude Code sub-agent is `.claude/agents/ultimate-assistant.md` (§10); "brain assistant" in older text means this feature. The Notion custom agent keeps its name, Brain Assistant.

**Calls taken in this contract that the user may veto** (each the simplest reading of 0064 and 0072; none contradicts them):
1. A task the user dictates in chat is created with no source and no backlink (`sync tasks --direct`), not from a text source of the chat: the chat is not knowledge, and a source would put it in the Inbox as a row (§7).
2. Every change made after a yes goes through a proposal file that is applied at once (decided in chat), so Git records what changed and why; such a proposal never becomes a Review row (§6).
3. A Notion-owned change approved in a Review row is carried out by the skill that applied the decision, through the Notion MCP; until then the proposal waits as `approved` (§6.3).
4. "Someday" is read by name as a parked task status, beside the mapped Waiting On status (§3.1).
5. The signals' exact rules (which notes count as a mention, what makes two projects duplicates, when a project is misplaced) are fixed in §3, with no setting (0072 §3).

---

## 1. A session

On demand only (0064): the user asks ("review my projects", "what's stalled in Clients?"). The scheduled run is CC-111 (0.13.0). **Report only:** when nobody can answer: the skill runs as a sub-agent (the agent file says so, §10), or in a non-interactive run (`claude -p`, `codex exec`, a schedule). `claude --agent ultimate-assistant` and an ordinary chat are interactive. Report only, it runs steps 1, 2 and 4 to 6 and returns the report: it skips step 3, writes nothing (no proposal, no log line, no commit) and ends there.

1. **Preconditions.** `brain status --json` resolves the brain. The skill commits nothing it didn't write.
2. **Read Notion live** (§2.1) into the assistant snapshot. If Notion can't be read, the session runs **brain only** (§2.3).
3. **Waiting Notion writes** (live only). For each proposal of kind `notion_change` with status `approved` or `edited` (`brain proposal list --status approved,edited`, which returns every frontmatter field), the skill passes its recorded decision to `brain apply` again, copied exactly: `{ proposal, action, note?, fixes?, decided_at, decided_by }` from its `decision` (an equal decision, cli.md §5.7, so nothing is re-decided), and carries out the returned `notion_writes` (§6.4). These are the user's decisions that no skill has carried out yet. Brain only, this step waits for a run that reaches Notion. When it wrote anything, it reads Notion again (step 2), so the findings see the new values. When there were any, the skill says so in one line before the report: `Carried out <n> approved changes from Review.`, plus `<n> couldn't be written: <title>; <title>.` for the failed ones.
4. **Read the linked repos' rollups** (§2.2) into the same snapshot.
5. **Findings.** `brain assistant findings --input <snapshot> [--scope <id>]` (cli.md §5.31) returns the ranked findings and the report text (§4).
6. **The report.** The skill shows `data.report` exactly as returned. It writes nothing before the user answers. A session the user opens with a ramble and no request for a review (§7) still runs steps 1 to 5, which give it the current tasks, projects and Areas, but shows no report.
7. **The user's answers** are carried out one by one (§5): a yes applies directly (§6.1, §6.2), "propose N" writes a Review row (§6.3), "skip N" offers a status or remembers the skip (§8), "more" and a named scope run step 5 again on the same snapshot (§3.5), and a ramble is split and placed after a yes (§7).
8. **Close.** After the user's last answer: `brain index`, `brain views`, `brain lint`, commit, push per `settings.push`, then one log line (§9) and the closing summary (§4.4).

The session reads; it changes nothing the user hasn't said yes to or asked to propose (0072 §2).

## 2. What it reads

### 2.1 Notion, live (0064)
Tasks exist only in Notion; a project's and an Area's Status and Archived live there too (schema §7). The skill reads them through the Notion MCP, **every row**, following `next_cursor` until each query is exhausted, and writes the **assistant snapshot** (`$defs/snapshot` in assistant.schema.json):

```json
{
  "as_of": "2026-11-06T10:00:00Z",
  "notion": "live",
  "task_statuses": [
    { "name": "To Do", "group": "todo" }, { "name": "Doing", "group": "in_progress" },
    { "name": "Waiting On", "group": "todo" }, { "name": "Someday", "group": "todo" },
    { "name": "Done", "group": "complete" }, { "name": "Won't Do", "group": "complete" }
  ],
  "tasks": [
    { "page_id": "2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e", "title": "Send the revised quote", "status": "To Do",
      "due": "2026-10-29", "projects": ["7c6b5a49-3827-4615-a4b3-c2d1e0f9a8b7"], "areas": [],
      "created": "2026-10-01T09:00:00Z", "last_edited": "2026-10-20T08:30:00Z" }
  ],
  "projects": [
    { "page_id": "7c6b5a49-3827-4615-a4b3-c2d1e0f9a8b7", "brain_id": "prj-9x4t1b7e", "title": "Acme website",
      "status": "Active", "archived": false, "last_edited": "2026-10-28T16:00:00Z" }
  ],
  "areas": [
    { "page_id": "5d4c3b2a-1908-4f7e-8d6c-5b4a39281706", "brain_id": "area-2m7c4h8n", "title": "Clients", "archived": false }
  ],
  "repos": []
}
```

- `as_of`: the time the reads started (`--now` in tests). Page ids are in Notion's dashed form, lowercase.
- `task_statuses`: the options of the mapped Tasks `status` property (schema §12 `notion.tasks.properties.status`), in the database's order, from the data source's schema. `group` is `todo`, `in_progress` or `complete` for a Notion Status property (its groups To-do, In progress, Complete), and `null` for a select.
- `tasks`: every row of the Tasks database (`notion.tasks.database`) that isn't in Notion's trash. Values come from the mapped properties (schema §12): `title`, `status` (the option name, `null` when empty), `due` (the start date's first 10 characters, `null` when empty), `projects` and `areas` (the relations' page ids, sorted; `[]` when unmapped or empty), and the page's `created_time` and `last_edited_time`. A property whose mapping is empty is sent as `null` (`status`, `due`) or `[]`.
- `projects`, `areas`: every row of the Projects and Areas databases (`notion.databases`): `brain_id` (the Brain ID, `null` when empty), `title` (Name), `status` (Projects · Status, `null` when empty), `archived` (Archived), `last_edited` (projects only).
- With the **Tasks module off** (schema §12), `tasks` and `task_statuses` are left out and the Tasks database isn't read.
- `brain assistant findings` matches a Notion row to its note by `brain_id`, else by the note's `notion` page id. A Projects or Areas row that matches no note isn't a subject of any finding; the report counts it under "not in the brain yet" (§4.2) so the user can run a sync.

Live values win over the brain's dated `notion_fields` snapshot for Status and Archived. The assistant never stores what it reads: task statuses stay in Notion (0018), and only the next `brain sync` refreshes `notion_fields`.

### 2.2 Linked repos (0066)
For each `brain.json` `repos` entry linked with a kit whose task mode is **tracked in the repo** (linked-repos.md §2.4), the skill runs `brain repo tasks <name>`, fetching the issues first for a GitHub or GitLab source (linked-repos.md §4.1), and adds `{ "name": "<name>", "rollup": <its data> }` to `repos`. An entry refused with `NO_KIT`, `MODE_CONNECTED` or `NO_TASKS` is left out silently (a connected repo's tasks are already Notion Tasks). One that fails (no `gh`, not logged in, any error) is added as `{ "name": "<name>", "error": "<the reason in a few words>" }` instead, and the report says so in one line. A rollup's open items (`todo`, `in_progress`, `waiting`, `review` counts) are next steps of its target: the project of `rollup.target.project`, else every project of the Area `rollup.target.area`.

### 2.3 Notion unreachable
When a Notion read fails (the MCP is missing, not logged in, or any query of §2.1 fails after one retry), the rows already read are discarded, so findings never mix live and dated values, and the snapshot is `{ "as_of": …, "notion": "unreachable", "repos": […] }`, and the whole session is **brain only**: the report's second line says so (§4.2), statuses come from `notion_fields` with their `as_of` date, the signals that need Notion are skipped (§3.3), and no change to a Notion-owned field is offered. Brain-owned changes and Review rows are still offered; a publish waits for the next run that reaches Notion.

## 3. Signals

### 3.1 Terms (normative)
- **Days.** `D` is the UTC date of `as_of`. The age of a timestamp or date `x` is `days(x)` = `D` minus the UTC date of `x`, in whole days.
- **Task states,** from `status`, compared case-insensitively after trimming:
  - **dropped:** the status is `notion.tasks.wont_do_status` (default `Won't Do`);
  - **done:** not dropped, and its option's `group` is `complete`, or (a select, `group` `null`) the status is `Done`;
  - **waiting:** the status is `notion.tasks.waiting_on_status` (default `Waiting On`); **someday:** the status is `Someday`. Both are **parked**;
  - **open:** neither done nor dropped (an empty status is open); **active:** open and not parked; **next step:** open and not someday.
- **A task's projects** are the notes whose `notion` is in its `projects`; a page id no note has is a project outside the brain, and its status comes from the `projects` row with that `page_id`, if any.
- **Live project:** not archived (the live Archived, else `notion_fields.archived`, or `lifecycle: archived`, or a file under `archive/`) and with a status other than `Done`. Its status is the live row's, else (brain only) `notion_fields.status`; a project with neither has status `null`.
- **A task belongs to an Area** when the Area's `notion` is in its `areas`, or a live project it names has that `area`.
- **"First"** of several notes always means by title (lowercase, NFC, compared by code points), then by id. **A project belongs to** its `area`; **an Area to** its `domain`.
- **Mentions of a project:** a knowledge note (every type except `source`, `view`, `proposal` and `memory`, and not the project itself) whose `projects` lists it, dated by its `date` for a meeting and its `created` otherwise; a source whose `projects` lists it, or whose `repo` is a `repos` entry with that `project`, dated by its `captured`; and the project note itself, dated by its `created` and its `updated`.
- **Normalized title:** NFKD, combining marks dropped, lowercase, split on every run of characters outside `[a-z0-9]`, empty tokens and these stop words dropped: `a an and the of for to in on project de del la el los las y en para proyecto`. The result is a set of tokens.

### 3.2 Thresholds (fixed, 0072 §3)

| Constant | Value | Used by |
|---|---|---|
| `TASK_OVERDUE_DAYS` | 3 | `task_overdue`: `days(due)` ≥ 3 |
| `TASK_STALLED_DAYS` | 14 | `task_stalled`: `days(last_edited)` ≥ 14 |
| `PROJECT_STALLED_DAYS` | 21 | `project_stalled`: `days(last activity)` ≥ 21 |
| `MISPLACED_MIN_NOTES` | 3 | `project_misplaced` |
| `MISPLACED_SHARE` | 2/3 | `project_misplaced` |
| `DUPLICATE_SIMILARITY` | 2/3 | `project_duplicate` |
| `REPORT_LIMIT` | 10 | findings shown per page (0072 §5) |
| `DISMISS_DAYS` | 30 | a skip is remembered this long (0072 §6) |

No setting changes them in 0.10.0; per-area preferences are 0.14.0.

### 3.3 The signals (normative; the names are stable)

Each finding has one **signal**, one **subject** and a **key** `<signal>:<subject key>`: the subject key is the brain id, or `notion:<page id>` for a task, or `<id1>+<id2>` (sorted) for a project pair. A subject can have several findings, except where a row says "not when".

| Signal | Category | Subject | Fires when | Needs |
|---|---|---|---|---|
| `task_overdue` | overdue | task | the task is active, `due` is set and `days(due)` ≥ 3 | live, Tasks on, `status` and `due` mapped |
| `task_stalled` | stalled | task | the task is active, not `task_overdue`, and `days(last_edited)` ≥ 14 | live, Tasks on, `status` mapped |
| `project_stalled` | stalled | project | the project's status is `Active`, not `project_done_but_open`, and its **last activity** is 21 or more days old: the latest of its mentions' dates and the `last_edited` of its done tasks (§3.1) | the brain; with Tasks on and live, the done tasks too |
| `project_no_next_step` | no next step | project | the project's status is `Active`, not `project_done_but_open` or `project_stalled`, it has no task that is a next step (Someday tasks don't count), and no repo rollup with open items targets it (§2.2) | live, Tasks on, `status` and `project` mapped |
| `project_done_but_open` | no next step | project | the project is live, has at least one task, every one of its tasks is done or dropped and at least one is done, and no repo rollup with open items targets it | live, Tasks on, `status` and `project` mapped |
| `project_misplaced` | structure | project | the project is live; at least 3 notes that mention it (§3.1, the project note itself excluded) have an `area`; one Area other than the project's, not archived, holds at least two thirds of them (`3 × count ≥ 2 × total`, where `total` counts only the mentions that have an `area`, sources included) | the brain |
| `project_duplicate` | structure | project pair | both projects are live and their normalized titles (§3.1) are equal and not empty; or both have at least 2 tokens and share at least two thirds of their union (`3 × |A ∩ B| ≥ 2 × |A ∪ B|`); or the normalized title of one equals the normalized form of an alias of the other | the brain |
| `task_no_project` | structure | task | the task is open and has no project, or every project it names is closed: a note that isn't live (§3.1), or, outside the brain, a Projects row whose status is `Done` or that is archived | live, Tasks on, `project` mapped |
| `area_no_domain` | structure | Area | the Domains module is on, the Area isn't archived and has no `domain` | the brain |
| `area_empty` | structure | Area | the Area isn't archived, no live project of status `Active` or `Planned` belongs to it, no open task belongs to it (with Tasks on), and no repo rollup with open items targets it or its projects | live |

- **"Needs".** A signal whose needs aren't met isn't computed, and `data.skipped_signals` lists it once with one reason, the first that applies of `NOTION_UNREACHABLE`, `MODULE_OFF` (Tasks or Domains off) and `NOT_MAPPED` (a mapping property it needs is empty; `property` names the first empty one in the order `status`, `due`, `project`). `project_stalled` is never skipped: brain only, or with Tasks off, it uses mentions alone (statuses from `notion_fields` brain only). `project_misplaced` and `project_duplicate` are never skipped.
- **Repo rollups** carry no dates, so they never count as activity for `project_stalled`; a repo's files ingested as sources do (§3.1 mentions). Rollups count only as next steps.
- **Mentions** count each note once. A note's `updated` moves only when its content changes (cli.md §3.6 rule 6): a `sync record` or a `notion_fields` refresh doesn't make a project look active.
- **The pair's order.** In a `project_duplicate`, the **survivor** is the project more notes mention (§3.1), then the one created first, then the lower id; the other is the duplicate.
- **Evidence** (the finding's `evidence` object): `task_overdue` `{ due, days_late, status }`; `task_stalled` `{ last_edited, days_idle, status }`; `project_stalled` `{ last_activity: { date, kind: "task_done"·"meeting"·"note"·"source"·"project_note", ref }, days_idle }` (`ref` a note id or a task page id; on equal dates the order of `kind` here wins, then the lower `ref`); `project_no_next_step` `{ tasks_someday, tasks_done, tasks_dropped }`; `project_done_but_open` `{ tasks_done, tasks_dropped }`; `project_misplaced` `{ area, suggested_area, notes, of }` (`of` = the `total` above, `notes` = the suggested Area's count); `project_duplicate` `{ survivor, duplicate, shared_tokens }`; `task_no_project` `{ projects: [<page ids of its closed projects>] }`; `area_no_domain` `{}`; `area_empty` `{ projects_on_hold, projects_done }`: the Area's projects that aren't archived, with status On Hold or Done (a project with no status is in neither; no project gives `0` and `0`).

### 3.4 Recommendations and status offers
Each finding carries `recommendations` in the order of the table below and `status_offers` (§8). An **action** is one of the stable codes of §6's table; `value` is filled when the rule gives it and `null` when the user must say it. A recommendation is **left out** when its value would name a status option the Tasks database lacks, when it needs a Notion page a note doesn't have (`set_task_project` to a project with no `notion`), when it changes a Notion-owned field in a brain-only run (§2.3), and when it is `add_task` with the Tasks module off. The ones left are then lettered `a`, `b`, `c` in order, so the first is always `a`. `status_offers` are filtered by the same rules (an offer of a status the Tasks database lacks is left out; brain only, there are none). A project's statuses are the four of schema §4 (`Planned`, `Active`, `On Hold`, `Done`), which every Projects database has. A finding left with none is still shown, with the line `   no change I can make here: skip it, or say what to do` (§4.1); "yes N" on it makes the skill say so and apply nothing.

| Signal | Recommendations | Status offers |
|---|---|---|
| `task_overdue` | a `set_task_due` null · b `set_task_status` the done status · c `set_task_status` the dropped status | the waiting status, `Someday` |
| `task_stalled` | a `set_task_due` null · b `set_task_status` the done status · c `set_task_status` the dropped status | the waiting status, `Someday` |
| `project_stalled` | a `set_project_status` `On Hold` · b `add_task` · c `set_project_status` `Done` | `On Hold` |
| `project_no_next_step` | a `add_task` · b `set_project_status` `On Hold` · c `set_project_status` `Done` | `On Hold` |
| `project_done_but_open` | a `set_project_status` `Done` · b `add_task` | none |
| `project_misplaced` | a `move_project` the suggested Area | none |
| `project_duplicate` | a `merge_projects` `{ target: <duplicate>, merge_into: <survivor> }` | none |
| `task_no_project` | a `set_task_project` the only live `Active` project of the task's Area, else null. The task's Area is the one brain Area its `areas` names, or, when it names none, the one Area of the closed projects it names; none or several, and the value is null · b `set_task_status` the dropped status | none |
| `area_no_domain` | a `set_area_domain` the only Domain not archived when there is exactly one, else null | none |
| `area_empty` | a `archive_area` `true` | none |

The **done status** is the option named `Done` when there is one, else the first option of group `complete` that isn't the dropped status; the **dropped status** is `wont_do_status`; the **waiting status** is `waiting_on_status`. `add_task` has the value `{ "project": "<prj id>" }`: the user gives the task's words.

### 3.5 Scope, ranking and the cap (0072 §5)
- **Scope.** Without `--scope`, every finding counts. With `--scope <id>` (an Area, Domain or Project; the skill resolves the name the user said to an id, and asks when two match), a finding counts when the id is in its subject's reach: a task's projects, the Areas it belongs to and their Domains; a project, its Area and that Area's Domain; a pair, the reach of both projects; an Area and its Domain.
- **Dismissals** (§8) then remove every finding whose key has an active entry; `data.dismissed` counts them.
- **Ranking,** worst first: by category (overdue, stalled, no next step, structure); within a category by signal, in the table's order except that `project_stalled` comes before `task_stalled` and `project_no_next_step` before `project_done_but_open`; within a signal, `task_overdue` by `days_late` and the two stalled signals by `days_idle`, both descending, and every other signal by the subject's title (lowercase, NFC, compared by code points; a pair's title is `<duplicate title> and <survivor title>`); ties, also of days, by title and then by key.
- **The cap.** The first `--limit` (default 10) findings are returned, each with its `rank`: `--number-from` plus its position in the list after scope, dismissals and exclusions, minus 1, which is the number the report prints and the user says; `data.total` counts that whole list.
- **Within a session** the skill reuses the snapshot it read in §1 step 2 (it doesn't read Notion again) and numbers findings for the whole session, so a number the user says is never ambiguous:
  - **"more"** runs `findings` again with the same `--scope`, `--exclude` = every key already shown in this session, and `--number-from` = the last number shown plus 1;
  - **a new scope** ("now Clients") runs it with that `--scope`, `--exclude` = every key the user already answered in this session (applied, proposed or skipped), and `--number-from` as for "more".
  A finding the user changed is therefore never shown again in the same session, even though the snapshot still holds its old values.

## 4. The report (0072 §2, §5)

`brain assistant findings` builds the report text, so the skill doesn't word it. The skill prints `data.report` as it is.

### 4.1 Layout (normative)
```text
Ultimate Assistant · whole brain · 6 Nov 2026
Notion read live: 42 tasks, 9 projects, 6 areas.

1. Overdue · "Send the revised quote" (task in Acme website) · due 29 Oct, 8 days late
   a) give it a new due date  b) mark it Done  c) mark it Won't Do
2. Stalled · Acme website (project) · nothing done or mentioned for 23 days (last: meeting Acme sync, 14 Oct)
   a) set Status to On Hold  b) add a next step  c) set Status to Done
…
10. Structure · Health (area) · no Domain
   a) put it in a Domain

14 more. Say "more", or name an Area, Domain or Project.
3 skipped for now.
Answer with "yes 1, 2b", a change ("1: due Friday"), "skip 4 because …", or "propose 5" for a Review row.
```

- **Counts** everywhere in the report use the singular for 1 (`1 task`, `1 day late`, `1 area`) and the plural otherwise.
- Line 1: `Ultimate Assistant · <scope> · <D Mon YYYY>` (UTC date of `as_of`, English month abbreviation), where `<scope>` is `whole brain`, or the scope's title followed by ` (area)`, ` (domain)` or ` (project)`: `Clients (area)`.
- Line 2, live: `Notion read live: <n> tasks, <n> projects, <n> areas.` (the tasks part left out with Tasks off), then ` <n> projects and <n> areas aren't in the brain yet: run a sync.` when any (a count of 0 is left out with its words and the `and`; `isn't` when the one count left is 1). Brain only: `Notion unreachable: brain only. Statuses as of <D Mon YYYY>; tasks not checked.`, the date being `statuses_as_of` (the oldest `notion_fields.as_of` the findings used); when it is `null`, `Notion unreachable: brain only; tasks not checked.` Then, live or not, one sentence per skipped reason other than `NOTION_UNREACHABLE`: `Tasks module off: tasks not checked.`, `Domains module off: Areas without a Domain not checked.`, and per unmapped property `Tasks has no <property> mapped: <labels> not checked.`, the labels of its skipped signals in §3.3's order, joined by `, ` with ` and ` before the last; then per failed repo `Repo <name> not read: <error>.` Signal labels: `task_overdue` overdue tasks, `task_stalled` stalled tasks, `project_stalled` stalled projects, `project_no_next_step` projects with no next step, `project_done_but_open` finished projects still open, `project_misplaced` misplaced projects, `project_duplicate` duplicate projects, `task_no_project` tasks with no project, `area_no_domain` Areas without a Domain, `area_empty` empty Areas.
- A blank line, then one block per finding: `<number>. <Category> · <subject> · <evidence>` (`<number>` = the finding's `rank`), then one line, indented three spaces, holding `<letter>) <label>` for each recommendation joined by two spaces (or, with none, `no change I can make here: skip it, or say what to do`). Blocks follow each other with no blank line between them. Category labels: `Overdue`, `Stalled`, `No next step`, `Structure`. Subject: a task `"<title>" (task[ in <project title>])` (its first project in the brain, by title), a project `<title> (project)`, an Area `<title> (area)`, a pair `<duplicate title> and <survivor title> (projects)`.
- Evidence text: `task_overdue` `due <D Mon>, <n> days late`; `task_stalled` `no edit for <n> days (status <status>)`; `project_stalled` `nothing done or mentioned for <n> days (last: <kind label> <ref title>, <D Mon>)` with kind labels `task done`, `meeting`, `note`, `source`, `project note`; `project_no_next_step` `Active with no next step`; `project_done_but_open` `every task done (<d> done[, <x> dropped]), Status still <status>` (`<status>` = `empty` when it has none); `project_misplaced` `in <area title>, but <notes> of its <of> notes are in <suggested title>`; `project_duplicate` `look like the same project`; `task_no_project` `no project` when it names no project page, else `its project is closed`; `area_no_domain` `no Domain`; `area_empty` `nothing active`.
- Labels: `set_task_due` null `give it a new due date`, with a value `move the due date to <D Mon>`; `set_task_status` `mark it <status>`; `set_task_project` null `put it in a project`, with a value `put it in <project title>`; `set_task_area` `put it in <area title>`; `set_project_status` `set Status to <status>`; `archive_area` `archive it`; `move_project` `move it to <area title>`, plus ` (and its <n> open tasks that name <old area title>)` when the snapshot has any (open tasks of the project whose `areas` holds the old Area's page); `set_area_domain` null `put it in a Domain`, with a value `put it in <domain title>`; `merge_projects` `merge <duplicate title> into <survivor title>`, plus ` (and move its <n> open tasks)` when the snapshot has any; `add_task` `add a next step`.
- After the blocks, a blank line, then only the lines that apply: `<total − shown> more. Say "more", or name an Area, Domain or Project.`; `<dismissed> skipped for now.`; and always `Answer with "yes 1, 2b", a change ("1: due Friday"), "skip 4 because …", or "propose 5" for a Review row.`
- **Nothing found:** after line 2, `Nothing needs you.` (and the dismissed line when any). The text ends with one newline.

### 4.2 What the skill adds
Nothing to the report itself. When the user answers, the skill confirms each change in one line as it is made ("1: due date moved to 13 Nov", "4: skipped for 30 days"), quoting values as they were written.

### 4.3 As a sub-agent
§10: the report is the sub-agent's whole answer; it applies nothing.

### 4.4 Closing summary
One line, then the push line of AGENTS.md: `Done: <n> changed, <n> Review rows, <n> skipped, <n> created (<t> tasks, <p> projects, <c> captures).` (parts at 0 are left out; `Nothing changed.` when every count is 0). **changed** counts the proposals applied after a yes in this session, one per proposal (a `merge_projects` yes that also moves 4 tasks is 5; a status accepted from a skip's offer counts here, not as skipped), plus the waiting writes of §1 step 3 (a yes that replays an `approved` proposal counts once, as changed); **Review rows** the proposals written for "propose" (one proposed and later said yes to counts in both); **skipped** the dismissals written; **created** what §7 created. Items that couldn't be placed (§7, brain only) are named after it: `Not placed (Notion unreachable): <item>; <item>.`

## 5. The user's answers (0072 §2)

- **A yes applies exactly what it names.** "yes 1" is the finding's first recommendation, "yes 2b" its second, "yes 1, 3" each; "yes to all" means every recommendation `a` shown in the last report, "all but 3" all of them except 3. Nothing is applied for a finding the user didn't name. Two letters of one finding in one answer ("yes 1a, 1b") make the skill ask which, and apply nothing for that finding until it knows.
- **Order.** The changes of one answer are made in the order of their numbers, then the ramble items in the list's order. Each proposal carries the value read in the snapshot, so a change an earlier one made stale (a merge, then a yes on one of the duplicate's tasks) settles `stale` and the skill says so (§6.4). Values a "yes to all" needs (recommendations with value `null`) are asked first, one finding at a time in number order; then everything is applied.
- **A recommendation with value `null`** (a new due date, a project, a Domain, the words of a next step) needs the user's value: "yes 1" on it makes the skill ask for that value, and nothing is applied until it is given. A value the user gives ("1: due Friday", "4: put it in Acme website") is resolved against `as_of` and the brain (dates to `YYYY-MM-DD`, names to ids by title and alias); when it is ambiguous (two notes match, "next week"), the skill asks and applies nothing for that finding.
- **A value or a change the user states** goes into the proposal written at §6.2 step 1 (`value_after`, `after`), which is then approved: "1: due Friday" on a `set_task_due` is that action with Friday's date, and a status offer the user picks directly ("3: mark it Waiting On") is that `set_task_status`. `fix` is used only when the user changes a proposal that already exists (§6.2). **A change that isn't one of the recommendations or offers** ("3: rename it Acme site") is applied when §6's table has an action for it; otherwise the skill says it can't do that here and names the skill that can (a rename is a Notion edit by the user, or a proposal through brain-sync's correction path).
- **"propose N"** writes the finding's recommendation `a` as a Review row instead (§6.3), "propose Nb" its recommendation `b`; a recommendation with value `null` needs the user's value first, as for a yes. **"skip N"** is §8. **"more"** and **a scope** re-run the findings (§3.5).
- **A ramble** (thoughts that aren't answers to a numbered finding) is §7.

## 6. How a change is made

### 6.1 Actions

| Action | What changes | Owner | Proposal kind |
|---|---|---|---|
| `set_task_status` | the task's Status | Notion | `notion_change` (`tasks`, `status`) |
| `set_task_due` | the task's Due | Notion | `notion_change` (`tasks`, `due`) |
| `set_task_project` | the task's Project relation | Notion | `notion_change` (`tasks`, `project`) |
| `set_task_area` | the task's Area relation | Notion | `notion_change` (`tasks`, `area`) |
| `set_project_status` | Projects · Status | Notion | `notion_change` (`projects`, `status`) |
| `archive_area` | Areas · Archived | Notion | `notion_change` (`areas`, `archived`) |
| `move_project` | the project's `area` | brain | `set_field` (`area`) |
| `set_area_domain` | the Area's `domain` | brain | `set_field` (`domain`) |
| `merge_projects` | the duplicate merged into the survivor | brain | `merge` (schema §11.2) |
| `add_task` | a new Task | Notion | none: chat only (§7) |

**Who writes a Notion-owned field (schema §7).** The CLI never sends one: `sync render` doesn't, and no command calls Notion. The **skill** writes it through the Notion MCP, in exactly two cases: the user said yes to that change in a live chat (§6.2), or the user approved a `notion_change` Review row (§6.3). Either way a `notion_change` proposal records it first, and `brain apply` hands the skill the exact write (`notion_writes`, cli.md §5.7).

**Moving a project, or putting an Area in a Domain,** changes a brain-owned field, so it goes through Git first: a `set_field` proposal, applied by `brain apply`; then `sync render` publishes the project's Area or the Area's Domain relation like any brain-owned property (cli.md §5.14.4), and `sync record` stores it. The project's open tasks that name the old Area in their `areas` are moved too, under the same yes, since the recommendation's label says so (`set_task_area`, one `notion_change` per task); a task that names no Area follows the project and needs nothing.

### 6.2 After a yes in chat (direct apply)
For each change the user said yes to, in this order, before the next one:
1. `brain proposal new` with the proposal of §6.1's table: `finding` = the finding's key, `source` = `agent:ultimate-assistant/<session>` (the session's `as_of`, compact: `20261106T100000Z`), `why` = the report's evidence text, `area` = the finding's `area`, and the kind's fields (cli.md §5.6). For `notion_change`, `value_before` is the value in the snapshot.
2. `brain apply --input` with `{ proposal, action: "approve", decided_at: <now>, decided_by: "chat" }`.
3. **Notion-owned:** carry out `data.notion_writes` (§6.4), then `brain proposal settle`. **Brain-owned:** `brain index`, `brain views`, `brain lint`, commit; then `brain sync render --ids <every note the apply changed>`, write the payloads through the MCP, `brain sync record`, commit. The yes covers this publish: `settings.publish: ask` isn't asked again for it. A `merge_projects` yes also covers moving the duplicate's open tasks to the survivor (one `notion_change` per task, `project`), as its label says. These task proposals, and a move's, have no `finding` and take the `area` of the finding they come with. Brain only, the merge is applied alone and the confirmation says the tasks weren't moved; while open, each is then a `task_no_project` in the next live session.

A proposal decided in chat before it had a Review row never gets one (cli.md §5.14.4): it is the Git record of the yes.

**A yes to a change already proposed.** When step 1 is skipped `DUPLICATE_PENDING` (the user said "propose 5" earlier, and now "yes 5"), the `existing` proposal it names is used instead: still `pending`, step 2 decides it (approve, or `fix` with `fixes: [{ value }]` and `note` = the user's words when they gave another value); already `approved` or `edited` (a `notion_change` waiting for its write), its recorded decision is replayed as in §1 step 3 and nothing is re-decided. If that proposal has a Review row, the publish of step 3 (or, for a Notion-owned change, the next render) updates the row's State, so it doesn't stay Pending. A change already made is skipped `NO_CHANGE` by step 1, and the skill says it is already done.

**The proposal's `area`** is always the finding's `area` (for a change from a ramble, §7), never the Area a move goes to.

**Relation values.** `set_task_project` and `set_task_area` set the relation to exactly `value_after`: the recommendation's value is the one page that replaces the task's closed projects: the skill builds `value_after` from the finding: `subject.current.projects`, minus the closed pages in `evidence.projects`, plus that page, deduplicated and sorted (a page with neither a note nor a Projects row isn't closed, so it stays); a user's "also put it in Y" is the current list plus Y. A merge's task move replaces the duplicate's page by the survivor's in each open task's `projects`, and a project move replaces the old Area's page by the new one in each moved task's `areas`; both deduplicate and sort. A task move whose new page doesn't exist yet (a survivor or Area never published) is left out, and the confirmation line says so.

### 6.3 A Review row, when asked (0072 §2)
"propose N" (or "propose it", "later" on a finding) writes step 1 of §6.2 and no decision: the proposal is `pending`. The skill publishes it at once (`brain sync render --ids <prp id>`, the MCP, `brain sync record`; the user asked for the row, so the publish is covered). The row is a **Suggestion** (schema §14): Kind `Notion Change` or `Set Field`, or a `merge` row as today. The user decides it in Notion like any row (Approve, Reject, Fix with What to fix). An `add_task` can't be a Review row: the skill says so and offers an Inbox capture instead (§7).

**How a decided row is applied.** Every skill that runs `brain apply` or `brain sync apply` (brain-apply, brain-sync, brain-catch-up attended and unattended, and this one) carries out `data.notion_writes` (§6.4) after the apply and settles them. An unattended catch-up does too: an Approve is the user's explicit decision (0051); a Fix waits for an attended run, as for every Fix. Until a skill carries out a write the proposal stays `approved` (or `edited`), its row shows Pending, and the next Ultimate Assistant session does it first (§1 step 3). A `set_field` or a `merge` row is applied by `brain apply` like any proposal.

### 6.4 Carrying out a Notion write
For each `notion_writes` item `{ proposal, database, page_id, property, payload, expect, value }` (cli.md §5.7):
1. Read the page's property through the MCP and normalize it as the snapshot does (§2.1).
2. Equal to `value` → nothing to write; settle `applied`. Equal to `expect` → write `payload` to `property` on `page_id`; on success settle `applied`. Anything else → write nothing; settle `stale` (the user changed it in Notion since).
3. A failed MCP write settles nothing: the proposal stays `approved`, and the skill names it in its confirmation line (or, in §1 step 3, its line before the report).
4. `brain proposal settle --input` with the results (cli.md §5.6); commit.

## 7. A ramble lands in its place (0072 §4)

When the user says several things at once ("the Acme quote is done, I should call Lucía about the contract next week, and maybe a blog series on onboarding"), the skill splits it into items and shows them as a numbered list, each with where it goes:

| The item | Lands as | How, after the yes |
|---|---|---|
| A change to something that exists ("the quote is done", "Acme is on hold") | the matching action of §6.1 | §6.2 |
| A task the user will do ("call Lucía next week") | a Task in Notion, with Project and Due when given, Area when the user named an Area and no project | `brain sync tasks --direct` (cli.md §5.14.5), then the MCP creates each page; nothing is recorded. With Tasks off it is offered as a capture instead |
| Someone else's commitment the user wants to track | a Waiting On Task with that person as owner | as a task, the item carrying `"status": "waiting_on"` and `"owner": "<their name as the user said it>"` (cli.md §5.14.5) |
| A new project ("start a project for the onboarding guide") | a project note and its page from the Projects template | `brain note new` (type `project`, `reviewed` from creation, 0070; `area` required: asked when not said), `brain index`, `brain views`, `brain lint`, commit, `brain sync render --ids <prj id>` (a `create` with the default template, cli.md §5.14.4), the MCP, `brain sync record`, commit. A Status the user gave is then a `set_project_status` under the same yes (§6.2), whose `value_before` is the Status the new page has, read through the MCP once the template is applied |
| An idea, a note or anything to keep ("a blog series on onboarding") | an Inbox capture for the normal ingest | the MCP creates an Inbox row: Name = a short title, Kind `Capture`, Brain Status `Ready`, Project and Area when named, body = the user's words for that item, as they said them. Nothing is written in Git: the next catch-up takes it in |

- **The yes is the review** (0072 §4): what the user says yes to lands directly; what they don't is dropped. "Later" on an item makes it an Inbox capture with Brain Status `New`, which no run takes in until the user sets it to Ready.
- **No second copy.** Before showing a task item, the skill looks for an open task with the same title (trimmed, case-insensitive) in the snapshot and among the tasks it created earlier in the session, and shows `already in Tasks` for it instead, with nothing to say yes to. A page whose creation fails is named in the confirmation and not retried; the ones created before it stay.
- **Values.** Dates and names are resolved as in §5, and the list shows the resolved values ("Due 13 Nov", "Project Acme website") before the yes. A vague date ("next week", "soon") is shown as `Due: ?`, and the skill asks for a day or "no date" before that item can be said yes to; "no date" leaves Due empty.
- **Which existing thing.** For a change to something that exists, the skill matches the user's words against the snapshot's open tasks and the live projects and Areas (titles, and the brain's aliases): exactly one match is shown in the list as `"<title>" (task)`, `<title> (project)` or `<title> (area)` with the change; none or several, and it asks, naming up to 5 candidates, and places nothing for that item until the user picks. The proposal is written as in §6.2 with no `finding`: `why` is the user's words for that item, `page_title` the snapshot's title, `value_before` the snapshot's value, and `area` follows cli.md §5.31's placement rule for that subject. For a relation, "put it in Y" or "move it to Y" sets it to `[Y]`, and "also in Y" adds Y to the snapshot's list.
- **Brain only** (§2.3): tasks, Waiting On tasks, captures and Notion-owned changes can't be placed; the list marks them `(Notion unreachable)`, they get no yes, and the closing summary names them so the user can say them again later. A new project and a brain-owned change are written in Git; their pages are published by the next `brain-sync` or catch-up (`sync render --changed` selects a note with no page, and a note whose brain-owned values changed).
- A ramble item never becomes a Review row.

## 8. Skipping a finding (0072 §6)

"skip N" (with or without a reason):
1. **A status that says why.** When the finding has `status_offers` (a task Waiting On or Someday, a project On Hold), the skill offers them once: "Set it to Waiting On, so it stops being flagged?" A yes applies it as a `set_task_status` or `set_project_status` (§6.2); the rules of §3.3 then no longer fire for it, so nothing is remembered.
2. **Otherwise it is remembered.** No offer, or the user declines it: the skill asks for the reason once when none was given ("why, in a few words? or 'no reason'"), then runs `brain assistant dismiss` (cli.md §5.31). For 30 days the finding with that key is left out of every report, and counted in "skipped for now".
3. The user can undo a skip ("show the skipped ones again", "unskip 4"): `brain assistant dismiss` with `remove`.

**The dismissal store** is `_assistant/dismissals.json` in the brain (Git), never published (`$defs/dismissals`):

```json
{
  "version": 1,
  "dismissals": [
    { "key": "area_no_domain:area-6p3r8t2w", "reason": "a personal area, no Domain needed",
      "dismissed_at": "2026-11-06T10:22:00Z", "until": "2026-12-06T10:22:00Z" }
  ]
}
```

- One entry per key, sorted by key; `until` is `dismissed_at` plus exactly 30 days; `reason` may be empty (the user gave none). An entry is **active** while `until` is after `as_of`.
- Written only by `brain assistant dismiss`, which drops expired entries on each write; a missing file means no dismissals. JSON, 2-space indent, keys in the order shown, one trailing newline.
- `brain lint` checks it (`assistant-dismissals`, cli.md §5.10): readable JSON, the schema and unique keys. A key whose note was deleted since is harmless (it matches nothing) and expires with its entry. `brain assistant findings` refuses a damaged file (`DISMISSALS_UNREADABLE`) rather than show skipped findings again.

## 9. The log

The skill writes one line at the end of a session with `brain log`:

`assistant - mode=<live|brain_only> scope=<id|all> findings=<total> shown=<n> applied=<n> proposals=<n> dismissed=<n> tasks=<n> projects=<n> captures=<n>`

`applied`, `proposals` and `dismissed` are the closing summary's changed, Review rows and skipped counts (§4.4), and the last three what a ramble created. `scope` and `findings` are the first `findings` call's (`all` without a scope; its `total`), and `shown` counts the distinct findings shown in the session. The CLI logs its own lines as usual (`proposal-new`, `apply`, `assistant-dismiss`).

## 10. The sub-agent (0064)

The brain ships `.claude/agents/ultimate-assistant.md`, a product-owned file written by `brain init` and `brain upgrade` from `templates/brain/.claude/agents/ultimate-assistant.md` and checked by lint (`product-file`, cli.md §5.10). Its text, exactly:

```markdown
---
name: ultimate-assistant
description: Ultimate Assistant reviews the structure of your work in this brain (Areas, Domains, Projects and Tasks) and finds what is overdue, stalled, missing a next step or in the wrong place. Use it when the user asks to review their projects or tasks, or what is stalled, overdue or misplaced.
---

You are Ultimate Assistant. Load the skill `ultimate-assistant` (`.claude/skills/ultimate-assistant/SKILL.md`) and follow it end to end.

When you run as a sub-agent of another session, nobody can answer you: build the report, return it as your whole answer, and change nothing. The session that called you shows it to the user and carries out what the user says yes to, by the same skill.
```

- **A conversation with it:** `claude --agent ultimate-assistant` in the brain starts a session whose main agent is the assistant, so the user answers the report and its yes applies (§5, §6). In any other Claude Code session the user can also ask for it by name, and the main session runs the skill itself.
- **As a sub-agent** (the main session delegates "what's stalled?") it only reads and reports.
- **Codex** has no sub-agent: it loads the skill from `.agents/skills/ultimate-assistant/` when the user asks.
- The brain's `AGENTS.md` operations table gains the row "review the structure of your work: what's overdue, stalled, missing a next step or misplaced, and turn your thoughts into tasks, projects and captures | `ultimate-assistant`".

## 11. Edge cases

| Case | Result |
|---|---|
| Notion unreachable | brain only (§2.3): the report says so; Notion-owned changes aren't offered |
| Tasks module off | no task signal, no `project_no_next_step`, `project_done_but_open`; `add_task` and ramble tasks offered as captures |
| Domains module off | no `area_no_domain` |
| A Projects row with no Brain ID | not a subject; counted in "not in the brain yet" |
| A task on a project outside the brain | counts for `task_no_project` only by that row's status |
| A `notion_change` whose page was changed in Notion before it was carried out | settled `stale`: closed, nothing written (§6.4) |
| The same change proposed twice | the second `proposal new` is skipped `DUPLICATE_PENDING` |
| A skipped finding whose subject changes (a task gets a new due date) | still skipped until `until`: the key names the subject, not its values |
| A merged duplicate's tasks after a Review-row merge | not moved by apply; while open, each is a `task_no_project` (its project is archived) until the user moves it |
| No user present, or run as a sub-agent | report only (§1) |
| A skip whose subject is merged or deleted | the key matches nothing; the entry expires with its `until` |
| A skip that expires during a session | `findings` compares `until` with the snapshot's `as_of`, `dismiss` prunes by now: a finding can come back in that session's "more" (accepted) |

## 12. What CC-109 builds
- The skill `ultimate-assistant` in the fork (§1 to §9), released and vendored (skills-delivery §9.5); the `notion_writes` step in brain-apply, brain-sync and brain-catch-up (§6.3); brain-howto and the guide.
- `templates/brain/.claude/agents/ultimate-assistant.md` (§10), its writing by `init` and `upgrade` and its `product-file` check; `templates/brain/AGENTS.md`'s operations row.
- The CLI: `brain assistant findings` and `brain assistant dismiss` (cli.md §5.31), `brain proposal settle` (§5.6), the kinds `notion_change` and `set_field` in `proposal new`, `apply`, `sync apply` and `sync render` (schema §11, §14), `sync tasks --direct` (§5.14.5), the lint rule `assistant-dismissals`, with tests; a test that validates `spec/examples/assistant/` against assistant.schema.json.
- The Notion migration for the Review database: Kind options `Notion Change` and `Set Field`, and the Type formula's **Suggestion** (docs/notion-space-design.md §3.10).
