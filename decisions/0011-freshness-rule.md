# 0011 — Freshness rule

**Status:** Accepted
**Date:** 2026-10-11

## Decision
Every stored fact must be one of:
- **Timeless:** does not decay ("Invoices are issued monthly").
- **Dated:** a snapshot with a date ("2026-12-03: budget €80k"), or inside a dated note (meeting, log).
- **Pointer:** where the live value lives ("Task status: see Notion tasks"), optionally with a stamped last value.

Fast-changing facts (task status, counts, balances) live in their home system (Notion), and the brain stores a pointer.

A lint checks this. In **v1 it warns**. Once the format settles it becomes a hard rule (lint fails).

## Evidence
reviews/04-obsidian-second-brain.md (freshness policy, `freshness_lint.py`).
