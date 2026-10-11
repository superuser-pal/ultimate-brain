import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

  assert.equal(exitCode, 1);
  assert.deepEqual(output.stdout, []);
  assert.match(output.stderr.join(""), /Unknown command: missing/);
});
