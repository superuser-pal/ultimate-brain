# CLI Contract (v1)

**Status:** Draft for review (task CC-03)
**Applies to:** the `brain` CLI in `src/` (tasks CX-02 to CX-11).
**Depends on:** [schema.md](schema.md) (field names, file formats, apply rules). When this document and schema.md disagree on a file format, schema.md wins and this document is fixed.

Decisions referenced: 0003, 0006, 0007, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0021, 0023, 0024, 0026, 0027.

---

## 1. Scope

The CLI does the **deterministic** work: IDs, file writes, validation, index, views, applying decided proposals, and turning Notion snapshots into plans. The **skills** (Claude Code / Codex) do the judgment and the Notion I/O: they read minutes, extract knowledge, call the Notion MCP (0015), and call the CLI to write.

Rules for every command:
- **No network.** The CLI never calls Notion or any other service. Notion data enters only as JSON files written by a skill.
- **No Git, except `init`.** Commands write files; the skill commits. `init` creates the repository and its first commit.
- **No LLM.** Same input and same brain give the same output, except for new random IDs and the clock (see `--now`).
- **Writes only inside the brain**, except `init` (the new brain folder, and the global config file with `--set-default`) and `link` (three files in the target repo).

### 1.1 Skill commands vs CLI commands

Decision 0024 lists user-facing commands. Some are skills that call the CLI; some are CLI commands. Users ask agents for the skill; agents call the CLI.

| User-facing (0024) | Runs as | CLI commands it calls |
|---|---|---|
| `brain init` | CLI | `init` |
| `brain connect-notion` | skill (CC-08) | `config set` |
| `brain ingest` | skill (CC-06) | `status`, `index`, `id new`, `note new`, `proposal new`, `views`, `lint`, `log`, `sync tasks`, `sync render`, `sync record` |
| `brain apply` | skill (CC-09) | `sync plan`, `sync apply` (or `apply` in chat), `index`, `views`, `sync render`, `sync record` |
| `brain sync` | skill (CC-08) | `sync plan`, `sync apply`, `index`, `views`, `sync render`, `sync record` |
| `brain query` | skill (CC-10) | `query --candidates`, `index` |
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
| `WRITE_CONFLICT` | 5 | a file appeared at a path the command was creating, after it read the brain (another writer). Nothing is kept (§3.6); re-run the command |
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
   - **Key order for new notes:** `id`, `type`, `title`, `summary`, `lifecycle`, then the type's own fields in the order of their table in schema §4, then `aliases`, `tags`, `area`, `projects`, `sources`, `relations`, `facts`, `timeline`, then `created`, `updated`, then `notion`, `last_synced`, `notion_fields`, `notion_published`. A key listed twice (e.g. `area` for goals and projects) takes its first position. **Proposals** follow the order of the schema §11 example: `id`, `type`, `title`, `created`, `updated`, then the fields of the §11 table in order, then `notion`, `notion_published`. Absent keys are skipped. A key a command adds to an existing file goes at the position this order gives it among the keys present; existing keys never move and unknown keys are kept (CX-02 round-trip).
   - **Body separator:** a new note is written as `---\n<frontmatter>---\n\n<body>` (one blank line before the body), except a **source**, which is `---\n<frontmatter>---\n<body>`, so its `content_hash` covers exactly the body given. A note with an empty body (proposals) ends right after the closing `---\n`.
   - The CX-02 serializer (`src/lib/frontmatter.ts`) is brought in line with these rules by CX-06, the first task that edits existing notes.
6. **`updated` (one rule).** Every command that changes a note's content sets `updated` to today (the UTC date of `--now`), whatever date the change was decided or observed. Changes to system fields only (`notion`, `last_synced`, `tasks`, `notion_fields`, `notion_published`) do not change `updated`.
7. **Array order in output.** Unless a command says otherwise, path lists (`created`, `changed`, `written`) are sorted by path, and item lists follow input order.

### 3.7 What counts as a note

