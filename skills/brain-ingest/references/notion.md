# Notion steps (Notion mode only)

The CLI never calls Notion (spec/cli.md §1). You read and write Notion through the Notion MCP (decision 0015), and the CLI builds and records the payloads. Database ids are in `brain.json` under `notion.databases` (see `brain config get notion`).

## Fetch (SKILL.md step 2)

1. Query the `meetings` database for pages where **Brain Status = Reviewed**, sorted by Date ascending. `brain.json` holds database ids; Notion queries take the **data source id**: retrieve the database first and query its `data_sources[0].id`.
2. For each page, read:
   - **page id:** becomes `notion:<id>` as the source key, and the meeting note's `notion`;
   - **`last_edited_time`:** becomes the source's `origin_edited`;
   - **Name and Date:** become the meeting's title and date;
   - **Attendees, Project, Area:** relations to Notion pages. Map each page id back to a brain note through the `notion` field in `brain index --json` (`notes[].notion`);
   - **the minutes:** see "What counts as minutes" below;
   - **attachments:** file, PDF and image blocks in the body, and any Files property: [sources.md](sources.md), "Attachments". They are never part of the minutes text.
3. **Put the Notion page id on the meeting note:** add `"notion": "<meeting page id>"` to the meeting's `frontmatter` in the `note new` batch. Publishing (step 11) updates that existing page and never creates a meeting page, so without the id `sync render` reports `MEETING_NOT_PUBLISHED`.

### What counts as minutes

The minutes are the page body **without the template parts**. Leave out:
- the "Minutes format" callout (it holds the prompt, not minutes);
- the "Before marking Reviewed" checklist;
- the linked or inline Decisions, Questions and Tasks views.

What remains has two parts:
- **Minutes:** the AI-written minutes in the body. When the page holds a Notion AI meeting-notes block (`<meeting-notes>`), take only its `<summary>`; the transcript and the empty `<notes>` stay out.
- **The user's notes:** the "My notes" toggle, or any other text the user wrote on the page.

**Source body, built the same way every time,** so the duplicate check (`content_hash`) recognises a re-run:
1. `## Minutes`, a blank line, then the minutes;
2. if the user's notes are not empty: a blank line, `## My notes`, a blank line, then the notes;
3. drop wrapper tags (`<meeting-notes>`, `<summary>`, `<details>`) and the indentation they add;
4. remove Notion AI footnote links (` [^/p/…]`, with the space before them); they cite the transcript and can be half the text;
5. trim trailing spaces on every line; LF line endings.

**Thin summary:** if the AI summary is very short for the meeting (a few lines for a long meeting, or no decisions and no action items although the meeting clearly had some), offer to include the transcript, in the pre-check question. If the user agrees and your Notion tool can read it (the page markdown says how), add a third part after the user's notes: a blank line, `## Transcript`, a blank line, then the transcript, built the same way (rules 3–5). If the tool can't read it, say so and ingest the summary.

When the user's notes and the minutes disagree on a fact, ask in the pre-check (SKILL.md step 3). The answer is an owner ruling ([extraction.md](extraction.md), decision 0031). Without an answer, mark the claim `^[ambiguous]`.

**Read-only rule:** never change the meeting page's title, date or body (decision 0007). The ingest only sets relations and Brain Status / Ingested At, through `sync render`.

## Publish (SKILL.md step 11)

Do these in order, after the ingest commit: pages first, so every task's project, meeting or Inbox row exists when the task is created.

**Write in parallel** (decision 0037). Within each step, send the writes that don't depend on each other as parallel tool calls in one turn, up to 10 at a time (Notion limits the request rate). Don't read a page back after writing it: the write's response holds its id. Read a page only when the write needs its current content, such as a project's blocks before a section is replaced.

