# 0006 — Consuming repos get an explicit "consult the brain" block

**Status:** Accepted
**Date:** 2026-10-11

## Context
obsidian-mind measured that with the vault's MCP server wired but no instruction in the consuming repo's own CLAUDE.md, the agent made zero vault calls ("prohibitions propagate, routing instructions do not").

## Decision
Every repo where agents should use the brain gets a short block in its CLAUDE.md / AGENTS.md telling the agent the brain exists and when to consult it. A setup command installs and updates the block. A global skill alone is not relied upon.

## Evidence
reviews/03-obsidian-mind.md (Reaching the vault from another repo).
