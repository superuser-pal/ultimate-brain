# Documents

Keep a document, or part of one, as a page you can read, linked to its source, project and area; promote a decision or concept to a page you write in (decisions 0048, 0049; docs/notion-space-design.md §3.14). Off by default.

## Turning it on

### 1 · The database

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create one full-page database "Documents" with: Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time), Last edited time (last edited time). Don't change anything else.

### 2 · Properties and relations

| Change | Who |
|---|---|
| Inbox: add **Document asked** (checkbox) and **Only keep** (text) | agent |
| Decisions and Concepts (with Knowledge on): add **Promote asked** (checkbox) | agent |
| Two-way relations: Inbox "Documents" ↔ Documents "Sources"; Documents "Project" ↔ Projects "Documents"; Documents "Area" ↔ Areas "Documents"; with Knowledge on, Documents "From decision" ↔ Decisions "Documents" and Documents "From concept" ↔ Concepts "Documents" | agent |
| Descriptions per [Prompt 5](../prompts/05-ownership.md): Document asked "Owner: you, through the Keep as document button. Waiting for the brain; it clears it."; Only keep "Owner: you. Only this part is kept as a Document ('the requirements table'); empty = the whole input."; Promote asked "Owner: you, through the Promote to document button. Waiting for the brain; it clears it."; on Documents, Brain ID, Last Synced, Created time and Last edited time "Owner: system. Do not edit.", Lifecycle "Owner: you.", the rest "Owner: brain." | agent |
| Record the database id: `brain config set notion.databases.documents '"<id>"'` | agent |

### 3 · Views

**Notion AI**, on each page in turn:
> - Projects template (Projects → New ▾ → the default template): under the heading "What do we know?" (create it before the toggle "My notes" if it isn't there), add a view "Documents": Documents where Project is this page, sorted Last edited time descending, showing Name, Summary.
> - Areas template: the same, with "Area is this page", also showing Project.
> - Knowledge: add a tab "Documents" with a linked view of "Documents", List, named "What did we keep?": Lifecycle is not Archived; sort Last edited time descending; show Name, Project, Summary. Put it after the Concepts tab, or after Decisions if there is none.
> - Archive: add a tab "Documents" with a linked view of "Documents", List, named "Which documents are archived?": Lifecycle is Archived; sort Name; show Name, Project.
> - Knowledge, tab Inbox, view "What's in my inbox?": also show Only keep and Document asked.
>
> Hide each view's database title. Don't change anything else.

### 4 · Buttons and page layouts

**By hand** (the API can't create buttons or edit page layouts):
1. **Inbox → Keep as document:** open Inbox as a full page → `•••` → Properties → **New property** → **Button**, named "Keep as document". Action **Edit property** on **This page**: Document asked → checked; Brain Status → Ready.
2. **Decisions → Promote to document** (with Knowledge on): a Button property "Promote to document", action **Edit property** on **This page**: Promote asked → checked. The same on **Concepts**.
3. **Page layouts** (open any row → **Customize layout**): Inbox pins Keep as document, Document asked and Only keep next to Brain Status, Project and Area; Decisions and Concepts pin Promote to document and Promote asked next to Lifecycle; Documents pins Lifecycle, Project, Area, Sources, and collapses Brain ID, Last Synced, Created time and Last edited time ([views-guide.md](../views-guide.md) §9).

### Verify
- [ ] Brain Data holds a Documents database with its relations; `brain modules` shows `documents` on with nothing missing.
- [ ] Clicking **Keep as document** on an Inbox row ticks Document asked and sets Brain Status to Ready.
- [ ] (Knowledge) Clicking **Promote to document** on a decision ticks Promote asked.
- [ ] Knowledge has a Documents tab; a new project has a Documents view under "What do we know?".
- [ ] After the next catch-up, the row's Document asked is cleared and its Documents relation lists the new page.

## Turning it off

The brain stops writing Documents and ignores Document asked and Promote asked (a ticked box stays ticked). You may hide: the Documents tab of Knowledge and Archive, the Documents views under "What do we know?", and the buttons and boxes in the Inbox, Decisions and Concepts layouts.
