# 0003 · Look pass: Easlo-style Spaces, Tasks, Archive, Area hubs

**Design change:** CC-17 (docs/notion-space-design.md §1, §3–§5; decision 0034 is not part of this migration). **Applies to:** spaces built before this migration.

Notion-only throughout: the brain never reads any property or view added here. Do the steps in order; each one leaves the space working.

## 1 · Properties (an agent can do these through the API, with your yes)

| Database | Change | Type |
|---|---|---|
| Tasks | Status gets the options **Waiting On** and **Someday**, in the To-do group | status options |
| Tasks | **Last edited time** | last edited time |
| Goals | **Countdown** | formula (Prompt 4, item 3) |
| Projects | **Countdown** | formula (Prompt 4, item 4) |
| Projects | **Task Progress** | rollup: Tasks → Status, percent per group Complete |
| Areas | **People via projects**, **Clients via projects**, **Decisions via projects**, **Questions via projects** | rollups over Projects, show original |
| Orgs | **Meetings via projects** | rollup over Projects, show original |

Descriptions: "Owner: system. Do not edit." for Last edited time; "Owner: you." for the others (Prompt 5).

### Prompt (Notion AI), if you do them yourself
```text
In the existing databases on "Brain Data", make only these changes. Do not create a new database or data source, and do not change any other property.
- "Tasks": add the status options "Waiting On" and "Someday" to Status, in the To-do group; add a "Last edited time" property (type last edited time).
Then run items 3 to 7 of Prompt 4 exactly as written.
```
Paste Prompt 4's items 3–7 below it (see [../prompts/04-formula-rollup.md](../prompts/04-formula-rollup.md)).

## 2 · Templates

Text changes (an agent can do these through the API, with your yes):
- **Areas:** delete the "Summary" callout.
- **Goals:** delete the "Why" callout.
- **People:** delete the "Role / Org" callout.
- **Projects:** add a gray paragraph above "Brief": "Brief and Decision log are written by the brain. Add your own notes in My notes."
- **Meetings:** no change.

Linked views (Notion AI or by hand, because the API can't create them): open each template (database → **New** ▾ → edit) and paste:

```text
In this template, replace every linked view with the headed views listed for this database in the prompt below, keep the "My notes" toggle last, and keep the "Brief" and "Decision log" toggle headings and their content exactly as they are. Do not touch any other block.
```

followed by that database's item from [Prompt 6](../prompts/06-templates.md). Do Areas, Goals, Projects, People and Orgs.

## 3 · Pages and Spaces

1. **By hand:** create a page "Tasks" next to the other Spaces, and a page "Archive" inside "System". Add both to the synced navigation block.
2. **On each Space,** delete the old linked views (keep the navigation column), then paste its Prompt 7 page prompt: [07a Home](../prompts/07a-home.md), [07e Review](../prompts/07e-review.md), [07d Meetings](../prompts/07d-meetings.md), [07g Tasks](../prompts/07g-tasks.md), [07c Projects](../prompts/07c-projects.md), [07b Plan](../prompts/07b-plan.md), [07f Knowledge](../prompts/07f-knowledge.md), [07h Archive](../prompts/07h-archive.md).
3. **Page layouts:** pin Countdown and Task Progress in the Projects heading, Countdown in the Goals heading, and add the rollups to the Areas and Orgs panels ([../views-guide.md](../views-guide.md) §9).

After each Space, ask your agent to check it against the design (read-only).

## Verify
- [ ] Tasks Status has To Do, Doing, Waiting On, Someday, Done; the brain still creates tasks as To Do.
- [ ] A test goal with a Deadline in 10 days shows "10 days left"; a test project with one of two tasks Done shows 50%. Delete the test rows.
- [ ] An Area page shows its goals, projects, tasks and meetings in headed views, and the four "via projects" rollups in its header.
- [ ] Home leads with "What's on today?"; a meeting dated tomorrow is in Meetings → Upcoming and not in "Which minutes need review?".
- [ ] "What's finished?" is in Archive, not in Projects.
