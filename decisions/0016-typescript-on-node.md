# 0016 — TypeScript on Node for the CLI and scripts

**Status:** Accepted
**Date:** 2026-10-11

## Context
The local code is small and deterministic: ID generation, frontmatter parsing/validation, index/log/view rebuilding, lint, applying approved proposals, `brain init` / `brain link`, schema migrations. Notion access is handled by the agent through MCP (0015).

## Decision
TypeScript on Node, run directly without a build step where possible, with minimal dependencies (a YAML parser, an ID generator). Distributed so a new user can run `npx ultimate-brain init`.

## Why
Every Claude Code and Codex user already has Node (both install via npm), so there is no extra install step for future customers. Same language for a v2 MCP server and a possible hosted product.

## Evidence
reviews/03-obsidian-mind.md (zero-dependency TypeScript hooks run directly by Node).
