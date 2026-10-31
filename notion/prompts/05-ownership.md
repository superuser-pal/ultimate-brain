# Prompt 5 — Property descriptions (ownership)

Paste into Notion AI. Before: [Prompt 4](04-formula-rollup.md). Next: [Prompt 6](06-templates.md).

Each description starts with who owns the property, so you can see on hover what the brain writes and what is yours (docs/notion-space-design.md §2).

```text
In every database on "Brain Data", set each property's description to start with its owner. Use the first rule that matches; skip a property your space doesn't have:
1. "Owner: system, written only when empty, so a Kind you choose stands. Ask is yours." for Kind in "Inbox"; "Owner: you. Set Ready to have the brain take the row in; it sets Done when it has, or when it skipped the row (Summary says why)." for Brain Status in "Inbox"; "Owner: you, through the Keep as document button. Waiting for the brain; it clears it." for Document asked in "Inbox"; "Owner: you, ticked by hand to queue a full refresh from the brain's notes. Waiting for the brain; it clears it." for Refresh asked in "Inbox"; "Owner: you. On a Report row: what the report gets wrong; the brain clears it." for What to fix in "Inbox"; "Owner: you, through the Promote to document button. Waiting for the brain; it clears it." for Promote asked in "Decisions" and "Concepts"; "Owner: you. The brain sets Open when it creates a question, and Answered once after you approve an Answer row in Review." for Status in "Questions"; "Owner: you. Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed." for Your call in "Review"; "Owner: you. With Fix, what's wrong in your words; with Approve, what to leave out ('all except b, d')." for What to fix in "Review"; "Owner: you. Only this part is kept as a Document ('the requirements table'); empty = the whole input." for Only keep in "Inbox".
2. "Owner: system. Do not edit." for: Brain ID, Last Synced, Ingested At, State, Created time, Last edited time, and Created in "Inbox".
2a. "Owner: you, through the Accept write-up or Accept refresh button. The brain clears it once it has taken the accepted text in." for Accepted and Accepted at (in "Documents" and in "Inbox").
3. "Owner: you." for: every property of "Key Results" and "Tasks", and the "Tasks" relation in Projects, Areas, Meetings and Inbox; in "Inbox": Name, Project, Area (and the "Inbox" relation in Projects and Areas); in "Meetings": Name, Date, Attendees, Project, Area, Brain Status; in "Areas": Goals, Projects; in "Goals": Key Results, Projects; and everywhere: Status, Priority, Dates, Lifecycle, Archived, Email, Website, Relationship, Type, Your call, What to fix, Progress, Countdown, Task Progress, Type, To review, Due, Meetings to review, and every property whose name ends in "via projects".
4. "Owner: you when creating, then brain." for: Name in Areas, Goals, Projects, People and Orgs; Area in Goals and Projects; Goal in Projects.
5. "Owner: brain." for every other property.
Do not rename or change any property.
```

## Verify
- [ ] In Projects, hover: Status says "you", Key Facts says "brain", Brain ID says "system", Area says "you when creating, then brain".
- [ ] In Meetings, hover: Name and Attendees say "you", Decisions says "brain".
- [ ] In Review, hover: Your call says "you", Proposed says "brain", State says "system".
- [ ] In Inbox, hover: Kind says "written only when empty"; Brain Status says Ready and Done; Only keep says "empty = the whole input"; in Questions, Status says the brain sets Open, then Answered once; in Review, Your call says approving makes notes trusted.
