# Review 02 — Ar9av/obsidian-wiki

**Focus:** Knowledge structure, linking, and navigation
**Commit reviewed:** `df5459599a33579506b771173fdb462b0b48e553` (2026-10-10)
**Date:** 2026-10-11
**Method:** Static reading of source and docs only. Nothing was executed. "Verified" means seen at the cited path, not observed at runtime.

## 1. Repository Overview

A skill framework (40 skills in `.skills/`) for an LLM-maintained Markdown wiki in the Karpathy "LLM Wiki" pattern, plus a stdlib Python CLI (`obsidian_wiki/`, `cli.py` 3.4k lines) that has taken over the error-prone bookkeeping: index/log/hot generation, staging, lint, trust ledger, context packs, and an optional FastAPI + MCP server. Its value for us is the **knowledge model**: categories plus project folders, typed relationships, inline provenance markers, lifecycle and confidence, bi-temporal validity with `superseded_by`, redirect stubs for merges, and portable source keys. Note that `AGENTS.md` still claims "no scripts or dependencies", but the repo now ships a substantial CLI that the skills require (`obsidian-wiki memory sync` etc.). Docs and code have drifted.

## 2. Relevant Components

| Area | Path | Verified behavior |
|---|---|---|
| Schema (canonical) | `.skills/llm-wiki/SKILL.md` | Three layers (immutable raw → LLM wiki → schema). Categories `concepts/ entities/ skills/ references/ synthesis/ journal/`, plus `projects/<name>/<name>.md` with optional project-scoped category subfolders. Page template, provenance markers, typed relationships, confidence/lifecycle, tiers, retrieval primitives, link format. |
| Required frontmatter | `AGENTS.md`, `llm-wiki/SKILL.md` | `title, category, tags, sources, created, updated`; recommended `summary` (≤200 chars), `aliases`, `relationships`, `provenance`, `base_confidence`, `lifecycle`, `tier`. |
| Node identity | `obsidian_wiki/lint.py` L293, `wiki-dedup/SKILL.md` Step 1 | **No stable ID.** Identity = vault-relative path without `.md` (`node_id`). Aliases exist for name matching only. |
| Typed relationships | `llm-wiki/SKILL.md` "Typed Relationships"; validated in `lint.py` ~L440–500 | Frontmatter `relationships: [{target, type}]`, types `extends, implements, contradicts, derived_from, uses, replaces, related_to`; lint flags invalid type, ambiguous or missing target. Directional, declared only from the source page. |
| Provenance markers | `llm-wiki/SKILL.md` "Provenance Markers" | Inline `^[inferred]` / `^[ambiguous]` suffix; unmarked = extracted; optional page-level `provenance:` fractions recomputed by lint. |
| Lifecycle & confidence | `llm-wiki/SKILL.md`, `obsidian_wiki/trust.py` | `lifecycle: draft/reviewed/verified/disputed/archived`; only ingest sets `draft`, all other transitions are human; illegal transitions flagged against `_meta/trust-ledger.json`. `base_confidence` from evidence lineages × source quality; staleness is computed (`updated` > 90 days), not stored. |
| Bi-temporal validity | `obsidian_wiki/temporal.py` | Optional `valid_from` / `valid_until` (event time) vs `created`/`updated` (ingestion time), plus `superseded_by`. Pages past `valid_until` are historical, kept in vault and graph; retrieval uses `is_current`. |
| Correction record | `.skills/wiki-capture/SKILL.md` "Correction Mode" | Atomic `original_claim` → `corrected_claim` with `correction_id`, `source_locator`, source SHA-256 (verified pre/post, raw never edited), `authority_class`, `asserted_at`/`effective_at`/`as_of`, `supersedes`, per-consumer propagation status. |
| Staged writes (propose/approve) | `wiki-ingest/SKILL.md` Step 5, `wiki-stage-commit/SKILL.md`, `obsidian_wiki/staging.py` | With `WIKI_STAGED_WRITES=true`: new pages go to `_staging/<cat>/page.md`; updates go to `page.patch.md` (Additions / Deletions / Updated Fields, `patch_target`, `source`). CLI lists entries with `staged_revision`/`live_revision` hashes and refuses promotion on conflict; reject moves to `_raw/`. Off by default. |
| Dedup & merge | `.skills/wiki-dedup/SKILL.md` | Audit (default) → confirmed merge → optional auto-merge ≥0.90. Pre-write Git snapshot. Survivor chosen by incoming links, content, sources. Secondary becomes a **redirect stub** (`redirects_to:`); wikilinks rewritten vault-wide outside code; manifest records `merged_into`. |
| Cross-linker | `.skills/cross-linker/SKILL.md` | Scores missing links (name mentions, shared tags, same project), labels confidence, applies only EXTRACTED/INFERRED; may write typed relationships for links it adds; never touches existing typed entries. |
| Lint | `obsidian_wiki/lint.py`, `.skills/wiki-lint/SKILL.md` | Broken links, missing frontmatter, missing trust fields, duplicate stems/titles, absolute source paths, relationship errors, broken archive links, provenance drift, illegal lifecycle transitions. |
| Source keys & manifest | `llm-wiki/SKILL.md` ".manifest.json", `scripts/manifest.py` | Portable keys: vault-relative, `~`-relative, or pseudo-keys (`url:`, `agent:<agent>/<id>`, `repo:<host/owner/name>`). Manifest maps source → `pages_created`/`pages_updated` for re-ingest and staleness. |
| Memory surface | `obsidian_wiki/memory.py` | Generated `index.md`, append-only `log.md` (`- [TS] VERB key=value`), word-capped `hot.md` with one LLM-owned "Key Takeaways" slot, `_meta/profile.md` (owner facts) and `_meta/todos.md`, all under one advisory lock with atomic writes. |
| Retrieval primitives | `llm-wiki/SKILL.md` "Retrieval Primitives" | Cost ladder: index/frontmatter grep → `summary:` → targeted grep with context → full read. Optional QMD index. |
| Context pack | `obsidian_wiki/context_pack.py`, `.skills/wiki-context-pack/SKILL.md` | Ranks pages by tier and query tokens, compiles summaries and excerpts within a token budget (default 8k), read-only, honors `visibility/` tags. |
| Cross-project skills | `AGENTS.md` "Cross-Project Usage", `.skills/wiki-update/SKILL.md` | Vault resolved from any directory (`@name` override → `.env` walk-up → XDG global config). `wiki-update` distills a repo into `projects/<name>.md`, incrementally via `last_commit_synced` with rebase detection. |
| Session capture | `.claude/hooks/wiki-stop-capture.sh`, `wiki-capture --quick` | Stop hook detects sessions with real edits and asks the agent to run quick capture, with a KEEP/SKIP gate that errs toward SKIP; quick capture writes only to `_raw/`, and promotion needs `/wiki-ingest`. |
| MCP/HTTP server | `obsidian_wiki/server.py` | Optional FastAPI + MCP: `search`, `read_page`, `write_page`, `context_pack`, `memory_recap/profile/todo/sync`, `status`, `staging`. Single tenant, API key. |
| Other | `wiki-digest`, `wiki-narrate`, `wiki-research`, `wiki-synthesize`, `wiki-export`/`wiki-import` (OKF v0.2) | Digest and narrative readouts saved in `_readouts/`, explicitly *not* knowledge pages. |

