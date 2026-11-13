# 0092 — Move a decision, question, Document or source to another Area with set_field

**Status:** Accepted
**Date:** 2026-11-13
**Release:** 0.15.0
**Amends:** 0072's `set_field` (spec/cli.md, `set_field`: `area` on a project, `domain` on an Area); spec/schema.md §4 source (a source's `area` and `projects` were fixed at creation)
**Keeps:** 0003 (a change to existing knowledge is a proposal, decided in Review or in chat); 0034 (a decision's or question's Area in Notion comes from its projects); a source's body and the rest of its frontmatter stay immutable; U-18's rule that brain files are never edited by hand

## Context

Dogfood issue #345 (0.14.0-rc.1, skills 1.8.1). After an ingest, the user created a new Area and asked to file some of the new notes there. In a made-up brain, an ingest of 6 documents about pricing put 15 notes in Area "Product": 3 decisions, 3 questions and 1 learned Document (all `draft`, waiting in Review), 2 `whole` Documents and the 6 sources. The user then created "Go-to-market" and wanted those notes moved.

There is no supported way:
- `set_field` with `field: area` is refused on anything but a project (`INPUT_INVALID`, "area is set on a project, and dec-… is a decision").
- A Document's Area changed in Notion is ignored by `sync plan` (`NOT_CORRECTABLE`).
- A decision's or question's Area in Notion is derived from its projects.
- An Inbox row is compared only on Brain ID, so a source's Area can't be changed there either.
- A source's `area` is above `summary` in its field table, so it is never edited after creation.

The only workaround is to reject the drafts and write them again in the new Area. That doesn't work for whole Documents, which don't go through Review, or for sources. A new Area is most likely right after an ingest, which is the onboarding moment of 0.14.0.

The author chose, on 2026-11-13, to extend `set_field` (option A of the triage) in 0.15.0, the feature cutoff. They said more work may come out of it, so 0.15.0's scope grill confirms the task's scope.

## Decision

1. **`set_field` with `field: area` also takes a decision, a question, a Document (`reference`) or a source as its target.** `after` is an existing Area. The other rules of `set_field` hold: `before` set by the CLI, `BEFORE_MISMATCH`, `NO_CHANGE`, `DUPLICATE_PENDING`, the stale check at apply, and `fix` with another Area.
2. **A decision or question with `projects` is refused.** Its Area comes from its projects (0034), so moving it means moving or changing a project. The refusal (`INPUT_INVALID`) names the project.
3. **A source and its whole Document move together.** A `set_field` on either sets `area` on both. Its write set is both notes. A `part` or `learned` Document moves only when it is named.
4. **A source's `area` becomes changeable, by an applied `set_field` only.** Its body, `content_hash` and every other field above `summary` stay immutable. Lint doesn't treat a changed `area` as an edit of the snapshot.
5. **Many moves are one decision for the user.** When the user asks to move several notes, the agent writes one `set_field` per note, shows one preview listing every move, and applies them all on the user's yes in chat (0064's yes in chat). Rows not decided in chat reach Review as Suggestion rows, as today.
6. **Projects, Areas and Domains keep their own rules.** A project's `area` and an Area's `domain` work as before.

## Consequences

- After an ingest, "move these to Go-to-market" files every kind of note the ingest made, drafts included, without rejecting and rewriting them.
- Briefs and Notion follow at the next `brain views` and publish.
- Correcting Area from Notion on a Document stays out of scope. It would need a new correctable field in sync, so it goes to [docs/v2-ideas.md](../docs/v2-ideas.md).
- Work: CC-251 (0.15.0). The contract comes first (spec/cli.md `set_field` and its apply, spec/schema.md §4 source, spec/assistant.md §6.1 where it names the targets), then the CLI and a fork PR for the skill that proposes the moves.

## Evidence

Issue #345; `src/lib/notion-change.ts` (the target check), `src/lib/sync.ts` (`correctable`, Documents' `reference_area`, the decisions' derived Area); spec/schema.md §4 source; the triage of 2026-11-13 (CC-249).
