# Notion space migrations

A migration brings an **existing** Notion space up to date after the design changes (decision 0022). New spaces don't need migrations: the build prompts in [../prompts/](../prompts/) already include every change.

Run them in number order, once each. The `brain-notion-change` skill writes them, and after you run one it checks your space against the design.

## Format

`NNNN-<slug>.md`:

```markdown
# NNNN · <what changes>

**Design change:** <PR / decision>. **Applies to:** spaces built before <date or PR>.

## Prompt (Notion AI)
<a prompt that changes only this, and says to keep everything else>

## By hand
<steps Notion AI can't do reliably, e.g. adding a select option>

## Verify
- [ ] …
```

## Migrations

| # | Change | From |
|---|---|---|
| [0001](0001-review-kind-add-link.md) | Review → Kind gets the option **Add Link** | decision 0028, PR #30 |
| [0002](0002-system-timestamps.md) | Review, Projects, Questions get system timestamps used by the views | Prompt 7 views |
