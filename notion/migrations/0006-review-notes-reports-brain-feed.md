# 0006 · Review Notes and Answer rows, Ask and Report, Full text, the Brain feed

**Design change:** CC-36 (decisions 0041, 0042, 0043; docs/notion-space-design.md §2, §3.1, §3.9–§3.11, §4, §5, §9). **Applies to:** spaces built before release 0.4.0.

Run it in one session, right after installing 0.4.0 and running `brain upgrade` in your brain, and before the next catch-up. The **agent** steps are done through the API by the `brain-notion-change` skill, each with your yes. The **Notion AI** steps add linked views, which the Notion API can't create: paste the prompt given while you're on the page named.

## 1 · Review: two new Kinds (0041)

| Change | Who |
|---|---|
| Add the options **Review Notes** and **Answer** to Review → Kind, after New Item | agent |
| Descriptions: Target "Owner: brain. Says what changes; your corrections go in Note.", Note "Owner: you. With Edit, the value to use; with Approve or Reject, what to do differently (\"all except b, d\")." | agent |
| On the **Review** page, a gray paragraph above the tabs block: "Your corrections go in Note. Target says what changes." (0043) | agent: inserted right after the block that precedes the tabs block. If the tabs block is the first block in its column, the API can't insert above it: the agent adds the line after the tabs and you drag it up once |

## 2 · Inbox: Ask, Report and Full text (0043)

| Change | Who |
|---|---|
| Add the options **Ask** and **Report** to Inbox → Kind, after Note | agent |
| Add **Full text** (checkbox) | agent |
| Add the two-way relation Inbox "Ask" ↔ Inbox "Report" (a relation of the Inbox to itself) | agent |
| Descriptions: Full text "Owner: you. Tick it to have the text on the row; the brain writes it and clears the box."; Ask and Report "Owner: brain."; Kind "Owner: system, except Ask, which you set." | agent |

## 3 · Questions: Status (0041)

| Change | Who |
|---|---|
| Description of Questions → Status: "Owner: you. The brain sets Answered once, after you approve an Answer row in Review." | agent |

## 4 · Brain Assistant: the minutes check (0043)

| Change | Who |
|---|---|
| In the Brain Assistant's **Check minutes** skill, replace step 1 with the new section list from [brain-assistant.md](../brain-assistant.md) | agent |
| Paste the new [minutes format](../minutes-format.md) wherever you keep your meeting-summary prompt (your Notion AI meeting notes instructions) | by hand, optional |

## 5 · Templates: what came in, what we know (0043)

**Notion AI**, on each template in turn (open the database → New ▾ → the default template):

> In this template, before the toggle "My notes", add exactly these, each an H3 heading followed by a linked view filtered to the current page with the database title hidden:
> - Projects template: "What came in?": Inbox where Project is this page, sorted Created descending, showing Name, Kind, Summary. Then "What do we know?": one linked view with two views, "Decisions" (Decisions where Project is this page, sorted Date descending, showing Name, Assessment, Date) and "Concepts" (Concepts where Project is this page, sorted Created time descending, showing Name, Summary).
> - Areas template: "What came in?": Inbox where Area is this page, sorted Created descending, showing Name, Kind, Summary. Then "What do we know?": Concepts where Area is this page, sorted Created time descending, showing Name, Summary, Project.
>
> Don't change anything else.

Existing project and area pages keep their body; add the same views to the pages you use most, or leave them, since the Inbox and Concepts tabs in Knowledge show the same rows.

**Area Brief (0041):** no step. The first publish appends a "Brief" toggle heading at the end of each area page and fills it; drag it to the top once if you like. New areas from the template get it the same way.

## 6 · Home: Ask the brain and the Brain feed (0043)

**Notion AI**, on **Home**: items 3b, 9 and 10 of [Prompt 7a](../prompts/07a-home.md), with:
> Add only these. Don't change anything else.

## 7 · First catch-up

Run "catch up". It writes, once:
- one **Review Notes** row per source for the notes still Draft (the backlog, 0041): a few clicks accept them;
- a **Brief** on every area page;
- a **digest** in the body of every Inbox row the brain created, and the **Full text** toggle on the email and chat rows: expect one body write per row, reported in the counts.

## Verify
- [ ] Review → Kind lists Review Notes and Answer; the Review page shows the gray line above the tabs.
- [ ] Inbox → Kind lists Ask and Report; Inbox has Full text, Ask and Report.
- [ ] A new project and a new area have "What came in?" and "What do we know?".
- [ ] Home has the Ask the brain button and "What did the brain take in?" with two tabs.
- [ ] After the first catch-up: Review has one Review Notes row per source with draft notes, each area page has a Brief, and an ingested document's Inbox row shows its digest.
- [ ] Tick Full text on one document row, run "catch up": the row gets a "Full text" toggle and the box is cleared.
- [ ] Add an Ask row, run "catch up": a Report row answers it, linked from the Ask row, which is Processed.
