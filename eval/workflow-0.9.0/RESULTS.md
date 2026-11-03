# Workflow and repo skills: blind run results

Eight runs on 2026-11-03, each a fresh Sonnet sub-agent with only its skill, [harness/RULES.md](harness/RULES.md) and a sandbox from [harness/make-sandbox.sh](harness/make-sandbox.sh) ([README.md](README.md)). The CLI is CC-102's, from this branch, unchanged.

| Acceptance | Run | Result |
|---|---|---|
| Adopting a Markdown plan shows one preview before applying | A1 | pass |
| An adoption rerun duplicates nothing | A2 | pass |
| A failed publication of a connected task is kept and retried without a duplicate | B1, B2 | pass |
| Linking writes the kit only after a yes, and offers `brain link` the other way | C1, C2 | pass |
| Standard tracking needs no brain and no Notion | D1, D2 | D1 failed one rule, fixed; D2 pass |

## A1: adopt a Markdown plan (brain-workflow-adopt)
Told, in `acme-site`: "Adopt this project into Notion. It belongs to the Acme website project in my brain."
- **Turn 1:** inspected the plan, AGENTS.md, the brain and Notion, writing nothing. Asked "Connect this work to Notion?" with the destination, work type (General), level (Tasks + final outputs) and the status mapping, and said the adoption preview would follow. Checked: no `_workflows/`, Notion unchanged.
- **Answer:** "Yes, connect it with those settings." **Turn 2:** set the Project's Workflow settings, read them back, ran `workflow new` (record and pointer), then `adopt preview`, and showed **one** preview: 3 to create (Doing, To Do, To Do), the done item left in the plan, the plan never edited, and the conflicting rule "Status lives in `PLAN.md`" with keep / adapt / decline. Checked: only `workflow: new` in the brain's log; no items.
- **Answer:** "Apply it. Decline the status rule. Leave the done item in the plan." **Turn 3:** `adopt apply --rev 0` (3 items, 3 operations), `reconcile --start`, each operation `in_flight` → Brain ID lookup (no hit) → create → Work record toggle → `done`, a second reconcile, the Workflow summary toggle and `summary --written`.
- **Checked:** 3 items, 3 tasks in Notion with distinct Brain IDs, `PLAN.md` and AGENTS.md unchanged. **Pass.**

## A2: rerun the adoption
A fresh agent, the same sandbox: "Adopt this project's plan into Notion. I may have done this before, I don't remember."
- Found the connected workflow, recomputed the keys (they matched the 3 stored ones), ran `adopt preview`: nothing to create or update, 3 untouched, the done item still unselected. Asked only whether to import the done item. **Answer:** "No, leave it." It wrote nothing.
- **Checked:** still 3 items and 3 tasks; no new brain commit. **Pass.**

## B1: a failed publication (brain-workflow)
A connected workflow with 3 adopted items and 3 open `create_task` operations, prepared with the CLI. Notion set to fail twice: the first create **writes the page and answers `network`** (`ghost`), the second fails with a lasting `validation` error. Told: "Start a work session on this project: bring Notion up to date with what's waiting, then end the session and tell me where things stand. Don't start on any task today."
- Ghost write: the agent looked the Brain ID up before retrying, found the page Notion had created, and closed the operation with it: no second task.
- Lasting error: `op state … failed` with the message, kept. The summary on the Project: "Not yet in Notion: 1: Build the contact form (failed: Status is not a property that exists)". Report: "Needs you: 1 not yet in Notion (… failed …) · Next: say "retry" … or "drop it"".
- **Checked:** 2 tasks in Notion, one per Brain ID; the failed operation still open in the brain. **Pass.**

