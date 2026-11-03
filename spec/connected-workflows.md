# Connected workflows and adoption (contract, decision 0059)

**Status:** contract for release 0.9.0. Written by Claude Code in CC-99, revised after a context-free buildability review.

How this file fits: this file holds the lifecycle of a connected workflow, from opting in through execution, publication, reconciliation and completion, and the adoption of an existing project. [schemas/workflow.schema.json](schemas/workflow.schema.json) holds the shapes of its records. Linked repos and their task modes are in [linked-repos.md](linked-repos.md).
- §4 and §6.1 are the Notion design that CC-103's migration builds.
- §12 holds the commands, which the CLI task builds.
- The skills (written in the skills fork, 0059) follow §§2–11 and §13.

When this file and the JSON Schema disagree, the JSON Schema wins and this file is fixed. Timestamps are ISO 8601 UTC and come from `--now` (cli.md §3.1).

**Choices in this contract that the user may veto.** Each one is the simplest reading of 0059:
1. Workflow records live **in the brain**, under `_workflows/<wf-id>/`, committed by the CLI. "Local configuration" in 0059 means the user's machine, as opposed to Notion. The working folder holds only a pointer file (§3).
2. A connected workflow publishes only when **both** the opt-in record exists **and** the Project or Area says `Workflow: Connected` in Notion. If Notion says Standard, the workflow is paused, not deleted (§3.4).
3. Per-task and per-artifact overrides are set in chat and kept in the records; they are not Notion properties. So the Tasks mapping in `brain.json` doesn't change (§5.3).
4. Published artifacts become brain notes:
   - a decision becomes a `decision` note (draft);
   - every other category becomes a Document (`reference`, a new `origin: workflow`).

   They reach Notion through the existing render. Wording accepted in Notion returns through 0054/0058 (§6.3).
5. Notion owns task status. When the agent and the user both changed a task's status, **the user's Notion value wins** without a question, and a task the user sets to Done counts as the user's acceptance (§8.2).
6. Conflicts and scope changes are asked in the session and listed under "Needs you" in the summary. A workflow adds no Review rows and no new proposal kind (§8.3).
7. Two sessions on one workflow are coordinated by record revisions and **item claims**, not by a lock on the whole workflow (§10).
8. Adoption never edits a Markdown plan. GitHub and GitLab originals are kept by default; marking or closing them as transferred is an explicit choice (§11.5).
9. The dated summary is written directly at the end of a run, not through a queued operation: the write is idempotent, and the next run rewrites it after a failure (§9).

---

## 1. Terms

| Term | Meaning |
|---|---|
| **Working folder** | The folder where the work happens: a software repo, a linked repo, or any folder (general work). |
| **Destination** | The existing Notion Project **or** Area that the work belongs to (0059). One of them, never both. |
| **Workflow** | One working folder connected to one destination, with its settings and records. Id `wf-<8>`. |
| **Work item** | One task of the workflow, published as one Notion Task. Id `wi-<8>`. |
| **Artifact** | Something the work produces: a brief, plan, specification, decision, final deliverable, or a temporary draft or log. Id `art-<8>`. |
| **Operation** | One pending write to Notion, such as creating a task or publishing an artifact. Id `op-<8>`. |
| **Work status** | One of the six meanings of §5.1. |
| **Publication status** | Whether the records a work item or artifact needs are in Notion (§6.2). |

Record ids use the 0017 alphabet; `brain id new` gains the prefixes `wf`, `wi`, `art` and `op`. They are record ids, not note ids, and never appear in note frontmatter except in a Document's `workflow` field (§6.3).

## 2. Standard and connected tracking

- **Standard is the default.** A working folder with no pointer file (§3.2), or whose pointer names an `ended` or missing workflow, is standard. The skills behave as their upstream versions do (GitHub, GitLab or local-file tracking) and read and write nothing in the brain or in Notion. When the pointer names an ended or missing workflow, the skill says so once.
- **Nothing connects by itself.** Notion credentials, a resolvable brain, a `.brain` file from `brain link`, or a linked repo's kit with `mode: connected` don't make a folder connected. Only setup (§3.1) or adoption (§11), after the user's explicit yes, creates the opt-in record.
- **Connected** means:
  - Notion Tasks and Documents, through the brain, own the work's tracking (0059);
  - the brain stores the durable records (§7);
  - the skills publish under the logging level (§5).
- **Work type** is chosen separately (§4). `software` keeps the engineering checks; `general` follows clarify, plan, execute, verify and approve. Completion differs by type (§5.2).
- **Requirements.** A connected workflow needs:
  - the Tasks module, with `notion.tasks.properties.brain_id` mapped, because the Brain ID is how a retry finds a task it already created (§10.3);
  - the Documents module, for any logging level above "Tasks only".

  When one is missing, setup explains what it is for and offers it, **once per workflow** (recorded in `modules_offered`):
  - a module through `brain modules on <module>` and its steps in `notion/modules/<module>.md` (cli.md §5.20);
  - a missing Brain ID property as a structural change under 0022, which the user adds by hand.

  Setup never turns a module on silently. If the user declines Documents, the level is held to "Tasks only" and setup says so. A workflow can't be created without Tasks and a Brain ID mapping (`MODULE_OFF` and `BRAIN_CONFIG_INVALID` from `workflow new`).

## 3. The opt-in record and the pointer

### 3.1 Setup (new work)
Setup identifies the following, asking only for what it can't find:
1. **The working folder** (a software repo or not).
2. **The brain**, by brain resolution (cli.md §4).
3. **The destination:** an existing Project or Area. Setup lists close matches. It creates a new Project or Area only when the user asks, through the brain's normal path (`note new`, then a render). A Notion structural change follows 0022.
4. **Additional relations**, optional: a Goal (with a Project destination), People and Orgs. These are the ids that the work's tasks and documents also link to.
5. **Work type, logging level and Log artifacts**, read from the destination's Workflow settings when they are set (§4). The suggested level is "Tasks + final outputs".
6. **The status mapping** of §3.3.

Then it shows one summary and asks "Connect this work to Notion?". On yes, in this order:
1. It sets the destination's Workflow settings through the MCP: `Workflow` = Connected, plus the work type, level and artifacts the user chose.
2. It runs `brain workflow new` (§12), which writes the record and the pointer.

If step 2 fails, Notion says Connected but there is no record. The next setup run finds the Connected setting, fills only the gaps, and runs `workflow new` again.

**One workflow per destination and per folder.** `workflow new` refuses:
- a destination that already has a workflow in state `connected` or `paused` (`DESTINATION_TAKEN`);
- a folder whose pointer names a workflow that is `connected` or `paused` (`POINTER_EXISTS`);
- a `folder.repo` that a `connected` or `paused` workflow already names (`DESTINATION_TAKEN`).

