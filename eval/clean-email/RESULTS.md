# Clean email: blind runs

## 0.4.2: names and bodies only (CC-52, decision 0047)

**Runs:** 2026-10-23, two fresh agents acting as Notion AI. Each got only the `/Clean email` text from notion/brain-assistant.md and [thread.md](thread.md), and never saw the expected result below. The thread now also has email addresses, a Cc line, an "[EXTERNAL]" banner, a Subject line, and a Teams meeting block under a sentence about the call (the cases from U-17).

| Check | Expected | Run 1 | Run 2 |
|---|---|---|---|
| One line per message | `<sender> → <recipients> · <date>`, names only; no address, Cc or Subject | ✔ | ✔ |
| Nothing guessed | a part the text doesn't show is left out | ✘ gave the 2 Dec message a recipient its quote line doesn't name | ✔ `Lucía Fernández · 2 Dec 2026` |
| Order | 2 Dec (Lucía), 3 Dec (Tomás), the undated reply (Lucía) | ✔ | ✔ |
| Text word for word | every sentence and figure, including "Let's go through the plan on Thursday's call at 10:00." | ✔ | ✔ |
| Removed | Teams block, banner, Cc, Subject, 2 signatures, the notice, the quoted copy, "Sent from my iPhone", tracking and unsubscribe links | ✔ | ✔ |
| Why line | suggested with facts as the thread states them | ✘ added a year the thread doesn't state | ✔ |
| Confirm first (dropped in run 4) | nothing changed before the user's yes | ✔ | ✔ |

**After run 1**, the skill text says to take each part only from the message's own header or quote line, and to word the Why line with the thread's own facts. **After run 2**, it says that a reply pasted with no header takes its sender from its sign-off or signature. Run 2 already did that, but the text didn't say so.

**Run 3** (2026-10-23, after the user asked for a result that's easier to read): the skill now gives each message a heading 3, its body in normal paragraphs below it, and a divider before the next message. A fresh agent got the same inputs and wrote the result as Notion-flavoured Markdown, so the blocks are visible:

```markdown
### Lucía Fernández · 2 Dec 2026

Tomás, can you confirm whether we're still on track for the January launch? Legal needs the date by Friday.

---

### Tomás Vidal → Lucía Fernández · 3 Dec 2026

Hi Lucía,

The CMS migration slipped a week. We can still make 15 Feb if content freeze stays on 1 Feb. Budget unchanged at 80,000 EUR.

Let's go through the plan on Thursday's call at 10:00.

Tomás

---

### Lucía Fernández

Sounds good, let's lock 15 February then. I'll tell the agency today.

Best,
Lucía
```

Every check in the table passes again: the sender's paragraphs and sign-off are kept, there are no headings besides the one per message, no bold, and the Why line uses the thread's own figures.

**Run 4** (2026-10-23, after the user asked for no confirmation step unless there's a serious doubt): one fresh agent ran the skill on two pages.
- **Page A, [thread.md](thread.md):** replaced the page text without asking, with the same result as run 3. It then gave the count of what it removed, said the page history keeps the original, and suggested a Why line without waiting for an answer. ✔
- **Page B, [thread-conflict.md](thread-conflict.md):** the same thread, except that the quoted copy of Tomás's message says 85,000 EUR and his own message says 80,000 EUR. It made no change and asked one question that quotes both figures. ✔

It reported one judgment call: a quoted copy that is only shorter (Tomás's quote leaves out the Thursday sentence) is not a doubt. The skill text now says so.

## 0.4.1: first version (CC-46, decision 0045)

**Run:** 2026-10-22, on the same thread without the U-17 cases. All checks passed: order, headers (From, To, Date, Subject where shown, none guessed), the text word for word, the removals, nothing added, the Why line asked, and nothing changed before the user's yes.
