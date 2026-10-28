# Orgs

Clients, partners and suppliers, linked to their people and projects (decisions 0034, 0048; docs/notion-space-design.md §3.7). On by default.

## Turning it on

### 1 · The database

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create one full-page database "Orgs" with: Name (title), Summary (text), Relationship (select: Client, Prospect, Partner, Supplier, Other), Website (url), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date). Don't change anything else.

### 2 · Relations, rollups, descriptions

| Change | Who |
|---|---|
| Two-way relations: Projects "Client" ↔ Orgs "Projects"; People "Org" ↔ Orgs "People" | agent |
| Descriptions: Relationship, Website, Lifecycle "Owner: you."; Name "Owner: you when creating, then brain."; Brain ID, Last Synced "Owner: system. Do not edit."; the rest "Owner: brain." | agent |
| Record the id: `brain config set notion.databases.orgs '"<id>"'` | agent |

**Notion AI**, on **Brain Data**: items 7 and 8 of [Prompt 4](../prompts/04-formula-rollup.md) (Areas "Clients via projects", Orgs "Meetings via projects"), with "Add only these. Don't change anything else."

### 3 · Views

**Notion AI**, with "Add only these. Don't change anything else." each time:
1. On **Knowledge**: the `[Orgs]` lines of [Prompt 7f](../prompts/07f-knowledge.md) (the Orgs tab, after People, and "Who's who?" grouped by Org).
2. On the **Orgs** template: the `[Orgs]` lines of [Prompt 6](../prompts/06-templates.md).
3. On **Projects**: the `[Orgs]` line of [Prompt 7c](../prompts/07c-projects.md); on **Archive**: the `[Orgs]` tab of [Prompt 7h](../prompts/07h-archive.md).

**By hand:** the Areas page layout shows "Clients via projects" in its header ([views-guide.md](../views-guide.md) §9).

### Verify
- [ ] `brain modules` shows `orgs` on with nothing missing.
- [ ] Knowledge has an Orgs tab; a project's Client can be set.
- [ ] After the next sync, orgs you created are in the brain (`brain index`).

## Turning it off

The brain stops reading and publishing orgs; a person's or project's org stays in Git. You may hide: the Orgs tab of Knowledge and Archive, Client on Projects, Org on People, and "Clients via projects" on area pages.
