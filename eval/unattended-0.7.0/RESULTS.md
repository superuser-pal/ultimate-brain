# Unattended catch-up: blind run results

CC-64's acceptance (decision 0051), rewritten by CC-388 for the 0.17.0 model: no Review, Decisions or Questions rows (decisions 0096, 0099); what a run meets is queued for the next session (0096 §4); a Notion edit waits as a correction (0101 §4); a Ready Weekly row's ticks are applied after a stale check (0110 §4). The eight cases are the same.

**The 0.7.0 record** (2026-10-30, its results and its traces): `git show v0.17.0:eval/unattended-0.7.0/RESULTS.md` and `v0.17.0:eval/unattended-0.7.0/runs/`, last changed in d4b92299. It can't be reproduced since 0.16.0.

## Setup

Eight fresh `claude -p` sessions on 2026-11-23, on `claude-sonnet-5-5` (the schedule's default model; 0.7.0's ran on whatever the user's settings named), each in its own synthetic brain from `scripts/blind-brain.mjs brain-acme`, with the CLI (0.17.0) and the skills (1.12.0) of `main` at 6b02338a, the user's own settings, hooks and MCP servers left out, no git remote, the user away. Notion is simulated: a run reads `snapshot.json` (the output of `brain sync snapshot`), `meetings.json` and `inbox.json`, and appends each write to `writes.md`. The Weekly row is written by the CLI (`weekly plan`, `select`, `record`, `sync render`), then ticked in the simulated row. No real brain or Notion space is used.

**To reproduce:** `npm run build`, then `eval/unattended-0.7.0/run.sh` (or `run.sh mixed-on requests` for some), signed in to Claude Code. [setup.py](setup.py) builds the brains under `$UB_EVAL_DIR` (default `/tmp/ub-eval-0.7.0`); [run.sh](run.sh) runs them and keeps the traces, listed at its top, in [runs/](runs/). A session that fails or hits a limit is listed as incomplete and `run.sh` exits 1. `run.sh` checks that the sessions ended, not what they did: the table below is read from the traces, and the words vary from run to run.

It was run three times, each to the end with all eight at exit 0: [runs/](runs/) holds the third; the first two are in the history of this folder (fcb7d11c, e2acbad0). Between them only the harness changed: the brains start with an index and views, and a created page gets an id.

**The boundary (0051)** held in all 21 unattended sessions: `fix-text.txt` is empty, so neither the report's What to fix ("Maria left Acme in June") nor the Weekly item's note ("… Mira now leads the copy team") appears in any note or proposal; `facts.txt` shows the launch date and Maria's role as they were; the corrections, changes and noted items are pending in `waiting.txt` and `weekly.txt`. An exact-string search can't rule out a paraphrase; the lists of changed files and waiting proposals, read with it, show none.

## The eight cases

| Run (`runs/<name>`) | Setup | What the third run's trace shows |
|---|---|---|
| **noop** | Notion not configured, nothing waiting but 3 pending decisions | No commit, no log line, no change. |
| **noop-connected** | Notion configured and empty | The same; `writes.md` empty. |
| **budget** | a drop folder of 12 notes, modified hours apart | The 10 oldest taken in as sources, the 2 newest left in the folder and named; `inputs=10 left=2`. No note made from them, one commit for the ten (misses 4, 5). |
| **mixed-on** | Reports on, publish `auto`; 3 Ready meetings (one with no Date, one that moves the launch); a Ready Weekly row: C1 ticked, C2 ticked but its note changed since, C3 ticked with a note, C4 unticked; Maria's Role and a learned Document's Project (not correctable) changed in Notion | 2 meetings in, the undated one skipped and named; launch 2027-02 → 2027-03 **pending**; Role **pending**; C1 applied (`decided_by: tick`), C2 closed `stale`, C3 and C4 pending; pages published, **one** Catch-up row (`report-rows.txt`: 1). The Project change isn't named (miss 2); `report=no` in the log line beside the row (miss 6). |
| **mixed-reports-off** | the same with Reports **off** | The same work and the same waiting items; pages published, **no Catch-up row**; the Project change named. |
| **mixed-ask** | the same with Reports on, publish **`ask`** | The same work, C1 applied too; **`writes.md` empty**: nothing published, no row, both meetings left Ready; the Project change named under Check. |
| **requests** | Reports and Documents on, publish `auto`: a published report with Refresh asked and a What to fix; a duplicated Inbox row with Document asked, whose source belongs to another page (`NOTION_ID_MISMATCH`) | No Document made, the report not refreshed (no change under `reports/`), neither page written, so both boxes stay ticked; **one** Catch-up row naming the conflict and the fix. Nothing else is published, though 7 pages had changes to send (miss 1). |
| **attended-opening** | "catch up" on the mixed-ask brain, stopped after its batch | The brain left untouched (`tree-after.txt` empty); the batch asks the undated meeting, C3 with its note and reading, the identities and the publish. No "Since last time" line (miss 3). |

**What changed from 0.7.0's cases.** An approved and a Fix row are now ticks and a noted item of the Weekly row; the Role correction waits instead of being applied; the decision's Assessment is a Document's Project; Promote asked is Document asked on a duplicated row. The plan itself now leaves out a request on a conflicted Inbox row, so dropping it is the CLI's work and the run's is to name it and leave the page alone.

## Misses

Findings of these runs, not fixed here (CC-388 changes no product code): where a session did not do what the skills say. "Runs" counts sessions over the three runs.

| # | Miss | Runs | What the skills say |
|---|---|---|---|
| 1 | **requests** publishes nothing but the Catch-up row with publish `auto`; `sync render --changed` had 7 items | 3 of 3 | brain-catch-up references/unattended.md, step 5: publish with `auto` |
| 2 | The change the brain can't take (`NOT_CORRECTABLE`) isn't named in the report | 4 of 9 mixed sessions (first run mixed-on; second mixed-reports-off and mixed-ask; third mixed-on) | unattended.md, step 3's table: under Check |
| 3 | **attended-opening** has no "Since last time" line; that session also skipped the pull plan and offered C1 and C2 as still to apply | 1 of 3 (the first run offered the stale C2 too) | read-only-pass.md, "The batch's opening line"; weekly-ticks.md, step 1.13 |
| 4 | **budget**: 10 sources and no note or pending proposal (in 0.7.0 each note became one proposal) | 3 of 3 | parts.md, "Unattended"; the notes say little, so it is also a judgment |
| 5 | Several inputs in one ingest commit (one ingest log line for ten sources, in the second run's budget, seen in its brain's log) | 11 of 12 sessions that took inputs in; the third run's mixed-ask committed each | brain-ingest references/sources.md §7, SKILL.md step 11: one commit each |
| 6 | The log line: `waiting` 6 and 9 for 7 (second run, mixed-on and mixed-reports-off), `report=no` beside a Catch-up row (third, mixed-on), `seconds` an estimate, as replies say | as named | unattended.md, step 6 |
| 7 | **mixed-on**: no Catch-up row though 7 decisions waited and Reports was on | 1 of 3 (second run) | unattended.md, step 6 |

The push failed in every run that committed (no remote).
