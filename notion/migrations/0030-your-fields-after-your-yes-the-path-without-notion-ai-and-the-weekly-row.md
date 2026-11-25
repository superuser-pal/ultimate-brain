# 0030 · 0.17.0: Notion Brain Assistant sets your fields after your yes and takes its new name, the path without Notion AI, the weekly row

**Design change:** decision [0101](../../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §3, moved to 0.17.0 by [0106](../../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §4; CC-325 (release 0.17.0; docs/notion-space-design.md §2 and §10.1, [../brain-assistant.md](../brain-assistant.md) Setup, Instructions and Weekly review, spec/weekly-review.md §13). Decision [0072](../../decisions/0072-ultimate-assistant.md) §1, built in 0.17.0 by 0106 §4; CC-352 (release 0.17.0; [../brain-assistant.md](../brain-assistant.md), docs/notion-space-design.md §3.16, §3.17, §10 and §10.1, [../views-guide.md](../views-guide.md) §9, [Prompt 1](../prompts/01-pages.md), [Prompt 6](../prompts/06-templates.md)). Part D: decision [0110](../../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §1 to §5, CC-372 (release 0.17.0; docs/notion-space-design.md §2 and §3.11, ../brain-assistant.md Instructions, Today and Weekly review, spec/weekly-review.md §13). It is 0.17.0's one Notion migration (0106 §4, [0110](../../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md)): CC-352 (Notion Brain Assistant), CC-329 (First things first's item 1, the path without Notion AI) and CC-372 (the weekly row) add their parts to it before the release. **Applies to:** every space built or migrated before 0.17.0, the template's copy included. Needs migration 0029. A step already done changes nothing, so running this again is safe.

**What changes:**
- **Notion Brain Assistant sets your operational fields after your yes** (0101 §3). In its chat, after you say yes to a change it names with its value, Notion Brain Assistant may set a task's Status or Due, a project's Status, Priority or Dates, a goal's Status, and a key result's Current, Done or Due. Nothing else: never a property the brain owns, a section the brain writes, Brain Status, Accepted, Document asked or Refresh asked; asked to, it says where that is done. Its **Weekly review** asks about the week's task items in numbered options and sets the ones you pick ("1a"), instead of only listing them. These stay your fields: the brain reads them as pointers and stores none of them, so nothing Notion Brain Assistant sets is knowledge. Its Instructions, its Weekly review skill, its Tools and access, and First things first's "Give it access" item change.
- **Notion Brain Assistant** (0072 §1, 0106 §4). Brain Assistant is renamed Notion Brain Assistant, so it isn't confused with Ultimate Assistant in Claude Code or Codex. The same agent keeps its rules, skills, access and buttons; its name changes, with the first line of its Instructions, Write minutes' Description, the Start here callout, First things first and the Voice note template's gray line.
- **The path without Notion AI** (0101 §7, §8). Notion AI and Notion credits are optional: without credits, Notion Brain Assistant's skills run from Claude Code or Codex, and without Notion AI, your agent writes a meeting's minutes from its transcript. First things first's **Check your plan** item says so, instead of sending you to your personal Notion Agent. The table of what works on each Notion plan is in the README's Get started and in docs/setup.md, not in Start here.
- **The weekly row** ([0110](../../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §1 to §5; part D). From 0.17.0 Claude Code or Codex writes the week's Inbox row in two parts, Your week and Clean-up, and you decide its Actions and clean-up items by ticking them in the row and setting it Ready; the next catch-up applies them. Nothing in Notion's structure changes: the row is an Inbox row of Kind Weekly with Brain Status New, Ready and Done, which exist. Only Notion Brain Assistant's texts change: its **Weekly review** reads the two-part row with you, as an optional companion, and never ticks, writes a Your note line or sets Ready; its Instructions say the ticks, the notes and the row's Brain Status are yours; **Today** says to tick, then set Ready.

Run this migration after `brain upgrade` has put 0.17.0 in place, in an attended session (never from a schedule). **The template's copy** (no brain) does the same steps.

**The agent's name.** This migration calls the agent by its name from 0.17.0, Notion Brain Assistant (part B). Until you do B1, Agents lists it as Brain Assistant: it is the same agent.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion. The API can't read or change a Custom Agent's Instructions or its Tools and access, so those are changed by hand and checked by you. Skill pages are replaced by hand, as every skill's text has been (migrations 0010, 0026, 0029).

## Part A · Notion Brain Assistant sets your fields after your yes (0101 §3)

**No Notion Brain Assistant** (no Business or Enterprise plan with Notion credits, so no Custom Agent): skip A1. **With personal Instructions instead** (set up before 0.17.0): make A2's and A3's replacements in your personal Instructions and your personal Weekly review skill; there is no Tools and access to change.

### A1 · Tools and access (by hand)

Open **Agents → Notion Brain Assistant → Settings → Tools and access**.
1. **Already done?** Brain Data's databases **Tasks**, **Projects**, **Goals** and **Key Results** (those your space has) show **Can edit**. Then change nothing.
2. **Otherwise,** give edit access on those four databases, and change nothing else: Meetings, Inbox and Documents keep edit access, everything else in Brain Data (Areas, People, Orgs, Domains) keeps view access, and How it works and Skills keep theirs. A module you left off has no database to give access to. Where Tools and access shows only the page Brain Data, open its access and set the four databases under it to **Can edit**.

The brain never needs this access: Notion Brain Assistant does, for the fields of A2. Without it, Notion Brain Assistant says it can't set the field, and nothing else changes.

### A2 · The Instructions (by hand)

Open **Agents → Notion Brain Assistant → Instructions**. [../brain-assistant.md](../brain-assistant.md) has the new text, under "Instructions".
1. **Already done?** The Rules contain a line starting "- My fields, after my yes." Then change nothing.
2. **Otherwise,** replace two passages, and nothing else:
   - The line that starts "- Never edit any property or page. Only these skills may edit page text:" becomes four lines: "- Never edit a page or a property, except as the rules below allow.", the line starting "- My fields, after my yes.", the line starting "- Asked to change anything else, refuse in one line", and "- Only these skills may edit page text:" followed by the rest of the old line, unchanged.
   - The last line, "… You only read, and help me understand.", becomes "… You read, help me understand, and set my fields above after my yes."
3. Copy each new line from brain-assistant.md as it is. The Instructions' mentions of Brain Data and How it works don't change.

### A3 · The Weekly review skill (by hand)

**From the release, D1 replaces this page's text with the text the release ships,** which has these task rounds too: when you run the whole migration, skip A3 and do D1, then A5 with D1's text. A3 stays for a space that ran part A before part D existed; that space does D1 as well.

Open **Skills** (on System; "Brain Assistant Skills" in a space built before 0.14.0) and the page **Weekly review**. [../brain-assistant.md](../brain-assistant.md) has the new texts, under "Weekly review": its **Description:** line and its text block (the code block, from "Goal:" to "Never recommend Approve or Reject."). First see where the page keeps the skill's text, and replace it there:
- **The text is in the Description property and the page body is empty** (the template's layout, and every space duplicated from it): the agent runs what Description holds. Replace **Description's whole text** with the new text block, word for word, and leave the body empty. The short **Description:** line isn't copied into this layout.
- **The text is in the page body** (a Skills database built by hand from Prompt 9): replace the whole **body** with the new text block, and Description with the new **Description:** line.

Change nothing else on the page.
1. **Already done?** The skill's text (in Description, or in the body) has a step 8 starting "8. End with one short list", or D1's text (a step 11 starting "11. End with one short list"). Then change nothing.
2. **Otherwise,** make the replacement above. Re-link *[@Brain Data]* with a real @mention of Brain Data under your top page. Keep **Use automatically** on. Steps 1 to 4 are as before; step 5 no longer says "I set it myself", and steps 6 to 8 ask about the task items in numbered options, set what you pick after your answer, and list what was set.
3. **Check it took:** open Description and the body again. The old text ("6. End with one short list", "I set it myself") is in neither; if it is still in Description, the agent still runs the old skill.
4. The other skills don't change: Today, Prep and Plan check stay read only.

### A4 · First things first, item 3 (the agent, or by hand)

The page **First things first** (under your top page; migration 0028) has the item **Give it access**. Its sentence "Edit access is needed only on Meetings, Inbox and Documents (in Brain Data); view access everywhere else." becomes "Edit access is needed only on Meetings, Inbox and Documents, and on Tasks, Projects, Goals and Key Results for the fields it sets after your yes (all in Brain Data; those your space has); view access everywhere else." (docs/notion-space-design.md §10.1, the exact text).
1. **Already done?** The item names Tasks, Projects, Goals and Key Results. Then change nothing.
2. **Otherwise,** the agent, with your yes, replaces that one sentence in the to-do block and keeps the rest of the item, its bold words and its tick as they are. Or edit the sentence by hand.
3. **No First things first page** (a space that skipped 0028's part A): nothing to change.

### A5 · Read it back (by hand)

Use made-up rows only, and delete them before any catch-up. In **Brain Data**:
- In **Projects**, a project `Fields check project: delete me`, Status **Active**, with a Key Facts line `Budget: 10k`.
- In **Tasks**, a task `Fields check: delete me`, Status **To Do**, Due a week ago, Project `Fields check project: delete me`.
- In **Meetings**, a meeting `Fields check meeting: delete me`, Brain Status **New**.
- In **Inbox**, a row `Week of <this week's Monday, like 16 Nov 2026>`, Kind **Weekly**, Brain Status **New**, whose body is the three headings `What changed`, `Task analysis` and `What needs your decision`, the first two with the line `- Nothing new this week.`, and under the third the line `1. Overdue · "Fields check: delete me" · new date, Done or Won't Do → ` followed by an @mention of the test task.

In Notion Brain Assistant's chat:
1. **Weekly review sets a task after your answer, not before:** ask **Run Weekly review**. It finds the test row and asks about item 1 with lettered options, a new Due date among them. Before you answer, open the test task: its Due hasn't changed. Answer `1a` (or the letter of the new date). It sets the task's Due to that date and reads it back; the task's Status and every other property are unchanged.
2. **"Leave it" sets nothing:** set the test task's Due back to a week ago by hand, ask **Run Weekly review** again and answer the letter of "leave it". Nothing changes on the task.
3. **A field after a yes:** ask "set the Fields check project to On Hold". It asks, in one line, to set Status of `Fields check project: delete me` to On Hold; nothing changes until you say yes. Say yes: the project's Status reads On Hold.
4. **It refuses what the brain owns:** ask "change the Key Facts of the Fields check project to Budget: 12k". It refuses in one line and says to tell Claude Code or Codex in your brain; Key Facts still reads `Budget: 10k`.
5. **It refuses your instructions to the brain:** ask "set the Fields check meeting to Ready". It refuses in one line and says to set Brain Status yourself; the meeting's Brain Status still reads New.

Then move the four test rows to the trash (••• → Delete), before any catch-up: the brain never took them in.

The agent can confirm the values from its side, with your yes: query the test rows and read back the task's Due and Status, the project's Status and Key Facts, and the meeting's Brain Status, after each step. It can't read the agent's Instructions, its Tools and access, or its chat.

## Part B · Notion Brain Assistant (0106 §4; CC-352)

The Custom Agent you created as **Brain Assistant** is renamed **Notion Brain Assistant**, so it isn't confused with Ultimate Assistant, the brain's assistant in Claude Code or Codex (decision [0072](../../decisions/0072-ultimate-assistant.md) §1). It is the same agent: its rules, its skills, its Tools and access and its buttons stay as they are, and only its name and the texts that say it change. A page, a skill or an older migration that still says Brain Assistant means this agent; the other parts of this migration call it Brain Assistant, the name it has before B1.

Every space takes part B. **No Custom Agent** (no Business or Enterprise plan with Notion credits): skip B1, B2 and B5's first two checks, and do the rest. **With personal Instructions instead:** make B2's replacement in your personal Instructions.

### B1 · Rename the agent (by hand)

The API can't read or change a Custom Agent, so you rename it.
1. **Already done?** In Notion's sidebar, **Agents** lists your agent for this space as **Notion Brain Assistant**. Then change nothing, and go to B2.
2. **Otherwise,** open **Agents → Brain Assistant → Settings** and change its name to `Notion Brain Assistant`. Change nothing else: not its Instructions (B2 changes one line), its Tools and access, or its triggers (it has none).
3. **Two agents named Brain Assistant** (an older test copy in the same workspace): rename only the one whose Tools and access hold the Brain Data under your top page. Leave the other as it is, or delete it if you no longer use it.

### B2 · The Instructions' first line (by hand)

Open **Agents → Notion Brain Assistant → Instructions**. [../brain-assistant.md](../brain-assistant.md) has the new text, under "Instructions".
1. **Already done?** The first line reads "You are Notion Brain Assistant, my helper for the Ultimate Brain workspace." Then change nothing.
2. **Otherwise,** replace that one line: "You are Brain Assistant, my helper for the Ultimate Brain workspace." becomes "You are Notion Brain Assistant, my helper for the Ultimate Brain workspace." Change nothing else: part A changes its own lines.

### B3 · Write minutes' Description (the agent, or by hand)

Open **Skills** (on System; "Brain Assistant Skills" in a space built before 0.14.0, a name that doesn't change) and the page **Write minutes**. It is the one skill whose text names the agent, twice. [../brain-assistant.md](../brain-assistant.md) has the new text, under "Write minutes": its **Description:** line. First see which layout your Skills pages have, as in A3, on another skill's page, such as Today:
- **The text is in the Description property and the page body is empty** (the template's layout, and every space duplicated from it): Write minutes is the one page whose body is not empty. Its Description holds the skill's text, which names the agent twice, and its body holds the minutes prompt. Replace **Description's whole text**, and leave the body as it is.
- **The text is in the page body** (a Skills database built by hand from Prompt 9): Write minutes' Description holds the short **Description:** line, which names the agent twice, and its body holds the minutes prompt. Replace the **Description**, and leave the body as it is.

So in both layouts the agent's name is in Description, and the new text is the same.
1. **Already done?** The Description, in either layout, reads "… Notion Brain Assistant doesn't run it: …" and "… Asked to write minutes, Notion Brain Assistant gives you these steps …". Then change nothing.
2. **Otherwise,** the agent, with your yes, sets the page's **Description** property to the new text, in either layout, where Skills is shared with the integration; or replace the Description by hand. The page's body (the minutes prompt) and the other skills don't change.
3. **No Write minutes page** (a space before 0.16.2's CC-283): nothing to change.

### B4 · Start here, First things first and the Voice note template (the agent, or by hand)

docs/notion-space-design.md §10 and §10.1 have the exact texts.
1. **Already done?** The Start here callout and the page First things first name **Notion Brain Assistant**, and in them "Brain Assistant" appears only after "Notion", in the database name "Brain Assistant Skills", or in item 2's sentence "perhaps still named Brain Assistant?". Then change nothing.
2. **Start here** (the callout on your top page): find two sentences by their first words, wherever they stand in the callout, in one text or several. "Then open First things first: create your own Brain Assistant and select it in its buttons." and "Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits." each say **Notion Brain Assistant** instead. The agent, with your yes, replaces the name in those two sentences and keeps their links ("First things first", "Notion credits") and the rest of the callout as they are. Or edit them by hand.
3. **First things first:** the opening line and the items **Check your plan**, **Create your own Brain Assistant** (its bold title becomes **Create your own Notion Brain Assistant**), **Paste its Instructions and replace the mentions**, **Select your agent in the three buttons** and **Run Today and check the buttons** say **Notion Brain Assistant** where they said Brain Assistant. **Create your own …** also gets its new sentence, "Already have one you created that answers in its chat, perhaps still named Brain Assistant? Keep it, don't create a second one: rename it **Notion Brain Assistant**, check items 3 to 6, then do item 8." in place of "Already have a Brain Assistant you created that answers in its chat? Keep it, don't create a second one: check items 3 to 6, then do item 8." The agent, with your yes, replaces those words in each to-do block and keeps the rest of each item, its bold words, its links (item 4's "… setup page" link, item 1's "Notion credits") and its tick as they are. Or edit them by hand. A space without the page (one that skipped 0028's part A) has nothing to change here.
4. **The Voice note template** (by hand; the API can't edit a database template): open **Inbox** → the arrow next to **New** → **Voice note**, ••• next to it → **Edit**. In the gray line under the callout, "then ask Brain Assistant: Voice summary." becomes "then ask Notion Brain Assistant: Voice summary.", and nothing else changes. Voice notes already made keep their text, and say the same agent. A space without the Voice note template has nothing to change here.

### B5 · Read it back

1. *(you)* **The agent:** Agents lists **Notion Brain Assistant** for this space, and no agent named Brain Assistant has this space's Brain Data in its Tools and access. In its chat, ask **Run Today**: it answers from your space as before.
2. *(you)* **The buttons follow the agent:** for **Tidy capture** (Inbox), **Write up** and **Refresh report** (Documents; each there with its module on), open the database as a full page → ••• → Properties → the button. **Send message to** shows **Notion Brain Assistant**, and the message is unchanged. If it is empty or shows another agent, select your Notion Brain Assistant there (First things first, **Select your agent in the three buttons**) and keep the message as it is. Then click **Tidy capture** on a made-up row in Inbox, `Name check: delete me`, Kind **Capture**, Brain Status **New**, with a line of text: it is tidied as before. Move the test row to the trash (••• → Delete) before any catch-up.
3. *(API)* The agent reads back, with your yes: Write minutes' Description (where Skills is shared with the integration), the Start here callout (its whole text, the blocks inside it included) and First things first name Notion Brain Assistant, and in them "Brain Assistant" appears only after "Notion", in the database name "Brain Assistant Skills", or in item 2's sentence "perhaps still named Brain Assistant?".

## Part C · The path without Notion AI: First things first's item 1 (0101 §7, §8; CC-329)

One text in your space says what works on your Notion plan: First things first's item 1 (docs/notion-space-design.md §10.1, "Item 1's wording changed in 0.17.0"). Start here holds no plan table (C2). Nothing else changes: setup asks its two questions from the brain, not from Notion (spec/setup.md §13).

### C1 · First things first, item 1 (the agent, or by hand)

The page **First things first** (under your top page; migration 0028) starts with the item **Check your plan.** Its text after the bold words, which before 0.17.0 ends "put the Instructions of item 4 and the skills in your personal Notion Agent instead, and ask for a skill by its name." (part B gave it the agent's new name), becomes (docs/notion-space-design.md §10.1, the exact text):

`Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits. Without credits, skip items 2 to 6 and 8 (the buttons won't work on your plan): do item 7, then ask Claude Code or Codex for a skill by its name instead, such as "prep my 3pm" or "tidy that capture".`

1. **Already done?** The item says "ask Claude Code or Codex for a skill by its name". Then change nothing.
2. **Otherwise,** the agent, with your yes, replaces the item's text after **Check your plan.** with the text above, in the same to-do block. It keeps the bold words, the link on "Notion credits" (https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents) and the tick as they are, then reads the block back: the new text once, "personal Notion Agent" nowhere on the page. Or edit the text by hand.
3. **No First things first page** (a space that skipped 0028's part A): nothing to change.

### C2 · No plan table in Start here (nothing to do)

Start here holds no plan table: the table is in the README's [Get started](../../README.md#get-started), which Start here's "Get started" link opens, and in [docs/setup.md](../../docs/setup.md); a space that added the table under this step's earlier text may keep it or delete it, and nothing checks it.

## Part D · The weekly row: Weekly review, the Instructions and Today (0110; CC-372)

The weekly row changes no database, property, option, view or button: only these three texts of Notion Brain Assistant ([docs/notion-space-design.md](../../docs/notion-space-design.md) §3.11, "Notion steps for the weekly row"). **No Notion Brain Assistant** (no Business or Enterprise plan with Notion credits): make D1 to D3 in your personal skills and your personal Instructions, if you set them up. The guide pages come with the skills release (below).

### D1 · The Weekly review skill (by hand)

Open **Skills** (on System; "Brain Assistant Skills" in a space built before 0.14.0) and the page **Weekly review**. [../brain-assistant.md](../brain-assistant.md) has the new texts, under "Weekly review": its **Description:** line, which now starts "Optional:", and its text block (from "Goal:" to "Never recommend Approve or Reject."). Replace them where the page keeps the skill's text, as A3 says: in the template's layout, **Description's whole text** with the new text block and the body left empty; in a Skills database built by hand from Prompt 9, the whole **body** with the new text block and Description with the new **Description:** line.
1. **Already done?** The skill's text has a step 4 starting "4. A row whose headings are "Your week" and "Clean-up"". Then change nothing.
2. **Otherwise,** make the replacement. Re-link *[@Brain Data]* with a real @mention of Brain Data under your top page. Keep **Use automatically** on. What the new text does: it reads a two-part row with you, item by item, by its labels (A1, U1, C1) and what each Show the change holds, decides nothing in it, and ends by telling you to tick, write on an item's Your note line to change it, then set the row Ready; it asks about the tasks Focus first names in numbered options, none marked as a suggestion, and sets only what you pick, after your answer; a row written before 0.17.0 is read as A3's text reads it; it never ticks or unticks a to-do, writes on a Your note line or sets Brain Status.
3. **Check it took:** open Description and the body again. Neither holds "6. Then ask me about the task items in rounds of at most five" (A3's text) or "Ask me nothing to decide:" (0.16.x's text); if one still does, the agent still runs the old skill.

### D2 · The Instructions (by hand)

Open **Agents → Notion Brain Assistant → Instructions**. [../brain-assistant.md](../brain-assistant.md) has the new text, under "Instructions".
1. **Already done?** The Rules contain a line starting "- A Weekly row's ticks, its Your note lines and its Brain Status are mine:". Then change nothing.
2. **Otherwise,** make two changes, and nothing else:
   - Right after the line starting "- Never touch a project's or area's "Brief"", add the line starting "- A Weekly row's ticks, its Your note lines and its Brain Status are mine:", copied from brain-assistant.md as it is.
   - In the line starting "- I decide what the brain proposes in Claude Code or Codex, not here.", replace "not here." with "not here, except a Weekly row's Actions and clean-up items, which I tick in that row." and keep the rest of the line.

### D3 · Today (by hand)

Open the page **Today** in Skills. Its step 3, which starts "3. Inbox: the newest row of Kind Weekly or Catch-up", becomes the step 3 of [../brain-assistant.md](../brain-assistant.md) under "Today" (for a Weekly row whose Brain Status is New, it says to tick what you agree with, then set it Ready), where the page keeps its text (Description, or the body), and nothing else on the page changes.
1. **Already done?** Step 3 holds "For a Weekly row whose Brain Status is New". Then change nothing.
2. **Otherwise,** replace that one step, word for word.

### D4 · Read it back (by hand)

Use made-up rows only, and delete them before any catch-up. In **Brain Data**:
- In **Tasks**, a task `Weekly check: delete me`, Status **To Do**, Due a week ago.
- In **Inbox**, a row `Week of <this week's Monday, like 23 Nov 2026>`, Kind **Weekly**, Brain Status **New**, whose body is:
  - a heading 2 `Your week`; the line `**In short:** Test week: one action and two clean-up items.`; a bold line `Actions` and under it the to-do `A1 · Add the next step "Draft the outline" to Weekly check project: delete me`, with under it a toggle `Show the change` holding `New task: Draft the outline` and the line `Your note:`; a bold line `Focus first` and the line `1. Weekly check: delete me: due a week ago.`, with the task's name an @mention of the test task; the line `**Waiting for you:** nothing waits in the session.`;
  - a heading 2 `Clean-up`; a bold line `Already cleaned` and the to-do `U1 · Archived the draft "Old shortlist" (never reviewed, no link to it, 74 days old) · tick to undo`; a bold line `For you to tick` and the to-do `C1 · Merge "Acme Corp" into "Acme" · recommended: yes`, with under it a toggle `Show the change` holding `Acme Corp will be merged into Acme` and the line `Your note:`.

In Notion Brain Assistant's chat:
1. **It reads the two parts:** ask **Run Weekly review**. It summarises Your week, then reads A1, U1 and C1 by their labels, with what Show the change holds, and asks you nothing to decide about them. It ends by saying to tick, write on an item's Your note line to change it, then set the row's Brain Status to Ready, and that Waiting for you is decided in Claude Code or Codex.
2. **Focus first's task, after your answer:** it asks about `Weekly check: delete me` with options (a new Due you name, Done, Won't Do, leave it), none marked as the review's suggestion. Answer `1d` (leave it): the task is unchanged.
3. **It decides nothing in the row:** open the row: no to-do is ticked, both Your note lines are empty, and Brain Status reads **New**.
4. **It refuses the row's decisions:** ask "tick C1 for me", then "set this row to Ready". It refuses each in one line and says to do it yourself; the row is unchanged.
5. **Today:** ask **Run Today**. Its Inbox section shows the test row and says to tick what you agree with in it, then set it Ready.

Then move the two test rows to the trash (••• → Delete), before any catch-up.

The agent can confirm from its side, with your yes: query the test row and task and read back the row's Brain Status, its to-dos (none ticked) and the task's Due and Status. It can't read the agent's Instructions or its chat.

## The last steps

### L1 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0030`. A space without that line has nothing to change.

## What this migration doesn't do

- **Part A changes no database, property, option, view, button or template**, and no other skill: it changes what Notion Brain Assistant may do, its access and two texts that describe it.
- **The brain does nothing new.** A field Notion Brain Assistant sets is yours, as if you had set it: the brain reads Status, Due, Priority, Dates and progress values as pointers, as before, and stores none of them. A task tracking an open question that Notion Brain Assistant sets Done is asked about in your next attended session, as one you set Done is (0101 §6).
- **Brain-owned values stay asked in the session.** Notion Brain Assistant refuses them; and an edit to one by any AI or by hand is still asked in your agent session before the brain takes it (0101 §4).
- **The buttons don't change.** A button's message carries its skill's confirmation only, never a yes to set a field ([../views-guide.md](../views-guide.md) §9).
- **Part B changes no database, property, option, view, button or template structure.** It renames the agent and replaces its name in five texts; the skills database keeps its name, Skills or Brain Assistant Skills. The buttons' messages never named the agent: **Send message to** selects it, and B5 checks that it still does.
- **Part B is Notion's side only.** The brain never reads the agent's name, so nothing changes in it.
- **Part C changes no database, property, view, button, skill or Notion Brain Assistant itself**: it changes one text that describes your plan, and adds no plan table to Start here. A Notion Brain Assistant you already have keeps working; a personal Notion Agent you set up before 0.17.0 keeps its Instructions too, but setup no longer checks it ([../brain-assistant.md](../brain-assistant.md), Without a Custom Agent).
- **Part D changes no database, property, option, view or button.** The weekly row is an Inbox row of Kind Weekly with Brain Status New, Ready and Done, which every space has; no Example row is added to the template for it.
- **The guides come with the skills release.** brain-howto's Everyday guide and the user guide say that Notion Brain Assistant sets your fields after your yes, call it by its new name, and say how the weekly row is ticked and set Ready; republish your **Everyday guide** and **How it works** pages from the skills release that ships with 0.17.0, as for any guide change.

## Verify

These come in two kinds. **Read back through the API** (the agent): the items marked *(API)*. **Only you can see** (Notion's interface): the items marked *(you)*. The agent never ticks a *(you)* item from what it read.

Part A, Notion Brain Assistant sets your fields after your yes (decision 0101 §3):
- [ ] *(you)* Notion Brain Assistant's Tools and access give **Can edit** on Tasks, Projects, Goals and Key Results (those your space has), as well as on Meetings, Inbox and Documents; everything else in Brain Data is view only.
- [ ] *(you)* Its Instructions have the lines "- Never edit a page or a property, except as the rules below allow.", "- My fields, after my yes. …", "- Asked to change anything else, refuse in one line …" and "- Only these skills may edit page text: …", and end "… set my fields above after my yes."; "Never edit any property or page." is nowhere in them.
- [ ] *(you)* The Weekly review page in Skills holds the new text where the page keeps its text (in Description, the template's layout, or in the body with the new Description line): D1's text with steps 1 to 11, or, before part D existed, A3's with steps 1 to 8; "I set it myself" and "6. End with one short list" are nowhere on the page, Description included.
- [ ] *(API)* Where Skills is shared with the integration: the Weekly review page's Description property and its body, read together, hold a step starting "11. End with one short list" (D1) or "8. End with one short list" (A3 alone), and neither holds "I set it myself".
- [ ] *(API)* First things first's item **Give it access** names Tasks, Projects, Goals and Key Results.
- [ ] *(you)* A5's checks: Weekly review set the test task's Due after `1a` and not before; "leave it" changed nothing; the project's Status changed only after your yes; Key Facts and the meeting's Brain Status were refused and are unchanged; *(API)* the values read back as each step says; the four test rows are in the trash.

Part B, Notion Brain Assistant (decision 0072 §1, 0106 §4):
- [ ] *(you)* Agents lists **Notion Brain Assistant** for this space, and its Instructions start "You are Notion Brain Assistant, my helper for the Ultimate Brain workspace."
- [ ] *(you)* Tidy capture, Write up and Refresh report (those your space has) send to **Notion Brain Assistant**, with their messages unchanged, and Tidy capture tidied the test row, now in the trash.
- [ ] *(you)* The Voice note template's gray line ends "then ask Notion Brain Assistant: Voice summary."
- [ ] *(API)* Where Skills is shared with the integration: Write minutes' Description, which holds the skill's text in the template's layout and the short **Description:** line in a Skills database built by hand from Prompt 9 (its body is the minutes prompt in both), says Notion Brain Assistant twice, and in it "Brain Assistant" appears only after "Notion", in the database name "Brain Assistant Skills", or in item 2's sentence "perhaps still named Brain Assistant?".
- [ ] *(API)* The Start here callout (its whole text, the blocks inside it included) and First things first say Notion Brain Assistant, and in them "Brain Assistant" appears only after "Notion", in the database name "Brain Assistant Skills", or in item 2's sentence "perhaps still named Brain Assistant?"; their links are still there.

Part C, the path without Notion AI (decision 0101 §7, §8):
- [ ] *(API)* First things first's item **Check your plan.** says "ask Claude Code or Codex for a skill by its name", and "personal Notion Agent" is nowhere on the page.
- [ ] *(you)* The link on "Notion credits" in item 1 still opens Notion's help page.

Part D, the weekly row (decision 0110):
- [ ] *(you)* The Weekly review page holds D1's text where the page keeps its text: a step 4 starting "4. A row whose headings are "Your week" and "Clean-up"", a Description starting "Optional:"; neither "6. Then ask me about the task items in rounds of at most five" nor "Ask me nothing to decide:" is on the page.
- [ ] *(API)* Where Skills is shared with the integration: the Weekly review page's Description and body, read together, hold "4. A row whose headings are "Your week" and "Clean-up"" and "Never tick or untick a to-do, never write on a Your note line, and never set Brain Status."; the Today page's step 3 holds "For a Weekly row whose Brain Status is New".
- [ ] *(you)* Notion Brain Assistant's Instructions have the line starting "- A Weekly row's ticks, its Your note lines and its Brain Status are mine:", right after the line starting "- Never touch a project's or area's "Brief"", and the line starting "- I decide what the brain proposes" says "not here, except a Weekly row's Actions and clean-up items, which I tick in that row."
- [ ] *(you)* D4's checks: Weekly review read the two parts by label and ended with tick, then Ready; it set nothing on the Focus first task for `1d` and marked no option as a suggestion; the row was unticked, its notes empty and its Brain Status New after the chat; it refused to tick C1 and to set Ready; Today said to tick, then set Ready; *(API)* the values read back as each step says; the two test rows are in the trash.

The last steps:
- [ ] *(API)* The System callout reads `Template version: 0030`.
