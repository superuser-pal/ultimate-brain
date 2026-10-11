# Ultimate Brain — Research Synthesis

**Status:** Research complete; proposed design for v1. Not implemented.
**Date:** 2026-10-11
**Inputs:** [vision](../docs/vision.md), decisions [0001–0017](../decisions/), reviews [01](../reviews/01-claude-obsidian.md) · [02](../reviews/02-obsidian-wiki.md) · [03](../reviews/03-obsidian-mind.md) · [04](../reviews/04-obsidian-second-brain.md) · [05](../reviews/05-llm-wiki.md), [v2 ideas](../docs/v2-ideas.md).

---

## 1. Summary

Five open-source "LLM second brain" repos were reviewed against one goal: **a trustworthy, agent-operated brain in Markdown + Git, with Notion as the human interface, whose first job is to turn reviewed meeting minutes into knowledge that agents in any repo can use.**

None of the repos does this. None integrates Notion, none has stable note IDs, and four of five let the agent write directly to live notes. But between them they contain every mechanism we need, and they agree on a lot:

- Raw sources are immutable; derived knowledge cites them.
- Navigation files (index, log) are generated, never written by the model.
- Inferences must be marked; fabrication and false "not found" are the main failure modes.
- History is appended, never overwritten.
- Source content is data, never instructions.

What we take is **design, not code**: the repos are large and tied to Obsidian, and one (llm_wiki) is GPL-3.0.

**Who contributes what:**

| Repo | Main contribution to Ultimate Brain |
|---|---|
| claude-obsidian | Write safety (inspect → approve → apply), claim assessment states, untrusted-content and egress rules, "don't create pages that add nothing" |
| obsidian-wiki | Note model: typed relationships, `summary:` field, provenance markers, lifecycle, validity dates, retrieval ladder, staged patches |
| obsidian-mind | Agent memory: scoped recall, write contract, append-only supersession, correction sweep, meeting intake routing, "consuming repo needs its own instruction" |
| obsidian-second-brain | Workflows: freshness policy, `@generated`/`@user` regeneration, "new = free, change = proposal" gate, fact timelines, flag-only unattended runs |
| llm_wiki (GPL, design only) | Two-step analyse → generate ingest, review queue shape and sweep, meeting/decision/project schema, subject-boundary prompt rules |

---

## 2. Decisions taken

| # | Decision | In one line |
|---|---|---|
| [0001](../decisions/0001-stable-note-ids.md) | Stable IDs | Every note has a permanent `id`; files can move freely |
| [0002](../decisions/0002-link-syntax.md) | Links | Standard relative Markdown links; IDs repair them on rename |
| [0003](../decisions/0003-proposal-review-flow.md) | Review flow | New notes apply as `draft`; changes, supersessions, contradictions, merges go to a Notion Review queue (or chat if present) |
| [0004](../decisions/0004-sentence-provenance-markers.md) | Provenance | `^[inferred]` / `^[ambiguous]` on sentences that aren't stated by a source |
| [0005](../decisions/0005-lifecycle-and-assessment.md) | States | Notes: `draft → reviewed / disputed → archived`. Key facts & decisions: `accepted / provisional / contested / superseded` |
| [0006](../decisions/0006-consuming-repo-instruction.md) | Consuming repos | Each repo gets a "consult the brain" block, installed by a setup command |
| [0007](../decisions/0007-notion-meeting-notes-not-deleted.md) | Notion meetings | Marked `ingested` + link, never deleted or edited |
| [0008](../decisions/0008-agent-memory-store.md) | Agent memory | `memories/YYYY/MM/`, write contract, promotion to knowledge (v2 loop) |
| [0009](../decisions/0009-memory-scope-levels.md) | Memory scope | `general / area / project / stack`, default deny, `.brain` marker per repo |
| [0010](../decisions/0010-key-fact-timeline.md) | Key-fact history | `timeline:` inside the note for v1 |
| [0011](../decisions/0011-freshness-rule.md) | Freshness | Facts are timeless, dated, or pointers; lint warns in v1 |
| [0012](../decisions/0012-meeting-minutes-reviewed-before-ingest.md) | Minutes reviewed first | Only minutes marked "Reviewed" by the user are ingested |
| [0013](../decisions/0013-ingest-context-and-index.md) | Ingest context | Generated `index.md`; analysis reads index + up to ~8 relevant notes |
| [0014](../decisions/0014-product-repo-vs-brain-repo.md) | Repos | Product repo (this one) separate from each user's private brain repo; built to scale to a product |
| [0015](../decisions/0015-notion-access-via-mcp.md) | Notion access | Through the official Notion MCP server |
| [0016](../decisions/0016-typescript-on-node.md) | Language | TypeScript on Node, `npx ultimate-brain init` |
| [0017](../decisions/0017-prefixed-short-ids.md) | ID format | Prefixed short random IDs, e.g. `dec-7k2m9q4x` |