### Answers to the brief's questions

1. **How are entities represented?** One Markdown page per entity/concept in a category folder, or under `projects/<name>/<category>/` when project-specific. Title, aliases, summary and tags in frontmatter. Identity is the file path.
2. **How are relationships established and maintained?** Body wikilinks (untyped), plus optional typed `relationships:` frontmatter. Maintained by ingest (≥2–3 links per new page), `cross-linker`, and lint (broken/ambiguous targets). Backlinks are not stored; they are computed by grep or graph analysis.
3. **What metadata supports stable references?** Weak: path-based `node_id`, `aliases`, redirect stubs after merges, portable source keys. There is no immutable page ID.
4. **How does reorganization affect links?** Moves and renames break links unless a skill rewrites them. Only `wiki-dedup` has a defined procedure (redirect stub plus vault-wide rewrite, done one file at a time by the agent). There is no general rename/move command (Verified: no rename function in `links.py`).
5. **What depends on Obsidian?** Wikilink default, `^[...]` marker rendering, Bases dashboards, graph colouring, layout CSS, `.obsidian/` exclusion. A `OBSIDIAN_LINK_FORMAT=markdown` mode generates standard relative links. The CLI and schema work without the app.
6. **How would it translate to Notion?** (Inferred) Frontmatter maps cleanly to database properties (category, tags, lifecycle, confidence, tier, valid_from/until). Typed relationships map to relation properties. `summary` maps to a preview column. Staging patches map to review-queue rows. Path-based identity is the blocker: a Notion page mapping needs an ID that survives renames.

