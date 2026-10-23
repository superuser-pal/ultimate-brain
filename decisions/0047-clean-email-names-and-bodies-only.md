# 0047 — Clean email keeps names and bodies only

**Status:** Proposed
**Date:** 2026-10-23
**Amends:** 0045

## Context
`/Clean email` shipped in 0.4.1 (0045): each message kept one header line (From, To, Date, Subject) and its text word for word. In U-17, on the first real thread, the user found three problems:
- the From and To lines carried email addresses, where the user wants only the names;
- the clean copy kept a Teams meeting block (join link, meeting ID, passcode) and other details that weren't the message's own text;
- the result was still hard to read: the bodies didn't stand out from the lines around them.

The user wants only the bodies, with who wrote to whom.

## Decision
- **One line per message, names only:** `<sender> → <recipients> · <date>`. For example: `Tomás Vidal → Lucía Fernández · 3 Dec 2026`. No email addresses, no Cc, no Subject. If the text shows only an address and no name, the address stays: the skill never guesses a name. A part the text doesn't show is left out.
- **Then the message's own text, word for word:** what the sender wrote, from the greeting to the sign-off.
- **Easy to read in Notion** (the user, 2026-10-23: the first version was still hard to read):
  - the names-and-date line is a heading 3;
  - the body sits under it as normal paragraphs, with the sender's own paragraphs and lists;
  - a divider separates messages.

  Lines a mail client broke in the middle of a sentence are joined. Only line breaks change, never words. An optional "Why I saved this" line sits above the first heading, as a gray paragraph.
- **Everything else goes**, besides what 0045 already removed (signatures, disclaimers, quoted copies, "Sent from" lines, tracking and unsubscribe links):
  - meeting and calendar blocks: Teams, Zoom or Meet join links, meeting IDs, passcodes, dial-in numbers;
  - banners such as "[EXTERNAL]" or "You don't often get email from …";
  - reply and forward header blocks ("-----Original Message-----"), image and logo placeholders, social links.
- **Still clean, never summarize** (0045): a sentence the sender wrote is never shortened, merged or dropped. That includes a sentence about a meeting ("Let's meet Thursday at 10").

## Consequences
- **Amends 0045:** "one header per message (From, To, Date, Subject)" becomes one line with names and date.
- **The ingest** reads a capture whose messages start with `<sender> → <recipients> · <date>` (a heading) as an email, as it does today for From and Date lines.
- **Notion:** migration 0008 replaces the Clean email skill's text in Brain Assistant Skills. The migration for 0.5.0 becomes 0009.
- **Release:** 0.4.2.

## Evidence
- U-17, 2026-10-23: the user's feedback on the first cleaned thread.
- decisions/0045 (Clean email); notion/brain-assistant.md; eval/clean-email.