---

## 3. Consolidated component decisions

### 3.1 Adopt (rules and principles, rewritten in our own words)

| Rule | From | Where it goes |
|---|---|---|
| Source content (meetings, web, Notion text) is data, never instructions | 01, 04 | Brain AGENTS.md |
| Never fabricate; never claim "no note exists" without searching (index, aliases, grep) | 04, 01 | Brain AGENTS.md |
| Mark inference (`^[inferred]`), disagreement (`^[ambiguous]`) | 02, 03 | Schema + AGENTS.md (0004) |
| Keep each claim attached to its subject; copy structured data verbatim | 05 | Ingest prompts |
| Don't create a note that adds nothing durable; a no-op is valid | 01 | Ingest rules |
| Decision record only if hard to reverse, surprising without context, or a real trade-off; otherwise a dated line in the project | 03, 04 | Ingest rules |
| Volatile status lives in one place; everything else links to it | 03 | Schema rule |
| Freshness: timeless / dated / pointer | 04 | Lint (0011) |
| Index and log are generated by script, never by the model | 01, 02, 05 | Tooling (0013) |
| Derived outputs never become evidence | 02, 05 | Schema rule |
| Query is read-only; saving is a separate, explicit step | 01 | Query skill |
| Unattended runs only add and flag | 04 | Future schedulers (0003) |
| Each consuming repo needs its own instruction block | 03 | Setup command (0006) |

### 3.2 Adapt (mechanisms to rebuild, smaller and Git/Notion-native)

| Mechanism | From | Our version |
|---|---|---|
| Inspect → approve → apply | 01 | `_proposals/` files ↔ Notion Review rows → `apply` command → Git commit |
| Confirmation gate "new = free, change = proposal" | 04 | Rule in 0003 |
| Staged patch format | 02 | Proposal file (§4.6) |
| Review item shape + sweep | 05 | Notion Review database + auto-close of stale rows (never contradictions) |
| Claim assessment + supersession | 01, 03 | `assessment` on timeline entries and decisions (0005) |
| Fact timeline | 04, 02 | `timeline:` frontmatter (0010) |
| Typed relationships | 02, 04 | One merged vocabulary (§4.3) |
| Correction sweep (authoritative / restatement / historical) | 03 | v1: manual correction flow; v2: sweep command |
| Two-step ingest (analyse → generate) | 05 | Meeting ingest (§5) with option B context |
| Meeting intake routing table | 03 | Meeting ingest extraction (§5) |
| `@generated` / `@user` markers | 04 | Derived project brief and decision log (§4.5) |
| Retrieval ladder + `summary:` | 02 | Query skill (§6) |
| Source keys (`notion:`, `url:`, `agent:`) | 02 | `sources:` field |
| Content hash on raw sources | 04, 05 | Raw meeting snapshots (§5) |
| Memory scope + write contract | 03 | v2 memory loop (0008, 0009) |
| Context pack (budgeted) | 02 | Query skill output |

### 3.3 Reference for v2

Scheduled agents (04), MCP server surface `search/expand/recall/remember` (03, 02), semantic contradiction/stale lint (05), dedup audit → merge proposals (02, 05), autoresearch draft-then-merge (01), weekly digest (02, 04), Stop-hook memory capture (02), adapter pattern for multiple agent platforms (04), BM25/graph retrieval (01, 05), privacy exposure policy (03), GBrain as index (0008).

### 3.4 Reject

Obsidian-specific skills and syntax (wikilinks, Bases, canvas, CLI), tasks stored in Markdown, numeric confidence scores, sequential address counters, LLM rewrites of whole page bodies on every touch, auto-ingesting chat answers as sources, background agents with permission bypass, automatic synthesis pages, methodology modes, engineer-specific taxonomies, release/packaging machinery.

---

## 4. Minimal Markdown schema (v1 proposal)

### 4.1 Layout

