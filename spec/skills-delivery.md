# Pinned skill delivery (contract, decision 0059)

**Status:** contract for release 0.9.0, written in CC-98. **CC-100** builds the CLI side (§2 to §9, §12.1, §12.3) against local fixture snapshots; **CC-101** builds the fork side (§10, §11.1's fork artifacts, §11.4, §12.2); CC-105 switches the package to the fork's snapshot (§9, phase B; in 0.9.2, [decision 0069](../decisions/0069-skills-from-the-fork-in-0-9-2.md)), from the phase B contract CC-134 wrote (§9.1 to §9.11, §12.5); CC-106 builds update awareness on the product side (§11.2, §11.3). Each section names its builder.

How this file fits: [cli.md](cli.md) §5.28 holds the CLI rules every command follows (the pin guard, error codes, messages, `status` output); this file holds the formats and the changes to `init`, `link`, `upgrade`, `lint` and the package check. Sections of cli.md this file amends (§3.5, §5.1, §5.2, §5.10, §5.12, §5.15) are rewritten by the task that implements the change, in the same PR as its code. The JSON Schemas are [skills-snapshot.schema.json](schemas/skills-snapshot.schema.json), [skills-lock.schema.json](schemas/skills-lock.schema.json) and [skills-integration.schema.json](schemas/skills-integration.schema.json), with examples in `spec/examples/skills/`.

**Choices this contract makes that the user may veto** (each is the simplest reading of 0059; none contradicts it):
1. The brain records its pin in a new product-owned file, `skills.lock.json`, not in `brain.json`, so the pin changes only through `brain upgrade` and `brain.json` stays the user's. (§3)
2. The brain's committed skill copies are the pinned snapshot. `brain link` copies `brain-query` from the brain, not from the CLI package, so a linked repo gets the brain's version. (§6.2)
3. A pin that excludes the running CLI stops every brain command except `status`, `lint`, `upgrade` and `recover`. Drifted bytes in a skill file are a lint error, not a stop. (cli.md §5.28)
4. Competing copies are reported and never deleted: an error inside the brain, a warning in the user's global skill folders. (§5)
5. The CLI never installs general skills. They float globally and are never pinned. (§4)
6. The assessed revision and the classified changes live in the one open integration issue, in a machine-readable block, so the daily check writes no commits. (§11.2)
7. Until CC-105, the package keeps building its snapshot from the product's `skills/` folder, under the snapshot name `ultimate-brain`. (§9)
8. The fork keeps merge commits only and keeps its own `.github/` on every upstream merge, so the upstream base stays an ancestor and upstream workflows never run in the fork. (§10.5)

The user chose two more on 2026-11-05 (CC-134):
9. `brain link` installs brain-workflow and brain-workflow-adopt next to brain-query, pinned to the brain's version, so they reach any folder the brain links (CC-107's finding 9). (§9.7)
10. A product PR that vendors a fork release needing a newer CLI also sets `package.json` to the release it lands in, so `main` carries that unpublished version until the release. (§9.4)

---

## 1. Terms

- **Operational skill:** a skill that operates a brain (`brain-*`). It is pinned per brain. Product-owned once installed.
- **General skill:** any other skill in the fork (engineering, writing, workflows). Installed globally by the user and released independently. Never pinned, never written by the CLI.
- **Snapshot:** an immutable, released set of operational skills plus its manifest, `snapshot.json` (§2).
- **Pin:** the snapshot a brain uses, recorded in `skills.lock.json` (§3) and installed in the brain's `.agents/skills/` and `.claude/skills/` (the **two trees**).
- **Package snapshot:** the snapshot the installed npm package ships, at `<package root>/.agents/skills/` (cli.md §5.15 defines the package root).
- **Running CLI version:** the `version` of the package root's `package.json`.
- **Precedence:** SemVer 2.0.0 precedence, prerelease identifiers included (`1.0.0-rc.1` < `1.0.0`). Versions never carry build metadata; the schemas reject it.

## 2. Snapshot format (CC-100 reads it, CC-101 produces it)

A snapshot is a folder:

```text
snapshot.json
README.md   LICENSE   NOTICE.md        (optional; ignored by readers)
<skill name>/SKILL.md
<skill name>/<other files…>
```

`snapshot.json` follows [skills-snapshot.schema.json](schemas/skills-snapshot.schema.json):

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
| `format` | `1`. A reader that meets another value treats the snapshot as invalid (`manifest-schema`). |
| `name` | `ultimate-brain-skills` for a fork release; `ultimate-brain` for a snapshot the product builds from its own `skills/` (transition, §9). |
| `version` | SemVer 2.0.0 of this snapshot. Comparable only between snapshots with the same `name`. |
| `cli` | Declared CLI range (§2.1). |
| `source` | Where it was built. `repository` is an `https://` URL. `commit` (40 lowercase hex) is required when `name` is `ultimate-brain-skills`, and absent for `ultimate-brain` (§9). |
| `upstream` | The upstream base: the upstream repository and the exact upstream commit the fork had merged when this snapshot was built. Required (an object) for `ultimate-brain-skills`; `null` for `ultimate-brain`. |
| `integrity` | `sha256-` + 64 lowercase hex (§2.2). |
| `skills` | Sorted by `name` in byte order, unique names. Each skill: `name` (lowercase kebab-case, equal to its folder), `targets` (sorted, unique, always contains `brain`; `linked_repo` when `brain link` installs it), `files` (sorted by `path` in byte order, unique paths, contains `SKILL.md`). |
| `files[]` | `path` relative to the skill folder, `/` separators, no `.` or `..` segment, no empty segment, no leading `/`. `sha256` of the file's bytes, lowercase hex. `bytes` its size. |

Files are compared and written as bytes. Snapshots carry no file modes, symbolic links or empty folders. The writer serialises `snapshot.json` as JSON with 2-space indent, keys in the order of the example above (and `repository` before `commit`, `name`, `targets`, `files`, then `path`, `sha256`, `bytes`), and a trailing newline.

### 2.1 CLI range

Grammar: one or more comparators separated by single spaces. Each comparator is an operator `>=`, `>`, `<=`, `<` or `=` followed by a SemVer 2.0.0 version without build metadata (`0.9.0`, `0.9.0-rc.1`). The schema enforces the grammar.

A version **satisfies** the range when it satisfies every comparator under precedence. This is not npm's range rule: `0.9.0-rc.1` does not satisfy `>=0.9.0`, and it does satisfy `<0.10.0`. A snapshot that should accept the release candidates of 0.9.0 declares `>=0.9.0-0`. No dependency is added for this: the comparison fits in a small function with its own tests.

A version is **newer than the range** when it fails a `<` or `<=` comparator, or an `=` comparator whose version it exceeds. It is **older than the range** when it fails a `>` or `>=` comparator, or an `=` comparator whose version exceeds it.

### 2.2 Integrity

1. For every file of every skill, form the line `<sha256 hex>  <skill name>/<path>\n` (two spaces, LF).
2. Sort the lines by `<skill name>/<path>` in UTF-8 byte order.
3. `integrity` = `sha256-` + the lowercase hex SHA-256 of the concatenated lines, UTF-8 encoded.

The hashes come from the manifest's `files` entries. §2.3 rule 5 separately checks that those hashes match the bytes on disk. `snapshot.json`, `README.md`, `LICENSE` and `NOTICE.md` are not covered.

### 2.3 Validating a snapshot

A folder is a **valid** snapshot when every rule below holds. Rules run in order and stop at the first failure. Within a rule, skills are taken in manifest order and files in manifest order. Unlisted entries are taken in byte order of their path.

The failure is reported as the **reason** `<id>` or `<id>: <path>`, with the path relative to the snapshot folder. The ids are normative, since tests and messages use them; the wording around them is not.

| # | Rule | Reason id |
|---|---|---|
| 1 | `snapshot.json` exists as a regular file and can be read | `manifest-missing` |
| 2 | it parses as JSON and passes the schema | `manifest-unparseable`, `manifest-schema` |
| 3 | `skills` sorted and unique by `name`; each skill's `targets` and `files` sorted and unique (`targets` by value, `files` by `path`) | `manifest-order` |
| 4 | `integrity` equals §2.2 computed from the manifest | `integrity` |
| 5 | each listed file exists as a regular file (not a symbolic link, folder or other type) with the listed `bytes` and `sha256` | `file-missing`, `not-a-file`, `file-mismatch` |
| 6 | no other entry exists: at the top level only `snapshot.json`, the three optional files and the listed skill folders; inside a skill folder only the listed files and the folders on their paths. A hidden file, a symbolic link, an empty folder or a stray file all count. An unlisted folder is one entry: its contents are not listed separately. | `unlisted-entry` |

Rules 1 to 4 need only the manifest. They are the **manifest checks**, also applied to the copy of the manifest inside a lock (§3).

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

- `installed_by`: the running CLI version that wrote this pin. Rollback and the `SKILLS_INCOMPATIBLE` message use it.
- `snapshot`: the installed snapshot's `snapshot.json` object, copied field for field.
- Written as JSON with 2-space indent, the keys in the order above (the manifest's keys as in §2), and a trailing newline. Nothing time-dependent is written.

**What the pin means:** the brain's two trees hold, for each skill in `snapshot.skills`, exactly the listed files and bytes. Both agents therefore read the same version (§5.1).

**States.** The CLI determines the state by checking each row in order; the first match wins:

| # | State | When |
|---|---|---|
| 1 | `unpinned` | no entry at `skills.lock.json` (a brain made before 0.9.0; §9) |
| 2 | `invalid` | the entry is not a regular file, can't be read, is not JSON, fails its schema, or its `snapshot` fails a manifest check (§2.3 rules 3 and 4) |
| 3 | `incompatible` | the running CLI version doesn't satisfy `snapshot.cli` |
| 4 | `missing` | a pinned skill's `SKILL.md` is not a regular file (absent, a folder or a symbolic link) in either tree |
| 5 | `drift` | some pinned file in either tree is missing, is not a regular file or has other bytes, or a pinned skill's folder holds an entry the lock doesn't list (§2.3 rule 6, applied to the skill folders only; folders of skills the lock doesn't name are not checked) |
| 6 | `pinned` | none of the above |

The guard needs only rows 1 to 4, which never hash a file. Row 5 hashes every pinned file and is evaluated only by `status`, `lint`, `upgrade` and `link`.

The **invalid reason** is one of `not a file`, `unreadable`, `not JSON`, `schema: <first schema error, as cli.md describes errors for INPUT_INVALID>`, `manifest-order` or `integrity`. The **first missing skill** is the first pinned skill in manifest order whose `SKILL.md` fails, checked in `.agents/skills` before `.claude/skills`.

## 4. Global general skills vs brain-pinned operational skills

| | Operational | General |
|---|---|---|
| Source | the fork's `brain/` folder (from CC-105, §9.1; in phase A the product's `skills/`) | every other skill folder in the fork |
| Released as | a snapshot (§2), tag `brain-v<version>` | the fork's own tags, outside this contract |
| Installed by | `brain init` / `brain upgrade` into the brain; `brain link` (only `targets` with `linked_repo`) into a linked repo or folder | the user, by the fork's install instructions, into `~/.claude/skills/` and `~/.agents/skills/` |
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

The **names checked** depend on the command:
- `status` and `lint`: the pin's skills (while `unpinned`, the package snapshot's; when the lock is `invalid` and the package snapshot is invalid too, none).
- `init` and `upgrade`: the snapshot being installed.
- `link`: the skills it writes to the linked repo.

