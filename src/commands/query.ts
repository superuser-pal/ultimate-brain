import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { scanNotes, type Note } from "../lib/notes.ts";
import { readCaller, shownMemories } from "../lib/recall.ts";
import { answerNote, contextFor, requireSuppressions, viewDependencies, withheldView } from "../lib/suppressions.ts";
import { queryContext, queryTerms, queryTypes, readIds, readNotes, searchCandidates } from "../lib/query.ts";

/** `brain query --candidates <question>` and `brain query --read <id>[,<id>…]` (spec/cli.md §5.13, §5.13.1). Read-only. */
export const queryCommand: Command = {
  name: "query",
  usage: "brain query --candidates <question> [--limit <n>] [--types <t>[,<t>…]] [--repo <path>] | --read <id>[,<id>…] [--historical] [--repo <path>] [--json]",
  summary: "Return ranked note candidates for the brain-query skill, or the full text of notes as retrieval may use it.",
  options: { candidates: "string", read: "string", limit: "string", types: "string", repo: "string", historical: "boolean" },
  // A bare question is refused below with the skill's name, not as an unexpected argument (§5.13).
  needsBrain: true,
  async run({ args, brain }) {
    const question = args.options.candidates as string | undefined;
    const read = args.options.read as string | undefined;
    if (question === undefined && read === undefined) {
      throw new BrainError("USAGE", "brain query requires --candidates or --read; use the brain-query skill to answer questions");
    }
    if (question !== undefined && read !== undefined) throw new BrainError("USAGE", "brain query takes one of --candidates and --read");
    if (args.positionals.length > 0) throw new BrainError("USAGE", `Unexpected argument: ${args.positionals[0]}`);
    const foreign = read === undefined ? undefined : (["limit", "types"] as const).find((name) => args.options[name] !== undefined);
    if (foreign !== undefined) throw new BrainError("USAGE", `--${foreign} doesn't go with --read`);
    // The historical read is a full read only (eligibility.md §5): a search returns current memories.
    const historical = args.options.historical === true;
    if (historical && read === undefined) throw new BrainError("USAGE", "--historical doesn't go with --candidates");
    const limit = parseLimit(args.options.limit as string | undefined);
    const types = queryTypes(args.options.types as string | undefined);
    const ids = read === undefined ? [] : readIds(read);
    const repo = args.options.repo as string | undefined;
    const [context, scanned] = await Promise.all([queryContext(repo), scanNotes(brain!.root)]);
    const loaded = requireSuppressions(brain!.root);
    const eligibility = contextFor(scanned.notes, loaded);
    const warnings = scanned.problems.map((problem) => ({ code: problem.code, message: `${problem.path}: ${problem.message}`, path: problem.path }));
    // A memory is returned only as `brain recall` would return it to this folder (memory.md §2): approval and reach, besides the evidence rule.
    const memories = async (superseded: boolean): Promise<Map<string, Note>> => shownMemories(scanned.notes, loaded, (await readCaller(repo)).caller, superseded);
    // A view has no passage references: it is returned whole or withheld whole, judged with what it rests on to any depth, a memory as this
    // command would return it to the caller (§5.13.1, "Views"; eligibility.md §8). Any other note in its answer form (§5.13).
    const current = await memories(false);
    const dependencies = viewDependencies(scanned.notes, (path) => existsSync(join(brain!.root, path)), (note) => current.has(note.id));
    const viewWithheld = (note: Note) => withheldView(note, dependencies, eligibility);
    const eligibleOf = (note: Note): Note | null => note.type === "view" ? (viewWithheld(note) === null ? note : null) : answerNote(note, eligibility);

    if (read !== undefined) {
      // A superseded memory only in the explicit historical read (eligibility.md §5, 0077 §2).
      const notes = readNotes(scanned.notes, ids, eligibleOf, historical ? await memories(true) : current, viewWithheld);
      const withheld = notes.filter((note) => note.status === "withheld").length;
      return { data: { context, notes }, warnings, human: `${notes.length - withheld} read, ${withheld} withheld.\n` };
    }
    const shown = types.has("memory") ? current : new Map<string, Note>();
    const found = searchCandidates(scanned.notes, queryTerms(question!), types, context,
      (note) => note.type === "memory" ? shown.get(note.id) ?? null : eligibleOf(note));
    const candidates = found.candidates.slice(0, limit);

    return {
      data: { query: question, tokens: queryTerms(question!), context, candidates, ...(found.unresolved === null ? {} : { unresolved: found.unresolved }) },
      warnings,
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
