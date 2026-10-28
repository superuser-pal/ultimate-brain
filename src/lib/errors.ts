/** Error codes and exit codes from spec/cli.md §3.4–3.5. */
export const EXIT_CODES = {
  USAGE: 2,
  RETIRED: 2,
  BRAIN_NOT_CONFIGURED: 3,
  BRAIN_NOT_FOUND: 3,
  BRAIN_IS_PRODUCT_REPO: 3,
  BRAIN_CONFIG_INVALID: 3,
  SCHEMA_VERSION_UNSUPPORTED: 3,
  UNRELEASED_BUILD: 3,
  INPUT_UNREADABLE: 4,
  INPUT_INVALID: 4,
  UNKNOWN_ID: 4,
  ID_IN_USE: 4,
  BEFORE_MISMATCH: 4,
  REPO_NOT_FOUND: 4,
  REPO_IS_BRAIN: 4,
  REPO_COMMIT_UNKNOWN: 4,
  MODULE_OFF: 4,
  TARGET_NOT_EMPTY: 5,
  ALREADY_A_BRAIN: 5,
  OUTSIDE_ROOT: 5,
  BRAIN_DIRTY: 5,
  WRITE_CONFLICT: 5,
  INTERNAL: 10,
} as const;

export type ErrorCode = keyof typeof EXIT_CODES;

/** An expected failure with a contract error code; anything else is INTERNAL. */
export class BrainError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "BrainError";
    this.code = code;
    this.details = details;
  }
}

export function exitCodeFor(code: ErrorCode): number {
  return EXIT_CODES[code];
}
