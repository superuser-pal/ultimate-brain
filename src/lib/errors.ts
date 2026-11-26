/** Error codes and exit codes from spec/cli.md §3.4–3.5. */
export const EXIT_CODES = {
  USAGE: 2,
  RETIRED: 2,
  BRAIN_NOT_CONFIGURED: 3,
  BRAIN_NOT_FOUND: 3,
  BRAIN_IS_PRODUCT_REPO: 3,
  GIT_IDENTITY_MISSING: 3,
  BRAIN_CONFIG_INVALID: 3,
  SCHEMA_VERSION_UNSUPPORTED: 3,
  UNRELEASED_BUILD: 3,
  AGENT_NOT_FOUND: 3,
  BRAIN_NOT_GIT: 3,
  SKILL_MISSING: 3,
  SKILLS_PIN_INVALID: 3,
  SKILLS_INCOMPATIBLE: 3,
  SKILLS_SNAPSHOT_MISSING: 3,
  SKILLS_SNAPSHOT_INVALID: 3,
  INPUT_UNREADABLE: 4,
  INPUT_INVALID: 4,
  UNKNOWN_ID: 4,
  ID_IN_USE: 4,
  BEFORE_MISMATCH: 4,
  REPO_NOT_FOUND: 4,
  REPO_IS_BRAIN: 4,
  INSTRUCTIONS_SYMLINK: 4,
  REPO_COMMIT_UNKNOWN: 4,
  MODULE_OFF: 4,
  KIT_MISSING: 4,
  KIT_INVALID: 4,
  KIT_EXISTS: 4,
  KIT_CHANGED: 4,
  NO_KIT: 4,
  MODE_CONNECTED: 4,
  NO_TASKS: 4,
  CONFIRMATION_REQUIRED: 4,
  CONFIRMATION_MISMATCH: 4,
  STALE_RECORD: 4,
  CLAIMED: 4,
  NOT_APPROVED: 4,
  DESTINATION_TAKEN: 4,
  POINTER_EXISTS: 4,
  WORKFLOW_NOT_FOUND: 4,
  WORKFLOW_ENDED: 4,
  REVIEW_RETIRED: 4,
  QUESTIONS_RETIRED: 4,
  FILE_ALREADY_A_ROW: 4,
  FACTORY_NOT_FOUND: 4,
  FACTORY_EXISTS: 4,
  TASK_TAKEN: 4,
  TARGET_NOT_EMPTY: 5,
  ALREADY_A_BRAIN: 5,
  OUTSIDE_ROOT: 5,
  BRAIN_DIRTY: 5,
  GIT_OPERATION_IN_PROGRESS: 5,
  BRAIN_CHANGED: 5,
  UPGRADE_NOT_COMMITTED: 5,
  WRITE_CONFLICT: 5,
  RECOVERY_NEEDED: 5,
  DIRTY_TREE: 5,
  SUPPRESSIONS_UNREADABLE: 5,
  DISMISSALS_UNREADABLE: 5,
  WEEKLY_STATE_UNREADABLE: 5,
  CLEANUP_OFF: 4,
  NOT_A_CLEANUP: 4,
  ALREADY_UNDONE: 4,
  UNDO_STALE: 5,
  WEEKLY_TOO_LONG: 4,
  SCHEDULE_NOT_SET: 4,
  SKILLS_DOWNGRADE: 5,
  BRAIN_BUSY: 5,
  INTERNAL: 10,
} as const;

export type ErrorCode = keyof typeof EXIT_CODES;

/** An expected failure with a contract error code; anything else is INTERNAL. */
export class BrainError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;
  /** The human output, when it says more than `message` (its first line): `brain upgrade`'s list of conflicts (spec/cli.md §5.15). */
  readonly human: string | undefined;

  constructor(code: ErrorCode, message: string, details?: unknown, human?: string) {
    super(message);
    this.name = "BrainError";
    this.code = code;
    this.details = details;
    this.human = human;
  }
}

export function exitCodeFor(code: ErrorCode): number {
  return EXIT_CODES[code];
}
