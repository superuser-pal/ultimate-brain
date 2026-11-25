# Linked repos and the link kit (contract, decision 0066)

**Status:** contract for release 0.9.0. Written by Claude Code in CC-99. Amended for 0.18.0 by CC-395: a linked repo is a Factory (§1.1), decision [0113](../decisions/0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md).

How this file fits: [cli.md §5.29](cli.md) holds the commands, [schema.md §12](schema.md) the `repos` entry of `brain.json`, and [schemas/link-kit.schema.json](schemas/link-kit.schema.json) the kit's shape. This file holds the model, the kit's meaning, the rollup, the health check and the starter. Connected task tracking is [connected-workflows.md](connected-workflows.md). When this file and the JSON Schema disagree, the JSON Schema wins and this file is fixed.

**Choices in this contract that the user may veto.** Each one is the simplest reading of 0066:
1. The kit is `brain-kit.json` at the repo root. It is visible and committed with the repo, and the hub reads it from the working tree (§2.1).
2. "Written once" means that **the kit is the only file the hub ever writes in a linked repo**. The first write needs the user's yes, and so does every change after it, each with the exact content shown (§3).
3. `tasks` may be left out of the kit: such a repo has knowledge but no tracked tasks (§2.4).
4. The Domain in the placement is a check, not an assignment: under 0055, a repo's Domain is its Area's Domain (§2.3).
5. Narrowing the patterns or adding a never-read path deletes nothing. The health check lists the knowledge that came from paths the kit now excludes (§6, `NEVER_READ_INGESTED`).
6. The hub writes no kit in the product repo, as `brain link` doesn't (§3). A product repo linked before 0.9.0 keeps working without a kit.
7. The rollup is a derived view. It is written into a brain-owned toggle on the Project or Area page, `Repo tasks · <name>`, and is never stored in Git (§4).

**Choices of 0.18.0 that the user may veto.** Each one is the simplest reading of 0113 and of the author's answers of 2026-11-23 (recorded in CC-395's row):

8. The kit names its plan files in a new optional key, `plan` (§2.2), so a repo whose tasks are in Notion, or that tracks none, still has a plan the overview can read. Nothing is guessed: a kit that names no plan shows "Plan: not found".
9. A repo that serves several Projects: its rollup (module off) goes on the Area page, `brain link` gets no `--project`, and each note the ingest takes from it is linked to the Projects it is about, not to all of them (§2.3).
10. A Project in another Area than the repo's is allowed (§2.2). 0.9.0 to 0.17.0 refused it.
11. With Factories on, the three-part message of §1.2 replaces §8's question. After an answer without the last part, the link back stays available on request.
12. `modules.factories` absent means "never asked". A link, or a folder connected, without it writes `false`, so the module is offered once; refusing the link itself ("no") leaves it absent, since nothing was linked (§1.2, schema §12).

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

- **Legacy link:** a `repos` entry without `kit` (0042, made with `repo add --pattern`). It keeps working as it does today, and the health check reports `NO_KIT` (info). Once a kit is written in its repo (§3), `repo refresh` adopts it and keeps the entry's `commit` (cli.md §5.29, CC-118).

### 1.1 A linked repo is a Factory (0.18.0, 0113 §1, §2, §4, §7)

A **Factory** is a working folder where agents build: a linked repo, or any other folder connected to the brain. Notion shows each one as a row of the **Factories** database (docs/notion-space-design.md §3.20).

- **One row per working folder.** Each linked repo, legacy links included, is one Factory. A folder that is not a linked repo becomes one when it is connected (connected-workflows.md §3.5). A linked repo and its workflow are one Factory, never two.
- **The record** is one entry of `brain.json` `factories` (schema §12) with a permanent `fac-` id. For a linked repo it names the `repos` entry, and its Area and Projects are read from there, where the kit put them (§2.3). A plain folder's entry holds them itself. There is no new note type.
- **The same id for life.** A folder linked first and connected later, connected first and linked later, or unlinked and linked again, keeps its entry, its id and its row (cli.md §5.39).
- **The brain owns the row.** Name, Area, Projects, Overview as of and Archived are written from Git and never read back. The user changes a Factory by changing the link, in the session. Workflow is the user's (connected-workflows.md §4.1).
- **One Area, several Projects.** A Factory has one Area, and its Domain follows that Area (0055). It may serve several Projects, in any Area, and a Project may be served by several Factories.
- **A module** (0048), `factories`, off in a new space. The first link, or the first folder connected, offers it, once (§1.2; connected-workflows.md §3.5). **With it off, linked repos behave as in 0.17.0:** no row, no overview, no Factory paragraph in the instruction block, and §4's toggle.
- **Turning it on** gives each `repos` entry that has no Factory an entry, in `repos` order (`brain modules on factories`, cli.md §5.20). The next publish creates the rows. A 0.17.0 `brain.json`, with `project` and no `factories`, stays valid and is read as it was.
- **Turning it off** deletes nothing: entries, rows and tasks stay, and nothing of them is read or written until it is on again (schema §12). A workflow whose destination is a Factory works locally meanwhile (connected-workflows.md §3.5).
- **The task mode says only where the detailed plan is tracked.** A `tracked-in-repo` repo is still a Factory: it has the overview, and the user may write tasks for it and connect it, with no change to its kit.
- **Never a Factory:** the brain's own repo. `repo add` and `factory add` refuse it (`REPO_IS_BRAIN`).
- **No new write in the folder** (0113 §7). The brain writes the kit (§3) and, when the user accepts the link back (§8), `.brain`, the instruction block and the skills. A connected folder also holds its pointer (connected-workflows.md §3.2), as since 0.9.0.

