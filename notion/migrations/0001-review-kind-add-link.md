# 0001 · Review → Kind gets the option "Add Link"

**Design change:** decision 0028 (`add_link` proposals), PR #30. **Applies to:** spaces built before PR #30 merged (2026-10-12).

## By hand (recommended)

Notion AI can add select options with an internal id that another option already uses. Deleting one of them later deletes both. That happened once with Add Link and Supersede. So add this option by hand:

1. Open the **Review** database, click the **Kind** header → **Edit property**.
2. **Add an option** → `Add Link` → Enter.
3. Leave every other option as it is. **Don't delete and re-add an option to "fix" it**; if something looks wrong, run the check first.

## Verify

Ask the agent to "check my Notion space" (`brain-notion-change`, Check mode). Review → Kind must list exactly these seven options, each with its own id: Update Fact, Add To Note, Add Link, Supersede, Contradiction, Merge, New Item.
