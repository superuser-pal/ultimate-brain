# Brain Schema Specification (v1)

**Schema version:** `1`
**Status:** Draft for review (task CC-01)
**Machine-readable:** [schemas/note.schema.json](schemas/note.schema.json), [schemas/proposal.schema.json](schemas/proposal.schema.json), [schemas/brain.schema.json](schemas/brain.schema.json)
**Examples:** [examples/valid/](examples/valid/), [examples/invalid/](examples/invalid/). Every valid example passes the JSON Schemas and every invalid one fails (checked with Ajv, draft 2020-12); CX-05 should keep this as a test.

This is the contract for every file in a user's brain repo. The CLI (`src/`) validates against it, and the skills write to it. When this document and the JSON Schemas disagree, the JSON Schemas win and this document is fixed.

Decisions referenced: 0001–0005, 0008–0011, 0013, 0017, 0018, 0020, 0021, 0023, 0032, 0041–0043, 0045.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Encoding | UTF-8, LF line endings, one trailing newline |
| Frontmatter | YAML between `---` lines at the very top. Exact serialization (flow style for scalar lists, key order, body separator) is in [cli.md](cli.md) §3.6.5. Unknown keys are preserved by tools and flagged by lint as warnings |
| YAML parsing | Tools parse with the **YAML 1.2 core schema**, so dates stay strings (`2026-12-03`, not a date object). Writers quote values that would otherwise change type |
| Dates | `YYYY-MM-DD`. Fact values that are months use `YYYY-MM`. Timestamps use ISO 8601 UTC: `2026-12-03T10:22:00Z` |
| IDs | `<prefix>-<8 chars>`, chars from `0123456789abcdefghjkmnpqrstvwxyz` (0017). Permanent; never reused |
| References in frontmatter | Always by **ID** (`projects: [prj-9x4t1b7e]`), never by path or title |
| Links in bodies | Standard relative Markdown links: `[Maria López](../people/maria-lopez.md)` (0002). No `[[wikilinks]]` |
| File names | Kebab-case slug of the title, ASCII only. Dated types prefix `YYYY-MM-DD-` (meeting, decision, source). Renaming a file never changes its `id` |
| Source keys | External: `notion:<page-id>`, `url:<https-url>`, `agent:<agent>/<session-id>`, `file:sha256:<64 hex>` (the original file's bytes, 0032). Internal: a note ID |

### ID prefixes

| Prefix | Type | | Prefix | Type |
|---|---|---|---|---|
| `area` | area | | `dec` | decision |
| `gol` | goal | | `que` | question |
| `prj` | project | | `con` | concept |
| `per` | person | | `src` | source |
| `org` | org | | `mem` | memory |
| `mtg` | meeting | | `prp` | proposal |
| `vw` | view | | `ref` | reference |

The prefix is fixed at creation even if `type` later changes; `type` is the truth.

---

## 2. Folder layout

```text
<brain>/
├── AGENTS.md, CLAUDE.md         product-owned sections fenced (see templates)
├── brain.json                   §11
├── index.md                     GENERATED §12
├── log/YYYY-MM.md               GENERATED §12
├── areas/<slug>.md              type: area
├── areas/briefs/<slug>.md       type: view, view_kind area_brief (GENERATED, 0041)
├── goals/<slug>.md              type: goal
├── projects/<slug>/
│   ├── project.md               type: project
│   ├── brief.md                 type: view (GENERATED)
│   └── decision-log.md          type: view (GENERATED)
├── archive/
│   ├── projects/<slug>/…        finished project containers
│   └── goals/<slug>.md          finished goals
├── knowledge/
│   ├── people/<slug>.md         type: person
│   ├── orgs/<slug>.md           type: org
│   ├── meetings/YYYY-MM-DD-<slug>.md    type: meeting
│   ├── decisions/YYYY-MM-DD-<slug>.md   type: decision
│   ├── questions/<slug>.md      type: question
│   ├── concepts/<slug>.md       type: concept
│   └── references/<slug>.md     type: reference (0045)
├── sources/notion/YYYY-MM-DD-<slug>.md  type: source (immutable), key notion:
├── sources/files/YYYY-MM-DD-<slug>.md   type: source, key file: (0032)
├── sources/text/YYYY-MM-DD-<slug>.md    type: source, key url: or agent: (0032)
├── reports/YYYY-MM-DD-<slug>.md   type: view, view_kind report (0043)
├── memories/YYYY/MM/YYYY-MM-DD-<slug>.md type: memory (v2 loop)
└── _proposals/YYYY-MM-DD-<slug>.md      type: proposal
```

Each type must live in its folder (lint error otherwise). A `view` lives inside a project folder (`brief`, `decision_log`), in `areas/briefs/` (`area_brief`) or in `reports/` (`report`). `archive/` may hold `project` and `view` (inside project folders) and `goal`.

---

## 3. Common fields

**Owner** says who may change a field after creation (0021): **brain** (agents, via proposals or as new notes), **you** (in Notion, read back by sync), **system** (tools only).

### 3.1 Core (every file)

| Field | Type | Req | Owner | Notes |
|---|---|---|---|---|
| `id` | ID | ✔ | system | §1 |
| `type` | enum | ✔ | system | one of the v1 types |
| `title` | string | ✔ | brain (you on Notion creation) | ≤120 chars |
| `created` | date | ✔ | system | |
| `updated` | date | ✔ | system | last content change |

### 3.2 Knowledge fields (all types except `source`, `view`, `proposal`)

| Field | Type | Req | Owner | Notes |
|---|---|---|---|---|
| `summary` | string | ✔ | brain | aim for ≤200 chars (lint warning above 200, error above 400); feeds `index.md` and Notion "Summary" (0013) |
| `lifecycle` | enum `draft`·`reviewed`·`disputed`·`archived` | ✔ | you (agents set `draft` on creation, `archived` via supersession) | 0005 |
| `aliases` | list of strings | | brain | names used for matching ("Maria", "María López") |
| `tags` | list of strings | | brain | lowercase kebab-case |
| `area` | ID (`area-`) | | brain | |
| `projects` | list of IDs (`prj-`) | | brain | |
| `sources` | list of source keys | | brain | where the knowledge came from (§1) |
| `relations` | list of relation | | brain | §6 |
| `facts` | map | | brain | current key facts (§5) |
| `timeline` | list of timeline entries | | brain | history of `facts` (§5) |
| `notion` | string (Notion page id) | | system | set once published |
| `last_synced` | timestamp | | system | time of the last publish to Notion (written only by `sync record`) |
| `notion_fields` | map | | system (snapshot of you-owned fields) | §7 |
| `notion_published` | map | | system | Notion property name → value the brain last published or imported, in the normalized form of [cli.md](cli.md) §5.14.1, plus `@content` (hash of the published page content); on a proposal, `@trashed` (when its Review row was moved to Notion's trash, 0045). Baseline for the three-way comparison of cli.md §5.14 |

---

## 4. Note types

Each row lists fields **in addition to** §3. "Notion" names the database the type is mirrored to ([notion-space-design.md](../docs/notion-space-design.md) §3).

### area · `areas/` · Notion: Areas
An ongoing responsibility (e.g. "Clients", "Health").
- `notion_fields`: `type` (`Business`·`Personal`), `archived` (bool).
- Body: description; optional "What to track" section is v2 (docs/v2-ideas.md).

### goal · `goals/` · Notion: Goals (0020)
| Field | Type | Req | Owner |
|---|---|---|---|
| `why` | string ≤300 | ✔ | brain |
| `area` | ID | ✔ | brain |
| `facts.deadline` | date or month | | brain (history in `timeline`) |
- `notion_fields`: `status` (`Not Started`·`Active`·`Achieved`·`Dropped`), `progress` (0–1), `archived`, `key_results` (list of `{name, kind, start, current, target, unit, done, due}`) — a dated snapshot, never written back.

### project · `projects/<slug>/project.md` · Notion: Projects
| Field | Type | Req | Owner |
|---|---|---|---|
| `area` | ID | ✔ | brain |
| `goal` | ID (`gol-`) | | brain |
| `client` | ID (`org-`) | | brain |
| `people` | list of IDs (`per-`) | | brain |
- Common `facts` keys: `launch_date`, `budget`, `owner` (person ID), `deadline`. Others allowed.
- `notion_fields`: `status` (`Planned`·`Active`·`On Hold`·`Done`), `priority` (`High`·`Medium`·`Low`), `dates` (`{start, end}`), `archived`.
- Body: why, scope, narrative. The brief and decision log are separate generated views.

### person · `knowledge/people/` · Notion: People
| Field | Type | Req | Owner |
|---|---|---|---|
| `org` | ID (`org-`) | | brain |
- `facts.role` holds the current role (history in `timeline`). `notion_fields`: `email`.

### org · `knowledge/orgs/` · Notion: Orgs
- `notion_fields`: `relationship` (`Client`·`Prospect`·`Partner`·`Supplier`·`Other`), `website`.

### meeting · `knowledge/meetings/YYYY-MM-DD-<slug>.md` · Notion: Meetings (relations only, 0007)
| Field | Type | Req | Owner |
|---|---|---|---|
| `date` | date | ✔ | brain |
| `attendees` | list of IDs (`per-`) | ✔ (may be empty) | brain |
| `source` | ID (`src-`) | ✔ | system |
| `decisions` | list of IDs (`dec-`) | | brain |
| `questions` | list of IDs (`que-`) | | brain |
| `tasks` | list of Notion page ids | | system |
- `notion` is the Notion **meeting** page id. Body: the brain's meeting summary (for agents), sections fixed by the ingest skill.

### decision · `knowledge/decisions/YYYY-MM-DD-<slug>.md` · Notion: Decisions
| Field | Type | Req | Owner |
|---|---|---|---|
| `date` | date | ✔ | brain |
| `assessment` | enum §8 | ✔ | brain |
| `decided_in` | ID (`mtg-`) | | brain |
| `deciders` | list of IDs (`per-`) | | brain |
| `valid_from` | date | | brain; defaults to `date` when absent (0005) |
| `valid_until` | date | required when `assessment: superseded` | brain; the superseding decision's `valid_from` (or `date`) |
- Supersession uses `relations`: the newer decision has `supersedes: <old>`, the older has `superseded_by: <new>` (both persisted, §6). A superseded decision has `assessment: superseded`, `valid_until` set, and lifecycle `archived`.
- `decided_in` and the meeting's `decisions` list must agree (lint error otherwise); same for question `raised_in` and the meeting's `questions`.
- Body sections: `## Decision`, `## Context`, `## Consequences`, `## Sources`.

### question · `knowledge/questions/` · Notion: Questions
| Field | Type | Req | Owner |
|---|---|---|---|
| `kind` | `question`·`risk` | ✔ | brain |
| `raised_in` | ID (`mtg-`) | | brain |
| `answer` | string or ID | | brain (set by an applied `answer` proposal, 0041) |
- `notion_fields`: `status` (`Open`·`Answered`·`Dropped`). Status is yours, with two exceptions, each sent once: a question reaches Notion as Open while you have set no Status (0045), and the publish after an applied `answer` proposal sets it to Answered (0041, cli.md §5.14.4).

### concept · `knowledge/concepts/` · Notion: Concepts (0037)
Ideas, methods, definitions: what the brain learned from a document, an email or a meeting. Only the §3.2 fields; `area` and `projects` place it, `sources` says where it came from.
- Body: the explanation, published as the whole page body (as for decisions).

### reference · `knowledge/references/` · Notion: References (0045)
What the user asked to keep from a document ("just the requirements"), as living knowledge: a requirements list, a spec, a price list. Only the §3.2 fields; `sources` is required (at least one source). `area` and `projects` place it.
- Body: the kept content, as the ingest wrote it from the source's `keep` (§4 source): a list or a table, every figure and date as stated. Published as the whole page body.
- **Changes** come only through proposals: an `update_body` (§11), usually inside the Review notes row of the source that brought a new version (§4 source, "Versions"). The body is never rebuilt from the source.

### source · `sources/<notion|files|text>/YYYY-MM-DD-<slug>.md` · Notion: Inbox (every kind except `minutes`, 0037)
Immutable snapshot of input. **Its body and the fields above `summary` in the table, `summary` and `digest` are never edited after creation** (lint error if `content_hash` no longer matches the body). Only the system fields change later: `notion`, `notion_published`, `last_synced` and `tasks`, written by `sync record` (cli.md §5.14.6), and `notion_text`, `notion_parts` and `notion_text_requested`, written by `source full-text` (cli.md §5.17). The folder follows the key: `notion:` → `sources/notion/`, `file:` → `sources/files/`, `url:` and `agent:` → `sources/text/` (0032).
| Field | Type | Req |
|---|---|---|
| `source_key` | source key | ✔ |
| `content_hash` | `sha256:<64 hex>` of the body, defined below | ✔ |
| `captured` | timestamp | ✔ |
| `origin_edited` | timestamp (Notion `last_edited_time`) | |
| `kind` | `minutes`·`document`·`email`·`chat`·`note`·`capture`; absent means `minutes`; `document` with a `url:` key | ✔ with a `file:` or `url:` key (0036) |
| `file_name` | the original file's name, without its folder (`acme-brief.pdf`) | ✔ with a `file:` key |
| `converter` | what turned the file into text, with its version: `markitdown 0.1.8`, `claude-read`, `web-fetch <model id>`, or `verbatim` for a text file taken as it is (0042) | ✔ with a `file:` or `url:` key (0036) |
| `repo` | the name of the linked repo the file came from (§12 `repos`, 0042) | with `repo_path` and `commit`, all three or none; only with a `file:` key |
| `repo_path` | the file's path in that repo, forward slashes | as `repo` |
| `commit` | the full commit hash (40 hex) the file was read at | as `repo` |
| `attached_to` | the `src-` id of the Inbox row's or meeting's source this file was attached to in Notion (0042) | only with a `file:` key; must name an existing source without `attached_to` |
| `replaces` | the `src-` id of the earlier version of this input: a corrected meeting or Inbox row read again, or a new version of a document (0045) | must name an existing source that no other source replaces |
| `keep` | string: what the user asked to keep from it ("just the requirements"), from the Inbox row's Keep or the catch-up's question (0045). Absent = everything | only on a `document`, `email`, `chat` or `note` source |
| `summary` | string, aim for ≤200 chars: one line on what the source taught, written at creation; the Inbox Summary | |
| `digest` | Markdown, written at creation by the ingest skill: the key points by section and the figures and dates as stated (0043). The Inbox row body (cli.md §5.14.4) | |
| `notion_text` | `digest` or `full`. Whether the Inbox row also shows the source's text (0043). Set at creation by the kind when not given: `full` for `email` and `chat`, `digest` for `document` and `note` (cli.md §5.5); absent (a source made before 0.4.0) = `digest` | |
| `notion_parts` | non-empty list of part ranges, each `"<n>"` or `"<n>-<m>"` (1-based, inclusive, `n < m`), ascending and not overlapping; absent = all parts. Only with `notion_text: full`. Parts are defined below | |
| `notion_text_requested` | timestamp of the last request for the text (system, cli.md §5.17) | |
| `notion` | the Inbox row's page id (system). For a `capture`, the id in its `notion:` key | |
| `notion_published`, `last_synced` | as §3.2 (system) | |
| `tasks` | list of Notion task page ids created from the source's owner action items (system, cli.md §5.14.5) | |

**Kinds (0032):** `minutes` is a meeting (Notion or a minutes file); `document` a converted file or a web page fetched by URL (0036); `email` and `chat` pasted threads; `note` text the user wrote or pasted; `capture` an Inbox row the user created: its `source_key` must be `notion:<row page id>` (the JSON Schema enforces it), and its `notion`, once recorded, is that same id. The body is the text verbatim, as the ingest skill defines it per kind; for a file, the converter's output.

**Versions (0045).** Fixing an input and setting it back to Reviewed (a meeting) or Ready (an Inbox row) makes the next ingest read it again. It writes a **new** source with `replaces` = the version it read before. The earlier version stays as it was (sources are immutable, 0032). A new version of a document (v2 of a requirements file) is linked the same way when the user or the ingest says so. `brain source diff` (cli.md §5.19) gives the lines that changed, and the ingest proposes only what changed. A meeting's `source` keeps naming the first version; the latest is found by following `replaces` forward. A capture read again keeps its Inbox row: the row's Brain ID moves to the new source, and the replaced one keeps its `notion` (the same page).

**Linked repos and attachments (0042):** a file from a linked repo is a `file:` source keyed by the hash of its bytes at `commit`, with `kind: document`; its `file_name` is the last segment of `repo_path`. A file attached in Notion is a `file:` source with `attached_to`; it has no Inbox row of its own (cli.md §5.14.4). `digest`, `notion_text` and `notion_parts` are refused on a `minutes` or `capture` source and on one with `attached_to`, which have no brain-written Inbox body.

**Parts (normative, 0043).** A source body is split into numbered parts, counted from 1:
- **Slides,** when the body has at least one line that is exactly `<!-- Slide number: <n> -->` (markitdown's slide marker): each part starts at such a line and runs to the next one.
- **Sections** otherwise: the ATX headings (`#` to `######` followed by a space) outside fenced code blocks, at the smallest level present; each part starts at such a heading and runs to the next one at that level.
- A body with neither has one part, the whole body.
- Text before the first part is the **preamble**. It is always included.

The part count is fixed by the body, so a range above it is invalid.

**Hash input (normative):** the body is every byte after the newline that ends the closing `---` frontmatter line, up to the end of the file, **including** the final trailing newline. No normalization is applied (files are LF and UTF-8 by §1, so writers write exactly the bytes they hashed). Hash = lowercase hex SHA-256 of those UTF-8 bytes, prefixed `sha256:`. Example: for a file `---\n<frontmatter>\n---\n## Attendees\n…\n`, the hash covers `## Attendees\n…\n`.

### view · `projects/<slug>/`, `areas/briefs/`, `reports/` · rendered into Notion
Generated; never evidence (lint error if any note's `sources` cites a view).
| Field | Type | Req |
|---|---|---|
| `view_kind` | `brief`·`decision_log`·`area_brief`·`report` | ✔ |
| `project` | ID | ✔ for `brief` and `decision_log`; absent otherwise |
| `area` | ID | ✔ for `area_brief`; optional for `report`; absent otherwise |
| `projects` | list of IDs | optional, `report` only |
| `question` | string | ✔ for `report`: what you asked, as you asked it |
| `asked_in` | the Ask row's Notion page id, or a list of them: every Ask row that asked for this report or refreshed it, oldest first (0043, 0045) | optional, `report` only |
| `fixes` | list of `{text, received, proposals}`: each What to fix the user wrote on the Report row, when the brain read it (timestamp), and the proposals it became (system, cli.md §5.18, 0045) | optional, `report` only |
| `generated_from` | list of IDs | ✔ |
| `generated_at` | timestamp | ✔ |
| `notion`, `last_synced`, `notion_published` | as §3.2 (system) | `report` only |
Body of `brief`, `decision_log` and `area_brief`: `<!-- @generated:start -->` … `<!-- @generated:end -->`, then optional `<!-- @user:start -->` … `<!-- @user:end -->`. Tools replace only the generated block. The content of each view kind is fixed in §16.

**Reports (0043, 0045)** are the one view the CLI doesn't build: the brain-query skill writes the body, and `brain report new` (cli.md §5.18) stores it. A report is **living**: one report per subject, rewritten in place when the user asks for a refresh (`report new` with `refresh`), with a new `generated_at` (its "as of"). Git keeps every earlier version. It is never rebuilt by `brain views`, never edited otherwise, and never cited as a source, so the brain doesn't learn from its own summaries. Its body is the sections of §16.4. It is published as an Inbox row with Kind = Report.

### memory · `memories/YYYY/MM/` · never published (0008, 0009; loop is v2)
| Field | Type | Req |
|---|---|---|
| `scope` | `general`·`area`·`project`·`stack` | ✔ |
| `areas` / `projects` / `stacks` | lists | exactly the list matching `scope`, non-empty; the other two must be absent |
| `confidence` | `verified`·`inferred`·`unverified` | ✔ |
| `origin` | string (repo identity from `.brain`) | ✔ |
- **Reach is exclusive** (0009): `general` → none of `areas`, `projects`, `stacks`; `area` → only `areas`; `project` → only `projects`; `stack` → only `stacks`. A memory that should reach two levels is two memories.
- Supersession via `relations` (`supersedes` / `superseded_by`, both persisted).

---

## 5. Key facts and timeline (0010, 0011)

`facts` holds **current** values. `timeline` holds their history. Every key in `facts` must have at least one timeline entry with `assessment: accepted` whose `value` equals the current value, except when the latest entries for that key are `contested` (then `facts.<key>` holds the most recent accepted value, or is absent).

```yaml
facts:
  launch_date: 2027-02
  budget: 80000 EUR
timeline:
  - field: launch_date
    value: 2027-01
    from: 2026-10-01
    until: 2026-12-03
    learned: 2026-10-01
    source: mtg-5r2k8v3a
    assessment: superseded
  - field: launch_date
    value: 2027-02
    from: 2026-12-03
    learned: 2026-12-03
    source: mtg-8c4n2p7w
    assessment: accepted
```

| Key | Type | Req | Meaning |
|---|---|---|---|
| `field` | string | ✔ | key in `facts` |
| `value` | string, number or date | ✔ | |
| `from` | date or month | ✔ | when it became true (event time) |
| `until` | date or month | | when it stopped being true |
| `learned` | date | ✔ | when the brain learned it (transaction time) |
| `source` | ID or source key | ✔ | evidence; `notion-edit` for your corrections in Notion (0023) |
| `assessment` | enum §8 | ✔ | |
| `note` | string | | e.g. why it is contested |

---

## 6. Relations

```yaml
relations:
  - type: supersedes
    target: dec-2p9f6h1r
```

| Type | Meaning | Inverse |
|---|---|---|
| `supersedes` | this replaces target | `superseded_by` (**persisted**) |
| `superseded_by` | this was replaced by target | `supersedes` (**persisted**) |
| `about` | note is about a project/org/person | `mentioned_in` (computed) |
| `depends_on` | this needs target | `needed_by` (computed) |
| `contradicts` | conflicting claims | `contradicts` (computed) |
| `derived_from` | built from target | `used_by` (computed) |
| `related_to` | general link | `related_to` (computed) |

**Persisted vs computed (normative):**
- Only the supersession pair is written on **both** notes. Whoever creates one side writes the other in the same operation (CX-06 apply). Lint error if one side is missing.
- Every other inverse is **computed, never written**. Computed inverses are exposed by `brain index --json` as `backlinks` (see spec/cli.md): for each note id, a list of `{type, source}` sorted by `type`, then `source` id. They also include the field-based links: `projects` → `project_of`, `area` → `area_of`, `goal` → `goal_of`, `client` → `client_of`, `org` → `member`, `attendees` → `attended`, `decided_in` → `decisions`, `raised_in` → `questions`. They are **not** rendered in `index.md`.
- `decided_in` is a field on decisions, not a relation type. Targets of every relation must exist (lint error).

---

## 7. Notion-owned fields snapshot

You-owned operational fields live in Notion. Sync stores a **dated snapshot** so agents can read them without calling Notion, and lint treats it as a dated fact (0011):

```yaml
notion_fields:
  as_of: 2026-12-03T10:22:00Z
  status: Active
  priority: High
```
Only sync writes `notion_fields`. The brain never pushes these values to Notion.

---

## 8. Lifecycle and assessment (0005)

- **lifecycle** (every **knowledge** note; not `source`, `view` or `proposal`, which have their own states: immutable, regenerated, `status`; decision 0025): `draft` → `reviewed` | `disputed` → `archived`. Agents set `draft` (creation) and `archived` (supersession). They also set `reviewed`, or `archived` with no successor, when, and only when, they apply a `review_notes` proposal you decided (0041, §11.2). You set the rest in Notion.
- **assessment** (decisions, timeline entries): `accepted`, `provisional` (mentioned once, unconfirmed), `contested` (conflicting sources; keep both entries), `superseded` (replaced; kept as history).

---

## 9. Provenance markers (0004)

In bodies, a sentence or bullet not stated by a cited source ends with `^[inferred]`; one where sources disagree or are unclear ends with `^[ambiguous]`. Unmarked = stated by a source in `sources`. No other `^[...]` markers are valid.

## 10. Freshness (0011)

Every stored fact is **timeless**, **dated** (inside a dated note, a timeline entry, `notion_fields`, or carrying `(as of YYYY-MM-DD)`), or a **pointer** ("see Notion tasks"). Lint warns (v1) on body lines in undated notes that contain time-relative words (`currently`, `now`, `at the moment`, `this week`, `latest`, `recently`, `soon`) without a date.

---

## 11. Proposal file (0003) · `_proposals/`

```yaml
---
id: prp-4n8c2w7t
type: proposal
title: "Acme launch: Jan → Feb"
created: 2026-12-03
updated: 2026-12-03
kind: update_fact
target: prj-9x4t1b7e
field: launch_date
before: 2027-01
after: 2027-02
why: "Maria (now PM) confirmed launch moves to February."
source: mtg-8c4n2p7w
status: pending
notion: 7c6b…
---
```

| Field | Type | Req | Notes |
|---|---|---|---|
| `kind` | `update_fact`·`add_to_note`·`update_body`·`add_link`·`supersede`·`contradiction`·`merge`·`new_item`·`review_notes`·`answer` | ✔ | `new_item`: a new note the agent is unsure about (e.g. possible duplicate person). `add_link`: add values to list fields of one note (0028); one proposal groups the routine links of one ingest for that note (0037). `review_notes`: one per ingest, everything that source proposes except judgment calls: the new notes, the routine links, and the fact, text and reference changes (0041, 0043, 0045). `update_body`: a new body for a `reference` note (0045). `answer`: an answer to an open question (0041) |
| `target` | ID | ✔ (except `new_item` and `review_notes`) | see per-kind rules below; for `answer`, a question |
| `field` | string | for `update_fact`, `contradiction`; `add_link` written before 0.3.0 | fact key; for an old single `add_link`, the list field |
| `links` | list of `{field, value}`, at least one; on `review_notes` a list of `{target, field, value}`, possibly empty | for `add_link` written from 0.3.0 on; for `review_notes` | the values to add (0037). `field` is the list field: `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders`, declared by the target's type; `value` is a note id with the field's prefix (`prj-`, `per-`) for reference fields, else a non-empty string. Pairs (triples on `review_notes`) are unique. A proposal with `field` and `after` (before 0.3.0) is read as `links: [{field, value: after}]` |
| `notes` | list of knowledge note IDs, unique | for `review_notes` (with `links` and `changes`, at least one entry in all) | the new notes of the ingest, in the order the ingest wrote them |
| `changes` | list of change objects | optional, `review_notes` only (0045) | the `update_fact`, `update_body` and `add_to_note` items of the same ingest, each `{kind, target, why?, …}` with that kind's own fields (`field`, `before`, `after`, `from` · `content`, `before_hash` · `content`). Stored in render order: every `update_fact`, then every `update_body`, then every `add_to_note`, each group in input order (§11.3) |
| `before_hash` | `sha256:<64 hex>` | for `update_body` | the target's body hash when the proposal was written (the source hash rule of §4); the stale check |
| `deferred_from` | ID (`prp-`) | | a `review_notes` holding the items the user left out of an approved one ("all except e"): that proposal's id (0045, §11.3) |
| `dropped` | list of `{change: <index>, reason: stale}` | system, set by apply | the changes of an applied `review_notes` that were not applied because their target changed first (§11.3) |
| `answer` | string | for `answer` | the answer in a sentence |
| `answer_note` | ID | | for `answer`: the note that holds the answer, usually a decision the same ingest created |
| `before` / `after` | string, number or date | `after` for `update_fact` (and an old single `add_link`); both for `contradiction` | `before` = current value at proposal time (absent if the fact is new) |
| `from` | date or month | for `update_fact`, `contradiction` | event time of the new value; defaults to the source meeting's `date`, else `created` |
| `content` | string | for `add_to_note`, `update_body` | `add_to_note`: Markdown to append. `update_body`: the whole new body |
| `note` | object | for `new_item` | one `brain note new` input item without `id`: `{type, title, frontmatter, body, file_date?}` ([cli.md](cli.md) §5.5) |
| `supersedes` | ID | for `supersede` | the older note |
| `merge_into` | ID | for `merge` | survivor |
| `why` | string | ✔ | the source sentence that triggered it |
| `source` | ID or source key | ✔ | |
| `status` | `pending`·`approved`·`rejected`·`edited`·`applied`·`closed` | ✔ | |
| `decision` | `{action: approve·reject·fix·edit, value?, note?, fixes?, exclude?, decided_at, decided_by: notion·chat}` | when decided | `note`: the Review row's What to fix (Note before 0.5.0), kept as written. `fixes`: on `fix`, the corrected values the skill read from `note` (§11.3). `edit` with `value` is the form before 0.5.0, still read. `exclude`: only on an approved or fixed `add_link` or `review_notes` ("all except X"): on `add_link`, a list of `{field, value}` from its `links`; on `review_notes`, a list of `{note: <id>}` from its `notes`, `{target, field, value}` from its `links` and `{change: <index>}` from its `changes` |
| `closed_reason` | `stale` | only with `status: closed` and a non-reject decision | the target changed before apply (§11.1) |
| `notion` | Review row page id | | |

### 11.1 Status and decision (normative)

| `status` | `decision` | Meaning |
|---|---|---|
| `pending` | absent | waiting for you |
| `approved` | `action: approve` | decided, not yet applied |
| `edited` | `action: fix` + `fixes`, or `action: edit` + `value` (before 0.5.0) | decided with your corrections, not yet applied |
| `rejected` | `action: reject` | decided, not yet closed |
| `applied` | `approve`, `fix` or `edit` | applied to the target; terminal |
| `closed` | `reject` | rejected and closed; terminal |
| `closed` + `closed_reason: stale` | `approve`, `fix` or `edit` | the target's value changed after the proposal was written, so it was not applied; terminal. A new proposal may be written against the current value |

`brain apply` moves `approved`/`edited` → `applied` and `rejected` → `closed`. Applying a proposal already in a terminal state is a **no-op** (exit 0, reported as skipped). `fix` is allowed on every kind (0045; §11.3 gives the `fixes` each kind takes). `edit` stays allowed only for `update_fact`, `contradiction`, `add_to_note`, `update_body` and `answer`; an `edit` on any other kind is an error (exit non-zero, proposal left unchanged).

### 11.2 How each kind is applied (normative)

Let **D** = `decision.decided_at` (date part), **V** = `decision.value` for `edit`, else the proposal's own value. Every note changed below also gets `updated` = today ([cli.md](cli.md) §3.6.6).

| Kind | `target` is | On approve / edit | On reject |
|---|---|---|---|
| `update_fact` | the note owning the fact | In `timeline`, each entry for `field` with `assessment: accepted` gets `until: <from>` and `assessment: superseded`. Append `{field, value: V(after), from, learned: D, source, assessment: accepted}`. Set `facts.<field> = V` | nothing changes |
| `contradiction` | the note owning the fact | **approve:** keep both claims. Existing accepted entries for `field` become `contested`; append `{field, value: after, from, learned: D, source, assessment: contested}`; remove `facts.<field>`. **edit:** V is the accepted truth. Only entries for `field` whose assessment is `accepted` or `contested` change: if one or more of them has value V, the latest of those (by `learned`, then position) becomes `accepted`; every other one becomes `superseded` with `until: <from>`. If none has value V, every one of them becomes `superseded` with `until: <from>`, and `{field, value: V, from, learned: D, source, assessment: accepted}` is appended. Already-superseded entries are left as they are. Set `facts.<field> = V` | nothing changes |
| `add_link` | the note whose lists grow | For each entry of `links` not in `decision.exclude`, in order: append `value` to `target.<field>` if it is not already there (0028). No edit. Excluding every entry applies nothing to the target; the proposal is still `applied` | nothing changes |
| `add_to_note` | the note to extend | Append V(content) to the end of the body, separated by exactly one blank line, followed by a line `Source: <source>`. Add `source` to `sources` if missing | nothing changes |
| `update_body` | a `reference` note (0045) | Replace the body with V(content). Add `source` to `sources` if missing. **Stale** when the target's body hash differs from `before_hash` (§11.1, closed with `closed_reason: stale`) | nothing changes |
| `supersede` | the **newer** note (already written as `draft` by the ingest, 0003) | `target.relations` += `{supersedes: <supersedes>}`; `<supersedes>.relations` += `{superseded_by: target}`; older note `lifecycle: archived`; if both are decisions, older gets `assessment: superseded` and `valid_until: <target.valid_from or target.date>` | the newer note stays, without the relation |
| `merge` | the **duplicate** X to retire, merged into the survivor Y = `merge_into` | Steps, in order: **1. References.** In every note except X, Y, sources and proposals (proposals are a record of what was decided about X), rewrite frontmatter references to X's id into Y's id (then dedupe each list, keeping the first occurrence) and relative links to X's file into links to Y's file. **Persisted pairs are left alone**: a meeting's `decisions`/`questions` entries, a decision's `decided_in`, a question's `raised_in`, and other notes' `supersedes`/`superseded_by` relations keep pointing at X, whose side of those pairs stays in place (X is archived, not deleted). **2. Into Y:** union `aliases` (plus X's `title`), `tags`, `sources`, `projects`; add X's `relations` except `supersedes`/`superseded_by` and any whose target is X or Y (dedupe); append X's `timeline` entries (dedupe exact entries); a `facts` key only X has is copied to Y; for a key both have, Y's value stays and X's `accepted` entries with a different value become `superseded` with `until: <today>`; append X's body under `## Merged from <X title>`. **3. Pair:** X gets `lifecycle: archived` and `relations` += `{superseded_by: Y}`; Y gets `{supersedes: X}`. If X is a decision, it also gets `assessment: superseded` and `valid_until` = Y's `valid_from` or `date` | nothing changes |
| `new_item` | — | Write `note` as a new note with the `brain note new` rules (lifecycle `draft`). If it has `decided_in` or `raised_in`, add its id to that meeting's `decisions` or `questions` | discard |
| `review_notes` | — (the notes, link targets and change targets it lists) | In this order: every entry of `changes` not excluded is applied with its kind's rule above, or dropped when stale (§11.3); every listed note not excluded and still `draft` gets `lifecycle: reviewed`; every entry of `links` not excluded is applied to its `target` as an `add_link` entry (append if not already there). A listed note that is no longer `draft` is left as it is and reported (cli.md §5.7). Excluded items are **deferred** to a new pending `review_notes` (§11.3); an excluded note stays `draft`. `fix` corrects items first (§11.3) | Every listed note still `draft` gets `lifecycle: archived`, with no successor; nothing is deleted. No link or change is applied |
| `answer` | the question | The question's `answer` = `answer_note` when set, else V(`answer`). **edit:** `answer` = V (your Note, as text); `answer_note` is not used. The next publish sets the question's Notion Status to Answered (cli.md §5.14.4) | nothing changes; the question stays open |

**Merge caveats.** A still-pending proposal that targets X keeps pointing at the archived X; apply it or reject it. If X is already a superseded decision, merging overwrites its `valid_until` with Y's `valid_from` or `date`.

**Write sets.** Besides the proposal file itself, applying a proposal writes only: `update_fact`, `contradiction`, `add_to_note`, `update_body`, `add_link`, `answer` → the target; `supersede` → the target and the older note; `merge` → X, Y and the notes whose references step 1 rewrites; `new_item` → the new note and its meeting; `review_notes` → every listed note whose lifecycle or fixed fields change, every link and change target that changes, and the deferred proposal when it excludes anything. All writes for one proposal happen in one operation; if any write fails, none are kept.

### 11.3 One row per source, deferral and Fix (normative, 0045)

**Item order and letters.** A `review_notes` row's items are, in this order: its `changes` (as stored: `update_fact`, then `update_body`, then `add_to_note`), its `notes`, its `links`. They are lettered `a`, `b`, … `z`, `aa`, `ab`, … in that order (cli.md §5.14.4), and the skill maps the letters the user writes back to these entries: `{change: <index>}` (0-based in `changes`), `{note: <id>}`, `{target, field, value}`.

**Deferral.** When an approved or fixed `review_notes` has `exclude`, apply writes **one** new proposal holding every excluded item: `kind: review_notes`, `status: pending`, the same `source`, `deferred_from` = this proposal's id, `notes` = the excluded notes, `links` = the excluded links, `changes` = the excluded changes (each as stored, `before` and `before_hash` included, so a stale one is still caught), all in their original order; `title` = `Deferred from <source title>: <counts>` (cli.md §5.6 counts rule); `why` = this proposal's `why`. The excluded notes stay `draft`. The user decides that row later like any other. On an `add_link`, `exclude` keeps its meaning before 0.5.0: the excluded links are not applied and nothing is deferred.

**Stale changes.** A change of an `update_fact` kind whose target's `facts.<field>` no longer equals its `before`, or of an `update_body` kind whose target's body hash no longer equals its `before_hash`, is not applied. Apply records `{change: <index>, reason: stale}` in `dropped` and applies the rest; the proposal is `applied`. A standalone `update_fact`, `contradiction` or `update_body` is still closed as stale, as §11.1 says.

**Fix.** `decision.action: fix` applies the proposal **corrected** by `fixes` (at least one entry; `note` required: the user's words). Each kind takes these entries:

| Kind | `fixes` entries | Effect |
|---|---|---|
| `update_fact`, `contradiction`, `add_to_note`, `update_body`, `answer` | exactly one `{value}` | as `edit` with V = `value` (§11.2) |
| `supersede` | exactly one `{value: <id>}` | the older note is `value` instead of `supersedes` (same checks as `proposal new`) |
| `merge` | exactly one `{value: <id>}` | the survivor is `value` instead of `merge_into` |
| `new_item` | one or more `{field, value}` | `field` is `title` or a key of `note.frontmatter`; set before the note is written, then validated as `note new` |
| `add_link` | one or more `{link: {field, value}, value}` | that link is applied with the new `value` |
| `review_notes` | one or more of `{change: <index>, value}`, `{note: <id>, field, value}`, `{link: {target, field, value}, value}` | a change is applied with `after` (`update_fact`) or `content` (`update_body`, `add_to_note`) = `value`; a listed note gets `field` = `value` before it is reviewed, where `field` is one a correction may set (cli.md §5.7) or `projects` (a list of `prj-` ids); a link is applied with the new `value` |

A fixed item can't also be excluded. A `fixes` entry that names no item of the proposal → `FIX_UNKNOWN`; a value of the wrong shape → `INVALID_RESULT` (cli.md §5.7). Both leave the proposal unchanged.

## 12. `brain.json` · see [schemas/brain.schema.json](schemas/brain.schema.json)

```json
{
  "schema_version": 1,
  "owner": { "name": "Rodrigo", "person": "per-3h8w2n6c" },
  "budgets": { "ingest_max_notes": 8 },
  "settings": { "publish": "ask", "push": "auto" },
  "repos": [
    { "name": "acme-api", "path": "~/code/acme-api", "area": "area-2m7c4h8n",
      "patterns": ["decisions/**", "docs/vision.md", "CHANGELOG.md"], "commit": "" }
  ],
  "notion": {
    "databases": { "areas": "", "goals": "", "key_results": "", "projects": "", "meetings": "",
                   "people": "", "orgs": "", "decisions": "", "questions": "", "review": "", "inbox": "",
                   "concepts": "", "references": "" },
    "tasks": {
      "database": "",
      "properties": { "title": "Name", "status": "Status", "due": "Due", "project": "Project",
                      "area": "Area", "owner": "", "meeting": "Meeting", "meeting_url": "", "source": "Source",
                      "brain_id": "Brain ID" },
      "new_task_status": "To Do",
      "status_type": "status"
    }
  }
}
```

**Owner** (0037): `name` is how the brain addresses you; `person` (optional) is your person note, whose `aliases` hold every name and work email you appear under.

**Settings** (0037, 0038), read by the skills; the CLI only validates them:
- `publish`: `ask` (default) asks before each publish to Notion; `auto` publishes after each run without asking.
- `push`: `auto` (default) pushes the brain after a run's commits; `remind` leaves it to you, and the report says how many commits are not pushed.

**Repos** (0042): the linked repos the brain reads, never writes. Each has a unique `name` (lowercase kebab-case), a `path` (absolute or starting with `~/`; the machine's own clone), the `area` its knowledge belongs to (an existing `area-` id), `patterns` (non-empty list of Git glob pathspecs, relative to the repo root, e.g. `decisions/**`), and `commit`, the last commit ingested (40 hex, or `""` before the first ingest). Written by `brain repo add` and `brain repo record` (cli.md §5.16); `repos` absent means none.

**Databases:** `inbox` is the database formerly called Capture Inbox; a `brain.json` that still has `capture_inbox` is read as `inbox` when `inbox` is absent, and `brain upgrade` renames the key (cli.md §5.15). `concepts` holds concept notes; `references` holds reference notes (0045), and a brain without the key publishes none (warning `DATABASE_NOT_CONFIGURED`, cli.md §5.14.4).

**Tasks mapping (0018):** each value is the name of a property in your Tasks database; an empty string means "this database has no such property", and the field is skipped.
- `title` is required.
- `status_type` (#113): the Notion type of the mapped `status` property, `status` (Notion's built-in Status, as in the default Tasks database) or `select`. Absent means `select`, the type every brain made before 0.3.2 was sent, so an existing mapping to a select property keeps working; the template `brain.json` sets `status` for the default Tasks database. It isn't a property name, so it sits next to `new_task_status`, outside `properties`.
- `owner`: a person or text property for the action item's owner.
- **Backlink to the meeting** (required by 0018): `meeting` = a relation property to the Meetings database (preferred), or `meeting_url` = a URL property when your Tasks database has no relation to Meetings. Once `tasks.database` is set, `title` and at least one of the two must be non-empty (the JSON Schema enforces it).
- `source` (0037): a relation property to the Inbox, the backlink for an owner task taken from a document, email, chat, note or capture (cli.md §5.14.5). Empty → such tasks have no backlink.
- `brain_id`: a text property holding the brain's id for the task's source meeting (or source), so a re-run never duplicates tasks.

## 13. Generated files

- **`index.md`** (0013), normative format:
  1. First line `<!-- GENERATED by brain index. Do not edit. -->`, a blank line, then `# Index`.
  2. One section per type, in this order, headed `## Areas`, `## Goals`, `## Projects`, `## People`, `## Orgs`, `## Decisions`, `## Questions`, `## Meetings`, `## Concepts`, `## References` (0045). Each heading is preceded by one blank line; the note lines follow it directly. Sections with no notes are omitted. Sources, views, proposals and memories are not listed.
  3. Within a section, notes are sorted by `title` compared as lowercase Unicode NFC code points, then by `id`.
  4. Each note is one line:
     `- [<title>](<path>) — <id>[ · <field>: <value>]… · <summary>[ · aliases: <a>, <b>][ · <lifecycle>]`
     - `<path>`: relative to the brain root, forward slashes.
     - `<title>`: `\`, `[` and `]` escaped as `\\`, `\[`, `\]`. In every interpolated value (title, summary, field values, referenced titles, aliases), each line break (`\r\n`, `\r` or `\n`) together with the spaces and tabs around it becomes a single space, and the value is trimmed. A value that is not a string or number is left out. Nothing else is escaped: the line is for reading, not parsing back, so a ` · ` or `, ` inside a value is kept as is. Agents that need structure use `brain index --json`.
     - Per-type fields, in this order. References render the **title** of the referenced note (its id if it does not exist); lists join titles with `, ` in listed order; a missing value omits that `<field>: <value>` segment entirely:

       | Type | Fields |
       |---|---|
       | area | — |
       | goal | `area`, `status` (`notion_fields.status`), `deadline` (`facts.deadline`) |
       | project | `area`, `status` (`notion_fields.status`), `client` |
       | person | `org`, `role` (`facts.role`) |
       | org | `relationship` (`notion_fields.relationship`) |
       | decision | `date`, `assessment`, `project` (`projects`) |
       | question | `kind`, `status` (`notion_fields.status`) |
       | meeting | `date`, `project` (`projects`) |
       | concept | — |
       | reference | `area`, `project` (`projects`) (0045) |
     - `aliases` segment only when the list is non-empty. `<lifecycle>` segment only when lifecycle is `disputed` or `archived`.
  5. File ends with exactly one newline. Running `brain index` twice produces identical bytes.

  Example: `- [Acme website](projects/acme-website/project.md) — prj-9x4t1b7e · area: Clients · status: Active · client: Acme · Rebuild of Acme's marketing website, launching February 2027. · aliases: acme site`
- **`log/YYYY-MM.md`**: append-only. First line `<!-- GENERATED by brain. Append-only. -->`, a blank line, then one line per operation (format details in [cli.md](cli.md) §3.9):
  `- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w "Acme sync" created=4 proposals=3`

## 14. Notion property mapping

| Notion database · property | Brain field |
|---|---|
| all · Name / Summary / Lifecycle / Brain ID / Last Synced | `title` / `summary` / `lifecycle` / `id` / `last_synced` |
| Areas · Type, Archived | `notion_fields.type`, `.archived` |
| Goals · Why, Deadline | `why`, `facts.deadline` |
| Goals · Status, Progress, Archived | `notion_fields.status`, `.progress`, `.archived` |
| Goals · Area, Projects | `area`, inverse of project `goal` |
| Key Results · all | `notion_fields.key_results` on the goal (snapshot) |
| Projects · Key Facts | rendered from `facts` ("Launch: 2027-02 · Budget: 80000 EUR") |
| Projects · Status, Priority, Dates, Archived | `notion_fields.*` |
| Projects · Area, Goal, Client, People | `area`, `goal`, `client`, `people` |
| Projects · Meetings, Decisions, Questions | inverses of `projects` on those notes |
| Meetings · Date, Attendees, Project, Area | `date`, `attendees`, `projects`, `area` (the brain only adds to these; cli.md §5.14.4) |
| Meetings · Decisions, Questions | `decisions`, `questions` |
| Meetings · Brain Status, Ingested At | set by ingest (`Ingested`, timestamp); not stored in the note |
| People · Role, Org, Email | `facts.role`, `org`, `notion_fields.email` |
| Orgs · Relationship, Website | `notion_fields.relationship`, `.website` |
| Decisions · Date, Assessment, Project, Decided In, Supersedes | `date`, `assessment`, `projects`, `decided_in`, `relations[supersedes]` |
| Decisions, Questions · Area | derived: the `area` of each of the record's `projects` (0034); not stored in the note |
| Questions · Kind, Status, Project, Raised In | `kind`, `notion_fields.status`, `projects`, `raised_in`. Status = Open is written once while Notion has none, and Answered once after an applied `answer` (0041, 0045) |
| Areas · Brief toggle | the area's `area_brief` view (§16.3, 0041) |
| Concepts · Area, Project | `area`, `projects` |
| References · Area, Project, page body | `area`, `projects`, the body (0045) |
| Decisions, Questions, Concepts, References, People · Sources | inverse of the Inbox relations below (Notion fills it) |
| Inbox · Name | the source's `title` (on rows the brain creates; a capture's Name is yours) |
| Inbox · Kind, Summary | source `kind` (`Capture`, `Document`, `Email`, `Chat`, `Note`), source `summary`; `Report` for a report view; `Ask` is yours (0043) |
| Inbox · page body | a brain-created row's digest and, when chosen, its "Full text" toggle (0043); a report's body. Never a capture's or an Ask row's |
| Inbox · Full text | yours (a checkbox: ask for the text); the brain clears it once the text is published (0043) |
| Inbox · Ask, Report | a report's `asked_in` (two-way relation within the Inbox, 0043) |
| Inbox · Keep | yours: what to keep from a document, email, chat or note; the ingest stores it as the source's `keep` (0045) |
| Inbox · Refresh (checkbox), on a Report row | yours: ask for the report again; the brain clears it when it rewrites the report (0045) |
| Inbox · Refresh (relation), on an Ask row | yours: the report this Ask refreshes; empty = a new report (0045) |
| Inbox · What to fix, on a Report row | yours: what the report gets wrong; the brain records it in the report's `fixes`, turns it into proposals and clears it (0045) |
| Inbox · Decisions, Questions, Concepts, References, People | derived: the published notes of those types whose `sources` lists the source's id |
| Inbox · Project, Area | yours; the brain fills them only when empty, from the produced notes' `projects` and `area` |
| Inbox · Brain Status | `Processed`, set by the brain when it publishes the row; `New`, `Ready` and `Skipped` are yours. A catch-up takes in a row only when it is `Ready`, or a capture `New` for a day or more (0045) |
| Review · all | proposal fields (§11): Name=`title`, Kind (`Review Notes` and `Answer` from 0.4.0, `Update Body` from 0.5.0), About=`target` title + id (Target before 0.5.0), About Page (Target Page), Now (Before), Proposed (After), Why, Source Meeting=`source`, Your call/What to fix → `decision` (Decision/Note before 0.5.0; cli.md §5.14.2), State from `status`. Now, Proposed and Why are plain text: each Markdown link becomes its link text (links in proposal text are relative to the target note's folder) |

## 15. Lint rules derived from this spec

Errors: `.md` file in a note folder without frontmatter `id`; unparseable frontmatter; invalid frontmatter vs schema; missing required field; malformed or duplicate ID; type in wrong folder; frontmatter reference to a missing ID; broken relative link; `[[wikilink]]` present; unknown `^[...]` marker; source body hash mismatch (§4 source); a view cited as a source; `facts` key without a matching accepted timeline entry (unless contested); one side of a `supersedes`/`superseded_by` pair missing (§6); `decided_in`/`raised_in` disagreeing with the meeting's lists; superseded decision without `valid_until`; superseded decision without a `superseded_by` relation (0005); decision without `sources` (0005); memory reach lists not matching `scope`; proposal `status` and `decision` not matching §11.1; a product-owned file (shipped skill file, AGENTS.md rules block) differing from the installed package (0038); a source's `notion_parts` naming a part above its body's part count (§4 source); a `review_notes` listing a note that isn't a knowledge note, or a note listed by two `review_notes` proposals, unless one excluded it and the other has `deferred_from` = that one (0041, 0045); a source's `replaces` naming no source, or a source replaced by two others (0045); a `reference` with no `sources`, or an `update_body` whose target isn't a `reference` (0045).
Warnings: unknown frontmatter key; freshness (§10); summary longer than 200 chars; knowledge note with no `sources` (except area, goal, project; decisions are an error above); generated block of a view out of date (re-run `brain views`); `index.md` out of date (re-run `brain index`).
Rule codes, output format and the folders scanned are in [cli.md](cli.md) §5.10 and §3.7.

## 16. Derived view contract (normative)

Views are rebuilt by `brain views` for every project and every area (CX-07, 0041); reports (§16.4) are not rebuilt. Inputs are canonical notes only. All links are relative to the view file. Dates render as stored. Every item line links to the note it came from (headings and `- None` lines have no link). The view's frontmatter `title` is `<project title> — brief`, `<project title> — decision log` or `<area title> — brief`; the body has no heading of its own. Its layout is: one blank line, the generated block, one blank line, the user block. Inside the generated block, sections are separated by one blank line.

**Idempotence:** if the new generated block and `generated_from` equal the current ones, the file is not rewritten (so `generated_at` only changes when content changes). `generated_from` is the project's id plus the id of every note that produced an item line, sorted.

### 16.1 `brief.md` (`view_kind: brief`)
The generated block contains these sections in this order; a section with no items renders a single line `- None`.

1. `## Status`
   - `- Status: <notion_fields.status> · Priority: <notion_fields.priority> (as of <notion_fields.as_of date>) ([project](project.md))`, omitting absent parts; omitted entirely if `notion_fields` is absent.
   - One line per `facts` key, sorted by key: `- <Key>: <value> ([project](project.md))`, where `<Key>` is the key with `_` → space and the first letter capitalized (`launch_date` → `Launch date`). Person-id values render as the person's linked title.
2. `## Goal` — `- [<goal title>](<path>)` or `- None`.
3. `## People` — project `people`, sorted by title then id: `- [<title>](<path>)[ — <facts.role>]`.
4. `## Recent decisions` — decisions whose `projects` contains the project, `assessment` is `accepted`, `provisional` or `contested`, and `lifecycle` is `reviewed` (0041); sorted by `date` descending, then id; at most 5: `- <date> — [<title>](<path>) (<assessment>)`.
5. `## Open questions` — questions whose `projects` contains the project, `notion_fields.status` is `Open` or absent, `answer` is absent, and `lifecycle` is `reviewed` (0041); sorted by `created` descending, then id: `- [<title>](<path>) (<kind>)`.

**Waiting line (0041).** In sections 4 and 5, when no note qualifies but N ≥ 1 notes would qualify if their `lifecycle` were `reviewed` (they are `draft`), the section renders the single line `- Nothing reviewed yet: N notes waiting in Review` (`1 note` for one) in place of `- None`. Those draft notes produce no item line and are not in `generated_from`.
6. `## Recent meetings` — meetings whose `projects` contains the project; sorted by `date` descending, then id; at most 5: `- <date> — [<title>](<path>)`.

### 16.2 `decision-log.md` (`view_kind: decision_log`)
The decision log lists every decision of the project, whatever its lifecycle: it is the history, not a summary of what you reviewed.

Two sections, each sorted by `date` descending (`valid_until` descending for superseded), then id; empty section renders `- None`:

1. `## Current` — decisions for the project with `assessment` `accepted`, `provisional` or `contested`:
   `- <date> — [<title>](<path>) — <assessment>[ — supersedes [<old title>](<old path>)]`
2. `## Superseded` — decisions for the project with `assessment: superseded`:
   `- <valid_from or date> → <valid_until> — [<title>](<path>) — superseded by [<new title>](<new path>)`

### 16.3 `areas/briefs/<area slug>.md` (`view_kind: area_brief`, 0041)
One per area, rebuilt with the project views; `<area slug>` is the slug of the area note's file name. A note **belongs to the area** when its `area` is the area, or any note in its `projects` has that `area`. Sections in this order; a section with no items renders `- None`, and sections 2 and 3 use the waiting line of §16.1:

1. `## Projects` — projects whose `area` is the area and whose `notion_fields.archived` is not `true`, sorted by title then id: `- [<title>](<path>)[ — <notion_fields.status>]`.
2. `## Recent decisions` — decisions that belong to the area, with the filters and format of §16.1 item 4; at most 5.
3. `## Open questions` — questions that belong to the area, with the filters and format of §16.1 item 5; at most 10.

`generated_from` is the area's id plus every note that produced an item line, sorted. The publish writes the generated block into the "Brief" toggle heading of the area page (cli.md §5.14.4).

### 16.4 `reports/YYYY-MM-DD-<slug>.md` (`view_kind: report`, 0043)
Written by `brain report new` from the skill's text; no `@generated` markers. The body is exactly these six `##` sections, in this order, and nothing before the first:

1. `## Where it stands` — 3 to 5 lines, as of the report's date.
2. `## Timeline` — one bullet per dated event, oldest first: `- <YYYY-MM-DD> · <what happened> ([<note title>](<path>))`.
3. `## Decisions in force`
4. `## Open questions and risks`
5. `## People involved`
6. `## Gaps` — what the brain doesn't know.

A section with nothing renders `- None`. Each line that rests on a `draft` note ends with ` *(not reviewed)*`. Links are relative to the report file, as for every view. `generated_from` lists every note the body links to, sorted.

**Refreshing (0045).** A refresh rewrites the same file: the six sections from what the brain knows now, a new `generated_at` and `generated_from`. The path, id, `question` and `notion` stay. "Where it stands" is as of the new date.