For each checked name `N`:

| Kind | Where | Lint rule | Severity |
|---|---|---|---|
| `duplicate` | in a tree of the brain (for `link`, of the linked repo): a folder other than `N/` whose `SKILL.md` frontmatter `name` is `N` | `skill-duplicate` | error |
| `global` | an entry of any type (a folder, a file, a symbolic link even if broken) at `~/.claude/skills/N`, `~/.agents/skills/N` or `~/.codex/skills/N` | `skill-competing` | warning |

Plus, once per command, independent of names:

| Kind | Where | Lint rule | Severity |
|---|---|---|---|
| `plugin` | `~/.claude/settings.json` or the brain's `.claude/settings.json` parses as a JSON object whose `enabledPlugins["ultimate-brain@ultimate-brain"]` is exactly `true` (the retired plugin, 0038); one entry per file, `name` `ultimate-brain` | `skill-competing` | warning |

Detection rules:
- **Frontmatter** is read with the CLI's frontmatter parser. A `SKILL.md` that can't be read or parsed, or that has no string `name`, is skipped. A folder `N/` whose own `SKILL.md` names something else is drift (§3), not a duplicate.
- **Names** compare exactly (case-sensitive).
- **`~`** is the `HOME` environment variable, which tests point at a temporary folder. When `HOME` is unset or empty, the `global` checks and the home `plugin` check are skipped.
- **Paths are reported** as brain-relative (or repo-relative for `link`) for `duplicate` and the brain's settings file, and with the literal `~/` prefix for home paths. A path is never expanded, so no machine path appears in output, lint or logs.
- **Identical bytes still count.** A global copy whose bytes equal the pin is reported anyway: it loads next to the pin, and the next upgrade makes them differ.
- **Nothing is changed.** The CLI never deletes, edits or renames a competing copy. The message says what to remove; removing it is the user's or the setup skill's job (migration plan step 6).

### 5.3 Where it is reported

- `lint`: the rules above. Each issue has `path` = the reported path (`.claude/skills/old-query`, `~/.claude/skills/brain-query`, `~/.claude/settings.json`), `line` 1, `id` null.
- `status`, `init`, `upgrade` and `link`: `data.skills.competing`, a list of `{ "kind", "name", "path" }` sorted by `path`, then `kind`, then `name`.
- `init`, `upgrade` and `link` also add one warning `SKILLS_COMPETING` when the list is non-empty. These commands never refuse because of it.

## 6. Command changes

These amend the cli.md sections named. The task that implements a change rewrites that section.

### 6.1 `brain init` (cli.md §5.1, CC-100)

- **Before any write**, after today's refusals (`BRAIN_IS_PRODUCT_REPO`, `ALREADY_A_BRAIN`, `TARGET_NOT_EMPTY`): the package snapshot must be compatible with the running CLI version (§2.3). Otherwise refuse with `SKILLS_SNAPSHOT_INVALID`. Nothing is written.
- **Step 3 changes:**
  - Copy every skill of the package snapshot (each skill's listed files only) into both trees.
  - Write `skills.lock.json` (§3) with `installed_by` = the running version, listed in `created`.
  - The optional top-level files and `snapshot.json` are not copied.
- **`--force`:** existing skill files are skipped, as today, and listed in `skipped`. An existing entry at `skills.lock.json` is skipped too. The result can be any state, and the output reports it.
- **Output:** `data.skills` is computed after the writes as `status` computes it: `{ "state", "name", "version", "competing" }`, where `name` and `version` come from the lock on disk (`null` when `unpinned` or `invalid`).

### 6.2 `brain link` (cli.md §5.12, CC-100)

- **Guard:** the resolved brain must pass the pin guard (cli.md §5.28). The linked repo has no pin and is not guarded.
- **Linked skills:** the skills of the source below whose `targets` include `linked_repo`.
- **Source:**
  - **Pinned brain** (state `pinned` or `drift`): the files listed in the lock, copied from the brain's `.agents/skills/<name>/`. Before any write, link checks that each of those files is a regular file with the locked bytes. The first failure refuses with `SKILLS_SNAPSHOT_MISSING`, naming that file. Unlisted files in the brain's folder and the `.claude/skills` copy are ignored; lint covers them.
  - **`unpinned` brain:** the package snapshot, which must be compatible with the running CLI (else `SKILLS_SNAPSHOT_INVALID`), with warning `SKILLS_UNPINNED`.
- **Writing:** for each linked skill, both folders in the linked repo (`.agents/skills/<name>/`, `.claude/skills/<name>/`) are written and pruned exactly as §5.12 step 3 says, against that skill's file list.
- **Retired linked skills:** a name in the previous `.brain` `skills.names` that is no longer a linked skill has both its folders removed (each file `removed`). Folders named in `skills.names` are product-owned in the linked repo, as `brain-query` is today. A `.brain` without `skills.names` (written before 0.9.0) retires nothing.
- **`.brain` gains `skills`**, written after `stacks`:
  ```json
  "skills": { "name": "<snapshot name>", "version": "<version>", "integrity": "<integrity>", "names": ["brain-query"] }
  ```
  It is replaced on every run. `names` lists the linked skills, sorted. The `brain-query` skill compares `name` and `version` with `brain status --json` `data.skills` and, when they differ, tells the user to run `brain link` again.
- **Output:** `data.skills` = `{ "source": "brain" | "package", "name", "version", "integrity", "names", "competing" }`, where `competing` covers `duplicate` in the linked repo's two trees, `global` for the linked skills, and the `plugin` check (home and the brain's settings file) (§5.2). Warning `SKILLS_COMPETING` when it is non-empty.

### 6.3 `brain upgrade` (cli.md §5.15, CC-100)

**Before any write**, after today's checks (`UNRELEASED_BUILD`, `BRAIN_DIRTY`, the `OUTSIDE_ROOT` safety checks, which now also cover `skills.lock.json`), in this order. `--dry-run` applies the same checks and refusals.
1. **Package snapshot.** It must be compatible with the running CLI version. Otherwise refuse with `SKILLS_SNAPSHOT_INVALID`.
2. **Existing lock** (the brain's state doesn't matter here: upgrade is the repair path):
   - `unpinned`: `from` is `null`.
   - `invalid`: the lock will be replaced, with warning `SKILLS_LOCK_REPLACED`, and `from` is `null`.
   - Otherwise `from` is the lock's `{ name, version }`.
3. **Same `name`, lower version.** When the lock's snapshot has the same `name` as the package snapshot and a version of higher precedence, refuse with `SKILLS_DOWNGRADE`.
4. **Same `name`, same `version`, different manifest.** When the two manifests are not deep-equal (any field: `integrity`, `cli`, `source`, `upstream`, `skills`), a released snapshot changed, which violates immutability. Refuse with `SKILLS_SNAPSHOT_INVALID`, reason `same version, different content`.
5. A **different `name`** (the switch from `ultimate-brain` to `ultimate-brain-skills`, §9) is an ordinary upgrade. No version comparison applies.

**Step 3 changes:**
- For each skill of the package snapshot, in both trees: write each listed file whose bytes differ (`created` or `updated`), and remove every other entry in that skill's folder (`removed`), as today.
- **Retired skills:** a skill in the old (valid) lock but not in the new snapshot has its folder removed from both trees. Every file in it is listed as `removed`, including files the user added: a product folder is product-owned. The emptied folder goes too. Without a valid old lock, folders the snapshot doesn't name are left alone, as today, since the CLI can't tell a retired skill from the user's own.
- **New step 3a:** write `skills.lock.json` when the lock is `unpinned` or `invalid`, or its snapshot has another `name` or `version` than the package snapshot (rule 4 has already refused a changed manifest under the same version). Otherwise it stays unchanged, keeping its `installed_by`. A lock that is written gets `installed_by` = the running version, is listed in `files`, and is staged and committed with the other files (§5.15 step 8).

**Output and commit:**
- `data.skills` = `{ "from", "to": { "name", "version" }, "retired": [names, sorted], "previous_cli", "competing" }`. `previous_cli` is the old lock's `installed_by` when step 3a wrote a lock over a valid one. When it wrote a lock over a missing or invalid one (the first pin, as when a brain moves to 0.9.0), it is the version named by the newest commit of the brain whose subject is `upgrade: ultimate brain <version>`, alone or followed by `, skills …`, skipping a version equal to the running CLI's (CC-129). Otherwise it is `null`: no lock was written, or the brain was never upgraded since `init` (whose commit names no version), or Git can't be read.
- When anything changed, the commit message is `upgrade: ultimate brain <version>, skills <snapshot name> <snapshot version>`. When nothing changed, nothing is committed, as today. An immediate second upgrade with the same CLI reports `files: []`.
- `--dry-run` reports the same fields and writes nothing.
- Lint after the upgrade (step 7) reads the new lock. As today, its findings never fail or undo the upgrade.

### 6.4 `brain lint` (cli.md §5.10, CC-100)

**`product-file` for skills**, by state:

| State | Skill trees compared against |
|---|---|
| `pinned`, `drift`, `missing`, `incompatible` | the lock |
| `invalid` | nothing (the `skills-lock` error stands in) |
| `unpinned` | the package snapshot, as today; an invalid package snapshot is today's broken-install case: one `product-file` error with message `installed package not found: <reason>` |

- The cases are those of today: a pinned skill folder missing from a tree, a listed file missing or with different bytes, an entry in a pinned skill's folder that isn't listed.
- One issue per case, `path` = the folder or the file, brain-relative. The message names the snapshot (`ultimate-brain-skills 1.2.0`) and says `run brain upgrade, or file a finding`.
- The `AGENTS.md` rules block is still compared against the package; it is not part of a snapshot.

**New rules:**

| Rule | Sev | Path | When and message |
|---|---|---|---|
| `skills-lock` | error | `skills.lock.json` | state `invalid`. `skills.lock.json is invalid (<reason>); run brain upgrade to rewrite it` |
| `skills-incompatible` | error | `skills.lock.json` | state `incompatible`. The `SKILLS_INCOMPATIBLE` message (cli.md §5.28) |
| `skills-unpinned` | info | `skills.lock.json` | state `unpinned`. `skills are not pinned; run brain upgrade to pin them` |
| `skills-update-available` | info | `skills.lock.json` | state `pinned` or `drift`, and the package snapshot is compatible with the running CLI and either has the pin's `name` and a higher version, or has another `name`. `<package name> <version> is available (pinned: <name> <version>); run brain upgrade` |
| `skill-duplicate` | error | the duplicate folder | §5.2. `<path> also defines skill <N>; remove it, the pinned copy is <tree>/<N>` |
| `skill-competing` | warning | the reported path | §5.2. `global` kind: `<path> competes with the pinned skill <N>; remove it`. `plugin` kind: `the retired ultimate-brain plugin is enabled in <path>; disable it` |

`info` issues count as neither errors nor warnings, as cli.md §5.10 already says.

### 6.5 `brain status` (cli.md §5.2, CC-100)

It gains `data.skills`, defined in cli.md §5.28.

## 7. Missing or incompatible snapshot: stop before writes

The pin guard (cli.md §5.28) decides which commands stop and which messages they print. Summary:

