# 0015 — Notion access through the Notion MCP server

**Status:** Accepted
**Date:** 2026-10-11

## Decision
The agent (Claude Code / Codex) reads and writes Notion through the official **Notion MCP server**. No custom Notion API client in v1.

## Consequences
- Notion steps of the workflow (fetch reviewed meetings, publish notes, create Review rows, create tasks, set `ingested`) are agent tool calls guided by the skills; deterministic local steps (index, lint, IDs, applying proposals to Markdown) stay in the CLI.
- Each user authorizes the Notion MCP once in their agent. No API tokens stored in the brain.
- To watch: bulk publishing through MCP costs agent turns and tokens; unattended runs (n8n / Hermes, v2) need MCP auth that works headless. If either becomes a problem, add a small API client as a v2 option (docs/v2-ideas.md).

## Evidence
User decision 2026-10-11; synthesis §7.
