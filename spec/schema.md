# Brain Schema Specification (v1)

**Schema version:** `1`
**Status:** Draft for review (task CC-01)
**Machine-readable:** [schemas/note.schema.json](schemas/note.schema.json), [schemas/proposal.schema.json](schemas/proposal.schema.json), [schemas/brain.schema.json](schemas/brain.schema.json)
**Examples:** [examples/valid/](examples/valid/), [examples/invalid/](examples/invalid/). Every valid example passes the JSON Schemas and every invalid one fails (checked with Ajv, draft 2020-12); CX-05 should keep this as a test.

This is the contract for every file in a user's brain repo. The CLI (`src/`) validates against it, and the skills write to it. When this document and the JSON Schemas disagree, the JSON Schemas win and this document is fixed.

Decisions referenced: 0001–0005, 0008–0011, 0013, 0017, 0018, 0020, 0021, 0023.

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
| Source keys | External: `notion:<page-id>`, `url:<https-url>`, `agent:<agent>/<session-id>`. Internal: a note ID |

### ID prefixes

| Prefix | Type | | Prefix | Type |
|---|---|---|---|---|
| `area` | area | | `dec` | decision |
| `gol` | goal | | `que` | question |
| `prj` | project | | `con` | concept |
| `per` | person | | `src` | source |
| `org` | org | | `mem` | memory |
| `mtg` | meeting | | `prp` | proposal |
| `vw` | view | | | |

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
│   └── concepts/<slug>.md       type: concept
├── sources/notion/YYYY-MM-DD-<slug>.md  type: source (immutable)
├── memories/YYYY/MM/YYYY-MM-DD-<slug>.md type: memory (v2 loop)
└── _proposals/YYYY-MM-DD-<slug>.md      type: proposal
```

Each type must live in its folder (lint error otherwise). `archive/` may hold `project` and `view` (inside project folders) and `goal`.

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
| `notion_published` | map | | system | Notion property name → value the brain last published or imported, in the normalized form of [cli.md](cli.md) §5.14.1, plus `@content` (hash of the published page content). Baseline for the three-way comparison of cli.md §5.14 |

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
| `answer` | string or ID | | brain |
- `notion_fields`: `status` (`Open`·`Answered`·`Dropped`).

### concept · `knowledge/concepts/` · not published in v1
Ideas, methods, definitions.

### source · `sources/notion/YYYY-MM-DD-<slug>.md` · not published
Immutable snapshot of input. **Never edited after creation** (lint error if `content_hash` no longer matches the body).
| Field | Type | Req |
|---|---|---|
| `source_key` | source key | ✔ |
| `content_hash` | `sha256:<64 hex>` of the body, defined below | ✔ |
| `captured` | timestamp | ✔ |
| `origin_edited` | timestamp (Notion `last_edited_time`) | |

**Hash input (normative):** the body is every byte after the newline that ends the closing `---` frontmatter line, up to the end of the file, **including** the final trailing newline. No normalization is applied (files are LF and UTF-8 by §1, so writers write exactly the bytes they hashed). Hash = lowercase hex SHA-256 of those UTF-8 bytes, prefixed `sha256:`. Example: for a file `---\n<frontmatter>\n---\n## Attendees\n…\n`, the hash covers `## Attendees\n…\n`.

