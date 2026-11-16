# Prompt 7f — Knowledge Space views

Paste into Notion AI **while you are on the "Knowledge" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md)). Easlo's Notes Dashboard pattern: one tab per database, and inside each tab one linked view with several views.

```text
Ignore the module names in square brackets at the start of lines.
On this page ("Knowledge") add one tab per numbered item you have. In each tab put one linked view of the named database, with the views listed as its view tabs, in order:

[Documents] 1. Tab "Documents" (database "Documents"):
[Documents]    - List "What did we keep?": Lifecycle is not Archived and Origin is not Report; sort Last edited time descending; show Name, Project, Summary.
[Documents]    - List "What did we learn?": Origin is Learned and Lifecycle is not Archived; sort Created time descending; show Name, Project, Summary.
[Reports]    - List "Which reports do I have?": Origin is Report; sort Last edited time descending; show Name, Project, Area, Refresh asked, What to fix.
2. Tab "People" (database "People"):
   - Gallery with small cards "Who's who?": Lifecycle is not Archived; sort Name; show Name, Role.
[Orgs]    - In "Who's who?", also group by Org and show Org.
   - List "Who's disputed?": Lifecycle is Disputed; sort Name; show Name, Summary.
[Orgs] 3. Tab "Orgs" (database "Orgs"):
[Orgs]    - Table "Which clients do I have?": Relationship is Client and Archived is unchecked; sort Name; show Name, People, Projects.
[Orgs]    - Table "Who else do we work with?": Relationship is not Client and Archived is unchecked; sort Name; group by Relationship; show Name, Relationship, People.
4. Tab "Inbox" (database "Inbox"):
   - Table "What came in?": Brain Status is Done; sort Created descending; show Name, Kind, Summary, Project.

If you can't create tabs, add one heading 3 per database instead, each followed by its linked view.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] One tab per database you have (four with every module: Documents, People, Orgs, Inbox), each with its views as view tabs.
- [ ] No tab shows Decisions or Questions: since 0.16.0 a project's decisions and open questions are in its Brief and Decision log (decision 0099).
