# Skills inventory and carry-forward mapping (0.9.0)

**Task:** CC-97 · **Decision:** [0059](../decisions/0059-shared-skills-and-connected-workflows.md) · **Plan:** steps 1–2 of [the skills migration plan](skills-migration-plan.md) · **Taken:** 2026-11-03

This file is a snapshot of the skills the user's Claude Code and Codex load. It compares them with upstream [mattpocock/skills](https://github.com/mattpocock/skills) at `a496f5513d4a4cf889bc48e189e579f4b0bdf6aa` (2026-10-29). It changes no installation. A private rollback manifest outside the repo holds the exact paths, a SHA-256 per file and per tree, the revisions, and which agents load each copy. Personal paths, names and client text are left out here.

## 1. Channels and precedence

| Channel | Loaded by | Contents | Installed as |
|---|---|---|---|
| `~/.claude/skills/` | Claude Code | 43 skills from the customised collection, 31 from the SEO pack, `defuddle`, `orchestration` | Symlinks into the collection's working tree; a symlink to Codex's copy of `orchestration`; copied folders for the SEO pack and `defuddle` |
| Account-synced skills | Claude Code (`anthropic-skills:`) | 14: `artifact-emulator`, `built-in-browser`, `chrome-browser`, `computer-use`, `deep-research`, `docs`, `docx`, `google-workspace`, `import-memory`, `morning`, `pdf`, `pptx`, `skill-creator`, `xlsx` | Synced from the Claude account |
| User plugins, enabled | Claude Code (`plugin:skill`) | `n8n-mcp-skills` 1.27.3 (15 skills); `warp` 2.4.0 (hooks only) | Plugin marketplaces |
| User plugins, no skills | Claude Code | `code-review` 1.0.1, `pr-review-toolkit` 1.0.1 (commands and agents) | Official marketplace |
| Plugins scoped to other projects | Claude Code in those projects | `frontend-design`; `visual-explainer` 0.7.1 | Official and third-party marketplaces |
| `ultimate-brain` plugin, brain scope | Nobody: not enabled since 0.2.3 | 6 brain skills at `7dddf45` (2026-10-12), version `0.0.0` | Retired by [0038](../decisions/0038-delivery-lanes-and-release-gates.md); the install record and cache remain |
| `~/.agents/skills/` | Codex, and agents Orca launches | The same 43 collection symlinks, plus `agent-reach`, `orca-cli`, `orchestration` | Symlinks; tool installers |
| `~/.codex/skills/.system/` | Codex | `imagegen`, `openai-docs`, `review-agent`, `skill-creator`, `skill-installer` | Bundled with Codex |
| Brain `.claude/skills/` and `.agents/skills/` | Claude Code and Codex in the brain | The 8 `brain-*` skills | `brain upgrade`; identical to `skills/` at v0.8.0 |
| This repo's `.agents/skills/` | Codex in the product repo | The 8 `brain-*` skills | Generated from `skills/` by `scripts/build-skills.ts` |
| Session-injected | Claude Code under Orca | `orca-native-chat:orca-chat-visuals` | Orca |

**Precedence.** In Claude Code, a personal skill overrides a project skill of the same name, and plugin skills are namespaced so they don't collide. Codex reads the repo's `.agents/skills/` and `~/.agents/skills/` together and doesn't merge same-name skills. Today no name is in both a personal and a project location, so nothing is shadowed.

**One working tree for both agents.** Both personal folders symlink into a single working tree of the customised collection, a public GitHub fork of upstream (public by the user's choice, 2026-11-03; it is the account's one GitHub fork of upstream, so ultimate-brain-skills is a standalone repository). That tree is on an unmerged sync branch, one commit ahead of the fork's `main`, and has one uncommitted file (in `diagram-design`). So both agents load unreleased content. Under 0059, the switch in step 6 installs released snapshots instead.

## 2. The customised collection against upstream

