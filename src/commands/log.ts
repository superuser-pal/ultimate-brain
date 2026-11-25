import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { appendLog, formatLogLine } from "../lib/log.ts";
import { scanNotes } from "../lib/notes.ts";
import { waitingProposals } from "../lib/proposals.ts";
import { Workspace } from "../lib/workspace.ts";

const OP = /^[a-z][a-z0-9-]*$/;
const KEY = /^[a-z][a-z0-9_]*$/;

/** `brain log <op> [<id>] [--title <title>] [<key>=<value>…]` (spec/cli.md §5.11). */
export const logCommand: Command = {
  name: "log",
  usage: "brain log <op> [<id>|-] [--title <title>] [<key>=<value>…] [--json]",
  summary: "Append one operation line to log/<YYYY-MM>.md.",
  options: { title: "string" },
  needsBrain: true,
  async run({ args, brain, now }) {
    const [op, ...rest] = args.positionals;
    if (op === undefined || !OP.test(op)) {
      throw new BrainError("USAGE", "brain log needs an <op> matching [a-z][a-z0-9-]*");
    }

    let id = "-";
    const pairs: Array<[string, string]> = [];
    for (const [index, value] of rest.entries()) {
      const equals = value.indexOf("=");
      if (equals !== -1) {
        const key = value.slice(0, equals);
        if (!KEY.test(key)) throw new BrainError("USAGE", `Invalid key "${key}": keys match [a-z][a-z0-9_]*`);
        pairs.push([key, value.slice(equals + 1)]);
      } else if (index === 0) {
        id = value;
      } else {
        throw new BrainError("USAGE", `Expected <key>=<value>, got "${value}"`);
      }
    }

    let title = args.options.title as string | undefined;
    if (id !== "-") {
      const { notes } = await scanNotes(brain!.root);
      const note = notes.find((candidate) => candidate.id === id);
      if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
      title ??= typeof note.attributes.title === "string" ? note.attributes.title : "";
    }

    // An unattended catch-up never counts its own `waiting` (spec/cli.md §5.11, 0.18.0).
    if (op === "catch-up" && pairs.some(([key, value]) => key === "mode" && value === "unattended")) {
      const { waiting } = waitingProposals(await Workspace.open(brain!), undefined).counts;
      const others = pairs.filter(([key]) => key !== "waiting");
      const at = others.findIndex(([key]) => key === "failed");
      others.splice(at === -1 ? others.length : at, 0, ["waiting", String(waiting)]);
      pairs.splice(0, pairs.length, ...others);
    }

    const entry = { op, id, title: title ?? "", pairs };
    const path = await appendLog(brain!.root, now, [entry]);
    const line = formatLogLine(now, entry);
    return { data: { path, line }, human: `${line}\n` };
  },
};
