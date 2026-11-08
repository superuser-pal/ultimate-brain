import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { scanNotes } from "../lib/notes.ts";
import { reflectCandidates } from "../lib/reflect.ts";
import { requireSuppressions } from "../lib/suppressions.ts";

/** `brain reflect --candidates` (spec/cli.md §5.32). */
export const reflectCommand: Command = {
  name: "reflect",
  usage: "brain reflect --candidates [--limit <n>] [--offset <n>] [--json]",
  summary: "Return clusters of notes that may disagree, be stale or duplicated, and recurring terms, for the brain-reflect skill.",
  options: { candidates: "boolean", limit: "string", offset: "string" },
  // A bare `brain reflect` is refused below with the skill's name, before any extra argument (§5.32).
  needsBrain: true,
  async run({ args, brain, now }) {
    if (args.options.candidates !== true) throw new BrainError("USAGE", "brain reflect requires --candidates; use the brain-reflect skill to tidy the brain");
    if (args.positionals.length > 0) throw new BrainError("USAGE", `Unexpected argument: ${args.positionals[0]}`);
    const limit = integer(args.options.limit as string | undefined, 30, 1, 100, "--limit must be an integer from 1 to 100");
    const offset = integer(args.options.offset as string | undefined, 0, 0, Number.MAX_SAFE_INTEGER, "--offset must be an integer of at least 0");
    const scanned = await scanNotes(brain!.root);
    const data = reflectCandidates(scanned.notes, requireSuppressions(brain!.root), now, limit, offset);
    return {
      data,
      warnings: scanned.problems.map((problem) => ({ code: problem.code, message: `${problem.path}: ${problem.message}`, path: problem.path })),
      human: `${data.total} cluster${data.total === 1 ? "" : "s"}${data.held === 0 ? "" : `, ${data.held} held`}.\n`,
    };
  },
};

function integer(value: string | undefined, fallback: number, min: number, max: number, message: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new BrainError("USAGE", message);
  return Number(value);
}
