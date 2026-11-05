# 0019 · Reports move to Documents

**Design change:** decision [0071](../../decisions/0071-a-simpler-notion.md) §2; CC-124 (release 0.9.1; docs/notion-space-design.md §3.11, §3.14, §3.15, §3.17; spec/schema.md §14; spec/cli.md §5.14). **Applies to:** spaces built or migrated before 0.9.1. Run 0017 first. Run it **before the first publish on 0.9.1**: from 0.9.1 the brain publishes reports to Documents with Origin and Asked in, and a space without them rejects the write. A step already done changes nothing, so running this again is safe.

What changes: **a report is a page in Documents** with Origin = Report, instead of an Inbox row of Kind Report. It still works the same way: one per subject, refreshed in place, What to fix on its page, never taken back in as a source. Your **Ask rows stay in the Inbox** and link to their report. Every Document gets **Origin** (Kept, Learned, Report, Promoted, Workflow), so the Documents views can tell them apart. The two accept buttons become one, **Accept**. The summary an unattended catch-up leaves in the Inbox gets its own Kind, **Catch-up**.

Before you start, run `brain upgrade`: a brain with Reports on now needs Documents on too, and the upgrade turns it on (`DOCUMENTS_TURNED_ON`). If your space has no Documents database yet, build it first with [../modules/documents.md](../modules/documents.md), then come back here.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **Notion AI:** you paste the prompt on the page named;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## 1 · Documents · Origin (agent; Documents module)

