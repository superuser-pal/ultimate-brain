#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { indexCommand } from "./commands/index.ts";
import { logCommand } from "./commands/log.ts";
import { runCommand, type CliIo, type Command, type RunEnvironment } from "./lib/command.ts";
import { exitCodeFor } from "./lib/errors.ts";

export type { CliIo, OutputWriter } from "./lib/command.ts";

export type CommandHandler = (args: readonly string[], io: CliIo) => number | Promise<number>;

/** Registered commands, in help order. */
export const COMMANDS: readonly Command[] = [indexCommand, logCommand];

export const HELP_TEXT = `Usage: brain <command> [options]

Operate an Ultimate Brain repository. Contract: spec/cli.md.

Global options:
  --brain <path>    Brain directory (else BRAIN_DIR, else ~/.config/ultimate-brain/config.json)
  --json            Print one JSON document on stdout
  --now <time>      Use this ISO 8601 UTC time as "now"
  -h, --help        Show help

Commands:
${COMMANDS.map((command) => `  ${command.name.padEnd(16)}${command.summary.split(". ")[0]!.replace(/\.$/, "")}`).join("\n")}
`;

export interface CliOptions extends RunEnvironment {
  /** Extra or replacement handlers, keyed by command path (tests). */
  commands?: ReadonlyMap<string, CommandHandler>;
  io?: CliIo;
}

const defaultIo: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
};

export async function runCli(args: readonly string[], options: CliOptions = {}): Promise<number> {
  const io = options.io ?? defaultIo;
  const [first] = args;

  if (first === undefined || first === "help" || first === "--help" || first === "-h") {
    io.stdout.write(HELP_TEXT);
    return 0;
  }

  const handlers = new Map<string, CommandHandler>();
  for (const command of COMMANDS) {
    handlers.set(command.name, (rest, commandIo) => runCommand(command, rest, commandIo, options));
  }
  for (const [name, handler] of options.commands ?? []) handlers.set(name, handler);

  // Longest command path first, so "note new" wins over "note".
  for (const words of [2, 1]) {
    const name = args.slice(0, words).join(" ");
    const handler = args.length >= words ? handlers.get(name) : undefined;
    if (handler !== undefined) return handler(args.slice(words), io);
  }

  const message = `Unknown command: ${first}`;
  if (args.includes("--json")) {
    io.stdout.write(`${JSON.stringify({ ok: false, command: first, brain: null, error: { code: "USAGE", message } })}\n`);
  } else {
    io.stderr.write(`${message}\nRun "brain --help" for usage.\n`);
  }
  return exitCodeFor("USAGE");
}

const entryPoint = process.argv[1];

if (entryPoint !== undefined && pathToFileURL(entryPoint).href === import.meta.url) {
  process.exitCode = await runCli(process.argv.slice(2));
}
