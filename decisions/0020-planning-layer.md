# 0020 — Planning layer in v1: Goals and Key Results

**Status:** Accepted
**Date:** 2026-10-11

## Context
Planning is a key part of a second brain for the target user (solo knowledge workers), so it moves from "later" into v1.

## Decision
1. **Two planning databases:** Goals, and Key Results. A key result is either a **Number** (start / current / target, unit) or a **Milestone** (done / not done), set by a `Kind` property. Goal progress combines its key results.
2. **Split ownership:**
   - The **brain** holds a goal's meaning: statement, why, area, deadline (with `timeline:` history, 0010), linked projects, and supersession when a goal is replaced. Agents and meeting ingests use it; a deadline change heard in a meeting becomes a review row (0003).
   - **Notion** holds progress: key result current values, milestone ticks, progress %. The brain stores these only as pointers or dated snapshots (0011), never as live copies, and never writes them.
3. Brain note type `goal` (prefix `gol`). Key results stay Notion-owned rows; the goal note keeps a dated snapshot of their names and targets, refreshed on sync.

## Evidence
docs/easlo-second-brain-architecture.md (Goals + Key Results), docs/ultimate-brain-for-notion-factual-architecture-appendix.md (Goals + Milestones), user decision 2026-10-11.
