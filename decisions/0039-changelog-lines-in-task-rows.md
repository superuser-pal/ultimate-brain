# 0039 — Changelog lines live in task rows

**Status:** Accepted
**Date:** 2026-10-19

## Context
Decision 0038 gives every task a line in `CHANGELOG.md` under its release. Each PR adds that line at the end of the same `## x.y.z — unreleased` section, and its done commit rewrites the line to add `(#N)`. Two open PRs therefore always edit neighbouring lines.

A retro after the 0.3.0 build (CC-28) measured the cost:
- From 2026-10-15 to 2026-10-19, 9 of the 11 merges of `main` into a task branch conflicted, every one of them on `CHANGELOG.md`; build/TASKS.md conflicted in 2 of the 9.
- 5 of those resolutions dropped 8 task lines that were on `main`. None reached `main`, but each was found by hand. One PR (#91) took a review round to fix it.

The two build/TASKS.md conflicts were different. Each time, a new task block had been inserted directly next to a heading whose status another PR changed. Status edits on separate tasks never conflicted, because each task's body lines separate the headings.

## Decision
- **A task's changelog line is a field of its row.** Each task in build/TASKS.md carries a `**Changelog:** <text>` line directly after its `**Release:**` line. A PR edits its own row only; it no longer touches `CHANGELOG.md`.
- **`dropped` is a task status**, next to `todo`, `in progress`, `review`, `done` and `blocked`: the task will not ship. `release.mjs` filters out a version's `dropped` tasks before any other check, for every version, so a dropped task needs no `**Changelog:**` line.
- **`release.mjs <version>` writes the section.** It takes the version's remaining tasks in TASKS.md order and refuses, naming each task, when one:
  - is not `done` (as today);
  - has no `**Changelog:**` line, or one that is empty or only whitespace;
  - has a done heading whose suffix is not one or more PR numbers: `` `done` (#N) ``, `` `done` (#N, #M) `` (any count, comma and space between), each optionally followed by `; <note>` before the closing parenthesis, as in `` `done` (#58; decisions 0032, 0033) ``. A bare `` `done` `` and the older `(PR #N)` form refuse.

  Then it writes `## <version> — <date>` at the top of `CHANGELOG.md`, one line per task: `- <id> (#N): <text>`, or `- <id> (#N, #M): <text>` with every number in heading order and the note left out. The section is part of the release commit, as the dated heading is now.
- **`pr-format.mjs`** checks that the PR's own task row has a non-empty `**Changelog:**` line on the head, instead of a `CHANGELOG.md` addition. It keeps CX-32's guard against lost task headings, extended to a `**Changelog:**` line that was on the base and is gone on the head.
- **`merge.mjs`** keeps CX-32's `` `done` (#N) `` check and drops its `CHANGELOG.md` `(#N)` check: the PR number now comes from the heading.
- **build/TASKS.md stays as it is.** New task blocks arrive in planning PRs that merge before their work starts, and status edits on separate tasks don't conflict. A bad resolution is caught by the lost-heading guard. No new rule is needed.
- **The switch is at 0.4.0.** Releases up to 0.3.x keep their hand-written `CHANGELOG.md` sections. From 0.4.0, `release.mjs` generates the section and replaces any hand-written `## 0.4.0 — unreleased` section. Until the tooling (CX-34) and the docs (CC-30) merge, a 0.4.0 task carries both lines: the CHANGELOG line for today's `pr-format`, and the `**Changelog:**` field for the release.

## Consequences
- **Two parallel PRs no longer share a line.** The measured CHANGELOG conflicts go away; only a PR that adds task blocks can still conflict on build/TASKS.md.
- **The PR number is written once,** in the done heading. The done commit no longer edits `CHANGELOG.md`.
- **CHANGELOG.md shows only released versions.** Work in progress is read from build/TASKS.md, which is already the plan of record.
- **Amends 0038:** "a line in `CHANGELOG.md` under that release" becomes "a `**Changelog:**` line in its row"; the PR-format and release gates change as above. AGENTS.md, the PR template and docs/releasing.md follow in CC-30.
- **CX-32's `CHANGELOG.md` checks are short-lived.** They protect 0.3.1, then CX-34 removes them.

## Evidence
Retro of 2026-10-19 (CC-28, #95): `git merge-tree` over every non-PR merge since 2026-10-15 (`59fa800`, `dacb9d8`, `fac599d`, `b76d414`, `b77dd9f`, `a1e69da`, `4e3aeaa`, `a43f642` and `d27c64f` conflicted on `CHANGELOG.md`; `b76d414` and `4e3aeaa` also on build/TASKS.md). The lost lines were found by comparing the task ids in both parents' `CHANGELOG.md` with each merge result. Options weighed with the user: fragment files under `changes/<release>/` (a second place per task) and a `merge=union` driver (duplicates the line that the done commit rewrites). Decision 0038.
