# CLI Contract (v1)

**Status:** Draft for review (task CC-03)
**Applies to:** the `brain` CLI in `src/` (tasks CX-02 to CX-11).
**Depends on:** [schema.md](schema.md) (field names, file formats, apply rules). When this document and schema.md disagree on a file format, schema.md wins and this document is fixed.

Decisions referenced: 0003, 0006, 0007, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0021, 0023, 0024, 0026, 0027, 0041–0043, 0045.

---

## 1. Scope

The CLI does the **deterministic** work: IDs, file writes, validation, index, views, applying decided proposals, and turning Notion snapshots into plans. The **skills** (Claude Code / Codex) do the judgment and the Notion I/O: they read minutes, extract knowledge, call the Notion MCP (0015), and call the CLI to write.

Rules for every command:
- **No network.** The CLI never calls Notion or any other service. Notion data enters only as JSON files written by a skill.
- **No Git, except `init`, `upgrade` and `repo`.** Commands write files; the skill commits. `init` creates the repository and its first commit, `upgrade` commits its own files (§5.15), and `repo` reads a linked repo with read-only Git commands (§5.16, 0042).
- **No LLM.** Same input and same brain give the same output, except for new random IDs and the clock (see `--now`).
- **Writes only inside the brain**, except `init` (the new brain folder, and the global config file with `--set-default`) and `link` (three files in the target repo).

### 1.1 Skill commands vs CLI commands

Decision 0024 lists user-facing commands. Some are skills that call the CLI; some are CLI commands. Users ask agents for the skill; agents call the CLI.

| User-facing (0024) | Runs as | CLI commands it calls |
|---|---|---|
| `brain init` | CLI | `init` |
| `brain connect-notion` | skill (CC-08) | `config set`, `modules` (the onboarding checklist, 0048) |
| `brain ingest` | skill (CC-06) | `status`, `index`, `id new`, `note new`, `proposal new`, `views`, `lint`, `log`, `sync tasks`, `sync render`, `sync record` |
| `brain apply` | skill (CC-09) | `sync plan`, `sync apply` (or `apply` in chat), `index`, `views`, `sync render`, `sync record` |
| `brain sync` | skill (CC-08) | `sync plan`, `sync apply`, `index`, `views`, `sync render`, `sync record` |
| `brain query` | skill (CC-10) | `query --candidates`, `index`; report mode (0043, 0045): `report new` (with `refresh`), `report fix`, `sync render`, `sync record` |
| catch up | skill (0037) | the calls of ingest, apply and sync, plus `proposal backlog` (once, 0041), `repo changes` and `repo record` (0042), `source diff` (re-reads, 0045). (`source full-text`, 0043, is retired in 0.6.0, 0049) |
| turn a module on or off (0048) | skill | `modules`, `config set` |
| `brain link` | CLI | `link` |
| `brain upgrade` | CLI | `upgrade` |
| `brain lint` / index | CLI | `lint`, `index` |
| `brain notion-change` | skill (CC-11) | none |

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
| `REPO_COMMIT_UNKNOWN` | 4 | a commit given to, or recorded for, a `repo` command doesn't exist in the repo, or isn't an ancestor of the commit it is compared with |
| `MODULE_OFF` | 4 | a command needs a module that `brain.json` `modules` turns off (0048, schema §12): `sync tasks` with Tasks off |
| `RETIRED` | 2 | a command retired in this version (`source full-text`, 0049); the message names what replaces it |
| `WRITE_CONFLICT` | 5 | a file appeared at a path the command was creating, after it read the brain (another writer). Nothing is kept (§3.6); re-run the command |
| `CLAUDE_NOT_FOUND` | 3 | `schedule install` found no `claude` executable on `PATH` to schedule (0051, §5.21) |
| `SKILL_MISSING` | 3 | `schedule install` for a job whose skill the brain doesn't have (`reflect` before brain-reflect is installed, 0052) |
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

The CLI scans these folders under the brain root: `areas/` (with `areas/briefs/`), `goals/`, `projects/`, `archive/`, `knowledge/`, `sources/`, `reports/`, `memories/`, `_proposals/`. Every `*.md` file there must have frontmatter with an `id` (lint error `not-a-note` otherwise). Files elsewhere (root `AGENTS.md`, `CLAUDE.md`, `README.md`, `index.md`, `log/`, dot-folders) are not notes.

### 3.8 Slugs and paths for new files

Slug of a title: Unicode NFKD, drop combining marks, lowercase, replace every run of characters outside `[a-z0-9]` with `-`, trim `-` at both ends, and if longer than 60 characters, keep the first 60 and then, if they contain a `-`, drop everything from the last `-` on (so a word is never cut in half); use `note` if the result is empty. `"María López — PM"` → `maria-lopez-pm`.

Path by type (schema §2). Dated types use the note's `date`, else `file_date` from input, else `created`:

| Type | Path |
|---|---|
| area, goal | `areas/<slug>.md`, `goals/<slug>.md` |
| project | `projects/<slug>/project.md` |
| person, org, question, concept | `knowledge/people/<slug>.md`, `knowledge/orgs/…`, `knowledge/questions/…`, `knowledge/concepts/…` |
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

`"` and `\` in titles are escaped with `\`, and CR and LF become `\r` and `\n`, so every entry is exactly one line. Values with spaces, quotes, backslashes or line breaks are quoted and escaped the same way. The file is created exclusively with its header, then lines are appended; an unreadable log is an error, never a reason to start the file over. Ops written by the CLI: `init`, `note-new`, `proposal-new`, `apply`, `correct`, `sync-create`, `sync-update`, `upgrade`, `repo-add`, `repo-record`, `full-text` (before 0.6.0), `modules`, `report-new`, `report-refresh`, `report-fix`. Skills add their own (`ingest`, `publish`, `catch-up`, `query`) with `brain log` (§5.11). `index` and `views` do not log.

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
3. Copy the template. npm never packs files named `.gitignore`, so the template stores it as `templates/brain/gitignore` and `init` writes it to the new brain as `.gitignore` (reported in `created` under that name; a `--force` run skips it like any other existing file). Write `brain.json` from the template with `schema_version: 1` and `owner.name` = `--owner` (default: the `user.name` from `git config`, else `"Owner"`).
   Copy the skills the package ships in `.agents/skills/` to `<path>/.agents/skills/` (Codex) and to `<path>/.claude/skills/` (Claude Code) (0029, 0038). They are product-owned and listed in `created`; with `--force`, existing files are skipped like template files.
4. Run `index` (an empty index).
5. Log `- <timestamp> init - "<owner name>" schema=1` (no machine paths in the log).
6. Unless `--no-git`: `git init`, add all, commit `init: ultimate brain (schema v1)`, so the new brain starts clean. If Git is missing or the commit fails (no identity), keep the files, skip the commit and add warning `GIT_COMMIT_SKIPPED`.
7. With `--set-default`: write `~/.config/ultimate-brain/config.json` = `{"brain": "<abs path>"}`, replacing any existing one (its old value is reported).

```sh
brain init ~/brain --owner "Rodrigo" --set-default --json
```
```json
{ "ok": true, "command": "init", "brain": "/Users/me/brain", "warnings": [],
  "data": {
    "path_abs": "/Users/me/brain",
    "created": [".gitignore", "AGENTS.md", "CLAUDE.md", "brain.json", "index.md", "log/2026-12.md"],
    "skipped": [],
    "git": { "initialized": true, "committed": true },
    "default_config": { "written": true, "path_abs": "/Users/me/.config/ultimate-brain/config.json", "previous": null }
  } }
