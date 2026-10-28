# Planning

Goals and key results above your areas and projects (decisions 0020, 0048; docs/notion-space-design.md §3.2, §3.3). Off by default.

## Turning it on

### 1 · The databases

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create two full-page databases. "Goals": Name (title), Summary (text), Why (text), Deadline (date), Status (select: Not Started, Active, Achieved, Dropped), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date). "Key Results": Name (title), Kind (select: Number, Milestone), Start (number), Current (number), Target (number), Unit (text), Done (checkbox), Due (date). Don't change anything else.

### 2 · Relations, formulas, descriptions

| Change | Who |
|---|---|
| Two-way relations: Areas "Goals" ↔ Goals "Area"; Goals "Key Results" ↔ Key Results "Goal"; Goals "Projects" ↔ Projects "Goal" | agent |
| Descriptions per [Prompt 5](../prompts/05-ownership.md): every property of Key Results "Owner: you."; Goals Status, Lifecycle, Archived, Key Results, Projects, Progress, Countdown "Owner: you."; Name, Area "Owner: you when creating, then brain."; Projects Goal "Owner: you when creating, then brain."; Brain ID and Last Synced "Owner: system. Do not edit."; the rest "Owner: brain." | agent |
| Record the ids: `brain config set notion.databases.goals '"<id>"'` and `brain config set notion.databases.key_results '"<id>"'` | agent |

**Notion AI**, on **Brain Data**: items 1–3 of [Prompt 4](../prompts/04-formula-rollup.md) (Key Results Progress, Goals Progress and Countdown), with "Add only these. Don't change anything else." The hand-pasted Countdown formula is there if Notion AI gets it wrong.

### 3 · Pages and views

**Notion AI**:
1. On **Ultimate Brain**, create a page "Plan" right after "Projects". Then, on that page, paste [Prompt 7b](../prompts/07b-plan.md).
2. On each template in turn, with "Add only these. Don't change anything else.": the Areas template's "What am I working toward here?" (after "What needs me here?") and the Goals template, both from the `[Planning]` lines of [Prompt 6](../prompts/06-templates.md).
3. On **Archive**: the `[Planning]` line of [Prompt 7h](../prompts/07h-archive.md) (the Goals tab).

**By hand:** add Plan to the Tier 1 navigation on System ([Prompt 8](../prompts/08-navigation.md)), if you use it.

### Verify
- [ ] `brain modules` shows `planning` on with nothing missing.
- [ ] A test goal with a Number key result (Start 4, Current 6, Target 10) shows 33% Progress. Delete it.
- [ ] The Plan page has four tabs; a new area shows "What am I working toward here?".
- [ ] After the next sync, goals you created are in the brain (`brain index`).

## Turning it off

The brain stops reading Goals and Key Results, so a catch-up reads less. You may hide: the Plan page and its navigation link, "What am I working toward here?" on area pages, Goal on Projects, and the Goals tab of Archive.
