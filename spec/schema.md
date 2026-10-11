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
| Frontmatter | YAML between `---` lines at the very top. Block style. Unknown keys are preserved by tools and flagged by lint as warnings |
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
| `last_synced` | timestamp | | system | |
| `notion_fields` | map | | system (snapshot of you-owned fields) | §7 |

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
- Supersession uses `relations` (`supersedes` / `superseded_by`). A superseded decision has `assessment: superseded` and lifecycle `archived`.
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
| `content_hash` | `sha256:<64 hex>` of the body | ✔ |
| `captured` | timestamp | ✔ |
| `origin_edited` | timestamp (Notion `last_edited_time`) | |

### view · inside `projects/<slug>/` · rendered into the Notion project page
Generated; never evidence (lint error if any note's `sources` cites a view).
| Field | Type | Req |
|---|---|---|
| `view_kind` | `brief`·`decision_log` | ✔ |
| `project` | ID | ✔ |
| `generated_from` | list of IDs | ✔ |
| `generated_at` | timestamp | ✔ |
Body: `<!-- @generated:start -->` … `<!-- @generated:end -->`, then optional `<!-- @user:start -->` … `<!-- @user:end -->`. Tools replace only the generated block.

### memory · `memories/YYYY/MM/` · never published (0008, 0009; loop is v2)
| Field | Type | Req |
|---|---|---|
| `scope` | `general`·`area`·`project`·`stack` | ✔ |
| `areas` / `projects` / `stacks` | lists | required to be non-empty when `scope` is that level |
| `confidence` | `verified`·`inferred`·`unverified` | ✔ |
| `origin` | string (repo identity from `.brain`) | ✔ |
- Supersession via `relations`. A `general` memory must not list projects (0009).

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

| Type | Meaning | Inverse (computed, not written) |
|---|---|---|
| `supersedes` | this replaces target | `superseded_by` |
| `decided_in` | decision → meeting | `decisions` |
| `about` | note is about a project/org/person | `mentioned_in` |
| `depends_on` | this needs target | `needed_by` |
| `contradicts` | conflicting claims | `contradicts` |
| `derived_from` | built from target | `used_by` |
| `related_to` | general link | `related_to` |

`superseded_by` may also be written explicitly on the older note (tools write both sides when applying a supersede proposal). Targets must exist (lint error).

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

- **lifecycle** (every knowledge note): `draft` → `reviewed` | `disputed` → `archived`. Agents only set `draft` (creation) and `archived` (supersession). You set the rest in Notion.
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
| `target` | ID | ✔ (except `new_item`) | note to change |
| `field` | string | for `update_fact`, `contradiction` | fact key |
| `before` / `after` | string, number or date | for `update_fact`, `contradiction` | |
| `content` | string | for `add_to_note`, `new_item` | Markdown to add, or the draft note |
| `supersedes` | ID | for `supersede` | the older note |
| `merge_into` | ID | for `merge` | survivor |
| `why` | string | ✔ | the source sentence that triggered it |
| `source` | ID or source key | ✔ | |
| `status` | `pending`·`approved`·`rejected`·`edited`·`applied`·`closed` | ✔ | |
| `decision` | `{action: approve·reject·edit, value?, decided_at, decided_by: notion·chat}` | when decided | |
| `notion` | Review row page id | | |

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
                      "area": "Area", "meeting": "Meeting", "brain_id": "Brain ID" },
      "new_task_status": "To Do"
    }
  }
}
```

## 13. Generated files

- **`index.md`** (0013): header `<!-- GENERATED by brain index. Do not edit. -->`, then one `## <Type>` section per type in the order area, goal, project, person, org, decision, question, meeting, concept. One line per note, sorted by title:
  `- [<title>](<relative path>) — <id> · <type-specific: area/project/status> · <summary> · aliases: <a, b>`
  Excludes source, view, proposal, memory.
- **`log/YYYY-MM.md`**: append-only, one line per operation:
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
| Meetings · Date, Attendees, Project, Area | `date`, `attendees`, `projects[0]`, `area` |
| Meetings · Decisions, Questions | `decisions`, `questions` |
| Meetings · Brain Status, Ingested At | set by ingest (`Ingested`, timestamp); not stored in the note |
| People · Role, Org, Email | `facts.role`, `org`, `notion_fields.email` |
| Orgs · Relationship, Website | `notion_fields.relationship`, `.website` |
| Decisions · Date, Assessment, Project, Decided In, Supersedes | `date`, `assessment`, `projects[0]`, `decided_in`, `relations[supersedes]` |
| Questions · Kind, Status, Project, Raised In | `kind`, `notion_fields.status`, `projects[0]`, `raised_in` |
| Review · all | proposal fields (§11): Name=`title`, Kind, Target=`target` title + id, Before, After, Why, Source Meeting=`source`, Decision/Edited Value → `decision`, State from `status` |

## 15. Lint rules derived from this spec

Errors: invalid frontmatter vs schema; missing required field; malformed or duplicate ID; type in wrong folder; frontmatter reference to a missing ID; broken relative link; `[[wikilink]]` present; unknown `^[...]` marker; source body hash mismatch; a view cited as a source; `facts` key without a matching accepted timeline entry (unless contested).
Warnings: unknown frontmatter key; freshness (§10); summary longer than 200 chars; note with no `sources` (except area, goal, project created in Notion).
