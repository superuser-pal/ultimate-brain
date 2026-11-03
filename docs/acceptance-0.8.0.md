# Acceptance of 0.8.0 (decision 0055): what is verified and what is left for the user

Synthetic inputs only. "Automated" means `npm test`; "U-23" means a check only the user can make in their own Notion space and brain (the Notion task "Test 0.8.0 in my brain"). Nothing below claims a capability that was not run.

## Automated

| Criterion (CC-82 acceptance, capture-and-review) | Evidence |
|---|---|
| Defaults confirmed once; only selected paragraphs enter; the opening paragraph covered by no item is listed, not copied | `tests/capture-acceptance.test.ts` step 1; `tests/selection.test.ts` |
| No excluded passage is stored in the active brain | `capture-acceptance` step 1 (`everyText` finds no text of the never-selected subject anywhere in the brain's files, `.git` excluded; the journal and the log are read). Text that was selected and later excluded stays in the earlier version, restricted, because source versions are kept (decision 0032); `tests/extract.test.ts` |
| Same selection read again writes and commits nothing | `capture-acceptance` step 2 (`UNCHANGED`, no new commit) |
| Tasks: owner commitment, Waiting On only with the token; an excluded item, an included item whose paragraph was not copied (depends on excluded context), and an item-less Task from an extract create none | `capture-acceptance` step 3; `tests/sync.test.ts` "sync tasks: a waiting_on item…" |
| Task impacts surfaced, never cancelled | `capture-acceptance` step 6 (`cleanup.tasks` lists the Task of the excluded item; no command cancels it) |
| Exclusion after ingestion restricts at once; the independent claim stays | `capture-acceptance` step 5; `tests/eligibility.test.ts` |
| Reconciliation: Remove drops the restricted line only, record becomes `reconciled`, cleanup not proposed again | `capture-acceptance` step 7; `tests/cleanup-row.test.ts` |
| Restore per claim; Keep/Remove for unknown lineage; Reject releases nothing | `tests/cleanup-row.test.ts` |
| Partial accepted edits apply exactly; the user's value is attributed to the user | `tests/review-acceptance.test.ts`; `tests/review-apply.test.ts` |
| A requested revision is recorded, drafted, never applied before acceptance | `review-acceptance`; `tests/review-apply.test.ts` "Request revision is recorded…" |
| Stale acceptance (the target moved) holds | `review-acceptance` (`BASE_CHANGED`); `tests/review-apply.test.ts` |
| Legacy rows keep their rules next to new ones in one plan | `review-acceptance`; `tests/review-plan.test.ts` |
| Pending edits survive publish; no-op reruns duplicate nothing | `review-acceptance` (the row with pending work is withheld whole with `REVIEW_PENDING`; the rerun commits nothing); `tests/review-page.test.ts` (flag cases); `capture-acceptance` rerun |
| Apply is one journaled, committed operation | `tests/review-apply.test.ts` (Op trailer, dirty tree, Git failure); `tests/extract.test.ts` (recover) |
| Excluded evidence closes an Accept stale; reports flag excluded lines; Notion payloads use the eligible form | `tests/review-apply.test.ts`; `tests/report-excluded.test.ts` |
| Optional Domains and module-off behavior | `tests/modules.test.ts` (Domains off by default, MODULE_OFF, nothing lost); `tests/domains-lint.test.ts` |
| Won't Do (status, due and progress) | `tests/tasks-status.test.ts` for the CLI side; the Notion display (`8 completed · 2 dropped`) is U-23 |
| Unattended rules | `tests/unattended.test.ts` for the catch-up plan; the skills' unattended rules for selected input are instructions, U-23 |
| Voice/transcript capture | the same extract flow with `--kind capture` (`tests/extract.test.ts`, `tests/selection.test.ts`); the Voice note template and recording are U-23 |
| Package, types, skills and mirror | `npm run typecheck`, `npm run test:package`, `tests/skills.test.ts` |

## Not automated (U-23: you run these; steps and pass criteria are in the Notion task)

- **Notion behavior:** migration 0013 steps and its Verify list; the Submit buttons; typed tokens surviving a Notion AI regeneration beyond T2; the Voice note template starting at New; the Meetings notice; Won't Do in the Complete group and `8 completed · 2 dropped`; Domains grouping. The migration and templates are instructions, not tested against a live space.
- **The summary generator:** whether Notion AI, given [minutes-format.md](../notion/minutes-format.md), writes ids and verbatim quotes. T6 passed 9 of 10; the repair step was never run. Count unmappable items and paragraph collisions on real meetings: if frequent, sentence-level extraction is the follow-up (capture-and-review §4.2).
- **Recording:** starting a recording from a template or a button is not assumed (T1 verified recording on a page); the paste fallback is documented.
- **Skills with a model:** the skills (brain-ingest `selection.md`, brain-apply `review-items.md`, catch-up) are instructions. No model run followed them in this repository; the user's catch-up run is the first. Record any step an agent could not follow.
- **Buttons (U-22):** whether a click runs after you leave the page and what one click costs in credits.
- **Concurrency:** the read-to-write window between the agent's read and its write of a Review section cannot be closed through the Notion API (capture-and-review §7.4); Notion page history recovers an overwritten sentence.
