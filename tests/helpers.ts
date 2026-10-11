import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";

import { runCli, type CliIo } from "../src/cli.ts";

export const FIXTURE_BRAIN = join(import.meta.dirname, "fixtures", "brain-acme");

/** Copy the fixture brain to a temp dir that is removed after the test. */
export async function fixtureCopy(context: TestContext): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "brain-test-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const brain = join(parent, "brain-acme");
  await cp(FIXTURE_BRAIN, brain, { recursive: true });
  return brain;
}

export interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
  /** Parsed stdout, for `--json` runs. */
  json: any;
}

/** Run the CLI in-process with captured output and an isolated environment. */
export async function brain(args: readonly string[], home = tmpdir()): Promise<CliRun> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = {
    stdout: { write: (value) => stdout.push(String(value)) },
    stderr: { write: (value) => stderr.push(String(value)) },
  };
  const code = await runCli(args, { io, env: {}, homeDirectory: home });
  const out = stdout.join("");
  let json: unknown;
  try {
    json = JSON.parse(out);
  } catch {
    json = undefined;
  }
  return { code, stdout: out, stderr: stderr.join(""), json };
}
