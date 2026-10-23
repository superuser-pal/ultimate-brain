# Prompt 5 — Property descriptions (ownership)

Paste into Notion AI. Before: [Prompt 4](04-formula-rollup.md). Next: [Prompt 6](06-templates.md).

Each description starts with who owns the property, so you can see on hover what the brain writes and what is yours (docs/notion-space-design.md §2).

```text
In every database on "Brain Data", set each property's description to start with its owner. Use the first rule that matches:
1. "Owner: system, except Ask, which you set." for Kind in "Inbox"; "Owner: you. The brain sets Open when it creates a question, and Answered once after you approve an Answer row in Review." for Status in "Questions"; "Owner: you. Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed." for Your call in "Review"; "Owner: you. With Fix, what's wrong in your words; with Approve, what to leave out ('all except b, d')." for What to fix in "Review"; "Owner: you. What to keep from it ('just the requirements'); empty: the brain asks." for Keep in "Inbox".
2. "Owner: system. Do not edit." for: Brain ID, Last Synced, Ingested At, State, Created time, Last edited time, and Created in "Inbox".
3. "Owner: you." for: every property of "Key Results" and "Tasks", and the "Tasks" relation in Projects, Areas, Meetings and Inbox; in "Inbox": Name, Brain Status, Project, Area, Full text, Refresh, Refresh report, What to fix (and the "Inbox" relation in Projects and Areas); in "Meetings": Name, Date, Attendees, Project, Area, Brain Status; in "Areas": Goals, Projects; in "Goals": Key Results, Projects; and everywhere: Status, Priority, Dates, Lifecycle, Archived, Email, Website, Relationship, Type, Your call, What to fix, Progress, Countdown, Task Progress, and every property whose name ends in "via projects".
4. "Owner: you when creating, then brain." for: Name in Areas, Goals, Projects, People and Orgs; Area in Goals and Projects; Goal in Projects.
5. "Owner: brain." for every other property.
Do not rename or change any property.
```

## Verify
- [ ] In Projects, hover: Status says "you", Key Facts says "brain", Brain ID says "system", Area says "you when creating, then brain".
- [ ] In Meetings, hover: Name and Attendees say "you", Decisions says "brain".
- [ ] In Review, hover: Your call says "you", Proposed says "brain", State says "system".
- [ ] In Inbox, hover: Kind says "system, except Ask"; in Questions, Status says the brain sets Open, then Answered once; in Review, Your call says approving makes notes trusted.
