# 0013 · Selected capture, editable Review, Won't Do, optional Domains

**Design change:** CC-77, CC-79, CC-80, CC-81, decision 0055 (docs/notion-space-design.md §3.18; spec/capture-and-review.md §10; cli.md §5.14.2, §5.14.3, §5.22–§5.27). **Applies to:** spaces that ran migration 0012 (release 0.8.0). A space migrated from an earlier release runs 0010, 0011 and 0012 first. Release 0.8.0.

What changes: a meeting summary and a voice note are written as subjects and items, and you leave out what shouldn't enter the brain; a Review row from a source becomes a page with a section per change, where you edit the exact wording, decide change by change and click **Submit decisions**; **Won't Do** closes a task without counting it as done; **Domains** are an optional way to group Areas. Everything here is additive: nothing is renamed or deleted, and Review rows already written keep the old way of deciding (Your call, What to fix) until they are done.

Run it after `brain upgrade` has put 0.8.0's CLI and skills in place. The brain writes the new Review layout only when `notion.review_sections` is `true` (set below, once Decided exists), so setting it back to `false` returns every new row to the old path.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **Notion AI:** a prompt you paste;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## 1 · Properties (agent)

| Change | Who |
|---|---|
| Review: add **Decided** (checkbox), **Accept all** (checkbox), **Decided at** (date, with time) | agent |
| Review · Your call: add the option **Request revision** (keep Approve, Reject and Fix; Fix is not renamed) | agent |
| Descriptions: Proposed "Short pointer to what is proposed. The exact text and your decision are in the page, in each change's section."; Decided, Decided at, Accept all "Owner: you, through the Submit decisions and Submit and accept all buttons. The brain clears them once it has applied your decisions."; Your call "Shortcut for the whole row (Approve or Reject, read without Submit). To decide change by change, use the sections in the page." | agent |
| *(Domains module)* Areas: add the relation **Domain**, two-way with Domains **Areas**; Orgs: add **Domains** (two-way, only with Orgs on) | agent |

Read each property back after writing it. Skip the Domains row with Domains off (it is off by default). **Only after Decided reads back**, the agent runs `brain config set notion.review_sections true`: from then on a new Review row from a source is written as a page with sections. Until then, and for every row published before, the old layout is kept.

## 2 · Domains (module on only)

**Notion AI** — paste this on the Brain Data page:

```text
Create a database "Domains" with: Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date). Add it under Brain Data. Change nothing else.
```

**By hand:** open Areas · Domain → edit relation → **Limit: 1 page** (T7: the relation can be limited in the UI; the API drops the limit silently). Then ask Notion AI: "In Home's Areas tab, group the Areas view by Domain, with a 'No domain' group, and show Domain on each area home." With Domains off, do none of this; nothing is required.

## 3 · Review: buttons and layout (by hand)

Database `•••` → Properties → **New property** → **Button**, action **Edit property** on **This page** ([../views-guide.md](../views-guide.md) §9):

| Property name | Button label | Action |
|---|---|---|
| Submit | **Submit decisions** | Decided → checked; Decided at → Now |
| Submit all | **Submit and accept all** | Decided → checked; Accept all → checked; Decided at → Now |

Page layout of Review (Customize layout): heading **Submit, Submit all, Your call, What to fix, About Page**; main group **Decided, Decided at, Accept all, Type, Now, Proposed, Why, About, Area, Source Meeting**. In the "What needs my decision?" view add the Decided column. Replace the gray paragraph above the tabs with the one in [../prompts/07e-review.md](../prompts/07e-review.md). The first-use explanation on a new row is written by the brain at the top of each page, so it needs no template; for a row you create by hand, use the Review template of [../prompts/06-templates.md](../prompts/06-templates.md).

## 4 · Templates

**Notion AI** — paste on the Meetings database page:

```text
In the Meetings default template, add above the Notion AI meeting notes block a gray callout: "All subjects included unless marked Meeting only. Mark Reviewed to confirm." followed by a gray line "To leave a subject out, change its line to Selection: Meeting only. To leave one item out, write Meeting only: at its start. Nothing is added to the brain until you set Reviewed." Keep everything else in the template.
```

**Notion AI** — paste on the Inbox database page (the voice note is a second template, not the default; the Brain Status default stays New):

