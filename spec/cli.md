# CLI Contract (v1)

**Status:** Draft for review (task CC-03)
**Applies to:** the `brain` CLI in `src/` (tasks CX-02 to CX-11).
**Depends on:** [schema.md](schema.md) (field names, file formats, apply rules). When this document and schema.md disagree on a file format, schema.md wins and this document is fixed.

Decisions referenced: 0003, 0006, 0007, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0021, 0023, 0024, 0026, 0027, 0041–0043, 0045, 0064, 0072, 0101.

**Eligibility (0077, 0.13.0):** what search, a full read, a summary, a citation and a proposal's evidence may rest on is one rule, in [eligibility.md](eligibility.md); where a section here differs, that file wins until the task it names (its §13) changes the section.

---

## 1. Scope

The CLI does the **deterministic** work: IDs, file writes, validation, index, views, applying decided proposals, and turning Notion snapshots into plans. The **skills** (Claude Code / Codex) do the judgment and the Notion I/O: they read minutes, extract knowledge, call the Notion MCP (0015), and call the CLI to write.

Rules for every command:
- **No network.** The CLI never calls Notion or any other service. Notion data enters only as JSON files written by a skill.
- **No Git, except `init`, `upgrade`, `repo`, `source extract` and `recover`.** Commands write files; the skill commits. `source extract` and `recover` commit and restore their own journaled files (§5.23, §5.24). `init` creates the repository and its first commit, `upgrade` commits its own files (§5.15), and `repo` reads a linked repo with read-only Git commands (§5.16, 0042). `status` reads the brain's own Git identity and `origin` with read-only Git commands for its `setup` block (§5.2, 0078). `repo new` runs `git init` in the repo it creates and makes its first commit there, and never pushes (§5.29). The `workflow` write commands commit their own records under `_workflows/` as one journaled operation, and never push (connected-workflows.md §12). `factory overview` commits its one change to `brain.json` the same way, and `factory read` reads a Factory's plan files, at `HEAD` with read-only Git when the folder is a linked repo (§5.39, 0113).
- **No LLM.** Same input and same brain give the same output, except for new random IDs and the clock (see `--now`).
- **Writes only inside the brain**, except `init` (the new brain folder, and the global config file with `--set-default`), `link` (three files in the target repo), `repo kit write` (`brain-kit.json` in a linked repo) and `repo new` (the new repo's folder) (§5.29, 0066), and `workflow new` and `workflow set --pointer` (the pointer `.brain-workflow.json` in the working folder, connected-workflows.md §3.2).

### 1.1 Skill commands vs CLI commands

Decision 0024 lists user-facing commands. Some are skills that call the CLI; some are CLI commands. Users ask agents for the skill; agents call the CLI.

| User-facing (0024) | Runs as | CLI commands it calls |
|---|---|---|
| `brain init` | CLI | `init` |
| "set up my brain" (0078) | skill `brain-setup` (CC-191, [setup.md](setup.md)) | `status`, `config set`, `modules`, `log` (`setup` lines), `schedule install`; and the calls of brain-connect-notion, Ultimate Assistant's ramble (seeding), brain-workflow-adopt and the ingest |
| `brain connect-notion` | skill (CC-08) | `config set`, `modules` (the onboarding checklist, 0048) |
| `brain ingest` | skill (CC-06) | `status`, `index`, `id new`, `note new`, `proposal new`, `views`, `lint`, `log`, `sync tasks`, `sync render`, `sync record`; the to-do tidy: `question drop` (0071); tracking a question or risk: `sync tasks --question`, `sync record` (0099, capture-and-review §6.4); a changed document checked before it goes in: `source check` (0098 §4, capture-and-review §12); from 0.17.0 (0101 §8), the minutes for a meeting with a transcript and none: `minutes check`, `log` (`minutes-written`), and a transcript file in the drop folder: `minutes row`, `log` (`meeting-file`) (capture-and-review §3.4.2, §3.4.3) |
| `brain apply`, "what needs my decision" (0096) | skill (CC-09) | `proposal list --waiting`, `apply` (decisions given in chat, capture-and-review §7), `index`, `views`, `lint`, `sync render`, `sync record`; once, the 0.16.0 migration's `sync plan --review-transition` and `sync apply` (§5.14.8), then `sync plan --questions-transition` and `sync apply` (§5.14.9) |
| `brain sync` | skill (CC-08) | `sync tracked` (the tracked tasks to read, 0101 §6), `sync snapshot` (the snapshot from the saved query replies, §5.14.10), `sync plan`, `sync apply`, `index`, `views`, `sync render`, `sync record` |
| `brain query` | skill (CC-10) | `query --candidates`, `query --read`, `index`; report mode (0043, 0045): `report new` (with `refresh`), `report fix`, `sync render`, `sync record` |
| catch up | skill (0037) | from 0.18.0 with Factories on, `factory list`, `factory read` and `factory overview` (§6); the calls of ingest, apply and sync, plus `proposal backlog` (once, 0041), `repo changes` and `repo record` (0042), `source diff` (re-reads, 0045). (`source full-text`, 0043, is retired in 0.6.0, 0049) |
| turn a module on or off (0048) | skill | `modules`, `config set` |
| `brain link` | CLI | `link` |
| link, show, change, unlink, check or start a repo (0066) | skill `brain-repos` (CC-104) | `repo kit check`, `repo kit write`, `repo add`, `repo refresh`, `repo show`, `repo health`, `repo tasks`, `repo unlink`, `repo new`, `link`; `repo record --reset` after a change that sets `reingest`; from 0.18.0 `factory list`, `modules on factories`, and for a folder's first overview `factory read` and `factory overview` (linked-repos.md §1) |
| `brain upgrade` | CLI | `upgrade` |
| `brain lint` / index | CLI | `lint`, `index` |
| `brain notion-change` | skill (CC-11) | none |
| run work as standard or connected (0059) | skill `brain-workflow` (CC-104) | `workflow new`, `find`, `show`, `set`, `resolve`, `item put`, `item claim`, `artifact put`, `render`, `op state`, `reconcile`, `summary`, `publish-history`; `note new`, `proposal new`, `sync render`, `sync record` for artifacts (connected-workflows.md §6.3); from 0.18.0, in a Factory: `modules`, `factory add`, `factory set`, `factory read`, `factory overview`, `sync render`, `sync record` for its row, `sync tasks --direct` and `link` (connected-workflows.md §3.5, §15) |
| adopt an existing project (0059) | skill `brain-workflow-adopt` (CC-104) | `workflow adopt preview`, `workflow adopt apply`, `repo tasks` (its parsing rules), `workflow reconcile` |
| tidy the brain: contradictions, duplicates, stale facts, themes (0052, 0076) | skill `brain-reflect` (CC-67, §6.2; also loaded by the Ultimate Assistant sub-agent) | `status`, `reflect --candidates`, `proposal list`, `proposal new`, `apply`, `id new`, `note new`, `index`, `views`, `lint`, `sync render`, `sync record`, `log` |
| review the structure of your work (0064, 0072) | skill `ultimate-assistant` (CC-109, [assistant.md](assistant.md)) | `status`, `repo tasks`, `assistant findings`, `assistant dismiss`, `proposal list`, `proposal new`, `apply`, `proposal settle`, `note new`, `sync tasks --direct`, `index`, `views`, `lint`, `sync render`, `sync record`, `log` |

---

## 2. Invocation

Until packaging (CX-12), run from the product repo:

```sh
node src/cli.ts <command> [options]                              # Node ≥ 23.6
node --experimental-strip-types src/cli.ts <command> [options]   # Node 22.6 – 23.5
```

After CX-12: `npx ultimate-brain <command>` or `brain <command>`. In this document `brain` means any of these.

---

## 3. Conventions

### 3.1 Global options

| Option | Meaning |
|---|---|
| `--brain <path>` | Brain directory (§4). Ignored by `init` |
| `--json` | Print exactly one JSON document (§3.3) on stdout. **Skills always pass it.** Without it, output is human-readable text, which is not part of this contract |
| `--now <timestamp>` | Use this ISO 8601 UTC timestamp (`2026-12-03T10:22:00Z`) as the current time. For tests and replays. Default: system clock. Every timestamp the CLI writes uses seconds precision with `Z` (`2026-12-03T10:22:00Z`), and every date is the UTC date of that time. Every timestamp the CLI **reads** (flags and JSON input, such as Notion's `last_edited`) may also carry fractional seconds (`2026-12-03T10:22:00.000Z`, as Notion returns them); the CLI truncates them to seconds before comparing or storing |
| `-h`, `--help` | Help for the CLI or a command. Exit 0 |
| `--version` | Print the installed package's `version` (from its `package.json`) and exit 0, without resolving a brain. Any command and other options given with it are ignored, except `--json`, which prints the success envelope (§3.3) with `command` `"version"`, `brain` `null` and `data` `{ "version": "0.3.1" }` |

Options can appear anywhere after the command name. Unknown options are a usage error (exit 2). Repeated single-value options: last one wins.

### 3.2 Input

Commands that take structured input read **JSON** from `--input <path>`, or from stdin when the value is `-`. UTF-8, one document. Input shapes are defined per command. Unknown keys in input are an `INPUT_INVALID` error, so typos are not silently dropped.

### 3.3 Output envelope (`--json`)

Success:
```json
{
  "ok": true,
  "command": "index",
  "brain": "/Users/me/brain",
  "data": { },
  "warnings": [ { "code": "DUPLICATE_ID", "message": "…", "path": "knowledge/people/maria.md" } ]
}
```

Failure:
```json
{
  "ok": false,
  "command": "note new",
  "brain": "/Users/me/brain",
  "error": { "code": "INPUT_INVALID", "message": "2 problems in input", "details": [ { "pointer": "/notes/0/frontmatter/date", "message": "must match YYYY-MM-DD" } ] }
}
```

- `ok` is `true` when the command **completed**, even if it found problems (lint errors, a drifted `--check`, some apply items failed). Findings are in `data` and the exit code is 1.
- `command` is the command path joined by a space (`"sync plan"`).
- `brain` is the absolute resolved brain path, or `null` when not resolved (e.g. `init`, resolution failed).
- `warnings` is always present (may be empty). Each has `code`, `message`, optional `path` and `id`. Commands that write notes (`note new`, `proposal new`, `apply`, `sync apply`) also list every lint warning in the files they wrote, including warnings those files already had, so the agent sees each written file's full state.
- Paths inside `data` are **relative to the brain root** with forward slashes, unless named `*_abs`.
- Diagnostics for humans go to stderr; nothing but the JSON document goes to stdout.

### 3.4 Exit codes

| Code | Meaning |
|---|---|
| 0 | Completed, nothing to report |
| 1 | Completed with findings: lint errors, `--check` found drift, at least one batch item `failed` |
| 2 | Usage error: unknown command or option, missing argument |
| 3 | Brain problem: not configured, not found, is the product repo, `brain.json` invalid, unsupported `schema_version` |
| 4 | Invalid input: unreadable or invalid JSON, schema violation, unknown ID, stale `before` |
| 5 | Refused: would overwrite a non-empty folder, write outside the allowed root, or clash with an existing brain |
| 10 | Internal error (a bug). The command restored any files it had replaced (§3.6) |

### 3.5 Error codes

| Code | Exit | When |
|---|---|---|
| `USAGE` | 2 | bad command line |
| `BRAIN_NOT_CONFIGURED` | 3 | no `--brain`, no `BRAIN_DIR`, no config file |
| `BRAIN_NOT_FOUND` | 3 | resolved path missing, or has no `brain.json` |
| `GIT_IDENTITY_MISSING` | 3 | `init`, and `upgrade` when it has something to commit: Git has no name or email to commit with; nothing is written (§5.1; 0.15.2; §5.15, 0103) |
| `BRAIN_IS_PRODUCT_REPO` | 3 | the resolved path itself contains `spec/cli.md` and `src/cli.ts` |
| `BRAIN_CONFIG_INVALID` | 3 | the global config, or `brain.json` where a command needs it (§4), fails its schema |
| `SCHEMA_VERSION_UNSUPPORTED` | 3 | `brain.json` `schema_version` ≠ 1 |
| `UNRELEASED_BUILD` | 3 | `upgrade` run from a source checkout of the CLI, not a published package (0038) |
| `INPUT_UNREADABLE` | 4 | input file missing or not JSON |
| `INPUT_INVALID` | 4 | input fails its shape or the note/proposal schema; `details` lists `{pointer, message}` (JSON Pointer into the input) |
| `UNKNOWN_ID` | 4 | an input refers to an ID that does not exist |
| `ID_IN_USE` | 4 | an input supplies an ID that already exists |
| `BEFORE_MISMATCH` | 4 | `proposal new` got a `before` that differs from the note's current value |
| `TARGET_NOT_EMPTY` | 5 | `init` target is non-empty and `--force` not given |
| `ALREADY_A_BRAIN` | 5 | `init` target already has `brain.json` |
| `OUTSIDE_ROOT` | 5 | a write would land outside its allowed root |
| `BRAIN_DIRTY` | 5 | `upgrade`: uncommitted work conflicts with what the upgrade would write; `details` lists every conflicting path, why and how to resolve it, and the unrelated paths it would leave alone (§5.15, 0103; before 0.16.1, any uncommitted change, 0038) |
| `GIT_OPERATION_IN_PROGRESS` | 5 | `upgrade`: Git is in the middle of a merge, cherry-pick, revert, rebase or bisect, or has unresolved conflicts; nothing is written (§5.15, 0103) |
| `BRAIN_CHANGED` | 5 | `upgrade`: a file it planned from, or Git's `HEAD` or uncommitted work, changed between planning and the first write; nothing is written, run it again (§5.15, 0103) |
| `UPGRADE_NOT_COMMITTED` | 5 | `upgrade`: Git refused the upgrade's commit (a hook, or `HEAD` moved); its writes were undone and the index is as before (§5.15, 0103) |
| `REPO_NOT_FOUND` | 4 | a `repo` command's repo isn't in `brain.json`, or its `path` isn't a Git working tree (0042) |
| `REPO_IS_BRAIN` | 4 | `repo add` was given the brain itself (0042) |
| `INSTRUCTIONS_SYMLINK` | 4 | `link`: the repo's `CLAUDE.md` is a symbolic link that doesn't resolve to its own `AGENTS.md` (§5.12) |
| `REPO_COMMIT_UNKNOWN` | 4 | a commit given to, or recorded for, a `repo` command doesn't exist in the repo, or isn't an ancestor of the commit it is compared with |
| `MODULE_OFF` | 4 | a command needs a module that `brain.json` `modules` turns off (0048, schema §12): `sync tasks` with Tasks off; from 0.18.0 the `factory` write commands, `factory read` and a Factory's workflow with Factories off (§5.39, connected-workflows.md §12) |
| `KIT_MISSING` | 4 | a `repo` command needs a linked repo's `brain-kit.json` and there is none; or `kit write --replace` names a kit that isn't there (§5.29) |
| `KIT_INVALID` | 4 | a link kit fails its schema or a check of linked-repos.md §2.2; `details` lists `{pointer, message}` (§5.29) |
| `KIT_EXISTS` | 4 | `kit write` without `--replace` found a `brain-kit.json` (§5.29) |
| `KIT_CHANGED` | 4 | `kit write --replace` names a hash that isn't the current kit's: it changed since the user saw it (§5.29) |
| `NO_KIT` | 4 | `repo tasks` on an entry linked without a kit, or `repo refresh` on one whose repo has no kit file, without `--path` (§5.29) |
| `MODE_CONNECTED` | 4 | `repo tasks` on a repo whose tasks are connected to Notion (§5.29) |
| `NO_TASKS` | 4 | `repo tasks` on a kit without `tasks` (§5.29) |
| `CONFIRMATION_REQUIRED` | 4 | `kit write` or `repo new` without `--confirm` (§5.29, linked-repos.md §3) |
| `CONFIRMATION_MISMATCH` | 4 | `--confirm` isn't the hash of the kit bytes the command would write (§5.29) |
| `STALE_RECORD` | 4 | a workflow record changed since the caller read it (`--rev`, or a change between the command's read and write); nothing is written (connected-workflows.md §10.1) |
| `CLAIMED` | 4 | `workflow item claim` on an item another session holds; `details` `{ holder }` (§10.1) |
| `NOT_APPROVED` | 4 | `workflow item claim` on an item whose scope and criteria aren't approved (§7) |
| `DESTINATION_TAKEN` | 4 | `workflow new` for a destination, or a linked repo, that an open workflow already has (§3.1); from 0.18.0 `workflow set` with a Factory that has one (§3.5) |
| `TASK_TAKEN` | 4 | `workflow item put` with `task`: another work item, or another clone's, holds that task; `details` `{ workflow, item, holder }`, each `null` when unknown here (connected-workflows.md §8.4; 0.18.0) |
| `FACTORY_NOT_FOUND` | 4 | a `factory` command's id or name is no entry of `brain.json` `factories` (§5.39; 0.18.0) |
| `FACTORY_EXISTS` | 4 | `factory add`: the folder is a linked repo, or a Factory that isn't archived has it, or the name is another entry's (§5.39; 0.18.0) |
| `POINTER_EXISTS` | 4 | `workflow new` in a folder whose pointer names an open workflow (§3.1) |
| `WORKFLOW_NOT_FOUND` | 4 | a `workflow` command names no workflow in the brain (§12) |
| `WORKFLOW_ENDED` | 4 | a `workflow` command other than `find` and `show` on an ended workflow (§12) |
| `BRAIN_BUSY` | 5 | Git's index stayed locked for 10 seconds; run the command again (connected-workflows.md §10.1) |
| `RETIRED` | 2 | a command retired in this version (`source full-text`, 0049; `proposal revise`, 0096); the message names what replaces it |
| `QUESTIONS_RETIRED` | 4 | `sync plan --questions-transition` on a brain whose `brain.json` has no `notion.databases.questions`: the Questions database was archived by the 0.16.0 migration, or the space never had one, and its rows are not read again (0099 §8, §5.14.9) |
| `REVIEW_RETIRED` | 4 | `sync plan --review-transition` on a brain whose `brain.json` has no `notion.databases.review`: the Review database was archived by the 0.16.0 migration and its rows are not read again (capture-and-review §7.9, §5.14.8) |
| `WRITE_CONFLICT` | 5 | a file appeared at a path the command was creating, after it read the brain (another writer). Nothing is kept (§3.6); re-run the command |
| `AGENT_NOT_FOUND` | 3 | `schedule install` found no executable of the brain's agent (`claude`, or `codex` from 0.17.0) on `PATH` to schedule (0051, 0110 §9, §5.21); it replaces `CLAUDE_NOT_FOUND`, with the same exit code |
| `BRAIN_NOT_GIT` | 3 | `schedule install` with agent `codex` in a brain folder that is not a Git working tree: `codex exec` refuses to run there (§5.21; 0.17.0) |
| `SCHEDULE_NOT_SET` | 4 | `schedule install` with no job while `settings.schedule` isn't an object: there is no schedule in the brain to install (§5.21; 0.17.0) |
| `CLEANUP_OFF` | 4 | `cleanup apply` while `settings.cleanup.auto` is `off`: nothing is applied alone (§5.38; 0.17.0) |
| `NOT_A_CLEANUP` | 4 | `cleanup undo` on a proposal that the clean-up didn't apply alone, or whose commit isn't found (§5.38; 0.17.0) |
| `ALREADY_UNDONE` | 4 | `cleanup undo` on a clean-up already undone (§5.38; 0.17.0) |
| `UNDO_STALE` | 5 | `cleanup undo`: a file the clean-up wrote changed since; `details` lists each; nothing is written (§5.38, weekly-review.md §15.3; 0.17.0) |
| `SKILL_MISSING` | 3 | `schedule install` for a job whose skill the brain doesn't have (`catch-up` without brain-catch-up) |
| `SKILLS_PIN_INVALID` | 3 | the brain's `skills.lock.json` is invalid (§5.28) |
| `SKILLS_INCOMPATIBLE` | 3 | the brain's pinned skills exclude the running CLI (§5.28) |
| `SKILLS_SNAPSHOT_MISSING` | 3 | a pinned skill's `SKILL.md` is missing from a tree; for `link`, a pinned file it copies is missing or differs (§5.28) |
| `SKILLS_SNAPSHOT_INVALID` | 3 | the package snapshot is invalid or excludes the running CLI (`init`, `upgrade`, `link` on an unpinned brain), or a released snapshot changed content under the same version (`upgrade`) (§5.28) |
| `SKILLS_DOWNGRADE` | 5 | `upgrade` would lower the pin's version under the same snapshot name (§5.28) |
| `RECOVERY_NEEDED` | 5 | an interrupted multi-file write left `_journal/<op>.json`: every command except `recover` refuses until `brain recover` ran (capture-and-review §7.11) |
| `DISMISSALS_UNREADABLE` | 5 | `_assistant/dismissals.json` cannot be read or fails its schema: `assistant findings` and `assistant dismiss` refuse rather than show skipped findings again or replace the file (`lint` flags it; [assistant.md](assistant.md) §8) |
| `WEEKLY_STATE_UNREADABLE` | 5 | `_weekly/state.json` cannot be read or fails its schema: `weekly plan` and `weekly record` refuse rather than show every finding again or replace the file (`lint` flags it; [weekly-review.md](weekly-review.md) §9.5; 0.15.0) |
| `WEEKLY_TOO_LONG` | 4 | `weekly record`: the report's body is over 450 words, the header and link targets not counted; nothing is written, and the skill shortens its own prose ([weekly-review.md](weekly-review.md) §3.4; 0.15.0) |
| `SUPPRESSIONS_UNREADABLE` | 5 | a `_suppressions/` record cannot be read or is malformed: `query`, `views`, `source extract` and `source cleanup-plan` refuse rather than treat the brain as unrestricted, and never replace the damaged file (`status` reports it, `lint` flags it; capture-and-review §5.3) |
| `DIRTY_TREE` | 5 | `source extract`, and from 0.17.0 `cleanup apply` and `cleanup undo`, and from 0.18.0 `factory overview` with `--written`, found the brain not a Git work tree, or with uncommitted changes and no journal |
| `FILE_ALREADY_A_ROW` | 4 | `minutes row`: a `meeting-file` log line already holds the file's hash; `details` `{ page }` names its row (§5.37) |
| `INTERNAL` | 10 | unexpected failure |

Batch commands (`note new`, `proposal new`, `apply`, `sync apply`) also report **per-item** results with their own `reason` codes, listed under each command.

### 3.6 Write safety

1. **Validate, then write.** A command builds every file it will write in memory and validates it (schema + the lint rules that concern those files) before the first write.
2. **Atomic files.** Each file is written to a temp file in the same directory and renamed (CX-02 `fs-safe.ts`).
3. **Atomic batches.** `note new` and `proposal new` write all items or none. `apply` and `sync apply` are atomic **per item** (schema §11.2): an item's writes all land or none do; other items still proceed. If a write fails mid-way, the command restores the files it had already replaced, from in-memory originals, and deletes the files it had created.
4. **Containment.** Each command has one allowed root (the brain, except `init`, `link`, and `init --set-default`). Paths are resolved (symlinks included) before writing; anything outside → `OUTSIDE_ROOT`.
5. **Format (normative, so golden files and source hashes are stable).**
   - Files are UTF-8 with LF line endings and end with exactly one newline.
   - Frontmatter is serialized with the `yaml` package (v2), YAML 1.2 core schema, options `{ lineWidth: 0, flowCollectionPadding: false }`. Mappings and lists of mappings use block style. **Lists of scalars use flow style** (`projects: [prj-9x4t1b7e]`), and an empty list is `[]`. Strings are plain unless the library must quote them.
   - **Key order for new notes:** `id`, `type`, `title`, `summary`, `lifecycle`, then the type's own fields in the order of their table in schema §4, then `aliases`, `tags`, `area`, `projects`, `sources`, `relations`, `facts`, `timeline`, then `created`, `updated`, then `notion`, `last_synced`, `notion_fields`, `notion_published`. A key listed twice (e.g. `area` for goals and projects) takes its first position. **Sources** follow their table in schema §4, except that `summary` and `digest` take their positions after `title`, and the system fields go last in the order `notion_text`, `notion_parts`, `notion_text_requested`, `notion`, `last_synced`, `notion_published`, `tasks`. **Views** follow their table in schema §4. **Proposals** follow the order of the schema §11 example: `id`, `type`, `title`, `created`, `updated`, then the fields of the §11 table in order, then `notion`, `notion_published`. Absent keys are skipped. A key a command adds to an existing file goes at the position this order gives it among the keys present; existing keys never move and unknown keys are kept (CX-02 round-trip).
   - **Body separator:** a new note is written as `---\n<frontmatter>---\n\n<body>` (one blank line before the body), except a **source**, which is `---\n<frontmatter>---\n<body>`, so its `content_hash` covers exactly the body given. A note with an empty body (proposals) ends right after the closing `---\n`.
   - The CX-02 serializer (`src/lib/frontmatter.ts`) is brought in line with these rules by CX-06, the first task that edits existing notes.
6. **`updated` (one rule).** Every command that changes a note's content sets `updated` to today (the UTC date of `--now`), whatever date the change was decided or observed. Changes to system fields only (`notion`, `last_synced`, `tasks`, `notion_fields`, `notion_published`) do not change `updated`.
7. **Array order in output.** Unless a command says otherwise, path lists (`created`, `changed`, `written`) are sorted by path, and item lists follow input order.

### 3.7 What counts as a note

The CLI scans these folders under the brain root: `areas/` (with `areas/briefs/`), `domains/`, `goals/`, `projects/`, `archive/`, `knowledge/`, `sources/`, `reports/`, `memories/`, `_proposals/`. Every `*.md` file there must have frontmatter with an `id` (lint error `not-a-note` otherwise). Files elsewhere (root `AGENTS.md`, `CLAUDE.md`, `README.md`, `index.md`, `log/`, dot-folders) are not notes.

### 3.8 Slugs and paths for new files

Slug of a title: Unicode NFKD, drop combining marks, lowercase, replace every run of characters outside `[a-z0-9]` with `-`, trim `-` at both ends, and if longer than 60 characters, keep the first 60 and then, if they contain a `-`, drop everything from the last `-` on (so a word is never cut in half); use `note` if the result is empty. `"María López — PM"` → `maria-lopez-pm`.

Path by type (schema §2). Dated types use the note's `date`, else `file_date` from input, else `created`:

| Type | Path |
|---|---|
| area, goal | `areas/<slug>.md`, `goals/<slug>.md` |
| project | `projects/<slug>/project.md` |
| person, org, question | `knowledge/people/<slug>.md`, `knowledge/orgs/…`, `knowledge/questions/…` (concepts are learned references since 0.9.1, 0071) |
| meeting, decision | `knowledge/meetings/<date>-<slug>.md`, `knowledge/decisions/<date>-<slug>.md` |
| source | `sources/notion/<date>-<slug>.md` for a `notion:` key, `sources/files/…` for `file:`, `sources/text/…` for `url:` and `agent:` (0032) |
| memory | `memories/<YYYY>/<MM>/<date>-<slug>.md` |
| view | `projects/<slug>/brief.md` and `decision-log.md`; `areas/briefs/<area file slug>.md` (`area_brief`); `reports/<date of generated_at>-<slug of title>.md` (`report`) |
| proposal | `_proposals/<created>-<slug>.md` |

If the path exists (for projects: the folder), append `-2`, `-3`, … to the slug until it is free.

### 3.9 Log lines

Write commands append to `log/<YYYY-MM>.md` (month of `--now`), creating it with the first line `<!-- GENERATED by brain. Append-only. -->` and a blank line. One line per item written (schema §13):

```text
- <timestamp> <op> <id> "<title>"[ <key>=<value>]…
```

`"` and `\` in titles are escaped with `\`, and CR and LF become `\r` and `\n`, so every entry is exactly one line. Values with spaces, quotes, backslashes or line breaks are quoted and escaped the same way. The file is created exclusively with its header, then lines are appended; an unreadable log is an error, never a reason to start the file over. Ops written by the CLI (`correct`, a correction sync applied up to 0.15.x, is history): `init`, `note-new`, `proposal-new`, `apply`, `sync-create`, `sync-update`, `upgrade`, `repo-add`, `repo-record`, `full-text` (before 0.6.0), `modules`, `report-new`, `report-refresh`, `report-fix`, `question-drop`, `sync-question` (the 0.16.0 read-back, §5.14.9), `assistant-dismiss`, `weekly-corrections` (0.15.0, §5.34). Skills add their own (`ingest`, `publish`, `catch-up`, `query`, `assistant`, `reflect`, `setup`; from 0.17.0 `minutes-written` and `meeting-file`, which `minutes check` and `minutes row` read, §5.36, §5.37; `weekly` is written by `brain weekly record`, weekly-review.md §9.2) with `brain log` (§5.11). `setup` lines are setup.md §4.1's, and `brain status` reads them (§5.2). `index` and `views` do not log.

**The clean-up lines (0.17.0, weekly-review.md §15, §5.38).** Each mechanical item applied alone logs `tidy <proposal id> "<title>" tidy=<pair_half|moved_link|repeated_value|exact_duplicate|stale_draft>` in its own commit; an undo logs `tidy-undo <proposal id> "<title>" restored=<n>`; `cleanup ticks` logs `weekly-ticks - week=<YYYY-Www> applied=<n> declined=<n> open=<n> stale=<n> waiting=<n> undone=<n> skipped=<n>`.

**The Factory lines (0.18.0, §5.39).** `factory-add`, `factory-set` and `factory-archive` log `<op> - "<name>" factory=<fac id>`; `factory overview --written` logs `factory-overview - "<name>" factory=<fac id> by=<session|catch-up>` when it records a new text. `repo add`, `repo unlink` and `modules on factories` log their own lines only.

**The catch-up line (0045, 0051).** An attended catch-up logs `catch-up - notes_read=<n> seconds=<s>`. An unattended one (§6.1) logs `catch-up - mode=unattended inputs=<n> left=<n> skipped=<n> waiting=<n> failed=<n>[ failures="<reason>; <reason>"] report=<yes|no> notes_read=<n> seconds=<s>`: `inputs` taken in (failed ones included), `left` the inputs beyond the budget, `skipped` the inputs skipped for a blocker, `waiting` the report What to fix left for an attended run and the proposals the run wrote that wait for a decision in the session (capture-and-review §7.4), `failed` the steps that failed, `failures` their reasons in a few words each ("Notion login"), `report` whether it wrote a Report row. A `catch-up` line without `mode=unattended` is attended, as every line before 0.7.0 is. `brain status` reads these lines (§5.2).

---

## 4. Brain resolution

Every command except `init` resolves the brain in this order (CX-02 `brain-path.ts`, 0014):

1. `--brain <path>`
2. `BRAIN_DIR` environment variable (non-empty)
3. `~/.config/ultimate-brain/config.json` → `{"brain": "<path>"}` (`~` expanded; relative paths resolved against the config file's folder)

The first one present wins; later ones are not consulted even if the first is invalid. There is **no** discovery from the current directory. Then:

- path missing, not a directory, or no `brain.json` → `BRAIN_NOT_FOUND`
- the path itself contains both `spec/cli.md` and `src/cli.ts` → `BRAIN_IS_PRODUCT_REPO`. Only the path itself is checked, so a test fixture brain inside the product repo (`tests/fixtures/brain-acme/`) resolves normally
- `brain.json` is not a JSON object → `BRAIN_CONFIG_INVALID`; `schema_version` ≠ 1 → `SCHEMA_VERSION_UNSUPPORTED`

Resolution does not run the full [brain.schema.json](schemas/brain.schema.json) check, so `lint` can still report a bad `brain.json` (rule `brain-config`). Commands that use a section of it (`config set`, `sync …`, `status` for `notion`) validate the whole file first and fail with `BRAIN_CONFIG_INVALID`.

Global config schema: `{"brain": string}`, no other keys.

---

## 5. Commands

Each command lists: synopsis, behavior, `data` shape, an example, and errors beyond the common ones in §3.5. Examples use the synthetic Acme brain from `spec/examples/`. Envelopes are abbreviated to `data` where obvious.

### 5.1 `brain init`

```text
brain init <path> [--owner <name>] [--force] [--no-git] [--set-default]
```

Creates a brain from `templates/brain/` (CC-02, CX-03).

**The path and the home folder (0.15.2, 0097 §3).** A `<path>` that is `~` or starts with `~/` (or `~\` on Windows) has its `~` replaced by the user's home folder, whatever the shell did with it: Windows PowerShell 5.1 passes `~/brain` through unchanged. Any other `~` (`~alex/brain`, `a/~/b`) is kept as written. The home folder, here and for `--set-default`, is Node's `os.homedir()` (`HOME` on macOS and Linux, the user's profile folder on Windows), never the `HOME` variable read directly, which Windows doesn't set; tests inject it.

0. **Git identity (0.15.2, 0097 §3).** Unless `--no-git`, and when Git is found (`git --version`), check that Git can commit in a new repository: `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT` both succeed, run outside any repository (in a new empty temporary folder), so they read what a new repository reads: the environment, the global and the system configuration. Either fails → `GIT_IDENTITY_MISSING` before anything is checked or written, the `<path>` folder not created. The human message:

   ```text
   Git doesn't know your name and email yet, and the brain saves every change with them. Run these two lines, with your own name and email:
     git config --global user.name "Your Name"
     git config --global user.email "you@example.com"
   Then run the same brain init command again. Nothing was written.
   ```

   Git not found keeps step 6's warning (unchanged): a missing Git is setup's prerequisite (setup.md §6.1), not `init`'s.
1. Refuse if `<path>` is the product repo (`BRAIN_IS_PRODUCT_REPO`) or already has `brain.json` (`ALREADY_A_BRAIN`, even with `--force`).
2. If `<path>` exists and is non-empty: refuse with `TARGET_NOT_EMPTY` unless `--force`. With `--force`, template files whose path already exists are **left untouched** and listed in `skipped`; nothing is ever overwritten.
   Then the package snapshot (skills-delivery §2.3) must be compatible with the running CLI, else `SKILLS_SNAPSHOT_INVALID` (§5.28) and nothing is written. A `<path>` that doesn't exist yet is refused before it is created.
3. Copy the template. npm never packs files named `.gitignore`, so the template stores it as `templates/brain/gitignore` and `init` writes it to the new brain as `.gitignore` (reported in `created` under that name; a `--force` run skips it like any other existing file). `templates/brain/gitattributes` is written as `.gitattributes` the same way (0.15.2, decision 0097): its line `* text=auto eol=lf` keeps every text file LF in the working tree on every system, as §3.6 rule 5 requires, so Git on Windows doesn't check notes out with CRLF. Write `brain.json` from the template with `schema_version: 1` and `owner.name` = `--owner` (default: the `user.name` from `git config`, else `"Owner"`).
   The template includes `.claude/agents/ultimate-assistant.md`, the Ultimate Assistant sub-agent ([assistant.md](assistant.md) §10): product-owned, copied like every template file.
   Copy every skill of the package snapshot, its listed files only, to `<path>/.agents/skills/` (Codex) and to `<path>/.claude/skills/` (Claude Code) (0029, 0038, 0059); `snapshot.json` and the snapshot's optional top-level files are not copied. Write `skills.lock.json` (skills-delivery §3) with `installed_by` = the running version. All are product-owned and listed in `created`; with `--force`, existing files, the lock included, are skipped like template files, and the result can be any pin state.
4. Run `index` (an empty index).
5. Log `- <timestamp> init - "<owner name>" schema=1` (no machine paths in the log).
6. Unless `--no-git`: `git init`, add all, commit `init: ultimate brain (schema v1)`, so the new brain starts clean. If Git is missing or the commit fails for another reason (step 0 already refused a missing identity), keep the files, skip the commit and add warning `GIT_COMMIT_SKIPPED`.
7. With `--set-default`: write `~/.config/ultimate-brain/config.json` = `{"brain": "<abs path>"}`, `~` being the home folder above (on Windows `C:\Users\<name>\.config\ultimate-brain\config.json`), replacing any existing one (its old value is reported).

```sh
brain init ~/brain --owner "Alex" --set-default --json
```
```json
{ "ok": true, "command": "init", "brain": "/Users/me/brain", "warnings": [],
  "data": {
    "path_abs": "/Users/me/brain",
    "created": [".gitignore", "AGENTS.md", "CLAUDE.md", "brain.json", "index.md", "log/2026-12.md"],
    "skipped": [],
    "git": { "initialized": true, "committed": true },
    "default_config": { "written": true, "path_abs": "/Users/me/.config/ultimate-brain/config.json", "previous": null },
    "skills": { "state": "pinned", "name": "ultimate-brain", "version": "0.9.0", "competing": [] }
  } }
```

`skills` is computed after the writes as `status` computes it (§5.28): `state`, and `name` and `version` from the lock on disk (`null` when `unpinned` or `invalid`), and `competing` for the installed snapshot's skills (skills-delivery §5.2), with warning `SKILLS_COMPETING` when it is non-empty; `init` never refuses because of it.

`created` lists every file written, sorted by path, including the `.gitkeep` placeholders of the empty note folders; the example above is shortened.

**Human output** (without `--json`): what was made, then **one next step** (0078 §2, from 0.14.0; before, CC-156's two steps named the checklist under `product.path`). It names no path under `product.path`: the setup skill gives the Notion template and every guide (setup.md §1).

```text
Initialized Ultimate Brain at /Users/me/brain
Next: open Claude Code or Codex in /Users/me/brain and say "set up my brain"
```

Errors: `GIT_IDENTITY_MISSING`, `TARGET_NOT_EMPTY`, `ALREADY_A_BRAIN`, `BRAIN_IS_PRODUCT_REPO`, `SKILLS_SNAPSHOT_INVALID`, `OUTSIDE_ROOT` (template path escapes, defensive).

### 5.2 `brain status`

```text
brain status [--tasks-schema <file|->]
```

Read-only health summary; the first call of every skill.

```json
{ "data": {
    "schema_version": 1,
    "owner": "Alex",
    "notes": { "area": 2, "project": 3, "person": 7, "org": 2, "meeting": 12, "decision": 9, "question": 4, "source": 12, "view": 6, "goal": 1, "memory": 0, "reference": 1 },
    "proposals": { "pending": 3, "approved": 0, "edited": 0, "rejected": 0, "applied": 14, "closed": 2 },
    "notion": { "configured": ["areas", "goals", "projects", "meetings", "people", "orgs"], "missing": ["key_results", "inbox", "documents"], "tasks_database": true },
    "tasks_status_note": null,
    "settings": { "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 } },
    "modules": { "orgs": true, "documents": true, "reports": true, "tasks": true, "planning": true },
    "schedule": { "recorded": true, "runner": "system", "agent": "claude", "model": "claude-sonnet-5-5", "platform": "darwin",
                  "jobs": { "catch-up": { "slot": { "at": ["07:30"], "days": null }, "installed": true, "matches": true },
                            "weekly-review": { "slot": { "at": ["08:00"], "days": ["mon"] }, "installed": false, "matches": null } } },
    "unattended": { "catch_up": { "since": "2026-12-01T18:02:00Z", "runs": 4, "inputs": 6, "failed": 1, "failures": ["Notion login"], "left": 0, "skipped": 1, "waiting": 1, "last": "2026-12-03T07:00:00Z" }, "backlog": false },
    "repos": [ { "name": "acme-api", "area": "area-2m7c4h8n", "commit": "", "found": true } ],
    "index_stale": false,
    "views_stale": ["projects/acme-website/brief.md"],
    "suppressions": { "active": 0, "reconciled": 0, "restricted_notes": 0, "unresolved_lineage": 0, "problems": [] },
    "last_log": "- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w \"Acme sync\" created=4 proposals=3",
    "skills": { "state": "pinned", "name": "ultimate-brain", "version": "0.9.0", "…": "§5.28" },
    "product": { "path": "/usr/local/lib/node_modules/ultimate-brain" },
    "setup": {
      "checks": { "git_identity": true, "remote": true, "databases": true, "drop_folder": true, "language": true, "owner_person": true },
      "recorded": { "notion-mcp": "2026-12-01T09:12:00Z", "minutes-prompt": null, "brain-assistant": null, "seeding": null, "first-value": null, "schedule": null },
      "first_value": null,
      "template_version": "0024",
      "required": { "done": 7, "total": 9 },
      "next": "minutes-prompt",
      "finished": false,
      "drop_folder": { "proposed": "~/Documents/brain-dropbox/", "exists": false, "default_read_by": null, "others": [] }
    },
    "branch": { "working": "main", "from": "origin-head", "current": "add-notes", "on_working": false, "unmerged": [ { "branch": "add-notes", "commits": 2 } ] }
} }
```

`skills` (always present, 0059) is the brain's skill pin, defined in §5.28. `status` is exempt from the pin guard, so it reports every state.

`weekly_snapshot` (always present, 0.15.0) is the absolute path where the weekly review's skill writes its Notion snapshot: `~/.ultimate-brain/weekly/<folder>-<hash>.json` with `~` expanded to the user's home directory, e.g. `/Users/sam/.ultimate-brain/weekly/brain-1a2b3c4d.json`; `<folder>-<hash>` is as in a schedule label (§5.21), so the label of the brain's `weekly-review` schedule ends in the same `<folder>-<hash>` (§5.34, weekly-review.md §1 step 2). The weekly job's allow rules write `~/.ultimate-brain/weekly/**`, and Claude Code expands their `~` to the same home, so they name this file. `status` only names it: it neither reads nor creates it.

**The schedule (0.17.0, decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §7).** `schedule` (always present) is computed offline from `settings.schedule` (schema §12) and this computer's entries, read as `brain schedule list` reads them but without calling a scheduler: the plists in `~/Library/LaunchAgents` (or `UB_LAUNCH_AGENTS_DIR`) on macOS, the local copies in `%LOCALAPPDATA%\ultimate-brain\tasks` (or `UB_WINDOWS_TASKS_DIR`) on Windows (§5.21).
- `recorded`: `true` when `settings.schedule` is an object; then `runner`, `agent` and `model` are its own (`runner` `system` when absent). With the string `on` or `off`, or no key, `recorded` is `false` and the three are `null`.
- `platform`: `darwin`, `win32` or `other` (`UB_SCHEDULE_PLATFORM` overrides it, as in §5.21).
- `jobs`: one entry per job of §5.21, each `{ slot, installed, matches }`. `slot` is the object's slot for the job as `{ "at", "days" }` (`days` `null` for every day), `"off"`, or `null` when the object has no slot for it or isn't an object. `installed` is whether this computer has the brain's entry for the job (`null` elsewhere, where cron lines are the user's). `matches` is whether that entry's agent, model, times and days equal the slot (`null` when either is missing).

The skill turns it into one line only when it asks something of the user: a slot not installed on this computer (`installed` `false`), an entry that doesn't match (`matches` `false`), or `on` with `recorded` `false`: `Your schedule isn't installed on this computer: say "schedule my brain".` (or `isn't in the brain yet` for `recorded` `false`). Nothing when the schedule is off or installed as recorded. A brain scheduled on another computer is installed there, not here: the line names this computer only, and the skill says so (§5.21: one computer at a time).

`product.path` (always present) is the absolute, symlink-resolved folder of the installed `ultimate-brain` package that is running: the folder holding its `package.json`, or the product repo's root when the CLI runs from source. The Notion build files ship under it, so a skill or a message names them as `<product.path>/<file>`: `notion/CHECKLIST.md`, `notion/prompts/`, `notion/modules/`, `notion/migrations/`, the other `notion/*.md` guides, and `docs/notion-space-design.md`.

**Setup (0078, [setup.md](setup.md) §5).** `setup` (always present) is computed offline: no network call, Git read only through `git config` and `git remote get-url origin` in the brain folder (`branch`, below, reads Git through its own commands).
- `checks`: the six offline checks of setup.md §5 (`git_identity`, `remote`, `databases`, `drop_folder`, `language`, `owner_person`), each `true` or `false`.
- `recorded`: for each step only an online or by-hand check proves (`notion-mcp`, `minutes-prompt`, `brain-assistant`, `seeding`, `first-value`, `schedule`), the timestamp of its latest `setup` log line (§3.9) when that line has `result=done` or `result=declined`, else `null`; from 0.17.0 a `schedule` line with `reason=schedule-unsupported` (Windows before 0.17.0, setup.md §7) is not counted, so such a brain is offered the schedule; read across the month files like `unattended`. For `first-value` the latest line must also pass (setup.md §5, §10): `report`, `organised` and `answer` each `pass`, and `tasks` `pass`, or `skip` while the Tasks module is off. A `result=done` line with a `fail` or without one of the four checks (CC-188's form) leaves it `null`: first value is unresolved, and `next` stays `first-value`.
- `first_value`: the latest `first-value` line, `{ "at": <its timestamp>, "tasks": …, "report": …, "organised": …, "answer": … }`, each check `pass`, `fail`, `unsuitable`, `skip` (`tasks` only, setup.md §4.1) or `null` (not run yet: the line leaves it out; any other value, `skip` on another check included, is reported as `fail`); `null` when there is no `first-value` line. The skill reads it to resume only the checks not passed, and compares `at` with the latest `seeding` line to run all four again after new seeding (setup.md §3).
- `template_version`: `notion.template_version`, or `null` when absent (unknown, setup.md §9).
- `required`: read from the latest `setup` line with `step=prerequisites` (setup.md §13). From 0.17.0, when that line has a `credits` key: `minutes-prompt` is **taken** when its `meetings` list holds `notion-ai`, and `brain-assistant` when `credits=yes`. A line without `credits` (before 0.17.0): both are taken unless it has `notion_ai=no`; with no `prerequisites` line, both are taken. `total` is 7 plus each step taken (7, 8 or 9); `done` counts the six checks that pass plus `notion-mcp` when recorded and each step taken that is recorded.
- `next`: the first item not done, in setup.md §2's order: `git_identity`, `remote`, `drop_folder`, `language` (step 2), `notion-mcp` (3), `databases` (4), `minutes-prompt`, `brain-assistant` (4a, 4b; each left out when it isn't taken, above), `owner_person` (5), `seeding`, `first-value`, `schedule`; a check is done when it passes, a step when it is recorded. `null` when every item is done.
- `finished`: `true` when a `setup` line with `step=finished` exists, or when the brain has no `setup` line and `databases` and `owner_person` pass (a brain connected before 0.14.0, which may lack the `Language:` and `Drop folder:` lines). `required` and `next` are computed the same either way; with `finished` true they are information only.
- A `setup` line with `step=first-meeting` (brain-catch-up, setup.md §10.1) is not read.
- `drop_folder` (CC-259, setup.md §7 item 4): the drop folder the settings screen proposes, so no two brains on a machine read one folder. `others` lists each **other brain the machine knows** that has a drop folder, as `{ "brain": <absolute folder>, "folder": <absolute drop folder> }`, sorted by `brain`: the default brain (`brain` in `~/.config/ultimate-brain/config.json`, §4, resolved as §4 resolves it) and the brain of each scheduled job (the `brain` of the `ultimate-brain` key of each `eu.ultimate-brain.*.plist` in `~/Library/LaunchAgents`, or `UB_LAUNCH_AGENTS_DIR`, and on Windows of the Description of each local copy `eu.ultimate-brain.*.xml` in `%LOCALAPPDATA%\ultimate-brain\tasks`, or `UB_WINDOWS_TASKS_DIR`, §5.21); this brain itself is left out, and so is one whose folder or `AGENTS.md` can't be read, or whose `AGENTS.md` has no `Drop folder:` line (read as setup.md §5's check reads it, relative to that brain's folder). Each path is symlink-resolved when it exists, and an unreadable or invalid `config.json` or plist adds nothing, never an error. `proposed` is the first of `~/Documents/brain-dropbox/`, `~/Documents/<slug>-dropbox/`, `~/Documents/<slug>-2-dropbox/`, `~/Documents/<slug>-3-dropbox/` … that no entry of `others` reads, where `<slug>` is this brain's folder name as a slug (§3.8; `brain` when empty), written with `~/` and a trailing `/`; a candidate equal to one before it is skipped. `exists` says whether `proposed` is an existing folder. `default_read_by` is the `brain` of the first entry of `others` that reads `~/Documents/brain-dropbox/`, else `null`. `drop_folder` is computed the same whether or not this brain has a `Drop folder:` line; the skill uses it only when it has none, or when the user changes the folder.

**The working branch (0086 §1, §2).** A brain is worked on one branch, its **working branch**. Every write to a brain is committed on it and pushed per `settings.push`; no agent creates a branch, a worktree, a pull request or a merge request in a brain, and no step asks the user to merge on GitHub. The rules block's "Write path" (`templates/brain/AGENTS.md`, CC-236) says so whatever an agent's habits or the user's global instructions say, and reaches existing brains through `brain upgrade` (§5.15). A linked repository keeps its own branches and pull requests (0059, 0066); the memory it writes to the brain ([memory.md](memory.md)) is committed on the brain's working branch. `branch` is computed offline, reading Git only through the commands named here, run in the brain folder. It is `null`, with no warning, when the brain is not itself a Git repository (the test of `checks.remote`: `git rev-parse --show-toplevel` is not the brain folder, or fails). Otherwise:
- `working` is the first of these that applies, and `from` says which:
  1. `origin-head`: `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` names `origin/<b>` and the local branch `<b>` exists. Setup sets it when it creates the backup, and "fix my backup" when it is missing (setup.md §7, §15), so every brain set up from 0.14.0 is found this way, with or without a fetch.
  2. `only-branch`: exactly one local branch exists (`git for-each-ref --format=%(refname:short) refs/heads`): that one. A brain made by `brain init`, with no remote yet, is found this way.
  3. `main`: several local branches, one of them `main`; else `master`: one of them `master`.
  4. `unborn`: no local branch yet (a repository with no commit): the branch `HEAD` names (`git symbolic-ref --short HEAD`). `current` is that name, `on_working` is `true` and `unmerged` is empty.
  5. Else `working` and `from` are `null`: several branches, none of them `main` or `master`, and no `origin/HEAD`.
- `current`: the branch checked out (`git symbolic-ref --quiet --short HEAD`), or `null` when `HEAD` is detached.
- `on_working`: `current` is non-null and equals `working`. A detached `HEAD` is never on it, even at the working branch's commit.
- `unmerged`: each local branch other than `working` with commits `working` lacks, as `{ "branch": <name>, "commits": <git rev-list --count <working>..<name>> }`, sorted by name; with `HEAD` detached and holding commits `working` lacks, `{ "branch": null, "commits": <git rev-list --count <working>..HEAD> }` comes first. A branch with no such commit (already merged) is not listed. Empty when `working` is `null`.

A brain whose `working` is non-null, `on_working` `true` and `unmerged` empty gets no warning: a new brain, on one branch, never does. Otherwise `status` adds **one** warning `BRAIN_OFF_WORKING_BRANCH`, with no `path` or `id` (the fields are `branch`'s), whose message is the first that applies:
- `working` `null`: `Can't tell which branch is the brain's working branch: <n> branches, none of them main or master. Say "fix my backup".`
- `HEAD` detached: `The brain is on a detached HEAD, not its working branch <working>. Say "fix my backup".`
- another branch checked out: `The brain is on branch <current>, not its working branch <working>. Say "fix my backup".`
- `unmerged` non-empty: `Branch <branch> has <commits> commit(s) that <working> lacks. Say "fix my backup".`, with ` (and <k> more branches)` before the full stop when `unmerged` has more than one entry. A detached `HEAD` entry is reported by the case above it, so this case names a branch.

An attended session that sees the warning says it in one line and, on a yes, runs "fix my backup" (setup.md §15), which brings the work back locally, never through a pull request. An unattended run that finds the brain off its working branch writes nothing (§6.1). The warning never changes the exit code (0).

**Human output** (without `--json`) starts, only while `finished` is `false`, with one line: `Setup: <done> of <total> done · next: <what>`, where `<what>` is, by `next` in that order: `set your Git identity`, `set up your backup` (`add a private remote` before 0086), `create the drop folder`, `say the language of your notes`, `connect your agent to Notion`, `connect Notion`, `paste the minutes prompt`, `set up Notion Brain Assistant`, `set your identities`, `seed your work`, `check first value`, `choose the schedule`; then `say "set up my brain"`. Example: `Setup: 6 of 9 done · next: connect Notion · say "set up my brain"`. With `next` `null` and `finished` still `false` (every item done, no `finished` line yet), the line has no `next:` part: `Setup: 9 of 9 done · say "set up my brain"`. With the warning `BRAIN_OFF_WORKING_BRANCH`, the human output gives its message as one line, after the setup line when there is one and before the rest. The rest of the human output is unchanged.

`notion.configured`/`missing` list keys of `brain.json` `notion.databases` with non-empty / empty values, among `domains`, `areas`, `goals`, `key_results`, `projects`, `meetings`, `people`, `orgs`, `inbox`, `documents` and, from 0.18.0, `factories` (only with the Factories module on) (0045, 0049; a `references` key is reported as `documents`; a retired `concepts` key is not reported, 0071; a `review`, `decisions` or `questions` key, left by a brain whose 0.16.0 migration has not run, is not reported, capture-and-review §7.9, §5.14.9). `modules` (0048) has every module key except the retired `knowledge` (0099), filled in as schema §12 says: all `true` except Domains and Factories when the block is absent, else each absent key at its default. `notes` counts every type, `reference` included (0045); `concept` is counted only when a brain still has concept notes (before `brain upgrade`, 0071). A `capture_inbox` key is reported as `inbox` (schema §12). `settings` (schema §12) is added with defaults filled in: `{ "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 } }`, and from 0.15.0 `weekly`, each key at its stored value or its default (weekly-review.md §12): `{ "minutes": 10, "max_judged": 30, "max_usd": 3, "schedule": "off" }`. From 0.14.0 it also has `style` (0081), always with all four keys: the stored `preset` (`standard` when absent) and each dial's effective value (§5.3.1), e.g. `{ "preset": "simple", "explain": "plain", "length": "normal", "directness": "answer-first" }` for the stored `{ "preset": "simple", "length": "normal" }`; Standard is `{ "preset": "standard", "explain": "some", "length": "normal", "directness": "context-first" }`. `unattended` (0051) sums the unattended catch-up lines (§3.9) written since the last attended `catch-up` line, across the month files: `since` is that attended line's timestamp (`null` when there is none), `runs` the unattended lines after it, `inputs` and `failed` their sums, `failures` their reasons in order without repeats, and `left`, `skipped`, `waiting` and `last` (its timestamp) from the latest one, since an input still skipped is counted again by every run. `catch_up` is `null` when no unattended line follows the last attended one. `backlog` is `true` when the last three unattended catch-up lines, attended or not in between, each have `left` above 0. The attended catch-up opens with this summary (§6.1). `repos` lists `brain.json` `repos` in order (empty when absent): `found` is whether `path` is a Git working tree. `views_stale` includes area briefs. `index_stale` is `true` when `index.md` or the structure block of `AGENTS.md` is out of date (§5.8.1, 0089). Exit 0 even when stale.

**Suppressions (0055).** `suppressions` counts the records of `_suppressions/` (capture-and-review §5.3) that are `active` and `reconciled`, the knowledge notes with a restricted statement or restricted whole (`restricted_notes`), those restricted whole (`unresolved_lineage`: their text cannot be mapped to passages, or their lineage is unknown), and lists any unreadable record under `problems`.

**Tasks status diagnostic (0055).** `brain status --tasks-schema <file|->` accepts a skill-supplied JSON snapshot `{ "database": "<mapped database id>", "property": "<mapped status property name>", "as_of": "<ISO timestamp>", "options": ["To Do", "Done", "Won't Do"] }`. The skill obtains it from Notion during connection; the CLI stays offline. The database and property must be non-empty and match the configured mapping; timestamps must be valid UTC timestamps no later than the command clock. Malformed, future-dated or mismatched snapshots fail `INPUT_INVALID`. When the Tasks module is on, the snapshot lacks `notion.tasks.wont_do_status` (default `Won't Do`), `data.tasks_status_note` contains a non-error string identifying the missing option and snapshot time. It is `null` without a snapshot, when Tasks is off, or when the option is present. The check sees names only and cannot verify the Complete group. A snapshot is a point-in-time observation, not a promise of current Notion state.

### 5.3 `brain config`

```text
brain config get [<dot.path>]
brain config set <dot.path> <json-value>
brain config unset <dot.path>
```

Reads or edits `brain.json` (used by the connect-notion skill). `get` without a path returns the whole file. `set` parses `<json-value>` as JSON (`'"abc"'`, `8`, `{"a":1}`), sets it at the path (creating intermediate objects), validates the result against brain.schema.json, then writes. `schema_version` cannot be set (`INPUT_INVALID`).

```sh
brain config set notion.databases.projects '"2c4e6a80-1b3d-4f50-9a7c-8e6d4b2a0f13"' --json
```
```json
{ "data": { "path": "notion.databases.projects", "previous": "", "value": "2c4e6a80-1b3d-4f50-9a7c-8e6d4b2a0f13" } }
```

**`notion.template_version`** (0078, from 0.14.0): the four-digit number of the last Notion migration the user's space includes, as a string (`'"0024"'`; schema §12, [setup.md](setup.md) §9). Written by brain-connect-notion from the Template version line in the System callout on the space's top page (decision 0085), and by brain-notion-change after it applies a newer migration. Anything but four digits fails the schema (`INPUT_INVALID`).

**`settings.style`** (0081, from 0.14.0; schema §12). A `set` whose path is `settings`, `settings.style` or a path under it (`settings.style.length`) also rewrites the brain's style block (§5.3.1) from the result, after `brain.json` is written, and `data` gains `files`: `[ { "path": "AGENTS.md", "action": "created" | "updated" | "removed" | "unchanged" | "skipped" } ]` (`created` when a block is added, `removed` when one is taken out). Any other path leaves `AGENTS.md` alone and has no `files`. A symbolic `AGENTS.md` is `OUTSIDE_ROOT` before any write, `brain.json` included. `AGENTS.md` missing, or its rules or style markers missing, out of order or duplicated: `brain.json` is still written, `AGENTS.md` is `skipped` with warning `AGENTS_BLOCK_NOT_FOUND`, and `brain upgrade` restores the file. `config` never commits; the skill commits both files.

```sh
brain config set settings.style '{ "preset": "simple" }' --json
```
```json
{ "data": { "path": "settings.style", "previous": null, "value": { "preset": "simple" },
            "files": [ { "path": "AGENTS.md", "action": "created" } ] } }
```

**`unset`** (0.16.0, 0096, 0099) removes the key at the path. It is plumbing for the 0.16.0 Notion migration, which removes `notion.databases.review` (§5.14.8), `notion.databases.decisions` and `notion.databases.questions` (§5.14.9); it is not a user setting. The result is validated against brain.schema.json, then written, and `data` = `{ "path", "previous" }`, where `previous` is the removed value. **Idempotent**: a path that does not exist (a key, or an object on the way to it, already absent) is success with `"previous": null` and writes nothing, so a migration step that stopped partway can be run again. `schema_version` cannot be unset (`INPUT_INVALID`). A `settings.style` path rewrites the style block as `set` does.

```sh
brain config unset notion.databases.questions --json
```
```json
{ "data": { "path": "notion.databases.questions", "previous": "9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d" } }
```

Errors: `INPUT_INVALID` (value not JSON, result fails schema, `schema_version`), `USAGE` (`get` on a path that does not exist; a malformed path), `OUTSIDE_ROOT` (a symbolic `AGENTS.md` on a `settings.style` write).

#### 5.3.1 The style block and the style lines (0081)

The brain's `settings.style` (schema §12) reaches the agent as text in the instructions it reads every session: a **style block** in the brain's `AGENTS.md`, and a **style paragraph** in each linked folder's instruction block (§5.12). Both are made of the **style lines**, one per dial whose effective value isn't Standard's, in the order explain, length, directness:

| Dial | Level | Style line (normative) |
|---|---|---|
| explain | `expert` | `Don't define terms: the user knows them.` |
| explain | `plain` | `Use plain words and no jargon. When a term is needed, explain it with a short example the first time you use it.` |
| length | `short` | `Keep answers short: show at most five items at a time, say how many more there are, and show them when the user says "more".` |
| length | `full` | `Give full answers: the details and the reasons, not only the outcome.` |
| directness | `answer-first` | `Put the answer or the next action on the first line. In work with several steps, say where the user is ("step 3 of 5") in every reply.` |

`some`, `normal` and `context-first` have no line: they are the agent's ordinary behaviour. **No style lines** (Standard, `style` absent or `{}`, or every dial set to Standard's level) means **no block and no paragraph**, and a command that writes them removes one written before.

**The style block** in the brain's `AGENTS.md`, `{lines}` being the style lines, each as `- <line>`:

```markdown
<!-- ultimate-brain:style:start -->
## How to answer me

Written by `brain` from `settings.style` in `brain.json`; edits inside this block are overwritten. To change it, ask in this brain ("talk to me more simply", "shorter answers", "go back to normal"). It shapes your own words only: show text a command returns, such as a report, exactly as it is.

{lines}
<!-- ultimate-brain:style:end -->
```

- **Where:** right after the rules block's end marker `<!-- ultimate-brain:rules:end -->`, before the structure block when there is one (§5.8.1), outside the rules block, which `brain upgrade` copies byte for byte from the template (§5.15 step 1). A new block is inserted as one blank line and then the block, directly after the end marker's line, so the text that followed the marker (the blank line and `## My rules` in the template) follows the block's end marker unchanged. An existing block (both style markers, once each, in order) is replaced in place. Removing a block deletes its lines and the one blank line before its start marker, so adding and then removing it leaves the file's bytes as they were.
- **Written by** `brain config set` on a style path (§5.3) and `brain upgrade` (§5.15 step 1a). `brain init` writes none: a new brain is Standard.
- **Not written** when `AGENTS.md` is missing or a symbolic link, or its rules markers or style markers are missing, out of order or duplicated (warning `AGENTS_BLOCK_NOT_FOUND`, as §5.15 step 1). A style block whose start marker comes before the rules block's end marker is out of order. Nothing outside the style markers changes.
- `brain lint` does not check the style block: it is written from `brain.json`, and `brain upgrade` rewrites it.

**The style paragraph** in a linked folder's instruction block (§5.12), with the same lines, each as `- <line>`:

```markdown
The user's response style, from the brain's `settings.style`. It shapes your own words only; show text a command returns exactly as it is.
{lines}
```

The style is changed only from a session in the brain; a linked folder takes the change the next time its block is written: by `brain link` there, and from 0.13.0 by `brain upgrade` for a project registered in `brain.json` `repos`, whose upgrade writes what `brain link` would (0077 §4, CC-184).

### 5.4 `brain id new`

```text
brain id new <type> [--count <n>]
```

Generates `n` (default 1, max 100) new IDs for `<type>` (schema §1 prefixes; `proposal` allowed). `<type>` may also be a workflow record prefix, `wf`, `wi`, `art` or `op` (connected-workflows.md §1); those IDs are also checked against the records under `_workflows/`. Each is checked against every ID in the brain and against the others in the same call, and re-rolled on collision (0017). IDs are not reserved: use them in the next write.

```json
{ "data": { "type": "decision", "ids": ["dec-3f7k9m2q", "dec-8w1c5t6h"] } }
```

Errors: `USAGE` (unknown type, count out of range).

### 5.5 `brain note new`

```text
brain note new --input <file|-> [--dry-run]
```

Writes **new** notes (lifecycle `draft`, 0003; an attended ingest's notes become `reviewed` when their part's yes approves the part's `review_notes`, capture-and-review §7.3). Used by the ingest skill, by `apply` for `new_item` (written `reviewed`: the approval is the review, 0071), and by `sync apply` for Notion-created rows (which keep the lifecycle set in Notion). Never modifies an existing note; changes go through `proposal new`. Types `view` and `proposal` are refused (use `views` and `proposal new`).

**Input:**
```json
{
  "notes": [
    {
      "type": "decision",
      "id": "dec-3f7k9m2q",
      "title": "Use Supabase for auth",
      "file_date": "2026-12-03",
      "frontmatter": {
        "summary": "Acme moves auth from Firebase to Supabase, agreed at the 3 Dec sync.",
        "date": "2026-12-03",
        "assessment": "provisional",
        "area": "area-2m7c4h8n",
        "projects": ["prj-9x4t1b7e"],
        "sources": ["mtg-8c4n2p7w"]
      },
      "body": "## Decision\nUse Supabase for auth.\n\n## Context\n…\n"
    }
  ]
}
```

| Key | Req | Rule |
|---|---|---|
| `type` | ✔ | any v1 type except `view`, `proposal` and `concept` (retired in 0.9.1: write a `reference` with `origin: learned`, 0071) |
| `id` | | from `id new`; must match the type's prefix and be unused. Generated if absent |
| `title` | ✔ | |
| `file_date` | | for dated types without `date` (sources) |
| `frontmatter` | ✔ | every other field. Must not contain `id`, `type`, `title`, `created`, `updated`, `lifecycle`, or for sources `content_hash` |
| `body` | ✔ | Markdown; a trailing newline is added if missing |

The CLI sets `created` = `updated` = today, `lifecycle: draft` (knowledge types; `reviewed` for domain, area, goal, project and org, 0070; a `whole` or `promoted` reference is the exception, see "Documents" below), and for sources `content_hash` (schema §4, over the body as written) and `captured` (default now). Files are laid out as §3.6.5 says. References in `frontmatter` may point to existing notes **or to other notes in the same batch**. The batch is validated as if written: schema, IDs, folder, references, and every lint error rule (§5.10) that concerns the new files. So a new decision whose `decided_in` names an *existing* meeting fails `meeting-backref`: put the meeting in the same batch, or use a `new_item` proposal, whose apply updates the meeting. Any error → `INPUT_INVALID`, with `details` pointing into the input (a reference to a missing note included), and nothing is written.

**Source fields (0042, 0043).** A source item is also refused (`INPUT_INVALID`) when:
- `repo`, `repo_path` and `commit` are not all present or all absent; `repo` doesn't name an entry of `brain.json` `repos`; `commit` isn't 40 lowercase hex; or the key isn't `file:`;
- `attached_to` isn't the id of an existing source (or one earlier in the batch) that has no `attached_to` itself, or the key isn't `file:`;
- `digest`, `notion_text` or `notion_parts` is given on a `minutes` or `capture` source or one with `attached_to`;
- `notion_parts` is given without `notion_text: full`, or breaks schema §4 (malformed, out of order, overlapping, or above the body's part count);
- `notion_text_requested` is given (only `source full-text` writes it);
- `replaces` doesn't name an existing source (or one earlier in the batch), or names one that another source already replaces (0045);
- `only_keep` is given on a `minutes` or `capture` source, or is empty (0049). An attached file may carry it: it takes its row's Only keep;
- `keep` is given: it is the name before 0.6.0, still read on existing sources, never written again (use `only_keep`);
- `notion_text` or `notion_parts` is given: retired in 0.6.0 (0049). The CLI no longer writes `notion_text` by the kind;
- `area` isn't an existing area, or an entry of `projects` isn't an existing project (`UNKNOWN_ID`) (0050);
- **a checked row's source** (0.16.0, 0098 §4 and §5, capture-and-review §12.5): `checked_from` doesn't name an existing source (or one earlier in the batch) of kind `document`, `email`, `chat` or `note`; or the key isn't `notion:`, or `kind` isn't `checked_from`'s; or `changes` is absent, empty, or has an entry that isn't one line starting `Dropped: ` or `Altered: ` with text after it; or `changes` is given without `checked_from`. `only_keep` is refused on it: its Document, when asked, is a whole one;
- **a task source** (0.16.0, 0100 §2, capture-and-review §13.3): `kind: task` with a key that isn't `notion:`, or with `notion`, `digest`, `only_keep`, `attached_to`, `extract` or `checked_from`.

**The original of a checked row is not taken in (`CHECKED_ORIGINAL`, capture-and-review §12.7).** Once a source with `checked_from` = X exists (in the brain or earlier in the batch), a knowledge note of the batch whose `sources` lists X is refused: `INPUT_INVALID`, pointer `/notes/<i>/frontmatter/sources`, message `CHECKED_ORIGINAL: <X> was taken in as its checked version <id>; cite that`. A `whole` Document of X, written before its checked version, is not a new note and isn't touched.

**Documents (0049, schema §4 reference).** A `reference` item is also refused (`INPUT_INVALID`) when:
- `origin` is absent;
- `origin: whole` and `sources` isn't exactly one source id (`src-`), or the body isn't byte for byte that source's body (its hash isn't the source's `content_hash`);
- `origin: promoted` and `promoted_from` doesn't name an existing decision, or another `promoted` Document already names it, or names one whose `lifecycle` isn't `reviewed` or `disputed` (Promote is on decisions only since 0.9.1, and only reviewed knowledge is promoted, since the Document of a draft or archived note would get no page: 0071). **Promote to document is asked in the session** (0.16.0, 0099 §9): "promote the decision on … to a document"; the skill resolves the decision by title and alias, as for any value, and writes the Document with this command after the user's yes. Up to 0.15.x it came from a ticked Promote asked on a Decisions row (§5.14.2);
- `promoted_from` is set without `origin: promoted`;
- `origin: workflow` without `workflow: { id, artifact }`, or `workflow` set with another `origin` (connected-workflows.md §6.3);
- `origin: part` (0.16.0, 0098 §4): a part of an input is a checked row now (capture-and-review §12.2), whose Document is a whole one; a `part` Document written before stays valid;
- `question` is given and isn't an existing question (`UNKNOWN_ID`, `INPUT_INVALID`), or the Document isn't `whole` with a `task` source (0100 §2, capture-and-review §13.4).

The CLI writes `lifecycle: reviewed` for `origin: whole` (the source's own text needs no decision), for `origin: workflow` (the user approved the artifact) and for a decision with `workflow` (the same approval, 0071), the note's current `lifecycle` for `origin: promoted`, and `draft` otherwise (`learned`). A second `whole` Document of the same source is not written: it is reported in `skipped` with reason `ALREADY_KEPT` and the existing id, like a duplicate source.

**Source dedupe:** a source is a duplicate if an existing source, or one earlier in the same batch, has the same `content_hash`, **or** the same `source_key` when that key is `file:` (the same original file, whatever the converter produced) or the source's `kind` is `capture` (the same Inbox row, even after an edit) (0032), `task` (the same task page, 0100) or it has `checked_from` (the same checked row, 0098). **A version (0045):** a source with `replaces` is compared by `content_hash` only, so a corrected capture or file can be read again; the same text is still a `DUPLICATE_SOURCE`. A duplicate is not written and is reported in `skipped` with the existing id. This is how the ingest skips minutes it has already ingested (synthesis §5 step 2). Other items in the batch that reference the skipped source's input `id` are an error, so the skill must check `skipped` with `--dry-run` first, or snapshot the source in its own batch.

**A person or org the brain withholds (CC-207; eligibility.md §6, §7).** The ingest finds the people and orgs a new input names through `brain query`, which returns no name it withholds: a note restricted whole shows nothing, a note in the awaiting-cleanup form (§5.13) shows no title or aliases, and a note whose only change is a dropped summary shows no aliases. Without this rule the ingest would write a second note for the same person (`dana-whitfield-2.md`) on every input that names them. So a `person` or `org` item is **not written** when the slug (§3.8) of its `title`, or of one of its `frontmatter.aliases`, equals the slug of a **withheld name** of an existing note of the same type: its title and aliases when an answer surface leaves it out whole or returns it in the awaiting-cleanup form, and otherwise each alias the answer surface leaves out. It is reported in `skipped`:

```json
{ "input_index": 2, "reason": "WITHHELD_MATCH", "existing": "per-3k8m2q7x", "cite": "person per-3k8m2q7x, title withheld: awaiting cleanup" }
```

- `existing` is the matching note's id (when several match, the lowest id), and `cite` the label an answer cites it by (eligibility.md §6 rules 3 and 4), present only when its title is withheld. A note whose title is shown (only an alias matched) has no `cite`: `brain query --read <existing>` returns its title and path. The skip never carries the note's title, path, aliases or any other field, and the human output names it by id: `skipped notes[2]: matches person per-3k8m2q7x, whose name the brain withholds; not created again`.
- **Administrative, not an answer** (eligibility.md §7). The rule runs only on this write path, against a name the caller supplied, and returns an id and a label, as a lookup by `source_key` returns a location. It is no wider than the `-2` a taken slug already gives a title. `brain query` does not change, and the skip is never answer evidence: an agent that asks "is Dana Whitfield in the brain?" reads `query`, which still shows nothing.
- **Names the brain shows are not compared.** A person `brain query` returns by name is the ingest's to match and judge (a namesake at another org is a question for the user); this rule doesn't refuse a duplicate of it.
- **`distinct_from`** (optional item key, a list of ids): the user said the new person or org is not that note ("that's another Dana"). A note it lists is not a match, so the item is written (with the usual `-2` path when the slug is taken). Each entry must be the id of an existing note of the item's type (`INPUT_INVALID` otherwise); it goes only with `person` and `org` and is not written to the file. A `new_item`'s `note` (§5.6) does not take it.
- **Where it applies:** `brain note new` only. A `new_item` the user approved (§5.7) and a Notion row the user created (`sync apply`, §5.14) are the user's own and are written as before.
- As for a duplicate source, other items in the batch that reference the skipped item's input `id` are an error: the skill runs `--dry-run` first and uses `existing` in their place (a meeting's `attendees`, a project's `people`). With no suppression record in the brain nothing is withheld and nothing is compared. A batch with a `person` or `org` item reads `_suppressions/`, and an unreadable record fails it with `SUPPRESSIONS_UNREADABLE` (eligibility.md §3).

Input ids are checked (`ID_IN_USE`) before dedupe, so re-running a batch that supplies its own ids fails instead of being skipped; skills that re-run should let the CLI generate ids or check with `--dry-run`. A body's CRLF line endings are written as LF, except in a source, where they are an `INPUT_INVALID` error (its hash covers the exact bytes). The batch is refused if it adds a lint error to **any** note, not only the new ones (for example a new meeting whose id an existing question already names in `raised_in`).

Each written note logs `note-new <id> "<title>"`.

```json
{ "data": {
    "created": [
      { "id": "src-4m9q2x7c", "type": "source", "title": "Acme sync (Notion minutes)", "path": "sources/notion/2026-12-03-acme-sync-notion-minutes.md" },
      { "id": "dec-3f7k9m2q", "type": "decision", "title": "Use Supabase for auth", "path": "knowledge/decisions/2026-12-03-use-supabase-for-auth.md" }
    ],
    "skipped": [],
    "dry_run": false
} }
```
Skipped item: `{ "input_index": 0, "reason": "DUPLICATE_SOURCE", "existing": "src-7w3c9k5m" }` (or `ALREADY_KEPT` with a `ref-` id, or `WITHHELD_MATCH` with a `per-` or `org-` id and, when its title is withheld, `cite`).

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (incl. refused type, forbidden key, missing reference, lint error in a new file, a bad `distinct_from`), `ID_IN_USE`, `SUPPRESSIONS_UNREADABLE` (exit 5; a batch with a `person` or `org` item).

### 5.6 `brain proposal new` / `brain proposal list`

```text
brain proposal new --input <file|-> [--dry-run]
brain proposal list [--status <s>[,<s>…]] [--target <id>]
brain proposal list --waiting [--target <id>]
brain proposal backlog [--dry-run]
brain proposal settle --input <file|-> [--dry-run]
```

**`proposal new`** writes proposals (schema §11) for changes to existing knowledge (0003).

```json
{
  "proposals": [
    {
      "kind": "update_fact",
      "title": "Acme launch: Jan → Feb",
      "target": "prj-9x4t1b7e",
      "field": "launch_date",
      "after": "2027-02",
      "why": "Maria (now PM) confirmed launch moves to February.",
      "source": "mtg-8c4n2p7w",
      "passages": ["src-6h2k9m4q#¶4:3fa1c2d9"]
    }
  ]
}
```

Input keys are the proposal fields of schema §11 except `id`, `type`, `created`, `updated`, `status`, `decision`, `notion`, `links`, `changes`, `before_hash`, `deferred_from`, `dropped`, `items`, plus `note_passages` and `note_flags` on a `review_notes`, and `unsure` and `repeat` on an item a `review_notes` folds (below). An `add_link` input item always names **one** link with `field` and `after`; the CLI groups them (below). The CLI:
- assigns `id`, `created` = `updated` = today, `status: pending`;
- refuses `notion_correction` and `tracked_task` (`INPUT_INVALID`): only `sync apply` writes them, from what it read in Notion (§5.14.3, 0101 §4, §6);
- **needs `passages`** (schema §11, §11.5; eligibility.md §9.1, §9.2) on every item except `review_notes` and `notion_change`: the passages the change rests on, its value, wording, framing and `^[inferred]` lines included. This holds for the kinds with no text too (`update_fact`, `contradiction`, `add_link`, `merge`, `supersede`, `set_field`, `answer`, a `new_item`'s note) and for a reflection finding's proposal (the passages of the input lines it read). An item without `passages`, or with an empty list, is **refused**: `INPUT_INVALID` with the pointer `/proposals/<i>/passages`, and nothing of the input is written, as for any other required field. Each entry is a passage reference `src-…#¶<n>:<hash>` whose source exists (`UNKNOWN_ID`) and holds that paragraph (`INPUT_INVALID`), an existing `src-` or `mtg-` id or a source key for an input with no paragraph identities, or an entry that names no input (an existing note id, an `agent:<agent>/<session>` key); entries are unique. Every passage reference in the item's text (`content`, `answer`, `note.body`) must be among its `passages` (`INPUT_INVALID`, naming the reference). `notion_change` takes no `passages` (`INPUT_INVALID`): it changes Notion, not the brain, and is never judged (§5.7). A `review_notes` names its notes' passages in `note_passages` (below); its folded changes and links bring their own;
- skips an item that rests on excluded evidence (`SOURCE_EXCLUDED`; the rule is under "Excluded evidence" in §5.7): one any of whose `passages`, or any passage its text cites, is not live, even beside a live one, is withheld whole (eligibility.md §4.2), so no proposal is written for a change that could never be applied. The agent may propose it again from the live passages alone, as a new item. The human output names the reason of every skip (`skipped proposals[0]: rests on content you excluded from the brain`). How the ingest skill reports a skipped item to the user is the skill's to say (CC-180). A `review_notes` item is not checked as a whole; the changes folded into it are, before folding;
- **checks `subject`** (0.16.0, 0098; schema §11), optional on every kind: a string of the id form (schema §1) must be an existing knowledge note (`UNKNOWN_ID`; a source, view or proposal is `INPUT_INVALID`); any other string is a plain name, one line of at most 80 characters, not empty after trimming (`INPUT_INVALID`, pointer `/proposals/<i>/subject`). Stored as given. Two values are the same subject when they are equal strings;
- **refuses an original of a checked row** (0.16.0, `CHECKED_ORIGINAL`, capture-and-review §12.7): once a source with `checked_from` = X exists, an item whose `source` is X, or one of whose `passages` (or `note_passages`) is X or a passage reference into X, is `INPUT_INVALID` with the pointer to it and the message `CHECKED_ORIGINAL: <X> was taken in as its checked version <id>; cite that`;
- **checks `section`** (0.16.0, 0100 §3, schema §11; capture-and-review §13.6), allowed only on an `add_to_note` and only with the value `from_the_brain`: the target must be a Document with `origin: whole` whose source is a `task` source, and `content` one or more lines, each `- <text> ([<title>](<relative link>))` whose link resolves to an existing knowledge note other than the target, every such note's id among the item's `passages` (each `INPUT_INVALID` with its pointer). Such an item is never folded into a `review_notes`. Dedupe: a line already in the target's From the brain section is dropped from `content`, and an item left with none is skipped, `ALREADY_ADDED`;
- sets `before` to the target's current `facts.<field>` for `update_fact` and `contradiction` (absent if the fact is new). If the input gives `before` and it differs → `BEFORE_MISMATCH`;
- for `update_fact` and `contradiction`, sets `from` if absent: the source meeting's `date` when `source` is a `mtg-` id, else `created`;
- for `update_body` (0045), sets `before_hash` to the target's current body hash; `target` must be a `reference` whose `origin` isn't `promoted` (0049) and `content` non-empty and different from the current body (else skipped, `NO_CHANGE`). On a `whole` Document, `source` must be a later version of the Document's source, reached by following `replaces` back from it (`INPUT_INVALID`, pointer `/proposals/<i>/source`): its apply replaces `sources` with it (schema §11.2), as a changed task page kept again does (capture-and-review §13.5) and a file's new version does for its whole Document (schema §4, "Versions");
- for `replace_line` (0.15.0, weekly-review.md §8.3), sets `before_hash` to the target's current body hash; `target` must be a current knowledge note of weekly-review.md §8.2 (not archived; not a meeting, decision, memory, or a `reference` whose `origin` is `promoted`, `whole`, `part` or `workflow`, or none), `line_before` and `line_after` single non-empty lines that differ, and `line_before` a line of the body exactly once (each `INPUT_INVALID`); its `passages` judge `line_after` as its text;
- checks per kind: `target` exists (all kinds except `new_item`) and is a knowledge note (not a source, view or proposal, which are immutable, regenerated or records); a `source` that is a note id must exist (`UNKNOWN_ID`); a `new_item` whose `note` is a source already captured is `INPUT_INVALID`; `contradiction` needs a current `facts.<field>`; `supersede` needs `supersedes` to exist, differ from `target`, have the same type, and not already be superseded; `merge` needs `merge_into` to exist, differ from `target`, same type; `add_link` needs `field` to be `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders` and declared by the target's type, and `after` to be an existing note id with the field's prefix (`prj-`, `per-`) for the reference fields or a non-empty string for `aliases` and `tags`; when `after` is already in the list the item is skipped (`ALREADY_LINKED`), so a re-run after approval writes nothing (0028); `new_item` carries `note`, one `note new` input item without `id` (§5.5), which must pass `note new` validation, with a back-reference to an existing meeting allowed because apply adds it (schema §11.2);
- **dedupes:** an item equal to an existing `pending` proposal on (`kind`, `target`, `field`, `after`, `content`, `note`, `supersedes`, `merge_into`) is skipped (`DUPLICATE_PENDING`), so re-running an ingest does not duplicate review rows. For `add_link`, the item's (`field`, `after`) is compared with each entry of a pending `add_link` on the same target (its `links`, or its `field` and `after` if it is an old single one). An `add_link` whose value is already listed is skipped as `{ "input_index": 2, "reason": "ALREADY_LINKED" }` (no `existing`).
- **groups `add_link` items (0037):** after validation and dedupe, the remaining `add_link` items of the input with the same `target` and `source` become **one** proposal, in input order: `links` = their (`field`, `after`) pairs as `{field, value}`, `why` = their distinct `why` texts joined by ` · `. Every new `add_link` proposal is written with `links`, never `field` and `after`, even with a single link. Its `title` is the item's own `title` when the group has one item; for two or more, the CLI writes `<target title>: add <parts>`, where `<parts>` lists each field present, in the order `people`, `projects`, `attendees`, `deciders`, `aliases`, `tags`, as `<n> <noun> (<v1>, <v2>, <v3>, …)` joined by `, `: nouns `person`/`people`, `project`/`projects`, `attendee`/`attendees`, `decider`/`deciders`, `alias`/`aliases`, `tag`/`tags` (singular for 1); values are note titles for reference fields, else the string; at most three values, then `…`; for a single value the parentheses hold just it. Titles longer than 120 characters are cut to 119 and end with `…`. Example: `Acme website: add 2 people (Lucía Fernández, Tomás Vidal), 1 alias (acme site)`.

**`review_notes` (0041, 0043).** Input: `{ "kind": "review_notes", "source": "<id>", "notes": ["dec-…", "que-…"], "note_passages": { "dec-…": ["src-…#¶2:…"], "que-…": ["src-…#¶5:…"] } }`, plus optional `title` and `why`, and `fingerprint` and `evidence` for a reflection theme (below). `note_passages` names, for each note of `notes`, the passages that draft rests on, by the rules of `passages` above: one non-empty list per listed note and no other key, else `INPUT_INVALID` (eligibility.md §9.1). It is stored in the note's `items` entry; a folded change or link keeps its item's `passages` the same way (schema §11.5). **Flags and repeats (0.15.0, 0090 §6; asked in the session since 0.16.0, capture-and-review §7.2, §7.3):** a folded `update_fact`, `add_to_note` or `add_link` item may carry `unsure` (a list of non-empty one-line strings) and `repeat` (a non-empty one-line string), and `note_flags` (`{ "<note id>": { "unsure"?: [...], "repeat"?: "…" } }`, only notes of `notes`) gives a note's; they are stored on the item's `items` entry, else `INPUT_INVALID`. On an item that is not folded they are `INPUT_INVALID` too. **Grouped links (0.15.0, 0088 Q5):** the folded links of one `target` and `field` are one item whose `ref` is the list of their indexes, its `passages` the union of theirs in input order, its `unsure` their flags in order and its `repeat` the first one given. A `review_notes` takes no `passages` of its own. `source` is the ingest's provenance value, as the other proposals of the ingest carry it: the meeting id for minutes, else the `src-` id. The CLI:
- checks every id in `notes` exists, is a knowledge note and is not listed by another `review_notes` proposal (any status) or twice here (`INPUT_INVALID`, pointer to the entry); at most one `review_notes` per `source` and `subject` in one input (`INPUT_INVALID`): an ingest writes one per part (capture-and-review §7.3), and a source with one subject has one;
- **folds by part (0098):** an item folds only into the `review_notes` of the same input with the same `source` and the same `subject` (both absent counts as the same). A foldable item (`add_link`, `add_to_note`, an `update_fact` with no `before`) whose `source` has a `review_notes` in the input, but none with its `subject`, is `INPUT_INVALID` (pointer `/proposals/<i>/subject`), so no item of a part becomes a question of its own by mistake;
- **folds the routine links:** every `add_link` item of the same input with the same `source` and `subject` becomes an entry `{target, field, value: after}` of this proposal's `links`, in input order, instead of a grouped `add_link` proposal. Each is validated, deduped against pending `add_link` and `review_notes` proposals (`DUPLICATE_PENDING`) and skipped when already linked (`ALREADY_LINKED`) exactly as an `add_link` item; skipped items are reported and not folded. Without a `review_notes` item for their source, `add_link` items are grouped as above;
- **folds the additions (0045, narrowed by 0096):** every `add_to_note` item, and every `update_fact` item whose target has no current `facts.<field>` (no `before`: a new fact), of the same input with the same `source` and `subject` becomes an entry of this proposal's `changes`, instead of a proposal of its own. These go in with the part's yes in an attended ingest (capture-and-review §7.2, §7.3). An `update_fact` with a current value and an `update_body` replace what the brain holds and are **never folded** (0.16.0): each is a proposal of its own, asked in the session. Each is filled (`before`, `from`, `before_hash`), validated and deduped (`DUPLICATE_PENDING`, against pending proposals of its kind and the `changes` of pending `review_notes`) exactly as a standalone item; skipped items are reported and not folded. The entry keeps the item's `kind`, `target`, `why` and that kind's fields, without `title` or `source`. Entries are stored in item order (schema §11.3): every `update_fact`, then every `add_to_note`, each in input order. `contradiction`, `supersede`, `merge`, `new_item` and `answer` items are never folded either: they are judgment calls and stay proposals of their own. Without a `review_notes` item for their source, changes are written as proposals of their own;
- lists every note, whatever its passages hold: the draft is already in the brain (0003), and a proposal that left it out would leave it a draft no decision ever reaches. A note any of whose passages is not live, or whose draft is restricted in any part, is held and withheld before apply (§5.7), where an accept archives it;
- needs at least one entry in `notes`, `links` and `changes` together after folding; with none, the item is skipped (`NOTHING_TO_REVIEW`);
- writes `title`, unless given: `From <source title>: <counts>`, or, with a `subject`, `From <source title>, <subject>: <counts>`, where `<subject>` is the note's title for an id (its `cite`, cli §5.13, when the note is in the awaiting-cleanup form, so no withheld title is written) and the name otherwise (`From Ops plan, Pilot rollout: 1 change, 1 new note and 1 link`). `<counts>` lists, in this order and only when not zero, `<k> changes` (`1 change`), `<n> new notes` (`1 new note`) and `<m> links` (`1 link`), joined by `, ` with ` and ` before the last: `From Acme sync: 1 change, 3 new notes and 2 links`. `<source title>` is the meeting's title for a meeting id, else the source's. Cut to 120 characters as above. `why` defaults to `What came in from <source title>`. A deferred proposal (§5.7) uses the same counts after `Deferred from <source title>: `, or `Deferred from <source title>, <subject>: `.

**`answer` (0041).** Input: `{ "kind": "answer", "target": "que-…", "answer": "<sentence>", "answer_note": "dec-…", "why": "<quote>", "source": "<id>", "title": "…" }`, `answer_note` optional. `target` must be a question (`INPUT_INVALID`); `answer` non-empty; `answer_note`, when given, an existing knowledge note (`UNKNOWN_ID`). A question that already has an `answer` → skipped, `ALREADY_ANSWERED`. Dedupe: a pending `answer` on the same `target` with the same `answer` and `answer_note` → `DUPLICATE_PENDING`.

**`notion_change` (0072, [assistant.md](assistant.md) §6).** A change to a Notion-owned property, which the skill writes through the MCP after the decision (schema §11). Input: `{ "kind": "notion_change", "database": "tasks", "page": "<page id>", "page_title": "<the row's Name>", "property": "status", "value_before": "To Do", "value_after": "Done", "why": "…", "source": "agent:ultimate-assistant/20261106T100000Z", "finding": "task_overdue:notion:<page id>", "area": "area-…", "title": "…" }`; `target` (a `prj-` or `area-` id) is required for `projects` and `areas` and refused for `tasks`. The CLI checks, each `INPUT_INVALID` with its pointer:
- `database` and `property` pair: `tasks` with `status`, `due`, `project` or `area`; `projects` with `status` or `archived`; `areas` with `archived`;
- `tasks` needs the Tasks module on (`MODULE_OFF`) and the property's mapping in `notion.tasks.properties` non-empty; `projects` and `areas` need their `notion.databases` id set;
- the value shape (both values): `status` a non-empty string or `null` (on `projects`, one of `Planned`, `Active`, `On Hold`, `Done`); `due` a `YYYY-MM-DD` date or `null`; `project` and `area` a sorted, duplicate-free list of page ids; `archived` a boolean. `value_after` can't be `null` on `status`;
- on `projects` and `areas`, `target` exists, is a project or an Area as the database says, and has `notion` equal to `page`, or no `notion` (a page the skill matched by its Brain ID before its publish was recorded, assistant.md §2.1) (`UNKNOWN_ID`, `INPUT_INVALID`);
- `page` is a dashed lowercase page id; `page_title` non-empty; `area`, when given, an existing Area (`UNKNOWN_ID`).

`value_before` is the value the skill read; the CLI can't see Notion, so the stale check is the skill's when it writes (assistant.md §6.4). `value_after` equal to `value_before` → skipped, `NO_CHANGE`. Dedupe: a pending, approved or edited `notion_change` with the same `page`, `property` and `value_after` → `DUPLICATE_PENDING` (a rejected, applied or closed one doesn't block a new one). `title` defaults to `<page_title>: <Property> → <value_after as rendered>` (render's rules, §5.14.4), cut as above.

**`set_field` (0072, assistant.md §6.1).** A change to a brain-owned placement field: `{ "kind": "set_field", "target": "prj-…", "field": "area", "after": "area-…", "why": "…", "source": "…", "finding": "…", "title": "…" }`. `field` is `area` on a project, a decision, a question, a Document (`reference`, any `origin`) or a source (0092), or `domain` on an Area (`INPUT_INVALID` otherwise, naming the target's type); `after` an existing note of that field's type (`UNKNOWN_ID`, `INPUT_INVALID`). **A decision or question with `projects`** is refused, `INPUT_INVALID` at `/target`, naming each project by title and id: it belongs to the areas of its projects (schema §16.3), so the move is a project's (0092 §2). **A source and its whole Documents move together** (0092 §3): the target's *group* is the source and every Document with `origin: whole` whose `sources` is exactly that source; a `set_field` on any of them moves the whole group. A `part`, `learned`, `promoted` or `workflow` Document is in no group: it moves only when it is the target. The CLI sets `before` to the target's current value (absent when it has none); a given `before` that differs → `BEFORE_MISMATCH`; `after` equal to it, and to the `area` of every other note of the target's group → skipped, `NO_CHANGE`. `area`, when given, an existing Area (`UNKNOWN_ID`, `INPUT_INVALID`); when not given, the target's own Area: the target's current `area` (a project, decision, question, Document or source; none when it has none), or the Area itself. Dedupe: a pending `set_field` with the same `target`, `field` and `after` → `DUPLICATE_PENDING`. `title` defaults to `<target title>: <Field> → <after title>`.

**Correction groups (0.15.0, weekly-review.md §8.4).** A `review_notes` with `correction` (a claim key) is a correction group: `notes` is `[]`, `source` may be any proposal source (a note id must exist; it need not be a meeting or a source), and `needs_clarification`, when given, is a list of `{note, line}` (an existing note id and one line, or `null`). It takes in the `update_fact` and `replace_line` items of the same input whose `correction` is the same, in place of folding by `source`; no other item folds into it, and at most one group per `correction` in one input (`INPUT_INVALID`). `correction` is refused on any other kind, and on a `review_notes` with notes, a fingerprint or a cleanup (`INPUT_INVALID`). Each folded change is deduped as a folded change is (`DUPLICATE_PENDING`); when every change of the group is skipped as a duplicate, the group is skipped `DUPLICATE_PENDING` naming the waiting group that holds the first, so a rerun links the existing row. `title` is required on a group. A `replace_line` without `correction` is a proposal of its own; one with it and no group in the input → `INPUT_INVALID`. Dedupe of a standalone `replace_line`: a pending one with the same `target`, `line_before` and `line_after` → `DUPLICATE_PENDING`.

**`fingerprint` and `evidence`** (0052, 0076, schema §11.4): given together or not at all, never with `finding`, on the kind the fingerprint's finding takes (`contradiction`, `update_fact`, `merge`, `add_to_note`, `review_notes` or `new_item`); the fingerprint's parts must match the item (its `target`, `field`, merge pair, promotion `source`; a theme's `review_notes` lists exactly one note, a learned Document, and a theme's `new_item` holds one), and every `evidence` id must be a meeting or a source that exists (`INPUT_INVALID` with its pointer; `UNKNOWN_ID`). Stored as given. Dedupe: besides the rules above, an item whose fingerprint is on a `pending`, `approved` or `edited` proposal is skipped `DUPLICATE_PENDING`, naming it in `existing`. A reflection item is never folded into another `review_notes`: a theme's `review_notes` is its own proposal, and its `contradiction`, `update_fact`, `merge` and `add_to_note` items stay proposals of their own even when an item of the same input has the same `source`.

**`finding`** (any kind, optional): the Ultimate Assistant finding key the proposal comes from (assistant.md §3.3); stored as given. Every proposal Ultimate Assistant writes has the `source` `agent:ultimate-assistant/<session>`, with or without `finding`; it is decided in the session like any other proposal (capture-and-review §7), and no proposal is published to Notion (§5.14.4).

**`proposal settle`** (0072, assistant.md §6.4) records what the skill did with the `notion_writes` of `apply` or `sync apply` (§5.7). Input: `{ "settled": [ { "proposal": "prp-…", "result": "applied" | "stale" } ] }`. Each item, atomic per item:
- a `notion_change` whose `status` is `approved` or `edited` becomes `applied` (`applied`), or `closed` with `closed_reason: stale` (`stale`); `updated` = today; logs `apply <prp-id> "<title>" result=<applied|closed>`;
- already `applied` or `closed` → `skipped`, `ALREADY_TERMINAL`;
- a result that would fail lint → `failed`, `INVALID_RESULT`, proposal unchanged;
- any other kind, or a `notion_change` that is `pending` or `rejected` → `failed`, `NOT_AWAITING`; an unknown id → `failed`, `UNKNOWN_ID`.

`data` = `{ "settled": [ { "proposal": "…", "result": "applied" | "closed" | "skipped" | "failed", "reason"?: "…", "changed": ["…"] } ], "dry_run": false }`. Exit 1 if any item failed.

Each `created` item lists `input_indexes`, the input items it holds (several for a grouped `add_link` or a `review_notes` with folded links and changes). Proposals are written with an empty body. Logs `proposal-new <id> "<title>" kind=<kind> target=<target>` (one line per proposal written).

```json
{ "data": {
    "created": [ { "id": "prp-3c8v1n5x", "kind": "update_fact", "title": "Acme launch: Jan → Feb", "target": "prj-9x4t1b7e", "path": "_proposals/2026-12-03-acme-launch-jan-feb.md", "before": "2027-01", "input_indexes": [0] } ],
    "skipped": [ { "input_index": 1, "reason": "DUPLICATE_PENDING", "existing": "prp-9d3f7h2k" } ],
    "dry_run": false
} }
```

Errors: `INPUT_INVALID`, `UNKNOWN_ID`, `BEFORE_MISMATCH`.

**`proposal list`** returns proposals filtered by status (default all) and target, sorted by `created` then id. Each item has every frontmatter field plus `path`. `--target` also matches a `review_notes` that lists the id in `notes`, as a `links` target or as a `changes` target.

**A held item is listed without its wording** (eligibility.md §4.3, §9.4). With the suppression records as they are now, whatever the proposal's status, a proposal withheld by §5.7's rule is listed with `held: true` and without `title`, `why`, `before`, `after`, `from`, `content`, `answer`, `answer_note`, `note`, `links`, `supersedes`, `merge_into`, `fingerprint` (a theme's term is text), `notion_published` and `revisions`: what remains is its id, kind, target, field, source, passages, status, decision and dates, and its `subject` when that is a note id (a plain name is text and is left out), without `path` (a proposal's file name is made from its title), so the skill can name it and its reason without showing what it rests on. On a `review_notes`, `held` lists the withheld items as `{change: <index>}`, `{note: <id>}` and `{link: <index>}`; a held change keeps only `kind`, `target` and `field`, a held link only `target` and `field`, a held note's id stays in `notes` (a note id carries no text), and the proposal loses `notion_published` and the `revisions` of its held items. When every item of a `review_notes` is held, its `title`, `why`, `fingerprint` and `path` go too. A `notion_change`, `notion_correction` or `tracked_task` is never held. The human output shows a held proposal's title as `held: rests on content you excluded from the brain`. A proposal that is not withheld has no `held`. How the chat flow shows it is the skill's (CC-180).

**`proposal list --waiting`** (0.16.0, decision 0096, capture-and-review §7.5) returns what the session asks: every `pending` proposal that is not withheld whole by §5.7's rule, in the order of the questions, and the withheld ones apart. **From 0.17.0** a proposal with `weekly` set (an item a Weekly row offers, weekly-review.md §15.6) is not a session question: it is decided by its tick in that row, and is left out of `waiting` and `held` and counted in `counts.in_weekly_row`. With `--target`, only proposals that `--target` matches as above. `--waiting` with `--status` → `USAGE`. Read-only. Each waiting item is a `proposal list` item (its frontmatter, `path`, and `held` for its withheld items when it is a partly held `review_notes`) plus `group`:

| `group` | Proposals |
|---|---|
| 1 | changes to what the brain holds: your corrections from Notion (every pending `notion_correction`, **one question**, listed first), an `update_fact` with `before`, `contradiction`, `supersede`, a correction group (a `review_notes` with `correction`), `replace_line`, `update_body`, `set_field`, `notion_change` |
| 2 | `merge`, `answer`, `tracked_task`, `new_item`, a cleanup (a `review_notes` with `cleanup`) |
| 3 | any other `review_notes`: a source's parts (and a deferred one) are **one question per source**, its parts listed with their counts (capture-and-review §7.5); a reflection theme's (with `fingerprint`) is one question of its own |
| 4 | any other pending proposal: an `add_link` or `add_to_note` of its own, an `update_fact` with no `before` (written before 0.16.0) |

`waiting` is sorted by `group`, then `created`, then id, except that every `notion_correction` comes first in group 1, together, by `created`, then id (the session asks them as one question, 0101 §4), and that in group 3 a source's `review_notes` without `fingerprint` are listed together: a source takes the place of its first one, and they follow it in `created`, then id order. `held` lists each `pending` proposal withheld whole, in the same order, as `proposal list` lists a held proposal (no wording), plus `reason`: `SOURCE_EXCLUDED`, and `legacy: true` when it has no `passages` (§5.7). An `approved` or `edited` proposal waiting only for `apply` or for its Notion write (`notion_change`) is in neither list. The skill asks `waiting` in rounds of at most five and names how many are `held` (capture-and-review §7.5).

```json
{ "data": {
    "waiting": [ { "id": "prp-3c8v1n5x", "kind": "update_fact", "group": 1, "status": "pending", "title": "Acme pilot: 9 → 11 depots", "target": "prj-9x4t1b7e", "field": "depots", "before": 9, "after": 11, "source": "mtg-8c4n2p7w", "passages": ["src-6h2k9m4q#¶4:3fa1c2d9"], "created": "2026-12-03", "updated": "2026-12-03", "path": "_proposals/2026-12-03-acme-pilot-9-11-depots.md" } ],
    "held": [ { "id": "prp-7m2k9q4x", "kind": "add_to_note", "group": 4, "status": "pending", "target": "prj-9x4t1b7e", "source": "src-4m9q2x7c", "passages": ["src-4m9q2x7c#¶2:9b1e7c33"], "created": "2026-12-01", "updated": "2026-12-01", "held": true, "reason": "SOURCE_EXCLUDED" } ],
    "counts": { "waiting": 1, "held": 1, "in_weekly_row": 0 }
} }
```

**`proposal backlog`** (0041) writes the `review_notes` proposals of a brain that existed before 0.4.0: one per source, over the `draft` notes nobody has accepted yet. Deterministic; a second run writes nothing.
1. Sources are taken in `captured` order, then id. A source's provenance value is its meeting's id when it is `minutes` (the meeting whose `source` is it), else its own id.
2. A source **claims** every knowledge note that has `lifecycle: draft`, is not listed in any `review_notes` proposal (any status), is not claimed by an earlier source, and either is that meeting or has the provenance value in its `sources`.
3. For each source that claims at least one note: one `review_notes` with `source` = the provenance value, `notes` = the claimed notes sorted by `created`, then id, `links: []`, no `changes`, the `title` rule above, and `why` = `Notes from <source title> waiting for your review`.

`data` as for `proposal new` (`created`, `skipped: []`, `dry_run`), without `input_indexes`. Logs `proposal-new` per proposal.

```json
{ "data": { "proposals": [ { "id": "prp-3c8v1n5x", "kind": "update_fact", "status": "pending", "title": "Acme launch: Jan → Feb", "target": "prj-9x4t1b7e", "field": "launch_date", "before": "2027-01", "after": "2027-02", "from": "2026-12-03", "why": "…", "source": "mtg-8c4n2p7w", "created": "2026-12-03", "updated": "2026-12-03", "path": "_proposals/2026-12-03-acme-launch-jan-feb.md" } ] } }
```

**Item ids (0055).** A new `review_notes` is written with `items` (schema §11): every note, link and change gets one immutable `it-` id when the proposal is created, in item order (schema §11.3). The ids are never recomputed, so a deferral or a regeneration cannot move a decision onto another item. `brain lint` checks them (`proposal-items`).

### 5.7 `brain apply`

```text
brain apply [--input <file|->] [--record-only] [--dry-run]
```

Applies **decided** proposals (schema §11.1–11.2), your corrections from Notion among them (`notion_correction`, 0023, 0027, decided in the session since 0.16.0, 0101 §4). Deterministic. Each proposal writes exactly the files in its kind's write set (schema §11.2).

**Input** (`decisions`, non-empty):
```json
{
  "decisions": [
    { "proposal": "prp-8m3k5q2w", "action": "approve", "note": "accept all", "decided_at": "2026-12-04T08:14:00Z", "decided_by": "chat" },
    { "proposal": "prp-3c8v1n5x", "action": "approve", "note": "yes", "decided_at": "2026-12-04T08:15:00Z", "decided_by": "chat" },
    { "proposal": "prp-2v6n8q4j", "action": "fix", "note": "Product Manager, not Designer", "fixes": [ { "value": "Product Manager" } ], "decided_at": "2026-12-04T08:16:00Z", "decided_by": "chat" },
    { "proposal": "prp-3w9k2m7d", "action": "approve", "note": "all except Tomás", "exclude": [ { "field": "people", "value": "per-2d8f4j6n" } ], "decided_at": "2026-12-04T08:17:00Z", "decided_by": "chat" },
    { "proposal": "prp-5k2m8q4w", "action": "fix", "note": "a: March, not February. All except d", "fixes": [ { "change": 0, "value": "2027-03" } ], "reject": [ { "note": "que-6b2n8v4c" } ], "decided_at": "2026-12-04T08:18:00Z", "decided_by": "chat" }
  ]
}
```

**Decisions come from the session (0.16.0, decision 0096, capture-and-review §7.6).** `decided_by` is `chat`: the user answered in Claude Code or Codex; `decided_at` is when they answered. From 0.17.0 two more values come only through `brain cleanup` (§5.38): `tick` (the user's tick, or an item left unticked and declined, in a Ready Weekly row; `decided_at` is when the row was read) and `cleanup` (a mechanical item the weekly run applied alone); `brain apply` refuses both in its input (`INPUT_INVALID`): `brain cleanup` writes them through the same rules. `decided_by: notion` is written only by the 0.16.0 migration's one read of the Review rows (§5.14.8). A decision item carries `note`, the user's answer in their own words, recorded as said in `decision.note` (`"yes"` for a plain yes on an ingest's preview), and, on `approve` or `fix` of an `add_link` or a `review_notes`, `exclude`: on `add_link`, the `{field, value}` pairs of its `links` not to apply; on `review_notes`, `{note: <id>}` entries of its `notes`, `{target, field, value}` entries of its `links` and `{change: <index>}` entries of its `changes`, which are **deferred** to a new pending `review_notes` (schema §11.3): the items the user left for later. **`reject`** (0.16.0, 0098), on `approve` or `fix` of a `review_notes` with `items`, names entries of the same shapes that the user **turned down**: apply rejects them in the same item operation (a note archived, a change or link not applied, each recorded in `item_decisions`, schema §11.3) and applies the rest. The CLI never interprets `note`; the skill turns it into `fixes`, `exclude` or `reject` (0037, 0045), reading the item letters it showed the user (schema §11.3). **One part, one decision:** an attended ingest decides each part's `review_notes` with its own decision item, in part order, after that part's answered questions (capture-and-review §7.3), and a source's question in a later session gives one decision item per part (§7.5). `exclude` or `reject` on any other kind or action, `reject` on a `review_notes` without `items`, and an entry in two of `exclude`, `reject` and `fixes` → item `failed`, `INPUT_INVALID`; an entry that is not in the proposal → `failed`, `EXCLUDE_UNKNOWN`.

**`fix` (0045)** needs `note` and `fixes`, whose entries schema §11.3 gives per kind; it records status `edited` and applies the corrected proposal. `edit` with `value` is still accepted, with its rules before 0.5.0 (schema §11.1). A fix entry naming no item → `failed`, `FIX_UNKNOWN`; an item both fixed and excluded → `failed`, `INPUT_INVALID`.

**Order:** `decisions` in input order. Later items see the results of earlier ones. A `corrections` array (up to 0.15.x, your Notion edits applied as given) is retired in 0.16.0: an input that has one → `INPUT_INVALID`, since a correction from Notion is a proposal decided like any other (below).

**Decisions:**

| Proposal state | Result |
|---|---|
| `applied` or `closed` | `skipped`, reason `ALREADY_TERMINAL` (no-op, schema §11.1) |
| `pending` | write `decision` and the matching status, then apply, in one item operation |
| `approved`/`edited`/`rejected` with the same decision (same `action`, `value`, `fixes` and `exclude`; `note`, `decided_at` and `decided_by` are not compared) | apply |
| `approved`/`edited`/`rejected` with a different decision | the decision with the later `decided_at` is kept (the user changed their mind before it was applied), then apply |

- **`--record-only`** writes the decision and status without applying (`approved`/`edited`/`rejected`), for a run that must not apply at all (0003). An unattended run has no decision to give (§6.1).
- **Without `--input`**, `apply` applies every proposal that holds a recorded decision but is not terminal.

**Excluded evidence (0055, capture-and-review §5.1, eligibility.md §4.2, §9.2 and §9.3).** Checked before apply on every route (`decided_by: chat` or `notion`), with the suppression records as they are at that moment, so an exclusion made after the proposal was written is caught; every kind is checked except `notion_change`, `notion_correction` and `tracked_task` (they rest on what you did in Notion, not on an input), and a `review_notes` item by item (below). A proposal that rests on evidence the user excluded, or whose eligible support can't be established, is **withheld whole**: it is **closed** and nothing of it is applied: decision recorded, `status: closed`, `closed_reason: stale`, item result `closed` with reason `SOURCE_EXCLUDED`, `input` (the input its `source` comes from, when it has one) and `legacy: true` when it had no `passages`, so the skill can report it and the next ingest of that input's current version can propose it again with passages (eligibility.md §9.3). The brain never cuts the excluded line out of the wording and applies the rest: accepted text is never silently stripped (eligibility.md §4.4). With no suppression record in the brain nothing is withheld. Otherwise a proposal is withheld when (schema §11.5)

- **it names `passages`** (written from 0.13.0 on) and any of them is not live: a passage reference that the latest version of its input no longer holds, or that waits for its Restore (capture-and-review §5.1); a whole input (a `src-` or `mtg-` id, a source key) that has a suppression record. An entry that names no input (a note id, an `agent:…` key) is live. One passage that is not live withholds the item even when the others are live: a mixed item (eligibility.md §4.2). This judges the kinds with no text (`update_fact`, `contradiction`, `add_link`, `merge`, `supersede`, `set_field`) by what they rest on; or
- **it is legacy** (no `passages`, schema §11.5) and the input of its `source`, read as a whole-source entry, has a suppression record, active or reconciled: its passages can't be established, so it is never applied on trust (0077 §3). A legacy proposal whose input has no suppression record has adequate passage support and applies normally (the user's reading of 2026-11-10, eligibility.md §9.3); or
- the text it would write (`content`, `answer`, or `note.body`) has a line with a passage reference that is restricted when read as a claim of a note whose `sources` is the proposal's `source` (capture-and-review §5.1), **even when another cited line is live**. Lines with no passage reference (a heading, an `^[inferred]` or `^[ambiguous]` sentence) decide nothing by themselves; the passages they draw from are in `passages`; or
- **it is legacy** and cites no passage, and its `source` is an older version or a full copy of an input that has a suppression record, which retrieval no longer returns. A proposal that names `passages` is judged by them alone, whatever version its `source` is.

**A `review_notes` with `items` (0.8.0 layout)** is judged item by item: one `it-` item is one change, one new note or one link (eligibility.md §4.1). On an approve or a fix in chat (and, in the 0.16.0 migration, a decision read from a Review row, §5.14.8), an item that rests on excluded evidence is withheld and the independent items apply: a withheld change or link is not applied (a change's result is `dropped` with reason `SOURCE_EXCLUDED`), a withheld draft is archived (result `archived`), and each withheld item is recorded in `item_decisions` as `{ item_id, decision: reject, decided_at, decided_by, state: closed, reason: source_excluded }`. When every pending item is withheld, the proposal is closed as above. Each item is judged by the rule above with its own `passages` (`items[].passages`) and the row's `source`; an item without them is legacy; a note is also withheld when its draft is restricted in any part. A legacy note is judged by its draft alone, by retrieval's rule (capture-and-review §5.1): a restricted line, or uncited text resting on the suppressed input, makes it withheld; a draft whose own claims (body lines, timeline entries, facts) are all live stays reviewable (the user's choice of 2026-11-11, reading eligibility.md §9.3 for note items). A legacy change or link keeps the rule above. Cleanup items (`remove`, `restore`, `independence`) are not judged.

**A `review_notes` without `items` (older layout), approved or fixed as a whole** (eligibility.md §4.1, §9.3). Each folded change, each listed note and each link is an item, and every one of them is legacy. A change is judged by the rule above with the row's `source` and its own text, a link with the row's `source`. A note is judged by its draft alone, by retrieval's rule (capture-and-review §5.1): a restricted line, or uncited text resting on the suppressed input, makes it withheld; a draft whose own claims (body lines, timeline entries, facts; not its summary) are all live stays reviewable, even when the row's input has a suppression record (the user's choice of 2026-11-11, reading eligibility.md §9.3 for note items). A withheld item is not applied and the independent items are: a withheld change's result is `dropped` with reason `SOURCE_EXCLUDED`, a withheld note is archived (result `archived`), a withheld link is not added; each is recorded in the proposal's `dropped` (`{change: <index>}`, `{note: <id>}` or `{link: <index>}`, with `reason: source_excluded`, schema §11) and returned in `withheld` with the same shapes, so the skill reports it and the input's next ingest can propose it again. An excluded (deferred) item is not judged: it moves to the deferred row. When every item left is withheld, the row is closed as above. A fix of a withheld item does not apply it.



**A cleanup `review_notes` (0055, §5.26; 0.16.0, 0096).** A `review_notes` with `cleanup` holds only `remove`, `restore` and `independence` items, asked in the session (capture-and-review §7.5, group 2). An `approve` or a `fix` accepts every item it doesn't turn down, by §5.26's rules, in one journaled operation with the decision: a `remove` writes the note's text without the lines that rest on excluded content (worked out when applied), or the fix's text; a `restore` appends its `restore` record; an `independence` is `Remove` (the note is archived) unless a fix says `Keep`. A fix entry is `{item: <it- id>, value}`: on a `remove`, `value` is the note's text as the user corrected it; on an `independence`, `Keep` or `Remove` (any case); any other value, or a fix of a `restore`, → `INVALID_RESULT`. `reject: [{item: <it- id>}]` turns an item down: nothing is changed or released for it. `exclude` is refused (`INPUT_INVALID`): a cleanup item has no defer, so "later" leaves the whole proposal pending. Each item is recorded in `item_decisions` as `{item_id, decision: accept | reject, decided_at, decided_by}`. A `remove` whose text still holds a statement that rests on excluded content fails the decision item, `STILL_RESTRICTED`, and nothing of the proposal is applied. When the accepted items leave no note restricted by the input, the input's active records become `reconciled` with `reconciled_at` in the same operation, and the item's result has `reconciled: true`. A `reject` of the whole proposal closes it and changes nothing.

**Re-proposing from the live passages (eligibility.md §4.2, §9.5).** A withheld item is not repaired in place. The agent may propose the change again from its live passages alone (`proposal new`): that is a new pending proposal with its own id and no decision, so an Approve or an Accept given to the withheld item does not carry over to it, and `brain apply` without `--input` leaves it pending until the user decides it.

**Which decisions are checked, and what is judged (eligibility.md §9.5).** The wording that would be written is judged: on a `fix` or an `edit` that gives a `value`, that value; otherwise the proposed text. So an `approve` is always checked, and so is a fix that keeps the proposed text (a fix of a `new_item`'s title or frontmatter keeps its body): a generic Approve, or a fix that keeps the wording, never carries an excluded claim through, since approval never overrides an exclusion (eligibility.md §2). A value that cites a passage is judged like the proposal: one that still cites an excluded passage is closed, and one that cites only live passages (the user dropped the excluded line and kept the live one) is the user's exact acceptance of that wording and applies with the proposal's `source`: such a value rests on the passages it cites, not on the proposal's whole `passages` list. A value is the user's own wording, and is not judged, only on a kind whose value is the whole change (`update_fact`, `contradiction`, `add_to_note`, `update_body`, `answer`, `set_field`) and only when it differs from what was proposed (`content`, `answer`, or `after`) **and** cites no passage. A fix of a `merge`'s survivor, a `supersede`'s older note, an `add_link`'s value or a `new_item`'s fields corrects part of a change that still rests on the proposal's passages, so the proposal is judged (eligibility.md §9.5: an incidental edit does not launder): a typo corrected in a text that keeps its `^[src-…#¶n:hash]` reference is still that claim, and a value equal to the proposed one is the proposal.

**The user's own wording is a separately attributed correction** (0055, capture-and-review §7.7; eligibility.md §9.5, the user's choice of 2026-11-10). It is applied even when it restates excluded content, and its provenance is `user-correction:<proposal id>`, never the proposal's `source`, so the brain never claims the source said it: an `update_fact` keeps the source's value in the timeline as `superseded` and adds the user's value as `accepted` with `source: user-correction:<proposal id>` (capture-and-review §7.7), except when the proposal itself rests on excluded evidence: then the source's value is excluded text and is not written, and the user's value is the only new entry (eligibility.md §9.4); an `add_to_note` appends it followed by `Source: user-correction:<proposal id>`; an `update_body` writes it; neither adds the proposal's `source` to the target's `sources`. A `contradiction` attributes a value other than its `after` to the user already (schema §11.2). An `answer` records no source. A warning in the skill when the user's value repeats excluded content is optional (CC-180).

**One rule on every surface.** `brain proposal new` skips such an item (§5.6); `proposal list` lists it without its wording, and `proposal list --waiting` lists a proposal withheld whole under `held`, never as a question (§5.6); an accept given in the session closes it with `source_excluded` (above). No proposal is published to Notion (§5.14.4).

**What the rule does not see (a stated limit, narrowed: eligibility.md §9.6).** A line with no passage reference decides nothing, so a sentence in which the agent restates an excluded paragraph without its passage reference (`… ^[inferred]`), beside a live claim, passes the check when every passage the item cites is live: the CLI cannot tell a restatement from framing. 0077 narrows this three ways: every change names all the passages it draws from, its uncited lines included, so a restatement whose item lists the excluded passage is a mixed item and is withheld whole (`passages`, above); the skills read existing content only through the filtered commands, so an excluded statement already in a note can't be read back and restated (CC-180); and the ingest never writes a statement from an excluded paragraph, cited or not (CC-180, measured by CC-185's cases and CC-186's runs). What remains is an agent that leaves a passage off the list and restates text it read during intake: the CLI does not detect it. A change with no text of its own is judged by the `passages` it names; one that names a live passage it does not rest on, while resting on an excluded one it leaves off, is the same agent omission and is not detected. With no suppression record in the brain the check does nothing.

**Stale proposals.** Before applying `update_fact` or `contradiction`, the target's current `facts.<field>` must still equal the proposal's `before` (both absent counts as equal); before applying `update_body`, the target's body hash must still equal `before_hash`; before applying `replace_line`, the body hash must still equal `before_hash` and `line_before` be a line of the body exactly once. An `edit` or `fix` value of a `replace_line` is one non-empty line (`INVALID_RESULT` otherwise). Inside a `review_notes`, a stale change is dropped alone and the rest applies (schema §11.3). If it doesn't, the proposal is **closed**: decision recorded, `status: closed`, `closed_reason: stale`, and the item result is `closed` with reason `STALE_PROPOSAL`. The skill says so in the session, and the next ingest may propose the change again against the current value.

**`review_notes` results (0041, 0045).** An applied or closed `review_notes` item also returns `notes`: one entry per listed note, `{ "id": "…", "result": "reviewed" | "archived" | "kept_draft" | "unchanged", "lifecycle": "<its lifecycle now>" }`. `unchanged` is a note that was no longer `draft` when the proposal was applied (you changed its Lifecycle in Notion); it is left as it is. `kept_draft` is an excluded note; a note in `reject` is `archived`. An applied one also returns `changes`: one entry per change, `{ "index": 0, "kind": "update_fact", "target": "…", "result": "applied" | "dropped" | "deferred" | "rejected", "reason"?: "STALE_PROPOSAL" | "SOURCE_EXCLUDED" }`, `deferred`: the id of the new proposal holding the excluded items, when there are any, and `withheld`: the items withheld for want of eligible support (above), when there are any: `it-` ids on a proposal with `items`, `{change}`, `{note}` and `{link}` entries on an older-layout one. The skill's report names the `unchanged`, `kept_draft`, dropped, deferred and withheld items once (a withheld item without its wording, eligibility.md §4.3), and repeats every fix it applied ("a: launch set to 2027-03").

Other item failures (proposal unchanged):
- `EDIT_NOT_ALLOWED`: `edit` on a kind that forbids it (schema §11.1); `review_notes` is one of them (use `fix`);
- `FIX_UNKNOWN`: a `fixes` entry that names no item of the proposal;
- `UNKNOWN_ID`: proposal or target missing;
- `INVALID_RESULT`: the result would fail schema or lint, e.g. an edited value of the wrong shape;
- `INPUT_INVALID`, `EXCLUDE_UNKNOWN`: an `exclude` that doesn't fit the proposal (above).
- `STILL_RESTRICTED`: a cleanup `remove` whose text still rests on excluded content (above).

**`notion_change` (0072, [assistant.md](assistant.md) §6).** The CLI can't write Notion, so apply never makes this change itself. An `approve` or `fix` (one `{value}`, the shape of `value_after`, schema §11.3) records the decision and the status `approved` or `edited`, and the item's result is `awaiting_notion`; a proposal already `approved` or `edited` with the same decision gives the same result again, without rewriting the proposal file, so a write a skill never carried out is handed back by the next apply. A `reject` closes it as usual. Each `awaiting_notion` item adds one entry to `data.notion_writes`:

```json
{ "proposal": "prp-6t2m8k4q", "database": "tasks", "page_id": "2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e",
  "property": "Status", "payload": { "type": "status", "value": "Done" }, "expect": "To Do", "value": "Done" }
```

- `property` is the Notion property name: for `tasks`, the mapping in `notion.tasks.properties` (`status`, `due`, `project`, `area`); for `projects`, `Status` or `Archived`; for `areas`, `Archived`. A mapping emptied since the proposal was written → item `failed`, `NOT_MAPPED`, proposal unchanged.
- `value` is `value_after`, or the fix's value; `expect` is `value_before`.
- `payload` is `{type, value}` as `sync tasks` types it (§5.14.5): a task status `{ "type": <notion.tasks.status_type, select when absent>, "value": <name> }`, a project status `{ "type": "select", … }`, a due date `{ "type": "date", "value": { "start": "<date>", "end": null } }` or `{ "type": "date", "value": null }`, a relation `{ "type": "relation", "value": [<page ids>] }`, a checkbox `{ "type": "checkbox", "value": <bool> }`.
- With `--record-only`, the decision is recorded and no entry is returned. `notion_writes` is `[]` when there is none; `sync apply` returns the same array for its decisions (§5.14.3). The skill writes each entry and reports the result with `proposal settle` (§5.6, assistant.md §6.4).

**`new_task` (0.17.0).** Its entry creates a Tasks row (schema §11.2). From 0.18.0 it carries the Area too: the project's `area`, when published and mapped (capture-and-review §6.5).

**`set_field` (0072, 0092).** Applied like a correction of that field (below), with the stale rule of `update_fact`: the target's current `field` must still equal `before` (both absent counts as equal), else the proposal is closed `STALE_PROPOSAL`. A decision or question that has `projects` by then is closed `STALE_PROPOSAL` too, naming them (§5.6). `fix` takes one `{value}`: another id of the field's type. On a source or a whole Document, every other note of its group (§5.6) gets `area` = the same value, whatever it held; nothing else of a source changes (its body, `content_hash` and every other field stay as they are, schema §4 source). Write set: the target and, on a group, every other note of it whose `area` changes; `updated` = today on each. The next `sync render` publishes the project's Area, the Area's Domain relation or the Document's Area. A decision or question has no Notion page (0099), so a moved one shows its new area in the views (schema §16.3) and the index; a moved source's Inbox row gets the source's new `area` once, replacing the Area it has (§5.14.4, CC-271).

Each applied or closed proposal logs `apply <prp-id> "<title>" result=<applied|closed>`.

**`notion_correction`: your corrections from Notion** (0023, refined by 0027; asked in the session since 0.16.0, 0101 §4). `sync apply` writes them pending (§5.14.3), and the session asks them all as one question (capture-and-review §7.5). An `approve` applies `after`; a `fix` (one `{value}`, of `after`'s shape) applies the value you gave instead. The `field` decides how:

| `field` | Effect |
|---|---|
| `facts.<key>` | As `update_fact` with `source: notion-edit` and `from` = `learned` = the date of `observed_at`: accepted entries for the key become `superseded` with `until`; append the accepted entry; set `facts.<key>`. On a `fix`, the entry's `source` is `user-correction:<proposal id>` instead (capture-and-review §7.7) |
| `title`, `summary`, `why` | Replace the value. These are not facts, so there is no timeline entry; Git keeps the history |
| `area`, `goal`, `client`, `org`, `domain` | Set to the given ID (right prefix, must exist), or remove when the value is `null`. `domain` is an Area's Domain (0055) |
| `people` | Replace with the given list of `per-` IDs |

The same table is how a `set_field` and a `review_notes` fix set a field (above, schema §11.3). Corrections apply to knowledge notes only (not sources, views or proposals); a `field` outside the table → `failed`, `FIELD_NOT_CORRECTABLE`, proposal unchanged. **Stale:** the target's current `field` must still equal `before` (both absent counts as equal), else the proposal is closed `STALE_PROPOSAL` and nothing else is written. **S follows the decision:** an approve, a fix and a `reject` each set the target's `notion_published[property]` to `notion_value` in the same operation. For `Key Facts/<key>`, only that key of S changes: S's Key Facts text is parsed, the key set to `notion_value`, and the text written back by §5.14.4's Key Facts rule, so a waiting correction of another key keeps its own S. So after an approve Notion and Git agree and nothing is sent; after a fix or a reject B differs from S, and the next `sync render` publishes the brain's value over the edit (§5.14.4): the rejected edit is put back. The session publishes after its `apply`, as an ingest does (capture-and-review §7.3, step 4) and a catch-up does at its end; a run that doesn't publish leaves it to the next one. If the property is edited in Notion again before that publish, the next plan finds N ≠ S and B ≠ S: a convergence when N = B, otherwise a `BOTH_CHANGED` conflict, asked as any conflict is (§5.14.2), not a new correction. A value equal to the current one changes only S; the proposal is still applied. `--record-only` records the decision and applies nothing, as for any proposal: your Notion edit is no longer applied without your yes.

**`tracked_task` (0.16.0, 0101 §6; capture-and-review §7.5).** Decided with `fix` or `reject` (`approve` → `failed`, `INPUT_INVALID`): `fix` `[{ "answer": "<one sentence>" }]` records the answer (a), `fix` `[{ "drop": true }]` drops the question (b), and `reject` keeps it open (c), each as schema §11.2 says. A question no longer open, or whose `task` isn't the proposal's `page`, closes an (a) or (b) `STALE_PROPOSAL`. Nothing is written to Notion, so there is no `notion_writes` entry.

```json
{ "data": {
    "dry_run": false,
    "decisions": [
      { "proposal": "prp-8m3k5q2w", "kind": "notion_correction", "action": "approve", "result": "applied", "changed": ["_proposals/2026-12-05-maria-lopez-role-product-lead.md", "knowledge/people/maria-lopez.md"] },
      { "proposal": "prp-3c8v1n5x", "kind": "update_fact", "action": "approve", "result": "applied", "changed": ["_proposals/2026-12-03-acme-launch-jan-feb.md", "projects/acme-website/project.md"] },
      { "proposal": "prp-2v6n8q4j", "kind": "update_fact", "action": "edit", "result": "closed", "reason": "STALE_PROPOSAL", "message": "facts.role is \"Product lead\" (the correction from Notion above), proposal expected \"Designer\"", "changed": ["_proposals/2026-12-03-maria-lopez-role.md"] }
    ],
    "notion_writes": [],
    "summary": { "applied": 2, "closed": 1, "recorded": 0, "awaiting_notion": 0, "skipped": 0, "failed": 0 }
} }
```

Exit 1 if any item `failed` (a stale proposal is `closed`, not failed). Errors (whole command): `INPUT_UNREADABLE`, `INPUT_INVALID`.

After `apply`, skills run `index`, `views`, `lint`, then commit.

### 5.8 `brain index`

```text
brain index [--check]
```

Regenerates `index.md` exactly as schema §13 specifies (CX-04), and from 0.14.0 the structure block of the brain's `AGENTS.md` (§5.8.1, 0089). `--check` writes nothing and exits 1 if `index.md` or the structure block would change. A file whose frontmatter cannot be parsed is left out, with a warning `UNPARSEABLE` (lint reports it as an error); a duplicate ID keeps the first by path order, with a warning `DUPLICATE_ID`. Index never fails on content problems.

`data` (the agent-facing index):
```json
{ "data": {
    "written": true,
    "stale": false,
    "path": "index.md",
    "counts": { "area": 1, "project": 1, "person": 2, "org": 1, "meeting": 2, "decision": 2, "question": 1, "source": 2, "view": 2, "proposal": 2, "memory": 1, "goal": 1, "reference": 0 },
    "notes": [
      {
        "id": "prj-9x4t1b7e", "type": "project", "title": "Acme website",
        "path": "projects/acme-website/project.md",
        "summary": "Rebuild of Acme's marketing website, launching February 2027.",
        "lifecycle": "reviewed", "aliases": ["acme site"], "tags": [],
        "area": "area-2m7c4h8n", "projects": [], "updated": "2026-12-03", "notion": "2c4e6a80-1b3d-4f50-9a7c-8e6d4b2a0f13",
        "fields": { "status": "Active", "client": "org-6d1f9z3k", "goal": "gol-4p9r2w6t" }
      }
    ],
    "backlinks": {
      "mtg-8c4n2p7w": [ { "type": "decisions", "source": "dec-7k2m9q4x" }, { "type": "questions", "source": "que-8n3v5x1d" } ],
      "prj-9x4t1b7e": [ { "type": "project_of", "source": "dec-7k2m9q4x" }, { "type": "project_of", "source": "mtg-8c4n2p7w" } ]
    }
} }
```

- `notes` lists **every** note (§3.7), including sources, views, proposals and memories, sorted by `path`. Keys absent in the file are `null` (scalars) or `[]` (lists). `lifecycle` is `null` for source, view, proposal.
- `fields` per type, raw values (IDs, not titles); absent → key omitted:

  | Type | `fields` keys |
  |---|---|
  | goal | `status` (`notion_fields.status`), `deadline` (`facts.deadline`) |
  | project | `status` (`notion_fields.status`), `client`, `goal` |
  | person | `org`, `role` (`facts.role`) |
  | org | `relationship` (`notion_fields.relationship`) |
  | decision | `date`, `assessment` |
  | question | `kind`, `status` (`answered`, `dropped`, `tracked` or `open`, derived as in schema §13; `notion_fields.status` until 0.16.0) |
  | meeting | `date` |
  | source | `source_key` |
  | view | `view_kind`, `project` |
  | proposal | `kind`, `status`, `target` |
  | memory | `scope` |
  | area, reference | — (a reference's place is in `area` and `projects`, 0045) |

- `backlinks` (schema §6): computed inverses. Keyed by target id (sorted); each list sorted by `type`, then `source`. Built from relation types `about` → `mentioned_in`, `depends_on` → `needed_by`, `contradicts` → `contradicts`, `derived_from` → `used_by`, `related_to` → `related_to`, and from fields `projects` → `project_of`, `area` → `area_of`, `goal` → `goal_of`, `client` → `client_of`, `org` → `member`, `attendees` → `attended`, `decided_in` → `decisions`, `raised_in` → `questions`. The persisted pair `supersedes`/`superseded_by` is not included. Links to missing IDs are left out (lint reports them). Notes with no backlinks have no key.
- `written`: the file was rewritten (only when its bytes change). `stale`: `index.md` or the structure block is still out of date after the command, so it is `true` only with `--check`.
- `structure` (0089, §5.8.1): `{ "path": "AGENTS.md", "action": "created"·"updated"·"removed"·"unchanged"·"skipped" }`, what the command did to the structure block; with `--check`, what a run would do, and nothing is written. `skipped` comes with warning `AGENTS_BLOCK_NOT_FOUND` when there was a block to write or remove.
- Scan warnings: `UNPARSEABLE`, `NOT_A_NOTE` (no frontmatter, or no `id`), `UNREADABLE`, `SKIPPED_SYMLINK` (symbolic links are not followed), `DUPLICATE_ID`. A leading byte-order mark is ignored.

**Restricted evidence (0055, capture-and-review §5.1; eligibility.md §6 rule 5, §8).** The index is a published surface: it describes each note in the form the exclusion rule leaves it, and every note stays listed, since it may be independently supported.
- **A note restricted whole, or with a restricted claim** (a blanked body line, a dropped timeline entry or fact: the awaiting-cleanup form of §5.13) keeps no title, alias, summary or tags. In `index.md` its line is `- (title withheld: awaiting cleanup) — <id>` followed by its per-type fields that name no content (dates, enumerations, `notion_fields` values, a live fact, and references rendered as schema §13 says), with no link, so the file name, which repeats the title, isn't shown either; it sorts as an empty title, before the titled notes of its section. A reference from another note's line to it renders its id, not its title. In the JSON index its `title`, `path` and `summary` are `null` (the file name repeats the title), its `aliases` and `tags` `[]`, and a restricted fact is left out of `fields`; the list keeps its order by the file's path.
- **A note whose only change is a dropped `summary`** (it rests on a changed input it isn't resolved for, but every claim it makes is live) keeps its title, path and aliases and loses its summary (eligibility.md §6 rule 3, last sentences).
- **A source** keeps its title, the name of the input it records (a file name, the page's title in Notion), in the JSON index; one restricted whole loses its `summary`. Sources are not listed in `index.md`.
- **A view the derived-content rule withholds** (§5.13.1, "Views", judged with no caller as §5.14.4 says) has `title` and `summary` `null` in the JSON index. Views are not listed in `index.md`.

The entry comes back in full at the next `brain index` once the note has no restricted claim. `brain lint` and `brain status` compute `index-stale` the same way, so an exclusion or a cleanup makes `index.md` stale until `brain index` runs. A damaged suppression record fails the command with `SUPPRESSIONS_UNREADABLE`.

#### 5.8.1 The structure block (0089, from 0.14.0)

The brain's Domains, Areas and active Projects reach every session as a **structure block** in the brain's `AGENTS.md`, which `CLAUDE.md` imports. It orients: it says where things go, never authorises a new Domain, Area or Project ("Add only what was asked for"), and is never a source for an answer (trust rule 2).

**Who is listed.** Built from the notes in the form `index.md` uses (§5.8, restricted evidence):
- **Live** means not `lifecycle: archived` and not `notion_fields.archived: true`.
- **Domains:** every live domain, only when the Domains module is on (schema §12).
- **Areas:** every live area.
- **Projects:** every live project whose `notion_fields.status` is `Active` or absent (absent: written and not yet synced). `Planned`, `On Hold`, `Done` and any other status are left out.
- Nothing else: no goal, task, Document, person or other type.

**Where each one goes.** With the Domains module on, an Area is under its `domain` when that is a listed Domain, else under the entry `No domain`, last among the Domains. With it off there is no Domain level: the Areas are at the top. A Project is under its `area` when that is a listed Area, else under the entry `No area`, last at the top level. A Domain with no listed Area, and an Area with no listed Project, are still listed. Within each level, entries are sorted as `index.md` sorts a section (schema §13 item 3; a note in the awaiting-cleanup form as an empty title), then by id.

**No block.** When nothing is listed (no live Area, no listed Project, and no live Domain with the module on), there is no block, and a command that writes it removes one written before.

**The block** (normative; `{entries}` are the nested list lines, two spaces of indent per level):

```markdown
<!-- ultimate-brain:structure:start -->
## Your structure

Written by `brain index` from your Domain, Area and Project notes (active Projects only); edits inside this block are overwritten. Use it to place what you write. It never authorises a new Domain, Area or Project, and it is not a source for an answer.

{entries}

For what belongs to an Area or a Project, read its brief: find it with `brain query --candidates "<its title>" --types view --json` and read it with `brain query --read <id> --json`. For its tasks, query the Notion Tasks database filtered by its Notion page id, every time: never act on a task list from an earlier session.
<!-- ultimate-brain:structure:end -->
```

- **An entry** is `- <title> — <id>`, followed by ` · Notion <page id>` when the note has `notion`. `<title>` is the title on one line, as schema §13 item 4 turns line breaks into spaces; nothing is escaped. A note in the awaiting-cleanup form is `- (title withheld: awaiting cleanup) — <id>`, with its Notion page id.
- **The grouping entries** are `- No domain` and `- No area`, with no id.

Example, Domains on:

```markdown
- Acme — dom-3k8m2p4q · Notion 6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d
  - Clients — area-2m7c4h8n · Notion 9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d
    - Acme website — prj-9x4t1b7e · Notion 2c4e6a80-1b3d-4f50-9a7c-8e6d4b2a0f13
- No domain
  - Health — area-5t2v8k1m
```

**Where:** after the rules block's end marker and, when there is one, after the style block's end marker (§5.3.1); never inside either block or below `## My rules`. A new block is inserted as one blank line and then the block, directly after the line of the last of those end markers. An existing block (both structure markers, once each, in order, after those end markers) is replaced in place. Removing a block deletes its lines and the one blank line before its start marker, so adding then removing restores the bytes. Writing the style block keeps a structure block after it (§5.3.1).

**Written by** `brain index` (every skill runs it after every write, so every path that creates, takes in, renames, archives, merges or moves a Domain, Area or Project refreshes the block) and `brain upgrade` (§5.15 step 1b). `brain init` writes none: a new brain has no structure.

**Not written** when `AGENTS.md` is missing or a symbolic link, or its rules, style or structure markers are missing, out of order or duplicated: `action` `skipped`. A symbolic link or bad markers also give warning `AGENTS_BLOCK_NOT_FOUND` when there is a block to write or one to remove; a missing `AGENTS.md` gives none (`brain upgrade` creates it, with the block). Nothing outside the structure markers changes, and `index.md` is still written.

**Stale:** `brain index --check`, and the `index-stale` check of `brain lint` and `brain status` (§5.10, §5.2), count a structure block that `brain index` would write, replace or remove. A file it would skip is not stale.

### 5.9 `brain views`

```text
brain views [--project <id> | --area <id>] [--check]
```

Regenerates `brief.md` and `decision-log.md` for every project (in `projects/` and `archive/projects/`), or one project, and `areas/briefs/<slug>.md` for every area, per schema §16 (CX-07, 0041). Reports are never touched. Creates missing view files (with a new `vw-` id). Replaces only the generated block; the `@user` block is preserved byte for byte. Idempotent per schema §16. An existing view file without exactly one well-formed `@generated` block is **not** rewritten (it may hold your text): it is listed in `errors` as `{path, reason: "MARKERS_INVALID"}` and the command exits 1.

```json
{ "data": {
    "projects": 1,
    "areas": 1,
    "written": ["areas/briefs/clients.md", "projects/acme-website/brief.md"],
    "created": [],
    "unchanged": ["projects/acme-website/decision-log.md"],
    "errors": [],
    "check": false
} }
```

`--project` rebuilds only that project's two views, `--area` only that area's brief. `--check`: writes nothing, lists what would change in `written`/`created`, exit 1 if any. Errors: `UNKNOWN_ID` (`--project`, `--area`).

**Restricted evidence (0055, capture-and-review §5.1; eligibility.md §6 rule 5).** Views render only eligible evidence: with an active suppression in `_suppressions/`, a note that rests only on a suppressed passage, or on a changed input it cannot map (or of unknown lineage), is left out, and a restricted statement is removed from its note's text before rendering. A note with a restricted claim (the awaiting-cleanup form of §5.13) is shown by its type and id only: its item line has `<type> <id>, title withheld: awaiting cleanup` in place of the linked title (`- 2026-11-03 — decision dec-7k2m9q4x, title withheld: awaiting cleanup (accepted)`), no link, and nothing of its title, aliases, summary or tags; the line's other parts (a date, an assessment, a status, a role fact that is live) name no content. Such a line rests on no text of the note, so the note is not in `generated_from`. Its title comes back at the first `brain views` after the note's cleanup resolves it. A new view whose project or area has a restricted claim, or is restricted whole, is titled `<type> <id>, title withheld: awaiting cleanup — brief` (or `— decision log`). `brain lint` computes `view-stale` the same way, so a suppression or a cleanup makes the affected views stale until `brain views` or `brain source extract` regenerates them. Whether a view may be read at all is §5.13.1's rule ("Views").

### 5.10 `brain lint`

```text
brain lint [<path>…] [--strict]
```

Validates the brain against schema §15 (CX-05). With paths (relative to the brain), only issues **in those files** are reported, but cross-file checks still read the whole brain. `brain.json` is always checked. Exit 1 if any error, or any warning with `--strict`.

```json
{ "data": {
    "errors": 1,
    "warnings": 1,
    "files": 24,
    "issues": [
      { "severity": "error", "rule": "missing-ref", "path": "knowledge/decisions/2026-12-03-use-supabase-for-auth.md", "line": 9, "id": "dec-7k2m9q4x", "message": "decided_in mtg-0000aaaa does not exist" },
      { "severity": "warning", "rule": "freshness", "path": "knowledge/people/maria-lopez.md", "line": 18, "id": "per-3h8w2n6c", "message": "\"currently\" in an undated note without (as of YYYY-MM-DD)" }
    ]
} }
```

The skill rules (`product-file` for skills, `skills-*`, `skill-*`) have `line` 1 and `id` `null`, and are reported at the path the table names; a path filter keeps them only when it matches that path. Issues have severity `error`, `warning`, or `info`. Information is listed in `issues` but is counted as neither an error nor a warning, and does not make `--strict` fail. Domains remain linted even while their module is off. Issues are sorted by `path`, `line`, `rule`, then `message`. `line` is 1-based: the line of the offending frontmatter key or body line, or 1 when not locatable. `id` is `null` when the file has no readable id.

| Rule | Sev | Schema §15 item |
|---|---|---|
| `not-a-note` | error | `.md` in a note folder without frontmatter `id` (§3.7) |
| `unparseable` | error | frontmatter is not valid YAML |
| `schema` | error | frontmatter fails the JSON Schema (incl. missing required field, summary > 400) |
| `brain-config` | error | `brain.json` fails its schema (lint runs even then, §4) |
| `id-format` | error | malformed ID, or a prefix that is not one of schema §1 (the prefix may differ from the current `type`, which can change) |
| `id-duplicate` | error | same ID in two files |
| `wrong-folder` | error | type outside its folder (schema §2); a source outside the folder of its key (`sources/notion/`, `sources/files/`, `sources/text/`); a view outside the folder of its `view_kind` |
| `missing-ref` | error | frontmatter reference or relation target does not exist |
| `broken-link` | error | relative Markdown link to a missing file, in a note the brain writes: not checked in a source or a Document with `origin: whole` (0091) |
| `wikilink` | error | `[[…]]` in the body of a note the brain writes (0002): not checked in a source or a Document with `origin: whole`, whose text is kept as it is (0091) |
| `unknown-marker` | error | `^[…]` other than `^[inferred]`, `^[ambiguous]`, in a note the brain writes: not checked in a source or a Document with `origin: whole` (0091) |
| `source-hash` | error | source body does not match `content_hash` |
| `view-cited` | error | a note's `sources` cites a view |
| `fact-timeline` | error | `facts` key without matching accepted timeline entry (unless contested) |
| `supersession-pair` | error | one side of `supersedes`/`superseded_by` missing |
| `meeting-backref` | error | `decided_in`/`raised_in` disagree with the meeting's lists |
| `superseded-valid-until` | error | superseded decision without `valid_until` |
| `superseded-unlinked` | error | superseded decision without a `superseded_by` relation (0005) |
| `decision-sources` | error | decision without `sources` (0005) |
| `memory-scope` | error | memory reach lists do not match `scope` |
| `proposal-status` | error | proposal `status` and `decision` do not match schema §11.1 |
| `notion-parts` | error | a source's `notion_parts` names a part above its body's part count (schema §4) |
| `review-notes` | error | a `review_notes` lists a note that isn't a knowledge note, or a note another `review_notes` also lists (0041), unless one excluded it and the other has `deferred_from` = that one (0045) |
| `source-replaces` | error | a source's `replaces` names a note that isn't a source (a missing id is `missing-ref`), or a source two others replace (0045) |
| `unknown-lineage` | warning | a knowledge note's `sources` names a source or meeting whose input cannot be determined (no `source_key`, `extract_of` or meeting `source`): its evidence is never live while any suppression is active (0055, capture-and-review §5.1) |
| `report-source-excluded` | warning | a line of a report links a note that a suppression restricts (whole, or some of its lines, timeline entries or facts): flagged "(source excluded)" at that line, never edited by the brain; the next refresh is written from `brain query`, which leaves the restricted claims out (capture-and-review §5.1) |
| `workflow-record` | error | a record under `_workflows/` that isn't readable JSON or fails its `spec/schemas/workflow.schema.json` definition, a record whose id isn't its file name, or an item's `depends_on`, an artifact's `item`, an operation's `target` or an adoption map entry naming a record that doesn't exist (connected-workflows.md §12) |
| `factory-record` | error | an entry of `brain.json` `factories` that breaks a check of schema §12 (a repeated id, name, repo or path; a repo, Area or Project that doesn't exist), or a non-ended workflow whose `destination.factory` is no entry (0.18.0). One issue per problem, at `brain.json`, line 1 |
| `assistant-dismissals` | error | `_assistant/dismissals.json` (when present) isn't readable JSON, fails `$defs/dismissals` of `spec/schemas/assistant.schema.json`, or repeats a `key` ([assistant.md](assistant.md) §8); `assistant findings` refuses with `DISMISSALS_UNREADABLE`. One issue per problem, at that path, line 1 |
| `weekly-state` | error | `_weekly/state.json` (when present) isn't readable JSON, fails the state schema of `spec/schemas/weekly.schema.json`, or repeats a `key` in `shown` or `queued` or a week in `weeks` ([weekly-review.md](weekly-review.md) §9.5; 0.15.0); `weekly plan` refuses with `WEEKLY_STATE_UNREADABLE`. One issue per problem, at that path, line 1 |
| `suppression-record` | error | a file of `_suppressions/` (or the folder) cannot be read or is malformed (0055, capture-and-review §5.3); retrieval commands refuse with `SUPPRESSIONS_UNREADABLE` |
| `proposal-items` | error | a `review_notes` `items` list that does not give every note, link and change exactly one immutable `it-` id, an item that refers to something the proposal does not hold, or an `item_decisions` entry that names no item or repeats one (0055, capture-and-review §7.2) |
| `proposal-fingerprint` | error | a proposal's `fingerprint` that doesn't match it (schema §11.4): its `target`, `field`, merge pair (`target` and `merge_into`, different and sorted), a promotion's `source`, a theme's one learned Document; or an `evidence` id that names no meeting or source (0052, 0076) |
| `extract-passages` | error | an extract source's `passages` does not list the `<!-- passage ¶n -->` paragraphs of its body in order, or a paragraph no longer matches its 8-hex hash (0055, capture-and-review §4.5) |
| `passage-ref` | error | a `^[src-…#¶n:hash]` in a note body names a source that is not an extract, a passage it does not hold, or the wrong hash; or a note lists an extract in `sources` but cites none of its passages (0055, capture-and-review §5.1) |
| `update-body` | error | an `update_body` proposal, or an `update_body` entry of a `review_notes`'s `changes`, whose target isn't a `reference` (0045) or is a `promoted` one (0049); an `update_body` entry is folded only in a proposal written before 0.16.0 (§5.6) |
| `promoted-from` | error | a Document's `promoted_from` names a note that isn't a decision, or a learned Document with a `con-` id (a concept promoted before 0.9.1) (a missing id is `missing-ref`; set without `origin: promoted` is `schema`) (0049, 0071) |
| `concept-retired` | error | a `type: concept` note: `concepts are learned Documents since 0.9.1; run brain upgrade` (0071, §5.15 step 5a) |
| `product-file` | error | product-owned content differs from the installed package (§5.15, 0038) or, for skills, from the pin (0059, skills-delivery §6.4). Skills are compared against the lock (`pinned`, `drift`, `missing`, `incompatible`), against the package snapshot while `unpinned`, and not at all while `invalid`. One issue per case: a pinned skill's folder missing from `.agents/skills/` or `.claude/skills/` (path = the folder); a listed file in it missing, not a regular file or with different bytes; an entry in it the snapshot doesn't list (an unlisted folder is one issue); `AGENTS.md` missing, its rules markers missing, out of order or duplicated, or its block differing from the template's (path `AGENTS.md`; always against the package); `.claude/agents/ultimate-assistant.md` missing or differing from the template's (that path; always against the package, [assistant.md](assistant.md) §10). Folders the snapshot doesn't name are not checked. The message names the snapshot (`ultimate-brain-skills 1.2.0`; `ultimate-brain <version>` for `AGENTS.md`) and says: run `brain upgrade`, or file a finding. While `unpinned`, an invalid package snapshot is the broken-install case (§5.15) |
| `skills-lock` | error | `skills.lock.json` is invalid (§5.28): `skills.lock.json is invalid (<reason>); run brain upgrade to rewrite it` |
| `skills-incompatible` | error | the pin excludes the running CLI: the `SKILLS_INCOMPATIBLE` message (§5.28) |
| `skills-unpinned` | info | no `skills.lock.json`: `skills are not pinned; run brain upgrade to pin them` |
| `skills-update-available` | info | the pin is `pinned` or `drift` (lint doesn't tell them apart) and the package snapshot is compatible and has the pin's name with a higher version, or another name: `<package name> <version> is available (pinned: <name> <version>); run brain upgrade` |
| `skill-duplicate` | error | a folder of a tree other than `N/` whose `SKILL.md` names a checked skill `N` (skills-delivery §5.2): `<path> also defines skill <N>; remove it, the pinned copy is <tree>/<N>` |
| `skill-competing` | warning | a global copy (`~/.claude/skills/N`, `~/.agents/skills/N`, `~/.codex/skills/N`, any entry type) or the retired plugin enabled in `~/.claude/settings.json` or the brain's `.claude/settings.json` (skills-delivery §5.2). Paths keep the literal `~/`; without `HOME` the home checks are skipped |
| `orphan` | warning | a `reviewed` knowledge note other than a domain, area, goal, project, meeting or memory, with no `area` and no `projects`, that no other knowledge note references or links (its id in any frontmatter field, a relation, or a body link to its file); proposals, views and sources don't count: `nothing links to it and it has no project or area` (0052) |
| `note-size` | warning | a knowledge note whose body is over 10 KB (10,240 bytes of UTF-8): every knowledge type except Documents (`reference`) whose `origin` is `whole`, `part` (or absent) or `workflow`, which hold whole texts on purpose; learned and promoted Documents are checked, since they hold the brain's or the user's own text (0076 §7). Sources aren't knowledge notes and aren't checked |
| `near-duplicate` | warning | a pair the `near_duplicate` signal finds (§5.32: one type, `draft` or `reviewed`, the same types left out, a name of one matching a name of the other), unless the pair's `merge:` fingerprint is held (schema §11.4: waiting for a decision, or skipped): one warning per pair, at the path of the note whose path sorts first, `may be the same <type> as "<title>" (<path>)` naming the other (0052) |
| `unknown-key` | warning | frontmatter key that the type's schema does not declare: the core fields, plus the knowledge fields (knowledge types), plus the type's own fields. `why` on a person is unknown |
| `freshness` | warning | schema §10 |
| `summary-length` | warning | summary longer than 200 characters |
| `no-sources` | warning | knowledge note without `sources`, except area, goal and project (often created in Notion) and decisions (an error, above) |
| `view-stale` | warning | a view's generated block is out of date |
| `index-stale` | warning | `index.md` would change on `brain index` (path `index.md`), or the structure block of `AGENTS.md` would (path `AGENTS.md`, §5.8.1) |

### 5.11 `brain log`

```text
brain log <op> [<id>] [--title <title>] [<key>=<value>…]
```

Appends one line (§3.9) for operations the CLI cannot see, such as a whole ingest. `<op>` matches `^[a-z][a-z0-9-]*$`; `<id>` must exist if given (`-` for none); title defaults to the note's title.

```sh
brain log ingest mtg-8c4n2p7w created=4 proposals=3 tasks=1 --json
```
```json
{ "data": { "path": "log/2026-12.md", "line": "- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w \"Acme sync\" created=4 proposals=3 tasks=1" } }
```

Errors: `USAGE` (bad op or key=value), `UNKNOWN_ID`.

### 5.12 `brain link`

```text
brain link <repo-path> [--project <id>] [--area <id>] [--stack <name>]… [--repo-name <name>]
```

Connects a consuming repo, or any working folder, to the brain (0006, 0009; CX-08). Allowed root: `<repo-path>`; writes only `.brain`, `AGENTS.md`, `CLAUDE.md`, and the folders of the linked skills in `.agents/skills/` and `.claude/skills/` there (`brain-query`; from the 0.9.2 snapshot also `brain-workflow` and `brain-workflow-adopt`, skills-delivery §9.7). Refuses if `<repo-path>` is the brain or the product repo, or if any part of a linked or retired skill folder is a symbolic link or the wrong file type (`OUTSIDE_ROOT`, before any write). The brain passes the pin guard first (§5.28); the linked repo has no pin and is not guarded.

1. **`.brain`** (JSON, committed with the repo; holds no machine paths):
   ```json
   { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["nextjs", "supabase"] }
   ```
   `repo` = `--repo-name`, else the folder name. `skills` (0059, skills-delivery §6.2) is replaced on every run: `{ "name", "version", "integrity", "names" }` of the snapshot the linked skills came from, `names` sorted; an existing `.brain` whose `skills` is not an object of three strings and a `names` list of kebab-case skill names fails `INPUT_INVALID`. `stacks`: lowercase kebab-case, deduped, sorted. If `.brain` exists, options given replace their keys; others are kept. When `--project` is given without `--area`, `area` is set to that project's `area` (replacing any old value). All keys optional; `project`/`area` must exist in the brain. Written as JSON with 2-space indent, keys in the order `repo`, `project`, `area`, `stacks`, `skills` (absent keys left out), and a trailing newline.
2. **Instruction block** in `AGENTS.md` (created if missing). If `CLAUDE.md` exists and has no line `@AGENTS.md`, the block is also written there; if `CLAUDE.md` does not exist, it is created with the single line `@AGENTS.md`. If `CLAUDE.md` is a symbolic link that resolves to this repo's `AGENTS.md` (a regular file), it is left alone and reported `unchanged`: the block reaches it through the link. Any other symbolic `CLAUDE.md` (to another file, out of the repo, or dangling) is refused with `INSTRUCTIONS_SYMLINK` before any write, and the message says to replace it with a file holding the line `@AGENTS.md` or to point it at `AGENTS.md` (CC-132). A symbolic `AGENTS.md` is still refused with `OUTSIDE_ROOT`. The block sits between the lines `<!-- ultimate-brain:start -->` and `<!-- ultimate-brain:end -->`; an existing block is replaced in place, otherwise it is appended after one blank line. Nothing outside the markers changes.

Block text (normative; `{…}` filled from the brain; the `- Project:` and `- Area:` lines are left out when `.brain` has no project or area, and the line before them then ends with `.` instead of `:`; the `- Domain:` line (0089, from 0.14.0) is there only when the brain's Domains module is on and the Area's `domain` names a domain note that is not archived (`lifecycle: archived` or `notion_fields.archived: true`): a linked folder shows its own place, never the rest of the brain's structure, because its block is committed in a repository other people may read; the workflow lines below are added when their skills are linked):

```markdown
<!-- ultimate-brain:start -->
## Ultimate Brain

Managed by `brain link`; edits inside this block are overwritten.

This repo is linked to the user's second brain:
- Project: {project title} (`{project id}`)
- Area: {area title} (`{area id}`)
- Domain: {domain title} (`{domain id}`)

The brain holds decisions, key facts, people and meeting history that this repo does not.

Consult it before you:
- make or revisit a decision about scope, architecture, vendors or the client;
- answer why something was decided, who someone is, or a date, budget or owner;
- rely on a fact about the client or project that this repo does not state.

How: use the `brain-query` skill, or run `brain query --candidates "<question>" --json` and read the notes it returns with `brain query --read <id> --json`, not by opening the brain's files: only these commands leave out what the user excluded or has not approved. Cite each note by its path, or by its `cite` when it has none. Say when a fact is `contested` or `superseded`; read a replaced memory only with `--historical`, for a question about the past.

The brain is read-only from this repo. Never edit its files from here.
<!-- ultimate-brain:end -->
```

**Workflow lines** (skills-delivery §9.7). When the linked skills include `brain-workflow`:
- a paragraph goes between the `How:` paragraph and the read-only line, with one blank line before and after it: ``To track this repo's work, the standard way or connected to a Notion Project or Area, use the `brain-workflow` skill.`` When the linked skills also include `brain-workflow-adopt`, its final `.` is replaced by ``; to take over its existing plans and tasks, use `brain-workflow-adopt`.``
- the read-only line gains, after one space, ``A connected workflow's records change only through `brain workflow` commands.``

With all three skills linked, the end of the block reads:

```markdown
To track this repo's work, the standard way or connected to a Notion Project or Area, use the `brain-workflow` skill; to take over its existing plans and tasks, use `brain-workflow-adopt`.

The brain is read-only from this repo. Never edit its files from here. A connected workflow's records change only through `brain workflow` commands.
<!-- ultimate-brain:end -->
```

With only `brain-query` linked and `settings.recall` not `opening`, the block is exactly as before 0.9.2: no workflow paragraph, and the last line ends after `from here.`.

**Factory paragraph** (0.18.0, 0113 §5; linked-repos.md §8, connected-workflows.md §15). When the brain's Factories module is on, the folder is the folder of a Factory that isn't archived (real paths compared), a workflow whose destination is that Factory isn't ended, and the linked skills include `brain-workflow`, a paragraph goes right before the workflow paragraph, with one blank line before and after it:

```markdown
This folder is the Factory **{factory name}** in Notion. Start a session here with the `brain-workflow` skill, which reads this Factory's open tasks (To Do and Doing). With no request from the user, list them and ask which one before you plan anything; with a request, stop only if one of them might be it. Agree how to do a task before you build it. At the end set its status and write the Factory's overview.
```

and the read-only line gains, after the workflow sentence and one space, ``Its overview changes only through `brain factory overview`.`` In every other case there is none, a run of `brain link` removes one an earlier run wrote, and the block is exactly as in 0.17.0. It names no task and nothing of the brain's content: the block is committed with the folder.

**Recall paragraph** (0074, [memory.md](memory.md) §7). When the brain's `settings.recall` is `opening` (schema §12), a paragraph goes right after the `How:` paragraph, with one blank line before and after it:

```markdown
At the start of substantive work, run `brain recall --pack --json` here and read its `text`: the user's lessons for this repo and where its work stopped. Mention a memory only when it shapes your approach. When the user says "wrap up", run the closing review of the `brain-query` skill: the lessons the user approves there are the one write this repo makes to the brain.
```

When `settings.recall` is `off` or absent, there is no recall paragraph, and a run of `brain link` removes one an earlier run wrote.

**Style paragraph** (0081, from 0.14.0; §5.3.1). When the brain's `settings.style` has style lines, the style paragraph goes right before the read-only line (after the workflow paragraph when there is one), with one blank line before and after it. With no style lines there is none, and a run of `brain link` removes one an earlier run wrote. The block of a brain with no style lines is exactly as before 0.14.0.

3. **Skills** (0029, 0038, 0059; skills-delivery §6.2): the **linked skills** are the skills of the source whose `targets` include `linked_repo`.
   - **Source.** A pinned brain (state `pinned` or `drift`): the files its lock lists, copied from the brain's `.agents/skills/<name>/`; before any write each must be a regular file with the locked bytes, and the first that isn't refuses `SKILLS_SNAPSHOT_MISSING` (§5.28) naming it. Unlisted files there and the brain's `.claude/skills` copy are ignored (lint covers them). An `unpinned` brain: the package snapshot, which must be compatible (else `SKILLS_SNAPSHOT_INVALID`), with warning `SKILLS_UNPINNED`.
   - **Writing.** For each linked skill, `.agents/skills/<name>/` and `.claude/skills/<name>/` are product-owned: files whose bytes differ are replaced, and files the snapshot doesn't list in that folder are removed.
   - **Retired linked skills.** A name in the previous `.brain` `skills.names` that is no longer linked has both its folders removed (each file `removed`, then the emptied folders). A `.brain` without `skills` retires nothing.
   - Nothing else under `.agents/` or `.claude/` is touched. Every skill file appears in `files` with its `action` (`created`, `updated` or `unchanged`), and a removed file appears with `action: "removed"`, e.g. `{ "path": ".agents/skills/brain-query/SKILL.md", "action": "created" }`.

Idempotent: a second run with the same options changes no bytes.

`brain upgrade` writes the same files, with no options, in every project registered in `brain.json` `repos`, and reports a project it can't finish instead of refusing (§5.15 step 9, 0077 §4). A folder linked here but not registered is refreshed only by running `brain link` there again.

```json
{ "data": {
    "repo_abs": "/Users/me/code/acme-api",
    "marker": { "path": ".brain", "written": true, "value": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["nextjs", "supabase"] } },
    "files": [ { "path": "AGENTS.md", "action": "created" }, { "path": "CLAUDE.md", "action": "created" } ],
    "skills": { "source": "brain", "name": "ultimate-brain", "version": "0.9.0", "integrity": "sha256-…", "names": ["brain-query"], "competing": [] }
} }
```
`skills.source` is `brain` or `package`; `competing` (skills-delivery §5.2) covers duplicates in the linked repo's two trees, global copies of the linked skills, and the retired plugin in `~/.claude/settings.json` and the brain's `.claude/settings.json`, with warning `SKILLS_COMPETING` when non-empty. `action` is one of `created`, `updated`, `unchanged`, and `removed` for a stale skill file. Paths here are relative to the repo.

Errors: `UNKNOWN_ID`, `OUTSIDE_ROOT`, `USAGE` (path missing or not a directory), `INPUT_INVALID` (a malformed `.brain`), the pin guard's codes (§5.28), `SKILLS_SNAPSHOT_MISSING`, `SKILLS_SNAPSHOT_INVALID`.

### 5.13 `brain query --candidates` and `--read`

```text
brain query --candidates "<question>" [--limit <n>] [--types <t>[,<t>…]] [--repo <path>]
brain query --read <id>[,<id>…] [--historical] [--repo <path>]
```

Returns ranked candidate notes for the query skill (CX-11); the skill reads them and writes the answer. `--read` returns notes in full, as retrieval may use them (§5.13.1); `--historical` goes only with it. **From 0.13.0 (0080, CC-205):** the ranking has the three English retrieval changes CC-204 chose (`eval/retrieval-0.13/compare/results-cc204.txt`): word forms and a small vocabulary map (step 1a, step 3), the subject the question names (step 3a) and fact and match-centred snippets (below the example), within [retrieval.md](retrieval.md)'s envelope (§2) and gates (§6). They apply to this command only: `brain recall` (memory.md §5.3, §6.1) and `brain reflect --candidates` (§5.32) rank as before, without them. `brain query` without `--candidates` or `--read`, with a question or without one (`brain query "what did we decide?"`), is `USAGE` with the message `brain query requires --candidates or --read; use the brain-query skill to answer questions`; with both it is `USAGE` (`brain query takes one of --candidates and --read`). With either, an extra argument is `USAGE` (`Unexpected argument: <it>`).

**Ranking (deterministic):**
1. **Tokens:** NFKD, drop combining marks, lowercase, split on runs outside `[a-z0-9]`, drop tokens shorter than 2 and these stopwords: `a an and are as at be by did do does for from has have how in is it of on or that the this to was we what when where which who why will with` and `al como con de del el en es la las lo los para por que se su un una y`. These are the **words**; the commands that cite this step read them.
   - **Terms** (this command's ranking and snippets only): NFKC the text, then cut it into maximal runs of CJK characters and runs of anything else. A CJK character is a code point in U+1100–11FF, U+3040–309F, U+30A0–30FF, U+3100–312F, U+3130–318F, U+31A0–31BF, U+31F0–31FF, U+3400–4DBF, U+4E00–9FFF, U+A960–A97F, U+AC00–D7AF, U+D7B0–D7FF, U+F900–FAFF, U+FF66–FF9F, U+20000–2FA1F or U+30000–323AF. The terms are the words of the other runs joined by one space, then each CJK run's n-grams in order: its 1-character n-grams left to right, then its 2-character ones, then its 3-character ones (`東京の予算` gives `東 京 の 予 算 東京 京の の予 予算 東京の 京の予 の予算`). No stopword or length rule applies to an n-gram. The query's terms keep their order and repeats; the output's `tokens` lists them.
1a. **Word forms (0080, this command's ranking and snippets only).** Every term that is a word of only the letters `a`–`z`, 4 or more of them, is replaced by its **stem**, in the note's terms and in the query's alike; digits, other words and n-grams are kept as they are. The stem, in this order:
   - **plural:** a final `ies` after at least 2 letters becomes `y` (`copies` → `copy`); else a final `sses`, `xes`, `zes`, `ches` or `shes` loses its `es` (`launches` → `launch`); else a final `s` goes, unless the word ends in `ss`, `us` or `is` (`budgets` → `budget`, `status` stays);
   - **`-ing`, `-ed`:** a final `ing` goes when at least 3 letters remain and they hold a vowel (`a e i o u y`; `launching` → `launch`, `string` stays); else a final `ed` goes when at least 4 letters remain and they hold a vowel (`launched` → `launch`, `speed` stays); either way a final doubled consonant other than `l`, `s` or `z` then loses one letter (`planned` → `plan`);
   - **final `e`:** a word still 5 letters or longer that ends in `e` loses it (`release` → `releas`, so `release`, `releases` and `released` match).

   The output's `tokens` are the query's terms before stemming. Accent folding (step 1) and the n-grams are unchanged.
2. **Searched:** knowledge notes and sources (default `--types`: all except view, proposal, memory), as the restricted-evidence rule below leaves them. A `memory` (searched only when `--types` names it) is searched only when it is **eligible** for the caller folder (memory.md §2: reviewed, not superseded, in the caller's reach, supported by eligible evidence), the caller being `--repo`, else the current directory (memory.md §2.1). So this command never returns a memory that `brain recall --search` withholds from the same folder.
3. **Score:** Okapi BM25 (k1 = 1.5, b = 0.75) over the searched notes, each note one document, as the restricted-evidence rule below leaves it (a field or line it withholds gives no term), whose terms are: the terms of its `title` and of each alias, three times; of its `summary`, twice; of every other frontmatter string value (facts and timeline values included), once; and of its body, once. A document's length |d| is its number of terms, repeats included; N is the number of searched notes and avgdl their mean length (1 when it is 0).
   - **Matching:** a query term that is a word matches every term of the document that starts with it (`deci` matches `decision`); an n-gram matches only itself. f(t, d) is the number of times the terms that t matches occur in d; df(t) is the number of documents where f(t, d) > 0.
   - **Vocabulary (0080):** a query term whose stem is the stem of a word in one of these groups is scored as one term made of the group: it matches every document term that starts with the stem of any of its words, f(t, d) is the sum, df(t) the documents with any. The groups, general business English, in full: `budget money spend` · `launch live` · `approve sign` · `release deployment deploy` · `invoice bill` · `backup copies` · `conference talk` · `sms text` · `postpone move` · `hourly hour` · `designer design` · `reply answer response`. No group names a project, client, person or product (retrieval.md §4 C2).
   - **Sum:** over the query's terms in order (a repeated term counts each time), idf(t) · f(t, d) · (k1 + 1) / (f(t, d) + k1 · (1 − b + b · |d| / avgdl)), where idf(t) = ln(1 + (N − df(t) + 0.5) / (df(t) + 0.5)). A term with f(t, d) = 0 adds nothing.
   - The formula and the n-grams are adapted from claude-obsidian's `scripts/bm25-index.py` (commit `2e545563`, MIT License), as eval/retrieval-0.12 compared them (decision 0074 §5).
3a. **The subject the question names (0080).** A **subject** is a searched note of type `project`, `area`, `org` or `person` that is not in the awaiting-cleanup form (below); each of its `title` and aliases, as the rule below leaves them, is a **name**, whose words are the stems of its words (step 1, 1a). A name is **named** when each of its words is a word of the query (stemmed); of the named names, one whose words are all among a longer named name's words is dropped (`Harlow` gives way to `Harlow web shop`). The question's subjects are the notes of the named names that remain; when there are none, the project the context names (step 4), if it is a searched note. The **subject's notes** are: the subjects; the searched notes whose `projects`, `project`, `area`, `client`, `org`, `people` or `attendees` holds a subject's id; the searched notes whose same fields hold the id of a project among those; and the searched notes the `source` or `sources` of any of them names. The **attribute terms** are the query's terms (with their groups) less the words of the named names. A subject's note adds to step 3's sum the sum step 3 gives it over the attribute terms only (the same N, avgdl and df). So the note that answers about the subject outranks a note that only names it, and a note about another subject gains nothing. The relation fields only select among notes already searched: no note is added, and a withheld note names no subject (retrieval.md §2.4, §2.5).
4. **Context boost:** if `--repo` (default: the current directory, when it has `.brain`) names a project, +3 to notes whose `projects` contains it or whose id is it; else, if it names an area, +2 to notes whose `area` is that area (per note: an area note outside the project still gets +2). It is added to step 3's sum. The marker is read as §5.12 step 1 defines it, `skills` included, by the one reader every command shares (CC-152): a `.brain` that is not valid JSON, or has a key §5.12 doesn't list, is `USAGE` naming the folder; a folder without one has no context.
5. **`score`** is the sum of steps 3, 3a and 4 rounded to 4 decimal places, halves up: a JSON number such as `9.25` or `3`. Notes whose `score` is 0 are dropped. Order: `score` descending, then `updated` descending, then id. Then, on that whole list and before `--limit` cuts it, a note with a `superseded_by` relation moves to right after the note it names when that note is in the list and ranks below it, repeated until no note moves (a relation on a cycle, such as A superseded by B superseded by A, moves nothing), so the live note comes first, as 0009 orders memories: B superseded by C ranks after C, and a chain A → B → C orders C, B, A. An old note whose successor falls beyond the limit falls with it. A note it names that isn't in the list moves nothing, and an archived or superseded note without the relation keeps its place. Superseded notes are still returned, so the answer can name them as history. Default limit 10, max 50.

```json
{ "data": {
    "query": "what did we decide about auth with Acme",
    "tokens": ["decide", "auth", "acme"],
    "context": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n" },
    "candidates": [
      { "id": "dec-7k2m9q4x", "type": "decision", "title": "Use Supabase for auth", "path": "knowledge/decisions/2026-12-03-use-supabase-for-auth.md",
        "summary": "Acme switches auth from Firebase to Supabase, agreed at the 3 Dec sync.", "lifecycle": "reviewed", "assessment": "accepted", "date": "2026-12-03",
        "score": 14.8312, "snippets": [ { "line": 22, "text": "Use Supabase for auth; Firebase is retired after launch." } ] },
      { "id": "dec-2p9f6h1r", "type": "decision", "title": "Use Firebase for auth", "path": "knowledge/decisions/2026-10-01-use-firebase-for-auth.md",
        "summary": "…", "lifecycle": "archived", "assessment": "superseded", "date": "2026-10-01", "score": 9.6075, "snippets": [], "superseded_by": "dec-7k2m9q4x" }
    ]
} }
```

`assessment` and `date` are `null` when the type has none. A note in its **awaiting-cleanup form** (below) has `title`, `path` and `summary` `null` and a `cite` key, which no other candidate has. A Document (`reference`) also has `origin` (absent = `part`), so the skill can say "a learned Document" (0071); other types have no `origin` key. A learned Document is a `reference`: `--types reference` finds it, and `--types concept` still matches a concept not yet converted by `brain upgrade`. A **memory** candidate also has `confidence`, its schema value (`verified`, `inferred` or `unverified`, schema "memory") as the rule below leaves the memory, so the answer can label an inferred memory as an inference (0074 §2; approval never makes it verified); a memory with no such value, and every other type, has no `confidence` key. Only a memory the command returns at all has it: a draft, out-of-reach, superseded or restricted memory is not a candidate (memory.md §2). `brain recall` and `brain reflect --candidates` output is unchanged. Snippets (0080), up to 3 in all, in this order: first each kept fact (its `facts` entry, as the rule below leaves it) whose name or value has a term a query term matches, as `facts.<name>: <value>` with the line of that entry in the file (the `facts:` line itself when the facts are written on one line, `facts: {budget: 80000 EUR}`), at most 2 when a body line also matches; then the body lines where a query term matches one of the line's terms (step 3, its groups included) that match the most query terms (each query term or group counted once; ties to the earlier line), shown in line order. A body line of 200 characters or fewer is shown whole, trimmed; a longer one shows 200 characters around its first matching word: from up to 80 characters before it (from the start of a word), with `…` where text is cut, so `…the agreed rate is €85 per hour for change requests on the online shop.` Superseded notes are returned, not hidden; the skill labels them. A candidate with a `superseded_by` relation has `superseded_by`: that relation's target (the first, in file order); other candidates have no such key. Errors: `USAGE`.

**`unresolved`: the projects an unresolved question could mean (0080, [retrieval.md](retrieval.md) §3).** When step 3a resolves no subject, or the only subjects it resolves are orgs the question names, `data` may have an `unresolved` key, so the answer can ask which one is meant instead of answering for the first-ranked one. It changes no ranking and no candidate. It is computed from the searched notes only, as the rule below leaves them, and holds no value of any note:
1. **The open projects.** When the query has a word of some subject's name (step 3a): the searched projects one of whose names holds each such word (`Harlow` opens `Harlow web shop` and `Harlow website`). When it has none, and the context names an area and no project (step 4): the searched projects whose `area` is that area. When step 3a's subjects are only orgs the question names (`What's the Acme budget?`): the searched projects one of whose step 3a relation fields holds one of them (a project names its org in `client` or `org`), and the name words are the orgs'. Otherwise, or with fewer than two open projects, there is no key.
2. **What each holds.** The **attribute items** are the query's items (a term with its group, step 3) other than the name words item 1 opened projects by; with none, there is no key. For each open project, among its subject's notes (step 3a, with the project as the subject), its **best note** is the one whose matching attribute items have the largest sum of idf (step 3's idf of each item), ties to the earlier-ranked note. A project whose best note matches no item is dropped.
3. **Which are listed.** The **strongest** project has the largest sum, then the earlier-ranked best note, then the smaller id. Listed are it and each project whose best note matches at least half of the items the strongest's best note matches. A project that shares a word or two of a longer request is not one the question could mean (`What did Kestrel say about patient reminders by text message?` lists no `Kestrel booking site` whose notes mention only patients). With fewer than two listed, there is no key.
4. **The key.** `"unresolved": { "subjects": [ … ], "more": <n> }`: at most 5 subjects, by their best note's place in the candidate order (before `--limit`; a note not in it after those that are), then id; `more` is the number of other listed projects, so a list cut at five never reads as complete. Each subject is `{ "id", "type", "title" }` with its eligible title; a project in the awaiting-cleanup form (below), which no name names but an area can open, is `{ "id", "type", "title": null, "cite" }`, as a candidate in that form is shown.

```json
"unresolved": { "subjects": [ { "id": "prj-4k8m2q7t", "type": "project", "title": "Harlow website" },
                              { "id": "prj-9c3x6w1p", "type": "project", "title": "Harlow web shop" } ], "more": 0 }
```

There is no key when the question names a project, an area or a person, or the caller's `.brain` names a project that is a searched note (step 3a resolves it), so context never makes a question look ambiguous. Since a listed project needs a note of its own that matches the request, a project that is only named is never listed.

**The key is a hint, not a verdict (the user's choice of 2026-11-11, option A).** It names the projects a question could mean; it does not say their answers differ. An org-wide question is answered when the evidence supports one answer for the org (`How many deliveries does Orrin plan per day?`), and the answer asks which project only when the projects hold different answers (`What's the Acme budget?`, with a website and an app budget). The ranking and the candidates are the same with or without the key. **One best note per project (the user's choice of 2026-11-11, for 0.13.0):** a project whose asked items are spread over two of its notes, each holding fewer than half the strongest project's items, is not listed (`eval/retrieval-0.13`'s rq-c12 and rq-c17); a rule over a project's notes together is to be revisited with beta evidence.

**Restricted evidence (0055, capture-and-review §5.1).** With an active suppression in `_suppressions/` (capture-and-review §5.3) retrieval uses only eligible evidence: older versions and full copies of a changed input are left out as sources; in a knowledge note a body line whose `^[src-…#¶n:hash]` references are all not live is blanked (line numbers hold), each claim is judged by its own passage reference, whatever the note's `sources` list says; a note that rests on a changed input and has a body line with no passage reference, or a fact no accepted timeline entry supports, is left out whole unless it is resolved for that input (`lineage_cleared`, or its suppression reconciled); a partly restricted note loses its `summary` and its `aliases`, a timeline entry whose source or `passage` is not live is dropped, and a fact whose accepted entries are all dropped is dropped. A passage is live only while the latest version of its input holds it, so a reconciled cleanup never makes an excluded passage, an older source version or a claim citing it eligible again; a re-included passage stays restricted per claim until a Restore record names that note and passage, and the latest extract does not return its text meanwhile. A suppression directory that cannot be read (anything but an absent one) fails the same way. If any suppression record is unreadable the command fails with `SUPPRESSIONS_UNREADABLE`.

**The awaiting-cleanup form (eligibility.md §6 rules 2 to 4, 0077).** A note with a **restricted claim** (a body line blanked, a timeline entry or a fact dropped, by the rule above) is returned with its eligible lines and without the metadata that carries no passage reference, since none of it can be told apart from the excluded claim (a decision titled "Budget cut to 40k" whose budget line is excluded):
- no `title`, `tags`, `summary` or `aliases`, and no `path`: in the output `title`, `path` and `summary` are `null`, and `cite` is the label an answer cites it by: `<type> <id>, title withheld: awaiting cleanup` (`decision dec-7k2m9q4x, title withheld: awaiting cleanup`);
- of the rest of its frontmatter, only what names no content: `id`, `type`, `created`, `updated`, `lifecycle`, `assessment`, `date`, `valid_from`, `valid_until`, `lineage_cleared`, `area`, `projects`, `sources`, `relations`, `facts` and `timeline` (as the rule above leaves them; a timeline entry's free-text `note` is dropped), `notion`, `last_synced`, `notion_fields` (the Notion fields you set), and the ids, dates and enumerations of schema §4 (`domain`, `org`, `goal`, `client`, `people`, `attendees`, `source`, `decisions`, `questions`, `tasks`, `passage`, `decided_in`, `deciders`, `workflow`, `kind`, `raised_in`, `dropped`, `task`, `origin`, `promoted_from`, `scope`, `areas`, `stacks`, `confidence`, and a source's `source_key`, `content_hash`, `captured`, `origin_edited`, `attached_to`, `extract`, `extract_of`, `extract_version`, `transcript_hash`, `selection`, `passages`, `replaces`, `task_items`, `repo`, `commit`, `converter`, `notion_text`, `notion_parts`); a question's `answer` only when it is an id. Every other field is left out: the free text the ingest wrote (`why`, `digest`, `only_keep`, `keep`, `file_name`, `repo_path`, `notion_published`, which holds the published title) and any field the schema doesn't define, unless each of its values is a number, a boolean, an id or a date;
- its body's **headings** (a line matching `^ {0,3}#{1,6}(\s|$)`) and **comments** (a line starting with `<!--`, through the line that closes it) are returned as spaces of the same length, as a restricted line is (line numbers hold), except a heading that is exactly one of the fixed sections schema §4 defines for the type, which names no content: a decision's `## Decision`, `## Context`, `## Consequences` and `## Sources`. A meeting's sections are the ingest skill's, not the schema's, and are withheld.

**A link to such a note** (the user's answer of 2026-11-11 to CC-176's question 4, extending eligibility.md §6 rule 3). In the body of every note an answer surface returns, a relative Markdown link whose target, resolved from the linking note's folder, is the file of a note in the awaiting-cleanup form or of a note restricted whole keeps its link text and loses its target: `See [the decision](../decisions/2026-10-11-budget-cut-to-40k.md).` is returned as `See the decision.`, since the file name repeats the title. Every form of such a link names no file: an inline link or image, with or without a title or angle brackets, is its text alone (an image's `!` goes too); a reference definition (`[p]: ../decisions/….md "…"`) is spaces of the same length, so its uses (`[the decision][p]`) name nothing; a target in angle brackets on its own (`<../decisions/….md>`) is removed. A path written as plain text is the line's own text and is kept. The rest of the line is as the rule above leaves it, and a link to any other note, a file that isn't a note, a URL or an anchor is kept as written. The linking note is not restricted by it. A source, a proposal and a view are never such a target.

None of the withheld parts adds a term to step 3's score or a snippet. A note whose only change is a dropped `summary` (it rests on a changed input it is not resolved for, but every claim it makes is live) has no restricted claim and keeps its title, path and headings (eligibility.md §6 rule 3, last sentences). The note comes back whole once it has no restricted claim: its cleanup item accepted as a removal or correction, or the note marked independent (capture-and-review §5.2, §5.3). `brain reflect --candidates` (§5.32) and `brain recall` (memory.md §5.3, §6.1) return the same form. The published surfaces show the same note by its type and id too (eligibility.md §6 rule 5): `index.md` and the JSON index (§5.8), the views (§5.9) and Notion (§5.14.4, "Restricted notes").

#### 5.13.1 `brain query --read`

Returns each named note in full, as retrieval may use it. It is how a skill reads a note for an answer: a file opened directly shows statements the user excluded, memories nobody approved and memories meant for another project, which this command leaves out (decision 0055; memory.md §2). Read-only.

`--read` takes 1 to 20 distinct note ids separated by commas (a repeated id is read once and counts once; an empty id or more than 20 distinct ids is `USAGE`: `--read takes 1 to 20 note ids separated by commas`). `--limit` and `--types` are `USAGE` with it (`--<name> doesn't go with --read`), and `--historical` is `USAGE` with `--candidates` (`--historical doesn't go with --candidates`). `--repo` names the caller, as for `--candidates`.

```json
{ "data": {
    "context": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n" },
    "notes": [
      { "id": "dec-7k2m9q4x", "status": "ok", "type": "decision", "title": "Use Supabase for auth", "path": "knowledge/decisions/2026-12-03-use-supabase-for-auth.md",
        "lifecycle": "reviewed", "assessment": "accepted", "date": "2026-12-03", "restricted": false,
        "frontmatter": { "id": "dec-7k2m9q4x", "type": "decision", "title": "Use Supabase for auth", "…": "…" },
        "body": "Use Supabase for auth; Firebase is retired after launch.\n" },
      { "id": "dec-2p9f6h1r", "status": "ok", "type": "decision", "title": null, "path": null, "cite": "decision dec-2p9f6h1r, title withheld: awaiting cleanup",
        "lifecycle": "reviewed", "assessment": "accepted", "date": "2026-11-03", "restricted": true,
        "frontmatter": { "id": "dec-2p9f6h1r", "type": "decision", "lifecycle": "reviewed", "…": "…" },
        "body": "## Decision\n                                 \nVendor stays Acme. ^[src-4n8c2k7p#¶2:9f3a1c7e]\n" },
      { "id": "mem-4t8n2k6p", "status": "withheld", "reason": "not_eligible" }
    ]
} }
```

`notes` has one entry per id, in the order given. A note that is returned has `status: "ok"`:

- **`frontmatter` and `body`** are the note as the restricted-evidence rule of §5.13 leaves it: a restricted body line is returned as spaces of the same length (line numbers hold), a restricted timeline entry or fact is dropped, and a partly restricted note has no `summary` or `aliases`. A note with a restricted claim is in its awaiting-cleanup form (§5.13): no `title`, `tags` or free-text field in `frontmatter`, its headings and comments as spaces. A link in `body` to a note in that form, or restricted whole, is its link text alone (§5.13, "A link to such a note"). `restricted` is `true` when that rule changed anything, a dropped link target included.
- `title`, `lifecycle`, `assessment`, `date` and `path` as in a candidate (`null` when the note has none; `title` and `path` `null`, and `cite` given, in the awaiting-cleanup form); `superseded_by` only on a note with that relation. An answer cites a note only by what this command returned: its title and path, or its `cite` (eligibility.md §6 rule 4).
- **A memory** is returned when it is eligible for the caller (memory.md §2): reviewed, superseded by nothing, in reach, its evidence left in. A superseded memory is withheld `not_eligible`, unless the read is historical.
- **The historical read (`--historical`, eligibility.md §5, 0077 §2).** With it, a memory with a `superseded_by` relation is also returned when it is one `brain recall --search --include-superseded` returns to the caller (memory.md §6.1: not a draft, in reach, evidence left in; being old does not make it approved), and it carries `"historical": true` beside its `superseded_by`, so the answer says it is history and what replaced it. Every other id is read exactly as without the option; no other entry has a `historical` key. A skill reads historically only for a question about the past ("what was the rule before?").

A note that is not returned has `status: "withheld"` and a `reason`, and nothing else:

| `reason` | When |
|---|---|
| `unknown` | no note has this id |
| `restricted` | the restricted-evidence rule leaves the note out whole; or a view that rule leaves out (below) |
| `not_eligible` | a memory the paragraph above does not return (the reason does not say which rule, so it tells nothing about a memory meant for another folder); or a proposal, which is never read here: it may propose what its evidence no longer supports |

**Views (0055, capture-and-review §5.1; eligibility.md §8).** A view (a Brief, a Decision log, an area Brief, a report) has no passage references, so it is never returned in part: it is one item, read whole or withheld whole. A view is withheld, and left out of `--candidates --types view`, in three cases. Cases 1 and 3 hold in every brain, with or without a suppression record (CC-345: before 0.16.1 a brain with none skipped them); case 2 needs one:

1. **Something it rests on (`cause: "dependency"`).** It rests on every note in its `generated_from` and every note its body links and, through any view among them, on what that view rests on, to any depth (a report that links a Brief that rests on a decision). The view is withheld when any of them:
   - is restricted in any part by §5.13's rule (whole, a body line, a timeline entry, a fact, its summary);
   - is not eligible: a proposal, or a memory, whatever its lifecycle and reach. A view has no caller to judge a memory's reach by, and memories never reach Notion (0008), so a view never rests on one (CC-345); `report new` refuses a link to a memory (§5.18);
   - is a view this rule withholds, for any of the three causes;
   - no longer exists: an id that names no note, or a relative link in the body to a Markdown file (`.md`) that names no note and no file of the brain, or that leaves the brain. A link to anything else (a PDF, an image, a folder) or to a Markdown file that isn't a note (a `README.md`) neither withholds the view nor counts as a note it rests on.

   A dependency cycle (a report that links a report that links the first) is followed once: a view already being judged adds nothing. This holds for as long as the note is restricted, also after a refresh rewrote the view's prose without the excluded text, if the view still links it or lists it in `generated_from`. `brain views` writes a note with a restricted claim by type and id, without a link and outside `generated_from` (§5.9), so a regenerated view no longer rests on it.
2. **A report older than an exclusion (`cause: "stale"`).** A report whose `generated_at` is not later than the `captured` time of an extract version that carries a suppression record, **whether that record is `active` or `reconciled`**: a cleanup does not make an older report fresh, since the report's prose may restate what that version removed without linking the note it came from, and the brain never edits it (0077 plan 3). Both are compared as full timestamps (`2026-12-10T10:00:00Z`, the schema's form): the same second withholds, since the report may have been written first. Only a refresh, which reads the notes through this command and writes a new `generated_at`, clears this case.
3. **Provenance or freshness that can't be read (`cause: "unreadable"`).** The view's `generated_from` is missing or isn't a list of ids; or it is a report and its `generated_at`, or the `captured` of an extract version a suppression record names, is missing, isn't a full timestamp (a date alone) or can't be read; or no source holds that extract version. The CLI can't show the view is safe, so it fails closed (eligibility.md §3).

The causes are checked in that order and the first that holds is given. A withheld view's entry is `{ "id", "status": "withheld", "reason": "restricted", "cause", "rebuild" }`: `cause` as above, and `rebuild` names what brings it back (eligibility.md §8 rule 6): `"refresh"` for a report (the brain-query skill refreshes it, §5.18; for `dependency`, a refresh that no longer links the note does), `"views"` for a Brief, a Decision log or an area Brief (`brain views`, once the notes it rests on are eligible or shown by type and id). No other entry has these two keys.

Withholding a view withholds nothing else: a note it rests on that is eligible on its own is returned by its own read (eligibility.md §8 rule 5). A view is navigation and never evidence (schema §4): an answer cites the notes, and a skill that finds a view withheld searches with `--candidates` instead. After upgrading, a brain with an aliased, wholly restricted note gets one `index-stale` lint warning until `brain index` runs.

A withheld note is not an error: the exit code is 0. The skill never opens the file of a withheld note. Errors: `USAGE`; `SUPPRESSIONS_UNREADABLE` (exit 5) when a file of `_suppressions/` cannot be read, as for `--candidates`.

### 5.14 `brain sync …` (Notion helpers, CX-10)

The sync, apply and ingest skills read and write Notion through the MCP. These commands do the deterministic parts. Flow of one `brain sync` skill run:

```text
brain sync tracked                      → the tasks that track open questions (§5.14.1)
skill reads Notion rows (MCP)           → each query reply saved as a file
brain sync snapshot --input <files> --output snapshot.json   (§5.14.10)
brain sync plan --input snapshot.json   → plan.json   (read-only)
brain sync apply --input plan.json      → creates notes, applies Notion-owned fields, queues your corrections and finished tracked tasks as questions
brain index; brain views; brain lint; git commit
brain sync render --changed             → payloads for Notion
skill writes pages (MCP)                → results.json
brain sync record --input results.json  → stores page ids and what was published; git commit
```

**Pull before push.** Skills always run `plan` and `apply` before publishing, so your Notion edits are read before the brain republishes.

**Three-way comparison (normative).** For every brain-owned property, the brain keeps what it last published in the note's `notion_published` (schema §3.2, written only by `sync record`, `sync apply` and the decision on a `notion_correction`, §5.7). With **N** = the value in Notion now, **S** = the stored published value and **B** = what `sync render` would publish now:

| Case | Meaning | Result |
|---|---|---|
| N = S | you did not change it | nothing; if B ≠ S, the next render publishes B |
| N ≠ S, B = S | you changed it | your correction (0023, 0027): a pending `notion_correction`, asked in the session before the brain takes it (0101 §4, §5.14.2) |
| N ≠ S, B ≠ S, N = B | both arrived at the same value | `updates` sets S = N |
| N ≠ S, B ≠ S, N ≠ B | you and the brain both changed it | conflict `BOTH_CHANGED` with `property`, N and B; the skill asks you, and `render` holds that property back until then (§5.14.4) |
| S unknown (never published) | no baseline | if N = B, `updates` sets S = N; otherwise nothing, and the next render publishes B |

N, S and B are compared in the normalized Notion form of §5.14.1 (B is the brain's value as `render` would publish it: page ids, `{start, end}` dates, select labels); relations compare as sorted lists, Lifecycle compares case-insensitively, and an empty text equals `null`. A relation that links a note with no Notion page yet counts as changed in the brain, so a Notion edit to it is `BOTH_CHANGED`, never a correction that drops the unpublished link. An emptied or unknown Lifecycle is reported before the three-way comparison. Only a correction converts N to the brain's form. Dates of edits play no part, so an edit to one property never affects another.

#### 5.14.1 Snapshot (input to `sync plan`) and value conversion

Written by `brain sync snapshot` (§5.14.10) from the query replies the skill saved, with the rows that are no query reply (tracked tasks, `wording` objects) passed beside them in this same row format; normalized from MCP results:

```json
{
  "as_of": "2026-12-05T09:00:00Z",
  "rows": [
    {
      "database": "people",
      "page_id": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d",
      "last_edited": "2026-12-05T08:40:00Z",
      "properties": {
        "Name": "Maria López", "Summary": "Product lead at Acme.", "Role": "Product lead",
        "Email": "maria@acme.example", "Lifecycle": "Reviewed",
        "Brain ID": "per-3h8w2n6c", "Org": ["9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d"]
      }
    }
  ]
}
```

- `database`: a key of `brain.json` `notion.databases` among `domains` (0065), `areas`, `goals`, `key_results`, `projects`, `people`, `orgs`, `documents`, `review` (read only by `--review-transition`, §5.14.8; otherwise each row is `ignored`, `REVIEW_ROW`), `decisions` and `questions` (retired in 0.16.0, 0099: `questions` is read only by `--questions-transition`, §5.14.9; otherwise a row of either is `ignored`, `RETIRED_DATABASE`), `inbox` (`references` is read as `documents`, 0049; `concepts` is retired in 0.9.1, 0071, and a snapshot naming it is `INPUT_INVALID`). Meetings are not a snapshot database. `tasks` (the database of `notion.tasks.database`) is one for the tracked tasks, the tasks kept as documents and, from 0.18.0, the tasks with no Area only (below). The skill snapshots only the databases of modules that are on (schema §12, 0048). For `inbox`, the skill passes only:
  - the rows whose **Document asked** box is ticked (by the Keep as document button) and that have a Brain ID, with `Document asked`, `Only keep` and `Brain ID` (0049). A ticked row with no Brain ID isn't in the snapshot: the ingest takes it in, with its Only keep, when it is Ready;
  - every other row that has a Brain ID, with `Brain ID` only (ids, no other property; CC-153): `sync plan` links a source whose page was written but never recorded (§5.14.2) and compares nothing else. A row with no Brain ID (a capture not yet taken in, a Catch-up row) is not passed.
  Nothing else on an Inbox row is read back (an edit you make to an Inbox row's Summary or relations stays in Notion until the brain's value changes; 0043). (Up to 0.15.x a `decisions` row could carry **Promote asked**, ticked by the Promote to document button; since 0.16.0 you ask for Promote to document in the session, §5.5.)
  **Factories rows (0.18.0, 0113 §1)** are in no snapshot: `factories` is not a snapshot database, so `sync snapshot` refuses its query reply as any other (§5.14.10) and nothing on a Factory's row comes back through `sync plan`. The row is the brain's, as an Inbox row's Summary is: an edit stays in Notion until the brain's value changes, a row made by hand is never taken in, and a page in the trash is reported by the skill when a write to it fails. Workflow, and the Tasks of a Factory, are read by reconcile and by sessions (connected-workflows.md §8.4); the one Factory relation `sync plan` reads is that of a task with no Area, below.

  **Report rows (0071).** A Report row is a report's page: a Documents row with Origin = Report since 0.9.1, an Inbox row with Kind = Report before migration 0019 moved it. With Reports on, the skill passes, in the database where the row is (`documents`, or `inbox` in a space not yet on migration 0019):
  - the Report rows whose **Refresh asked** box is ticked or whose **What to fix** isn't empty, with `Refresh asked`, `What to fix` and `Brain ID` (0045). A snapshot from before migration 0010 may carry `Refresh` instead, read the same way;
  - the Report rows that §5.14.7 selects (Accepted ticked, or edited since `last_synced`), with its wording fields. These rows need neither Refresh asked nor What to fix.

  Nothing else on a Report row is read back: its Name, Project, Area and Asked in are the brain's and are not compared (an edit stays in Notion until the brain's value changes, as on the Inbox).

  **Tracked tasks (0.16.0, decision [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §6).** With Tasks on, the skill first runs `brain sync tracked` (read-only, no input; Tasks off → `MODULE_OFF`). It lists every **tracked** question (schema §4: open, with a `task`), sorted by id: `{ "data": { "tracked": [ { "question": "que-…", "page_id": "<its task>", "title": "<the question's title>" } ] } }`, the title as §5.14.4 names a note (its `cite`, §5.13, when the question is in the awaiting-cleanup form). The skill reads each page by its id (not by a query, so a trashed page is still found) and passes one `tasks` row per page:
  - a page it can read and that isn't in the trash: `{ "database": "tasks", "page_id": "…", "last_edited": "…", "properties": { "<the mapped title property>": "Can the site go live by the end of March?", "<the mapped status property>": "Done" }, "status_group": "complete" }`, where `status_group` is the option's group (`todo`, `in_progress`, `complete`) for a Notion Status property and `null` for a select, as assistant.md §2.1 reads it. With the status mapping empty, the status is left out;
  - a page in Notion's trash: the same, with `"gone": true`;
  - a page Notion can't find (not found: deleted for good, or outside the integration's access, which the brain can't tell apart): `{ "database": "tasks", "page_id": "…", "last_edited": null, "properties": {}, "unreadable": true }`. It is never passed as `gone`, so a permissions slip never unlinks a live task (the author's answer of 2026-11-16).

  A read that fails for another reason (a timeout, an expired login) passes no row for that page, and nothing is read for it. Nothing else of a task is read, and nothing of it is stored in a note: its status is a pointer (0018), read each time; only a waiting `tracked_task` records what was read, to ask its question (schema §11).

  **Tasks kept as documents (0.16.0, decision [0100](../decisions/0100-keep-a-task-as-a-document.md) §1; capture-and-review §13).** With the Tasks module on and `notion.tasks.properties.document_asked` mapped, the skill queries the Tasks database for the rows whose Document asked box is ticked and passes each with its title, its Project and Area relations and Document asked, under the mapped names: `{ "database": "tasks", "page_id": "…", "last_edited": "…", "properties": { "Name": "Check go-live with hosting", "Document asked": true, "Project": ["…"], "Area": [] } }`. It reads the page body only when `sync plan` lists the row (§5.14.2). A task that is also tracked is passed once, with the properties of both. Nothing else of a task is read, nothing of it is stored in a note, and with `document_asked` empty or absent no row is passed for this.

  **Tasks with no Area (0.18.0, 0113 §9, 0114; capture-and-review §6.5).** At a catch-up, with the Tasks module on, `notion.tasks.properties.area` mapped, and `project` mapped or (Factories module on) the Factory relation mapped, the skill queries the Tasks database for the rows whose Area is empty and whose Project, or Factory, is not, and whose status is not finished. Finished is read as assistant.md §2.1 reads it from the status property: an option of its complete group (a select: `Done`), or `notion.tasks.wont_do_status`; with no status mapped, no task is finished. It passes each with its title, status, Area, Project and Factory under the mapped names: `{ "database": "tasks", "page_id": "…", "last_edited": "…", "properties": { "Name": "Draft the site copy", "Status": "To Do", "Area": [], "Project": ["…"], "Factory": [] } }`. Page bodies are never read for this, and nothing of the task is stored in a note. The Factory relation is `notion.tasks.properties.factory`, and a Factories page is the one whose id is an entry's `notion` (schema §12 `factories`). A task read for more than one of these three reasons is passed once, with the properties of each. `brain sync` outside a catch-up doesn't run this query.

- A property missing from `properties` was not read and is not compared.

**Normalized values** (the one form used in snapshots, render payloads and `notion_published`):

| Notion type | Normalized value |
|---|---|
| title, text, select, status, url, email | string; empty → `null` |
| number | number or `null` |
| checkbox | boolean |
| date | `{"start": "<date or timestamp>", "end": "<…>" or null}` or `null` |
| relation | array of page ids, sorted |
| formula, rollup | their scalar result, except a rollup of a relation |
| rollup of a relation (Show original, e.g. Projects, Meetings and Documents · Domain, 0.16.1, and Tasks, Inbox and Goals · Domain, 0.18.0, [0105](../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) §1) | a relation: array of page ids, sorted; empty → `[]`. Notion returns it as a list of relations, never one page id, so a reader expects a list even when the Area has one Domain |

**Notion → brain:**
- `null` values and `null` date ends are dropped: the key is left out of `notion_fields`, and a correction to `null` is only allowed for the optional references in the table below (it removes them).
- Dates go into brain date fields as their first 10 characters (`YYYY-MM-DD`).
- Numbers: a Key Facts value, or any other text becomes a number when the brain's current (or proposed) value for that field is a number and the text is a finite number (`80000` → `80000`); otherwise it stays a string.
- Relations map page ids to brain ids through the notes' `notion` fields. An unknown page → conflict `UNRESOLVED_RELATION`.

**Brain → Notion:**
- A month value (`2027-06`) renders as `{"start": "2027-06-01", "end": null}`. Because the comparison uses the stored published value, a month round-trips without a spurious correction.
- `lifecycle`, `assessment`, `kind`, proposal `kind` and `status` render as select labels: each word capitalized (`provisional` → `Provisional`, `update_fact` → `Update Fact`). Proposal status maps to State: `pending`/`approved`/`edited`/`rejected` → `Pending`, `applied` → `Applied`, `closed` → `Closed`.

#### 5.14.2 `brain sync plan`

```text
brain sync plan --input <snapshot|-> [--review-transition]
```

Read-only. Compares each row with the brain and returns a plan. Notes are matched by `Brain ID`.

**Modules (0048).** A row of a database whose module is off is `ignored`, `MODULE_OFF`, whatever it holds: no create, update, correction or request. So is a Report row while Reports is off, in Documents as on the Inbox: a Documents row whose Brain ID names a report follows the Reports module, not Documents (0071).

**Rows with empty `Brain ID`:** first, a note whose `notion` equals the row's `page_id` is that row's note (a create whose publish failed); the row is then treated as if it had that Brain ID, and the next render writes the Brain ID. Otherwise:
- In `domains`, `areas`, `goals`, `projects`, `people`, `orgs` → a `create` item (0021, 0065): a `note new` input with a pre-generated id and:
  - `title` = Name; `summary` = Summary, or Name if empty; `lifecycle` from Lifecycle (default `draft`), and `reviewed` for areas, goals, projects, orgs and domains, which have no Lifecycle (0070);
  - `notion` = page id; `sources: ["notion:<page_id>"]`;
  - brain-owned properties mapped as in the table below, relations resolved to brain ids (other rows created in the same plan count);
  - for each fact set this way, one timeline entry `{field, value, from: <date of last_edited>, learned: <date of as_of>, source: "notion:<page_id>", assessment: accepted}`;
  - `notion_fields` from the Notion-owned properties, and `notion_published` = the row's brain-owned values (the baseline).

  A required field that cannot be filled (goal without Why or Area, project without Area) → conflict `MISSING_REQUIRED` instead.
- In `documents` → `ignored`, `NOT_CREATED_IN_NOTION` (those rows are created by the brain only). A `review` row → `ignored`, `REVIEW_ROW` (below).
- `key_results` rows never have a Brain ID; see below.

**Rows with a `Brain ID`:**
- No such note → conflict `UNKNOWN_BRAIN_ID`. The note's `notion` differs from `page_id` → conflict `NOTION_ID_MISMATCH`. The note has no `notion` → `updates` sets it.
- **Notion-owned** properties → the type's `notion_fields` (table below), plus `as_of`. If any value differs from the stored snapshot (ignoring `as_of`) → an `updates` item with the full new `notion_fields`. Notion is the authority; no three-way comparison.
- **Lifecycle** (yours; agents also set `draft` and `archived`) → three-way comparison; "your correction" here is an `updates` item that sets `lifecycle`. Not read on domains, areas, goals, projects and orgs (0070): a Lifecycle still in such a database is ignored, with no conflict or `ignored` entry.
- **Brain-owned** properties → three-way comparison; "your correction" is a `corrections` item when the property is correctable (table below), otherwise `ignored`, `NOT_CORRECTABLE`. A `corrections` item is never applied by sync: `sync apply` writes it as a pending `notion_correction` (below). For Key Facts, the comparison runs **per key** on the parsed texts (N, S and B each parsed as §5.14.4 says), so a change to one key never conflicts with a change to another; each key is reported as `property: "Key Facts/<key>"`. A key in S that is missing from N → `ignored`, `FACT_REMOVAL_NOT_SUPPORTED`. A Name, Summary or Lifecycle emptied in Notion → conflict `REQUIRED_EMPTY`; a Lifecycle option the brain does not know → `ignored`, `UNKNOWN_OPTION`. Lifecycle is compared case-insensitively (Notion shows `Draft`, the brain stores `draft`).
- **Your corrections wait for your yes (0.16.0, decision [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §4).** The brain can't tell your edit from one made by Notion AI, an agent or an automation, so it asks. For each correctable property (for Key Facts, each key) the plan also reads the pending `notion_correction` proposals (schema §11) whose `target` is the note and whose `field` is the property's:
  - N ≠ S and B = S, with no pending one → a `corrections` item: `{target, field, value, before?, observed_at, database, page_id, property, notion_value}`, `value` being N in the brain's form and `before` the brain's current value (absent when it has none);
  - the same, with a pending one whose `after` is `value` → nothing: the edit is already waiting;
  - the same, with a pending one whose `after` differs (you edited it again) → a `corrections` item with `"proposal": "<its id>"`: `sync apply` updates that proposal to the new value, `observed_at` and `notion_value`, and it stays one question;
  - N = S (the edit was set back in Notion), or B ≠ S (the brain's value changed meanwhile, so the property is a convergence or a `BOTH_CHANGED` conflict, as in the table above) with a pending one → a `withdrawn` item `{proposal, reason}`, reason `SET_BACK` or `BRAIN_CHANGED`: `sync apply` closes it, `closed_reason: withdrawn`.

  A pending correction's property is held back by `sync render` until it is decided (§5.14.4), so your edit stays in Notion while it waits. The session asks every pending correction as one question (capture-and-review §7.5); `brain apply` applies an accepted one as 0027 says and puts a rejected one's S to N, so the next publish restores the brain's value (§5.7). An unattended run writes them and decides none (0096 §4, §6.1).
- **Tracked tasks (0.16.0, 0101 §6).** A `tasks` row (§5.14.1) is matched to the tracked question whose `task` is its `page_id`; a row no tracked question names → `ignored`, `NOT_TRACKED`, unless it was passed for Document asked or for its empty Area (below: then only those rules read it). Its state, by assistant.md §3.1's task states on the mapped status (compared case-insensitively after trimming):
  - `"gone": true` → `gone` (in the trash);
  - `"unreadable": true` → `unreadable`;
  - the status is the dropped status (`notion.tasks.wont_do_status`, default `Won't Do`) → `dropped`;
  - else, its `status_group` is `complete`, or (a select, `status_group` `null`) the status is `Done` → `done`;
  - anything else, an empty status included, or no status read → not finished: nothing to ask.

  A finished state (`done`, `dropped`, `gone`, `unreadable`) → a `tracked_tasks` item `{ question, page_id, page_title?, state, status, observed_at }` (`status` the name read, `null` when gone or unreadable; `observed_at` the row's `last_edited`, `null` when unreadable), unless a `tracked_task` proposal for that question and page that is pending, or was answered (c) (`reject`), already has this `task_state` and `task_edited` = `observed_at`: that is the same observation, either waiting or kept open, which is not asked again while the task stays as it is. A withdrawn one (`closed_reason: withdrawn`) is a different observation: a page that was unreadable, could be read again and open, and is unreadable again is asked again. A pending one with another state or `task_edited` → the item carries `"proposal": "<its id>"`, and `sync apply` updates it. A pending `tracked_task` whose task now reads not finished (you reopened it, or an unreadable page can be read again and is open), or whose question is no longer tracked → a `withdrawn` item, reason `TASK_REOPENED` or `NOT_TRACKED`. A tracked question with no row in the snapshot was not read: nothing changes for it. `page_title` is the task's title as read, absent when the row has none (an unreadable page): the question's title then stands in.
- **Decisions and Questions rows** (0.16.0, decision 0099): a row of `decisions` or `questions`, with a Brain ID or without, is `ignored`, reason `RETIRED_DATABASE`, and nothing of it is read: decisions and questions have no database (schema §4). Only the 0.16.0 migration's one read, `sync plan --questions-transition`, reads Questions rows, by §5.14.9. (Up to 0.15.x, Questions · Status went into `notion_fields.status`, and Promote asked on a Decisions row made a `promote_requests` item; both are retired.)
- **Review rows** (0.16.0, decision 0096): a row of `review` is `ignored`, reason `REVIEW_ROW` (an ignored reason, not an error), and nothing of it is read. Only the 0.16.0 migration's one read, `sync plan --review-transition`, reads Review rows, by the rules of §5.14.8.
- **Inbox** rows: a row whose Brain ID names no note → `UNKNOWN_BRAIN_ID` (CC-153). A row whose Brain ID names a source that has an Inbox row of its own (§5.14.4: any kind but `minutes`, not an attached file, not a `capture`, whose page is the one in its key) follows the Brain ID rules above: the source's `notion` is another page → `NOTION_ID_MISMATCH`; no `notion` → `updates` sets it, so a page a run created and never recorded (`sync record` not reached) is linked at the next pull instead of created again by `render --changed`. Then (0049): a row with `Document asked` = true and a Brain ID naming a source (any kind but `minutes`) → a `document_requests` item `{ "page_id": "…", "source": "src-…", "files": ["src-…"], "only_keep": "…" | null }`. `source` is the latest version of that source (following `replaces` forward, schema §4); `files` is the sources attached to it (`attached_to` = it), sorted by id, possibly empty: when it isn't, the Document is made from each file, not from the capture's text. `only_keep` is the row's Only keep, `null` when empty; with it set, the skill writes a checked row of the part, not a Document (0.16.0, 0098 §4; capture-and-review §12.2, §12.3). With `only_keep` null and a `whole` Document of each source in question already there, the item carries `"existing": ["ref-…"]`: nothing is left to write, and the skill only clears the box. A Brain ID naming no note → conflict `UNKNOWN_BRAIN_ID`; one naming a report, any other note that isn't a source, or minutes → `ignored`, `NOT_A_SOURCE`; a ticked row with no Brain ID (not taken in yet, so not meant for the snapshot) → `ignored`, `NOT_INGESTED`; with Documents off, a ticked box → `ignored`, `MODULE_OFF`, `property: "Document asked"`. A `Full text` property in a snapshot (a skill from before 0.6.0) → `ignored`, `RETIRED`.
- **Tasks with Document asked** (0.16.0, 0100; capture-and-review §13): a `tasks` row passed for Document asked (§5.14.1) with the box ticked → a `task_documents` item `{ "page_id": "…", "title": "…", "projects": ["prj-…"], "area": "area-…" | null, "question": "que-…" | null, "source": "src-…" | null, "existing": "ref-…" | null }`: `projects` and `area` are the row's Project and Area mapped to notes by their `notion` (a page no note has is left out); `question` the question whose `task` is the page, when there is one; `source` the latest version of the `task` source keyed `notion:<page_id>`, when the brain has one, and `existing` the `whole` Document of it. The skill reads the page body, writes the source and the Document (capture-and-review §13.3 to §13.5) and clears the box. With Documents off, a ticked row → `ignored`, `MODULE_OFF`, `property: "Document asked"`. A `tasks` row whose box isn't ticked → nothing.
- **Tasks with no Area** (0.18.0, 0113 §9, 0114; the rule is capture-and-review §6.5). A `tasks` row whose mapped Area was read and is `[]`, with a non-empty Project or (Factories module on) Factory, and whose status was read (when mapped) and is neither `Done` nor the Won't Do status (compared case-insensitively after trimming), gives one of:
  - a `task_areas` item `{ "page_id": "…", "title": "…", "area": "area-…", "from": "project" | "factory", "property": "Area", "payload": { "type": "relation", "value": ["<the Area's page id>"], "mode": "if_empty" } }`, when every page of its Project relation is a project note's `notion` and their `area` is one; or, with an empty Project, when the same holds of its Factories. A project or area row that this same plan creates counts, with the Area its `create` item gives; a Factory's row is never created by a plan: its Area is its entry's or its link's (schema §12 `factories`, linked-repos.md §1.1), archived or not;
  - a `task_areas_unset` item `{ "page_id": "…", "title": "…", "reason": "DIFFERENT_AREAS" }`, when they all resolve and their Areas differ;
  - a `task_areas_unset` item with reason `NOT_IN_BRAIN`, when a Project or Factory page, or the Area's own page, isn't known to the brain yet: nothing is set, and a later catch-up reads it again.

  A Project or Factory property that was left out (`RELATION_TRUNCATED`, §5.14.10), or that is `[]` while the other one was left out, gives nothing. The skill of a catch-up makes each `task_areas` write in its publish step, with *if empty* as on Meetings (§5.14.4): it reads the page's Area again and writes only while it is still empty. No note changes and there is no `sync record`; the report counts the Areas written and names the `DIFFERENT_AREAS` tasks under Check (`NOT_IN_BRAIN` is not named).
- **Clearing the boxes (0048).** `sync render` never sends Document asked: once the skill has acted on a request (or found it already done, `existing`), it unticks the box through the MCP, and for an Inbox row also sets Brain Status back to Done. A `task_documents` item's box is unticked the same way (0100 §1), and nothing else of the task is written. A request the run skipped keeps its box ticked, so the next catch-up sees it again. **Report rows** (0045, Brain ID a `vw-` report; a Documents row, or an Inbox row before migration 0019, §5.14.1): only Refresh asked, What to fix and §5.14.7's wording are read, and no property of the row goes through the three-way comparison. Refresh asked (or `Refresh`) = true → a `refresh_requests` item `{ "page_id": "…", "report": "vw-…" }`; a non-empty What to fix whose text isn't the `text` of the report's last `fixes` entry → a `report_fixes` item `{ "page_id": "…", "report": "vw-…", "text": "…" }`. The skill refreshes the report (§5.18) and turns each fix into proposals. An Inbox row with no Brain ID holds no report (an unattended run's summary row, §6.1, is one: Kind Report before 0.9.1, Catch-up since; the snapshot carries no Kind, so none is needed): a ticked Refresh asked (or `Refresh`) or a non-empty What to fix on it → `ignored`, `NOT_A_REPORT`, with the property; while Reports is off → `ignored`, `MODULE_OFF`, as for any Report row. Every other Inbox property is ignored.
- **Key Results** rows are grouped by their `Goal` relation into the goal's `notion_fields.key_results` (sorted by name, then page id) and compared like other Notion-owned fields. A Key Result whose goal the brain does not know → `ignored`, `UNKNOWN_GOAL`.

**Property ownership per database** (schema §14). Name and Summary are brain-owned everywhere; Brain ID and Last Synced are system:

| Database | Notion-owned → `notion_fields` | Correctable brain-owned → correction `field` |
|---|---|---|
| domains | Archived → `archived` (Type until 0.16.0) | Name → `title`, Summary → `summary`, Org → `org` |
| areas | Archived → `archived` | Name → `title`, Summary → `summary`, Domain → `domain` |
| goals | Status → `status`, Progress → `progress`, Archived → `archived`, Key Results → `key_results` | Name, Summary, Why → `why`, Deadline → `facts.deadline`, Area → `area` |
| projects | Status → `status`, Priority → `priority`, Dates → `dates`, Archived → `archived` | Name, Summary, Key Facts → `facts.<key>` (§5.14.4), Area → `area`, Goal → `goal`, Client (first) → `client`, People → `people` |
| people | Email → `email` | Name, Summary, Role → `facts.role`, Org (first) → `org` |
| orgs | Relationship → `relationship`, Website → `website`, Archived → `archived` (0070) | Name, Summary |
| documents | — | Name, Summary |

**Not read (0.16.1, [0105](../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md)).** A property this table and the rules above don't name is not read: it gives no `notion_fields` key, no correction, no conflict and no `ignored` entry. That holds for Domains · **Type**, retired in 0.16.1 (0105 §3): a space that keeps it doesn't import it again, and since `notion_fields` is rebuilt from the mapped properties at each pull, a domain note's old `type` is dropped at the next `sync apply` (an `updates` item that sets `notion_fields` without it; the row's Archived, a checkbox, is always read, so the row has a mapped value to rebuild from; as an area's old `type` since 0.9.0); lint accepts the old value until then (schema §4 domain). It holds too for the **Domain** rollup on Projects, Meetings and Documents (0105 §1) and, from 0.18.0, on Tasks, Inbox and Goals (0113 §9, 0114 §3), which Notion owns: no note gets a `domain` from it.

Other brain-owned properties (Project and Area on Documents) are not correctable in v1 (decision 0027): a change you make there is `ignored`, `NOT_CORRECTABLE`, so the skill can tell you to use a proposal instead.

```json
{ "data": {
    "as_of": "2026-12-05T09:00:00Z",
    "create": [ { "type": "org", "id": "org-5h2k8q1w", "title": "Globex", "lifecycle": "draft",
                  "frontmatter": { "summary": "Globex", "notion": "…", "sources": ["notion:…"],
                                   "notion_fields": { "as_of": "2026-12-05T09:00:00Z", "relationship": "Prospect" },
                                   "notion_published": { "Name": "Globex", "Summary": null } },
                  "body": "" } ],
    "updates": [ { "id": "prj-9x4t1b7e", "notion_fields": { "as_of": "2026-12-05T09:00:00Z", "status": "Active", "priority": "High", "dates": { "start": "2026-10-01" }, "archived": false } } ],
    "corrections": [ { "target": "per-3h8w2n6c", "field": "facts.role", "value": "Product lead", "before": "Designer", "observed_at": "2026-12-05T08:40:00Z", "database": "people", "page_id": "…", "property": "Role", "notion_value": "Product lead" } ],
    "withdrawn": [ { "proposal": "prp-6k2m8q4w", "reason": "SET_BACK" } ],
    "tracked_tasks": [ { "question": "que-5b8n2k4w", "page_id": "…", "page_title": "Can the site go live by the end of March?", "state": "done", "status": "Done", "observed_at": "2026-12-05T08:10:00Z" } ],
    "document_requests": [ { "page_id": "…", "source": "src-4m9q2x7c", "files": ["src-3m8q2v7c"], "only_keep": null } ],
    "task_documents": [ { "page_id": "…", "title": "Check go-live with hosting", "projects": ["prj-9x4t1b7e"], "area": null, "question": "que-5b8n2k4w", "source": null, "existing": null } ],
    "task_areas": [ { "page_id": "…", "title": "Draft the site copy", "area": "area-2m7c4h8n", "from": "project", "property": "Area", "payload": { "type": "relation", "value": ["…"], "mode": "if_empty" } } ],
    "task_areas_unset": [ { "page_id": "…", "title": "Compare the two hosts", "reason": "DIFFERENT_AREAS" } ],
    "refresh_requests": [ { "page_id": "…", "report": "vw-4c7n2k9p" } ],
    "report_fixes": [ { "page_id": "…", "report": "vw-4c7n2k9p", "text": "Lucía left Acme in June" } ],
    "conflicts": [ { "database": "goals", "page_id": "…", "brain_id": null, "code": "MISSING_REQUIRED", "message": "goal \"Write a book\" has no Area" } ],
    "ignored": [ { "database": "documents", "page_id": "…", "brain_id": "ref-4m8q2k6p", "property": "Project", "reason": "NOT_CORRECTABLE" } ]
} }
```

- `observed_at` of a correction is the row's `last_edited`; `property` and `notion_value` (N, normalized) let the decision on it set S (§5.7). For Key Facts, `notion_value` is the key's value in N, and S changes for that key only.
- An `updates` item is `{id, notion?, lifecycle?, notion_fields?, published?}`: each optional key is set only when it changes; `published` is a map of S values to set (the converged case of the three-way table).
- A conflict item is `{database, page_id, brain_id, code, message, property?, notion_value?, brain_value?}`.
- Every array is sorted by database (in the order of the snapshot `database` list above, `tasks` last), then `page_id`, then `field` or `property`; `withdrawn` by `proposal`, `tracked_tasks` by `question`, `task_documents`, `task_areas` and `task_areas_unset` by `page_id`. `sync apply` echoes `document_requests`, `task_documents`, `task_areas`, `task_areas_unset`, `refresh_requests` and `report_fixes` without executing them.

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (unknown database key, bad value shape).


#### 5.14.3 `brain sync apply`

```text
brain sync apply --input <plan|-> [--record-only] [--skip-conflicted] [--dry-run]
```

**`--skip-conflicted`** (0051, the unattended catch-up, §6.1) skips a conflicted row whole: an item belongs to a row with a conflict in the plan when its note id (`create` `id`, `updates` `id`, `corrections` `target`, `decisions` `proposal`) equals a conflict's `brain_id`, or its page id (`create` `frontmatter.notion`) equals a conflict's `page_id`. Such an item is not executed: its result is `skipped`, reason `ROW_CONFLICTED`, and a `create` whose relations point at a skipped create is skipped the same way, transitively and whatever the order of the creates in the plan. A relation is an id in a frontmatter field that holds references: the fields `brain lint` checks for `missing-ref` (schema §3–§11: `area`, `goal`, `client`, `org`, `projects`, `people`, `sources`, `facts`, …), the `target` of each entry of `relations` (schema §6) and the `source` of each `timeline` entry. An id written in free text (`summary`, `aliases`, `tags`, the body) is not one, and neither does it make an item depend on another for `DEPENDENCY_FAILED`. Without the flag, a conflict blocks only its own property, as before.

With `--record-only` (a run that must not apply at all, 0003; an unattended catch-up runs without it, 0051), only additions run: `create`, `updates`, the waiting questions of step 3 (writing a pending proposal decides nothing) and recording `decisions` (as `apply --record-only`).

Executes a plan from `sync plan`, in this order:
1. **`create`**, per item with the `note new` rules (except that `lifecycle` comes from the item). An item whose relations point at a create that failed also fails (`DEPENDENCY_FAILED`). Creates run **in relation order**, with or without `--skip-conflicted`: a create whose relations (as defined above) name the id of another create in the plan runs after it, whatever their order in the plan, so a new Area and the new Domain it names, or a new Project and its new Area or Org, are created in one run; creates that don't depend on each other keep the plan's order. `data.create` lists the results in the plan's order. Creates whose relations form a cycle (A names B and B names A, directly or through others; a create naming its own id is not one) are not executed: each fails `RELATION_CYCLE`, a create that depends on one fails `DEPENDENCY_FAILED`, and every other create and the rest of the plan are still applied. Logs `sync-create`.
2. **`updates`**: sets `notion`, `lifecycle`, `notion_fields` and the listed S values. Logs `sync-update`.
3. **The waiting questions (0.16.0, decision 0101 §4, §6),** attended or not, none of them applied:
   - each **`corrections`** item is written as a pending `notion_correction` (schema §11): `target`, `field`, `after` = `value`, `before` when given, `database`, `page` = `page_id`, `property`, `notion_value`, `observed_at`, `source` = `notion:<page_id>`, `why` = `<property> edited in Notion`, `title` = `<target title>: <property> → <value as rendered>` (cut as §5.6 cuts titles). **A value as rendered:** a text or a number as it is, a date as `YYYY-MM-DD`, a reference as the note's title (several joined with `, `), `null` as `empty`. Every title here, the target's and a reference's, is named as §5.14.4 names a note: a note in the awaiting-cleanup form (§5.13; eligibility.md §6 rule 3) by its `cite`, `<type> <id>, title withheld: awaiting cleanup`, never by its title. With `proposal`, that proposal, if still pending, gets the new `after`, `notion_value`, `observed_at` and `title` instead (result `updated`). Nothing of the target changes, and S is not set: the next plan sees the same edit and finds it waiting;
   - each **`withdrawn`** item closes its proposal, if still pending: `status: closed`, `closed_reason: withdrawn`, no decision (result `withdrawn`);
   - each **`tracked_tasks`** item is written as a pending `tracked_task`: `target` = the question, `page` = `page_id`, `page_title` (the task's title, else the question's), `task_state` = `state`, `task_status` = `status`, `task_edited` = `observed_at`, `source` = `notion:<page_id>`, `why` = `<page_title> is <status> in Notion` (`… is in Notion's trash` when gone, `… can't be read in Notion` when unreadable), `title` = `<question title>: its task is <status, in the trash, or unreadable>`, the question's title named as a correction's target is (above). With `proposal`, that proposal, if still pending, gets the new state, status and `task_edited` instead.

   A newly written proposal's result is `written`; each `written`, `updated` and `withdrawn` item carries `"proposal": "<its id>"`, and `summary` counts `written`, `updated` and `withdrawn`. A proposal that is no longer pending is left as it is (result `skipped`, `NOT_PENDING`); a target or question that no longer exists → `failed`, `UNKNOWN_ID`. Each written or updated proposal logs `proposal-new <id> "<title>" kind=<kind> target=<target>`, each withdrawn one `apply <prp-id> "<title>" result=closed`. Then **`decisions`** (only in a `--review-transition` plan, §5.14.8), with the `brain apply` rules.
4. **`accepted_wording`** (0054, §5.14.7): the accepted Document or report text, imported exactly. Logs `sync-wording`.

`sync apply` never writes `last_synced` (only `sync record` does). `conflicts` and `ignored` are not executed; they are echoed for the skill to report.

Preconditions are re-checked (the brain may have changed since the plan): a create id now in use, or an update or correction target now missing → that item `failed`. `data` = `{ "create": […], "updates": […], "corrections": […], "withdrawn": […], "tracked_tasks": […], "decisions": […], "notion_writes": […], "conflicts": […], "ignored": […], "summary": {…} }` (`notion_writes` as in `apply`, §5.7), each executed item with `result` and `changed` as in `apply`. Exit 1 if any item `failed`.



#### 5.14.4 `brain sync render`

```text
brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json> [--skip-conflicted]] [--row-state <file>]
brain sync render --unpublish-drafts
```

Builds Notion payloads; writes nothing. With `--plan`, every property named by a `BOTH_CHANGED` conflict in that plan is held back (left out of `properties` and of `published`) until the skill has your answer; the skill passes the plan of the same run. **A pending correction (0.16.0, 0101 §4)** holds back its property the same way, with or without `--plan`: the `property` of every pending `notion_correction` on the note (Key Facts whole while any of its keys has one), so your edit stays in Notion until you decide it. Once decided, S is N (§5.7): an accepted value is not sent again, and a rejected or corrected one is, since B differs from S. With `--skip-conflicted` as well (it needs `--plan`: alone → `USAGE`; 0051, the unattended catch-up, §6.1), a conflicted row is held back whole: no item is rendered for a note whose id is a conflict's `brain_id` in the plan, or whose `notion` page id is a conflict's `page_id`; it is listed in `skipped` with reason `ROW_CONFLICTED`. A report named by a `report_fixes` item in the plan (its `report` id) is held back the same way, with reason `FIX_WAITING`: rendering it could clear a What to fix nobody has read yet (the Reports rule below clears What to fix and Refresh asked against the published baseline), for instance after an earlier publish failed and the user then wrote a new fix. Since `sync record` records only items it is given, a held-back note stays changed, and the next render after the conflict or the fix is handled (an attended run) publishes it. Relations from other items to a held-back note that has no page yet are pending, as for any unpublished note. The skill sends them through the MCP, then passes each item's `published` back to `sync record`.

**No page for a decision or a question (0.16.0, 0099; schema §4).** `sync render` never renders a decision or a question: `--changed` selects none, whether it has a page or not, and `--ids` naming one lists it in `skipped` with reason `NO_DATABASE` (not an error). No rendered property names one, so the relations other pages held to them (a meeting's, a project's, an area's, an Inbox row's) are not sent; the 0.16.0 migration archives their old pages and removes those relations (§5.14.9).

**Only reviewed knowledge gets a page (0071, 0.9.1).** A concept or reference (a Document) with no `notion` is **published** only when its `lifecycle` is `reviewed` or `disputed`: approved in the session (capture-and-review §7.5, schema §11.2), or reviewed from creation, as a `whole` or `workflow` Document is or a note its part's yes approved is (§5.5). Until then it lives only in Git. One with `draft` or `archived` and no page is never created, so a rejected draft (archived by the Reject) never gets one. A note that already has a page is rendered whatever its `lifecycle`, so a page from before 0.9.1 stays in Notion as history. (Decisions and questions followed this rule while they had their databases.) A person is published whatever its `lifecycle` (a meeting's Attendees needs its page), and so is every other type. Such a note is **unpublished** in what follows; `--ids` naming one lists it in `skipped` with reason `NOT_REVIEWED` (not an error).

**`--changed`** selects:
- notes of a published type (area, goal, project, person, org, reference) with no `notion`, unless its module is off (schema §12, 0048: goals with Planning, orgs with Orgs, references, learned ones included, with Documents, 0071) or it is unpublished (above). A `type: concept` note left before `brain upgrade` is never published (lint `concept-retired`);
- sources of every kind except `minutes` and `task` with no `notion` (0037: the Inbox; a `task` source's page is its task, 0100). On the first run after the upgrade to 0.3.0 this selects every such source already in the brain, so the Inbox History fills with no migration;
- notes, meetings and sources (with `notion`) where any rendered property's B differs from S, or the page content changed (B of `@content` ≠ S);
- with Reports on, reports (views with `view_kind: report`) with no `notion`, and published reports whose body, `fixes` count or any rendered property changed since S (0043, 0045). The first render on 0.9.1 therefore updates every published report once: Origin and Asked in are new names, so S holds neither (0071);
- with Factories on (0.18.0), the entries of `brain.json` `factories`: with no `notion` when not archived, and with `notion` when any rendered property's B differs from S. With the module off none, and `--ids` naming one → item error `MODULE_OFF`;

A source with `attached_to` is never selected: it has no Inbox row (0042). Neither is a `task` source (0.16.0, 0100 §2): its page is the task, in Tasks; `--ids` naming one lists it in `skipped` with reason `NO_INBOX_ROW` (not an error). Notes whose database id is empty in `brain.json` are skipped with warning `DATABASE_NOT_CONFIGURED`. `--ids` naming a note whose module is off → item error `MODULE_OFF`.

**Relations to a module that is off** (0048) are left out of `properties`, `published` and `pending_relations` alike, as if the property didn't exist: Client on Projects and Org on People with Orgs off; Goal on Projects with Planning off; Documents on the Inbox with Documents off. S keeps what was last sent, so turning the module on again sends only what changed. `sync plan` doesn't compare these properties either (§5.14.2).

**Rendered properties per database** (exactly these; nothing else is ever sent):

| Database | Properties |
|---|---|
| domains | Name, Summary, Org, Brain ID, Last Synced, Archived *(once)* |
| areas | Name, Summary, Domain, Brain ID, Last Synced, Archived *(once)*; `sections` "Brief" (0041) |
| goals | Name, Summary, Why, Deadline, Area, Brain ID, Last Synced, Archived *(once)* |
| projects | Name, Summary, Key Facts, Area, Goal, Client, People, Brain ID, Last Synced, Archived *(once)* |
| people | Name, Summary, Role, Org, Lifecycle, Brain ID, Last Synced |
| orgs | Name, Summary, Brain ID, Last Synced, Archived *(once)* |
| documents | Name, Summary, Project, Area, Origin (0071), Lifecycle, Task (a Document kept from a task, 0100), Brain ID, Last Synced (0045, 0049; From decision until 0.16.0, 0099; From concept until 0.9.1, 0071); a report: Name, Origin, Project, Area, Asked in, Brain ID, Last Synced, Refresh asked *(clear)*, What to fix *(clear)* (0071) |
| meetings | Attendees *(add)*, Project *(if empty)*, Area *(if empty)*, Brain Status, Ingested At, Brain ID |
| inbox | Name *(create only)*, Kind *(if empty)*, Summary, Documents, People, Project *(if empty)*, Area *(if empty; once after a move)*, Brain Status, Brain ID, Last Synced. No report since 0.9.1: reports are Documents rows (0071) |
| factories (0.18.0) | Name, Area, Projects, Overview as of, Archived, Brain ID, Last Synced |

- Render never sends Domains · Type (retired in 0.16.1) or the Domain rollup of Projects, Meetings, Documents, Tasks, Inbox and Goals (Notion computes it, 0105 §1; the last three from 0.18.0).
- On `create`, every listed property is sent. On `update`, only properties whose B ≠ S are sent, plus Last Synced (= `--now`) for the databases that have it (not Meetings). So Lifecycle goes out on create (`Reviewed` or `Disputed` for knowledge since 0071, `Draft` for a new person) and when the brain changed it (`archived` by a supersession), and your own Lifecycle edits, already pulled into the brain, are never overwritten.
- **Archived *(once)*** (0070): domains, areas, goals, projects and orgs send no Lifecycle. When the note's `lifecycle` is `archived` (a merge or supersession) and `notion_fields.archived` is not true, Archived goes out as a checked checkbox; once S holds it, it is not sent again, so unticking it in Notion is your edit and stays.
- Project relations carry every id in `projects`.
- **Documents (0045, 0049):** Project = `projects`, Area = `area`; the body is the whole page body. A `promoted` Document has no relation to its decision, which has no page (0099; From decision until 0.16.0, From concept until 0.9.1, 0071): its `promoted_from` stays in Git. Origin = Learned on a `learned` Document (0071), its body brain-owned like a `part` one. **A Document kept from a task** (0.16.0, 0100 §2; a `whole` Document whose source is a `task` source): Origin = Kept, and Task = `[<the page id in its source's key>]`, a relation to the Tasks database, sent when the Tasks module is on and `notion.tasks.database` is set (left out otherwise, as a relation to a module that is off); it has no Inbox row, so its Sources stays empty. Its question has no page (0099), so no property names it. **Its From the brain section** (capture-and-review §13.6) is the brain's text: below the `<!-- from-the-brain -->` line its relative links are rendered as any brain note's (below), while the text above keeps the whole Document's rule (0091); the marker line itself is not sent. **A Documents data source without Origin** (a space not yet through migration 0018): the skill leaves Origin out of the page write **and** out of the `published` it passes to `sync record`, and names migration 0018 in its report; the rest of the item is written as usual, and the first render after the migration sends Origin. A `promoted` Document's body is sent on `create` only: on `update`, `body` is `null` and `@content` isn't compared, because the body is yours from then on.
- **Areas (0041):** `sections` = `{ "Brief": <the area brief's generated block> }`. The skill replaces the children of the area page's "Brief" toggle heading; a page without one gets a "Brief" toggle heading appended at the **end** of the page, then filled (the page is yours, so the brain never inserts above your content).
- **Inbox** (0037; sources, every kind except `minutes`):
  - `action`: `update` when the source has `notion`, or is a `capture` (page id = the id in its `notion:` key: the row you created; a capture's key is always `notion:`, schema §4), or has `checked_from` (a checked row, 0098 §4: the row the brain wrote and you checked, its key `notion:` too); otherwise `create`. A capture whose `notion` differs from its key's id → item error `NOTION_ID_MISMATCH`.
  - Name = `title`, sent on `create` only: a capture's Name is yours, and so is a checked row's. Kind = the source `kind` as a select label (`Capture`, `File` for `document` (0049), `Email`, `Chat`, `Note`), with `"mode": "if_empty"`: the skill writes it only when Kind is empty in Notion, so a Kind you chose stands (0048). An S of `Document` compares equal to `File`, so rows published before aren't sent again. Summary = `summary` (empty when the source has none).
  - Documents, People = every note of that type whose `sources` lists the source's id, sorted (learned Documents in Documents; Concepts is retired in 0.9.1, 0071; Decisions and Questions in 0.16.0, 0099); notes not yet published go to `pending_relations`. Documents is the property called References before migration 0010; `promoted` Documents aren't listed, since they come from a note, not the source. When `documents` is empty in `brain.json`, Documents is left out entirely, from `properties` and from `pending_relations`; the reference notes themselves are skipped with `DATABASE_NOT_CONFIGURED`. These are the "Produced" relations; the other side of each is that database's Sources relation, which Notion fills.
  - Project and Area carry `"mode": "if_empty"` (as on Meetings): Project = the `projects` of the notes the source produced, Area = their `area` and the `area` of those projects, each deduped and sorted. These notes include its decisions and questions, though they are no longer Produced relations (0099): a document that produced only a decision still gets that decision's project. You may set them yourself before the ingest; the brain never overwrites them.
  - **A moved source's Area (0092, CC-271):** once an applied `set_field` on `area` has moved the source (its `target` is the source or a whole Document of the source's group, §5.6), B of Area = the source's own `area`, sent **without** `mode`, so it replaces what the row has. It is sent only while S's Area differs, so it goes out once, in the publish after the move, as a question's Answered status did until 0.16.0; the render after `sync record` sends nothing, and a later move sends its new Area once. Project keeps `if_empty`, and a source never moved keeps Area `if_empty`, so an Area you set on its row stands. Example: a source ingested into Product, moved to Go-to-market; its row showed Product, and the next publish sends `"Area": { "type": "relation", "value": ["<Go-to-market page>"] }`.
  - Brain Status = `Done` (0048; `Processed` before 0.6.0). An S of `Processed` compares equal to `Done`, so rows published before aren't sent again: migration 0010 renames the option. Brain ID = the source's id.
  - **Produced** relations also include every note whose `sources` lists the id of a source **attached** to this one (0042).
  - **Body (0043):** a capture's body is yours: `body` and `sections` are `null`. So is a checked row's (0098 §4): its body is the text you checked, never rewritten, and its Kind (Changed), Changed from and What changed, written when the row was created (§5.35), are never sent again. Any other source's `body` is its digest, written once (its content never changes, so B of `@content` = S after the first publish):
    ```text
    *<Kind> · <`file_name` as a code span, else the URL, else "pasted text"> · <the date in the file name> · <word count> words[ · <part count> slides]*

    <summary>

    <digest>
    ```
    A missing `summary` or `digest` leaves out its paragraph; `[ · <part count> slides]` only when the body has slide markers. **The file name is a code span** (CC-263): `` `notes.md` ``, never the bare name, because Notion turns a name that ends like a domain (`notes.md`, `plan.io`, `deck.ai`) into a link to that address, which leads nowhere. The span follows CommonMark: its backtick fence is one longer than the longest run of backticks in the name, with a space inside each fence when the name starts or ends with a backtick (a name with a backtick: ``` ``a`b`` ```; one starting with one: ``` `` `a `` ```). A URL stays as it is, since Notion's link to it is the right one, and so does `pasted text`. Example: `` *Document · `roadmap.md` · 2026-12-01 · 25 words* ``. The date is the one in the source's file name: `file_date` when `note new` was given one, else `created` (§5.5); `file_date` is not stored, so `render` reads it from the path. The words are the body's runs of non-space characters.
  - **Full text (0043) is retired in 0.6.0 (0049):** no `Full text` section or checkbox is sent, and `@full_text` in S is left as it is. Rows that already show a Full text toggle keep it.
  - `published` holds what was sent, so a later ingest that produces more notes from the same source (or publishes a pending one) re-renders only the changed relations.
- **Meetings** (0007; the page is yours): never Name, Date or body. *(add)* relations carry `"mode": "add"`: the skill adds the listed pages and keeps those you linked. *(if empty)* relations carry `"mode": "if_empty"`: the skill writes them only when the property is empty in Notion (design §3.5: "brain fills if empty"). Brain Status = `Done` and Ingested At = `{start: <meeting created>}` go out once, because S then holds them (0109 §1, §5; `Ingested` before 0.16.2). Read before 0.16.2: an S of `Not Reviewed`, `Reviewed` or `Ingested` on a meeting compares equal to `New`, `Ready` or `Done`, so a space whose options migration 0029 renamed is not sent again; `Skipped` is yours and compared as it is (0109 §2, §4).
- **Origin** (0071) on every Documents row, brain-owned and never read back: a `reference` → `Kept` for `whole`, `part` or no `origin`, `Promoted` for `promoted`, `Workflow` for `workflow` (and `Learned` for `learned`, CC-123); a report → `Report`. Origin is a new name in S, so the first render on 0.9.1 sends it to every published Document once.
- **Reports** (0043, 0045; in Documents since 0.9.1, 0071): `database` is `documents`, and `action` is `create` with no `notion`, else `update`. Name = `title`; Origin = `Report`; Project = `projects`, Area = `area` (plain relations, not *if empty*); Asked in = `asked_in` as a list (one id or several), a relation to your Ask rows on the Inbox, whose other side (Inbox · Report) Notion fills; Brain ID = the view's id. No Summary, Lifecycle, Kind or Brain Status: a report is not reviewed (schema §4 view). A page moved from the Inbox by migration 0019 keeps its id, so the report keeps its `notion` and its baselines; the Inbox-only names in its S (Kind, Brain Status, Ask) are left there and never sent again. **Moved once:** a published report whose S has no `Origin` was last published on the Inbox, and a move between databases can drop properties, so its next render sends **every** property above as on `create` (the body only when it is due, as below); S then holds Origin, and later renders send only what changed. Render always sends the 0.9.1 names: a space not yet on migration 0019 rejects the write (no Origin or Asked in on Documents), so migration 0019 runs before the first publish on 0.9.1, as 0009 and 0010 did. `body` = the report body, rendered as other bodies; on `update`, sent only when B of `@content` ≠ S (a refresh), and then `properties` also has `"Refresh asked": { "type": "checkbox", "value": false }`. Render always sends the 0.6.0 name: a space not yet migrated (migration 0010, which renames Refresh to Refresh asked) rejects the write, so migration 0010 runs before the first publish on 0.6.0, as 0009 did for 0.5.0. When the number of `fixes` entries is above S's `@fixes`, `properties` has `"What to fix": { "type": "rich_text", "value": null }`, which clears the field, and `published` carries `@fixes` = that number. The skill sets each Ask row's own Brain Status to Done through the MCP; nothing else on it changes (its Report relation is Notion's side of Asked in).
- **Restricted notes (0055, capture-and-review §5.1; eligibility.md §6 rule 5, §8).** `sync plan` and `sync render` read every note other than a source or a proposal in its **published form**, the one the index uses (§5.8):
  - a note restricted whole, or with a restricted claim, is in the awaiting-cleanup form of §5.13: Name = `<type> <id>, title withheld: awaiting cleanup` (`reference ref-4m8q2k6p, title withheld: awaiting cleanup`), Summary empty, a free-text property such as a goal's Why empty, a restricted fact left out of Key Facts, and a body (a Document's) with its restricted lines, headings and comments as spaces; a note restricted whole has no body, facts or timeline;
  - a note whose only change is a dropped summary keeps its Name and loses its Summary;
  - in a published body (a Document's), a link to a note in the awaiting-cleanup form or restricted whole is its link text alone, as on the answer surfaces (§5.13, "A link to such a note"). No proposal is published (0.16.0); the session shows a proposal's wording by eligibility.md §4.3, §9.4 and §9.5;
  - wherever a rendered property names another note as text (Key Facts), a note in the awaiting-cleanup form is named by that label, never by its title;
  - a **report** that §5.13.1 withholds (judged with no caller: a memory it rests on counts when it is reviewed and superseded by nothing, memory.md §2 rules 1 and 2) is published as Name = `report <id>, withheld: refresh to rebuild` and the body `Withheld: this report rests on content you excluded from the brain, or was written before you excluded it, so it is not shown. Tick Refresh asked to rebuild it from what the brain may use now.`; this render doesn't clear Refresh asked and sets no `@git_body`, since nothing was refreshed;
  - an area's or a project's **Brief or Decision log section** whose view §5.13.1 withholds holds the line `Withheld: this view rests on a note awaiting cleanup, so it is not shown. brain views rebuilds it once that note is cleaned up.` in place of the view's generated block.

  **A page already in Notion is rewritten, not deleted** (eligibility.md §4.4, §14). The published form changes the note's B of Name, Summary and `@content` against S, so the next `sync render --changed` updates the page in place: Name, Summary and body as above, with Last Synced, and the page, its id and its relations stay. When the note has no restricted claim again (its cleanup resolved) or the report is refreshed, B changes back and the next render publishes the full form. Notion's page history keeps the earlier versions: the brain deletes nothing from Notion. `sync plan` compares a Notion value with the same form, so a page showing the label is in step, and an edit you make to the label is your edit, read as for any page.

- **Factories** (0.18.0, 0113 §1; one item per entry, its `id` the `fac-` id, `type` and `database` `factory` and `factories`; `--ids` takes `fac-` ids; after the notes in the output, in `brain.json` order):
  - Name = `name`; Area and Projects = the Factory's, from its `repos` entry or its own (schema §12), as relations, replaced whole; Overview as of = `{ start: overview.as_of, end: null }`, left out with no overview; Archived = a checkbox, `true` with `archived`, else `false`; Brain ID = the `fac-` id. Never Workflow, Domain or Tasks: the first is yours, the other two Notion's.
  - `body` and `sections` are `null`: the Overview toggle is written by the skill from `factory overview` (connected-workflows.md §9.1), never by render. `@content` isn't in `published`.
  - `create` carries `"template": { "type": "default" }`, as a project's, and the skill waits for the **Overview** toggle heading as it waits for "Brief"; a space whose Factories data source has no default template gets a page with the toggle heading appended. Before a create the skill looks up Brain ID, in the trash too, and records the page it finds instead.
  - An entry whose Area isn't published is created without it, in `pending_relations`, as any reference below.

- References to notes not yet published are left out of `properties` and listed in `pending_relations` (`[{ "property": "Org", "ids": ["org-…"] }]`). The skill publishes those notes first, records them, and renders again. A note that stays unpublished (0071: a Document not reviewed yet) is left out of `properties` the same way but **not** listed, since no render publishes it: the relation waits in the brain (an Inbox row's Documents) and fills at the render after the note is approved, because B then differs from S. A page whose only news is a relation to a note this same render creates (an item with `action: create`) is still returned, with empty `properties` (no Last Synced) and its `pending_relations`: the skill writes nothing for it and doesn't record it, publishes those notes, records them and renders again, so approving a Document in the session fills its Inbox row's Documents in the same run.
- **Draft pages from before 0.9.1 (0071, migration 0020).** `--unpublish-drafts` (alone: with `--changed`, `--ids` or `--plan` → `USAGE`) selects every concept and reference (and, until 0.16.0, every decision and question: their pages are archived with their databases since, §5.14.9) that has `notion`, has no `@trashed` in `notion_published`, whose `lifecycle` is `draft` and that a `pending` `review_notes` proposal lists in its `notes` (so a decision on that proposal can bring it back), except a `promoted` Document (its page is yours, 0049), with its module on. A draft no pending `review_notes` lists (a workflow decision written before 0.9.1, a Lifecycle you set to Draft by hand) keeps its page. Each renders as `action: "trash"` with `page_id` = its `notion`, empty `properties`, `body` and `sections` `null`, and `published` = `{ "@trashed": <--now> }`. The skill lists them and asks once; after a yes it moves each page to Notion's trash through the MCP and records it; `sync record` then removes the note's page (§5.14.6), so approving it later creates a fresh page through `--changed`, and the relations other pages held to it are sent again without it. `--changed` never selects such a page for trash: the cleanup runs only when asked.

Each item:
```json
{
  "id": "per-3h8w2n6c", "type": "person", "database": "people", "database_id": "…",
  "page_id": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d", "action": "update",
  "properties": {
    "Role": { "type": "rich_text", "value": "Product lead" },
    "Last Synced": { "type": "date", "value": { "start": "2026-12-05T09:00:00Z", "end": null } }
  },
  "body": null,
  "sections": null,
  "pending_relations": [],
  "published": { "Name": "Maria López", "Summary": "Product lead at Acme.", "Role": "Product lead", "Org": ["9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d"], "Lifecycle": "Reviewed", "Brain ID": "per-3h8w2n6c" }
}
```

- `action`: `create` when the note has no `notion`, else `update`; `trash` for a draft page leaving Notion (`--unpublish-drafts`, above). Meetings are always `update`; a meeting without `notion` → item error `MEETING_NOT_PUBLISHED`. A project `create` (0068) also carries `"template": { "type": "default" }`: its page comes from the Projects data source's default template (the "Brief" and "Decision log" toggle headings, the linked views and "My notes"), so the skill creates it with that template and `properties` (Brain ID among them, so the next `sync plan` links the page), and no children, then writes `sections` once the template's content is on the page. Render can't see the space's templates, so every project `create` carries it, with `--changed` or `--ids`; no other item has a `template` key, and `sync record` takes only `published`. Status is not sent (it is yours, 0021): the page has the Status the template sets, else none. The skill's side:
  - **Waiting for the template.** Notion applies the template after the create returns. The skill re-reads the page's blocks a few times, over about 30 seconds, until the "Brief" and "Decision log" toggle headings are there. On a page created from the template in this run, it never appends toggles (the rule under **Page content** is for pages created without one): if they don't appear, or a section write fails, it records the page with `"@content": null` (§5.14.6: a null `@` key removes that baseline), so the page is linked and the next render sends `sections` as an `update`.
  - **No default template** in the space: the skill creates nothing for the project, records nothing for it, and reports it; the user creates it with **New project** in Notion, the note's id in its Brain ID, so the next `sync plan` links the two (0021). Notes that relate to it keep it in `pending_relations` and are written without that relation this run; the skill doesn't render again for it. Before 0.9.0 render refused a project without `notion` with item error `PROJECT_NOT_IN_NOTION`; 0068 retires it.
- `published`: B for every rendered property except Last Synced and pending relations, plus `@content` = `sha256:<hex>` of the rendered `body`/`sections` when the type has content (for a source, of `body` only; its Full text is tracked by `@full_text`). This is the new S once the write succeeds.
- **Page content** (decision 0026): the brain writes only what it owns.
  - `body` (references): replaces the whole page body (a `promoted` reference: on create only). Decisions and questions had one too, until 0.16.0.
  - `sections` (projects): `{ "Brief": <the brief's generated block>, "Decision log": <the decision log's generated block> }`. As in a published body, a link to a note with a Notion page becomes a link to that page and any other link is its text alone, with two rules for sections: a link to a decision or a question is its text alone, even when the note has a `notion` page from before 0.16.0, since neither has a page now (0099, schema §16.2); and a link to a Document whose `lifecycle` is `draft` is its text alone even when it has a page (a Draft row published before 0.9.1; a draft person keeps its link, since people have pages as drafts): Notion shows reviewed knowledge only (0071). A link to a Notion page URL, the task link of a tracked question's line in the Brief (schema §16.1), is kept as written. The skill replaces only the children of the toggle heading with that exact name. `render` can't see Notion page content, so finding the toggle is the skill's job, after it reads the page through the MCP (0033): a page with **no toggle headings at all** gets the missing "Brief" and "Decision log" toggles appended and filled; a page just created from the template (0068) gets them from the template, applied after the create returns, so the skill waits for them before it applies this rule; a page with other toggle headings but not the named one is reported as `SECTION_NOT_FOUND` and left as it is.
  - `sections` (areas, 0041): `{ "Brief": … }`, as above.
  - `body` (sources other than captures, 0043; reports): as above. No `sections` on a source: Full text is retired (0049).
  - Goals, people, orgs, meetings and captures: `body` and `sections` are both `null`.
  - Rendering: `^[inferred]` → ` (AI inference)`, `^[ambiguous]` → ` (ambiguous)`, and relative links to published notes become `https://www.notion.so/<page id without dashes>`. A link to an unpublished note becomes plain title text, and so does a link to a decision or question, which has no page since 0.16.0 (0099), even if it still has a `notion` id from before.
  - **A whole Document's links (0091).** The body of a Document with `origin: whole` is its source's text, someone else's, so its links are read against the repo the file came from, not against the brain. Its **repo** is its source's `repo` and its **repo path** is the source's `repo_path` (schema §4 source); a **file match** for a target `t` is a Document with `origin: whole`, other than this one, whose source (`sources[0]`) has the same `repo` and a `repo_path` that is `t` or `t.md`, or whose last segment, without `.md`, is `t`. Outside fenced code and inline code:
    - `[[t]]`, `[[t|label]]`, `[[t#heading]]`, `[[t#heading|label]]` and the embed `![[…]]` of each show `label`, or `t` when there is no label (`[[t\|label]]`, as written inside a table, reads as `[[t|label]]`); the heading goes. That text links to `https://www.notion.so/<page id without dashes>` of the one file match when there is **exactly one** and it has a Notion page (`notion`); otherwise (no match, two or more, a match not yet published, or a Document with no repo) it is plain text: the brain never guesses.
    - A relative Markdown link `[text](p)` is resolved against the folder of the repo path (`#…` and `?…` dropped, `%xx` decoded) and linked the same way to the one Document whose source has that `repo` and that `repo_path`; otherwise it shows `text`. A link with a scheme (`https:`, `mailto:`) is kept as written; an anchor alone (`#…`) shows its text. An image `![alt](p)` with a scheme is kept as written; a relative one, a file of the repo that Notion can't reach, shows `alt` and never links.
    - The markers are rendered as above; nothing else in the body changes. The page changes on the next render after the target is ingested and published (its B of `@content` differs from S); the files never change.

    Example: two whole Documents kept from `notes/alpha.md` and `notes/beta.md` of repo `vault`, both published. In alpha's page, `See [[beta|the beta note]] and [[gamma]].` renders as `See [the beta note](https://www.notion.so/<beta page>) and gamma.`; once `gamma.md` is ingested and its Document published, the next `sync render --changed` updates alpha's body to link `gamma` too.

`data` = `{ "items": […], "errors": [ { "id": "…", "reason": "MEETING_NOT_PUBLISHED" } ], "skipped": [ { "id": "…", "reason": "ROW_CONFLICTED" | "FIX_WAITING" | "NOT_REVIEWED" | "HISTORY" | "WORDING_PENDING" | … } ] }` (`ROW_CONFLICTED` and `FIX_WAITING` only with `--skip-conflicted`; `NOT_REVIEWED` and `HISTORY` (a weekly review kept as a 0.15.x Documents row, §5.34) only with `--ids`; `WORDING_PENDING` only with `--plan`, and it holds only the body when the note's item is also in `items`, §5.14.7), items sorted by database (table order), then id. Exit 1 if `errors` is non-empty (the other items are still returned); `UNKNOWN_ID` for `--ids` is a whole-command error.

**Key Facts text** (projects, rendered here and parsed back by `sync plan`): one segment per `facts` key, sorted by key, joined by ` · `. Segment = `<Label>: <value>`; label = the key with `_` → space and the first letter uppercased; a person-id value renders as the person's title. Parse: split on ` · `, then on the first `: `; label → key by lowercasing and space → `_`; a person title (or alias) maps back to its id (ambiguous → conflict `AMBIGUOUS_PERSON`). Values containing ` · ` are not supported in v1. Example: `Budget: 80000 EUR · Launch date: 2027-02 · Owner: Maria López`.

#### 5.14.5 `brain sync tasks`

```text
brain sync tasks (--meeting <mtg-id> | --source <src-id> | --direct | --question <que-id>) --input <file|->
```

Renders Notion task payloads for a meeting's action items, or for the **owner's** action items in any other source (`--source`, 0037), or for tasks the user dictated in a live chat (`--direct`, 0072, below), or for the task that tracks a question or risk (`--question`, 0099, below), using the `brain.json` Tasks mapping (0018, schema §12); writes nothing. Exactly one of `--meeting`, `--source`, `--direct` and `--question` (`USAGE` otherwise).

Input: `{ "items": [ { "title": "Send Supabase migration plan", "owner": "Carlos Ruiz", "due": "2026-12-10", "projects": ["prj-9x4t1b7e"] } ] }` (`owner`, `due`, `projects` optional). An item may carry `"status": "waiting_on"` (capture-and-review §6): someone else's commitment that the user tracks. It needs `owner` (their name, `INPUT_INVALID` otherwise), takes the status `notion.tasks.waiting_on_status` (schema §12; default `Waiting On`) instead of `new_task_status`, and, unlike an owner Task from `--source`, sends the owner. Any other `status` is `INPUT_INVALID`. Without `waiting_on` the owner-only rule holds. For an extract input (0055) an item also carries `"item": "s1.i3"`, the id of the item that authorized it; it is echoed on the item's payload and must be an item of the extract's `selection` whose effective selection is `use` **and one of whose paragraphs the extract holds** (an item that depends on excluded context and was not imported creates no Task); `item` is required for a source that is an extract (`INPUT_INVALID` otherwise: an excluded item, or an item-less Task, creates no Task).

**A follow-up (0079, capture-and-review §6.3).** For an extract source, an item may carry `"follow_up": "q1"` instead of `item`: an unticked quick follow-up of lean minutes. `{ "title": "Send Ana the deck", "follow_up": "q1", "projects": ["prj-9x4t1b7e"] }`. Its rules, each refused with `INPUT_INVALID` and the pointer `/items/<n>/<key>`:
- only with `--source` naming an extract source (`extract: true`); with `--meeting`, `--direct` or another source it is refused;
- the value is a `q` id, `q` and one or more digits in lower case;
- `item`, `due`, `status` and `owner` are refused beside it: a follow-up Task names no item, has no due date, and is the owner's own;
- a `q` id that is a key of `task_items` on the source or on any source along its `replaces` chain is refused, the message naming the page id it maps to (it already has its Task); so is a `q` id given on two items of one input.
The payload is the `--source` one (title, `new_task_status`, the project and area relations from `projects`, the backlink, `brain_id`) and echoes `follow_up` like `item`. `projects` follows the `--source` rule: the skill passes the meeting's projects. Unlike every other item, a follow-up is checked against what is recorded: this is the one dedupe `sync tasks` does.

`projects` (dogfood finding 7): the projects this task is about, as project ids. Absent or empty → the meeting's `projects`. Errors, disjoint: an id with no note → `UNKNOWN_ID`; an entry that isn't a string, or an existing note that isn't a project → `INPUT_INVALID` with the pointer `/items/<n>/projects/<m>`.

Each item → `{ "database_id": "…", "properties": { "<mapped name>": {type, value} } }` with:
- title; due; status = `new_task_status`, typed as `notion.tasks.status_type` (`{ "type": "select", "value": "To Do" }` when absent or `select`, `"status"` when the mapping says `status`; schema §12, #113);
- project relation from the item's `projects`, else the meeting's; area relation by **A task's Area** below (each when published and mapped). A project not yet in Notion is left out and listed in the item's `pending_relations`, as in `render`;
- owner as `{ "type": "person_name", "value": "Carlos Ruiz" }`: the skill writes it as text, or resolves it to a Notion user when the mapped property is a people property;
- the backlink: the meeting relation (`meeting`), else the meeting's Notion URL (`meeting_url`);
- brain_id = the meeting id.

**A task's Area (0.18.0, 0113 §9, 0114; capture-and-review §6.5).** At most one Area is sent, when published and mapped. It is the one Area the task's projects share. When they are in different Areas no Area is sent, and the envelope has a warning `{ "code": "TASK_AREA_NOT_SET", "message": "…" }`, its message naming the item by its place and title, which the skill's report names under Check. With no project, it is the meeting's `area` (`--meeting`) or the question's own `area` (`--question`), else the one Area the task's Factories share when the task has a Factory, else none. The task's projects are the item's `projects`, else (`--meeting`) the meeting's: with any project, the meeting's `area` is never used, so a meeting of Area A whose projects are in B and C gives a task with no Area and the warning. An item's own `area` (`--direct`) is used as given, before this rule. (Until 0.18.0 a meeting's task took the meeting's `area` whatever its projects, and the other forms sent every Area of the projects: 0114.) A new row has no Area, so *if empty* always holds.

Unmapped (empty) properties are left out. After creating the tasks, the skill records their page ids with `sync record`.

**With `--source`** (a document, email, chat, note or capture; a `minutes` source → `INPUT_INVALID`, since its tasks belong to its meeting), the same rules apply with these differences:
- `projects`: absent or empty → no project (a source has no projects of its own). The skill passes the projects the action item is about, or the capture's Project (0037).
- area relation by **A task's Area** below.
- the backlink: the `source` relation to the source's Inbox row, when mapped and the source has `notion` (else left out and listed in `pending_relations` as `{ "property": "source", "ids": ["src-…"] }`, so the skill publishes the Inbox row first). No `meeting` or `meeting_url`.
- brain_id = the source id.
- `owner` is left out: these tasks are yours.

**With `--direct`** (0072, [assistant.md](assistant.md) §7: a task the user said yes to in a live chat; there is no meeting or source), the same rules apply with these differences:
- an item may carry `area` (an existing `area-` id: `UNKNOWN_ID` when no note has it, `INPUT_INVALID` when the note isn't an Area); `item` is refused (`INPUT_INVALID`);
- `projects`: absent or empty → no project;
- area relation: the item's `area` when given, else by **A task's Area** below;
- no backlink (`meeting`, `meeting_url` and `source` are left out) and no `brain_id`;
- an item may carry `factory` (0.18.0, 0113 §5): the `fac-` id of a Factory that isn't archived, for a follow-up the user said yes to at a session's close (connected-workflows.md §15.4). It sends the relation `notion.tasks.properties.factory` = the Factory's page, listed in `pending_relations` while the row isn't published. With Factories off or the property unmapped → `INPUT_INVALID`, pointer `/items/<n>/factory`; an id that is no entry, or an archived one → `UNKNOWN_ID`. It sets no project; its Area is by **A task's Area** below (0113 §9, capture-and-review.md §6.5). No other form of `sync tasks` accepts `factory`;
- `owner` is left out, except on a `waiting_on` item: `"status": "waiting_on"` with `owner` (their name, as text) is accepted as for a meeting, and sends that owner and `waiting_on_status`;
- nothing is recorded afterwards: the task belongs to no note, so the skill doesn't call `sync record` for it.

**With `--question`** (0099 §3 to §5, capture-and-review §6.4: you said "track it", or the line carried `Track: Waiting On —`), the input is exactly one item, `{ "items": [ { "status": "waiting_on", "owner": "Sam", "due": "2026-12-10" } ] }`, every key optional (`{ "items": [ {} ] }` is a To Do task with no owner or date). Checks, each `INPUT_INVALID` unless named:
- `--question` names a note (`UNKNOWN_ID`) that is a `question`, of either `kind`, and is **open** (schema §4: no `answer`, no `dropped`, not `archived`) and not tracked yet (no `task`): a question is tracked once;
- one item; `title`, `projects`, `area`, `item` and `follow_up` are refused beside it (they come from the question); `status` is absent or `waiting_on`; `owner` is allowed only with `waiting_on`, and, unlike a meeting's, a `waiting_on` item may leave it out (you asked someone and didn't say whom, or the line names nobody).

The payload is built from the question:
- title: the question's `title`. When `notion.tasks.properties.kind` is empty or absent (a mapped database without Kind, schema §12), the title starts with `Question: ` for `kind: question` and `Risk: ` for `kind: risk`;
- **Kind** (the mapped `kind` property, when there is one): `{ "type": "select", "value": "Question" }` or `"Risk"`, from the question's `kind`. No other form of `sync tasks` sends Kind;
- status: `new_task_status`, or `waiting_on_status` with `waiting_on`, typed as `status_type`; owner as `--meeting` sends it; due when given;
- project relation from the question's `projects` (when published and mapped); area relation by **A task's Area** below;
- the backlink: the meeting relation (`meeting`, else `meeting_url`) of the question's `raised_in` meeting; else, when the question has no `raised_in`, the `source` relation to the Inbox row of its first source that has one; else none. A target not yet in Notion is listed in `pending_relations`, as above;
- brain_id = the question's id, so the task points back to its question.

The skill creates it once and records it with `sync record` `{ "id": "que-…", "task": "<page id>" }` (§5.14.6), which sets the question's `task`. Nothing else is recorded: the task is not added to the meeting's or the source's `tasks`.

Who the item is for and its due date are the skill's judgment: only action items addressed to the owner become tasks, and `due` only when the text gives one (0037). A to-do is never written as a question instead (capture-and-review §6.1, 0071); other people's commitments become a Task only as `waiting_on`, above.

**No dedupe here, for either form,** except a follow-up's `q` id (above). `sync tasks` renders exactly the items it is given, every time; it never compares them with the note's `tasks`. Tasks are created once, in the run that ingests the meeting or source: a second ingest of the same input is skipped as `DUPLICATE_SOURCE` (§5.5) before any action item is extracted, so there is no rerun to dedupe. Within that run, the skill creates each rendered item once and records the page ids it created (§5.14.6); an item held back by `pending_relations` is rendered again with only the held-back items, as above. The note's `tasks` is a record of page ids (appended, deduped by id), not a dedupe key.

With Tasks off (schema §12, 0048), the command refuses with `MODULE_OFF` before reading its input; so a question is never tracked with Tasks off (capture-and-review §6.4).

Errors: `MODULE_OFF`, `UNKNOWN_ID` (the meeting, source or question, or an item's project id), `INPUT_INVALID` (an item's `projects` entry that isn't a string or isn't a project; `--source` naming a `minutes` source or a note that isn't a source; `--question` naming a note that isn't an open question, or one already tracked), `BRAIN_CONFIG_INVALID` (no Tasks database, or `brain.json` fails its schema, which requires a title mapping and a backlink mapping once a Tasks database is set).

#### 5.14.6 `brain sync record`

```text
brain sync record --input <file|->
```

Stores what the skill published. Input: `{ "records": [ { "id": "per-3h8w2n6c", "notion": "6a7b…", "synced_at": "2026-12-05T09:01:10Z", "published": { … }, "tasks": ["…"] } ] }`.

- `notion`: set if absent; if present and different → item `failed`, `NOTION_ID_MISMATCH`.
- `published` (the render item's `published`): merged into `notion_published`, key by key. **A value of `null` on a key that starts with `@` removes that key** (0054; a `null` on an ordinary property is a real empty baseline and is kept, as in the `Summary: null` example of §5.14.2): after a body is published but its read-back failed, the skill records `"@notion_body": null`, so the old baseline of a previously published page is dropped and the next plan finds the page without a baseline (row 9) instead of comparing a new `@git_body` with an old `@notion_body`.
- **A `fac-` id (0.18.0)** records on its `brain.json` entry: `notion`, `published` (merged into the entry's `published`) and `synced_at` as `last_synced`, with the same `NOTION_ID_MISMATCH`. Any other key → `failed`, `INVALID_RESULT`. An id that is no entry fails as an unknown note does.
- **A body written without its read-back (CC-262).** A record whose `published` carries `@git_body` (render put it there because the item sent a report's, a promoted Document's or a workflow Document's body, §5.14.7) but has **no `@notion_body` key** (neither a hash nor `null`) is still recorded in full: `notion`, `last_synced` and the rest of `published`, so the page is linked and never created twice. The command adds a warning `{ "code": "NOTION_BODY_MISSING", "message": "…", "id": "<note id>" }` to the envelope's `warnings` and keeps exit 0. It means the skill that wrote the body skipped the read-back of §5.14.7: without `@notion_body` the next plan has no Notion baseline, so it holds the page (row 9) and asks for an Accept on a page nobody edited. A `null` is not warned: it is the skill saying the read-back failed. A record with no `@git_body` (a properties-only write, a held body, any other note) is never warned.
- `synced_at` → `last_synced` (knowledge notes and sources), the time of the last publish.
- `tasks` (meetings and sources): appended to the note's `tasks`, deduped, order kept.
- `task` (a question only, 0099, capture-and-review §6.4): the page id of the task `sync tasks --question` rendered for it, set as the question's `task`. The record's id must be a question that is open and has no `task`, or already has this same `task` (a retry records nothing new); otherwise `failed`, `INVALID_RESULT`. It is the only field a question record carries since 0.16.0.
- `task_items` (an extract source only, 0055): `{ "<item id>": "<Notion task page id>" }`, merged into the source's `task_items`. Validation (a failed record, `reason`): the record's id must be an extract source (`extract: true`) and every key an item id of its `selection` or a follow-up's `q` id (`q` and digits, lower case; 0079, capture-and-review §6.3), and every value in the record's `tasks` or already in the source's `tasks`, otherwise `INVALID_RESULT`; an item id or `q` id already mapped to a **different** page is refused with `TASK_ITEM_EXISTS` and nothing is replaced. The skill sends one record for the meeting (its `tasks`) and one for the extract source (`tasks` and `task_items`) when a meeting was ingested from an extract.
- A source record changes only these system fields (schema §4: its body and content fields stay as captured). `@full_text` is merged like any other key.
- A report record (0043) sets the view's `notion`, `last_synced` and `notion_published`; nothing else. It is the only write to a report besides `report new` and `report fix` (§5.18).
- A trash record of a concept or reference (a decision or question too, before 0.16.0; `--unpublish-drafts`, 0071) is one whose `published` has `@trashed` and whose `notion` equals the note's: it **removes** the note's `notion`, `notion_published` and `last_synced`, so the note has no page again (a Draft until approved, then created as a new page). A `notion` that differs → `failed`, `NOTION_ID_MISMATCH`, and nothing changes. Restoring the page from Notion's trash links it again at the next `sync plan` (§5.14.2: a note with no `notion` gets the row's page id).
- Does not change `updated`; does not log (the skill logs `publish`).

`data` = `{ "records": [ { "id": "…", "result": "recorded"|"failed", "reason"?: "…", "changed": ["…"] } ] }`. Exit 1 if any failed.


> **0.8.0 (decision 0055):** the plan items for selected captures and exclusion cleanup are specified in [capture-and-review.md](capture-and-review.md) §4 and §5 and added here by CC-78 and CC-79. Per-item decisions are given in the session since 0.16.0 (capture-and-review §7.6).

#### 5.14.7 Accepted wording from Notion (0054)

Notion Brain Assistant can write a Document's or a report's body inside Notion (buttons *Write up* and *Refresh report*, both on Documents since 0.9.1, 0071). Only wording the user **accepted exactly** comes back to Git; this section is the whole mechanism. The Notion side (the controls and their names) is in docs/notion-space-design.md §3.17; here is what the CLI reads and does.

A Report row (§5.14.1) whose Brain ID names a report published as **another** page is a conflict `NOTION_ID_MISMATCH` (§5.14.2) and plans nothing, wording included. **Which rows the skill snapshots.** In addition to §5.14.1's selection, the skill enumerates the candidates **from Git, then selects their rows in Notion once**: the candidates are listed from the brain index (§5.8: `notes` of type `reference`, and of type `view` with `fields.view_kind` `report`) and **each candidate's file is then read** at its `path`, because the index carries neither `origin` nor `last_synced`: a reference is a candidate when its frontmatter has `origin: promoted` or `origin: workflow` (with Documents on; connected-workflows.md §6.3), a report when Reports is on; `since` and the baseline S come from the same frontmatter (`last_synced`, `notion_published`). A key absent in the file is a missing baseline. Let **since** = the earliest `last_synced` among the candidates, **minus 2 minutes** (Notion rounds edit times down to the minute, so a draft written seconds after a publish can carry an edit time earlier than `last_synced`); if any candidate has no `last_synced` **or no `@notion_body` or `@git_body` in `notion_published`** (never published, or a baseline lost), there is no `since`: the query then returns every existing Notion row that matches the other conditions, so a row with a lost baseline is **eligible for the table** below (a never-published candidate has no Notion row to return). The table is first-match: row 9 handles a missing S only when no earlier row matched and N ≠ G. The skill queries the Documents database (reports included since 0.9.1; in a space not yet on migration 0019, also the Inbox rows of Kind Report) for rows where **Accepted** is ticked **or** the page's last edit is at or after `since` (no filter at all when there is no `since`), **following `next_cursor` until the query is exhausted** (a page of results is never taken as the whole), and keeps those whose Brain ID is a candidate. The filter is deliberately wide: a row read without need is harmless, because the comparison below decides per note; a row never read could hide a pending draft. **The same pass's Documents read stands in for that query (CC-216).** With Documents on, every pull already reads all rows of the Documents database (§5.14.1). When that read, in the same pass, is **complete** and has read, for **every** row, its Brain ID (an empty one included), its Accepted box and its `last_edited_time`, the skill applies the filter above to those rows instead of querying again: a row is selected when Accepted is ticked or its `last_edited_time` is at or after `since` (every row when there is no `since`), and kept when its Brain ID is a candidate. Complete means one enumeration followed through `next_cursor` from its first page until there is none, every page read: a page that failed and was read again with its own cursor still counts, and an enumeration started over counts only if the new one is complete itself. Otherwise (Documents is off, so only some Report rows were read; the read stopped before the end; or one of the three was not read on some row: a property left out of the read, a Documents database without Accepted) the skill runs the query above: an incomplete read is never taken as the whole, so a row on a page that was not read is never left out. The reuse is local to the pass (rows read by an earlier run are never reused) and changes only how rows are selected: each selected page is still read for its `wording` (below), the guards before render, refresh and apply still read their pages and the Inbox rows of Kind Report in a space not yet on migration 0019 keep their own query (the pass does not read every such row with its Accepted box). A candidate the query (or the same-pass selection) did not return is not in the snapshot, which means its page was not edited since `since` **or only had text deleted** (a deletion does not move the edit time, T4, decision 0062): it holds nothing to import, and the render guard below protects a draft that only lost text. A snapshot row that carries these fields has them in a `wording` object on the row (`{ database, page_id, last_edited, properties, wording }`; `wording` is the only new row key):

| Field | Meaning |
|---|---|
| `accepted` | the Accepted box is ticked |
| `accepted_at` | Accepted at (ISO UTC), `null` when empty |
| `page_edited_at` | the page's own `last_edited_time` (ISO UTC). **This is the signal for edits made in a later minute than the click**: adding or changing a block moves it; **deleting a block does not** (T4, decision 0062), so a deletion is not detected by it. Notion rounds it to the minute |
| `body_markdown` | the page body converted by the rule below, **excluding** any proposed-revision block and any proposed-refresh section; `null` when `unconvertible` |
| `unconvertible` | the body has a block the conversion cannot express (row 2 of the table below); then `body_markdown` is `null` |
| `pending_revision` | a *Proposed revision* block is on the page (Write up) |
| `pending_refresh` | a *Proposed refresh · based on Notion* section is on the page (Refresh report) |

A snapshot row without these fields (taken by an older skill) is read as `accepted: false`, nothing pending and no body: nothing is imported or held.

**Blocks to Markdown (normative, for `body_markdown`).** Paragraph → the text; heading 1/2/3 → `#`/`##`/`###`; bulleted and numbered list items → `- ` / `1. ` (nesting by two spaces); to-do → `- [ ]`/`- [x]`; quote → `> `; callout → `> ` plus its icon and text on one line; toggle → a `<details><summary>…</summary>` block with its children; code → a fenced block with its language; divider → `---`; link → `[text](url)`; bold, italic, strikethrough and inline code → `**`, `*`, `~~`, `` ` ``. Page and database mentions become `[title](notion-page:<page id>)`. A block the table doesn't name (embed, synced block, table, column) makes the row `UNCONVERTIBLE_BLOCK` (below): never guessed. Blocks are joined by one blank line; the result ends with one `\n`. A date mention is written by the rule below. The same text always gives the same Markdown, so the fingerprint is stable.

**Date mentions (normative; 0.18.0, CC-402).** A date mention (`@14 November`) is written as its rich text item's **`plain_text`** in the block read (`API-get-block-children`). A Markdown read (`API-retrieve-page-markdown`) gives a tag instead, which is written as the same text, so both replies give one Markdown (CC-387's and CC-402's reads of a synthetic page, build/TASKS.md):

| Mention | Written as | From the Markdown read's tag |
|---|---|---|
| a date | `2026-11-14` | `<mention-date start="2026-11-14"/>` → `start` |
| a date with a time | `2026-11-14T10:30:00.000+01:00` | `<mention-date start="2026-11-14" startTime="10:30" timeZone="Etc/GMT-1"/>` → `start`, `T`, `startTime`, `:00.000`, the offset |
| a range | `2026-11-14 → 2026-11-16` | `<mention-date start="2026-11-14" end="2026-11-16"/>` → `start`, ` → `, `end` |
| a range with times | `2026-11-14T22:00:00.000+01:00 → 2026-11-15T01:15:00.000+01:00` | `<mention-date start="2026-11-14" startTime="22:00" end="2026-11-15" endTime="01:15" timeZone="Etc/GMT-1"/>` → each end as a date with a time, ` → ` between |

- **The offset** is the one of `timeZone` on that day, each end its own: an `Etc/GMT` name has its sign reversed (`Etc/GMT-1` is `+01:00`, `Etc/GMT+5` is `-05:00`), `UTC` is `+00:00`. A **named zone** (`Europe/Madrid` is `+01:00` on 14 November and `+02:00` on 14 July) is never worked out from memory: the skill reads the block that holds the mention with the block read and writes the item's `plain_text`. Only a block the block read doesn't reach takes the offset from the zone's rules.
- **A tag with any other attribute** is written from its block's `plain_text` the same way. If that block can't be read, a `body_markdown` is unconvertible (row 2 below), and in any other reading the tag stays as the reply gives it.
- **A reminder** adds nothing: a mention holds a date value (`start`, `end`, `time_zone`) and nothing else ([date](https://developers.notion.com/reference/page-property-values#date)), so a date with a reminder is written as that date.
- **Notion's Markdown v2** writes the same tag `<date …/>`, with `start-time`, `end-time` and `time-zone` ([migration guide](https://developers.notion.com/guides/data-apis/migrate-to-notion-flavored-markdown)); it is read by the same table.
- Emphasis on a mention is kept around its text (`**2026-11-14**`). A date typed as text (`14 Nov 2026`) and a tag inside code stay as they are.

**Readings covered.** Every read of a page's text: a Document's or a report's `body_markdown` (this section; its re-reads before apply, refresh and render, and its read-back, included); a meeting's minutes, summary and transcript (capture-and-review §3.4, §4.2); an Inbox capture (its text, its summary and its transcript) and a checked row (capture-and-review §12.5); a task page kept as a document (capture-and-review §13.3). The skills convert: the CLI reads no page. A title or text property is in this form already (its segments' `plain_text` joined, §5.14.10).

**A page read before.** What Git holds is never rewritten, and the form of a date alone is never an edit. A page read before 0.18.0 may be recorded with the tag. When such a page holds a date mention and its text in the form above doesn't match what the brain recorded, the skill makes the text once more with each date mention as the Markdown read gives it (the tag, byte for byte) and nothing else different. **If that matches, the page is unchanged and that text is the one this run uses**, wherever the text or its hash is asked for.

| What the brain recorded | It matches when |
|---|---|
| `@notion_body` of a Document or report | the text's hash is `@notion_body` |
| a source's `content_hash` (a meeting's minutes stored whole, a capture, a checked row, a task page) | `note new --dry-run`, with `replaces` (§5.5), skips it as `DUPLICATE_SOURCE` |
| an extract's `transcript_hash` | `source extract-plan --previous` gives `transcript_changed: false`; the summary and the transcript are given in the same form, both with the tags or neither |

When neither form matches, the page did change: the form above is used, and a changed line that differs from the recorded one only in how a date is written is not analysed (`source diff`, §5.19). **Known limit:** a baseline in neither form (a mix of the two) reads as a change, as before: a Document or report stays held (row 11) until the user accepts it.

**Four hashes.** `sha256:<hex>` of UTF-8 text. For a row: **N** = the hash of `body_markdown` (Notion now); **G** = the hash of the note's body in Git now (the raw body, not what render would send), taking away only the one newline the file format puts before it: text that starts with blank lines keeps them, so an import round-trips. Two baselines in `notion_published` say what both sides held at the last sync: **SN** = `@notion_body`, the hash of the Markdown the skill **read back from the page right after the last publish or import**, and **SG** = `@git_body`, the hash of the Git body at that moment. They are two values because what Notion serves back is not byte-equal to what `render` sent (the block conversion differs from the rendering), so N could never equal a hash taken from the sent text. "Notion unchanged since the last sync" is N = SN; "Git unchanged" is G = SG. After every publish of a Document or report body, and after every import, the skill re-reads the page and records `@notion_body` through `sync record` (`published`); `render` puts `@git_body` in the item's `published`, and an import sets both (N = G then). A missing SN or SG is a missing baseline. (A promoted Document's body is sent once, on create, §5.14.4; a report's body is sent by render on a refresh.)

**Plan output.** `sync plan` gains four arrays:
- `accepted_wording`: `{ "page_id": "…", "kind": "document"|"report", "note": "ref-…"|"vw-…", "accepted_at": "…", "page_edited_at": "…", "fingerprint": "<N>", "markdown": "…", "base": "<SG>", "unattended_ok": true|false, "diff": { "added": 12, "removed": 3 } }`. `unattended_ok` is true when `as_of` − `accepted_at` is at least 2 minutes; `diff` is the count of lines added and removed compared with the Git body (a line diff, for the preview).
- `wording_waiting`: `{ "page_id": "…", "note": "…", "reason": "REVISION_PENDING"|"REFRESH_PENDING"|"EDITED_AFTER_ACCEPTANCE"|"GIT_CHANGED"|"UNCONVERTIBLE_BLOCK"|"INVALID_REPORT_SHAPE"|"ACCEPTANCE_UNDATED"|"NO_BASELINE"|"EMPTY_BODY", "accepted": true|false }`: rows that need the user (accepted but blocked, or a pending proposal). Named in the report; never also a conflict. `accepted` is the snapshot's Accepted box (on this and the next list), which render reads (below): only REVISION_PENDING and REFRESH_PENDING can be either (rows 4 and 5).
- `wording_held`: `{ "page_id": "…", "note": "…", "reason": "UNACCEPTED_DRAFT"|"UNCONVERTIBLE_BLOCK"|"NO_BASELINE", "accepted": false }`: rows that must not be overwritten and are **not** accepted. `UNACCEPTED_DRAFT` (row 11) and `UNCONVERTIBLE_BLOCK` (row 2) need nothing from the user: only render reads them (below), and they are not listed in Needs you. `NO_BASELINE` (row 9, a legacy or lost baseline) is the one the attended skill raises: it shows Notion's text and Git's as a full diff and asks which side to adopt. **Adopt Notion** is offered on `wording_waiting` `NO_BASELINE` (the page is **accepted**, so the snapshot has a real `accepted_at`): after the user confirms the diff in chat, the skill builds an `accepted_wording` item itself from that row (`accepted_at` and `page_edited_at` from the snapshot, `fingerprint` = N, `markdown`, `base` = the hash of the Git body now, `unattended_ok` false, `verified` from a fresh re-read of the page, as for any planned item) and passes it to `sync apply`, which imports it like any accepted wording, putting Notion's text in Git and recording both baselines. The user's confirmation in chat is the attended step; **no Notion click time is ever invented**. On an **unaccepted** row (`wording_held` `NO_BASELINE`, `accepted_at` null) Adopt Notion is not offered: the skill tells the user to click **Accept** (which sets the time; Accept write-up or Accept refresh before 0.9.1) and to catch up again, when the row is the accepted case above. **Adopt Git:** the brain never rewrites a Notion body (a promoted Document's body is create-only), so the skill shows the Git text for the user to paste into the page; no baseline is recorded, the hold stays, and the next plan finds N = G (row 8) and records the baselines then. Neither choice records a baseline without making the two sides equal.
- `clear_accepted`: `{ "page_id": "…", "note": "…", "accepted_at": "…", "page_edited_at": "…", "fingerprint": "<N>" }`: rows with `accepted` true whose acceptance was consumed without an import (rows 8 and 12 below); `accepted_at`, `page_edited_at` and `fingerprint` (the hash of the body, N) are the acceptance and the page state being consumed. **The skill clears Accepted and Accepted at only after re-reading the page and finding Accepted still ticked with that same Accepted at, the same `page_edited_at`, no pending proposal and a body that hashes to the same `fingerprint`** (the hash catches an edit made after the plan inside the same minute). After an import the skill compares the same four things with the applied item (`accepted_at`, `page_edited_at`, `fingerprint`). If the user accepted again (a later time), unticked it, edited the page in a later minute or added a proposal since the plan, the skill leaves the row alone and the next run plans it afresh (an edit then reads as row 6, a stale acceptance, and is reported), so a newer decision is never consumed unseen. An edit inside the same minute as `page_edited_at` is the known limit of decision 0058. After a successful import the skill does the same for each applied `accepted_wording` item, comparing with the item's `accepted_at`.
A `refresh_requests` item gains `"wording_blocked": true` when its report is named by any row above: the skill does not run that refresh (below).
The usual `conflicts` and `ignored` stay as they are.

**Outcome per state of a Document or report body (normative; the first matching row wins).** "Edited after acceptance" means `page_edited_at` is later than `accepted_at`, both taken to the minute (an edit in the same minute as the click cannot be told from the click's own write, because Notion rounds times to the minute. This is a **known limit**: it is bounded by the preview and the age rule below, not removed).

| # | State | Result |
|---|---|---|
| 1 | Document with Documents off, or report with Reports off | `ignored` `MODULE_OFF`; nothing else |
| 2 | the body has a block of an unconvertible kind, or `body_markdown` does not end with one newline (N cannot be trusted), accepted or not | accepted: `wording_waiting` `UNCONVERTIBLE_BLOCK` (or `EMPTY_BODY` when the accepted page was emptied: an empty body is never imported). Not accepted: `wording_held`. Either way nothing is imported and render must not overwrite the body (**fail closed**: when N is unknown, the page is treated as holding a draft) |
| 3 | `accepted` true and `accepted_at` null | `wording_waiting` `ACCEPTANCE_UNDATED`: the order of click and edits is unknown, so nothing is imported; **Accepted is not cleared** and the body is preserved; the user clicks Accept again (which sets the time) |
| 4 | `accepted` false, `pending_revision` or `pending_refresh` | `wording_waiting` `REVISION_PENDING`/`REFRESH_PENDING`; nothing imported |
| 5 | `accepted` true and a pending proposal | `wording_waiting` with that reason: **an unresolved proposal blocks acceptance** (0054) |
| 6 | `accepted` true, edited after acceptance in a later minute than the click (a deleted block is not detected, decision 0062) | `wording_waiting` `EDITED_AFTER_ACCEPTANCE`: an edit invalidates the acceptance; the user clicks Accept again. (An edit inside the click's own minute is the known limit of decision 0058.) **Accepted is not cleared** |
| 7 | `accepted` true, a report whose `markdown` does not have the six `##` sections of §16.4 in order, or links that do not resolve to notes (a Notion mention `notion-page:<id>` resolves to the note whose `notion` is that page; `generated_from` is recomputed from the new links at apply, mentions included; one that names no published note, or whose target after `notion-page:` is not a page id, does not resolve) | `wording_waiting` `INVALID_REPORT_SHAPE`; Accepted is not cleared |
| 8 | N = G (Notion equals Git). For an accepted row this is reached only if rows 2, 3, 5, 6 and 7 did not apply: **every validation of an acceptance comes before any shortcut that consumes it** | already in step: `updates` sets SN = N and SG = G. If `accepted`, the skill then clears Accepted (below) |
| 9 | SN or SG missing (`notion_published` lacks `@notion_body` or `@git_body`: never published, published before 0.8.0, or a baseline lost) and N ≠ G | no common baseline, so no comparison is made. Not accepted: `wording_held`. Accepted: `wording_waiting` `NO_BASELINE`. Either way nothing is imported, **Accepted and the Notion body are preserved**, render must not overwrite the body (a page that is not accepted still gets its properties, `sync render --plan` below), and the skill (attended) shows Notion's text and Git's as a full diff and asks which is right; unattended leaves it |
| 10 | `accepted` false, N = SN | nothing: Notion has not changed since the last sync |
| 11 | `accepted` false, N ≠ SN | `wording_held`: an unaccepted draft; nothing imported, render must not overwrite it |
| 12 | `accepted` true, N = SN (G = SG or not) | Notion is unchanged since it last matched, so there is nothing to import. If Git alone changed (for example an approved Related knowledge appendix) that is **not a conflict**. The row goes to `clear_accepted` |
| 13 | `accepted` true, N ≠ SN, G = SG | Notion changed, Git did not: `accepted_wording` |
| 14 | `accepted` true, N ≠ SN, G ≠ SG, N ≠ G | both changed: `wording_waiting` `GIT_CHANGED`; the skill shows both as a full diff and asks (attended), or leaves it (unattended) |

An acceptance is therefore honored only when it is explicit (`accepted`, with its time), current (the page was not edited in a minute after the click's, decision 0058), unambiguous (no pending proposal), valid (it converts, and a report keeps its shape) and not in conflict with Git.

**Verify before render and before refresh (decision 0062).** A deletion does not move the page edit time (T4), so the time-filtered snapshot can miss a draft that only lost text. The guard therefore reads the page itself and compares by hash, **twice**: (a) a queued **refresh** runs it **before it changes the Git report**, and (b) every **render** runs it immediately before it writes a body into Notion. It passes only when all of these hold; otherwise it writes nothing and the row is held (`UNACCEPTED_DRAFT`, or `NO_BASELINE` when no baseline exists), failing closed:
- the page was read and converted (an unreadable page or an `UNCONVERTIBLE_BLOCK` holds it);
- a baseline `@notion_body` exists in `notion_published` (a missing baseline holds it, row 9);
- the hash N of `body_markdown` equals that baseline (an edit or a deletion in the body holds it);
- `accepted` is not ticked and `pending_revision` and `pending_refresh` are both false (an Accepted row belongs to the `accepted_wording` path, and a Proposed block, which N excludes, must not be overwritten, including one added after the snapshot).
Only the rows about to be refreshed or rendered are read. The read and the Notion write (or the Git report change) are separate calls, so the guard is **not atomic**: an edit made between them can still be overwritten. This is a stated limitation of this contract, accepted by the user on 2026-11-02 (decision 0062); the guard makes no stronger claim. This is what protects a draft that only lost text, since the comparison is by hash and not by time.

**Binding to the exact text (decision 0058).** The click cannot capture the text, so the text bound to an acceptance is the page text **as read by the first run that sees it**. Two limits follow and no rule here detects them: an edit made in the click's own minute and before that first read, and (decision 0062) a **deletion** made after the click and before that first read. The contract does not pretend otherwise. What it does: **attended**, the skill shows the user, for each `accepted_wording` item, **the full text that will replace the Git body as a unified diff against the Git body with the whole file as context (or the complete replacement text beside it), so no section is hidden** (not only counts) and imports it only after the user says yes; a no leaves it accepted and unchanged, listed as skipped. **Unattended**, 0058 authorizes importing an acceptance whose page text, as first read, shows no edit in a later minute than the click (the 2-minute `unattended_ok` age only ensures the click's minute is over and Notion has caught up). The page re-read just before apply still catches any change after the first read. The unattended report names both limits above, and lists each imported Document so the user can look.

**Verify before apply.** `sync apply` cannot read Notion, so the skill, immediately before it executes the `accepted_wording` items, **re-reads each page** (Accepted, Accepted at, page edit time, pending blocks, body) and recomputes N. If anything differs from the plan (the user edited, unticked Accepted or added a proposal since the snapshot), the skill drops that item and names it under Needs you as `CHANGED_SINCE_PLAN`. It passes the surviving items to `sync apply` with `verified: { "fingerprint": "<N>", "page_edited_at": "…" }`. `sync apply` fails an `accepted_wording` item with `UNVERIFIED` when `verified` is missing, its `fingerprint` differs from the item's, or its `page_edited_at` differs from the item's (the page changed since the plan), and with `NOTION_ID_MISMATCH` when the note is published as another page than the item's `page_id`. This holds for unattended runs too.

**`sync apply`.** After step 3 and `decisions`, step 4 executes each verified `accepted_wording` item: the target's body becomes `markdown` **exactly** (byte for byte; a report's `generated_from` is recomputed from its links; for a Document `notion:<page_id>` is added to `sources` if missing (a report is a view, which declares no `sources`; its `notion` names the page); `updated` becomes today; no other field changes), `notion_published` gets `@notion_body` = `fingerprint`, `@git_body` = the hash of the new body, and `@content` = what `render` would compute for it (so the imported text is not sent back), and the log gets `sync-wording`. Preconditions are re-checked: if G is no longer `base` (SG), the item is `failed` `GIT_CHANGED` and nothing is written. The result is `applied`, `changed: ["body"]`. A `--record-only` run skips these items and reports them (0003). `--skip-conflicted` skips an item whose note is named by a conflict, and drops that row's `clear_accepted` entry, so nothing is unticked in Notion on a row skipped whole. A `clear_accepted` entry is also dropped when the note is gone or an `updates` item for that note failed: row 8 clears Accepted only after its baselines were recorded. An `accepted_wording` item must carry every field of the plan item and a `kind` that matches its note (a `report` item for a report, a `document` item for a promoted Document), else the item fails `KIND_MISMATCH` or the input is `INPUT_INVALID`. `data` gains `accepted_wording` (each item with `result` `applied`, `skipped` or `failed` and `changed`), and echoes `wording_waiting`, `wording_held` and `clear_accepted` for the skill. **After a successful import or an already-in-step or Git-only row (rows 8 and 12 with `accepted`), the skill unticks Accepted and clears Accepted at** through the MCP (the same pattern as the other request boxes, 0048): the acceptance was consumed, and a later edit of the body is an ordinary draft (row 11, or row 9 when S is missing), not a stale acceptance. Unattended runs (0051) execute verified `accepted_wording` as-is, since the plan holds only explicit, exact, current acceptance; every `wording_waiting` row is named in the report and left alone.

**`sync render --plan <plan>`.** The skill passes the same run's plan:
- a note named by any of `wording_waiting`, `wording_held` or `accepted_wording` is listed in `skipped` with reason `WORDING_PENDING`, which means **its body is held**: a publish never overwrites a pending draft, an unaccepted edit, a proposed revision or a proposed refresh (0054), nor sends a stale Git body over accepted wording that is not imported yet;
- **only the text waits** when every row naming the note is a `wording_waiting` or `wording_held` row with `accepted: false` (#221: a report moved by migration 0019 with no baseline, row 9, still needs its Origin, Project, Area and Asked in). Its `update` item stays in `items` with `body` and `sections` `null`, without `Refresh asked` (a queued refresh waits, below), and without `@content` and `@git_body` in `published`, so `sync record` keeps the body baselines as they were and the body is rendered once the hold is resolved. If nothing but Last Synced is left to write, no item is rendered (a relation still pending is sent by a later render, once its page exists). The skill writes the properties only: no body, so no read-back and no `@notion_body`;
- **the whole item is left out of `items`** (listed in `skipped` the same way) when the note is named by an `accepted_wording` item or by a row whose `accepted` is not `false` (accepted, or missing, as on a row the skill moved there, which fails closed), and when its item is a `create`. Any write to a page moves its edit time, and an Accepted page edited after its Accept time reads as a stale acceptance (row 6), so no write of any kind touches an accepted page until its wording is settled;
- a `promoted` Document's body is still sent on `create` only (§5.14.4); a report's body on `update` is sent only when B of `@content` ≠ S **and** no row above names it (a report with no baseline yet is row 9: held until the user adopts one);
- **Refresh report** (the button) never ticks *Refresh asked*; `refresh_requests` (the old queued full refresh) come only from that checkbox. The button therefore cannot set off a full refresh that would overwrite pending or accepted wording. **One rule for a queued full refresh:** if a `refresh_requests` item (or a refresh due by §6.1) and a `wording_waiting`, `wording_held` or `accepted_wording` row name the same report, **the refresh itself waits**: the skill does not run it, Refresh asked **stays ticked**, and the run names it ("Report X: resolve the Notion text first"). It runs at the first catch-up where no such row names the report. This holds attended and unattended.

**Related knowledge appendix (Documents).** After an `accepted_wording` import into a Document, the skill may search canonical knowledge and propose useful additions. This is an ordinary proposal (0003): `brain proposal new --kind add_to_note --target <ref-…>` with `content` = a `## Related knowledge` section, one list item per note, each `[title](path)` with the reason it helps, and `why` naming the Document. Approving it appends the section after the accepted wording by the `add_to_note` rule (schema §11.2), which leaves the accepted text unchanged; rejecting it changes nothing. The Document keeps being a note whose accepted body is Git's (schema §3, promoted bodies). A change to any other existing note is a separate proposal.

**Reports are derived outputs and not proposal targets (§11 refuses a view target; decision 0057).** A report's accepted text never becomes evidence for a new note. For useful knowledge that only Git has (not in the accepted refresh), the skill **names it to the user** in its report ("Not in the accepted refresh: …") and offers a full refresh; it makes no proposal on the report. A full refresh (Refresh asked, §5.18) rewrites the report in Git as before, but only when no `wording_waiting`, `wording_held` or `accepted_wording` row names that report (the rule above): then it waits, with Refresh asked still ticked. The user resolves the Notion text by accepting or discarding it, and the next run refreshes.

**Errors:** none new; `INPUT_INVALID` for a snapshot row whose `accepted_at` or `page_edited_at` is not an ISO time, or for an `accepted_wording` item without `verified` fields in `sync apply` input (`UNVERIFIED` per item). A null `accepted_at` is valid input: with `accepted` true it is row 3, not an error.

#### 5.14.8 Review rows, read once (`sync plan --review-transition`, the 0.16.0 migration only)

*Transition (decision 0096, capture-and-review §7.9).* From 0.16.0 there is no Review database: proposals are decided in the session (capture-and-review §7), and plain `sync plan` ignores a Review row (`ignored`, `REVIEW_ROW`, §5.14.2). The 0.16.0 Notion migration reads the Review rows **once**, attended, before it archives the database, with `brain sync plan --review-transition`. Under that option alone the rules below hold, as they were in 0.15.x (every capture-and-review §7 reference below names `spec/capture-and-review.md` at tag `v0.15.1`, written `capture-and-review (v0.15.1) §7.x` and read with `git show v0.15.1:spec/capture-and-review.md`; render publishes no Review row since 0.16.0, so `review_pending` and `review_untouched` are reported and nothing acts on them): they produce `decisions` and the `review_*` fields, which `sync apply` applies by the last paragraph below. What capture-and-review §7.9 says the migration does with each kind of row (a requested revision is asked in the session, never redrafted) is the skill's on top of this plan. `--review-transition` on a brain whose `brain.json` has no `notion.databases.review` refuses with `REVIEW_RETIRED`: the migration removed the key (`brain config unset notion.databases.review`, §5.3), so the rows are never read again. An unattended run never uses the option. References below to capture-and-review §7.x name that file's 0.15.x text, which is kept in Git history; its retired fields and codes are listed in capture-and-review §7.10.

**In `sync plan`:**

- **Review rows** with **Your call** set and `State` = `Pending` (0045; a snapshot taken before migration 0009 has `Decision` and `Note` instead, read the same way, and the option **Edit** is read as **Fix**, so decisions made before the migration are never lost. Only reading is compatible: render sends the 0.5.0 names, see §5.14.4). The snapshot properties are `Your call` (select) and `What to fix` (text). A proposal already terminal is checked first (below), so a row whose What to fix the skill has handled never comes back:
  - **Approve** or **Reject** with an empty What to fix → a `decisions` item for `brain apply`: `action`, `decided_at` = `last_edited`, `decided_by: notion`.
  - **Approve** or **Reject** with What to fix → conflict `NOTE_TO_READ` on `What to fix`, with `notion_value` = the text and `brain_value` = the label. No decision item: the skill reads the text and passes `brain apply` the decision it means (with `note`, and `exclude` for "all except …"), or asks the user.
  - **Fix** with What to fix → conflict `FIX_TO_READ` on `What to fix`, the same way: the skill reads the text and passes `brain apply` an `action: fix` decision with `note` and `fixes` (schema §11.3), naming items by the row's letters (§5.14.4). The plan never guesses what the text means.
  - **Fix** with an empty What to fix → conflict `FIX_WITHOUT_TEXT`.
  - A proposal already terminal → `ignored`, `ALREADY_TERMINAL`.

**Review rows of the new layout (0055, capture-and-review (v0.15.1) §7.3).** A Review row of a proposal that has `items` and a recorded `published["@review"]` (the page was rendered with item sections) may carry a `review` object: `{ "decided": <Decided ticked>, "decided_at": <Decided at, or null>, "accept_all": <Accept all ticked>, "page_edited_at": "…", "body_markdown": "<the page as Markdown, cli §5.14.7 rules>" | null }`, with a block the skill could not convert replaced by the line `<!-- unconvertible block -->`. A row published before the item sections (no `@review`) is read by the 0045 rules, `What to fix` included. For the new layout `sync plan` adds:
- `review_decisions`: `[{ proposal, page_id, decided_at, decided_by: "notion", page_edited_at, unattended_ok, accept_all, items: [{ item_id, decision: accept·reject·defer, proposed, proposed_hash, rendered_proposed_hash, base_hash, snapshot_hash, edited }] }]`. `proposed` is the exact final wording for an `accept` (the Proposed toggle as read: unescaped, canonical), null otherwise; `proposed_hash` is its sha256 hex, `rendered_proposed_hash` the one recorded at render, `edited` their difference; `base_hash` is what the target holds now; `snapshot_hash` is the sha256 of the item's section as read. `unattended_ok` is true when `decided_at` is at least 2 minutes before `as_of`.
- `review_held`: `[{ proposal, page_id, item_id | null, reason }]`, items or rows that were not applied: `DECIDED_WITHOUT_TIME`, `BODY_UNREADABLE`, `EDITED_AFTER_DECIDED` (the page was edited in a later minute than Decided at: the row is held whole, the user submits again), `MISSING_SECTION` (never an implicit decision), `DUPLICATE_SECTION`, `UNREADABLE_DECISION` (the token is not Pending, Accept, Reject, Defer or Request revision, or the section has two `Decision:` lines, or two `Revision request:` lines), `REVISION_PENDING` (a Pending item with a typed `Revision request:` line is not decided by Accept all or a row-level call; it waits), `UNREADABLE_PROPOSED` (the toggle is missing, empty, or holds an unconvertible block: empty wording is never an accept or a deletion), `HELD_SOURCE_EXCLUDED` (the item rests on excluded text and cannot be accepted), `NO_BASELINE` and `BASE_CHANGED` (the target is not what the item was proposed against; Reject and Defer are still read).
- `review_revisions`: `[{ proposal, page_id, item_id, instruction }]`, items marked Request revision with the text of the `Revision request:` line. The attended skill drafts the new wording; an unattended run never reads `instruction` and applies nothing for them.
- `review_pending`: rows whose page holds an edited Proposed, a token other than Pending, an unreadable token or a requested revision, or whose Decided is ticked; `sync render --plan` withholds them (§5.14.4).
An item that `item_decisions` already records is never decided again, and its section may be missing. Nothing is read until `decided` is true. Without it only the row-level shortcut is read: a `Your call` of Approve or Reject is a `decisions` item (the 0045 apply, each item's stored proposal text), refused as the conflict `EDITED_PROPOSED_NEEDS_SUBMIT` when any Proposed was edited; Fix or Request revision is the conflict `ROW_REVISION_NOT_SUPPORTED`. `Submit and accept all` (`accept_all`) reads every item still on Pending as Accept, and with `decided` true a row-level Approve or Reject decides the items still on Pending the same way (Accept or Reject); an explicit token wins. Precedence: an item's explicit token (after Submit) > the row-level call > the legacy What to fix (old-layout rows only).

**Review rows of format 2 (0.15.0; capture-and-review (v0.15.1) §7.12, decisions 0088 §2 and 0090).** A row whose `@review` has `format: 2` is read by capture-and-review (v0.15.1) §7.12.6 and decided by its `Your call` (capture-and-review (v0.15.1) §7.12.7); `decided`, `decided_at` and `accept_all` are not read, and `EDITED_PROPOSED_NEEDS_SUBMIT` and `ROW_REVISION_NOT_SUPPORTED` are not raised for it. The `review` object is the same; `review_pending` lists the row when its page holds an edited wording, a token other than Pending, an unreadable item or a requested revision, or when Your call is set.
- **Approve** or **Reject** → one `review_decisions` entry with `call: "approve"` or `"reject"`, `decided_at` = `last_edited`, `accept_all: false`, and its items read by capture-and-review (v0.15.1) §7.12.7: an explicit token is the decision; a Pending item is Accept under Approve (except below) and Reject under Reject. An entry is emitted even when no item is decided, with `items: []`, so the call is consumed and cleared (§5.14.3).
- **Each item** carries, besides the fields above, `agreed` (the `Agreed in review:` lines, joined by a newline; omitted when none) and, for an accepted grouped link item, `values` (the indexes into `links` still in its wording). `proposed` is the wording read (labels expanded, `Agreed in review:` lines left out); a fact's value is `proposed` without its markers.
- **`review_held` reasons added:** `NEEDS_EXPLICIT_ACCEPT` (a ⚠ fact change or a flagged item left Pending under Approve), `UNKNOWN_MARKER` (a `[¶n]` label the page doesn't list), `LINK_VALUE_UNKNOWN` (a link item's line names none of its values), `VALUE_NOT_IN_PASSAGE` (an accepted fact whose value is in none of its cited passages); an entry may carry `detail`, a short text for the report (`¶4 says 9`). A held item stays Pending.
- **Request revision** with What to fix → `review_row_revisions`: `[{ proposal, page_id, instruction }]`, and nothing else of the row is read. With an empty What to fix → conflict `REVISION_WITHOUT_TEXT` on `What to fix`. The attended skill maps the text to items and adds one `review_revisions` entry per item to the plan before `sync apply` (`instruction` = the part of the text for that item); an unattended run adds none, so nothing is recorded and the row is left as it is (0051).
- **Rows to rebuild (0088 Q8):** `review_untouched`: `[{ proposal, page_id }]`, the format-1 rows of a pending proposal whose page was read and nobody touched (capture-and-review (v0.15.1) §7.12.1: every item's section once, all `Decision: Pending`, no edited Proposed, no `Revision request:` text, Decided unticked, Your call empty, no `item_decisions` and no `revisions`). `sync render --plan` rebuilds them (§5.14.4).

**In `sync apply`:**

**Review decisions of the new layout (0055, capture-and-review (v0.15.1) §7.5 to §7.7).** After the 0045 `decisions` and before accepted wording, `sync apply` applies each `review_decisions` item on its own (atomic per item; a failure or a result that adds lint errors restores that item alone). The skill re-reads the page just before applying and sets `verified` `{ snapshot_hash, proposed_hash }` on every item (§5.14.2); an item whose `verified` is missing (`UNVERIFIED`) or differs from the planned hashes (`CHANGED_SINCE_PLAN`) is refused. Further checks, each a `skipped` item with its `reason`: the proposal is a pending `review_notes` with `items` (`ALREADY_TERMINAL`, `NOT_A_REVIEW_WITH_ITEMS`), the item exists (`UNKNOWN_ITEM`) and is not in `item_decisions` yet (`ALREADY_DECIDED`: applying again is a no-op), and for an accept: the item is not held (`HELD_SOURCE_EXCLUDED`), the `base_hash` recorded at render, the planned one and what the target holds now are the same (`NO_BASELINE`, `BASE_CHANGED`), and the wording is not blank (`UNREADABLE_PROPOSED`) and is bound to its hashes (`WORDING_NOT_BOUND`: the sha256 of `proposed` must equal `proposed_hash` and `verified.proposed_hash`, so a plan cannot carry wording other than what was hashed and verified; `sync apply` rejects a plan whose review items lack well-formed hashes or `verified`). Whether the wording was edited is read from `proposed_hash` against the hash recorded at render, never from a flag in the plan. The base of every item is read **once at the start of a submission**, so two accepted items on one note both apply. **Accept:** a creation makes the draft `reviewed` (a draft already `reviewed` is only recorded; any other state is `NOT_A_DRAFT` and records nothing) and, when the wording was edited, writes it as the draft's body; `update_fact` applies the wording as the new value, `update_body` and `add_to_note` as the new text, `add_link` adds the value (an edited link value must be a note id or the exact title of one note, else `LINK_VALUE_UNKNOWN`). **An edited fact value is attributed to the user** (capture-and-review (v0.15.1) §7.7): `facts.<field>` becomes the user's value, the timeline keeps the source's value as a `superseded` entry with the source's own `source`, and adds the user's value as `accepted` with `source: user-correction:<proposal id>`. An unedited accept applies the proposal's own text, not the normalised copy read from the page. **Reject:** a draft is archived, a change or link is not applied. **Defer:** the deferred items of one decision move together to one new pending proposal under their own ids; creating it and recording the entries (`state: deferred`, `deferred_to`) are one unit, and if it fails (`DEFER_FAILED`) the items stay pending. A note can be deferred again from the proposal it was deferred to: lint follows the chain. Each item is recorded in `item_decisions` (`{ item_id, decision, decided_at, decided_by, proposed_hash, base_hash, snapshot_hash, state, edited? }`) in the same write as its effect; when no item is pending the proposal becomes `applied` (some item applied) or `closed` (none), with `decision` `approve` or `reject`. `data.review_results` lists `{ proposal, item_id, decision, result: applied·closed·deferred·skipped·failed, reason?, deferred_to? }`. With `--record-only` they are all skipped (`RECORD_ONLY`). **Format 2 (capture-and-review (v0.15.1) §7.12):** an item's `agreed` is stored in its `item_decisions` entry; an accepted grouped link item adds the links of `values` only (all of them when `values` is absent) and records `values` when some were left out; an accepted fact's value is its `proposed` without its markers, with `[¶n]` labels never stored; Reject, Defer and the checks are the same. `data.review_clear` lists `{ proposal, page_id, properties: ["Your call", "What to fix"] }` for every format-2 entry with a `call` that the run consumed (applied or held, whatever its items' results; not with `--record-only`; with `--dry-run` it lists what the run would clear, and the skill clears nothing) and for every format-2 row whose `review_revisions` were all recorded; the skill empties those properties once the summary and any section writes are done (capture-and-review (v0.15.1) §7.4's guard). A `review_row_revisions` entry is never executed by `sync apply`: it changes nothing and is not named in `review_clear`. **Excluded evidence (capture-and-review §5.1, eligibility.md §4.2, §9):** an item that rests on excluded evidence or whose support can't be established, by §5.7's rule (one of its `passages` is not live; it has none and the input of the proposal's `source` has a suppression record, or the proposal's `source` is an older version or full copy of a changed input; the draft it creates has a restricted line, or is restricted whole; or the wording of its `update_body` or `add_to_note` cites a passage that is not live, even beside a live one) is never applied, even on an Accept, and never in part: `sync plan` emits it with `decision: stale`, and `sync apply` re-checks it (so an Accept in a hand-made plan is caught too) and closes it: the draft is archived as for a Reject, the entry is `{ decision: reject, state: closed, reason: source_excluded }` and the result is `closed` with `reason: source_excluded`. If the item no longer rests on excluded evidence a `stale` item is skipped (`NOT_EXCLUDED`). The check is made again with the suppression records as `sync apply` reads them, so an exclusion made after the render or the plan is caught. An Accept given to a withheld item does not carry over to a later item proposed from its live passages: that is a new pending item (§5.7, "Re-proposing"). An item held only because the note it **changes** is partly restricted (its Current can't be shown, while its own wording rests on live evidence) does not rest on excluded evidence: it is still held (`HELD_SOURCE_EXCLUDED`) and waits until that note is resolved. **One journaled operation (capture-and-review (v0.15.1) §7.11):** when a Review decision changed anything and the run is not `--dry-run`, `sync apply` writes the journal (§5.24) before any file, flushes the whole plan's files and the log, commits to Git with the trailer `Op: <op-id>` and removes the journal; the tree must be clean first (`DIRTY_TREE` before anything is written), so the skill commits its own earlier work before `sync apply`. A Git failure rolls the files back at once; a crash leaves the journal for `brain recover`. `data.op` names the operation. A plan with no Review decision, or whose decisions changed nothing, keeps the plain write and leaves the commit to the skill.

**Request revision is recorded by `sync apply`:** each `review_revisions` entry of the plan with an instruction becomes `revisions: [{ item_id, instruction, requested_at, status: requested }]` on the proposal (`data.revision_results`: `recorded`, or `skipped` with `UNKNOWN_ITEM`, `NO_INSTRUCTION`, `ALREADY_DECIDED`, `ALREADY_REQUESTED`, `REVISION_NOT_SUPPORTED` for a cleanup item or a link item of more than one value, `STALE_PLAN`); the item stays pending. As for a decision, applying a plan again is a no-op: a request equal to the one recorded and still `requested` is `ALREADY_REQUESTED`, and when the item's revision is `drafted`, an entry from a plan whose `as_of` is not later than its `drafted_at` (or when it has none) is `STALE_PLAN` (the plan read the page before the new draft, so it cannot be asking about it; CC-218) and leaves the revision `drafted` with its `previous`. A request read from the page after the draft is recorded as before and the write is part of the journaled operation (§5.14.3). An **unattended run never reads revision text** (0051): the skill does not put `review_revisions` into the plan it applies. In the migration's session the skill asks the item's question with the instruction shown, and never redrafts it (capture-and-review §7.9).

#### 5.14.9 Question Status, read once (`sync plan --questions-transition`, the 0.16.0 migration only)

*Transition (decision 0099 §8).* From 0.16.0 decisions and questions have no Notion database (schema §4), and plain `sync plan` ignores a row of either (`ignored`, `RETIRED_DATABASE`, §5.14.2). Up to 0.15.x, the Status you set on a Questions row (Answered, Dropped) was yours and lived only in `notion_fields.status`, which is retired. So the 0.16.0 Notion migration, in an attended session, after the Review transition (§5.14.8), runs these steps in order:
1. **One read.** The skill snapshots every Questions row that has a Brain ID, with `Status` and `Brain ID` only, and runs `brain sync plan --questions-transition`.
2. **`sync apply`** of that plan records each Status you set in Git (below), then `index`, `views`, `lint` and a commit.
3. **Archive** the Decisions and Questions databases (nothing is deleted: their pages stay in Archive), remove their views, relations and toggles, and add Kind (Task, Question, Risk) and the Questions and Risks tabs to the default Tasks database (docs/notion-space-design.md §3.12, §5). On a Tasks database you mapped yourself, it offers Kind as the connect step does (setup.md §6.2.1).
4. **`brain.json`:** remove `notion.databases.decisions` and `notion.databases.questions` (`brain config unset`, §5.3: rerun after a partial failure, it succeeds and changes nothing), and set `notion.tasks.properties.kind` to the Kind property's name when the database has it now (`brain config set`). A `modules.knowledge` key is `brain upgrade`'s to remove (§5.15 step 5).
5. **The tidy** (capture-and-review §6.2) is offered once, so each open question you follow up becomes a task.

After step 4, `--questions-transition` refuses with `QUESTIONS_RETIRED`, as it does on a brain that never had a Questions database. An unattended run never uses the option, and a run that stops before step 4 is resumed by running the migration again: step 2 never records a question twice (below).

**In `sync plan --questions-transition`:** the snapshot holds `questions` rows only (any other `database` → `INPUT_INVALID`). For each row:
- a Brain ID naming no note → conflict `UNKNOWN_BRAIN_ID`; one naming a note that isn't a question → `ignored`, `NOT_A_QUESTION`; an empty Brain ID → `ignored`, `NOT_CREATED_IN_NOTION`;
- a question that already has an `answer` or `dropped` → nothing: Git already says more than the Status did;
- Status `Answered` → a `question_status` item `{ "note": "que-…", "page_id": "…", "status": "answered", "at": "<YYYY-MM-DD of last_edited>" }`;
- Status `Dropped` → the same item with `"status": "dropped"`;
- Status `Open`, empty or any other value → nothing: the question stays open.

The plan has `question_status`, `conflicts` and `ignored` (sorted by `page_id`), and no other item: nothing else of the row is compared, and no correction is read.

**In `sync apply`,** each `question_status` item, after every other item, atomic per item:
- `answered`: the question's `answer` = `Marked Answered in Notion on <at>; the answer was not recorded.` (schema §4: an `answer` closes the question; the Status says that it was answered, not what the answer was);
- `dropped`: `dropped` = `at` and `lifecycle: archived`, as `question drop` writes it (§5.30), for a risk too;
- `updated` = today; logs `sync-question <id> "<title>" status=answered|dropped`. Result `applied`, or `skipped` with `ALREADY_CLOSED` when the question has an `answer` or `dropped` by then (a second run), or `failed` with `UNKNOWN_ID`.

`data.question_status` lists the results. `notion_fields.status` is left as it is in every note, as history (schema §4).

**Retired with the two databases (0099).** What a brain kept for them, and what takes its place:

| Retired | Replaced by |
|---|---|
| The Decisions and Questions databases, their rows and pages; the Knowledge module and `modules.knowledge` | the notes in Git, shown in the project's or area's Brief and Decision log (schema §16) and in reports; `brain upgrade` removes `modules.knowledge` (§5.15), and `brain modules` refuses it with `USAGE` (§5.20) |
| `brain.json` `notion.databases.decisions` and `notion.databases.questions` | removed by step 4 above; a row of either is `ignored`, `RETIRED_DATABASE` (§5.14.2) |
| The rendered rows of §5.14.4 for decisions and questions, the publish of a decision or question page, and `--unpublish-drafts` for them | nothing: no page; `--ids` naming one → `skipped`, `NO_DATABASE` (§5.14.4) |
| Questions · Status, the question's `notion_fields.status`, and the publish of Answered and Dropped | `answer` and `dropped` in Git (schema §4), read once from Notion by this transition; a tracked question's task set Done (capture-and-review §6.4); `notion_fields.status` stays as history |
| Questions · Kind | the note's `kind`, and on a tracked question's task, Tasks · Kind (schema §12 `kind`) |
| The decision and question properties Date, Assessment, Project, Area, Decided In, Supersedes, Raised In, Lifecycle | nothing in Notion; the notes' own fields in Git |
| Promote and Promote asked on Decisions; `promote_requests` and its `ignored` reasons (`MODULE_OFF`, `NOT_REVIEWED` with `property: "Promote asked"`) | Promote to document asked in the agent session (§5.5) |
| Documents · From decision and Decisions · Documents | `promoted_from` in Git (schema §4 reference) |
| The Decisions and Questions relations on Areas, Projects, Meetings and Inbox (Produced) | nothing: a meeting's decisions and questions show on its project's Brief and Decision log |
| `NOT_CREATED_IN_NOTION` on a Decisions or Questions row | `RETIRED_DATABASE`; this transition keeps it for a Questions row with no Brain ID |
| The Brief's `## Open questions` | `## Open questions and risks` (schema §16.1, §16.3) |
| A connected workflow's decision page | its destination's Decision log or Brief (connected-workflows.md §6.3) |

#### 5.14.10 `brain sync snapshot` (0.16.2, CC-269)

```text
brain sync snapshot --input <file|dir> [--input <file|dir> …] --output <snapshot.json> [--json]
```

Writes the snapshot of §5.14.1 from the Notion replies the skill saved, so the agent never copies a row by hand. It reads the brain's `brain.json` and the input files, writes only `--output` (replaced when it exists), and changes nothing in the brain. `--input` is repeated, one per file; a directory stands for every `.json` file directly in it, in name order. `as_of` is `--now`.

**Input files.** Each file is one of two shapes, told apart as below; any other JSON → `INPUT_INVALID` naming the file:
- **A query reply:** an object with `"object": "list"` and a `results` list: one page of a Notion data source query, saved as the MCP returned it, each result an object with `"object": "page"`. The skill saves every page of every query (each `next_cursor` page its own file).
- **Rows:** an object whose only key is `rows`, a list of rows in exactly §5.14.1's row format (no other key, no new field), checked as `sync plan` checks them. These are the rows that are no query reply: the tracked tasks read by page id (`status_group` is not in a page's reply) and a Documents or Report row carrying its `wording` object.

**The database of a row** is its page's `parent.database_id` (compared without dashes, in lower case) matched against `notion.databases` and `notion.tasks.database` (key `tasks`). A page whose database is not configured, or whose key is not a snapshot database (§5.14.1: `meetings`, `capture_inbox`) → `INPUT_INVALID`. A `references` key is written as `documents` (0049). A database whose saved replies all have `has_more: true` → `INPUT_INVALID` (`INCOMPLETE_READ` in the message): its last page wasn't saved, and a database read in part is never sent as read (U-18). The CLI can't see the cursor chain, so following `next_cursor` to the end stays the skill's job. A result in the trash (`in_trash` or `archived` true) is left out.

**Each page becomes a row** `{ database, page_id, last_edited, properties }` (`page_id` = `id`, `last_edited` = `last_edited_time`), with these rules, which are the skill's (§5.14.1):
- **Example rows (0084):** a page whose title (its property of type `title`) starts with `Example · ` is left out and counted in `examples_left_out`, for the report.
- **Inbox:** a row with an empty Brain ID is left out. A Report row (Brain ID `vw-`, a space before migration 0019) asking for something is passed as under Report rows below. A row whose Document asked is ticked has `Brain ID`, `Document asked` and `Only keep`; every other row has `Brain ID` only.
- **Documents:** a Report row (Brain ID `vw-`) is passed only when its Refresh asked (or Refresh) is ticked or its What to fix isn't empty, with `Brain ID`, `Refresh asked` (or `Refresh`, whichever the page has) and `What to fix`. Every other row has every property.
- **Tasks:** with `notion.tasks.properties.document_asked` mapped, a row whose Document asked is ticked has the mapped title, Document asked, Project and Area properties (an unmapped one is left out). From 0.18.0 a row whose mapped Area is empty and whose mapped Project (or, with the Factories module on, Factory) isn't has the mapped title, Status, Area, Project and Factory, a row of both kinds the properties of both, and a Factory is kept only with that module on. Every other Tasks result is left out.
- **Every other database:** every property.

**Property values** are §5.14.1's normalized values: title and text are their segments' `plain_text` joined (empty → `null`); select and status their option's name or `null`; url and email the string or `null` (empty → `null`); number; checkbox; date `{start, end}` (`end` `null` when absent) or `null`; relation its page ids, sorted. A formula is its result by its type (a date result as a date). A rollup is its number or date; an `array` rollup whose items are all relations is a relation (their page ids, sorted, without repeats; an empty one → `[]`); any other array rollup is left out. A relation with `has_more: true` (Notion returned only part of it) is left out, with a warning `{ "code": "RELATION_TRUNCATED", "message": "…" }` naming the page and property: a property left out is not compared. Every other property type (people, files, multi-select, phone, created and edited times and people, buttons, unique ids, verification) is left out.

A page in two replies is passed once: the reply with the later `last_edited`, and with the same one, the two must give the same row (otherwise `INPUT_INVALID`).

**Joining the rows files.** A row of a rows file whose page has no row from a query reply is passed as it is. One whose page has a row from a query reply joins it only in these two cases:
- a `tasks` row (a tracked task) joins that page's Tasks row (its Document asked or its empty Area read): `properties` are joined, `status_group` and `gone` added;
- a `documents` or `inbox` row with a `wording` object joins that page's row: its `wording` is added and `properties` are joined.

In both, a property in both rows must have the same value; `last_edited` is the later of the two. A different value for the same property, a different `database` for the same page, an `unreadable` row joining a read one, a page twice in the rows files, or any other row whose page also came from a query reply → `INPUT_INVALID`: nothing is overridden in silence.

**Output.** `snapshot.json` is `{ "as_of": "<--now>", "rows": [...] }`, rows sorted by `database` then `page_id`; `sync plan` takes it as it is. The reply:

```json
{ "ok": true, "command": "sync snapshot", "warnings": [],
  "data": { "output": "/tmp/run/snapshot.json", "rows": 42, "examples_left_out": 2, "databases": { "areas": 5, "inbox": 12, "people": 25 } } }
```

`databases` counts the rows written per database. Nothing is written on an error.

### 5.15 `brain upgrade`

```text
brain upgrade [--dry-run]
```

Brings the product-owned files of an existing brain up to the installed version of the package (dogfood finding 22), then commits and pushes them (0038). Since 0.16.1 (0103) it proceeds around the user's uncommitted work that it doesn't conflict with, and commits only its own files (**Uncommitted work**, below). It never touches notes, generated files, anything the user wrote, or the log beyond appending its own `upgrade` line (step 6), and changes `brain.json` only to rename or remove a retired key and to write the `modules` block (step 5), and `.gitignore` only to add a line (step 1c). The one exception is step 5a: it converts concept notes into learned Documents (0071), rewrites the links to them and rebuilds `index.md`.

**The installed package** (also used by lint rule `product-file`, §5.10) is the one the running CLI belongs to, never one found on `PATH` or in the brain:
- **Root:** start from the real path (symbolic links resolved) of the running entry module and walk up to the first folder holding a `package.json` whose `name` is `ultimate-brain`. This is the same for a global install, `npx`, the compiled `dist/` entry and a source checkout.
- **Version:** that `package.json`'s `version`.
- **Shipped files:** the skills are the **package snapshot** at `<root>/.agents/skills/` (skills-delivery §2, §9): the skills and files its `snapshot.json` lists; the rules block comes from `<root>/templates/brain/AGENTS.md`, and the sub-agent from `<root>/templates/brain/.claude/agents/ultimate-assistant.md` (step 2a).
- **Not found** (no such `package.json`, or the template missing or unreadable) is a broken install:
  - `brain upgrade` fails with `INTERNAL` (exit 10) before any write.
  - `brain lint` completes: it reports exactly one `product-file` error (path `AGENTS.md`, message `installed package not found: <reason>`), checks nothing else for that rule, runs every other rule as usual, and exits 1.
- **An invalid package snapshot** (skills-delivery §2.3) makes `upgrade`, `init` and `link` on an unpinned brain refuse `SKILLS_SNAPSHOT_INVALID`; for `lint` on an unpinned brain it is the broken-install case above, with the §2.3 reason.
- **Source checkout:** the root contains `src/cli.ts`.

**Before anything is written:**
- **Published package only.** If the installed package is a source checkout (including `npm link`), refuse with `UNRELEASED_BUILD`. Prereleases (`0.3.0-rc.1`) are published packages and are allowed.
- **Git state** (0103, from 0.16.1): no merge or other Git operation in progress, else `GIT_OPERATION_IN_PROGRESS` (**Uncommitted work** below, item 1). Before 0.16.1 a clean tree was required here (`BRAIN_DIRTY` for any uncommitted change, 0038); 0103 replaces that rule.
- The safety checks below.
- **The skill pin** (0059, skills-delivery §6.3), after the checks above and in this order; `--dry-run` refuses the same way. Upgrade is exempt from the pin guard (§5.28): it is the repair path, whatever the brain's state.
  1. The package snapshot must be compatible with the running CLI, else `SKILLS_SNAPSHOT_INVALID`.
  2. An `invalid` lock will be replaced, with warning `SKILLS_LOCK_REPLACED`; `from` is then `null`, as for `unpinned`. Otherwise `from` is the lock's `{ name, version }`.
  3. Same snapshot `name` and the lock's version of higher precedence → `SKILLS_DOWNGRADE`.
  4. Same `name` and `version` but manifests not deep-equal → `SKILLS_SNAPSHOT_INVALID`, reason `same version, different content`.
  5. Another `name` (`ultimate-brain` → `ultimate-brain-skills`) is an ordinary upgrade.
- **Uncommitted work** (0103, from 0.16.1), after the pin, since a refused pin leaves no complete plan to compare: uncommitted work that conflicts with the plan → `BRAIN_DIRTY`, listing every conflict (**Uncommitted work** below, items 2 to 5). Then, when the plan writes anything, a Git identity to commit with (`git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT` succeed in the brain folder), else `GIT_IDENTITY_MISSING` with `init`'s message (§5.1 step 0), its last line `Then run brain upgrade again. Nothing was written.` and its first `Git doesn't know your name and email yet, and the upgrade commits its changes with them. Run these two lines, with your own name and email:`. Before 0.16.1 the clean-tree refusal came before the pin's.
- **Nothing changed since planning** (item 6 below), just before the first write, else `BRAIN_CHANGED`.

**Writes:**
1. **`AGENTS.md` rules block.** Replace everything from the line `<!-- ultimate-brain:rules:start … -->` through `<!-- ultimate-brain:rules:end -->` with the same block from `templates/brain/AGENTS.md`. Text outside the markers is kept byte for byte.
   - `AGENTS.md` missing → written from the template (`created`).
   - Markers missing, out of order or duplicated → the file is left alone (`skipped`) with warning `AGENTS_BLOCK_NOT_FOUND`; the user restores the markers or merges by hand.
1a. **The style block** (0081, from 0.14.0; §5.3.1), in the same file, after step 1: written, replaced or removed from `brain.json` `settings.style`, so a brain with no style lines has none. An `AGENTS.md` created by step 1 gets it too. When step 1 skipped the file, or the style markers are missing, out of order or duplicated, the file is left alone (`skipped`, warning `AGENTS_BLOCK_NOT_FOUND`). `AGENTS.md` appears once in `files`, `updated` when either step changed it. The upgrade also runs on a `brain.json` that fails the schema: a `settings.style` key whose value the schema doesn't allow counts as absent, and a `style` that isn't an object as `{}`. A `brain.json` that isn't valid JSON (step 5) leaves the style block as it is.
1b. **The structure block** (0089, from 0.14.0; §5.8.1), in the same file, after step 1a: written, replaced or removed from the notes as `brain index` would. When step 1 or 1a skipped the file, or the structure markers are missing, out of order or duplicated, the block is left as it is (warning `AGENTS_BLOCK_NOT_FOUND` when there was one to write or remove). `AGENTS.md` appears once in `files`.
1c. **`.gitignore`** (0.15.0, [weekly-review.md](weekly-review.md) §9.5): the line `_weekly/attempt.json` is appended when no line of the file is exactly that (trimmed), after a line break when the file doesn't end in one (`updated`); a missing `.gitignore` is written with that line alone (`created`). Every other line is kept. So the weekly review's attempt marker is never committed in a brain made before 0.15.0.
1d. **`.gitattributes`** (0.15.2, decision 0097): the line `* text=auto eol=lf` is put first when no line of the file is exactly that (trimmed), followed by the file as it was (`updated`): in `.gitattributes` a later line wins, so the user's own, more specific rules (`*.pdf binary`) keep their effect; a missing `.gitattributes` is written with the template's file (`created`). Every other line is kept, and the files in the working tree aren't rewritten: a Windows checkout made before keeps its line endings until Git checks the files out again. A path that is a symbolic link or a folder is `OUTSIDE_ROOT` before any write.
2. **`CLAUDE.md`:** written as `@AGENTS.md` only if missing. One that exists in any form (a file, or a link to `AGENTS.md`) is left alone.
2a. **The sub-agent (0.10.0, [assistant.md](assistant.md) §10).** `.claude/agents/ultimate-assistant.md` is written from `templates/brain/.claude/agents/ultimate-assistant.md` (creating `.claude/agents/` when needed) when it is missing (`created`) or its bytes differ (`updated`): the whole file is product-owned. A path that is a symbolic link or a folder is `OUTSIDE_ROOT` before any write. Other files in `.claude/agents/` are the user's and are left alone.
3. **Skills (0029, 0038, 0059).** For each skill of the package snapshot, in **both** `.agents/skills/<name>/` (Codex) and `.claude/skills/<name>/` (Claude Code):
   - write every listed file whose content differs (`created` or `updated`);
   - remove every other file inside that skill's folder (`removed`), then its emptied folders.

   **Retired skills:** a skill the old, valid lock names and the new snapshot doesn't has its folder removed from both trees: every file in it is `removed`, the user's included, and the emptied folder goes too. Without a valid old lock, folders the snapshot doesn't name are the user's own and are left alone.

   3a. **`skills.lock.json`** (skills-delivery §3) is written when the lock is `unpinned` or `invalid`, or names another snapshot `name` or `version`; it gets `installed_by` = the running version and is listed in `files` (`created`, or `updated`). Otherwise it stays as it is, keeping its `installed_by`.
4. **Retired plugin (0038).** If `.claude/settings.json` exists, remove the key `ultimate-brain@ultimate-brain` from `enabledPlugins` and the key `ultimate-brain` from `extraKnownMarketplaces`; an object left empty is removed. Other keys are kept in order, and the file is written as JSON with 2-space indent and a trailing newline (`updated`). A file left as `{}` is deleted (`removed`). A file that is not valid JSON is left alone (`skipped`) with warning `SETTINGS_UNPARSEABLE`. Nothing to remove → no change.
5. **Renamed `brain.json` keys (0037).** If `notion.databases` has `capture_inbox`: when `inbox` is absent or empty, rename the key to `inbox` in place (same position, same value, an empty `inbox` removed); when `inbox` already holds an id, just remove `capture_inbox`. Every other key and value is kept in order, and the file is written as JSON with 2-space indent and a trailing newline (`updated`). A `brain.json` that is not valid JSON is left alone (`skipped`) with warning `BRAIN_JSON_UNPARSEABLE`. No `capture_inbox` → no change. The same rule renames `references` to `documents` (0049). A `concepts` key is removed, whatever its value (0071: the Concepts database is retired; migration 0018 trashes it). Then, if `brain.json` has no `modules` block, it is added after `settings` (or after `budgets` when there is no `settings`) with every key `true` except Domains and Factories (0.18.0: `factories` is never written by an upgrade, schema §12), so a brain made before 0.6.0 keeps its earlier modules on (schema §12, 0048); since 0.16.0 that block has no `knowledge` key. **The Knowledge module (0.16.0, 0099 §1):** a `modules.knowledge` key is removed, whatever its value, since decisions and questions are never published as rows (schema §12). `notion.databases.decisions` and `notion.databases.questions` are kept: the 0.16.0 Notion migration reads Questions once and then removes both (§5.14.9). Upgrade never adds `notion.tasks.properties.kind`: the migration or the connect step sets it, once the database has Kind (setup.md §6.2.1). Finally, if `modules.reports` is `true` and `modules.documents` is not, `documents` is set to `true` (0071: reports are Documents rows; without it, Reports would count as off), with warning `DOCUMENTS_TURNED_ON`: `Reports now live in Documents, so the Documents module is on. Apply Notion migration 0019 before the next publish: {product.path}/notion/migrations/0019-reports-move-to-documents.md` (`{product.path}` as `brain status` reports it, §5.2).
5a. **Concepts become learned Documents (0.9.1, 0071).** For each note with `type: concept`, sorted by path:
   - **Frontmatter:** `type` becomes `reference`, `origin: learned` is added, and `notion`, `last_synced` and `notion_published` are removed, so the next `sync render` creates its page in Documents (the Concepts page is trashed by migration 0018). Every other key and value is kept in its place (`id`, `created`, `updated` and `lifecycle` included); `origin` goes where §3.6.5's order puts it, as for any edited file.
   - **Path:** `knowledge/references/<file name>`, the file name kept; when that path is taken (by a file or by an earlier conversion), `<slug>-2.md`, `-3`, … The old file is `removed`, the new one `created`; `knowledge/concepts/` and every folder under it left empty are removed (a folder still holding a file stays).
   - **Links:** in every Markdown note of the brain **except sources** (their bytes are hashed, schema §4) — views and proposals included — each relative link (`[x](t)`, `[x](t "title")`, `[x](<t>)`, `[x]: t`, as lint reads them, §5.10) whose target resolves to a moved file is rewritten to the new path, relative to the linking file's own (new) folder, keeping any `#anchor` or `?query`; a moved note's links to files that didn't move are rewritten the same way when their relative path changes. Nothing else in a body changes. Each rewritten file is `updated`.
   - **Links inside proposals (CC-136, dogfood #220).** A proposal's frontmatter holds note text too, and its links are relative to the folder of the note that text is written for (schema §14). In every proposal, **whatever its `status`** (an applied one is a record, and Git keeps its earlier text), these strings are rewritten by the rule above, read from that note's old path and written for its new one:
     - `content`, a string `decision.value` and each string `decision.fixes[].value` without `change`: for `target`;
     - each `changes[i].content`, and a `decision.fixes[]` value with `change: i`: for `changes[i].target`;
     - each `revisions[].previous`: for the note its item names (the `items` entry with that `item_id`: `changes[ref].target` for a change, the note `ref` for a note);
     - `note.body` of a `new_item`: for the folder its note type is written to (§3.8; a project's, `projects/<slug>/`, from its title).
     A string whose note doesn't exist, or a `note.body` whose type has no folder, is left as written. Nothing else in the frontmatter changes, except:
     - **`before_hash` follows a rewritten body.** On a proposal not yet applied or closed (`pending`, `approved` or `edited`), a `before_hash` (top level on an `update_body`, or on an `update_body` item of `changes`) whose target's body this step rewrites, and that equals the hash of the old body, becomes the hash of the new one, so the link change alone never makes it stale. One that didn't match stays as it is (still stale).
     - **A concept `new_item` becomes a learned Document.** On a `new_item` not yet applied or closed whose `note.type` is `concept`, `note.type` becomes `reference` and `note.frontmatter.origin` becomes `learned` (`note new` refuses a concept, §5.5); its `note.body` is then read from `knowledge/concepts/` and written for `knowledge/references/`.
     The proposal file is written as any edited file (§3.6.5) and `updated`.
   - **Links a brain already converted missed (CC-136).** A brain upgraded to 0.9.1 before this rule kept dead links to `knowledge/concepts/` inside its proposals, and a note written later by the old skills can link a converted concept too. The paths moved then are not recorded, so for each link the rules above read (bodies and proposal strings alike) whose target is a file under `knowledge/concepts/` that doesn't exist and isn't converted in this run, the destination is found by its file name `<name>.md`: the learned Document whose `id` starts with `con-` at `knowledge/references/<name>.md`, else the only one at `knowledge/references/<name>-<n>.md` (`n` ≥ 2). That link is rewritten as if its target had moved there. With no such Document, or several at `-<n>`, the link is left as written, with one warning `CONCEPT_LINK_UNRESOLVED` per file naming the file and its links; the user fixes them by hand. So running the upgrade again on a converted brain repairs what the 0.9.1 conversion missed, and on a brain with nothing left to repair it changes nothing.
   - **`index.md`** is rebuilt (`brain index`, schema §13) when a note is converted, and `updated` when its bytes change.
   - `data.converted` lists `{ "id", "from", "to" }` per converted note, sorted by `from` (empty when there is none). Converting and repairing nothing changes nothing, so a second upgrade reports `converted: []` and no file. A brain still on the old skills keeps working: a concept it writes later is reported by `concept-retired` and converted by the next upgrade.
   - Safety as for the other writes: a moved, rewritten or created path that is a symbolic link, or a file where a folder belongs, is `OUTSIDE_ROOT` before any write.
6. Log `- <timestamp> upgrade - "<package version>" files=<n>` when anything changed. `--dry-run` writes and logs nothing and reports the same `files`.
7. **Lint** the brain (§5.10) and report the counts in `lint`; it reads the new lock. Lint findings never stop the upgrade: it only wrote product-owned files. With `--dry-run`, lint reads the **planned** tree: every `created`, `updated` or `removed` file as the upgrade would leave it, everything else (including `skipped` files) as it is on disk. So a dry run reports what would remain after the upgrade: `product-file` is silent for drift the upgrade repairs, and still reports an `AGENTS.md` left `skipped` for missing markers.
8. **Commit and push**, when anything changed and the brain is a Git repository: commit exactly the upgrade's footprint (**Uncommitted work** below, item 3: the paths in `files` whose `action` is `created`, `updated` or `removed`, plus the log file step 6 appended to, `log/<YYYY-MM>.md`), and nothing else, as item 7 below says: never a `skipped` path, and never the user's own uncommitted work, staged or not. Commit `upgrade: ultimate brain <version>, skills <snapshot name> <snapshot version>`, then `git push` if the current branch has an upstream. No upstream → warning `PUSH_SKIPPED`. A push that fails → warning `PUSH_FAILED` with Git's message; the commit stays, and the exit code is still 0. Not a Git repository → no commit, no warning.
   - **A commit Git refuses** (0103: replaces the `GIT_COMMIT_SKIPPED` warning, which kept the files uncommitted; a missing identity is now refused before any write): the upgrade undoes its writes (item 8 below) and fails with `UPGRADE_NOT_COMMITTED`.

9. **Linked projects (0.13.0; 0077 §4, [eligibility.md](eligibility.md) §11).** After the brain's own steps, the upgrade refreshes every **registered linked project**: each `repos` entry of `brain.json` (schema §12), in `brain.json` order, its `path` with `~/` expanded. A folder linked with `brain link` but not in `repos` is outside the upgrade: the brain records no path for it (step 1 of §5.12 writes none).
   - **Source.** What `brain link` would write there (§5.12) with no options, so the project keeps its `.brain` placement: the managed block in `AGENTS.md` and, where §5.12 step 2 writes it, `CLAUDE.md`; `.brain` with its `skills` replaced; and the linked skills in `.agents/skills/` and `.claude/skills/`, all from the package snapshot this upgrade pins (step 3), retired linked skills removed as §5.12 removes them. Text outside the markers is kept byte for byte. Projects are never committed or pushed: `link` doesn't commit either, and the output says to commit there.
   - **Judged before any write in that project**, in the table's order, except that the refusals §5.12 makes while planning its files (a symbolic link in a skill folder, a `.brain` project or area the brain no longer has) come after `conflicting_copies`. The first that applies makes the project **unfinished** with its `reason`, nothing is written in it, and it is never counted upgraded:
     | `reason` | When |
     |---|---|
     | `path_missing` | the path doesn't exist, isn't a folder or can't be read |
     | `refused` | the path is the brain or the product repo, or §5.12 would refuse it (`OUTSIDE_ROOT` for a symbolic link where a file or folder belongs, `INSTRUCTIONS_SYMLINK`, `INPUT_INVALID` for a malformed `.brain`, `UNKNOWN_ID` for a `.brain` project or area the brain no longer has); `message` is the refusal's |
     | `block_missing` | `AGENTS.md`, or a `CLAUDE.md` that neither imports `@AGENTS.md` nor links to `AGENTS.md`, is missing or has no managed-block marker |
     | `block_damaged` | a marker without its pair, markers out of order, or one marker repeated |
     | `conflicting_copies` | two complete managed blocks in one file; a `CLAUDE.md` block that differs from `AGENTS.md`'s; or a competing copy of a linked skill (skills-delivery §5.2, kinds `duplicate` in the project's trees and `global`). The upgrade never deletes or rewrites a copy it did not write (skills-delivery §5) |
     | `write_failed` | a write failed: the project's files already written are restored (§3.6) |
     | `definitions_differ` | the check below failed after writing |
   - **An entry with no `.brain`** (judged after `path_missing` and the brain or product repo) whose `AGENTS.md` and `CLAUDE.md` hold no managed-block marker was never linked with `brain link` (a read-only source, §5.16): state `not_linked`, nothing written, neither upgraded nor unfinished.
   - **Both agents (eligibility.md §11 step 2).** After writing, in the brain and in each project written: every file the snapshot lists for a skill (the brain's skills; a project's linked skills) holds the snapshot's bytes in both `.agents/skills/<name>/` (Codex) and `.claude/skills/<name>/` (Claude Code); in a project, `AGENTS.md` holds the expected block once, and `CLAUDE.md` reaches it (it imports `@AGENTS.md`, links to `AGENTS.md`, or holds the same block). A project that fails is `definitions_differ`; the brain failing adds warning `DEFINITIONS_DIFFER` naming the first file. `--dry-run` skips this check.
   - **State.** `upgraded` when a file changed, `unchanged` when none did, `unfinished`, or `not_linked`. An unfinished project is retried on the next run; a second run with the same CLI changes nothing more and reports the upgraded ones `unchanged`.
   - **Report.** `data.projects`: one `{ "name", "path", "state", "reason", "message", "files" }` per entry, in `brain.json` order: `path` as stored; `reason` and `message` `null` unless `unfinished`; `files` the `{ path, action }` §5.12 reports, without `unchanged` ones (`[]` for an unfinished project). One warning `PROJECT_UNFINISHED` per unfinished project, its message `<name>: <message>`. **The exit code is 1** when any project is unfinished or the brain's check failed (§3.4: completed with findings); the brain's own writes and commit stand. `--dry-run` judges and plans the same and writes nothing in any project.
   - **Human output** ends with these lines, after the files and the Notion line: `Projects: <n> upgraded, <n> unchanged, <n> unfinished.` (with `, <n> not linked` when there is one), one line `  <name>: <message>` per unfinished project, `Commit what changed in each upgraded project.` when one was upgraded, `Folders linked with brain link alone aren't tracked by the upgrade: register them with brain repo add, or run brain link there again.`, and last `Start fresh agent sessions in the brain and in every project: a session opened before the upgrade keeps the old instructions.` (eligibility.md §11 step 5). `data.next` holds the same closing lines, in order.

```sh
brain upgrade --json
```
```json
{ "ok": true, "command": "upgrade", "brain": "/Users/me/brain", "warnings": [],
  "data": {
    "dry_run": false, "version": "0.2.3",
    "files": [
      { "path": ".agents/skills/brain-ingest/SKILL.md", "action": "updated" },
      { "path": ".claude/settings.json", "action": "updated" },
      { "path": ".claude/skills/brain-ingest/SKILL.md", "action": "created" },
      { "path": "AGENTS.md", "action": "updated" }
    ],
    "unchanged": 14,
    "converted": [],
    "skills": { "from": { "name": "ultimate-brain", "version": "0.2.2" }, "to": { "name": "ultimate-brain", "version": "0.2.3" }, "retired": [], "previous_cli": "0.2.2", "competing": [] },
    "lint": { "errors": 0, "warnings": 2 },
    "notion_migrations": { "template_version": "0024", "newer": ["0025-weekly-review.md"], "review_database": false, "knowledge_databases": false },
    "commit": "2c2d653",
    "pushed": true,
    "uncommitted": { "conflicts": [], "unrelated": ["diagrams/launch flow.excalidraw", "knowledge/references/draft-pricing.md"] },
    "projects": [
      { "name": "acme-api", "path": "~/code/acme-api", "state": "upgraded", "reason": null, "message": null, "files": [ { "path": "AGENTS.md", "action": "updated" } ] },
      { "name": "old-site", "path": "~/code/old-site", "state": "unfinished", "reason": "path_missing", "message": "~/code/old-site doesn't exist or can't be read", "files": [] }
    ],
    "next": ["Commit what changed in each upgraded project.", "Folders linked with brain link alone aren't tracked by the upgrade: register them with brain repo add, or run brain link there again.", "Start fresh agent sessions in the brain and in every project: a session opened before the upgrade keeps the old instructions."]
  } }
```

**Notion migrations newer than the template (0078, from 0.14.0; [setup.md](setup.md) §9).** `notion_migrations.template_version` is `brain.json` `notion.template_version` (`null` when absent). `newer` lists the file names in the installed package's `notion/migrations/` that match `^[0-9]{4}-.+\.md$` and whose number is higher than it, sorted; `[]` when there is none; `null` when the version is unknown, since nothing can be compared. It is read only: upgrade never writes the version, and `--dry-run` reports the same. Human output adds one line after the files: `Notion: 2 migrations newer than your space: <product.path>/notion/migrations/0025-….md, …. Ask your agent to apply them ("apply the Notion migrations").` with the full paths (one migration is `Notion: 1 migration newer than your space: …`, in the singular); `Notion: your space has every migration (template 0024).` for `[]`; `Notion: template version unknown, so upgrade can't tell which migrations your space needs; ask your agent which ones apply (<product.path>/notion/migrations/).` for `null`.

**The 0.16.0 migration (decision 0096, capture-and-review §7.9).** While `brain.json` has `notion.databases.review` (any value), the space still has the Review database: `notion_migrations.review_database` is `true` (else `false`), whatever `newer` says, and human output adds `Notion: your space still has the Review database. Ask your agent to apply the 0.16.0 Notion migration (<product.path>/notion/migrations/0027-one-place-to-decide.md): it reads the Review rows once, applies what you decided there, and archives the database.` The migration removes the key (§5.14.8), which ends the line. Upgrade never removes it. In the same way (0099 §8), while `brain.json` has `notion.databases.decisions` or `notion.databases.questions` (any value), `notion_migrations.knowledge_databases` is `true` (else `false`), and human output adds `Notion: your space still has the Decisions and Questions databases. Ask your agent to apply the 0.16.0 Notion migration (<product.path>/notion/migrations/0027-one-place-to-decide.md): it reads back the Status you set on questions, then archives both databases.` The migration removes both keys (§5.14.9), which ends the line. Each line names the migration by its full path under the installed package, as the newer-migrations line does; when both hold, the Review line comes first.

`files` lists only the files created, updated, removed or skipped, sorted by path; `unchanged` counts the rest. `skills` (skills-delivery §6.3): `to` is the package snapshot; `retired` the retired skill names, sorted; `previous_cli` the old lock's `installed_by` when step 3a wrote over a valid lock, else `null`; `competing` per skills-delivery §5.2 for the package snapshot's skills, with warning `SKILLS_COMPETING` when non-empty (never a refusal). An immediate second upgrade with the same CLI reports `files: []`. `commit` is the short hash, or `null` when nothing was committed; `pushed` is `false` unless a push succeeded. `uncommitted` is as **Uncommitted work** below says (item 5). `--dry-run` adds `dirty` and `would_refuse` and reports `commit: null`, `pushed: false`.

**Safety:** all checks run before the first write. `AGENTS.md`, `skills.lock.json`, `.agents`, `.agents/skills`, `.claude`, `.claude/skills`, `.claude/settings.json`, a snapshot or retired skill's folder, or any file in it that is a symbolic link, or a file where a folder belongs → `OUTSIDE_ROOT`, and nothing is written or removed. `brain link` checks its skill folders the same way (§5.12). If a write fails part way, the files already replaced or removed are restored and the created ones deleted (§3.6), the lock included, so the last working pin stays. Undoing an upgrade is a `git revert` of its commit plus the previous CLI (`previous_cli`; docs/releasing.md, skills-delivery §8).

**Uncommitted work (0103, from 0.16.1).** An upgrade proceeds around uncommitted work that is unrelated to it, and refuses, before any write, only work it conflicts with. It never commits, stashes, resets, cleans, checks out, stages or unstages the user's work. In a brain that isn't a Git repository none of this applies: `uncommitted` is `null`, as nothing can be compared.

1. **Git state.** First of the Git checks, before the plan is compared: when Git has an unresolved conflict (an unmerged entry in the index), or its Git directory (`git rev-parse --git-path <name>`, so a linked worktree reads its own) holds `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `rebase-apply/`, `sequencer/` or `BISECT_LOG`, refuse with `GIT_OPERATION_IN_PROGRESS`: `Git is in the middle of a <merge|cherry-pick|revert|rebase|bisect>. Finish it or abort it, then run brain upgrade again.` (the first that applies, in that order: `rebase-merge/` and `rebase-apply/` are a `rebase`, and `sequencer/` a `revert` when its `todo` holds a `revert` line, else a `cherry-pick`); an unmerged entry alone says `Git has unresolved conflicts. Finish it or abort it, then run brain upgrade again.` A locked index (`index.lock`) is waited for up to 10 seconds, then `BRAIN_BUSY`, as for the `workflow` commands; a dry run reads without the lock, so it doesn't wait. A detached `HEAD` and a branch with no commit yet are not refused (the commit then goes on that `HEAD`, as before 0.16.1).
2. **Uncommitted paths.** Read once, with `git status --porcelain=v2 -z --untracked-files=all --no-renames` in the brain folder, so names with spaces, quotes or non-ASCII characters arrive byte for byte, every untracked file is listed on its own (not its folder), and a rename appears as its two endpoints: the old path deleted and the new one added. Each path gets one `state`: `staged` (the index differs from `HEAD`, the file from the index doesn't), `unstaged` (the file differs from the index, the index from `HEAD` doesn't; a deleted file included), `partly_staged` (both), or `untracked`. A submodule with changes is one path. Paths are relative to the brain folder with `/`; a path outside it (a brain inside a larger repository) is never related. Ignored files aren't uncommitted work: the upgrade sees them only as item 5 says.
3. **The footprint.** Everything the upgrade would change in the brain, computed in full (steps 1 to 6) before any comparison or write: the paths in `files` whose `action` is `created`, `updated` or `removed` (a `skipped` path is not changed, so it isn't in the footprint); both endpoints of a concept moved by step 5a (the `removed` `knowledge/concepts/…` and the `created` `knowledge/references/…`); the monthly log `log/<YYYY-MM>.md` of `--now` when anything else changes (step 6); and the folders the writes create (`.claude/agents/`, a new skill's folder). A folder removed only once it is empty (an emptied skill folder, `knowledge/concepts/`) is not in it: a file left inside keeps the folder. Linked projects (step 9) are outside the footprint: the upgrade never commits there, and their own checks stay as step 9 says.
4. **Generated inputs.** Some written files are built from other files of the brain, which are then their **inputs**:

   | Written file (when in the footprint) | Its inputs |
   |---|---|
   | `AGENTS.md` (the style block, step 1a; the structure block, step 1b) | `brain.json` (`settings.style`, `modules`); every domain, area and project note (§5.8.1); the files of `_suppressions/` |
   | `index.md` (rebuilt by step 5a) | every note of the brain, and the files of `_suppressions/` (schema §13) |
   | a retired skill's removed files (step 3), and `skills.lock.json` (step 3a) | `skills.lock.json` (the old lock names the retired skills) |

   The rules block, the skills, the sub-agent and `CLAUDE.md` come from the package alone; `brain.json` (step 5), `.claude/settings.json` (step 4), `.gitignore` (step 1c), `.gitattributes` (step 1d) and a note rewritten by step 5a are built from themselves, so they are in the footprint already. The log line counts files only. Lint (step 7) writes nothing, so what it reads is no input.
5. **Conflicts.** An uncommitted path conflicts when the first of these applies, which is its `reason`:

   | `reason` | When | `resolution` |
   |---|---|---|
   | `log` | it is the monthly log the upgrade appends to | `Commit <path> first: the upgrade adds its own line to it.` |
   | `changed` | it is in the footprint: the upgrade would create, replace, remove or move it | `The upgrade <creates\|replaces\|removes\|moves> this file. Commit your change first (Git keeps your version), or move the file somewhere else.` |
   | `collision` | a file of the footprint is one of its parent folders, or it is a parent folder of a file of the footprint (a file where the upgrade needs a folder, or the reverse) | `The upgrade needs <affects[0]> here. Move this file somewhere else.` |
   | `input` | it is an input (item 4) of a file in the footprint, and building that file with this path read as committed (its `HEAD` version, or absent when untracked), every other file as it is, gives other bytes | `<affects> is built from this file. Commit your change first, or undo it.` (two files: `AGENTS.md and index.md are built from this file. …`) |

   Also a conflict, with `state` and `reason` both `ignored`: a file the upgrade creates or replaces that Git ignores and doesn't track (`git check-ignore`), since the commit can't take it: `Your .gitignore ignores this file, so the upgrade can't commit it. Remove the rule that ignores it.` Paths are compared as Git gives them, case-insensitively when Git's `core.ignorecase` is `true`. Any other uncommitted path is **unrelated**: a draft, a diagram, a modified note no generated file depends on, a file staged or partly staged, wherever it is.
   - **Each conflict** is `{ "path", "state", "reason", "affects", "resolution" }`: `affects` lists the footprint's paths involved, sorted (the path itself for `log`, `changed` and `ignored`; the generated files for `input`; the colliding paths for `collision`). Conflicts are sorted by `path`, one per path.
   - **Refused:** any conflict → `BRAIN_DIRTY`, before any write, with `details` `{ "conflicts": [ … ], "unrelated": [ <paths, sorted> ] }`. The message is the human output's first line. Human output (stderr):
     ```text
     Upgrade stopped before writing anything: 2 uncommitted files conflict with it.
       log/2026-11.md (unstaged): Commit log/2026-11.md first: the upgrade adds its own line to it.
       .agents/skills/brain-ingest/my notes.md (untracked): The upgrade removes this file. Commit your change first (Git keeps your version), or move the file somewhere else.
     3 other uncommitted files are unrelated to the upgrade and would be left as they are.
     ```
     The last line is left out when nothing is unrelated (`1 other uncommitted file is …` in the singular).
   - **Proceeding:** `data.uncommitted` is `{ "conflicts": [], "unrelated": [ <paths, sorted> ] }`, and when `unrelated` isn't empty the human output adds, after the files: `Left as they were: <n> uncommitted files unrelated to the upgrade (not in its commit).` (`1 uncommitted file` in the singular). The first line of a refusal is in the singular for one conflict: `… 1 uncommitted file conflicts with it.`
   - **`--dry-run`** refuses nothing for Git state, uncommitted work or the identity: it reports them. `data.uncommitted` lists the same conflicts and unrelated paths the real run would (`null` outside Git), and `data.would_refuse` is the code the real run would fail with before writing (`GIT_OPERATION_IN_PROGRESS`, `BRAIN_DIRTY` or `GIT_IDENTITY_MISSING`), else `null`; with Git busy, `uncommitted` is `null` too, since the real run stops before comparing. The human output adds, after the files, `The upgrade would stop before writing: ` followed by the refusal's text: the conflict lines above (from `<n> uncommitted files conflict with it.` on), the Git state message (item 1), or the identity message below. A dry run with `would_refuse` set exits 1 (§3.4: completed with findings). `dirty` stays: `true` when there is any uncommitted path, related or not.
   - **Nothing to write** (an immediate second upgrade): the footprint is empty, so nothing conflicts, and uncommitted work is all unrelated; nothing is committed, as before.
6. **Nothing changed since planning.** Just before the first write the upgrade checks that `HEAD` names the commit it planned from (or still none), that the uncommitted paths and their states are the ones item 2 read, and that every file of the footprint and every input it read (item 4) has the bytes, or the absence, it planned from. Anything else → `BRAIN_CHANGED`, naming the first path that changed (or `HEAD`), and nothing is written: `The brain changed while the upgrade was planning (<path>). Nothing was written; run brain upgrade again.` A file appearing where the upgrade creates one during the writes is §3.6's `WRITE_CONFLICT`, as before.
7. **The commit takes the footprint only.** It holds `HEAD`'s tree with exactly the footprint's paths set to what the upgrade wrote (a removed path gone), and nothing of the user's: after it, the index entry of every path outside the footprint is what it was before the upgrade, so staged and partly staged content stays staged, and no file outside the footprint changes. A file the upgrade removes that Git doesn't track (an ignored file inside a skill folder) is deleted, with nothing to commit for it. For example: stage the footprint's files alone, never a folder (`git add --all` with literal pathspecs read NUL-separated, `--pathspec-from-file=- --pathspec-file-nul`, with `GIT_LITERAL_PATHSPECS=1`), then `git commit --only` with the same pathspecs, which commits those paths on top of `HEAD` and leaves every other index entry as it was. The commit runs Git's hooks and signing settings as any `git commit` does. Right before it, `HEAD` is checked again (item 6).
8. **A refused commit** (a hook fails, `HEAD` moved, any other Git failure): the upgrade restores every file of the footprint whose bytes are still the ones it wrote to its bytes from before the upgrade, deletes the files it created, and takes the log line back out (§3.6, from in-memory originals); it sets the footprint's index entries back to what they were (they matched `HEAD`, since no path of the footprint was uncommitted), so the index is exactly as before. A file changed by someone else since the write is left as it is and named. No linked project is written. It fails with `UPGRADE_NOT_COMMITTED`: `Git didn't commit the upgrade (<Git's reason>). Nothing of the upgrade was kept, and your own changes are untouched. Fix the cause, then run brain upgrade again.`, adding `These files were changed since the upgrade wrote them and were left as they are: <paths>.` when there are any. Git's reason is the first non-empty line of Git's error output (a hook's own message, for a hook); a `HEAD` that moved before the commit (item 7) is `HEAD moved since the upgrade planned`. So a brain is never left with an upgrade written but uncommitted, which a second upgrade, finding nothing to write, would never commit. A push that fails after the commit stays the warning `PUSH_FAILED` (step 8).

Errors: `UNRELEASED_BUILD`, `GIT_OPERATION_IN_PROGRESS`, `BRAIN_BUSY`, `BRAIN_DIRTY`, `GIT_IDENTITY_MISSING`, `BRAIN_CHANGED`, `UPGRADE_NOT_COMMITTED`, `OUTSIDE_ROOT`, `SKILLS_SNAPSHOT_INVALID`, `SKILLS_DOWNGRADE`, `WRITE_CONFLICT`, and the brain resolution errors (§4). A linked project never raises an error: its problems are its `unfinished` state (step 9).

### 5.16 `brain repo` (linked repos, 0042)

```text
brain repo add <name> --path <path> --area <area-id> --pattern <glob> [--pattern <glob>]…
brain repo changes <name>
brain repo record <name> (--commit <sha> | --reset)
```

A linked repo is a read-only source: these commands read it with Git (`git -C <path> …`) and write only `brain.json` `repos` (schema §12). The skill reads each file's text with `git -C <path> show <commit>:<repo_path>` and ingests it as a document (brain-ingest).

**`repo add`** appends `{name, path, area, patterns, commit: ""}` to `repos`. `name` is lowercase kebab-case and unused (`INPUT_INVALID`); `area` must exist (`UNKNOWN_ID`); `path` is stored as given, and must resolve to the top of a Git working tree (`REPO_NOT_FOUND`) that is not the brain (`REPO_IS_BRAIN`, compared after resolving symbolic links). At least one `--pattern`; each is a Git glob pathspec relative to the repo root. `brain.json` is written as JSON with 2-space indent and a trailing newline. Logs `repo-add - "<name>"`. **With Factories on (0.18.0, 0113 §1)** it also gives the repo its Factory, in the same write: an archived entry with this `repo` name is the same Factory again (`archived`, `area` and `projects` removed); else an entry whose `path` is the same folder (real paths; on Windows compared without case) becomes it (`repo` set, `archived`, `path`, `area`, `projects` and `plan` removed, its id, name, row and overview kept); else a new one, with a fresh id and `name` the repo's. `data` adds `factory: <fac id>` (absent with the module off), and the skill sets the kit's `plan` from the folder's when it proposes the kit. A fresh name that another entry already has (ignoring case) gets `-2`, `-3`, …

**`repo changes`** writes nothing. With **to** = the repo's `HEAD` commit and **from** = the recorded `commit`:
- `from` is `""` (first ingest): every file matching the patterns at `to` is `added`.
- Otherwise `from` must be an ancestor of `to` (`REPO_COMMIT_UNKNOWN`). Files added or modified between them that match the patterns are listed, without rename detection (a rename is a deletion and an addition); deleted ones go to `deleted`.
- Each file carries the last commit in the range that touched it, and the files are ordered by that commit's committer time, oldest first, then by path. `sha256` is the hash of the file's bytes at `to`, so the skill can build its `file:` key; `bytes` is their size.
- Uncommitted changes in the working tree are not read; when there are any, warning `REPO_DIRTY`.

```json
{ "data": {
    "name": "acme-api", "area": "area-2m7c4h8n", "from": "", "to": "9f3c…(40 hex)",
    "files": [ { "path": "decisions/0001-use-supabase.md", "status": "added", "commit": "4b1e…", "committed_at": "2026-11-02T10:00:00Z", "sha256": "…", "bytes": 1840 } ],
    "deleted": []
} }
```

**`repo record`** sets the repo's `commit` after an ingest: `--commit` must exist in the repo and have the recorded commit (when not `""`) as an ancestor (`REPO_COMMIT_UNKNOWN`). `--reset` sets `""`, so the next `changes` lists every matching file again (their sources are found as duplicates by `note new`). Logs `repo-record - "<name>" commit=<sha>`. `data` = `{ "name": "…", "previous": "…", "commit": "…" }`.

Errors: `REPO_NOT_FOUND`, `REPO_IS_BRAIN`, `REPO_COMMIT_UNKNOWN`, `UNKNOWN_ID`, `INPUT_INVALID`, `USAGE` (missing `--path`, `--area` or `--pattern`).

### 5.17 `brain source full-text` (0043; retired in 0.6.0)

```text
brain source full-text <src-id> [--parts <range>[,<range>…]]
```

Retired by decision 0049: Keep as document gives a source's whole text as a readable page. The command writes nothing and fails with `RETIRED` (exit 2), whose message says "retired in 0.6.0: use Keep as document". Sources that already have `notion_text: full` keep it, and their Full text toggles stay in Notion.

### 5.18 `brain report new` and `brain report fix` (0043, 0045)

```text
brain report new --input <file|->
brain report fix <vw-id> --text <text> --proposals <prp-id>[,<prp-id>…]
```

**`report new`** stores a report the brain-query skill wrote (schema §4 view, §16.4). Input: `{ "title": "Acme launch: where we stand", "question": "Everything about the Acme launch since August", "asked_in": "<Ask row page id>", "projects": ["prj-…"], "area": "area-…", "body": "## Where it stands\n…" }`; `asked_in`, `projects` and `area` optional.

The CLI writes a `view` with `view_kind: report`, `generated_at` = now and `generated_from` = the ids of the notes the body links to (relative links from `reports/`, sorted), at `reports/<date>-<slug of title>.md`. `INPUT_INVALID` when the body's `##` sections aren't exactly the six of §16.4 in order, a link doesn't resolve to a note, or a link names a memory (`link <target> is a memory: a report cites knowledge notes, never a memory`; §5.13.1, CC-345); `UNKNOWN_ID` for `projects` or `area`. A refresh is checked the same way. Logs `report-new <id> "<title>"`. `data` = `{ "id": "vw-…", "path": "reports/…", "generated_from": ["…"] }`.

**Refresh (0045):** the input names `"refresh": "vw-…"`, a report. The CLI rewrites that file in place: the new `body`, `generated_at` = now, `generated_from` from the new body, and, when given, the new `title`, `projects` and `area`; `question`, `notion` and the path stay. A report withheld by §5.13.1's rule (`rebuild: "refresh"`) comes back through a refresh: the skill reads the notes through `brain query --read` and writes the body from what it returned, citing a note in the awaiting-cleanup form by its `cite` label, not by a link; the new `generated_at` clears `stale`, and a new body that no longer links a restricted note clears `dependency` (eligibility.md §8 rules 2 and 6). The brain never edits a report's prose itself. An `asked_in` in the input is appended to the report's `asked_in` (stored as a list once there are two). `INPUT_INVALID` when `refresh` isn't a report. Logs `report-refresh <id> "<title>"`. The next render publishes the new body and clears the row's Refresh box (§5.14.4).

**`report fix`** (0045) records a What to fix the user wrote on a Report row (its Documents row since 0.9.1, 0071): it appends `{text, received: now, proposals}` to the report's `fixes`, where `proposals` are the ids the skill wrote for it with `proposal new` (they must exist; `UNKNOWN_ID`). An empty `--proposals` value is allowed when the text needs no change to the notes (the skill says why in its report). The next render clears the row's What to fix. Once every listed proposal is terminal, the skill refreshes the report. Logs `report-fix <id> "<title>"`. `data` = `{ "id": "vw-…", "fixes": <count> }`.

### 5.19 `brain source diff` (0045)

```text
brain source diff <src-id>
```

Read-only. For a source with `replaces`, the line diff of its body against the body of the source it replaces, with no context lines. It is deterministic:
1. Both bodies are split into lines on `\n` after turning `\r\n` into `\n`; old = the replaced source's lines `o[0..m)`, new = this source's lines `n[0..k)`. Lines compare as exact strings.
2. `L[i][j]` = the length of the longest common subsequence of the suffixes `o[i..m)` and `n[j..k)` (`L[m][j] = L[i][k] = 0`).
3. A walk from `i = 0, j = 0`: if `o[i] = n[j]`, both advance and nothing is written; otherwise, if `L[i+1][j] ≥ L[i][j+1]`, write `- o[i]` and advance `i` (a tie removes first); otherwise write `+ n[j]` and advance `j`. When one side ends, write the rest of the other (`- ` for old, `+ ` for new) in order.

Example: old `A, B, A`, new `A, A, B` gives `- B` then `+ B`. `data` = `{ "id": "src-…", "replaces": "src-…", "removed": <n>, "added": <n>, "diff": "<the lines, joined by \n>" }`. The ingest reads it to propose only what changed. `INPUT_INVALID` when the source has no `replaces`; `UNKNOWN_ID` for a missing id.

**Restricted evidence (0055).** The diff never shows text that a suppression restricts: an older version or full copy of an input with an extract contributes only its `<!-- passage ¶n … -->` markers, and restricted lines are removed from the version it compares. A damaged suppression record fails the command with `SUPPRESSIONS_UNREADABLE`.

### 5.20 `brain modules` (0048)

```text
brain modules
brain modules on <module>
brain modules off <module>
```

`brain modules list` is the same command as `brain modules` (an alias, CC-156): same output, and `command` is `modules` in the envelope.

Lists or switches the optional modules of schema §12: `domains`, `orgs`, `documents`, `reports`, `tasks`, `planning` and, from 0.18.0, `factories`. Core has no switch. `knowledge` is retired in 0.16.0 (0099): it isn't listed, and `on knowledge` or `off knowledge` is `USAGE`, as for an unknown module, with a message that says decisions and questions now show on project and area pages.

**`brain modules`** writes nothing:
```json
{ "data": { "modules": [
    { "name": "orgs", "on": true, "default": true, "databases": ["orgs"], "missing": [] },
    { "name": "documents", "on": false, "default": false, "databases": ["documents"], "missing": ["documents"] },
    { "name": "reports", "on": false, "default": false, "databases": ["documents"], "missing": ["documents"] },
    { "name": "tasks", "on": false, "default": false, "databases": [], "missing": ["tasks"] }
] } }
```
One item per module, in the order above. `on` follows schema §12 (all `true` except Domains and Factories when the block is absent). `databases` lists the module's `notion.databases` keys; `missing` lists those whose id is empty, and `tasks` when `notion.tasks.database` is empty. So the skill knows which Notion steps a module still needs before it can work.

**`on` / `off`** set `modules.<module>` to `true` or `false` in `brain.json`. When the block is absent it is written first with every key `true` except Domains, and without `factories` (as `brain upgrade` does), then the switch is applied. `brain.json` is validated and written as JSON with 2-space indent and a trailing newline. Nothing else changes: no note, no Notion page, no database id. Switching a module to the state it is already in writes nothing (`changed: false`). Logs `modules - "<module>" state=on|off` when it changes. `data` = `{ "module": "documents", "on": true, "changed": true, "missing": ["documents"] }`.

**Reports needs Documents (0071).** A report is a Documents row, so `on reports` also sets `documents` to `true`, and `off documents` also sets `reports` to `false`; the other two switches (`on documents`, `off reports`) touch only their own key. `data` then adds `"also": [{ "module": "documents", "on": true }]` (or `reports`, `false`), absent when nothing else changed; `changed` is true when either key changed, `missing` is the named module's, and each changed key logs its own `modules` line. In the list, `reports` lists `documents` in `databases` (and in `missing` while its id is empty), and a `brain.json` that still has `reports: true` with `documents: false` (written by hand, or before 0.9.1 and not yet upgraded) shows `reports` as `on: false`: Reports counts as off until Documents is on (schema §12).

**Factories (0.18.0, 0113 §1).** Its list item also has `"asked"`: `true` when `modules.factories` is present. Its `databases` is `["factories"]`, and `missing` also has `tasks.factory` while `notion.tasks.properties.factory` is empty and Tasks is on.
- `on factories` sets the key to `true` and, in the same write, gives every `repos` entry that has no Factory one (§5.16's rules, in `repos` order). `data` adds `"factories": ["fac-7k2m9q4x"]`, the ids made. Run again, it makes the missing ones, if any.
- `off factories` writes `false` even when the key was absent (that is the recorded "no", linked-repos.md §1.2): then `changed` is `true`, with `on` false before and after. It deletes no entry.
- The skill then follows `notion/modules/factories.md`, sets `notion.databases.factories` and `notion.tasks.properties.factory` with `config set`, publishes the rows, and writes each Factory's first overview.

Turning a module on in Notion is the skill's job, with the user: it follows the module's steps in `notion/modules/<module>.md` (Notion AI prompts for its databases, buttons and layouts by hand, then `config set` for each id), and the next catch-up uses the module. Turning one off deletes nothing (schema §12).

Errors: `USAGE` (an unknown module, `core`, or `on`/`off` without one).

### 5.21 `brain schedule` (0051; 0.17.0, decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §7 to §9)

```text
brain schedule install [<job>] [--at <HH:MM>[,<HH:MM>…]] [--days <day>[,<day>…]] [--agent claude|codex] [--model <id>] [--max-budget-usd <n>] [--dry-run]
brain schedule list
brain schedule remove <job>
brain schedule remove --here
```

Runs a skill on a schedule, with nobody there, through the agent the brain is set up with: Claude Code (`claude -p`) or Codex (`codex exec`), the schedulers that see every input: the drop folder, linked repos and the user's Notion MCP (0051, 0110 §9). **From 0.17.0 the schedule is kept in the brain:** `settings.schedule` (schema §12) holds the runner, the agent, the model it pins and each job's slot, and `brain schedule` installs **the machine's entries** from it, so installing again, or on another computer, gives the same times (0110 §7). The entry itself is the machine's (a launchd agent, a Task Scheduler task, a cron line) and is never in the brain. `install` and `remove <job>` write `settings.schedule` (validated against brain.schema.json, as `config set` does) and nothing else in the brain: no log line, no commit; the skill commits `brain.json`. `remove --here` and `list` write nothing in the brain.

Reflection has no job of its own (0076 §5): it runs attended, and its weekly run is the weekly review's knowledge stream, job `weekly-review` ([weekly-review.md](weekly-review.md) §11). The two jobs are separate entries, never chained, and neither runs the other.

**Jobs.** Each job runs one fixed prompt in the brain folder, so the schedule starts the skill the same way every time:

| `<job>` | Prompt | Needs | Its slot in `settings.schedule` | Default slot when asked (0110 §8) |
|---|---|---|---|---|
| `catch-up` | `catch up unattended` | brain-catch-up | `catch_up` | 07:30 every day |
| `weekly-review` | `weekly review unattended` | brain-weekly-review ([weekly-review.md](weekly-review.md) §11) | `weekly_review` | Monday 08:00 |

The defaults are what setup and the skills offer (setup.md §7 item 12), and what `install <job>` takes when neither `--at` nor a stored slot gives the job's times (`weekly-review`'s Monday 08:00 is 0.15.0's default, kept).

**`install <job>`** sets that job's slot and installs its entry:
- `--at`: one or more local times, 24-hour `HH:MM`, comma-separated, kept sorted and without repeats (`07:00,13:00`). Absent, the stored slot is kept, or, with none, the job's default slot (the table above). While `settings.schedule` is a string or absent, the stored slot is this computer's entry for the job, when it has one.
- `--days`: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`, comma-separated, written in that order. Absent with `--at`: every day; absent without `--at`: the stored or default slot's days.
- `--agent`: `claude` or `codex`, the agent the brain is set up with (setup.md §2: the agent running setup; the skills always pass it). Absent while `settings.schedule` isn't an object yet: `claude`, the only agent before 0.17.0 (schema §12); absent while one exists: its `agent`. Given while an object exists, it changes the agent of **every** job: then `--model` is required too, and every other job's entry is installed again with the new agent and model.
- `--model`: the model every run pins (0051, 0110 §9), a full id of that agent's models, never a name that moves. For `claude`, an id starting with `claude-` (`claude-sonnet-5-5`), never an alias (`sonnet`, `opus`) that Claude Code resolves to whatever is current ([Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference): `--model` takes "a model alias such as `sonnet` … or a model's full name"). For `codex`, the model's name as Codex lists it, given explicitly ([Codex CLI options](https://learn.chatgpt.com/docs/developer-commands?surface=cli): `--model`, "Override the configured model for this run"); the CLI can't tell a moving name there, so the skill offers only a full name. Required when the object has no `model`; given while one exists, it changes the model of every job, as `--agent` does. Anything that isn't `^[a-z0-9][a-z0-9.\-]*$`, or a `claude` model without the `claude-` prefix → `USAGE`.
- `--max-budget-usd`: `weekly-review` with agent `claude` only (0.15.0): a positive number, added to the command as `--max-budget-usd <n>`, the hard ceiling of weekly-review.md §10, its default from `settings.weekly.max_usd` (§12 there). It is not stored in `settings.schedule`: `install` with no `--max-budget-usd` reads `settings.weekly.max_usd`. With agent `codex` → `USAGE`: `codex exec` documents no spend limit (checked on 2026-11-20 against [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) and the [CLI options](https://learn.chatgpt.com/docs/developer-commands?surface=cli)), so `install weekly-review` with `codex` warns `NO_SPEND_CEILING`: `Codex has no spend ceiling for a run: the weekly review stops at its own time and judgment budget (settings.weekly).` (weekly-review.md §10).
- `--dry-run`: returns what `install` would write, and writes nothing: neither `settings.schedule` nor an entry.

`install <job>` writes the object first (runner `system`, the agent, the model, the job's slot; the other job's slot kept, or, from a string value or none, read as schema §12 says: this computer's entry for it, else `off`), then installs the entry. When it changes the agent or the model of an existing object, every other job with a slot is installed again with them, and `reinstalled` names their labels (empty otherwise). An entry that fails to install leaves the object written: the choice is the user's and `status` shows the job not installed on this computer (§5.2), so the next `install` installs it.

**`install` with no job** installs this machine's entries for every job the object gives a slot, and removes this brain's entry for a job that is `off` or absent: a reinstall, or the same schedule on another computer. `settings.schedule` that isn't an object (the string `on` or `off`, or absent) → `SCHEDULE_NOT_SET`: `The schedule isn't in the brain yet: say "schedule my brain" to choose its times.` Nothing else is accepted with no job except `--dry-run`, which installs and removes nothing: `removed` then names the entries it would remove.

**`remove <job>`** removes this machine's entry for the job and writes its slot `off` in the object (elsewhere too, where it removes no cron line); when the object then has no slot left it stays, with both jobs `off` (the user declined: setup doesn't ask again, setup.md §7). With no entry it removes nothing (`removed: false`), exit 0. From a string value it removes the entry and writes no object. **`remove --here`** removes every entry of this brain on this computer and leaves `settings.schedule` as it is: for a computer that should no longer run the brain. A brain is meant to be scheduled on **one computer at a time**: installing on a second computer doesn't remove the first's entries, which no command can see, so the skill says so when it installs (CC-371) and offers `remove --here` on the old one.

**`list`** returns `setting` (the object, or the string, or `null`) and this brain's entries on this computer, read back from the scheduler, each with `matches`: whether its agent, model, times and days equal the object's slot for that job (`null` when the setting isn't an object).

**The command each agent runs** (the brain folder is the working directory, §4):

| Agent | Command | What it relies on (checked on 2026-11-20) |
|---|---|---|
| `claude` | `<claude> -p "<prompt>" --model <id>`, plus `--max-budget-usd <n>` for `weekly-review` | "Add the `-p` (or `--print`) flag to any `claude` command to run it non-interactively"; "a call that needs approval is denied unless something approves it" ([headless](https://code.claude.com/docs/en/headless)); `--max-budget-usd`: "Stop the run once estimated spend on API calls reaches this amount (print mode only)" ([CLI reference](https://code.claude.com/docs/en/cli-reference)). No permission flag is added: the run has the tools the brain's `.claude/settings.json` allows, and a tool they don't allow is refused, which the run logs as a failure. The skill offers the allow list when it sets the schedule (CC-64) |
| `codex` | `<codex> exec --model <id> --sandbox workspace-write -c approval_policy=never -c sandbox_workspace_write.network_access=true "<prompt>"` | "By default, `codex exec` runs in a read-only sandbox"; "Allow edits: `codex exec --sandbox workspace-write`"; "`codex exec` reuses saved CLI authentication by default"; "Codex requires commands to run inside a Git repository" ([non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)). `-c`: "Inline configuration override for the non-interactive run (repeatable)" ([CLI options](https://learn.chatgpt.com/docs/developer-commands?surface=cli)); `approval_policy`: "use `on-request` for interactive runs or `never` for non-interactive runs"; `sandbox_workspace_write.network_access`: "Allow outbound network access inside the workspace-write sandbox", which the run's `git push` needs (cli §6.1); "Command-network restrictions do not disable hosted search, MCP, or app tools" ([configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)), so the user's Notion MCP server works either way |

`<claude>` and `<codex>` are the absolute path of the executable found on `PATH` at install time (on Windows `<agent>.exe`, else `<agent>.cmd` in the same folder, the shim an npm install of Claude Code or Codex writes, which `cmd.exe` runs as it runs an `.exe`; none → `AGENT_NOT_FOUND`, which replaces `CLAUDE_NOT_FOUND` and keeps its exit code), because a scheduler's `PATH` is short. `PATH` for the run is the folders of the agent, `node` and `brain` at install time, then the platform's own (`/usr/bin:/bin:/usr/sbin:/sbin`; on Windows the user's `PATH` follows them). Each is made absolute when `PATH` names a relative folder, since launchd, Task Scheduler and cron run from elsewhere. Codex refuses to run outside a Git repository, so `install` with `codex` in a brain folder that is not a Git working tree → `BRAIN_NOT_GIT` (a brain from `brain init` always is one).

**What folder trust means for each agent.**
- **Claude Code** (0.15.0): "`permissions.allow` rules … in a project's `.claude/settings.json` grant capability, so Claude Code applies them only after you accept the workspace trust dialog for that folder", and "Claude Code shows the trust dialog in interactive terminal sessions, but not in `claude -p`" ([permissions](https://code.claude.com/docs/en/permissions)). A `-p` run in a folder never trusted therefore has none of the brain's allow rules. `install` with `claude`, for every job (and with `--dry-run`, on every platform), warns `FOLDER_TRUST`: `Open Claude Code in <brain> once and accept the trust dialog, or the scheduled run can't use the brain's allow rules.` The CLI doesn't read Claude Code's own settings to tell whether that happened. The skills' schedule sections pass the step on (brain-catch-up, brain-weekly-review).
- **Codex:** "Untrusted projects skip project-scoped `.codex/` layers, including project-local config, hooks, and rules", and "Local `codex exec` … runs load project configuration and project-defined MCP servers only for trusted projects" ([configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference), [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)). A brain has no `.codex/` layer: the run's sandbox, approvals and network come from the command above, and its Notion MCP server from the user's own Codex configuration. So trust changes nothing for a scheduled Codex run: `install` adds no `--trust` and gives no `FOLDER_TRUST` warning. A brain that gains a `.codex/` layer later is a new decision.

**The label** names the entry for this brain and job: `eu.ultimate-brain.<folder>-<hash>.<job>`, where `<folder>` is the brain folder's name as a slug (§3.8) and `<hash>` the first 8 hex characters of the SHA-256 of its absolute path, so two brains never share an entry. Every entry also holds, as a JSON string, `{ "brain", "job", "times", "days", "agent", "model", "prompt" }`, which `list` reads back (an entry from before 0.17.0 has no `agent`: it is read as `claude`).

**On macOS** (`process.platform` = `darwin`), the entry is a launchd agent at `<agents>/<label>.plist`, where `<agents>` is `~/Library/LaunchAgents`, or `UB_LAUNCH_AGENTS_DIR` when set (tests):
- `Label`; `ProgramArguments` = the agent's command above, as a list; `WorkingDirectory` = the brain; `EnvironmentVariables` = `{ "PATH": … }`; `StartCalendarInterval` = one `{ Hour, Minute }` per time, or, with days, one `{ Hour, Minute, Weekday }` per time and day (`Weekday` 0 = Sunday … 6 = Saturday), in the order times, then days; `StandardOutPath` and `StandardErrorPath` = `~/Library/Logs/ultimate-brain/<label>.log` (its folder created); `RunAtLoad` = false.
- The `ultimate-brain` key holds the JSON string above.
- It then loads the agent: `launchctl bootout gui/<uid>/<label>` (its failure ignored: nothing was loaded), then `launchctl bootstrap gui/<uid> <plist>`. With `UB_LAUNCH_AGENTS_DIR` set, `launchctl` is never called. A failed `bootstrap` leaves the file and warns `SCHEDULE_NOT_LOADED` with launchctl's message.
- A second `install` for the same brain and job replaces the file (`replaced: true`). `remove` unloads (`launchctl bootout`, failure ignored; never with `UB_LAUNCH_AGENTS_DIR`) and deletes the file. `list` reads each `<agents>/eu.ultimate-brain.<folder>-<hash>.*.plist`, sorted by job.

**On Windows** (`process.platform` = `win32`; 0.17.0, 0110 §9, amending 0097 §4), the entry is a Task Scheduler task named `<label>` in the root folder, registered for the user who runs `install`, from a task XML of the Task Scheduler schema:
- `RegistrationInfo/Description` = `ultimate-brain:` and the JSON string above.
- `Principals/Principal`: `UserId` = the user running `install` (`<USERDOMAIN>\<USERNAME>`), **`LogonType` `InteractiveToken`** ("User must already be logged on. The task will be run only in an existing interactive session", [TASK_LOGON_TYPE](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/ne-taskschd-task_logon_type)), `RunLevel` `LeastPrivilege`. No password is stored: "you do not need to specify a password when registering the task if you register the task to run under the security context of your account and you use the S4U or interactive logon type" ([security contexts](https://learn.microsoft.com/en-us/windows/win32/taskschd/security-contexts-for-running-tasks)).
- `Triggers`: one `CalendarTrigger` per time, `StartBoundary` = the install date at that local time, with no offset (`2026-11-23T07:30:00`), and `ScheduleByDay` with `DaysInterval` 1 for every day, or `ScheduleByWeek` with `WeeksInterval` 1 and `DaysOfWeek` holding the days (`<Monday/>` …) ([ScheduleByWeek](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-schedulebyweek-calendartriggertype-element)).
- `Settings`: **`WakeToRun` true** ("the Task Scheduler will wake the computer when it is time to run the task", [WakeToRun](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-waketorun)); **`StartWhenAvailable` true** ("Task Scheduler can start the task at any time after its scheduled time has passed"; such a start is queued and "started after a delay. The default delay is 10 minutes", [StartWhenAvailable](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable)); `DisallowStartIfOnBatteries` false and `StopIfGoingOnBatteries` false, whose defaults are True ([DisallowStartIfOnBatteries](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-disallowstartifonbatteries), [StopIfGoingOnBatteries](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-stopifgoingonbatteries)), so a laptop on battery runs it as a Mac does; `ExecutionTimeLimit` `PT2H` (the default is 72 hours, [ExecutionTimeLimit](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-executiontimelimit); 2 hours is when `status` calls a weekly run unfinished, weekly-review.md §9.5); `MultipleInstancesPolicy` `IgnoreNew`; `Enabled` true.
- `Actions/Exec`: `Command` = `%SystemRoot%\System32\cmd.exe`; `Arguments` = `/d /s /c "set "PATH=<folders>;%PATH%" && "<agent>" <arguments> >> "<log>" 2>&1"`, where `<agent> <arguments>` is the agent's command above with each argument in double quotes and `<log>` is `%LOCALAPPDATA%\ultimate-brain\logs\<label>.log` (its folder created at install), so the run's last line is kept as launchd's log keeps it; `WorkingDirectory` = the brain.
- It is registered with PowerShell's ScheduledTasks module, `powershell.exe -NoProfile -NonInteractive -EncodedCommand` (the script in UTF-16LE, base64-encoded, so the XML's double quotes reach PowerShell intact through Windows' command line, [about_PowerShell_exe](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe)) running `Register-ScheduledTask -TaskName '<label>' -Xml <the XML> -Force` ([Register-ScheduledTask](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/register-scheduledtask)). Not `schtasks /create /xml`: its page says "Only Administrators can schedule tasks, regardless of the value of the **/ru** parameter" ([schtasks create](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create)), while the security-contexts page above lets a standard user register a task for themselves with the interactive logon type; the two pages don't agree, so U-43 runs `install` on a standard account. `-Force` replaces an existing task (`replaced: true`). A failed registration writes no entry and warns `SCHEDULE_NOT_LOADED` with PowerShell's message (`written: false`, `loaded: false`).
- **The local copy.** After a successful registration, the XML is also written to `<tasks>/<label>.xml`, where `<tasks>` is `%LOCALAPPDATA%\ultimate-brain\tasks`, or `UB_WINDOWS_TASKS_DIR` when set (tests): `brain status` reads these copies, offline and without starting PowerShell (§5.2). With `UB_WINDOWS_TASKS_DIR` set, PowerShell is never called and the copy is the entry, as `UB_LAUNCH_AGENTS_DIR` is on macOS.
- `remove` runs `Unregister-ScheduledTask -TaskName '<label>' -Confirm:$false` (its failure for a missing task ignored) and deletes the copy; `removed` is `true` when the task or its copy existed. `list` runs `Get-ScheduledTask -TaskName 'eu.ultimate-brain.<folder>-<hash>.*'` and reads each task's Description, sorted by job, each with its copy's path as `path`; with `UB_WINDOWS_TASKS_DIR` set it reads the copies instead; a task deleted in Task Scheduler's own window is therefore missing from `list` while its copy still says installed in `status` until the next `install` or `remove`.

**Elsewhere** (`UB_SCHEDULE_PLATFORM` overrides `process.platform` in tests: `darwin`, `win32` or any other value), `install` writes no entry and returns one cron line per time (with days, the days in cron's numbering on the same line), for the user to add with `crontab -e`, as 0051 has it:

```text
30 7 * * * mkdir -p "$HOME/.ultimate-brain/logs" && cd '/Users/alex/brain' && PATH='…' '/usr/local/bin/claude' -p 'catch up unattended' --model claude-sonnet-5-5 >> "$HOME/.ultimate-brain/logs/eu.ultimate-brain.brain-3f9a2c1d.catch-up.log" 2>&1
```

The line creates its log folder first, so it runs on a machine where it doesn't exist yet. Paths are single-quoted, with `'` written as `'\''`; a Codex line has the `codex exec` command of the table. `list` and `remove` manage no cron lines: they return no entries and `removed: false` with the warning `SCHEDULE_NOT_MANAGED` ("cron lines are yours: crontab -l"); `install` still writes `settings.schedule`.

**When the computer is asleep, off or logged out** (0110 §9, 0104 §7; checked on 2026-11-20 against the pages linked here):

| At the scheduled time | macOS (launchd) | Windows (Task Scheduler, the settings above) |
|---|---|---|
| asleep | runs when the Mac wakes; several missed times run once: "launchd will start the job the next time the computer wakes up. If multiple intervals transpire before the computer is woken, those events will be coalesced into one event upon wake from sleep" ([launchd.plist(5)](https://keith.github.io/xcode-man-pages/launchd.plist.5.html); [Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)). launchd doesn't wake the Mac: none of Apple's pages says it does | the computer is woken and the task runs (`WakeToRun`) |
| off | skipped until the next scheduled time: "if the machine is off when the job should have run, the job does not execute until the next designated time occurs" ([Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)) | runs after the computer is next on and the user logged on, about 10 minutes later (`StartWhenAvailable`). Microsoft's page adds that the setting "applies only to time-based tasks with an end boundary or time-based tasks that are set to repeat infinitely" and doesn't say whether a daily or weekly calendar trigger is one: U-43 checks it by turning the computer off over a slot |
| user logged out | not run: a user agent "executes only while that user is logged in" ([Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)) | not run (`InteractiveToken`). That it then starts once the user logs on is read from `StartWhenAvailable`, not stated by Microsoft: U-43 checks it |

The differences and how each is closed are listed in weekly-review.md §11.1.

**Output.**

```sh
brain schedule install catch-up --at 07:30 --agent codex --model gpt-5.2-codex --json
```
```json
{ "data": {
    "job": "catch-up", "label": "eu.ultimate-brain.brain-3f9a2c1d.catch-up", "platform": "win32",
    "path": "C:\\Users\\alex\\AppData\\Local\\ultimate-brain\\tasks\\eu.ultimate-brain.brain-3f9a2c1d.catch-up.xml",
    "times": ["07:30"], "days": null, "agent": "codex", "model": "gpt-5.2-codex",
    "prompt": "catch up unattended", "command": ["C:\\Users\\alex\\AppData\\Local\\codex\\codex.exe", "exec", "--model", "gpt-5.2-codex", "--sandbox", "workspace-write", "-c", "approval_policy=never", "-c", "sandbox_workspace_write.network_access=true", "catch up unattended"],
    "setting": { "runner": "system", "agent": "codex", "model": "gpt-5.2-codex", "catch_up": { "at": ["07:30"] }, "weekly_review": "off" },
    "setting_written": true, "written": true, "replaced": false, "loaded": true, "cron": null, "dry_run": false
} }
```

`path` is the plist on macOS, the local copy on Windows and `null` elsewhere; elsewhere `written` and `loaded` are `false` and `cron` is the list of lines; with `UB_LAUNCH_AGENTS_DIR` or `UB_WINDOWS_TASKS_DIR` set, `loaded` is `false`, since nothing is loaded. `setting` is `settings.schedule` after the command; `setting_written` is `false` with `--dry-run`, and in each object of `install` with no job, which writes no setting. `install <job>` also returns `reinstalled` (above). `install` with no job → `{ "installed": [ <one object as above per job with a slot> ], "removed": [ <label>… ], "setting" }`. `list` → `{ "setting", "schedules": [ { "job", "label", "path", "times", "days", "agent", "model", "prompt", "matches" } ] }` (`days` `null` for every day). `remove` → `{ "job", "label", "path", "removed", "setting" }`; `remove --here` → `{ "removed": [ <label>… ], "setting" }`. The model ids in examples are illustrative.

Errors: `USAGE` (unknown job, a time that isn't `HH:MM` from 00:00 to 23:59, an unknown day, a missing `--model` that the object doesn't supply, `--agent` changed without `--model`, a moving or malformed model, `--max-budget-usd` with `codex` or on `catch-up`, `remove` with neither a job nor `--here`), `AGENT_NOT_FOUND`, `BRAIN_NOT_GIT`, `SCHEDULE_NOT_SET`, `SKILL_MISSING`, `BRAIN_CONFIG_INVALID` (the object written would fail the schema), `OUTSIDE_ROOT` (a plist, task copy or log path that is a symbolic link, or that resolves inside the brain, symbolic links followed: a schedule writes nothing there). Warnings: `FOLDER_TRUST`, `NO_SPEND_CEILING`, `SCHEDULE_NOT_LOADED`, `SCHEDULE_NOT_MANAGED`.

---


### 5.22 `brain source extract-plan` (0055, 0062)

```text
brain source extract-plan --page <notion-page-id> --summary <file> --transcript <file> [--previous <src-id>] [--json]
```

Read-only; writes nothing. Reads a summary (the subjects, tokens and items of capture-and-review §4.1; `\r\n` is read as `\n`) and the transcript of the input named by `--page` (the Notion page id; `--previous` is validated against it, and the sources of that page are looked up for `PREVIOUS_REQUIRED`), and computes the extract of capture-and-review §4.2 to §4.7 without AI: anchors are mapped to numbered paragraphs by exact substring match after whitespace normalization, effective selections are resolved, and the fail-closed copy rule decides which paragraphs enter. The extract is **not** written with `note new`: `brain source extract` (§5.23) writes it, its suppression record and the regenerated views in one journaled operation.

`data` = `{ ok, write_required, transcript_hash, selection: [{id, effective, explicit}], problems: [{code, id, reason, with?}], passages: [{n, hash, items}], copied: [{n, text, items}], unnumbered: [{subject, text}], uncovered, quotes: [{item, anchor, result, stretches?, reason}], unplaced_items: [<item id>], quick: [{subject, id, text, done}], scopes: [{item, done_when, due, project, notes, problems}], body, previous? }`, with `shape` and `items` added for the lean shape (below). `ok` is false when any problem other than `DEPENDS_ON_EXCLUDED`, `NO_QUOTE_ENTRY`, `ORPHAN_QUOTE_ENTRY` or `DUPLICATE_FOLLOW_UP` exists (`SELECTION_UNREADABLE`, `SELECTION_UNMAPPABLE`, `UNNUMBERED_LINE`); then `body` is `null` and **nothing may be written**, never a full-transcript fallback. Every list line without an id outside a Quick follow-ups group is both in `unnumbered` and a problem `UNNUMBERED_LINE`, because it can neither be selected nor excluded and could leak through a shared paragraph (capture-and-review §4.2). `copied` holds the full text of each paragraph for the attended preview. **Decision 0067** adds four lists that never make `ok` false: `quotes`, an included item's anchors placed by a stretch (`result: "shortened"`, with `stretches`) or not placed (`result: "unplaced"`, with the reason; an included item with no quote is listed once with `anchor: null`), and `unplaced_items`, the included items with no placed anchor, which are not imported (capture-and-review §4.2 rules 2 and 3; an excluded item's anchor still blocks, rule 4); `quick`, the quick follow-up lines (`id` null unless the line carried one; `done` true for a ticked to-do), never imported (one with an id whose effective selection is `meeting only` is also an excluded item of `selection`, fail closed); `scopes`, each Scope toggle's fields (`due` a `YYYY-MM-DD` or null; absent fields null; `item` null for a Scope with no item line above it) and its `problems` as plain sentences (capture-and-review §4.1). Other quick lines are not items of the plan.

**Decision 0079: the lean shape** (capture-and-review §3.3, §4.1, §6.3). `extract-plan` first decides the summary's shape (capture-and-review §4.1, "Shapes"). For the inline-quote shape `data` is exactly as above, key for key and value for value, as before 0.14.0. For the lean shape the items are read by "The lean shape" (each readable line joined to its quote entry by id), and `data` adds:
- `shape`: `"lean"` (absent for the other shapes);
- `items`: `[{ id, subject, place, prefix, name, track, text, anchors, depends_on }]`, one per readable item line, in page order. `subject` is the subject its id names (null for `s0`); `place` is `"tasks"` (the Tasks for the brain group) or `"subject"` (its subject's block); `prefix` is `"decided"`, `"open"`, `"concern"`, `"waiting_on"`, `"idea"` or null; `name` is the `<name>` of a `Waiting on <name>:` prefix, else null; `track` is true when the line carries `Track: Waiting On —`; `text` is the readable line's text (without its marker, Track token and tag, the prefix kept); `anchors` are the quotes of its quote entry (`[]` with none); `depends_on` is the ids of its entry's `depends on`. An orphan quote entry has no `items` entry;
- in each `quick` entry, `follow_up` (its `q` id, or null), `task` and `recorded`. `task` is true when the line is a follow-up (a to-do with a `q` id), unticked, with non-empty text, its `q` id on no other to-do of the group, and, with `--previous`, its `q` id is not a key of `task_items` on any source along the `replaces` chain of `--previous`; `recorded` is that Task's page id when it is, else null. `task` does not depend on `ok`, the Tasks module or any selection: the skill acts on it only for an input it ingests (capture-and-review §6.3);
- three problems that never make `ok` false: `NO_QUOTE_ENTRY` (`id`: the item; a readable line with no quote entry), `ORPHAN_QUOTE_ENTRY` (`id`: the item; a quote entry with no readable line) and `DUPLICATE_FOLLOW_UP` (`id`: the `q` id; on two to-dos of the group). Their consequences are capture-and-review §4.1's: an item with no quote entry is in `quotes` (`anchor: null`) and `unplaced_items` when it is included, and also `SELECTION_UNMAPPABLE` when it is excluded; an orphan entry whose effective selection is `meeting only` is an excluded item of `selection`.

The other keys keep their meaning in the lean shape: `selection` holds the subjects and the items (orphan entries effectively `meeting only` included), with each item's effective selection read from the toggle; `quotes`, `passages` and `copied` come from the quote entries' anchors; `unnumbered` holds the lean shape's unnumbered lines; `scopes` the Scope toggles under Tasks for the brain lines. A summary with no id and no For the brain toggle (a legacy summary) is not passed to `extract-plan` (the ingest stores it whole); passed anyway, it is read as before. In every shape a Markdown escape is removed before the summary is read (capture-and-review §4.3: `\[s1.i1\]` is `[s1.i1]`), so a summary read through the Notion API's markdown export gives the same `data` as the same summary with no escape.

With `--previous <src-id>`, `previous` = `{ id, kind, version, transcript_changed, suppressed, added, selection_changes, full_copies, legacy_tasks }`. `legacy_tasks` (for any `--previous`) = the Task page ids along the `replaces` chain that are **not** mapped by a `task_items` entry whose item id is an item of the **current** plan or whose key is a `q` id (a follow-up's Task is always mapped, capture-and-review §6.3): Tasks of a full copy, and Tasks whose item id no longer exists after the summary was regenerated. `--previous` must be the **latest** source of the input: an extract of `--page` that nothing replaces, or, for an input ingested in full before selection, its latest **non-extract** source with `source_key` `notion:<page>` that nothing replaces and when no extract of that page exists. **Full copy (`kind: "full"`):** a full copy holds no paragraph identities, so `suppressed` is empty, `added` is every paragraph of the new plan, `transcript_changed` is false, `full_copies` lists that source and its older versions along `replaces`, and `legacy_tasks` lists the Notion task page ids in the `tasks` of those sources (they have no item ids). Comparison is by **passages only**, the one thing a stored extract holds (capture-and-review §4.8): if the new `transcript_hash` differs, `transcript_changed` is true, `suppressed` lists every paragraph of the previous version and `added` every paragraph of the new plan (no passage identity carries over); `added` = every paragraph of the new plan; otherwise `suppressed` = paragraphs in the previous version and not in the new plan, `added` = paragraphs only in the new plan. `selection_changes` = `[{id, from, to}]` for the ids whose effective selection differs from the stored `selection` (for the preview only). `write_required` is true when a version must be written: for an extract `--previous` when `suppressed` or `added` is not empty, **or when the item ids or the passages of any item differ from the stored `selection` and `passages`** (a regenerated summary with unchanged paragraphs; capture-and-review §4.8), and for a **full copy always**, even when every item is excluded and `suppressed` and `added` are both empty. A plan with `write_required` false is `UNCHANGED`. `INPUT_INVALID` for an unreadable file, a `--previous` that is not the latest source of `--page` (`NOT_LATEST`, `WRONG_INPUT`) or a full copy when an extract of the page exists; `UNKNOWN_ID` for a missing id.

### 5.23 `brain source extract` (0055, 0062)

```text
brain source extract --page <notion-page-id> --title <text> --date <YYYY-MM-DD> --summary <file> --transcript <file> [--kind minutes|capture] [--previous <src-id>] [--dry-run] [--json]
```

The only writer of an extract. **Identity:** `--page` is the Notion page id of the full input; it gives `extract_of`, the `source_key` `notion:<id>` and the file name `_suppressions/<id>.json`; `--title`, `--date` and `--kind` (default `minutes`) fill the source's title, file date and kind; `captured` is `--now`, `content_hash` is computed from the body. **First version:** without `--previous`, `extract_version` is 1 and no `replaces`, **only when no source belongs to the input**. If any source has `extract_of` = `--page` or `source_key` = `notion:<page>`, omitting `--previous` stops with `INPUT_INVALID` (`PREVIOUS_REQUIRED`, naming that source): the command fails closed rather than create an unlinked version. **An input already ingested in full:** `--previous` names the latest **non-extract** source of that page (the full copy). Then the new extract is version 1 with `replaces` = that source, and, fail closed, the suppression record is written `active` with `passages: []` and `full_copies: [<that source id and its older versions>]`: a full copy holds no paragraph identities, so every claim resting on it is restricted (capture-and-review §5.1, an entry of a changed input with no live passage reference) until the cleanup row (§5.2) is decided, note by note. The cost is a cleanup row for the first selection on an already ingested input; the cleanup row says which claims have independent support. **Later versions:** `--previous` is validated as in §5.22; otherwise `INPUT_INVALID` (`NOT_LATEST` or `WRONG_INPUT`). It runs `extract-plan` (§5.22) and, when `ok` is true and `write_required` (§5.22; always for a full-copy `--previous`, and for a first version), performs **one journaled operation** (capture-and-review §7.11). **When it writes:** for an extract `--previous`, only if `write_required` (§5.22; `UNCHANGED` otherwise); a version whose body equals the previous one is allowed here, so the `DUPLICATE_SOURCE` content check of §5.5 does not apply to extract versions; for a full-copy `--previous`, **always** (the full copy has no passages to compare). **The suppression record** `_suppressions/<input>.json` is an **append-only list** `{ input, records: [ { version, passages, full_copies, written, status } ] }`: a write that suppresses something **appends** a record for its version (`suppressed` not empty, or a full-copy transition); a mapping-only or addition-only version appends none; an earlier record is never removed, so a later write cannot release an earlier unresolved exclusion. A record's `input`, `version`, `passages` and `full_copies` are never edited; the only permitted change is its `status`, `active` to `reconciled` (with `reconciled_at`), written by the cleanup apply. A record is appended exactly when `suppressed` is not empty, or for a full copy (with `passages: []` and `full_copies`). Each record is `active` until its own cleanup items are resolved (capture-and-review §5.3); a restriction holds while **any** record is active. The same list also holds **Restore records** `{ kind: "restore", extract_version, items: [{ note, n }], written }`, appended by the cleanup apply (CC-79) when the user accepts the Restore of one claim; a passage that a later version holds again stays restricted for **each claim** (a note and a passage) until a Restore record for that version names that note and passage, so restoring one claim never releases another claim on the same paragraph. The new version also **carries `task_items` forward** from the version it replaces. It writes a journal entry first, then stages in the workspace checkpoint the new `source` (`extract: true`, `extract_of`, `extract_version` = previous + 1 with `replaces` = the previous version, the fields of schema §4), the suppression record `_suppressions/<input>.json` (appended exactly when `suppressed` is not empty or for a full-copy transition, with `status: active`) and the regenerated views, flushes them together, **commits to Git with the trailer `Op: <op-id>`** (capture-and-review §7.11), and only then removes the journal. If any part fails, the checkpoint is restored and nothing is committed; if the process stops between file writes the journal remains, every other command refuses with `RECOVERY_NEEDED` until `brain recover` completes or rolls back the operation (fail closed: older evidence stays restricted). A retry recomputes from the same latest version, so it writes a version once. Same `ok`/`problems` rules as §5.22: a blocked input writes nothing. `--dry-run` returns what would be written. `data` = `{ created: [<src id>], suppression: <path>|null, views: [<path>], version }`; `UNCHANGED` (no write) when `write_required` is false.

**The lean shape (0079)** changes nothing here: `extract` reads the summary through `extract-plan`, so the same shape rules and blockers apply, and it writes the same source fields. Neither the readable text nor a follow-up is written: the extract holds the selected paragraphs only. `task_items` is carried forward whole, its `q` keys (capture-and-review §6.3) with its item keys.
## 6. Standard sequences (for skills)

| Flow | Sequence |
|---|---|
| **Ingest one meeting** (CC-06) | `status` → `index` (JSON, for matching) → `note new --dry-run` with the source (check `DUPLICATE_SOURCE`; a meeting set back to Ready after an ingest is a re-read: the source gets `replaces`, then `source diff`, and only the changed lines are extracted, 0045) → `id new` for the new notes → `note new` (source, meeting, people, decisions, questions) → the preview and its yes (capture-and-review §4.4, §7.3) → `proposal new` (one `review_notes` for the source, which takes in its `add_link` and `add_to_note` items and its `update_fact` items with no `before`; each other change its own proposal, 0041, 0043, 0045, 0096) → attended: the flags asked, `apply` of the `review_notes` with `decided_by: chat` (its notes become `reviewed`), then the asked changes in rounds (capture-and-review §7.3, §7.5) → `index` → `views` → `lint` → `log ingest <mtg> created=… proposals=… tasks=…` → `git commit` → `sync tasks` + MCP → `sync render --changed` + MCP → `sync record` → `git commit` |
| **Ingest a document, email, chat, note or capture** (0032, 0037) | as above, with the source's own procedure (brain-ingest `sources.md`); the source records the row's Project, Area and Only keep (0049, 0050); with Keep as document, the same batch writes a `whole` reference (Only keep empty), one per attached file when the row has files (0049); with Only keep set, or a change asked before it goes in, the source alone is written and the changed text goes to a checked row instead (`source check`, §5.35; capture-and-review §12, 0098 §4), taken in on "go" or when set Ready; owner action items → `sync tasks --source` + MCP; the source is published to the Inbox by `sync render --changed` |
| **Catch up** (0037, 0041–0043, 0045, 0048, 0049) | read-only pass (`status` for the modules; MCP reads of Meetings, the Inbox's **Ready** rows, with Reports on the Ask rows and the Report rows (Documents, 0071) with Refresh asked ticked or a What to fix, and the Inbox rows with Keep as document ticked, the checked rows (Changed from set, no Brain ID, §5.35), with Tasks on and `document_asked` mapped the Tasks rows with Document asked ticked (§5.14.1), and from 0.18.0 the unfinished tasks with a Project or a Factory and no Area (§5.14.1); `sync plan`; drop-folder listing, asking for each file "keep as document? no / all / only …" (from 0.17.0, a transcript file of capture-and-review §3.4.3, or one the user marks "meeting", becomes a Meetings row: `minutes row` + MCP + `log meeting-file`); from 0.17.0 the New meetings with a transcript and no minutes, offered (capture-and-review §3.4.2); `repo changes` per linked repo; attachments on the Ready rows and Ready meetings; from 0.17.0 the to-dos and Your note lines of each **Ready Weekly row**, weekly-review.md §15.4; one batch of questions) → `proposal backlog` → `sync apply` of the plan → from 0.17.0 `cleanup ticks --attended` per Ready Weekly row (§5.38), its notes asked with the batch's questions, its Notion writes made through the MCP and settled → from 0.17.0, for each meeting the user said yes to, the minutes written after `minutes check` + MCP + `log minutes-written` → **Ingest one meeting** for each Ready meeting → **Ingest a …** for each Ready Inbox row, each attachment, each chosen drop-folder file and each changed repo file, then `repo record` → `note new` per `document_requests` (a `whole` reference; with Only keep, a checked row of the part, §5.35) and per `task_documents` (the `task` source and its `whole` Document, then the From the brain question, capture-and-review §13), then the boxes unticked through the MCP → with Reports on, `report new` with `refresh` per `refresh_requests`, `proposal new` + `report fix` per `report_fixes`, **Report** for each new Ask row → `views` → `sync render --changed` + MCP → `sync record` → from 0.18.0 the Area of each `task_areas` item + MCP (§5.14.2), when the run publishes → commit → from 0.18.0 with Factories on, per Factory that isn't archived: `factory read` (with `--issues` when its tasks are issues) → when `changed`, the Plan sentences → `factory overview` + MCP (the Overview toggle and Overview as of) → `factory overview --written` (§5.39, connected-workflows.md §9.1); it takes the place of `repo tasks` and its toggle, which run only with Factories off → push per `settings.push` → `log catch-up - notes_read=<n> seconds=<s>` (0045) → the session's questions: this run's first, then a round of the waiting ones (`proposal list --waiting`, capture-and-review §7.5). Steps of a module that is off are skipped, and so are its questions (0048) |
| **Catch up unattended** (0051) | as **Catch up**, with no batch of questions: each takes its default or skips its input, within a budget of inputs, publishing only with `settings.publish: auto`; nothing written when nothing waits. §6.1 |
| **Report** (0043) | `query --candidates` and the notes → the skill writes the six sections → `report new` → commit → `sync render --changed` + MCP (the Report row; the Ask row's Brain Status set to Done) → `sync record` → commit |
| **What needs my decision** (CC-09; 0096) | `proposal list --waiting` → a round of at most five questions, in its order → `apply` with `decided_by: chat`, `note` = the user's words, `fixes` or `exclude` as they answered (capture-and-review §7.5, §7.6) → "more": the next round → `index` → `views` → `lint` → commit → `sync render --changed` + MCP → `sync record` → commit. The one apply flow |
| **Sync** (CC-08) | as §5.14 |
| **Query** (CC-10) | `query --candidates` → read the top notes → answer with citations → `log query - notes_read=<n> seconds=<s>` (0045) |
| **Reflect** (0052, 0076) | `status` → `reflect --candidates` → the skill judges each cluster → the report, 10 findings at a time → per answer: yes (`proposal new` + `apply`, decided in chat), later (`proposal new`, left pending for a session), skip (`proposal new` + `apply` reject) → `index` → `views` → `lint` → commit → at the end, `sync render --changed` + MCP → `sync record` → commit → `log reflect …`. Attended only. §6.2 |
| **Weekly review** (0075, 0093, 0110) | `status` → Notion read (with the brain's Weekly rows and their Brain Status) → `weekly plan` → quiet: stop, nothing written → attempt marker → from 0.17.0, with `settings.cleanup.auto` on, `cleanup apply` (§5.38: each mechanical item its own commit) → the skill judges clusters and correction targets within the budget → `weekly select` → `proposal new` (all pending, none published) → `weekly record` → `index` → `views` → `lint` → commit → per [weekly-review.md](weekly-review.md) §9.3, `sync render --changed` + MCP (the week's Inbox row, Kind Weekly, §5.34, with `--row-state`; and an earlier row whose items moved) → `sync record` → commit → push. Applies nothing but the mechanical items of weekly-review.md §15.2, asks nothing unattended. [weekly-review.md](weekly-review.md) §1 |

A run never leaves lint errors it introduced: if `lint` reports new errors after a write, the skill stops before committing and reports them.

### 6.1 Catch up unattended (0051)

The skill brain-catch-up, started by the prompt `catch up unattended` (a schedule, §5.21, or the user by hand). It is **Catch up** above, in one turn, with nobody to ask: the read-only pass runs as usual, then each question of the batch takes its default or skips its input, and the run goes on. It applies the user's explicit decisions, interprets no text the user wrote, and decides nothing itself (0003 as amended by 0051). From 0.17.0 those decisions include the **plain ticks of a Ready Weekly row** (0110 §4: a tick is the user's explicit decision, word for word; below). The 5-minute bar (0043) doesn't apply; the budget does.

**The one authority (assessment finding F-0007).** This section is the only place that says what an unattended run does. Its three tables below cover every question of the batch, every kind of Notion edit, and every selected input, proposal and module case of capture-and-review §4 to §8 (that file's §8 points here). The unattended tables in the skills (brain-catch-up's "One batch of questions" and its references) are renderings of these: where one differs, this section governs and the skill is corrected in the fork. A case none of the tables names is treated as a question with no default: the run skips that input and names it under Needs you.

**Reflection runs attended only** (0076 §5): `catch up unattended` never runs brain-reflect, and no table here has a reflection row. The weekly review (0.15.0, [weekly-review.md](weekly-review.md)) is its scheduled run: a separate job and skill that ingests nothing and applies nothing but its mechanical clean-up (0.17.0, weekly-review.md §15.2), so this section is unchanged by it (0075 §6), except that a catch-up reads a Ready Weekly row for its ticks (below).

**Off the working branch (0086 §2).** The run's first command is `brain status`. When its `branch` has `on_working` `false` (another branch checked out, a detached `HEAD`) or `working` `null` (§5.2), the run stops there: no read, no Notion call, no commit, no push and no log line, nothing written in the brain or in Notion. Its last line of output, which the scheduler's log keeps (§5.21), is `Not run: off-working-branch. The brain is not on its working branch; say "fix my backup" in a session in the brain.`, with `off-working-branch` the reason. The next attended session sees the warning `BRAIN_OFF_WORKING_BRANCH` in `status` and offers the fix (setup.md §15). A branch with commits the working branch lacks, while the brain is on its working branch (`unmerged` alone), doesn't stop the run: its writes land on the working branch, and the warning waits for the attended session.

**Sequence.** read-only pass (as **Catch up**; a failed read, such as an expired Notion login, is a failure: the parts that need it are skipped, the rest goes on) → if nothing is waiting (a Ready Weekly row with an item not yet decided counts, 0.17.0; so does a `task_areas` item with `settings.publish: auto`, 0.18.0; a `task_areas_unset` item does not; so does a Factory whose overview would be rewritten, with `publish: auto`, 0.18.0) and nothing failed, stop: **no commit, no Notion call, no log line** → `proposal backlog` → `sync apply --input plan.json --skip-conflicted` (without `--record-only`) → from 0.17.0 `cleanup ticks` (without `--attended`) per Ready Weekly row, then `index`, `views`, `lint` and a commit, with `settings.publish: auto` its Notion writes through the MCP and `proposal settle` → the inputs within the budget, oldest first, each as **Ingest one meeting** or **Ingest a …** → `note new` per `document_requests` → with Reports on, `report new` with `refresh` per report to refresh (the table below: `refresh_requests` and the reports whose fixes are all decided; none for a report with a `report_fixes` item) and **Report** per Ask row → `views` → with `settings.publish: auto`, `sync render --changed --plan plan.json --skip-conflicted` + MCP → `sync record` → commit, and the boxes cleared → with Reports on and something for the user (below), the Report row → `log catch-up - mode=unattended …` (§3.9) → commit → push per `settings.push`.

**Every question of the batch** (brain-catch-up, "One batch of questions"):

| Question | Unattended |
|---|---|
| A sync conflict (`BOTH_CHANGED`, `MISSING_REQUIRED`, `UNRESOLVED_RELATION`, `UNKNOWN_BRAIN_ID`, `NOTION_ID_MISMATCH`, `REQUIRED_EMPTY`) | **skip** the whole row, in and out: `sync apply --skip-conflicted` leaves its corrections unwritten and its updates and decisions unapplied, and `sync render --plan … --skip-conflicted` publishes nothing to it (both `ROW_CONFLICTED`), and the skill drops any `document_requests`, `refresh_requests` or `report_fixes` item with that `page_id`; named under Needs you |
| A meeting's pre-check blocker | **skip** the meeting: it stays Ready |
| An Inbox row's pre-check blocker | **skip** the row: it stays Ready, with its attachments |
| A capture that repeats a source the brain has | **default**: skipped, set to Done with "Skipped: same as <title>" when the run publishes; without a publish it stays Ready and is skipped again |
| "Which parts matter?" for a long attachment (on a Ready row or a Ready meeting) | **skip** the row or meeting whole, with its attachments: it stays Ready |
| A likely new version (of a meeting, a row or a file) | **skip** the input: it waits in its place (the meeting or the row Ready, the file in the queue) |
| The session's questions (`proposal list --waiting`, capture-and-review §7.5) | **default**: none asked; every proposal is left pending, asked at the next attended session |
| No `Drop folder:` line in AGENTS.md (the path question, and the offer to add the line) | **skip** the drop folder; Needs you says "Drop folder not set: say where it is" |
| The drop-folder list, and "keep as document?" | **default**: every readable file taken, none kept as a document; a file already in the brain, or the same file as another, moved to `processed/` as attended; a file that can't be read stays, named under Check |
| "Which parts matter?" for a long drop-folder file (sources.md, "The drop folder", step 2) | **skip** the file: it stays in the queue |
| A transcript file in the drop folder (0.17.0, capture-and-review §3.4.3: `meetings/`, or a `.vtt` or `.srt`) | with `settings.publish: auto`: its Meetings row **made** (`minutes row`, §5.37), the file moved to `processed/`, then its minutes as for any meeting with a transcript and no minutes; not an input. With `publish: ask`: the file stays in the queue, named under Needs you. Marking another file "meeting" is attended only |
| Attachments | **default**: all of them |
| A linked repo with more than 10 changed files (which to take, and whether the rest is skipped for good) | **default**: all of them, none skipped for good; the budget takes the oldest that fit, and the repo gets no `repo record` until every listed file is in (budget, below). This replaces sources.md's "never run it unattended" for this run (CC-64 updates sources.md) |
| *(Reports)* An Ask row: "Report on …?" | **default**: yes, a new report |
| *(Reports)* A Report row to refresh: Refresh asked ticked (`refresh_requests`), or a report whose last `fixes` entry lists only proposals now applied, rejected or closed and whose `generated_at` is older than the last of those decisions (brain-catch-up, step 1.9) | **default**: yes, refreshed, unless the same report has a `report_fixes` item (previous row) or a wording row (`wording_waiting`, `wording_held`, `accepted_wording`, §5.14.7): then it waits, its Refresh asked box still ticked |
| *(Reports)* A report's What to fix and the proposals it becomes (`report_fixes`) | **skip** the report whole: the fix waits for an attended run, and the report isn't refreshed meanwhile, whether its refresh was asked or due (next row) |
| *(Reports, Documents)* Accepted wording whose acceptance is current (`accepted_wording`, §5.14.7) | **default**: imported when `unattended_ok` (accepted at least 2 minutes before the snapshot) and the skill's re-read confirms it is unchanged; otherwise **waits** (`TOO_FRESH`) |
| *(Reports, Documents)* Any other wording row (`wording_waiting`, `wording_held`) | **skip**: nothing is imported, and the body is not published over; `wording_waiting` rows are named in the report |
| The identities question | **skip**: asked again at the next attended catch-up |
| "Publish to Notion at the end?" | **default** from `settings.publish`: `auto` publishes; `ask` publishes nothing and leaves it to the next attended run |

A request that asks no question runs as attended: a re-read, a `document_requests` item, the backlog rows. With Only keep, a `document_requests` item writes its checked row only with `settings.publish: auto`, and otherwise keeps its box ticked for the next run (capture-and-review §12.3). A `task_documents` item keeps the task as a `whole` Document and clears the box, and the From the brain question is written as a pending `add_to_note` for the next session (0100 §4, capture-and-review §13.7); a changed task page kept again writes its `update_body` pending. An input whose ingest raises a new question during the run is skipped, as attended (brain-catch-up step 3).

**Every kind of Notion edit** (`sync plan`, §5.14.2):

| In the plan | Unattended |
|---|---|
| `corrections`: a brain-owned property changed in Notion (Key Facts, Role, Name, Summary, Why, Deadline, Area, Goal, Client, Org, People) | **waits**, as attended: written as a pending `notion_correction` and applied by nobody (0101 §4); the next attended session asks it with the others as one question, and `sync render` doesn't publish over it meanwhile (§5.14.4) |
| `withdrawn`: a waiting correction or tracked task that Notion no longer shows | **closed**, as attended (`closed_reason: withdrawn`) |
| `tracked_tasks`: the task that tracks an open question is finished, in the trash or unreadable | **waits**, as attended: written as a pending `tracked_task`; the next attended session asks whether the question is answered (0101 §6) |
| `updates`: Lifecycle you set (Reviewed, Archived), Notion-owned fields (Status, Priority, Dates, Progress, Archived, Email, Relationship, Website, Type, Key Results), a `notion` page id | **applied** |
| `create`: an area, goal, project, person or org row you created | **applied** (an addition) |
| *(Reports)* `report_fixes`: a What to fix on a Report row | **waits**: counted in `waiting`; that report's refresh waits with it (first table), and `sync render --skip-conflicted` doesn't publish it (`FIX_WAITING`), so its What to fix, Refresh asked and body stay as they are in Notion, and any earlier change to it in Git waits for the attended run |
| `ignored` (`NOT_CORRECTABLE`, `MODULE_OFF`, `REVIEW_ROW`, …) | nothing, as attended; `NOT_CORRECTABLE` is named under Check |
| Chat decisions | none: nobody is in the chat |

**Every selected input, proposal and module case** (capture-and-review §4 to §8, 0055, 0096; moved here from capture-and-review §8, where the attended column stays):

| Situation | Unattended |
|---|---|
| Domains off | no Domain surface, as attended |
| Voice template; Tasks module off | summary written, no Task items, as attended |
| Input unconfirmed | **skip** the input; named under Needs you |
| Selection unreadable, stale or unmappable | **skip** the input; named under Needs you |
| Confirmed, the page settled for at least 2 minutes | **ingested** as the extract; the report states the confirming-minute limit |
| Selection changed after ingestion (tokens only) | the page settled for at least 2 minutes: the new version is written, its restriction and views at once, and the cleanup only proposed; otherwise it **waits** (`TOO_FRESH`) |
| Page set back to Ready, and the transcript changed | **skip** the input; named under Needs you |
| A source's new notes, additions, links and new facts (one `review_notes` per part, by subject, capture-and-review §7.3) | written: the notes `draft`, the rest waiting in its parts' `review_notes`; nothing applied; asked at the next attended session, one question per source (capture-and-review §7.4, §7.5) |
| A change to what the brain holds, a merge, an answer, an unsure flag (capture-and-review §7.2) | **proposed**, left pending; nothing applied |
| Exclusion cleanup | **proposed**; nothing removed |
| Tasks from excluded content | listed, as attended |
| Lean minutes: an unticked follow-up with a `q` id, Tasks module on (capture-and-review §6.3) | **created** with the input's ingest, once per `q` id, as attended but with no question; the report counts them |
| A Ready row with Keep as document and Only keep, not taken in yet (0098 §4, capture-and-review §12.3) | with `settings.publish: auto`: the original recorded as a source and its row Done, the checked row written (`source check`), nothing taken in; with `ask`: **skip**, the row stays Ready |
| A checked row set Ready (capture-and-review §12.6) | **ingested** as any Ready row once its page settled for at least 2 minutes (`TOO_FRESH` otherwise): its notes `draft`, its parts and asked changes waiting; with Document asked, its `whole` Document `reviewed`. It counts in the budget |
| A checked row still New | nothing: not taken in, not named (an attended catch-up names it, capture-and-review §12.8) |
| A checked row whose original can't be found (`CHECKED_FROM_UNKNOWN`, §5.35) | **skip**; named under Needs you |
| The original of a checked row that waits, set back to Ready (capture-and-review §12.7) | **skip**; named under Needs you |
| A task with Document asked ticked (`task_documents`, 0100 §4) | **kept** as a `whole` Document, box cleared; its From the brain question written pending (capture-and-review §13.7) |
| An unfinished task with no Area and a Project or a Factory (`task_areas`, 0.18.0, capture-and-review §6.5) | with `settings.publish: auto`: its Area **set**, with no question, counted in the report; with `ask`: nothing is written, reported or kept as waiting, and it doesn't by itself make a run go on; the next attended catch-up reads the task again. Not an input: it doesn't count in the budget |
| … whose Projects, or Factories, are in different Areas (`task_areas_unset`) | nothing set; named under Check of a run that had other work |
| A New meeting with a transcript and no minutes (0.17.0, capture-and-review §3.4.2) | with `settings.publish: auto`: **minutes written** after `minutes check` (§5.36) passes, oldest first by Date, at most `max_inputs` pages, not counted as inputs; logged `minutes-written`; named in the report as written. One that doesn't pass after one rewrite: nothing written, named under Needs you. With `publish: ask`: nothing written to Notion, named under Needs you |
| A New meeting with unmarked text and no minutes (capture-and-review §3.4.1) | read as a summary: no minutes, nothing asked; named under Needs you |
| A Factory whose folder or tasks changed (`factory read` `changed`; 0.18.0, Factories on; connected-workflows.md §9.1) | with `settings.publish: auto`: its overview **written**, as attended, with no question; it is not an input and not counted in the budget. With `ask`: nothing written, nothing recorded, and it waits for the next attended run. A folder that isn't on this machine, a `DIRTY_TREE` brain, or issues that can't be fetched: **skip**; named under Check |
| Reports module off | reports not touched, as attended |
| A Ready Weekly row (0.17.0, weekly-review.md §15.4) | read for its ticks, not an input and not counted in the budget: each plain tick **applied** after the stale check (`decided_by: tick`), a stale item **closed** and named under Check, an unticked item **declined**, a ticked `U` item **undone**; an item with text on its Your note line **waits** for an attended catch-up and is named under Needs you; a ticked `notion_change` or `new_task` applied only with `settings.publish: auto`, else it **waits** and is named. With `publish: auto` the row is published after, `Done` when nothing in it waits |
| A Weekly row still New | nothing: not read for ticks (weekly-review.md §15.4) |

0051 also lists "an Edit with a value" as applied. Since 0.16.0 every decision is given in the session (capture-and-review §7.6), so nothing of that kind reaches an unattended run: an `edit` with a `value` is passed to `brain apply` only in chat, by an attended run.

**The budget.** `settings.unattended.max_inputs` (default 10, schema §12) counts inputs: each Ready meeting, each Ready Inbox row (its attachments with it), each drop-folder file (except a transcript file of capture-and-review §3.4.3, which becomes a row and is not an input) and each changed file of a linked repo. They are taken oldest first, by the meeting's Date, the row's created time, the drop-folder file's modified time, the repo file's `committed_at`. Skipped inputs don't count; failed ones do. A repo whose files didn't all fit gets no `repo record`: the next run lists them again, and the ones already in skip as `DUPLICATE_SOURCE` (sources.md, "Linked repos", step 4). An input whose source the brain already has (`note new --dry-run` reports `DUPLICATE_SOURCE`: a repo file taken by an earlier run, or a row an earlier run wrote but didn't publish) is not an input again and isn't counted; a row or meeting waits for the publish. The inputs beyond the budget are `left`, named in the report ("4 more wait for the next run"), and taken by the next run. Requests (Documents, promotions, refreshes, Ask rows, the backlog) aren't inputs and aren't counted. When `brain status` gives `unattended.backlog: true`, the report says "Backlog growing: run more often or raise the budget".

**A step that fails** is logged in the run's `failures` and the run goes on with the next input. A lint error in a file the run wrote stops the run there, as attended, and is a failure.

**What needs the user** is the skipped inputs, the decisions waiting (`proposal list --waiting`), the report fixes, the conflicts, the failures, and from 0.17.0 the Weekly row items that wait for an attended run (a note, or a Notion write under `publish: ask`) and the stale ticks. The report is the attended three lines (Done, Needs you, Next) with What came in and Check, written:
- **in the log line** (§3.9), always, unless the run was a no-op;
- **in one Inbox row of Kind Catch-up** (Kind Report before 0.9.1, 0071), only with Reports on (`modules.reports`), with `settings.publish: auto` (an unattended run with `ask` writes nothing to Notion, 0051), and when something needs the user or failed. The skill creates it through the MCP in the publish step: Name `Catch-up <D Mon>: <n> in, <n> need you` (`, <n> failed` added when one did; "1 meeting in, 1 needs you"), Kind = Catch-up, Brain Status = Done, no Brain ID, the report as its body. It is not a note and has no file in Git; its facts are in the log line. It is history, not a living report, so it stays in the Inbox (0071). A Refresh asked or What to fix on it (an Inbox that still has them) is ignored (`NOT_A_REPORT`, §5.14.2). A Notion failure can't write it; the log line still holds the run;
- with Reports off or `publish: ask`, nowhere else: what needs the user waits where they act on it (the meeting or the row Ready, the decisions in `_proposals/`), and the next attended catch-up opens with the summary below. The skill's "Run on a schedule" section says so when it sets a schedule (CC-64): the summary row needs Reports on and `publish: auto`.

**The next attended catch-up** opens with the summary of the unattended runs since the last attended one, from `brain status` `unattended.catch_up` (§5.2), before its batch: "Since last time: 4 scheduled runs, 6 inputs in, 1 skipped, 3 decisions waiting, 1 failed: Notion login". Nothing when `catch_up` is `null`. Its own log line has no `mode`, which starts the count again.

### 6.2 Reflect (0052, 0076)

The skill brain-reflect, started when the user asks: "tidy the brain", "what's inconsistent?", "any duplicates?". It reports first in the chat and changes nothing without a yes, as Ultimate Assistant does (0072): each finding comes with a recommendation, and the user says **yes** (applied now), **later** (a pending proposal) or **skip** (0076 §1). Every answer is a proposal carrying the finding's fingerprint (schema §11.4), so Git says what changed and why, and a skip is remembered. It runs **on demand only** (0076 §5, §6.1).

**1. Candidates.** `brain status` (modules, a dirty tree), then `brain reflect --candidates` (§5.32).

**2. Judging.** The skill reads each cluster, in rank order: its members and its inputs (their `path`s, and the notes they link when it needs them). It writes **zero or more findings** per cluster, each of one kind, with the proposal a yes writes:

| Finding | From | What it is | The proposal (§5.6, schema §11.2) |
|---|---|---|---|
| Contradiction | `shared_ground`, `overtaken` | two claims about one fact that can't both hold, where the brain can't tell which is current: a member's `facts.<field>` and the other member, or an input | `contradiction` on the note that holds the fact (from `shared_ground`, when both members hold it: the one whose `updated` is older, then the lower id): `field`, `after` = the other claim; `source` = the other member, or the input (schema §11.4) |
| Stale fact | `overtaken` | an input says a fact of the note has changed since it was written | `update_fact`: `field`, `after` = the new value, `source` = that input |
| Duplicate | `near_duplicate` | the two notes are one thing | `merge`: `merge_into` = the survivor (the `reviewed` note over a `draft`, then the one more knowledge notes reference, then the older `created`, then the lower id), `target` = the other; `title` = `Merge <target title> into <survivor title>` |
| Promotion | `overtaken`, on a project or an Area | an input states a lasting rule, a commitment or a constraint that belongs on that note | `add_to_note`: `content` = the text to add, ending with the input's title and date in parentheses; `source` = that input |
| Theme | `recurring_term` | the inputs discuss a subject the brain has no note for | a draft learned Document (schema §4 reference: `origin: learned`, `sources` = the inputs that discuss it, `area` and `projects` when they agree), in its own `review_notes` whose `source` is the newest input (0076 §4) |

- A disagreement that no fact holds (two bodies that say different things) gives no contradiction in 0.11.0: the proposal kinds can't express it. A cluster that shows nothing wrong gives no finding.
- **Held findings.** A finding whose fingerprint is in its cluster's `held` is dropped. A released skip (schema §11.4) is proposed again only when the new input bears on that field (for a promotion, on that rule); otherwise it is dropped too, and nothing is written.
- `why` is the evidence in one sentence, quoting the input ("Acme sync, 3 Nov: María left Acme in June"). Every proposal also has `fingerprint` and `evidence` (schema §11.4).

**3. Ranking.** Findings by kind, in 0052's order of severity (contradictions, stale facts, duplicates, promotions, themes), then by their cluster's `rank`, then in the order the skill found them. They are numbered from 1 for the whole session: a number names the same finding until the session ends.

**4. The report** shows the first 10 (0076 §2). Layout (normative):

```text
Tidy the brain · 8 Nov 2026
Read 412 notes, and 37 meetings and sources from the last 30 days.

1. Contradiction · Acme website (project) · launch date 2027-01 here; "Launch Acme website in February" says 2027-02
   which holds? a) 2027-02  b) 2027-01  c) another value
2. Stale fact · María López (person) · role "PM at Acme"; Acme sync, 3 Nov: "María left Acme in June"
   a) set role to "former PM at Acme (left in June 2026)"
3. Duplicate · M. Lopez and María López (people) · the same name once initials are ignored
   a) merge M. Lopez into María López
4. Promotion · Acme website (project) · Acme sync, 3 Nov: every release needs legal's sign-off
   a) add to the project: "Every release needs legal's sign-off (Acme sync, 3 Nov 2026)."
5. Theme · pricing tiers · in 4 meetings and sources, and no note has it
   a) draft a Document on pricing tiers

12 more. Say "more".
Answer "yes 2, 3", "1a" for the value that holds, "later 4", "skip 5 because …", or "done".
```

- Line 1: `Tidy the brain · <D Mon YYYY>` (the UTC date of `as_of`). Line 2: `Read <read.notes> notes, and <read.inputs> meetings and sources from the last 30 days.` (singular for 1).
- A blank line, then one block per finding: `<number>. <Kind> · <subject> · <evidence>`, then one line indented three spaces with its recommendations, `<letter>) <label>` joined by two spaces. Kinds: `Contradiction`, `Stale fact`, `Duplicate`, `Promotion`, `Theme`. Subject: `<title> (<type>)`, the type being the note's `type`, except `Document` for a `reference`; a duplicate `<target title> and <survivor title> (<plural>)`, the plural being `people` for `person`, else the type plus `s` (`orgs`, `decisions`, `Documents`); a theme its term as the inputs write it most often (ties: the earliest input). The evidence is the skill's words, one line, at most 160 characters.
- Recommendations: a contradiction starts with `which holds?` and gives the values, newest claim first, then `another value`; a stale fact gives the new value; a duplicate names the survivor; a promotion shows **the whole text** it adds (0076 §1); a theme `draft a Document on <term>`.
- After the blocks, a blank line, then `<n> more. Say "more".` when there are more (findings judged and not shown, plus `, and more to check` when clusters beyond the page are still unjudged), and always the answer line.
- **Nothing found:** after line 2, a blank line and `Nothing to tidy.` The session ends there and writes nothing: no proposal, no log line, no commit.

**5. The answers** (0076 §1, §2):
- **"yes N"** applies finding N's recommendation `a`, **"yes Nb"** its `b`; "yes 1, 3" each; **"yes to all"** every recommendation `a` of the last report. **A contradiction is never applied on a bare yes:** "yes 1" (or "yes to all" reaching it) makes the skill ask which value holds, and nothing is applied for it until the user picks one ("1a") or gives their own ("1: 2027-03"). Any finding takes a value of the user's own instead of its recommendation ("2: Head of Ops at Quayside", "3: keep M. Lopez").
- A yes writes `proposal new` with the finding's proposal, then `apply` with `{ proposal, action, decided_at: <now>, decided_by: "chat" }`: `approve` for the recommendation; `fix` with `fixes: [{ value }]` and `note` = the user's words for a value of their own or a contradiction's chosen value (schema §11.3; a contradiction fixed to a value no claim holds is attributed to the user, schema §11.2). **A theme** isn't applied: a yes writes the draft with `note new`, then its `review_notes` with `proposal new`, and the user reviews the Document as any new note: the session shows the draft and asks (0076 §4, capture-and-review §7.5).
- **"later N"** writes the proposal and no decision: it is `pending`, asked by a later session (capture-and-review §7.5). For a theme, "later" writes the draft as a yes does, and its `review_notes` waits. Pending proposals come only from "later", so 0052's cap of 10 per run is gone (0076 §2).
- **"skip N"** (with "because …" or not; the skill doesn't ask why) writes the proposal and rejects it in chat: `apply` with `action: "reject"`, `note` = the reason when given. No proposal is published (§5.14.4). A theme's skip is a `new_item` holding the Document it would have drafted: title, summary, `origin: learned`, `sources`, a one-line body. How long a skip lasts depends on the kind (schema §11.4).
- **A finding already proposed.** When `proposal new` skips the item `DUPLICATE_PENDING` (an earlier "later" of this session, or one still pending from before), the `existing` proposal is decided instead: a yes approves or fixes it, a skip rejects it.
- **"more"** shows the next 10 judged findings; when they run out and `total` is beyond the page, `reflect --candidates --offset <offset + limit>` is run and judged first (step 2), continuing the numbers. **"done"** ends the session.
- A finding the user doesn't answer writes nothing; it can come back next time.

**6. After the answers.** After each answer that wrote: `brain index`, `brain views`, `brain lint`, commit (`reflect: <what changed>`). At "done": when anything changed, `brain sync render --changed` and the MCP, then `brain sync record`, commit, with `settings.publish` as an attended catch-up uses it (`auto` publishes; `ask` asks once), then push per `settings.push`. No proposal is rendered (§5.14.4); the changed notes and the reviewed drafts are.

**7. Closing summary.** One line: `Done: <n> changed, <n> waiting, <n> skipped, <n> drafted.` (parts at 0 left out; `Nothing changed.` when all are 0). **changed** counts the proposals applied after a yes, **waiting** the "later" proposals still pending at "done" (a "later" the user then said yes or skip to counts as changed or skipped instead), **skipped** the skips written, **drafted** the theme Documents written (after a yes or a "later").

**8. The log.** One line at the end, except after `Nothing to tidy.` (step 4), which writes nothing (CC-67's acceptance): `reflect - clusters=<total> findings=<n> shown=<n> applied=<n> proposals=<n> skipped=<n> drafted=<n> notes_read=<n> seconds=<s>`: `clusters` is the first `reflect --candidates` call's `total`, `findings` the findings judged, `shown` those the reports showed, and the next four the closing summary's counts.

**The Ultimate Assistant sub-agent loads brain-reflect too** (0076 §8), so "tidy the brain" works in the same chat as "review my projects" ([assistant.md](assistant.md) §10). Asked with `report only`, it returns the report above as its whole answer and changes nothing; the session that called it runs its own session of the skill when the user wants to act, and the user's numbers refer to that report.

**In the brain's files** (CC-67): the brain's `AGENTS.md` operations table gains the row "tidy the brain: contradictions, duplicates, stale facts and recurring themes in your notes | `brain-reflect`", and the sub-agent's text names the skill (assistant.md §10).

**Not in 0.11.0:** a schedule, an unattended run, and the light pass inside catch-up (0052) that 0075 §4's targeted check after an approved correction replaces (0076 §5).

### Domains (0055)

Domains use `dom-` ids and `domains/<slug>.md`. When Domains is off, sync ignores Domain rows and Area · Domain with `MODULE_OFF`, and render omits them. When on, Area · Domain is a correctable optional single relation: multiple values conflict as `MULTIPLE_DOMAINS` and hold the whole row. Domain · Org follows the Orgs module. Lint checks the types of both relations and reports `DOCUMENT_DOMAIN_MISMATCH` when a Document’s Area and a linked Project’s Area have different Domains. Since 0.16.1 (0105) sync reads no Domains · Type (§5.14.2) and never reads the Domain rollup that Notion shows on Projects, Meetings and Documents.

### 5.24 `brain recover` (0055, capture-and-review §7.11)

```text
brain recover
```

Finishes or rolls back each interrupted journaled write, oldest first. For `_journal/<op>.json`: if a commit with the trailer `Op: <op>` exists, the work is kept and only the journal is deleted (`committed`); otherwise each listed path goes back to the last commit (`git restore --source=HEAD --staged --worktree -- <path>`), each listed new path is removed, and the journal is deleted last (`restored`, reported as `RECOVERED <op>`). Before restoring, every journaled path is checked: a path whose content is neither the operation's own write (the `hash` in the journal) nor the last commit was changed by someone since, and recovery stops with `RECOVERY_NEEDED` naming it, leaving the journal and the file as they are. An unreadable journal file is named the same way. Every step is idempotent, so an interrupted recovery is run again. Restoring puts both the index and the worktree back to the last commit (`git restore --source=HEAD --staged --worktree`), so a commit that failed after `git add` leaves nothing staged; new paths are unstaged and removed. If a step fails the journal is kept and every command keeps refusing with `RECOVERY_NEEDED`. `data` = `{ recovered: [{ op, action }] }`; an empty list when there is nothing to do.

### 5.25 `brain source cleanup-plan` (0055, capture-and-review §5.2)

```text
brain source cleanup-plan --page <notion-page-id>
```

Read-only. Lists what an input's **active** suppressions (`_suppressions/<page>.json`, §5.23) restrict and what stays, for the exclusion cleanup proposal. That proposal, its item decisions (Remove, Keep, Restore) and their apply are §5.26; the session asks them (capture-and-review §7.5, group 2). `data` = `{ input, latest_extract, notes: [{ note, path, whole, reason, restricted: [{line, text}], kept: [{line, text}] }], restore: [{ note, line, passage }], tasks: [{ task, item, reason }], documents: [{ note, sources }] }`.
- `notes`: every knowledge note that rests on the input (by lineage, `unknown` lineage included) and has a restricted statement or is restricted whole. `reason` is `passages` (a statement cites a suppressed passage), `unmapped text` (no passage references, restricted whole) or `unknown lineage`. `kept` lists the statements with a passage reference that stay eligible, so the session shows what is **independently supported**.
- `restore`: statements citing a passage that an earlier suppression removed and the latest version holds again.
- `tasks`: Tasks (`tasks` of the input's versions) whose item is no longer selected (`item no longer selected`) or that no item can be tied to (`unknown item`, e.g. made from a full copy). The brain never cancels or deletes a Task.
- `documents`: Documents (`reference`) made from the input's sources, for Remove or Keep. A note entry also lists `restricted_timeline` (indices of timeline entries not returned) and `restricted_facts` (fact keys not returned).

### 5.26 `brain source cleanup-propose` (0055, capture-and-review §5.2)

```text
brain source cleanup-propose --page <notion-page-id> [--json]
```

Writes the exclusion cleanup of an input as **one pending `review_notes`** built from `cleanup-plan` (§5.25): `notes: []`, `links: []`, `source` = the latest extract, `cleanup: { input, version, tasks }` and `items` of three kinds, each with an immutable `item_id`. **`remove`** (`ref` = a note that stays): *Proposed* is the note's text without the lines that rest on excluded content (the user may correct it in the session: a `fix`, §5.7); Accept writes that text exactly, drops the note's restricted timeline entries and facts, and records `lineage_cleared` (the input added to the list); it is refused (`STILL_RESTRICTED`) if the text still holds a statement that rests on excluded content. **`restore`** (`ref` = a note, `n` = a paragraph): *Proposed* is the word `Restore`; Accept appends `{ kind: "restore", extract_version, items: [{ note, n }] }` to `_suppressions/<input>.json`, per claim (a note and a passage); applying twice writes nothing. **`independence`** (a note whose text cannot be tied to a passage, or a Document made from the input): *Proposed* is the word `Keep` or `Remove`, default `Remove`; Keep records `lineage_cleared`, Remove archives the note; any other word is `UNREADABLE_PROPOSED`. Tasks created from excluded content are listed in `cleanup.tasks` and shown as a plain list, never as items; the brain never cancels them. **A cleanup item has no defer** (`DEFER_NOT_SUPPORTED`): "later" leaves it pending. Reject changes nothing and releases nothing (capture-and-review §5.3). The items are asked in the session (capture-and-review §7.5, group 2) and applied by `brain apply` (§5.7) as one journaled operation; when the last of them leaves no note restricted by the input, **the input's active records become `reconciled`** with `reconciled_at`, in the same operation. If a cleanup proposal for the input is already pending the command writes nothing (`result: PENDING_EXISTS`, with its id); with nothing to clean it is `NOTHING_TO_CLEAN`. `data` = `{ result: WRITTEN·PENDING_EXISTS·NOTHING_TO_CLEAN, proposal?, path?, items? }`.

### 5.27 `brain proposal revise` (retired in 0.16.0, decision 0096)

```text
brain proposal revise …
```

Retired: refuses with `RETIRED` (§3.5) and writes nothing. A redraft is shown and accepted in the session and applied as a `fix` (§5.7; capture-and-review §7.8). `revisions` already recorded on a proposal are kept and never read. Until 0.15.x it wrote the new draft of an item whose revision was requested on its Review page (0055); the 0.16.0 migration still records such requests (§5.14.8).

### 5.28 Pinned skills (0059, [skills-delivery.md](skills-delivery.md))

Every brain pins the operational skills it uses in `skills.lock.json` at its root (skills-delivery §3). CC-100 builds this section. The formats, the command changes to `init`, `link`, `upgrade` and `lint`, rollback and the transition are in skills-delivery.md. CC-100 rewrites §3.5, §5.1, §5.2, §5.10, §5.12 and §5.15 to match, in the same PR as the code.

**Pin guard.** Every command except `init` resolves a brain (§4). After resolution and the `RECOVERY_NEEDED` check, and before reading input or writing anything, each such command determines the brain's state (skills-delivery §3, rows 1 to 4 only).
- **Exempt:** `status`, `lint`, `upgrade` and `recover` always run, so the user can see and repair the pin.
- **Guarded:** every other command, including `config`, read-only commands (`query`, `log`, `proposal list`, `repo changes`, `index --check`) and every `--dry-run`. An incompatible pin means the skill calling them may expect another contract.
- **Not affected:** `--help`, `--version`, usage errors and `RETIRED` come before resolution. `brain link` guards the resolved brain, not the linked repo.

| State | Guarded command |
|---|---|
| `unpinned` | runs as before 0.9.0, with no warning (skills-delivery §9) |
| `invalid` | refuses `SKILLS_PIN_INVALID` |
| `incompatible` | refuses `SKILLS_INCOMPATIBLE` |
| `missing` | refuses `SKILLS_SNAPSHOT_MISSING` |
| `drift`, `pinned` | runs; drift is a lint error (`product-file`), never a stop. The guard doesn't compute it. |

**Messages** (normative wording):
- `{…}` is filled in. Paths are brain-relative; a message never contains a machine path.
- "Newer" and "older" than the range are as skills-delivery §2.1 defines them. A version that is both gets the newer message.

| Code | Message |
|---|---|
| `SKILLS_INCOMPATIBLE` (newer) | `This brain's skills ({name} {version}) need ultimate-brain {cli}; this CLI is {running}. Run brain upgrade to install the skills this CLI ships, or keep these skills with npm install -g ultimate-brain@{installed_by}.` |
| `SKILLS_INCOMPATIBLE` (older) | `This brain's skills ({name} {version}) need ultimate-brain {cli}; this CLI is {running}. Install the version that pinned them: npm install -g ultimate-brain@{installed_by}.` |
| `SKILLS_PIN_INVALID` | `skills.lock.json is invalid ({reason}). Run brain upgrade to rewrite it.` (`{reason}` per skills-delivery §3) |
| `SKILLS_SNAPSHOT_MISSING` (guard) | `Pinned skill {skill} is missing from {tree} ({name} {version}). Run brain upgrade to restore it.` (`{tree}` is `.agents/skills` or `.claude/skills`; the first missing skill per skills-delivery §3) |
| `SKILLS_SNAPSHOT_MISSING` (`link`) | `{path} differs from the pinned skills ({name} {version}). Run brain upgrade in the brain, then brain link again.` |
| `SKILLS_SNAPSHOT_INVALID` | `The skills shipped with ultimate-brain {running} are unusable ({reason}). Reinstall: npm install -g ultimate-brain@{running}.` (`{reason}` = the skills-delivery §2.3 reason, `not compatible with {running} ({cli})`, or `same version, different content`) |
| `SKILLS_DOWNGRADE` | `This brain pins {name} {pinned}; this CLI ships the older {shipped}. Install ultimate-brain@{installed_by}, or roll back as docs/releasing.md says.` |

**Warnings:**

| Code | Command | Message |
|---|---|---|
| `SKILLS_COMPETING` | `init`, `upgrade`, `link` | `{n} competing skill copies; see data.skills.competing and remove them.` |
| `SKILLS_UNPINNED` | `link` | `The brain's skills are not pinned; the linked repo got the skills of ultimate-brain {running}. Run brain upgrade in the brain.` |
| `SKILLS_LOCK_REPLACED` | `upgrade` | `skills.lock.json was invalid ({reason}) and was replaced.` |

**`details`** of each error, with absent values left out:
- `SKILLS_INCOMPATIBLE`, `SKILLS_PIN_INVALID`, `SKILLS_SNAPSHOT_MISSING`: `{ "state", "name", "version", "cli", "running", "installed_by", "reason", "skill", "path" }`. `name`, `version`, `cli` and `installed_by` come from a valid lock; `reason` is the invalid reason or the first missing `{tree}/{skill}`; `skill` and `path` (`{tree}/{skill}/SKILL.md`) are set for the guard's `missing`; `link` sets `path` to the file that differs and no `skill`.
- `SKILLS_SNAPSHOT_INVALID`: `{ "reason", "running" }`.
- `SKILLS_DOWNGRADE`: `{ "name", "pinned", "shipped", "installed_by" }`.

**Error codes** (added to §3.5 by CC-100):

| Code | Exit | When |
|---|---|---|
| `SKILLS_PIN_INVALID` | 3 | the brain's state is `invalid` |
| `SKILLS_INCOMPATIBLE` | 3 | the brain's state is `incompatible` |
| `SKILLS_SNAPSHOT_MISSING` | 3 | the brain's state is `missing`; for `link`, a pinned file it copies is missing or differs |
| `SKILLS_SNAPSHOT_INVALID` | 3 | the package snapshot is invalid or excludes the running CLI (`init`, `upgrade`, `link` on an unpinned brain); or a released snapshot changed content under the same version (`upgrade`) |
| `SKILLS_DOWNGRADE` | 5 | `upgrade` would lower the pin's version under the same snapshot name |

**`brain status` gains `data.skills`** (always present):

```json
"skills": {
  "state": "pinned",
  "name": "ultimate-brain-skills", "version": "1.2.0", "cli": ">=0.9.0 <0.10.0",
  "integrity": "sha256-…", "installed_by": "0.9.0", "running": "0.9.1",
  "reason": null,
  "package": { "name": "ultimate-brain-skills", "version": "1.3.0", "compatible": true, "reason": null },
  "drift": [],
  "competing": [ { "kind": "global", "name": "brain-query", "path": "~/.claude/skills/brain-query" } ]
}
```

- **`state`** is one of skills-delivery §3's states.
  - `unpinned` and `invalid` set `name`, `version`, `cli`, `integrity` and `installed_by` to `null`.
  - `reason` is the invalid reason for `invalid`, the first missing `{tree}/{skill}` for `missing`, and `null` otherwise.
- **`package`** describes the package snapshot. `name` and `version` come from its manifest when the manifest passes its schema, and are `null` otherwise. `compatible` is per skills-delivery §2.3. `reason` is the §2.3 reason when the package snapshot is invalid, and `null` otherwise.
- **`drift`** lists, sorted, the brain-relative paths that lint's `product-file` reports for skills: a missing folder, then a missing, mismatched or unlisted file.
  - It is computed against the lock for `pinned`, `drift`, `missing` and `incompatible`, and against the package snapshot for `unpinned`. It is empty when that package snapshot is invalid: lint's single broken-install error is reported by lint and by `package.reason`, never listed here.
  - An unlisted folder is one entry; its contents are not listed.
  - It is `[]` for `invalid`.
- **`competing`** is as skills-delivery §5.3 defines it.
- **The schema reason** `schema: <first schema error>` gives that error as `<JSON Pointer> <message>` (`/` for the whole file), the shape `INPUT_INVALID` details use (§3.5).
- **`HOME`** for the global checks is the command's environment variable; tests set it to a temporary folder (skills-delivery §5.2).
- **Skills act on the state.** Skills call `brain status` first. When `state` is `invalid`, `incompatible` or `missing`, the skill stops and shows the message the guard would give.

### 5.29 `brain repo` link kits, rollup and unlink (0066, linked-repos.md)

```text
brain repo kit check (--path <path> | --input <file|->) [--name <name>]
brain repo kit write --path <path> --input <file|-> --confirm <sha256> [--replace <sha256>]
brain repo add <name> --path <path> --kit
brain repo refresh <name> [--path <path>] [--dry-run]
brain repo show <name>
brain repo health [<name>] [--input <file|->] [--rollup-as-of <timestamp>]
brain repo tasks <name> [--input <file|->]
brain repo unlink <name>
brain repo new --path <path> --starter generic --input <file|-> --confirm <sha256>
```

The model, the kit's fields and their checks, the rollup text and the health checks are in [linked-repos.md](linked-repos.md); this section holds the commands. They read linked repos with read-only Git commands (as §5.16), and they write only `brain.json` `repos`, except for `kit write` and `new`, which also write in a linked repo. Every command that reads a kit validates it against `spec/schemas/link-kit.schema.json` and runs the checks of linked-repos.md §2.2 (`KIT_INVALID`, exit 4; `details` lists every problem as `{pointer, message}`, and the message names the first). Hashes in `--confirm`, `--replace` and `data` are written `sha256:<64 hex>`.

**§1's rules gain these exceptions.** `repo kit write` writes exactly one file, `<path>/brain-kit.json`. `repo new` writes the starter into a new folder, runs `git init` there and makes its first commit. They are added to "Writes only inside the brain" and "No Git" respectively. Neither ever writes another file in a linked repo, and neither ever pushes.

**`repo kit check`** writes nothing. It reads `<path>/brain-kit.json`, or `--input`; exactly one of the two must be given (`USAGE`). It returns `{ kit, sha256, confirm_sha256, canonical, problems: [{pointer, message}] }`:
- `sha256` is the hash of the bytes it read (the `--replace` value for an existing file);
- `confirm_sha256` is the hash of the bytes `kit write` would write for this kit (2-space indent, keys in linked-repos.md §2.1 order, trailing newline): the `--confirm` value. It is `null` when `kit` isn't a JSON object (CC-129);
- `canonical` is `true` when the bytes read are already that form, so `sha256` equals `confirm_sha256`;
- `kit` is the parsed JSON, or `null` when the bytes aren't JSON;
- `problems` holds a JSON parse failure (pointer `""`, message `not JSON: <reason>`), every schema error, and the checks of linked-repos.md §2.2.

It exits 0 even with problems: this is the command the skill uses to show them. A missing file is `KIT_MISSING` (exit 4). `--name` adds the check that `name` equals it.

**`repo kit write`** writes the input kit to `<path>/brain-kit.json`, after the user's yes to that exact content (linked-repos.md §3).
- Order of checks, all before the write:
  1. `path` is the top of a Git working tree (`REPO_NOT_FOUND`) and isn't the brain (`REPO_IS_BRAIN`) or the product repo (`OUTSIDE_ROOT`; the product repo is recognised as in `BRAIN_IS_PRODUCT_REPO`).
  2. The kit is valid: the schema, and every check of linked-repos.md §2.2 (`KIT_INVALID`). `kit write` needs the brain (§4) for these checks. For a repo already linked, the entry found by `path` must have the kit's `name`.
  3. `brain-kit.json` isn't a symbolic link or a folder (`OUTSIDE_ROOT`).
  4. An existing file needs `--replace` equal to its current hash (`KIT_EXISTS` without the flag, `KIT_CHANGED` when the hash differs); a missing file with `--replace` is `KIT_MISSING`.
  5. `--confirm` equals the hash of the bytes it will write (linked-repos.md §3). Without it: `CONFIRMATION_REQUIRED`; a different hash: `CONFIRMATION_MISMATCH`.
- It writes with 2-space indent, keys in linked-repos.md §2.1 order, and a trailing newline, atomically (§3.6). It never stages or commits. Input bytes that aren't JSON are `KIT_INVALID` (pointer `""`).
- `data` = `{ path_abs, sha256, action: created|updated|unchanged }`; `unchanged` when the bytes are the same.
- Logs `repo-kit - "<name>" sha=<first 12 hex>`.

**`repo add <name> --path <path> --kit`** links a repo from its kit. It is §5.16's `repo add` with the kit's values: `area` = `placement.area`, `patterns` = `knowledge.patterns`, `never_read` and `projects` when the kit has them (a kit's `project` is written as `projects` with that one id; 0.18.0), and `kit: { sha256 }`. The kit's `name` must equal `<name>` (`KIT_INVALID`, pointer `/name`); a repo with no kit is `KIT_MISSING`. `--kit` can't be combined with `--area` or `--pattern` (`USAGE`). §5.16's other checks apply unchanged. `data` = the new entry.

**`repo refresh <name>`** re-reads the kit of a linked repo and copies `area`, `patterns`, `never_read`, `projects` (from the kit's `projects` or `project`; the entry's old `project` is removed, 0.18.0) and the hash into its entry. It never changes `commit`, so the next `repo changes` lists only what changed since the last ingest (CC-118).
- **A legacy entry** (no `kit`) whose repo now has a `brain-kit.json` (written by `repo kit write` after the user's yes) adopts it: the entry gets the kit's copies and `kit: { sha256 }`, as `repo add --kit` would give it. A legacy entry whose repo has no kit file is `NO_KIT` (exit 4), unless `--path` is given: then only the path changes and the entry stays legacy.
- **`--path <path>`** records a repo's new location, when it moved (`PATH_MISSING` in the health check). It is absolute or starts with `~/` (`INPUT_INVALID`), and is stored as given. It must resolve to the top of a Git working tree (`REPO_NOT_FOUND`) that isn't the brain (`REPO_IS_BRAIN`, compared after resolving symbolic links). The kit is read there. When `commit` isn't `""`, it must be a commit of the repo at the new path and an ancestor of its `HEAD` (`REPO_COMMIT_UNKNOWN`): this is how the command knows the path holds the same repo. The old path isn't read, so it may be gone.
- Order of checks, all before any write: the name (`REPO_NOT_FOUND`); `--path` as above, or else the entry's own path (`REPO_NOT_FOUND`); the kit: a kit-linked entry needs one (`KIT_MISSING`), a legacy entry with no kit and no `--path` is `NO_KIT`, and a kit read must be valid for this entry, its `name` the entry's (`KIT_INVALID`, as for `kit write`); then, with `--path`, the commit.
- `data` = `{ name, changed, placement_changed, added_patterns, removed_patterns, added_never_read, removed_never_read, reingest }`. `changed` is true when the entry would change: the kit's hash isn't `kit.sha256` (always, for a legacy entry adopting a kit), or `--path` differs from the stored `path`. When it is false, nothing is written. `placement_changed` is true when `area` or the Projects differ, as lists in order, an entry's or a kit's `project` read as a list of one (0.18.0), a project added or removed included. With Factories on, the next `sync render --changed` then sends the row's Area and Projects. The four lists compare the kit with the entry, in the kit's (added) or the entry's (removed) order; they are empty when no kit is read.
- `reingest` is true when patterns were added or never-read paths removed: files that are now readable but older than the recorded commit are only listed after `repo record --reset` (§5.16), and the skill offers that. A legacy entry adopting a kit is compared with its own `patterns` and `never_read`.
- `--dry-run` writes nothing and reports the same `data`, after the same checks.
- Logs `repo-refresh - "<name>"` when it writes, with `sha=<first 12 hex>` when the entry has a kit after the write, and `path=<path>` when the path changed.

**`repo show <name>`** writes nothing. `data` = `{ entry, kit, kit_sha256, kit_status: current|changed|missing|invalid|none, workflow, factory }`.
- `kit` is `null` unless the status is `current` or `changed`. `kit_sha256` is the hash of the file's bytes, `null` for `missing` (the file or the repo's path is gone) and `none`.
- `workflow` is `{ id, state }` of the workflow in state `connected` or `paused` whose `folder.repo` is this name, or, from 0.18.0, whose destination is the repo's Factory, or `null` (connected-workflows.md §3.1 allows at most one).
- `factory` (0.18.0) is the repo's `factories` entry (schema §12), or `null` when it has none; given with the module off too, since the record stays.

**`repo health [<name>]`** writes nothing. `--rollup-as-of` (with `<name>`) enables `ROLLUP_STALE`. It runs the checks of linked-repos.md §6 on one repo, or on all repos in `brain.json` order. `--input` takes the issue data of `repo tasks` for a GitHub or GitLab source, so `STATUS_UNMAPPED` can be checked; it needs `<name>`. `data` = `{ repos: [{ name, checks: [{code, severity, message, path?}] }] }`, checks in the table's order; a repo with no finding has `checks: []`. `path` is the repo-relative file a check is about, when there is one. `--input` or `--rollup-as-of` without `<name>` is `USAGE`. The exit code is 1 when any check is an error.

**`repo tasks <name>`** writes nothing. It builds the read-only rollup (linked-repos.md §4) of a `tracked-in-repo` repo.
- Refusals, all exit 4: a legacy entry is `NO_KIT`, a kit whose mode is `connected` is `MODE_CONNECTED`, and a kit without `tasks` is `NO_TASKS`.
- `markdown`: no input (`USAGE` with `--input`); the CLI reads the file at `HEAD`. A file missing at `HEAD` is `KIT_INVALID` (pointer `/tasks/source/path`). The warning `REPO_DIRTY` is given when that file has uncommitted changes, or isn't tracked.
- `github` and `gitlab`: `--input` is required (`USAGE`): `{ fetched_at, items: [{ number, title, state, state_reason?, labels: [string], url, closed_at? }] }`. `closed_at` (a UTC timestamp or `null`, 0.18.0) is read only by `factory read` (§5.39), so `repo tasks` ignores it. `state` is `open` or `closed` (GitHub; `state_reason` `completed` or `not_planned`), or `opened` or `closed` (GitLab).
- `target` is the Project when the placement names exactly one, else the Area (0.18.0; linked-repos.md §4). With Factories on the skill doesn't write the toggle (§4).
- `data` = `{ name, target: { project } | { area }, as_of, counts: { todo, in_progress, waiting, review, done, dropped, unmapped }, percent, items: [{ key, title, raw, meaning, url? }], unmapped: [{ raw, count }], toggle: { heading: "Repo tasks · <name>", markdown } }`.
  - `items` holds every item, in source order (issues in input order); an unmapped item has `meaning: null`.
  - `percent` is `null` when there are no non-dropped items.
  - `as_of` is `--now` for markdown, `fetched_at` for issues.
  - The skill writes `toggle.markdown` under `toggle.heading` on the target's page.

**`repo unlink <name>`** removes the entry from `repos` (the `repos` key stays, even when empty). It changes no source, note or file in the repo (linked-repos.md §9). `data` = `{ name, removed: <the entry>, sources: <the number of sources with this repo>, workflow: <as in repo show>, factory: <fac id or null> }`. Logs `repo-unlink - "<name>"`. **Its Factory (0.18.0, 0113 §1),** if it has one, is archived in the same write, with the module on or off: `archived: true`, with the link's Area and Projects copied in as `area` and `projects` (schema §12; linked-repos.md §9). Its `overview`, `notion` and `published` stay.

**`repo new`** creates a new repo from the generic starter (linked-repos.md §7).
- `--input` is the kit, with `starter` left out (the command sets it, replacing any given). `--starter` accepts only `generic` (`USAGE`).
- `path` is absolute or starts with `~/` (`INPUT_INVALID`). It must not exist, or must be an empty folder (`TARGET_NOT_EMPTY`), and must not be inside the brain (`OUTSIDE_ROOT`, compared after resolving symbolic links).
- The kit is checked as for `kit write`, including `--confirm` on the bytes of the kit file it writes (with `starter` set), plus the source rule of linked-repos.md §7.
- It writes the starter's files of linked-repos.md §7 and the kit, runs `git init`, and commits everything with `Start from the Ultimate Brain generic starter`. A commit that fails (no Git identity) gives the warning `GIT_COMMIT_SKIPPED` and keeps the files.
- It doesn't link the repo: the skill runs `repo add --kit` next.
- `data` = `{ path_abs, files: [path], sha256, commit }`, with `files` sorted by path (code points) and `commit` the short hash (`git rev-parse --short`), or `null` when the commit was skipped.
- Logs `repo-new - "<name>"`.

**Changes to §5.16.** `repo changes` leaves out the files that match the entry's `never_read`, and always leaves out `brain-kit.json`. For `repo add` without `--kit`, `never_read`, `project` and `projects` can't be set; they come only from a kit.

New error codes, all with exit 4: `KIT_MISSING`, `KIT_INVALID`, `KIT_EXISTS`, `KIT_CHANGED`, `NO_KIT`, `MODE_CONNECTED`, `NO_TASKS`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_MISMATCH`. Existing codes used: `REPO_NOT_FOUND`, `REPO_IS_BRAIN`, `OUTSIDE_ROOT`, `TARGET_NOT_EMPTY`, `UNKNOWN_ID`, `USAGE`. CC-102 adds the new codes to §3.5, the rows of §1.1 (the link skill: `repo kit check`, `repo kit write`, `repo add`, `repo refresh`, `repo show`, `repo health`, `repo tasks`, `repo unlink`, `repo new`, `link`) and §1's exceptions.

### 5.30 `brain question drop` (0071, capture-and-review §6.2)

```text
brain question drop --input <file|->
```

Drops questions the user agreed, in the to-do tidy, are not questions: an owner's to-do that became a Task, or someone else's commitment. Attended only: the skill runs it after the user's yes for each item, never in an unattended run. Input: `{ "items": [ { "id": "que-…", "task": "<Notion task page id>" } ] }`, `task` optional, at least one item, each id once (`INPUT_INVALID` otherwise, with the pointer `/items/<n>`).

Checks, all before any write (one failing item writes nothing; `INPUT_INVALID` unless named):
- `id` names a note (`UNKNOWN_ID`) that is a `question` with `kind: question`: a risk is never dropped this way;
- the question has no `answer` and no `task` of a tracked question (a `task` without `dropped`, schema §4: a question you track is followed up, not a to-do; the tidy never lists one), and, unless it is already dropped (below), its lifecycle is not `archived`: an archived question is history (superseded, merged or archived by you), not a to-do;
- `task`, when given, is a non-empty string held in the `tasks` of the question's `raised_in` meeting or of one of its `sources`: the skill creates the Task with `sync tasks` and records it with `sync record` (§5.14.5, §5.14.6) **before** the drop, so a drop never names a Task the brain has not recorded.

Per item:
- **`dropped`**: the question gets `lifecycle: archived`, `dropped` = today (the `--now` date), `task` when given, and `updated` = today. Nothing is published: the question has no Notion row (schema §4), and it leaves the Brief's open list (schema §16.1). Up to 0.15.x the next publish set its Notion Status to Dropped. Logs `question-drop <id> "<title>"`.
- **`unchanged`**: the question already has `dropped` and the same `task` (or none in both): nothing is written, so a retry after a failure is safe.
- A question that already has `dropped` with a different `task`, or a `task` where it had none, is `INPUT_INVALID`: a dropped question keeps its first record.

Then lint runs on the changed notes; a lint error (none is expected) rolls the whole input back (`INPUT_INVALID`). The meeting's `questions` and the question's `raised_in` stay as they are: the dropped question is history (schema §4 question).

`data` = `{ "items": [ { "id": "que-…", "result": "dropped" | "unchanged", "task": "…"? } ] }`. Exit 0.

Errors: `UNKNOWN_ID`, `INPUT_INVALID`.


### 5.31 `brain assistant` (0064, 0072, [assistant.md](assistant.md))

```text
brain assistant findings --input <file|-> [--scope <id>] [--limit <n>] [--exclude <file>] [--number-from <n>]
brain assistant dismiss --input <file|->
```

The deterministic half of Ultimate Assistant: the skill reads Notion and linked repos and talks with the user; these commands compute the findings and keep the skipped ones. The signals, thresholds, ranking and report text are normative in assistant.md §3 and §4; this section holds the commands.

**`assistant findings`** writes nothing. Input: the assistant snapshot (assistant.md §2.1, `$defs/snapshot` of `spec/schemas/assistant.schema.json`; `INPUT_INVALID` with pointers when it fails). The snapshot must agree with the Tasks module: on and live, `tasks` and `task_statuses` are required; off, they are refused (`INPUT_INVALID`, pointer `/tasks`). A status not in `task_statuses` has group `null`. It reads the brain (notes, `brain.json` modules and Tasks mapping, `repos`) and `_assistant/dismissals.json` (`DISMISSALS_UNREADABLE` when damaged; missing means none). `--scope` names an Area, Domain or Project (`UNKNOWN_ID`; another type is `INPUT_INVALID`); `--limit` and `--number-from` are integers of at least 1 (defaults 10 and 1), else `USAGE`. `--exclude` is a JSON file holding an array of strings, each a finding key or a subject key (`notion:<dashed page id>`, a `prj-` or `area-` id; anything else is `INPUT_INVALID`; `INPUT_UNREADABLE`): a finding key leaves out that finding, a subject key every finding whose subject is that task, project or Area (a pair when either of its projects is), after the dismissals; they are counted in `excluded` (assistant.md §3.5). The dismissals include findings whose key is the `finding` of a proposal rejected less than 30 days before `as_of` (assistant.md §3.5). `as_of` is the snapshot's, not `--now`.

```json
{ "data": {
    "as_of": "2026-11-06T10:00:00Z",
    "mode": "live",
    "scope": null,
    "read": { "tasks": 42, "projects": 9, "areas": 6, "projects_not_in_brain": 0, "areas_not_in_brain": 0 },
    "statuses_as_of": null,
    "skipped_signals": [ { "signal": "area_no_domain", "reason": "MODULE_OFF" } ],
    "repos_failed": [],
    "total": 24, "dismissed": 3, "excluded": 0, "number_from": 1,
    "findings": [
      { "rank": 1, "key": "task_overdue:notion:2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e", "signal": "task_overdue", "category": "overdue",
        "subject": { "kind": "task", "id": null, "page_id": "2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e", "title": "Send the revised quote",
                     "current": { "status": "To Do", "due": "2026-10-29", "projects": ["7c6b5a49-3827-4615-a4b3-c2d1e0f9a8b7"], "areas": [] } },
        "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n",
        "evidence": { "due": "2026-10-29", "days_late": 8, "status": "To Do" },
        "recommendations": [
          { "letter": "a", "action": "set_task_due", "value": null, "label": "give it a new due date" },
          { "letter": "b", "action": "set_task_status", "value": "Done", "label": "mark it Done" },
          { "letter": "c", "action": "set_task_status", "value": "Won't Do", "label": "mark it Won't Do" } ],
        "status_offers": [ { "action": "set_task_status", "value": "Waiting On" }, { "action": "set_task_status", "value": "Someday" } ] }
    ],
    "report": "Ultimate Assistant · whole brain · 6 Nov 2026\n…"
} }
```

- `mode` is `live` or `brain_only` (the snapshot's `notion` is `unreachable`). `statuses_as_of` is, brain only, the oldest `notion_fields.as_of` over every project and Area note that has `notion_fields` and isn't `lifecycle: archived` or under `archive/` (`null` live, or when there is none). `read` counts the snapshot's rows and the Projects and Areas rows that match no note (assistant.md §2.1), over the whole snapshot whatever `--scope`; brain only, every count is 0.
- `skipped_signals` lists each signal not computed, once, in assistant.md §3.3's table order, with `reason` `NOTION_UNREACHABLE`, `MODULE_OFF` or `NOT_MAPPED` and, for `NOT_MAPPED`, `property` (`status`, `due` or `project`). `repos_failed` echoes the snapshot's `repos` entries that carry `error` (`[{ name, error }]`).
- `subject`: `kind` `task`, `project`, `area` or `project_pair`. A task has `id: null`, `page_id`, `title` and `current` `{ status, due, projects, areas }` (the snapshot's values); a project `id`, `page_id` (its page, assistant.md §2.1, or `null`), `title` and `current` `{ status, archived, area }`; an Area `id`, `page_id`, `title` and `current` `{ archived, domain }`; a pair `ids` `[duplicate, survivor]`, `titles` in the same order and no `current`.
- `project` and `area` place the finding ("first" by title, then id, assistant.md §3.1): for a task, its first live project in the brain and that project's `area`, else its first project in the brain and that project's `area`, else `null` and the first brain Area whose page (assistant.md §2.1) is in its `areas`; for a project, itself and its `area`; for an Area, `null` and itself; for a pair, the survivor and its `area`. The skill copies `area` into the proposal it writes (§5.6), so the session names the right area when it asks.
- `recommendations` and `status_offers` follow assistant.md §3.4; `value` holds brain ids for notes (`prj-`, `area-`, `dom-`), `{ "target", "merge_into" }` for `merge_projects`, `{ "project" }` for `add_task`, `true` for `archive_area`; `label` is the report's wording (§4.1). The skill turns a note id into the page id a `notion_change` needs: the note's page (assistant.md §2.1), which is `subject.page_id` when the note is the subject.
- `read.projects_not_in_brain` and `read.areas_not_in_brain` count the rows that match no note, neither by `brain_id` nor by a note's `notion` equal to `page_id`, plus each row that loses a shared `brain_id` to a row with a lower `page_id` (assistant.md §2.1).
- `findings` holds the page: the first `--limit` findings, ranked (assistant.md §3.5; `rank` = `--number-from` + position − 1); `total` counts every finding after the scope, the dismissals and `--exclude`, `dismissed` those in scope the dismissals removed, `excluded` those in scope `--exclude` removed.
- `report` is the text of assistant.md §4.1 for this page, ending with one newline.

Exit 0, findings or not. Errors: `INPUT_UNREADABLE`, `INPUT_INVALID`, `UNKNOWN_ID`, `DISMISSALS_UNREADABLE`, `BRAIN_CONFIG_INVALID`.

**`assistant dismiss`** keeps the skipped findings (assistant.md §8). Input: `{ "dismissals": [ { "key": "<finding key>", "reason": "<the user's words, may be empty>" } | { "key": "<finding key>", "remove": true } ] }`, at least one item, each key once (`INPUT_INVALID` otherwise). A key is `<signal>:<subject key>` with a signal of assistant.md §3.3 and the subject key its signal takes: `notion:<dashed page id>` for a task signal, a `prj-` id for a project signal, `<prj id>+<prj id>` (two different ids, sorted) for `project_duplicate`, an `area-` id for an Area signal (`INPUT_INVALID`); on an item that adds or replaces, a brain id must name a note (`UNKNOWN_ID`); a `remove` item isn't checked against the notes. Checks run before any write; one failing item writes nothing.

It reads `_assistant/dismissals.json` (`DISMISSALS_UNREADABLE` when it exists and is damaged), drops every entry whose `until` is at or before now (`--now`), then per item: a new key is `added`, an existing one `replaced` (new `reason`, `dismissed_at` and `until`), a `remove` deletes the entry (`removed`, or `unchanged` when there is none). `dismissed_at` is now and `until` now plus 30 days, both with seconds and `Z`. It writes the file atomically (creating `_assistant/`) in the format of assistant.md §8, or deletes it when no entry is left. Logs `assistant-dismiss - key=<key> result=<result>` per item.

`data` = `{ "path": "_assistant/dismissals.json", "items": [ { "key": "…", "result": "added" | "replaced" | "removed" | "unchanged", "until"?: "…" } ], "pruned": <n> }`. Exit 0. Errors: `INPUT_UNREADABLE`, `INPUT_INVALID`, `UNKNOWN_ID`, `DISMISSALS_UNREADABLE`.

### 5.32 `brain reflect --candidates` (0052, 0076)

```text
brain reflect --candidates [--limit <n>] [--offset <n>]
```

The deterministic half of reflection: it finds **clusters**, places in the brain where something may be wrong, and the skill brain-reflect reads each one, judges it and talks with the user (§6.2). It writes nothing. `brain reflect` without `--candidates` is `USAGE` with the message `brain reflect requires --candidates; use the brain-reflect skill to tidy the brain`; an extra argument is `USAGE` (`Unexpected argument: <it>`). `--limit` is an integer from 1 to 100 (default 30) and `--offset` an integer of at least 0 (default 0), else `USAGE`.

**Terms (normative).**
- **Input:** a meeting, or a source of any kind except `minutes` (a meeting's minutes source is that meeting, so it counts once). An input's **date** is a meeting's `date`, or the UTC date of a source's `captured`; its **created** is its own `created`. Its **text** is its title, its `summary` and its body lines, Markdown headings (lines starting with `#`) left out: a meeting's fixed sections ("Action items") would otherwise recur everywhere.
- **The window:** the inputs whose date is within the 30 days that end on `--now`'s date, both ends included (0052; fixed, not a setting).
- **No memories** (CC-345): reflection leaves every memory out, whatever its lifecycle and reach: a memory is never a member, an input, a name that carries a term, or a reference. It has no caller to judge reach by, and duplicate or stale memories are the closing review's (`supersede`, memory.md). The `near-duplicate` lint and the weekly review, which share these signals, leave memories out the same way.
- **Restricted evidence** (0076 §6): §5.13's rule holds throughout, exactly as `query` applies it. A source it leaves out (an older version or a full copy of a changed input) is no input; a blanked line is no text; a note it leaves out whole is never a member and gives no names; a timeline entry or fact it drops is not read. A note with a restricted claim, member or input, is read in its awaiting-cleanup form (§5.13; eligibility.md §6 rule 3): its title and aliases give no names (no `near_duplicate`, no "an input names a note" by a name, and they carry no term away from `recurring_term`), its title, summary, headings and withheld frontmatter give no text or term, and in the output its `title`, `path` and `summary` are `null` and it has `cite`. Its id and a link to its file still name it. An unreadable suppression record fails the command with `SUPPRESSIONS_UNREADABLE`.
- **Tokens:** §5.13 step 1's normalization (NFKD, combining marks dropped, lowercase, split on runs outside `[a-z0-9]`), keeping every token, stopwords and single letters included.
- **Names of a note:** its `title` and each of its `aliases`. **Two names match** when they have the same number of tokens, at each position the two tokens are equal or one is a single letter equal to the other's first letter, and at least one position has equal tokens of two or more letters: `María López` and `M. Lopez`, `Acme Corp.` and `ACME corp`; not `Maria` and `Maria Lopez`, nor `M. L.` and `Mark Lee`.
- **An input names a note** N when its frontmatter holds N's id (any field), its body links N's file, or its title or a body line holds the tokens of one of N's names consecutively (a one-token name only when that token has 3 or more characters).
- **An input is in a note's `sources`** when the list holds its id, its `source_key`, or, for a meeting, its `source`'s id or `source_key`.
- **References of a note:** the note ids in its frontmatter (relations' targets included) except in `id`, `sources` and `area`, plus every note whose file its body links; its own id is never one. Two notes' **common ground** is the references they have in common, except meetings, sources, domains, areas, goals and projects: notes taken from one meeting share that meeting and the project it was filed under, which says nothing about what they claim (#266).
- **Prose of a line:** the line with inline code (`` `…` ``), link targets (`](…)`; the link's text stays), autolinks (`<scheme:…>`), URLs (`scheme://…`, `www.…`), email addresses, and words with a dot followed by two or more letters (domains and file names: `example.com`, `notes.md`, with any `/…` after them) each replaced by a space; an apostrophe between two letters is dropped, so a contraction is one token (`don't` is `dont`).
- **Term stopwords:** §5.13 step 1's stopwords and these words, which open or close a phrase without naming a subject: `i me my you your he him his she her they them their our us its these those there here am been being were can could would should shall may might must not no yes if but so than then too very make made get got put take like well now still even much many new next last sure soon possible today tomorrow yesterday day days week weeks month months year years dont doesnt didnt cant couldnt wont wouldnt shouldnt isnt arent wasnt werent im ive youre youve theyre lets thats theres whats just also all any some each more most other such only own same about into over after before up out off again per via` and `le les mi tu sus nos o pero si ya muy mas este esta ese esa son fue ha hay sin sobre entre`.
- **Boilerplate:** a line of text (title, summary or body line) whose tokens, after its prose, are the same sequence in two or more window inputs: a signature, a sign-off, a disclaimer, a template line. Boilerplate holds no terms (#266).
- **A term:** a run of 2 or 3 consecutive tokens within the prose of one line of an input's text (its title, its summary, or one body line) that isn't boilerplate, whose first and last tokens are not term stopwords, and none of whose tokens has one character or is only digits. Its text is its tokens joined by one space (`pricing tiers`), its slug the same joined by `-` (`pricing-tiers`). A note's name **carries** a term when the term's tokens appear consecutively among the name's tokens.

**Signals (normative; the names are stable).**

| Signal | A cluster | Members | Evidence | Findings it can give (§6.2) |
|---|---|---|---|---|
| `shared_ground` | two `reviewed` notes, neither a meeting, at least one of them `updated` within the window, with two or more references in their common ground | the pair | none; `shared` lists their common ground | contradiction |
| `overtaken` | one `reviewed` note, not a meeting, not a Document whose `origin` is `whole`, `part` (or absent) or `workflow`, named by one or more window inputs that aren't in its `sources` and whose date is after its `updated` | the note | those inputs | stale fact, contradiction, promotion |
| `near_duplicate` | two notes of one type, each `draft` or `reviewed` (drafts only here, 0052), a name of one matching a name of the other; not meetings (a recurring meeting repeats its title), not domains, areas, goals or projects (Ultimate Assistant's `project_duplicate` covers the structure of your work, 0064's boundary), not Documents whose `origin` is `whole`, `part` (or absent) or `workflow` (one source's whole text and its parts share a title on purpose) | the pair | none; `names` gives the two matching names | duplicate |
| `recurring_term` | a term in the text of three or more window inputs that no knowledge note's name carries (any lifecycle: a draft or an archived note that carries it counts) and none of whose tokens is in a person's name (a token of 3 or more characters, not a term stopword, of a person note's names; the owner is in it through `brain.json` `owner.person`): people are no theme | none | those inputs | theme |

A note is in as many clusters as it qualifies for. Three notes whose names match are three `near_duplicate` pairs. A term whose inputs are exactly those of a longer term that contains it is no cluster: only the longer one is.

**Holds** (schema §11.4). A `near_duplicate` cluster whose `merge:<pair>` fingerprint is held, and a `recurring_term` cluster whose `theme:<slug>` fingerprint is held, are left out and counted in `held`. A `shared_ground` or `overtaken` cluster is returned with `held`: every held fingerprint of a `contradiction`, `stale` or `promotion` whose target is one of its members, so the skill doesn't propose that finding again.

**Order and the page.** By signal, in the table's order (0052's severity: contradictions, then stale facts and promotions, then duplicates, then themes); within a signal, `shared_ground` by the number of common references, `overtaken` and `recurring_term` by the number of inputs, both descending; then by the newest date among its members' `updated` and its inputs' dates, descending; then by `key`. `total` counts every cluster after the holds; `clusters` holds the ones ranked `--offset` + 1 to `--offset` + `--limit`, each with that `rank`.

```json
{ "data": {
    "as_of": "2026-11-08T10:00:00Z",
    "window": { "from": "2026-10-10", "to": "2026-11-08" },
    "read": { "notes": 412, "inputs": 37 },
    "total": 18, "held": 2, "offset": 0,
    "clusters": [
      { "rank": 1, "key": "shared_ground:dec-2p9f6h1r+prj-9x4t1b7e", "signal": "shared_ground",
        "notes": [
          { "id": "dec-2p9f6h1r", "type": "decision", "title": "Launch Acme website in February", "path": "knowledge/decisions/2026-11-03-launch-acme-website-in-february.md", "lifecycle": "reviewed", "updated": "2026-11-04", "summary": "…" },
          { "id": "prj-9x4t1b7e", "type": "project", "title": "Acme website", "path": "projects/acme-website/project.md", "lifecycle": "reviewed", "updated": "2026-10-02", "summary": "…" } ],
        "shared": ["org-6d1f9z3k", "per-3h8w2n6c"], "held": [] },
      { "rank": 2, "key": "overtaken:per-3h8w2n6c", "signal": "overtaken",
        "notes": [ { "id": "per-3h8w2n6c", "type": "person", "title": "María López", "path": "knowledge/people/maria-lopez.md", "lifecycle": "reviewed", "updated": "2026-09-14", "summary": "…" } ],
        "evidence": [
          { "id": "mtg-8c4n2p7w", "type": "meeting", "title": "Acme sync", "path": "knowledge/meetings/2026-11-03-acme-sync.md", "date": "2026-11-03", "created": "2026-11-03",
            "lines": [ { "line": 14, "text": "María left Acme in June; Tomás now leads the account." } ] } ],
        "held": [ { "fingerprint": "contradiction:per-3h8w2n6c:role", "state": "skipped", "proposal": "prp-2r9c5w8n" } ] },
      { "rank": 9, "key": "near_duplicate:per-3h8w2n6c+per-4t7x2c9m", "signal": "near_duplicate",
        "notes": [ "…the two notes, as above…" ], "names": ["María López", "M. Lopez"], "fingerprint": "merge:per-3h8w2n6c+per-4t7x2c9m" },
      { "rank": 14, "key": "recurring_term:pricing-tiers", "signal": "recurring_term", "notes": [],
        "term": "pricing tiers", "fingerprint": "theme:pricing-tiers", "evidence": [ "…four inputs…" ] }
    ]
} }
```

- `key` is `<signal>:<member ids, sorted, joined by +>`, or `recurring_term:<slug>`. `notes` are the members, sorted by id (`summary` as §5.13 restricts it; a member or an `evidence` input in the awaiting-cleanup form has `title` and `path` `null` and a `cite` key). `names` is in the order of `notes`.
- `evidence` lists **every** input of the cluster, by date descending, then id; the skill copies its ids into the proposal's `evidence` (schema §11.4). `lines`: up to 3 body lines that name the member (`overtaken`) or hold the term (`recurring_term`), trimmed to 200 characters; `[]` when only the title, the summary or the frontmatter does.
- `fingerprint` is the cluster's own finding's, on `near_duplicate` and `recurring_term`. `held` (on `shared_ground` and `overtaken`): `{ fingerprint, state: "waiting" | "skipped", proposal }`, where `proposal` is the latest proposal with that fingerprint; sorted by fingerprint.
- `read.notes` counts the knowledge notes read, `read.inputs` the inputs in the window.

Exit 0, clusters or not. Errors: `USAGE`, `SUPPRESSIONS_UNREADABLE`.

### 5.33 `brain recall` (0074, [memory.md](memory.md))

```text
brain recall --pack [--repo <path>] [--task "<text>"] [--budget <n>]
brain recall --search "<query>" [--repo <path>] [--limit <n>] [--include-superseded]
```

Read-only. `--pack` builds the opening context for the caller (memory.md §5): the active task rows of the caller's repo and the eligible memories (memory.md §2), within `--budget` estimated tokens (default 800, an integer from 200 to 4000). `--search` returns the eligible memories that match the query (memory.md §6.1); `--limit` is an integer from 1 to 50 (default 10). The caller is `--repo`, else the current directory, and its identity is the `.brain` in it (memory.md §2.1). The output, the selection order, the token estimate and the reach rules are memory.md's. The restricted-evidence rule applies as in `query` (§5.13); an unreadable suppression record fails with `SUPPRESSIONS_UNREADABLE`. A memory's `sources` entry is left out (memory.md §2 rule 4) when it names notes and the rule leaves out every one of them: a note id names that note, and a source key the source notes with that `source_key`. An entry that names no note in the brain, such as an agent session key, is not left out (an id that names none is lint's `missing-ref`).

The `.brain` is read by the one reader every command shares (§5.13 step 4, CC-152): one that is not valid JSON, or has a key §5.12 doesn't list, is `USAGE` naming the folder.

Errors: `USAGE` (neither or both of `--pack` and `--search`, an extra argument, a value out of range, a flag the mode doesn't take, a `--repo` that isn't a folder, an invalid `.brain`), `SUPPRESSIONS_UNREADABLE`. No new error or warning code.

### 5.34 `brain weekly` (0075, 0093, [weekly-review.md](weekly-review.md))

```text
brain weekly plan --snapshot <file|-> [--now <ts>]
brain weekly select --input <file|->
brain weekly record --input <file|->
brain weekly corrections list [--offset <n>] [--limit <n>] [--now <ts>]
brain weekly corrections done --input <file|-> [--now <ts>]
```

**From 0.17.0** (decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md), weekly-review.md §3, §15) the commands below write the row's two parts. What changes, in each: `plan` also holds `cleanup` (the mechanical items of `brain cleanup plan`, §5.38), `done` (the snapshot's tasks and projects finished in the window, weekly-review.md §3.2) and `carry` (the pending items of earlier rows to carry: rows whose Brain Status in the snapshot is still `New`, weekly-review.md §15.6; the skill adds the brain's Weekly rows, their page, week and Brain Status, to the snapshot); `quiet` counts them (weekly-review.md §9.1). `select` fills A, C and T (weekly-review.md §5) and drops a finding whose note this run's clean-up merged or archived. `record` takes `cleaned` (`cleanup apply`'s `applied`), writes the two parts and checks their shape (weekly-review.md §3.3), gives each row item its label and base in `_weekly/state.json` (§9.5 there), sets `weekly` on each row item's proposal, and, for a carried row, rewrites that earlier week's report once with its `Moved to …` line (§15.6). `counts` becomes `{ actions, doubtful, cleaned, targets, queued }`. The shapes are in `spec/schemas/weekly.schema.json` (CC-370). In detail:
  - **Snapshot:** the skill adds `weekly_rows`: `[ { "page", "week", "brain_status": "New"·"Ready"·"Done" } ]`, the brain's Weekly rows as it read them (`assistant.schema.json`). An earlier row whose report has no Notion page (never published) is carried as a `New` one would be, since nobody could tick it.
  - **`plan`** also gives `source` (`agent:brain-weekly-review/<as_of compact>`, what the skill writes the week's proposals with), `cleanup_auto` and `pending[].weekly`, the row week of each pending proposal (`null` when none). A carried item whose finding the user dismissed since is not carried while the dismissal stands (weekly-review.md §7). `cleanup` keeps the items of this week's own row, so a same-week rerun offers them again with their labels.
  - **`select`** takes `judged.next_steps` (`[ { "key", "task_title", "why" } ]`): for a plan finding `project_no_next_step` whose project is in the brain, the words of its next step, which make it an Action with a `new_task` `proposal_input` (weekly-review.md §6.1); without one, that finding is Focus first only. Each item has `part` (`A`, `C` or `T`); a mechanical item (with `settings.cleanup.auto` off) and a next step carry `proposal_input`, the exact `proposal new` input; a carried item has `because: carried`, its proposal and `carried_from`. 0.15.0's `lives`, `url` and `new_items` are gone: a task item is no longer an item (Focus first only).
  - **`record`** takes `in_short`, `highlights` (at most 6) and `focus_first` (1 to 3) in place of `what_changed` and `task_analysis`, and `cleaned`. `data` adds `moved`: the earlier reports it rewrote with their `Moved to …` line (`[ { "id", "path", "week" } ]`). An item of such an earlier row that didn't move (its finding dismissed since) goes back to the session: its `weekly` is cleared.

The deterministic half of the weekly review. The skill `brain-weekly-review` reads Notion, judges clusters and correction targets, and writes the prose; these commands do the rest. Behaviour is normative in weekly-review.md. The JSON shapes are the `$defs` of `spec/schemas/weekly.schema.json`: `plan` (`plan`'s `data`), `selectInput` and `selection` (`select`'s input and `data`), `recordInput` (`record`'s input), `state` (`_weekly/state.json`) and `attempt` (`_weekly/attempt.json`). An input that fails its `$defs` entry is `INPUT_INVALID` with pointers.

**The snapshot file** (weekly-review.md §1 step 2). The skill writes the assistant snapshot with its file-writing tool to `weekly_snapshot`, the path `brain status` gives (§5.2): `~/.ultimate-brain/weekly/<folder>-<hash>.json`, where `<folder>-<hash>` is the brain's part of a schedule label (§5.21). It is outside the brain, so Notion's rows are never committed, and one file per brain, overwritten by each run and never removed, so it holds only the latest snapshot. `plan` reads it with `--snapshot <path>`; no heredoc and no pipe, which a scheduled run's allow list refuses.

**The hand-off files.** `plan`, `select` and `record` pass their data to each other through files the CLI writes beside the snapshot, in the same folder: `<folder>-<hash>.plan.json` (the full plan, `$defs/plan`) and `<folder>-<hash>.selection.json` (`$defs/selection`), 2-space JSON. The model reads the plan file with its file-reading tool and never has to copy it: `select`'s and `record`'s inputs name it by `input_hash`. They exist because a large brain's plan is far above Claude Code's 30k Bash output limit, whose saved output a scheduled run's allow list can't read, and copying the plan into two inputs would cost the model a large share of its budget. **Kept** from the `plan` that writes them until the `record` that succeeds on them: `record` removes both once it has written the report and the state; a non-quiet `plan` replaces the plan file and removes any selection file; a quiet `plan` writes and removes nothing; a run killed in between leaves them until the next run replaces them. They are outside the brain, so they are **never in the brain repo**. The snapshot file itself stays, overwritten each run. Embedding `plan` (and `selection`) in the inputs instead remains allowed, for tests and attended use; then no file is read, and `select` still saves its file. The weekly job's allow list (weekly-review.md §11) therefore holds `Read(~/.ultimate-brain/weekly/**)` and `Edit(~/.ultimate-brain/weekly/**)` (Claude Code's `Edit` rules govern its Write tool too) beside `Bash(brain:*)`, `Bash(git:*)`, `Bash(date:*)` and `Bash(jq:*)`.

- **`plan`** writes nothing in the brain. It takes the assistant snapshot (assistant.md §2.1), saves the plan file (above; not when quiet) and returns `$defs/planSummary`: `week`, `as_of`, `local_date`, `notion`, `window`, `report`, `input_hash`, `quiet`, `file` and the lengths of the plan's lists. The plan holds `week`, `window`, `as_of`, the What changed candidates (weekly-review.md §4.2), every assistant finding (§5.31's rules, no page cap), the reflection clusters (§5.32's rules, with `--limit` = `settings.weekly.max_judged`), the correction claims and their candidate targets (weekly-review.md §8.1, §8.2), each candidate's repetition state (§7), this week's counts from `_weekly/state.json`, `input_hash` and `quiet` (§9.1, a same-week rerun included). Errors: `INPUT_INVALID`, `WEEKLY_STATE_UNREADABLE`, `SUPPRESSIONS_UNREADABLE`, `DISMISSALS_UNREADABLE`.
- **`select`** writes nothing in the brain. It takes the skill's judgments with the plan, by `input_hash` (it reads the plan file; a missing file, or one with another `input_hash` → `INPUT_INVALID`, plan again) or embedded, and returns the decision items, the queued remainder and the counts, by weekly-review.md §5 to §7, with the plan's `input_hash`. It saves the same data as the selection file. It reads the brain (notes, proposals) and `_weekly/state.json` for the repetition of the judged knowledge findings. Besides the schema, `INPUT_INVALID` when: `plan.week` isn't the week of `plan.local_date`; `plan.quiet` is `true` (a quiet run selects nothing); a judged cluster or a finding's `cluster` isn't in `plan.clusters`; a finding's targets name no note; two findings share a fingerprint; a correction judgment's claim or note isn't among `plan.corrections`' targets; a correction target is judged twice, or judged while it has `pending`; a target with `line_after` `null` and no `field` is judged `restatement` (judge it `uncertain`, weekly-review.md §8.2). Errors: `INPUT_UNREADABLE`, `INPUT_INVALID`, `WEEKLY_STATE_UNREADABLE`.
- **`record`** writes the report (§2, §3; `INPUT_INVALID`, `WEEKLY_TOO_LONG`) and `_weekly/state.json` (§9.5) in one atomic step, and logs the `weekly` line (§3.9; weekly-review.md §9.2). It takes the plan and selection by `input_hash` (it reads both files; a missing file, or one whose `input_hash` differs → `INPUT_INVALID`) or both embedded, and on success removes the hand-off files. Rerunning it for the same week rewrites that week's report in place. `data` = `{ "id", "path", "week", "coverage", "counts", "changed" }`. Besides the schema and the shape check of weekly-review.md §3.4, `INPUT_INVALID` when: `selection.week` differs from `plan.week`, or `selection.input_hash` from `plan.input_hash`; `plan.quiet` is `true`; the items' `n` aren't 1, 2, … in order; `selection.counts.decisions` is less than the number of items; an item with `write: true` has no entry in `proposals`, or `proposals` names a key that is no such item; a proposal named doesn't exist or isn't `pending`; `publish` is `true` with `mode` `unattended` while `settings.publish` isn't `auto` (an unattended run publishes only with `auto`, weekly-review.md §9.3; the Reports module doesn't matter, since the report is an Inbox row); `plan.week` differs from the week of `--now`'s local date (a stale plan); this week's state changed since `plan` (its `input_hash` or counts no longer match `week_state`). Errors: `INPUT_UNREADABLE`, `INPUT_INVALID`, `WEEKLY_TOO_LONG`, `WEEKLY_STATE_UNREADABLE`.
- **Its Inbox row** (0.16.0, decision 0096 §7; weekly-review.md §2, §9.3). The report `record` writes (view kind `weekly_review`) is published by `sync render` as one Inbox row, **Kind Weekly**: Name `Week of <D Mon YYYY>` (the week's Monday: `Week of 9 Nov 2026`), Brain ID = the view's id, the report as its body. `create` when the view has no `notion`, else `update`, so a rerun in the same week updates that row and never adds one. **Brain Status** is `New` on create; the user sets it `Ready` (weekly-review.md §15.4); it becomes `Done` at the publish that finds nothing in the row waiting: from 0.17.0, every proposal its `A` and `C` labels name terminal (`applied`, `rejected` or `closed`) or moved to a later week, so a row with no `A` or `C` item is `Done` at its first publish (before 0.17.0: every proposal its decision items named terminal, task items not counting). A publish never sets `New` back over `Ready`. **The ticks and notes are the user's** (weekly-review.md §15.7): publishing an existing Weekly row needs `--row-state <file>`, the row's to-dos as the skill read them through the MCP just before (`{ "page", "items": [ { "label", "ticked", "note" } ] }`, as `cleanup ticks`' input, or a list of them, one per row; `$defs/rowState`), and the body is written with each item still offered ticked and noted as there, an item no longer offered losing its line; without it, the row is `skipped` with reason `ROW_STATE_REQUIRED`, so no publish can clear a tick. Under each `C` item the body has the toggle **Show the change** (weekly-review.md §15.5) and the line **Your note:**; under each `A` item, whose line holds its whole change, the line **Your note:** only. In the Notion body (CC-370) the item's `[Show the change](…)` link is left out, and under the to-do, indented one tab, come `<details>`, `<summary>Show the change</summary>`, the change's lines indented one more tab, `</details>`, then `Your note: <the note read>` (`Your note:` when empty); a ticked item's to-do is `- [x]`. A `U` item has neither. It needs neither the Documents nor the Reports module; an unattended run publishes it only with `settings.publish: auto`. It is never taken in as an input (`sync plan` passes it with its Brain ID only, §5.14.1). `sync render --changed` selects it, whatever the Documents and Reports modules, when it has no `notion`, or when its body or a rendered property (Name, Kind, Brain Status, Brain ID) changed since S. **A weekly review published as a Documents row in 0.15.x** (its `notion_published` has `Origin`) is history: it is never rendered again, so `--changed` leaves it out silently and `--ids` naming it lists it in `skipped` with reason `HISTORY` (not an error); a same-week rerun of such a week rewrites its file and keeps that Documents page, and the week gets no Inbox row. Before 0.17.0 its decision lines ended with `decide in Claude Code or Codex: *what needs my decision*`; from 0.17.0 the session's items are counted in Waiting for you's line instead. No proposal is published as a row (capture-and-review §7.1).

- **`corrections list`** (weekly-review.md §8.1, the on-demand path) writes nothing. It gives the queued claims, as `plan` would list them now (new to the cursor, or in `corrections.open`), each with its candidate targets (`$defs/claim`), oldest claim first, then claim key, with no snapshot, window candidates or weekly limit: `data` = `{ "claims": [ … ], "total", "offset", "next_offset" }`, `--limit` claims from `--offset` (defaults 10 and 0; `next_offset` `null` at the end). Errors: `WEEKLY_STATE_UNREADABLE`.
- **`corrections done`** records what the on-demand path finished. Input: `{ "claims": [ { "claim": "<claim key>", "open": ["<note id>", …] } ] }`: each claim the chat went through, with the targets it left queued (a later; `[]` when it finished the claim). Every claim key must be one `corrections list` gives now, and every `open` id one of its candidate targets (`INPUT_INVALID`). It writes only `corrections` of `_weekly/state.json` (creating the file with an empty state when it is missing), by weekly-review.md §8.4's rule with the run's local date: a claim with no `open` target is finished, one with some stays in `open` with those, and every queued claim the input doesn't name stays in `open` with all its candidate targets, so moving `checked_on` skips nothing. `data` = `{ "finished": [<claim>…], "open": [<claim>…], "checked_on" }`. Logs `weekly-corrections finished=<n> open=<n>`. Errors: `INPUT_UNREADABLE`, `INPUT_INVALID`, `WEEKLY_STATE_UNREADABLE`.

`brain status` gains `unattended.weekly` (weekly-review.md §9.3, §9.5), `null` when the log has no `weekly` line and there is no attempt marker. From the **last `weekly` log line** (weekly-review.md §9.2): `last` is its timestamp; `week`, `coverage` (`complete`, `partial` or `none`) and `decisions` are its fields (from 0.17.0 `actions`, `doubtful` and `cleaned` too, and `decisions` is `actions` + `doubtful` for a line that has them: the items to tick, not the ones already cleaned); `failed` is its `failed` count; `failures` is its `failures` value split on `; ` (`[]` when absent). `report` is the path of that week's report from `_weekly/state.json` `weeks.<week>.report`, or `null` (a failure-only run, `coverage=none`, writes none). From the **attempt marker**: `unfinished` is `{ "week", "started", "mode" }` when `_weekly/attempt.json` exists and its `started` is more than 2 hours before now, else `null`.


### 5.35 `brain source check` (0.16.0, decision 0098 §4; capture-and-review §12)

```text
brain source check --input <file|->
```

Renders the Notion page of a **checked row**: the changed text of a document, written to the Inbox for the user to check before it goes in (capture-and-review §12.3). Writes nothing; the skill creates the page through the MCP. Like `sync tasks`, it is the deterministic part of a Notion write the skill makes.

Input:

```json
{ "original": "src-4m9q2x7c", "file": null, "title": "Ops plan (changed)",
  "text": "## Pilot\nThe pilot covers 11 depots in three regions…\n",
  "changes": ["Dropped: Hiring (section 3)", "Dropped: Appendix A (budget)", "Altered: depot count 9 → 11"],
  "document_asked": false }
```

Each refused with `INPUT_INVALID` and its pointer:
- `original` an existing source (`UNKNOWN_ID`) of kind `document`, `email`, `chat` or `note`, never `minutes`, `capture` or `task` (capture-and-review §12.1, §12.9). The row links the original's Inbox row: for an attached file (`attached_to`), the page in its capture's `source_key` (always `notion:`, schema §4), which exists whether or not the capture was published; for any other original, its own `notion`, refused when it has none (`ORIGINAL_NOT_PUBLISHED`). The skill gets that `notion` first, in capture-and-review §12.3 step 1's order: `note new` (the original, and for a file attached to a row not taken in yet its capture and every file attached to it), then `sync render --ids <their ids>` + MCP, then `sync record`, which writes `notion` (§5.14.4, §5.14.6);
- `file`: `null`, or for an attached file its `file_name`, which must be the original's;
- `title` non-empty, at most 120 characters; `text` non-empty Markdown, LF;
- `changes` a non-empty list of one-line strings, each starting `Dropped: ` or `Altered: ` with text after it;
- `document_asked` a boolean (true for Keep as document with Only keep, or when the user asked for the changed text to be kept as a Document), refused true with the Documents module off (`MODULE_OFF`).

Output: `{ "data": { "database": "inbox", "action": "create", "properties": { … }, "body": "…" } }`, with `properties` in the normalized form of §5.14.1: Name = `title`; Kind = `Changed`; Changed from = `[<the original's notion>]` (for an attached file, its capture source's `notion`); What changed = the `changes` lines joined by line breaks, after a first line `File: <file>` when `file` is given; Brain Status = `New`; Document asked = `document_asked`; Project and Area = the original's `projects` and `area` as page ids, those without a page left out; no Brain ID. `body` = `text`. Nothing is published as a baseline: the row has no source until it is taken in.

**Taking it in** (capture-and-review §12.5). On "go", or when a catch-up takes in the row set Ready, the skill reads the row and writes its source with `note new` (§5.5): key `notion:<row page id>`; when the brain already has a source with that key (the row was taken in before, then edited and set Ready again), `replaces` = its latest version, found by following `replaces` forward from it (schema §4, "Versions"), and the same text is `DUPLICATE_SOURCE`; the original's `kind`, `checked_from` = the source whose `notion` is the row's Changed from (for a row whose What changed starts `File: <name>`, the source with that `file_name` attached to it), `changes` = What changed's other lines, `notion` = the row's page id, `area` and `projects` from the row, the body read from the page. A row whose Changed from or `File:` line names no source, or more than one, isn't taken in: the run names it under Needs you (`CHECKED_FROM_UNKNOWN`), and an attended session asks which original it is. The ingest then goes by subject (capture-and-review §7.3); with Document asked ticked, the same `note new` batch writes the `whole` Document, and the skill clears the box and publishes the row (§5.14.4: Brain ID, Brain Status Done, Summary).

**Which rows are checked rows.** An Inbox row with Changed from set and no Brain ID. The catch-up reads them in its read-only pass: the Ready ones are inputs (§6.1), and the ones still New are counted under an attended run's Needs you (capture-and-review §12.8). Changed from is the one marker: a Kind you changed by hand doesn't change what the row is.

### 5.36 `brain minutes check` (0.17.0, decision [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §8.3; capture-and-review §3.4.2)

```text
brain minutes check --page <notion-page-id> --minutes <file> --transcript <file> [--again] [--json]
```

Checks minutes the agent proposes to write on a meeting page against that page's transcript, before anything is written (capture-and-review §3.4.2). Read-only: it writes nothing, in the brain or anywhere else, and reads no note. The skill writes the minutes on the page only when `ok` is true. It is the CLI's half of 0079 §6's bar applied to every set of minutes the agent writes, the same bar the minutes prompt's release gate uses (`eval/minutes-0.14/`).

**Input.** `--minutes`: the proposed minutes, Markdown, as the skill would write them on the page. `--transcript`: the transcript the skill read from the page (capture-and-review §3.4, "Which transcript is read"). Both are read as `extract-plan` reads its files (§5.22): `\r\n` as `\n`; the minutes with Markdown escapes removed, as a summary is (capture-and-review §4.3), and the transcript as it is, so a quote passes here exactly when the ingest's `extract-plan` places it by §4.2 rule 1. An unreadable file, or one that is empty or only whitespace, is `INPUT_INVALID`.

**Once a page** (capture-and-review §3.4.2; confirmed by the author on 2026-11-18). `--page` is the meeting page's Notion id. When the log (§3.9, read across the month files) holds a `minutes-written` line with `page=<that id>` (ids compared without their dashes and case: the MCP gives an id in either form), the check stops at the problem `ALREADY_WRITTEN` and `ok` is false, with `shape` null, the counts 0 and the lists empty but for that problem, unless `--again` is given: the skill passes it only when the user asked in an attended session to write that meeting's minutes again. The command never writes that line: the skill logs it with `brain log minutes-written - page=<id> items=<n> passing=<n> mode=attended|unattended` after the minutes are on the page.

**How it reads.** The minutes are read as `extract-plan` reads a summary (capture-and-review §4.1, "Shapes" and "The lean shape"; whatever layout that section reads as lean, 0106 §13's included), and the transcript is numbered into paragraphs as §4.2 says. Then:
1. **The shape** must be lean (capture-and-review §4.1, "Shapes"): minutes the agent writes are in the current format. Any other shape is the problem `NOT_LEAN`, and nothing below is counted: `shape` is the shape read, the counts 0 and the lists empty but for that problem.
2. **Blockers:** every problem that makes `extract-plan`'s `ok` false (`SELECTION_UNREADABLE`, `SELECTION_UNMAPPABLE`, `UNNUMBERED_LINE`) is a problem here too.
3. **Items.** Each readable item line (capture-and-review §4.1, the join) is an item. An item **passes** when it has a quote entry with at least one quote and **every** quote of it is placed exactly by §4.2 rule 1: it occurs, after whitespace normalization, in exactly one paragraph of the transcript. A stretch (rule 2) doesn't pass: the agent copies quotes, so a quote that only partly matches is a paraphrase. An item that doesn't pass is a **failure**, one for each quote of it that fails, with its reason: `no-quote-entry` (no quote entry, or one with no quote; one failure, no quote given), `not-found` (a quote that occurs nowhere; the quote is given) or `not-unique` (a quote that occurs in more than one paragraph; the quote is given). A quote entry with no readable line (`ORPHAN_QUOTE_ENTRY`) is a failure `orphan` and is not counted as an item.
4. **Follow-ups.** Every to-do of the Quick follow-ups group must be a follow-up with its own `q` id: a to-do with no `q` id is the problem `FOLLOW_UP_WITHOUT_ID` (its text given), and a `q` id on two to-dos is `DUPLICATE_FOLLOW_UP`.
5. **The bar** (0079 §6): at least 9 of 10 items pass, that is `10 × passing ≥ 9 × items`, and there is at least one item (`NO_ITEMS` otherwise: a meeting with no subject gets no minutes from the agent).

`ok` is true when there is no `ALREADY_WRITTEN`, the shape is lean, no problem of steps 2, 4 or 5 exists, and the bar is met. A failure under the bar doesn't make `ok` false by itself: the item is not imported at the ingest (§4.2 rule 3), and the skill fixes it before writing when it can (capture-and-review §3.4.2).

**Output.** `data` = `{ ok, shape, items, passing, needed, failures: [{ id, reason, quote? }], follow_ups, problems: [{ code, id?, text?, reason }] }`: `shape` as `extract-plan` names it (`lean`, `inline-quote`, `legacy`); `items` the count of items; `passing` the count that pass; `needed` the least `passing` that meets the bar (`ceil(9 × items / 10)`); `failures` in page order; `follow_ups` the count of follow-ups with a `q` id. Human output: one line `Minutes check: <passing> of <items> items pass (<needed> needed) · <follow_ups> follow-ups`, then `ok` or `not ok`, then one line per failure (`[s2.i3] not-found: “<quote>”`) and per problem.

**Exit code** (§3.4): 0 when `ok` is true; 1 when the check completed and `ok` is false (findings); 4 for `INPUT_INVALID`. Error codes: `INPUT_INVALID` only. The problem codes above are values in `problems`, not errors.

### 5.37 `brain minutes row` (0.17.0, decision 0101 §8.1; capture-and-review §3.4.3)

```text
brain minutes row --file <path> [--text <file>] [--json]
```

Renders the Meetings row of a **transcript file in the drop folder** (capture-and-review §3.4.3). Writes nothing; the skill creates the page through the MCP, as `source check` (§5.35) and `sync tasks` are the deterministic part of the Notion writes they serve.

**Input.** `--file`: the transcript file in the drop folder (its bytes give the hash, its name the title and date, its modified time the fallback date). `--text`: the file's text when the skill converted it (a `.docx` or `.pdf`, "Get the text"); without it the file itself is read as UTF-8 text, which is allowed only for `.txt`, `.md`, `.vtt` and `.srt` (`INPUT_INVALID` otherwise, and for a file that isn't valid UTF-8). `\r\n` is read as `\n`. An unreadable file, or text that is empty once read, is `INPUT_INVALID`.

**The text.** A `.vtt` or `.srt` file (by `--file`'s extension) is read as captions: the `WEBVTT` header and its metadata lines, `NOTE`, `STYLE` and `REGION` blocks, cue numbers and identifiers (a cue's lines before its timing line), timing lines (`00:01:02.000 --> 00:01:05.000`, with any cue settings) and inline tags are dropped, and the character references `&amp;`, `&lt;`, `&gt;` and `&nbsp;` are read as their characters; a WebVTT voice tag `<v Name>` or a leading `Name:` gives the cue's speaker. Consecutive cues of one speaker are joined, with single spaces, into one paragraph `Name: text`; a cue with no speaker continues the paragraph before it, or starts one with no name. Any other text is kept as it is, paragraphs as written, without its leading blank lines and trailing whitespace. The paragraphs are what capture-and-review §4.2 numbers at the ingest.

**Name and Date.** A file name (without its extension) that starts with a date `YYYY-MM-DD` that exists in the calendar gives the Date, and the rest of the name, with that date and the separators after it (space, `-`, `_`, `.`) removed and each `_` or `-` between words read as a space, gives the Name. Without a leading date, the Date is the file's modified time as a local date (`--now`'s clock does not apply: the file's own time), and the Name is the whole name read the same way. An empty Name is `Meeting <Date>`. Name is cut to 120 characters.

**Once a file.** The file's hash is `sha256:<hex>` of its bytes. When the log holds a `meeting-file` line with `hash=<that hash>`, the command stops with `FILE_ALREADY_A_ROW` (exit 4), its `details` naming that line's `page`: the file was made a row before, and the skill moves it to `processed/` without a second row. The command never writes the line: the skill logs `brain log meeting-file - page=<page id> hash=<hash>` once the row exists.

**Output.** `{ "data": { "database": "meetings", "action": "create", "hash": "sha256:…", "properties": { "Name": "…", "Date": "YYYY-MM-DD", "Brain Status": "New" }, "body": "<details><summary>Transcript</summary>\n\n…\n\n</details>" } }`: properties in the normalized form of §5.14.1 (Brain Status by its mapped name, as `sync` writes it), no Attendees, Project, Area or Brain ID; `body` one toggle titled `Transcript` (the toggle form of §5.14.7) holding the paragraphs, separated by blank lines. Errors: `INPUT_INVALID`, `FILE_ALREADY_A_ROW`. Meetings is Core, so no module check applies.

### 5.38 `brain cleanup` (0.17.0, decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §2 to §5; weekly-review.md §15)

```text
brain cleanup plan [--now <ts>]
brain cleanup apply [--max <n>] [--now <ts>]
brain cleanup undo <proposal> [--now <ts>]
brain cleanup ticks --input <file|-> [--attended] [--now <ts>]
```

The weekly clean-up and the Weekly row's ticks. Behaviour is normative in weekly-review.md §15; this section is the command surface. It is not `source cleanup-plan` or `source cleanup-propose` (§5.25, §5.26), which reconcile an exclusion (0055) and are unchanged. The JSON shapes join `spec/schemas/weekly.schema.json` with CC-370 (`$defs/cleanupPlan`, `ticksInput`, `ticksResult`).

- **`plan`** writes nothing. It finds the mechanical items of weekly-review.md §15.2's closed list, deterministically (no model judgment), in that section's order: `data` = `{ "items": [ { "tidy", "title", "why", "fingerprint", "targets": [<note id>…], "paths": [<path>…], "proposal_input" } ], "held": <n> }`. `proposal_input` is the exact `proposal new` input of the item (§5.6: a `merge`, an `archive_draft` or a `fix_structure` with its `tidy`, `fingerprint`, `why` and `source` = `agent:brain-weekly-review/<as_of compact>`). `held` counts the items left out because their fingerprint was undone or declined before (§15.2). `brain weekly plan` holds the same list as `cleanup` (§5.34). Errors: `SUPPRESSIONS_UNREADABLE`.
- **`apply`** applies the items `plan` gives now, at most `--max` (default and highest 20), each as **one journaled operation** (§5.24, capture-and-review §7.11) and **its own commit**: `proposal new` of its `proposal_input`, then `apply` with `{ action: approve, decided_by: cleanup }` by its kind's rule (schema §11.2), the `tidy` log line (§3.9), and `git commit` of exactly those paths with the subject `Clean-up: <title>` and the trailers `Op: <op-id>` and `Cleanup: <proposal id>`. An item whose targets an earlier item of the same run changed waits for the next run (`deferred`). A failed item is rolled back alone (the journal, §5.24) and reported, and the next one goes on. Before the first item the tree must be clean (`DIRTY_TREE`), and with `settings.cleanup.auto` `off` the command refuses (`CLEANUP_OFF`) and writes nothing: those items are offered as doubtful items instead (weekly-review.md §5.2). `data` = `{ "applied": [ { "proposal", "tidy", "title", "commit" } ], "failed": [ { "title", "reason" } ], "deferred": <n>, "left": <n> }`, `left` being the items beyond `--max`. Errors: `DIRTY_TREE`, `CLEANUP_OFF`, `RECOVERY_NEEDED`, `SUPPRESSIONS_UNREADABLE`.
- **`undo <proposal>`** (weekly-review.md §15.3): the proposal must be `applied` with `decided_by: cleanup` (else `NOT_A_CLEANUP`, or `ALREADY_UNDONE` when it is `closed` `undone`). It finds the item's commit on the working branch (`git log --format=%H --grep='^Cleanup: <proposal>$'`; none → `NOT_A_CLEANUP`), checks that every path that commit wrote, other than the proposal file and the month's log, has at `HEAD` the content it had in that commit (else `UNDO_STALE`, `details` listing each changed path; nothing written), then, as one journaled operation and one commit (subject `Undo clean-up: <title>`, trailers `Op: <op-id>` and `Cleanup-undo: <proposal>`): restores each of those paths to its content in the commit's parent (a path the commit created is removed), sets the proposal `closed` with `closed_reason: undone` and `undone_at`, and logs `tidy-undo`. The tree must be clean first (`DIRTY_TREE`). The skill then runs `index`, `views` and `lint` and commits what they change, as after any write. `data` = `{ "proposal", "restored": [<path>…], "commit" }`. Errors: `UNKNOWN_ID`, `NOT_A_CLEANUP`, `ALREADY_UNDONE`, `UNDO_STALE`, `DIRTY_TREE`, `RECOVERY_NEEDED`.
- **`ticks`** applies what the user ticked in a Ready Weekly row (weekly-review.md §15.4). Input, as the skill read the row through the MCP:

  ```json
  { "week": "2026-W46", "page": "2b8c…", "read_at": "2026-11-16T07:30:12Z",
    "items": [ { "label": "A1", "ticked": true, "note": "" }, { "label": "C3", "ticked": true, "note": "only the title, keep the alias" }, { "label": "C4", "ticked": false, "note": "" }, { "label": "U1", "ticked": true, "note": "" } ] }
  ```

  `note` is the text after `Your note:`, trimmed (`""` when empty). Each `label` must be one of the week's row in `_weekly/state.json` (`weeks.<week>.row`, weekly-review.md §9.5); another is `UNKNOWN_LABEL` for that item, which is skipped. `page` must be the week's row (its report's `notion`; else `INPUT_INVALID`). For each item, in label order (A, then C, then U):
  - an item already decided (its proposal not `pending`, a `U` already undone) → `already`, nothing done;
  - a `U` item ticked → its undo, by `undo`'s rules above (the same `NOT_A_CLEANUP` and unchanged-since check, the same restore, the proposal `closed` `undone` with `undone_at`, the `tidy-undo` log line), staged with the read's other writes rather than committed alone, since `ticks` doesn't commit and `undo` needs a clean tree: `undone`; a path changed since → `stale` with reason `UNDO_STALE`, nothing restored; unticked → `kept`;
  - an `A` or `C` item with a `note` → without `--attended`, `waiting` (left pending; an unattended run interprets nothing the user wrote, 0051); with `--attended`, `ask`: returned with its proposal and note for the skill to put to the user, whose answer it applies with `brain apply` (`decided_by: chat`, `note` = the Your note text and the answer); once every `ask` item is answered, the skill runs `ticks` again with the same input, so the items left `open` are declined then;
  - an `A` or `C` item ticked, with no note → the **stale check**: each `{ path, hash }` of its base must match the file now; else `stale`: the proposal is closed `closed_reason: stale`, nothing else written. Then `brain apply` with `{ action: approve, decided_by: tick, decided_at: <read_at> }`; the excluded-evidence rule and the kind's own stale rule still apply (§5.7). A `notion_change` or `new_task` returns its `notion_writes` for the skill to make through the MCP and settle (`proposal settle`), as the session does; with `settings.publish` `ask` and no `--attended`, it is not applied (`waiting`, reason `PUBLISH_ASK`);
  - an `A` or `C` item unticked, with no note → `declined`, `brain apply` with `{ action: reject, decided_by: tick, note: "unticked when the row was set Ready" }`, **only when** no other item of the row is `waiting` or `ask` after the steps above (an item with a note, or a Notion write held back); otherwise `open`: left pending, so a tick added before the row is Done is applied by the next read (weekly-review.md §15.4).

  `ticks` writes the proposals it decides and the notes their applies change, and the log line `weekly-ticks week=<week> applied=<n> declined=<n> open=<n> stale=<n> waiting=<n> undone=<n> skipped=<n>` (§3.9). It does not commit: the skill commits after `index`, `views` and `lint`, as after `apply`. `data` = `{ "week", "results": [ { "label", "proposal", "result": "applied"·"declined"·"open"·"stale"·"waiting"·"ask"·"undone"·"kept"·"already"·"skipped"·"failed", "reason"? } ], "notion_writes": [ … ], "done": <boolean> }`. `done` is `true` when nothing in the row waits any more (weekly-review.md §15.4: every `A` and `C` item decided, closed or moved, none `waiting`, `ask` or `open`); the skill then publishes the row, whose Brain Status `sync render` sets `Done` (§5.34). Errors: `INPUT_UNREADABLE`, `INPUT_INVALID`, `WEEKLY_STATE_UNREADABLE`, `RECOVERY_NEEDED`.

Proposals a row offers carry `weekly` = its week (schema §11); `proposal list --waiting` leaves them out and counts them in `in_weekly_row` (§5.6), so a row item is decided by its tick or, with a note, in the attended catch-up that reads it, never twice.

### 5.39 `brain factory` (0.18.0, decision [0113](../decisions/0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) §1, §4, §6; linked-repos.md §1.1)

```text
brain factory list
brain factory add --path <path> --name <name> --area <area-id> [--project <prj-id>]… [--plan <file>]…
brain factory set <factory> [--name <name>] [--path <path>] [--area <area-id>] [--project <prj-id>…|--no-projects] [--plan <file>…|--no-plan]
brain factory archive <factory>
brain factory read <factory> [--issues <file|->]
brain factory overview <factory> --input <file|-> [--issues <file>] [--written <sha256>]
```

`<factory>` is a `fac-` id or a name (trimmed, ignoring case); none → `FACTORY_NOT_FOUND`. The entries are schema §12's; the overview's text, its lists and when it is written are connected-workflows.md §9.1's. Every command except `list` refuses with `MODULE_OFF` while Factories is off. None writes in the folder, and none calls Notion. `add`, `set` and `archive` write `brain.json` as `repo add` does, and the skill commits.

- **`list`** writes nothing: `data` = `{ "factories": [ { id, name, repo | path, area, projects, archived, workflow: { id, state } | null, overview: { as_of, by } | null, notion } ] }`, in `brain.json` order, `area` and `projects` filled from the link for a repo, `workflow` the one not ended whose destination is the Factory.
- **`add`** makes a Factory of a folder that isn't a linked repo. `--path` is absolute or starts with `~/` and is an existing directory (`INPUT_INVALID`), not the brain or inside it (`REPO_IS_BRAIN`), not the product repo (`OUTSIDE_ROOT`). `--area` and each `--project` exist (`UNKNOWN_ID`). Each `--plan` is a path in the folder, without `..` (`INPUT_INVALID`); it needn't exist yet. The folder of a `repos` entry, or of a Factory that isn't archived, or a name in use → `FACTORY_EXISTS` (the message names it). **An archived entry with the same folder is the same Factory again:** `archived` is removed and the given values replace its own. `data` = the entry, with `reused: true|false`.
- **`set`** changes a plain folder's Factory; a given list replaces the whole one. `--path` follows `add`'s rules (the folder moved). On a linked repo's Factory only `--name` is accepted (`USAGE` otherwise: its Area, Projects and plan are changed in the kit, linked-repos.md §3). `data` = `{ entry, changed }`.
- **`archive`** archives a plain folder's Factory that has no open workflow, left by a setup that stopped (`USAGE` for a linked repo: unlink it; `DESTINATION_TAKEN` with an open workflow: end it, which archives it, connected-workflows.md §3.5). `data` = the entry.
- **`read`** writes nothing. It reads the plan files and the taken tasks:
  - **The plan files**, in connected-workflows.md §9.1's order and from where it says: a linked repo's at `HEAD`, leaving out one that matches `never_read`, with warning `REPO_DIRTY` when one has uncommitted changes; a plain folder's on disk. A symbolic link whose real path leaves the folder, a folder, and a file that isn't UTF-8 count as not found. CRLF is read as LF. No other file is opened.
  - **The items** are those of the task source or, without one, of the checklists in the plan files, parsed as linked-repos.md §2.4 and §4 say, each with its meaning (`null` when unmapped). `--issues` takes `repo tasks`' issue data (§5.29) and is required for a GitHub or GitLab source (`USAGE` without it, and with it for any other).
  - **The folder missing** on this machine: `found: false`, no plan, `changed: false`, warning `PATH_MISSING`.
  - `data` = `{ "factory": <as in list>, "found": true, "plan": { "where": ["TASKS.md"], "not_found": ["docs/roadmap.md"], "files": [ { "path", "text", "cut" } ], "items": [ { "key", "title", "meaning", "done_at" } ], "counts": { todo, in_progress, waiting, review, done, dropped, unmapped }, "percent" }, "taken": [ { "item", "title", "meaning", "done_at" } ], "folder": "sha256:…", "tasks": "sha256:…", "changed": true }`.
    - `where` holds the names the Plan line shows, `not_found` the named files that weren't. `text` is cut at 20,000 characters (`cut: true`); the hashes and the items are of the whole file.
    - `taken` is every item of the Factory's open workflow, in id order (empty with none); `done_at` as §9.1 says, a date `YYYY-MM-DD` or `null`.
    - **`folder`** is the hash of the plan as read: the SHA-256 of the UTF-8 JSON, with no spaces, of `[[<path>, <text or null>], …]` in order, and for issues one more entry `["github:<owner/name>" or "gitlab:<project>", [[number, title, state, state_reason or null, labels sorted, closed_at or null], …]]`, sorted by number. **`tasks`** is the same hash of `[[item, title, meaning, done_at], …]`. A commit that touches no plan file changes neither.
    - `changed` is true when `folder` or `tasks` isn't the entry's `overview`'s, or the entry has no `overview`.
- **`overview`** builds the overview; without `--written` it writes nothing. Input: `{ "by": "session"|"catch-up", "plan": "<sentences>"|null, "building_now": ["…"], "done": [ { "text": "…", "date": "2026-11-25" } ] }`; the last two are optional and for `by: session` only (work that had no task, connected-workflows.md §15.4).
  - It reads as `read` does (the same `--issues`), then builds §9.1's text. `INPUT_INVALID`: `plan` empty, over 400 characters or with a line break; `plan` `null` while a plan file was found, or text while none was (pointer `/plan`); `building_now` or `done` from a catch-up; a date in the future or malformed. The three-sentence limit is the skill's to keep. `found: false` → `INPUT_INVALID`, pointer `""`, message `the folder isn't on this machine`.
  - `data` = `{ "heading": "Overview", "markdown", "sha256", "as_of", "folder", "tasks", "unchanged" }`. `sha256` follows §9.1's rule (without the date); `unchanged` is true when it equals the entry's. The skill then writes nothing in Notion; otherwise it replaces the toggle's content with `markdown` and sets **Overview as of** to `as_of` on the row.
  - **`--written <sha256>`**, after the Notion write, or with `unchanged` and no write: it builds the overview again from the same input, with `--now` given as the `as_of` written, and refuses with `STALE_RECORD` when the hash isn't `<sha256>` (the folder or the tasks moved meanwhile: build and write again). Then it records the entry's `overview` (`{ as_of, by, sha256, folder, tasks }`; when the hash is the entry's old one, only `folder` and `tasks`), and Overview as of in `published` when the row has one, so the next render doesn't send it again. It is one journaled operation and one commit of `brain.json` and the log, message `factory: overview <fac>` with the trailer `Op: <op>` (connected-workflows.md §10.1), and never pushes. `data` = `{ entry }`.
  - Nothing of `building_now` or `done` is kept: a catch-up that rewrites later shows what the folder and the records hold. An item that only gets older than 14 days rewrites nothing.

Errors: `USAGE`, `MODULE_OFF`, `FACTORY_NOT_FOUND`, `FACTORY_EXISTS`, `REPO_IS_BRAIN`, `REPO_NOT_FOUND` (a linked repo whose path is there and isn't a Git working tree), `OUTSIDE_ROOT`, `UNKNOWN_ID`, `DESTINATION_TAKEN`, `INPUT_INVALID`, and for `overview --written` `STALE_RECORD`, `DIRTY_TREE`, `BRAIN_BUSY`, `RECOVERY_NEEDED`.
