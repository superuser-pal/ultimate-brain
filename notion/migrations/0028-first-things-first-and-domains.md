# 0028 · First things first, and Domains on Projects, Meetings and Documents

**Design change:** decision [0103](../../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md) §1 and §2; CC-337 (release 0.16.1; spec/setup.md §6.4, §6.4.1, §6.4.2; docs/notion-space-design.md §5, §10, §10.1). Domains: decision [0105](../../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md); CC-343. It is 0.16.1's one Notion migration. **Applies to:** every space built or migrated before 0.16.1, the template's copy included. Needs migration 0027. A step already done changes nothing, so running this again is safe.

**What changes:**
- **First things first** (0103). Your space gets a checklist page, **First things first**, under your top page, linked from the Start here callout and first in System. It lists what only you can do in Notion for Brain Assistant: create your own agent, give it access, paste its Instructions and replace the mentions, check the mentions in its skills, and select it in the **Send message to** of the Tidy capture, Write up and Refresh report buttons. Then: open Claude Code or Codex in your brain folder and say "set up my brain", and check Today and the buttons.
- **A Brain Assistant that works is kept.** This migration writes nothing to an agent or a button (the API can't), and never asks you to create a second agent. If yours already answers in its chat, you check it, and repair only what a check finds.

Run this migration after `brain upgrade` has put 0.16.1 in place, in an attended session (never from a schedule), in the order below. **The template's copy** (no brain) does the Notion steps alone.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion. The API can't edit a Custom Agent or a button, and it can't put a block before the first one on a page or in a callout. It can ignore a write while still answering 200, so always read the result back.

## Part A · First things first (0103)

### A1 · The First things first page (agent)

The top page is Brain Data's topmost parent page (spec/setup.md §6.4). Read its child pages.
1. **Already there?** A child page titled **First things first** means this step ran: create nothing, and leave the page as it is, its ticks included. Go to A2. (Two such pages: say so, and ask the user which to keep; delete nothing without their yes for that page.)
2. **Otherwise,** with the user's yes, create a page titled **First things first** under the top page holding the checklist of [docs/notion-space-design.md](../../docs/notion-space-design.md) §10.1 word for word: its first line as a paragraph, then the eight items as to-do blocks, unticked, their bold words in bold, and its three links ("Notion credits", "Brain Assistant's setup page", "Get started") as that section gives them. Name every place as the text does, by where it sits under the top page: add no page mention.
3. **Read it back** through the API: one child page **First things first** under the top page, holding one paragraph and eight to-dos, none ticked, in §10.1's order, with the three links.

### A2 · The link in Start here (agent, or by hand)

Read the top page's first block. When it is the **Start here** callout, add this line right after the line that ends "Get started shows every step." (before the line on Notion credits), a plain line inside the callout:

`Then open First things first: create your own Brain Assistant and select it in its buttons.`

Link "First things first" to the page of A1.
- **Already there?** A line in the callout that links to the First things first page means this step ran: change nothing.
- **The agent** adds it when the callout's lines are blocks of their own: append a paragraph to the callout with `after` set to the "Get started" line's block id. Then read the callout's children back: the new line is right after that one, once, and its link opens the A1 page.
- **By hand** when the callout's lines are one block's text: click at the end of "Get started shows every step.", press Shift+Enter, type the line, select "First things first" and link it to the page (type its name in the link box and pick the one under your top page).
- **No Start here callout** (a space built before 0.14.0 without it): nothing to change. A1's page is on your top page, and A3 links it from System.

### A3 · The link in System (by hand)

Add a line **First things first**, linked to the page of A1, as the first line of **System**: in the template's copy and spaces from it, the System callout on the top page (decision 0085); in a space built from the prompts, the top of the System page. The API can't add a block before the first one, so this one is by hand: click at the start of the first line, type `First things first`, press Enter (Shift+Enter inside a callout's text), then select the words and link them to the page under your top page.

- **Already there?** A link to the First things first page in System means this step ran: change nothing.
- **Then the agent reads System back:** its first line links to the A1 page, once.

### A4 · Your Brain Assistant: keep it, and check it (in the session)

Nothing is written here. Ask: "Does this space already have a Brain Assistant you created, that answers in its chat?"
- **Yes:** keep it. Don't create another, and don't change its Instructions or its buttons for this migration. Say "check Brain Assistant again" in your brain: setup's checks run on it (spec/setup.md §6.4: the scope check with Today, the mentions in Skills read through the API, your check of its access and Instructions, and each button on a sample page). Only a failed check shows its First things first item, as a repair.
- **No, or not sure:** tick through **First things first**, in order; "set up my brain" walks you through it and checks each item.

The template's copy skips A4: it has no brain, and a duplicate never carries an agent (decision 0103 §1).

## The last steps

### L1 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0028`. A space without that line has nothing to change.

## What this migration doesn't do

- **Part A changes no agent, button or skill page.** A working Brain Assistant and its Send message to bindings stay as they are. A repair is your own edit, made only where a check found something.
- **Part A creates, changes or deletes no row.** The sample pages of the button checks are setup's (spec/setup.md §6.4 check 7), not this migration's.
- **Nothing is ticked for you.** A ticked First things first box records nothing: the brain never reads the page. Brain Assistant is ready when setup's checks pass.

## Verify

These come in two kinds. **Read back through the API** (the agent): the items marked *(API)*. **Only you can see** (Notion's interface): the items marked *(you)*. The agent never ticks a *(you)* item from what it read.

Part A, First things first:
- [ ] *(API)* The top page has exactly one child page **First things first**, holding the paragraph and eight to-dos of docs/notion-space-design.md §10.1, with its three links; a second run created no second page and changed no tick.
- [ ] *(API)* The Start here callout (where the space has it) holds the line "Then open First things first: …" once, right after the "Get started" line, its link opening that page.
- [ ] *(API)* System's first line links to the First things first page, once.
- [ ] *(you)* Clicking each link (Start here, System) opens the First things first page under your own top page.
- [ ] *(you)* An existing Brain Assistant is the same agent as before, with the same Instructions and Tools and access; each of Tidy capture, Write up and Refresh report still sends to it.
- [ ] *(with a brain)* "check Brain Assistant again" passes, or names the one item to repair.

Part B, Domains (decision 0105):
- [ ] *(API)* Projects, Meetings and Documents each have a **Domain** rollup through Area, showing the Area's Domain.
- [ ] *(you)* A Domain page lists its Projects, Meetings and Documents.
- [ ] *(API)* Domains has no **Type**, unless you said no to removing it.

The last steps:
- [ ] *(API)* The System callout reads `Template version: 0028`.
