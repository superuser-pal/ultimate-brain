---
name: brain-catch-up
description: Do everything that is waiting in one run. Pulls the user's Notion edits, applies the reviews they decided, ingests reviewed meetings, new Inbox rows and the drop folder, publishes and pushes, asking every question once at the start and then finishing without stopping. Use when the user says "catch up", "what's next", "do what's waiting" or "process everything".
---

# Catch up

One run for everything waiting (decision 0037). It has two halves: a **read-only pass** that finds the work and every question it raises, then **one batch of questions**, then a run that finishes without asking again. Anything that becomes blocked during the run is **skipped** and listed in the report; the rest goes on.

This skill orders the work; the other skills hold the steps. Read each one before running its part: brain-sync (pull and publish), brain-apply (decisions), brain-ingest with its references (meetings, sources, the drop folder). Their rules apply unchanged, including the trust rules in the brain's AGENTS.md.

Run every CLI command as `brain <command> --brain <brain> --json`. If `brain` is not found (`command not found`), install it with `npm install -g ultimate-brain`, then retry.

## 1. Read-only pass

Write nothing in this step: no CLI writes, no Notion writes, no file moves.

1. **Status.** Run `brain status`; run `brain index` if `index_stale`. Note `settings` and which databases are configured. Without Notion, skip every Notion part below and say so in the report.
2. **Pull plan.** Brain-sync "Pull", steps 2–4: snapshot every configured database (Review included), run `sync plan` once, save `plan.json`. It holds the imports, your corrections, the decided Review rows and the conflicts.
3. **Notes on Review rows.** For each `NOTE_TO_READ` conflict, read the Note against its proposal and decide what it means (brain-apply, "Reading a Note"). Write down the decision you would apply, or the question it raises.
4. **Meetings.** Brain-ingest steps 2 and 3, up to the duplicate check: the Reviewed meetings, oldest first, and each one's pre-check blockers.
5. **Inbox.** The New rows (brain-ingest references/sources.md, "capture"), oldest first, each with its pre-check blockers. A row with Project or Area set needs no project question.
6. **Drop folder.** The queue and its question (sources.md, "The drop folder", steps 1–2), without moving anything.
7. **Your identities.** If `brain.json` has no `owner.person`, add the identities question (brain-connect-notion, "Your identities").

The pass is done when every input that is waiting has been found and each of its blockers is written down as a question or a default.

## 2. One batch of questions

Ask once, in one message, numbered and grouped by input, each with the answer you will use if the user says "go" (the **default**):
- sync conflicts (`BOTH_CHANGED`, `MISSING_REQUIRED`, `UNRESOLVED_RELATION`, …) and your corrections, as brain-sync step 5 shows them;
- each Note you read, as "Note 'all except Tomás' → approve 3 of 4 links (leave out Tomás)";
- each meeting's and input's pre-check blockers;
- the drop-folder list, all files selected;
- the identities question;
- with `settings.publish: ask`: "Publish to Notion at the end?" (default yes). This is the run's only publish question.

When nothing blocks, don't ask: say what you will do in one line and start. When nothing is waiting at all, give the report with `Done: nothing waiting` and stop.

## 3. Run, in this order

1. **Pull and apply.** `sync apply plan.json` (brain-sync steps 6–8), then the decisions you resolved from Notes with `brain apply --input` (brain-apply, "Reading a Note"). Rebuild and commit as brain-apply "Finish", steps 1–3. Conflicts the user didn't answer stay conflicts.
2. **Meetings,** one at a time: brain-ingest steps 4–10.
3. **Inbox rows,** one at a time: sources.md steps 3–7.1.
4. **Drop-folder files** the user chose, one at a time, the same way.

For each input, publishing waits for step 4 below. **Skipped, not asked:** an input whose ingest raises a new question or fails is left as it is (the meeting stays Reviewed, the row New, the file in the queue) and goes on the report's Needs you line. The one hard stop: a lint error in a file this run wrote. Stop the run there, commit nothing more, and report.

## 4. Publish, push, report

1. **Publish** (when `settings.publish` is `auto`, or the user said yes): brain-ingest references/notion.md "Publish", once for the whole run: the tasks of each ingested meeting and source, then one `sync render --changed --plan plan.json` for everything, then `sync record`, log and commit. Set Brain Status = Skipped on the Inbox rows the user skipped. Then move the drop-folder files (sources.md, "The drop folder", step 4).
2. **Push** per `settings.push` (AGENTS.md, "Write path").
3. **Report** once, in the shape of brain-ingest step 12, for the whole run, the decisions included:
   ```
   Applied 9 · Ingested 3 captures, 2 files · 12 new notes · 1 task for you
   Needs you: 3 Review rows (1 grouped) · 2 files skipped (too long, say which parts)
   Next: decide in Notion, then "catch up"
   ```
   Below the three lines: **What came in** and **What changed**, then **Check** (each skipped input with its reason, stale proposals, assumptions), as brain-ingest step 12 and brain-apply "Finish" step 5 define them, uncapped. Offer the `settings.publish` switch here when AGENTS.md says to.
