# Tasks

Action items from meetings, and your own from documents, emails and captures, become Notion tasks linked to their meeting or source (decisions 0018, 0037, 0048; docs/notion-space-design.md §3.12). A question or risk you say to follow up ("track it", or `Track: Waiting On —` on its line in the minutes) becomes a task too, with **Kind** Question or Risk, listed under the Tasks page's **Questions** and **Risks** tabs (decision 0099 §3 to §5). The **Keep as document** button on a task asks the brain to keep its page as a Document (decision 0100; it acts on it with the Documents module on). Off by default. Use the default Tasks database, or map your own.

## Turning it on

### 1 · The database

**Your own tasks database?** Skip to step 2 and say so: the skill maps its properties (brain-connect-notion, step 5) instead of creating one. It needs a title, and a relation to Meetings (or a URL property) for the backlink.

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create one full-page database "Tasks" with: Name (title), Status (status: To Do, Doing, Waiting On, Someday, Done; put Waiting On and Someday in any group except Complete), Due (date), Kind (select: Task, Question, Risk), Document asked (checkbox), Brain ID (text), Last edited time (last edited time). Don't change anything else.

### 2 · Relations and formulas

| Change | Who |
|---|---|
| Two-way relations: Tasks "Project" ↔ Projects "Tasks"; Tasks "Area" ↔ Areas "Tasks"; Tasks "Meeting" ↔ Meetings "Tasks"; Tasks "Source" ↔ Inbox "Tasks" (on your own database: the ones it lacks, with your names) | agent |
| The **Domain** rollup on the default Tasks, after the Area relation exists: relation Area, property Domain, Show original, described "Owner: Notion. Derived from the Area's Domain; you never edit it." (decision 0113 §9; every space has the Domains database). Read it back as [migration 0031](../migrations/0031-domain-homes-factories-and-home-cards.md) part A says. Your own database is offered it when Domains is on (spec/setup.md §6.2.3) | agent |
| With the Factories module on: the two-way relation Tasks "Factory" ↔ Factories "Tasks", as [factories.md](factories.md) steps 2 and 3 say | agent, and by hand for its limit |
| Descriptions: Kind, "Owner: brain on a task it creates to track a question or risk you said to follow up (Question or Risk); empty or Task otherwise. You may set Task."; Document asked, "Owner: you, through the Keep as document button. Waiting for the brain; it clears it."; every other property of Tasks, and the "Tasks" relation in Projects, Areas, Meetings and Inbox, "Owner: you." | agent |
| Map it: the default database sets `notion.tasks.database`, `status_type` `"status"`, `properties.kind` `"Kind"` and `properties.document_asked` `"Document asked"`; your own gets a mapping you approve (brain-connect-notion, step 5), and is offered Kind once (spec/setup.md §6.2.1): without it, a task that tracks a question or risk has a title starting `Question: ` or `Risk: `. It is offered Document asked and the button once too (§6.2.2): without them, you ask in the session ("keep the go-live task as a document") | agent |
| With the Documents module on: a one-way relation Documents "Task" → Tasks (no property on Tasks), described "Owner: brain. On a Document kept from a task: that task. Written by the brain only." | agent |

**Notion AI**, on **Brain Data** (formulas over the new relation, [Prompt 4](../prompts/04-formula-rollup.md) items 5 and 10, with the hand-pasted Due formula there if Notion AI gets it wrong):
Use the Task Progress and Due formulas in [Prompt 4](../prompts/04-formula-rollup.md), substituting your mapped relation, property and status names. Add the Won't Do status option by hand in Complete. Set `notion.tasks.wont_do_status` to its name (default `Won't Do`); do not rename unrelated statuses. Done and Won't Do are excluded from due views and reminders. Won't Do can be reopened.


### 3 · Pages and views

**Notion AI**:
1. On **Ultimate Brain**, create a page "Tasks" right after "Home". Then, on that page, paste [Prompt 7g](../prompts/07g-tasks.md).
2. On **Home**: [Prompt 7a](../prompts/07a-home.md)'s `[Tasks]` lines only (the "Tasks" tab of "What's on today?" and, with Domains off, "What's due across areas?" in the Areas tab), with "Add only these. Don't change anything else."
3. On each template in turn: the `[Tasks]` lines of [Prompt 6](../prompts/06-templates.md) for Areas ("Today" in "What needs me here?", "What's on my plate here?"), Projects ("What's on my plate here?") and Meetings (the toggle "Tasks"), with "Add only these. Don't change anything else."

**By hand:**
1. **Tasks → Keep:** open Tasks as a full page → `•••` → Properties → **New property** → **Button**, named "Keep", with the label "Keep as document". Action **Edit property** on **This page**: Document asked → checked. Nothing else. On your own tasks database, only if you said yes to it at the mapping.
2. **Page layout** (open any task → **Customize layout**): pin Keep first in the heading, then Status, Due and Kind; Document asked at the top of the property group ([views-guide.md](../views-guide.md) §9).
3. With the Domains module on: Domain after Area in the Tasks layout (hide it with Domains off), and the Tasks views of the Domains page template ([views-guide.md](../views-guide.md) §9a). With Factories on: its board and layout ([factories.md](factories.md), steps 5 and 6).
4. Add Tasks to the Tier 1 navigation on System ([Prompt 8](../prompts/08-navigation.md)), if you use it.

### Verify
- [ ] `brain modules` shows `tasks` on with nothing missing; `brain status` shows `tasks_database: true`.
- [ ] The default Tasks has the Domain rollup (Area → Domain, Show original).
- [ ] The Tasks page has its eight tabs, Questions and Risks among them; a new project shows "What's on my plate here?".
- [ ] After the next ingest of a meeting with an action item for you, the task appears in Tasks → Today or Upcoming, linked to the meeting.
- [ ] Clicking **Keep as document** on a task ticks Document asked and changes nothing else (untick it if you clicked only to check). With Documents on, the next catch-up keeps the task's page as a Document, linked to the task by Task, and clears the box.

## Turning it off

The brain stops creating tasks and lists action items in its report instead; nothing is tracked, and a question you would follow up stays in its project's Brief. Your tasks stay where they are. You may hide: the Tasks page and its navigation link, Home's Tasks tab and "What's due across areas?" in its Areas tab, and the Tasks views on area, project and meeting pages.
