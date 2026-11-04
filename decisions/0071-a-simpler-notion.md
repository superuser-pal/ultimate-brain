# 0071 — A simpler Notion: fewer databases, only what you trusted

**Status:** Accepted
**Date:** 2026-11-04
**Amends:** [0037](0037-intake-experience.md) (Concepts database), [0043](0043-see-what-the-brain-took-in.md) and [0045](0045-review-in-one-row-fix-before-ingest.md) (Report rows on the Inbox), [0048](0048-modules-and-simpler-rows.md) (the Knowledge module), [0049](0049-documents.md) (Promote on concepts)

## Context
The brain in Git holds everything it captures; Notion is where you see what it has and where you decide, correct and set your own fields. In the user's 2026-11-04 scope review of Review, Inbox, Decisions, Questions, Concepts, Documents and Orgs:
- Concepts was never opened. It sits next to Documents under "What do we know?", nothing else reads it, and Promote to document turns a concept into a Document anyway.
- Reports are living pages, one per subject, refreshed over time, but they are rows of the Inbox, which is the history of what came in.
- Many open questions were in fact to-dos and had to be deleted by hand.
- Every draft decision and question shows twice: in its Review row, whose page holds its full wording (0055), and as a Draft row in its database. The Briefs already show only reviewed notes (0041).
- An employer is an Org (its people work there) but not a client; Relationship had no option for it.

## Decision
1. **Concepts become Documents.** A concept is a Document with `origin: learned`: the brain's own explanation of an idea, method or definition, reviewed like a concept today. The Concepts database is retired; the Knowledge module holds Decisions and Questions. Existing concepts move to Documents with their links; Promote to document remains on decisions only.
2. **Reports move to Documents.** A report is a Document with `origin: report`, living as today (one per subject, Refresh and What to fix on its page, never ingested back, 0057). An Ask stays an Inbox row and links to its report.
3. **Notion shows reviewed knowledge.** Decisions, Questions and Documents get their page when they are reviewed (approved in Review, or reviewed from the start, as a whole Document is); until then they live only in their Review row. People keep appearing as drafts, because a meeting's Attendees relation needs their page. Superseded decisions and answered questions stay in Notion as history.
4. **A to-do is a task, not a question.** At extraction, a line that something can answer later is a question; a line that someone has to act on is a task. The owner's own to-dos become tasks; someone else's become a task for the owner with the Waiting On status and that person's name first ("Carlos: confirm the budget"). Risks stay questions with Kind Risk. Without the Tasks module, such a line stays a question. A one-off tidy offers to turn existing questions that read as to-dos into tasks, each after a yes.
5. **Orgs keep their name,** and Relationship gains **Employer** (Client, Prospect, Partner, Supplier, Employer, Other). "Which clients do I have?" still shows only Client.

Release 0.9.2, after 0.9.1; each part is specified in `spec/` before its code (tasks CC-123 to CC-127).

## Consequences
- The Knowledge tab loses its Concepts tab; "What do we know?" on project and area pages shows Decisions and Documents. A Documents view per origin (kept, learned, report, promoted, workflow) replaces it.
- A Review row's approval now also creates the pages of the notes it approved; a rejected draft never reaches its database.
- Existing Draft rows in Decisions, Questions and Documents: their migration says what happens to them (they stay until decided, or are trashed after a yes); defined in CC-125.
- Each part has a Notion migration for spaces built before 0.9.2.

## Evidence
The user's scope review, 2026-11-04 (CC-122): Concepts never opened; questions cleaned by hand because many were tasks; reviewed-only mirror (option B of three); Waiting On tasks for other people's to-dos; Employer for an org that is a Domain's employer; a new 0.9.2.
