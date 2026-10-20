# 0042 — Two new ways in: linked repos and Notion attachments

**Status:** Accepted
**Date:** 2026-10-20
**Refines:** 0032, 0037

## Context
- **More than one repo holds the user's knowledge.** The user keeps an agency brain (another repo with methods, flows and business decisions) and builds this product in a repo with 41 decisions. They want every repo to give context to one Notion space "without messing the foundations": one canonical store (0001), changes as proposals (0003), Notion as the interface and never a second knowledge base, and no unrestricted two-way sync.
- Two designs were weighed in the 2026-10-20 grill. **One brain, repos as sources:** the brain stays the only store and the only writer to Notion; other repos are read, never written. **Several brains, one Notion:** each repo keeps a brain and all publish into one space, which needs page ownership and a protocol between brains. The user chose the first.
- **Files attached in Notion are lost.** A capture made on the phone with a PDF attached, or a meeting page with its deck, is ingested as text only. The drop folder (0032, 0037) is the only way a file gets in, and it needs the laptop.

## Decision
### Linked repos
- **A linked repo is a source, read-only.** `brain.json` lists it under `repos`: a name, the local path, the area its knowledge belongs to, the files to read (glob patterns, e.g. `decisions/**`, `docs/vision.md`, `CHANGELOG.md`), and the last commit the brain ingested. The brain never writes to a linked repo. (`brain link` stays the other direction: it lets a repo *read* the brain.)
- **Catch-up reads what changed since the last ingested commit:** added and modified files that match the patterns, oldest commit first. Each file is ingested like a drop-folder document (0032): a `file:` source keyed by the hash of its content, `kind: document`, with `repo`, `repo_path` and `commit` recording where it came from. A text file needs no converter (`converter: verbatim`).
- **A changed file is a new source.** Its notes follow the normal path: new knowledge as `draft` notes, changes to existing notes as proposals (0003). A deleted file changes nothing; the report lists it once.
- **The first ingest of a repo is attended.** With many files waiting (more than 10), catch-up lists them and asks which to take, default all, in its one batch of questions (0037), and never runs it unattended.
- **Each source gets its Inbox row** (0037), as every non-minutes source does, so "What came in?" shows the repo's files with what they produced.

### Notion attachments
- **Files attached to an Inbox row or a meeting page are ingested** with that row or meeting: in the page body (file, PDF and image blocks) or in a Files property. Files on other pages (projects, areas) are not read: they have no moment when they "come in". To bring one in, attach it to a capture with its Project set.
- **The skill downloads, the CLI never reaches Notion** (0015). Notion's file links expire after about an hour, so the skill downloads each file during the run into the run's temporary folder and converts it as the drop folder does (0032): PDFs and images read natively, Word, PowerPoint, Excel and HTML through `markitdown`.
- **An attachment is its own source, under its row.** A `file:` source with `attached_to` = the row's (or meeting's) source id. It has no Inbox row of its own: its notes link to the parent's Inbox row (or meeting). The original stays in Notion; the brain keeps the converted text, the file name and the hash (0032).
- **Questions come in the batch:** catch-up lists each row's attachments, all selected by default, and asks "which parts?" for one too long to read whole, as for the drop folder.
- **An attachment that can't be read** (unknown format, a broken file, `markitdown` missing) is skipped: the row's own text is still ingested and the row still becomes Processed; the report's Check line names the file, the reason and the fix.

## Consequences
- **No new store, no second writer.** 0001, 0003, 0022 and the no-two-way-sync rule hold unchanged. The agency brain can move in later as linked repos plus a schema decision for its methods and flows, which our note types don't cover yet (0.5.0 or later).
- **The pilot is this product repo,** as an "Ultimate Brain" area in the user's brain: `decisions/**`, `docs/vision.md`, `CHANGELOG.md`. Knowledge flows from the product into the private brain, never back (0014); `build/TASKS.md`, `spec/` and code stay out.
- **Many Inbox rows at once:** the first ingest of the pilot writes about 43. Each is one row in "What came in?"; none needs a decision.
- **Source fields:** spec/schema.md gains `repo`, `repo_path`, `commit` and `attached_to` on `file:` sources and the `verbatim` converter; `brain.json` gains `repos`. spec/cli.md gains the commands that list a repo's changed files and record the ingested commit, and render rules for a source with `attached_to`.
- brain-catch-up, brain-ingest (references/sources.md, notion.md) and the user guide follow.

## Evidence
Grill of 2026-10-20 (build/TASKS.md, 0.4.0); the user's agency brain (421 commits, methods, flows, business and demo material; no client data copied here); docs/v2-ideas.md "Notion file uploads". Decisions 0001, 0003, 0014, 0015, 0022, 0032, 0036, 0037.