So each project has one authoritative tracker (0059), and each linked repo has at most one open workflow.

### 3.2 Files

**Brain:** `_workflows/<wf-id>/`
- `workflow.json`: the opt-in record and settings (§3.3).
- `items/<wi-id>.json`: one per work item (§7.1).
- `artifacts/<art-id>.json`: one per artifact (§7.2).
- `ops/<op-id>.json`: one per open operation, deleted when it is done or dropped (§7.3).
- `adoption.json`: the adoption mappings (§11.3).

**Working folder:** `.brain-workflow.json`, which holds `{ "workflow": "wf-…" }` and nothing else: no machine paths and no settings. A session started in the folder finds its workflow from it. In a Git repo the user commits it like any project file. A lost pointer is rebuilt with `brain workflow find` (§12), then `workflow set --pointer` (§12).

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
  "status_read": { "Someday": "todo" },
  "modules_offered": ["documents"],
  "outside": [],
  "needs_you": [],
  "summary": { "written_at": null, "sha256": null }
}
```

- **`state`:**
  - `connected`: publishing.
  - `paused`: the destination's `Workflow` is Standard or empty. The records are kept and work can continue locally, but nothing is published (§12, state rules).
  - `ended`: terminal. The records are kept as history, and the pointer is deleted.
- **`folder`:** `folder.repo` is the `brain.json` `repos` name when the folder is a linked repo; `folder.name` is the folder's base name.
- **`settings`:** the **saved execution copy** of the Workflow settings (§4), read at `read_at`.
- **`status_map`:** maps each of the six meanings to an **existing** option of the Tasks Status property (0059). The example is the default for the default Tasks database; `review` maps to Doing because that database has no review option. For any other database, setup proposes a mapping from its options and asks once. It never adds an option.
- **`status_read`:** maps the other existing options (here Someday) to a meaning, so that reading Notion back never meets an unknown option. It is filled at setup and by §8.2's `STATUS_UNMAPPED`.
- **`outside`:** Notion task page ids under the destination that the user kept out of the workflow (§8.2).
- **`needs_you`:** the open questions of §8.2, kept until `workflow resolve` answers them.
- **`summary`:** what §9 last wrote.

### 3.4 Pausing, resuming and ending
- **Pause and resume** follow the destination's `Workflow` property, which §8.1 reads at every reconciliation.
- **End:** after the user's yes, `brain workflow set <wf> --input '{"state":"ended"}'`.
  - Open operations are listed first, and the user chooses to finish them (a run) or drop them (`op state … dropped`).
  - The skill then sets the destination's `Workflow` to Standard and deletes the pointer.
  - `ended` can't be undone. Connecting the folder again creates a new workflow.

## 4. Workflow settings on the Project and the Area (property design)

These are new properties on **both** Projects and Areas. Their owner is **You** (docs/notion-space-design.md §2): Notion owns them, and the brain writes them only at setup, with the user's yes. CC-103's migration adds them. The skills read them **by these fixed names**, as they read a Project's Status; they are not in `brain.json`.

| Property | Type | Options → value in the records | Empty means |
|---|---|---|---|
| Workflow | Select | Standard → `paused` (or no workflow), Connected → `connected` | Standard |
| Work type | Select | Software → `software`, General → `general` | Keep the saved value; asked at setup |
| Logging level | Select | Tasks only → `tasks_only`, Tasks + final outputs → `tasks_and_finals`, Full durable record → `full`, Custom → `custom` | `tasks_and_finals` |
| Log artifacts | Multi-select | Briefs → `brief`, Plans → `plan`, Specifications → `specification`, Decisions → `decision`, Final deliverables → `final` | `[]`. Read only with Custom |

- **The migration (CC-103)** follows notion/migrations/README.md:
  - it adds the four properties, with these options in this order, to Projects and Areas, and a step whose property already exists adds nothing, so a rerun changes nothing;
  - it fills in no values;
  - its Verify step reads the four properties back with their options on both databases;
  - the build prompts gain the same properties for new spaces.

  It also documents three brain-owned toggle headings in docs/notion-space-design.md §2's page-body list, and creates none of them on existing pages:
  - **Workflow** on Project and Area pages (§9);
  - **Work record** on Task pages (§6.1), including those of a mapped external Tasks database;
  - **`Repo tasks · <repo>`** on Project and Area pages (linked-repos.md §4).

  The skills write those toggles; `sync render` doesn't. The migration adds no Tasks property: the Brain ID property and its `brain_id` mapping already exist for the default Tasks database (docs/notion-space-design.md §3.12), and setup checks a mapped database (§2).
- **Labels.** Option labels are matched case-insensitively. An option with no value in this table is read as "empty" and reported in the run's report as `UNKNOWN_OPTION`.
- **A changed setting affects future work only** (0059). §8.1 copies a new value into `settings`, and artifacts already decided keep their decision (§5.3).
- **Publishing older artifacts** is a separate request: `brain workflow publish-history` lists them, and the skill asks.

## 5. Status meanings, completion and logging

### 5.1 The six status meanings

| Meaning | Software | General |
|---|---|---|
| `todo` | Not started | Not started |
| `in_progress` | Being worked on | Being worked on |
| `waiting` | Blocked on someone else | Blocked on someone else |
| `review` | **Ready for review:** the checks pass (tests, lint, CI) and a PR is open | **Ready for approval:** every acceptance criterion is met |
| `done` | The PR is merged **and** every acceptance criterion is met, or the user accepted it | The user accepted the result |
| `dropped` | Won't Do (0055) | Won't Do |

- **Reading Notion back.**
  - An option maps to the meaning whose `status_map` value it is, or else to its `status_read` value.
  - When several meanings share one option (`in_progress` and `review` → Doing), the item's current meaning is kept if it is one of them; otherwise the first of them in the order of the table applies.
  - An option in neither map is `STATUS_UNMAPPED` (§8.2).
- **GitHub owns branches, PRs and checks** (0059). A software item records `links: { branch, pr }`. The skill reads the PR's state with `gh pr view <pr> --json state,mergedAt` and never mirrors checks into Notion beyond the `review` and `done` meanings.

### 5.2 Completion
- **Acceptance criteria** are a list of `{ text, met_at, evidence }`. `evidence` is a test name, a command and its output, or a link. Every criterion counts: there are no optional ones.
- **`done` needs** (enforced by `item put`, `INPUT_INVALID` on `/status`):
  - `accepted` set, **or**
  - for software work, `links.pr` set and every criterion met.

  `accepted` is `{ at, statement }`, where `statement` is one of:
  - the user's words in the session;
  - `Set to Done in Notion`, written by §8.2 when the user set the task done;
  - `Done before adoption`, written by §11.6.
- **The workflow can't report itself complete while required records are unpublished** (0059). A workflow whose items are all `done` or `dropped`, but with an operation `pending`, `in_flight`, `failed` or `uncertain`, reports **"Work complete, n not yet in Notion"**. It reports "Complete" only when no operation is left.

### 5.3 Logging levels and overrides

| Level | Published |
|---|---|
| `tasks_only` | Tasks (with their Work record, §6.1), and links to deliverables stored elsewhere |
| `tasks_and_finals` | Tasks, and approved `final` artifacts |
| `full` | Tasks, and approved `brief`, `plan`, `specification`, `decision` and `final` artifacts |
| `custom` | Tasks, and the approved artifacts whose category is in `settings.custom` |

**Artifact categories:** `brief`, `plan`, `specification`, `decision`, `final` and `temporary`. `temporary` covers drafts, scratch notes and logs: it is never published under any level.

**The publication decision is computed by `artifact put` when the artifact is approved**, and is then frozen in `artifact.publish`. The first rule that applies wins:
1. **Per-artifact override** in the input: `"override": "include"` or `"exclude"`, after the user says "publish this one" or "keep this one local". This works on `temporary` too. Recorded as `by: artifact`.
2. **Per-task override:** `item.logging`, a level the user set for that task. Recorded as `by: task`.
3. **The level** in `settings`. Recorded as `by: level`.

**Afterwards:**
- With the Documents module off, an `include` of any category except `decision` becomes `exclude` with `local_reason: module off`. With the Knowledge module off, a `decision` artifact does the same; a `decision` doesn't need Documents.
- A later change of the level never changes a frozen decision. A per-artifact override can always replace it (that is how `publish-history` publishes old artifacts).

**Not published:** such an artifact keeps `location` and gets `local_reason`: `excluded by level`, `excluded by override`, `temporary`, `module off` or `dropped by user`.

**Overrides never change identity or tracker** (0059): a per-task override changes only what is published for that task.

## 6. Publication

### 6.1 What a work item publishes
- **One Notion Task**, created or updated through the existing Tasks mapping (schema §12), with:
  - title: `item.title`;
  - status: `status_map[item.status]`, typed as `notion.tasks.status_type`;
  - project, or area: the destination, plus the area of a Project destination, each when mapped;
  - brain_id: the item's `wi-` id.

  Unmapped properties are left out, as in `sync tasks` (cli.md §5.14.5). An adopted Notion task whose Brain ID holds another id keeps it (§11.5).
- **Its body** has a brain-owned toggle heading **Work record**. Its text is normative (below).

**Writing a workflow or rollup toggle** (Work record, Workflow, `Repo tasks · <repo>`). The rule is normative and the same for all three:
1. The skill finds the toggle heading by its exact name and replaces its children.
2. When the page has none, it appends the toggle heading at the end of the page, whatever other toggles the page has.

These toggles are not `sync render` sections, so cli.md §5.14.4's `SECTION_NOT_FOUND` rule for Brief and Decision log doesn't apply to them and doesn't change. That rule appends Brief and Decision log only to a page with no toggle headings at all. So before appending one of these toggles to a **Project** page with no toggle headings at all, the skill first appends empty "Brief" and "Decision log" toggle headings, which the next render fills. Otherwise the page would later be `SECTION_NOT_FOUND` for the Brief.

The Work record text:

  ```markdown
  Scope: {scope}
  Acceptance:
  - [x] {criterion} ({evidence})
  - [ ] {criterion}
  Depends on: {title}, {title}
  Documents: {title}, {title}
  Progress:
  - {D Mon}: {text}
  ```

  - A line with nothing to show is left out.
  - Each title in Depends on and Documents is a link to that page's Notion URL (`https://www.notion.so/<page id without dashes>`). A title whose page doesn't exist yet is left as plain text.
  - At most the last 5 progress entries are shown, oldest first.
  - Dates are UTC, written `3 Nov`.
  - Everything outside the toggle belongs to the user.

