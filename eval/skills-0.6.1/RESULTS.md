# Skills audit for 0.6.1: blind run results

CC-61 acceptance: blind runs of brain-ingest and brain-catch-up on the CC-41 synthetic brain give the same notes and proposals before and after the audit. Four runs on 2026-10-29, each a fresh `claude -p` session in its own brain built with `scripts/blind-brain.mjs brain-acme <dir>`: no Notion ids and no MCP servers, the CLI from the CC-61 branch through a `brain` shim (the CLI is unchanged by this task). The "before" brains got `.agents/skills/`, `.claude/skills/` and `AGENTS.md` from `origin/main` (226816b); the "after" brains got the CC-61 branch's. The user was away: each agent wrote its questions to a file and took its default.

| Run | Told | Before | After |
|---|---|---|---|
| Ingest | "Ingest these reviewed minutes": [eval/ingest/cases/01-launch-review/minutes.md](../ingest/cases/01-launch-review/minutes.md) | 1 source, 1 meeting, 2 decisions, 1 person, 1 question, 1 risk; 1 proposal (3 fact changes, 6 new notes, 1 link) | the same files, the same proposal |
| Catch-up | "catch up", with a drop folder holding `eval/ingest-text/cases/05-drop-folder/drop/acme-content-plan.docx` | 2 backlog Review notes rows (kickoff, sync); 1 source, 1 person, 1 question; 1 proposal (1 change, 2 new notes); the file moved to `processed/` | the same files, the same proposals |

**Result: pass.** The two sides created the same file paths, and their proposals have the same kinds, fields and values. The only differences are the random ids of the new person notes. The reports differ in wording only: the same facts, the same Check items (a guessed meeting date, no deciders recorded), the same defaults taken.

**Expected, not gaps:** the "before" brains show 13 `product-file` lint errors, because their skills differ from the ones the branch CLI ships; the push fails in every run (no remote).
