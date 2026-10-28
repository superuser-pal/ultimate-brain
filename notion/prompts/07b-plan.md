# Prompt 7b — Plan Space views

Paste into Notion AI **while you are on the "Plan" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

**Planning module only** (decision 0048): skip this prompt if you left Planning off. Areas are the way into each Area page, which collects everything for that area.

```text
On this page ("Plan") add four tabs:
1. Tab "Goals": linked view of "Goals", Gallery with medium cards, named "What am I working toward?": filter Status is Active and Archived is unchecked; sort Deadline ascending; show Name, Progress (as a bar), Countdown, Area.
2. Tab "Key results": linked view of "Key Results", Table, named "How are my key results moving?": filter the related Goal's Status is Active (if not possible, Done is unchecked); sort Due ascending; group by Goal; show Name, Current, Target, Unit, Progress (as a bar), Done.
3. Tab "Areas": linked view of "Areas", Gallery with small cards, named "Which areas do I own?": filter Archived is unchecked; sort Type then Name; show Name, Type.
4. Tab "Projects by goal": linked view of "Projects", Board, named "Which projects serve each goal?": filter Archived is unchecked and Status is not Done; group by Goal, showing the empty group; sort Priority high to low; show Name, Status.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] Four tabs: Goals, Key results, Areas, Projects by goal.
- [ ] Progress shows as a bar in Goals and Key results.
