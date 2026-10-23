---
name: brain-catch-up
description: Do everything that is waiting in one run. Pulls the user's Notion edits, applies the reviews they decided (Fix included), ingests reviewed meetings, Inbox rows that are Ready, their attachments, the drop folder and linked repos, reads again the inputs the user corrected, writes and refreshes the reports asked for on Ask and Report rows and the full texts asked for on Inbox rows, publishes and pushes, asking every question once at the start and then finishing without stopping. Use when the user says "catch up", "what's next", "do what's waiting" or "process everything".
---

# Catch up

One run for everything waiting (decision 0037). It has two halves: a **read-only pass** that finds the work and every question it raises, then **one batch of questions**, then a run that finishes without asking again. Anything that becomes blocked during the run is **skipped** and listed in the report; the rest goes on.

This skill orders the work; the other skills hold the steps. Read each one before running its part: brain-sync (pull and publish), brain-apply (decisions), brain-ingest with its references (meetings, sources, attachments, the drop folder, linked repos), brain-query (reports). Their rules apply unchanged, including the trust rules in the brain's AGENTS.md.

**The bar** (decision 0043): over two meetings and one capture, from "go" to the report in under 5 minutes, without the session running out of context. So each input is analysed in its own sub-agent (step 3), Notion is written in one batch at the end (step 4), and nothing already in Notion is written twice. Note the time when the user says "catch up" (or the run starts), and count the notes whose full text the run and its sub-agents read: the run logs both at the end (decision 0045).

Run every CLI command as `brain <command> --brain <brain> --json`. If `brain` is not found (`command not found`), install it with `npm install -g ultimate-brain`, then retry.

## 1. Read-only pass

This step changes no knowledge: no note, proposal, `brain.json`, commit, Notion page or drop-folder file. Two writes are allowed because they change nothing the user owns: `brain index` may regenerate a stale `index.md` (generated, rebuilt again later in the run), and the working files (`snapshot.json`, `plan.json`, conversions) go in a temporary folder outside the brain.

1. **Status.** Run `brain status`; run `brain index` if `index_stale`. Note `settings` (absent means `publish: ask`, `push: auto`) and which databases are configured. Each Notion part below needs its database configured; skip the ones that aren't and name them once on the report's Needs you line.
2. **Pull plan.** Brain-sync "Pull", steps 2–4, with the snapshot and plan in the temporary folder: snapshot the databases brain-sync step 2 reads (Areas, Goals, Key Results, Projects, People, Orgs, Decisions, Questions, Concepts, References, Review; never Meetings), whichever are configured, plus the **Inbox rows whose Full text box is ticked** and the **Report rows with Refresh ticked or a What to fix**, with only the properties brain-sync step 2 names; run `sync plan` once, save `plan.json`. It holds the imports, your corrections, the decided Review rows, the conflicts, `full_text_requests` (one per ticked box on a source the brain wrote), `refresh_requests` and `report_fixes`.
3. **What to fix on Review rows.** For each `NOTE_TO_READ` and `FIX_TO_READ` conflict, read What to fix against its proposal and decide what it means (brain-apply, "Reading What to fix"). Write down the decision you would apply ("a: launch 2027-03"), or the question it raises. A `FIX_WITHOUT_TEXT` row goes in the batch as a question: "Acme launch review: Fix, but What to fix is empty: what's wrong?"
4. **Meetings** *(Notion)*. Brain-ingest steps 2 and 3, up to the duplicate check: the Reviewed meetings, oldest first, and each one's pre-check blockers. A meeting the brain already ingested and that is Reviewed again is a **re-read** (decision 0045): the user fixed its minutes; say so in the batch ("Acme sync, read again: only what changed"). Minutes files are ingested only when the user names them, never looked for.
5. **Inbox.** The rows **ready to take in** (brain-ingest references/sources.md, "capture"; decision 0045): Brain Status **Ready**, and captures still **New** a day or more after they were created. Never a Skipped row, nor a New document, email, chat or note row: those wait for Ready. Oldest first, each with its pre-check blockers. A Ready row with a Brain ID is a **re-read**, as for meetings. A row with Project or Area set needs no project question. A document's empty **Keep** goes in the batch: "Acme requirements (document): what do you want from it? all / just …" (default all). A capture that repeats a source the brain already has: default skip, naming that source and linking its row (sources.md, "Pre-check").
   **Ask rows** (Kind = Ask, Brain Status New) are requests for a report, not captures, and need no Ready: never ingest one; note its question (the Name), its Project or Area and its **Refresh report** relation, if set, for the report ("Run", step 6).
   **Attachments** on the rows taken in and the Reviewed meetings: list each file (sources.md, "Attachments"), all selected by default, each with its row's Keep.
