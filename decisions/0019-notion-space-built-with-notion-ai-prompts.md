# 0019 — The Notion space is a duplicable template, built with Notion AI from our prompts

**Status:** Accepted
**Date:** 2026-10-11

## Decision
- The Notion space is designed as a **duplicable product template** that also serves as the author's own workspace (0014).
- The user builds it with **Notion AI**. The product ships, alongside the space design, a sequence of **Notion AI build prompts** (one per database or Space, in dependency order) plus a verification checklist, so a new user or the author can recreate it.
- The design follows the hub-and-spoke pattern in docs/notion-space-architecture.md (backend page with all databases, Spaces with linked views only, two-tier synced navigation).

## Consequences
Database and property names in the prompts must match `brain.json` defaults and the schema spec exactly, since the agent reads and writes them through the Notion MCP (0015).
