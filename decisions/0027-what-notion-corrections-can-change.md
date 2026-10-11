# 0027 — What your Notion corrections can change, and how they are recorded

**Status:** Accepted
**Date:** 2026-10-11
**Refines:** 0023

## Context
Decision 0023 says an edit you make to a brain-owned value in Notion is applied as your correction and recorded in the note's `timeline`. But the timeline only exists for key facts (0010). Some brain-owned properties are not facts (Name, Summary, Why, relations), and some are judgments that have their own review path (Assessment, Supersedes). The PR #2 review flagged that the CLI contract treated these differently from 0023 without a decision.

## Decision
- **Key facts** (Role, Deadline, each Key Facts entry): applied as 0023 says, with a `timeline` entry, `source: notion-edit`, and the old value kept as `superseded`.
- **Text and references** (Name, Summary, Why, Area, Goal, Client, Org, People): the new value replaces the old one. There is no timeline entry, because these are not facts; the Git commit keeps the history.
- **Judgments** (Assessment, Supersedes, Decided In, Raised In, Kind): not applied from Notion. The sync reports the edit so the agent can tell you, and the change goes through a proposal instead. A supersession or a contested decision needs its paired changes (both notes, validity dates), which a single property edit can't carry.
- An edit counts as yours only when Notion differs from what the brain last published (the three-way comparison in spec/cli.md §5.14). An edit you make to one property never affects another.

## Consequences
- spec/cli.md §5.7 (corrections table) and §5.14.2 (correctable properties) implement this.
- Removing a key fact in Notion is not applied in v1; the sync reports it.

## Evidence
PR #2 review (P2-11, P1-2); decisions 0010, 0021, 0023.
