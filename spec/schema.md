# Brain Schema Specification (v1)

**Schema version:** `1`
**Status:** Draft for review (task CC-01)
**Machine-readable:** [schemas/note.schema.json](schemas/note.schema.json), [schemas/proposal.schema.json](schemas/proposal.schema.json), [schemas/brain.schema.json](schemas/brain.schema.json)
**Examples:** [examples/valid/](examples/valid/), [examples/invalid/](examples/invalid/). Every valid example passes the JSON Schemas and every invalid one fails (checked with Ajv, draft 2020-12); CX-05 should keep this as a test.

This is the contract for every file in a user's brain repo. The CLI (`src/`) validates against it, and the skills write to it. When this document and the JSON Schemas disagree, the JSON Schemas win and this document is fixed.

Decisions referenced: 0001–0005, 0008–0011, 0013, 0017, 0018, 0020, 0021, 0023, 0032, 0041–0043, 0045, 0048–0050, 0064, 0072.

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
| `prj` | project | | `con` | concept (retired in 0.9.1: a former concept is a learned Document that keeps its `con-` id, 0071) |
| `per` | person | | `src` | source |
| `org` | org | | `mem` | memory |
| `mtg` | meeting | | `prp` | proposal |
| `vw` | view | | `ref` | reference |
| `dom` | domain | | | |

The prefix is fixed at creation even if `type` later changes; `type` is the truth.

---

## 2. Folder layout

