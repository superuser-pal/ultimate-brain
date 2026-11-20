# 0097 — Easy setup on Windows and Mac, and MarkItDown required for early access

**Status:** Accepted
**Date:** 2026-11-16
**Release:** 0.15.2
**Amends:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) §2, as already amended by [0086](0086-the-brain-works-on-main-and-early-access-requires-gh.md) §3: "MarkItDown and the schedule stay optional" becomes "the schedule stays optional"; MarkItDown, with the Python it needs, is a required prerequisite for early access, like `gh`
**Keeps:** every other rule of 0078 and 0086; 0016 (TypeScript on Node, minimal dependencies: MarkItDown stays an external tool the agent runs, never a dependency of the CLI); 0075's weekly review and `brain schedule`'s launchd support on macOS
**Amended by:** [0104](0104-product-design-principles.md) (2026-11-17): identical macOS and Windows capabilities, including scheduling, are the target of a post-1.0 parity epic; §4's current limitation remains until scoped implementation delivers it
**Amended by:** [0110](0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) (2026-11-20; 0.17.0): §4: Windows gets a Task Scheduler entry for the catch-up and the weekly review, and setup's schedule item is offered there too

## Context

The first beta tester set up on Windows on 2026-11-15. Her session, shared by the author, shows six problems:

1. **The agent took the developer path.** Asked to "clone and help me set up" both repositories, it cloned them, built the CLI from source, linked it globally and ran the full test suite: more than 20 minutes, with failures that said nothing about her setup. A user needs neither repository: `npm install -g ultimate-brain` is the install, and the skills ship inside the package (0069). Nothing in either repository tells an agent that a person setting up should follow Get started instead.
2. **Node and `gh` were missing,** and the guides only say how to get them on a Mac: README Get started step 1 gives `brew install gh` and "open the Terminal app"; spec/setup.md §6.1 gives `darwin` a command and every other platform a link.
3. **Newly installed tools weren't found.** Windows gives an updated PATH only to terminals opened after the install; the Claude app's terminal keeps the PATH the app started with. No guide says so.
4. **`brain init --set-default` failed:** it reads the `HOME` variable (`src/commands/init.ts`, `writeDefaultConfig`), which Windows doesn't set; the rest of the CLI uses Node's `homedir()`.
5. **The brain had no first commit:** Git had no name or email, and `init` reported it only as a warning the tester never saw.
6. **`brain` was still not found** after refreshing PATH in the same terminal. The cause is not known; she was running a build linked from her clone, not the published package.

Reading the code for the same path found three more Windows risks: `init` doesn't expand `~`, and Windows PowerShell 5.1 passes `~/brain` through literally; CI runs on Ubuntu only, so no Windows run of the tests exists; and `brain schedule` manages launchd on macOS only.

A Mac has its own rough spots on the same path: Homebrew is not installed on a new Mac, so `brew install gh` fails there; with Node from the nodejs.org installer, `npm install -g` usually fails on folder permissions; the first `git` opens Apple's developer-tools installer, a download of several minutes that nothing announces; and the Git identity is unset, as on Windows.

Issue #388 (filed 2026-11-15) asks for MarkItDown to become required: Codex can't read PDFs without it, Claude Code can't read Word, PowerPoint or Excel files, seeding asks for exactly those documents, and first value's cited answer needs exact quotes.

The author's answers in the scope grill of 2026-11-15: ship it as a 0.15.2 patch, now that testers are live; per-platform steps in the guides plus a prompt a user pastes into their agent, not an install script; a Windows CI job, with the weekly review run by hand on Windows; and MarkItDown required, in this plan. The author confirmed the plan on 2026-11-16.

## Decision

### 1. Setup has a Windows path and a Mac path, written out

