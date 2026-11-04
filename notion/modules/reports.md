# Reports

Ask the brain a question in the Inbox and get a living report on the project's or area's page, which you can refresh and correct (decisions 0043, 0045, 0048, 0071; docs/notion-space-design.md §3.11 and §3.14). Off by default. A report is a page of the **Documents** database with Origin Report, so Reports needs the Documents module: `brain modules on reports` turns Documents on too. Your Ask rows stay in the Inbox. (Before 0.9.1 reports were Inbox rows of Kind Report; [migration 0019](../migrations/0019-reports-move-to-documents.md) moves them.)

## Turning it on

Build the Documents module first if your space doesn't have it ([documents.md](documents.md)).

### 1 · Properties

| Change | Who |
|---|---|
| Documents: add **Refresh asked** (checkbox) and **What to fix** (text). Origin, Accepted and Accepted at come with the Documents module | agent |
| A two-way relation Documents "Asked in" ↔ Inbox "Report" (a report's Ask rows, an Ask row's report) | agent |
| Descriptions: Refresh asked "Owner: you, ticked by hand to queue a full refresh from the brain's notes. Waiting for the brain; it clears it."; What to fix "Owner: you. On a report: what it gets wrong; the brain clears it."; Asked in and Report "Owner: brain." | agent |

### 2 · Views and the Ask button

**Notion AI**, on each page in turn:
> - Home: next to the button "Quick capture", add a button "Ask the brain": Add page to "Inbox", set Kind = Ask and Brain Status = New, open the page after creation.
> - Projects template (Projects → New ▾ → the default template): before the toggle "My notes", add an H3 heading "Reports" followed by a linked view of Documents where Project is this page and Origin is Report, sorted Created time descending, showing Name, Refresh asked, What to fix, with the database title hidden.
> - Areas template: the same, with "Area is this page".
> - Knowledge, in its Documents tab: add a view "Which reports do I have?" of Documents, List: Origin is Report; sort Last edited time descending; show Name, Project, Area, Refresh asked, What to fix.
>
> Don't change anything else.

### 3 · The Refresh report button and the layout

**By hand** (the API can't create buttons or edit page layouts):
1. **Documents → Update:** open Documents as a full page → `•••` → Properties → **New property** → **Button**, named "Update", with the label "Refresh report". Action **Send message to** Brain Assistant, with the Refresh report message of [views-guide.md](../views-guide.md) §9. It shows on every Documents row; Brain Assistant acts on it only on a report. To queue a full refresh from Git instead, tick **Refresh asked** by hand.
2. **Accept** is the Documents module's button (label "Accept"): it works for a refreshed report as for a write-up.
3. **Page layout** (open any Documents row → **Customize layout**): pin Update next to Write and Accept, and put Refresh asked and What to fix at the top of the property group, after Accepted and Accepted at ([views-guide.md](../views-guide.md) §9).

### Verify
- [ ] `brain modules` shows `reports` and `documents` on, with nothing missing.
- [ ] **Ask the brain** on Home creates an Inbox row with Kind Ask and Brain Status New.
- [ ] After the next catch-up, the Ask row is Done and its Report relation links a Documents page with Origin Report, which shows under "Reports" on its project's page.
- [ ] Ticking **Refresh asked** by hand on that page queues a full refresh: the next catch-up rewrites the report in place (same page) and clears the box (it waits while a Proposed refresh or an unaccepted edit is on the page).
- [ ] Clicking **Refresh report** adds one toggle "Proposed refresh · based on Notion" at the end of the page and ticks nothing; a second click replaces only that toggle. After you replace the report text with its contents, delete the toggle and click **Accept**, the next catch-up shows the change and imports it.

## Turning it off

The brain stops answering Ask rows and refreshing reports, and no longer publishes reports to Notion; "report on …" in chat still works and answers in chat. Documents stays on. You may hide: the Ask the brain button on Home, the "Reports" headings on project and area pages, the "Which reports do I have?" view, and the Update button, Refresh asked and What to fix in the Documents layout. Turning Documents off turns Reports off too.
