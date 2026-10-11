import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { scanNotes } from "../lib/notes.ts";
import { queryContext, queryTypes, queryWords, rankCandidates } from "../lib/query.ts";

/** `brain query --candidates <question>` (spec/cli.md §5.13). */
export const queryCommand: Command = {
  name: "query",
  usage: "brain query --candidates <question> [--limit <n>] [--types <t>[,<t>…]] [--repo <path>] [--json]",
  summary: "Return ranked note candidates for the brain-query skill.",
  options: { candidates: "string", limit: "string", types: "string", repo: "string" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    const question = args.options.candidates as string | undefined;
    if (question === undefined) {
      throw new BrainError("USAGE", "brain query requires --candidates; use the brain-query skill to answer questions");
    }
    const limit = parseLimit(args.options.limit as string | undefined);
    const tokens = queryWords(question);
    const [context, scanned] = await Promise.all([
      queryContext(args.options.repo as string | undefined),
      scanNotes(brain!.root),
    ]);
    const candidates = rankCandidates(scanned.notes, tokens, queryTypes(args.options.types as string | undefined), context).slice(0, limit);

    return {
      data: { query: question, tokens, context, candidates },
      warnings: scanned.problems.map((problem) => ({ code: problem.code, message: `${problem.path}: ${problem.message}`, path: problem.path })),
      human: `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}.\n`,
    };
  },
};

function parseLimit(value: string | undefined): number {
  if (value === undefined) return 10;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 50) {
    throw new BrainError("USAGE", "--limit must be an integer from 1 to 50");
  }
  return Number(value);
}
