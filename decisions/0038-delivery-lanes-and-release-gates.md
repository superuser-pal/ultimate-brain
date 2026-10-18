# 0038 — Delivery lanes, one channel and release gates

**Status:** Accepted
**Date:** 2026-10-18

## Context
The user builds the product with two agents and uses it every day in their own brain. An audit on 2026-10-18, after 0.2.1, found the delivery process leaking:
- **Two versions in one brain.** Codex in the brain read the 0.2.1 skills from `.agents/skills/`, copied in by `brain upgrade`. Claude Code read the `ultimate-brain` plugin, still cached at commit `7dddf45` (2026-10-12) because `plugin.json` says `0.0.0` and never changes. 13 skill files differed, and `brain-howto` was missing. Nothing reported it.
- **No enforced merge gate.** CI ran, but the product repo is private on the free plan, so branch protection was off.
- **Findings went into TASKS.md by hand**, under whichever task was running (CC-15 held 24). A quick fix inside the brain's own copy of a skill would have been erased by the next upgrade, and the product would never have learned of it.
- **The brain was not pushed.** It sat 5 to 11 commits ahead of its private origin.
- **Releases were run by hand** from any checkout, with no changelog, and nothing checked that a release's tasks were finished.
- **Nothing checked for personal data** in the product repo, which decision 0014 forbids.

The fixes were agreed with the user in a grill session on 2026-10-18.

## Decision

### Lanes
Every change belongs to exactly one lane:

| Lane | What | Where it is made |
|---|---|---|
| Product | skills, CLI, spec, template, docs | `ultimate-brain`, on a task branch, through a PR |
| Personal | notes, the "My rules" section, `brain.json` | the user's brain |
| Finding | something in the brain is wrong because of the product | recorded as an issue, then fixed in the product |

- **Product-owned files in a brain are read-only**: the fenced AGENTS.md block, `.agents/skills/`, `.claude/skills/` (for the skills the package ships). The brain AGENTS.md block says so. `brain lint` reports any of them that differs from the installed package (rule `product-file`, error).
- **A finding is a GitHub issue** in `ultimate-brain`, label `dogfood`, filed from the brain session with `gh issue create`. It describes the problem as it would appear in a synthetic brain: never client text, names or note content. The issue template asks for this.
- **Triage:** Claude Code reads the open `dogfood` issues at the start of every planning session. Each one becomes a CC or CX task in build/TASKS.md (the issue is closed with "→ CX-27, release 0.3.0"), or is closed as won't-fix or parked in docs/v2-ideas.md, with the reason. An issue never stays open next to its task. The TASKS.md banner shows the count of untriaged issues.

### One delivery channel
- **npm is the only channel.** `brain upgrade` (and `brain init`) write the shipped skills into both `.agents/skills/` (Codex) and `.claude/skills/` (Claude Code), so one committed version serves both agents. `brain link` does the same for `brain-query`.
- **The Claude Code plugin is retired** (this amends 0029, "Claude Code keeps using the plugin"). `brain upgrade` removes the `ultimate-brain` entries from the brain's `.claude/settings.json` (`enabledPlugins`, `extraKnownMarketplaces`), so the old plugin can't load next to the new copies. `.claude-plugin/` leaves the product repo.
- **A brain runs only published versions.** `brain upgrade` refuses a CLI run from a source checkout (`UNRELEASED_BUILD`). A candidate is tried as a prerelease, `x.y.z-rc.N` on the npm tag `next`; `npm install -g ultimate-brain@latest` goes back.

