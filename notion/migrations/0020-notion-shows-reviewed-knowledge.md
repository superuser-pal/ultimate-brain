# 0020 · Notion shows reviewed knowledge

**Design change:** decision [0071](../../decisions/0071-a-simpler-notion.md) §3; CC-125 (release 0.9.1; docs/notion-space-design.md §2; spec/cli.md §5.14.4 and §5.14.6). **Applies to:** spaces built or migrated before 0.9.1. Run 0017 first. A step already done changes nothing, so running this again is safe.

What changes: **Decisions, Questions, Concepts and Documents show only what you reviewed.** From 0.9.1 the brain gives a decision, question, concept or Document its page once you approve it in Review (or when it is reviewed from the start, as a whole Document is). Until then it is only in its Review row, whose page already holds its full wording, and a draft you reject never gets a page. People still arrive as Draft, because a meeting's Attendees needs their pages. Pages that already exist stay: a superseded decision or an answered question is history. The brain in Git keeps every draft.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API and the `brain` CLI, each with your yes;
- **by hand:** you, in Notion (the API can't edit views).

No property, option or database changes: nothing for Notion AI to do.

## 1 · Draft pages to the trash (agent, after your yes)

Draft pages made before 0.9.1 show each draft twice: as a Draft row and as an item in its Review row. This step removes the Draft rows that a Review row still holds, so each comes back as a new page when you approve it.

1. Run an attended `brain sync` up to its apply first, so a Lifecycle you set in Notion (a Draft you marked Reviewed, say) is read before anything is trashed.
2. Run `brain sync render --unpublish-drafts`. It lists the pages of decisions, questions, concepts and Documents that are still `draft` **and** listed by a pending Review notes row. It leaves out a promoted Document (its page is yours), a draft no pending Review row holds (it keeps its page: nothing would bring it back), and every Reviewed, Disputed or Archived page.
3. Show the count per database with a few titles ("12 decisions, 7 questions, 3 Documents: Use Supabase for auth, …") and ask once.
4. After the yes, move each page to Notion's trash (`PATCH /v1/pages/{id}` with `in_trash: true`), then `brain sync record` each one with its item's `published`. The record removes the page from the note, so approving it later creates a fresh page. Commit in the brain: `notion: Draft pages moved to the trash`.

A no changes nothing: those pages stay until you decide them, and new drafts get no page either way. A page moved to the trash stays restorable for 30 days; a restored page is linked to its note again at the next `brain sync`.

## 2 · Views (by hand)

The API can't edit views ([../views-guide.md](../views-guide.md) §9).
- **Knowledge → Concepts:** delete the view **"Which concepts are drafts?"** (a space whose Concepts tab is gone already, after migration 0018, has nothing to do here).

Any other view of yours that filters Decisions, Questions, Concepts or Documents on Lifecycle is Draft now shows only the drafts from before 0.9.1 you kept: delete it or change the filter.

## What this migration doesn't do

- **No `brain.json` change**, and no property removed: Lifecycle stays on People, Decisions, Questions, Concepts and Documents (Draft, Reviewed, Disputed, Archived), since People still arrive as Draft and you can still set Disputed or Archived.
- **No brain edit by hand.** Notes keep their `lifecycle` in Git; only the page link (`notion`) of each trashed draft is removed, by `brain sync record`.
- **Archived pages stay**, including drafts you rejected before 0.9.1: they are in the Archive tab.

## Verify
- [ ] `brain sync render --unpublish-drafts` returns no item (every Draft page a Review row holds was trashed, or you said no).
- [ ] After the next ingest, a new decision appears only in its Review notes row, and no Draft row is added to Decisions.
- [ ] Approving that row and running "catch up" creates the decision's page as Reviewed, linked to its meeting.
- [ ] Rejecting a row's draft leaves no page in its database.
- [ ] A new person from a meeting still appears in People as Draft, listed in the meeting's Attendees.
- [ ] Knowledge → Concepts has no "Which concepts are drafts?" view.