| Situation | Who stops | Code | What the message tells the user |
|---|---|---|---|
| Package snapshot invalid or excludes the running CLI | `init`, `upgrade`, and `link` on an `unpinned` brain | `SKILLS_SNAPSHOT_INVALID` | reinstall the CLI |
| Lock `invalid` | every guarded command | `SKILLS_PIN_INVALID` | run `brain upgrade` (it replaces the lock) |
| Lock `incompatible`, CLI newer than the range | every guarded command | `SKILLS_INCOMPATIBLE` | run `brain upgrade`, or keep these skills with the CLI that pinned them |
| Lock `incompatible`, CLI older than the range | every guarded command | `SKILLS_INCOMPATIBLE` | install the CLI that pinned them |
| State `missing` | every guarded command | `SKILLS_SNAPSHOT_MISSING` | run `brain upgrade` (it rewrites the pinned files) |
| A file `link` copies is missing or drifted | `link` | `SKILLS_SNAPSHOT_MISSING` | as above |
| Same name, lower version, during `upgrade` | `upgrade` | `SKILLS_DOWNGRADE` | install the CLI that pinned them, or roll back (§8) |

A skill that gets one of these codes stops the operation and passes the message to the user. It never falls back to another skill copy, another tracker or a guess (0059).

## 8. Rollback (CC-100)

**After an upgrade the user wants to undo:**
1. In the brain: `git revert <upgrade commit>`. This restores the old lock and the old skill files in one commit.
2. `npm install -g ultimate-brain@<previous_cli>` (the `previous_cli` the upgrade reported; also the old lock's `installed_by` when there was a lock). After a first pin the revert removes the lock, and the brain is `unpinned` again, as before the upgrade. When `previous_cli` is `null` the upgrade can't name the version: reinstall the one you ran before (`npm ls -g ultimate-brain` shows it before you install the new one).
3. `brain lint` exits 0. Info issues such as `skills-update-available` don't count.

Two consequences follow:
- The order of steps 1 and 2 doesn't matter: `git revert` is not a brain command, so the guard doesn't apply to it.
- A later `brain upgrade` with the newer CLI re-applies the upgrade. `SKILLS_DOWNGRADE` only stops an older CLI from silently lowering a pin.

**A failed upgrade** restores every file it replaced (cli.md §3.6), lock included, so the last working pin stays.

CC-100 adds these three steps to docs/releasing.md and to the brain's AGENTS.md block.

## 9. Transition: today's delivery keeps working

| Phase | Package snapshot | Brain |
|---|---|---|
| Before 0.9.0 | `.agents/skills/` with no manifest | no lock |
| **A** (CC-100, 0.9.0) | `.agents/skills/` + a generated `snapshot.json` (below) | `unpinned` until its first `brain upgrade`, then pinned to `ultimate-brain <version>` |
| **B** (CC-105) | the fork's released snapshot, copied verbatim (its `snapshot.json`, `LICENSE` and `NOTICE.md` included) | the next `brain upgrade` switches the pin to `ultimate-brain-skills <version>` (§6.3 rule 5) |

**The phase A manifest:**
- `name`: `ultimate-brain`;
- `version`: the package version;
- `cli`: `>=<package version> <<major>.<minor + 1>.0` (for `0.9.0-rc.1`, `>=0.9.0-rc.1 <0.10.0`);
- `source`: `{ "repository": "https://www.npmjs.com/package/ultimate-brain" }`, with no `commit`, so the build depends on nothing but the files;
- `upstream`: `null`;
- `targets`: `["brain", "linked_repo"]` for `brain-query` (the skill §5.12 writes today) and `["brain"]` for every other skill. The list lives in `scripts/build-skills.ts`.

**Phase A rules:**
- `skills/` stays the one editable source. `scripts/build-skills.ts` mirrors it to `.agents/skills/` as today, except that entries whose name starts with `.` (such as `.DS_Store`) are neither copied nor listed, and a symbolic link in `skills/` is a validation error. The mirror's `README.md` stays and is ignored.
- **`snapshot.json` is generated, not committed.** `npm run build` (so also `prepack`) and `npm test` (its `pretest` step) write it to `.agents/skills/snapshot.json`, from the mirror and `package.json`'s version (`node --experimental-strip-types scripts/build-skills.ts --snapshot`). It is listed in `.gitignore`, and `build-skills.ts --check` ignores it. A source checkout that has run neither has no package snapshot: its CLI treats it as invalid (`manifest-missing`). Tests that need a package snapshot build one in a temporary folder with the same generator; `npm test` writes the checkout's for scripts that run the source CLI against the checkout (`scripts/score-ingest.mjs`).
- **An `unpinned` brain works as before:** the guard lets every command through, lint compares against the package, and the only new output is the `skills-unpinned` info.
- **CLIs before 0.9.0** ignore `skills.lock.json`, which is not in a note folder. If one runs `brain upgrade` on a pinned brain, it rewrites the skill files without touching the lock. The next 0.9.0+ lint reports the result as `product-file` drift, and `brain upgrade` with 0.9.0+ repairs it.
- **No step needs both repositories upgraded at once.** Phase A ships without the fork. Phase B needs only a fork release whose range includes the CLI being released.

Phase B (CC-105, 0.9.2) is §9.1 to §9.11, accepted by §12.5. It keeps the package path `.agents/skills/`, the manifest format and the lock format: only the snapshot's origin changes, so `init`, `status`, `upgrade` and `lint` keep their rules (§9.6).

### 9.1 Where skills are written (CC-105)

- **The fork's `brain/<name>/`** is the one place operational skills are written, from the merge of CC-105's product PR on (0059, 0069). Every change reaches it through a fork PR (§9.5).
- **The product repo has no `skills/` folder.** CC-105 deletes it, with `skills/README.md`, `scripts/build-skills.ts` and every use of that script: `npm run skills`, the `pretest` and `build` steps, `scripts/task.mjs start`'s step, the skills-integration workflow's step (§9.8), and `.githooks/pre-commit`'s `skills/` step, which §9.3 replaces. Its style rules (name = folder, only `name` and `description`, description length, references one level deep, no capitals for emphasis) are the fork's `skills` check (§10.3). `package.json` keeps no `skills` script. Tests of that script (`tests/skills.test.ts`, `tests/skills-phase-a.test.ts`) go with it; the new tests (§12.5 items 1 to 4) live in `tests/skills-vendor.test.ts`. "The skill checks" from then on are `vendor-skills.mjs --check` (in `pretest`) and the `tests/skills-*.test.ts` files; a test that needs a synthetic snapshot builds one with the fixtures' generator (`tests/skills-fixtures.ts`).
- **A product test fails when Git tracks anything under `skills`** at the repo root (`git ls-files -- skills` prints a line), with the message `skills are written in the fork ultimate-brain-skills (brain/<name>/), not here: spec/skills-delivery.md §9.1`.
- **`.agents/skills/` is the vendored snapshot:** one released fork snapshot, committed whole (its `snapshot.json`, `LICENSE` and `NOTICE.md` included), written only by `scripts/vendor-skills.mjs` (§9.2) and never edited (§9.3). `.agents/skills/snapshot.json` leaves `.gitignore`, which gains `.agents/skills.new/` and `.agents/skills.old/` (§9.2 step 7). The phase A `README.md` there goes: the folder holds exactly the release's entries.
- **`.gitattributes`** (created, since the repo has none) holds `.agents/skills/** -text`, so every checkout keeps the released bytes. No test checks the file: a checkout that rewrote line endings fails the offline check (§9.3) anyway.
- **The leak check** scans the vendored files like any other: `scripts/leak-check.mjs` already excludes only `tests/`, `sources/`, `node_modules/` and its allowlist, so it needs no change. `scripts/leak-allow.txt` gains an entry for a line of the vendored `LICENSE` or `NOTICE.md` only if a rule matches it: the upstream copyright line is required attribution (§10.1).
- **Product files that read skill text read `.agents/skills/<name>/…`:** the tests that tie skill text to CLI contracts (`tests/brain-sync-databases.test.ts`, `tests/notion-workflow-settings.test.ts`, `tests/init.test.ts` and any other reading `skills/`), `tests/helpers.ts` and `scripts/blind-brain.mjs`. The last two copy the vendored snapshot as it is, its manifest included, instead of writing a phase A manifest. A contract test that fails against a newly vendored snapshot is a coordinated change: the fix is a fork PR or a product change, never an edit of `.agents/skills/`.
- **Text that says where skills are written**, changed by CC-105:
  - `AGENTS.md` (the product repo's): the Layout row for `skills/` becomes `.agents/skills/` | "Vendored snapshot of the ultimate-brain-skills fork; never edited here (skills-delivery §9)" | "the fork, through fork PRs (§9.5)"; Conventions gains "Skills are written in the fork's `brain/` and reach this repo as a released snapshot (spec/skills-delivery.md §9.5)."
  - `.claude/agents/pr-reviewer.md`: a PR that names a fork PR (§9.5 step 3) is reviewed with that fork PR's diff, and the verdict on the product PR covers both.
  - `templates/brain/AGENTS.md`: in the rules block, the product-owned files rule's "(the skills Ultimate Brain ships)" becomes "(the skills Ultimate Brain ships, written in the public ultimate-brain-skills repository and installed only by `brain upgrade`)". Filing a finding stays as it is: skill findings are still `dogfood` issues in the product repo. Like any change to the rules block, each brain takes it at its next `brain upgrade` (cli.md §5.15 step 1), and `product-file` compares against the new text.
  - `docs/guide.md` stays a short pointer, now saying the guide is written in the fork's `brain/brain-howto/references/guide.md` and read here at `.agents/skills/brain-howto/references/guide.md`. After vendoring a release that changes it, the "How it works" page in Notion is updated from the vendored copy, as today from `skills/`.
  - **Every other live reference to `skills/`** becomes `.agents/skills/` where a file reads skill text, or the fork's `brain/` where it says where to write: `README.md`, `docs/` (except the dated records below), `notion/` (except `notion/migrations/`), `templates/`, `spec/`, `scripts/`, `tests/`, `.claude/` and `.github/`. Dated records keep their text: `decisions/`, `reviews/`, `synthesis/`, `eval/`, `notion/migrations/`, `build/`, `CHANGELOG.md`, `docs/acceptance-*.md`, `docs/skills-inventory.md` (the inventory of 2026-10), `docs/v2-ideas.md` (ideas, not instructions), and this file, which describes phase A as well as phase B. So `notion/brain-assistant.md` is live: its guide link points to the vendored copy. In `spec/`, that leaves the lines saying a skill is "written in `skills/` until CC-105" (connected-workflows.md's opening list and §13, linked-repos.md §10), which then say it is written in the fork's `brain/`. The check is `git grep -nE '(^|[^-./a-z])skills/' -- README.md docs notion templates spec scripts tests .claude .github ':!docs/acceptance-*' ':!docs/skills-inventory.md' ':!docs/v2-ideas.md' ':!notion/migrations' ':!spec/skills-delivery.md'`, (the pattern skips every `…/skills/` path, such as `.agents/skills/` and `~/.codex/skills/`, and `ultimate-brain-skills/` in fork URLs, such as §9.5's `Fork:` line). Every hit left must be a sentence saying the product's `skills/` folder is gone and skills are written in the fork's `brain/`.
  - `scripts/leak-allow.txt`: every line names a file that exists after the vendoring. So the `skills/…` lines go, and an `.agents/skills/…` line stays only while the vendored snapshot holds its file.
  - `docs/releasing.md`: vendoring (§9.2), the version rule (§9.4) and the release gate's new refusals (§9.8).
  - `docs/skills-migration-plan.md` step 4: done by CC-105, with a link to §9.
  - In the fork, a root file upstream doesn't have, `BRAIN-SKILLS.md`: operational skills are written in `brain/<name>/`; a PR passes the checks of §10.3 and declares its impact (§10.4); a release is a `brain-v` tag (§10.2, §9.5). `NOTICE.md` links it.
