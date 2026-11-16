import type { Command } from "../lib/command.ts";
import { BrainError } from "../lib/errors.ts";
import { assertNoProblems, isRecord, readJsonInput, unknownKeys } from "../lib/input.ts";
import { parseSettleInput, settle } from "../lib/notion-change.ts";
import { listProposals, PROPOSAL_STATUSES, stageBacklog, stageProposals, waitingProposals } from "../lib/proposals.ts";
import { Workspace } from "../lib/workspace.ts";
import { lintWarnings } from "../lib/warnings.ts";

/** Why an input item was not written, for the human output (the reasons of spec/cli.md §5.6). */
const SKIP_TEXT: Record<string, string> = {
  DUPLICATE_PENDING: "same as a pending proposal",
  ALREADY_LINKED: "already linked",
  NOTHING_TO_REVIEW: "nothing to review",
  ALREADY_ANSWERED: "the question already has an answer",
  NO_CHANGE: "no change",
  SOURCE_EXCLUDED: "rests on content you excluded from the brain",
};

/** `brain proposal new --input <file|-> [--dry-run]` (spec/cli.md §5.6). */
export const proposalNewCommand: Command = {
  name: "proposal new",
  usage: "brain proposal new --input <file|-> [--dry-run] [--json]",
  summary: "Write pending proposals for changes to existing knowledge. All or nothing; skips duplicates of pending proposals.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const input = await readJsonInput(args.options.input as string | undefined, "proposal new");
    if (!isRecord(input)) assertNoProblems([{ pointer: "", message: "must be an object with a proposals list" }]);
    const record = input as Record<string, unknown>;
    assertNoProblems(unknownKeys(record, ["proposals"], ""));

    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const { created, skipped } = stageProposals(workspace, record.proposals, now);
    const warnings = lintWarnings(workspace.warnings());
    if (!dryRun) {
      await workspace.commit(created.map((proposal) => ({
        op: "proposal-new",
        id: proposal.id,
        title: proposal.title,
        pairs: proposal.target === undefined ? [["kind", proposal.kind]] : [["kind", proposal.kind], ["target", proposal.target]],
      })), now);
    }
    const human = created.map((proposal) => `${dryRun ? "would create" : "created"} ${proposal.path}\n`).join("")
      + skipped.map((skip) => `skipped proposals[${skip.input_index}]: ${SKIP_TEXT[skip.reason] ?? skip.reason}${skip.existing === undefined ? "" : ` (${skip.existing})`}\n`).join("");
    return { data: { created, skipped, dry_run: dryRun }, warnings, human: human || "Nothing to write.\n" };
  },
};

const HELD_TITLE = "held: rests on content you excluded from the brain";

/** `brain proposal list [--status <s>[,<s>…]] [--target <id>]` and `--waiting [--target <id>]` (spec/cli.md §5.6). */
export const proposalListCommand: Command = {
  name: "proposal list",
  usage: "brain proposal list [--status <s>[,<s>…] | --waiting] [--target <id>] [--json]",
  summary: "List proposals, filtered by status and target, sorted by created then id; --waiting lists what the session asks, in the order of its questions.",
  options: { status: "string", target: "string", waiting: "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain }) {
    if (args.options.waiting === true) {
      // What the session asks, in the order of its questions, and the withheld ones apart (cli §5.6, capture-and-review §7.5).
      if (args.options.status !== undefined) throw new BrainError("USAGE", "--waiting lists pending proposals: it takes no --status");
      const workspace = await Workspace.open(brain!);
      const data = waitingProposals(workspace, args.options.target as string | undefined);
      const human = (data.waiting.length === 0 ? "Nothing waiting for your decision.\n" : data.waiting.map((proposal) => `${String(proposal.group)} ${String(proposal.id)} ${String(proposal.kind)} ${proposal.title === undefined ? HELD_TITLE : String(proposal.title)}\n`).join(""))
        + (data.held.length === 0 ? "" : `${data.held.length} held: ${data.held.length === 1 ? "it rests" : "they rest"} on content you excluded from the brain\n`);
      return { data, human };
    }
    const statuses = typeof args.options.status === "string" ? args.options.status.split(",").map((status) => status.trim()).filter((status) => status !== "") : [];
    const unknown = statuses.filter((status) => !(PROPOSAL_STATUSES as readonly string[]).includes(status));
    if (unknown.length > 0) throw new BrainError("USAGE", `Unknown status ${unknown.join(", ")}; use ${PROPOSAL_STATUSES.join(", ")}`);
    const workspace = await Workspace.open(brain!);
    const proposals = listProposals(workspace, statuses, args.options.target as string | undefined);
    const human = proposals.length === 0
      ? "No proposals.\n"
      : proposals.map((proposal) => `${String(proposal.id)} ${String(proposal.status)} ${String(proposal.kind)} ${proposal.title === undefined ? HELD_TITLE : String(proposal.title)}\n`).join("");
    return { data: { proposals }, human };
  },
};

/** `brain proposal backlog [--dry-run]` (spec/cli.md §5.6, 0041). */
export const proposalBacklogCommand: Command = {
  name: "proposal backlog",
  usage: "brain proposal backlog [--dry-run] [--json]",
  summary: "Write one Review notes proposal per source over the draft notes nobody has accepted yet. A second run writes nothing.",
  options: { "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const created = stageBacklog(workspace, now);
    const warnings = lintWarnings(workspace.warnings());
    if (!dryRun) {
      await workspace.commit(created.map((proposal) => ({ op: "proposal-new", id: proposal.id, title: proposal.title, pairs: [["kind", proposal.kind]] })), now);
    }
    const human = created.map((proposal) => `${dryRun ? "would create" : "created"} ${proposal.path}\n`).join("");
    return { data: { created, skipped: [], dry_run: dryRun }, warnings, human: human || "Nothing to write.\n" };
  },
};

/** `brain proposal revise` (spec/cli.md §5.27): retired in 0.16.0 by decision 0096. Writes nothing. */
export const proposalReviseCommand: Command = {
  name: "proposal revise",
  usage: "brain proposal revise --input <file|-> [--dry-run] [--json]",
  summary: "Retired in 0.16.0: a redraft is shown and accepted in the session, then applied as a fix.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run() {
    throw new BrainError("RETIRED", "brain proposal revise was retired in 0.16.0: show the new wording in the session and apply the accepted one as a fix (brain apply)");
  },
};

/** `brain proposal settle --input <file|-> [--dry-run]` (spec/cli.md §5.6, assistant.md §6.4): what the skill did with each Notion write. */
export const proposalSettleCommand: Command = {
  name: "proposal settle",
  usage: "brain proposal settle --input <file|-> [--dry-run] [--json]",
  summary: "Record the result of the Notion writes of approved notion_change proposals: applied, or stale. Atomic per item; exits 1 if any item failed.",
  options: { input: "string", "dry-run": "boolean" },
  maxPositionals: 0,
  needsBrain: true,
  async run({ args, brain, now }) {
    const items = parseSettleInput(await readJsonInput(args.options.input as string | undefined, "proposal settle"));
    const dryRun = args.options["dry-run"] === true;
    const workspace = await Workspace.open(brain!);
    const { settled, log } = settle(workspace, items, now);
    if (!dryRun) await workspace.commit(log, now);
    const human = settled.map((item) => `${item.result} ${item.proposal}${item.reason === undefined ? "" : ` (${item.reason})`}\n`).join("");
    return { data: { settled, dry_run: dryRun }, exitCode: settled.some((item) => item.result === "failed") ? 1 : 0, human: human || "Nothing to settle.\n" };
  },
};
