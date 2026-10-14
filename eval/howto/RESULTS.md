# Results

## 2026-10-14 · guide at PR #67 · 5/5

Blind run: a fresh general-purpose agent, given only the guide and the questions, no tools beyond reading the guide. Answers, verbatim except for line wrapping:

1. **Pass.** "Marking it Reviewed doesn't trigger anything by itself. The brain reads the meeting only when you tell your agent "ingest my reviewed meetings". After that the meeting is set to Ingested: new notes arrive as Draft, changes to things the brain already knew go to Review, and action items become Tasks (To Do). The guide doesn't say whether this ever runs automatically."
2. **Pass.** "The brain rewrites a project's Brief and Decision log on every sync, so anything you type inside them is lost. Put your notes in the My notes section of the project page. Everything else on the page outside Brief and Decision log is yours too."
3. **Pass.** "Open the row in Review → Sources disagree (it's a Contradiction row). Set Decision to Edit and type the real number in Edited Value. Then tell your agent "apply my reviews". Your value becomes the truth, and the row moves to Approved."
4. **Pass.** "Meetings dated in the future stay in Meetings → Upcoming until their date has passed. You don't need to do anything: it moves to To review after that date."
5. **Pass.** "No. Waiting On is one of your statuses (along with Doing, Someday and Done), and the brain never reads it, so it won't change it back or act on it. Status is a property you own, which the brain never overwrites."

Note from answer 1: the guide could say explicitly that ingest never runs on its own. Added in the same PR.