- **Skill findings** still arrive as `dogfood` issues in the product repo. The task that fixes one makes its skill change as a fork PR (§9.5).

### 9.2 Vendoring a release: `scripts/vendor-skills.mjs` (CC-105)

```text
node --experimental-strip-types scripts/vendor-skills.mjs <version> [--repo <owner/name>]
node --experimental-strip-types scripts/vendor-skills.mjs --local <fork checkout> [--commit <ref>]
node --experimental-strip-types scripts/vendor-skills.mjs --check [--online] [--repo <owner/name>]
```

A Node script with no build step and no new dependency. It imports the product's validator and range functions from `src/lib/`, so it runs with `--experimental-strip-types`, as `scripts/skills-integration.mjs` does; `package.json`'s `pretest` and `build` call it that way. The text below shortens the command to `vendor-skills.mjs`.

**GitHub access.** The API base is `UB_GITHUB_API`, else `https://api.github.com`, as in `scripts/skills-integration.mjs` (tests point it at the mock of §12.4). JSON requests use the `github()` client that script exports. The token is §11.4's product row (`GH_TOKEN`, else `GITHUB_TOKEN`, else `gh auth token`); with none, requests go anonymous, since the fork is public. A rejected token, a network error or a 5xx answer is the reason `status unknown (<error>)`. `--repo` names the product repo, else `GITHUB_REPOSITORY`, else the `origin` remote, as in §11.3; the fork is `<that owner>/ultimate-brain-skills`. Credentials are §11.4's product row. Exit 0 on success, 1 on a refusal or a failed check (the reason on stderr), 2 on a usage error.