### 6.2 Publication status
Every item and artifact has `publication: { state, at, error }`. `state` is one of:

| State | Meaning |
|---|---|
| `local` | Never to be published: an excluded artifact, or an item whose operation the user dropped |
| `pending` | An operation is open (`pending` or `in_flight`) |
| `published` | Notion holds the current version |
| `failed` | The last attempt failed with a lasting error, or failed in 3 runs (§10.3); the operation is kept |
| `uncertain` | An attempt was interrupted, and its outcome isn't known yet (§10.2) |

- **The CLI sets the state** when an operation opens or changes state (§12); `at` is the time of that change, and `error` is the last error message, or `null`.
- **Work status and publication status are independent.** An item may be `done` with publication `pending`. Reports always name both: "3 done, 1 not yet in Notion".

### 6.3 How artifacts reach Notion
A `publish_artifact` operation (§7.3) is carried out by the skill, in this order:
1. **If `artifact.note` is null, the skill creates the note** with `note new`, then records it with `artifact put` (`note`):
   - **`decision`:** a `decision` note, `lifecycle: draft` (0003: new notes apply directly). `date` = the approval date, and the default `assessment` of `note new`. `projects` (a Project destination) or `area` (an Area destination). No `sources`. The body has the sections `## Decision`, `## Context` and `## Consequences` from the artifact, and `## Sources` naming the artifact's location.
   - **Every other category:** a Document (`reference` note) with `origin: workflow`, `workflow: { id, artifact }`, `lifecycle: reviewed` (the user approved it), the same placement, and **no `sources`**. Its summary is the artifact's first sentence, cut to 200 characters. Its body:
     - a text artifact: the file's text at `sha256`;
     - a binary artifact: the line `File: {name} ({size})`, then the link when there is a `location.url`. With a `location.path`, the skill also attaches the file to the Document page through the MCP's file upload. If the upload isn't available, the operation fails with the lasting code `upload_unsupported`, and the user can give a URL instead.
2. **Publish it** with the existing `sync render`, the MCP create or update, and `sync record`. Before creating, the skill looks up Brain ID (§10.3).
3. **Close the operation:** `op state … done --page <page id>`. The CLI sets `published_sha256` and `publication: published`.

**A new version of an approved artifact** (a new `sha256` approved by `artifact put`) opens a new `publish_artifact`.
- For a Document, step 1 writes an `update_body` proposal (0003) instead of a new note. The user's approval of the new version in the session is the approval, so the skill applies it in chat (0003, the in-session path). Step 2 then publishes the new body.
- For a decision, step 1 writes a new decision that supersedes the old one, as a proposal approved the same way.