### Gates
- **Main is always releasable.** A merge means done and tested; no half feature waits for a follow-up PR. A fix the user needs mid-use is an `urgent` task, shipped as a patch release the same day.
- **Merge, without paid branch protection** (GitHub Pro is deferred; on a private free repo GitHub enforces nothing):
  - **Merge only with `scripts/merge.mjs <PR>`.** It refuses unless CI passed on the PR's head commit, every box in the PR body is ticked, the branch and title follow the format below, and the PR is mergeable; then it runs `gh pr merge --merge --match-head-commit <sha>`, so a commit pushed after the check can't slip in.
  - **Agents can't skip it.** The `pre-push` hook is the enforcement: it refuses any push to `main`, in any form, except from `release.mjs`. On top of it, the product repo's `.claude/settings.json` denies Claude Code `gh pr merge`, the common ways to name `main` in a push, `--no-verify`, force pushes and changes to `core.hooksPath`. Command patterns can't cover every spelling, so they are a first line, not the gate. AGENTS.md states the rules for Codex.
  - **A bypass is caught.** A CI job on every push to `main` checks that each new commit came from a merged PR or is a release commit (`x.y.z`, tagged); otherwise it fails and opens an issue labelled `main-guard`.
  - GitHub Pro later adds prevention on the server; the script and the guard stay.
- **PR format:** A PR template asks for the task id, release, cited decisions, acceptance boxes and the leak check. A CI check fails unless the branch is `(claude|codex)/<ID>-…`, the title starts with the task id, and `CHANGELOG.md` has a line for it. The other agent ticks every acceptance box with evidence (a test name, a command and its output); the user merges with `merge.mjs`.
- **Leak check:** CI fails on a Notion id (a UUID, dashed or not) outside `tests/`, and on an email address whose domain is not `example` or ends in `.example` (the fixtures' convention), with a short committed allowlist for exceptions. Note ids are not checked: the spec and skills are full of synthetic ones, and an id says nothing without its note. A local pre-commit hook also checks a private denylist (client, project and personal names) kept at `~/.config/ultimate-brain/denylist`, outside every repo.
- **Release:** a task carries `**Release:** x.y.z`. `scripts/release.mjs <version>` refuses unless: it runs in the main checkout on `main`, clean and level with origin; CI is green on that commit; `CHANGELOG.md` has the version's entry; `npm test`, `npm run typecheck` and `npm run test:package` pass; and every task with that release is `done`. Only then it bumps, publishes, tags and pushes.
- **Worktrees:** the main checkout stays on a clean `main` and is used only to release. Every task, for both agents, works in `../ub-<ID>`; `scripts/task.mjs start <ID>` creates it (branch, `npm ci`) and `task.mjs done <ID>` removes it after its PR merges.

### The brain is always pushed
- `brain upgrade` refuses a brain with uncommitted changes (`BRAIN_DIRTY`), then writes, runs lint, commits `upgrade: ultimate brain <version>` and pushes.
- Every skill that commits pushes after its last commit. A failed push (offline, no remote) is one line in the report, never a stop: the work is committed either way.
- This amends 0037's `push: remind | auto` setting (0.3.0): the default becomes `auto`.

## Consequences
- **One 0.2.3 release carries all of it** (CC-24, CX-27 to CX-29), right after 0.2.2 and before any 0.3.0 work, because the stale plugin is wrong today.
- **Until 0.2.3, the user runs `/plugin update ultimate-brain`** in the brain as a stopgap.
- **Rollback of a bad upgrade:** `npm install -g ultimate-brain@<previous>`, then `git revert` the upgrade commit.
- **Release ids are machine-read**, so a task without `**Release:**` is not in any release.
- **The merge gate is local, plus detection on the server.** Without GitHub Pro a push to `main` can't be prevented on the server. The hook, the deny rules and `merge.mjs` make a bypass take deliberate effort, and `main-guard` reports one within minutes.
- **Findings need access to the product repo.** While it is private only its author can file them; this is revisited before the product has other users.

## Evidence
Audit of 2026-10-18: `~/.claude/plugins/installed_plugins.json` (ultimate-brain 0.0.0 at `7dddf45`), `diff -rq` of the plugin cache against `skills/`, `gh api …/branches/main/protection` (403, needs Pro), the brain's `git status` (ahead of origin). Decisions 0014, 0029, 0037.
