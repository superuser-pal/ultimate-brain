# 0063 — A Claude sub-agent reviews, Codex optional

**Status:** Accepted
**Date:** 2026-11-03
**Amends:** 0044 (who reviews), 0040 and 0038 (whose pass `merge-ready` accepts), 0046 (who reviews a stack)

## Context
Decision 0044 made Codex the reviewer of every PR. In 0.8.0 that loop was slow: each round waited for the user to start Codex, relay "Codex has posted", and ask for a re-review, and Codex ran out of credits for the week on 2026-11-02. From then on Claude Code launched fresh-context sub-agents as independent reviewers (PRs #170 to #174). Their findings were real and were fixed, but `merge-ready` did not recognise them, so every PR merged with the user's override while `merge-ready` stayed red for that reason alone. Other red reasons went unseen: five task rows merged still saying `review` and needed a bookkeeping PR (#175, CC-90). The user moved to a Claude Max plan on 2026-11-03 and asked for the smallest change that keeps Claude Code building and lets it review through sub-agents on a lower-tier model.

## Decision
- **Builder:** the main Claude Code session, on Opus (`"model": "opus"` in `.claude/settings.json`). It still builds every task (0044).
- **Reviewer:** the `pr-reviewer` sub-agent (`.claude/agents/pr-reviewer.md`), on Sonnet, with fresh context. The builder launches it once the PR is open, with only the PR number, worktree and head; its method and checks are fixed in the agent file, so the builder cannot steer the verdict. After a fix round the builder continues the same reviewer (SendMessage), so it rechecks without reading everything again. A stack (0046) gets one reviewer that works bottom first, in place of the one Codex session; an unrelated PR gets a new reviewer.
- **Verdict:** the reviewer posts its findings, and in the end `Review (Claude reviewer): pass at <sha>`, on the PR itself. `merge-ready` and `merge.mjs` accept it on a `claude/` PR, as they accept Codex's. The builder never writes a verdict line; `Review (Claude Code): pass` on a `claude/` PR still counts for nothing.
- **Order (unchanged, CC-27):** findings fixed → the builder's last commit sets the row to `` `done` (#N) `` → the reviewer checks that commit and posts the pass naming the head → the user merges with `merge-ready` green.
- **The user decides** what reviewer and builder disagree on after one fix round, and any design question. The reviewer reports it; neither side settles it.
- **Codex is optional.** When it has credits, the user may still ask Codex to review, for example a high-risk PR; its pass counts as before. The user may also ask for an Opus reviewer for one PR (`model` on the Agent call).

## Consequences
- The review loop runs inside the building session; the user is needed for decisions and the merge, not to relay messages.
- The reviewer is a different model with no shared context, but the same product family as the builder. That is weaker independence than a second vendor; the fixed agent file, the reproduce-before-reporting rule and the user's merge are what keep it honest.
- **Who posted a verdict is a convention, not a check.** Builder and reviewer post through the same GitHub account (the operational assumption of CC-85), so `merge-ready` sees only the first line's text; a pass typed by the builder would look the same. The same held for Codex and Claude Code before. The reviewer's read-only rule also rests on its instructions: it has Bash, and the deny rules in `.claude/settings.json` block only merges and pushes to `main`.
- `--reviewed-by-user` stays for exceptions; it is no longer the normal way to merge.
- `AGENTS.md`, the PR template, `build/TASKS.md` and the `merge-ready` workflow comment say "the reviewer" instead of "Codex".

## Evidence
- PRs #170 to #174 (sub-agent reviews, override merges), #175 (CC-90, rows closed afterwards).
- `scripts/common.mjs` `reviewersFor`, tests in `tests/release-scripts.test.mjs`.
