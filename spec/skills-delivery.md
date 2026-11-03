# Pinned skill delivery (contract, decision 0059)

**Status:** contract for release 0.9.0, written in CC-98. **CC-100** builds the CLI side (§2 to §9) against a local fixture snapshot; **CC-101** builds the fork side (§10, §11.1, §11.4, §12); CC-105 switches the package to the fork's snapshot (§9, phase B); CC-106 builds update awareness on the product side (§11.2, §11.3). Each section names its builder.

How this file fits: [cli.md](cli.md) §5.28 holds the CLI rules every command follows (the pin guard, error codes, `status` output); this file holds the formats and the changes to `init`, `link`, `upgrade`, `lint` and the package check. Sections of cli.md this file amends (§5.1, §5.2, §5.10, §5.12, §5.15, §3.5) are rewritten by the task that implements the change, in the same PR as its code. The JSON Schemas are [skills-snapshot.schema.json](schemas/skills-snapshot.schema.json), [skills-lock.schema.json](schemas/skills-lock.schema.json) and [skills-integration.schema.json](schemas/skills-integration.schema.json), with examples in `spec/examples/skills/`.

**Choices this contract makes that the user may veto** (each is the simplest reading of 0059; none contradicts it):
1. The brain records its pin in a new product-owned file, `skills.lock.json`, not in `brain.json`, so the pin changes only through `brain upgrade` and `brain.json` stays the user's. (§3)
2. The brain's committed skill copies are the pinned snapshot. `brain link` copies `brain-query` from the brain, not from the CLI package, so a linked repo gets the brain's version. (§6.2)
3. A pin that excludes the running CLI stops every brain command except `status`, `lint`, `upgrade` and `recover`. Drifted bytes in a skill file are a lint error, not a stop. (cli.md §5.28)
4. Competing copies are reported and never deleted: an error inside the brain, a warning in the user's global skill folders. (§5)
5. The CLI never installs general skills. They float globally and are never pinned. (§4)
6. The assessed revision and the classified changes live in the one open integration issue, in a machine-readable block, so the daily check writes no commits. (§11.2)
7. Until CC-105, the package keeps building its snapshot from the product's `skills/` folder, under the snapshot name `ultimate-brain`. (§9)

---

## 1. Terms

- **Operational skill:** a skill that operates a brain (`brain-*`). It is pinned per brain. Product-owned once installed.
- **General skill:** any other skill in the fork (engineering, writing, workflows). Installed globally by the user and released independently. Never pinned, never written by the CLI.
- **Snapshot:** an immutable, released set of operational skills plus its manifest, `snapshot.json` (§2).
- **Pin:** the snapshot a brain uses, recorded in `skills.lock.json` (§3) and installed in the brain's `.agents/skills/` and `.claude/skills/`.
- **Package snapshot:** the snapshot the installed npm package ships, at `<package root>/.agents/skills/` (cli.md §5.15 defines the package root).
- **Running CLI version:** the `version` of the package root's `package.json`.

## 2. Snapshot format (CC-100 reads it, CC-101 produces it)

A snapshot is a folder:

```text
snapshot.json
<skill name>/SKILL.md
<skill name>/<other files…>
```

Any other top-level entry is an error: a `README.md` at the top level is allowed and ignored, since today's mirror has one. `snapshot.json` follows [skills-snapshot.schema.json](schemas/skills-snapshot.schema.json):

```json
{
  "format": 1,
  "name": "ultimate-brain-skills",
  "version": "1.2.0",
  "cli": ">=0.9.0 <0.10.0",
  "source": { "repository": "https://github.com/example/ultimate-brain-skills", "commit": "4b1e…(40 hex)" },
  "upstream": { "repository": "https://github.com/mattpocock/skills", "commit": "a496…(40 hex)" },
  "integrity": "sha256-…(64 hex)",
  "skills": [
    { "name": "brain-apply", "targets": ["brain"],
      "files": [ { "path": "SKILL.md", "sha256": "…(64 hex)", "bytes": 5120 } ] },
    { "name": "brain-query", "targets": ["brain", "linked_repo"],
      "files": [ { "path": "SKILL.md", "sha256": "…", "bytes": 3010 },
                 { "path": "references/report.md", "sha256": "…", "bytes": 1404 } ] }
  ]
}
```