```text
Add a second page template to Inbox named "Voice note": Kind Capture, Brain Status New. Content: a gray callout "All subjects included unless marked Meeting only. Mark Ready to confirm. Creating the summary never creates a task." and a gray line "Record with your phone or Notion, paste the transcript into the Transcript toggle, then ask Brain Assistant: Voice summary."; a heading 2 "[s1] Voice note"; the line "Selection: Use in brain"; three empty heading 3s "Highlights", "Commitments", "Ideas to explore"; a toggle "Transcript" with one empty paragraph. Do not make it the default template.
```

Recording: the notes of a meeting and a recording started on the page put a readable transcript on it (T1, verified). If your Notion plan or device can't record, paste the transcript into the Transcript toggle or drop a transcript file in the drop folder. Whether a recording can be started by a template or a button was not tested and is not assumed.

Paste the new minutes prompt, [../minutes-format.md](../minutes-format.md), wherever you keep it for Notion AI (the old eleven-heading prompt is replaced).

## 5 · Brain Assistant (by hand)

Open the agent ([../brain-assistant.md](../brain-assistant.md) has the texts):
1. **Instructions:** replace them with the block under "Instructions" (the edit rule now lists Voice summary).
2. **Skills database:** change **Check minutes** (the new shape: subject ids, quotes, Selection lines), **Tidy capture** (stops on a page with a Transcript or item ids) and **Clean email** (the same guard); add the page **Voice summary** (Description and body from brain-assistant.md). Eleven skills in all. Keep **Use automatically** on.

## 6 · Tasks: Won't Do and progress (CC-77)

1. **By hand:** add the status option **Won't Do** to the Tasks status property, in the **Complete** group next to Done (T8: the API puts it in To-do). Read the property back. With an external Tasks database, keep your own wording and set `notion.tasks.wont_do_status` in `brain.json` to it; add `notion.tasks.waiting_on_status` the same way if your "Waiting On" option has another name (both default to `Won't Do` and `Waiting On`).
2. **Notion AI:** replace the Projects · Task Progress rollup by the text formula of [../prompts/04-formula-rollup.md](../prompts/04-formula-rollup.md) (formula 5), and update every Tasks filter and the Areas · Due formula as in that prompt and [../prompts/07a-home.md](../prompts/07a-home.md) (Status is not Done and not Won't Do). Warning: a numeric filter or sort you built yourself on the old Task Progress rollup stops working and needs adjusting.
3. `brain status` notes (it is not an error) when the mapped status property lacks the option.

## 7 · The "How it works" page (by hand)

Replace its text with `skills/brain-howto/references/guide.md` as it is in 0.8.0 (new: "Choosing what enters the brain" and "Review rows with sections").

## After the migration

The first catch-up that finds a Review row without item sections reads it the old way. A row written by the new brain has sections; nothing already pending is rewritten. A published note that rests on content you later exclude is re-rendered in its eligible form at the next publish.

## Verify
- [ ] Review has Decided, Decided at and Accept all, and Your call has Request revision; **Fix still exists**. Each property shows its description in the property list.
- [ ] An **old Review row** with Your call = Fix and text in What to fix is still read as before by "apply my reviews". A row-level Fix or Request revision on a **new** row is refused with its message (`ROW_REVISION_NOT_SUPPORTED`).
- [ ] On a test Review page (made by `sync render` from a synthetic proposal), type `Accept` on one change, `Reject` on one, `Defer` on one and `Request revision` plus a `Revision request:` line on one; click **Submit decisions**: the agent reads each token, applies the first two, moves the third to a new row, and leaves the fourth pending with a new draft and a **Previous proposal** toggle. **Submit and accept all** accepts every change still on Pending and keeps explicit tokens.
- [ ] Each section explains its action in the page text ("What Accept does: …"), not only in a tooltip.
- [ ] A new Meeting shows the gray notice; a new Inbox row from "Voice note" starts at **New**, not Ready; nothing from it is ingested until you set Ready.
- [ ] A summary made with the new minutes prompt on a synthetic transcript has ids and quotes; marking one subject `Selection: Meeting only` and setting Reviewed leaves it out of the brain.
- [ ] (Domains) Areas · Domain is limited to 1 page; Home's Areas tab groups by Domain with "No domain". With Domains off none of this appears.
- [ ] A Won't Do task is excluded from every due view and reminder; eight Done and two Won't Do show `8 completed · 2 dropped`.
- [ ] Brain Assistant has eleven skills, including Voice summary; Tidy capture and Clean email stop on a page with a Transcript toggle.
- [ ] "How it works" matches the guide.
