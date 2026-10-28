# 0049 — Documents: keep a file as a page, promote a note

**Status:** Proposed
**Date:** 2026-10-28
**Amends:** 0043, 0045

## Context
In U-18 the user attached a requirements document to an Inbox row so that it would be saved and could be referred to later, from any database. The row's Keep was empty. The ingest took that as "all": a full extraction into a concept and a question, and no `reference` note, because 0045 writes one only when Keep names something narrower. A Notion attachment gets no digest and no Full text section either, so the document's readable text existed only in the brain's repo. The user couldn't find it anywhere in Notion. The skill never asked about the empty Keep, although the Keep description in Notion says "empty: the brain asks".

The user wants three things:
- one click to keep a document as a readable page;
- a way to keep only part of it;
- the same for a decision or a concept they want to expand into a page of their own.

The References database (0045) is the place for them, under a clearer name. The user decided each point in a grill on 2026-10-28.

## Decision
### Documents (0.6.0; amends 0045)
- **The References database is renamed Documents,** and the note type with it, wherever the user sees it. The Inbox Kind "Document" becomes **File** (0048), so the two words don't collide.
- **On a project or area page:** "What do we know?" → Decisions · Questions · Documents.

### Keep as document (0.6.0; amends 0043 and 0045)
- **The "Keep as document" button** (0048) on an Inbox row ticks Keep as document and sets the row to Ready.
- **With "Only keep" empty:** the catch-up writes one Document holding the input's **whole converted text, verbatim**: the file's text, or the page's for a web page. It isn't the brain's claim, so it needs **no Review**: it appears after the catch-up, ready to read, linked to its project or area and to its source.
- **With "Only keep" filled in** ("the requirements table and the deadlines"): the Document holds only that, chosen by the brain. It arrives as an item in that source's Review row ("a) Document: Acme website: requirements and deadlines") and is a draft until approved, as 0045's `reference` notes are today.
- **The notes are extracted either way.** Keeping a document as a page doesn't stop the brain from taking its decisions and questions out.
- **From the drop folder or chat:** the catch-up asks "acme-quote.pdf: keep as document? no / all / only …" (default no), or the user says "keep only the price list from acme-quote.pdf as a document". Later, "also keep the budget from the Acme doc" writes one more narrowed Document from the source the brain already has; nothing is uploaded again.
- **New versions:** a new version of a kept file proposes the changed lines to the same Document, in the new source's Review row (0045).
- **Full text is retired.** Keep as document is how the user reads a whole file in Notion. Rows that already have a Full text section keep it.
- **Only keep replaces Keep.** The new name says what it does, and an empty field means the whole thing. The brain no longer asks about an empty field.

### Promote to document (0.6.0)
- **The "Promote to document" button** on a Decision or Concept row ticks Promote. The next catch-up creates a Document seeded from the note (its summary and body) and linked to it in both directions. The decision or concept itself stays as it is.

### Who owns a Document's text
- **Kept from a file, the brain.** It is the source's text: the body changes only through proposals, and a new version of the file proposes its diff. An edit the user types is read as a correction, as on every brain-owned field.
- **Promoted from a note, the user.** The promotion only seeds the page. From then on, the body is the user's to expand, and the brain links it and never rewrites it.

## Consequences
- **Amends 0045:** the `reference` type keeps its id prefix and folder, and is shown as Document; a Document kept whole needs no proposal; Keep is renamed Only keep; an empty Keep is no longer asked.
- **Amends 0043:** the Full text box is retired.
- **New:** verbatim Documents with no Review; promoted Documents owned by the user; the Keep as document and Promote checkboxes and their buttons (0048).
- **Notion:** migration 0010 renames References to Documents, keeping its id and every relation and view, and renames Keep to Only keep and Kind "Document" to File; it adds the checkboxes and buttons; it leaves Full text in place, unused, for the user to delete.
- **Module:** Documents is optional (0048); the first brain has it on.

## Evidence
- U-18, 2026-10-28: the document attached to an Inbox row with an empty Keep, and the user's search for it afterwards.
- skills/brain-ingest/references/sources.md ("a Notion attachment takes its row's Keep") against the Keep description in docs/notion-space-design.md §3.11.
- The grill of 2026-10-28.
