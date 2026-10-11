#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const HELP_TEXT = `Usage: brain <command> [options]

Operate an Ultimate Brain repository.

Options:
  -h, --help  Show this help message

Commands:
  help        Show this help message
`;

export interface OutputWriter {
  write(value: string): unknown;
}

export interface CliIo {
  stdout: OutputWriter;
  stderr: OutputWriter;
}

export type CommandHandler = (args: readonly string[], io: CliIo) => number | Promise<number>;

export interface CliOptions {
  commands?: ReadonlyMap<string, CommandHandler>;
  io?: CliIo;
}

const defaultIo: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
};

export async function runCli(
  args: readonly string[],
  options: CliOptions = {},
): Promise<number> {
  const io = options.io ?? defaultIo;
  const [command, ...commandArgs] = args;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    io.stdout.write(HELP_TEXT);
    return 0;
  }

  const handler = options.commands?.get(command);
  if (handler === undefined) {
    io.stderr.write(`Unknown command: ${command}\nRun "brain --help" for usage.\n`);
    return 1;
  }

  return handler(commandArgs, io);
}

const entryPoint = process.argv[1];

if (entryPoint !== undefined && pathToFileURL(entryPoint).href === import.meta.url) {
  process.exitCode = await runCli(process.argv.slice(2));
}