| Field | Meaning |
|---|---|
| `format` | `1`. A reader that meets another value treats the snapshot as invalid. |
| `name` | `ultimate-brain-skills` for a fork release; `ultimate-brain` for a snapshot the product builds from its own `skills/` (transition, §9). |
| `version` | SemVer 2.0.0 of this snapshot. Comparable only between snapshots with the same `name`. |
| `cli` | Declared CLI range (§2.1). |
| `source` | Where it was built. `repository` is an `https://` URL. `commit` (40 lowercase hex) is required when `name` is `ultimate-brain-skills`; for `ultimate-brain` it is optional. |
| `upstream` | The upstream base: the upstream repository and the exact upstream commit the fork had merged when this snapshot was built. Required (an object) for `ultimate-brain-skills`; `null` for `ultimate-brain`. |
| `integrity` | `sha256-` + 64 lowercase hex (§2.2). |
| `skills` | Sorted by `name`, unique names. Each skill: `name` (lowercase kebab-case, equal to its folder), `targets` (sorted, unique, always contains `brain`; `linked_repo` when `brain link` installs it), `files` (sorted by `path` in byte order, unique paths, contains `SKILL.md`). |
| `files[]` | `path` relative to the skill folder, `/` separators, no `.` or `..` segment, no empty segment, no leading `/`. `sha256` of the file's bytes, lowercase hex. `bytes` its size. |

Files are compared and written as bytes. Snapshots carry no file modes, symbolic links or empty folders: a reader that finds a symbolic link or a non-regular file inside a skill folder treats the snapshot as invalid.

### 2.1 CLI range

Grammar: one or more comparators separated by single spaces. Each comparator is an operator `>=`, `>`, `<=`, `<` or `=` followed by a SemVer 2.0.0 version without build metadata (`0.9.0`, `0.9.0-rc.1`). The schema enforces the grammar.

A version **satisfies** the range when it satisfies every comparator under SemVer 2.0.0 precedence, prerelease identifiers included. This is not npm's range rule: `0.9.0-rc.1` does not satisfy `>=0.9.0`, and it does satisfy `<0.10.0`. A snapshot that should accept the release candidates of 0.9.0 declares `>=0.9.0-0`. No dependency is added for this: the comparison fits in a small function with its own tests.

### 2.2 Integrity

1. For every file of every skill, form the line `<sha256 hex>  <skill name>/<path>\n` (two spaces, LF).
2. Sort the lines by `<skill name>/<path>` in UTF-8 byte order.
3. `integrity` = `sha256-` + the lowercase hex SHA-256 of the concatenated lines, UTF-8 encoded.

`snapshot.json` itself and a top-level `README.md` are not covered.

### 2.3 Validating a snapshot

A snapshot is **valid** when all of these hold. The first failure is the reason the CLI reports:

1. `snapshot.json` exists, parses as JSON and passes its schema.
2. Skill names are unique, and every skill's folder exists. No skill folder exists that the manifest doesn't list.
3. Within each skill, the folder holds exactly the files listed (no more, no fewer), as regular files, with the listed `bytes` and `sha256`.
4. `integrity` equals the value recomputed by §2.2.

A snapshot is **compatible** with a CLI version when it is valid and that version satisfies its `cli` range.

## 3. The brain's pin: `skills.lock.json` (CC-100)

A product-owned file at the brain root, committed with the brain, written only by `brain init` and `brain upgrade`. It follows [skills-lock.schema.json](schemas/skills-lock.schema.json):

```json
{
  "format": 1,
  "installed_by": "0.9.0",
  "snapshot": { "format": 1, "name": "ultimate-brain", "version": "0.9.0", "cli": ">=0.9.0 <0.10.0", "…": "the manifest, verbatim" }
}
```