**The CLI task's schema changes for this:**
- `origin: workflow` and the `workflow` field in note.schema.json and schema §4: `sources` is not required, and `workflow` is required with that origin;
- `update_body` allowed on a `workflow` Document;
- accepted wording from Notion (cli.md §5.14.7) imported for `workflow` Documents as for `promoted` ones.

**Wording edited in Notion** returns through those accepted-wording rules, with 0058's limits. A Notion edit the user didn't accept is never overwritten (§8.2, `DOCUMENT_BOTH_CHANGED`).

## 7. Durable records

0059: the approved scope, acceptance criteria, destinations and progress are stored durably before execution relies on them.
- **Saved** means written to the record and committed by the CLI (§12).
- A skill never says something was saved because it was agreed in chat; it says so only after the command reports the commit.
- Execution relies only on items with `approved_at` (`item claim` refuses others with `NOT_APPROVED`).

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

- **`approved_at`** is set by `item put` (to `--now`) when the input has `"approve": true`. It is cleared when `scope` or the `text` of any acceptance criterion changes, or when a criterion is added or removed, so the user approves again. `met_at` and `evidence` don't clear it.
- **`notion`** holds the values last written to or read from Notion: the base of §8.2's comparison. Only the CLI writes it (§12, `op state`, `reconcile`).
- **`progress`** grows only by appending. Entries are never edited or removed.
- **`claim`** is managed only by `item claim`, and cleared when the item becomes `done` or `dropped`.

### 7.2 Artifact (`artifacts/<art-id>.json`)

| Field | Meaning |
|---|---|
| `id`, `rev` | As for an item |
| `item` | A `wi-` id, or `null` for a workflow-level artifact |
| `category`, `title` | §5.3 |
| `format` | `text` or `binary` |
| `location` | `{ path }` relative to the working folder, or `{ url }` |
| `sha256` | The approved content's hash (`null` until approved) |
| `approved_at` | When the user approved it |
| `publish` | `{ decision: include\|exclude, by: artifact\|task\|level, level, decided_at }`, computed at approval (§5.3); `null` before |
| `local_reason` | Why it isn't published (§5.3), or `null` |
| `note` | The brain note that carries it (`ref-` or `dec-`) |
| `published_sha256` | The `sha256` that Notion holds, or `null` |
| `publication` | §6.2 |

A text artifact must be readable in Documents when it is published (0059).

### 7.3 Operation (`ops/<op-id>.json`)

| Field | Meaning |
|---|---|
| `id`, `rev` | |
| `kind` | `create_task` and `update_task` (target `wi-`), `publish_artifact` (target `art-`), `mark_original` (target `wi-`, §11.5) |
| `target` | The record the operation is for |
| `payload` | What the operation writes. `create_task` and `update_task`: `{ title, status }`, plus `brain_id` when the task's Brain ID must be set. `publish_artifact`: `{ sha256 }`. `mark_original`: `{ origin, treatment }` |
| `state` | `pending`, `in_flight`, `done`, `failed`, `uncertain`, `dropped` |
| `attempts` | Calls made in the current run |
| `runs_failed` | Runs in which it ended `failed` |
| `created_at`, `updated_at` | |
| `last_error` | `{ code, message, lasting }`. `code`: `network`, `rate_limited`, `server`, `validation`, `permission`, `missing_property`, `upload_unsupported` or `other` |
| `result` | `{ page }` |

- **Only `reconcile`, `adopt apply` and `resolve` open operations** (§8, §11.6, §12). The skill only moves them through their states (`op state`, §12).
- **At most one open operation per target and kind.** When a new payload is needed and the operation is still `pending`, `reconcile` replaces the payload and keeps the id. When it is `in_flight`, nothing is replaced, and it is reported as `busy`.
- **A `done` or `dropped` operation's file is deleted** in the same commit that records its outcome on the target. Git keeps the history.

## 8. Reconciliation

### 8.1 When, and what it reads
Reconciliation runs at the start of every run, before publishing, and at completion (0059). The skill reads Notion and the working folder, and passes a snapshot to `brain workflow reconcile` (§12):

```json
{
  "read_at": "2026-11-04T09:30:00Z",
  "destination": { "page": "…", "workflow": "Connected", "work_type": "Software", "logging_level": "Full durable record", "log_artifacts": [] },
  "tasks": [ { "page": "…", "brain_id": "wi-7c2m9q4x", "title": "…", "status": "Doing", "archived": false, "in_trash": false, "edited": "2026-11-04T09:20:00Z" } ],
  "documents": [ { "page": "…", "brain_id": "ref-4m8q2k6p", "edited": "2026-11-04T09:00:00Z" } ],
  "artifacts": [ { "id": "art-2p8k4m6n", "sha256": "sha256:…" } ]
}
```

