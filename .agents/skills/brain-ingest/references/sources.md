# Documents, emails, chat, notes and captures

The procedure for every input that isn't a meeting (decision 0032). Follow the steps below in order; each says when to run a SKILL.md step as it is. There is no meeting note: the **source note** is what every new note cites.

**Without Notion** (not configured, or the Notion tools aren't available in this session): skip every *(Notion)* part. New notes and proposals reach Notion with the next sync; say so in the report. A capture needs Notion: if `brain status` shows `capture_inbox` missing, tell the user to run the brain-connect-notion skill and stop.

## 1. Get the text

One input at a time. Each becomes one source with a `kind`.

### `document`: a file the user names
1. Check the file exists, then hash it: `shasum -a 256 "<file>"`. The source key is `file:sha256:<hash>`.
2. Convert it, by agent and file type:

   | File | Claude Code | Codex |
   |---|---|---|
   | `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` | **Read** it yourself; converter `claude-read` | `.pdf`: MarkItDown. Images: say you can't read them, and stop |
   | `.docx`, `.pptx`, `.xlsx`, `.xls`, `.html`, `.htm`, `.msg`, `.epub`, `.csv` | MarkItDown | MarkItDown |

   - **MarkItDown:** `markitdown "<file>"` prints Markdown. The converter is `markitdown <version>`, from `pip show markitdown` (or `pipx list`). If it isn't installed, tell the user to run `pipx install 'markitdown[all]'` and stop.
   - **Reading it yourself:** a PDF of more than 10 pages is read in page ranges of at most 20 pages. Transcribe the text **verbatim** into Markdown: keep headings, lists and tables (as Markdown tables), and describe a figure in one line in brackets (`[Chart: revenue by quarter, 2025–2026]`). Never summarise or reword while transcribing; the summary comes later, in the notes.
   - **Repair conversion damage only:** broken character encoding (`LÃ³pez` → `López`, `Â·` → `·`) and words split by a line wrap (`wor`/`k` → `work`). Everything else stays as written, including typos.
3. **Long documents:** past about 30 pages, ask the user which parts matter before ingesting. The source body is then those parts only, each under its original heading.

### `email`, `chat`, `note`: text the user pastes
The body is the pasted text, verbatim. The source key is `agent:<agent>/<date>-<slug>`, for example `agent:claude-code/2026-10-14-acme-budget-email`.

### `capture`: Capture Inbox rows *(Notion)*
Query the Capture Inbox (`notion.databases.capture_inbox`, through its data source as in [notion.md](notion.md)) for rows with Brain Status = **New**, oldest first. Never take Processed or Skipped rows. For each row, the body is the row's Name, then its page body if it has one, verbatim. The source key is `notion:<row page id>`.

## 2. Pre-check

As in SKILL.md step 3, **one** question, only if something blocks:
- the title or date is unclear (a document's own date, an email's sent date; if there is none, use today and say so);
- which project or area it belongs to, when the text doesn't say and the user didn't;
- one name spelled several ways.

The user's answers that add content are owner rulings (decision 0031, [extraction.md](extraction.md)).

## 3. Snapshot the source

Build the source item ([cli-inputs.md](cli-inputs.md) §1b) and run `brain note new --dry-run` with it alone:
- **`skipped` with `DUPLICATE_SOURCE`:** already ingested (the same text, the same file, or the same capture row). Report it. For a capture, still set the row to Processed (step 7). Stop here for this input.
- **Otherwise:** keep the item for step 6.

## 4. Match and load context

Run SKILL.md steps 4 and 5 as they are, with the names in the text in place of attendees.

## 5. Analyse

Follow [extraction.md](extraction.md), including "By source kind".

## 6. Write new notes

Run SKILL.md step 7 as it is (ids from `brain id new`, the dry run for paths, links, the real run; [example-batch.json](example-batch.json) shows the shapes), with one difference: there is no meeting note. The batch holds the source and the new notes (people, decisions, questions, concepts); every new note lists the source in `sources`; decisions and questions have no `decided_in` or `raised_in`.

Then run SKILL.md step 8 (propose changes) and step 9 (rebuild and check) as they are.

## 7. Log, commit, publish

1. Run `brain log ingest <source id> created=<n> proposals=<n> tasks=0`. Commit: `ingest: <title> (<kind>) (<n> new, <n> proposals)`.
2. *(Notion)* Publish the new notes and proposals: `brain sync render --changed`, write through the MCP, `brain sync record` ([notion.md](notion.md) "Publish", step 2; sources themselves are never published). Commit `publish: <title>`.
3. *(Notion, captures only)* Set the row's **Brain Status** to **Processed** through the MCP. Change no other property and not the page body. If this write fails, the next run finds the row New again, skips it as a duplicate and sets it then.

## 8. Report

SKILL.md step 12. Action items found in a document, email or capture are listed in the report: there is no meeting to attach them to, so no Notion tasks are created.