6. **Drop folder.** The queue and its question (sources.md, "The drop folder", steps 1–2: what to keep from each file, and whether one is a new version), without moving anything.
7. **Linked repos.** For each entry of `repos` in `brain status`: `brain repo changes <name>` (sources.md, "Linked repos"). A repo with `found: false` is named on the Needs you line. More than 10 files: they go in the batch as a list, default all.
8. **The full-text choice.** For each input that will get its own Inbox row (not a capture, an attachment or minutes), the default by kind: emails and chats full, documents and decks digest. Without an Inbox database (`inbox` missing), there is no row: leave the choice out of the batch, and the CLI's default stands for a later publish.
9. **Reports.** From `plan.json`: each `refresh_requests` item, and each `report_fixes` item with the proposals its text would become (brain-query, "What to fix on a report"), written down like a Review row's What to fix. Also each report whose last `fixes` entry lists only proposals now applied or closed, and that wasn't refreshed since: it is due a refresh.
10. **The backlog.** `brain proposal backlog --dry-run`: the Review notes rows the run will write once for notes from before 0.4.0. They need no question; name them in the batch's opening line ("I'll also write 2 Review notes rows for older notes").
11. **Pending proposals in chat.** Without a Review database, run `brain proposal list --status pending,approved,edited,rejected`: these go in the batch as chat decisions (brain-apply, chat mode, steps 2–3).
12. **Your identities.** If `brain.json` has no `owner.person`, add the identities question (brain-connect-notion, step 6).

The pass is done when every input that is waiting has been found and each of its blockers is written down as a question or a default.

## 2. One batch of questions

Ask once, in one message, numbered and grouped by input, each with the answer you will use if the user says "go" (the **default**):
- sync conflicts (`BOTH_CHANGED`, `MISSING_REQUIRED`, `UNRESOLVED_RELATION`, …) and your corrections, as brain-sync step 5 shows them;
- each What to fix you read, as "Acme sync: 'all except b' → approve the rest, b waits in a row of its own" or "Acme sync: Fix 'a: March' → launch date 2027-03";
- each meeting's and input's pre-check blockers;
- the pending proposals, as brain-apply's chat list (default: leave them pending);
- the drop-folder list, all files selected;
- each attachment, all selected, and each linked repo's files when there are more than 10;
- the full-text choice, one line per input that gets an Inbox row, saying what it puts in Notion: "4. Requirements doc (40 p) → **digest**: Notion gets a summary and key points; to read the document itself you open the file. Say "4 full" to have the whole text in Notion." Parts work too: "5 full, slides 3–9";
- each document's Keep, when its row's Keep is empty (default all), and each likely new version (default yes);
- each Ask row, as "Report on <its question> (default: yes)", or "Refresh <report> for <its question>" when its Refresh report is set; each Report row to refresh, and each report What to fix with the proposals it becomes ("Acme launch report: 'Lucía left Acme in June' → Lucía's org: Acme → none, from June");
- the identities question (default: skip for now, ask again next catch-up). The user's answer is their approval of those aliases;
- with `settings.publish: ask` and Notion configured: "Publish to Notion at the end?" (default yes). This is the run's only publish question. Without Notion there is nothing to publish: leave it out.

When nothing blocks, don't ask: say what you will do in one line and start. When nothing is waiting at all, give the report with `Done: nothing waiting` and stop.

## 3. Run, in this order

