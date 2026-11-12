# Prompt 9 — Brain Assistant's skills and the How it works page

Before: [Prompt 7](07-spaces-views.md) (or the optional [Prompt 8](08-navigation.md)). Afterwards: "After building" in [../CHECKLIST.md](../CHECKLIST.md).

This puts on System what Brain Assistant reads: the database **Brain Assistant Skills** with its eleven skills, and the user guide on **How it works** (docs/notion-space-design.md §5, §10). The published template carries both. Brain Assistant itself (the Custom Agent, or personal Instructions) belongs to a workspace, not to a space: set it up afterwards, as "Setup" in [../brain-assistant.md](../brain-assistant.md) says.

## 1 · The database (Notion AI)

Paste into Notion AI:

```text
On the page "System", create one full-page database named "Brain Assistant Skills" with exactly two properties: Name (title) and Description (text). Do not add any other property, view or page. Do not create it on "Brain Data".
```

## 2 · The skills (your agent, or by hand)

Ask your agent: "publish Brain Assistant's skills to Notion". With your yes, it creates one page in Brain Assistant Skills per skill under "Skills" in [../brain-assistant.md](../brain-assistant.md), through the Notion MCP: the skill's name is the title, its **Description** line goes in Description, and its text block is the page body. Or create the eleven pages by hand from the same file.

## 3 · How it works (your agent, or by hand)

Ask your agent: "publish the user guide to the How it works page". With your yes, it writes the guide (the brain-howto skill's [references/guide.md](../../.agents/skills/brain-howto/references/guide.md)) into the page through the Notion MCP. Or paste the guide's Markdown yourself. When a release changes the guide, do it again.

## Verify
- [ ] "Brain Assistant Skills" is on "System", not on "Brain Data", and has only Name and Description.
- [ ] It holds eleven pages, one per skill: Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Voice summary, Clean email, Write up, Refresh report; each has its Description filled and its text as the body.
- [ ] "How it works" shows the guide, starting with "Your second brain has three parts".
