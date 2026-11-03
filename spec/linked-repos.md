# Linked repos and the link kit (contract, decision 0066)

**Status:** contract for release 0.9.0. Written by Claude Code in CC-99.

How this file fits: [cli.md §5.29](cli.md) holds the commands, [schema.md §12](schema.md) the `repos` entry of `brain.json`, and [schemas/link-kit.schema.json](schemas/link-kit.schema.json) the kit's shape. This file holds the model, the kit's meaning, the rollup, the health check and the starter. Connected task tracking is [connected-workflows.md](connected-workflows.md). When this file and the JSON Schema disagree, the JSON Schema wins and this file is fixed.

**Choices in this contract that the user may veto.** Each one is the simplest reading of 0066:
1. The kit is `brain-kit.json` at the repo root. It is visible and committed with the repo, and the hub reads it from the working tree (§2.1).
2. "Written once" means that **the kit is the only file the hub ever writes in a linked repo**. The first write needs the user's yes, and so does every change after it, each with the exact content shown (§3).
3. `tasks` may be left out of the kit: such a repo has knowledge but no tracked tasks (§2.4).
4. The Domain in the placement is a check, not an assignment: under 0055, a repo's Domain is its Area's Domain (§2.3).
5. Narrowing the patterns or adding a never-read path deletes nothing. The health check lists the knowledge that came from paths the kit now excludes (§6, `NEVER_READ_INGESTED`).
6. The hub writes no kit in the product repo, as `brain link` doesn't (§3). A product repo linked before 0.9.0 keeps working without a kit.
7. The rollup is a derived view. It is written into a brain-owned toggle on the Project or Area page, `Repo tasks · <name>`, and is never stored in Git (§4).

---

## 1. Model

- **Hub:** the user's one brain, the only store and the only writer to Notion (0042, 0066).
- **Linked repo:** a Git repo that the hub reads as a source (0042). The hub reads it with read-only Git commands, ingests the files that match its patterns, and **never writes to it, except its kit** (§3).
- **Link kit:** a file in the linked repo that says how the hub reads that repo: what to read and never read, where its tasks live, how its statuses map, how work is done there, and where the repo sits in the hub (Area, Domain, Project).
- **Task mode:** what the hub does with the repo's tasks.

  | Mode | Who owns the tasks | What the hub does |
  |---|---|---|
  | `connected` | Notion Tasks, through a connected workflow (0059) | Its Project or Area shows the workflow's dated summary (connected-workflows.md §9). The kit only declares the mode; the status mapping lives in the workflow record. |
  | `tracked-in-repo` | The repo: a Markdown plan, or GitHub or GitLab issues | Shows a **read-only rollup** on the Project or Area (§4). It writes nothing to the repo's tracker and creates no Notion task from it. The 0.10.0 brain assistant reviews the rollup. |
  | no `tasks` key | Nobody | No rollup and no workflow: knowledge only. |

- **Legacy link:** a `repos` entry without `kit` (0042, made with `repo add --pattern`). It keeps working as it does today, and the health check reports `NO_KIT` (info).

## 2. The kit file

### 2.1 Location and format
- `<repo root>/brain-kit.json`: UTF-8 JSON with a 2-space indent and a trailing newline. Keys are written in the order of §2.2.
- **The hub reads it from the working tree**, not from a commit, because the kit is configuration and the user may not have committed it yet. The health check reports a kit that differs from `HEAD`, or isn't tracked, as `KIT_UNCOMMITTED` (info).
- **Its hash** is the lowercase hex SHA-256 of the file's bytes, written `sha256:<64 hex>`. `brain.json` records the hash of the kit it last applied (§5).
- **The kit itself is never ingested**, even when a pattern matches it.

### 2.2 Fields

```json
{
  "kit_version": 1,
  "name": "acme-api",
  "placement": { "area": "area-2m7c4h8n", "domain": "dom-5k8p2r7t", "project": "prj-9x4t1b7e" },
  "knowledge": {
    "patterns": ["decisions/**", "docs/**/*.md", "CHANGELOG.md"],
    "never_read": [".env*", "secrets/**", "docs/clients/**"]
  },
  "tasks": {
    "mode": "tracked-in-repo",
    "source": { "kind": "markdown", "path": "TASKS.md", "format": "checklist" },
    "status_map": { " ": "todo", "/": "in_progress", "x": "done", "-": "dropped" }
  },
  "methodology": {
    "summary": "Decisions are recorded in decisions/ before code changes; each change is a small PR reviewed before merge.",
    "files": ["AGENTS.md", "docs/process.md"]
  },
  "starter": { "name": "generic", "version": "0.9.0" }
}
```