- **Its shape** is `$defs/snapshot` in the workflow schema. `read_at`, `destination` and `tasks` are required. `documents`, `artifacts` and `marked` (§10.2) may be left out, and then mean empty: without `artifacts` no local change is detected.
- **`tasks`** holds **every** Task related to the destination (the workflow's and any others), plus any task found by the Brain ID of an item whose page isn't related any more.
- **`documents`** holds the Documents of the workflow's published artifacts.
- **`artifacts`** holds the current hash of each artifact file in the working folder that still exists. A missing file is left out, and that changes nothing.
- **Values** are labels as Notion shows them (§4).
- **The destination's settings** are mapped through §4's table:
  - a value that differs from `settings` is copied in (routine `settings_changed`);
  - `workflow` Standard or empty makes the state `paused` (routine `state_changed`);
  - Connected makes a `paused` workflow `connected` again.

### 8.2 What reconcile decides

**Comparison per item with a page.** B is `item.notion` (the base), N the snapshot's task (found by `item.notion.page`, else by Brain ID), and L the record (`title`, and `status_map[status]`).

| Field | N ≠ B, L = B | N = B, L ≠ B | N ≠ B, L ≠ B |
|---|---|---|---|
| Status | Adopt N (routine `status_adopted`) | `update_task` | Adopt N (routine `status_adopted`, "kept your status") |
| Title | Adopt N (routine `title_adopted`) | `update_task` | Needs you `BOTH_CHANGED` |

**Adopting a Notion status:**
- A `done` meaning with no `accepted` sets `accepted: { at: <task edited>, statement: "Set to Done in Notion" }`.
- `dropped` and `done` clear the claim.
- An option in neither map is Needs you `STATUS_UNMAPPED`, and the item keeps its status until it is answered.

**Other cases**

| Case | Outcome |
|---|---|
| An item with `notion: null` and no open operation | `create_task` |
| The item's task is archived or in the trash | Needs you `TASK_ARCHIVED` |
| No task has the item's page id or Brain ID, and no operation is open | Needs you `TASK_DELETED` |
| No task found, with a `create_task` open | §10.2 |
| A task under the destination whose Brain ID isn't one of the workflow's `wi-` ids, and which is not in `outside` or `adoption.json` | Needs you `UNKNOWN_TASK` (meeting and source action items, Brain ID `mtg-` or `src-`, suggest `outside`) |
| An approved, `include` artifact with `published_sha256 ≠ sha256` | `publish_artifact` |
| A snapshot artifact hash ≠ `artifact.sha256` (the file changed since approval), and its Document not edited | Needs you `ARTIFACT_CHANGED` |
| The same, and its Document edited after the note's `last_synced` (an edit in a later minute, 0058) | Needs you `DOCUMENT_BOTH_CHANGED`, the only entry for that artifact |
| A Document edited, with no local change | Nothing: accepted wording returns through §6.3 |
| A map entry whose treatment isn't `keep` and isn't yet `marked`, and whose item has `notion.page` | `mark_original`. It waits for the item's page, because the comment links to it |

**Needs you**
- **Each entry** is `{ id: "<KIND>:<target>", kind, target, question, choices, since }`.
- **It is kept in `needs_you`**, and repeated, not duplicated, by later runs, until `workflow resolve` answers it or it no longer applies. It no longer applies when, for example, the user restored a trashed task; it is then removed and reported as routine `resolved_itself`.
- **Its target** gets no new operation while it is open.

**The choices and their effects**

| Kind | Choices → effect |
|---|---|
| `BOTH_CHANGED` | `keep_mine` → `update_task` with L · `take_notion` → adopt N |
| `STATUS_UNMAPPED` | one of the six meanings → added to `status_read` and adopted |
| `TASK_ARCHIVED` | `drop` → status `dropped` · `restore` → the skill restores the task in Notion; the next reconcile sees it |
| `TASK_DELETED` | `drop` → `dropped`, with publication `local` · `recreate` → `notion` set to `null`, then `create_task` |
| `UNKNOWN_TASK` | `adopt` → the skill runs adoption on that task (§11, origin `notion`) · `outside` → its page id is added to `outside` |
| `ARTIFACT_CHANGED` | `approve` → `artifact put` with the new hash (§5.3) · `ignore` → nothing; the question comes back once the hash changes again |
| `DOCUMENT_BOTH_CHANGED` | `keep_notion` → the local change is ignored, as with `ignore` · `publish_mine` → as `approve`; the Notion edit stays in Notion's history |

**Routine changes** are written and listed in the report. Pending local edits are kept: a Needs you entry never drops L.

### 8.3 No new surfaces
0059 asks for no new reconciliation database, no continuous sync and no routine approval checkpoint. A workflow writes no Review rows. Its questions go in the session, all in one batch after `reconcile`, and they stay in the summary's "Needs you" line until answered.

## 9. The dated summary on the Project or Area

At the end of each run, at completion, and after `workflow resolve`, the skill runs `brain workflow summary <wf>`. When `changed` is true, it writes the toggle **Workflow** on the destination's page (§6.1's toggle rule), then records the write with `summary <wf> --written <sha256>`. When the Notion write fails, nothing is recorded, and the next run writes it again. The text is normative; `{…}` is filled in, and a line whose count is 0 is left out:

```markdown
Updated {D Mon YYYY, HH:MM} UTC · {folder.name} · {Connected|Paused}
{done} completed · {dropped} dropped · {open} open ({in_progress} in progress, {review} ready for {review|approval}, {waiting} waiting, {todo} to do) · {percent}%
Not yet in Notion: {n}: {title} ({reason}); …
Needs you: {n}: {question}; …
Work complete, {n} not yet in Notion.
```

- `{percent}` = done ÷ (total − dropped), rounded to a whole number. It is left out, with its ` · `, when no item is non-dropped (0055).
- "ready for review" is the software wording, "ready for approval" the general one.
- **"Not yet in Notion"** lists the targets of open operations, at most 5, then "and n more", with their reasons:
  - `failed: <message>`;
  - `Notion unreachable` for `last_error.code` `network`;
  - `waiting for an answer` when the target has a Needs you entry;
  - `waiting for the next run` otherwise.
- **"Needs you"** lists `needs_you` questions, at most 5.
- The last line appears only in the state of §5.2.
- Dates are UTC, with English month abbreviations.
- **One summary per destination**, rewritten in place in a brain-owned toggle.
- **`sha256`** is the hash of the markdown **without its first line**. So a summary whose only change is its date is not `changed` and is not written again, and `--written` compares that same hash.
- **When Notion is unavailable** (0059), the skill reports in the session, keeps everything in the records, and the toggle keeps its last confirmed date.

## 10. Writers, retries, interruption and uncertain outcomes

### 10.1 Several writers
- **Record revisions.** Every record has `rev`.
  - Every command that **updates** a record takes `--rev <n>`, the revision the caller read. When it doesn't match, the command refuses with `STALE_RECORD` and writes nothing, and the skill reads again and retries.
  - Each write sets `rev + 1`; a created record starts at `rev: 1`.
  - `item claim`, `op state`, `reconcile` and `summary --written` read and check revisions themselves, so they take no `--rev`. When a record changes between their read and their write, they refuse with `STALE_RECORD`, write nothing, and are simply run again.
- **Item claims.** Before executing an item, a session claims it: `item claim <wf> <wi> --by <label>`, where the label is the agent and its start time, e.g. `claude-code 2026-11-04T09:00Z`.
  - A claim by the same label refreshes `at`.
  - Another label's claim is refused (`CLAIMED`, with its holder) unless it is **stale**: more than 2 hours after both `claim.at` and the item's last progress entry.
  - `--take` overrides it, after the user chose to take over, and appends the progress entry `Claim taken over from <old label>`.
  - `--release` drops the caller's own claim.
  - Claiming doesn't change the status.
- **Brain commits.** The CLI writes a workflow's records and commits them as one journaled operation (capture-and-review §7.11, cli.md §5.24), so an interrupted write is finished or rolled back by `brain recover`. Git's index lock is retried for up to 10 seconds, then the command refuses with `BRAIN_BUSY`.
- **Notion writers.** Read-before-write alone is not a guarantee (0059). After each Notion write the skill reads the page back. When a value it wrote isn't there, it doesn't write again: the next `reconcile` sees the difference and handles it under §8.2.

