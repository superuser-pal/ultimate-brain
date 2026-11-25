I did only the read-only pass. I applied, ingested, published and committed nothing, and `writes.md` is still empty. This is the batch:

---

Since last time: 1 scheduled run, 2 inputs in, 1 skipped, 7 decisions waiting.
This week's review is ready: 4 clean-up items to tick (reports/2026-12-14-weekly-review.md).
7 decisions wait: I'll ask them at the end.

**Week of 14 Dec 2026** (you set it Ready)
- **C1** (Lena Hart) is already applied.
- **C2** (Mira Lund) was ticked but not applied. Mira's note changed after the review, so that item is closed.
- **C4** (Ivo Brand) isn't ticked. It will be declined once nothing else in the row is waiting. If you leave C3 for later, C4 stays open too.

**Acme design review** (10 Dec) and **Acme content check-in** (12 Dec) are already in the brain. Their page text matches the saved minutes, so there's nothing to ask before the run. If you publish, they'll be set to Done.

**Questions**

**Acme budget call**

1. The meeting has no date. When was it?
   **Default:** skip it for now. It stays Ready.

**Week of 14 Dec 2026**

2. **C3** · Remove a repeated value from Otto Kern's aliases: `["Otto","Otto"] → ["Otto"]`.
   Your note: "only the short name, and Mira now leads the copy team"
   I read it as two separate things:
   - **Otto:** "only the short name" agrees with the change shown, so I'd apply C3 and keep one "Otto".
   - **Mira:** "Mira now leads the copy team" isn't part of C3. I take it to mean Mira Lund. Their note says they review page texts and check the footer, and I saw nothing there about leading a copy team. I'd write this as a separate proposed addition to their note, citing your words, and ask you about it before the note changes. It wouldn't reopen C2 or replace anything in the note.

   **Default:** apply C3 as shown, and propose the Mira addition separately for you to decide. You can also answer "C3 only", or "leave it", which keeps C3 pending and does nothing about Mira in this run.

**Setup**

3. Where is your drop folder, the one where you put files for the brain? If you give me a path, I'll ask before saving it to "My rules" and show you its files before taking any in.
   **Default:** skip the drop folder this time.
4. Which names and work email addresses do you appear under in meetings, documents and emails? Your answer approves adding them as your aliases.
   **Default:** skip for now. I'll ask again at the next catch-up.

**Publishing**

5. Publish to Notion at the end?
   **Default:** yes.

Reply "go" to accept all the defaults, or answer by number, for example "1: 11 Dec, 2: C3 only".

---

**What I checked**
- **Sync plan:** it found no conflicts, new corrections, report requests or accepted text to import. Maria López's role change from Notion is already among the 7 waiting decisions.
- **For the final report:** the Project you changed on "Row-level security" in Notion can't be changed by editing it there. It isn't a question in this batch.
- **Other work:** the older-notes backlog has nothing to add, and no repos are linked. I didn't check any drop-folder files because no folder is set.
- **Two ingested meetings:** I compared their text by eye and didn't run the duplicate-check dry run.
- **Lint:** it reported 0 errors and 4 warnings, all for people notes that nothing links to. It also noted that the skills aren't pinned to a version.

The next step is your answer to the batch. As this test requires, I've stopped here.
