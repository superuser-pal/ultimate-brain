# 0.9.0 acceptance: harness (CC-107)

The evidence is in [docs/acceptance-0.9.0.md](../../docs/acceptance-0.9.0.md); the blind runs are in [RESULTS.md](RESULTS.md); the scripts' reports are in [reports/](reports/).

## Isolation

- [harness/install.sh](harness/install.sh) `<new dir>`: packs this checkout's `HEAD` as 0.9.0 (from a copy, so the checkout is untouched) and installs the tarball globally into `<dir>/prefix-090`, with `HOME`, npm's cache and empty `~/.claude/skills`, `~/.agents/skills` and `~/.codex/skills` under `<dir>`. Every later step sources its `env.sh`.
- Notion and GitHub are stand-ins: [harness/notion-sim](harness/notion-sim) (CC-104's, with page bodies added) and [harness/gh-sim](harness/gh-sim) (issues and PRs from a state file; every call logged). No run calls a real API.
- Blind runners are fresh Sonnet sub-agents given [harness/RULES.md](harness/RULES.md), the sandbox path, the skill to start with and the user's sentence; their skills are the sandbox brain's `.claude/skills`, written by the installed CLI. The building session answers as the user and checks every result itself, on the sandbox's files, Git history and the stand-ins' state and call logs.

## Scripts

- [harness/make-sandbox.sh](harness/make-sandbox.sh) `<install dir> <new dir> standard|connected-pr|general-area|hub|retry`: one scenario's sandbox. The Acme fixture brain with every module on and a Documents database, pinned by the installed CLI's own `brain upgrade`, every note recorded as published; the stand-ins; the scenario's folders.
- [harness/rollback.mjs](harness/rollback.mjs) `<install dir>`: 0.8.1 from npm → a brain it makes with knowledge and configuration → the packed 0.9.0 and `brain upgrade` → rollback per spec/skills-delivery.md §8, comparing an installation manifest (the global package, the brain's lock, every skill file in the brain's two trees and in `HOME`'s three skill folders) and the knowledge files before and after. Report: [reports/rollback.json](reports/rollback.json).
- [harness/shared-checks.mjs](harness/shared-checks.mjs) `<general-area sandbox>`: the CLI-level shared checks of spec/connected-workflows.md §14 and the version behaviour of spec/skills-delivery.md §5 and §7, against the installed CLI. Report: [reports/shared-checks.json](reports/shared-checks.json).

```sh
sh eval/acceptance-0.9.0/harness/install.sh /tmp/ub-090/i
node eval/acceptance-0.9.0/harness/rollback.mjs /tmp/ub-090/i
sh eval/acceptance-0.9.0/harness/make-sandbox.sh /tmp/ub-090/i /tmp/ub-090/shared general-area
node eval/acceptance-0.9.0/harness/shared-checks.mjs /tmp/ub-090/shared
```