0. **The backlog, once** (decision 0041): `brain proposal backlog`. On a brain from before 0.4.0, the first run writes one Review notes row per source over its `draft` notes; every later run writes nothing. Commit any rows it wrote: `review: <n> Review notes rows for the backlog`.
1. **Pull and apply.** `brain sync apply --input plan.json` (brain-sync steps 6–8), then with `brain apply --input <file>`: the decisions you resolved from What to fix (brain-apply, "Reading What to fix"), the chat decisions from the batch (`decided_by: chat`), and the identities. For the identities, run brain-connect-notion step 6 in full, with the batch answer as the user's approval: the owner-ruling source and, when the owner's person note exists, one `add_link` alias proposal per value applied with `decided_by: chat`; when it doesn't, a new person note (`brain note new`) carrying the aliases; then `brain config set owner.person '"<per- id>"'`. Rebuild and commit as brain-apply "Finish", steps 1–3. Conflicts the user didn't answer stay conflicts.
2. **Full texts asked for:** `brain source full-text <source> [--parts …]` for each of `plan.json`'s `full_text_requests`, and for each "full text for …" the user asked in chat. Commit: `full-text: <n> sources`.
3. **Analyse each input in its own sub-agent** (decision 0043): each meeting, Inbox row (with its attachments) and chosen file. A run with one input, or inputs of a page or two each, can analyse them inline instead, one at a time: the sub-agents are there to keep long inputs out of the run's context. Inline is also the way when the session can't start sub-agents. Give each one the brain path, the input (or how to read it), its batch answers and the brain-ingest skill with its references, and have it run, read-only, brain-ingest steps 4–6 and the dry runs of step 7, then return the `note new` batch, the `proposal new` batch (with the input's one `review_notes` and any `answer`), the task items and the report lines. A sub-agent never runs a write, a commit or a Notion call. Run up to 4 at a time. A **re-read** is analysed inline in step 4 instead: its diff needs the new source written first (brain-ingest references/sources.md, "Re-reads and new versions"), and the changed lines are short.
4. **Write them, one input at a time,** in the order of step 1 (meetings oldest first, then Inbox rows, then files): before each batch, check its new notes against what the inputs before it wrote (`brain index`): a person, project or concept another input already created is linked to that note instead of created twice. Then brain-ingest steps 7.3–10 (the real `note new`, `proposal new`, rebuild, check, log, commit). On `INPUT_INVALID` from a path that changed since the dry run, run the dry run again and fix the links.
5. **Linked repos:** their files are inputs of steps 3–4 too; after a repo's last file, `brain repo record`, unless a file failed or the user wants some later (sources.md, "Linked repos", step 4).
6. **Reports,** with brain-query "Report mode":
   1. each report What to fix: its proposals and `brain report fix` (brain-query, "What to fix on a report"). Commit: `report: fix <title>`;
   2. each refresh: a Report row with Refresh ticked, an Ask row with Refresh report set (with `asked_in` = that row's page id), or a report whose last `fixes` entry lists only proposals that are applied, rejected or closed (one recorded with `--record-only` waits). Commit: `report: refresh <title>`;
   3. each other Ask row the user didn't decline: a new report with `asked_in` = the row's page id, its Project and Area. Commit: `report: <title>`.

For each input, publishing waits for step 4 below. **Skipped, not asked:** an input whose ingest raises a new question or fails is left as it is (the meeting stays Reviewed, the row New or Ready, the file in the queue) and goes on the report's Needs you line. The one hard stop: a lint error in a file this run wrote. Stop the run there, commit nothing more, and report.

## 4. Publish, push, report

1. **Publish** (when `settings.publish` is `auto`, or the user said yes), once for the whole run, following brain-ingest references/notion.md "Publish" for each write, in this order. Run `brain views` first, so the project and area Briefs are current:
   1. **Pages:** `sync render --changed --plan plan.json`, write every item (pending relations: publish and record those first, then render again, until no item is pending), `sync record`. This publishes the new notes, the proposals, the meetings' relations, every source's Inbox row with its digest and full text, the report rows (then each Ask row's Brain Status to Processed), the cleared Full text boxes, the project and area Briefs, a question's Status = Open, and the Review rows decided more than 30 days ago (`action: trash`, moved to Notion's trash; decision 0045). Write in parallel, up to 10 at a time, and never read a page back after writing it.
   2. **Tasks,** now that their projects and Inbox rows exist: `sync tasks --meeting` for each ingested meeting and `sync tasks --source` for each ingested source with owner tasks; create each returned item once; `sync record` its page ids. An item still listing `pending_relations` (a project that isn't in Notion) is not created: list it under Check.
   3. Set Brain Status = Skipped on the Inbox rows the user skipped.
   4. Log `brain log publish - pages=<n>` and commit `publish: catch up`.
   5. A meeting read again keeps Brain Status Reviewed until you set it back to **Ingested** through the MCP (brain-ingest step 11): do it for each re-read meeting.
2. **Move the drop-folder files** (sources.md, "The drop folder", step 4): after the publish commit, or right after each file's ingest commit when the run doesn't publish.
3. **Log the run:** `brain log catch-up - notes_read=<n> seconds=<s>`, the notes whose full text the run and its sub-agents read and the seconds from "catch up" to here (decision 0045). Commit it: `log: catch up`.
4. **Push** per `settings.push` (AGENTS.md, "Write path").
5. **Report** once, in the shape of brain-ingest step 12, for the whole run, the decisions included:
   ```
   Done: 9 applied · 3 captures and 2 files ingested · 12 new notes · 1 task for you · 5 old Review rows trashed
   Needs you: 3 Review rows (2 Review notes rows, 1 answer) · 2 files skipped (too long, say which parts)
   Next: decide in Notion, then "catch up"
   ```
   Without Notion, the Next line is deciding in chat ("what needs my decision"), and "connect the brain to Notion" goes on the Needs you line.
   Below the three lines: **What came in** (with each input's Notion choice: "digest" or "full text"; each re-read with what changed) and **What changed**, then the **Fixes** you read, repeated back (brain-apply "Finish" step 5), then the **reports written or refreshed**, each with its row, then **Check** (each skipped input with its reason, each attachment that couldn't be read, the notes kept as drafts or left unchanged by a Review notes row, stale proposals, assumptions), as brain-ingest step 12 and brain-apply "Finish" step 5 define them, uncapped. Offer the `settings.publish` switch here when AGENTS.md says to.
