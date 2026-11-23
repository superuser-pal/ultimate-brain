# Pasting the minutes prompt

Decision 0079 makes the minutes Notion AI writes shorter and easier to skim: **In one line**, your **Quick follow-ups** (each with a small tag `[q1]`), the **Tasks for the brain**, then a few prefixed lines per subject (`Decided:`, `Open:`, `Concern:`, `Waiting on <name>:`, `Idea:`). The quotes behind each line and each subject's `Selection:` line move into a collapsed toggle **For the brain** at the end. No database changes: [migration 0023](migrations/0023-lean-minutes.md) replaces three texts, the Meetings template's gray line (its step 1) and the two below.

**Since 0.16.2 (decision 0106 §13)** the prompt lays the same minutes out to be scanned: each section is a heading followed by a divider (`## In one line` with its sentence below it, `## Quick follow-ups`, `## Tasks for the brain`, `## <Subject> [s1]`), and each line of a subject is a bullet, its prefix in bold (`- **Decided:** … [s1.i2]`). The items, tags, quotes and the For the brain toggle don't change. Migration 0029 has the step that replaces the prompt you keep; Check minutes changes with it. You paste the new prompt once.

1. **The minutes prompt.** Keep the text block of [minutes-format.md](minutes-format.md) where you can copy it, replacing any older one you kept. It runs in the Notion AI chat on each meeting page, not from Notion AI's settings: there, Notion AI replaced the transcript with the minutes (CC-193's release gate).
2. **Notion Brain Assistant's "Check minutes".** In the agent's Skills database, replace the text of **Check minutes** (in its Description; in the page body where your Skills pages keep it there) with the block in [brain-assistant.md](brain-assistant.md) (it now knows the lean shape and the For the brain toggle, and still checks earlier minutes). **Voice summary** does not change: voice notes keep their format.

## Running it on a meeting

1. **The transcript stays on the meeting page.** When Notion recorded the meeting, the transcript is in the meeting-notes block's **Transcript**. When you have a transcript from somewhere else, paste it into the page body under a heading, or inside a toggle, titled **Transcript** (see [Pasting a transcript](#pasting-a-transcript)). Never delete it or replace it: the minutes quote it, and the brain keeps only the transcript paragraphs your selection includes.
2. **Open the Notion AI chat on that page.** Paste the prompt, then this line on its own, and send:

   ```text
   Write the minutes on this page, below the transcript, and nothing else.
   ```
3. The minutes appear in the page body, below the transcript. If the transcript is gone, put it back above the minutes: restore an earlier version from Notion's version history (••• at the top right), or paste it again. Keep the minutes. Without the transcript, catch-up leaves the meeting Ready and tells you so.

**Verify:** summarise one meeting with the new prompt, as above. The summary starts with the heading **In one line** and a divider, with one sentence below them; each section's heading has a divider under it; each line of a subject is a bullet, its prefix (**Decided:**, **Open:** …) in bold; its quick follow-ups are checkboxes ending with `[q1]`, `[q2]`, …, every task and every line of a subject ends with a tag like `[s1.i2]`, and the page ends with a collapsed toggle **For the brain** holding the Attendees and Projects lines, a `Selection:` line per subject and one quote line per item. Ask Notion Brain Assistant to "check minutes" on it: it reports no line that blocks the meeting.

**One new habit:** before you set a meeting Ready, tick the quick follow-ups you've already done. Each one still unticked when the brain reads the meeting becomes a Task, with no due date. To keep one out of Tasks, tick it or delete it.

Nothing else changes: meetings summarised with an earlier prompt are still read exactly as before, so you don't need to regenerate them. Minutes from the 0.14.0 prompt (an "In one line:" paragraph, no dividers) keep turning unticked follow-ups into Tasks; in minutes from before 0.14.0 a quick follow-up never becomes a Task.

## Pasting a transcript

Since 0.17.0 (decision 0101 §8) a meeting needs no Notion AI. A Meetings row holds a transcript, minutes in the format, or both, from any tool ([docs/meetings-from-other-tools.md](../docs/meetings-from-other-tools.md)). To paste a transcript:

1. Open the meeting's page (New meeting on Home, or a new row in Meetings) and leave its Brain Status **New**.
2. Type a heading **Transcript** (or make a toggle titled **Transcript**) and paste the transcript under it, or inside the toggle. The title is what tells the brain the text is a transcript (spec/capture-and-review.md §3.4.1).
3. Leave the rest to your agent, or run the prompt yourself (below). Pasted text with no **Transcript** title is read as a summary: an attended session asks you once whether it is a transcript or a summary.

**Your agent writes the minutes** when a New meeting has a transcript and no minutes: Claude Code or Codex offers it in your next catch-up ("2 meetings have a transcript and no minutes: write them?"), and a scheduled catch-up writes them without asking. It uses this same prompt, checks every quote against the transcript before it writes, and writes on a page once, below the transcript, changing nothing else (spec/capture-and-review.md §3.4.2). You then read the minutes, correct any line, mark **Meeting only** what stays out, tick the quick follow-ups already done, and set the meeting **Ready**. To have them written now, say "write the minutes for <meeting>".

## In another tool

You can run the minutes prompt in another AI tool (ChatGPT, Claude, your notetaker's own AI) and paste the result on the meeting page:

1. Copy the text block of [minutes-format.md](minutes-format.md) whole.
2. In the other tool, paste the prompt, then the transcript, and ask for the minutes. Ask for Markdown, so the headings, checkboxes and the **For the brain** toggle survive the paste.
3. On the meeting page, keep the transcript under its **Transcript** heading or toggle, and paste the minutes below it. Never paste the minutes over the transcript: the minutes quote it.
4. **Make the toggles.** A paste turns Markdown headings, dividers and checkboxes into Notion blocks, but may not turn text into a toggle. If the **For the brain** lines, or a task's **Scope** lines, landed as plain lines: on a new line above them type `>` and a space, which makes a toggle, title it exactly as the prompt says, and drag the lines into it. Letting your agent write the minutes skips this step.
5. Check what landed, as **Verify** above says. The brain reads minutes in the format the same way whatever wrote them; minutes that aren't in the format are taken in whole, with no choice of what enters the brain.

Never let the other tool create Tasks from the meeting: the brain creates them once, when it takes the meeting in (decision 0101 §5).
