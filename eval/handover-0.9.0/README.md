# Catch-up and ingest hand over to brain-repos: blind runs (CC-117)

CC-117's acceptance: a fresh Sonnet sub-agent, with no answer key, on a synthetic brain with one tracked-in-repo linked repo, rebuilds the repo's task rollup in a catch-up; and "link the repo at <path>" given to brain-ingest ends in brain-repos asking for a yes on the kit. Results: [RESULTS.md](RESULTS.md).

## Set-up

- **Sandbox:** `sh harness/make-sandbox.sh <new dir> catch-up|ingest` (after `npm run build`). It runs CC-104's sandbox ([../workflow-0.9.0/harness/make-sandbox.sh](../workflow-0.9.0/harness/make-sandbox.sh): the Acme fixture brain, the synthetic `acme-api` Git repo, the Notion stand-in) and records every note as published, so a catch-up has nothing else to publish. Then:
  - `catch-up`: `acme-api` linked with a tracked-in-repo kit on the Acme website project (`TASKS.md` checklist, `?` → waiting), its files already ingested, an old `Repo tasks · acme-api` toggle on the project page in the stand-in (1 completed, 2 open), and one more commit to `TASKS.md` after it (a task done, a task added).
  - `ingest`: `acme-api` not linked.
- **The agent** gets CC-104's [RULES.md](../workflow-0.9.0/harness/RULES.md), the product's `skills/` folder (as a brain has all its skills), the skill to start with and the user's sentence; nothing else. The building session answers as the user (SendMessage).
- **Checks** are made outside the agent, on the sandbox after each turn: `git status` and the log in the brain and the repo, and the stand-in's pages and call log.
