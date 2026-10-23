# Changelog

One line per task, under the release that ships it (decision 0038). From 0.4.0 on, `scripts/release.mjs` writes each section from the tasks' `**Changelog:**` lines in build/TASKS.md (decision 0039); don't edit those sections by hand. 0.3.x lines are hand-written.

## 0.5.0 — 2026-10-23

- CC-52 (#129, #130): `/Clean email` rewrites the page directly (asking only on a serious doubt) and gives each message, newest first, a heading with names and date, its own text below it and a divider before the next: no addresses, Subject, Cc, banners or Teams, Zoom and Meet blocks.
- CC-47 (#127, #128): contracts for 0.5.0: one Review row per source with Fix, the Ready gate and re-reads, living reports, and `reference` notes from a document's Keep.
- CC-48 (#133): the CLI folds fact and text changes into one Review row per source, defers excluded items, applies Fix, re-reads a corrected source, refreshes reports and writes `reference` notes.
- CC-49 (#135): catch-up asks what to keep from each document, takes in only Ready rows, re-reads corrected sources, reads Fix and What to fix, and refreshes reports.
- CC-50 (#136): research on Hermes as an always-on brain operator and on a search index (GBrain read-only or local BM25).
- CC-53 (#131): AGENTS.md says how agents launched by Orca follow the task workflow: worktrees from `task.mjs`, Claude builds, Codex reviews, TASKS.md stays the task list.
- CC-54 (#132): brain-sync writes the snapshot's `as_of` once at the top, so `sync plan` no longer refuses its rows with "unknown key".

## 0.4.1 — 2026-10-23

- CC-44 (#123): decision 0045 records the first brain's feedback: 0.4.1 starts questions as Open, adds `/Clean email`, says what approving does and clears finished Review rows; the rest is planned for 0.5.0.
- CC-51 (#124): decision 0046: a task can start from the branch of the task below it, and Codex reviews a stack of PRs in one session.
- CC-45 (#125): new questions and risks reach Notion as Open, and Review rows leave Notion 30 days after they were decided.
- CC-46 (#126): a `/Clean email` prompt for pasted threads, a Review that says what approving does, a Home count of what waits for you, and catch-ups that trash finished Review rows.

## 0.4.0 — 2026-10-21

- CC-29 (#96): decision 0039: a task's changelog line lives in its build/TASKS.md row and `release.mjs` writes the CHANGELOG section.
- CX-34 (#99): `release.mjs` writes each release's CHANGELOG section from the task rows; PRs no longer edit CHANGELOG.md.
- CC-30 (#105): AGENTS.md, the PR template and the release guide describe the `**Changelog:**` field.
- CC-34 (#110): the status banner after the 0.3.1 release: decision 0040 merging, the open 0.4.0 theme choice.
- CC-41 (#120): a script builds a blind-run brain from a fixture, with its Notion ids blanked and its first commit made.
- CC-31 (#98): OKF and GBrain reviewed and parked for v2 (reviews/06): a retrieval index over Markdown, and OKF export, then maybe alignment.
- CC-35 (#111): the 0.4.0 plan: the brain gives back (reviewed notes, answered questions, Briefs) and takes in linked repos and Notion attachments (decisions 0041, 0042).
- CC-38 (#114): decision 0043: Inbox rows show a digest or the full text, reports on request land in the Inbox, one Review row per source, a 5-minute catch-up, and the user's minutes format.
- CC-39 (#116): decision 0044: Claude Code builds every task, the CLI included, and Codex reviews every PR.
- CC-36 (#115): contracts for 0.4.0: the `review_notes` and `answer` proposals, Briefs from reviewed notes and for areas, linked repos and Notion attachments as sources.
- CC-42 (#118): the CLI applies Review notes and Answer rows, writes the backlog's rows once, builds Briefs from reviewed notes, for areas too, writes each source's digest and, when asked, its full text to the Inbox, and stores reports.
- CC-43 (#119): the CLI reads linked repos (changed files since the last ingested commit) and takes files attached in Notion as sources under their Inbox row or meeting.
- CC-37 (#121): catch-up writes Review notes and Answer rows, writes the backlog's rows on the first run, reads linked repos and Notion attachments, and the guide explains Briefs and reviewing notes.

## 0.3.2 — 2026-10-21

- CC-40 (#117): `brain sync tasks` types the Status value by `notion.tasks.status_type` (`status` for Notion's built-in Status, as in the default Tasks database; absent or `select` as before), so new tasks no longer fail on that database (#113).

## 0.3.1 — 2026-10-20

- CC-28: the 0.3.0 retro's tasks: gate fixes for lost CHANGELOG lines, done before merge and merges outside the gate (CX-32); changelog fragments (CC-29) and a blind-run setup script (CX-33) for 0.4.0.
- CC-32 (#100): loose ends: lagging task statuses closed, the guide uses the live Inbox view names, `--version` specified (built in CX-35); dogfood #101 (Concepts created by hand in migration 0005) and #102 (Tasks `source` mapped by default).
- CX-32 (#104): gate scripts: `pr-format` fails a PR that loses another task's CHANGELOG.md line, `merge.mjs` waits out GitHub's UNKNOWN mergeability, `main-guard` fails a merge without the other agent's pass or the user override, `npm run skills` and the pre-commit hook check the skill mirror.
- CX-35 (#103): `brain --version` (text, or the §3.3 envelope with `--json`); tests that a `url:` source needs `kind: document` and `converter`.
- CC-33 (#107): decision 0040: the user merges on the GitHub PR page with a `merge-ready` status in view; `main-guard` no longer checks how a PR was merged.
- CX-36 (#108): the `merge-ready` status on every PR (format, ticked boxes, task done, the other agent's pass); `main-guard` checks only that commits came from PRs (decision 0040).

## 0.3.0 — 2026-10-19

- CC-22 (#90): intake contracts: the Inbox (every source but minutes), Concepts, grouped link reviews with a Note, owner tasks from sources, `brain.json` settings, Area on Decisions and Questions; Notion migration 0005.
- CC-26 (#92): intake skills: "catch up" (one read-only pass, one batch of questions), Review Notes and grouped rows in brain-apply, Inbox rows and owner tasks in brain-ingest, identities and Notion access steps in brain-connect-notion, publish and push settings, the user guide.
- CX-22 (#93): render the brain-owned Area relation for Decisions and Questions from their projects.
- CX-24 (#94): implement grouped link reviews, Inbox and Concepts sync, source tasks, settings status and Inbox upgrade.
- CX-31 (#91): release tags are annotated so `git push --follow-tags` publishes them.

## 0.2.4 — 2026-10-19

- CC-27 (#88): real Notion ids removed from the product docs; the review verdict names the commit it covers and comes after the done commit.
- CX-28 (#86): leak checks in CI and before commits for UUIDs, non-example emails and the local denylist.
- CX-30 (#87): `merge.mjs` requires a pass from the other agent naming the PR's head commit, with an explicit user override.

## 0.2.3 — 2026-10-18

- CC-24 (#80): delivery lanes, one channel (npm) and release gates: decision 0038, the brain's read-only and findings rules, issue and PR templates, the Claude Code plugin retired; the merge gate without GitHub Pro; three real names removed from the skills and docs.
- CC-25 (#84): `merge.mjs` and `release.mjs` accept skipped check runs; a task is marked done before its PR merges.
- CX-29 (#83): refresh product-owned files for both agents, lint their drift, and safely upgrade, commit and push brains.
- CX-27: release, merge and task scripts; main-push and PR-format gates; package smoke test works after a release.
## 0.2.2 — 2026-10-18

- CC-23: new projects are created in Notion; reports grow with the input (decision 0037 amended).
- CX-26: `sync render` refuses project creates (`PROJECT_NOT_IN_NOTION`); "latest" leaves the freshness words.

## 0.2.1 — 2026-10-15

- CC-21: "process my drop folder", the three-line report, faster publish (decision 0037).
- CX-23: an Edit on a link row is a plan conflict.
- CX-25: CLI fixes from the acceptance run.

## 0.2.0 — 2026-10-15

- Sources beyond meetings, the Notion look pass, Notion AI prompts, the user guide (CC-13 to CC-20, CX-18 to CX-20).

## 0.1.x — 2026-10-13

- v1 waves 1 to 4 (build/TASKS.md).
