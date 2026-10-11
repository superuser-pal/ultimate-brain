---
id: dec-7k2m9q4x
type: decision
title: Use Supabase for auth
summary: Acme switches auth from Firebase to Supabase, agreed at the 3 Dec sync.
lifecycle: archived
date: 2026-12-03
assessment: superseded
decided_in: mtg-8c4n2p7w
deciders: [per-3h8w2n6c, per-9t2c6m4a]
valid_until: 2026-12-09
area: area-2m7c4h8n
projects: [prj-9x4t1b7e]
sources: [mtg-8c4n2p7w]
relations:
  - type: supersedes
    target: dec-2p9f6h1r
  - type: related_to
    target: con-1s6t8e2b
  - type: superseded_by
    target: dec-3f7k9m2q
created: 2026-12-03
updated: 2026-12-10
---

## Decision
Use Supabase for authentication on the Acme website.

## Context
Firebase pricing changed; the team already uses Supabase for the database. ^[inferred]

## Consequences
Auth migration added to the project scope. Supersedes [Use Firebase for auth](2026-10-01-use-firebase-for-auth.md).

## Sources
- [Acme sync, 3 Dec](../meetings/2026-12-03-acme-sync.md)
