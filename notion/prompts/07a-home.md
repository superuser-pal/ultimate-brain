# Prompt 7a — Home Space views

Paste into Notion AI **while you are on the "Home" page**, after [Prompt 6](06-templates.md). Other Spaces: [index](07-spaces-views.md). Every view, with its use case, is in [../views-guide.md](../views-guide.md).

Home leads with your own work; the brain's queues sit small in the left column, and your Inbox is a tab of "What's on today?", next to your areas or, with the Domains module, one card per Domain (decision 0113 §10). If your Home is the root "Ultimate Brain" page, paste it there.

First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md)). Lines tagged `[Domains off]` are for a space **without** the Domains module: delete them when you chose Domains.

```text
[Tasks] When mapping your own Tasks database, substitute its mapped status property and Done and Won't Do option names in every Tasks filter below, and add the New task button's page to that database, setting its mapped Kind property to Task, or nothing if it has none.
Ignore the module names in square brackets at the start of lines.
On this page ("Home"):

In the left column, under the navigation, add a heading 3 "Needs you" and one linked view, List layout, at most 5 rows:
2. "Which minutes need review?" of "Meetings": filter Brain Status is New and Date is on or before today; sort Date descending; show Name.

In the right column add, in one row:
3. A button "Quick capture": Add page to "Inbox", set Kind = Capture and Brain Status = Ready, open the page after creation.
[Reports] 3b. A button "Ask the brain": Add page to "Inbox", set Kind = Ask and Brain Status = New, open the page after creation.
4. A button "New meeting": Add page to "Meetings", set Date = today, open the page after creation.
5. A button "New project": Add page to "Projects", set Status = Planned, open the page after creation.
[Tasks] 5a. A button "New task", right after New project: Add page to "Tasks", set Kind = Task, open the page after creation. Set nothing else: Status keeps the database's default, and the task has no Project and no Due.

Below them, a heading 3 "What's on today?" and a tabs block:
[Domains] 5b. Tab "Domains", first: a linked view of "Domains", Gallery with no card preview, named "Which domain?": filter Archived is unchecked; sort Name; show Name, Summary.
[Domains] In the same tab, below it, a linked view of "Areas", List, named "Which areas have no domain?": filter Domain is empty and Archived is unchecked; sort Name; show Name, At a glance.
[Domains off] 5b. Tab "Areas", first: a linked view of "Areas", List, named "How are my areas?": filter Archived is unchecked; sort Name; show Name, At a glance.
[Domains off] [Tasks] In the same tab, below it, a linked view of "Tasks", List, at most 5 rows, named "What's due across areas?": filter Status is not Done and Status is not Won't Do and Due is on or before today; sort Due ascending; show Name, Area, Due.
[Tasks] 6. Tab "Tasks": linked view of "Tasks", List, named "What's due today?": filter Status is To Do or Doing and Due is on or before today; sort Due ascending; show Name, Project, Due.
7. Tab "Meetings": linked view of "Meetings", List, named "Which meetings are today?": filter Date is today; sort Date ascending; show Name, Date, Project.
[Domains off] 8. Tab "Projects": linked view of "Projects", Gallery with small cards, named "What's active?": filter Status is Active and Archived is unchecked; sort Priority then Name; show Name, Countdown.
8b. Tab "Inbox", last: linked view of "Inbox", List, named "What's in my inbox?": filter Brain Status is New or Ready; sort Created ascending; show Name, Kind, Brain Status.

Put the views in a tabs block (one view per tab, except the first tab, which holds both its views; tab labels as given). If you can't create tabs, add them as separate views of one linked view instead.

Below that, a heading 3 "What did the brain take in?" and two tabs:
9. Tab "Came in": linked view of "Inbox", List, at most 10 rows, named "What came in lately?": filter Brain Status is Done; sort Created descending; show Name, Kind, Project.
10. Tab "Meetings": linked view of "Meetings", List, at most 10 rows, named "Which meetings did it take in?": filter Brain Status is Done; sort Ingested At descending; show Name, Date, Project.
Put these two in their own tabs block.

Rules: only add linked views of the existing databases on "Brain Data"; never create a new database on this page. Name each view exactly as written, question mark included, and hide its database title. In every view hide the properties "Brain ID", "Last Synced", "Created time" and "Last edited time" unless the view lists them under show. Show only the properties listed. Leave the navigation column as it is. Do not add other content.
```

## Verify
- [ ] "Needs you" shows one short list, "Which minutes need review?", and a meeting dated tomorrow is not in it. There is no Review list: you decide what the brain proposes in your agent session, and the week's review is an Inbox row, Kind Weekly, in the Inbox tab, whose actions and clean-up you tick there (decisions 0096, 0110).
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status **Ready**; New meeting and New project open a page with the default template.
- [ ] (Tasks) New task sits right after New project and opens a new Tasks row with Kind Task, the default Status (To Do) and no project or due date (decision 0106 §12).
- [ ] "What's on today?" has its tabs: with Domains off, Areas, Tasks (Tasks module), Meetings, Projects, Inbox; with Domains on, Domains, Tasks (Tasks module), Meetings, Inbox. Nothing sits above the two columns (#143).
- [ ] (Domains) "Which domain?" shows one card per Domain, with its name and summary, and a card opens that Domain's home; "Which areas have no domain?" lists the Areas without one (decision 0113 §10).
- [ ] (Domains off) The Areas tab's "How are my areas?" shows one line per area that reads on its own: "Agency · 1 meeting · 2 due", or "all clear" (decisions 0050, #145).
- [ ] The Inbox tab's "What's in my inbox?" lists the New and Ready rows, oldest first, with Name, Kind and Brain Status only (#146).
- [ ] (Reports) Ask the brain creates an Inbox row with Kind Ask and Brain Status New.
- [ ] "What did the brain take in?" has two tabs, Came in and Meetings, each with the 10 latest rows.
