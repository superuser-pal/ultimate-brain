# CC-267: the catch-up's publish in a sub-agent, before and after

CC-267 acceptance (decision 0043's bar: a catch-up never runs out of context; gate problem 9, eval/cc-264). Fresh `claude -p` sessions on 2026-11-18, each in its own synthetic brain. The two brains differ only in brain-catch-up's SKILL.md: **before** has the vendored one (skills 1.10.1), **after** has the fork branch `claude/CC-267-publish-in-a-sub-agent`. In the after version, steps 4.1.1 (Pages) and 4.1.2 (Tasks) run in one publish sub-agent with a fresh context. The model is the same in every run, as `measure.json` shows.

**To reproduce:** `npm run build`, then `eval/publish-subagent-0.16.2/run.sh <checkout of the skills fork at the CC-267 branch>`. [setup.py](setup.py) builds both brains from `tests/fixtures/brain-acme`. In each brain, everything was published to Notion before the run and setup's first value is logged. Each brain gets a fake workspace with the template's Example rows (a project, a task, a person, a capture and a meeting), one Reviewed meeting with four action items (two for the owner) and one Ask row. Notion is [notion-fake.mjs](notion-fake.mjs), a stdio MCP server. It uses the Notion MCP server's tool names and answers in Notion's shapes: a page with every property of its database, blocks with their annotations, and a block append that returns the page's blocks, as CC-264 measured. Each reply therefore costs about what Notion's would. As in eval/unattended-0.7.0, the database rows were "already read" into files (`snapshot.json`, `meetings.json`, `inbox.json`). [measure.py](measure.py) reads Claude Code's transcripts of the session and of each sub-agent.

## Figures

| Run | Cost (USD) | Session: calls, peak context | Sub-agent: calls, peak context | Compactions |
|---|---|---|---|---|
| pair 1 · before | 7.40 | 36 · 295,843 | — | 0 |
| pair 1 · after | 7.94 (+7%) | 26 · 193,812 | 17 · 206,984 | 0 |
| pair 2 · before | 6.66 | 37 · 272,419 | — | 0 |
| pair 2 · after | 7.32 (+10%) | 26 · 177,832 | 21 · 179,736 | 0 |
| Tasks check · after | 7.14 | 24 · 178,949 | 18 · 172,747 | 0 |

- **Peak context.** Without the sub-agent, the session reached 272k to 296k. The gate's session compacted itself at about 350k. With the sub-agent, the session stays under 200k in every after run. Pair 1's sub-agent reached 207k. After its brief was narrowed (it reads only its steps, by heading, and answers in a few lines: the fork's second commit), the sub-agents peaked at 180k and 173k.
- **Which runs judge the acceptance.** The contract changed twice during the runs, so the peak bar is judged on the final contract: the Tasks check run (the fork's last commit), compared with pair 2's before run. The coordinator asked for no third paired cost run after the author accepted the cost (2026-11-18): its session peaked at 178,949 and its sub-agent at 172,747, with no compaction. Pair 1's sub-agent (206,984) ran on the first wording and is kept as the reason the brief was narrowed.
- **The headroom is for this size of run.** One meeting, a report and five Briefs and pages leave the sub-agent 20k to 27k under 200k. The sub-agent's context grows with what it writes: mostly the Notion replies, and the report page's appends most of all. So a catch-up that publishes several meetings or long Documents can still pass 200k in the sub-agent. Splitting the publish across sub-agents (the author's option B, not taken) or reading page bodies as Markdown (CC-270, which removes only the reads) is where that would be taken up.
- **Cost.** The after runs cost 7% and 10% more. The sub-agent writes its whole context to a fresh cache: 180k to 207k cache-write tokens, about half of its cost. That outweighs what the session saves by not carrying its context through the publish. In pair 2, by weighted tokens (input 1, cache read 0.1, cache write 2, output 5), before was 1.25M and after was 0.76M for the session plus 0.70M for the sub-agent. The author accepted this on 2026-11-18, with 0043's no-compaction bar as the reason, and the row's acceptance records the cost against the before run instead of asking for a lower one.
- **What fills the publish's context** (pair 1's sub-agent, 311k characters of tool results): block JSON is 211k of it (68%). Block reads are 69k (22%), replies to block appends are 114k (37%, 94k of that from the report page's two appends), and block deletes are 28k (9%). Reading page bodies as Markdown (CC-270, held after 1.0) would remove only the block reads. The append replies come from writes.

## The same work

| Run | Pages recorded (notes with a Notion page) | Render after the run | Tasks created | Report's first lines |
|---|---|---|---|---|
| pair 1 · before | 17 | 0 items | 2: the owner's | Done, Needs you (4 decisions), Next, First meeting in: 2 tasks |
| pair 1 · after | 17, the same notes | 0 items | 2: the owner's | the same, with "7 pages published" |
| pair 2 · before | 17 | 0 items | 2: the owner's | the same |
| pair 2 · after | 17, the same notes | 0 items | **4**: the owner's 2 and 2 for other people | "4 tasks" |
| Tasks check · after | 17 | 0 items | 2: the same as pair 2's before (`tasks-diff.txt`) | "2 tasks for you" |

- An empty render after the run means every page the run wrote was recorded: nothing is left to write.
- **Pair 2's Tasks.** The session handed the sub-agent all four action items, and the sub-agent created a Task for each. The contract now names what the session passes: exactly the Task items the ingest kept, the owner's explicit to-dos only. It also says the sub-agent creates a Task only for an item `sync tasks` returns from those inputs (the fork's third commit). `run.sh` now compares the Tasks of the after run with the before run's and fails when they differ. The Tasks check run (the after brain only, against pair 2's before) created the same two Tasks.
- **Writes.** The after runs make 49 Notion writes against 44 to 46 before. In pair 1 the extra writes are the report's body written a second time: the second render, after the two new people were recorded, changed the report's People involved lines. The pages written are the same. Each report names the same Example rows as skipped, and the counts in its Done line vary by one note from run to run (8 or 9 new notes for the same 17 recorded pages).
- **Traces** are in [runs/](runs/): per run `reply.md` (the report), `measure.json`, `writes.txt`, `tasks.txt`, `commits.txt`, `recorded.txt` and `render-after.txt`, with page ids and hashes redacted. Pair 1's after `tasks.txt` was written from its sub-agent's answer: its Notion log was overwritten by pair 2.
