# CLI Contract (v1)

**Status:** Draft for review (task CC-03)
**Applies to:** the `brain` CLI in `src/` (tasks CX-02 to CX-11).
**Depends on:** [schema.md](schema.md) (field names, file formats, apply rules). When this document and schema.md disagree on a file format, schema.md wins and this document is fixed.

Decisions referenced: 0003, 0006, 0007, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0021, 0023, 0024.

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
| `--now <timestamp>` | Use this ISO 8601 UTC timestamp (`2026-12-03T10:22:00Z`) as the current time. For tests and replays. Default: system clock |
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
- `warnings` is always present (may be empty). Each has `code`, `message`, optional `path` and `id`.
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
| `BRAIN_CONFIG_INVALID` | 3 | `brain.json` or the global config fails its schema |
| `SCHEMA_VERSION_UNSUPPORTED` | 3 | `brain.json` `schema_version` ≠ 1 |
| `INPUT_UNREADABLE` | 4 | input file missing or not JSON |
| `INPUT_INVALID` | 4 | input fails its shape or the note/proposal schema; `details` lists `{pointer, message}` (JSON Pointer into the input) |
| `UNKNOWN_ID` | 4 | an input refers to an ID that does not exist |
| `ID_IN_USE` | 4 | an input supplies an ID that already exists |
| `BEFORE_MISMATCH` | 4 | `proposal new` got a `before` that differs from the note's current value |
| `TARGET_NOT_EMPTY` | 5 | `init` target is non-empty and `--force` not given |
| `ALREADY_A_BRAIN` | 5 | `init` target already has `brain.json` |
| `OUTSIDE_ROOT` | 5 | a write would land outside its allowed root |
| `INTERNAL` | 10 | unexpected failure |

Batch commands (`note new`, `proposal new`, `apply`, `sync apply`) also report **per-item** results with their own `reason` codes, listed under each command.

### 3.6 Write safety

1. **Validate, then write.** A command builds every file it will write in memory and validates it (schema + the lint rules that concern those files) before the first write.
2. **Atomic files.** Each file is written to a temp file in the same directory and renamed (CX-02 `fs-safe.ts`).
3. **Atomic batches.** `note new` and `proposal new` write all items or none. `apply` and `sync apply` are atomic **per item** (schema §11.2): an item's writes all land or none do; other items still proceed. If a write fails mid-way, the command restores the files it had already replaced, from in-memory originals, and deletes the files it had created.
4. **Containment.** Each command has one allowed root (the brain, except `init`, `link`, and `init --set-default`). Paths are resolved (symlinks included) before writing; anything outside → `OUTSIDE_ROOT`.
5. **Format.** Written files follow schema §1: UTF-8, LF, one trailing newline, YAML 1.2 core, block style, frontmatter keys in the order of the type's JSON Schema `properties` for new files; existing files keep their key order and unknown keys (CX-02 round-trip).
6. **`updated`.** Commands set `updated` to today's date (UTC, from `--now`) when they change a note's content. Changes to system fields only (`notion`, `last_synced`, `tasks`, `notion_fields`) do not change `updated`.

### 3.7 What counts as a note

The CLI scans these folders under the brain root: `areas/`, `goals/`, `projects/`, `archive/`, `knowledge/`, `sources/`, `memories/`, `_proposals/`. Every `*.md` file there must have frontmatter with an `id` (lint error `not-a-note` otherwise). Files elsewhere (root `AGENTS.md`, `CLAUDE.md`, `README.md`, `index.md`, `log/`, dot-folders) are not notes.

### 3.8 Slugs and paths for new files

Slug of a title: Unicode NFKD, drop combining marks, lowercase, replace every run of characters outside `[a-z0-9]` with `-`, trim `-` at both ends, cut to 60 characters at the last `-` before the limit (or hard-cut if there is none), and use `note` if empty. `"María López — PM"` → `maria-lopez-pm`.

Path by type (schema §2). Dated types use the note's `date`, else `file_date` from input, else `created`:

| Type | Path |
|---|---|
| area, goal | `areas/<slug>.md`, `goals/<slug>.md` |
| project | `projects/<slug>/project.md` |
| person, org, question, concept | `knowledge/people/<slug>.md`, `knowledge/orgs/…`, `knowledge/questions/…`, `knowledge/concepts/…` |
| meeting, decision | `knowledge/meetings/<date>-<slug>.md`, `knowledge/decisions/<date>-<slug>.md` |
| source | `sources/notion/<date>-<slug>.md` |
| memory | `memories/<YYYY>/<MM>/<date>-<slug>.md` |
| proposal | `_proposals/<created>-<slug>.md` |

If the path exists (for projects: the folder), append `-2`, `-3`, … to the slug until it is free.

### 3.9 Log lines

Write commands append to `log/<YYYY-MM>.md` (month of `--now`), creating it with the first line `<!-- GENERATED by brain. Append-only. -->` and a blank line. One line per item written (schema §13):

```text
- <timestamp> <op> <id> "<title>"[ <key>=<value>]…
```

`"` and `\` in titles are escaped with `\`. Values with spaces are quoted the same way. Ops written by the CLI: `init`, `note-new`, `proposal-new`, `apply`, `correct`, `sync-create`, `sync-update`. Skills add their own (`ingest`, `publish`) with `brain log` (§5.11). `index` and `views` do not log.

---

## 4. Brain resolution

Every command except `init` resolves the brain in this order (CX-02 `brain-path.ts`, 0014):

1. `--brain <path>`
2. `BRAIN_DIR` environment variable (non-empty)
3. `~/.config/ultimate-brain/config.json` → `{"brain": "<path>"}` (`~` expanded; relative paths resolved against the config file's folder)

The first one present wins; later ones are not consulted even if the first is invalid. There is **no** discovery from the current directory. Then:

- path missing or no `brain.json` → `BRAIN_NOT_FOUND`
- the path itself contains both `spec/cli.md` and `src/cli.ts` → `BRAIN_IS_PRODUCT_REPO`. Only the path itself is checked, so a test fixture brain inside the product repo (`tests/fixtures/brain-acme/`) resolves normally
- `brain.json` fails [brain.schema.json](schemas/brain.schema.json) → `BRAIN_CONFIG_INVALID`; `schema_version` ≠ 1 → `SCHEMA_VERSION_UNSUPPORTED`

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
3. Copy the template. Write `brain.json` from the template with `schema_version: 1` and `owner.name` = `--owner` (default: the `user.name` from `git config`, else `"Owner"`).
4. Run `index` (an empty index).
5. Unless `--no-git`: `git init`, add all, commit `init: ultimate brain (schema v1)`. If Git is missing or the commit fails (no identity), keep the files, skip the commit and add warning `GIT_COMMIT_SKIPPED`.
6. With `--set-default`: write `~/.config/ultimate-brain/config.json` = `{"brain": "<abs path>"}`, replacing any existing one (its old value is reported).
7. Log `- <timestamp> init - "<owner name>" schema=1` (no machine paths in the log).

```sh
brain init ~/brain --owner "Rodrigo" --set-default --json
```
```json
{ "ok": true, "command": "init", "brain": "/Users/me/brain", "warnings": [],
  "data": {
    "path_abs": "/Users/me/brain",
    "created": ["AGENTS.md", "CLAUDE.md", "brain.json", ".gitignore", "index.md", "log/2026-12.md"],
    "skipped": [],
    "git": { "initialized": true, "committed": true },
    "default_config": { "written": true, "path_abs": "/Users/me/.config/ultimate-brain/config.json", "previous": null }
  } }
