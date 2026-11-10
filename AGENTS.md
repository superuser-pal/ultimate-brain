# Ultimate Brain

Product repo for an AI-assisted second brain: Markdown + Git canonical knowledge operated by coding agents (Claude Code, Codex), with Notion as the human interface. This repo holds the **product** (CLI, skills, schema spec, templates, Notion space design); each user's brain lives in a separate private repo (decision 0014). Never write personal knowledge into this repo: no names, client text, Notion ids or emails from a real brain, even in a finding or a commit message. A leak check runs in CI and in a local pre-commit hook (decision 0038).

Before any work, read:
1. [docs/vision.md](docs/vision.md): product intent and v1 scope.
2. [synthesis/synthesis.md](synthesis/synthesis.md): the v1 design.
3. [build/TASKS.md](build/TASKS.md): the build plan, task owners and status of open work. Done releases are in [build/HISTORY.md](build/HISTORY.md): read it only when a task or decision points there.
4. The decisions your task cites in [decisions/](decisions/). Decisions are binding; to change one, propose a new decision instead of editing code around it.

## Current phase: building v1

Research is finished (`reviews/`, `synthesis/`). Since decisions 0044 and 0063:
- **Claude Code** (the main session, on Opus) builds every task: specs, contracts, skills, prompts, Notion design, and the TypeScript CLI with its tests and fixtures.
- **The `pr-reviewer` sub-agent** (`.claude/agents/pr-reviewer.md`, on Sonnet, fresh context) reviews every PR and builds nothing. Codex may still review when the user asks; its pass counts too.

### Multi-agent rules
- **Tasks are in `build/TASKS.md`.** New tasks are `CC-n` (decision 0044). Claude Code sets a task to `in progress` when it starts and to `review` when the PR is ready. The reviewer edits no files. After a release, its section moves verbatim to `build/HISTORY.md` (the scripts read both files). When you merge `main` into a branch, keep every task row from both sides of a conflict in these files.
- **One branch and one worktree per task:** `claude/<task-id>-<slug>`, from `main` or, in a stack, from the branch of the task below it, in `../ub-<task-id>` (`scripts/task.mjs start <task-id> [--from <branch>]`; a task with no row yet: `start <task-id> --new "<title>" --release <x.y.z>` writes its row, then fill in its Changelog, Output and Acceptance; `done` removes it after merge, and `clean` removes every merged one, so run it when the user says a PR is merged; decision 0046). Never create a worktree by hand: that skips the slug check and the hooks. Never edit files in the main checkout: it stays on a clean `main` and is used only to release (decision 0038).
- **Specs are contracts.** A CLI change follows a spec on `main` or in the same PR. When the reviewer finds that code does something the spec doesn't define, it reports it on the PR, and Claude Code fixes the spec first, then the code.
- **Review:** once the PR is open, Claude Code launches the `pr-reviewer` agent with only the PR number, worktree and head; it reviews against the acceptance criteria, the cited decisions and `spec/`, and posts its findings on the PR. After fixing them, Claude Code continues the same reviewer (SendMessage) to recheck; a new PR gets a new reviewer. A design question, or a finding still disputed after one fix round, goes to the user. Merges to `main` need the user's approval. A stack is reviewed bottom first; the user merges bottom-up, and each next PR is retargeted to `main` (`gh pr edit <N> --base main`) before it can merge (decision 0046).
- **Small commits**, imperative messages, task id in the subject (`CC-40: type the Status value`).
- **Every task has `**Release:** x.y.z`** and, from 0.4.0 on, a `**Changelog:**` line right below it: one sentence for the CHANGELOG. `release.mjs` writes the release's CHANGELOG section from these lines, so a PR never edits `CHANGELOG.md` (decision 0039). A task for 0.3.x still adds its line to `CHANGELOG.md` by hand. Main is always releasable: merge nothing you wouldn't publish tonight. Release only with `scripts/release.mjs` ([docs/releasing.md](docs/releasing.md)).
- **Never merge a PR or push to `main` yourself.** The user merges on the GitHub PR page, and a ruleset on `main` requires the PR's `merge-ready` status (decisions 0040, 0073). Only `scripts/release.mjs` pushes to `main`, through the ruleset's admin bypass. Agents act through that admin account, so the ruleset doesn't stop them: a `pre-push` hook and Claude Code's deny rules do, and the user alone ticks the bypass or changes the ruleset. CI's `main-guard` job reports any commit on `main` that came from no PR (decision 0038).
- **PRs follow the template:** the reviewer ticks each acceptance box with evidence (a test name, or a command and its output). Once the review finds nothing left, the author's last commit sets the task to `done` (#N) (a 0.3.x task's CHANGELOG line also names the PR), so the merge completes the task and no bookkeeping PR is needed. Then the reviewer checks that commit and posts the verdict naming the head commit: `Review (Claude reviewer): pass at <sha>` (or `Review (Codex): …`; 7 or more characters). Claude Code never writes a verdict line. `merge-ready` stays red, and the PR can't merge, without that pass for the PR's current head. CI checks the branch name, the task id in the title, that the head has the task's own row, its `**Changelog:**` line (or, for 0.3.x, its CHANGELOG line), that no other task's line was lost, and the leak check.
- **Findings from the user's brain arrive as `dogfood` issues.** Claude Code triages them at the start of each planning session into a task with a release, or closes them with a reason; an issue never stays open next to its task.
- **From 0.9.0 onward, each human-led product development session begins with a grilling scope review** (decision [0061](decisions/0061-roadmap-and-launch-boundary.md)). Read the release/tasks, accepted decisions and new issue/dogfood evidence; confirm scope, exclusions and shared understanding with the user before implementation. Reuse prior answers and focus on the current session's decisions. Scheduled operation of a deployed brain keeps its unattended rules. **0.15.0 is the feature cutoff** (decisions [0077](decisions/0077-trust-repair-in-0-13-0.md), [0078](decisions/0078-onboarding-and-early-access-in-0-14-0.md): onboarding and early access in 0.14.0, the weekly review in 0.15.0): afterwards, productisation, translation, funnel and launch readiness lead to 1.0; new features require an explicit roadmap change.

