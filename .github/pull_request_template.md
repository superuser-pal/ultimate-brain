<!-- Title: "<TASK-ID>: <what it does>". Branch: claude/<TASK-ID>-… or codex/<TASK-ID>-…  (decision 0038) -->

**Task:** CC-00 · **Release:** x.y.z · **Decisions:** 00xx

## What changed

## Acceptance
<!-- Copy each acceptance criterion from build/TASKS.md. The reviewing agent ticks each box and adds the evidence: a test name, or a command and its output. -->
- [ ] …

## Checks
- [ ] `npm test`, `npm run typecheck`, `npm run test:package` pass
- [ ] `CHANGELOG.md` has a line for this task under its release
- [ ] Leak check passes: no real names, client text, Notion ids or emails (fixtures are synthetic)
- [ ] Spec questions, if any, are written under the task in build/TASKS.md
