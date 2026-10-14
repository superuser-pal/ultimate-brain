# Database templates: live snapshot and improvements

The default page templates as they exist in the live Notion space, plus the improvements we are working through one by one. Read this instead of pulling the templates from Notion each time. After you change a template in Notion, update its snapshot here in the same change.

- **Intent:** [docs/notion-space-design.md](../docs/notion-space-design.md) §4.
- **Build prompt:** [prompts/06-templates.md](prompts/06-templates.md).
- **Last pulled:** 2026-10-14, through the Notion API, read-only, after migration 0003. The API shows headings and linked views, not view tabs or filters; those are as built by hand from Prompt 6.

The API returns each linked view's title and URL, but not its filters, sorts or visible properties. The filters listed below are the ones Prompt 6 asked for; they have not been checked live.

Legend: `▦` linked view · `▸` toggle · `## ▸` toggle heading.

---

## Snapshot

### Areas · "Default Area" (default)
Template id `8d5150a7-2d19-417a-9625-b8a5d09aaafb`. Header shows the four "via projects" rollups (page layout).

```text
### What am I working toward here?   ▦ Goals       Area is this page, Status Active
### What's active here?              ▦ Projects    Active · Planned · Done
### What's on my plate here?         ▦ Tasks       Open · Waiting On · Done
### Which meetings?                  ▦ Meetings    Upcoming · Past
▸ My notes
```

### Goals · "Default Goal" (default)
Template id `37144e1e-546a-4357-bea7-66b621b93c33`

```text
### How are the key results moving? ▦ Key Results Open · Done
### Which projects serve it?         ▦ Projects
▸ My notes
```

### Projects · "Default Project" (default)
Template id `194938c3-a2c1-4594-a5ad-1b32ae02f7d7`

```text
## ▸ Brief           brain-written (0026)
## ▸ Decision log    brain-written (0026)
gray italic: "Brief and Decision log above are written by the brain. Add your own notes in My notes."
### What's on my plate here?         ▦ Tasks       Open · Waiting On · Done
### Which meetings?                  ▦ Meetings    Upcoming · Past
### What's still open here?          ▦ Questions   Status Open
### Who's involved?                  ▦ People
▸ My notes
```

### Meetings · "Default Meeting" (default)
Template id `06419666-b2c5-47f4-b349-fd4d1d802a1a`. Reworked by hand on 2026-10-13.

```text
ℹ️ callout (gray)
   ### Before marking Reviewed
   ---
   ☐ Attendees linked
   ☐ Project linked
   ☐ Minutes follow the format
   ☐ Minutes checked and corrected
🎙 Notion AI meeting notes block, titled "Meeting @Today"
▸ My notes           (empty)
▸ Decisions
   ▦ Decisions       Decided In is this page
▸ Questions
   ▦ Questions       Raised In is this page
▸ Tasks
   ▦ Tasks           Meeting is this page
(empty paragraph with a nested empty block)
```

### People · "Default Person" (default)
Template id `fa3d5f95-7647-4e54-8239-5605cd6de9ed`

```text
### Which meetings were they in?     ▦ Meetings    Upcoming · Past
### What are they working on?        ▦ Projects
▸ My notes
```

### Orgs · "Default Org" (default)
Template id `7a8cd951-14e9-4aba-a5b8-25df420f356d`. Header shows the "Meetings via projects" rollup (page layout).

```text
### Who works there?                 ▦ People
### Which projects?                  ▦ Projects
▸ My notes
```

### Decisions, Questions, Review, Key Results, Capture Inbox, Tasks
No template. This is intended: the brain writes the whole body of Decisions and Questions pages (0026), and the other databases are property-only.

---

## Improvements

Worked one at a time. Status: `open` · `agreed` · `done` (applied in Notion and the snapshot updated) · `dropped`. Decided in the CC-17 grill session on 2026-10-14; `agreed` items are applied by [migration 0003](migrations/0003-look-pass.md), after which the snapshot above is pulled again.

| # | Template | Problem | Proposal | Status |
|---|---|---|---|---|
| 1 | Meetings | The "Minutes format" callout (§9, Prompt 6b) isn't in the template. The checklist still says "Minutes follow the format", so the format has to live somewhere | Decide where the format lives now: in the AI meeting-notes block's instructions, or a callout again | dropped (template kept as is, 2026-10-14; the format stays in minutes-format.md) |
| 2 | Areas, People | Placeholder callouts print literal "[Summary]", "[Role]" and "[Org]". A callout can't show a property, and the page layouts already show these fields | Remove both callouts | done |
| 3 | Goals | The "Why" callout competes with the brain-owned Why property. Text typed in the callout never reaches the brain | Remove the callout, or replace it with a one-line hint pointing to the property | done: removed |
| 4 | Meetings | Tasks come last, but they're what you act on after a meeting | Order the toggles Tasks, Decisions, Questions | dropped (template kept as is) |
| 5 | Orgs | No Meetings view, although §4 lists "Meetings (through projects)". Notion can't filter through two relations | Add a direct Org relation on Meetings (a schema change, so a new decision), or drop it from §4 | done: Notion-only rollup "Meetings via projects" on Orgs, no schema change |
| 6 | Projects | Nothing on the page says the Brief and Decision log are written by the brain, so your edits there are overwritten on the next sync | Add one muted line under Brief: "Written by the brain. Add your own notes in My notes." | done: gray line after Decision log (the API can't insert above Brief) |
| 7 | All | Linked views named after the database ("Meetings", "Projects", "People") are hard to scan on a long page | Name them by the question they answer, as the Spaces do | done: question-named H3 headings |
| 8 | Meetings | A stray empty paragraph with a nested empty block at the end of the page | Delete it | dropped (template kept as is) |
| 9 | Meetings | The design (§4) and Prompt 6 don't describe the reworked template (checklist callout, AI meeting-notes block, views in toggles) | Update §4 and Prompt 6 to match, once 1, 4 and 8 are settled | done (§4 and Prompt 6 describe the reworked template) |
