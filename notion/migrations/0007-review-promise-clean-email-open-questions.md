# 0007 · What approving does, where reviewing starts, Clean email, Open questions

**Design change:** CC-46 (decision 0045; docs/notion-space-design.md §3.9, §3.10, §5, §9). **Applies to:** spaces built before release 0.4.1.

Run it in one session, right after installing 0.4.1 and running `brain upgrade` in your brain, and before the next catch-up. The **agent** steps are done through the API by the `brain-notion-change` skill, each with your yes. The **Notion AI** step changes a linked view, which the Notion API can't do: paste the prompt while you're on the page named. The **by hand** steps are ones the API can't reach, with the reason given.

## 1 · Review says what approving does (0045)

| Change | Who |
|---|---|
| On the **Review** page, replace the gray paragraph above the tabs ("Your corrections go in Note. Target says what changes.") with: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. Your corrections go in Note. Target says what changes." | agent: update that block's text |
| Description of Review → **Decision**: "Owner: you. Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed." So every Review row shows it on hover: rows are created through the API, which can't give them a template | agent |

## 2 · Home: where reviewing starts (0045)

**Notion AI**, on **Home**:
> In the left column, under the heading "Needs you": add a gray paragraph right below the heading, "Start here: approving makes the brain's notes trusted.". Then change the linked view "What needs my decision?" of Review: rename it "What's waiting for you?", keep the filter State is Pending and the sort, group it by Kind with group counts shown, at most 5 rows per group, and show Name and Target Page.
>
> Don't change anything else.

## 3 · Questions: Status starts as Open (0045)

| Change | Who |
|---|---|
| Description of Questions → Status: "Owner: you. The brain sets Open when it creates a question, and Answered once after you approve an Answer row in Review." | agent |

No other step: the first publish after the upgrade sets Open once on every question whose Status is empty and that has no answer. A Status you set is never changed.

## 4 · Brain Assistant: Clean email (0045)

| Change | Who |
|---|---|
| In the database **Brain Assistant Skills**, add a page **Clean email**: Description and body from [brain-assistant.md](../brain-assistant.md), "Clean email" | agent |
| In the agent's **Instructions**, replace the rule line "Only the skills "Check minutes" and "Tidy capture" may edit page text, and only after I confirm." with the one in [brain-assistant.md](../brain-assistant.md) (adds "Clean email") | by hand: the API can't reach a Custom Agent's Instructions |
| Without a Custom Agent: save the Clean email text as a personal skill instead | by hand, optional |

## 5 · How it works

| Change | Who |
|---|---|
| Update the **How it works** page from the user guide ([skills/brain-howto/references/guide.md](../../skills/brain-howto/references/guide.md)): "Deciding in Review" (what approving does, rows leaving after 30 days) and "Getting things in" (pasting an email) changed | agent |

## 6 · First catch-up

Run "catch up". It writes, once:
- **Status = Open** on every question with an empty Status and no answer;
- **Review rows decided more than 30 days ago move to Notion's trash.** Expect most of your Applied and Closed rows the first time; the brain keeps every one in Git, and Notion keeps the trash for 30 days. From then on, rows leave one by one, 30 days after you decide them.

## Verify
- [ ] The Review page's gray line starts "Approving makes these notes trusted"; hovering Decision on a Review row shows the same sentence.
- [ ] Home → Needs you shows "Start here: …" and "What's waiting for you?", grouped by Kind with counts.
- [ ] Questions → Status's description names Open and Answered.
- [ ] `/Clean email` on a capture holding a pasted thread shows the clean copy, oldest first, and changes nothing until you confirm.
- [ ] After the first catch-up: every question without an answer has a Status, and Review → Approved recently holds only rows from the last 30 days.
