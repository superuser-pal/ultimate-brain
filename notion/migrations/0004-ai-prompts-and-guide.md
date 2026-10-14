# 0004 · Notion AI prompts and the "How it works" page

**Design change:** CC-18 and CC-19 (decision 0035, notion/user-prompts.md, the user guide). **Applies to:** spaces built before this migration.

Notion-only: the brain never reads these pages or toggles.

## 1 · The "How it works" page
1. **By hand:** create a page **How it works** inside System (in the System callout on Home, if System is a callout rather than a page).
2. **Fill it:** ask your agent "publish the user guide to the How it works page". With your yes, it writes [the guide](../../skills/brain-howto/references/guide.md) into the page through the Notion API. Or paste the guide's Markdown into the page yourself.
3. When the guide changes in a later release, repeat step 2.

## 2 · "Ask how-to" in the navigation
Edit the synced Spaces navigation (on any Space; it updates everywhere): add a link to **How it works**, then a collapsed toggle **Ask AI** containing prompt 8 from [../user-prompts.md](../user-prompts.md).

## 3 · "Ask AI" toggles next to the views
By hand, on each page add a collapsed toggle **Ask AI** next to the view below, and paste the prompt into it:

| Page | Next to | Prompt |
|---|---|---|
| Home | "What's on today?" | 1 · What's waiting for me today? |
| Review | "What needs my decision?" | 2 · Walk me through the Review queue |
| Meetings | "Which minutes need review?" (To review tab) | 3 · Review these minutes |
| Meetings | "What's coming up?" (Upcoming tab) | 4 · Prepare me for this meeting |
| Plan | top of the page | 5 · Weekly review |
| Plan | "Which projects serve each goal?" | 6 · Check my plan |
| Knowledge | "What's in my inbox?" (Inbox tab) | 7 · Tidy this capture |

Prompts 3, 4 and 7 run on an open record (a meeting or a capture): copy them from the toggle, open the record, then run Notion AI there.

## Verify
- [ ] "How it works" shows the guide, starting with "Your second brain has three parts".
- [ ] The navigation on every Space shows How it works and an Ask AI toggle.
- [ ] Each of the seven toggles above holds its prompt, ending with the guard line from user-prompts.md.
- [ ] Run "What's waiting for me today?" on Home: it answers in chat and changes nothing.
