// release.mjs: its checks before any change, the CHANGELOG it writes, the tag, the publish and the push, and the version checks.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_INTEGRITY, PRODUCT, writePackage } from "./fixtures/github-mock.mjs";
import { test, VENDORED, temporaryRoot, run, runAsync, integrationMock, command, fakeCommands, npmOwner, releaseDryRun, releaseRepository, gateDryRun } from "./scripts-helpers.mjs";

test("release refuses before any change when npm is not logged in as a package owner", (t) => {
  for (const [npm, message] of [
    ['case "$1" in whoami) echo "npm error code E401" >&2; exit 1 ;; esac', /npm is not logged in \(npm whoami: npm error code E401\); run npm login/],
    ['case "$1" in whoami) printf other ;; owner) printf "tester <tester@example.test>\\n" ;; esac', /npm user other is not an owner of fixture \(owners: tester\)/],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = run("release.mjs", ["0.4.0"], { root, env: { PATH: releaseDryRun(root, { npm }) } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.equal(readFileSync(join(root, "package.json"), "utf8"), '{"name":"fixture","version":"0.0.0"}\n');
  }
});

test("release accepts a package that was never published", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const npm = 'case "$1" in whoami) printf tester ;; owner) echo "npm error 404 Not Found - GET https://registry.npmjs.org/fixture" >&2; exit 1 ;; esac';
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: releaseDryRun(root, { npm }) } });
  assert.equal(result.status, 0, result.stderr);
});

test("release waits for a CI run on HEAD that is still running", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const count = join(root, "ci-count");
  const ci = `n=$(cat '${count}' 2>/dev/null || echo 0); echo $((n + 1)) > '${count}'; if [ "$n" -lt 2 ]; then printf 'CI\\tpush\\tmain\\tin_progress\\t\\n'; else printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n'; fi`;
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: releaseDryRun(root, { ci }), UB_CI_POLL_MS: "1" } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Waiting for CI on HEAD/);
  assert.equal(readFileSync(count, "utf8").trim(), "3");
});

test("release stops waiting for CI after its polls and refuses", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ci = "printf 'CI\\tpush\\tmain\\tqueued\\t\\n'";
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: releaseDryRun(root, { ci }), UB_CI_POLL_MS: "1", UB_CI_POLLS: "2" } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CI is not green on HEAD \(pending\)/);
});

test("release does not wait for CI when it already refuses", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ci = "printf 'CI\\tpush\\tmain\\tin_progress\\t\\n'";
  const npm = 'case "$1" in whoami) exit 1 ;; esac';
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: releaseDryRun(root, { ci, npm }), UB_CI_POLL_MS: "60000" } });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /Waiting for CI/);
  assert.match(result.stderr, /CI is not green on HEAD \(pending\)/);
});

test("release 0.4.0 generates task-row changelog entries and skips dropped tasks", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## 0.4.0 — unreleased\n\n- hand-written\n\n## 0.3.1 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), [
    "### CX-1 · First · `done` (#60, #64)\n**Release:** 0.4.0\n**Changelog:** first change",
    "### CX-2 · Second · `done` (#58; note)\n**Release:** 0.4.0\n**Changelog:** second change",
    "### CX-3 · Dropped · `dropped`\n**Release:** 0.4.0",
  ].join("\n\n") + "\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/actions/runs?head_sha=abcdef&per_page=100") printf 'merge-ready\\tissue_comment\\tmain\\tcompleted\\tfailure\\nCI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm: npmOwner,
  });
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## 0\.4\.0 — YYYY-MM-DD\n\n- CX-1 \(#60, #64\): first change\n- CX-2 \(#58\): second change/);
  assert.doesNotMatch(result.stdout, /CX-3/);
});