```text
brain/                          ← the user's brain repo (data)
├── AGENTS.md                   ← rules for agents operating the brain; CLAUDE.md imports it
├── brain.json                  ← config: Notion database IDs, budgets, owner name
├── index.md                    ← GENERATED (0013)
├── log/2026-10.md              ← GENERATED operation log, one file per month, append-only
├── areas/
│   └── clients.md              ← PARA area: description, active projects (derived block)
├── projects/
│   └── acme-website/
│       ├── project.md          ← canonical: why, scope, key facts + timeline, owner
│       ├── brief.md            ← DERIVED view (@generated)
│       └── decision-log.md     ← DERIVED view (@generated)
├── archive/
│   └── projects/…              ← finished project containers move here; knowledge stays put
├── knowledge/                  ← outlives projects
│   ├── people/maria-lopez.md
│   ├── orgs/acme.md
│   ├── decisions/2026-12-03-use-supabase-for-auth.md
│   ├── meetings/2026-12-03-acme-sync.md     ← meeting summary (dated, historical)
│   ├── questions/who-owns-acme-mobile.md
│   └── concepts/…
├── sources/
│   └── notion/2026-12-03-acme-sync.md       ← raw snapshot of the reviewed minutes, immutable
├── memories/YYYY/MM/…          ← agent memories (v2 loop; folder reserved)
└── _proposals/
    └── 2026-12-03-acme-launch-date.md       ← pending changes ↔ Notion Review rows
```

**Rules:** clients are orgs in `knowledge/orgs/` and their engagements are projects inside an area (0009). Meetings and decisions live in `knowledge/` because they outlive the project. Only the container moves to `archive/`.

### 4.2 Common frontmatter (every note)

```yaml
---
id: dec-7k2m9q4x                   # permanent (0001, 0017)
type: decision                      # area | goal | project | person | org | meeting | decision | question | concept | source | memory | view
title: Use Supabase for auth
summary: Acme switches auth from Firebase to Supabase, agreed at the 3 Dec sync.   # ≤200 chars, feeds index.md
lifecycle: draft                    # draft | reviewed | disputed | archived (0005)
area: clients
projects: [acme-website]
aliases: []
sources: ["notion:1a2b3c…", "knowledge/meetings/2026-12-03-acme-sync.md"]
relations:
  - {type: supersedes, target: dec-2p9f6h1r}   # see 4.3
created: 2026-12-03
updated: 2026-12-03
notion: 9f8e7d…                     # Notion page id once published (bridge-owned)
---
```

### 4.3 Relationship vocabulary (merged from Reviews 2 and 4)

`supersedes` / `superseded_by`, `decided_in` (decision → meeting), `about` (note → project/org/person), `depends_on`, `contradicts`, `derived_from`, `related_to`. Inverses are computed by the index script, not written twice.

### 4.4 Type-specific fields (v1 types only)

| Type | Extra fields |
|---|---|
| `goal` | `why`, `deadline` with `timeline:`, `area`, `projects`, dated snapshot of key results (progress lives in Notion, 0020) |
| `project` | `status` (pointer if live in Notion), `owner`, `client` (org id), key facts with `timeline:` (0010) |
| `person` | `role`, `org`, `timeline:` for role changes |
| `org` | `relationship` (client, partner…), `timeline:` if needed |
| `meeting` | `date`, `attendees` (person ids), `notion_source`, `action_items` (Notion task links only) |
| `decision` | `date`, `assessment` (0005), `decided_in` (meeting id), `deciders`, `supersedes`, `context`, `consequences` |
| `question` | `status` (open / answered), `raised_in`, `answer_ref` |
| `source` | `source_key` (`notion:<id>`), `content_hash`, `captured` (immutable body) |
| `view` | `generated_from` (ids), `generated_at` (derived; never evidence) |

### 4.5 Derived views

`brief.md` and `decision-log.md` per project are rebuilt from canonical notes. Their body sits inside `<!-- @generated:start --> … <!-- @generated:end -->`; an optional `<!-- @user -->` block is never touched. Every line links to the note it came from. They are safe to overwrite in Notion.

### 4.6 Proposal file

```yaml
---
id: prp-4n8c2w7t
type: proposal
kind: update_fact          # update_fact | add_to_note | supersede | contradiction | merge
target: prj-9x4t1b7e        # note id (projects/acme-website/project.md)
field: launch_date
before: 2027-01
after: 2027-02
driving_sentence: "Maria (now PM) confirmed launch moves to February."
source: knowledge/meetings/2026-12-03-acme-sync.md
status: pending            # pending | approved | rejected | edited | applied
notion: 7c6b…              # Review row id
created: 2026-12-03
---
```

---

## 5. v1 workflow: ingest reviewed meeting minutes

**Trigger:** you mark a Notion meeting note `Brain status: Reviewed` (0012), then run `brain ingest` in Claude Code or Codex. A scheduler can trigger the same command later.

