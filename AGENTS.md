# Ultimate Brain

Product repo for an AI-assisted second brain: Markdown + Git canonical knowledge operated by coding agents (Claude Code, Codex), with Notion as the human interface. This repo holds the **product** (CLI, skills, schema spec, templates, Notion space design); each user's brain lives in a separate private repo (decision 0014). Never write personal knowledge into this repo: no names, client text, Notion ids or emails from a real brain, even in a finding or a commit message. A leak check runs in CI and in a local pre-commit hook (decision 0038).

Before any work, read:
1. [docs/vision.md](docs/vision.md): product intent and v1 scope.
2. [synthesis/synthesis.md](synthesis/synthesis.md): the v1 design.
3. [build/TASKS.md](build/TASKS.md): the build plan, task owners and status.
4. The decisions your task cites in [decisions/](decisions/). Decisions are binding; to change one, propose a new decision instead of editing code around it.

## Current phase: building v1

Research is finished (`reviews/`, `synthesis/`). Two agents build in parallel:
- **Claude Code** owns specs, contracts, skills, prompts and Notion design.
- **Codex** owns the TypeScript CLI, its tests and fixtures.

### Multi-agent rules
- **Work only on tasks assigned to you in `build/TASKS.md`.** Set your task to `in progress` when you start and `review` when done; never edit another agent's open task files.
- **One branch and one worktree per task:** `claude/<task-id>-<slug>` or `codex/<task-id>-<slug>`, from `main`, in `../ub-<task-id>` (`scripts/task.mjs start <task-id>`; `done` removes it after merge). Never edit files in the main checkout: it stays on a clean `main` and is used only to release (decision 0038).
- **Specs are contracts.** `spec/` is owned by Claude Code. If a spec is wrong or missing something, Codex writes the problem under "Spec questions" in the task and does not invent behavior. Claude Code answers by updating the spec.
- **Cross-review:** every task is reviewed by the other agent before merge, against its acceptance criteria and cited decisions. Merges to `main` need the user's approval.
- **Small commits**, imperative messages, task id in the subject (`CX-02: add ID generator`).
- **Every task has `**Release:** x.y.z`** and a line in `CHANGELOG.md` under that release. Main is always releasable: merge nothing you wouldn't publish tonight. Release only with `scripts/release.mjs` ([docs/releasing.md](docs/releasing.md)).
- **PRs follow the template:** the reviewer ticks each acceptance box with evidence (a test name, or a command and its output). CI checks the branch name, the task id in the title, the CHANGELOG line and the leak check.
- **Findings from the user's brain arrive as `dogfood` issues.** Claude Code triages them at the start of each planning session into a task with a release, or closes them with a reason; an issue never stays open next to its task.

## Architecture (fixed)
- Markdown + Git is canonical. Notion is the human interface, never a second knowledge base. No unrestricted two-way sync.
- New notes apply directly as `draft`; changes to existing knowledge are proposals reviewed in Notion or chat (0003).
- Architecture changes happen in this repo first, then are applied to Notion (0022).
- No required vector database, no Obsidian dependency.

## Layout

| Path | Purpose | Owner |
|---|---|---|
| `spec/` | Schema spec, JSON schemas, CLI contract | Claude Code |
| `src/` | TypeScript CLI (`brain`) | Codex |
| `tests/` | CLI tests and fixtures | Codex |
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
