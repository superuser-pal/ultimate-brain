# Prompt 1 — Pages

Paste into Notion AI on a new, empty teamspace page. Next: [Prompt 2](02-databases.md). First delete the lines of modules you didn't choose ([CHECKLIST](../CHECKLIST.md), "Choose your modules").

```text
Ignore the module names in square brackets at the start of lines.
Create a top-level page named "Ultimate Brain". Inside it create these pages, in this order:
"Home"
[Tasks] "Tasks"
"Meetings"
"Projects"
[Planning] "Plan"
"Review"
"Knowledge"
"Brain Data"
"System"
Inside "System" create two pages: "Archive" and "How it works".
At the top of "Ultimate Brain", above these pages, add a callout with Notion's default icon and two lines. Line 1, in bold: "Start here." Line 2: "This is the Notion half of Ultimate Brain. Next: install Ultimate Brain, and in your brain folder tell your agent "set up my brain". Get started shows every step."
Leave the pages empty for now. Do not add any databases yet.
```

**By hand:** link the words "Get started" in the callout to the **Get started** section of the Ultimate Brain README on GitHub.

The published template's System page also starts with a line `Template version: NNNN` (docs/notion-space-design.md §10). Don't add it here: a space built from the prompts has no version line, so the brain records its version as unknown and never guesses one (spec/setup.md §9).

## Verify
- [ ] "Ultimate Brain" starts with the "Start here." callout, its "Get started" linked, then contains the empty pages above, in that order (nine with every module; seven with neither Tasks nor Planning), and "System" contains "Archive" and "How it works".
