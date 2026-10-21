# Skills for 0.4.0: blind run results

CC-37 acceptance (decisions 0041–0043). Three blind runs on brains built with `scripts/blind-brain.mjs brain-acme <dir>` (CC-41): no Notion ids, no Notion tools in the session, the CLI from the CC-37 branch through a `brain` shim. Each fresh agent had not seen the skills being written and read only the brain, its inputs and a temporary folder. The user was away: the agent wrote its question batch to a file and took every default.

The checks that need a real Notion space (the 5-minute catch-up over two meetings and a capture, a ticked Full text box, a Report row from an Ask row) run in U-15, the user's 0.4.0 session (the user's choice, 2026-10-21).

## Run 1 · catch-up with a document in the drop folder · 2026-10-21

**Input:** [catch-up/drop/acme-mobile-handover.md](catch-up/drop/acme-mobile-handover.md). It answers the fixture's open question "Who owns the Acme mobile app?", records a decision that passes the gate, adds a person to the Acme website project, and is signed with a new spelling of Maria López's name. The brain's `AGENTS.md` names the drop folder.

**Told:** "catch up". **Time:** 13:55:09 → 13:57:57 UTC (about 3 minutes).

**Result: pass.**
- One batch of questions, then the run finished; no second question.
- `proposal backlog` wrote one Review notes row per older source: Acme sync (3 notes), Acme kickoff (1).
- The ingest wrote **one** Review notes row, "Accept 3 new notes from Acme mobile app: handover note (document), and 2 links": the new person, decision and risk, plus the People link (Nadia Okafor on Acme website) and the alias (Mari López on Maria López) as lettered items inside it.
- One **Answer** row on "Who owns the Acme mobile app?": "Carlos Ruiz takes over ownership of the Acme mobile app from 1 January 2027."
- Lint clean after each write; the file moved to `processed/`; the report in the three-line shape, with the Notion choice (digest) per input.

## Run 2 · catch-up with a linked repo · 2026-10-21

**Input:** a synthetic `acme-api` repo built from [repo/](repo/): commit 1 adds `decisions/0001-use-postgres.md` and is recorded as ingested; commit 2 adds `decisions/0002-rate-limit-public-endpoints.md` and `src/limits.ts`; commit 3 adds `docs/vision.md` and deletes 0001. Patterns: `decisions/**`, `docs/vision.md`.

**Told:** "catch up". **Time:** 13:55:07 → 13:57:53 UTC (about 3 minutes).

**Result: pass.**
- `brain repo changes` listed only 0002 and `docs/vision.md`; `src/limits.ts` was left out, and the deleted 0001 was reported once and changed nothing.
- Each file was ingested as a `document` with `repo`, `repo_path`, `commit` and `converter: verbatim`: a new decision with its Review notes row, and an `add_to_note` for the vision.
- `brain repo record` stored the new commit, committed with `brain.json`.
- One batch of questions, lint clean.

## Run 3 · report on a project · 2026-10-21

**Told:** "report on the Acme website project: where do we stand?"

**Result: pass.** `brain report new` stored `reports/2026-10-21-acme-website-where-we-stand.md` with exactly the six sections in order; the timeline runs oldest first (2026-10-01 → 2026-12-10), each line linked; every line resting on a `draft` note ends with *(not reviewed)*; Gaps names what the brain doesn't know and the proposal still pending. Not published (no Notion). No question was needed.

## Skill gaps the runs found, fixed in CC-37 before review

- Catch-up: one sub-agent per input was required even for one small file → inputs of a page or two, or a run with one input, are analysed inline; so is every input when the session can't start sub-agents.
- `summary` and `digest` didn't say they go in `frontmatter` (one run got `INPUT_INVALID` first).
- Without Notion: the full-text choice and the publish question are left out of the batch; the Next line is deciding in chat.
- The backlog's rows were a surprise in the report: the read-only pass now runs `proposal backlog --dry-run` and names them in the batch's opening line.
- A new spelling of a known person fitted both the alias rule and the "one name spelled several ways" blocker: the blocker is now only for names no person note settles.
- `add_to_note` on a project for a document about an area only: none; a link in `content` is relative to the target note.
- Report mode: `projects` and `area` take ids; *(not reviewed)* goes on a line whose linked note is `draft`, even after an approved proposal; a pending proposal goes under Gaps; the chat answer is "Where it stands" and the Gaps.

**Expected, not gaps:** the push failed in every run (the blind brains have no remote); the report run's `product-file` lint errors came from building that brain before the mirror was rebuilt; `learned` dates of today (2026-10-21) are earlier than the fixture's December dates, because the fixture is dated in the future.
