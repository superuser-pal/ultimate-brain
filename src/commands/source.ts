import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { rangesProblem, splitParts } from "../lib/parts.ts";
import { hasInboxBody } from "../lib/sync.ts";
import { formatTimestamp } from "../lib/time.ts";
import { Workspace } from "../lib/workspace.ts";

/** `brain source full-text <src-id> [--parts <range>[,<range>…]]` (spec/cli.md §5.17, 0043). */
export const sourceFullTextCommand: Command = {
  name: "source full-text",
  usage: "brain source full-text <src-id> [--parts <range>[,<range>…]] [--json]",
  summary: "Ask for a source's text on its Inbox row: all of it, or the parts given. The next render writes it once and clears the row's box.",
  options: { parts: "string" },
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain, now }) {
    const [id] = args.positionals;
    if (id === undefined) throw new BrainError("USAGE", "Name the source: brain source full-text <src-id>");
    const workspace = await Workspace.open(brain!);
    const note = workspace.get(id);
    if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    const invalid = (message: string): never => { throw new BrainError("INPUT_INVALID", message, [{ pointer: "", message }]); };
    if (note.type !== "source") invalid(`${id} is a ${note.type}, not a source`);
    if (!hasInboxBody(note)) invalid(`${id} has no Inbox body the brain writes (a minutes or capture source, or an attached file)`);

    const count = splitParts(note.body).parts.length;
    const raw = args.options.parts as string | undefined;
    const parts = raw === undefined ? undefined : raw.split(",").map((part) => part.trim());
    if (parts !== undefined) {
      if (parts.some((part) => part === "")) invalid(`--parts ${raw} has an empty item`);
      const problem = rangesProblem(parts, count);
      if (problem !== null) invalid(`--parts ${problem}`);
    }

    const requested = formatTimestamp(now);
    const document = workspace.edit(note);
    document.attributes.notion_text = "full";
    if (parts === undefined) delete document.attributes.notion_parts;
    else document.attributes.notion_parts = parts;
    document.attributes.notion_text_requested = requested;
    // System fields only: `updated` stays (spec/cli.md §3.6.6).
    workspace.save(note.path, document);
    const errors = workspace.newErrors();
    if (errors.length > 0) throw new BrainError("INPUT_INVALID", errors.map((issue) => `${issue.path}: ${issue.rule}: ${issue.message}`).join("; "));
    await workspace.commit([{ op: "full-text", id: note.id, title: String(note.attributes.title), pairs: [["parts", parts === undefined ? "all" : parts.join(",")]] }], now);
    return {
      data: { id: note.id, path: note.path, parts: count, notion_text: "full", notion_parts: parts ?? null, notion_text_requested: requested },
      human: `${note.path}: full text${parts === undefined ? "" : ` (parts ${parts.join(", ")} of ${count})`} on the next publish\n`,
    };
  },
};
