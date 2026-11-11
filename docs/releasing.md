# Releasing

How a change reaches a brain (decision 0038). npm is the only channel: the package `ultimate-brain` ships the CLI, the skills, the brain template and the JSON schemas, and `brain upgrade` writes the skills into a brain for both Claude Code and Codex.

## The rules

- **Main is always releasable.** Merge only what you would publish tonight. A fix the user needs mid-use is an `urgent` task, shipped as a patch the same day.
- **A task belongs to a release** through its `**Release:** x.y.z` line in build/TASKS.md, and, from 0.4.0 on, a `**Changelog:**` line below it: the sentence `release.mjs` puts in the CHANGELOG (decision 0039). PRs don't edit `CHANGELOG.md`; a 0.3.x task still adds its line there by hand. It is set to `done` (#N) in its own PR's last commit, once the review finds nothing left; the reviewer then posts `Review (<agent>): pass at <sha>` for that commit.
- **Merge on the GitHub PR page** once CI and `merge-ready` are green (decision 0040). `merge-ready` shows the format, the ticked boxes, the task's `done` (#N) and a reviewer's pass for the head commit: on a `claude/` PR `Review (Claude reviewer): …` or `Review (Codex): …` (decision 0063; only a comment or review by the repo owner's account counts: every agent posts through it today, an operational assumption, so who wrote a verdict is a convention, not something the check can see). A ruleset on `main` requires it (decision 0073, [below](#the-ruleset-on-main)), so the Merge button stays disabled while it is red. `node scripts/merge.mjs <PR>` does the same checks from the terminal and is optional. `main-guard` fails only on a commit that reached `main` from no PR.
- **When no reviewer can run** (neither the `pr-reviewer` sub-agent nor Codex), post a comment on the PR, `Merged without review: <reason>`, then tick "Merge without waiting for requirements to be met (bypass rules)" and merge. Use the bypass only for a missing reviewer: when `merge-ready` is red for any other reason, the PR is fixed first.
- **Release from the main checkout only** (`~/GitHub/ultimate-brain`, always on a clean `main`). Tasks are built in their own worktrees (`../ub-<ID>`).
- **A brain runs only published versions.** Try a candidate as a prerelease on the `next` tag.

## Once per machine

```sh
npm login
```

Log in as an **owner of the `ultimate-brain` package** (`npm owner ls ultimate-brain`), which may be a different account from your GitHub one. npm requires two-factor authentication to publish. `npm publish` asks for the code in the browser.

## The ruleset on `main`

Decision 0073: a repository ruleset requires the `merge-ready` commit status on `main`. The user turns it on or changes it; agents don't change repository settings. In **Settings → Rules → Rulesets → New branch ruleset**:

- **Name** `main requires merge-ready`, **Enforcement status** Active.
- **Bypass list:** Repository admin, set to **Always allow**, so `release.mjs` can push its release commit.
- **Target branches:** Include default branch.
- **Restrict deletions** and **Block force pushes:** leave them ticked, as the form does by default.
- **Require status checks to pass:** add `merge-ready` with the source **GitHub Actions**. Leave **Require branches to be up to date before merging** off: updating a branch makes a new head without a reviewer's pass.

The same, from the main checkout:

```sh
gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
{
  "name": "main requires merge-ready",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }, {
    "type": "required_status_checks",
    "parameters": {
      "strict_required_status_checks_policy": false,
      "do_not_enforce_on_create": false,
      "required_status_checks": [{ "context": "merge-ready", "integration_id": 15368 }]
    }
  }]
}
JSON
```

`gh api repos/{owner}/{repo}/rulesets` lists it, and `gh pr view <N> --json mergeStateStatus` reads `BLOCKED` on a PR whose `merge-ready` is red. The workflow job that computes the status is named `compute merge-ready`, so the status is the only thing named `merge-ready`.

## Each release

**First, the native smoke run** (decision [0082](../decisions/0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) §1): from 0.13.0 on, a release (patches included) is cut only after 0082's 15 cases pass in Claude Code and in Codex on a package of the head you are about to release. In the main checkout, after `git pull` (the logins are the harness's, [eval/memory-0.12/native/README.md](../eval/memory-0.12/native/README.md)):

```sh
npm ci --prefix eval/memory-0.12/adapters        # once: the tokenizer for retrieval costs
rm -rf /tmp/ub-smoke && mkdir /tmp/ub-smoke && npm pack --pack-destination /tmp/ub-smoke
node eval/memory-0.12/native/run.mjs --package /tmp/ub-smoke/ultimate-brain-*.tgz --commit "$(git rev-parse HEAD)" \
  --out ~/ub-smoke-runs/<version> --claude-config ~/agent-logins/claude --codex-home ~/agent-logins/codex \
  --cases trust-01,trust-04,trust-10,trust-14,trust-18,trust-19,trust-22,trust-29,trust-34,trust-35,trust-39,trust-43,ans-01,ans-39,unk-05
```

