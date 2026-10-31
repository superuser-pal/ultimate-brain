# 0012 · Brain Assistant buttons, Accepted wording

**Design change:** CC-70, CC-71, decision 0054 (docs/notion-space-design.md §3.16, §3.17; cli.md §5.14.7; views-guide.md §9). **Applies to:** spaces that ran migration 0011 (release 0.6.1). A space migrated from an earlier release runs 0010 and 0011, then this one. Release 0.8.0.

What changes: three buttons (Tidy capture, Write up, Refresh report) send a message to Brain Assistant so it edits one page's text at once; two Accept buttons mark that text final; the catch-up takes in only text you accepted. The old **Refresh report** button, which ticked Refresh asked, becomes a Brain Assistant button; Refresh asked stays as a checkbox you tick by hand for a full refresh from Git.

Run it after `brain upgrade` has put 0.8.0's CLI and skills in place. Nothing here is read by the brain until you click a button.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **by hand:** you, in Notion, for buttons, the agent's Instructions and skills, and page layouts (the API can't edit them).

## 1 · Properties

| Change | Who |
|---|---|
| Documents (Documents module): add **Accepted** (checkbox) and **Accepted at** (date, with time) | agent |
| Inbox (Reports module): add **Accepted** (checkbox) and **Accepted at** (date, with time) | agent |
| Descriptions of Accepted and Accepted at in both databases: "Owner: you, through the Accept write-up or Accept refresh button. The brain clears it once it has taken the accepted text in." | agent |
| Description of Refresh asked on the Inbox: "Owner: you, ticked by hand to queue a full refresh from the brain's notes. Waiting for the brain; it clears it." | agent |

Skip a row for a module you have off.

## 2 · Brain Assistant (by hand, in Notion)

Open the agent **Brain Assistant** ([../brain-assistant.md](../brain-assistant.md) has the texts):
1. **Tools and access:** give it **edit** access to the **Documents** database (it already has Meetings and Inbox). Leave view access elsewhere.
2. **Instructions:** replace them with the block under "Instructions" in brain-assistant.md (the edit rule now lists Write up and Refresh report and says what a button's message carries; the Accepted rule is new). Re-link each *[@…]* with a real @mention.
3. **Skills database "Brain Assistant Skills":** change **Tidy capture** (Brain Status New only; a button's message carries the confirmation) and add the pages **Write up** and **Refresh report**, each with the Description and body from brain-assistant.md. Keep **Use automatically** on.

## 3 · Buttons (by hand)

Open the database as a full page → `•••` → Properties. The messages are in [../views-guide.md](../views-guide.md) §9; in each, type `@` and pick **This page**.

| Database | Button property → label | Action |
|---|---|---|
| Inbox | **Tidy** → "Tidy capture" (new) | Send message to Brain Assistant: the Tidy capture message |
| Inbox | **Update** → "Refresh report" (existing) | **Change the action** from Edit property (Refresh asked → checked) to Send message to Brain Assistant: the Refresh report message |
| Inbox | **Accept** → "Accept refresh" (new; Reports module) | Edit property on This page: Accepted → checked; Accepted at → Now |
| Documents | **Write** → "Write up" (new) | Send message to Brain Assistant: the Write up message |
| Documents | **Accept** → "Accept write-up" (new) | Edit property on This page: Accepted → checked; Accepted at → Now |

Avoid a button property name equal to, or one letter from, another property of the same database.

## 4 · Page layouts (by hand)

Open any row as a full page → `•••` → **Customize layout**. The full table is [../views-guide.md](../views-guide.md) §9.

| Database | Heading, in order | Move to the top of the property group |
|---|---|---|
| Inbox | Keep, Update, Tidy, Accept, Brain Status, Project, Area | Document asked, Refresh asked, Accepted, Accepted at, Only keep |
| Documents | Write, Accept, Lifecycle, Project, Area, Sources | Accepted, Accepted at |

## 5 · The "How it works" page (by hand)

Replace its text with `skills/brain-howto/references/guide.md` as it is in 0.8.0 (the buttons table, "How do I refresh a report?" and "What does accepting do?" changed).

## After the migration

The first catch-up after this reads each published Document and report body from Notion. One published before 0.8.0 has no stored baseline, so the catch-up holds it and, if you are there, shows Notion's text and the brain's and asks which to keep; nothing is overwritten until you answer. See cli.md §5.14.7, row 9.

## Verify
- [ ] Documents and Inbox have Accepted and Accepted at; hovering shows "Owner: you, through the Accept …"; Refresh asked's description says it is ticked by hand.
- [ ] Brain Assistant has edit access to Documents; its Instructions list Write up and Refresh report in the edit rule, and say a button's message carries the confirmation and the page.
- [ ] The skills database has the pages Write up and Refresh report, and Tidy capture says Brain Status New only.
- [ ] **Tidy capture** on a test Inbox row (Kind Capture, Brain Status New, a few messy lines of made-up text) rewrites the text below the title and changes no property: Brain Status is still New.
- [ ] **Write up** on a promoted Document gives Purpose, Main content, Open questions and Sources and changes no property; edit a sentence and click it again: your edit is kept and a toggle "Proposed revision" is added.
- [ ] **Accept write-up** (after you delete the toggle) ticks Accepted and sets Accepted at to now; editing the page afterwards, then "catch up", lists it as needing a new accept.
- [ ] **Refresh report** on a test Report row adds one toggle "Proposed refresh · based on Notion · <date>" at the end and ticks nothing; a second click replaces only that toggle. Refresh asked is still unticked.
- [ ] Ticking **Refresh asked** by hand still queues a full refresh; it waits while the toggle is on the page.
- [ ] A button whose message has no page reference makes Brain Assistant stop and say so.
- [ ] The Inbox and Documents layouts match section 4; "How it works" matches the guide.
