# Connected workflows and adoption (contract, decision 0059)

**Status:** contract for release 0.9.0. Written by Claude Code in CC-99.

How this file fits: this file holds the lifecycle of a connected workflow, from opting in through execution, publication, reconciliation and completion, and the adoption of an existing project. [schemas/workflow.schema.json](schemas/workflow.schema.json) holds the shapes of its records. Linked repos and their task modes are in [linked-repos.md](linked-repos.md). The Notion properties of §4 are a design that CC-103's migration builds; the commands of §12 are built by the CLI task; the skills (written in the skills fork, 0059) follow §§2–11. When this file and the JSON Schema disagree, the JSON Schema wins and this file is fixed.

**Choices in this contract that the user may veto.** Each one is the simplest reading of 0059:
1. Workflow records live **in the brain**, under `_workflows/<wf-id>/`, committed by the CLI. "Local configuration" in 0059 means the user's machine, as opposed to Notion. The working folder holds only a pointer file (§3).
2. A connected workflow publishes only when **both** the opt-in record exists **and** the Project or Area says `Workflow: Connected` in Notion. If Notion says Standard, the workflow is paused, not deleted (§3.3).
3. Per-task and per-artifact overrides are set in chat and kept in the records; they are not Notion properties. So the Tasks mapping in `brain.json` doesn't change (§5.3).
4. Published artifacts become brain notes: a decision becomes a `decision` note (draft); every other category becomes a Document (`reference`, a new `origin: workflow`). They reach Notion through the existing render, and accepted wording comes back through 0054/0058 (§6.3).
5. Notion owns task status. When the agent and the user both changed a task's status, **the user's Notion value wins** without a question. Only content (title, scope) and scope changes are asked (§8.2).
6. Conflicts and scope changes are asked in the session and listed under "Needs you" in the summary. A workflow adds no Review rows and no new proposal kind (§8.3).
7. Two sessions on one workflow are coordinated by record revisions and **item claims**, not by a lock on the whole workflow (§10).
8. Adoption never edits a Markdown plan. GitHub and GitLab originals are kept by default; marking or closing them as transferred is an explicit choice (§11.5).

---

## 1. Terms

| Term | Meaning |
|---|---|
| **Working folder** | The folder where the work happens. It may be a software repo, a linked repo, or any folder (general work). |
| **Destination** | The existing Notion Project **or** Area that the work belongs to (0059): one of them, never both. |
| **Workflow** | One working folder connected to one destination, with its settings and records. Its id is `wf-<8>`. |
| **Work item** | One task of the workflow, published as one Notion Task. Its id is `wi-<8>`. |
| **Artifact** | Something the work produces: a brief, plan, specification, decision, final deliverable, or a temporary draft or log. Its id is `art-<8>`. |
| **Operation** | One pending write to Notion, such as creating a task or publishing an artifact. Its id is `op-<8>`. |
| **Work status** | Where a work item stands, as one of the six meanings of §5.1. |
| **Publication status** | Whether the records a work item or artifact needs are in Notion (§6.2). |

Record ids use the 0017 alphabet; `brain id new` gains the prefixes `wf`, `wi`, `art` and `op`. They are record ids, not note ids, and they never appear in note frontmatter.

## 2. Standard and connected tracking

- **Standard is the default.** A working folder with no pointer file (§3.2) is standard: the skills behave as their upstream versions do, with GitHub, GitLab or local-file tracking, and they read and write nothing in the brain or in Notion.
- **Nothing connects by itself.** Notion credentials, a resolvable brain, a `.brain` file from `brain link`, or a linked repo's kit with `mode: connected` don't make a folder connected. Only setup (§3.1) or adoption (§11), after the user's explicit yes, creates the opt-in record.
- **Connected** means:
  - Notion Tasks and Documents, through the brain, own the work's tracking (0059);
  - the brain stores the durable records (§7);
  - the skills publish under the logging level (§5).
- **Work type** is chosen separately (§4): `software` keeps the engineering checks; `general` follows clarify, plan, execute, verify and approve. Completion differs by type (§5.2).
- **Requirements.** A connected workflow needs the Tasks module, and the Documents module for any logging level above "Tasks only" (schema §12). When one is off, setup explains what it is for and offers to turn it on, **once per workflow** (recorded in `modules_offered`). It never turns a module on silently. If the user declines Documents, the level is held to "Tasks only" and setup says so.

