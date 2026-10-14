# Prompt 4 — Formulas and rollups

Paste into Notion AI. Before: [Prompt 3](03-relations.md). Next: [Prompt 5](05-ownership.md).

Progress is used by the brain's planning snapshot (0020). Countdown, Task Progress and the "via projects" rollups are Notion-only: the brain never reads them (docs/notion-space-design.md §3).

```text
1. In "Key Results", add a formula property "Progress" that returns a number between 0 and 1:
   if Kind is "Milestone", return 1 when Done is checked, otherwise 0;
   if Kind is "Number", return (Current - Start) / (Target - Start), limited to between 0 and 1, and 0 when Target equals Start.
   Show it as a percentage.
2. In "Goals", add a rollup property "Progress" over the relation "Key Results", property "Progress", calculated as Average, shown as a percentage.
3. In "Goals", add a formula property "Countdown" that returns text: empty when Deadline is empty or Status is Achieved or Dropped; "Overdue" when Deadline is before today; otherwise the number of days from today to Deadline followed by " days left".
4. In "Projects", add a formula property "Countdown" that returns text: empty when Dates is empty or Status is Done; "Overdue" when the end of Dates (or Dates itself if it has no end) is before today; otherwise the number of days from today to that date followed by " days left".
5. In "Projects", add a rollup property "Task Progress" over the relation "Tasks", property "Status", calculated as Percent per group, group Complete, shown as a percentage.
6. In "Areas", add four rollup properties over the relation "Projects", each calculated as Show original: "People via projects" (property People), "Clients via projects" (property Client), "Decisions via projects" (property Decisions), "Questions via projects" (property Questions).
7. In "Orgs", add a rollup property "Meetings via projects" over the relation "Projects", property "Meetings", calculated as Show original.
Do not change or add any other property.
```

A formula Notion AI gets wrong can be pasted by hand. Goals Countdown:

```text
if(empty(prop("Deadline")) or prop("Status") == "Achieved" or prop("Status") == "Dropped", "",
  if(dateBetween(prop("Deadline"), today(), "days") < 0, "Overdue",
    format(dateBetween(prop("Deadline"), today(), "days")) + " days left"))
```

Projects Countdown:

```text
if(empty(prop("Dates")) or prop("Status") == "Done", "",
  if(dateBetween(dateEnd(prop("Dates")), today(), "days") < 0, "Overdue",
    format(dateBetween(dateEnd(prop("Dates")), today(), "days")) + " days left"))
```

Skipped the default Tasks database? Build Task Progress over your own Tasks relation and status property.

## Verify
- [ ] Create a test goal with two key results: a Number one (Start 4, Current 6, Target 10) shows 33%; a Milestone one with Done checked shows 100%. The goal's Progress shows 67%.
- [ ] Give the test goal a Deadline 10 days from today: Countdown shows "10 days left". Set Status to Achieved: Countdown is empty.
- [ ] Create a test project with two tasks, one Done: Task Progress shows 50%.
- [ ] Delete the test goal, key results, project and tasks.
