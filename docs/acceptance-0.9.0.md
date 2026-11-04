# Acceptance of 0.9.0 (decisions 0059, 0066): what is verified and what is left for the user

Synthetic data only, on an isolated installation; no real brain, no real Notion, no real GitHub, and nothing under the user's `~/.claude`, `~/.agents`, `~/.codex` or brain. 0.9.0 ships skills in **phase A** (spec/skills-delivery.md §9): the package builds its snapshot from the product's `skills/`, under the name `ultimate-brain`; CC-105 (the fork's snapshot) moves to 0.9.1 (decision 0069). The harness, the blind runs' transcripts and the scripts' reports are in [eval/acceptance-0.9.0](../eval/acceptance-0.9.0/README.md). Nothing below claims a check that was not run.

## The installation

[install.sh](../eval/acceptance-0.9.0/harness/install.sh) copies this checkout's `HEAD`, sets the version to 0.9.0, packs it (`npm pack`, so `prepack` builds `dist/` and the snapshot) and installs the tarball globally into a temporary prefix, with `HOME`, npm's cache and the three agent skill folders (`~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills`, all empty) under the same temporary folder. Each scenario's brain is the Acme fixture brain, pinned by the installed CLI's own `brain upgrade`.

| Check | Result |
|---|---|
| The packed snapshot is phase A | `snapshot.json`: `name` `ultimate-brain`, `version` `0.9.0`, `cli` `>=0.9.0 <0.10.0`, `source` the npm package, `upstream` null; 11 skills, `brain-query` with targets `brain` and `linked_repo`, the rest `brain` |
| A brain upgraded by the installed CLI is pinned to it | `brain status` `data.skills`: `pinned`, `ultimate-brain` `0.9.0`, `installed_by` `0.9.0`, `competing: []` |
