import type { Warning } from "./command.ts";
import type { Issue } from "./lint.ts";

/** Convert staged lint issues to the warning envelope used by writing commands. */
export function lintWarnings(issues: readonly Issue[]): Warning[] {
  return issues.map((issue) => ({
    code: issue.rule.toUpperCase().replaceAll("-", "_"),
    message: `${issue.path}:${issue.line} ${issue.message}`,
    path: issue.path,
    ...(issue.id === null ? {} : { id: issue.id }),
  }));
}
