# 0029 · 0.16.2: New task on Home, Clean email on New, the minutes layout

**Design change:** decision [0106](../../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §12; CC-355 (release 0.16.2; docs/notion-space-design.md §5 Home, [../views-guide.md](../views-guide.md) §1, [Prompt 7a](../prompts/07a-home.md)). Decision 0106 §3; CC-350 (release 0.16.2; assessment finding F-0010; [../brain-assistant.md](../brain-assistant.md), Clean email). Decision 0106 §13; CC-356 (release 0.16.2; spec/capture-and-review.md §3.3 "The divided layout"; [../minutes-format.md](../minutes-format.md), [../brain-assistant.md](../brain-assistant.md) Check minutes, [../template-examples.md](../template-examples.md)). It is 0.16.2's one Notion migration. **Applies to:** every space built or migrated before 0.16.2, the template's copy included. Needs migration 0028. A step already done changes nothing, so running this again is safe.

**What changes:**
- **New task on Home** (0106 §12). Home's right column gets a **New task** button right after **New project**: it adds a Tasks row with Kind Task and the database's default Status, and opens it. It sets no project and no due date: it adds the row you would add by hand in Tasks. Polish, not a new capability (0106 §1): the brain reads nothing new and writes nothing new.
- **Clean email on New captures only** (0106 §3, finding F-0010). Brain Assistant's **Clean email** skill accepted a capture with Brain Status New or Ready. A Ready row may already be taken in by the brain, so the skill now works only on a capture still New, as Tidy capture does: on a Ready or Done row it stops and says why. Its text changes on its Skills page; nothing else does.
- **The minutes layout** (0106 §13). The minutes prompt writes each section as a heading with a divider under it (`## In one line` with its sentence below, `## Quick follow-ups`, `## Tasks for the brain`, `## <Subject> [s1]`), and a subject's lines as bullets with a bold prefix (`- **Decided:** … [s1.i2]`). The items, tags, quotes and the For the brain toggle don't change, and the brain reads both layouts. You replace the prompt where you keep it, and Check minutes' text, which now checks the new layout and accepts the old. Meetings already summarised are never rewritten.

Run this migration after `brain upgrade` has put 0.16.2 in place, in an attended session (never from a schedule). **The template's copy** (no brain) does the same steps.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion. The API can't create or edit a button, and it can't read what a button does. So the button is made by hand, and read back by you, in its edit menu and with one click. Clean email's page in Skills is replaced by hand too, as every skill's text has been (migrations 0010, 0026), and read back by you.

## Part A · New task on Home (0106 §12)

**Tasks module off, with no tasks database of your own:** skip part A. A space without Tasks gets no button (a button of a module you left off is skipped, [../views-guide.md](../views-guide.md) "Modules").

### A1 · The New task button (by hand)

On **Home**, in the right column, find the row of buttons: Quick capture, Ask the brain (Reports), New meeting, New project.
1. **Already there?** A button named **New task** in that row means this step ran: change nothing, and go to A2 to check it. (Two such buttons: delete the one A2 doesn't pass.)
2. **Otherwise,** hover over **New project** → **⋮⋮** → **Duplicate**, so the copy sits right after it. Open the copy's edit menu (hover → the gear, or click its name):
   - **Name:** `New task`.
   - **Action:** replace the copied *Add page to Projects* with **Add page to** → **Tasks**. Add one property, **Kind** = **Task**. Set nothing else: no Status (the database's default applies), no Project, no Area, no Due.
   - **Open page after creation:** on.
   - **Done.**

   Or type `/button` right after New project and set the same name and action.
3. **Your own Tasks database** (mapped in `brain.json` `notion.tasks`, decision 0018): the button adds the page to *that* database. With a Kind property mapped (`notion.tasks.properties.kind` is not empty, spec/setup.md §6.2.1), set it to **Task**; without one, set no property at all. Status is your database's default; set no other property, even one your database marks as usual.

### A2 · Read the button back (by hand)

1. **By name and action:** open the edit menu of the button right after New project. Its name is exactly `New task`; its one action is *Add page to Tasks* (or your own tasks database), with **Kind = Task** as its only property (none on your own database without Kind), and *Open page after creation* is on.
2. **By one click:** click **New task**. A new page opens in Tasks with Kind **Task**, Status the database's default (**To Do** in the default Tasks database), and Project, Area and Due empty. It shows in no project's or area's "What's on my plate here?", and in the Tasks Space under **No date**. Then move the test page to the trash (••• → Delete): the brain never took it in, so nothing else changes.
3. **The other buttons are unchanged:** Quick capture, Ask the brain (Reports), New meeting and New project still have their own names and actions ([../views-guide.md](../views-guide.md) §1).

The agent can confirm the click from its side, with your yes: query Tasks for the row you just made (by its title, or the newest by Created time) and read back Kind = Task, the default Status, and empty Project, Area and Due. It can't read the button itself.

## Part B · Clean email on New captures only (0106 §3)

Every space with Brain Assistant takes part B, whatever its modules. **Without a Custom Agent** (a personal Clean email skill instead): make the same replacement in your personal skill.

### B1 · Clean email's text (by hand)

Open **Skills** (on System; "Brain Assistant Skills" in a space built before 0.14.0) and the page **Clean email**. [../brain-assistant.md](../brain-assistant.md) has the new texts, under "Clean email".
1. **Already done?** The body's second line (Source) ends "Brain Status New; otherwise stop and tell me (a Ready row may already be taken in by the brain, …)". Then this step ran: change nothing, and go to B2.
2. **Otherwise,** replace two texts, and nothing else on the page:
   - **Description:** it read "Use on an Inbox page of Kind Capture when I say …". Replace the whole Description with the new one, which reads "Use on an Inbox page of Kind Capture, Brain Status New, when I say …".
   - **Body:** it read "Source: this page only. It must be a page in the Inbox database inside [@Brain Data] with Kind Capture and Brain Status New or Ready; otherwise stop and tell me." Replace the whole body with the new one. Re-link *[@Brain Data]* with a real @mention of Brain Data under your top page. Steps 0 to 7 are the same as before.
   - Keep **Use automatically** on. The other skills don't change.
3. **Brain Assistant's Instructions don't change:** their edit rule names Clean email, but not which rows it may edit; the skill's Source line says that.

### B2 · Read Clean email back (by hand)

1. **The text:** on the Clean email page, the Description contains "Kind Capture, Brain Status New," and the body's Source line reads: "Source: this page only. It must be a page in the Inbox database inside [@Brain Data] with Kind Capture and Brain Status New; otherwise stop and tell me (a Ready row may already be taken in by the brain, and rows the brain created and Done captures are a record of what came in)." The words "New or Ready" are nowhere on the page, and the @mention opens Brain Data under your top page.
2. **On a Ready row:** make a test capture in Inbox (Quick capture makes it Ready) with a short made-up thread, such as "From: Ana Test · 2 Mar 2026 · Hi Ben, the draft is attached. Ana". Ask Brain Assistant on it: **Run Clean email**. It stops, changes nothing, and says the row is Ready, so the brain may already be taking it in.
3. **On a New row:** set the same test row's Brain Status to **New** and ask **Run Clean email** again. It cleans the page (a heading "Ana Test → Ben · 2 Mar 2026", then the message) and tells you what it removed. Then move the test row to the trash (••• → Delete), before any catch-up: the brain never took it in.

The agent can confirm the text from its side, with your yes, where Skills is shared with the integration (spec/setup.md §6.4 reads it for the mentions): read the Clean email page and its Description, and check the Source line above and that "New or Ready" is absent. It can't run the skill.

## Part C · The minutes layout (0106 §13)

Every space takes part C, whatever its modules: the minutes prompt is used on every meeting page.

### C1 · The minutes prompt where you keep it (by hand)

The prompt is the text block of [../minutes-format.md](../minutes-format.md), as 0.16.2 ships it. You keep it in one or both of these places:
1. **Write minutes** in **Skills** (since 0.16.2's CC-283). **Already done?** Its body's first section reads "1. ONE LINE" followed by `The heading "## In one line", then a divider`. Then change nothing. **Otherwise,** replace the whole body of the page with the new text block, and nothing else on the page: keep its Description.
2. **A copy you keep elsewhere** (a page, a note, a text snippet; [../pasting-the-minutes-prompt.md](../pasting-the-minutes-prompt.md) step 1): replace it with the same text block.

With neither, there is nothing to replace: copy the block from minutes-format.md when you next write minutes. A personal Notion AI skill holding the prompt (no Custom Agent) is replaced the same way.

### C2 · Check minutes' text (by hand)

Open **Skills** and the page **Check minutes**. [../brain-assistant.md](../brain-assistant.md) has the new text, under "Check minutes".
1. **Already done?** Step 1's "Lean (current)" line contains "each section a heading followed by a divider". Then change nothing.
2. **Otherwise,** replace the whole body with the new one. Re-link *[@Brain Data]* with a real @mention of Brain Data under your top page. The Description doesn't change. **Without a Custom Agent:** make the same replacement in your personal Check minutes skill.

### C3 · Read the layout back (by hand)

On a test page in **Meetings** (title `Layout check: delete me`), paste a short made-up transcript, such as "Ana: Let's keep the blog as it is. Ben: Agreed, and I'll send the plan on Friday." Open the Notion AI chat on the page, paste the prompt from C1 followed by the line "Write the minutes on this page, below the transcript, and nothing else.", and send.
1. The minutes start with the heading **In one line**, a divider and one sentence. Every section's heading has a divider under it. Every line of a subject is a bullet, the prefixed ones in bold (**Decided:** …), each ending with a tag like `[s1.i2]`. The page ends with the collapsed toggle **For the brain**.
2. Ask Brain Assistant **check minutes** on it: it names the minutes Lean and reports no line that blocks the meeting.
3. Then move the test page to the trash (••• → Delete), before you mark it Reviewed: the brain never took it in.

### C4 · The template's example meeting (the template's copy only)

On the template's copy, `Example · Kickoff with Northwind` takes the new layout, so a new duplicate shows minutes as the user's own will look: [../template-examples.md](../template-examples.md), "Updating a copy to 0.16.2" (U-41, before republishing). A user's space skips C4: its meetings, the example one included, are never rewritten, and the brain reads them as they are.

## The last steps

### L1 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0029`. A space without that line has nothing to change.

## What this migration doesn't do

- **Part A changes no database, view, template or row.** Tasks keeps its properties and its default Status; the test row of A2 is yours to delete.
- **The brain does nothing new.** A task you add with New task is yours, as one added by hand in Tasks: the brain sets no Status on it and reads none back (decision 0101 §6).
- **Nothing for a space without Tasks.** No button is added where the Tasks module is off and no tasks database is mapped.
- **Part B changes no database, property, view, button or row**, and no other skill. Tidy capture and Voice summary already worked on New captures only. A Ready capture is not lost: the brain takes it in as it is, and to clean it first you set it back to New.
- **Part C rewrites no meeting.** Minutes written with an earlier prompt keep their layout and are read exactly as before (decision 0007: the brain never edits a meeting page's body). It changes no database, property, view, button or template: the Meetings template's gray line already says where Meeting only goes.
- **The guides come with the skills release.** brain-howto's Everyday guide says Clean email works only while a capture is New, and describes the new minutes layout; republish your **Everyday guide** and **How it works** pages from the skills release that ships with 0.16.2, as for any guide change.

## Verify

These come in two kinds. **Read back through the API** (the agent): the items marked *(API)*. **Only you can see** (Notion's interface): the items marked *(you)*. The agent never ticks a *(you)* item from what it read.

Part A, New task on Home (decision 0106 §12), with Tasks:
- [ ] *(you)* Home's right column has a button **New task**, once, right after **New project**; its edit menu shows *Add page to Tasks* (or your own tasks database) with Kind = Task as its only property, and *Open page after creation* on.
- [ ] *(you)* Clicking New task opens a new Tasks page with Kind Task, the default Status, and no Project, Area or Due.
- [ ] *(API)* The row it made reads back with Kind `Task`, the default Status and empty Project, Area and Due; after you delete it, it is in the trash.
- [ ] *(you)* Quick capture, Ask the brain (Reports), New meeting and New project are unchanged.

Part B, Clean email on New captures only (decision 0106 §3):
- [ ] *(you)* The Clean email page in Skills has the new Description ("Kind Capture, Brain Status New,") and the Source line ending "Brain Status New; otherwise stop and tell me (a Ready row may already be taken in by the brain, …)"; "New or Ready" is nowhere on it.
- [ ] *(API)* Where Skills is shared with the integration: the Clean email page reads back with that Source line, and without "New or Ready".
- [ ] *(you)* Run Clean email on a Ready test capture stops and says why; on the same row set to New it cleans the page; the test row is then in the trash.

Part C, the minutes layout (decision 0106 §13):
- [ ] *(you)* Write minutes (and any copy you keep) holds the new prompt: its "1. ONE LINE" section starts `The heading "## In one line", then a divider`.
- [ ] *(API)* Where Skills is shared with the integration: the Write minutes page reads back with that line, and Check minutes with "each section a heading followed by a divider".
- [ ] *(you)* The test minutes of C3 are in the new layout, Check minutes reports nothing that blocks them, and the test page is in the trash.
- [ ] *(you)* The template's copy only: `Example · Kickoff with Northwind` shows its minutes in the new layout, and is still Not Reviewed.

The last steps:
- [ ] *(API)* The System callout reads `Template version: 0029`.
