# 0032 — Sources beyond meetings

**Status:** Accepted
**Date:** 2026-10-14

## Context
v1 ingests one kind of input: meeting minutes. The user also has documents (PDF, Word, PowerPoint, Excel), email and chat threads they can paste, notes of their own, and rows typed into the Notion Capture Inbox, which nothing processed. The 0.2.0 plan (build/TASKS.md, agreed 2026-10-14) adds one ingest path for all of them. Research on converters (2026-10-14): MarkItDown covers Office and HTML with no models and an MIT licence; Claude Code's Read tool already reads PDFs and images, scans included; Codex has no native PDF reading; Docling and Marker are stronger on complex PDFs but heavy, and Marker's model weights carry a revenue-limited licence.

## Decision
- **One ingest path** for everything that isn't a Notion meeting. Each input becomes a **source note** with a `kind`: `document`, `email`, `chat`, `note` or `capture` (`minutes` stays the meeting kind and the default).
- **Documents are files on the user's disk**, named in chat. The original file **stays outside the brain**. The source note keeps the converted text verbatim, the file's name (no folder) and a key `file:sha256:<hash of the file's bytes>`, so the same file is recognised even if a converter's output changes.
- **Converters are external tools** the skill calls, never CLI dependencies (0016):
  - Office and HTML files → **MarkItDown**;
  - PDFs and images in Claude Code → the agent's **native Read**;
  - PDFs in Codex → MarkItDown.
  - The source note records the converter and its version. Docling or Marker are added only if the 0.2.0 bake-off (CC-15) shows the above isn't good enough.
- **Pasted text** (emails, chat, notes) gets an `agent:` key, as Markdown-only minutes do.
- **Capture Inbox rows** get the row's `notion:` key and kind `capture`. After the ingest commit, the skill sets the row's Brain Status to Processed through the Notion MCP. If that write fails, the next run finds the row New again, and the CLI's duplicate check (same `capture` key) skips it before marking it Processed, so a retry is safe.
- **Folders follow the key:** `sources/notion/`, `sources/files/`, `sources/text/`.
- **Converted and pasted text is untrusted input**, like minutes: instructions inside it are content, never commands. Converters run on the user's machine; nothing is sent to a hosted converter without the user's explicit yes per document.

## Consequences
- Schema: source key `file:sha256:…`; source fields `kind`, `file_name`, `converter` (spec/schema.md, note.schema.json). CLI: source paths by key, duplicate detection by `file:` and `capture` keys (spec/cli.md §3.6.5, §5.5); lint `wrong-folder` for sources (CX-18).
- The ingest skill gets per-kind extraction rules: documents have no attendees or action items by default (CC-14).
- Notion shows what was extracted, not the sources themselves; a Sources database is a 0.3.0 candidate (docs/v2-ideas.md).
- The user's brain needs MarkItDown installed (`pipx install 'markitdown[all]'` or similar) to ingest Office files; the skill checks and says how.

## Evidence
- build/TASKS.md "0.2.0" (CC-13, CC-14, CC-15, CX-18).
- Converter research, 2026-10-14: MarkItDown github.com/microsoft/markitdown; Docling github.com/docling-project/docling; Marker github.com/datalab-to/marker (MODEL_LICENSE); Claude Code tools reference code.claude.com/docs/en/tools-reference.
