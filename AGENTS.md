# Ultimate Brain

Product repo for an AI-assisted second brain: Markdown + Git canonical knowledge operated by coding agents (Claude Code, Codex), with Notion as the human interface. This repo holds the **product** (CLI, skills, schema spec, templates, Notion space design); each user's brain lives in a separate private repo (decision 0014). Never write personal knowledge into this repo: no names, client text, Notion ids or emails from a real brain, even in a finding or a commit message. A leak check runs in CI and in a local pre-commit hook (decision 0038).

Before any work, read:
1. [docs/vision.md](docs/vision.md): product intent and v1 scope.
2. [synthesis/synthesis.md](synthesis/synthesis.md): the v1 design.
3. [build/TASKS.md](build/TASKS.md): the build plan, task owners and status.
4. The decisions your task cites in [decisions/](decisions/). Decisions are binding; to change one, propose a new decision instead of editing code around it.

## Current phase: building v1

Research is finished (`reviews/`, `synthesis/`). Since decision 0044:
- **Claude Code** builds every task: specs, contracts, skills, prompts, Notion design, and the TypeScript CLI with its tests and fixtures.
- **Codex** reviews every PR and builds nothing.

### Multi-agent rules
- **Tasks are in `build/TASKS.md`.** New tasks are `CC-n` (decision 0044). Claude Code sets a task to `in progress` when it starts and to `review` when the PR is ready. Codex edits no task files.
- **One branch and one worktree per task:** `claude/<task-id>-<slug>`, from `main` or, in a stack, from the branch of the task below it, in `../ub-<task-id>` (`scripts/task.mjs start <task-id> [--from <branch>]`; `done` removes it after merge; decision 0046). Never edit files in the main checkout: it stays on a clean `main` and is used only to release (decision 0038).
- **Specs are contracts.** A CLI change follows a spec on `main` or in the same PR. When Codex finds that code does something the spec doesn't define, it reports it on the PR, and Claude Code fixes the spec first, then the code.
- **Review:** Codex reviews every PR before merge, against its acceptance criteria, the cited decisions and `spec/`. Merges to `main` need the user's approval. Codex reviews a stack of PRs in one session, bottom first; the user merges bottom-up, and each next PR is retargeted to `main` (`gh pr edit <N> --base main`) before it can merge (decision 0046).
- **Small commits**, imperative messages, task id in the subject (`CC-40: type the Status value`).
- **Every task has `**Release:** x.y.z`** and, from 0.4.0 on, a `**Changelog:**` line right below it: one sentence for the CHANGELOG. `release.mjs` writes the release's CHANGELOG section from these lines, so a PR never edits `CHANGELOG.md` (decision 0039). A task for 0.3.x still adds its line to `CHANGELOG.md` by hand. Main is always releasable: merge nothing you wouldn't publish tonight. Release only with `scripts/release.mjs` ([docs/releasing.md](docs/releasing.md)).
- **Never merge a PR or push to `main` yourself.** The user merges on the GitHub PR page, with the PR's `merge-ready` status in view (decision 0040); only `scripts/release.mjs` pushes to `main`. A `pre-push` hook and Claude Code's deny rules enforce it, and CI's `main-guard` job reports any commit on `main` that came from no PR (decision 0038).
- **PRs follow the template:** the reviewer ticks each acceptance box with evidence (a test name, or a command and its output). Once the review finds nothing left, the author's last commit sets the task to `done` (#N) (a 0.3.x task's CHANGELOG line also names the PR), so the merge completes the task and no bookkeeping PR is needed. Then Codex checks that commit and posts the verdict naming the head commit: `Review (Codex): pass at <sha>` (7 or more characters). `merge-ready` stays red without that pass for the PR's current head. CI checks the branch name, the task id in the title, the task's `**Changelog:**` line (or, for 0.3.x, its CHANGELOG line), that no other task's line was lost, and the leak check.
- **Findings from the user's brain arrive as `dogfood` issues.** Claude Code triages them at the start of each planning session into a task with a release, or closes them with a reason; an issue never stays open next to its task.

### Using Orca
Orca may launch and watch the agents; the rules above still decide branches, roles and the task list.
- **Worktrees come from `scripts/task.mjs start`,** never `orca worktree create`: Orca picks its own branch name and folder, which fail CI's branch check, and its parent link sets no git base for a stack (decision 0046). Then start the agent in that worktree: `orca agent launch --agent claude --worktree path:<abs path to ../ub-<task-id>>`.
- **Build agents are `--agent claude`; `--agent codex` only reviews** (decision 0044), whatever Orca's examples show.
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
| `skills/` | Agent skills (one source for Claude Code and Codex) | Claude Code |
| `notion/prompts/` | Notion AI prompts generated from the space design | Claude Code |
| `build/TASKS.md` | Build plan and status | Both (own tasks only) |
| `docs/`, `decisions/`, `synthesis/`, `reviews/` | Product intent, decisions, research | Claude Code (with the user) |
| `sources/` | Clones of reviewed repos. Gitignored, untrusted: never run their code | — |

## Conventions
- TypeScript on Node, run without a build step where possible, minimal dependencies (0016).
- Standard relative Markdown links; no `[[wikilinks]]` (0002). Note IDs like `dec-7k2m9q4x` (0017).
- Test fixtures are synthetic; never use real personal or client data.
- Small, reviewable changes. Never bulk-rewrite existing files.
