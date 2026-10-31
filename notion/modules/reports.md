# Reports

Ask the brain a question in the Inbox and get a living report on the project's or area's page, which you can refresh and correct (decisions 0043, 0045, 0048; docs/notion-space-design.md §3.11). Off by default. It has no database of its own: Ask and Report rows live in the Inbox.

## Turning it on

### 1 · Properties

| Change | Who |
|---|---|
| Inbox: add **Refresh asked** (checkbox), **What to fix** (text), **Accepted** (checkbox) and **Accepted at** (date, with time) | agent |
| Inbox: a relation of the Inbox to itself, "Ask" ↔ "Report" (a report row's Ask, an Ask row's Report) | agent |
| Descriptions: Refresh asked "Owner: you, ticked by hand to queue a full refresh from the brain's notes. Waiting for the brain; it clears it."; What to fix "Owner: you. On a Report row: what the report gets wrong; the brain clears it."; Ask and Report "Owner: brain." | agent |

### 2 · Views and the Ask button

**Notion AI**, on each page in turn:
> - Home: next to the button "Quick capture", add a button "Ask the brain": Add page to "Inbox", set Kind = Ask and Brain Status = New, open the page after creation.
> - Projects template (Projects → New ▾ → the default template): before the toggle "My notes", add an H3 heading "Reports" followed by a linked view of Inbox where Project is this page and Kind is Report, sorted Created descending, showing Name, Refresh asked, What to fix, with the database title hidden.
> - Areas template: the same, with "Area is this page".
>
> Don't change anything else.

### 3 · The Refresh report button and the layout

**By hand** (the API can't create buttons or edit page layouts):
0. **Since 0.8.0 (0054)** the Update button no longer ticks Refresh asked: it sends a message to Brain Assistant (the Refresh report message in [views-guide.md](../views-guide.md) §9). To queue the old full refresh from Git, tick **Refresh asked** by hand. Add a Button property "Accept" with the label "Accept refresh": **Edit property** on **This page**: Accepted → checked, Accepted at → Now.
1. **Inbox → Update:** open Inbox as a full page → `•••` → Properties → **New property** → **Button**, named "Update", with the label "Refresh report". Action **Send message to** Brain Assistant, with the Refresh report message of [views-guide.md](../views-guide.md) §9 (before 0.8.0 the action was **Edit property**: Refresh asked → checked). It shows on every row; Brain Assistant acts on it only on a Report row.
2. **Page layout** (open any Inbox row → **Customize layout**): pin Update and Accept next to Brain Status, and put Refresh asked, Accepted and Accepted at at the top of the property group ([views-guide.md](../views-guide.md) §9).

### Verify
- [ ] `brain modules` shows `reports` on.
- [ ] **Ask the brain** on Home creates an Inbox row with Kind Ask and Brain Status New.
- [ ] After the next catch-up, the Ask row is Done and links a Report row, which shows under "Reports" on its project's page.
- [ ] Ticking **Refresh asked** by hand queues a full refresh: the next catch-up rewrites the report and clears the box (it waits while a Proposed refresh or unaccepted edit is on the page).
- [ ] Clicking **Refresh report** adds one toggle "Proposed refresh · based on Notion" at the end of the page and ticks nothing; a second click replaces only that toggle. After you replace the report text with its contents, delete the toggle and click **Accept refresh**, the next catch-up shows the change and imports it.

## Turning it off

The brain stops answering Ask rows and refreshing reports, and no longer publishes reports to Notion; "report on …" in chat still works and answers in chat. You may hide: the Ask the brain button on Home, the "Reports" headings on project and area pages, and the Update button, Refresh asked and What to fix in the Inbox layout.
