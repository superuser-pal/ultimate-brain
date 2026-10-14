# Prompt 7f — Knowledge Space views

Paste into Notion AI **while you are on the "Knowledge" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Easlo's Notes Dashboard pattern: one tab per database, and inside each tab one linked view with several views.

```text
On this page ("Knowledge") add five tabs. In each tab put one linked view of the named database, with the views listed as its view tabs, in order:

1. Tab "Decisions" (database "Decisions"):
   - List "What did we decide recently?": Date is within the past week; sort Date descending; show Name, Project, Date.
   - Table "What did we decide?": Assessment is Accepted and Lifecycle is not Archived; sort Date descending; show Name, Project, Date, Summary.
   - List "What's provisional?": Assessment is Provisional; sort Date descending; show Name, Project, Date.
   - Table "What changed our minds?": Assessment is Superseded; sort Date descending; show Name, Superseded By, Date.
   - List "What's disputed?": Lifecycle is Disputed; sort Last edited time descending; show Name, Summary.
2. Tab "Questions" (database "Questions"):
   - List "What's still open?": Status is Open and Kind is Question; sort Created time descending; show Name, Project, Raised In.
   - List "Which risks are open?": Status is Open and Kind is Risk; sort Created time descending; show Name, Project, Raised In.
   - List "What did we answer?": Status is Answered; sort Created time descending; show Name, Project, Summary.
3. Tab "People" (database "People"):
   - Gallery with small cards "Who's who?": Lifecycle is not Archived; sort Name; group by Org; show Name, Role, Org.
   - List "Who's disputed?": Lifecycle is Disputed; sort Name; show Name, Summary.
4. Tab "Orgs" (database "Orgs"):
   - Table "Which clients do I have?": Relationship is Client and Lifecycle is not Archived; sort Name; show Name, People, Projects.
   - Table "Who else do we work with?": Relationship is not Client and Lifecycle is not Archived; sort Name; group by Relationship; show Name, Relationship, People.
5. Tab "Inbox" (database "Capture Inbox"):
   - List "What's in my inbox?": Brain Status is New; sort Created descending; show Name, Created.

If you can't create tabs, add one heading 3 per database instead, each followed by its linked view.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] Five tabs: Decisions, Questions, People, Orgs, Inbox, each with its views as view tabs.
- [ ] "What changed our minds?" shows only Superseded decisions.
