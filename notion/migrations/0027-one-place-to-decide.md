# 0027 · One place to decide: Review, Decisions and Questions archived, Tasks gain Kind and Keep as document, the Inbox holds changed versions

**Design change:** decisions [0096](../../decisions/0096-one-place-to-decide.md) §6 and §7, [0099](../../decisions/0099-notion-without-decisions-and-questions.md) §4, §8 and §9, [0101](../../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §4, §5 and §7; CC-299 (release 0.16.0; spec/capture-and-review.md §6.2, §7.9; spec/cli.md §5.14.8, §5.14.9; docs/notion-space-design.md §3, §4, §5, §10). Part C: decisions [0098](../../decisions/0098-agree-by-subject-and-check-a-changed-document.md) §4 and [0100](../../decisions/0100-keep-a-task-as-a-document.md), in 0.16.0 by [0102](../../decisions/0102-one-release-for-0-16-0-and-0-17-0.md); CC-311 (spec/capture-and-review.md §12, §13; spec/cli.md §5.35; spec/setup.md §6.2.2; docs/notion-space-design.md §3.11, §3.12, §3.14, §3.15). It is 0.16.0's one Notion migration (CC-331). **Applies to:** every space built or migrated before 0.16.0, the template's copy included. Needs migration 0026. A step already done changes nothing, so running this again is safe.

**What changes:**
- **You decide in Claude Code or Codex, not in Notion** (0096). The Review database goes: this migration first applies the decisions you already made on its rows (a row set to Approve or Reject, an item with its `Decision:` line), then archives the database. A row you hadn't decided needs nothing: its proposal is in your brain, and your next session asks it ("what needs my decision"). Home's "What's waiting for you?", the Review page, Review with me, Your call and the Review queue and Grill review skills go with it.
- **The weekly review is an Inbox row**, Kind **Weekly** (0096 §7). Brain Assistant's Weekly review reads it with you and decides nothing.
- **No Decisions or Questions databases** (0099). Decisions and questions stay notes in your brain, shown in each project's Brief and Decision log and each area's Brief. The Status you set on a question in Notion is read back first, then both databases are archived. A question or risk you follow up becomes a task: Tasks gains **Kind** (Task, Question, Risk) and the tabs **Questions** and **Risks**. After the migration, your session offers once to turn the open questions you follow up into tasks.
- **Only the ingest creates a meeting's Tasks** (0101 §5): the minutes prompt, Check minutes and Brain Assistant say so.
- **An edit to a brain-owned value is asked in your agent session** before it reaches the brain (0101 §4): the property descriptions say so.
- **Brain Assistant and its buttons need Business or Enterprise with Notion credits** (0101 §7): the Start here callout says so.
- **A changed document is checked before it goes in** (0098 §4). When you ask in the session for a document to be changed before it goes in, or click Keep as document with Only keep filled, the brain writes the changed text to a new Inbox row: Kind **Changed**, **Changed from** the original's row, and **What changed** listing what was dropped or altered. Home's Inbox tab lists it until it goes in: read it, edit it if you want, then say *go* in the session or set it Ready. With Only keep, only the kept part goes in; the original is recorded as a source only.
- **Any task can be kept as a document** (0100). Tasks gain **Document asked** and a **Keep as document** button; the next catch-up keeps the task's page as a Document, whose new **Task** relation points back to the task.

**Nothing is deleted.** An archived database keeps every row and page: it moves to **Archive** (on System), out of Brain Data, so Brain Assistant and the brain no longer read it. The relations to it and the views of it are removed; what they showed stays in your brain, in Git. The template's copy is the exception: it has no brain and nothing to keep, so the template deletes its Review database instead of archiving it, and its copy has no Decisions or Questions database.

Run this migration after `brain upgrade` has put 0.16.0 in place, in an attended session (never from a schedule), in the order below: part A, then part B, then part C, then the last steps. Part A's, part B's and part C's brain steps run only in a space connected to a brain; **the template's copy** (no brain) skips them and does the Notion steps alone, except that the template deletes the Review database, with its Example Review row, instead of archiving it; the template's copy has no Decisions or Questions database and none of their Example rows.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the CLI and the API, with your yes;
- **Notion AI:** you paste a prompt;
- **by hand:** you, in Notion. The API can't move a database, create a button or a view, edit a page layout or a Custom Agent, and it can ignore a write while still answering 200, so always read the result back.

## Part A · Review (0096)

### A1 · One last read of the Review rows (agent; a space with a brain)

`brain config get notion.databases.review`. A `USAGE` error saying there is no value means this brain has no Review database to read, or step A3 already ran: go to A4. Otherwise:

1. **Snapshot.** Read every row of the Review database that has a Brain ID, decided or not, and write a snapshot of `review` rows (spec/cli.md §5.14.1, §5.14.8):
   ```json
   { "as_of": "<now, UTC>", "rows": [
     { "database": "review", "page_id": "<id>", "last_edited": "<the page's last_edited_time>",
       "properties": { "Brain ID": "prp-…", "Your call": "Approve", "What to fix": null, "State": "Pending" },
       "review": { "decided": false, "decided_at": null, "accept_all": false, "page_edited_at": "<last_edited_time>", "body_markdown": "<the page as Markdown>" } }
   ] }
   ```
   `Your call` is the select's label or `null`, `What to fix` its text or `null`, `State` as Notion shows it. A space not migrated to 0009 sends `Decision` and `Note` instead. Add the `review` object only on a row whose proposal (`_proposals/<Brain ID>.json`) has `published["@review"]`: Decided, Decided at and Accept all as the page shows them (`false`, `null`, `false` on a format-2 page, whose call is Your call), the page's `last_edited_time`, and its body as Notion's Markdown returns it, escapes included, each block you can't convert written as the line `<!-- unconvertible block -->` (`null` when the body can't be read).
2. **Plan.** `brain sync plan --review-transition --input <snapshot> --json`. Show the user, in a few lines: how many rows are decided (`decisions`, `review_decisions`), how many need a word from them (the conflicts `NOTE_TO_READ`, `FIX_TO_READ`, `FIX_WITHOUT_TEXT`, `REVISION_WITHOUT_TEXT`, and `review_held`, `review_revisions`, `review_row_revisions`), and that the rows still pending need nothing now.
3. **Ask what needs a word** (spec/capture-and-review.md §7.9), in the session, as §7.5 asks any question:
   - a call with text to read (`NOTE_TO_READ`, `FIX_TO_READ`): read it, show the user the decision you read in it, and add it to the plan's `decisions` (with `note`, and `exclude` or `fixes`) only after their yes;
   - a requested revision (an item's `Revision request:` line; Request revision or Fix with What to fix): never redraft it here. Leave it out of the plan: the proposal stays pending, and you ask its question after step A3, with the user's words shown, answered as §7.5 says;
   - a row that can't be read as a call (`FIX_WITHOUT_TEXT`, `REVISION_WITHOUT_TEXT`, an unreadable token, an item in `review_held`): nothing is applied for it; it is asked after step A3 the same way.
4. **Verify, then apply.** Just before applying, read each decided page again, build its snapshot row again and run the plan again. For each `review_decisions` item whose `snapshot_hash` and `proposed_hash` equal the fresh plan's, set `verified` to `{ "snapshot_hash": …, "proposed_hash": … }`; drop the others (the page changed since: ask them in the session). Then `brain sync apply --input <plan> --json`, `brain index`, `brain views`, `brain lint`, and commit in the brain: `notion: Review decisions applied (migration 0027)`. Applying the same plan again is a no-op.
5. **Report** in three lines at most: the decisions applied, by count; the questions left for the session; and that nothing is written back to the Review rows, since the database is archived next.

### A2 · The questions the read left (agent, in the session)

Ask what step A1 left, now or when the user says "what needs my decision": `brain proposal list --waiting --json` lists them, most consequential first, at most five per round (capture-and-review §7.5). "Later" leaves a question waiting; it is never lost.

### A3 · `brain.json` (agent; a space with a brain)

```sh
brain config unset notion.databases.review
brain config unset notion.review_sections
brain config unset notion.review_format
```

Each is safe to run again (a key already gone is success). Then `brain status`, and commit in the brain: `config: Review database retired (migration 0027)`. From here `brain sync plan --review-transition` refuses with `REVIEW_RETIRED`, and `brain upgrade` no longer names this migration for Review.

### A4 · The Areas line and the Review relations (agent)

The Areas formula **At a glance** reads **To review**, which counts Review rows. Change it first, so no formula breaks:
1. Set **At a glance** on Areas to this formula (with Tasks; without Tasks, the second one), then read it back:
   ```text
   lets(m, prop("Meetings to review"), d, prop("Due"),
     parts, [if(m > 0, format(m) + if(m == 1, " meeting", " meetings"), ""), if(d > 0, format(d) + " due", "")].filter(current != ""),
     if(parts.length() == 0, "all clear", parts.join(" · ")))
   ```
   ```text
   lets(m, prop("Meetings to review"),
     if(m > 0, format(m) + if(m == 1, " meeting", " meetings"), "all clear"))
   ```
2. Remove **To review** from Areas.
3. Remove the two relations to Review: **Areas · Review** (with its pair, Review · Area) and **Meetings · Review Items** (with its pair, Review · Source Meeting). Read Areas and Meetings back: neither has a property pointing at Review. The Review rows keep their pages, text and every other property.

### A5 · Inbox · Kind gains Weekly (agent)

Add the option **Weekly** to Inbox · **Kind**, sending every existing option with its id first so none is dropped, then read it back. An option already there changes nothing. The brain's weekly review is then one Inbox row per week, Kind Weekly (spec/weekly-review.md).

### A6 · Archive the Review database and its page (by hand)

1. **Home:** delete the view "What's waiting for you?" in the left column, and the gray paragraph "Start here: approving makes the brain's notes trusted." above it. "Needs you" keeps "Which minutes need review?".
2. **The area template** (Areas → New ▾ → the default template's **⋯** → **Edit**): in "What needs me here?", delete the tab "Review waiting". Pages made from it before keep the tab: delete it there when you open one, or leave it (it shows the archived rows, and nothing reads it).
3. **The Review database:** open **Brain Data**, then the Review database's **⋯** → **Move to**, type `Archive` and pick the Archive page under System on your top page (another page named Archive is not it). Every row and page goes with it; nothing is deleted. Then check that it worked: Brain Data no longer lists it, and the **Archive** page on System lists it (a page in your sidebar's **Trash** is not archived). Never choose **Delete**: it sends the database to Notion's trash. If it is in the trash, open **Trash**, **Restore** it, and move it again.
4. **The Review page** (the Space with the Review tabs): **⋯** → **Move to** → **Archive**.
5. **Navigation:** remove "Review" from the Tier 1 nav synced block on System (Prompt 8), if you use it.

Without a brain (the template's copy), the template deletes the Review database, with its Example Review row, instead of archiving it. On the template's Home, the Review view is named "What needs my decision?" and sits in the right column: that is the view step 1 deletes there.

## Part B · Decisions and Questions (0099)

### B1 · Read back the Status you set on questions (agent; a space with a brain)

`brain config get notion.databases.questions`. No value: this brain has no Questions database to read, or step B5 already ran: go to B2. Otherwise (spec/cli.md §5.14.9):
1. Snapshot every Questions row that has a Brain ID, with `Status` and `Brain ID` only:
   ```json
   { "as_of": "<now, UTC>", "rows": [
     { "database": "questions", "page_id": "<id>", "last_edited": "<last_edited_time>",
       "properties": { "Status": "Answered", "Brain ID": "que-…" } }
   ] }
   ```
2. `brain sync plan --questions-transition --input <snapshot> --json`. Tell the user how many questions were marked Answered and Dropped in Notion; a question marked Answered is recorded as answered, without its answer, which Notion never held.
3. `brain sync apply --input <plan> --json`, then `brain index`, `brain views`, `brain lint`, and commit in the brain: `notion: question Status read back (migration 0027)`. A second run records nothing twice (`ALREADY_CLOSED`).

### B2 · Remove the relations to Decisions and Questions (agent)

Remove these properties, each with its pair on the other side, where your space has them, then read each database back:
- **Projects · Decisions**, **Projects · Questions**;
- **Areas · Decisions**, **Areas · Questions**;
- **Meetings · Decisions**, **Meetings · Questions**;
- **Inbox · Decisions**, **Inbox · Questions** (the Sources of each);
- **Documents · From decision** (with Decisions · Documents). A promoted Document keeps its text, and its `promoted_from` in Git.

On Decisions, remove **Promote asked**. The **Promote to document** button (property **Promote**) is removed by hand in B3: you now ask in the session ("promote the decision on … to a document").

The rows of both databases keep their pages, text, Supersedes and every other property.

### B3 · Views, templates and toggles (by hand)

The API can't edit views or templates ([../views-guide.md](../views-guide.md)).
- **Knowledge:** delete the tabs **Decisions** and **Questions**. In the Inbox tab's "What came in?", the Decisions column went with its relation.
- **Archive:** delete the tabs **Decisions** and **Questions**.
- **The area template:** delete "What have we decided here?", "What's still open here?" and the view "Decisions" under "What do we know?" (the Documents view stays; with no Documents module, delete the heading too).
- **The project template:** delete "What's still open here?" and the view "Decisions" under "What do we know?", as on the area template.
- **The meeting template:** delete the toggles **Decisions** and **Questions**. The minutes still list both.
- **Decisions:** delete the button property **Promote** (Promote to document).
- **Pages made from the templates before** keep these views and toggles, showing the archived rows: delete them when you open a page, or leave them. Nothing reads them. Each project's and area's decisions and open questions are in its **Brief** and **Decision log**.

### B4 · Archive the Decisions and Questions databases (by hand)

On **Brain Data**, for each: **⋯** → **Move to**, type `Archive` and pick the Archive page under System on your top page, as in A6. Every row and page goes with it; nothing is deleted. Then check that it worked: Brain Data no longer lists it, and the **Archive** page on System lists it (a page in your sidebar's **Trash** is not archived). Never choose **Delete**: it sends the database to Notion's trash. If it is in the trash, open **Trash**, **Restore** it, and move it again. Without a brain (the template's copy), there is nothing to do here: the template's copy has no Decisions or Questions database and none of their Example rows.

### B5 · `brain.json` (agent; a space with a brain)

```sh
brain config unset notion.databases.decisions
brain config unset notion.databases.questions
```

Safe to run again. Then `brain status` and commit in the brain: `config: Decisions and Questions retired (migration 0027)`. From here `--questions-transition` refuses with `QUESTIONS_RETIRED`. Kind is set in B6.

### B6 · Tasks · Kind (agent; Tasks module)

**The default Tasks database** (the one on Brain Data): add **Kind**, a select with the options **Task**, **Question**, **Risk** in that order, described `Owner: brain on a task it creates to track a question or risk you said to follow up (Question or Risk); empty or Task otherwise. You may set Task.`, and read it back. A Kind already there with those options changes nothing; with other options, add the missing ones after the existing ones with their ids. Then `brain config set notion.tasks.properties.kind '"Kind"'` and commit in the brain: `config: Tasks Kind (migration 0027)`.

**A tasks database you mapped yourself** (0018): offer Kind once, as the connect step does (spec/setup.md §6.2.1): "Add a Kind property (Task, Question, Risk) to your tasks database, so the questions and risks you track can be filtered? a) yes, add it (recommended) b) no: their titles will start with *Question:* or *Risk:*". On a), add it, read it back and set `notion.tasks.properties.kind` to its name; on b), set nothing. Skip B7 on b).

Without the Tasks module, skip B6 and B7: a question you follow up stays in its project's Brief.

### B7 · The Questions and Risks tabs (Notion AI, or by hand)

Paste on the **Tasks** page (or add the tabs by hand, below):

```text
Use only the databases on Brain Data. On this page ("Tasks"), in the tabs block, add two tabs after "Someday" and before "Done", each a linked view of "Tasks", List layout, with the database title hidden:
1. Tab "Questions", named "Which questions am I following up?": filter Kind is Question and Status is not Done and Status is not Won't Do; sort Due ascending; show Name, Project, Status.
2. Tab "Risks", named "Which risks am I following up?": filter Kind is Risk and Status is not Done and Status is not Won't Do; sort Due ascending; show Name, Project, Status.
Hide Brain ID and Last edited time. Change nothing else.
```

Wait until Notion AI says it is done: it may build a view below the tabs block first and then move it into its tab. Then check each new tab: it is between Someday and Done, its view is named as above, the database title is hidden, and it lists only open tasks of its Kind. In a test run, Notion AI left each view named "View of Tasks" with its title showing: rename it and turn off **Show data source title** in its **⋯** menu. A linked view still below the tabs block after that is a stray: hover it, click **⋮⋮** → **Delete** (that deletes the view only, never the Tasks database).

**By hand** (views-guide §2, rows 6 and 7), for each of Questions and Risks:
1. In the Tasks page's tabs block, click **+** after the last tab and name the tab `Questions` (then `Risks`). Drag it between **Someday** and **Done**.
2. In the new tab, type `/linked`, choose **Linked view of data source** and pick **Tasks** (the one on Brain Data).
3. In the view's **⋯** menu: **Layout** → **List**; turn off **Show data source title**; rename the view `Which questions am I following up?` (`Which risks am I following up?`).
4. **Filter**: Kind is Question (Risk); add Status is not Done; add Status is not Won't Do. **Sort**: Due, ascending.
5. **Properties**: show Name, Project and Status; hide the rest.

On a mapped database, use your own status names.

### B8 · The to-do tidy, once (agent, in the session; Tasks module)

Offer it once, now: "Your open questions no longer have a list of their own in Notion. Shall I go through them, so each one you follow up becomes a task?" On a yes, run the to-do tidy (spec/capture-and-review.md §6.2): each open question that is a to-do is offered as Convert or Drop, and each real question as Track, one at a time. A no leaves every question open, in its project's Brief; the user can ask later ("turn my to-do questions into tasks").

## Part C · The checked row and Keep as document on Tasks (0098 §4, 0100)

### C1 · Inbox: Kind Changed, Changed from and What changed (agent)

Every space has them: a changed version of a document needs no module (spec/capture-and-review.md §12).
1. Add the option **Changed** to Inbox · **Kind**, after Weekly (A5), sending every existing option with its id first so none is dropped, then read it back. An option already there changes nothing.
2. Add **Changed from**, a relation from the Inbox to the Inbox itself, one-way: through the API, `{"relation": {"data_source_id": "<the Inbox's data source id>", "type": "single_property", "single_property": {}}}`. Read the Inbox back: Changed from is a relation to the Inbox's own data source, of type `single_property`, and no other property was added.
3. Add **What changed**, a text property.
4. Set these descriptions, sending each property with its type as L1 says, then read them back:
   - Changed from: `Owner: brain. On a changed version of a document: the row it was changed from. Written once.`
   - What changed: `Owner: brain. On a changed version: what it dropped or altered, one line each. Written once; kept with the row when it goes in.`
   - Only keep: `Owner: you. Only this part goes in, as a changed version you check first ('the requirements table'); empty = the whole input.` (Documents module; Only keep was there since migration 0010).

A property already there with that name and type changes nothing but its description. Nothing is written on any row: the brain fills these only on a row it writes from now on (spec/cli.md §5.35).

### C2 · Tasks: Document asked (agent; Tasks module)

**The default Tasks database** (the one on Brain Data): add **Document asked**, a checkbox, described `Owner: you, through the Keep as document button. Waiting for the brain; it clears it.`, and read it back. A checkbox already there with that name changes nothing. Then, in a space with a brain, `brain config set notion.tasks.properties.document_asked '"Document asked"'` and commit in the brain: `config: Tasks Document asked (migration 0027)`. The connect step expects it on the default database (spec/setup.md §6.2.2).

**A tasks database you mapped yourself** (0018): offer it once, as the connect step does (spec/setup.md §6.2.2): "Add a Keep as document button to your tasks, so the brain keeps a task's page as a document at the next catch-up? a) yes, add it (recommended) b) no: ask me in the session instead". On a), add the checkbox, read it back and set `notion.tasks.properties.document_asked` to its name; a checkbox already named Document asked is mapped without the question. On b), set nothing, and skip C4's button.

Without the Tasks module, skip C2, C3 and C4's button: you ask in the session ("keep the go-live task as a document").

### C3 · Documents: Task (agent; Documents and Tasks modules)

Add **Task** to Documents, a relation to the Tasks database (your own, if you mapped one), one-way: `{"relation": {"data_source_id": "<the tasks data source id>", "type": "single_property", "single_property": {}}}`, described `Owner: brain. On a Document kept from a task: that task. Written by the brain only.` Read Documents back: Task is a relation to the tasks data source, of type `single_property`, and the tasks database has no new property. Without the Documents module, skip it: no task is kept as a document until Documents is on ([../modules/documents.md](../modules/documents.md) adds it then).

### C4 · The Keep as document button on Tasks, and the page layouts (by hand)

The API can't create a button or edit a page layout ([../views-guide.md](../views-guide.md) §9).
1. **Tasks → Keep:** open the Tasks database as a full page → **⋯** → **Properties** → **New property** → **Button**, named `Keep`, with the label `Keep as document`. Action **Edit property** on **This page**: Document asked → checked. Nothing else: unlike the Inbox's button, it sets no status. On a mapped database, tick the checkbox you mapped.
2. **Tasks layout** (open any task → **Customize layout**): pin **Keep** first in the heading, before Status, Due and Kind, and put **Document asked** at the top of the property group.
3. **Inbox layout:** put **Changed from** and **What changed** in the property group, right after Kind.
4. **Documents layout** (Documents and Tasks modules): put **Task** in the property group, after Asked in.

Then check it: on a task, click **Keep as document**. Document asked is ticked, and nothing else on the task changes. If you clicked it only to check, untick Document asked, or the next catch-up keeps that task as a Document. Without a brain (the template's copy), check it on an Example task and untick it: no Example row is left in a state a skill acts on.

## The last steps

### L1 · Property descriptions (agent)

Since 0.16.0 an edit to a brain-owned value in Notion is asked in your agent session before it reaches the brain (0101 §4). In every database on Brain Data, read each property's description and change only these, then read them back:
- `Owner: brain.` → `Owner: brain. An edit here is asked in your agent session before it reaches the brain.`
- `Owner: you when creating, then brain.` → `Owner: you when creating, then brain. A later edit is asked in your agent session before it reaches the brain.`

A description that says anything else stays as it is. Through the API, send each property with its type and the new description: an empty config for a text, title or date property (`{"rich_text": {}, "description": "…"}`), and for a relation its whole relation as you read it (`data_source_id`, `type: "dual_property"` and `dual_property` with the synced name and id), so the pair is kept. A description alone is refused.

### L2 · Brain Assistant (by hand)

Open the agent. [../brain-assistant.md](../brain-assistant.md) has the texts.
1. **Tools and access:** nothing to remove: the archived databases left Brain Data. Edit access stays on Meetings, Inbox and Documents only.
2. **Instructions:** replace them with the block under "Instructions". They no longer name Review, Decisions or Questions; they say that decisions on what the brain proposes are made in the agent session, and never to create Tasks from a meeting. Re-link each *[@…]* with a real @mention.
3. **Skills** database: move the pages **Review queue** and **Grill review** to Notion's trash (they read the archived Review database). Replace the Description and body of **Today**, **Check minutes**, **Prep**, **Weekly review**, **Write up** and **Refresh report** with the new ones. Keep **Use automatically** on. Ten skills are left.
4. **Review with me** was a button on Review rows; it went with the database. No other button changes.

Without a Custom Agent: make the same changes to your personal Instructions and skills.

### L3 · The minutes prompt (by hand)

Use the new prompt of [../minutes-format.md](../minutes-format.md) from now on: it says never to create Tasks from the meeting (the brain's ingest does, once), and that `Track: Waiting On —` also tracks a question or a risk you write it on. Nothing in Notion holds the prompt, so there is nothing to replace. If a notetaker or an automation exports tasks into your brain's Tasks database, turn that export off ([docs/setup.md](../../docs/setup.md)).

### L4 · The Start here callout (by hand, or the agent)

If the top page starts with the **Start here** callout, add this line at its end, a plain paragraph inside the callout:

`Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits.`

Link "Notion credits" to https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents. A space without the callout has nothing to change.

### L5 · How it works (by hand)

Replace the text of **How it works** with `brain-howto/references/guide.md` as it is in the skills release that ships with 0.16.0.

### L6 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0027`. A space without that line has nothing to change.

## What this migration doesn't do

- **No row is deleted, and no row is changed.** The Review, Decisions and Questions rows stay in their archived databases, under Archive, with their pages. The template's copy is the exception: the template deletes its Review database with its Example Review row, and its copy has no Decisions or Questions database.
- **No decision is made for you.** Only what you decided in Notion is applied; a pending row's proposal is asked in your next session. A requested revision is asked with your words shown, never redrafted here.
- **No answer is invented.** A question marked Answered in Notion is recorded as answered, without an answer; what the answer was stays wherever you wrote it.
- **No task is created by the migration.** A question becomes a task only when you say so (B8, "track it", or `Track: Waiting On —` in the minutes).
- **Views on pages you already have** are left for you to delete (A6, B3).

## Verify

Part A:
- [ ] (With a brain) The brain's log has the Review decisions applied, `brain proposal list --waiting` lists what is left, and `brain sync plan --review-transition` refuses with `REVIEW_RETIRED`.
- [ ] `brain config get notion.databases.review` has no value; neither do `notion.review_sections` and `notion.review_format`; `brain upgrade --dry-run` no longer says the space still has the Review database.
- [ ] Areas has no To review and no Review relation, and At a glance reads like "1 meeting · 2 due" or "all clear"; Meetings has no Review Items.
- [ ] Inbox · Kind has Weekly, after the earlier options.
- [ ] The Review database and the Review page are under Archive, with every row; Brain Data and Home don't show them; the area template has no "Review waiting" tab. (The template's copy: the Review database is deleted, and Home has no "What needs my decision?".)

Part B:
- [ ] (With a brain) A question you had set Answered in Notion has its `answer` in Git; one set Dropped is `archived` with `dropped`; `brain config get notion.databases.questions` and `.decisions` have no value.
- [ ] No database on Brain Data has a property pointing at Decisions or Questions; Documents has no From decision.
- [ ] The Decisions and Questions databases are under Archive, with every row; Knowledge and Archive have no Decisions or Questions tab; the area, project and meeting templates have no Decisions or Questions view or toggle. (The template's copy: it has no Decisions or Questions database.)
- [ ] (Tasks) Tasks has Kind (Task, Question, Risk), `brain config get notion.tasks.properties.kind` is `Kind` (or empty, on a mapped database you kept without it), and the Tasks page has the tabs Questions and Risks between Someday and Done.
- [ ] (Tasks) "track it" on an open question in the session creates one task with Kind Question, listed under Questions.

Part C:
- [ ] Inbox · Kind has Changed, after Weekly; the Inbox has Changed from (a one-way relation to the Inbox) and What changed (text), with their descriptions, and no other new property.
- [ ] (Tasks) Tasks has Document asked and the Keep as document button, pinned first; clicking it on a task ticks Document asked and changes nothing else. `brain config get notion.tasks.properties.document_asked` is `Document asked` (or empty, on a mapped database you kept without it).
- [ ] (Documents, Tasks) Documents has Task, a one-way relation to the tasks database, which has no new property.
- [ ] (With a brain) "keep the … task as a document" in the session, or the button and the next catch-up, writes a Document linked to the task by Task; a document asked with Only keep filled first comes back as an Inbox row of Kind Changed, with Changed from and What changed.

The last steps:
- [ ] A brain-owned property's description ends with "An edit here is asked in your agent session before it reaches the brain."
- [ ] Brain Assistant's Instructions name no Review, Decisions or Questions database and say never to create Tasks from a meeting; Skills holds ten pages, without Review queue and Grill review.
- [ ] The Start here callout says that Brain Assistant and its buttons need Business or Enterprise with Notion credits, linked to Notion's help page.
- [ ] The System callout reads `Template version: 0027`.
