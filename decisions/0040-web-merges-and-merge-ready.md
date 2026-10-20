# 0040 — The user merges on the web page; a merge-ready check replaces the merge script gate

**Status:** Accepted
**Date:** 2026-10-20

Amends 0038 ("Merge, without paid branch protection").

## Context

Decision 0038 made `scripts/merge.mjs` the only way to merge a PR: it checks CI, the ticked boxes, the task's `done` (#N) and the other agent's pass, then merges. CX-32 (0.3.1) made `main-guard` fail any merge that has neither the other agent's pass nor the override note `merge.mjs --reviewed-by-user` writes.

The user merges on GitHub's PR page, and prefers to keep doing so. The first four merges after CX-32 (#100, #103, #104, #105) were made there. `main-guard` failed on #104 and #105, and `release.mjs` refuses while CI on `main` is red, so 0.3.1 could not be released. The gate blocked the person it serves, while agents were already kept off `main` by the `pre-push` hook and the deny rules.

## Decision

- **The user merges on the GitHub PR page.** `merge.mjs` stays as an optional path from the terminal; nothing requires it.
- **A `merge-ready` status on every PR** shows what `merge.mjs` used to check, before the user clicks Merge: branch and title format, every box ticked, the PR's task `done` with its number, and the other agent's `Review (<agent>): pass at <sha>` naming the head commit. It is a commit status on the PR's head, green or red with the first problems in its description (e.g. "CX-36 is `review`, not `done` (#107); no pass from Codex at a1b2c3d"). It is recomputed when the PR is opened, edited or pushed to, and when a review or comment is posted. CI and mergeability are shown by GitHub itself, so `merge-ready` leaves them out.
- **It informs, it doesn't block.** On a private repository on the free plan GitHub enforces no required check; GitHub Pro stays deferred (0038). The user decides, with `merge-ready` in view.
- **`main-guard` checks only where a commit came from:** every new commit on `main` came from a merged PR or is a tagged release commit. It no longer checks how a PR was merged, so a merge on the web page never turns `main` red. A commit pushed to `main` outside a PR still fails it and opens a `main-guard` issue.
- **Agents still never merge.** The `pre-push` hook and Claude Code's deny rules are unchanged; AGENTS.md says so for both agents.

## Consequences

- `release.mjs` is no longer blocked by a correct web merge.
- A PR can be merged without the other agent's pass, as with `merge.mjs --reviewed-by-user` before; the difference is that no note records it. `merge-ready` was red at that moment, and the PR page shows it.
- Built in CX-36: `scripts/merge-ready.mjs`, a CI workflow on `pull_request`, `pull_request_review` and `issue_comment` events with `statuses: write`, the shared readiness checks in `scripts/common.mjs` (used by `merge.mjs` too), and `main-guard.mjs` without the review check.

## Evidence

0.3.1 merges on 2026-10-20: merge commits of #100, #103, #104 and #105 carry GitHub's default message and no override note; `main-guard` failed on #104 and #105 (issue #106); `release.mjs 0.3.1 --dry-run` refused with "CI is not green on HEAD".
