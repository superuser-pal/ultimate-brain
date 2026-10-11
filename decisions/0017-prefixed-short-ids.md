# 0017 — ID format: prefixed short random IDs

**Status:** Accepted
**Date:** 2026-10-11
**Refines:** 0001

## Decision
Note IDs are a type prefix + `-` + 8 random characters from Crockford base32 (lowercase, no ambiguous letters), e.g. `dec-7k2m9q4x`.

| Prefix | Type |
|---|---|
| `area` | area |
| `gol` | goal |
| `prj` | project |
| `per` | person |
| `org` | org |
| `mtg` | meeting |
| `dec` | decision |
| `que` | question |
| `con` | concept |
| `src` | source |
| `mem` | memory |
| `prp` | proposal |
| `vw` | view |

- The generator checks the brain for collisions and re-rolls if needed.
- The prefix is fixed at creation and never changes, even if the note's `type` changes later; `type:` is the truth, the prefix is a hint.
- Creation order comes from `created:`, not from the ID.

## Rejected
Full ULID (unreadable in review rows and chat); shortened ULID (keeps the timestamp, drops the randomness, so notes created in the same ingest can collide).
