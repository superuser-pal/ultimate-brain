# Pasting the 0.9.0 minutes prompt

Decision 0067 changes what Notion AI writes in a meeting summary: **My actions** becomes two groups, **Quick follow-ups** (to-do checkboxes that stay in Notion) and **Tasks** (items with a **Scope** toggle), and quotes are kept short and copied exactly. The Meetings database and its template do not change, so there is no numbered migration: you only replace two texts.

1. **The minutes prompt.** Copy the text block of [minutes-format.md](minutes-format.md) and paste it wherever you keep your meeting-summary prompt for Notion AI, replacing the old one.
2. **Brain Assistant's "Check minutes".** In the agent's Skills database, replace the body of **Check minutes** with the block in [brain-assistant.md](brain-assistant.md) (it now knows the two groups and the Scope toggle, and says which quotes block). Do the same for **Voice summary**, whose quote rule was tightened too.

**Verify:** summarise one meeting with the new prompt. The summary shows *Quick follow-ups* with checkboxes and no ids, and *Tasks* whose every item has a *Scope* toggle with the lines Done when, Due, Project and Notes. Ask Brain Assistant to "check minutes" on it: it reports no checkbox as a blocker.

Nothing else changes: meetings summarised with the old prompt are still read exactly as before, so you don't need to regenerate them.
