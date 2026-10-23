# 0008 · Clean email keeps names and bodies only

**Design change:** CC-52 (decision 0047). **Applies to:** spaces built before release 0.4.2 that ran [0007](0007-review-promise-clean-email-open-questions.md).

Run it after installing 0.4.2 and running `brain upgrade`. The **agent** step is done through the API by the `brain-notion-change` skill, with your yes.

## 1 · Brain Assistant: the new Clean email text (0047)

| Change | Who |
|---|---|
| In the database **Brain Assistant Skills**, on the page **Clean email**, replace the Description and the body with the ones in [brain-assistant.md](../brain-assistant.md), "Clean email" | agent |
| Saved the text as a personal skill instead (no Custom Agent)? Replace it there with the same text | by hand: personal skills belong to your Notion account, which the API can't reach |
| Update the **How it works** page from the user guide ([skills/brain-howto/references/guide.md](../../skills/brain-howto/references/guide.md)): "Getting things in" and the Brain Assistant table changed | agent |
| In the agent's **Instructions**, replace the rule line "Never edit any property or page. Only the skills … may edit page text, and only after I confirm." with the one in [brain-assistant.md](../brain-assistant.md) (Clean email edits directly) | by hand: the API can't reach a Custom Agent's Instructions |

## Verify
- [ ] `/Clean email` on a capture holding a pasted thread shows, per message, a heading 3 `<sender> → <recipients> · <date>` with names only, the message's own text word for word in normal paragraphs below it, and a divider before the next message, newest first.
- [ ] No email addresses, Cc, Subject, Teams, Zoom or Meet join details, or "[EXTERNAL]" banners are left; every sentence the senders wrote is.
- [ ] The page is rewritten without a question, and the reply counts what was removed; a thread with two different copies of the same message gets a question first, and nothing changes until you answer.