The CLI scans these folders under the brain root: `areas/`, `goals/`, `projects/`, `archive/`, `knowledge/`, `sources/`, `memories/`, `_proposals/`. Every `*.md` file there must have frontmatter with an `id` (lint error `not-a-note` otherwise). Files elsewhere (root `AGENTS.md`, `CLAUDE.md`, `README.md`, `index.md`, `log/`, dot-folders) are not notes.

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
| proposal | `_proposals/<created>-<slug>.md` |

If the path exists (for projects: the folder), append `-2`, `-3`, … to the slug until it is free.

### 3.9 Log lines

Write commands append to `log/<YYYY-MM>.md` (month of `--now`), creating it with the first line `<!-- GENERATED by brain. Append-only. -->` and a blank line. One line per item written (schema §13):

```text
- <timestamp> <op> <id> "<title>"[ <key>=<value>]…
```

`"` and `\` in titles are escaped with `\`, and CR and LF become `\r` and `\n`, so every entry is exactly one line. Values with spaces, quotes, backslashes or line breaks are quoted and escaped the same way. The file is created exclusively with its header, then lines are appended; an unreadable log is an error, never a reason to start the file over. Ops written by the CLI: `init`, `note-new`, `proposal-new`, `apply`, `correct`, `sync-create`, `sync-update`, `upgrade`. Skills add their own (`ingest`, `publish`) with `brain log` (§5.11). `index` and `views` do not log.

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
    "notes": { "area": 2, "project": 3, "person": 7, "org": 2, "meeting": 12, "decision": 9, "question": 4, "concept": 1, "source": 12, "view": 6, "goal": 1, "memory": 0 },
    "proposals": { "pending": 3, "approved": 0, "edited": 0, "rejected": 0, "applied": 14, "closed": 2 },
    "notion": { "configured": ["areas", "goals", "projects", "meetings", "people", "orgs", "decisions", "questions", "review"], "missing": ["key_results", "capture_inbox"], "tasks_database": true },
    "index_stale": false,
    "views_stale": ["projects/acme-website/brief.md"],
    "last_log": "- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w \"Acme sync\" created=4 proposals=3"
} }
```

`notion.configured`/`missing` list keys of `brain.json` `notion.databases` with non-empty / empty values. Exit 0 even when stale.

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

The CLI sets `created` = `updated` = today, `lifecycle: draft` (knowledge types), and for sources `content_hash` (schema §4, over the body as written) and `captured` (default now). Files are laid out as §3.6.5 says. References in `frontmatter` may point to existing notes **or to other notes in the same batch**. The batch is validated as if written: schema, IDs, folder, references, and every lint error rule (§5.10) that concerns the new files. So a new decision whose `decided_in` names an *existing* meeting fails `meeting-backref`: put the meeting in the same batch, or use a `new_item` proposal, whose apply updates the meeting. Any error → `INPUT_INVALID`, with `details` pointing into the input (a reference to a missing note included), and nothing is written.

**Source dedupe:** a source is a duplicate if an existing source, or one earlier in the same batch, has the same `content_hash`, **or** the same `source_key` when that key is `file:` (the same original file, whatever the converter produced) or the source's `kind` is `capture` (the same Capture Inbox row, even after an edit) (0032). A duplicate is not written and is reported in `skipped` with the existing id. This is how the ingest skips minutes it has already ingested (synthesis §5 step 2). Other items in the batch that reference the skipped source's input `id` are an error, so the skill must check `skipped` with `--dry-run` first, or snapshot the source in its own batch.

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
Skipped item: `{ "input_index": 0, "reason": "DUPLICATE_SOURCE", "existing": "src-7w3c9k5m" }`.

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (incl. refused type, forbidden key, missing reference, lint error in a new file), `ID_IN_USE`.

### 5.6 `brain proposal new` / `brain proposal list`

