# 0052 — Reflection: the brain finds its own contradictions, duplicates and stale facts

**Status:** Proposed
**Date:** 2026-10-29

## Context
The vision's "wow" is a brain that maintains and synthesizes itself. Today every check is local: `brain lint` sees one file's frontmatter and links, and ingest compares a new source with the ~8 notes it loads (0013). Nothing looks across the brain for two notes that disagree, two people that are one person, or a reviewed fact that later meetings have overtaken. docs/v2-ideas.md holds these as "Contradiction and staleness reports", "Dedup audit" and "Correction sweep". reviews/08 read a third-party audit whose "reflection" pass does exactly this over the curated notes and the last 30 days of session notes, with five kinds of finding. The user agreed the shape below in a grill on 2026-10-29.

## Decision
### A `brain-reflect` skill over a CLI that finds candidates
- **The user says** "tidy the brain", "what's inconsistent?", or a schedule runs it (0051).
- **`brain reflect --candidates`** finds clusters deterministically, like `brain query --candidates`; the skill reads each cluster and judges it. Signals:
  - **near-duplicate names:** two notes of one type whose titles or aliases match once accents, punctuation, case and initials are ignored ("María López" and "M. Lopez");
  - **overtaken notes:** a reviewed note whose subject is named in meetings or sources newer than its `updated`;
  - **shared ground:** reviewed notes that share two or more links or references, where two of them may disagree;
  - **recurring terms:** a term named in three or more sources of the window that no note's title or aliases carry.
- **What it reads:** reviewed notes; drafts only for merges (duplicate drafts from ingest are the commonest mess, and a draft is already waiting for review); meetings and sources of the **last 30 days** as evidence.

### Every finding is a proposal or a draft, never an edit (0003)
| Finding | Example | Written as |
|---|---|---|
| Contradiction | the project says launch in January, a decision moved it to February | `contradiction` → a Conflict row |
| Stale fact | a person note says "PM at Acme", three meetings say she left in June | `update_fact` or `supersede` → a Conflict row |
| Merge | `people/maria-lopez` and `people/m-lopez` | `merge` → a Conflict row ("possible duplicate") |
| Promotion | a lasting rule said in one meeting that belongs on the project | `add_to_note` on the project, its source that meeting |
| Recurring theme | four meetings discuss "pricing tiers", no note exists | a **draft** concept note citing those sources, in a Review notes row (0041) |
- **Review keeps three kinds of row (0048).** Reflection adds none.
- **A theme needs three or more sources behind it,** and each theme's draft goes in its own Review notes row, whose source is the newest of them: a Review notes row has one source (0041).

### At most 10 rows per run, and a rejected finding stays rejected
- **10 Review rows per run, most severe first:** contradictions, stale facts, merges, promotions, themes. The rest is counted in the report ("12 more next time"). The cap protects the user's attention, not compute, so it isn't a setting; if rows pile up, the candidates get better filters.
- **Each reflection proposal carries a `fingerprint`:** its kind and its sorted target ids (plus the field, for a fact). Candidates whose fingerprint is on a rejected or pending proposal are skipped, so "merge Maria and M. López", once rejected, isn't proposed again.

### Runs on demand or weekly, unattended
- **Unattended (0051) it is safe as it is:** it only adds proposals and drafts. A weekly schedule is the suggested one ("every Monday at 8").
- **The same rules as unattended catch-up:** no findings means no commit, no Notion write and no log line; one Inbox Report row only when something needs the user or failed and Reports is on, otherwise the summary that opens the next attended catch-up; publishing only with `settings.publish: auto`.
- **The report** is like catch-up's: counts per kind, what needs the user, the next action.
- **A light pass inside catch-up,** limited to the notes that run touched, comes later, once the volume of rows is known. Not now: a pass over the whole brain would break the 5-minute bar (0043).

### Three new lint warnings
- **`orphan`:** a knowledge note that no other note references or links to, and that has no project or area.
- **`note-size`:** a note body over 10 KB, sources and Documents excluded (they hold whole texts on purpose).
- **`near-duplicate`:** the near-duplicate names signal above, one warning per pair.
- **Not taken:** a "stub note" check, because drafts from ingest are short on purpose.

## Consequences
- **Closes in v2-ideas:** "Contradiction and staleness reports" and "Dedup audit"; part of "Correction sweep" (a stale restatement becomes a proposal; the full sweep stays v2).
- **Schema:** `fingerprint` on proposals. **CLI:** `brain reflect --candidates`; the three lint warnings. **Skill:** `brain-reflect`.
- **Built in 0.8.0** (CC-65 to CC-67), after the agency brain has moved in, so it is tried on real duplicates (U-21). If the move-in comes before 0.8.0, the `near-duplicate` warning moves into 0.7.0.

## Evidence
- reviews/08-operator-and-optimizer.md §1 (Optimizer, reflection), §2.
- docs/v2-ideas.md "Maintenance and quality"; synthesis §3.3 (semantic contradiction and stale lint, dedup audit → merge proposals).
