# Acceptance of 0.9.0 (decisions 0059, 0066): what is verified and what is left for the user

Synthetic data only, on an isolated installation; no real brain, no real Notion, no real GitHub, and nothing under the user's `~/.claude`, `~/.agents`, `~/.codex` or brain. 0.9.0 ships skills in **phase A** (spec/skills-delivery.md §9): the package builds its snapshot from the product's `skills/`, under the name `ultimate-brain`; CC-105 (the fork's snapshot) moves to 0.9.1 (decision 0069). The harness, the blind runs' transcripts and the scripts' reports are in [eval/acceptance-0.9.0](../eval/acceptance-0.9.0/README.md). Nothing below claims a check that was not run.

## The installation

[install.sh](../eval/acceptance-0.9.0/harness/install.sh) copies this checkout's `HEAD`, sets the version to 0.9.0, packs it (`npm pack`, so `prepack` builds `dist/` and the snapshot) and installs the tarball globally into a temporary prefix, with `HOME`, npm's cache and the three agent skill folders (`~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills`, all empty) under the same temporary folder. Each scenario's brain is the Acme fixture brain, pinned by the installed CLI's own `brain upgrade`.

| Check | Result |
|---|---|
| The packed snapshot is phase A | `snapshot.json`: `name` `ultimate-brain`, `version` `0.9.0`, `cli` `>=0.9.0 <0.10.0`, `source` the npm package, `upstream` null; 11 skills, `brain-query` with targets `brain` and `linked_repo`, the rest `brain` |
| A brain upgraded by the installed CLI is pinned to it | `brain status` `data.skills`: `pinned`, `ultimate-brain` `0.9.0`, `installed_by` `0.9.0`, `competing: []` |

## The four scenarios (connected-workflows.md §14, linked-repos.md §11)

Blind runs by fresh Sonnet sub-agents, with no answer key, each with its own sandbox on the installation; the building session answered as the user and checked each result on the files, Git history and the stand-ins' state. Transcript summaries: [RESULTS.md](../eval/acceptance-0.9.0/RESULTS.md).

| Scenario | Result | Evidence |
|---|---|---|
| 1. Standard software: GitHub-style issues, no pointer | pass | S1: issue 1 taken, PR opened; the `brain` and `notion-sim` stubs logged no call, the brain's history is unchanged |
| 2. Connected software with a PR: 3-item Markdown plan, 1 done left, 1 in progress kept; PR → `review`, merge → `done`; at `full` the plan is published and a temporary log isn't | pass | S2: 2 tasks (Doing, To Do), the done item left in `PLAN.md`; `review` with PR 2 open, kept in review while the PR read `OPEN`, `done` once it read `MERGED`; the approved plan `include` and published with its body, the approved scratch log `exclude`, `local_reason: temporary`, no page |
| 3. General work under an Area at `tasks_and_finals`: the final deliverable published only after approval; `done` only after acceptance | pass | S3: the agenda's Documents page created 55 s after its approval, none before; each `done` item carries the user's words as `accepted` |
| 4. A hub with a connected and a tracked-in-repo repo | pass | S4, S4b: each kit written once after the yes; nothing else in either repo but the kit (and the connected workflow's pointer); the `never_read` file matched by a pattern is in no source; the Project has the workflow summary and no rollup; the Area had the toggle with the counts and "Not mapped" (S4b, read back by the runner); a second link run changed nothing (hashes); the unlink kept the 3 sources and the note, and the remaining repo's health has no error |

## The shared checks, once each

| Check | Result | Evidence |
|---|---|---|
| An interrupted `create_task` resolves without a second task | pass | R1: the create that wrote the page and answered `network` was found by its Brain ID before the retry; S2's body retry found its page the same way |
| A failed operation is retried at the next run; meanwhile "Work complete, 1 not yet in Notion" | pass | R1: the Project's summary had the line; R2 (a fresh agent) retried and published it; 3 tasks, 3 Brain IDs |
| A title changed in both places is asked; a status changed in both places keeps Notion's | pass | [shared-checks.json](../eval/acceptance-0.9.0/reports/shared-checks.json): `BOTH_CHANGED` with Notion's title as `value`; status `waiting` adopted (`status_adopted`), no `update_task` |
| A stale record revision is refused | pass | shared-checks: `STALE_RECORD` (exit 4) |
| Two sessions can't claim one item | pass | shared-checks: the second claim `CLAIMED`, naming the holder |
| An adoption rerun creates nothing | pass | A2: preview lists the 2 adopted items as untouched; no commit, still 2 tasks |
| Version behaviour | pass | shared-checks: pinned `ultimate-brain 0.9.0`; a global copy at `~/.claude/skills/brain-query` is `skill-competing`; a missing pinned `SKILL.md` stops a write with `SKILLS_SNAPSHOT_MISSING`; a pin whose range excludes the CLI stops it with `SKILLS_INCOMPATIBLE` and the install to run; the brain is pinned again afterwards |
| Update behaviour (skills-delivery.md §11) | pass | `scripts/skills-integration.mjs --dry-run`: status `ok` with the fork's release 1.0.0 `unclassified`; against an unreachable source, status `unknown` ("GitHub unreachable"), never "current"; with `--release 0.9.0` it refuses (exit 1): "1 skills change(s) that may be incompatible are unclassified" |

## Rollback (skills-delivery.md §8, migration plan step 7)

[rollback.mjs](../eval/acceptance-0.9.0/harness/rollback.mjs), report [rollback.json](../eval/acceptance-0.9.0/reports/rollback.json), run twice on fresh installations with the same result:
- `ultimate-brain@0.8.1` from npm, a brain it made, 36 knowledge files and two settings, committed; lint 0 errors;
- the packed 0.9.0 installed over it: `status` `unpinned` with the drift listed; `brain upgrade` pinned `ultimate-brain 0.9.0` (`from: null`, 38 files, committed `upgrade: ultimate brain 0.9.0, skills ultimate-brain 0.9.0`);
- `git revert <upgrade commit>`, then `npm install -g ultimate-brain@0.8.1`: `brain --version` 0.8.1, `brain lint` exit 0 with 0 errors and 0 warnings;
- the installation manifest (the global package, the lock, every skill file in the brain's two trees and in `HOME`'s three skill folders) equals the one before the upgrade, field for field; the knowledge files and `brain.json` are byte-identical; the tree is clean.

**Pass**, with finding 1: the upgrade reported `previous_cli: null`, so the documented step "install `<previous_cli>`" names no version for this, the 0.9.0 rollout's own case.

## Agent smoke checks: not run

Claude Code 2.1.309 and Codex 0.164.0 are installed. Under the isolated `HOME` (and `CLAUDE_CONFIG_DIR`, `CODEX_HOME` inside it) neither is logged in: `claude -p` answers "Not logged in · Please run /login", `codex exec` gets 401 from the API. Their logins live in the user's own configuration, which this acceptance doesn't touch; the user chose on 2026-11-04 to record this as not run. Nothing below is a substitute for a live agent load:
- **The effective source, by the CLI:** in every sandbox `brain status` reports `pinned`, `ultimate-brain` `0.9.0`, `installed_by` `0.9.0`, `competing: []`; `pinned` means both trees (`.claude/skills` for Claude Code, `.agents/skills` for Codex) hold the lock's exact bytes (skills-delivery.md §3, §5.1), and the isolated `HOME`'s skill folders are empty.
- **Claude-family agents loaded those copies:** all nine blind runs read their skills from the sandbox brain's `.claude/skills` (by path, not by Claude Code's discovery).
- **Left for U-24** on the user's machine: each agent, logged in, lists one definition per skill and names the brain's copy.

## Findings

No scenario failed. These came up on the way; none is fixed here.

| # | Where | Finding | Proposed |
|---|---|---|---|
| 1 | spec/skills-delivery.md §8, docs/releasing.md, the brain's AGENTS.md block | The first upgrade of an unpinned brain (every brain moving to 0.9.0) reports `previous_cli: null`, and the rollback says to install `<previous_cli>`. The version to go back to is the one `brain --version` printed before installing 0.9.0. | a task: the rollback text names that case (and, optionally, upgrade reports the running version it replaced) |
| 2 | `repo kit check` (cli.md §5.29), brain-repos | `kit check` returns the hash of the bytes it read, `kit write` confirms against the 2-space form it writes; a hand-formatted draft is valid, gets a hash, and can never be confirmed, with no hint why (S4). The skill gives the normalising command, but nothing makes the agent use it. | a task: `kit check` reports a non-canonical draft (a `problems` entry or the canonical hash), spec first |
| 3 | brain-workflow references/notion.md, `publish_artifact` | It tells the agent to set `lifecycle: reviewed` on the reference note, which `note new` refuses ("set by the CLI"), and doesn't say to commit the new note (and the publish's `sync record`) before the next `workflow` command, which otherwise fails `DIRTY_TREE` (S2, S3). | the skills task below |
| 4 | brain-workflow | The input shapes the agent must write aren't in the skill: `acceptance` entries, artifact `format` values, `location`; a failed operation is retried through `pending` before `in_flight`. Runners guessed; S2 left a stray artifact record. | the skills task below |
| 5 | brain-workflow | Nothing releases an item's claim when the item is `done` (`item claim --release` exists, S2). | the skills task below |
| 6 | brain-workflow (the yes rule) | S3 edited the agenda's header after "I approve it as it is" and hashed the edited text. The approval rule could say that any edit after the yes needs showing again. | the skills task below |
| 7 | `workflow adopt apply` | The adopted items' first progress line reads "Adopted from PLAN.md line:… as /": a raw key and the checkbox marker (S2). | cosmetic, the same task as 2 or later |
| 8 | the harness, not the product | A runner that misses `env.sh` runs the user's own `brain`, which resolves the user's brain (S4b: one read-only `brain index`). The building session did the same once while preparing CC-117. A sandbox can't stop an agent from running another binary. | for later evals: start every runner with `BRAIN_DIR` set to the sandbox and a fail-closed check that `brain status` names it before any other command |
| 9 | phase A delivery (design, for CC-105 / 0.9.1) | brain-workflow and brain-workflow-adopt are meant for any working folder, but the phase A snapshot targets them at the brain only, and `brain link` copies only brain-query into a linked repo. In a folder that isn't the brain, an agent finds them only if the user runs from the brain or installs them globally. The runs gave the skill's path. | a question for the 0.9.1 grill |

Proposed tasks, for the planning session to add: **(a)** findings 1 and 2 (spec, then CLI test-first: `kit check` and the rollback text); **(b)** findings 3 to 7 in the brain-workflow skill and the adoption progress text.