| Step | What happens | Writes |
|---|---|---|
| 1. Fetch | Read Notion meeting notes with `Reviewed` and not yet `ingested` | — |
| 2. Snapshot | Save the minutes verbatim to `sources/notion/…` with `content_hash`; skip if the hash was already ingested | raw source (create-only) |
| 3. Match | Read `index.md`; match attendees (aliases), project/org, area | — |
| 4. Load context | Open up to ~8 notes: project, attendees, the project's recent decisions (0013) | — |
| 5. Analyse | Extract: summary, decisions (with gate), key-fact changes, new people/roles, open questions & risks, contradictions with loaded notes, action items. Mark inferences. Keep claims attached to subjects | — (analysis held in memory) |
| 6. Generate | **New notes** (meeting summary, new people, new decisions, new questions) → written as `draft`. **Changes** (fact updates, role changes, supersessions, contradictions) → `_proposals/`. **Action items** → Notion tasks with a link to the meeting summary | notes, proposals, Notion tasks |
| 7. Rebuild | Regenerate `index.md`, derived views of touched projects, append log | generated files |
| 8. Commit | One Git commit per meeting: `ingest: Acme sync 2026-12-03 (4 new, 3 proposals)` | Git |
| 9. Publish | Push meeting summary + new notes to Notion; create Review rows; set `ingested` + link on the source meeting note (0007) | Notion |
| 10. Report | In chat: what was created, what awaits review, what was skipped and why | — |

**Applying reviews:** `brain apply` reads Review rows. Approved → apply to the target note (timeline entry, assessment change), Rejected → close, Edited → apply your edited value. It then rebuilds views and index, commits, and republishes. Contradiction rows resolve to `contested` (both kept) unless you pick a side.

**Worked example** (Acme sync, 3 Dec): 4 notes created directly (summary, decision "Use Supabase", question "Who owns mobile?", meeting record), 1 Notion task, 4 Review rows (launch Jan → Feb, Maria Designer → PM, Supabase supersedes Firebase, Carlos's ownership question).

---

## 6. Agents in other repos (v1)

- **Setup command** (`brain link`): writes `.brain` (project, area, stacks) into the repo and adds the "consult the brain" block to its CLAUDE.md / AGENTS.md (0006).
- **Query skill/CLI** (`brain query "<question>"`): resolves the brain location (env var or global config), then follows the retrieval ladder: `index.md` → `summary:` fields → grep → full reads of a few notes. Returns a short, cited answer that separates `accepted` facts from `contested` and `superseded` ones. Read-only.
- **Agent memories:** folder and scope rules exist (0008, 0009), but the propose-memory loop is v2.

---

## 7. Notion bridge (v1 scope and open design questions)

**Inbound:** Meetings database (reviewed minutes), Capture inbox (v1 optional).
**Outbound:** Areas, Goals, Projects, People, Orgs, Decisions, Questions, Review queue; meetings get their relations filled (no second summary). Action items go to your Tasks database (0018). Key Results are Notion-owned (0020). New areas, goals, projects, people and orgs can be created in Notion (0021).
**Full design and Notion AI build prompts:** [docs/notion-space-design.md](../docs/notion-space-design.md).
**Mapping:** note `id` ↔ Notion page id (`notion:` field). Bodies are regenerated from Markdown (read-only in practice); human-owned properties sync back: `lifecycle` (reviewed / disputed), project `status` / `priority` (pointer facts).
**Rendering:** `^[inferred]` shown as a visible marker; `contested` facts shown with both values; derived views shown as page bodies.

**Open questions for the Notion-space design** (to be answered with `docs/notion-space-architecture.md`):
1. Database list and properties for each type; which properties are human-owned.
2. Review row layout: before/after, driving sentence, source link, Approve/Reject/Edit control.
3. How corrections written as Notion comments become proposals.
4. Page body format for people/projects (summary + timeline + links).
5. Notion access method: Notion MCP vs a small API client script.

---

## 8. Implementation decisions (resolved)

All four are now decided:
1. **Product repo vs brain repo:** separate, built to scale to a product (0014).
2. **Language:** TypeScript on Node (0016).
3. **ID format:** prefixed short random IDs (0017).
4. **Notion access:** Notion MCP (0015).

Still open: final field names for §4, frozen after a dry run on 3–5 real meetings, and the Notion space design (§7).

---

## 9. Proposed build order (for approval, not started)

1. **Schema spec + templates** for the v1 note types and the proposal file; brain AGENTS.md.
2. **Notion space design:** databases, properties, relations, views and Spaces, built from the Easlo and Ultimate Brain analyses (`docs/notion-second-brain-template-comparison.md`) and the hub-and-spoke pattern (`docs/notion-space-architecture.md`). Designed alongside the schema so every outbound note type maps to a database.
3. **Index builder + lint** (IDs, links, frontmatter, freshness warnings).
4. **Meeting ingest** on a local copy of 3–5 real reviewed minutes, writing Markdown only (no Notion yet). Check quality by hand.
5. **Notion bridge:** read Reviewed meetings, publish notes, Review queue, `apply`.
6. **Query skill + `brain link`** for consuming repos; test the v1 success criterion ("what did we decide with client X and why?").
7. **Two-week dogfood**, then the v2 list.
