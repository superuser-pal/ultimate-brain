# 0008 · Your call and What to fix, the Ready gate, Keep, References, living reports

**Design change:** CC-47 (decision 0045; docs/notion-space-design.md §3.5, §3.10, §3.11, §3.14, §4). **Applies to:** spaces built before release 0.5.0.

Run it in one session, right after installing 0.5.0 and running `brain upgrade`, and **before the next catch-up or publish**: from 0.5.0 the brain writes Review rows with the new property names. The **agent** steps are done through the API by the `brain-notion-change` skill, each with your yes. **Notion AI** steps create a database and add linked views, which the API can't do. **By hand** steps say why.

Renaming a property or a select option keeps its values, its id and every view that uses it, so nothing you decided is lost.

## 1 · References: a new database (0045)

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create one database "References" with: Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time). Don't change anything else.

Then:

| Change | Who |
|---|---|
| Two-way relations: References "Project" ↔ Projects "References"; References "Area" ↔ Areas "References"; Inbox "References" ↔ References "Sources" | agent |
| Ownership descriptions per [Prompt 5](../prompts/05-ownership.md): Brain ID and Last Synced "Owner: system. Do not edit."; Lifecycle "Owner: you."; the rest "Owner: brain." | agent |
| Record the database id: `brain config set notion.databases.references '"<id>"'` | agent |

## 2 · Review: Your call and What to fix (0045)

| Change | Who |
|---|---|
| Rename Review properties: Target → **About**, Target Page → **About Page**, Before → **Now**, After → **Proposed**, Decision → **Your call**, Note → **What to fix** | agent |
| Rename the option **Edit** of Your call → **Fix** | by hand (property → Edit property → rename the option): renaming through the API can recreate the option with a new id, which loses the rows that hold it |
| Add the option **Update Body** to Kind, after Add To Note | by hand, as above: an option added through the API can share an id with an existing one (notion/migrations/README.md) |
| Description of What to fix: "Owner: you. With Fix, what's wrong in your words; with Approve, what to leave out ('all except b, d')." Your call keeps its description (0.4.1) | agent |
| On the **Review** page, replace the gray line's last sentence "Your corrections go in Note. Target says what changes." with "To correct something, pick Fix in Your call and say what's wrong in What to fix." | agent |

The views keep working: Notion follows a renamed property. "What needs my decision?" now shows Now, Proposed, Your call and What to fix.

## 3 · Inbox: Ready, Keep, Refresh, What to fix (0045)

| Change | Who |
|---|---|
| Add the option **Ready** to Brain Status, after New | by hand, as above |
| Add **Keep** (text), **Refresh** (checkbox) and **What to fix** (text) | agent |
| Add **Refresh report**, a one-way relation from Inbox to Inbox | agent |
| Descriptions: Keep "Owner: you. What to keep from it ('just the requirements'); empty: the brain asks."; Refresh "Owner: you. On a Report row: tick it to have the report rewritten; the brain clears it."; Refresh report "Owner: you. On an Ask row: the report this question refreshes; empty = a new report."; What to fix "Owner: you. On a Report row: what the report gets wrong; the brain clears it."; Brain Status "Owner: you, except Processed. Set Ready when a row can be taken in; a capture is taken in after a day anyway." | agent |

## 4 · Templates: Reports, References, the meeting line (0045)

**Notion AI**, on each template in turn (open the database → New ▾ → the default template):
> - Projects template: in the linked view under "What do we know?", add a third view "References" (References where Project is this page, sorted Last edited time descending, showing Name, Summary). Then, right after it and before the toggle "My notes", add an H3 heading "Reports" followed by a linked view of Inbox where Project is this page and Kind is Report, sorted Last edited time descending, showing Name, Refresh, What to fix, with the database title hidden.
> - Areas template: the same, with "Area is this page", and the References view also showing Project.
> - Meetings template: inside the gray callout "Before marking Reviewed", after its last to-do, add a gray line: "Check the minutes, fix them, then set Brain Status to Reviewed. Fixed them after the brain took them in? Set Reviewed again: it reads only what changed."
>
> Don't change anything else.

Existing project, area and meeting pages keep their body. Add the same to the pages you use most, or leave them: Knowledge shows References and the Inbox shows Report rows.

## 5 · Knowledge: a References tab (0045)

**Notion AI**, on **Knowledge**: item 3b of [Prompt 7f](../prompts/07f-knowledge.md), and the new filter of "What's in my inbox?" (Brain Status is New or Ready; show Name, Kind, Brain Status, Keep, Project, Created), with:
> Add or change only these. Don't change anything else.

## 6 · Brain Assistant and How it works

| Change | Who |
|---|---|
| In the agent's **Instructions**, the scope line names 14 databases, References included; replace it with the one in [brain-assistant.md](../brain-assistant.md) | by hand: the API can't reach a Custom Agent's Instructions |
| In the database **Brain Assistant Skills**, replace the body of **Review queue** with the one in [brain-assistant.md](../brain-assistant.md) (About, Now → Proposed, lettered items, Fix) | agent |
| In **Tools and access**, nothing changes: References is inside Brain Data | — |
| Update the **How it works** page from the user guide (Review, Fix, Ready, Keep, reports) | agent |

## 7 · First catch-up

Run "catch up". Expect:
- the Review rows it writes to use About, Now, Proposed, and lettered items with fact changes first (⚠);
- Inbox rows taken in only when Ready, or captures New for a day or more; a document with an empty Keep is asked about in the one batch of questions;
- nothing to clean up from earlier versions: rows decided before 0.5.0 keep their values under the new names.

## Verify
- [ ] Brain Data holds a References database with its three relations; `brain status` shows `references` configured.
- [ ] Review shows About, About Page, Now, Proposed, Your call (Approve, Reject, Fix) and What to fix; every option has its own id (run the check).
- [ ] Inbox → Brain Status lists Ready; Inbox has Keep, Refresh, Refresh report and What to fix.
- [ ] A new project and a new area have a References view under "What do we know?" and a "Reports" heading; a new meeting's callout ends with the "Check the minutes, fix them" line.
- [ ] Knowledge has a References tab.
- [ ] After the first catch-up: a Review Notes row lists fact changes first; set Fix with "a: …" on one, run "catch up", and the report says what it changed.
