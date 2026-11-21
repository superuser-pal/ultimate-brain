# Prompt 7 — Spaces and views

Seven short prompts, one per page, so you can place them one at a time. Open each page in Notion, paste its prompt into Notion AI, then tick its **Verify** list. Before: [Prompt 6](06-templates.md). Existing space? Start with [migration 0003](../migrations/0003-look-pass.md).

Each Space has the navigation in a narrow left column and one tabs block on the right. Each tab holds a linked view of a database on Brain Data, named by the question it answers; tabs run from now, to later, to done (docs/notion-space-design.md §5). Navigation between Spaces is [Prompt 8](08-navigation.md), which is optional.

| Order | Page | Prompt |
|---|---|---|
| a | Home | [07a-home.md](07a-home.md) |
| b | Meetings | [07d-meetings.md](07d-meetings.md) |
| c | Tasks | [07g-tasks.md](07g-tasks.md) |
| d | Projects | [07c-projects.md](07c-projects.md) |
| e | Plan | [07b-plan.md](07b-plan.md) |
| f | Knowledge | [07f-knowledge.md](07f-knowledge.md) |
| g | Archive (on System) | [07h-archive.md](07h-archive.md) |

There is no Review page since 0.16.0: you decide what the brain proposes in your agent session (decision 0096), and since 0.17.0 the weekly row's actions and clean-up by ticking them in that Inbox row (decision 0110). Prompt 7e built it up to 0.15.x and is retired.

The order is the one to use when time is short: Home and Meetings matter most during ingest. Tasks (7g) is for the Tasks module and Plan (7b) for Planning: skip them if you left those off. The other prompts carry module tags: delete the tagged lines of the modules you didn't choose ([CHECKLIST](../CHECKLIST.md)).

Across all pages:
- [ ] No database lives outside Brain Data, except Skills (Notion Brain Assistant's skills) on System ([Prompt 9](09-assistant-and-guide.md)).
- [ ] Brain ID and Last Synced are hidden in every view (Projects "Which projects have gone quiet?" shows Last Synced on purpose).
- [ ] Every view's database title is hidden; the tab label and the view name say what it shows.
