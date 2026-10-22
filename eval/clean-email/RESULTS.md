# Clean email: blind run (CC-46, decision 0045)

**Run:** 2026-10-22. A fresh agent, acting as Notion AI, got only the `/Clean email` text from notion/brain-assistant.md and [thread.md](thread.md). It never saw the expected result below.

**Input:** a synthetic thread of three messages, pasted the way a mail client copies it: the newest reply on top with a signature and "Sent from my iPhone"; the middle message twice, once quoted and once in full with its header, a signature, a confidentiality notice and an unsubscribe link; the oldest message only as a nested quote, with a tracking link.

| Check | Expected | Result |
|---|---|---|
| Order | 2 Dec (Lucía), 3 Dec (Tomás), the undated reply (Lucía) | ✔ |
| Headers | From, To, Date, Subject where the text shows them; none guessed | ✔ The 2 Dec message has no To or Subject; the top reply has only From |
| Text word for word | every sentence, figure and date kept ("15 Feb", "1 Feb", "80,000 EUR", "Legal needs the date by Friday") | ✔ |
| Removed | 2 signatures, the confidentiality notice, the quoted copy, "Sent from my iPhone", the tracking and the unsubscribe link | ✔ "Removed: 2 signatures, 1 confidentiality notice, 1 quoted copy, 1 "Sent from my iPhone" line, 1 tracking link, 1 unsubscribe link" |
| Added nothing | no summary or headings | ✔ |
| Why line | asked, with a suggestion; left out after "no" | ✔ |
| Confirm first | page changed only after the user's yes | ✔ It showed the result and asked first |

**Judgment calls it reported:** sign-offs ("Best, Lucía") kept as the sender's text; the whole "Track your order: …" line removed with its link; the page title not used as a Subject. All three match the skill's intent; no change to the text.