## B2: the next session retries it
A fresh agent, the same sandbox, Notion working again: "New session on this project. Get Notion up to date first, then end the session and tell me where things stand. No task work today."
- `reconcile --start` returned the failed operation to run (its first failed run, so no question); lookup (no hit), create, toggle, `done`; the summary rewritten without the "Not yet in Notion" line.
- **Checked:** 3 tasks in Notion, 3 distinct Brain IDs, 4 create calls in Notion's log (ghost, ok, failed, ok), `ops_open: 0`. **Pass.**

## C1: link a repo (brain-repos), with the link the other way
Told, in the brain: "Link the repo at …/acme-api. It's the API for the Acme website project."
- **Turn 1:** proposed the whole kit (Area Clients, Project Acme website, `decisions/**`, `docs/**/*.md`, `README.md`, never `.env*` and `secrets/**`, tasks tracked in `TASKS.md` with `?` → waiting), checked it, and asked. Checked: no `brain-kit.json`, brain unchanged.
- **Answer:** "Yes, write it as shown…" **Turn 2:** `kit write --confirm <the checked hash>`, `repo add --kit`, a brain commit, the rollup toggle on the Project, `repo health`; asked "Let this repo read the brain too?".
- **Answer:** "Yes." `brain link` failed with `SKILLS_SNAPSHOT_INVALID`: a sandbox fault (the checkout's generated `snapshot.json` had been removed by a mirror rebuild), and the agent stopped and reported it, as exit 3 asks. After `build-skills.ts --snapshot`, "I fixed the install. Retry" → `brain link` wrote `.brain`, the AGENTS.md block, `CLAUDE.md` and the brain-query skill.
- **Checked:** the repo holds only the kit and `brain link`'s files. **Pass.** Fixed after the run: the brain commit left `log/` out (the skill now says to commit it), and the skill now names the files `brain link` writes.

## C2: link again, declining the other way (after the fixes)
A fresh sandbox and agent: "Connect my repo at …/acme-api to the brain, under the Clients area."
- The same preview before any write; on "Yes, … Write it and link it.", the kit, the link (`brain.json` and `log/` committed together), the rollup; the other-way question under Needs you. **Answer:** "No, the repo doesn't need to read the brain." Nothing more written.
- **Checked:** `git status` in the repo shows only `brain-kit.json`; the brain is clean; the Project's `Repo tasks · acme-api` toggle has the counts. **Pass.**

## D1: standard tracking (brain-workflow)
A folder `workshop/` with a `TASKS.md` checklist and an AGENTS.md ("Mark a task [x] only after Alex approves"), no pointer, and `brain` and `notion-sim` replaced by stubs that log every call. Told: "Let's work on the next task here."
- Drafted the agenda, left the box open for approval, and reported it waiting on the user, with no Notion. But its **first command was `brain workflow show`**, before looking for the pointer (logged by the stub). **Fail** on "standard needs no brain".
- **Fixed:** the skill now says to look for the pointer with a plain file read and no `brain` command, how to pick "the next task", and that a checklist has no "ready for approval" state.

## D2: standard tracking, rerun
A fresh copy of the folder and a fresh agent, the same sentence. It read the pointer as a file, found none, and never ran `brain` (the stubs' log is empty). It drafted `docs/agenda.md` and left `TASKS.md` unticked, waiting for approval. **Pass.**

## What the agents found unclear, and what changed
- Fixed in the skills: the lookup before every create attempt, a retry too (written before B1); how to find a destination's page id (`notion` in `brain index --json`); that a lookup hit ends the retries; the end of a session also runs when no item was worked on; open work that waits on nobody isn't "Needs you"; a convention decided in an earlier adoption keeps its choice; a rerun with nothing to apply writes nothing; the brain commit after a link includes `log/`.
- Not skill text, noted for the user: the adopted items' first progress line reads "Adopted from `PLAN.md` line:… as " with the raw status as given, so an open box prints as a space (spec/connected-workflows.md §11.6's wording).
- Not changed: the agents asked whether to combine the "Connect?" yes with the adoption preview. They are two yeses on purpose: connecting is the opt-in (spec §2), and adoption needs the workflow it previews into.
