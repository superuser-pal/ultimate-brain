Done: 2 meetings in, 1 skipped, 1 weekly tick applied, 1 Notion correction queued. The log line says `waiting=9`, but `proposal list --waiting` now shows 7. I didn't amend the log. Lint reported no errors.

**What was written**
- **Meetings:** "Acme design review" (10 Dec) and "Acme content check-in" (12 Dec) were ingested as draft notes. That's 2 sources, 2 meeting notes and 1 open question, "Who approves the German copy?".
- **Proposals:** 3 are pending. They are the new grid as a dated line on Acme website, the launch date moving 2027-02 → 2027-03, and the notes for review.
- **Weekly row (2026-W51):**
  - C1, the aliases fix for Lena Hart, was applied.
  - C2 was stale because Mira Lund's note changed since the review, so it wasn't applied.
  - C3 has a note on its line, so it waits for a session.
  - C4 was unticked and stays open while C3 waits.
  - The row stays Ready.
- **Notion correction:** Maria López's Role changed to "Product lead" in Notion. It was queued as a pending correction and not applied.
- **Commits:** 4 commits, the last being `log: catch up (unattended)`.

**Publish**
- **Updated pages:** `settings.publish` is `auto`. 10 page updates, including both new meetings set to Done, were recorded with `sync record`. Each is a line in `writes.md`.
- **Creates:** there are 5 People creates, for Carlos, Lena, Mira, Otto and Ivo. They're in `writes.md` but not recorded, because the simulation gives no page ids to record. A real run would create them again, so check for duplicates.
- **Project People link:** the Acme website People link to Carlos is waiting on his page.

**Needs you**
- "Acme budget call" stays Ready because its Date is empty. Set the date, or say it's undated.
- C3's note, "only the short name, and Mira now leads the copy team", needs an attended session.
- 7 decisions are pending, including Maria's Role correction, the launch-date change and the new-grid line. Say "what needs my decision".

**Other**
- **Task not created:** Carlos's task to send the design tokens by 2026-12-17 isn't a task. Tasks is off and it's another person's commitment, so it only appears in the meeting note.
- **Not run:** Reports and Tasks are off.
- **Setup:** no `owner.person` is recorded, so the identities question is open. No backup remote is set, so nothing was pushed.