```text
<brain>/
├── AGENTS.md, CLAUDE.md         product-owned sections fenced (see templates)
├── brain.json                   §11
├── index.md                     GENERATED §12
├── log/YYYY-MM.md               GENERATED §12
├── domains/<slug>.md            type: domain
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
│   └── references/<slug>.md     type: reference, shown as Document (0045, 0049; a learned Document too, 0071)
├── sources/notion/YYYY-MM-DD-<slug>.md  type: source (immutable), key notion:
├── sources/files/YYYY-MM-DD-<slug>.md   type: source, key file: (0032)
├── sources/text/YYYY-MM-DD-<slug>.md    type: source, key url: or agent: (0032)
├── reports/YYYY-MM-DD-<slug>.md   type: view, view_kind report (0043); Notion: a Documents row, Origin Report (0071)
├── memories/YYYY/MM/YYYY-MM-DD-<slug>.md type: memory (v2 loop)
├── _proposals/YYYY-MM-DD-<slug>.md      type: proposal
├── _assistant/dismissals.json   Ultimate Assistant's skipped findings (JSON, not a note; assistant.md §8)
└── .claude/agents/ultimate-assistant.md   the Ultimate Assistant sub-agent (product-owned; assistant.md §10)
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
| `lifecycle` | enum `draft`·`reviewed`·`disputed`·`archived` | ✔ | you (agents set `draft` on creation, `archived` via supersession); for domain, area, goal, project and org the brain (`reviewed` on creation, 0070) | 0005, 0070 |
| `lineage_cleared` | list of input ids | | system | inputs (Notion page ids) the user marked this note independent of in the exclusion cleanup row; a second input adds to the list (capture-and-review §5.1, §5.2) |
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

> **0.8.0 additions (decision 0055), specified in [capture-and-review.md](capture-and-review.md):** the optional `domain` note type and `area.domain` (§1), the Won't Do task status (§2), selected-extract sources with `extract`, `extract_of`, `extract_version`, `transcript_hash`, `selection` and per-paragraph `passage_hash` (§4.5), passage references on claims (`passage`, `^[src-…#¶n:hash]`, §5.1), and per-item decisions in a proposal (`item_id`, `item_decisions`, §7). Their fields are added to this file by CC-76, CC-78 and CC-79 with the code that reads them.

Each row lists fields **in addition to** §3. "Notion" names the database the type is mirrored to ([notion-space-design.md](../docs/notion-space-design.md) §3).

### area · `areas/` · Notion: Areas
An ongoing responsibility (e.g. "Clients", "Health").
- `domain`: optional scalar `dom-` ID, naming at most one Domain (0055).
- `notion_fields`: `archived` (bool). Before 0.9.0 it also held `type` (`Business`·`Personal`) from Areas · Type; the property moved to Domains (CC-120), lint still accepts the old value, and the next `sync apply` drops it.
- `track`: optional list of 1 to 8 short lowercase strings, the kinds of thing worth extracting in this Area (`[budget, deadlines, scope changes, risks]`): the minimal per-area tracking preference (0061, from 0.14.0; [setup.md](setup.md) §11). Owner: brain; set in setup's seeding preview or on the user's request; not published to Notion. Absent means the ingest's generic list.
- Body: description.

### domain · `domains/` · Notion: Domains (0055)
A work or life context that groups Areas; distinct from an Org.
- `org`: optional scalar `org-` ID, naming an Org.
- `notion_fields`: `type` (`Personal`·`Entrepreneurship`·`Professional`, from Domains · Type, 0.9.0), `archived` (optional boolean).
- Body: description. With Domains off, notes remain in Git and are still indexed and linted.

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
- `notion_fields`: `relationship` (`Client`·`Prospect`·`Partner`·`Supplier`·`Employer`·`Other`; `Employer` from 0071), `website`, `archived` (bool, 0070).

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
| `passage` | `src-…#¶n:<8 hex>` | | the passage of a selected extract the entry rests on (0055, capture-and-review §5.1); present on a claim written from an extract |
| `decided_in` | ID (`mtg-`) | | brain |
| `deciders` | list of IDs (`per-`) | | brain |
| `valid_from` | date | | brain; defaults to `date` when absent (0005) |
| `valid_until` | date | required when `assessment: superseded` | brain; the superseding decision's `valid_from` (or `date`) |
| `workflow` | `{id: wf-…, artifact: art-…}` | | brain; the connected workflow and artifact this decision publishes (connected-workflows.md §6.3). `note new` writes such a decision `reviewed`: the user approved the artifact, so it gets its page at once (0071) |
- Supersession uses `relations`: the newer decision has `supersedes: <old>`, the older has `superseded_by: <new>` (both persisted, §6). A superseded decision has `assessment: superseded`, `valid_until` set, and lifecycle `archived`.
- `decided_in` and the meeting's `decisions` list must agree (lint error otherwise); same for question `raised_in` and the meeting's `questions`.
- Body sections: `## Decision`, `## Context`, `## Consequences`, `## Sources`.

### question · `knowledge/questions/` · Notion: Questions
| Field | Type | Req | Owner |
|---|---|---|---|
| `kind` | `question`·`risk` | ✔ | brain |
| `raised_in` | ID (`mtg-`) | | brain |
| `answer` | string or ID | | brain (set by an applied `answer` proposal, 0041) |
| `dropped` | date | | brain (set by `brain question drop`, cli.md §5.30, 0071): the day the to-do tidy dropped it, because it was a to-do, not a question |
| `task` | string (Notion task page id) | only with `dropped` | brain: the Task it became, when the tidy converted it (capture-and-review §6.2) |
- `notion_fields`: `status` (`Open`·`Answered`·`Dropped`). Status is yours, with three exceptions, each sent once: a question reaches Notion as Open while you have set no Status (0045), the publish after an applied `answer` proposal sets it to Answered (0041), and the publish after a drop sets it to Dropped (0071, cli.md §5.14.4).
- A line someone has to act on is never a question (0071, capture-and-review §6.1): the owner's to-do is a Task, someone else's a commitment in the text.

### concept · retired in 0.9.1 (0071)
Concepts are **learned Documents** since 0.9.1: a `reference` with `origin: learned` (below). `brain upgrade` converts every `type: concept` note (cli.md §5.15 step 5a): it becomes `type: reference`, `origin: learned`, moves from `knowledge/concepts/<slug>.md` to `knowledge/references/<slug>.md` and keeps its `con-` id (§1: the prefix is fixed at creation), so no frontmatter reference changes. A `type: concept` note left in a brain is the lint error `concept-retired` (§15); `note new` refuses the type.

### reference · `knowledge/references/` · Notion: Documents (0049; References before 0.6.0)
A **Document** (0049): something the user wants to keep as a readable page and refer to from any database, or what the brain learned (`learned`, 0071). The type keeps its name `reference`, its `ref-` prefix and its folder (0045); everything the user sees calls it a Document. The §3.2 fields, plus:

| Field | Type | Req |
|---|---|---|
| `origin` | `whole`·`part`·`learned`·`promoted`·`workflow` | absent = `part` (written before 0.6.0); `note new` requires it (cli.md §5.5) |
| `promoted_from` | ID: the decision it was promoted from (`dec-`); a Document promoted from a concept before 0.9.1 keeps its `con-` id, which now names a learned Document (0071) | ✔ with `origin: promoted`; refused otherwise |
| `workflow` | `{ id: wf-…, artifact: art-… }`: the workflow and artifact the Document publishes (connected-workflows.md §6.3) | ✔ with `origin: workflow`; refused otherwise |

`sources` is required (at least one) except on a `learned`, `promoted` or `workflow` Document (a learned one keeps the concept's rule: its `sources` say where it came from, and a former concept may have none). `area` and `projects` place it.

| `origin` | Made from | Body | Lifecycle at creation | Body owner |
|---|---|---|---|---|
| `whole` | Keep as document with Only keep empty (0049) | the source's body, byte for byte (its converted text); `sources` = exactly that source | `reviewed`: it is the source's text, not the brain's claim, so it needs no Review | brain |
| `part` | Keep as document with Only keep set, or a request in chat ("also keep the budget from …") | only what Only keep named, chosen by the brain: a list or a table, every figure and date as stated | `draft`, listed in the source's `review_notes` (0045) | brain |
| `learned` | the ingest: an idea, method or definition the brain learned from an input (0071; a concept before 0.9.1) | the brain's explanation | `draft`, listed in the source's `review_notes` | brain |
| `promoted` | Promote on a decision (0049; on a concept too before 0.9.1, 0071) | seeded from the note: its summary, a blank line, then its body; `projects`, `area` and `sources` copied from it | the note's `lifecycle` when promoted | **you** |
| `workflow` | An approved artifact of a connected workflow (connected-workflows.md §6.3) | the artifact's text, or its file line and link; no `sources` | `reviewed`: the user approved it | brain; accepted wording returns from Notion as for `promoted` (cli.md §5.14.7) |

- **A brain-owned body** (`whole`, `part`, `learned`) changes only through proposals: an `update_body` (§11), usually inside the `review_notes` of the source that brought a new version (§4 source, "Versions"). It is never rebuilt from the source.
- **A promoted body is yours.** The brain writes it once, when the page is created in Notion, and never again: an `update_body` on it is refused, and later edits live in Notion, like "My notes". The file keeps the seed **until the user accepts wording in Notion** (0054): then `sync apply` replaces the body with that text exactly (cli.md §5.14.7), the only way a promoted body changes in Git, and approved `add_to_note` appendices follow it. The decision stays as it is; the two are linked both ways in Notion (§14). A Document promoted from a concept before 0.9.1 keeps its `promoted_from`, and has no From relation in Notion once Concepts is retired (0071).
- One source may give several Documents: the whole text once, and any number of parts.

### source · `sources/<notion|files|text>/YYYY-MM-DD-<slug>.md` · Notion: Inbox (every kind except `minutes`, 0037)
Immutable snapshot of input. **Its body and the fields above `summary` in the table, `summary` and `digest` are never edited after creation** (lint error if `content_hash` no longer matches the body). Only the system fields change later: `notion`, `notion_published`, `last_synced` and `tasks`, written by `sync record` (cli.md §5.14.6). (`notion_text`, `notion_parts` and `notion_text_requested` were written by `source full-text` until 0.6.0, 0049.) The folder follows the key: `notion:` → `sources/notion/`, `file:` → `sources/files/`, `url:` and `agent:` → `sources/text/` (0032).
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
| `extract` | `true` on a selected extract of a Notion input: the body holds only the selected paragraphs (0055, [capture-and-review.md](capture-and-review.md) §4.5) | |
| `extract_of` | the Notion page id of the full input; the full text stays in Notion | ✔ with `extract` |
| `extract_version` | integer ≥ 1; a new version `replaces` the one before | ✔ with `extract` |
| `transcript_hash` | sha256 hex (64) of the normalized transcript paragraphs | ✔ with `extract` |
| `selection` | list of `{id, effective, explicit}` for every subject and item; `effective` and `explicit` are `use` or `meeting only`, `explicit` also `null` | ✔ with `extract` |
| `passages` | list of `{n, hash, items}` for each paragraph in the body: its number, an 8-hex check hash and the item ids that cite it | ✔ with `extract` |
| `replaces` | the `src-` id of the earlier version of this input: a corrected meeting or Inbox row read again, or a new version of a document (0045) | must name an existing source that no other source replaces |
| `only_keep` | string: what the user asked to keep as a Document when only part ("the requirements table and the deadlines"), from the Inbox row's Only keep, the drop folder's question or the user's words (0049). Absent = the whole input, when a Document is asked for at all | only on a `document`, `email`, `chat` or `note` source, attached files included (an attached file takes its row's Only keep) |
| `keep` | the same, written before 0.6.0 (0045); read as `only_keep`. Never written again | as `only_keep` |
| `area`, `projects` | the Area and Project(s) the user set on the Inbox row or meeting when it was taken in (0050); a Review row's area comes from them (§14) | |
| `summary` | string, aim for ≤200 chars: one line on what the source taught, written at creation; the Inbox Summary | |
| `digest` | Markdown, written at creation by the ingest skill: the key points by section and the figures and dates as stated (0043). The Inbox row body (cli.md §5.14.4) | |
| `notion_text` | `digest` or `full`. Whether the Inbox row also shows the source's text (0043). **Retired in 0.6.0 (0049):** kept on sources written before, never written again; Keep as document replaces it | |
| `notion_parts` | non-empty list of part ranges, each `"<n>"` or `"<n>-<m>"` (1-based, inclusive, `n < m`), ascending and not overlapping; absent = all parts. Only with `notion_text: full`. Parts are defined below | |
| `notion_text_requested` | timestamp of the last request for the text (system; retired with `notion_text`) | |
| `notion` | the Inbox row's page id (system). For a `capture`, the id in its `notion:` key | |
| `notion_published`, `last_synced` | as §3.2 (system) | |
| `tasks` | list of Notion task page ids created from the source's owner action items (system, cli.md §5.14.5) | |
| `task_items` | on an extract: map `{<item id>: <Notion task page id>}`, the Task each item authorized (system, written by `sync record`, capture-and-review §4.8) | |

**Kinds (0032):** `minutes` is a meeting (Notion or a minutes file); `document` a converted file or a web page fetched by URL (0036); `email` and `chat` pasted threads; `note` text the user wrote or pasted; `capture` an Inbox row the user created: its `source_key` must be `notion:<row page id>` (the JSON Schema enforces it), and its `notion`, once recorded, is that same id. The body is the text verbatim, as the ingest skill defines it per kind; for a file, the converter's output.

**Versions (0045).** Fixing an input and setting it back to Reviewed (a meeting) or Ready (an Inbox row) makes the next ingest read it again. It writes a **new** source with `replaces` = the version it read before. The earlier version stays as it was (sources are immutable, 0032). A new version of a document (v2 of a requirements file) is linked the same way when the user or the ingest says so; its `only_keep`, when the user gave none, is the earlier version's, and it proposes the changed lines to each brain-owned Document of the earlier version (0049). `brain source diff` (cli.md §5.19) gives the lines that changed, and the ingest proposes only what changed. A meeting's `source` keeps naming the first version; the latest is found by following `replaces` forward. A capture read again keeps its Inbox row: the row's Brain ID moves to the new source, and the replaced one keeps its `notion` (the same page).

**Linked repos and attachments (0042):** a file from a linked repo is a `file:` source keyed by the hash of its bytes at `commit`, with `kind: document`; its `file_name` is the last segment of `repo_path`. A file attached in Notion is a `file:` source with `attached_to`; it has no Inbox row of its own (cli.md §5.14.4). `digest`, `notion_text` and `notion_parts` are refused on a `minutes` or `capture` source and on one with `attached_to`, which have no brain-written Inbox body. An attached file is still read whole into its own source, and Keep as document on its row makes a Document from that file's text, not from the capture's (0049).

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

**Reports (0043, 0045)** are the one view the CLI doesn't build: the brain-query skill writes the body, and `brain report new` (cli.md §5.18) stores it. A report is **living**: one report per subject, rewritten in place when the user asks for a refresh (`report new` with `refresh`), with a new `generated_at` (its "as of"). Git keeps every earlier version. It is never rebuilt by `brain views`, never edited otherwise, and never cited as a source, so the brain doesn't learn from its own summaries. Its body is the sections of §16.4. It is published as a **Documents** row with Origin = Report (0.9.1, decision 0071; an Inbox row with Kind = Report before), and it stays a view: never a source, never a proposal target (0057), never reviewed. It has no Lifecycle and goes out whatever the lifecycle of the notes it cites (their lines say *(not reviewed)*). The Ask rows it answers stay in the Inbox and link to it (§14).

### memory · `memories/YYYY/MM/` · never published (0008, 0009; loop is v2)
| Field | Type | Req |
|---|---|---|
| `scope` | `general`·`area`·`project`·`stack` | ✔ |
| `areas` / `projects` / `stacks` | lists | exactly the list matching `scope`, non-empty; the other two must be absent |
| `confidence` | `verified`·`inferred`·`unverified` | ✔ |
| `origin` | string (repo identity from `.brain`) | ✔ |
- **Reach is exclusive** (0009): `general` → none of `areas`, `projects`, `stacks`; `area` → only `areas`; `project` → only `projects`; `stack` → only `stacks`. A memory that should reach two levels is two memories.
- Supersession via `relations` (`supersedes` / `superseded_by`, both persisted).
- **Eligibility for recall** (0074, [memory.md](memory.md) §2): `reviewed`, not superseded, in the caller's reach, and not left out by the restricted-evidence rule. A `draft` memory is a candidate the user hasn't approved. Approval never changes `confidence`.

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
| `source` | ID or source key | ✔ | evidence; `notion-edit` for your corrections in Notion (0023); `user-correction:<prp id>` for a value you edited in a Review item before accepting it (0055, capture-and-review §7.7) |
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
Only sync writes `notion_fields`. The CLI never pushes these values to Notion: `sync render` never sends them, and no command calls Notion.

**Ultimate Assistant (0064, 0072, [assistant.md](assistant.md) §6).** A task's Status, Due, Project and Area, a project's Status and Archived, and an Area's Archived are still yours, and the assistant reads them live without storing them. It changes one only through the Notion MCP, by the skill, in two cases: after your yes to that change in a live chat, or after you approve its `notion_change` Review row (§11). Either way a `notion_change` proposal records the change first, and `brain apply` hands the skill the exact write. The next `sync` pulls the new value into `notion_fields` as usual.

---

## 8. Lifecycle and assessment (0005)

- **lifecycle** (every **knowledge** note; not `source`, `view` or `proposal`, which have their own states: immutable, regenerated, `status`; decision 0025): `draft` → `reviewed` | `disputed` → `archived`. Agents set `draft` (creation) and `archived` (supersession). They also set `reviewed`, or `archived` with no successor, when, and only when, they apply a `review_notes` proposal you decided (0041, §11.2). You set the rest in Notion. A decision, question, concept or reference gets its Notion page only once it is `reviewed` or `disputed`; a draft lives only in its Review row (0071, cli §5.14.4).
- **Types you create (0070):** a `domain`, `area`, `goal`, `project` or `org` note is `reviewed` from creation (a Notion row, or `note new` after your yes), and its Notion database has no Lifecycle property: you close one with Archived. When the brain retires one (merge, supersession) it becomes `archived`, and the next publish ticks its Archived once (cli.md §5.14.4). People keep Lifecycle: ingest writes them from meetings for you to confirm.
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
| `kind` | `update_fact`·`add_to_note`·`update_body`·`add_link`·`supersede`·`contradiction`·`merge`·`new_item`·`review_notes`·`answer`·`notion_change`·`set_field` | ✔ | `new_item`: a new note the agent is unsure about (e.g. possible duplicate person). `add_link`: add values to list fields of one note (0028); one proposal groups the routine links of one ingest for that note (0037). `review_notes`: one per ingest, everything that source proposes except judgment calls: the new notes, the routine links, and the fact, text and reference changes (0041, 0043, 0045). `update_body`: a new body for a brain-owned `reference` note, a Document (0045, 0049). `answer`: an answer to an open question (0041). `notion_change`: a change to a Notion-owned property, carried out by the skill (§7, 0072). `set_field`: a change to a brain-owned placement field, a project's `area` or an Area's `domain` (0072) |
| `target` | ID | ✔ (except `new_item`, `review_notes` and a `notion_change` on `tasks`) | see per-kind rules below; for `answer`, a question; for `notion_change`, the project or Area of the page (none for a task, which has no note) |
| `field` | string | for `update_fact`, `contradiction`, `set_field`; `add_link` written before 0.3.0 | fact key; for an old single `add_link`, the list field; for `set_field`, `area` (a project) or `domain` (an Area) |
| `links` | list of `{field, value}`, at least one; on `review_notes` a list of `{target, field, value}`, possibly empty | for `add_link` written from 0.3.0 on; for `review_notes` | the values to add (0037). `field` is the list field: `aliases`, `tags`, `projects`, `people`, `attendees` or `deciders`, declared by the target's type; `value` is a note id with the field's prefix (`prj-`, `per-`) for reference fields, else a non-empty string. Pairs (triples on `review_notes`) are unique. A proposal with `field` and `after` (before 0.3.0) is read as `links: [{field, value: after}]` |
| `notes` | list of knowledge note IDs, unique | for `review_notes` (with `links` and `changes`, at least one entry in all) | the new notes of the ingest, in the order the ingest wrote them |
| `changes` | list of change objects | optional, `review_notes` only (0045) | the `update_fact`, `update_body` and `add_to_note` items of the same ingest, each `{kind, target, why?, …}` with that kind's own fields (`field`, `before`, `after`, `from` · `content`, `before_hash` · `content`). Stored in render order: every `update_fact`, then every `update_body`, then every `add_to_note`, each group in input order (§11.3) |
| `before_hash` | `sha256:<64 hex>` | for `update_body` | the target's body hash when the proposal was written (the source hash rule of §4); the stale check |
| `deferred_from` | ID (`prp-`) | | a `review_notes` holding the items the user left out of an approved one ("all except e"): that proposal's id (0045, §11.3) |
| `dropped` | list of `{change: <index>, reason: stale}` | system, set by apply | the changes of an applied `review_notes` that were not applied because their target changed first (§11.3) |
| `items` | list of `{item_id, kind: note·link·change, ref}` | `review_notes` written from 0.8.0 on | the independently decidable items in the order the Review row lists them (changes, notes, links, §11.3), one immutable `it-` id each (capture-and-review §7.2). `ref` is the note id, or the index into `links` or `changes`. Absent on a proposal written before 0.8.0, which keeps its 0045 behavior (§7.9) |
| `revisions` | list of `{item_id, instruction, requested_at, status: requested·drafted, previous?, drafted_at?}` | `review_notes`, system | the Request revision of an item (capture-and-review §7.8, cli §5.27): the user's instruction, then the new draft with the user's earlier wording in `previous` |
| `cleanup` | `{input, version?, tasks?}` | the exclusion cleanup row | marks a `review_notes` as the cleanup row of the input (capture-and-review §5.2); its `items` are `remove`, `restore` (with `n`) and `independence`, each `ref` a note id (cli §5.26) |
| `item_decisions` | list of `{item_id, decision: accept·reject·defer, decided_at, decided_by, proposed_hash?, base_hash?, snapshot_hash?, state?}` | `review_notes`, system | decided items, one per item, written in the same commit as their write set (capture-and-review §7.6). Lint rejects them on a proposal without `items`. A deferred item keeps its `item_id` in the proposal it moves to (`ref` re-indexed); its entry has `state: deferred` and `deferred_to`. An accepted item whose wording the user edited has `edited: true`. An Accept on an item that rests only on excluded evidence is recorded as `decision: reject`, `state: closed`, `reason: source_excluded` (capture-and-review §5.1) |
| `answer` | string | for `answer` | the answer in a sentence |
| `answer_note` | ID | | for `answer`: the note that holds the answer, usually a decision the same ingest created |
| `before` / `after` | string, number or date | `after` for `update_fact` (and an old single `add_link`) and `set_field`; both for `contradiction` | `before` = current value at proposal time (absent if the fact is new, or, on `set_field`, if the field is unset); on `set_field` both are note ids |
| `database` | `tasks`·`projects`·`areas` | for `notion_change` | the Notion database of `page` |
| `page` | Notion page id (dashed, lowercase) | for `notion_change` | the row the change is for |
| `page_title` | string | for `notion_change` | the row's Name when the change was proposed (a task has no note to take a title from) |
| `property` | `status`·`due`·`project`·`area`·`archived` | for `notion_change` | `tasks`: `status`, `due`, `project`, `area`; `projects`: `status`, `archived`; `areas`: `archived`. The Notion property name comes from the Tasks mapping (§12) or is Status or Archived |
| `value_before` / `value_after` | per `property`: `status` a string or null, `due` a `YYYY-MM-DD` date or null, `project` and `area` a sorted list of page ids, `archived` a boolean | both for `notion_change` | the value read when proposed, and the value to write; `value_after` is never null on `status` |
| `area` | ID (`area-`) | | on `notion_change` and `set_field`: the Area whose home shows the Review row (§14) |
| `finding` | `<signal>:<subject key>` | | the Ultimate Assistant finding the proposal comes from ([assistant.md](assistant.md) §3.3). An Ultimate Assistant proposal (`source` `agent:ultimate-assistant/…`) decided in chat before it had a Review row never gets one (cli.md §5.14.4) |
| `fingerprint` | `<finding kind>:<ids or term>[:<field or source>]` | with `evidence` | the reflection finding the proposal records, so the brain remembers the user's answer (§11.4, 0052, 0076). Never with `finding` |
| `evidence` | list of `mtg-` and `src-` ids, sorted, unique | with `fingerprint` | the inputs the finding rested on when the user answered it (§11.4); `[]` for a duplicate or a contradiction between two notes, which rest on notes |
| `from` | date or month | for `update_fact`, `contradiction` | event time of the new value; defaults to the source meeting's `date`, else `created` |
| `content` | string | for `add_to_note`, `update_body` | `add_to_note`: Markdown to append. `update_body`: the whole new body |
| `note` | object | for `new_item` | one `brain note new` input item without `id`: `{type, title, frontmatter, body, file_date?}` ([cli.md](cli.md) §5.5) |
| `supersedes` | ID | for `supersede` | the older note |
| `merge_into` | ID | for `merge` | survivor |
| `why` | string | ✔ | the source sentence that triggered it |
| `source` | ID or source key | ✔ | |
| `status` | `pending`·`approved`·`rejected`·`edited`·`applied`·`closed` | ✔ | |
| `decision` | `{action: approve·reject·fix·edit, value?, note?, fixes?, exclude?, decided_at, decided_by: notion·chat}` | when decided | `note`: the Review row's What to fix (Note before 0.5.0), kept as written. `fixes`: on `fix`, the corrected values the skill read from `note` (§11.3). `edit` with `value` is the form before 0.5.0, still read. `exclude`: only on an approved or fixed `add_link` or `review_notes` ("all except X"): on `add_link`, a list of `{field, value}` from its `links`; on `review_notes`, a list of `{note: <id>}` from its `notes`, `{target, field, value}` from its `links` and `{change: <index>}` from its `changes` |
| `closed_reason` | `stale` | only with `status: closed` and a non-reject decision | the target changed before apply (§11.1), or the proposal rests only on excluded evidence (cli.md §5.7, "Excluded evidence") |
| `notion` | Review row page id | | |

**From 0.13.0 (0077):** every proposed change names the passages it rests on, checked when it is created and before it is applied; a proposal without them is legacy ([eligibility.md](eligibility.md) §9; CC-179 adds the field here).

### 11.1 Status and decision (normative)

| `status` | `decision` | Meaning |
|---|---|---|
| `pending` | absent | waiting for you |
| `approved` | `action: approve` | decided, not yet applied (a `notion_change`: waiting for the skill's Notion write, cli.md §5.7) |
| `edited` | `action: fix` + `fixes`, or `action: edit` + `value` (before 0.5.0) | decided with your corrections, not yet applied |
| `rejected` | `action: reject` | decided, not yet closed |
| `applied` | `approve`, `fix` or `edit` | applied to the target; terminal |
| `closed` | `reject` | rejected and closed; terminal |
| `closed` + `closed_reason: stale` | `approve`, `fix` or `edit` | the target's value changed after the proposal was written, so it was not applied; or its only evidence was excluded by the user before apply (cli.md §5.7); terminal. A new proposal may be written against the current value |

`brain apply` moves `approved`/`edited` → `applied` and `rejected` → `closed`. Applying a proposal already in a terminal state is a **no-op** (exit 0, reported as skipped). `fix` is allowed on every kind (0045; §11.3 gives the `fixes` each kind takes). `edit` stays allowed only for `update_fact`, `contradiction`, `add_to_note`, `update_body` and `answer`; an `edit` on any other kind is an error (exit non-zero, proposal left unchanged).

### 11.2 How each kind is applied (normative)

Let **D** = `decision.decided_at` (date part), **V** = `decision.value` for `edit`, else the proposal's own value. Every note changed below also gets `updated` = today ([cli.md](cli.md) §3.6.6).

| Kind | `target` is | On approve / edit | On reject |
|---|---|---|---|
| `update_fact` | the note owning the fact | In `timeline`, each entry for `field` with `assessment: accepted` gets `until: <from>` and `assessment: superseded`. Append `{field, value: V(after), from, learned: D, source, assessment: accepted}`. Set `facts.<field> = V` | nothing changes |
| `contradiction` | the note owning the fact | **approve:** keep both claims. Existing accepted entries for `field` become `contested`; append `{field, value: after, from, learned: D, source, assessment: contested}`; remove `facts.<field>`. **edit:** V is the accepted truth. Only entries for `field` whose assessment is `accepted` or `contested` change: if one or more of them has value V, the latest of those (by `learned`, then position) becomes `accepted`; every other one becomes `superseded` with `until: <from>`. If none has value V, every one of them becomes `superseded` with `until: <from>`, and `{field, value: V, from, learned: D, source, assessment: accepted}` is appended, where `source` is the proposal's own when V is its `after` (the value that source claims: choosing a claim is not a correction), and `user-correction:<this proposal's id>` for any other value, which is the user's, not the source's (0076 §1 as clarified by CC-160; as for an edited Review item, capture-and-review §7.7). Already-superseded entries are left as they are. Set `facts.<field> = V` | nothing changes |
| `add_link` | the note whose lists grow | For each entry of `links` not in `decision.exclude`, in order: append `value` to `target.<field>` if it is not already there (0028). No edit. Excluding every entry applies nothing to the target; the proposal is still `applied` | nothing changes |
| `add_to_note` | the note to extend | Append V(content) to the end of the body, separated by exactly one blank line, followed by a line `Source: <source>`. Add `source` to `sources` if missing | nothing changes |
| `update_body` | a `reference` note whose `origin` isn't `promoted` (0045, 0049) | Replace the body with V(content). Add `source` to `sources` if missing. **Stale** when the target's body hash differs from `before_hash` (§11.1, closed with `closed_reason: stale`) | nothing changes |
| `supersede` | the **newer** note (already written as `draft` by the ingest, 0003) | `target.relations` += `{supersedes: <supersedes>}`; `<supersedes>.relations` += `{superseded_by: target}`; older note `lifecycle: archived`; if both are decisions, older gets `assessment: superseded` and `valid_until: <target.valid_from or target.date>` | the newer note stays, without the relation |
| `merge` | the **duplicate** X to retire, merged into the survivor Y = `merge_into` | Steps, in order: **1. References.** In every note except X, Y, sources, proposals and views (proposals are a record of what was decided about X; views are generated, so `brain views` rebuilds them from their sources, and the duplicate's own Brief and Decision log stay with the archived duplicate, naming it, CC-148), rewrite frontmatter references to X's id into Y's id (then dedupe each list, keeping the first occurrence) and relative links to X's file into links to Y's file. **Persisted pairs are left alone**: a meeting's `decisions`/`questions` entries, a decision's `decided_in`, a question's `raised_in`, and other notes' `supersedes`/`superseded_by` relations keep pointing at X, whose side of those pairs stays in place (X is archived, not deleted). **2. Into Y:** union `aliases` (plus X's `title`), `tags`, `sources`, `projects`; add X's `relations` except `supersedes`/`superseded_by` and any whose target is X or Y (dedupe); append X's `timeline` entries (dedupe exact entries); a `facts` key only X has is copied to Y; for a key both have, Y's value stays and X's `accepted` entries with a different value become `superseded` with `until: <today>`; append X's body under `## Merged from <X title>`. **3. Pair:** X gets `lifecycle: archived` and `relations` += `{superseded_by: Y}`; Y gets `{supersedes: X}`. If X is a decision, it also gets `assessment: superseded` and `valid_until` = Y's `valid_from` or `date` | nothing changes |
| `new_item` | — | Write `note` as a new note with the `brain note new` rules, lifecycle `reviewed`: approving the row is the review, so it gets its Notion page (0071; `draft` before 0.9.1). If it has `decided_in` or `raised_in`, add its id to that meeting's `decisions` or `questions` | discard |
| `review_notes` | — (the notes, link targets and change targets it lists) | In this order: every entry of `changes` not excluded is applied with its kind's rule above, or dropped when stale (§11.3); every listed note not excluded and still `draft` gets `lifecycle: reviewed`; every entry of `links` not excluded is applied to its `target` as an `add_link` entry (append if not already there). A listed note that is no longer `draft` is left as it is and reported (cli.md §5.7). Excluded items are **deferred** to a new pending `review_notes` (§11.3); an excluded note stays `draft`. `fix` corrects items first (§11.3) | Every listed note still `draft` gets `lifecycle: archived`, with no successor; nothing is deleted. No link or change is applied |
| `notion_change` | — (a Notion row; `target` names its note when it has one) | Nothing in Git: apply records the decision and returns the write (`notion_writes`, cli.md §5.7); the proposal stays `approved` or `edited` until the skill reports the write with `proposal settle`: `applied` when Notion now holds `value_after` (or the fix's value), `closed` with `closed_reason: stale` when Notion held neither `value_before` nor that value. The next `sync` pulls the value into `notion_fields` | closed; nothing is written |
| `set_field` | the project (`area`) or Area (`domain`) | `target.<field>` = V(`after`). **Stale** when `target.<field>` isn't `before` (both absent counts as equal): closed with `closed_reason: stale` | nothing changes |
| `answer` | the question | The question's `answer` = `answer_note` when set, else V(`answer`). **edit:** `answer` = V (your Note, as text); `answer_note` is not used. The next publish sets the question's Notion Status to Answered (cli.md §5.14.4) | nothing changes; the question stays open |

**Merge caveats.** A still-pending proposal that targets X keeps pointing at the archived X; apply it or reject it. If X is already a superseded decision, merging overwrites its `valid_until` with Y's `valid_from` or `date`.

**Write sets.** Besides the proposal file itself, applying a proposal writes only: `update_fact`, `contradiction`, `add_to_note`, `update_body`, `add_link`, `answer`, `set_field` → the target; `notion_change` → nothing but the proposal file (its decision, then its status at `proposal settle`); `supersede` → the target and the older note; `merge` → X, Y and the notes whose references step 1 rewrites; `new_item` → the new note and its meeting; `review_notes` → every listed note whose lifecycle or fixed fields change, every link and change target that changes, and the deferred proposal when it excludes anything. All writes for one proposal happen in one operation; if any write fails, none are kept.

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
| `notion_change` | exactly one `{value}`, of `value_after`'s shape | the value written is `value` instead of `value_after` |
| `set_field` | exactly one `{value: <id>}` | `after` is `value`, a note of the field's type |
| `new_item` | one or more `{field, value}` | `field` is `title` or a key of `note.frontmatter`; set before the note is written, then validated as `note new` |
| `add_link` | one or more `{link: {field, value}, value}` | that link is applied with the new `value` |
| `review_notes` | one or more of `{change: <index>, value}`, `{note: <id>, field, value}`, `{link: {target, field, value}, value}` | a change is applied with `after` (`update_fact`) or `content` (`update_body`, `add_to_note`) = `value`; a listed note gets `field` = `value` before it is reviewed, where `field` is one a correction may set (cli.md §5.7) or `projects` (a list of `prj-` ids); a link is applied with the new `value` |

A fixed item can't also be excluded. A `fixes` entry that names no item of the proposal → `FIX_UNKNOWN`; a value of the wrong shape → `INVALID_RESULT` (cli.md §5.7). Both leave the proposal unchanged.

### 11.4 Reflection fingerprints (normative, 0052, 0076)

Every proposal brain-reflect writes carries a `fingerprint` and its `evidence` (cli.md §6.2): a yes (approved in chat, then applied), a "later" (pending, a Review row) and a skip (rejected in chat, then closed). The fingerprint names the **finding**, not the proposal: a finding answered twice has two proposals with one fingerprint, and the latest answer is the one that counts.

| Finding | `fingerprint` | Proposal kind | Parts |
|---|---|---|---|
| Contradiction | `contradiction:<target>:<field>` | `contradiction` | the proposal's `target` and `field` |
| Stale fact | `stale:<target>:<field>` | `update_fact` | the proposal's `target` and `field` |
| Duplicate | `merge:<id>+<id>` | `merge` | `target` and `merge_into`, sorted by code point, so the pair has one fingerprint whichever note survives |
| Promotion | `promotion:<target>:<source>` | `add_to_note` | the proposal's `target`, and its `source`: the meeting or source the rule was said in |
| Theme | `theme:<term>` | `review_notes` for a yes or a "later" (its one note: the draft learned Document, §4 reference); `new_item` for a skip (the Document that would have been drafted, never written) | the term's tokens (cli.md §5.32) joined by `-`: `theme:pricing-tiers` |

- **`evidence`** lists the inputs of the cluster the finding came from: every id of its `evidence` in `reflect --candidates` (cli.md §5.32), not only the ones the report showed; sorted, unique; `[]` for a duplicate and for a contradiction between two notes (`shared_ground`), which rest on notes, not inputs.
- **`source`** is what the finding rests on: the input whose words the proposal's `why` quotes (a stale fact, a contradiction or a promotion from an `overtaken` cluster); the other member, a note id, for a contradiction from a `shared_ground` cluster; the newest input of `evidence` (by date, then id) for a theme (0076 §4); `agent:brain-reflect/<session>` for a duplicate, which rests on names (the session's start, compact: `20261108T100000Z`).
- **Lint** (`proposal-fingerprint`, cli.md §5.10) checks that the fingerprint matches its proposal: the kind (also in the JSON Schema), `target` and `field`; a merge's two ids are `target` and `merge_into`, different and sorted; a promotion's source is `source`; a theme's `review_notes` lists exactly one note, a `reference` with `origin: learned`; a theme's `new_item` holds such a Document; every `evidence` id exists.

**What a fingerprint holds back.** `reflect --candidates` (cli.md §5.32) leaves out, or marks, a finding whose fingerprint is **held**:
1. **Waiting:** a proposal with the fingerprint is `pending`, `approved` or `edited` (a Review row not yet decided, or a decision not yet applied).
2. **Skipped:** otherwise, the latest of its proposals that has a `decision` (by `decision.decided_at`, then `id`) is a reject (`rejected` or `closed`), whether the user said "skip" in the chat or Reject on its Review row. A skip lasts as long as its reason (0076 §3):
   - **a duplicate** (`merge`) stays skipped: two notes the user said are different stay different;
   - **a contradiction, stale fact or promotion** is released when an input that is not in the skip's `evidence`, and whose `created` is on or after the date of its `decided_at`, names the target (cli.md §5.32, "names"). The skill proposes it again only when that input bears on the field (for a promotion, the rule); otherwise it treats the finding as still skipped and writes nothing;
   - **a theme** is released when an input not in its `evidence`, created on or after the skip's date, holds the term in its text (cli.md §5.32): the term's source count has grown.

An applied proposal, or one closed as stale, holds nothing: the change is made, or its target moved on, and the signals see the note as it is now. A finding the user didn't answer leaves no proposal and can come back in the next run.

## 12. `brain.json` · see [schemas/brain.schema.json](schemas/brain.schema.json)

```json
{
  "schema_version": 1,
  "owner": { "name": "Alex", "person": "per-3h8w2n6c" },
  "budgets": { "ingest_max_notes": 8 },
  "settings": { "publish": "ask", "push": "auto", "unattended": { "max_inputs": 10 }, "markitdown": "on", "gh": "on", "schedule": "off" },
  "modules": { "domains": false, "knowledge": true, "orgs": true, "documents": true, "reports": true, "tasks": true, "planning": true },
  "repos": [
    { "name": "acme-api", "path": "~/code/acme-api", "area": "area-2m7c4h8n",
      "patterns": ["decisions/**", "docs/vision.md", "CHANGELOG.md"], "commit": "" },
    { "name": "acme-web", "path": "~/code/acme-web", "area": "area-2m7c4h8n", "project": "prj-9x4t1b7e",
      "patterns": ["docs/**"], "never_read": [".env*"], "commit": "", "kit": { "sha256": "sha256:<64 hex>" } }
  ],
  "notion": {
    "template_version": "0024",
    "databases": { "domains": "", "areas": "", "goals": "", "key_results": "", "projects": "", "meetings": "",
                   "people": "", "orgs": "", "decisions": "", "questions": "", "review": "", "inbox": "",
                   "documents": "" },
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
- `unattended.max_inputs` (0051): how many inputs one unattended run takes in, oldest first; an integer of at least 1, default 10. The rest waits for the next run (cli.md §6.1). `unattended` absent, or `max_inputs` absent from it, means 10.
- `recall` (0074): `off` (default) or `opening`. With `opening`, `brain link` adds the recall paragraph to a linked repo's instruction block, so its agents load the opening context (cli.md §5.12, [memory.md](memory.md) §7). Setup asks once; absent means `off`.
- `markitdown`, `gh`, `schedule` (0078, from 0.14.0; [setup.md](setup.md) §7): the optional items of the guided setup, each `on` or `off`; absent means `off`. They record the user's choice so setup never asks again: `markitdown` whether the user chose to install MarkItDown (the ingest still uses it whenever it is installed, as before, so a brain without the key converts files as it did), `gh` whether setup may use the GitHub CLI (the private remote, the setup report), `schedule` whether the user chose a scheduled catch-up (the entry itself is the machine's, cli.md §5.21).

**Modules** (0048): the optional parts of the space. Core (Inbox, Meetings, Projects, Areas, People, Review) is always on and has no key.

| Key | Default | New brain (0.14.0) | Databases (`notion.databases` keys) and what else it covers |
|---|---|---|---|
| `domains` | `false` | `false`; seeding turns it on (below) | `domains` |
| `knowledge` | `true` | `true` | `decisions`, `questions` (`concepts` until 0.9.1, 0071) |
| `orgs` | `true` | `true` | `orgs` |
| `documents` | `false` | `true` | `documents` (0049) |
| `reports` | `false` | `true` | `documents`, shared with the Documents module: a report is a Documents row (0071); Ask rows on the Inbox (0043, 0045). **Needs `documents` on:** Reports counts as off while Documents is off; `brain modules` turns Documents on with Reports and Reports off with Documents (cli.md §5.20), and `brain upgrade` turns Documents on in a brain that has Reports on (cli.md §5.15) |
| `tasks` | `false` | `true` | `notion.tasks` |
| `planning` | `false` | `false` | `goals`, `key_results` |

- **`modules` absent:** every module except Domains is on; Domains is off. That is every brain made before 0.6.0; `brain upgrade` writes the block with every key `true` except Domains (cli.md §5.15). **A key absent from a present block** takes its default. **A new brain** (0078 §4, from 0.14.0) gets the block from `templates/brain/brain.json` with the "New brain" column: Knowledge, Orgs, Documents, Reports and Tasks on, Planning and Domains off; setup's seeding turns Domains on when the user's work has two or more contexts ([setup.md](setup.md) §8). The Default column is unchanged, so a brain made before 0.14.0 keeps its modules.
- **A module off** means the CLI neither reads nor writes Notion for it: `sync plan` ignores its databases' rows, `sync render` publishes none of its notes and leaves out the relations to them, `sync tasks` refuses with `MODULE_OFF`, and reports are not published (cli.md §5.14, §5.20). It is off even when its database ids are set. **Nothing is deleted:** the notes stay in Git and are still indexed, linted and listed; Notion keeps its databases and rows. Turning it on again publishes what changed meanwhile.
- **The Domains database is in every Notion space** (0065), with the module on or off; `notion.databases.domains` is set whenever it exists. Like any module, Domains off means the brain neither reads nor writes it.
- **A module on with an empty database id** behaves as today: its notes are skipped with `DATABASE_NOT_CONFIGURED`.
- Written by `brain modules` (cli.md §5.20) and `brain config`.

**Repos** (0042): the linked repos the brain reads, never writes. Each has a unique `name` (lowercase kebab-case), a `path` (absolute or starting with `~/`; the machine's own clone), the `area` its knowledge belongs to (an existing `area-` id), `patterns` (non-empty list of Git glob pathspecs, relative to the repo root, e.g. `decisions/**`), and `commit`, the last commit ingested (40 hex, or `""` before the first ingest). Written by `brain repo add` and `brain repo record` (cli.md §5.16), and `path` also by `brain repo refresh --path` (§5.29); `repos` absent means none. Three optional keys come from a link kit (0066, [linked-repos.md](linked-repos.md) §5): `never_read` (Git glob pathspecs never read, even when a pattern matches; absent means none), `project` (a `prj-` id the repo is placed under) and `kit` (`{ "sha256": "sha256:<64 hex>" }`, the kit last applied). With `kit`, `area`, `patterns`, `never_read` and `project` are copies of the kit, written only by `repo add --kit` and `repo refresh`; removed by `repo unlink` (cli.md §5.29).

**Template version** (0078, from 0.14.0): `notion.template_version` is the four-digit number of the last Notion migration the user's space includes, as a string (`"0024"`), from the Notion template's System page; absent means unknown, never guessed. `brain upgrade` names the migrations with a higher number (cli.md §5.15, [setup.md](setup.md) §9). The JSON schema gains it, and the three settings above, with CC-190.

**Databases:** `inbox` is the database formerly called Capture Inbox; a `brain.json` that still has `capture_inbox` is read as `inbox` when `inbox` is absent, and `brain upgrade` renames the key (cli.md §5.15). `documents` holds reference notes, shown as Documents (0045, 0049), learned ones included (0071), and a brain without the key publishes none (warning `DATABASE_NOT_CONFIGURED`, cli.md §5.14.4). A `brain.json` that still has `references` is read as `documents` when `documents` is absent, and `brain upgrade` renames the key (cli.md §5.15). `concepts` is retired in 0.9.1 (0071): a `brain.json` that still has it is valid, the key is never read, and `brain upgrade` removes it (cli.md §5.15 step 5).

**Tasks mapping (0018):** each value is the name of a property in your Tasks database; an empty string means "this database has no such property", and the field is skipped.
- `title` is required.
- `notion.review_sections` (0055; boolean, absent = false): Review has the Decided property, so a Review row from a source is rendered as a page with one section per change and its Proposed property is a short pointer ("3 changes: decide each one in the page"). Set by migration 0013 after it reads Decided back; a fresh setup has it. A row published before keeps its layout.
- `waiting_on_status` (0055): non-empty name of the status for a commitment someone else made and the user tracks; absent means `Waiting On`. A mapping, as `wont_do_status`: sync never reads task statuses, and Git never stores one; Ultimate Assistant reads them live and sets one only after your yes or your approved Review row (§7, [assistant.md](assistant.md)).
- `wont_do_status` (0055): non-empty name of the closed-without-doing status; absent means `Won't Do`. This is a mapping, not a status the ingest or sync writes; Ultimate Assistant may set it only after your yes (§7).
- `status_type` (#113): the Notion type of the mapped `status` property, `status` (Notion's built-in Status, as in the default Tasks database) or `select`. Absent means `select`, the type every brain made before 0.3.2 was sent, so an existing mapping to a select property keeps working; the template `brain.json` sets `status` for the default Tasks database. It isn't a property name, so it sits next to `new_task_status`, outside `properties`.
- `owner`: a person or text property for the action item's owner.
- **Backlink to the meeting** (required by 0018): `meeting` = a relation property to the Meetings database (preferred), or `meeting_url` = a URL property when your Tasks database has no relation to Meetings. Once `tasks.database` is set, `title` and at least one of the two must be non-empty (the JSON Schema enforces it).
- `source` (0037): a relation property to the Inbox, the backlink for an owner task taken from a document, email, chat, note or capture (cli.md §5.14.5). Empty → such tasks have no backlink.
- `brain_id`: a text property holding the brain's id for the task's source meeting (or source), so a re-run never duplicates tasks.

## 13. Generated files

- **`index.md`** (0013), normative format:
  1. First line `<!-- GENERATED by brain index. Do not edit. -->`, a blank line, then `# Index`.
  2. One section per type, in this order, headed `## Areas`, `## Goals`, `## Projects`, `## People`, `## Orgs`, `## Decisions`, `## Questions`, `## Meetings`, `## Documents` (0045, 0049; `## Concepts` until 0.9.1, 0071: learned Documents are listed under Documents). Each heading is preceded by one blank line; the note lines follow it directly. Sections with no notes are omitted. Sources, views, proposals and memories are not listed.
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
       | reference | `origin`, `area`, `project` (`projects`) (0045, 0049) |
     - `aliases` segment only when the list is non-empty. `<lifecycle>` segment only when lifecycle is `disputed` or `archived`.
  5. File ends with exactly one newline. Running `brain index` twice produces identical bytes.

  Example: `- [Acme website](projects/acme-website/project.md) — prj-9x4t1b7e · area: Clients · status: Active · client: Acme · Rebuild of Acme's marketing website, launching February 2027. · aliases: acme site`
- **`log/YYYY-MM.md`**: append-only. First line `<!-- GENERATED by brain. Append-only. -->`, a blank line, then one line per operation (format details in [cli.md](cli.md) §3.9):
  `- 2026-12-03T10:22:00Z ingest mtg-8c4n2p7w "Acme sync" created=4 proposals=3`

## 14. Notion property mapping

| Notion database · property | Brain field |
|---|---|
| all · Name / Summary / Lifecycle / Brain ID / Last Synced | `title` / `summary` / `lifecycle` / `id` / `last_synced`; no Lifecycle on Domains, Areas, Goals, Projects, Orgs (0070) |
| Domains · Type, Archived | `notion_fields.type`, `.archived` (0.9.0) |
| Orgs · Archived | `notion_fields.archived` (0070) |
| Areas · Archived | `notion_fields.archived` |
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
| Questions · Kind, Status, Project, Raised In | `kind`, `notion_fields.status`, `projects`, `raised_in`. Status = Open is written once while Notion has none, Answered once after an applied `answer` (0041, 0045), and Dropped once after `question drop` (0071) |
| Areas · Brief toggle | the area's `area_brief` view (§16.3, 0041) |
| Documents · Area, Project, page body | `area`, `projects`, the body (0045, 0049). A `promoted` Document's body is sent on create only: after that it is yours. On a report: its `area`, `projects` and body (0071) |
| Documents · Origin | select, brain-owned, written from the note (0071): `whole` and `part` (and a reference with no `origin`) → Kept, `learned` → Learned, `promoted` → Promoted, `workflow` → Workflow, a report view → Report. Never read back: a changed Origin is not a correction (it is not in the correctable table of cli.md §5.14.2) |
| Documents · Asked in | a report's `asked_in`: the Ask rows it answers (relation → Inbox, two-way with Inbox · Report, 0071; was Inbox · Ask, a relation within the Inbox, before 0.9.1) |
| Documents · Refresh asked, on a report | yours (a checkbox, ticked by hand): ask for a full refresh from the notes in Git; the brain clears it when it rewrites the report (0045, 0048). On the Inbox before 0.9.1 (0071), and called Refresh before migration 0010; `sync plan` still reads `Refresh` |
| Documents · What to fix, on a report | yours: what the report gets wrong; the brain records it in the report's `fixes`, turns it into proposals and clears it (0045; on the Inbox before 0.9.1) |
| Documents · Accepted, Accepted at | yours (0054): the **Accept** button (0071; *Accept write-up* on a Document and *Accept refresh* on a Report row before 0.9.1), on a Document after a write-up or on a report after its proposed refresh sets Accepted and Accepted at. Never compared or corrected; read only by `sync plan`'s accepted-wording rules (cli.md §5.14.7); the skill unticks Accepted and clears Accepted at after the wording is imported. The page body of a `promoted` Document or of a report stays Notion's until accepted wording is imported exactly; after that `notion_published` holds `@notion_body` (the Markdown read back from the page at the last sync) and `@git_body` (the Git body then), the baselines of cli.md §5.14.7; `@content` stays render's own bookkeeping (what it would send) |
| Documents · From decision | a `promoted` Document's `promoted_from` when it names a decision (two-way with Decisions · Documents, which Notion fills, 0049). From concept is retired with Concepts in 0.9.1 (0071) |
| Decisions · Promote asked | yours (a checkbox, ticked by the Promote to document button): ask for a promoted Document. The brain clears it once it has acted (0048, 0049) |
| Decisions, Questions, Documents, People · Sources | inverse of the Inbox relations below (Notion fills it) |
| Inbox · Name | the source's `title` (on rows the brain creates; a capture's Name is yours) |
| Inbox · Kind, Summary | source `kind` (`Capture`, `File` for `document` (Document before 0.6.0), `Email`, `Chat`, `Note`), written only when Kind is empty in Notion, so a Kind you chose stands (0048); source `summary`; `Ask` is yours (0043); `Catch-up` on the run summary an unattended catch-up writes (no note, cli.md §6.1). `Report` is retired in 0.9.1: reports are Documents (0071) |
| Inbox · page body | a brain-created row's digest (0043). Never a capture's or an Ask row's (a report's body is on its Documents row since 0.9.1, 0071). ("Full text" toggles written before 0.6.0 stay as they are; no new one is written, 0049) |
| Inbox · Report | on an Ask row, the reports that answer it: the other side of Documents · Asked in, which Notion fills (0071) |
| Inbox · Document asked | yours (a checkbox, ticked by the Keep as document button, which also sets Brain Status to Ready): keep the input as a Document. The brain clears it once it has acted (0048, 0049) |
| Inbox · Only keep | yours: when only part should be kept ("the requirements table and the deadlines"); the ingest stores it as the source's `only_keep`. Empty = the whole input (0049; was Keep, 0045) |
| Inbox · Refresh asked, What to fix, on a Report row | retired in 0.9.1: reports are Documents rows, and these two are Documents properties (above, 0071). Migration 0019 moves the Report rows; the old properties stay unused for you to delete |
| Inbox · Decisions, Questions, Documents, People | derived: the published notes of those types whose `sources` lists the source's id (Documents was References before 0.6.0; learned Documents are in Documents, and Inbox · Concepts is retired in 0.9.1, 0071) |
| Inbox · Project, Area | yours; the brain fills them only when empty, from the produced notes' `projects` and `area` |
| Inbox · Brain Status | `New` → `Ready` → `Done` (0048). `New` and `Ready` are yours; the brain sets `Done` when it publishes the row, and on a row it skipped, whose Summary then says why ("Skipped: same as <title>"). A catch-up takes in only `Ready` rows. Read before 0.6.0: `Processed` = `Done`; `Skipped` is retired (migration 0010 moves those rows to `Done`) |
| Review · all | proposal fields (§11): Name=`title`, Kind (`Review Notes` and `Answer` from 0.4.0, `Update Body` from 0.5.0, `Notion Change` and `Set Field` from 0.10.0), About=`target` title + id (Target before 0.5.0), About Page (Target Page), Now (Before), Proposed (After), Why, Source Meeting=`source`, Your call/What to fix → `decision` (Decision/Note before 0.5.0; cli.md §5.14.2), State from `status`, Area (one page, 0050) = the area of the proposal's `source`: the source's or meeting's own `area`, else the `area` of its first project in `projects`, else none (a `source` that isn't a note id has none). Type, a Notion formula on Kind (From source, Conflict, Answer, and from 0.10.0 Suggestion for Notion Change and Set Field, 0072), is Notion's own (0048). A `notion_change` or `set_field` row's Area is the proposal's `area`, its Name starts `Suggestion: `, and its About, Now and Proposed follow cli.md §5.14.4. Now, Proposed and Why are plain text: each Markdown link becomes its link text (links in proposal text are relative to the target note's folder) |

## 15. Lint rules derived from this spec

Errors: `.md` file in a note folder without frontmatter `id`; unparseable frontmatter; invalid frontmatter vs schema; missing required field; malformed or duplicate ID; type in wrong folder; frontmatter reference to a missing ID; broken relative link; `[[wikilink]]` present; unknown `^[...]` marker; source body hash mismatch (§4 source); a view cited as a source; `facts` key without a matching accepted timeline entry (unless contested); one side of a `supersedes`/`superseded_by` pair missing (§6); `decided_in`/`raised_in` disagreeing with the meeting's lists; superseded decision without `valid_until`; superseded decision without a `superseded_by` relation (0005); decision without `sources` (0005); memory reach lists not matching `scope`; proposal `status` and `decision` not matching §11.1; a product-owned file (shipped skill file, AGENTS.md rules block) differing from the installed package (0038); a source's `notion_parts` naming a part above its body's part count (§4 source); a `review_notes` listing a note that isn't a knowledge note, or a note listed by two `review_notes` proposals, unless one excluded it and the other has `deferred_from` = that one (0041, 0045); a source's `replaces` naming no source, or a source replaced by two others (0045); a `reference` with no `sources` unless `learned`, `promoted` or `workflow`, or an `update_body` whose target isn't a `reference` or is a `promoted` one (0045, 0049); `promoted_from` naming a note that isn't a decision or a learned Document with a `con-` id (a former concept), or set without `origin: promoted` (0049, 0071); a `type: concept` note (`concept-retired`: run `brain upgrade`, 0071); `_assistant/dismissals.json` unreadable, invalid, or with a repeated key (`assistant-dismissals`, 0072).
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
