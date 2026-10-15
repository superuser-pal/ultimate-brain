import { BrainError } from "./errors.ts";

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** Validate a UTC timestamp and return its seconds-precision form. */
export function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) return undefined;
  const parsed = new Date(value);
  const seconds = `${value.slice(0, 19)}Z`;
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== seconds.slice(0, 19) ? undefined : seconds;
}

/** The command clock: `--now` when given (ISO 8601 UTC), else the system clock. */
export function resolveNow(now: string | undefined): Date {
  if (now === undefined) return new Date();
  const parsed = new Date(now);
  // Reject impossible dates such as 2026-02-30, which Date would roll over into March.
  if (normalizeTimestamp(now) === undefined || Number.isNaN(parsed.getTime())) {
    throw new BrainError("USAGE", `--now must be an ISO 8601 UTC timestamp like 2026-12-03T10:22:00Z, got "${now}"`);
  }
  return parsed;
}

/** `2026-12-03T10:22:00Z` (seconds precision, as the schema's timestamps). */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** `2026-12-03` in UTC. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
