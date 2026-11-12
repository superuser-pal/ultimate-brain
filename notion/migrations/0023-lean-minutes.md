# 0023 · Lean minutes: the Meetings template's hint, Check minutes and the minutes prompt

**Design change:** decision [0079](../../decisions/0079-lean-minutes-and-follow-ups-as-tasks.md) §2–§4; CC-197 (release 0.14.0; docs/notion-space-design.md §9; spec/capture-and-review.md §3.3). **Applies to:** every space built or migrated before 0.14.0. A step already done changes nothing, so running this again is safe.

What changes: from 0.14.0 Notion AI writes lean minutes. You get a short summary you can skim, and the quotes behind each line and each subject's `Selection:` line go into a collapsed toggle **For the brain** at the end. A quick follow-up you haven't ticked when you mark the meeting Reviewed becomes a Task. Three texts change to match:
- the gray line under the notice in the Meetings default template, which told you to write `Meeting only:` at the start of an item. In lean minutes that token goes in the For the brain toggle, and written on a summary line it blocks the meeting;
- Brain Assistant's **Check minutes**;
- the minutes prompt you paste into Notion AI.

No database, property, view or button changes. Meetings already summarised keep their text and are read as before; only new meetings use the new shape.

Who does each step:
- **Notion AI:** you paste the prompt on the Meetings database page;
- **by hand:** you, in Notion.

## 1 · The Meetings template's hint (Notion AI)

Paste on the Meetings database page:

```text
In the Meetings default template, find the gray line under the gray callout "All subjects included unless marked Meeting only. Mark Reviewed to confirm." (it starts "To leave a subject out"). Replace that line's text with exactly: "Tick the quick follow-ups you've done: the ones left unticked become Tasks when you set Reviewed. To leave a subject out, open For the brain and change its line to Selection: Meeting only. To leave one item out, write Meeting only: at the start of its quote line there. Nothing is added to the brain until you set Reviewed." Keep it gray. If the template has the callout but no such line, add the line under the callout. If the template has neither, change nothing and tell me. Keep everything else in the template.
```

**By hand, without Notion AI:** open Meetings → **New** ▾ → the default template's **⋯** → **Edit**, and replace the gray line's text with the text in quotes above.

## 2 · Brain Assistant's Check minutes (by hand)

Open the agent; [../brain-assistant.md](../brain-assistant.md) has the text. In its **Skills** database, replace the body of **Check minutes** with the block under that heading. It now checks lean minutes and still checks earlier ones. Keep **Use automatically** on. The Instructions and the other skills don't change; **Voice summary** stays as it is.

## 3 · The minutes prompt (by hand)

Copy the text block of [../minutes-format.md](../minutes-format.md) and paste it wherever you keep your meeting-summary prompt for Notion AI, replacing the old one ([../pasting-the-minutes-prompt.md](../pasting-the-minutes-prompt.md)).

## 4 · Template version (by hand, or the agent)

If the first line of your **System** page reads `Template version: …` with a lower number, change it to `Template version: 0023`. A space without that line has none to change.

## Verify

- [ ] A new page from the Meetings default template shows the new gray line, starting "Tick the quick follow-ups you've done".
- [ ] Summarise one meeting with the new prompt: it starts with "In one line:", its quick follow-ups end with `[q1]`, `[q2]`, …, every task and every line of a subject ends with a tag like `[s1.i2]`, and the page ends with a collapsed toggle **For the brain**.
- [ ] Ask Brain Assistant to "check minutes" on it: it says the minutes are in the lean format and reports no line that blocks the meeting.