test("release 0.4.0 replaces a hand-written unreleased section", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\n## 0.4.0 — unreleased\n\n- hand-written\n\n## 0.3.1 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** generated\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/actions/runs?head_sha=abcdef&per_page=100") printf 'merge-ready\\tissue_comment\\tmain\\tcompleted\\tfailure\\nCI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm: npmOwner,
  });
  const result = run("release.mjs", ["0.4.0"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /## 0\.4\.0 — \d{4}-\d{2}-\d{2}\n\n- CX-1 \(#12\): generated/);
  assert.doesNotMatch(changelog, /hand-written/);
  assert.match(changelog, /- CX-1 \(#12\): generated\n\n## 0\.3\.1 — unreleased/);
});

test("release 0.4.0 inserts a generated section below the changelog intro", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "# Changelog\n\nIntro.\n\n## 0.3.1 — 2026-10-20\n\n- previous\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** generated\n");
  const path = fakeCommands(root, {
    git: `case "$1 $2" in
      "worktree list") printf 'worktree ${root}\\nbranch refs/heads/main\\n\\n' ;;
      "branch --show-current") printf main ;;
      "status --porcelain") ;;
      "rev-parse HEAD"|"rev-parse origin/main") printf abcdef ;;
    esac`,
    gh: `case "$1 $2" in
      "repo view") printf owner/repo ;;
      "api repos/owner/repo/actions/runs?head_sha=abcdef&per_page=100") printf 'merge-ready\\tissue_comment\\tmain\\tcompleted\\tfailure\\nCI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm: npmOwner,
  });
  const result = run("release.mjs", ["0.4.0"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /^# Changelog\n\nIntro\.\n\n## 0\.4\.0 — \d{4}-\d{2}-\d{2}/);
  assert.match(changelog, /- CX-1 \(#12\): generated\n\n## 0\.3\.1 — 2026-10-20/);
});

test("release 0.4.0 refuses missing task-row changelog data and invalid done suffixes", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = releaseDryRun(root);
  writeFileSync(join(root, "build/TASKS.md"), [
    "### CX-1 · One · `done` (#12)\n**Release:** 0.4.0",
    "### CX-2 · Two · `done` (#12)\n**Release:** 0.4.0\n**Changelog:**   ",
    "### CX-3 · Three · `done`\n**Release:** 0.4.0\n**Changelog:** Three",
    "### CX-4 · Four · `done` (PR #12)\n**Release:** 0.4.0\n**Changelog:** Four",
  ].join("\n\n") + "\n");
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 1);
  for (const message of ["CX-1 has no **Changelog:** line", "CX-2 has an empty **Changelog:** line", "CX-3 has an invalid done suffix", "CX-4 has an invalid done suffix"]) {
    assert.ok(result.stderr.includes(message), `${message}: ${result.stderr}`);
  }
});

test("release refuses a version no task row has, dry run or not, before any change (#250)", (t) => {
  // No row for 0.4.1 at all, on a dry run; only a dropped one, on a real run.
  for (const [tasks, dryRun] of [
    [undefined, true],
    ["### CX-1 · One · `done` (#12)\n**Release:** 0.4.0\n**Changelog:** One\n\n### CX-2 · Two · `dropped`\n**Release:** 0.4.1\n**Changelog:** Two\n", false],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = releaseDryRun(root);
    if (tasks !== undefined) writeFileSync(join(root, "build/TASKS.md"), tasks);
    const result = run("release.mjs", ["0.4.1", ...(dryRun ? ["--dry-run"] : [])], { root, env: { PATH: path } });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("no task has **Release:** 0.4.1; merge its PR first"), result.stderr);
    assert.equal(readFileSync(join(root, "package.json"), "utf8"), '{"name":"fixture","version":"0.0.0"}\n');
  }
});

test("a prerelease counts the task rows of its release (#250)", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const path = releaseDryRun(root);
  const result = run("release.mjs", ["0.4.0-rc.1", "--dry-run"], { root, env: { PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Would release 0\.4\.0-rc\.1 to npm@next/);
});

test("usage refuses an invalid version, an unknown flag and an --allow-partial without a reason", (t) => {
  for (const args of [["not-a-version"], ["0.4.0", "--force"], ["0.4.0", "--allow-partial"], ["0.4.0", "--allow-partial", "  "], ["0.4.0", "--dry-run", "--dry-run"]]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = run("release.mjs", args, { root });
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr, /Usage: node scripts\/release\.mjs <version> \[--dry-run\] \[--allow-partial "<reason>"\]/);
  }
});

test("release pushes its annotated tag through --follow-tags", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "## 1.2.3 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#1)\n**Release:** 1.2.3\n**Changelog:** One\n");
  writePackage(root, VENDORED);
  const path = fakeCommands(root, {
    gh: `case "$1" in
      repo) printf ${PRODUCT} ;;
      api) printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm: npmOwner,
  });
  command(root, ["init", "-b", "main"]);
  command(root, ["config", "user.email", "tests@example.test"]);
  command(root, ["config", "user.name", "Tests"]);
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "fixture"]);
  const origin = `${root}-origin.git`;
  t.after(() => rmSync(origin, { recursive: true, force: true }));
  execFileSync("git", ["init", "--bare", origin]);
  command(root, ["remote", "add", "origin", origin]);
  command(root, ["push", "-u", "origin", "main"]);
  const { env } = await integrationMock(t);
  const result = await runAsync("release.mjs", ["1.2.3"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(command(root, ["ls-remote", "--tags", "origin"]), /refs\/tags\/v1\.2\.3$/m);
  assert.equal(command(root, ["cat-file", "-t", "v1.2.3"]).trim(), "tag");
  assert.match(readFileSync(join(root, "CHANGELOG.md"), "utf8"), new RegExp(`- CX-1 \\(#1\\): One\n\nSkills: ultimate-brain-skills 1\\.0\\.0 \\(${PACKAGE_INTEGRITY}\\)\n`));
});

