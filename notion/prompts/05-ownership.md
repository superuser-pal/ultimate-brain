# Prompt 5 — Property descriptions (ownership)

Paste into Notion AI. Before: [Prompt 4](04-formula-rollup.md). Next: [Prompt 6](06-templates.md).

Each description starts with who owns the property, so you can see on hover what the brain writes and what is yours (docs/notion-space-design.md §2). An edit to a brain-owned value is never taken in by itself: your next agent session asks it, since the brain can't tell your edit from one by Notion AI or another tool (decision 0101 §4).

```text
In every database on "Brain Data", set each property's description to start with its owner. Use the first rule that matches; skip a property your space doesn't have:
1. "Owner: system, written only when empty, so a Kind you choose stands. Ask is yours." for Kind in "Inbox"; "Owner: you. Set Ready to have the brain take the row in; it sets Done when it has, or when it skipped the row (Summary says why)." for Brain Status in "Inbox"; "Owner: you, through the Keep as document button. Waiting for the brain; it clears it." for Document asked in "Inbox" and in "Tasks"; "Owner: you, ticked by hand to queue a full refresh from the brain's notes. Waiting for the brain; it clears it." for Refresh asked in "Documents"; "Owner: you. On a report: what it gets wrong; the brain clears it." for What to fix in "Documents"; "Owner: brain on a task it creates to track a question or risk you said to follow up (Question or Risk); empty or Task otherwise. You may set Task." for Kind in "Tasks"; "Owner: you. Only this part goes in, as a changed version you check first ('the requirements table'); empty = the whole input." for Only keep in "Inbox".
1a. "Owner: brain. On a changed version of a document: the row it was changed from. Written once." for Changed from in "Inbox"; "Owner: brain. On a changed version: what it dropped or altered, one line each. Written once; kept with the row when it goes in." for What changed in "Inbox"; "Owner: brain. On a Document kept from a task: that task. Written by the brain only." for Task in "Documents".
1b. "Owner: Notion. Derived from the Area's Domain; you never edit it." for Domain in "Projects", "Meetings" and "Documents", and in "Tasks", "Inbox", "Goals" and "Factories" (a rollup; Domain in "Areas" is a relation, and rule 5 covers it).
2. "Owner: system. Do not edit." for: Brain ID, Last Synced, Ingested At, Created time, Last edited time, and Created in "Inbox".
2a. "Owner: you, through the Accept button. The brain clears it once it has taken the accepted text in." for Accepted and Accepted at in "Documents".
2b. "Owner: you. The brain sets it only when you connect work to Notion, or end that connection, after your yes." for Workflow, Work type, Logging level and Log artifacts in "Projects" and "Areas", and for Workflow in "Factories".
2c. "Owner: brain. Never read back: to change it, change the folder's link in a session there." for Name, Area and Projects in "Factories", and for Factories in "Areas" and "Projects"; "Owner: brain. When the Overview on the page was last written." for Overview as of in "Factories"; "Owner: brain. Ticked when the repo is unlinked or the folder's connection ended. Never read back." for Archived in "Factories"; "Owner: you. The folder where you want this done: a session there lists it and agrees with you how." for Factory in "Tasks".
3. "Owner: you." for: every property of "Key Results", every other property of "Tasks", and the "Tasks" relation in Projects, Areas, Meetings, Inbox and Factories; in "Inbox": Name, Project, Area (and the "Inbox" relation in Projects and Areas); in "Meetings": Name, Date, Attendees, Project, Area, Brain Status; in "Areas": Goals, Projects; in "Goals": Key Results, Projects; and everywhere: Status, Priority, Dates, Lifecycle, Archived, Email, Website, Relationship, Progress, Countdown, Task Progress, Due, Meetings to review, and every property whose name ends in "via projects".
4. "Owner: you when creating, then brain. A later edit is asked in your agent session before it reaches the brain." for: Name in Areas, Goals, Projects, People and Orgs; Area in Goals and Projects; Goal in Projects.
5. "Owner: brain. An edit here is asked in your agent session before it reaches the brain." for every other property.
Do not rename or change any property.
```

## Verify
- [ ] In Projects, hover: Status says "you", Key Facts says "brain", Brain ID says "system", Area says "you when creating, then brain".
- [ ] In Projects and Areas, hover: Workflow, Work type, Logging level and Log artifacts say "you" and "after your yes".
- [ ] In Meetings, hover: Name and Attendees say "you"; in Projects, Key Facts says "brain" and that an edit is asked in your agent session.
- [ ] (Tasks) In Tasks, hover: Kind says the brain sets Question or Risk.
- [ ] In Projects, Meetings, Inbox and, of your modules, Documents, Tasks, Goals and Factories, hover: Domain says "Owner: Notion" and "Derived from the Area's Domain"; in Areas, Domain says "brain".
- [ ] (Factories) In Factories, hover: Area and Projects say "Never read back"; Archived says "brain"; Workflow says "you"; (Tasks) in Tasks, Factory says "you".
- [ ] In Inbox, hover: Kind says "written only when empty"; Brain Status says Ready and Done; Only keep says "empty = the whole input"; Changed from and What changed say "Written once".
- [ ] (Tasks) In Tasks, hover: Document asked says "through the Keep as document button".
