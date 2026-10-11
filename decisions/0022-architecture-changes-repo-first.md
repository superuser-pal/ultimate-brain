# 0022 — Architecture changes happen in the repo first

**Status:** Accepted
**Date:** 2026-10-11

## Context
The Notion space and the brain schema will keep evolving (new databases, properties, views, note types). For users of the product, changes need one clear, AI-assisted path, versioned and repeatable, instead of ad-hoc edits in Notion.

## Decision
Every change to the **architecture** (the brain schema, the Notion space structure: databases, properties, options, relations, templates, views, navigation) is made **in the product repo first**, then applied to Notion.

1. **Change the spec:** edit the design (`docs/notion-space-design.md`, later a machine-readable spec) with an agent's help, reviewed like any other change, with a decision record when it clears the decision gate.
2. **Generate the change:** the repo produces the Notion AI prompts for just that change ("add property X to Projects"), plus the matching `brain.json` and schema updates.
3. **Apply in Notion:** the user runs the prompts with Notion AI (0019).
4. **Verify:** the agent checks the live Notion structure against the spec through the Notion MCP (0015) and reports any drift.

Direct structural edits in Notion are discouraged. If one happens, the drift check reports it and the fix is either reverting it or bringing it into the spec.

## Scope
Architecture only. Content (notes, facts, decisions) follows 0003 and 0021.

## Consequences
- Product updates ship as versioned "space migrations": a spec diff plus prompts, matching the schema versioning in 0014.
- The Notion AI prompts live in the repo, not in Notion.
- Later: a machine-readable space spec (e.g. `notion/space.yaml`) from which prompts, `brain.json` defaults and the drift check are generated.