**`<version>`** writes the fork release `brain-v<version>` into `.agents/skills/`. The steps run in order, and the first failure writes nothing:
1. **The release.** `GET /repos/<fork>/releases/tags/brain-v<version>`: it exists and is not a draft. Its body holds exactly one line matching each of `^Integrity: sha256-[0-9a-f]{64}$`, `^Tarball-SHA256: [0-9a-f]{64}$` and `^CLI: .+$` (§10.2), and it has an asset named `ultimate-brain-skills-<version>.tar.gz`.
2. **The tag's commit.** `GET /repos/<fork>/git/ref/tags/brain-v<version>`. When the ref names a tag object, `GET /repos/<fork>/git/tags/<sha>`, whose `object.sha` is the commit.
3. **The tarball.** `GET <api>/repos/<fork>/releases/assets/<id>` with `Accept: application/octet-stream`, by `fetch` with `redirect: "manual"` (the JSON client can't read bytes): a 200 answer is the tarball; a 302 answer's `Location` is then fetched without the `Authorization` header (it is a signed URL). Its SHA-256 equals the `Tarball-SHA256` line.
4. **Unpacking.** Before anything is unpacked, `tar -tzf` lists the member paths and `tar -tvzf` their types, line for line in the same order; the two listings must have the same number of lines, else the reason is `member path: unreadable listing` (a name holding a newline ends here). Each path, after a leading `./` is removed, is empty (the root itself, skipped) or a relative path with no `..` segment, no empty segment and no leading `/`; else the reason is `member path: <path>`. Each type, the first character of its `-tvzf` line, is `-` (a regular file) or `d` (a folder); else the reason is `member type: <path>`, so a symbolic link, a hard link or a device never reaches the disk. Then `tar -xzf` unpacks it into a new, empty temporary folder. After unpacking, every entry there is a regular file or a folder (`lstat`), and every file has a link count of 1; else the reason is `member type: <path>`, which covers a tar that lists a hard link as a file. The fork packs with `tar -czf` (§10.2), whose members these rules accept.
5. **The snapshot.** The folder is a valid snapshot (§2.3, the product's validator in `src/lib/skills-snapshot.ts`) with: `name` `ultimate-brain-skills`; `version` equal to `<version>`; `integrity` equal to the `Integrity:` line; `cli` equal to the `CLI:` line; `source.repository` equal to `https://github.com/<fork>`; `source.commit` equal to the tag's commit; and `LICENSE` and `NOTICE.md` at its top level.
6. **The product version.** The snapshot is compatible with `package.json`'s `version` (§2.3). Otherwise the reason is `brain-v<version> needs ultimate-brain <cli>; package.json is <v>. Set package.json to the release this lands in (npm version <x.y.z> --no-git-tag-version), then run again` (§9.4).
7. **Writing.** Only now, after steps 1 to 6 passed (a refusal there touches nothing, leftovers included), leftovers of an interrupted run are cleared: when `.agents/skills/` is missing and `.agents/skills.old/` exists, `.old` is renamed back to `.agents/skills/`; then any `.agents/skills.new/` and `.agents/skills.old/` are removed. `.gitignore` lists both, so neither is ever committed, and the checks (§9.3) read only `.agents/skills/`. The folder's entries are written to `.agents/skills.new/`; then `.agents/skills/` is renamed to `.agents/skills.old/`, `.agents/skills.new/` to `.agents/skills/`, and `.agents/skills.old/` is removed. A failure before the second rename removes `.agents/skills.new/` and leaves `.agents/skills/` as it was. A failure at or after it (the second rename, or removing `.agents/skills.old/`) is reported with exit 1 and left as it is: running the same command again recovers by the clearing rule above, and until then the offline check fails. Nothing else in the repo is written.
8. **The report.** One line on stdout: `vendored ultimate-brain-skills <version> (<integrity>), was <old name> <old version>; added: <names>; changed: <names>; retired: <names>`, each list comma-separated in byte order, or `none`. It compares the old and new manifests: a skill is changed when its `targets` or any of its `files` entries (`path`, `sha256` or `bytes`) differ. `<old name> <old version>` is `none` when the old folder has no manifest that passes its schema. Only the manifests are compared, so a phase A `README.md` is not a skill; the swap in step 7 drops it with every other old entry.

**`--local <fork checkout>`** tries unreleased skill text in a product branch. It runs `node <fork checkout>/tools/build-snapshot.mjs --commit <ref> --version 0.0.0-local --out <new empty temporary folder>` (`<ref>` defaults to `HEAD`; the fork's build reads Git, so only committed changes are in it, §10.2; its tools need `npm ci` in `tools/` first), then steps 5 to 8. The fork's builder writes `source.repository` and `source.commit` (the commit built, §10.2), so a local snapshot carries them, as it carries `LICENSE` and `NOTICE.md`; the tests' stub builder must write all four, with a `cli` range that admits the test's `package.json` version. In step 5 only the validity and the `name` check apply, and `version` must be `0.0.0-local`. Step 6 applies in full: on a branch whose `package.json` is below the fork's range, make §9.4's version change first. A local snapshot passes `--check` and always fails `--check --online`, so a PR holding one can't pass CI (§9.3) and can't reach `main`.

**`--check`** writes nothing (§9.3). Without `--online` it reads only the repo: no network, no `--repo`, no `git remote`.

### 9.3 A vendored snapshot is never edited (CC-105)

| Check | Runs in | Fails when |
|---|---|---|
| `vendor-skills.mjs --check` (offline) | `npm test` (its `pretest`), `npm run build` (so `prepack`), and `.githooks/pre-commit` when a staged path starts with `.agents/skills/` (it checks the working tree, so stage the whole vendoring) | `.agents/skills/` is not a valid snapshot (§2.3), its `name` is not `ultimate-brain-skills`, its manifest has no `source.commit`, `LICENSE` or `NOTICE.md` is missing at its top level, or it is not compatible with `package.json`'s version |
| `vendor-skills.mjs --check --online` | CI's `test` job (with `GH_TOKEN` set to the workflow token), and the release gate (§9.8) | the offline check fails; or no non-draft release `brain-v<version>` exists for the manifest's `version`; or that release's `Integrity:` line, `CLI:` line or tag commit differs from the manifest's `integrity`, `cli` or `source.commit`; or the API can't be read, which is status unknown and a failure, never a pass |

The message, for both: `.agents/skills is not a released ultimate-brain-skills snapshot (<reason>). Skills are written in the fork; restore with git checkout -- .agents/skills and git clean -fdx .agents/skills, or vendor a release: node scripts/vendor-skills.mjs <version>`. The reasons are checked in this order, and the first failing one is reported: the §2.3 reason (`manifest-missing`, `file-mismatch: brain-sync/SKILL.md`, …), then `name <name>`, `no source commit`, `no LICENSE`, `no NOTICE.md`, `not compatible with <v> (<cli>)`, `no release brain-v<version>`, `differs from brain-v<version>: <integrity|cli|commit>` or `status unknown (<error>)`.

So an edited, added or removed file under `.agents/skills/` fails `npm test` and CI. Rule 6 of §2.3 applies in full: the check reads the working tree, so a hidden or Git-ignored file such as `.DS_Store` there is an `unlisted-entry` too, and `git clean -fdx` in the message removes it (`-x` includes ignored files). An edit that also rewrites `snapshot.json` to match passes the offline check but fails CI and the release gate. In a brain, an edited copy stays a `product-file` lint error (§6.4). The hook's test in `tests/release-scripts.test.mjs` becomes: staging an edited vendored file is refused with the message, and staging a whole vendored release is accepted.

### 9.4 The product version and the snapshot's range (CC-105; the user's choice, 2026-11-05)

- **Invariant:** at every product commit, the vendored snapshot is compatible with `package.json`'s version. The offline check (§9.3) enforces it.
- **A fork release's range** starts at the release candidates (`-0`, §2.1) of the first product release that has every command, flag and field its skills use, so a release candidate of that release can ship them, and ends before the next minor: `>=0.9.2-0 <0.10.0` for CC-105's release. The fork's `snapshot.config.json` holds it (§10.1).
- **When that range starts above `main`'s version,** the product PR that vendors the release sets `package.json` and `package-lock.json` to the release it lands in, the range's lower bound without its `-0` (`npm version <x.y.z> --no-git-tag-version`). `main` then carries that unpublished version until it is released. CC-105 sets `0.9.2`, in the same commit as its vendoring, since neither passes `npm test` without the other.
- **`scripts/release.mjs <version>`** refuses a version of lower precedence than `package.json`'s, with `package.json is already <v>; release <v> or later`. For an equal version it runs `npm version <version> --no-git-tag-version --allow-same-version`. Its other checks still refuse a version already tagged or on npm.
- An unpublished version on `main` never pins a user's brain: `brain upgrade` from a source checkout is refused (`UNRELEASED_BUILD`, cli.md §5.15).
- Phase A's rule that the generated range follows `package.json` goes with the generator.

### 9.5 Changing a skill, from CC-105 on

A product task that changes a skill:
1. **The product first,** when the skill needs a CLI change: spec, then CLI, as usual. The vendored skills must keep passing the product's tests with it; otherwise the vendoring (step 5) is in the same product PR.
2. **A fork PR.** In a clone of the fork, a branch `claude/<task-id>-<slug>` from the fork's `main`, in its own worktree next to that clone. It edits `brain/<name>/`, and `snapshot.config.json` when the range or `linked_repo` changes. It passes the fork's checks (§10.3) and declares its impact (§10.4). When a product PR vendors it, the impact is `coordinated` with a `Product:` line linking that PR.
3. **One review.** The product PR body has a line `Fork: https://github.com/<owner>/ultimate-brain-skills/pull/<n>`. The pr-reviewer reviews both diffs against the task and posts its findings and its verdict on the product PR; the verdict covers both. While the fork PR is open, the product branch may hold a `--local` snapshot of its head (§9.2) to run the product's tests; CI stays red on it until step 5.
4. **Fork merge and release.** Once the review has no findings left, the user merges the fork PR (a merge commit). After the fork's push CI succeeds on that merge commit, and only on the user's yes, Claude Code pushes an annotated tag `brain-v<version>` on it, with the message `<task id>: <the task's Changelog line>` (CC-105's message is §9.10's). The fork's release workflow publishes it (§10.2). The yes is needed because a released tag can never be moved or deleted.
   - **Version:** of higher precedence than every earlier release (§10.2). By convention: major when a skill is retired or renamed, minor when a skill is added or the range moves, patch otherwise.
5. **Vendoring.** The product branch runs `node scripts/vendor-skills.mjs <version>` (and §9.4's version change when the range needs it) and commits `.agents/skills/`, with `package.json` and `package-lock.json` when §9.4 changed them, in one commit `<task id>: vendor ultimate-brain-skills <version>`. The reviewer checks that the release's `source.commit` is the fork PR's merge commit and that `--check --online` passes; then come the done commit and the pass, as usual.
6. **The integration issue.** The release appears as a change with its PRs' impact and their `Product:` links (§11.2). The session that vendors it classifies it `brain-work`, linked to the product PR, before the product release; it leaves the issue once the product's tested revision includes it.

A product task with no skill change makes no fork PR. A fork change with no product task (an upstream sync, a general skill) follows the fork's rules (§10.4, §10.5) and reaches the product only when a product task vendors a release that includes it.

No step needs both repositories to change at once: a fork release changes nothing for any user until a product PR vendors it, and that PR changes nothing in a brain until the user runs `brain upgrade` with the release that ships it.

### 9.6 What `init`, `link`, `upgrade`, `lint` and `status` do differently (CC-105)

| Command | In phase B |
|---|---|
| `brain init` | Same rules (§6.1). It copies the vendored snapshot's skills, each skill's listed files only (an `UPSTREAM-LICENSE.md` that a skill lists is copied like any other file, §10.2), and writes a lock naming `ultimate-brain-skills <version>`. The snapshot's `snapshot.json`, `LICENSE` and `NOTICE.md` stay in the package, as in phase A. |
| `brain link` | Same rules (§6.2): the linked skills are those whose `targets` include `linked_repo`. CC-105's release adds brain-workflow and brain-workflow-adopt to them (§9.7). The instruction block gains a paragraph when brain-workflow is linked (cli.md §5.12). A folder linked before keeps its skills until `brain link` runs there again; its brain-query, comparing `.brain` `skills` with `brain status`, asks for it. |
| `brain upgrade` | Same rules (§6.3). Rule 5 makes the switch from `ultimate-brain` to `ultimate-brain-skills` an ordinary upgrade. CC-105's release carries every skill phase A shipped, so nothing is retired. The commit is `upgrade: ultimate brain 0.9.2, skills ultimate-brain-skills 1.1.0`. |
| `brain lint` | Same rules (§6.4). `skills-update-available` already reports a package snapshot with another `name`; `product-file` messages name `ultimate-brain-skills <version>`. |
| `brain status` | No change. |

So the CLI's code changes only in `brain link`'s instruction block. The rest of phase B is the vendored data, the product's scripts and the skills' text.

### 9.7 The workflow skills in any working folder (CC-107's finding 9; the user's choice, 2026-11-05)

- **Through `brain link`.** CC-105's fork release sets `snapshot.config.json`'s `linked_repo` to `["brain-query", "brain-workflow", "brain-workflow-adopt"]`. `brain link <folder>` then installs the three skills, pinned to the brain's version, in any folder it links, a Git repo or not (cli.md §5.12). A later `brain link` there refreshes them, and a later release that drops one from `linked_repo` retires it from the folder (§6.2).
- **The instruction block** names the workflow skills and lets a connected workflow write its records through `brain workflow` commands (cli.md §5.12). A block written before is replaced in place, as every link run replaces it. A snapshot that links brain-workflow-adopt without brain-workflow gets no workflow lines: adoption runs brain-workflow's setup (brain-workflow-adopt step 1), so such a snapshot is a fork mistake, which the block doesn't hide.
- **Never global.** The CLI still never writes a global skill folder (§4). A global copy of a workflow skill is a competing copy (§5). Without a brain, standard tracking is the fork's general skills' job (0059).
- **Skill edits, in CC-105's fork PR** (§9.10):
  - brain-workflow `references/setup.md`, "Find what you can", step 1: when the working folder is not the brain and has no `.brain`, or its `.brain` `skills.names` lacks `brain-workflow`, the setup summary asks a second question in the same message: "Install the brain skills in this folder too, so a session started here finds them? `brain link` adds `.brain`, a block in AGENTS.md, and the brain-query, brain-workflow and brain-workflow-adopt skills." On yes, after `brain workflow new`, run `brain link <folder>` with `--project <id>` or `--area <id>` for the destination, pass on its warnings in a few words, and tell the user to commit what it wrote when the folder is a Git repo. On no, write nothing. It is asked only in setup. The offer is in the skill text from brain-v1.1.0 on, whose `linked_repo` lists the three skills, so the brain running it links them; the skill still reports the names `brain link` returns in `data.skills.names`, not the ones it promised.
  - brain-workflow `SKILL.md`: the brain resolves from `--brain`, `BRAIN_DIR` or the user's config. Drop "a `.brain` file" from that sentence: brain resolution has no such step (cli.md §4).
  - brain-repos `SKILL.md`, link step 5: the offer reads "Let this repo read the brain too? It adds `.brain`, a block in AGENTS.md, and the brain-query, brain-workflow and brain-workflow-adopt skills there." It reports the names `brain link` returns, as above.
  - brain-howto `references/guide.md`: the linked-repo paragraph's "(it adds `.brain`, a block in AGENTS.md and the brain-query skill there)" names the three skills the same way.
- **The specs already say so:** CC-134 amended cli.md §5.12, linked-repos.md §8 and connected-workflows.md §3.1. CC-105 builds them and edits no spec for this.

### 9.8 The release gate and the checks in phase B (CC-105; amends §11.3)

- `scripts/release.mjs` (through `skills-integration.mjs --release <version>`) also refuses, with the reason, when:
  - the online check of §9.3 fails. `vendor-skills.mjs` exports it as `checkVendored({ root, fork, online, request })`: `root` is the product checkout, `fork` the fork's `owner/name`, `request` a GitHub request function of the shape `skills-integration.mjs`'s `github()` returns; `fork` and `request` are needed only when `online` is true, and the offline `--check` passes neither. It resolves to `null` when the check passes and to §9.3's reason string otherwise, `status unknown (<error>)` included; it never throws for a failed check. `skills-integration.mjs` imports it and calls it with its own GitHub client, so `--repo`, the token and the mock API (`UB_GITHUB_API`, §12.4) are the same for both. The refusal is `vendored skills: <reason>`, with §9.3's reason;
  - the vendored snapshot's `version` is a prerelease and `<version>` is not: `a release ships released skills: vendor a brain-v release without a prerelease part`.
- `releaseSnapshotProblem` in `skills-integration.mjs` loses its phase A branch, which let a snapshot named `ultimate-brain` pass: the range check against `<version>` applies to every snapshot, and the online check runs after it, so a phase A manifest is refused on `name`.
- Nothing regenerates the manifest any more: `npm test`, `task.mjs start` and the daily workflow read the committed `.agents/skills/snapshot.json`, so their `build-skills.ts --snapshot` steps go.
- The CHANGELOG's line is `Skills: ultimate-brain-skills <version> (<integrity>)` (§11.1); `release.mjs` already takes the vendored `version` for any name other than `ultimate-brain`.

### 9.9 Brains on 0.8.1 and 0.9.x

**The order of events.** (1) The fork releases brain-v1.1.0: no CLI ships it, so no user is affected. (2) CC-105's product PR vendors it on `main`: no brain changes. (3) The 0.9.2 release ships it. (4) Each brain moves when its user runs `brain upgrade` with 0.9.2. Each step can happen without the next, and each can be undone on its own.

| Brain | With the 0.9.2 CLI |
|---|---|
| Made or last upgraded by 0.8.1 or earlier (no lock, `unpinned`) | The guard lets every command through (cli.md §5.28). `brain upgrade`: `from: null`; the lock is written for `ultimate-brain-skills 1.1.0`; skill folders the snapshot doesn't name are left alone (no old lock); the 0.9.0 and 0.9.1 steps (the `modules` block, the concept conversion, the retired keys) run in the same upgrade; `previous_cli` comes from the last `upgrade:` commit (§6.3). Rollback (§8) leaves it `unpinned` again. |
| Pinned `ultimate-brain 0.9.0` or `0.9.1` | Its lock's range (`>=0.9.0 <0.10.0` or `>=0.9.1 <0.10.0`) admits 0.9.2, so every command runs, and lint reports `skills-update-available`. `brain upgrade`: rule 5, an ordinary upgrade; nothing retired; only the files that differ are written, plus the lock; `previous_cli` is the old lock's `installed_by`. Rollback (§8) restores the `ultimate-brain` pin, which the restored CLI accepts. |
| Upgraded to 0.9.2, then run with a 0.9.0 or 0.9.1 CLI | The guard refuses with `SKILLS_INCOMPATIBLE` (older than `>=0.9.2-0`): install 0.9.2. If the user runs `brain upgrade` with the older CLI instead, its rule 5 switches the pin back to its own `ultimate-brain` snapshot, since another `name` is an ordinary upgrade in both directions. The brain is then consistent with that CLI, as after a rollback without the revert. |
| Upgraded to 0.9.2, then run with a CLI before 0.9.0 | That CLI ignores the lock (§9, phase A rules); a later 0.9.2 `brain upgrade` repairs the skill files. |
| A linked folder | Keeps its copied skills and `.brain` until `brain link` runs there again (§9.6). What a new link copies depends on the brain: an `unpinned` brain links from the package snapshot (brain-v1.1.0, so all three skills, with `SKILLS_UNPINNED`); a brain still pinned to `ultimate-brain 0.9.x` links from its own lock, so brain-query only, until its `brain upgrade`. |

Removing superseded global copies of the skills is step 6 of the migration plan, a deliberate switch with the user, not CC-105's. Until then lint keeps reporting them as `skill-competing` warnings (§5).

### 9.10 Skill changes since brain-v1.0.0 and how they reach the fork

brain-v1.0.0 is the product's `skills/` at product commit `458a94e` (its `Product-skills:` line). On 2026-11-05 its `brain/` and that `skills/` were identical, apart from `skills/README.md`, which the fork doesn't carry. Every later change to `skills/` reaches the fork in **CC-105's fork PR**, which:
1. replaces the fork's `brain/` with the product's `skills/` at commit **P**, byte for byte, without `README.md`. P is the product `main` commit that CC-105's branch last merged; the PR body names it on a line `Product-skills: <40 hex>`;
2. adds §9.7's skill edits in a separate commit;
3. sets `snapshot.config.json` to `{ "cli": ">=0.9.2-0 <0.10.0", "linked_repo": ["brain-query", "brain-workflow", "brain-workflow-adopt"] }`;
4. adds to `tools/leak-allow.txt` the synthetic ids the new skill text uses, as the product's `scripts/leak-allow.txt` lists them;
5. declares `Brain impact: coordinated` with a `Product:` line linking CC-105's product PR.

The fork then releases **brain-v1.1.0** on that PR's merge commit. If the changes after P (below) need a further release, CC-105 vendors that one instead, and its version replaces 1.1.0 wherever this spec names CC-105's release (§9.6, §9.9, §9.11, §12.5). Its annotated tag message is `CC-105: the product's skills at <P>, the workflow skills linked`, then the line `Product-skills: <P>` (a further release adds the `Product-skills:` line of the `main` it carries).

The changes it carries, from `git log --format='%h %s' 458a94e..<P> -- skills/` (the 0.9.0 and 0.9.1 rows are complete; the 0.9.2 row is whatever merged before P):

| Release | Task | Skill files changed |
|---|---|---|
| 0.9.0 | CC-103 | brain-connect-notion `SKILL.md` |
| 0.9.0 | CC-104 | brain-repos, brain-workflow and brain-workflow-adopt (new skills); brain-howto `SKILL.md` and `references/guide.md` |
| 0.9.0 | CC-112 | brain-howto `references/guide.md`; brain-ingest `references/cli-inputs.md`, `extraction.md`, `selection.md` |
| 0.9.0 | CC-114 | brain-howto `references/guide.md`; brain-ingest `SKILL.md`, `references/notion.md`, `sources.md`; brain-sync `SKILL.md` |
| 0.9.0 | CC-117 | brain-catch-up `SKILL.md`; brain-ingest `SKILL.md`, `references/sources.md` |
| 0.9.0 | CC-121 | brain-howto `references/guide.md` |
| 0.9.0 | CC-129 | brain-repos `SKILL.md` |
| 0.9.1 | CC-123 | brain-catch-up, brain-connect-notion and brain-sync `SKILL.md`; brain-howto `references/guide.md`; brain-ingest `SKILL.md`, `references/cli-inputs.md`, `extraction.md`, `notion.md`, `sources.md`; brain-sync `references/formats.md` |
| 0.9.1 | CC-124 | brain-catch-up, brain-connect-notion, brain-query and brain-sync `SKILL.md`; brain-howto `references/guide.md`; brain-ingest `references/notion.md`; brain-sync `references/formats.md` |
| 0.9.1 | CC-125 | brain-apply, brain-catch-up, brain-notion-change and brain-sync `SKILL.md`; brain-howto `references/guide.md`; brain-ingest `references/notion.md`; brain-workflow `references/notion.md` |
| 0.9.1 | CC-126 | brain-howto `references/guide.md`; brain-ingest `SKILL.md`, `references/extraction.md`, `selection.md`, `sources.md`, `todo-tidy.md` (new) |
| 0.9.1 | CC-130 | brain-workflow `SKILL.md`, `references/notion.md` |
| 0.9.1 | CC-131 | brain-sync `SKILL.md`, `references/formats.md` |
| 0.9.1 | CC-132 | brain-repos `SKILL.md` |
| 0.9.2 | CC-118, CC-135 when merged before P | brain-repos (CC-118); brain-sync and brain-catch-up (CC-135) |

**Changes after P.** Whether a further release is needed is CC-105's call at its last merge of `main`, by the rule below; its version is the next patch or minor (§9.5). A skill change merged to product `main` after P reaches the fork by another commit on the same fork PR while it is open, or by a further fork PR and release once it has merged, before CC-105's product PR merges. That PR merges only when its vendored skill files equal `skills/` on the `main` it last merged (its final merge of `main`, before the done commit), apart from §9.7's files. The evidence is `git archive <that main> skills | tar -x -C <empty temp>` and `diff -r <temp>/skills .agents/skills`, which may list only `README.md`, `snapshot.json`, `LICENSE`, `NOTICE.md` and §9.7's four files; in those four, the only differences are §9.7's edits (a change after P to one of them is carried with §9.7's edit on top). Once CC-105 has merged, `skills/` is gone: a branch that still edits it meets a modify/delete conflict when it merges `main`, re-adding it fails §9.1's test, and its change goes to the fork (§9.5).

### 9.11 The skills-integration issue (#213)

- **Its open change,** the release `1.0.0` (to fork commit `5d450c2`), stays `ready`, as decision 0069 classified it. CC-105 never vendors 1.0.0: its range admits 0.9.2, but it lacks every change in §9.10, so its text doesn't match the 0.9.1 CLI's contracts (concepts became learned Documents, reports became Documents). brain-v1.1.0 is built on a fork commit after `5d450c2`, so once the product's tested revision is 1.1.0, the 1.0.0 change is at or before `tested.commit` and §11.2 drops it.
- **brain-v1.1.0** enters the issue as a `release` change from `5d450c2`, with impact `coordinated` and CC-105's product PR in its `links`, `unclassified`. Unclassified, it blocks the 0.9.2 release (§11.3). CC-105 classifies it `brain-work` (its link is CC-105's PR) before the release. Once the product's tested revision is 1.1.0, the check drops both changes and closes the issue.

## 10. The fork: ultimate-brain-skills (CC-101)

**What CC-101 delivers:**
- The public repository on GitHub, created only after the user says yes (0059; grill 2026-11-03). It holds the upstream repository's full Git history but isn't a GitHub fork: the account's one GitHub fork of upstream is already used by another collection, so the user chose a standalone repository (2026-11-03). `LICENSE` and `NOTICE.md` carry the attribution.
- Its files and workflows (§10.1 to §10.5).
  - **Creation:** the repository is created with Actions disabled, and upstream's history up to the base is pushed to `main` unchanged, so upstream's workflows never run. Then Actions is enabled and CC-101 applies the protection (§10.3).
  - **Bootstrap:** one PR adds every file of §10.1, `brain/` and the workflows, and removes upstream's `.github/`. It declares `coordinated` with a `Product:` link to CC-101's product PR, and the user merges it. The push-to-`main` CI must succeed on its merge commit before the first release.
  - Every change reaches `main` through a PR.
- Its first snapshot release, `brain-v1.0.0`: `brain/` holds the product's `skills/` as on product `main` when CC-101 runs (the commit is named in the release notes as `Product-skills: <40 hex>`), and `snapshot.config.json` declares `>=0.9.0 <0.10.0`.
- The fork's tooling lives in `tools/`. It is Node (≥ 22.6, the product's floor), with `ajv` and `yaml` as its only dependencies (`yaml` parses skill frontmatter the way the product does).

### 10.1 Layout and attribution

- **`LICENSE`:** upstream's licence file, kept verbatim with its copyright line, plus a line for the fork's own additions.
- **`NOTICE.md`:** the upstream repository URL, a statement that the fork is derived from it, and the rule below for telling local additions from upstream content.
- **`upstream.json`:** `{ "repository": "https://github.com/mattpocock/skills", "commit": "<40 hex>" }`, the upstream commit last merged. Initially it is `a496f5513d4a4cf889bc48e189e579f4b0bdf6aa`, the base CC-97's inventory compared against (the user's choice, 2026-11-03); the first upstream-sync run then proposes the upstream commits after it. Only an upstream-sync PR changes it (§10.5).
- **Where content lives:**
  - Upstream content stays in upstream's paths.
  - Operational skills live in `brain/<name>/`.
  - General local additions live in folders upstream doesn't use.
  - So the path tells local content from upstream content.