```text
brain proposal new --input <file|-> [--dry-run]
brain proposal list [--status <s>[,<s>…]] [--target <id>]
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

Input keys are the proposal fields of schema §11 except `id`, `type`, `created`, `updated`, `status`, `decision`, `notion`. The CLI:
- assigns `id`, `created` = `updated` = today, `status: pending`;
- sets `before` to the target's current `facts.<field>` for `update_fact` and `contradiction` (absent if the fact is new). If the input gives `before` and it differs → `BEFORE_MISMATCH`;
- for `update_fact` and `contradiction`, sets `from` if absent: the source meeting's `date` when `source` is a `mtg-` id, else `created`;
- checks per kind: `target` exists (all kinds except `new_item`) and is a knowledge note (not a source, view or proposal, which are immutable, regenerated or records); a `source` that is a note id must exist (`UNKNOWN_ID`); a `new_item` whose `note` is a source already captured is `INPUT_INVALID`; `contradiction` needs a current `facts.<field>`; `supersede` needs `supersedes` to exist, differ from `target`, have the same type, and not already be superseded; `merge` needs `merge_into` to exist, differ from `target`, same type; `add_link` needs `field` to be `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders` and declared by the target's type, and `after` to be an existing note id with the field's prefix (`prj-`, `per-`) for the reference fields or a non-empty string for `aliases` and `tags`; when `after` is already in the list the item is skipped (`ALREADY_LINKED`), so a re-run after approval writes nothing (0028); `new_item` carries `note`, one `note new` input item without `id` (§5.5), which must pass `note new` validation, with a back-reference to an existing meeting allowed because apply adds it (schema §11.2);
- **dedupes:** an item equal to an existing `pending` proposal on (`kind`, `target`, `field`, `after`, `content`, `note`, `supersedes`, `merge_into`) is skipped (`DUPLICATE_PENDING`), so re-running an ingest does not duplicate review rows. An `add_link` whose value is already listed is skipped as `{ "input_index": 2, "reason": "ALREADY_LINKED" }` (no `existing`).

Proposals are written with an empty body. Logs `proposal-new <id> "<title>" kind=<kind> target=<target>`.

```json
{ "data": {
    "created": [ { "id": "prp-3c8v1n5x", "kind": "update_fact", "title": "Acme launch: Jan → Feb", "target": "prj-9x4t1b7e", "path": "_proposals/2026-12-03-acme-launch-jan-feb.md", "before": "2027-01" } ],
    "skipped": [ { "input_index": 1, "reason": "DUPLICATE_PENDING", "existing": "prp-9d3f7h2k" } ],
    "dry_run": false
} }
```

Errors: `INPUT_INVALID`, `UNKNOWN_ID`, `BEFORE_MISMATCH`.

**`proposal list`** returns proposals filtered by status (default all) and target, sorted by `created` then id. Each item has every frontmatter field plus `path`.

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
    { "proposal": "prp-2v6n8q4j", "action": "edit", "value": "Product Manager", "decided_at": "2026-12-04T08:16:00Z", "decided_by": "notion" }
  ]
}
```

**Order:** all `corrections` first, then all `decisions`, each in input order. Later items see the results of earlier ones.

**Decisions:**

| Proposal state | Result |
|---|---|
| `applied` or `closed` | `skipped`, reason `ALREADY_TERMINAL` (no-op, schema §11.1) |
| `pending` | write `decision` and the matching status, then apply, in one item operation |
| `approved`/`edited`/`rejected` with the same decision (same `action` and `value`; `decided_at` and `decided_by` are not compared) | apply |
| `approved`/`edited`/`rejected` with a different decision | the decision with the later `decided_at` is kept (you changed your mind in Notion before it was applied), then apply |

- **`--record-only`** writes the decision and status without applying (`approved`/`edited`/`rejected`). Unattended runs use it: they may record your decisions but never apply them (0003).
- **Without `--input`**, `apply` applies every proposal that holds a recorded decision but is not terminal.

**Stale proposals.** Before applying `update_fact` or `contradiction`, the target's current `facts.<field>` must still equal the proposal's `before` (both absent counts as equal). If it doesn't, the proposal is **closed**: decision recorded, `status: closed`, `closed_reason: stale`, and the item result is `closed` with reason `STALE_PROPOSAL`. The Review row shows Closed, and the next ingest may propose the change again against the current value.

Other item failures (proposal unchanged):
- `EDIT_NOT_ALLOWED`: edit on a kind that forbids it (schema §11.1);
- `UNKNOWN_ID`: proposal or target missing;
- `INVALID_RESULT`: the result would fail schema or lint, e.g. an edited value of the wrong shape.

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
    "counts": { "area": 1, "project": 1, "person": 2, "org": 1, "meeting": 2, "decision": 2, "question": 1, "concept": 1, "source": 2, "view": 2, "proposal": 2, "memory": 1, "goal": 1 },
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
  | area, concept | — |

