# 0086 — The brain works on its main branch with no pull requests, and early access requires `gh`

**Status:** Accepted
**Date:** 2026-11-12
**Release:** 0.14.0
**Amends:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) §2, two sentences: "Optional, explained and stored as a setting rather than skipped: MarkItDown, the schedule and `gh`" (`gh` is required for early access; MarkItDown and the schedule stay optional) and "a private remote (created with `gh repo create --private` when `gh` is signed in, otherwise the steps)" (for early access, always created with `gh`; the steps for another Git host return at 1.0)
**Keeps:** every other rule of 0078; 0038's `settings.push` default `auto`; 0040 and 0073 (this product repository's own pull requests, merged by the author on GitHub, are unchanged); Markdown + Git canonical with a private remote (docs/vision.md)

## Context

The author asked, on 2026-11-12, before inviting the first testers: they are fine merging every pull request of the product themselves, but **operating a brain must never need a pull request**, neither for the author nor for a tester. Testers are not GitHub experts.

What the repositories show:
- **An Ultimate Brain brain already has none.** Every skill commits on the brain's branch and pushes after the run (`templates/brain/AGENTS.md`, "Write path"; `settings.push: auto`, 0038). The author's own brain has one branch and no pull request.
- **The pull requests the author remembered came from older knowledge repositories** built before Ultimate Brain, whose own instructions use a branch and a pull request for every change.
- **Nothing in a brain says not to.** The brain's rules say "commit" and "push", never "stay on this branch". Coding agents bring habits from code repositories (create a branch first, open a pull request), and a user's global agent instructions can ask for them. A tester's agent following those habits would leave the tester a pull request to merge on GitHub, or work stranded on a branch the next run never sees.

Setup (0078 §2, spec/setup.md §7) treats `gh` as optional. Without it, the tester creates an empty repository on the website, copies its URL, runs `git remote add` and pushes by hand; GitHub no longer accepts a password for a push, so they also need a token or an SSH key, which setup doesn't cover. That path is where a non-expert stops. With `gh` signed in, one browser login (`gh auth login`) gives the repository, Git's credentials, the privacy check and the issue filing.

The author's answers: "for my dev cycle is ok, but for my brain operations it should merge without me (or the users) merging each PR in github"; on requiring a GitHub account and `gh` for early access: "yes, i am ok".

## Decision

### 1. A brain has one working branch, and no pull requests

- **Every write to a brain is committed on its working branch** (the branch `brain init` started it on, normally `main`) and pushed per `settings.push`. No agent creates a branch, a worktree, a pull request or a merge request in a brain, and no step ever asks the user to merge on GitHub.
- **The brain's rules say so,** in the product-owned rules block of `templates/brain/AGENTS.md` ("Write path"): work on the brain's working branch, never open a branch or a pull request in the brain, whatever the agent's habits in code repositories or the user's global instructions say. It reaches existing brains through `brain upgrade`.
- **Linked repositories keep their own rules.** A linked project's branches and pull requests are its own (0059, 0066); the one write the brain gets from there, a memory (spec/memory.md), is committed on the brain's working branch.

### 2. A brain found off its working branch is brought back without GitHub

- **`brain status` reports it:** a warning when the brain's checkout is not on its working branch (another branch, or a detached HEAD), and when a local branch holds commits the working branch lacks. How the working branch is found, and the warning's code and fields, are the contracts' (CC-235).
- **An attended session** that sees the warning says it in one line and, on a yes, brings the work back locally: switch to the working branch, merge the other branch into it, delete that branch, push. Never through a pull request. A conflict stops with the files named and nothing pushed.
- **An unattended run** (0051) on another branch writes nothing and reports the reason; the next attended session offers the fix.

### 3. Early access requires a GitHub account and `gh` signed in

- **`gh` becomes a required prerequisite for early access** (setup step 1). Missing or signed out, setup stops with two steps: install it (`brew install gh` on macOS, else the link to its install page) and run `gh auth login` in the terminal, choosing to let it set up Git's credentials, then say "set up my brain" again.
- **The private remote is always created by setup** with `gh repo create --private`, and its privacy re-checked online as today. `settings.gh` is recorded `on`.
- **The setup report and product findings** are filed with `gh` after the user's yes, as today.
- **The path for another Git host** (the manual steps of spec/setup.md §7) stays written and returns at 1.0, when `gh` becomes optional again; how is decided at 1.0's opening grill (0061).

### 4. Testers read "backup", not Git words

- In what a user reads (the settings screen, run reports, setup messages), the remote is **the backup**: "Backup: a private GitHub repository, created for you"; the `settings.push` item reads "Back up after each run: on / remind me". A failed push ends a report with "Not backed up: <reason>. Say "fix my backup"." Git words appear when the user asks for the details.
- **"Fix my backup"** runs the backup's checks in order (`gh` signed in, `origin` set, the remote private, the brain on its working branch, a push) and fixes each it can on a yes, or gives the one step the user must take. A push refused because the backup holds commits this copy lacks is named, and nothing is merged automatically (Out of scope).
- `settings.push` and its values keep their names; only the words shown change.

### Out of scope

The product repository's own review and merge flow (0040, 0073); Git hosts other than GitHub for early access; a brain used from two machines (pulling before a push, or merging a backup that moved), recorded in `docs/v2-ideas.md`; any automatic merge of diverged histories; a change to what a commit holds or when a run commits.

## Consequences

- [build/TASKS.md](../build/TASKS.md) gains CC-235 (contracts), CC-236 (the CLI and the brain's rules block), CC-237 (the skills, through the fork and a brain-v1.8.2 release) and CC-238 (the guides' prerequisites) in 0.14.0, and CC-193's gate checks that setup opened no branch or pull request.
- 0078 gets a header pointer to this decision; its body stays as recorded.
- This is a planning record: no CLI, spec, skill, template or README change starts with it.

## Evidence

- The author's conversation of 2026-11-12, quoted in Context.
- `templates/brain/AGENTS.md` "Write path" and every brain skill's push step (`.agents/skills/brain-*/SKILL.md`): commit and push, no branch rule.
- spec/setup.md §7 (items 3, 8 and 11, and "Applying it"): `gh` optional, the manual remote path.
- The author's brain, read 2026-11-12: one branch, no pull request, nothing unpushed.