## 3. Port / Adapt / Reject

| Component | Source file | Verified behavior | Decision | Reason |
|---|---|---|---|---|
| Typed relationships block | `llm-wiki/SKILL.md`, `lint.py` | Directional typed edges, validated | **Port** | Gives decisions and facts real edges (`replaces`, `contradicts`, `derived_from`). Maps to Notion relations. Small and well-specified. |
| Inline provenance markers `^[inferred]` / `^[ambiguous]` | `llm-wiki/SKILL.md` | Extracted by default, inferred/ambiguous marked inline | **Adapt** | Cheapest way to meet "distinguish facts from inferences" at sentence level. Syntax renders in Obsidian; check how it publishes to Notion (likely convert to a callout or annotation). |
| Bi-temporal validity + `superseded_by` | `obsidian_wiki/temporal.py` | `valid_from/valid_until` event time vs ingestion time; historical pages kept, not overwritten | **Port** | This is exactly the "€50k → €80k, valid until 3 Dec" requirement for key facts and decisions in vision.md. |
| Correction record | `wiki-capture/SKILL.md` Correction Mode | Atomic original → corrected claim, authority class, effective time, supersedes, propagation tracking | **Adapt** | Strong template for human corrections coming back from Notion. Simplify the fields (drop per-consumer propagation for v1). |
| Staged writes + patch files | `staging.py`, `wiki-stage-commit/SKILL.md` | Proposals in `_staging/` with revision hashes; accept/reject; conflict refusal | **Adapt** | Closest existing match to our propose → approve → apply flow. A staged patch is effectively a review-queue item; it could be published as a Notion review-queue row and promoted on approval. Revisit whether a Git branch replaces the folder. |
| Lifecycle state machine | `llm-wiki/SKILL.md`, `trust.py` | Agent can only set `draft`; human promotes; `archived` terminal; illegal transitions linted | **Adapt** | Matches "agents propose, humans approve". `reviewed/verified` could be the Notion-owned property that syncs back. Drop numeric `base_confidence` (pseudo-precision) or keep it optional. |
| Retrieval primitives cost ladder | `llm-wiki/SKILL.md` | index → summary → grep → full read | **Port** | Exactly how agents in other repos should query the brain without a vector DB. Requires a `summary:` field on every note. |
| `summary:` frontmatter field | `llm-wiki/SKILL.md`, `wiki-ingest/SKILL.md` | ≤200 chars, rewritten when meaning shifts | **Port** | Enables cheap retrieval and Notion previews. |
| Portable source keys | `llm-wiki/SKILL.md` "Source key contract" | `url:`, `agent:<agent>/<id>`, `repo:`, vault-relative | **Port** | Add `notion:<page-id>` for meeting notes. Gives every source a machine-portable identity. |
| Manifest source → pages | `llm-wiki/SKILL.md`, `scripts/manifest.py` | Tracks pages created/updated per source | **Adapt** | Needed to re-ingest a changed Notion meeting note and find affected pages. Consider deriving it from frontmatter `sources:` instead of a separate JSON file. |
| Category + project folders | `llm-wiki/SKILL.md` "Wiki Organization" | Global categories plus `projects/<name>/` with scoped subfolders | **Adapt** | Close to our hybrid PARA. Map to `projects/`, `areas/`, `archive/` plus a shared knowledge layer (people, orgs, concepts, decisions, sources). Avoid project-scoped knowledge subfolders: knowledge should outlive the project. |
| Redirect stubs on merge | `wiki-dedup/SKILL.md` 5c–5f | Secondary page replaced by `redirects_to:` stub; links rewritten | **Adapt** | Good safety net, but with stable IDs most link rewrites become unnecessary. Keep stubs for human-readable path changes. |
| Dedup audit → confirm → merge | `wiki-dedup/SKILL.md` | Candidate scoring from titles/aliases; merge needs confirmation; pre-write Git snapshot | **Adapt** | Use audit mode as a maintenance report (v2); merges go through the review queue. Reject auto-merge. |
| Cross-linker | `.skills/cross-linker/SKILL.md` | Suggests missing links with confidence labels | **Reference only** | Useful later; v1 ingest should link at write time. |
| Generated index/log/hot under lock | `obsidian_wiki/memory.py` | One code path, atomic, word cap | **Adapt** | Agrees with Review 1: index and log should be generated, not hand-edited. Git branches may make the advisory lock unnecessary. |
| Owner profile `_meta/profile.md` | `obsidian_wiki/memory.py` | Durable owner facts as a Markdown table | **Adapt** | Good home for "global preferences" agent memory in vision.md. |
| Context pack | `obsidian_wiki/context_pack.py` | Budgeted, ranked, read-only bundle | **Adapt** | Candidate implementation for the "query from any repo" skill/CLI: return a cited pack within a token budget. |
| Vault resolution from any directory | `AGENTS.md` Config Resolution | `@name` → `.env` walk-up → XDG config | **Adapt** | Simplify to one env var or XDG config path to locate the brain. |
| `wiki-update` repo → project page, incremental | `.skills/wiki-update/SKILL.md` | `last_commit_synced`, rebase detection | **Reference only** | Pattern for incremental re-ingest of any source by a cursor. Notion meeting notes need an equivalent `last_edited_time` cursor. |
| Stop-hook session capture | `.claude/hooks/wiki-stop-capture.sh`, `wiki-capture --quick` | Detects real work, nudges capture to `_raw/`, KEEP/SKIP gate | **Adapt (v2)** | Fits the vision's "agent proposes memories" flow: route output to the review queue rather than `_raw/`. Claude-only; Codex needs another trigger. |
| Readouts kept out of knowledge (`_readouts/`) | `AGENTS.md`, `context_pack.py` SKIP_DIRS | Derived narratives are excluded from knowledge and context packs | **Port** | Same principle as our "derived outputs are views": generated briefs must never be ingested back as knowledge. |
| Importance tiers | `llm-wiki/SKILL.md` | core/supporting/peripheral steer ingest and query effort | **Reference only** | Premature for a personal brain with <1k notes. |
| Confidence formula with source-quality buckets | `llm-wiki/SKILL.md` | Numeric 0–1 score | **Reject** | Pseudo-precision; claude-obsidian's categorical assessment (Review 1) is easier to trust and render. |
| MCP/HTTP server | `obsidian_wiki/server.py` | Search, read, write, context pack over MCP | **Reference only (v2)** | Good reference for the v2 MCP server's tool surface. Note `write_page` bypasses staging, so it must not be copied as-is. |
| Session-brain, history ingest for 6 agents, graph colorize, layout, dashboards, skill factory, OKF export | `.skills/…` | Various | **Reject** (history ingest: **Reference only**) | Out of v1 scope or Obsidian-specific. |