- `backlinks` (schema §6): computed inverses. Keyed by target id (sorted); each list sorted by `type`, then `source`. Built from relation types `about` → `mentioned_in`, `depends_on` → `needed_by`, `contradicts` → `contradicts`, `derived_from` → `used_by`, `related_to` → `related_to`, and from fields `projects` → `project_of`, `area` → `area_of`, `goal` → `goal_of`, `client` → `client_of`, `org` → `member`, `attendees` → `attended`, `decided_in` → `decisions`, `raised_in` → `questions`. The persisted pair `supersedes`/`superseded_by` is not included. Links to missing IDs are left out (lint reports them). Notes with no backlinks have no key.
- `written`: the file was rewritten (only when its bytes change). `stale`: `index.md` is still out of date after the command, so it is `true` only with `--check`.
- Scan warnings: `UNPARSEABLE`, `NOT_A_NOTE` (no frontmatter, or no `id`), `UNREADABLE`, `SKIPPED_SYMLINK` (symbolic links are not followed), `DUPLICATE_ID`. A leading byte-order mark is ignored.

### 5.9 `brain views`

```text
brain views [--project <id>] [--check]
```

Regenerates `brief.md` and `decision-log.md` for every project (in `projects/` and `archive/projects/`), or one project, per schema §16 (CX-07). Creates missing view files (with a new `vw-` id). Replaces only the generated block; the `@user` block is preserved byte for byte. Idempotent per schema §16. An existing view file without exactly one well-formed `@generated` block is **not** rewritten (it may hold your text): it is listed in `errors` as `{path, reason: "MARKERS_INVALID"}` and the command exits 1.

```json
{ "data": {
    "projects": 1,
    "written": ["projects/acme-website/brief.md"],
    "created": [],
    "unchanged": ["projects/acme-website/decision-log.md"],
    "errors": [],
    "check": false
} }
```

`--check`: writes nothing, lists what would change in `written`/`created`, exit 1 if any. Errors: `UNKNOWN_ID` (`--project`).

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
| `wrong-folder` | error | type outside its folder (schema §2); a source outside the folder of its key (`sources/notion/`, `sources/files/`, `sources/text/`) |
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
| `product-file` | error | a product-owned file differs from the installed package (0038): a file the package ships in a skill folder present under `.agents/skills/` or `.claude/skills/` is missing, differs or is extra; or the AGENTS.md rules block differs from the template's. The message names the package version and says: run `brain upgrade`, or file a finding. A skill folder that is missing entirely, or AGENTS.md without its markers, is not reported here (`brain upgrade` handles them) |
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

- `database`: a key of `brain.json` `notion.databases` among `areas`, `goals`, `key_results`, `projects`, `people`, `orgs`, `decisions`, `questions`, `review`.
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
- Numbers: a Key Facts value, an Edited Value or any other text becomes a number when the brain's current (or proposed) value for that field is a number and the text is a finite number (`80000` → `80000`); otherwise it stays a string.
- Relations map page ids to brain ids through the notes' `notion` fields. An unknown page → conflict `UNRESOLVED_RELATION`.

**Brain → Notion:**
- A month value (`2027-06`) renders as `{"start": "2027-06-01", "end": null}`. Because the comparison uses the stored published value, a month round-trips without a spurious correction.
- `lifecycle`, `assessment`, `kind`, proposal `kind` and `status` render as select labels: each word capitalized (`provisional` → `Provisional`, `update_fact` → `Update Fact`). Proposal status maps to State: `pending`/`approved`/`edited`/`rejected` → `Pending`, `applied` → `Applied`, `closed` → `Closed`.

#### 5.14.2 `brain sync plan`

```text
brain sync plan --input <snapshot|->
```

Read-only. Compares each row with the brain and returns a plan. Notes are matched by `Brain ID`.