| Field | Required | Meaning |
|---|---|---|
| `kit_version` | ✔ | `1`. A different value is `KIT_INVALID` with the message "kit version N needs a newer brain". |
| `name` | ✔ | The repo's name in the hub: lowercase kebab-case, the `name` of its `brain.json` `repos` entry. Sources record it as `repo` (schema §4). |
| `placement.area` | ✔ | The `area-` id that the repo's knowledge belongs to (as 0042's `area`). |
| `placement.domain` | — | A `dom-` id. It is a check, never an assignment (§2.3). |
| `placement.project` | — | A `prj-` id. The rollup and the summary go on this Project instead of the Area, and catch-up passes it as the project of the notes it ingests from the repo. |
| `knowledge.patterns` | ✔ | A non-empty list of Git glob pathspecs, relative to the repo root (0042's `patterns`). |
| `knowledge.never_read` | — | Git glob pathspecs that the hub never reads, **even when a pattern matches them**. They apply to ingest, the rollup and the methodology files. Absent means an empty list. |
| `tasks` | — | Absent: knowledge only (§1). |
| `tasks.mode` | ✔ with `tasks` | `connected` or `tracked-in-repo`. |
| `tasks.source` | ✔ with `tasks` | Where the tasks live (§2.4). `connected` takes `{ "kind": "notion" }` only. |
| `tasks.status_map` | — | `tracked-in-repo` only (on `connected` it is `KIT_INVALID`). Maps a raw status in the source to one of the six **status meanings** of connected-workflows.md §5.1: `todo`, `in_progress`, `waiting`, `review`, `done`, `dropped`. Each source kind has a default (§2.4), and the kit's entries are added to it, a kit entry winning on the same key. |
| `methodology.summary` | ✔ | At most 600 characters: how work is done in the repo, in plain words. The brain assistant and adoption read it; it is not ingested as knowledge. |
| `methodology.files` | — | Repo-relative paths of the documents that hold the methodology (e.g. `AGENTS.md`). They are read only when a pattern also matches them. |
| `starter` | — | `{ name, version }` of the starter that created the repo (§7). Informational. |

**Checks beyond the JSON Schema.** `brain repo kit check` runs them, and so does every command that reads a kit. Each one is `KIT_INVALID` with a JSON Pointer:
- an id in `placement` doesn't exist in the hub (`/placement/area`, …);
- `placement.project` belongs to an Area other than `placement.area`;
- `placement.domain` is given, Domains is on, and it isn't the Area's `domain`; or the Area has no Domain;
- a path in `methodology.files`, or the markdown `tasks.source.path`, matches `never_read`;
- `name` differs from the `repos` entry that the kit was read for.

With Domains off, `placement.domain` is ignored and not checked.

### 2.3 Placement follows the hub's rules
- **Domain follows the Area (0055).** A repo can't be placed in a Domain other than its Area's. The kit's `domain` exists so that a reader of the repo can see where it sits; the hub never writes a Domain from it.
- **Moving a repo** (a new Area or Project) is a change of the kit (§3) and then `repo refresh` (cli.md §5.29). Notes already ingested keep their `area` and `projects`; only new ingests use the new placement. `repo refresh` reports the change as `placement_changed`.

### 2.4 Task sources and their raw statuses

| `source.kind` | Fields | Raw status of an item | Default `status_map` |
|---|---|---|---|
| `markdown` | `path` (repo-relative file); `format`: `checklist` or `pattern`; with `pattern`, `pattern` | `checklist`: the character between the brackets of `- [c] title` (also with `*` or `+`). `pattern`: the named group `status` | `checklist`: `" "` → `todo`, `"x"` and `"X"` → `done`. `pattern`: none |
| `github` | `repo`: `owner/name` | `open`; `closed:completed`; `closed:not_planned`; `label:<name>` for each label | `open` → `todo`, `closed:completed` → `done`, `closed:not_planned` → `dropped` |
| `gitlab` | `project`: `group/name` (subgroups allowed) | `opened`; `closed`; `label:<name>` for each label | `opened` → `todo`, `closed` → `done` |
| `notion` | none | (connected only) | none |

- **`pattern` format.** A JavaScript regular expression (flag `u`) tried on each line of the file. It must have the named group `title`; `status` and `id` are optional. A line that doesn't match is not an item, and a line longer than 2,000 characters is skipped. Without a `status` group, every item's raw status is `""`, so the kit must map `""`. Example for headings such as `### CC-12 · Write the API · \`in progress\``: `"^### (?<id>[A-Z]+-\\d+) · (?<title>.+) · \`(?<status>[^\`]+)\`$"`.
- **Matching.** Raw statuses are matched case-insensitively after trimming. On GitHub and GitLab, an **open** issue with a `label:<name>` entry in the map takes that label's meaning (the first such label in the issue's label order); a closed issue ignores labels.
- **Item keys.** Each item has a stable key: the `id` group when the pattern has one; GitHub `#<number>`; GitLab `#<iid>`; otherwise `line:<sha256 of the trimmed title, first 12 hex>`. Adoption uses the same keys (connected-workflows.md §11.3).
- **A raw status that nothing maps** counts as `unmapped`. The rollup shows it, and the health check reports `STATUS_UNMAPPED` when it is given rollup data.

