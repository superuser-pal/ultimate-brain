<!-- Title: "<TASK-ID>: <what it does>". Branch: claude/<CC-N>-… (decisions 0038, 0044; codex/ branches are history) -->

**Task:** CC-00 · **Release:** x.y.z · **Decisions:** 00xx

## What changed

## Acceptance
<!-- Copy each acceptance criterion from build/TASKS.md. The reviewing agent ticks each box and adds the evidence: a test name, or a command and its output. -->
- [ ] …

## Checks
- [ ] `npm test`, `npm run typecheck`, `npm run test:package` pass
- [ ] The task row has a non-empty `**Changelog:**` line
- [ ] Leak check passes: no real names, client text, Notion ids or emails (fixtures are synthetic)
- [ ] Spec questions, if any, are written under the task in build/TASKS.md
- [ ] After the review finds nothing left: the task row says `done` (#N)

<!-- Last step, after the done commit: the reviewer posts "Review (Claude reviewer): pass at <sha>" (or Codex: "Review (Codex): …"), naming the PR's head commit (decisions 0044, 0063). -->