**Rows with empty `Brain ID`:** first, a note whose `notion` equals the row's `page_id` is that row's note (a create whose publish failed); the row is then treated as if it had that Brain ID, and the next render writes the Brain ID. Otherwise:
- In `areas`, `goals`, `projects`, `people`, `orgs` → a `create` item (0021): a `note new` input with a pre-generated id and:
  - `title` = Name; `summary` = Summary, or Name if empty; `lifecycle` from Lifecycle (default `draft`);
  - `notion` = page id; `sources: ["notion:<page_id>"]`;
  - brain-owned properties mapped as in the table below, relations resolved to brain ids (other rows created in the same plan count);
  - for each fact set this way, one timeline entry `{field, value, from: <date of last_edited>, learned: <date of as_of>, source: "notion:<page_id>", assessment: accepted}`;
  - `notion_fields` from the Notion-owned properties, and `notion_published` = the row's brain-owned values (the baseline).

  A required field that cannot be filled (goal without Why or Area, project without Area) → conflict `MISSING_REQUIRED` instead.
- In `decisions`, `questions`, `review` → `ignored`, `NOT_CREATED_IN_NOTION` (those rows are created by the brain only).
- `key_results` rows never have a Brain ID; see below.

**Rows with a `Brain ID`:**
- No such note → conflict `UNKNOWN_BRAIN_ID`. The note's `notion` differs from `page_id` → conflict `NOTION_ID_MISMATCH`. The note has no `notion` → `updates` sets it.
- **Notion-owned** properties → the type's `notion_fields` (table below), plus `as_of`. If any value differs from the stored snapshot (ignoring `as_of`) → an `updates` item with the full new `notion_fields`. Notion is the authority; no three-way comparison.
- **Lifecycle** (yours; agents also set `draft` and `archived`) → three-way comparison; "your correction" here is an `updates` item that sets `lifecycle`.
- **Brain-owned** properties → three-way comparison; "your correction" is a `corrections` item when the property is correctable (table below), otherwise `ignored`, `NOT_CORRECTABLE`. For Key Facts, the comparison runs **per key** on the parsed texts (N, S and B each parsed as §5.14.4 says), so a change to one key never conflicts with a change to another; each key is reported as `property: "Key Facts/<key>"`. A key in S that is missing from N → `ignored`, `FACT_REMOVAL_NOT_SUPPORTED`. A Name, Summary or Lifecycle emptied in Notion → conflict `REQUIRED_EMPTY`; a Lifecycle option the brain does not know → `ignored`, `UNKNOWN_OPTION`. Lifecycle is compared case-insensitively (Notion shows `Draft`, the brain stores `draft`).
- **Review rows** with `Decision` set and `State` = `Pending` → a `decisions` item for `brain apply`: `action` from Decision, `value` from Edited Value (converted as above), `decided_at` = `last_edited`, `decided_by: notion`. `Edit` on a kind that forbids it (`edit` is allowed only for `update_fact`, `contradiction` and `add_to_note`, schema §11.1) → conflict `EDIT_NOT_ALLOWED` on the `Decision` property, so the user sees it before anything is applied (decision 0037). `Edit` with empty Edited Value → conflict `EDIT_WITHOUT_VALUE`. A proposal already terminal → `ignored`, `ALREADY_TERMINAL`.
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

