# Prompt 7h — Archive page views

Paste into Notion AI **while you are on the "Archive" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

The Archive page sits on "System" and is linked from the navigation. It keeps finished records out of the Spaces.

```text
On this page ("Archive") add seven tabs, each with one linked view:
1. Tab "Projects": "Projects", Table, named "What's finished?": filter Status is Done or Archived is checked (a filter group joined with Or); sort Dates (end) descending; show Name, Dates, Client, Status.
2. Tab "Goals": "Goals", Table, named "Which goals are closed?": filter Status is Achieved or Dropped, or Archived is checked (a filter group joined with Or); sort Deadline descending; show Name, Status, Deadline.
3. Tab "Areas": "Areas", List, named "Which areas did I close?": filter Archived is checked; sort Name; show Name, Type.
4. Tab "Decisions": "Decisions", List, named "Which decisions are archived?": filter Lifecycle is Archived; sort Date descending; show Name, Project, Date.
5. Tab "Questions": "Questions", List, named "Which questions are archived?": filter Lifecycle is Archived; sort Created time descending; show Name, Project, Status.
6. Tab "People": "People", List, named "Who is archived?": filter Lifecycle is Archived; sort Name; show Name, Org.
7. Tab "Orgs": "Orgs", List, named "Which orgs are archived?": filter Lifecycle is Archived; sort Name; show Name, Relationship.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] Seven tabs, one per database.
- [ ] The Projects and Goals filter groups are joined with Or.
