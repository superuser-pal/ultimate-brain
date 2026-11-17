<!-- Title: "<TASK-ID>: <what it does>". Branch: claude/<CC-N>-… (decisions 0038, 0044; codex/ branches are history) -->

**Task:** CC-00 · **Release:** x.y.z · **Decisions:** 00xx

## What changed

<!-- Apply docs/design-principles.md (0104). Include the applicable planning/design evidence: simplest approach, database/tool reuse, user effort, lifecycle/ownership and macOS/Windows capabilities. Cite unchanged flows or briefly explain inapplicable checks. -->

## Acceptance
<!-- Copy each acceptance criterion from build/TASKS.md. The reviewing agent ticks each box and adds the evidence: a test name, or a command and its output. -->
- [ ] …

## Checks
- [ ] Applicable design principles have evidence in the task, specs and PR; departures are recorded and reconciled with accepted decisions
- [ ] Manual Windows acceptance coverage is recorded, or not applicable; any outstanding release testing has a Notion follow-up and a visible warning (completion is not a publication gate)
- [ ] `npm test`, `npm run typecheck`, `npm run test:package` pass
- [ ] The task row has a non-empty `**Changelog:**` line
- [ ] Leak check passes: no real names, client text, Notion ids or emails (fixtures are synthetic)
- [ ] Spec questions, if any, are written under the task in build/TASKS.md
- [ ] After the review finds nothing left: the task row says `done` (#N)

<!-- Last step, after the done commit: the reviewer posts "Review (Claude reviewer): pass at <sha>" (or Codex: "Review (Codex): …"), naming the PR's head commit (decisions 0044, 0063). -->
