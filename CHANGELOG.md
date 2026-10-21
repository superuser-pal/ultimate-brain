# Changelog

One line per task, under the release that ships it (decision 0038). From 0.4.0 on, `scripts/release.mjs` writes each section from the tasks' `**Changelog:**` lines in build/TASKS.md (decision 0039); don't edit those sections by hand. 0.3.x lines are hand-written.

## 0.4.0 — unreleased

- CX-34 (#99): generate 0.4.0 changelog sections from task rows and gate task-row changelog fields.
- CC-29 (#96): decision 0039: a task's changelog line lives in its build/TASKS.md row and `release.mjs` writes the CHANGELOG section (built in CX-34, documented in CC-30).
- CC-31 (#98): OKF and GBrain reviewed and parked for v2 (reviews/06): a retrieval index over Markdown, and OKF export, then maybe alignment.

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
