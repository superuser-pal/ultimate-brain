import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { ErrorObject } from "ajv";

import type { InputProblem } from "./input.ts";
import { loadSchemas } from "./schemas.ts";

// The dismissal store `_assistant/dismissals.json` (spec/assistant.md §8): JSON, not a note, written only by `brain assistant dismiss`.

export const DISMISSALS_PATH = "_assistant/dismissals.json";
export const DISMISS_DAYS = 30;
export const DAY_MS = 86_400_000;

export interface Dismissal {
  key: string;
  reason: string;
  dismissed_at: string;
  until: string;
}

export interface DismissalStore {
  /** Whether the file exists. */
  exists: boolean;
  entries: Dismissal[];
  /** What makes the file unusable: unreadable JSON, a schema failure, a repeated key. Empty when it is fine or missing. */
  problems: string[];
}

/** Read the store; never throws on content problems (lint reports them, the commands refuse with DISMISSALS_UNREADABLE). */
export function readDismissals(root: string): DismissalStore {
  const path = join(root, DISMISSALS_PATH);
  if (!existsSync(path)) return { exists: false, entries: [], problems: [] };
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { exists: true, entries: [], problems: [`${DISMISSALS_PATH} isn't readable JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const validate = loadSchemas().assistant("dismissals");
  const problems = validate(value) ? [] : schemaProblems(validate.errors).map((problem) => `${DISMISSALS_PATH} ${problem.pointer || "/"}: ${problem.message}`);
  // A repeated key is its own problem, reported even beside schema failures (cli.md §5.10: one issue per problem).
  const listed = typeof value === "object" && value !== null && Array.isArray((value as { dismissals?: unknown }).dismissals) ? (value as { dismissals: unknown[] }).dismissals : [];
  const seen = new Set<string>();
  for (const entry of listed) {
    const key = typeof entry === "object" && entry !== null ? (entry as { key?: unknown }).key : undefined;
    if (typeof key !== "string") continue;
    if (seen.has(key)) problems.push(`${DISMISSALS_PATH} repeats the key ${key}`);
    seen.add(key);
  }
  return { exists: true, entries: problems.length === 0 ? (value as { dismissals: Dismissal[] }).dismissals : [], problems };
}

/** The file's bytes (assistant.md §8): 2-space indent, keys in order, entries sorted by key, one trailing newline. */
export function serializeDismissals(entries: readonly Dismissal[]): string {
  const sorted = [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const dismissals = sorted.map(({ key, reason, dismissed_at, until }) => ({ key, reason, dismissed_at, until }));
  return `${JSON.stringify({ version: 1, dismissals }, null, 2)}\n`;
}

/** Ajv errors as JSON Pointer problems (spec/cli.md §3.5 `INPUT_INVALID` details). Composition keywords are noise. */
export function schemaProblems(errors: readonly ErrorObject[] | null | undefined): InputProblem[] {
  const problems: InputProblem[] = [];
  const seen = new Set<string>();
  for (const error of errors ?? []) {
    if (["if", "anyOf", "allOf", "oneOf"].includes(error.keyword)) continue;
    let pointer = error.instancePath;
    let message = error.message ?? error.keyword;
    if (error.keyword === "required") { pointer = `${pointer}/${String(error.params.missingProperty)}`; message = "is required"; }
    else if (error.keyword === "additionalProperties") { pointer = `${pointer}/${String(error.params.additionalProperty)}`; message = "unknown key"; }
    else if (error.keyword === "not") message = "has a field it must not have here";
    const key = `${pointer}\u0000${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ pointer, message });
  }
  return problems;
}