- `installed_by`: the running CLI version that wrote the lock. Rollback and the `SKILLS_INCOMPATIBLE` message use it.
- `snapshot`: the installed snapshot's `snapshot.json` object, copied field for field.
- Written as JSON with 2-space indent, the keys in the order above (the manifest's keys in the order of the §2 example), and a trailing newline. Nothing time-dependent is written, so two upgrades to the same snapshot produce identical bytes.

**What the pin means:** the brain's `.agents/skills/<name>/` and `.claude/skills/<name>/` hold, for each skill in `snapshot.skills`, exactly the listed files and bytes. Both agents therefore read the same version (§5.1).

**States** (used by `status`, `lint` and the pin guard of cli.md §5.28):

| State | When |
|---|---|
| `unpinned` | no `skills.lock.json` (a brain made before 0.9.0; the transition, §9) |
| `invalid` | the lock exists but is not JSON or fails its schema |
| `incompatible` | the lock is valid, and the running CLI version doesn't satisfy `snapshot.cli` |
| `missing` | compatible, but a pinned skill's `SKILL.md` is absent from `.agents/skills/<name>/` or `.claude/skills/<name>/` |
| `drift` | compatible, every `SKILL.md` present, but some pinned file is missing or differs, or a pinned skill folder holds a file not listed |
| `pinned` | none of the above |

`missing` checks only the `SKILL.md` files, so the guard stays cheap. `drift` needs the full file comparison and is computed only by `status`, `lint`, `upgrade` and `link`.

## 4. Global general skills vs brain-pinned operational skills

| | Operational | General |
|---|---|---|
| Source | the fork's operational folder (after CC-105; today the product's `skills/`) | the fork's general folders |
| Released as | a snapshot (§2), tag `brain-v<version>` | the fork's own tags, outside this contract |
| Installed by | `brain init` / `brain upgrade` into the brain; `brain link` (only `targets` with `linked_repo`) into a linked repo | the user, by the fork's install instructions, into `~/.claude/skills/` and `~/.agents/skills/` |
| Pinned | per brain, by `skills.lock.json` | never |
| Updated by | `brain upgrade` only | the user, any time |

- **Names are disjoint.** A general skill never uses an operational skill's name. The fork's CI enforces it (§10.3).
- **A global update cannot replace a pin.** The CLI never reads or writes a global skill folder except to report competing copies (§5). A global copy named like an operational skill is a competing copy, never a source.

## 5. Duplicate and competing copies (CC-100)

### 5.1 How Claude Code and Codex resolve the same version

- Both agents load the operational skills from the brain repo itself: Claude Code from `.claude/skills/<name>/`, Codex from `.agents/skills/<name>/`.
- `init` and `upgrade` write both trees from one snapshot in one commit, and lint checks both against the lock. So when the state is `pinned`, both agents see identical bytes.
- An agent can confirm its version by calling `brain status --json` (`data.skills`, cli.md §5.28).
- The only way to break this is a second definition of the same skill name that the agent also loads. §5.2 detects those.

### 5.2 What is detected

For each name `N` in the pin (or, while `unpinned`, each skill in the package snapshot):

| Kind | Where | Lint rule | Severity |
|---|---|---|---|
| `duplicate` | inside the brain: a folder under `.agents/skills/` or `.claude/skills/` other than `N/` whose `SKILL.md` frontmatter `name` is `N` | `skill-duplicate` | error |
| `global` | `~/.claude/skills/N/`, `~/.agents/skills/N/` or `~/.codex/skills/N/` exists (as a folder or a link to one) | `skill-competing` | warning |
| `plugin` | `~/.claude/settings.json` or the brain's `.claude/settings.json` has `enabledPlugins` key `ultimate-brain@ultimate-brain` set to `true` (the retired plugin, 0038) | `skill-competing` | warning |

- `~` is the `HOME` environment variable, which tests point at a temporary folder. Paths are reported with the literal `~/` prefix, never expanded, so no machine path appears in output, lint or logs.
- An unreadable `SKILL.md` or settings file is skipped silently: it is not a competing definition the CLI can prove.
- A global copy is reported even when its bytes equal the pin. It loads next to the pin, and the next upgrade makes them differ.
- The CLI never deletes, edits or renames a competing copy. The message says what to remove; removing it is the user's or the setup skill's job (migration plan step 6).

### 5.3 Where it is reported

- `lint`: the rules above. A global copy's issue has `path` = `~/.claude/skills/N` (and so on), `line` 1, `id` null.
- `status`: `data.skills.competing`, a list of `{ "kind": "duplicate"|"global"|"plugin", "name": "N", "path": "…" }`, sorted by path.
- `init`, `upgrade` and `link`: the same list as `data.skills.competing`, plus one warning `SKILLS_COMPETING` when it is non-empty. These commands never refuse because of it.

## 6. Command changes

These amend the cli.md sections named. The task that implements a change rewrites that section.

### 6.1 `brain init` (cli.md §5.1, CC-100)

