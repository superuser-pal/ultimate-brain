# 0117 — A factory starter for `brain repo new`, in 0.19.0

**Status:** Accepted
**Date:** 2026-11-27
**Release:** 0.19.0
**Amends:** [0066](0066-linked-repos-and-the-link-kit.md) (`repo new` gains a second starter beside `generic`; spec/linked-repos.md §7's "the only starter"); [0112](0112-0-18-0-fourteen-features-and-espanol-in-0-19-0.md) and [0115](0115-obsidian-as-a-reading-room-in-0-19-0.md) (0.19.0 holds one more feature); [0061](0061-roadmap-and-launch-boundary.md) (release scope: an explicit roadmap change after the cutoff)
**Keeps:** [0014](0014-product-repo-vs-brain-repo.md) and 0066's hub (knowledge belongs in the brain; the brain writes only the kit in a linked repo, and `repo new` writes the new repo's folder); [0074](0074-scoped-memory-handovers-and-bounded-recall.md) §3 and §4 (hot context is generated, never stored; a work handover is a `**Stopped:**` line in the task's own record); every rule of [0113](0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) (the user's intent tasks stay in Notion, §3; the detailed plan stays in the folder, §7); [0104](0104-product-design-principles.md); [0116](0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §10 (the open-core test); every rule of 0112 and 0115

## Context

Dogfood issue #502 came from the author's set-up on 0.17.0, while retiring older per-repo project templates on 2026-11-25. Those templates aren't portable: a per-repo Obsidian vault, bitemporal nodes, a stored hot cache and a lint guardian each contradict the fixed architecture (one brain, Obsidian never required, hot context never stored). One shape in them was worth keeping: a task that says what it produces, how it is accepted, and where work stopped.

Today `brain repo new` has one starter, `generic` (spec/linked-repos.md §7). It writes `TASKS.md` as a checklist of `- [ ] title` lines, `decisions/_template.md` and `docs/`. That fits a small repo. A repo where agents build in sessions, which 0.18.0 calls a Factory (0113), needs more from its task file than a title. This repo's own `build/TASKS.md` already has that shape: a section per task with Output and Acceptance, a `**Stopped:**` line (0074 §4), and a PR template whose acceptance boxes are ticked with evidence.

On 2026-11-27, after decision 0116, the author triaged #502: it belongs in the open core, and it ships in 0.19.0.

## Decision

### 1. A second starter, `factory`
`brain repo new --starter factory` creates a repo meant to be a Factory, beside `--starter generic`, which stays the default and unchanged. Each starter is written once, by `repo new`. A later release doesn't change a repo already made, and an existing repo isn't converted (spec/linked-repos.md §7).

### 2. What the factory starter writes
- **What `generic` writes,** apart from the task file: `README.md`, `CLAUDE.md`, `decisions/_template.md`, `docs/` and the ignore file.
- **`TASKS.md`, one section per task.** A heading with the task's id, title and status; then an `**Output:**` line (what the task produces), an `**Acceptance:**` line (how it is accepted, each criterion checkable), and a `**Stopped:**` line (where work stopped and the next step) while the task is open. No Release or Changelog lines: those are this product's own release machinery.
- **A PR template** whose acceptance boxes are ticked with evidence (a test name, or a command and its output).
- **`AGENTS.md`,** which says how a task is taken and closed:
  - a session starts from the Factory's open tasks (0113 §5);
  - a task gets its section before work starts;
  - the Stopped line is updated when a session ends with the task open;
  - the task is closed when every acceptance criterion has its evidence.
- **The kit** (`brain-kit.json`), with `starter` set to `factory` and a task source that reads the sections (§3).

### 3. The brain reads the same file
- The repo rollup, `brain recall --pack`'s work items (spec/memory.md §5.1, which already reads a `**Stopped:**` line) and the Factory overview's Plan, Building now, Next and Done lately (0113 §6) all read this one `TASKS.md`. The overview is read through `factory read`.
- **Default:** the existing `markdown` source with the `pattern` format (spec/linked-repos.md §2.4), whose example already reads headings of the form `### CC-12 · title · \`status\``. The starter writes the pattern and its `status_map` into the kit. A new source format is added only if the checks (§6) show that `pattern` can't carry what the overview and recall need.

### 4. Core, by the open-core test
It is part of one person's trusted loop: the Factory's work, its handover and its acceptance. So it ships in the open core (0116 §10).

### 5. What it is not
- **No per-task folders** (the retired templates' `tasks/<id>/`): they multiply files the brain never reads, and one section holds the spec, the acceptance and the handover.
- **No per-repo knowledge vault:** knowledge belongs in the brain (0014, 0066).
- **No Notion change:** the user's intent tasks stay in Notion (0113 §3); the detailed plan stays in the folder (0113 §7), and nothing syncs a plan item's status both ways.
- **No new write into an existing repo:** `repo new` writes only the new repo's folder, and `brain link` keeps writing only the kit and its link back (0066).

### 6. The checks, then the contract, with these lines to settle
Agents check, from the code and one synthetic repo, with no sitting by the author:
- whether the `pattern` format reads the section headings, ids and statuses, and the overview and recall read the Output and Stopped lines;
- what `factory read` reads today for a plan;
- the same outcome on macOS and Windows (0104 §7), and in Claude Code and Codex.

The contract then settles, with the author's answers:
- the heading's exact form and the status values (**default:** this repo's `todo`, `in progress`, `review`, `done`, `dropped`);
- the PR template's location and text;
- the factory starter with a connected workflow, where intent lives in Notion and the detailed plan in `TASKS.md` (**default:** `TASKS.md` is always written as the detailed plan, and the kit's tasks mode follows the user's answer at `repo new`, as for `generic`);
- whether `brain link` on an existing repo offers the factory task format (**default:** no; the guide shows the format for a user to copy).

### 7. Release
In **0.19.0**, by explicit roadmap change after the 0.15.0 cutoff, beside the fourteen features of 0112 and Obsidian (0115), whose rules don't change. Its rows:
- the checks and the contract;
- the CLI and the starter files;
- the skill text, in CC-381's one fork release.

0.21.0 translates its texts with the rest (0116 §8). Not in 0.18.0, which is near its release.

## Consequences

- 0.19.0 gains CC-415 (the checks of §6, then the contract), CC-416 (the CLI, the starter's files and the guide lines) and CC-417 (the skill text, in CC-381's fork release), and U-50, the author's use of it after the release.
- spec/linked-repos.md §7 stops calling `generic` the only starter; spec/cli.md §5.29 gains `--starter factory`. Both change in CC-415, not in this decision's PR.
- Dogfood #502 is closed with a pointer to CC-414.
- No Notion database, property or migration; no new everyday tool.

## Evidence

- Dogfood issue #502 (2026-11-25), written from the author's set-up on 0.17.0. Its proposal, the table of the two starters, and the two ideas set aside (per-task folders, a per-repo knowledge vault) are taken into §1, §2 and §5.
- The author's answers on 2026-11-27, after 0116: "core" (which edition it belongs to), then "A" (0.19.0, as a sixteenth feature, recorded as a decision with its rows).
- Read on 2026-11-27: spec/linked-repos.md §2.4 (the `pattern` format and its heading example) and §7 (the generic starter, written once); spec/memory.md §5.1 (recall reads a tracked-in-repo task file's open items and their Stopped line); spec/cli.md §5.29 (`repo new --starter generic`); `templates/repo/generic/`.