Other brain-owned properties (Assessment, Supersedes, Decided In, Raised In, Kind) are not correctable in v1 (decision 0027): a change you make there is `ignored`, `NOT_CORRECTABLE`, so the skill can tell you to use a proposal instead.

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
    "conflicts": [ { "database": "goals", "page_id": "…", "brain_id": null, "code": "MISSING_REQUIRED", "message": "goal \"Write a book\" has no Area" } ],
    "ignored": [ { "database": "decisions", "page_id": "…", "brain_id": "dec-7k2m9q4x", "property": "Assessment", "reason": "NOT_CORRECTABLE" } ]
} }
```

- `observed_at` of a correction is the row's `last_edited`; `property` and `notion_value` (N, normalized) let `sync apply` set S. For Key Facts, `notion_value` is the whole Key Facts text.
- An `updates` item is `{id, notion?, lifecycle?, notion_fields?, published?}`: each optional key is set only when it changes; `published` is a map of S values to set (the converged case of the three-way table).
- A conflict item is `{database, page_id, brain_id, code, message, property?, notion_value?, brain_value?}`.
- Every array is sorted by database (in the order of the snapshot `database` list above), then `page_id`, then `field` or `property`.

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (unknown database key, bad value shape).

#### 5.14.3 `brain sync apply`

```text
brain sync apply --input <plan|-> [--record-only] [--dry-run]
```

With `--record-only` (unattended runs, 0003), only additions run: `create`, `updates` and recording `decisions` (as `apply --record-only`); `corrections` are skipped and reported.

Executes a plan from `sync plan`, in this order:
1. **`create`**, per item with the `note new` rules (except that `lifecycle` comes from the item). An item whose relations point at a create that failed also fails (`DEPENDENCY_FAILED`). Logs `sync-create`.
2. **`updates`**: sets `notion`, `lifecycle`, `notion_fields` and the listed S values. Logs `sync-update`.
3. **`corrections`**, then **`decisions`**, with the `brain apply` rules. After a correction succeeds, S for its `property` is set to the Notion value, since Notion already shows it.

`sync apply` never writes `last_synced` (only `sync record` does). `conflicts` and `ignored` are not executed; they are echoed for the skill to report.

Preconditions are re-checked (the brain may have changed since the plan): a create id now in use, or an update or correction target now missing → that item `failed`. `data` = `{ "create": […], "updates": […], "corrections": […], "decisions": […], "conflicts": […], "ignored": […], "summary": {…} }`, each executed item with `result` and `changed` as in `apply`. Exit 1 if any item `failed`.

#### 5.14.4 `brain sync render`

```text
brain sync render (--changed | --ids <id>[,<id>…]) [--plan <plan.json>]
```

Builds Notion payloads; writes nothing. With `--plan`, every property named by a `BOTH_CHANGED` conflict in that plan is held back (left out of `properties` and of `published`) until the skill has your answer; the skill passes the plan of the same run. The skill sends them through the MCP, then passes each item's `published` back to `sync record`.

**`--changed`** selects:
- notes of a published type (area, goal, project, person, org, decision, question) with no `notion`;
- notes and meetings (with `notion`) where any rendered property's B differs from S, or the page content changed (B of `@content` ≠ S);
- proposals with no `notion`, or whose State (or another rendered property) differs from S.

Notes whose database id is empty in `brain.json` are skipped with warning `DATABASE_NOT_CONFIGURED`.

**Rendered properties per database** (exactly these; nothing else is ever sent):

| Database | Properties |
|---|---|
| areas | Name, Summary, Lifecycle, Brain ID, Last Synced |
| goals | Name, Summary, Why, Deadline, Area, Lifecycle, Brain ID, Last Synced |
| projects | Name, Summary, Key Facts, Area, Goal, Client, People, Lifecycle, Brain ID, Last Synced |
| people | Name, Summary, Role, Org, Lifecycle, Brain ID, Last Synced |
| orgs | Name, Summary, Lifecycle, Brain ID, Last Synced |
| decisions | Name, Summary, Date, Assessment, Project, Decided In, Supersedes, Lifecycle, Brain ID, Last Synced |
| questions | Name, Summary, Kind, Project, Raised In, Lifecycle, Brain ID, Last Synced |
| meetings | Decisions, Questions, Attendees *(add)*, Project *(if empty)*, Area *(if empty)*, Brain Status, Ingested At, Brain ID |
| review | Name, Kind, Target, Target Page, Before, After, Why, Source Meeting, State, Brain ID |

- On `create`, every listed property is sent. On `update`, only properties whose B ≠ S are sent, plus Last Synced (= `--now`) for the databases that have it (not Meetings or Review). So Lifecycle goes out on create (`Draft`) and when the brain changed it (`archived` by a supersession), and your own Lifecycle edits, already pulled into the brain, are never overwritten.
- Project relations carry every id in `projects`.
- **Meetings** (0007; the page is yours): never Name, Date or body. *(add)* relations carry `"mode": "add"`: the skill adds the listed pages and keeps those you linked. *(if empty)* relations carry `"mode": "if_empty"`: the skill writes them only when the property is empty in Notion (design §3.5: "brain fills if empty"). Brain Status = `Ingested` and Ingested At = `{start: <meeting created>}` go out once, because S then holds them.
- **Review** (proposals): Name = `title`; Kind; Target = `<target title> (<target id>)`; Target Page = the target's Notion URL if published; Before and After (for `supersede`: old and new note title; `merge`: duplicate and survivor title; `add_to_note`: After = `content`; `add_link`: Before empty, After = `<Field>: <value>` with a note id rendered as its title, e.g. `People: Lucía Fernández`; `new_item`: After = the note's title and type), cut to 2000 characters; Why; Source Meeting = relation when `source` is a published meeting; State.
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

- `action`: `create` when the note has no `notion`, else `update`. Meetings are always `update`; a meeting without `notion` → item error `MEETING_NOT_PUBLISHED`. Projects are always `update` too: a project without `notion` → item error `PROJECT_NOT_IN_NOTION`, because a project page must come from the Projects template (its views and "My notes"), which the API can't apply. The user creates it with **New project** in Notion, and the next `sync plan` imports it (0021).
- `published`: B for every rendered property except Last Synced and pending relations, plus `@content` = `sha256:<hex>` of the rendered `body`/`sections` when the type has content. This is the new S once the write succeeds.
- **Page content** (decision 0026): the brain writes only what it owns.
  - `body` (decisions, questions): replaces the whole page body.
  - `sections` (projects): `{ "Brief": <the brief's generated block>, "Decision log": <the decision log's generated block> }`. The skill replaces only the children of the toggle heading with that exact name. `render` can't see Notion page content, so finding the toggle is the skill's job, after it reads the page through the MCP (0033): a page with **no toggle headings at all** gets the missing "Brief" and "Decision log" toggles appended and filled; a page with other toggle headings but not the named one is reported as `SECTION_NOT_FOUND` and left as it is.
  - Areas, goals, people, orgs, meetings and proposals: `body` and `sections` are both `null`.
  - Rendering: `^[inferred]` → ` (AI inference)`, `^[ambiguous]` → ` (ambiguous)`, and relative links to published notes become `https://www.notion.so/<page id without dashes>` (unpublished → plain title text).

