# Notion space migrations

A migration brings an **existing** Notion space up to date after the design changes (decision 0022). New spaces don't need migrations: the build prompts in [../prompts/](../prompts/) already include every change.

Run them in number order, once each. The `brain-notion-change` skill writes them, and after you run one it checks your space against the design.

## Format

`NNNN-<slug>.md`:

```markdown
# NNNN · <what changes>

**Design change:** <PR / decision>. **Applies to:** spaces built before <date or PR>.

## Prompt (Notion AI)
<a prompt that changes only this, and says to keep everything else>

## By hand
<steps Notion AI can't do reliably, e.g. adding a select option>. Creating a database is always one of them: the Notion API can't create databases, so a migration gives the user a Notion AI prompt for it and runs it before the agent steps that need the new database

## Verify
- [ ] …
```

## Migrations

| # | Change | From |
|---|---|---|
| [0001](0001-review-kind-add-link.md) | Review → Kind gets the option **Add Link** | decision 0028, PR #30 |
| [0002](0002-system-timestamps.md) | Review, Projects, Questions get system timestamps used by the views | Prompt 7 views |
| [0003](0003-look-pass.md) | Look pass: new Spaces arrangement, Tasks and Archive pages, Area hubs, Countdown and Task Progress | CC-17 |
| [0004](0004-ai-prompts-and-guide.md) | Brain Assistant (a Notion Custom Agent with Instructions and seven skills) and the "How it works" page | CC-18, CC-19 |
| [0005](0005-inbox-concepts-review-note.md) | Inbox replaces the Capture Inbox, a Concepts database, Note replaces Edited Value on Review, Area on Decisions and Questions | decisions 0037, 0034; CC-22 (release 0.3.0) |
| [0006](0006-review-notes-reports-brain-feed.md) | Review Notes and Answer Kinds, Ask and Report rows, Full text on the Inbox, Brief on area pages, the Brain feed and template views | decisions 0041–0043; CC-36 (release 0.4.0) |
| [0007](0007-review-promise-clean-email-open-questions.md) | What approving does on Review and its Decision property, Home's "What's waiting for you?", Questions Status description, the Clean email skill, How it works | decision 0045; CC-46 (release 0.4.1) |
| [0008](0008-clean-email-names-and-bodies-only.md) | The Clean email skill keeps names, dates and bodies only: no addresses, Subject or meeting blocks | decision 0047; CC-52 (release 0.5.0; by hand on 0.4.1) |
| [0009](0009-one-review-row-fix-ready-references-living-reports.md) | References database, Review's About/Now/Proposed/Your call/What to fix and the Fix option, Inbox Ready, Keep, Refresh and What to fix, Reports and References on the templates, the meeting fix line | decision 0045; CC-47 (release 0.5.0) |
| [0010](0010-modules-documents-buttons-area-homes.md) | References becomes Documents; Inbox Brain Status New/Ready/Done, Kind File, Only keep, Document asked, Refresh asked; Promote asked; the Keep as document, Refresh and Promote to document buttons; page layouts; Review Type and Area; the area home and Home's area lines | decisions 0048–0050; CC-59 (release 0.6.0) |
| [0011](0011-home-tabs-at-a-glance-button-names.md) | Home's Areas and Inbox tabs, the Areas formula At a glance, button property names apart from their labels, and the boxes they tick out of the page headings | #143–#146; CC-68 (release 0.6.1) |
| [0012](0012-brain-assistant-buttons-accepted-wording.md) | Tidy capture, Write up and Refresh report buttons that message Brain Assistant, Accepted and Accepted at with the Accept buttons, Brain Assistant's edit rule and two new skills | decision 0054; CC-70, CC-71 (release 0.8.0) |