### view · inside `projects/<slug>/` · rendered into the Notion project page
Generated; never evidence (lint error if any note's `sources` cites a view).
| Field | Type | Req |
|---|---|---|
| `view_kind` | `brief`·`decision_log` | ✔ |
| `project` | ID | ✔ |
| `generated_from` | list of IDs | ✔ |
| `generated_at` | timestamp | ✔ |
Body: `<!-- @generated:start -->` … `<!-- @generated:end -->`, then optional `<!-- @user:start -->` … `<!-- @user:end -->`. Tools replace only the generated block. The content of each view kind is fixed in §16.

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

- **lifecycle** (every **knowledge** note; not `source`, `view` or `proposal`, which have their own states: immutable, regenerated, `status`; decision 0025): `draft` → `reviewed` | `disputed` → `archived`. Agents only set `draft` (creation) and `archived` (supersession). You set the rest in Notion.
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
| `kind` | `update_fact`·`add_to_note`·`supersede`·`contradiction`·`merge`·`new_item` | ✔ | `new_item`: a new note the agent is unsure about (e.g. possible duplicate person) |
| `target` | ID | ✔ (except `new_item`) | see per-kind rules below |
| `field` | string | for `update_fact`, `contradiction` | fact key |
| `before` / `after` | string, number or date | `after` for `update_fact`; both for `contradiction` | `before` = current value at proposal time (absent if the fact is new) |
| `from` | date or month | for `update_fact`, `contradiction` | event time of the new value; defaults to the source meeting's `date`, else `created` |
| `content` | string | for `add_to_note` | Markdown to append |
| `note` | object | for `new_item` | one `brain note new` input item without `id`: `{type, title, frontmatter, body, file_date?}` ([cli.md](cli.md) §5.5) |
| `supersedes` | ID | for `supersede` | the older note |
| `merge_into` | ID | for `merge` | survivor |
| `why` | string | ✔ | the source sentence that triggered it |
| `source` | ID or source key | ✔ | |
| `status` | `pending`·`approved`·`rejected`·`edited`·`applied`·`closed` | ✔ | |
| `decision` | `{action: approve·reject·edit, value?, decided_at, decided_by: notion·chat}` | when decided | |
| `closed_reason` | `stale` | only with `status: closed` and a non-reject decision | the target changed before apply (§11.1) |
| `notion` | Review row page id | | |

### 11.1 Status and decision (normative)

| `status` | `decision` | Meaning |
|---|---|---|
| `pending` | absent | waiting for you |
| `approved` | `action: approve` | decided, not yet applied |
| `edited` | `action: edit` + `value` | decided with your value, not yet applied |
| `rejected` | `action: reject` | decided, not yet closed |
| `applied` | `approve` or `edit` | applied to the target; terminal |
| `closed` | `reject` | rejected and closed; terminal |
| `closed` + `closed_reason: stale` | `approve` or `edit` | the target's value changed after the proposal was written, so it was not applied; terminal. A new proposal may be written against the current value |

`brain apply` moves `approved`/`edited` → `applied` and `rejected` → `closed`. Applying a proposal already in a terminal state is a **no-op** (exit 0, reported as skipped). `edit` is allowed only for `update_fact`, `contradiction` and `add_to_note`; an `edit` on any other kind is an error (exit non-zero, proposal left unchanged).

### 11.2 How each kind is applied (normative)

Let **D** = `decision.decided_at` (date part), **V** = `decision.value` for `edit`, else the proposal's own value. Every note changed below also gets `updated` = today ([cli.md](cli.md) §3.6.6).

| Kind | `target` is | On approve / edit | On reject |
|---|---|---|---|
| `update_fact` | the note owning the fact | In `timeline`, each entry for `field` with `assessment: accepted` gets `until: <from>` and `assessment: superseded`. Append `{field, value: V(after), from, learned: D, source, assessment: accepted}`. Set `facts.<field> = V` | nothing changes |
| `contradiction` | the note owning the fact | **approve:** keep both claims. Existing accepted entries for `field` become `contested`; append `{field, value: after, from, learned: D, source, assessment: contested}`; remove `facts.<field>`. **edit:** V is the accepted truth. Only entries for `field` whose assessment is `accepted` or `contested` change: if one or more of them has value V, the latest of those (by `learned`, then position) becomes `accepted`; every other one becomes `superseded` with `until: <from>`. If none has value V, every one of them becomes `superseded` with `until: <from>`, and `{field, value: V, from, learned: D, source, assessment: accepted}` is appended. Already-superseded entries are left as they are. Set `facts.<field> = V` | nothing changes |
| `add_to_note` | the note to extend | Append V(content) to the end of the body, separated by exactly one blank line, followed by a line `Source: <source>`. Add `source` to `sources` if missing | nothing changes |
| `supersede` | the **newer** note (already written as `draft` by the ingest, 0003) | `target.relations` += `{supersedes: <supersedes>}`; `<supersedes>.relations` += `{superseded_by: target}`; older note `lifecycle: archived`; if both are decisions, older gets `assessment: superseded` and `valid_until: <target.valid_from or target.date>` | the newer note stays, without the relation |
| `merge` | the **duplicate** X to retire, merged into the survivor Y = `merge_into` | Steps, in order: **1. References.** In every note except X, Y, sources and proposals (proposals are a record of what was decided about X), rewrite frontmatter references to X's id into Y's id (then dedupe each list, keeping the first occurrence) and relative links to X's file into links to Y's file. **Persisted pairs are left alone**: a meeting's `decisions`/`questions` entries, a decision's `decided_in`, a question's `raised_in`, and other notes' `supersedes`/`superseded_by` relations keep pointing at X, whose side of those pairs stays in place (X is archived, not deleted). **2. Into Y:** union `aliases` (plus X's `title`), `tags`, `sources`, `projects`; add X's `relations` except `supersedes`/`superseded_by` and any whose target is X or Y (dedupe); append X's `timeline` entries (dedupe exact entries); a `facts` key only X has is copied to Y; for a key both have, Y's value stays and X's `accepted` entries with a different value become `superseded` with `until: <today>`; append X's body under `## Merged from <X title>`. **3. Pair:** X gets `lifecycle: archived` and `relations` += `{superseded_by: Y}`; Y gets `{supersedes: X}`. If X is a decision, it also gets `assessment: superseded` and `valid_until` = Y's `valid_from` or `date` | nothing changes |
| `new_item` | — | Write `note` as a new note with the `brain note new` rules (lifecycle `draft`). If it has `decided_in` or `raised_in`, add its id to that meeting's `decisions` or `questions` | discard |

**Write sets.** Besides the proposal file itself, applying a proposal writes only: `update_fact`, `contradiction`, `add_to_note` → the target; `supersede` → the target and the older note; `merge` → X, Y and the notes whose references step 1 rewrites; `new_item` → the new note and its meeting. All writes for one proposal happen in one operation; if any write fails, none are kept.

## 12. `brain.json` · see [schemas/brain.schema.json](schemas/brain.schema.json)

```json
{
  "schema_version": 1,
  "owner": { "name": "Rodrigo" },
  "budgets": { "ingest_max_notes": 8 },
  "notion": {
    "databases": { "areas": "", "goals": "", "key_results": "", "projects": "", "meetings": "",
                   "people": "", "orgs": "", "decisions": "", "questions": "", "review": "", "capture_inbox": "" },
    "tasks": {
      "database": "",
      "properties": { "title": "Name", "status": "Status", "due": "Due", "project": "Project",
                      "area": "Area", "owner": "", "meeting": "Meeting", "meeting_url": "", "brain_id": "Brain ID" },
      "new_task_status": "To Do"
    }
  }
}
```

**Tasks mapping (0018):** each value is the name of a property in your Tasks database; an empty string means "this database has no such property", and the field is skipped.
- `title` is required.
- `owner`: a person or text property for the action item's owner.
- **Backlink to the meeting** (required by 0018): `meeting` = a relation property to the Meetings database (preferred), or `meeting_url` = a URL property when your Tasks database has no relation to Meetings. Once `tasks.database` is set, `title` and at least one of the two must be non-empty (the JSON Schema enforces it).
- `brain_id`: a text property holding the brain's id for the task's source meeting, so a re-run never duplicates tasks.

## 13. Generated files

- **`index.md`** (0013), normative format:
  1. First line `<!-- GENERATED by brain index. Do not edit. -->`, a blank line, then `# Index`.
  2. One section per type, in this order, headed `## Areas`, `## Goals`, `## Projects`, `## People`, `## Orgs`, `## Decisions`, `## Questions`, `## Meetings`, `## Concepts`. Each heading is preceded by one blank line; the note lines follow it directly. Sections with no notes are omitted. Sources, views, proposals and memories are not listed.
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
| Questions · Kind, Status, Project, Raised In | `kind`, `notion_fields.status`, `projects`, `raised_in` |
| Review · all | proposal fields (§11): Name=`title`, Kind, Target=`target` title + id, Before, After, Why, Source Meeting=`source`, Decision/Edited Value → `decision`, State from `status` |

## 15. Lint rules derived from this spec

Errors: `.md` file in a note folder without frontmatter `id`; unparseable frontmatter; invalid frontmatter vs schema; missing required field; malformed or duplicate ID; type in wrong folder; frontmatter reference to a missing ID; broken relative link; `[[wikilink]]` present; unknown `^[...]` marker; source body hash mismatch (§4 source); a view cited as a source; `facts` key without a matching accepted timeline entry (unless contested); one side of a `supersedes`/`superseded_by` pair missing (§6); `decided_in`/`raised_in` disagreeing with the meeting's lists; superseded decision without `valid_until`; superseded decision without a `superseded_by` relation (0005); decision without `sources` (0005); memory reach lists not matching `scope`; proposal `status` and `decision` not matching §11.1.
Warnings: unknown frontmatter key; freshness (§10); summary longer than 200 chars; knowledge note with no `sources` (except area, goal, project; decisions are an error above); generated block of a view out of date (re-run `brain views`); `index.md` out of date (re-run `brain index`).
Rule codes, output format and the folders scanned are in [cli.md](cli.md) §5.10 and §3.7.

## 16. Derived view contract (normative)

Views are rebuilt by `brain views` for every project (CX-07). Inputs are canonical notes only. All links are relative to the view file. Dates render as stored. Every item line links to the note it came from (headings and `- None` lines have no link). The view's frontmatter `title` is `<project title> — brief` or `<project title> — decision log`; the body has no heading of its own. Its layout is: one blank line, the generated block, one blank line, the user block. Inside the generated block, sections are separated by one blank line.

**Idempotence:** if the new generated block and `generated_from` equal the current ones, the file is not rewritten (so `generated_at` only changes when content changes). `generated_from` is the project's id plus the id of every note that produced an item line, sorted.

### 16.1 `brief.md` (`view_kind: brief`)
The generated block contains these sections in this order; a section with no items renders a single line `- None`.

1. `## Status`
   - `- Status: <notion_fields.status> · Priority: <notion_fields.priority> (as of <notion_fields.as_of date>) ([project](project.md))`, omitting absent parts; omitted entirely if `notion_fields` is absent.
   - One line per `facts` key, sorted by key: `- <Key>: <value> ([project](project.md))`, where `<Key>` is the key with `_` → space and the first letter capitalized (`launch_date` → `Launch date`). Person-id values render as the person's linked title.
2. `## Goal` — `- [<goal title>](<path>)` or `- None`.
3. `## People` — project `people`, sorted by title then id: `- [<title>](<path>)[ — <facts.role>]`.
4. `## Recent decisions` — decisions whose `projects` contains the project and `assessment` is `accepted`, `provisional` or `contested`; sorted by `date` descending, then id; at most 5: `- <date> — [<title>](<path>) (<assessment>)`.
5. `## Open questions` — questions whose `projects` contains the project and `notion_fields.status` is `Open` or absent; sorted by `created` descending, then id: `- [<title>](<path>) (<kind>)`.
6. `## Recent meetings` — meetings whose `projects` contains the project; sorted by `date` descending, then id; at most 5: `- <date> — [<title>](<path>)`.

### 16.2 `decision-log.md` (`view_kind: decision_log`)
Two sections, each sorted by `date` descending (`valid_until` descending for superseded), then id; empty section renders `- None`:

1. `## Current` — decisions for the project with `assessment` `accepted`, `provisional` or `contested`:
   `- <date> — [<title>](<path>) — <assessment>[ — supersedes [<old title>](<old path>)]`
2. `## Superseded` — decisions for the project with `assessment: superseded`:
   `- <valid_from or date> → <valid_until> — [<title>](<path>) — superseded by [<new title>](<new path>)`
