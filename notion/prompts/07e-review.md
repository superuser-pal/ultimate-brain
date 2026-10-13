# Prompt 7e — Review Space views

Paste into Notion AI **while you are on the "Review" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md).

This page holds only linked views of databases on "Brain Data". No navigation or layout work is in this prompt.

```text
On this page ("Review") add four linked views of "Review":

1. Table layout, named "What needs my decision?": filter State is Pending; sort Created time descending; show Name, Kind, Before, After, Why, Source Meeting, Decision, Edited Value.
2. Table layout, named "Where do sources disagree?": filter Kind is Contradiction and State is Pending; sort Created time ascending; show Name, Before, After, Why, Source Meeting, Decision, Edited Value.
3. List layout, named "What did I approve recently?": filter State is Applied and Last edited time is within the past month (relative date); sort Last edited time descending; show Name, Kind, Decision, After.
4. List layout, named "What did I reject?": filter State is Closed; sort Last edited time descending; show Name, Kind, Decision, Why.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included. In every view hide the properties "Brain ID" and "Last Synced". Show only the properties listed. Do not add other content.
```

## Verify
- [ ] Only four linked views of Review are on the page.
- [ ] "What needs my decision?" shows only Pending rows and has the Decision and Edited Value columns.
- [ ] View 3 uses a relative date filter.