`data` = `{ "items": […], "errors": [ { "id": "…", "reason": "MEETING_NOT_PUBLISHED" } ] }`, items sorted by database (table order), then id. Exit 1 if `errors` is non-empty (the other items are still returned); `UNKNOWN_ID` for `--ids` is a whole-command error.

**Key Facts text** (projects, rendered here and parsed back by `sync plan`): one segment per `facts` key, sorted by key, joined by ` · `. Segment = `<Label>: <value>`; label = the key with `_` → space and the first letter uppercased; a person-id value renders as the person's title. Parse: split on ` · `, then on the first `: `; label → key by lowercasing and space → `_`; a person title (or alias) maps back to its id (ambiguous → conflict `AMBIGUOUS_PERSON`). Values containing ` · ` are not supported in v1. Example: `Budget: 80000 EUR · Launch date: 2027-02 · Owner: Maria López`.

#### 5.14.5 `brain sync tasks`

```text
brain sync tasks --meeting <mtg-id> --input <file|->
```

Renders Notion task payloads for a meeting's action items using the `brain.json` Tasks mapping (0018, schema §12); writes nothing.

Input: `{ "items": [ { "title": "Send Supabase migration plan", "owner": "Carlos Ruiz", "due": "2026-12-10", "projects": ["prj-9x4t1b7e"] } ] }` (`owner`, `due`, `projects` optional).

`projects` (dogfood finding 7): the projects this task is about, as project ids. Absent or empty → the meeting's `projects`. Errors, disjoint: an id with no note → `UNKNOWN_ID`; an entry that isn't a string, or an existing note that isn't a project → `INPUT_INVALID` with the pointer `/items/<n>/projects/<m>`.