### 1.2 One message at linking (0.18.0, 0113 §4)

Linking a repo asks one message, with the kit's whole content above it (§3), and the user answers part by part:

```text
1. Link acme-api: the brain reads the files named above and writes brain-kit.json there.
2. Show it in Notion: turn on Factories. Each linked folder gets a row with your tasks for it and an overview of what is being built.
3. Connect its work: sessions in acme-api start from the tasks you write for it. Level: Tasks only. Work type: Software. Statuses: To Do, Doing, Waiting On, Done, Won't Do. It also writes .brain, a block in AGENTS.md and the brain skills there.
Answer: all / 1 / 1, 2 / no
```

- **Part 2 is shown only the first time,** while `modules.factories` is absent. With Factories on, the message has parts 1 and 3, numbered 1 and 2 (`all / 1 / no`), and part 1 ends "and its row in Notion". With `modules.factories` `false`, the module isn't offered again, and linking is 0.17.0's, §8's question included.
- **Parts run in order,** each after the one before it succeeded. An answer with 3 and without 2 is asked once more: "3 needs 2. All three?" A yes to 1 without 2 records that no with `brain modules off factories`, which is how "once" is kept.
- **Part 1** is §3 and `repo add --kit`. **Part 2** is `brain modules on factories`, the Notion steps of `notion/modules/factories.md`, and the publish of the rows (cli.md §5.14.4). **Part 3** is the setup of connected-workflows.md §3.5 with the Factory as its destination; its last step is the link back of §8.
- **Its effect on the kit.** None: connecting a Factory doesn't change `tasks`.
- **What fails stays undone,** and what succeeded before it stays: the report says which part is missing and the words that do it later ("connect acme-api").
- **A no to all** writes nothing: no repo was linked and the module wasn't answered, so the next link shows part 2 again. Only a link without part 2 is a no to the module.

The text is normative in its parts, order and answers; the words in part 1 to 3 name the repo, the level, the work type and the statuses the setup found.

### 1.3 The same outcome everywhere (0104 §7)