Read the Documents data source first. **Origin is missing** (migration 0018, CC-123's "Concepts become Documents" in the same 0.9.1 release, adds the same property; whichever of the two you run first adds it): add **Origin** (select) with the options Kept, Learned, Report, Promoted, Workflow, in that order, and the description "Owner: brain." **It exists as a select:** add only the options it lacks, sending the existing options with their ids first, so none is dropped. **It exists with another type:** change nothing, report it, and ask the user.

The next publish fills Origin on every Document.

## 2 · Report properties and the relation (agent; Reports module)

1. **Documents:** add **Refresh asked** (checkbox) and **What to fix** (text), with the descriptions "Owner: you, ticked by hand to queue a full refresh from the brain's notes. Waiting for the brain; it clears it." and "Owner: you. On a report: what it gets wrong; the brain clears it." Documents already has Accepted and Accepted at (migration 0012).
2. **Free the name "Report" on the Inbox.** Today Inbox "Ask" ↔ Inbox "Report" is a relation of the Inbox to itself. Rename the two sides **Old ask** and **Old report** (a rename keeps the values; you delete them after step 7).
3. **The new relation:** Documents "Asked in" ↔ Inbox "Report", two-way, both described "Owner: brain."
4. **Inbox · Kind:** add the option **Catch-up**, sending the existing options with their ids first. Then list the Inbox rows of Kind Report **with no Brain ID**: those are summaries of unattended catch-ups, not reports. After your yes, set their Kind to Catch-up. They stay in the Inbox.

## 3 · Move the Report rows (by hand; Reports module)

Moving keeps each page: its id, body, comments, and any Proposed refresh or accepted text on it, so the brain still knows it as the same report.

1. Open the Inbox as a full page and filter: **Kind is Report** and **Brain ID is not empty**. Every row the filter shows is a report (its Brain ID starts with `vw-`).
2. Select them all → `•••` → **Move to** → **Documents**.
3. Notion keeps the values of the properties whose name and type also exist in Documents. The others (Kind, Brain Status, Old ask) stay on each moved page as hidden leftover properties outside the Documents schema: harmless, and the brain never reads or writes them. At the next publish the brain sends every property of a moved report once (Name, Origin, Project, Area, Asked in, Brain ID), but never its body unless a refresh is due. A report published before 0.8.0 has no saved copy of its Notion text, so its text waits for you to choose Notion's or Git's (the sync asks); **only the text waits**, and its properties still go out, unless the page is ticked Accepted (then nothing is written to it until the text is settled).
4. Remove the filter.

**A row Notion won't move** (rare: a locked page, or no Move to): leave it, and tell the agent its Brain ID. It stays a report the brain knows; the next publish fails on that page and names it, and you move it later.

## 4 · Views (Notion AI, on each page in turn)

> - Projects template (Projects → New ▾ → the default template): change the linked view under the heading "Reports" to show **Documents** where Project is this page and Origin is Report, sorted Created time descending, showing Name, Refresh asked, What to fix, with the database title hidden. Under "What do we know?", add to the "Documents" view the filter Origin is not Report.
> - Areas template: the same, with "Area is this page".
> - Knowledge, in its Documents tab: add to "What did we keep?" the filter Origin is not Report, and add a view "Which reports do I have?" of Documents, List: Origin is Report; sort Last edited time descending; show Name, Project, Area, Refresh asked, What to fix.
>
> Don't change anything else.

Project and area pages you created before keep their old "Reports" view, which now shows nothing. On each one you use, paste the first bullet above on that page instead of the template (Notion AI changes the page you are on), or delete its "Reports" heading and view.

## 5 · Buttons and Brain Assistant (by hand)

The API can't create or edit buttons ([../views-guide.md](../views-guide.md) §9).
1. **Documents → Update** (Reports module): a Button property named "Update", label "Refresh report", action **Send message to** Brain Assistant, with the Refresh report message of [../views-guide.md](../views-guide.md) §9 (it now says "on this report").
2. **Documents → Accept:** change its label from "Accept write-up" to **Accept**. It now accepts a refreshed report too.
3. **Brain Assistant → Skills → Refresh report:** replace the skill's text with the one in [../brain-assistant.md](../brain-assistant.md) (it now looks for a Documents page with Origin Report and ends with "click Accept").
4. **Inbox:** the Update and Accept buttons are no longer used. Delete them (step 7), or hide them from the layout now.

## 6 · Page layouts and descriptions

- **By hand,** Documents page layout: pin Write, Update, Accept, Lifecycle, Project, Area, Sources; put Accepted, Accepted at, Refresh asked, What to fix, Asked in and Origin in the property group; collapse Brain ID, Last Synced, Created time and Last edited time.
- **By hand,** Inbox page layout: pin Keep, Tidy, Brain Status, Project, Area.
- **Agent:** the descriptions of Accepted and Accepted at on Documents become "Owner: you, through the Accept button. The brain clears it once it has taken the accepted text in." ([../prompts/05-ownership.md](../prompts/05-ownership.md)).

## 7 · Clean up the Inbox (by hand, when you're ready)

After the Verify list passes, these Inbox properties are unused and you may delete them: **Old ask**, **Old report**, **Refresh asked**, **What to fix**, **Accepted**, **Accepted at**, and the **Update** and **Accept** buttons. The Kind option **Report** can go once no row uses it. The brain never reads or writes any of them again.

## What this migration doesn't do

- **No brain edit by hand.** A report stays the same file in Git (`reports/…`, its `vw-` id); only its page moved. `brain upgrade` makes the one `brain.json` change (Documents on when Reports is on).
- **No new report.** A report you never published stays unpublished until the next publish creates it in Documents.

## Verify
- [ ] `brain modules` shows `documents` on, and `reports` on if you use it, with nothing missing.
- [ ] Documents has **Origin** (Kept, Learned, Report, Promoted, Workflow), **Refresh asked**, **What to fix**, **Asked in**, **Accepted** and **Accepted at**; the Inbox has **Report** (a relation to Documents) and the Kind option **Catch-up**.
- [ ] The Inbox filter **Kind is Report and Brain ID is not empty** shows no row; the former unattended summaries have Kind Catch-up.
- [ ] After the next publish, each moved report shows Origin Report, its Project and Area, and Asked in linking its Ask rows; each Ask row's Report links back; its body is unchanged.
- [ ] "Reports" on a project page, and "Which reports do I have?" on Knowledge, list the moved reports; "What did we keep?" and the "Documents" views under "What do we know?" don't.
- [ ] Ticking **Refresh asked** on a report: the next catch-up rewrites it on the same page and clears the box.
- [ ] **Refresh report** on a report adds the "Proposed refresh · based on Notion" toggle; after you replace the text, delete the toggle and click **Accept**, the next catch-up shows the change and imports it.
- [ ] `brain-connect-notion`, run again, reports no difference for Documents and the Inbox.
