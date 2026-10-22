# Prompt 7e — Review Space views

Paste into Notion AI **while you are on the "Review" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Why and Source Meeting are on each proposal's page. What to fix is in the "What needs my decision?" table: with Fix, say what's wrong in your words ("a: March"); with Approve, what to leave out ("all except b, d") (0045).

```text
On this page ("Review"), first add one gray paragraph: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. To correct something, pick Fix in Your call and say what's wrong in What to fix." Then add four tabs, each a linked view of "Review":
1. Tab "Needs my decision": Table, named "What needs my decision?": filter State is Pending; sort Created time descending; show Name, Kind, Now, Proposed, Your call, What to fix.
2. Tab "Sources disagree": Table, named "Where do sources disagree?": filter Kind is Contradiction and State is Pending; sort Created time ascending; show Name, Now, Proposed, Your call.
3. Tab "Approved": List, named "What did I approve recently?": filter State is Applied and Last edited time is within the past month (relative date); sort Last edited time descending; show Name, Kind, Proposed.
4. Tab "Rejected": List, named "What did I reject?": filter State is Closed; sort Last edited time descending; show Name, Kind.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] A gray line starting "Approving makes these notes trusted" sits above the tabs.
- [ ] Four tabs: Needs my decision, Sources disagree, Approved, Rejected.
- [ ] "What needs my decision?" shows only Pending rows, and Your call can be set in the view.
