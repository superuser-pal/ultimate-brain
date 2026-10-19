# Changelog

One line per task, under the release that ships it (decision 0038). `scripts/release.mjs` refuses a version with no entry here.

## 0.3.0 — unreleased

- CC-22: intake contracts: the Inbox (every source but minutes), Concepts, grouped link reviews with a Note, owner tasks from sources, `brain.json` settings, Area on Decisions and Questions; Notion migration 0005.
- CX-31: release tags are annotated so `git push --follow-tags` publishes them.

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