## 4. Architecture Integration

- **Markdown schema (main contribution):** typed `relationships:`, `summary:`, inline provenance markers, `lifecycle` (agent sets draft only), `valid_from/valid_until/superseded_by` for key facts and decisions, portable `sources:` keys with a new `notion:` scheme. Missing and needed from elsewhere: **stable unique ID** and Notion mapping fields.
- **Agent skills/instructions:** retrieval cost ladder for the query skill; context pack for cross-repo context; "derived outputs never become knowledge" rule.
- **Ingestion/maintenance:** source → pages manifest for re-ingest; staged patch format; dedup audit as a v2 maintenance report.
- **Memory:** owner profile for global preferences; generated index/log.
- **Notion bridge:** staged patches → review-queue rows; lifecycle `reviewed/verified` as a human-owned property synced back; frontmatter → database properties; typed relationships → relations. All of this must be built; nothing in the repo targets Notion.

## 5. Dependencies and Risks

- **No stable IDs.** Path-based identity breaks Notion mapping and links on rename. This is the biggest gap.
- **Doc/code drift:** `AGENTS.md` says "no scripts or dependencies", yet skills require the `obsidian-wiki` CLI. Several features exist in both prose and code and may disagree.
- **Default is direct writes.** Staging is opt-in (`WIKI_STAGED_WRITES`), ingest otherwise edits live pages, and `wiki-dedup --auto` merges without prompting. The MCP `write_page` writes directly.
- **Ingest "resolves contradictions"** between old and new information (`wiki-ingest` Step 5), which conflicts with our rule to surface rather than silently resolve. Only `^[ambiguous]` markers and `contradicts` relationships record them; there is no contradiction detection code.
- **Obsidian assumptions:** wikilinks by default, `^[...]` syntax, Bases, `.obsidian/`. Markdown link mode exists.
- **Optional services:** QMD index, PageIndex for long PDFs, tree-sitter, FastAPI/MCP. None required.
- **Breadth:** 40 skills with heavy overlap (6 history-ingest variants). Porting broadly would import complexity; cherry-pick the schema.
- **Not run:** tests exist (`tests/`, ~60 files) but were not executed.

