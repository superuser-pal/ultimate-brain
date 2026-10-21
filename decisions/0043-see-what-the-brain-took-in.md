# 0043 — See what the brain took in, ask it for a report, review in fewer rows

**Status:** Proposed
**Date:** 2026-10-21
**Amends:** 0026, 0041
**Refines:** 0024, 0037

## Context
U-13 ran 0.3.0 in the first brain: the Notion migration, `brain upgrade`, then two real catch-ups (2026-10-20). The user's findings, from that session and its log:
- **An ingested document is invisible in Notion.** Its Inbox row has a Name, a one-line Summary and the Produced relations. The body is empty, because 0026 publishes no body on Inbox rows. To read what came in, the user opens the original file or deck.
- **Nothing gathers what the brain knows about a subject.** A project page shows its tasks, meetings, open questions and people. It has no view of the documents filed under it and none of its concepts. Notion AI can't fill the gap: it reads only Notion, never the sources or the notes that are still waiting to be published.
- **Too many Review rows.** One catch-up over two meetings wrote 13 proposals, each its own row: aliases, People links, an owner, an answer. Decision 0041 adds one "Review notes" row per ingest on top. The next catch-up decided 9 rows and still added 1.
- **Too slow.** From "go" to the report took 10 minutes for two meetings and one capture. The session ran out of context during the publish, and its summary-and-resume caused a duplicate log line.
- **A capture the user cared about was skipped with no explanation.** The agent judged the capture to be an excerpt of a document already ingested and made "skip" the default answer. The user accepted every default with "go". The report then called it "a duplicate of a source already ingested". That wording reads like the CLI's `DUPLICATE_SOURCE` check, which it wasn't.
- **The minutes format doesn't match how the user takes notes.** The user's own Notion AI prompt writes Action Items first, then Purpose, Background, Current Status, Requirements and Deadlines. The format in notion/minutes-format.md (0024) has neither its structure nor its detail.
- **Smaller ones:**
  - The ingest guessed pronouns from names and corrected them twice.
  - Replacing a project section through the Markdown update flattened a toggle.
  - The user typed a correction into a Review row's Target, which is the wrong field.

The user decided each point in a grill on 2026-10-21.

## Decision
### What an Inbox row shows
- **A digest on every Inbox row the brain creates.** The body says:
  - what the input is (kind, file or URL name, date, length);
  - a short summary;
  - key points by section;
  - the figures and dates as stated;
  - links to the notes it produced.

  A capture's body stays the user's (0026): the brain never writes into a row the user created.
- **The full text, when chosen.** Below the digest, a toggle heading **"Full text"** holds the converted text:
  - headings kept;
  - tables as Notion tables;
  - one heading per slide of a deck;
  - one block per message, with From and Date, for an email or chat thread.

  Images and the exact layout don't come across. The original file stays where it was.
- **Who chooses:** the kind sets a default, and the user can change it in the catch-up's one batch of questions (0037).
  - Emails and chat threads: **full**.
  - Documents and decks: **digest**.

  Each line of the question says what the choice means in Notion, for example: "4. Requirements doc (40 p) → **digest**: Notion gets a summary and key points; to read the document itself you open the file. Say "4 full" to have the whole text in Notion." The user can also ask for part of a document ("5 full, slides 3–9").
- **Asking later:** a **Full text** checkbox on the Inbox row. The next catch-up writes the text into the row and clears the box. A request in chat does the same.
- **Written once, one-way.** Both the digest and the full text are written at ingest, or when they're asked for, and never rebuilt: a source's text doesn't change after ingest (a changed file is a new source, 0032). The brain never reads them back, so an edit there stays in Notion. The source in Git is the real copy (0001).

### Reports on request
- **Two ways to ask:**
  - in chat ("report on the Acme launch");
  - an Inbox row with Kind = **Ask** and the question as its Name. The next catch-up answers it. An Ask row is a request, not a capture: it is never ingested.
- **The answer is a new Inbox row,** Kind = **Report**, named after the question and dated. An Ask row becomes Processed and links to its report; its own content isn't touched. The body has these sections:
  1. **Where it stands:** 3 to 5 lines, as of the report's date.
  2. **Timeline:** dated events, oldest first, one line each, each linked to its meeting, note or source.
  3. **Decisions in force.**
  4. **Open questions and risks.**
  5. **People involved.**
  6. **Gaps:** what the brain doesn't know, such as "no development update since August".
