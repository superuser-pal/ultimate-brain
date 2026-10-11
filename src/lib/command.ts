import { parseArgs, type OptionSpec, type ParsedArgs } from "./args.ts";
import { openBrain, type Brain } from "./brain.ts";
import { BrainError, exitCodeFor } from "./errors.ts";
import { resolveNow } from "./time.ts";

export interface OutputWriter {
  write(value: string): unknown;
}

export interface CliIo {
  stdout: OutputWriter;
  stderr: OutputWriter;
}

export interface Warning {
  code: string;
  message: string;
  path?: string;
  id?: string;
}

export interface CommandContext {
  args: ParsedArgs;
  /** Resolved brain; null for commands with `needsBrain: false`. */
  brain: Brain | null;
  now: Date;
}

export interface CommandResult {
  data: unknown;
  warnings?: Warning[];
  /** 1 when the command completed with findings (spec/cli.md §3.4). */
  exitCode?: 0 | 1;
  /** Text printed without `--json`; not part of the contract. */
  human?: string;
}

export interface Command {
  /** Command path, e.g. "index" or "note new". */
  name: string;
  usage: string;
  summary: string;
  options: OptionSpec;
  /** Most positional arguments accepted (default: unlimited). */
  maxPositionals?: number;
  needsBrain: boolean;
  run(context: CommandContext): Promise<CommandResult>;
}

export interface RunEnvironment {
  env?: NodeJS.ProcessEnv;
  homeDirectory?: string;
}

/** Run one command and print its result or error (spec/cli.md §3.3). Returns the exit code. */
export async function runCommand(
  command: Command,
  argv: readonly string[],
  io: CliIo,
  environment: RunEnvironment = {},
): Promise<number> {
  const separator = argv.indexOf("--");
  const json = (separator === -1 ? argv : argv.slice(0, separator)).includes("--json");
  let brainRoot: string | null = null;

  try {
    const args = parseArgs(argv, command.options);
    if (command.maxPositionals !== undefined && args.positionals.length > command.maxPositionals) {
      throw new BrainError("USAGE", `Unexpected argument: ${args.positionals[command.maxPositionals]}`);
    }
    if (args.options.help === true) {
      io.stdout.write(`Usage: ${command.usage}\n\n${command.summary}\n`);
      return 0;
    }
    const now = resolveNow(args.options.now as string | undefined);
    let brain: Brain | null = null;
    if (command.needsBrain) {
      brain = await openBrain({
        brainFlag: args.options.brain as string | undefined,
        env: environment.env,
        homeDirectory: environment.homeDirectory,
      });
      brainRoot = brain.root;
    }

    const result = await command.run({ args, brain, now });
    const warnings = result.warnings ?? [];
    if (json) {
      writeJson(io, { ok: true, command: command.name, brain: brainRoot, data: result.data, warnings });
    } else {
      io.stdout.write(result.human ?? `${JSON.stringify(result.data, null, 2)}\n`);
      for (const warning of warnings) io.stderr.write(`warning: ${warning.message}\n`);
    }
    return result.exitCode ?? 0;
  } catch (error) {
    const known = error instanceof BrainError;
    const code = known ? error.code : "INTERNAL";
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      const body: Record<string, unknown> = { code, message };
      if (known && error.details !== undefined) body.details = error.details;
      writeJson(io, { ok: false, command: command.name, brain: brainRoot, error: body, warnings: [] });
    } else {
      io.stderr.write(`error: ${message}\n`);
    }
    if (!known && error instanceof Error && error.stack !== undefined) io.stderr.write(`${error.stack}\n`);
    return exitCodeFor(code);
  }
}

function writeJson(io: CliIo, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value)}\n`);
}
