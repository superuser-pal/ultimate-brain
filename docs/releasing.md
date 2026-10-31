# Releasing

How a change reaches a brain (decision 0038). npm is the only channel: the package `ultimate-brain` ships the CLI, the skills, the brain template and the JSON schemas, and `brain upgrade` writes the skills into a brain for both Claude Code and Codex.

## The rules

- **Main is always releasable.** Merge only what you would publish tonight. A fix the user needs mid-use is an `urgent` task, shipped as a patch the same day.
- **A task belongs to a release** through its `**Release:** x.y.z` line in build/TASKS.md, and, from 0.4.0 on, a `**Changelog:**` line below it: the sentence `release.mjs` puts in the CHANGELOG (decision 0039). PRs don't edit `CHANGELOG.md`; a 0.3.x task still adds its line there by hand. It is set to `done` (#N) in its own PR's last commit, once the review finds nothing left; the reviewer then posts `Review (<agent>): pass at <sha>` for that commit.
- **Merge on the GitHub PR page** once CI and `merge-ready` are green (decision 0040). `merge-ready` shows the format, the ticked boxes, the task's `done` (#N) and the other agent's pass for the head commit (only a comment or review by the repo owner's account counts); it informs and can't block the click. `node scripts/merge.mjs <PR>` does the same checks from the terminal and is optional. `main-guard` fails only on a commit that reached `main` from no PR.
- **Release from the main checkout only** (`~/GitHub/ultimate-brain`, always on a clean `main`). Tasks are built in their own worktrees (`../ub-<ID>`).
- **A brain runs only published versions.** Try a candidate as a prerelease on the `next` tag.

## Once per machine

```sh
npm login
```

npm requires two-factor authentication to publish. `npm publish` asks for the code in the browser.

## Each release

```sh
cd ~/GitHub/ultimate-brain
git pull
node scripts/release.mjs 0.4.0
```

`release.mjs` (CX-27) refuses, and changes nothing, unless all of these hold:

1. It runs in the main checkout, on `main`, with a clean tree, level with `origin/main`.
2. CI passed on that commit.
3. For 0.4.0 and later: every task of the release that isn't `dropped` has a non-empty `**Changelog:**` line and a `done` (#N) heading. For 0.3.x: `CHANGELOG.md` has a `## 0.3.1` entry.
4. `npm test`, `npm run typecheck` and `npm run test:package` pass.
5. Every task with `**Release:** 0.4.0` is `done`.

Then it sets the version, writes the CHANGELOG section from the task rows (`- <id> (#N): <text>`, in build/TASKS.md order; for 0.3.x it dates the hand-written entry), commits `0.4.0`, tags `v0.4.0`, publishes and pushes the commit and tag. Check with `npm view ultimate-brain version`.

- **patch:** fixes only. **minor:** new commands, skill changes, new template rules. Stay below 1.0.0 until v1 is declared stable.
- **A candidate:** `node scripts/release.mjs 0.3.0-rc.1` publishes on the `next` tag, never `latest`.

## Then, in each brain

```sh
npm install -g ultimate-brain@latest
cd ~/brain && brain upgrade
```

`brain upgrade` refuses a brain with uncommitted changes, refreshes the product-owned files (the AGENTS.md rules block, `.agents/skills/`, `.claude/skills/`), runs lint, commits `upgrade: ultimate brain <version>` and pushes.

**To roll back:** `npm install -g ultimate-brain@<previous>`, then `git revert` the upgrade commit.

## Findings from a brain

When the product misbehaves in a brain, the agent there files a `dogfood` issue (template `.github/ISSUE_TEMPLATE/dogfood.md`), anonymized, and never patches the brain's copy of a skill. Claude Code triages open `dogfood` issues at the start of each planning session into tasks with a release, or closes them with a reason.