## 3. The one write: the kit, with the user's yes (0066)

- **The kit is the only file the hub writes in a linked repo.** It is written by `brain repo kit write` (cli.md §5.29), and only in these cases:
  - linking a repo that has no kit;
  - changing a link (a new placement, patterns, never-read paths, task source or mapping);
  - `brain repo new`, which writes the kit with the starter.
- **The yes is for the exact content.** The skill shows the whole kit (or, for a change, a unified diff against the current file) and writes only after the user says yes to that content. The command can't see the yes; the skill is the gate, as for every other write the user approves (0003). An unattended run never writes a kit.
- **Concurrent edits are refused.** A change passes `--replace <sha256>`, the hash of the kit the user saw. If the file changed since then, the write is refused (`KIT_CHANGED`) and the skill shows the new diff.
- **The hub never commits or pushes in the linked repo.** The skill tells the user to commit `brain-kit.json` there; until then the health check reports `KIT_UNCOMMITTED`.
- **Refused targets:** the brain (`REPO_IS_BRAIN`); the product repo (`OUTSIDE_ROOT`: its contents are public, and the kit holds brain ids); a `brain-kit.json` that is a symbolic link or a folder (`OUTSIDE_ROOT`).
- After the write, `brain repo add --kit` (a new link) or `brain repo refresh` (a change) applies the kit to `brain.json`.

## 4. The read-only rollup (tracked-in-repo)

