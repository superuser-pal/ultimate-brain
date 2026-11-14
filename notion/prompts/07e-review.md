# Prompt 7e — Review Space views

Paste into Notion AI **while you are on the "Review" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Status says where each row is decided (decision 0088). A row from a source is a page with one section per change (decision 0055), and its Status reads "Needs you · decide in the page": read it, or click Review with me to go through it with Brain Assistant; correct a wording where it stands or type `Accept`, `Reject` or `Defer` on an item's Decision line; then set Your call (decision 0090). A Conflict, Answer or Suggestion row, and a row from before 0.8.0, reads "Needs you · set Your call": Approve, Reject, or Fix with what's wrong in What to fix in your words ("a: March"); with Approve, What to fix can say what to leave out ("all except b, d") (0045).

```text
On this page ("Review"), first add one gray paragraph: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. Status says what each row needs. Needs you · decide in the page: open the row, read it or click Review with me, correct what you want, then set Your call. Needs you · set Your call: pick Approve or Reject, or Fix and say what's wrong in What to fix." Then add four tabs, each a linked view of "Review":
1. Tab "Needs my decision": Table, named "What needs my decision?": filter State is Pending; sort Created time descending; show Status, Name, Type, Your call, Area.
2. Tab "Sources disagree": Table, named "Where do sources disagree?": filter Kind is Contradiction and State is Pending; sort Created time ascending; show Status, Name, Now, Proposed, Your call.
3. Tab "Approved": List, named "What did I approve recently?": filter State is Applied and Last edited time is within the past month (relative date); sort Last edited time descending; show Name, Type, Proposed.
4. Tab "Rejected": List, named "What did I reject?": filter State is Closed; sort Last edited time descending; show Name, Type.

Put the views in a tabs block (one view per tab, tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Hide Kind in every view: Type says the kind of row (decisions 0048, 0088). Status comes first wherever it is shown.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] A gray line starting "Approving makes these notes trusted" sits above the tabs.
- [ ] Four tabs: Needs my decision, Sources disagree, Approved, Rejected.
- [ ] "What needs my decision?" shows only Pending rows, Status first, a Type column (From source, Conflict, Answer, Suggestion) and no Kind, and Your call can be set in the view.
- [ ] No Review view shows Kind.
