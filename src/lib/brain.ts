import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveBrainDirectory, type ResolveBrainDirectoryOptions } from "./brain-path.ts";
import { BrainError } from "./errors.ts";

export interface Brain {
  /** Absolute, symlink-resolved brain root. */
  root: string;
  config: Record<string, unknown>;
}

/**
 * Resolve the brain (spec/cli.md §4) and read its `brain.json`.
 * Full JSON Schema validation of `brain.json` arrives with the validator in CX-05;
 * until then only presence, JSON syntax and `schema_version` are checked.
 */
export async function openBrain(options: ResolveBrainDirectoryOptions = {}, allowInvalidConfig = false): Promise<Brain> {
  const root = await resolveBrainDirectory(options);
  const configPath = join(root, "brain.json");

  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    throw new BrainError("BRAIN_NOT_FOUND", `Not a brain: ${root} has no brain.json`);
  }

  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    if (allowInvalidConfig) return { root, config: {} };
    const detail = error instanceof Error ? error.message : String(error);
    throw new BrainError("BRAIN_CONFIG_INVALID", `brain.json is not valid JSON: ${detail}`);
  }
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new BrainError("BRAIN_CONFIG_INVALID", "brain.json must be a JSON object");
  }

  const version = (config as Record<string, unknown>).schema_version;
  if (version !== 1) {
    throw new BrainError(
      "SCHEMA_VERSION_UNSUPPORTED",
      `brain.json schema_version is ${JSON.stringify(version)}; this CLI supports 1`,
    );
  }

  return { root, config: config as Record<string, unknown> };
}
