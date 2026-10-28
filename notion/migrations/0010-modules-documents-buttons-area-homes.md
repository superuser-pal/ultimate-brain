# 0010 · Documents, the simpler Inbox, buttons and page layouts, area homes

**Design change:** CC-56, CC-59 (decisions 0048, 0049, 0050; docs/notion-space-design.md §1, §3.1, §3.8–§3.15, §4, §5). **Applies to:** spaces built before release 0.6.0.

Run it in one session, right after installing 0.6.0 and running `brain upgrade`, and **before the next catch-up or publish**: from 0.6.0 the brain writes Refresh asked, the Documents relation, Brain Status Done and Kind File, and reads Document asked and Promote asked. `brain upgrade` has already renamed `references` to `documents` in `brain.json` and written the `modules` block with **every module on**: this space keeps all of them (decision 0048). Turn some off afterwards if you like (section 10).

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **Notion AI:** a prompt you paste on the page named; the API can't create linked views or change templates;
- **by hand:** you, in Notion, for what neither can do safely: renaming or deleting a select option (the API can recreate it with a new id, which loses the rows that hold it, notion/migrations/README.md), buttons (the API can't create or edit them), page layouts (the API can't edit them), and Brain Assistant (outside the integration's reach, #137).

Renaming a database, a property or an option keeps its id, its values and every view that uses it.

**No default Tasks database** (you skipped it, or map your own)? Leave out the Due formula, "What's due across areas?" and the area home's Today tab, or build them over your own tasks database ([modules/tasks.md](../modules/tasks.md)).

## 1 · References becomes Documents (0049)

| Change | Who |
|---|---|
| Rename the database **References** → **Documents** | agent |
| Rename the relation properties named "References" → **"Documents"** on Inbox, Projects and Areas (by property id, never by deleting and adding) | agent |
| Add two-way relations: Documents "From decision" ↔ Decisions "Documents"; Documents "From concept" ↔ Concepts "Documents" | agent |
| Descriptions: From decision, From concept, and Documents on Decisions and Concepts "Owner: brain." | agent |
| Check: `brain status` lists `documents` among `notion.configured` (the id is the References one, kept by `brain upgrade`) | agent |

## 2 · Inbox: New, Ready, Done; Only keep; Refresh asked (0048, 0049)

| Change | Who |
|---|---|
| Rename the property **Keep** → **Only keep** | agent |
| Rename the property **Refresh** → **Refresh asked** (the Refresh button of section 5 ticks it) | agent |
| Add **Document asked** (checkbox) | agent |
| Rename the Kind option **Document** → **File** | by hand (property → Edit property → rename the option) |
| Rename the Brain Status option **Processed** → **Done** | by hand, as above |
| Move every row with Brain Status **Skipped** to **Done**; when its Summary is empty, set it to "Skipped before 0.6.0". Change nothing else on the row | agent |
| Delete the Brain Status option **Skipped**, once no row holds it (the agent says when) | by hand, as above |
| Descriptions per [Prompt 5](../prompts/05-ownership.md) rule 1: Kind "Owner: system, written only when empty, so a Kind you choose stands. Ask is yours."; Brain Status "Owner: you. Set Ready to have the brain take the row in; it sets Done when it has, or when it skipped the row (Summary says why)."; Document asked "Owner: you, through the Keep as document button. Waiting for the brain; it clears it."; Only keep "Owner: you. Only this part is kept as a Document ('the requirements table'); empty = the whole input."; Refresh asked "Owner: you, through the Refresh button on a Report row. Waiting for the brain; it clears it." | agent |
| **Full text** and **Refresh report** are retired: leave them in place, unused. Delete them yourself once the first catch-up has run, or keep them: the brain no longer reads or writes them | by hand, optional |

Rows keep their values: a row that was Processed is now Done, and a Kind Document is now File. A Full text toggle already on a row stays.

## 3 · Decisions and Concepts: Promote asked (0049)

| Change | Who |
|---|---|
| Add **Promote asked** (checkbox) to Decisions and to Concepts | agent |
| Description: "Owner: you, through the Promote to document button. Waiting for the brain; it clears it." | agent |

## 4 · Review: Type and Area; the Areas counts (0048, 0050)

| Change | Who |
|---|---|
| Add a two-way relation Review "Area" ↔ Areas "Review" | agent |
| Limit Review's "Area" to one page | by hand (relation → Edit property → Limit: 1 page): the API can't set it |
| Add the formula **Type** to Review, the Areas formulas **To review**, **Meetings to review** and **Due**, with the expressions in [Prompt 4](../prompts/04-formula-rollup.md) | agent; if the API refuses an expression, paste it by hand (property → Edit property → Formula) |
| Descriptions: Type, To review, Meetings to review, Due "Owner: you." (derived, Notion-only); Area on Review and Review on Areas "Owner: brain." | agent |

Review rows written before 0.6.0 have no Area: they show only in the global queue. Rows from the next catch-up on carry the area of their meeting or input.

## 5 · Buttons (0048)

**By hand** (the API can't create or edit buttons). For each, open the database as a full page → `•••` → Properties → **New property** → **Button**, action **Edit property** on **This page**:

| Button | Database | Action |
|---|---|---|
| **Keep as document** | Inbox | Document asked → checked; Brain Status → Ready |
| **Refresh** | Inbox | Refresh asked → checked |
| **Promote to document** | Decisions | Promote asked → checked |
| **Promote to document** | Concepts | Promote asked → checked |

Then on **Home**, edit the **Quick capture** button (hover → the gear): set Brain Status = **Ready** instead of New. The brain takes in only Ready rows now, and a row you create by hand starts New (0048).

## 6 · Views: Home, Review, Knowledge, Archive (0048–0050)

**Notion AI**, on each page in turn:
> - Home: at the top, across the page, add a linked view of "Areas", List, named "How are my areas?": filter Archived is unchecked; sort Name; show Name, To review, Meetings to review, Due. Below it, a linked view of "Tasks", List, at most 5 rows, named "What's due across areas?": filter Status is not Done and Due is on or before today; sort Due ascending; show Name, Area, Due. In "What's waiting for you?", group by Type instead of Kind, with group counts shown.
> - Review: in "What needs my decision?", "What did I approve recently?" and "What did I reject?", show Type in place of Kind, and hide Kind.
> - Knowledge: rename the tab "References" to "Documents". In "What's in my inbox?", show Name, Kind, Brain Status, Project, Created, Only keep, Document asked.
> - Archive: after the Concepts tab, add a tab "Documents" with a linked view of "Documents", List, named "Which documents are archived?": filter Lifecycle is Archived; sort Name; show Name, Project.
>
> Hide each new view's database title and its Brain ID, Last Synced, Created time and Last edited time. Don't change anything else.

Views filtered on Processed now show Done, and views showing Keep now show Only keep: nothing to change there.

## 7 · Templates: the area home, Documents (0049, 0050)

**Notion AI**, on each template in turn (open the database → New ▾ → the default template):
> - Areas template: right after the toggle heading "Brief", add an H3 heading "What needs me here?" followed by a tabs block with four tabs, each holding one linked view with the database title hidden: "Today" (Tasks where Area is this page, Status is not Done and Due is on or before today, sorted Due ascending, showing Name, Project, Due); "Meetings" (Meetings where Area is this page, Brain Status is Not Reviewed and Date is on or before today, sorted Date descending, showing Name, Date, Project); "Review waiting" (Review where Area is this page and State is Pending, grouped by Type, sorted Created time ascending, showing Name, Your call, What to fix); "Inbox" (Inbox where Area is this page and Brain Status is New or Ready, sorted Created ascending, showing Name, Kind, Brain Status). Under "What do we know?", rename the view "References" to "Documents".
> - Projects template: under "What do we know?", rename the view "References" to "Documents".
>
> Don't change anything else.

**Your existing area pages** keep their body. On the areas you use, add the same "What needs me here?" block: open the area, and paste the Areas line above into Notion AI with "on this page" in place of "Areas template". The Home line of section 6 already counts every area.

## 8 · Page layouts (0048)

**By hand** (the API can't edit page layouts): open any row of the database as a full page → `•••` → **Customize layout**. Pin a property by dragging it into the heading; hide one by moving it to Hidden. The full table is [views-guide.md](../views-guide.md) §9.

| Database | Pin in the heading, in order | Move to the property group | Hide |
|---|---|---|---|
| Inbox | Keep as document, Document asked, Refresh, Refresh asked, Brain Status, Project, Area, Only keep | Kind (out of the heading), What to fix, the Documents relation | Brain ID, Last Synced, Created, Full text, Refresh report |
| Review | Your call, What to fix, About Page | Type, Area | Kind, State, Brain ID, Created time, Last edited time |
| Decisions | Promote to document, Promote asked, Lifecycle | Assessment, Date, Project (out of the heading), Documents | Brain ID, Last Synced |
| Concepts | Promote to document, Promote asked, Lifecycle | Project (out of the heading), Documents | Brain ID, Last Synced, Created time |
| Documents | Lifecycle, Project, Area, Sources | From decision, From concept, Summary | Brain ID, Last Synced, Created time, Last edited time |
| Areas | Type, To review, Due, Meetings to review | Lifecycle (out of the heading), Documents, Review | Brain ID, Last Synced |

Goals, Key Results, Projects, Meetings, People, Orgs, Questions and Tasks keep their layouts, except that Projects shows Documents where it showed References (the rename did it).

## 9 · Brain Assistant and How it works

| Change | Who |
|---|---|
| In the agent's **Instructions**, replace the Scope line, the rule after "Answer in the chat", and the "Never touch" rule with the ones in [brain-assistant.md](../brain-assistant.md), and add its "Never tick" rule | by hand: the API can't reach a Custom Agent's Instructions |
| In the database **Brain Assistant Skills**, replace the bodies of **Today**, **Review queue**, **Tidy capture** and **Clean email** with the ones in [brain-assistant.md](../brain-assistant.md) (Review by Type; captures New or Ready) | by hand: Brain Assistant Skills is outside Brain Data, so the integration can't reach it (#137) |
| Update the **How it works** page from the user guide, [skills/brain-howto/references/guide.md](../../skills/brain-howto/references/guide.md) (modules, the Inbox and its buttons, three kinds of Review row, Documents) | agent, when How it works is shared with the integration (brain-connect-notion, "Integration token"); otherwise by hand: How it works sits on System, outside Brain Data (#137) |

## 10 · Modules (0048)

Nothing to do: this space keeps every module on. To turn one off later, tell your agent ("turn planning off"): the brain stops reading and writing its databases, and nothing is deleted. Each module's views to hide are in [modules/](../modules/).

## 11 · First catch-up

Run "catch up". Expect:
- only Ready Inbox rows taken in; a capture still New waits (the 1-day rule is gone), and each row taken in becomes Done, keeping the Kind you set;
- Review rows named "From …", "Conflict: …" or "Answer: …", with an Area when their input has one;
- a click on **Keep as document** gives a Document linked from the row, and the box cleared; Refresh on a Report row rewrites it and clears Refresh asked.

## Verify
- [ ] Brain Data holds **Documents** (no References), with Sources, Project, Area, From decision and From concept; Inbox, Projects and Areas have a "Documents" relation; `brain status` shows `documents` configured.
- [ ] Inbox → Brain Status lists New, Ready, Done (no Processed, no Skipped); Kind lists File (no Document); Inbox has Only keep, Document asked and Refresh asked, and no property named Keep or Refresh.
- [ ] Decisions and Concepts have Promote asked.
- [ ] Review has Type and Area (limited to one page); Areas has Review, To review, Meetings to review and Due; every select option has its own id (run the check).
- [ ] Clicking **Keep as document** on an Inbox row ticks Document asked and sets Ready; **Refresh** ticks Refresh asked; **Promote to document** ticks Promote asked on a decision and on a concept. Untick them again.
- [ ] **Quick capture** creates a row with Brain Status Ready.
- [ ] Home starts with "How are my areas?" and "What's due across areas?"; "What's waiting for you?" groups by Type.
- [ ] Review's views show Type, not Kind; Knowledge has a Documents tab; Archive has a Documents tab.
- [ ] A new area has "What needs me here?" with Today, Meetings, Review waiting and Inbox tabs; new projects and areas show a "Documents" view under "What do we know?".
- [ ] The page layouts of Inbox, Review, Decisions, Concepts, Documents and Areas match section 8.
- [ ] Brain Assistant's `/Review queue` groups rows by Type; `/Tidy capture` works on a Ready capture; How it works describes the Inbox's New, Ready and Done.
- [ ] After the first catch-up: a row you took in is Done with its Kind unchanged; a Review row from a project's meeting shows that project's area and appears in the area's "Review waiting" tab.
