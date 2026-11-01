Done: 1 Document adopted from Notion · 23 pages published · 1 related-knowledge proposal written
Needs you: 4 Review rows (Login page related knowledge, Acme kickoff notes, Acme sync notes, Acme mobile app relaunch)
Next: decide them in Notion, then "catch up"

**What came in**
- **Login page** (Document, promoted from "Use Supabase for auth"). It was published before 0.8.0, so Git had no stored baseline to compare it against. You had accepted it in Notion and chose to keep Notion's text, so that text is now the brain's copy, character for character. I read the page again just before importing and it hadn't changed. Both baselines are now stored, so next time the brain can tell who changed what. The change, +12 / −2 lines:
  ```diff
  -## Why
  +> 💡 Purpose: decide how people sign in to the Acme website.
  -We need one login for the website and the app.
  +## Main content
  +
  +Email login only for launch; social login after launch.
  +
  +## Open questions
  +
  +- Who owns the password-reset emails?
  +
  +## Sources
  +
  +- [Use Supabase for auth](../decisions/2026-12-03-use-supabase-for-auth.md)
  ```
  The old Git line "We need one login for the website and the app." is no longer in the Document. It is still in Git history.

**What changed**
- I unticked Accepted and cleared Accepted at on the Login page, after checking again that nothing had changed.
- Proposal **"Login page: related knowledge"** (pending). It would add a "Related knowledge" section linking the Acme sync meeting, "Use Firebase for auth" (superseded), "Row-level security" and the Acme website project.
- Published 18 pages in a first pass and 5 more once their links could be filled in:
  - **New pages:** Carlos Ruiz, both auth decisions, Row-level security, and three Review rows (two Review notes rows and the related-knowledge one).
  - **Updated:** the Clients area and Acme website project Briefs (plus the project's Decision log), Maria, Acme, the open question, four existing Review rows and the two meetings' links.
- Nothing was waiting in Meetings, the Inbox, Ask or Report rows, the drop folder or linked repos, and there were no older notes needing Review rows. The Tasks module is off.

**Check**
- The Login page body was not written to Notion. Bodies of promoted Documents are only written when the page is created, and Notion already has this exact text.
- The Login page is still a `draft`. "Use Supabase for auth", Carlos Ruiz, Row-level security and the open question are drafts too.
- The machine's clock says 2026-11-01, but the Notion timestamps are from 2026-12-14. Dates the brain stamped this run (`updated:`, the log) use 2026-11-01.
- Simulated Notion writes went to `adopt-sim/writes.md`. New pages got made-up page ids, and those ids are now stored in the brain.

The run took about 141 seconds and read the full text of 6 notes. It made 4 commits. The push failed because this repo has no remote, so all 4 commits are only local.
