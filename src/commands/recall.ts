import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { scanNotes } from "../lib/notes.ts";
import { buildPack, readCaller, readWork, searchMemories } from "../lib/recall.ts";
import { requireSuppressions } from "../lib/suppressions.ts";

const PACK_ONLY = ["task", "budget"] as const;
const SEARCH_ONLY = ["limit", "include-superseded"] as const;

/** `brain recall --pack` and `brain recall --search` (spec/cli.md §5.33, spec/memory.md §5, §6.1). Read-only. */
export const recallCommand: Command = {
  name: "recall",
  usage: "brain recall --pack [--repo <path>] [--task <text>] [--budget <n>] | --search <query> [--repo <path>] [--limit <n>] [--include-superseded] [--json]",
  summary: "Return the opening context of approved memories and active work for a folder, or search its memories.",
  options: { pack: "boolean", search: "string", repo: "string", task: "string", budget: "string", limit: "string", "include-superseded": "boolean" },
  needsBrain: true,
  async run({ args, brain }) {
    const pack = args.options.pack === true;
    const query = args.options.search as string | undefined;
    if (pack === (query !== undefined)) throw new BrainError("USAGE", "brain recall takes exactly one of --pack and --search");
    if (args.positionals.length > 0) throw new BrainError("USAGE", `Unexpected argument: ${args.positionals[0]}`);
    const foreign = (pack ? SEARCH_ONLY : PACK_ONLY).find((name) => args.options[name] !== undefined);
    if (foreign !== undefined) throw new BrainError("USAGE", `--${foreign} doesn't go with ${pack ? "--pack" : "--search"}`);
    const budget = integer(args.options.budget as string | undefined, 800, 200, 4000, "--budget must be an integer from 200 to 4000");
    const limit = integer(args.options.limit as string | undefined, 10, 1, 50, "--limit must be an integer from 1 to 50");
    const { root, caller } = await readCaller(args.options.repo as string | undefined);
    const scanned = await scanNotes(brain!.root);
    const loaded = requireSuppressions(brain!.root);
    const warnings = scanned.problems.map((problem) => ({ code: problem.code, message: `${problem.path}: ${problem.message}`, path: problem.path }));

    if (pack) {
      const work = await readWork(root, scanned.notes, brain!.config);
      const task = args.options.task as string | undefined;
      const data = buildPack({ notes: scanned.notes, loaded, caller, work, budget, ...(task === undefined ? {} : { task }) });
      return { data, warnings, human: data.text === "" ? "Nothing to recall.\n" : `${data.text}\n` };
    }
    const data = searchMemories(scanned.notes, loaded, caller, query!, limit, args.options["include-superseded"] === true);
    return { data, warnings, human: `${data.results.length} result${data.results.length === 1 ? "" : "s"}.\n` };
  },
};

function integer(value: string | undefined, fallback: number, min: number, max: number, message: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new BrainError("USAGE", message);
  return Number(value);
}
