# Blind runs of the brain-setup skill (CC-191)

Seven runs of the fork's `brain/brain-setup/` skill, and of the phase 2 changes to `ultimate-assistant`, `brain-ingest`, `brain-catch-up` and `brain-notion-change`. Each run is a fresh general-purpose sub-agent with no project context, on a synthetic brain. It acts as the skill says, with a scripted user. What each run did and found is in [RESULTS.md](RESULTS.md); the prompts, verbatim, are in [prompts.md](prompts.md).

Everything is synthetic. No run touches a real Notion, a real `gh`, a real remote or a real brain.

## What a sandbox holds

`harness/make-sandbox.sh` builds one sandbox in a new folder:

- **The CLI.** A scratch clone of this repository at `d0c52cf`, CC-190's last commit (#296). `brain --version` prints `0.12.0`. The runs stay on it because `brain upgrade` refuses an unreleased build, and CLI 0.13.0 refuses a skills pin of 1.5.0.
- **The brain.** A fresh brain from `brain init --owner "Sam Rivera"`, with a local bare repository as its remote.
- **An isolated home.** HOME and the global Git config live inside the sandbox, so the global identity setup writes stays there.
- **A `gh` stub** that always fails.
- **A Notion stand-in.** This is `eval/workflow-0.9.0/harness/notion-sim` plus a `search` command (`notion-search.cjs`), over a state file (`notion-state.cjs`). The state holds the user's duplicated space: Brain Data, its System page reading `Template version: 0024`, and the twelve databases.
- **The skills under test,** taken with `git archive` from a commit of the ultimate-brain-skills fork. Any others the run needs come from the CLI's vendored snapshot.
- **`RULES.md`** for the run's agent, made from `harness/RULES.md`:
  - read only the skills and the product files the skill names;
  - start every command with the sandbox's `env.sh`;
  - pass `--brain` to every `brain` command;
  - use `notion-sim` instead of any Notion tool;
  - stay in the sandbox;
  - take the scripted answers, and stop when none fits.

`harness/start-state.sh` then writes the run's starting state, as the earlier runs left it, so each run can start on its own. `harness/prepare-run7.sh` makes run 7's four brain copies.

## Reproducing a run

From this repository's root, with the fork checked out at `<fork>`:

```sh
H=eval/setup-skill-0.14/harness
# Run 4, for example: the fork at 2241266, its skill sets, the seeded brain.
FORK_SKILLS="brain-setup brain-connect-notion" CLI_SKILLS="brain-ingest brain-apply brain-query brain-sync brain-catch-up" \
  $H/make-sandbox.sh /tmp/ub-setup-run4 <fork> 2241266
$H/start-state.sh /tmp/ub-setup-run4 seeded
```

Then give a fresh sub-agent the run's prompt from [prompts.md](prompts.md), with `@SANDBOX@` replaced by the sandbox folder. RESULTS.md lists each run's fork commit, skill sets, Notion mode and stage. A run's agent decides its own words and ids, so a rerun matches in outcome (the `setup` log lines, what was or wasn't written), not byte for byte.

To check the current fork head, use the defaults (`make-sandbox.sh <dir> <fork> <head>`) and the stage the run starts from.
