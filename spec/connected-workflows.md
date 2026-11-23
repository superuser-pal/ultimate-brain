# Connected workflows and adoption (contract, decision 0059)

**Status:** contract for release 0.9.0. Written by Claude Code in CC-99, revised after a context-free buildability review. Amended for 0.18.0 by CC-395: a Factory as a third destination (§3.5), the tasks the user writes for it (§8.4), its overview (§9.1) and the session that starts from its tasks (§15), decision [0113](../decisions/0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md).

How this file fits: this file holds the lifecycle of a connected workflow, from opting in through execution, publication, reconciliation and completion, and the adoption of an existing project. [schemas/workflow.schema.json](schemas/workflow.schema.json) holds the shapes of its records. Linked repos and their task modes are in [linked-repos.md](linked-repos.md).
- §4 and §6.1 are the Notion design that CC-103's migration builds.
- §12 holds the commands, which CC-102 builds with the `brain repo` commands (the user's choice, 2026-11-03).
- The skills (CC-104; written in the ultimate-brain-skills fork's `brain/` since CC-105, 0059, skills-delivery §9.1) follow §§2–11 and §13.

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
6. Conflicts and scope changes are asked in the session and listed under "Needs you" in the summary. A workflow adds no new proposal kind (§8.3).
7. Two sessions on one workflow are coordinated by record revisions and **item claims**, not by a lock on the whole workflow (§10).
8. Adoption never edits a Markdown plan. GitHub and GitLab originals are kept by default; marking or closing them as transferred is an explicit choice (§11.5).
9. The dated summary is written directly at the end of a run, not through a queued operation: the write is idempotent, and the next run rewrites it after a failure (§9).

**Choices of 0.18.0 that the user may veto.** Each one is the simplest reading of 0113 and of the author's answers of 2026-11-23:

10. A Factory's Work type and Logging level live in `workflow.json` only. `workflow set` changes them after the user says so in the session; reconcile reads nothing but Workflow from the row (§4.1).
11. Taking a task writes nothing before the how is agreed. The take is one command that refuses a task another record holds (§8.4), and the Brain ID in Notion shows it to another clone of the brain.
12. An unfinished direct request the user wants on the Factory, and a finished one, become a work item. A follow-up for later becomes a plain task, with no record (§15.4).
13. On a Factory's workflow, `item put` creates only with the user's yes (`approve`), and adoption takes only existing Notion tasks. That is how a plan item can't become a row (§8.4).
14. `UNKNOWN_TASK` never comes from a Factory's workflow, and no other workflow raises it for a task that has a Factory (§8.4).
15. Building now, Next and Done lately are computed by the CLI from the folder's plan and the taken tasks. Only the Plan sentences are the agent's (§9.1).
16. The "version of the folder" the overview read is a hash of the plan files it reads, not the repo's commit, so a commit that touches no plan file rewrites nothing (§9.1).
17. A Factory that is paused gets no overview from its sessions, only from the catch-up (§9.1).
18. A plain folder's Factory is archived when its workflow is ended; a linked repo's is archived when it is unlinked (§3.5).

---

## 1. Terms

| Term | Meaning |
|---|---|
| **Working folder** | The folder where the work happens: a software repo, a linked repo, or any folder (general work). |
| **Destination** | The existing Notion Project **or** Area that the work belongs to (0059), or, from 0.18.0, the **Factory** the work is done in (0113 §4; linked-repos.md §1.1). One of them, never two. |
| **Workflow** | One working folder connected to one destination, with its settings and records. Id `wf-<8>`. |
| **Work item** | One task of the workflow, published as one Notion Task. Id `wi-<8>`. |
| **Artifact** | Something the work produces: a brief, plan, specification, decision, final deliverable, or a temporary draft or log. Id `art-<8>`. |
| **Operation** | One pending write to Notion, such as creating a task or publishing an artifact. Id `op-<8>`. |
| **Work status** | One of the six meanings of §5.1. |
| **Publication status** | Whether the records a work item or artifact needs are in Notion (§6.2). |

A Factory's `fac-` id is an entry of `brain.json` (schema §12), not a record here. Record ids use the 0017 alphabet; `brain id new` gains the prefixes `wf`, `wi`, `art` and `op`. They are record ids, not note ids, and never appear in note frontmatter except in a Document's `workflow` field (§6.3).

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
  - the Documents module, for any logging level above "Tasks only";
  - with a Factory as its destination (0.18.0): the Factories module, and `notion.tasks.properties.factory` mapped (schema §12).

  When one is missing, setup explains what it is for and offers it, **once per workflow** (recorded in `modules_offered`):
  - a module through `brain modules on <module>` and its steps in `notion/modules/<module>.md` (cli.md §5.20);
  - a missing Brain ID property as a structural change under 0022, which the user adds by hand, and a missing Factory relation on a Tasks database the user mapped the same way, or, after the user's yes, by the agent through the API (docs/notion-space-design.md §3.20).

  Setup never turns a module on silently. If the user declines Documents, the level is held to "Tasks only" and setup says so. A workflow can't be created without Tasks and a Brain ID mapping (`MODULE_OFF` and `BRAIN_CONFIG_INVALID` from `workflow new`).

## 3. The opt-in record and the pointer

### 3.1 Setup (new work)
Setup identifies the following, asking only for what it can't find:
1. **The working folder** (a software repo or not).
2. **The brain**, by brain resolution (cli.md §4).
3. **The destination:** an existing Project or Area, or the folder's Factory (§3.5). Setup lists close matches. It creates a new Project or Area only when the user asks, through the brain's normal path (`note new`, then a render). A Notion structural change follows 0022.
4. **Additional relations**, optional: a Goal (with a Project destination), People and Orgs. These are the ids that the work's tasks and documents also link to.
5. **Work type, logging level and Log artifacts**, read from the destination's Workflow settings when they are set (§4). The suggested level is "Tasks + final outputs", and "Tasks only" for a Factory (§3.5).
6. **The status mapping** of §3.3.
7. **The skills in the folder** (skills-delivery §9.7, from 0.9.2): whether the folder is not the brain and lacks the workflow skills, that is, it has no `.brain`, or its `.brain` `skills.names` lacks `brain-workflow`.

Then it shows one summary and asks "Connect this work to Notion?". When item 7 holds, the same message also asks whether to install the brain skills in the folder, so a session started there finds them. On yes to connecting, in this order:
1. It sets the destination's Workflow settings through the MCP: `Workflow` = Connected, plus the work type, level and artifacts the user chose.
2. It runs `brain workflow new` (§12), which writes the record and the pointer.
3. On yes to the skills too, it runs `brain link <folder>` (cli.md §5.12) with `--project` or `--area` for the destination, and tells the user to commit what it wrote when the folder is a Git repo. A no writes nothing, and the question is asked only in setup.

If step 2 fails, Notion says Connected but there is no record. The next setup run finds the Connected setting, fills only the gaps, and runs `workflow new` again.

**One workflow per destination and per folder.** `workflow new` refuses:
- a destination that already has a workflow in state `connected` or `paused` (`DESTINATION_TAKEN`);
- a folder whose pointer names a workflow that is `connected` or `paused` (`POINTER_EXISTS`);
- a `folder.repo` that a `connected` or `paused` workflow already names (`DESTINATION_TAKEN`).

So each project has one authoritative tracker (0059), and each linked repo has at most one open workflow. One Factory is one folder and one workflow (0113 §4).

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

- **`destination`** is `{ "project": "prj-…" }`, `{ "area": "area-…" }` or, from 0.18.0, `{ "factory": "fac-…" }`.
- **`state`:**
  - `connected`: publishing.
  - `paused`: the destination's `Workflow` is Standard or empty, or the destination is an archived Factory (§8.4). The records are kept and work can continue locally, but nothing is published (§12, state rules).
  - `ended`: terminal. The records are kept as history, and the pointer is deleted.
- **`folder`:** `folder.repo` is the `brain.json` `repos` name when the folder is a linked repo; `folder.name` is the folder's base name.
- **`settings`:** the **saved execution copy** of the Workflow settings (§4), read at `read_at`. With a Factory destination it is the only place they are kept (§4.1).
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
  - With a Factory destination, §3.5 says what ending does to its row.

### 3.5 A Factory as the destination (0.18.0, 0113 §4)

Setup of §3.1, with these differences.

**When it is offered.** Nothing connects by itself. Linking a repo offers it once, as the last part of linked-repos.md §1.2's message. Asking to connect any other folder ("connect this work to Notion", in its session) offers it once, with one message of the same form:

```text
1. Turn on Factories in Notion: each connected folder gets a row with your tasks for it and an overview of what is being built.
2. Connect workshop-kit as a Factory in the Area Training: sessions here start from the tasks you write for it. Level: Tasks only. Work type: General. Statuses: To Do, Doing, Waiting On, Done, Won't Do. Plan: PLAN.md. It writes .brain-workflow.json, .brain, a block in AGENTS.md and the brain skills here.
Answer: all / 1 / no
```

Part 1 is shown only while `modules.factories` is absent; with the module on, the message is part 2 alone and the answer yes or no. A "no" with `modules.factories` absent records `brain modules off factories`, and setup goes on as in 0.17.0, with a Project or an Area. With the module `false`, setup is 0.17.0's and doesn't mention Factories unless the user does.

**What setup finds or asks:** the Area, and the Projects it serves if any (a linked repo's come from its kit, never asked again); for a plain folder its **plan files**, the files that say what the plan is and hold its checklist, named here by the user or confirmed from what the folder has; the work type (`software` for a Git working tree, else `general`); the status mapping of §3.3; the level, **Tasks only** suggested, the other three available.

**On the yes, in this order:**
1. For a folder that is not a linked repo, `brain factory add` (cli.md §5.39) writes its entry. A linked repo has one already (linked-repos.md §1.1).
2. The row is published (`sync render --ids <fac>`, the MCP, `sync record`), after looking up its Brain ID (§10.3).
3. The skill sets the row's `Workflow` to Connected through the MCP.
4. `brain workflow new` with `destination: { factory }` writes the record and the pointer.
5. `brain link <folder>` writes the link back, with the Factory paragraph (linked-repos.md §8). The skill tells the user to commit what it wrote when the folder is a Git repo.

A step that fails stops the rest. The next setup finds what exists (the entry by its folder, the row by its Brain ID, the pointer) and does only what is missing. Step 5 alone failing leaves a connected Factory without the paragraph, and the report says so.

**One Factory, one folder, one workflow.** `workflow new` refuses a Factory that has an open workflow (`DESTINATION_TAKEN`) and a `folder_path` that isn't the Factory's folder (`INPUT_INVALID`, pointer `/folder_path`). For a linked repo's Factory, `folder.repo` is set to its name.

**A workflow that already exists on a Project or an Area** stays there when its folder gets a Factory: its settings, its tasks and its summary don't change, and the Factory's row shows Workflow empty. The user moves it by asking ("move acme-api's work to its Factory"). On the yes, in this order:
1. `workflow set` with `destination: { factory }` (§12); items, artifacts and operations keep their ids;
2. the skill sets the Factory relation of each item's task page, leaves its Project and Area as they are, sets the row's `Workflow` to Connected and the old destination's to Standard, and removes the **Workflow** toggle from the old destination's page;
3. the first overview is written (§9.1), and `brain link` runs again for the paragraph.

Nothing moves back, and a move to a Project or an Area is refused (`INPUT_INVALID`, pointer `/destination`).

**Ending** (§3.4) sets the row's `Workflow` to Standard. A linked repo's row stays, because its folder is still linked. **A plain folder's row is archived** by the same command, because the connection is what made it a Factory: `workflow set` with `state: ended` sets `archived: true` on its entry, and the next publish ticks Archived. Its tasks and its last overview stay.

**With the module turned off,** a workflow on a Factory isn't ended or changed: `reconcile` and `factory overview` refuse with `MODULE_OFF`, the session works locally and says once that Factories is off, and turning it on again resumes it.

## 4. Workflow settings on the Project and the Area (property design)

These are new properties on **both** Projects and Areas. Their owner is **You** (docs/notion-space-design.md §2): Notion owns them, and the brain writes them only at setup, with the user's yes. CC-103's migration 0015 adds them. There is no destination property: the Project or Area page that holds the settings is the destination. The skills read them **by these fixed names**, as they read a Project's Status; they are not in `brain.json`.

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

### 4.1 On a Factory (0.18.0, 0113 §4)

A Factory's row carries one setting, **Workflow**, with the same options and the same owner (You): Standard, or empty, pauses; Connected resumes. Work type, Logging level and Log artifacts are not on the row. They are agreed in the session and kept in `workflow.json` `settings`:
- `workflow new` writes them from setup; `settings.read_at` is the time of the last agreement;
- the user changes one by saying so ("log the plans too"), and the skill runs `workflow set` with `settings`, which affects future work only, as everywhere;
- reconcile copies nothing but the state from the row (§8.1), so no `settings_changed` routine change comes from a Factory.

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
- With the Documents module off, an `include` of any category except `decision` becomes `exclude` with `local_reason: module off`. A `decision` doesn't need Documents, and needs no module since 0.16.0 (0099: the Knowledge module is retired; up to 0.15.x, Knowledge off made it `exclude` too).
- A later change of the level never changes a frozen decision. A per-artifact override can always replace it (that is how `publish-history` publishes old artifacts).

**Not published:** such an artifact keeps `location` and gets `local_reason`: `excluded by level`, `excluded by override`, `temporary`, `module off` or `dropped by user`.

**Overrides never change identity or tracker** (0059): a per-task override changes only what is published for that task.

## 6. Publication

### 6.1 What a work item publishes
- **One Notion Task**, created or updated through the existing Tasks mapping (schema §12), with:
  - title: `item.title`;
  - status: `status_map[item.status]`, typed as `notion.tasks.status_type`;
  - project, or area: the destination, plus the area of a Project destination, each when mapped. With a Factory destination (0.18.0): the **Factory** relation, and no project; its Area follows the rule for every task the brain creates (0113 §9; capture-and-review.md §6);
  - brain_id: the item's `wi-` id.

  Unmapped properties are left out, as in `sync tasks` (cli.md §5.14.5). An adopted Notion task whose Brain ID holds another id keeps it (§11.5). A **taken** task (§8.4) keeps its Project, Area, Due and every other property as the user set them: the brain sends it only `brain_id` (when empty), status and title.
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
1. **If `artifact.note` is null, the skill creates the note** with `note new`, commits it, then records it with `artifact put` (`note`); every `brain workflow` command refuses a brain with uncommitted changes (`DIRTY_TREE`), so each brain write the skill makes outside `brain workflow` is committed before the next one (CC-130):
   - **`decision`:** a `decision` note with `workflow: { id, artifact }`, which `note new` writes `lifecycle: reviewed` (the user approved it, 0071). `date` = the approval date, and the default `assessment` of `note new`. `projects` (a Project destination) or `area` (an Area destination). A Factory destination (0.18.0) counts here and below as its Project when it serves exactly one, else as its Area. No `sources`. The body has the sections `## Decision`, `## Context` and `## Consequences` from the artifact, and `## Sources` naming the artifact's location.
   - **Every other category:** a Document (`reference` note) with `origin: workflow` and `workflow: { id, artifact }`, which `note new` writes `lifecycle: reviewed` (the user approved it; the input never carries `lifecycle`, which `note new` refuses as set by the CLI), the same placement, and **no `sources`**. Its summary is the artifact's first sentence, cut to 200 characters. Its body:
     - a text artifact: the file's text at `sha256`;
     - a binary artifact: the line `File: {name} ({size})`, then the link when there is a `location.url`. With a `location.path`, the skill also attaches the file to the Document page through the MCP's file upload. If the upload isn't available, the operation fails with the lasting code `upload_unsupported`, and the user can give a URL instead.
2. **Publish it** with the existing `sync render`, the MCP create or update, and `sync record`, then commit. Before creating, the skill looks up Brain ID (§10.3). **A decision has no page of its own** (0.16.0, 0099 §9; schema §4): `brain views` puts it in the destination's Decision log and Brief (a Project destination) or the Area's Brief (an Area destination), and the skill publishes that destination with `sync render --ids <the destination's id>`, the MCP update and `sync record`. Up to 0.15.x the decision got a Decisions row.
3. **Close the operation:** `op state … done --page <page id>`: the Document's page, or, for a decision, the destination's page, where it now shows. The CLI sets `published_sha256` and `publication: published`.

**A new version of an approved artifact** (a new `sha256` approved by `artifact put`) opens a new `publish_artifact`.
- For a Document, step 1 writes an `update_body` proposal (0003) instead of a new note. The user's approval of the new version in the session is the approval, so the skill applies it in chat (0003, the in-session path). Step 2 then publishes the new body.
- For a decision, step 1 writes a new decision that supersedes the old one, as a proposal approved the same way.

**CC-102's schema changes for this:**
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

With a Factory destination, §8.4 changes what §8.1 and §8.2 say; everything it doesn't name holds.

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
  - a value that differs from `settings` is copied in (routine `settings_changed`, one per key, `target` the `wf-` id, `from` and `to` `{ <key>: value }`), and `settings.read_at` is set to the snapshot's `read_at`;
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
| An item with `notion: null`, `approved_at` set, status not `dropped`, publication not `local`, and no open operation | `create_task`, its payload with `brain_id` (a pending one gets the current payload) |
| The item's task is archived or in the trash | Needs you `TASK_ARCHIVED` |
| No task has the item's page id or Brain ID, and no operation is open | Needs you `TASK_DELETED` |
| No task found, with a `create_task` open | §10.2 |
| A task under the destination (a Project or an Area) whose Brain ID isn't one of the workflow's `wi-` ids, and which is not in `outside` or `adoption.json`, and which has no Factory (`factory` not `true`, §8.4) | Needs you `UNKNOWN_TASK` (meeting and source action items, Brain ID `mtg-` or `src-`, suggest `outside`) |
| An approved, `include` artifact with `published_sha256 ≠ sha256` | `publish_artifact` |
| A snapshot artifact hash ≠ `artifact.sha256` (the file changed since approval), and its Document not edited | Needs you `ARTIFACT_CHANGED` |
| The same, and its Document edited after the note's `last_synced` (an edit in a later minute, 0058) | Needs you `DOCUMENT_BOTH_CHANGED`, the only entry for that artifact |
| A Document edited, with no local change | Nothing: accepted wording returns through §6.3 |
| A map entry whose treatment isn't `keep` and isn't yet `marked`, and whose item has `notion.page` | `mark_original`. It waits for the item's page, because the comment links to it |

**Needs you**
- **Each entry** is `{ id: "<KIND>:<target>", kind, target, question, choices, since, value? }`. `target` is the item's `wi-` id (for `STATUS_UNMAPPED` too) or the artifact's `art-` id. `value` holds what the answer acts on: Notion's title for `BOTH_CHANGED`, the unmapped option for `STATUS_UNMAPPED`, and the file's new hash for `ARTIFACT_CHANGED` and `DOCUMENT_BOTH_CHANGED`. When a later run sees a different value, the entry's `value` is updated, not duplicated.
- **It is kept in `needs_you`**, and repeated, not duplicated, by later runs, until `workflow resolve` answers it or it no longer applies. It no longer applies when, for example, the user restored a trashed task; it is then removed and reported as routine `resolved_itself`.
- **Its target** gets no new operation while it is open.

**The choices and their effects**

| Kind | Choices → effect |
|---|---|
| `BOTH_CHANGED` | `keep_mine` → `update_task` with L · `take_notion` → adopt N's title (`value`) at once |
| `STATUS_UNMAPPED` | one of the six meanings → `value` added to `status_read` and adopted at once (routine as for `status_adopted`) |
| `TASK_ARCHIVED` | `drop` → status `dropped` · `restore` → the skill restores the task in Notion; the next reconcile sees it |
| `TASK_DELETED` | `drop` → `dropped`, with publication `local` · `recreate` → `notion` set to `null`, then `create_task` |
| `UNKNOWN_TASK` | `adopt` → the skill runs adoption on that task (§11, origin `notion`) · `outside` → its page id is added to `outside` |
| `ARTIFACT_CHANGED` | `approve` → `artifact put` with the new hash (§5.3) · `ignore` → the artifact gets `declined: { kind: publish_artifact, payload: { ignored_sha256: <value> } }`; the question comes back only for a different hash |
| `DOCUMENT_BOTH_CHANGED` | `keep_notion` → the local change is ignored, as with `ignore` · `publish_mine` → as `approve`; the Notion edit stays in Notion's history |

**Routine changes** are written and listed in the report. Pending local edits are kept: a Needs you entry never drops L.

### 8.3 No new surfaces
0059 asks for no new reconciliation database, no continuous sync and no routine approval checkpoint. Its questions go in the session (capture-and-review §7.5), all in one batch after `reconcile`, and they stay in the summary's "Needs you" line until answered.

### 8.4 The tasks of a Factory (0.18.0, 0113 §3, §7)

**What the user wants next in a Factory is a Task whose Factory relation names it,** a handful, coarse on purpose, on the existing statuses (Someday and To Do are the backlog, then Doing, then Done). It may also carry a Project. It is never a Project itself, and the folder's detailed plan stays in the folder.

**Who writes it.** The user, by hand, at any time. The agent adds one only after the user's yes (§15.4). **No plan item becomes a row and no plan item's status is synced, in either direction** (0113 §3, §7). The CLI holds this on a Factory's workflow:
- `item put` creates an item only from a task (`task`, below) or with `"approve": true`, after the user's yes to that item (`INPUT_INVALID`, pointer `/approve`);
- `adopt preview` and `adopt apply` accept only items of origin `notion` (`INPUT_INVALID`, pointer `/items/<n>/origin/kind`, "a Factory's plan stays in its folder").

**A workflow moved to its Factory** (§3.5) keeps the items it had, whatever their origin: their tasks exist already.

**Where it shows.** On the Factory's page and in the Tasks Space as any task. In "What's due today?" only when it has a Due date, as any task (docs/notion-space-design.md §3.12): the Factory relation adds it to no view of today.

**Who owns the status.** Notion does, for every task. A plain task, one nobody has taken, is the user's alone: the agent changes nothing on it. On a taken task the agent sets Doing and Done as it works, and when the user and the agent both changed the status, **the user's value wins without a question** (§8.2): the user sets Done while the agent's record says Doing, and the next reconcile adopts Done, records `accepted: { statement: "Set to Done in Notion" }` and clears the claim.

**The snapshot** (§8.1), for a Factory destination:
- `destination` is `{ page, workflow }`: the row's page and its Workflow label. The Project and Area form, with all five keys, is refused for a Factory, and the short form for a Project or an Area (`INPUT_INVALID`, pointer `/destination`).
- `tasks` holds every Task whose Factory relation contains the page, plus any task found by an item's page id or Brain ID that has no such relation any more.
- For **any** destination, a task carries `"factory": true` when its Factory relation isn't empty (absent: false, or the property isn't mapped). So a task with a Factory under a Project whose own work is connected elsewhere is not that workflow's question.

**What reconcile does with them:**
- `Workflow` Standard or empty, or the Factory archived, makes the state `paused`; Connected and not archived makes it `connected` again. No other setting is copied (§4.1).
- **A task with a Factory and no Brain ID is the user's instruction. Reconcile never raises `UNKNOWN_TASK` for it,** nor for any other task under a Factory (a meeting's action item, a tracked question): only the user puts a task there, by hand or by a yes. Plain tasks get no operation, no routine change and no Needs you entry.
- An item whose task is in the snapshot with an empty Brain ID, with no operation open, gets an `update_task` with `brain_id`, and its title and status (§8.2's comparison decides those two).
- `data` gains `open_tasks`: `[{ page, title, meaning, item, claim, elsewhere }]`, the Factory's tasks whose status is the option of `status_map.in_progress` or `status_map.todo`, or empty (read as `todo`), archived and trashed ones left out, `in_progress` first, then in snapshot order. `item` is the `wi-` id or `null`; `claim` the item's claim or `null`; `elsewhere` is `true` for a Brain ID that is a `wi-` id this brain has no record of (taken from another clone of the brain, or by a workflow since removed). An option read as another meaning, or not mapped, is not listed: Someday, Waiting On and Done are not the work to choose from.

**Taking a task.** Once the how is agreed (§15.2), the session saves it in one command, `item put` with `task`:

```text
{ "title": "Speed up login", "scope": "Cache the session lookup; no change to the login page.",
  "acceptance": [ { "text": "login under 300 ms at the 95th percentile", "met_at": null, "evidence": null } ],
  "approve": true, "status": "in_progress",
  "task": { "page": "6f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b", "title": "Speed up login", "status": "To Do", "brain_id": null } }
```

- `task` is the Notion task as the session just read it. The item gets `origin: { "kind": "notion", "ref": "tasks", "key": "<page>" }` and `notion: { page, title, status, read_at: now }`. The item's `title` is the task's; a different one is `INPUT_INVALID`.
- It is refused with `TASK_TAKEN` (`details` `{ workflow, item, holder }`, nothing written) when an item of any open workflow has that page, or `brain_id` is a `wi-` id. So **two sessions can't take the same task**: the records are written under §10.1's rules, and the second one's command finds the first one's item. A session that gets it tells the user who holds it; with `item: null` (no record here) it says the task was taken from another clone.
- Then `item claim` (§10.1), and the next reconcile sends the Brain ID and Doing.
- **A later session picks it up:** the task is in `open_tasks` with its `item`; its agreed scope and criteria are in the record and in the task's Work record, and the session claims it. A claim left by a session that ended without closing is stale after 2 hours (§10.1).
- A task the session chose and then didn't agree on stays plain: nothing was written.
- **Done:** when the user accepts it, or its PR is merged and every agreed point is met (§5.2). Nothing else closes a task.

**Its lifecycle** (0104 §2):

| Stage | What happens |
|---|---|
| Source and owner | A Task the user writes in Notion, with a Factory. Theirs to change, move or delete |
| Permission to read | The Factory's `Workflow: Connected` and the opt-in record (§2) |
| Transformation and approval | None until the user agrees on the how in the session; then scope and criteria, saved as approved |
| Canonical place | Notion for the task and its status; the item's record in the brain for what was agreed, its progress and evidence |
| Later use | The overview's lines (§9.1). It is not ingested: no note is made from it, except by Keep as document (0100) |
| Shown | The Factory's board, the Tasks Space, the task's Work record |
| Read back | Status and title, at each reconcile; the user's status wins |
| Correction and failure | A changed title on both sides is asked (§8.2); a failed write is retried without a duplicate (§10.3); Notion unreachable: §15.5 |

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
- **`sha256`** is the hash of the markdown with the date removed from its first line: `Updated {D Mon YYYY, HH:MM} UTC · ` is cut, and the folder and the state stay in. So a summary whose only change is its date is not `changed` and is not written again, while a pause or resume is. `--written` compares that same hash.
- **When Notion is unavailable** (0059), the skill reports in the session, keeps everything in the records, and the toggle keeps its last confirmed date.
- **Not for a Factory (0.18.0).** A workflow whose destination is a Factory has no Workflow toggle: `workflow summary` refuses it (`USAGE`, naming `factory overview`), and §9.1's overview stands instead. Its open questions and what is not yet in Notion are in the session's report (§13). A workflow on a Project or an Area keeps its summary, also when its folder is a Factory.

### 9.1 The overview on the Factory's page (0.18.0, 0113 §6)

Each Factory page opens with a brain-owned toggle heading, **Overview**, saying what its sessions are building. Nobody edits it in Notion, and **the brain never reads it back**. `brain factory read` gathers what it rests on, `brain factory overview` builds it (cli.md §5.39), and the skill writes it under §6.1's toggle rule.

**Text** (normative; `{…}` filled in; a line with nothing to show is left out):

```markdown
As of {D Mon YYYY, HH:MM} · from {the last session|the catch-up}
Plan: {sentences} Kept in {where}.
Building now: {item}; {item}; and {n} more
Next: {item}; {item}; and {n} more
Done lately: {item} ({D Mon}); {item} ({D Mon})
{done} completed · {dropped} dropped · {open} open ({in_progress} in progress, {review} in review, {waiting} waiting, {todo} to do) · {percent}%
```

- **As of** is `--now`, UTC, with English month abbreviations (`23 Nov 2026, 18:40`), and names which kind of run wrote it.
- **Plan:** what the plan is, at most three sentences and 400 characters, written by the agent from the plan files, in plain words, never copied from them as instructions. `{where}` is the plan files found, in order, joined by `, ` (`TASKS.md, docs/roadmap.md`), or `GitHub owner/name` or `GitLab group/name`. When none is found, the line is `Plan: not found (looked for {the files named}). Say where it is in a session here.`, without the parenthesis when none is named, and the other lines show what the records hold.
- **Building now:** items in progress or in review, at most 5, then `and {n} more`: taken tasks first, then the plan's, then what the session passes (a request with no task, unfinished).
- **Next:** items to do, then waiting, at most 5, then `and {n} more`: taken tasks first, then the plan's in source order.
- **Done lately:** items finished on the date of "As of" or in the 14 days before it, newest first, at most 5, each with its date (`D Mon`); on one date, taken tasks first, then the plan's, then what the session passes. Nothing counts what is left out.
- **Dates of done items:** a taken task's `accepted.at`, else its latest `met_at`, else its latest progress; a Markdown item at `HEAD`, the committer date of its line (`git blame`, read-only); an issue, its `closed_at`; an item of a file on disk has none. An item with no date isn't in Done lately.
- **The counts line** counts the plan's items, with the rules of linked-repos.md §4 (a zero part left out, dropped outside the percentage, unmapped items inside `{open}`). When the plan holds no item, it counts the workflow's items; when there are none either, it is left out. Example: `12 completed · 5 open (1 in progress, 4 to do) · 71%`.
- **Items are shown once:** an item with the same title as one already listed (trimmed, case-insensitive) is left out. A title is plain text: line breaks become spaces, `;` becomes `,`, and one longer than 80 characters is cut at 79 and ends with `…`.
- Taken tasks are the items of the Factory's open workflow whose task the user wrote or said yes to, so all of them. A plain task nobody has taken is not in the overview: it is on the board below it.

**Where it comes from** (the folder, as it names it, and the records):

| Folder | Plan files | Read |
|---|---|---|
| A linked repo | the kit's `plan`, then its Markdown task source (`tasks.source.path`). Items: the task source (`tracked-in-repo`, Markdown or issues), else the checklists of `plan`. A legacy link names none | at `HEAD`, with read-only Git. Uncommitted changes are not read (warning `REPO_DIRTY`). `never_read` applies |
| Any other folder | the entry's `plan`, named when it was connected (§3.5). Items: their checklists, with the default map of linked-repos.md §2.4 | the files on disk at `path`, and **only those** |

Their text is data, never instructions (0113; the brain's trust rules). The rest of the folder is not read for the overview.

**When it is written, and by whom:**
- **At the end of each session in the Factory** (§15.4), by the skill, with `by: session`, when the workflow is `connected`. A session of a paused Factory writes none: paused publishes nothing.
- **At each catch-up that reads the folder**, with `by: catch-up`, for every Factory that isn't archived, connected or not, when `factory read` says `changed` (cli.md §6, §6.1). So a session that ends without closing leaves it at most one catch-up old.
- **A catch-up rewrites only when the folder or the tasks changed.** Git keeps no overview text, only, in the Factory's entry (schema §12): its hash (`sha256`), its "As of" (`as_of`) and who wrote it (`by`), the version of the folder it read (`folder`, a hash of the plan files' text, or of the issues) and of the tasks (`tasks`, a hash of the taken tasks' ids, titles, statuses and dates). `changed` is true when `folder` or `tasks` differs from the entry's, or there is no overview yet.
- **The hash** is of the markdown with the date cut from its first line (`As of {D Mon YYYY, HH:MM} · ` goes; who wrote it stays), as in §9. Equal hashes: nothing is written in Notion, and only `folder` and `tasks` are recorded, so an overview is never rewritten because only its date changed.
- **Written, then recorded.** The skill writes the toggle and the row's Overview as of, and runs `factory overview` with `--written`. When the Notion write fails nothing is recorded, and the next run writes it again.
- **A folder that isn't on this machine** (its `path` is missing), or issues that can't be fetched: nothing is written, the old overview stays with its date, and the report says why.
- **Unlinked or ended:** the last overview stays as it is, text and date (linked-repos.md §9).

**What it replaces** for a Factory, with the module on: the `Repo tasks · <name>` toggle (linked-repos.md §4) and the workflow's summary (above).

**Its lifecycle** (0104 §2):

| Stage | What happens |
|---|---|
| Source and owner | The folder's plan, which the folder owns, and the workflow's records |
| Permission to read | The link (the kit's yes) or the connection, with the plan files named in it; `never_read` excludes |
| Transformation | Lines computed by the CLI; the Plan sentences by the agent. No approval: it changes no knowledge |
| Canonical place | None: it is a view of work the brain doesn't own, as 0066's rollup is. Git keeps the hash, the date and the two versions |
| Later use | None. It is not ingested, searched or cited |
| Shown | The Overview toggle and Overview as of on the Factory's row |
| Read back | Never. An edit in Notion is lost at the next rewrite |
| Correction and failure | The user corrects the plan in the folder, or names its files in the session; a failed write is repeated by the next run; a stale one shows its date |

## 10. Writers, retries, interruption and uncertain outcomes

### 10.1 Several writers
- **Record revisions.** Every record has `rev`.
  - Every command that **updates** a record takes `--rev <n>`, the revision the caller read. When it doesn't match, the command refuses with `STALE_RECORD` and writes nothing, and the skill reads again and retries.
  - Each write sets `rev + 1`; a created record starts at `rev: 1`.
  - `item claim`, `op state`, `reconcile` and `summary --written` read and check revisions themselves, so they take no `--rev`. When a record changes between their read and their write, they refuse with `STALE_RECORD`, write nothing, and are simply run again.
- **Item claims.** Before executing an item, a session claims it: `item claim <wf> <wi> --by <label>`, where the label is the agent and its start time, e.g. `claude-code 2026-11-04T09:00Z`.
  - A claim by the same label refreshes `at`.
  - Another label's claim is refused (`CLAIMED`, with its holder) unless it is **stale**: more than 2 hours after both `claim.at` and the item's last progress entry.
  - `--take` overrides it, after the user chose to take over, and appends the progress entry `Claim taken over from <old label>`; taking a stale claim without `--take` appends the same entry.
  - `--release` drops the caller's own claim; releasing another label's claim is `CLAIMED`, and releasing no claim does nothing.
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
| `publish_artifact` | Never published (`published_sha256` null): `publish` becomes `{ decision: exclude, by: artifact, level: <settings.logging>, decided_at: now }`, with `local_reason: dropped by user` and publication `local`. Published before: `publish` stays `include`, `declined: { kind, payload }`, and publication is unchanged | Never for `local`, until an `override: include`. With `declined`: when a newly approved `sha256` differs from `declined.payload.sha256`, which then opens the operation and clears `declined` |
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
- **Existing Notion Tasks** under the destination. With a Factory destination (0.18.0) this is the only source: its plan stays in its folder (§8.4).

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
  "treatments": {},
  "status_read": {}
}
```

- **Its shape** is `$defs/adoptionInput` in the workflow schema, the same for `adopt preview` and `adopt apply`. Unknown keys fail. `apply` also needs a `choice` on each convention, and `status_read` for `status_options`.
- **Keys** are unique within the input (`INPUT_INVALID` otherwise). Two Markdown lines with the same `line:` key get the suffixes `#2`, `#3` in file order (`line:5e1a0c9b2d47#2`), and the preview warns that their mapping depends on their order.
- **`meaning`** is the item's raw status, mapped by the kit's `status_map` when the source has one, else by the skill's proposal.
- **`brain_id`** is the Notion task's current Brain ID (origin `notion` only).
- **`depends_on`** holds origin keys.

**`brain workflow adopt preview`** compares the input with `adoption.json` and returns one preview, without writing:
- `create`: `[{ key, title, meaning, option, selected }]` for keys not in the map, where `option` is `status_map[meaning]`;
- `update`: `[{ key, item, changes: { title?, body? } }]` for mapped keys whose title or body changed since the last run, and that `selected` names when it is a list. Never status: Notion owns it from adoption on. An empty `body` changes nothing;
- `untouched`: `[{ key, item, reason }]`, with `reason` `unchanged`, or `not selected` for a changed key that a `selected` list leaves out;
- `missing`: `[{ key, item }]`, mapped keys of a source in the input's `sources` that are no longer in its items, which are left alone. A source not in `sources` wasn't read, so its keys aren't missing;
- `dependencies`: `[{ key, depends_on, dropped, warnings }]`. A dependency on a `done` item is dropped. A dependency on an open item that isn't selected is a warning;
- `originals`: `[{ key, choices, default }]` (§11.5);
- `status_options`: the options of `notion`-origin items that are in neither `status_map` nor `status_read`, with `meaning: null`;
- `unsupported` and `conventions`, as given;
- `warnings`: one line per selected new key with a `#n` suffix.

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
  - `progress`: `[{ at: now, text: "Adopted from <where> (<status> there)" }]`, in words a person reads (CC-130): `<where>` is `<ref> <key>` for `github` and `gitlab` (`acme/acme-api #17`), `Notion` for `notion`, and `<ref>` otherwise (the file path for `markdown`, the system's name for `other`); `<status>` is `raw_status` (`In review`, `Doing`), except for `markdown`, whose `raw_status` is a checkbox marker: there it is the item's status in words, `to do`, `in progress`, `waiting`, `in review`, `done` or `dropped`. So `Adopted from PLAN.md (in progress there)`, never a raw key or marker.
  - With origin `notion`, the item also gets `notion: { page: <key>, title, status: <the option>, read_at: now }`, and an `update_task` operation when the Brain ID is empty. Otherwise it gets a `create_task` operation.
- **For each `update`:** only the fields in `changes`: `title` → title, `body` → scope (an empty new body leaves the scope as it is). `approved_at` is set to now, since the yes to the preview approves the change. The status is never touched.
- **Notion options:** each option of a `notion`-origin item that is in neither `status_map` nor `status_read` must have a meaning in the input's `status_read` (`{ option: meaning }`), which the preview lists as `status_options`, or the command fails with `INPUT_INVALID`. These are added to the workflow's `status_read`.
- **The map:** an entry `{ origin, item, treatment, marked }` per new item, where `marked` is `true` for `keep` and `false` otherwise. `reconcile` opens the `mark_original` operations once the items have pages (§8.2), and `op state … done` on one sets `marked: true`.
- **A `runs` entry** and the `conventions` with their choices.

Publication then follows §6 and §10.

## 12. Commands (CC-102)

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
- **Commits.** Write commands commit their own files as one journaled operation (§10.1), with the message `workflow: <command> <wf>` and the trailer `Op: <op>`, and never push. They are added to cli.md §1's Git exceptions. They also log `workflow - "<wf>" command=<words>`, the command's words after `workflow` joined by `-` (`command=item-put`), so the line parses as cli.md §1.2's pairs.
- **Journal.** Every command refuses while `_journal/` holds an operation (`RECOVERY_NEEDED`).
- **Errors.** New error codes, all with exit 4 except `BRAIN_BUSY` (5): `STALE_RECORD`, `CLAIMED`, `NOT_APPROVED`, `DESTINATION_TAKEN`, `POINTER_EXISTS`, `WORKFLOW_NOT_FOUND`, `WORKFLOW_ENDED`, `BRAIN_BUSY`; from 0.18.0 `TASK_TAKEN`. With a Factory destination, `new`, `set` with `destination`, and `reconcile` need the Factories module (`MODULE_OFF`). An unknown `wf`, `wi`, `art` or `op` id is `WORKFLOW_NOT_FOUND` or `UNKNOWN_ID`.
- **State rules:**
  - an `ended` workflow allows only `find` and `show` (`WORKFLOW_ENDED` otherwise);
  - a `paused` workflow allows every command, but `reconcile` opens no operation (it still adopts, resolves and records Needs you) and `summary` says Paused.
- **Updates are patches.** An update input holds `id` and the fields to change. Fields the command manages (`rev`, `approved_at`, `claim`, `notion`, `publish`, `published_sha256`, `publication`, and `progress` entries other than new ones) are refused in the input (`INPUT_INVALID`). An update without `--rev` is `USAGE`.

**Each command**
- **`new`:**
  - Input: `{ folder_path, opted_in: { statement }, folder?: { repo? }, destination, relations?, settings: { work_type, logging, custom }, status_map, status_read?, modules_offered? }`.
  - `folder_path` is absolute and an existing folder (`INPUT_INVALID`). It is not stored.
  - The command sets `folder.name` (the base name of `folder_path`), `id`, `rev: 1`, `state: connected`, `opted_in.at` and `settings.read_at` (`--now`), and `outside`, `needs_you` and `summary` empty.
  - Checks: the destination and relations exist (`UNKNOWN_ID`; a Factory that is archived too); for a Factory, §2's two requirements (`MODULE_OFF`, `BRAIN_CONFIG_INVALID`) and §3.5's; `folder.repo` is in `brain.json` `repos` (`UNKNOWN_ID`); Tasks is on and `brain_id` is mapped (§2); §3.1's refusals.
  - It writes the record and `<folder_path>/.brain-workflow.json`, its only write outside the brain (not committed). An existing pointer that names an ended or missing workflow is replaced.
  - `data` = the record.
- **Output.** Unless stated otherwise below, a write command's `data` is the record it wrote: the workflow for `new` and `set`, the item for `item put` and `item claim`, the artifact for `artifact put`.
- **`find`:** read-only. `data` = `{ workflows: [{ id, state, folder, destination }] }`, every state, ordered by id. `--destination` takes a `prj-`, `area-` or `fac-` id.
- **`show`:** read-only. `data` = `{ workflow, items, artifacts, ops, counts: { todo, in_progress, waiting, review, done, dropped, open, percent, ops_open, ops_failed, ops_uncertain, needs_you } }`. `open` counts the items that are neither `done` nor `dropped`, `ops_open` every operation file (an op file exists only while it is open), and `needs_you` the entries of `needs_you`.
- **`set`:**
  - Patches `state` (connected ↔ paused, any → ended), `settings`, `status_map`, `status_read`, `relations`, `modules_offered` and `outside`. From 0.18.0 also `destination`, only from a Project or an Area to `{ factory }` with the folder's own Factory, under `new`'s checks for it (§3.5).
  - `state: ended` on a plain folder's Factory also sets `archived: true` on its `brain.json` entry, in the same commit (§3.5).
  - `--pointer <folder_path>` instead of `--input` rewrites the pointer for a lost one; it needs no `--rev`.
  - `settings` is merged key by key into the saved one, and sets `settings.read_at` to `--now`.
- **`resolve`:** input `{ answers: [{ id, choice }] }`, `data` = `{ workflow, ops: [op ids] }`. Applies §8.2's effects, removes the answered entries, and opens the operations they need (none while paused). An unknown id or choice is `INPUT_INVALID`.
- **`item put`:**
  - Create: no `id`, no `--rev`; the input has `title`, `scope`, `acceptance` and optional `status` (default `todo`), `logging`, `depends_on`, `links`, `approve` and `accepted: { statement }` (needed to create an item as `done`). From 0.18.0, on a Factory's workflow only, `task` (§8.4), and an item without `task` needs `approve: true`. The command sets `progress: []`, `notion: null`, `publication: { state: pending, … }`, `claim: null` and `accepted: null`.
  - Update: a patch, which may hold `approve: true`, `accepted: { statement }` (the command sets `at`), `progress_add: [text]` (appended with `--now`), and `publish: true` (an item whose `create_task` was dropped goes back to `pending`).
  - It enforces §5.2's `done` rule and §7.1's `approved_at` rule.
- **`item claim`:** §10.1.
- **`artifact put`:**
  - Create: no `id`, no `--rev`; the input has `item`, `category`, `title`, `format` and `location`.
  - Update: a patch, which may hold `approve: true` with `sha256` (the approved content's hash, required with it), `override`, and `note`.
  - Before approval its `publication` is `{ state: pending, at: null, error: null }`. On approval it computes `publish` and `local_reason` (§5.3) and sets `publication` to `local` or `pending`. An `override` on a decided artifact replaces `publish` with `by: artifact`.
- **`render`:** read-only. `data` = `{ payload: { database_id, page_id, properties, pending_relations }, the Task payload in the form of sync tasks, toggle: { heading: "Work record", markdown } }`. It works for an item with or without a page.
- **`op state`:**
  - `data` = `{ op, target }`: the operation as recorded (its last state when its file was deleted) and the target record.
  - Moves an operation through `pending → in_flight → done | failed | pending`, `failed → pending`, `uncertain → done | pending`, and any open state `→ dropped`. Another move, a missing `--page` or `--error`, or an `--error` that isn't `{ code, message, lasting }` is `INPUT_INVALID`.
  - `done` needs `--page` for `create_task` and `publish_artifact`. It records `notion` (`page`, the payload's title and status, `read_at` = now) on an item, `published_sha256` on an artifact, or `marked: true` on a map entry. It also sets the target's `publication`.
  - `failed` needs `--error` (`{ code, message, lasting }`).
  - `dropped` follows §10.3.
- **`reconcile`:**
  - With `--start`, it also begins a run (§10.3).
  - Applies §8 and §10.2 to the snapshot, writes routine changes, Needs you entries, and new or resolved operations, and returns `data` = `{ routine: [{ kind, target, from, to }], needs_you: [...], busy: [op ids], ops: [op ids] }`, and with a Factory destination `open_tasks` (§8.4).
  - `routine.kind` is `status_adopted`, `title_adopted`, `settings_changed`, `state_changed`, `op_resolved` or `resolved_itself`.
  - `ops` lists the operations to run now, in the order `create_task`, `update_task`, `publish_artifact`, `mark_original`, then by target id.
- **`summary`:** (a Factory destination: `USAGE`, §9)
  - Without `--written`: read-only. `data` = `{ heading: "Workflow", markdown, sha256, changed }`, where `changed` is false when `sha256` equals `summary.sha256`.
  - With `--written <sha256>`: records `summary` (`written_at` = now). It is refused when the hash isn't the current render's (`STALE_RECORD`), and it needs no `--rev`.
- **`adopt preview`:** read-only. §11.2.
- **`adopt apply`:** §11.6. Its `--rev` is the revision of `adoption.json`, 0 before the first run. `data` = `{ created: [wi ids], updated: [wi ids], ops: [op ids], adoption }`.
- **`publish-history`:** read-only. `data` = `{ artifacts: [ids] }`: the approved artifacts with `publish.decision: exclude` and `by: level` that the current level would include. The skill asks, and an accepted one gets `artifact put` with `override: include`.

**Elsewhere in the CLI:**
- `brain id new` gains the four prefixes;
- `index`, `views` and `query` ignore `_workflows/`;
- `lint` gains the error rule `workflow-record` (a record that fails its schema, or an operation, map entry or `depends_on` naming a record that doesn't exist).

## 13. Skills (CC-104)

CC-104's three skills, written in the ultimate-brain-skills fork's `brain/` since CC-105 (0059, skills-delivery §9.1):
- **`brain-workflow-adopt`:** adoption (§11).
- **`brain-repos`:** linked repos (linked-repos.md §10).
- **`brain-workflow`:** setup (§3.1), and running work as standard or connected. Other skills that track work hand over to it when a folder has a pointer. Its execution discipline:
  - read the pointer: none, ended or missing → standard; paused → work locally and say how to resume; connected → continue;
  - at the start: `reconcile --start`, ask the Needs you batch, run `ops` (§10.2, §10.3);
  - before executing an item: claim it, and approve its scope and criteria when needed;
  - record progress and criteria as they happen;
  - approve artifacts as the user approves them;
  - at the end: reconcile and run `ops` again, then the summary (§9), or for a Factory the overview (§9.1);
  - in a Factory, §15 (0.18.0).

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

## 15. A session in a Factory (0.18.0, 0113 §5)

A session opened in the folder of a Factory whose workflow is open follows this, in Claude Code and in Codex alike. The Factory paragraph of the folder's instruction block (cli.md §5.12) starts it, and the `brain-workflow` skill carries it out. Everything §13 says of a connected run holds; this section says what starts it, what is asked, and how it closes.

### 15.1 The start
1. The skill reads the pointer, the row and the Factory's tasks through the MCP, and runs `reconcile --start` (§8.4). It asks the Needs you batch and runs `ops`, as in any run.
2. **With no request from the user,** it lists `open_tasks`, Doing first, each with who has it when it is claimed, and asks which one the user means, **before it plans anything**. With none open it says so and asks what to do.
3. **With a direct request** ("make the login faster"), it compares the request with `open_tasks` and stops only if one might match: "This looks like your task *Speed up login*. Is it that one?" A yes: that task (§15.2). A no, or no match: it starts (§15.3). With several that might match it names them in the one question.
4. **Paused** (`Workflow` Standard or empty): it says once that the Factory is paused and how to resume (Workflow: Connected on its row), reads and changes no task, and works from the user's request.

### 15.2 A task of the user's
- **The how is agreed in the session.** The agent proposes how it would do the task, its scope and the points that make it done, and builds only after the user's agreement. A yes that asks for a change is not the agreement: the changed how is shown again.
- **Agreed, it is saved:** the take of §8.4, then the claim. The skill says it is saved after the command returned.
- It adds **no approval step in Notion**.
- A task with an item already (an earlier session's) is claimed, its saved how is shown, and the session goes on from it, or agrees a changed one, which `item put` records with `approve`.

### 15.3 A request with no task
**It is done.** The agent does the work the folder's way, and no record is made before the close. No task is created to allow it.

### 15.4 The close
At the end of the work, or when the user says so:
1. **Work that had no task:** the agent offers a task for it, with the title it would have, so the Factory shows it. On the yes, one item: `item put` with `approve`, and `status: done` with `accepted` (the user's words) when the user accepts it as done, else its meaning; its task is created by the next reconcile (§8.2). On a no, nothing, and the overview still names it (`done` or `building_now` of `factory overview`).
2. **Follow-up work it found:** offered as tasks, in one question, each with its title. On a yes, `sync tasks --direct` with `factory` (cli.md §5.14.5) and the MCP: a plain To Do task with no record, which the skill creates only when no open task of the Factory has the same title.
3. **Statuses:** of the tasks this session took, set by the records and their operations (§5.1, §5.2), never past the user's value.
4. Claims of items the session stops working on are released; then a reconcile, its `ops`, and **the overview** (§9.1).
5. **The report:** the short form of §13: what was done, what needs the user (open questions, what is not yet in Notion), the next action.

### 15.5 Notion unreachable
The skill says so, works from the user's request, or from a taken task's saved record when the user names one, and writes records only. It can't list or take tasks it couldn't read, and it doesn't create tasks or write the overview. **The next run reconciles** (§10): operations stay pending, and the overview is written by the next session or catch-up.

### 15.6 A session that ends without closing
Nothing is lost that was saved: the item, its claim and its progress stay, its task stays Doing, and the next catch-up refreshes the overview from the folder and the records. The catch-up sets no status and releases no claim.

### 15.7 Acceptance (0.18.0)
On synthetic data:
1. A repo linked with the module off: 0.17.0's link, rollup and report; no `factories` entry.
2. A repo linked with the module on and connected: one message, its parts in order; the user writes a task by hand; a session lists it, agrees the how, takes it with no `UNKNOWN_TASK`; a second session's take is `TASK_TAKEN`.
3. The user sets Done while the agent's record says Doing: Done stays, with no question.
4. A session that ends without closing: the next catch-up rewrites the overview, and a second one writes nothing.
5. A folder that is not a repo: its row, its named plan files and no other file read.
6. A repo that serves two Projects in two Areas: one row, one Area, two Projects; its task under either Project raises no question in that Project's workflow.
7. A repo unlinked: its row archived, its tasks, knowledge and last overview kept; linked again, the same id.