- **Before any write:** validate the package snapshot (§2.3) and check that the running CLI version satisfies its range. If either fails, refuse with `SKILLS_SNAPSHOT_INVALID` (exit 3), whose message names the reason and says to reinstall the CLI (`npm install -g ultimate-brain@<running version>`). Nothing is written.
- **Step 3 changes:** copy every skill of the package snapshot (each skill's listed files, not the whole folder) into both `.agents/skills/<name>/` and `.claude/skills/<name>/`. Then write `skills.lock.json` (§3), listed in `created`. `README.md` and `snapshot.json` are not copied.
- **`--force`:** existing skill files are skipped, as today, and listed in `skipped`. An existing `skills.lock.json` is skipped too. A skipped skill file can leave the brain in `drift`, which lint reports.
- `data.skills` = `{ "name", "version", "competing": [...] }`.

### 6.2 `brain link` (cli.md §5.12, CC-100)

- **Guard:** the brain must pass the pin guard (cli.md §5.28). Otherwise link refuses before any write.
- **Source of the skill:** for every skill whose `targets` include `linked_repo`:
  - **Pinned brain:** copy the files listed in the lock from the brain's `.agents/skills/<name>/`, after checking that their bytes match the lock. If any is missing or differs, refuse with `SKILLS_SNAPSHOT_MISSING` (exit 3), message: run `brain upgrade` in the brain, which rewrites the pinned files, then link again.
  - **`unpinned` brain:** copy from the package snapshot, as today, and add warning `SKILLS_UNPINNED`.
- Both folders in the linked repo are still written and pruned exactly as §5.12 step 3 says, now against the chosen source's file list.
- **`.brain` gains `skills`**, written after `stacks` in the key order: `{ "name": "<snapshot name>", "version": "<version>", "integrity": "<integrity>" }`, replaced on every run. With an `unpinned` brain it records the package snapshot. The `brain-query` skill compares it with `brain status --json` `data.skills` and, when they differ, tells the user to run `brain link` again.
- Competing copies in the linked repo (§5.2 `duplicate`, checked in that repo's two skill trees) and in the global folders go to `data.skills.competing` and add warning `SKILLS_COMPETING`.

### 6.3 `brain upgrade` (cli.md §5.15, CC-100)

**Before any write**, in addition to today's checks, in this order:
1. **Package snapshot.** It must be compatible with the running CLI version. Otherwise refuse with `SKILLS_SNAPSHOT_INVALID`.
2. **Existing lock.**
   - Missing: `from` is `null`.
   - Not JSON or failing its schema: it is replaced, with warning `SKILLS_LOCK_REPLACED`, and `from` is `null`.
3. **Same `name`, lower `version`.** When the lock's snapshot has the same `name` as the package snapshot and a higher `version`, refuse with `SKILLS_DOWNGRADE` (exit 5). The message names both versions and says to install the CLI that wrote the lock (`npm install -g ultimate-brain@<installed_by>`), or to roll back as §8 says.
4. **Same `name`, same `version`, different `integrity`.** A released snapshot changed, which violates immutability. Refuse with `SKILLS_SNAPSHOT_INVALID`, reason `same version, different content`.
5. A **different `name`** (the switch from `ultimate-brain` to `ultimate-brain-skills`, §9) is an ordinary upgrade. No version comparison applies.

**Step 3 changes:**
- For each skill of the package snapshot, in both trees: write each listed file whose bytes differ (`created`/`updated`), and remove files in that skill's folder that the snapshot doesn't list (`removed`).
- **Retired skills:** a skill in the old lock but not in the new snapshot has its folder removed from both trees. Each file is listed as `removed`, and the emptied folder is removed too. Without an old lock, folders the snapshot doesn't name are left alone, as today, since the CLI can't tell a retired skill from the user's own.
- **New step 3a:** write `skills.lock.json` (`created`/`updated`). It is staged and committed with the other files (§5.15 step 8).

**Output:**
- `data.skills` = `{ "from": { "name", "version" } | null, "to": { "name", "version" }, "retired": ["<skill name>", …], "previous_cli": "<old installed_by>" | null, "competing": [...] }`.
- The commit message gains the snapshot: `upgrade: ultimate brain <version>, skills <snapshot name> <snapshot version>`.
- `--dry-run` reports the same fields and writes nothing.
- Lint after the upgrade (step 7) reads the new lock.

### 6.4 `brain lint` (cli.md §5.10, CC-100)

- **`product-file` for skills** compares the brain's two trees against the **lock**, not the package. That way a newer compatible CLI doesn't report a pinned brain as drifted. The cases are the same as today: a pinned skill folder missing from a tree, a listed file missing or with different bytes, an unlisted file in a pinned skill's folder. Messages name the snapshot (`ultimate-brain-skills 1.2.0`) and say to run `brain upgrade` or file a finding. While `unpinned`, lint compares against the package snapshot, as today. The `AGENTS.md` rules block is still compared against the package (it is not part of a snapshot).
- New rules:

| Rule | Sev | When |
|---|---|---|
| `skills-lock` | error | `skills.lock.json` is not JSON or fails its schema. Skill comparisons for `product-file` are skipped for that run. |
| `skills-incompatible` | error | the lock is valid, and the running CLI version doesn't satisfy `snapshot.cli`. The message is the `SKILLS_INCOMPATIBLE` message (cli.md §5.28). Path `skills.lock.json`. |
| `skills-unpinned` | info | no lock. Message: run `brain upgrade` to pin the skills. Path `skills.lock.json`. |
| `skills-update-available` | info | the package snapshot has the same `name` as the pin and a higher `version`, or a different `name` (the §9 switch), and is compatible with the running CLI. Message names both versions. Path `skills.lock.json`. |
| `skill-duplicate` | error | §5.2 |
| `skill-competing` | warning | §5.2 |

### 6.5 `brain status` (cli.md §5.2, CC-100)

It gains `data.skills`, defined in cli.md §5.28.

## 7. Missing or incompatible snapshot: stop before writes

The pin guard (cli.md §5.28) decides which commands stop and which messages they print. Summary:

| Situation | Who stops | Code | What the message tells the user |
|---|---|---|---|
| Package snapshot invalid or excludes the running CLI | `init`, `upgrade`, and `link` on an `unpinned` brain | `SKILLS_SNAPSHOT_INVALID` | reinstall the CLI: `npm install -g ultimate-brain@<running version>` |
| Lock `invalid` | every guarded command | `SKILLS_PIN_INVALID` | run `brain upgrade` (it replaces the lock) |
| Lock `incompatible`, CLI newer than the range | every guarded command | `SKILLS_INCOMPATIBLE` | run `brain upgrade`; or keep these skills with `npm install -g ultimate-brain@<installed_by>` |
| Lock `incompatible`, CLI older than the range | every guarded command | `SKILLS_INCOMPATIBLE` | install the CLI that pinned them: `npm install -g ultimate-brain@<installed_by>` |
| State `missing` | every guarded command | `SKILLS_SNAPSHOT_MISSING` | run `brain upgrade` (it rewrites the pinned files) |
| A pinned file drifted, during `link` | `link` | `SKILLS_SNAPSHOT_MISSING` | as above |
| Same name, lower version, during `upgrade` | `upgrade` | `SKILLS_DOWNGRADE` | install the CLI that wrote the lock, or roll back (§8) |

"Newer than the range" means the running version fails a `<` or `<=` comparator; "older" means it fails a `>`, `>=` or `=` comparator. When it fails both kinds (impossible for a sane range), the message gives both remedies.

A skill that gets one of these codes stops the operation and passes the message to the user. It never falls back to another skill copy, another tracker or a guess (0059).

## 8. Rollback (CC-100)

**After an upgrade the user wants to undo:**
1. In the brain: `git revert <upgrade commit>`. This restores the old lock and the old skill files in one commit.
2. `npm install -g ultimate-brain@<previous_cli>` (the `previous_cli` the upgrade reported; also the old lock's `installed_by`).
3. `brain lint`. It is clean, because the pin guard and `product-file` read the restored lock.

Two consequences follow:
- The order of steps 1 and 2 doesn't matter: `git revert` is not a brain command, so the guard doesn't apply to it.
- A later `brain upgrade` with the newer CLI re-applies the upgrade. `SKILLS_DOWNGRADE` only stops an older CLI from silently lowering a pin.

**A failed upgrade** restores every file it replaced (cli.md §3.6), lock included, so the last working pin stays.

**Acceptance (CC-100):** a test upgrades a fixture brain from snapshot A to B, reverts the commit, runs the A-compatible CLI version (simulated by the running version, §12.1), and gets state `pinned` and a clean lint.

docs/releasing.md and the brain's AGENTS.md block gain these steps when CC-100 ships.

## 9. Transition: today's delivery keeps working

| Phase | Package snapshot | Brain |
|---|---|---|
| Before 0.9.0 | `.agents/skills/` with no manifest | no lock |
| **A** (CC-100, 0.9.0) | `.agents/skills/` + `snapshot.json` generated from the product's `skills/`: `name` `ultimate-brain`, `version` = the package version, `cli` = `>=<package version> <<major>.<minor+1>.0>`, `upstream` `null`, `source.repository` the product repo, `source.commit` optional | `unpinned` until its first `brain upgrade`, then pinned to `ultimate-brain <version>` |
| **B** (CC-105) | the fork's released snapshot, copied verbatim (its `snapshot.json` included) | the next `brain upgrade` switches the pin to `ultimate-brain-skills <version>` (§6.3 rule 5) |

Phase A rules:
- `skills/` stays the one editable source. `scripts/build-skills.ts` mirrors it to `.agents/skills/` as today.
- **`snapshot.json` is generated, not committed.** It is written to `.agents/skills/snapshot.json` by `npm run build` (so also by `prepack`), from the mirror and `package.json`'s version. It is listed in `.gitignore`. `build-skills.ts --check` ignores it. The tests that need a package snapshot build one in a temporary folder.
- **An `unpinned` brain works as before:** the guard lets every command through, lint compares against the package, and the only new output is the `skills-unpinned` info.
- **CLIs before 0.9.0** ignore `skills.lock.json`, which is not in a note folder. If one runs `brain upgrade` on a pinned brain, it rewrites the skill files without touching the lock. The next 0.9.0+ lint reports the result as `product-file` drift, and `brain upgrade` with 0.9.0+ repairs it.
- **No step needs both repositories upgraded at once.** Phase A ships without the fork. Phase B needs only a fork release that declares a range including the CLI being released.

Phase B (CC-105) is out of this contract's acceptance. It must keep these interfaces: the package path `.agents/skills/`, the manifest format, and the lock format. Only the snapshot's origin changes.

## 10. The fork: ultimate-brain-skills (CC-101)

The repository is created only with the user's yes (0059, grill 2026-11-03). Everything below is what it must provide. Its internal tooling is its own.

### 10.1 Layout and attribution

- `LICENSE`: the upstream licence, kept with the upstream copyright line, plus the fork's own line.
- `NOTICE.md`: the upstream repository URL, a statement that the fork is derived from it, and how local additions are distinguished.
- `upstream.json`: `{ "repository": "https://github.com/mattpocock/skills", "commit": "<40 hex>" }`, the upstream commit last merged. Only an upstream-sync PR (§10.5) changes it.
- Upstream content stays in upstream's paths. Operational skills live under one folder of their own (e.g. `brain/<name>/`). General local additions live in folders upstream doesn't use. The path tells local from upstream.
- `snapshot.config.json`: `{ "cli": "<range>" }`, the declared CLI range of the next snapshot release, changed by PR.
- No credentials, personal paths, names or brain content anywhere (0014, 0059). The fork's CI runs the same kind of leak check as this repo (decision 0038's rules, with the fork's own allowlist).

### 10.2 Building and releasing a snapshot

- A build script produces the §2 folder from the operational folder:
  - `name` `ultimate-brain-skills`;
  - `version` from the release tag;
  - `cli` from `snapshot.config.json`;
  - `source.commit` = the commit built;
  - `upstream` = `upstream.json`;
  - files and `integrity` per §2.2.
- **Reproducible:** building the same commit twice yields byte-identical `snapshot.json` (sorted keys as in §2's example, 2-space indent, trailing newline) and identical files.
- **Release:** pushing tag `brain-v<version>` runs a workflow that:
  - builds the snapshot;
  - refuses if a GitHub release with that tag already exists, or if `version` is not higher than every earlier `brain-v` tag;
  - attaches the asset `ultimate-brain-skills-<version>.tar.gz`, whose root holds `snapshot.json` and the skill folders;
  - puts `integrity` in the release notes.
- **Immutable:** a released tag is never moved or deleted, and its asset never replaced. A fix is a new version. The product side detects a violation (§6.3 rule 4).

### 10.3 The fork's CI on every PR

1. **Skill rules:** the same frontmatter and style rules as this repo's `scripts/build-skills.ts` (name = folder, `name` and `description` only, description ≤ 1024 characters, references one level deep, no capitals for emphasis).
2. **Disjoint names:** no general skill uses an operational skill's name.
3. **Snapshot builds and validates** (§2.3) when the operational folder or `snapshot.config.json` changes.
4. **Impact declaration** (§10.4).

### 10.4 Impact declaration (every PR)

The PR body contains exactly one line matching `^Brain impact: (none|compatible|coordinated)$`.

| Value | Meaning | Also required |
|---|---|---|
| `none` | no file in the operational folder or `snapshot.config.json` changes | — |
| `compatible` | operational skills change but keep working with every CLI in the declared range | — |
| `coordinated` | needs a product change: a new CLI command or field, a range change, a renamed or retired skill | at least one line `Product: https://github.com/<owner>/ultimate-brain/(issues\|pull)/<n>` |

The check fails when:
- the line is missing, duplicated or has another value;
- `none` is declared but the operational folder or `snapshot.config.json` changed;
- `snapshot.config.json`'s `cli` changed and the value isn't `coordinated`;
- `coordinated` has no `Product:` line.

It checks the link's form only. The product repo is private, and the fork's token can't read it. The product's daily check (§11.2) is where the link is followed.

### 10.5 Upstream changes

- **Daily** (scheduled workflow, 05:00 UTC, and on manual dispatch), the workflow compares upstream's default-branch head with `upstream.json`.
- **When they differ,** it updates the branch `upstream-sync`: `main`, plus a merge of the upstream head, plus `upstream.json` set to that head. It then opens or updates one PR titled `Upstream sync to <7-hex>`. The body lists upstream's commits and says `Brain impact: unassessed`, so the impact check fails until a person or agent sets a real value.
- **A merge conflict** pushes nothing and opens or updates one issue labelled `upstream-sync`, naming the upstream head and the conflicting paths.
- **Never auto-merged.** The user merges.

## 11. Update awareness

### 11.1 Revisions (CC-101 produces them, CC-106 records them)

- **Tested revision:** the snapshot the product's `main` ships, i.e. its package `snapshot.json`.
  - In phase A, `name` `ultimate-brain` and the package version.
  - In phase B, the fork's `version` and `source.commit`.
  - Each product release records it: the release's CHANGELOG section gets one line `Skills: <name> <version> (<integrity>)`, which `release.mjs` writes (CC-106).
- **Assessed revision:** the newest fork revision (a released snapshot, or an unreleased `main` commit) whose impact on the product has been classified. It lives in the integration issue (§11.2), never in the package.

### 11.2 The one integration issue (CC-106)

- **In the product repo** there is at most one open issue labelled `skills-integration`, titled `Skills integration: <N> open change(s)`.
- **Its body** ends with one block:
  ```text
  <!-- skills-integration
  { …JSON per skills-integration.schema.json… }
  -->
  ```
  - The check rewrites only that block. Text above it is kept.
  - `tested`: the tested revision (§11.1).
  - `seen`: the fork head and latest release found by the last successful check.
  - `assessed`: the newest revision whose changes are all classified.
  - `changes`: one entry per fork release after `assessed` (`kind` `release`, with its `release` version), plus at most one `unreleased` entry for the commits after the latest release. `from`/`to` are the fork commits the entry covers. `impact` is the strongest declaration among its merged PRs (`coordinated` > `compatible` > `none`), or `undeclared` when a PR has no valid line. `links` holds the product issues or PRs, `note` the classifier's reason, and `error` a problem the check found (a dead link). When the check runs again, it extends the open `unreleased` entry's `to` instead of adding another, and turns it into a `release` entry when those commits are released, keeping its classification. Each entry has a `classification`:
    - `unclassified`: set by the check.
    - `ready`: deliberate upgrade possible.
    - `brain-work`: linked brain work required; needs `links`.
    - `no-action`: reviewed, nothing to do.
  - `last_check`: `{ "at", "status": "ok"|"unknown", "error" }`.
- **Classifying.** Claude Code classifies changes in a planning session by editing the block. It moves `assessed` forward only when every change up to that revision has a classification other than `unclassified`.
- **Seeing a change never dismisses it.** A `brain-work` change stays listed, with its links, until its task is `done` and the product's tested revision includes it. A `ready` change stays until the tested revision includes it.
- **Closing.** The issue is closed when `changes` is empty after that pruning. Otherwise it stays open, and only one issue is used:
  - a second open issue with the label makes the check report `unknown` (error `two integration issues`) and change nothing;
  - with none open and a change to record, it opens one.

### 11.3 When the check runs (CC-106)

| When | How | On failure |
|---|---|---|
| **Daily** | product workflow `skills-integration`, 06:00 UTC and on manual dispatch | `last_check.status` `unknown` with the error; the workflow fails, so GitHub notifies the owner |
| **Start of product work** | `scripts/task.mjs start` prints one line: `skills integration: <n> open, <m> unclassified` or `skills integration: status unknown (<reason>)` | never blocks |
| **Before a release** | `scripts/release.mjs` | refuses with the reason, when: the package snapshot is invalid or excludes the version being released; the check status is `unknown`; or a change is `unclassified`. A `brain-work` change with a linked task doesn't block. It is tracked, and blocking it would stop unrelated releases. |

The check reads the fork's releases and its `main` head anonymously, since the fork is public. For each `coordinated` fork PR merged since `assessed`, it verifies that every `Product:` link resolves to an issue or PR in the product repo. A link that doesn't resolve is recorded as a `brain-work` change with `error`, and is never silently dropped.

**No false current status:** a skill or report says the product is current only when `last_check.status` is `ok`, `seen.head` equals `assessed.commit`, and `changes` is empty.

### 11.4 Credentials

| Job | Credential | Scope |
|---|---|---|
| Fork: release, impact check, CI | the fork's `GITHUB_TOKEN` | its own repository |
| Fork: upstream sync | `UPSTREAM_SYNC_TOKEN`, a fine-grained token or GitHub App installation | the fork only; contents and pull requests write. A PR opened with `GITHUB_TOKEN` would not start the fork's CI, so the impact check would never run on it. |
| Product: daily check, release check | the product's `GITHUB_TOKEN` (issues write); `gh` with the user's login when run locally by `task.mjs` or `release.mjs` | the product repo; the public fork read anonymously |

Credentials live only in the repositories' Actions secrets or the user's `gh` login. They are never stored in a file, an issue, a snapshot or a log. A lost credential is recovered by reauthorising (a new token in the secret), never by committing one. A missing or rejected credential is a failed check (`unknown`), never a pass.

## 12. Acceptance tests

### 12.1 CC-100 (product repo, fixture snapshots, no network)

Fixture snapshots live in `tests/fixtures/skills-snapshots/` (A = `ultimate-brain-skills 1.0.0` with `cli` `>=0.9.0 <0.10.0`; B = `1.1.0`, which retires one skill and adds one; plus an invalid one per §2.3 reason). Tests inject the package root and the running CLI version through the same seam the installed-package lookup uses (cli.md §5.15). They set `HOME` to a temporary folder.

1. Range: comparator parsing and satisfaction, prereleases included (§2.1).
2. Integrity is recomputed equal for A and B. Each invalid fixture fails with its §2.3 reason.
3. `init` writes both trees and a lock equal to `{format, installed_by, snapshot}`. An invalid package snapshot refuses with nothing written.
4. Pin states (§3): one test per state, and the guard (cli.md §5.28) refuses a write command for `invalid`, `incompatible` (both directions, with both messages) and `missing`, while `status`, `lint`, `upgrade` and `recover` run.
5. `upgrade` A→B: files written, retired skill removed from both trees, lock updated, commit message names the snapshot. B→A with the same name: `SKILLS_DOWNGRADE`. Same version, different content: `SKILLS_SNAPSHOT_INVALID`. `ultimate-brain`→`ultimate-brain-skills`: allowed. Unpinned → pinned.
6. `lint`: `product-file` against the lock (a newer compatible package reports no drift, plus `skills-update-available`), `skills-lock`, `skills-incompatible`, `skills-unpinned`, `skill-duplicate`, `skill-competing` (global folder, `.codex`, plugin entry).
7. `link`: copies from the brain's pinned copy, not the package. Drift refuses. `.brain` gets `skills`. Unpinned uses the package with a warning.
8. Rollback (§8).
9. Package check (§12.3).

### 12.2 CC-101 (fork repo)

1. A tag builds a snapshot that this repo's validator (§2.3, schema) accepts. A second build of the same commit is byte-identical.
2. Releasing an existing version or a lower version is refused.
3. The impact check: each failing case of §10.4, and each passing value.
4. Upstream sync against a test upstream: a new commit opens one PR with `Brain impact: unassessed`; a second run updates the same PR; a conflict opens one issue; nothing merges.
5. Disjoint-name check, leak check, and `LICENSE`/`NOTICE.md`/`upstream.json` present.

### 12.3 Package check (CC-100: `scripts/test-package.mjs`)

In addition to today's checks, the packed tarball:
- contains `.agents/skills/snapshot.json`, valid (§2.3) and compatible with the packed version;
- has no file under `.agents/skills/` outside the manifest except `README.md` and `snapshot.json`.

Then `init` from the installed tarball writes a lock whose `snapshot` equals the packed manifest, `brain status --json` reports `data.skills.state` `pinned`, `lint` passes, and an immediate `upgrade` reports `files: []`.

### 12.4 CC-106 (for reference; not in CC-98's acceptance)

The update check against a compatible change, an incompatible change, an unreleased change and an unavailable source (migration plan step 7): one integration issue throughout, `unknown` on the unavailable source, and no change dropped before it is classified.
