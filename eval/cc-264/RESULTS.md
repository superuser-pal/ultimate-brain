# CC-264: where the gate's first-meeting catch-up spent

Measured from CC-193's release gate on 0.14.0-rc.2 (eval/setup-0.14/RESULTS.md, problem 9): the two headless `claude -p` result files and the session transcript of the catch-up, read only. Numbers only: no page, note or person from the gate's brain is quoted. Model: the gate's, at list prices.

## The total was about 10.6 USD, not 15

The two turns were one session: the second was a `--resume` of the first. Its result file's cost is cumulative. Its `modelUsage` holds the first turn's tokens as well as its own:

| | Turn 1 result | Turn 2 result `usage` (turn 2 alone) | Turn 2 result `modelUsage` |
|---|---|---|---|
| Cache reads | 1,844,050 | 4,372,871 | 6,554,139 |
| Cache writes | 203,377 | 220,752 | 430,255 |
| Output tokens | 18,015 | 34,262 | 58,297 |
| Uncached input | 28 | 50 | 10,387 |
| Cost (USD) | 4.34 | — | 10.57 |

Turn 1 plus turn 2's own usage is 52,277 output tokens; the remaining 6,020 output and 10,337 uncached input tokens are the automatic compaction in turn 2 (below). So the first meeting cost **10.57 USD in all**: turn 1 4.34, turn 2 about 6.23 with its compaction. The gate's "about 15 USD (4.34 + 10.57)" counts turn 1 twice. The CLI's turn counts (43 and 66) are tool round trips. The transcript has **37 model calls**: 13 in turn 1, 24 in turn 2.

## Cost per phase

Each call pays for its whole context again (as cache reads), plus what is new (cache writes) and its output. A phase's share is the sum of its calls' weights (input 1, cache read 0.1, cache write 2, output 5), scaled to the turn's cost. Turn 2's dollars include its compaction, spread by share.

| Turn | Phase | Calls | Tool calls | Context at end (tokens) | Share | USD |
|---|---|---|---|---|---|---|
| 1 | Start: the skill, `brain status`, brain-sync's skill and formats | 3 | 6 | 87,732 | 22% | 0.94 |
| 1 | Notion pull: 11 database retrievals, 11 full queries | 2 | 22 | 107,267 | 10% | 0.43 |
| 1 | Meeting and report checks, brain-ingest's skill and references | 3 | 9 | 196,564 | 34% | 1.48 |
| 1 | Snapshot written by hand, plan, apply, commit, report | 5 | 4 | 226,984 | 34% | 1.49 |
| 2 | Ingest: extract, notes, proposals, checks | 7 | 9 | 274,112 | 31% | 1.93 |
| 2 | Publish, until the compaction | 5 | 34 | 351,655 | 36% | 2.21 |
| 2 | Publish and Tasks, after the compaction | 12 | 21 | 122,992 | 34% | 2.09 |

- The context grew from 51,829 tokens at the first call to 226,984 at the end of turn 1. Turn 2 resumed with all of it and reached 351,655 mid-publish. There the session **compacted itself**: decision 0043's bar is that a catch-up never runs out of context. CC-267 takes this up.
- One call in turn 1 wrote the whole snapshot as a script by hand: 8,794 output tokens, 13% of turn 1's cost, 61 seconds. CC-269 takes this up.

## What filled the context

Characters of tool results (JSON for the Notion replies), by kind:

| Turn | Kind | Characters |
|---|---|---|
| 1 | brain-catch-up's SKILL.md, loaded with the skill | 47,104 |
| 1 | Other skill text read: brain-sync SKILL.md and formats.md, brain-ingest SKILL.md and review-items.md, selection.md, notion.md | 114,469 |
| 1 | Notion: 11 database retrievals | 11,383 |
| 1 | Notion: 11 full queries of every row | 103,440 |
| 1 | Notion: page bodies (the meeting, a report as blocks: 45,820) | 72,023 |
| 2 | brain-ingest references/extraction.md | 28,660 |
| 2 | The transcript printed, then the extract printed | 13,034 + 19,600 |
| 2 | `brain query --read` of 8 notes | 21,324 |
| 2 | Notion: project and area pages read before writing their sections | 44,965 |
| 2 | Notion: replies to 6 block appends (each returns the page's blocks) | 69,591 |
| 2 | Notion: replies to the other writes and small reads | 40,433 |

Of brain-catch-up's 47,104 characters, "Unattended" and "Run on a schedule" are 13,801 (29%). An attended run never uses them.

## Quick wins (rc.3, brain-catch-up only)

| Quick win | The gate's numbers it reduces |
|---|---|
| "Unattended" and "Run on a schedule" move to `references/unattended.md` and `references/schedule.md`, read only by an unattended run or a schedule request. Their headings stay in SKILL.md as pointers | SKILL.md goes from 47,104 to 36,686 characters (the reading table below added): about 2.6k tokens less in every call of every attended catch-up, 37 calls here |
| Each skill and reference is read at its step, and only when the step has work (a table in the skill) | brain-ingest references/notion.md (16,077) and brain-sync's Push half are read at the publish, not in the read-only pass, so 13+ fewer calls carry them; brain-apply, brain-query and brain-repos are not read when their steps have nothing |
| An input's text is never printed when the command that takes it returns it | the 13,034-character transcript print before `brain source extract` |

The author chose on 2026-11-14 not to re-measure with synthetic runs. CC-266's re-run of the gate on rc.3 measures the first meeting's real cost.

## Larger, for 1.0.0

- **CC-267:** the publish's page and Task writes run in a sub-agent with a fresh context. This targets turn 2's 70% and the compaction.
- **CC-268:** incremental pull. Only the rows edited since the last pull are read: 103,440 characters of queries here.
- **CC-269:** the CLI turns the saved query replies into the snapshot. This replaces the 8,794-token script written by hand.
- **CC-270:** page bodies are read as Markdown, not blocks: the 45,820-character report read and the 44,965 characters of pages read before their sections.
