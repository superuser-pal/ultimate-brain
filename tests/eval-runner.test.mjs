import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// eval/unattended-0.7.0/run.sh must never present a run that was cut short, or a collection with nothing to collect, as a
// reproduction (CC-64). These tests run its collect-only mode against hand-made earlier runs, with a stand-in `brain`.

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), "..", "eval", "unattended-0.7.0", "run.sh");

function git(cwd, ...args) {
  const run = spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=t@example.test", ...args], { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
}

/** A directory laid out as the runner leaves it after running the `noop` scenario, to be spoiled by each test. */
function earlierRun(context, { exit = "0", reply = "Nothing was waiting, so it stopped.\n", brainStatus = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "eval-runner-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const base = join(root, "eval");
  const out = join(root, "out");
  const brainDir = join(base, "noop");
  mkdirSync(brainDir, { recursive: true });
  git(brainDir, "init", "-q", "-b", "main");
  writeFileSync(join(brainDir, "brain.json"), "{}\n");
  git(brainDir, "add", "-A");
  git(brainDir, "commit", "-qm", "setup");
  writeFileSync(join(base, "noop.base"), `${git(brainDir, "rev-parse", "HEAD")}\n`);
  mkdirSync(join(base, "exit"), { recursive: true });
  if (exit !== null) writeFileSync(join(base, "exit", "noop"), `${exit}\n`);
  mkdirSync(join(out, "noop"), { recursive: true });
  if (reply !== null) writeFileSync(join(out, "noop", "reply.md"), reply);
  mkdirSync(join(base, "bin"), { recursive: true });
  const fake = join(base, "bin", "brain");
  writeFileSync(fake, brainStatus ? '#!/bin/sh\necho \'{"data":{"unattended":{"catch_up":null,"backlog":false}}}\'\n' : "#!/bin/sh\necho 'not a brain' >&2\nexit 3\n");
  chmodSync(fake, 0o755);
  return { base, out };
}

function collect({ base, out }) {
  const run = spawnSync("bash", [RUNNER, "noop"], { encoding: "utf8", env: { ...process.env, UB_EVAL_DIR: base, UB_EVAL_OUT: out, COLLECT_ONLY: "1" } });
  return { code: run.status, stdout: run.stdout, stderr: run.stderr };
}

test("a complete earlier run is collected and the runner exits 0", (context) => {
  const run = collect(earlierRun(context));
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /traces in /);
});

test("a collect-only run with no earlier run is incomplete and exits 1, not a success", (context) => {
  const root = mkdtempSync(join(tmpdir(), "eval-runner-empty-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const run = collect({ base: join(root, "missing"), out: join(root, "out") });
  assert.equal(run.code, 1, run.stdout);
  assert.match(run.stderr, /INCOMPLETE.*noop \(collection failed\)/);
  assert.doesNotMatch(run.stdout, /traces in /);
});

test("a nonzero claude exit, a limit message, a missing exit status and a missing reply are each incomplete", (context) => {
  const cases = [
    [{ exit: "1" }, /noop \(claude exit 1\)/],
    [{ reply: "You've hit your session limit · resets 6:40pm\n" }, /noop \(a limit was hit\)/],
    [{ exit: null }, /noop \(claude exit missing\)/],
    [{ reply: null }, /noop \(collection failed\)/],
  ];
  for (const [spoil, expected] of cases) {
    const run = collect(earlierRun(context, spoil));
    assert.equal(run.code, 1, JSON.stringify(spoil));
    assert.match(run.stderr, expected, JSON.stringify(spoil));
    assert.doesNotMatch(run.stdout, /traces in /);
  }
});

test("a failing `brain status` during collection is incomplete", (context) => {
  const run = collect(earlierRun(context, { brainStatus: false }));
  assert.equal(run.code, 1, run.stdout);
  assert.match(run.stderr, /noop \(collection failed\)/);
});