test("a failed publish keeps the commit and tag local and says how to finish", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "CHANGELOG.md"), "## 1.2.3 — unreleased\n");
  writeFileSync(join(root, "build/TASKS.md"), "### CX-1 · One · `done` (#1)\n**Release:** 1.2.3\n**Changelog:** One\n");
  writePackage(root, VENDORED);
  const path = fakeCommands(root, {
    gh: `case "$1" in
      repo) printf ${PRODUCT} ;;
      api) printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n' ;;
    esac`,
    npm: 'case "$1" in whoami) printf tester ;; owner) printf "tester <t@example.test>\\n" ;; publish) echo "npm error code E404" >&2; exit 1 ;; esac',
  });
  command(root, ["init", "-b", "main"]);
  command(root, ["config", "user.email", "tests@example.test"]);
  command(root, ["config", "user.name", "Tests"]);
  command(root, ["add", "."]);
  command(root, ["commit", "-m", "fixture"]);
  const origin = `${root}-origin.git`;
  t.after(() => rmSync(origin, { recursive: true, force: true }));
  execFileSync("git", ["init", "--bare", origin]);
  command(root, ["remote", "add", "origin", origin]);
  command(root, ["push", "-u", "origin", "main"]);
  const { env } = await integrationMock(t);
  const result = await runAsync("release.mjs", ["1.2.3"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm publish failed\. The commit 1\.2\.3 and the tag v1\.2\.3 exist only here/);
  assert.match(result.stderr, /npm publish && UB_RELEASE=1 git push --follow-tags/);
  assert.equal(command(root, ["cat-file", "-t", "v1.2.3"]).trim(), "tag");
  assert.doesNotMatch(command(root, ["ls-remote", "--tags", "origin"]), /v1\.2\.3/);
});

