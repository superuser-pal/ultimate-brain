# CC-371: the weekly row, its ticks and the schedule, blind on a synthetic brain

CC-371's acceptance (build/TASKS.md), decision 0110: on a synthetic brain with a simulated Notion, a weekly run writes a row within its caps with Already cleaned and its undo; an unattended catch-up applies a Ready row's two plain ticks and leaves the one with a note, which an attended catch-up then applies; setup asks the two slots, keeps a changed time and installs on a simulated macOS and Windows with either agent; the unattended catch-up eval still passes.

## Setup

- **The CLI and the skills.** A scratch clone of this branch (main's CLI after CC-369 and CC-370 merged), `package.json` at `0.17.0-0`, and the fork branch of ultimate-brain-skills #62 vendored into it with `vendor-skills.mjs --local`, so the brain ran the skills of the four 0.17.0 fork PRs' CC-371 part as they will ship. Installed by [install.sh](../acceptance-0.10.0/harness/install.sh) into an isolated prefix and `HOME`. After the first catch-up found the lint bug below, the clone took that fix and the installation was updated with it.
- **Sandboxes** from [prepare.sh](prepare.sh): the 0.10.0 studio fixture (synthetic names, 13 planted work findings) with its Notion stand-in (`notion-sim`, which holds page bodies as Markdown, to-dos included), dated 2026-11-21. `weekly`: three mechanical clean-up items planted and `publish: auto`. `setup-darwin` and `setup-win32`: setup done up to step 8, the scheduler simulated with `UB_SCHEDULE_PLATFORM` and a sandbox folder (cli.md §5.21: with the folder set, `launchctl` and PowerShell are never called).
- **The runs.** Each turn is a fresh `claude -p` on `claude-sonnet-5-5` (the schedule's default model) through [turn.sh](turn.sh), or `codex exec` through [codex-turn.sh](codex-turn.sh) without the user's Codex configuration; no MCP server in either, so no real Notion was reachable. Each read [RULES.md](RULES.md) first: `notion-sim` stands in for the Notion tools, and a question to the user ends the turn. The user's answers were typed by the building session. The user's Notion edits (ticks, a note, Ready) were made in the stand-in's state between runs. Every name, page id and line is synthetic; ids in the traces are replaced by `<id n>`.

## Runs

| Run ([runs/](runs/)) | The user says | What the trace shows |
|---|---|---|
| [w1](runs/w1.md) | `weekly review unattended` | `cleanup apply` cleaned the three planted items, each its own commit with its `Cleanup:` trailer ([commits](runs/weekly-brain-commits.txt)); one Inbox row Kind Weekly, `Week of 16 Nov 2026`, Brain Status New: In short, 6 Highlights (cap 6), Done this week, 2 Actions (cap 5), Focus first 3 lines (cap 3), Waiting for you, Already cleaned `U1`–`U3` each "tick to undo", For you to tick `C1`–`C5` (cap 10) each with Show the change and Your note; 7 pending proposals, `weekly` set on each A and C; nothing applied but the clean-up; reply opens `Weekly review 2026-W47: 2 actions and 5 clean-up items to tick, 3 cleaned, nothing waiting in the session; published.` 0.86 USD |
| (the user) | ticks A2, C1, C2 and U2, writes on C2's Your note "yes, and keep the name Quayside Books catalogue", sets the row Ready | [row-ticked-by-the-user.md](runs/row-ticked-by-the-user.md) |
| [c1-before-lint-fix](runs/c1-before-lint-fix.md) | `catch up unattended` | A2 and C1 applied, U2 undone, C2 waiting on its note; then `brain lint` refused the undone proposal and the run stopped before its commit, as the skill says. A CLI bug: fixed in this PR (below) |
| [c1](runs/c1.md) | `catch up unattended` (the same state, the fixed CLI) | A2 applied (the project Done in the brain and, through its `notion_writes`, in Notion), C1 applied, U2 undone; **C2 waits** ("you wrote a note on it … an unattended run doesn't act on your words"); the unticked items stay open, not declined, since C2 waits; the row stays Ready; one commit `catch-up: weekly ticks 2026-W47 (3 applied)` |
| [c2-1](runs/c2-1.md) | `catch up` | one batch: C2 with the note quoted and its reading, "approve the merge, and the surviving note is Quayside Books catalogue … (default: yes, with your words)"; says the unticked A1, C3, C4, C5 will be declined |
| [c2-2](runs/c2-2.md) | `go` | C2 applied with `brain apply` (`decided_by: chat`); the second `ticks` run declined A1, C3, C4, C5; U1 and U3 kept; the row published with `--row-state`, every tick and the note kept, **Brain Status Done** ([row-after-c2.md](runs/row-after-c2.md)); lint 0 errors |
| [u1](runs/u1.md) | `undo clean-up U3` | found U3's proposal in `_weekly/state.json`, `brain cleanup undo` restored the draft (`Undo clean-up: …`, `Cleanup-undo:` trailer), index committed; "Undone: … It won't be cleaned up alone again." |
| [s-mac-1](runs/s-mac-1.md) | `set up my brain` (macOS) | "Setup: 7 of 7 required items done. Next: the schedule"; one message with both slots and their defaults (weekly review Monday 08:00, catch-up daily 07:30), Claude Code with `claude-sonnet-5-5`, the 3 USD ceiling, the allow list offered once, the Mac line (on, asleep is fine, logged in) and "on this computer only" |
| [s-mac-2](runs/s-mac-2.md) | "Keep the weekly review as it is, but run the catch-up at 06:45 instead. Yes to the allow list." | `settings.schedule` = system, claude, `claude-sonnet-5-5`, catch-up 06:45, weekly Mon 08:00; two launchd plists (the weekly one with `--max-budget-usd 3`, the catch-up one without, as cli.md §5.21 refuses it there); `step=schedule result=done`; the trust line; the setup report's line `8 schedule: weekly review Mon 08:00 · catch-up 06:45 · Claude Code` ([setup-mac.txt](runs/setup-mac.txt)) |
| [s-win-1](runs/s-win-1.md) | `set up my brain` (Windows, in Codex) | the same single message, with Codex and the model it runs as, "no spending ceiling", and the Windows line (woken for these times, logged in) |
| [s-win-2](runs/s-win-2.md) | "Keep the catch-up, but move the weekly review to Friday at 17:00." | before the stand-ins for `codex.cmd` and `brain.cmd` existed: `AGENT_NOT_FOUND`, "Install Codex and sign in, then say "set up my brain" to retry"; nothing installed |
| [s-win-3](runs/s-win-3.md) | "I've installed Codex and signed in. Set up my brain." | `settings.schedule` = system, codex, catch-up 07:30, weekly **Fri 17:00** (the changed slot kept); two Task Scheduler XML files with `InteractiveToken`, `WakeToRun` and `StartWhenAvailable`, no `--max-budget-usd`; `step=schedule result=done`; report line `8 schedule: weekly review Fri 17:00 · catch-up 07:30 · Codex` ([setup-win.txt](runs/setup-win.txt)) |

Cost of the Claude Code turns: 3.95 USD. No entry was written to `~/Library/LaunchAgents` or loaded into launchd: every scheduler file is in a sandbox folder.

## eval/unattended-0.7.0, rerun with these skills

`run.sh noop noop-connected budget` on the same CLI and skills ([runs/unattended-0.7.0/](runs/unattended-0.7.0/)): **noop** and **noop-connected** commit nothing, log nothing and write nothing to Notion (`writes.md` empty); **budget** ingests the 10 oldest of 12 drop-folder notes, leaves 2 and logs `inputs=10 left=2`; `run.sh` exited 0. **Skipped:** `mixed-on`, `mixed-reports-off`, `mixed-ask`, `requests` and the attended follow-up. Their setup fails on main before any run (`proposal new` now requires `passages`), and they are built on the Review and Decisions databases that 0.16.0 removed (decisions 0096, 0099). So they no longer test the product. The coordinator is planning that stale eval separately.

## Found, and what changed

| Found | Change |
|---|---|
| c1: undoing a ticked `U` (and `brain cleanup undo`) closes the proposal with `closed_reason: undone`, `approve`, `decided_by: cleanup`, as schema §11 says, but `brain lint`'s `proposal-status` rule didn't know `undone` and errored, so every undo stopped its run | CLI fix in this PR: `proposalStatusProblem` accepts `undone` with `approve` by `cleanup` and nothing else; test `lint accepts a clean-up proposal closed as undone, approved by cleanup, and no other (schema §11)` fails without it |
| c1: a Ready row whose noted item still waits renders no item, and the skill didn't say that was expected | weekly-ticks.md, step 4.1.1c: no item means nothing to write; the row stays Ready (fork a062fdc) |
| c2-1: the attended catch-up's opening line listed ticks the scheduled run had already applied | weekly-ticks.md, step 1.13: the line names only the ticks not done yet and what will be declined (fork 34028d4) |
| u1: the skill didn't say what an undo in a session leaves in Notion | weekly-ticks.md, "Undo a clean-up": nothing is written in Notion (fork 7a2c52d, b2bc25c) |
| w1: a `C` item from a `notion_change` on a relation shows the raw page id (`Set project of … to ["<id>"]`), though its proposal's title reads "Project → Half marathon training" | CLI rendering in `weekly record`; not a skill change. The coordinator opens a separate 0.17.0 task |
| s-win-2: Codex reported `AGENT_NOT_FOUND` but didn't log `step=schedule result=failed reason=AGENT_NOT_FOUND`, which first-value.md step 8 asks | none: the text says it; recorded as a miss by the run |
| every run: `notion-sim`'s query answers aren't in the shape `brain sync snapshot` takes (no `object`, flat property values), so the runs rewrote them | the stand-in's limit, not the product's; a real Notion MCP answer has that shape |

## Not run here

- The live Notion checks (a real Weekly row ticked in Notion and read back through the MCP): the author's, after release.
- A real launchd load and a real Windows Task Scheduler registration: U-43 runs `install` on a standard Windows account.
- `vendor-skills.mjs --check --online` on the tagged release: once #59 to #62 are merged and the author says yes to the tag.
