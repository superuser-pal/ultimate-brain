# Prompt 9 — Notion Brain Assistant's skills and the How it works page

Before: [Prompt 7](07-spaces-views.md) (or the optional [Prompt 8](08-navigation.md)). Afterwards: "After building" in [../CHECKLIST.md](../CHECKLIST.md).

This puts on System what Notion Brain Assistant reads: the database **Skills** (Notion Brain Assistant's skills) with its eleven skills, and the user guide on **How it works** (docs/notion-space-design.md §5, §10). The published template carries both. Notion Brain Assistant itself (the Custom Agent, or personal Instructions) belongs to a workspace, not to a space, and no duplicate or build carries it: set it up afterwards, as "Setup" in [../brain-assistant.md](../brain-assistant.md) says and the page **First things first** lists (Prompt 1; docs/notion-space-design.md §10.1), selecting it in the three buttons that message it.

## 1 · The database (Notion AI)

Paste into Notion AI:

```text
On the page "System", create one full-page database named "Skills" with exactly two properties: Name (title) and Description (text). Do not add any other property, view or page. Do not create it on "Brain Data".
```

## 2 · The skills (your agent, or by hand)

Ask your agent: "publish Notion Brain Assistant's skills to Notion". With your yes, it creates one page in the Skills database per skill under "Skills" in [../brain-assistant.md](../brain-assistant.md), through the Notion MCP: the skill's name is the title, its **Description** line goes in Description, and its text block is the page body. Write minutes has no text block there: its body is the text block of [../minutes-format.md](../minutes-format.md), the minutes prompt, word for word, so the prompt has one source. Or create the eleven pages by hand from the same files.

## 3 · How it works (your agent, or by hand)

Ask your agent: "publish the user guide to the How it works page". With your yes, it writes the guide (the brain-howto skill's [references/guide.md](../../.agents/skills/brain-howto/references/guide.md)) into the page through the Notion MCP. Or paste the guide's Markdown yourself. When a release changes the guide, do it again.

## Verify
- [ ] "Skills" is on "System", not on "Brain Data", and has only Name and Description.
- [ ] It holds eleven pages, one per skill: Today, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Voice summary, Clean email, Write up, Refresh report, Write minutes; each has its Description filled and its text as the body (Write minutes' body is the minutes prompt of minutes-format.md).
- [ ] "How it works" shows the guide, starting with "Your second brain has three parts".
