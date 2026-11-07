# 0.10.0 acceptance: fixtures (CC-140)

A synthetic brain and a synthetic Notion space with planted project-management problems, for testing Ultimate Assistant (decision [0072](../../decisions/0072-ultimate-assistant.md)). CC-110 runs its scenarios on them. Every name is invented: a freelance design studio run by "Robin Example", with three Domains, six Areas, sixteen Projects and thirty-five Tasks.

## Files

| File | What it is |
|---|---|
| [planted.json](planted.json) | The manifest: `as_of`, the signals with their thresholds, each planted problem with its page ids, the signal that should find it and its evidence, and `not_flagged`, the rows that must not be flagged (a task already Waiting On, and rows one day under a threshold) |
| [harness/fixture.mjs](harness/fixture.mjs) | The world: Domains, Areas, Orgs, People, Projects, Tasks, Meetings and a Decision, every date as days relative to `as_of` |
| [harness/build-fixture.mjs](harness/build-fixture.mjs) | Writes that world at an `as_of`: the brain's notes, `brain.json`'s modules and Notion ids, the Notion stand-in's state, the publish onto it, and the brain's dated Git history |
| [harness/make-sandbox.sh](harness/make-sandbox.sh) | One sandbox: the brain, the state, `notion-sim` and `env.sh` |
| [harness/check-planted.mjs](harness/check-planted.mjs) | Checks a sandbox against planted.json |
| [harness/install.sh](harness/install.sh) | An isolated installation of this checkout's CLI (0.9.0's, packing HEAD at its own version) |
| [harness/RULES.md](harness/RULES.md) | The rules a blind runner reads first (CC-110) |
| [harness/scenario.sh](harness/scenario.sh) | Prepares a sandbox for one scenario: Notion unreachable, a failed write, two linked repos, a user's edit in Notion (CC-110) |
| [harness/reference.mjs](harness/reference.mjs) | The reference report: the snapshot of spec/assistant.md §2.1 read from the sandbox's state, run through `brain assistant findings` (CC-110) |
| [harness/evidence.mjs](harness/evidence.mjs) | What a session changed since a mark: commits, proposals, dismissals, log lines, notion-sim writes, Review rows, lint (CC-110) |
| [RESULTS.md](RESULTS.md) | The results of CC-110's blind runs |

The Notion stand-in is 0.9.0's [notion-sim](../acceptance-0.9.0/harness/notion-sim), copied into the sandbox unchanged. Blind runners follow [harness/RULES.md](harness/RULES.md) (CC-110, from 0.9.0's): `notion-sim` instead of any Notion tool, nothing outside the sandbox, and a first `brain status` that must name the sandbox's brain. The scenarios, their steps and their evidence are in [docs/acceptance-0.10.0.md](../../docs/acceptance-0.10.0.md).

## Make a sandbox

```sh
sh eval/acceptance-0.10.0/harness/install.sh /tmp/ub-0100/i
sh eval/acceptance-0.10.0/harness/make-sandbox.sh /tmp/ub-0100/i /tmp/ub-0100/s
. /tmp/ub-0100/s/env.sh; node eval/acceptance-0.10.0/harness/check-planted.mjs /tmp/ub-0100/s
```

`make-sandbox.sh <install dir> <new dir> [<as_of>]` writes:
- `<dir>/brain`: made by the installed CLI's `brain init`, then the fixture's notes, with every module on and Domains on. Its views and index are generated, every note is recorded as published, `brain lint --strict` is clean (the script fails otherwise), and its clock follows the fixture: the CLI runs with `--now` (`brain init` on the day before the oldest note, the publish on the day before `as_of`), and the Git history is dated the same way, each note committed on its `created` day.
- `<dir>/notion/state.json`: Domains, Areas, Projects, Tasks, Meetings, People, Orgs, Decisions, Review, Inbox, Documents, Goals, Key Results and Questions, with `as_of` at the top. Each page holds what the publish sent, and its `last_edited` is the fixture's date (a publish is not an edit of yours). The call log is empty.
- `<dir>/bin/notion-sim` and `<dir>/env.sh` (the installation's, then `BRAIN_DIR`, `NOTION_SIM_DIR` and `PATH`).

**`as_of`.** Every date is `as_of` plus the fixture's offsets, so a sandbox never ages: it looks the same at any `as_of`. The default is planted.json's (2026-12-01), which the check uses. For a live run, make the sandbox at today's date, `make-sandbox.sh <i> <dir> "$(date +%F)"`, so the agent's today is the fixture's: `notion-sim` stamps the edits a run makes with the real time, and the CLI uses the real clock unless the run passes `--now`.

## What is planted

Thirteen findings, more than 10, so the top-10 cap and "more" can be tested; ids are in planted.json.

| Signal | Row | Why |
|---|---|---|
| `task_overdue` | Send the logo proposals | Due 5 days before `as_of` |
| `task_overdue` | Update the case studies | Due 10 days before |
| `task_stalled` | Write the About page copy | No edit for 20 days |
| `task_stalled` | Buy new running shoes | No edit for 31 days |
| `project_stalled` | Pinecrest Clinic signage | Active; last task done 40 days ago, last brain mention 35 days ago |
| `project_no_next_step` | Conference talk proposal | Active, no task at all, mentioned 4 days ago |
| `project_done_but_open` | Larkspur Bakery packaging | Active, its 3 tasks all Done |
| `task_no_project` | Renew the studio domain name; Book a dentist appointment | Open, no Project (two findings) |
| `project_misplaced` | Studio newsletter | Under Clients; its two meetings and its decision are all Marketing |
| `project_duplicate` | Quayside Books catalogue / Quayside Books catalog redesign | Same client, same Area, names alike |
| `area_empty` | Workshops | Its only project is Done, no open task |
| `area_no_domain` | Finance | No Domain, with Domains on; it has active work |

Not to be flagged: "Get a quote from the tiler", Waiting On, unedited for 20 days and 5 days past due; and rows one day under a threshold (an edit 13 days ago, due 2 days ago, due today, a project last active 20 days ago), an On Hold and a Planned project, and two projects that share a client's name only.

**Signal names** are those of [spec/assistant.md](../../spec/assistant.md) §3.3 (CC-108). **The rules** in planted.json's `signals` and the check are a reference reading of 0072 §3, written so the fixtures could be checked before the contracts; where they differ from the spec, the spec decides (CC-110).

## What the check confirms

`check-planted.mjs <sandbox>` (with `brain` on `PATH`) reads the sandbox and writes nothing in it:
- the brain and Notion agree: each Domain, Area and Project row has its note, with the same page id, Area and Domain;
- every planted row exists, with the status, dates (days before `as_of`) and relations planted.json gives;
- computed at the sandbox's `as_of`, the signals find exactly the planted findings: each planted one, and nothing on any other row, so the healthy rows trip none of 0072's thresholds; no `not_flagged` row is found;
- the state loads: `notion-sim` (run on a copy, so the sandbox's call log stays empty) lists every database and returns every row;
- `brain lint --strict` is clean and the brain has no uncommitted change.

It prints the failures and a count (`194/194 checks pass; 14 findings at 2026-12-01, 13 planted`) and exits 1 on any failure; `--json` gives the same as JSON.