The collection imported upstream (last synced to upstream v1.3), adapted it to the Sentina repos (a `.sentina/` config, Notion task lifecycle, `feat/tarea-*` branches, evidence files, a `wiki/` vault, some Spanish text), and added third-party skills. It also holds seven skills that neither agent loads, so the manifest doesn't list them: `git-guardrails-claude-code`, `setup-pre-commit`, `loop-me` and `writing-fragments` (identical to upstream), `writing-beats` and `writing-shape` (dashes only), and `chief-of-staff` (cut from about 68 lines to 28, dropping upstream's wiki-memory and sub-agent rules).

Classes: **as-is** (identical to upstream); **upstream + tweaks** (cosmetic, a Sentina path, or stale/regressed text); **mixed** (a reusable part and a Sentina part); **Sentina-specific**; **third-party** (general skills from other open-source collections).

| Skill | Class | What differs from upstream |
|---|---|---|
| `grill-with-docs`, `prototype`, `writing-for-agents` | as-is | Nothing |
| `codebase-design`, `improve-codebase-architecture`, `research`, `tdd`, `triage` | upstream + tweaks | Glossary, decision or output path under `wiki/` in Sentina repos; drops "fresh context window" phrasing, the setup hint and, in `tdd`, the per-seam catch/miss note |
| `diagnosing-bugs` | upstream + tweaks | Sentina glossary path; drops the "diff against a pristine copy" mutation check |
| `wizard` | upstream + tweaks | Not customised, only stale: lacks upstream's safer `template.sh` (quoted `.env` handling, 0600 mode, EOF handling) |
| `grilling`, `handoff` | upstream + tweaks | Regressions: lost "word each question so yes accepts the recommendation", the fresh-context fact-finder, the explicit temp paths |
| `teach`, `to-questionnaire`, `wait-what` | upstream + tweaks | Output or glossary paths in Sentina repos; `teach` drops answer-position randomisation |
| `retro` | mixed (mostly reusable) | Shorter rewrite: evidence per candidate, "don't implement unless asked", a category list |
| `pr` | mixed | Reusable: Evidence and "merge danger" (two-way or one-way door) sections. Sentina: the PR is blocked until the evidence files pass. Lost: upstream's worked examples |
| `code-review` | mixed | Reusable: merge-base with `main` as the default fixed point. Sentina: invariants, evidence files, the Notion task as spec. Lost: issue-reference lookup, spec search, fresh context |
| `to-tickets` | mixed | Reusable: map a Notion tasks database by property type, with blocking relations. Sentina: the manifest keys. Lost: the configured-tracker mapping |
| `implement-spec` | mixed | Reusable: clearer structure, "stop if there's no spec or ticket graph". Sentina: the Notion "in progress" lock and evidence gates. Lost: draft PR step, exploration sub-agent |
| `wayfinder` | mixed | Sentina: decision paths. Lost: the label-typed ticket rules |
| `implement`, `to-spec` | Sentina-specific | Replaced wholesale by the Sentina task lifecycle (branch naming, guardian script, evidence, CRM and knowledge-graph checks) |
| `grill-me` | Sentina-specific | Upstream's stub that calls `grilling` became a Spanish skill that requires a Sentina repo |
| `domain-modeling` | Sentina-specific | Rewritten in Spanish around the `wiki/context/` vault, with a generic fallback |
| `ask-sentina` | Sentina-specific | Replaces upstream `ask-matt`: keeps the skill chain, makes the main flow the Notion task lifecycle, drops the phase-boundary guidance |
| `setup-sentina` | Sentina-specific | Replaces upstream `setup-matt-pocock-skills`: Notion only. Drops the GitHub, GitLab and local-file trackers, triage labels and the domain-doc layout |
| `acceptance-test` | Sentina-specific | Hand-written: a manual acceptance gate before the PR |
| `api-and-interface-design`, `code-simplification`, `constraint-driven-development`, `deprecation-and-migration`, `doubt-driven-development` | third-party | From `addyosmani/agent-skills`, unmodified. Credited only in the collection's CHANGELOG; no licence in the skill |
| `git-workflow-and-versioning`, `security-and-hardening` | third-party + Sentina overlay | Same origin. Sentina added branch naming and a "Sentina secrets" section |
| `excalidraw`, `skill-architect`, `the-fool`, `the-jury` | third-party | From `tech-leads-club/agent-skills`, CC-BY-4.0, author lines present (`excalidraw` rewritten to write files) |
| `playwright-skill`, `subagent-creator` | third-party | Via `tech-leads-club/agent-skills`, MIT, author lines present |
| `visual-explainer` | third-party | `nicobailon/visual-explainer`, MIT; one output-path hint added. Also installed as a plugin (0.7.1) in another project |
| `diagram-design` | unresolved | MIT in its frontmatter, but no origin is named. Probably `cathrynlavery/diagram-design` (MIT), not yet confirmed by a diff. Has the uncommitted edit |