| Difference | How it is closed |
|---|---|
| Paths: `/…` and `~/…`, or `C:\…` on Windows | `repos` and `factories` accept the same forms (schema §12). Two paths name one folder when their real paths are equal, compared without case on Windows |
| Line endings of a file on disk (CRLF on Windows) | A plan file's text has each CRLF turned into LF before it is parsed or hashed (cli.md §5.39) |
| The scheduled catch-up: launchd, or Task Scheduler | 0.17.0's (cli.md §5.21). Its one named gap (a Mac that is off at a slot skips that run, weekly-review.md §11.1) leaves an overview one catch-up older, and "As of" says so: not a capability gap of this contract |
| Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md` | `brain link` writes the block in `AGENTS.md` and makes `CLAUDE.md` read it (cli.md §5.12) |
| Codex's sandbox can refuse a write outside the working folder, and the brain is outside it | As for every `brain workflow` command since 0.9.0: the user approves the command, or adds the brain's folder to Codex's writable roots. A refused write is reported as not saved, never as done |

## 2. The kit file

### 2.1 Location and format
- `<repo root>/brain-kit.json`: UTF-8 JSON with a 2-space indent and a trailing newline.
- **Key order when the hub writes it:**
  - top level: `kit_version`, `name`, `placement`, `knowledge`, `plan`, `tasks`, `methodology`, `starter`;
  - `placement`: `area`, `domain`, `project`, `projects`;
  - `knowledge`: `patterns`, `never_read`;
  - `tasks`: `mode`, `source`, `status_map`;
  - `source`: `kind`, then `path`, `format`, `pattern` (markdown), `repo` (GitHub) or `project` (GitLab);
  - `methodology`: `summary`, `files`;
  - `starter`: `name`, `version`.

  Absent keys are skipped. Lists and `status_map` keep their input order. Non-ASCII characters are written as themselves, not escaped.
- **The hub reads it from the working tree**, not from a commit, because the kit is configuration and the user may not have committed it yet. The health check reports a kit that differs from `HEAD`, or isn't tracked, as `KIT_UNCOMMITTED` (info).
- **Its hash** is the lowercase hex SHA-256 of the file's bytes as they are on disk (or of the input's bytes for `--input`), written `sha256:<64 hex>`. A hand-edited kit is hashed as it is, never re-serialised first. `brain.json` records the hash of the kit it last applied (§5).
- **The kit itself is never ingested**, even when a pattern matches it.

### 2.1a Path patterns (normative)
Every pattern (`patterns`, `never_read`) is a Git glob pathspec, matched as Git matches `:(glob)<pattern>`. This is what `repo changes` already passes to Git (cli.md §5.16):
- **Anchored at the repo root.** `.env*` matches only the root's `.env` files; `**/.env*` matches them at any depth.
- **Single segments.** `*`, `?` and `[…]` never match `/`.
- **`**`:**
  - a leading `**/` matches any number of folders, including none;
  - a trailing `/**` matches everything inside;
  - `/**/` matches zero or more folders;
  - any other `**` is the same as `*`.

  So `docs/**/*.md` matches `docs/a.md` and `docs/x/y/a.md`.
- **Case-sensitive.**

Where the CLI matches without Git (a recorded `repo_path` for `NEVER_READ_INGESTED`, `methodology.files`, the task source path), it uses one function with these rules. A test checks that this function agrees with `git ls-files -- ':(glob)<pattern>'` on a fixture tree.

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
| `placement.projects` | — | From 0.18.0: a non-empty list of `prj-` ids without repeats, the Projects the repo serves (0113 §2). What a list changes is in §2.3. |
| `placement.project` | — | One `prj-` id, as kits were written until 0.17.0. Read everywhere as `projects` with that one id. The hub writes `projects` in every kit it writes from 0.18.0. `project` and `projects` together are `KIT_INVALID` (the schema). |
| `knowledge.patterns` | ✔ | A non-empty list of Git glob pathspecs, relative to the repo root (0042's `patterns`). |
| `knowledge.never_read` | — | Git glob pathspecs that the hub never reads, **even when a pattern matches them**. They apply to ingest, the rollup, the overview and the methodology files. Absent means an empty list. |
| `plan` | — | From 0.18.0: repo-relative paths of the files that say what the plan is (`["docs/roadmap.md"]`), without repeats. The overview reads them at `HEAD` (cli.md §5.39), with the Markdown task source when there is one. They are not ingested unless a pattern also matches them. Absent means an empty list. |
| `tasks` | — | Absent: knowledge only (§1). |
| `tasks.mode` | ✔ with `tasks` | `connected` or `tracked-in-repo`. |
| `tasks.source` | ✔ with `tasks` | Where the tasks live (§2.4). `connected` takes `{ "kind": "notion" }` only. |
| `tasks.status_map` | — | `tracked-in-repo` only (on `connected` it is `KIT_INVALID`). Maps a raw status in the source to one of the six **status meanings** of connected-workflows.md §5.1: `todo`, `in_progress`, `waiting`, `review`, `done`, `dropped`. Each source kind has a default (§2.4), and the kit's entries are added to it, a kit entry winning on the same key. |
| `methodology.summary` | ✔ | At most 600 characters: how work is done in the repo, in plain words. The brain assistant and adoption read it; it is not ingested as knowledge. |
| `methodology.files` | — | Repo-relative paths of the documents that hold the methodology (e.g. `AGENTS.md`). They are read only when a pattern also matches them. |
| `starter` | — | `{ name, version }` of the starter that created the repo (§7). Informational. |

**Checks beyond the JSON Schema.** `brain repo kit check` reports them as problems, and every other command that reads a kit refuses with `KIT_INVALID`. Each one has a JSON Pointer:
- `/tasks/source/pattern`: the pattern doesn't compile as a JavaScript regular expression with the flag `u`, or has no named group `title`;
- `/placement/area`, `/placement/project`, `/placement/projects/<n>`, `/placement/domain`: the id doesn't exist in the hub;
- `/placement/domain`: Domains is on and the id isn't the Area's `domain`, or the Area has no Domain;
- `/methodology/files/<n>`, `/plan/<n>`, `/tasks/source/path`: the path matches `never_read`;
- `/name`, when the kit is read for an existing `repos` entry: the name differs from that entry's;
- `/name`, when the kit is written or added for a path: an entry with this name exists for another path.

The JSON Schema and the pattern check need no brain. The others need one: they run whenever a brain resolves (cli.md §4), and are skipped by `kit check` when none does.

With Domains off, `placement.domain` is ignored and not checked. Until 0.17.0 a project of another Area was refused too; from 0.18.0 a Factory may serve Projects of any Area (0113 §2).

**Old kits.** A kit written before 0.18.0 keeps working: `kit_version` stays `1`, and no key is required that wasn't. A brain older than 0.18.0 refuses a kit with `projects` or `plan` (an unknown key), so the repo is linked again from an upgraded brain.

### 2.3 Placement follows the hub's rules
- **Domain follows the Area (0055).** A repo can't be placed in a Domain other than its Area's. The kit's `domain` exists so that a reader of the repo can see where it sits; the hub never writes a Domain from it.
- **Several Projects (0.18.0).** The kit's `placement.projects` (or `project`, read as a list of one) is the Factory's Projects.
  - With **one** Project, everything is as in 0.17.0: the rollup goes on it, `brain link` gets it as `--project`, and catch-up passes it as the project of each note it ingests from the repo.
  - With **several**, the rollup (module off) goes on the Area page; `brain link` gets only `--area`; and the ingest links each note to those of the listed Projects that the file is about, judged as for any document, and to none when it can't tell. The note's `area` is the repo's Area. The row lists them all.
- **Moving a repo** (a new Area or Project) is a change of the kit (§3) and then `repo refresh` (cli.md §5.29). Notes already ingested keep their `area` and `projects`; only new ingests use the new placement. `repo refresh` reports the change as `placement_changed`, and with Factories on the next publish updates the row's Area and Projects. The tasks of the Factory are untouched.

### 2.4 Task sources and their raw statuses

| `source.kind` | Fields | Raw status of an item | Default `status_map` |
|---|---|---|---|
| `markdown` | `path` (repo-relative file); `format`: `checklist` or `pattern`; with `pattern`, `pattern` | `checklist`: the character between the brackets of `- [c] title` (also with `*` or `+`). `pattern`: the named group `status` | `checklist`: `" "` → `todo`, `"x"` and `"X"` → `done`. `pattern`: none |
| `github` | `repo`: `owner/name` | `open`; `closed:completed`; `closed:not_planned`; `label:<name>` for each label | `open` → `todo`, `closed:completed` → `done`, `closed:not_planned` → `dropped` |
| `gitlab` | `project`: `group/name` (subgroups allowed) | `opened`; `closed`; `label:<name>` for each label | `opened` → `todo`, `closed` → `done` |
| `notion` | none | (connected only) | none |

**Lines that are read.** Both Markdown formats read the file line by line (LF; a trailing CR is removed). They skip every line inside a fenced code block (from a line starting with three or more backticks or tildes to the closing fence), and every line longer than 2,000 characters.

**`checklist` format.**
- An item is a line matching `^\s*[-*+] \[(.)\] (.+)$`. Indented lines are items too: nesting is ignored.
- The raw status is the one character between the brackets, so ` ` for an open box.
- `[]`, a bracket with more than one character, and numbered lines (`1. [ ] …`) are not items.
- The title is the rest of the line, trimmed.

**`pattern` format.**
- A JavaScript regular expression (flag `u`) tried on each line. It must have the named group `title`; `status` and `id` are optional.
- A line that doesn't match is not an item.
- Without a `status` group, every item's raw status is `""`, so the kit must map `""`.
- Example for headings such as `### CC-12 · Write the API · \`in progress\``: `"^### (?<id>[A-Z]+-\\d+) · (?<title>.+) · \`(?<status>[^\`]+)\`$"`.

