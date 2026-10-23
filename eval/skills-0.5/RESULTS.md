# Skills for 0.5.0: blind run results

CC-49 acceptance (decision 0045). Four blind runs on 2026-10-23, on brains built with `scripts/blind-brain.mjs brain-acme <dir>` (CC-41): no Notion ids, no Notion tools in the session, the CLI from the CC-49 branch through a `brain` shim. Each fresh agent had not seen the skills being written, and read only its brain, the inputs in [inputs/](inputs/) and a temporary folder. The user was away: the agent wrote any question to a file and took its default.

**Evidence** is in [runs/](runs/): each run's commits on top of the blind brain, with their full diffs (`git log -p` from the base commit; the base is rebuilt with `node scripts/blind-brain.mjs brain-acme <dir>`), and the questions each agent wrote while the user was away. Run 4's gate is the batch in [runs/report-questions.md](runs/report-questions.md), request 2: it wrote nothing.

The checks that need a real Notion space run in the user's 0.5.0 session (migration 0009, then "catch up"), as for 0.4.0: a Report row's Refresh box cleared after the refresh, and the Ready gate on a live Inbox query. Here the Refresh run uses chat, and the gate runs on an exported query ([inputs/inbox.json](inputs/inbox.json)). The CLI side of both is covered by tests in CC-48 (`tests/full-text.test.ts`, "a Report row: What to fix becomes a report fix …").

## Run 1 · a document with Keep, then its new version

**Told:** "Ingest this document: [v1](inputs/v1/acme-website-requirements-v1.md) — keep just the requirements." Then "Here's a new version of the Acme requirements: [v2](inputs/v2/acme-website-requirements-v2.md)". v2 changes the title, the date and requirement 4's deadline (1 March → 15 March 2027).

**Result: pass.**
- v1: the source with `keep: just the requirements`, and **one** `reference` note, "Acme website: requirements", holding the five requirements verbatim, linked to the Acme website project and its area. No other note, no `add_to_note`, no task. One Review notes row with that note. Lint clean.
- v2: a new source with `replaces` = v1 and v1's Keep. `brain source diff` gave three changed lines; the run proposed one `update_body` on the same reference, folded into one Review notes row ("…: 1 change"), whose body differs from the current one by requirement 4's line only.

## Run 2 · a meeting read again after a fix

**Told:** "I fixed the minutes of the Acme sync of 2026-12-03 … [corrected](inputs/acme-sync-2026-12-03-corrected.md). Read them again." The fix: "Launch moves to February 2027" → "March 2027".

**Result: pass.** A new source with `replaces` = the meeting's source; `source diff` gave the one line; one Review notes row, "From Acme sync: 2 changes", with `notes: []`: ⚠ launch date on Acme website 2027-02 → 2027-03, and a correction line on the meeting note. No new meeting or other note. The report: "Acme sync, read again: 1 change (launch 2027-02 → 2027-03)", and the stale project summary under Check. Lint clean.

## Run 3 · Fix "e: March"

**Setup:** a Review notes row of five fact changes ([inputs/seed-fix.json](inputs/seed-fix.json)); e is "Launch date on Acme website: 2027-02 → 2027-04".

**Told:** "What needs my decision?", then "The Acme sync row: approve it, but fix e: March."

**Result: pass.** The list showed the row lettered a–e, each fact marked ⚠. Apply input: `action: fix`, `fixes: [{change: 4, value: "2027-03"}]`, the reply as `note`. All five changes applied, launch date 2027-03; the report's Fixes line: "From Acme sync, e: launch set to 2027-03, not 2027-04". Lint clean.

## Run 4 · report refresh, and the Ready gate

**Setup:** a report on the Acme website ([inputs/seed-report.json](inputs/seed-report.json)).

**Told:** "Refresh the report on the Acme website." Then the catch-up's read-only pass over [inputs/inbox.json](inputs/inbox.json): six rows as the Notion MCP would return them.

**Result: pass.**
- The refresh passed `refresh` to `report new`: the same id and path, a new `generated_at`, the six sections rewritten from today's notes, *(not reviewed)* on lines resting on drafts, a pending proposal under Gaps.
- The gate: the capture New for 2 days is taken in; the Skipped capture, the New document and the capture 3 hours old are left; the Ready document is taken in with the Keep question in the batch (default all); the Ask row is noted for a new report (Refresh report empty).

## Skill gaps the runs found, fixed in CC-49 before review

- brain-apply: a new fact shows as `(new) → <value>`; a Review notes line ends with its source and date, without a quote; a reply naming a row that shares its source with another is settled by a letter or title only one has.
- Re-reads: a new version keeps the first version's `source_key` and title (Markdown-only too); the meeting note gets one correction line, and stale summaries go under Check; an action item only when its line changed.
- Keep: a new version given directly takes the earlier version's Keep; the digest covers the whole document; a reference's summary carries no version; `plain-text` and `verbatim` listed as converters.
- A user's Inbox row of any Kind is a capture; its file is an attachment taking the row's Keep.
- brain-query: a refresh keeps the file and logs `report-refresh` itself; log and commit come before the publish; `projects` and `area` are left out when the subject has neither.

**Expected, not gaps:** the push failed in every run (no remote); `product-file` lint errors in run 1's second request came from rebuilding the skill mirror while it ran; `learned` dates of today (2026-10-23) fall before the fixture's December dates.

**Noted for later, not in 0.5.0:** an applied fact doesn't refresh a summary that states it (the project's "launching February 2027"); no proposal kind rewrites a summary, so the skills name it under Check. `brain report --help` without a subcommand exits 2.