## 6. Open Decisions

1. **Stable ID scheme** (carried over from Review 1, now blocking): ULID/UUID in frontmatter, with filenames free to change?
2. **Link syntax:** wikilinks (Obsidian-friendly, ambiguous across folders) vs standard relative Markdown links (portable, GitHub and Notion friendly) vs ID-based links (`[text](id:…)`) resolved at publish time?
3. **Proposal storage:** `_staging/` folder with patch files (this repo) vs Git branches/PRs vs review-queue records only in Notion. This determines the review queue's shape.
4. **Provenance at sentence level:** adopt `^[inferred]` / `^[ambiguous]` markers, or keep provenance at note and record level only?
5. **Lifecycle values:** adopt `draft/reviewed/verified/disputed/archived`, or merge with Review 1's claim assessments (`accepted/provisional/contested/unsupported/deprecated`)? Proposed split: lifecycle for notes, assessment for key-fact/decision records.

## 7. Recommended Next Step

Adopt this repo's **schema vocabulary** as the base of our Markdown model: typed relationships, `summary`, provenance markers, lifecycle (agent-draft-only), bi-temporal validity with `superseded_by`, portable source keys, redirect stubs, and the retrieval cost ladder. Use the staged-patch format and correction record as starting templates for the review queue and Notion corrections.

Combine with Review 1: claude-obsidian supplies write safety and claim assessment; obsidian-wiki supplies the page and relationship model. Still to build: stable IDs, Notion mapping fields, a meeting-note ingest flow, and derived output generation.

## Fit with v1 (docs/vision.md)

| Criterion | Contribution |
|---|---|
| 1. Meeting/source ingestion | Medium. Generic ingest with "distill substance, not dialogue" for transcripts, topic clustering, ≤15 pages per ingest. No meeting-specific extraction (decisions, action items). |
| 2. Decision/key-fact records with history | **Strong.** Bi-temporal validity, `superseded_by`, `replaces` relationships, correction record. |
| 3. Hybrid PARA + knowledge layer | **Strong.** Global categories plus project folders is the closest model reviewed so far. |
| 4. Derived outputs | Medium. `_readouts/` separation principle; `wiki-digest` and `wiki-narrate` generate outputs but store them as files, not regenerated views. |
| 5. Agent retrieval from other repos | **Strong.** Retrieval cost ladder, `summary:` field, context pack, vault resolution from any directory. |
| 6. Propose → approve → apply | Medium–strong. Staged writes with patch files and revision-hash conflict detection, but opt-in. |
| 7. v2 flows | Digest, research, dedup audit, Stop-hook session capture, MCP server reference. |

## Answers to brief questions

See "Answers to the brief's questions" under §2.

**Stopping here. Awaiting approval before Review 3 (breferrari/obsidian-mind).**
