# 0045 — Review in one row, fix before ingest, living reports and kept notes

**Status:** Proposed
**Date:** 2026-10-22
**Amends:** 0003, 0026, 0041, 0043
**Refines:** 0007, 0032, 0035

## Context
U-15 put 0.4.0 in the first brain. On 2026-10-22, the user gave this feedback:
- **New questions and risks have no Status.** The brain never writes Status when it creates a question; it writes it once, as Answered, after an approved `answer` (0041). Every new row lands with Status empty, so "What's still open here?" (filter Status is Open) misses it.
- **Pasted emails are messy.** A capture holding a pasted thread carries signatures, disclaimers, quoted copies of earlier replies and tracking links. The user wants a Notion AI prompt that cleans it before the brain reads it.
- **Review doesn't say what it is for.** Add link, Add to note and Update fact rows keep arriving. The user opens a row and can't tell what they are reviewing, what approving achieves, or what they are supposed to do with it. A new user would get lost at this step. The database also never empties: in the first brain, 34 of its 48 Review rows were already applied or closed.
- **Corrections have no clear place.** A row shows Target, Before and After, which are the CLI's words. It isn't clear whether a correction goes in those properties, in Note, or in the minutes. There is no way to say "what came in from this meeting is wrong: I'll fix it, then the brain takes it in".
- **Reports can't be revised.** The Ask → Report flow gives enough, and its content is valuable. But a wrong line can't be corrected, a report can't be extended, and each new ask adds another dated row about the same subject.
- **A document disappears into the brain.** After ingest, the Inbox row says it was processed, but nothing on the project or area page holds what the user wanted from it. The user wants to say what to keep ("just the requirements") and see that, linked to the project.

The user decided each point in a grill on 2026-10-22.

## Decision
### Questions and risks start as Open (0.4.1; amends 0041)
- **The brain sends Status = Open when it creates a question** (any Kind, risks included). After that, Status belongs to Notion, as before: if the user changes it, the brain never sets it back.
- **Approved answers still set Answered,** once (0041).
- **Existing rows:** the next publish sets Status = Open, once, on every published question that has no Status in Notion and no `answer`.

### Clean email (0.4.1; refines 0035)
- **A Brain Assistant skill, `/Clean email`,** also shipped as a plain prompt the user can save on any plan. The user pastes the thread into a new Inbox capture and runs it on that page. After the user confirms, it rewrites the page.
- **Clean, never summarize:**
  - it removes signatures, legal disclaimers, quoted copies of earlier messages, "Sent from" lines and tracking links;
  - it keeps one header per message (From, To, Date, Subject), oldest first;
  - it keeps each message's text word for word.

  The brain then reads the email as it does today, and writes its own digest (0043). If Notion AI summarized first, the brain would cite a paraphrase, and anything Notion AI dropped would be lost.
- **Optionally,** a "Why I saved this" line at the top, written by the user. The skill may suggest one.

### Review says what it is for (0.4.1)
- **The promise, in one line,** at the top of Review and in the muted line of every Review row: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed."
- **Home is where reviewing starts:** a count of what waits, per source ("3 meetings and 1 document waiting for you"), linking to Review. Each Review row links to its meeting or Inbox row.
- **Finished rows leave.** A Review row whose proposal was applied or closed more than 30 days ago is moved to Notion's trash at the next catch-up. Git keeps every proposal. "What did I approve recently?" still shows the last month.

### One Review row per source (0.5.0; amends 0041 and 0043)
- **The Review notes row carries everything one ingest proposes,** as lettered items. That includes the `update_fact` and `add_to_note` items that 0043 kept on their own rows:
  - fact changes come first, each marked ⚠;
  - then text added to existing notes;
  - then the new notes;
  - then links and aliases.

  A meeting, an email and a document each give one row.
- **Own rows only for judgment calls:** `contradiction` (two sources disagree), `supersede` (a new decision replaces an old one), `merge` (a possible duplicate) and `answer`.
- **"All except e" defers e, it doesn't reject it.** Every excluded item moves to a row of its own, still pending, so the user can approve the rest without deciding about e yet. Rejecting the whole row still rejects every item.
- **A stale item is dropped alone.** When a fact changed since the row was written, only that item is closed (stale), and the catch-up's report names it. The rest applies.
- **The brain repeats every correction it read** in its report ("e: launch set to March, not February").
- Nothing is applied without the user's yes. 0003 holds: what changes is how many rows the user decides, not whether they decide.

### The words on a Review row (0.5.0)

| Today | Becomes | Who writes it |
|---|---|---|
| Target | **About** | the brain |
| Before | **Now** | the brain |
| After | **Proposed** | the brain |
| Why | **Why** | the brain |
| Decision: Approve / Reject / Edit | **Your call: Approve / Reject / Fix** | the user |
| Note | **What to fix** | the user |

- **Fix** means "apply it, corrected as I wrote in What to fix", in plain words ("Lucía is on Acme website, not Acme app", "e: March"). The brain applies its corrected version and says in the report what it changed. Fix works on every Kind (today Edit is refused on links and Review notes rows).
- State keeps its values: Pending, Applied, Closed.
- The muted line becomes: "Pick Your call. To correct something, pick Fix and say what's wrong in What to fix."

### Fix first, then ingest (0.5.0; refines 0007 and 0032)
- **Two kinds of wrong, two places:**
  - **The input itself is wrong** (minutes that misheard a name, a messy email): fix it before the brain reads it.
  - **The brain read it wrong** (wrong project, a suggestion taken as a decision): Fix on the Review row.
