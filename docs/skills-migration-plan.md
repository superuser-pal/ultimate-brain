# Skills migration plan for 0.9.0

**Authority:** [decision 0059](../decisions/0059-shared-skills-and-connected-workflows.md). This is future implementation guidance; recording it neither creates the fork nor changes installed skills.

## 1. Inventory without changing installations

List active installation channels, names, source revisions and precedence for Claude Code and Codex. Compare the user's customised global collection with a pinned upstream revision and the product's editable brain skills. Produce a sanitised inventory: upstream content, reusable customisations, specialised Sentina assumptions, duplicates and local-only material. Keep personal paths, credentials, identities and private text outside product artifacts.

Completion: every active skill has an identified source or an explicit unresolved origin; retain a private rollback manifest of the current installations.

## 2. Review what to carry forward

Show which customisations are retained, adapted, isolated behind an explicitly selected profile or retired. Preserve useful conventions; remove implicit dependence on a different Notion schema or delivery lifecycle. The shared standard/connected selection owns routing. Resolve incompatible rules with the user before rewriting them.

Completion: an approved mapping identifies each retained behaviour and its single future source; no wholesale copy of specialised assumptions.

## 3. Establish the fork and its contracts

Create the public fork with attribution/licence, recorded upstream base and distinguishable local additions. Set up compatibility metadata, immutable released artifacts, integrity checks and reviewable upstream updates. Keep general and brain installation selections explicit. Changes involving CLI/data/Notion contracts link to product tasks.

Completion: a released snapshot can be reproduced and checked against a declared CLI version; credentials/configuration are absent from public content.

## 4. Move source and preserve delivery

Move canonical brain skill authorship to the fork. Adapt the product's build to consume an exact released snapshot; generated distribution copies are never edited. Specify init/link/upgrade/lint changes first. Preserve read-only linked-repo behaviour and existing brains until their deliberate upgrade. A broken/missing/incompatible snapshot fails before affected writes.

Completion: the product package delivers a tested compatible snapshot for both agents; historical installed versions keep working. Avoid a transition that requires upgrading both repositories at the same instant.

## 5. Validate isolated installations

Use synthetic projects and isolated agent skill locations. Verify effective discovery, version agreement, missing-snapshot detection, duplicate names and standard/connected selection. Exercise adoption on an existing Markdown plan, a real-tracker-shaped synthetic backlog and an Area-only general-work example. Reuse shared retry/conflict tests.

Completion: installation and adoption evidence identifies the effective source in each agent; no real brain is the first integration test.

## 6. Switch deliberately

Present the installation diff and rollback steps. Install selected global general skills and the compatible local brain snapshot, then remove only the superseded installations identified by the inventory. Preserve user-owned rules and unrelated skills. Verify the effective loaded versions and project settings in a fresh session of each agent.

Completion: one effective definition per skill; the upgrade and any remaining publication work are durably recorded. A failed switch preserves the last working path.

## 7. Exercise rollback and ongoing updates

Restore the previous package/snapshot and installation manifest in the isolated trial, preserving knowledge and user configuration. Document how to recover credentials through reauthorisation rather than committing them. Run update automation against a compatible change, an incompatible change, an unreleased change and an unavailable source; verify one outstanding integration issue and no false current status.

Completion: rollback is demonstrated, not merely described; pending integration work remains visible until resolved.
