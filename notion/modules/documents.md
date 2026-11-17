# Documents

Keep a document, or part of one, as a page you can read, linked to its source, project and area; keep a task's page the same way (decision 0100); read what the brain learned (ideas, methods, definitions: learned Documents, concepts before 0.9.1); promote a decision to a page you write in (decisions 0048, 0049, 0071; docs/notion-space-design.md §3.14). Off by default.

## Turning it on

### 1 · The database

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create one full-page database "Documents" with: Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Origin (select: Kept, Learned, Report, Promoted, Workflow), Brain ID (text), Last Synced (date), Created time (created time), Last edited time (last edited time). Don't change anything else.

### 2 · Properties and relations

| Change | Who |
|---|---|
| Inbox: add **Document asked** (checkbox) and **Only keep** (text) | agent |
| Documents: add **Accepted** (checkbox) and **Accepted at** (date, with time) (0054) | agent |
| Two-way relations: Inbox "Documents" ↔ Documents "Sources"; Documents "Project" ↔ Projects "Documents"; Documents "Area" ↔ Areas "Documents" | agent |
| The **Domain** rollup on Documents, after the Area relation exists: relation Area, property Domain, Show original, described "Owner: Notion. Derived from the Area's Domain; you never edit it." (decision 0105; every space has the Domains database). Read it back as [migration 0028](../migrations/0028-first-things-first-and-domains.md) B1 says | agent |
| With the Tasks module on: a one-way relation Documents "Task" → Tasks (no property on Tasks), so a Document kept from a task links back to it (decision 0100). Tasks already has Document asked and the Keep as document button ([tasks.md](tasks.md)) | agent |
| Descriptions per [Prompt 5](../prompts/05-ownership.md): Document asked "Owner: you, through the Keep as document button. Waiting for the brain; it clears it."; Only keep "Owner: you. Only this part goes in, as a changed version you check first ('the requirements table'); empty = the whole input."; Task "Owner: brain. On a Document kept from a task: that task. Written by the brain only."; Accepted and Accepted at "Owner: you, through the Accept button. The brain clears them once it has taken the accepted text in."; on Documents, Brain ID, Last Synced, Created time and Last edited time "Owner: system. Do not edit.", Lifecycle "Owner: you.", the rest "Owner: brain." | agent |
| Record the database id: `brain config set notion.databases.documents '"<id>"'` | agent |

### 3 · Views

**Notion AI**, on each page in turn:
> - Projects template (Projects → New ▾ → the default template): under the heading "What do we know?" (create it before the toggle "My notes" if it isn't there), add a view "Documents": Documents where Project is this page and Origin is not Report, sorted Last edited time descending, showing Name, Summary.
> - Areas template: the same, with "Area is this page", also showing Project.
> - Knowledge: add a tab "Documents" with a linked view of "Documents", List, named "What did we keep?": Lifecycle is not Archived and Origin is not Report; sort Last edited time descending; show Name, Project, Summary. Put it first. In the same tab, a second view "What did we learn?" (0071): List, Origin is Learned and Lifecycle is not Archived; sort Created time descending; show Name, Project, Summary.
> - Archive: add a tab "Documents" with a linked view of "Documents", List, named "Which documents are archived?": Lifecycle is Archived; sort Name; show Name, Project.
>
> Hide each view's database title. Don't change anything else.

### 4 · Buttons and page layouts

**By hand** (the API can't create buttons or edit page layouts):
1. **Inbox → Keep:** open Inbox as a full page → `•••` → Properties → **New property** → **Button**, named "Keep", with the label "Keep as document". Action **Edit property** on **This page**: Document asked → checked; Brain Status → Ready.
2. **Documents → Write and Accept** (0054): a Button property named "Write" with the label "Write up", action **Send message to** Brain Assistant, with the Write up message in [views-guide.md](../views-guide.md) §9; and a Button property named "Accept" with the label "Accept" (0071; "Accept write-up" before 0.9.1), action **Edit property** on **This page**: Accepted → checked, Accepted at → Now. Brain Assistant needs its Write up skill and edit access to Documents ([brain-assistant.md](../brain-assistant.md)).
3. **Page layouts** (open any row → **Customize layout**): Inbox pins Keep next to Brain Status, Project and Area, and puts Document asked and Only keep at the top of the property group; Documents pins Write, Accept, Lifecycle, Project, Area, Sources and puts Accepted and Accepted at at the top of the property group, and collapses Brain ID, Last Synced, Created time and Last edited time ([views-guide.md](../views-guide.md) §9). With the Domains module on, Documents shows Domain right after Area in the property group.
4. **Domains template** (decision 0105): add the "What do we know?" view of Documents filtered by Domain contains This page, as [views-guide.md](../views-guide.md) §9a says.

### Verify
- [ ] Brain Data holds a Documents database with its relations; `brain modules` shows `documents` on with nothing missing.
- [ ] Clicking **Keep as document** on an Inbox row ticks Document asked and sets Brain Status to Ready.
- [ ] Knowledge has a Documents tab; a new project has a Documents view under "What do we know?".
- [ ] After the next catch-up, the row's Document asked is cleared and its Documents relation lists the new page. With Only keep filled, the brain first writes the kept part to the Inbox as a changed version (Kind Changed) for you to check, and only that part goes in (decision 0098 §4).
- [ ] (Tasks) Documents has Task, and Tasks has no new property for it.
- [ ] Documents has the Domain rollup (Area → Domain, Show original); a Document whose Area has a Domain shows it, and that Domain's page lists it.
- [ ] (Brain Assistant) **Write up** on a promoted Document gives Purpose, Main content, Open questions and Sources and changes no property; a second click keeps your edit and adds a toggle "Proposed revision". **Accept** ticks Accepted and sets Accepted at; after the next catch-up shows the text and you confirm, the Git Document holds the text and the box is cleared.

## Turning it off

The brain stops writing Documents and ignores Document asked (a ticked box stays ticked). You may hide: the Documents tab of Knowledge and Archive, the Documents views under "What do we know?", and the buttons and boxes in the Inbox layout. Learned Documents stay in Git and in the brain's answers, unpublished.
