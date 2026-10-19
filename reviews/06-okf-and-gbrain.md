# Review 06 — Open Knowledge Format (OKF) and GBrain

**Focus:** whether OKF (a file format) or GBrain (a memory system) fits the brain, and what adopting OKF would change
**Reviewed:** `GoogleCloudPlatform/open-knowledge-format` SPEC.md v0.2 (last commit 2026-08-21); `garrytan/gbrain` README (default branch, 2026-10-19)
**Date:** 2026-10-19
**Method:** static reading of the spec, READMEs and GitHub metadata through `gh api`. Nothing was cloned or run. Adoption claims come from the repos' metadata and secondary web coverage, cited inline.

Mark claims **Verified** (seen in the spec or README) or **Inferred**.

## 1. Overview

The two are not alternatives. They answer different questions:

| | OKF | GBrain |
|---|---|---|
| What it is | A **format**: Markdown + YAML frontmatter, with conventions for provenance, trust, lifecycle and index/log files | A **system**: Bun CLI, PGLite/Postgres database, hybrid search, typed graph, MCP server, cron "dream cycle" |
| Question it answers | What shape should a note file have so any tool can read it? | How does an agent find and combine facts in a large brain? |
| Retrieval | None; it prescribes no storage, serving or query (SPEC §1 non-goals) **Verified** | Keyword, vector and graph search, plus `think` (cited synthesis) **Verified** |
| Canonical store | The files | The database; "Markdown export is not a full backup" (README) **Verified** |

GBrain's slot in our plan is a v2 **search index over the Markdown** (decisions/0008). OKF cannot fill it. OKF's slot, if any, is the **shape of our files**: an export format now, possibly a base layer of our schema later.

## 2. OKF compared with our schema (spec/schema.md)

OKF is close to our design. Our schema is close to a stricter OKF dialect.

| OKF v0.2 | Ours | Fit |
|---|---|---|
| `type` required; free string (§4.1) | `type` required; enum | Compatible |
| `title`, `description`, `tags` recommended | `title` required, `summary` required, `tags` | `summary` → `description` (rename or duplicate) |
| `status: draft / stable / deprecated` (§5.4) | `lifecycle: draft / reviewed / disputed / archived` (0005, 0025) | Mappable: draft→draft, reviewed→stable, disputed→stable + no `verified`, archived→deprecated |
| `generated: {by, at}`, `verified: [{by, at}]`, trust tier from the `human:` prefix (§5.2–5.3) | Agents write `draft`; the user sets `reviewed` in Notion | Mappable: `reviewed` = `verified: {by: human:<owner>}`. We don't record **when** or **by which agent**; a gain |
| `sources:` list of **objects**, `resource` required, optional `author`, `last_modified` (§5.1) | `sources:` list of **source keys** (ids) | **Collision**: same key, different shape. The one breaking point |
| Per-claim attribution: footnote `[^source-id]` on sourced claims (§5.1) | Unmarked = sourced; `^[inferred]` / `^[ambiguous]` on the rest (0004) | Opposite polarity. Both can coexist; `^[...]` is Pandoc inline-footnote syntax, so OKF renderers show it as a footnote |
| `stale_after`: absolute instant (§5.5) | Freshness rule: timeless, dated or pointer (0011) | Different idea; `stale_after` could be added to pointer facts |
| `index.md` per directory, `* [Title](url) - description`, no frontmatter (§8) | One root `index.md`, `- [title](path) — id · fields · summary` (0013) | Close; OKF consumers read ours as a list of links |
| `log.md`, date-grouped prose (§9) | `log/YYYY-MM.md`, one line per operation | Not OKF; an OKF consumer sees `log/*.md` as concepts with no frontmatter |
| Links: bundle-absolute `/x.md` recommended, relative allowed (§6.1) | Relative links (0002) | Compatible |
| Timestamps: ISO 8601 with UTC offset (§5) | `created`, `updated` are dates | Add a time, or keep dates and write `generated.at` in UTC |
| Unknown keys preserved, never rejected (§4.1, §11) | `id`, `facts`, `timeline`, `relations`, `notion_*`, `assessment` | Allowed as extensions |
| Conformance: **every** non-reserved `.md` has frontmatter with `type` (§11) | The brain root holds `AGENTS.md`, `README.md`, `log/`, `_proposals/` | The brain repo as a whole is **not** a conformant bundle; an export must write a clean one |
| Attested Computation (§10) | — | Not relevant: it is for data-catalog metrics (SQL, dbt) |

**Worked example**, a reviewed decision note:

```yaml
# today                               # OKF-aligned (level 1 below)
id: dec-7k2m9q4x                      id: dec-7k2m9q4x
type: decision                        type: decision
title: Launch in February             title: Launch in February
summary: Launch moved to Feb 2027.    description: Launch moved to Feb 2027.
lifecycle: reviewed                   lifecycle: reviewed            # kept: our richer state
sources: [src-3h8k2m4p]               status: stable                 # derived from lifecycle
created: 2026-12-03                   source_ids: [src-3h8k2m4p]     # renamed, ours
updated: 2026-12-04                   sources:                       # OKF shape, derived from source_ids
                                        - id: src-3h8k2m4p
                                          resource: /sources/notion/2026-12-03-acme-sync.md
                                      generated: {by: brain-ingest/0.4.0, at: 2026-12-03T10:22:00Z}
                                      verified: {by: human:owner, at: 2026-12-04T09:00:00Z}
                                      created: 2026-12-03
                                      updated: 2026-12-04
```

## 3. What changing to OKF would look like

