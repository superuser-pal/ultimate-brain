# 0004 · Brain Assistant and the "How it works" page

**Design change:** CC-18 and CC-19 (decision 0035, [../brain-assistant.md](../brain-assistant.md), the user guide). **Applies to:** spaces built before this migration.

Notion-only: the brain never reads the agent, its skills or the guide page.

## 1 · The "How it works" page
1. **By hand:** create a page **How it works** inside System (in the System callout on Home, if System is a callout rather than a page).
2. **Fill it:** ask your agent "publish the user guide to the How it works page". With your yes, it writes [the guide](../../skills/brain-howto/references/guide.md) into the page through the Notion API. Or paste the guide's Markdown yourself.
3. When the guide changes in a later release, repeat step 2.

## 2 · Brain Assistant
Follow "Setup" in [../brain-assistant.md](../brain-assistant.md): the Custom Agent, its Tools and access (Brain Data, How it works, the skills database), its Instructions, and the seven skills.

## Verify
- [ ] "How it works" shows the guide, starting with "Your second brain has three parts".
- [ ] Brain Assistant's Tools and access lists only Brain Data, How it works and Brain Assistant Skills.
- [ ] `/Today` in its chat lists only Ultimate Brain tasks, and changes nothing.
- [ ] "How do I approve a change?" answers from How it works.