- **What it is.** A short, dated summary of the repo's tasks, built by `brain repo tasks <name>` (cli.md §5.29) and written by the skill into the brain-owned toggle heading **`Repo tasks · <name>`** on the placement's Project page, or on the Area page when the kit has no project. As with the Brief, the skill appends the toggle when the page has none (docs/notion-space-design.md §2; CC-103 adds the toggle's name there). Several repos placed on one page get one toggle each.
- **When.** It is rebuilt in each catch-up that reads the repo, and whenever the user asks ("show the repo's tasks"). It isn't stored in Git: it is a view of data the brain doesn't own, like a Notion formula.
- **Read-only.** It changes nothing in the repo's tracker, creates no Notion task, and the brain never reads it back. To act on a task, the user works in the repo. To move a repo's tasks into Notion, the user turns it into a connected workflow through adoption (connected-workflows.md §11).
- **Data.**
  - `markdown`: the CLI reads the file at `HEAD` (`git -C <path> show HEAD:<path>`) and parses it (§2.4). Uncommitted changes give the warning `REPO_DIRTY`.
  - `github` and `gitlab`: the skill fetches the issues and passes them as `--input` (cli.md §5.29); the CLI never reaches the network.
- **Toggle text** (normative; `{…}` filled in; a line whose count is 0 is left out):

  ```markdown
  As of {D Mon YYYY, HH:MM} · from {name} ({source label}) · read-only
  {done} completed · {dropped} dropped · {open} open ({in_progress} in progress, {review} in review, {waiting} waiting, {todo} to do) · {percent}%
  - In progress: {title}
  - In review: {title}
  - Waiting: {title}
  - To do: {title}
  …and {n} more open
  Not mapped: "{raw}" ({count}). Map it in brain-kit.json.
  ```

  - `{source label}` is the file path, `GitHub owner/name` or `GitLab group/name`.
  - `{percent}` = done ÷ (total − dropped), rounded to a whole number. It is left out, with its ` · `, when there are no non-dropped items (0055).
  - Open items are listed in the order in progress, in review, waiting, to do, then in source order, at most 20 in all. An issue's title is a link to its URL.
  - The `{open}` count includes unmapped items. The "Not mapped" line lists each unmapped raw status with its count.
  - With no tasks at all, the toggle says `As of … · from … · no tasks found`.

## 5. `brain.json` `repos` (schema §12)

A kit adds three optional keys to a `repos` entry. Legacy entries don't change.
- `kit`: `{ "sha256": "sha256:<64 hex>" }`, the hash of the kit that was last applied by `repo add --kit` or `repo refresh`. When it is present, `area`, `patterns`, `never_read` and `project` are **copies taken from the kit** and are changed only by `repo refresh`.
- `never_read`: a list of Git glob pathspecs (absent means none). `repo changes` (cli.md §5.16) leaves out the files that match it, in a legacy entry too.
- `project`: a `prj-` id (absent means none).

The machine's `path` and the ingest state in `commit` stay in `brain.json` only; the kit holds neither.

## 6. Health check

`brain repo health [<name>]` (cli.md §5.29) is read-only. The skill runs it when the user asks about a link, and the 0.10.0 brain assistant reuses it. Each check is `{ code, severity, message, path? }`:

| Code | Severity | When |
|---|---|---|
| `PATH_MISSING` | error | `path` doesn't exist or isn't the top of a Git working tree |
| `KIT_MISSING` | error | the entry has `kit`, and the file is gone |
| `KIT_INVALID` | error | the kit fails its schema or a §2.2 check (with the pointer) |
| `KIT_CHANGED` | warning | the kit's hash differs from `kit.sha256`: run `repo refresh` |
| `KIT_UNCOMMITTED` | info | the kit isn't tracked, or differs from `HEAD` |
| `NO_KIT` | info | a legacy entry: the skill offers to write a kit |
| `PLACEMENT_ARCHIVED` | warning | the Area or Project is `archived` |
| `COMMIT_UNKNOWN` | error | the recorded `commit` isn't an ancestor of `HEAD` (rewritten history): the fix is `repo record --reset` |
| `CHANGES_WAITING` | info | files changed since the last ingest, with their count |
| `PATTERN_MATCHES_NOTHING` | warning | a pattern matches no file at `HEAD` (one check per pattern) |
| `NEVER_READ_INGESTED` | warning | a source of this repo has a `repo_path` that `never_read` now matches. Nothing is removed; the user can ask to archive its notes |
| `METHODOLOGY_FILE_MISSING` | warning | a `methodology.files` path doesn't exist at `HEAD` |
| `TASK_SOURCE_MISSING` | error | the markdown source path doesn't exist at `HEAD` |
| `STATUS_UNMAPPED` | warning | only with `--input` issue data, or with a markdown source: a raw status that nothing maps, with its count |
| `CONNECTED_WITHOUT_WORKFLOW` | warning | `tasks.mode` is `connected`, and no connected workflow record names this repo (connected-workflows.md §3) |
| `WORKFLOW_WITHOUT_CONNECTED` | warning | a connected workflow names this repo, and the kit's mode isn't `connected` |
| `BRAIN_LINK_STALE` | info | the repo has a `.brain` (§8) whose `project` or `area` differs from the placement |

The exit code is 1 when any check is an error, as for `lint`.

## 7. The generic starter

`brain repo new` (cli.md §5.29) starts a new repo from `templates/repo-starters/generic/` in the product package (0066). The generic starter is the only one in 0.9.0. Its files:

| File | Content |
|---|---|
| `README.md` | `# {name}` and the `methodology.summary` |
| `AGENTS.md` | How work is done here: record decisions in `decisions/` before acting on them; plans and notes in `docs/`; tasks in `TASKS.md` (tracked-in-repo) or in Notion (connected); never put secrets in the repo |
| `CLAUDE.md` | `@AGENTS.md` |
| `decisions/_template.md` | Title, Status, Date, Context, Decision, Consequences |
| `docs/README.md` | One line: what goes here |
| `TASKS.md` | `# Tasks` and one example line `- [ ] First task`. Written only with `tracked-in-repo` |
| `.gitignore` | `.env*` and `secrets/` |
| `brain-kit.json` | From the input kit, with `starter` set to `{ "name": "generic", "version": <package version> }` |

The starter's own kit defaults, which the skill proposes and the user may change before the write: `patterns` `["decisions/**", "docs/**", "README.md"]`, `never_read` `[".env*", "secrets/**"]`, `tasks` `tracked-in-repo` with `{ "kind": "markdown", "path": "TASKS.md", "format": "checklist" }`, and the `methodology.summary` of the starter's AGENTS.md in one sentence. The starter folder holds the kit as `brain-kit.template.json` with placeholder ids. Lint and the tests validate it with the placeholders replaced.

## 8. Offering `brain link` the other way

After a link (or `repo new`), the skill asks once: "Let this repo read the brain too? It adds `.brain`, a block in AGENTS.md and the brain-query skill there." On yes, it runs `brain link <path> --repo-name <name> --area <area>` (with `--project <project>` when the kit has one). This is the existing §5.12 command, a separate write with its own yes; it doesn't pass through the kit. On no, nothing is written, and it isn't asked again for this link. The answer goes in the skill's report.

## 9. Unlinking

`brain repo unlink <name>` (cli.md §5.29) removes the entry from `brain.json`.
- **The knowledge stays.** Sources keep `repo`, `repo_path` and `commit`; notes, Inbox rows and Documents are untouched.
- **The repo isn't touched.** `brain-kit.json` and any `.brain` stay. The skill tells the user they can delete them there.
- **The rollup goes.** The skill removes the `Repo tasks · <name>` toggle from the Project or Area page, with the same yes as the unlink.
- **A connected workflow isn't ended by an unlink.** The workflow runs in the repo, not in the link. The report names the workflow, and the user ends it separately (connected-workflows.md §3.4).
- **Linking again** under the same name starts with `commit: ""`. Files ingested before are found as duplicates by `note new` (cli.md §5.16, `--reset`).

## 10. The skill (written in the skills fork, 0059)

These are what the skill must do; the fork decides how it is worded. Every write is preceded by the content and the user's yes.
- **Link:** inspect the repo (top-level layout, instructions, plans, issue tracker), propose a kit (placement from the hub's Areas and Projects; patterns and never-read paths; mode and source; status mapping; methodology summary), show it, `repo kit write`, `repo add --kit`, offer §8, and, with tracked-in-repo, the first rollup. The first ingest stays attended (0042).
- **Show:** `repo show` and `repo health`, in two lines (skill-report rule).
- **Change:** propose the new kit as a diff, `repo kit write --replace`, `repo refresh`; when `reingest` is true, `repo record --reset` and a catch-up.
- **Unlink:** §9.
- **Health check:** `repo health`; for each error and warning, the fix in one line.
- **New repo:** ask for the name, folder, placement and mode; show the kit and the file list; `repo new`; `repo add --kit`; offer §8.

## 11. Acceptance (0.9.0's fourth scenario)

A synthetic hub (CC-41's fixture builder) links two synthetic repos:
- **A connected repo** whose Markdown plan is adopted into Notion tasks (connected-workflows.md §11). Its Project shows the workflow summary, and no rollup.
- **A tracked-in-repo repo** with a checklist `TASKS.md` and one unmapped status. Its Area shows the `Repo tasks · <name>` toggle with the counts of §4 and the "Not mapped" line.

Checks:
- each kit is written once, after the yes;
- nothing else is written in either repo (`git status` clean apart from the kit, and `.brain` if §8 was accepted);
- a file under `never_read` is never ingested even though a pattern matches it;
- a second link run changes nothing;
- unlinking the tracked repo keeps its notes, and the health check of the remaining repo reports no error.
