# 0025 · Review with me, and Your call decides a Review page

**Design change:** decision [0090](../../decisions/0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md) §1, §5 (with [0088](../../decisions/0088-a-review-row-says-it-needs-you-and-a-review-page-reads-plainly.md) §2); CC-241 (release 0.15.0; spec/capture-and-review.md §7.12.7, §7.12.10; docs/notion-space-design.md §3.10, §3.15, §3.16). **Applies to:** every space built or migrated before 0.15.0, the template's copy included. Needs migration 0024. A step already done changes nothing, so running this again is safe.

**What changes:**
- **A Review page from a meeting, email or document reads plainly** (0.15.0's publish writes it): what the source brings and what to do at the top, then the changes, the new notes and the links, each change's wording visible, and at the end a toggle "For Brain Assistant (brain context)" that the brain writes for Brain Assistant.
- **Review with me.** A new button on every Review row asks Brain Assistant to go through the page with you: it asks you what the page can't settle, in rounds of three to five questions, each with options and the one it recommends. It shows what it will write into the page and writes it only after your yes. It never sets Your call.
- **Your call decides the page.** You read the page (or review it with Brain Assistant), correct what you want, then set **Your call**:
  - **Approve** takes the page as it reads now. An item still on Pending is accepted, except a ⚠ change or a ⚑ item the brain is unsure about: those need `Decision: Accept` on their line.
  - **Request revision**, with what to redraft in What to fix: the redraft comes back on the page after your next catch-up, and the row needs you again.
  - **Reject** leaves the notes as they are now.
- **The Submit decisions and Submit and accept all buttons leave the row's heading.** They stay under *Show all properties*, for a row of the older page (from 0.8.0 to 0.14.0) that you already started deciding: it keeps its rules until it is done. A row nobody touched is rebuilt as a new page at the first publish after the upgrade, and the old page goes to Notion's trash.

Nothing is renamed or deleted. Decided, Decided at and Accept all stay, unused by new pages.

Run this migration after `brain upgrade` has put 0.15.0 in place. The order of the steps doesn't matter.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **Notion AI:** you paste a prompt;
- **by hand:** you, in Notion. The API can't create a button, edit a page layout or edit a Custom Agent, and it can ignore a write while still answering 200, so always read the result back.

## 1 · Review · Your call's description (agent)

Set this description on **Your call**, then read it back:

`Owner: you. Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. On a row from a meeting, email or document, set it after you read the page: Approve takes the page as it reads (a ⚠ or ⚑ item needs Accept on its line), Request revision redrafts what What to fix says, Reject leaves the notes as they are. On a Conflict, Answer or Suggestion row: Approve, Reject, or Fix with what's wrong in What to fix.`

## 2 · Review · the Review with me button (by hand)

Open Review as a full page → **•••** → **Properties** → **New property** → **Button**:
- **Property name:** `Grill`. **Label:** `Review with me`.
- **Action:** **Send message to** → **Brain Assistant**, with this message. Where it says `@This page`, type `@` and pick the current page:

  `Run your Grill review skill on this Review page: @This page. Go through it with me in rounds of questions, show me what you will write and wait for my yes before writing. Never set Your call or change any property.`

A space without a Brain Assistant Custom Agent (no Business or Enterprise plan) skips this step: the page is decided by hand, and Grill review can still be run as a personal skill (step 5).

## 3 · The Review row's layout (by hand)

Open any Review row → **⋯** → **Customize layout**:
- **Heading:** **Status**, **Grill** (Review with me), **About Page**, in that order. Take **Submit** and **Submit all** out of the heading.
- **Hidden:** add **Submit** and **Submit all** to the hidden properties, next to Kind, State, Brain ID, Created time and Last edited time. They show under *Show all properties*.
- **Property panel:** as migration 0024 left it (Your decision, What's proposed, Where it comes from, Submitted).

## 4 · The Review page's gray line and the row template (Notion AI, then by hand)

Paste on the **Review** page:

```text
Use only the databases on Brain Data. On this page ("Review"), replace the text of the gray paragraph above the tabs with exactly: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. Status says what each row needs. Needs you · decide in the page: open the row, read it or click Review with me, correct what you want, then set Your call. Needs you · set Your call: pick Approve or Reject, or Fix and say what's wrong in What to fix." Keep it gray. Change nothing else.
```

Then, if the Review database has a row template with the gray callout "Each change below is a section…" (Review → **New** ▾ → the template's **⋯** → **Edit**), replace the callout's text with: "Each change below is a section. Read them, or click Review with me to go through them with Brain Assistant. Correct a wording where it stands, or type Accept, Reject or Defer on its Decision line. Then set Your call: Approve, Request revision (say what in What to fix) or Reject." A space without that template skips this.

**By hand, without Notion AI:** click the gray line and type the new text.

## 5 · Brain Assistant (by hand)

Open the agent. [../brain-assistant.md](../brain-assistant.md) has the texts.
1. **Tools and access:** give **Review** edit access (Grill review writes into a Review page after your yes). Leave the other databases as they are.
2. **Instructions:** replace them with the block under "Instructions". The edit rule now names Grill review, the Review rule has its one exception, and the last Review rule says Grill review recommends one option per question, never Approve or Reject. Re-link each *[@…]* with a real @mention.
3. **Skills** database: add the page **Grill review** (title, its Description, its text as the body), and replace the body of **Review queue** with its new text (it tells the new page from the older one). Keep **Use automatically** on.

Without a Custom Agent: save Grill review as a personal skill and run it on an open Review page with "review this with me".

## 6 · How it works (by hand)

Replace the text of **How it works** with `brain-howto/references/guide.md` as it is in the skills release that ships with 0.15.0. Its "Deciding in Review" section now describes the new page, Review with me and Your call, and the hand path without Notion AI.

## 7 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0025`. A space without that line has nothing to change.

## What this migration doesn't do

- **No change to the decision words or to how a decision is applied.** Accept, Reject, Defer and the binding of an acceptance to its exact wording stay as they are; only the way a page is submitted changes, and only for pages written from 0.15.0.
- **No rewrite of a page you touched.** A row of the older page with a typed decision, an edited wording or a Submit keeps its page and its rules (submit it with Submit decisions under *Show all properties*).
- **No new property besides the button,** and no view change.

## Verify

- [ ] Your call's description starts with "Owner: you. Approving makes these notes trusted" and names Request revision.
- [ ] A Review row's heading reads Status, Review with me, About Page. Submit decisions and Submit and accept all show only under *Show all properties*, and still tick Decided there.
- [ ] Brain Assistant has edit access to Review, its Instructions name Grill review, and Skills holds twelve pages, Grill review included.
- [ ] On a synthetic test row in a test space (never a real row): **Review with me** opens Brain Assistant on that page, its first message is a round of questions with lettered options and one recommended, with a blank line between questions and between options; it shows a preview and writes nothing before your yes; afterwards Your call is still empty. Delete the test row.
- [ ] The gray line above the Review tabs says "read it or click Review with me".
