import { BrainError } from "./errors.ts";

export type OptionKind = "string" | "boolean" | "list";
export type OptionSpec = Readonly<Record<string, OptionKind>>;
export type OptionValues = Record<string, string | boolean | string[] | undefined>;

export interface ParsedArgs {
  options: OptionValues;
  positionals: string[];
}

/** Global options accepted by every command (spec/cli.md §3.1). */
export const GLOBAL_OPTIONS: OptionSpec = {
  brain: "string",
  json: "boolean",
  now: "string",
  help: "boolean",
};

/**
 * Parse `--name value`, `--name=value`, boolean flags and `-h` anywhere in argv.
 * Unknown options are a usage error; a repeated string option keeps the last value.
 */
export function parseArgs(argv: readonly string[], spec: OptionSpec): ParsedArgs {
  const all: OptionSpec = { ...GLOBAL_OPTIONS, ...spec };
  const options: OptionValues = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith("--") || arg === "-") {
      positionals.push(arg);
      continue;
    }

    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    const kind = all[name];
    if (kind === undefined) throw new BrainError("USAGE", `Unknown option: --${name}`);

    if (kind === "boolean") {
      if (equals !== -1) throw new BrainError("USAGE", `Option --${name} takes no value`);
      options[name] = true;
      continue;
    }

    let value: string | undefined;
    if (equals !== -1) {
      value = arg.slice(equals + 1);
    } else {
      value = argv[index + 1];
      index += 1;
    }
    if (value === undefined) throw new BrainError("USAGE", `Option --${name} needs a value`);

    if (kind === "list") {
      const existing = options[name];
      options[name] = [...(Array.isArray(existing) ? existing : []), value];
    } else {
      options[name] = value;
    }
  }

  return { options, positionals };
}
