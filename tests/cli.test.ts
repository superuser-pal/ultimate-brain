import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { HELP_TEXT, runCli, type CliIo } from "../src/cli.ts";

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stdout: {
        write: (value) => {
          stdout.push(String(value));
        },
      },
      stderr: {
        write: (value) => {
          stderr.push(String(value));
        },
      },
    },
    stdout,
    stderr,
  };
}

test("prints help from the executable entry point", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "src/cli.ts", "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, HELP_TEXT);
  assert.equal(result.stderr, "");
});

test("prints help when invoked through a symlinked bin", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "brain-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, "brain");
  await symlink(join(process.cwd(), "src", "cli.ts"), bin);
  const result = spawnSync(process.execPath, ["--experimental-strip-types", bin, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, HELP_TEXT);
});

test("routes a subcommand and its arguments", async () => {
  const output = captureIo();
  const commands = new Map([
    [
      "example",
      (args: readonly string[], io: CliIo) => {
        io.stdout.write(JSON.stringify(args));
        return 0;
      },
    ],
  ]);

  const exitCode = await runCli(["example", "--value", "one"], { commands, io: output.io });

  assert.equal(exitCode, 0);
  assert.deepEqual(output.stdout, ['["--value","one"]']);
  assert.deepEqual(output.stderr, []);
});

test("rejects an unknown subcommand", async () => {
  const output = captureIo();

  const exitCode = await runCli(["missing"], { io: output.io });

  assert.equal(exitCode, 2); // USAGE, spec/cli.md §3.4
  assert.deepEqual(output.stdout, []);
  assert.match(output.stderr.join(""), /Unknown command: missing/);
});

const VERSION = (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;

test("--version prints the package version outside any brain", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "brain-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: directory };
  delete env.BRAIN_DIR;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", join(process.cwd(), "src", "cli.ts"), "--version"], { cwd: directory, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${VERSION}\n`);
});

test("--version --json prints the success envelope", async () => {
  const output = captureIo();
  assert.equal(await runCli(["--version", "--json"], { io: output.io }), 0);
  assert.deepEqual(JSON.parse(output.stdout.join("")), { ok: true, command: "version", brain: null, data: { version: VERSION }, warnings: [] });
});

test("--version after a command ignores the command", async () => {
  const output = captureIo();
  assert.equal(await runCli(["status", "--version"], { io: output.io }), 0);
  assert.deepEqual(output.stdout, [`${VERSION}\n`]);
});
