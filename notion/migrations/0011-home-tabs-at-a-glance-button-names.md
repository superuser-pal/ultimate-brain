# 0011 · Home's Areas and Inbox tabs, At a glance, button names

**Design change:** CC-68 (#143, #144, #145, #146; docs/notion-space-design.md §3.1, §3.15, §5). **Applies to:** spaces that ran migration 0010 (release 0.6.0). A space migrated from an earlier release runs 0010, then this one.

Nothing here changes what the brain reads or writes: it reads the boxes the buttons tick, never the buttons, and At a glance is Notion-only. Run it whenever you like.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **Notion AI:** a prompt you paste on the page named; the API can't create or move linked views;
- **by hand:** you, in Notion, for buttons and page layouts (the API can't edit them).

## 1 · Areas: At a glance (#145)

| Change | Who |
|---|---|
| Add the formula **At a glance** to Areas, with the expression in [Prompt 4](../prompts/04-formula-rollup.md) (with Tasks, or without it) | agent; if the API refuses the expression, paste it by hand (property → Edit property → Formula) |
| Description: At a glance "Owner: you." (derived, Notion-only) | agent |

## 2 · Home: the Areas and Inbox tabs (#143, #146)

**Notion AI**, on **Home**:
> - If "How are my areas?" (and "What's due across areas?") sit at the top of the page, above the two columns, move them into a new first tab "Areas" of the "What's on today?" tabs block, "How are my areas?" first. If that tab already exists, leave it where it is.
> - In "How are my areas?", show Name and At a glance only; hide To review, Meetings to review and Due.
> - Add a last tab "Inbox" to the "What's on today?" tabs block, with a linked view of "Inbox", List, named "What's in my inbox?": filter Brain Status is New or Ready; sort Created ascending; show Name, Kind, Brain Status. Hide its database title and its Brain ID, Last Synced, Created time and Last edited time.
>
> Don't change anything else.

**Notion AI**, on **Knowledge**:
> In the tab "Inbox", delete the view "What's in my inbox?" (it now lives on Home); keep "What came in?". If Home already has its own "What's in my inbox?" view, delete only this one on Knowledge. Don't change anything else.

## 3 · Button names (#144)

**By hand, optional.** The brain never reads a button, so the names below only make the page layout read well; a space that named its buttons otherwise (for example Document and Request) can keep them. For each, open the database as a full page → `•••` → Properties → the button → rename it, and keep or set its label:

| Button property | Label | Database |
|---|---|---|
| **Keep** (was Keep as document) | Keep as document | Inbox |
| **Update** (was Refresh) | Refresh report | Inbox |
| **Promote** (was Promote to document) | Promote to document | Decisions, Concepts |

Avoid a name equal to, or one letter from, another property: Report, Documents, Refresh asked.

## 4 · Page layouts (#144)

**By hand:** open any row of the database as a full page → `•••` → **Customize layout**. The full table is [views-guide.md](../views-guide.md) §9.

| Database | Heading, in order | Move to the top of the property group |
|---|---|---|
| Inbox | Keep, Update, Brain Status, Project, Area | Document asked, Refresh asked, Only keep |
| Decisions | Promote, Lifecycle | Promote asked |
| Concepts | Promote, Lifecycle | Promote asked |
| Areas | Type, At a glance | To review, Meetings to review, Due |

## Verify
- [ ] Areas has At a glance: an area with one pending Review row shows "1 to review"; an area with nothing waiting shows "all clear".
- [ ] Nothing sits above Home's two columns; "What's on today?" has the tabs Areas (first), then Tasks (Tasks module), Meetings, Projects, and Inbox (last).
- [ ] The Areas tab shows "How are my areas?", one line per area with Name and At a glance, and (Tasks) "What's due across areas?" below it.
- [ ] The Inbox tab shows "What's in my inbox?" with Name, Kind and Brain Status only; Knowledge's Inbox tab has only "What came in?".
- [ ] Each button shows one name on the left and a different label on the button; clicking Keep as document still ticks Document asked and sets Ready, Refresh report still ticks Refresh asked, Promote to document still ticks Promote asked.
- [ ] The page layouts of Inbox, Decisions, Concepts and Areas match section 4.
