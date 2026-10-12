import { applyAll, parseApplyInput } from "../lib/apply.ts";
import type { Command } from "../lib/command.ts";
import { readJsonInput } from "../lib/input.ts";
import { Workspace } from "../lib/workspace.ts";

/** `brain apply [--input <file|->] [--record-only] [--dry-run]` (spec/cli.md §5.7). */
export const applyCommand: Command = {
  name: "apply",
  usage: "brain apply [--input <file|->] [--record-only] [--dry-run] [--json]",
  summary: "Apply decided proposals and Notion corrections. Atomic per item; exits 1 if any item failed.",
  options: { input: "string", "record-only": "boolean", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const path = args.options.input as string | undefined;
    const input = path === undefined ? { corrections: [], decisions: null } : parseApplyInput(await readJsonInput(path, "apply"));
    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const result = applyAll(workspace, input, { now, recordOnly: args.options["record-only"] === true });
    const warnings = workspace.warnings().map((issue) => ({
      code: issue.rule.toUpperCase().replaceAll("-", "_"),
      message: `${issue.path}:${issue.line} ${issue.message}`,
      path: issue.path,
      ...(issue.id === null ? {} : { id: issue.id }),
    }));

    if (!dryRun) {
      await workspace.commit(result.log, now);
    }
    const lines = [
      ...result.corrections.map((item) => `${item.result} correction ${item.target} ${item.field}${item.reason === undefined ? "" : ` (${item.reason})`}`),
      ...result.decisions.map((item) => `${item.result} ${item.proposal} ${item.action}${item.reason === undefined ? "" : ` (${item.reason})`}`),
    ];
    return {
      data: { dry_run: dryRun, corrections: result.corrections, decisions: result.decisions, summary: result.summary },
      warnings,
      exitCode: result.summary.failed > 0 ? 1 : 0,
      human: lines.length === 0 ? "Nothing to apply.\n" : `${lines.join("\n")}\n`,
    };
  },
};
