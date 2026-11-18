# Prompt 4 — Formulas and rollups

Paste into Notion AI. Before: [Prompt 3](03-relations.md). Next: [Prompt 5](05-ownership.md).

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md)). Progress is used by the brain's planning snapshot (0020). Countdown, Task Progress, the Areas counts and the "via projects" rollups are Notion-only: the brain never reads them (docs/notion-space-design.md §3).

```text
Ignore the module names in square brackets at the start of lines.
[Planning] 1. In "Key Results", add a formula property "Progress" that returns a number between 0 and 1: if Kind is "Milestone", return 1 when Done is checked, otherwise 0; if Kind is "Number", return (Current - Start) / (Target - Start), limited to between 0 and 1, and 0 when Target equals Start. Show it as a percentage.
[Planning] 2. In "Goals", add a rollup property "Progress" over the relation "Key Results", property "Progress", calculated as Average, shown as a percentage.
[Planning] 3. In "Goals", add a formula property "Countdown" that returns text: empty when Deadline is empty or Status is Achieved or Dropped; "Overdue" when Deadline is before today; otherwise the number of days from today to Deadline followed by " days left".
4. In "Projects", add a formula property "Countdown" that returns text: empty when Dates is empty or Status is Done; "Overdue" when the end of Dates (or Dates itself if it has no end) is before today; otherwise the number of days from today to that date followed by " days left".
[Tasks] 5. In "Projects", add a formula property "Task Progress" using the formula below. It displays completed and dropped counts separately and the percentage of non-dropped tasks; zero active scope has no percentage.
6. In "Areas", add a rollup property "People via projects" over the relation "Projects", property People, calculated as Show original.
[Orgs] 7. In "Areas", add a rollup property "Clients via projects" over the relation "Projects", property Client, calculated as Show original.
[Orgs] 8. In "Orgs", add a rollup property "Meetings via projects" over the relation "Projects", property "Meetings", calculated as Show original.
9. In "Areas", add a formula property "Meetings to review" that returns the number of pages in the relation "Meetings" whose Brain Status is New and whose Date is today or earlier.
[Tasks] 10. In "Areas", add a formula property "Due" that returns the number of pages in the relation "Tasks" whose Status is neither Done nor Won't Do and whose Due is today or earlier.
11. In "Areas", add a formula property "At a glance" that returns text: "<n> meeting" (or "<n> meetings") from Meetings to review, or "all clear" when it is 0.
[Tasks] In "At a glance", also join "<n> due" from Due, after the meetings part, with " · ", left out when 0; "all clear" when both are 0.
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

Areas Meetings to review and, with Tasks, Due (0050), in that order:

```text
prop("Meetings").filter(current.prop("Brain Status") == "New" and !empty(current.prop("Date")) and dateBetween(current.prop("Date"), today(), "days") <= 0).length()
```

```text
prop("Tasks").filter(current.prop("Status") != "Done" and current.prop("Status") != "Won't Do" and !empty(current.prop("Due")) and dateBetween(current.prop("Due"), today(), "days") <= 0).length()
```

Areas At a glance (#145): the line Home shows next to each area's name, "1 meeting · 2 due" or "all clear" (since 0.16.0 it has no Review count: you decide in your agent session, decision 0096). With Tasks:

```text
lets(m, prop("Meetings to review"), d, prop("Due"),
  parts, [if(m > 0, format(m) + if(m == 1, " meeting", " meetings"), ""), if(d > 0, format(d) + " due", "")].filter(current != ""),
  if(parts.length() == 0, "all clear", parts.join(" · ")))
```

Without Tasks:

```text
lets(m, prop("Meetings to review"),
  if(m > 0, format(m) + if(m == 1, " meeting", " meetings"), "all clear"))
```

**Projects · Task Progress** (substitute mapped status names for an external Tasks database):

```notion
lets(tasks, prop("Tasks"), total, tasks.length(), done, tasks.filter(current.prop("Status") == "Done").length(), dropped, tasks.filter(current.prop("Status") == "Won't Do").length(), active, total - dropped, if(total == 0, "no active tasks", format(done) + " completed · " + format(dropped) + " dropped" + if(active == 0, "", " · " + format(round(100 * done / active)) + "%")))
```

Mapping your own tasks database? Build Task Progress and Due over your own Tasks relation and status property ([modules/tasks.md](../modules/tasks.md)).

## Verify
- [ ] (Planning) Create a test goal with two key results: a Number one (Start 4, Current 6, Target 10) shows 33%; a Milestone one with Done checked shows 100%. The goal's Progress shows 67%.
- [ ] (Planning) Give the test goal a Deadline 10 days from today: Countdown shows "10 days left". Set Status to Achieved: Countdown is empty.
- [ ] (Tasks) Create a project with eight Done and two Won't Do: Task Progress shows 8 completed · 2 dropped · 100%. With three dropped and no other tasks it shows 0 completed · 3 dropped; with no tasks it shows no active tasks.
- [ ] In Areas, a test area with no meeting shows At a glance "all clear"; link a test meeting dated yesterday, Brain Status New: it shows "1 meeting".
- [ ] Delete the test goal, key results, project, tasks, meeting and area.
