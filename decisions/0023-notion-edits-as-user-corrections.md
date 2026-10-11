# 0023 — Your edits to brain-owned values in Notion are applied as your corrections

**Status:** Accepted
**Date:** 2026-10-11
**Resolves:** open item in 0021

## Decision
When you change a **brain-owned** property value directly in Notion (e.g. a person's Role, a project's Key Facts), the next `brain sync` detects the difference and applies it to the Markdown note as **your correction**:
- recorded in the note's `timeline:` (0010) with `source: notion-edit` and the date;
- the previous value is kept as history (assessment `superseded`);
- no Review row, since you are the approver;
- committed to Git like any other change.

Structural changes in Notion (new properties, options, databases) are not content and follow 0022 instead.
