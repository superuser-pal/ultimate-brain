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

/** `brain source diff <src-id>` (spec/cli.md §5.19, 0045): the lines that changed from the version it replaces. */
export const sourceDiffCommand: Command = {
  name: "source diff",
  usage: "brain source diff <src-id> [--json]",
  summary: "Show the lines a new version of a source changed against the version it replaces, without context lines. Read-only.",
  options: {},
  maxPositionals: 1,
  needsBrain: true,
  async run({ args, brain }) {
    const [id] = args.positionals;
    if (id === undefined) throw new BrainError("USAGE", "Name the source: brain source diff <src-id>");
    const workspace = await Workspace.open(brain!);
    const note = workspace.get(id);
    if (note === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${id}`);
    const invalid = (message: string): never => { throw new BrainError("INPUT_INVALID", message, [{ pointer: "", message }]); };
    if (note.type !== "source") invalid(`${id} is a ${note.type}, not a source`);
    const replaces = note.attributes.replaces;
    if (typeof replaces !== "string") invalid(`${id} has no replaces: it is the first version`);
    const earlier = workspace.get(replaces as string);
    if (earlier === undefined) throw new BrainError("UNKNOWN_ID", `No note with id ${String(replaces)}`);
    const lines = lineDiff(earlier.body, note.body);
    const diff = lines.join("\n");
    return {
      data: { id: note.id, replaces: earlier.id, removed: lines.filter((line) => line.startsWith("- ")).length, added: lines.filter((line) => line.startsWith("+ ")).length, diff },
      human: diff === "" ? "no lines changed\n" : `${diff}\n`,
    };
  },
};

/**
 * The changed lines of `after` against `before`, as `- ` and `+ ` lines with no context, by the
 * longest common subsequence walk of spec/cli.md §5.19 (a tie removes first).
 */
export function lineDiff(before: string, after: string): string[] {
  const o = before.replace(/\r\n/g, "\n").split("\n");
  const n = after.replace(/\r\n/g, "\n").split("\n");
  const L = Array.from({ length: o.length + 1 }, () => new Array<number>(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i -= 1) {
    for (let j = n.length - 1; j >= 0; j -= 1) L[i]![j] = o[i] === n[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { i += 1; j += 1; }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) out.push(`- ${o[i++]}`);
    else out.push(`+ ${n[j++]}`);
  }
  while (i < o.length) out.push(`- ${o[i++]}`);
  while (j < n.length) out.push(`+ ${n[j++]}`);
  return out;
}