**GitHub.** A closed issue with no `state_reason`, or with `null`, has the raw status `closed:completed`.

**Matching.**
- Raw statuses are matched case-insensitively after trimming.
- On GitHub and GitLab, an **open** issue with a `label:<name>` entry in the map takes that label's meaning: the first such label in the issue's label order. A closed issue ignores labels.

**Item keys.** Each item has a stable key: the `id` group when the pattern has one; GitHub `#<number>`; GitLab `#<iid>`; otherwise `line:` followed by the first 12 hex characters of the SHA-256 of the trimmed title. A second item with the same key in one file gets `#2`, a third `#3`, and so on, in file order. Adoption uses the same keys (connected-workflows.md §11.3).

**A raw status that nothing maps** counts as `unmapped`, with meaning `null`. The rollup shows it, and the health check reports `STATUS_UNMAPPED` when it has the task data (§6).

## 3. The one write: the kit, with the user's yes (0066)

- **The kit is the only file the hub writes in a linked repo.** It is written by `brain repo kit write` (cli.md §5.29), and only in these cases:
  - linking a repo that has no kit;
  - changing a link (a new placement, patterns, never-read paths, task source or mapping);
  - `brain repo new`, which writes the kit with the starter.
- **The yes is for the exact content.** The skill shows the whole kit (or, for a change, a unified diff against the current file) and writes only after the user says yes to that content.
- **The CLI checks the confirmation.** `repo kit write` and `repo new` require `--confirm <sha256>`: the hash of the kit bytes the user said yes to, in the form the CLI writes them. The skill takes it from `repo kit check`'s `confirm_sha256` for the content it showed; a draft formatted by hand has the same content in another layout, so its own `sha256` would never match (CC-129). A missing flag is `CONFIRMATION_REQUIRED`, and a hash that differs from the bytes about to be written is `CONFIRMATION_MISMATCH`. Nothing is written in either case. So a write always names the exact content that was approved, and no read path can write a kit.
- **An unattended run never writes a kit:** it never passes `--confirm`.
- **Concurrent edits are refused.** A change passes `--replace <sha256>`, the hash of the kit the user saw. If the file changed since then, the write is refused (`KIT_CHANGED`) and the skill shows the new diff.
- **The hub never commits or pushes in the linked repo.** The skill tells the user to commit `brain-kit.json` there; until then the health check reports `KIT_UNCOMMITTED`.
- **Refused targets:** the brain (`REPO_IS_BRAIN`); the product repo (`OUTSIDE_ROOT`: its contents are public, and the kit holds brain ids); a `brain-kit.json` that is a symbolic link or a folder (`OUTSIDE_ROOT`).
- After the write, `brain repo add --kit` (a new link) or `brain repo refresh` (a change, or a legacy link's first kit) applies the kit to `brain.json`.

## 4. The read-only rollup (tracked-in-repo)

**Only with the Factories module off (0.18.0, 0113 §6).** With it on, no `Repo tasks · <name>` toggle is written: its counts are a line of the Factory's overview (connected-workflows.md §9.1). When the skill writes a Factory's overview the first time, it removes that repo's toggle, found by its exact name, from the page of §4's placement: the yes to turning Factories on covers it, and the message or the module's steps say so. Turning Factories off brings the toggle back at the next catch-up. `brain repo tasks` works in both cases, because Ultimate Assistant and adoption read it.

- **What it is.** A short, dated summary of the repo's tasks, built by `brain repo tasks <name>` (cli.md §5.29).
- **Where it goes.** The skill writes it into the brain-owned toggle heading **`Repo tasks · <name>`** on the Project page when the placement names exactly one Project, else on the Area page. Several repos placed on one page get one toggle each.
- **How it is written.** By the toggle rule of connected-workflows.md §6.1: found by its exact name, or appended at the end of the page. `sync render` never sends it and never touches it, so render code doesn't change.
- **Notion design (CC-103).** CC-103 documents it in docs/notion-space-design.md §2, as "toggle headings named `Repo tasks · <repo>`". The migration creates nothing on existing pages.
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

  - Times are UTC, with English month abbreviations (`3 Nov 2026, 14:20`). "As of" is `--now` for a Markdown source and the input's `fetched_at` for issues.
  - In the counts line, a part whose count is 0 is left out with its separator, and so is the parenthesis when all four of its counts are 0 (`2 completed · 1 open (1 to do) · 67%`).
  - `{source label}` is the file path, `GitHub owner/name` or `GitLab group/name`.
  - `{percent}` = done ÷ (total − dropped), rounded to a whole number. It is left out, with its ` · `, when there are no non-dropped items (0055).
  - Open items are listed in the order in progress, in review, waiting, to do, then in source order, at most 20 in all. An issue's title is a link to its URL.
  - The `{open}` count includes unmapped items, which are never listed as bullets. `…and {n} more open` counts the mapped open items beyond the 20 listed.
  - There is one "Not mapped" line per unmapped raw status, in order of first appearance, with the raw status as written in the source (grouped case-insensitively after trimming).
  - The text ends with one newline.
  - With no tasks at all, the toggle says `As of … · from … · no tasks found`.

### 4.1 Fetching issues (the skill)
The skill fetches all issues, open and closed, and passes them to the CLI unchanged except for the field names below.
- **GitHub:** `gh issue list --repo <owner/name> --state all --limit 1000 --json number,title,state,stateReason,labels,url`.
  - `state` `OPEN`/`CLOSED` → `open`/`closed`.
  - `stateReason` `COMPLETED`/`NOT_PLANNED` → `completed`/`not_planned`; any other value or an empty one → absent.
  - `labels[].name` → `labels`.
  - Pull requests are not in this list.
- **GitLab:** `glab issue list --repo <group/name> --all --per-page 100 --page <n> --output json`, repeated for each page until one comes back empty. Fields: `iid` → `number`, `state` (`opened`/`closed`), `labels`, `web_url` → `url`.
- **Limit.** When there are 1,000 issues or more, the skill passes the first 1,000, and the toggle's first line ends with ` · first 1000 issues`. The CLI adds that text when `items` has 1,000 entries.
- **Failure.** When `gh` or `glab` is missing, isn't logged in, or fails, no rollup is written and the old toggle stays. The report says why.

## 5. `brain.json` `repos` (schema §12)

A kit adds three optional keys to a `repos` entry, and 0.18.0 a fourth. Legacy entries don't change.
- `kit`: `{ "sha256": "sha256:<64 hex>" }`, the hash of the kit that was last applied by `repo add --kit` or `repo refresh`. When it is present, `area`, `patterns`, `never_read` and `projects` (or, in an entry not rewritten since 0.17.0, `project`) are **copies taken from the kit** and are changed only by `repo refresh`.
- `never_read`: a list of Git glob pathspecs (absent means none). `repo changes` (cli.md §5.16) leaves out the files that match it, in a legacy entry too.
- `projects` (0.18.0): the kit's Projects, as a list of `prj-` ids in the kit's order (absent means none).
- `project`: one `prj-` id, written until 0.17.0 and read as `projects` with that one id. An entry holds one of the two; the next `repo refresh` that writes the entry replaces `project` with `projects`.

The Factory of a repo is a separate list (§1.1; schema §12 `factories`): a `repos` entry doesn't change when the module is turned on.

The machine's `path` and the ingest state in `commit` stay in `brain.json` only; the kit holds neither. `repo refresh --path` changes `path` when the repo moved, and no `refresh` changes `commit` (cli.md §5.29).

## 6. Health check

`brain repo health [<name>]` (cli.md §5.29) is read-only. The skill runs it when the user asks about a link, and the 0.10.0 brain assistant reuses it. Each check is `{ code, severity, message, path? }`:

| Code | Severity | When |
|---|---|---|
| `PATH_MISSING` | error | `path` doesn't exist or isn't the top of a Git working tree: when the repo moved, `repo refresh --path` records where |
| `KIT_MISSING` | error | the entry has `kit`, and the file is gone |
| `KIT_INVALID` | error | the kit fails its schema or a §2.2 check (with the pointer) |
| `KIT_CHANGED` | warning | the kit's hash differs from `kit.sha256`: run `repo refresh` |
| `KIT_UNCOMMITTED` | info | the kit isn't tracked, or differs from `HEAD` |
| `NO_KIT` | info | a legacy entry: the skill offers to write a kit, which `repo refresh` then applies |
| `PLACEMENT_ARCHIVED` | warning | the Area or a Project is `archived` (one check per note) |
| `COMMIT_UNKNOWN` | error | the recorded `commit` isn't an ancestor of `HEAD` (rewritten history): the fix is `repo record --reset` |
| `CHANGES_WAITING` | info | files that `repo changes` would list (never-read paths and the kit left out), with their count; skipped after `COMMIT_UNKNOWN` |
| `PATTERN_MATCHES_NOTHING` | warning | a pattern matches no file at `HEAD` other than the kit (one check per pattern) |
| `NEVER_READ_INGESTED` | warning | a source of this repo has a `repo_path` that `never_read` now matches. Nothing is removed; the user can ask to archive its notes |
| `METHODOLOGY_FILE_MISSING` | warning | a `methodology.files` path doesn't exist at `HEAD` |
| `PLAN_FILE_MISSING` | warning | a `plan` path doesn't exist at `HEAD` (0.18.0) |
| `TASK_SOURCE_MISSING` | error | the markdown source path doesn't exist at `HEAD` |
| `STATUS_UNMAPPED` | warning | only with `--input` issue data, or with a markdown source: a raw status that nothing maps, with its count |
| `CONNECTED_WITHOUT_WORKFLOW` | warning | `tasks.mode` is `connected`, and no connected workflow record names this repo (connected-workflows.md §3) |
| `WORKFLOW_WITHOUT_CONNECTED` | warning | a connected workflow whose destination is a Project or an Area names this repo, and the kit's mode isn't `connected`. One whose destination is the repo's Factory never gives it (0.18.0, §1.1) |
| `BRAIN_LINK_STALE` | info | the repo has a `.brain` (§8) whose `area` differs from the placement, or whose `project` is not one of its Projects |
| `ROLLUP_STALE` | warning | tracked-in-repo, with `--rollup-as-of <timestamp>` (the toggle's "As of", which the skill reads from Notion): for a markdown source, the committer time of the newest commit touching the source file is after that time; for issues, the time is more than 24 hours before `--now`. Without the option, and with Factories on (there is no toggle, §4), the check is skipped |

**Which checks run.**
- **The path.** `PATH_MISSING` stops the repo's checks: only it is reported.
- **Legacy entries** (no `kit`) get `NO_KIT`. The checks that need a kit are skipped: `KIT_*`, `PLACEMENT_ARCHIVED`, `METHODOLOGY_FILE_MISSING`, `PLAN_FILE_MISSING`, `TASK_SOURCE_MISSING`, `STATUS_UNMAPPED`, `CONNECTED_WITHOUT_WORKFLOW`, `WORKFLOW_WITHOUT_CONNECTED` and `BRAIN_LINK_STALE`. The Git checks use the entry's own `patterns` and `never_read`.
- **`KIT_MISSING` or `KIT_INVALID`** skips the checks that read the kit's content: `KIT_CHANGED`, `KIT_UNCOMMITTED`, `PLACEMENT_ARCHIVED`, `METHODOLOGY_FILE_MISSING`, `PLAN_FILE_MISSING`, `TASK_SOURCE_MISSING`, `STATUS_UNMAPPED`, `CONNECTED_WITHOUT_WORKFLOW`, `WORKFLOW_WITHOUT_CONNECTED` and `BRAIN_LINK_STALE`. The Git checks still run on the `brain.json` copies.
- **`STATUS_UNMAPPED`** runs only for a markdown source, or with `--input` issue data.
- **The three cases CC-102 tests:** the repo moved or missing is `PATH_MISSING`; the kit out of date is `KIT_CHANGED`; a stale rollup is `ROLLUP_STALE`.
- **The workflow checks** count workflows in state `connected` or `paused` whose `folder.repo` is the repo's name. `ended` workflows don't count.

The exit code is 1 when any check is an error, as for `lint`.

## 7. The generic starter

`brain repo new` (cli.md §5.29) starts a new repo from `templates/repo/generic/` in the product package (0066); the package's `files` list gains `templates/repo`. The generic starter is the only one in 0.9.0. CC-102 adds the folder with exactly the files below. `{name}`, `{summary}` and `{tasks}` are replaced when the repo is created; every file ends with one newline.

**`README.md`**
```text
# {name}

{summary}
```

**`AGENTS.md`**
```text
# How work is done here

{summary}

- Record a decision in decisions/ (copy decisions/_template.md) before acting on it.
- Plans and notes go in docs/.
- {tasks}
- When the Ultimate Brain block in this file names a Factory, its tasks in Notion say what is wanted next, and the detailed plan stays in this repo.
- Never put secrets in this repo: .env files and secrets/ are ignored.
```

`{tasks}` is one of:
- tracked-in-repo: `Tasks are in TASKS.md: one line "- [ ] title" each; "[x]" when done.`
- connected: `Tasks are in Notion, through the connected workflow.`
- no `tasks`: `This repo tracks no tasks.`

The line about the block (0.18.0) agrees with the Factory paragraph `brain link` writes (§8): a starter repo whose work is connected has both, and the block says how a session starts. The starter is written once, by `repo new`; a later release doesn't change a repo already made.

**`CLAUDE.md`**
```text
@AGENTS.md
```

**`decisions/_template.md`**
```text
# NNNN — Title

**Status:** Proposed
**Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```

**`docs/README.md`**
```text
Plans, notes and documents for {name}.
```

**`TASKS.md`** (only with tracked-in-repo)
```text
# Tasks

- [ ] First task
```

**`.gitignore`** (stored in the package as `templates/repo/generic/gitignore`, because npm leaves `.gitignore` files out of a package)
```text
.env*
secrets/
```

**`brain-kit.json`:** the input kit, with `starter` set to `{ "name": "generic", "version": <the installed package's version> }` (the package of cli.md §5.15), written as §2.1 says.

`{name}` is the kit's `name` and `{summary}` its `methodology.summary`. With tracked-in-repo, `repo new` requires the source to be `{ "kind": "markdown", "path": "TASKS.md", "format": "checklist" }` (`KIT_INVALID` otherwise), because that is the file it writes.

**The kit the skill proposes**, which the user may change before the write: `patterns` `["decisions/**", "docs/**", "README.md"]`, `never_read` `[".env*", "secrets/**"]`, `tasks` tracked-in-repo with the TASKS.md checklist source, and `methodology.summary` "Record decisions in decisions/ before acting on them; plans in docs/; tasks in TASKS.md." (the end changed to match the mode).

## 8. Offering `brain link` the other way

After a link (or `repo new`), the skill asks once: "Let this repo read the brain too? It adds `.brain`, a block in AGENTS.md, and the brain-query, brain-workflow and brain-workflow-adopt skills there." (The skills are those the brain's snapshot links, skills-delivery §9.7; before 0.9.2 the offer names brain-query only.) On yes, it runs `brain link <path> --repo-name <name> --area <area>` (with `--project <project>` when the kit has one). This is the existing §5.12 command, a separate write with its own yes; it doesn't pass through the kit. On no, nothing is written, and it isn't asked again for this link. The answer goes in the skill's report.

**With Factories (0.18.0).** When the message of §1.2 is shown, its last part is this offer together with the connection, and this question isn't asked on its own. The user can still ask for the link back alone ("let acme-api read the brain too"). A repo linked back and not connected gets no Factory paragraph.

**The Factory paragraph** of the instruction block (cli.md §5.12) is the line that starts a session from the Factory's tasks (0113 §5; connected-workflows.md §15). `brain link` writes it when the folder's Factory has an open workflow whose destination is that Factory, and removes it when it no longer has. `--project` is given when the placement names exactly one Project.

## 9. Unlinking

`brain repo unlink <name>` (cli.md §5.29) removes the entry from `brain.json`.
- **The knowledge stays.** Sources keep `repo`, `repo_path` and `commit`; notes, Inbox rows and Documents are untouched.
- **The repo isn't touched.** `brain-kit.json` and any `.brain` stay. The skill tells the user they can delete them there.
- **The rollup goes.** The skill removes the `Repo tasks · <name>` toggle from the Project or Area page, with the same yes as the unlink.
- **The Factory's row is archived (0.18.0, 0113 §1).** The `factories` entry gets `archived: true` and keeps its id, with its Area and Projects copied in, and the next publish ticks Archived on the row. The row's tasks stay as they are, and so does its overview: the text, its "As of" and Overview as of stay at their last state, and nothing refreshes them again. With the module off only the entry changes. The unlink's question says it: "Stop reading acme-api? Its row in Factories is archived; its tasks and what the brain learned stay."
- **A connected workflow isn't ended by an unlink.** The workflow runs in the repo, not in the link. The report names the workflow, and the user ends it separately (connected-workflows.md §3.4). One whose destination is the archived Factory is paused by its next reconcile (connected-workflows.md §8.4).
- **Linking again** under the same name starts with `commit: ""`. Files ingested before are found as duplicates by `note new` (cli.md §5.16, `--reset`). Its archived Factory, if any, is the same entry again: `archived` is removed, with the copied Area and Projects, and the row is unticked at the next publish. A moved repo and a legacy link taking a kit don't need it: `repo refresh` keeps `commit`.

## 10. The skill (CC-104)

**`brain-repos`**, one of CC-104's three skills. It is written in the ultimate-brain-skills fork's `brain/` since CC-105 (0059, skills-delivery §9.1). These are what the skill must do; the skill decides how it is worded. Every write is preceded by the content and the user's yes.
- **Link:** inspect the repo (top-level layout, instructions, plans, issue tracker), propose a kit (placement from the hub's Areas and Projects; patterns and never-read paths; mode and source; status mapping; methodology summary), show it with the message of §1.2 (with Factories declined, or before 0.18.0, the yes to the kit alone), and on yes `repo kit write --confirm <its sha256>`, `repo add --kit`, then the other parts the user said yes to (§1.2; §8 when the message wasn't shown), and, with tracked-in-repo, the first rollup, or with Factories on the first overview. The first ingest stays attended (0042).
- **Show:** `repo show` and `repo health` (with `--rollup-as-of` read from the toggle while Factories is off), in two lines (skill-report rule). "Show my factories" is `factory list`, one line each: its name, whether its work is connected, and its overview's date.
- **Change:** propose the new kit as a diff, and on yes `repo kit write --replace <old> --confirm <new>`, `repo refresh`; when `reingest` is true, `repo record --reset` and a catch-up.
- **A legacy link's first kit:** propose one from the entry, and on yes `repo kit write --confirm <its sha256>`, then `repo refresh` (CC-118).
- **A moved repo:** ask for the new path, and `repo refresh --path <new path>` (CC-118).
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
