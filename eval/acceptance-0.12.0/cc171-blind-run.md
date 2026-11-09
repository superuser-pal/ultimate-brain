# CC-171 blind run: the closing review in brain-query

Synthetic setup:
- a brain made with `brain init`, with `settings.recall` set to `opening`;
- one area;
- a linked repo `orbit-api` with a link kit and `build/TASKS.md` (T-1 `in progress` with a `**Stopped:**` line, and T-2 `todo`).

The CLI and skills are this branch's, through a local snapshot of fork branch `claude/CC-171-closing-review-and-recall-in-brain-query` at 6888fb7. A fresh agent, given only the repo's AGENTS.md and the vendored `brain-query` skill, played a scripted session:
- continue T-1;
- "remember this: every date is stored in UTC";
- "wrap up";
- answer yes to the UTC lesson and no to the rest.

## Result (run 1, 2026-11-08)

| Check | Result |
|---|---|
| Opening pack read; picked up from T-1's stopped line | yes |
| One approved memory written `reviewed`, `sources: [agent:brain-query/…]`, through `proposal new` + `apply` in chat, committed `memory: …` in the brain | yes |
| The declined (inferred) candidate wrote nothing | yes |
| One `**Stopped:**` line replaced under T-1 | yes |
| The next pack includes the new memory | yes |

## What the run found, fixed in fork commit 3792e7f

| Run 1 problem | Fix in `references/memory.md` |
|---|---|
| The repo had no project, so "project" reach couldn't be saved, and the agent widened it to `general`. The reach shown at "remember this" also differed from the one at wrap-up | Reach comes from the pack's `caller`, and is decided before it is shown. A reach with no id is asked about, never widened (memory.md §3.2) |
| `apply`'s input wasn't documented | the `{ "decisions": [ … decided_at … ] }` example |
| `log/` was left uncommitted | `add -A memories _proposals log` |
| The stopped line was cut at 300 characters without warning | the limit is stated |
| No remote: `gh pr list` failed, and the push couldn't happen | both are conditional, and "not pushed: the brain has no remote" |
| Committing the stopped line wasn't covered | "commit it as the repo's rules say; the pack reads the working tree" |

Nothing from a real brain is used; every name is synthetic.
