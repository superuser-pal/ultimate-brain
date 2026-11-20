# Bringing meetings from another tool

Since 0.17.0 your meetings don't need Notion AI (decision [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §8). The brain takes a meeting in from its row in your **Meetings** database, whatever wrote it: Notion AI meeting notes, another notetaker, an automation, you pasting, or a transcript file you drop. This page shows each way in, what to turn off in the other tool, and where the minutes come from.

A Meetings row needs:
- a **Name** and a **Date**;
- **Brain Status** New (or empty), until you have checked it;
- a **transcript**, **minutes in the format** ([notion/minutes-format.md](../notion/minutes-format.md)), or both.

Leave Attendees, Project and Area empty if the tool can't fill them: the brain fills them when it takes the meeting in. Never fill **Tasks**: see [Turn off the tool's own tasks](#turn-off-the-tools-own-tasks).

## Four ways in

| Way | Set up once | Each meeting |
|---|---|---|
| [Your notetaker's Notion integration](#your-notetakers-notion-integration) | Connect it to Notion and point it at your Meetings database | Nothing: the row appears |
| [An automation](#an-automation) | One automation (Zapier, Make, n8n) from the tool to Meetings | Nothing: the row appears |
| [Pasting](#pasting) | Nothing | Paste the transcript on the meeting page, under a **Transcript** heading |
| [A transcript file](#a-transcript-file) | Nothing | Drop the file in your drop folder's `meetings/` |

Setup asks where your transcripts come from and accepts several answers (docs/setup.md, step 1). It changes nothing in Notion for this: the answer only decides whether setup checks the Notion AI minutes prompt.

### Your notetaker's Notion integration

Use it only if it can write into **your Meetings database** (the one in Brain Data, under your space's top page). In the tool's Notion settings, connect your workspace, choose Meetings as the destination, and have it send the **transcript**. Its own summary can come too: see [Where the minutes come from](#where-the-minutes-come-from).

Integrations differ, so check yours against its own help. Two examples, checked 2026-11-20:
- **Granola** sends a note's summary, one note at a time, to a database Granola creates: you can't pick your Meetings database, and the help page doesn't mention sending the transcript ([Granola's help on Notion](https://docs.granola.ai/help-center/sharing/notion); it says the integration is on Granola's paid plans). A row in another database never reaches your brain: use an automation, paste, or export the transcript as a file instead.
- **Fireflies** lets you choose the Notion database, and can also save the full transcript, which its guide says needs Fireflies' Pro plan or higher ([Fireflies' guide to Notion](https://guide.fireflies.ai/articles/7891929161-how-to-integrate-fireflies-with-notion)). Choose your Meetings database and turn transcripts on.

After the first meeting arrives, open its row and check: the Name and Date are right, Brain Status is New or empty, and the transcript is on the page. If the transcript isn't under a heading or toggle titled **Transcript**, add the heading above it (type `## Transcript`).

### An automation

When the tool can't write into Meetings, an automation can. In Zapier, Make or n8n: the trigger is the tool's "new meeting" or "new transcript"; the action is Notion's "create a database item" (a page in a database) in your **Meetings** database, with:

| Meetings property | Set to |
|---|---|
| Name | the meeting's title |
| Date | the meeting's date |
| Brain Status | New, or leave it empty |
| Page content | a heading **Transcript**, then the transcript text |

Set nothing else. Run it once on a real meeting and open the row: the whole transcript must be on the page, under its **Transcript** heading.

### Pasting

Open the meeting's page (**New meeting** on Home, or a new row in Meetings), type a heading **Transcript** and paste the transcript under it. [notion/pasting-the-minutes-prompt.md](../notion/pasting-the-minutes-prompt.md#pasting-a-transcript) has the steps. Without the **Transcript** title, the pasted text is read as a summary: your next session asks you once whether it is a transcript or a summary.

### A transcript file

Put the file in the **`meetings/`** folder inside your drop folder (by default `~/Documents/brain-dropbox/meetings/`; create the folder if it isn't there). A caption file (`.vtt` or `.srt`) can also go straight in the drop folder. The next catch-up makes a Meetings row from it, with:
- **Name and Date from the file name.** Start the name with the date: `2026-11-20 Kickoff with Example Co.vtt` becomes "Kickoff with Example Co" on 20 November 2026. Without a date, the Date is the day the file was last changed.
- **The transcript** in a toggle titled **Transcript**, one paragraph per speaker turn for a caption file.

The file then moves to the drop folder's `processed/`, and the same file never makes a second row (spec/capture-and-review.md §3.4.3). In an attended session you can also mark any other file in the drop folder "meeting" when the catch-up lists what it found.

## Turn off the tool's own tasks

Only the brain creates a meeting's Tasks: once, when it takes in a meeting you set Ready (decision 0101 §5). If your notetaker or automation also sends action items or tasks into Notion, **turn that export off for your brain's Tasks database**, or each task would arrive twice. A task the tool created anyway stays yours: the brain doesn't read it as the meeting's, and doesn't remove it.

## Where the minutes come from

| What's on the page | What happens |
|---|---|
| A transcript, no minutes | **Your agent writes the minutes.** Claude Code or Codex offers it in your next catch-up ("2 meetings have a transcript and no minutes: write them?"); a scheduled catch-up writes them without asking. It uses the same minutes prompt, checks every quote against the transcript first, writes once below the transcript and changes nothing else on the page. To have them written now: "write the minutes for <meeting>". |
| Minutes you made with the prompt in another tool | Taken as they are, with the same choice of what enters the brain as Notion AI's ([In another tool](../notion/pasting-the-minutes-prompt.md#in-another-tool)). Keep the transcript on the page: the minutes quote it. |
| The tool's own summary, not in the format | Taken in whole when you set the meeting Ready, with no choice of what enters the brain. If the transcript is on the page too, your agent can still write minutes in the format, and those are what the brain reads. |

The agent writes minutes only on a meeting whose Brain Status is New; on a page where it already wrote them once, only when you ask again.

## Then: your review

Open the meeting, read the minutes, correct any line, mark **Meeting only** on what stays out of your brain, and tick the quick follow-ups you've already done. Then set Brain Status to **Ready**. The next catch-up takes it in: your notes, and a Task for each follow-up you didn't tick and each task in the minutes. Nothing from the meeting enters your brain before you set it Ready.