In `results.md`, for each agent: critical trust 12 of 12, every session clean in the no-file-read check, isolation clean. Answerable and unknown are reported, not gated, and `met` includes the 90% answerable gate, so judge from those three columns. A failure holds the release: fix it as its own task and rerun on the new head; running the same package again doesn't count. Keep the run folder; nothing is committed. `release.mjs` doesn't check the smoke run. If `main` moves before you release, run it again.

Then:

```sh
cd ~/GitHub/ultimate-brain
git pull
node scripts/release.mjs 0.4.0
```

`release.mjs` (CX-27) refuses, and changes nothing, unless all of these hold:

1. It runs in the main checkout, on `main`, with a clean tree, level with `origin/main`.
2. `npm whoami` names an owner of the package (`npm owner ls`), so the publish can't fail after the commit and tag are made (a package never published yet has no owners and passes).
3. The `CI` workflow passed on that commit (its newest `push` run on `main`; a run for a tag at the same commit does not stand in, because `main-guard` runs only on `main`). A run that is queued, running or not created yet is waited for, up to 10 minutes, unless something else already refuses. Other workflows, such as a red `merge-ready` run that attached to `main` after a PR comment, do not block a release.
4. For 0.4.0 and later: every task of the release that isn't `dropped` has a non-empty `**Changelog:**` line and a `done` (#N) heading. For 0.3.x: `CHANGELOG.md` has a `## 0.3.1` entry.
5. `npm test`, `npm run typecheck` and `npm run test:package` pass.
6. Every task with `**Release:** 0.4.0` is `done`.
7. From 0.9.0 on, the skills-integration check passes (spec/skills-delivery.md §11.3): the package snapshot is valid and doesn't exclude the version, the check's status isn't `unknown`, and no change in the `skills-integration` issue is `unclassified` or has an `error`. Classify open changes in that issue's block first. It uses your `gh` login; `--dry-run` runs the check without writing the issue.
8. From 0.9.2 on (§9.8): the vendored skills pass the online check (`vendor-skills.mjs --check --online`: `.agents/skills/` is a fork release, unedited, and its release on GitHub matches it), so a phase A snapshot is refused on its name; and a release without a prerelease part ships a vendored snapshot without one.
9. The version is not lower than `package.json`'s (§9.4), except a prerelease of that same version (`0.9.2-rc.1` when `package.json` is `0.9.2`). A vendoring PR may already have set `package.json` to the release it lands in; releasing that version keeps it.
10. The version is not lower than the release of any `done` task on `main` whose release has no dated section in CHANGELOG.md yet, a task whose `**Changelog:**` starts `development only` aside: that work would ship in this version under the wrong number (F-0001). The refusal names the tasks. `--allow-partial "<reason>"` releases anyway; the release commit's message then carries the reason and the tasks it leaves out, and a dry run says the same.
11. Some task row on `HEAD`, in build/TASKS.md or build/HISTORY.md, has `**Release:**` this version (for a prerelease, its release: `0.4.0-rc.1` counts the rows of `0.4.0`); a `dropped` row doesn't count. Otherwise: `no task has **Release:** <version>; merge its PR first`. On 2026-11-07, 0.10.1 was published while its only task was still on its branch, with an empty CHANGELOG section and nothing new in it (#250). `--dry-run` refuses it too.

Then it sets the version, writes the CHANGELOG section from the task rows (`- <id> (#N): <text>`, in build/TASKS.md order; for 0.3.x it dates the hand-written entry; from 0.9.0 the section ends with `Skills: <snapshot> <version> (<integrity>)`), commits `0.4.0`, tags `v0.4.0`, publishes and pushes the commit and tag. The release commit comes from no PR, so it has no `merge-ready` status: the push goes through the ruleset's admin bypass, and `git push` says it bypassed the rule. Check with `npm view ultimate-brain version`.

