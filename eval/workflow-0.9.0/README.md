# Workflow and repo skills: blind runs (CC-104)

CC-104's acceptance: blind runs of `brain-workflow-adopt`, `brain-workflow` and `brain-repos` by fresh Sonnet sub-agents, with no answer key, on synthetic projects. Results: [RESULTS.md](RESULTS.md).

## Set-up

- **Sandbox:** `sh harness/make-sandbox.sh <new dir>` (after `npm run build`). It builds:
  - a synthetic brain from `tests/fixtures/brain-acme` with Tasks and Documents on, as a Git repo;
  - `acme-site/`, a folder of general work with a Markdown plan (`PLAN.md`: 1 done, 1 in progress, 2 to do) and an AGENTS.md whose "Status lives in PLAN.md" clashes with a connected workflow;
  - `acme-api/`, a Git repo with decisions, docs, a `secrets/` folder and a `TASKS.md` checklist with one unmapped status (`[?]`);
  - `env.sh`, which puts this checkout's CLI and the Notion stand-in on PATH and sets `BRAIN_DIR`.
- **Notion is simulated.** [harness/notion-sim](harness/notion-sim) is a file-based stand-in for the Notion MCP (query a database, get a page, create, update, write a toggle heading), seeded by [harness/make-notion.sh](harness/make-notion.sh) with the fixture's Project and Area pages and an empty Tasks database. It can fail on purpose: `{"cmd": "create", "mode": "ghost" | "network" | "lasting", "code", "message", "times"}` in its state's `fail` list. `ghost` creates the page and still answers with an error, like a call that times out after Notion wrote it. No run calls the real Notion API. (The runs used these scripts with the fixture's ids written in; the committed versions read them from the sandbox brain, so the repo holds no page ids.)
- **The agent** gets [harness/RULES.md](harness/RULES.md), the skill's path and the user's sentence; nothing else from the product repo. When the skill asks the user, the agent stops, and the building session answers as the user (SendMessage) in the user's plain words.
- **Checks** are made outside the agent, on the sandbox after each turn: `git status` in the repos, the brain's commits and `_workflows/` records, and the simulated Notion's pages and call log.