Each item → `{ "database_id": "…", "properties": { "<mapped name>": {type, value} } }` with:
- title; due; status = `new_task_status`;
- project relation from the item's `projects`, else the meeting's; area relation from the meeting's `area` (each when published and mapped). A project not yet in Notion is left out and listed in the item's `pending_relations`, as in `render`;
- owner as `{ "type": "person_name", "value": "Carlos Ruiz" }`: the skill writes it as text, or resolves it to a Notion user when the mapped property is a people property;
- the backlink: the meeting relation (`meeting`), else the meeting's Notion URL (`meeting_url`);
- brain_id = the meeting id.

Unmapped (empty) properties are left out. After creating the tasks, the skill records their page ids with `sync record`.

Errors: `UNKNOWN_ID` (the meeting, or an item's project id), `INPUT_INVALID` (an item's `projects` entry that isn't a string or isn't a project), `BRAIN_CONFIG_INVALID` (no Tasks database, or `brain.json` fails its schema, which requires a title mapping and a backlink mapping once a Tasks database is set).

#### 5.14.6 `brain sync record`

```text
brain sync record --input <file|->
```

Stores what the skill published. Input: `{ "records": [ { "id": "per-3h8w2n6c", "notion": "6a7b…", "synced_at": "2026-12-05T09:01:10Z", "published": { … }, "tasks": ["…"] } ] }`.

- `notion`: set if absent; if present and different → item `failed`, `NOTION_ID_MISMATCH`.
- `published` (the render item's `published`): merged into `notion_published`, key by key.
- `synced_at` → `last_synced` (knowledge notes), the time of the last publish.
- `tasks` (meetings only): appended to the meeting's `tasks`, deduped, order kept.
- Does not change `updated`; does not log (the skill logs `publish`).

`data` = `{ "records": [ { "id": "…", "result": "recorded"|"failed", "reason"?: "…", "changed": ["…"] } ] }`. Exit 1 if any failed.


### 5.15 `brain upgrade`

```text
brain upgrade [--dry-run]
```

Brings the product-owned files of an existing brain up to the installed version of the package (dogfood finding 22), then commits and pushes them (0038). It never touches notes, `brain.json`, generated files, the log, or anything the user wrote.

**Before anything is written:**
- **Published package only.** If the running CLI's package root contains `src/cli.ts` (a source checkout, including `npm link`), refuse with `UNRELEASED_BUILD`. Prereleases (`0.3.0-rc.1`) are published packages and are allowed.
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
5. Log `- <timestamp> upgrade - "<package version>" files=<n>` when anything changed. `--dry-run` writes and logs nothing and reports the same `files`.
6. **Lint** the brain (§5.10) and report the counts in `lint`. Lint findings never stop the upgrade: it only wrote product-owned files.
7. **Commit and push**, when anything changed and the brain is a Git repository: stage only the paths in `files` and the log, commit `upgrade: ultimate brain <version>`, then `git push` if the current branch has an upstream. No upstream → warning `PUSH_SKIPPED`. A push that fails → warning `PUSH_FAILED` with Git's message; the commit stays, and the exit code is still 0. A failed commit (no identity) → warning `GIT_COMMIT_SKIPPED`, files kept. Not a Git repository → no commit, no warning.

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
---

## 6. Standard sequences (for skills)

| Flow | Sequence |
|---|---|
| **Ingest one meeting** (CC-06) | `status` → `index` (JSON, for matching) → `note new --dry-run` with the source (check `DUPLICATE_SOURCE`) → `id new` for the new notes → `note new` (source, meeting, people, decisions, questions) → `proposal new` → `index` → `views` → `lint` → `log ingest <mtg> created=… proposals=… tasks=…` → `git commit` → `sync tasks` + MCP → `sync render --changed` + MCP → `sync record` → `git commit` |
| **Apply reviews** (CC-09) | MCP read Review rows → `sync plan` → `sync apply` → `index` → `views` → `lint` → commit → `sync render --changed` + MCP → `sync record` → commit |
| **Apply in chat** | `proposal list --status pending` → ask → `apply` with `decided_by: chat` → `index` → `views` → `lint` → commit. The next sync publishes the change |
| **Sync** (CC-08) | as §5.14 |
| **Query** (CC-10) | `query --candidates` → read the top notes → answer with citations |

A run never leaves lint errors it introduced: if `lint` reports new errors after a write, the skill stops before committing and reports them.
