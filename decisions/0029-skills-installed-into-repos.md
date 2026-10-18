# 0029 — `brain init` and `brain link` install the Codex skills into the repo

**Status:** Accepted; amended by 0038 (skills also go to `.claude/skills/`; the Claude Code plugin is retired)
**Date:** 2026-10-12

## Context
Skills have one source, `skills/<name>/`, mirrored to `.agents/skills/` (CC-05, decision 0014). Claude Code gets them as the `ultimate-brain` plugin, installed from GitHub. Codex reads skills from `.agents/skills/` in the repo it works in. The npm package (CX-12) shipped only the CLI, so a user's brain repo, and the repos linked to it, had no way to get the skills for Codex (spec question raised on PR #27).

Options considered:
- **A.** `brain init` and `brain link` copy the skills into the repo.
- **B.** A per-machine command installs them into Codex's global skills folder.
- **C.** Don't ship them; Codex users clone the product repo.

## Decision
**A.**
- **The npm package ships `.agents/skills/`.**
- **`brain init`** writes every skill into the new brain at `.agents/skills/<name>/`, as product-owned files.
- **`brain link`** writes `brain-query` into the linked repo at `.agents/skills/brain-query/`. A linked repo only reads the brain (0006), so it gets only the read-only skill.
- **These files are product-owned**, like the fenced sections of AGENTS.md (0014). The user doesn't edit them. A newer product version replaces them: `brain link` re-run replaces `brain-query` in a linked repo, and a future `brain upgrade` will refresh them in a brain. Until that command exists, re-running `brain init` in a new folder is the only other way.
- **Claude Code** keeps using the plugin. Nothing is copied for it.

## Consequences
- **Every brain and linked repo commits the skill files.** That's a few small Markdown files, versioned with the repo, so a Codex session sees the same skills on any machine.
- **A `brain upgrade` command is needed later** to refresh product-owned files in an existing brain (skills, the AGENTS.md section). It's out of v1 scope; noted for wave 4.
- **The CLI needs to implement it** (CX-16, Codex), with spec/cli.md §5.1 and §5.12.

## Evidence
PR #27 review (spec question under CX-12). Decisions 0006, 0014. skills/README.md.
