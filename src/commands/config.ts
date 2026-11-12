import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Command, Warning } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { atomicWriteFile } from "../lib/fs-safe.ts";
import { describeErrors, loadSchemas } from "../lib/schemas.ts";
import { assertPlainPath } from "../lib/skills.ts";
import { styleLines, withStyleBlock } from "../lib/style.ts";

/** `brain config get [<dot.path>]` (spec/cli.md §5.3). */
export const configGetCommand: Command = {
  name: "config get",
  usage: "brain config get [<dot.path>] [--json]",
  summary: "Read brain.json, or one value selected by a dot path.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain }) {
    const [path] = args.positionals;
    const value = path === undefined ? brain!.config : readPath(brain!.config, path);
    return { data: path === undefined ? value : { path, value }, human: `${JSON.stringify(value, null, 2)}\n` };
  },
};

/** `brain config set <dot.path> <json-value>` (spec/cli.md §5.3). */
export const configSetCommand: Command = {
  name: "config set",
  usage: "brain config set <dot.path> <json-value> [--json]",
  summary: "Set one brain.json value after validating the complete configuration.",
  options: {},
  maxPositionals: 2,
  needsBrain: true,
  async run({ args, brain }) {
    const [path, rawValue] = args.positionals;
    if (path === undefined || rawValue === undefined) {
      throw new BrainError("USAGE", "brain config set needs <dot.path> and <json-value>");
    }
    const segments = parsePath(path);
    if (segments.length === 1 && segments[0] === "schema_version") {
      throw new BrainError("INPUT_INVALID", "schema_version cannot be changed");
    }

    let value: unknown;
    try {
      value = JSON.parse(rawValue);
    } catch (error) {
      throw new BrainError("INPUT_INVALID", `Config value is not JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const next = structuredClone(brain!.config);
    const previous = setPath(next, segments, value);
    const schemas = loadSchemas();
    if (!schemas.brain(next)) {
      throw new BrainError("INPUT_INVALID", `brain.json would be invalid: ${describeErrors(schemas.brain.errors).join("; ")}`);
    }
    // A settings.style path also rewrites the brain's style block (spec/cli.md §5.3, §5.3.1); a symbolic AGENTS.md refuses before any write.
    const style = segments[0] === "settings" && (segments.length === 1 || segments[1] === "style");
    if (style) await assertPlainPath(brain!.root, "AGENTS.md");
    await atomicWriteFile(brain!.root, "brain.json", `${JSON.stringify(next, null, 2)}\n`);
    const warnings: Warning[] = [];
    const files = style ? [{ path: "AGENTS.md", action: await writeStyleBlock(brain!.root, next, warnings) }] : undefined;
    return {
      data: { path, previous: previous ?? null, value, ...(files === undefined ? {} : { files }) },
      warnings,
      human: `${path}: ${JSON.stringify(previous)} → ${JSON.stringify(value)}\n${files === undefined ? "" : `AGENTS.md: ${files[0]!.action}\n`}`,
    };
  },
};

/** Write, replace or remove the style block in the brain's AGENTS.md; `skipped` when the file or its markers can't take it. */
async function writeStyleBlock(root: string, config: Record<string, unknown>, warnings: Warning[]): Promise<string> {
  let text: string;
  try {
    text = await readFile(join(root, "AGENTS.md"), "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md is missing; brain.json was written. Run brain upgrade to restore it." });
    return "skipped";
  }
  const written = withStyleBlock(text, styleLines(config));
  if (written === undefined) {
    warnings.push({ code: "AGENTS_BLOCK_NOT_FOUND", message: "AGENTS.md's rules or style markers are missing, out of order or duplicated; brain.json was written, AGENTS.md left unchanged." });
    return "skipped";
  }
  if (written.action !== "unchanged") await atomicWriteFile(root, "AGENTS.md", written.text);
  return written.action;
}

function readPath(config: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = config;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      throw new BrainError("USAGE", `No configuration value at ${path}`);
    }
    current = current[segment];
  }
  return current;
}

function setPath(config: Record<string, unknown>, segments: readonly string[], value: unknown): unknown {
  let current = config;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (next === undefined) {
      const created: Record<string, unknown> = {};
      current[segment] = created;
      current = created;
    } else if (isRecord(next)) {
      current = next;
    } else {
      throw new BrainError("INPUT_INVALID", `Cannot create ${segments.join(".")}: ${segment} is not an object`);
    }
  }
  const final = segments[segments.length - 1]!;
  const previous = current[final];
  current[final] = value;
  return previous;
}

function parsePath(path: string): string[] {
  const segments = path.split(".");
  if (path === "" || segments.some((segment) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment))) {
    throw new BrainError("USAGE", `Invalid configuration path: ${path}`);
  }
  return segments;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