## 3. The opt-in record and the pointer

### 3.1 Setup (new work)
Setup identifies, asking only for what it can't find:
1. **The working folder**, which may be a software repo or not.
2. **The brain**, by brain resolution (cli.md §4).
3. **The destination:** an existing Project or Area. Setup lists close matches. It creates a new Project or Area only when the user asks, through the brain's normal path (`note new`, then a render). A Notion structural change follows 0022.
4. **Additional relations**, optional: Goal (on a Project destination), People and Orgs. These are the ids that the work's tasks and documents also link to.
5. **Work type** and **logging level**, read from the destination's Workflow settings when they are set (§4). The suggested level is "Tasks + final outputs".

Then it shows one summary of these choices and asks "Connect this work to Notion?". On yes, it runs `brain workflow new` (§12), which writes the record and the pointer, and sets the destination's `Workflow` property to Connected, plus any settings the user chose, through the MCP.

**One connected workflow per destination.** `workflow new` refuses a destination that already has a workflow in state `connected` or `paused` (`DESTINATION_TAKEN`), so each project has one authoritative tracker (0059).

### 3.2 Files

**Brain:** `_workflows/<wf-id>/`
- `workflow.json`: the opt-in record and settings (§3.3)
- `items/<wi-id>.json`: one per work item (§7.1)
- `artifacts/<art-id>.json`: one per artifact (§7.2)
- `ops/<op-id>.json`: one per open operation; deleted when it is done (§7.3)
- `adoption.json`: the adoption mappings (§11.3)

**Working folder:** `.brain-workflow.json`, which holds `{ "workflow": "wf-…" }` only, with no machine paths and no settings. It is how a session started in the folder finds its workflow. In a Git repo the user commits it like any project file. A lost pointer is rebuilt from the brain with `brain workflow find --repo <name>` or `--folder-name <name>`.

### 3.3 `workflow.json`

```json
{
  "id": "wf-3k7m2p9q",
  "rev": 3,
  "state": "connected",
  "opted_in": { "at": "2026-11-03T10:00:00Z", "statement": "Connect acme-api's work to Notion" },
  "folder": { "name": "acme-api", "repo": "acme-api" },
  "destination": { "project": "prj-9x4t1b7e" },
  "relations": { "goal": "gol-4h8n2m6c", "people": ["per-3h8w2n6c"] },
  "settings": { "work_type": "software", "logging": "tasks_and_finals", "custom": [], "read_at": "2026-11-03T10:00:00Z" },
  "status_map": { "todo": "To Do", "in_progress": "Doing", "waiting": "Waiting On", "review": "Doing", "done": "Done", "dropped": "Won't Do" },
  "modules_offered": ["documents"],
  "outside": [],
  "summary": { "written_at": null, "sha256": null }
}
```

- `state`:
  - `connected`: publishing.
  - `paused`: the destination's `Workflow` property is Standard or empty. The records are kept; nothing is published; the session says so.
  - `ended`: the user ended the workflow. The records are kept as history, the pointer is deleted, and the folder is standard again.
- `folder.repo` is the `brain.json` `repos` name when the folder is a linked repo; `folder.name` is the folder's base name.
- `settings` is the **saved execution copy** of the Workflow settings (§4), read at `read_at`.
- `status_map` maps the six meanings onto **existing** options of the Tasks Status property (0059). The default for the default Tasks database is the example above; `review` maps to Doing because that database has no review option. For any other database, setup proposes a mapping from its options and asks once. It never adds an option.
- `outside` lists Notion task page ids under the destination that the user chose to keep out of the workflow (§8.2).

### 3.4 Ending and pausing
- **End:** `brain workflow set <wf> --state ended`, after the user's yes. The skill sets the destination's `Workflow` to Standard and removes the pointer. Open operations are listed first; the user chooses to finish them or to drop them, and dropped operations are recorded in the item's `progress`.
- **Pause and resume** follow the Notion property (§8.1, settings).

## 4. Workflow settings on the Project and the Area (property design)

These are new properties on **both** Projects and Areas. Their owner is **You** (docs/notion-space-design.md §2): Notion owns them, and the brain writes them only at setup, with the user's yes. Migration CC-103 adds them, and setup reads them at the start of every run.