```

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

Writes **new** notes (lifecycle `draft`, 0003). Used by the ingest skill and by `sync apply` for Notion-created rows. Never modifies an existing note; changes go through `proposal new`. Types `view` and `proposal` are refused (use `views` and `proposal new`).

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
        "decided_in": "mtg-8c4n2p7w",
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

The CLI sets `created` = `updated` = today, `lifecycle: draft` (knowledge types), and for sources `content_hash` (schema §4, over the body as written) and `captured` (default now). References in `frontmatter` may point to existing notes **or to other notes in the same batch**. The batch is validated as if written: schema, IDs, folder, references, and every lint error rule (§5.10) that concerns the new files. Any error → `INPUT_INVALID` and nothing is written.

**Source dedupe:** if a source with the same `content_hash` already exists, that item is not written and is reported in `skipped` with the existing id. This is how the ingest skips minutes it has already ingested (synthesis §5 step 2). Other items in the batch that reference the skipped source's input `id` are an error, so the skill must check `skipped` with `--dry-run` first, or snapshot the source in its own batch.

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

Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (incl. refused type, forbidden key, lint error in a new file), `ID_IN_USE`, `UNKNOWN_ID`.

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
- checks per kind: `target` exists (all kinds except `new_item`); `contradiction` needs a current `facts.<field>`; `supersede` needs `supersedes` to exist, differ from `target`, have the same type, and not already be superseded; `merge` needs `merge_into` to exist, differ from `target`, same type; `new_item.content` must be a full note (frontmatter + body) that would pass `note new` (its `id` may be absent);
- **dedupes:** an item equal to an existing `pending` proposal on (`kind`, `target`, `field`, `after`, `content`, `supersedes`, `merge_into`) is skipped (`DUPLICATE_PENDING`), so re-running an ingest does not duplicate review rows.

Proposals are written with an empty body. Logs `proposal-new <id> "<title>" kind=<kind> target=<target>`.

```json
{ "data": {
    "created": [ { "id": "prp-4n8c2w7t", "kind": "update_fact", "title": "Acme launch: Jan → Feb", "target": "prj-9x4t1b7e", "path": "_proposals/2026-12-03-acme-launch-jan-feb.md", "before": "2027-01" } ],
    "skipped": [ { "input_index": 1, "reason": "DUPLICATE_PENDING", "existing": "prp-6t2m9c4k" } ],
    "dry_run": false
} }
```

Errors: `INPUT_INVALID`, `UNKNOWN_ID`, `BEFORE_MISMATCH`.

**`proposal list`** returns proposals filtered by status (default all) and target, sorted by `created` then id. Each item has every frontmatter field plus `path`.

```json
{ "data": { "proposals": [ { "id": "prp-4n8c2w7t", "kind": "update_fact", "status": "pending", "title": "Acme launch: Jan → Feb", "target": "prj-9x4t1b7e", "field": "launch_date", "before": "2027-01", "after": "2027-02", "from": "2026-12-03", "why": "…", "source": "mtg-8c4n2p7w", "created": "2026-12-03", "updated": "2026-12-03", "path": "_proposals/2026-12-03-acme-launch-jan-feb.md" } ] } }
```

### 5.7 `brain apply`

```text
brain apply [--input <file|->] [--dry-run]
```

Applies **decided** proposals (schema §11.1–11.2) and **your Notion corrections** (0023). Deterministic; touches only the targets of the listed items, except `merge`, which rewrites references to the retired note across the brain (schema §11.2). Without `--input`, applies proposals whose file already holds a `decision` but whose status is not terminal (a retry after a failure).

**Input** (both arrays optional, at least one non-empty):
```json
{
  "decisions": [
    { "proposal": "prp-4n8c2w7t", "action": "approve", "decided_at": "2026-12-04T08:15:00Z", "decided_by": "notion" },
    { "proposal": "prp-6t2m9c4k", "action": "edit", "value": "Product lead", "decided_at": "2026-12-04T08:16:00Z", "decided_by": "notion" }
  ],
  "corrections": [
    { "target": "per-3h8w2n6c", "field": "facts.role", "value": "Product lead", "observed_at": "2026-12-05T09:00:00Z" }
  ]
}
```

**Decisions**, processed in input order (later items see earlier results):

| Proposal state | Result |
|---|---|
| `applied` or `closed` | `skipped`, reason `ALREADY_TERMINAL` (no-op, schema §11.1) |
| `pending` | write `decision` and the matching status, then apply in the same item operation |
| `approved`/`edited`/`rejected` with the same decision | apply |
| `approved`/`edited`/`rejected` with a different decision | `failed`, `DECISION_CONFLICT` |

Before applying `update_fact` or `contradiction`, the target's current `facts.<field>` must still equal the proposal's `before` (both absent counts as equal). Otherwise `failed`, `STALE_PROPOSAL`, proposal unchanged: re-review it. Other item failures: `EDIT_NOT_ALLOWED` (edit on a kind that forbids it, schema §11.1), `UNKNOWN_ID` (proposal or target missing), `INVALID_RESULT` (the result would fail schema or lint, e.g. an edited value of the wrong shape). `new_item` approval writes the note with the `note new` rules. Each applied or closed proposal logs `apply <prp-id> "<title>" result=<applied|closed>`.

**Corrections** (0023). `field` is one of:

| `field` | Effect |
|---|---|
| `facts.<key>` | As `update_fact` with `source: notion-edit`, `from` = `learned` = date of `observed_at`: accepted entries for the key become `superseded` with `until`; append the accepted entry; set `facts.<key>` |
| `title`, `summary`, `why` | Replace the value. These are not facts, so no timeline entry; Git keeps the history |
| `area`, `goal`, `client`, `org` | Set to the given ID (right prefix, must exist) or remove when `value` is `null` |
| `people` | Replace with the given list of `per-` IDs |

A value equal to the current one → `skipped`, `NO_CHANGE`. Any other field → `failed`, `FIELD_NOT_CORRECTABLE`. Sets `updated` to the date of `observed_at`. Logs `correct <id> "<title>" field=<field>`.

```json
{ "data": {
    "dry_run": false,
    "decisions": [
      { "proposal": "prp-4n8c2w7t", "kind": "update_fact", "action": "approve", "result": "applied", "changed": ["projects/acme-website/project.md", "_proposals/2026-12-03-acme-launch-jan-feb.md"] },
      { "proposal": "prp-6t2m9c4k", "kind": "update_fact", "action": "edit", "result": "failed", "reason": "STALE_PROPOSAL", "message": "facts.role is \"Product lead\", proposal expected \"Designer\"", "changed": [] }
    ],
    "corrections": [
      { "target": "per-3h8w2n6c", "field": "facts.role", "result": "applied", "changed": ["knowledge/people/maria-lopez.md"] }
    ],
    "summary": { "applied": 1, "closed": 0, "corrected": 1, "skipped": 0, "failed": 1 }
} }
```

Exit 1 if any item `failed`. Errors (whole command): `INPUT_UNREADABLE`, `INPUT_INVALID`.

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
- With `--check`: `written: false`, `stale` = would change.

### 5.9 `brain views`

```text
brain views [--project <id>] [--check]
```

Regenerates `brief.md` and `decision-log.md` for every project (in `projects/` and `archive/projects/`), or one project, per schema §16 (CX-07). Creates missing view files (with a new `vw-` id). Replaces only the generated block; the `@user` block is preserved byte for byte. Idempotent per schema §16.

```json
{ "data": {
    "projects": 1,
    "written": ["projects/acme-website/brief.md"],
    "created": [],
    "unchanged": ["projects/acme-website/decision-log.md"],
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

Issues are sorted by `path`, `line`, `rule`. `line` is 1-based: the line of the offending frontmatter key or body line, or 1 when not locatable. `id` is `null` when the file has no readable id.

| Rule | Sev | Schema §15 item |
|---|---|---|
| `not-a-note` | error | `.md` in a note folder without frontmatter `id` (§3.7) |
| `unparseable` | error | frontmatter is not valid YAML |
| `schema` | error | frontmatter fails the JSON Schema (incl. missing required field, summary > 400) |
| `brain-config` | error | `brain.json` fails its schema |
| `id-format` | error | malformed ID or prefix not matching the type at creation |
| `id-duplicate` | error | same ID in two files |
| `wrong-folder` | error | type outside its folder (schema §2) |
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
| `memory-scope` | error | memory reach lists do not match `scope` |
| `proposal-status` | error | proposal `status` and `decision` do not match schema §11.1 |
| `unknown-key` | warning | frontmatter key not in the schema |
| `freshness` | warning | schema §10 |
| `summary-length` | warning | summary longer than 200 characters |
| `no-sources` | warning | knowledge note without `sources` (except area, goal, project created in Notion) |
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

Connects a consuming repo to the brain (0006, 0009; CX-08). Allowed root: `<repo-path>`; writes only `.brain`, `AGENTS.md`, `CLAUDE.md` there. Refuses if `<repo-path>` is the brain or the product repo (`OUTSIDE_ROOT`).

1. **`.brain`** (JSON, committed with the repo; holds no machine paths):
   ```json
   { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["nextjs", "supabase"] }
   ```
   `repo` = `--repo-name`, else the folder name. `area` defaults to the project's `area`. `stacks`: lowercase kebab-case, deduped, sorted. If `.brain` exists, options given replace their keys; others are kept. All keys optional; `project`/`area` must exist in the brain.
2. **Instruction block** in `AGENTS.md` (created if missing). If `CLAUDE.md` exists and has no line `@AGENTS.md`, the block is also written there; if `CLAUDE.md` does not exist, it is created with the single line `@AGENTS.md`. The block sits between the lines `<!-- ultimate-brain:start -->` and `<!-- ultimate-brain:end -->`; an existing block is replaced in place, otherwise it is appended after one blank line. Nothing outside the markers changes.

Block text (normative; `{…}` filled from the brain; lines for absent project/area omitted):

```markdown
<!-- ultimate-brain:start -->
## Ultimate Brain

Managed by `brain link`; edits inside this block are overwritten.

This repo is linked to the user's second brain: project {project title} (`{project id}`), area {area title} (`{area id}`). The brain holds decisions, key facts, people and meeting history that this repo does not.

Consult it before you:
- make or revisit a decision about scope, architecture, vendors or the client;
- answer why something was decided, who someone is, or a date, budget or owner;
- rely on a fact about the client or project that this repo does not state.

How: use the `brain-query` skill, or run `brain query --candidates "<question>" --json` and read the notes it returns. Cite the note paths. Say when a fact is `contested` or `superseded`.

The brain is read-only from this repo. Never edit its files from here.
<!-- ultimate-brain:end -->
```

Idempotent: a second run with the same options changes no bytes.

```json
{ "data": {
    "repo_abs": "/Users/me/code/acme-api",
    "marker": { "path": ".brain", "written": true, "value": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["nextjs", "supabase"] } },
    "files": [ { "path": "AGENTS.md", "action": "created" }, { "path": "CLAUDE.md", "action": "created" } ]
} }
```
`action` is one of `created`, `updated`, `unchanged`. Paths here are relative to the repo.

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
brain sync record --input results.json  → stores page ids and last_synced; git commit
```

**Pull before push.** Skills always run `plan`/`apply` before publishing, so your Notion edits are read before the brain republishes over them.

#### 5.14.1 Snapshot (input to `sync plan`)

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
- Property names are the Notion names (schema §14, notion-space-design §3). Values: title, text, select, status, url, email → string or `null` (empty string counts as `null`); number → number or `null`; checkbox → boolean; date → `{"start": "...", "end": "..."|null}` or `null`; relation → array of page ids; formula and rollup → their scalar result. A property missing from `properties` was not read and is not compared.

#### 5.14.2 `brain sync plan`

```text
brain sync plan --input <snapshot|->
```

Read-only. Compares each row with the brain and returns a plan. Notes are matched by `Brain ID`; the brain's map of `notion` page ids resolves relations.

**Rows with empty `Brain ID`:**
- In `areas`, `goals`, `projects`, `people`, `orgs` → a `create` item (0021): a `note new` input with a pre-generated id, `title` = Name, `summary` = Summary (or Name if empty), `notion` = page id, `sources: ["notion:<page_id>"]`, `last_synced` = `as_of`, brain-owned properties mapped as in the correctable table below, relations resolved to brain ids (rows created in the same plan count), and `notion_fields` from the Notion-owned properties. A required field that cannot be filled (goal without Why or Area, project without Area) or a relation to a page the brain does not know → a `conflict` instead (`MISSING_REQUIRED`, `UNRESOLVED_RELATION`).
- In `decisions`, `questions`, `review` → `ignored`, `NOT_CREATED_IN_NOTION` (those rows are created by the brain only).
- `key_results` rows never have a Brain ID; see below.

**Rows with a `Brain ID`:**
- No such note → conflict `UNKNOWN_BRAIN_ID`. The note's `notion` differs from `page_id` → conflict `NOTION_ID_MISMATCH`. The note has no `notion` → `updates` sets it.
- **Notion-owned** properties → the type's `notion_fields` (table below), plus `as_of`. If any value differs from the stored snapshot (ignoring `as_of`) → an `updates` item with the full new `notion_fields`.
- **Lifecycle** (yours, but agents also set `draft`/`archived`): if Notion differs **and** `last_edited` > the note's `last_synced` (or it has none) → `updates` sets `lifecycle` (`Reviewed` → `reviewed`).
- **Brain-owned** properties that differ from what `sync render` would publish now:
  - `last_edited` ≤ note `last_synced` → Notion is just stale; nothing (the next render republishes);
  - else, if the note's `updated` date is later than its `last_synced` date → conflict `BOTH_CHANGED` with both values (you and the brain both changed it; the skill asks you);
  - else → a `corrections` item (0023) if the property is correctable, otherwise `ignored`, `NOT_CORRECTABLE`.
- **Review rows** with `Decision` set, `State` = `Pending` → a `decisions` item for `brain apply`: `action` from Decision, `value` from Edited Value, `decided_at` = `last_edited`, `decided_by: notion`. Edited Value is converted to a number when the proposal's `after` is a number and the text is a finite number. `Edit` with empty Edited Value → conflict `EDIT_WITHOUT_VALUE`. A proposal already terminal → `ignored`, `ALREADY_TERMINAL`.
- **Key Results** rows are grouped by their `Goal` relation into the goal's `notion_fields.key_results` (sorted by name, then page id), compared like other Notion-owned fields. A Key Result whose goal the brain does not know → `ignored`, `UNKNOWN_GOAL`.

**Property ownership per database** (schema §14; Name and Summary are brain-owned everywhere, Brain ID and Last Synced are system):

| Database | Notion-owned → `notion_fields` | Correctable brain-owned → correction `field` |
|---|---|---|
| areas | Type → `type`, Archived → `archived` | Name → `title`, Summary → `summary` |
| goals | Status → `status`, Progress → `progress`, Archived → `archived`, Key Results → `key_results` | Name, Summary, Why → `why`, Deadline (start) → `facts.deadline`, Area → `area` |
| projects | Status → `status`, Priority → `priority`, Dates → `dates`, Archived → `archived` | Name, Summary, Key Facts → `facts.<key>` (Key Facts text, §5.14.4), Area → `area`, Goal → `goal`, Client (first) → `client`, People → `people` |
| people | Email → `email` | Name, Summary, Role → `facts.role`, Org (first) → `org` |
| orgs | Relationship → `relationship`, Website → `website` | Name, Summary |
| decisions | — | Name, Summary |
| questions | Status → `status` | Name, Summary |

Other brain-owned properties (Assessment, Supersedes, Decided In, Raised In, Kind, the inverse relations) are not correctable in v1: a difference is `ignored` with `NOT_CORRECTABLE` so the skill can tell you. Key Facts: a key removed in Notion is `ignored` (`FACT_REMOVAL_NOT_SUPPORTED`); a new key is a correction that adds the fact.

```json
{ "data": {
    "as_of": "2026-12-05T09:00:00Z",
    "create": [ { "type": "org", "id": "org-5h2k8q1w", "title": "Globex", "frontmatter": { "summary": "Globex", "notion": "…", "sources": ["notion:…"], "last_synced": "2026-12-05T09:00:00Z", "notion_fields": { "as_of": "2026-12-05T09:00:00Z", "relationship": "Prospect" } }, "body": "" } ],
    "updates": [ { "id": "prj-9x4t1b7e", "notion_fields": { "as_of": "2026-12-05T09:00:00Z", "status": "Active", "priority": "High", "dates": { "start": "2026-10-01" }, "archived": false } } ],
    "corrections": [ { "target": "per-3h8w2n6c", "field": "facts.role", "value": "Product lead", "observed_at": "2026-12-05T08:40:00Z" } ],
    "decisions": [ { "proposal": "prp-4n8c2w7t", "action": "approve", "decided_at": "2026-12-04T08:15:00Z", "decided_by": "notion" } ],
    "conflicts": [ { "database": "goals", "page_id": "…", "brain_id": null, "code": "MISSING_REQUIRED", "message": "goal \"Write a book\" has no Area" } ],
    "ignored": [ { "database": "decisions", "page_id": "…", "brain_id": "dec-7k2m9q4x", "property": "Assessment", "reason": "NOT_CORRECTABLE" } ]
} }
```

`observed_at` of a correction is the row's `last_edited`. Errors: `INPUT_UNREADABLE`, `INPUT_INVALID` (unknown database key, bad value shape).

#### 5.14.3 `brain sync apply`

```text
brain sync apply --input <plan|-> [--dry-run]
```

Executes a plan from `sync plan`: `create` (with `note new` rules, as one atomic batch; logs `sync-create`), `updates` (sets `notion`, `lifecycle`, `notion_fields`; does not change `updated`; logs `sync-update`), then `corrections` and `decisions` (with `brain apply` rules). Every note it changes gets `last_synced` = the plan's `as_of`. `conflicts` and `ignored` are not executed; they are echoed for the skill to report.

Preconditions are re-checked (the brain may have changed since the plan): a create id now in use, or an update/correction target now missing → that item `failed`. `data` = `{ "create": […], "updates": […], "corrections": […], "decisions": […], "conflicts": […], "ignored": […], "summary": {…} }`, each executed item with `result` and `changed` as in `apply`. Exit 1 if any item `failed`.

#### 5.14.4 `brain sync render`

```text
brain sync render (--changed | --ids <id>[,<id>…])
```

Builds Notion payloads; writes nothing. The skill sends them through the MCP.

**`--changed`** selects: notes of a published type (area, goal, project, person, org, meeting, decision, question) with no `notion` (except meetings), or no `last_synced`, or `updated` ≥ the date of `last_synced`; projects whose views have `generated_at` > the project's `last_synced`; and proposals with `status: pending` and no `notion`. The `≥` republishes notes changed on the day of their last sync; publishing is idempotent, so this only costs a few repeated writes. Notes whose database id is empty in `brain.json` are skipped with warning `DATABASE_NOT_CONFIGURED`.

Each item:
```json
{
  "id": "per-3h8w2n6c", "type": "person", "database": "people", "database_id": "…",
  "page_id": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d", "action": "update",
  "properties": {
    "Name": { "type": "title", "value": "Maria López" },
    "Summary": { "type": "rich_text", "value": "Product lead at Acme." },
    "Role": { "type": "rich_text", "value": "Product lead" },
    "Org": { "type": "relation", "value": ["9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d"] },
    "Brain ID": { "type": "rich_text", "value": "per-3h8w2n6c" },
    "Last Synced": { "type": "date", "value": { "start": "2026-12-05T09:00:00Z", "end": null } }
  },
  "body": "## Role history\n- 2026-12-03: Product lead …\n",
  "pending_relations": []
}
```

- `action`: `create` when the note has no `notion`, else `update`. Meetings are always `update` (the meeting page exists, 0007); a meeting without `notion` → item error in `errors`.
- **Properties rendered:** Name, Summary, Brain ID, Last Synced (= `--now`) and the brain-owned properties in the correctable table above, plus Decisions: Date, Assessment, Project, Decided In, Supersedes; Questions: Kind, Project, Raised In; Goals: Area; Meetings: Attendees, Project (`projects[0]`), Area, Decisions, Questions, Brain Status = `Ingested`, Brain ID (Name, Date and body are **never** rendered for meetings). Notion-owned properties are never rendered. **Lifecycle** is rendered only on `create` (`Draft`) or when the brain set it to `archived`.
- **Values:** select labels capitalize each word (`provisional` → `Provisional`, `update_fact` → `Update Fact`); dates as `{start, end}`; relations as Notion page ids of published notes. References to notes not yet published go to `pending_relations` (`[{ "property": "Org", "ids": ["org-…"] }]`); the skill publishes those first, records them, and renders again.
- **Body** (the brain-owned part of the page; the skill keeps the "My notes" toggle, notion-space-design §2): the note body with `^[inferred]` → ` (AI inference)` and `^[ambiguous]` → ` (ambiguous)`, and relative links to published notes rewritten to `https://www.notion.so/<page id without dashes>` (unpublished → plain title text). Projects: `## Brief` + the brief's generated block, then `## Decision log` + the decision log's generated block. Meetings and proposals: `null`.
- **Proposals** → the Review database: Name = `title`; Kind; Target = `<target title> (<target id>)`; Target Page = the target's Notion URL if published; Before / After (for `supersede`: old / new note title; `merge`: duplicate / survivor title; `add_to_note` and `new_item`: After = `content`, cut to 2000 characters); Why; Source Meeting = relation when `source` is a published meeting; State = `Pending`; Brain ID.

`data` = `{ "items": […], "errors": [ { "id": "…", "reason": "MEETING_NOT_PUBLISHED" } ] }`. Exit 1 if `errors` is non-empty (the other items are still returned); `UNKNOWN_ID` for `--ids` is a whole-command error.

**Key Facts text** (projects, rendered and parsed back by `sync plan`): one segment per `facts` key, sorted by key, joined by ` · `; segment = `<Label>: <value>`, label = key with `_` → space and the first letter uppercased; person-id values render as the person's title. Parse: split on ` · `, then on the first `: `; label → key by lowercasing and space → `_`; a person title (or alias) maps back to its id (ambiguous → conflict `AMBIGUOUS_PERSON`). Values containing ` · ` are not supported in v1. Example: `Budget: 80000 EUR · Launch date: 2027-02 · Owner: Maria López`.

#### 5.14.5 `brain sync tasks`

```text
brain sync tasks --meeting <mtg-id> --input <file|->
```

Renders Notion task payloads for a meeting's action items using the `brain.json` Tasks mapping (0018, schema §12); writes nothing.

Input: `{ "items": [ { "title": "Send Supabase migration plan", "owner": "Carlos Ruiz", "due": "2026-12-10" } ] }` (`owner`, `due` optional).

Each item → `{ "database_id": "…", "properties": { "<mapped name>": {type, value} }, "body": "…"|null }`: title; due; status = `new_task_status`; project and area relations from the meeting's `projects[0]` and `area` (when published and mapped); owner as text; meeting relation (`meeting`), else meeting URL (`meeting_url`), else the first body line `Meeting: <meeting Notion URL>`; brain_id = the meeting id. Unmapped (empty) properties are left out. After creating them, the skill records the task page ids with `sync record`.

Errors: `UNKNOWN_ID`, `BRAIN_CONFIG_INVALID` (Tasks database or title mapping empty).

#### 5.14.6 `brain sync record`

```text
brain sync record --input <file|->
```

Stores what the skill published. Input: `{ "records": [ { "id": "per-3h8w2n6c", "notion": "6a7b…", "synced_at": "2026-12-05T09:01:10Z", "tasks": ["…"] } ] }`.

- `notion`: set if absent; if present and different → item `failed`, `NOTION_ID_MISMATCH`.
- `synced_at` → `last_synced` (knowledge notes only).
- `tasks` (meetings only): appended to the meeting's `tasks`, deduped, order kept.
- Proposals: only `notion` is stored.
- Does not change `updated`; does not log (the skill logs `publish`).

`data` = `{ "records": [ { "id": "…", "result": "recorded"|"failed", "reason"?: "…", "changed": ["…"] } ] }`. Exit 1 if any failed.

---

## 6. Standard sequences (for skills)

| Flow | Sequence |
|---|---|
| **Ingest one meeting** (CC-06) | `status` → `index` (JSON, for matching) → `note new --dry-run` with the source (check `DUPLICATE_SOURCE`) → `id new` for the new notes → `note new` (source, meeting, people, decisions, questions) → `proposal new` → `index` → `views` → `lint` → `log ingest <mtg> created=… proposals=… tasks=…` → `git commit` → `sync tasks` + MCP → `sync render --changed` + MCP → `sync record` → `git commit` |
| **Apply reviews** (CC-09) | MCP read Review rows → `sync plan` → `sync apply` → `index` → `views` → `lint` → commit → `sync render --changed` + MCP (also set Review State from the apply results) → `sync record` → commit |
| **Apply in chat** | `proposal list --status pending` → ask → `apply` with `decided_by: chat` → `index` → `views` → `lint` → commit |
| **Sync** (CC-08) | as §5.14 |
| **Query** (CC-10) | `query --candidates` → read the top notes → answer with citations |

A run never leaves lint errors it introduced: if `lint` reports new errors after a write, the skill stops before committing and reports them.

---

## 7. Open points for review

- Corrections to `title`, `summary`, `why` are applied without a timeline entry (Git holds the history). Decision 0023 speaks of timeline entries for facts; this reading keeps the timeline for facts only.
- `BOTH_CHANGED` uses the `updated` date, so a brain change and your Notion edit on the same day as the last sync are not told apart: the Notion edit wins as a correction. Rare, and recoverable from the timeline and Git.
