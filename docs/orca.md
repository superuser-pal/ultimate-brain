# Using Orca

Orca may launch and watch the agents. The rules in [AGENTS.md](../AGENTS.md) still decide branches, roles and the task list; these add what is specific to Orca.

- **Worktrees come from `scripts/task.mjs start`,** never `orca worktree create`: Orca picks its own branch name and folder, which fail CI's branch check, and its parent link sets no git base for a stack (decision 0046). Then start the agent in that worktree: `orca agent launch --agent claude --worktree path:<abs path to ../ub-<task-id>>`.
- **Build agents are `--agent claude`; `--agent codex` only reviews** (decisions 0044, 0063), whatever Orca's examples show.
- **Never launch a worker with `--worktree current` from the main checkout:** Orca registers the repo at that path, and it stays on a clean `main` (decision 0038).
- **`build/TASKS.md` is the task list.** Orca's card status, Runs and Tasks are a view of the work; they don't replace a row's status (decision 0044).
- **Wait on a worker or a PR through its notification,** or with Monitor. A `sleep` followed by a poll is blocked in Claude Code.
