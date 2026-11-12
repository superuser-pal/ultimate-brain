# Pasting the 0.14.0 minutes prompt

Decision 0079 makes the minutes Notion AI writes shorter and easier to skim: **In one line**, your **Quick follow-ups** (each with a small tag `[q1]`), the **Tasks for the brain**, then a few prefixed lines per subject (`Decided:`, `Open:`, `Concern:`, `Waiting on <name>:`, `Idea:`). The quotes behind each line and each subject's `Selection:` line move into a collapsed toggle **For the brain** at the end. No database changes: [migration 0023](migrations/0023-lean-minutes.md) replaces three texts, the Meetings template's gray line (its step 1) and the two below.

1. **The minutes prompt.** Copy the text block of [minutes-format.md](minutes-format.md) and paste it wherever you keep your meeting-summary prompt for Notion AI, replacing the old one.
2. **Brain Assistant's "Check minutes".** In the agent's Skills database, replace the body of **Check minutes** with the block in [brain-assistant.md](brain-assistant.md) (it now knows the lean shape and the For the brain toggle, and still checks earlier minutes). **Voice summary** does not change: voice notes keep their format.

**Verify:** summarise one meeting with the new prompt. The summary starts with "In one line:", its quick follow-ups are checkboxes ending with `[q1]`, `[q2]`, …, every task and every line of a subject ends with a tag like `[s1.i2]`, and the page ends with a collapsed toggle **For the brain** holding the Attendees and Projects lines, a `Selection:` line per subject and one quote line per item. Ask Brain Assistant to "check minutes" on it: it reports no line that blocks the meeting.

**One new habit:** before you mark a meeting Reviewed, tick the quick follow-ups you've already done. Each one still unticked when the brain reads the meeting becomes a Task, with no due date. To keep one out of Tasks, tick it or delete it.

Nothing else changes: meetings summarised with an earlier prompt are still read exactly as before, and their quick follow-ups never become Tasks, so you don't need to regenerate them.
