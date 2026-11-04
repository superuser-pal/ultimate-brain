# 0070 — Lifecycle only where the brain creates the row

**Status:** Accepted
**Date:** 2026-11-04
**Amends:** [0005](0005-lifecycle-and-assessment.md)

## Context
Decision 0005 puts Lifecycle (Draft, Reviewed, Disputed, Archived) on every note and makes it a Notion property on every brain-mirrored database. Its job is trust: a Draft is something the brain wrote that you haven't checked yet. That job only exists where the brain creates rows without asking. Ingest writes people, decisions, questions, concepts and Document parts from what it reads, as drafts, and their Review row turns them into Reviewed or Archived.

Domains, Areas, Goals, Projects and Orgs are different: you create them in Notion, or the brain writes one only after your yes (a project an ingest asks about, decision 0068). Their Draft tells you nothing, and their state is already in Status and Archived. In the user's 2026-11-04 review the Lifecycle property on those five was noise, and the user removed it from their space.

## Decision
- **Lifecycle stays a Notion property** on People, Decisions, Questions, Concepts and Documents: the databases whose rows ingest writes from a source. People keeps it because ingest picks people up from meetings and you confirm them in Review.
- **Domains, Areas, Goals, Projects and Orgs have no Lifecycle property.** You close one with **Archived** (checkbox), which Orgs gains (it had none: closing an org went through Lifecycle).
- **In Git, every knowledge note keeps `lifecycle`** (schema, Review, index, cleanup and lint read it). For the five types it is `reviewed` when the note is created, whether it comes from a Notion row or from `note new`, and sync neither reads nor publishes it.
- **When the brain retires one of the five** (a merge, or a supersession), its note becomes `archived` as before, and the publish ticks Archived on its page once, so it leaves your active views. After that, Archived is yours again: unticking it is your edit.

## Consequences
- Prompt 2, the modules, the views guide (Orgs views filter on Archived, the Archive tab of Orgs too), the page layouts, the Notion design doc, spec/schema.md §8 and §14, spec/cli.md §5.14 and migration 0017 for existing spaces.
- Existing `draft` notes of the five types stay as they are: nothing in the brain treats them as waiting for review.
- A space that still has Lifecycle on those databases keeps working: the brain ignores the property there.

## Evidence
The user's scope review, 2026-11-04 (CC-121): Lifecycle on Areas, Domains, Projects, Goals and Orgs is not needed; People keeps it; part of 0.9.1.
