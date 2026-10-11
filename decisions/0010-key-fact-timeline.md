# 0010 — Key-fact history format (v1)

**Status:** Accepted
**Date:** 2026-10-11

## Decision
For v1, key facts (budget, owner, deadline, role, status) keep their history **inside the note** as a frontmatter `timeline:` list. The top-level field holds the current value.

```yaml
budget: 80000 EUR
timeline:
  - field: budget
    value: 50000 EUR
    from: 2026-06-10
    until: 2026-12-03
    learned: 2026-06-10
    source: meetings/2026-06-10-acme-kickoff.md
    assessment: superseded
  - field: budget
    value: 80000 EUR
    from: 2026-12-03
    learned: 2026-12-03
    source: meetings/2026-12-03-acme-review.md
    assessment: accepted
```

`assessment` uses the vocabulary from 0005. Exact field names are fixed in the schema spec.

## Alternatives kept for v2
See docs/v2-ideas.md ("Key facts as separate records").

## Evidence
reviews/04-obsidian-second-brain.md (bi-temporal `timeline:`), reviews/02-obsidian-wiki.md (`valid_from`/`valid_until`), reviews/01-claude-obsidian.md (claim ledger).
