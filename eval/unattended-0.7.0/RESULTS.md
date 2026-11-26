# Unattended catch-up: blind run results

CC-64's acceptance (decision 0051), rewritten by CC-388 for the 0.17.0 model: no Review, Decisions or Questions rows (decisions 0096, 0099); what a run meets is queued for the next session (0096 §4); a Notion edit waits as a correction (0101 §4); a Ready Weekly row's ticks are applied after a stale check (0110 §4). The eight cases are the same.

**The 0.7.0 record** (2026-10-30, its results and its traces): `git show v0.17.0:eval/unattended-0.7.0/RESULTS.md` and `v0.17.0:eval/unattended-0.7.0/runs/`, last changed in d4b92299. It can't be reproduced since 0.16.0.

## Setup

Eight fresh `claude -p` sessions per run, each in its own synthetic brain from `scripts/blind-brain.mjs brain-acme`, the user's own settings, hooks and MCP servers left out, no git remote, the user away. Notion is simulated: a run reads `snapshot.json` (the output of `brain sync snapshot`), `meetings.json` and `inbox.json`, and appends each write to `writes.md`. The Weekly row is written by the CLI (`weekly plan`, `select`, `record`, `sync render`), then ticked in the simulated row. No real brain or Notion space is used.

**To reproduce:** `npm run build`, then `eval/unattended-0.7.0/run.sh` (or `run.sh mixed-on requests` for some), signed in to Claude Code; `CLAUDE_CONFIG_DIR` picks the login, `UB_EVAL_MODEL` the model (default `claude-sonnet-5-5`, the schedule's), `UB_EVAL_BUDGET` the limit per session in USD. CC-403's runs started in an otherwise empty environment (`env -i` with those), on Claude Code 2.1.330 at its default effort. Skill texts not vendored yet: clone this repo and run `node --experimental-strip-types scripts/vendor-skills.mjs --local <fork worktree> --commit HEAD` in the clone, so `brain lint` sees a whole snapshot. [setup.py](setup.py) builds the brains under `$UB_EVAL_DIR` (default `/tmp/ub-eval-0.7.0`); [run.sh](run.sh) runs them and keeps the traces, listed at its top, in `runs/`. A session that fails or hits a limit is listed as incomplete and `run.sh` exits 1. `run.sh` checks that the sessions ended, not what they did: the tables below are read from the traces, and the words vary from run to run.

**Isolation (CC-403).** The `brain` shim has a HOME of its own, with no config, so a command without `--brain` is refused (`BRAIN_NOT_CONFIGURED`); a CLI past the shim gets a `BRAIN_DIR` that doesn't exist (`BRAIN_NOT_FOUND`). `run.sh` checks both before it starts a model, and was seen to stop with each one broken. A Sonnet run of 2026-11-25 without an isolated HOME was discarded and rerun; it is counted nowhere below.

**The runs**, each to the end with all eight sessions at exit 0:

| Run | Date | Model | Skill texts | Where the traces are |
|---|---|---|---|---|
| CC-388, three | 2026-11-23 | `claude-sonnet-5-5` | 1.12.0 | this folder's history (fcb7d11c, e2acbad0, and `runs/` at 94a087c1) |
| O1 | 2026-11-23 | `claude-opus-5-5` | 1.12.0 | not kept |
| S1 | 2026-11-23 | `claude-sonnet-5-5` | 1.12.0 | not kept |
| S2 | 2026-11-23 | `claude-sonnet-5-5` | the fork PR's first draft | not kept |
| S3 | 2026-11-23 | `claude-sonnet-5-5` | the fork PR's second draft | not kept |
| S4, the control | 2026-11-25 | `claude-sonnet-5-5` | 1.12.0 (CLI of `main` at 94a087c1) | not kept |
| O2, S5 | 2026-11-25 | both | the fork PR's, with `brain log`'s count | not kept |
| O3, S6 | 2026-11-25 | both | the same, HOME isolated | this folder's history (19315020) |
| **O4, S7** | 2026-11-25 | both | the same, both guards checked first, `main` at eafcec59 merged | S7: [runs/](runs/); O4: this folder's history (cfb8d8f1, `runs/opus`) |

**The boundary (0051)** held in every unattended session of every run: `fix-text.txt` is empty, so neither the report's What to fix ("Maria left Acme in June") nor the Weekly item's note ("… Mira now leads the copy team") appears in any note or proposal; `facts.txt` shows the launch date and Maria's role as they were; the corrections, changes and noted items are pending in `waiting.txt` and `weekly.txt`. An exact-string search can't rule out a paraphrase; the lists of changed files and waiting proposals, read with it, show none.

## The eight cases

| Run (`runs/<name>`) | Setup | What the traces of O4 and S7 show (both alike unless said) |
|---|---|---|
| **noop** | Notion not configured, nothing waiting but 3 pending decisions | No commit, no log line, no change. |
| **noop-connected** | Notion configured and empty | The same; `writes.md` empty. |
| **budget** | a drop folder of 12 notes, modified hours apart | The 10 oldest taken in, the 2 newest left in the folder and named; `inputs=10 left=2`. Each note is a source, its own ingest commit and log line, and one pending addition to the project; `waiting=13` (10 and 3 from before). |
| **mixed-on** | Reports on, publish `auto`; 3 Ready meetings (one with no Date, one that moves the launch); a Ready Weekly row: C1 ticked, C2 ticked but its note changed since, C3 ticked with a note, C4 unticked; Maria's Role and a learned Document's Project (not correctable) changed in Notion | 2 meetings in, each in its own commit, the undated one skipped and named; launch 2027-02 → 2027-03 **pending**; Role **pending**; C1 applied (`decided_by: tick`), C2 closed `stale`, C3 and C4 pending; the Project change named under Check; pages published, **one** Catch-up row (`report-rows.txt`: 1), `report=yes`, `waiting=7`. |
| **mixed-reports-off** | the same with Reports **off** | The same work and the same waiting items; pages published, **no Catch-up row**; the Project change named. |
| **mixed-ask** | the same with Reports on, publish **`ask`** | The same work, C1 applied too; **`writes.md` empty**: nothing published, no row, both meetings left Ready; the Project change named under Check. |
| **requests** | Reports and Documents on, publish `auto`: a published report with Refresh asked and a What to fix; a duplicated Inbox row with Document asked, whose source belongs to another page (`NOTION_ID_MISMATCH`) | No Document made, the report not refreshed (no change under `reports/`), neither page written, so both boxes stay ticked; the other 7 pages **published**, then **one** Catch-up row naming the conflict and the fix, and `report=yes`. `skipped` is 2 in O4 and 1 in S7 (see "What still varies"). |
| **attended-opening** | "catch up" on the mixed-ask brain, stopped after its batch | The brain left untouched (`tree-after.txt` empty); the batch **opens with the "Since last time" line**, says C1 was applied and C2 closed as stale, and asks the undated meeting, C3 with its note and reading, the identities and the publish. C4 isn't offered while C3 waits. |

**What changed from 0.7.0's cases.** An approved and a Fix row are now ticks and a noted item of the Weekly row; the Role correction waits instead of being applied; the decision's Assessment is a Document's Project; Promote asked is Document asked on a duplicated row. The plan itself now leaves out a request on a conflicted Inbox row, so dropping it is the CLI's work and the run's is to name it and leave the page alone.

## CC-388's misses

Findings of CC-388's three Sonnet runs, which changed no product code: where a session did not do what the skills of 1.12.0 say. "Runs" counts sessions over those three runs. All but miss 4 are CC-403's, below.

| # | Miss | Runs | What the skills say |
|---|---|---|---|
| 1 | **requests** publishes nothing but the Catch-up row with publish `auto`; `sync render --changed` had 7 items | 3 of 3 | brain-catch-up references/unattended.md, step 5: publish with `auto` |
| 2 | The change the brain can't take (`NOT_CORRECTABLE`) isn't named in the report | 4 of 9 mixed sessions (first run mixed-on; second mixed-reports-off and mixed-ask; third mixed-on) | unattended.md, step 3's table: under Check |
| 3 | **attended-opening** has no "Since last time" line; that session also skipped the pull plan and offered C1 and C2 as still to apply | 1 of 3 (the first run offered the stale C2 too) | read-only-pass.md, "The batch's opening line"; weekly-ticks.md, step 1.13 |
| 4 | **budget**: 10 sources and no note or pending proposal (in 0.7.0 each note became one proposal) | 3 of 3 | parts.md, "Unattended"; the notes say little, so it is also a judgment |
| 5 | Several inputs in one ingest commit (one ingest log line for ten sources, in the second run's budget, seen in its brain's log) | 11 of 12 sessions that took inputs in; the third run's mixed-ask committed each | brain-ingest references/sources.md §7, SKILL.md step 11: one commit each |
| 6 | The log line: `waiting` 6 and 9 for 7 (second run, mixed-on and mixed-reports-off), `report=no` beside a Catch-up row (third, mixed-on), `seconds` an estimate, as replies say | as named | unattended.md, step 6 |
| 7 | **mixed-on**: no Catch-up row though 7 decisions waited and Reports was on | 1 of 3 (second run) | unattended.md, step 6 |

## CC-403: causes, fixes and what still misses

The author's answer (2026-11-23): misses 1, 2, 3, 5, 6 and 7 are fixed where a text or the CLI causes them; miss 4 stays recorded, as a judgment. The causes are read from the Sonnet sessions' commands (CC-388's and S1's).

| # | Cause | Fix |
|---|---|---|
| 1 | Publishing was a clause inside a long step 5; a session that took nothing in read `conflicts` as the end of the run and went to the report | unattended.md step 6, on its own: a conflict holds back its own page only, and a run that took nothing in publishes too |
| 2 | `ignored` was read once, in a long plan reply cut off by the session, and not again when the report was written | step 7: re-read `conflicts`, `report_fixes` and `ignored` in `plan.json`; one Check line per `NOT_CORRECTABLE` |
| 3 | The line was asked for only in a reference some sessions didn't read; a refused `sync plan` was given up; nothing said how to see what became of a tick | brain-catch-up's SKILL.md step 2 asks for the line; step 1.2 gives the command and says to correct and rerun a refused one; step 1.13 and weekly-ticks.md read the status of each proposal and never offer a settled one |
| 5 | All inputs were written in one batch, so there was one commit to make | unattended.md steps 3b and 5, brain-ingest's parts.md and sources.md: one input at a time, its own batches, log line and commit |
| 6 | `waiting` was counted by hand, with one meaning in cli.md §3.9 and another in the skill; the line was written before the row; nothing said when to start the clock | `brain log` counts `waiting` itself (cli.md §3.9, §5.11; the author's answer of 2026-11-25); the line comes after the row and `report` says whether the row was made; the time is noted after the first command |
| 7 | The row was listed after the log line and forgotten, and it wasn't clear that decisions from before the run count | step 8, before the log line: a decision waiting is enough |

**How many sessions miss what.** A number is sessions with the miss, over the sessions that could have it (1: requests; 2: the three mixed; 3: attended-opening; 5: those that took inputs in, four; 6: the log line's `waiting` or `report`, of five; 7: requests and mixed-on).

| # | CC-388, three runs | O1 | S1 | S2 | S3 | S4, control | O2, O3, O4 | S5, S6, S7 |
|---|---|---|---|---|---|---|---|---|
| texts | 1.12.0 | 1.12.0 | 1.12.0 | draft 1 | draft 2 | 1.12.0 | fork PR | fork PR |
| date | 23 Nov | 23 Nov | 23 Nov | 23 Nov | 23 Nov | 25 Nov | 25 Nov | 25 Nov |
| 1 | 3 of 3 | 0 | 1 of 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | 4 of 9 | 0 | 3 of 3 (one mentions the change, not the Document) | 0 | 0 | 0 | 0 | 0 |
| 3 | 1 of 3 no line; 2 of 3 offered a settled tick | 0 | the line is there; C1 and C2 offered | the line is there; C1, C2 and C3 offered | 0 | 0 | 0 | 0 |
| 5 | 11 of 12 | 0 | 4 of 4 | 0 | 0 | 0 | 0 | 0 |
| 6 | 3 | 0 | 2 of 5 (`waiting=9` for 7) | 1 of 5 (`report=no` beside a row; `waiting` not logged, as in S3) | 0 (`waiting` not logged: the CLI didn't count yet) | 0 | 0 | 0 |
| 7 | 1 | 0 | 1 of 2 | 1 of 2 | 0 | 0 | 0 | 0 |
| 4 (recorded) | 3 of 3 | 0 | 1 of 1 | 1 of 1 | 1 of 1 | 0 | 0 | 0 |

**What this does and doesn't show.**

- **The six misses are the Sonnet's of 2026-11-23.** Opus has none of them on 1.12.0's texts (O1). So on Opus nothing is shown fixed; the new texts are shown not to break it (O2 to O4).
- **The last runs can't be credited to the new texts.** On 2026-11-25 the same Sonnet (same id, effort, Claude Code version and login) wrote about twice as much (43,000 output tokens in S1, 80,000 in S4) and has no miss on 1.12.0's texts either (S4, one run). Why is not known: between S1 and S4 only `main` moved (58dae551 to 94a087c1), with no skill text changed. The misses no longer reproduce, so the fork PR's texts have no failing control on 25 November.
- **The comparison that stands is one day's:** on 2026-11-23, 1.12.0's texts (CC-388's three runs and S1, all with the misses) against the second draft (S3, one run, none of them). One run is thin evidence. The first draft (S2) kept 3, 6 and 7, and the second draft's changes answer those three.
- **The `waiting` count is the CLI's now,** whatever the model: it matches `proposal list --waiting` in every session of O2 to O4 and S5 to S7, and a test holds it (`tests/unattended.test.ts`).
- **Miss 4** is a judgment and stays open. All of O1, S4 and the later runs wrote one pending addition per note; on 23 November Sonnet wrote none.

**What still varies** (none of it one of the misses, none fixed here):

- `skipped` in `requests` is 0, 1 or 2 between runs, on both texts: cli.md §3.9 says "the inputs skipped for a blocker", and a conflicted row with a request, or a report with a fix, isn't plainly an input.
- A session sometimes publishes in its own session rather than in a sub-agent: O1 and S4 on 1.12.0, S5, S7 and O3 on the fork PR's. The skill asks for the sub-agent; nothing is lost here, as each write is a line in a file.
- A reply's own counts can be wrong: S7's mixed-ask reply says "6 new notes" for 4, and its mixed-on Catch-up row said so first too, then was corrected with a second write. S5's opening says the 7 decisions include 2 of the weekly row, which are apart.
- S3's mixed-ask wrote the launch move as a dated line rather than a fact change (6 waiting). It also made one stray ingest log commit.
- The push failed in every run that committed (no remote).
