# 0044 — Claude Code builds, Codex reviews

**Status:** Accepted
**Date:** 2026-10-21

## Context
Since wave 1, Claude Code has owned the specs, skills and Notion design, and Codex the TypeScript CLI and its tests, each reviewing the other's work. On 2026-10-20 Claude Code also built CX-35, CX-32 and CX-36 at the user's request. Those kept their `codex/` branches, so the required pass came from Claude Code, the author itself. After CC-36 (#115) the user decided that Claude Code does every task from now on and Codex only reviews.

## Decision
- **Claude Code builds every task:** specs, skills, prompts, Notion design, and also the CLI in `src/`, its tests and fixtures. Codex doesn't build tasks.
- **Codex reviews every PR** against its task's acceptance criteria, the cited decisions and the contracts in `spec/`, and posts `Review (Codex): pass at <sha>` after the done commit. Without that pass, `merge-ready` stays red, as before (0040).
- **Contracts still come first.** A CLI change follows a spec that is already on `main` or in the same PR. Codex's review checks the code against it, so a behaviour the spec doesn't define is a review finding.
- **Ids and branches:** new tasks are `CC-n` on `claude/` branches, so the scripts need no change. The open Codex tasks are renumbered:

  | Was | Now |
  |---|---|
  | CX-39 | CC-40 |
  | CX-33 | CC-41 |
  | CX-37 | CC-42 |
  | CX-38 | CC-43 |

  Each row says "(was CX-n)". Done CX rows, decisions and PRs keep their ids as history.

## Consequences
- Every PR has one author and one reviewer, and the reviewer is always a different agent from the author, which the `claude/` prefix enforces.
- The "Spec questions" step becomes a review finding: Codex raises it on the PR, and Claude Code answers by updating the spec before the code.
- The `CX` owner and the `codex/` branch prefix stay valid in the scripts, but no new task uses them.

## Evidence
- build/TASKS.md status note "Codex was out on 2026-10-20" (CX-35, CX-32, CX-36).
- PR #115 (CC-36), the contracts the renumbered tasks build on.
