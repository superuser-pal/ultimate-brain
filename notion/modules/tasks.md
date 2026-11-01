# Tasks

Action items from meetings, and your own from documents, emails and captures, become Notion tasks linked to their meeting or source (decisions 0018, 0037, 0048; docs/notion-space-design.md §3.12). Off by default. Use the default Tasks database, or map your own.

## Turning it on

### 1 · The database

**Your own tasks database?** Skip to step 2 and say so: the skill maps its properties (brain-connect-notion, step 5) instead of creating one. It needs a title, and a relation to Meetings (or a URL property) for the backlink.

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create one full-page database "Tasks" with: Name (title), Status (status: To Do, Doing, Waiting On, Someday, Done; put Waiting On and Someday in any group except Complete), Due (date), Brain ID (text), Last edited time (last edited time). Don't change anything else.

### 2 · Relations and formulas

| Change | Who |
|---|---|
| Two-way relations: Tasks "Project" ↔ Projects "Tasks"; Tasks "Area" ↔ Areas "Tasks"; Tasks "Meeting" ↔ Meetings "Tasks"; Tasks "Source" ↔ Inbox "Tasks" (on your own database: the ones it lacks, with your names) | agent |
| Descriptions: every property of Tasks, and the "Tasks" relation in Projects, Areas, Meetings and Inbox, "Owner: you." | agent |
| Map it: the default database sets `notion.tasks.database` and `status_type` `"status"`; your own gets a mapping you approve (brain-connect-notion, step 5) | agent |

**Notion AI**, on **Brain Data** (formulas over the new relation, [Prompt 4](../prompts/04-formula-rollup.md) items 5 and 12, with the hand-pasted Due formula there if Notion AI gets it wrong):
Use the Task Progress and Due formulas in [Prompt 4](../prompts/04-formula-rollup.md), substituting your mapped relation, property and status names. Add the Won't Do status option by hand in Complete. Set `notion.tasks.wont_do_status` to its name (default `Won't Do`); do not rename unrelated statuses. Done and Won't Do are excluded from due views and reminders. Won't Do can be reopened.


### 3 · Pages and views

**Notion AI**:
1. On **Ultimate Brain**, create a page "Tasks" right after "Home". Then, on that page, paste [Prompt 7g](../prompts/07g-tasks.md).
2. On **Home**: [Prompt 7a](../prompts/07a-home.md)'s `[Tasks]` lines only ("What's due across areas?" in the Areas tab, and the "Tasks" tab of "What's on today?"), with "Add only these. Don't change anything else."
3. On each template in turn: the `[Tasks]` lines of [Prompt 6](../prompts/06-templates.md) for Areas ("Today" in "What needs me here?", "What's on my plate here?"), Projects ("What's on my plate here?") and Meetings (the toggle "Tasks"), with "Add only these. Don't change anything else."

**By hand:** add Tasks to the Tier 1 navigation on System ([Prompt 8](../prompts/08-navigation.md)), if you use it.

### Verify
- [ ] `brain modules` shows `tasks` on with nothing missing; `brain status` shows `tasks_database: true`.
- [ ] The Tasks page has its six tabs; a new project shows "What's on my plate here?".
- [ ] After the next ingest of a meeting with an action item for you, the task appears in Tasks → Today or Upcoming, linked to the meeting.

## Turning it off

The brain stops creating tasks and lists action items in its report instead. Your tasks stay where they are. You may hide: the Tasks page and its navigation link, Home's Tasks tab and "What's due across areas?" in its Areas tab, and the Tasks views on area, project and meeting pages.