```

`created` lists every file written, sorted by path, including the `.gitkeep` placeholders of the empty note folders; the example above is shortened.

Errors: `TARGET_NOT_EMPTY`, `ALREADY_A_BRAIN`, `BRAIN_IS_PRODUCT_REPO`, `OUTSIDE_ROOT` (template path escapes, defensive).

### 5.2 `brain status`

```text
brain status
```

Read-only health summary; the first call of every skill.

```json
{ "data": {
    "schema_version": 1,
    "owner": "Rodrigo",
    "notes": { "area": 2, "project": 3, "person": 7, "org": 2, "meeting": 12, "decision": 9, "question": 4, "concept": 1, "source": 12, "view": 6, "goal": 1, "memory": 0, "reference": 1 },
    "proposals": { "pending": 3, "approved": 0, "edited": 0, "rejected": 0, "applied": 14, "closed": 2 },
    "notion": { "configured": ["areas", "goals", "projects", "meetings", "people", "orgs", "decisions", "questions", "review"], "missing": ["key_results", "inbox", "concepts", "documents"], "tasks_database": true },
    "settings": { "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 } },
    "modules": { "knowledge": true, "orgs": true, "documents": true, "reports": true, "tasks": true, "planning": true },
    "unattended": { "catch_up": { "since": "2026-12-01T18:02:00Z", "runs": 4, "inputs": 6, "failed": 1, "failures": ["Notion login"], "left": 0, "skipped": 1, "waiting": 1, "last": "2026-12-03T07:00:00Z" }, "backlog": false },
    "repos": [ { "name": "acme-api", "area": "area-2m7c4h8n", "commit": "", "found": true } ],
    "index_stale": false,
    "views_stale": ["projects/acme-website/brief.md"],
    "last_log": "- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w \"Acme sync\" created=4 proposals=3"
} }
```

`notion.configured`/`missing` list keys of `brain.json` `notion.databases` with non-empty / empty values, among `areas`, `goals`, `key_results`, `projects`, `meetings`, `people`, `orgs`, `decisions`, `questions`, `review`, `inbox`, `concepts`, `documents` (0045, 0049; a `references` key is reported as `documents`). `modules` (0048) has every module key, filled in as schema §12 says: all `true` when the block is absent, else each absent key at its default. `notes` counts every type, `reference` included (0045). A `capture_inbox` key is reported as `inbox` (schema §12). `settings` (schema §12) is added with defaults filled in: `{ "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 } }`. `unattended` (0051) sums the unattended catch-up lines (§3.9) written since the last attended `catch-up` line, across the month files: `since` is that attended line's timestamp (`null` when there is none), `runs` the unattended lines after it, `inputs` and `failed` their sums, `failures` their reasons in order without repeats, and `left`, `skipped`, `waiting` and `last` (its timestamp) from the latest one, since an input still skipped is counted again by every run. `catch_up` is `null` when no unattended line follows the last attended one. `backlog` is `true` when the last three unattended catch-up lines, attended or not in between, each have `left` above 0. The attended catch-up opens with this summary (§6.1). `repos` lists `brain.json` `repos` in order (empty when absent): `found` is whether `path` is a Git working tree. `views_stale` includes area briefs. Exit 0 even when stale.

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

Generates `n` (default 1, max 100) new IDs for `<type>` (schema §1 prefixes; `proposal` allowed). Each is checked against every ID in the brain and against the others in the same call, and re-rolled on collision (0017). IDs are not reserved: use them in the next write.

```json
{ "data": { "type": "decision", "ids": ["dec-3f7k9m2q", "dec-8w1c5t6h"] } }
```

Errors: `USAGE` (unknown type, count out of range).

### 5.5 `brain note new`

```text
brain note new --input <file|-> [--dry-run]
```

Writes **new** notes (lifecycle `draft`, 0003). Used by the ingest skill, by `apply` for `new_item`, and by `sync apply` for Notion-created rows (which keep the lifecycle set in Notion). Never modifies an existing note; changes go through `proposal new`. Types `view` and `proposal` are refused (use `views` and `proposal new`).

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
| `type` | ✔ | any v1 type except `view`, `proposal` |
| `id` | | from `id new`; must match the type's prefix and be unused. Generated if absent |
| `title` | ✔ | |
| `file_date` | | for dated types without `date` (sources) |
| `frontmatter` | ✔ | every other field. Must not contain `id`, `type`, `title`, `created`, `updated`, `lifecycle`, or for sources `content_hash` |
| `body` | ✔ | Markdown; a trailing newline is added if missing |

The CLI sets `created` = `updated` = today, `lifecycle: draft` (knowledge types; a `whole` or `promoted` reference is the exception, see "Documents" below), and for sources `content_hash` (schema §4, over the body as written) and `captured` (default now). Files are laid out as §3.6.5 says. References in `frontmatter` may point to existing notes **or to other notes in the same batch**. The batch is validated as if written: schema, IDs, folder, references, and every lint error rule (§5.10) that concerns the new files. So a new decision whose `decided_in` names an *existing* meeting fails `meeting-backref`: put the meeting in the same batch, or use a `new_item` proposal, whose apply updates the meeting. Any error → `INPUT_INVALID`, with `details` pointing into the input (a reference to a missing note included), and nothing is written.

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
- `origin: promoted` and `promoted_from` doesn't name an existing decision or concept, or another `promoted` Document already names it;
- `promoted_from` is set without `origin: promoted`.

The CLI writes `lifecycle: reviewed` for `origin: whole` (the source's own text needs no Review), the note's current `lifecycle` for `origin: promoted`, and `draft` otherwise. A second `whole` Document of the same source is not written: it is reported in `skipped` with reason `ALREADY_KEPT` and the existing id, like a duplicate source.

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
- sets `before` to the target's current `facts.<field>` for `update_fact` and `contradiction` (absent if the fact is new). If the input gives `before` and it differs → `BEFORE_MISMATCH`;
- for `update_fact` and `contradiction`, sets `from` if absent: the source meeting's `date` when `source` is a `mtg-` id, else `created`;
- for `update_body` (0045), sets `before_hash` to the target's current body hash; `target` must be a `reference` whose `origin` isn't `promoted` (0049) and `content` non-empty and different from the current body (else skipped, `NO_CHANGE`);
- checks per kind: `target` exists (all kinds except `new_item`) and is a knowledge note (not a source, view or proposal, which are immutable, regenerated or records); a `source` that is a note id must exist (`UNKNOWN_ID`); a `new_item` whose `note` is a source already captured is `INPUT_INVALID`; `contradiction` needs a current `facts.<field>`; `supersede` needs `supersedes` to exist, differ from `target`, have the same type, and not already be superseded; `merge` needs `merge_into` to exist, differ from `target`, same type; `add_link` needs `field` to be `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders` and declared by the target's type, and `after` to be an existing note id with the field's prefix (`prj-`, `per-`) for the reference fields or a non-empty string for `aliases` and `tags`; when `after` is already in the list the item is skipped (`ALREADY_LINKED`), so a re-run after approval writes nothing (0028); `new_item` carries `note`, one `note new` input item without `id` (§5.5), which must pass `note new` validation, with a back-reference to an existing meeting allowed because apply adds it (schema §11.2);
- **dedupes:** an item equal to an existing `pending` proposal on (`kind`, `target`, `field`, `after`, `content`, `note`, `supersedes`, `merge_into`) is skipped (`DUPLICATE_PENDING`), so re-running an ingest does not duplicate review rows. For `add_link`, the item's (`field`, `after`) is compared with each entry of a pending `add_link` on the same target (its `links`, or its `field` and `after` if it is an old single one). An `add_link` whose value is already listed is skipped as `{ "input_index": 2, "reason": "ALREADY_LINKED" }` (no `existing`).
- **groups `add_link` items (0037):** after validation and dedupe, the remaining `add_link` items of the input with the same `target` and `source` become **one** proposal, in input order: `links` = their (`field`, `after`) pairs as `{field, value}`, `why` = their distinct `why` texts joined by ` · `. Every new `add_link` proposal is written with `links`, never `field` and `after`, even with a single link. Its `title` is the item's own `title` when the group has one item; for two or more, the CLI writes `<target title>: add <parts>`, where `<parts>` lists each field present, in the order `people`, `projects`, `attendees`, `deciders`, `aliases`, `tags`, as `<n> <noun> (<v1>, <v2>, <v3>, …)` joined by `, `: nouns `person`/`people`, `project`/`projects`, `attendee`/`attendees`, `decider`/`deciders`, `alias`/`aliases`, `tag`/`tags` (singular for 1); values are note titles for reference fields, else the string; at most three values, then `…`; for a single value the parentheses hold just it. Titles longer than 120 characters are cut to 119 and end with `…`. Example: `Acme website: add 2 people (Lucía Fernández, Tomás Vidal), 1 alias (acme site)`.

**`review_notes` (0041, 0043).** Input: `{ "kind": "review_notes", "source": "<id>", "notes": ["dec-…", "que-…"] }`, plus optional `title` and `why`. `source` is the ingest's provenance value, as the other proposals of the ingest carry it: the meeting id for minutes, else the `src-` id. The CLI:
- checks every id in `notes` exists, is a knowledge note and is not listed by another `review_notes` proposal (any status) or twice here (`INPUT_INVALID`, pointer to the entry); at most one `review_notes` per `source` in one input (`INPUT_INVALID`);
- **folds the routine links:** every `add_link` item of the same input with the same `source` becomes an entry `{target, field, value: after}` of this proposal's `links`, in input order, instead of a grouped `add_link` proposal. Each is validated, deduped against pending `add_link` and `review_notes` proposals (`DUPLICATE_PENDING`) and skipped when already linked (`ALREADY_LINKED`) exactly as an `add_link` item; skipped items are reported and not folded. Without a `review_notes` item for their source, `add_link` items are grouped as above;
- **folds the changes (0045):** every `update_fact`, `update_body` and `add_to_note` item of the same input with the same `source` becomes an entry of this proposal's `changes`, instead of a proposal of its own. Each is filled (`before`, `from`, `before_hash`), validated and deduped (`DUPLICATE_PENDING`, against pending proposals of its kind and the `changes` of pending `review_notes`) exactly as a standalone item; skipped items are reported and not folded. The entry keeps the item's `kind`, `target`, `why` and that kind's fields, without `title` or `source`. Entries are stored in render order (schema §11.3): every `update_fact`, then every `update_body`, then every `add_to_note`, each in input order. `contradiction`, `supersede`, `merge`, `new_item` and `answer` items are never folded: they are judgment calls and keep their own rows. Without a `review_notes` item for their source, changes are written as proposals of their own;
- needs at least one entry in `notes`, `links` and `changes` together after folding; with none, the item is skipped (`NOTHING_TO_REVIEW`);
- writes `title`, unless given: `From <source title>: <counts>`. `<counts>` lists, in this order and only when not zero, `<k> changes` (`1 change`), `<n> new notes` (`1 new note`) and `<m> links` (`1 link`), joined by `, ` with ` and ` before the last: `From Acme sync: 1 change, 3 new notes and 2 links`. `<source title>` is the meeting's title for a meeting id, else the source's. Cut to 120 characters as above. `why` defaults to `What came in from <source title>`. A deferred row (§5.7) uses the same counts after `Deferred from <source title>: `.

**`answer` (0041).** Input: `{ "kind": "answer", "target": "que-…", "answer": "<sentence>", "answer_note": "dec-…", "why": "<quote>", "source": "<id>", "title": "…" }`, `answer_note` optional. `target` must be a question (`INPUT_INVALID`); `answer` non-empty; `answer_note`, when given, an existing knowledge note (`UNKNOWN_ID`). A question that already has an `answer` → skipped, `ALREADY_ANSWERED`. Dedupe: a pending `answer` on the same `target` with the same `answer` and `answer_note` → `DUPLICATE_PENDING`.

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

**Stale proposals.** Before applying `update_fact` or `contradiction`, the target's current `facts.<field>` must still equal the proposal's `before` (both absent counts as equal); before applying `update_body`, the target's body hash must still equal `before_hash`. Inside a `review_notes`, a stale change is dropped alone and the rest applies (schema §11.3). If it doesn't, the proposal is **closed**: decision recorded, `status: closed`, `closed_reason: stale`, and the item result is `closed` with reason `STALE_PROPOSAL`. The Review row shows Closed, and the next ingest may propose the change again against the current value.

**`review_notes` results (0041, 0045).** An applied or closed `review_notes` item also returns `notes`: one entry per listed note, `{ "id": "…", "result": "reviewed" | "archived" | "kept_draft" | "unchanged", "lifecycle": "<its lifecycle now>" }`. `unchanged` is a note that was no longer `draft` when the row was applied (you changed its Lifecycle in Notion); it is left as it is. `kept_draft` is an excluded note. An applied one also returns `changes`: one entry per change, `{ "index": 0, "kind": "update_fact", "target": "…", "result": "applied" | "dropped" | "deferred", "reason"?: "STALE_PROPOSAL" }`, and `deferred`: the id of the new row holding the excluded items, when there are any. The skill's report names the `unchanged`, `kept_draft`, dropped and deferred items once, and repeats every fix it applied ("a: launch set to 2027-03").

Other item failures (proposal unchanged):
- `EDIT_NOT_ALLOWED`: `edit` on a kind that forbids it (schema §11.1); `review_notes` is one of them (use `fix`);
- `FIX_UNKNOWN`: a `fixes` entry that names no item of the proposal;
- `UNKNOWN_ID`: proposal or target missing;
- `INVALID_RESULT`: the result would fail schema or lint, e.g. an edited value of the wrong shape;
- `INPUT_INVALID`, `EXCLUDE_UNKNOWN`: an `exclude` that doesn't fit the proposal (above).

Each applied or closed proposal logs `apply <prp-id> "<title>" result=<applied|closed>`.

**Corrections** (0023, refined by 0027). `field` is one of:

| `field` | Effect |
|---|---|
| `facts.<key>` | As `update_fact` with `source: notion-edit` and `from` = `learned` = the date of `observed_at`: accepted entries for the key become `superseded` with `until`; append the accepted entry; set `facts.<key>` |
| `title`, `summary`, `why` | Replace the value. These are not facts, so there is no timeline entry; Git keeps the history |
| `area`, `goal`, `client`, `org` | Set to the given ID (right prefix, must exist), or remove when `value` is `null` |
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
    "summary": { "applied": 1, "closed": 1, "recorded": 0, "corrected": 1, "skipped": 0, "failed": 0 }
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
    "counts": { "area": 1, "project": 1, "person": 2, "org": 1, "meeting": 2, "decision": 2, "question": 1, "concept": 1, "source": 2, "view": 2, "proposal": 2, "memory": 1, "goal": 1, "reference": 0 },
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
  | area, concept, reference | — (a reference's place is in `area` and `projects`, 0045) |

- `backlinks` (schema §6): computed inverses. Keyed by target id (sorted); each list sorted by `type`, then `source`. Built from relation types `about` → `mentioned_in`, `depends_on` → `needed_by`, `contradicts` → `contradicts`, `derived_from` → `used_by`, `related_to` → `related_to`, and from fields `projects` → `project_of`, `area` → `area_of`, `goal` → `goal_of`, `client` → `client_of`, `org` → `member`, `attendees` → `attended`, `decided_in` → `decisions`, `raised_in` → `questions`. The persisted pair `supersedes`/`superseded_by` is not included. Links to missing IDs are left out (lint reports them). Notes with no backlinks have no key.
- `written`: the file was rewritten (only when its bytes change). `stale`: `index.md` is still out of date after the command, so it is `true` only with `--check`.
- Scan warnings: `UNPARSEABLE`, `NOT_A_NOTE` (no frontmatter, or no `id`), `UNREADABLE`, `SKIPPED_SYMLINK` (symbolic links are not followed), `DUPLICATE_ID`. A leading byte-order mark is ignored.

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

Issues are sorted by `path`, `line`, `rule`, then `message`. `line` is 1-based: the line of the offending frontmatter key or body line, or 1 when not locatable. `id` is `null` when the file has no readable id.

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
| `update-body` | error | an `update_body` proposal, or an `update_body` entry of a `review_notes`'s `changes`, whose target isn't a `reference` (0045) or is a `promoted` one (0049) |
| `promoted-from` | error | a Document's `promoted_from` names a note that isn't a decision or concept (a missing id is `missing-ref`; set without `origin: promoted` is `schema`) (0049) |
| `product-file` | error | product-owned content differs from the installed package (§5.15, 0038). One issue per case: a shipped skill's folder missing from `.agents/skills/` or `.claude/skills/` (path = the folder); a shipped file in it missing or with different bytes; a file in it the package doesn't ship; `AGENTS.md` missing, its rules markers missing, out of order or duplicated, or its block differing from the template's (path `AGENTS.md`). Folders the package doesn't ship are not checked. The message names the package version and says: run `brain upgrade`, or file a finding |
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

Connects a consuming repo to the brain (0006, 0009; CX-08). Allowed root: `<repo-path>`; writes only `.brain`, `AGENTS.md`, `CLAUDE.md`, `.agents/skills/brain-query/` and `.claude/skills/brain-query/` there. Refuses if `<repo-path>` is the brain or the product repo, or if any part of either `brain-query` folder is a symbolic link or the wrong file type (`OUTSIDE_ROOT`, before any write).

1. **`.brain`** (JSON, committed with the repo; holds no machine paths):
   ```json
   { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["nextjs", "supabase"] }
   ```
   `repo` = `--repo-name`, else the folder name. `stacks`: lowercase kebab-case, deduped, sorted. If `.brain` exists, options given replace their keys; others are kept. When `--project` is given without `--area`, `area` is set to that project's `area` (replacing any old value). All keys optional; `project`/`area` must exist in the brain. Written as JSON with 2-space indent, keys in the order `repo`, `project`, `area`, `stacks` (absent keys left out), and a trailing newline.
2. **Instruction block** in `AGENTS.md` (created if missing). If `CLAUDE.md` exists and has no line `@AGENTS.md`, the block is also written there; if `CLAUDE.md` does not exist, it is created with the single line `@AGENTS.md`. The block sits between the lines `<!-- ultimate-brain:start -->` and `<!-- ultimate-brain:end -->`; an existing block is replaced in place, otherwise it is appended after one blank line. Nothing outside the markers changes.

Block text (normative; `{…}` filled from the brain; the `- Project:` and `- Area:` lines are left out when `.brain` has no project or area, and the line before them then ends with `.` instead of `:`):

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

How: use the `brain-query` skill, or run `brain query --candidates "<question>" --json` and read the notes it returns. Cite the note paths. Say when a fact is `contested` or `superseded`.

The brain is read-only from this repo. Never edit its files from here.
<!-- ultimate-brain:end -->
```

3. **Skill** (0029, 0038): `.agents/skills/brain-query/` and `.claude/skills/brain-query/` are written from the skills the package ships. They are product-owned: files whose bytes differ are replaced, and files no longer shipped in that folder are removed. Nothing else under `.agents/` or `.claude/` is touched. Every skill file appears in `files` with its `action` (`created`, `updated` or `unchanged`), and a removed stale file appears with `action: "removed"`, e.g. `{ "path": ".agents/skills/brain-query/SKILL.md", "action": "created" }`.

Idempotent: a second run with the same options changes no bytes.

```json
{ "data": {
    "repo_abs": "/Users/me/code/acme-api",
    "marker": { "path": ".brain", "written": true, "value": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["nextjs", "supabase"] } },
    "files": [ { "path": "AGENTS.md", "action": "created" }, { "path": "CLAUDE.md", "action": "created" } ]
} }
```
`action` is one of `created`, `updated`, `unchanged`, and `removed` for a stale skill file. Paths here are relative to the repo.

Errors: `UNKNOWN_ID`, `OUTSIDE_ROOT`, `USAGE` (path missing or not a directory).

### 5.13 `brain query --candidates`

```text
brain query --candidates "<question>" [--limit <n>] [--types <t>[,<t>…]] [--repo <path>]
```

Returns ranked candidate notes for the query skill (CX-11); the skill reads them and writes the answer. `brain query` without `--candidates` is a usage error that points to the `brain-query` skill.

**Ranking (deterministic):**
1. **Tokens:** NFKD, drop combining marks, lowercase, split on runs outside `[a-z0-9]`, drop tokens shorter than 2 and these stopwords: `a an and are as at be by did do does for from has have how in is it of on or that the this to was we what when where which who why will with` and `al como con de del el en es la las lo los para por que se su un una y`.
2. **Searched:** knowledge notes and sources (default `--types`: all except view, proposal, memory).
3. **Score** per note = sum over query tokens of: 5 if in `title` or any alias; 3 if in `summary`; 2 if in any other frontmatter string value (facts and timeline values included); 1 per body line containing it, at most 3. A token matches a word when the word starts with it (`deci` matches `decision`).
4. **Context boost:** if `--repo` (default: the current directory, when it has `.brain`) names a project, +3 to notes whose `projects` contains it or whose id is it; else if it names an area, +2 for that `area`.
5. Notes with score 0 are dropped. Order: score descending, then `updated` descending, then id. Default limit 10, max 50.

```json
{ "data": {
    "query": "what did we decide about auth with Acme",
    "tokens": ["decide", "auth", "acme"],
    "context": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n" },
    "candidates": [
      { "id": "dec-7k2m9q4x", "type": "decision", "title": "Use Supabase for auth", "path": "knowledge/decisions/2026-12-03-use-supabase-for-auth.md",
        "summary": "Acme switches auth from Firebase to Supabase, agreed at the 3 Dec sync.", "lifecycle": "reviewed", "assessment": "accepted", "date": "2026-12-03",
        "score": 17, "snippets": [ { "line": 22, "text": "Use Supabase for auth; Firebase is retired after launch." } ] },
      { "id": "dec-2p9f6h1r", "type": "decision", "title": "Use Firebase for auth", "path": "knowledge/decisions/2026-10-01-use-firebase-for-auth.md",
        "summary": "…", "lifecycle": "archived", "assessment": "superseded", "date": "2026-10-01", "score": 12, "snippets": [] }
    ]
} }
```

`assessment` and `date` are `null` when the type has none. Snippets: up to 3 body lines with a match, trimmed to 200 characters. Superseded notes are returned, not hidden; the skill labels them. Errors: `USAGE`.

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

- `database`: a key of `brain.json` `notion.databases` among `areas`, `goals`, `key_results`, `projects`, `people`, `orgs`, `decisions`, `questions`, `concepts`, `documents`, `review`, `inbox` (`references` is read as `documents`, 0049). Meetings are not a snapshot database. The skill snapshots only the databases of modules that are on (schema §12, 0048). For `inbox`, the skill passes only:
  - the rows whose **Document asked** box is ticked (by the Keep as document button) and that have a Brain ID, with `Document asked`, `Only keep` and `Brain ID` (0049). A ticked row with no Brain ID isn't in the snapshot: the ingest takes it in, with its Only keep, when it is Ready;
  - with Reports on, the Report rows whose **Refresh asked** box is ticked (by the Refresh button; the checkbox was Refresh before migration 0010) or whose **What to fix** isn't empty, with `Refresh asked`, `What to fix` and `Brain ID` (0045). A snapshot from before the migration may carry `Refresh` instead, read the same way.

  Nothing else on an Inbox row is read back (an edit you make to an Inbox row's Summary or relations stays in Notion until the brain's value changes; 0043). For `decisions` and `concepts`, the rows may also carry **Promote asked** (ticked by the Promote to document button, 0049).
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

**Modules (0048).** A row of a database whose module is off is `ignored`, `MODULE_OFF`, whatever it holds: no create, update, correction or request. So is a Report row while Reports is off.

**Rows with empty `Brain ID`:** first, a note whose `notion` equals the row's `page_id` is that row's note (a create whose publish failed); the row is then treated as if it had that Brain ID, and the next render writes the Brain ID. Otherwise:
- In `areas`, `goals`, `projects`, `people`, `orgs` → a `create` item (0021): a `note new` input with a pre-generated id and:
  - `title` = Name; `summary` = Summary, or Name if empty; `lifecycle` from Lifecycle (default `draft`);
  - `notion` = page id; `sources: ["notion:<page_id>"]`;
  - brain-owned properties mapped as in the table below, relations resolved to brain ids (other rows created in the same plan count);
  - for each fact set this way, one timeline entry `{field, value, from: <date of last_edited>, learned: <date of as_of>, source: "notion:<page_id>", assessment: accepted}`;
  - `notion_fields` from the Notion-owned properties, and `notion_published` = the row's brain-owned values (the baseline).

  A required field that cannot be filled (goal without Why or Area, project without Area) → conflict `MISSING_REQUIRED` instead.
- In `decisions`, `questions`, `concepts`, `documents`, `review` → `ignored`, `NOT_CREATED_IN_NOTION` (those rows are created by the brain only).
- `key_results` rows never have a Brain ID; see below.

**Rows with a `Brain ID`:**
- No such note → conflict `UNKNOWN_BRAIN_ID`. The note's `notion` differs from `page_id` → conflict `NOTION_ID_MISMATCH`. The note has no `notion` → `updates` sets it.
- **Notion-owned** properties → the type's `notion_fields` (table below), plus `as_of`. If any value differs from the stored snapshot (ignoring `as_of`) → an `updates` item with the full new `notion_fields`. Notion is the authority; no three-way comparison.
- **Lifecycle** (yours; agents also set `draft` and `archived`) → three-way comparison; "your correction" here is an `updates` item that sets `lifecycle`.
- **Brain-owned** properties → three-way comparison; "your correction" is a `corrections` item when the property is correctable (table below), otherwise `ignored`, `NOT_CORRECTABLE`. For Key Facts, the comparison runs **per key** on the parsed texts (N, S and B each parsed as §5.14.4 says), so a change to one key never conflicts with a change to another; each key is reported as `property: "Key Facts/<key>"`. A key in S that is missing from N → `ignored`, `FACT_REMOVAL_NOT_SUPPORTED`. A Name, Summary or Lifecycle emptied in Notion → conflict `REQUIRED_EMPTY`; a Lifecycle option the brain does not know → `ignored`, `UNKNOWN_OPTION`. Lifecycle is compared case-insensitively (Notion shows `Draft`, the brain stores `draft`).
- **Review rows** with **Your call** set and `State` = `Pending` (0045; a snapshot taken before migration 0009 has `Decision` and `Note` instead, read the same way, and the option **Edit** is read as **Fix**, so decisions made before the migration are never lost. Only reading is compatible: render sends the 0.5.0 names, see §5.14.4). The snapshot properties are `Your call` (select) and `What to fix` (text). A proposal already terminal is checked first (below), so a row whose What to fix the skill has handled never comes back:
  - **Approve** or **Reject** with an empty What to fix → a `decisions` item for `brain apply`: `action`, `decided_at` = `last_edited`, `decided_by: notion`.
  - **Approve** or **Reject** with What to fix → conflict `NOTE_TO_READ` on `What to fix`, with `notion_value` = the text and `brain_value` = the label. No decision item: the skill reads the text and passes `brain apply` the decision it means (with `note`, and `exclude` for "all except …"), or asks the user.
  - **Fix** with What to fix → conflict `FIX_TO_READ` on `What to fix`, the same way: the skill reads the text and passes `brain apply` an `action: fix` decision with `note` and `fixes` (schema §11.3), naming items by the row's letters (§5.14.4). The plan never guesses what the text means.
  - **Fix** with an empty What to fix → conflict `FIX_WITHOUT_TEXT`.
  - A proposal already terminal → `ignored`, `ALREADY_TERMINAL`.
- **Inbox** rows (0049): a row with `Document asked` = true and a Brain ID naming a source (any kind but `minutes`) → a `document_requests` item `{ "page_id": "…", "source": "src-…", "files": ["src-…"], "only_keep": "…" | null }`. `source` is the latest version of that source (following `replaces` forward, schema §4); `files` is the sources attached to it (`attached_to` = it), sorted by id, possibly empty: when it isn't, the Document is made from each file, not from the capture's text. `only_keep` is the row's Only keep, `null` when empty. With `only_keep` null and a `whole` Document of each source in question already there, the item carries `"existing": ["ref-…"]`: nothing is left to write, and the skill only clears the box. A Brain ID naming no note → conflict `UNKNOWN_BRAIN_ID`; one naming a report, any other note that isn't a source, or minutes → `ignored`, `NOT_A_SOURCE`; a ticked row with no Brain ID (not taken in yet, so not meant for the snapshot) → `ignored`, `NOT_INGESTED`; with Documents off, a ticked box → `ignored`, `MODULE_OFF`, `property: "Document asked"`. A `Full text` property in a snapshot (a skill from before 0.6.0) → `ignored`, `RETIRED`.
- **Promote asked** on `decisions` and `concepts` rows (0049): `Promote asked` = true → a `promote_requests` item `{ "page_id": "…", "note": "dec-…" }`, or `{ …, "existing": "ref-…" }` when a `promoted` Document of that note already exists (the skill only clears the box). Promote asked is never compared or corrected; false means nothing. With Documents off, a ticked Promote asked → `ignored`, `MODULE_OFF`, `property: "Promote asked"`, and the rest of the row is planned as usual.
- **Clearing the boxes (0048).** `sync render` never sends Document asked or Promote asked: once the skill has acted on a request (or found it already done, `existing`), it unticks the box through the MCP, and for an Inbox row also sets Brain Status back to Done. A request the run skipped keeps its box ticked, so the next catch-up sees it again. **Report rows** (0045, Brain ID a `vw-` report): Refresh asked (or `Refresh`) = true → a `refresh_requests` item `{ "page_id": "…", "report": "vw-…" }`; a non-empty What to fix whose text isn't the `text` of the report's last `fixes` entry → a `report_fixes` item `{ "page_id": "…", "report": "vw-…", "text": "…" }`. The skill refreshes the report (§5.18) and turns each fix into proposals. A Report row with no Brain ID (an unattended run's report, §6.1) holds no report: a ticked Refresh asked or a What to fix on it → `ignored`, `NOT_A_REPORT`, with the property. Every other Inbox property is ignored.
- **Key Results** rows are grouped by their `Goal` relation into the goal's `notion_fields.key_results` (sorted by name, then page id) and compared like other Notion-owned fields. A Key Result whose goal the brain does not know → `ignored`, `UNKNOWN_GOAL`.

**Property ownership per database** (schema §14). Name and Summary are brain-owned everywhere; Brain ID and Last Synced are system:

| Database | Notion-owned → `notion_fields` | Correctable brain-owned → correction `field` |
|---|---|---|
| areas | Type → `type`, Archived → `archived` | Name → `title`, Summary → `summary` |
| goals | Status → `status`, Progress → `progress`, Archived → `archived`, Key Results → `key_results` | Name, Summary, Why → `why`, Deadline → `facts.deadline`, Area → `area` |
| projects | Status → `status`, Priority → `priority`, Dates → `dates`, Archived → `archived` | Name, Summary, Key Facts → `facts.<key>` (§5.14.4), Area → `area`, Goal → `goal`, Client (first) → `client`, People → `people` |
| people | Email → `email` | Name, Summary, Role → `facts.role`, Org (first) → `org` |
| orgs | Relationship → `relationship`, Website → `website` | Name, Summary |
| decisions | — | Name, Summary |
| questions | Status → `status` | Name, Summary |
| concepts | — | Name, Summary |
| documents | — | Name, Summary |

Other brain-owned properties (Assessment, Supersedes, Decided In, Raised In, Kind, Project on Decisions, Questions and Concepts, the derived Area on Decisions and Questions (0034), Area on Concepts) are not correctable in v1 (decision 0027): a change you make there is `ignored`, `NOT_CORRECTABLE`, so the skill can tell you to use a proposal instead.

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

#### 5.14.3 `brain sync apply`

```text
brain sync apply --input <plan|-> [--record-only] [--skip-conflicted] [--dry-run]
```

**`--skip-conflicted`** (0051, the unattended catch-up, §6.1) skips a conflicted row whole: an item belongs to a row with a conflict in the plan when its note id (`create` `id`, `updates` `id`, `corrections` `target`, `decisions` `proposal`) equals a conflict's `brain_id`, or its page id (`create` `frontmatter.notion`) equals a conflict's `page_id`. Such an item is not executed: its result is `skipped`, reason `ROW_CONFLICTED`, and a `create` whose relations point at a skipped create is skipped the same way. Without the flag, a conflict blocks only its own property, as before.

With `--record-only` (a run that must not apply at all, 0003; an unattended catch-up runs without it, 0051), only additions run: `create`, `updates` and recording `decisions` (as `apply --record-only`); `corrections` are skipped and reported.

Executes a plan from `sync plan`, in this order:
1. **`create`**, per item with the `note new` rules (except that `lifecycle` comes from the item). An item whose relations point at a create that failed also fails (`DEPENDENCY_FAILED`). Logs `sync-create`.
2. **`updates`**: sets `notion`, `lifecycle`, `notion_fields` and the listed S values. Logs `sync-update`.
3. **`corrections`**, then **`decisions`**, with the `brain apply` rules. After a correction succeeds, S for its `property` is set to the Notion value, since Notion already shows it.

`sync apply` never writes `last_synced` (only `sync record` does). `conflicts` and `ignored` are not executed; they are echoed for the skill to report.

Preconditions are re-checked (the brain may have changed since the plan): a create id now in use, or an update or correction target now missing → that item `failed`. `data` = `{ "create": […], "updates": […], "corrections": […], "decisions": […], "conflicts": […], "ignored": […], "summary": {…} }`, each executed item with `result` and `changed` as in `apply`. Exit 1 if any item `failed`.

#### 5.14.4 `brain sync render`

```text
brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json> [--skip-conflicted]]
```

Builds Notion payloads; writes nothing. With `--plan`, every property named by a `BOTH_CHANGED` conflict in that plan is held back (left out of `properties` and of `published`) until the skill has your answer; the skill passes the plan of the same run. With `--skip-conflicted` as well (it needs `--plan`: alone → `USAGE`; 0051, the unattended catch-up, §6.1), a conflicted row is held back whole: no item is rendered for a note whose id is a conflict's `brain_id` in the plan, or whose `notion` page id is a conflict's `page_id`; it is listed in `skipped` with reason `ROW_CONFLICTED`. A report named by a `report_fixes` item in the plan (its `report` id) is held back the same way, with reason `FIX_WAITING`: rendering it could clear a What to fix nobody has read yet (the Reports rule below clears What to fix and Refresh asked against the published baseline), for instance after an earlier publish failed and the user then wrote a new fix. Since `sync record` records only items it is given, a held-back note stays changed, and the next render after the conflict or the fix is handled (an attended run) publishes it. Relations from other items to a held-back note that has no page yet are pending, as for any unpublished note. The skill sends them through the MCP, then passes each item's `published` back to `sync record`.

**`--changed`** selects:
- notes of a published type (area, goal, project, person, org, decision, question, concept, reference) with no `notion`, unless its module is off (schema §12, 0048: goals with Planning, orgs with Orgs, decisions, questions and concepts with Knowledge, references with Documents);
- sources of every kind except `minutes` with no `notion` (0037: the Inbox). On the first run after the upgrade to 0.3.0 this selects every such source already in the brain, so the Inbox History fills with no migration;
- notes, meetings and sources (with `notion`) where any rendered property's B differs from S, or the page content changed (B of `@content` ≠ S);
- proposals with no `notion`, or whose State (or another rendered property) differs from S;
- with Reports on, reports (views with `view_kind: report`) with no `notion`, and published reports whose body, `fixes` count or `asked_in` changed since S (0043, 0045);
- published proposals that are `applied` or `closed`, decided more than 30 days before `--now`, and not yet trashed (0045; see **Leaving Review** below).

A source with `attached_to` is never selected: it has no Inbox row (0042). Notes whose database id is empty in `brain.json` are skipped with warning `DATABASE_NOT_CONFIGURED`. `--ids` naming a note whose module is off → item error `MODULE_OFF`.

**Relations to a module that is off** (0048) are left out of `properties`, `published` and `pending_relations` alike, as if the property didn't exist: Client on Projects and Org on People with Orgs off; Goal on Projects with Planning off; Decisions, Questions and Concepts on the Inbox, and Decisions and Questions on Meetings, with Knowledge off; Documents on the Inbox with Documents off. S keeps what was last sent, so turning the module on again sends only what changed. `sync plan` doesn't compare these properties either (§5.14.2).

**Rendered properties per database** (exactly these; nothing else is ever sent):

| Database | Properties |
|---|---|
| areas | Name, Summary, Lifecycle, Brain ID, Last Synced; `sections` "Brief" (0041) |
| goals | Name, Summary, Why, Deadline, Area, Lifecycle, Brain ID, Last Synced |
| projects | Name, Summary, Key Facts, Area, Goal, Client, People, Lifecycle, Brain ID, Last Synced |
| people | Name, Summary, Role, Org, Lifecycle, Brain ID, Last Synced |
| orgs | Name, Summary, Lifecycle, Brain ID, Last Synced |
| decisions | Name, Summary, Date, Assessment, Project, Area, Decided In, Supersedes, Lifecycle, Brain ID, Last Synced |
| questions | Name, Summary, Kind, Project, Area, Raised In, Lifecycle, Brain ID, Last Synced, Status *(Open or Answered, once)* |
| concepts | Name, Summary, Project, Area, Lifecycle, Brain ID, Last Synced |
| documents | Name, Summary, Project, Area, From decision, From concept, Lifecycle, Brain ID, Last Synced (0045, 0049) |
| meetings | Decisions, Questions, Attendees *(add)*, Project *(if empty)*, Area *(if empty)*, Brain Status, Ingested At, Brain ID |
| review | Name, Kind, About, About Page, Now, Proposed, Why, Source Meeting, Area (0050), State, Brain ID (Target, Target Page, Before, After before 0.5.0; 0045). Render always sends the 0.5.0 names: it doesn't read the space's schema, so a space not yet migrated (migration 0009) rejects the write. Migration 0009 therefore runs before the first publish on 0.5.0; `brain upgrade` names it, and the publish's error report names the missing property |
| inbox | Name *(create only)*, Kind *(if empty)*, Summary, Decisions, Questions, Concepts, Documents, People, Project *(if empty)*, Area *(if empty)*, Brain Status, Brain ID, Last Synced; a report: Name, Kind, Project, Area, Ask, Brain Status, Brain ID, Last Synced, Refresh asked *(clear)*, What to fix *(clear)* |

- On `create`, every listed property is sent. On `update`, only properties whose B ≠ S are sent, plus Last Synced (= `--now`) for the databases that have it (not Meetings or Review). So Lifecycle goes out on create (`Draft`) and when the brain changed it (`archived` by a supersession), and your own Lifecycle edits, already pulled into the brain, are never overwritten.
- Project relations carry every id in `projects`.
- **Area on Decisions and Questions** (0034) is derived, never stored in the note: the `area` of each note in the record's `projects`, deduped and sorted. No projects, or projects without an area → empty. It is brain-owned and compared like any other property, so the first render after the upgrade sends it to every decision and question once.
- **Concepts:** Project = `projects`, Area = `area`; the body is the whole page body, as for decisions.
- **Documents (0045, 0049):** as concepts: Project = `projects`, Area = `area`; the body is the whole page body. From decision / From concept = `promoted_from`'s page, by its prefix, on a `promoted` Document (the other one empty); Notion fills Decisions · Documents and Concepts · Documents. A `promoted` Document's body is sent on `create` only: on `update`, `body` is `null` and `@content` isn't compared, because the body is yours from then on.
- **Question Status (0041, 0045):** Status stays Notion-owned for `sync plan` (§5.14.2); the brain sends it in two cases only, each once:
  - **Open:** when the question has no `answer`, S has no `Status` and its snapshot has no `notion_fields.status`, B of `Status` is `Open`. So a new question is created as Open, and a question published before 0.4.1 with Status empty in Notion gets Open on the next publish. Once S holds it, it is never sent again; a Status you set (pulled into `notion_fields.status`) is never overwritten.
  - **Answered:** when the question has `answer`, B of `Status` is `Answered`; it is sent only while S has no `Status` of `Answered`, so it goes out once, right after the `answer` proposal is applied.

  If you reopen the question in Notion, the brain never sets it back.
- **Areas (0041):** `sections` = `{ "Brief": <the area brief's generated block> }`. The skill replaces the children of the area page's "Brief" toggle heading; a page without one gets a "Brief" toggle heading appended at the **end** of the page, then filled (the page is yours, so the brain never inserts above your content).
- **Inbox** (0037; sources, every kind except `minutes`):
  - `action`: `update` when the source has `notion`, or is a `capture` (page id = the id in its `notion:` key: the row you created; a capture's key is always `notion:`, schema §4); otherwise `create`. A capture whose `notion` differs from its key's id → item error `NOTION_ID_MISMATCH`.
  - Name = `title`, sent on `create` only: a capture's Name is yours. Kind = the source `kind` as a select label (`Capture`, `File` for `document` (0049), `Email`, `Chat`, `Note`), with `"mode": "if_empty"`: the skill writes it only when Kind is empty in Notion, so a Kind you chose stands (0048). An S of `Document` compares equal to `File`, so rows published before aren't sent again. Summary = `summary` (empty when the source has none).
  - Decisions, Questions, Concepts, Documents, People = every note of that type whose `sources` lists the source's id, sorted; notes not yet published go to `pending_relations`. Documents is the property called References before migration 0010; `promoted` Documents aren't listed, since they come from a note, not the source. When `documents` is empty in `brain.json`, Documents is left out entirely, from `properties` and from `pending_relations`; the reference notes themselves are skipped with `DATABASE_NOT_CONFIGURED`. These are the "Produced" relations; the other side of each is that database's Sources relation, which Notion fills.
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
- **Reports** (0043, 0045): `action` is `create` with no `notion`, else `update`. Name = `title`; Kind = `Report`; Project = `projects`, Area = `area` (plain relations, not *if empty*); Ask = `asked_in` as a list (one id or several), a relation to your Ask rows, whose other side (Report) Notion fills; Brain Status = `Done` (`Processed` before 0.6.0, compared as above); Brain ID = the view's id. `body` = the report body, rendered as other bodies; on `update`, sent only when B of `@content` ≠ S (a refresh), and then `properties` also has `"Refresh asked": { "type": "checkbox", "value": false }`. Render always sends the 0.6.0 name: a space not yet migrated (migration 0010, which renames Refresh to Refresh asked) rejects the write, so migration 0010 runs before the first publish on 0.6.0, as 0009 did for 0.5.0. When the number of `fixes` entries is above S's `@fixes`, `properties` has `"What to fix": { "type": "rich_text", "value": null }`, which clears the field, and `published` carries `@fixes` = that number. The skill sets each Ask row's own Brain Status to Done through the MCP; nothing else on it changes.
- **Review** (proposals; property names from 0.5.0, 0045): Name = `title`, prefixed `Conflict: ` for `contradiction`, `supersede`, `merge` and `new_item`, and `Answer: ` for `answer`, unless the title already starts with it (0048: the Name says which of the three kinds of row it is; `review_notes` titles start with `From ` or `Deferred from `). Area = one page (0050): the area of the proposal's `source` note (a meeting's or source's own `area`, else the `area` of the first id in its `projects`), else empty, also when `source` isn't a note id. It is brain-owned and compared like any other property, so the first render after the upgrade sends it, and the prefixed Name, to every Review row still in Notion once; Kind; About = `<target title> (<target id>)`; About Page = the target's Notion URL if published; Now and Proposed (for `supersede`: old and new note title; `merge`: duplicate and survivor title; `add_to_note`: Proposed = `content`; `update_body`: Now empty, Proposed = the changed lines of the body as `- <old line>` and `+ <new line>`, in body order (§5.19's diff without context lines); `add_link`: Now empty, Proposed = one line per entry of `links` (or the old single `field`/`after`), `<Field>: <value>` with a note id rendered as its title, joined by `\n`, e.g. `People: Lucía Fernández\nPeople: Tomás Vidal\nAliases: acme site`; `new_item`: Proposed = the note's title and type; `answer`: Now empty, Proposed = `answer`, plus ` → <answer_note title>` when set; `review_notes`: see below), cut to 2000 characters; Why; Source Meeting = relation when `source` is a published meeting; State.
- **Review notes rows** (0041, 0043, 0045): About = `<source title> (<source id>)`, with `<source title>` as in the proposal title rule (§5.6), and About Page = that meeting's or Inbox row's URL if published. Now is empty. Proposed is one line per item, **lettered** in the order of schema §11.3: `a`, `b`, … `z`, then `aa`, `ab`, …:
  - every entry of `changes`, as stored: an `update_fact` as `<letter>) ⚠ <Field> on <target title>: <before> → <after>` (`a) ⚠ Launch date on Acme website: 2027-01 → 2027-02`; with no `before`, `(new) → <after>`); an `update_body` as `<letter>) ⚠ <target title>: <n> lines changed` (`b) ⚠ Acme website: requirements: 2 lines changed`); an `add_to_note` as `<letter>) Add to <target title>: <first line of content, cut to 80 characters>`;
  - every entry of `notes` as `<letter>) <Type>: <title>` (`c) Decision: Use Supabase for auth`);
  - every entry of `links` as `<letter>) <Field> on <target title>: <value>` (`e) People on Acme website: Lucía Fernández`), with a note id rendered as its title.

  `<Field>` is the key with `_` → space and the first letter capitalized. The letters are the ones you name in What to fix ("all except b, e", "a: March"); the skill maps them back to `exclude` and `fixes` entries in this order.
- **Leaving Review (0045):** a proposal with `notion` whose `status` is `applied` or `closed`, and whose `decision.decided_at` (else `updated`) is more than 30 days before `--now`, renders as an item with `action: "trash"`, `page_id` = its `notion`, empty `properties`, `body` and `sections` `null`, and `published` = `{ "@trashed": <--now> }`. The skill moves that page to Notion's trash through the MCP, then records it. A proposal whose `notion_published` has `@trashed` is never rendered again, with `--changed` or `--ids`. The proposal file stays in Git with its `notion` id.
- References to notes not yet published are left out of `properties` and listed in `pending_relations` (`[{ "property": "Org", "ids": ["org-…"] }]`). The skill publishes those notes first, records them, and renders again.

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

- `action`: `create` when the note has no `notion`, else `update`; `trash` for a Review row leaving Notion (above). Meetings are always `update`; a meeting without `notion` → item error `MEETING_NOT_PUBLISHED`. Projects are always `update` too: a project without `notion` → item error `PROJECT_NOT_IN_NOTION`, because a project page must come from the Projects template (its views and "My notes"), which the API can't apply. The user creates it with **New project** in Notion, and the next `sync plan` imports it (0021).
- `published`: B for every rendered property except Last Synced and pending relations, plus `@content` = `sha256:<hex>` of the rendered `body`/`sections` when the type has content (for a source, of `body` only; its Full text is tracked by `@full_text`). This is the new S once the write succeeds.
- **Page content** (decision 0026): the brain writes only what it owns.
  - `body` (decisions, questions, concepts, references): replaces the whole page body (a `promoted` reference: on create only).
  - `sections` (projects): `{ "Brief": <the brief's generated block>, "Decision log": <the decision log's generated block> }`. The skill replaces only the children of the toggle heading with that exact name. `render` can't see Notion page content, so finding the toggle is the skill's job, after it reads the page through the MCP (0033): a page with **no toggle headings at all** gets the missing "Brief" and "Decision log" toggles appended and filled; a page with other toggle headings but not the named one is reported as `SECTION_NOT_FOUND` and left as it is.
  - `sections` (areas, 0041): `{ "Brief": … }`, as above.
  - `body` (sources other than captures, 0043; reports): as above. No `sections` on a source: Full text is retired (0049).
  - Goals, people, orgs, meetings, captures and proposals: `body` and `sections` are both `null`.
  - Rendering: `^[inferred]` → ` (AI inference)`, `^[ambiguous]` → ` (ambiguous)`, and relative links to published notes become `https://www.notion.so/<page id without dashes>` (unpublished → plain title text).

`data` = `{ "items": […], "errors": [ { "id": "…", "reason": "MEETING_NOT_PUBLISHED" } ], "skipped": [ { "id": "…", "reason": "ROW_CONFLICTED" | "FIX_WAITING" } ] }` (`skipped` is empty without `--skip-conflicted`), items sorted by database (table order), then id. Exit 1 if `errors` is non-empty (the other items are still returned); `UNKNOWN_ID` for `--ids` is a whole-command error.

**Key Facts text** (projects, rendered here and parsed back by `sync plan`): one segment per `facts` key, sorted by key, joined by ` · `. Segment = `<Label>: <value>`; label = the key with `_` → space and the first letter uppercased; a person-id value renders as the person's title. Parse: split on ` · `, then on the first `: `; label → key by lowercasing and space → `_`; a person title (or alias) maps back to its id (ambiguous → conflict `AMBIGUOUS_PERSON`). Values containing ` · ` are not supported in v1. Example: `Budget: 80000 EUR · Launch date: 2027-02 · Owner: Maria López`.

#### 5.14.5 `brain sync tasks`

```text
brain sync tasks (--meeting <mtg-id> | --source <src-id>) --input <file|->
```

Renders Notion task payloads for a meeting's action items, or for the **owner's** action items in any other source (`--source`, 0037), using the `brain.json` Tasks mapping (0018, schema §12); writes nothing. Exactly one of `--meeting` and `--source` (`USAGE` otherwise).

Input: `{ "items": [ { "title": "Send Supabase migration plan", "owner": "Carlos Ruiz", "due": "2026-12-10", "projects": ["prj-9x4t1b7e"] } ] }` (`owner`, `due`, `projects` optional).

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

Who the item is for and its due date are the skill's judgment: only action items addressed to the owner become tasks, and `due` only when the text gives one (0037).

**No dedupe here, for either form.** `sync tasks` renders exactly the items it is given, every time; it never compares them with the note's `tasks`. Tasks are created once, in the run that ingests the meeting or source: a second ingest of the same input is skipped as `DUPLICATE_SOURCE` (§5.5) before any action item is extracted, so there is no rerun to dedupe. Within that run, the skill creates each rendered item once and records the page ids it created (§5.14.6); an item held back by `pending_relations` is rendered again with only the held-back items, as above. The note's `tasks` is a record of page ids (appended, deduped by id), not a dedupe key.

With Tasks off (schema §12, 0048), the command refuses with `MODULE_OFF` before reading its input.

Errors: `MODULE_OFF`, `UNKNOWN_ID` (the meeting or source, or an item's project id), `INPUT_INVALID` (an item's `projects` entry that isn't a string or isn't a project; `--source` naming a `minutes` source or a note that isn't a source), `BRAIN_CONFIG_INVALID` (no Tasks database, or `brain.json` fails its schema, which requires a title mapping and a backlink mapping once a Tasks database is set).

#### 5.14.6 `brain sync record`

```text
brain sync record --input <file|->
```

Stores what the skill published. Input: `{ "records": [ { "id": "per-3h8w2n6c", "notion": "6a7b…", "synced_at": "2026-12-05T09:01:10Z", "published": { … }, "tasks": ["…"] } ] }`.

- `notion`: set if absent; if present and different → item `failed`, `NOTION_ID_MISMATCH`.
- `published` (the render item's `published`): merged into `notion_published`, key by key.
- `synced_at` → `last_synced` (knowledge notes and sources), the time of the last publish.
- `tasks` (meetings and sources): appended to the note's `tasks`, deduped, order kept.
- A source record changes only these system fields (schema §4: its body and content fields stay as captured). `@full_text` is merged like any other key.
- A report record (0043) sets the view's `notion`, `last_synced` and `notion_published`; nothing else. It is the only write to a report besides `report new` and `report fix` (§5.18).
- A trash record (0045) is a proposal record whose `published` is `{ "@trashed": … }`: it is merged into `notion_published` like any other, so the row is never rendered again.
- Does not change `updated`; does not log (the skill logs `publish`).

`data` = `{ "records": [ { "id": "…", "result": "recorded"|"failed", "reason"?: "…", "changed": ["…"] } ] }`. Exit 1 if any failed.


### 5.15 `brain upgrade`

```text
brain upgrade [--dry-run]
```

Brings the product-owned files of an existing brain up to the installed version of the package (dogfood finding 22), then commits and pushes them (0038). It never touches notes, generated files, anything the user wrote, or the log beyond appending its own `upgrade` line (step 6), and changes `brain.json` only to rename a retired key and to write the `modules` block (step 5).

**The installed package** (also used by lint rule `product-file`, §5.10) is the one the running CLI belongs to, never one found on `PATH` or in the brain:
- **Root:** start from the real path (symbolic links resolved) of the running entry module and walk up to the first folder holding a `package.json` whose `name` is `ultimate-brain`. This is the same for a global install, `npx`, the compiled `dist/` entry and a source checkout.
- **Version:** that `package.json`'s `version`.
- **Shipped files:** the skills are the folders in `<root>/.agents/skills/` that hold a `SKILL.md` (`README.md` at its top level is not a skill); the rules block comes from `<root>/templates/brain/AGENTS.md`.
- **Not found** (no such `package.json`, or the skills folder or template missing or unreadable) is a broken install:
  - `brain upgrade` fails with `INTERNAL` (exit 10) before any write.
  - `brain lint` completes: it reports exactly one `product-file` error (path `AGENTS.md`, message `installed package not found: <reason>`), checks nothing else for that rule, runs every other rule as usual, and exits 1.
- **Source checkout:** the root contains `src/cli.ts`.

**Before anything is written:**
- **Published package only.** If the installed package is a source checkout (including `npm link`), refuse with `UNRELEASED_BUILD`. Prereleases (`0.3.0-rc.1`) are published packages and are allowed.
- **Clean brain.** If the brain is a Git repository and `git status --porcelain` prints anything, refuse with `BRAIN_DIRTY`. `--dry-run` skips this check and reports `dirty: true` instead.
- The safety checks below.

**Writes:**
1. **`AGENTS.md` rules block.** Replace everything from the line `<!-- ultimate-brain:rules:start … -->` through `<!-- ultimate-brain:rules:end -->` with the same block from `templates/brain/AGENTS.md`. Text outside the markers is kept byte for byte.
   - `AGENTS.md` missing → written from the template (`created`).
   - Markers missing, out of order or duplicated → the file is left alone (`skipped`) with warning `AGENTS_BLOCK_NOT_FOUND`; the user restores the markers or merges by hand.
2. **`CLAUDE.md`:** written as `@AGENTS.md` only if missing. One that exists in any form (a file, or a link to `AGENTS.md`) is left alone.
3. **Skills (0029, 0038).** For each skill the package ships in `.agents/skills/<name>/`, in **both** `.agents/skills/<name>/` (Codex) and `.claude/skills/<name>/` (Claude Code):
   - write every shipped file whose content differs (`created` or `updated`);
   - remove files inside that skill's folder that the package no longer ships (`removed`).

   Folders in `.agents/skills/` or `.claude/skills/` that the package does not ship are the user's own and are left alone.
4. **Retired plugin (0038).** If `.claude/settings.json` exists, remove the key `ultimate-brain@ultimate-brain` from `enabledPlugins` and the key `ultimate-brain` from `extraKnownMarketplaces`; an object left empty is removed. Other keys are kept in order, and the file is written as JSON with 2-space indent and a trailing newline (`updated`). A file left as `{}` is deleted (`removed`). A file that is not valid JSON is left alone (`skipped`) with warning `SETTINGS_UNPARSEABLE`. Nothing to remove → no change.
5. **Renamed `brain.json` keys (0037).** If `notion.databases` has `capture_inbox`: when `inbox` is absent or empty, rename the key to `inbox` in place (same position, same value, an empty `inbox` removed); when `inbox` already holds an id, just remove `capture_inbox`. Every other key and value is kept in order, and the file is written as JSON with 2-space indent and a trailing newline (`updated`). A `brain.json` that is not valid JSON is left alone (`skipped`) with warning `BRAIN_JSON_UNPARSEABLE`. No `capture_inbox` → no change. The same rule renames `references` to `documents` (0049). Then, if `brain.json` has no `modules` block, it is added after `settings` (or after `budgets` when there is no `settings`) with every key `true`, so a brain made before 0.6.0 keeps every module on (schema §12, 0048).
6. Log `- <timestamp> upgrade - "<package version>" files=<n>` when anything changed. `--dry-run` writes and logs nothing and reports the same `files`.
7. **Lint** the brain (§5.10) and report the counts in `lint`. Lint findings never stop the upgrade: it only wrote product-owned files. With `--dry-run`, lint reads the **planned** tree: every `created`, `updated` or `removed` file as the upgrade would leave it, everything else (including `skipped` files) as it is on disk. So a dry run reports what would remain after the upgrade: `product-file` is silent for drift the upgrade repairs, and still reports an `AGENTS.md` left `skipped` for missing markers.
8. **Commit and push**, when anything changed and the brain is a Git repository: stage exactly the paths in `files` whose `action` is `created`, `updated` or `removed`, plus the log file step 6 appended to (`log/<YYYY-MM>.md`). Never stage a `skipped` path or anything else in the working tree. Commit `upgrade: ultimate brain <version>`, then `git push` if the current branch has an upstream. No upstream → warning `PUSH_SKIPPED`. A push that fails → warning `PUSH_FAILED` with Git's message; the commit stays, and the exit code is still 0. A failed commit (no identity) → warning `GIT_COMMIT_SKIPPED`, files kept. Not a Git repository → no commit, no warning.

The skill a linked repo carries (`brain-query`, §5.12) is refreshed by running `brain link` there again.

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
    "lint": { "errors": 0, "warnings": 2 },
    "commit": "2c2d653",
    "pushed": true
  } }
```

`files` lists only the files created, updated, removed or skipped, sorted by path; `unchanged` counts the rest. `commit` is the short hash, or `null` when nothing was committed; `pushed` is `false` unless a push succeeded. `--dry-run` adds `dirty` and reports `commit: null`, `pushed: false`.

**Safety:** all checks run before the first write. `AGENTS.md`, `.agents`, `.agents/skills`, `.claude`, `.claude/skills`, `.claude/settings.json`, a shipped skill's folder, or any file in it that is a symbolic link, or a file where a folder belongs → `OUTSIDE_ROOT`, and nothing is written or removed. `brain link` checks both `brain-query` folders the same way (§5.12).

Errors: `UNRELEASED_BUILD`, `BRAIN_DIRTY`, `OUTSIDE_ROOT`, and the brain resolution errors (§4).

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

**`report fix`** (0045) records a What to fix the user wrote on a Report row: it appends `{text, received: now, proposals}` to the report's `fixes`, where `proposals` are the ids the skill wrote for it with `proposal new` (they must exist; `UNKNOWN_ID`). An empty `--proposals` value is allowed when the text needs no change to the notes (the skill says why in its report). The next render clears the row's What to fix. Once every listed proposal is terminal, the skill refreshes the report. Logs `report-fix <id> "<title>"`. `data` = `{ "id": "vw-…", "fixes": <count> }`.

### 5.19 `brain source diff` (0045)

```text
brain source diff <src-id>
```

Read-only. For a source with `replaces`, the line diff of its body against the body of the source it replaces, with no context lines. It is deterministic:
1. Both bodies are split into lines on `\n` after turning `\r\n` into `\n`; old = the replaced source's lines `o[0..m)`, new = this source's lines `n[0..k)`. Lines compare as exact strings.
2. `L[i][j]` = the length of the longest common subsequence of the suffixes `o[i..m)` and `n[j..k)` (`L[m][j] = L[i][k] = 0`).
3. A walk from `i = 0, j = 0`: if `o[i] = n[j]`, both advance and nothing is written; otherwise, if `L[i+1][j] ≥ L[i][j+1]`, write `- o[i]` and advance `i` (a tie removes first); otherwise write `+ n[j]` and advance `j`. When one side ends, write the rest of the other (`- ` for old, `+ ` for new) in order.

Example: old `A, B, A`, new `A, A, B` gives `- B` then `+ B`. `data` = `{ "id": "src-…", "replaces": "src-…", "removed": <n>, "added": <n>, "diff": "<the lines, joined by \n>" }`. The ingest reads it to propose only what changed. `INPUT_INVALID` when the source has no `replaces`; `UNKNOWN_ID` for a missing id.

### 5.20 `brain modules` (0048)

```text
brain modules
brain modules on <module>
brain modules off <module>
```

Lists or switches the optional modules of schema §12: `knowledge`, `orgs`, `documents`, `reports`, `tasks`, `planning`. Core has no switch.

**`brain modules`** writes nothing:
```json
{ "data": { "modules": [
    { "name": "knowledge", "on": true, "default": true, "databases": ["decisions", "questions", "concepts"], "missing": [] },
    { "name": "documents", "on": false, "default": false, "databases": ["documents"], "missing": ["documents"] },
    { "name": "reports", "on": false, "default": false, "databases": [], "missing": [] },
    { "name": "tasks", "on": false, "default": false, "databases": [], "missing": ["tasks"] }
] } }
```
One item per module, in the order above. `on` follows schema §12 (all `true` when the block is absent). `databases` lists the module's `notion.databases` keys; `missing` lists those whose id is empty, and `tasks` when `notion.tasks.database` is empty. So the skill knows which Notion steps a module still needs before it can work.

**`on` / `off`** set `modules.<module>` to `true` or `false` in `brain.json`. When the block is absent it is written first with every key `true` (as `brain upgrade` does), then the switch is applied. `brain.json` is validated and written as JSON with 2-space indent and a trailing newline. Nothing else changes: no note, no Notion page, no database id. Switching a module to the state it is already in writes nothing (`changed: false`). Logs `modules - "<module>" state=on|off` when it changes. `data` = `{ "module": "documents", "on": true, "changed": true, "missing": ["documents"] }`.

Turning a module on in Notion is the skill's job, with the user: it follows the module's steps in `notion/modules/<module>.md` (Notion AI prompts for its databases, buttons and layouts by hand, then `config set` for each id), and the next catch-up uses the module. Turning one off deletes nothing (schema §12).

Errors: `USAGE` (an unknown module, `core`, or `on`/`off` without one).

### 5.21 `brain schedule` (0051)

```text
brain schedule install <job> --at <HH:MM>[,<HH:MM>…] --model <id> [--days <day>[,<day>…]] [--dry-run]
brain schedule list
brain schedule remove <job>
```

Runs a skill on a schedule, with nobody there, through local Claude Code (`claude -p`), the one scheduler that sees every input: the drop folder, linked repos and the user's Notion MCP (0051). It writes the machine's scheduler entry and nothing in the brain: no file, no log line, no commit. The skill's "Run on a schedule" section calls it and writes the settings (brain-catch-up; brain-reflect from 0.8.0).

**Jobs.** Each job runs one fixed prompt in the brain folder, so the schedule starts the skill the same way every time:

| `<job>` | Prompt | Needs |
|---|---|---|
| `catch-up` | `catch up unattended` | brain-catch-up |
| `reflect` | `tidy the brain unattended` | brain-reflect (0052); without `.claude/skills/brain-reflect/SKILL.md` in the brain → `SKILL_MISSING` |

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
0 7 * * * mkdir -p "$HOME/.ultimate-brain/logs" && cd '/Users/rodrigo/brain' && PATH='…' '/usr/local/bin/claude' -p 'catch up unattended' --model claude-sonnet-5-5 >> "$HOME/.ultimate-brain/logs/eu.ultimate-brain.brain-3f9a2c1d.catch-up.log" 2>&1
```

The line creates its log folder first, so it runs on a machine where it doesn't exist yet. Paths are single-quoted, with `'` written as `'\''`. `list` and `remove` manage no cron lines: they return `[]` and `removed: false` with the warning `SCHEDULE_NOT_MANAGED` ("cron lines are yours: crontab -l").

```sh
brain schedule install catch-up --at 07:00,13:00 --days mon,tue,wed,thu,fri --model claude-sonnet-5-5 --json
```
```json
{ "data": {
    "job": "catch-up", "label": "eu.ultimate-brain.brain-3f9a2c1d.catch-up", "platform": "darwin",
    "path": "/Users/rodrigo/Library/LaunchAgents/eu.ultimate-brain.brain-3f9a2c1d.catch-up.plist",
    "times": ["07:00", "13:00"], "days": ["mon", "tue", "wed", "thu", "fri"], "model": "claude-sonnet-5-5",
    "prompt": "catch up unattended", "command": ["/usr/local/bin/claude", "-p", "catch up unattended", "--model", "claude-sonnet-5-5"],
    "written": true, "replaced": false, "loaded": true, "cron": null, "dry_run": false
} }
```

Elsewhere `path` is `null`, `written` and `loaded` are `false`, and `cron` is the list of lines. `list` → `{ "schedules": [ { "job", "label", "path", "times", "days", "model", "prompt" } ] }` (`days` `null` for every day). `remove` → `{ "job", "label", "path", "removed" }`.

Errors: `USAGE` (unknown job, a time that isn't `HH:MM` from 00:00 to 23:59, an unknown day, a missing or moving `--model`), `CLAUDE_NOT_FOUND`, `SKILL_MISSING`, `OUTSIDE_ROOT` (a plist path that is a symbolic link).

---

## 6. Standard sequences (for skills)

| Flow | Sequence |
|---|---|
| **Ingest one meeting** (CC-06) | `status` → `index` (JSON, for matching) → `note new --dry-run` with the source (check `DUPLICATE_SOURCE`; a meeting set back to Reviewed after an ingest is a re-read: the source gets `replaces`, then `source diff`, and only the changed lines are extracted, 0045) → `id new` for the new notes → `note new` (source, meeting, people, decisions, questions) → `proposal new` (with one `review_notes` for the source, which takes in its `add_link`, `update_fact`, `update_body` and `add_to_note` items, and any `answer`, 0041, 0043, 0045) → `index` → `views` → `lint` → `log ingest <mtg> created=… proposals=… tasks=…` → `git commit` → `sync tasks` + MCP → `sync render --changed` + MCP → `sync record` → `git commit` |
| **Apply reviews** (CC-09) | MCP read Review rows → `sync plan` → `sync apply` → `index` → `views` → `lint` → commit → `sync render --changed` + MCP → `sync record` → commit |
| **Ingest a document, email, chat, note or capture** (0032, 0037) | as above, with the source's own procedure (brain-ingest `sources.md`); the source records the row's Project, Area and Only keep (0049, 0050); with Keep as document, the same batch writes a `whole` reference (Only keep empty) or a `part` one listed in the source's `review_notes` (Only keep set), one per attached file when the row has files (0049); owner action items → `sync tasks --source` + MCP; the source is published to the Inbox by `sync render --changed` |
| **Catch up** (0037, 0041–0043, 0045, 0048, 0049) | read-only pass (`status` for the modules; MCP reads of Review, Meetings, the Inbox's **Ready** rows, with Reports on the Ask rows and the Report rows with Refresh asked ticked or a What to fix, the Inbox rows with Keep as document ticked, and the Decisions and Concepts rows with Promote ticked; `sync plan`; drop-folder listing, asking for each file "keep as document? no / all / only …"; `repo changes` per linked repo; attachments on the Ready rows and Reviewed meetings; one batch of questions) → `proposal backlog` → **Apply reviews** → **Ingest one meeting** for each Reviewed meeting → **Ingest a …** for each Ready Inbox row, each attachment, each chosen drop-folder file and each changed repo file, then `repo record` → `note new` per `document_requests` (a `whole` reference, or a `part` one in a new `review_notes`) and per `promote_requests` (a `promoted` reference), then the boxes unticked through the MCP → with Reports on, `report new` with `refresh` per `refresh_requests`, `proposal new` + `report fix` per `report_fixes`, **Report** for each new Ask row → `views` → `sync render --changed` + MCP → `sync record` → commit → push per `settings.push` → `log catch-up - notes_read=<n> seconds=<s>` (0045). Steps of a module that is off are skipped, and so are its questions (0048) |
| **Catch up unattended** (0051) | as **Catch up**, with no batch of questions: each takes its default or skips its input, within a budget of inputs, publishing only with `settings.publish: auto`; nothing written when nothing waits. §6.1 |
| **Report** (0043) | `query --candidates` and the notes → the skill writes the six sections → `report new` → commit → `sync render --changed` + MCP (the Report row; the Ask row's Brain Status set to Done) → `sync record` → commit |
| **Apply in chat** | `proposal list --status pending` → ask → `apply` with `decided_by: chat` → `index` → `views` → `lint` → commit. The next sync publishes the change |
| **Sync** (CC-08) | as §5.14 |
| **Query** (CC-10) | `query --candidates` → read the top notes → answer with citations → `log query - notes_read=<n> seconds=<s>` (0045) |

A run never leaves lint errors it introduced: if `lint` reports new errors after a write, the skill stops before committing and reports them.

### 6.1 Catch up unattended (0051)

The skill brain-catch-up, started by the prompt `catch up unattended` (a schedule, §5.21, or the user by hand). It is **Catch up** above, in one turn, with nobody to ask: the read-only pass runs as usual, then each question of the batch takes its default or skips its input, and the run goes on. It applies the user's explicit decisions, interprets no text the user wrote, and decides nothing itself (0003 as amended by 0051). The 5-minute bar (0043) doesn't apply; the budget does.

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
| *(Reports)* A Report row to refresh: Refresh asked ticked (`refresh_requests`), or a report whose last `fixes` entry lists only proposals now applied, rejected or closed and whose `generated_at` is older than the last of those decisions (brain-catch-up, step 1.9) | **default**: yes, refreshed, unless the same report has a `report_fixes` item (previous row): then it waits, its Refresh asked box still ticked |
| *(Reports)* A report's What to fix and the proposals it becomes (`report_fixes`) | **skip** the report whole: the fix waits for an attended run, like a Review row's What to fix, and the report isn't refreshed meanwhile, whether its refresh was asked or due (next row) |
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
| `ignored` (`NOT_CORRECTABLE`, `ALREADY_TERMINAL`, `MODULE_OFF`, …) | nothing, as attended; `NOT_CORRECTABLE` is named under Check |
| Chat decisions | none: nobody is in the chat |

0051 also lists "an Edit with a value" as applied. Since migration 0009 a Review row has no such option (Edit became Fix, whose What to fix needs reading), so nothing of that kind reaches an unattended run: an `edit` with a `value` is passed to `brain apply` only in chat, by an attended run.

**The budget.** `settings.unattended.max_inputs` (default 10, schema §12) counts inputs: each Reviewed meeting, each Ready Inbox row (its attachments with it), each drop-folder file and each changed file of a linked repo. They are taken oldest first, by the meeting's Date, the row's created time, the drop-folder file's modified time, the repo file's `committed_at`. Skipped inputs don't count; failed ones do. A repo whose files didn't all fit gets no `repo record`: the next run lists them again, and the ones already in skip as `DUPLICATE_SOURCE` (sources.md, "Linked repos", step 4). An input whose source the brain already has (`note new --dry-run` reports `DUPLICATE_SOURCE`: a repo file taken by an earlier run, or a row an earlier run wrote but didn't publish) is not an input again and isn't counted; a row or meeting waits for the publish. The inputs beyond the budget are `left`, named in the report ("4 more wait for the next run"), and taken by the next run. Requests (Documents, promotions, refreshes, Ask rows, the backlog) aren't inputs and aren't counted. When `brain status` gives `unattended.backlog: true`, the report says "Backlog growing: run more often or raise the budget".

**A step that fails** is logged in the run's `failures` and the run goes on with the next input. A lint error in a file the run wrote stops the run there, as attended, and is a failure.

**What needs the user** is the skipped inputs, the `waiting` rows and fixes, the conflicts, and the failures. The report is the attended three lines (Done, Needs you, Next) with What came in and Check, written:
- **in the log line** (§3.9), always, unless the run was a no-op;
- **in one Inbox Report row**, only with Reports on (`modules.reports`), with `settings.publish: auto` (an unattended run with `ask` writes nothing to Notion, 0051), and when something needs the user or failed. The skill creates it through the MCP in the publish step: Name `Catch-up <D Mon>: <n> in, <n> need you` (`, <n> failed` added when one did; "1 meeting in, 1 needs you"), Kind = Report, Brain Status = Done, no Brain ID, the report as its body. It is not a note and has no file in Git; its facts are in the log line. A Refresh asked or What to fix on it is ignored (`NOT_A_REPORT`, §5.14.2). A Notion failure can't write it; the log line still holds the run;
- with Reports off or `publish: ask`, nowhere else: what needs the user waits where they act on it (the meeting Reviewed, the row Ready, the Fix in Review), and the next attended catch-up opens with the summary below. The skill's "Run on a schedule" section says so when it sets a schedule (CC-64): a Report row needs Reports on and `publish: auto`.

**The next attended catch-up** opens with the summary of the unattended runs since the last attended one, from `brain status` `unattended.catch_up` (§5.2), before its batch: "Since last time: 4 scheduled runs, 6 inputs in, 1 skipped, 1 Fix waiting, 1 failed: Notion login". Nothing when `catch_up` is `null`. Its own log line has no `mode`, which starts the count again.
