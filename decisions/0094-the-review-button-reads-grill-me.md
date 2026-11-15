# 0094 — The Review button reads Grill me

**Status:** Superseded by [0096](0096-one-place-to-decide.md) (2026-11-15; 0.16.0): the Review database, its page and Grill me are removed; decisions are made in the session
**Date:** 2026-11-15
**Release:** 1.0.0
**Amends:** [0090](0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md) §1 (the button's name and label)
**Keeps:** 0090 in full otherwise: what the button sends, the Grill review skill, its rounds, its preview, and that it never sets Your call.

## Context

0090 put a button on every Review row that opens Brain Assistant on the page. 0.15.0 named it **Grill** with the label **Review with me** (migration 0025 step 2), and the brain's own texts tell the user to click Review with me: the "What to do" line the CLI writes on every Review page, the gray line above the Review tabs, the row template's callout, the Review queue and Grill review skills, How it works and the Everyday guide.

When the author applied migration 0025 to their space and to the published template on 2026-11-15, they named the button property **Review context** and its label **Grill me**, and chose to keep that over the product's names. The label says what the button does, and matches the skill it runs (Grill review).

## Decision

1. The button on a Review row is the property **Review context**, labelled **Grill me**. Its action and message are unchanged.
2. Every text the product writes or ships that names the button says **Grill me**: the CLI's Review page, the Notion design, prompts, views guide and template examples, Brain Assistant's skills and instructions, How it works and the Everyday guide (through the skills fork), and the spec.
3. Migrations 0025 and 0026 are history and keep their wording. A new migration renames the property and its label in a space built before this decision, and replaces the texts that name it (the gray line, the row template's callout, the two skills, How it works).
4. A Review page rendered before the change keeps "Review with me" in its "What to do" line; Grill review and Review queue treat both names as the same button.

## Consequences

- One implementation task in 1.0.0 (CC-278) covers the CLI, the repo's Notion texts, the spec, the fork's guides and the new migration.
- The author's space and the published template already have the new names; the migration's text steps still apply to them.
- 0.15.0 users who keep "Review with me" lose nothing: the button works the same, only its name differs from the texts until they apply the migration.

## Evidence

- The author's answer of 2026-11-15 ("I want to keep it as grill me"), after applying migration 0025.
- [notion/migrations/0025-review-with-me-and-your-call-decides.md](../notion/migrations/0025-review-with-me-and-your-call-decides.md) step 2; `src/lib/review-body.ts` (the "What to do" line).
