# 0103 — First things first, and upgrades with unrelated work

**Status:** Accepted
**Date:** 2026-11-17
**Release:** 0.16.1
**Amends:** [0038](0038-delivery-lanes-and-release-gates.md), "The brain is always pushed" (an upgrade refuses conflicting uncommitted work, rather than every dirty tree); [0078](0078-onboarding-and-early-access-in-0-14-0.md) §2 (explicit agent and button setup in the duplicated template)
**Keeps:** [0061](0061-roadmap-and-launch-boundary.md)'s feature cutoff; [0077](0077-trust-repair-in-0-13-0.md) §4's coordinated upgrade; [0101](0101-where-notion-ai-and-the-brain-each-write.md) §7's plan and credits requirement and §8's 1.0.0 placement

## Context

Duplicating the Notion template does not deliver a configured Brain Assistant in the user's workspace. The template says to point it at the copy, but leaves whether the agent and its button bindings survive duplication as a check. A user needs visible steps to create their own agent, give it access, replace the page mentions in its instructions and skill prompts, and select it in the buttons.

`brain upgrade` refuses whenever Git reports an uncommitted change, with no paths in its error. An unrelated new diagram or draft therefore blocks an upgrade. The upgrade already plans its writes and stages their paths, but a plain `git commit` would also commit unrelated changes the user had staged if the blanket check were simply removed.

The author accepted both fixes for 0.16.1 in the opening scope review. This is a bounded setup and upgrade repair before 1.0.0; it adds no knowledge feature.

## Decision

### 1. First things first in Notion

- Add a **First things first** checklist in System, linked prominently from **Start here**, to the published template. System remains a callout on the top page (0085); the checklist may be a linked child page, rather than turning System into a page.
- Say explicitly that the user must create their own **Brain Assistant**, with no automatic triggers, then grant it access to **Brain Data**, **How it works** and **Skills** under their own top page. Mentions in instructions do not grant access.
- Give the instructions to paste and identify the mentions to replace in the agent's Instructions and skill prompts. Each must point to the user's duplicated pages, with no working reference to the template author's space. Use the existing product text as the source, rather than maintaining another copy of its instructions.
- Tell the user to select their own agent in each **Send message to** action: **Tidy capture**, **Write up** and **Refresh report**. Preserve each message's skill name, confirmation and **This page** reference. Distinguish selecting the agent from mentioning the page in its message.
- Include the note: **Open Claude Code or Codex in your brain folder and say "set up my brain" to connect and populate your brain.** Link the installation steps for a user who has not created that folder yet. This is the existing guided setup, including its seeding preview and consent, not a second population flow.
- Finish with **Run Today** and a check of the three buttons on disposable sample pages. The guided setup records Brain Assistant ready only after the scope check and button checks pass. Where the API cannot inspect a button or the agent's configuration, the user performs the UI check and reports its result; the agent must not claim to have verified it through the API.
- Keep the Business or Enterprise with Notion credits requirement visible. The path without Notion AI and the agent rename stay in 1.0.0.

### 2. Existing spaces get the checklist

Ship a Notion migration that adds the checklist and the Start here link to an existing space, without creating a second checklist on a rerun. Preserve a working agent and its bindings; an existing user checks or repairs them rather than being asked to create another agent. Publish the same checklist in the template. Keep the setup contract, guides, prompts, and the fork's setup/how-to skills consistent.

### 3. Upgrade around unrelated uncommitted work by default

- An ordinary `brain upgrade` proceeds when uncommitted files are unrelated to its changes. This includes untracked diagrams and drafts, modified tracked files, and staged or partly staged files.
- Preserve their bytes and staging state. Commit only the upgrade's changes. Do not automatically commit the user's work, stash it, reset it, or clean it away. Keep the existing push and linked-project rules.
- Before any write, compare uncommitted work with the complete set of files the upgrade would create, update, remove or move. Include the monthly log, configuration, generated files and legacy migrations, not only the skills. Account for rename endpoints and file/directory collisions.
- A conflict blocks the upgrade before writes and reports **every conflicting path**, why it conflicts, and a concrete resolution. A dirty file the upgrade does not need to change is not a conflict. Generated content must not silently incorporate uncommitted user edits into the upgrade commit; define those input dependencies in the contract and report a conflicting dependency when needed.
- Human and JSON output, including `--dry-run`, distinguish unrelated changes from blocking conflicts. A user should not have to search a long `git status` list to find what prevented the upgrade.
- Preserve the checks for an unresolved merge or another unsafe Git operation. Define commit-failure recovery and guard against files changing between planning and writing in the contract. A failure must not consume unrelated staged work.

## Delivery and acceptance

CC-335 writes the contracts first. CC-336 implements the upgrade and its preservation tests; CC-337 writes the Notion checklist, migration and guides; CC-338 delivers the setup/how-to changes through the skills fork and vendors its released snapshot. Claude Code builds; each PR gets independent review, and the user merges. U-37 covers publishing the template and the fresh-duplicate checks that require the Notion UI. The normal release checks and native smoke gate still apply.

This planning task changes only this decision, the release/task plan and the vision's release note. It operates on no personal brain or live Notion space, and does not release a package.

## Evidence

The author's answers in the scope review of 2026-11-17: accepted the checklist in the published template and a migration for existing users, adding the note to ask Claude Code or Codex to run setup to populate the brain; accepted upgrades around unrelated changes as the default, without automatically committing or stashing the user's work.
