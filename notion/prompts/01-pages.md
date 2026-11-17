# Prompt 1 — Pages

Paste into Notion AI on a new, empty teamspace page. Next: [Prompt 2](02-databases.md). First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md), "Choose your modules").

```text
Ignore the module names in square brackets at the start of lines.
Create a top-level page named "Ultimate Brain". Inside it create these pages, in this order:
"First things first"
"Home"
[Tasks] "Tasks"
"Meetings"
"Projects"
[Planning] "Plan"
"Knowledge"
"Brain Data"
"System"
Inside "System" create two pages: "Archive" and "How it works".
At the top of "Ultimate Brain", above these pages, add a callout with Notion's default icon and four lines. Line 1, in bold: "Start here." Line 2: "This is the Notion half of Ultimate Brain. Next: install Ultimate Brain, and in your brain folder tell your agent "set up my brain". Get started shows every step." Line 3: "Then open First things first: create your own Brain Assistant and select it in its buttons." Line 4: "Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits."
Leave the pages empty for now. Do not add any databases yet.
```

**By hand:** link the words "Get started" in the callout to the **Get started** section of the Ultimate Brain README on GitHub, the words "First things first" to the page "First things first", and the words "Notion credits" to Notion's help page on them, https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents (Custom Agents run on credits, which only Business and Enterprise can buy; decision 0101 §7). Then fill **First things first** (decision 0103 §1): paste the checklist of [docs/notion-space-design.md](../../docs/notion-space-design.md) §10.1 into it as to-do blocks, with its three links, and add a link to it as the first line of the page "System".

The published template also has a line `Template version: NNNN`, in the System callout on its top page (docs/notion-space-design.md §10, decision 0085). Don't add it here: a space built from the prompts has no version line, so the brain records its version as unknown and never guesses one (spec/setup.md §9).

## Verify
- [ ] "Ultimate Brain" starts with the "Start here." callout, its "Get started", "First things first" and "Notion credits" linked, then contains the pages above, in that order (nine with every module; seven with neither Tasks nor Planning), and "System" contains "Archive" and "How it works".
- [ ] "First things first" holds the eight to-dos of §10.1, unticked, with their links; "System" starts with a link to it.