- **Everything the brain knows, marked.** A report includes `draft` notes, each marked *(not reviewed)*. The user asks for everything on purpose. The Brief stays reviewed-only (0041).
- **A snapshot.** A report is dated and derived. It is never ingested back, never rebuilt, and creates no proposal: if reports were ingested, the brain would learn from its own summaries. To refresh one, the user asks again. The brain-query skill gains this as its "report" mode.

### Views
- **Projects and Areas templates:**
  - "What came in?": Inbox rows where Project (or Area) is this page, newest first.
  - "What do we know?": Decisions and Concepts for this page.
- **Home:** a **Brain feed** with recent Inbox History and recently ingested Meetings side by side. There is no new database: every input already has an Inbox row or a Meeting page.

### One Review row per source (amends 0041)
- **The Review notes row of 0041 also carries the low-risk changes** from the same ingest. Each is one lettered item next to the new notes:
  - every `add_link` (People, projects, attendees, deciders);
  - every alias added.

  The user approves the row, approves "all except b, d", or rejects it, as in 0041. An approved link or alias is applied. An excluded or rejected one is closed.
- **Their own rows:** changes to an existing note's text (`update_fact`, `add_to_note`, `contradiction`) and `answer` proposals.
- For the U-13 run this means about 4 rows instead of 15. Nothing is applied without the user's yes (0003 holds).

### Speed
- **The bar,** for a catch-up over two meetings and one capture: from "go" to the report in **under 5 minutes**, and the run never runs out of context.
- **How:**
  - each input is analysed in its own sub-agent, which returns the notes and proposals;
  - Notion is written in one batch at the end;
  - digests and full texts are written once (above).

### Captures that repeat a source
- **Skip stays the default** when a capture repeats a source the brain already has. The question and the report name that source and link its Inbox row: "Skipped: it repeats the Acme requirements (document, 12 Mar; link)".
- **"Duplicate"** is used only for the CLI's `DUPLICATE_SOURCE`.

### Minutes format (refines 0024)
- **The user's prompt becomes the default** in notion/minutes-format.md, with these sections, in this order:
  1. Attendees
  2. Projects
  3. Action Items (checkboxes: owner, deliverable, timing, dependencies)
  4. Decisions
  5. Open Questions
  6. Risks
  7. Meeting Purpose
  8. Background
  9. Current Status
  10. Requirements and Deadlines
  11. Other relevant topics

  It keeps the prompt's rules:
  - nested bullets;
  - names, numbers and qualifications preserved;
  - confirmed kept apart from expected and open;
  - nothing invented.

  Facts & numbers is dropped, because those rules keep the figures where they're said.
- **Projects** lists every project the meeting touched. When the meeting's Project property is empty, the ingest uses this section instead of asking.

### Smaller rules
- **Pronouns:** the ingest writes the person's name or "they". It never guesses a pronoun from a name.
- **Project sections** (Brief, Decision log) are edited through the block API only, never through the Markdown page update.
- **Review rows** get a muted line at the top: "Your corrections go in Note. Target says what changes."

## Consequences
- **Amends 0026:** the brain writes the body of the Inbox rows it creates (digest, Full text toggle, and the report on a Report row). It still never writes into a capture or an Ask row, and never edits Meetings (0007).
- **Amends 0041:** `review_notes` gains link and alias items. In the user guide and in Review, its Kind is still "Review notes".
- **Inbox gains:**
  - the Kinds **Ask** and **Report**;
  - the **Full text** checkbox, which the user sets and the brain clears.

  Report rows have no Produced relations. These go into migration 0006 with the Projects, Areas and Home views and the Review line.
- **spec/schema.md and spec/cli.md** (in CC-36):
  - the digest, full text and report bodies in `sync render`;
  - the link and alias items in `review_notes`;
  - the source field that records the full-text choice;
  - the Report row in the render.

  CX-37 builds them; brain-ingest, brain-catch-up, brain-query, brain-sync and the user guide follow in CC-37.
- **The extraction rules** (skills/brain-ingest/references/extraction.md) map the new minutes sections. The ingest still reads minutes with other headings (0024).
- **Out of scope:**
  - an owner on Tasks, so that other people's action items become tasks: docs/v2-ideas.md, because the Tasks database is the user's (0018);
  - a "Runs" log database: the Brain feed covers it.
- **Bug #113** (`sync tasks` writes Status as `select` where the database uses `status`) is fixed in a 0.3.2 patch and doesn't wait for 0.4.0.

## Evidence
- The U-13 catch-up session in the first brain (2026-10-20): two runs, 13 proposals, a skipped capture and a mid-run context summary. Issue #113.
- The grill of 2026-10-21 (build/TASKS.md, CC-38).
- Decisions 0001, 0003, 0007, 0018, 0024, 0026, 0032, 0037, 0041.
