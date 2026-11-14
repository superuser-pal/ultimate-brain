# CC-255 blind runs: the `brain-weekly-review` skill

The acceptance of CC-255 (build/TASKS.md): a blind run on a synthetic brain with a Notion stand-in, attended and unattended (`claude -p`, the weekly job's allow list), writes one report within weekly-review.md §5's limits, applies nothing and changes no Notion-owned field; a quiet run writes nothing; the Reports offer is asked once, with the yes and no paths; no schedule is installed on the machine.

## Setup

- **The CLI and the skills:** a scratch clone of this branch with `package.json` at `0.15.0-0` and the fork branch `claude/CC-255-brain-weekly-review` vendored with `vendor-skills.mjs --local` (fork commit 269525e), installed by [eval/acceptance-0.10.0/harness/install.sh](../acceptance-0.10.0/harness/install.sh) into an isolated prefix and `HOME`.
- **Four sandboxes** from [make-sandbox.sh](../acceptance-0.10.0/harness/make-sandbox.sh) at the run's date (2026-11-14): the 0.10.0 studio fixture (synthetic names, 13 planted work findings, 6 meetings and 6 sources in the window) and its `notion-sim` state. U: `publish: auto`. A: `publish: ask`. B and C: Reports off, `publish: ask`.
- **Isolation.** `claude` kept its own login; `brain`, `notion-sim` and `gh` on its `PATH` were shims: `brain` set `HOME` to the installation's home, `BRAIN_DIR` to the sandbox brain and `UB_LAUNCH_AGENTS_DIR` to a sandbox folder; `gh` always failed. Before any run, `brain status` without `BRAIN_DIR` answered `BRAIN_NOT_CONFIGURED`. No MCP server was loaded (`--strict-mcp-config` with none), so no real Notion was reachable.
- **Tools:** `--allowedTools` with the weekly job's list of weekly-review.md §11 (`Bash(brain:*)`, `Bash(git:*)`, `Bash(date:*)`, `Bash(jq:*)`, `Read`, `Edit`, `Write`, `Read`/`Edit` of the installation's `~/.ultimate-brain/weekly/**`), plus `Bash(notion-sim:*)` in place of the Notion tools. Anything else was refused and listed in `permission_denials`.
- **The prompt** was the user's words after a short preamble: notion-sim stands in for Notion's tools; read nothing outside the sandbox; add `--dry-run` to `brain schedule install`; when a skill asks the user, end the turn with the question. Model `claude-sonnet-5-5` (the schedule's default), `--max-budget-usd 3` per turn.

## Runs

| Run | Sandbox | Prompt | Cost (USD) | Time (s) | Result |
|---|---|---|---|---|---|
| u1 | U | `weekly review unattended` | 1.24 | 202 | one report `reports/2026-11-09-weekly-review.md`, coverage complete; D 5, I 1, T 5, 7 queued; 1 `notion_change` proposal, pending; 6 clusters judged, no finding; Notion writes: the Review row, then the Documents row (Origin Report) whose item 3 links that row; no task or property written; commits `weekly: review 2026-W46 (5 decisions)` and `publish: weekly review 2026-W46`; lint clean |
| u2 | U | `weekly review unattended` (same day) | 0.42 | 60 | quiet: `Quiet week: nothing written.`; no commit, no file changed, no Notion write |
| a1, a2 | A | `weekly review`, then `yes` | 0.42 + 1.14 | 69 + 123 | asked once `Publish this week's review to Notion when it's written? (yes / no)`; after the yes, the same report shape (D 5, I 1, T 5), shown in the chat; Notion writes: the Review row and the Documents row; nothing applied |
| b1, b2 | B | `review my week every Monday`, then yes to all | 0.16 + 0.27 | 15 + 30 | one message asking the time and model (Sonnet offered by default) and offering Reports, `publish: auto` and the tools once each; after the yes: `brain modules on reports`, `publish: auto`, `schedule install weekly-review --dry-run` (Monday 08:00, `--max-budget-usd 3`), `settings.weekly.schedule: on`, the folder-trust line |
| c1, c2 | C | `review my week every Monday`, then no to all | 0.21 + 0.21 | 11 + 11 | the same single offer; after the no: Reports, `publish` and the tools unchanged, and "the review stays a file in `reports/` and your next session tells you when one is ready"; dry-run install, `schedule: on` |

Total 4.02 USD. After every run: `~/Library/LaunchAgents` holds no `ultimate-brain` entry and `launchctl list` none; each sandbox's launch-agents folder is empty (every install was a dry run).

## Found, and what changed

| Found | Change |
|---|---|
| u1 and a2 couldn't hash the report's read-back (`shasum` isn't allowed), and recorded `@notion_body: null` | A weekly review is never imported (only `view_kind: report` is a wording candidate, cli.md §5.14.7), so the skill no longer reads it back (fork 3139cc6) |
| a2 tried `sed -i` on a working file (refused) | Working files change only through the Edit or Write tool (fork 3139cc6) |
| Every run tried to redirect `notion-sim` output into a file (refused), then called it once per database | The stand-in's limit: the Notion MCP saves a large result to a file itself, which the skill reads with `jq` |
| `notion-sim` gives tasks no `created` time; the runs used `last_edited` | The stand-in's limit |
| b2's write of `.claude/settings.json` was refused | Claude Code protects that file in a `claude -p` run; in an attended session the user approves the write |
| b2: the 0.10.0 fixture's Documents database has no Origin | The fixture predates Reports in Documents; `notion-sim` doesn't check properties, so u1 and a2 still wrote Origin |

Not covered here: a correction group (CC-254's synthetic tests cover the CLI's half; the fixture has no applied fact change in its window), a theme draft, Notion unreachable, and a partial run. Every name is synthetic.