Upstream skills not installed: `ask-matt` and `setup-matt-pocock-skills` (replaced by the two Sentina skills), `migrate-to-shoehorn`, `scaffold-exercises`, and the `in-progress/` skills, including `claude-handoff` and `setup-ts-deep-modules`, which the collection lacks.

Licensing gaps: the collection's MIT `LICENSE` names only its owner, and it has no NOTICE for the CC-BY-4.0 and third-party MIT content. The `addyosmani/agent-skills` imports (that repo is MIT) carry no licence line. GitHub reports no single licence for `tech-leads-club/agent-skills`, so the per-skill frontmatter is the only licence record.

## 3. Everything else

| Skill or group | Class | Source and revision |
|---|---|---|
| SEO pack: `seo` and 30 `seo-*` skills, plus 18 `seo-*` sub-agents | SEO pack | `AgriciDaniel/claude-seo` 2.2.5, MIT; Claude Code only |
| `brain-apply`, `brain-catch-up`, `brain-connect-notion`, `brain-howto`, `brain-ingest`, `brain-notion-change`, `brain-query`, `brain-sync` | product (brain skills) | This repo's `skills/`, v0.8.0 in the brain; two installed copies per brain plus this repo's generated mirror, all identical |
| `defuddle` | local-only | Hand-written wrapper for the `kepano/defuddle` CLI; Claude Code only |
| `agent-reach` | local-only | The Agent Reach tool's installer; Codex only |
| `orca-cli`, `orchestration` | local-only | Installed by Orca; `orchestration` reaches Claude Code through a symlink |
| Account-synced skills (14) | local-only | Claude account |
| `orca-native-chat:orca-chat-visuals` | local-only | Injected by Orca into its chat sessions; not on disk in a skills folder |
| Codex system skills (5) | local-only | Bundled with Codex |
| `n8n-mcp-skills` (15 skills) | local-only | `czlonkowski/n8n-skills` 1.27.3 at `408670d` |
| `ultimate-brain` plugin record | duplicate (stale) | `7dddf45`, not enabled; superseded by the brain copies (0038) |

## 4. Duplicates and overlaps

- **Same skill twice, by design:** each of the 43 collection skills is one folder reached from both agents' folders; `orchestration` is one folder with a symlink. The 8 `brain-*` skills have one source and three generated copies.
- **Same name, different content:** `skill-creator` (account-synced for Claude Code, bundled for Codex). Each agent loads only its own.
- **Same skill from two sources:** `visual-explainer` (the collection, and a plugin scoped to another project). The stale `ultimate-brain` plugin cache next to the brain copies.
- **Overlapping behaviour:** `grill-me`, `grilling`, `grill-with-docs`; `skill-architect`, `subagent-creator`, `skill-creator`, `writing-for-agents`; the `code-review` skill, the `code-review` plugin, `pr-review-toolkit` and this repo's `pr-reviewer` agent.

## 5. Unresolved

- `diagram-design`: the origin is probable, not confirmed. It can't go into a public fork until a diff against the probable source confirms it.
- The `addyosmani/agent-skills` imports (MIT) need attribution before they are redistributed.

## 6. Mapping

