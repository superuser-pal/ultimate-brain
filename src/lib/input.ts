import { readFile } from "node:fs/promises";

import { BrainError } from "./errors.ts";

export interface InputProblem {
  /** JSON Pointer into the input. */
  pointer: string;
  message: string;
}

/** Read the JSON input of `--input <path|->` (spec/cli.md §3.2). */
export async function readJsonInput(path: string | undefined, command: string): Promise<unknown> {
  if (path === undefined) throw new BrainError("USAGE", `brain ${command} needs --input <file|->`);
  let text: string;
  try {
    text = path === "-" ? await readStdin() : await readFile(path, "utf8");
  } catch (error) {
    throw new BrainError("INPUT_UNREADABLE", `Cannot read input ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text.startsWith("﻿") ? text.slice(1) : text);
  } catch (error) {
    throw new BrainError("INPUT_UNREADABLE", `Input is not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Throw INPUT_INVALID listing every problem, when there are any. */
export function assertNoProblems(problems: readonly InputProblem[]): void {
  if (problems.length === 0) return;
  const count = problems.length === 1 ? "1 problem" : `${problems.length} problems`;
  throw new BrainError("INPUT_INVALID", `${count} in input: ${problems[0]!.pointer} ${problems[0]!.message}`, problems);
}

/** Problems for keys of `value` outside `allowed` (unknown keys are errors, §3.2). */
export function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], pointer: string): InputProblem[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => ({ pointer: `${pointer}/${escapePointer(key)}`, message: "unknown key" }));
}

export function escapePointer(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