### 10.2 Interruption and uncertain outcomes
- **Mark before the call.** The skill sets an operation to `in_flight` with `op state` before the Notion call, and to `done` (with `--page`), `failed` (with `--error`) or `pending` (a temporary error, to be retried) after it.
- **Uncertain.** At `reconcile`, an `in_flight` operation whose `updated_at` is more than 10 minutes before `read_at` was interrupted, and becomes `uncertain`. A more recent one may belong to another live session: it is left alone and reported as `busy`.
- **Resolution from the snapshot** (routine `op_resolved`):
  - `create_task`: a task whose Brain ID is the item's id → `done`, with that page (no second task). None → `pending`.
  - `update_task`: the task holds the payload's `title` and `status` → `done`. Otherwise → `pending`.
  - `publish_artifact`: a Document with the note's Brain ID whose note `last_synced` is after the operation's `updated_at` → `done`. Otherwise → `pending`.
  - `mark_original`: the skill checks the original before calling `reconcile` (§11.5), and passes `marked: [<op id>]` in the snapshot for the ones already applied → `done`. Otherwise → `pending`.

### 10.3 Retries without duplicates
- **Look up before creating.** Before any create, the skill queries the database for the Brain ID. A hit is used (`done` with that page), never duplicated. Updates set values, so they are idempotent.
- **A run** is what lies between a `reconcile --start` and the next one. The skill calls `reconcile --start` once, at the start of each run; its later calls in the same run (before publishing, at completion) have no `--start`.
- **Within a run**, a temporary error (`network`, `rate_limited`, `server`) is retried up to 3 times, after 2 s, 8 s and 30 s. `op state … in_flight` increments `attempts`, and `reconcile --start` sets it back to 0. After the retries the operation goes back to `pending`, and a later reconcile in the same run may list it again.
- **A lasting error** (`validation`, `permission`, `missing_property`, `upload_unsupported`, `other`) makes the operation `failed` at once, with `lasting: true`.
- **Only `reconcile --start`** puts a `failed` operation back to `pending` to be tried again. A reconcile without `--start` leaves it `failed`, so a lasting error is tried once per run.
  - `runs_failed` counts the runs in which it ended `failed`. `op state … failed` increments it.
  - Once `runs_failed` reaches 3, `reconcile --start` leaves it `failed`. It shows under "Not yet in Notion" with its message, and in the session's Needs you batch as "retry or drop?". On "retry", the skill runs `op state … pending`, and the operation is tried in this run; on "drop", `op state … dropped`.
- **An operation is never dropped silently.** Only the user's choice drops one (`op state … dropped`). The target's progress gets `Dropped: <kind>`; for an artifact, its item's progress gets it, if there is an item. A drop is remembered so that `reconcile` doesn't open the same operation again:

| Dropped | Effect on the target | When `reconcile` opens it again |
|---|---|---|
| `create_task` | `publication: local` | Never: an item whose publication is `local` gets no operation. `TASK_DELETED`'s `recreate` (or `item put` with `"publish": true`) sets it back to `pending` |
| `update_task` | `declined: { kind, payload }`; publication unchanged | When the payload it would build differs from `declined.payload`; `declined` is then cleared |
| `publish_artifact` | Never published (`published_sha256` null): `local`, with `local_reason: dropped by user`. Published before: `declined: { kind, payload }`, publication unchanged | Never for `local`. With `declined`: when `sha256` differs from `declined.payload.sha256` |
| `mark_original` | The map entry's `treatment` becomes `keep` | Never |

## 11. Adoption of an existing project

### 11.1 Inspect
The adoption skill reads, without writing anything:
- instructions and methodology: AGENTS.md, CLAUDE.md, CONTRIBUTING, and a linked repo's kit;
- plans and tasks, with their statuses, dependencies and completion rules;
- the documents the work produces.

**Supported sources:**
- **Markdown plans and checklists:** the formats of linked-repos.md §2.4, with their parsing rules. A plan the skill can't parse with them is read by judgment, and every item it finds is shown with the line it came from.
- **GitHub and GitLab issues:** fetched as in linked-repos.md §4.1.
- **Existing Notion Tasks** under the destination.

Any other system (Jira, Linear, a spreadsheet) gets an inspected mapping: what maps, and **what doesn't** (custom fields, sprints, workflows), listed in `unsupported`. It is applied only on the user's explicit yes, with `origin.kind: other`.

### 11.2 Input and preview
The skill normalises what it found into the **adoption input**:

```json
{
  "sources": [ { "kind": "markdown", "ref": "PLAN.md" } ],
  "items": [
    { "origin": { "kind": "markdown", "ref": "PLAN.md", "key": "line:5e1a0c9b2d47" },
      "title": "Add rate limiting to the public API", "body": "", "raw_status": "/", "meaning": "in_progress",
      "depends_on": [], "url": null, "brain_id": null }
  ],
  "unsupported": [],
  "conventions": [ { "rule": "Status lives in TASKS.md", "source": "AGENTS.md" } ],
  "selected": null,
  "treatments": {}
}
```

- **Keys** are unique within the input (`INPUT_INVALID` otherwise). Two Markdown lines with the same `line:` key get the suffixes `#2`, `#3` in file order (`line:5e1a0c9b2d47#2`), and the preview warns that their mapping depends on their order.
- **`meaning`** is the item's raw status, mapped by the kit's `status_map` when the source has one, else by the skill's proposal.
- **`brain_id`** is the Notion task's current Brain ID (origin `notion` only).
- **`depends_on`** holds origin keys.

**`brain workflow adopt preview`** compares the input with `adoption.json` and returns one preview, without writing:
- `create`: `[{ key, title, meaning, option, selected }]` for keys not in the map, where `option` is `status_map[meaning]`;
- `update`: `[{ key, item, changes: { title?, body? } }]` for mapped keys whose title or body changed since the last run. Never status: Notion owns it from adoption on;
- `untouched`: `[{ key, item, reason }]`, with `reason` `unchanged` or `not selected`;
- `missing`: `[{ key, item }]`, mapped keys that are no longer in the source, which are left alone;
- `dependencies`: `[{ key, depends_on, dropped, warnings }]`. A dependency on a `done` item is dropped. A dependency on an open item that isn't selected is a warning;
- `originals`: `[{ key, choices, default }]` (§11.5);
- `status_options`: the options of `notion`-origin items that are in neither `status_map` nor `status_read`, with `meaning: null`;
- `unsupported` and `conventions`, as given.

**The default selection** is every new item whose meaning isn't `done` or `dropped`. Completed history stays where it is and isn't imported unless the user selects it. `selected` (a list of keys) replaces the default.

