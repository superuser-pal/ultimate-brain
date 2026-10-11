# 0025 — Lifecycle applies to knowledge notes only

**Status:** Accepted
**Date:** 2026-10-11
**Refines:** 0005 ("Lifecycle (every note)")

## Context
Codex's review of the schema spec (PR #1) pointed out that 0005 says lifecycle applies to "every note", while the spec excludes sources, views and proposals.

## Decision
`lifecycle` (`draft` / `reviewed` / `disputed` / `archived`) applies to **knowledge notes**: area, goal, project, person, org, meeting, decision, question, concept, memory.

These file types have their own state instead:
- **source**: immutable; its state is "captured", checked by `content_hash`.
- **view**: regenerated; its state is `generated_at`.
- **proposal**: `status` (pending → approved / edited / rejected → applied / closed).

## Evidence
spec/schema.md §3.2, §8, §11.1; PR #1 review comment on spec/schema.md:96.
