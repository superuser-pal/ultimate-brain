import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { generateId, TYPE_PREFIX } from "../lib/ids.ts";
import { Workspace } from "../lib/workspace.ts";

/** `brain id new <type> [--count <n>]` (spec/cli.md §5.4). */
export const idNewCommand: Command = {
  name: "id new",
  usage: "brain id new <type> [--count <n>] [--json]",
  summary: "Generate unused, prefixed note IDs. IDs are not reserved.",
  options: { count: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain }) {
    const [type] = args.positionals;
    const prefix = type === undefined ? undefined : TYPE_PREFIX[type];
    if (prefix === undefined) throw new BrainError("USAGE", `Unknown note type: ${type ?? "(missing)"}`);

    const rawCount = args.options.count as string | undefined;
    const count = rawCount === undefined ? 1 : Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new BrainError("USAGE", "--count must be an integer from 1 through 100");
    }

    const workspace = await Workspace.open(brain!);
    const existing = workspace.ids();
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const id = generateId(prefix, existing);
      existing.add(id);
      ids.push(id);
    }
    return { data: { type, ids }, human: `${ids.join("\n")}\n` };
  },
};
