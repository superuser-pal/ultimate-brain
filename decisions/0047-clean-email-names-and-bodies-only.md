# 0047 — Clean email keeps names and bodies only

**Status:** Proposed
**Date:** 2026-10-23
**Amends:** 0045

## Context
`/Clean email` shipped in 0.4.1 (0045): each message kept one header line (From, To, Date, Subject) and its text word for word. In U-17, on the first real thread, the user found four problems:
- the From and To lines carried email addresses, where the user wants only the names;
- the clean copy kept a Teams meeting block (join link, meeting ID, passcode) and other details that weren't the message's own text;
- the result was still hard to read: the bodies didn't stand out from the lines around them;
- having to confirm every clean was a step too many.

The user wants only the bodies, with who wrote to whom.

## Decision
- **One line per message, names only:** `<sender> → <recipients> · <date>`. For example: `Tomás Vidal → Lucía Fernández · 3 Dec 2026`. No email addresses, no Cc, no Subject. If the text shows only an address and no name, the address stays: the skill never guesses a name. A part the text doesn't show is left out.
- **Then the message's own text, word for word:** what the sender wrote, from the greeting to the sign-off.
- **Newest first,** as a mail client shows a thread: the latest message on top, the oldest at the bottom (the user, 2026-10-23). The brain dates each message from its heading, so the order changes nothing for the ingest.
- **Easy to read in Notion** (the user, 2026-10-23: the first version was still hard to read):
  - the names-and-date line is a heading 3;
  - the body sits under it as normal paragraphs, with the sender's own paragraphs and lists;
  - a divider separates messages.

  Lines a mail client broke in the middle of a sentence are joined. Only line breaks change, never words. An optional "Why I saved this" line sits above the first heading, as a gray paragraph.
- **Everything else goes**, besides what 0045 already removed (signatures, disclaimers, quoted copies, "Sent from" lines, tracking and unsubscribe links):
  - meeting and calendar blocks: Teams, Zoom or Meet join links, meeting IDs, passcodes, dial-in numbers;
  - banners such as "[EXTERNAL]" or "You don't often get email from …";
  - reply and forward header blocks ("-----Original Message-----"), image and logo placeholders, social links.
- **It rewrites the page directly.** It doesn't wait for a yes; Notion's page history keeps the original. It asks first, and changes nothing until the user answers, only when it has a serious doubt:
  - two copies of a message that disagree (a figure, name or date; a copy that is only shorter is not a doubt);
  - it can't tell where a message ends, or what is quoted;
  - a block that may be the sender's words or boilerplate;
  - a page that doesn't look like an email thread.

  Its report counts what it removed and suggests a "Why I saved this" line, without waiting for an answer.
- **Still clean, never summarize** (0045): a sentence the sender wrote is never shortened, merged or dropped. That includes a sentence about a meeting ("Let's meet Thursday at 10").

## Consequences
- **Amends 0045:** "one header per message (From, To, Date, Subject)" becomes a heading with names and date; "oldest first" becomes newest first; and "after the user confirms, it rewrites the page" becomes "it rewrites the page, and asks only on a serious doubt". Check minutes and Tidy capture still wait for a yes.
- **The ingest** reads a capture whose messages start with `<sender> → <recipients> · <date>` (a heading) as an email, as it does today for From and Date lines.
- **Notion:** migration 0008 replaces the Clean email skill's text in Brain Assistant Skills. The migration for 0.5.0 becomes 0009.
- **Release:** 0.4.2.

## Evidence
- U-17, 2026-10-23: the user's feedback on the first cleaned thread.
- decisions/0045 (Clean email); notion/brain-assistant.md; eval/clean-email.
