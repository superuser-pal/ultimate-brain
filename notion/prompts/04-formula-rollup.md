# Prompt 4 — Formula and rollup

Paste into Notion AI. Before: [Prompt 3](03-relations.md). Next: [Prompt 5](05-ownership.md).

```text
In "Key Results", add a formula property "Progress" that returns a number between 0 and 1:
if Kind is "Milestone", return 1 when Done is checked, otherwise 0;
if Kind is "Number", return (Current - Start) / (Target - Start), limited to between 0 and 1, and 0 when Target equals Start.
Show it as a percentage.

In "Goals", add a rollup property "Progress" over the relation "Key Results", property "Progress", calculated as Average, shown as a percentage.
```

## Verify
- [ ] Create a test goal with two key results: a Number one (Start 4, Current 6, Target 10) shows 33%; a Milestone one with Done checked shows 100%.
- [ ] The goal's Progress shows 67%.
- [ ] Delete the test goal and its key results.
