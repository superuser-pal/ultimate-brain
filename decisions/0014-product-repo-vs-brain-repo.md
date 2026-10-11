# 0014 — Product repo vs brain data repo

**Status:** Accepted
**Date:** 2026-10-11

## Context
The system is meant to become a product ("ultimate second brain") for other solo knowledge workers. claude-obsidian enforces a strict split between product code and user vault data.

## Decision
- **Product repo (`ultimate-brain`, this repo):** skills, CLI, schema spec, templates, Notion space template, docs, tests. Contains no personal knowledge.
- **Brain repo (one per user, private):** the user's notes, `brain.json`, generated index and log, proposals. Created from the product's template by a setup command (`brain init`).
- The product never writes into itself as a brain; the CLI resolves the brain location explicitly (flag, env var, or global config) and fails if none is set.

## Built to scale to a product
- **Versioned schema:** each brain records `schema_version` in `brain.json`; the product ships migrations between versions (dry-run first).
- **Template-driven setup:** `brain init` creates a new brain and `brain link` connects a repo, so a new user needs no manual file copying.
- **Config, not code, per user:** Notion database IDs, owner name, areas and budgets live in `brain.json`, never hardcoded.
- **Plugin packaging:** skills packaged as a Claude Code plugin and as Codex/Agent Skills (`.agents/skills/`), from one source.
- **No personal data in the product repo or its tests;** fixtures are synthetic.
- **Clear upgrade boundary:** product-owned files in a brain (e.g. AGENTS.md template sections) are separated from user-owned content so upgrades never overwrite user notes (pattern from obsidian-mind's infrastructure vs user-content split).

## Evidence
reviews/01-claude-obsidian.md (product/vault separation), reviews/03-obsidian-mind.md (infrastructure vs user content, upgrade path), reviews/04-obsidian-second-brain.md (adapter pattern).