### 11.3 Mappings and reruns
`adoption.json` = `{ rev, runs: [{ at, sources, created, updated, untouched }], map: [{ origin, item, treatment, marked }], conventions: [{ rule, source, choice, note }] }`.

**Origin keys**

| Kind | `ref` | `key` |
|---|---|---|
| `markdown` | the file path | linked-repos.md §2.4 |
| `github` | `owner/name` | `#<number>` |
| `gitlab` | `group/name` | `#<iid>` |
| `notion` | `tasks` | the page id |
| `other` | the system's name | its own id |

**A rerun never duplicates.** A key already in `map` is never created again, and a key that disappeared from the source is reported and left alone.

### 11.4 Conventions
- **Compatible conventions are kept**, and so is everything already in progress (0059).
- **A rule that conflicts** with the connected workflow ("status lives in TASKS.md", "every task needs a PR") is listed in `conventions`, and `adopt apply` needs a `choice` for each one:
  - `keep`: the workflow follows it;
  - `adapt`: the agreed wording, recorded in `note`;
  - `decline`: the workflow does not follow it; the repo's text stays as it is.
- **Adoption never edits repository instructions** and never restructures a backlog.

### 11.5 Treatment of originals

| Original | Choices |
|---|---|
| Markdown | `keep` only. The file is never edited; the preview says that Notion owns status from now on |
| GitHub, GitLab issue | `keep` (default); `mark_transferred`: a comment "Tracked in Notion: <link>", and the label `transferred` when the repo has it; `close_transferred`: the same comment, then the issue is closed (as `not planned` on GitHub) |
| Notion task | `keep` only. The item takes the existing page, and no new task is created |
| Other | `keep` only |

- **A Notion task's Brain ID:** an empty one is set to the item's id (the `brain_id` of the first `update_task`). One that holds another id (a meeting's or a source's) is left as it is, and the item is found by its page id.
- **Checking an original** (for §10.2): the skill looks for its comment "Tracked in Notion: <link>" on the issue.
- **Transfer is explicit** (0059). The preview says, for each original, what will happen to it, and the original stays linked from the item's `origin`.

### 11.6 Apply
On the user's yes to the preview, `brain workflow adopt apply` takes the same input with `selected`, `treatments` (`{ key: treatment }`) and each convention's `choice`, and writes in one journaled commit:
- **For each selected new key, an item:**
  - `title`; `scope` = `body`, or the title when the body is empty; `acceptance: []`;
  - `approved_at` = now: the yes to the preview approves the adopted scope;
  - `status` = `meaning`; a `done` item gets `accepted: { at: now, statement: "Done before adoption" }`;
  - `origin`, and `depends_on` resolved to `wi-` ids;
  - `progress`: `[{ at: now, text: "Adopted from <ref> <key> as <raw_status>" }]`.
  - With origin `notion`, the item also gets `notion: { page: <key>, title, status: <the option>, read_at: now }`, and an `update_task` operation when the Brain ID is empty. Otherwise it gets a `create_task` operation.
- **For each `update`:** only the fields in `changes`: `title` → title, `body` → scope (an empty new body leaves the scope as it is). `approved_at` is set to now, since the yes to the preview approves the change. The status is never touched.
- **Notion options:** each option of a `notion`-origin item that is in neither `status_map` nor `status_read` must have a meaning in the input's `status_read` (`{ option: meaning }`), which the preview lists as `status_options`, or the command fails with `INPUT_INVALID`. These are added to the workflow's `status_read`.
- **The map:** an entry `{ origin, item, treatment, marked }` per new item, where `marked` is `true` for `keep` and `false` otherwise. `reconcile` opens the `mark_original` operations once the items have pages (§8.2), and `op state … done` on one sets `marked: true`.
- **A `runs` entry** and the `conventions` with their choices.

Publication then follows §6 and §10.

## 12. Commands (CLI task)

```text
brain workflow new --input <file|->
brain workflow find (--repo <name> | --folder-name <name> | --destination <id>)
brain workflow show <wf>
brain workflow set <wf> --rev <n> --input <file|->
brain workflow resolve <wf> --rev <n> --input <file|->
brain workflow item put <wf> --input <file|-> [--rev <n>]
brain workflow item claim <wf> <wi> --by <label> [--take | --release]
brain workflow artifact put <wf> --input <file|-> [--rev <n>]
brain workflow render <wf> --item <wi>
brain workflow op state <wf> <op> --state <state> [--page <id>] [--error <json>]
brain workflow reconcile <wf> --input <snapshot> [--start]
brain workflow summary <wf> [--written <sha256>]
brain workflow adopt preview <wf> --input <file|->
brain workflow adopt apply <wf> --rev <n> --input <file|->
brain workflow publish-history <wf>
```

**Common rules**
- **Validation.** Every record a command writes is validated against `spec/schemas/workflow.schema.json` before the write (`INPUT_INVALID`, with pointers into the input).
- **Commits.** Write commands commit their own files as one journaled operation (§10.1), with the message `workflow: <command> <wf>` and the trailer `Op: <op>`, and never push. They are added to cli.md §1's Git exceptions. They also log `workflow - "<wf>" <command>`.
- **Journal.** Every command refuses while `_journal/` holds an operation (`RECOVERY_NEEDED`).
- **Errors.** New error codes, all with exit 4 except `BRAIN_BUSY` (5): `STALE_RECORD`, `CLAIMED`, `NOT_APPROVED`, `DESTINATION_TAKEN`, `POINTER_EXISTS`, `WORKFLOW_NOT_FOUND`, `WORKFLOW_ENDED`, `BRAIN_BUSY`. An unknown `wf`, `wi`, `art` or `op` id is `WORKFLOW_NOT_FOUND` or `UNKNOWN_ID`.
- **State rules:**
  - an `ended` workflow allows only `find` and `show` (`WORKFLOW_ENDED` otherwise);
  - a `paused` workflow allows every command, but `reconcile` opens no operation (it still adopts, resolves and records Needs you) and `summary` says Paused.
- **Updates are patches.** An update input holds `id` and the fields to change. Fields the command manages (`rev`, `approved_at`, `claim`, `notion`, `publish`, `published_sha256`, `publication`, and `progress` entries other than new ones) are refused in the input (`INPUT_INVALID`). An update without `--rev` is `USAGE`.

