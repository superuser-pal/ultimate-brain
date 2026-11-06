# 0073 — `main` requires `merge-ready`

**Status:** Accepted
**Date:** 2026-11-06
**Release:** 0.10.0 (CC-138)
**Amends:** [0040](0040-web-merges-and-merge-ready.md) ("it informs, it doesn't block")
**Keeps:** 0040's web merge, what `merge-ready` checks and `main-guard`; 0038's `pre-push` hook and deny rules; 0063's reviewers and their pass lines; 0046's stacks

## Context
Decision 0040 made `merge-ready` a commit status that informs and can't block. The repository was private on GitHub's free plan, and that plan enforces no required check there. PRs then merged while `merge-ready` was red. Some had no reviewer's pass, which was accepted at the time (0063). Others were red for a real reason: #195 merged without its own task row, and CC-115 (#199) had to restore it (CC-116). The repository is public now, and on a public repository a free ruleset can require a status. Asked on CC-116, the user answered on 2026-11-05 that `main` should require `merge-ready`.

## Decision
- **A ruleset on `main` requires `merge-ready`.** It is a repository ruleset named `main requires merge-ready`, targets the default branch, is enforced (`active`), and requires the status check `merge-ready` from GitHub Actions only (integration 15368). It also keeps the two rules GitHub's form ticks by default, Restrict deletions and Block force pushes. Neither touches a release: `release.mjs` pushes a fast-forward. Statuses that a token posts outside the workflow don't count, so `gh api …/statuses` run with the user's login can't turn it green. A PR into `main` can't be merged with the normal click until `merge-ready` is green at its head.
- **"Require branches to be up to date" is off.** Updating a branch makes a new head, and that head has no reviewer's pass yet. With the option on, every merge to `main` would turn every other open PR red.
- **Only `merge-ready` is required** (the user, 2026-11-06). The PR page still shows CI, and `release.mjs` refuses to release while CI on `main` is red.
- **The bypass actor is the Repository admin role, in mode `always`.** It lets `release.mjs` push its release commit to `main`; that commit comes from no PR, so it has no `merge-ready` status. Tags are outside the ruleset. The same bypass shows the user a "Merge without waiting for requirements to be met (bypass rules)" box on a red PR.
- **When no reviewer can run** (neither the `pr-reviewer` sub-agent nor Codex), the user first posts a comment on the PR, `Merged without review: <reason>`, then ticks the bypass box and merges (the user, 2026-11-06). The comment records what 0040 noted that nothing recorded. The bypass covers only a missing reviewer. When `merge-ready` is red for any other reason (format, unticked boxes, no `done` (#N)), the author fixes the PR first.
- **Only the status is named `merge-ready`.** The workflow job that computes it is renamed `compute merge-ready`. The job's check run is green whenever it posted a status, red or green. On #229, a green `merge-ready` check run and a red `merge-ready` status sat on the same head. A required check with that name would then have matched both.
- **Agents are not stopped by the ruleset.** They act through the user's admin account, so they inherit its bypass. The `pre-push` hook and Claude Code's deny rules (0038) stay the agents' guard: agents never merge, never tick the bypass and never change the ruleset. The user turns the ruleset on or changes it.
- **`main-guard` is unchanged.** A bypass merge is still a PR merge, and a release commit is a tagged release commit, so neither fails it.
- **Stacks:** a PR into another task's branch is outside the ruleset. Once it is retargeted to `main`, the `edited` event recomputes `merge-ready`, and the ruleset applies (0046).

## Consequences
- A PR with no reviewer's pass at its head, an unticked box or no `done` (#N) can no longer reach `main` by accident. The way around it is a deliberate tick, with a comment stating why.
- `release.mjs` doesn't change. Its push to `main` goes through the bypass, and `git push` prints that it bypassed the rule. If the push is refused, the ruleset is missing the bypass, and the user's fix is the ruleset, not `--no-verify` or a force push.
- If the repository turns private again on the free plan, GitHub stops enforcing the ruleset, and `merge-ready` only informs again, as under 0040.
- Built in CC-138: the job rename in `.github/workflows/merge-ready.yml`, AGENTS.md and docs/releasing.md. The user turns the ruleset on. Agents don't change repository settings.

## Evidence
- CC-116 in build/TASKS.md: the question and the user's answer of 2026-11-05.
- #229's head `e3752df`: check runs `merge-ready success` and `merge-ready cancelled` (app 15368), next to commit statuses `merge-ready failure` and then `success`, all from `github-actions[bot]`.
- GitHub docs on rulesets: required status checks, bypass actors and bypass modes; rulesets on public repositories are available on the free plan.
