# Prompt 7f — Knowledge Space views

Paste into Notion AI **while you are on the "Knowledge" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md)). Easlo's Notes Dashboard pattern: one tab per database, and inside each tab one linked view with several views.

```text
Ignore the module names in square brackets at the start of lines.
On this page ("Knowledge") add one tab per numbered item you have. In each tab put one linked view of the named database, with the views listed as its view tabs, in order:

[Knowledge] 1. Tab "Decisions" (database "Decisions"):
[Knowledge]    - List "What did we decide recently?": Date is within the past week; sort Date descending; show Name, Project, Date.
[Knowledge]    - Table "What did we decide?": Assessment is Accepted and Lifecycle is not Archived; sort Date descending; show Name, Project, Date, Summary.
[Knowledge]    - List "What's provisional?": Assessment is Provisional; sort Date descending; show Name, Project, Date.
[Knowledge]    - Table "What changed our minds?": Assessment is Superseded; sort Date descending; show Name, Superseded By, Date.
[Knowledge]    - List "What's disputed?": Lifecycle is Disputed; sort Date descending; show Name, Summary.
[Knowledge] 2. Tab "Questions" (database "Questions"):
[Knowledge]    - List "What's still open?": Status is Open and Kind is Question; sort Created time descending; show Name, Project, Raised In.
[Knowledge]    - List "Which risks are open?": Status is Open and Kind is Risk; sort Created time descending; show Name, Project, Raised In.
[Knowledge]    - List "What did we answer?": Status is Answered; sort Created time descending; show Name, Project, Summary.
[Knowledge] 3. Tab "Concepts" (database "Concepts"):
[Knowledge]    - List "What did we learn recently?": Lifecycle is not Archived; sort Created time descending; show Name, Project, Summary.
[Knowledge]    - Table "What do we know per project?": Lifecycle is not Archived; sort Name; group by Project; show Name, Area, Summary.
[Knowledge]    - List "Which concepts are drafts?": Lifecycle is Draft; sort Created time descending; show Name, Project.
[Documents] 3b. Tab "Documents" (database "Documents"):
[Documents]    - List "What did we keep?": Lifecycle is not Archived; sort Last edited time descending; show Name, Project, Summary.
4. Tab "People" (database "People"):
   - Gallery with small cards "Who's who?": Lifecycle is not Archived; sort Name; show Name, Role.
[Orgs]    - In "Who's who?", also group by Org and show Org.
   - List "Who's disputed?": Lifecycle is Disputed; sort Name; show Name, Summary.
[Orgs] 5. Tab "Orgs" (database "Orgs"):
[Orgs]    - Table "Which clients do I have?": Relationship is Client and Lifecycle is not Archived; sort Name; show Name, People, Projects.
[Orgs]    - Table "Who else do we work with?": Relationship is not Client and Lifecycle is not Archived; sort Name; group by Relationship; show Name, Relationship, People.
6. Tab "Inbox" (database "Inbox"):
   - Table "What came in?": Brain Status is Done; sort Created descending; show Name, Kind, Summary, Project.
[Knowledge]    - In "What came in?", also show Decisions and Concepts.

If you can't create tabs, add one heading 3 per database instead, each followed by its linked view.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] One tab per database you have (seven with every module: Decisions, Questions, Concepts, Documents, People, Orgs, Inbox), each with its views as view tabs.
- [ ] (Knowledge) "What changed our minds?" shows only Superseded decisions.