**Each command**
- **`new`:**
  - Input: `{ folder_path, opted_in: { statement }, folder?: { repo? }, destination, relations?, settings: { work_type, logging, custom }, status_map, status_read?, modules_offered? }`.
  - `folder_path` is absolute and an existing folder (`INPUT_INVALID`). It is not stored.
  - The command sets `folder.name` (the base name of `folder_path`), `id`, `rev: 1`, `state: connected`, `opted_in.at` and `settings.read_at` (`--now`), and `outside`, `needs_you` and `summary` empty.
  - Checks: the destination and relations exist (`UNKNOWN_ID`); `folder.repo` is in `brain.json` `repos` (`UNKNOWN_ID`); Tasks is on and `brain_id` is mapped (§2); §3.1's refusals.
  - It writes the record and `<folder_path>/.brain-workflow.json`, its only write outside the brain (not committed). An existing pointer that names an ended or missing workflow is replaced.
  - `data` = the record.
- **`find`:** read-only. `data` = `{ workflows: [{ id, state, folder, destination }] }`, every state, ordered by id.
- **`show`:** read-only. `data` = `{ workflow, items, artifacts, ops, counts: { todo, in_progress, waiting, review, done, dropped, open, percent, ops_open, ops_failed, ops_uncertain, needs_you } }`.
- **`set`:**
  - Patches `state` (connected ↔ paused, any → ended), `settings`, `status_map`, `status_read`, `relations`, `modules_offered` and `outside`.
  - `--pointer <folder_path>` instead of `--input` rewrites the pointer for a lost one; it needs no `--rev`.
- **`resolve`:** input `{ answers: [{ id, choice }] }`. Applies §8.2's effects, removes the answered entries, and opens the operations they need (none while paused). An unknown id or choice is `INPUT_INVALID`.
- **`item put`:**
  - Create: no `id`, no `--rev`; the input has `title`, `scope`, `acceptance` and optional `status` (default `todo`), `logging`, `depends_on`, `links` and `approve`. The command sets `progress: []`, `notion: null`, `publication: { state: pending, … }`, `claim: null` and `accepted: null`.
  - Update: a patch, which may hold `approve: true`, `accepted: { statement }` (the command sets `at`), `progress_add: [text]` (appended with `--now`), and `publish: true` (an item whose `create_task` was dropped goes back to `pending`).
  - It enforces §5.2's `done` rule and §7.1's `approved_at` rule.
- **`item claim`:** §10.1.
- **`artifact put`:**
  - Create: no `id`, no `--rev`; the input has `item`, `category`, `title`, `format` and `location`.
  - Update: a patch, which may hold `approve: true` with `sha256` (the approved content's hash, required with it), `override`, and `note`.
  - On approval it computes `publish` and `local_reason` (§5.3) and sets `publication` to `local` or `pending`. An `override` on a decided artifact replaces `publish` with `by: artifact`.
- **`render`:** read-only. `data` = `{ payload: <the Task payload in the form of sync tasks>, toggle: { heading: "Work record", markdown } }`. It works for an item with or without a page.
- **`op state`:**
  - Moves an operation through `pending → in_flight → done | failed | pending`, `failed → pending`, `uncertain → done | pending`, and any open state `→ dropped`. Another move is `INPUT_INVALID`.
  - `done` needs `--page` for `create_task` and `publish_artifact`. It records `notion` (`page`, the payload's title and status, `read_at` = now) on an item, `published_sha256` on an artifact, or `marked: true` on a map entry. It also sets the target's `publication`.
  - `failed` needs `--error` (`{ code, message, lasting }`).
  - `dropped` follows §10.3.
- **`reconcile`:**
  - With `--start`, it also begins a run (§10.3).
  - Applies §8 and §10.2 to the snapshot, writes routine changes, Needs you entries, and new or resolved operations, and returns `data` = `{ routine: [{ kind, target, from, to }], needs_you: [...], busy: [op ids], ops: [op ids] }`.
  - `routine.kind` is `status_adopted`, `title_adopted`, `settings_changed`, `state_changed`, `op_resolved` or `resolved_itself`.
  - `ops` lists the operations to run now, in the order `create_task`, `update_task`, `publish_artifact`, `mark_original`, then by target id.
- **`summary`:**
  - Without `--written`: read-only. `data` = `{ heading: "Workflow", markdown, sha256, changed }`, where `changed` is false when `sha256` equals `summary.sha256`.
  - With `--written <sha256>`: records `summary` (`written_at` = now). It is refused when the hash isn't the current render's (`STALE_RECORD`), and it needs no `--rev`.
- **`adopt preview`:** read-only. §11.2.
- **`adopt apply`:** §11.6. Its `--rev` is the revision of `adoption.json`, 0 before the first run.
- **`publish-history`:** read-only. `data` = `{ artifacts: [ids] }`: the approved artifacts with `publish.decision: exclude` and `by: level` that the current level would include. The skill asks, and an accepted one gets `artifact put` with `override: include`.

**Elsewhere in the CLI:**
- `brain id new` gains the four prefixes;
- `index`, `views` and `query` ignore `_workflows/`;
- `lint` gains the error rule `workflow-record` (a record that fails its schema, or an operation, map entry or `depends_on` naming a record that doesn't exist).

## 13. Skills (written in the fork, 0059)

The names below are proposals; the fork's approved mapping (CC-97) may rename them.
- **`brain-workflow-setup`:** §3.1.
- **`brain-workflow-adopt`:** §11.
- **The execution discipline** in every fork skill that tracks work, chosen in that mapping:
  - read the pointer: none, ended or missing → standard; paused → work locally and say how to resume; connected → continue;
  - at the start: `reconcile --start`, ask the Needs you batch, run `ops` (§10.2, §10.3);
  - before executing an item: claim it, and approve its scope and criteria when needed;
  - record progress and criteria as they happen;
  - approve artifacts as the user approves them;
  - at the end: reconcile and run `ops` again, then the summary (§9).

Reports follow the short form: counts, what needs the user, the next action.

## 14. Acceptance (0.9.0)

0059's three scenarios, and linked-repos.md §11 as the fourth, all on synthetic data:
1. **Standard software:** a repo with GitHub-style issues and no pointer. Nothing is written in the brain or in Notion.
2. **Connected software with a PR:** a Markdown plan is adopted: 3 items, 1 done and left in place, 1 in progress kept. A PR moves an item to `review`, and merging it with its criteria met moves it to `done`. At `full`, a plan is published and a temporary log isn't.
3. **General work under an Area:** a workshop is prepared at `tasks_and_finals`. The final deliverable is published only after approval, and an item is `done` only after the user's acceptance.

Shared checks, run once:
- an interrupted `create_task` resolves without a second task (§10.2);
- a failed operation is retried at the next run, and the summary shows "Work complete, 1 not yet in Notion" meanwhile;
- a title changed in both places is asked, and a status changed in both places keeps Notion's;
- a stale record revision is refused;
- two sessions can't claim one item;
- an adoption rerun creates nothing.
