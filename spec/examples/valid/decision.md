---
id: dec-7k2m9q4x
type: decision
title: Use Supabase for auth
summary: Acme switches auth from Firebase to Supabase, agreed at the 3 Dec sync.
lifecycle: draft
date: 2026-12-03
assessment: accepted
decided_in: mtg-8c4n2p7w
deciders: [per-3h8w2n6c]
projects: [prj-9x4t1b7e]
sources: [mtg-8c4n2p7w]
relations:
  - type: supersedes
    target: dec-2p9f6h1r
created: 2026-12-03
updated: 2026-12-03
---

## Decision
Use Supabase for authentication on the Acme website.

## Context
Firebase pricing changed; the team already uses Supabase for the database. ^[inferred]

## Consequences
Auth migration added to the project scope.

## Sources
- [Acme sync, 3 Dec](../meetings/2026-12-03-acme-sync.md)
