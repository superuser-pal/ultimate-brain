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
