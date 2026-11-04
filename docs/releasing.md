# Releasing

How a change reaches a brain (decision 0038). npm is the only channel: the package `ultimate-brain` ships the CLI, the skills, the brain template and the JSON schemas, and `brain upgrade` writes the skills into a brain for both Claude Code and Codex.

## The rules

- **Main is always releasable.** Merge only what you would publish tonight. A fix the user needs mid-use is an `urgent` task, shipped as a patch the same day.
- **A task belongs to a release** through its `**Release:** x.y.z` line in build/TASKS.md, and, from 0.4.0 on, a `**Changelog:**` line below it: the sentence `release.mjs` puts in the CHANGELOG (decision 0039). PRs don't edit `CHANGELOG.md`; a 0.3.x task still adds its line there by hand. It is set to `done` (#N) in its own PR's last commit, once the review finds nothing left; the reviewer then posts `Review (<agent>): pass at <sha>` for that commit.
- **Merge on the GitHub PR page** once CI and `merge-ready` are green (decision 0040). `merge-ready` shows the format, the ticked boxes, the task's `done` (#N) and a reviewer's pass for the head commit: on a `claude/` PR `Review (Claude reviewer): …` or `Review (Codex): …` (decision 0063; only a comment or review by the repo owner's account counts: every agent posts through it today, an operational assumption, so who wrote a verdict is a convention, not something the check can see); it informs and can't block the click. `node scripts/merge.mjs <PR>` does the same checks from the terminal and is optional. `main-guard` fails only on a commit that reached `main` from no PR.
- **Release from the main checkout only** (`~/GitHub/ultimate-brain`, always on a clean `main`). Tasks are built in their own worktrees (`../ub-<ID>`).
- **A brain runs only published versions.** Try a candidate as a prerelease on the `next` tag.

## Once per machine

```sh
npm login
```

Log in as an **owner of the `ultimate-brain` package** (`npm owner ls ultimate-brain`), which may be a different account from your GitHub one. npm requires two-factor authentication to publish. `npm publish` asks for the code in the browser.

## Each release

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

Then it sets the version, writes the CHANGELOG section from the task rows (`- <id> (#N): <text>`, in build/TASKS.md order; for 0.3.x it dates the hand-written entry; from 0.9.0 the section ends with `Skills: <snapshot> <version> (<integrity>)`), commits `0.4.0`, tags `v0.4.0`, publishes and pushes the commit and tag. Check with `npm view ultimate-brain version`.

**If the publish fails** (for example E404: the logged-in account isn't an owner), the commit and tag exist only in the main checkout and nothing is pushed. Don't run `release.mjs` again. Fix the cause, then run what it prints: `npm publish && UB_RELEASE=1 git push --follow-tags` (for a prerelease, `npm publish --tag next && …`). If the publish worked and only the push failed, run `UB_RELEASE=1 git push --follow-tags`. A release whose tag already exists, here or on origin, or whose version is already on npm, is refused before anything changes.

- **patch:** fixes only. **minor:** new commands, skill changes, new template rules. Stay below 1.0.0 until v1 is declared stable.
- **A candidate:** `node scripts/release.mjs 0.3.0-rc.1` publishes on the `next` tag, never `latest`.

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