Three levels, each a superset of the one before. Nothing at level 0 blocks a later level.

### Level 0: export only (no change to the brain)
- `brain export --okf <dir>` writes a conformant v0.2 bundle: knowledge notes and sources only, with the mapping in §2 applied (`status`, `description`, `sources` objects, `generated`, `verified`), one `index.md` per folder, a root `index.md` with `okf_version: "0.2"`, and log lines regrouped by date into `log.md`. `_proposals/`, `memories/` (never published, 0008) and views are left out.
- `verified.at` comes from the Notion review time where the brain has it (`notion_fields` snapshot); otherwise `verified` is omitted (the note reads as unverified, never wrongly verified).
- Cost: one spec section, one CLI command and a conformance test against the spec's §11 rules. Roughly one CC task + one CX task.
- Gain: any OKF consumer (Google's Knowledge Catalog, the OKF viewer, third-party tools) can read the brain. Nothing else changes.

### Level 1: align in place (the brain's files are OKF-friendly)
- **Rename our `sources` to `source_ids`** (or similar) and let `sources` hold OKF objects, written by the tools. The only breaking change: a schema migration that `brain upgrade` applies to every note, plus edits in ingest, apply (`add_to_note`, `merge`), lint, index, views and Notion sync, and in every skill that mentions `sources`.
- Agents write `generated: {by: <skill>/<version>, at}` on create and on each applied change; `sync` writes `verified` when Notion moves a note to `reviewed`. `status` is derived from `lifecycle` (or `lifecycle` stays and `status` is generated).
- `summary` is mirrored to `description` (or renamed, which touches the index format, Notion "Summary" and the 200-char lint).
- `log/` and `_proposals/` stay non-conformant at the root; the bundle is declared as a set of folders (`knowledge/`, `projects/`, `areas/`, `goals/`, `sources/`) or the export from level 0 remains the conformant form.
- Cost: a decision amending 0001-0005 field names, a migration, and touches across most CLI commands and skills. A release-sized change (comparable to 0.3.0).

### Level 2: OKF as the base of our spec
- `spec/schema.md` becomes "an OKF v0.x profile": OKF's fields as the base, our extensions (ids, facts/timeline, relations, assessment, proposals, Notion fields) as required keys on top. The JSON Schemas extend an OKF schema.
- We can't go further: OKF is deliberately minimal and has no proposals, assessment, timeline or Notion mapping. "Switching to OKF" can only ever mean becoming an OKF profile, never replacing our spec.
- Cost: mostly documentation once level 1 is done; ongoing cost is tracking OKF versions (v0.2 already had breaking changes from v0.1, §13).

## 4. Will OKF become a standard? (evidence, 2026-10-19)

For:
- Announced by Google Cloud's Data Cloud team in June 2026, with Knowledge Catalog able to ingest it (secondary coverage: [iloveseo.net](https://www.iloveseo.net/the-open-knowledge-format-what-google-really-shipped/), [wavect.io](https://wavect.io/blog/open-knowledge-format-okf/)). **Inferred** from secondary sources; the primary announcement was not found.
- Visible community interest: ~1,000 stars, 68 forks, about 30 issues and PRs proposing connectors (Postgres, Protobuf), typed relationships, `supersedes`/`contested_by`, `refuted`, deletion semantics. **Verified** (GitHub metadata).
- Its design matches where agent knowledge is heading: plain files, Git, provenance and trust in frontmatter.

Against:
- **One contributor, 6 commits, none since 2026-08-21.** Of the ~30 issues and PRs, one is closed. **Verified.** The community is proposing; the maintainer is not merging.
- No governance home (no foundation or working group) and no other vendor endorsing it yet ([iloveseo.net](https://www.iloveseo.net/the-open-knowledge-format-what-google-really-shipped/)). **Inferred.**
- Its target is data catalogs (BigQuery tables, metrics, attested SQL), not personal knowledge; the bundled samples are all datasets. **Verified.**
- v0.2 already broke v0.1 (`timestamp`, `# Citations`), and an open issue reports a breaking change inside v0.2 without a version bump. **Verified.**

**Reading:** a Google repo is a reason to watch, not proof of a standard; many Google-hosted specs stay niche. The hedge is cheap because OKF requires so little: we lose nothing by waiting, as long as we don't deepen the one collision (`sources`).

## 5. GBrain as the retrieval index

Fit problems against our decisions:
- The database is canonical (README) → conflicts with 0008 "never a second canonical store". Only `gbrain import <dir>` + `gbrain search` in read-only, rebuildable use would fit.
- Auto-linking matches `[[wikilinks]]` → we write none (0002), so its graph would be empty unless it also reads relative links. **Inferred.**
- The dream cycle (overnight enrichment, auto-written pages, citation fixing) matches what synthesis §3.4 rejects (background agents, automatic synthesis pages).
- Heavy and fast-moving: Bun ≥ 1.4, schema migrations with recovery steps in the README, pushed daily.

Other candidates for the same slot: the BM25 + optional rerank retriever reviewed in reviews/01-claude-obsidian.md (derived cache, falls back to index + text search), or extending the current query ladder.

## 6. Open decisions (for the user, when revisited)

1. Ship level 0 (export) once there is a consumer to export to, or before?
2. When we next change `sources`, take the OKF shape (level 1's rename) at the same time?
3. Retrieval index: GBrain read-only, a local BM25 index, or nothing until the query ladder gets slow?

## 7. Recommended next step

Park both in docs/v2-ideas.md with explicit revisit triggers. No spec change now.
