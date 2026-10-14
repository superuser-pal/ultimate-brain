# 0034 — Decisions and Questions carry their project's area in Notion

**Status:** Accepted
**Date:** 2026-10-14

## Context
The CC-17 look pass makes each Area page a hub that collects everything for that area (Easlo's Area template pattern). Goals, Projects, Meetings and Tasks relate to Areas directly, so their views filter on "Area is this page". Decisions and Questions relate only to a project, and a Notion view can't filter through two relations ("Project's Area is this page"). For example, the decision "Invoice Acme through Stripe" belongs to the project "Acme onboarding" in the area Consulting, but the Consulting page can't show it in a filtered view.

A Notion-only rollup (Area → Projects → Decisions) shows the records as a plain list of links, with no filters, tabs or columns.

## Decision
- Decisions and Questions get a brain-owned **Area** relation in Notion (two-way with Areas: "Decisions", "Questions").
- The sync fills it with the areas of the record's projects. It is derived, so it isn't stored in the note's frontmatter: the brain already knows each project's area.
- A decision or question without a project, or whose project has no area, gets no Area.
- Until the CLI ships it (CX-22, 0.3.0), Area pages show Decisions and Questions as Notion-only rollups "via projects". The Notion property, the Area page views and their migration are added with CX-22, so the live space never shows a relation the brain doesn't fill.

## Consequences
- spec/cli.md gains the derived Area on the Decisions and Questions render items (Claude Code, before CX-22).
- docs/notion-space-design.md §3.8, §3.9 and §4, Prompt 3, Prompt 6 and a migration change with CX-22.
- This is the one brain-visible change allowed by CC-17; People and Orgs per area stay Notion-only rollups.

## Evidence
build/TASKS.md CC-17 grill outcome (2026-10-14); docs/easlo-second-brain-factual-architecture-appendix.md §3.4 (Area template); decisions/0026, 0022.