1. **Pages: notes, meeting, sources and proposals:**
   1. Run `brain sync render --changed`.
   2. For each item:
      - **`action: create`:** create a page in `database_id` with `properties`.
      - **`action: update`:** update `page_id` with `properties`.
      - **`action: trash`** (a Review row decided more than 30 days ago, decision 0045): move `page_id` to Notion's trash (update the page with `in_trash: true`; `archived: true` on API versions before 2025-09). Nothing else. Record it like any other write; the proposal stays in the brain.
      - **Meeting and Inbox relations with `"mode": "add"`:** add the listed pages and keep the existing ones.
      - **`"mode": "if_empty"`:** write only if the property is empty in Notion.
      - **`body` (decisions, questions, concepts, references):** replace the page body with it.
      - **`body` and `sections` on an Inbox item** (a source, or a report): see "Inbox bodies" below. A capture's or an Ask row's page body is the user's: render never gives one a body.
      - **`sections` (projects):** replace only the children of the toggle heading with that exact name ("Brief", "Decision log"). Read the page's blocks first (decision 0033):
        - **the page has no toggle headings at all** (created without the template): append a "Brief" and a "Decision log" toggle heading, in that order, at the end of the page, then fill them;
        - **the page has other toggle headings but not this one:** report `SECTION_NOT_FOUND` for that page and change nothing on it (a rename is likely, 0026).
      - **`sections` (areas, decision 0041):** the "Brief" toggle the same way, except that a page without a "Brief" toggle heading gets one appended at the **end** of the page, then filled, whatever other toggles it has. The page is the user's, so never insert above their content; they can drag it up once.

      **Writing a section through the MCP: the block API only** (decision 0043). List the toggle's children, delete them, and append the new ones as blocks. Never write a section through the Markdown page update, even on a page that holds nothing else: it flattens the toggles and can delete the user's content.

      **`properties` with `"Full text": { "type": "checkbox", "value": false }`** clears the row's box: send it as any other property.
   **`PROJECT_NOT_IN_NOTION`** in `errors`: a project note with no Notion page (written before 0.2.2, or by hand). Never create the page through the API: it would miss the template. Report it, and ask the user to create the project with **New project** in Notion under the same name and put the note's id in its **Brain ID**, so the next sync links the two.
   3. **Pending relations:** items that list `pending_relations` reference notes not yet published. Publish and record those first, then run `sync render --changed` again.
   4. Run `brain sync record` with one record per page written: `{ "id", "notion": <page id>, "synced_at": <now>, "published": <the item's published> }`.
2. **Tasks,** now that the pages they link to exist (decision 0037). If `brain status` shows `tasks_database: true`:
   1. Run `brain sync tasks --meeting <mtg-id> --input <items.json>`, or `--source <src-id>` for the owner's tasks from any other source.
   2. Create one Notion page per returned item **without** `pending_relations`, in its `database_id` with its `properties`. An item with `pending_relations` names a page not yet in Notion (a project, or the source's own Inbox row): **don't create it**: after step 1 that page is a project not in Notion yet, so leave the item out and list it in the report. An `owner` of type `person_name` is written as text, or resolved to a Notion user if the mapped property is a people property.
   3. Run `brain sync record` with `{ "records": [ { "id": "<mtg-id or src-id>", "synced_at": "<now, ISO 8601 UTC>", "tasks": ["<new task page id>", …] } ] }`. `synced_at` is required on every record (spec/cli.md §5.14.6).
3. **Commit:** `publish: <meeting title> <date>`. Then run `brain log publish <mtg-id> pages=<n>`, and commit it with the publish.

### Inbox bodies (decision 0043)

The brain writes the body of the Inbox rows it creates, once:
- **`body`** on a `create`: the row's page content, written as blocks after the row is created. For a source it is the digest: a line saying what the input is, the summary and the key points. For a report it is the report's six sections; a refreshed report comes back as an `update` with a `body` (decision 0045): replace the row's page content with it, then send its properties (Refresh cleared).
- **`sections` `{ "Full text": … }`:** a toggle heading **"Full text"** after the body, holding the text. Create the toggle when the row has none; when it has one, replace its children. Keep the text's headings as headings (one per slide of a deck), Markdown tables as Notion tables, and an email or chat thread as one block per message. Split long text into as many blocks as the API needs (a block holds at most 2000 characters of text, and one append at most 100 blocks), in order, never cutting a word.
- Neither is ever rebuilt or read back (except a report's body on a refresh): an edit you make there stays in Notion.

A report row's **Ask** relation links it to the Ask row it answers. After writing the report row, set that Ask row's **Brain Status** to Processed through the MCP; change nothing else on it.

## If Notion fails partway

`sync record` stores only what you actually wrote. Re-running `sync render --changed` later produces exactly what's still missing. Report the failure and stop; don't retry in a loop. The brain-side ingest is already committed and stays valid.