| Property | Type | Options | Empty means |
|---|---|---|---|
| Workflow | Select | Standard, Connected | Standard |
| Work type | Select | Software, General | Asked at setup |
| Logging level | Select | Tasks only, Tasks + final outputs, Full durable record, Custom | Tasks + final outputs |
| Log artifacts | Multi-select | Briefs, Plans, Specifications, Decisions, Final deliverables | None. Read only with Custom |

- **Values in the records:**
  - `logging`: `tasks_only`, `tasks_and_finals`, `full`, `custom`;
  - `custom`: `brief`, `plan`, `specification`, `decision`, `final`;
  - `work_type`: `software`, `general`.
- **The dated summary** (§9) is the brain-owned toggle heading **Workflow** in the page body, next to Brief. CC-103 adds it to §2's page-body list.
- **A changed setting affects future work only** (0059). §8.1 copies a new value into `settings`; artifacts already decided keep their decision (§5.3). Publishing older artifacts is a separate request: `brain workflow publish-history`, which shows the list and asks.

## 5. Status meanings, completion and logging

### 5.1 The six status meanings

| Meaning | Software | General |
|---|---|---|
| `todo` | Not started | Not started |
| `in_progress` | Being worked on | Being worked on |
| `waiting` | Blocked on someone else | Blocked on someone else |
| `review` | **Ready for review:** the checks pass (tests, lint, CI) and a PR is open | **Ready for approval:** every acceptance criterion is met |
| `done` | The PR is merged **and** every required acceptance criterion is met | The user accepted the result |
| `dropped` | Won't Do (0055) | Won't Do |

- The item's `status` is the meaning. Notion shows `status_map[meaning]`. Reading back, a Notion option maps to the meaning whose `status_map` value it is. When several meanings share the option (`in_progress` and `review` → Doing), the item's current meaning is kept if it is one of them; otherwise the first in the order of the table.
- **GitHub owns branches, PRs and checks** (0059). A software item records `links: { branch, pr }`; the skill reads the PR's state with `gh` and never mirrors checks into Notion beyond the `review` and `done` meanings.

### 5.2 Completion
- **An item is `done`** only through the rule of its work type in §5.1. A general item records `accepted: { at, statement }`: the user's words in the session, or Notion Status set to the `done` option by the user, which §8.2 reads back.
- **Acceptance criteria** are a list of `{ text, met_at, evidence }`. `evidence` is a test name, a command and its output, or a link.
- **The workflow can't report itself complete while required records are unpublished** (0059). A workflow whose items are all `done` or `dropped`, but which has an operation `pending`, `failed` or `uncertain`, reports **"Work complete, publication pending"** with the count. It is "Complete" only when none is left.

### 5.3 Logging levels and overrides

| Level | Published |
|---|---|
| `tasks_only` | Tasks (with their work record, §6.1), and links to deliverables stored elsewhere |
| `tasks_and_finals` | Tasks, and approved final deliverables |
| `full` | Tasks, and approved briefs, plans, specifications, decisions and final deliverables |
| `custom` | Tasks, and the approved artifacts whose category is in `custom` |

**Artifact categories:** `brief`, `plan`, `specification`, `decision`, `final` and `temporary`. `temporary` covers drafts, scratch notes and logs; it is **never published** unless the user asks for that one artifact.

**The publication decision is taken once**, when the artifact is approved, and is frozen in `artifact.publish`. The first rule that applies wins:
1. **Per-artifact override:** the user says "publish this one" or "keep this one local". Recorded as `by: artifact`.
2. **Per-task override:** `item.logging` (a level) set by the user for that task. Recorded as `by: task`.
3. **The level** in `settings`. Recorded as `by: level`.

**Not published:** an artifact that is not published keeps `location` and gets `local_reason`. The reason is `excluded by level`, `excluded by override`, `temporary`, or `module off`.

**Overrides never change identity or tracker** (0059): a per-task override changes only what is published for that task.

**Binary artifacts** (`format: binary`) are published as a Documents page that holds the file as an attachment, or a link when the file is stored elsewhere (`location.url`). The Document's body names the file and its size.

## 6. Publication

### 6.1 What a work item publishes
- **One Notion Task.** Its properties:
  - Name: the title;
  - Status: `status_map[meaning]`, typed as `notion.tasks.status_type`;
  - Project or Area: the destination, through the existing mapping (schema §12);
  - Brain ID: the item's `wi-` id.

  An unmapped property is left out, as in `sync tasks` (cli.md §5.14.5).