- **Get started step 1 splits by platform,** each with the commands to paste:
  - **Windows:** one `winget install` line for Node (LTS), Git, the GitHub CLI and Python, then "close every terminal and quit and reopen the Claude app (or Codex), so they find what you installed", then MarkItDown. Commands are written for PowerShell.
  - **Mac:** Homebrew first (its one-line install, or the GitHub CLI's and Python's own installers for someone who won't use Homebrew), then Node, `gh`, Python and MarkItDown through Homebrew and `pipx`, so a global npm install needs no admin rights; a note that the first `git` may open Apple's developer-tools installer, and to let it finish.
  - **Both:** set Git's name and email (`git config --global user.name` / `user.email`) before `brain init`, and sign in with `gh auth login`.
- **spec/setup.md §6.1 gives each prerequisite a command per platform** (`darwin` and `win32`), not a command for macOS and a link for the rest. Linux keeps the links.
- **docs/setup.md gains a Windows section under "When something goes wrong":** a command not found after an install (open a new terminal, or reopen the app), PowerShell's script execution policy blocking `brain`, and where npm puts global commands.

### 2. An agent asked to set up follows Get started, never the developer path

- **A setup prompt in Get started** that the user can paste into Claude Code or Codex: install the published package with npm, follow Get started, never clone this repository or the skills repository, never build or run their tests.
- **Both repositories say it at the top:** the product's README and `AGENTS.md`, and the skills repository's README: "Setting up a brain? You don't need to clone this. Follow Get started." `AGENTS.md` stays the developers' guide below that line.

### 3. `brain init` works on Windows and doesn't leave a brain without its first commit

- `--set-default` finds the home folder with `homedir()`, as the rest of the CLI does.
- `init` expands a leading `~` in the brain path itself, whatever the shell did.
- **A missing Git identity stops `init` before it writes anything,** with the two `git config` lines to run and the same command to retry; `--no-git` still skips Git entirely. The exact rule and error code are the contracts' (spec/cli.md).

### 4. Windows is tested in CI; the weekly review is run by hand there

- CI gains a `windows-latest` job running the test suite; tests that fail there are fixed or, when they test a macOS-only feature (launchd), skipped on Windows with the reason in the test.
- `brain schedule` stays launchd-only. On Windows the weekly review is run by asking the agent for it; docs/setup.md and the setup's schedule item say so, and the item is shown as not available there. Windows Task Scheduler support is not part of this decision.

### 5. MarkItDown is required for early access

- **Setup step 1 checks Python and MarkItDown** (`markitdown --version`) with the other prerequisites. Missing, it stops with the install steps for the platform and the reason code `markitdown-missing`, logged like `gh-missing` (0086 §3); asked again, it re-runs the check.
- **The settings screen's MarkItDown item is shown `on` and locked,** as the `gh` item is since 0086, and setup writes `settings.markitdown` `on`.
- MarkItDown remains an external command the agent runs; the CLI gains no dependency on it or on Python (0016). When 1.0 makes `gh` optional again (0086 §3), MarkItDown's place is decided at the same grill.

### Out of scope

An install script (`install.ps1`, `install.sh`) or installer package; Windows Task Scheduler for `brain schedule`; Linux-specific guidance beyond the links; WSL; any change to what the CLI does on macOS other than the `init` rules of §3.

## Consequences

- [build/TASKS.md](../build/TASKS.md) gains, in 0.15.2: CC-290 (contracts: spec/setup.md §6.1 per-platform commands, `markitdown-missing`, the locked MarkItDown item; spec/cli.md for `init`), CC-291 (the `init` fixes of §3), CC-292 (the Windows CI job and its fixes), CC-293 (the guides of §1 and §2 in this repository), CC-294 (brain-setup's step 1 and settings item through a skills fork release, then vendored).
- 0.15.2 is a patch with a CLI change and a skills release; it is released before 0.16.0.
- Issue #388 is closed into CC-290 and CC-294.
- 0078 and 0086 get a header pointer to this decision; their bodies stay as recorded.
- This is a planning record: no CLI, spec, skill, template or guide change starts with it.

## Evidence

- The beta tester's Windows setup session of 2026-11-15, shared by the author in the planning session (not quoted here: it holds a tester's account details).
- `src/commands/init.ts` `writeDefaultConfig` (`process.env.HOME`) and `initializeGit` (the commit skipped with a warning); `src/lib/brain-path.ts` and the other commands use `homedir()`.
- README Get started step 1 and spec/setup.md §6.1: macOS commands, a link for other platforms.
- `.github/workflows/ci.yml`: every job `runs-on: ubuntu-latest`.
- `src/commands/schedule.ts`: launchd on `darwin` only.
- Issue #388, "Make MarkItDown a required setup prerequisite".
- The scope grill of 2026-11-15 and the author's confirmation of 2026-11-16.
