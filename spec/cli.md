# CLI Contract (v1)

**Status:** Draft for review (task CC-03)
**Applies to:** the `brain` CLI in `src/` (tasks CX-02 to CX-11).
**Depends on:** [schema.md](schema.md) (field names, file formats, apply rules). When this document and schema.md disagree on a file format, schema.md wins and this document is fixed.

Decisions referenced: 0003, 0006, 0007, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0021, 0023, 0024, 0026, 0027, 0041–0043, 0045, 0064, 0072.

**Eligibility (0077, 0.13.0):** what search, a full read, a summary, a citation and a proposal's evidence may rest on is one rule, in [eligibility.md](eligibility.md); where a section here differs, that file wins until the task it names (its §13) changes the section.

---

## 1. Scope

The CLI does the **deterministic** work: IDs, file writes, validation, index, views, applying decided proposals, and turning Notion snapshots into plans. The **skills** (Claude Code / Codex) do the judgment and the Notion I/O: they read minutes, extract knowledge, call the Notion MCP (0015), and call the CLI to write.

Rules for every command:
- **No network.** The CLI never calls Notion or any other service. Notion data enters only as JSON files written by a skill.
- **No Git, except `init`, `upgrade`, `repo`, `source extract` and `recover`.** Commands write files; the skill commits. `source extract` and `recover` commit and restore their own journaled files (§5.23, §5.24). `init` creates the repository and its first commit, `upgrade` commits its own files (§5.15), and `repo` reads a linked repo with read-only Git commands (§5.16, 0042). `repo new` runs `git init` in the repo it creates and makes its first commit there, and never pushes (§5.29). The `workflow` write commands commit their own records under `_workflows/` as one journaled operation, and never push (connected-workflows.md §12).
- **No LLM.** Same input and same brain give the same output, except for new random IDs and the clock (see `--now`).
- **Writes only inside the brain**, except `init` (the new brain folder, and the global config file with `--set-default`), `link` (three files in the target repo), `repo kit write` (`brain-kit.json` in a linked repo) and `repo new` (the new repo's folder) (§5.29, 0066), and `workflow new` and `workflow set --pointer` (the pointer `.brain-workflow.json` in the working folder, connected-workflows.md §3.2).

### 1.1 Skill commands vs CLI commands

Decision 0024 lists user-facing commands. Some are skills that call the CLI; some are CLI commands. Users ask agents for the skill; agents call the CLI.

| User-facing (0024) | Runs as | CLI commands it calls |
|---|---|---|
| `brain init` | CLI | `init` |
| `brain connect-notion` | skill (CC-08) | `config set`, `modules` (the onboarding checklist, 0048) |
| `brain ingest` | skill (CC-06) | `status`, `index`, `id new`, `note new`, `proposal new`, `views`, `lint`, `log`, `sync tasks`, `sync render`, `sync record`; the to-do tidy: `question drop` (0071) |
| `brain apply` | skill (CC-09) | `sync plan`, `sync apply` (or `apply` in chat), `index`, `views`, `sync render`, `sync record` |
| `brain sync` | skill (CC-08) | `sync plan`, `sync apply`, `index`, `views`, `sync render`, `sync record` |
| `brain query` | skill (CC-10) | `query --candidates`, `query --read`, `index`; report mode (0043, 0045): `report new` (with `refresh`), `report fix`, `sync render`, `sync record` |
| catch up | skill (0037) | the calls of ingest, apply and sync, plus `proposal backlog` (once, 0041), `repo changes` and `repo record` (0042), `source diff` (re-reads, 0045). (`source full-text`, 0043, is retired in 0.6.0, 0049) |
| turn a module on or off (0048) | skill | `modules`, `config set` |
| `brain link` | CLI | `link` |
| link, show, change, unlink, check or start a repo (0066) | skill `brain-repos` (CC-104) | `repo kit check`, `repo kit write`, `repo add`, `repo refresh`, `repo show`, `repo health`, `repo tasks`, `repo unlink`, `repo new`, `link`; `repo record --reset` after a change that sets `reingest` |
| `brain upgrade` | CLI | `upgrade` |
| `brain lint` / index | CLI | `lint`, `index` |
| `brain notion-change` | skill (CC-11) | none |
| run work as standard or connected (0059) | skill `brain-workflow` (CC-104) | `workflow new`, `find`, `show`, `set`, `resolve`, `item put`, `item claim`, `artifact put`, `render`, `op state`, `reconcile`, `summary`, `publish-history`; `note new`, `proposal new`, `sync render`, `sync record` for artifacts (connected-workflows.md §6.3) |
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
| `BRAIN_DIRTY` | 5 | `upgrade` found uncommitted changes in the brain; commit or discard them first (0038) |
| `REPO_NOT_FOUND` | 4 | a `repo` command's repo isn't in `brain.json`, or its `path` isn't a Git working tree (0042) |
| `REPO_IS_BRAIN` | 4 | `repo add` was given the brain itself (0042) |
| `INSTRUCTIONS_SYMLINK` | 4 | `link`: the repo's `CLAUDE.md` is a symbolic link that doesn't resolve to its own `AGENTS.md` (§5.12) |
| `REPO_COMMIT_UNKNOWN` | 4 | a commit given to, or recorded for, a `repo` command doesn't exist in the repo, or isn't an ancestor of the commit it is compared with |
| `MODULE_OFF` | 4 | a command needs a module that `brain.json` `modules` turns off (0048, schema §12): `sync tasks` with Tasks off |
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
| `DESTINATION_TAKEN` | 4 | `workflow new` for a destination, or a linked repo, that an open workflow already has (§3.1) |
| `POINTER_EXISTS` | 4 | `workflow new` in a folder whose pointer names an open workflow (§3.1) |
| `WORKFLOW_NOT_FOUND` | 4 | a `workflow` command names no workflow in the brain (§12) |
| `WORKFLOW_ENDED` | 4 | a `workflow` command other than `find` and `show` on an ended workflow (§12) |
| `BRAIN_BUSY` | 5 | Git's index stayed locked for 10 seconds; run the command again (connected-workflows.md §10.1) |
| `RETIRED` | 2 | a command retired in this version (`source full-text`, 0049); the message names what replaces it |
| `WRITE_CONFLICT` | 5 | a file appeared at a path the command was creating, after it read the brain (another writer). Nothing is kept (§3.6); re-run the command |
| `CLAUDE_NOT_FOUND` | 3 | `schedule install` found no `claude` executable on `PATH` to schedule (0051, §5.21) |
| `SKILL_MISSING` | 3 | `schedule install` for a job whose skill the brain doesn't have (`catch-up` without brain-catch-up) |
| `SKILLS_PIN_INVALID` | 3 | the brain's `skills.lock.json` is invalid (§5.28) |
| `SKILLS_INCOMPATIBLE` | 3 | the brain's pinned skills exclude the running CLI (§5.28) |
| `SKILLS_SNAPSHOT_MISSING` | 3 | a pinned skill's `SKILL.md` is missing from a tree; for `link`, a pinned file it copies is missing or differs (§5.28) |
| `SKILLS_SNAPSHOT_INVALID` | 3 | the package snapshot is invalid or excludes the running CLI (`init`, `upgrade`, `link` on an unpinned brain), or a released snapshot changed content under the same version (`upgrade`) (§5.28) |
| `SKILLS_DOWNGRADE` | 5 | `upgrade` would lower the pin's version under the same snapshot name (§5.28) |
| `RECOVERY_NEEDED` | 5 | an interrupted multi-file write left `_journal/<op>.json`: every command except `recover` refuses until `brain recover` ran (capture-and-review §7.11) |
| `DISMISSALS_UNREADABLE` | 5 | `_assistant/dismissals.json` cannot be read or fails its schema: `assistant findings` and `assistant dismiss` refuse rather than show skipped findings again or replace the file (`lint` flags it; [assistant.md](assistant.md) §8) |
| `SUPPRESSIONS_UNREADABLE` | 5 | a `_suppressions/` record cannot be read or is malformed: `query`, `views`, `source extract` and `source cleanup-plan` refuse rather than treat the brain as unrestricted, and never replace the damaged file (`status` reports it, `lint` flags it; capture-and-review §5.3) |
| `DIRTY_TREE` | 5 | `source extract` found the brain not a Git work tree, or with uncommitted changes and no journal |
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

`"` and `\` in titles are escaped with `\`, and CR and LF become `\r` and `\n`, so every entry is exactly one line. Values with spaces, quotes, backslashes or line breaks are quoted and escaped the same way. The file is created exclusively with its header, then lines are appended; an unreadable log is an error, never a reason to start the file over. Ops written by the CLI: `init`, `note-new`, `proposal-new`, `apply`, `correct`, `sync-create`, `sync-update`, `upgrade`, `repo-add`, `repo-record`, `full-text` (before 0.6.0), `modules`, `report-new`, `report-refresh`, `report-fix`, `question-drop`, `assistant-dismiss`. Skills add their own (`ingest`, `publish`, `catch-up`, `query`, `assistant`, `reflect`) with `brain log` (§5.11). `index` and `views` do not log.

**The catch-up line (0045, 0051).** An attended catch-up logs `catch-up - notes_read=<n> seconds=<s>`. An unattended one (§6.1) logs `catch-up - mode=unattended inputs=<n> left=<n> skipped=<n> waiting=<n> failed=<n>[ failures="<reason>; <reason>"] report=<yes|no> notes_read=<n> seconds=<s>`: `inputs` taken in (failed ones included), `left` the inputs beyond the budget, `skipped` the inputs skipped for a blocker, `waiting` the decided Review rows and report What to fix left for an attended run, `failed` the steps that failed, `failures` their reasons in a few words each ("Notion login"), `report` whether it wrote a Report row. A `catch-up` line without `mode=unattended` is attended, as every line before 0.7.0 is. `brain status` reads these lines (§5.2).

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

1. Refuse if `<path>` is the product repo (`BRAIN_IS_PRODUCT_REPO`) or already has `brain.json` (`ALREADY_A_BRAIN`, even with `--force`).
2. If `<path>` exists and is non-empty: refuse with `TARGET_NOT_EMPTY` unless `--force`. With `--force`, template files whose path already exists are **left untouched** and listed in `skipped`; nothing is ever overwritten.
   Then the package snapshot (skills-delivery §2.3) must be compatible with the running CLI, else `SKILLS_SNAPSHOT_INVALID` (§5.28) and nothing is written. A `<path>` that doesn't exist yet is refused before it is created.
3. Copy the template. npm never packs files named `.gitignore`, so the template stores it as `templates/brain/gitignore` and `init` writes it to the new brain as `.gitignore` (reported in `created` under that name; a `--force` run skips it like any other existing file). Write `brain.json` from the template with `schema_version: 1` and `owner.name` = `--owner` (default: the `user.name` from `git config`, else `"Owner"`).
   The template includes `.claude/agents/ultimate-assistant.md`, the Ultimate Assistant sub-agent ([assistant.md](assistant.md) §10): product-owned, copied like every template file.
   Copy every skill of the package snapshot, its listed files only, to `<path>/.agents/skills/` (Codex) and to `<path>/.claude/skills/` (Claude Code) (0029, 0038, 0059); `snapshot.json` and the snapshot's optional top-level files are not copied. Write `skills.lock.json` (skills-delivery §3) with `installed_by` = the running version. All are product-owned and listed in `created`; with `--force`, existing files, the lock included, are skipped like template files, and the result can be any pin state.
4. Run `index` (an empty index).
5. Log `- <timestamp> init - "<owner name>" schema=1` (no machine paths in the log).
6. Unless `--no-git`: `git init`, add all, commit `init: ultimate brain (schema v1)`, so the new brain starts clean. If Git is missing or the commit fails (no identity), keep the files, skip the commit and add warning `GIT_COMMIT_SKIPPED`.
7. With `--set-default`: write `~/.config/ultimate-brain/config.json` = `{"brain": "<abs path>"}`, replacing any existing one (its old value is reported).

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

**Human output** (without `--json`, CC-156): what was made, then the two next steps, with the checklist's path under `product.path` (§5.2):

```text
Initialized Ultimate Brain at /Users/me/brain
Next:
  1. Build your Notion space: follow /usr/local/lib/node_modules/ultimate-brain/notion/CHECKLIST.md
  2. Then, in /Users/me/brain, ask your agent: "connect the brain to Notion"
```

Errors: `TARGET_NOT_EMPTY`, `ALREADY_A_BRAIN`, `BRAIN_IS_PRODUCT_REPO`, `SKILLS_SNAPSHOT_INVALID`, `OUTSIDE_ROOT` (template path escapes, defensive).

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
    "notion": { "configured": ["areas", "goals", "projects", "meetings", "people", "orgs", "decisions", "questions", "review"], "missing": ["key_results", "inbox", "documents"], "tasks_database": true },
    "tasks_status_note": null,
    "settings": { "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 } },
    "modules": { "knowledge": true, "orgs": true, "documents": true, "reports": true, "tasks": true, "planning": true },
    "unattended": { "catch_up": { "since": "2026-12-01T18:02:00Z", "runs": 4, "inputs": 6, "failed": 1, "failures": ["Notion login"], "left": 0, "skipped": 1, "waiting": 1, "last": "2026-12-03T07:00:00Z" }, "backlog": false },
    "repos": [ { "name": "acme-api", "area": "area-2m7c4h8n", "commit": "", "found": true } ],
    "index_stale": false,
    "views_stale": ["projects/acme-website/brief.md"],
    "suppressions": { "active": 0, "reconciled": 0, "restricted_notes": 0, "unresolved_lineage": 0, "problems": [] },
    "last_log": "- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w \"Acme sync\" created=4 proposals=3",
    "skills": { "state": "pinned", "name": "ultimate-brain", "version": "0.9.0", "…": "§5.28" },
    "product": { "path": "/usr/local/lib/node_modules/ultimate-brain" }
} }
```

`skills` (always present, 0059) is the brain's skill pin, defined in §5.28. `status` is exempt from the pin guard, so it reports every state.

`product.path` (always present) is the absolute, symlink-resolved folder of the installed `ultimate-brain` package that is running: the folder holding its `package.json`, or the product repo's root when the CLI runs from source. The Notion build files ship under it, so a skill or a message names them as `<product.path>/<file>`: `notion/CHECKLIST.md`, `notion/prompts/`, `notion/modules/`, `notion/migrations/`, the other `notion/*.md` guides, and `docs/notion-space-design.md`.

`notion.configured`/`missing` list keys of `brain.json` `notion.databases` with non-empty / empty values, among `domains`, `areas`, `goals`, `key_results`, `projects`, `meetings`, `people`, `orgs`, `decisions`, `questions`, `review`, `inbox`, `documents` (0045, 0049; a `references` key is reported as `documents`; a retired `concepts` key is not reported, 0071). `modules` (0048) has every module key, filled in as schema §12 says: all `true` except Domains when the block is absent, else each absent key at its default. `notes` counts every type, `reference` included (0045); `concept` is counted only when a brain still has concept notes (before `brain upgrade`, 0071). A `capture_inbox` key is reported as `inbox` (schema §12). `settings` (schema §12) is added with defaults filled in: `{ "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 } }`. `unattended` (0051) sums the unattended catch-up lines (§3.9) written since the last attended `catch-up` line, across the month files: `since` is that attended line's timestamp (`null` when there is none), `runs` the unattended lines after it, `inputs` and `failed` their sums, `failures` their reasons in order without repeats, and `left`, `skipped`, `waiting` and `last` (its timestamp) from the latest one, since an input still skipped is counted again by every run. `catch_up` is `null` when no unattended line follows the last attended one. `backlog` is `true` when the last three unattended catch-up lines, attended or not in between, each have `left` above 0. The attended catch-up opens with this summary (§6.1). `repos` lists `brain.json` `repos` in order (empty when absent): `found` is whether `path` is a Git working tree. `views_stale` includes area briefs. Exit 0 even when stale.

**Suppressions (0055).** `suppressions` counts the records of `_suppressions/` (capture-and-review §5.3) that are `active` and `reconciled`, the knowledge notes with a restricted statement or restricted whole (`restricted_notes`), those restricted whole (`unresolved_lineage`: their text cannot be mapped to passages, or their lineage is unknown), and lists any unreadable record under `problems`.

**Tasks status diagnostic (0055).** `brain status --tasks-schema <file|->` accepts a skill-supplied JSON snapshot `{ "database": "<mapped database id>", "property": "<mapped status property name>", "as_of": "<ISO timestamp>", "options": ["To Do", "Done", "Won't Do"] }`. The skill obtains it from Notion during connection; the CLI stays offline. The database and property must be non-empty and match the configured mapping; timestamps must be valid UTC timestamps no later than the command clock. Malformed, future-dated or mismatched snapshots fail `INPUT_INVALID`. When the Tasks module is on, the snapshot lacks `notion.tasks.wont_do_status` (default `Won't Do`), `data.tasks_status_note` contains a non-error string identifying the missing option and snapshot time. It is `null` without a snapshot, when Tasks is off, or when the option is present. The check sees names only and cannot verify the Complete group. A snapshot is a point-in-time observation, not a promise of current Notion state.

### 5.3 `brain config`

```text
brain config get [<dot.path>]
brain config set <dot.path> <json-value>
```

Reads or edits `brain.json` (used by the connect-notion skill). `get` without a path returns the whole file. `set` parses `<json-value>` as JSON (`'"abc"'`, `8`, `{"a":1}`), sets it at the path (creating intermediate objects), validates the result against brain.schema.json, then writes. `schema_version` cannot be set (`INPUT_INVALID`).

```sh
brain config set notion.databases.projects '"2c4e6a80-1b3d-4f50-9a7c-8e6d4b2a0f13"' --json
```
```json
{ "data": { "path": "notion.databases.projects", "previous": "", "value": "2c4e6a80-1b3d-4f50-9a7c-8e6d4b2a0f13" } }
```

Errors: `INPUT_INVALID` (value not JSON, result fails schema, `schema_version`), `USAGE` (`get` on a path that does not exist).

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

Writes **new** notes (lifecycle `draft`, 0003). Used by the ingest skill, by `apply` for `new_item` (written `reviewed`: the approval is the review, 0071), and by `sync apply` for Notion-created rows (which keep the lifecycle set in Notion). Never modifies an existing note; changes go through `proposal new`. Types `view` and `proposal` are refused (use `views` and `proposal new`).

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
- `area` isn't an existing area, or an entry of `projects` isn't an existing project (`UNKNOWN_ID`) (0050).

**Documents (0049, schema §4 reference).** A `reference` item is also refused (`INPUT_INVALID`) when:
- `origin` is absent;
- `origin: whole` and `sources` isn't exactly one source id (`src-`), or the body isn't byte for byte that source's body (its hash isn't the source's `content_hash`);
- `origin: promoted` and `promoted_from` doesn't name an existing decision, or another `promoted` Document already names it, or names one whose `lifecycle` isn't `reviewed` or `disputed` (Promote is on decisions only since 0.9.1, and only reviewed knowledge is promoted, since the Document of a draft or archived note would get no page: 0071);
- `promoted_from` is set without `origin: promoted`;
- `origin: workflow` without `workflow: { id, artifact }`, or `workflow` set with another `origin` (connected-workflows.md §6.3).

The CLI writes `lifecycle: reviewed` for `origin: whole` (the source's own text needs no Review), for `origin: workflow` (the user approved the artifact) and for a decision with `workflow` (the same approval, 0071), the note's current `lifecycle` for `origin: promoted`, and `draft` otherwise (`part`, `learned`). A second `whole` Document of the same source is not written: it is reported in `skipped` with reason `ALREADY_KEPT` and the existing id, like a duplicate source.

**Source dedupe:** a source is a duplicate if an existing source, or one earlier in the same batch, has the same `content_hash`, **or** the same `source_key` when that key is `file:` (the same original file, whatever the converter produced) or the source's `kind` is `capture` (the same Inbox row, even after an edit) (0032). **A version (0045):** a source with `replaces` is compared by `content_hash` only, so a corrected capture or file can be read again; the same text is still a `DUPLICATE_SOURCE`. A duplicate is not written and is reported in `skipped` with the existing id. This is how the ingest skips minutes it has already ingested (synthesis §5 step 2). Other items in the batch that reference the skipped source's input `id` are an error, so the skill must check `skipped` with `--dry-run` first, or snapshot the source in its own batch.

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
Skipped item: `{ "input_index": 0, "reason": "DUPLICATE_SOURCE", "existing": "src-7w3c9k5m" }` (or `ALREADY_KEPT` with a `ref-` id).

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (incl. refused type, forbidden key, missing reference, lint error in a new file), `ID_IN_USE`.

### 5.6 `brain proposal new` / `brain proposal list`

```text
brain proposal new --input <file|-> [--dry-run]
brain proposal list [--status <s>[,<s>…]] [--target <id>]
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
      "source": "mtg-8c4n2p7w"
    }
  ]
}
```

Input keys are the proposal fields of schema §11 except `id`, `type`, `created`, `updated`, `status`, `decision`, `notion`, `links`, `changes`, `before_hash`, `deferred_from`, `dropped`. An `add_link` input item always names **one** link with `field` and `after`; the CLI groups them (below). The CLI:
- assigns `id`, `created` = `updated` = today, `status: pending`;
- skips an item that rests on excluded evidence (`SOURCE_EXCLUDED`; the rule is under "Excluded evidence" in §5.7): one whose text cites a passage that is not live, even beside a live one, is withheld whole (eligibility.md §4.2), so no Review row is written for a change that could never be applied. The agent may propose it again from the live passages alone, as a new item. The human output names the reason of every skip (`skipped proposals[0]: rests on content you excluded from the brain`). How the ingest skill reports a skipped item to the user is the skill's to say (CC-180). A `review_notes` item is not checked as a whole; the changes folded into it are, before folding;
- sets `before` to the target's current `facts.<field>` for `update_fact` and `contradiction` (absent if the fact is new). If the input gives `before` and it differs → `BEFORE_MISMATCH`;
- for `update_fact` and `contradiction`, sets `from` if absent: the source meeting's `date` when `source` is a `mtg-` id, else `created`;
- for `update_body` (0045), sets `before_hash` to the target's current body hash; `target` must be a `reference` whose `origin` isn't `promoted` (0049) and `content` non-empty and different from the current body (else skipped, `NO_CHANGE`);
- checks per kind: `target` exists (all kinds except `new_item`) and is a knowledge note (not a source, view or proposal, which are immutable, regenerated or records); a `source` that is a note id must exist (`UNKNOWN_ID`); a `new_item` whose `note` is a source already captured is `INPUT_INVALID`; `contradiction` needs a current `facts.<field>`; `supersede` needs `supersedes` to exist, differ from `target`, have the same type, and not already be superseded; `merge` needs `merge_into` to exist, differ from `target`, same type; `add_link` needs `field` to be `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders` and declared by the target's type, and `after` to be an existing note id with the field's prefix (`prj-`, `per-`) for the reference fields or a non-empty string for `aliases` and `tags`; when `after` is already in the list the item is skipped (`ALREADY_LINKED`), so a re-run after approval writes nothing (0028); `new_item` carries `note`, one `note new` input item without `id` (§5.5), which must pass `note new` validation, with a back-reference to an existing meeting allowed because apply adds it (schema §11.2);
- **dedupes:** an item equal to an existing `pending` proposal on (`kind`, `target`, `field`, `after`, `content`, `note`, `supersedes`, `merge_into`) is skipped (`DUPLICATE_PENDING`), so re-running an ingest does not duplicate review rows. For `add_link`, the item's (`field`, `after`) is compared with each entry of a pending `add_link` on the same target (its `links`, or its `field` and `after` if it is an old single one). An `add_link` whose value is already listed is skipped as `{ "input_index": 2, "reason": "ALREADY_LINKED" }` (no `existing`).
- **groups `add_link` items (0037):** after validation and dedupe, the remaining `add_link` items of the input with the same `target` and `source` become **one** proposal, in input order: `links` = their (`field`, `after`) pairs as `{field, value}`, `why` = their distinct `why` texts joined by ` · `. Every new `add_link` proposal is written with `links`, never `field` and `after`, even with a single link. Its `title` is the item's own `title` when the group has one item; for two or more, the CLI writes `<target title>: add <parts>`, where `<parts>` lists each field present, in the order `people`, `projects`, `attendees`, `deciders`, `aliases`, `tags`, as `<n> <noun> (<v1>, <v2>, <v3>, …)` joined by `, `: nouns `person`/`people`, `project`/`projects`, `attendee`/`attendees`, `decider`/`deciders`, `alias`/`aliases`, `tag`/`tags` (singular for 1); values are note titles for reference fields, else the string; at most three values, then `…`; for a single value the parentheses hold just it. Titles longer than 120 characters are cut to 119 and end with `…`. Example: `Acme website: add 2 people (Lucía Fernández, Tomás Vidal), 1 alias (acme site)`.

**`review_notes` (0041, 0043).** Input: `{ "kind": "review_notes", "source": "<id>", "notes": ["dec-…", "que-…"] }`, plus optional `title` and `why`, and `fingerprint` and `evidence` for a reflection theme (below). `source` is the ingest's provenance value, as the other proposals of the ingest carry it: the meeting id for minutes, else the `src-` id. The CLI:
- checks every id in `notes` exists, is a knowledge note and is not listed by another `review_notes` proposal (any status) or twice here (`INPUT_INVALID`, pointer to the entry); at most one `review_notes` per `source` in one input (`INPUT_INVALID`);
- **folds the routine links:** every `add_link` item of the same input with the same `source` becomes an entry `{target, field, value: after}` of this proposal's `links`, in input order, instead of a grouped `add_link` proposal. Each is validated, deduped against pending `add_link` and `review_notes` proposals (`DUPLICATE_PENDING`) and skipped when already linked (`ALREADY_LINKED`) exactly as an `add_link` item; skipped items are reported and not folded. Without a `review_notes` item for their source, `add_link` items are grouped as above;
- **folds the changes (0045):** every `update_fact`, `update_body` and `add_to_note` item of the same input with the same `source` becomes an entry of this proposal's `changes`, instead of a proposal of its own. Each is filled (`before`, `from`, `before_hash`), validated and deduped (`DUPLICATE_PENDING`, against pending proposals of its kind and the `changes` of pending `review_notes`) exactly as a standalone item; skipped items are reported and not folded. The entry keeps the item's `kind`, `target`, `why` and that kind's fields, without `title` or `source`. Entries are stored in render order (schema §11.3): every `update_fact`, then every `update_body`, then every `add_to_note`, each in input order. `contradiction`, `supersede`, `merge`, `new_item` and `answer` items are never folded: they are judgment calls and keep their own rows. Without a `review_notes` item for their source, changes are written as proposals of their own;
- needs at least one entry in `notes`, `links` and `changes` together after folding; with none, the item is skipped (`NOTHING_TO_REVIEW`);
- writes `title`, unless given: `From <source title>: <counts>`. `<counts>` lists, in this order and only when not zero, `<k> changes` (`1 change`), `<n> new notes` (`1 new note`) and `<m> links` (`1 link`), joined by `, ` with ` and ` before the last: `From Acme sync: 1 change, 3 new notes and 2 links`. `<source title>` is the meeting's title for a meeting id, else the source's. Cut to 120 characters as above. `why` defaults to `What came in from <source title>`. A deferred row (§5.7) uses the same counts after `Deferred from <source title>: `.

**`answer` (0041).** Input: `{ "kind": "answer", "target": "que-…", "answer": "<sentence>", "answer_note": "dec-…", "why": "<quote>", "source": "<id>", "title": "…" }`, `answer_note` optional. `target` must be a question (`INPUT_INVALID`); `answer` non-empty; `answer_note`, when given, an existing knowledge note (`UNKNOWN_ID`). A question that already has an `answer` → skipped, `ALREADY_ANSWERED`. Dedupe: a pending `answer` on the same `target` with the same `answer` and `answer_note` → `DUPLICATE_PENDING`.

**`notion_change` (0072, [assistant.md](assistant.md) §6).** A change to a Notion-owned property, which the skill writes through the MCP after the decision (schema §11). Input: `{ "kind": "notion_change", "database": "tasks", "page": "<page id>", "page_title": "<the row's Name>", "property": "status", "value_before": "To Do", "value_after": "Done", "why": "…", "source": "agent:ultimate-assistant/20261106T100000Z", "finding": "task_overdue:notion:<page id>", "area": "area-…", "title": "…" }`; `target` (a `prj-` or `area-` id) is required for `projects` and `areas` and refused for `tasks`. The CLI checks, each `INPUT_INVALID` with its pointer:
- `database` and `property` pair: `tasks` with `status`, `due`, `project` or `area`; `projects` with `status` or `archived`; `areas` with `archived`;
- `tasks` needs the Tasks module on (`MODULE_OFF`) and the property's mapping in `notion.tasks.properties` non-empty; `projects` and `areas` need their `notion.databases` id set;
- the value shape (both values): `status` a non-empty string or `null` (on `projects`, one of `Planned`, `Active`, `On Hold`, `Done`); `due` a `YYYY-MM-DD` date or `null`; `project` and `area` a sorted, duplicate-free list of page ids; `archived` a boolean. `value_after` can't be `null` on `status`;
- on `projects` and `areas`, `target` exists, is a project or an Area as the database says, and has `notion` equal to `page`, or no `notion` (a page the skill matched by its Brain ID before its publish was recorded, assistant.md §2.1) (`UNKNOWN_ID`, `INPUT_INVALID`);
- `page` is a dashed lowercase page id; `page_title` non-empty; `area`, when given, an existing Area (`UNKNOWN_ID`).

`value_before` is the value the skill read; the CLI can't see Notion, so the stale check is the skill's when it writes (assistant.md §6.4). `value_after` equal to `value_before` → skipped, `NO_CHANGE`. Dedupe: a pending, approved or edited `notion_change` with the same `page`, `property` and `value_after` → `DUPLICATE_PENDING` (a rejected, applied or closed one doesn't block a new one). `title` defaults to `<page_title>: <Property> → <value_after as rendered>` (render's rules, §5.14.4), cut as above.

**`set_field` (0072, assistant.md §6.1).** A change to a brain-owned placement field: `{ "kind": "set_field", "target": "prj-…", "field": "area", "after": "area-…", "why": "…", "source": "…", "finding": "…", "title": "…" }`. `field` is `area` on a project or `domain` on an Area (`INPUT_INVALID` otherwise); `after` an existing note of that field's type (`UNKNOWN_ID`, `INPUT_INVALID`). The CLI sets `before` to the target's current value (absent when it has none); a given `before` that differs → `BEFORE_MISMATCH`; `after` equal to it → skipped, `NO_CHANGE`. `area`, when given, an existing Area (`UNKNOWN_ID`, `INPUT_INVALID`); when not given, the target's own Area: a project's current `area`, or the Area itself. Dedupe: a pending `set_field` with the same `target`, `field` and `after` → `DUPLICATE_PENDING`. `title` defaults to `<target title>: <Field> → <after title>`.

**`fingerprint` and `evidence`** (0052, 0076, schema §11.4): given together or not at all, never with `finding`, on the kind the fingerprint's finding takes (`contradiction`, `update_fact`, `merge`, `add_to_note`, `review_notes` or `new_item`); the fingerprint's parts must match the item (its `target`, `field`, merge pair, promotion `source`; a theme's `review_notes` lists exactly one note, a learned Document, and a theme's `new_item` holds one), and every `evidence` id must be a meeting or a source that exists (`INPUT_INVALID` with its pointer; `UNKNOWN_ID`). Stored as given. Dedupe: besides the rules above, an item whose fingerprint is on a `pending`, `approved` or `edited` proposal is skipped `DUPLICATE_PENDING`, naming it in `existing`. A reflection item is never folded into another `review_notes`: a theme's `review_notes` is its own row, and its `contradiction`, `update_fact`, `merge` and `add_to_note` items keep rows of their own even when an item of the same input has the same `source`.

**`finding`** (any kind, optional): the Ultimate Assistant finding key the proposal comes from (assistant.md §3.3); stored as given. Every proposal Ultimate Assistant writes has the `source` `agent:ultimate-assistant/<session>`, with or without `finding`; one decided in chat before it is published never becomes a Review row (§5.14.4).

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

**`proposal backlog`** (0041) writes the `review_notes` rows of a brain that existed before 0.4.0: one per source, over the `draft` notes nobody has accepted yet. Deterministic; a second run writes nothing.
1. Sources are taken in `captured` order, then id. A source's provenance value is its meeting's id when it is `minutes` (the meeting whose `source` is it), else its own id.
2. A source **claims** every knowledge note that has `lifecycle: draft`, is not listed in any `review_notes` proposal (any status), is not claimed by an earlier source, and either is that meeting or has the provenance value in its `sources`.
3. For each source that claims at least one note: one `review_notes` with `source` = the provenance value, `notes` = the claimed notes sorted by `created`, then id, `links: []`, no `changes`, the `title` rule above, and `why` = `Notes from <source title> waiting for your review`.

`data` as for `proposal new` (`created`, `skipped: []`, `dry_run`), without `input_indexes`. Logs `proposal-new` per proposal.

```json
{ "data": { "proposals": [ { "id": "prp-3c8v1n5x", "kind": "update_fact", "status": "pending", "title": "Acme launch: Jan → Feb", "target": "prj-9x4t1b7e", "field": "launch_date", "before": "2027-01", "after": "2027-02", "from": "2026-12-03", "why": "…", "source": "mtg-8c4n2p7w", "created": "2026-12-03", "updated": "2026-12-03", "path": "_proposals/2026-12-03-acme-launch-jan-feb.md" } ] } }
```

**Item ids (0055).** A new `review_notes` is written with `items` (schema §11): every note, link and change gets one immutable `it-` id when the proposal is created, in render order. The ids are never recomputed, so a deferral, a regeneration or a re-render cannot move a decision onto another item. `brain lint` checks them (`proposal-items`).

### 5.7 `brain apply`

```text
brain apply [--input <file|->] [--record-only] [--dry-run]
```

Applies **decided** proposals (schema §11.1–11.2) and **your Notion corrections** (0023, 0027). Deterministic. Each proposal writes exactly the files in its kind's write set (schema §11.2); a correction writes only its target.

**Input** (both arrays optional, at least one non-empty):
```json
{
  "corrections": [
    { "target": "per-3h8w2n6c", "field": "facts.role", "value": "Product lead", "observed_at": "2026-12-05T09:00:00Z" }
  ],
  "decisions": [
    { "proposal": "prp-3c8v1n5x", "action": "approve", "decided_at": "2026-12-04T08:15:00Z", "decided_by": "notion" },
    { "proposal": "prp-2v6n8q4j", "action": "edit", "value": "Product Manager", "note": "Product Manager", "decided_at": "2026-12-04T08:16:00Z", "decided_by": "notion" },
    { "proposal": "prp-3w9k2m7d", "action": "approve", "note": "all except Tomás", "exclude": [ { "field": "people", "value": "per-2d8f4j6n" } ], "decided_at": "2026-12-04T08:17:00Z", "decided_by": "notion" },
    { "proposal": "prp-5k2m8q4w", "action": "fix", "note": "a: March, not February. All except d", "fixes": [ { "change": 0, "value": "2027-03" } ], "exclude": [ { "note": "que-6b2n8v4c" } ], "decided_at": "2026-12-04T08:18:00Z", "decided_by": "notion" }
  ]
}
```

A decision item may carry `note` (the Review row's What to fix, recorded as written in `decision.note`) and, on `approve` or `fix` of an `add_link` or a `review_notes`, `exclude`: on `add_link`, the `{field, value}` pairs of its `links` not to apply; on `review_notes`, `{note: <id>}` entries of its `notes`, `{target, field, value}` entries of its `links` and `{change: <index>}` entries of its `changes`, which are **deferred** to a new pending row (schema §11.3). The CLI never interprets `note`; the skill turns it into `fixes` or `exclude` (0037, 0045), reading the letters of the Review row (§5.14.4). `exclude` on any other kind or action → item `failed`, `INPUT_INVALID`; an entry that is not in the proposal → `failed`, `EXCLUDE_UNKNOWN`.

**`fix` (0045)** needs `note` and `fixes`, whose entries schema §11.3 gives per kind; it records status `edited` and applies the corrected proposal. `edit` with `value` is still accepted, with its rules before 0.5.0 (schema §11.1). A fix entry naming no item → `failed`, `FIX_UNKNOWN`; an item both fixed and excluded → `failed`, `INPUT_INVALID`.

**Order:** all `corrections` first, then all `decisions`, each in input order. Later items see the results of earlier ones.

**Decisions:**

| Proposal state | Result |
|---|---|
| `applied` or `closed` | `skipped`, reason `ALREADY_TERMINAL` (no-op, schema §11.1) |
| `pending` | write `decision` and the matching status, then apply, in one item operation |
| `approved`/`edited`/`rejected` with the same decision (same `action`, `value`, `fixes` and `exclude`; `note`, `decided_at` and `decided_by` are not compared) | apply |
| `approved`/`edited`/`rejected` with a different decision | the decision with the later `decided_at` is kept (you changed your mind in Notion before it was applied), then apply |

- **`--record-only`** writes the decision and status without applying (`approved`/`edited`/`rejected`), for a run that must not apply at all (0003). An unattended catch-up doesn't use it: it applies your explicit decisions (0051, §6.1).
- **Without `--input`**, `apply` applies every proposal that holds a recorded decision but is not terminal.

**Excluded evidence (0055, capture-and-review §5.1, eligibility.md §4.2 and §9.2).** Checked before apply on every route (`decided_by: chat` or `notion`), with the suppression records as they are at that moment, so an exclusion made after the proposal was written is caught; every kind is checked except `notion_change`, and a `review_notes` item by item (below). A proposal that rests on evidence the user excluded is **withheld whole**: it is **closed** and nothing of it is applied: decision recorded, `status: closed`, `closed_reason: stale`, item result `closed` with reason `SOURCE_EXCLUDED`. The brain never cuts the excluded line out of the wording and applies the rest: accepted text is never silently stripped (eligibility.md §4.4). A proposal rests on excluded evidence when

- the text it would write (`content`, `answer`, or `note.body`) has a line with a passage reference that is restricted when read as a claim of a note whose `sources` is the proposal's `source` (capture-and-review §5.1), **even when another cited line is live**: a mixed item is withheld like one whose every cited line is excluded. Lines with no passage reference (a heading, an `^[inferred]` or `^[ambiguous]` sentence) are the agent's framing of the claims beside them and decide nothing; or
- the text has no passage reference at all, or the proposal has no text, and its `source` is an older version or a full copy of an input that has a suppression record, which retrieval no longer returns.

**A `review_notes` with `items` (0.8.0 layout)** is judged item by item, by the Review page's rule (§5.14.3): one `it-` item is one change, one new note or one link (eligibility.md §4.1). On an approve or a fix in chat, and on a row-level Approve read from Notion, an item that rests on excluded evidence is withheld and the independent items apply: a withheld change or link is not applied (a change's result is `dropped` with reason `SOURCE_EXCLUDED`), a withheld draft is archived (result `archived`), and each withheld item is recorded in `item_decisions` as `{ item_id, decision: reject, decided_at, decided_by, state: closed, reason: source_excluded }`. When every pending item is withheld, the proposal is closed as above. An older-layout `review_notes` (no `items`) is not checked here: its folded changes are CC-179's (eligibility.md §9.3).

**Re-proposing from the live passages (eligibility.md §4.2, §9.5).** A withheld item is not repaired in place. The agent may propose the change again from its live passages alone (`proposal new`): that is a new pending proposal with its own id and no decision, so an Approve or an Accept given to the withheld item does not carry over to it, and `brain apply` without `--input` leaves it pending until the user decides it.

**Which decisions are checked, and what is judged (eligibility.md §9.5).** The wording that would be written is judged: on a `fix` or an `edit` that gives a `value`, that value; otherwise the proposed text. So an `approve` is always checked, and so is a fix that keeps the proposed text (a fix of a `new_item`'s title or frontmatter keeps its body): a generic Approve, or a fix that keeps the wording, never carries an excluded claim through, since approval never overrides an exclusion (eligibility.md §2). A value that cites a passage is judged like the proposal: one that still cites an excluded passage is closed, and one that cites only live passages (the user dropped the excluded line and kept the live one) is the user's exact acceptance of that wording and applies with the proposal's `source`. A value is the user's own wording, and is not judged, only when it differs from what was proposed (`content`, `answer`, `note.body`, or `after`) **and** cites no passage: a typo corrected in a text that keeps its `^[src-…#¶n:hash]` reference is still that claim, and a value equal to the proposed one is the proposal.

**The user's own wording is a separately attributed correction** (0055, capture-and-review §7.7; eligibility.md §9.5, the user's choice of 2026-11-10). It is applied even when it restates excluded content, and its provenance is `user-correction:<proposal id>`, never the proposal's `source`, so the brain never claims the source said it: an `update_fact` keeps the source's value in the timeline as `superseded` and adds the user's value as `accepted` with `source: user-correction:<proposal id>` (as an edited Review item, §5.14.3); an `add_to_note` appends it followed by `Source: user-correction:<proposal id>`; an `update_body` writes it; neither adds the proposal's `source` to the target's `sources`. A `contradiction` attributes a value other than its `after` to the user already (schema §11.2). An `answer` records no source. A warning in the skill when the user's value repeats excluded content is optional (CC-180).

**One rule on every surface.** `brain proposal new` skips such an item (§5.6). The Review page of the new layout holds an item that rests on excluded evidence (its source is excluded, the draft it creates has a restricted line, or the wording of its `update_body` or `add_to_note` meets the first condition): no wording, why or value is published, and an Accept closes it with `source_excluded` (§5.14.3, capture-and-review §7).

**What the rule does not see (a stated limit, narrowed: eligibility.md §9.6).** A line with no passage reference decides nothing, so a sentence in which the agent restates an excluded paragraph without its passage reference (`… ^[inferred]`), beside a live claim, passes the check when every passage the item cites is live: the CLI cannot tell a restatement from framing. 0077 narrows this three ways: every change will name all the passages it draws from, its uncited lines included, so a restatement whose item lists the excluded passage is a mixed item and is withheld whole (CC-179); the skills read existing content only through the filtered commands, so an excluded statement already in a note can't be read back and restated (CC-180); and the ingest never writes a statement from an excluded paragraph, cited or not (CC-180, measured by CC-185's cases and CC-186's runs). What remains is an agent that leaves a passage off the list and restates text it read during intake: the CLI does not detect it. An item already published on a Review page before the exclusion keeps its wording there, since a section is written once (capture-and-review §7.4); an Accept on it now closes it. A change with no text of its own (`update_fact`, `contradiction`, `supersede`, `merge`, `add_link`) whose `source` is the current version carries no passage, so the rule cannot tell which paragraph it rests on. The folded `changes` of an older-layout `review_notes` approved as a whole are not checked. These are CC-179. With no suppression record in the brain the check does nothing.

**Stale proposals.** Before applying `update_fact` or `contradiction`, the target's current `facts.<field>` must still equal the proposal's `before` (both absent counts as equal); before applying `update_body`, the target's body hash must still equal `before_hash`. Inside a `review_notes`, a stale change is dropped alone and the rest applies (schema §11.3). If it doesn't, the proposal is **closed**: decision recorded, `status: closed`, `closed_reason: stale`, and the item result is `closed` with reason `STALE_PROPOSAL`. The Review row shows Closed, and the next ingest may propose the change again against the current value.

**`review_notes` results (0041, 0045).** An applied or closed `review_notes` item also returns `notes`: one entry per listed note, `{ "id": "…", "result": "reviewed" | "archived" | "kept_draft" | "unchanged", "lifecycle": "<its lifecycle now>" }`. `unchanged` is a note that was no longer `draft` when the row was applied (you changed its Lifecycle in Notion); it is left as it is. `kept_draft` is an excluded note. An applied one also returns `changes`: one entry per change, `{ "index": 0, "kind": "update_fact", "target": "…", "result": "applied" | "dropped" | "deferred", "reason"?: "STALE_PROPOSAL" | "SOURCE_EXCLUDED" }`, `deferred`: the id of the new row holding the excluded items, when there are any, and `withheld`: the `it-` ids withheld for excluded evidence (above), when there are any. The skill's report names the `unchanged`, `kept_draft`, dropped, deferred and withheld items once (a withheld item without its wording, eligibility.md §4.3), and repeats every fix it applied ("a: launch set to 2027-03").

Other item failures (proposal unchanged):
- `EDIT_NOT_ALLOWED`: `edit` on a kind that forbids it (schema §11.1); `review_notes` is one of them (use `fix`);
- `FIX_UNKNOWN`: a `fixes` entry that names no item of the proposal;
- `UNKNOWN_ID`: proposal or target missing;
- `INVALID_RESULT`: the result would fail schema or lint, e.g. an edited value of the wrong shape;
- `INPUT_INVALID`, `EXCLUDE_UNKNOWN`: an `exclude` that doesn't fit the proposal (above).

**`notion_change` (0072, [assistant.md](assistant.md) §6).** The CLI can't write Notion, so apply never makes this change itself. An `approve` or `fix` (one `{value}`, the shape of `value_after`, schema §11.3) records the decision and the status `approved` or `edited`, and the item's result is `awaiting_notion`; a proposal already `approved` or `edited` with the same decision gives the same result again, without rewriting the proposal file, so a write a skill never carried out is handed back by the next apply. A `reject` closes it as usual. Each `awaiting_notion` item adds one entry to `data.notion_writes`:

```json
{ "proposal": "prp-6t2m8k4q", "database": "tasks", "page_id": "2b8c4d6e-1f3a-4b5c-8d7e-9f0a1b2c3d4e",
  "property": "Status", "payload": { "type": "status", "value": "Done" }, "expect": "To Do", "value": "Done" }
```

- `property` is the Notion property name: for `tasks`, the mapping in `notion.tasks.properties` (`status`, `due`, `project`, `area`); for `projects`, `Status` or `Archived`; for `areas`, `Archived`. A mapping emptied since the proposal was written → item `failed`, `NOT_MAPPED`, proposal unchanged.
- `value` is `value_after`, or the fix's value; `expect` is `value_before`.
- `payload` is `{type, value}` as `sync tasks` types it (§5.14.5): a task status `{ "type": <notion.tasks.status_type, select when absent>, "value": <name> }`, a project status `{ "type": "select", … }`, a due date `{ "type": "date", "value": { "start": "<date>", "end": null } }` or `{ "type": "date", "value": null }`, a relation `{ "type": "relation", "value": [<page ids>] }`, a checkbox `{ "type": "checkbox", "value": <bool> }`.
- With `--record-only`, the decision is recorded and no entry is returned. `notion_writes` is `[]` when there is none; `sync apply` returns the same array for its decisions (§5.14.3). The skill writes each entry and reports the result with `proposal settle` (§5.6, assistant.md §6.4).

**`set_field` (0072).** Applied like a correction of that field (below), with the stale rule of `update_fact`: the target's current `field` must still equal `before` (both absent counts as equal), else the proposal is closed `STALE_PROPOSAL`. `fix` takes one `{value}`: another id of the field's type. Write set: the target. The next `sync render` publishes the project's Area or the Area's Domain relation.

Each applied or closed proposal logs `apply <prp-id> "<title>" result=<applied|closed>`.

**Corrections** (0023, refined by 0027). `field` is one of:

| `field` | Effect |
|---|---|
| `facts.<key>` | As `update_fact` with `source: notion-edit` and `from` = `learned` = the date of `observed_at`: accepted entries for the key become `superseded` with `until`; append the accepted entry; set `facts.<key>` |
| `title`, `summary`, `why` | Replace the value. These are not facts, so there is no timeline entry; Git keeps the history |
| `area`, `goal`, `client`, `org`, `domain` | Set to the given ID (right prefix, must exist), or remove when `value` is `null`. `domain` is an Area's Domain (0055) |
| `people` | Replace with the given list of `per-` IDs |

Corrections apply to knowledge notes only (not sources, views or proposals). `--record-only` still applies corrections: they are your edits, not agent decisions (0003). A value equal to the current one → `skipped`, `NO_CHANGE`. Any other field → `failed`, `FIELD_NOT_CORRECTABLE`. Logs `correct <id> "<title>" field=<field>`.

```json
{ "data": {
    "dry_run": false,
    "corrections": [
      { "target": "per-3h8w2n6c", "field": "facts.role", "result": "applied", "changed": ["knowledge/people/maria-lopez.md"] }
    ],
    "decisions": [
      { "proposal": "prp-3c8v1n5x", "kind": "update_fact", "action": "approve", "result": "applied", "changed": ["_proposals/2026-12-03-acme-launch-jan-feb.md", "projects/acme-website/project.md"] },
      { "proposal": "prp-2v6n8q4j", "kind": "update_fact", "action": "edit", "result": "closed", "reason": "STALE_PROPOSAL", "message": "facts.role is \"Product lead\" (your correction above), proposal expected \"Designer\"", "changed": ["_proposals/2026-12-03-maria-lopez-role.md"] }
    ],
    "notion_writes": [],
    "summary": { "applied": 1, "closed": 1, "recorded": 0, "awaiting_notion": 0, "corrected": 1, "skipped": 0, "failed": 0 }
} }
```

Exit 1 if any item `failed` (a stale proposal is `closed`, not failed). Errors (whole command): `INPUT_UNREADABLE`, `INPUT_INVALID`.

After `apply`, skills run `index`, `views`, `lint`, then commit.

### 5.8 `brain index`

```text
brain index [--check]
```

Regenerates `index.md` exactly as schema §13 specifies (CX-04). `--check` writes nothing and exits 1 if `index.md` would change. A file whose frontmatter cannot be parsed is left out, with a warning `UNPARSEABLE` (lint reports it as an error); a duplicate ID keeps the first by path order, with a warning `DUPLICATE_ID`. Index never fails on content problems.

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
  | question | `kind`, `status` (`notion_fields.status`) |
  | meeting | `date` |
  | source | `source_key` |
  | view | `view_kind`, `project` |
  | proposal | `kind`, `status`, `target` |
  | memory | `scope` |
  | area, reference | — (a reference's place is in `area` and `projects`, 0045) |

- `backlinks` (schema §6): computed inverses. Keyed by target id (sorted); each list sorted by `type`, then `source`. Built from relation types `about` → `mentioned_in`, `depends_on` → `needed_by`, `contradicts` → `contradicts`, `derived_from` → `used_by`, `related_to` → `related_to`, and from fields `projects` → `project_of`, `area` → `area_of`, `goal` → `goal_of`, `client` → `client_of`, `org` → `member`, `attendees` → `attended`, `decided_in` → `decisions`, `raised_in` → `questions`. The persisted pair `supersedes`/`superseded_by` is not included. Links to missing IDs are left out (lint reports them). Notes with no backlinks have no key.
- `written`: the file was rewritten (only when its bytes change). `stale`: `index.md` is still out of date after the command, so it is `true` only with `--check`.
- Scan warnings: `UNPARSEABLE`, `NOT_A_NOTE` (no frontmatter, or no `id`), `UNREADABLE`, `SKIPPED_SYMLINK` (symbolic links are not followed), `DUPLICATE_ID`. A leading byte-order mark is ignored.

**Restricted evidence (0055, capture-and-review §5.1).** `index.md` and the JSON index describe a restricted note without its `summary` and facts (it stays listed: it may be independently supported); a partly restricted note loses its summary. `brain lint` and `brain status` compute `index-stale` the same way. A damaged suppression record fails the command with `SUPPRESSIONS_UNREADABLE`.

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

**Restricted evidence (0055, capture-and-review §5.1).** Views render only eligible evidence: with an active suppression in `_suppressions/`, a note that rests only on a suppressed passage, or on a changed input it cannot map (or of unknown lineage), is left out, and a restricted statement is removed from its note's text before rendering. `brain lint` computes `view-stale` the same way, so a suppression makes the affected views stale until `brain views` or `brain source extract` regenerates them.

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
| `broken-link` | error | relative Markdown link to a missing file |
| `wikilink` | error | `[[…]]` in a body |
| `unknown-marker` | error | `^[…]` other than `^[inferred]`, `^[ambiguous]` |
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
| `assistant-dismissals` | error | `_assistant/dismissals.json` (when present) isn't readable JSON, fails `$defs/dismissals` of `spec/schemas/assistant.schema.json`, or repeats a `key` ([assistant.md](assistant.md) §8); `assistant findings` refuses with `DISMISSALS_UNREADABLE`. One issue per problem, at that path, line 1 |
| `suppression-record` | error | a file of `_suppressions/` (or the folder) cannot be read or is malformed (0055, capture-and-review §5.3); retrieval commands refuse with `SUPPRESSIONS_UNREADABLE` |
| `proposal-items` | error | a `review_notes` `items` list that does not give every note, link and change exactly one immutable `it-` id, an item that refers to something the proposal does not hold, or an `item_decisions` entry that names no item or repeats one (0055, capture-and-review §7.2) |
| `proposal-fingerprint` | error | a proposal's `fingerprint` that doesn't match it (schema §11.4): its `target`, `field`, merge pair (`target` and `merge_into`, different and sorted), a promotion's `source`, a theme's one learned Document; or an `evidence` id that names no meeting or source (0052, 0076) |
| `extract-passages` | error | an extract source's `passages` does not list the `<!-- passage ¶n -->` paragraphs of its body in order, or a paragraph no longer matches its 8-hex hash (0055, capture-and-review §4.5) |
| `passage-ref` | error | a `^[src-…#¶n:hash]` in a note body names a source that is not an extract, a passage it does not hold, or the wrong hash; or a note lists an extract in `sources` but cites none of its passages (0055, capture-and-review §5.1) |
| `update-body` | error | an `update_body` proposal, or an `update_body` entry of a `review_notes`'s `changes`, whose target isn't a `reference` (0045) or is a `promoted` one (0049) |
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
| `near-duplicate` | warning | a pair the `near_duplicate` signal finds (§5.32: one type, `draft` or `reviewed`, the same types left out, a name of one matching a name of the other), unless the pair's `merge:` fingerprint is held (schema §11.4: waiting in Review, or skipped): one warning per pair, at the path of the note whose path sorts first, `may be the same <type> as "<title>" (<path>)` naming the other (0052) |
| `unknown-key` | warning | frontmatter key that the type's schema does not declare: the core fields, plus the knowledge fields (knowledge types), plus the type's own fields. `why` on a person is unknown |
| `freshness` | warning | schema §10 |
| `summary-length` | warning | summary longer than 200 characters |
| `no-sources` | warning | knowledge note without `sources`, except area, goal and project (often created in Notion) and decisions (an error, above) |
| `view-stale` | warning | a view's generated block is out of date |
| `index-stale` | warning | `index.md` would change on `brain index` |

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

Block text (normative; `{…}` filled from the brain; the `- Project:` and `- Area:` lines are left out when `.brain` has no project or area, and the line before them then ends with `.` instead of `:`; the workflow lines below are added when their skills are linked):

```markdown
<!-- ultimate-brain:start -->
## Ultimate Brain

Managed by `brain link`; edits inside this block are overwritten.

This repo is linked to the user's second brain:
- Project: {project title} (`{project id}`)
- Area: {area title} (`{area id}`)

The brain holds decisions, key facts, people and meeting history that this repo does not.

Consult it before you:
- make or revisit a decision about scope, architecture, vendors or the client;
- answer why something was decided, who someone is, or a date, budget or owner;
- rely on a fact about the client or project that this repo does not state.

How: use the `brain-query` skill, or run `brain query --candidates "<question>" --json` and read the notes it returns with `brain query --read <id> --json`, not by opening the brain's files: only these commands leave out what the user excluded or has not approved. Cite the note paths. Say when a fact is `contested` or `superseded`.

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

**Recall paragraph** (0074, [memory.md](memory.md) §7). When the brain's `settings.recall` is `opening` (schema §12), a paragraph goes right after the `How:` paragraph, with one blank line before and after it:

```markdown
At the start of substantive work, run `brain recall --pack --json` here and read its `text`: the user's lessons for this repo and where its work stopped. Mention a memory only when it shapes your approach. When the user says "wrap up", run the closing review of the `brain-query` skill: the lessons the user approves there are the one write this repo makes to the brain.
```

When `settings.recall` is `off` or absent, there is no recall paragraph, and a run of `brain link` removes one an earlier run wrote.

3. **Skills** (0029, 0038, 0059; skills-delivery §6.2): the **linked skills** are the skills of the source whose `targets` include `linked_repo`.
   - **Source.** A pinned brain (state `pinned` or `drift`): the files its lock lists, copied from the brain's `.agents/skills/<name>/`; before any write each must be a regular file with the locked bytes, and the first that isn't refuses `SKILLS_SNAPSHOT_MISSING` (§5.28) naming it. Unlisted files there and the brain's `.claude/skills` copy are ignored (lint covers them). An `unpinned` brain: the package snapshot, which must be compatible (else `SKILLS_SNAPSHOT_INVALID`), with warning `SKILLS_UNPINNED`.
   - **Writing.** For each linked skill, `.agents/skills/<name>/` and `.claude/skills/<name>/` are product-owned: files whose bytes differ are replaced, and files the snapshot doesn't list in that folder are removed.
   - **Retired linked skills.** A name in the previous `.brain` `skills.names` that is no longer linked has both its folders removed (each file `removed`, then the emptied folders). A `.brain` without `skills` retires nothing.
   - Nothing else under `.agents/` or `.claude/` is touched. Every skill file appears in `files` with its `action` (`created`, `updated` or `unchanged`), and a removed file appears with `action: "removed"`, e.g. `{ "path": ".agents/skills/brain-query/SKILL.md", "action": "created" }`.

Idempotent: a second run with the same options changes no bytes.

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
brain query --read <id>[,<id>…] [--repo <path>]
```

Returns ranked candidate notes for the query skill (CX-11); the skill reads them and writes the answer. `--read` returns notes in full, as retrieval may use them (§5.13.1). `brain query` without `--candidates` or `--read`, with a question or without one (`brain query "what did we decide?"`), is `USAGE` with the message `brain query requires --candidates or --read; use the brain-query skill to answer questions`; with both it is `USAGE` (`brain query takes one of --candidates and --read`). With either, an extra argument is `USAGE` (`Unexpected argument: <it>`).

**Ranking (deterministic):**
1. **Tokens:** NFKD, drop combining marks, lowercase, split on runs outside `[a-z0-9]`, drop tokens shorter than 2 and these stopwords: `a an and are as at be by did do does for from has have how in is it of on or that the this to was we what when where which who why will with` and `al como con de del el en es la las lo los para por que se su un una y`. These are the **words**; the commands that cite this step read them.
   - **Terms** (this command's ranking and snippets only): NFKC the text, then cut it into maximal runs of CJK characters and runs of anything else. A CJK character is a code point in U+1100–11FF, U+3040–309F, U+30A0–30FF, U+3100–312F, U+3130–318F, U+31A0–31BF, U+31F0–31FF, U+3400–4DBF, U+4E00–9FFF, U+A960–A97F, U+AC00–D7AF, U+D7B0–D7FF, U+F900–FAFF, U+FF66–FF9F, U+20000–2FA1F or U+30000–323AF. The terms are the words of the other runs joined by one space, then each CJK run's n-grams in order: its 1-character n-grams left to right, then its 2-character ones, then its 3-character ones (`東京の予算` gives `東 京 の 予 算 東京 京の の予 予算 東京の 京の予 の予算`). No stopword or length rule applies to an n-gram. The query's terms keep their order and repeats; the output's `tokens` lists them.
2. **Searched:** knowledge notes and sources (default `--types`: all except view, proposal, memory), as the restricted-evidence rule below leaves them. A `memory` (searched only when `--types` names it) is searched only when it is **eligible** for the caller folder (memory.md §2: reviewed, not superseded, in the caller's reach, supported by eligible evidence), the caller being `--repo`, else the current directory (memory.md §2.1). So this command never returns a memory that `brain recall --search` withholds from the same folder.
3. **Score:** Okapi BM25 (k1 = 1.5, b = 0.75) over the searched notes, each note one document whose terms are: the terms of its `title` and of each alias, three times; of its `summary`, twice; of every other frontmatter string value (facts and timeline values included), once; and of its body, once. A document's length |d| is its number of terms, repeats included; N is the number of searched notes and avgdl their mean length (1 when it is 0).
   - **Matching:** a query term that is a word matches every term of the document that starts with it (`deci` matches `decision`); an n-gram matches only itself. f(t, d) is the number of times the terms that t matches occur in d; df(t) is the number of documents where f(t, d) > 0.
   - **Sum:** over the query's terms in order (a repeated term counts each time), idf(t) · f(t, d) · (k1 + 1) / (f(t, d) + k1 · (1 − b + b · |d| / avgdl)), where idf(t) = ln(1 + (N − df(t) + 0.5) / (df(t) + 0.5)). A term with f(t, d) = 0 adds nothing.
   - The formula and the n-grams are adapted from claude-obsidian's `scripts/bm25-index.py` (commit `2e545563`, MIT License), as eval/retrieval-0.12 compared them (decision 0074 §5).
4. **Context boost:** if `--repo` (default: the current directory, when it has `.brain`) names a project, +3 to notes whose `projects` contains it or whose id is it; else, if it names an area, +2 to notes whose `area` is that area (per note: an area note outside the project still gets +2). It is added to step 3's sum. The marker is read as §5.12 step 1 defines it, `skills` included, by the one reader every command shares (CC-152): a `.brain` that is not valid JSON, or has a key §5.12 doesn't list, is `USAGE` naming the folder; a folder without one has no context.
5. **`score`** is the sum of steps 3 and 4 rounded to 4 decimal places, halves up: a JSON number such as `9.25` or `3`. Notes whose `score` is 0 are dropped. Order: `score` descending, then `updated` descending, then id. Then, on that whole list and before `--limit` cuts it, a note with a `superseded_by` relation moves to right after the note it names when that note is in the list and ranks below it, repeated until no note moves (a relation on a cycle, such as A superseded by B superseded by A, moves nothing), so the live note comes first, as 0009 orders memories: B superseded by C ranks after C, and a chain A → B → C orders C, B, A. An old note whose successor falls beyond the limit falls with it. A note it names that isn't in the list moves nothing, and an archived or superseded note without the relation keeps its place. Superseded notes are still returned, so the answer can name them as history. Default limit 10, max 50.

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

`assessment` and `date` are `null` when the type has none. A Document (`reference`) also has `origin` (absent = `part`), so the skill can say "a learned Document" (0071); other types have no `origin` key. A learned Document is a `reference`: `--types reference` finds it, and `--types concept` still matches a concept not yet converted by `brain upgrade`. Snippets: up to 3 body lines, in order, where a query term matches one of the line's terms as step 3 defines, each trimmed to 200 characters. Superseded notes are returned, not hidden; the skill labels them. A candidate with a `superseded_by` relation has `superseded_by`: that relation's target (the first, in file order); other candidates have no such key. Errors: `USAGE`.

**Restricted evidence (0055, capture-and-review §5.1).** With an active suppression in `_suppressions/` (capture-and-review §5.3) retrieval uses only eligible evidence: older versions and full copies of a changed input are left out as sources; in a knowledge note a body line whose `^[src-…#¶n:hash]` references are all not live is blanked (line numbers hold), each claim is judged by its own passage reference, whatever the note's `sources` list says; a note that rests on a changed input and has a body line with no passage reference, or a fact no accepted timeline entry supports, is left out whole unless it is resolved for that input (`lineage_cleared`, or its suppression reconciled); a partly restricted note loses its `summary`, a timeline entry whose source or `passage` is not live is dropped, and a fact whose accepted entries are all dropped is dropped. A passage is live only while the latest version of its input holds it, so a reconciled cleanup never makes an excluded passage, an older source version or a claim citing it eligible again; a re-included passage stays restricted per claim until a Restore record names that note and passage, and the latest extract does not return its text meanwhile. A suppression directory that cannot be read (anything but an absent one) fails the same way. If any suppression record is unreadable the command fails with `SUPPRESSIONS_UNREADABLE`.

#### 5.13.1 `brain query --read`

Returns each named note in full, as retrieval may use it. It is how a skill reads a note for an answer: a file opened directly shows statements the user excluded, memories nobody approved and memories meant for another project, which this command leaves out (decision 0055; memory.md §2). Read-only.

`--read` takes 1 to 20 distinct note ids separated by commas (a repeated id is read once and counts once; an empty id or more than 20 distinct ids is `USAGE`: `--read takes 1 to 20 note ids separated by commas`). `--limit` and `--types` are `USAGE` with it (`--<name> doesn't go with --read`). `--repo` names the caller, as for `--candidates`.

```json
{ "data": {
    "context": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n" },
    "notes": [
      { "id": "dec-7k2m9q4x", "status": "ok", "type": "decision", "title": "Use Supabase for auth", "path": "knowledge/decisions/2026-12-03-use-supabase-for-auth.md",
        "lifecycle": "reviewed", "assessment": "accepted", "date": "2026-12-03", "restricted": false,
        "frontmatter": { "id": "dec-7k2m9q4x", "type": "decision", "title": "Use Supabase for auth", "…": "…" },
        "body": "Use Supabase for auth; Firebase is retired after launch.\n" },
      { "id": "mem-4t8n2k6p", "status": "withheld", "reason": "not_eligible" }
    ]
} }
```

`notes` has one entry per id, in the order given. A note that is returned has `status: "ok"`:

- **`frontmatter` and `body`** are the note as the restricted-evidence rule of §5.13 leaves it: a restricted body line is returned as spaces of the same length (line numbers hold), a restricted timeline entry or fact is dropped, and a partly restricted note has no `summary` or `aliases`. `restricted` is `true` when that rule changed anything.
- `title`, `lifecycle`, `assessment`, `date` and `path` as in a candidate (`null` when the note has none); `superseded_by` only on a note with that relation.
- **A memory** is returned when it is eligible for the caller (memory.md §2), or when it is one `brain recall --search --include-superseded` returns to the caller (memory.md §6.1: superseded, not a draft, in reach, evidence left in), so an answer can say what a rule replaced.

A note that is not returned has `status: "withheld"` and a `reason`, and nothing else:

| `reason` | When |
|---|---|
| `unknown` | no note has this id |
| `restricted` | the restricted-evidence rule leaves the note out whole; or a view that rule leaves out (below) |
| `not_eligible` | a memory the paragraph above does not return (the reason does not say which rule, so it tells nothing about a memory meant for another folder); or a proposal, which is never read here: it may propose what its evidence no longer supports |

**Views (0055, capture-and-review §5.1).** A view (a Brief, a Decision log, an area Brief, a report) has no passage references, so it is never returned in part. While the brain has a suppression record, a view is withheld (`restricted`), and left out of `--candidates --types view`, in two cases:

1. **A note it rests on.** Any note in its `generated_from`, or any note its body links, is restricted in any part (whole, a body line, a timeline entry, a fact, its summary) or no longer exists; a relative link in its body to a Markdown file (`.md`) that names no note and no file of the brain, or that leaves the brain, counts as a note that no longer exists. A link to anything else (a PDF, an image, a folder) or to a Markdown file that isn't a note (a `README.md`) neither withholds the view nor counts as a note it rests on. This holds for as long as the note is restricted, also after `brain views` or a refresh rewrote the view without the excluded text: the view comes back when the note's cleanup row is resolved.
2. **A report older than the exclusion.** A report whose `generated_at` is not later than the `captured` time of an extract version that carries a suppression record. Both are compared as full timestamps (`2026-12-10T10:00:00Z`, the schema's form): the same second withholds, since the report may have been written first, and so does a time on either side that isn't a full timestamp (a date alone) or can't be read. A report is prose written by a skill and never edited by the brain, so a line may restate what that version removed without linking the note it came from. A refresh reads the notes through this command and writes a new `generated_at`, which clears this case.

A view is navigation and never evidence (schema §4): an answer cites the notes, and a skill that finds a view withheld searches with `--candidates` instead. After upgrading, a brain with an aliased, wholly restricted note gets one `index-stale` lint warning until `brain index` runs.

A withheld note is not an error: the exit code is 0. The skill never opens the file of a withheld note. Errors: `USAGE`; `SUPPRESSIONS_UNREADABLE` (exit 5) when a file of `_suppressions/` cannot be read, as for `--candidates`.

### 5.14 `brain sync …` (Notion helpers, CX-10)

The sync, apply and ingest skills read and write Notion through the MCP. These commands do the deterministic parts. Flow of one `brain sync` skill run:

```text
skill reads Notion rows (MCP) → snapshot.json
brain sync plan --input snapshot.json   → plan.json   (read-only)
brain sync apply --input plan.json      → creates notes, applies corrections, decisions and Notion-owned fields
brain index; brain views; brain lint; git commit
brain sync render --changed             → payloads for Notion
skill writes pages (MCP)                → results.json
brain sync record --input results.json  → stores page ids and what was published; git commit
```

**Pull before push.** Skills always run `plan` and `apply` before publishing, so your Notion edits are read before the brain republishes.

**Three-way comparison (normative).** For every brain-owned property, the brain keeps what it last published in the note's `notion_published` (schema §3.2, written only by `sync record` and `sync apply`). With **N** = the value in Notion now, **S** = the stored published value and **B** = what `sync render` would publish now:

| Case | Meaning | Result |
|---|---|---|
| N = S | you did not change it | nothing; if B ≠ S, the next render publishes B |
| N ≠ S, B = S | you changed it | your correction (0023, 0027) |
| N ≠ S, B ≠ S, N = B | both arrived at the same value | `updates` sets S = N |
| N ≠ S, B ≠ S, N ≠ B | you and the brain both changed it | conflict `BOTH_CHANGED` with `property`, N and B; the skill asks you, and `render` holds that property back until then (§5.14.4) |
| S unknown (never published) | no baseline | if N = B, `updates` sets S = N; otherwise nothing, and the next render publishes B |

N, S and B are compared in the normalized Notion form of §5.14.1 (B is the brain's value as `render` would publish it: page ids, `{start, end}` dates, select labels); relations compare as sorted lists, Lifecycle compares case-insensitively, and an empty text equals `null`. A relation that links a note with no Notion page yet counts as changed in the brain, so a Notion edit to it is `BOTH_CHANGED`, never a correction that drops the unpublished link. An emptied or unknown Lifecycle is reported before the three-way comparison. Only a correction converts N to the brain's form. Dates of edits play no part, so an edit to one property never affects another.

#### 5.14.1 Snapshot (input to `sync plan`) and value conversion

Written by the skill, normalized from MCP results:

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

- `database`: a key of `brain.json` `notion.databases` among `domains` (0065), `areas`, `goals`, `key_results`, `projects`, `people`, `orgs`, `decisions`, `questions`, `documents`, `review`, `inbox` (`references` is read as `documents`, 0049; `concepts` is retired in 0.9.1, 0071, and a snapshot naming it is `INPUT_INVALID`). Meetings are not a snapshot database. The skill snapshots only the databases of modules that are on (schema §12, 0048). For `inbox`, the skill passes only:
  - the rows whose **Document asked** box is ticked (by the Keep as document button) and that have a Brain ID, with `Document asked`, `Only keep` and `Brain ID` (0049). A ticked row with no Brain ID isn't in the snapshot: the ingest takes it in, with its Only keep, when it is Ready;
  - every other row that has a Brain ID, with `Brain ID` only (ids, no other property; CC-153): `sync plan` links a source whose page was written but never recorded (§5.14.2) and compares nothing else. A row with no Brain ID (a capture not yet taken in, a Catch-up row) is not passed.
  Nothing else on an Inbox row is read back (an edit you make to an Inbox row's Summary or relations stays in Notion until the brain's value changes; 0043). For `decisions`, the rows may also carry **Promote asked** (ticked by the Promote to document button, 0049).

  **Report rows (0071).** A Report row is a report's page: a Documents row with Origin = Report since 0.9.1, an Inbox row with Kind = Report before migration 0019 moved it. With Reports on, the skill passes, in the database where the row is (`documents`, or `inbox` in a space not yet on migration 0019):
  - the Report rows whose **Refresh asked** box is ticked or whose **What to fix** isn't empty, with `Refresh asked`, `What to fix` and `Brain ID` (0045). A snapshot from before migration 0010 may carry `Refresh` instead, read the same way;
  - the Report rows that §5.14.7 selects (Accepted ticked, or edited since `last_synced`), with its wording fields. These rows need neither Refresh asked nor What to fix.

  Nothing else on a Report row is read back: its Name, Project, Area and Asked in are the brain's and are not compared (an edit stays in Notion until the brain's value changes, as on the Inbox).
- A property missing from `properties` was not read and is not compared.

**Normalized values** (the one form used in snapshots, render payloads and `notion_published`):

| Notion type | Normalized value |
|---|---|
| title, text, select, status, url, email | string; empty → `null` |
| number | number or `null` |
| checkbox | boolean |
| date | `{"start": "<date or timestamp>", "end": "<…>" or null}` or `null` |
| relation | array of page ids, sorted |
| formula, rollup | their scalar result |

**Notion → brain:**
- `null` values and `null` date ends are dropped: the key is left out of `notion_fields`, and a correction to `null` is only allowed for the optional references in the table below (it removes them).
- Dates go into brain date fields as their first 10 characters (`YYYY-MM-DD`).
- Numbers: a Key Facts value, a Review Note taken as an edited value, or any other text becomes a number when the brain's current (or proposed) value for that field is a number and the text is a finite number (`80000` → `80000`); otherwise it stays a string.
- Relations map page ids to brain ids through the notes' `notion` fields. An unknown page → conflict `UNRESOLVED_RELATION`.

**Brain → Notion:**
- A month value (`2027-06`) renders as `{"start": "2027-06-01", "end": null}`. Because the comparison uses the stored published value, a month round-trips without a spurious correction.
- `lifecycle`, `assessment`, `kind`, proposal `kind` and `status` render as select labels: each word capitalized (`provisional` → `Provisional`, `update_fact` → `Update Fact`). Proposal status maps to State: `pending`/`approved`/`edited`/`rejected` → `Pending`, `applied` → `Applied`, `closed` → `Closed`.

#### 5.14.2 `brain sync plan`

```text
brain sync plan --input <snapshot|->
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
- In `decisions`, `questions`, `documents`, `review` → `ignored`, `NOT_CREATED_IN_NOTION` (those rows are created by the brain only).
- `key_results` rows never have a Brain ID; see below.

**Rows with a `Brain ID`:**
- No such note → conflict `UNKNOWN_BRAIN_ID`. The note's `notion` differs from `page_id` → conflict `NOTION_ID_MISMATCH`. The note has no `notion` → `updates` sets it.
- **Notion-owned** properties → the type's `notion_fields` (table below), plus `as_of`. If any value differs from the stored snapshot (ignoring `as_of`) → an `updates` item with the full new `notion_fields`. Notion is the authority; no three-way comparison.
- **Lifecycle** (yours; agents also set `draft` and `archived`) → three-way comparison; "your correction" here is an `updates` item that sets `lifecycle`. Not read on domains, areas, goals, projects and orgs (0070): a Lifecycle still in such a database is ignored, with no conflict or `ignored` entry.
- **Brain-owned** properties → three-way comparison; "your correction" is a `corrections` item when the property is correctable (table below), otherwise `ignored`, `NOT_CORRECTABLE`. For Key Facts, the comparison runs **per key** on the parsed texts (N, S and B each parsed as §5.14.4 says), so a change to one key never conflicts with a change to another; each key is reported as `property: "Key Facts/<key>"`. A key in S that is missing from N → `ignored`, `FACT_REMOVAL_NOT_SUPPORTED`. A Name, Summary or Lifecycle emptied in Notion → conflict `REQUIRED_EMPTY`; a Lifecycle option the brain does not know → `ignored`, `UNKNOWN_OPTION`. Lifecycle is compared case-insensitively (Notion shows `Draft`, the brain stores `draft`).
- **Review rows** with **Your call** set and `State` = `Pending` (0045; a snapshot taken before migration 0009 has `Decision` and `Note` instead, read the same way, and the option **Edit** is read as **Fix**, so decisions made before the migration are never lost. Only reading is compatible: render sends the 0.5.0 names, see §5.14.4). The snapshot properties are `Your call` (select) and `What to fix` (text). A proposal already terminal is checked first (below), so a row whose What to fix the skill has handled never comes back:
  - **Approve** or **Reject** with an empty What to fix → a `decisions` item for `brain apply`: `action`, `decided_at` = `last_edited`, `decided_by: notion`.
  - **Approve** or **Reject** with What to fix → conflict `NOTE_TO_READ` on `What to fix`, with `notion_value` = the text and `brain_value` = the label. No decision item: the skill reads the text and passes `brain apply` the decision it means (with `note`, and `exclude` for "all except …"), or asks the user.
  - **Fix** with What to fix → conflict `FIX_TO_READ` on `What to fix`, the same way: the skill reads the text and passes `brain apply` an `action: fix` decision with `note` and `fixes` (schema §11.3), naming items by the row's letters (§5.14.4). The plan never guesses what the text means.
  - **Fix** with an empty What to fix → conflict `FIX_WITHOUT_TEXT`.
  - A proposal already terminal → `ignored`, `ALREADY_TERMINAL`.
- **Inbox** rows: a row whose Brain ID names no note → `UNKNOWN_BRAIN_ID` (CC-153). A row whose Brain ID names a source that has an Inbox row of its own (§5.14.4: any kind but `minutes`, not an attached file, not a `capture`, whose page is the one in its key) follows the Brain ID rules above: the source's `notion` is another page → `NOTION_ID_MISMATCH`; no `notion` → `updates` sets it, so a page a run created and never recorded (`sync record` not reached) is linked at the next pull instead of created again by `render --changed`. Then (0049): a row with `Document asked` = true and a Brain ID naming a source (any kind but `minutes`) → a `document_requests` item `{ "page_id": "…", "source": "src-…", "files": ["src-…"], "only_keep": "…" | null }`. `source` is the latest version of that source (following `replaces` forward, schema §4); `files` is the sources attached to it (`attached_to` = it), sorted by id, possibly empty: when it isn't, the Document is made from each file, not from the capture's text. `only_keep` is the row's Only keep, `null` when empty. With `only_keep` null and a `whole` Document of each source in question already there, the item carries `"existing": ["ref-…"]`: nothing is left to write, and the skill only clears the box. A Brain ID naming no note → conflict `UNKNOWN_BRAIN_ID`; one naming a report, any other note that isn't a source, or minutes → `ignored`, `NOT_A_SOURCE`; a ticked row with no Brain ID (not taken in yet, so not meant for the snapshot) → `ignored`, `NOT_INGESTED`; with Documents off, a ticked box → `ignored`, `MODULE_OFF`, `property: "Document asked"`. A `Full text` property in a snapshot (a skill from before 0.6.0) → `ignored`, `RETIRED`.
- **Promote asked** on `decisions` rows (0049; on Concepts rows too before 0.9.1, 0071): `Promote asked` = true → a `promote_requests` item `{ "page_id": "…", "note": "dec-…" }`, or `{ …, "existing": "ref-…" }` when a `promoted` Document of that note already exists (the skill only clears the box). Promote asked is never compared or corrected; false means nothing. With Documents off, a ticked Promote asked → `ignored`, `MODULE_OFF`, `property: "Promote asked"`, and the rest of the row is planned as usual. On a note whose `lifecycle` isn't `reviewed` or `disputed` (a Draft page kept from before 0.9.1, 0071), a ticked Promote asked → `ignored`, `NOT_REVIEWED`, `property: "Promote asked"`, and no request: the skill leaves the box ticked, so the request is carried out at the first sync after the note is approved (in its Review row, or by setting its Lifecycle to Reviewed).
- **Clearing the boxes (0048).** `sync render` never sends Document asked or Promote asked: once the skill has acted on a request (or found it already done, `existing`), it unticks the box through the MCP, and for an Inbox row also sets Brain Status back to Done. A request the run skipped keeps its box ticked, so the next catch-up sees it again. **Report rows** (0045, Brain ID a `vw-` report; a Documents row, or an Inbox row before migration 0019, §5.14.1): only Refresh asked, What to fix and §5.14.7's wording are read, and no property of the row goes through the three-way comparison. Refresh asked (or `Refresh`) = true → a `refresh_requests` item `{ "page_id": "…", "report": "vw-…" }`; a non-empty What to fix whose text isn't the `text` of the report's last `fixes` entry → a `report_fixes` item `{ "page_id": "…", "report": "vw-…", "text": "…" }`. The skill refreshes the report (§5.18) and turns each fix into proposals. An Inbox row with no Brain ID holds no report (an unattended run's summary row, §6.1, is one: Kind Report before 0.9.1, Catch-up since; the snapshot carries no Kind, so none is needed): a ticked Refresh asked (or `Refresh`) or a non-empty What to fix on it → `ignored`, `NOT_A_REPORT`, with the property; while Reports is off → `ignored`, `MODULE_OFF`, as for any Report row. Every other Inbox property is ignored.
- **Key Results** rows are grouped by their `Goal` relation into the goal's `notion_fields.key_results` (sorted by name, then page id) and compared like other Notion-owned fields. A Key Result whose goal the brain does not know → `ignored`, `UNKNOWN_GOAL`.

**Property ownership per database** (schema §14). Name and Summary are brain-owned everywhere; Brain ID and Last Synced are system:

| Database | Notion-owned → `notion_fields` | Correctable brain-owned → correction `field` |
|---|---|---|
| domains | Type → `type`, Archived → `archived` | Name → `title`, Summary → `summary`, Org → `org` |
| areas | Archived → `archived` | Name → `title`, Summary → `summary`, Domain → `domain` |
| goals | Status → `status`, Progress → `progress`, Archived → `archived`, Key Results → `key_results` | Name, Summary, Why → `why`, Deadline → `facts.deadline`, Area → `area` |
| projects | Status → `status`, Priority → `priority`, Dates → `dates`, Archived → `archived` | Name, Summary, Key Facts → `facts.<key>` (§5.14.4), Area → `area`, Goal → `goal`, Client (first) → `client`, People → `people` |
| people | Email → `email` | Name, Summary, Role → `facts.role`, Org (first) → `org` |
| orgs | Relationship → `relationship`, Website → `website`, Archived → `archived` (0070) | Name, Summary |
| decisions | — | Name, Summary |
| questions | Status → `status` | Name, Summary |
| documents | — | Name, Summary |

Other brain-owned properties (Assessment, Supersedes, Decided In, Raised In, Kind, Project on Decisions and Questions, the derived Area on Decisions and Questions (0034), Project and Area on Documents) are not correctable in v1 (decision 0027): a change you make there is `ignored`, `NOT_CORRECTABLE`, so the skill can tell you to use a proposal instead.

```json
{ "data": {
    "as_of": "2026-12-05T09:00:00Z",
    "create": [ { "type": "org", "id": "org-5h2k8q1w", "title": "Globex", "lifecycle": "draft",
                  "frontmatter": { "summary": "Globex", "notion": "…", "sources": ["notion:…"],
                                   "notion_fields": { "as_of": "2026-12-05T09:00:00Z", "relationship": "Prospect" },
                                   "notion_published": { "Name": "Globex", "Summary": null } },
                  "body": "" } ],
    "updates": [ { "id": "prj-9x4t1b7e", "notion_fields": { "as_of": "2026-12-05T09:00:00Z", "status": "Active", "priority": "High", "dates": { "start": "2026-10-01" }, "archived": false } } ],
    "corrections": [ { "target": "per-3h8w2n6c", "field": "facts.role", "value": "Product lead", "observed_at": "2026-12-05T08:40:00Z", "property": "Role", "notion_value": "Product lead" } ],
    "decisions": [ { "proposal": "prp-3c8v1n5x", "action": "approve", "decided_at": "2026-12-04T08:15:00Z", "decided_by": "notion" } ],
    "document_requests": [ { "page_id": "…", "source": "src-4m9q2x7c", "files": ["src-3m8q2v7c"], "only_keep": null } ],
    "promote_requests": [ { "page_id": "…", "note": "dec-3f7k9m2q" } ],
    "refresh_requests": [ { "page_id": "…", "report": "vw-4c7n2k9p" } ],
    "report_fixes": [ { "page_id": "…", "report": "vw-4c7n2k9p", "text": "Lucía left Acme in June" } ],
    "conflicts": [ { "database": "goals", "page_id": "…", "brain_id": null, "code": "MISSING_REQUIRED", "message": "goal \"Write a book\" has no Area" } ],
    "ignored": [ { "database": "decisions", "page_id": "…", "brain_id": "dec-7k2m9q4x", "property": "Assessment", "reason": "NOT_CORRECTABLE" } ]
} }
```

- `observed_at` of a correction is the row's `last_edited`; `property` and `notion_value` (N, normalized) let `sync apply` set S. For Key Facts, `notion_value` is the whole Key Facts text.
- An `updates` item is `{id, notion?, lifecycle?, notion_fields?, published?}`: each optional key is set only when it changes; `published` is a map of S values to set (the converged case of the three-way table).
- A conflict item is `{database, page_id, brain_id, code, message, property?, notion_value?, brain_value?}`.
- Every array is sorted by database (in the order of the snapshot `database` list above), then `page_id`, then `field` or `property`. `sync apply` echoes `document_requests`, `promote_requests`, `refresh_requests` and `report_fixes` without executing them.

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (unknown database key, bad value shape).


**Review rows of the new layout (0055, capture-and-review §7.3).** A Review row of a proposal that has `items` and a recorded `published["@review"]` (the page was rendered with item sections) may carry a `review` object: `{ "decided": <Decided ticked>, "decided_at": <Decided at, or null>, "accept_all": <Accept all ticked>, "page_edited_at": "…", "body_markdown": "<the page as Markdown, cli §5.14.7 rules>" | null }`, with a block the skill could not convert replaced by the line `<!-- unconvertible block -->`. A row published before the item sections (no `@review`) is read by the 0045 rules, `What to fix` included. For the new layout `sync plan` adds:
- `review_decisions`: `[{ proposal, page_id, decided_at, decided_by: "notion", page_edited_at, unattended_ok, accept_all, items: [{ item_id, decision: accept·reject·defer, proposed, proposed_hash, rendered_proposed_hash, base_hash, snapshot_hash, edited }] }]`. `proposed` is the exact final wording for an `accept` (the Proposed toggle as read: unescaped, canonical), null otherwise; `proposed_hash` is its sha256 hex, `rendered_proposed_hash` the one recorded at render, `edited` their difference; `base_hash` is what the target holds now; `snapshot_hash` is the sha256 of the item's section as read. `unattended_ok` is true when `decided_at` is at least 2 minutes before `as_of`.
- `review_held`: `[{ proposal, page_id, item_id | null, reason }]`, items or rows that were not applied: `DECIDED_WITHOUT_TIME`, `BODY_UNREADABLE`, `EDITED_AFTER_DECIDED` (the page was edited in a later minute than Decided at: the row is held whole, the user submits again), `MISSING_SECTION` (never an implicit decision), `DUPLICATE_SECTION`, `UNREADABLE_DECISION` (the token is not Pending, Accept, Reject, Defer or Request revision, or the section has two `Decision:` lines, or two `Revision request:` lines), `REVISION_PENDING` (a Pending item with a typed `Revision request:` line is not decided by Accept all or a row-level call; it waits), `UNREADABLE_PROPOSED` (the toggle is missing, empty, or holds an unconvertible block: empty wording is never an accept or a deletion), `HELD_SOURCE_EXCLUDED` (the item rests on excluded text and cannot be accepted), `NO_BASELINE` and `BASE_CHANGED` (the target is not what the item was proposed against; Reject and Defer are still read).
- `review_revisions`: `[{ proposal, page_id, item_id, instruction }]`, items marked Request revision with the text of the `Revision request:` line. The attended skill drafts the new wording; an unattended run never reads `instruction` and applies nothing for them.
- `review_pending`: rows whose page holds an edited Proposed, a token other than Pending, an unreadable token or a requested revision, or whose Decided is ticked; `sync render --plan` withholds them (§5.14.4).
An item that `item_decisions` already records is never decided again, and its section may be missing. Nothing is read until `decided` is true. Without it only the row-level shortcut is read: a `Your call` of Approve or Reject is a `decisions` item (the 0045 apply, each item's stored proposal text), refused as the conflict `EDITED_PROPOSED_NEEDS_SUBMIT` when any Proposed was edited; Fix or Request revision is the conflict `ROW_REVISION_NOT_SUPPORTED`. `Submit and accept all` (`accept_all`) reads every item still on Pending as Accept, and with `decided` true a row-level Approve or Reject decides the items still on Pending the same way (Accept or Reject); an explicit token wins. Precedence: an item's explicit token (after Submit) > the row-level call > the legacy What to fix (old-layout rows only).

#### 5.14.3 `brain sync apply`

```text
brain sync apply --input <plan|-> [--record-only] [--skip-conflicted] [--dry-run]
```

**`--skip-conflicted`** (0051, the unattended catch-up, §6.1) skips a conflicted row whole: an item belongs to a row with a conflict in the plan when its note id (`create` `id`, `updates` `id`, `corrections` `target`, `decisions` `proposal`) equals a conflict's `brain_id`, or its page id (`create` `frontmatter.notion`) equals a conflict's `page_id`. Such an item is not executed: its result is `skipped`, reason `ROW_CONFLICTED`, and a `create` whose relations point at a skipped create is skipped the same way, transitively and whatever the order of the creates in the plan. A relation is an id in a frontmatter field that holds references: the fields `brain lint` checks for `missing-ref` (schema §3–§11: `area`, `goal`, `client`, `org`, `projects`, `people`, `sources`, `facts`, …), the `target` of each entry of `relations` (schema §6) and the `source` of each `timeline` entry. An id written in free text (`summary`, `aliases`, `tags`, the body) is not one, and neither does it make an item depend on another for `DEPENDENCY_FAILED`. Without the flag, a conflict blocks only its own property, as before.

With `--record-only` (a run that must not apply at all, 0003; an unattended catch-up runs without it, 0051), only additions run: `create`, `updates` and recording `decisions` (as `apply --record-only`); `corrections` are skipped and reported.

Executes a plan from `sync plan`, in this order:
1. **`create`**, per item with the `note new` rules (except that `lifecycle` comes from the item). An item whose relations point at a create that failed also fails (`DEPENDENCY_FAILED`). Creates run **in relation order**, with or without `--skip-conflicted`: a create whose relations (as defined above) name the id of another create in the plan runs after it, whatever their order in the plan, so a new Area and the new Domain it names, or a new Project and its new Area or Org, are created in one run; creates that don't depend on each other keep the plan's order. `data.create` lists the results in the plan's order. Creates whose relations form a cycle (A names B and B names A, directly or through others; a create naming its own id is not one) are not executed: each fails `RELATION_CYCLE`, a create that depends on one fails `DEPENDENCY_FAILED`, and every other create and the rest of the plan are still applied. Logs `sync-create`.
2. **`updates`**: sets `notion`, `lifecycle`, `notion_fields` and the listed S values. Logs `sync-update`.
3. **`corrections`**, then **`decisions`**, with the `brain apply` rules. After a correction succeeds, S for its `property` is set to the Notion value, since Notion already shows it.
4. **`accepted_wording`** (0054, §5.14.7): the accepted Document or report text, imported exactly. Logs `sync-wording`.

`sync apply` never writes `last_synced` (only `sync record` does). `conflicts` and `ignored` are not executed; they are echoed for the skill to report.

Preconditions are re-checked (the brain may have changed since the plan): a create id now in use, or an update or correction target now missing → that item `failed`. `data` = `{ "create": […], "updates": […], "corrections": […], "decisions": […], "notion_writes": […], "conflicts": […], "ignored": […], "summary": {…} }` (`notion_writes` as in `apply`, §5.7), each executed item with `result` and `changed` as in `apply`. Exit 1 if any item `failed`.


**Review decisions of the new layout (0055, capture-and-review §7.5 to §7.7).** After the 0045 `decisions` and before accepted wording, `sync apply` applies each `review_decisions` item on its own (atomic per item; a failure or a result that adds lint errors restores that item alone). The skill re-reads the page just before applying and sets `verified` `{ snapshot_hash, proposed_hash }` on every item (§5.14.2); an item whose `verified` is missing (`UNVERIFIED`) or differs from the planned hashes (`CHANGED_SINCE_PLAN`) is refused. Further checks, each a `skipped` item with its `reason`: the proposal is a pending `review_notes` with `items` (`ALREADY_TERMINAL`, `NOT_A_REVIEW_WITH_ITEMS`), the item exists (`UNKNOWN_ITEM`) and is not in `item_decisions` yet (`ALREADY_DECIDED`: applying again is a no-op), and for an accept: the item is not held (`HELD_SOURCE_EXCLUDED`), the `base_hash` recorded at render, the planned one and what the target holds now are the same (`NO_BASELINE`, `BASE_CHANGED`), and the wording is not blank (`UNREADABLE_PROPOSED`) and is bound to its hashes (`WORDING_NOT_BOUND`: the sha256 of `proposed` must equal `proposed_hash` and `verified.proposed_hash`, so a plan cannot carry wording other than what was hashed and verified; `sync apply` rejects a plan whose review items lack well-formed hashes or `verified`). Whether the wording was edited is read from `proposed_hash` against the hash recorded at render, never from a flag in the plan. The base of every item is read **once at the start of a submission**, so two accepted items on one note both apply. **Accept:** a creation makes the draft `reviewed` (a draft already `reviewed` is only recorded; any other state is `NOT_A_DRAFT` and records nothing) and, when the wording was edited, writes it as the draft's body; `update_fact` applies the wording as the new value, `update_body` and `add_to_note` as the new text, `add_link` adds the value (an edited link value must be a note id or the exact title of one note, else `LINK_VALUE_UNKNOWN`). **An edited fact value is attributed to the user** (capture-and-review §7.7): `facts.<field>` becomes the user's value, the timeline keeps the source's value as a `superseded` entry with the source's own `source`, and adds the user's value as `accepted` with `source: user-correction:<proposal id>`. An unedited accept applies the proposal's own text, not the normalised copy read from the page. **Reject:** a draft is archived, a change or link is not applied. **Defer:** the deferred items of one decision move together to one new pending proposal under their own ids; creating it and recording the entries (`state: deferred`, `deferred_to`) are one unit, and if it fails (`DEFER_FAILED`) the items stay pending. A note can be deferred again from the proposal it was deferred to: lint follows the chain. Each item is recorded in `item_decisions` (`{ item_id, decision, decided_at, decided_by, proposed_hash, base_hash, snapshot_hash, state, edited? }`) in the same write as its effect; when no item is pending the proposal becomes `applied` (some item applied) or `closed` (none), with `decision` `approve` or `reject`. `data.review_results` lists `{ proposal, item_id, decision, result: applied·closed·deferred·skipped·failed, reason?, deferred_to? }`. With `--record-only` they are all skipped (`RECORD_ONLY`). **Excluded evidence (capture-and-review §5.1, eligibility.md §4.2):** an item that rests on excluded evidence (the proposal's `source` is an older version or full copy of a changed input; the draft it creates has a restricted line, or is restricted whole; or the wording of its `update_body` or `add_to_note` cites a passage that is not live, even beside a live one, by §5.7's rule) is never applied, even on an Accept, and never in part: `sync plan` emits it with `decision: stale`, and `sync apply` re-checks it (so an Accept in a hand-made plan is caught too) and closes it: the draft is archived as for a Reject, the entry is `{ decision: reject, state: closed, reason: source_excluded }` and the result is `closed` with `reason: source_excluded`. If the item no longer rests on excluded evidence a `stale` item is skipped (`NOT_EXCLUDED`). The check is made again with the suppression records as `sync apply` reads them, so an exclusion made after the render or the plan is caught. An Accept given to a withheld item does not carry over to a later item proposed from its live passages: that is a new pending item (§5.7, "Re-proposing"). An item held only because the note it **changes** is partly restricted (its Current can't be shown, while its own wording rests on live evidence) does not rest on excluded evidence: it is still held (`HELD_SOURCE_EXCLUDED`) and waits until that note is resolved. **One journaled operation (capture-and-review §7.11):** when a Review decision changed anything and the run is not `--dry-run`, `sync apply` writes the journal (§5.24) before any file, flushes the whole plan's files and the log, commits to Git with the trailer `Op: <op-id>` and removes the journal; the tree must be clean first (`DIRTY_TREE` before anything is written), so the skill commits its own earlier work before `sync apply`. A Git failure rolls the files back at once; a crash leaves the journal for `brain recover`. `data.op` names the operation. A plan with no Review decision, or whose decisions changed nothing, keeps the plain write and leaves the commit to the skill.

#### 5.14.4 `brain sync render`

```text
brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json> [--skip-conflicted]]
brain sync render --unpublish-drafts
```

Builds Notion payloads; writes nothing. With `--plan`, every property named by a `BOTH_CHANGED` conflict in that plan is held back (left out of `properties` and of `published`) until the skill has your answer; the skill passes the plan of the same run. With `--skip-conflicted` as well (it needs `--plan`: alone → `USAGE`; 0051, the unattended catch-up, §6.1), a conflicted row is held back whole: no item is rendered for a note whose id is a conflict's `brain_id` in the plan, or whose `notion` page id is a conflict's `page_id`; it is listed in `skipped` with reason `ROW_CONFLICTED`. A report named by a `report_fixes` item in the plan (its `report` id) is held back the same way, with reason `FIX_WAITING`: rendering it could clear a What to fix nobody has read yet (the Reports rule below clears What to fix and Refresh asked against the published baseline), for instance after an earlier publish failed and the user then wrote a new fix. Since `sync record` records only items it is given, a held-back note stays changed, and the next render after the conflict or the fix is handled (an attended run) publishes it. Relations from other items to a held-back note that has no page yet are pending, as for any unpublished note. The skill sends them through the MCP, then passes each item's `published` back to `sync record`.

**Only reviewed knowledge gets a page (0071, 0.9.1).** A decision, question, concept or reference (a Document) with no `notion` is **published** only when its `lifecycle` is `reviewed` or `disputed`: approved in Review (capture-and-review §7.5, schema §11.2), or reviewed from creation, as a `whole` or `workflow` Document is (§5.5). Until then it lives only in its Review row. One with `draft` or `archived` and no page is never created, so a rejected draft (archived by the Reject) never gets one. A note that already has a page is rendered whatever its `lifecycle`, so a superseded decision, an answered question and a page from before 0.9.1 stay in Notion as history. A person is published whatever its `lifecycle` (a meeting's Attendees needs its page), and so is every other type. Such a note is **unpublished** in what follows; `--ids` naming one lists it in `skipped` with reason `NOT_REVIEWED` (not an error).

**`--changed`** selects:
- notes of a published type (area, goal, project, person, org, decision, question, reference) with no `notion`, unless its module is off (schema §12, 0048: goals with Planning, orgs with Orgs, decisions and questions with Knowledge, references, learned ones included, with Documents, 0071) or it is unpublished (above). A `type: concept` note left before `brain upgrade` is never published (lint `concept-retired`);
- sources of every kind except `minutes` with no `notion` (0037: the Inbox). On the first run after the upgrade to 0.3.0 this selects every such source already in the brain, so the Inbox History fills with no migration;
- notes, meetings and sources (with `notion`) where any rendered property's B differs from S, or the page content changed (B of `@content` ≠ S);
- proposals with no `notion`, or whose State (or another rendered property) differs from S; except a proposal whose `source` starts with `agent:ultimate-assistant/`, or that has a `fingerprint` (a reflection answer, schema §11.4), that has no `notion` and whose `decision.decided_by` is `chat`: a change Ultimate Assistant made after a yes in chat never becomes a Review row ([assistant.md](assistant.md) §6.2), and neither does a reflection yes or skip (§6.2), with `--changed` or `--ids` (`--ids` lists it in `skipped`, reason `DECIDED_IN_CHAT`);
- with Reports on, reports (views with `view_kind: report`) with no `notion`, and published reports whose body, `fixes` count or any rendered property changed since S (0043, 0045). The first render on 0.9.1 therefore updates every published report once: Origin and Asked in are new names, so S holds neither (0071);
- published proposals that are `applied` or `closed`, decided more than 30 days before `--now`, and not yet trashed (0045; see **Leaving Review** below).

A source with `attached_to` is never selected: it has no Inbox row (0042). Notes whose database id is empty in `brain.json` are skipped with warning `DATABASE_NOT_CONFIGURED`. `--ids` naming a note whose module is off → item error `MODULE_OFF`.

**Relations to a module that is off** (0048) are left out of `properties`, `published` and `pending_relations` alike, as if the property didn't exist: Client on Projects and Org on People with Orgs off; Goal on Projects with Planning off; Decisions and Questions on the Inbox and on Meetings with Knowledge off; Documents on the Inbox with Documents off. S keeps what was last sent, so turning the module on again sends only what changed. `sync plan` doesn't compare these properties either (§5.14.2).

**Rendered properties per database** (exactly these; nothing else is ever sent):

| Database | Properties |
|---|---|
| domains | Name, Summary, Org, Brain ID, Last Synced, Archived *(once)* |
| areas | Name, Summary, Domain, Brain ID, Last Synced, Archived *(once)*; `sections` "Brief" (0041) |
| goals | Name, Summary, Why, Deadline, Area, Brain ID, Last Synced, Archived *(once)* |
| projects | Name, Summary, Key Facts, Area, Goal, Client, People, Brain ID, Last Synced, Archived *(once)* |
| people | Name, Summary, Role, Org, Lifecycle, Brain ID, Last Synced |
| orgs | Name, Summary, Brain ID, Last Synced, Archived *(once)* |
| decisions | Name, Summary, Date, Assessment, Project, Area, Decided In, Supersedes, Lifecycle, Brain ID, Last Synced |
| questions | Name, Summary, Kind, Project, Area, Raised In, Lifecycle, Brain ID, Last Synced, Status *(Open, Answered or Dropped, once)* |
| documents | Name, Summary, Project, Area, Origin (0071), From decision, Lifecycle, Brain ID, Last Synced (0045, 0049; From concept until 0.9.1, 0071); a report: Name, Origin, Project, Area, Asked in, Brain ID, Last Synced, Refresh asked *(clear)*, What to fix *(clear)* (0071) |
| meetings | Decisions, Questions, Attendees *(add)*, Project *(if empty)*, Area *(if empty)*, Brain Status, Ingested At, Brain ID |
| review | Name, Kind, About, About Page, Now, Proposed, Why, Source Meeting, Area (0050), State, Brain ID (Target, Target Page, Before, After before 0.5.0; 0045). Render always sends the 0.5.0 names: it doesn't read the space's schema, so a space not yet migrated (migration 0009) rejects the write. Migration 0009 therefore runs before the first publish on 0.5.0; `brain upgrade` names it, and the publish's error report names the missing property |
| inbox | Name *(create only)*, Kind *(if empty)*, Summary, Decisions, Questions, Documents, People, Project *(if empty)*, Area *(if empty)*, Brain Status, Brain ID, Last Synced. No report since 0.9.1: reports are Documents rows (0071) |

- On `create`, every listed property is sent. On `update`, only properties whose B ≠ S are sent, plus Last Synced (= `--now`) for the databases that have it (not Meetings or Review). So Lifecycle goes out on create (`Reviewed` or `Disputed` for knowledge since 0071, `Draft` for a new person) and when the brain changed it (`archived` by a supersession), and your own Lifecycle edits, already pulled into the brain, are never overwritten.
- **Archived *(once)*** (0070): domains, areas, goals, projects and orgs send no Lifecycle. When the note's `lifecycle` is `archived` (a merge or supersession) and `notion_fields.archived` is not true, Archived goes out as a checked checkbox; once S holds it, it is not sent again, so unticking it in Notion is your edit and stays.
- Project relations carry every id in `projects`.
- **Area on Decisions and Questions** (0034) is derived, never stored in the note: the `area` of each note in the record's `projects`, deduped and sorted. No projects, or projects without an area → empty. It is brain-owned and compared like any other property, so the first render after the upgrade sends it to every decision and question once.
- **Documents (0045, 0049):** Project = `projects`, Area = `area`; the body is the whole page body, as for decisions. From decision = `promoted_from`'s page on a `promoted` Document whose `promoted_from` is a decision; Notion fills Decisions · Documents. A Document promoted from a concept before 0.9.1 gets no From relation (From concept is retired, 0071). Origin = Learned on a `learned` Document (0071), its body brain-owned like a `part` one. **A Documents data source without Origin** (a space not yet through migration 0018): the skill leaves Origin out of the page write **and** out of the `published` it passes to `sync record`, and names migration 0018 in its report; the rest of the item is written as usual, and the first render after the migration sends Origin. A `promoted` Document's body is sent on `create` only: on `update`, `body` is `null` and `@content` isn't compared, because the body is yours from then on.
- **Question Status (0041, 0045, 0071):** Status stays Notion-owned for `sync plan` (§5.14.2); the brain sends it in three cases only, each once:
  - **Open:** when the question has no `answer`, S has no `Status` and its snapshot has no `notion_fields.status`, B of `Status` is `Open`. So a new question is created as Open, and a question published before 0.4.1 with Status empty in Notion gets Open on the next publish. Once S holds it, it is never sent again; a Status you set (pulled into `notion_fields.status`) is never overwritten.
  - **Answered:** when the question has `answer`, B of `Status` is `Answered`; it is sent only while S has no `Status` of `Answered`, so it goes out once, right after the `answer` proposal is applied.
  - **Dropped (0071):** when the question has `dropped` (set by `question drop`, §5.30) and no `answer`, B of `Status` is `Dropped`; it is sent only while S has no `Status` of `Dropped`, so it goes out once, in the publish after the drop, with its Lifecycle Archived. On a question that is created with `dropped` (never published before), it goes out on create.

  If you reopen the question in Notion, the brain never sets it back.
- **Areas (0041):** `sections` = `{ "Brief": <the area brief's generated block> }`. The skill replaces the children of the area page's "Brief" toggle heading; a page without one gets a "Brief" toggle heading appended at the **end** of the page, then filled (the page is yours, so the brain never inserts above your content).
- **Inbox** (0037; sources, every kind except `minutes`):
  - `action`: `update` when the source has `notion`, or is a `capture` (page id = the id in its `notion:` key: the row you created; a capture's key is always `notion:`, schema §4); otherwise `create`. A capture whose `notion` differs from its key's id → item error `NOTION_ID_MISMATCH`.
  - Name = `title`, sent on `create` only: a capture's Name is yours. Kind = the source `kind` as a select label (`Capture`, `File` for `document` (0049), `Email`, `Chat`, `Note`), with `"mode": "if_empty"`: the skill writes it only when Kind is empty in Notion, so a Kind you chose stands (0048). An S of `Document` compares equal to `File`, so rows published before aren't sent again. Summary = `summary` (empty when the source has none).
  - Decisions, Questions, Documents, People = every note of that type whose `sources` lists the source's id, sorted (learned Documents in Documents; Concepts is retired in 0.9.1, 0071); notes not yet published go to `pending_relations`. Documents is the property called References before migration 0010; `promoted` Documents aren't listed, since they come from a note, not the source. When `documents` is empty in `brain.json`, Documents is left out entirely, from `properties` and from `pending_relations`; the reference notes themselves are skipped with `DATABASE_NOT_CONFIGURED`. These are the "Produced" relations; the other side of each is that database's Sources relation, which Notion fills.
  - Project and Area carry `"mode": "if_empty"` (as on Meetings): Project = the `projects` of the produced notes, Area = their `area` and the `area` of those projects, each deduped and sorted. You may set them yourself before the ingest; the brain never overwrites them.
  - Brain Status = `Done` (0048; `Processed` before 0.6.0). An S of `Processed` compares equal to `Done`, so rows published before aren't sent again: migration 0010 renames the option. Brain ID = the source's id.
  - **Produced** relations also include every note whose `sources` lists the id of a source **attached** to this one (0042).
  - **Body (0043):** a capture's body is yours: `body` and `sections` are `null`. Any other source's `body` is its digest, written once (its content never changes, so B of `@content` = S after the first publish):
    ```text
    *<Kind> · <file_name, else the URL, else "pasted text"> · <the date in the file name> · <word count> words[ · <part count> slides]*

    <summary>

    <digest>
    ```
    A missing `summary` or `digest` leaves out its paragraph; `[ · <part count> slides]` only when the body has slide markers. The date is the one in the source's file name: `file_date` when `note new` was given one, else `created` (§5.5); `file_date` is not stored, so `render` reads it from the path. The words are the body's runs of non-space characters.
  - **Full text (0043) is retired in 0.6.0 (0049):** no `Full text` section or checkbox is sent, and `@full_text` in S is left as it is. Rows that already show a Full text toggle keep it.
  - `published` holds what was sent, so a later ingest that produces more notes from the same source (or publishes a pending one) re-renders only the changed relations.
- **Meetings** (0007; the page is yours): never Name, Date or body. *(add)* relations carry `"mode": "add"`: the skill adds the listed pages and keeps those you linked. *(if empty)* relations carry `"mode": "if_empty"`: the skill writes them only when the property is empty in Notion (design §3.5: "brain fills if empty"). Brain Status = `Ingested` and Ingested At = `{start: <meeting created>}` go out once, because S then holds them.
- **Origin** (0071) on every Documents row, brain-owned and never read back: a `reference` → `Kept` for `whole`, `part` or no `origin`, `Promoted` for `promoted`, `Workflow` for `workflow` (and `Learned` for `learned`, CC-123); a report → `Report`. Origin is a new name in S, so the first render on 0.9.1 sends it to every published Document once.
- **Reports** (0043, 0045; in Documents since 0.9.1, 0071): `database` is `documents`, and `action` is `create` with no `notion`, else `update`. Name = `title`; Origin = `Report`; Project = `projects`, Area = `area` (plain relations, not *if empty*); Asked in = `asked_in` as a list (one id or several), a relation to your Ask rows on the Inbox, whose other side (Inbox · Report) Notion fills; Brain ID = the view's id. No Summary, Lifecycle, Kind or Brain Status: a report is not reviewed (schema §4 view). A page moved from the Inbox by migration 0019 keeps its id, so the report keeps its `notion` and its baselines; the Inbox-only names in its S (Kind, Brain Status, Ask) are left there and never sent again. **Moved once:** a published report whose S has no `Origin` was last published on the Inbox, and a move between databases can drop properties, so its next render sends **every** property above as on `create` (the body only when it is due, as below); S then holds Origin, and later renders send only what changed. Render always sends the 0.9.1 names: a space not yet on migration 0019 rejects the write (no Origin or Asked in on Documents), so migration 0019 runs before the first publish on 0.9.1, as 0009 and 0010 did. `body` = the report body, rendered as other bodies; on `update`, sent only when B of `@content` ≠ S (a refresh), and then `properties` also has `"Refresh asked": { "type": "checkbox", "value": false }`. Render always sends the 0.6.0 name: a space not yet migrated (migration 0010, which renames Refresh to Refresh asked) rejects the write, so migration 0010 runs before the first publish on 0.6.0, as 0009 did for 0.5.0. When the number of `fixes` entries is above S's `@fixes`, `properties` has `"What to fix": { "type": "rich_text", "value": null }`, which clears the field, and `published` carries `@fixes` = that number. The skill sets each Ask row's own Brain Status to Done through the MCP; nothing else on it changes (its Report relation is Notion's side of Asked in).
- **Review** (proposals; property names from 0.5.0, 0045): Name = `title`, prefixed `Conflict: ` for `contradiction`, `supersede`, `merge` and `new_item`, and `Answer: ` for `answer`, unless the title already starts with it (0048: the Name says which of the three kinds of row it is; `review_notes` titles start with `From ` or `Deferred from `). Area = one page (0050): the area of the proposal's `source` note (a meeting's or source's own `area`, else the `area` of the first id in its `projects`), else empty, also when `source` isn't a note id. It is brain-owned and compared like any other property, so the first render after the upgrade sends it, and the prefixed Name, to every Review row still in Notion once; Kind; About = `<target title> (<target id>)`; About Page = the target's Notion URL if published; Now and Proposed (for `supersede`: old and new note title; `merge`: duplicate and survivor title; `add_to_note`: Proposed = `content`; `update_body`: Now empty, Proposed = the changed lines of the body as `- <old line>` and `+ <new line>`, in body order (§5.19's diff without context lines); `add_link`: Now empty, Proposed = one line per entry of `links` (or the old single `field`/`after`), `<Field>: <value>` with a note id rendered as its title, joined by `\n`, e.g. `People: Lucía Fernández\nPeople: Tomás Vidal\nAliases: acme site`; `new_item`: Proposed = the note's title and type; `answer`: Now empty, Proposed = `answer`, plus ` → <answer_note title>` when set; `review_notes`: see below), cut to 2000 characters; Why; Source Meeting = relation when `source` is a published meeting; State.
- **Review notes rows** (0041, 0043, 0045): About = `<source title> (<source id>)`, with `<source title>` as in the proposal title rule (§5.6), and About Page = that meeting's or Inbox row's URL if published. Now is empty. Proposed is one line per item, **lettered** in the order of schema §11.3: `a`, `b`, … `z`, then `aa`, `ab`, …:
  - every entry of `changes`, as stored: an `update_fact` as `<letter>) ⚠ <Field> on <target title>: <before> → <after>` (`a) ⚠ Launch date on Acme website: 2027-01 → 2027-02`; with no `before`, `(new) → <after>`); an `update_body` as `<letter>) ⚠ <target title>: <n> lines changed` (`b) ⚠ Acme website: requirements: 2 lines changed`); an `add_to_note` as `<letter>) Add to <target title>: <first line of content, cut to 80 characters>`;
  - every entry of `notes` as `<letter>) <Type>: <title>` (`c) Decision: Use Supabase for auth`);
  - every entry of `links` as `<letter>) <Field> on <target title>: <value>` (`e) People on Acme website: Lucía Fernández`), with a note id rendered as its title.

  `<Field>` is the key with `_` → space and the first letter capitalized. The letters are the ones you name in What to fix ("all except b, e", "a: March"); the skill maps them back to `exclude` and `fixes` entries in this order.
- **Suggestion rows (0072, [assistant.md](assistant.md) §6.3):** `notion_change` and `set_field`. Name = `title`, prefixed `Suggestion: ` unless it already starts with it; Kind = `Notion Change` or `Set Field`; Area = the proposal's `area` (empty when absent); Why; State; no Source Meeting (the property isn't sent). Property labels: `status` → `Status`, `due` → `Due`, `project` → `Project`, `area` → `Area`, `archived` → `Archived`; for `set_field`, `area` → `Area`, `domain` → `Domain`. Values are shown as: a string as it is; `null` as `none`; a date as stored; a boolean as `yes` or `no`; a list of page ids as the titles of the notes whose `notion` is each id (the id itself when no note has it), joined by `, `, `none` when empty; a note id as its title.
  - `notion_change`: About = `<page_title> (<target id>)`, or `<page_title> (task)` on `tasks`; About Page = `https://www.notion.so/<page with the dashes removed>`; Now = `<Label>: <value_before>`; Proposed = `<Label>: <value_after>`.
  - `set_field`: About = `<target title> (<target id>)`; About Page = the target's Notion URL if published; Now = `<Label>: <before>` (`none` when absent); Proposed = `<Label>: <after>`.
- **Restricted notes (0055, capture-and-review §5.1).** `sync plan` and `sync render` read every note other than a source or a proposal in its **eligible form**, the one the index uses: a note restricted whole has no summary, facts, timeline or body, and a partly restricted note loses its restricted statements, timeline entries and facts and its summary and aliases. A Review row whose proposal `source` is an older version or full copy of a changed input publishes no wording: its sections are stubs and its Now, Proposed and Why say it is held (the item can still be rejected, and an Accept closes it stale). So a note published before an exclusion changes its `@content` and baselines and is re-rendered without the excluded text at the next `sync render`, and a Notion value is compared with the same form. Damaged suppression records fail the command with `SUPPRESSIONS_UNREADABLE`.
- **Review page of a proposal with item ids (0055, capture-and-review §7.2 to §7.4, §7.10).** Only when `brain.json` `notion.review_sections` is `true` (the Decided property exists), and only for a row not yet published or one published with `@review`, a `review_notes` that has `items` renders a `body` **on create only**: a short first-use note, the brain-owned summary line, then one section per item in the order of `items` (changes, notes, links), each `## [<letter> · <it-id>] Creates: <title>` or `Changes: <target>`, with links to the target and the source, **Current** (a quote; absent for a creation), a toggle **Proposed final wording** holding the exact proposed text, *Why it matters*, *What Accept does* and the line `Decision: Pending`. The summary sits under a heading named `Review summary` (the skill finds it by name, like a project's "Brief" heading, and replaces its children). On an update `body` is `null` and only `sections["Review summary"]` (the summary line, rebuilt from `item_decisions`; a row decided the 0045 way, with no item decisions, counts every item as applied or closed) is sent, so applied and closed are never written into an item section. `published["@review"]` = `{ items: { <it-id>: { rendered_hash, proposed_hash, base_hash } } }` records what was rendered (sha256 hex of the section, of the proposed text, and of what it was proposed against) and is kept unchanged by later renders; `published["@content"]` is the hash of the summary. **Layout is not text.** The whitespace every non-empty line of a text shares (the indent Notion may give toggle children), trailing blanks and blank edges are removed before rendering and hashing, so an indented round trip is not an edit; a proposed text that is itself indented throughout loses that indent (a stated limit). **Free text cannot imitate the page.** Every free text put in a section (the proposed wording, the Current quote, the why) is escaped: a line that starts like a section heading (`## [`), a toggle tag (`<details`, `</details>`, `<summary`), `Decision:` or `Revision request:`, after any mix of blanks and backslashes, gets one more leading backslash, so `unescapeSection` (remove one leading backslash from such a line) restores the text exactly; the why is flattened to one line. **Hashes:** `proposed_hash` is the sha256 hex of the *canonical* proposed text (LF endings, NFC, no trailing blanks on a line, no blank lines at either edge) after unescaping, which is the text a parser reads back from the toggle's children; `base_hash` is the sha256 hex of `{"v": <value>}` (an update_fact's `before`, null when absent; the target body's `bodyHash`; the sorted values of a link's list field) or of `{"missing": true}` when the target note does not exist, so a missing target is never equal to an empty one. **Restricted text:** every note is read in its eligible form (capture-and-review §5.1); an item that rests on excluded evidence (§5.14.3), or whose target holds restricted text, is **held**: its section is a stub (`Held: <title>`, no wording, no Current, no why), it cannot be accepted (an Accept closes the first kind and waits on the second, §5.14.3), and `published["@review"].items.<id>.held` is true. A damaged suppression record fails the render with `SUPPRESSIONS_UNREADABLE`. `@review` is recorded only by the render that writes the body. **Writing the body (0068):** the skill creates the row with its `properties`, then writes `body` (the summary under `Review summary` included) once, with Notion's markdown endpoint, to that page while it is still empty, so each `<details>` becomes a real toggle block. On an `update`, the `Review summary` section and the `item_updates` sections are written through the block API, like every other section. If the markdown write fails, the skill moves the new page to the trash and records nothing for it, so the next render creates the row again (`@review` is recorded only with a written body). Read back as Notion returns it (toggle children indented), the body gives each item its rendered `proposed_hash`. A proposal without `items` (written before 0.8.0) renders as before (the lettered Proposed property, no body). With `--plan`, a row named in the plan's `review_pending` is withheld whole and listed in `skipped` with reason `REVIEW_PENDING`.
- **Leaving Review (0045):** a proposal with `notion` whose `status` is `applied` or `closed`, and whose `decision.decided_at` (else `updated`) is more than 30 days before `--now`, renders as an item with `action: "trash"`, `page_id` = its `notion`, empty `properties`, `body` and `sections` `null`, and `published` = `{ "@trashed": <--now> }`. The skill moves that page to Notion's trash through the MCP, then records it. A proposal whose `notion_published` has `@trashed` is never rendered again, with `--changed` or `--ids`. The proposal file stays in Git with its `notion` id.
- References to notes not yet published are left out of `properties` and listed in `pending_relations` (`[{ "property": "Org", "ids": ["org-…"] }]`). The skill publishes those notes first, records them, and renders again. A note that stays unpublished (0071: a decision, question, concept or Document not reviewed yet) is left out of `properties` the same way but **not** listed, since no render publishes it: the relation waits in the brain (an Inbox row's Decisions, Questions, Concepts and Documents, a meeting's Decisions and Questions, a decision's Supersedes) and fills at the render after the note is approved, because B then differs from S. A page whose only news is a relation to a note this same render creates (an item with `action: create`) is still returned, with empty `properties` (no Last Synced) and its `pending_relations`: the skill writes nothing for it and doesn't record it, publishes those notes, records them and renders again, so approving a decision in Review fills its meeting's Decisions in the same run.
- **Draft pages from before 0.9.1 (0071, migration 0020).** `--unpublish-drafts` (alone: with `--changed`, `--ids` or `--plan` → `USAGE`) selects every decision, question, concept and reference that has `notion`, has no `@trashed` in `notion_published`, whose `lifecycle` is `draft` and that a `pending` `review_notes` proposal lists in its `notes` (so its Review row can bring it back), except a `promoted` Document (its page is yours, 0049), with its module on. A draft no pending Review row lists (a workflow decision written before 0.9.1, a Lifecycle you set to Draft by hand) keeps its page. Each renders as `action: "trash"` with `page_id` = its `notion`, empty `properties`, `body` and `sections` `null`, and `published` = `{ "@trashed": <--now> }`, as a Review row leaving Notion does. The skill lists them and asks once; after a yes it moves each page to Notion's trash through the MCP and records it; `sync record` then removes the note's page (§5.14.6), so approving it later creates a fresh page through `--changed`, and the relations other pages held to it are sent again without it. `--changed` never selects such a page for trash: the cleanup runs only when asked.

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

- `action`: `create` when the note has no `notion`, else `update`; `trash` for a Review row leaving Notion (above). Meetings are always `update`; a meeting without `notion` → item error `MEETING_NOT_PUBLISHED`. A project `create` (0068) also carries `"template": { "type": "default" }`: its page comes from the Projects data source's default template (the "Brief" and "Decision log" toggle headings, the linked views and "My notes"), so the skill creates it with that template and `properties` (Brain ID among them, so the next `sync plan` links the page), and no children, then writes `sections` once the template's content is on the page. Render can't see the space's templates, so every project `create` carries it, with `--changed` or `--ids`; no other item has a `template` key, and `sync record` takes only `published`. Status is not sent (it is yours, 0021): the page has the Status the template sets, else none. The skill's side:
  - **Waiting for the template.** Notion applies the template after the create returns. The skill re-reads the page's blocks a few times, over about 30 seconds, until the "Brief" and "Decision log" toggle headings are there. On a page created from the template in this run, it never appends toggles (the rule under **Page content** is for pages created without one): if they don't appear, or a section write fails, it records the page with `"@content": null` (§5.14.6: a null `@` key removes that baseline), so the page is linked and the next render sends `sections` as an `update`.
  - **No default template** in the space: the skill creates nothing for the project, records nothing for it, and reports it; the user creates it with **New project** in Notion, the note's id in its Brain ID, so the next `sync plan` links the two (0021). Notes that relate to it keep it in `pending_relations` and are written without that relation this run; the skill doesn't render again for it. Before 0.9.0 render refused a project without `notion` with item error `PROJECT_NOT_IN_NOTION`; 0068 retires it.
- `published`: B for every rendered property except Last Synced and pending relations, plus `@content` = `sha256:<hex>` of the rendered `body`/`sections` when the type has content (for a source, of `body` only; its Full text is tracked by `@full_text`). This is the new S once the write succeeds.
- **Page content** (decision 0026): the brain writes only what it owns.
  - `body` (decisions, questions, references): replaces the whole page body (a `promoted` reference: on create only).
  - `sections` (projects): `{ "Brief": <the brief's generated block>, "Decision log": <the decision log's generated block> }`. The skill replaces only the children of the toggle heading with that exact name. `render` can't see Notion page content, so finding the toggle is the skill's job, after it reads the page through the MCP (0033): a page with **no toggle headings at all** gets the missing "Brief" and "Decision log" toggles appended and filled; a page just created from the template (0068) gets them from the template, applied after the create returns, so the skill waits for them before it applies this rule; a page with other toggle headings but not the named one is reported as `SECTION_NOT_FOUND` and left as it is.
  - `sections` (areas, 0041): `{ "Brief": … }`, as above.
  - `body` (sources other than captures, 0043; reports): as above. No `sections` on a source: Full text is retired (0049).
  - Goals, people, orgs, meetings, captures and proposals: `body` and `sections` are both `null`.
  - Rendering: `^[inferred]` → ` (AI inference)`, `^[ambiguous]` → ` (ambiguous)`, and relative links to published notes become `https://www.notion.so/<page id without dashes>` (unpublished → plain title text).

`data` = `{ "items": […], "errors": [ { "id": "…", "reason": "MEETING_NOT_PUBLISHED" } ], "skipped": [ { "id": "…", "reason": "ROW_CONFLICTED" | "FIX_WAITING" | "NOT_REVIEWED" | "WORDING_PENDING" | … } ] }` (`ROW_CONFLICTED` and `FIX_WAITING` only with `--skip-conflicted`; `NOT_REVIEWED` only with `--ids`; `WORDING_PENDING` only with `--plan`, and it holds only the body when the note's item is also in `items`, §5.14.7), items sorted by database (table order), then id. Exit 1 if `errors` is non-empty (the other items are still returned); `UNKNOWN_ID` for `--ids` is a whole-command error.

**Key Facts text** (projects, rendered here and parsed back by `sync plan`): one segment per `facts` key, sorted by key, joined by ` · `. Segment = `<Label>: <value>`; label = the key with `_` → space and the first letter uppercased; a person-id value renders as the person's title. Parse: split on ` · `, then on the first `: `; label → key by lowercasing and space → `_`; a person title (or alias) maps back to its id (ambiguous → conflict `AMBIGUOUS_PERSON`). Values containing ` · ` are not supported in v1. Example: `Budget: 80000 EUR · Launch date: 2027-02 · Owner: Maria López`.

#### 5.14.5 `brain sync tasks`

```text
brain sync tasks (--meeting <mtg-id> | --source <src-id> | --direct) --input <file|->
```

Renders Notion task payloads for a meeting's action items, or for the **owner's** action items in any other source (`--source`, 0037), or for tasks the user dictated in a live chat (`--direct`, 0072, below), using the `brain.json` Tasks mapping (0018, schema §12); writes nothing. Exactly one of `--meeting`, `--source` and `--direct` (`USAGE` otherwise).

Input: `{ "items": [ { "title": "Send Supabase migration plan", "owner": "Carlos Ruiz", "due": "2026-12-10", "projects": ["prj-9x4t1b7e"] } ] }` (`owner`, `due`, `projects` optional). An item may carry `"status": "waiting_on"` (capture-and-review §6): someone else's commitment that the user tracks. It needs `owner` (their name, `INPUT_INVALID` otherwise), takes the status `notion.tasks.waiting_on_status` (schema §12; default `Waiting On`) instead of `new_task_status`, and, unlike an owner Task from `--source`, sends the owner. Any other `status` is `INPUT_INVALID`. Without `waiting_on` the owner-only rule holds. For an extract input (0055) an item also carries `"item": "s1.i3"`, the id of the item that authorized it; it is echoed on the item's payload and must be an item of the extract's `selection` whose effective selection is `use` **and one of whose paragraphs the extract holds** (an item that depends on excluded context and was not imported creates no Task); `item` is required for a source that is an extract (`INPUT_INVALID` otherwise: an excluded item, or an item-less Task, creates no Task).

`projects` (dogfood finding 7): the projects this task is about, as project ids. Absent or empty → the meeting's `projects`. Errors, disjoint: an id with no note → `UNKNOWN_ID`; an entry that isn't a string, or an existing note that isn't a project → `INPUT_INVALID` with the pointer `/items/<n>/projects/<m>`.

Each item → `{ "database_id": "…", "properties": { "<mapped name>": {type, value} } }` with:
- title; due; status = `new_task_status`, typed as `notion.tasks.status_type` (`{ "type": "select", "value": "To Do" }` when absent or `select`, `"status"` when the mapping says `status`; schema §12, #113);
- project relation from the item's `projects`, else the meeting's; area relation from the meeting's `area` (each when published and mapped). A project not yet in Notion is left out and listed in the item's `pending_relations`, as in `render`;
- owner as `{ "type": "person_name", "value": "Carlos Ruiz" }`: the skill writes it as text, or resolves it to a Notion user when the mapped property is a people property;
- the backlink: the meeting relation (`meeting`), else the meeting's Notion URL (`meeting_url`);
- brain_id = the meeting id.

Unmapped (empty) properties are left out. After creating the tasks, the skill records their page ids with `sync record`.

**With `--source`** (a document, email, chat, note or capture; a `minutes` source → `INPUT_INVALID`, since its tasks belong to its meeting), the same rules apply with these differences:
- `projects`: absent or empty → no project (a source has no projects of its own). The skill passes the projects the action item is about, or the capture's Project (0037).
- area relation from the `area` of the item's projects (deduped), when published and mapped.
- the backlink: the `source` relation to the source's Inbox row, when mapped and the source has `notion` (else left out and listed in `pending_relations` as `{ "property": "source", "ids": ["src-…"] }`, so the skill publishes the Inbox row first). No `meeting` or `meeting_url`.
- brain_id = the source id.
- `owner` is left out: these tasks are yours.

**With `--direct`** (0072, [assistant.md](assistant.md) §7: a task the user said yes to in a live chat; there is no meeting or source), the same rules apply with these differences:
- an item may carry `area` (an existing `area-` id: `UNKNOWN_ID` when no note has it, `INPUT_INVALID` when the note isn't an Area); `item` is refused (`INPUT_INVALID`);
- `projects`: absent or empty → no project;
- area relation: the item's `area` when given, else the `area` of the item's projects (deduped), when published and mapped;
- no backlink (`meeting`, `meeting_url` and `source` are left out) and no `brain_id`;
- `owner` is left out, except on a `waiting_on` item: `"status": "waiting_on"` with `owner` (their name, as text) is accepted as for a meeting, and sends that owner and `waiting_on_status`;
- nothing is recorded afterwards: the task belongs to no note, so the skill doesn't call `sync record` for it.

Who the item is for and its due date are the skill's judgment: only action items addressed to the owner become tasks, and `due` only when the text gives one (0037). A to-do is never written as a question instead (capture-and-review §6.1, 0071); other people's commitments become a Task only as `waiting_on`, above.

**No dedupe here, for either form.** `sync tasks` renders exactly the items it is given, every time; it never compares them with the note's `tasks`. Tasks are created once, in the run that ingests the meeting or source: a second ingest of the same input is skipped as `DUPLICATE_SOURCE` (§5.5) before any action item is extracted, so there is no rerun to dedupe. Within that run, the skill creates each rendered item once and records the page ids it created (§5.14.6); an item held back by `pending_relations` is rendered again with only the held-back items, as above. The note's `tasks` is a record of page ids (appended, deduped by id), not a dedupe key.

With Tasks off (schema §12, 0048), the command refuses with `MODULE_OFF` before reading its input.

Errors: `MODULE_OFF`, `UNKNOWN_ID` (the meeting or source, or an item's project id), `INPUT_INVALID` (an item's `projects` entry that isn't a string or isn't a project; `--source` naming a `minutes` source or a note that isn't a source), `BRAIN_CONFIG_INVALID` (no Tasks database, or `brain.json` fails its schema, which requires a title mapping and a backlink mapping once a Tasks database is set).

#### 5.14.6 `brain sync record`

```text
brain sync record --input <file|->
```

Stores what the skill published. Input: `{ "records": [ { "id": "per-3h8w2n6c", "notion": "6a7b…", "synced_at": "2026-12-05T09:01:10Z", "published": { … }, "tasks": ["…"] } ] }`.

- `notion`: set if absent; if present and different → item `failed`, `NOTION_ID_MISMATCH`.
- `published` (the render item's `published`): merged into `notion_published`, key by key. **A value of `null` on a key that starts with `@` removes that key** (0054; a `null` on an ordinary property is a real empty baseline and is kept, as in the `Summary: null` example of §5.14.2): after a body is published but its read-back failed, the skill records `"@notion_body": null`, so the old baseline of a previously published page is dropped and the next plan finds the page without a baseline (row 9) instead of comparing a new `@git_body` with an old `@notion_body`.
- `synced_at` → `last_synced` (knowledge notes and sources), the time of the last publish.
- `tasks` (meetings and sources): appended to the note's `tasks`, deduped, order kept.
- `task_items` (an extract source only, 0055): `{ "<item id>": "<Notion task page id>" }`, merged into the source's `task_items`. Validation (a failed record, `reason`): the record's id must be an extract source (`extract: true`) and every key an item id of its `selection`, and every value in the record's `tasks` or already in the source's `tasks`, otherwise `INVALID_RESULT`; an item id already mapped to a **different** page is refused with `TASK_ITEM_EXISTS` and nothing is replaced. The skill sends one record for the meeting (its `tasks`) and one for the extract source (`tasks` and `task_items`) when a meeting was ingested from an extract.
- A source record changes only these system fields (schema §4: its body and content fields stay as captured). `@full_text` is merged like any other key.
- A report record (0043) sets the view's `notion`, `last_synced` and `notion_published`; nothing else. It is the only write to a report besides `report new` and `report fix` (§5.18).
- A trash record (0045) is a proposal record whose `published` is `{ "@trashed": … }`: it is merged into `notion_published` like any other, so the row is never rendered again.
- A trash record of a decision, question, concept or reference (`--unpublish-drafts`, 0071) is one whose `published` has `@trashed` and whose `notion` equals the note's: it **removes** the note's `notion`, `notion_published` and `last_synced`, so the note has no page again (a Draft until approved, then created as a new page). A `notion` that differs → `failed`, `NOTION_ID_MISMATCH`, and nothing changes. Restoring the page from Notion's trash links it again at the next `sync plan` (§5.14.2: a note with no `notion` gets the row's page id).
- Does not change `updated`; does not log (the skill logs `publish`).

`data` = `{ "records": [ { "id": "…", "result": "recorded"|"failed", "reason"?: "…", "changed": ["…"] } ] }`. Exit 1 if any failed.


> **0.8.0 (decision 0055):** the plan items for selected captures, exclusion cleanup and per-item Review decisions are specified in [capture-and-review.md](capture-and-review.md) §4, §5 and §7 and added here by CC-78 and CC-79.

#### 5.14.7 Accepted wording from Notion (0054)

Brain Assistant can write a Document's or a report's body inside Notion (buttons *Write up* and *Refresh report*, both on Documents since 0.9.1, 0071). Only wording the user **accepted exactly** comes back to Git; this section is the whole mechanism. The Notion side (the controls and their names) is in docs/notion-space-design.md §3.17; here is what the CLI reads and does.

A Report row (§5.14.1) whose Brain ID names a report published as **another** page is a conflict `NOTION_ID_MISMATCH` (§5.14.2) and plans nothing, wording included. **Which rows the skill snapshots.** In addition to §5.14.1's selection, the skill enumerates the candidates **from Git, then queries Notion once**: the candidates are listed from the brain index (§5.8: `notes` of type `reference`, and of type `view` with `fields.view_kind` `report`) and **each candidate's file is then read** at its `path`, because the index carries neither `origin` nor `last_synced`: a reference is a candidate when its frontmatter has `origin: promoted` or `origin: workflow` (with Documents on; connected-workflows.md §6.3), a report when Reports is on; `since` and the baseline S come from the same frontmatter (`last_synced`, `notion_published`). A key absent in the file is a missing baseline. Let **since** = the earliest `last_synced` among the candidates, **minus 2 minutes** (Notion rounds edit times down to the minute, so a draft written seconds after a publish can carry an edit time earlier than `last_synced`); if any candidate has no `last_synced` **or no `@notion_body` or `@git_body` in `notion_published`** (never published, or a baseline lost), there is no `since`: the query then returns every existing Notion row that matches the other conditions, so a row with a lost baseline is **eligible for the table** below (a never-published candidate has no Notion row to return). The table is first-match: row 9 handles a missing S only when no earlier row matched and N ≠ G. The skill queries the Documents database (reports included since 0.9.1; in a space not yet on migration 0019, also the Inbox rows of Kind Report) for rows where **Accepted** is ticked **or** the page's last edit is at or after `since` (no filter at all when there is no `since`), **following `next_cursor` until the query is exhausted** (a page of results is never taken as the whole), and keeps those whose Brain ID is a candidate. The filter is deliberately wide: a row read without need is harmless, because the comparison below decides per note; a row never read could hide a pending draft. A candidate the query did not return is not in the snapshot, which means its page was not edited since `since` **or only had text deleted** (a deletion does not move the edit time, T4, decision 0062): it holds nothing to import, and the render guard below protects a draft that only lost text. A snapshot row that carries these fields has them in a `wording` object on the row (`{ database, page_id, last_edited, properties, wording }`; `wording` is the only new row key):

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

**Blocks to Markdown (normative, for `body_markdown`).** Paragraph → the text; heading 1/2/3 → `#`/`##`/`###`; bulleted and numbered list items → `- ` / `1. ` (nesting by two spaces); to-do → `- [ ]`/`- [x]`; quote → `> `; callout → `> ` plus its icon and text on one line; toggle → a `<details><summary>…</summary>` block with its children; code → a fenced block with its language; divider → `---`; link → `[text](url)`; bold, italic, strikethrough and inline code → `**`, `*`, `~~`, `` ` ``. Page and database mentions become `[title](notion-page:<page id>)`. A block the table doesn't name (embed, synced block, table, column) makes the row `UNCONVERTIBLE_BLOCK` (below): never guessed. Blocks are joined by one blank line; the result ends with one `\n`. The same text always gives the same Markdown, so the fingerprint is stable.

**Four hashes.** `sha256:<hex>` of UTF-8 text. For a row: **N** = the hash of `body_markdown` (Notion now); **G** = the hash of the note's body in Git now (the raw body, not what render would send), taking away only the one newline the file format puts before it: text that starts with blank lines keeps them, so an import round-trips. Two baselines in `notion_published` say what both sides held at the last sync: **SN** = `@notion_body`, the hash of the Markdown the skill **read back from the page right after the last publish or import**, and **SG** = `@git_body`, the hash of the Git body at that moment. They are two values because what Notion serves back is not byte-equal to what `render` sent (the block conversion differs from the rendering), so N could never equal a hash taken from the sent text. "Notion unchanged since the last sync" is N = SN; "Git unchanged" is G = SG. After every publish of a Document or report body, and after every import, the skill re-reads the page and records `@notion_body` through `sync record` (`published`); `render` puts `@git_body` in the item's `published`, and an import sets both (N = G then). A missing SN or SG is a missing baseline. (A promoted Document's body is sent once, on create, §5.14.4; a report's body is sent by render on a refresh.)

**Plan output.** `sync plan` gains four arrays:
- `accepted_wording`: `{ "page_id": "…", "kind": "document"|"report", "note": "ref-…"|"vw-…", "accepted_at": "…", "page_edited_at": "…", "fingerprint": "<N>", "markdown": "…", "base": "<SG>", "unattended_ok": true|false, "diff": { "added": 12, "removed": 3 } }`. `unattended_ok` is true when `as_of` − `accepted_at` is at least 2 minutes; `diff` is the count of lines added and removed compared with the Git body (a line diff, for the preview).
- `wording_waiting`: `{ "page_id": "…", "note": "…", "reason": "REVISION_PENDING"|"REFRESH_PENDING"|"EDITED_AFTER_ACCEPTANCE"|"GIT_CHANGED"|"UNCONVERTIBLE_BLOCK"|"INVALID_REPORT_SHAPE"|"ACCEPTANCE_UNDATED"|"NO_BASELINE"|"EMPTY_BODY", "accepted": true|false }`: rows that need the user (accepted but blocked, or a pending proposal). Named in the report; never also a conflict. `accepted` is the snapshot's Accepted box (on this and the next list), which render reads (below): only REVISION_PENDING and REFRESH_PENDING can be either (rows 4 and 5).
- `wording_held`: `{ "page_id": "…", "note": "…", "reason": "UNACCEPTED_DRAFT"|"UNCONVERTIBLE_BLOCK"|"NO_BASELINE", "accepted": false }`: rows that must not be overwritten and are **not** accepted. `UNACCEPTED_DRAFT` (row 11) and `UNCONVERTIBLE_BLOCK` (row 2) need nothing from the user: only render reads them (below), and they are not listed in Needs you. `NO_BASELINE` (row 9, a legacy or lost baseline) is the one the attended skill raises: it shows Notion's text and Git's as a full diff and asks which side to adopt. **Adopt Notion** is offered on `wording_waiting` `NO_BASELINE` (the page is **accepted**, so the snapshot has a real `accepted_at`): after the user confirms the diff in chat, the skill builds an `accepted_wording` item itself from that row (`accepted_at` and `page_edited_at` from the snapshot, `fingerprint` = N, `markdown`, `base` = the hash of the Git body now, `unattended_ok` false, `verified` from a fresh re-read of the page, as for any planned item) and passes it to `sync apply`, which imports it like any accepted wording, putting Notion's text in Git and recording both baselines. The user's confirmation in chat is the attended step; **no Notion click time is ever invented**. On an **unaccepted** row (`wording_held` `NO_BASELINE`, `accepted_at` null) Adopt Notion is not offered: the skill tells the user to click **Accept** (which sets the time; Accept write-up or Accept refresh before 0.9.1) and to catch up again, when the row is the accepted case above. **Adopt Git:** the brain never rewrites a Notion body (a promoted Document's body is create-only), so the skill shows the Git text for the user to paste into the page; no baseline is recorded, the hold stays, and the next plan finds N = G (row 8) and records the baselines then. Neither choice records a baseline without making the two sides equal.
- `review_pending`: `{ "proposal": "prp-…", "page_id": "…" }`: Review rows whose Notion page holds edits or decisions that must not be overwritten (0055, capture-and-review §7.10). `sync render --plan` withholds them (`REVIEW_PENDING`). Written by the Review planning of CC-79.
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

**`sync apply`.** After `corrections` and `decisions`, step 4 executes each verified `accepted_wording` item: the target's body becomes `markdown` **exactly** (byte for byte; a report's `generated_from` is recomputed from its links; for a Document `notion:<page_id>` is added to `sources` if missing (a report is a view, which declares no `sources`; its `notion` names the page); `updated` becomes today; no other field changes), `notion_published` gets `@notion_body` = `fingerprint`, `@git_body` = the hash of the new body, and `@content` = what `render` would compute for it (so the imported text is not sent back), and the log gets `sync-wording`. Preconditions are re-checked: if G is no longer `base` (SG), the item is `failed` `GIT_CHANGED` and nothing is written. The result is `applied`, `changed: ["body"]`. A `--record-only` run skips these items and reports them (0003). `--skip-conflicted` skips an item whose note is named by a conflict, and drops that row's `clear_accepted` entry, so nothing is unticked in Notion on a row skipped whole. A `clear_accepted` entry is also dropped when the note is gone or an `updates` item for that note failed: row 8 clears Accepted only after its baselines were recorded. An `accepted_wording` item must carry every field of the plan item and a `kind` that matches its note (a `report` item for a report, a `document` item for a promoted Document), else the item fails `KIND_MISMATCH` or the input is `INPUT_INVALID`. `data` gains `accepted_wording` (each item with `result` `applied`, `skipped` or `failed` and `changed`), and echoes `wording_waiting`, `wording_held` and `clear_accepted` for the skill. **After a successful import or an already-in-step or Git-only row (rows 8 and 12 with `accepted`), the skill unticks Accepted and clears Accepted at** through the MCP (the same pattern as the other request boxes, 0048): the acceptance was consumed, and a later edit of the body is an ordinary draft (row 11, or row 9 when S is missing), not a stale acceptance. Unattended runs (0051) execute verified `accepted_wording` as-is, since the plan holds only explicit, exact, current acceptance; every `wording_waiting` row is named in the report and left alone.

**`sync render --plan <plan>`.** The skill passes the same run's plan:
- a note named by any of `wording_waiting`, `wording_held` or `accepted_wording` is listed in `skipped` with reason `WORDING_PENDING`, which means **its body is held**: a publish never overwrites a pending draft, an unaccepted edit, a proposed revision or a proposed refresh (0054), nor sends a stale Git body over accepted wording that is not imported yet;
- **only the text waits** when every row naming the note is a `wording_waiting` or `wording_held` row with `accepted: false` (#221: a report moved by migration 0019 with no baseline, row 9, still needs its Origin, Project, Area and Asked in). Its `update` item stays in `items` with `body` and `sections` `null`, without `Refresh asked` (a queued refresh waits, below), and without `@content` and `@git_body` in `published`, so `sync record` keeps the body baselines as they were and the body is rendered once the hold is resolved. If nothing but Last Synced is left to write, no item is rendered (a relation still pending is sent by a later render, once its page exists). The skill writes the properties only: no body, so no read-back and no `@notion_body`;
- **the whole item is left out of `items`** (listed in `skipped` the same way) when the note is named by an `accepted_wording` item or by a row whose `accepted` is not `false` (accepted, or missing, as on a row the skill moved there, which fails closed), and when its item is a `create`. Any write to a page moves its edit time, and an Accepted page edited after its Accept time reads as a stale acceptance (row 6), so no write of any kind touches an accepted page until its wording is settled;
- a `promoted` Document's body is still sent on `create` only (§5.14.4); a report's body on `update` is sent only when B of `@content` ≠ S **and** no row above names it (a report with no baseline yet is row 9: held until the user adopts one);
- **Refresh report** (the button) never ticks *Refresh asked*; `refresh_requests` (the old queued full refresh) come only from that checkbox. The button therefore cannot set off a full refresh that would overwrite pending or accepted wording. **One rule for a queued full refresh:** if a `refresh_requests` item (or a refresh due by §6.1) and a `wording_waiting`, `wording_held` or `accepted_wording` row name the same report, **the refresh itself waits**: the skill does not run it, Refresh asked **stays ticked**, and the run names it ("Report X: resolve the Notion text first"). It runs at the first catch-up where no such row names the report. This holds attended and unattended.

**Related knowledge appendix (Documents).** After an `accepted_wording` import into a Document, the skill may search canonical knowledge and propose useful additions. This is an ordinary proposal (0003): `brain proposal new --kind add_to_note --target <ref-…>` with `content` = a `## Related knowledge` section, one list item per note, each `[title](path)` with the reason it helps, and `why` naming the Document. Approving it appends the section after the accepted wording by the `add_to_note` rule (schema §11.2), which leaves the accepted text unchanged; rejecting it changes nothing. The Document keeps being a note whose accepted body is Git's (schema §3, promoted bodies). A change to any other existing note is a separate proposal.

**Reports are derived outputs and not proposal targets (§11 refuses a view target; decision 0057).** A report's accepted text never becomes evidence for a new note. For useful knowledge that only Git has (not in the accepted refresh), the skill **names it to the user** in its report ("Not in the accepted refresh: …") and offers a full refresh; it makes no proposal on the report. A full refresh (Refresh asked, §5.18) rewrites the report in Git as before, but only when no `wording_waiting`, `wording_held` or `accepted_wording` row names that report (the rule above): then it waits, with Refresh asked still ticked. The user resolves the Notion text by accepting or discarding it, and the next run refreshes.

**Errors:** none new; `INPUT_INVALID` for a snapshot row whose `accepted_at` or `page_edited_at` is not an ISO time, or for an `accepted_wording` item without `verified` fields in `sync apply` input (`UNVERIFIED` per item). A null `accepted_at` is valid input: with `accepted` true it is row 3, not an error.

### 5.15 `brain upgrade`

```text
brain upgrade [--dry-run]
```

Brings the product-owned files of an existing brain up to the installed version of the package (dogfood finding 22), then commits and pushes them (0038). It never touches notes, generated files, anything the user wrote, or the log beyond appending its own `upgrade` line (step 6), and changes `brain.json` only to rename or remove a retired key and to write the `modules` block (step 5). The one exception is step 5a: it converts concept notes into learned Documents (0071), rewrites the links to them and rebuilds `index.md`.

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
- **Clean brain.** If the brain is a Git repository and `git status --porcelain` prints anything, refuse with `BRAIN_DIRTY`. `--dry-run` skips this check and reports `dirty: true` instead.
- The safety checks below.
- **The skill pin** (0059, skills-delivery §6.3), after the checks above and in this order; `--dry-run` refuses the same way. Upgrade is exempt from the pin guard (§5.28): it is the repair path, whatever the brain's state.
  1. The package snapshot must be compatible with the running CLI, else `SKILLS_SNAPSHOT_INVALID`.
  2. An `invalid` lock will be replaced, with warning `SKILLS_LOCK_REPLACED`; `from` is then `null`, as for `unpinned`. Otherwise `from` is the lock's `{ name, version }`.
  3. Same snapshot `name` and the lock's version of higher precedence → `SKILLS_DOWNGRADE`.
  4. Same `name` and `version` but manifests not deep-equal → `SKILLS_SNAPSHOT_INVALID`, reason `same version, different content`.
  5. Another `name` (`ultimate-brain` → `ultimate-brain-skills`) is an ordinary upgrade.

**Writes:**
1. **`AGENTS.md` rules block.** Replace everything from the line `<!-- ultimate-brain:rules:start … -->` through `<!-- ultimate-brain:rules:end -->` with the same block from `templates/brain/AGENTS.md`. Text outside the markers is kept byte for byte.
   - `AGENTS.md` missing → written from the template (`created`).
   - Markers missing, out of order or duplicated → the file is left alone (`skipped`) with warning `AGENTS_BLOCK_NOT_FOUND`; the user restores the markers or merges by hand.
2. **`CLAUDE.md`:** written as `@AGENTS.md` only if missing. One that exists in any form (a file, or a link to `AGENTS.md`) is left alone.
2a. **The sub-agent (0.10.0, [assistant.md](assistant.md) §10).** `.claude/agents/ultimate-assistant.md` is written from `templates/brain/.claude/agents/ultimate-assistant.md` (creating `.claude/agents/` when needed) when it is missing (`created`) or its bytes differ (`updated`): the whole file is product-owned. A path that is a symbolic link or a folder is `OUTSIDE_ROOT` before any write. Other files in `.claude/agents/` are the user's and are left alone.
3. **Skills (0029, 0038, 0059).** For each skill of the package snapshot, in **both** `.agents/skills/<name>/` (Codex) and `.claude/skills/<name>/` (Claude Code):
   - write every listed file whose content differs (`created` or `updated`);
   - remove every other file inside that skill's folder (`removed`), then its emptied folders.

   **Retired skills:** a skill the old, valid lock names and the new snapshot doesn't has its folder removed from both trees: every file in it is `removed`, the user's included, and the emptied folder goes too. Without a valid old lock, folders the snapshot doesn't name are the user's own and are left alone.

   3a. **`skills.lock.json`** (skills-delivery §3) is written when the lock is `unpinned` or `invalid`, or names another snapshot `name` or `version`; it gets `installed_by` = the running version and is listed in `files` (`created`, or `updated`). Otherwise it stays as it is, keeping its `installed_by`.
4. **Retired plugin (0038).** If `.claude/settings.json` exists, remove the key `ultimate-brain@ultimate-brain` from `enabledPlugins` and the key `ultimate-brain` from `extraKnownMarketplaces`; an object left empty is removed. Other keys are kept in order, and the file is written as JSON with 2-space indent and a trailing newline (`updated`). A file left as `{}` is deleted (`removed`). A file that is not valid JSON is left alone (`skipped`) with warning `SETTINGS_UNPARSEABLE`. Nothing to remove → no change.
5. **Renamed `brain.json` keys (0037).** If `notion.databases` has `capture_inbox`: when `inbox` is absent or empty, rename the key to `inbox` in place (same position, same value, an empty `inbox` removed); when `inbox` already holds an id, just remove `capture_inbox`. Every other key and value is kept in order, and the file is written as JSON with 2-space indent and a trailing newline (`updated`). A `brain.json` that is not valid JSON is left alone (`skipped`) with warning `BRAIN_JSON_UNPARSEABLE`. No `capture_inbox` → no change. The same rule renames `references` to `documents` (0049). A `concepts` key is removed, whatever its value (0071: the Concepts database is retired; migration 0018 trashes it). Then, if `brain.json` has no `modules` block, it is added after `settings` (or after `budgets` when there is no `settings`) with every key `true` except Domains, so a brain made before 0.6.0 keeps its earlier modules on (schema §12, 0048). Finally, if `modules.reports` is `true` and `modules.documents` is not, `documents` is set to `true` (0071: reports are Documents rows; without it, Reports would count as off), with warning `DOCUMENTS_TURNED_ON`: `Reports now live in Documents, so the Documents module is on. Apply Notion migration 0019 before the next publish: {product.path}/notion/migrations/0019-reports-move-to-documents.md` (`{product.path}` as `brain status` reports it, §5.2).
5a. **Concepts become learned Documents (0.9.1, 0071).** For each note with `type: concept`, sorted by path:
   - **Frontmatter:** `type` becomes `reference`, `origin: learned` is added, and `notion`, `last_synced` and `notion_published` are removed, so the next `sync render` creates its page in Documents (the Concepts page is trashed by migration 0018). Every other key and value is kept in its place (`id`, `created`, `updated` and `lifecycle` included); `origin` goes where §3.6.5's order puts it, as for any edited file.
   - **Path:** `knowledge/references/<file name>`, the file name kept; when that path is taken (by a file or by an earlier conversion), `<slug>-2.md`, `-3`, … The old file is `removed`, the new one `created`; `knowledge/concepts/` and every folder under it left empty are removed (a folder still holding a file stays).
   - **Links:** in every Markdown note of the brain **except sources** (their bytes are hashed, schema §4) — views and proposals included — each relative link (`[x](t)`, `[x](t "title")`, `[x](<t>)`, `[x]: t`, as lint reads them, §5.10) whose target resolves to a moved file is rewritten to the new path, relative to the linking file's own (new) folder, keeping any `#anchor` or `?query`; a moved note's links to files that didn't move are rewritten the same way when their relative path changes. Nothing else in a body changes. Each rewritten file is `updated`.
   - **Links inside proposals (CC-136, dogfood #220).** A proposal's frontmatter holds note text too, and its links are relative to the folder of the note that text is written for (schema §14, the Review row). In every proposal, **whatever its `status`** (an applied one is a record, and Git keeps its earlier text), these strings are rewritten by the rule above, read from that note's old path and written for its new one:
     - `content`, a string `decision.value` and each string `decision.fixes[].value` without `change`: for `target`;
     - each `changes[i].content`, and a `decision.fixes[]` value with `change: i`: for `changes[i].target`;
     - each `revisions[].previous`: for the note its item names (the `items` entry with that `item_id`: `changes[ref].target` for a change, the note `ref` for a note);
     - `note.body` of a `new_item`: for the folder its note type is written to (§3.8; a project's, `projects/<slug>/`, from its title).
     A string whose note doesn't exist, or a `note.body` whose type has no folder, is left as written. Nothing else in the frontmatter changes, except:
     - **`before_hash` follows a rewritten body.** On a proposal not yet applied or closed (`pending`, `approved` or `edited`), a `before_hash` (top level on an `update_body`, or on an `update_body` item of `changes`) whose target's body this step rewrites, and that equals the hash of the old body, becomes the hash of the new one, so the link change alone never makes it stale. One that didn't match stays as it is (still stale). A Review page with items records its own base at render (`@review`, §5.14.4), so an Accept on such an item is skipped as `BASE_CHANGED` and the item is offered again with its new Current, as for any base change.
     - **A concept `new_item` becomes a learned Document.** On a `new_item` not yet applied or closed whose `note.type` is `concept`, `note.type` becomes `reference` and `note.frontmatter.origin` becomes `learned` (`note new` refuses a concept, §5.5); its `note.body` is then read from `knowledge/concepts/` and written for `knowledge/references/`.
     The proposal file is written as any edited file (§3.6.5) and `updated`.
   - **Links a brain already converted missed (CC-136).** A brain upgraded to 0.9.1 before this rule kept dead links to `knowledge/concepts/` inside its proposals, and a note written later by the old skills can link a converted concept too. The paths moved then are not recorded, so for each link the rules above read (bodies and proposal strings alike) whose target is a file under `knowledge/concepts/` that doesn't exist and isn't converted in this run, the destination is found by its file name `<name>.md`: the learned Document whose `id` starts with `con-` at `knowledge/references/<name>.md`, else the only one at `knowledge/references/<name>-<n>.md` (`n` ≥ 2). That link is rewritten as if its target had moved there. With no such Document, or several at `-<n>`, the link is left as written, with one warning `CONCEPT_LINK_UNRESOLVED` per file naming the file and its links; the user fixes them by hand. So running the upgrade again on a converted brain repairs what the 0.9.1 conversion missed, and on a brain with nothing left to repair it changes nothing.
   - **`index.md`** is rebuilt (`brain index`, schema §13) when a note is converted, and `updated` when its bytes change.
   - `data.converted` lists `{ "id", "from", "to" }` per converted note, sorted by `from` (empty when there is none). Converting and repairing nothing changes nothing, so a second upgrade reports `converted: []` and no file. A brain still on the old skills keeps working: a concept it writes later is reported by `concept-retired` and converted by the next upgrade.
   - Safety as for the other writes: a moved, rewritten or created path that is a symbolic link, or a file where a folder belongs, is `OUTSIDE_ROOT` before any write.
6. Log `- <timestamp> upgrade - "<package version>" files=<n>` when anything changed. `--dry-run` writes and logs nothing and reports the same `files`.
7. **Lint** the brain (§5.10) and report the counts in `lint`; it reads the new lock. Lint findings never stop the upgrade: it only wrote product-owned files. With `--dry-run`, lint reads the **planned** tree: every `created`, `updated` or `removed` file as the upgrade would leave it, everything else (including `skipped` files) as it is on disk. So a dry run reports what would remain after the upgrade: `product-file` is silent for drift the upgrade repairs, and still reports an `AGENTS.md` left `skipped` for missing markers.
8. **Commit and push**, when anything changed and the brain is a Git repository: stage exactly the paths in `files` whose `action` is `created`, `updated` or `removed`, plus the log file step 6 appended to (`log/<YYYY-MM>.md`). Never stage a `skipped` path or anything else in the working tree. Commit `upgrade: ultimate brain <version>, skills <snapshot name> <snapshot version>`, then `git push` if the current branch has an upstream. No upstream → warning `PUSH_SKIPPED`. A push that fails → warning `PUSH_FAILED` with Git's message; the commit stays, and the exit code is still 0. A failed commit (no identity) → warning `GIT_COMMIT_SKIPPED`, files kept. Not a Git repository → no commit, no warning.

The skills a linked repo or folder carries (§5.12) are refreshed by running `brain link` there again.

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
    "commit": "2c2d653",
    "pushed": true
  } }
```

`files` lists only the files created, updated, removed or skipped, sorted by path; `unchanged` counts the rest. `skills` (skills-delivery §6.3): `to` is the package snapshot; `retired` the retired skill names, sorted; `previous_cli` the old lock's `installed_by` when step 3a wrote over a valid lock, else `null`; `competing` per skills-delivery §5.2 for the package snapshot's skills, with warning `SKILLS_COMPETING` when non-empty (never a refusal). An immediate second upgrade with the same CLI reports `files: []`. `commit` is the short hash, or `null` when nothing was committed; `pushed` is `false` unless a push succeeded. `--dry-run` adds `dirty` and reports `commit: null`, `pushed: false`.

**Safety:** all checks run before the first write. `AGENTS.md`, `skills.lock.json`, `.agents`, `.agents/skills`, `.claude`, `.claude/skills`, `.claude/settings.json`, a snapshot or retired skill's folder, or any file in it that is a symbolic link, or a file where a folder belongs → `OUTSIDE_ROOT`, and nothing is written or removed. `brain link` checks its skill folders the same way (§5.12). If a write fails part way, the files already replaced or removed are restored and the created ones deleted (§3.6), the lock included, so the last working pin stays. Undoing an upgrade is a `git revert` of its commit plus the previous CLI (`previous_cli`; docs/releasing.md, skills-delivery §8).

Errors: `UNRELEASED_BUILD`, `BRAIN_DIRTY`, `OUTSIDE_ROOT`, `SKILLS_SNAPSHOT_INVALID`, `SKILLS_DOWNGRADE`, and the brain resolution errors (§4).

### 5.16 `brain repo` (linked repos, 0042)

```text
brain repo add <name> --path <path> --area <area-id> --pattern <glob> [--pattern <glob>]…
brain repo changes <name>
brain repo record <name> (--commit <sha> | --reset)
```

A linked repo is a read-only source: these commands read it with Git (`git -C <path> …`) and write only `brain.json` `repos` (schema §12). The skill reads each file's text with `git -C <path> show <commit>:<repo_path>` and ingests it as a document (brain-ingest).

**`repo add`** appends `{name, path, area, patterns, commit: ""}` to `repos`. `name` is lowercase kebab-case and unused (`INPUT_INVALID`); `area` must exist (`UNKNOWN_ID`); `path` is stored as given, and must resolve to the top of a Git working tree (`REPO_NOT_FOUND`) that is not the brain (`REPO_IS_BRAIN`, compared after resolving symbolic links). At least one `--pattern`; each is a Git glob pathspec relative to the repo root. `brain.json` is written as JSON with 2-space indent and a trailing newline. Logs `repo-add - "<name>"`.

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

The CLI writes a `view` with `view_kind: report`, `generated_at` = now and `generated_from` = the ids of the notes the body links to (relative links from `reports/`, sorted), at `reports/<date>-<slug of title>.md`. `INPUT_INVALID` when the body's `##` sections aren't exactly the six of §16.4 in order, or a link doesn't resolve to a note; `UNKNOWN_ID` for `projects` or `area`. Logs `report-new <id> "<title>"`. `data` = `{ "id": "vw-…", "path": "reports/…", "generated_from": ["…"] }`.

**Refresh (0045):** the input names `"refresh": "vw-…"`, a report. The CLI rewrites that file in place: the new `body`, `generated_at` = now, `generated_from` from the new body, and, when given, the new `title`, `projects` and `area`; `question`, `notion` and the path stay. An `asked_in` in the input is appended to the report's `asked_in` (stored as a list once there are two). `INPUT_INVALID` when `refresh` isn't a report. Logs `report-refresh <id> "<title>"`. The next render publishes the new body and clears the row's Refresh box (§5.14.4).

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

Lists or switches the optional modules of schema §12: `domains`, `knowledge`, `orgs`, `documents`, `reports`, `tasks`, `planning`. Core has no switch.

**`brain modules`** writes nothing:
```json
{ "data": { "modules": [
    { "name": "knowledge", "on": true, "default": true, "databases": ["decisions", "questions"], "missing": [] },
    { "name": "documents", "on": false, "default": false, "databases": ["documents"], "missing": ["documents"] },
    { "name": "reports", "on": false, "default": false, "databases": ["documents"], "missing": ["documents"] },
    { "name": "tasks", "on": false, "default": false, "databases": [], "missing": ["tasks"] }
] } }
```
One item per module, in the order above. `on` follows schema §12 (all `true` except Domains when the block is absent). `databases` lists the module's `notion.databases` keys; `missing` lists those whose id is empty, and `tasks` when `notion.tasks.database` is empty. So the skill knows which Notion steps a module still needs before it can work.

**`on` / `off`** set `modules.<module>` to `true` or `false` in `brain.json`. When the block is absent it is written first with every key `true` except Domains (as `brain upgrade` does), then the switch is applied. `brain.json` is validated and written as JSON with 2-space indent and a trailing newline. Nothing else changes: no note, no Notion page, no database id. Switching a module to the state it is already in writes nothing (`changed: false`). Logs `modules - "<module>" state=on|off` when it changes. `data` = `{ "module": "documents", "on": true, "changed": true, "missing": ["documents"] }`.

**Reports needs Documents (0071).** A report is a Documents row, so `on reports` also sets `documents` to `true`, and `off documents` also sets `reports` to `false`; the other two switches (`on documents`, `off reports`) touch only their own key. `data` then adds `"also": [{ "module": "documents", "on": true }]` (or `reports`, `false`), absent when nothing else changed; `changed` is true when either key changed, `missing` is the named module's, and each changed key logs its own `modules` line. In the list, `reports` lists `documents` in `databases` (and in `missing` while its id is empty), and a `brain.json` that still has `reports: true` with `documents: false` (written by hand, or before 0.9.1 and not yet upgraded) shows `reports` as `on: false`: Reports counts as off until Documents is on (schema §12).

Turning a module on in Notion is the skill's job, with the user: it follows the module's steps in `notion/modules/<module>.md` (Notion AI prompts for its databases, buttons and layouts by hand, then `config set` for each id), and the next catch-up uses the module. Turning one off deletes nothing (schema §12).

Errors: `USAGE` (an unknown module, `core`, or `on`/`off` without one).

### 5.21 `brain schedule` (0051)

```text
brain schedule install <job> --at <HH:MM>[,<HH:MM>…] --model <id> [--days <day>[,<day>…]] [--dry-run]
brain schedule list
brain schedule remove <job>
```

Runs a skill on a schedule, with nobody there, through local Claude Code (`claude -p`), the one scheduler that sees every input: the drop folder, linked repos and the user's Notion MCP (0051). It writes the machine's scheduler entry and nothing in the brain: no file, no log line, no commit. The skill's "Run on a schedule" section calls it and writes the settings (brain-catch-up). Reflection has no job in 0.11.0 (0076 §5): it runs attended only, and its weekly run is 0.15.0's brief (CC-111, 0075; moved by 0077 and 0078), which adds its own job then.

**Jobs.** Each job runs one fixed prompt in the brain folder, so the schedule starts the skill the same way every time:

| `<job>` | Prompt | Needs |
|---|---|---|
| `catch-up` | `catch up unattended` | brain-catch-up |

**Options.**
- `--at`: one or more local times, 24-hour `HH:MM`, comma-separated, kept sorted and without repeats (`07:00,13:00`). Required.
- `--days`: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`, comma-separated. Absent: every day.
- `--model`: the Claude model the run pins (0051: the skills are tested on Claude models only), a full id starting with `claude-` (`claude-sonnet-5-5`), never an alias that moves (`sonnet`). Required; anything else → `USAGE`.
- `--dry-run`: returns what `install` would write, and writes nothing.

**The command it schedules.** `<claude> -p "<prompt>" --model <id>`, run in the brain folder (the resolved brain, §4). `<claude>` is the absolute path of `claude` found on `PATH` at install time (none → `CLAUDE_NOT_FOUND`), because a scheduler's `PATH` is short. `PATH` for the run is the folders of `claude`, `node` and `brain` at install time, then `/usr/bin:/bin:/usr/sbin:/sbin`. No permission flag is added: the run has the tools the brain's own Claude Code settings allow (`.claude/settings.json` in the brain), and a tool they don't allow is refused, which the run logs as a failure. The skill offers the allow list when it sets the schedule (CC-64).

**The label** names the entry for this brain and job: `eu.ultimate-brain.<folder>-<hash>.<job>`, where `<folder>` is the brain folder's name as a slug (§3.8) and `<hash>` the first 8 hex characters of the SHA-256 of its absolute path, so two brains never share an entry.

**On macOS** (`process.platform` = `darwin`), `install` writes a launchd agent at `<agents>/<label>.plist`, where `<agents>` is `~/Library/LaunchAgents`, or `UB_LAUNCH_AGENTS_DIR` when set (tests):
- `Label`; `ProgramArguments` = `[<claude>, "-p", <prompt>, "--model", <id>]`; `WorkingDirectory` = the brain; `EnvironmentVariables` = `{ "PATH": … }`; `StartCalendarInterval` = one `{ Hour, Minute }` per time, or, with `--days`, one `{ Hour, Minute, Weekday }` per time and day (`Weekday` 0 = Sunday … 6 = Saturday), in the order times, then days; `StandardOutPath` and `StandardErrorPath` = `~/Library/Logs/ultimate-brain/<label>.log` (its folder created); `RunAtLoad` = false.
- A `ultimate-brain` key in the plist holds `{ "brain", "job", "times", "days", "model", "prompt" }` as a JSON string, which `list` reads back.
- It then loads the agent: `launchctl bootout gui/<uid>/<label>` (its failure ignored: nothing was loaded), then `launchctl bootstrap gui/<uid> <plist>`. With `UB_LAUNCH_AGENTS_DIR` set, `launchctl` is never called. A failed `bootstrap` leaves the file and warns `SCHEDULE_NOT_LOADED` with launchctl's message.
- A second `install` for the same brain and job replaces the file (`replaced: true`).

`remove` unloads (`launchctl bootout`, failure ignored; never with `UB_LAUNCH_AGENTS_DIR`) and deletes the file; when there is none, it does nothing (`removed: false`), exit 0. `list` returns this brain's entries: each `<agents>/eu.ultimate-brain.<folder>-<hash>.*.plist`, sorted by job.

**Elsewhere** (`UB_SCHEDULE_PLATFORM` overrides `process.platform` in tests), `install` writes nothing and returns one cron line per time (with `--days`, the days in cron's numbering on the same line), for the user to add with `crontab -e`:

```text
0 7 * * * mkdir -p "$HOME/.ultimate-brain/logs" && cd '/Users/alex/brain' && PATH='…' '/usr/local/bin/claude' -p 'catch up unattended' --model claude-sonnet-5-5 >> "$HOME/.ultimate-brain/logs/eu.ultimate-brain.brain-3f9a2c1d.catch-up.log" 2>&1
```

The line creates its log folder first, so it runs on a machine where it doesn't exist yet. Paths are single-quoted, with `'` written as `'\''`. `list` and `remove` manage no cron lines: they return `[]` and `removed: false` with the warning `SCHEDULE_NOT_MANAGED` ("cron lines are yours: crontab -l").

```sh
brain schedule install catch-up --at 07:00,13:00 --days mon,tue,wed,thu,fri --model claude-sonnet-5-5 --json
```
```json
{ "data": {
    "job": "catch-up", "label": "eu.ultimate-brain.brain-3f9a2c1d.catch-up", "platform": "darwin",
    "path": "/Users/alex/Library/LaunchAgents/eu.ultimate-brain.brain-3f9a2c1d.catch-up.plist",
    "times": ["07:00", "13:00"], "days": ["mon", "tue", "wed", "thu", "fri"], "model": "claude-sonnet-5-5",
    "prompt": "catch up unattended", "command": ["/usr/local/bin/claude", "-p", "catch up unattended", "--model", "claude-sonnet-5-5"],
    "written": true, "replaced": false, "loaded": true, "cron": null, "dry_run": false
} }
```

Elsewhere `path` is `null`, `written` and `loaded` are `false`, and `cron` is the list of lines. `list` → `{ "schedules": [ { "job", "label", "path", "times", "days", "model", "prompt" } ] }` (`days` `null` for every day). `remove` → `{ "job", "label", "path", "removed" }`.

`<claude>` is made absolute when `PATH` names a relative folder, and so is each folder of the scheduled `PATH`, since launchd and cron run from elsewhere.

Errors: `USAGE` (unknown job, a time that isn't `HH:MM` from 00:00 to 23:59, an unknown day, a missing or moving `--model`), `CLAUDE_NOT_FOUND`, `SKILL_MISSING`, `OUTSIDE_ROOT` (a plist path that is a symbolic link, or a plist or log folder that resolves inside the brain, symbolic links followed: a schedule writes nothing there).

---


### 5.22 `brain source extract-plan` (0055, 0062)

```text
brain source extract-plan --page <notion-page-id> --summary <file> --transcript <file> [--previous <src-id>] [--json]
```

Read-only; writes nothing. Reads a summary (the subjects, tokens and items of capture-and-review §4.1; `\r\n` is read as `\n`) and the transcript of the input named by `--page` (the Notion page id; `--previous` is validated against it, and the sources of that page are looked up for `PREVIOUS_REQUIRED`), and computes the extract of capture-and-review §4.2 to §4.7 without AI: anchors are mapped to numbered paragraphs by exact substring match after whitespace normalization, effective selections are resolved, and the fail-closed copy rule decides which paragraphs enter. The extract is **not** written with `note new`: `brain source extract` (§5.23) writes it, its suppression record and the regenerated views in one journaled operation.

`data` = `{ ok, write_required, transcript_hash, selection: [{id, effective, explicit}], problems: [{code, id, reason, with?}], passages: [{n, hash, items}], copied: [{n, text, items}], unnumbered: [{subject, text}], uncovered, quotes: [{item, anchor, result, stretches?, reason}], unplaced_items: [<item id>], quick: [{subject, id, text, done}], scopes: [{item, done_when, due, project, notes, problems}], body, previous? }`. `ok` is false when any problem other than `DEPENDS_ON_EXCLUDED` exists (`SELECTION_UNREADABLE`, `SELECTION_UNMAPPABLE`, `UNNUMBERED_LINE`); then `body` is `null` and **nothing may be written**, never a full-transcript fallback. Every list line without an id outside a Quick follow-ups group is both in `unnumbered` and a problem `UNNUMBERED_LINE`, because it can neither be selected nor excluded and could leak through a shared paragraph (capture-and-review §4.2). `copied` holds the full text of each paragraph for the attended preview. **Decision 0067** adds four lists that never make `ok` false: `quotes`, an included item's anchors placed by a stretch (`result: "shortened"`, with `stretches`) or not placed (`result: "unplaced"`, with the reason; an included item with no quote is listed once with `anchor: null`), and `unplaced_items`, the included items with no placed anchor, which are not imported (capture-and-review §4.2 rules 2 and 3; an excluded item's anchor still blocks, rule 4); `quick`, the quick follow-up lines (`id` null unless the line carried one; `done` true for a ticked to-do), never imported (one with an id whose effective selection is `meeting only` is also an excluded item of `selection`, fail closed); `scopes`, each Scope toggle's fields (`due` a `YYYY-MM-DD` or null; absent fields null; `item` null for a Scope with no item line above it) and its `problems` as plain sentences (capture-and-review §4.1). Other quick lines are not items of the plan.

With `--previous <src-id>`, `previous` = `{ id, kind, version, transcript_changed, suppressed, added, selection_changes, full_copies, legacy_tasks }`. `legacy_tasks` (for any `--previous`) = the Task page ids along the `replaces` chain that are **not** mapped by a `task_items` entry whose item id is an item of the **current** plan: Tasks of a full copy, and Tasks whose item id no longer exists after the summary was regenerated. `--previous` must be the **latest** source of the input: an extract of `--page` that nothing replaces, or, for an input ingested in full before selection, its latest **non-extract** source with `source_key` `notion:<page>` that nothing replaces and when no extract of that page exists. **Full copy (`kind: "full"`):** a full copy holds no paragraph identities, so `suppressed` is empty, `added` is every paragraph of the new plan, `transcript_changed` is false, `full_copies` lists that source and its older versions along `replaces`, and `legacy_tasks` lists the Notion task page ids in the `tasks` of those sources (they have no item ids). Comparison is by **passages only**, the one thing a stored extract holds (capture-and-review §4.8): if the new `transcript_hash` differs, `transcript_changed` is true, `suppressed` lists every paragraph of the previous version and `added` every paragraph of the new plan (no passage identity carries over); `added` = every paragraph of the new plan; otherwise `suppressed` = paragraphs in the previous version and not in the new plan, `added` = paragraphs only in the new plan. `selection_changes` = `[{id, from, to}]` for the ids whose effective selection differs from the stored `selection` (for the preview only). `write_required` is true when a version must be written: for an extract `--previous` when `suppressed` or `added` is not empty, **or when the item ids or the passages of any item differ from the stored `selection` and `passages`** (a regenerated summary with unchanged paragraphs; capture-and-review §4.8), and for a **full copy always**, even when every item is excluded and `suppressed` and `added` are both empty. A plan with `write_required` false is `UNCHANGED`. `INPUT_INVALID` for an unreadable file, a `--previous` that is not the latest source of `--page` (`NOT_LATEST`, `WRONG_INPUT`) or a full copy when an extract of the page exists; `UNKNOWN_ID` for a missing id.

### 5.23 `brain source extract` (0055, 0062)

```text
brain source extract --page <notion-page-id> --title <text> --date <YYYY-MM-DD> --summary <file> --transcript <file> [--kind minutes|capture] [--previous <src-id>] [--dry-run] [--json]
```

The only writer of an extract. **Identity:** `--page` is the Notion page id of the full input; it gives `extract_of`, the `source_key` `notion:<id>` and the file name `_suppressions/<id>.json`; `--title`, `--date` and `--kind` (default `minutes`) fill the source's title, file date and kind; `captured` is `--now`, `content_hash` is computed from the body. **First version:** without `--previous`, `extract_version` is 1 and no `replaces`, **only when no source belongs to the input**. If any source has `extract_of` = `--page` or `source_key` = `notion:<page>`, omitting `--previous` stops with `INPUT_INVALID` (`PREVIOUS_REQUIRED`, naming that source): the command fails closed rather than create an unlinked version. **An input already ingested in full:** `--previous` names the latest **non-extract** source of that page (the full copy). Then the new extract is version 1 with `replaces` = that source, and, fail closed, the suppression record is written `active` with `passages: []` and `full_copies: [<that source id and its older versions>]`: a full copy holds no paragraph identities, so every claim resting on it is restricted (capture-and-review §5.1, an entry of a changed input with no live passage reference) until the cleanup row (§5.2) is decided, note by note. The cost is a cleanup row for the first selection on an already ingested input; the cleanup row says which claims have independent support. **Later versions:** `--previous` is validated as in §5.22; otherwise `INPUT_INVALID` (`NOT_LATEST` or `WRONG_INPUT`). It runs `extract-plan` (§5.22) and, when `ok` is true and `write_required` (§5.22; always for a full-copy `--previous`, and for a first version), performs **one journaled operation** (capture-and-review §7.11). **When it writes:** for an extract `--previous`, only if `write_required` (§5.22; `UNCHANGED` otherwise); a version whose body equals the previous one is allowed here, so the `DUPLICATE_SOURCE` content check of §5.5 does not apply to extract versions; for a full-copy `--previous`, **always** (the full copy has no passages to compare). **The suppression record** `_suppressions/<input>.json` is an **append-only list** `{ input, records: [ { version, passages, full_copies, written, status } ] }`: a write that suppresses something **appends** a record for its version (`suppressed` not empty, or a full-copy transition); a mapping-only or addition-only version appends none; an earlier record is never removed, so a later write cannot release an earlier unresolved exclusion. A record's `input`, `version`, `passages` and `full_copies` are never edited; the only permitted change is its `status`, `active` to `reconciled` (with `reconciled_at`), written by the cleanup apply. A record is appended exactly when `suppressed` is not empty, or for a full copy (with `passages: []` and `full_copies`). Each record is `active` until its own cleanup items are resolved (capture-and-review §5.3); a restriction holds while **any** record is active. The same list also holds **Restore records** `{ kind: "restore", extract_version, items: [{ note, n }], written }`, appended by the cleanup apply (CC-79) when the user accepts the Restore of one claim; a passage that a later version holds again stays restricted for **each claim** (a note and a passage) until a Restore record for that version names that note and passage, so restoring one claim never releases another claim on the same paragraph. The new version also **carries `task_items` forward** from the version it replaces. It writes a journal entry first, then stages in the workspace checkpoint the new `source` (`extract: true`, `extract_of`, `extract_version` = previous + 1 with `replaces` = the previous version, the fields of schema §4), the suppression record `_suppressions/<input>.json` (appended exactly when `suppressed` is not empty or for a full-copy transition, with `status: active`) and the regenerated views, flushes them together, **commits to Git with the trailer `Op: <op-id>`** (capture-and-review §7.11), and only then removes the journal. If any part fails, the checkpoint is restored and nothing is committed; if the process stops between file writes the journal remains, every other command refuses with `RECOVERY_NEEDED` until `brain recover` completes or rolls back the operation (fail closed: older evidence stays restricted). A retry recomputes from the same latest version, so it writes a version once. Same `ok`/`problems` rules as §5.22: a blocked input writes nothing. `--dry-run` returns what would be written. `data` = `{ created: [<src id>], suppression: <path>|null, views: [<path>], version }`; `UNCHANGED` (no write) when `write_required` is false.
## 6. Standard sequences (for skills)

| Flow | Sequence |
|---|---|
| **Ingest one meeting** (CC-06) | `status` → `index` (JSON, for matching) → `note new --dry-run` with the source (check `DUPLICATE_SOURCE`; a meeting set back to Reviewed after an ingest is a re-read: the source gets `replaces`, then `source diff`, and only the changed lines are extracted, 0045) → `id new` for the new notes → `note new` (source, meeting, people, decisions, questions) → `proposal new` (with one `review_notes` for the source, which takes in its `add_link`, `update_fact`, `update_body` and `add_to_note` items, and any `answer`, 0041, 0043, 0045) → `index` → `views` → `lint` → `log ingest <mtg> created=… proposals=… tasks=…` → `git commit` → `sync tasks` + MCP → `sync render --changed` + MCP → `sync record` → `git commit` |
| **Apply reviews** (CC-09) | MCP read Review rows → `sync plan` → `sync apply` → `index` → `views` → `lint` → commit → `sync render --changed` + MCP → `sync record` → commit |
| **Ingest a document, email, chat, note or capture** (0032, 0037) | as above, with the source's own procedure (brain-ingest `sources.md`); the source records the row's Project, Area and Only keep (0049, 0050); with Keep as document, the same batch writes a `whole` reference (Only keep empty) or a `part` one listed in the source's `review_notes` (Only keep set), one per attached file when the row has files (0049); owner action items → `sync tasks --source` + MCP; the source is published to the Inbox by `sync render --changed` |
| **Catch up** (0037, 0041–0043, 0045, 0048, 0049) | read-only pass (`status` for the modules; MCP reads of Review, Meetings, the Inbox's **Ready** rows, with Reports on the Ask rows and the Report rows (Documents, 0071) with Refresh asked ticked or a What to fix, the Inbox rows with Keep as document ticked, and the Decisions rows with Promote ticked; `sync plan`; drop-folder listing, asking for each file "keep as document? no / all / only …"; `repo changes` per linked repo; attachments on the Ready rows and Reviewed meetings; one batch of questions) → `proposal backlog` → **Apply reviews** → **Ingest one meeting** for each Reviewed meeting → **Ingest a …** for each Ready Inbox row, each attachment, each chosen drop-folder file and each changed repo file, then `repo record` → `note new` per `document_requests` (a `whole` reference, or a `part` one in a new `review_notes`) and per `promote_requests` (a `promoted` reference), then the boxes unticked through the MCP → with Reports on, `report new` with `refresh` per `refresh_requests`, `proposal new` + `report fix` per `report_fixes`, **Report** for each new Ask row → `views` → `sync render --changed` + MCP → `sync record` → commit → push per `settings.push` → `log catch-up - notes_read=<n> seconds=<s>` (0045). Steps of a module that is off are skipped, and so are its questions (0048) |
| **Catch up unattended** (0051) | as **Catch up**, with no batch of questions: each takes its default or skips its input, within a budget of inputs, publishing only with `settings.publish: auto`; nothing written when nothing waits. §6.1 |
| **Report** (0043) | `query --candidates` and the notes → the skill writes the six sections → `report new` → commit → `sync render --changed` + MCP (the Report row; the Ask row's Brain Status set to Done) → `sync record` → commit |
| **Apply in chat** | `proposal list --status pending` → ask → `apply` with `decided_by: chat` → `index` → `views` → `lint` → commit. The next sync publishes the change |
| **Sync** (CC-08) | as §5.14 |
| **Query** (CC-10) | `query --candidates` → read the top notes → answer with citations → `log query - notes_read=<n> seconds=<s>` (0045) |
| **Reflect** (0052, 0076) | `status` → `reflect --candidates` → the skill judges each cluster → the report, 10 findings at a time → per answer: yes (`proposal new` + `apply`, decided in chat), later (`proposal new`), skip (`proposal new` + `apply` reject) → `index` → `views` → `lint` → commit → at the end, `sync render --changed` + MCP → `sync record` → commit → `log reflect …`. Attended only. §6.2 |

A run never leaves lint errors it introduced: if `lint` reports new errors after a write, the skill stops before committing and reports them.

### 6.1 Catch up unattended (0051)

The skill brain-catch-up, started by the prompt `catch up unattended` (a schedule, §5.21, or the user by hand). It is **Catch up** above, in one turn, with nobody to ask: the read-only pass runs as usual, then each question of the batch takes its default or skips its input, and the run goes on. It applies the user's explicit decisions, interprets no text the user wrote, and decides nothing itself (0003 as amended by 0051). The 5-minute bar (0043) doesn't apply; the budget does.

**The one authority (assessment finding F-0007).** This section is the only place that says what an unattended run does. Its three tables below cover every question of the batch, every kind of decided row and Notion edit, and every selected input, Review item and module case of capture-and-review §4 to §8 (that file's §8 points here). The unattended tables in the skills (brain-catch-up's "One batch of questions" and its references) are renderings of these: where one differs, this section governs and the skill is corrected in the fork. A case none of the tables names is treated as a question with no default: the run skips that input and names it under Needs you.

**Reflection runs attended only** in 0.11.0 (0076 §5): `catch up unattended` never runs brain-reflect, and no table here has a reflection row. 0.15.0's weekly brief adds them (CC-111, 0075; moved by 0077 and 0078).

**Sequence.** read-only pass (as **Catch up**; a failed read, such as an expired Notion login, is a failure: the parts that need it are skipped, the rest goes on) → if nothing is waiting and nothing failed, stop: **no commit, no Notion call, no log line** → `proposal backlog` → `sync apply --input plan.json --skip-conflicted` (without `--record-only`) → the inputs within the budget, oldest first, each as **Ingest one meeting** or **Ingest a …** → `note new` per `document_requests` and `promote_requests` → with Reports on, `report new` with `refresh` per report to refresh (the table below: `refresh_requests` and the reports whose fixes are all decided; none for a report with a `report_fixes` item) and **Report** per Ask row → `views` → with `settings.publish: auto`, `sync render --changed --plan plan.json --skip-conflicted` + MCP → `sync record` → commit, and the boxes cleared → with Reports on and something for the user (below), the Report row → `log catch-up - mode=unattended …` (§3.9) → commit → push per `settings.push`.

**Every question of the batch** (brain-catch-up, "One batch of questions"):

| Question | Unattended |
|---|---|
| A sync conflict (`BOTH_CHANGED`, `MISSING_REQUIRED`, `UNRESOLVED_RELATION`, `UNKNOWN_BRAIN_ID`, `NOTION_ID_MISMATCH`, `REQUIRED_EMPTY`) | **skip** the whole row, in and out: `sync apply --skip-conflicted` leaves its other corrections, updates and decisions unapplied, and `sync render --plan … --skip-conflicted` publishes nothing to it (both `ROW_CONFLICTED`), and the skill drops any `document_requests`, `promote_requests`, `refresh_requests` or `report_fixes` item with that `page_id`; named under Needs you |
| What to fix on a Review row (`NOTE_TO_READ`, `FIX_TO_READ`, `FIX_WITHOUT_TEXT`) | **skip**: waits for an attended run (table below) |
| A meeting's pre-check blocker | **skip** the meeting: it stays Reviewed |
| An Inbox row's pre-check blocker | **skip** the row: it stays Ready, with its attachments |
| A capture that repeats a source the brain has | **default**: skipped, set to Done with "Skipped: same as <title>" when the run publishes; without a publish it stays Ready and is skipped again |
| "Which parts matter?" for a long attachment (on a Ready row or a Reviewed meeting) | **skip** the row or meeting whole, with its attachments: it stays Ready or Reviewed |
| A likely new version (of a meeting, a row or a file) | **skip** the input: it waits in its place (the meeting Reviewed, the row Ready, the file in the queue) |
| Pending proposals in chat (no Review database) | **default**: left pending |
| No `Drop folder:` line in AGENTS.md (the path question, and the offer to add the line) | **skip** the drop folder; Needs you says "Drop folder not set: say where it is" |
| The drop-folder list, and "keep as document?" | **default**: every readable file taken, none kept as a document; a file already in the brain, or the same file as another, moved to `processed/` as attended; a file that can't be read stays, named under Check |
| "Which parts matter?" for a long drop-folder file (sources.md, "The drop folder", step 2) | **skip** the file: it stays in the queue |
| Attachments | **default**: all of them |
| A linked repo with more than 10 changed files (which to take, and whether the rest is skipped for good) | **default**: all of them, none skipped for good; the budget takes the oldest that fit, and the repo gets no `repo record` until every listed file is in (budget, below). This replaces sources.md's "never run it unattended" for this run (CC-64 updates sources.md) |
| *(Reports)* An Ask row: "Report on …?" | **default**: yes, a new report |
| *(Reports)* A Report row to refresh: Refresh asked ticked (`refresh_requests`), or a report whose last `fixes` entry lists only proposals now applied, rejected or closed and whose `generated_at` is older than the last of those decisions (brain-catch-up, step 1.9) | **default**: yes, refreshed, unless the same report has a `report_fixes` item (previous row) or a wording row (`wording_waiting`, `wording_held`, `accepted_wording`, §5.14.7): then it waits, its Refresh asked box still ticked |
| *(Reports)* A report's What to fix and the proposals it becomes (`report_fixes`) | **skip** the report whole: the fix waits for an attended run, like a Review row's What to fix, and the report isn't refreshed meanwhile, whether its refresh was asked or due (next row) |
| *(Reports, Documents)* Accepted wording whose acceptance is current (`accepted_wording`, §5.14.7) | **default**: imported when `unattended_ok` (accepted at least 2 minutes before the snapshot) and the skill's re-read confirms it is unchanged; otherwise **waits** (`TOO_FRESH`) |
| *(Reports, Documents)* Any other wording row (`wording_waiting`, `wording_held`) | **skip**: nothing is imported, and the body is not published over; `wording_waiting` rows are named in the report |
| The identities question | **skip**: asked again at the next attended catch-up |
| "Publish to Notion at the end?" | **default** from `settings.publish`: `auto` publishes; `ask` publishes nothing and leaves it to the next attended run |

A request that asks no question runs as attended: a re-read, a `document_requests` item (with Only keep, its `part` Document goes to review in a `review_notes`), a `promote_requests` item, the backlog rows. An input whose ingest raises a new question during the run is skipped, as attended (brain-catch-up step 3).

**Every kind of decided Review row and Notion edit** (`sync plan`, §5.14.2):

| In the plan | Unattended |
|---|---|
| `decisions`: Approve or Reject with What to fix empty | **applied** |
| `corrections`: a brain-owned property you changed (Key Facts, Role, Name, Summary, Why, Deadline, Area, Goal, Client, Org, People) | **applied** |
| `updates`: Lifecycle you set (Reviewed, Archived), Notion-owned fields (Status, Priority, Dates, Progress, Archived, Email, Relationship, Website, Type, Key Results), a `notion` page id | **applied** |
| `create`: an area, goal, project, person or org row you created | **applied** (an addition) |
| conflict `NOTE_TO_READ`: Approve or Reject with What to fix ("all except b") | **waits**: counted in `waiting`, named ("1 approval with notes waiting for you") |
| conflict `FIX_TO_READ`: Fix with What to fix ("a: March") | **waits**: counted in `waiting`, named ("1 Fix waiting for you") |
| conflict `FIX_WITHOUT_TEXT` | **waits**, as an attended run asks about it |
| *(Reports)* `report_fixes`: a What to fix on a Report row | **waits**: counted in `waiting`; that report's refresh waits with it (first table), and `sync render --skip-conflicted` doesn't publish it (`FIX_WAITING`), so its What to fix, Refresh asked and body stay as they are in Notion, and any earlier change to it in Git waits for the attended run |
| A Fix or Edit from a space not yet on migration 0009 (Edit is read as Fix, §5.14.2) | as the Fix above: **waits** with text, a conflict without |
| `review_decisions` of the new layout: an item whose token is explicit, whose wording is exact and current, base unchanged, and whose Decided at is at least 2 minutes old (`unattended_ok`) | **applied** |
| `review_revisions`, `review_held`, an item that is unreadable, `base_changed`, an Accept all with an ineligible item | **waits**, named; the revision text is never read |
| `ignored` (`NOT_CORRECTABLE`, `ALREADY_TERMINAL`, `MODULE_OFF`, …) | nothing, as attended; `NOT_CORRECTABLE` is named under Check |
| Chat decisions | none: nobody is in the chat |

**Every selected input, Review item and module case** (capture-and-review §4 to §8, 0055; moved here from capture-and-review §8, where the attended column stays):

| Situation | Unattended |
|---|---|
| Domains off | no Domain surface, as attended |
| Voice template; Tasks module off | summary written, no Task items, as attended |
| Input unconfirmed | **skip** the input; named under Needs you |
| Selection unreadable, stale or unmappable | **skip** the input; named under Needs you |
| Confirmed, the page settled for at least 2 minutes | **ingested** as the extract; the report states the confirming-minute limit |
| Selection changed after ingestion (tokens only) | the page settled for at least 2 minutes: the new version is written, its restriction and views at once, and the cleanup only proposed; otherwise it **waits** (`TOO_FRESH`) |
| Page set back to Reviewed or Ready, and the transcript changed | **skip** the input; named under Needs you |
| A Review item: Accept, Decided ticked, exact, current, base unchanged, Decided at at least 2 minutes old | **applied**: the `review_decisions` row of the table above |
| A Review item: Request revision, an unreadable token, a missing section, `base_changed`, an ambiguous edit, or an Accept all with an ineligible item | **waits**, named, never interpreted: the `review_revisions` row of the table above |
| Exclusion cleanup | **proposed** (an addition); nothing removed |
| Tasks from excluded content | listed, as attended |
| Reports module off | reports not touched, as attended |
| Legacy Fix row (old layout) | kept as it is, as attended |

0051 also lists "an Edit with a value" as applied. Since migration 0009 a Review row has no such option (Edit became Fix, whose What to fix needs reading), so nothing of that kind reaches an unattended run: an `edit` with a `value` is passed to `brain apply` only in chat, by an attended run.

**The budget.** `settings.unattended.max_inputs` (default 10, schema §12) counts inputs: each Reviewed meeting, each Ready Inbox row (its attachments with it), each drop-folder file and each changed file of a linked repo. They are taken oldest first, by the meeting's Date, the row's created time, the drop-folder file's modified time, the repo file's `committed_at`. Skipped inputs don't count; failed ones do. A repo whose files didn't all fit gets no `repo record`: the next run lists them again, and the ones already in skip as `DUPLICATE_SOURCE` (sources.md, "Linked repos", step 4). An input whose source the brain already has (`note new --dry-run` reports `DUPLICATE_SOURCE`: a repo file taken by an earlier run, or a row an earlier run wrote but didn't publish) is not an input again and isn't counted; a row or meeting waits for the publish. The inputs beyond the budget are `left`, named in the report ("4 more wait for the next run"), and taken by the next run. Requests (Documents, promotions, refreshes, Ask rows, the backlog) aren't inputs and aren't counted. When `brain status` gives `unattended.backlog: true`, the report says "Backlog growing: run more often or raise the budget".

**A step that fails** is logged in the run's `failures` and the run goes on with the next input. A lint error in a file the run wrote stops the run there, as attended, and is a failure.

**What needs the user** is the skipped inputs, the `waiting` rows and fixes, the conflicts, and the failures. The report is the attended three lines (Done, Needs you, Next) with What came in and Check, written:
- **in the log line** (§3.9), always, unless the run was a no-op;
- **in one Inbox row of Kind Catch-up** (Kind Report before 0.9.1, 0071), only with Reports on (`modules.reports`), with `settings.publish: auto` (an unattended run with `ask` writes nothing to Notion, 0051), and when something needs the user or failed. The skill creates it through the MCP in the publish step: Name `Catch-up <D Mon>: <n> in, <n> need you` (`, <n> failed` added when one did; "1 meeting in, 1 needs you"), Kind = Catch-up, Brain Status = Done, no Brain ID, the report as its body. It is not a note and has no file in Git; its facts are in the log line. It is history, not a living report, so it stays in the Inbox (0071). A Refresh asked or What to fix on it (an Inbox that still has them) is ignored (`NOT_A_REPORT`, §5.14.2). A Notion failure can't write it; the log line still holds the run;
- with Reports off or `publish: ask`, nowhere else: what needs the user waits where they act on it (the meeting Reviewed, the row Ready, the Fix in Review), and the next attended catch-up opens with the summary below. The skill's "Run on a schedule" section says so when it sets a schedule (CC-64): the summary row needs Reports on and `publish: auto`.

**The next attended catch-up** opens with the summary of the unattended runs since the last attended one, from `brain status` `unattended.catch_up` (§5.2), before its batch: "Since last time: 4 scheduled runs, 6 inputs in, 1 skipped, 1 Fix waiting, 1 failed: Notion login". Nothing when `catch_up` is `null`. Its own log line has no `mode`, which starts the count again.

### 6.2 Reflect (0052, 0076)

The skill brain-reflect, started when the user asks: "tidy the brain", "what's inconsistent?", "any duplicates?". It reports first in the chat and changes nothing without a yes, as Ultimate Assistant does (0072): each finding comes with a recommendation, and the user says **yes** (applied now), **later** (a Review row) or **skip** (0076 §1). Every answer is a proposal carrying the finding's fingerprint (schema §11.4), so Git says what changed and why, and a skip is remembered. It runs **on demand only** (0076 §5, §6.1).

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
- A yes writes `proposal new` with the finding's proposal, then `apply` with `{ proposal, action, decided_at: <now>, decided_by: "chat" }`: `approve` for the recommendation; `fix` with `fixes: [{ value }]` and `note` = the user's words for a value of their own or a contradiction's chosen value (schema §11.3; a contradiction fixed to a value no claim holds is attributed to the user, schema §11.2). **A theme** isn't applied: a yes writes the draft with `note new`, then its `review_notes` with `proposal new`, and the user reviews the Document as any new note (0076 §4).
- **"later N"** writes the proposal and no decision: it is `pending` and becomes a Review row at the end of the session. For a theme, "later" is the same as a yes: the draft is reviewed in Review either way. Review rows come only from "later", so 0052's cap of 10 rows per run is gone (0076 §2).
- **"skip N"** (with "because …" or not; the skill doesn't ask why) writes the proposal and rejects it in chat: `apply` with `action: "reject"`, `note` = the reason when given. It is never published (§5.14.4). A theme's skip is a `new_item` holding the Document it would have drafted: title, summary, `origin: learned`, `sources`, a one-line body. How long a skip lasts depends on the kind (schema §11.4).
- **A finding already proposed.** When `proposal new` skips the item `DUPLICATE_PENDING` (an earlier "later" of this session, or a Review row still pending), the `existing` proposal is decided instead: a yes approves or fixes it, a skip rejects it.
- **"more"** shows the next 10 judged findings; when they run out and `total` is beyond the page, `reflect --candidates --offset <offset + limit>` is run and judged first (step 2), continuing the numbers. **"done"** ends the session.
- A finding the user doesn't answer writes nothing; it can come back next time.

**6. After the answers.** After each answer that wrote: `brain index`, `brain views`, `brain lint`, commit (`reflect: <what changed>`). At "done": when anything changed or a Review row waits, `brain sync render --changed` and the MCP, then `brain sync record`, commit, with `settings.publish` as an attended catch-up uses it (`auto` publishes; `ask` asks once), then push per `settings.push`. The proposals decided in chat aren't rendered (§5.14.4); the changed notes, the drafts and the "later" rows are.

**7. Closing summary.** One line: `Done: <n> changed, <n> Review rows, <n> skipped, <n> drafted.` (parts at 0 left out; `Nothing changed.` when all are 0). **changed** counts the proposals applied after a yes, **Review rows** the "later" proposals still pending at "done" (a "later" the user then said yes or skip to counts as changed or skipped instead), **skipped** the skips written, **drafted** the theme Documents written (after a yes or a "later").

**8. The log.** One line at the end, except after `Nothing to tidy.` (step 4), which writes nothing (CC-67's acceptance): `reflect - clusters=<total> findings=<n> shown=<n> applied=<n> proposals=<n> skipped=<n> drafted=<n> notes_read=<n> seconds=<s>`: `clusters` is the first `reflect --candidates` call's `total`, `findings` the findings judged, `shown` those the reports showed, and the next four the closing summary's counts.

**The Ultimate Assistant sub-agent loads brain-reflect too** (0076 §8), so "tidy the brain" works in the same chat as "review my projects" ([assistant.md](assistant.md) §10). Asked with `report only`, it returns the report above as its whole answer and changes nothing; the session that called it runs its own session of the skill when the user wants to act, and the user's numbers refer to that report.

**In the brain's files** (CC-67): the brain's `AGENTS.md` operations table gains the row "tidy the brain: contradictions, duplicates, stale facts and recurring themes in your notes | `brain-reflect`", and the sub-agent's text names the skill (assistant.md §10).

**Not in 0.11.0:** a schedule, an unattended run, and the light pass inside catch-up (0052) that 0075 §4's targeted check after an approved correction replaces (0076 §5).

### Domains (0055)

Domains use `dom-` ids and `domains/<slug>.md`. When Domains is off, sync ignores Domain rows and Area · Domain with `MODULE_OFF`, and render omits them. When on, Area · Domain is a correctable optional single relation: multiple values conflict as `MULTIPLE_DOMAINS` and hold the whole row. Domain · Org follows the Orgs module. Lint checks the types of both relations and reports `DOCUMENT_DOMAIN_MISMATCH` when a Document’s Area and a linked Project’s Area have different Domains.

### 5.24 `brain recover` (0055, capture-and-review §7.11)

```text
brain recover
```

Finishes or rolls back each interrupted journaled write, oldest first. For `_journal/<op>.json`: if a commit with the trailer `Op: <op>` exists, the work is kept and only the journal is deleted (`committed`); otherwise each listed path goes back to the last commit (`git restore --source=HEAD --staged --worktree -- <path>`), each listed new path is removed, and the journal is deleted last (`restored`, reported as `RECOVERED <op>`). Before restoring, every journaled path is checked: a path whose content is neither the operation's own write (the `hash` in the journal) nor the last commit was changed by someone since, and recovery stops with `RECOVERY_NEEDED` naming it, leaving the journal and the file as they are. An unreadable journal file is named the same way. Every step is idempotent, so an interrupted recovery is run again. Restoring puts both the index and the worktree back to the last commit (`git restore --source=HEAD --staged --worktree`), so a commit that failed after `git add` leaves nothing staged; new paths are unstaged and removed. If a step fails the journal is kept and every command keeps refusing with `RECOVERY_NEEDED`. `data` = `{ recovered: [{ op, action }] }`; an empty list when there is nothing to do.

### 5.25 `brain source cleanup-plan` (0055, capture-and-review §5.2)

```text
brain source cleanup-plan --page <notion-page-id>
```

Read-only. Lists what an input's **active** suppressions (`_suppressions/<page>.json`, §5.23) restrict and what stays, for the exclusion cleanup row. The Review row, its item decisions (Remove, Keep, Restore) and their apply are CC-79. `data` = `{ input, latest_extract, notes: [{ note, path, whole, reason, restricted: [{line, text}], kept: [{line, text}] }], restore: [{ note, line, passage }], tasks: [{ task, item, reason }], documents: [{ note, sources }] }`.
- `notes`: every knowledge note that rests on the input (by lineage, `unknown` lineage included) and has a restricted statement or is restricted whole. `reason` is `passages` (a statement cites a suppressed passage), `unmapped text` (no passage references, restricted whole) or `unknown lineage`. `kept` lists the statements with a passage reference that stay eligible, so the row shows what is **independently supported**.
- `restore`: statements citing a passage that an earlier suppression removed and the latest version holds again.
- `tasks`: Tasks (`tasks` of the input's versions) whose item is no longer selected (`item no longer selected`) or that no item can be tied to (`unknown item`, e.g. made from a full copy). The brain never cancels or deletes a Task.
- `documents`: Documents (`reference`) made from the input's sources, for Remove or Keep. A note entry also lists `restricted_timeline` (indices of timeline entries not returned) and `restricted_facts` (fact keys not returned).

### 5.26 `brain source cleanup-propose` (0055, capture-and-review §5.2)

```text
brain source cleanup-propose --page <notion-page-id> [--json]
```

Writes the exclusion cleanup row of an input as **one pending `review_notes`** built from `cleanup-plan` (§5.25): `notes: []`, `links: []`, `source` = the latest extract, `cleanup: { input, version, tasks }` and `items` of three kinds, each with an immutable `item_id`. **`remove`** (`ref` = a note that stays): *Proposed* is the note's text without the lines that rest on excluded content (editable: the user may correct instead); Accept writes that text exactly, drops the note's restricted timeline entries and facts, and records `lineage_cleared` (the input added to the list); it is refused (`STILL_RESTRICTED`) if the text still holds a statement that rests on excluded content. **`restore`** (`ref` = a note, `n` = a paragraph): *Proposed* is the word `Restore`; Accept appends `{ kind: "restore", extract_version, items: [{ note, n }] }` to `_suppressions/<input>.json`, per claim (a note and a passage); applying twice writes nothing. **`independence`** (a note whose text cannot be tied to a passage, or a Document made from the input): *Proposed* is the word `Keep` or `Remove`, default `Remove`; Keep records `lineage_cleared`, Remove archives the note; any other word is `UNREADABLE_PROPOSED`. Tasks created from excluded content are listed in `cleanup.tasks` and shown as a plain list, never as items; the brain never cancels them. **Defer is not read on a cleanup item** (`DEFER_NOT_SUPPORTED`): it stays pending. Reject changes nothing and releases nothing (capture-and-review §5.3). The items are applied by `sync apply` (§5.14.3) as one journaled operation; when the last of them leaves no note restricted by the input, **the input's active records become `reconciled`** with `reconciled_at`, in the same operation. If a cleanup row for the input is already pending the command writes nothing (`result: PENDING_EXISTS`, with its id); with nothing to clean it is `NOTHING_TO_CLEAN`. `data` = `{ result: WRITTEN·PENDING_EXISTS·NOTHING_TO_CLEAN, proposal?, path?, items? }`.

### 5.27 `brain proposal revise` (0055, capture-and-review §7.8)

```text
brain proposal revise --input <file|-> [--dry-run] [--json]
```

`{ proposal, item_id, proposed, previous }`. Writes the new draft of an item the user asked to revise. **Request revision is recorded by `sync apply`:** each `review_revisions` entry of the plan with an instruction becomes `revisions: [{ item_id, instruction, requested_at, status: requested }]` on the proposal (`data.revision_results`: `recorded`, or `skipped` with `UNKNOWN_ITEM`, `NO_INSTRUCTION`, `ALREADY_DECIDED`, `ALREADY_REQUESTED`, `REVISION_NOT_SUPPORTED`); the item stays pending and the write is part of the journaled operation (§5.14.3). An **unattended run never reads revision text** (0051): the skill does not put `review_revisions` into the plan it applies. `proposal revise` then replaces the item's stored proposal with `proposed` (a draft's body, a link's value, an `update_fact` value, or the text of an `update_body` / `add_to_note`), validated as for an edited accept, sets the entry `status: drafted` and keeps `previous` (the user's earlier wording from the Proposed toggle). It refuses an item with no requested revision, a decided item and a cleanup item (`INPUT_INVALID`). It accepts nothing and never changes a lifecycle.

**Re-rendering a consumed submission (capture-and-review §7.4 b).** `sync render` of a published Review row of the new layout still sends no body; besides `sections["Review summary"]` it returns `item_updates: [{ item_id, reason, section }]` for the pending items whose section the user must see changed: `revision_drafted` (the section holds the new *Proposed* and a toggle **Previous proposal**, which is never read, and `Decision: Pending`) and `base_changed` (*Current* shows what the target holds now; for an `update_fact` that is the fact's current value). An applied or closed item is never listed. `review_published_after` is the `published` value to record once **every** listed section was written (the full `@review` items map with the new hashes); the skill writes each section only if it still equals the `submitted_hash` it read, otherwise it shows a "Brain update" toggle and records nothing for that item.

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

**`repo add <name> --path <path> --kit`** links a repo from its kit. It is §5.16's `repo add` with the kit's values: `area` = `placement.area`, `patterns` = `knowledge.patterns`, `never_read` and `project` when the kit has them, and `kit: { sha256 }`. The kit's `name` must equal `<name>` (`KIT_INVALID`, pointer `/name`); a repo with no kit is `KIT_MISSING`. `--kit` can't be combined with `--area` or `--pattern` (`USAGE`). §5.16's other checks apply unchanged. `data` = the new entry.

**`repo refresh <name>`** re-reads the kit of a linked repo and copies `area`, `patterns`, `never_read`, `project` and the hash into its entry. It never changes `commit`, so the next `repo changes` lists only what changed since the last ingest (CC-118).
- **A legacy entry** (no `kit`) whose repo now has a `brain-kit.json` (written by `repo kit write` after the user's yes) adopts it: the entry gets the kit's copies and `kit: { sha256 }`, as `repo add --kit` would give it. A legacy entry whose repo has no kit file is `NO_KIT` (exit 4), unless `--path` is given: then only the path changes and the entry stays legacy.
- **`--path <path>`** records a repo's new location, when it moved (`PATH_MISSING` in the health check). It is absolute or starts with `~/` (`INPUT_INVALID`), and is stored as given. It must resolve to the top of a Git working tree (`REPO_NOT_FOUND`) that isn't the brain (`REPO_IS_BRAIN`, compared after resolving symbolic links). The kit is read there. When `commit` isn't `""`, it must be a commit of the repo at the new path and an ancestor of its `HEAD` (`REPO_COMMIT_UNKNOWN`): this is how the command knows the path holds the same repo. The old path isn't read, so it may be gone.
- Order of checks, all before any write: the name (`REPO_NOT_FOUND`); `--path` as above, or else the entry's own path (`REPO_NOT_FOUND`); the kit: a kit-linked entry needs one (`KIT_MISSING`), a legacy entry with no kit and no `--path` is `NO_KIT`, and a kit read must be valid for this entry, its `name` the entry's (`KIT_INVALID`, as for `kit write`); then, with `--path`, the commit.
- `data` = `{ name, changed, placement_changed, added_patterns, removed_patterns, added_never_read, removed_never_read, reingest }`. `changed` is true when the entry would change: the kit's hash isn't `kit.sha256` (always, for a legacy entry adopting a kit), or `--path` differs from the stored `path`. When it is false, nothing is written. `placement_changed` is true when `area` or `project` differ, a project added or removed included. The four lists compare the kit with the entry, in the kit's (added) or the entry's (removed) order; they are empty when no kit is read.
- `reingest` is true when patterns were added or never-read paths removed: files that are now readable but older than the recorded commit are only listed after `repo record --reset` (§5.16), and the skill offers that. A legacy entry adopting a kit is compared with its own `patterns` and `never_read`.
- `--dry-run` writes nothing and reports the same `data`, after the same checks.
- Logs `repo-refresh - "<name>"` when it writes, with `sha=<first 12 hex>` when the entry has a kit after the write, and `path=<path>` when the path changed.

**`repo show <name>`** writes nothing. `data` = `{ entry, kit, kit_sha256, kit_status: current|changed|missing|invalid|none, workflow }`.
- `kit` is `null` unless the status is `current` or `changed`. `kit_sha256` is the hash of the file's bytes, `null` for `missing` (the file or the repo's path is gone) and `none`.
- `workflow` is `{ id, state }` of the workflow in state `connected` or `paused` whose `folder.repo` is this name, or `null` (connected-workflows.md §3.1 allows at most one).

**`repo health [<name>]`** writes nothing. `--rollup-as-of` (with `<name>`) enables `ROLLUP_STALE`. It runs the checks of linked-repos.md §6 on one repo, or on all repos in `brain.json` order. `--input` takes the issue data of `repo tasks` for a GitHub or GitLab source, so `STATUS_UNMAPPED` can be checked; it needs `<name>`. `data` = `{ repos: [{ name, checks: [{code, severity, message, path?}] }] }`, checks in the table's order; a repo with no finding has `checks: []`. `path` is the repo-relative file a check is about, when there is one. `--input` or `--rollup-as-of` without `<name>` is `USAGE`. The exit code is 1 when any check is an error.

**`repo tasks <name>`** writes nothing. It builds the read-only rollup (linked-repos.md §4) of a `tracked-in-repo` repo.
- Refusals, all exit 4: a legacy entry is `NO_KIT`, a kit whose mode is `connected` is `MODE_CONNECTED`, and a kit without `tasks` is `NO_TASKS`.
- `markdown`: no input (`USAGE` with `--input`); the CLI reads the file at `HEAD`. A file missing at `HEAD` is `KIT_INVALID` (pointer `/tasks/source/path`). The warning `REPO_DIRTY` is given when that file has uncommitted changes, or isn't tracked.
- `github` and `gitlab`: `--input` is required (`USAGE`): `{ fetched_at, items: [{ number, title, state, state_reason?, labels: [string], url }] }`. `state` is `open` or `closed` (GitHub; `state_reason` `completed` or `not_planned`), or `opened` or `closed` (GitLab).
- `data` = `{ name, target: { project } | { area }, as_of, counts: { todo, in_progress, waiting, review, done, dropped, unmapped }, percent, items: [{ key, title, raw, meaning, url? }], unmapped: [{ raw, count }], toggle: { heading: "Repo tasks · <name>", markdown } }`.
  - `items` holds every item, in source order (issues in input order); an unmapped item has `meaning: null`.
  - `percent` is `null` when there are no non-dropped items.
  - `as_of` is `--now` for markdown, `fetched_at` for issues.
  - The skill writes `toggle.markdown` under `toggle.heading` on the target's page.

**`repo unlink <name>`** removes the entry from `repos` (the `repos` key stays, even when empty). It changes no source, note or file in the repo (linked-repos.md §9). `data` = `{ name, removed: <the entry>, sources: <the number of sources with this repo>, workflow: <as in repo show> }`. Logs `repo-unlink - "<name>"`.

**`repo new`** creates a new repo from the generic starter (linked-repos.md §7).
- `--input` is the kit, with `starter` left out (the command sets it, replacing any given). `--starter` accepts only `generic` (`USAGE`).
- `path` is absolute or starts with `~/` (`INPUT_INVALID`). It must not exist, or must be an empty folder (`TARGET_NOT_EMPTY`), and must not be inside the brain (`OUTSIDE_ROOT`, compared after resolving symbolic links).
- The kit is checked as for `kit write`, including `--confirm` on the bytes of the kit file it writes (with `starter` set), plus the source rule of linked-repos.md §7.
- It writes the starter's files of linked-repos.md §7 and the kit, runs `git init`, and commits everything with `Start from the Ultimate Brain generic starter`. A commit that fails (no Git identity) gives the warning `GIT_COMMIT_SKIPPED` and keeps the files.
- It doesn't link the repo: the skill runs `repo add --kit` next.
- `data` = `{ path_abs, files: [path], sha256, commit }`, with `files` sorted by path (code points) and `commit` the short hash (`git rev-parse --short`), or `null` when the commit was skipped.
- Logs `repo-new - "<name>"`.

**Changes to §5.16.** `repo changes` leaves out the files that match the entry's `never_read`, and always leaves out `brain-kit.json`. For `repo add` without `--kit`, `never_read` and `project` can't be set; they come only from a kit.

New error codes, all with exit 4: `KIT_MISSING`, `KIT_INVALID`, `KIT_EXISTS`, `KIT_CHANGED`, `NO_KIT`, `MODE_CONNECTED`, `NO_TASKS`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_MISMATCH`. Existing codes used: `REPO_NOT_FOUND`, `REPO_IS_BRAIN`, `OUTSIDE_ROOT`, `TARGET_NOT_EMPTY`, `UNKNOWN_ID`, `USAGE`. CC-102 adds the new codes to §3.5, the rows of §1.1 (the link skill: `repo kit check`, `repo kit write`, `repo add`, `repo refresh`, `repo show`, `repo health`, `repo tasks`, `repo unlink`, `repo new`, `link`) and §1's exceptions.

### 5.30 `brain question drop` (0071, capture-and-review §6.2)

```text
brain question drop --input <file|->
```

Drops questions the user agreed, in the to-do tidy, are not questions: an owner's to-do that became a Task, or someone else's commitment. Attended only: the skill runs it after the user's yes for each item, never in an unattended run. Input: `{ "items": [ { "id": "que-…", "task": "<Notion task page id>" } ] }`, `task` optional, at least one item, each id once (`INPUT_INVALID` otherwise, with the pointer `/items/<n>`).

Checks, all before any write (one failing item writes nothing; `INPUT_INVALID` unless named):
- `id` names a note (`UNKNOWN_ID`) that is a `question` with `kind: question`: a risk is never dropped this way;
- the question has no `answer`, its Status is not Answered (`notion_fields.status`; Dropped is fine, Open or none is the usual case), and, unless it is already dropped (below), its lifecycle is not `archived`: an archived question is history (superseded, merged or archived by you), not a to-do;
- `task`, when given, is a non-empty string held in the `tasks` of the question's `raised_in` meeting or of one of its `sources`: the skill creates the Task with `sync tasks` and records it with `sync record` (§5.14.5, §5.14.6) **before** the drop, so a drop never names a Task the brain has not recorded.

Per item:
- **`dropped`**: the question gets `lifecycle: archived`, `dropped` = today (the `--now` date), `task` when given, and `updated` = today. Its `notion_fields` are not touched (Status is yours; the publish sends Dropped once, §5.14.4). Logs `question-drop <id> "<title>"`.
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
- `project` and `area` place the finding ("first" by title, then id, assistant.md §3.1): for a task, its first live project in the brain and that project's `area`, else its first project in the brain and that project's `area`, else `null` and the first brain Area whose page (assistant.md §2.1) is in its `areas`; for a project, itself and its `area`; for an Area, `null` and itself; for a pair, the survivor and its `area`. The skill copies `area` into the proposal it writes (§5.6), so a Review row lands on the right area home.
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
- **Restricted evidence** (0076 §6): §5.13's rule holds throughout, exactly as `query` applies it. A source it leaves out (an older version or a full copy of a changed input) is no input; a blanked line is no text; a note it leaves out whole is never a member and gives no names; a timeline entry or fact it drops is not read. An unreadable suppression record fails the command with `SUPPRESSIONS_UNREADABLE`.
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

- `key` is `<signal>:<member ids, sorted, joined by +>`, or `recurring_term:<slug>`. `notes` are the members, sorted by id (`summary` as §5.13 restricts it). `names` is in the order of `notes`.
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