- **`snapshot.config.json`:** `{ "cli": "<range>", "linked_repo": ["brain-query"] }`, no other keys. `cli` is the declared range of the next snapshot release (§2.1 grammar). `linked_repo` lists the operational skills `brain link` installs; each must be a folder in `brain/`. PRs change it.
- **`schemas/skills-snapshot.schema.json`:** a copy of this repo's schema. When the product changes the schema, a coordinated PR updates the copy.
- **`.gitattributes`:** `* -text`, so the bytes in a checkout are the bytes in Git.
- **Leak check:** no credentials, personal paths, emails or brain content anywhere (0014, 0059). The fork's CI runs a copy of this repo's `scripts/leak-check.mjs` as `tools/leak-check.mjs`, with its own allowlist `tools/leak-allow.txt`. The upstream copyright line in `LICENSE` is required attribution, not personal data. It needs no allowlist entry unless a rule matches it.

### 10.2 Building and releasing a snapshot

**Build.** A build script produces the §2 folder from Git, never from the working tree. The source is `brain/` at one commit, and the files of a skill are the Git blobs under `brain/<name>/` at that commit, as `git ls-tree -r` lists them. A symbolic link, a submodule, a file directly in `brain/` or a folder without `SKILL.md` fails the build. The manifest takes:
- `name`: `ultimate-brain-skills`;
- `version`: from the tag, or from `0.0.0-ci.<PR number>` in PR CI;
- `cli` and the `linked_repo` targets: from `snapshot.config.json` at that commit;
- `source`: `repository` = `https://github.com/<GITHUB_REPOSITORY>`, `commit` = the commit built (for a tag, the commit it points to, annotated or not);
- `upstream`: `upstream.json` at that commit;
- files and `integrity`: per §2.2.

The snapshot also carries `LICENSE` and `NOTICE.md` at the top level. Brains receive only skill folders. An operational skill that contains upstream-derived text therefore carries upstream's licence file verbatim as `UPSTREAM-LICENSE.md` inside its own folder (listed in `files`, not linked from `SKILL.md`), so the notice reaches every brain that installs it. `brain-v1.0.0` ships no such file: its skills are the product's own writing.

**Reproducible:** building the same commit and version twice yields byte-identical `snapshot.json` (§2 serialisation) and identical files. The tarball doesn't need to be byte-identical.

**Release.** Pushing a tag matching `brain-v*` runs the release workflow. It refuses, creating nothing and leaving the tag for the user to delete, when:
- the tag isn't `brain-v<SemVer without build metadata>`;
- the commit isn't reachable from `main`;
- CI did not succeed on that commit on `main`;
- a GitHub release with that tag already exists;
- the version isn't higher in precedence than every earlier `brain-v` tag that has a release.