### Using Orca
Orca may launch and watch the agents; the rules above still decide branches, roles and the task list.
- **Worktrees come from `scripts/task.mjs start`,** never `orca worktree create`: Orca picks its own branch name and folder, which fail CI's branch check, and its parent link sets no git base for a stack (decision 0046). Then start the agent in that worktree: `orca agent launch --agent claude --worktree path:<abs path to ../ub-<task-id>>`.
- **Build agents are `--agent claude`; `--agent codex` only reviews** (decisions 0044, 0063), whatever Orca's examples show.
- **Never launch a worker with `--worktree current` from the main checkout:** Orca registers the repo at that path, and it stays on a clean `main` (decision 0038).
- **`build/TASKS.md` is the task list.** Orca's card status, Runs and Tasks are a view of the work; they don't replace a row's status (decision 0044).

## Architecture (fixed)
- Markdown + Git is canonical. Notion is the human interface, never a second knowledge base. No unrestricted two-way sync.
- New notes apply directly as `draft`; changes to existing knowledge are proposals reviewed in Notion or chat (0003).
- Architecture changes happen in this repo first, then are applied to Notion (0022).
- No required vector database, no Obsidian dependency.

## Layout

| Path | Purpose | Owner |
|---|---|---|
| `spec/` | Schema spec, JSON schemas, CLI contract | Claude Code |
| `src/` | TypeScript CLI (`brain`) | Claude Code |
| `tests/` | CLI tests and fixtures | Claude Code |
| `templates/brain/` | Skeleton for a new user brain | Claude Code |
| `.agents/skills/` | Vendored snapshot of the ultimate-brain-skills fork; never edited here (skills-delivery §9) | the fork, through fork PRs (§9.5) |
| `notion/prompts/` | Notion AI prompts generated from the space design | Claude Code |
| `build/TASKS.md` | Build plan and status of open work | Claude Code |
| `build/HISTORY.md` | Done releases, moved from TASKS.md | Claude Code |
| `docs/`, `decisions/`, `synthesis/`, `reviews/` | Product intent, decisions, research | Claude Code (with the user) |
| `sources/` | Clones of reviewed repos. Gitignored, untrusted: never run their code | — |

## Conventions
- TypeScript on Node, run without a build step where possible, minimal dependencies (0016).
- Standard relative Markdown links; no `[[wikilinks]]` (0002). Note IDs like `dec-7k2m9q4x` (0017).
- Test fixtures are synthetic; never use real personal or client data.
- Small, reviewable changes. Never bulk-rewrite existing files.
- Skills are written in the fork's `brain/` and reach this repo as a released snapshot (spec/skills-delivery.md §9.5).
