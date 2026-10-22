# 0046 — Stacked task branches, reviewed as one run

**Status:** Proposed
**Date:** 2026-10-22
**Amends:** 0038, 0044

## Context
Since 0044, Claude Code builds every task and Codex reviews every PR. Each task branches from `main` (0038), so a task that builds on another one waits until that PR is reviewed and merged. The 0.4.1 tasks and the 0.5.0 contracts all build on decision 0045, which is itself still in review (#123). One review per task, each waiting for the previous merge, means many short development runs and many short reviews.

The user wants longer development runs by Claude Code, and Codex reviewing several tasks in one session (2026-10-22).

## Decision
- **A task may start from the branch of the task below it,** not only from `main`: `node scripts/task.mjs start <id> --from <branch>`. The task row may live on that branch, not yet on `main`. A chain of such branches is a **stack**. Its bottom branch starts from `main`.
- **Each task keeps its own branch, worktree and PR.** The PR's base is the branch below it, so its diff shows only that task. Every per-PR rule holds: the branch name, the task id in the title, the `**Changelog:**` line, the ticked boxes, the done commit and Codex's pass naming the head commit.
- **Codex reviews a whole stack in one session,** bottom first. A finding on a lower task is fixed on that task's branch. Each branch above it then merges the one below (a merge, never a rebase: force push is denied).
- **The user merges bottom-up.** `merge-ready` stays red on a PR whose base isn't `main`, naming that base. After the PR below is merged, the next PR is retargeted to `main` (`gh pr edit <N> --base main`, by Claude Code, or by GitHub itself when the merged branch is deleted). Its `merge-ready` then turns green on its own, as long as its own pass is still current.
- **A stack is as long as a review can hold.** Claude Code stops a run where a Codex finding would be costly to fix higher up: after contracts that the next tasks build on.

## Consequences
- **Amends 0038:** "one branch and one worktree per task, from `main`" becomes "from `main`, or from the branch of the task below it in a stack".
- **Amends 0044:** Codex reviews per stack, not per PR as each one opens. It still reviews every PR, and nothing merges without its pass.
- **Scripts:** `task.mjs start` gains `--from <branch>`: it reads the task row from that branch on `origin` and creates the worktree from it. `readinessProblems` (used by `merge-ready.mjs` and `merge.mjs`) reports a base other than `main`. `task.mjs done` is unchanged: it still checks that the branch is merged into `origin/main`.
- **A finding low in the stack ripples upward:** each higher branch merges the fix. That is why a stack stops after the contracts.
- **The first stack:** CC-44 (decision 0045), CC-51 (this decision), CC-45 and CC-46 (0.4.1), CC-47 (0.5.0 contracts).

## Evidence
- The user's request, 2026-10-22, after the U-15 grill.
- scripts/task.mjs, scripts/common.mjs (`readinessProblems`), decisions 0038, 0040, 0044.