**If the publish fails** (for example E404: the logged-in account isn't an owner), the commit and tag exist only in the main checkout and nothing is pushed. Don't run `release.mjs` again. Fix the cause, then run what it prints: `npm publish && UB_RELEASE=1 git push --follow-tags` (for a prerelease, `npm publish --tag next && …`). If the publish worked and only the push failed, run `UB_RELEASE=1 git push --follow-tags`. A push refused by the ruleset means the bypass list lost the Repository admin role: put it back in the ruleset, then push again. A release whose tag already exists, here or on origin, or whose version is already on npm, is refused before anything changes.

**A patch when `main` is partial** (rule 10): `release.mjs` releases only `main`, so a fix a brain needs before the later release is ready has two routes. Release it from `main` with `--allow-partial "<reason>"`: the later `done` work ships with it, and the release commit lists that work. Or merge the fix and let it wait for the later release. A patch built from the last release tag has no tooling today; it becomes a task if it's ever needed.

- **patch:** fixes only. **minor:** new commands, skill changes, new template rules. Stay below 1.0.0 until v1 is declared stable.
- **A candidate:** `node scripts/release.mjs 0.3.0-rc.1` publishes on the `next` tag, never `latest`.
- **Flags:** `node scripts/release.mjs <version> [--dry-run] [--allow-partial "<reason>"]`, in any order. `--dry-run` runs every check and prints the CHANGELOG section, and changes nothing.

## Vendoring the skills (spec/skills-delivery.md §9)

The brain skills are written in the ultimate-brain-skills fork (`brain/<name>/`), never in this repo. `.agents/skills/` holds one released fork snapshot, committed whole and never edited: `npm test`, `npm run build` and the pre-commit hook run `vendor-skills.mjs --check`, and CI adds `--check --online`.

- **A skill change** is a fork PR (branch `claude/<task-id>-<slug>`), reviewed with the product PR that names it on a `Fork:` line. Once the user merges it and the fork's CI passed on the merge commit, an annotated tag `brain-v<version>` on that commit, pushed only on the user's yes, publishes the release (§9.5).
- **Vendoring:** `node --experimental-strip-types scripts/vendor-skills.mjs <version>` writes the release `brain-v<version>` into `.agents/skills/` after checking its notes, its tarball's hash, its members and its snapshot, and prints what it added, changed and retired. Commit `.agents/skills/` in one commit `<task id>: vendor ultimate-brain-skills <version>`.
- **The version rule** (§9.4): the vendored snapshot is compatible with `package.json`'s version at every commit. When a release's range starts above it, set `package.json` to the release it lands in (`npm version <x.y.z> --no-git-tag-version`) in the vendoring commit; `main` then carries that unpublished version until it is released.
- **Unreleased skill text** in a product branch: `vendor-skills.mjs --local <fork checkout> [--commit <ref>]` builds the fork's committed `brain/` as `0.0.0-local`. It passes `npm test` but never the online check, so it can't reach `main`.
- **An edited copy** fails the check with its reason; restore with `git checkout -- .agents/skills` and `git clean -fdx .agents/skills`, or vendor a release.

## Then, in each brain

```sh
npm install -g ultimate-brain@0.4.0   # the exact version: right after a publish, @latest can still serve the old one
brain --version                       # must print 0.4.0; if not: npm cache clean --force, then install again
cd <your brain> && brain upgrade
```

Run `brain upgrade` only after `brain --version` prints the new version: the old CLI upgrades to itself and changes nothing. `brain upgrade` refuses a brain with uncommitted changes, refreshes the product-owned files (the AGENTS.md rules block, `.agents/skills/`, `.claude/skills/`, `skills.lock.json`), runs lint, commits `upgrade: ultimate brain <version>, skills <snapshot> <version>` and pushes. `skills.lock.json` pins the skill snapshot the brain uses, so Claude Code and Codex load the same version (decision 0059, spec/skills-delivery.md); a brain without one is pinned by its first upgrade.

**To roll back** an upgrade (spec/skills-delivery.md §8), in either order:
1. In the brain: `git revert <upgrade commit>`. It restores the old `skills.lock.json` and the old skill files in one commit.
2. `npm install -g ultimate-brain@<previous_cli>`: the `previous_cli` the upgrade reported, which is also the reverted lock's `installed_by` when there was one. The first pin (a brain's first upgrade to 0.9.0 or later) takes it from the brain's last `upgrade: ultimate brain <version>` commit, and the revert leaves the brain unpinned, as it was. When `previous_cli` is `null`, reinstall the version you ran before (`npm ls -g ultimate-brain` shows it before you install the new one).
3. `brain lint` exits 0 (info issues such as `skills-update-available` don't count).

A later `brain upgrade` with the newer CLI applies the upgrade again. An older CLI refuses to lower the pin (`SKILLS_DOWNGRADE`) instead of doing it silently.

## Findings from a brain

When the product misbehaves in a brain, the agent there files a `dogfood` issue (template `.github/ISSUE_TEMPLATE/dogfood.md`), anonymized, and never patches the brain's copy of a skill. Claude Code triages open `dogfood` issues at the start of each planning session into tasks with a release, or closes them with a reason.
