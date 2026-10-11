# 0009 — Memory scope levels

**Status:** Accepted
**Date:** 2026-10-11

## Decision
Every agent memory declares its reach when written:

| Scope | Reaches | Example |
|---|---|---|
| `general` | All repos | "Prefer pnpm", "never auto-commit" |
| `area` (`areas: [...]`) | All repos belonging to that PARA area | "Consulting: invoices in EUR" |
| `project` (`projects: [...]`) | Only repos of the listed projects (clients are projects within areas) | "Acme: Spanish copy; acme-api prod DB is shared" |
| `stack` (`stacks: [...]`) | All repos using that technology | "Supabase: test RLS with the anon key" |

- Visibility: general → listed project → listed area → stack overlap → otherwise hidden (default deny). A reader never widens what the writer declared.
- Ranking: superseded below live, then project > area > stack > general, then newest first.
- Repo identity: the setup command (0006) writes a `.brain` marker in each consuming repo with its `project`, `area` and `stacks`. A project may span several repos.

## Evidence
reviews/03-obsidian-mind.md (scope `general/platform/project`, default-deny recall, `.om-project` identity file).
