# 0065 — The Domains database is in every Notion space

**Status:** Proposed
**Date:** 2026-11-03
**Amends:** 0055 (how Domains reach Notion)
**Keeps:** 0048 (modules, nothing deleted when off), 0022 (structure changes in the repo first)

## Context
Decision 0055 made Domains an optional module, off by default, and its Notion database and the Areas · Domain relation were built only when the user switched the module on (build prompts tagged `[Domains]`, migration 0013 step 2 "module on only", notion/modules/domains.md). In the user's scope review of 2026-11-03 this showed up as a miss: a space built with Domains off has no Domains database, so turning Domains on later is a build job (a Notion AI prompt, relations, a by-hand limit) instead of a switch, and an agent planning the user's Areas can't group them by Domain without first changing the space. The user asked for the database to be there "even if the brain uses it or not".

## Decision
- **Every space has the Domains database** (Name, Summary, Lifecycle, Archived, Brain ID, Last Synced, as in 0055) **and the two-way relation Areas · Domain ↔ Domains · Areas**, limited to 1 page on the Area side by hand. When the space has an Orgs database, it also has Domains · Org ↔ Orgs · Domains.
- **The build prompts create them untagged** (Core), whatever modules the user chose. **Migration 0014** adds them to a space that doesn't have them.
- **The Domains module switch is unchanged and still off by default.** It decides only whether the brain uses Domains: sync and render ignore Domain rows and Area · Domain with Domains off (spec/cli.md, "Domains"), and the Domains parts of pages (Home's Areas grouped by Domain, Domain on the area home) are shown only with it on. Turning Domains on no longer builds anything in Notion: it is the switch plus those display steps by hand.
- **brain-connect-notion stores the Domains database id** whenever it finds the database, with the module on or off (as it already does for any module's database, 0048).

## Consequences
- New spaces have one more database under Brain Data: 15 with every module, 7 with Core alone.
- An empty Domains database and an empty Domain relation on Areas are visible with the module off. That is the cost the user accepted for a switch that needs no building.
- No CLI change: the module default, `MODULE_OFF` and the render rules stay as specified.
- notion/prompts/02 and 03, notion/CHECKLIST.md, notion/modules/domains.md, docs/notion-space-design.md, spec/schema.md §12 and brain-connect-notion follow. Migration 0014 also records that the Notion REST API can create a database (`POST /v1/databases` with `initial_data_source`, Notion-Version 2025-09-03), which the Notion MCP tools can't.

## Evidence
- The user's scope review, 2026-11-03: Domains were set up in their space by hand that day, with the database created through `POST /v1/databases` because the MCP's data source endpoint refused to create one.
- Decisions [0055](0055-domains-capture-and-review.md), [0048](0048-modules-and-simpler-rows.md); migration [0013](../notion/migrations/0013-domains-selected-capture-editable-review.md) step 2.
