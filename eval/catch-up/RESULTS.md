# Catch-up: blind run results

CC-26 acceptance: "a blind catch-up run on a synthetic brain asks once, then finishes" (decision 0037).

## Run 1 · 2026-10-19 · CLI 0.2.4, skills from the CC-26 branch

**Setup:** a copy of `tests/fixtures/brain-acme` with every Notion database id emptied (no Notion tools in the session), one pending proposal, and a drop folder holding `eval/ingest-text/cases/01-document/acme-website-brief.pdf` and `eval/ingest-text/cases/05-drop-folder/drop/acme-content-plan.docx`. A fresh agent that had not seen the skills being written was told "catch up", with the user unavailable: each question was written to a file and answered "go".

**Result: pass.** One batch of three questions, each with a default (the files to take; Maria López's role worded differently in the brief; the owner's identities), then the run finished: 2 files ingested, 7 new notes, 5 proposals, 2 commits, both files moved to `processed/`, a report in the three-line shape with What came in and Check.

**Skill gaps it found, fixed in CC-26 before review:**
- `settings` absent in `brain status` (0.2.4): defaults now stated (`ask`, `auto`).
- The identities question had no default and needed a mid-run chat approval: default "skip for now"; the batch answer is the approval.
- Pending proposals had no route without Notion: they now go in the batch as chat decisions.
- Drop-folder files moved only inside Publish: they now move after each ingest commit when the run doesn't publish.
- "stop" when the Inbox isn't configured contradicted "skip and go on": the Inbox is skipped, other inputs go on.
- The catch-up report line now starts with `Done:` like every other skill; "Next" without Notion points to chat decisions or connecting Notion; the sources pre-check includes extraction.md's pre-check questions; `from` is only for `update_fact` and `contradiction`.

**Expected with 0.2.4, not gaps:** `UNKNOWN_KEY` warnings for the source `summary` field, and no `settings` in `brain status`, both until CX-24 ships.