Actions: **keep** (the fork carries upstream's text), **adapt** (the fork carries it with a marked local addition), **isolate** (the private Sentina profile carries it, outside the fork), **retire** (no future source), **untouched** (stays where it is, outside the migration). Each behaviour has one future source.

| Behaviour | Action | Single future source |
|---|---|---|
| `grill-with-docs`, `prototype`, `writing-for-agents` | keep | Fork, upstream text |
| `codebase-design`, `improve-codebase-architecture`, `research`, `tdd`, `triage`, `diagnosing-bugs`, `wizard`, `grilling`, `handoff`, `teach`, `to-questionnaire`, `wait-what` | keep: reset to upstream, which drops the tweaks and regressions | Fork, upstream text |
| `code-review`, `implement-spec`, `to-tickets`, `wayfinder`, `retro` | keep: upstream text; the reusable parts in §2 aren't carried | Fork, upstream text |
| `implement`, `to-spec`, `grill-me`, `domain-modeling` (general versions) | keep | Fork, upstream text |
| `pr` | adapt: upstream plus the Evidence and "merge danger" sections, without the Sentina gate | Fork, marked local addition |
| Routing and setup (`ask-matt`, `setup-matt-pocock-skills`) | adapt: upstream names and text; setup gains a fourth tracker choice, "Connected: Notion through a brain", off by default (0059); the router routes to it | Fork, marked local addition |
| Connected Notion task mapping | adapt: written from the brain's Tasks contract in `spec/`; nothing comes from the Sentina recipe | Fork's connected workflow (0059) |
| `brain-*` skills | adapt: authorship moves to the fork in step 4; brains keep pinned snapshots | Fork; this repo ships the released snapshot |
| Third-party general skills: `api-and-interface-design`, `code-simplification`, `constraint-driven-development`, `deprecation-and-migration`, `doubt-driven-development`, `git-workflow-and-versioning`, `security-and-hardening`, `excalidraw`, `playwright-skill`, `skill-architect`, `subagent-creator`, `the-fool`, `the-jury`, `visual-explainer` | adapt: attributed local additions with licence lines and a NOTICE; the Sentina overlays (branch names, "Sentina secrets", the output-path hint) are stripped | Fork, attributed |
| `diagram-design` | adapt once its origin is confirmed; until then it stays where it is | Unresolved (§5) |
| Sentina skills: `ask-sentina`, `setup-sentina`, `acceptance-test` and the Sentina versions of `implement`, `to-spec`, `grill-me`, `domain-modeling` | isolate: renamed with a `sentina-` prefix so no name collides with the fork, and installed only in Sentina repos' project folders | Private Sentina profile |
| Sentina conventions: `wiki/` paths, `feat/tarea-*` branches, evidence files and gates, the Notion "in progress" lock, review invariants, the secrets rules | isolate: one set of profile rules, not edits in the fork's skills | Private Sentina profile |
| The reusable parts not chosen: the Notion property-mapping recipe, the merge-base default, "stop if there's no spec", the `retro` rewrite; the collection's `chief-of-staff` rewrite | retire | None |
| Stale `ultimate-brain` plugin record and cache | retire in step 6 | None |
| Upstream skills not installed today (`git-guardrails-claude-code`, `setup-pre-commit`, `migrate-to-shoehorn`, `scaffold-exercises`, `in-progress/`) | keep: the fork has them as upstream's text; installed only if selected later | Fork, upstream text |
| SEO pack, `defuddle`, `agent-reach`, the Orca skills (including the session-injected `orca-chat-visuals`), account-synced skills, Codex system skills, `n8n-mcp-skills`, the other plugins | untouched: step 6 removes none of them; listed so the switch can check it left them alone | Their current installers |

**Approval:** approved by the user in the CC-97 grill, 2026-11-03. Their answers: reset the tweaked skills to upstream; carry only `pr`'s reusable sections; isolate the Sentina skills in a prefixed, project-scoped profile; carry the third-party skills attributed; extend upstream's router and setup; write the connected task mapping from the brain contract; leave local-only skills untouched; retire only the stale plugin.