- **Its body** has a brain-owned toggle heading **Work record**, whose text is normative:

  ```markdown
  Scope: {scope}
  Acceptance:
  - [x] {criterion} ({evidence})
  - [ ] {criterion}
  Depends on: {task links}
  Documents: {document links}
  Progress:
  - {D Mon}: {text}
  ```

  - Lines with nothing to show are left out.
  - At most the last 5 progress entries are shown.
  - Everything outside the toggle belongs to the user.

### 6.2 Publication status
Every item and artifact has `publication: { state, at, error }`. `state` is one of:
- `local`: never to be published (the artifact has `local_reason`);
- `pending`: an operation is open;
- `published`: Notion holds the current version;
- `failed`: the last attempt failed with a lasting error (§10.3), and the operation is kept;
- `uncertain`: an attempt was interrupted, and its outcome isn't known yet (§10.2).

**Work status and publication status are independent.** An item may be `done` with publication `pending`. Reports always name both: "3 done, 1 not yet in Notion".

### 6.3 How artifacts reach Notion
- **`decision`:** a new `decision` note with lifecycle `draft` (0003: new notes apply directly). It links the destination, and it is published through the existing render (cli.md §5.14.4).
- **Every other category:** a Document (`reference` note) with `origin: workflow` and `workflow: { id, artifact }`, whose body is the artifact's text, linked to the destination's Project or Area and to the item's Task through the Task's Documents link (§6.1). The CLI task adds `origin: workflow` and the `workflow` field to note.schema.json and schema §4 with the code that writes them.
- **Wording edited in Notion returns through the existing accepted-wording rules** (cli.md §5.14.7, with 0058's limits). A Notion draft the user wrote is never overwritten: a Document whose body the user edited since the last publication is held back, and the conflict is reported (§8.2).
- **A new version of an approved artifact** (the file changed): for a Document, an `update_body` proposal on the existing note (0003); for a decision, a new decision that supersedes it, as a proposal.

## 7. Durable records

0059: the approved scope, acceptance criteria, destinations and progress are stored durably before execution relies on them. **Saved** means written to the record and committed by the CLI (§12). A skill never says something was saved because it was agreed in chat; it says so only after the command reports the commit.

### 7.1 Work item (`items/<wi-id>.json`)

```json
{
  "id": "wi-7c2m9q4x", "rev": 5, "title": "Add rate limiting to the public API",
  "scope": "Limit unauthenticated requests per IP; authenticated limits unchanged.",
  "acceptance": [ { "text": "429 after 100 requests a minute from one IP", "met_at": "2026-11-04T09:12:00Z", "evidence": "test rate-limit.test.ts" } ],
  "approved_at": "2026-11-03T10:20:00Z",
  "status": "review",
  "logging": null,
  "depends_on": [],
  "origin": { "kind": "markdown", "ref": "PLAN.md", "key": "line:5e1a0c9b2d47" },
  "links": { "branch": "feat/rate-limit", "pr": "https://github.com/acme/acme-api/pull/42" },
  "accepted": null,
  "claim": { "by": "claude-code 2026-11-04T09:00Z", "at": "2026-11-04T09:00:00Z" },
  "progress": [ { "at": "2026-11-04T09:12:00Z", "text": "Limiter and tests in; PR open." } ],
  "notion": { "page": "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b", "title": "Add rate limiting to the public API", "status": "Doing", "read_at": "2026-11-04T09:13:00Z" },
  "publication": { "state": "published", "at": "2026-11-04T09:13:00Z", "error": null }
}
```

- **`approved_at`** is set when the user approves the scope and acceptance criteria. An item without it can be planned but **not executed**: `claim` refuses (`NOT_APPROVED`). Changing `scope` or `acceptance` after approval clears `approved_at`, so the user approves again.
- **`notion`** holds the values last written to or read from Notion. It is the base of the three-way comparison in §8.2.
- **`progress`** grows only by appending: entries are never edited or removed.

### 7.2 Artifact (`artifacts/<art-id>.json`)
- **Fields:** `id`, `rev`, `item` (a `wi-` id, or `null` for a workflow-level artifact), `category`, `title`, `format` (`text` or `binary`), `location` (`{ path }`, relative to the working folder, or `{ url }`), `sha256` of the approved content, `approved_at`, `publish` (`{ decision: include|exclude, by: artifact|task|level, level, decided_at }`), `local_reason`, `note` (the brain note that carries it), and `publication`.
- **A text artifact must be readable in Documents when it is published** (0059). Its body is the file's text at `sha256`.

### 7.3 Operation (`ops/<op-id>.json`)
- **Fields:** `id`, `rev`, `kind`, `target`, `payload_sha256`, `state` (`pending`, `in_flight`, `done`, `failed`, `uncertain`), `attempts`, `created_at`, `updated_at`, `last_error` (`{ code, message, lasting }`), and `result` (`{ page }`).
- **`kind`:**
  - `create_task` and `update_task` (target a `wi-` id);
  - `publish_artifact` (target an `art-` id);
  - `write_summary` (target the `wf-` id);
  - `mark_original` (target a `wi-` id, §11.5).
- **A `done` operation's file is deleted** in the same commit that records its result on the target. Git keeps the history.

## 8. Reconciliation

### 8.1 When, and what it reads
- **When.** Reconciliation runs at the start of every run, before publishing, and at completion (0059). The skill reads Notion and passes a snapshot to `brain workflow reconcile` (§12).
- **The snapshot:** `{ read_at, destination: { page, workflow, work_type, logging_level, log_artifacts, edited }, tasks: [ { page, brain_id, title, status, archived, in_trash, edited } ], documents: [ { page, brain_id, edited } ] }`.
  - `tasks` holds **every** Task related to the destination: those of the workflow and any others.
  - `documents` holds the Documents of the workflow's artifacts.
  - Values are in the normalized form of cli.md §5.14.1.

**Settings.** A destination value that differs from `settings` is copied in, as a routine change, and the change is reported. If `workflow` is Standard or empty, the state becomes `paused`. If it is Connected again, a paused workflow returns to `connected`.

### 8.2 Per item and per task

**Comparison.** B is `item.notion` (the base), N the snapshot, and L what the record now holds.

| Field | N ≠ B, L = B | N = B, L ≠ B | N ≠ B, L ≠ B |
|---|---|---|---|
| Status | Adopt N (routine) | Publish L (`update_task`) | **Adopt N**: Notion owns status, and the report says "kept your status" |
| Title | Adopt N | Publish L | **Conflict** (`BOTH_CHANGED`): ask |

**Other cases**

| Case | Outcome |
|---|---|
| A task with the item's page id or Brain ID is archived or in the trash | **Scope change:** ask whether the item is dropped, or the task is restored. |
| No task has the item's page id, and an operation was `in_flight`, `uncertain` or `pending` | §10.2 |
| No task has the item's page id, and no operation is open | **Scope change**: "deleted in Notion". Ask whether the item is dropped, or recreated. |
| A task under the destination with no `wi-` Brain ID, and not in `outside` or `adoption.json` | **Scope change**: ask whether to adopt it into the workflow (§11) or keep it outside (its page id goes in `outside`). Meeting action items (Brain ID `mtg-`, `src-`) are proposed as outside by default. |
| A Document of the workflow whose `edited` time is after the artifact's last publication | The user's edit is kept. If the artifact also changed locally: **conflict**, and both versions are shown. Otherwise nothing is done: accepted wording returns through §6.3. |

- **Routine changes** are applied automatically and listed in the report.
- **Conflicts and scope changes** are returned by `reconcile` and asked in the session, all in one batch. Until the user answers, the items concerned get no new operation, and they appear under "Needs you" in the summary (§9).
- **Pending local edits are kept:** a conflict never drops L.

### 8.3 No new surfaces
0059 asks for no new reconciliation database, no continuous sync and no routine approval checkpoint. A workflow writes no Review rows; its questions go in the session, and in the summary's "Needs you" line when no session is open.

## 9. The dated summary on the Project or Area

`brain workflow summary <wf>` (§12) renders the toggle **Workflow** on the destination's page, at the end of each run and at completion. The text is normative; `{…}` is filled in, and a line whose count is 0 is left out:

```markdown
Updated {D Mon YYYY, HH:MM} · {folder.name} · {Connected|Paused}
{done} completed · {dropped} dropped · {open} open ({in_progress} in progress, {review} ready for {review|approval}, {waiting} waiting, {todo} to do) · {percent}%
Not yet in Notion: {n}: {title} ({reason}); …
Needs you: {n}: {question}; …
Work complete, publication pending.
```

- `{percent}` and its ` · ` are left out when no item is non-dropped (0055).
- "ready for review" is the software wording and "ready for approval" the general one.
- "Not yet in Notion" lists at most 5 items, then "and n more". A reason is `Notion unreachable`, `failed: <message>` or `waiting for an answer`.
- The last line appears only in the state of §5.2.
- **One summary per destination**, rewritten in place; the toggle is brain-owned. Its hash goes in `summary.sha256` so an unchanged summary is not written again.
- **When Notion is unavailable** (0059), the skill reports in the session, keeps everything in the records, and leaves the summary as it was. The summary's date says how old it is.

## 10. Writers, retries, interruption and uncertain outcomes

### 10.1 Several writers
- **Record revisions.** Every record has `rev`. Every command that changes a record takes `--rev <n>`, the revision the caller read; when it doesn't match, the command refuses with `STALE_RECORD` and writes nothing, and the skill reads again and retries. Each write sets `rev + 1`.
- **Item claims.** Before executing an item, a session claims it (`brain workflow item claim <wf> <wi> --by <label>`).
  - Another session's claim is refused (`CLAIMED`, with its holder) unless it is **stale**: more than 2 hours after both `claim.at` and the last progress entry.
  - `--take` overrides a claim the user chose to take over, and records it in `progress`.
  - A session releases its claim when it stops, and `done` or `dropped` releases it too.
- **One open operation per target.** A new operation for a target that has one `in_flight` is refused (`OP_IN_FLIGHT`); a `pending` one is replaced, keeping its id.
- **Brain commits.** The CLI writes a workflow's records and commits them as one journaled operation (capture-and-review §7.11, cli.md §5.24), so an interrupted write is finished or rolled back by `brain recover`. Git's index lock is retried for up to 10 seconds, then the command refuses with `BRAIN_BUSY`.
- **Notion writers.** Read-before-write alone is not a guarantee (0059), so after each Notion write the skill reads the page back. If any value it wrote isn't there, someone wrote in between, and the next `reconcile` handles it. The skill never writes the same page twice in a row without reading in between.

### 10.2 Interruption and uncertain outcomes
- **An operation is marked before the call.** It is set to `in_flight` (with its `rev` checked) before the Notion call, and to `done` (with its `result`) or `failed` after it.
- **At the next `reconcile`, an `in_flight` operation from an earlier run becomes `uncertain`.** It is resolved from the snapshot:
  - `create_task`: a task whose Brain ID is the item's id → `done` with that page (no second task). None → `pending` again.
  - `update_task`: the task holds the payload's values → `done`. Otherwise → `pending`.
  - `publish_artifact`: the note has `notion`, or a Document with the note's Brain ID exists → `done` (the page id is recorded). Otherwise → `pending`.
  - `write_summary`: always `pending` (the write is idempotent).
  - `mark_original`: the skill checks the comment or state on the original (§11.5) → `done` or `pending`.

### 10.3 Retries without duplicates
- **Look up before creating.** Before any create, the skill queries the database by Brain ID. A hit is adopted (`done`), never duplicated. Updates set values and so are idempotent.
- **Within a run**, a temporary error (rate limit, 5xx, network) is retried up to 3 times, after 2 s, 8 s and 30 s. A lasting error (validation, a missing permission, a missing property) is `failed` at once, with `lasting: true`.
- **A failed operation is kept** and retried once at the next run's reconciliation. After it has failed in 3 runs, it stays `failed` and shows under "Needs you" with its message. An operation is never dropped silently. Only the user's explicit choice drops one, and that choice is recorded in `progress`.

## 11. Adoption of an existing project

### 11.1 Inspect
The adoption skill reads, without writing anything:
- instructions and methodology (AGENTS.md, CLAUDE.md, CONTRIBUTING, a linked repo's kit);
- plans and tasks, with their statuses, dependencies and completion rules;
- the documents the work produces.

**Supported sources:**
- **Markdown plans and checklists:** the formats of linked-repos.md §2.4; a plan the skill can't parse with them is read by judgment, and every item it finds is listed with the line it came from;
- **GitHub and GitLab issues**, through `gh` and `glab`;
- **existing Notion Tasks** under the destination.

Any other system (Jira, Linear, a spreadsheet) gets an inspected mapping: what maps, and **what doesn't** (custom fields, sprints, workflows), listed as `unsupported`. It is applied only on the user's explicit yes, through the same input with `origin.kind: other`.

### 11.2 Preview
- **The skill normalises what it found** into the adoption input (§12, `adopt preview`). Each item has `origin`, `title`, `body`, `raw_status`, `meaning`, `depends_on` (origin keys), `done` and `url`.
- **`brain workflow adopt preview`** compares that input with `adoption.json` and returns **one preview**:
  - `create`: new items;
  - `update`: items already adopted whose original changed since;
  - `untouched`: already adopted and unchanged, or not selected;
  - the status mapping (raw → meaning → Notion option);
  - the dependencies;
  - the tracker (Notion, from now on);
  - the treatment of each original (§11.5);
  - `unsupported`;
  - `conventions`.
- **The default selection is active and planned work:** every meaning except `done` and `dropped`. Completed history stays where it is and is not imported unless the user selects it.
- **Partial progress is kept.** An item `in_progress` stays `in_progress`, with the original's text as its first progress entry.
- **Dependencies:**
  - on another selected item → `depends_on`;
  - on a done item → dropped, with a note in the item's progress;
  - on an open item that isn't selected → listed as a warning in the preview.

### 11.3 Mappings and reruns
`adoption.json` = `{ rev, runs: [{ at, sources, created, updated, untouched }], map: [{ origin: { kind, ref, key }, item, treatment }], conventions: [{ rule, source, choice, note }] }`.

**Origin keys**

| Kind | `ref` | `key` |
|---|---|---|
| `markdown` | the file path | linked-repos.md §2.4: the pattern `id` when there is one, otherwise `line:<12 hex>` of the trimmed title |
| `github` | `owner/name` | `#<number>` |
| `gitlab` | `group/name` | `#<iid>` |
| `notion` | `tasks` | the page id |
| `other` | the system's name | its own id |

**Reruns**
- **A rerun never duplicates.** A key already in `map` is never created again. If its original changed since the last run, it is an `update` (title or body; never status, which Notion owns from adoption on). A key that disappeared from the source is reported and left alone.
- **Two items with the same `line:` key in one file** (the same title twice) get `#2`, `#3` suffixes in file order, and the preview warns that their mapping depends on their order.

### 11.4 Conventions
- **Compatible conventions are kept**, and so is everything already in progress (0059).
- **A rule that conflicts** with the connected workflow is listed in `conventions` with the user's choice. Examples: "status lives in TASKS.md", "every task needs a PR". The choices are:
  - `keep`: the workflow follows it;
  - `adapt`: the agreed wording is recorded in `note`;
  - `decline`: the workflow does not follow it, and the repo's text is left as it is.
- **Adoption never edits repository instructions** and never restructures a backlog.

### 11.5 Treatment of originals
- **Markdown:** always `keep`. The file is never edited; the preview says Notion owns status from now on.
- **GitHub and GitLab issues:**
  - `keep` (default);
  - `mark_transferred`: a comment "Tracked in Notion: <link>", and the label `transferred` when the repo has it;
  - `close_transferred`: the same comment, then the issue is closed (as `not planned` on GitHub).

  These are applied as `mark_original` operations (§7.3), only for the issues the user chose.
- **Existing Notion tasks:** the item takes the existing page, and no new task is created. An empty Brain ID is set to the item's id. A Brain ID that holds another id (a meeting's or a source's) is left as it is, and the item is found by its page id.
- **Transfer is explicit** (0059). The preview says, for each original, what will happen to it, and the original stays linked from the item's `origin`.

### 11.6 Apply
On the user's yes to the preview, `brain workflow adopt apply` writes the items, the map and a `create_task` (or `update_task`, for an adopted Notion task) per item, in one journaled commit. Publication then follows §6 and §10.

## 12. Commands (CLI task)

```text
brain workflow new --input <file|->
brain workflow find (--repo <name> | --folder-name <name>)
brain workflow show <wf>
brain workflow set <wf> --rev <n> --input <file|->
brain workflow item put <wf> --input <file|-> [--rev <n>]
brain workflow item claim <wf> <wi> --by <label> [--take] [--release]
brain workflow artifact put <wf> --input <file|-> [--rev <n>]
brain workflow render <wf> --item <wi>
brain workflow op put <wf> --input <file|-> [--rev <n>]
brain workflow reconcile <wf> --input <snapshot>
brain workflow summary <wf>
brain workflow adopt preview <wf> --input <file|->
brain workflow adopt apply <wf> --input <file|-> --rev <n>
brain workflow publish-history <wf> [--category <c>]…
```

**Rules common to every command**
- Every record is validated against `spec/schemas/workflow.schema.json` (`INPUT_INVALID`).
- Write commands commit their own files as one journaled operation (§10.1), with the message `workflow: <command> <wf>` and the trailer `Op: <op>`, and never push. They are added to cli.md §1's Git exceptions.
- Every command refuses while `_journal/` holds an operation (`RECOVERY_NEEDED`).
- New error codes, all with exit 4 except `BRAIN_BUSY` (5): `STALE_RECORD`, `CLAIMED`, `NOT_APPROVED`, `OP_IN_FLIGHT`, `DESTINATION_TAKEN`, `WORKFLOW_NOT_FOUND`, `WORKFLOW_PAUSED` (an operation on a paused or ended workflow), `BRAIN_BUSY`.

**Each command**
- **`new`:** takes the record of §3.3 without `id`, `rev` or `state`. It writes `workflow.json` with `rev: 1` and `state: connected`, writes the pointer in the folder given as `folder_path` (an input field that is not stored), and returns the record. It checks that the destination and relations exist (`UNKNOWN_ID`) and checks `DESTINATION_TAKEN`. The pointer is its only write outside the brain.
- **`find`:** read-only; returns the matching workflows.
- **`show`:** read-only; returns the record, its items, artifacts, open operations and the counts of §9.
- **`set`:** changes `state`, `settings`, `status_map`, `relations`, `modules_offered` or `outside`.
- **`item put` and `artifact put`:** create a record (without `--rev`, given a new id) or update one (with `--rev`). They apply §7.1's `approved_at` rule and §5.3's frozen decision, and they refuse to edit or remove an existing `progress` entry (`INPUT_INVALID`).
- **`item claim`:** applies §10.1. `--release` drops the caller's own claim.
- **`render`:** read-only. Returns the Task payload of §6.1 (properties in the form of `sync tasks`) and the **Work record** toggle's Markdown.
- **`op put`:** creates an operation or moves its state. `done` needs `result.page` for `create_task`, and records it on the target with its publication state in the same commit.
- **`reconcile`:** applies §8 and §10.2 to the snapshot, writes the routine changes and the new or resolved operations, and returns `{ routine: [...], conflicts: [...], scope_changes: [...], ops: [op ids to run, in order: create_task, update_task, publish_artifact, mark_original, write_summary] }`.
- **`summary`:** read-only. Returns `{ heading: "Workflow", markdown, sha256, changed }`; `changed` is false when `sha256` equals `summary.sha256`.
- **`adopt preview`:** read-only; §11.2.
- **`adopt apply`:** §11.6. Its `--rev` is the revision of `adoption.json` (0 before the first run).
- **`publish-history`:** read-only. Lists the approved artifacts that were excluded under an earlier setting (`by: level`) and would be included now, so the skill can ask. Accepted ones are re-decided with `by: artifact`.

**Skills (written in the fork, 0059):** a setup skill (§3.1), an adoption skill (§11), and the execution discipline (§§5–10) in the shared workflow skills. Each reads the pointer to choose standard or connected, and reports in the short form (counts, what needs the user, the next action).

## 13. Acceptance (0.9.0)

0059's three scenarios, and linked-repos.md §11 as the fourth, all on synthetic data:
1. **Standard software:** a repo with GitHub-style issues and no pointer. Nothing is written in the brain or in Notion.
2. **Connected software with a PR:** a Markdown plan is adopted (3 items, 1 done and left in place, 1 in progress kept). A PR moves an item to `review`, and merging it with its criteria met moves it to `done`. A plan is published at `full` and a temporary log isn't.
3. **General work under an Area:** a workshop is prepared, at `tasks_and_finals`. The final deliverable is published only after approval, and an item is `done` only after the user's acceptance.

Shared checks, run once:
- an interrupted `create_task` resolves without a second task (§10.2);
- a failed operation is retried at the next run, and the summary shows "Work complete, publication pending" meanwhile;
- a title changed in both places is asked, and a status changed in both places keeps Notion's;
- a stale record revision is refused;
- two sessions can't claim one item;
- an adoption rerun creates nothing.
