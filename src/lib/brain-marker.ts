import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BrainError } from "./errors.ts";
import { isRecord } from "./input.ts";

/**
 * The `.brain` marker `brain link` writes in a consuming repo (spec/cli.md §5.12 step 1, skills-delivery §6.2), read by `link`,
 * `query` (§5.13 step 4) and the repo health check. One validation for every reader (CC-152): a key this file doesn't list is a
 * malformed marker everywhere, so what `link` writes is always what `query` accepts.
 */
export const MARKER_FILE = ".brain";
export const MARKER_KEYS = ["repo", "project", "area", "stacks", "skills"] as const;
/** Skill names and stacks: lowercase kebab-case (§5.12). */
export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface MarkerSkills { name: string; version: string; integrity: string; names: string[] }
export interface RepoMarker {
  repo?: string;
  project?: string;
  area?: string;
  stacks?: string[];
  skills?: MarkerSkills;
}

export function isMarker(value: unknown): value is RepoMarker {
  if (!isRecord(value)) return false;
  if (!Object.keys(value).every((key) => (MARKER_KEYS as readonly string[]).includes(key))) return false;
  return (value.repo === undefined || typeof value.repo === "string")
    && (value.project === undefined || typeof value.project === "string")
    && (value.area === undefined || typeof value.area === "string")
    && (value.stacks === undefined || Array.isArray(value.stacks))
    && (value.skills === undefined || isMarkerSkills(value.skills));
}

/** `.brain` `skills` (skills-delivery §6.2); `names` must be skill names, since link removes the folders they name. */
export function isMarkerSkills(value: unknown): value is MarkerSkills {
  return isRecord(value)
    && typeof value.name === "string" && typeof value.version === "string" && typeof value.integrity === "string"
    && Array.isArray(value.names) && value.names.every((name) => typeof name === "string" && KEBAB.test(name));
}

export const MARKER_SHAPE = `must be an object with only ${MARKER_KEYS.join(", ")}`;

/**
 * Parse a marker's text. `where` names the file in messages (".brain", or ".brain in <folder>"); `code` is the caller's error
 * code: `INPUT_INVALID` for `link`, whose input it is, `USAGE` for `query`, where a bad marker is a bad `--repo`.
 */
export function parseMarker(raw: string, code: "INPUT_INVALID" | "USAGE", where: string): RepoMarker {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new BrainError(code, `${where} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isMarker(parsed)) throw new BrainError(code, `${where} ${MARKER_SHAPE}`);
  return parsed;
}

/** Read and parse `<root>/.brain`; `null` when the file can't be read (no marker). */
export async function readMarker(root: string, code: "INPUT_INVALID" | "USAGE", where: string): Promise<{ raw: string; value: RepoMarker } | null> {
  let raw: string;
  try {
    raw = await readFile(join(root, MARKER_FILE), "utf8");
  } catch {
    return null;
  }
  return { raw, value: parseMarker(raw, code, where) };
}