- **Meetings:** the meeting template says "Check the minutes, fix them, then set Brain Status to Reviewed". The brain still ingests only Reviewed meetings and still never edits a meeting (0007).
- **Inbox rows wait for Ready.** A catch-up takes in an Inbox row only when its Status is **Ready**. A capture becomes Ready on its own 1 day after it was created, so a forgotten Status doesn't break the habit. Documents and emails wait for the user, because they usually want a check, a Keep (below) or `/Clean email` first. Ask rows are not ingested, so they don't need Ready: a catch-up answers them as before.
- **Re-reads.** After an ingest, a user who fixes the input sets it back to Reviewed (meeting) or Ready (Inbox row). The next catch-up reads it again. The new text is a new version of the source, linked to the old one; the old version stays in Git, unchanged (0032). The brain proposes only what changed between the versions, in one Review row. Today a second ingest of the same meeting is refused as a duplicate (`DUPLICATE_SOURCE`).

### Living reports (0.5.0; amends 0043)
- **One report per subject, kept up to date.** A report row is rewritten in place with a new "as of" date, not added again. Git keeps every earlier version.
- **How to refresh:**
  - tick **Refresh** on the Report row: the next catch-up rewrites it and clears the box;
  - or create an Ask row with its **Refresh** relation set to the report: the catch-up updates that report and links the Ask row to it. An Ask row with Refresh empty creates a new report.

  The brain never guesses that two questions are the same.
- **Correcting a report:** the Report row gets the same **What to fix** field. The user writes what's wrong ("Lucía left Acme in June"). The next catch-up turns it into Review items on the notes, because the error lives in the notes, not in the report. The report is refreshed once the user approves them.
- **Where reports live:** a **Reports** tab on the project and area pages, filtered from the Inbox (Kind is Report, Project or Area is this page). Ask rows stay in the Inbox.
- **Still never ingested** and never a source: the brain doesn't learn from its own summaries (0043).

### Documents: say what to keep (0.5.0)
- **A Keep field on the Inbox row** (text): "just the requirements", "the price list and the deadlines". If a document's Keep is empty, the catch-up asks for it in its one batch of questions: "Acme requirements (document): what do you want from it? all / just …".
- **Keep creates a living note.** It's a new knowledge type, `reference`, with:
  - a title such as "Acme website: requirements";
  - the kept content as its body (a list, a table);
  - links to its project or area and to its source documents.

  It's a draft in the source's Review row like any new note, and it appears on the project or area page under "What do we know?". When a new version of the document arrives (a new source, 0032), the brain proposes the differences to the same note, as items in that source's Review row ("Requirement 4: deadline 1 Mar → 15 Mar"), so the user sees what changed instead of keeping two copies.
- **Keep narrows the extraction:** the brain takes only what Keep names. The source stays in the brain, so the user can ask later: "take the budget from the Acme doc too". An empty Keep with "all" gives today's full extraction.

### Signals for a search index
- **Each catch-up and each report logs** how many notes it read and how long it took. The habit-bar review reads those numbers.
- **The retrieval index** (0008; GBrain read-only, or a local BM25 index) is revisited when a report or answer misses a note the user knows exists, or when the 5-minute bar breaks twice. A research task tests both, together with an always-on operator (see Consequences).

## Consequences
- **Amends 0003:** an excluded item is deferred to a row of its own, not rejected. Every change to existing knowledge still waits for the user's yes.
- **Amends 0026 and 0043:** the brain rewrites a Report row's body when refreshing it; a report is no longer a snapshot that is never rebuilt. It still never writes into a capture or an Ask row.
- **Amends 0041:** the brain writes question Status in two cases, Open at creation and Answered after an approved `answer`. The Review notes row carries fact changes and text additions too.
- **Refines 0007:** the brain still never edits Meetings. The "check, fix, then Reviewed" line is part of the meeting template, which the user's meeting pages start from.
- **Refines 0032:** a re-read source is a new source version with a link to the version it replaces.
- **Refines 0035:** the Brain Assistant gains `/Clean email`, its third skill that may edit page text, after Check minutes and Tidy capture.
- **New:**
  - the note type `reference`;
  - the Review properties About, Now, Proposed, Your call and What to fix;
  - the Inbox Status Ready and the Inbox fields Keep, Refresh (checkbox) and What to fix;
  - the Ask row's Refresh relation;
  - the Reports tab on the Projects and Areas templates.

  Each comes with a Notion migration.
- **Releases:** 0.4.1 ships Open on creation, `/Clean email`, the promise line, the Home count and finished rows leaving. 0.5.0 ships the rest.
- **Later** (docs/v2-ideas.md): area homes before the agency brain moves in (0.6.0), and Hermes as an always-on brain operator.

## Evidence
- U-15, the first brain on 0.4.0: 48 Review rows, of which 32 applied and 2 closed; 10 Review notes rows and 4 other rows pending. 58 notes, about 340 KB of Markdown.
- The grill with the user, 2026-10-22, recorded in CC-44 (build/TASKS.md).
- decisions/0041, 0043; spec/cli.md §5.14.4 (question Status), §5.6 (`review_notes`); spec/schema.md §11.2.
- reviews/06-okf-and-gbrain.md §5 and decision 0008 for the search index.