Otherwise it builds the snapshot, validates it (§2.3, with the fork's own implementation and the vendored schema), and creates the release:
- asset `ultimate-brain-skills-<version>.tar.gz`, whose root holds the snapshot folder's entries;
- release notes that start with the message of an annotated tag (`brain-v1.0.0`'s carries the `Product-skills:` line) and end with the lines `Integrity: <integrity>`, `Tarball-SHA256: <hex>` and `CLI: <range>`.

Prereleases (`brain-v1.1.0-rc.1`) are marked as prereleases on GitHub.

**Immutable:** a released tag is never moved or deleted, and its asset never replaced. A fix is a new version. A tag that was refused was never released, so deleting it is allowed. The product side detects a violation (§6.3 rule 4).

### 10.3 The fork's CI on every PR to `main`

Runs on `opened`, `edited`, `synchronize` and `reopened`, including drafts and PRs from other forks. A push to `main` runs the same checks except `impact`, building the snapshot with version `0.0.0-main`; "CI succeeded on that commit" (§10.2) means those four check runs (`skills`, `names`, `snapshot`, `leak`) concluded `success` on it.

**Branch protection** on `main` is applied by CC-101 with the user's `gh` login once the repository exists:
- a PR is required, also for admins, so nothing reaches `main` undeclared;
- the checks `skills`, `names`, `snapshot`, `impact` and `leak` are required;
- **merge commits only**.

The PR's evidence is the output of `gh api repos/<owner>/ultimate-brain-skills/branches/main/protection`. The checks:
1. **`skills`:** the same frontmatter and style rules as this repo's `scripts/build-skills.ts` (name = folder, only `name` and `description`, description ≤ 1024 characters, references one level deep, no capitals for emphasis), for every skill folder in `brain/`.
2. **`names`:** a general skill is any folder outside `brain/` holding a `SKILL.md`. Its folder name and its frontmatter `name` must both differ from every operational skill's. When an upstream sync introduces a clash, this check fails on the sync PR. The user decides whether to rename the operational skill (a `coordinated` PR) or drop the upstream skill.
3. **`snapshot`:** builds and validates the snapshot of the PR's merge commit, with version `0.0.0-ci.<PR number>`.
4. **`impact`:** §10.4.

### 10.4 Impact declaration (every PR)

**Parsing the PR body:**
- Line endings are normalised to LF.
- Each line's trailing whitespace is trimmed.
- Lines inside fenced code blocks and HTML comments are ignored. The PR template lists the options inside a comment.
  - A fence opens and closes with a line of up to three spaces followed by three or more backticks or tildes (CommonMark); an unclosed fence runs to the end.
  - A comment runs from `<!--` to the next `-->`, across lines; an unclosed comment runs to the end. Hiding the declaration that way makes it missing, so the check fails.

**What the body must contain:**
- Exactly one line matching `^Brain impact: (none|compatible|coordinated)$`.
- Any number of lines matching `^Product: https://github\.com/[^/]+/ultimate-brain/(issues|pull)/[0-9]+$`. With `none` or `compatible` they are allowed and ignored.

**"Operational change":** the diff from the merge base to the PR head (three-dot), renames and deletions included, touches `brain/` or `snapshot.config.json`.

| Value | Meaning | Rule |
|---|---|---|
| `none` | no operational change | fails if there is an operational change |
| `compatible` | operational skills change but keep working with every CLI in the declared range | fails without an operational change; fails if `cli` in `snapshot.config.json` changed |
| `coordinated` | needs a product change: a new CLI command or field, a range change, a renamed or retired skill | fails without a `Product:` line |

The check also fails when the `Brain impact:` line is missing, appears twice, or has another value (including `unassessed`).

It checks the link's form only. The product repo is private, and the fork's token can't read it. The product's daily check (§11.3) is where the link is followed.

### 10.5 Upstream changes

**Schedule:** daily at 05:00 UTC and on manual dispatch, using `UPSTREAM_SYNC_TOKEN` (§11.4). A missing or rejected token fails the workflow loudly; it never falls back to `GITHUB_TOKEN`.

**Each run:**
1. Read upstream's default branch name and head through the GitHub API.
2. **Up to date:** if the head equals `upstream.json`'s commit, or is an ancestor of `main`, stop.
3. **Rewritten history:** if `upstream.json`'s commit is not an ancestor of the head, upstream history was rewritten. Open or update the issue (step 7) with that reason, and stop.
4. **Rebuild the branch,** only when `upstream-sync` doesn't exist, or its merge's parents are not the current `main` head and the upstream head:
   - recreate the branch `upstream-sync` from `main`;
   - merge the upstream head with `--no-ff`;
   - resolve `.github/**` to the fork's version, so upstream workflows never run in the fork; any other conflict is a conflict (step 6);
   - add a second commit setting `upstream.json` to the head, and force-push.

   The branch belongs to the workflow; nobody commits to it.
5. **Open or update one PR:**
   - title `Upstream sync to <7-hex head>`;
   - the body lists upstream's commits from the recorded base to the head (`git log --oneline`, at most 50 lines, then `…and <n> more`);
   - it ends with `Brain impact: unassessed`, so the impact check fails until a person or agent sets a real value;
   - when the head is the same as the open PR's, the body is left alone, so an assessment already written stays;
   - when no sync PR is open, one is opened, except when a person closed a PR for this same head without merging it. A PR the workflow closed (step 6) doesn't count.
6. **Merge conflict:** push nothing, close any open sync PR with a comment pointing to the issue, and go to step 7.
7. **The issue:** open or update one issue labelled `upstream-sync` (the label is created when absent), titled `Upstream sync conflict at <7-hex head>`. It lists the reason and the conflicting paths. The first later run that merges cleanly closes it with a comment.

**Merging:** never automatic. The user merges with a merge commit, so the base stays an ancestor.

**Resolving by hand** (a conflict, a `names` clash, an upstream skill to drop): a person or agent merges the upstream head on another branch, resolves it, sets `upstream.json`, and opens a PR declaring its impact. Once it is merged, the upstream head is an ancestor of `main`, so the workflow stops at step 2 and closes the issue.

## 11. Update awareness

### 11.1 Revisions

- **Tested revision:** the snapshot the product's `main` ships, i.e. its package `snapshot.json`.
  - In phase A, `name` `ultimate-brain` and the package version.
  - In phase B, the fork's `version` and `source.commit`.
  - Each product release from 0.9.0 on records it: the release's CHANGELOG section ends with one line `Skills: <name> <version> (<integrity>)`, which `release.mjs` writes (CC-106). In phase A `<version>` is the version being released: `prepack` regenerates the manifest with it, and the integrity covers the files only, so it is the same as on `main`.
- **Assessed revision:** the newest fork revision (a released snapshot, or an unreleased `main` commit) whose impact on the product has been classified. It lives in the integration issue (§11.2), never in the package.
- **What the fork provides for these** (CC-101): its `brain-v` releases with the notes lines of §10.2, its `main` head, and its merged PRs' bodies. The product reads them with the GitHub REST API (§11.4): `GET /repos/<owner>/ultimate-brain-skills/releases`, `…/commits/main`, `…/compare/<base>...<head>` and `…/commits/<sha>/pulls`. The fork keeps the repository name and `main`; renaming either is a coordinated change.

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
  - `changes`: one entry per fork release after `assessed` (`kind` `release`, with its `release` version), plus at most one `unreleased` entry for the commits after the latest release.
    - `from`/`to` are the fork commits the entry covers.
    - `impact` is the strongest declaration among its merged PRs (`coordinated` > `compatible` > `none`), or `undeclared` when a PR has no valid line.
    - `links` holds the product issues or PRs, `note` the classifier's reason, and `error` a problem the check found (a dead link).
    - When the check runs again, it extends the open `unreleased` entry's `to` instead of adding another. When those commits are released, it turns the entry into a `release` entry and keeps its classification.
  - **How the check derives `changes`** on every run (CC-106):
    - *At or before:* commit `a` is at or before `b` when they are equal or the fork's compare API (`compare/a...b`) reports `b` `ahead`.
    - *Segments:* from `assessed.commit` (none before the first classification), one `release` segment per non-draft `brain-v` release whose commit is not at or before the previous boundary, in version order, then one `unreleased` segment to the fork's `main` head when the head is not at or before the last boundary. The fork's first release has no `from` and no `impact`: there is nothing earlier to compare.
    - *Carrying classification:* a segment with the same `from` and `to` as an earlier entry keeps that entry's `classification`, `links` and `note`. A segment with the same `from` but a new `to` (more commits, or a release cut at another commit) keeps `links` and `note` but is `unclassified` again, because its new commits are unassessed. An earlier `ready` or `brain-work` entry that no segment matches stays as it was. Entries at or before `assessed` are kept as they are, subject to pruning.
    - *Impact:* the merged PRs of a segment are those of its merge commits (`commits/<sha>/pulls`; the fork merges with merge commits only, §10.3). The compare API's commits are read page by page (100 per page); a segment whose commits can't all be listed is `unknown`, never a partial impact. With no merged PR the impact is `undeclared`. The `Product:` links of its `coordinated` PRs are added to the entry's `links`.
    - *Errors* are recomputed on every run and cleared once their cause is gone: every `links` URL of the form `https://github.com/<owner>/<repo>/(issues|pull)/<n>` must name the product repo and resolve there, else `error` `dead link <url>`; and the vendored schema check (§11.3). An `unclassified` entry with an error becomes `brain-work`. A change with an `error` blocks a release (§11.3): its link is not a working linked task.
- **Where the state lives between runs.** The open issue's block. With no open issue, the block of the most recently updated closed issue with the label, so `assessed` survives a closed issue. With neither, the check starts from `assessed` `null`. A block that doesn't parse or validate is `unknown` (error `integration block in #<n> is invalid: …`), and the check changes nothing.
  - Each entry has a `classification`:
    - `unclassified`: set by the check.
    - `ready`: deliberate upgrade possible.
    - `brain-work`: linked brain work required; needs `links`.
    - `no-action`: reviewed, nothing to do.
  - `last_check`: `{ "at", "status": "ok"|"unknown", "error" }`.
- **Classifying.** Claude Code classifies changes in a planning session by editing the block. It moves `assessed` forward only when every change up to that revision has a classification other than `unclassified`.
- **Seeing a change never dismisses it.** A `brain-work` change stays listed, with its links, until its task is `done` (every link is a closed issue, a merged PR or a commit URL, and the entry has no `error`) and the product's tested revision includes it (`to` at or before `tested.commit`; a phase A `tested` has no commit, so it includes no fork change). A `ready` change stays until the tested revision includes it. A `no-action` change is dropped once `assessed` moves past it.
- **Closing.** The issue is closed (reason completed) when `changes` is empty after that pruning; the closed issue keeps the final block. Otherwise it stays open, and only one issue is used:
  - a second open issue with the label makes the check report `unknown` (error `two integration issues`) and change nothing;
  - with none open and a change to record, it opens one.

### 11.3 When the check runs (CC-106)

| When | How | On failure |
|---|---|---|
| **Daily** | product workflow `skills-integration`, 06:00 UTC and on manual dispatch | `last_check.status` `unknown` with the error, written to the open issue if there is one; the workflow fails, so GitHub notifies the owner |
| **Start of product work** | `scripts/task.mjs start` runs the check without writing and prints one line to stderr: `skills integration: <n> open, <m> unclassified` or `skills integration: status unknown (<reason>)` | never blocks |
| **Before a release** | `scripts/release.mjs`, for releases from 0.9.0 on (earlier ones predate the package snapshot), after `npm test` has regenerated the package snapshot; `--dry-run` runs the check without writing | refuses with the reason, when: the package snapshot is invalid or excludes the version being released (in phase A it never excludes it: `prepack` regenerates its range from the released version); the check status is `unknown`; a change that may be incompatible is `unclassified` (its `impact` is `coordinated` or `undeclared`, or it has none, as the fork's first release); or a change has an `error`. An unclassified `compatible` or `none` change only prints a warning: 0059 blocks incompatible releases, not unrelated skill development. A `brain-work` change with a linked task doesn't block. It is tracked, and blocking it would stop unrelated releases. Phase B adds two refusals (§9.8). |

All three run `node --experimental-strip-types scripts/skills-integration.mjs` (`--dry-run` reads only; `--json`; `--release <version>` adds the release rules; `--repo <owner/name>`, else `GITHUB_REPOSITORY`, else the `origin` remote; `--root <dir>` for the package snapshot and `spec/`). It reads the tested revision from `<root>/.agents/skills/` (an invalid package snapshot is `unknown`), and it exits 1 when the status is `unknown` or the release rules refuse. The fork is `<product owner>/ultimate-brain-skills`.

For each `coordinated` fork PR merged since `assessed`, the check verifies that every `Product:` link resolves to an issue or PR in the product repo. A link that doesn't resolve is recorded as a `brain-work` change with `error`, and is never silently dropped.

The check also compares the fork's `schemas/skills-snapshot.schema.json` at its `main` head with the product's `spec/schemas/skills-snapshot.schema.json`, as parsed JSON (a missing copy differs). A difference is recorded as a `brain-work` change with `error` `vendored schema differs`, and the links point to the product commit that last changed the schema (`commits?path=…`). It goes on the entry whose `to` is the fork head; when every entry is at or before `assessed`, an `unreleased` entry with `from` and `to` both the head carries it.

**No false current status:** a skill or report says the product is current only when `last_check.status` is `ok`, `seen.head` equals `assessed.commit`, and `changes` is empty.

### 11.4 Credentials

| Job | Credential | Scope |
|---|---|---|
| Fork: release, CI checks | the fork's `GITHUB_TOKEN` | its own repository |
| Fork: upstream sync | `UPSTREAM_SYNC_TOKEN`, a fine-grained token or GitHub App installation | the fork only; contents, pull requests, issues and workflows write. Workflows write is needed because the pushed upstream commits may touch `.github/`, even though the merge keeps the fork's version. A PR opened with `GITHUB_TOKEN` would not start the fork's CI, so the impact check would never run on it. |
| Product: daily check, release check | the product's `GITHUB_TOKEN` (`issues: write`, `contents: read`, `pull-requests: read`); locally, `GH_TOKEN`, else `GITHUB_TOKEN`, else `gh auth token` with the user's login, when run by `task.mjs` or `release.mjs` | the product repo; the public fork read with the same token (public data needs no permission, and anonymous requests share a 60-per-hour limit per address) |

Credentials live only in the repositories' Actions secrets or the user's `gh` login. They are never stored in a file, an issue, a snapshot or a log. A lost credential is recovered by reauthorising (a new token in the secret), never by committing one. A missing or rejected credential is a failed check (`unknown`), never a pass.

## 12. Acceptance tests

### 12.1 CC-100 (product repo, fixture snapshots, no network)

**Fixtures** live in `tests/fixtures/skills-snapshots/`, with synthetic content CC-100 writes:
- **A:** `ultimate-brain-skills 1.0.0`, `cli` `>=0.9.0 <0.10.0`, skills `brain-apply`, `brain-old` and `brain-query` (linked).
- **B:** `1.1.0`, the same range: `brain-apply` changed, `brain-old` retired, `brain-new` added.
- **Invalid:** one snapshot per §2.3 reason id.

Integrity values are computed by the fixtures' generator, not fixed in the spec. Tests inject the package root and the running CLI version through the same seam the installed-package lookup uses (cli.md §5.15), and set `HOME` to a temporary folder.

1. **Range:** comparator parsing and satisfaction, prereleases included; newer and older (§2.1).
2. **Validation:** integrity is recomputed equal for A and B, and each invalid fixture fails with its §2.3 reason id.
3. **`init`:** writes both trees and a lock equal to `{format, installed_by, snapshot}`. An invalid package snapshot refuses with nothing written.
4. **States and guard:** one test per state (§3). The guard (cli.md §5.28) refuses a write command for `invalid`, `incompatible` (both directions, both messages) and `missing`, and a read command (`query`) too. `status`, `lint`, `upgrade` and `recover` run.
5. **`upgrade`:**
   - A→B: files written, `brain-old` removed from both trees, lock updated, `previous_cli` set, commit message names the snapshot.
   - A second run reports `files: []`.
   - B→A with the same name: `SKILLS_DOWNGRADE`.
   - Same version, different content: `SKILLS_SNAPSHOT_INVALID`.
   - `ultimate-brain`→`ultimate-brain-skills`: allowed.
   - Unpinned → pinned. An invalid lock is replaced with `SKILLS_LOCK_REPLACED`.
   - `--dry-run` refuses the same way.
6. **`lint`:** `product-file` against the lock (a newer compatible package reports no drift, plus `skills-update-available`), `skills-lock`, `skills-incompatible`, `skills-unpinned`, `skill-duplicate`, `skill-competing` (each global folder, a broken symbolic link, the plugin entry), and no global checks when `HOME` is empty.
7. **`link`:** copies from the brain's pinned copy, not the package. A drifted file refuses. `.brain` gets `skills`. A retired linked skill is removed. Unpinned uses the package with a warning.
8. **Rollback** (§8): upgrade A→B, revert the commit, run with a version in A's range: state `pinned`, lint exits 0.
9. **Package check** (§12.3).

### 12.2 CC-101 (fork repo)

1. **Build:** a tag builds a snapshot that the fork's validator and the vendored schema accept. A second build of the same commit is byte-identical. Once CC-100 has merged, the PR's evidence also shows CC-100's validator accepting the built folder.
2. **Release refusals:** an existing version, a lower version, a malformed tag, and a commit not on `main` are each refused, with nothing created.
3. **Impact check:** each failing case of §10.4, each passing value, CRLF bodies, and the options inside an HTML comment ignored.
4. **Upstream sync** against a test upstream:
   - a new commit opens one PR with `Brain impact: unassessed`;
   - a second run with the same head leaves the body alone;
   - a newer head updates the PR;
   - a conflict closes the PR and opens one issue;
   - rewritten history opens the issue;
   - nothing merges.
5. **Repository rules:** the `names` check fails on a clash; the leak check passes; `LICENSE`, `NOTICE.md`, `upstream.json`, `snapshot.config.json` and `.gitattributes` are present; branch protection requires the checks and allows merge commits only.

### 12.3 Package check (CC-100: `scripts/test-package.mjs`)

In addition to today's checks, the packed tarball:
- contains `.agents/skills/snapshot.json`, valid (§2.3) and compatible with the packed version.

Then:
- `init` from the installed tarball writes a lock whose `snapshot` equals the packed manifest;
- `brain status --json` reports `data.skills.state` `pinned`;
- `lint` passes;
- an immediate `upgrade` reports `files: []`.

### 12.4 CC-106 (product repo, mocked GitHub API, no network)

The update check against a compatible change, an incompatible change, an unreleased change and an unavailable source (migration plan step 7): one integration issue throughout, `unknown` on the unavailable source, and no change dropped before it is classified.

Tests run the check against a mock GitHub API (`tests/fixtures/github-mock.mjs`: the product's issues, the fork's releases, history, PRs and vendored schema) and a synthetic package snapshot; the scripts' tests point every other run at a closed local port. `tests/skills-integration.test.mjs` covers §11.2 and §11.3's check; `tests/release-scripts.test.mjs` covers the release gate, the `Skills:` line and `task.mjs start`'s line.

### 12.5 CC-105 (both repos; product tests with a mocked GitHub API, no network)

**Product tests**, with the mock of §12.4 extended by the fork's release tags, tag objects and assets, and tarballs the tests build from the fixture snapshots of §12.1 (renamed and re-versioned where a case needs it):
1. **Vendoring** (§9.2): `vendor-skills.mjs <version>` writes `.agents/skills/` equal to the release's entries and prints the report line with its added, changed and retired skills. Each refusal of steps 1 to 6 writes nothing: no release, a draft, a missing or doubled notes line, no asset, a tarball whose hash differs, a member with a `..` segment, an invalid snapshot, each mismatch of step 5, and a range that excludes `package.json`'s version (with its message). A failure while writing leaves the old folder.
2. **`--local`:** with a stub `tools/build-snapshot.mjs` in a temporary fork checkout, the built snapshot is vendored as `0.0.0-local`; `--check` passes on it and `--check --online` fails.
3. **The checks** (§9.3): `--check` passes on a vendored release and fails with its reason on an edited skill file (`file-mismatch`), an added file (`unlisted-entry`), a phase A manifest (`name ultimate-brain`), and a `package.json` version the range excludes. `--check --online` also fails on a manifest rewritten to match edited bytes, on a release that doesn't exist, and on an unreachable API (`status unknown`).
4. **No `skills/`** (§9.1): the test fails with its message when Git tracks a file under `skills/`, and passes when it tracks none, whatever untracked files lie there.
5. **Release scripts** (§9.4, §9.8): a version lower than `package.json`'s is refused; an equal one passes the version step; a prerelease vendored snapshot refuses a release without a prerelease part; a failing online check refuses; the `Skills:` line names `ultimate-brain-skills` and its version.
6. **`brain link`** (§9.7, cli.md §5.12): from a snapshot whose `linked_repo` skills are brain-query, brain-workflow and brain-workflow-adopt, link writes the three into both trees, `.brain` `skills.names` lists them, and the block has the workflow paragraph and the extended read-only line. From fixture A (only brain-query linked) the block is byte for byte as before. A `.brain` with `names: ["brain-query"]` gains the two new skills on the next link.
7. **`brain upgrade`** (§9.9): a brain pinned to a phase A `ultimate-brain` snapshot upgrades to an `ultimate-brain-skills` one with the same skill names: the lock switches, `retired` is empty, only differing files are written, and the commit message names the new snapshot. An unpinned brain upgrades to it too.
8. The existing tests, `npm run typecheck`, the leak check and `npm run test:package` pass, the last with the vendored snapshot (offline, the files match the manifest; that the manifest matches the fork's release is the online check of item 9 and §9.3): the packed `.agents/skills/` passes the offline check (§9.3; it holds the fork's `snapshot.json`, `LICENSE` and `NOTICE.md`, and nothing else beside the skills), `init` pins `ultimate-brain-skills`, and an immediate `upgrade` reports `files: []`.

The tests build their tarballs with `tar -czf -C <folder> <entries>`, as the fork does (§10.2), from snapshots `tests/skills-fixtures.ts` writes; that generator and the tests that use it stay. Tests that need a version read it from the vendored manifest: `1.1.0` in this spec is CC-105's expected release, not a literal to assert. In the test product root (`tests/helpers.ts`), the vendored `LICENSE` and `NOTICE.md` are top-level snapshot files, which readers ignore (§2).

**Evidence in the PRs:**
9. **The fork:** CC-105's fork PR passes `skills`, `names`, `snapshot`, `impact` and `leak`; brain-v1.1.0 is released on its merge commit, with `Product-skills: <P>` in its notes and `CLI: >=0.9.2-0 <0.10.0`; `vendor-skills.mjs --check --online` passes on the product branch.
10. **Nothing lost** (§9.10): the `diff -r` against `skills/` on the `main` CC-105 last merged lists only the allowed files.
11. **Upgrade trial** on synthetic brains in an isolated `HOME`, as `eval/acceptance-0.9.0/harness/rollback.mjs` does: a brain made by `ultimate-brain@0.8.1` and one pinned by `ultimate-brain@0.9.1`, both from npm, each upgraded with the packed 0.9.2: `brain status` reports `pinned`, `ultimate-brain-skills` `1.1.0`, and lint has no errors. Then the §8 rollback restores each, and `brain lint` exits 0 with the old CLI.
12. **The integration issue** (§9.11): no change is `unclassified`, and `node scripts/release.mjs 0.9.2 --dry-run` passes the skills gate.
