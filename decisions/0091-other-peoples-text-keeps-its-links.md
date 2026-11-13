# 0091 — Other people's text keeps its links: a source and its whole Document are not held to 0002

**Status:** Accepted
**Date:** 2026-11-13
**Release:** 0.14.0 (moved from 0.14.1 by CC-257 on the author's choice of 2026-11-14, with the release gate's fixes in rc.3)
**Amends:** [0002](0002-link-syntax.md) (its rule binds text the brain writes, not text it keeps); spec/schema.md §15 (lint)
**Keeps:** 0002 for every note the brain writes, a `part` or `learned` Document included; sources are immutable (schema §4 source); a `whole` Document's body is its source's body byte for byte (cli.md §5.5); linked repos (0042, 0066)

## Context

Dogfood issue #344 (0.14.0-rc.1, skills 1.8.1). An agent ingested a linked repo that is an Obsidian-style vault: its notes refer to each other with `[[slug]]` and `[[slug|label]]`. `brain note new` refused every source that held a wikilink (`INPUT_INVALID`, "wikilink: use a relative Markdown link, not [[wikilinks]] (0002)"), so no file of the vault could be kept as it is. Brain-ingest has no step for this, so the agent improvised: it replaced `[[slug|label]]` with `label` and `[[slug]]` with `slug` in about 450 links, and kept `converter: verbatim` and the file's hash as `source_key`.

What the repositories show:
- **Lint holds every body to 0002.** `src/lib/lint.ts` refuses `[[` in any note's body, sources included, and also refuses a relative Markdown link whose target isn't in the brain (`broken-link`) and an inline footnote `^[…]` that isn't a provenance marker (`unknown-marker`). A vault's `[see](other.md)` or a Pandoc footnote fails the same way.
- **The improvised fix makes a source false.** Its body no longer is the file its key names, while `converter: verbatim` says it is.
- **A whole Document inherits the loss.** It must equal its source byte for byte, so its links become bare slugs, linked neither in the brain nor in Notion.
- **Every agent would improvise differently**, so the same vault would ingest differently from one run to the next.

0002 was written for the brain's own notes: agents write relative links so files stay portable and renames can repair them. A source is someone else's text, kept so that claims can cite it; rewriting it breaks that purpose.

The author chose, on 2026-11-13, to keep such text as it is (option A of the triage) and to ship the fix in 0.14.1.

## Decision

1. **0002 binds the text the brain writes.** A source's body, and the body of a Document with `origin: whole`, are someone else's text kept as it is. Lint doesn't run the checks that judge the brain's own writing on them: `wikilink`, `broken-link` and `unknown-marker`. Every other check stays, `source-hash` included. A decision, a question, a `part` or `learned` Document, or any other note the brain writes still follows 0002: lint refuses `[[…]]` there as before.
2. **Ingest keeps such text as it is.** A file with wikilinks is snapshotted unchanged, with `converter: verbatim`, and never stripped or rewritten. Brain-ingest's references/sources.md gains a step for wiki-style repos and files.
3. **Notion shows the links as well as it can, at publish time.** On a whole Document's page:
   - `[[target]]`, `[[target|label]]`, `[[target#heading|label]]` and `![[target]]` show their label, or `target` when there is no label;
   - the text is a link to another whole Document's page when exactly one whole Document in the brain was kept from a file of the same repo whose name, without `.md`, is `target` (or whose repo path is `target`);
   - when no file or more than one file matches, it stays plain text: the brain never guesses;
   - a relative Markdown link is resolved the same way against the file's repo path, and otherwise shows its text.

   The page changes on the next publish after the target is ingested; the files never change.
4. **When a note the brain writes quotes such text**, it follows 0002: a relative link to the target's note when there is one, plain text otherwise.

## Consequences

- A vault, or any file using wikilinks, ingests the same way every time, and its source's body is the file.
- Lint no longer finds a broken link inside a source or a whole Document. None is the brain's to fix.
- The Notion renderer needs a resolution step for whole Documents. Search and `brain query` read the text as it is.
- Work: CC-250 (0.14.0, moved from 0.14.1 by CC-257). The contract comes first (spec/schema.md links row and §15, cli.md lint table and the Documents render), then lint, the renderer and a fork PR for brain-ingest.

## Evidence

Issue #344; `src/lib/lint.ts` (body checks), `src/lib/note-new.ts` (the byte-for-byte rule of a whole Document); spec/schema.md §4 source (`converter`, immutability); the triage of 2026-11-13 (CC-249).