test("release refuses a version already tagged here, on origin or on npm, before any change", (t) => {
  for (const [setup, message] of [
    [(root) => command(root, ["tag", "v1.2.3"]), /tag v1\.2\.3 already exists here/],
    [(root) => { command(root, ["tag", "v1.2.3"]); command(root, ["push", "-q", "origin", "v1.2.3"]); command(root, ["tag", "-d", "v1.2.3"]); }, /tag v1\.2\.3 already exists on origin/],
    [() => {}, /fixture@1\.2\.3 is already on npm/],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const onNpm = message.source.includes("npm");
    const { path } = releaseRepository(t, root, `case "$1" in whoami) printf tester ;; owner) printf "tester <t@example.test>\\n" ;; view) ${onNpm ? "printf 1.2.3" : "exit 1"} ;; esac`);
    setup(root);
    const result = run("release.mjs", ["1.2.3"], { root, env: { PATH: path } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.equal(command(root, ["log", "-1", "--format=%s"]).trim(), "fixture");
    assert.equal(readFileSync(join(root, "package.json"), "utf8"), '{"name":"fixture","version":"0.0.0"}\n');
  }
});

test("a push that fails after the publish says the package is out and how to push", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { path, origin } = releaseRepository(t, root, npmOwner);
  writeFileSync(join(origin, "hooks", "pre-receive"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(origin, "hooks", "pre-receive"), 0o755);
  const { env } = await integrationMock(t);
  const result = await runAsync("release.mjs", ["1.2.3"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /1\.2\.3 is published on npm, but the push failed\. .*UB_RELEASE=1 git push --follow-tags/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("release refuses a version below package.json's, except a prerelease of that version (skills-delivery §9.4)", async (t) => {
  for (const [version, refused] of [["0.9.1", true], ["0.9.2-rc.1", false]]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root, version);
    writeFileSync(join(root, "package.json"), '{"name":"fixture","version":"0.9.2"}\n');
    const { env } = await integrationMock(t);
    const result = await runAsync("release.mjs", [version, "--dry-run"], { root, env: { ...env, PATH: path } });
    if (refused) {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Release refused: package\.json is already 0\.9\.2; release 0\.9\.2 or later/);
    } else assert.equal(result.status, 0, `${version}: ${result.stderr}`);
  }
});

test("release refuses a version below a done task of a later, unreleased release on main, unless --allow-partial (F-0001)", async (t) => {
  const later = "\n### CC-2 · Two · `done` (#13)\n**Release:** 0.10.0\n**Changelog:** Two\n";
  for (const [extra, changelog, args, refused] of [
    [later, "# Changelog\n", [], true],
    [later, "# Changelog\n", ["--allow-partial", "a brain needs the fix today"], false],
    [later, "# Changelog\n", ["--allow-partial=a brain needs the fix today"], false],
    [later.replace("Two\n", "development only: plans 0.10.0\n"), "# Changelog\n", [], false],
    [later, "# Changelog\n\n## 0.10.0 — 2026-11-07\n\n- CC-2 (#13): Two\n", [], false],
    [later, "# Changelog\n\n## 0.10.0 — unreleased\n", [], true],
    [later.replace("`done` (#13)", "`review`"), "# Changelog\n", [], false],
  ]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const path = gateDryRun(root, "0.9.3");
    writeFileSync(join(root, "build/TASKS.md"), readFileSync(join(root, "build/TASKS.md"), "utf8") + extra);
    writeFileSync(join(root, "CHANGELOG.md"), changelog);
    const { env } = await integrationMock(t);
    const result = await runAsync("release.mjs", ["0.9.3", "--dry-run", ...args], { root, env: { ...env, PATH: path } });
    const label = `${extra.split("\n")[1]} | ${changelog.split("\n")[2] ?? ""} | ${args.join(" ")}`;
    if (refused) {
      assert.equal(result.status, 1, label);
      assert.ok(result.stderr.includes('done tasks of a later release are on main: CC-2 (0.10.0); release 0.10.0 or later, or pass --allow-partial "<reason>"'), `${label}: ${result.stderr}`);
    } else assert.equal(result.status, 0, `${label}: ${result.stderr}`);
    if (args.length > 0) assert.match(result.stdout, /Would release 0\.9\.3, partial \(CC-2 \(0\.10\.0\) stays out\): a brain needs the fix today/);
  }
});

test("a partial release writes its reason and what it leaves out into the release commit (F-0001)", async (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { path } = releaseRepository(t, root, npmOwner, "\n### CC-2 · Two · `done` (#13)\n**Release:** 1.3.0\n**Changelog:** Two\n");
  const { env } = await integrationMock(t);
  const result = await runAsync("release.mjs", ["1.2.3", "--allow-partial", "a brain needs the fix today"], { root, env: { ...env, PATH: path } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(command(root, ["log", "-1", "--format=%B"]).trim(), "1.2.3\n\nPartial release: a brain needs the fix today\nOn main and not in it: CC-2 (1.3.0)");
  assert.doesNotMatch(readFileSync(join(root, "CHANGELOG.md"), "utf8"), /CC-2/);
});

test("releasing the version package.json already holds runs npm version with --allow-same-version (skills-delivery §9.4)", async (t) => {
  for (const [held, expected] of [["1.2.3", "version 1.2.3 --no-git-tag-version --allow-same-version"], ["0.0.0", "version 1.2.3 --no-git-tag-version"]]) {
    const root = temporaryRoot();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    writeFileSync(join(root, "package.json"), `{"name":"fixture","version":"${held}"}\n`);
    const log = join(root, "npm.log");
    const { path } = releaseRepository(t, root, `printf '%s\\n' "$*" >> ${log}; case "$1" in whoami) printf tester ;; owner) printf "tester <t@example.test>\\n" ;; view) exit 1 ;; esac`);
    const { env } = await integrationMock(t);
    const result = await runAsync("release.mjs", ["1.2.3"], { root, env: { ...env, PATH: path } });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(readFileSync(log, "utf8").split("\n").includes(expected), readFileSync(log, "utf8"));
  }
});

test("release retries a CI read that failed once", (t) => {
  const root = temporaryRoot();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const count = join(root, "ci-count");
  const ci = `n=$(cat '${count}' 2>/dev/null || echo 0); echo $((n + 1)) > '${count}'; if [ "$n" -lt 1 ]; then echo "HTTP 502" >&2; exit 1; else printf 'CI\\tpush\\tmain\\tcompleted\\tsuccess\\n'; fi`;
  const result = run("release.mjs", ["0.4.0", "--dry-run"], { root, env: { PATH: releaseDryRun(root, { ci }), UB_CI_POLL_MS: "1" } });
  assert.equal(result.status, 0, result.stderr);
});
